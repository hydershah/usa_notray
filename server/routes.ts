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
import screenRecordingRoutes from "./routes/screen-recording-api";
import { auditLoggingService } from "./services/audit-logging-service";
import { notificationService } from "./notification-service";
import { verifyToken, hasAdminPrivileges, hasNotaryPrivileges, type AuthUser } from "./auth";
import { cacheAdminData, cacheUserData, cacheCompanyData, cacheJobData } from "./middleware/cache-middleware";
import { documentTags, USER_COLORS } from '../shared/schema'; // Adjust the path to your schema file
import { getUserColor } from '../server/utilis/colorUtils'; // Adjust path as needed
import { and, eq } from 'drizzle-orm'; // Ensure these are imported
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

import { registerAuthenticationRoutes } from "./routes/authenticationRoute";
import { registerJobManagementRoutes } from "./routes/jobManagementRoute";
import { paymentRoutes } from "./routes/paymentRoute";
import { registerInvoicesRoutes } from "./routes/invoiceRoute";
import { closingTypeRoutes } from "./routes/closingTypeRoute";
import { participantRoutes } from "./routes/participantRoute";
import { jonDocumentManagementRoutes } from "./routes/jobDocumentManagementRoute";
import { calenderManagementRoutes } from "./routes/calenderManagementRoute";
import { randonNotaryRoutes } from "./routes/randomNotary";

