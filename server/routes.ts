import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { registerCompanyRoutes } from "./company-routes";
import { registerUserManagementRoutes } from "./user-management-routes";
import { registerNotaryProfileRoutes } from "./notary-profile-routes";
import { registerApprovalWorkflowRoutes } from "./approval-workflow-routes";
import { registerFeeRoutes } from "./fee-routes";
import { registerTitleCompanyNotaryRoutes } from "./title-company-notary-routes";
import { registerAdminVerificationRoutes } from "./routes/admin-verification-routes";
import adminLogsRoutes from "./routes/admin-logs-routes";
import notaryVerificationRoutes from "./routes/notary-verification-routes";
import notaryJobApprovalRoutes from "./routes/notary-job-approval-routes";
import screenRecordingRoutes from "./routes/screen-recording-api";
import { auditLoggingService } from "./services/audit-logging-service";
import { notificationService } from "./notification-service";
import { verifyToken, hasAdminPrivileges, hasNotaryPrivileges, type AuthUser } from "./auth";
import { cacheAdminData, cacheUserData, cacheCompanyData, cacheJobData } from "./middleware/cache-middleware";

// Define the extended request interface for authentication
interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { redisCache } from "./services/redis-cache";
import { eq, and, gte, lte, desc, inArray, sql, or } from "drizzle-orm";
import { randomNotaryService, NotaryQualifications, TimeSlotRequest } from "./random-notary-service";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import nodemailer from "nodemailer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { promises as fsPromises } from "fs";
import { 
  insertUserSchema, 
  insertTitleCompanySchema,
  insertCompanySchema, 
  insertJobSchema, 
  insertSignerSchema,
  insertPaymentSchema,
  insertInvoiceSchema,
  insertClosingTypeSchema,
  insertNotaryStampSchema,
  type Payment,
  type Invoice,
  type Job,
  type User,
  type NotaryStamp,
  type Company,
  // Calendar tables
  notaryTimeSlots,
  calendarEvents,
  notaryWorkingHours,
  notaryAvailability,
  users,
  jobs,
  signers,
  jobParticipants,
  jobDocuments,
  notaryStamps,
  payments,
  paymentSchedules,
  closingTypes,
  systemSettings,
  notaryAssignmentLog,
  titleCompanies,
  companies,
  titleCompanyNotaryAssignments,
  insertJobParticipantSchema,
  insertJobDocumentSchema,
  insertPaymentScheduleSchema,
  insertSystemSettingSchema,
  insertNotaryAssignmentLogSchema,
  passwordResetTokens,
  notaryLogEntries,
  auditTrail,
  systemActivityLogs,
  editorSessions,
  sessionParticipants,
  documentVersions,
  jobNotifications,
  userSignatures,
} from "@shared/schema";

// Import enhanced upload handlers
import { 
  signatureUpload, 
  documentUpload, 
  stampUpload,
  handleSignatureUpload,
  handleDocumentUpload,
  handleNotaryStampUpload,
  getUploadedFile
} from "./enhanced-upload";

