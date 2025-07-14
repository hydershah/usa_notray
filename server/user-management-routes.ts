import { Express } from "express";
import { insertUserSchema } from "../shared/schema.js";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { verifyToken, hasAdminPrivileges, type AuthUser } from "./auth.js";

import { redisCache } from "./services/redis-cache";
import { cacheAdminData, cacheUserData } from "./middleware/cache-middleware";

interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { eq, and, inArray } from "drizzle-orm";
import multer from "multer";

import { users } from "@shared/schema";
import { db } from "./db.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "text/plain",
      "video/mp4",
      "video/webm",
      "video/mov",
      "audio/wav",
      "audio/mp3",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Please upload PDF, DOC, DOCX, images, videos, or audio files only."
        )
      );
    }
  },
});

export function registerUserManagementRoutes(app: Express) {
  // ============================================================================
  // QUICK UPDATE ROUTES (for partial updates)
  // ============================================================================

  /**
   * PATCH /api/users/:id/quick-update
   * Update specific user fields without requiring all data
   */
  app.patch(
    "/api/users/:id/quick-update",
    verifyToken,
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.id);
        const updates = req.body;

        // Check permissions
        if (!hasAdminPrivileges(req.user) && req.user.id !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }

        // Remove empty/undefined values
        const cleanUpdates: any = {};
        Object.keys(updates).forEach((key) => {
          if (
            updates[key] !== undefined &&
            updates[key] !== "" &&
            updates[key] !== null
          ) {
            cleanUpdates[key] = updates[key];
          }
        });

        // Hash password if provided
        if (cleanUpdates.password) {
          cleanUpdates.password = await bcrypt.hash(cleanUpdates.password, 10);
        }

        // Update user with only the provided fields
        const updatedUser = await storage.updateUser(userId, cleanUpdates);

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Return updated user without password
        const { password, ...userResponse } = updatedUser;
        res.json(userResponse);
      } catch (error) {
        console.error("Quick update user error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  /**
   * PATCH /api/users/:id/status
   * Quick status toggle for users
   */
  app.patch("/api/users/:id/status", verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { isActive, approvalStatus } = req.body;

      // Check permissions - only admins can change user status
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const updates: any = {};
      if (isActive !== undefined) updates.isActive = isActive;
      if (approvalStatus !== undefined) updates.approvalStatus = approvalStatus;

      const updatedUser = await storage.updateUser(userId, updates);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: updatedUser.id,
        isActive: updatedUser.isActive,
        approvalStatus: updatedUser.approvalStatus,
      });
    } catch (error) {
      console.error("Update user status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * PATCH /api/users/:id/password
   * Quick password reset
   */
  app.patch("/api/users/:id/password", verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { password } = req.body;

      // Check permissions
      if (!hasAdminPrivileges(req.user) && req.user.id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!password || password.length < 6) {
        return res
          .status(400)
          .json({ message: "Password must be at least 6 characters" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const updatedUser = await storage.updateUser(userId, {
        password: hashedPassword,
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Update password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================================================
  // USER REGISTRATION ROUTES
  // ============================================================================

  /**
   * POST /api/auth/register-user
   * Universal user registration - supports all user types from requirements
   * User Types: admin, client, company_manager, notary, signer, witness, observer
   */
  app.post("/api/auth/register-user", async (req, res) => {
    try {
      const {
        // Universal required fields
        fullName,
        email,
        phoneNumber, // Cell phone from requirements
        password,

        // User type and role
        userType, // 'admin', 'client', 'company_user', 'notary', 'signer', 'witness', 'observer'

        // Address fields (required for signers to start sessions)
        address1,
        address2,
        city,
        state,
        zipCode,

        // Optional company association
        companyId,
        companyRole,

        // Notary-specific fields
        notaryType, // 'contractor' or 'subscriber'

        // Registration source
        registrationSource = "self", // 'self', 'company_invite', 'admin_create'
      } = req.body;

      // Validate universal required fields
      if (!fullName || !email || !phoneNumber || !password || !userType) {
        return res.status(400).json({
          message:
            "Missing required fields: fullName, email, phoneNumber, password, and userType are required",
        });
      }

      // Parse full name
      const nameParts = fullName.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res
          .status(409)
          .json({ message: "User with this email already exists" });
      }

      // Validate user type
      const validUserTypes = [
        "admin",
        "client",
        "company_user",
        "notary",
        "signer",
        "witness",
        "observer",
      ];
      if (!validUserTypes.includes(userType)) {
        return res.status(400).json({
          message: `Invalid user type. Must be one of: ${validUserTypes.join(", ")}`,
        });
      }

      // Set approval status based on user type and registration source
      let approvalStatus = "pending";
      let isActive = false;

      if (userType === "admin") {
        // Admin users require manual approval
        approvalStatus = "pending";
        isActive = false;
      } else if (userType === "notary") {
        // Notaries require admin approval as per requirements
        approvalStatus = "pending";
        isActive = false;
      } else if (userType === "company_user" && companyId) {
        // Company users may be auto-approved based on company settings
        const company = await storage.getCompany(companyId);
        if (company && !company.requiresApprovalForNewUsers) {
          approvalStatus = "approved";
          isActive = true;
        }
      } else {
        // Regular users (client, signer, witness, observer) are auto-approved
        approvalStatus = "approved";
        isActive = true;
      }

      // Prepare user data
      const userData = {
        username: email, // Use email as username
        email: email,
        password: password, // Will be hashed in storage
        firstName: firstName,
        lastName: lastName,
        fullName: fullName,
        phoneNumber: phoneNumber,

        // Address fields
        address1: address1,
        address2: address2,
        city: city,
        state: state,
        zipCode: zipCode,

        // Role and status
        role: userType,
        companyId: companyId,
        companyRole: companyRole,

        // Status and approval
        isActive: isActive,
        approvalStatus: approvalStatus,

        // Notary-specific
        notaryType: userType === "notary" ? notaryType || "contractor" : null,

        // Initialize other fields
        isNotificationsEnabled: true,
        mfaEnabled: false,

        // Foreign languages - default empty array
        foreignLanguages: [],
      };

      // Create user
      const newUser = await storage.createUser(userData);

      // Invalidate users cache to ensure fresh data on next request
      try {
        await redisCache.delPattern(`admin:*`); // Clear admin caches
        await redisCache.delPattern(`user:*`); // Clear all user caches
        await redisCache.delPattern(`api:*users*`); // Clear users API cache
        console.log(
          `🧹 Invalidated user caches after registration of user ${newUser.id}`
        );
      } catch (cacheError) {
        console.error(
          "Failed to invalidate cache after user registration:",
          cacheError
        );
        // Don't fail the request if cache invalidation fails
      }

      // Log the registration
      console.log(`New user registered: ${newUser.email} as ${userType}`);

      // Return response (exclude sensitive data)
      const response = {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        isActive: newUser.isActive,
        approvalStatus: newUser.approvalStatus,
        requiresApproval: approvalStatus === "pending",
        message:
          approvalStatus === "pending"
            ? "Registration successful. Your account is pending approval."
            : "Registration successful. You can now log in.",
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("User registration error:", error);
      res
        .status(500)
        .json({ message: "Internal server error during registration" });
    }
  });

  // ============================================================================
  // USER APPROVAL ROUTES (Admin Only)
  // ============================================================================

  /**
   * GET /api/admin/users/pending-approval
   * Get all users pending approval
   */
  app.get(
    "/api/admin/users/pending-approval",
    verifyToken,
    async (req: any, res) => {
      try {
        if (!hasAdminPrivileges(req.user)) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const pendingUsers = await storage.getUsersByApprovalStatus("pending");

        res.json(
          pendingUsers.map((user) => ({
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            notaryType: user.notaryType,
            phoneNumber: user.phoneNumber,
            address1: user.address1,
            city: user.city,
            state: user.state,
            createdAt: user.createdAt,
            lastProfileUpdate: user.lastProfileUpdate,

            // Notary-specific approval fields
            nameOnCommission: user.nameOnCommission,
            commissionNumber: user.commissionNumber,
            commissionExpiration: user.commissionExpiration,
            isNotarySigningAgent: user.isNotarySigningAgent,
            notarySigningAgentExpiration: user.notarySigningAgentExpiration,
            signingAgentCertified: user.signingAgentCertified,

            // Document status
            hasCommissionFile: !!user.notaryCommissionFile,
            hasEOInsurance: !!user.eoInsuranceFile,
            hasBond: !!user.bondFile,
            hasPublicCertificate: !!user.publicCertificateFile,
          }))
        );
      } catch (error) {
        console.error("Get pending users error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  /**
   * POST /api/admin/users/:id/approve
   * Approve a user (admin only)
   */
  app.post(
    "/api/admin/users/:id/approve",
    verifyToken,
    async (req: any, res) => {
      try {
        if (!hasAdminPrivileges(req.user)) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const userId = parseInt(req.params.id);
        const { notes } = req.body;

        const user = await storage.approveUser(userId, req.user.id, notes);

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Also activate the user
        await storage.updateUser(userId, { isActive: true });

        // Invalidate user-specific cache to ensure fresh data on next request
        try {
          await redisCache.delPattern(`user:${userId}:*`);
          console.log(`🧹 Invalidated cache for user ${userId} after approval`);
        } catch (cacheError) {
          console.error(
            "Failed to invalidate cache after user approval:",
            cacheError
          );
          // Don't fail the request if cache invalidation fails
        }

        res.json({
          message: "User approved successfully",
          userId: user.id,
          approvalStatus: user.approvalStatus,
        });
      } catch (error) {
        console.error("Approve user error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  /**
   * POST /api/admin/users/:id/reject
   * Reject a user (admin only)
   */
  app.post(
    "/api/admin/users/:id/reject",
    verifyToken,
    async (req: any, res) => {
      try {
        if (!hasAdminPrivileges(req.user)) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const userId = parseInt(req.params.id);
        const { notes } = req.body;

        if (!notes) {
          return res
            .status(400)
            .json({ message: "Rejection reason is required" });
        }

        const user = await storage.rejectUser(userId, req.user.id, notes);

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json({
          message: "User rejected",
          userId: user.id,
          approvalStatus: user.approvalStatus,
          rejectionReason: notes,
        });
      } catch (error) {
        console.error("Reject user error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  /**
   * POST /api/admin/users/:id/request-update
   * Request user to update their profile (admin only)
   */
  app.post(
    "/api/admin/users/:id/request-update",
    verifyToken,
    async (req: any, res) => {
      try {
        if (!hasAdminPrivileges(req.user)) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const userId = parseInt(req.params.id);
        const { notes } = req.body;

        if (!notes) {
          return res
            .status(400)
            .json({ message: "Update request reason is required" });
        }

        const user = await storage.requestUserUpdate(
          userId,
          req.user.id,
          notes
        );

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json({
          message: "Update request sent to user",
          userId: user.id,
          approvalStatus: user.approvalStatus,
          updateRequest: notes,
        });
      } catch (error) {
        console.error("Request user update error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // ============================================================================
  // ENHANCED PROFILE MANAGEMENT ROUTES
  // ============================================================================

  /**
   * GET /api/users/:id/profile/comprehensive
   * Get comprehensive user profile with all fields
   */
  app.get(
    "/api/users/:id/profile/comprehensive",
    verifyToken,
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.id);

        // Check access permissions
        const canAccess =
          hasAdminPrivileges(req.user) ||
          req.user.id === userId ||
          (req.user.role === "company_manager" &&
            req.user.companyId &&
            (await storage
              .getUsersByCompany(req.user.companyId)
              .then((users) => users.some((u) => u.id === userId))));

        if (!canAccess) {
          return res.status(403).json({ message: "Access denied" });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Get company information if user is associated with a company
        let companyInfo = null;
        if (user.companyId) {
          companyInfo = await storage.getCompany(user.companyId);
        }

        // Return comprehensive profile
        const profile = {
          // Basic information
          id: user.id,
          username: user.username,
          email: user.email,

          // Personal information
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,

          // Address information
          address1: user.address1,
          address2: user.address2,
          city: user.city,
          state: user.state,
          zipCode: user.zipCode,

          // Role and company
          role: user.role,
          companyId: user.companyId,
          companyRole: user.companyRole,
          company: companyInfo
            ? {
                id: companyInfo.id,
                companyName: companyInfo.companyName,
                contactName: companyInfo.contactName,
              }
            : null,

          // Status
          isActive: user.isActive,
          approvalStatus: user.approvalStatus,
          approvalNotes: user.approvalNotes,

          // Notary information (if applicable)
          notaryType: user.notaryType,
          notaryIdCode: user.notaryIdCode,
          nameOnCommission: user.nameOnCommission,
          commissionNumber: user.commissionNumber,
          commissionExpiration: user.commissionExpiration,
          commissionAddress1: user.commissionAddress1,
          commissionAddress2: user.commissionAddress2,
          commissionCity: user.commissionCity,
          commissionState: user.commissionState,
          commissionZipCode: user.commissionZipCode,
          commissionCounty: user.commissionCounty,
          county: user.county, // Legacy field

          // Qualifications
          isNotarySigningAgent: user.isNotarySigningAgent,
          notarySigningAgentExpiration: user.notarySigningAgentExpiration,
          isSpanishSpeaking: user.isSpanishSpeaking,
          foreignLanguages: user.foreignLanguages,
          signingAgentCertified: user.signingAgentCertified,
          signingAgentExpirationDate: user.signingAgentExpirationDate,

          // Insurance and bonding
          eoInsuranceCompany: user.eoInsuranceCompany,
          eoInsuranceAmount: user.eoInsuranceAmount,
          eoInsuranceExpiration: user.eoInsuranceExpiration,
          bondCompanyName: user.bondCompanyName,
          bondAmount: user.bondAmount,
          bondExpiration: user.bondExpiration,

          // Certificates and documents
          publicCertificateExpiration: user.publicCertificateExpiration,
          digitalCertificateExpiration: user.digitalCertificateExpiration,

          // Document upload status
          documents: {
            hasCommissionFile: !!user.notaryCommissionFile,
            hasEOInsuranceFile: !!user.eoInsuranceFile,
            hasBondFile: !!user.bondFile,
            hasPublicCertificateFile: !!user.publicCertificateFile,
            hasSigningAgentFile: !!user.signingAgentFile,
            hasDigitalCertificateFile: !!user.digitalCertificateFile,
          },

          // ID Verification
          idType: user.idType,
          idNumber: user.idNumber ? user.idNumber.replace(/./g, "*") : null, // Masked for security
          idExpirationDate: user.idExpirationDate,
          idIssueDate: user.idIssueDate,

          // Account Setup Status
          accountSetupComplete: !!(
            user.firstName &&
            user.lastName &&
            user.phoneNumber &&
            user.address1 &&
            user.city &&
            user.state &&
            user.zipCode
          ),

          // Verification Status (considering both EVS verification and admin bypass)
          isVerified: user.isVerified || user.isVerificationBypassed || false,
          verificationStatus: user.isVerificationBypassed
            ? "approved"
            : user.verificationStatus || "pending",
          isVerificationBypassed: user.isVerificationBypassed || false,
          verificationBypassedAt: user.verificationBypassedAt,
          verificationBypassReason: user.verificationBypassReason,
          verificationBypassedBy: user.verificationBypassedBy,
          evsTransactionId: user.evsTransactionId,
          evsVerificationConfidence: user.evsVerificationConfidence,
          evsVerifiedAt: user.evsVerifiedAt,
          totalVerificationAttempts: user.totalVerificationAttempts || 0,
          verificationRetryCount: user.verificationRetryCount || 0,
          latestVerificationAttempt: user.latestVerificationAttempt,

          // Signatures and seals
          hasSignatureData: !!user.signatureData,
          hasInitialData: !!user.initialData,

          // Settings
          isNotificationsEnabled: user.isNotificationsEnabled,
          mfaEnabled: user.mfaEnabled,

          // Timestamps
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt,
          lastProfileUpdate: user.lastProfileUpdate,
        };

        res.json(profile);
      } catch (error) {
        console.error("Get comprehensive profile error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  /**
   * PUT /api/users/:id/profile/comprehensive
   * Update comprehensive user profile
   */
  app.put(
    "/api/users/:id/profile/comprehensive",
    verifyToken,
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.id);

        // Check access permissions
        const canUpdate =
          hasAdminPrivileges(req.user) || req.user.id === userId;

        if (!canUpdate) {
          return res
            .status(403)
            .json({
              message: "Access denied. You can only update your own profile.",
            });
        }

        const updateData = { ...req.body };

        // Add update timestamp
        updateData.lastProfileUpdate = new Date().toISOString();

        // If this is a notary updating their profile, set status to pending for re-approval
        const user = await storage.getUser(userId);
        if (
          user?.role === "notary" &&
          user.approvalStatus === "approved" &&
          !hasAdminPrivileges(req.user)
        ) {
          updateData.approvalStatus = "requires_update";
          updateData.isActive = false;
        }

        const updatedUser = await storage.updateUser(userId, updateData);

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Invalidate user-specific cache to ensure fresh data on next request
        try {
          await redisCache.delPattern(`user:${userId}:*`);
          console.log(
            `🧹 Invalidated cache for user ${userId} after profile update`
          );
        } catch (cacheError) {
          console.error(
            "Failed to invalidate cache after profile update:",
            cacheError
          );
          // Don't fail the request if cache invalidation fails
        }

        res.json({
          message:
            user?.role === "notary" &&
            updateData.approvalStatus === "requires_update"
              ? "Profile updated successfully. Your account is pending re-approval due to changes in notary information."
              : "Profile updated successfully",
          user: {
            id: updatedUser.id,
            approvalStatus: updatedUser.approvalStatus,
            isActive: updatedUser.isActive,
            lastProfileUpdate: updatedUser.lastProfileUpdate,
          },
        });
      } catch (error) {
        console.error("Update comprehensive profile error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // ============================================================================
  // USER LISTING ROUTES
  // ============================================================================

  /**
   * GET /api/debug/user/:email
   * Debug endpoint to check user verification status (temporary)
   */
  app.get("/api/debug/user/:email", verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const email = req.params.email;
      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isVerified: user.isVerified,
        verificationStatus: user.verificationStatus,
        isVerificationBypassed: user.isVerificationBypassed,
        verificationBypassedAt: user.verificationBypassedAt,
        verificationBypassReason: user.verificationBypassReason,
        verificationBypassedBy: user.verificationBypassedBy,
        computedIsVerified:
          user.isVerified || user.isVerificationBypassed || false,
        isActive: user.isActive,
      });
    } catch (error) {
      console.error("Debug user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * GET /api/admin/users/by-role/:role
   * Get users by role (admin only)
   */
  app.get(
    "/api/admin/users/by-role/:role",
    verifyToken,
    async (req: any, res) => {
      try {
        if (!hasAdminPrivileges(req.user)) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const role = req.params.role;
        const users = await storage.getUsersByRole(role);

        res.json(
          users.map((user) => ({
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            approvalStatus: user.approvalStatus,
            companyId: user.companyId,
            createdAt: user.createdAt,
          }))
        );
      } catch (error) {
        console.error("Get users by role error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  /**
   * GET /api/notaries/qualified
   * Get notaries by qualifications (for job assignment)
   */
  app.get("/api/notaries/qualified", verifyToken, async (req: any, res) => {
    try {
      // SECURITY RESTRICTION: Only allow admin access to browse qualified notaries
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({
          message: "Admin access required",
          error: "Access denied to qualified notaries listing",
        });
      }

      const { requiresNSA, requiresSpanish } = req.query;

      const notaries = await storage.getNotariesByQualifications(
        requiresNSA === "true",
        requiresSpanish === "true"
      );

      res.json(
        notaries.map((notary) => ({
          id: notary.id,
          fullName: notary.fullName,
          email: notary.email,
          state: notary.state,
          isNotarySigningAgent: notary.isNotarySigningAgent,
          isSpanishSpeaking: notary.isSpanishSpeaking,
          foreignLanguages: notary.foreignLanguages,
          maxConcurrentJobs: notary.maxConcurrentJobs,
          notaryType: notary.notaryType,
        }))
      );
    } catch (error) {
      console.error("Get qualified notaries error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(
    "/api/users",
    verifyToken,
    cacheAdminData(300),
    async (req: any, res) => {
      try {
        const hasAdminAccess = hasAdminPrivileges(req.user);

        if (!hasAdminAccess) {
          return res.status(403).json({ message: "Admin access required" });
        }
        const users = await storage.getUsers();
        res.json(users);
      } catch (error) {
        console.error("Get users error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.get("/api/users/notaries", verifyToken, async (req: any, res) => {
    try {
      // SECURITY RESTRICTION: Only allow admin access to notary listing
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({
          message: "Admin access required",
          error: "Access denied to notary listing",
        });
      }

      const notaries = await storage.getNotaryUsers();
      res.json(
        notaries.map((user) => ({
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          notaryIdCode: user.notaryIdCode,
          isActive: user.isActive,
          notaryType: user.notaryType,
        }))
      );
    } catch (error) {
      console.error("Get notaries error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get users that can be signers (for job creation)
  app.get("/api/users/signers", verifyToken, async (req: any, res) => {
    try {
      // Check if user has permission to access this endpoint
      const userCanCreateJob =
        hasAdminPrivileges(req.user) ||
        req.user.role === "title_company" ||
        req.user.role === "client" ||
        (req.user.role === "notary" && req.user.notaryType === "subscriber");

      if (!userCanCreateJob) {
        return res.status(403).json({
          message:
            "Access denied. Only administrators, title companies, clients, and subscriber notaries can access signers.",
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
          isActive: users.isActive,
        })
        .from(users)
        .where(
          and(
            eq(users.isActive, true),
            // Include only signer and witness roles
            inArray(users.role, ["signer", "witness"])
          )
        )
        .orderBy(users.firstName, users.lastName, users.username);

      res.json(signerUsers);
    } catch (error) {
      console.error("Get signer users error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/users/:id", verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const userId = parseInt(req.params.id);
      const updateData = req.body;

      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }

      const user = await storage.updateUser(userId, updateData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Invalidate users cache to ensure fresh data on next request
      try {
        await redisCache.delPattern(`admin:*`); // Clear admin caches
        await redisCache.delPattern(`user:*`); // Clear all user caches
        await redisCache.delPattern(`api:*users*`); // Clear users API cache
        console.log(`🧹 Invalidated user caches after updating user ${userId}`);
      } catch (cacheError) {
        console.error(
          "Failed to invalidate cache after user update:",
          cacheError
        );
        // Don't fail the request if cache invalidation fails
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        privileges: user.privileges,
      });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/users/:id", verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const userId = parseInt(req.params.id);

      // Validate userId
      if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Prevent self-deletion
      if (req.user.id === userId) {
        return res
          .status(400)
          .json({ message: "Cannot delete your own account" });
      }

      const deleted = await storage.deleteUser(userId);

      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }

      // Invalidate users cache to ensure fresh data on next request
      try {
        await redisCache.delPattern(`admin:*`); // Clear admin caches
        await redisCache.delPattern(`user:*`); // Clear all user caches
        await redisCache.delPattern(`api:*users*`); // Clear users API cache
        console.log(`🧹 Invalidated user caches after deleting user ${userId}`);
      } catch (cacheError) {
        console.error(
          "Failed to invalidate cache after user deletion:",
          cacheError
        );
        // Don't fail the request if cache invalidation fails
      }

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes("foreign key constraint")) {
          res.status(400).json({
            message:
              "Cannot delete user due to existing relationships. Please remove all associated records first.",
          });
        } else if (error.message.includes("Failed to delete user")) {
          res.status(500).json({
            message:
              "Failed to delete user. Please try again or contact support if the problem persists.",
          });
        } else {
          res.status(500).json({ message: "Internal server error" });
        }
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Get user signatures endpoint
  app.get("/api/users/:id/signatures", verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);

      // Check if user can access these signatures
      if (
        !req.user ||
        (!hasAdminPrivileges(req.user) && req.user.id !== userId)
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get signatures from storage (in production, this would be a database query)
      const signatures = await storage.getUserSignatures(userId);

      res.json(signatures);
    } catch (error) {
      console.error("Get user signatures error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new signature endpoint
  app.post(
    "/api/users/:id/signatures",
    verifyToken,
    upload.single("signature"),
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.id);

        // Check if user can create signatures for this user
        if (
          !req.user ||
          (!hasAdminPrivileges(req.user) && req.user.id !== userId)
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        const { name, type, text, fontFamily, fontSize } = req.body;

        if (!name || !type) {
          return res
            .status(400)
            .json({ message: "Name and type are required" });
        }

        let imageUrl = "";
        let metadata = {};

        // VULTR ONLY - All signatures are stored in Vultr cloud storage
        const { VultrUploadHandler } = await import("./vultr-upload-handler");

        if (type === "uploaded" && req.file) {
          // Handle uploaded signature
          const uploadResult = await VultrUploadHandler.handleSignatureUpload(
            req.file.buffer,
            req.file.originalname,
            `user-${userId}`,
            userId,
            "signature"
          );

          if (!uploadResult.success) {
            return res.status(500).json({
              message: `Failed to upload signature: ${uploadResult.error}`,
              error: "vultr_upload_failed",
            });
          }

          imageUrl = uploadResult.signedUrl || uploadResult.fileKey || "";
          metadata = {
            originalName: req.file.originalname,
            vultrKey: uploadResult.fileKey,
          };
        } else if (type === "drawn") {
          // Handle drawn signature from canvas
          const { imageData } = req.body;
          if (!imageData) {
            return res
              .status(400)
              .json({ message: "Image data is required for drawn signatures" });
          }

          const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");

          const filename = `drawn_${Date.now()}.png`;
          const uploadResult = await VultrUploadHandler.handleSignatureUpload(
            buffer,
            filename,
            `user-${userId}`,
            userId,
            "signature"
          );

          if (!uploadResult.success) {
            return res.status(500).json({
              message: `Failed to upload drawn signature: ${uploadResult.error}`,
              error: "vultr_upload_failed",
            });
          }

          imageUrl = uploadResult.signedUrl || uploadResult.fileKey || "";
          metadata = { style: "handwritten", vultrKey: uploadResult.fileKey };
        } else if (type === "generated") {
          // Handle generated signature
          if (!text) {
            return res
              .status(400)
              .json({ message: "Text is required for generated signatures" });
          }

          try {
            let buffer: Buffer;
            let filename: string;

            try {
              // Try to generate signature image using canvas (server-side)
              const { createCanvas } = await import("canvas");
              const canvas = createCanvas(400, 100);
              const ctx = canvas.getContext("2d");

              ctx.fillStyle = "white";
              ctx.fillRect(0, 0, 400, 100);

              ctx.fillStyle = "black";
              ctx.font = `${fontSize || 48}px ${fontFamily || "serif"}`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(text, 200, 50);

              buffer = canvas.toBuffer("image/png");
              filename = `generated_${Date.now()}.png`;

              console.log(
                `✅ Successfully generated signature canvas for: ${text}`
              );
            } catch (canvasError) {
              console.warn(
                "Canvas generation failed, using SVG fallback:",
                canvasError
              );

              // Fallback: Create a simple SVG-based signature
              const svgContent = `
              <svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
                <rect width="400" height="100" fill="white"/>
                <text x="200" y="55" font-family="${fontFamily || "serif"}" font-size="${fontSize || 48}" 
                      text-anchor="middle" fill="black">${text}</text>
              </svg>
            `;

              filename = `generated_${Date.now()}.svg`;
              buffer = Buffer.from(svgContent, "utf8");
            }

            const uploadResult = await VultrUploadHandler.handleSignatureUpload(
              buffer,
              filename,
              `user-${userId}`,
              userId,
              "signature"
            );

            if (!uploadResult.success) {
              return res.status(500).json({
                message: `Failed to upload generated signature: ${uploadResult.error}`,
                error: "vultr_upload_failed",
              });
            }

            imageUrl = uploadResult.signedUrl || uploadResult.fileKey || "";
            metadata = {
              fontFamily,
              fontSize,
              text,
              vultrKey: uploadResult.fileKey,
            };
          } catch (outerError) {
            console.error(
              "Signature generation failed completely:",
              outerError
            );
            return res.status(500).json({
              message: "Failed to generate signature",
              error: "signature_generation_failed",
            });
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
          userAgent: req.get("User-Agent"),
        });

        res.json(signature);
      } catch (error) {
        console.error("Create signature error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // Set default signature endpoint
  app.put(
    "/api/users/:id/signatures/:signatureId/default",
    verifyToken,
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.id);
        const signatureId = req.params.signatureId;

        // Check if user can modify signatures for this user
        if (
          !req.user ||
          (req.user.role !== "admin" && req.user.id !== userId)
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        await storage.setDefaultSignature(userId, signatureId);

        res.json({ message: "Default signature set successfully" });
      } catch (error) {
        console.error("Set default signature error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // Delete signature endpoint
  app.delete(
    "/api/users/:id/signatures/:signatureId",
    verifyToken,
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.id);
        const signatureId = req.params.signatureId;

        // Check if user can delete signatures for this user
        if (
          !req.user ||
          (req.user.role !== "admin" && req.user.id !== userId)
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        await storage.deleteUserSignature(userId, signatureId);

        res.json({ message: "Signature deleted successfully" });
      } catch (error) {
        console.error("Delete signature error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // Get user profile with notary details
  app.get(
    "/api/users/:id/profile",
    verifyToken,
    cacheUserData(600),
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.id);

        // Check if user can access this profile
        if (
          !req.user ||
          (req.user.role !== "admin" && req.user.id !== userId)
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Return user profile with notary-specific fields
        const profile = {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          fullName: user.fullName || "",
          role: user.role,
          title: user.title || "Notary Public",
          commissionNumber: user.commissionNumber || "",
          commissionExpiration: user.commissionExpiration || "",
          state: user.state || "",
          county: user.county || "",
          disclosure:
            user.disclosure ||
            "I acknowledge that this document was signed before me on this date.",
          signatureData: user.signatureData || "",
          initialData: user.initialData || "",
          phoneNumber: user.phoneNumber || "",
          address: user.address || "",
          isActive: user.isActive,
          isNotarySigningAgent: user.isNotarySigningAgent,
          isSpanishSpeaking: user.isSpanishSpeaking,
          notaryType: user.notaryType,
        };

        res.json(profile);
      } catch (error) {
        console.error("Get user profile error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // Update user profile with notary details
  app.put("/api/users/:id/profile", verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);

      // Check if user can update this profile
      if (!req.user || (req.user.role !== "admin" && req.user.id !== userId)) {
        return res.status(403).json({ message: "Access denied" });
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
        address: profileData.address,
        isActive: profileData.isActive,
        isNotarySigningAgent: profileData.isNotarySigningAgent,
        isSpanishSpeaking: profileData.isSpanishSpeaking,
        notaryType: profileData.notaryType,
      };

      // Auto-generate fullName from firstName and lastName if provided
      if (profileData.firstName || profileData.lastName) {
        const fullName = [profileData.firstName, profileData.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (fullName) {
          updateData.fullName = fullName;
        }
      }

      const updatedUser = await storage.updateUser(userId, updateData);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Invalidate user-specific cache to ensure fresh data on next request
      try {
        await redisCache.delPattern(`user:${userId}:*`);
        console.log(
          `🧹 Invalidated cache for user ${userId} after profile update`
        );
      } catch (cacheError) {
        console.error(
          "Failed to invalidate cache after profile update:",
          cacheError
        );
        // Don't fail the request if cache invalidation fails
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Update user profile error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