export async function registerRoutes(app: Express): Promise<Server> {

  registerAuthenticationRoutes(app)
  registerJobManagementRoutes(app)
  paymentRoutes(app)
  registerInvoicesRoutes(app)
  closingTypeRoutes(app)
  participantRoutes(app)
  jonDocumentManagementRoutes(app)
  calenderManagementRoutes(app)
  randonNotaryRoutes(app)

  registerUserManagementRoutes(app);
  registerCompanyRoutes(app);
  registerTitleCompanyNotaryRoutes(app);
  registerApprovalWorkflowRoutes(app);
  registerNotaryProfileRoutes(app);
  registerFeeRoutes(app);
  registerAdminVerificationRoutes(app);

  app.get('/', (req, res, next) => {
    if (process.env.NODE_ENV === 'production' && process.env.SERVE_STATIC_FILES !== 'false') {
      return next();
    }
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
    res.status(204).send(); 
  });

  app.use((req: any, res: any, next: any) => {
    auditLoggingService.auditMiddleware()(req, res, next);
  });

  // // Authentication routes
  // app.post('/api/auth/login', authLimiter, checkAccountLockout, async (req, res) => {
  //   try {
  //     const { email, password, twoFactorCode } = req.body;
      
  //     if (!email || !password) {
  //       return res.status(400).json({ message: 'Email and password are required' });
  //     }

  //     const user = await storage.getUserByEmail(email);
  //     if (!user) {
  //       recordFailedLogin(email);
  //       return res.status(401).json({ message: 'Invalid credentials' });
  //     }

  //     const isValidPassword = await bcrypt.compare(password, user.password);
  //     if (!isValidPassword) {
  //       recordFailedLogin(email);
  //       return res.status(401).json({ message: 'Invalid credentials' });
  //     }

  //     // Check if 2FA is enabled for this user
  //     if (user.mfaEnabled) {
  //       if (!twoFactorCode) {
  //         // Return without token, indicating 2FA is required
  //         return res.json({
  //           requiresTwoFactor: true,
  //           message: 'Two-factor authentication is required'
  //         });
  //       }

  //       // Verify 2FA code
  //       if (!user.mfaSecret) {
  //         return res.status(500).json({ message: '2FA configuration error' });
  //       }

  //       const verified = speakeasy.totp.verify({
  //         secret: user.mfaSecret,
  //         encoding: 'base32',
  //         token: twoFactorCode,
  //         window: 2 // Allow 2 time steps before/after for clock drift
  //       });

  //       if (!verified) {
  //         recordFailedLogin(email);
  //         return res.status(401).json({ message: 'Invalid two-factor authentication code' });
  //       }
  //     }

  //     // Clear failed attempts on successful login
  //     clearFailedAttempts(email);

  //     // Generate token with privileges included
  //     const token = jwt.sign(
  //       { 
  //         id: user.id, 
  //         email: user.email, 
  //         role: user.role,
  //         privileges: user.privileges || []
  //       },
  //       JWT_SECRET,
  //       { expiresIn: '24h' }
  //     );

  //     // Check privileges for frontend
  //     const isAdmin = hasAdminPrivileges(user);
  //     const isNotary = hasNotaryPrivileges(user);

  //     res.json({
  //       token,
  //       user: {
  //         id: user.id,
  //         username: user.username,
  //         email: user.email,
  //         role: user.role,
  //         privileges: user.privileges,
  //         // Include privilege flags for easy frontend checking
  //         isAdmin,
  //         isNotary
  //       }
  //     });
  //   } catch (error) {
  //     console.error('Login error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.post('/api/auth/register', registrationLimiter, sanitizeHtml, preventSqlInjection, async (req, res) => {
  //   try {
  //     const userData = insertUserSchema.parse(req.body);
      
  //     // Check if user already exists
  //     const existingUser = await storage.getUserByEmail(userData.email as string);
  //     if (existingUser) {
  //       return res.status(400).json({ message: 'User already exists' });
  //     }

  //     // Hash password
  //     const hashedPassword = await bcrypt.hash(userData.password as string, 10);
      
  //     const user = await storage.createUser({
  //       ...userData,
  //       password: hashedPassword
  //     });

  //     // Invalidate users cache to ensure fresh data on next request
  //     try {
  //       await redisCache.delPattern(`admin:*`); // Clear admin caches
  //       await redisCache.delPattern(`user:*`); // Clear all user caches
  //       await redisCache.delPattern(`api:*users*`); // Clear users API cache
  //       console.log(`🧹 Invalidated user caches after registration of user ${user.id}`);
  //     } catch (cacheError) {
  //       console.error('Failed to invalidate cache after user registration:', cacheError);
  //       // Don't fail the request if cache invalidation fails
  //     }

  //     res.status(201).json({
  //       id: user.id,
  //       username: user.username,
  //       email: user.email,
  //       role: user.role
  //     });
  //   } catch (error) {
  //     console.error('Registration error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.get('/api/auth/me', verifyToken, async (req: any, res) => {
  //   try {
  //     const user = await storage.getUser(req.user.id);
  //     if (!user) {
  //       return res.status(404).json({ message: 'User not found' });
  //     }

  //     // Check privileges for frontend
  //     const isAdmin = hasAdminPrivileges(user);
  //     const isNotary = hasNotaryPrivileges(user);

  //     // Get company information for title company users
  //     let companyInfo = null;
  //     if (user.role === 'title_company' && user.companyId) {
  //       try {
  //         companyInfo = await storage.getCompany(user.companyId);
  //       } catch (error) {
  //         console.warn('Failed to fetch company info for user:', user.id, error);
  //       }
  //     }

  //     res.json({
  //       id: user.id,
  //       username: user.username,
  //       email: user.email,
  //       role: user.role,
  //       privileges: user.privileges,
  //       // Include privilege flags for easy frontend checking
  //       isAdmin,
  //       isNotary,
  //       notaryType: user.notaryType,
  //       // Include company information for title company users
  //       companyId: user.companyId,
  //       companyName: companyInfo?.companyName || null,
  //       firstName: user.firstName,
  //       lastName: user.lastName
  //     });
  //   } catch (error) {
  //     console.error('Get user error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.post('/api/auth/logout', verifyToken, async (req: any, res) => {
  //   try {
  //     // In a real application, you might want to:
  //     // 1. Add the token to a blacklist
  //     // 2. Update user's last logout time
  //     // 3. Log the logout event for audit purposes
      
  //     // For now, we'll just return success
  //     // The client will handle clearing localStorage
  //     res.json({ message: 'Logged out successfully' });
  //   } catch (error) {
  //     console.error('Logout error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // // ==========================================
  // // 2FA AUTHENTICATION ROUTES
  // // ==========================================

  // // Get 2FA status for current user
  // app.get('/api/auth/2fa/status', verifyToken, async (req: any, res) => {
  //   try {
  //     const user = await storage.getUser(req.user.id);
  //     if (!user) {
  //       return res.status(404).json({ message: 'User not found' });
  //     }

  //     res.json({
  //       enabled: user.mfaEnabled || false,
  //       hasSecret: !!(user.mfaSecret)
  //     });
  //   } catch (error) {
  //     console.error('2FA status error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // // Setup 2FA for current user
  // app.post('/api/auth/2fa/setup', verifyToken, async (req: any, res) => {
  //   try {
  //     const user = await storage.getUser(req.user.id);
  //     if (!user) {
  //       return res.status(404).json({ message: 'User not found' });
  //     }

  //     // Generate secret for TOTP
  //     const secret = speakeasy.generateSecret({
  //       name: `USA Notary (${user.email})`,
  //       issuer: 'USA Notary Platform',
  //       length: 32
  //     });

  //     // Generate QR code
  //     const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

  //     // Store secret in database (not enabled yet)
  //     await db.update(users)
  //       .set({ 
  //         mfaSecret: secret.base32 || '',
  //         updatedAt: new Date()
  //       })
  //       .where(eq(users.id, user.id));

  //     res.json({
  //       secret: secret.base32 || '',
  //       qrCode: qrCodeUrl,
  //       manualEntryKey: secret.base32 || '',
  //       backupCodes: [] // Could implement backup codes later
  //     });
  //   } catch (error) {
  //     console.error('2FA setup error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // // Verify 2FA token and enable 2FA
  // app.post('/api/auth/2fa/verify', verifyToken, async (req: any, res) => {
  //   try {
  //     const { token } = req.body;
      
  //     if (!token || token.length !== 6) {
  //       return res.status(400).json({ message: 'Invalid token format' });
  //     }

  //     const user = await storage.getUser(req.user.id);
  //     if (!user || !user.mfaSecret) {
  //       return res.status(400).json({ message: 'No 2FA secret found' });
  //     }

  //     // Verify the token
  //     const verified = speakeasy.totp.verify({
  //       secret: user.mfaSecret,
  //       encoding: 'base32',
  //       token: token,
  //       window: 2 // Allow 2 time steps before/after for clock drift
  //     });

  //     if (!verified) {
  //       return res.status(400).json({ message: 'Invalid verification code' });
  //     }

  //     // Enable 2FA
  //     await db.update(users)
  //       .set({ 
  //         mfaEnabled: true,
  //         updatedAt: new Date()
  //       })
  //       .where(eq(users.id, user.id));

  //     res.json({ 
  //       message: '2FA enabled successfully',
  //       enabled: true
  //     });
  //   } catch (error) {
  //     console.error('2FA verification error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // // Disable 2FA
  // app.post('/api/auth/2fa/disable', verifyToken, async (req: any, res) => {
  //   try {
  //     const { token, password } = req.body;
      
  //     const user = await storage.getUser(req.user.id);
  //     if (!user) {
  //       return res.status(404).json({ message: 'User not found' });
  //     }

  //     if (!user.mfaEnabled) {
  //       return res.status(400).json({ message: '2FA is not enabled' });
  //     }

  //     // Verify either 2FA token or password
  //     let verified = false;
      
  //     if (token && token.length === 6) {
  //       // Verify 2FA token
  //       verified = speakeasy.totp.verify({
  //         secret: user.mfaSecret,
  //         encoding: 'base32',
  //         token: token,
  //         window: 2
  //       });
  //     } else if (password) {
  //       // Verify password
  //       verified = await bcrypt.compare(password, user.password);
  //     }

  //     if (!verified) {
  //       return res.status(400).json({ message: 'Invalid verification code or password' });
  //     }

  //     // Disable 2FA
  //     await db.update(users)
  //       .set({ 
  //         mfaEnabled: false,
  //         mfaSecret: null,
  //         updatedAt: new Date()
  //       })
  //       .where(eq(users.id, user.id));

  //     res.json({ 
  //       message: '2FA disabled successfully',
  //       enabled: false
  //     });
  //   } catch (error) {
  //     console.error('2FA disable error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // // Admin toggle 2FA for any user
  // app.patch('/api/users/:id/2fa/toggle', verifyToken, async (req: any, res) => {
  //   try {
  //     if (!hasAdminPrivileges(req.user)) {
  //       return res.status(403).json({ message: 'Admin access required' });
  //     }

  //     const userId = parseInt(req.params.id);
  //     const { enabled } = req.body;

  //     if (typeof enabled !== 'boolean') {
  //       return res.status(400).json({ message: 'enabled field must be a boolean' });
  //     }

  //     const user = await storage.getUser(userId);
  //     if (!user) {
  //       return res.status(404).json({ message: 'User not found' });
  //     }

  //     // Update user's 2FA status
  //     await db.update(users)
  //       .set({ 
  //         mfaEnabled: enabled,
  //         // If disabling 2FA, also clear the secret
  //         mfaSecret: enabled ? user.mfaSecret : null,
  //         updatedAt: new Date()
  //       })
  //       .where(eq(users.id, userId));

  //     res.json({ 
  //       message: `2FA ${enabled ? 'enabled' : 'disabled'} for user ${user.email}`,
  //       enabled: enabled
  //     });
  //   } catch (error) {
  //     console.error('Admin 2FA toggle error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // User management routes
 
 
  // app.get('/api/users', verifyToken, cacheAdminData(300), async (req: any, res) => {
  //   try {
  //     // Check for admin privileges using the utility function
  //     const hasAdminAccess = hasAdminPrivileges(req.user);
      
  //     if (!hasAdminAccess) {
  //       return res.status(403).json({ message: 'Admin access required' });
  //     }
  //     const users = await storage.getUsers();
  //     res.json(users);
  //   } catch (error) {
  //     console.error('Get users error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.get('/api/users/notaries', verifyToken, async (req: any, res) => {
  //   try {
  //     // SECURITY RESTRICTION: Only allow admin access to notary listing
  //     if (!hasAdminPrivileges(req.user)) {
  //       return res.status(403).json({ 
  //         message: 'Admin access required',
  //         error: 'Access denied to notary listing'
  //       });
  //     }
      
  //     const notaries = await storage.getNotaryUsers();
  //     res.json(notaries.map(user => ({
  //       id: user.id,
  //       username: user.username,
  //       email: user.email,
  //       firstName: user.firstName,
  //       lastName: user.lastName,
  //       notaryIdCode: user.notaryIdCode,
  //       isActive: user.isActive,
  //       notaryType: user.notaryType
  //     })));
  //   } catch (error) {
  //     console.error('Get notaries error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // // Get users that can be signers (for job creation)
  // app.get('/api/users/signers', verifyToken, async (req: any, res) => {
  //   try {
  //     // Check if user has permission to access this endpoint
  //     const userCanCreateJob = 
  //       hasAdminPrivileges(req.user) ||
  //       req.user.role === 'title_company' ||
  //       req.user.role === 'client' ||
  //       (req.user.role === 'notary' && req.user.notaryType === 'subscriber');

  //     if (!userCanCreateJob) {
  //       return res.status(403).json({ 
  //         message: 'Access denied. Only administrators, title companies, clients, and subscriber notaries can access signers.' 
  //       });
  //     }

  //     // Get users who can be signers and witnesses
  //     const signerUsers = await db
  //       .select({
  //         id: users.id,
  //         username: users.username,
  //         firstName: users.firstName,
  //         lastName: users.lastName,
  //         email: users.email,
  //         phoneNumber: users.phoneNumber,
  //         role: users.role,
  //         isActive: users.isActive
  //       })
  //       .from(users)
  //       .where(
  //         and(
  //           eq(users.isActive, true),
  //           // Include only signer and witness roles
  //           inArray(users.role, ['signer', 'witness'])
  //         )
  //       )
  //       .orderBy(users.firstName, users.lastName, users.username);

  //     res.json(signerUsers);
  //   } catch (error) {
  //     console.error('Get signer users error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.put('/api/users/:id', verifyToken, async (req: any, res) => {
  //   try {
  //     if (!hasAdminPrivileges(req.user)) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     const userId = parseInt(req.params.id);
  //     const updateData = req.body;

  //     if (updateData.password) {
  //       updateData.password = await bcrypt.hash(updateData.password, 10);
  //     }

  //     const user = await storage.updateUser(userId, updateData);
  //     if (!user) {
  //       return res.status(404).json({ message: 'User not found' });
  //     }

  //     // Invalidate users cache to ensure fresh data on next request
  //     try {
  //       await redisCache.delPattern(`admin:*`); // Clear admin caches
  //       await redisCache.delPattern(`user:*`); // Clear all user caches
  //       await redisCache.delPattern(`api:*users*`); // Clear users API cache
  //       console.log(`🧹 Invalidated user caches after updating user ${userId}`);
  //     } catch (cacheError) {
  //       console.error('Failed to invalidate cache after user update:', cacheError);
  //       // Don't fail the request if cache invalidation fails
  //     }

  //     res.json({
  //       id: user.id,
  //       username: user.username,
  //       email: user.email,
  //       role: user.role,
  //       privileges: user.privileges
  //     });
  //   } catch (error) {
  //     console.error('Update user error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.delete('/api/users/:id', verifyToken, async (req: any, res) => {
  //   try {
  //     if (!hasAdminPrivileges(req.user)) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     const userId = parseInt(req.params.id);
      
  //     // Validate userId
  //     if (isNaN(userId) || userId <= 0) {
  //       return res.status(400).json({ message: 'Invalid user ID' });
  //     }

  //     // Prevent self-deletion
  //     if (req.user.id === userId) {
  //       return res.status(400).json({ message: 'Cannot delete your own account' });
  //     }

  //     const deleted = await storage.deleteUser(userId);
      
  //     if (!deleted) {
  //       return res.status(404).json({ message: 'User not found' });
  //     }

  //     // Invalidate users cache to ensure fresh data on next request
  //     try {
  //       await redisCache.delPattern(`admin:*`); // Clear admin caches
  //       await redisCache.delPattern(`user:*`); // Clear all user caches
  //       await redisCache.delPattern(`api:*users*`); // Clear users API cache
  //       console.log(`🧹 Invalidated user caches after deleting user ${userId}`);
  //     } catch (cacheError) {
  //       console.error('Failed to invalidate cache after user deletion:', cacheError);
  //       // Don't fail the request if cache invalidation fails
  //     }

  //     res.json({ message: 'User deleted successfully' });
  //   } catch (error) {
  //     console.error('Delete user error:', error);
      
  //     // Provide more specific error messages
  //     if (error instanceof Error) {
  //       if (error.message.includes('foreign key constraint')) {
  //         res.status(400).json({ 
  //           message: 'Cannot delete user due to existing relationships. Please remove all associated records first.' 
  //         });
  //       } else if (error.message.includes('Failed to delete user')) {
  //         res.status(500).json({ 
  //           message: 'Failed to delete user. Please try again or contact support if the problem persists.' 
  //         });
  //       } else {
  //         res.status(500).json({ message: 'Internal server error' });
  //       }
  //     } else {
  //       res.status(500).json({ message: 'Internal server error' });
  //     }
  //   }
  // });

  // // Get user signatures endpoint
  // app.get('/api/users/:id/signatures', verifyToken, async (req: any, res) => {
  //   try {
  //     const userId = parseInt(req.params.id);
      
  //     // Check if user can access these signatures
  //     if (!req.user || (!hasAdminPrivileges(req.user) && req.user.id !== userId)) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     // Get signatures from storage (in production, this would be a database query)
  //     const signatures = await storage.getUserSignatures(userId);
      
  //     res.json(signatures);
  //   } catch (error) {
  //     console.error('Get user signatures error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // // Create new signature endpoint
  // app.post('/api/users/:id/signatures', verifyToken, 
  //   upload.single('signature'), async (req: any, res) => {
  //   try {
  //     const userId = parseInt(req.params.id);
      
  //     // Check if user can create signatures for this user
  //     if (!req.user || (!hasAdminPrivileges(req.user) && req.user.id !== userId)) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     const { name, type, text, fontFamily, fontSize } = req.body;
      
  //     if (!name || !type) {
  //       return res.status(400).json({ message: 'Name and type are required' });
  //     }

  //     let imageUrl = '';
  //     let metadata = {};

  //     // VULTR ONLY - All signatures are stored in Vultr cloud storage
  //     const { VultrUploadHandler } = await import('./vultr-upload-handler');

  //     if (type === 'uploaded' && req.file) {
  //       // Handle uploaded signature
  //       const uploadResult = await VultrUploadHandler.handleSignatureUpload(
  //         req.file.buffer,
  //         req.file.originalname,
  //         `user-${userId}`,
  //         userId,
  //         'signature'
  //       );

  //       if (!uploadResult.success) {
  //         return res.status(500).json({ 
  //           message: `Failed to upload signature: ${uploadResult.error}`,
  //           error: 'vultr_upload_failed'
  //         });
  //       }

  //       imageUrl = uploadResult.signedUrl || uploadResult.fileKey || '';
  //       metadata = { originalName: req.file.originalname, vultrKey: uploadResult.fileKey };
        
  //     } else if (type === 'drawn') {
  //       // Handle drawn signature from canvas
  //       const { imageData } = req.body;
  //       if (!imageData) {
  //         return res.status(400).json({ message: 'Image data is required for drawn signatures' });
  //       }
        
  //       const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  //       const buffer = Buffer.from(base64Data, 'base64');
        
  //       const filename = `drawn_${Date.now()}.png`;
  //       const uploadResult = await VultrUploadHandler.handleSignatureUpload(
  //         buffer,
  //         filename,
  //         `user-${userId}`,
  //         userId,
  //         'signature'
  //       );

  //       if (!uploadResult.success) {
  //         return res.status(500).json({ 
  //           message: `Failed to upload drawn signature: ${uploadResult.error}`,
  //           error: 'vultr_upload_failed'
  //         });
  //       }

  //       imageUrl = uploadResult.signedUrl || uploadResult.fileKey || '';
  //       metadata = { style: 'handwritten', vultrKey: uploadResult.fileKey };
        
  //     } else if (type === 'generated') {
  //       // Handle generated signature
  //       if (!text) {
  //         return res.status(400).json({ message: 'Text is required for generated signatures' });
  //       }
        
  //       try {
  //         let buffer: Buffer;
  //         let filename: string;
          
  //         try {
  //           // Try to generate signature image using canvas (server-side)
  //         const { createCanvas } = await import('canvas');
  //         const canvas = createCanvas(400, 100);
  //         const ctx = canvas.getContext('2d');
          
  //         ctx.fillStyle = 'white';
  //         ctx.fillRect(0, 0, 400, 100);
          
  //         ctx.fillStyle = 'black';
  //         ctx.font = `${fontSize || 48}px ${fontFamily || 'serif'}`;
  //         ctx.textAlign = 'center';
  //         ctx.textBaseline = 'middle';
  //         ctx.fillText(text, 200, 50);
          
  //           buffer = canvas.toBuffer('image/png');
  //           filename = `generated_${Date.now()}.png`;
            
  //           console.log(`✅ Successfully generated signature canvas for: ${text}`);
          
  //       } catch (canvasError) {
  //           console.warn('Canvas generation failed, using SVG fallback:', canvasError);
          
  //         // Fallback: Create a simple SVG-based signature
  //         const svgContent = `
  //           <svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
  //             <rect width="400" height="100" fill="white"/>
  //             <text x="200" y="55" font-family="${fontFamily || 'serif'}" font-size="${fontSize || 48}" 
  //                   text-anchor="middle" fill="black">${text}</text>
  //           </svg>
  //         `;
          
  //           filename = `generated_${Date.now()}.svg`;
  //           buffer = Buffer.from(svgContent, 'utf8');
  //         }
          
  //         const uploadResult = await VultrUploadHandler.handleSignatureUpload(
  //           buffer,
  //           filename,
  //           `user-${userId}`,
  //           userId,
  //           'signature'
  //         );

  //         if (!uploadResult.success) {
  //           return res.status(500).json({ 
  //             message: `Failed to upload generated signature: ${uploadResult.error}`,
  //             error: 'vultr_upload_failed'
  //           });
  //         }

  //         imageUrl = uploadResult.signedUrl || uploadResult.fileKey || '';
  //         metadata = { fontFamily, fontSize, text, vultrKey: uploadResult.fileKey };
          
  //       } catch (outerError) {
  //         console.error('Signature generation failed completely:', outerError);
  //         return res.status(500).json({ 
  //           message: 'Failed to generate signature',
  //           error: 'signature_generation_failed'
  //         });
  //       }
  //     }

  //     // Create signature record
  //     const signature = await storage.createUserSignature({
  //       userId,
  //       name,
  //       type,
  //       imageUrl,
  //       metadata,
  //       isDefault: false,
  //       ipAddress: req.ip || req.connection?.remoteAddress,
  //       userAgent: req.get('User-Agent')
  //     });

  //     res.json(signature);
  //   } catch (error) {
  //     console.error('Create signature error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // // Set default signature endpoint
  // app.put('/api/users/:id/signatures/:signatureId/default', verifyToken, async (req: any, res) => {
  //   try {
  //     const userId = parseInt(req.params.id);
  //     const signatureId = req.params.signatureId;
      
  //     // Check if user can modify signatures for this user
  //     if (!req.user || (req.user.role !== 'admin' && req.user.id !== userId)) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     await storage.setDefaultSignature(userId, signatureId);
      
  //     res.json({ message: 'Default signature set successfully' });
  //   } catch (error) {
  //     console.error('Set default signature error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // // Delete signature endpoint
  // app.delete('/api/users/:id/signatures/:signatureId', verifyToken, async (req: any, res) => {
  //   try {
  //     const userId = parseInt(req.params.id);
  //     const signatureId = req.params.signatureId;
      
  //     // Check if user can delete signatures for this user
  //     if (!req.user || (req.user.role !== 'admin' && req.user.id !== userId)) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     await storage.deleteUserSignature(userId, signatureId);
      
  //     res.json({ message: 'Signature deleted successfully' });
  //   } catch (error) {
  //     console.error('Delete signature error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // // Get user profile with notary details
  // app.get('/api/users/:id/profile', verifyToken, cacheUserData(600), async (req: any, res) => {
  //   try {
  //     const userId = parseInt(req.params.id);
      
  //     // Check if user can access this profile
  //     if (!req.user || (req.user.role !== 'admin' && req.user.id !== userId)) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     const user = await storage.getUser(userId);
  //     if (!user) {
  //       return res.status(404).json({ message: 'User not found' });
  //     }

  //     // Return user profile with notary-specific fields
  //     const profile = {
  //       id: user.id,
  //       username: user.username,
  //       email: user.email,
  //       firstName: user.firstName || '',
  //       lastName: user.lastName || '',
  //       fullName: user.fullName || '',
  //       role: user.role,
  //       title: user.title || 'Notary Public',
  //       commissionNumber: user.commissionNumber || '',
  //       commissionExpiration: user.commissionExpiration || '',
  //       state: user.state || '',
  //       county: user.county || '',
  //       disclosure: user.disclosure || 'I acknowledge that this document was signed before me on this date.',
  //       signatureData: user.signatureData || '',
  //       initialData: user.initialData || '',
  //       phoneNumber: user.phoneNumber || '',
  //       address: user.address || '',
  //       isActive: user.isActive,
  //       isNotarySigningAgent: user.isNotarySigningAgent,
  //       isSpanishSpeaking: user.isSpanishSpeaking,
  //       notaryType: user.notaryType,
  //     };

  //     res.json(profile);
  //   } catch (error) {
  //     console.error('Get user profile error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // // Update user profile with notary details
  // app.put('/api/users/:id/profile', verifyToken, async (req: any, res) => {
  //   try {
  //     const userId = parseInt(req.params.id);
      
  //     // Check if user can update this profile
  //     if (!req.user || (req.user.role !== 'admin' && req.user.id !== userId)) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     const profileData = req.body;
      
  //     // Update user with new profile data
  //     const updateData: any = {
  //       firstName: profileData.firstName,
  //       lastName: profileData.lastName,
  //       title: profileData.title,
  //       commissionNumber: profileData.commissionNumber,
  //       commissionExpiration: profileData.commissionExpiration,
  //       state: profileData.state,
  //       county: profileData.county,
  //       disclosure: profileData.disclosure,
  //       phoneNumber: profileData.phoneNumber,
  //       address: profileData.address,
  //       isActive: profileData.isActive,
  //       isNotarySigningAgent: profileData.isNotarySigningAgent,
  //       isSpanishSpeaking: profileData.isSpanishSpeaking,
  //       notaryType: profileData.notaryType,
  //     };

  //     // Auto-generate fullName from firstName and lastName if provided
  //     if (profileData.firstName || profileData.lastName) {
  //       const fullName = [profileData.firstName, profileData.lastName].filter(Boolean).join(' ').trim();
  //       if (fullName) {
  //         updateData.fullName = fullName;
  //       }
  //     }

  //     const updatedUser = await storage.updateUser(userId, updateData);

  //     if (!updatedUser) {
  //       return res.status(404).json({ message: 'User not found' });
  //     }

  //     // Invalidate user-specific cache to ensure fresh data on next request
  //     try {
  //       await redisCache.delPattern(`user:${userId}:*`);
  //       console.log(`🧹 Invalidated cache for user ${userId} after profile update`);
  //     } catch (cacheError) {
  //       console.error('Failed to invalidate cache after profile update:', cacheError);
  //       // Don't fail the request if cache invalidation fails
  //     }

  //     res.json(updatedUser);
  //   } catch (error) {
  //     console.error('Update user profile error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });



  // Get notary stamps endpoint
  // app.get('/api/notary/:id/stamps', verifyToken, async (req: any, res) => {
  //   try {
  //     const notaryId = parseInt(req.params.id);
      
  //     // Check if user can access these stamps
  //     if (!req.user || (!hasAdminPrivileges(req.user) && req.user.id !== notaryId && req.user.role !== 'notary')) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     // Get actual stamps from database using correct column names
  //     let stamps;
  //     try {
  //       stamps = await db.execute(sql`
  //         SELECT 
  //           id,
  //           notary_id as "notaryId",
  //           stamp_name as "stampType",
  //           stamp_image as "stampData", 
  //           is_active as "isActive",
  //           created_at as "createdAt",
  //           updated_at as "updatedAt"
  //         FROM notary_stamps 
  //         WHERE notary_id = ${notaryId}
  //         ORDER BY created_at DESC
  //       `);
  //     } catch (dbError) {
  //       console.error('Database query failed for notary stamps:', dbError);
  //       return res.status(500).json({ 
  //         message: 'Failed to retrieve stamps from database',
  //         error: 'database_query_failed'
  //       });
  //     }

  //     // Transform stamps to include proper image URLs
  //     const { cloudStorage } = await import('./lib/cloud-storage-service');
      
  //     const stampsWithUrls = await Promise.all((stamps.rows || []).map(async (stamp: any) => {
  //       let imageUrl = '';
        
  //       if (stamp?.stampData && typeof stamp.stampData === 'string') {
  //         // Check if it's a Vultr key (no base64 prefix) or base64 data
  //         if (stamp.stampData.startsWith('data:image/')) {
  //           // Already base64 data, use directly
  //           imageUrl = stamp.stampData;
  //         } else {
  //           // Vultr key, generate signed URL
  //           try {
  //             const fileExists = await cloudStorage.fileExists(stamp.stampData);
  //             if (fileExists) {
  //               const signedUrl = await cloudStorage.getSignedUrl(stamp.stampData, 3600); // 1 hour expiry
  //               imageUrl = signedUrl || '/api/placeholder/stamp-error';
  //             } else {
  //               console.warn(`Stamp image not found in Vultr: ${stamp.stampData}`);
  //               imageUrl = '/api/placeholder/stamp-missing';
  //             }
  //           } catch (vultrError) {
  //             console.warn(`Failed to get Vultr URL for stamp ${stamp.id}:`, vultrError);
  //             imageUrl = '/api/placeholder/stamp-error';
  //           }
  //         }
  //       } else {
  //         imageUrl = '/api/placeholder/stamp-missing';
  //       }

  //       return {
  //         id: stamp?.id || 0,
  //         notaryId: stamp?.notaryId || notaryId,
  //         stampType: stamp?.stampType || 'notary',
  //         imageUrl,
  //         isActive: stamp?.isActive || false,
  //         uploadedAt: stamp?.createdAt ? new Date(stamp.createdAt).toISOString() : new Date().toISOString(),
  //         createdAt: stamp?.createdAt ? new Date(stamp.createdAt).toISOString() : new Date().toISOString()
  //       };
  //     }));
      
  //     res.json(stampsWithUrls);
  //   } catch (error) {
  //     console.error('Get notary stamps error:', error);
      
  //     // Provide a fallback response with empty array if stamps loading fails
  //     res.status(200).json([]);
  //   }
  // });

  // Title company routes - Updated to use enhanced companies table
  // app.get('/api/companies', verifyToken, cacheAdminData(300), async (req, res) => {
  //   try {
  //     const companies = await storage.getCompanies();
  //     res.json(companies);
  //   } catch (error) {
  //     console.error('Get companies error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.post('/api/companies', verifyToken, async (req: any, res) => {
  //   try {
  //     if (!req.user || !hasAdminPrivileges(req.user)) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     const companyData = insertCompanySchema.parse(req.body);
  //     const company = await storage.createCompany(companyData);
      
  //     // Invalidate companies cache to ensure fresh data on next request
  //     try {
  //       await redisCache.delPattern(`admin:*`); // Clear admin caches
  //       await redisCache.delPattern(`api:*companies*`); // Clear companies API cache
  //       console.log(`🧹 Invalidated company caches after creating company ${company.id}`);
  //     } catch (cacheError) {
  //       console.error('Failed to invalidate cache after company creation:', cacheError);
  //       // Don't fail the request if cache invalidation fails
  //     }
      
  //     res.status(201).json(company);
  //   } catch (error) {
  //     console.error('Create company error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.put('/api/companies/:id', verifyToken, async (req: any, res) => {
  //   try {
  //     if (!req.user || !hasAdminPrivileges(req.user)) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     const companyId = parseInt(req.params.id);
  //     const updateData = req.body;

  //     const company = await storage.updateCompany(companyId, updateData);
  //     if (!company) {
  //       return res.status(404).json({ message: 'Company not found' });
  //     }

  //     // Invalidate companies cache to ensure fresh data on next request
  //     try {
  //       await redisCache.delPattern(`admin:*`); // Clear admin caches
  //       await redisCache.delPattern(`api:*companies*`); // Clear companies API cache
  //       console.log(`🧹 Invalidated company caches after updating company ${companyId}`);
  //     } catch (cacheError) {
  //       console.error('Failed to invalidate cache after company update:', cacheError);
  //       // Don't fail the request if cache invalidation fails
  //     }

  //     res.json(company);
  //   } catch (error) {
  //     console.error('Update company error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.delete('/api/companies/:id', verifyToken, async (req: any, res) => {
  //   try {
  //     if (!req.user || !hasAdminPrivileges(req.user)) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     const companyId = parseInt(req.params.id);
  //     const deleted = await storage.deleteCompany(companyId);
      
  //     if (!deleted) {
  //       return res.status(404).json({ message: 'Company not found' });
  //     }

  //     // Invalidate companies cache to ensure fresh data on next request
  //     try {
  //       await redisCache.delPattern(`admin:*`); // Clear admin caches
  //       await redisCache.delPattern(`api:*companies*`); // Clear companies API cache
  //       console.log(`🧹 Invalidated company caches after deleting company ${companyId}`);
  //     } catch (cacheError) {
  //       console.error('Failed to invalidate cache after company deletion:', cacheError);
  //       // Don't fail the request if cache invalidation fails
  //     }

  //     res.json({ message: 'Company deleted successfully' });
  //   } catch (error) {
  //     console.error('Delete company error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // Job routes
  // app.get('/api/jobs', verifyToken, cacheUserData(180), async (req: any, res) => {
  //   try {
  //     const jobs = await storage.getRoleBasedJobs(req.user.id, req.user.role);
  //     res.json(jobs);
  //   } catch (error) {
  //     console.error('Get jobs error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // // Get jobs where user is invited as signer/witness
  // app.get('/api/jobs/invited', verifyToken, async (req: any, res) => {
  //   try {
  //     const userId = req.user.id;
      
  //     // Get jobs where this user is a signer
  //     const invitedJobs = await db
  //       .select({
  //         // Job fields
  //         id: jobs.id,
  //         titleCompany: jobs.titleCompany,
  //         closingType: jobs.closingType,
  //         propertyAddressOne: jobs.propertyAddressOne,
  //         propertyCity: jobs.propertyCity,
  //         propertyState: jobs.propertyState,
  //         selectedDate: jobs.selectedDate,
  //         selectedTime: jobs.selectedTime,
  //         jobStatus: jobs.jobStatus,
  //         notaryApprovalStatus: jobs.notaryApprovalStatus,
  //         createdAt: jobs.createdAt,
  //         // Signer specific fields
  //         signerRole: signers.signerRole,
  //         signingStatus: signers.signingStatus,
  //         invitationToken: signers.invitationToken,
  //         invitationSentAt: signers.invitationSentAt
  //       })
  //       .from(signers)
  //       .innerJoin(jobs, eq(signers.jobId, jobs.id))
  //       .where(eq(signers.userId, userId))
  //       .orderBy(desc(jobs.createdAt));

  //     res.json(invitedJobs);
  //   } catch (error) {
  //     console.error('Get invited jobs error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.get('/api/jobs/:id', verifyToken, cacheJobData(180), async (req: any, res) => {
  //   try {
  //     const jobId = parseInt(req.params.id);
  //     const job = await storage.getJob(jobId);
      
  //     if (!job) {
  //       return res.status(404).json({ message: 'Job not found' });
  //     }

  //     // Check if user has access to this job
  //     // Admin, job creator, assigned notary, OR anyone with session access (includes signers)
  //     const hasBasicAccess = req.user.role === 'admin' || 
  //                          job.userId === req.user.id || 
  //                          job.selectedNotary === req.user.id.toString();
      
  //     if (!hasBasicAccess) {
  //       // Check if user has session access (includes signers)
  //       const hasSessionAccess = await storage.verifySessionAccess(jobId, req.user.id);
  //       if (!hasSessionAccess) {
  //         return res.status(403).json({ message: 'Access denied' });
  //       }
  //     }

  //     const signers = await storage.getSignersByJobId(jobId);
      
  //     // Map database fields to frontend expected format
  //     const jobResponse = {
  //       ...job,
  //       uploadedFile: job.uploadedFile,
  //       notarizedFile: job.notarizedFile,
  //       signers
  //     };
      
  //     res.json(jobResponse);
  //   } catch (error) {
  //     console.error('Get job error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.post('/api/jobs', verifyToken, upload.array('documents', 10), async (req: any, res) => {
  //   try {
  //     // Define privilege checks once at the top using proper functions
  //     const hasAdminAccess = hasAdminPrivileges(req.user);
  //     const hasNotaryAccess = hasNotaryPrivileges(req.user);
      
  //     // Check if user has permission to create jobs
  //     const userCanCreateJob = 
  //       hasAdminAccess ||
  //       req.user.role === 'title_company' ||
  //       (req.user.role === 'notary' && req.user.notaryType === 'subscriber');

  //     if (!userCanCreateJob) {
  //       return res.status(403).json({ 
  //         message: 'Access denied. Only administrators, title companies, and subscriber notaries can create jobs.' 
  //       });
  //     }

  //     const jobData = {
  //       ...req.body,
  //       userId: req.user.id,
  //       kbaRequired: req.body.kbaRequired === 'true'
  //     };

  //     // Remove the old single file fields from job data
  //     delete jobData.uploadedFile;
  //     delete jobData.notarizedFile;

  //     // CRITICAL FIX: Ensure constraint compliance for notary assignments
  //     console.log(`🔧 Job creation - notaryOption: ${jobData.notaryOption}, selectedNotary: ${jobData.selectedNotary}, notaryId: ${jobData.notaryId}`);
      
  //     // Handle notary ID code assignments where selectedNotary contains the actual notary ID
  //     if (jobData.notaryOption === 'id_code' && jobData.selectedNotary) {
  //       // For ID code assignments, selectedNotary contains the actual notary ID
  //       const parsedNotaryId = parseInt(jobData.selectedNotary);
  //       if (isNaN(parsedNotaryId)) {
  //         console.error(`❌ Invalid notary ID for id_code assignment: ${jobData.selectedNotary}`);
  //         return res.status(400).json({ message: 'Invalid notary ID for ID code assignment' });
  //       }
  //       jobData.notaryId = parsedNotaryId;
  //       jobData.selectedNotary = parsedNotaryId.toString(); // Ensure string representation
  //       console.log(`✅ ID code assignment: notaryId=${jobData.notaryId}, selectedNotary=${jobData.selectedNotary}`);
  //     } else if (jobData.notaryOption === 'assign' && jobData.selectedNotary) {
  //       // For manual assignments, ensure both notaryId and selectedNotary are set consistently
  //       const parsedNotaryId = parseInt(jobData.selectedNotary);
  //       if (isNaN(parsedNotaryId)) {
  //         console.error(`❌ Invalid notary ID for manual assignment: ${jobData.selectedNotary}`);
  //         return res.status(400).json({ message: 'Invalid notary ID for manual assignment' });
  //       }
  //       jobData.notaryId = parsedNotaryId;
  //       jobData.selectedNotary = parsedNotaryId.toString(); // Ensure string representation
  //       console.log(`✅ Manual assignment: notaryId=${jobData.notaryId}, selectedNotary=${jobData.selectedNotary}`);
  //     } else if (jobData.notaryId && !jobData.selectedNotary) {
  //       jobData.selectedNotary = jobData.notaryId.toString();
  //       console.log(`✅ Set selectedNotary from notaryId: ${jobData.selectedNotary}`);
  //     } else if (jobData.notaryId && jobData.selectedNotary && jobData.selectedNotary !== jobData.notaryId.toString()) {
  //       // Ensure consistency - if both are set, they must match
  //       jobData.selectedNotary = jobData.notaryId.toString();
  //       console.log(`✅ Fixed notary consistency: selectedNotary=${jobData.selectedNotary}`);
  //     }

  //     // For initial job creation, ensure no constraint violations
  //     // Only clear notary data for unhandled cases (auto assignment will be handled later)
  //     if (!jobData.notaryId && jobData.selectedNotary && 
  //         jobData.notaryOption !== 'id_code' && jobData.notaryOption !== 'assign') {
  //       console.log(`🔧 Clearing inconsistent notary data: selectedNotary=${jobData.selectedNotary}, notaryOption=${jobData.notaryOption}`);
  //       delete jobData.selectedNotary;
  //       delete jobData.notaryId;
  //     }
      
  //     console.log(`🔧 Final job data - notaryId: ${jobData.notaryId}, selectedNotary: ${jobData.selectedNotary}`);

  //     const job = await storage.createJob(jobData);

  //     // Handle automatic notary assignment based on who creates the job
  //     let assignedNotary = null;
      
  //     // FUNDAMENTAL ASSIGNMENT LOGIC: Assign notary based on creator role
  //     if (req.user.role === 'notary' && req.user.notaryType === 'subscriber') {
  //       // Subscriber notary creates job → They are the notary for their own job
  //       assignedNotary = req.user;
  //       console.log(`🔧 Subscriber notary created job ${job.id} - auto-assigning themselves as notary`);
        
  //     } else if (hasAdminAccess && hasNotaryAccess && (!jobData.notaryOption || jobData.notaryOption === 'admin_self')) {
  //       // Admin with notary privileges creates job → Admin as notary
  //       assignedNotary = req.user;
  //       console.log(`🔧 Admin-notary created job ${job.id} - assigning admin as notary (option: ${jobData.notaryOption || 'default'})`);
        
  //     } else if (hasAdminAccess || req.user.role === 'title_company') {
  //       // Admin or Title company creates job → Use assignment flow based on notaryOption
  //       console.log(`🔧 ${hasAdminAccess ? 'Admin' : req.user.role} created job ${job.id} with notaryOption: ${jobData.notaryOption} - will use assignment flow`);
  //     }

  //     // If we have a default assignment from creator role, apply it immediately
  //     if (assignedNotary) {
  //       await storage.updateJob(job.id, {
  //         notaryId: assignedNotary.id,
  //         selectedNotary: assignedNotary.id.toString(),
  //         jobStatus: 'open',
  //         notaryApprovalStatus: 'approved' // Auto-approve since it's their own job or admin
  //       });

  //       // Log the automatic assignment
  //       const assignmentType = hasAdminAccess && hasNotaryAccess ? 'subscriber_self' :
  //                             hasAdminAccess ? 'manual' : 'subscriber_self';
        
  //       await db.insert(notaryAssignmentLog).values({
  //         jobId: job.id,
  //         notaryId: assignedNotary.id,
  //         assignmentType,
  //         assignmentStatus: 'assigned'
  //       });

  //       console.log(`✅ Auto-assigned notary ${assignedNotary.firstName} ${assignedNotary.lastName} to job ${job.id}`);
        
  //       // Note: Signer invitations will be sent after signers are created (moved below)
  //     }

  //     // Handle additional notary assignment logic for title companies
  //     if (!assignedNotary && jobData.notaryOption === 'auto' && !jobData.selectedNotary) {
  //       // Check if title company has a preferred notary
  //       const titleCompany = await db
  //         .select()
  //         .from(companies)
  //         .where(eq(companies.companyName, jobData.titleCompany))
  //         .limit(1);

  //       if (titleCompany.length > 0) {
  //         // Check new assignment system first for preferred notary
  //         let preferredNotary: any = null;

  //         const [assignedNotaryRecord] = await db
  //           .select({
  //             notary: users
  //           })
  //           .from(titleCompanyNotaryAssignments)
  //           .innerJoin(users, eq(titleCompanyNotaryAssignments.notaryId, users.id))
  //           .where(
  //             and(
  //               eq(titleCompanyNotaryAssignments.titleCompanyId, titleCompany[0].id),
  //               eq(titleCompanyNotaryAssignments.isDefault, true),
  //               eq(titleCompanyNotaryAssignments.status, 'active'),
  //               eq(users.role, 'notary'),
  //               eq(users.notaryType, 'contractor'),
  //               eq(users.isActive, true)
  //             )
  //           )
  //           .limit(1);

  //         if (assignedNotaryRecord) {
  //           preferredNotary = assignedNotaryRecord.notary;
  //           console.log(`✅ Found preferred notary via new assignment system: ${preferredNotary.firstName} ${preferredNotary.lastName}`);
  //         }

  //         // Fallback to legacy preferred notary system
  //         if (!preferredNotary && titleCompany[0].preferredNotaryId) {
  //           const legacyPreferredNotary = await db
  //             .select()
  //             .from(users)
  //             .where(
  //               and(
  //                 eq(users.id, titleCompany[0].preferredNotaryId),
  //                 eq(users.isActive, true),
  //                 eq(users.role, 'notary'),
  //                 eq(users.notaryType, 'contractor')
  //               )
  //             )
  //             .limit(1);

  //           if (legacyPreferredNotary.length > 0) {
  //             preferredNotary = legacyPreferredNotary[0];
  //             console.log(`✅ Found preferred notary via legacy system: ${preferredNotary.firstName} ${preferredNotary.lastName}`);
  //           }
  //         }

  //         if (preferredNotary) {
  //           assignedNotary = preferredNotary;
  //           await storage.updateJob(job.id, {
  //             notaryId: assignedNotary.id,
  //             selectedNotary: assignedNotary.id.toString(),
  //             jobStatus: 'open', // Keep as open until notary approves
  //             notaryApprovalStatus: 'assigned_pending_approval'
  //           });

  //           // Log the preferred assignment
  //           await db.insert(notaryAssignmentLog).values({
  //             jobId: job.id,
  //             notaryId: assignedNotary.id,
  //             assignmentType: 'preferred',
  //             assignmentStatus: 'assigned'
  //           });

  //           console.log(`✅ Assigned preferred notary ${assignedNotary.firstName} ${assignedNotary.lastName} to job ${job.id} for ${jobData.titleCompany}`);

  //           // Send job assignment notification to notary (requires approval)
  //           try {
  //             await notificationService.sendJobAssignmentNotification(job.id, assignedNotary.id);
  //           } catch (notificationError) {
  //             console.error('Failed to send job assignment notification:', notificationError);
  //           }

  //           // Create calendar event for the assigned notary if date and time are provided
  //           if (jobData.selectedDate && jobData.selectedTime) {
  //             try {
  //               const startDateTime = new Date(`${jobData.selectedDate} ${jobData.selectedTime}`);
  //               const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration
                
  //               await db.insert(calendarEvents).values({
  //                 notaryId: assignedNotary.id,
  //                 title: `Notarization Job #${job.id}`,
  //                 description: `Job for ${jobData.titleCompany} - ${jobData.closingType}\nProperty: ${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState}`,
  //                 startDateTime,
  //                 endDateTime,
  //                 location: `${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState} ${jobData.propertyZipCode}`,
  //                 eventType: 'job',
  //                 jobId: job.id,
  //                 isAllDay: false
  //               });
  //             } catch (error) {
  //               console.warn('Failed to create calendar event for preferred notary assignment:', error);
  //             }
  //           }
  //         }
  //       }

  //       // If no preferred notary available, perform immediate auto assignment
  //       if (!assignedNotary) {
  //         console.log(`🎲 No preferred notary available for ${jobData.titleCompany}, attempting immediate random assignment...`);
          
  //         // Use the enhanced assignment service for immediate auto assignment
  //         const { EnhancedAssignmentService } = await import('./enhanced-assignment-service');
  //         const assignmentResult = await EnhancedAssignmentService.performAutoAssignment(job.id, jobData.titleCompany);
          
  //         if (assignmentResult.success && assignmentResult.notaryId) {
  //           console.log(`✅ Successfully assigned random notary ${assignmentResult.notaryName} to job ${job.id}`);
            
  //           // Update job with the assigned notary
  //           await storage.updateJob(job.id, {
  //             notaryId: assignmentResult.notaryId,
  //             selectedNotary: assignmentResult.notaryId.toString(),
  //             isRandomAssignment: true,
  //             requiresNSA: jobData.requiresNSA === 'true' || false,
  //             requiresSpanishSpeaking: jobData.requiresSpanishSpeaking === 'true' || false,
  //             notaryApprovalStatus: assignmentResult.requiresApproval ? 'assigned_pending_approval' : 'approved'
  //           });
            
  //           assignedNotary = assignmentResult.notaryId;
            
  //           // Send job assignment notification to notary
  //           try {
  //             const notificationService = new (await import('./notification-service')).NotificationService();
  //             await notificationService.sendJobAssignmentNotification(job.id, assignmentResult.notaryId);
  //           } catch (notificationError) {
  //             console.error('Failed to send job assignment notification:', notificationError);
  //           }
  //         } else {
  //           console.log(`❌ Auto assignment failed for job ${job.id}: ${assignmentResult.error || 'No available notaries'}`);
  //           // Fallback to marking for later assignment
  //           await storage.updateJob(job.id, {
  //             isRandomAssignment: true,
  //             requiresNSA: jobData.requiresNSA === 'true' || false,
  //             requiresSpanishSpeaking: jobData.requiresSpanishSpeaking === 'true' || false,
  //             notaryApprovalStatus: 'pending_assignment'
  //           });
  //           console.log(`🎯 Marked job ${job.id} for manual assignment - no available notaries found`);
  //         }
  //       }
  //     } else if (!assignedNotary && jobData.notaryOption === 'assign' && jobData.selectedNotary) {
  //       // Manual assignment for title companies
  //       const selectedNotaryId = parseInt(jobData.selectedNotary);
  //       await storage.updateJob(job.id, {
  //         notaryId: selectedNotaryId,
  //         selectedNotary: selectedNotaryId.toString(), // This was missing!
  //         jobStatus: 'open', // Keep as open until notary approves
  //         notaryApprovalStatus: 'assigned_pending_approval'
  //       });

  //       // Log the manual assignment
  //       await db.insert(notaryAssignmentLog).values({
  //         jobId: job.id,
  //         notaryId: selectedNotaryId,
  //         assignmentType: 'manual',
  //         assignmentStatus: 'assigned'
  //       });

  //       // Send job assignment notification to notary (requires approval)
  //       try {
  //         await notificationService.sendJobAssignmentNotification(job.id, selectedNotaryId);
  //       } catch (notificationError) {
  //         console.error('Failed to send job assignment notification:', notificationError);
  //       }

  //       // Create calendar event for the assigned notary if date and time are provided
  //       if (jobData.selectedDate && jobData.selectedTime) {
  //         try {
  //           const startDateTime = new Date(`${jobData.selectedDate} ${jobData.selectedTime}`);
  //           const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration
            
  //           await db.insert(calendarEvents).values({
  //             notaryId: selectedNotaryId,
  //             title: `Notarization Job #${job.id}`,
  //             description: `Job for ${jobData.titleCompany} - ${jobData.closingType}\nProperty: ${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState}`,
  //             startDateTime,
  //             endDateTime,
  //             location: `${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState} ${jobData.propertyZipCode}`,
  //             eventType: 'job',
  //             jobId: job.id,
  //             isAllDay: false
  //           });
  //         } catch (error) {
  //           console.warn('Failed to create calendar event for manual notary assignment:', error);
  //         }
  //       }
  //     } else if (!assignedNotary && jobData.notaryOption === 'id_code' && jobData.notaryId) {
  //       // Notary ID Code assignment - notary already assigned during initial creation
  //       // Just need to update the approval status and log the assignment
  //       await storage.updateJob(job.id, {
  //         jobStatus: 'open', // Keep as open until notary approves
  //         notaryApprovalStatus: 'assigned_pending_approval'
  //       });

  //       // Log the ID code assignment (using 'manual' since ID code is a manual assignment method)
  //       await db.insert(notaryAssignmentLog).values({
  //         jobId: job.id,
  //         notaryId: jobData.notaryId,
  //         assignmentType: 'manual',
  //         assignmentStatus: 'assigned'
  //       });

  //       // Send job assignment notification to notary (requires approval)
  //       try {
  //         await notificationService.sendJobAssignmentNotification(job.id, jobData.notaryId);
  //       } catch (notificationError) {
  //         console.error('Failed to send job assignment notification:', notificationError);
  //       }

  //       // Create calendar event for the assigned notary if date and time are provided
  //       if (jobData.selectedDate && jobData.selectedTime) {
  //         try {
  //           const startDateTime = new Date(`${jobData.selectedDate} ${jobData.selectedTime}`);
  //           const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration
            
  //           await db.insert(calendarEvents).values({
  //             notaryId: jobData.notaryId,
  //             title: `Notarization Job #${job.id}`,
  //             description: `Job for ${jobData.titleCompany} - ${jobData.closingType}\nProperty: ${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState}`,
  //             startDateTime,
  //             endDateTime,
  //             location: `${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState} ${jobData.propertyZipCode}`,
  //             eventType: 'job',
  //             jobId: job.id,
  //             isAllDay: false
  //           });
  //         } catch (error) {
  //           console.warn('Failed to create calendar event for ID code notary assignment:', error);
  //         }
  //       }
  //     }

  //     // Handle multiple document uploads to Vultr with intelligent organization
  //     if (req.files && req.files.length > 0) {
  //       const { VultrUploadHandler } = await import('./vultr-upload-handler');
        
  //       for (let i = 0; i < req.files.length; i++) {
  //         const file = req.files[i];
  //         const metadataKey = `documentMetadata_${i}`;
  //         let metadata = { isRequired: false, documentType: 'original', originalName: file.originalname };
          
  //         if (req.body[metadataKey]) {
  //           try {
  //             metadata = { ...metadata, ...JSON.parse(req.body[metadataKey]) };
  //           } catch (e) {
  //             console.warn('Failed to parse document metadata:', e);
  //           }
  //         }

  //         // Upload to Vultr with intelligent organization
  //         const fileBuffer = Buffer.from(file.buffer || await fs.promises.readFile(file.path));
          
  //         const uploadResult = await VultrUploadHandler.handleJobDocumentUpload(
  //           fileBuffer,
  //           file.originalname,
  //           job.id,
  //           req.user.id,
  //           {
  //             ...metadata,
  //             userRole: req.user.role,
  //             titleCompany: jobData.titleCompany
  //           }
  //         );

  //         if (!uploadResult.success) {
  //           console.error(`Failed to upload document to Vultr: ${uploadResult.error}`);
  //           return res.status(500).json({ 
  //             message: `Failed to upload document: ${uploadResult.error}`,
  //             error: 'vultr_upload_failed'
  //           });
  //         }
  //         // If successful, the document record was already created by VultrUploadHandler
  //       }
  //     }

  //     // Create signers if provided
  //     if (req.body.signers) {
  //       const signers = JSON.parse(req.body.signers);
  //       for (const signerData of signers) {
  //         // Check if user already exists
  //         const [existingUser] = await db.select()
  //           .from(users)
  //           .where(eq(users.email, signerData.signerEmail));

  //         let userId;
  //         if (!existingUser) {
  //           // Create new user account for the signer
  //           const hashedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  //           const [newUser] = await db.insert(users).values({
  //             username: signerData.signerEmail,
  //             email: signerData.signerEmail,
  //             password: hashedPassword, // Temporary password, will be reset
  //             role: 'signer',
  //             firstName: signerData.signerName.split(' ')[0] || '',
  //             lastName: signerData.signerName.split(' ').slice(1).join(' ') || '',
  //             phoneNumber: signerData.signerPhoneNumber || '',
  //             isVerified: false, // Account not verified yet
  //             verificationStatus: 'pending', // Pending verification
  //             accountSetupComplete: false, // Password needs to be set
  //             // Auto-approve signers and witnesses - they don't need admin approval
  //             approvalStatus: 'approved',
  //             isActive: true,
  //             createdAt: new Date()
  //           }).returning();
  //           userId = newUser.id;
  //         } else {
  //           // Check if existing user is a notary - notaries cannot be signers
  //           if (existingUser.role === 'notary') {
  //             console.error(`❌ Cannot add notary ${existingUser.email} as a signer - conflict of interest`);
  //             return res.status(400).json({ 
  //               message: `Cannot add ${signerData.signerEmail} as a signer. This user is registered as a notary and cannot participate as a signer.` 
  //             });
  //           }
            
  //           // Check if existing user is already a signer
  //           if (existingUser.role !== 'signer' && existingUser.role !== 'witness') {
  //             console.error(`❌ Cannot add ${existingUser.role} ${existingUser.email} as a signer`);
  //             return res.status(400).json({ 
  //               message: `Cannot add ${signerData.signerEmail} as a signer. This user has a different role (${existingUser.role}) in the system.` 
  //             });
  //           }
            
  //           userId = existingUser.id;
  //         }

  //         // Create signer record linked to user
  //         await storage.createSigner({
  //           ...signerData,
  //           jobId: job.id,
  //           userId: userId,
  //           invitationToken: crypto.randomUUID()
  //         });

  //         // Generate password reset token for account setup
  //         const passwordResetToken = crypto.randomUUID();
  //         const tokenExpiry = new Date();
  //         tokenExpiry.setHours(tokenExpiry.getHours() + 24); // 24 hour expiry

  //         // Store password reset token
  //         await db.insert(passwordResetTokens).values({
  //           userId: userId,
  //           token: passwordResetToken,
  //           expiresAt: tokenExpiry,
  //           used: false
  //         });

  //         // NOTE: Signer notifications will be sent after notary approval
  //         // Account setup emails are deferred until notary approves the job
  //         console.log(`Signer account created for ${signerData.signerEmail} - notifications will be sent after notary approval`);
  //       }
  //     }

  //     // SEND SIGNER INVITATIONS FOR AUTO-APPROVED JOBS (after signers are created)
  //     const updatedJob = await storage.getJob(job.id);
  //     if (updatedJob && updatedJob.notaryApprovalStatus === 'approved' && req.body.signers) {
  //       try {
  //         console.log(`📧 Sending invitations for auto-approved job ${job.id}`);
          
  //         // Get the signers we just created
  //         const jobSigners = await db
  //           .select()
  //           .from(signers)
  //           .where(eq(signers.jobId, job.id));
          
  //         console.log(`   Found ${jobSigners.length} signers to invite`);
          
  //         // Send invitation to each signer directly (like resend does)
  //         for (const signer of jobSigners) {
  //           try {
  //             // Generate invitation token if not exists
  //             let invitationToken = signer.invitationToken;
  //             if (!invitationToken) {
  //               invitationToken = crypto.randomUUID();
  //               await db.update(signers)
  //                 .set({ 
  //                   invitationToken,
  //                   invitationSentAt: new Date()
  //                 })
  //                 .where(eq(signers.id, signer.id));
  //             } else {
  //               await db.update(signers)
  //                 .set({ invitationSentAt: new Date() })
  //                 .where(eq(signers.id, signer.id));
  //             }

  //             // Send email directly using emailService (like resend does)
  //             await emailService.sendSignerInvitation({
  //               signerName: signer.signerName,
  //               signerEmail: signer.signerEmail,
  //               signerRole: signer.signerRole,
  //               invitationToken,
  //               titleCompany: updatedJob.titleCompany,
  //               closingType: updatedJob.closingType,
  //               propertyAddress: updatedJob.propertyAddressOne ? 
  //                 `${updatedJob.propertyAddressOne}, ${updatedJob.propertyCity}, ${updatedJob.propertyState} ${updatedJob.propertyZipCode}` : 
  //                 undefined,
  //               scheduledDate: updatedJob.selectedDate || undefined,
  //               scheduledTime: updatedJob.selectedTime || undefined
  //             });

  //             // Log notification (but don't fail if this fails)
  //             try {
  //               await db.insert(jobNotifications).values({
  //                 jobId: job.id,
  //                 recipientId: signer.userId || 0,
  //                 recipientEmail: signer.signerEmail,
  //                 notificationType: 'signer_invite',
  //                 status: 'sent',
  //                 subject: `🏛️ Secure Document Signing Required - ${updatedJob.titleCompany}`,
  //                 message: `Invitation sent to ${signer.signerName} for ${updatedJob.titleCompany} document signing`,
  //                 metadata: { jobId: job.id, signerId: signer.id, invitationToken },
  //                 sentAt: new Date()
  //               });
  //             } catch (logError) {
  //               console.warn('Failed to log notification:', logError);
  //             }

  //             console.log(`✅ Invitation sent to ${signer.signerName} (${signer.signerEmail})`);
  //           } catch (signerError) {
  //             console.error(`❌ Failed to send invitation to ${signer.signerEmail}:`, signerError);
  //           }
  //         }

  //         // Mark job as having notifications sent
  //         await db.update(jobs)
  //           .set({
  //             signerNotificationsSent: true,
  //             signerNotificationsSentAt: new Date()
  //           })
  //           .where(eq(jobs.id, job.id));

  //       } catch (notificationError) {
  //         console.error('Failed to send signer invitations for auto-approved job:', notificationError);
  //       }
  //     }

  //     // CRITICAL FIX: Get the updated job with assigned notary before returning
  //     const finalJob = await storage.getJob(job.id);
  //     const documentCount = req.files ? req.files.length : 0;
      
  //     // Invalidate job caches using centralized cache manager
  //     console.log(`🔧 About to invalidate caches - finalJob:`, {
  //       id: finalJob?.id,
  //       notaryId: finalJob?.notaryId,
  //       selectedNotary: finalJob?.selectedNotary,
  //       creatorId: req.user.id
  //     });
      
  //     // Use the new centralized cache manager
  //     const { cacheInvalidation } = await import('./services/cache-manager');
  //     await cacheInvalidation.onJobCreated(job.id, finalJob?.notaryId, req.user.id);
      
  //     res.status(201).json({
  //       ...finalJob, // Return the updated job with assigned notary
  //       documentCount,
  //       message: `Job created successfully with ${documentCount} document${documentCount !== 1 ? 's' : ''}${finalJob?.assignedNotary ? ` and assigned to ${finalJob.assignedNotary.name}` : ''}`
  //     });
  //   } catch (error) {
  //     console.error('Create job error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.put('/api/jobs/:id/status', verifyToken, async (req: any, res) => {
  //   try {
  //     const jobIdParam = req.params.id;
  //     const jobId = parseInt(jobIdParam);
      
  //     // Validate job ID
  //     if (isNaN(jobId) || jobId <= 0) {
  //       console.error('Invalid job ID provided:', jobIdParam);
  //       return res.status(400).json({ 
  //         message: 'Invalid job ID provided',
  //         providedId: jobIdParam,
  //         error: 'invalid_job_id'
  //       });
  //     }
      
  //     const { status } = req.body;

  //     const job = await storage.getJob(jobId);
  //     if (!job) {
  //       return res.status(404).json({ message: 'Job not found' });
  //     }

  //     // Check if user has access to update this job
  //     if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     const updatedJob = await storage.updateJob(jobId, { jobStatus: status });
  //     res.json(updatedJob);
  //   } catch (error) {
  //     console.error('Update job status error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // // Update job schedule and handle auto assignment
  // app.put('/api/jobs/:id/schedule', verifyToken, async (req: any, res) => {
  //   try {
  //     const jobId = parseInt(req.params.id);
  //     const { selectedDate, selectedTime } = req.body;

  //     if (!selectedDate || !selectedTime) {
  //       return res.status(400).json({ message: 'Both selectedDate and selectedTime are required' });
  //     }

  //     const job = await storage.getJob(jobId);
  //     if (!job) {
  //       return res.status(404).json({ message: 'Job not found' });
  //     }

  //     // Check if user has access to update this job
  //     if (req.user.role !== 'admin' && req.user.role !== 'title_company' && job.userId !== req.user.id) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     console.log(`🕐 Scheduling job ${jobId} for ${selectedDate} at ${selectedTime}`);

  //     // Check if this job needs auto assignment
  //     if (job.isRandomAssignment && job.notaryOption === 'auto' && !job.notaryId) {
  //       console.log(`🎲 Job ${jobId} marked for auto assignment, finding available notaries...`);

  //       // Use the random notary service to find available notaries for this time slot
  //       const randomNotaryService = new (await import('./random-notary-service')).RandomNotaryService();
        
  //       const qualifications = {
  //         requiresNSA: job.requiresNSA || false,
  //         requiresSpanishSpeaking: job.requiresSpanishSpeaking || false
  //       };

  //       const timeSlot = {
  //         date: selectedDate,
  //         startTime: selectedTime,
  //         endTime: addHourToTime(selectedTime) // Assume 1-hour appointment
  //       };

  //       // Get rejected notaries from job data
  //       const excludeIds = job.rejectedNotaries ? job.rejectedNotaries.map((id: string) => parseInt(id)) : [];

  //       const selectedNotary = await randomNotaryService.selectRandomNotary(qualifications, timeSlot, excludeIds);

  //       if (selectedNotary) {
  //         console.log(`✅ Found available notary: ${selectedNotary.firstName} ${selectedNotary.lastName} for job ${jobId}`);
          
  //         // Use the random notary service to assign the notary (includes calendar booking)
  //         const assignmentSuccess = await randomNotaryService.assignNotaryToJob(
  //           jobId, 
  //           selectedNotary.id, 
  //           timeSlot, 
  //           'random'
  //         );

  //         if (assignmentSuccess) {
  //           // Update the approval status since notary needs to approve the assignment
  //           await storage.updateJob(jobId, {
  //             notaryApprovalStatus: 'assigned_pending_approval'
  //           });

  //           // Send notification to the assigned notary
  //           try {
  //             const notificationService = new (await import('./notification-service')).NotificationService();
  //             await notificationService.sendJobAssignmentNotification(jobId, selectedNotary.id);
  //           } catch (notificationError) {
  //             console.error('Failed to send job assignment notification:', notificationError);
  //           }

  //           const updatedJob = await storage.getJob(jobId);
  //           return res.json({
  //             ...updatedJob,
  //             message: `Job scheduled and assigned to ${selectedNotary.firstName} ${selectedNotary.lastName}`,
  //             assignedNotary: {
  //               id: selectedNotary.id,
  //               name: `${selectedNotary.firstName} ${selectedNotary.lastName}`
  //             }
  //           });
  //         } else {
  //           console.error(`❌ Failed to assign notary ${selectedNotary.id} to job ${jobId}`);
  //           return res.status(500).json({ message: 'Failed to assign notary to job' });
  //         }
  //       } else {
  //         console.log(`❌ No available notaries found for job ${jobId} on ${selectedDate} at ${selectedTime}`);
          
  //         // Update the job with the selected time but no notary
  //         const updatedJob = await storage.updateJob(jobId, {
  //           selectedDate,
  //           selectedTime,
  //           notaryApprovalStatus: 'pending_assignment'
  //         });

  //         return res.json({
  //           ...updatedJob,
  //           message: 'Job scheduled but no notaries available at this time. Please try a different time or assign manually.',
  //           requiresManualAssignment: true
  //         });
  //       }
  //     } else {
  //       // Regular schedule update for jobs that already have a notary or don't need auto assignment
  //       const updatedJob = await storage.updateJob(jobId, {
  //         selectedDate,
  //         selectedTime
  //       });

  //       // If job already has a notary, update their calendar
  //       if (job.notaryId) {
  //         try {
  //           const startDateTime = new Date(`${selectedDate} ${selectedTime}`);
  //           const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration
            
  //           // Check if calendar event already exists
  //           const existingEvent = await db
  //             .select()
  //             .from(calendarEvents)
  //             .where(
  //               and(
  //                 eq(calendarEvents.jobId, jobId),
  //                 eq(calendarEvents.notaryId, job.notaryId)
  //               )
  //             )
  //             .limit(1);

  //           if (existingEvent.length > 0) {
  //             // Update existing calendar event
  //             await db
  //               .update(calendarEvents)
  //               .set({
  //                 startDateTime,
  //                 endDateTime,
  //                 title: `Notarization Job #${jobId}`,
  //                 description: `Job for ${job.titleCompany} - ${job.closingType}\nProperty: ${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState}`,
  //                 location: `${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState} ${job.propertyZipCode}`
  //               })
  //               .where(eq(calendarEvents.id, existingEvent[0].id));
  //           } else {
  //             // Create new calendar event
  //             await db.insert(calendarEvents).values({
  //               notaryId: job.notaryId,
  //               title: `Notarization Job #${jobId}`,
  //               description: `Job for ${job.titleCompany} - ${job.closingType}\nProperty: ${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState}`,
  //               startDateTime,
  //               endDateTime,
  //               location: `${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState} ${job.propertyZipCode}`,
  //               eventType: 'job',
  //               jobId: jobId,
  //               isAllDay: false
  //             });
  //           }
  //         } catch (calendarError) {
  //           console.warn('Failed to update calendar event:', calendarError);
  //         }
  //       }

  //       res.json({
  //         ...updatedJob,
  //         message: 'Job schedule updated successfully'
  //       });
  //     }
  //   } catch (error) {
  //     console.error('Update job schedule error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // // Delete individual job endpoint
  // app.delete('/api/jobs/:id', verifyToken, async (req: any, res) => {
  //   try {
  //     const jobId = parseInt(req.params.id);
  //     const job = await storage.getJob(jobId);
      
  //     if (!job) {
  //       return res.status(404).json({ message: 'Job not found' });
  //     }

  //     // Check if user has access to delete this job
  //     if (req.user.role !== 'admin' && job.userId !== req.user.id) {
  //       return res.status(403).json({ message: 'Access denied. Only job creator or admin can delete jobs.' });
  //     }

  //     // Get all documents associated with this job for cleanup
  //     const documents = await storage.getJobDocumentsByJobId(jobId);
      
  //     // Delete all associated files (both local and Vultr)
  //     for (const document of documents) {
  //       try {
  //         const filePath = document.filePath;
  //         const isVultrFile = !filePath.startsWith('/') && !filePath.includes('\\') && !filePath.includes('uploads/');
          
  //         if (isVultrFile) {
  //           // Delete from Vultr cloud storage
  //           const { cloudStorage } = await import('./lib/cloud-storage-service');
  //           try {
  //             const fileExists = await cloudStorage.fileExists(filePath);
  //             if (fileExists) {
  //               await cloudStorage.deleteFile(filePath);
  //               console.log(`✅ Deleted file from Vultr: ${filePath}`);
  //             }
  //           } catch (vultrError) {
  //             console.error(`❌ Failed to delete file from Vultr: ${filePath}`, vultrError);
  //           }
  //         } else {
  //           // Delete local file if it exists
  //           if (fs.existsSync(filePath)) {
  //             fs.unlinkSync(filePath);
  //             console.log(`✅ Deleted local file: ${filePath}`);
  //           }
  //         }
  //       } catch (fileError) {
  //         console.error(`Error deleting file for document ${document.id}:`, fileError);
  //         // Continue with job deletion even if file cleanup fails
  //       }
  //     }

  //     // Delete job from database (cascade will handle related records)
  //     const deleted = await storage.deleteJob(jobId);
      
  //     if (!deleted) {
  //       return res.status(404).json({ message: 'Job not found' });
  //     }

  //     res.json({ message: 'Job and associated files deleted successfully' });
  //   } catch (error) {
  //     console.error('Delete job error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.put('/api/jobs/:id/file', verifyToken, upload.single('notarizedFile'), async (req: any, res) => {
  //   try {
  //     const jobId = parseInt(req.params.id);
  //     const { status } = req.body;

  //     const job = await storage.getJob(jobId);
  //     if (!job) {
  //       return res.status(404).json({ message: 'Job not found' });
  //     }

  //     // Check if user has access to update this job
  //     if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     const updateData: any = {};
      
  //     if (req.file) {
  //       // Upload notarized file to Vultr
  //       const { VultrUploadHandler } = await import('./vultr-upload-handler');
        
  //       const fileBuffer = req.file.buffer ? Buffer.from(req.file.buffer) : await fs.promises.readFile(req.file.path);
        
  //       const uploadResult = await VultrUploadHandler.handleJobDocumentUpload(
  //         fileBuffer,
  //         req.file.originalname,
  //         jobId,
  //         req.user.id,
  //         {
  //           documentType: 'notarized',
  //           userRole: req.user.role,
  //           jobId: jobId
  //         }
  //       );

  //       if (!uploadResult.success) {
  //         return res.status(500).json({ 
  //           message: `Failed to upload notarized file: ${uploadResult.error}`,
  //           error: 'vultr_upload_failed'
  //         });
  //       }
        
  //       updateData.notarizedFile = uploadResult.fileKey;
  //       console.log(`✅ Uploaded notarized file to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`);
  //     }
      
  //     if (status) {
  //       updateData.jobStatus = status;
  //     }

  //     const updatedJob = await storage.updateJob(jobId, updateData);
  //     res.json(updatedJob);
  //   } catch (error) {
  //     console.error('Update job file error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // // General job update endpoint for recording data and other updates
  // app.put('/api/jobs/:id', verifyToken, async (req: any, res) => {
  //   try {
  //     const jobId = parseInt(req.params.id);
  //     const { recordingData, ...otherUpdates } = req.body;

  //     const job = await storage.getJob(jobId);
  //     if (!job) {
  //       return res.status(404).json({ message: 'Job not found' });
  //     }

  //     // Check if user has access to update this job
  //     if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     const updateData: any = { ...otherUpdates };
      
  //     // Handle recording data if provided
  //     if (recordingData) {
  //       updateData.recordingFileKey = recordingData.fileKey;
  //       updateData.recordingFileUrl = recordingData.fileUrl;
  //       updateData.recordingFileName = recordingData.fileName;
  //       updateData.recordingDuration = recordingData.duration;
  //       updateData.recordingStartedAt = recordingData.recordedAt ? new Date(recordingData.recordedAt) : null;
  //       updateData.recordingUploadedAt = recordingData.uploadedAt ? new Date(recordingData.uploadedAt) : new Date();
  //       updateData.recordingParticipantCount = recordingData.participants;
  //       updateData.recordingSessionId = recordingData.sessionId;
  //       updateData.recordingLiveSessionId = recordingData.liveSessionId;
  //       updateData.recordingMetadata = recordingData;
        
  //       console.log(`✅ Recording data updated for job ${jobId}:`, {
  //         fileKey: recordingData.fileKey,
  //         duration: recordingData.duration,
  //         participants: recordingData.participants
  //       });
  //     }

  //     const updatedJob = await storage.updateJob(jobId, updateData);
  //     res.json(updatedJob);
  //   } catch (error) {
  //     console.error('Update job error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

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
  //   try {
  //     let invoices: Invoice[];
  //     if (hasAdminPrivileges(req.user)) {
  //       // Admin gets all invoices - for demo purposes, return empty array
  //       invoices = [];
  //     } else if (req.user.role === 'notary') {
  //       invoices = await storage.getInvoicesByNotaryId(req.user.id);
  //     } else {
  //       invoices = await storage.getInvoicesByClientId(req.user.id);
  //     }
  //     res.json(invoices);
  //   } catch (error) {
  //     console.error('Get invoices error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.post('/api/invoices', verifyToken, async (req: any, res) => {
  //   try {
  //     const invoiceNumber = await storage.generateInvoiceNumber();
  //     const invoice = await storage.createInvoice({
  //       ...req.body,
  //       invoiceNumber
  //     });
  //     res.json(invoice);
  //   } catch (error) {
  //     console.error('Create invoice error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.put('/api/invoices/:id', verifyToken, async (req: any, res) => {
  //   try {
  //     const invoiceId = parseInt(req.params.id);
  //     const invoice = await storage.updateInvoice(invoiceId, req.body);
      
  //     if (!invoice) {
  //       return res.status(404).json({ message: 'Invoice not found' });
  //     }
      
  //     res.json(invoice);
  //   } catch (error) {
  //     console.error('Update invoice error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // // Closing Types management routes (Admin only)
  // app.get('/api/closing-types', verifyToken, cacheAdminData(600), async (req: any, res) => {
  //   try {
  //     const closingTypes = await storage.getClosingTypes();
  //     res.json(closingTypes);
  //   } catch (error) {
  //     console.error('Get closing types error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.get('/api/closing-types/active', verifyToken, async (req: any, res) => {
  //   try {
  //     const closingTypes = await storage.getActiveClosingTypes();
  //     res.json(closingTypes);
  //   } catch (error) {
  //     console.error('Get active closing types error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.post('/api/closing-types', verifyToken, async (req: any, res) => {
  //   try {
  //     if (req.user.role !== 'admin') {
  //       return res.status(403).json({ message: 'Admin access required' });
  //     }

  //     const closingType = await storage.createClosingType(req.body);
  //     res.json(closingType);
  //   } catch (error) {
  //     console.error('Create closing type error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.put('/api/closing-types/:id', verifyToken, async (req: any, res) => {
  //   try {
  //     if (!hasAdminPrivileges(req.user)) {
  //       return res.status(403).json({ message: 'Admin access required' });
  //     }

  //     const closingTypeId = parseInt(req.params.id);
  //     const closingType = await storage.updateClosingType(closingTypeId, req.body);
      
  //     if (!closingType) {
  //       return res.status(404).json({ message: 'Closing type not found' });
  //     }
      
  //     res.json(closingType);
  //   } catch (error) {
  //     console.error('Update closing type error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.delete('/api/closing-types/:id', verifyToken, async (req: any, res) => {
  //   try {
  //     if (!hasAdminPrivileges(req.user)) {
  //       return res.status(403).json({ message: 'Admin access required' });
  //     }

  //     const closingTypeId = parseInt(req.params.id);
  //     const deleted = await storage.deleteClosingType(closingTypeId);
      
  //     if (!deleted) {
  //       return res.status(404).json({ message: 'Closing type not found' });
  //     }
      
  //     res.json({ message: 'Closing type deleted successfully' });
  //   } catch (error) {
  //     console.error('Delete closing type error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // Participant Roles management routes
  // app.get('/api/participant-roles', verifyToken, cacheAdminData(600), async (req: any, res) => {
  //   try {
  //     const roles = await storage.getParticipantRoles();
  //     res.json(roles);
  //   } catch (error) {
  //     console.error('Get participant roles error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.get('/api/participant-roles/active', verifyToken, async (req: any, res) => {
  //   try {
  //     const roles = await storage.getActiveParticipantRoles();
  //     res.json(roles);
  //   } catch (error) {
  //     console.error('Get active participant roles error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.post('/api/participant-roles', verifyToken, async (req: any, res) => {
  //   try {
  //     if (!hasAdminPrivileges(req.user)) {
  //       return res.status(403).json({ message: 'Admin access required' });
  //     }

  //     const roleData = req.body;
  //     const role = await storage.createParticipantRole(roleData);
  //     res.status(201).json(role);
  //   } catch (error) {
  //     console.error('Create participant role error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.put('/api/participant-roles/:id', verifyToken, async (req: any, res) => {
  //   try {
  //     if (!hasAdminPrivileges(req.user)) {
  //       return res.status(403).json({ message: 'Admin access required' });
  //     }

  //     const roleId = parseInt(req.params.id);
  //     const updateData = req.body;
  //     const role = await storage.updateParticipantRole(roleId, updateData);
      
  //     if (!role) {
  //       return res.status(404).json({ message: 'Participant role not found' });
  //     }
      
  //     res.json(role);
  //   } catch (error) {
  //     console.error('Update participant role error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.delete('/api/participant-roles/:id', verifyToken, async (req: any, res) => {
  //   try {
  //     if (!hasAdminPrivileges(req.user)) {
  //       return res.status(403).json({ message: 'Admin access required' });
  //     }

  //     const roleId = parseInt(req.params.id);
  //     const deleted = await storage.deleteParticipantRole(roleId);
      
  //     if (!deleted) {
  //       return res.status(404).json({ message: 'Participant role not found' });
  //     }
      
  //     res.json({ message: 'Participant role deleted successfully' });
  //   } catch (error) {
  //     console.error('Delete participant role error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // Whereby video session routes
  // app.post('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
  //   try {
  //     const jobId = parseInt(req.params.jobId);
  //     const job = await storage.getJob(jobId);
      
  //     if (!job) {
  //       return res.status(404).json({ message: 'Job not found' });
  //     }

  //     console.log('Creating Whereby video session for job:', jobId);
      
  //     // Import Whereby service
  //     const { wherebyService } = await import('./lib/whereby-service');
      
  //     // Calculate end time (2 hours from now for notary sessions)
  //     const endDate = new Date();
  //     endDate.setHours(endDate.getHours() + 2);

  //     // Create Whereby meeting
  //     const meetingOptions = {
  //       roomNamePrefix: `notary-session-${jobId}`,
  //       roomMode: 'normal' as const,
  //       endDate: endDate.toISOString(),
  //       fields: ['hostRoomUrl']
  //     };

  //     const meeting = await wherebyService.createMeeting(meetingOptions);
      
  //     console.log('Whereby video session created:', {
  //       meetingId: meeting.meetingId,
  //       roomUrl: meeting.roomUrl,
  //       endDate: meeting.endDate
  //     });
      
  //     res.json({
  //       success: true,
  //       sessionId: meeting.meetingId,
  //       roomUrl: meeting.roomUrl,
  //       hostRoomUrl: meeting.hostRoomUrl,
  //       roomName: meeting.roomName,
  //       meetingId: meeting.meetingId,
  //       sessionToken: meeting.meetingId,
  //       endDate: meeting.endDate,
  //       technology: 'whereby',
  //       jobId
  //     });
  //   } catch (error) {
  //     console.error('Create Whereby video session error:', error);
  //     res.status(500).json({ 
  //       message: 'Failed to create Whereby video session',
  //       error: error instanceof Error ? error.message : 'Unknown error'
  //     });
  //   }
  // });

  // app.get('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
  //   try {
  //     const jobId = parseInt(req.params.jobId);
  //     const job = await storage.getJob(jobId);
      
  //     if (!job) {
  //       return res.status(404).json({ message: 'Job not found' });
  //     }

  //     // Check for active video sessions (in a real implementation, you'd query your database)
  //     // For now, return active session info or placeholder
  //     const sessionInfo = {
  //       jobId,
  //       isActive: false,
  //       participants: [],
  //       recordings: [],
  //       technology: 'webrtc',
  //       signalingPath: '/video-signaling',
  //       message: 'No active video session. Create one by starting a live signing session.'
  //     };

  //     res.json(sessionInfo);
  //   } catch (error) {
  //     console.error('Get video session error:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // });

  // app.post('/api/jobs/:jobId/video-session/recording', verifyToken, async (req: any, res) => {
  //   try {
  //     const jobId = parseInt(req.params.jobId);
  //     const { recordingUrl, duration, participants, meetingId } = req.body;
      
  //     // Store recording metadata in your database
  //     // In a real implementation, you would save this to your database
  //     const recordingData = {
  //       jobId,
  //       meetingId,
  //       recordingUrl,
  //       duration,
  //       participants,
  //       createdAt: new Date().toISOString(),
  //       createdBy: req.user.id,
  //       complianceStatus: 'recorded',
  //       auditTrail: {
  //         sessionStart: new Date(Date.now() - duration * 1000).toISOString(),
  //         sessionEnd: new Date().toISOString(),
  //         participantCount: participants?.length || 0
  //       }
  //     };

  //     console.log('Recording metadata saved:', {
  //       jobId,
  //       meetingId,
  //       duration: `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`,
  //       participants: participants?.length || 0
  //     });

  //     res.json({
  //       success: true,
  //       recordingId: `recording-${jobId}-${Date.now()}`,
  //       message: 'Recording metadata saved successfully',
  //       complianceVerified: true
  //     });
  //   } catch (error) {
  //     console.error('Save recording error:', error);
  //     res.status(500).json({ message: 'Failed to save recording metadata' });
  //   }
  // });

  // app.delete('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
  //   try {
  //     const jobId = parseInt(req.params.jobId);
  //     const { sessionId } = req.body;
      
  //     if (sessionId) {
  //       console.log(`Ending WebRTC video session ${sessionId} for job ${jobId}`);
        
  //       // In a real implementation, you would:
  //       // 1. Signal the WebRTC service to end the session
  //       // 2. Clean up any recordings
  //       // 3. Update the database
  //       // For now, we'll just log the action
  //     }
      
  //     // Update job status to completed if needed
  //     const job = await storage.getJob(jobId);
  //     if (job && job.jobStatus === 'in_progress') {
  //       await storage.updateJob(jobId, {
  //         jobStatus: 'completed',
  //         completedAt: new Date(),
  //         completedBy: req.user.id
  //       });
  //     }
      
  //     console.log(`WebRTC video session ended for job ${jobId}`);
      
  //     res.json({
  //       success: true,
  //       message: 'WebRTC video session ended successfully',
  //       jobStatus: 'completed',
  //       technology: 'webrtc'
  //     });
  //   } catch (error) {
  //     console.error('End WebRTC video session error:', error);
  //     res.status(500).json({ message: 'Failed to end WebRTC video session' });
  //   }
  // });

  // // Get session recordings for compliance
  // app.get('/api/jobs/:jobId/recordings', verifyToken, async (req: any, res) => {
  //   try {
  //     const jobId = parseInt(req.params.jobId);
  //     const job = await storage.getJob(jobId);
      
  //     if (!job) {
  //       return res.status(404).json({ message: 'Job not found' });
  //     }

  //     // Check if user has access to this job
  //     if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }

  //     console.log(`Getting recordings for job ${jobId}`);
      
  //     // In a real implementation, you would query the database for actual recordings
  //     // For now, return empty recordings list
  //     const recordings: any[] = [];
      
  //     res.json({
  //       success: true,
  //       jobId,
  //       recordings,
  //       technology: 'webrtc',
  //       message: recordings.length > 0 ? 'Recordings retrieved successfully' : 'No recordings found for this session'
  //     });
  //   } catch (error) {
  //     console.error('Get recordings error:', error);
  //     res.status(500).json({ message: 'Failed to retrieve recordings' });
  //   }
  // });

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
    app.get('/api/uploads/:type/:fileId', verifyToken, getUploadedFile);


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

  
  
  const { registerTextTagRoutes } = await import('./routes/text-tag-routes');
  registerTextTagRoutes(app);
  
  app.use('/api/admin', adminLogsRoutes);
  app.use('/api/notary', notaryVerificationRoutes);
  app.use('/api', screenRecordingRoutes);
  
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

      res.json(verificationUsers.rows || []);
    } catch (error) {
      console.error('Error fetching verification users:', error);
      res.status(500).json({ error: 'Failed to fetch verification users' });
    }
  });

  // Password reset and setup routes
  app.post('/api/auth/validate-password-reset-token', passwordResetLimiter, async (req, res) => {
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

      res.json({ 
        message: 'Password set successfully',
        autoLogin: true,
        token: authToken,
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
          isNotary
        }
      });
    } catch (error) {
      console.error('Password setup error:', error);
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
        // Upload front image
        const frontResult = await VultrUploadHandler.handleSignatureUpload(
          files.frontImage[0].buffer,
          `front-id-${userId}-${Date.now()}.jpg`,
          sessionId,
          parseInt(userId),
          'id_verification'
        );
        
        if (frontResult.success) {
          uploadedFiles.frontImage = frontResult.fileKey;
        }

        // Upload back image if provided
        if (files.backImage && files.backImage[0]) {
          const backResult = await VultrUploadHandler.handleSignatureUpload(
            files.backImage[0].buffer,
            `back-id-${userId}-${Date.now()}.jpg`,
            sessionId,
            parseInt(userId),
            'id_verification'
          );
          
          if (backResult.success) {
            uploadedFiles.backImage = backResult.fileKey;
          }
        }

        // Upload selfie image
        const selfieResult = await VultrUploadHandler.handleSignatureUpload(
          files.selfieImage[0].buffer,
          `selfie-${userId}-${Date.now()}.jpg`,
          sessionId,
          parseInt(userId),
          'id_verification'
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

        await db.update(users).set(updateData).where(eq(users.id, parseInt(userId)));

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
          storageType: 'vultr'
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
        data: result,
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

  // Get session state and participants - OPTIMIZED VERSION
  app.get('/api/session/:sessionId/state', verifyToken, cacheJobData(30), async (req: any, res) => {
    const startTime = Date.now();
    
    try {
      const { sessionId } = req.params;

      console.log(`📡 Session state request for: ${sessionId} by user ${req.user.id}`);

      const { LiveSigningSessionService } = await import('./services/session/LiveSigningSessionService');
      
      const sessionState = await LiveSigningSessionService.getSessionState(sessionId);
      
      const duration = Date.now() - startTime;
      
      if (duration > 1000) {
        console.log(`🐌 SLOW REQUEST: {
  method: 'GET',
  url: '/api/session/${sessionId}/state',
  duration: '${duration}ms',
  statusCode: 200,
  requestId: 'req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}',
  userId: ${req.user.id}
}`);
      }
      
      res.json({
        success: true,
        data: sessionState
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Get session state error:', error, `(${duration}ms)`);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get session state',
        error: 'get_session_state_failed'
      });
    }
  });

  // Set active user (for user switching via keyboard shortcuts)
  app.post('/api/session/:sessionId/set-active-user', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: 'userId is required' });
      }

      const { LiveSigningSessionService } = await import('./services/session/LiveSigningSessionService');
      
      await LiveSigningSessionService.setActiveUser(sessionId, userId);
      
      res.json({
        success: true,
        message: 'Active user set successfully'
      });
      
    } catch (error) {
      console.error('Set active user error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to set active user',
        error: 'set_active_user_failed'
      });
    }
  });

  // Sync all users to notary view
  app.post('/api/session/:sessionId/sync-users', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { pageNumber, documentId } = req.body;
      const userId = req.user.id;

      // Verify user is notary
      const [user] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user || user.role !== 'notary') {
        return res.status(403).json({ 
          message: 'Only notaries can sync users',
          error: 'insufficient_permissions'
        });
      }

      // Import WebSocket service and trigger sync
      const { WebSocketService } = await import('./services/editor/WebSocketService');
      
      // Broadcast sync command to all session participants
      const syncMessage = {
        type: 'sync_to_notary',
        payload: {
          sessionId,
          pageNumber: pageNumber || 1,
          documentId: documentId || null,
          syncedBy: userId,
          notaryName: user.role, // You might want to get the actual user name
          timestamp: Date.now()
        },
        userId: userId.toString(),
        sessionId,
        timestamp: Date.now()
      };

      // Send sync message to all participants in the session
      WebSocketService.broadcastToSession(sessionId, syncMessage);
      
      res.json({
        success: true,
        message: `All users synced to page ${pageNumber || 1}`,
        pageNumber: pageNumber || 1,
        documentId: documentId || null
      });
      
    } catch (error) {
      console.error('Sync users error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to sync users',
        error: 'sync_users_failed'
      });
    }
  });

  // Pause session
  app.post('/api/session/:sessionId/pause', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      const { LiveSigningSessionService } = await import('./services/session/LiveSigningSessionService');
      
      const result = await LiveSigningSessionService.pauseSession(sessionId, userId, reason);
      
      res.json({
        success: true,
        data: result,
        message: 'Session paused successfully'
      });
      
    } catch (error) {
      console.error('Pause session error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to pause session',
        error: 'pause_session_failed'
      });
    }
  });

  // Resume session
  app.post('/api/session/:sessionId/resume', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      const { LiveSigningSessionService } = await import('./services/session/LiveSigningSessionService');
      
      const result = await LiveSigningSessionService.resumeSession(sessionId, userId);
      
      res.json({
        success: true,
        data: result,
        message: 'Session resumed successfully'
      });
      
    } catch (error) {
      console.error('Resume session error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to resume session',
        error: 'resume_session_failed'
      });
    }
  });

  // Check if user can interact with session
  app.get('/api/session/:sessionId/can-interact/:userId', verifyToken, async (req: any, res) => {
    try {
      const { sessionId, userId } = req.params;

      const { LiveSigningSessionService } = await import('./services/session/LiveSigningSessionService');
      
      const canInteract = await LiveSigningSessionService.canUserInteract(sessionId, parseInt(userId));
      
      res.json({
        success: true,
        data: { canInteract }
      });
      
    } catch (error) {
      console.error('Check interaction permission error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to check permissions',
        error: 'check_interaction_failed'
      });
    }
  });

  // Complete live signing session
  app.post('/api/session/:sessionId/complete', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { force = false } = req.body;
      console.log(`📝 Completing session: ${sessionId} by user ${req.user.id}`);

      // Get session using editor session service
      const { SessionService } = await import('./services/editor/SessionService');
      const { LiveSigningSessionService } = await import('./services/session/LiveSigningSessionService');
      
      let session;
      let actualSessionId = sessionId;
      
      try {
        // First try to get session directly
        session = await SessionService.getSession(sessionId);
        
        if (session) {
          actualSessionId = session.id;
          console.log(`✅ Found session by sessionId: ${actualSessionId}`);
        }
      } catch (error) {
        console.log(`🔍 Session not found by sessionId, checking if it's a jobId...`);
      }
      
      // If session not found by sessionId, try to find by jobId (backward compatibility)
      if (!session) {
        const jobId = parseInt(sessionId);
        
        if (!isNaN(jobId)) {
          // Look for the most recent active session for this job
          const sessions = await db
            .select()
            .from(editorSessions)
            .where(eq(editorSessions.jobId, jobId))
            .orderBy(desc(editorSessions.createdAt))
            .limit(1);
          
          if (sessions.length > 0) {
            const sessionData = sessions[0];
            session = {
              id: sessionData.sessionId,
              jobId: sessionData.jobId,
              sessionType: sessionData.sessionType,
              status: sessionData.status,
              notaryId: sessionData.notaryId,
              videoSessionId: sessionData.videoSessionId,
              createdAt: sessionData.createdAt,
              startedAt: sessionData.startedAt,
              completedAt: sessionData.completedAt
            };
            actualSessionId = sessionData.sessionId;
            console.log(`✅ Found session by jobId: ${actualSessionId}`);
          }
        }
      }
      
      if (!session) {
        return res.status(404).json({ 
          message: 'Session not found',
          error: 'session_not_found'
        });
      }

      // Check if session is already completed
      if (session.status === 'completed') {
        return res.status(200).json({
          success: true,
          message: 'Session was already completed',
          sessionId: actualSessionId,
          alreadyCompleted: true
        });
      }

      // Verify user permissions
      const isAdmin = req.user.role === 'admin' || (req.user.privileges && req.user.privileges.includes('admin'));
      const isAssignedNotary = session.notaryId === req.user.id;
      
      if (!isAssignedNotary && !isAdmin) {
        return res.status(403).json({ 
          message: 'Only the assigned notary or admin can complete the session',
          error: 'insufficient_permissions'
        });
      }

      // For live signing sessions, handle completion
      if (session.sessionType === 'notary' || session.sessionType === 'tagging') {
        try {
          // Get all tags for validation
          const { TagService } = await import('./services/editor/TagService');
          const tags = await TagService.getSessionTags(actualSessionId);
          
          console.log(`📊 Session completion validation - Total tags: ${tags.length}`);
          
          // Tags will only be marked as completed when users manually click and fill them
          // No auto-completion needed - tags are just markers for the tagging session
          
          console.log(`📊 Validation results:`);
          console.log(`  - Total tags: ${tags.length}`);
          console.log(`  - Completed tags: ${tags.filter(t => t.isCompleted).length}`);
          
          // For tagging sessions: Allow completion regardless of tag completion status
          // For live signing sessions: Only allow completion if users have filled their assigned tags
          if (session.sessionType === 'notary') {
            // Live signing session - check if tags have real content from users
            const incompleteTags = tags.filter(tag => !tag.isCompleted);
            
            if (incompleteTags.length > 0 && !force) {
              console.log(`❌ Live signing session completion blocked - users haven't filled all tags:`, incompleteTags.map(t => ({
                id: t.id,
                type: t.tagType,
                assignedUser: t.assignedUserId,
                hasContent: !!(t.content && t.content.trim())
              })));
              
              return res.status(400).json({
                success: false,
                message: `Cannot complete session: ${incompleteTags.length} tags haven't been filled by users`,
                error: 'incomplete_user_tags',
                canForce: true,
                incompleteTags: incompleteTags.map(t => ({
                  id: t.id,
                  type: t.tagType,
                  assignedUser: t.assignedUserId,
                  note: 'User needs to click this tag to fill it with real content'
                }))
              });
            }
          }
          
          // For tagging sessions, no validation needed - tags are just markers

                               // Generate final PDF with real user content (only for live signing sessions)
          if (session.sessionType === 'notary' && tags.length > 0 && tags.some(t => t.isCompleted)) {
            try {
              const { PDFProcessorService } = await import('./services/pdf-processor.service');
              const pdfProcessor = PDFProcessorService.getInstance();
              
              // Process the document and apply real content
              const processedDoc = await pdfProcessor.processCompletedDocument(actualSessionId);
              
              if (processedDoc && processedDoc.buffer) {
                // Upload signed PDF to Vultr cloud storage
                try {
                  const { VultrUploadHandler } = await import('./vultr-upload-handler');
                  
                  const signedFileName = `job_${session.jobId}_signed_${Date.now()}.pdf`;
                  
                  // Upload to Vultr with proper organization
                  const uploadResult = await VultrUploadHandler.handleJobDocumentUpload(
                    processedDoc.buffer,
                    signedFileName,
                    session.jobId,
                    req.user.id,
                    {
                      documentType: 'signed_document',
                      isRequired: false,
                      sessionId: actualSessionId,
                      signedAt: new Date().toISOString(),
                      processedTags: tags.length,
                      completedTags: tags.filter(t => t.isCompleted).length
                    }
                  );
                  
                  if (uploadResult.success) {
                                  console.log(`✅ Generated final document with real user content: ${signedFileName} (${processedDoc.fileSize} bytes)`);
              console.log(`📁 Vultr location: ${uploadResult.fileKey}`);
              console.log(`📊 Applied ${tags.filter(t => t.isCompleted).length} user-filled tags to document`);
                    
                    // Also save to local uploads directory as backup
                    const fs = await import('fs/promises');
                    const path = await import('path');
                    const uploadsDir = path.resolve('uploads/signed');
                    
                    try {
                      await fs.mkdir(uploadsDir, { recursive: true });
                      const localPath = path.join(uploadsDir, signedFileName);
                      await fs.writeFile(localPath, processedDoc.buffer);
                      console.log(`📁 Local backup saved: ${signedFileName}`);
                    } catch (localError) {
                      console.warn('Failed to save local backup:', localError);
                      // Don't fail on local backup error
                    }
                    
                  } else {
                    throw new Error(`Failed to upload signed PDF: ${uploadResult.error}`);
                  }
                  
                } catch (uploadError) {
                  console.error('❌ Failed to upload signed PDF to Vultr:', uploadError);
                  
                  // Fallback: Save to local uploads directory only
                  const fs = await import('fs/promises');
                  const path = await import('path');
                  const uploadsDir = path.resolve('uploads/signed');
                  
                  await fs.mkdir(uploadsDir, { recursive: true });
                  const signedFileName = `job_${session.jobId}_signed_${Date.now()}.pdf`;
                  const signedFilePath = path.join(uploadsDir, signedFileName);
                  await fs.writeFile(signedFilePath, processedDoc.buffer);
                  
                  console.log(`📁 Fallback: Saved signed PDF locally: ${signedFileName}`);
                }
                
                // Update job status to indicate signed documents are available
                await db
                  .update(jobs)
                  .set({
                    status: 'completed',
                    completedAt: new Date()
                  })
                  .where(eq(jobs.id, session.jobId));
              }
              
            } catch (pdfError) {
              console.error('❌ Failed to generate final signed PDF:', pdfError);
              // Don't fail the completion, just log the error
              console.warn('Session marked as completed but PDF generation failed');
            }
          }
          
          // Complete the live signing session
          await LiveSigningSessionService.completeSession(actualSessionId, req.user.id);
          
        } catch (error) {
          console.error('Error during live signing completion:', error);
          // Don't fail completely, still mark session as completed
        }
      }
      
      // Mark session as completed
      await SessionService.updateSessionStatus(actualSessionId, 'completed', {
        completedAt: new Date()
      });
      
      console.log(`✅ Session completed: ${actualSessionId} by user ${req.user.id}`);
      
      res.json({
        success: true,
        message: 'Session completed successfully',
        sessionId: actualSessionId,
        completedAt: new Date()
      });
      
    } catch (error) {
      console.error('Complete session error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to complete session',
        error: 'complete_session_failed'
      });
    }
  });

  // ==========================================
  // EDITOR ROUTES - PDF Tagging & Signing Sessions
  // ==========================================

  // Create editor session from job
  app.post('/api/editor/job/:jobId/session', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { sessionType = 'tagging', videoSessionId } = req.body;
      
      if (!jobId || isNaN(jobId)) {
        return res.status(400).json({ message: 'Invalid job ID' });
      }
      
      // Check if job exists and has a notary assigned
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
        
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }
      
      // If no notary is assigned to the job, try to auto-assign based on current user
      if (!job.notaryId && !job.selectedNotary) {
        console.log(`⚠️ Job ${jobId} has no notary assigned. Attempting auto-assignment...`);
        
        // Auto-assign notary if current user can be the notary
        if (hasAdminPrivileges(req.user) || 
            (req.user.role === 'notary' && req.user.notaryType === 'subscriber')) {
          
          await db
            .update(jobs)
            .set({
              notaryId: req.user.id,
              selectedNotary: req.user.id.toString(),
              notaryApprovalStatus: 'approved'
            })
            .where(eq(jobs.id, jobId));
            
          console.log(`✅ Auto-assigned ${req.user.role} as notary for job ${jobId}`);
        } else {
          return res.status(400).json({ 
            message: 'This job has no notary assigned. Please assign a notary before starting the tagging session.',
            error: 'no_notary_assigned',
            suggestion: 'Contact an administrator to assign a notary to this job.'
          });
        }
      }
      
      // Import SessionService dynamically
      const { SessionService } = await import('./services/editor/SessionService');
      
      // Get the updated job data to get the correct notary ID
      const [updatedJob] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
      
      if (!updatedJob) {
        return res.status(404).json({ message: 'Job not found after update' });
      }
      
      // Use notaryId if available, otherwise parse selectedNotary
      let notaryId = updatedJob.notaryId;
      if (!notaryId && updatedJob.selectedNotary) {
        notaryId = parseInt(updatedJob.selectedNotary);
        if (isNaN(notaryId)) {
          return res.status(400).json({ 
            message: 'Invalid notary assignment. Please check the job configuration.',
            error: 'invalid_notary_id'
          });
        }
      }
      
      if (!notaryId) {
        return res.status(400).json({ 
          message: 'No notary assigned to this job. Please assign a notary before starting the session.',
          error: 'no_notary_assigned'
        });
      }
      
      const session = await SessionService.createSession({
        jobId,
        sessionType,
        notaryId,
        videoSessionId
      });
      
      res.json({
        success: true,
        session,
        message: `${sessionType} session created successfully`
      });
      
    } catch (error) {
      console.error('Create editor session error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to create session',
        error: 'session_creation_failed'
      });
    }
  });

  // Get editor session data
  app.get('/api/editor/session/:sessionId', verifyToken, cacheJobData(120), async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      
      const { SessionService } = await import('./services/editor/SessionService');
      
      const session = await SessionService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // Get session documents and participants
      const [documents, participants] = await Promise.all([
        SessionService.getSessionDocuments(session.jobId),
        SessionService.getSessionParticipants(session.jobId)
      ]);
      
      res.json({
        session,
        documents,
        participants
      });
      
    } catch (error) {
      console.error('Get editor session error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get session',
        error: 'session_fetch_failed'
      });
    }
  });

  // Update session status
  app.put('/api/editor/session/:sessionId/status', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { status, startedAt, completedAt } = req.body;
      
      const { SessionService } = await import('./services/editor/SessionService');
      
      await SessionService.updateSessionStatus(sessionId, status, {
        startedAt: startedAt ? new Date(startedAt) : undefined,
        completedAt: completedAt ? new Date(completedAt) : undefined
      });
      
      res.json({
        success: true,
        message: `Session status updated to ${status}`
      });
      
    } catch (error) {
      console.error('Update session status error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to update session',
        error: 'session_update_failed'
      });
    }
  });

  // Get job participants for editor
  app.get('/api/jobs/:jobId/participants', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      const { SessionService } = await import('./services/editor/SessionService');
      
      const participants = await SessionService.getSessionParticipants(jobId);
      
      res.json({
        participants,
        count: participants.length
      });
      
    } catch (error) {
      console.error('Get job participants error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get participants',
        error: 'participants_fetch_failed'
      });
    }
  });

  // Get existing sessions for a job
  app.get('/api/jobs/:jobId/sessions', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      if (!jobId || isNaN(jobId)) {
        return res.status(400).json({ message: 'Invalid job ID' });
      }
      
      // Query editor_sessions table for this job
      const existingSessions = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.jobId, jobId))
        .orderBy(desc(editorSessions.createdAt));
      
      // Convert to the expected format with sessionId as id for frontend compatibility
      const formattedSessions = existingSessions.map(session => ({
        id: session.sessionId, // Use sessionId as the id field for frontend
        dbId: session.id, // Keep database ID for reference
        jobId: session.jobId,
        sessionType: session.sessionType,
        status: session.status,
        notaryId: session.notaryId,
        videoSessionId: session.videoSessionId,
        createdAt: session.createdAt,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        updatedAt: session.updatedAt
      }));
      
      res.json({
        sessions: formattedSessions,
        count: formattedSessions.length
      });
      
    } catch (error) {
      console.error('Get job sessions error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get sessions',
        error: 'sessions_fetch_failed'
      });
    }
  });

  // Cancel editor session
  app.delete('/api/editor/session/:sessionId', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      
      const { SessionService } = await import('./services/editor/SessionService');
      
      await SessionService.cancelSession(sessionId);
      
      res.json({
        success: true,
        message: 'Session cancelled successfully'
      });
      
    } catch (error) {
      console.error('Cancel session error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to cancel session',
        error: 'session_cancel_failed'
      });
    }
  });

  // ==========================================
  // TAG MANAGEMENT ROUTES - Place, Update, Delete Tags
  // ==========================================

  // Place a new tag
  app.post('/api/editor/session/:sessionId/place-tag', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { documentId, tagType, coordinates, assignedUserId } = req.body;
      
      console.log('🏷️ Place tag request received:', {
        sessionId,
        documentId,
        tagType,
        coordinates,
        assignedUserId: assignedUserId,
        requestUserId: req.user.id,
        requestUserRole: req.user.role,
        finalAssignedUserId: assignedUserId || req.user.id
      });
      
      if (!documentId || !tagType || !coordinates) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // ✅ SERVER-SIDE AUTHORIZATION: Check if user can place tags
      // Get session info to determine if this is a signing session
      const { SessionService } = await import('./services/editor/SessionService');
      const session = await SessionService.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // In signing sessions (notary mode), only notaries and admins can place new tags
      if (session.sessionType === 'notary' || session.sessionType === 'tagging') {
        const userRole = req.user.role;
        const isNotary = userRole === 'notary';
        const isAdmin = userRole === 'admin';
        
        if (!isNotary && !isAdmin) {
          console.log(`❌ Authorization failed: ${userRole} (${req.user.id}) cannot place tags in signing session`);
          return res.status(403).json({ 
            message: 'Only notaries and admins can place new tags during signing sessions',
            error: 'insufficient_permissions'
          });
        }
        
        console.log(`✅ Authorization passed: ${userRole} (${req.user.id}) can place tags in signing session`);
      }
      
      const { TagService } = await import('./services/editor/TagService');
      
      const tag = await TagService.placeTag({
        sessionId,
        documentId,
        tagType,
        coordinates,
        assignedUserId: assignedUserId || req.user.id,
        placedBy: req.user.id
      });
      
      res.json({
        success: true,
        tag,
        message: 'Tag placed successfully'
      });
      
    } catch (error) {
      console.error('Place tag error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to place tag',
        error: 'tag_place_failed'
      });
    }
  });

  // Get all tags for a session, optionally filtered by document
  app.get('/api/editor/session/:sessionId/tags', verifyToken, cacheJobData(10), async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { documentId } = req.query;
      
      const { TagService } = await import('./services/editor/TagService');
      
      let tags;
      if (documentId) {
        // Get tags for specific document
        tags = await TagService.getDocumentTags(sessionId, documentId);
      } else {
        // Get all tags for session
        tags = await TagService.getSessionTags(sessionId);
      }
      
      res.json({
        tags,
        count: tags.length,
        documentId: documentId || null,
        timestamp: Date.now() // Include timestamp to ensure fresh data
      });
      
    } catch (error) {
      console.error('Get tags error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get tags',
        error: 'tags_fetch_failed'
      });
    }
  });

  // Update a tag

