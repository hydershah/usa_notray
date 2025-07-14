import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";
import { db } from "../../db";

import { auditLoggingService } from "../../services/audit-logging-service";
import { verifyToken, hasAdminPrivileges, hasNotaryPrivileges, type AuthUser } from "../../auth";

// Define the extended request interface for authentication
interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { redisCache } from "../../services/redis-cache";
import { eq} from "drizzle-orm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { 
  insertUserSchema, 
  users,
} from "@shared/schema";




const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

import { 
  authLimiter, 
  registrationLimiter, 
} from '../../middleware/rate-limiter';
import { 
  sanitizeHtml, 
  preventSqlInjection 
} from '../../middleware/sanitization';
import { 
  checkAccountLockout, 
  recordFailedLogin, 
  clearFailedAttempts 
} from '../../middleware/account-lockout';



export async function registerAuthenticationRoutes(app: Express): Promise<Server> {
  
  // Basic route handlers to prevent 404 errors
  // Only serve API response if we're not serving static files
  app.use((req: any, res: any, next: any) => {
    auditLoggingService.auditMiddleware()(req, res, next);
  });

  // Authentication routes
  app.post('/api/auth/login', authLimiter, checkAccountLockout, async (req, res) => {
    try {
      const { email, password, twoFactorCode } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        recordFailedLogin(email);
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        recordFailedLogin(email);
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check if 2FA is enabled for this user
      if (user.mfaEnabled) {
        if (!twoFactorCode) {
          // Return without token, indicating 2FA is required
          return res.json({
            requiresTwoFactor: true,
            message: 'Two-factor authentication is required'
          });
        }

        // Verify 2FA code
        if (!user.mfaSecret) {
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
          return res.status(401).json({ message: 'Invalid two-factor authentication code' });
        }
      }

      // Clear failed attempts on successful login
      clearFailedAttempts(email);

      // Generate token with privileges included
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          privileges: user.privileges || []
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Check privileges for frontend
      const isAdmin = hasAdminPrivileges(user);
      const isNotary = hasNotaryPrivileges(user);

      res.json({
        token,
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
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/register', registrationLimiter, sanitizeHtml, preventSqlInjection, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email as string);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password as string, 10);
      
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
        lastName: user.lastName
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/logout', verifyToken, async (req: any, res) => {
    try {
      // In a real application, you might want to:
      // 1. Add the token to a blacklist
      // 2. Update user's last logout time
      // 3. Log the logout event for audit purposes
      
      // For now, we'll just return success
      // The client will handle clearing localStorage
      res.json({ message: 'Logged out successfully' });
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
}