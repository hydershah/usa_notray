import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import { 
  jobs, 
  users, 
  jobNotifications, 
  signers,
  companies,
  InsertJobNotification,
  JobNotification
} from "../shared/schema";
import { emailService } from './lib/email-service';
import crypto from 'crypto';

export class NotificationService {

  /**
   * Send job assignment notification to notary
   */
  async sendJobAssignmentNotification(jobId: number, notaryId: number): Promise<void> {
    try {
      console.log(`📧 Sending job assignment notification for job ${jobId} to notary ${notaryId}`);
      
      // Get job and notary details
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);

      const [notary] = await db
        .select()
        .from(users)
        .where(eq(users.id, notaryId))
        .limit(1);

      if (!job || !notary) {
        throw new Error('Job or notary not found');
      }

      // Create notification record
      await db.insert(jobNotifications).values({
        jobId,
        recipientId: notaryId,
        recipientEmail: notary.email,
        notificationType: 'job_assignment',
        status: 'pending',
        subject: `New Job Assignment - ${job.titleCompany}`,
        message: `You have been assigned to a new notarization job for ${job.titleCompany}`,
        metadata: { jobId, notaryId }
      });

      // TODO: Send actual email notification to notary about the assignment
      console.log(`✅ Job assignment notification recorded for notary ${notary.firstName} ${notary.lastName}`);
      
    } catch (error) {
      console.error('Failed to send job assignment notification:', error);
      throw error;
    }
  }

  /**
   * Send approval request notification to notary
   */
  async sendApprovalRequestNotification(jobId: number, notaryId: number): Promise<void> {
    try {
      console.log(`📧 Sending approval request notification for job ${jobId} to notary ${notaryId}`);
      
      // Create notification record
      await db.insert(jobNotifications).values({
        jobId,
        recipientId: notaryId,
        recipientEmail: '',
        notificationType: 'approval_request',
        status: 'pending',
        subject: 'Job Approval Required',
        message: 'Please review and approve this job assignment',
        metadata: { jobId, notaryId }
      });

      console.log(`✅ Approval request notification recorded for job ${jobId}`);
      
    } catch (error) {
      console.error('Failed to send approval request notification:', error);
      throw error;
    }
  }

  /**
   * Send signer invitations when job is approved
   */
  async sendSignerInvitations(jobId: number): Promise<void> {
    try {
      console.log(`📧 Sending signer invitations for job ${jobId}`);
      
      // Get job details
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);

      if (!job) {
        console.error(`❌ Job ${jobId} not found in database`);
        throw new Error('Job not found');
      }

      // Idempotency guard: skip if already sent
      if (job.signerNotificationsSent) {
        console.log(`ℹ️ Signer invitations already sent for job ${jobId}, skipping.`);
        return;
      }

      console.log(`🔍 DEBUG: Job ${jobId} found - title company: ${job.titleCompany}`);

      // Get all signers for this job
      const jobSigners = await db
        .select()
        .from(signers)
        .where(eq(signers.jobId, jobId));

      console.log(`📋 Found ${jobSigners.length} signers for job ${jobId}`);
      if (jobSigners.length === 0) {
        console.log(`⚠️ WARNING: No signers found for job ${jobId} - nothing to send`);
        return;
      }

      let successCount = 0;
      let failureCount = 0;

      // Send invitation to each signer
      for (const signer of jobSigners) {
        let emailSent = false;
        let invitationToken = signer.invitationToken;
        
        try {
          // Generate invitation token if not exists
          if (!invitationToken) {
            invitationToken = crypto.randomUUID();
            await db
              .update(signers)
              .set({ 
                invitationToken
              })
              .where(eq(signers.id, signer.id));
          }

          // Send professional email invitation
          await emailService.sendSignerInvitation({
            signerName: signer.signerName,
            signerEmail: signer.signerEmail,
            signerRole: signer.signerRole,
            invitationToken,
            titleCompany: job.titleCompany,
            closingType: job.closingType,
            propertyAddress: job.propertyAddressOne ? 
              `${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState} ${job.propertyZipCode}` : 
              undefined,
            scheduledDate: job.selectedDate,
            scheduledTime: job.selectedTime
          });

          // Email sent successfully - update signer record
          await db
            .update(signers)
            .set({ invitationSentAt: new Date() })
            .where(eq(signers.id, signer.id));

          emailSent = true;
          successCount++;

          console.log(`✅ Invitation sent to ${signer.signerName} (${signer.signerEmail})`);
          
        } catch (signerError) {
          console.error(`❌ Failed to send invitation to ${signer.signerEmail}:`, signerError);
          failureCount++;
        }

        // ALWAYS create notification record regardless of userId - this was the bug!
        try {
          await db.insert(jobNotifications).values({
            jobId,
            recipientId: signer.userId || 0, // Use 0 if no userId
            recipientEmail: signer.signerEmail,
            notificationType: 'signer_invite',
            status: emailSent ? 'sent' : 'failed',
            subject: `🏛️ Secure Document Signing Required - ${job.titleCompany}`,
            message: emailSent 
              ? `Invitation sent to ${signer.signerName} for ${job.titleCompany} document signing`
              : `Failed to send invitation to ${signer.signerName}`,
            metadata: { jobId, signerId: signer.id, invitationToken },
            sentAt: emailSent ? new Date() : null,
            errorMessage: emailSent ? null : 'Email sending failed'
          });
        } catch (logError) {
          console.error(`❌ Failed to log notification for ${signer.signerEmail}:`, logError);
        }
      }

      // Mark job as having notifications sent if any succeeded
      if (successCount > 0) {
        await db
          .update(jobs)
          .set({
            signerNotificationsSent: true,
            signerNotificationsSentAt: new Date()
          })
          .where(eq(jobs.id, jobId));
        console.log(`✅ ${successCount} signer invitation(s) sent for job ${jobId}`);
      } else {
        console.log(`⚠️ All signer invitations failed for job ${jobId}`);
      }
      
    } catch (error) {
      console.error('Failed to send signer invitations:', error);
      throw error;
    }
  }

  /**
   * Send approval granted notification and trigger signer invitations
   */
  async sendApprovalGrantedNotification(jobId: number, notaryId: number): Promise<void> {
    try {
      console.log(`📧 Processing approval granted notification for job ${jobId}`);
      
      // Create notification record
      await db.insert(jobNotifications).values({
        jobId,
        recipientId: notaryId,
        recipientEmail: '',
        notificationType: 'approval_granted',
        status: 'pending',
        subject: 'Job Approved Successfully',
        message: 'Job has been approved and signer invitations will be sent',
        metadata: { jobId, notaryId }
      });

      // Automatically send signer invitations when job is approved
      await this.sendSignerInvitations(jobId);

      console.log(`✅ Approval granted notification processed for job ${jobId}`);
      
    } catch (error) {
      console.error('Failed to send approval granted notification:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const notificationService = new NotificationService();