app.put('/api/editor/session/:sessionId/tag/:tagId/content', verifyToken, async (req: any, res) => {
  try {
    const { sessionId, tagId } = req.params;
    const { content, fontSize, fontFamily, textColor } = req.body;

    console.log('🔍 Received tag content update:', { tagId, content, fontSize, fontFamily, textColor });

    // Validate input
    if (content === undefined || content === null) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const numericTagId = parseInt(tagId);
    const numericSessionId = parseInt(sessionId);
    if (isNaN(numericTagId) || isNaN(numericSessionId)) {
      return res.status(400).json({ message: 'Invalid tag or session ID' });
    }

    // Fetch the tag
    const [tag] = await db
      .select({
        id: documentTags.id,
        sessionId: documentTags.sessionId,
        tagType: documentTags.tagType,
        assignedUserId: documentTags.assignedUserId,
        content: documentTags.content,
        contentData: documentTags.contentData,
        isCompleted: documentTags.isCompleted,
        pageNumber: documentTags.pageNumber,
        xPosition: documentTags.xPosition,
        yPosition: documentTags.yPosition,
        width: documentTags.width,
        height: documentTags.height,
      })
      .from(documentTags)
      .where(eq(documentTags.id, numericTagId))
      .limit(1);

    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    if (tag.sessionId !== numericSessionId) {
      return res.status(400).json({ message: 'Tag does not belong to the specified session' });
    }

    // Prepare content data
    const contentData = {
      type: tag.tagType === 'S' ? 'signature' : tag.tagType === 'D' ? 'date' : 'text',
      value: content.toString(),
      fontSize: fontSize || 12,
      fontFamily: fontFamily || 'Arial',
      textColor: textColor || '#000000',
      timestamp: new Date().toISOString(),
    };

    // Update tag
    const updateData: any = {
      content: content.toString(),
      contentType: contentData.type,
      contentData: JSON.stringify(contentData),
      isCompleted: content.toString().trim().length > 0,
      updatedBy: req.user.id,
      updatedAt: new Date(),
      ...(content.toString().trim().length > 0 && {
        completedBy: req.user.id,
        completedAt: new Date(),
      }),
    };

    const [updatedTag] = await db.transaction(async (tx) => {
      return await tx
        .update(documentTags)
        .set(updateData)
        .where(eq(documentTags.id, numericTagId))
        .returning({
          id: documentTags.id,
          sessionId: documentTags.sessionId,
          tagType: documentTags.tagType,
          assignedUserId: documentTags.assignedUserId,
          content: documentTags.content,
          contentData: documentTags.contentData,
          isCompleted: documentTags.isCompleted,
          pageNumber: documentTags.pageNumber,
          xPosition: documentTags.xPosition,
          yPosition: documentTags.yPosition,
          width: documentTags.width,
          height: documentTags.height,
        });
    });

    if (!updatedTag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    // Fetch user for display label and color
    let user = null;
    let colorCode = USER_COLORS[0]; // Default color
    if (updatedTag.assignedUserId) {
      [user] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, updatedTag.assignedUserId))
        .limit(1);

      // Check sessionParticipants for userColor
      const [participant] = await db
        .select({ userColor: sessionParticipants.userColor })
        .from(sessionParticipants)
        .where(
          and(
            eq(sessionParticipants.sessionId, numericSessionId),
            eq(sessionParticipants.userId, updatedTag.assignedUserId)
          )
        )
        .limit(1);

      colorCode = participant?.userColor || getUserColor(user);
    }

    const displayLabel = user
      ? `✏️ ${contentData.type === 'signature' ? 'Signature' : contentData.type === 'date' ? 'Date' : 'Text'} - ${user.firstName} ${user.lastName}`
      : `✏️ ${contentData.type === 'signature' ? 'Signature' : contentData.type === 'date' ? 'Date' : 'Text'}`;

    console.log(`✅ Tag content updated for tag ${tagId}: "${content}"`);

    res.json({
      success: true,
      tag: {
        id: updatedTag.id.toString(),
        content: updatedTag.content,
        fontSize: contentData.fontSize,
        fontFamily: contentData.fontFamily,
        textColor: contentData.textColor,
        isCompleted: updatedTag.isCompleted,
        displayLabel,
        colorCode,
        contentData,
        updatedAt: updatedTag.updatedAt,
        sessionId: updatedTag.sessionId,
        tagType: updatedTag.tagType,
        assignedUserId: updatedTag.assignedUserId,
        pageNumber: updatedTag.pageNumber,
        xPosition: updatedTag.xPosition,
        yPosition: updatedTag.yPosition,
        width: updatedTag.width,
        height: updatedTag.height,
      },
      message: 'Tag content saved successfully',
    });
  } catch (error) {
    console.error('Update tag content error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to update tag content',
      error: 'tag_content_update_failed',
    });
  }
});

  // Delete a tag
  app.delete('/api/editor/session/:sessionId/tag/:tagId', verifyToken, async (req: any, res) => {
    try {
      const { sessionId, tagId } = req.params;
      
      // ✅ SERVER-SIDE AUTHORIZATION: Check if user can delete tags
      const { SessionService } = await import('./services/editor/SessionService');
      const session = await SessionService.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // In signing sessions, only notaries and admins can delete tags
      if (session.sessionType === 'notary' || session.sessionType === 'tagging') {
        const userRole = req.user.role;
        const isNotary = userRole === 'notary';
        const isAdmin = userRole === 'admin';
        
        if (!isNotary && !isAdmin) {
          console.log(`❌ Authorization failed: ${userRole} (${req.user.id}) cannot delete tags in signing session`);
          return res.status(403).json({ 
            message: 'Only notaries and admins can delete tags during signing sessions',
            error: 'insufficient_permissions'
          });
        }
        
        console.log(`✅ Authorization passed: ${userRole} (${req.user.id}) can delete tags in signing session`);
      }
      
      const { TagService } = await import('./services/editor/TagService');
      
      await TagService.deleteTag(tagId, req.user.id);
      
      res.json({
        success: true,
        message: 'Tag deleted successfully'
      });
      
    } catch (error) {
      console.error('Delete tag error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to delete tag',
        error: 'tag_delete_failed'
      });
    }
  });

  // Remove the replace-all endpoint as tags should only be filled by user interaction

  // Removed duplicate endpoint - keeping the more comprehensive one below

  // Get default content for a tag (auto-fill functionality)

  

  // Click to fill tag with profile data (auto-fill from user profile)
  app.post('/api/editor/session/:sessionId/tag/:tagId/fill', verifyToken, async (req: any, res) => {
    try {
      const { sessionId, tagId } = req.params;
      
      const { TagService } = await import('./services/editor/TagService');
      
      // Get tag details first
      const tags = await TagService.getSessionTags(sessionId);
      const tag = tags.find(t => t.id === tagId);
      
      if (!tag) {
        return res.status(404).json({ message: 'Tag not found' });
      }
      
      // Get user profile data (assigned user for the tag)
      const userId = parseInt(tag.assignedUserId) || req.user.id;
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (!user) {
        return res.status(404).json({ message: 'User profile not found' });
      }
      
      // Generate content from profile based on tag type
      let content = '';
      let contentType = 'text';
      let contentData = null;
      
      switch (tag.tagType) {
        case 'A': // Name tag
          content = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || '[Name not set in profile]';
          break;
          
        case 'S': // Signature tag
          if (user.signatureImage) {
            content = user.signatureImage;
            contentType = 'signature';
            contentData = { type: 'signature', value: user.signatureImage };
          } else if (user.signatureData) {
            content = user.signatureData;
            contentType = 'signature';
            contentData = { type: 'signature', value: user.signatureData };
          } else if (user.signatureTyped) {
            content = user.signatureTyped;
            contentType = 'text';
            contentData = { type: 'typed_signature', value: user.signatureTyped };
          } else {
            content = '[Please upload signature in profile]';
          }
          break;
          
        case 'I': // Initials tag
          if (user.initialsImage) {
            content = user.initialsImage;
            contentType = 'signature';
            contentData = { type: 'initials', value: user.initialsImage };
          } else if (user.initialData) {
            content = user.initialData;
            contentType = 'signature';
            contentData = { type: 'initials', value: user.initialData };
          } else if (user.initialsTyped) {
            content = user.initialsTyped;
            contentType = 'text';
            contentData = { type: 'typed_initials', value: user.initialsTyped };
          } else if (user.firstName && user.lastName) {
            // Auto-generate initials from name
            content = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
            contentData = { type: 'generated_initials', value: content };
          } else {
            content = '[Please set initials in profile]';
          }
          break;
          
        case 'D': // Date tag
          content = new Date().toLocaleDateString();
          contentType = 'date';
          contentData = { type: 'current_date', value: content };
          break;
          
        case 'N': // Commission Number
          content = user.commissionNumber || '[Commission number not set in profile]';
          break;
          
        case 'X': // Commission Expiration
          content = user.commissionExpiration || '[Expiration date not set in profile]';
          contentType = 'date';
          break;
          
        case 'O': // Disclosure
          content = user.disclosure || '[Disclosure statement not set in profile]';
          break;
          
        case 'E': // Notary Seal
          content = '[Notary Seal Applied]';
          contentType = 'seal';
          contentData = { type: 'notary_seal', notaryId: userId, appliedAt: new Date().toISOString() };
          break;
          
        case 'T': // Text tag
          content = ''; // Text tags start empty
          break;
          
        case 'W': // Whiteout
          content = ''; // Whiteout tags have no content
          contentType = 'whiteout';
          break;
          
        default:
          content = `[${tag.tagType} tag]`;
      }
      
      // Update tag with profile content and mark as completed
      const updatedTag = await TagService.updateTag(tagId, {
        content,
        contentType,
        contentData: contentData ? JSON.stringify(contentData) : null,
        isCompleted: true,
        completedBy: req.user.id,
        completedAt: new Date(),
        updatedBy: req.user.id
      });
      
      res.json({
        success: true,
        tag: updatedTag,
        message: `Tag filled with ${user.firstName || 'user'}'s profile data`,
        profile: {
          userName: user.fullName || `${user.firstName} ${user.lastName}`,
          userRole: user.role
        }
      });
      
    } catch (error) {
      console.error('Fill tag error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to fill tag with profile data',
        error: 'tag_fill_failed'
      });
    }
  });

  // Update tag content (for manual content entry)
