import { Express } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from './db';
import { users } from '../shared/schema';
import { storage } from './storage';
import { emailService } from './lib/email-service';
import { eq, and, gt } from 'drizzle-orm';
import { registrationLimiter } from './middleware/rate-limiter';
import { sanitizeHtml, preventSqlInjection } from './middleware/sanitization';
import { validateEmailUniqueness } from './middleware/email-validation';

// Request interfaces
interface RegistrationRequest {
  email: string;
  password: string;
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

// In-memory store for pending registrations (in production, use Redis or database)
const pendingRegistrations = new Map<string, {
  email: string;
  hashedPassword: string;
  token: string;
  expiresAt: Date;
}>();

export function registerEmailLinkAuth(app: Express): void {
  
  /**
   * POST /api/auth/register-email
   * Step 1: Store user data temporarily and send verification email with link
   */
  app.post('/api/auth/register-email', registrationLimiter, sanitizeHtml, preventSqlInjection, validateEmailUniqueness, async (req, res) => {
    try {
      const { email, password }: RegistrationRequest = registrationSchema.parse(req.body);
      const normalizedEmail = email.toLowerCase().trim();
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(409).json({
          message: 'An account with this email already exists. Please try logging in instead.'
        });
      }

      // Generate verification token
      const verificationToken = crypto.randomUUID();
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Store pending registration (expires in 24 hours)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      pendingRegistrations.set(verificationToken, {
        email: normalizedEmail,
        hashedPassword,
        token: verificationToken,
        expiresAt
      });

      // Send verification email
      try {
        await emailService.sendEmailVerificationLink({
          userEmail: normalizedEmail,
          verificationToken,
          userName: normalizedEmail.split('@')[0] // Use email prefix as name
        });
        
        console.log(`📧 Verification email sent to: ${email}`);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        pendingRegistrations.delete(verificationToken);
        return res.status(500).json({
          message: 'Failed to send verification email. Please try again.'
        });
      }

      res.status(200).json({
        message: 'Registration successful! Please check your email and click the verification link to activate your account.',
        email: normalizedEmail
      });

    } catch (error) {
      console.error('Registration error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid input data',
          errors: error.errors
        });
      }
      
      res.status(500).json({
        message: 'Internal server error. Please try again.'
      });
    }
  });

  /**
   * GET /api/auth/verify-email/:token
   * Verify email and create user account
   */
  app.get('/api/auth/verify-email/:token', async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #ef4444;">❌ Invalid Verification Link</h2>
              <p>The verification link is missing or invalid.</p>
              <a href="/register-user" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Register Again</a>
            </body>
          </html>
        `);
      }

      // Get pending registration
      const pendingReg = pendingRegistrations.get(token);
      
      if (!pendingReg) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #ef4444;">❌ Verification Link Expired</h2>
              <p>This verification link has expired or is invalid.</p>
              <a href="/register-user" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Register Again</a>
            </body>
          </html>
        `);
      }

      // Check if expired
      if (new Date() > pendingReg.expiresAt) {
        pendingRegistrations.delete(token);
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #ef4444;">⏰ Verification Link Expired</h2>
              <p>This verification link has expired. Please register again.</p>
              <a href="/register-user" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Register Again</a>
            </body>
          </html>
        `);
      }

      // Check if user already exists (race condition protection)
      const existingUser = await storage.getUserByEmail(pendingReg.email);
      if (existingUser) {
        pendingRegistrations.delete(token);
        return res.status(200).send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #3b82f6;">✅ Account Already Exists</h2>
              <p>An account with this email already exists. You can log in now.</p>
              <a href="/login" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Login</a>
            </body>
          </html>
        `);
      }

      // Create user account
      const [newUser] = await db.insert(users).values({
        username: pendingReg.email,
        email: pendingReg.email,
        password: pendingReg.hashedPassword,
        role: 'client',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        isActive: true
      }).returning();

      // Clean up pending registration
      pendingRegistrations.delete(token);

      console.log(`✅ New user account created via email verification: ${newUser.email} (ID: ${newUser.id})`);

      // Success page with redirect to dashboard
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Email Verified - Sharp Note</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px 20px; background: #f8fafc; }
              .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
              .success-icon { font-size: 64px; margin-bottom: 20px; }
              .title { color: #1e40af; font-size: 28px; margin-bottom: 16px; font-weight: 600; }
              .message { color: #374151; margin-bottom: 30px; line-height: 1.6; }
              .button { display: inline-block; background: #1e40af; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; transition: background 0.2s; }
              .button:hover { background: #1d4ed8; }
            </style>
            <script>
              // Auto redirect after 3 seconds
              setTimeout(() => {
                window.location.href = '/dashboard';
              }, 3000);
            </script>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1 class="title">Email Verified Successfully!</h1>
              <p class="message">
                Your account has been created and activated. You'll be redirected to your dashboard in 3 seconds.
              </p>
              <a href="/dashboard" class="button">Go to Dashboard</a>
            </div>
          </body>
        </html>
      `);

    } catch (error) {
      console.error('Error verifying email:', error);
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Verification Error - Sharp Note</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px 20px; background: #f8fafc; }
              .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
              .error-icon { font-size: 64px; margin-bottom: 20px; }
              .title { color: #dc2626; font-size: 28px; margin-bottom: 16px; font-weight: 600; }
              .message { color: #374151; margin-bottom: 30px; line-height: 1.6; }
              .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; transition: background 0.2s; }
              .button:hover { background: #b91c1c; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error-icon">❌</div>
              <h1 class="title">Verification Failed</h1>
              <p class="message">
                There was an error creating your account. Please try registering again.
              </p>
              <a href="/register-user" class="button">Try Again</a>
            </div>
          </body>
        </html>
      `);
    }
  });

  /**
   * Clean up expired registrations (runs every hour)
   */
  setInterval(() => {
    const now = new Date();
    // Fix TypeScript iteration issue by using Array.from
    const entries = Array.from(pendingRegistrations.entries());
    for (const [token, registration] of entries) {
      if (now > registration.expiresAt) {
        pendingRegistrations.delete(token);
        console.log(`🧹 Cleaned up expired registration token for ${registration.email}`);
      }
    }
  }, 60 * 60 * 1000); // Run every hour
} 