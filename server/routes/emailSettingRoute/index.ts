import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";
import { db } from "../../db";

import { verifyToken, hasAdminPrivileges, type AuthUser } from "../../auth";

// Define the extended request interface for authentication
interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { eq, and, gte, inArray } from "drizzle-orm";

import crypto from "crypto";

import {
  users,
  jobs,
  signers,
  systemSettings,
  passwordResetTokens,
} from "@shared/schema";

import { emailService } from "../../lib/email-service";

export async function emailSettingsRoutes(app: Express): Promise<Server> {
  app.get("/api/settings/email", verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const settingsData = await db
        .select()
        .from(systemSettings)
        .where(
          inArray(systemSettings.key, [
            "email_provider",
            "postmark_api_key",
            "postmark_from_email",
            "postmark_from_name",
            "postmark_track_opens",
            "postmark_track_links",
            "postmark_message_stream",
            "smtp_host",
            "smtp_port",
            "smtp_user",
            "smtp_pass",
            "smtp_secure",
            "from_email",
            "from_name",
          ])
        );

      const settings: any = {};
      settingsData.forEach((setting) => {
        // Don't expose passwords/keys in plain text
        if (setting.key === "smtp_pass" || setting.key === "postmark_api_key") {
          settings[setting.key] = setting.value ? "••••••••" : "";
        } else {
          settings[setting.key] = setting.value;
        }
      });

      res.json(settings);
    } catch (error) {
      console.error("Get email settings error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/settings/email", verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const {
        email_provider,
        postmark_api_key,
        postmark_from_email,
        postmark_from_name,
        postmark_track_opens,
        postmark_track_links,
        postmark_message_stream,
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_pass,
        smtp_secure,
        from_email,
        from_name,
      } = req.body;

      const emailSettings = [
        {
          key: "email_provider",
          value: email_provider,
          description: "Email provider preference",
        },
        {
          key: "postmark_from_email",
          value: postmark_from_email,
          description: "Postmark from email address",
        },
        {
          key: "postmark_from_name",
          value: postmark_from_name,
          description: "Postmark from display name",
        },
        {
          key: "postmark_track_opens",
          value: postmark_track_opens,
          description: "Postmark track email opens",
        },
        {
          key: "postmark_track_links",
          value: postmark_track_links,
          description: "Postmark track links",
        },
        {
          key: "postmark_message_stream",
          value: postmark_message_stream,
          description: "Postmark message stream",
        },
        {
          key: "smtp_host",
          value: smtp_host,
          description: "SMTP server hostname",
        },
        { key: "smtp_port", value: smtp_port, description: "SMTP server port" },
        {
          key: "smtp_user",
          value: smtp_user,
          description: "SMTP username/email",
        },
        {
          key: "smtp_secure",
          value: smtp_secure,
          description: "Use SSL/TLS for SMTP",
        },
        {
          key: "from_email",
          value: from_email,
          description: "From email address",
        },
        {
          key: "from_name",
          value: from_name,
          description: "From display name",
        },
      ];

      // Only update passwords/keys if they're not the masked values
      if (postmark_api_key && postmark_api_key !== "••••••••") {
        emailSettings.push({
          key: "postmark_api_key",
          value: postmark_api_key,
          description: "Postmark API key",
        });
      }

      if (smtp_pass && smtp_pass !== "••••••••") {
        emailSettings.push({
          key: "smtp_pass",
          value: smtp_pass,
          description: "SMTP password",
        });
      }

      // Update or insert each setting
      for (const setting of emailSettings) {
        const existing = await db
          .select()
          .from(systemSettings)
          .where(eq(systemSettings.key, setting.key))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(systemSettings)
            .set({
              value: setting.value,
              description: setting.description,
              updatedAt: new Date(),
            })
            .where(eq(systemSettings.key, setting.key));
        } else {
          await db.insert(systemSettings).values({
            key: setting.key,
            value: setting.value,
            type: "string",
            description: setting.description,
            isProtected: false,
          });
        }
      }

      // Clear email service cache to force reload of new settings
      emailService.clearCache();
      console.log("Email settings updated and cache cleared");

      res.json({ message: "Email settings updated successfully" });
    } catch (error) {
      console.error("Update email settings error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/settings/email/test", verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { testEmail } = req.body;
      if (!testEmail) {
        return res
          .status(400)
          .json({ message: "Test email address is required" });
      }

      const result = await emailService.testConfiguration(testEmail);
      res.json({ message: result });
    } catch (error) {
      console.error("Email test error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Email test failed",
      });
    }
  });

  app.post(
    "/api/signers/:id/resend-invitation",
    verifyToken,
    async (req: any, res) => {
      try {
        const signerId = parseInt(req.params.id);

        // Get signer details
        const [signer] = await db
          .select({
            signer: signers,
            job: jobs,
          })
          .from(signers)
          .leftJoin(jobs, eq(signers.jobId, jobs.id))
          .where(eq(signers.id, signerId));

        if (!signer) {
          return res.status(404).json({ message: "Signer not found" });
        }

        const invitationToken =
          signer.signer.invitationToken || crypto.randomUUID();

        if (!signer.signer.invitationToken) {
          await db
            .update(signers)
            .set({
              invitationToken,
              invitationSentAt: new Date(),
            })
            .where(eq(signers.id, signerId));
        } else {
          await db
            .update(signers)
            .set({ invitationSentAt: new Date() })
            .where(eq(signers.id, signerId));
        }

        // Send professional email invitation
        await emailService.sendSignerInvitation({
          signerName: signer.signer.signerName,
          signerEmail: signer.signer.signerEmail,
          signerRole: signer.signer.signerRole,
          invitationToken,
          titleCompany: signer.job?.titleCompany || "Unknown Company",
          closingType: signer.job?.closingType || "Document Signing",
          propertyAddress: signer.job
            ? `${signer.job.propertyAddressOne}, ${signer.job.propertyCity}, ${signer.job.propertyState} ${signer.job.propertyZipCode}`
            : undefined,
          scheduledDate: signer.job?.selectedDate,
          scheduledTime: signer.job?.selectedTime,
        });

        res.json({ message: "Invitation resent successfully" });
      } catch (error) {
        console.error("Resend invitation error:", error);
        res.status(500).json({ message: "Failed to resend invitation" });
      }
    }
  );

  // Validate signer invitation token - PUBLIC endpoint (no auth required)
  app.get("/api/signers/validate-invitation/:token", async (req, res) => {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({ message: "Invalid invitation token" });
      }

      // Find signer by invitation token
      const result = await db
        .select({
          signer: signers,
          job: jobs,
          user: users,
        })
        .from(signers)
        .innerJoin(jobs, eq(signers.jobId, jobs.id))
        .leftJoin(users, eq(signers.userId, users.id))
        .where(eq(signers.invitationToken, token))
        .limit(1);

      if (!result || result.length === 0) {
        return res
          .status(404)
          .json({ message: "Invalid or expired invitation token" });
      }

      const [data] = result;

      // Check if the job is still active
      if (
        data.job.jobStatus === "completed" ||
        data.job.jobStatus === "cancelled"
      ) {
        return res.status(410).json({
          message:
            "This signing session has already been completed or cancelled",
        });
      }

      // Check if user account exists for this email
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, data.signer.signerEmail))
        .limit(1);

      // Return signer and job information
      res.json({
        valid: true,
        hasAccount: !!existingUser,
        accountSetupComplete: existingUser?.accountSetupComplete || false,
        signer: {
          id: data.signer.id,
          signerName: data.signer.signerName,
          signerEmail: data.signer.signerEmail,
          signerRole: data.signer.signerRole,
          userId: data.signer.userId,
          signingStatus: data.signer.signingStatus,
        },
        job: {
          id: data.job.id,
          titleCompany: data.job.titleCompany,
          closingType: data.job.closingType,
          propertyAddressOne: data.job.propertyAddressOne,
          propertyCity: data.job.propertyCity,
          propertyState: data.job.propertyState,
          propertyZipCode: data.job.propertyZipCode,
          selectedDate: data.job.selectedDate,
          selectedTime: data.job.selectedTime,
          jobStatus: data.job.jobStatus,
        },
        user: existingUser
          ? {
              id: existingUser.id,
              email: existingUser.email,
              firstName: existingUser.firstName,
              lastName: existingUser.lastName,
              role: existingUser.role,
              isVerified: existingUser.isVerified,
              accountSetupComplete: existingUser.accountSetupComplete,
            }
          : null,
      });
    } catch (error) {
      console.error("Validate invitation error:", error);
      res.status(500).json({ message: "Failed to validate invitation" });
    }
  });

  // Get or create password reset token for signer - PUBLIC endpoint (no auth required)
  app.post("/api/signers/get-password-reset-token", async (req, res) => {
    try {
      const { invitationToken } = req.body;

      if (!invitationToken) {
        return res
          .status(400)
          .json({ message: "Invitation token is required" });
      }

      // Find signer by invitation token
      const [signer] = await db
        .select()
        .from(signers)
        .where(eq(signers.invitationToken, invitationToken))
        .limit(1);

      if (!signer) {
        return res.status(404).json({ message: "Invalid invitation token" });
      }

      // Find user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, signer.signerEmail))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: "User account not found" });
      }

      // Check if user already has an active password reset token
      const [existingToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            eq(passwordResetTokens.used, false),
            gte(passwordResetTokens.expiresAt, new Date())
          )
        )
        .limit(1);

      if (existingToken) {
        // Return existing token
        res.json({
          passwordResetToken: existingToken.token,
          invitationToken: invitationToken,
        });
      } else {
        // Create new password reset token
        const passwordResetToken = crypto.randomUUID();
        const tokenExpiry = new Date();
        tokenExpiry.setHours(tokenExpiry.getHours() + 24);

        await db.insert(passwordResetTokens).values({
          userId: user.id,
          token: passwordResetToken,
          expiresAt: tokenExpiry,
          used: false,
        });

        res.json({
          passwordResetToken: passwordResetToken,
          invitationToken: invitationToken,
        });
      }
    } catch (error) {
      console.error("Get password reset token error:", error);
      res.status(500).json({ message: "Failed to get password reset token" });
    }
  });

  app.post(
    "/api/jobs/:id/send-invitations",
    verifyToken,
    async (req: any, res) => {
      try {
        const jobId = parseInt(req.params.id);

        if (!hasAdminPrivileges(req.user)) {
          return res.status(403).json({ message: "Admin access required" });
        }

        // Import notification service
        const { notificationService } = await import(
          "../../notification-service"
        );

        // Send all signer invitations for this job
        await notificationService.sendSignerInvitations(jobId);

        res.json({
          message: `Signer invitations sent successfully for job ${jobId}`,
        });
      } catch (error) {
        console.error("Send invitations error:", error);
        res.status(500).json({
          message: "Failed to send invitations",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );
}