app.put('/api/editor/session/:sessionId/tag/:tagId/content', verifyToken, async (req: any, res) => {
  try {
    const { sessionId, tagId } = req.params;
    const { content, fontSize, fontFamily, textColor } = req.body;

    console.log('🔍 Received tag content update:', { tagId, content, fontSize, fontFamily, textColor });

    if (content === undefined || content === null) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const numericTagId = parseInt(tagId);
    const numericSessionId = parseInt(sessionId);
    if (isNaN(numericTagId) || isNaN(numericSessionId)) {
      return res.status(400).json({ message: 'Invalid tag or session ID' });
    }

    // Fetch the tag
    const [tag] = await db
      .select({
        id: documentTags.id,
        sessionId: documentTags.sessionId,
        tagType: documentTags.tagType,
        assignedUserId: documentTags.assignedUserId,
        content: documentTags.content,
        contentData: documentTags.contentData,
        isCompleted: documentTags.isCompleted,
        pageNumber: documentTags.pageNumber,
        xPosition: documentTags.xPosition,
        yPosition: documentTags.yPosition,
        width: documentTags.width,
        height: documentTags.height,
      })
      .from(documentTags)
      .where(eq(documentTags.id, numericTagId))
      .limit(1);

    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    if (tag.sessionId !== numericSessionId) {
      return res.status(400).json({ message: 'Tag does not belong to the specified session' });
    }

    // Prepare content data
    const contentData = {
      type: tag.tagType === 'S' ? 'signature' : tag.tagType === 'D' ? 'date' : 'text',
      value: content.toString(),
      fontSize: fontSize || 12,
      fontFamily: fontFamily || 'Arial',
      textColor: textColor || '#000000',
      timestamp: new Date().toISOString(),
    };

    // Update tag
    const updateData: any = {
      content: content.toString(),
      contentType: contentData.type,
      contentData: JSON.stringify(contentData),
      isCompleted: content.toString().trim().length > 0,
      updatedBy: req.user.id,
      updatedAt: new Date(),
      ...(content.toString().trim().length > 0 && {
        completedBy: req.user.id,
        completedAt: new Date(),
      }),
    };

    const [updatedTag] = await db.transaction(async (tx) => {
      return await tx
        .update(documentTags)
        .set(updateData)
        .where(eq(documentTags.id, numericTagId))
        .returning({
          id: documentTags.id,
          sessionId: documentTags.sessionId,
          tagType: documentTags.tagType,
          assignedUserId: documentTags.assignedUserId,
          content: documentTags.content,
          contentData: documentTags.contentData,
          isCompleted: documentTags.isCompleted,
          pageNumber: documentTags.pageNumber,
          xPosition: documentTags.xPosition,
          yPosition: documentTags.yPosition,
          width: documentTags.width,
          height: documentTags.height,
        });
    });

    if (!updatedTag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    // Fetch user for display label and color
    let user = null;
    let colorCode = USER_COLORS[0]; // Default color
    if (updatedTag.assignedUserId) {
      [user] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, updatedTag.assignedUserId))
        .limit(1);

      // Check sessionParticipants for userColor
      const [participant] = await db
        .select({ userColor: sessionParticipants.userColor })
        .from(sessionParticipants)
        .where(
          eq(sessionParticipants.sessionId, numericSessionId)
          .and(eq(sessionParticipants.userId, updatedTag.assignedUserId))
        )
        .limit(1);

      colorCode = participant?.userColor || getUserColor(user);
    }

    const displayLabel = user
      ? `✏️ ${contentData.type === 'signature' ? 'Signature' : contentData.type === 'date' ? 'Date' : 'Text'} - ${user.firstName} ${user.lastName}`
      : `✏️ ${contentData.type === 'signature' ? 'Signature' : contentData.type === 'date' ? 'Date' : 'Text'}`;

    console.log(`✅ Tag content updated for tag ${tagId}: "${content}"`);

    res.json({
      success: true,
      tag: {
        id: updatedTag.id.toString(),
        content: updatedTag.content,
        fontSize: contentData.fontSize,
        fontFamily: contentData.fontFamily,
        textColor: contentData.textColor,
        isCompleted: updatedTag.isCompleted,
        displayLabel,
        colorCode,
        contentData,
        updatedAt: updatedTag.updatedAt,
        sessionId: updatedTag.sessionId,
        tagType: updatedTag.tagType,
        assignedUserId: updatedTag.assignedUserId,
        pageNumber: updatedTag.pageNumber,
        xPosition: updatedTag.xPosition,
        yPosition: updatedTag.yPosition,
        width: updatedTag.width,
        height: updatedTag.height,
      },
      message: 'Tag content saved successfully',
    });
  } catch (error) {
    console.error('Update tag content error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to update tag content',
      error: 'tag_content_update_failed',
    });
  }
});

  // Validate user profile completeness for tag types
  app.post('/api/editor/validate-profile', verifyToken, async (req: any, res) => {
    try {
      const { userId, tagTypes } = req.body;
      
      if (!userId || !tagTypes || !Array.isArray(tagTypes)) {
        return res.status(400).json({ 
          message: 'Missing required fields: userId and tagTypes array' 
        });
      }
      
      // Allow users to check their own profile or admins/notaries to check any profile
      if (req.user.id !== parseInt(userId) && !['admin', 'notary'].includes(req.user.role)) {
        return res.status(403).json({ 
          message: 'Access denied: You can only validate your own profile' 
        });
      }
      
      const { TagService } = await import('./services/editor/TagService');
      
      const validation = await TagService.validateUserProfileForTags(parseInt(userId), tagTypes);
      
      res.json({
        success: true,
        validation,
        recommendations: validation.missingFields.length > 0 ? {
          message: 'Profile incomplete for optimal tag experience',
          action: 'Please complete missing profile fields before session',
          priority: validation.missingFields.some(f => ['A', 'S', 'I'].includes(f.tagType)) ? 'high' : 'medium'
        } : {
          message: 'Profile is complete for requested tag types',
          action: 'Ready for tagging session'
        }
      });
      
    } catch (error) {
      console.error('Profile validation error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to validate profile',
        error: 'profile_validation_failed'
      });
    }
  });
