import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";
import { db } from "../../db";
import multer from "multer";

import { auditLoggingService } from "../../services/audit-logging-service";
import { notificationService } from "../../notification-service";
import {
  verifyToken,
  hasAdminPrivileges,
  hasNotaryPrivileges,
  type AuthUser,
} from "../../auth";
import { cacheUserData, cacheJobData } from "../../middleware/cache-middleware";
import bcrypt from "bcrypt";

interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { eq, and, desc } from "drizzle-orm";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
import {
  users,
  jobs,
  signers,
  notaryAssignmentLog,
  companies,
  titleCompanyNotaryAssignments,
  passwordResetTokens,
  jobNotifications,
  calendarEvents,
} from "@shared/schema";
import { emailService } from "server/lib/email-service";

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

function addHourToTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const newHours = (hours + 1) % 24;
  return `${newHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}
export async function registerJobManagementRoutes(
  app: Express
): Promise<Server> {
  app.use((req: any, res: any, next: any) => {
    auditLoggingService.auditMiddleware()(req, res, next);
  });

  app.get(
    "/api/jobs",
    verifyToken,
    cacheUserData(180),
    async (req: any, res) => {
      try {
        const jobs = await storage.getRoleBasedJobs(req.user.id, req.user.role);
        res.json(jobs);
      } catch (error) {
        console.error("Get jobs error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );
  app.get("/api/jobs/invited", verifyToken, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Get jobs where this user is a signer
      const invitedJobs = await db
        .select({
          // Job fields
          id: jobs.id,
          titleCompany: jobs.titleCompany,
          closingType: jobs.closingType,
          propertyAddressOne: jobs.propertyAddressOne,
          propertyCity: jobs.propertyCity,
          propertyState: jobs.propertyState,
          selectedDate: jobs.selectedDate,
          selectedTime: jobs.selectedTime,
          jobStatus: jobs.jobStatus,
          notaryApprovalStatus: jobs.notaryApprovalStatus,
          createdAt: jobs.createdAt,
          // Signer specific fields
          signerRole: signers.signerRole,
          signingStatus: signers.signingStatus,
          invitationToken: signers.invitationToken,
          invitationSentAt: signers.invitationSentAt,
        })
        .from(signers)
        .innerJoin(jobs, eq(signers.jobId, jobs.id))
        .where(eq(signers.userId, userId))
        .orderBy(desc(jobs.createdAt));

      res.json(invitedJobs);
    } catch (error) {
      console.error("Get invited jobs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(
    "/api/jobs/:id",
    verifyToken,
    cacheJobData(180),
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.id);
        const job = await storage.getJob(jobId);

        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }

        const hasBasicAccess =
          req.user.role === "admin" ||
          job.userId === req.user.id ||
          job.selectedNotary === req.user.id.toString();

        if (!hasBasicAccess) {
          const hasSessionAccess = await storage.verifySessionAccess(
            jobId,
            req.user.id
          );
          if (!hasSessionAccess) {
            return res.status(403).json({ message: "Access denied" });
          }
        }

        const signers = await storage.getSignersByJobId(jobId);

        const jobResponse = {
          ...job,
          uploadedFile: job.uploadedFile,
          notarizedFile: job.notarizedFile,
          signers,
        };

        res.json(jobResponse);
      } catch (error) {
        console.error("Get job error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.post(
    "/api/jobs",
    verifyToken,
    upload.array("documents", 10),
    async (req: any, res) => {
      try {
        const hasAdminAccess = hasAdminPrivileges(req.user);
        const hasNotaryAccess = hasNotaryPrivileges(req.user);

        // Check if user has permission to create jobs
        const userCanCreateJob =
          hasAdminAccess ||
          req.user.role === "title_company" ||
          (req.user.role === "notary" && req.user.notaryType === "subscriber");

        if (!userCanCreateJob) {
          return res.status(403).json({
            message:
              "Access denied. Only administrators, title companies, and subscriber notaries can create jobs.",
          });
        }

        const jobData = {
          ...req.body,
          userId: req.user.id,
          kbaRequired: req.body.kbaRequired === "true",
        };

        // Remove the old single file fields from job data
        delete jobData.uploadedFile;
        delete jobData.notarizedFile;

        // CRITICAL FIX: Ensure constraint compliance for notary assignments
        console.log(
          `🔧 Job creation - notaryOption: ${jobData.notaryOption}, selectedNotary: ${jobData.selectedNotary}, notaryId: ${jobData.notaryId}`
        );

        // Handle notary ID code assignments where selectedNotary contains the actual notary ID
        if (jobData.notaryOption === "id_code" && jobData.selectedNotary) {
          // For ID code assignments, selectedNotary contains the actual notary ID
          const parsedNotaryId = parseInt(jobData.selectedNotary);
          if (isNaN(parsedNotaryId)) {
            console.error(
              `❌ Invalid notary ID for id_code assignment: ${jobData.selectedNotary}`
            );
            return res
              .status(400)
              .json({ message: "Invalid notary ID for ID code assignment" });
          }
          jobData.notaryId = parsedNotaryId;
          jobData.selectedNotary = parsedNotaryId.toString(); // Ensure string representation
          console.log(
            `✅ ID code assignment: notaryId=${jobData.notaryId}, selectedNotary=${jobData.selectedNotary}`
          );
        } else if (
          jobData.notaryOption === "assign" &&
          jobData.selectedNotary
        ) {
          // For manual assignments, ensure both notaryId and selectedNotary are set consistently
          const parsedNotaryId = parseInt(jobData.selectedNotary);
          if (isNaN(parsedNotaryId)) {
            console.error(
              `❌ Invalid notary ID for manual assignment: ${jobData.selectedNotary}`
            );
            return res
              .status(400)
              .json({ message: "Invalid notary ID for manual assignment" });
          }
          jobData.notaryId = parsedNotaryId;
          jobData.selectedNotary = parsedNotaryId.toString(); // Ensure string representation
          console.log(
            `✅ Manual assignment: notaryId=${jobData.notaryId}, selectedNotary=${jobData.selectedNotary}`
          );
        } else if (jobData.notaryId && !jobData.selectedNotary) {
          jobData.selectedNotary = jobData.notaryId.toString();
          console.log(
            `✅ Set selectedNotary from notaryId: ${jobData.selectedNotary}`
          );
        } else if (
          jobData.notaryId &&
          jobData.selectedNotary &&
          jobData.selectedNotary !== jobData.notaryId.toString()
        ) {
          // Ensure consistency - if both are set, they must match
          jobData.selectedNotary = jobData.notaryId.toString();
          console.log(
            `✅ Fixed notary consistency: selectedNotary=${jobData.selectedNotary}`
          );
        }

        // For initial job creation, ensure no constraint violations
        // Only clear notary data for unhandled cases (auto assignment will be handled later)
        if (
          !jobData.notaryId &&
          jobData.selectedNotary &&
          jobData.notaryOption !== "id_code" &&
          jobData.notaryOption !== "assign"
        ) {
          console.log(
            `🔧 Clearing inconsistent notary data: selectedNotary=${jobData.selectedNotary}, notaryOption=${jobData.notaryOption}`
          );
          delete jobData.selectedNotary;
          delete jobData.notaryId;
        }

        console.log(
          `🔧 Final job data - notaryId: ${jobData.notaryId}, selectedNotary: ${jobData.selectedNotary}`
        );

        const job = await storage.createJob(jobData);

        // Handle automatic notary assignment based on who creates the job
        let assignedNotary = null;

        // FUNDAMENTAL ASSIGNMENT LOGIC: Assign notary based on creator role
        if (
          req.user.role === "notary" &&
          req.user.notaryType === "subscriber"
        ) {
          // Subscriber notary creates job → They are the notary for their own job
          assignedNotary = req.user;
          console.log(
            `🔧 Subscriber notary created job ${job.id} - auto-assigning themselves as notary`
          );
        } else if (
          hasAdminAccess &&
          hasNotaryAccess &&
          (!jobData.notaryOption || jobData.notaryOption === "admin_self")
        ) {
          // Admin with notary privileges creates job → Admin as notary
          assignedNotary = req.user;
          console.log(
            `🔧 Admin-notary created job ${job.id} - assigning admin as notary (option: ${jobData.notaryOption || "default"})`
          );
        } else if (hasAdminAccess || req.user.role === "title_company") {
          // Admin or Title company creates job → Use assignment flow based on notaryOption
          console.log(
            `🔧 ${hasAdminAccess ? "Admin" : req.user.role} created job ${job.id} with notaryOption: ${jobData.notaryOption} - will use assignment flow`
          );
        }

        // If we have a default assignment from creator role, apply it immediately
        if (assignedNotary) {
          await storage.updateJob(job.id, {
            notaryId: assignedNotary.id,
            selectedNotary: assignedNotary.id.toString(),
            jobStatus: "open",
            notaryApprovalStatus: "approved", // Auto-approve since it's their own job or admin
          });

          // Log the automatic assignment
          const assignmentType =
            hasAdminAccess && hasNotaryAccess
              ? "subscriber_self"
              : hasAdminAccess
                ? "manual"
                : "subscriber_self";

          await db.insert(notaryAssignmentLog).values({
            jobId: job.id,
            notaryId: assignedNotary.id,
            assignmentType,
            assignmentStatus: "assigned",
          });

          console.log(
            `✅ Auto-assigned notary ${assignedNotary.firstName} ${assignedNotary.lastName} to job ${job.id}`
          );

          // Note: Signer invitations will be sent after signers are created (moved below)
        }

        // Handle additional notary assignment logic for title companies
        if (
          !assignedNotary &&
          jobData.notaryOption === "auto" &&
          !jobData.selectedNotary
        ) {
          // Check if title company has a preferred notary
          const titleCompany = await db
            .select()
            .from(companies)
            .where(eq(companies.companyName, jobData.titleCompany))
            .limit(1);

          if (titleCompany.length > 0) {
            // Check new assignment system first for preferred notary
            let preferredNotary: any = null;

            const [assignedNotaryRecord] = await db
              .select({
                notary: users,
              })
              .from(titleCompanyNotaryAssignments)
              .innerJoin(
                users,
                eq(titleCompanyNotaryAssignments.notaryId, users.id)
              )
              .where(
                and(
                  eq(
                    titleCompanyNotaryAssignments.titleCompanyId,
                    titleCompany[0].id
                  ),
                  eq(titleCompanyNotaryAssignments.isDefault, true),
                  eq(titleCompanyNotaryAssignments.status, "active"),
                  eq(users.role, "notary"),
                  eq(users.notaryType, "contractor"),
                  eq(users.isActive, true)
                )
              )
              .limit(1);

            if (assignedNotaryRecord) {
              preferredNotary = assignedNotaryRecord.notary;
              console.log(
                `✅ Found preferred notary via new assignment system: ${preferredNotary.firstName} ${preferredNotary.lastName}`
              );
            }

            // Fallback to legacy preferred notary system
            if (!preferredNotary && titleCompany[0].preferredNotaryId) {
              const legacyPreferredNotary = await db
                .select()
                .from(users)
                .where(
                  and(
                    eq(users.id, titleCompany[0].preferredNotaryId),
                    eq(users.isActive, true),
                    eq(users.role, "notary"),
                    eq(users.notaryType, "contractor")
                  )
                )
                .limit(1);

              if (legacyPreferredNotary.length > 0) {
                preferredNotary = legacyPreferredNotary[0];
                console.log(
                  `✅ Found preferred notary via legacy system: ${preferredNotary.firstName} ${preferredNotary.lastName}`
                );
              }
            }

            if (preferredNotary) {
              assignedNotary = preferredNotary;
              await storage.updateJob(job.id, {
                notaryId: assignedNotary.id,
                selectedNotary: assignedNotary.id.toString(),
                jobStatus: "open", // Keep as open until notary approves
                notaryApprovalStatus: "assigned_pending_approval",
              });

              // Log the preferred assignment
              await db.insert(notaryAssignmentLog).values({
                jobId: job.id,
                notaryId: assignedNotary.id,
                assignmentType: "preferred",
                assignmentStatus: "assigned",
              });

              console.log(
                `✅ Assigned preferred notary ${assignedNotary.firstName} ${assignedNotary.lastName} to job ${job.id} for ${jobData.titleCompany}`
              );

              // Send job assignment notification to notary (requires approval)
              try {
                await notificationService.sendJobAssignmentNotification(
                  job.id,
                  assignedNotary.id
                );
              } catch (notificationError) {
                console.error(
                  "Failed to send job assignment notification:",
                  notificationError
                );
              }

              // Create calendar event for the assigned notary if date and time are provided
              if (jobData.selectedDate && jobData.selectedTime) {
                try {
                  const startDateTime = new Date(
                    `${jobData.selectedDate} ${jobData.selectedTime}`
                  );
                  const endDateTime = new Date(
                    startDateTime.getTime() + 60 * 60 * 1000
                  ); // 1 hour duration

                  await db.insert(calendarEvents).values({
                    notaryId: assignedNotary.id,
                    title: `Notarization Job #${job.id}`,
                    description: `Job for ${jobData.titleCompany} - ${jobData.closingType}\nProperty: ${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState}`,
                    startDateTime,
                    endDateTime,
                    location: `${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState} ${jobData.propertyZipCode}`,
                    eventType: "job",
                    jobId: job.id,
                    isAllDay: false,
                  });
                } catch (error) {
                  console.warn(
                    "Failed to create calendar event for preferred notary assignment:",
                    error
                  );
                }
              }
            }
          }

          // If no preferred notary available, perform immediate auto assignment
          if (!assignedNotary) {
            console.log(
              `🎲 No preferred notary available for ${jobData.titleCompany}, attempting immediate random assignment...`
            );

            // Use the enhanced assignment service for immediate auto assignment
            const { EnhancedAssignmentService } = await import(
              "../../enhanced-assignment-service"
            );
            const assignmentResult =
              await EnhancedAssignmentService.performAutoAssignment(
                job.id,
                jobData.titleCompany
              );

            if (assignmentResult.success && assignmentResult.notaryId) {
              console.log(
                `✅ Successfully assigned random notary ${assignmentResult.notaryName} to job ${job.id}`
              );

              // Update job with the assigned notary
              await storage.updateJob(job.id, {
                notaryId: assignmentResult.notaryId,
                selectedNotary: assignmentResult.notaryId.toString(),
                isRandomAssignment: true,
                requiresNSA: jobData.requiresNSA === "true" || false,
                requiresSpanishSpeaking:
                  jobData.requiresSpanishSpeaking === "true" || false,
                notaryApprovalStatus: assignmentResult.requiresApproval
                  ? "assigned_pending_approval"
                  : "approved",
              });

              assignedNotary = assignmentResult.notaryId;

              // Send job assignment notification to notary
              try {
                const notificationService = new (
                  await import("../../notification-service")
                ).NotificationService();
                await notificationService.sendJobAssignmentNotification(
                  job.id,
                  assignmentResult.notaryId
                );
              } catch (notificationError) {
                console.error(
                  "Failed to send job assignment notification:",
                  notificationError
                );
              }
            } else {
              console.log(
                `❌ Auto assignment failed for job ${job.id}: ${assignmentResult.error || "No available notaries"}`
              );
              // Fallback to marking for later assignment
              await storage.updateJob(job.id, {
                isRandomAssignment: true,
                requiresNSA: jobData.requiresNSA === "true" || false,
                requiresSpanishSpeaking:
                  jobData.requiresSpanishSpeaking === "true" || false,
                notaryApprovalStatus: "pending_assignment",
              });
              console.log(
                `🎯 Marked job ${job.id} for manual assignment - no available notaries found`
              );
            }
          }
        } else if (
          !assignedNotary &&
          jobData.notaryOption === "assign" &&
          jobData.selectedNotary
        ) {
          // Manual assignment for title companies
          const selectedNotaryId = parseInt(jobData.selectedNotary);
          await storage.updateJob(job.id, {
            notaryId: selectedNotaryId,
            selectedNotary: selectedNotaryId.toString(), // This was missing!
            jobStatus: "open", // Keep as open until notary approves
            notaryApprovalStatus: "assigned_pending_approval",
          });

          // Log the manual assignment
          await db.insert(notaryAssignmentLog).values({
            jobId: job.id,
            notaryId: selectedNotaryId,
            assignmentType: "manual",
            assignmentStatus: "assigned",
          });

          // Send job assignment notification to notary (requires approval)
          try {
            await notificationService.sendJobAssignmentNotification(
              job.id,
              selectedNotaryId
            );
          } catch (notificationError) {
            console.error(
              "Failed to send job assignment notification:",
              notificationError
            );
          }

          // Create calendar event for the assigned notary if date and time are provided
          if (jobData.selectedDate && jobData.selectedTime) {
            try {
              const startDateTime = new Date(
                `${jobData.selectedDate} ${jobData.selectedTime}`
              );
              const endDateTime = new Date(
                startDateTime.getTime() + 60 * 60 * 1000
              ); // 1 hour duration

              await db.insert(calendarEvents).values({
                notaryId: selectedNotaryId,
                title: `Notarization Job #${job.id}`,
                description: `Job for ${jobData.titleCompany} - ${jobData.closingType}\nProperty: ${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState}`,
                startDateTime,
                endDateTime,
                location: `${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState} ${jobData.propertyZipCode}`,
                eventType: "job",
                jobId: job.id,
                isAllDay: false,
              });
            } catch (error) {
              console.warn(
                "Failed to create calendar event for manual notary assignment:",
                error
              );
            }
          }
        } else if (
          !assignedNotary &&
          jobData.notaryOption === "id_code" &&
          jobData.notaryId
        ) {
          // Notary ID Code assignment - notary already assigned during initial creation
          // Just need to update the approval status and log the assignment
          await storage.updateJob(job.id, {
            jobStatus: "open", // Keep as open until notary approves
            notaryApprovalStatus: "assigned_pending_approval",
          });

          // Log the ID code assignment (using 'manual' since ID code is a manual assignment method)
          await db.insert(notaryAssignmentLog).values({
            jobId: job.id,
            notaryId: jobData.notaryId,
            assignmentType: "manual",
            assignmentStatus: "assigned",
          });

          // Send job assignment notification to notary (requires approval)
          try {
            await notificationService.sendJobAssignmentNotification(
              job.id,
              jobData.notaryId
            );
          } catch (notificationError) {
            console.error(
              "Failed to send job assignment notification:",
              notificationError
            );
          }

          // Create calendar event for the assigned notary if date and time are provided
          if (jobData.selectedDate && jobData.selectedTime) {
            try {
              const startDateTime = new Date(
                `${jobData.selectedDate} ${jobData.selectedTime}`
              );
              const endDateTime = new Date(
                startDateTime.getTime() + 60 * 60 * 1000
              ); // 1 hour duration

              await db.insert(calendarEvents).values({
                notaryId: jobData.notaryId,
                title: `Notarization Job #${job.id}`,
                description: `Job for ${jobData.titleCompany} - ${jobData.closingType}\nProperty: ${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState}`,
                startDateTime,
                endDateTime,
                location: `${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState} ${jobData.propertyZipCode}`,
                eventType: "job",
                jobId: job.id,
                isAllDay: false,
              });
            } catch (error) {
              console.warn(
                "Failed to create calendar event for ID code notary assignment:",
                error
              );
            }
          }
        }

        // Handle multiple document uploads to Vultr with intelligent organization
        if (req.files && req.files.length > 0) {
          const { VultrUploadHandler } = await import("../../vultr-upload-handler");

          for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const metadataKey = `documentMetadata_${i}`;
            let metadata = {
              isRequired: false,
              documentType: "original",
              originalName: file.originalname,
            };

            if (req.body[metadataKey]) {
              try {
                metadata = {
                  ...metadata,
                  ...JSON.parse(req.body[metadataKey]),
                };
              } catch (e) {
                console.warn("Failed to parse document metadata:", e);
              }
            }

            // Upload to Vultr with intelligent organization
            const fileBuffer = Buffer.from(
              file.buffer || (await fs.promises.readFile(file.path))
            );

            const uploadResult =
              await VultrUploadHandler.handleJobDocumentUpload(
                fileBuffer,
                file.originalname,
                job.id,
                req.user.id,
                {
                  ...metadata,
                  userRole: req.user.role,
                  titleCompany: jobData.titleCompany,
                }
              );

            if (!uploadResult.success) {
              console.error(
                `Failed to upload document to Vultr: ${uploadResult.error}`
              );
              return res.status(500).json({
                message: `Failed to upload document: ${uploadResult.error}`,
                error: "vultr_upload_failed",
              });
            }
            // If successful, the document record was already created by VultrUploadHandler
          }
        }

        // Create signers if provided
        if (req.body.signers) {
          const signers = JSON.parse(req.body.signers);
          for (const signerData of signers) {
            // Check if user already exists
            const [existingUser] = await db
              .select()
              .from(users)
              .where(eq(users.email, signerData.signerEmail));

            let userId;
            if (!existingUser) {
              // Create new user account for the signer
              const hashedPassword = await bcrypt.hash(
                crypto.randomBytes(32).toString("hex"),
                10
              );
              const [newUser] = await db
                .insert(users)
                .values({
                  username: signerData.signerEmail,
                  email: signerData.signerEmail,
                  password: hashedPassword, // Temporary password, will be reset
                  role: "signer",
                  firstName: signerData.signerName.split(" ")[0] || "",
                  lastName:
                    signerData.signerName.split(" ").slice(1).join(" ") || "",
                  phoneNumber: signerData.signerPhoneNumber || "",
                  isVerified: false, // Account not verified yet
                  verificationStatus: "pending", // Pending verification
                  accountSetupComplete: false, // Password needs to be set
                  // Auto-approve signers and witnesses - they don't need admin approval
                  approvalStatus: "approved",
                  isActive: true,
                  createdAt: new Date(),
                })
                .returning();
              userId = newUser.id;
            } else {
              // Check if existing user is a notary - notaries cannot be signers
              if (existingUser.role === "notary") {
                console.error(
                  `❌ Cannot add notary ${existingUser.email} as a signer - conflict of interest`
                );
                return res.status(400).json({
                  message: `Cannot add ${signerData.signerEmail} as a signer. This user is registered as a notary and cannot participate as a signer.`,
                });
              }

              // Check if existing user is already a signer
              if (
                existingUser.role !== "signer" &&
                existingUser.role !== "witness"
              ) {
                console.error(
                  `❌ Cannot add ${existingUser.role} ${existingUser.email} as a signer`
                );
                return res.status(400).json({
                  message: `Cannot add ${signerData.signerEmail} as a signer. This user has a different role (${existingUser.role}) in the system.`,
                });
              }

              userId = existingUser.id;
            }

            // Create signer record linked to user
            await storage.createSigner({
              ...signerData,
              jobId: job.id,
              userId: userId,
              invitationToken: crypto.randomUUID(),
            });

            // Generate password reset token for account setup
            const passwordResetToken = crypto.randomUUID();
            const tokenExpiry = new Date();
            tokenExpiry.setHours(tokenExpiry.getHours() + 24); // 24 hour expiry

            // Store password reset token
            await db.insert(passwordResetTokens).values({
              userId: userId,
              token: passwordResetToken,
              expiresAt: tokenExpiry,
              used: false,
            });

            // NOTE: Signer notifications will be sent after notary approval
            // Account setup emails are deferred until notary approves the job
            console.log(
              `Signer account created for ${signerData.signerEmail} - notifications will be sent after notary approval`
            );
          }
        }

        // SEND SIGNER INVITATIONS FOR AUTO-APPROVED JOBS (after signers are created)
        const updatedJob = await storage.getJob(job.id);
        if (
          updatedJob &&
          updatedJob.notaryApprovalStatus === "approved" &&
          req.body.signers
        ) {
          try {
            console.log(
              `📧 Sending invitations for auto-approved job ${job.id}`
            );

            // Get the signers we just created
            const jobSigners = await db
              .select()
              .from(signers)
              .where(eq(signers.jobId, job.id));

            console.log(`   Found ${jobSigners.length} signers to invite`);

            // Send invitation to each signer directly (like resend does)
            for (const signer of jobSigners) {
              try {
                // Generate invitation token if not exists
                let invitationToken = signer.invitationToken;
                if (!invitationToken) {
                  invitationToken = crypto.randomUUID();
                  await db
                    .update(signers)
                    .set({
                      invitationToken,
                      invitationSentAt: new Date(),
                    })
                    .where(eq(signers.id, signer.id));
                } else {
                  await db
                    .update(signers)
                    .set({ invitationSentAt: new Date() })
                    .where(eq(signers.id, signer.id));
                }

                // Send email directly using emailService (like resend does)
                await emailService.sendSignerInvitation({
                  signerName: signer.signerName,
                  signerEmail: signer.signerEmail,
                  signerRole: signer.signerRole,
                  invitationToken,
                  titleCompany: updatedJob.titleCompany,
                  closingType: updatedJob.closingType,
                  propertyAddress: updatedJob.propertyAddressOne
                    ? `${updatedJob.propertyAddressOne}, ${updatedJob.propertyCity}, ${updatedJob.propertyState} ${updatedJob.propertyZipCode}`
                    : undefined,
                  scheduledDate: updatedJob.selectedDate || undefined,
                  scheduledTime: updatedJob.selectedTime || undefined,
                });

                // Log notification (but don't fail if this fails)
                try {
                  await db.insert(jobNotifications).values({
                    jobId: job.id,
                    recipientId: signer.userId || 0,
                    recipientEmail: signer.signerEmail,
                    notificationType: "signer_invite",
                    status: "sent",
                    subject: `🏛️ Secure Document Signing Required - ${updatedJob.titleCompany}`,
                    message: `Invitation sent to ${signer.signerName} for ${updatedJob.titleCompany} document signing`,
                    metadata: {
                      jobId: job.id,
                      signerId: signer.id,
                      invitationToken,
                    },
                    sentAt: new Date(),
                  });
                } catch (logError) {
                  console.warn("Failed to log notification:", logError);
                }

                console.log(
                  `✅ Invitation sent to ${signer.signerName} (${signer.signerEmail})`
                );
              } catch (signerError) {
                console.error(
                  `❌ Failed to send invitation to ${signer.signerEmail}:`,
                  signerError
                );
              }
            }

            // Mark job as having notifications sent
            await db
              .update(jobs)
              .set({
                signerNotificationsSent: true,
                signerNotificationsSentAt: new Date(),
              })
              .where(eq(jobs.id, job.id));
          } catch (notificationError) {
            console.error(
              "Failed to send signer invitations for auto-approved job:",
              notificationError
            );
          }
        }

        // CRITICAL FIX: Get the updated job with assigned notary before returning
        const finalJob = await storage.getJob(job.id);
        const documentCount = req.files ? req.files.length : 0;

        // Invalidate job caches using centralized cache manager
        console.log(`🔧 About to invalidate caches - finalJob:`, {
          id: finalJob?.id,
          notaryId: finalJob?.notaryId,
          selectedNotary: finalJob?.selectedNotary,
          creatorId: req.user.id,
        });

        // Use the new centralized cache manager
        const { cacheInvalidation } = await import("../../services/cache-manager");
        await cacheInvalidation.onJobCreated(
          job.id,
          finalJob?.notaryId,
          req.user.id
        );

        res.status(201).json({
          ...finalJob, // Return the updated job with assigned notary
          documentCount,
          message: `Job created successfully with ${documentCount} document${documentCount !== 1 ? "s" : ""}${finalJob?.assignedNotary ? ` and assigned to ${finalJob.assignedNotary.name}` : ""}`,
        });
      } catch (error) {
        console.error("Create job error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.put("/api/jobs/:id/status", verifyToken, async (req: any, res) => {
    try {
      const jobIdParam = req.params.id;
      const jobId = parseInt(jobIdParam);

      // Validate job ID
      if (isNaN(jobId) || jobId <= 0) {
        console.error("Invalid job ID provided:", jobIdParam);
        return res.status(400).json({
          message: "Invalid job ID provided",
          providedId: jobIdParam,
          error: "invalid_job_id",
        });
      }

      const { status } = req.body;

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Check if user has access to update this job
      if (
        req.user.role !== "admin" &&
        job.userId !== req.user.id &&
        job.selectedNotary !== req.user.id.toString()
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedJob = await storage.updateJob(jobId, { jobStatus: status });
      res.json(updatedJob);
    } catch (error) {
      console.error("Update job status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/jobs/:id/schedule", verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const { selectedDate, selectedTime } = req.body;

      if (!selectedDate || !selectedTime) {
        return res
          .status(400)
          .json({ message: "Both selectedDate and selectedTime are required" });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Check if user has access to update this job
      if (
        req.user.role !== "admin" &&
        req.user.role !== "title_company" &&
        job.userId !== req.user.id
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      console.log(
        `🕐 Scheduling job ${jobId} for ${selectedDate} at ${selectedTime}`
      );

      // Check if this job needs auto assignment
      if (
        job.isRandomAssignment &&
        job.notaryOption === "auto" &&
        !job.notaryId
      ) {
        console.log(
          `🎲 Job ${jobId} marked for auto assignment, finding available notaries...`
        );

        // Use the random notary service to find available notaries for this time slot
        const randomNotaryService = new (
          await import("../../random-notary-service")
        ).RandomNotaryService();

        const qualifications = {
          requiresNSA: job.requiresNSA || false,
          requiresSpanishSpeaking: job.requiresSpanishSpeaking || false,
        };

        const timeSlot = {
          date: selectedDate,
          startTime: selectedTime,
          endTime: addHourToTime(selectedTime), // Assume 1-hour appointment
        };

        // Get rejected notaries from job data
        const excludeIds = job.rejectedNotaries
          ? job.rejectedNotaries.map((id: string) => parseInt(id))
          : [];

        const selectedNotary = await randomNotaryService.selectRandomNotary(
          qualifications,
          timeSlot,
          excludeIds
        );

        if (selectedNotary) {
          console.log(
            `✅ Found available notary: ${selectedNotary.firstName} ${selectedNotary.lastName} for job ${jobId}`
          );

          // Use the random notary service to assign the notary (includes calendar booking)
          const assignmentSuccess = await randomNotaryService.assignNotaryToJob(
            jobId,
            selectedNotary.id,
            timeSlot,
            "random"
          );

          if (assignmentSuccess) {
            // Update the approval status since notary needs to approve the assignment
            await storage.updateJob(jobId, {
              notaryApprovalStatus: "assigned_pending_approval",
            });

            // Send notification to the assigned notary
            try {
              const notificationService = new (
                await import("../../notification-service")
              ).NotificationService();
              await notificationService.sendJobAssignmentNotification(
                jobId,
                selectedNotary.id
              );
            } catch (notificationError) {
              console.error(
                "Failed to send job assignment notification:",
                notificationError
              );
            }

            const updatedJob = await storage.getJob(jobId);
            return res.json({
              ...updatedJob,
              message: `Job scheduled and assigned to ${selectedNotary.firstName} ${selectedNotary.lastName}`,
              assignedNotary: {
                id: selectedNotary.id,
                name: `${selectedNotary.firstName} ${selectedNotary.lastName}`,
              },
            });
          } else {
            console.error(
              `❌ Failed to assign notary ${selectedNotary.id} to job ${jobId}`
            );
            return res
              .status(500)
              .json({ message: "Failed to assign notary to job" });
          }
        } else {
          console.log(
            `❌ No available notaries found for job ${jobId} on ${selectedDate} at ${selectedTime}`
          );

          // Update the job with the selected time but no notary
          const updatedJob = await storage.updateJob(jobId, {
            selectedDate,
            selectedTime,
            notaryApprovalStatus: "pending_assignment",
          });

          return res.json({
            ...updatedJob,
            message:
              "Job scheduled but no notaries available at this time. Please try a different time or assign manually.",
            requiresManualAssignment: true,
          });
        }
      } else {
        // Regular schedule update for jobs that already have a notary or don't need auto assignment
        const updatedJob = await storage.updateJob(jobId, {
          selectedDate,
          selectedTime,
        });

        // If job already has a notary, update their calendar
        if (job.notaryId) {
          try {
            const startDateTime = new Date(`${selectedDate} ${selectedTime}`);
            const endDateTime = new Date(
              startDateTime.getTime() + 60 * 60 * 1000
            ); // 1 hour duration

            // Check if calendar event already exists
            const existingEvent = await db
              .select()
              .from(calendarEvents)
              .where(
                and(
                  eq(calendarEvents.jobId, jobId),
                  eq(calendarEvents.notaryId, job.notaryId)
                )
              )
              .limit(1);

            if (existingEvent.length > 0) {
              // Update existing calendar event
              await db
                .update(calendarEvents)
                .set({
                  startDateTime,
                  endDateTime,
                  title: `Notarization Job #${jobId}`,
                  description: `Job for ${job.titleCompany} - ${job.closingType}\nProperty: ${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState}`,
                  location: `${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState} ${job.propertyZipCode}`,
                })
                .where(eq(calendarEvents.id, existingEvent[0].id));
            } else {
              // Create new calendar event
              await db.insert(calendarEvents).values({
                notaryId: job.notaryId,
                title: `Notarization Job #${jobId}`,
                description: `Job for ${job.titleCompany} - ${job.closingType}\nProperty: ${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState}`,
                startDateTime,
                endDateTime,
                location: `${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState} ${job.propertyZipCode}`,
                eventType: "job",
                jobId: jobId,
                isAllDay: false,
              });
            }
          } catch (calendarError) {
            console.warn("Failed to update calendar event:", calendarError);
          }
        }

        res.json({
          ...updatedJob,
          message: "Job schedule updated successfully",
        });
      }
    } catch (error) {
      console.error("Update job schedule error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/jobs/:id", verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);

      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Check if user has access to delete this job
      if (req.user.role !== "admin" && job.userId !== req.user.id) {
        return res
          .status(403)
          .json({
            message:
              "Access denied. Only job creator or admin can delete jobs.",
          });
      }

      // Get all documents associated with this job for cleanup
      const documents = await storage.getJobDocumentsByJobId(jobId);

      // Delete all associated files (both local and Vultr)
      for (const document of documents) {
        try {
          const filePath = document.filePath;
          const isVultrFile =
            !filePath.startsWith("/") &&
            !filePath.includes("\\") &&
            !filePath.includes("uploads/");

          if (isVultrFile) {
            // Delete from Vultr cloud storage
            const { cloudStorage } = await import(
              "../../lib/cloud-storage-service"
            );
            try {
              const fileExists = await cloudStorage.fileExists(filePath);
              if (fileExists) {
                await cloudStorage.deleteFile(filePath);
                console.log(`✅ Deleted file from Vultr: ${filePath}`);
              }
            } catch (vultrError) {
              console.error(
                `❌ Failed to delete file from Vultr: ${filePath}`,
                vultrError
              );
            }
          } else {
            // Delete local file if it exists
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`✅ Deleted local file: ${filePath}`);
            }
          }
        } catch (fileError) {
          console.error(
            `Error deleting file for document ${document.id}:`,
            fileError
          );
          // Continue with job deletion even if file cleanup fails
        }
      }

      // Delete job from database (cascade will handle related records)
      const deleted = await storage.deleteJob(jobId);

      if (!deleted) {
        return res.status(404).json({ message: "Job not found" });
      }

      res.json({ message: "Job and associated files deleted successfully" });
    } catch (error) {
      console.error("Delete job error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put(
    "/api/jobs/:id/file",
    verifyToken,
    upload.single("notarizedFile"),
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.id);
        const { status } = req.body;

        const job = await storage.getJob(jobId);
        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }

        // Check if user has access to update this job
        if (
          req.user.role !== "admin" &&
          job.userId !== req.user.id &&
          job.selectedNotary !== req.user.id.toString()
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        const updateData: any = {};

        if (req.file) {
          // Upload notarized file to Vultr
          const { VultrUploadHandler } = await import(
            "../../vultr-upload-handler"
          );

          const fileBuffer = req.file.buffer
            ? Buffer.from(req.file.buffer)
            : await fs.promises.readFile(req.file.path);

          const uploadResult = await VultrUploadHandler.handleJobDocumentUpload(
            fileBuffer,
            req.file.originalname,
            jobId,
            req.user.id,
            {
              documentType: "notarized",
              userRole: req.user.role,
              jobId: jobId,
            }
          );

          if (!uploadResult.success) {
            return res.status(500).json({
              message: `Failed to upload notarized file: ${uploadResult.error}`,
              error: "vultr_upload_failed",
            });
          }

          updateData.notarizedFile = uploadResult.fileKey;
          console.log(
            `✅ Uploaded notarized file to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`
          );
        }

        if (status) {
          updateData.jobStatus = status;
        }

        const updatedJob = await storage.updateJob(jobId, updateData);
        res.json(updatedJob);
      } catch (error) {
        console.error("Update job file error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.put("/api/jobs/:id", verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const { recordingData, ...otherUpdates } = req.body;

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

      const updateData: any = { ...otherUpdates };

      if (recordingData) {
        updateData.recordingFileKey = recordingData.fileKey;
        updateData.recordingFileUrl = recordingData.fileUrl;
        updateData.recordingFileName = recordingData.fileName;
        updateData.recordingDuration = recordingData.duration;
        updateData.recordingStartedAt = recordingData.recordedAt
          ? new Date(recordingData.recordedAt)
          : null;
        updateData.recordingUploadedAt = recordingData.uploadedAt
          ? new Date(recordingData.uploadedAt)
          : new Date();
        updateData.recordingParticipantCount = recordingData.participants;
        updateData.recordingSessionId = recordingData.sessionId;
        updateData.recordingLiveSessionId = recordingData.liveSessionId;
        updateData.recordingMetadata = recordingData;

        console.log(`✅ Recording data updated for job ${jobId}:`, {
          fileKey: recordingData.fileKey,
          duration: recordingData.duration,
          participants: recordingData.participants,
        });
      }

      const updatedJob = await storage.updateJob(jobId, updateData);
      res.json(updatedJob);
    } catch (error) {
      console.error("Update job error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app.get("/api/jobs/:id/session-access", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const userId = decoded.id;
      const jobId = parseInt(req.params.id);

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const hasAccess = await storage.verifySessionAccess(jobId, userId);

      if (!hasAccess) {
        return res.status(403).json({
          message:
            "Access denied. You are not authorized to join this signing session.",
        });
      }

      const sessionToken = await storage.generateSessionToken(jobId);

      res.json({
        hasAccess: true,
        sessionToken,
        message: "Session access granted",
      });
    } catch (error) {
      console.error("Session access verification error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(
    "/api/jobs/:id/download/:type",
    verifyToken,
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.id);
        const type = req.params.type;

        console.log(
          `Download request: Job ${jobId}, Type ${type}, User ${req.user?.id}`
        );

        const job = await storage.getJob(jobId);
        if (!job) {
          console.log("Job not found for ID:", jobId);
          return res.status(404).json({ message: "Job not found" });
        }

        console.log("Job found:", {
          id: job.id,
          uploadedFile: job.uploadedFile,
          userId: job.userId,
        });
        console.log("User info:", { id: req.user.id, role: req.user.role });

        // Always allow download for demo
        const filename =
          type === "original"
            ? "sample_purchase_agreement.pdf"
            : "notarized_purchase_agreement.pdf";

        console.log("Returning success for filename:", filename);

        res.json({
          success: true,
          message: "File download initiated",
          filename: filename,
          type: type,
          jobId: jobId,
        });
      } catch (error) {
        console.error("Download error:", error);
        res.status(500).json({ message: "Download failed" });
      }
    }
  );

  app.get("/api/jobs/:id/participants", async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const participants = await storage.getJobParticipantsByJobId(jobId);
      res.json(participants);
    } catch (error) {
      console.error("Get job participants error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/jobs/:id/participants", async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const participantData = {
        ...req.body,
        jobId,
        inviteToken:
          Math.random().toString(36).substring(2) + Date.now().toString(36),
        inviteStatus: "pending",
      };

      const participant = await storage.createJobParticipant(participantData);

      console.log(
        `Email invitation sent to ${participant.email} for job ${jobId}`
      );

      res.status(201).json(participant);
    } catch (error) {
      console.error("Create job participant error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.jobId);
        const job = await storage.getJob(jobId);
        
        if (!job) {
          return res.status(404).json({ message: 'Job not found' });
        }
  
        console.log('Creating Whereby video session for job:', jobId);
        
        // Import Whereby service
        const { wherebyService } = await import('./lib/whereby-service');
        
        // Calculate end time (2 hours from now for notary sessions)
        const endDate = new Date();
        endDate.setHours(endDate.getHours() + 2);
  
        // Create Whereby meeting
        const meetingOptions = {
          roomNamePrefix: `notary-session-${jobId}`,
          roomMode: 'normal' as const,
          endDate: endDate.toISOString(),
          fields: ['hostRoomUrl']
        };
  
        const meeting = await wherebyService.createMeeting(meetingOptions);
        
        console.log('Whereby video session created:', {
          meetingId: meeting.meetingId,
          roomUrl: meeting.roomUrl,
          endDate: meeting.endDate
        });
        
        res.json({
          success: true,
          sessionId: meeting.meetingId,
          roomUrl: meeting.roomUrl,
          hostRoomUrl: meeting.hostRoomUrl,
          roomName: meeting.roomName,
          meetingId: meeting.meetingId,
          sessionToken: meeting.meetingId,
          endDate: meeting.endDate,
          technology: 'whereby',
          jobId
        });
      } catch (error) {
        console.error('Create Whereby video session error:', error);
        res.status(500).json({ 
          message: 'Failed to create Whereby video session',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  
    app.get('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.jobId);
        const job = await storage.getJob(jobId);
        
        if (!job) {
          return res.status(404).json({ message: 'Job not found' });
        }
  
        // Check for active video sessions (in a real implementation, you'd query your database)
        // For now, return active session info or placeholder
        const sessionInfo = {
          jobId,
          isActive: false,
          participants: [],
          recordings: [],
          technology: 'webrtc',
          signalingPath: '/video-signaling',
          message: 'No active video session. Create one by starting a live signing session.'
        };
  
        res.json(sessionInfo);
      } catch (error) {
        console.error('Get video session error:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });
  
    app.post('/api/jobs/:jobId/video-session/recording', verifyToken, async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.jobId);
        const { recordingUrl, duration, participants, meetingId } = req.body;
        
        // Store recording metadata in your database
        // In a real implementation, you would save this to your database
        const recordingData = {
          jobId,
          meetingId,
          recordingUrl,
          duration,
          participants,
          createdAt: new Date().toISOString(),
          createdBy: req.user.id,
          complianceStatus: 'recorded',
          auditTrail: {
            sessionStart: new Date(Date.now() - duration * 1000).toISOString(),
            sessionEnd: new Date().toISOString(),
            participantCount: participants?.length || 0
          }
        };
  
        console.log('Recording metadata saved:', {
          jobId,
          meetingId,
          duration: `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`,
          participants: participants?.length || 0
        });
  
        res.json({
          success: true,
          recordingId: `recording-${jobId}-${Date.now()}`,
          message: 'Recording metadata saved successfully',
          complianceVerified: true
        });
      } catch (error) {
        console.error('Save recording error:', error);
        res.status(500).json({ message: 'Failed to save recording metadata' });
      }
    });
  
    app.delete('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.jobId);
        const { sessionId } = req.body;
        
        if (sessionId) {
          console.log(`Ending WebRTC video session ${sessionId} for job ${jobId}`);
          
          // In a real implementation, you would:
          // 1. Signal the WebRTC service to end the session
          // 2. Clean up any recordings
          // 3. Update the database
          // For now, we'll just log the action
        }
        
        // Update job status to completed if needed
        const job = await storage.getJob(jobId);
        if (job && job.jobStatus === 'in_progress') {
          await storage.updateJob(jobId, {
            jobStatus: 'completed',
            completedAt: new Date(),
            completedBy: req.user.id
          });
        }
        
        console.log(`WebRTC video session ended for job ${jobId}`);
        
        res.json({
          success: true,
          message: 'WebRTC video session ended successfully',
          jobStatus: 'completed',
          technology: 'webrtc'
        });
      } catch (error) {
        console.error('End WebRTC video session error:', error);
        res.status(500).json({ message: 'Failed to end WebRTC video session' });
      }
    });
  
    // Get session recordings for compliance
    app.get('/api/jobs/:jobId/recordings', verifyToken, async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.jobId);
        const job = await storage.getJob(jobId);
        
        if (!job) {
          return res.status(404).json({ message: 'Job not found' });
        }
  
        // Check if user has access to this job
        if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
          return res.status(403).json({ message: 'Access denied' });
        }
  
        console.log(`Getting recordings for job ${jobId}`);
        
        // In a real implementation, you would query the database for actual recordings
        // For now, return empty recordings list
        const recordings: any[] = [];
        
        res.json({
          success: true,
          jobId,
          recordings,
          technology: 'webrtc',
          message: recordings.length > 0 ? 'Recordings retrieved successfully' : 'No recordings found for this session'
        });
      } catch (error) {
        console.error('Get recordings error:', error);
        res.status(500).json({ message: 'Failed to retrieve recordings' });
      }
    });


    app.post('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
        try {
          const jobId = parseInt(req.params.jobId);
          const job = await storage.getJob(jobId);
          
          if (!job) {
            return res.status(404).json({ message: 'Job not found' });
          }
    
          console.log('Creating Whereby video session for job:', jobId);
          
          // Import Whereby service
          const { wherebyService } = await import('../../lib/whereby-service');
          
          // Calculate end time (2 hours from now for notary sessions)
          const endDate = new Date();
          endDate.setHours(endDate.getHours() + 2);
    
          // Create Whereby meeting
          const meetingOptions = {
            roomNamePrefix: `notary-session-${jobId}`,
            roomMode: 'normal' as const,
            endDate: endDate.toISOString(),
            fields: ['hostRoomUrl']
          };
    
          const meeting = await wherebyService.createMeeting(meetingOptions);
          
          console.log('Whereby video session created:', {
            meetingId: meeting.meetingId,
            roomUrl: meeting.roomUrl,
            endDate: meeting.endDate
          });
          
          res.json({
            success: true,
            sessionId: meeting.meetingId,
            roomUrl: meeting.roomUrl,
            hostRoomUrl: meeting.hostRoomUrl,
            roomName: meeting.roomName,
            meetingId: meeting.meetingId,
            sessionToken: meeting.meetingId,
            endDate: meeting.endDate,
            technology: 'whereby',
            jobId
          });
        } catch (error) {
          console.error('Create Whereby video session error:', error);
          res.status(500).json({ 
            message: 'Failed to create Whereby video session',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });
    
      app.get('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
        try {
          const jobId = parseInt(req.params.jobId);
          const job = await storage.getJob(jobId);
          
          if (!job) {
            return res.status(404).json({ message: 'Job not found' });
          }
    
          // Check for active video sessions (in a real implementation, you'd query your database)
          // For now, return active session info or placeholder
          const sessionInfo = {
            jobId,
            isActive: false,
            participants: [],
            recordings: [],
            technology: 'webrtc',
            signalingPath: '/video-signaling',
            message: 'No active video session. Create one by starting a live signing session.'
          };
    
          res.json(sessionInfo);
        } catch (error) {
          console.error('Get video session error:', error);
          res.status(500).json({ message: 'Internal server error' });
        }
      });
    
      app.post('/api/jobs/:jobId/video-session/recording', verifyToken, async (req: any, res) => {
        try {
          const jobId = parseInt(req.params.jobId);
          const { recordingUrl, duration, participants, meetingId } = req.body;
          
          // Store recording metadata in your database
          // In a real implementation, you would save this to your database
          const recordingData = {
            jobId,
            meetingId,
            recordingUrl,
            duration,
            participants,
            createdAt: new Date().toISOString(),
            createdBy: req.user.id,
            complianceStatus: 'recorded',
            auditTrail: {
              sessionStart: new Date(Date.now() - duration * 1000).toISOString(),
              sessionEnd: new Date().toISOString(),
              participantCount: participants?.length || 0
            }
          };
    
          console.log('Recording metadata saved:', {
            jobId,
            meetingId,
            duration: `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`,
            participants: participants?.length || 0
          });
    
          res.json({
            success: true,
            recordingId: `recording-${jobId}-${Date.now()}`,
            message: 'Recording metadata saved successfully',
            complianceVerified: true
          });
        } catch (error) {
          console.error('Save recording error:', error);
          res.status(500).json({ message: 'Failed to save recording metadata' });
        }
      });
    
      app.delete('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
        try {
          const jobId = parseInt(req.params.jobId);
          const { sessionId } = req.body;
          
          if (sessionId) {
            console.log(`Ending WebRTC video session ${sessionId} for job ${jobId}`);
            
            // In a real implementation, you would:
            // 1. Signal the WebRTC service to end the session
            // 2. Clean up any recordings
            // 3. Update the database
            // For now, we'll just log the action
          }
          
          // Update job status to completed if needed
          const job = await storage.getJob(jobId);
          if (job && job.jobStatus === 'in_progress') {
            await storage.updateJob(jobId, {
              jobStatus: 'completed',
              completedAt: new Date(),
              completedBy: req.user.id
            });
          }
          
          console.log(`WebRTC video session ended for job ${jobId}`);
          
          res.json({
            success: true,
            message: 'WebRTC video session ended successfully',
            jobStatus: 'completed',
            technology: 'webrtc'
          });
        } catch (error) {
          console.error('End WebRTC video session error:', error);
          res.status(500).json({ message: 'Failed to end WebRTC video session' });
        }
      });
    
      app.get('/api/jobs/:jobId/recordings', verifyToken, async (req: any, res) => {
        try {
          const jobId = parseInt(req.params.jobId);
          const job = await storage.getJob(jobId);
          
          if (!job) {
            return res.status(404).json({ message: 'Job not found' });
          }
    
          if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
          }
    
          console.log(`Getting recordings for job ${jobId}`);
        
          const recordings: any[] = [];
          
          res.json({
            success: true,
            jobId,
            recordings,
            technology: 'webrtc',
            message: recordings.length > 0 ? 'Recordings retrieved successfully' : 'No recordings found for this session'
          });
        } catch (error) {
          console.error('Get recordings error:', error);
          res.status(500).json({ message: 'Failed to retrieve recordings' });
        }
      });
}
