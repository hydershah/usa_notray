import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";
import { db } from "../../db";

import { verifyToken, hasAdminPrivileges, type AuthUser } from "../../auth";

// Define the extended request interface for authentication
interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { eq } from "drizzle-orm";

import { users } from "@shared/schema";

export async function userCertificateRoutes(app: Express): Promise<Server> {
  app.get("/api/user/certificate", verifyToken, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const { selfSignedCertificateService } = await import(
        "../../services/self-signed-certificate-service"
      );
      const certificate =
        await selfSignedCertificateService.getUserCertificate(userId);

      if (!certificate) {
        return res.json({
          hasCertificate: false,
          message:
            "No certificate found. Complete ID verification to generate a certificate.",
        });
      }

      const isExpired = new Date() > new Date(certificate.expires_at);

      res.json({
        hasCertificate: true,
        certificate: {
          id: certificate.id,
          certificateId: certificate.certificate_id,
          commonName: certificate.common_name,
          userRole: certificate.user_role,
          issuedAt: certificate.issued_at,
          expiresAt: certificate.expires_at,
          status: certificate.status,
          isExpired,
          downloadUrl: `/api/user/certificate/download`,
        },
      });
    } catch (error) {
      console.error("Get user certificate error:", error);
      res.status(500).json({ error: "Failed to get certificate information" });
    }
  });

  app.get(
    "/api/user/certificate/download",
    verifyToken,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const fileType = (req.query.type as string) || "cert";

        if (!["cert", "key", "pubkey"].includes(fileType)) {
          return res
            .status(400)
            .json({ error: "Invalid file type. Use: cert, key, or pubkey" });
        }

        const { selfSignedCertificateService } = await import(
          "../../services/self-signed-certificate-service"
        );
        const result = await selfSignedCertificateService.getCertificateFile(
          userId,
          fileType as any
        );

        if (!result.success) {
          return res.status(404).json({ error: result.error });
        }

        // Set appropriate headers for file download
        const fileExtension =
          fileType === "cert" ? "pem" : fileType === "key" ? "key" : "pub";
        const fileName = `certificate-${userId}-${fileType}.${fileExtension}`;

        res.setHeader("Content-Type", "application/x-pem-file");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${fileName}"`
        );
        res.setHeader("X-Certificate-Type", "self-signed");

        res.send(result.content);
      } catch (error) {
        console.error("Download certificate error:", error);
        res.status(500).json({ error: "Failed to download certificate" });
      }
    }
  );

  // Generate certificate manually (for users who didn't get one automatically)
  app.post(
    "/api/user/certificate/generate",
    verifyToken,
    async (req: any, res) => {
      try {
        const userId = req.user.id;

        // Check if user is eligible
        const [user] = await db
          .select({
            role: users.role,
            isVerified: users.isVerified,
            isVerificationBypassed: users.isVerificationBypassed,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        if (!["signer", "witness"].includes(user.role)) {
          return res.status(403).json({
            error:
              "Certificate generation is only available for signers and witnesses",
          });
        }

        const isVerified = user.isVerified || user.isVerificationBypassed;
        if (!isVerified) {
          return res.status(403).json({
            error:
              "Please complete ID verification before generating a certificate",
          });
        }

        const { selfSignedCertificateService } = await import(
          "../../services/self-signed-certificate-service"
        );
        const result =
          await selfSignedCertificateService.generateCertificateForUser(userId);

        if (result.success) {
          res.json({
            success: true,
            message: "Self-signed certificate generated successfully",
            certificate: {
              certificateId: result.certificateId,
              expirationDate: result.expirationDate,
              downloadUrl: "/api/user/certificate/download",
            },
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.error,
          });
        }
      } catch (error) {
        console.error("Generate certificate error:", error);
        res.status(500).json({ error: "Failed to generate certificate" });
      }
    }
  );

  // Admin: Get all certificates
  app.get("/api/admin/certificates", verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { selfSignedCertificateService } = await import(
        "../../services/self-signed-certificate-service"
      );
      const certificates =
        await selfSignedCertificateService.getAllCertificates();

      res.json({
        certificates,
        count: certificates.length,
        stats: {
          active: certificates.filter(
            (c) => c.status === "active" && !c.isExpired
          ).length,
          expired: certificates.filter((c) => c.isExpired).length,
          revoked: certificates.filter((c) => c.status === "revoked").length,
        },
      });
    } catch (error) {
      console.error("Get all certificates error:", error);
      res.status(500).json({ error: "Failed to get certificates" });
    }
  });

  // Admin: Get certificate for specific user
  app.get(
    "/api/admin/users/:userId/certificate",
    verifyToken,
    async (req: any, res) => {
      try {
        if (!hasAdminPrivileges(req.user)) {
          return res.status(403).json({ error: "Admin access required" });
        }

        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) {
          return res.status(400).json({ error: "Invalid user ID" });
        }

        const { selfSignedCertificateService } = await import(
          "../../services/self-signed-certificate-service"
        );
        const certificate =
          await selfSignedCertificateService.getUserCertificate(userId);

        if (!certificate) {
          return res.json({
            hasCertificate: false,
            message: "User has no certificate",
          });
        }

        const isExpired = new Date() > new Date(certificate.expires_at);

        res.json({
          hasCertificate: true,
          certificate: {
            id: certificate.id,
            certificateId: certificate.certificate_id,
            commonName: certificate.common_name,
            userRole: certificate.user_role,
            userEmail: certificate.user_email,
            issuedAt: certificate.issued_at,
            expiresAt: certificate.expires_at,
            status: certificate.status,
            isExpired,
            downloadUrl: `/api/admin/users/${userId}/certificate/download`,
          },
        });
      } catch (error) {
        console.error("Get user certificate error:", error);
        res.status(500).json({ error: "Failed to get user certificate" });
      }
    }
  );

  // Admin: Download certificate for specific user
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

  // Admin: Revoke certificate
  app.post(
    "/api/admin/users/:userId/certificate/revoke",
    verifyToken,
    async (req: any, res) => {
      try {
        if (!hasAdminPrivileges(req.user)) {
          return res.status(403).json({ error: "Admin access required" });
        }

        const userId = parseInt(req.params.userId);
        const { reason } = req.body;

        if (isNaN(userId)) {
          return res.status(400).json({ error: "Invalid user ID" });
        }

        const { selfSignedCertificateService } = await import(
          "../../services/self-signed-certificate-service"
        );
        const result = await selfSignedCertificateService.revokeCertificate(
          userId,
          reason
        );

        if (result.success) {
          res.json({
            success: true,
            message: "Certificate revoked successfully",
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.error,
          });
        }
      } catch (error) {
        console.error("Revoke certificate error:", error);
        res.status(500).json({ error: "Failed to revoke certificate" });
      }
    }
  );

  const certificateRoutes = await import("../../certificate-routes");
  app.use("/api/certificates", certificateRoutes.default);
}
