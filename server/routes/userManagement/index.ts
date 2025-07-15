import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";
import { db } from "../../db";

import { verifyToken, hasAdminPrivileges, type AuthUser } from "../../auth";
import {
  cacheAdminData,
  cacheUserData,
} from "../../middleware/cache-middleware";

interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { redisCache } from "../../services/redis-cache";
import { eq, and, gte, inArray, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import multer from "multer";

import { users } from "@shared/schema";

const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage for direct cloud uploads
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for cloud storage
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

export async function registerUsersRoutes(app: Express): Promise<Server> {
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

  app.get(
    "/api/users/notaries-comprehensive",
    verifyToken,
    async (req: any, res) => {
      try {
        if (!hasAdminPrivileges(req.user)) {
          return res.status(403).json({
            message: "Admin access required",
            error: "Access denied to comprehensive notary data",
          });
        }

        const comprehensiveNotaries = await db
          .select()
          .from(users)
          .where(eq(users.role, "notary"))
          .orderBy(users.firstName, users.lastName, users.username);

        res.json(comprehensiveNotaries);
      } catch (error) {
        console.error("Get comprehensive notaries error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.get("/api/users/notaries", verifyToken, async (req: any, res) => {
    try {
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

  app.get("/api/users/signers", verifyToken, async (req: any, res) => {
    try {
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

      if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      if (req.user.id === userId) {
        return res
          .status(400)
          .json({ message: "Cannot delete your own account" });
      }
      const deleted = await storage.deleteUser(userId);

      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
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
      }

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);
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

  app.get("/api/users/:id/signatures", verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (
        !req.user ||
        (!hasAdminPrivileges(req.user) && req.user.id !== userId)
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      const signatures = await storage.getUserSignatures(userId);

      res.json(signatures);
    } catch (error) {
      console.error("Get user signatures error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(
    "/api/users/:id/signatures",
    verifyToken,
    upload.single("signature"),
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.id);

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

        const { VultrUploadHandler } = await import(
          "../../vultr-upload-handler"
        );

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
          if (!text) {
            return res
              .status(400)
              .json({ message: "Text is required for generated signatures" });
          }

          try {
            let buffer: Buffer;
            let filename: string;

            try {
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

  app.put(
    "/api/users/:id/signatures/:signatureId/default",
    verifyToken,
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.id);
        const signatureId = req.params.signatureId;

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

  app.delete(
    "/api/users/:id/signatures/:signatureId",
    verifyToken,
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.id);
        const signatureId = req.params.signatureId;

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

  app.get(
    "/api/users/:id/profile",
    verifyToken,
    cacheUserData(600),
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.id);

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
        let certificateInfo = null;
        if (["signer", "witness"].includes(user.role)) {
          try {
            const { selfSignedCertificateService } = await import(
              "../../services/self-signed-certificate-service"
            );
            const certificate =
              await selfSignedCertificateService.getUserCertificate(userId);

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
                certificateType: "self-signed",
                downloadUrl: `/api/user/certificate/download`,
              };
            } else {
              certificateInfo = {
                hasCertificate: false,
                eligibleForGeneration:
                  user.isVerified || user.isVerificationBypassed,
                reason:
                  user.isVerified || user.isVerificationBypassed
                    ? "User is verified but no certificate generated yet"
                    : "User must complete ID verification first",
              };
            }
          } catch (error) {
            console.error("Error getting certificate info:", error);
            certificateInfo = {
              hasCertificate: false,
              error: "Failed to load certificate information",
            };
          }
        }
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
          selfSignedCertificate: certificateInfo,
        };

        res.json(profile);
      } catch (error) {
        console.error("Get user profile error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.put("/api/users/:id/profile", verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (!req.user || (req.user.role !== "admin" && req.user.id !== userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const profileData = req.body;

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
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Update user profile error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(
    "/api/users/notaries-comprehensive",
    verifyToken,
    async (req: any, res) => {
      try {
        if (!hasAdminPrivileges(req.user)) {
          return res.status(403).json({
            message: "Admin access required",
            error: "Access denied to comprehensive notary data",
          });
        }

        const comprehensiveNotaries = await db
          .select()
          .from(users)
          .where(eq(users.role, "notary"))
          .orderBy(users.firstName, users.lastName, users.username);

        res.json(comprehensiveNotaries);
      } catch (error) {
        console.error("Get comprehensive notaries error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.get("/api/users/notaries", verifyToken, async (req: any, res) => {
    try {
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
      if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      if (req.user.id === userId) {
        return res
          .status(400)
          .json({ message: "Cannot delete your own account" });
      }
      const deleted = await storage.deleteUser(userId);

      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }

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
      }

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);

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

  app.get("/api/users/:id/signatures", verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);

      if (
        !req.user ||
        (!hasAdminPrivileges(req.user) && req.user.id !== userId)
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      const signatures = await storage.getUserSignatures(userId);
      res.json(signatures);
    } catch (error) {
      console.error("Get user signatures error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

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

        const { VultrUploadHandler } = await import(
          "../../vultr-upload-handler"
        );

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
          if (!text) {
            return res
              .status(400)
              .json({ message: "Text is required for generated signatures" });
          }

          try {
            let buffer: Buffer;
            let filename: string;

            try {
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

  app.put(
    "/api/users/:id/signatures/:signatureId/default",
    verifyToken,
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.id);
        const signatureId = req.params.signatureId;

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

  app.delete(
    "/api/users/:id/signatures/:signatureId",
    verifyToken,
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.id);
        const signatureId = req.params.signatureId;

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
  app.get(
    "/api/users/:id/profile",
    verifyToken,
    cacheUserData(600),
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.id);
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
        let certificateInfo = null;
        if (["signer", "witness"].includes(user.role)) {
          try {
            const { selfSignedCertificateService } = await import(
              "../../services/self-signed-certificate-service"
            );
            const certificate =
              await selfSignedCertificateService.getUserCertificate(userId);

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
                certificateType: "self-signed",
                downloadUrl: `/api/user/certificate/download`,
              };
            } else {
              certificateInfo = {
                hasCertificate: false,
                eligibleForGeneration:
                  user.isVerified || user.isVerificationBypassed,
                reason:
                  user.isVerified || user.isVerificationBypassed
                    ? "User is verified but no certificate generated yet"
                    : "User must complete ID verification first",
              };
            }
          } catch (error) {
            console.error("Error getting certificate info:", error);
            certificateInfo = {
              hasCertificate: false,
              error: "Failed to load certificate information",
            };
          }
        }

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
          selfSignedCertificate: certificateInfo,
        };

        res.json(profile);
      } catch (error) {
        console.error("Get user profile error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.put("/api/users/:id/profile", verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);

      if (!req.user || (req.user.role !== "admin" && req.user.id !== userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const profileData = req.body;

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
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Update user profile error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/notary/:id/stamps", verifyToken, async (req: any, res) => {
    try {
      const notaryId = parseInt(req.params.id);

      // Check if user can access these stamps
      if (
        !req.user ||
        (!hasAdminPrivileges(req.user) &&
          req.user.id !== notaryId &&
          req.user.role !== "notary")
      ) {
        return res.status(403).json({ message: "Access denied" });
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
        console.error("Database query failed for notary stamps:", dbError);
        return res.status(500).json({
          message: "Failed to retrieve stamps from database",
          error: "database_query_failed",
        });
      }

      // Transform stamps to include proper image URLs
      const { cloudStorage } = await import("../../lib/cloud-storage-service");

      const stampsWithUrls = await Promise.all(
        (stamps.rows || []).map(async (stamp: any) => {
          let imageUrl = "";

          if (stamp?.stampData && typeof stamp.stampData === "string") {
            // Check if it's a Vultr key (no base64 prefix) or base64 data
            if (stamp.stampData.startsWith("data:image/")) {
              // Already base64 data, use directly
              imageUrl = stamp.stampData;
            } else {
              // Vultr key, generate signed URL
              try {
                const fileExists = await cloudStorage.fileExists(
                  stamp.stampData
                );
                if (fileExists) {
                  const signedUrl = await cloudStorage.getSignedUrl(
                    stamp.stampData,
                    3600
                  ); // 1 hour expiry
                  imageUrl = signedUrl || "/api/placeholder/stamp-error";
                } else {
                  console.warn(
                    `Stamp image not found in Vultr: ${stamp.stampData}`
                  );
                  imageUrl = "/api/placeholder/stamp-missing";
                }
              } catch (vultrError) {
                console.warn(
                  `Failed to get Vultr URL for stamp ${stamp.id}:`,
                  vultrError
                );
                imageUrl = "/api/placeholder/stamp-error";
              }
            }
          } else {
            imageUrl = "/api/placeholder/stamp-missing";
          }

          return {
            id: stamp?.id || 0,
            notaryId: stamp?.notaryId || notaryId,
            stampType: stamp?.stampType || "notary",
            imageUrl,
            isActive: stamp?.isActive || false,
            uploadedAt: stamp?.createdAt
              ? new Date(stamp.createdAt).toISOString()
              : new Date().toISOString(),
            createdAt: stamp?.createdAt
              ? new Date(stamp.createdAt).toISOString()
              : new Date().toISOString(),
          };
        })
      );

      res.json(stampsWithUrls);
    } catch (error) {
      console.error("Get notary stamps error:", error);

      // Provide a fallback response with empty array if stamps loading fails
      res.status(200).json([]);
    }
  });

  app.get(
    "/api/dashboard/stats",
    verifyToken,
    cacheUserData(300),
    async (req: any, res) => {
      try {
        const jobs = await storage.getRoleBasedJobs(req.user.id, req.user.role);

        const stats: any = {
          totalJobs: jobs.length,
          completedJobs: jobs.filter((job) => job.jobStatus === "completed")
            .length,
          pendingJobs: jobs.filter((job) => job.jobStatus === "pending").length,
          openJobs: jobs.filter((job) => job.jobStatus === "open").length,
          cancelledJobs: jobs.filter((job) => job.jobStatus === "cancelled")
            .length,
          expiredJobs: jobs.filter((job) => job.jobStatus === "expired").length,
        };

        if (hasAdminPrivileges(req.user)) {
          const notaries = await storage.getNotaryUsers();
          stats.activeNotaries = notaries.length;
        }

        res.json(stats);
      } catch (error) {
        console.error("Get dashboard stats error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );
  app.get(
    "/api/admin/revenue-stats",
    verifyToken,
    cacheAdminData(300),
    async (req: any, res) => {
      try {
        if (!hasAdminPrivileges(req.user)) {
          return res.status(403).json({ message: "Admin access required" });
        }

        // Calculate revenue from payments and invoices
        const currentMonth = new Date();
        const firstDayOfMonth = new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth(),
          1
        );

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
        console.error("Get revenue stats error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );
}
