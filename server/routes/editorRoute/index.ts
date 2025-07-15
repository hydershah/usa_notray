import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";
import { db } from "../../db";

import { verifyToken, hasAdminPrivileges, type AuthUser } from "../../auth";
import { cacheJobData } from "../../middleware/cache-middleware";

// Define the extended request interface for authentication
interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { eq, desc } from "drizzle-orm";
import {
  jobs,
  editorSessions,
  documentVersions,
  systemActivityLogs,
} from "@shared/schema";

export async function editorRoutes(app: Express): Promise<Server> {
  app.post(
    "/api/editor/job/:jobId/session",
    verifyToken,
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.jobId);
        const { sessionType = "tagging", videoSessionId } = req.body;

        if (!jobId || isNaN(jobId)) {
          return res.status(400).json({ message: "Invalid job ID" });
        }

        const [job] = await db
          .select()
          .from(jobs)
          .where(eq(jobs.id, jobId))
          .limit(1);

        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }
        if (!job.notaryId && !job.selectedNotary) {
          console.log(
            `⚠️ Job ${jobId} has no notary assigned. Attempting auto-assignment...`
          );

          if (
            hasAdminPrivileges(req.user) ||
            (req.user.role === "notary" && req.user.notaryType === "subscriber")
          ) {
            await db
              .update(jobs)
              .set({
                notaryId: req.user.id,
                selectedNotary: req.user.id.toString(),
                notaryApprovalStatus: "approved",
              })
              .where(eq(jobs.id, jobId));

            console.log(
              `✅ Auto-assigned ${req.user.role} as notary for job ${jobId}`
            );
          } else {
            return res.status(400).json({
              message:
                "This job has no notary assigned. Please assign a notary before starting the tagging session.",
              error: "no_notary_assigned",
              suggestion:
                "Contact an administrator to assign a notary to this job.",
            });
          }
        }

        const { SessionService } = await import(
          "../../services/editor/SessionService"
        );

        // Get the updated job data to get the correct notary ID
        const [updatedJob] = await db
          .select()
          .from(jobs)
          .where(eq(jobs.id, jobId))
          .limit(1);

        if (!updatedJob) {
          return res
            .status(404)
            .json({ message: "Job not found after update" });
        }

        // Use notaryId if available, otherwise parse selectedNotary
        let notaryId = updatedJob.notaryId;
        if (!notaryId && updatedJob.selectedNotary) {
          notaryId = parseInt(updatedJob.selectedNotary);
          if (isNaN(notaryId)) {
            return res.status(400).json({
              message:
                "Invalid notary assignment. Please check the job configuration.",
              error: "invalid_notary_id",
            });
          }
        }

        if (!notaryId) {
          return res.status(400).json({
            message:
              "No notary assigned to this job. Please assign a notary before starting the session.",
            error: "no_notary_assigned",
          });
        }

        const session = await SessionService.createSession({
          jobId,
          sessionType,
          notaryId,
          videoSessionId,
        });

        res.json({
          success: true,
          session,
          message: `${sessionType} session created successfully`,
        });
      } catch (error) {
        console.error("Create editor session error:", error);
        res.status(500).json({
          message:
            error instanceof Error ? error.message : "Failed to create session",
          error: "session_creation_failed",
        });
      }
    }
  );

  // Get editor session data
  app.get(
    "/api/editor/session/:sessionId",
    verifyToken,
    cacheJobData(120),
    async (req: any, res) => {
      try {
        const { sessionId } = req.params;

        const { SessionService } = await import(
          "../../services/editor/SessionService"
        );

        const session = await SessionService.getSession(sessionId);
        if (!session) {
          return res.status(404).json({ message: "Session not found" });
        }

        // Get session documents and participants
        const [documents, participants] = await Promise.all([
          SessionService.getSessionDocuments(session.jobId),
          SessionService.getSessionParticipants(session.jobId),
        ]);

        res.json({
          session,
          documents,
          participants,
        });
      } catch (error) {
        console.error("Get editor session error:", error);
        res.status(500).json({
          message:
            error instanceof Error ? error.message : "Failed to get session",
          error: "session_fetch_failed",
        });
      }
    }
  );

  // Update session status
  app.put(
    "/api/editor/session/:sessionId/status",
    verifyToken,
    async (req: any, res) => {
      try {
        const { sessionId } = req.params;
        const { status, startedAt, completedAt } = req.body;

        const { SessionService } = await import(
          "../../services/editor/SessionService"
        );

        await SessionService.updateSessionStatus(sessionId, status, {
          startedAt: startedAt ? new Date(startedAt) : undefined,
          completedAt: completedAt ? new Date(completedAt) : undefined,
        });

        res.json({
          success: true,
          message: `Session status updated to ${status}`,
        });
      } catch (error) {
        console.error("Update session status error:", error);
        res.status(500).json({
          message:
            error instanceof Error ? error.message : "Failed to update session",
          error: "session_update_failed",
        });
      }
    }
  );

  // Get job participants for editor
  app.get(
    "/api/jobs/:jobId/participants",
    verifyToken,
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.jobId);

        const { SessionService } = await import(
          "../../services/editor/SessionService"
        );

        const participants = await SessionService.getSessionParticipants(jobId);

        res.json({
          participants,
          count: participants.length,
        });
      } catch (error) {
        console.error("Get job participants error:", error);
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to get participants",
          error: "participants_fetch_failed",
        });
      }
    }
  );

  // Get existing sessions for a job
  app.get("/api/jobs/:jobId/sessions", verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);

      if (!jobId || isNaN(jobId)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }

      // Query editor_sessions table for this job
      const existingSessions = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.jobId, jobId))
        .orderBy(desc(editorSessions.createdAt));

      // Convert to the expected format with sessionId as id for frontend compatibility
      const formattedSessions = existingSessions.map((session) => ({
        id: session.sessionId, // Use sessionId as the id field for frontend
        dbId: session.id, // Keep database ID for reference
        jobId: session.jobId,
        sessionType: session.sessionType,
        status: session.status,
        notaryId: session.notaryId,
        videoSessionId: session.videoSessionId,
        createdAt: session.createdAt,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        updatedAt: session.updatedAt,
      }));

      res.json({
        sessions: formattedSessions,
        count: formattedSessions.length,
      });
    } catch (error) {
      console.error("Get job sessions error:", error);
      res.status(500).json({
        message:
          error instanceof Error ? error.message : "Failed to get sessions",
        error: "sessions_fetch_failed",
      });
    }
  });

  // Cancel editor session
  app.delete(
    "/api/editor/session/:sessionId",
    verifyToken,
    async (req: any, res) => {
      try {
        const { sessionId } = req.params;

        const { SessionService } = await import(
          "../../services/editor/SessionService"
        );

        await SessionService.cancelSession(sessionId);

        res.json({
          success: true,
          message: "Session cancelled successfully",
        });
      } catch (error) {
        console.error("Cancel session error:", error);
        res.status(500).json({
          message:
            error instanceof Error ? error.message : "Failed to cancel session",
          error: "session_cancel_failed",
        });
      }
    }
  );

  app.post(
    "/api/editor/session/:sessionId/place-tag",
    verifyToken,
    async (req: any, res) => {
      try {
        const { sessionId } = req.params;
        const { documentId, tagType, coordinates, assignedUserId } = req.body;

        console.log("🏷️ Place tag request received:", {
          sessionId,
          documentId,
          tagType,
          coordinates,
          assignedUserId: assignedUserId,
          requestUserId: req.user.id,
          requestUserRole: req.user.role,
          finalAssignedUserId: assignedUserId || req.user.id,
        });

        if (!documentId || !tagType || !coordinates) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        // ✅ SERVER-SIDE AUTHORIZATION: Check if user can place tags
        // Get session info to determine if this is a signing session
        const { SessionService } = await import(
          "../../services/editor/SessionService"
        );
        const session = await SessionService.getSession(sessionId);

        if (!session) {
          return res.status(404).json({ message: "Session not found" });
        }

        if (
          session.sessionType === "notary" ||
          session.sessionType === "tagging"
        ) {
          const userRole = req.user.role;
          const isNotary = userRole === "notary";
          const isAdmin = userRole === "admin";

          if (!isNotary && !isAdmin) {
            console.log(
              `❌ Authorization failed: ${userRole} (${req.user.id}) cannot place tags in signing session`
            );
            return res.status(403).json({
              message:
                "Only notaries and admins can place new tags during signing sessions",
              error: "insufficient_permissions",
            });
          }

          console.log(
            `✅ Authorization passed: ${userRole} (${req.user.id}) can place tags in signing session`
          );
        }

        const { TagService } = await import("../../services/editor/TagService");

        const tag = await TagService.placeTag({
          sessionId,
          documentId,
          tagType,
          coordinates,
          assignedUserId: assignedUserId || req.user.id,
          placedBy: req.user.id,
        });

        res.json({
          success: true,
          tag,
          message: "Tag placed successfully",
        });
      } catch (error) {
        console.error("Place tag error:", error);
        res.status(500).json({
          message:
            error instanceof Error ? error.message : "Failed to place tag",
          error: "tag_place_failed",
        });
      }
    }
  );

  app.get(
    "/api/editor/session/:sessionId/tags",
    verifyToken,
    cacheJobData(10),
    async (req: any, res) => {
      try {
        const { sessionId } = req.params;
        const { documentId } = req.query;

        const { TagService } = await import("../../services/editor/TagService");

        let tags;
        if (documentId) {
          // Get tags for specific document
          tags = await TagService.getDocumentTags(sessionId, documentId);
        } else {
          // Get all tags for session
          tags = await TagService.getSessionTags(sessionId);
        }

        res.json({
          tags,
          count: tags.length,
          documentId: documentId || null,
          timestamp: Date.now(), // Include timestamp to ensure fresh data
        });
      } catch (error) {
        console.error("Get tags error:", error);
        res.status(500).json({
          message:
            error instanceof Error ? error.message : "Failed to get tags",
          error: "tags_fetch_failed",
        });
      }
    }
  );

  // Update a tag
  app.put(
    "/api/editor/session/:sessionId/tag/:tagId",
    verifyToken,
    async (req: any, res) => {
      try {
        const { sessionId, tagId } = req.params;
        const updates = req.body;

        const { TagService } = await import("../../services/editor/TagService");

        const tag = await TagService.updateTag(tagId, {
          ...updates,
          updatedBy: req.user.id,
        });

        res.json({
          success: true,
          tag,
          message: "Tag updated successfully",
        });
      } catch (error) {
        console.error("Update tag error:", error);
        res.status(500).json({
          message:
            error instanceof Error ? error.message : "Failed to update tag",
          error: "tag_update_failed",
        });
      }
    }
  );

  // Delete a tag
  app.delete(
    "/api/editor/session/:sessionId/tag/:tagId",
    verifyToken,
    async (req: any, res) => {
      try {
        const { sessionId, tagId } = req.params;

        // ✅ SERVER-SIDE AUTHORIZATION: Check if user can delete tags
        const { SessionService } = await import(
          "../../services/editor/SessionService"
        );
        const session = await SessionService.getSession(sessionId);

        if (!session) {
          return res.status(404).json({ message: "Session not found" });
        }

        // In signing sessions, only notaries and admins can delete tags
        if (
          session.sessionType === "notary" ||
          session.sessionType === "tagging"
        ) {
          const userRole = req.user.role;
          const isNotary = userRole === "notary";
          const isAdmin = userRole === "admin";

          if (!isNotary && !isAdmin) {
            console.log(
              `❌ Authorization failed: ${userRole} (${req.user.id}) cannot delete tags in signing session`
            );
            return res.status(403).json({
              message:
                "Only notaries and admins can delete tags during signing sessions",
              error: "insufficient_permissions",
            });
          }

          console.log(
            `✅ Authorization passed: ${userRole} (${req.user.id}) can delete tags in signing session`
          );
        }

        const { TagService } = await import("../../services/editor/TagService");

        await TagService.deleteTag(tagId, req.user.id);

        res.json({
          success: true,
          message: "Tag deleted successfully",
        });
      } catch (error) {
        console.error("Delete tag error:", error);
        res.status(500).json({
          message:
            error instanceof Error ? error.message : "Failed to delete tag",
          error: "tag_delete_failed",
        });
      }
    }
  );

  // Remove the replace-all endpoint as tags should only be filled by user interaction

  // Removed duplicate endpoint - keeping the more comprehensive one below

  // Get default content for a tag (auto-fill functionality)
  app.get(
    "/api/editor/session/:sessionId/tag/:tagId/default-content",
    verifyToken,
    async (req: any, res) => {
      try {
        const { sessionId, tagId } = req.params;

        const { TagService } = await import("../../services/editor/TagService");

        const tags = await TagService.getSessionTags(sessionId);
        const tag = tags.find((t) => t.id === tagId);

        if (!tag) {
          return res.status(404).json({ message: "Tag not found" });
        }

        // Get user profile for content generation
        const userId = tag.assignedUserId || req.user.id;
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, parseInt(userId)))
          .limit(1);

        if (!user) {
          return res.status(404).json({ message: "User profile not found" });
        }

        let defaultContent = "";
        let contentType = "text";

        // Generate content based on tag type
        switch (tag.tagType) {
          case "A": // Name
            defaultContent =
              user.fullName ||
              `${user.firstName || ""} ${user.lastName || ""}`.trim();
            break;
          case "S": // Signature
            defaultContent =
              user.signatureImage ||
              user.signatureData ||
              user.signatureTyped ||
              "";
            contentType = "signature";
            break;
          case "I": // Initials
            defaultContent =
              user.initialsImage ||
              user.initialData ||
              user.initialsTyped ||
              (user.firstName && user.lastName
                ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`
                : "");
            contentType =
              user.initialsImage || user.initialData ? "signature" : "text";
            break;
          case "D": // Date
            defaultContent = new Date().toLocaleDateString();
            contentType = "date";
            break;
          case "N": // Commission Number
            defaultContent = user.commissionNumber || "";
            break;
          case "X": // Commission Expiration
            defaultContent = user.commissionExpiration || "";
            contentType = "date";
            break;
          case "O": // Disclosure
            defaultContent = user.disclosure || "";
            break;
          case "T": // Text
            defaultContent = "";
            break;
          default:
            defaultContent = "";
        }

        res.json({
          success: true,
          content: defaultContent,
          contentType,
          hasContent: !!defaultContent,
          tagType: tag.tagType,
        });
      } catch (error) {
        console.error("Get default content error:", error);
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to get default content",
          error: "default_content_failed",
        });
      }
    }
  );

  // Click to fill tag with profile data (auto-fill from user profile)
  app.post(
    "/api/editor/session/:sessionId/tag/:tagId/fill",
    verifyToken,
    async (req: any, res) => {
      try {
        const { sessionId, tagId } = req.params;

        const { TagService } = await import("../../services/editor/TagService");
        const { ProfileAutoFillService } = await import(
          "../../services/ProfileAutoFillService"
        );

        // Get tag details first
        const tags = await TagService.getSessionTags(sessionId);
        const tag = tags.find((t) => t.id === tagId);

        if (!tag) {
          return res.status(404).json({ message: "Tag not found" });
        }

        // 🔒 CRITICAL: Use ProfileAutoFillService with signing session validation
        const userId = parseInt(tag.assignedUserId) || req.user.id;
        const autoFillResult = await ProfileAutoFillService.getTagAutoFillData(
          tag.tagType,
          userId,
          sessionId
        );

        if (!autoFillResult.success) {
          return res.status(400).json({
            message: autoFillResult.message || "Auto-fill failed",
            error: "auto_fill_failed",
            autoFillResult,
          });
        }

        // Update tag with profile content and mark as completed
        const updatedTag = await TagService.updateTag(tagId, {
          content: autoFillResult.content,
          contentType: autoFillResult.contentType,
          contentData: autoFillResult.contentData
            ? JSON.stringify(autoFillResult.contentData)
            : null,
          isCompleted: true,
          completedBy: req.user.id,
          completedAt: new Date(),
          updatedBy: req.user.id,
        });

        res.json({
          success: true,
          tag: updatedTag,
          message: autoFillResult.message || "Tag auto-filled successfully",
          autoFillResult,
          source: "profile_auto_fill",
        });
      } catch (error) {
        console.error("Fill tag error:", error);
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to fill tag with profile data",
          error: "tag_fill_failed",
        });
      }
    }
  );

  // Update tag content (for manual content entry)
  app.put(
    "/api/editor/session/:sessionId/tag/:tagId/content",
    verifyToken,
    async (req: any, res) => {
      try {
        const { sessionId, tagId } = req.params;
        const { content, contentType, completedBy, completedAt } = req.body;

        if (content === undefined || content === null) {
          return res.status(400).json({ message: "Content is required" });
        }

        const { TagService } = await import("../../services/editor/TagService");

        // Get tag details to determine proper content structure
        const tags = await TagService.getSessionTags(sessionId);
        const tag = tags.find((t) => t.id === tagId);

        if (!tag) {
          return res.status(404).json({ message: "Tag not found" });
        }

        // Structure content data based on tag type and content
        let structuredContentData: any;
        let finalContent: string;
        let finalContentType: string;

        if (typeof content === "object" && content !== null) {
          // Already structured content (from frontend)
          structuredContentData = content;
          finalContent = content.value || JSON.stringify(content);
          finalContentType = content.type || contentType || "text";
        } else {
          // Raw content - need to structure based on tag type
          finalContent = content.toString();
          finalContentType = contentType || "text";

          // Detect content type and structure appropriately
          const isImageContent =
            finalContent.startsWith("data:image/") ||
            finalContent.startsWith("http") ||
            finalContent.includes("vultrobjects.com") ||
            finalContent.includes(".png") ||
            finalContent.includes(".jpg") ||
            finalContent.includes(".jpeg") ||
            finalContent.includes(".webp");

          // Structure based on tag type
          switch (tag.tagType) {
            case "S": // Signature
              structuredContentData = {
                type: "signature",
                value: finalContent,
                contentType: isImageContent ? "image" : "text",
                timestamp: new Date().toISOString(),
              };
              finalContentType = isImageContent ? "image" : "text";
              break;

            case "I": // Initials
              structuredContentData = {
                type: "initials",
                value: finalContent,
                contentType: isImageContent ? "image" : "text",
                timestamp: new Date().toISOString(),
              };
              finalContentType = isImageContent ? "image" : "text";
              break;

            case "E": // Notary seal/stamp
              structuredContentData = {
                type: "seal",
                value: finalContent,
                contentType: isImageContent ? "image" : "text",
                timestamp: new Date().toISOString(),
              };
              finalContentType = isImageContent ? "image" : "text";
              break;

            case "D": // Date
              structuredContentData = {
                type: "date",
                value: finalContent,
                timestamp: new Date().toISOString(),
              };
              finalContentType = "date";
              break;

            default: // Text and other types
              structuredContentData = {
                type: "text",
                value: finalContent,
                timestamp: new Date().toISOString(),
              };
              finalContentType = "text";
              break;
          }
        }

        console.log("🏷️ Structuring tag content:", {
          tagId,
          tagType: tag.tagType,
          originalContent:
            typeof content === "string" ? content.substring(0, 100) : content,
          structuredData: {
            type: structuredContentData.type,
            contentType: structuredContentData.contentType,
            hasValue: !!structuredContentData.value,
            valuePreview:
              typeof structuredContentData.value === "string"
                ? structuredContentData.value.substring(0, 100)
                : "non-string",
          },
        });

        // Update tag with properly structured content
        const updatedTag = await TagService.updateTag(tagId, {
          content: finalContent,
          contentType: finalContentType,
          contentData: JSON.stringify(structuredContentData),
          isCompleted: true,
          completedBy: completedBy || req.user.id,
          completedAt: completedAt ? new Date(completedAt) : new Date(),
          updatedBy: req.user.id,
        });

        res.json({
          success: true,
          tag: updatedTag,
          message: "Tag content updated successfully",
          contentStructure: structuredContentData,
        });
      } catch (error) {
        console.error("Update tag content error:", error);
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to update tag content",
          error: "tag_content_update_failed",
        });
      }
    }
  );

  // Validate user profile completeness for tag types
  app.post(
    "/api/editor/validate-profile",
    verifyToken,
    async (req: any, res) => {
      try {
        const { userId, tagTypes } = req.body;

        if (!userId || !tagTypes || !Array.isArray(tagTypes)) {
          return res.status(400).json({
            message: "Missing required fields: userId and tagTypes array",
          });
        }

        // Allow users to check their own profile or admins/notaries to check any profile
        if (
          req.user.id !== parseInt(userId) &&
          !["admin", "notary"].includes(req.user.role)
        ) {
          return res.status(403).json({
            message: "Access denied: You can only validate your own profile",
          });
        }

        const { TagService } = await import("../../services/editor/TagService");

        const validation = await TagService.validateUserProfileForTags(
          parseInt(userId),
          tagTypes
        );

        res.json({
          success: true,
          validation,
          recommendations:
            validation.missingFields.length > 0
              ? {
                  message: "Profile incomplete for optimal tag experience",
                  action:
                    "Please complete missing profile fields before session",
                  priority: validation.missingFields.some((f) =>
                    ["A", "S", "I"].includes(f.tagType)
                  )
                    ? "high"
                    : "medium",
                }
              : {
                  message: "Profile is complete for requested tag types",
                  action: "Ready for tagging session",
                },
        });
      } catch (error) {
        console.error("Profile validation error:", error);
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to validate profile",
          error: "profile_validation_failed",
        });
      }
    }
  );

  // Complete tagging session
  app.post(
    "/api/editor/session/:sessionId/complete",
    verifyToken,
    async (req: any, res) => {
      try {
        const { sessionId } = req.params;
        const { force = false } = req.body; // Allow force completion even with incomplete tags

        const { SessionService } = await import(
          "../../services/editor/SessionService"
        );
        const { TagService } = await import("../../services/editor/TagService");

        // Get session info
        const session = await SessionService.getSession(sessionId);
        if (!session) {
          return res.status(404).json({ message: "Session not found" });
        }

        // Get all tags for validation
        const tags = await TagService.getSessionTags(sessionId);

        if (session.status === "completed") {
          return res.status(200).json({
            message: "Session was already completed",
            sessionId,
            alreadyCompleted: true,
            document: {
              taggedDocumentReady: true,
              tagsPlaced: tags.length,
              message: "Tagged document is ready for live signing session",
            },
          });
        }

        // Check if there are any tags placed
        if (tags.length === 0 && !force) {
          return res.status(400).json({
            message: "Cannot complete session: No tags have been placed",
            error: "no_tags_placed",
            canForce: true,
          });
        }

        // Optional: Check for minimum required tags (can be customized based on business rules)
        const participantCount = (
          await SessionService.getSessionParticipants(session.jobId)
        ).length;
        const minimumTags = Math.max(1, participantCount); // At least one tag per participant

        if (tags.length < minimumTags && !force) {
          return res.status(400).json({
            message: `Recommended minimum of ${minimumTags} tags not met (${tags.length} placed)`,
            error: "insufficient_tags",
            canForce: true,
            placed: tags.length,
            recommended: minimumTags,
          });
        }

        // For tagging sessions: Save tagged document configuration (NOT final PDF yet)
        // For live signing sessions: Generate final PDF with real content applied
        let documentInfo = null;

        if (session.sessionType === "tagging") {
          // Tagging completion: Just save the tag configuration
          console.log(
            `📋 Tagging session completed: ${sessionId} with ${tags.length} tags placed`
          );

          // The "tagged document" is the combination of:
          // 1. Original PDF document (unchanged)
          // 2. Tag metadata in database (already saved via TagService)
          // This will be used later in the live signing session

          documentInfo = {
            taggedDocumentReady: true,
            tagsPlaced: tags.length,
            message:
              "Tagged document configuration saved for live signing session",
            canContinueEditing: true,
            note: "You can start tagging again to continue editing these tags",
          };
        } else if (tags.length > 0 && tags.some((tag) => tag.isCompleted)) {
          // Live signing completion: Generate final PDF with real content
          try {
            console.log(
              `✍️ Generating final PDF for live signing session: ${sessionId}`
            );
            console.log(
              `📊 Tags status: ${tags.filter((t) => t.isCompleted).length}/${tags.length} completed`
            );

            // Check if all required tags are completed
            const incompleteTags = tags.filter(
              (tag) => !tag.isCompleted && tag.isRequired !== false
            );
            if (incompleteTags.length > 0 && !force) {
              return res.status(400).json({
                message: `Cannot complete session: ${incompleteTags.length} required tags are not completed`,
                error: "incomplete_required_tags",
                canForce: true,
                incompleteTags: incompleteTags.map((t) => ({
                  id: t.id,
                  type: t.tagType,
                  assignedUser: t.assignedUserId,
                })),
              });
            }

            const { PDFProcessorService } = await import(
              "../../services/pdf-processor.service"
            );
            const pdfProcessor = PDFProcessorService.getInstance();

            const processedDoc =
              await pdfProcessor.processCompletedDocument(sessionId);

            const fs = await import("fs/promises");
            const path = await import("path");
            const uploadsDir = path.resolve("uploads/signed");

            try {
              await fs.mkdir(uploadsDir, { recursive: true });
            } catch (mkdirError) {
              console.log("Uploads directory already exists or created");
            }

            const signedFileName = `job_${session.jobId}_signed_${Date.now()}.pdf`;
            const signedFilePath = path.join(uploadsDir, signedFileName);

            // Write the signed PDF
            await fs.writeFile(signedFilePath, processedDoc.buffer);

            // Create document version record
            const [documentVersion] = await db
              .insert(documentVersions)
              .values({
                originalDocumentId: session.jobId,
                sessionId: parseInt(sessionId),
                versionNumber: 1,
                fileName: signedFileName,
                filePath: signedFilePath,
                fileSize: processedDoc.fileSize,
                status: "completed",
                digitalCertificateApplied: false,
              })
              .returning();

            // Update job status to indicate signed documents are available
            await db
              .update(jobs)
              .set({
                status: "completed",
                completedAt: new Date(),
                signedDocumentId: documentVersion.id,
              })
              .where(eq(jobs.id, session.jobId));

            documentInfo = {
              documentVersionId: documentVersion.id,
              fileName: signedFileName,
              fileSize: processedDoc.fileSize,
              downloadUrl: `/api/documents/signed/${encodeURIComponent(signedFileName)}`,
              message: "Final signed PDF generated successfully",
            };

            console.log(
              `✅ Generated signed PDF: ${signedFileName} (${processedDoc.fileSize} bytes)`
            );
          } catch (pdfError) {
            console.error("❌ Failed to generate final signed PDF:", pdfError);
            // Don't fail the completion, just log the error
            console.warn(
              "Session marked as completed but PDF generation failed"
            );
          }
        }

        // Mark session as completed
        await SessionService.updateSessionStatus(sessionId, "completed", {
          completedAt: new Date(),
        });

        console.log(
          `✅ Tagging session completed: ${sessionId} by user ${req.user.id}`
        );

        res.json({
          success: true,
          message: "Tagging session completed successfully",
          sessionId,
          completedAt: new Date(),
          document: documentInfo,
          stats: {
            totalTags: tags.length,
            completedTags: tags.filter((tag) => tag.isCompleted).length,
            participantCount,
          },
        });
      } catch (error) {
        console.error("Complete tagging session error:", error);
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to complete session",
          error: "session_completion_failed",
        });
      }
    }
  );

  // Legacy signed document serving - REMOVED
  // All signed documents are now stored in Vultr cloud storage
  // Use document-specific download routes instead

  // Handle preflight OPTIONS requests for document serving
  app.options("/api/documents/:filePath(*)", (req: any, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.status(200).end();
  });

  // Serve documents with Vultr cloud storage and local fallback
  app.get("/api/documents/:filePath(*)", async (req: any, res) => {
    try {
      const filePath = decodeURIComponent(req.params.filePath);
      console.log("📄 Document request for:", filePath);

      // Set response timeout to prevent hanging
      req.setTimeout(30000); // 30 second timeout
      res.setTimeout(30000);

      const { cloudStorage } = await import("../../lib/cloud-storage-service");

      // Check if cloud storage is properly configured
      const bucketStats = await cloudStorage.getBucketStats();
      console.log("☁️ Cloud storage status:", bucketStats);

      if (bucketStats.isAccessible) {
        // Try Vultr cloud storage first
        try {
          console.log("☁️ Attempting Vultr cloud storage for:", filePath);

          // Check if file exists in Vultr with timeout
          const fileExists = await Promise.race([
            cloudStorage.fileExists(filePath),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Timeout checking file existence")),
                10000
              )
            ),
          ]);

          if (!fileExists) {
            console.log(
              "📄 Document not found in Vultr, trying local fallback:",
              filePath
            );
            throw new Error("File not found in cloud storage");
          }

          // Generate signed URL with timeout
          const signedUrl = await Promise.race([
            cloudStorage.getSignedUrl(filePath, 3600),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Timeout generating signed URL")),
                10000
              )
            ),
          ]);

          console.log("🔗 Generated Vultr signed URL for:", filePath);

          // Check if this is a development mock URL
          if (signedUrl.includes("/dev-storage/")) {
            console.log("🔄 Received dev storage URL, falling back to local");
            throw new Error("Development mode - falling back to local storage");
          }

          // Set proper headers for PDF viewing including CORS
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Cache-Control", "private, max-age=300");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
          res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization"
          );
          res.setHeader("X-Served-From", "vultr-cloud");

          // Implement fetch with timeout and retry logic
          const fetchWithTimeout = async (
            url: string,
            timeoutMs: number = 20000,
            retries: number = 1
          ): Promise<Response> => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            try {
              const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                  "User-Agent": "USA-Notary-Service/1.0",
                },
              });
              clearTimeout(timeoutId);
              return response;
            } catch (error: any) {
              clearTimeout(timeoutId);

              if (error.name === "AbortError" && retries > 0) {
                console.warn(
                  `⏰ Vultr fetch timeout, retrying... (${retries} attempts left)`
                );
                await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s before retry
                return fetchWithTimeout(url, timeoutMs, retries - 1);
              }
              throw error;
            }
          };

          // Fetch PDF content with shorter timeout for faster fallback
          const pdfResponse = await fetchWithTimeout(signedUrl, 15000, 1); // 15 second timeout, 1 retry

          if (!pdfResponse.ok) {
            throw new Error(
              `Failed to fetch PDF from Vultr: ${pdfResponse.status} ${pdfResponse.statusText}`
            );
          }

          const pdfBuffer = await pdfResponse.arrayBuffer();
          console.log("✅ Successfully served document from Vultr:", filePath);
          res.send(Buffer.from(pdfBuffer));
          return;
        } catch (vultrError: any) {
          console.warn(
            "⚠️ Vultr failed, attempting local fallback:",
            vultrError.message
          );
          // Don't return error yet, try local fallback
        }
      } else {
        console.log(
          "⚠️ Vultr not accessible, using local fallback for:",
          filePath
        );
      }

      // LOCAL STORAGE FALLBACK - Check if file exists locally
      const path = await import("path");
      const fs = await import("fs/promises");

      // Try different local paths where the file might exist
      const possibleLocalPaths = [
        path.resolve("uploads", filePath),
        path.resolve("uploads", "documents", filePath),
        path.resolve(
          filePath.startsWith("/") ? filePath.substring(1) : filePath
        ),
        path.resolve(filePath),
      ];

      let localFilePath = null;
      let fileStats = null;

      for (const possiblePath of possibleLocalPaths) {
        try {
          fileStats = await fs.stat(possiblePath);
          if (fileStats.isFile()) {
            localFilePath = possiblePath;
            console.log("📁 Found local file at:", localFilePath);
            break;
          }
        } catch (e) {
          // File doesn't exist at this path, continue checking
        }
      }

      if (localFilePath && fileStats) {
        try {
          // Serve local file
          console.log("📁 Serving local file:", localFilePath);

          // Set appropriate headers
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Cache-Control", "private, max-age=300");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
          res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization"
          );
          res.setHeader("X-Served-From", "local-storage");
          res.setHeader("Content-Length", fileStats.size.toString());

          const fileBuffer = await fs.readFile(localFilePath);
          res.send(fileBuffer);
          return;
        } catch (localError: any) {
          console.error("📁 Local file serving failed:", localError);
        }
      }

      // If we get here, both Vultr and local storage failed
      console.error(
        "❌ Document not found in Vultr or local storage:",
        filePath
      );
      res.setHeader("Content-Type", "application/json");
      return res.status(404).json({
        error: "Document not found",
        message: "The requested PDF file does not exist on the server.",
        filePath: filePath,
        timestamp: new Date().toISOString(),
        searchedPaths: possibleLocalPaths,
        vultrStatus: bucketStats.isAccessible ? "accessible" : "not accessible",
      });
    } catch (error) {
      console.error("📄 Document serving error:", error);
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to serve document due to server error.",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // User Notarization & Audit Logs Routes

  // Get user's notarization logs
  app.get("/api/user/notarization-logs", verifyToken, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // For now, return empty array until notary log entries are populated
      const logs: any[] = [];

      // TODO: Uncomment when notary_log_entries table has data
      // const logs = await db
      //   .select({
      //     id: notaryLogEntries.id,
      //     sessionId: notaryLogEntries.sessionId,
      //     notaryId: notaryLogEntries.notaryId,
      //     signerId: notaryLogEntries.signerId,
      //     documentId: notaryLogEntries.documentId,
      //     notarizationType: notaryLogEntries.notarizationType,
      //     pageNumber: notaryLogEntries.pageNumber,
      //     timestamp: notaryLogEntries.timestamp,
      //     createdAt: notaryLogEntries.createdAt,
      //   })
      //   .from(notaryLogEntries)
      //   .where(
      //     or(
      //       eq(notaryLogEntries.notaryId, userId), // User was the notary
      //       eq(notaryLogEntries.signerId, userId)  // User was the signer
      //     )
      //   )
      //   .orderBy(desc(notaryLogEntries.timestamp))
      //   .limit(100);

      res.json(logs);
    } catch (error) {
      console.error("Error fetching user notarization logs:", error);
      res.status(500).json({ error: "Failed to fetch notarization logs" });
    }
  });

  // Get user's audit trail
  app.get("/api/user/audit-trail", verifyToken, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // For now, return empty array until audit trail table has data
      const auditEntries: any[] = [];

      // TODO: Uncomment when audit_trail table has data
      // const auditEntries = await db
      //   .select()
      //   .from(auditTrail)
      //   .where(eq(auditTrail.userId, userId))
      //   .orderBy(desc(auditTrail.timestamp))
      //   .limit(200);

      res.json(auditEntries);
    } catch (error) {
      console.error("Error fetching user audit trail:", error);
      res.status(500).json({ error: "Failed to fetch audit trail" });
    }
  });

  // Get user's system activity logs
  app.get("/api/user/activity-logs", verifyToken, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const activityLogs = await db
        .select()
        .from(systemActivityLogs)
        .where(eq(systemActivityLogs.userId, userId))
        .orderBy(desc(systemActivityLogs.createdAt))
        .limit(100);

      res.json(activityLogs);
    } catch (error) {
      console.error("Error fetching user activity logs:", error);
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  // Get user's notarization sessions
  app.get(
    "/api/user/notarization-sessions",
    verifyToken,
    async (req: any, res) => {
      try {
        const userId = req.user.id;

        // For now, return empty array until editor sessions table has data
        const sessions: any[] = [];

        // TODO: Uncomment when editor_sessions table has data
        // const sessions = await db
        //   .select()
        //   .from(editorSessions)
        //   .where(eq(editorSessions.notaryId, userId))
        //   .orderBy(desc(editorSessions.startedAt))
        //   .limit(50);

        res.json(sessions);
      } catch (error) {
        console.error("Error fetching user notarization sessions:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch notarization sessions" });
      }
    }
  );

  // Download user logs as PDF
  app.get("/api/user/download-logs", verifyToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const type = req.query.type as string;

      // For now, return a simple text response
      // In production, you'd generate a proper PDF using a library like PDFKit
      const timestamp = new Date().toISOString();
      const username = req.user.username || "user";

      let content = `Sharp Note - ${type.toUpperCase()} Logs Report\n`;
      content += `Generated: ${timestamp}\n`;
      content += `User: ${username} (ID: ${userId})\n`;
      content += `\n${"=".repeat(50)}\n\n`;

      switch (type) {
        case "notary":
          content += "NOTARIZATION LOGS\n";
          content +=
            "This report contains all notarization activities for this user.\n";
          break;
        case "audit":
          content += "AUDIT TRAIL\n";
          content +=
            "This report contains all audit trail entries for this user.\n";
          break;
        case "activity":
          content += "SYSTEM ACTIVITY LOGS\n";
          content +=
            "This report contains all system activities for this user.\n";
          break;
        case "sessions":
          content += "NOTARIZATION SESSIONS\n";
          content +=
            "This report contains all notarization sessions for this user.\n";
          break;
        default:
          content += "COMPREHENSIVE LOGS\n";
          content += "This report contains all logs for this user.\n";
      }

      content +=
        "\nNote: This is a simplified export. Full PDF generation with detailed logs will be implemented.\n";

      res.setHeader("Content-Type", "text/plain");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${username}_${type}_logs_${timestamp.split("T")[0]}.txt"`
      );
      res.send(content);
    } catch (error) {
      console.error("Error generating log export:", error);
      res.status(500).json({ error: "Failed to generate log export" });
    }
  });

  // WebRTC diagnostic endpoint
  app.get("/api/webrtc/diagnostics", verifyToken, async (req: any, res) => {
    try {
      const diagnostics = {
        server: {
          nodeVersion: process.version,
          platform: process.platform,
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString(),
        },
        webrtc: {
          signalingServerRunning: true,
          socketIOPath: "/video-signaling/socket.io",
          corsOrigins:
            process.env.NODE_ENV === "production"
              ? [process.env.CLIENT_URL || "https://your-domain.com"]
              : [
                  "http://localhost:3000",
                  "http://localhost:3002",
                  "http://localhost:5173",
                  "http://127.0.0.1:3000",
                  "http://127.0.0.1:3002",
                ],
          iceServers: [
            {
              urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
              ],
            },
          ],
        },
        authentication: {
          jwtSecret: process.env.JWT_SECRET ? "configured" : "missing",
          userId: req.user.id,
          userRole: req.user.role,
        },
      };

      console.log("WebRTC diagnostics requested by user:", req.user.id);

      res.json({
        success: true,
        diagnostics,
      });
    } catch (error) {
      console.error("WebRTC diagnostics error:", error);
      res.status(500).json({
        message: "Failed to get WebRTC diagnostics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Vultr cloud storage diagnostic endpoint
  app.get("/api/diagnostics/storage", verifyToken, async (req: any, res) => {
    try {
      const { cloudStorage } = await import("../../lib/cloud-storage-service");

      // Check required environment variables
      const requiredVars = [
        "VULTR_ACCESS_KEY",
        "VULTR_SECRET_KEY",
        "VULTR_REGION",
        "VULTR_BUCKET_NAME",
        "VULTR_ENDPOINT",
      ];

      const envCheck = requiredVars.reduce(
        (acc, varName) => {
          acc[varName] = process.env[varName] ? "configured" : "missing";
          return acc;
        },
        {} as Record<string, string>
      );

      // Get bucket stats
      const bucketStats = await cloudStorage.getBucketStats();

      // Test a simple operation
      let testResult = { success: false, error: "Not tested" };
      try {
        const testExists = await cloudStorage.fileExists(
          "test-file-that-should-not-exist"
        );
        testResult = { success: true, error: null };
      } catch (error) {
        testResult = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }

      const diagnostics = {
        environment: {
          variables: envCheck,
          allConfigured: !Object.values(envCheck).includes("missing"),
        },
        bucket: bucketStats,
        connectivity: testResult,
        recommendations: [],
      };

      // Add recommendations based on findings
      if (!diagnostics.environment.allConfigured) {
        diagnostics.recommendations.push(
          "Configure missing Vultr environment variables for cloud storage"
        );
      }
      if (!diagnostics.bucket.isAccessible) {
        diagnostics.recommendations.push(
          "Check Vultr credentials and bucket permissions"
        );
      }
      if (!diagnostics.connectivity.success) {
        diagnostics.recommendations.push(
          "Verify network connectivity to Vultr endpoints"
        );
      }

      res.json({
        success: true,
        diagnostics,
        status:
          diagnostics.environment.allConfigured &&
          diagnostics.bucket.isAccessible
            ? "healthy"
            : "degraded",
      });
    } catch (error) {
      console.error("Storage diagnostics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to run storage diagnostics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}
