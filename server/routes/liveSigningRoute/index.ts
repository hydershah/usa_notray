import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";
import { db } from "../../db";
import { verifyToken, type AuthUser } from "../../auth";
import { cacheJobData } from "../../middleware/cache-middleware";

interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { eq, desc } from "drizzle-orm";

import { users, jobs, editorSessions } from "@shared/schema";

export async function liveSigningRoutes(app: Express): Promise<Server> {
  app.post(
    "/api/session/:sessionId/start-signing",
    verifyToken,
    async (req: any, res) => {
      try {
        const { sessionId } = req.params;
        const notaryUserId = req.user.id;

        const { LiveSigningSessionService } = await import(
          "../../services/session/LiveSigningSessionService"
        );

        const result = await LiveSigningSessionService.startLiveSigningSession(
          sessionId,
          notaryUserId
        );

        res.json({
          success: true,
          data: {
            ...result,
            // Return the actual session ID that should be used for navigation
            actualSessionId: result.sessionId || sessionId,
          },
          message: "Live signing session started successfully",
        });
      } catch (error) {
        console.error("Start signing session error:", error);
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to start signing session",
          error: "start_signing_failed",
        });
      }
    }
  );

  // Get session state and participants - OPTIMIZED VERSION
  app.get(
    "/api/session/:sessionId/state",
    verifyToken,
    cacheJobData(30),
    async (req: any, res) => {
      const startTime = Date.now();

      try {
        const { sessionId } = req.params;

        console.log(
          `📡 Session state request for: ${sessionId} by user ${req.user.id}`
        );

        const { LiveSigningSessionService } = await import(
          "../../services/session/LiveSigningSessionService"
        );

        const sessionState =
          await LiveSigningSessionService.getSessionState(sessionId);

        const duration = Date.now() - startTime;

        if (duration > 1000) {
          console.log(`🐌 SLOW REQUEST: {
  method: 'GET',
  url: '/api/session/${sessionId}/state',
  duration: '${duration}ms',
  statusCode: 200,
  requestId: 'req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}',
      userId: ${req.user.id}
  }`);
        }

        res.json({
          success: true,
          data: sessionState,
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error("Get session state error:", error, `(${duration}ms)`);
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to get session state",
          error: "get_session_state_failed",
        });
      }
    }
  );

  // Set active user (for user switching via keyboard shortcuts)
  app.post(
    "/api/session/:sessionId/set-active-user",
    verifyToken,
    async (req: any, res) => {
      try {
        const { sessionId } = req.params;
        const { userId } = req.body;

        if (!userId) {
          return res.status(400).json({ message: "userId is required" });
        }

        const { LiveSigningSessionService } = await import(
          "../../services/session/LiveSigningSessionService"
        );

        await LiveSigningSessionService.setActiveUser(sessionId, userId);

        res.json({
          success: true,
          message: "Active user set successfully",
        });
      } catch (error) {
        console.error("Set active user error:", error);
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to set active user",
          error: "set_active_user_failed",
        });
      }
    }
  );

  // Sync all users to notary view
  app.post(
    "/api/session/:sessionId/sync-users",
    verifyToken,
    async (req: any, res) => {
      try {
        const { sessionId } = req.params;
        const { pageNumber, documentId } = req.body;
        const userId = req.user.id;

        // Verify user is notary
        const [user] = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user || user.role !== "notary") {
          return res.status(403).json({
            message: "Only notaries can sync users",
            error: "insufficient_permissions",
          });
        }

        // Import WebSocket service and trigger sync
        const { WebSocketService } = await import(
          "../../services/editor/WebSocketService"
        );

        // Broadcast sync command to all session participants
        const syncMessage = {
          type: "sync_to_notary",
          payload: {
            sessionId,
            pageNumber: pageNumber || 1,
            documentId: documentId || null,
            syncedBy: userId,
            notaryName: user.role, // You might want to get the actual user name
            timestamp: Date.now(),
          },
          userId: userId.toString(),
          sessionId,
          timestamp: Date.now(),
        };

        // Send sync message to all participants in the session
        WebSocketService.broadcastToSession(sessionId, syncMessage);

        res.json({
          success: true,
          message: `All users synced to page ${pageNumber || 1}`,
          pageNumber: pageNumber || 1,
          documentId: documentId || null,
        });
      } catch (error) {
        console.error("Sync users error:", error);
        res.status(500).json({
          message:
            error instanceof Error ? error.message : "Failed to sync users",
          error: "sync_users_failed",
        });
      }
    }
  );

  // Pause session
  app.post(
    "/api/session/:sessionId/pause",
    verifyToken,
    async (req: any, res) => {
      try {
        const { sessionId } = req.params;
        const { reason } = req.body;
        const userId = req.user.id;

        const { LiveSigningSessionService } = await import(
          "../../services/session/LiveSigningSessionService"
        );

        const result = await LiveSigningSessionService.pauseSession(
          sessionId,
          userId,
          reason
        );

        res.json({
          success: true,
          data: result,
          message: "Session paused successfully",
        });
      } catch (error) {
        console.error("Pause session error:", error);
        res.status(500).json({
          message:
            error instanceof Error ? error.message : "Failed to pause session",
          error: "pause_session_failed",
        });
      }
    }
  );

  // Resume session
  app.post(
    "/api/session/:sessionId/resume",
    verifyToken,
    async (req: any, res) => {
      try {
        const { sessionId } = req.params;
        const userId = req.user.id;

        const { LiveSigningSessionService } = await import(
          "../../services/session/LiveSigningSessionService"
        );

        const result = await LiveSigningSessionService.resumeSession(
          sessionId,
          userId
        );

        res.json({
          success: true,
          data: result,
          message: "Session resumed successfully",
        });
      } catch (error) {
        console.error("Resume session error:", error);
        res.status(500).json({
          message:
            error instanceof Error ? error.message : "Failed to resume session",
          error: "resume_session_failed",
        });
      }
    }
  );

  // Check if user can interact with session
  app.get(
    "/api/session/:sessionId/can-interact/:userId",
    verifyToken,
    async (req: any, res) => {
      try {
        const { sessionId, userId } = req.params;

        const { LiveSigningSessionService } = await import(
          "../../services/session/LiveSigningSessionService"
        );

        const canInteract = await LiveSigningSessionService.canUserInteract(
          sessionId,
          parseInt(userId)
        );

        res.json({
          success: true,
          data: { canInteract },
        });
      } catch (error) {
        console.error("Check interaction permission error:", error);
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to check permissions",
          error: "check_interaction_failed",
        });
      }
    }
  );

  // Complete live signing session
  app.post(
    "/api/session/:sessionId/complete",
    verifyToken,
    async (req: any, res) => {
      try {
        const { sessionId } = req.params;
        const { force = false } = req.body;
        console.log(
          `📝 Completing session: ${sessionId} by user ${req.user.id}`
        );

        // Get session using editor session service
        const { SessionService } = await import(
          "../../services/editor/SessionService"
        );
        const { LiveSigningSessionService } = await import(
          "../../services/session/LiveSigningSessionService"
        );

        let session;
        let actualSessionId = sessionId;

        try {
          // First try to get session directly
          session = await SessionService.getSession(sessionId);

          if (session) {
            actualSessionId = session.id;
            console.log(`✅ Found session by sessionId: ${actualSessionId}`);
          }
        } catch (error) {
          console.log(
            `🔍 Session not found by sessionId, checking if it's a jobId...`
          );
        }

        // If session not found by sessionId, try to find by jobId (backward compatibility)
        if (!session) {
          const jobId = parseInt(sessionId);

          if (!isNaN(jobId)) {
            // Look for the most recent active session for this job
            const sessions = await db
              .select()
              .from(editorSessions)
              .where(eq(editorSessions.jobId, jobId))
              .orderBy(desc(editorSessions.createdAt))
              .limit(1);

            if (sessions.length > 0) {
              const sessionData = sessions[0];
              session = {
                id: sessionData.sessionId,
                jobId: sessionData.jobId,
                sessionType: sessionData.sessionType,
                status: sessionData.status,
                notaryId: sessionData.notaryId,
                videoSessionId: sessionData.videoSessionId,
                createdAt: sessionData.createdAt,
                startedAt: sessionData.startedAt,
                completedAt: sessionData.completedAt,
              };
              actualSessionId = sessionData.sessionId;
              console.log(`✅ Found session by jobId: ${actualSessionId}`);
            }
          }
        }

        if (!session) {
          return res.status(404).json({
            message: "Session not found",
            error: "session_not_found",
          });
        }

        // Check if session is already completed
        if (session.status === "completed") {
          return res.status(200).json({
            success: true,
            message: "Session was already completed",
            sessionId: actualSessionId,
            alreadyCompleted: true,
          });
        }

        // Verify user permissions
        const isAdmin =
          req.user.role === "admin" ||
          (req.user.privileges && req.user.privileges.includes("admin"));
        const isAssignedNotary = session.notaryId === req.user.id;

        if (!isAssignedNotary && !isAdmin) {
          return res.status(403).json({
            message:
              "Only the assigned notary or admin can complete the session",
            error: "insufficient_permissions",
          });
        }

        // For live signing sessions, handle completion
        if (
          session.sessionType === "notary" ||
          session.sessionType === "tagging"
        ) {
          try {
            // Get all tags for validation
            const { TagService } = await import(
              "../../services/editor/TagService"
            );
            const tags = await TagService.getSessionTags(actualSessionId);

            console.log(
              `📊 Session completion validation - Total tags: ${tags.length}`
            );

            // Tags will only be marked as completed when users manually click and fill them
            // No auto-completion needed - tags are just markers for the tagging session

            console.log(`📊 Validation results:`);
            console.log(`  - Total tags: ${tags.length}`);
            console.log(
              `  - Completed tags: ${tags.filter((t) => t.isCompleted).length}`
            );

            // For tagging sessions: Allow completion regardless of tag completion status
            // For live signing sessions: Only allow completion if users have filled their assigned tags
            if (session.sessionType === "notary") {
              // Live signing session - check if tags have real content from users
              const incompleteTags = tags.filter((tag) => !tag.isCompleted);

              if (incompleteTags.length > 0 && !force) {
                console.log(
                  `❌ Live signing session completion blocked - users haven't filled all tags:`,
                  incompleteTags.map((t) => ({
                    id: t.id,
                    type: t.tagType,
                    assignedUser: t.assignedUserId,
                    hasContent: !!(t.content && t.content.trim()),
                  }))
                );

                return res.status(400).json({
                  success: false,
                  message: `Cannot complete session: ${incompleteTags.length} tags haven't been filled by users`,
                  error: "incomplete_user_tags",
                  canForce: true,
                  incompleteTags: incompleteTags.map((t) => ({
                    id: t.id,
                    type: t.tagType,
                    assignedUser: t.assignedUserId,
                    note: "User needs to click this tag to fill it with real content",
                  })),
                });
              }
            }

            // For tagging sessions, no validation needed - tags are just markers

            // Generate final PDF with real user content (only for live signing sessions)
            if (
              session.sessionType === "notary" &&
              tags.length > 0 &&
              tags.some((t) => t.isCompleted)
            ) {
              try {
                const { PDFProcessorService } = await import(
                  "../../services/pdf-processor.service"
                );
                const pdfProcessor = PDFProcessorService.getInstance();

                // Process the document and apply real content
                const processedDoc =
                  await pdfProcessor.processCompletedDocument(actualSessionId);

                if (processedDoc && processedDoc.buffer) {
                  // Upload signed PDF to Vultr cloud storage
                  try {
                    const { VultrUploadHandler } = await import(
                      "../../vultr-upload-handler"
                    );

                    const signedFileName = `job_${session.jobId}_signed_${Date.now()}.pdf`;

                    // Upload to Vultr with proper organization
                    const uploadResult =
                      await VultrUploadHandler.handleJobDocumentUpload(
                        processedDoc.buffer,
                        signedFileName,
                        session.jobId,
                        req.user.id,
                        {
                          documentType: "signed_document",
                          isRequired: false,
                          sessionId: actualSessionId,
                          signedAt: new Date().toISOString(),
                          processedTags: tags.length,
                          completedTags: tags.filter((t) => t.isCompleted)
                            .length,
                        }
                      );

                    if (uploadResult.success) {
                      console.log(
                        `✅ Generated final document with real user content: ${signedFileName} (${processedDoc.fileSize} bytes)`
                      );
                      console.log(`📁 Vultr location: ${uploadResult.fileKey}`);
                      console.log(
                        `📊 Applied ${tags.filter((t) => t.isCompleted).length} user-filled tags to document`
                      );

                      // Also save to local uploads directory as backup
                      const fs = await import("fs/promises");
                      const path = await import("path");
                      const uploadsDir = path.resolve("uploads/signed");

                      try {
                        await fs.mkdir(uploadsDir, { recursive: true });
                        const localPath = path.join(uploadsDir, signedFileName);
                        await fs.writeFile(localPath, processedDoc.buffer);
                        console.log(`📁 Local backup saved: ${signedFileName}`);
                      } catch (localError) {
                        console.warn(
                          "Failed to save local backup:",
                          localError
                        );
                        // Don't fail on local backup error
                      }
                    } else {
                      throw new Error(
                        `Failed to upload signed PDF: ${uploadResult.error}`
                      );
                    }
                  } catch (uploadError) {
                    console.error(
                      "❌ Failed to upload signed PDF to Vultr:",
                      uploadError
                    );

                    // Fallback: Save to local uploads directory only
                    const fs = await import("fs/promises");
                    const path = await import("path");
                    const uploadsDir = path.resolve("uploads/signed");

                    await fs.mkdir(uploadsDir, { recursive: true });
                    const signedFileName = `job_${session.jobId}_signed_${Date.now()}.pdf`;
                    const signedFilePath = path.join(
                      uploadsDir,
                      signedFileName
                    );
                    await fs.writeFile(signedFilePath, processedDoc.buffer);

                    console.log(
                      `📁 Fallback: Saved signed PDF locally: ${signedFileName}`
                    );
                  }

                  // Update job status to indicate signed documents are available
                  await db
                    .update(jobs)
                    .set({
                      jobStatus: "completed",
                      completedAt: new Date(),
                    })
                    .where(eq(jobs.id, session.jobId));
                }
              } catch (pdfError) {
                console.error(
                  "❌ Failed to generate final signed PDF:",
                  pdfError
                );
                // Don't fail the completion, just log the error
                console.warn(
                  "Session marked as completed but PDF generation failed"
                );
              }
            }

            // Complete the live signing session
            await LiveSigningSessionService.completeSession(
              actualSessionId,
              req.user.id
            );
          } catch (error) {
            console.error("Error during live signing completion:", error);
            // Don't fail completely, still mark session as completed
          }
        }

        // Mark session as completed
        await SessionService.updateSessionStatus(actualSessionId, "completed", {
          completedAt: new Date(),
        });

        // 🆕 GENERATE JOB COMPLETION REPORT
        if (session.jobId) {
          try {
            console.log(
              `📊 Generating completion report for job ${session.jobId}`
            );

            const { JobCompletionReportService } = await import(
              "../../services/job-completion-report-service"
            );
            const reportResult =
              await JobCompletionReportService.generateJobCompletionReport(
                session.jobId
              );

            if (reportResult.success) {
              console.log(
                `✅ Job completion report generated: ${reportResult.reportPath}`
              );
            } else {
              console.error(
                `❌ Failed to generate completion report: ${reportResult.error}`
              );
            }
          } catch (reportError) {
            console.error("Error generating completion report:", reportError);
            // Don't fail the session completion if report generation fails
          }
        }

        console.log(
          `✅ Session completed: ${actualSessionId} by user ${req.user.id}`
        );

        res.json({
          success: true,
          message: "Session completed successfully",
          sessionId: actualSessionId,
          completedAt: new Date(),
        });
      } catch (error) {
        console.error("Complete session error:", error);
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to complete session",
          error: "complete_session_failed",
        });
      }
    }
  );
}
