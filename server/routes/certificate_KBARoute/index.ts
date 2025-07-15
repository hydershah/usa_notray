import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";
import { db } from "../../db";

import { verifyToken, hasAdminPrivileges, type AuthUser } from "../../auth";

interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { eq } from "drizzle-orm";

import { users } from "@shared/schema";

export async function certificate_KBARoutes(app: Express): Promise<Server> {
  app.get(
    "/api/admin/users/:userId/certificate/download",
    verifyToken,
    async (req: any, res) => {
      try {
        if (!hasAdminPrivileges(req.user)) {
          return res.status(403).json({ error: "Admin access required" });
        }

        const userId = parseInt(req.params.userId);
        const fileType = (req.query.type as string) || "cert";

        if (isNaN(userId)) {
          return res.status(400).json({ error: "Invalid user ID" });
        }

        if (!["cert", "key", "pubkey"].includes(fileType)) {
          return res
            .status(400)
            .json({ error: "Invalid file type. Use: cert, key, or pubkey" });
        }

        console.log(
          `🔍 Admin ${req.user.id} requesting certificate for user ${userId}, type: ${fileType}`
        );

        const { selfSignedCertificateService } = await import(
          "../../services/self-signed-certificate-service"
        );

        // First check if user exists and has the right role
        const [user] = await db
          .select({ id: users.id, role: users.role, fullName: users.fullName })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user) {
          console.log(`❌ User ${userId} not found`);
          return res.status(404).json({ error: "User not found" });
        }

        if (!["signer", "witness"].includes(user.role)) {
          console.log(
            `❌ User ${userId} has role '${user.role}', not signer/witness`
          );
          return res.status(400).json({
            error: `User role '${user.role}' does not have self-signed certificates. Only signers and witnesses have auto-generated certificates.`,
          });
        }

        console.log(
          `✅ User ${userId} (${user.role}) found, checking certificate...`
        );

        const result = await selfSignedCertificateService.getCertificateFile(
          userId,
          fileType as any
        );

        if (!result.success) {
          console.log(
            `❌ Certificate not found for user ${userId}: ${result.error}`
          );
          return res.status(404).json({ error: result.error });
        }

        console.log(
          `✅ Certificate found for user ${userId}, sending download...`
        );

        // Set appropriate headers for file download
        const fileExtension =
          fileType === "cert" ? "pem" : fileType === "key" ? "key" : "pub";
        const fileName = `${user.fullName || "user"}_${user.role}_certificate.${fileExtension}`;

        res.setHeader("Content-Type", "application/x-pem-file");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${fileName}"`
        );
        res.setHeader("X-Certificate-Type", "self-signed");
        res.setHeader("X-Downloaded-By", "admin");

        res.send(result.content);
      } catch (error) {
        console.error("Admin download certificate error:", error);
        res.status(500).json({ error: "Failed to download certificate" });
      }
    }
  );

  // User download their own certificate
  app.get(
    "/api/user/certificate/download",
    verifyToken,
    async (req: any, res) => {
      try {
        const userId = req.user.id;

        // Get the user to verify role
        const [user] = await db
          .select({ id: users.id, role: users.role, fullName: users.fullName })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        // Only signers and witnesses have self-signed certificates
        if (!["signer", "witness"].includes(user.role)) {
          return res.status(400).json({
            error: `Your role '${user.role}' does not have self-signed certificates. Only signers and witnesses have auto-generated certificates.`,
          });
        }

        const { selfSignedCertificateService } = await import(
          "../../services/self-signed-certificate-service"
        );
        const certificate =
          await selfSignedCertificateService.getUserCertificate(userId);

        if (!certificate || !certificate.certificate_content) {
          return res.status(404).json({
            error: "No certificate found",
            suggestion:
              "Complete ID verification to automatically generate your certificate",
          });
        }

        // Set headers for file download
        const filename = `${user.fullName || "my"}_${user.role}_certificate.pem`;
        res.setHeader("Content-Type", "application/x-pem-file");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        res.setHeader("Cache-Control", "no-cache");

        // Send the certificate content
        res.send(certificate.certificate_content);
      } catch (error) {
        console.error("User certificate download error:", error);
        res.status(500).json({ error: "Failed to download certificate" });
      }
    }
  );

  app.post("/api/kba/initialize", verifyToken, async (req: any, res) => {
    try {
      const {
        userId,
        firstName,
        lastName,
        dateOfBirth,
        ssn,
        address,
        phone,
        email,
      } = req.body;

      if (!userId || !firstName || !lastName || !dateOfBirth || !address) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required fields: userId, firstName, lastName, dateOfBirth, address",
        });
      }

      const { kbaService } = await import("../../lib/kba-service");

      const kbaSession = await kbaService.initializeKBASession({
        userId,
        firstName,
        lastName,
        dateOfBirth,
        ssn,
        address,
        phone,
        email,
      });

      res.json(kbaSession);
    } catch (error) {
      console.error("KBA initialization error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to initialize KBA session",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Submit KBA answers
  app.post("/api/kba/submit", verifyToken, async (req: any, res) => {
    try {
      const { sessionId, userId, answers } = req.body;

      if (!sessionId || !userId || !answers || !Array.isArray(answers)) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: sessionId, userId, answers",
        });
      }

      const { kbaService } = await import("../../lib/kba-service");

      const verificationResult = await kbaService.submitKBAAnswers({
        sessionId,
        userId,
        answers,
      });

      // Update user's KBA verification status in database
      if (
        verificationResult.success &&
        verificationResult.status === "passed"
      ) {
        await db
          .update(users)
          .set({
            kbaVerified: true,
            kbaVerificationDate: new Date(),
            kbaScore: verificationResult.score,
            updatedAt: new Date(),
          })
          .where(eq(users.id, parseInt(userId)));
      }

      res.json(verificationResult);
    } catch (error) {
      console.error("KBA submission error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit KBA answers",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Test KBA service connectivity
  app.get("/api/kba/test", verifyToken, async (req: any, res) => {
    try {
      const { kbaService } = await import("../../lib/kba-service");
      const testResult = await kbaService.testConnection();
      res.json(testResult);
    } catch (error) {
      console.error("KBA test error:", error);
      res.status(500).json({
        success: false,
        message: "KBA service test failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}
