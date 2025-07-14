import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";
import { db } from "../../db";

import { verifyToken, type AuthUser } from "../../auth";

interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { eq, and, desc, sql } from "drizzle-orm";
import {
  randomNotaryService,
  NotaryQualifications,
} from "../../random-notary-service";

import {
  users,
  jobs,
  signers,
  notaryAssignmentLog,
  companies,
} from "@shared/schema";

export async function randonNotaryRoutes(app: Express): Promise<Server> {
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
        return res
          .status(404)
          .json({
            error: "No qualified notaries available for the selected time slot",
          });
      }

      res.json(selectedNotary);
    } catch (error) {
      console.error("Error selecting random notary:", error);
      res.status(500).json({ error: "Failed to select random notary" });
    }
  });

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

  app.get(
    "/api/notaries/by-code/:notaryIdCode",
    verifyToken,
    async (req: any, res) => {
      try {
        if (req.user.role !== "title_company" && req.user.role !== "admin") {
          return res.status(403).json({ error: "Access denied" });
        }

        const { notaryIdCode } = req.params;

        if (!/^CY\d{4}$/i.test(notaryIdCode)) {
          return res
            .status(400)
            .json({
              error: "Invalid notary ID code format. Expected format: CY####",
            });
        }

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