// server/routes/editor.ts
app.put('/api/editor/session/:sessionId/text-tag/:tagId/content', verifyToken, async (req: any, res) => {
  try {
    const { sessionId, tagId } = req.params;
    const { content, fontSize, fontFamily, textColor } = req.body;

    console.log('🔍 Received text tag content update:', { tagId, content, fontSize, fontFamily, textColor });

    if (content === undefined || content === null) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const numericTagId = parseInt(tagId);
    const numericSessionId = parseInt(sessionId);
    if (isNaN(numericTagId) || isNaN(numericSessionId)) {
      return res.status(400).json({ message: 'Invalid tag or session ID' });
    }

    // Fetch and validate tag
    const [tag] = await db
      .select({
        id: documentTags.id,
        sessionId: documentTags.sessionId,
        tagType: documentTags.tagType,
        assignedUserId: documentTags.assignedUserId,
        content: documentTags.content,
        contentData: documentTags.contentData,
        isCompleted: documentTags.isCompleted,
        pageNumber: documentTags.pageNumber,
        xPosition: documentTags.xPosition,
        yPosition: documentTags.yPosition,
        width: documentTags.width,
        height: documentTags.height,
      })
      .from(documentTags)
      .where(
        eq(documentTags.id, numericTagId)
        .and(eq(documentTags.tagType, 'T'))
      )
      .limit(1);

    if (!tag) {
      return res.status(404).json({ message: 'Text tag not found' });
    }

    if (tag.sessionId !== numericSessionId) {
      return res.status(400).json({ message: 'Tag does not belong to the specified session' });
    }

    // Prepare content data
    const contentData = {
      type: 'text',
      value: content.toString(),
      fontSize: fontSize || 12,
      fontFamily: fontFamily || 'Arial',
      textColor: textColor || '#000000',
      timestamp: new Date().toISOString(),
    };

    // Update tag
    const updateData: any = {
      content: content.toString(),
      contentType: 'text',
      contentData: JSON.stringify(contentData),
      isCompleted: content.toString().trim().length > 0,
      updatedBy: req.user.id,
      updatedAt: new Date(),
      ...(content.toString().trim().length > 0 && {
        completedBy: req.user.id,
        completedAt: new Date(),
      }),
    };

    const [updatedTag] = await db.transaction(async (tx) => {
      return await tx
        .update(documentTags)
        .set(updateData)
        .where(eq(documentTags.id, numericTagId))
        .returning({
          id: documentTags.id,
          sessionId: documentTags.sessionId,
          tagType: documentTags.tagType,
          assignedUserId: documentTags.assignedUserId,
          content: documentTags.content,
          contentData: documentTags.contentData,
          isCompleted: documentTags.isCompleted,
          pageNumber: documentTags.pageNumber,
          xPosition: documentTags.xPosition,
          yPosition: documentTags.yPosition,
          width: documentTags.width,
          height: documentTags.height,
        });
    });

    if (!updatedTag) {
      return res.status(404).json({ message: 'Text tag not found' });
    }

    // Fetch user for display label and color
    let user = null;
    let colorCode = USER_COLORS[0];
    if (updatedTag.assignedUserId) {
      [user] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, updatedTag.assignedUserId))
        .limit(1);

      const [participant] = await db
        .select({ userColor: sessionParticipants.userColor })
        .from(sessionParticipants)
        .where(
          eq(sessionParticipants.sessionId, numericSessionId)
          .and(eq(sessionParticipants.userId, updatedTag.assignedUserId))
        )
        .limit(1);

      colorCode = participant?.userColor || getUserColor(user);
    }

    const displayLabel = user
      ? `✏️ Text - ${user.firstName} ${user.lastName}`
      : `✏️ Text`;

    console.log(`✅ Text tag content updated for tag ${tagId}: "${content}"`);

    res.json({
      success: true,
      tag: {
        id: updatedTag.id.toString(),
        content: updatedTag.content,
        fontSize: contentData.fontSize,
        fontFamily: contentData.fontFamily,
        textColor: contentData.textColor,
        isCompleted: updatedTag.isCompleted,
        displayLabel,
        colorCode,
        contentData,
        updatedAt: updatedTag.updatedAt,
        sessionId: updatedTag.sessionId,
        tagType: updatedTag.tagType,
        assignedUserId: updatedTag.assignedUserId,
        pageNumber: updatedTag.pageNumber,
        xPosition: updatedTag.xPosition,
        yPosition: updatedTag.yPosition,
        width: updatedTag.width,
        height: updatedTag.height,
      },
      message: 'Text tag content saved successfully',
    });
  } catch (error) {
    console.error('Update text tag content error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to update text tag content',
      error: 'text_tag_content_update_failed',
    });
  }
});
  // Complete tagging session
  app.post('/api/editor/session/:sessionId/complete', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { force = false } = req.body; // Allow force completion even with incomplete tags
      
      const { SessionService } = await import('./services/editor/SessionService');
      const { TagService } = await import('./services/editor/TagService');
      
      // Get session info
      const session = await SessionService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // Get all tags for validation
      const tags = await TagService.getSessionTags(sessionId);
      
      if (session.status === 'completed') {
        return res.status(200).json({ 
          message: 'Session was already completed',
          sessionId,
          alreadyCompleted: true,
          document: {
            taggedDocumentReady: true,
            tagsPlaced: tags.length,
            message: 'Tagged document is ready for live signing session'
          }
        });
      }
      
      // Check if there are any tags placed
      if (tags.length === 0 && !force) {
        return res.status(400).json({ 
          message: 'Cannot complete session: No tags have been placed',
          error: 'no_tags_placed',
          canForce: true
        });
      }
      
      // Optional: Check for minimum required tags (can be customized based on business rules)
      const participantCount = (await SessionService.getSessionParticipants(session.jobId)).length;
      const minimumTags = Math.max(1, participantCount); // At least one tag per participant
      
      if (tags.length < minimumTags && !force) {
        return res.status(400).json({
          message: `Recommended minimum of ${minimumTags} tags not met (${tags.length} placed)`,
          error: 'insufficient_tags',
          canForce: true,
          placed: tags.length,
          recommended: minimumTags
        });
      }
      
      // For tagging sessions: Save tagged document configuration (NOT final PDF yet)
      // For live signing sessions: Generate final PDF with real content applied
      let documentInfo = null;
      
      if (session.sessionType === 'tagging') {
        // Tagging completion: Just save the tag configuration
        console.log(`📋 Tagging session completed: ${sessionId} with ${tags.length} tags placed`);
        
        // The "tagged document" is the combination of:
        // 1. Original PDF document (unchanged)
        // 2. Tag metadata in database (already saved via TagService)
        // This will be used later in the live signing session
        
        documentInfo = {
          taggedDocumentReady: true,
          tagsPlaced: tags.length,
          message: 'Tagged document configuration saved for live signing session',
          canContinueEditing: true,
          note: 'You can start tagging again to continue editing these tags'
        };
        
      } else if (tags.length > 0 && tags.some(tag => tag.isCompleted)) {
        // Live signing completion: Generate final PDF with real content
        try {
          console.log(`✍️ Generating final PDF for live signing session: ${sessionId}`);
          console.log(`📊 Tags status: ${tags.filter(t => t.isCompleted).length}/${tags.length} completed`);
          
          // Check if all required tags are completed
          const incompleteTags = tags.filter(tag => !tag.isCompleted && tag.isRequired !== false);
          if (incompleteTags.length > 0 && !force) {
            return res.status(400).json({
              message: `Cannot complete session: ${incompleteTags.length} required tags are not completed`,
              error: 'incomplete_required_tags',
              canForce: true,
              incompleteTags: incompleteTags.map(t => ({
                id: t.id,
                type: t.tagType,
                assignedUser: t.assignedUserId
              }))
            });
          }
          
          const { PDFProcessorService } = await import('./services/pdf-processor.service');
          const pdfProcessor = PDFProcessorService.getInstance();
          
          // Process the document and apply real content (not placeholder tags)
          const processedDoc = await pdfProcessor.processCompletedDocument(sessionId);
          
          // Save to uploads directory
          const fs = await import('fs/promises');
          const path = await import('path');
          const uploadsDir = path.resolve('uploads/signed');
          
          // Ensure directory exists
          try {
            await fs.mkdir(uploadsDir, { recursive: true });
          } catch (mkdirError) {
            console.log('Uploads directory already exists or created');
          }
          
          const signedFileName = `job_${session.jobId}_signed_${Date.now()}.pdf`;
          const signedFilePath = path.join(uploadsDir, signedFileName);
          
          // Write the signed PDF
          await fs.writeFile(signedFilePath, processedDoc.buffer);
          
          // Create document version record
          const [documentVersion] = await db.insert(documentVersions).values({
            originalDocumentId: session.jobId,
            sessionId: parseInt(sessionId),
            versionNumber: 1,
            fileName: signedFileName,
            filePath: signedFilePath,
            fileSize: processedDoc.fileSize,
            status: 'completed',
            digitalCertificateApplied: false
          }).returning();
          
          // Update job status to indicate signed documents are available
          await db
            .update(jobs)
            .set({
              status: 'completed',
              completedAt: new Date(),
              signedDocumentId: documentVersion.id
            })
            .where(eq(jobs.id, session.jobId));
          
          documentInfo = {
            documentVersionId: documentVersion.id,
            fileName: signedFileName,
            fileSize: processedDoc.fileSize,
            downloadUrl: `/api/documents/signed/${encodeURIComponent(signedFileName)}`,
            message: 'Final signed PDF generated successfully'
          };
          
          console.log(`✅ Generated signed PDF: ${signedFileName} (${processedDoc.fileSize} bytes)`);
          
        } catch (pdfError) {
          console.error('❌ Failed to generate final signed PDF:', pdfError);
          // Don't fail the completion, just log the error
          console.warn('Session marked as completed but PDF generation failed');
        }
      }
      
      // Mark session as completed
      await SessionService.updateSessionStatus(sessionId, 'completed', {
        completedAt: new Date()
      });
      
      console.log(`✅ Tagging session completed: ${sessionId} by user ${req.user.id}`);
      
      res.json({
        success: true,
        message: 'Tagging session completed successfully',
        sessionId,
        completedAt: new Date(),
        document: documentInfo,
        stats: {
          totalTags: tags.length,
          completedTags: tags.filter(tag => tag.isCompleted).length,
          participantCount
        }
      });
      
    } catch (error) {
      console.error('Complete tagging session error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to complete session',
        error: 'session_completion_failed'
      });
    }
  });

  // Legacy signed document serving - REMOVED
  // All signed documents are now stored in Vultr cloud storage
  // Use document-specific download routes instead

  // Handle preflight OPTIONS requests for document serving
  app.options('/api/documents/:filePath(*)', (req: any, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
  });

    // Serve documents with Vultr cloud storage and local fallback
  app.get('/api/documents/:filePath(*)', async (req: any, res) => {
    try {
      const filePath = decodeURIComponent(req.params.filePath);
      console.log('📄 Document request for:', filePath);
      
      // Set response timeout to prevent hanging
      req.setTimeout(30000); // 30 second timeout
      res.setTimeout(30000);
      
      const { cloudStorage } = await import('./lib/cloud-storage-service');
      
      // Check if cloud storage is properly configured
      const bucketStats = await cloudStorage.getBucketStats();
      console.log('☁️ Cloud storage status:', bucketStats);
      
      if (bucketStats.isAccessible) {
        // Try Vultr cloud storage first
        try {
          console.log('☁️ Attempting Vultr cloud storage for:', filePath);
          
          // Check if file exists in Vultr with timeout
          const fileExists = await Promise.race([
            cloudStorage.fileExists(filePath),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout checking file existence')), 10000))
          ]);
          
          if (!fileExists) {
            console.log('📄 Document not found in Vultr, trying local fallback:', filePath);
            throw new Error('File not found in cloud storage');
          }
          
          // Generate signed URL with timeout
          const signedUrl = await Promise.race([
            cloudStorage.getSignedUrl(filePath, 3600),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout generating signed URL')), 10000))
          ]);
          
          console.log('🔗 Generated Vultr signed URL for:', filePath);
          
          // Check if this is a development mock URL
          if (signedUrl.includes('/dev-storage/')) {
            console.log('🔄 Received dev storage URL, falling back to local');
            throw new Error('Development mode - falling back to local storage');
          }
          
          // Set proper headers for PDF viewing including CORS
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Cache-Control', 'private, max-age=300');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.setHeader('X-Served-From', 'vultr-cloud');
          
          // Implement fetch with timeout and retry logic
          const fetchWithTimeout = async (url: string, timeoutMs: number = 20000, retries: number = 1): Promise<Response> => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            try {
              const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                  'User-Agent': 'USA-Notary-Service/1.0'
                }
              });
              clearTimeout(timeoutId);
              return response;
            } catch (error: any) {
              clearTimeout(timeoutId);
              
              if (error.name === 'AbortError' && retries > 0) {
                console.warn(`⏰ Vultr fetch timeout, retrying... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
                return fetchWithTimeout(url, timeoutMs, retries - 1);
              }
              throw error;
            }
          };
          
          // Fetch PDF content with shorter timeout for faster fallback
          const pdfResponse = await fetchWithTimeout(signedUrl, 15000, 1); // 15 second timeout, 1 retry
          
          if (!pdfResponse.ok) {
            throw new Error(`Failed to fetch PDF from Vultr: ${pdfResponse.status} ${pdfResponse.statusText}`);
          }
          
          const pdfBuffer = await pdfResponse.arrayBuffer();
          console.log('✅ Successfully served document from Vultr:', filePath);
          res.send(Buffer.from(pdfBuffer));
          return;
          
        } catch (vultrError: any) {
          console.warn('⚠️ Vultr failed, attempting local fallback:', vultrError.message);
          // Don't return error yet, try local fallback
        }
      } else {
        console.log('⚠️ Vultr not accessible, using local fallback for:', filePath);
      }
      
      // LOCAL STORAGE FALLBACK - Check if file exists locally
      const path = await import('path');
      const fs = await import('fs/promises');
      
      // Try different local paths where the file might exist
      const possibleLocalPaths = [
        path.resolve('uploads', filePath),
        path.resolve('uploads', 'documents', filePath),
        path.resolve(filePath.startsWith('/') ? filePath.substring(1) : filePath),
        path.resolve(filePath)
      ];
      
      let localFilePath = null;
      let fileStats = null;
      
      for (const possiblePath of possibleLocalPaths) {
        try {
          fileStats = await fs.stat(possiblePath);
          if (fileStats.isFile()) {
            localFilePath = possiblePath;
            console.log('📁 Found local file at:', localFilePath);
            break;
          }
        } catch (e) {
          // File doesn't exist at this path, continue checking
        }
      }
      
      if (localFilePath && fileStats) {
        try {
          // Serve local file
          console.log('📁 Serving local file:', localFilePath);
          
          // Set appropriate headers
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Cache-Control', 'private, max-age=300');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.setHeader('X-Served-From', 'local-storage');
          res.setHeader('Content-Length', fileStats.size.toString());
          
          const fileBuffer = await fs.readFile(localFilePath);
          res.send(fileBuffer);
          return;
          
        } catch (localError: any) {
          console.error('📁 Local file serving failed:', localError);
        }
      }
      
      // If we get here, both Vultr and local storage failed
      console.error('❌ Document not found in Vultr or local storage:', filePath);
      res.setHeader('Content-Type', 'application/json');
      return res.status(404).json({ 
        error: 'Document not found',
        message: 'The requested PDF file does not exist on the server.',
        filePath: filePath,
        timestamp: new Date().toISOString(),
        searchedPaths: possibleLocalPaths,
        vultrStatus: bucketStats.isAccessible ? 'accessible' : 'not accessible'
      });
      
    } catch (error) {
      console.error('📄 Document serving error:', error);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to serve document due to server error.',
        timestamp: new Date().toISOString()
      });
    }
  });

  // User Notarization & Audit Logs Routes
  
  // Get user's notarization logs
  app.get('/api/user/notarization-logs', verifyToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // For now, return empty array until notary log entries are populated
      const logs: any[] = [];
      
      // TODO: Uncomment when notary_log_entries table has data
      // const logs = await db
      //   .select({
      //     id: notaryLogEntries.id,
      //     sessionId: notaryLogEntries.sessionId,
      //     notaryId: notaryLogEntries.notaryId,
      //     signerId: notaryLogEntries.signerId,
      //     documentId: notaryLogEntries.documentId,
      //     notarizationType: notaryLogEntries.notarizationType,
      //     pageNumber: notaryLogEntries.pageNumber,
      //     timestamp: notaryLogEntries.timestamp,
      //     createdAt: notaryLogEntries.createdAt,
      //   })
      //   .from(notaryLogEntries)
      //   .where(
      //     or(
      //       eq(notaryLogEntries.notaryId, userId), // User was the notary
      //       eq(notaryLogEntries.signerId, userId)  // User was the signer
      //     )
      //   )
      //   .orderBy(desc(notaryLogEntries.timestamp))
      //   .limit(100);

      res.json(logs);
    } catch (error) {
      console.error('Error fetching user notarization logs:', error);
      res.status(500).json({ error: 'Failed to fetch notarization logs' });
    }
  });

  // Get user's audit trail
  app.get('/api/user/audit-trail', verifyToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // For now, return empty array until audit trail table has data
      const auditEntries: any[] = [];
      
      // TODO: Uncomment when audit_trail table has data
      // const auditEntries = await db
      //   .select()
      //   .from(auditTrail)
      //   .where(eq(auditTrail.userId, userId))
      //   .orderBy(desc(auditTrail.timestamp))
      //   .limit(200);

      res.json(auditEntries);
    } catch (error) {
      console.error('Error fetching user audit trail:', error);
      res.status(500).json({ error: 'Failed to fetch audit trail' });
    }
  });

  // Get user's system activity logs
  app.get('/api/user/activity-logs', verifyToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const activityLogs = await db
        .select()
        .from(systemActivityLogs)
        .where(eq(systemActivityLogs.userId, userId))
        .orderBy(desc(systemActivityLogs.createdAt))
        .limit(100);

      res.json(activityLogs);
    } catch (error) {
      console.error('Error fetching user activity logs:', error);
      res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
  });

  // Get user's notarization sessions
  app.get('/api/user/notarization-sessions', verifyToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // For now, return empty array until editor sessions table has data
      const sessions: any[] = [];
      
      // TODO: Uncomment when editor_sessions table has data
      // const sessions = await db
      //   .select()
      //   .from(editorSessions)
      //   .where(eq(editorSessions.notaryId, userId))
      //   .orderBy(desc(editorSessions.startedAt))
      //   .limit(50);

      res.json(sessions);
    } catch (error) {
      console.error('Error fetching user notarization sessions:', error);
      res.status(500).json({ error: 'Failed to fetch notarization sessions' });
    }
  });

  // Download user logs as PDF
  app.get('/api/user/download-logs', verifyToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const type = req.query.type as string;
      
      // For now, return a simple text response
      // In production, you'd generate a proper PDF using a library like PDFKit
      const timestamp = new Date().toISOString();
      const username = req.user.username || 'user';
      
      let content = `Sharp Note - ${type.toUpperCase()} Logs Report\n`;
      content += `Generated: ${timestamp}\n`;
      content += `User: ${username} (ID: ${userId})\n`;
      content += `\n${'='.repeat(50)}\n\n`;
      
      switch (type) {
        case 'notary':
          content += 'NOTARIZATION LOGS\n';
          content += 'This report contains all notarization activities for this user.\n';
          break;
        case 'audit':
          content += 'AUDIT TRAIL\n';
          content += 'This report contains all audit trail entries for this user.\n';
          break;
        case 'activity':
          content += 'SYSTEM ACTIVITY LOGS\n';
          content += 'This report contains all system activities for this user.\n';
          break;
        case 'sessions':
          content += 'NOTARIZATION SESSIONS\n';
          content += 'This report contains all notarization sessions for this user.\n';
          break;
        default:
          content += 'COMPREHENSIVE LOGS\n';
          content += 'This report contains all logs for this user.\n';
      }
      
      content += '\nNote: This is a simplified export. Full PDF generation with detailed logs will be implemented.\n';
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${username}_${type}_logs_${timestamp.split('T')[0]}.txt"`);
      res.send(content);
      
    } catch (error) {
      console.error('Error generating log export:', error);
      res.status(500).json({ error: 'Failed to generate log export' });
    }
  });

  // WebRTC diagnostic endpoint
  app.get('/api/webrtc/diagnostics', verifyToken, async (req: any, res) => {
    try {
      const diagnostics = {
        server: {
          nodeVersion: process.version,
          platform: process.platform,
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        },
        webrtc: {
          signalingServerRunning: true,
          socketIOPath: '/video-signaling/socket.io',
          corsOrigins: process.env.NODE_ENV === 'production' 
            ? [process.env.CLIENT_URL || "https://your-domain.com"]
            : ["http://localhost:3000", "http://localhost:3002", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:3002"],
          iceServers: [
            {
              urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302'
              ]
            }
          ]
        },
        authentication: {
          jwtSecret: process.env.JWT_SECRET ? 'configured' : 'missing',
          userId: req.user.id,
          userRole: req.user.role
        }
      };

      console.log('WebRTC diagnostics requested by user:', req.user.id);
      
      res.json({
        success: true,
        diagnostics
      });
    } catch (error) {
      console.error('WebRTC diagnostics error:', error);
      res.status(500).json({ 
        message: 'Failed to get WebRTC diagnostics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Vultr cloud storage diagnostic endpoint
  app.get('/api/diagnostics/storage', verifyToken, async (req: any, res) => {
    try {
      const { cloudStorage } = await import('./lib/cloud-storage-service');
      
      // Check required environment variables
      const requiredVars = [
        'VULTR_ACCESS_KEY',
        'VULTR_SECRET_KEY', 
        'VULTR_REGION',
        'VULTR_BUCKET_NAME',
        'VULTR_ENDPOINT'
      ];
      
      const envCheck = requiredVars.reduce((acc, varName) => {
        acc[varName] = process.env[varName] ? 'configured' : 'missing';
        return acc;
      }, {} as Record<string, string>);
      
      // Get bucket stats
      const bucketStats = await cloudStorage.getBucketStats();
      
      // Test a simple operation
      let testResult = { success: false, error: 'Not tested' };
      try {
        const testExists = await cloudStorage.fileExists('test-file-that-should-not-exist');
        testResult = { success: true, error: null };
      } catch (error) {
        testResult = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
      
      const diagnostics = {
        environment: {
          variables: envCheck,
          allConfigured: !Object.values(envCheck).includes('missing')
        },
        bucket: bucketStats,
        connectivity: testResult,
        recommendations: []
      };
      
      // Add recommendations based on findings
      if (!diagnostics.environment.allConfigured) {
        diagnostics.recommendations.push('Configure missing Vultr environment variables for cloud storage');
      }
      if (!diagnostics.bucket.isAccessible) {
        diagnostics.recommendations.push('Check Vultr credentials and bucket permissions');
      }
      if (!diagnostics.connectivity.success) {
        diagnostics.recommendations.push('Verify network connectivity to Vultr endpoints');
      }
      
      res.json({
        success: true,
        diagnostics,
        status: diagnostics.environment.allConfigured && diagnostics.bucket.isAccessible ? 'healthy' : 'degraded'
      });
      
    } catch (error) {
      console.error('Storage diagnostics error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to run storage diagnostics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}