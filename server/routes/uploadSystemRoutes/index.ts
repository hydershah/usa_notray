import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";
import { db } from "../../db";
import fs from "fs";

import { verifyToken, type AuthUser } from "../../auth";

// Define the extended request interface for authentication
interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { and, desc, eq, sql } from "drizzle-orm";

import multer from "multer";

// Import enhanced upload handlers
import { getUploadedFile } from "../../enhanced-upload";
import {
  NotaryQualifications,
  randomNotaryService,
} from "server/random-notary-service";
import {
  companies,
  jobs,
  notaryAssignmentLog,
  signers,
  users,
} from "@shared/schema";

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

export async function uploadSystemRoutes(app: Express): Promise<Server> {
  app.post(
    "/api/uploads/signature",
    process.env.NODE_ENV === "development"
      ? (req: any, res: any, next: any) => {
          console.log(
            "Development mode: bypassing authentication for signature upload"
          );
          req.user = { id: 1, role: "admin", email: "admin@example.com" };
          next();
        }
      : verifyToken,
    upload.single("signature"),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No signature file uploaded" });
        }

        const {
          sessionId,
          participantId,
          signatureType = "signature",
        } = req.body;

        if (!sessionId || !participantId) {
          return res
            .status(400)
            .json({ error: "sessionId and participantId are required" });
        }

        const { VultrUploadHandler } = await import(
          "../../vultr-upload-handler"
        );

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
            code: "vultr_upload_failed",
          });
        }

        console.log(
          `✅ Uploaded signature to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`
        );

        res.json({
          success: true,
          message: "Signature uploaded successfully to Vultr",
          fileKey: uploadResult.fileKey,
          fileUrl: uploadResult.signedUrl,
          size: uploadResult.size,
          storageType: "vultr",
          signatureType,
        });
      } catch (error) {
        console.error("Signature upload error:", error);
        res.status(500).json({ error: "Signature upload failed" });
      }
    }
  );

  app.post(
    "/api/uploads/document",
    process.env.NODE_ENV === "development"
      ? (req: any, res: any, next: any) => {
          console.log(
            "Development mode: bypassing authentication for document upload"
          );
          req.user = { id: 1, role: "admin", email: "admin@example.com" };
          next();
        }
      : verifyToken,
    upload.single("document"),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No document file uploaded" });
        }

        const { jobId, sessionId, documentType = "additional" } = req.body;

        if (!jobId && !sessionId) {
          return res
            .status(400)
            .json({ error: "Either jobId or sessionId is required" });
        }

        // Upload document to Vultr
        const { VultrUploadHandler } = await import(
          "../../vultr-upload-handler"
        );

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
              uploadType: "general",
            }
          );
        } else {
          // General document upload for sessions (use signature handler with 'signature' type)
          uploadResult = await VultrUploadHandler.handleSignatureUpload(
            req.file.buffer,
            req.file.originalname,
            sessionId,
            req.user.id,
            "signature"
          );
        }

        if (!uploadResult.success) {
          return res.status(500).json({
            error: `Failed to upload document: ${uploadResult.error}`,
            code: "vultr_upload_failed",
          });
        }

        console.log(
          `✅ Uploaded document to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`
        );

        res.json({
          success: true,
          message: "Document uploaded successfully to Vultr",
          fileKey: uploadResult.fileKey,
          fileUrl: uploadResult.signedUrl,
          size: uploadResult.size,
          storageType: "vultr",
          documentType,
        });
      } catch (error) {
        console.error("Document upload error:", error);
        res.status(500).json({ error: "Document upload failed" });
      }
    }
  );

  app.post(
    "/api/uploads/notary-stamp",
    process.env.NODE_ENV === "development"
      ? (req: any, res: any, next: any) => {
          console.log(
            "Development mode: bypassing authentication for stamp upload"
          );
          req.user = { id: 1, role: "admin", email: "admin@example.com" };
          next();
        }
      : verifyToken,
    upload.single("stamp"),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No stamp image uploaded" });
        }

        const { notaryId, state, commission } = req.body;

        if (!notaryId) {
          return res.status(400).json({ error: "notaryId is required" });
        }

        // Upload notary stamp to Vultr
        const { VultrUploadHandler } = await import(
          "../../vultr-upload-handler"
        );

        const uploadResult = await VultrUploadHandler.handleNotaryStampUpload(
          req.file.buffer,
          req.file.originalname,
          parseInt(notaryId),
          {
            state,
            commission,
            uploadedBy: req.user.id,
            uploadType: "notary_stamp",
          }
        );

        if (!uploadResult.success) {
          return res.status(500).json({
            error: `Failed to upload notary stamp: ${uploadResult.error}`,
            code: "vultr_upload_failed",
          });
        }

        // Create notary stamp record in database using correct column names
        if (!uploadResult.fileKey) {
          return res.status(500).json({
            error: "Failed to get file key from upload result",
            code: "missing_file_key",
          });
        }

        try {
          const insertResult = await db.execute(sql`
            INSERT INTO notary_stamps (notary_id, stamp_name, stamp_image, is_active, created_at, updated_at)
            VALUES (${parseInt(notaryId)}, 'notary', ${uploadResult.fileKey}, false, NOW(), NOW())
            RETURNING id
          `);

          console.log(
            `✅ Uploaded notary stamp to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`
          );
          console.log(
            `✅ Created database record with ID:`,
            insertResult.rows[0]?.id
          );

          res.json({
            success: true,
            message: "Notary stamp uploaded successfully to Vultr",
            fileKey: uploadResult.fileKey,
            fileUrl: uploadResult.signedUrl || "",
            size: uploadResult.size || 0,
            storageType: "vultr",
            stampId: insertResult.rows[0]?.id,
            note: "Stamp requires admin approval before activation",
          });
        } catch (dbError) {
          console.error("Database insertion failed:", dbError);
          // Try to clean up the uploaded file if database insertion fails
          try {
            const { cloudStorage } = await import(
              "../../lib/cloud-storage-service"
            );
            await cloudStorage.deleteFile(uploadResult.fileKey);
            console.log(`🧹 Cleaned up orphaned file: ${uploadResult.fileKey}`);
          } catch (cleanupError) {
            console.error("Failed to cleanup orphaned file:", cleanupError);
          }

          return res.status(500).json({
            error: "Failed to save stamp record to database",
            code: "database_insert_failed",
          });
        }
      } catch (error) {
        console.error("Notary stamp upload error:", error);
        res.status(500).json({ error: "Notary stamp upload failed" });
      }
    }
  );

  // Secure file retrieval
  app.get("/api/uploads/:type/:fileId", verifyToken, getUploadedFile);

  app.put(
    "/api/notary/stamps/:stampId/activate",
    verifyToken,
    async (req: any, res) => {
      try {
        const stampId = parseInt(req.params.stampId);
        if (req.user.role !== "admin" && req.user.role !== "notary") {
          return res
            .status(403)
            .json({ message: "Access denied - notary access required" });
        }

        if (isNaN(stampId)) {
          return res.status(400).json({ message: "Invalid stamp ID" });
        }
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
          return res.status(404).json({ message: "Stamp not found" });
        }

        if (req.user.role !== "admin" && stamp.notaryId !== req.user.id) {
          return res.status(403).json({
            message: "Access denied - you can only activate your own stamps",
          });
        }
        await db.execute(sql`
          UPDATE notary_stamps 
          SET is_active = false, updated_at = NOW()
          WHERE notary_id = ${stamp.notaryId}
        `);

        const updateResult = await db.execute(sql`
          UPDATE notary_stamps 
          SET is_active = true, updated_at = NOW()
          WHERE id = ${stampId}
        `);

        const updatedStamp = (updateResult.rowCount ?? 0) > 0;

        if (!updatedStamp) {
          return res.status(500).json({ message: "Failed to activate stamp" });
        }

        console.log(
          `✅ Activated stamp ${stampId} for notary ${stamp.notaryId}`
        );

        res.json({
          success: true,
          message: "Stamp activated successfully",
          stamp: {
            id: stampId,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      } catch (error) {
        console.error("Activate stamp error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.delete(
    "/api/notary/stamps/:stampId",
    verifyToken,
    async (req: any, res) => {
      try {
        const stampId = parseInt(req.params.stampId);

        if (req.user.role !== "admin" && req.user.role !== "notary") {
          return res
            .status(403)
            .json({ message: "Access denied - notary access required" });
        }

        if (isNaN(stampId)) {
          return res.status(400).json({ message: "Invalid stamp ID" });
        }
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
          return res.status(404).json({ message: "Stamp not found" });
        }
        if (req.user.role !== "admin" && stamp.notaryId !== req.user.id) {
          return res.status(403).json({
            message: "Access denied - you can only delete your own stamps",
          });
        }

        if (
          stamp.stampData &&
          typeof stamp.stampData === "string" &&
          !stamp.stampData.startsWith("data:image/")
        ) {
          try {
            const { cloudStorage } = await import(
              "../../lib/cloud-storage-service"
            );
            const fileExists = await cloudStorage.fileExists(stamp.stampData);
            if (fileExists) {
              await cloudStorage.deleteFile(stamp.stampData);
              console.log(
                `✅ Deleted stamp file from Vultr: ${stamp.stampData}`
              );
            }
          } catch (vultrError) {
            console.error(
              `❌ Failed to delete stamp file from Vultr: ${stamp.stampData}`,
              vultrError
            );
          }
        }

        const deleteResult = await db.execute(sql`
          DELETE FROM notary_stamps WHERE id = ${stampId}
        `);
        const deletedStamp = (deleteResult.rowCount ?? 0) > 0;
        if (!deletedStamp) {
          return res
            .status(500)
            .json({ message: "Failed to delete stamp from database" });
        }

        console.log(`✅ Deleted stamp ${stampId} for notary ${stamp.notaryId}`);

        res.json({
          success: true,
          message: "Stamp deleted successfully",
        });
      } catch (error) {
        console.error("Delete stamp error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.get("/api/placeholder/stamp-missing", async (req, res) => {
    try {
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

      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(svgPlaceholder);
    } catch (error) {
      console.error("Placeholder stamp error:", error);
      res.status(500).send("Error generating placeholder");
    }
  });

  app.get("/api/placeholder/stamp-error", async (req, res) => {
    try {
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

      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(svgPlaceholder);
    } catch (error) {
      console.error("Placeholder stamp error:", error);
      res.status(500).send("Error generating placeholder");
    }
  });

  // Recording upload endpoint for enhanced video system
  app.post(
    "/api/recordings/upload",
    verifyToken,
    upload.single("recording"),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res
            .status(400)
            .json({ message: "No recording file provided" });
        }

        const { jobId, recordingType = "notarization" } = req.body;

        if (!jobId) {
          return res.status(400).json({ message: "Job ID is required" });
        }

        // Upload recording to Vultr
        const { VultrUploadHandler } = await import(
          "../../vultr-upload-handler"
        );

        const fileBuffer = req.file.buffer
          ? Buffer.from(req.file.buffer)
          : await fs.promises.readFile(req.file.path);

        const uploadResult =
          await VultrUploadHandler.handleVideoRecordingUpload(
            fileBuffer,
            req.file.originalname,
            parseInt(jobId),
            {
              recordingType,
              userRole: req.user.role,
              userId: req.user.id,
              timestamp: new Date().toISOString(),
            }
          );

        if (!uploadResult.success) {
          return res.status(500).json({
            message: `Failed to upload recording: ${uploadResult.error}`,
            error: "vultr_upload_failed",
          });
        }

        console.log(
          `✅ Uploaded recording to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`
        );

        res.json({
          success: true,
          message: "Recording uploaded successfully to Vultr",
          fileKey: uploadResult.fileKey,
          fileUrl: uploadResult.signedUrl,
          size: uploadResult.size,
          storageType: "vultr",
        });
      } catch (error) {
        console.error("Recording upload error:", error);
        res.status(500).json({ message: "Recording upload failed" });
      }
    }
  );

  app.post("/api/verification/webhook", async (req, res) => {
    try {
      const { event, data } = req.body;

      console.log("Identity verification webhook:", { event, data });
      if (event === "verification.completed") {
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Verification webhook error:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });
  app.get(
    "/api/compliance/report/:sessionId",
    verifyToken,
    async (req: any, res) => {
      try {
        if (req.user.role !== "admin" && req.user.role !== "notary") {
          return res.status(403).json({ message: "Access denied" });
        }

        const sessionId = req.params.sessionId;
        const mockReport = {
          sessionId,
          timestamp: new Date().toISOString(),
          complianceScore: 95,
          checks: [
            {
              category: "identity",
              status: "passed",
              description: "Identity verification completed",
            },
            {
              category: "recording",
              status: "passed",
              description: "Session recorded with high quality",
            },
            {
              category: "signature",
              status: "passed",
              description: "Professional signatures captured",
            },
            {
              category: "audit",
              status: "passed",
              description: "Complete audit trail maintained",
            },
          ],
          recommendations: [
            "Continue using enhanced identity verification for all signers",
            "Maintain backup recordings for critical sessions",
          ],
        };

        res.json(mockReport);
      } catch (error) {
        console.error("Compliance report error:", error);
        res.status(500).json({ message: "Report generation failed" });
      }
    }
  );

  app.get(
    "/api/sessions/:sessionId/status",
    verifyToken,
    async (req: any, res) => {
      try {
        const sessionId = req.params.sessionId;

        const sessionStatus = {
          sessionId,
          status: "active",
          participants: [
            {
              id: "1",
              name: "Demo User",
              role: "signer",
              verified: true,
              connected: true,
            },
            {
              id: "2",
              name: "Notary Public",
              role: "notary",
              verified: true,
              connected: true,
            },
          ],
          recording: {
            active: true,
            quality: "FHD",
            duration: 1245, // seconds
            cloudBackup: true,
          },
          compliance: {
            identityVerification: "completed",
            recordingQuality: "high",
            auditTrail: "complete",
            overallScore: 98,
          },
          lastActivity: new Date().toISOString(),
        };

        res.json(sessionStatus);
      } catch (error) {
        console.error("Session status error:", error);
        res.status(500).json({ message: "Session status retrieval failed" });
      }
    }
  );

  app.get(
    "/api/random-notary/availability/:date",
    verifyToken,
    async (req: any, res) => {
      try {
        const { date } = req.params;
        const { requiresNSA, requiresSpanishSpeaking, excludeNotaryIds } =
          req.query;

        if (req.user.role !== "admin" && req.user.role !== "title_company") {
          return res.status(403).json({ error: "Access denied" });
        }

        const qualifications: NotaryQualifications = {
          requiresNSA: requiresNSA === "true",
          requiresSpanishSpeaking: requiresSpanishSpeaking === "true",
        };

        const excludeIds = excludeNotaryIds
          ? (Array.isArray(excludeNotaryIds)
              ? excludeNotaryIds
              : [excludeNotaryIds]
            ).map((id: string) => parseInt(id))
          : [];

        const availability = await randomNotaryService.aggregateAvailability(
          qualifications,
          date,
          excludeIds
        );
        res.json(availability);
      } catch (error) {
        console.error("Error getting notary availability:", error);
        res.status(500).json({ error: "Failed to get notary availability" });
      }
    }
  );

  // Get qualified notaries for a job
  app.get(
    "/api/random-notary/qualified",
    verifyToken,
    async (req: any, res) => {
      try {
        const { requiresNSA, requiresSpanishSpeaking, excludeNotaryIds } =
          req.query;

        if (req.user.role !== "admin" && req.user.role !== "title_company") {
          return res.status(403).json({ error: "Access denied" });
        }

        const qualifications: NotaryQualifications = {
          requiresNSA: requiresNSA === "true",
          requiresSpanishSpeaking: requiresSpanishSpeaking === "true",
        };

        const excludeIds = excludeNotaryIds
          ? (Array.isArray(excludeNotaryIds)
              ? excludeNotaryIds
              : [excludeNotaryIds]
            ).map((id: string) => parseInt(id))
          : [];

        const qualifiedNotaries =
          await randomNotaryService.getQualifiedNotaries(
            qualifications,
            excludeIds
          );
        res.json(qualifiedNotaries);
      } catch (error) {
        console.error("Error getting qualified notaries:", error);
        res.status(500).json({ error: "Failed to get qualified notaries" });
      }
    }
  );

  // Select random notary for a specific time slot
  app.post("/api/random-notary/select", verifyToken, async (req: any, res) => {
    try {
      const { qualifications, timeSlot, excludeNotaryIds } = req.body;

      if (req.user.role !== "admin" && req.user.role !== "title_company") {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!qualifications || !timeSlot) {
        return res
          .status(400)
          .json({ error: "Qualifications and time slot are required" });
      }

      const selectedNotary = await randomNotaryService.selectRandomNotary(
        qualifications,
        timeSlot,
        excludeNotaryIds || []
      );

      if (!selectedNotary) {
        return res.status(404).json({
          error: "No qualified notaries available for the selected time slot",
        });
      }

      res.json(selectedNotary);
    } catch (error) {
      console.error("Error selecting random notary:", error);
      res.status(500).json({ error: "Failed to select random notary" });
    }
  });

  app.get(
    "/api/jobs/:id/completion-report",
    verifyToken,
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.id);

        if (isNaN(jobId)) {
          return res.status(400).json({ message: "Invalid job ID" });
        }

        const job = await storage.getJob(jobId);
        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }

        if (
          req.user.role !== "admin" &&
          job.userId !== req.user.id &&
          job.selectedNotary !== req.user.id.toString()
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        const { JobCompletionReportService } = await import(
          "../../services/job-completion-report-service"
        );
        const reportInfo =
          await JobCompletionReportService.getJobCompletionReport(jobId);

        res.json(reportInfo);
      } catch (error) {
        console.error("Get completion report error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.get(
    "/api/jobs/:id/completion-report/download",
    verifyToken,
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.id);

        if (isNaN(jobId)) {
          return res.status(400).json({ message: "Invalid job ID" });
        }

        const job = await storage.getJob(jobId);
        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }

        // Check if user has access to this job
        if (
          req.user.role !== "admin" &&
          job.userId !== req.user.id &&
          job.selectedNotary !== req.user.id.toString()
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        const { JobCompletionReportService } = await import(
          "../../services/job-completion-report-service"
        );
        const reportInfo =
          await JobCompletionReportService.getJobCompletionReport(jobId);

        if (!reportInfo.exists || !reportInfo.reportPath) {
          return res
            .status(404)
            .json({ message: "Completion report not found" });
        }

        const fs = await import("fs/promises");
        const path = await import("path");

        try {
          const fullPath = path.resolve(reportInfo.reportPath);
          const fileStats = await fs.stat(fullPath);

          if (!fileStats.isFile()) {
            return res.status(404).json({ message: "Report file not found" });
          }

          const fileName = path.basename(fullPath);

          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${fileName}"`
          );
          res.setHeader("Content-Length", fileStats.size);

          const fileBuffer = await fs.readFile(fullPath);
          res.send(fileBuffer);
        } catch (fileError) {
          console.error("Error reading report file:", fileError);
          return res
            .status(404)
            .json({ message: "Report file not accessible" });
        }
      } catch (error) {
        console.error("Download completion report error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.post(
    "/api/jobs/:id/generate-completion-report",
    verifyToken,
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.id);

        if (isNaN(jobId)) {
          return res.status(400).json({ message: "Invalid job ID" });
        }

        const job = await storage.getJob(jobId);
        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }

        if (req.user.role !== "admin" && job.userId !== req.user.id) {
          return res.status(403).json({ message: "Access denied" });
        }

        const { JobCompletionReportService } = await import(
          "../../services/job-completion-report-service"
        );
        const reportResult =
          await JobCompletionReportService.generateJobCompletionReport(jobId);

        if (reportResult.success) {
          res.json({
            success: true,
            message: "Completion report generated successfully",
            reportPath: reportResult.reportPath,
          });
        } else {
          res.status(500).json({
            success: false,
            message: "Failed to generate completion report",
            error: reportResult.error,
          });
        }
      } catch (error) {
        console.error("Generate completion report error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // Assign notary to job (supports random, preferred, and manual assignment)
  app.post("/api/random-notary/assign", verifyToken, async (req: any, res) => {
    try {
      const { jobId, notaryId, timeSlot, assignmentType } = req.body;

      if (req.user.role !== "admin" && req.user.role !== "title_company") {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!jobId || !notaryId || !timeSlot) {
        return res
          .status(400)
          .json({ error: "Job ID, notary ID, and time slot are required" });
      }

      const success = await randomNotaryService.assignNotaryToJob(
        jobId,
        notaryId,
        timeSlot,
        assignmentType || "manual"
      );

      if (success) {
        res.json({ success: true, message: "Notary assigned successfully" });
      } else {
        res.status(500).json({ error: "Failed to assign notary to job" });
      }
    } catch (error) {
      console.error("Error assigning notary to job:", error);
      res.status(500).json({ error: "Failed to assign notary to job" });
    }
  });

  // Handle notary rejection
  app.post("/api/random-notary/reject", verifyToken, async (req: any, res) => {
    try {
      const { jobId, rejectionReason } = req.body;
      const notaryId = req.user.id;

      if (req.user.role !== "notary") {
        return res
          .status(403)
          .json({ error: "Only notaries can reject assignments" });
      }

      if (!jobId) {
        return res.status(400).json({ error: "Job ID is required" });
      }

      const newNotary = await randomNotaryService.handleNotaryRejection(
        jobId,
        notaryId,
        rejectionReason
      );

      if (newNotary) {
        res.json({
          success: true,
          message: "Assignment rejected and new notary assigned",
          newNotary,
        });
      } else {
        // Send priority alert to admin
        await randomNotaryService.sendPriorityAlert(
          jobId,
          `No available notaries found for job ${jobId} after rejection by notary ${notaryId}`
        );

        res.json({
          success: true,
          message:
            "Assignment rejected. Admin has been notified to manually assign a notary.",
          requiresManualAssignment: true,
        });
      }
    } catch (error) {
      console.error("Error handling notary rejection:", error);
      res.status(500).json({ error: "Failed to handle notary rejection" });
    }
  });

  // Check session access for users (especially signers) - simplified version
  app.get(
    "/api/jobs/:id/session-access",
    verifyToken,
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.id);
        const userId = req.user.id;

        if (!jobId || isNaN(jobId)) {
          return res.status(400).json({
            hasAccess: false,
            message: "Invalid job ID",
            errorType: "invalid_request",
          });
        }

        // Get job details
        const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
        if (!job) {
          return res.status(404).json({
            hasAccess: false,
            message: "Job not found",
            errorType: "job_not_found",
          });
        }

        // Get user details
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId));
        if (!user) {
          return res.status(404).json({
            hasAccess: false,
            message: "User not found",
            errorType: "user_not_found",
          });
        }

        // Check access based on user role
        let hasAccess = false;
        let accessReason = "";
        let requirements = [];

        // Admin access - always allowed
        if (user.role === "admin" || user.isAdmin) {
          hasAccess = true;
          accessReason = "admin";
        }
        // Job creator access
        else if (job.userId === userId) {
          hasAccess = true;
          accessReason = "job_creator";
        }
        // Assigned notary access
        else if (
          job.notaryId === userId ||
          job.selectedNotary === userId.toString()
        ) {
          hasAccess = true;
          accessReason = "assigned_notary";
        }
        // Signer access - check via signers table
        else if (user.role === "signer" || user.role === "witness") {
          const [signer] = await db
            .select()
            .from(signers)
            .where(
              and(eq(signers.jobId, jobId), eq(signers.signerEmail, user.email))
            )
            .limit(1);

          if (signer) {
            // Check if account setup is complete
            if (!user.accountSetupComplete) {
              return res.json({
                hasAccess: false,
                message: "Please complete your account setup first",
                errorType: "account_setup_required",
                requirements: ["Account setup must be completed"],
              });
            }

            // Check if ID verification is complete (for signers)
            if (
              !user.isVerified &&
              !user.isVerificationBypassed &&
              !user.notaryVerificationBypassed
            ) {
              return res.json({
                hasAccess: false,
                message: "ID verification required before joining sessions",
                errorType: "verification_required",
                requirements: ["Complete ID verification in your dashboard"],
              });
            }

            hasAccess = true;
            accessReason = "invited_signer";
          }
        }

        if (hasAccess) {
          res.json({
            hasAccess: true,
            accessReason,
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              isVerified: user.isVerified,
              accountSetupComplete: user.accountSetupComplete,
            },
            job: {
              id: job.id,
              titleCompany: job.titleCompany,
              jobStatus: job.jobStatus,
              notaryApprovalStatus: job.notaryApprovalStatus,
            },
          });
        } else {
          res.json({
            hasAccess: false,
            message: "You do not have permission to access this job session",
            errorType: "access_denied",
            requirements,
          });
        }
      } catch (error) {
        console.error("Session access check error:", error);
        res.status(500).json({
          hasAccess: false,
          message: "Failed to check session access",
          errorType: "server_error",
        });
      }
    }
  );

  // Get assignment history for a job
  app.get(
    "/api/random-notary/assignment-history/:jobId",
    verifyToken,
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.jobId);

        if (req.user.role !== "admin" && req.user.role !== "title_company") {
          return res.status(403).json({ error: "Access denied" });
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
            notaryEmail: users.email,
          })
          .from(notaryAssignmentLog)
          .leftJoin(users, eq(notaryAssignmentLog.notaryId, users.id))
          .where(eq(notaryAssignmentLog.jobId, jobId))
          .orderBy(desc(notaryAssignmentLog.assignedAt));

        res.json(assignmentHistory);
      } catch (error) {
        console.error("Error getting assignment history:", error);
        res.status(500).json({ error: "Failed to get assignment history" });
      }
    }
  );

  // Check if title company has preferred notary
  app.get(
    "/api/title-companies/:companyName/preferred-notary",
    verifyToken,
    async (req: any, res) => {
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
            preferredNotaryActive: users.isActive,
          })
          .from(companies)
          .leftJoin(users, eq(companies.preferredNotaryId, users.id))
          .where(eq(companies.companyName, companyName))
          .limit(1);

        if (company.length === 0) {
          return res.status(404).json({ error: "Title company not found" });
        }

        res.json(company[0]);
      } catch (error) {
        console.error("Error getting preferred notary:", error);
        res.status(500).json({ error: "Failed to get preferred notary" });
      }
    }
  );

  // Get notary by ID code (for title company manual assignment)
  app.get(
    "/api/notaries/by-code/:notaryIdCode",
    verifyToken,
    async (req: any, res) => {
      try {
        // Verify user is title company or admin
        if (req.user.role !== "title_company" && req.user.role !== "admin") {
          return res.status(403).json({ error: "Access denied" });
        }

        const { notaryIdCode } = req.params;

        // Validate notary ID code format (CY followed by 4 digits)
        if (!/^CY\d{4}$/i.test(notaryIdCode)) {
          return res.status(400).json({
            error: "Invalid notary ID code format. Expected format: CY####",
          });
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
            notaryType: users.notaryType,
          })
          .from(users)
          .where(
            and(
              sql`UPPER(${users.notaryIdCode}) = UPPER(${notaryIdCode})`,
              eq(users.role, "notary"),
              eq(users.isActive, true)
            )
          )
          .limit(1);

        if (notary.length === 0) {
          return res
            .status(404)
            .json({ error: "Notary not found or inactive" });
        }

        // Return notary information (without sensitive data)
        const notaryData = notary[0];
        res.json({
          id: notaryData.id,
          notaryIdCode: notaryData.notaryIdCode,
          name:
            `${notaryData.firstName} ${notaryData.lastName}`.trim() ||
            notaryData.username,
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
            spanish: notaryData.isSpanishSpeaking,
          },
        });
      } catch (error) {
        console.error("Error finding notary by code:", error);
        res.status(500).json({ error: "Failed to find notary" });
      }
    }
  );
}
