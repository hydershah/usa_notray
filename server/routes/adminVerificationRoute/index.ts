import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";
import { db } from "../../db";
import {
  verifyToken,
  hasAdminPrivileges,
  hasNotaryPrivileges,
  type AuthUser,
} from "../../auth";

interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";

import { users, passwordResetTokens } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

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

// Import security middleware
import { passwordResetLimiter } from "../../middleware/rate-limiter";

export async function adminVerificationRoutes(app: Express): Promise<Server> {
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!hasAdminPrivileges(req.user)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  };

  app.get(
    "/api/admin/users/:userId/verification-data",
    verifyToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.userId);

        if (isNaN(userId)) {
          return res.status(400).json({ error: "Invalid user ID" });
        }

        const [userData] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!userData) {
          return res.status(404).json({ error: "User not found" });
        }

        res.json(userData);
      } catch (error) {
        console.error("Error fetching user verification data:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch user verification data" });
      }
    }
  );

  // Get verification attempts for a specific user (frontend expects this path)
  app.get(
    "/api/admin/users/:userId/verification-attempts",
    verifyToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.userId);

        if (isNaN(userId)) {
          return res.status(400).json({ error: "Invalid user ID" });
        }

        // Return empty array for now since the table might not exist
        res.json([]);
      } catch (error) {
        console.error("Error fetching verification attempts:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch verification attempts" });
      }
    }
  );

  // Get verification statistics for admin dashboard
  app.get(
    "/api/admin/verification-stats",
    verifyToken,
    requireAdmin,
    async (req: any, res) => {
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
          verificationRequiredUsers:
            verificationStats?.verification_required_users || 0,
          verifiedUsers: verificationStats?.verified_users || 0,
          bypassedUsers: verificationStats?.bypassed_users || 0,
          pendingVerification: verificationStats?.pending_verification || 0,
          failedVerification: verificationStats?.failed_verification || 0,
        });
      } catch (error) {
        console.error("Error fetching verification stats:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch verification statistics" });
      }
    }
  );

  // Get all users requiring verification (for admin dashboard)
  app.get(
    "/api/admin/verification-users",
    verifyToken,
    requireAdmin,
    async (req: any, res) => {
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
        const usersWithCertificates = await Promise.all(
          users.map(async (user: any) => {
            let certificateInfo = null;

            if (["signer", "witness"].includes(user.role)) {
              try {
                const { selfSignedCertificateService } = await import(
                  "../../services/self-signed-certificate-service"
                );
                const certificate =
                  await selfSignedCertificateService.getUserCertificate(
                    user.id
                  );

                if (certificate) {
                  const isExpired =
                    new Date() > new Date(certificate.expires_at);
                  certificateInfo = {
                    hasCertificate: true,
                    certificateId: certificate.certificate_id,
                    status: certificate.status,
                    isExpired,
                    issuedAt: certificate.issued_at,
                    expiresAt: certificate.expires_at,
                  };
                } else {
                  certificateInfo = {
                    hasCertificate: false,
                    eligibleForGeneration:
                      user.is_verified || user.is_verification_bypassed,
                  };
                }
              } catch (error) {
                console.error(
                  `Error getting certificate info for user ${user.id}:`,
                  error
                );
                certificateInfo = {
                  hasCertificate: false,
                  error: "Failed to load certificate information",
                };
              }
            }

            return {
              ...user,
              selfSignedCertificate: certificateInfo,
            };
          })
        );

        res.json(usersWithCertificates);
      } catch (error) {
        console.error("Error fetching verification users:", error);
        res.status(500).json({ error: "Failed to fetch verification users" });
      }
    }
  );

  // Password reset and setup routes
  app.post(
    "/api/auth/validate-password-reset-token",
    passwordResetLimiter,
    async (req, res) => {
      try {
        const { token } = req.body;

        if (!token) {
          return res.status(400).json({ message: "Token is required" });
        }

        // Find the password reset token
        const [resetToken] = await db
          .select({
            token: passwordResetTokens,
            user: users,
          })
          .from(passwordResetTokens)
          .leftJoin(users, eq(passwordResetTokens.userId, users.id))
          .where(eq(passwordResetTokens.token, token));

        if (!resetToken) {
          return res.status(404).json({ message: "Invalid token" });
        }

        // Check if token is expired
        if (new Date() > resetToken.token.expiresAt) {
          return res.status(400).json({ message: "Token has expired" });
        }

        // Check if token is already used
        if (resetToken.token.used) {
          return res
            .status(400)
            .json({ message: "Token has already been used" });
        }

        // Return user info for display
        res.json({
          valid: true,
          user: {
            name:
              `${resetToken.user.firstName || ""} ${resetToken.user.lastName || ""}`.trim() ||
              resetToken.user.username,
            email: resetToken.user.email,
            role: resetToken.user.role,
          },
        });
      } catch (error) {
        console.error("Token validation error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.post("/api/auth/set-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res
          .status(400)
          .json({ message: "Token and password are required" });
      }

      // Find the password reset token
      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token));

      if (!resetToken) {
        return res.status(404).json({ message: "Invalid token" });
      }

      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "Token has expired" });
      }

      // Check if token is already used
      if (resetToken.used) {
        return res.status(400).json({ message: "Token has already been used" });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update user password and mark account setup as complete
      await db
        .update(users)
        .set({
          password: hashedPassword,
          accountSetupComplete: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, resetToken.userId));

      // Mark token as used
      await db
        .update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, resetToken.id));

      // Get the updated user data
      const updatedUser = await storage.getUserById(resetToken.userId);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate JWT token for auto-login
      const authToken = jwt.sign(
        {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          privileges: updatedUser.privileges || [],
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      // Check privileges for frontend
      const isAdmin = hasAdminPrivileges(updatedUser);
      const isNotary = hasNotaryPrivileges(updatedUser);

      res.json({
        message: "Password set successfully",
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
          isAdmin,
          isNotary,
        },
      });
    } catch (error) {
      console.error("Password setup error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // EVS Verification route with Vultr storage
  app.post(
    "/api/verification/evs-verify",
    verifyToken,
    upload.fields([
      { name: "frontImage", maxCount: 1 },
      { name: "backImage", maxCount: 1 },
      { name: "selfieImage", maxCount: 1 },
    ]),
    async (req: any, res) => {
      try {
        const { userId } = req.body;
        const files = req.files as {
          [fieldname: string]: Express.Multer.File[];
        };

        if (!files.frontImage || !files.selfieImage) {
          return res
            .status(400)
            .json({ message: "Front image and selfie are required" });
        }

        const { VultrUploadHandler } = await import(
          "../../vultr-upload-handler"
        );
        const uploadedFiles: { [key: string]: any } = {};
        const sessionId = `evs-verification-${userId}-${Date.now()}`;

        try {
          const frontResult = await VultrUploadHandler.handleSignatureUpload(
            files.frontImage[0].buffer,
            `front-id-${userId}-${Date.now()}.jpg`,
            sessionId,
            parseInt(userId),
            "id_verification"
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
              "id_verification"
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
            "id_verification"
          );

          if (selfieResult.success) {
            uploadedFiles.selfieImage = selfieResult.fileKey;
          }

          console.log(
            `✅ Uploaded verification images to Vultr for user ${userId}`
          );
        } catch (uploadError) {
          console.error(
            "Failed to upload verification images to Vultr:",
            uploadError
          );
          // Continue with verification even if upload fails, but log the issue
        }

        // Use actual EVS Solutions API
        let evsResult;
        let isSuccessful = false;
        let confidence = 0;
        let verificationId;

        try {
          const { evsService } = await import("./lib/evs-service");

          const verificationRequest = {
            documentType: req.body.documentType || "drivers_license",
            frontImage: files.frontImage[0].buffer,
            backImage: files.backImage?.[0]?.buffer,
            selfieImage: files.selfieImage[0].buffer,
            userId: userId.toString(),
          };

          console.log(`🔍 Starting EVS verification for user ${userId}`);
          evsResult = await evsService.verifyIdentity(verificationRequest);

          console.log(
            `📥 EVS Result: ${evsResult.success ? "SUCCESS" : "FAILED"} - Status: ${evsResult.status}, Confidence: ${evsResult.confidence}%`
          );

          // Handle different EVS result statuses
          if (evsResult.status === "error") {
            // Service configuration error - don't mark as failed, mark as pending for manual review
            isSuccessful = false;
            confidence = 0;
            verificationId =
              evsResult.transactionId || `evs_config_error_${Date.now()}`;

            // Add special handling for workflow disabled errors
            if (
              evsResult.errors?.some((e) => e.includes("workflow")) ||
              evsResult.errors?.some((e) => e.includes("configuration"))
            ) {
              console.log(
                "⚠️ BlueAssure workflow configuration issue detected - marking for manual review"
              );
              evsResult.status = "review"; // Change from 'error' to 'review' for workflow issues
              evsResult.warnings = [
                ...(evsResult.warnings || []),
                "Due to service configuration issues, your verification will be reviewed manually.",
                "This is not a problem with your documents.",
              ];
            }
          } else {
            isSuccessful = evsResult.success && evsResult.status === "approved";
            confidence = evsResult.confidence || 0;
            verificationId = evsResult.transactionId || `evs_${Date.now()}`;
          }
        } catch (evsError) {
          console.error("❌ EVS API Error:", evsError);

          // Create a fallback result for EVS API failures
          evsResult = {
            success: false,
            status: "error",
            confidence: 0,
            errors: [
              `EVS API Error: ${evsError instanceof Error ? evsError.message : "Unknown error"}`,
            ],
            warnings: [
              "Verification service temporarily unavailable. Please try again later.",
              "If this continues, your verification may be processed manually.",
            ],
          };

          isSuccessful = false;
          confidence = 0;
          verificationId = `evs_error_${Date.now()}`;
        }

        if (isSuccessful) {
          // Update user verification status with real EVS data
          const updateData: any = {
            isVerified: true,
            verificationStatus: "approved",
            evsTransactionId: verificationId,
            evsVerificationConfidence: confidence,
            evsVerifiedAt: new Date(),
            updatedAt: new Date(),
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

          await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, parseInt(userId)));

          // 🆕 AUTOMATIC SELF-SIGNED CERTIFICATE GENERATION after successful ID verification
          let certificateInfo = null;
          try {
            // Get the user to check their role
            const [verifiedUser] = await db
              .select({
                role: users.role,
                fullName: users.fullName,
                firstName: users.firstName,
                lastName: users.lastName,
              })
              .from(users)
              .where(eq(users.id, parseInt(userId)))
              .limit(1);

            // Generate self-signed certificate for verified signers and witnesses
            if (
              verifiedUser &&
              ["signer", "witness"].includes(verifiedUser.role)
            ) {
              console.log(
                `🔐 Auto-generating self-signed certificate for verified ${verifiedUser.role}: ${verifiedUser.fullName || verifiedUser.firstName + " " + verifiedUser.lastName}`
              );

              const { selfSignedCertificateService } = await import(
                "./services/self-signed-certificate-service"
              );
              const certResult =
                await selfSignedCertificateService.generateCertificateForUser(
                  parseInt(userId)
                );

              if (certResult.success) {
                certificateInfo = {
                  certificateGenerated: true,
                  certificateId: certResult.certificateId,
                  certificatePath: certResult.certificatePath,
                  expirationDate: certResult.expirationDate,
                  message: `Self-signed digital certificate automatically generated for verified ${verifiedUser.role}`,
                  downloadAvailable: true,
                  certificateType: "self-signed",
                  note: "Certificate is locally saved and ready for use in digital signing",
                };
                console.log(
                  `✅ Self-signed certificate auto-generated for user ${userId}: ID ${certResult.certificateId}`
                );
              } else {
                console.error(
                  `❌ Failed to auto-generate self-signed certificate for user ${userId}:`,
                  certResult.error
                );
                certificateInfo = {
                  certificateGenerated: false,
                  error: certResult.error,
                  message:
                    "ID verification successful, but self-signed certificate generation failed. Contact support if needed.",
                };
              }
            }
          } catch (certError) {
            console.error(
              "❌ Error during automatic self-signed certificate generation:",
              certError
            );
            certificateInfo = {
              certificateGenerated: false,
              error: "Certificate generation error",
              message:
                "ID verification successful, but self-signed certificate generation failed. Contact support if needed.",
            };
          }

          res.json({
            success: true,
            status: "approved",
            confidence: confidence,
            message: "Identity successfully verified through EVS Solutions",
            verificationId,
            verifiedAt: new Date().toISOString(),
            extractedData: evsResult.document?.extractedData,
            biometricResults: evsResult.biometric,
            storedImages: uploadedFiles,
            storageType: "vultr",
            // Include certificate generation results
            certificate: certificateInfo,
          });
        } else {
          // Handle different failure types
          const finalStatus =
            evsResult.status === "review" ? "review" : "denied";
          const httpStatus = evsResult.status === "review" ? 200 : 400;

          // Update user verification status
          const updateData: any = {
            isVerified: false,
            verificationStatus: finalStatus,
            evsTransactionId: verificationId,
            evsVerificationConfidence: confidence,
            updatedAt: new Date(),
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

          await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, parseInt(userId)));

          res.status(httpStatus).json({
            success: false,
            status: finalStatus,
            message:
              evsResult.status === "review"
                ? "Your verification has been submitted for manual review due to service configuration issues."
                : evsResult.errors?.length
                  ? evsResult.errors.join("; ")
                  : "Identity verification failed. Please ensure your documents are clear and try again.",
            reasons: evsResult.errors || ["Verification failed"],
            warnings: evsResult.warnings,
            confidence: confidence,
            verificationId,
            storedImages: uploadedFiles, // Keep images for review even on failure
            storageType: "vultr",
          });
        }
      } catch (error) {
        console.error("EVS verification error:", error);
        res.status(500).json({ message: "Verification service error" });
      }
    }
  );

  // Get certificate status for display in user interface
  app.get(
    "/api/users/:userId/certificate-status",
    verifyToken,
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.userId);

        if (isNaN(userId)) {
          return res.status(400).json({ error: "Invalid user ID" });
        }

        // Check access permissions
        const canAccess = req.user.role === "admin" || req.user.id === userId;
        if (!canAccess) {
          return res.status(403).json({ error: "Access denied" });
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
            verificationStatus: users.verificationStatus,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        // Get certificate information for signers and witnesses
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
                downloadUrl:
                  req.user.role === "admin"
                    ? `/api/admin/users/${userId}/certificate/download`
                    : `/api/user/certificate/download`,
              };
            } else {
              const isEligible = user.isVerified || user.isVerificationBypassed;
              certificateInfo = {
                hasCertificate: false,
                eligibleForGeneration: isEligible,
                reason: isEligible
                  ? "User is verified but no certificate generated yet"
                  : "User must complete ID verification first",
                canGenerate: isEligible,
              };
            }
          } catch (error) {
            console.error("Error getting certificate info:", error);
            certificateInfo = {
              hasCertificate: false,
              error: "Failed to load certificate information",
            };
          }
        } else {
          certificateInfo = {
            hasCertificate: false,
            eligibleForGeneration: false,
            reason: `Self-signed certificates are only available for signers and witnesses, not ${user.role}s`,
          };
        }

        res.json({
          success: true,
          user: {
            id: user.id,
            role: user.role,
            name: user.fullName || `${user.firstName} ${user.lastName}`.trim(),
            isVerified: user.isVerified || user.isVerificationBypassed,
            verificationStatus: user.verificationStatus,
          },
          certificate: certificateInfo,
        });
      } catch (error) {
        console.error("Certificate status check error:", error);
        res.status(500).json({ error: "Failed to check certificate status" });
      }
    }
  );

  // Test endpoint to check certificate generation capability
  app.get(
    "/api/certificates/test-capability/:userId",
    verifyToken,
    async (req: any, res) => {
      try {
        const userId = parseInt(req.params.userId);

        if (isNaN(userId)) {
          return res.status(400).json({ error: "Invalid user ID" });
        }

        // Check if user can request certificate generation
        if (req.user.id !== userId && req.user.role !== "admin") {
          return res.status(403).json({ error: "Access denied" });
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
            digitalCertificateExpiration: users.digitalCertificateExpiration,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        const isVerified =
          user.isVerified ||
          user.isVerificationBypassed ||
          user.notaryVerificationBypassed;
        const canGenerateCertificate =
          ["notary", "signer", "witness"].includes(user.role) && isVerified;
        const hasExistingCertificate = !!user.digitalCertificateFile;

        res.json({
          success: true,
          user: {
            id: user.id,
            role: user.role,
            name: user.fullName || `${user.firstName} ${user.lastName}`.trim(),
            isVerified,
            verificationMethod: user.isVerified
              ? "evs"
              : user.isVerificationBypassed
                ? "admin_bypass"
                : user.notaryVerificationBypassed
                  ? "notary_bypass"
                  : null,
          },
          certificate: {
            canGenerate: canGenerateCertificate,
            hasExisting: hasExistingCertificate,
            expirationDate: user.digitalCertificateExpiration,
            supportedTypes: ["notary", "signer", "witness"].includes(user.role)
              ? [user.role]
              : [],
            autoGeneratedAfterVerification: ["signer", "witness"].includes(
              user.role
            ),
            endpoints: {
              generateSelf:
                user.role === "notary"
                  ? "/api/certificates/generate-self"
                  : ["signer", "witness"].includes(user.role)
                    ? "/api/certificates/generate-signer-self"
                    : null,
              download: hasExistingCertificate
                ? `/api/certificates/download/${userId}`
                : null,
            },
          },
          requirements: canGenerateCertificate
            ? []
            : [
                !["notary", "signer", "witness"].includes(user.role)
                  ? "User role must be notary, signer, or witness"
                  : null,
                !isVerified ? "User must complete ID verification first" : null,
              ].filter(Boolean),
        });
      } catch (error) {
        console.error("Certificate capability check error:", error);
        res
          .status(500)
          .json({ error: "Failed to check certificate capability" });
      }
    }
  );
}
