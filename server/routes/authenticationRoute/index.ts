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
import { insertUserSchema } from "@shared/schema";

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
}
