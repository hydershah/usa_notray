import { Express } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from './db';
import { users, otpVerifications } from '../shared/schema';
import { storage } from './storage';
import { emailService } from './lib/email-service';
import { eq, and, gt } from 'drizzle-orm';
import { registrationLimiter, otpLimiter } from './middleware/rate-limiter';
import { sanitizeHtml, preventSqlInjection } from './middleware/sanitization';
import { validateEmailUniqueness } from './middleware/email-validation';

// Request/Response interfaces
interface RegistrationRequest {
  email: string;
  password: string;
}

interface VerifyOtpRequest {
  email: string;
  otpCode: string;
  password: string;
}

interface ApiResponse<T = any> {
  message: string;
  data?: T;
  error?: string;
}

// Validation schemas
const registrationSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character')
});

const verifyOtpSchema = z.object({
  email: z.string().email('Valid email is required'),
  otpCode: z.string().length(6, 'OTP code must be 6 digits'),
  password: z.string().min(8, 'Password is required')
});

// Constants
const OTP_EXPIRATION_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCKOUT_DURATION_MINUTES = 30;

// Helper functions
const generateOtpCode = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

const getClientIpAddress = (req: any): string => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         '0.0.0.0';
};

const getUserAgent = (req: any): string => {
  return req.headers['user-agent'] || 'Unknown';
};

