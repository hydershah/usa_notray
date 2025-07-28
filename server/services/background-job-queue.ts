/**
 * Background Job Queue Service
 * 
 * Purpose: Move time-consuming operations out of request-response cycle
 * Target: Reduce job creation time from 22s to <3s by making it non-blocking
 */

import { emailService } from '../lib/email-service';
import { db } from '../db';
import { signers, jobs } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

interface EmailJob {
  type: 'SEND_SIGNER_INVITATIONS';
  jobId: number;
  priority: 'high' | 'normal' | 'low';
  createdAt: Date;
}

interface CacheInvalidationJob {
  type: 'CACHE_INVALIDATION';
  jobId: number;
  userId: number;
  notaryId?: number;
  priority: 'low';
  createdAt: Date;
}

type BackgroundJob = EmailJob | CacheInvalidationJob;

class BackgroundJobQueue {
  private queue: BackgroundJob[] = [];
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start processing queue immediately
    this.startProcessing();
  }

  /**
   * Add email sending job to background queue
   * This makes job creation non-blocking
   */
  async queueSignerInvitations(jobId: number): Promise<void> {
    const emailJob: EmailJob = {
      type: 'SEND_SIGNER_INVITATIONS',
      jobId,
      priority: 'high',
      createdAt: new Date()
    };

    this.queue.push(emailJob);
    console.log(`📬 Queued signer invitations for job ${jobId} (queue length: ${this.queue.length})`);
    
    // Trigger immediate processing for high priority jobs
    if (emailJob.priority === 'high' && !this.isProcessing) {
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Add cache invalidation job to background queue
   */
  async queueCacheInvalidation(jobId: number, userId: number, notaryId?: number): Promise<void> {
    const cacheJob: CacheInvalidationJob = {
      type: 'CACHE_INVALIDATION',
      jobId,
      userId,
      notaryId,
      priority: 'low',
      createdAt: new Date()
    };

    this.queue.push(cacheJob);
    console.log(`🧹 Queued cache invalidation for job ${jobId} (queue length: ${this.queue.length})`);
  }

  /**
   * Start continuous background processing
   */
  private startProcessing(): void {
    // Process queue every 100ms for responsiveness
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 100);

    console.log('🚀 Background job queue processing started');
  }

  /**
   * Process jobs in the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Sort by priority: high -> normal -> low
      this.queue.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // Process up to 3 jobs per cycle to prevent blocking
      const jobsToProcess = this.queue.splice(0, 3);
      
      if (jobsToProcess.length > 0) {
        console.log(`⚡ Processing ${jobsToProcess.length} background jobs...`);
        
        // Process jobs in parallel for better performance
        const processingPromises = jobsToProcess.map(job => this.processJob(job));
        await Promise.all(processingPromises);
      }

    } catch (error) {
      console.error('❌ Background job processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual background job
   */
  private async processJob(job: BackgroundJob): Promise<void> {
    const startTime = Date.now();

    try {
      switch (job.type) {
        case 'SEND_SIGNER_INVITATIONS':
          await this.processSendSignerInvitations(job as EmailJob);
          break;
        
        case 'CACHE_INVALIDATION':
          await this.processCacheInvalidation(job as CacheInvalidationJob);
          break;
        
        default:
          console.warn(`⚠️ Unknown job type: ${(job as any).type}`);
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ Completed ${job.type} for job ${job.jobId} in ${processingTime}ms`);

    } catch (error) {
      console.error(`❌ Failed to process ${job.type} for job ${job.jobId}:`, error);
      
      // Retry mechanism for failed jobs (add back to queue with lower priority)
      if (job.priority !== 'low') {
        const retryJob = { ...job, priority: 'low' as const };
        this.queue.push(retryJob);
        console.log(`🔄 Retrying ${job.type} for job ${job.jobId} with low priority`);
      }
    }
  }

  /**
   * Process signer invitation emails in background
   */
  private async processSendSignerInvitations(job: EmailJob): Promise<void> {
    console.log(`📧 Background: Sending invitations for job ${job.jobId}`);

    // Get job and signers
    const [jobRecord] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, job.jobId));

    if (!jobRecord) {
      console.error(`❌ Job ${job.jobId} not found for email sending`);
      return;
    }

    const jobSigners = await db
      .select()
      .from(signers)
      .where(eq(signers.jobId, job.jobId));

    if (jobSigners.length === 0) {
      console.log(`⚠️ No signers found for job ${job.jobId}`);
      return;
    }

    console.log(`📧 Sending ${jobSigners.length} invitations in background...`);

    // Send all invitations in parallel (background doesn't block anything)
    const invitationPromises = jobSigners.map(async (signer) => {
      try {
        // Generate invitation token if not exists
        let invitationToken = signer.invitationToken;
        if (!invitationToken) {
          invitationToken = crypto.randomUUID();
          await db.update(signers)
            .set({ 
              invitationToken,
              invitationSentAt: new Date()
            })
            .where(eq(signers.id, signer.id));
        } else {
          await db.update(signers)
            .set({ invitationSentAt: new Date() })
            .where(eq(signers.id, signer.id));
        }

        // Send email
        await emailService.sendSignerInvitation({
          signerName: signer.signerName,
          signerEmail: signer.signerEmail,
          signerRole: signer.signerRole,
          invitationToken,
          titleCompany: jobRecord.titleCompany,
          closingType: jobRecord.closingType,
          propertyAddress: jobRecord.propertyAddressOne ? 
            `${jobRecord.propertyAddressOne}, ${jobRecord.propertyCity}, ${jobRecord.propertyState} ${jobRecord.propertyZipCode}` : 
            undefined,
          scheduledDate: jobRecord.selectedDate || undefined,
          scheduledTime: jobRecord.selectedTime || undefined
        });

        return { success: true, signerEmail: signer.signerEmail };
      } catch (error) {
        console.error(`Failed to send invitation to ${signer.signerEmail}:`, error);
        return { success: false, signerEmail: signer.signerEmail, error };
      }
    });

    const results = await Promise.all(invitationPromises);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`📧 Background email results: ${successCount} sent, ${failCount} failed`);

    // Update job record to mark notifications as sent
    await db.update(jobs)
      .set({
        signerNotificationsSent: true,
        signerNotificationsSentAt: new Date()
      })
      .where(eq(jobs.id, job.jobId));
  }

  /**
   * Process cache invalidation in background
   */
  private async processCacheInvalidation(job: CacheInvalidationJob): Promise<void> {
    console.log(`🧹 Background: Cache invalidation for job ${job.jobId}`);

    try {
      const { cacheInvalidation } = await import('./cache-manager');
      await cacheInvalidation.onJobCreated(job.jobId, job.notaryId, job.userId);
      console.log(`✅ Background cache invalidation completed for job ${job.jobId}`);
    } catch (error) {
      console.error('Background cache invalidation failed:', error);
    }
  }

  /**
   * Graceful shutdown
   */
  shutdown(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    console.log('🛑 Background job queue stopped');
  }

  /**
   * Get queue status for monitoring
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      jobs: this.queue.map(job => ({
        type: job.type,
        jobId: job.jobId,
        priority: job.priority,
        age: Date.now() - job.createdAt.getTime()
      }))
    };
  }
}

// Export singleton instance
export const backgroundJobQueue = new BackgroundJobQueue();

// Graceful shutdown handler
process.on('SIGTERM', () => {
  backgroundJobQueue.shutdown();
});

process.on('SIGINT', () => {
  backgroundJobQueue.shutdown();
}); 