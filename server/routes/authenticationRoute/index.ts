import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";

import {
  verifyToken,
  hasAdminPrivileges,
  hasNotaryPrivileges,
  type AuthUser,
} from "../../auth";

interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { redisCache } from "../../services/redis-cache";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import speakeasy from "speakeasy";
import { insertUserSchema, passwordResetTokens, users } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

import {
  authLimiter,
  registrationLimiter,
} from "../../middleware/rate-limiter";
import {
  sanitizeHtml,
  preventSqlInjection,
} from "../../middleware/sanitization";
import {
  checkAccountLockout,
  recordFailedLogin,
  clearFailedAttempts,
} from "../../middleware/account-lockout";
import { db } from "server/db";
import { and, eq, gte } from "drizzle-orm";
import { emailService } from "server/lib/email-service";

export async function authenticationRoutes(app: Express): Promise<Server> {
  app.post(
    "/api/auth/login",
    authLimiter,
    checkAccountLockout,
    async (req, res) => {
      try {
        const { email, password, twoFactorCode } = req.body;

        if (!email || !password) {
          return res
            .status(400)
            .json({ message: "Email and password are required" });
        }

        const user = await storage.getUserByEmail(email);
        if (!user) {
          recordFailedLogin(email);
          return res.status(401).json({ message: "Invalid credentials" });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          recordFailedLogin(email);
          return res.status(401).json({ message: "Invalid credentials" });
        }
        if (user.mfaEnabled) {
          if (!twoFactorCode) {
            return res.json({
              requiresTwoFactor: true,
              message: "Two-factor authentication is required",
            });
          }

          // Verify 2FA code
          if (!user.mfaSecret) {
            return res.status(500).json({ message: "2FA configuration error" });
          }

          const verified = speakeasy.totp.verify({
            secret: user.mfaSecret,
            encoding: "base32",
            token: twoFactorCode,
            window: 2,
          });

          if (!verified) {
            recordFailedLogin(email);
            return res
              .status(401)
              .json({ message: "Invalid two-factor authentication code" });
          }
        }
        clearFailedAttempts(email);
        const token = jwt.sign(
          {
            id: user.id,
            email: user.email,
            role: user.role,
            privileges: user.privileges || [],
          },
          JWT_SECRET,
          { expiresIn: "24h" }
        );

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
            isAdmin,
            isNotary,
          },
        });
      } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.post(
    "/api/auth/register",
    registrationLimiter,
    sanitizeHtml,
    preventSqlInjection,
    async (req, res) => {
      try {
        const userData = insertUserSchema.parse(req.body);
        const existingUser = await storage.getUserByEmail(
          userData.email as string
        );
        if (existingUser) {
          return res.status(400).json({ message: "User already exists" });
        }
        const hashedPassword = await bcrypt.hash(
          userData.password as string,
          10
        );

        const user = await storage.createUser({
          ...userData,
          password: hashedPassword,
        });

        try {
          await redisCache.delPattern(`admin:*`); // Clear admin caches
          await redisCache.delPattern(`user:*`); // Clear all user caches
          await redisCache.delPattern(`api:*users*`); // Clear users API cache
          console.log(
            `🧹 Invalidated user caches after registration of user ${user.id}`
          );
        } catch (cacheError) {
          console.error(
            "Failed to invalidate cache after user registration:",
            cacheError
          );
        }

        res.status(201).json({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        });
      } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.get("/api/auth/me", verifyToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const isAdmin = hasAdminPrivileges(user);
      const isNotary = hasNotaryPrivileges(user);
      let companyInfo = null;
      if (user.role === "title_company" && user.companyId) {
        try {
          companyInfo = await storage.getCompany(user.companyId);
        } catch (error) {
          console.warn(
            "Failed to fetch company info for user:",
            user.id,
            error
          );
        }
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        privileges: user.privileges,
        isAdmin,
        isNotary,
        notaryType: user.notaryType,
        companyId: user.companyId,
        companyName: companyInfo?.companyName || null,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", verifyToken, async (req: any, res) => {
    try {
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Internal server error" });
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

 
}