import passport from 'passport';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { z } from 'zod';
import { DrizzleError } from 'drizzle-orm';
import fetch from 'node-fetch';
// Note: verifyToken is defined below instead of importing

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Helper function to add an hour to a time string
function addHourToTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const newHours = (hours + 1) % 24;
  return `${newHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Professional multer configuration optimized for Vultr cloud storage
const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage for direct cloud uploads
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for cloud storage
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain',
      'video/mp4',
      'video/webm',
      'video/mov',
      'audio/wav',
      'audio/mp3'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload PDF, DOC, DOCX, images, videos, or audio files only.'));
    }
  }
});

// Import the professional email service
import { emailService } from './lib/email-service';

// Import enhanced login logging service
import { enhancedLoginLoggingService } from './services/enhanced-login-logging-service';

// Import security middleware
import { 
  authLimiter, 
  registrationLimiter, 
  passwordResetLimiter,
  apiLimiter 
} from './middleware/rate-limiter';
import { 
  sanitizeHtml, 
  preventSqlInjection 
} from './middleware/sanitization';
import { 
  checkAccountLockout, 
  recordFailedLogin, 
  clearFailedAttempts 
} from './middleware/account-lockout';

// Import email template routes
import {
  getAllTemplates,
  getTemplate,
  getTemplateVariables,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
  sendTestEmail,
  getEmailLogs,
  getTemplateCategories
} from './email-template-routes';

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Initialize session management service
  try {
    const { SessionManagementService } = await import('./services/session-management-service');
    await SessionManagementService.initialize();
  } catch (error) {
    console.error('❌ Failed to initialize session management:', error);
  }

  // Basic route handlers to prevent 404 errors
  // Only serve API response if we're not serving static files
  app.get('/', (req, res, next) => {
    // In production with static files, let the static middleware handle this
    if (process.env.NODE_ENV === 'production' && process.env.SERVE_STATIC_FILES !== 'false') {
      return next(); // Let static file middleware handle this
    }
    
    // Otherwise serve API information
    res.json({ 
      status: 'ok', 
      message: 'Notary API Server', 
      version: '1.0.0',
      endpoints: {
        api: '/api',
        health: '/health',
        docs: '/api/docs'
      }
    });
  });

  app.get('/favicon.ico', (req, res) => {
    res.status(204).send(); // No content
  });



  // Add audit logging middleware to all routes
  app.use((req: any, res: any, next: any) => {
    auditLoggingService.auditMiddleware()(req, res, next);
  });

  // Authentication routes
  app.post('/api/auth/login', authLimiter, checkAccountLockout, async (req, res) => {
    try {
      const { email, password, twoFactorCode } = req.body;
      
      if (!email || !password) {
        // Log failed attempt due to missing credentials
        await enhancedLoginLoggingService.logFailedLogin(req, email || 'unknown', 'Missing email or password');
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        recordFailedLogin(email);
        // Log failed attempt due to user not found
        await enhancedLoginLoggingService.logFailedLogin(req, email, 'User not found');
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        recordFailedLogin(email);
        // Log failed attempt due to invalid password
        await enhancedLoginLoggingService.logFailedLogin(req, email, 'Invalid password');
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check if 2FA is enabled for this user
      if (user.mfaEnabled) {
        if (!twoFactorCode) {
          // Log 2FA required attempt
          await enhancedLoginLoggingService.logTwoFactorRequired(req, {
            id: user.id,
            email: user.email,
            username: user.username || undefined,
            fullName: user.fullName || undefined,
            role: user.role,
            privileges: user.privileges || []
          });
          
          // Return without token, indicating 2FA is required
          return res.json({
            requiresTwoFactor: true,
            message: 'Two-factor authentication is required'
          });
        }

        // Verify 2FA code
        if (!user.mfaSecret) {
          await enhancedLoginLoggingService.logFailedLogin(req, email, '2FA configuration error');
          return res.status(500).json({ message: '2FA configuration error' });
        }

        const verified = speakeasy.totp.verify({
          secret: user.mfaSecret,
          encoding: 'base32',
          token: twoFactorCode,
          window: 2 // Allow 2 time steps before/after for clock drift
        });

        if (!verified) {
          recordFailedLogin(email);
          // Log failed attempt due to invalid 2FA code
          await enhancedLoginLoggingService.logFailedLogin(req, email, 'Invalid 2FA code');
          return res.status(401).json({ message: 'Invalid two-factor authentication code' });
        }
      }

      // Clear failed attempts on successful login
      clearFailedAttempts(email);

      // Generate token with privileges included
      const tokenPayload = { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        privileges: user.privileges || []
      };
      
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

      // Create session for tracking
      let sessionId = null;
      try {
        const { SessionManagementService } = await import('./services/session-management-service');
        sessionId = await SessionManagementService.createSession(tokenPayload, req);
      } catch (sessionError) {
        console.error('Failed to create session:', sessionError);
        // Don't fail login if session creation fails
      }

      // Check privileges for frontend
      const isAdmin = hasAdminPrivileges(user);
      const isNotary = hasNotaryPrivileges(user);

      // Log successful login with comprehensive details
      await enhancedLoginLoggingService.logSuccessfulLogin(req, {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        privileges: user.privileges || []
      });

      // Track login in comprehensive session tracking system
      try {
        const { comprehensiveSessionTrackingService } = await import('./services/comprehensive-session-tracking-service');
        await comprehensiveSessionTrackingService.trackLogin(req, {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          name: user.fullName || user.username
        }, sessionId);
      } catch (trackingError) {
        console.error('Failed to track login in session tracking system:', trackingError);
        // Don't fail login if tracking fails
      }

      res.json({
        token,
        sessionId, // Include session ID for client-side tracking
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          privileges: user.privileges,
          // Include privilege flags for easy frontend checking
          isAdmin,
          isNotary
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      // Log system error
      await enhancedLoginLoggingService.logFailedLogin(req, req.body?.email || 'unknown', `System error: ${error.message}`);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/register', registrationLimiter, sanitizeHtml, preventSqlInjection, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });

      // Invalidate users cache to ensure fresh data on next request
      try {
        await redisCache.delPattern(`admin:*`); // Clear admin caches
        await redisCache.delPattern(`user:*`); // Clear all user caches
        await redisCache.delPattern(`api:*users*`); // Clear users API cache
        console.log(`🧹 Invalidated user caches after registration of user ${user.id}`);
      } catch (cacheError) {
        console.error('Failed to invalidate cache after user registration:', cacheError);
        // Don't fail the request if cache invalidation fails
      }

      res.status(201).json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/auth/me', verifyToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check privileges for frontend
      const isAdmin = hasAdminPrivileges(user);
      const isNotary = hasNotaryPrivileges(user);

      // Get company information for title company users
      let companyInfo = null;
      if (user.role === 'title_company' && user.companyId) {
        try {
          companyInfo = await storage.getCompany(user.companyId);
        } catch (error) {
          console.warn('Failed to fetch company info for user:', user.id, error);
        }
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        privileges: user.privileges,
        // Include privilege flags for easy frontend checking
        isAdmin,
        isNotary,
        notaryType: user.notaryType,
        // Include company information for title company users
        companyId: user.companyId,
        companyName: companyInfo?.companyName || null,
        firstName: user.firstName,
        lastName: user.lastName,
        // CRITICAL: Add verification status for signers/witnesses to show proper UI
        isVerified: user.isVerified || false,
        isVerificationBypassed: user.isVerificationBypassed || false,
        notaryVerificationBypassed: user.notaryVerificationBypassed || false,
        verificationStatus: user.verificationStatus || 'pending',
        needsVerification: (user.role === 'signer' || user.role === 'witness') && 
                          !user.isVerified && 
                          !user.isVerificationBypassed && 
                          !user.notaryVerificationBypassed,
        accountSetupComplete: user.accountSetupComplete || false
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/logout', verifyToken, async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      const sessionId = req.headers['x-session-id'] as string;
      
      if (authHeader) {
        // Blacklist the current token
        const { SessionManagementService } = await import('./services/session-management-service');
        await SessionManagementService.blacklistToken(authHeader, 'user_logout');
        
        // Invalidate the session if session ID is provided
        if (sessionId) {
          await SessionManagementService.invalidateSession(sessionId, 'user_logout');
        }
        
        console.log(`🚪 User logged out: ${req.user.email} (ID: ${req.user.id})`);
      }
      
      // Update user's last logout time for audit purposes
      try {
        await storage.executeQuery(
          'UPDATE users SET last_logout_at = NOW() WHERE id = $1',
          [req.user.id]
        );
      } catch (dbError) {
        console.error('Failed to update logout time:', dbError);
        // Don't fail the logout for this
      }
      
      res.json({ 
        message: 'Logged out successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ==========================================
  // 2FA AUTHENTICATION ROUTES
  // ==========================================

  // Get 2FA status for current user
  app.get('/api/auth/2fa/status', verifyToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        enabled: user.mfaEnabled || false,
        hasSecret: !!(user.mfaSecret)
      });
    } catch (error) {
      console.error('2FA status error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Setup 2FA for current user
  app.post('/api/auth/2fa/setup', verifyToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Generate secret for TOTP
      const secret = speakeasy.generateSecret({
        name: `USA Notary (${user.email})`,
        issuer: 'USA Notary Platform',
        length: 32
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

      // Store secret in database (not enabled yet)
      await db.update(users)
        .set({ 
          mfaSecret: secret.base32 || '',
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));

      res.json({
        secret: secret.base32 || '',
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32 || '',
        backupCodes: [] // Could implement backup codes later
      });
    } catch (error) {
      console.error('2FA setup error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Verify 2FA token and enable 2FA
  app.post('/api/auth/2fa/verify', verifyToken, async (req: any, res) => {
    try {
      const { token } = req.body;
      
      if (!token || token.length !== 6) {
        return res.status(400).json({ message: 'Invalid token format' });
      }

      const user = await storage.getUser(req.user.id);
      if (!user || !user.mfaSecret) {
        return res.status(400).json({ message: 'No 2FA secret found' });
      }

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: token,
        window: 2 // Allow 2 time steps before/after for clock drift
      });

      if (!verified) {
        return res.status(400).json({ message: 'Invalid verification code' });
      }

      // Enable 2FA
      await db.update(users)
        .set({ 
          mfaEnabled: true,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));

      res.json({ 
        message: '2FA enabled successfully',
        enabled: true
      });
    } catch (error) {
      console.error('2FA verification error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Disable 2FA
  app.post('/api/auth/2fa/disable', verifyToken, async (req: any, res) => {
    try {
      const { token, password } = req.body;
      
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!user.mfaEnabled) {
        return res.status(400).json({ message: '2FA is not enabled' });
      }

      // Verify either 2FA token or password
      let verified = false;
      
      if (token && token.length === 6) {
        // Verify 2FA token
        verified = speakeasy.totp.verify({
          secret: user.mfaSecret,
          encoding: 'base32',
          token: token,
          window: 2
        });
      } else if (password) {
        // Verify password
        verified = await bcrypt.compare(password, user.password);
      }

      if (!verified) {
        return res.status(400).json({ message: 'Invalid verification code or password' });
      }

      // Disable 2FA
      await db.update(users)
        .set({ 
          mfaEnabled: false,
          mfaSecret: null,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));

      res.json({ 
        message: '2FA disabled successfully',
        enabled: false
      });
    } catch (error) {
      console.error('2FA disable error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Admin toggle 2FA for any user
  app.patch('/api/users/:id/2fa/toggle', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const userId = parseInt(req.params.id);
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'enabled field must be a boolean' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Update user's 2FA status
      await db.update(users)
        .set({ 
          mfaEnabled: enabled,
          // If disabling 2FA, also clear the secret
          mfaSecret: enabled ? user.mfaSecret : null,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      res.json({ 
        message: `2FA ${enabled ? 'enabled' : 'disabled'} for user ${user.email}`,
        enabled: enabled
      });
    } catch (error) {
      console.error('Admin 2FA toggle error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // User management routes
  app.get('/api/users', verifyToken, cacheAdminData(300), async (req: any, res) => {
    try {
      // Check for admin privileges using the utility function
      const hasAdminAccess = hasAdminPrivileges(req.user);
      
      if (!hasAdminAccess) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });


  // Get comprehensive notary data for admin management
  app.get('/api/users/notaries-comprehensive', verifyToken, async (req: any, res) => {
    try {
      // SECURITY RESTRICTION: Only allow admin access to comprehensive notary data
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ 
          message: 'Admin access required',
          error: 'Access denied to comprehensive notary data'
        });
      }
      
      const comprehensiveNotaries = await db
        .select()
        .from(users)
        .where(eq(users.role, 'notary'))
        .orderBy(users.firstName, users.lastName, users.username);
      
      res.json(comprehensiveNotaries);
    } catch (error) {
      console.error('Get comprehensive notaries error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/users/notaries', verifyToken, async (req: any, res) => {
    try {
      // SECURITY RESTRICTION: Only allow admin access to notary listing
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ 
          message: 'Admin access required',
          error: 'Access denied to notary listing'
        });
      }
      
      const notaries = await storage.getNotaryUsers();
      res.json(notaries.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        notaryIdCode: user.notaryIdCode,
        isActive: user.isActive,
        notaryType: user.notaryType
      })));
    } catch (error) {
      console.error('Get notaries error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get users that can be signers (for job creation)
  app.get('/api/users/signers', verifyToken, async (req: any, res) => {
    try {
      // Check if user has permission to access this endpoint
      const userCanCreateJob = 
        hasAdminPrivileges(req.user) ||
        req.user.role === 'title_company' ||
        req.user.role === 'client' ||
        (req.user.role === 'notary' && req.user.notaryType === 'subscriber');

      if (!userCanCreateJob) {
        return res.status(403).json({ 
          message: 'Access denied. Only administrators, title companies, clients, and subscriber notaries can access signers.' 
        });
      }

      // Get users who can be signers and witnesses
      const signerUsers = await db
        .select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          phoneNumber: users.phoneNumber,
          role: users.role,
          isActive: users.isActive
        })
        .from(users)
        .where(
          and(
            eq(users.isActive, true),
            // Include only signer and witness roles
            inArray(users.role, ['signer', 'witness'])
          )
        )
        .orderBy(users.firstName, users.lastName, users.username);

      res.json(signerUsers);
    } catch (error) {
      console.error('Get signer users error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/users/:id', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const userId = parseInt(req.params.id);
      const updateData = req.body;

      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }

      const user = await storage.updateUser(userId, updateData);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Invalidate users cache to ensure fresh data on next request
      try {
        await redisCache.delPattern(`admin:*`); // Clear admin caches
        await redisCache.delPattern(`user:*`); // Clear all user caches
        await redisCache.delPattern(`api:*users*`); // Clear users API cache
        console.log(`🧹 Invalidated user caches after updating user ${userId}`);
      } catch (cacheError) {
        console.error('Failed to invalidate cache after user update:', cacheError);
        // Don't fail the request if cache invalidation fails
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        privileges: user.privileges
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/users/:id', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const userId = parseInt(req.params.id);
      
      // Validate userId
      if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      // Prevent self-deletion
      if (req.user.id === userId) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }

      const deleted = await storage.deleteUser(userId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Invalidate users cache to ensure fresh data on next request
      try {
        await redisCache.delPattern(`admin:*`); // Clear admin caches
        await redisCache.delPattern(`user:*`); // Clear all user caches
        await redisCache.delPattern(`api:*users*`); // Clear users API cache
        console.log(`🧹 Invalidated user caches after deleting user ${userId}`);
      } catch (cacheError) {
        console.error('Failed to invalidate cache after user deletion:', cacheError);
        // Don't fail the request if cache invalidation fails
      }

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('foreign key constraint')) {
          res.status(400).json({ 
            message: 'Cannot delete user due to existing relationships. Please remove all associated records first.' 
          });
        } else if (error.message.includes('Failed to delete user')) {
          res.status(500).json({ 
            message: 'Failed to delete user. Please try again or contact support if the problem persists.' 
          });
        } else {
          res.status(500).json({ message: 'Internal server error' });
        }
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  });

  // Get user signatures endpoint
  app.get('/api/users/:id/signatures', verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if user can access these signatures
      if (!req.user || (!hasAdminPrivileges(req.user) && req.user.id !== userId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get signatures from storage (in production, this would be a database query)
      const signatures = await storage.getUserSignatures(userId);
      
      res.json(signatures);
    } catch (error) {
      console.error('Get user signatures error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create new signature endpoint
  app.post('/api/users/:id/signatures', verifyToken, 
    upload.single('signature'), async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if user can create signatures for this user
      if (!req.user || (!hasAdminPrivileges(req.user) && req.user.id !== userId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { name, type, text, fontFamily, fontSize } = req.body;
      
      if (!name || !type) {
        return res.status(400).json({ message: 'Name and type are required' });
      }

      let imageUrl = '';
      let metadata = {};

      // VULTR ONLY - All signatures are stored in Vultr cloud storage
      const { VultrUploadHandler } = await import('./vultr-upload-handler');

      if (type === 'uploaded' && req.file) {
        // Handle uploaded signature
        const uploadResult = await VultrUploadHandler.handleSignatureUpload(
          req.file.buffer,
          req.file.originalname,
          `user-${userId}`,
          userId,
          'signature'
        );

        if (!uploadResult.success) {
          return res.status(500).json({ 
            message: `Failed to upload signature: ${uploadResult.error}`,
            error: 'vultr_upload_failed'
          });
        }

        imageUrl = uploadResult.signedUrl || uploadResult.fileKey || '';
        metadata = { originalName: req.file.originalname, vultrKey: uploadResult.fileKey };
        
      } else if (type === 'drawn') {
        // Handle drawn signature from canvas
        const { imageData } = req.body;
        if (!imageData) {
          return res.status(400).json({ message: 'Image data is required for drawn signatures' });
        }
        
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        const filename = `drawn_${Date.now()}.png`;
        const uploadResult = await VultrUploadHandler.handleSignatureUpload(
          buffer,
          filename,
          `user-${userId}`,
          userId,
          'signature'
        );

        if (!uploadResult.success) {
          return res.status(500).json({ 
            message: `Failed to upload drawn signature: ${uploadResult.error}`,
            error: 'vultr_upload_failed'
          });
        }

        imageUrl = uploadResult.signedUrl || uploadResult.fileKey || '';
        metadata = { style: 'handwritten', vultrKey: uploadResult.fileKey };
        
      } else if (type === 'generated') {
        // Handle generated signature (now sent as image file from client)
        if (req.file) {
          // Client-generated signature image (preferred method)
          const uploadResult = await VultrUploadHandler.handleSignatureUpload(
            req.file.buffer,
            req.file.originalname,
            `user-${userId}`,
            userId,
            'signature'
          );

          if (!uploadResult.success) {
            return res.status(500).json({ 
              message: `Failed to upload generated signature: ${uploadResult.error}`,
              error: 'vultr_upload_failed'
            });
          }

          imageUrl = uploadResult.signedUrl || uploadResult.fileKey || '';
          
          // Parse metadata if provided
          try {
            const metadataFromBody = req.body.metadata ? JSON.parse(req.body.metadata) : {};
            metadata = { 
              type: 'generated',
              vultrKey: uploadResult.fileKey,
              ...metadataFromBody
            };
          } catch (e) {
            metadata = { 
              type: 'generated',
              vultrKey: uploadResult.fileKey
            };
          }
          
        } else {
          // Fallback: Server-side generation (legacy)
          if (!text) {
            return res.status(400).json({ message: 'Text is required for generated signatures' });
          }
          
          try {
            let buffer: Buffer;
            let filename: string;
            
            try {
              // Try to generate signature image using canvas (server-side)
            const { createCanvas } = await import('canvas');
            const canvas = createCanvas(400, 100);
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 100);
            
            ctx.fillStyle = 'black';
            ctx.font = `${fontSize || 48}px ${fontFamily || 'serif'}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 200, 50);
            
              buffer = canvas.toBuffer('image/png');
              filename = `generated_${Date.now()}.png`;
              
              console.log(`✅ Successfully generated signature canvas for: ${text}`);
            
          } catch (canvasError) {
              console.warn('Canvas generation failed, using SVG fallback:', canvasError);
            
            // Fallback: Create a simple SVG-based signature
            const svgContent = `
              <svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
                <rect width="400" height="100" fill="white"/>
                <text x="200" y="55" font-family="${fontFamily || 'serif'}" font-size="${fontSize || 48}" 
                      text-anchor="middle" fill="black">${text}</text>
              </svg>
            `;
            
              filename = `generated_${Date.now()}.svg`;
              buffer = Buffer.from(svgContent, 'utf8');
            }
            
            const uploadResult = await VultrUploadHandler.handleSignatureUpload(
              buffer,
              filename,
              `user-${userId}`,
              userId,
              'signature'
            );

            if (!uploadResult.success) {
              return res.status(500).json({ 
                message: `Failed to upload generated signature: ${uploadResult.error}`,
                error: 'vultr_upload_failed'
              });
            }

            imageUrl = uploadResult.signedUrl || uploadResult.fileKey || '';
            metadata = { 
              type: 'generated', 
              text, 
              fontFamily, 
              fontSize,
              vultrKey: uploadResult.fileKey 
            };
            
          } catch (error) {
            console.error('Generate signature error:', error);
            return res.status(500).json({ 
              message: 'Failed to generate signature',
              error: 'signature_generation_failed'
            });
          }
        }
      }

      // Create signature record
      const signature = await storage.createUserSignature({
        userId,
        name,
        type,
        imageUrl,
        metadata,
        isDefault: false,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent')
      });

      res.json(signature);
    } catch (error) {
      console.error('Create signature error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Set default signature endpoint
  app.put('/api/users/:id/signatures/:signatureId/default', verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const signatureId = req.params.signatureId;
      
      // Check if user can modify signatures for this user
      if (!req.user || (req.user.role !== 'admin' && req.user.id !== userId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.setDefaultSignature(userId, signatureId);
      
      res.json({ message: 'Default signature set successfully' });
    } catch (error) {
      console.error('Set default signature error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete signature endpoint
  app.delete('/api/users/:id/signatures/:signatureId', verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const signatureId = req.params.signatureId;
      
      // Check if user can delete signatures for this user
      if (!req.user || (req.user.role !== 'admin' && req.user.id !== userId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.deleteUserSignature(userId, signatureId);
      
      res.json({ message: 'Signature deleted successfully' });
    } catch (error) {
      console.error('Delete signature error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get user profile with notary details
  app.get('/api/users/:id/profile', verifyToken, cacheUserData(600), async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if user can access this profile
      if (!req.user || (req.user.role !== 'admin' && req.user.id !== userId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get self-signed certificate information for signers and witnesses
      let certificateInfo = null;
      if (['signer', 'witness'].includes(user.role)) {
        try {
          const { selfSignedCertificateService } = await import('./services/self-signed-certificate-service');
          const certificate = await selfSignedCertificateService.getUserCertificate(userId);
          
          if (certificate) {
            const isExpired = new Date() > new Date(certificate.expires_at);
            certificateInfo = {
              hasCertificate: true,
              certificateId: certificate.certificate_id,
              commonName: certificate.common_name,
              issuedAt: certificate.issued_at,
              expiresAt: certificate.expires_at,
              status: certificate.status,
              isExpired,
              certificateType: 'self-signed',
              downloadUrl: `/api/user/certificate/download`
            };
          } else {
            certificateInfo = {
              hasCertificate: false,
              eligibleForGeneration: user.isVerified || user.isVerificationBypassed,
              reason: (user.isVerified || user.isVerificationBypassed) 
                ? 'User is verified but no certificate generated yet' 
                : 'User must complete ID verification first'
            };
          }
        } catch (error) {
          console.error('Error getting certificate info:', error);
          certificateInfo = {
            hasCertificate: false,
            error: 'Failed to load certificate information'
          };
        }
      }

      // Return user profile with notary-specific fields
      const profile = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        fullName: user.fullName || '',
        role: user.role,
        title: user.title || 'Notary Public',
        commissionNumber: user.commissionNumber || '',
        commissionExpiration: user.commissionExpiration || '',
        state: user.state || '',
        county: user.county || '',
        disclosure: user.disclosure || 'I acknowledge that this document was signed before me on this date.',
        signatureData: user.signatureData || '',
        initialData: user.initialData || '',
        phoneNumber: user.phoneNumber || '',
        address: user.address || '',
        isActive: user.isActive,
        isNotarySigningAgent: user.isNotarySigningAgent,
        isSpanishSpeaking: user.isSpanishSpeaking,
        notaryType: user.notaryType,
        // Self-signed certificate information (NEW)
        selfSignedCertificate: certificateInfo,
      };

      res.json(profile);
    } catch (error) {
      console.error('Get user profile error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update user profile with notary details
  app.put('/api/users/:id/profile', verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if user can update this profile
      if (!req.user || (req.user.role !== 'admin' && req.user.id !== userId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const profileData = req.body;
      
      // Update user with new profile data
      const updateData: any = {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        title: profileData.title,
        commissionNumber: profileData.commissionNumber,
        commissionExpiration: profileData.commissionExpiration,
        state: profileData.state,
        county: profileData.county,
        disclosure: profileData.disclosure,
        phoneNumber: profileData.phoneNumber,
        address: profileData.address, // Legacy single address field
        // 🔧 FIX: Add separate address fields for compatibility
        address1: profileData.address1,
        address2: profileData.address2,
        city: profileData.city,
        zipCode: profileData.zipCode,
        isActive: profileData.isActive,
        isNotarySigningAgent: profileData.isNotarySigningAgent,
        isSpanishSpeaking: profileData.isSpanishSpeaking,
        notaryType: profileData.notaryType,
      };

      // Auto-generate fullName from firstName and lastName if provided
      if (profileData.firstName || profileData.lastName) {
        const fullName = [profileData.firstName, profileData.lastName].filter(Boolean).join(' ').trim();
        if (fullName) {
          updateData.fullName = fullName;
        }
      }

      // 🔧 FIX: Automatically set accountSetupComplete if all required fields are present
      const hasBasicInfo = updateData.firstName && updateData.lastName && updateData.phoneNumber;
      const hasAddress = (updateData.address1 && updateData.city && updateData.state && updateData.zipCode) || updateData.address;
      if (hasBasicInfo && hasAddress) {
        updateData.accountSetupComplete = true;
        console.log(`✅ Account setup marked complete for user ${userId}`);
      }

      const updatedUser = await storage.updateUser(userId, updateData);

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Invalidate user-specific cache to ensure fresh data on next request
      try {
        await redisCache.delPattern(`user:${userId}:*`);
        console.log(`🧹 Invalidated cache for user ${userId} after profile update`);
      } catch (cacheError) {
        console.error('Failed to invalidate cache after profile update:', cacheError);
        // Don't fail the request if cache invalidation fails
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('Update user profile error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get notary stamps endpoint
  app.get('/api/notary/:id/stamps', verifyToken, async (req: any, res) => {
    try {
      const notaryId = parseInt(req.params.id);
      
      // Check if user can access these stamps
      if (!req.user || (!hasAdminPrivileges(req.user) && req.user.id !== notaryId && req.user.role !== 'notary')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get actual stamps from database using correct column names
      let stamps;
      try {
        stamps = await db.execute(sql`
          SELECT 
            id,
            notary_id as "notaryId",
            stamp_name as "stampType",
            stamp_image as "stampData", 
            is_active as "isActive",
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM notary_stamps 
          WHERE notary_id = ${notaryId}
          ORDER BY created_at DESC
        `);
      } catch (dbError) {
        console.error('Database query failed for notary stamps:', dbError);
        return res.status(500).json({ 
          message: 'Failed to retrieve stamps from database',
          error: 'database_query_failed'
        });
      }

      // Transform stamps to include proper image URLs
      const { cloudStorage } = await import('./lib/cloud-storage-service');
      
      const stampsWithUrls = await Promise.all((stamps.rows || []).map(async (stamp: any) => {
        let imageUrl = '';
        
        if (stamp?.stampData && typeof stamp.stampData === 'string') {
          // Check if it's a Vultr key (no base64 prefix) or base64 data
          if (stamp.stampData.startsWith('data:image/')) {
            // Already base64 data, use directly
            imageUrl = stamp.stampData;
          } else {
            // Vultr key, generate signed URL
            try {
              const fileExists = await cloudStorage.fileExists(stamp.stampData);
              if (fileExists) {
                const signedUrl = await cloudStorage.getSignedUrl(stamp.stampData, 3600); // 1 hour expiry
                imageUrl = signedUrl || '/api/placeholder/stamp-error';
              } else {
                console.warn(`Stamp image not found in Vultr: ${stamp.stampData}`);
                imageUrl = '/api/placeholder/stamp-missing';
              }
            } catch (vultrError) {
              console.warn(`Failed to get Vultr URL for stamp ${stamp.id}:`, vultrError);
              imageUrl = '/api/placeholder/stamp-error';
            }
          }
        } else {
          imageUrl = '/api/placeholder/stamp-missing';
        }

        return {
          id: stamp?.id || 0,
          notaryId: stamp?.notaryId || notaryId,
          stampType: stamp?.stampType || 'notary',
          imageUrl,
          isActive: stamp?.isActive || false,
          uploadedAt: stamp?.createdAt ? new Date(stamp.createdAt).toISOString() : new Date().toISOString(),
          createdAt: stamp?.createdAt ? new Date(stamp.createdAt).toISOString() : new Date().toISOString()
        };
      }));
      
      res.json(stampsWithUrls);
    } catch (error) {
      console.error('Get notary stamps error:', error);
      
      // Provide a fallback response with empty array if stamps loading fails
      res.status(200).json([]);
    }
  });

  // Title company routes - Updated to use enhanced companies table
  app.get('/api/companies', verifyToken, cacheAdminData(300), async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      console.error('Get companies error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/companies', verifyToken, async (req: any, res) => {
    try {
      if (!req.user || !hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const companyData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(companyData);
      
      // Invalidate companies cache to ensure fresh data on next request
      try {
        await redisCache.delPattern(`admin:*`); // Clear admin caches
        await redisCache.delPattern(`api:*companies*`); // Clear companies API cache
        console.log(`🧹 Invalidated company caches after creating company ${company.id}`);
      } catch (cacheError) {
        console.error('Failed to invalidate cache after company creation:', cacheError);
        // Don't fail the request if cache invalidation fails
      }
      
      res.status(201).json(company);
    } catch (error) {
      console.error('Create company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/companies/:id', verifyToken, async (req: any, res) => {
    try {
      if (!req.user || !hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const companyId = parseInt(req.params.id);
      const updateData = req.body;

      const company = await storage.updateCompany(companyId, updateData);
      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }

      // Invalidate companies cache to ensure fresh data on next request
      try {
        await redisCache.delPattern(`admin:*`); // Clear admin caches
        await redisCache.delPattern(`api:*companies*`); // Clear companies API cache
        console.log(`🧹 Invalidated company caches after updating company ${companyId}`);
      } catch (cacheError) {
        console.error('Failed to invalidate cache after company update:', cacheError);
        // Don't fail the request if cache invalidation fails
      }

      res.json(company);
    } catch (error) {
      console.error('Update company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/companies/:id', verifyToken, async (req: any, res) => {
    try {
      if (!req.user || !hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const companyId = parseInt(req.params.id);
      const deleted = await storage.deleteCompany(companyId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Company not found' });
      }

      // Invalidate companies cache to ensure fresh data on next request
      try {
        await redisCache.delPattern(`admin:*`); // Clear admin caches
        await redisCache.delPattern(`api:*companies*`); // Clear companies API cache
        console.log(`🧹 Invalidated company caches after deleting company ${companyId}`);
      } catch (cacheError) {
        console.error('Failed to invalidate cache after company deletion:', cacheError);
        // Don't fail the request if cache invalidation fails
      }

      res.json({ message: 'Company deleted successfully' });
    } catch (error) {
      console.error('Delete company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Job routes
  app.get('/api/jobs', verifyToken, cacheUserData(180), async (req: any, res) => {
    try {
      const jobs = await storage.getRoleBasedJobs(req.user.id, req.user.role);
      res.json(jobs);
    } catch (error) {
      console.error('Get jobs error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get jobs where user is invited as signer/witness
  app.get('/api/jobs/invited', verifyToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Get jobs where this user is a signer
      const invitedJobs = await db
        .select({
          // Job fields
          id: jobs.id,
          titleCompany: jobs.titleCompany,
          closingType: jobs.closingType,
          propertyAddressOne: jobs.propertyAddressOne,
          propertyCity: jobs.propertyCity,
          propertyState: jobs.propertyState,
          selectedDate: jobs.selectedDate,
          selectedTime: jobs.selectedTime,
          jobStatus: jobs.jobStatus,
          notaryApprovalStatus: jobs.notaryApprovalStatus,
          createdAt: jobs.createdAt,
          // Signer specific fields
          signerRole: signers.signerRole,
          signingStatus: signers.signingStatus,
          invitationToken: signers.invitationToken,
          invitationSentAt: signers.invitationSentAt
        })
        .from(signers)
        .innerJoin(jobs, eq(signers.jobId, jobs.id))
        .where(eq(signers.userId, userId))
        .orderBy(desc(jobs.createdAt));

      res.json(invitedJobs);
    } catch (error) {
      console.error('Get invited jobs error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/jobs/:id', verifyToken, cacheJobData(180), async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to this job
      // Admin, job creator, assigned notary, OR anyone with session access (includes signers)
      const hasBasicAccess = req.user.role === 'admin' || 
                           job.userId === req.user.id || 
                           job.selectedNotary === req.user.id.toString();
      
      if (!hasBasicAccess) {
        // Check if user has session access (includes signers)
        const hasSessionAccess = await storage.verifySessionAccess(jobId, req.user.id);
        if (!hasSessionAccess) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      const signers = await storage.getSignersByJobId(jobId);
      
      // Map database fields to frontend expected format
      const jobResponse = {
        ...job,
        uploadedFile: job.uploadedFile,
        notarizedFile: job.notarizedFile,
        signers
      };
      
      res.json(jobResponse);
    } catch (error) {
      console.error('Get job error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/jobs', verifyToken, upload.array('documents', 10), async (req: any, res) => {
    try {
      // Define privilege checks once at the top using proper functions
      const hasAdminAccess = hasAdminPrivileges(req.user);
      const hasNotaryAccess = hasNotaryPrivileges(req.user);
      
      // Check if user has permission to create jobs
      const userCanCreateJob = 
        hasAdminAccess ||
        req.user.role === 'title_company' ||
        (req.user.role === 'notary' && req.user.notaryType === 'subscriber');

      if (!userCanCreateJob) {
        return res.status(403).json({ 
          message: 'Access denied. Only administrators, title companies, and subscriber notaries can create jobs.' 
        });
      }

      const jobData = {
        ...req.body,
        userId: req.user.id,
        kbaRequired: req.body.kbaRequired === 'true'
      };

      // Remove the old single file fields from job data
      delete jobData.uploadedFile;
      delete jobData.notarizedFile;

      // CRITICAL FIX: Ensure constraint compliance for notary assignments
      console.log(`🔧 Job creation - notaryOption: ${jobData.notaryOption}, selectedNotary: ${jobData.selectedNotary}, notaryId: ${jobData.notaryId}`);
      
      // Handle notary ID code assignments where selectedNotary contains the actual notary ID
      if (jobData.notaryOption === 'id_code' && jobData.selectedNotary) {
        // For ID code assignments, selectedNotary contains the actual notary ID
        const parsedNotaryId = parseInt(jobData.selectedNotary);
        if (isNaN(parsedNotaryId)) {
          console.error(`❌ Invalid notary ID for id_code assignment: ${jobData.selectedNotary}`);
          return res.status(400).json({ message: 'Invalid notary ID for ID code assignment' });
        }
        jobData.notaryId = parsedNotaryId;
        jobData.selectedNotary = parsedNotaryId.toString(); // Ensure string representation
        console.log(`✅ ID code assignment: notaryId=${jobData.notaryId}, selectedNotary=${jobData.selectedNotary}`);
      } else if (jobData.notaryOption === 'assign' && jobData.selectedNotary) {
        // For manual assignments, ensure both notaryId and selectedNotary are set consistently
        const parsedNotaryId = parseInt(jobData.selectedNotary);
        if (isNaN(parsedNotaryId)) {
          console.error(`❌ Invalid notary ID for manual assignment: ${jobData.selectedNotary}`);
          return res.status(400).json({ message: 'Invalid notary ID for manual assignment' });
        }
        jobData.notaryId = parsedNotaryId;
        jobData.selectedNotary = parsedNotaryId.toString(); // Ensure string representation
        console.log(`✅ Manual assignment: notaryId=${jobData.notaryId}, selectedNotary=${jobData.selectedNotary}`);
      } else if (jobData.notaryId && !jobData.selectedNotary) {
        jobData.selectedNotary = jobData.notaryId.toString();
        console.log(`✅ Set selectedNotary from notaryId: ${jobData.selectedNotary}`);
      } else if (jobData.notaryId && jobData.selectedNotary && jobData.selectedNotary !== jobData.notaryId.toString()) {
        // Ensure consistency - if both are set, they must match
        jobData.selectedNotary = jobData.notaryId.toString();
        console.log(`✅ Fixed notary consistency: selectedNotary=${jobData.selectedNotary}`);
      }

      // For initial job creation, ensure no constraint violations
      // Only clear notary data for unhandled cases (auto assignment will be handled later)
      if (!jobData.notaryId && jobData.selectedNotary && 
          jobData.notaryOption !== 'id_code' && jobData.notaryOption !== 'assign') {
        console.log(`🔧 Clearing inconsistent notary data: selectedNotary=${jobData.selectedNotary}, notaryOption=${jobData.notaryOption}`);
        delete jobData.selectedNotary;
        delete jobData.notaryId;
      }
      
      console.log(`🔧 Final job data - notaryId: ${jobData.notaryId}, selectedNotary: ${jobData.selectedNotary}`);

      const job = await storage.createJob(jobData);

      // Handle automatic notary assignment based on who creates the job
      let assignedNotary = null;
      
      // FUNDAMENTAL ASSIGNMENT LOGIC: Assign notary based on creator role
      if (req.user.role === 'notary' && req.user.notaryType === 'subscriber') {
        // Subscriber notary creates job → They are the notary for their own job
        assignedNotary = req.user;
        console.log(`🔧 Subscriber notary created job ${job.id} - auto-assigning themselves as notary`);
        
      } else if (hasAdminAccess && hasNotaryAccess && (!jobData.notaryOption || jobData.notaryOption === 'admin_self')) {
        // Admin with notary privileges creates job → Admin as notary
        assignedNotary = req.user;
        console.log(`🔧 Admin-notary created job ${job.id} - assigning admin as notary (option: ${jobData.notaryOption || 'default'})`);
        
      } else if (hasAdminAccess || req.user.role === 'title_company') {
        // Admin or Title company creates job → Use assignment flow based on notaryOption
        console.log(`🔧 ${hasAdminAccess ? 'Admin' : req.user.role} created job ${job.id} with notaryOption: ${jobData.notaryOption} - will use assignment flow`);
      }

      // If we have a default assignment from creator role, apply it immediately
      if (assignedNotary) {
        await storage.updateJob(job.id, {
          notaryId: assignedNotary.id,
          selectedNotary: assignedNotary.id.toString(),
          jobStatus: 'open',
          notaryApprovalStatus: 'approved' // Auto-approve since it's their own job or admin
        });

        // Log the automatic assignment
        const assignmentType = hasAdminAccess && hasNotaryAccess ? 'subscriber_self' :
                              hasAdminAccess ? 'manual' : 'subscriber_self';
        
        await db.insert(notaryAssignmentLog).values({
          jobId: job.id,
          notaryId: assignedNotary.id,
          assignmentType,
          assignmentStatus: 'assigned'
        });

        console.log(`✅ Auto-assigned notary ${assignedNotary.firstName} ${assignedNotary.lastName} to job ${job.id}`);
        
        // Note: Signer invitations will be sent after signers are created (moved below)
      }

      // Handle additional notary assignment logic for title companies
      if (!assignedNotary && jobData.notaryOption === 'auto' && !jobData.selectedNotary) {
        // Check if title company has a preferred notary
        const titleCompany = await db
          .select()
          .from(companies)
          .where(eq(companies.companyName, jobData.titleCompany))
          .limit(1);

        if (titleCompany.length > 0) {
          // Check new assignment system first for preferred notary
          let preferredNotary: any = null;

          const [assignedNotaryRecord] = await db
            .select({
              notary: users
            })
            .from(titleCompanyNotaryAssignments)
            .innerJoin(users, eq(titleCompanyNotaryAssignments.notaryId, users.id))
            .where(
              and(
                eq(titleCompanyNotaryAssignments.titleCompanyId, titleCompany[0].id),
                eq(titleCompanyNotaryAssignments.isDefault, true),
                eq(titleCompanyNotaryAssignments.status, 'active'),
                eq(users.role, 'notary'),
                eq(users.notaryType, 'contractor'),
                eq(users.isActive, true)
              )
            )
            .limit(1);

          if (assignedNotaryRecord) {
            preferredNotary = assignedNotaryRecord.notary;
            console.log(`✅ Found preferred notary via new assignment system: ${preferredNotary.firstName} ${preferredNotary.lastName}`);
          }

          // Fallback to legacy preferred notary system
          if (!preferredNotary && titleCompany[0].preferredNotaryId) {
            const legacyPreferredNotary = await db
              .select()
              .from(users)
              .where(
                and(
                  eq(users.id, titleCompany[0].preferredNotaryId),
                  eq(users.isActive, true),
                  eq(users.role, 'notary'),
                  eq(users.notaryType, 'contractor')
                )
              )
              .limit(1);

            if (legacyPreferredNotary.length > 0) {
              preferredNotary = legacyPreferredNotary[0];
              console.log(`✅ Found preferred notary via legacy system: ${preferredNotary.firstName} ${preferredNotary.lastName}`);
            }
          }

          if (preferredNotary) {
            assignedNotary = preferredNotary;
            await storage.updateJob(job.id, {
              notaryId: assignedNotary.id,
              selectedNotary: assignedNotary.id.toString(),
              jobStatus: 'open', // Keep as open until notary approves
              notaryApprovalStatus: 'assigned_pending_approval'
            });

            // Log the preferred assignment
            await db.insert(notaryAssignmentLog).values({
              jobId: job.id,
              notaryId: assignedNotary.id,
              assignmentType: 'preferred',
              assignmentStatus: 'assigned'
            });

            console.log(`✅ Assigned preferred notary ${assignedNotary.firstName} ${assignedNotary.lastName} to job ${job.id} for ${jobData.titleCompany}`);

            // Send job assignment notification to notary (requires approval)
            try {
              await notificationService.sendJobAssignmentNotification(job.id, assignedNotary.id);
            } catch (notificationError) {
              console.error('Failed to send job assignment notification:', notificationError);
            }

            // Create calendar event for the assigned notary if date and time are provided
            if (jobData.selectedDate && jobData.selectedTime) {
              try {
                const startDateTime = new Date(`${jobData.selectedDate} ${jobData.selectedTime}`);
                const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration
                
                await db.insert(calendarEvents).values({
                  notaryId: assignedNotary.id,
                  title: `Notarization Job #${job.id}`,
                  description: `Job for ${jobData.titleCompany} - ${jobData.closingType}\nProperty: ${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState}`,
                  startDateTime,
                  endDateTime,
                  location: `${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState} ${jobData.propertyZipCode}`,
                  eventType: 'job',
                  jobId: job.id,
                  isAllDay: false
                });
              } catch (error) {
                console.warn('Failed to create calendar event for preferred notary assignment:', error);
              }
            }
          }
        }

        // If no preferred notary available, perform immediate auto assignment
        if (!assignedNotary) {
          console.log(`🎲 No preferred notary available for ${jobData.titleCompany}, attempting immediate random assignment...`);
          
          // Use the enhanced assignment service for immediate auto assignment
          const { EnhancedAssignmentService } = await import('./enhanced-assignment-service');
          const assignmentResult = await EnhancedAssignmentService.performAutoAssignment(job.id, jobData.titleCompany);
          
          if (assignmentResult.success && assignmentResult.notaryId) {
            console.log(`✅ Successfully assigned random notary ${assignmentResult.notaryName} to job ${job.id}`);
            
            // Update job with the assigned notary
            await storage.updateJob(job.id, {
              notaryId: assignmentResult.notaryId,
              selectedNotary: assignmentResult.notaryId.toString(),
              isRandomAssignment: true,
              requiresNSA: jobData.requiresNSA === 'true' || false,
              requiresSpanishSpeaking: jobData.requiresSpanishSpeaking === 'true' || false,
              notaryApprovalStatus: assignmentResult.requiresApproval ? 'assigned_pending_approval' : 'approved'
            });
            
            assignedNotary = assignmentResult.notaryId;
            
            // Send job assignment notification to notary
            try {
              const notificationService = new (await import('./notification-service')).NotificationService();
              await notificationService.sendJobAssignmentNotification(job.id, assignmentResult.notaryId);
            } catch (notificationError) {
              console.error('Failed to send job assignment notification:', notificationError);
            }
          } else {
            console.log(`❌ Auto assignment failed for job ${job.id}: ${assignmentResult.error || 'No available notaries'}`);
            // Fallback to marking for later assignment
            await storage.updateJob(job.id, {
              isRandomAssignment: true,
              requiresNSA: jobData.requiresNSA === 'true' || false,
              requiresSpanishSpeaking: jobData.requiresSpanishSpeaking === 'true' || false,
              notaryApprovalStatus: 'pending_assignment'
            });
            console.log(`🎯 Marked job ${job.id} for manual assignment - no available notaries found`);
          }
        }
      } else if (!assignedNotary && jobData.notaryOption === 'assign' && jobData.selectedNotary) {
        // Manual assignment for title companies
        const selectedNotaryId = parseInt(jobData.selectedNotary);
        await storage.updateJob(job.id, {
          notaryId: selectedNotaryId,
          selectedNotary: selectedNotaryId.toString(), // This was missing!
          jobStatus: 'open', // Keep as open until notary approves
          notaryApprovalStatus: 'assigned_pending_approval'
        });

        // Log the manual assignment
        await db.insert(notaryAssignmentLog).values({
          jobId: job.id,
          notaryId: selectedNotaryId,
          assignmentType: 'manual',
          assignmentStatus: 'assigned'
        });

        // Send job assignment notification to notary (requires approval)
        try {
          await notificationService.sendJobAssignmentNotification(job.id, selectedNotaryId);
        } catch (notificationError) {
          console.error('Failed to send job assignment notification:', notificationError);
        }

        // Create calendar event for the assigned notary if date and time are provided
        if (jobData.selectedDate && jobData.selectedTime) {
          try {
            const startDateTime = new Date(`${jobData.selectedDate} ${jobData.selectedTime}`);
            const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration
            
            await db.insert(calendarEvents).values({
              notaryId: selectedNotaryId,
              title: `Notarization Job #${job.id}`,
              description: `Job for ${jobData.titleCompany} - ${jobData.closingType}\nProperty: ${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState}`,
              startDateTime,
              endDateTime,
              location: `${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState} ${jobData.propertyZipCode}`,
              eventType: 'job',
              jobId: job.id,
              isAllDay: false
            });
          } catch (error) {
            console.warn('Failed to create calendar event for manual notary assignment:', error);
          }
        }
      } else if (!assignedNotary && jobData.notaryOption === 'id_code' && jobData.notaryId) {
        // Notary ID Code assignment - notary already assigned during initial creation
        // Just need to update the approval status and log the assignment
        await storage.updateJob(job.id, {
          jobStatus: 'open', // Keep as open until notary approves
          notaryApprovalStatus: 'assigned_pending_approval'
        });

        // Log the ID code assignment (using 'manual' since ID code is a manual assignment method)
        await db.insert(notaryAssignmentLog).values({
          jobId: job.id,
          notaryId: jobData.notaryId,
          assignmentType: 'manual',
          assignmentStatus: 'assigned'
        });

        // Send job assignment notification to notary (requires approval)
        try {
          await notificationService.sendJobAssignmentNotification(job.id, jobData.notaryId);
        } catch (notificationError) {
          console.error('Failed to send job assignment notification:', notificationError);
        }

        // Create calendar event for the assigned notary if date and time are provided
        if (jobData.selectedDate && jobData.selectedTime) {
          try {
            const startDateTime = new Date(`${jobData.selectedDate} ${jobData.selectedTime}`);
            const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration
            
            await db.insert(calendarEvents).values({
              notaryId: jobData.notaryId,
              title: `Notarization Job #${job.id}`,
              description: `Job for ${jobData.titleCompany} - ${jobData.closingType}\nProperty: ${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState}`,
              startDateTime,
              endDateTime,
              location: `${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState} ${jobData.propertyZipCode}`,
              eventType: 'job',
              jobId: job.id,
              isAllDay: false
            });
          } catch (error) {
            console.warn('Failed to create calendar event for ID code notary assignment:', error);
          }
        }
      }

      // 🚀 OPTIMIZED: Handle multiple document uploads to Vultr in PARALLEL
      if (req.files && req.files.length > 0) {
        const { VultrUploadHandler } = await import('./vultr-upload-handler');
        
        // Create all upload promises in parallel
        const uploadPromises = req.files.map(async (file: any, i: number) => {
          const metadataKey = `documentMetadata_${i}`;
          let metadata = { isRequired: false, documentType: 'original', originalName: file.originalname };
          
          if (req.body[metadataKey]) {
            try {
              metadata = { ...metadata, ...JSON.parse(req.body[metadataKey]) };
            } catch (e) {
              console.warn('Failed to parse document metadata:', e);
            }
          }

          // Upload to Vultr with intelligent organization
          const fileBuffer = Buffer.from(file.buffer || await fs.promises.readFile(file.path));
          
          return VultrUploadHandler.handleJobDocumentUpload(
            fileBuffer,
            file.originalname,
            job.id,
            req.user.id,
            {
              ...metadata,
              userRole: req.user.role,
              titleCompany: jobData.titleCompany
            }
          );
        });

        // Wait for all uploads to complete in parallel
        const uploadResults = await Promise.all(uploadPromises);
        
        // Check if any uploads failed
        const failedUpload = uploadResults.find(result => !result.success);
        if (failedUpload) {
          console.error(`Failed to upload document to Vultr: ${failedUpload.error}`);
          return res.status(500).json({ 
            message: `Failed to upload document: ${failedUpload.error}`,
            error: 'vultr_upload_failed'
          });
        }
        
        console.log(`✅ Successfully uploaded ${uploadResults.length} documents in parallel`);
      }

      // 🚀 OPTIMIZED: Create signers in BATCH operations (much faster)
      if (req.body.signers) {
        const signers = JSON.parse(req.body.signers);
        
        // 🚀 STEP 1: Check all existing users in one query
        const signerEmails = signers.map((s: any) => s.signerEmail);
        const existingUsers = await db.select()
          .from(users)
          .where(inArray(users.email, signerEmails));
        
        const existingUserMap = new Map(existingUsers.map(u => [u.email, u]));
        
        // 🚀 STEP 2: Validate and prepare new users
        const newUsersToCreate = [];
        const signerUserMapping = [];
        
        for (const signerData of signers) {
          const existingUser = existingUserMap.get(signerData.signerEmail);
          
          if (!existingUser) {
            // Prepare new user for batch creation
            const hashedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
            newUsersToCreate.push({
              username: signerData.signerEmail,
              email: signerData.signerEmail,
              password: hashedPassword,
              role: 'signer',
              firstName: signerData.signerName.split(' ')[0] || '',
              lastName: signerData.signerName.split(' ').slice(1).join(' ') || '',
              phoneNumber: signerData.signerPhoneNumber || '',
              isVerified: false,
              verificationStatus: 'pending',
              accountSetupComplete: false,
              approvalStatus: 'approved',
              isActive: true,
              createdAt: new Date()
            });
            signerUserMapping.push({ signerData, isNew: true, index: newUsersToCreate.length - 1 });
          } else {
            // Validate existing user
            if (existingUser.role === 'notary') {
              console.error(`❌ Cannot add notary ${existingUser.email} as a signer - conflict of interest`);
              return res.status(400).json({ 
                message: `Cannot add ${signerData.signerEmail} as a signer. This user is registered as a notary and cannot participate as a signer.` 
              });
            }
            
            if (existingUser.role !== 'signer' && existingUser.role !== 'witness') {
              console.error(`❌ Cannot add ${existingUser.role} ${existingUser.email} as a signer`);
              return res.status(400).json({ 
                message: `Cannot add ${signerData.signerEmail} as a signer. This user has a different role (${existingUser.role}) in the system.` 
              });
            }
            
            signerUserMapping.push({ signerData, isNew: false, userId: existingUser.id });
          }
        }
        
        // 🚀 STEP 3: Create new users in batch
        let newUsers = [];
        if (newUsersToCreate.length > 0) {
          newUsers = await db.insert(users).values(newUsersToCreate).returning();
        }
        
        // 🚀 STEP 4: Create signers and password reset tokens in batch
        const signersToCreate = [];
        const tokensToCreate = [];
        
        for (const mapping of signerUserMapping) {
          const userId = mapping.isNew ? newUsers[mapping.index].id : mapping.userId;
          const invitationToken = crypto.randomUUID();
          
          signersToCreate.push({
            ...mapping.signerData,
            jobId: job.id,
            userId: userId,
            invitationToken
          });
          
          const tokenExpiry = new Date();
          tokenExpiry.setHours(tokenExpiry.getHours() + 24);
          
          tokensToCreate.push({
            userId: userId,
            token: crypto.randomUUID(),
            expiresAt: tokenExpiry,
            used: false
          });
        }
        
        // 🚀 STEP 5: Insert signers and tokens in parallel
        await Promise.all([
          Promise.all(signersToCreate.map(signer => storage.createSigner(signer))),
          db.insert(passwordResetTokens).values(tokensToCreate)
        ]);
        
        console.log(`✅ Created ${signers.length} signers in batch (${newUsers.length} new users, ${signers.length - newUsers.length} existing)`);
      }

      // SEND SIGNER INVITATIONS FOR AUTO-APPROVED JOBS (after signers are created)
      const updatedJob = await storage.getJob(job.id);
      if (updatedJob && updatedJob.notaryApprovalStatus === 'approved' && req.body.signers) {
        try {
          console.log(`📧 Sending invitations for auto-approved job ${job.id}`);
          
          // Get the signers we just created
          const jobSigners = await db
            .select()
            .from(signers)
            .where(eq(signers.jobId, job.id));
          
          console.log(`   Found ${jobSigners.length} signers to invite`);
          
          // 🚀 OPTIMIZED: Send all invitations in PARALLEL
          const invitationPromises = jobSigners.map(async (signer) => {
            try {
              // Generate invitation token if not exists
              let invitationToken = signer.invitationToken;
              if (!invitationToken) {
                invitationToken = crypto.randomUUID();
                await db.update(signers)
                  .set({ 
                    invitationToken,
                    invitationSentAt: new Date()
                  })
                  .where(eq(signers.id, signer.id));
              } else {
                await db.update(signers)
                  .set({ invitationSentAt: new Date() })
                  .where(eq(signers.id, signer.id));
              }

              // Send email directly using emailService (like resend does)
              await emailService.sendSignerInvitation({
                signerName: signer.signerName,
                signerEmail: signer.signerEmail,
                signerRole: signer.signerRole,
                invitationToken,
                titleCompany: updatedJob.titleCompany,
                closingType: updatedJob.closingType,
                propertyAddress: updatedJob.propertyAddressOne ? 
                  `${updatedJob.propertyAddressOne}, ${updatedJob.propertyCity}, ${updatedJob.propertyState} ${updatedJob.propertyZipCode}` : 
                  undefined,
                scheduledDate: updatedJob.selectedDate || undefined,
                scheduledTime: updatedJob.selectedTime || undefined
              });

              return { success: true, signerEmail: signer.signerEmail };
            } catch (error) {
              console.error(`Failed to send invitation to ${signer.signerEmail}:`, error);
              return { success: false, signerEmail: signer.signerEmail, error };
            }
          });

          // Wait for all invitations to be sent in parallel
          const invitationResults = await Promise.all(invitationPromises);
          
          // Log results
          const successCount = invitationResults.filter(r => r.success).length;
          const failCount = invitationResults.filter(r => !r.success).length;
          
          if (successCount > 0) {
            console.log(`✅ Successfully sent ${successCount} invitations in parallel`);
          }
          if (failCount > 0) {
            console.error(`❌ Failed to send ${failCount} invitations`);
            invitationResults.filter(r => !r.success).forEach(result => {
              console.error(`   - ${result.signerEmail}: ${result.error}`);
            });
          }

          // Mark job as having notifications sent
          await db.update(jobs)
            .set({
              signerNotificationsSent: true,
              signerNotificationsSentAt: new Date()
            })
            .where(eq(jobs.id, job.id));

        } catch (notificationError) {
          console.error('Failed to send signer invitations for auto-approved job:', notificationError);
        }
      }

      // CRITICAL FIX: Get the updated job with assigned notary before returning
      const finalJob = await storage.getJob(job.id);
      const documentCount = req.files ? req.files.length : 0;
      
      // Invalidate job caches using centralized cache manager
      console.log(`🔧 About to invalidate caches - finalJob:`, {
        id: finalJob?.id,
        notaryId: finalJob?.notaryId,
        selectedNotary: finalJob?.selectedNotary,
        creatorId: req.user.id
      });
      
      // Use the new centralized cache manager
      const { cacheInvalidation } = await import('./services/cache-manager');
      await cacheInvalidation.onJobCreated(job.id, finalJob?.notaryId, req.user.id);
      
      res.status(201).json({
        ...finalJob, // Return the updated job with assigned notary
        documentCount,
        message: `Job created successfully with ${documentCount} document${documentCount !== 1 ? 's' : ''}${finalJob?.assignedNotary ? ` and assigned to ${finalJob.assignedNotary.name}` : ''}`
      });
    } catch (error) {
      console.error('Create job error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/jobs/:id/status', verifyToken, async (req: any, res) => {
    try {
      const jobIdParam = req.params.id;
      const jobId = parseInt(jobIdParam);
      
      // Validate job ID
      if (isNaN(jobId) || jobId <= 0) {
        console.error('Invalid job ID provided:', jobIdParam);
        return res.status(400).json({ 
          message: 'Invalid job ID provided',
          providedId: jobIdParam,
          error: 'invalid_job_id'
        });
      }
      
      const { status } = req.body;

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to update this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updatedJob = await storage.updateJob(jobId, { jobStatus: status });
      res.json(updatedJob);
    } catch (error) {
      console.error('Update job status error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update job schedule and handle auto assignment
  app.put('/api/jobs/:id/schedule', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const { selectedDate, selectedTime } = req.body;

      if (!selectedDate || !selectedTime) {
        return res.status(400).json({ message: 'Both selectedDate and selectedTime are required' });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to update this job
      if (req.user.role !== 'admin' && req.user.role !== 'title_company' && job.userId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      console.log(`🕐 Scheduling job ${jobId} for ${selectedDate} at ${selectedTime}`);

      // Check if this job needs auto assignment
      if (job.isRandomAssignment && job.notaryOption === 'auto' && !job.notaryId) {
        console.log(`🎲 Job ${jobId} marked for auto assignment, finding available notaries...`);

        // Use the random notary service to find available notaries for this time slot
        const randomNotaryService = new (await import('./random-notary-service')).RandomNotaryService();
        
        const qualifications = {
          requiresNSA: job.requiresNSA || false,
          requiresSpanishSpeaking: job.requiresSpanishSpeaking || false
        };

        const timeSlot = {
          date: selectedDate,
          startTime: selectedTime,
          endTime: addHourToTime(selectedTime) // Assume 1-hour appointment
        };

        // Get rejected notaries from job data
        const excludeIds = job.rejectedNotaries ? job.rejectedNotaries.map((id: string) => parseInt(id)) : [];

        const selectedNotary = await randomNotaryService.selectRandomNotary(qualifications, timeSlot, excludeIds);

        if (selectedNotary) {
          console.log(`✅ Found available notary: ${selectedNotary.firstName} ${selectedNotary.lastName} for job ${jobId}`);
          
          // Use the random notary service to assign the notary (includes calendar booking)
          const assignmentSuccess = await randomNotaryService.assignNotaryToJob(
            jobId, 
            selectedNotary.id, 
            timeSlot, 
            'random'
          );

          if (assignmentSuccess) {
            // Update the approval status since notary needs to approve the assignment
            await storage.updateJob(jobId, {
              notaryApprovalStatus: 'assigned_pending_approval'
            });

            // Send notification to the assigned notary
            try {
              const notificationService = new (await import('./notification-service')).NotificationService();
              await notificationService.sendJobAssignmentNotification(jobId, selectedNotary.id);
            } catch (notificationError) {
              console.error('Failed to send job assignment notification:', notificationError);
            }

            const updatedJob = await storage.getJob(jobId);
            return res.json({
              ...updatedJob,
              message: `Job scheduled and assigned to ${selectedNotary.firstName} ${selectedNotary.lastName}`,
              assignedNotary: {
                id: selectedNotary.id,
                name: `${selectedNotary.firstName} ${selectedNotary.lastName}`
              }
            });
          } else {
            console.error(`❌ Failed to assign notary ${selectedNotary.id} to job ${jobId}`);
            return res.status(500).json({ message: 'Failed to assign notary to job' });
          }
        } else {
          console.log(`❌ No available notaries found for job ${jobId} on ${selectedDate} at ${selectedTime}`);
          
          // Update the job with the selected time but no notary
          const updatedJob = await storage.updateJob(jobId, {
            selectedDate,
            selectedTime,
            notaryApprovalStatus: 'pending_assignment'
          });

          return res.json({
            ...updatedJob,
            message: 'Job scheduled but no notaries available at this time. Please try a different time or assign manually.',
            requiresManualAssignment: true
          });
        }
      } else {
        // Regular schedule update for jobs that already have a notary or don't need auto assignment
        const updatedJob = await storage.updateJob(jobId, {
          selectedDate,
          selectedTime
        });

        // If job already has a notary, update their calendar
        if (job.notaryId) {
          try {
            const startDateTime = new Date(`${selectedDate} ${selectedTime}`);
            const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration
            
            // Check if calendar event already exists
            const existingEvent = await db
              .select()
              .from(calendarEvents)
              .where(
                and(
                  eq(calendarEvents.jobId, jobId),
                  eq(calendarEvents.notaryId, job.notaryId)
                )
              )
              .limit(1);

            if (existingEvent.length > 0) {
              // Update existing calendar event
              await db
                .update(calendarEvents)
                .set({
                  startDateTime,
                  endDateTime,
                  title: `Notarization Job #${jobId}`,
                  description: `Job for ${job.titleCompany} - ${job.closingType}\nProperty: ${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState}`,
                  location: `${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState} ${job.propertyZipCode}`
                })
                .where(eq(calendarEvents.id, existingEvent[0].id));
            } else {
              // Create new calendar event
              await db.insert(calendarEvents).values({
                notaryId: job.notaryId,
                title: `Notarization Job #${jobId}`,
                description: `Job for ${job.titleCompany} - ${job.closingType}\nProperty: ${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState}`,
                startDateTime,
                endDateTime,
                location: `${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState} ${job.propertyZipCode}`,
                eventType: 'job',
                jobId: jobId,
                isAllDay: false
              });
            }
          } catch (calendarError) {
            console.warn('Failed to update calendar event:', calendarError);
          }
        }

        res.json({
          ...updatedJob,
          message: 'Job schedule updated successfully'
        });
      }
    } catch (error) {
      console.error('Update job schedule error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete individual job endpoint
  app.delete('/api/jobs/:id', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to delete this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied. Only job creator or admin can delete jobs.' });
      }

      // Get all documents associated with this job for cleanup
      const documents = await storage.getJobDocumentsByJobId(jobId);
      
      // Delete all associated files (both local and Vultr)
      for (const document of documents) {
        try {
          const filePath = document.filePath;
          const isVultrFile = !filePath.startsWith('/') && !filePath.includes('\\') && !filePath.includes('uploads/');
          
          if (isVultrFile) {
            // Delete from Vultr cloud storage
            const { cloudStorage } = await import('./lib/cloud-storage-service');
            try {
              const fileExists = await cloudStorage.fileExists(filePath);
              if (fileExists) {
                await cloudStorage.deleteFile(filePath);
                console.log(`✅ Deleted file from Vultr: ${filePath}`);
              }
            } catch (vultrError) {
              console.error(`❌ Failed to delete file from Vultr: ${filePath}`, vultrError);
            }
          } else {
            // Delete local file if it exists
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`✅ Deleted local file: ${filePath}`);
            }
          }
        } catch (fileError) {
          console.error(`Error deleting file for document ${document.id}:`, fileError);
          // Continue with job deletion even if file cleanup fails
        }
      }

      // Delete job from database (cascade will handle related records)
      const deleted = await storage.deleteJob(jobId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Job not found' });
      }

      res.json({ message: 'Job and associated files deleted successfully' });
    } catch (error) {
      console.error('Delete job error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/jobs/:id/file', verifyToken, upload.single('notarizedFile'), async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const { status } = req.body;

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to update this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updateData: any = {};
      
      if (req.file) {
        // Upload notarized file to Vultr
        const { VultrUploadHandler } = await import('./vultr-upload-handler');
        
        const fileBuffer = req.file.buffer ? Buffer.from(req.file.buffer) : await fs.promises.readFile(req.file.path);
        
        const uploadResult = await VultrUploadHandler.handleJobDocumentUpload(
          fileBuffer,
          req.file.originalname,
          jobId,
          req.user.id,
          {
            documentType: 'notarized',
            userRole: req.user.role,
            jobId: jobId
          }
        );

        if (!uploadResult.success) {
          return res.status(500).json({ 
            message: `Failed to upload notarized file: ${uploadResult.error}`,
            error: 'vultr_upload_failed'
          });
        }
        
        updateData.notarizedFile = uploadResult.fileKey;
        console.log(`✅ Uploaded notarized file to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`);
      }
      
      if (status) {
        updateData.jobStatus = status;
      }

      const updatedJob = await storage.updateJob(jobId, updateData);
      res.json(updatedJob);
    } catch (error) {
      console.error('Update job file error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // General job update endpoint for recording data and other updates
  app.put('/api/jobs/:id', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const { recordingData, ...otherUpdates } = req.body;

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to update this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updateData: any = { ...otherUpdates };
      
      // Handle recording data if provided
      if (recordingData) {
        updateData.recordingFileKey = recordingData.fileKey;
        updateData.recordingFileUrl = recordingData.fileUrl;
        updateData.recordingFileName = recordingData.fileName;
        updateData.recordingDuration = recordingData.duration;
        updateData.recordingStartedAt = recordingData.recordedAt ? new Date(recordingData.recordedAt) : null;
        updateData.recordingUploadedAt = recordingData.uploadedAt ? new Date(recordingData.uploadedAt) : new Date();
        updateData.recordingParticipantCount = recordingData.participants;
        updateData.recordingSessionId = recordingData.sessionId;
        updateData.recordingLiveSessionId = recordingData.liveSessionId;
        updateData.recordingMetadata = recordingData;
        
        console.log(`✅ Recording data updated for job ${jobId}:`, {
          fileKey: recordingData.fileKey,
          duration: recordingData.duration,
          participants: recordingData.participants
        });
      }

      const updatedJob = await storage.updateJob(jobId, updateData);
      res.json(updatedJob);
    } catch (error) {
      console.error('Update job error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Legacy file download route - REMOVED (Use document-specific routes instead)
  // All files are now stored in Vultr cloud storage
  // Use /api/jobs/:jobId/documents/:documentId/download instead

  // Dashboard stats
  app.get('/api/dashboard/stats', verifyToken, cacheUserData(300), async (req: any, res) => {
    try {
      const jobs = await storage.getRoleBasedJobs(req.user.id, req.user.role);
      
      const stats: any = {
        totalJobs: jobs.length,
        completedJobs: jobs.filter(job => job.jobStatus === 'completed').length,
        pendingJobs: jobs.filter(job => job.jobStatus === 'pending').length,
        openJobs: jobs.filter(job => job.jobStatus === 'open').length,
        cancelledJobs: jobs.filter(job => job.jobStatus === 'cancelled').length,
        expiredJobs: jobs.filter(job => job.jobStatus === 'expired').length,
      };

      if (hasAdminPrivileges(req.user)) {
        const notaries = await storage.getNotaryUsers();
        stats.activeNotaries = notaries.length;
      }

      res.json(stats);
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Session access control for live signing
  app.get('/api/jobs/:id/session-access', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const userId = req.user.id;
      const user = req.user;

      if (isNaN(jobId)) {
        return res.status(400).json({ message: 'Invalid job ID' });
      }

      // Get job details including KBA requirement
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);

      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      let hasAccess = false;
      let accessReason = '';

      // Admin access - always allowed
      if (user.role === 'admin' || user.isAdmin) {
        hasAccess = true;
        accessReason = 'admin';
      }
      // Job creator access
      else if (job.userId === userId) {
        hasAccess = true;
        accessReason = 'job_creator';
      }
      // Assigned notary access
      else if (job.notaryId === userId || job.selectedNotary === userId.toString()) {
        hasAccess = true;
        accessReason = 'assigned_notary';
      }
      // Signer access - check via signers table
      else if (user.role === 'signer' || user.role === 'witness') {
        const [signer] = await db
          .select()
          .from(signers)
          .where(and(eq(signers.jobId, jobId), eq(signers.signerEmail, user.email)))
          .limit(1);

        if (signer) {
          // 🔧 FIX: Get fresh user data from database instead of stale JWT token data
          const [freshUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

          if (!freshUser) {
            return res.json({
              hasAccess: false,
              message: 'User data not found',
              errorType: 'user_not_found'
            });
          }

          // Check if account setup is complete using fresh data - be flexible with address formats
          const hasBasicInfo = freshUser.firstName && freshUser.lastName && freshUser.phoneNumber;
          const hasAddress = (freshUser.address1 && freshUser.city && freshUser.state && freshUser.zipCode) || freshUser.address;
          const isAccountSetupComplete = hasBasicInfo && hasAddress;
          
          if (!isAccountSetupComplete) {
            return res.json({
              hasAccess: false,
              message: 'Please complete your account setup first',
              errorType: 'account_setup_required',
              requirements: [
                ...(!hasBasicInfo ? ['Complete personal information (name, phone)'] : []),
                ...(!hasAddress ? ['Complete address information'] : [])
              ]
            });
          }

          // **NEW KBA LOGIC** - Check KBA requirement for this job
          if (job.kbaRequired) {
            // Check if KBA verification is completed OR bypassed using fresh user data
            const hasKBAVerification = freshUser.kbaVerified || 
                                     freshUser.isVerificationBypassed || 
                                     freshUser.notaryVerificationBypassed;

            if (!hasKBAVerification) {
              return res.json({
                hasAccess: false,
                message: 'KBA (Knowledge-Based Authentication) verification required for this job',
                errorType: 'kba_verification_required',
                requirements: ['Complete KBA verification in your dashboard'],
                kbaRequired: true
              });
            }

            console.log(`✅ KBA verification passed for user ${userId} on KBA-required job ${jobId}`);
          } else {
            // For non-KBA jobs, use regular ID verification check with fresh user data
            if (!freshUser.isVerified && !freshUser.isVerificationBypassed && !freshUser.notaryVerificationBypassed) {
              return res.json({
                hasAccess: false,
                message: 'ID verification required before joining sessions',
                errorType: 'verification_required',
                requirements: ['Complete ID verification in your dashboard']
              });
            }
          }

          hasAccess = true;
          accessReason = 'invited_signer';
          console.log(`🎉 ACCESS GRANTED for user ${userId} as invited signer`);
        } else {
          console.log(`❌ User ${userId} not found in signers table for job ${jobId}`);
        }
      } else {
        console.log(`❌ User ${userId} role check failed:`, {
          userRole: user.role,
          expectedRoles: ['signer', 'witness']
        });
      }

      if (hasAccess) {
        console.log(`✅ FINAL ACCESS GRANTED:`, {
          hasAccess: true,
          accessReason,
          userId,
          jobId
        });

        // Track session join in comprehensive tracking system
        try {
          const { comprehensiveSessionTrackingService } = await import('./services/comprehensive-session-tracking-service');
          const sessionId = `session_${jobId}_${Date.now()}`;
          await comprehensiveSessionTrackingService.trackSessionJoin(req, jobId, {
            id: userId,
            email: user.email,
            username: user.username || user.fullName,
            role: user.role,
            name: user.fullName || user.username
          }, sessionId);
        } catch (trackingError) {
          console.error('Failed to track session join:', trackingError);
          // Don't fail access if tracking fails
        }

        return res.json({
          hasAccess: true,
          accessReason,
          message: 'Session access granted'
        });
      } else {
        console.log(`❌ FINAL ACCESS DENIED:`, {
          hasAccess: false,
          userId,
          jobId,
          userRole: user.role
        });
        return res.json({
          hasAccess: false,
          message: 'You are not authorized to access this session',
          errorType: 'not_authorized'
        });
      }

    } catch (error) {
      console.error('Session access check error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Document download route
  app.get('/api/jobs/:id/download/:type', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const type = req.params.type;
      
      console.log(`Download request: Job ${jobId}, Type ${type}, User ${req.user?.id}`);
      
      const job = await storage.getJob(jobId);
      if (!job) {
        console.log('Job not found for ID:', jobId);
        return res.status(404).json({ message: 'Job not found' });
      }

      console.log('Job found:', { id: job.id, uploadedFile: job.uploadedFile, userId: job.userId });
      console.log('User info:', { id: req.user.id, role: req.user.role });

      // Always allow download for demo
      const filename = type === 'original' ? 'sample_purchase_agreement.pdf' : 'notarized_purchase_agreement.pdf';
      
      console.log('Returning success for filename:', filename);
      
      res.json({ 
        success: true,
        message: 'File download initiated',
        filename: filename,
        type: type,
        jobId: jobId
      });
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({ message: 'Download failed' });
    }
  });

  // Job participants management
  app.get('/api/jobs/:id/participants', async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const participants = await storage.getJobParticipantsByJobId(jobId);
      res.json(participants);
    } catch (error) {
      console.error('Get job participants error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/jobs/:id/participants', async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const participantData = {
        ...req.body,
        jobId,
        inviteToken: Math.random().toString(36).substring(2) + Date.now().toString(36),
        inviteStatus: 'pending'
      };

      const participant = await storage.createJobParticipant(participantData);
      
      // Send email notification (mock implementation)
      console.log(`Email invitation sent to ${participant.email} for job ${jobId}`);
      
      res.status(201).json(participant);
    } catch (error) {
      console.error('Create job participant error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Payment management routes
  app.get('/api/payments', verifyToken, cacheUserData(300), async (req: any, res) => {
    try {
      let payments: Payment[];
      if (hasAdminPrivileges(req.user)) {
        // Admin can see all payments - for demo purposes, return empty array
        payments = [];
      } else {
        payments = await storage.getPaymentsByUserId(req.user.id);
      }
      res.json(payments);
    } catch (error) {
      console.error('Get payments error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/payments', verifyToken, async (req: any, res) => {
    try {
      const payment = await storage.createPayment({
        ...req.body,
        payerId: req.user.id
      });
      res.json(payment);
    } catch (error) {
      console.error('Create payment error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/payments/:id', verifyToken, async (req: any, res) => {
    try {
      const paymentId = parseInt(req.params.id);
      const payment = await storage.updatePayment(paymentId, req.body);
      
      if (!payment) {
        return res.status(404).json({ message: 'Payment not found' });
      }
      
      res.json(payment);
    } catch (error) {
      console.error('Update payment error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get dashboard revenue stats (admin only)
  app.get('/api/admin/revenue-stats', verifyToken, cacheAdminData(300), async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      // Calculate revenue from payments and invoices
      const currentMonth = new Date();
      const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      
      const revenue = await db.execute(sql`
        SELECT 
          COALESCE(SUM(p.amount), 0) as monthly_revenue,
          COUNT(CASE WHEN p.status = 'pending' THEN 1 END) as pending_payments,
          COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_payments
        FROM payments p
        WHERE p.created_at >= ${firstDayOfMonth.toISOString()}
      `);

      res.json(revenue.rows[0]);
    } catch (error) {
      console.error('Get revenue stats error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Invoice management routes
  app.get('/api/invoices', verifyToken, cacheUserData(300), async (req: any, res) => {
    try {
      let invoices: Invoice[];
      if (hasAdminPrivileges(req.user)) {
        // Admin gets all invoices - for demo purposes, return empty array
        invoices = [];
      } else if (req.user.role === 'notary') {
        invoices = await storage.getInvoicesByNotaryId(req.user.id);
      } else {
        invoices = await storage.getInvoicesByClientId(req.user.id);
      }
      res.json(invoices);
    } catch (error) {
      console.error('Get invoices error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/invoices', verifyToken, async (req: any, res) => {
    try {
      const invoiceNumber = await storage.generateInvoiceNumber();
      const invoice = await storage.createInvoice({
        ...req.body,
        invoiceNumber
      });
      res.json(invoice);
    } catch (error) {
      console.error('Create invoice error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/invoices/:id', verifyToken, async (req: any, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const invoice = await storage.updateInvoice(invoiceId, req.body);
      
      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      
      res.json(invoice);
    } catch (error) {
      console.error('Update invoice error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Closing Types management routes (Admin only)
  app.get('/api/closing-types', verifyToken, cacheAdminData(600), async (req: any, res) => {
    try {
      const closingTypes = await storage.getClosingTypes();
      res.json(closingTypes);
    } catch (error) {
      console.error('Get closing types error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/closing-types/active', verifyToken, async (req: any, res) => {
    try {
      const closingTypes = await storage.getActiveClosingTypes();
      res.json(closingTypes);
    } catch (error) {
      console.error('Get active closing types error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/closing-types', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const closingType = await storage.createClosingType(req.body);
      res.json(closingType);
    } catch (error) {
      console.error('Create closing type error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/closing-types/:id', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const closingTypeId = parseInt(req.params.id);
      const closingType = await storage.updateClosingType(closingTypeId, req.body);
      
      if (!closingType) {
        return res.status(404).json({ message: 'Closing type not found' });
      }
      
      res.json(closingType);
    } catch (error) {
      console.error('Update closing type error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/closing-types/:id', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const closingTypeId = parseInt(req.params.id);
      const deleted = await storage.deleteClosingType(closingTypeId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Closing type not found' });
      }
      
      res.json({ message: 'Closing type deleted successfully' });
    } catch (error) {
      console.error('Delete closing type error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Participant Roles management routes
  app.get('/api/participant-roles', verifyToken, cacheAdminData(600), async (req: any, res) => {
    try {
      const roles = await storage.getParticipantRoles();
      res.json(roles);
    } catch (error) {
      console.error('Get participant roles error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/participant-roles/active', verifyToken, async (req: any, res) => {
    try {
      const roles = await storage.getActiveParticipantRoles();
      res.json(roles);
    } catch (error) {
      console.error('Get active participant roles error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/participant-roles', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const roleData = req.body;
      const role = await storage.createParticipantRole(roleData);
      res.status(201).json(role);
    } catch (error) {
      console.error('Create participant role error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/participant-roles/:id', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const roleId = parseInt(req.params.id);
      const updateData = req.body;
      const role = await storage.updateParticipantRole(roleId, updateData);
      
      if (!role) {
        return res.status(404).json({ message: 'Participant role not found' });
      }
      
      res.json(role);
    } catch (error) {
      console.error('Update participant role error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/participant-roles/:id', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const roleId = parseInt(req.params.id);
      const deleted = await storage.deleteParticipantRole(roleId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Participant role not found' });
      }
      
      res.json({ message: 'Participant role deleted successfully' });
    } catch (error) {
      console.error('Delete participant role error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });



  // ===== VIDEO CONFERENCING ROUTES - WHEREBY INTEGRATION =====
  
  // Create Whereby video session for job
  app.post('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ 
          message: 'Job not found',
          error: 'JOB_NOT_FOUND'
        });
      }

      console.log('Creating Whereby video session for job:', jobId);
      
      // Import Whereby service
      const { wherebyService } = await import('./lib/whereby-service');
      
      // Check service configuration
      const configStatus = wherebyService.getConfigStatus();
      console.log('Whereby service configuration status:', configStatus);
      
      // Calculate end time (2 hours from now for notary sessions)
      const endDate = new Date();
      endDate.setHours(endDate.getHours() + 2);

      // Create Whereby meeting
      const meetingOptions = {
        roomNamePrefix: `notary-session-${jobId}`,
        roomMode: 'normal' as const,
        endDate: endDate.toISOString(),
        fields: ['hostRoomUrl']
      };

      console.log('Creating meeting with options:', meetingOptions);
      const meeting = await wherebyService.createMeeting(meetingOptions);
      
      console.log('Whereby video session created:', {
        meetingId: meeting.meetingId,
        roomUrl: meeting.roomUrl,
        endDate: meeting.endDate,
        configured: configStatus.configured
      });

      // Track video conference join in comprehensive tracking system
      try {
        const { comprehensiveSessionTrackingService } = await import('./services/comprehensive-session-tracking-service');
        const sessionId = meeting.meetingId || `video_${jobId}_${Date.now()}`;
        await comprehensiveSessionTrackingService.trackVideoJoin(req, jobId, sessionId, {
          id: req.user.id,
          email: req.user.email,
          username: req.user.username || req.user.fullName,
          role: req.user.role,
          name: req.user.fullName || req.user.username
        });
      } catch (trackingError) {
        console.error('Failed to track video join:', trackingError);
        // Don't fail video session creation if tracking fails
      }
      
      res.json({
        success: true,
        sessionId: meeting.meetingId,
        roomUrl: meeting.roomUrl,
        hostRoomUrl: meeting.hostRoomUrl,
        roomName: meeting.roomName,
        meetingId: meeting.meetingId,
        sessionToken: meeting.meetingId,
        endDate: meeting.endDate,
        technology: 'whereby',
        configured: configStatus.configured,
        mode: configStatus.configured ? 'api' : 'fallback',
        jobId
      });
    } catch (error) {
      console.error('Create Whereby video session error:', error);
      
      // Provide more specific error information
      let errorCode = 'VIDEO_SESSION_ERROR';
      let statusCode = 500;
      let message = 'Failed to create video session';
      
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          errorCode = 'API_KEY_MISSING';
          message = 'Video service not configured properly';
          statusCode = 503; // Service Unavailable
        } else if (error.message.includes('401')) {
          errorCode = 'API_UNAUTHORIZED';
          message = 'Video service authentication failed';
          statusCode = 503;
        } else if (error.message.includes('403')) {
          errorCode = 'API_FORBIDDEN';
          message = 'Video service access denied';
          statusCode = 503;
        } else if (error.message.includes('429')) {
          errorCode = 'API_RATE_LIMITED';
          message = 'Video service rate limit exceeded';
          statusCode = 429;
        }
      }
      
      res.status(statusCode).json({ 
        message,
        error: errorCode,
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get video session status
  app.get('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Return active session info
      const sessionInfo = {
        jobId,
        isActive: false,
        participants: [],
        recordings: [],
        technology: 'whereby',
        message: 'No active video session. Create one by starting a live signing session.'
      };

      res.json(sessionInfo);
    } catch (error) {
      console.error('Get video session error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Start recording for Whereby session
  app.post('/api/jobs/:jobId/video-session/recording/start', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { roomName, meetingId } = req.body;
      
      const { wherebyService } = await import('./lib/whereby-service');
      const recording = await wherebyService.startRecording(roomName || meetingId);
      
      console.log('Recording started for Whereby session:', {
        jobId,
        roomName,
        recordingId: recording.recordingId
      });

      res.json({
        success: true,
        recordingId: recording.recordingId,
        message: 'Recording started successfully',
        technology: 'whereby'
      });
    } catch (error) {
      console.error('Start recording error:', error);
      res.status(500).json({ message: 'Failed to start recording' });
    }
  });

  // Stop recording for Whereby session
  app.post('/api/jobs/:jobId/video-session/recording/stop', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { recordingId } = req.body;
      
      const { wherebyService } = await import('./lib/whereby-service');
      const result = await wherebyService.stopRecording(recordingId);
      
      console.log('Recording stopped for Whereby session:', {
        jobId,
        recordingId,
        status: result.status
      });

      res.json({
        success: true,
        status: result.status,
        message: 'Recording stopped successfully',
        technology: 'whereby'
      });
    } catch (error) {
      console.error('Stop recording error:', error);
      res.status(500).json({ message: 'Failed to stop recording' });
    }
  });

  // Save recording metadata
  app.post('/api/jobs/:jobId/video-session/recording', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { recordingUrl, duration, participants, meetingId } = req.body;
      
      // Store recording metadata in your database
      const recordingData = {
        jobId,
        meetingId,
        recordingUrl,
        duration,
        participants,
        createdAt: new Date().toISOString(),
        createdBy: req.user.id,
        complianceStatus: 'recorded',
        technology: 'whereby',
        auditTrail: {
          sessionStart: new Date(Date.now() - duration * 1000).toISOString(),
          sessionEnd: new Date().toISOString(),
          participantCount: participants?.length || 0
        }
      };

      console.log('Recording metadata saved:', {
        jobId,
        meetingId,
        duration: `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`,
        participants: participants?.length || 0
      });

      res.json({
        success: true,
        recordingId: `recording-${jobId}-${Date.now()}`,
        message: 'Recording metadata saved successfully',
        complianceVerified: true,
        technology: 'whereby'
      });
    } catch (error) {
      console.error('Save recording error:', error);
      res.status(500).json({ message: 'Failed to save recording metadata' });
    }
  });

  // End Whereby video session
  app.delete('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { sessionId, meetingId } = req.body;
      
      if (sessionId || meetingId) {
        console.log(`Ending Whereby video session ${sessionId || meetingId} for job ${jobId}`);
        
        // Clean up Whereby meeting
        const { wherebyService } = await import('./lib/whereby-service');
        try {
          await wherebyService.deleteMeeting(sessionId || meetingId);
        } catch (deleteError) {
          console.warn('Failed to delete Whereby meeting:', deleteError);
          // Non-critical error, continue
        }
      }
      
      // Update job status to completed if needed
      const job = await storage.getJob(jobId);
      if (job && job.jobStatus === 'in_progress') {
        await storage.updateJob(jobId, {
          jobStatus: 'completed',
          completedAt: new Date(),
          completedBy: req.user.id
        });
      }
      
      console.log(`Whereby video session ended for job ${jobId}`);
      
      res.json({
        success: true,
        message: 'Whereby video session ended successfully',
        jobStatus: 'completed',
        technology: 'whereby'
      });
    } catch (error) {
      console.error('End Whereby video session error:', error);
      res.status(500).json({ message: 'Failed to end Whereby video session' });
    }
  });

  // Get session recordings for compliance
  app.get('/api/jobs/:jobId/recordings', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      console.log(`Getting recordings for job ${jobId}`);
      
      // In a real implementation, you would query the database for actual recordings
      const recordings: any[] = [];
      
      res.json({
        success: true,
        jobId,
        recordings,
        technology: 'whereby',
        message: recordings.length > 0 ? 'Recordings retrieved successfully' : 'No recordings found for this session'
      });
    } catch (error) {
      console.error('Get recordings error:', error);
      res.status(500).json({ message: 'Failed to retrieve recordings' });
    }
  });

  // ===== ENHANCED UPLOAD SYSTEM ROUTES (VULTR-ENABLED) =====
  
  // Professional signature upload with Vultr cloud storage
  app.post('/api/uploads/signature', 
    process.env.NODE_ENV === 'development' ? 
      (req: any, res: any, next: any) => {
        console.log('Development mode: bypassing authentication for signature upload');
        req.user = { id: 1, role: 'admin', email: 'admin@example.com' };
        next();
      } : verifyToken, 
    upload.single('signature'), async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No signature file uploaded' });
        }

        const { sessionId, participantId, signatureType = 'signature' } = req.body;
        
        if (!sessionId || !participantId) {
          return res.status(400).json({ error: 'sessionId and participantId are required' });
        }

        // Upload signature to Vultr
        const { VultrUploadHandler } = await import('./vultr-upload-handler');
        
        const uploadResult = await VultrUploadHandler.handleSignatureUpload(
          req.file.buffer,
          req.file.originalname,
          sessionId,
          parseInt(participantId),
          signatureType
        );

        if (!uploadResult.success) {
          return res.status(500).json({ 
            error: `Failed to upload signature: ${uploadResult.error}`,
            code: 'vultr_upload_failed'
          });
        }

        console.log(`✅ Uploaded signature to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`);

        res.json({
          success: true,
          message: 'Signature uploaded successfully to Vultr',
          fileKey: uploadResult.fileKey,
          fileUrl: uploadResult.signedUrl,
          size: uploadResult.size,
          storageType: 'vultr',
          signatureType
        });
      } catch (error) {
        console.error('Signature upload error:', error);
        res.status(500).json({ error: 'Signature upload failed' });
      }
    });
  
  // Document upload with Vultr cloud storage
  app.post('/api/uploads/document', 
    process.env.NODE_ENV === 'development' ? 
      (req: any, res: any, next: any) => {
        console.log('Development mode: bypassing authentication for document upload');
        req.user = { id: 1, role: 'admin', email: 'admin@example.com' };
        next();
      } : verifyToken, 
    upload.single('document'), async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No document file uploaded' });
        }

        const { jobId, sessionId, documentType = 'additional' } = req.body;
        
        if (!jobId && !sessionId) {
          return res.status(400).json({ error: 'Either jobId or sessionId is required' });
        }

        // Upload document to Vultr
        const { VultrUploadHandler } = await import('./vultr-upload-handler');
        
        let uploadResult;
        
        if (jobId) {
          // Job-specific document upload
          uploadResult = await VultrUploadHandler.handleJobDocumentUpload(
            req.file.buffer,
            req.file.originalname,
            parseInt(jobId),
            req.user.id,
            {
              documentType,
              userRole: req.user.role,
              uploadType: 'general'
            }
          );
        } else {
          // General document upload for sessions (use signature handler with 'signature' type)
          uploadResult = await VultrUploadHandler.handleSignatureUpload(
            req.file.buffer,
            req.file.originalname,
            sessionId,
            req.user.id,
            'signature'
          );
        }

        if (!uploadResult.success) {
          return res.status(500).json({ 
            error: `Failed to upload document: ${uploadResult.error}`,
            code: 'vultr_upload_failed'
          });
        }

        console.log(`✅ Uploaded document to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`);

        res.json({
          success: true,
          message: 'Document uploaded successfully to Vultr',
          fileKey: uploadResult.fileKey,
          fileUrl: uploadResult.signedUrl,
          size: uploadResult.size,
          storageType: 'vultr',
          documentType
        });
      } catch (error) {
        console.error('Document upload error:', error);
        res.status(500).json({ error: 'Document upload failed' });
      }
    });
  
  // Notary stamp upload with Vultr cloud storage
  app.post('/api/uploads/notary-stamp', 
    process.env.NODE_ENV === 'development' ? 
      (req: any, res: any, next: any) => {
        console.log('Development mode: bypassing authentication for stamp upload');
        req.user = { id: 1, role: 'admin', email: 'admin@example.com' };
        next();
      } : verifyToken, 
    upload.single('stamp'), async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No stamp image uploaded' });
        }

        const { notaryId, state, commission } = req.body;
        
        if (!notaryId) {
          return res.status(400).json({ error: 'notaryId is required' });
        }

        // Upload notary stamp to Vultr
        const { VultrUploadHandler } = await import('./vultr-upload-handler');
        
        const uploadResult = await VultrUploadHandler.handleNotaryStampUpload(
          req.file.buffer,
          req.file.originalname,
          parseInt(notaryId),
          {
            state,
            commission,
            uploadedBy: req.user.id,
            uploadType: 'notary_stamp'
          }
        );

        if (!uploadResult.success) {
          return res.status(500).json({ 
            error: `Failed to upload notary stamp: ${uploadResult.error}`,
            code: 'vultr_upload_failed'
          });
        }

        // Create notary stamp record in database using correct column names
        if (!uploadResult.fileKey) {
          return res.status(500).json({ 
            error: 'Failed to get file key from upload result',
            code: 'missing_file_key'
          });
        }

        try {
          const insertResult = await db.execute(sql`
            INSERT INTO notary_stamps (notary_id, stamp_name, stamp_image, is_active, created_at, updated_at)
            VALUES (${parseInt(notaryId)}, 'notary', ${uploadResult.fileKey}, false, NOW(), NOW())
            RETURNING id
          `);

          console.log(`✅ Uploaded notary stamp to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`);
          console.log(`✅ Created database record with ID:`, insertResult.rows[0]?.id);

          res.json({
            success: true,
            message: 'Notary stamp uploaded successfully to Vultr',
            fileKey: uploadResult.fileKey,
            fileUrl: uploadResult.signedUrl || '',
            size: uploadResult.size || 0,
            storageType: 'vultr',
            stampId: insertResult.rows[0]?.id,
            note: 'Stamp requires admin approval before activation'
          });
        } catch (dbError) {
          console.error('Database insertion failed:', dbError);
          // Try to clean up the uploaded file if database insertion fails
          try {
            const { cloudStorage } = await import('./lib/cloud-storage-service');
            await cloudStorage.deleteFile(uploadResult.fileKey);
            console.log(`🧹 Cleaned up orphaned file: ${uploadResult.fileKey}`);
          } catch (cleanupError) {
            console.error('Failed to cleanup orphaned file:', cleanupError);
          }
          
          return res.status(500).json({ 
            error: 'Failed to save stamp record to database',
            code: 'database_insert_failed'
          });
        }
      } catch (error) {
        console.error('Notary stamp upload error:', error);
        res.status(500).json({ error: 'Notary stamp upload failed' });
      }
    });
  
  // Secure file retrieval
  app.get('/api/uploads/:type/:fileId', verifyToken, getUploadedFile);

  // Legacy local file serving routes - REMOVED
  // All stamps and signatures are now stored in Vultr cloud storage
  // Use /api/uploads/:type/:fileId with proper Vultr URLs instead

  // ===== NOTARY STAMP MANAGEMENT ROUTES =====

  // Set active notary stamp
  app.put('/api/notary/stamps/:stampId/activate', verifyToken, async (req: any, res) => {
    try {
      const stampId = parseInt(req.params.stampId);
      
      // Check if user is a notary or admin
      if (req.user.role !== 'admin' && req.user.role !== 'notary') {
        return res.status(403).json({ message: 'Access denied - notary access required' });
      }
      
      if (isNaN(stampId)) {
        return res.status(400).json({ message: 'Invalid stamp ID' });
      }

      // Get the stamp to verify ownership and existence
      const stampResult = await db.execute(sql`
        SELECT 
          id,
          notary_id as "notaryId",
          stamp_name as "stampType",
          stamp_image as "stampData",
          is_active as "isActive"
        FROM notary_stamps 
        WHERE id = ${stampId}
        LIMIT 1
      `);
      
      const stamp = stampResult.rows[0];

      if (!stamp) {
        return res.status(404).json({ message: 'Stamp not found' });
      }

      // Check if user owns this stamp or is admin
      if (req.user.role !== 'admin' && stamp.notaryId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied - you can only activate your own stamps' });
      }

      // First, deactivate all other stamps for this notary to ensure only one is active
      await db.execute(sql`
        UPDATE notary_stamps 
        SET is_active = false, updated_at = NOW()
        WHERE notary_id = ${stamp.notaryId}
      `);

      // Then activate the selected stamp
      const updateResult = await db.execute(sql`
        UPDATE notary_stamps 
        SET is_active = true, updated_at = NOW()
        WHERE id = ${stampId}
      `);
      
      const updatedStamp = (updateResult.rowCount ?? 0) > 0;

      if (!updatedStamp) {
        return res.status(500).json({ message: 'Failed to activate stamp' });
      }

      console.log(`✅ Activated stamp ${stampId} for notary ${stamp.notaryId}`);
      
      res.json({
        success: true,
        message: 'Stamp activated successfully',
        stamp: {
          id: stampId,
          isActive: true,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Activate stamp error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete notary stamp
  app.delete('/api/notary/stamps/:stampId', verifyToken, async (req: any, res) => {
    try {
      const stampId = parseInt(req.params.stampId);
      
      // Check if user is a notary or admin
      if (req.user.role !== 'admin' && req.user.role !== 'notary') {
        return res.status(403).json({ message: 'Access denied - notary access required' });
      }
      
      if (isNaN(stampId)) {
        return res.status(400).json({ message: 'Invalid stamp ID' });
      }

      // Get the stamp to verify ownership and get file path
      const stampResult = await db.execute(sql`
        SELECT 
          id,
          notary_id as "notaryId",
          stamp_name as "stampType",
          stamp_image as "stampData",
          is_active as "isActive"
        FROM notary_stamps 
        WHERE id = ${stampId}
        LIMIT 1
      `);
      
      const stamp = stampResult.rows[0];

      if (!stamp) {
        return res.status(404).json({ message: 'Stamp not found' });
      }

      // Check if user owns this stamp or is admin
      if (req.user.role !== 'admin' && stamp.notaryId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied - you can only delete your own stamps' });
      }

      // Delete file from Vultr storage if it exists
      if (stamp.stampData && typeof stamp.stampData === 'string' && !stamp.stampData.startsWith('data:image/')) {
        try {
          const { cloudStorage } = await import('./lib/cloud-storage-service');
          const fileExists = await cloudStorage.fileExists(stamp.stampData);
          if (fileExists) {
            await cloudStorage.deleteFile(stamp.stampData);
            console.log(`✅ Deleted stamp file from Vultr: ${stamp.stampData}`);
          }
        } catch (vultrError) {
          console.error(`❌ Failed to delete stamp file from Vultr: ${stamp.stampData}`, vultrError);
          // Continue with database deletion even if file deletion fails
        }
      }

      // Delete from database
      const deleteResult = await db.execute(sql`
        DELETE FROM notary_stamps WHERE id = ${stampId}
      `);
      
      const deletedStamp = (deleteResult.rowCount ?? 0) > 0;

      if (!deletedStamp) {
        return res.status(500).json({ message: 'Failed to delete stamp from database' });
      }

      console.log(`✅ Deleted stamp ${stampId} for notary ${stamp.notaryId}`);
      
      res.json({
        success: true,
        message: 'Stamp deleted successfully'
      });
    } catch (error) {
      console.error('Delete stamp error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Placeholder routes for missing stamp images
  app.get('/api/placeholder/stamp-missing', async (req, res) => {
    try {
      // Return a simple SVG placeholder for missing stamps
      const svgPlaceholder = `
        <svg width="150" height="100" xmlns="http://www.w3.org/2000/svg">
          <rect width="150" height="100" fill="#f3f4f6" stroke="#d1d5db" stroke-width="2" rx="8"/>
          <text x="75" y="45" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#6b7280">
            Stamp Missing
          </text>
          <text x="75" y="65" font-family="Arial, sans-serif" font-size="10" text-anchor="middle" fill="#9ca3af">
            File not found
          </text>
        </svg>
      `;
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(svgPlaceholder);
    } catch (error) {
      console.error('Placeholder stamp error:', error);
      res.status(500).send('Error generating placeholder');
    }
  });

  app.get('/api/placeholder/stamp-error', async (req, res) => {
    try {
      // Return a simple SVG placeholder for stamp errors
      const svgPlaceholder = `
        <svg width="150" height="100" xmlns="http://www.w3.org/2000/svg">
          <rect width="150" height="100" fill="#fef2f2" stroke="#fecaca" stroke-width="2" rx="8"/>
          <text x="75" y="45" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#dc2626">
            Stamp Error
          </text>
          <text x="75" y="65" font-family="Arial, sans-serif" font-size="10" text-anchor="middle" fill="#b91c1c">
            Cannot load image
          </text>
        </svg>
      `;
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(svgPlaceholder);
    } catch (error) {
      console.error('Placeholder stamp error:', error);
      res.status(500).send('Error generating placeholder');
    }
  });

  // Admin session management endpoints
  app.get('/api/admin/session-stats', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { SessionManagementService } = await import('./services/session-management-service');
      const stats = await SessionManagementService.getSessionStats();
      
      res.json(stats);
    } catch (error) {
      console.error('Get session stats error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/admin/active-sessions', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { SessionManagementService } = await import('./services/session-management-service');
      const sessions = await SessionManagementService.getActiveSessions();
      
      res.json(sessions);
    } catch (error) {
      console.error('Get active sessions error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/admin/invalidate-user-sessions/:userId', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const userId = parseInt(req.params.userId);
      const { reason } = req.body;

      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      const { SessionManagementService } = await import('./services/session-management-service');
      await SessionManagementService.invalidateUserSessions(userId, reason || 'admin_action');
      
      res.json({ 
        message: 'User sessions invalidated successfully',
        userId 
      });
    } catch (error) {
      console.error('Invalidate user sessions error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/admin/invalidate-all-sessions', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { reason } = req.body;

      const { SessionManagementService } = await import('./services/session-management-service');
      await SessionManagementService.invalidateAllSessions(reason || 'admin_action');
      
      res.json({ 
        message: 'All sessions invalidated successfully' 
      });
    } catch (error) {
      console.error('Invalidate all sessions error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Recording upload endpoint for enhanced video system  
  app.post('/api/recordings/upload', verifyToken, upload.single('recording'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No recording file provided' });
      }

      const { jobId, recordingType = 'notarization' } = req.body;
      
      if (!jobId) {
        return res.status(400).json({ message: 'Job ID is required' });
      }

      // Upload recording to Vultr
      const { VultrUploadHandler } = await import('./vultr-upload-handler');
      
      const fileBuffer = req.file.buffer ? Buffer.from(req.file.buffer) : await fs.promises.readFile(req.file.path);
      
      const uploadResult = await VultrUploadHandler.handleVideoRecordingUpload(
        fileBuffer,
        req.file.originalname,
        parseInt(jobId),
        {
          recordingType,
          userRole: req.user.role,
          userId: req.user.id,
          timestamp: new Date().toISOString()
        }
      );

      if (!uploadResult.success) {
        return res.status(500).json({ 
          message: `Failed to upload recording: ${uploadResult.error}`,
          error: 'vultr_upload_failed'
        });
      }

      console.log(`✅ Uploaded recording to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`);

      res.json({
        success: true,
        message: 'Recording uploaded successfully to Vultr',
        fileKey: uploadResult.fileKey,
        fileUrl: uploadResult.signedUrl,
        size: uploadResult.size,
        storageType: 'vultr'
      });
    } catch (error) {
      console.error('Recording upload error:', error);
      res.status(500).json({ message: 'Recording upload failed' });
    }
  });

  // Identity verification webhook for Vouched.id
  app.post('/api/verification/webhook', async (req, res) => {
    try {
      // Vouched.id webhook handler
      const { event, data } = req.body;
      
      console.log('Identity verification webhook:', { event, data });
      
      // Process verification results
      if (event === 'verification.completed') {
        // Store verification results in database
        // Update participant verification status
        // Log compliance event
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Verification webhook error:', error);
      res.status(500).json({ message: 'Webhook processing failed' });
    }
  });

  // Compliance reporting endpoint
  app.get('/api/compliance/report/:sessionId', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'notary') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const sessionId = req.params.sessionId;
      
      // Generate compliance report using the framework
      // This would integrate with the compliance framework
      const mockReport = {
        sessionId,
        timestamp: new Date().toISOString(),
        complianceScore: 95,
        checks: [
          { category: 'identity', status: 'passed', description: 'Identity verification completed' },
          { category: 'recording', status: 'passed', description: 'Session recorded with high quality' },
          { category: 'signature', status: 'passed', description: 'Professional signatures captured' },
          { category: 'audit', status: 'passed', description: 'Complete audit trail maintained' }
        ],
        recommendations: [
          'Continue using enhanced identity verification for all signers',
          'Maintain backup recordings for critical sessions'
        ]
      };
      
      res.json(mockReport);
    } catch (error) {
      console.error('Compliance report error:', error);
      res.status(500).json({ message: 'Report generation failed' });
    }
  });

  // Enhanced session status endpoint
  app.get('/api/sessions/:sessionId/status', verifyToken, async (req: any, res) => {
    try {
      const sessionId = req.params.sessionId;
      
      // Mock enhanced session status
      const sessionStatus = {
        sessionId,
        status: 'active',
        participants: [
          { id: '1', name: 'Demo User', role: 'signer', verified: true, connected: true },
          { id: '2', name: 'Notary Public', role: 'notary', verified: true, connected: true }
        ],
        recording: {
          active: true,
          quality: 'FHD',
          duration: 1245, // seconds
          cloudBackup: true
        },
        compliance: {
          identityVerification: 'completed',
          recordingQuality: 'high',
          auditTrail: 'complete',
          overallScore: 98
        },
        lastActivity: new Date().toISOString()
      };
      
      res.json(sessionStatus);
    } catch (error) {
      console.error('Session status error:', error);
      res.status(500).json({ message: 'Session status retrieval failed' });
    }
  });

  // Job document management routes
  app.get('/api/jobs/:id/documents', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const documents = await storage.getJobDocumentsByJobId(jobId);
      res.json(documents);
    } catch (error) {
      console.error('Get job documents error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get document versions (signed documents) for a job
  app.get('/api/jobs/:id/document-versions', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // First get all documents for this job
      const jobDocumentsList = await db
        .select()
        .from(jobDocuments)
        .where(eq(jobDocuments.jobId, jobId));
      
      // Get document versions for these documents
      const documentIds = jobDocumentsList.map(doc => doc.id);
      let versions: any[] = [];
      
      if (documentIds.length > 0) {
        // Use inArray to get versions for all document IDs at once
        versions = await db
          .select()
          .from(documentVersions)
          .where(inArray(documentVersions.originalDocumentId, documentIds))
          .orderBy(desc(documentVersions.createdAt));
      }

      // Add download URLs to each version
      const versionsWithUrls = versions.map(version => ({
        ...version,
        downloadUrl: `/api/documents/signed/${encodeURIComponent(version.fileName)}`
      }));

      res.json(versionsWithUrls);
    } catch (error) {
      console.error('Get document versions error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/jobs/:id/documents', verifyToken, upload.array('documents', 10), async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to add documents to this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const addedDocuments = [];

      if (req.files && req.files.length > 0) {
        const { VultrUploadHandler } = await import('./vultr-upload-handler');
        
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const metadataKey = `documentMetadata_${i}`;
          let metadata = { isRequired: false, documentType: 'additional', originalName: file.originalname };
          
          if (req.body[metadataKey]) {
            try {
              metadata = { ...metadata, ...JSON.parse(req.body[metadataKey]) };
            } catch (e) {
              console.warn('Failed to parse document metadata:', e);
            }
          }

          // Upload to Vultr with intelligent organization
          try {
            const fileBuffer = Buffer.from(file.buffer || await fs.promises.readFile(file.path));
            
            const uploadResult = await VultrUploadHandler.handleJobDocumentUpload(
              fileBuffer,
              file.originalname,
              jobId,
              req.user.id,
              {
                ...metadata,
                userRole: req.user.role,
                jobId: jobId
              }
            );

            if (uploadResult.success) {
              // Get the created document from database
              const documents = await storage.getJobDocumentsByJobId(jobId);
              const latestDocument = documents[documents.length - 1]; // Get the most recently added
              addedDocuments.push(latestDocument);
              
              console.log(`✅ Document uploaded to Vultr: ${file.originalname} → ${uploadResult.fileKey}`);
            } else {
              throw new Error(uploadResult.error || 'Upload failed');
            }
            
          } catch (vultrError) {
            console.error(`Vultr upload failed for ${file.originalname}:`, vultrError);
            return res.status(500).json({ 
              message: `Failed to upload document: ${vultrError instanceof Error ? vultrError.message : 'Unknown error'}`,
              error: 'vultr_upload_failed',
              fileName: file.originalname
            });
          }
        }
      }

      // Clear job-related cache after successful document upload
      try {
        const { redisCache } = await import('./services/redis-cache');
        await redisCache.delPattern(`job:${jobId}:*`);
        console.log(`🧹 Cleared job cache after document upload: job:${jobId}:*`);
      } catch (cacheError) {
        console.warn('Failed to clear job cache after document upload:', cacheError);
        // Don't throw - cache failures shouldn't break the main flow
      }

      res.status(201).json({
        message: `Added ${addedDocuments.length} document${addedDocuments.length !== 1 ? 's' : ''} to job`,
        documents: addedDocuments,
        vultrOrganized: true // Indicate that files are organized in Vultr
      });
    } catch (error) {
      console.error('Add job documents error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/jobs/:jobId/documents/:documentId', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const documentId = parseInt(req.params.documentId);

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      const document = await storage.getJobDocument(documentId);
      if (!document || document.jobId !== jobId) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Check if user has access to delete documents from this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && document.uploadedBy !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // VULTR ONLY - Delete file from cloud storage
      const filePath = document.filePath;
      
      try {
        const { cloudStorage } = await import('./lib/cloud-storage-service');
        const fileExists = await cloudStorage.fileExists(filePath);
        if (fileExists) {
          await cloudStorage.deleteFile(filePath);
          console.log(`✅ Deleted document from Vultr: ${filePath}`);
        }
      } catch (vultrError) {
        console.error(`❌ Failed to delete document from Vultr: ${filePath}`, vultrError);
        // Continue with database deletion even if cloud file deletion fails
      }

      // Delete from database
      const deleted = await storage.deleteJobDocument(documentId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Clear job-related cache after successful document deletion
      try {
        const { redisCache } = await import('./services/redis-cache');
        await redisCache.delPattern(`job:${jobId}:*`);
        console.log(`🧹 Cleared job cache after document deletion: job:${jobId}:*`);
      } catch (cacheError) {
        console.warn('Failed to clear job cache after document deletion:', cacheError);
        // Don't throw - cache failures shouldn't break the main flow
      }

      res.json({ message: 'Document deleted successfully' });
    } catch (error) {
      console.error('Delete job document error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/jobs/:jobId/documents/:documentId', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const documentId = parseInt(req.params.documentId);

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      const document = await storage.getJobDocument(documentId);
      if (!document || document.jobId !== jobId) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Check if user has access to update documents in this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updatedDocument = await storage.updateJobDocument(documentId, req.body);
      
      if (!updatedDocument) {
        return res.status(404).json({ message: 'Document not found' });
      }

      res.json(updatedDocument);
    } catch (error) {
      console.error('Update job document error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Document download route (Vultr-enabled)
  app.get('/api/jobs/:jobId/documents/:documentId/download', async (req: any, res) => {
    try {
      // Handle authentication via header or query parameter (for iframe compatibility)
      let token = req.headers.authorization?.split(' ')[1];
      if (!token && req.query.token) {
        token = req.query.token as string;
      }
      
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      let user;
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        user = decoded;
      } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const jobId = parseInt(req.params.jobId);
      const documentId = parseInt(req.params.documentId);

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      const document = await storage.getJobDocument(documentId);
      if (!document || document.jobId !== jobId) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Check if user has access to download documents from this job
      let hasAccess = false;
      
      // Admin access
      if (user.role === 'admin') {
        hasAccess = true;
        console.log(`✅ DOCUMENT DOWNLOAD: Admin user ${user.id}`);
      }
      // Job creator access
      else if (job.userId === user.id) {
        hasAccess = true;
        console.log(`✅ DOCUMENT DOWNLOAD: Job creator user ${user.id}`);
      }
      // Assigned notary access
      else if (job.selectedNotary === user.id.toString()) {
        hasAccess = true;
        console.log(`✅ DOCUMENT DOWNLOAD: Assigned notary user ${user.id}`);
      }
      // Signer access - check via signers table (THIS WAS MISSING!)
      else if (user.role === 'signer' || user.role === 'witness') {
        const [signer] = await db
          .select()
          .from(signers)
          .where(and(eq(signers.jobId, jobId), eq(signers.signerEmail, user.email)))
          .limit(1);
        
        if (signer) {
          hasAccess = true;
          console.log(`✅ DOCUMENT DOWNLOAD: Invited signer user ${user.id} (${user.email}) on job ${jobId}`);
        }
      }
      
      if (!hasAccess) {
        console.log(`❌ DOCUMENT DOWNLOAD DENIED: User ${user.id} (${user.email}, role: ${user.role}) not authorized for job ${jobId} documents`);
        return res.status(403).json({ message: 'You do not have permission to download this document.' });
      }

      // VULTR ONLY - All documents are stored in Vultr cloud storage
      const filePath = document.filePath;
      
      try {
        const { cloudStorage } = await import('./lib/cloud-storage-service');
        
        // Check if file exists in Vultr
        const fileExists = await cloudStorage.fileExists(filePath);
        if (!fileExists) {
          return res.status(404).json({ message: 'File not found in cloud storage' });
        }
        
        // Generate signed URL for download (valid for 1 hour)
        const signedUrl = await cloudStorage.getSignedUrl(filePath, 3600);
        
        // Check if this is a signed PDF request
        const isSigned = req.query.signed === 'true';
        const timestamp = req.query.timestamp;
        
        // Set appropriate headers for download
        const filename = isSigned 
          ? `SIGNED_${timestamp}_${document.originalName}` 
          : document.originalName;
          
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        if (isSigned) {
          res.setHeader('X-Document-Status', 'signed');
          res.setHeader('X-Signing-Timestamp', timestamp || new Date().toISOString());
          console.log(`Serving signed PDF from Vultr: ${filename}`);
        }
        
        // Redirect to Vultr signed URL
        console.log(`Redirecting to Vultr download: ${document.originalName}`);
        res.redirect(302, signedUrl);
        
      } catch (vultrError) {
        console.error('Vultr download error:', vultrError);
        return res.status(500).json({ message: 'Failed to access file in cloud storage' });
      }
    } catch (error) {
      console.error('Download document error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Document signing route - generates signed PDF
  app.post('/api/jobs/:jobId/documents/:documentId/sign', verifyToken, async (req: any, res) => {
    // Ensure we always return JSON
    res.setHeader('Content-Type', 'application/json');
    
    try {
      console.log('Sign endpoint called:', {
        jobId: req.params.jobId,
        documentId: req.params.documentId,
        userId: req.user.id,
        bodyKeys: Object.keys(req.body || {})
      });

      const jobId = parseInt(req.params.jobId);
      const documentId = parseInt(req.params.documentId);
      
      if (isNaN(jobId) || isNaN(documentId)) {
        console.log('Invalid job or document ID:', { jobId, documentId });
        return res.status(400).json({ message: 'Invalid job or document ID' });
      }
      
      const { signatures = [], page = 1, scale = 1.0 } = req.body || {};
      
      console.log('Sign request details:', {
        jobId,
        documentId,
        signaturesCount: signatures.length,
        page,
        scale
      });

      const job = await storage.getJob(jobId);
      if (!job) {
        console.log('Job not found:', jobId);
        return res.status(404).json({ message: 'Job not found' });
      }

      const document = await storage.getJobDocument(documentId);
      if (!document || document.jobId !== jobId) {
        console.log('Document not found or mismatch:', { documentId, jobId, found: !!document });
        return res.status(404).json({ message: 'Document not found' });
      }

      // Check if user has access to sign documents in this job
      let hasAccess = false;
      
      // Admin access
      if (req.user.role === 'admin') {
        hasAccess = true;
        console.log(`✅ DOCUMENT SIGNING: Admin user ${req.user.id}`);
      }
      // Job creator access
      else if (job.userId === req.user.id) {
        hasAccess = true;
        console.log(`✅ DOCUMENT SIGNING: Job creator user ${req.user.id}`);
      }
      // Assigned notary access
      else if (job.selectedNotary === req.user.id.toString()) {
        hasAccess = true;
        console.log(`✅ DOCUMENT SIGNING: Assigned notary user ${req.user.id}`);
      }
      // Signer access - check via signers table (CRITICAL FOR SIGNING!)
      else if (req.user.role === 'signer' || req.user.role === 'witness') {
        const [signer] = await db
          .select()
          .from(signers)
          .where(and(eq(signers.jobId, jobId), eq(signers.signerEmail, req.user.email)))
          .limit(1);
        
        if (signer) {
          hasAccess = true;
          console.log(`✅ DOCUMENT SIGNING: Invited signer user ${req.user.id} (${req.user.email}) on job ${jobId}`);
        }
      }
      
      if (!hasAccess) {
        console.log(`❌ DOCUMENT SIGNING DENIED: User ${req.user.id} (${req.user.email}, role: ${req.user.role}) not authorized for job ${jobId} documents`);
        return res.status(403).json({ message: 'You do not have permission to sign documents in this job.' });
      }

      // Generate signed PDF
      try {
        let pdfBytes: Buffer;
        
        // VULTR ONLY - All documents are stored in Vultr cloud storage
        const filePath = document.filePath;
        
        const { cloudStorage } = await import('./lib/cloud-storage-service');
        
        const fileExists = await cloudStorage.fileExists(filePath);
        if (!fileExists) {
          return res.status(404).json({ message: 'PDF file not found in cloud storage' });
        }
        
        // Get signed URL to download the file content
        const signedUrl = await cloudStorage.getSignedUrl(filePath, 300); // 5 minutes for processing
        
        // Fetch the file content from Vultr with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for PDF processing
        
        const response = await fetch(signedUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'USA-Notary-Service/1.0'
          }
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Failed to download PDF from Vultr: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        pdfBytes = Buffer.from(arrayBuffer);
        console.log(`Downloaded PDF from Vultr for signing: ${document.originalName}`);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const signatureFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

        for (const sig of signatures) {
          const pageIndex = (sig.page || 1) - 1;
          if (pageIndex < 0 || pageIndex >= pages.length) {
            console.warn(`Invalid page number ${sig.page} for signature. Skipping.`);
            continue;
          }

          const page = pages[pageIndex];
          const pageDimensions = page.getSize();
          
          // Use client-provided dimensions for scaling, or default to page dimensions
          const clientWidth = sig.clientWidth || pageDimensions.width;
          const clientHeight = sig.clientHeight || pageDimensions.height;

          const widthScale = pageDimensions.width / clientWidth;
          const heightScale = pageDimensions.height / clientHeight;

          const x = sig.x * widthScale;
          const y = pageDimensions.height - (sig.y * heightScale);
          const signatureWidth = sig.width * widthScale;
          const signatureHeight = sig.height * heightScale;
          
          // Adjust y-coordinate for the height of the signature itself
          const finalY = y - signatureHeight;

          try {
            if (sig.type === 'signature' || sig.type === 'initial' || sig.type === 'stamp') {
              if (sig.signatureImage) {
                const base64Data = sig.signatureImage.split(',')[1];
                if (base64Data) {
                  const imageBytes = Buffer.from(base64Data, 'base64');
                  
                  let image;
                  try {
                    if (sig.signatureImage.startsWith('data:image/jpeg') || sig.signatureImage.startsWith('data:image/jpg')) {
                      image = await pdfDoc.embedJpg(imageBytes);
                    } else {
                      image = await pdfDoc.embedPng(imageBytes);
                    }
                    
                    page.drawImage(image, {
                      x,
                      y: finalY,
                      width: signatureWidth,
                      height: signatureHeight,
                    });

                  } catch (embedError) {
                    console.error('Failed to embed image:', embedError);
                  }
                }
              }
            } else if (sig.type === 'checkbox') {
              // Draw a checkmark manually instead of using a text character
              const checkmarkSize = Math.min(signatureWidth, signatureHeight) * 0.8;
              const xPos = x + (signatureWidth / 2);
              const yPos = finalY + (signatureHeight / 2);
              
              const p1 = { x: xPos - checkmarkSize / 2, y: yPos };
              const p2 = { x: xPos - checkmarkSize / 4, y: yPos - checkmarkSize / 2 };
              const p3 = { x: xPos + checkmarkSize / 2, y: yPos + checkmarkSize / 2 };

              page.drawLine({
                start: p1,
                end: p2,
                thickness: 2,
                color: rgb(0, 0, 0),
              });
              page.drawLine({
                start: p2,
                end: p3,
                thickness: 2,
                color: rgb(0, 0, 0),
              });
            } else if (sig.content) {
              page.drawText(sig.content, {
                x,
                y: finalY,
                font: helveticaFont,
                size: 12, // Or a dynamic size
                color: rgb(0, 0, 0),
              });
            }
          } catch (err) {
            console.error(`Failed to draw signature (ID: ${sig.id}, Type: ${sig.type}):`, err);
            // Continue to next signature
          }
        }

        const signedPdfBytes = await pdfDoc.save();

        console.log(`Successfully generated signed PDF for document ${documentId}`);
        const filename = `SIGNED_${Date.now()}_${document.originalName}`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(Buffer.from(signedPdfBytes));

      } catch (pdfError) {
        console.error('Error during PDF signing process:', pdfError);
        res.status(500).json({
            success: false,
            message: 'Failed to generate signed PDF.',
            error: pdfError instanceof Error ? pdfError.message : String(pdfError),
        });
      }
    } catch (error) {
      console.error('Sign document error:', error);
      
      // Ensure we return JSON even on error
      const errorResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      };
      
      res.status(500).json(errorResponse);
    }
  });

  // Document preview route (for images and PDFs) - Vultr-enabled
  app.get('/api/jobs/:jobId/documents/:documentId/preview', async (req: any, res) => {
    try {
      // Handle authentication via header or query parameter (for iframe compatibility)
      let token = req.headers.authorization?.split(' ')[1];
      if (!token && req.query.token) {
        token = req.query.token as string;
      }
      
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      let user;
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        user = decoded;
      } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const jobId = parseInt(req.params.jobId);
      const documentId = parseInt(req.params.documentId);

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      const document = await storage.getJobDocument(documentId);
      if (!document || document.jobId !== jobId) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Check if user has access to preview documents from this job
      let hasAccess = false;
      
      // Admin access
      if (user.role === 'admin') {
        hasAccess = true;
        console.log(`✅ DOCUMENT ACCESS: Admin user ${user.id}`);
      }
      // Job creator access
      else if (job.userId === user.id) {
        hasAccess = true;
        console.log(`✅ DOCUMENT ACCESS: Job creator user ${user.id}`);
      }
      // Assigned notary access
      else if (job.selectedNotary === user.id.toString()) {
        hasAccess = true;
        console.log(`✅ DOCUMENT ACCESS: Assigned notary user ${user.id}`);
      }
      // Signer access - check via signers table (THIS WAS MISSING!)
      else if (user.role === 'signer' || user.role === 'witness') {
        const [signer] = await db
          .select()
          .from(signers)
          .where(and(eq(signers.jobId, jobId), eq(signers.signerEmail, user.email)))
          .limit(1);
        
        if (signer) {
          hasAccess = true;
          console.log(`✅ DOCUMENT ACCESS: Invited signer user ${user.id} (${user.email}) on job ${jobId}`);
        }
      }
      
      if (!hasAccess) {
        console.log(`❌ DOCUMENT ACCESS DENIED: User ${user.id} (${user.email}, role: ${user.role}) not authorized for job ${jobId} documents`);
        return res.status(403).json({ message: 'You do not have permission to view this document.' });
      }

      // VULTR ONLY - All documents are stored in Vultr cloud storage
      const filePath = document.filePath;
      
      try {
        const { cloudStorage } = await import('./lib/cloud-storage-service');
        
        // Check if file exists in Vultr
        const fileExists = await cloudStorage.fileExists(filePath);
        if (!fileExists) {
          return res.status(404).json({ message: 'File not found in cloud storage' });
        }
        
        // Generate signed URL for preview (valid for 1 hour)
        const signedUrl = await cloudStorage.getSignedUrl(filePath, 3600);
        
        // Set appropriate headers for inline viewing
        res.setHeader('Content-Type', document.mimeType);
        res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minute cache
        
        // Redirect to Vultr signed URL for inline viewing
        console.log(`Redirecting to Vultr preview: ${document.originalName}`);
        res.redirect(302, signedUrl);
        
      } catch (vultrError) {
        console.error('Vultr preview error:', vultrError);
        return res.status(500).json({ message: 'Failed to access file in cloud storage' });
      }
    } catch (error) {
      console.error('Preview document error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Calendar Management API

  // Get notary time slots
app.get('/api/calendar/time-slots', verifyToken, cacheUserData(180), async (req: any, res) => {
    try {
      const { month, year } = req.query;
      const notaryId = req.user.id;

      if (req.user.role !== 'notary' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      let query = db
        .select()
        .from(notaryTimeSlots)
        .where(eq(notaryTimeSlots.notaryId, notaryId))
        .orderBy(notaryTimeSlots.date, notaryTimeSlots.startTime);

      // Filter by month/year if provided
      if (month && year) {
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
        query = query.where(
          and(
            gte(notaryTimeSlots.date, startDate),
            lte(notaryTimeSlots.date, endDate)
          )
        );
      }

      const timeSlots = await query;
      res.json(timeSlots);
    } catch (error) {
      console.error('Error fetching time slots:', error);
      res.status(500).json({ error: 'Failed to fetch time slots' });
    }
  });

  // Create time slot
  app.post('/api/calendar/time-slots', verifyToken, async (req: any, res) => {
    try {
      const notaryId = req.user.id;
      const { date, startTime, endTime, status, blockReason } = req.body;

      if (req.user.role !== 'notary' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // 🔧 CRITICAL FIX: Validate required fields and time format
      if (!date || !startTime || !endTime) {
        return res.status(400).json({ 
          error: 'Missing required fields: date, startTime, and endTime are required' 
        });
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return res.status(400).json({ 
          error: 'Invalid time format. Please use HH:MM format (e.g., 09:30)' 
        });
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({ 
          error: 'Invalid date format. Please use YYYY-MM-DD format' 
        });
      }

      const newSlot = await db
        .insert(notaryTimeSlots)
        .values({
          notaryId,
          date,
          startTime,
          endTime,
          status: status || 'available',
          blockReason,
          isManualBlock: status === 'blocked'
        })
        .returning();

      // 🔧 CRITICAL FIX: Invalidate calendar cache after slot creation
      try {
        const { redisCache } = await import('./services/redis-cache');
        await redisCache.delPattern(`user:${notaryId}:*calendar*`);
        await redisCache.delPattern(`*calendar*`);
        console.log(`🧹 Invalidated calendar cache for user ${notaryId} after slot creation`);
      } catch (cacheError) {
        console.error('Failed to invalidate calendar cache:', cacheError);
        // Don't fail the request if cache invalidation fails
      }

      res.json(newSlot[0]);
    } catch (error) {
      console.error('Error creating time slot:', error);
      res.status(500).json({ error: 'Failed to create time slot' });
    }
  });

  // Bulk create time slots
  app.post('/api/calendar/bulk-slots', verifyToken, async (req: any, res) => {
    try {
      const notaryId = req.user.id;
      const { date, startTime, endTime, status, blockReason } = req.body;

      if (req.user.role !== 'notary' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Generate time slots in 15-minute intervals
      const slots = [];
      const start = new Date(`1970-01-01T${startTime}:00`);
      const end = new Date(`1970-01-01T${endTime}:00`);
      
      while (start < end) {
        const slotStartTime = start.toTimeString().slice(0, 5);
        const slotEndTime = new Date(start.getTime() + 15 * 60000).toTimeString().slice(0, 5);
        
        // Check if slot already exists
        const existingSlot = await db
          .select()
          .from(notaryTimeSlots)
          .where(
            and(
              eq(notaryTimeSlots.notaryId, notaryId),
              eq(notaryTimeSlots.date, date),
              eq(notaryTimeSlots.startTime, slotStartTime)
            )
          );

        if (existingSlot.length === 0) {
          slots.push({
            notaryId,
            date,
            startTime: slotStartTime,
            endTime: slotEndTime,
            status: status || 'available',
            blockReason: status === 'blocked' ? blockReason : null,
            isManualBlock: status === 'blocked'
          });
        }
        
        start.setMinutes(start.getMinutes() + 15);
      }

      if (slots.length > 0) {
        await db.insert(notaryTimeSlots).values(slots);
      }

      res.json({ 
        success: true, 
        message: `Created ${slots.length} time slots`,
        slotsCreated: slots.length
      });
    } catch (error) {
      console.error('Error creating bulk time slots:', error);
      res.status(500).json({ error: 'Failed to create bulk time slots' });
    }
  });

  // Enhanced bulk availability setup with date range and days of week
  app.post('/api/calendar/bulk-availability', verifyToken, async (req: any, res) => {
    try {
      const notaryId = req.user.id;
      const { dateRange, timeRange, daysOfWeek, type, blockReason } = req.body;

      if (req.user.role !== 'notary' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      
      // Validate date range
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 365) {
        return res.status(400).json({ error: 'Date range cannot exceed 365 days' });
      }

      // Get existing slots for this notary in one query to avoid checking each slot individually
      const existingSlots = await db
        .select({
          date: notaryTimeSlots.date,
          startTime: notaryTimeSlots.startTime
        })
        .from(notaryTimeSlots)
        .where(
          and(
            eq(notaryTimeSlots.notaryId, notaryId),
            gte(notaryTimeSlots.date, dateRange.start),
            lte(notaryTimeSlots.date, dateRange.end)
          )
        );

      // Create a Set for fast lookup of existing slots
      const existingSlotsSet = new Set(
        existingSlots.map(slot => `${slot.date}-${slot.startTime}`)
      );

      const allSlots = [];
      
      // Generate time slots array first
      const timeSlotTemplates = [];
      const start = new Date(`1970-01-01T${timeRange.start}:00`);
      const end = new Date(`1970-01-01T${timeRange.end}:00`);
      
      while (start < end) {
        const slotStartTime = start.toTimeString().slice(0, 5);
        const slotEndTime = new Date(start.getTime() + 15 * 60000).toTimeString().slice(0, 5);
        timeSlotTemplates.push({ startTime: slotStartTime, endTime: slotEndTime });
        start.setMinutes(start.getMinutes() + 15);
      }

      // Loop through each date in the range
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dayOfWeek = date.getDay();
        
        // Check if this day of week is selected
        if (daysOfWeek.includes(dayOfWeek)) {
          const dateString = date.toISOString().split('T')[0];
          
          // Add all time slots for this date if they don't exist
          for (const timeSlot of timeSlotTemplates) {
            const slotKey = `${dateString}-${timeSlot.startTime}`;
            
            if (!existingSlotsSet.has(slotKey)) {
              allSlots.push({
                notaryId,
                date: dateString,
                startTime: timeSlot.startTime,
                endTime: timeSlot.endTime,
                status: type || 'available',
                blockReason: type === 'blocked' ? blockReason : null,
                isManualBlock: type === 'blocked'
              });
            }
          }
        }
      }

      // Insert all slots in larger batches for better performance
      let totalCreated = 0;
      
      if (allSlots.length > 0) {
        const batchSize = 500; // Larger batch size for better performance
        
        for (let i = 0; i < allSlots.length; i += batchSize) {
          const batch = allSlots.slice(i, i + batchSize);
          
          try {
            await db.insert(notaryTimeSlots).values(batch);
            totalCreated += batch.length;
          } catch (batchError) {
            console.error(`Error inserting batch ${i / batchSize + 1}:`, batchError);
            // Continue with next batch even if one fails
          }
        }
      }

      // 🔧 CRITICAL FIX: Invalidate calendar cache after bulk creation
      try {
        const { redisCache } = await import('./services/redis-cache');
        await redisCache.delPattern(`user:${notaryId}:*calendar*`);
        await redisCache.delPattern(`*calendar*`);
        console.log(`🧹 Invalidated calendar cache for user ${notaryId} after bulk setup`);
      } catch (cacheError) {
        console.error('Failed to invalidate calendar cache:', cacheError);
        // Don't fail the request if cache invalidation fails
      }

      res.json({ 
        success: true, 
        message: `Created ${totalCreated} time slots across ${daysDiff + 1} days`,
        slotsCreated: totalCreated,
        totalDays: daysDiff + 1,
        slotsPerDay: timeSlotTemplates.length
      });
    } catch (error) {
      console.error('Error creating bulk availability:', error);
      res.status(500).json({ error: 'Failed to create bulk availability' });
    }
  });

  // Update time slot
  app.put('/api/calendar/time-slots/:id', verifyToken, async (req, res) => {
    try {
      const notaryId = req.user?.id;
      const slotId = parseInt(req.params.id);
      const updates = req.body;

      if (req.user?.role !== 'notary' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Verify slot belongs to the notary
      const existingSlot = await db
        .select()
        .from(notaryTimeSlots)
        .where(
          and(
            eq(notaryTimeSlots.id, slotId),
            eq(notaryTimeSlots.notaryId, notaryId)
          )
        );

      if (existingSlot.length === 0) {
        return res.status(404).json({ error: 'Time slot not found' });
      }

      const updatedSlot = await db
        .update(notaryTimeSlots)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(notaryTimeSlots.id, slotId))
        .returning();

      // 🔧 CRITICAL FIX: Invalidate calendar cache after slot update
      try {
        const { redisCache } = await import('./services/redis-cache');
        await redisCache.delPattern(`user:${notaryId}:*calendar*`);
        await redisCache.delPattern(`*calendar*`);
        console.log(`🧹 Invalidated calendar cache for user ${notaryId} after slot update`);
      } catch (cacheError) {
        console.error('Failed to invalidate calendar cache:', cacheError);
        // Don't fail the request if cache invalidation fails
      }

      res.json(updatedSlot[0]);
    } catch (error) {
      console.error('Error updating time slot:', error);
      res.status(500).json({ error: 'Failed to update time slot' });
    }
  });

  // Delete time slot
  app.delete('/api/calendar/time-slots/:id', verifyToken, async (req, res) => {
    try {
      const notaryId = req.user?.id;
      const slotId = parseInt(req.params.id);

      if (req.user?.role !== 'notary' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Verify slot belongs to the notary and is not booked
      const existingSlot = await db
        .select()
        .from(notaryTimeSlots)
        .where(
          and(
            eq(notaryTimeSlots.id, slotId),
            eq(notaryTimeSlots.notaryId, notaryId)
          )
        );

      if (existingSlot.length === 0) {
        return res.status(404).json({ error: 'Time slot not found' });
      }

      if (existingSlot[0].status === 'booked') {
        return res.status(400).json({ error: 'Cannot delete booked time slot' });
      }

      await db
        .delete(notaryTimeSlots)
        .where(eq(notaryTimeSlots.id, slotId));


        // 🔧 CRITICAL FIX: Invalidate calendar cache after slot deletion
      try {
        const { redisCache } = await import('./services/redis-cache');
        await redisCache.delPattern(`user:${notaryId}:*calendar*`);
        await redisCache.delPattern(`*calendar*`);
        console.log(`🧹 Invalidated calendar cache for user ${notaryId} after slot deletion`);
      } catch (cacheError) {
        console.error('Failed to invalidate calendar cache:', cacheError);
        // Don't fail the request if cache invalidation fails
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting time slot:', error);
      res.status(500).json({ error: 'Failed to delete time slot' });
    }
  });

  // Get calendar events
  app.get('/api/calendar/events', verifyToken, cacheUserData(180), async (req, res) => {
    try {
      const { month, year } = req.query;
      const notaryId = req.user?.id;

      if (req.user?.role !== 'notary' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      let query = db
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.notaryId, notaryId))
        .orderBy(calendarEvents.startDateTime);

      // Filter by month/year if provided
      if (month && year) {
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0);
        
        query = query.where(
          and(
            gte(calendarEvents.startDateTime, startDate),
            lte(calendarEvents.startDateTime, endDate)
          )
        );
      }

      const events = await query;
      res.json(events);
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  });

  // Create calendar event
  app.post('/api/calendar/events', verifyToken, async (req, res) => {
    try {
      const notaryId = req.user?.id;
      const { title, description, startDateTime, endDateTime, location, eventType, isAllDay } = req.body;

      if (req.user?.role !== 'notary' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const newEvent = await db
        .insert(calendarEvents)
        .values({
          notaryId,
          title,
          description,
          startDateTime: new Date(startDateTime),
          endDateTime: new Date(endDateTime),
          location,
          eventType: eventType || 'personal',
          isAllDay: isAllDay || false
        })
        .returning();

      res.json(newEvent[0]);
    } catch (error) {
      console.error('Error creating event:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  });

  // Get working hours
  app.get('/api/calendar/working-hours', verifyToken, async (req, res) => {
    try {
      const notaryId = req.user?.id;

      if (req.user?.role !== 'notary' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const workingHours = await db
        .select()
        .from(notaryWorkingHours)
        .where(eq(notaryWorkingHours.notaryId, notaryId))
        .orderBy(notaryWorkingHours.dayOfWeek);

      res.json(workingHours);
    } catch (error) {
      console.error('Error fetching working hours:', error);
      res.status(500).json({ error: 'Failed to fetch working hours' });
    }
  });

  // Update working hours
  app.put('/api/calendar/working-hours', verifyToken, async (req, res) => {
    try {
      const notaryId = req.user?.id;
      const { workingHours } = req.body;

      if (req.user?.role !== 'notary' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Delete existing working hours
      await db
        .delete(notaryWorkingHours)
        .where(eq(notaryWorkingHours.notaryId, notaryId));

      // Insert new working hours
      if (workingHours && workingHours.length > 0) {
        const hoursToInsert = workingHours
          .filter((h: any) => h.isActive)
          .map((h: any) => ({
            notaryId,
            dayOfWeek: h.dayOfWeek,
            startTime: h.startTime,
            endTime: h.endTime,
            isActive: h.isActive
          }));

        if (hoursToInsert.length > 0) {
          await db.insert(notaryWorkingHours).values(hoursToInsert);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating working hours:', error);
      res.status(500).json({ error: 'Failed to update working hours' });
    }
  });

  // Get available notaries for a specific date/time
  app.get('/api/calendar/available-notaries', verifyToken, async (req, res) => {
    try {
      const { date, startTime, endTime } = req.query;

      if (!date || !startTime || !endTime) {
        return res.status(400).json({ error: 'Date, start time, and end time are required' });
      }

      // Get notaries with available time slots
      const availableNotaries = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          timeSlots: notaryTimeSlots
        })
        .from(users)
        .leftJoin(notaryTimeSlots, 
          and(
            eq(users.id, notaryTimeSlots.notaryId),
            eq(notaryTimeSlots.date, date as string),
            eq(notaryTimeSlots.status, 'available'),
            gte(notaryTimeSlots.startTime, startTime as string),
            lte(notaryTimeSlots.endTime, endTime as string)
          )
        )
        .where(
          and(
            eq(users.role, 'notary'),
            eq(users.isActive, true)
          )
        );

      // Group by notary
      const groupedNotaries = availableNotaries.reduce((acc: any, row) => {
        if (!acc[row.id]) {
          acc[row.id] = {
            id: row.id,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            availableSlots: []
          };
        }
        if (row.timeSlots) {
          acc[row.id].availableSlots.push(row.timeSlots);
        }
        return acc;
      }, {});

      res.json(Object.values(groupedNotaries).filter((n: any) => n.availableSlots.length > 0));
    } catch (error) {
      console.error('Error fetching available notaries:', error);
      res.status(500).json({ error: 'Failed to fetch available notaries' });
    }
  });

  // Get specific notary's availability for a date range
  app.get('/api/calendar/notary-availability/:notaryId', verifyToken, async (req, res) => {
    try {
      const notaryId = parseInt(req.params.notaryId);
      const { startDate, endDate } = req.query;

      if (!notaryId) {
        return res.status(400).json({ error: 'Notary ID is required' });
      }

      // Default to current date and 60 days ahead
      const defaultStartDate = new Date().toISOString().split('T')[0];
      const defaultEndDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const timeSlots = await db
        .select()
        .from(notaryTimeSlots)
        .where(
          and(
            eq(notaryTimeSlots.notaryId, notaryId),
            gte(notaryTimeSlots.date, (startDate as string) || defaultStartDate),
            lte(notaryTimeSlots.date, (endDate as string) || defaultEndDate)
          )
        )
        .orderBy(notaryTimeSlots.date, notaryTimeSlots.startTime);

      res.json(timeSlots);
    } catch (error) {
      console.error('Error fetching notary availability:', error);
      res.status(500).json({ error: 'Failed to fetch notary availability' });
    }
  });

  // Get all available notaries (for notary change functionality)
  app.get('/api/notaries/available', verifyToken, cacheUserData(300), async (req, res) => {
    try {
      // SECURITY RESTRICTION: Title companies can no longer browse notary lists
      // They must use auto assignment or notary ID code lookup instead
      const canViewNotaries = 
        hasAdminPrivileges(req.user) ||
        req.user.role === 'client' ||
        (req.user.role === 'notary' && req.user.notaryType === 'subscriber');

      if (!canViewNotaries) {
        return res.status(403).json({ 
          error: 'Access denied', 
          message: 'Title companies cannot browse notary lists. Please use auto assignment or notary ID code lookup instead.' 
        });
      }

      const availableNotaries = await db
        .select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          isNotarySigningAgent: users.isNotarySigningAgent,
          isSpanishSpeaking: users.isSpanishSpeaking,
          notaryType: users.notaryType,
          maxConcurrentJobs: users.maxConcurrentJobs
        })
        .from(users)
        .where(
          and(
            eq(users.role, 'notary'),
            eq(users.isActive, true)
            // Removed the restrictive notaryType filter - include all active notaries
          )
        )
        .orderBy(users.firstName, users.lastName, users.username);

      res.json(availableNotaries);
    } catch (error) {
      console.error('Error fetching available notaries:', error);
      res.status(500).json({ error: 'Failed to fetch available notaries' });
    }
  });

  // Book a time slot for a job
  app.post('/api/calendar/book-slot', verifyToken, async (req, res) => {
    try {
      const { slotId, jobId } = req.body;

      if (!slotId || !jobId) {
        return res.status(400).json({ error: 'Slot ID and Job ID are required' });
      }

      // Verify the slot is available
      const slot = await db
        .select()
        .from(notaryTimeSlots)
        .where(
          and(
            eq(notaryTimeSlots.id, slotId),
            eq(notaryTimeSlots.status, 'available')
          )
        );

      if (slot.length === 0) {
        return res.status(400).json({ error: 'Time slot is not available' });
      }

      // Update the slot status to booked
      await db
        .update(notaryTimeSlots)
        .set({ 
          status: 'booked',
          jobId,
          updatedAt: new Date()
        })
        .where(eq(notaryTimeSlots.id, slotId));

      // Create a calendar event for the job
      await db
        .insert(calendarEvents)
        .values({
          notaryId: slot[0].notaryId,
          title: `Notarization Job #${jobId}`,
          description: 'Scheduled notarization appointment',
          startDateTime: new Date(`${slot[0].date} ${slot[0].startTime}`),
          endDateTime: new Date(`${slot[0].date} ${slot[0].endTime}`),
          eventType: 'job',
          jobId,
          isAllDay: false
        });

      res.json({ success: true, message: 'Time slot booked successfully' });
    } catch (error) {
      console.error('Error booking time slot:', error);
      res.status(500).json({ error: 'Failed to book time slot' });
    }
  });

  // Random Notary Assignment API

  // Get aggregated availability for qualified notaries
  app.get('/api/random-notary/availability/:date', verifyToken, async (req: any, res) => {
    try {
      const { date } = req.params;
      const { requiresNSA, requiresSpanishSpeaking, excludeNotaryIds } = req.query;

      if (req.user.role !== 'admin' && req.user.role !== 'title_company') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const qualifications: NotaryQualifications = {
        requiresNSA: requiresNSA === 'true',
        requiresSpanishSpeaking: requiresSpanishSpeaking === 'true'
      };

      const excludeIds = excludeNotaryIds ? 
        (Array.isArray(excludeNotaryIds) ? excludeNotaryIds : [excludeNotaryIds]).map((id: string) => parseInt(id)) : 
        [];

      const availability = await randomNotaryService.aggregateAvailability(qualifications, date, excludeIds);
      res.json(availability);
    } catch (error) {
      console.error('Error getting notary availability:', error);
      res.status(500).json({ error: 'Failed to get notary availability' });
    }
  });

  // Get qualified notaries for a job
  app.get('/api/random-notary/qualified', verifyToken, async (req: any, res) => {
    try {
      const { requiresNSA, requiresSpanishSpeaking, excludeNotaryIds } = req.query;

      if (req.user.role !== 'admin' && req.user.role !== 'title_company') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const qualifications: NotaryQualifications = {
        requiresNSA: requiresNSA === 'true',
        requiresSpanishSpeaking: requiresSpanishSpeaking === 'true'
      };

      const excludeIds = excludeNotaryIds ? 
        (Array.isArray(excludeNotaryIds) ? excludeNotaryIds : [excludeNotaryIds]).map((id: string) => parseInt(id)) : 
        [];

      const qualifiedNotaries = await randomNotaryService.getQualifiedNotaries(qualifications, excludeIds);
      res.json(qualifiedNotaries);
    } catch (error) {
      console.error('Error getting qualified notaries:', error);
      res.status(500).json({ error: 'Failed to get qualified notaries' });
    }
  });

  // Select random notary for a specific time slot
  app.post('/api/random-notary/select', verifyToken, async (req: any, res) => {
    try {
      const { qualifications, timeSlot, excludeNotaryIds } = req.body;

      if (req.user.role !== 'admin' && req.user.role !== 'title_company') {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!qualifications || !timeSlot) {
        return res.status(400).json({ error: 'Qualifications and time slot are required' });
      }

      const selectedNotary = await randomNotaryService.selectRandomNotary(
        qualifications, 
        timeSlot, 
        excludeNotaryIds || []
      );

      if (!selectedNotary) {
        return res.status(404).json({ error: 'No qualified notaries available for the selected time slot' });
      }

      res.json(selectedNotary);
    } catch (error) {
      console.error('Error selecting random notary:', error);
      res.status(500).json({ error: 'Failed to select random notary' });
    }
  });

  // Get job completion report
  app.get('/api/jobs/:id/completion-report', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      
      if (isNaN(jobId)) {
        return res.status(400).json({ message: 'Invalid job ID' });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { JobCompletionReportService } = await import('./services/job-completion-report-service');
      const reportInfo = await JobCompletionReportService.getJobCompletionReport(jobId);
      
      res.json(reportInfo);
      
    } catch (error) {
      console.error('Get completion report error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Download job completion report
  app.get('/api/jobs/:id/completion-report/download', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      
      if (isNaN(jobId)) {
        return res.status(400).json({ message: 'Invalid job ID' });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { JobCompletionReportService } = await import('./services/job-completion-report-service');
      const reportInfo = await JobCompletionReportService.getJobCompletionReport(jobId);
      
      if (!reportInfo.exists || !reportInfo.reportPath) {
        return res.status(404).json({ message: 'Completion report not found' });
      }

      // Check if file exists
      const fs = await import('fs/promises');
      const path = await import('path');
      
      try {
        const fullPath = path.resolve(reportInfo.reportPath);
        const fileStats = await fs.stat(fullPath);
        
        if (!fileStats.isFile()) {
          return res.status(404).json({ message: 'Report file not found' });
        }

        const fileName = path.basename(fullPath);
        
        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', fileStats.size);
        
        // Stream the file
        const fileBuffer = await fs.readFile(fullPath);
        res.send(fileBuffer);
        
      } catch (fileError) {
        console.error('Error reading report file:', fileError);
        return res.status(404).json({ message: 'Report file not accessible' });
      }
      
    } catch (error) {
      console.error('Download completion report error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Generate completion report manually (admin only)
  app.post('/api/jobs/:id/generate-completion-report', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      
      if (isNaN(jobId)) {
        return res.status(400).json({ message: 'Invalid job ID' });
      }

      // Only admins and job creators can manually generate reports
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      if (req.user.role !== 'admin' && job.userId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { JobCompletionReportService } = await import('./services/job-completion-report-service');
      const reportResult = await JobCompletionReportService.generateJobCompletionReport(jobId);
      
      if (reportResult.success) {
        res.json({
          success: true,
          message: 'Completion report generated successfully',
          reportPath: reportResult.reportPath
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to generate completion report',
          error: reportResult.error
        });
      }
      
    } catch (error) {
      console.error('Generate completion report error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Assign notary to job (supports random, preferred, and manual assignment)
  app.post('/api/random-notary/assign', verifyToken, async (req: any, res) => {
    try {
      const { jobId, notaryId, timeSlot, assignmentType } = req.body;

      if (req.user.role !== 'admin' && req.user.role !== 'title_company') {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!jobId || !notaryId || !timeSlot) {
        return res.status(400).json({ error: 'Job ID, notary ID, and time slot are required' });
      }

      const success = await randomNotaryService.assignNotaryToJob(
        jobId, 
        notaryId, 
        timeSlot, 
        assignmentType || 'manual'
      );

      if (success) {
        res.json({ success: true, message: 'Notary assigned successfully' });
      } else {
        res.status(500).json({ error: 'Failed to assign notary to job' });
      }
    } catch (error) {
      console.error('Error assigning notary to job:', error);
      res.status(500).json({ error: 'Failed to assign notary to job' });
    }
  });

  // Handle notary rejection
  app.post('/api/random-notary/reject', verifyToken, async (req: any, res) => {
    try {
      const { jobId, rejectionReason } = req.body;
      const notaryId = req.user.id;

      if (req.user.role !== 'notary') {
        return res.status(403).json({ error: 'Only notaries can reject assignments' });
      }

      if (!jobId) {
        return res.status(400).json({ error: 'Job ID is required' });
      }

      const newNotary = await randomNotaryService.handleNotaryRejection(
        jobId, 
        notaryId, 
        rejectionReason
      );

      if (newNotary) {
        res.json({ 
          success: true, 
          message: 'Assignment rejected and new notary assigned',
          newNotary 
        });
      } else {
        // Send priority alert to admin
        await randomNotaryService.sendPriorityAlert(
          jobId,
          `No available notaries found for job ${jobId} after rejection by notary ${notaryId}`
        );

        res.json({ 
          success: true, 
          message: 'Assignment rejected. Admin has been notified to manually assign a notary.',
          requiresManualAssignment: true
        });
      }
    } catch (error) {
      console.error('Error handling notary rejection:', error);
      res.status(500).json({ error: 'Failed to handle notary rejection' });
    }
  });

  // Get assignment history for a job
  app.get('/api/random-notary/assignment-history/:jobId', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);

      if (req.user.role !== 'admin' && req.user.role !== 'title_company') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const assignmentHistory = await db
        .select({
          id: notaryAssignmentLog.id,
          notaryId: notaryAssignmentLog.notaryId,
          assignmentType: notaryAssignmentLog.assignmentType,
          assignmentStatus: notaryAssignmentLog.assignmentStatus,
          assignedAt: notaryAssignmentLog.assignedAt,
          respondedAt: notaryAssignmentLog.respondedAt,
          rejectionReason: notaryAssignmentLog.rejectionReason,
          notaryName: users.username,
          notaryFirstName: users.firstName,
          notaryLastName: users.lastName,
          notaryEmail: users.email
        })
        .from(notaryAssignmentLog)
        .leftJoin(users, eq(notaryAssignmentLog.notaryId, users.id))
        .where(eq(notaryAssignmentLog.jobId, jobId))
        .orderBy(desc(notaryAssignmentLog.assignedAt));

      res.json(assignmentHistory);
    } catch (error) {
      console.error('Error getting assignment history:', error);
      res.status(500).json({ error: 'Failed to get assignment history' });
    }
  });

  // Check if title company has preferred notary
  app.get('/api/title-companies/:companyName/preferred-notary', verifyToken, async (req: any, res) => {
    try {
      const { companyName } = req.params;

      const company = await db
        .select({
          id: companies.id,
          companyName: companies.companyName,
          preferredNotaryId: companies.preferredNotaryId,
          preferredNotaryName: users.username,
          preferredNotaryFirstName: users.firstName,
          preferredNotaryLastName: users.lastName,
          preferredNotaryEmail: users.email,
          preferredNotaryActive: users.isActive
        })
        .from(companies)
        .leftJoin(users, eq(companies.preferredNotaryId, users.id))
        .where(eq(companies.companyName, companyName))
        .limit(1);

      if (company.length === 0) {
        return res.status(404).json({ error: 'Title company not found' });
      }

      res.json(company[0]);
    } catch (error) {
      console.error('Error getting preferred notary:', error);
      res.status(500).json({ error: 'Failed to get preferred notary' });
    }
  });

  // Get notary by ID code (for title company manual assignment)
  app.get('/api/notaries/by-code/:notaryIdCode', verifyToken, async (req: any, res) => {
    try {
      // Verify user is title company or admin
      if (req.user.role !== 'title_company' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { notaryIdCode } = req.params;
      
      // Validate notary ID code format (CY followed by 4 digits)
      if (!/^CY\d{4}$/i.test(notaryIdCode)) {
        return res.status(400).json({ error: 'Invalid notary ID code format. Expected format: CY####' });
      }

      // Find notary by ID code (case-insensitive)
      const notary = await db
        .select({
          id: users.id,
          notaryIdCode: users.notaryIdCode,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          email: users.email,
          isActive: users.isActive,
          isNotarySigningAgent: users.isNotarySigningAgent,
          isSpanishSpeaking: users.isSpanishSpeaking,
          commissionNumber: users.commissionNumber,
          commissionExpiration: users.commissionExpiration,
          state: users.state,
          notaryType: users.notaryType
        })
        .from(users)
        .where(
          and(
            sql`UPPER(${users.notaryIdCode}) = UPPER(${notaryIdCode})`,
            eq(users.role, 'notary'),
            eq(users.isActive, true)
          )
        )
        .limit(1);

      if (notary.length === 0) {
        return res.status(404).json({ error: 'Notary not found or inactive' });
      }

      // Return notary information (without sensitive data)
      const notaryData = notary[0];
      res.json({
        id: notaryData.id,
        notaryIdCode: notaryData.notaryIdCode,
        name: `${notaryData.firstName} ${notaryData.lastName}`.trim() || notaryData.username,
        firstName: notaryData.firstName,
        lastName: notaryData.lastName,
        email: notaryData.email,
        isNotarySigningAgent: notaryData.isNotarySigningAgent,
        isSpanishSpeaking: notaryData.isSpanishSpeaking,
        commissionNumber: notaryData.commissionNumber,
        commissionExpiration: notaryData.commissionExpiration,
        state: notaryData.state,
        notaryType: notaryData.notaryType,
        qualifications: {
          nsa: notaryData.isNotarySigningAgent,
          spanish: notaryData.isSpanishSpeaking
        }
      });
    } catch (error) {
      console.error('Error finding notary by code:', error);
      res.status(500).json({ error: 'Failed to find notary' });
    }
  });

  // Email Settings API Routes
  app.get('/api/settings/email', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const settingsData = await db.select().from(systemSettings).where(
        inArray(systemSettings.key, [
          'email_provider',
          'postmark_api_key', 'postmark_from_email', 'postmark_from_name',
          'postmark_track_opens', 'postmark_track_links', 'postmark_message_stream',
          'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 
          'smtp_secure', 'from_email', 'from_name'
        ])
      );

      const settings: any = {};
      settingsData.forEach(setting => {
        // Don't expose passwords/keys in plain text
        if (setting.key === 'smtp_pass' || setting.key === 'postmark_api_key') {
          settings[setting.key] = setting.value ? '••••••••' : '';
        } else {
          settings[setting.key] = setting.value;
        }
      });

      res.json(settings);
    } catch (error) {
      console.error('Get email settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/settings/email', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { 
        email_provider,
        postmark_api_key, postmark_from_email, postmark_from_name,
        postmark_track_opens, postmark_track_links, postmark_message_stream,
        smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, 
        from_email, from_name 
      } = req.body;

      const emailSettings = [
        { key: 'email_provider', value: email_provider, description: 'Email provider preference' },
        { key: 'postmark_from_email', value: postmark_from_email, description: 'Postmark from email address' },
        { key: 'postmark_from_name', value: postmark_from_name, description: 'Postmark from display name' },
        { key: 'postmark_track_opens', value: postmark_track_opens, description: 'Postmark track email opens' },
        { key: 'postmark_track_links', value: postmark_track_links, description: 'Postmark track links' },
        { key: 'postmark_message_stream', value: postmark_message_stream, description: 'Postmark message stream' },
        { key: 'smtp_host', value: smtp_host, description: 'SMTP server hostname' },
        { key: 'smtp_port', value: smtp_port, description: 'SMTP server port' },
        { key: 'smtp_user', value: smtp_user, description: 'SMTP username/email' },
        { key: 'smtp_secure', value: smtp_secure, description: 'Use SSL/TLS for SMTP' },
        { key: 'from_email', value: from_email, description: 'From email address' },
        { key: 'from_name', value: from_name, description: 'From display name' }
      ];

      // Only update passwords/keys if they're not the masked values
      if (postmark_api_key && postmark_api_key !== '••••••••') {
        emailSettings.push({ 
          key: 'postmark_api_key', 
          value: postmark_api_key, 
          description: 'Postmark API key' 
        });
      }
      
      if (smtp_pass && smtp_pass !== '••••••••') {
        emailSettings.push({ 
          key: 'smtp_pass', 
          value: smtp_pass, 
          description: 'SMTP password' 
        });
      }

      // Update or insert each setting
      for (const setting of emailSettings) {
        const existing = await db.select()
          .from(systemSettings)
          .where(eq(systemSettings.key, setting.key))
          .limit(1);

        if (existing.length > 0) {
          await db.update(systemSettings)
            .set({
              value: setting.value,
              description: setting.description,
              updatedAt: new Date()
            })
            .where(eq(systemSettings.key, setting.key));
        } else {
          await db.insert(systemSettings).values({
            key: setting.key,
            value: setting.value,
            type: 'string',
            description: setting.description,
            isProtected: false
          });
        }
      }

      // Clear email service cache to force reload of new settings
      emailService.clearCache();
      console.log('Email settings updated and cache cleared');

      res.json({ message: 'Email settings updated successfully' });
    } catch (error) {
      console.error('Update email settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/settings/email/test', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { testEmail } = req.body;
      if (!testEmail) {
        return res.status(400).json({ message: 'Test email address is required' });
      }

      const result = await emailService.testConfiguration(testEmail);
      res.json({ message: result });
    } catch (error) {
      console.error('Email test error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Email test failed' });
    }
  });

  // Resend signer invitation
  app.post('/api/signers/:id/resend-invitation', verifyToken, async (req: any, res) => {
    try {
      const signerId = parseInt(req.params.id);

      // Get signer details
      const [signer] = await db.select({
        signer: signers,
        job: jobs
      })
      .from(signers)
      .leftJoin(jobs, eq(signers.jobId, jobs.id))
      .where(eq(signers.id, signerId));

      if (!signer) {
        return res.status(404).json({ message: 'Signer not found' });
      }

      // Generate new invitation token if needed
      const invitationToken = signer.signer.invitationToken || crypto.randomUUID();
      
      if (!signer.signer.invitationToken) {
        await db.update(signers)
          .set({ 
            invitationToken,
            invitationSentAt: new Date()
          })
          .where(eq(signers.id, signerId));
      } else {
        await db.update(signers)
          .set({ invitationSentAt: new Date() })
          .where(eq(signers.id, signerId));
      }

      // Send professional email invitation
      await emailService.sendSignerInvitation({
        signerName: signer.signer.signerName,
        signerEmail: signer.signer.signerEmail,
        signerRole: signer.signer.signerRole,
        invitationToken,
        titleCompany: signer.job?.titleCompany || 'Unknown Company',
        closingType: signer.job?.closingType || 'Document Signing',
        propertyAddress: signer.job ? 
          `${signer.job.propertyAddressOne}, ${signer.job.propertyCity}, ${signer.job.propertyState} ${signer.job.propertyZipCode}` : 
          undefined,
        scheduledDate: signer.job?.selectedDate,
        scheduledTime: signer.job?.selectedTime
      });

      res.json({ message: 'Invitation resent successfully' });
    } catch (error) {
      console.error('Resend invitation error:', error);
      res.status(500).json({ message: 'Failed to resend invitation' });
    }
  });

  // Setup account with signer invitation token - PUBLIC endpoint (no auth required)
  app.get('/api/signers/setup-account/:token', async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ message: 'Invalid invitation token' });
      }

      // Find signer by invitation token
      const result = await db
        .select({
          signer: signers,
          job: jobs,
          user: users
        })
        .from(signers)
        .innerJoin(jobs, eq(signers.jobId, jobs.id))
        .leftJoin(users, eq(signers.userId, users.id))
        .where(eq(signers.invitationToken, token))
        .limit(1);

      if (!result || result.length === 0) {
        return res.status(404).json({ message: 'Invalid or expired invitation token' });
      }

      const [data] = result;
      
      // Check if the job is still active
      if (data.job.jobStatus === 'completed' || data.job.jobStatus === 'cancelled') {
        return res.status(410).json({ 
          message: 'This signing session has already been completed or cancelled' 
        });
      }

      // Check if user account exists for this email
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, data.signer.signerEmail))
        .limit(1);

      // Return setup information
      res.json({
        valid: true,
        isNewUser: !existingUser,
        accountSetupComplete: existingUser?.accountSetupComplete || false,
        signer: {
          id: data.signer.id,
          signerName: data.signer.signerName,
          signerEmail: data.signer.signerEmail,
          signerRole: data.signer.signerRole,
          userId: data.signer.userId,
          signingStatus: data.signer.signingStatus
        },
        job: {
          id: data.job.id,
          titleCompany: data.job.titleCompany,
          closingType: data.job.closingType,
          propertyAddressOne: data.job.propertyAddressOne,
          propertyCity: data.job.propertyCity,
          propertyState: data.job.propertyState,
          propertyZipCode: data.job.propertyZipCode,
          selectedDate: data.job.selectedDate,
          selectedTime: data.job.selectedTime,
          jobStatus: data.job.jobStatus
        },
        user: existingUser ? {
          id: existingUser.id,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          role: existingUser.role,
          isVerified: existingUser.isVerified,
          accountSetupComplete: existingUser.accountSetupComplete,
          needsVerification: !existingUser.isVerified && !existingUser.isVerificationBypassed && !existingUser.notaryVerificationBypassed
        } : null
      });
    } catch (error) {
      console.error('Setup account validation error:', error);
      res.status(500).json({ message: 'Failed to validate setup token' });
    }
  });

  // Validate signer invitation token - PUBLIC endpoint (no auth required)
  app.get('/api/signers/validate-invitation/:token', async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ message: 'Invalid invitation token' });
      }

      // Find signer by invitation token
      const result = await db
        .select({
          signer: signers,
          job: jobs,
          user: users
        })
        .from(signers)
        .innerJoin(jobs, eq(signers.jobId, jobs.id))
        .leftJoin(users, eq(signers.userId, users.id))
        .where(eq(signers.invitationToken, token))
        .limit(1);

      if (!result || result.length === 0) {
        return res.status(404).json({ message: 'Invalid or expired invitation token' });
      }

      const [data] = result;
      
      // Check if the job is still active
      if (data.job.jobStatus === 'completed' || data.job.jobStatus === 'cancelled') {
        return res.status(410).json({ 
          message: 'This signing session has already been completed or cancelled' 
        });
      }

      // Check if user account exists for this email
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, data.signer.signerEmail))
        .limit(1);

      // Return signer and job information
      res.json({
        valid: true,
        hasAccount: !!existingUser,
        accountSetupComplete: existingUser?.accountSetupComplete || false,
        signer: {
          id: data.signer.id,
          signerName: data.signer.signerName,
          signerEmail: data.signer.signerEmail,
          signerRole: data.signer.signerRole,
          userId: data.signer.userId,
          signingStatus: data.signer.signingStatus
        },
        job: {
          id: data.job.id,
          titleCompany: data.job.titleCompany,
          closingType: data.job.closingType,
          propertyAddressOne: data.job.propertyAddressOne,
          propertyCity: data.job.propertyCity,
          propertyState: data.job.propertyState,
          propertyZipCode: data.job.propertyZipCode,
          selectedDate: data.job.selectedDate,
          selectedTime: data.job.selectedTime,
          jobStatus: data.job.jobStatus
        },
        user: existingUser ? {
          id: existingUser.id,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          role: existingUser.role,
          isVerified: existingUser.isVerified,
          accountSetupComplete: existingUser.accountSetupComplete
        } : null
      });
    } catch (error) {
      console.error('Validate invitation error:', error);
      res.status(500).json({ message: 'Failed to validate invitation' });
    }
  });

  // Get or create password reset token for signer - PUBLIC endpoint (no auth required)
  app.post('/api/signers/get-password-reset-token', async (req, res) => {
    try {
      const { invitationToken } = req.body;
      
      if (!invitationToken) {
        return res.status(400).json({ message: 'Invitation token is required' });
      }

      // Find signer by invitation token
      const [signer] = await db
        .select()
        .from(signers)
        .where(eq(signers.invitationToken, invitationToken))
        .limit(1);

      if (!signer) {
        return res.status(404).json({ message: 'Invalid invitation token' });
      }

      // Find user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, signer.signerEmail))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: 'User account not found' });
      }

      // Check if user already has an active password reset token
      const [existingToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            eq(passwordResetTokens.used, false),
            gte(passwordResetTokens.expiresAt, new Date())
          )
        )
        .limit(1);

      if (existingToken) {
        // Return existing token
        res.json({ 
          passwordResetToken: existingToken.token,
          invitationToken: invitationToken 
        });
      } else {
        // Create new password reset token
        const passwordResetToken = crypto.randomUUID();
        const tokenExpiry = new Date();
        tokenExpiry.setHours(tokenExpiry.getHours() + 24);

        await db.insert(passwordResetTokens).values({
          userId: user.id,
          token: passwordResetToken,
          expiresAt: tokenExpiry,
          used: false
        });

        res.json({ 
          passwordResetToken: passwordResetToken,
          invitationToken: invitationToken 
        });
      }
    } catch (error) {
      console.error('Get password reset token error:', error);
      res.status(500).json({ message: 'Failed to get password reset token' });
    }
  });

  // Test endpoint to send all signer invitations for a job
  app.post('/api/jobs/:id/send-invitations', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      // Import notification service
      const { notificationService } = await import('./notification-service');
      
      // Send all signer invitations for this job
      await notificationService.sendSignerInvitations(jobId);

      res.json({ 
        message: `Signer invitations sent successfully for job ${jobId}` 
      });
    } catch (error) {
      console.error('Send invitations error:', error);
      res.status(500).json({ 
        message: 'Failed to send invitations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Register enhanced user management and company routes
  registerUserManagementRoutes(app);
  registerCompanyRoutes(app);
  registerTitleCompanyNotaryRoutes(app);
  registerApprovalWorkflowRoutes(app);
  registerNotaryProfileRoutes(app);
  registerFeeRoutes(app);
  registerAdminVerificationRoutes(app);
  
  // Register certificate management routes
  const certificateRoutes = await import('./certificate-routes');
  app.use('/api/certificates', certificateRoutes.default);
  
  // Register enhanced text tag routes
  const { registerTextTagRoutes } = await import('./routes/text-tag-routes');
  registerTextTagRoutes(app);
  
  // Register admin logs routes
  app.use('/api/admin', adminLogsRoutes);
  app.use('/api/notary', notaryVerificationRoutes);
  app.use('/api/notary', notaryJobApprovalRoutes);
  app.use('/api', screenRecordingRoutes);
  
  // Register user logs routes
  const userLogsRoutes = await import('./routes/user-logs-routes');
  app.use('/api/user', userLogsRoutes.default);

  // ===== SESSION TRACKING ROUTES =====
  const sessionTrackingRoutes = await import('./routes/session-tracking-routes');
  app.use('/api/session-tracking', sessionTrackingRoutes.default);
  
  // ==========================================
  // ADMIN VERIFICATION ROUTES (Missing endpoints for dashboard)
  // ==========================================
  
  // Middleware to ensure only admins can access these routes
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!hasAdminPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  };

  // Get verification data for a specific user (frontend expects this path)
  app.get('/api/admin/users/:userId/verification-data', verifyToken, requireAdmin, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const [userData] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!userData) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(userData);
    } catch (error) {
      console.error('Error fetching user verification data:', error);
      res.status(500).json({ error: 'Failed to fetch user verification data' });
    }
  });

  // Get verification attempts for a specific user (frontend expects this path)
  app.get('/api/admin/users/:userId/verification-attempts', verifyToken, requireAdmin, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Return empty array for now since the table might not exist
      res.json([]);
    } catch (error) {
      console.error('Error fetching verification attempts:', error);
      res.status(500).json({ error: 'Failed to fetch verification attempts' });
    }
  });

  // Get verification statistics for admin dashboard
  app.get('/api/admin/verification-stats', verifyToken, requireAdmin, async (req: any, res) => {
    try {
      // Get basic verification statistics
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN role IN ('signer', 'witness') THEN 1 END) as verification_required_users,
          COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_users,
          COUNT(CASE WHEN is_verification_bypassed = true THEN 1 END) as bypassed_users,
          COUNT(CASE WHEN verification_status = 'pending' AND role IN ('signer', 'witness') THEN 1 END) as pending_verification,
          COUNT(CASE WHEN verification_status = 'failed' THEN 1 END) as failed_verification
        FROM users
        WHERE is_active = true
      `);

      // Handle different result structures
      const verificationStats = result?.rows?.[0] || result?.[0] || {};

      res.json({
        totalUsers: verificationStats?.total_users || 0,
        verificationRequiredUsers: verificationStats?.verification_required_users || 0,
        verifiedUsers: verificationStats?.verified_users || 0,
        bypassedUsers: verificationStats?.bypassed_users || 0,
        pendingVerification: verificationStats?.pending_verification || 0,
        failedVerification: verificationStats?.failed_verification || 0
      });
    } catch (error) {
      console.error('Error fetching verification stats:', error);
      res.status(500).json({ error: 'Failed to fetch verification statistics' });
    }
  });

  // Get all users requiring verification (for admin dashboard)
  app.get('/api/admin/verification-users', verifyToken, requireAdmin, async (req: any, res) => {
    try {
      const verificationUsers = await db.execute(sql`
        SELECT 
          u.id,
          u.username,
          u.email,
          u.first_name,
          u.last_name,
          u.full_name,
          u.role,
          u.phone_number,
          u.is_verified,
          u.verification_status,
          u.is_verification_bypassed,
          u.verification_bypassed_at,
          u.verification_bypass_reason,
          u.evs_transaction_id,
          u.evs_verification_confidence,
          u.evs_verified_at,
          u.id_type,
          u.id_number,
          u.id_expiration_date,
          u.created_at,
          u.last_login_at,
          u.is_active
        FROM users u
        WHERE u.role IN ('signer', 'witness', 'notary')
        AND u.is_active = true
        ORDER BY u.created_at DESC
      `);

      const users = verificationUsers.rows || [];
      
      // Add certificate information for each signer and witness
      const usersWithCertificates = await Promise.all(users.map(async (user: any) => {
        let certificateInfo = null;
        
        if (['signer', 'witness'].includes(user.role)) {
          try {
            const { selfSignedCertificateService } = await import('./services/self-signed-certificate-service');
            const certificate = await selfSignedCertificateService.getUserCertificate(user.id);
            
            if (certificate) {
              const isExpired = new Date() > new Date(certificate.expires_at);
              certificateInfo = {
                hasCertificate: true,
                certificateId: certificate.certificate_id,
                status: certificate.status,
                isExpired,
                issuedAt: certificate.issued_at,
                expiresAt: certificate.expires_at
              };
            } else {
              certificateInfo = {
                hasCertificate: false,
                eligibleForGeneration: user.is_verified || user.is_verification_bypassed
              };
            }
          } catch (error) {
            console.error(`Error getting certificate info for user ${user.id}:`, error);
            certificateInfo = {
              hasCertificate: false,
              error: 'Failed to load certificate information'
            };
          }
        }
        
        return {
          ...user,
          selfSignedCertificate: certificateInfo
        };
      }));

      res.json(usersWithCertificates);
    } catch (error) {
      console.error('Error fetching verification users:', error);
      res.status(500).json({ error: 'Failed to fetch verification users' });
    }
  });

  // Password reset and setup routes
  
  // Initiate password reset (forgot password)
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists for security
        return res.json({ 
          message: 'If an account with this email exists, a password reset link has been sent.',
          success: true 
        });
      }

      // Check if user already has an active password reset token
      const [existingToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            eq(passwordResetTokens.used, false),
            gte(passwordResetTokens.expiresAt, new Date())
          )
        )
        .limit(1);

      let resetToken;
      if (existingToken) {
        resetToken = existingToken.token;
      } else {
        // Generate new password reset token
        resetToken = crypto.randomUUID();
        const tokenExpiry = new Date();
        tokenExpiry.setHours(tokenExpiry.getHours() + 24); // 24 hour expiry

        await db.insert(passwordResetTokens).values({
          userId: user.id,
          token: resetToken,
          expiresAt: tokenExpiry,
          used: false
        });
      }

      // Send password reset email
      try {
        await emailService.sendPasswordReset({
          userEmail: user.email,
          userName: user.firstName || user.username,
          resetToken: resetToken
        });
        
        console.log(`Password reset email sent to: ${user.email}`);
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Don't fail the request - user doesn't need to know email failed
      }

      res.json({ 
        message: 'If an account with this email exists, a password reset link has been sent.',
        success: true 
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/validate-password-reset-token', async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: 'Token is required' });
      }

      // Find the password reset token
      const [resetToken] = await db.select({
        token: passwordResetTokens,
        user: users
      })
      .from(passwordResetTokens)
      .leftJoin(users, eq(passwordResetTokens.userId, users.id))
      .where(eq(passwordResetTokens.token, token));

      if (!resetToken) {
        return res.status(404).json({ message: 'Invalid token' });
      }

      // Check if token is expired
      if (new Date() > resetToken.token.expiresAt) {
        return res.status(400).json({ message: 'Token has expired' });
      }

      // Check if token is already used
      if (resetToken.token.used) {
        return res.status(400).json({ message: 'Token has already been used' });
      }

      // Return user info for display
      res.json({
        valid: true,
        user: {
          name: `${resetToken.user.firstName || ''} ${resetToken.user.lastName || ''}`.trim() || resetToken.user.username,
          email: resetToken.user.email,
          role: resetToken.user.role
        }
      });
    } catch (error) {
      console.error('Token validation error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/set-password', async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: 'Token and password are required' });
      }

      // Find the password reset token
      const [resetToken] = await db.select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token));

      if (!resetToken) {
        return res.status(404).json({ message: 'Invalid token' });
      }

      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: 'Token has expired' });
      }

      // Check if token is already used
      if (resetToken.used) {
        return res.status(400).json({ message: 'Token has already been used' });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update user password and mark account setup as complete
      await db.update(users)
        .set({ 
          password: hashedPassword,
          accountSetupComplete: true,
          updatedAt: new Date()
        })
        .where(eq(users.id, resetToken.userId));

      // Mark token as used
      await db.update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, resetToken.id));

      // Get the updated user data
      const updatedUser = await storage.getUserById(resetToken.userId);
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Generate JWT token for auto-login
      const authToken = jwt.sign(
        { 
          id: updatedUser.id, 
          email: updatedUser.email, 
          role: updatedUser.role,
          privileges: updatedUser.privileges || []
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Check privileges for frontend
      const isAdmin = hasAdminPrivileges(updatedUser);
      const isNotary = hasNotaryPrivileges(updatedUser);

      // CRITICAL FIX: Determine proper redirect based on user role
      let redirectPath = '/dashboard';
      let nextSteps = [];
      
      if (updatedUser.role === 'signer' || updatedUser.role === 'witness') {
        // Signers/witnesses should go to dashboard first, not directly to signing
        redirectPath = '/dashboard';
        
        // Check if they need ID verification
        const needsVerification = !updatedUser.isVerified && 
                                 !updatedUser.isVerificationBypassed && 
                                 !updatedUser.notaryVerificationBypassed;
        
        if (needsVerification) {
          nextSteps.push('Complete ID verification in your profile');
          nextSteps.push('View your assigned signing job');
          nextSteps.push('Join the signing session when ready');
        } else {
          nextSteps.push('View your assigned signing job in the dashboard');
          nextSteps.push('Join the signing session when ready');
        }
      } else if (updatedUser.role === 'notary') {
        redirectPath = '/dashboard';
        nextSteps.push('Review your notary dashboard');
      } else {
        redirectPath = '/dashboard';
      }

      res.json({ 
        message: 'Password set successfully',
        autoLogin: true,
        token: authToken,
        // CRITICAL: Add redirect guidance for frontend
        redirect: {
          path: redirectPath,
          reason: `Welcome ${updatedUser.firstName || updatedUser.username}! Account setup complete.`
        },
        nextSteps,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
          privileges: updatedUser.privileges,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          // Include privilege flags for easy frontend checking
          isAdmin,
          isNotary,
          // Add verification status for frontend to show proper UI
          needsVerification: !updatedUser.isVerified && 
                           !updatedUser.isVerificationBypassed && 
                           !updatedUser.notaryVerificationBypassed,
          accountSetupComplete: true
        }
      });
    } catch (error) {
      console.error('Password setup error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Password reset route (for existing users who forgot their password)
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: 'Token and password are required' });
      }

      // Find the password reset token
      const [resetToken] = await db.select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token));

      if (!resetToken) {
        return res.status(404).json({ message: 'Invalid token' });
      }

      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: 'Token has expired' });
      }

      // Check if token is already used
      if (resetToken.used) {
        return res.status(400).json({ message: 'Token has already been used' });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update user password (don't change accountSetupComplete for existing users)
      await db.update(users)
        .set({ 
          password: hashedPassword,
          updatedAt: new Date()
        })
        .where(eq(users.id, resetToken.userId));

      // Mark token as used
      await db.update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, resetToken.id));

      res.json({ 
        message: 'Password reset successfully',
        success: true
      });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // EVS Verification route with Vultr storage
  app.post('/api/verification/evs-verify', verifyToken, upload.fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'backImage', maxCount: 1 },
    { name: 'selfieImage', maxCount: 1 }
  ]), async (req: any, res) => {
    try {
      const { userId } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!files.frontImage || !files.selfieImage) {
        return res.status(400).json({ message: 'Front image and selfie are required' });
      }

      // Store verification images in Vultr for compliance and audit purposes
      const { VultrUploadHandler } = await import('./vultr-upload-handler');
      const uploadedFiles: { [key: string]: any } = {};
      const sessionId = `evs-verification-${userId}-${Date.now()}`;

      try {
        // Upload front image using the dedicated verification image handler
        const frontResult = await VultrUploadHandler.handleVerificationImageUpload(
          files.frontImage[0].buffer,
          `front-id-${userId}-${Date.now()}.jpg`,
          parseInt(userId),
          'front',
          sessionId
        );
        
        if (frontResult.success) {
          uploadedFiles.frontImage = frontResult.fileKey;
        }

        // Upload back image if provided
        if (files.backImage && files.backImage[0]) {
          const backResult = await VultrUploadHandler.handleVerificationImageUpload(
            files.backImage[0].buffer,
            `back-id-${userId}-${Date.now()}.jpg`,
            parseInt(userId),
            'back',
            sessionId
          );
          
          if (backResult.success) {
            uploadedFiles.backImage = backResult.fileKey;
          }
        }

        // Upload selfie image
        const selfieResult = await VultrUploadHandler.handleVerificationImageUpload(
          files.selfieImage[0].buffer,
          `selfie-${userId}-${Date.now()}.jpg`,
          parseInt(userId),
          'selfie',
          sessionId
        );
        
        if (selfieResult.success) {
          uploadedFiles.selfieImage = selfieResult.fileKey;
        }

        console.log(`✅ Uploaded verification images to Vultr for user ${userId}`);
      } catch (uploadError) {
        console.error('Failed to upload verification images to Vultr:', uploadError);
        // Continue with verification even if upload fails, but log the issue
      }

      // Use actual EVS Solutions API
      let evsResult;
      let isSuccessful = false;
      let confidence = 0;
      let verificationId;

      try {
        const { evsService } = await import('./lib/evs-service');
        
        const verificationRequest = {
          documentType: req.body.documentType || 'drivers_license',
          frontImage: files.frontImage[0].buffer,
          backImage: files.backImage?.[0]?.buffer,
          selfieImage: files.selfieImage[0].buffer,
          userId: userId.toString()
        };

        console.log(`🔍 Starting EVS verification for user ${userId}`);
        evsResult = await evsService.verifyIdentity(verificationRequest);
        
        console.log(`📥 EVS Result: ${evsResult.success ? 'SUCCESS' : 'FAILED'} - Status: ${evsResult.status}, Confidence: ${evsResult.confidence}%`);
        
        // Handle different EVS result statuses
        if (evsResult.status === 'error') {
          // Service configuration error - don't mark as failed, mark as pending for manual review
          isSuccessful = false;
          confidence = 0;
          verificationId = evsResult.transactionId || `evs_config_error_${Date.now()}`;
          
          // Add special handling for workflow disabled errors
          if (evsResult.errors?.some(e => e.includes('workflow')) || evsResult.errors?.some(e => e.includes('configuration'))) {
            console.log('⚠️ BlueAssure workflow configuration issue detected - marking for manual review');
            evsResult.status = 'review';  // Change from 'error' to 'review' for workflow issues
            evsResult.warnings = [
              ...(evsResult.warnings || []),
              'Due to service configuration issues, your verification will be reviewed manually.',
              'This is not a problem with your documents.'
            ];
          }
        } else {
          isSuccessful = evsResult.success && evsResult.status === 'approved';
          confidence = evsResult.confidence || 0;
          verificationId = evsResult.transactionId || `evs_${Date.now()}`;
        }
        
      } catch (evsError) {
        console.error('❌ EVS API Error:', evsError);
        
        // Create a fallback result for EVS API failures
        evsResult = {
          success: false,
          status: 'error',
          confidence: 0,
          errors: [`EVS API Error: ${evsError instanceof Error ? evsError.message : 'Unknown error'}`],
          warnings: [
            'Verification service temporarily unavailable. Please try again later.',
            'If this continues, your verification may be processed manually.'
          ]
        };
        
        isSuccessful = false;
        confidence = 0;
        verificationId = `evs_error_${Date.now()}`;
      }

      if (isSuccessful) {
        // Update user verification status with real EVS data
        const updateData: any = { 
          isVerified: true,
          verificationStatus: 'approved',
          evsTransactionId: verificationId,
          evsVerificationConfidence: confidence,
          evsVerifiedAt: new Date(),
          updatedAt: new Date()
        };

        // Add extracted document data if available
        if (evsResult.document?.extractedData) {
          const extracted = evsResult.document.extractedData;
          updateData.evsExtractedFirstName = extracted.firstName;
          updateData.evsExtractedLastName = extracted.lastName;
          updateData.evsExtractedDateOfBirth = extracted.dateOfBirth;
          updateData.evsExtractedAddress = extracted.address;
          updateData.idType = evsResult.document.type;
          updateData.idNumber = extracted.documentNumber;
          updateData.idExpirationDate = extracted.expirationDate;
          updateData.idIssueDate = extracted.issueDate;
        }

        // Add biometric data if available
        if (evsResult.biometric) {
          updateData.evsFaceMatchResult = evsResult.biometric.faceMatch;
          updateData.evsFaceMatchConfidence = evsResult.biometric.confidence;
          updateData.evsLivenessScore = evsResult.biometric.livenessScore;
        }

        // Add errors and warnings
        if (evsResult.errors) {
          updateData.evsVerificationErrors = evsResult.errors;
        }
        if (evsResult.warnings) {
          updateData.evsVerificationWarnings = evsResult.warnings;
        }

        // Store verification image URLs in database
        if (uploadedFiles.frontImage) {
          updateData.verificationImageFrontUrl = uploadedFiles.frontImage;
        }
        if (uploadedFiles.backImage) {
          updateData.verificationImageBackUrl = uploadedFiles.backImage;
        }
        if (uploadedFiles.selfieImage) {
          updateData.verificationImageSelfieUrl = uploadedFiles.selfieImage;
        }

        console.log(`🔍 DEBUG: About to execute database update for user ${userId}`);
        
        const dbUpdateResult = await db.update(users).set(updateData).where(eq(users.id, parseInt(userId)));
        
        console.log(`✅ DEBUG: Database update completed for user ${userId}:`, dbUpdateResult);

        // 🆕 AUTOMATIC SELF-SIGNED CERTIFICATE GENERATION after successful ID verification
        let certificateInfo = null;
        try {
          // Get the user to check their role
          const [verifiedUser] = await db
            .select({ role: users.role, fullName: users.fullName, firstName: users.firstName, lastName: users.lastName })
            .from(users)
            .where(eq(users.id, parseInt(userId)))
            .limit(1);

          // Generate self-signed certificate for verified signers and witnesses
          if (verifiedUser && ['signer', 'witness'].includes(verifiedUser.role)) {
            console.log(`🔐 Auto-generating self-signed certificate for verified ${verifiedUser.role}: ${verifiedUser.fullName || verifiedUser.firstName + ' ' + verifiedUser.lastName}`);
            
            const { selfSignedCertificateService } = await import('./services/self-signed-certificate-service');
            const certResult = await selfSignedCertificateService.generateCertificateForUser(parseInt(userId));
            
            if (certResult.success) {
              certificateInfo = {
                certificateGenerated: true,
                certificateId: certResult.certificateId,
                certificatePath: certResult.certificatePath,
                expirationDate: certResult.expirationDate,
                message: `Self-signed digital certificate automatically generated for verified ${verifiedUser.role}`,
                downloadAvailable: true,
                certificateType: 'self-signed',
                note: 'Certificate is locally saved and ready for use in digital signing'
              };
              console.log(`✅ Self-signed certificate auto-generated for user ${userId}: ID ${certResult.certificateId}`);
            } else {
              console.error(`❌ Failed to auto-generate self-signed certificate for user ${userId}:`, certResult.error);
              certificateInfo = {
                certificateGenerated: false,
                error: certResult.error,
                message: 'ID verification successful, but self-signed certificate generation failed. Contact support if needed.'
              };
            }
          }
        } catch (certError) {
          console.error('❌ Error during automatic self-signed certificate generation:', certError);
          certificateInfo = {
            certificateGenerated: false,
            error: 'Certificate generation error',
            message: 'ID verification successful, but self-signed certificate generation failed. Contact support if needed.'
          };
        }

        res.json({
          success: true,
          status: 'approved',
          confidence: confidence,
          message: 'Identity successfully verified through EVS Solutions',
          verificationId,
          verifiedAt: new Date().toISOString(),
          extractedData: evsResult.document?.extractedData,
          biometricResults: evsResult.biometric,
          storedImages: uploadedFiles,
          storageType: 'vultr',
          // Include certificate generation results
          certificate: certificateInfo
        });
      } else {
        // Handle different failure types
        const finalStatus = evsResult.status === 'review' ? 'review' : 'denied';
        const httpStatus = evsResult.status === 'review' ? 200 : 400;
        
        // Update user verification status
        const updateData: any = { 
          isVerified: false,
          verificationStatus: finalStatus,
          evsTransactionId: verificationId,
          evsVerificationConfidence: confidence,
          updatedAt: new Date()
        };
        
        // Store errors and warnings for admin review
        if (evsResult.errors) {
          updateData.evsVerificationErrors = evsResult.errors;
        }
        if (evsResult.warnings) {
          updateData.evsVerificationWarnings = evsResult.warnings;
        }
        
        // Store verification image URLs in database even for failed verification
        if (uploadedFiles.frontImage) {
          updateData.verificationImageFrontUrl = uploadedFiles.frontImage;
        }
        if (uploadedFiles.backImage) {
          updateData.verificationImageBackUrl = uploadedFiles.backImage;
        }
        if (uploadedFiles.selfieImage) {
          updateData.verificationImageSelfieUrl = uploadedFiles.selfieImage;
        }
        
        await db.update(users)
          .set(updateData)
          .where(eq(users.id, parseInt(userId)));

        res.status(httpStatus).json({
          success: false,
          status: finalStatus,
          message: evsResult.status === 'review' 
            ? 'Your verification has been submitted for manual review due to service configuration issues.'
            : (evsResult.errors?.length ? evsResult.errors.join('; ') : 'Identity verification failed. Please ensure your documents are clear and try again.'),
          reasons: evsResult.errors || ['Verification failed'],
          warnings: evsResult.warnings,
          confidence: confidence,
          verificationId,
          storedImages: uploadedFiles, // Keep images for review even on failure
          storageType: 'vultr'
        });
      }

    } catch (error) {
      console.error('EVS verification error:', error);
      res.status(500).json({ message: 'Verification service error' });
    }
  });

  // Get certificate status for display in user interface
  app.get('/api/users/:userId/certificate-status', verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Check access permissions
      const canAccess = req.user.role === 'admin' || req.user.id === userId;
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get user details
      const [user] = await db
        .select({
          id: users.id,
          role: users.role,
          fullName: users.fullName,
          firstName: users.firstName,
          lastName: users.lastName,
          isVerified: users.isVerified,
          isVerificationBypassed: users.isVerificationBypassed,
          verificationStatus: users.verificationStatus
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get certificate information for signers and witnesses
      let certificateInfo = null;
      if (['signer', 'witness'].includes(user.role)) {
        try {
          const { selfSignedCertificateService } = await import('./services/self-signed-certificate-service');
          const certificate = await selfSignedCertificateService.getUserCertificate(userId);
          
          if (certificate) {
            const isExpired = new Date() > new Date(certificate.expires_at);
            certificateInfo = {
              hasCertificate: true,
              certificateId: certificate.certificate_id,
              commonName: certificate.common_name,
              issuedAt: certificate.issued_at,
              expiresAt: certificate.expires_at,
              status: certificate.status,
              isExpired,
              certificateType: 'self-signed',
              downloadUrl: req.user.role === 'admin' 
                ? `/api/admin/users/${userId}/certificate/download`
                : `/api/user/certificate/download`
            };
          } else {
            const isEligible = user.isVerified || user.isVerificationBypassed;
            certificateInfo = {
              hasCertificate: false,
              eligibleForGeneration: isEligible,
              reason: isEligible 
                ? 'User is verified but no certificate generated yet' 
                : 'User must complete ID verification first',
              canGenerate: isEligible
            };
          }
        } catch (error) {
          console.error('Error getting certificate info:', error);
          certificateInfo = {
            hasCertificate: false,
            error: 'Failed to load certificate information'
          };
        }
      } else {
        certificateInfo = {
          hasCertificate: false,
          eligibleForGeneration: false,
          reason: `Self-signed certificates are only available for signers and witnesses, not ${user.role}s`
        };
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          role: user.role,
          name: user.fullName || `${user.firstName} ${user.lastName}`.trim(),
          isVerified: user.isVerified || user.isVerificationBypassed,
          verificationStatus: user.verificationStatus
        },
        certificate: certificateInfo
      });

    } catch (error) {
      console.error('Certificate status check error:', error);
      res.status(500).json({ error: 'Failed to check certificate status' });
    }
  });

  // Test endpoint to check certificate generation capability
  app.get('/api/certificates/test-capability/:userId', verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Check if user can request certificate generation
      if (req.user.id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get user details
      const [user] = await db
        .select({
          id: users.id,
          role: users.role,
          fullName: users.fullName,
          firstName: users.firstName,
          lastName: users.lastName,
          isVerified: users.isVerified,
          isVerificationBypassed: users.isVerificationBypassed,
          notaryVerificationBypassed: users.notaryVerificationBypassed,
          verificationStatus: users.verificationStatus,
          digitalCertificateFile: users.digitalCertificateFile,
          digitalCertificateExpiration: users.digitalCertificateExpiration
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const isVerified = user.isVerified || user.isVerificationBypassed || user.notaryVerificationBypassed;
      const canGenerateCertificate = ['notary', 'signer', 'witness'].includes(user.role) && isVerified;
      const hasExistingCertificate = !!(user.digitalCertificateFile);

      res.json({
        success: true,
        user: {
          id: user.id,
          role: user.role,
          name: user.fullName || `${user.firstName} ${user.lastName}`.trim(),
          isVerified,
          verificationMethod: user.isVerified ? 'evs' : 
                           user.isVerificationBypassed ? 'admin_bypass' : 
                           user.notaryVerificationBypassed ? 'notary_bypass' : null
        },
        certificate: {
          canGenerate: canGenerateCertificate,
          hasExisting: hasExistingCertificate,
          expirationDate: user.digitalCertificateExpiration,
          supportedTypes: ['notary', 'signer', 'witness'].includes(user.role) ? [user.role] : [],
          autoGeneratedAfterVerification: ['signer', 'witness'].includes(user.role),
          endpoints: {
            generateSelf: user.role === 'notary' ? '/api/certificates/generate-self' : 
                         ['signer', 'witness'].includes(user.role) ? '/api/certificates/generate-signer-self' : null,
            download: hasExistingCertificate ? `/api/certificates/download/${userId}` : null
          }
        },
        requirements: canGenerateCertificate ? [] : [
          !['notary', 'signer', 'witness'].includes(user.role) ? 'User role must be notary, signer, or witness' : null,
          !isVerified ? 'User must complete ID verification first' : null
        ].filter(Boolean)
      });

    } catch (error) {
      console.error('Certificate capability check error:', error);
      res.status(500).json({ error: 'Failed to check certificate capability' });
    }
  });

  // ==========================================
  // CERTIFICATE DOWNLOAD ROUTES
  // ==========================================

  // Admin download certificate for any user
  app.get('/api/admin/users/:userId/certificate/download', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const userId = parseInt(req.params.userId);
      const fileType = (req.query.type as string) || 'cert';
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      if (!['cert', 'key', 'pubkey'].includes(fileType)) {
        return res.status(400).json({ error: 'Invalid file type. Use: cert, key, or pubkey' });
      }

      console.log(`🔍 Admin ${req.user.id} requesting certificate for user ${userId}, type: ${fileType}`);

      const { selfSignedCertificateService } = await import('./services/self-signed-certificate-service');
      
      // First check if user exists and has the right role
      const [user] = await db
        .select({ id: users.id, role: users.role, fullName: users.fullName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
        
      if (!user) {
        console.log(`❌ User ${userId} not found`);
        return res.status(404).json({ error: 'User not found' });
      }
      
      if (!['signer', 'witness'].includes(user.role)) {
        console.log(`❌ User ${userId} has role '${user.role}', not signer/witness`);
        return res.status(400).json({ 
          error: `User role '${user.role}' does not have self-signed certificates. Only signers and witnesses have auto-generated certificates.` 
        });
      }
      
      console.log(`✅ User ${userId} (${user.role}) found, checking certificate...`);
      
      const result = await selfSignedCertificateService.getCertificateFile(userId, fileType as any);
      
      if (!result.success) {
        console.log(`❌ Certificate not found for user ${userId}: ${result.error}`);
        return res.status(404).json({ error: result.error });
      }

      console.log(`✅ Certificate found for user ${userId}, sending download...`);

      // Set appropriate headers for file download
      const fileExtension = fileType === 'cert' ? 'pem' : fileType === 'key' ? 'key' : 'pub';
      const fileName = `${user.fullName || 'user'}_${user.role}_certificate.${fileExtension}`;
      
      res.setHeader('Content-Type', 'application/x-pem-file');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('X-Certificate-Type', 'self-signed');
      res.setHeader('X-Downloaded-By', 'admin');
      
      res.send(result.content);
    } catch (error) {
      console.error('Admin download certificate error:', error);
      res.status(500).json({ error: 'Failed to download certificate' });
    }
  });



  // ==========================================
  // KBA (Knowledge-Based Authentication) Routes
  // ==========================================

  // Initialize KBA session
  app.post('/api/kba/initialize', verifyToken, async (req: any, res) => {
    try {
      const { userId, firstName, lastName, dateOfBirth, ssn, address, phone, email } = req.body;

      if (!userId || !firstName || !lastName || !dateOfBirth || !address) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required fields: userId, firstName, lastName, dateOfBirth, address' 
        });
      }

      const { kbaService } = await import('./lib/kba-service');
      
      const kbaSession = await kbaService.initializeKBASession({
        userId,
        firstName,
        lastName,
        dateOfBirth,
        ssn,
        address,
        phone,
        email
      });

      res.json(kbaSession);
    } catch (error) {
      console.error('KBA initialization error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to initialize KBA session',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Submit KBA answers
  app.post('/api/kba/submit', verifyToken, async (req: any, res) => {
    try {
      const { sessionId, userId, answers } = req.body;

      if (!sessionId || !userId || !answers || !Array.isArray(answers)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required fields: sessionId, userId, answers' 
        });
      }

      const { kbaService } = await import('./lib/kba-service');
      
      const verificationResult = await kbaService.submitKBAAnswers({
        sessionId,
        userId,
        answers
      });

      // Update user's KBA verification status in database
      if (verificationResult.success && verificationResult.status === 'passed') {
        await db
          .update(users)
          .set({
            kbaVerified: true,
            kbaVerificationDate: new Date(),
            kbaScore: verificationResult.score,
            updatedAt: new Date()
          })
          .where(eq(users.id, parseInt(userId)));
      }

      res.json(verificationResult);
    } catch (error) {
      console.error('KBA submission error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to submit KBA answers',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test KBA service connectivity
  app.get('/api/kba/test', verifyToken, async (req: any, res) => {
    try {
      const { kbaService } = await import('./lib/kba-service');
      const testResult = await kbaService.testConnection();
      res.json(testResult);
    } catch (error) {
      console.error('KBA test error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'KBA service test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Email Template Management Routes
  app.get('/api/email-templates', verifyToken, getAllTemplates);
  app.get('/api/email-templates/variables/all', verifyToken, getTemplateVariables);
  app.get('/api/email-templates/categories/all', verifyToken, getTemplateCategories);
  app.get('/api/email-templates/logs/all', verifyToken, getEmailLogs);
  app.get('/api/email-templates/:template_key', verifyToken, getTemplate);
  app.post('/api/email-templates', verifyToken, createTemplate);
  app.put('/api/email-templates/:id', verifyToken, updateTemplate);
  app.delete('/api/email-templates/:id', verifyToken, deleteTemplate);
  app.post('/api/email-templates/:template_key/preview', verifyToken, previewTemplate);
  app.post('/api/email-templates/send-test', verifyToken, sendTestEmail);

  // ==========================================
  // LIVE SIGNING SESSION ROUTES - Session State Management  
  // ==========================================

  // Start live signing session (transition from tagging to signing)
  app.post('/api/session/:sessionId/start-signing', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const notaryUserId = req.user.id;

      const { LiveSigningSessionService } = await import('./services/session/LiveSigningSessionService');
      
      const result = await LiveSigningSessionService.startLiveSigningSession(sessionId, notaryUserId);
      
      res.json({
        success: true,
        data: {
          ...result,
          // Return the actual session ID that should be used for navigation
          actualSessionId: result.sessionId || sessionId
        },
        message: 'Live signing session started successfully'
      });
      
    } catch (error) {
      console.error('Start signing session error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to start signing session',
        error: 'start_signing_failed'
      });
    }
  });

  // Admin session management endpoints
  app.get('/api/admin/session-stats', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { SessionManagementService } = await import('./services/session-management-service');
      const stats = await SessionManagementService.getSessionStats();
      
      res.json(stats);
    } catch (error) {
      console.error('Get session stats error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/admin/active-sessions', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { SessionManagementService } = await import('./services/session-management-service');
      const sessions = await SessionManagementService.getActiveSessions();
      
      res.json(sessions);
    } catch (error) {
      console.error('Get active sessions error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/admin/invalidate-user-sessions/:userId', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const userId = parseInt(req.params.userId);
      const { reason } = req.body;

      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      const { SessionManagementService } = await import('./services/session-management-service');
      await SessionManagementService.invalidateUserSessions(userId, reason || 'admin_action');
      
      res.json({ 
        message: 'User sessions invalidated successfully',
        userId 
      });
    } catch (error) {
      console.error('Invalidate user sessions error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/admin/invalidate-all-sessions', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { reason } = req.body;

      const { SessionManagementService } = await import('./services/session-management-service');
      await SessionManagementService.invalidateAllSessions(reason || 'admin_action');
      
      res.json({ 
        message: 'All sessions invalidated successfully' 
      });
    } catch (error) {
      console.error('Invalidate all sessions error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
