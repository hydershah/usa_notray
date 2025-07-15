import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";
import { db } from "../../db";
import { notificationService } from "../../notification-service";
import {
  verifyToken,
  hasAdminPrivileges,
  hasNotaryPrivileges,
  type AuthUser,
} from "../../auth";
import { cacheUserData, cacheJobData } from "../../middleware/cache-middleware";
import jwt from "jsonwebtoken";

interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";

import {
  calendarEvents,
  users,
  jobs,
  signers,
  notaryAssignmentLog,
  companies,
  titleCompanyNotaryAssignments,
  passwordResetTokens,
  jobNotifications,
  jobDocuments,
  documentVersions,
} from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

function addHourToTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const newHours = (hours + 1) % 24;
  return `${newHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

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

import { emailService } from "../../lib/email-service";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function jobManagementRoutes(app: Express): Promise<Server> {
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

      const invitedJobs = await db
        .select({
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

        delete jobData.uploadedFile;
        delete jobData.notarizedFile;

        console.log(
          `🔧 Job creation - notaryOption: ${jobData.notaryOption}, selectedNotary: ${jobData.selectedNotary}, notaryId: ${jobData.notaryId}`
        );
        if (jobData.notaryOption === "id_code" && jobData.selectedNotary) {
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
          jobData.selectedNotary = jobData.notaryId.toString();
          console.log(
            `✅ Fixed notary consistency: selectedNotary=${jobData.selectedNotary}`
          );
        }
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
        let assignedNotary = null;
        if (
          req.user.role === "notary" &&
          req.user.notaryType === "subscriber"
        ) {
          assignedNotary = req.user;
          console.log(
            `🔧 Subscriber notary created job ${job.id} - auto-assigning themselves as notary`
          );
        } else if (
          hasAdminAccess &&
          hasNotaryAccess &&
          (!jobData.notaryOption || jobData.notaryOption === "admin_self")
        ) {
          assignedNotary = req.user;
          console.log(
            `🔧 Admin-notary created job ${job.id} - assigning admin as notary (option: ${jobData.notaryOption || "default"})`
          );
        } else if (hasAdminAccess || req.user.role === "title_company") {
          console.log(
            `🔧 ${hasAdminAccess ? "Admin" : req.user.role} created job ${job.id} with notaryOption: ${jobData.notaryOption} - will use assignment flow`
          );
        }
        if (assignedNotary) {
          await storage.updateJob(job.id, {
            notaryId: assignedNotary.id,
            selectedNotary: assignedNotary.id.toString(),
            jobStatus: "open",
            notaryApprovalStatus: "approved",
          });
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
        }
        if (
          !assignedNotary &&
          jobData.notaryOption === "auto" &&
          !jobData.selectedNotary
        ) {
          const titleCompany = await db
            .select()
            .from(companies)
            .where(eq(companies.companyName, jobData.titleCompany))
            .limit(1);

          if (titleCompany.length > 0) {
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

              await db.insert(notaryAssignmentLog).values({
                jobId: job.id,
                notaryId: assignedNotary.id,
                assignmentType: "preferred",
                assignmentStatus: "assigned",
              });

              console.log(
                `✅ Assigned preferred notary ${assignedNotary.firstName} ${assignedNotary.lastName} to job ${job.id} for ${jobData.titleCompany}`
              );
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
          if (!assignedNotary) {
            console.log(
              `🎲 No preferred notary available for ${jobData.titleCompany}, attempting immediate random assignment...`
            );

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
          const selectedNotaryId = parseInt(jobData.selectedNotary);
          await storage.updateJob(job.id, {
            notaryId: selectedNotaryId,
            selectedNotary: selectedNotaryId.toString(),
            jobStatus: "open",
            notaryApprovalStatus: "assigned_pending_approval",
          });

          await db.insert(notaryAssignmentLog).values({
            jobId: job.id,
            notaryId: selectedNotaryId,
            assignmentType: "manual",
            assignmentStatus: "assigned",
          });

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

          if (jobData.selectedDate && jobData.selectedTime) {
            try {
              const startDateTime = new Date(
                `${jobData.selectedDate} ${jobData.selectedTime}`
              );
              const endDateTime = new Date(
                startDateTime.getTime() + 60 * 60 * 1000
              );

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
          await storage.updateJob(job.id, {
            jobStatus: "open",
            notaryApprovalStatus: "assigned_pending_approval",
          });
          await db.insert(notaryAssignmentLog).values({
            jobId: job.id,
            notaryId: jobData.notaryId,
            assignmentType: "manual",
            assignmentStatus: "assigned",
          });

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

        if (req.files && req.files.length > 0) {
          const { VultrUploadHandler } = await import(
            "../../vultr-upload-handler"
          );

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
          }
        }
        if (req.body.signers) {
          const signers = JSON.parse(req.body.signers);
          for (const signerData of signers) {
            const [existingUser] = await db
              .select()
              .from(users)
              .where(eq(users.email, signerData.signerEmail));

            let userId;
            if (!existingUser) {
              const hashedPassword = await bcrypt.hash(
                crypto.randomBytes(32).toString("hex"),
                10
              );
              const [newUser] = await db
                .insert(users)
                .values({
                  username: signerData.signerEmail,
                  email: signerData.signerEmail,
                  password: hashedPassword,
                  role: "signer",
                  firstName: signerData.signerName.split(" ")[0] || "",
                  lastName:
                    signerData.signerName.split(" ").slice(1).join(" ") || "",
                  phoneNumber: signerData.signerPhoneNumber || "",
                  isVerified: false, // Account not verified yet
                  verificationStatus: "pending", // Pending verification
                  accountSetupComplete: false, // Password needs to be set
                  approvalStatus: "approved",
                  isActive: true,
                  createdAt: new Date(),
                })
                .returning();
              userId = newUser.id;
            } else {
              if (existingUser.role === "notary") {
                console.error(
                  `❌ Cannot add notary ${existingUser.email} as a signer - conflict of interest`
                );
                return res.status(400).json({
                  message: `Cannot add ${signerData.signerEmail} as a signer. This user is registered as a notary and cannot participate as a signer.`,
                });
              }
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

            await storage.createSigner({
              ...signerData,
              jobId: job.id,
              userId: userId,
              invitationToken: crypto.randomUUID(),
            });

            const passwordResetToken = crypto.randomUUID();
            const tokenExpiry = new Date();
            tokenExpiry.setHours(tokenExpiry.getHours() + 24); // 24 hour expiry

            await db.insert(passwordResetTokens).values({
              userId: userId,
              token: passwordResetToken,
              expiresAt: tokenExpiry,
              used: false,
            });
            console.log(
              `Signer account created for ${signerData.signerEmail} - notifications will be sent after notary approval`
            );
          }
        }

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

            const jobSigners = await db
              .select()
              .from(signers)
              .where(eq(signers.jobId, job.id));

            console.log(`   Found ${jobSigners.length} signers to invite`);

            for (const signer of jobSigners) {
              try {
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

        const finalJob = await storage.getJob(job.id);
        const documentCount = req.files ? req.files.length : 0;

        console.log(`🔧 About to invalidate caches - finalJob:`, {
          id: finalJob?.id,
          notaryId: finalJob?.notaryId,
          selectedNotary: finalJob?.selectedNotary,
          creatorId: req.user.id,
        });

        const { cacheInvalidation } = await import(
          "../../services/cache-manager"
        );
        await cacheInvalidation.onJobCreated(
          job.id,
          finalJob?.notaryId,
          req.user.id
        );

        res.status(201).json({
          ...finalJob,
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

      if (
        job.isRandomAssignment &&
        job.notaryOption === "auto" &&
        !job.notaryId
      ) {
        console.log(
          `🎲 Job ${jobId} marked for auto assignment, finding available notaries...`
        );

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
          endTime: addHourToTime(selectedTime),
        };

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
          const assignmentSuccess = await randomNotaryService.assignNotaryToJob(
            jobId,
            selectedNotary.id,
            timeSlot,
            "random"
          );

          if (assignmentSuccess) {
            await storage.updateJob(jobId, {
              notaryApprovalStatus: "assigned_pending_approval",
            });

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
        const updatedJob = await storage.updateJob(jobId, {
          selectedDate,
          selectedTime,
        });

        if (job.notaryId) {
          try {
            const startDateTime = new Date(`${selectedDate} ${selectedTime}`);
            const endDateTime = new Date(
              startDateTime.getTime() + 60 * 60 * 1000
            ); // 1 hour duration

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
      if (req.user.role !== "admin" && job.userId !== req.user.id) {
        return res.status(403).json({
          message: "Access denied. Only job creator or admin can delete jobs.",
        });
      }
      const documents = await storage.getJobDocumentsByJobId(jobId);
      for (const document of documents) {
        try {
          const filePath = document.filePath;
          const isVultrFile =
            !filePath.startsWith("/") &&
            !filePath.includes("\\") &&
            !filePath.includes("uploads/");

          if (isVultrFile) {
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
        }
      }

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

        if (
          req.user.role !== "admin" &&
          job.userId !== req.user.id &&
          job.selectedNotary !== req.user.id.toString()
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        const updateData: any = {};

        if (req.file) {
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

  // Whereby video session routes
  app.post(
    "/api/jobs/:jobId/video-session",
    verifyToken,
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.jobId);
        const job = await storage.getJob(jobId);
        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }
        console.log("Creating Whereby video session for job:", jobId);
        const { wherebyService } = await import("../../lib/whereby-service");
        const endDate = new Date();
        endDate.setHours(endDate.getHours() + 2);
        const meetingOptions = {
          roomNamePrefix: `notary-session-${jobId}`,
          roomMode: "normal" as const,
          endDate: endDate.toISOString(),
          fields: ["hostRoomUrl"],
        };

        const meeting = await wherebyService.createMeeting(meetingOptions);
        console.log("Whereby video session created:", {
          meetingId: meeting.meetingId,
          roomUrl: meeting.roomUrl,
          endDate: meeting.endDate,
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
          technology: "whereby",
          jobId,
        });
      } catch (error) {
        console.error("Create Whereby video session error:", error);
        res.status(500).json({
          message: "Failed to create Whereby video session",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  app.get(
    "/api/jobs/:jobId/video-session",
    verifyToken,
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.jobId);
        const job = await storage.getJob(jobId);

        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }
        const sessionInfo = {
          jobId,
          isActive: false,
          participants: [],
          recordings: [],
          technology: "webrtc",
          signalingPath: "/video-signaling",
          message:
            "No active video session. Create one by starting a live signing session.",
        };

        res.json(sessionInfo);
      } catch (error) {
        console.error("Get video session error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.post(
    "/api/jobs/:jobId/video-session/recording",
    verifyToken,
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.jobId);
        const { recordingUrl, duration, participants, meetingId } = req.body;
        const recordingData = {
          jobId,
          meetingId,
          recordingUrl,
          duration,
          participants,
          createdAt: new Date().toISOString(),
          createdBy: req.user.id,
          complianceStatus: "recorded",
          auditTrail: {
            sessionStart: new Date(Date.now() - duration * 1000).toISOString(),
            sessionEnd: new Date().toISOString(),
            participantCount: participants?.length || 0,
          },
        };

        console.log("Recording metadata saved:", {
          jobId,
          meetingId,
          duration: `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}`,
          participants: participants?.length || 0,
        });

        res.json({
          success: true,
          recordingId: `recording-${jobId}-${Date.now()}`,
          message: "Recording metadata saved successfully",
          complianceVerified: true,
        });
      } catch (error) {
        console.error("Save recording error:", error);
        res.status(500).json({ message: "Failed to save recording metadata" });
      }
    }
  );

  app.delete(
    "/api/jobs/:jobId/video-session",
    verifyToken,
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.jobId);
        const { sessionId } = req.body;

        if (sessionId) {
          console.log(
            `Ending WebRTC video session ${sessionId} for job ${jobId}`
          );
        }
        const job = await storage.getJob(jobId);
        if (job && job.jobStatus === "in_progress") {
          await storage.updateJob(jobId, {
            jobStatus: "completed",
            completedAt: new Date(),
            completedBy: req.user.id,
          });
        }

        console.log(`WebRTC video session ended for job ${jobId}`);

        res.json({
          success: true,
          message: "WebRTC video session ended successfully",
          jobStatus: "completed",
          technology: "webrtc",
        });
      } catch (error) {
        console.error("End WebRTC video session error:", error);
        res.status(500).json({ message: "Failed to end WebRTC video session" });
      }
    }
  );

  app.get("/api/jobs/:jobId/recordings", verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
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

      console.log(`Getting recordings for job ${jobId}`);
      const recordings: any[] = [];

      res.json({
        success: true,
        jobId,
        recordings,
        technology: "webrtc",
        message:
          recordings.length > 0
            ? "Recordings retrieved successfully"
            : "No recordings found for this session",
      });
    } catch (error) {
      console.error("Get recordings error:", error);
      res.status(500).json({ message: "Failed to retrieve recordings" });
    }
  });

  app.get("/api/jobs/:id/documents", verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
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

      const documents = await storage.getJobDocumentsByJobId(jobId);
      res.json(documents);
    } catch (error) {
      console.error("Get job documents error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(
    "/api/jobs/:id/document-versions",
    verifyToken,
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.id);
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

        const jobDocumentsList = await db
          .select()
          .from(jobDocuments)
          .where(eq(jobDocuments.jobId, jobId));

        const documentIds = jobDocumentsList.map((doc) => doc.id);
        let versions: any[] = [];

        if (documentIds.length > 0) {
          versions = await db
            .select()
            .from(documentVersions)
            .where(inArray(documentVersions.originalDocumentId, documentIds))
            .orderBy(desc(documentVersions.createdAt));
        }

        const versionsWithUrls = versions.map((version) => ({
          ...version,
          downloadUrl: `/api/documents/signed/${encodeURIComponent(version.fileName)}`,
        }));

        res.json(versionsWithUrls);
      } catch (error) {
        console.error("Get document versions error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.post(
    "/api/jobs/:id/documents",
    verifyToken,
    upload.array("documents", 10),
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.id);
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

        const addedDocuments = [];

        if (req.files && req.files.length > 0) {
          const { VultrUploadHandler } = await import(
            "../../vultr-upload-handler"
          );

          for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const metadataKey = `documentMetadata_${i}`;
            let metadata = {
              isRequired: false,
              documentType: "additional",
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
            try {
              const fileBuffer = Buffer.from(
                file.buffer || (await fs.promises.readFile(file.path))
              );

              const uploadResult =
                await VultrUploadHandler.handleJobDocumentUpload(
                  fileBuffer,
                  file.originalname,
                  jobId,
                  req.user.id,
                  {
                    ...metadata,
                    userRole: req.user.role,
                    jobId: jobId,
                  }
                );

              if (uploadResult.success) {
                const documents = await storage.getJobDocumentsByJobId(jobId);
                const latestDocument = documents[documents.length - 1]; // Get the most recently added
                addedDocuments.push(latestDocument);

                console.log(
                  `✅ Document uploaded to Vultr: ${file.originalname} → ${uploadResult.fileKey}`
                );
              } else {
                throw new Error(uploadResult.error || "Upload failed");
              }
            } catch (vultrError) {
              console.error(
                `Vultr upload failed for ${file.originalname}:`,
                vultrError
              );
              return res.status(500).json({
                message: `Failed to upload document: ${vultrError instanceof Error ? vultrError.message : "Unknown error"}`,
                error: "vultr_upload_failed",
                fileName: file.originalname,
              });
            }
          }
        }

        try {
          const { redisCache } = await import("../../services/redis-cache");
          await redisCache.delPattern(`job:${jobId}:*`);
          console.log(
            `🧹 Cleared job cache after document upload: job:${jobId}:*`
          );
        } catch (cacheError) {
          console.warn(
            "Failed to clear job cache after document upload:",
            cacheError
          );
        }

        res.status(201).json({
          message: `Added ${addedDocuments.length} document${addedDocuments.length !== 1 ? "s" : ""} to job`,
          documents: addedDocuments,
          vultrOrganized: true, // Indicate that files are organized in Vultr
        });
      } catch (error) {
        console.error("Add job documents error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.delete(
    "/api/jobs/:jobId/documents/:documentId",
    verifyToken,
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.jobId);
        const documentId = parseInt(req.params.documentId);

        const job = await storage.getJob(jobId);
        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }

        const document = await storage.getJobDocument(documentId);
        if (!document || document.jobId !== jobId) {
          return res.status(404).json({ message: "Document not found" });
        }
        if (
          req.user.role !== "admin" &&
          job.userId !== req.user.id &&
          document.uploadedBy !== req.user.id
        ) {
          return res.status(403).json({ message: "Access denied" });
        }
        const filePath = document.filePath;

        try {
          const { cloudStorage } = await import(
            "../../lib/cloud-storage-service"
          );
          const fileExists = await cloudStorage.fileExists(filePath);
          if (fileExists) {
            await cloudStorage.deleteFile(filePath);
            console.log(`✅ Deleted document from Vultr: ${filePath}`);
          }
        } catch (vultrError) {
          console.error(
            `❌ Failed to delete document from Vultr: ${filePath}`,
            vultrError
          );
        }

        const deleted = await storage.deleteJobDocument(documentId);

        if (!deleted) {
          return res.status(404).json({ message: "Document not found" });
        }
        try {
          const { redisCache } = await import("../../services/redis-cache");
          await redisCache.delPattern(`job:${jobId}:*`);
          console.log(
            `🧹 Cleared job cache after document deletion: job:${jobId}:*`
          );
        } catch (cacheError) {
          console.warn(
            "Failed to clear job cache after document deletion:",
            cacheError
          );
        }

        res.json({ message: "Document deleted successfully" });
      } catch (error) {
        console.error("Delete job document error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.put(
    "/api/jobs/:jobId/documents/:documentId",
    verifyToken,
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.jobId);
        const documentId = parseInt(req.params.documentId);

        const job = await storage.getJob(jobId);
        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }

        const document = await storage.getJobDocument(documentId);
        if (!document || document.jobId !== jobId) {
          return res.status(404).json({ message: "Document not found" });
        }

        if (
          req.user.role !== "admin" &&
          job.userId !== req.user.id &&
          job.selectedNotary !== req.user.id.toString()
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        const updatedDocument = await storage.updateJobDocument(
          documentId,
          req.body
        );

        if (!updatedDocument) {
          return res.status(404).json({ message: "Document not found" });
        }

        res.json(updatedDocument);
      } catch (error) {
        console.error("Update job document error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.get(
    "/api/jobs/:jobId/documents/:documentId/download",
    async (req: any, res) => {
      try {
        let token = req.headers.authorization?.split(" ")[1];
        if (!token && req.query.token) {
          token = req.query.token as string;
        }

        if (!token) {
          return res.status(401).json({ message: "No token provided" });
        }

        let user;
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          user = decoded;
        } catch (error) {
          return res.status(401).json({ message: "Invalid token" });
        }

        const jobId = parseInt(req.params.jobId);
        const documentId = parseInt(req.params.documentId);

        const job = await storage.getJob(jobId);
        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }

        const document = await storage.getJobDocument(documentId);
        if (!document || document.jobId !== jobId) {
          return res.status(404).json({ message: "Document not found" });
        }
        if (
          user.role !== "admin" &&
          job.userId !== user.id &&
          job.selectedNotary !== user.id.toString()
        ) {
          return res.status(403).json({ message: "Access denied" });
        }
        const filePath = document.filePath;

        try {
          const { cloudStorage } = await import(
            "../../lib/cloud-storage-service"
          );

          const fileExists = await cloudStorage.fileExists(filePath);
          if (!fileExists) {
            return res
              .status(404)
              .json({ message: "File not found in cloud storage" });
          }
          const signedUrl = await cloudStorage.getSignedUrl(filePath, 3600);
          const isSigned = req.query.signed === "true";
          const timestamp = req.query.timestamp;

          const filename = isSigned
            ? `SIGNED_${timestamp}_${document.originalName}`
            : document.originalName;

          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
          );

          if (isSigned) {
            res.setHeader("X-Document-Status", "signed");
            res.setHeader(
              "X-Signing-Timestamp",
              timestamp || new Date().toISOString()
            );
            console.log(`Serving signed PDF from Vultr: ${filename}`);
          }
          console.log(
            `Redirecting to Vultr download: ${document.originalName}`
          );
          res.redirect(302, signedUrl);
        } catch (vultrError) {
          console.error("Vultr download error:", vultrError);
          return res
            .status(500)
            .json({ message: "Failed to access file in cloud storage" });
        }
      } catch (error) {
        console.error("Download document error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.post(
    "/api/jobs/:jobId/documents/:documentId/sign",
    verifyToken,
    async (req: any, res) => {
      res.setHeader("Content-Type", "application/json");

      try {
        console.log("Sign endpoint called:", {
          jobId: req.params.jobId,
          documentId: req.params.documentId,
          userId: req.user.id,
          bodyKeys: Object.keys(req.body || {}),
        });

        const jobId = parseInt(req.params.jobId);
        const documentId = parseInt(req.params.documentId);

        if (isNaN(jobId) || isNaN(documentId)) {
          console.log("Invalid job or document ID:", { jobId, documentId });
          return res
            .status(400)
            .json({ message: "Invalid job or document ID" });
        }

        const { signatures = [], page = 1, scale = 1.0 } = req.body || {};

        console.log("Sign request details:", {
          jobId,
          documentId,
          signaturesCount: signatures.length,
          page,
          scale,
        });

        const job = await storage.getJob(jobId);
        if (!job) {
          console.log("Job not found:", jobId);
          return res.status(404).json({ message: "Job not found" });
        }

        const document = await storage.getJobDocument(documentId);
        if (!document || document.jobId !== jobId) {
          console.log("Document not found or mismatch:", {
            documentId,
            jobId,
            found: !!document,
          });
          return res.status(404).json({ message: "Document not found" });
        }

        if (
          req.user.role !== "admin" &&
          job.userId !== req.user.id &&
          job.selectedNotary !== req.user.id.toString()
        ) {
          console.log("Access denied for user:", req.user.id);
          return res.status(403).json({ message: "Access denied" });
        }

        try {
          let pdfBytes: Buffer;

          const filePath = document.filePath;

          const { cloudStorage } = await import(
            "../../lib/cloud-storage-service"
          );

          const fileExists = await cloudStorage.fileExists(filePath);
          if (!fileExists) {
            return res
              .status(404)
              .json({ message: "PDF file not found in cloud storage" });
          }

          const signedUrl = await cloudStorage.getSignedUrl(filePath, 300); // 5 minutes for processing
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for PDF processing

          const response = await fetch(signedUrl, {
            signal: controller.signal,
            headers: {
              "User-Agent": "USA-Notary-Service/1.0",
            },
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(
              `Failed to download PDF from Vultr: ${response.status} ${response.statusText}`
            );
          }

          const arrayBuffer = await response.arrayBuffer();
          pdfBytes = Buffer.from(arrayBuffer);
          console.log(
            `Downloaded PDF from Vultr for signing: ${document.originalName}`
          );
          const pdfDoc = await PDFDocument.load(pdfBytes);
          const pages = pdfDoc.getPages();
          const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const signatureFont = await pdfDoc.embedFont(
            StandardFonts.TimesRomanItalic
          );

          for (const sig of signatures) {
            const pageIndex = (sig.page || 1) - 1;
            if (pageIndex < 0 || pageIndex >= pages.length) {
              console.warn(
                `Invalid page number ${sig.page} for signature. Skipping.`
              );
              continue;
            }

            const page = pages[pageIndex];
            const pageDimensions = page.getSize();

            const clientWidth = sig.clientWidth || pageDimensions.width;
            const clientHeight = sig.clientHeight || pageDimensions.height;

            const widthScale = pageDimensions.width / clientWidth;
            const heightScale = pageDimensions.height / clientHeight;

            const x = sig.x * widthScale;
            const y = pageDimensions.height - sig.y * heightScale;
            const signatureWidth = sig.width * widthScale;
            const signatureHeight = sig.height * heightScale;

            const finalY = y - signatureHeight;

            try {
              if (
                sig.type === "signature" ||
                sig.type === "initial" ||
                sig.type === "stamp"
              ) {
                if (sig.signatureImage) {
                  const base64Data = sig.signatureImage.split(",")[1];
                  if (base64Data) {
                    const imageBytes = Buffer.from(base64Data, "base64");

                    let image;
                    try {
                      if (
                        sig.signatureImage.startsWith("data:image/jpeg") ||
                        sig.signatureImage.startsWith("data:image/jpg")
                      ) {
                        image = await pdfDoc.embedJpg(imageBytes);
                      } else {
                        image = await pdfDoc.embedPng(imageBytes);
                      }

                      page.drawImage(image, {
                        x,
                        y: finalY,
                        width: signatureWidth,
                        height: signatureHeight,
                      });
                    } catch (embedError) {
                      console.error("Failed to embed image:", embedError);
                    }
                  }
                }
              } else if (sig.type === "checkbox") {
                // Draw a checkmark manually instead of using a text character
                const checkmarkSize =
                  Math.min(signatureWidth, signatureHeight) * 0.8;
                const xPos = x + signatureWidth / 2;
                const yPos = finalY + signatureHeight / 2;

                const p1 = { x: xPos - checkmarkSize / 2, y: yPos };
                const p2 = {
                  x: xPos - checkmarkSize / 4,
                  y: yPos - checkmarkSize / 2,
                };
                const p3 = {
                  x: xPos + checkmarkSize / 2,
                  y: yPos + checkmarkSize / 2,
                };

                page.drawLine({
                  start: p1,
                  end: p2,
                  thickness: 2,
                  color: rgb(0, 0, 0),
                });
                page.drawLine({
                  start: p2,
                  end: p3,
                  thickness: 2,
                  color: rgb(0, 0, 0),
                });
              } else if (sig.content) {
                page.drawText(sig.content, {
                  x,
                  y: finalY,
                  font: helveticaFont,
                  size: 12, // Or a dynamic size
                  color: rgb(0, 0, 0),
                });
              }
            } catch (err) {
              console.error(
                `Failed to draw signature (ID: ${sig.id}, Type: ${sig.type}):`,
                err
              );
              // Continue to next signature
            }
          }

          const signedPdfBytes = await pdfDoc.save();

          console.log(
            `Successfully generated signed PDF for document ${documentId}`
          );
          const filename = `SIGNED_${Date.now()}_${document.originalName}`;
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
          );
          res.setHeader("Content-Type", "application/pdf");
          res.send(Buffer.from(signedPdfBytes));
        } catch (pdfError) {
          console.error("Error during PDF signing process:", pdfError);
          res.status(500).json({
            success: false,
            message: "Failed to generate signed PDF.",
            error:
              pdfError instanceof Error ? pdfError.message : String(pdfError),
          });
        }
      } catch (error) {
        console.error("Sign document error:", error);

        // Ensure we return JSON even on error
        const errorResponse = {
          success: false,
          message:
            error instanceof Error ? error.message : "Internal server error",
          error: process.env.NODE_ENV === "development" ? error : undefined,
        };

        res.status(500).json(errorResponse);
      }
    }
  );

  app.get(
    "/api/jobs/:jobId/documents/:documentId/preview",
    async (req: any, res) => {
      try {
        let token = req.headers.authorization?.split(" ")[1];
        if (!token && req.query.token) {
          token = req.query.token as string;
        }

        if (!token) {
          return res.status(401).json({ message: "No token provided" });
        }

        let user;
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          user = decoded;
        } catch (error) {
          return res.status(401).json({ message: "Invalid token" });
        }

        const jobId = parseInt(req.params.jobId);
        const documentId = parseInt(req.params.documentId);

        const job = await storage.getJob(jobId);
        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }

        const document = await storage.getJobDocument(documentId);
        if (!document || document.jobId !== jobId) {
          return res.status(404).json({ message: "Document not found" });
        }
        if (
          user.role !== "admin" &&
          job.userId !== user.id &&
          job.selectedNotary !== user.id.toString()
        ) {
          return res.status(403).json({ message: "Access denied" });
        }
        const filePath = document.filePath;
        try {
          const { cloudStorage } = await import(
            "../../lib/cloud-storage-service"
          );
          const fileExists = await cloudStorage.fileExists(filePath);
          if (!fileExists) {
            return res
              .status(404)
              .json({ message: "File not found in cloud storage" });
          }
          const signedUrl = await cloudStorage.getSignedUrl(filePath, 3600);

          res.setHeader("Content-Type", document.mimeType);
          res.setHeader("Cache-Control", "private, max-age=300"); // 5 minute cache

          console.log(`Redirecting to Vultr preview: ${document.originalName}`);
          res.redirect(302, signedUrl);
        } catch (vultrError) {
          console.error("Vultr preview error:", vultrError);
          return res
            .status(500)
            .json({ message: "Failed to access file in cloud storage" });
        }
      } catch (error) {
        console.error("Preview document error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );
}