export function registerOtpRoutes(app: Express): void {
  
  /**
   * POST /api/auth/register-otp
   * Step 1: Generate and send OTP code for email verification
   */
  app.post('/api/auth/register-otp', registrationLimiter, sanitizeHtml, preventSqlInjection, validateEmailUniqueness, async (req, res) => {
    try {
      const { email, password }: RegistrationRequest = registrationSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email.trim().toLowerCase());
      if (existingUser) {
        return res.status(409).json({
          message: 'An account with this email already exists. Please try logging in instead.',
          error: 'USER_EXISTS'
        } as ApiResponse);
      }

      // Check for existing active OTP that's not expired
      const existingOtp = await db.select()
        .from(otpVerifications)
        .where(
          and(
            eq(otpVerifications.email, email),
            eq(otpVerifications.verified, false),
            gt(otpVerifications.expiresAt, new Date())
          )
        )
        .limit(1);

      let otpCode: string;
      let otpRecord: any;

      if (existingOtp.length > 0) {
        // Check if account is locked due to too many attempts
        const otp = existingOtp[0];
        if (otp.lockedUntil && otp.lockedUntil > new Date()) {
          const lockoutEndsAt = new Date(otp.lockedUntil).toLocaleTimeString();
          return res.status(429).json({
            message: `Too many OTP attempts. Please try again after ${lockoutEndsAt}`,
            error: 'OTP_LOCKED'
          } as ApiResponse);
        }

        // Use existing OTP code
        otpCode = otp.otpCode;
        otpRecord = otp;
      } else {
        // Generate new OTP code
        otpCode = generateOtpCode();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRATION_MINUTES);

        // Insert new OTP record
        const [newOtpRecord] = await db.insert(otpVerifications).values({
          email,
          otpCode,
          expiresAt,
          verified: false,
          attempts: 0,
          userAgent: getUserAgent(req),
          ipAddress: getClientIpAddress(req)
        }).returning();

        otpRecord = newOtpRecord;
      }

      // Send OTP email
      try {
        await emailService.sendEmailVerificationOtp({
          userEmail: email,
          otpCode,
          expirationMinutes: OTP_EXPIRATION_MINUTES
        });
        
        console.log(`📧 OTP verification email sent to: ${email}`);
      } catch (emailError) {
        console.error('Failed to send OTP email:', emailError);
        return res.status(500).json({
          message: 'Failed to send verification email. Please try again.',
          error: 'EMAIL_SEND_FAILED'
        } as ApiResponse);
      }

      res.status(200).json({
        message: 'Verification code sent to your email. Please check your inbox and enter the 6-digit code.',
        data: {
          email,
          expiresIn: OTP_EXPIRATION_MINUTES,
          canResendAfter: 60 // seconds
        }
      } as ApiResponse);

    } catch (error) {
      console.error('Registration error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid input data',
          error: 'VALIDATION_ERROR',
          data: error.errors
        } as ApiResponse);
      }
      
      res.status(500).json({
        message: 'Internal server error. Please try again.',
        error: 'INTERNAL_ERROR'
      } as ApiResponse);
    }
  });

  /**
   * POST /api/auth/verify-email
   * Step 2: Verify OTP code and create user account
   */
  app.post('/api/auth/verify-email', otpLimiter, sanitizeHtml, preventSqlInjection, async (req, res) => {
    try {
      const { email, otpCode, password }: VerifyOtpRequest = verifyOtpSchema.parse(req.body);

      // Find the OTP record
      const [otpRecord] = await db.select()
        .from(otpVerifications)
        .where(
          and(
            eq(otpVerifications.email, email),
            eq(otpVerifications.verified, false)
          )
        )
        .limit(1);

      if (!otpRecord) {
        return res.status(404).json({
          message: 'No verification request found for this email. Please start the registration process again.',
          error: 'OTP_NOT_FOUND'
        } as ApiResponse);
      }

      // Check if OTP is expired
      if (new Date() > otpRecord.expiresAt) {
        return res.status(400).json({
          message: 'Verification code has expired. Please request a new one.',
          error: 'OTP_EXPIRED'
        } as ApiResponse);
      }

      // Check if account is locked
      if (otpRecord.lockedUntil && otpRecord.lockedUntil > new Date()) {
        const lockoutEndsAt = new Date(otpRecord.lockedUntil).toLocaleTimeString();
        return res.status(429).json({
          message: `Too many failed attempts. Please try again after ${lockoutEndsAt}`,
          error: 'OTP_LOCKED'
        } as ApiResponse);
      }

      // Verify OTP code
      if (otpRecord.otpCode !== otpCode) {
        const newAttempts = otpRecord.attempts + 1;
        
        // Check if we should lock the account
        const shouldLock = newAttempts >= MAX_OTP_ATTEMPTS;
        const lockedUntil = shouldLock ? 
          new Date(Date.now() + OTP_LOCKOUT_DURATION_MINUTES * 60 * 1000) : 
          null;

        // Update attempts count and potentially lock
        await db.update(otpVerifications)
          .set({
            attempts: newAttempts,
            lockedUntil
          })
          .where(eq(otpVerifications.id, otpRecord.id));

        if (shouldLock) {
          return res.status(429).json({
            message: `Too many failed attempts. Your verification is locked for ${OTP_LOCKOUT_DURATION_MINUTES} minutes.`,
            error: 'OTP_LOCKED'
          } as ApiResponse);
        }

        const remainingAttempts = MAX_OTP_ATTEMPTS - newAttempts;
        return res.status(400).json({
          message: `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
          error: 'INVALID_OTP',
          data: { remainingAttempts }
        } as ApiResponse);
      }

      // Check if user was created in the meantime
      const existingUser = await storage.getUserByEmail(email.trim().toLowerCase());
      if (existingUser) {
        return res.status(409).json({
          message: 'An account with this email already exists. Please try logging in instead.',
          error: 'USER_EXISTS'
        } as ApiResponse);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user account
      const newUser = await storage.createUser({
        username: email,
        email,
        password: hashedPassword,
        role: 'client',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        isActive: true
      });

      // Mark OTP as verified
      await db.update(otpVerifications)
        .set({
          verified: true,
          verifiedAt: new Date()
        })
        .where(eq(otpVerifications.id, otpRecord.id));

      console.log(`✅ New user account created and verified: ${newUser.email} (ID: ${newUser.id})`);

      res.status(201).json({
        message: 'Account created successfully! You can now log in with your credentials.',
        data: {
          userId: newUser.id,
          email: newUser.email,
          emailVerified: true
        }
      } as ApiResponse);

    } catch (error) {
      console.error('OTP verification error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid input data',
          error: 'VALIDATION_ERROR',
          data: error.errors
        } as ApiResponse);
      }
      
      res.status(500).json({
        message: 'Internal server error. Please try again.',
        error: 'INTERNAL_ERROR'
      } as ApiResponse);
    }
  });

  /**
   * POST /api/auth/resend-otp
   * Resend OTP code for email verification
   */
  app.post('/api/auth/resend-otp', otpLimiter, sanitizeHtml, preventSqlInjection, async (req, res) => {
    try {
      const { email } = z.object({
        email: z.string().email('Valid email is required')
      }).parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email.trim().toLowerCase());
      if (existingUser) {
        return res.status(409).json({
          message: 'An account with this email already exists. Please try logging in instead.',
          error: 'USER_EXISTS'
        } as ApiResponse);
      }

      // Find existing unverified OTP
      const [existingOtp] = await db.select()
        .from(otpVerifications)
        .where(
          and(
            eq(otpVerifications.email, email),
            eq(otpVerifications.verified, false)
          )
        )
        .limit(1);

      if (!existingOtp) {
        return res.status(404).json({
          message: 'No verification request found. Please start the registration process.',
          error: 'OTP_NOT_FOUND'
        } as ApiResponse);
      }

      // Check if account is locked
      if (existingOtp.lockedUntil && existingOtp.lockedUntil > new Date()) {
        const lockoutEndsAt = new Date(existingOtp.lockedUntil).toLocaleTimeString();
        return res.status(429).json({
          message: `Account is locked due to too many attempts. Please try again after ${lockoutEndsAt}`,
          error: 'OTP_LOCKED'
        } as ApiResponse);
      }

      // Generate new OTP code
      const newOtpCode = generateOtpCode();
      const newExpiresAt = new Date();
      newExpiresAt.setMinutes(newExpiresAt.getMinutes() + OTP_EXPIRATION_MINUTES);

      // Update OTP record
      await db.update(otpVerifications)
        .set({
          otpCode: newOtpCode,
          expiresAt: newExpiresAt,
          attempts: 0,
          lockedUntil: null
        })
        .where(eq(otpVerifications.id, existingOtp.id));

      // Send new OTP email
      try {
        await emailService.sendEmailVerificationOtp({
          userEmail: email,
          otpCode: newOtpCode,
          expirationMinutes: OTP_EXPIRATION_MINUTES
        });
        
        console.log(`📧 New OTP verification email sent to: ${email}`);
      } catch (emailError) {
        console.error('Failed to send OTP email:', emailError);
        return res.status(500).json({
          message: 'Failed to send verification email. Please try again.',
          error: 'EMAIL_SEND_FAILED'
        } as ApiResponse);
      }

      res.status(200).json({
        message: 'New verification code sent to your email.',
        data: {
          email,
          expiresIn: OTP_EXPIRATION_MINUTES
        }
      } as ApiResponse);

    } catch (error) {
      console.error('Resend OTP error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid email address',
          error: 'VALIDATION_ERROR'
        } as ApiResponse);
      }
      
      res.status(500).json({
        message: 'Internal server error. Please try again.',
        error: 'INTERNAL_ERROR'
      } as ApiResponse);
    }
  });
} 