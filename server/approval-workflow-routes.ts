import { Express } from 'express';
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { db } from "./db";
import { 
  jobs, 
  users, 
  notaryApprovalQueue, 
  jobNotifications,
  notaryAssignmentLog,
  signers
} from "../shared/schema";
import { verifyToken } from './auth';
import { notificationService } from './notification-service';

export function registerApprovalWorkflowRoutes(app: Express) {
  
  /**
   * GET /api/approval/queue
   * Get approval queue for the current notary
   */
  app.get('/api/approval/queue', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'notary') {
        return res.status(403).json({ error: 'Only notaries can access approval queue' });
      }

      const approvalQueue = await db
        .select({
          id: notaryApprovalQueue.id,
          jobId: notaryApprovalQueue.jobId,
          titleCompany: notaryApprovalQueue.titleCompany,
          priority: notaryApprovalQueue.priority,
          deadline: notaryApprovalQueue.deadline,
          specialInstructions: notaryApprovalQueue.specialInstructions,
          createdAt: notaryApprovalQueue.createdAt,
          // Job details
          closingType: jobs.closingType,
          propertyAddress: jobs.propertyAddressOne,
          propertyCity: jobs.propertyCity,
          propertyState: jobs.propertyState,
          scheduledDate: jobs.selectedDate,
          scheduledTime: jobs.selectedTime,
          jobStatus: jobs.jobStatus,
          notaryApprovalStatus: jobs.notaryApprovalStatus,
          kbaRequired: jobs.kbaRequired,
          requiresNSA: jobs.requiresNSA,
          requiresSpanishSpeaking: jobs.requiresSpanishSpeaking
        })
        .from(notaryApprovalQueue)
        .innerJoin(jobs, eq(notaryApprovalQueue.jobId, jobs.id))
        .where(eq(notaryApprovalQueue.notaryId, req.user.id))
        .orderBy(
          desc(notaryApprovalQueue.priority),
          asc(notaryApprovalQueue.deadline),
          asc(notaryApprovalQueue.createdAt)
        );

      res.json(approvalQueue);
    } catch (error) {
      console.error('Error fetching approval queue:', error);
      res.status(500).json({ error: 'Failed to fetch approval queue' });
    }
  });

  /**
   * POST /api/approval/approve/:jobId
   * Approve a job and trigger signer notifications
   */
  app.post('/api/approval/approve/:jobId', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'notary') {
        return res.status(403).json({ error: 'Only notaries can approve jobs' });
      }

      const jobId = parseInt(req.params.jobId);
      const { notes, conditions } = req.body;

      // Verify the notary is assigned to this job and it's pending approval
      const [job] = await db
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.id, jobId),
            eq(jobs.notaryId, req.user.id),
            eq(jobs.notaryApprovalStatus, 'assigned_pending_approval')
          )
        )
        .limit(1);

      if (!job) {
        return res.status(404).json({ error: 'Job not found or not eligible for approval' });
      }

      // Update job approval status
      const approvalStatus = conditions ? 'approved_with_conditions' : 'approved';
      
      await db
        .update(jobs)
        .set({
          notaryApprovalStatus: approvalStatus,
          notaryApprovedAt: new Date(),
          notaryApprovalNotes: notes,
          notaryApprovalConditions: conditions,
          jobStatus: 'pending' // Job moves to pending status after approval
        })
        .where(eq(jobs.id, jobId));

      // Update assignment log
      await db
        .update(notaryAssignmentLog)
        .set({
          assignmentStatus: 'accepted',
          respondedAt: new Date()
        })
        .where(
          and(
            eq(notaryAssignmentLog.jobId, jobId),
            eq(notaryAssignmentLog.notaryId, req.user.id),
            eq(notaryAssignmentLog.assignmentStatus, 'assigned')
          )
        );

      // Send approval granted notification AND automatically trigger signer invitations
      try {
        const { notificationService } = await import('./notification-service');
        await notificationService.sendApprovalGrantedNotification(jobId, req.user.id);
        
        console.log(`✅ Job ${jobId} approved by notary ${req.user.id} - signer invitations sent automatically`);
      } catch (notificationError) {
        console.error('Failed to send approval notification and signer invitations:', notificationError);
        // Don't fail the approval, just log the error
      }

      res.json({
        success: true,
        message: 'Job approved successfully',
        approvalStatus,
        approvedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error approving job:', error);
      res.status(500).json({ error: 'Failed to approve job' });
    }
  });

  /**
   * POST /api/approval/reject/:jobId
   * Reject a job assignment
   */
  app.post('/api/approval/reject/:jobId', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'notary') {
        return res.status(403).json({ error: 'Only notaries can reject jobs' });
      }

      const jobId = parseInt(req.params.jobId);
      const { rejectionReason, notes } = req.body;

      if (!rejectionReason) {
        return res.status(400).json({ error: 'Rejection reason is required' });
      }

      // Update job approval status
      await db
        .update(jobs)
        .set({
          notaryApprovalStatus: 'rejected',
          notaryApprovedAt: new Date(),
          notaryApprovalNotes: notes,
          jobStatus: 'open', // Job goes back to open status
          notaryId: null // Remove notary assignment
        })
        .where(eq(jobs.id, jobId));

      // Update assignment log
      await db
        .update(notaryAssignmentLog)
        .set({
          assignmentStatus: 'rejected',
          respondedAt: new Date(),
          rejectionReason
        })
        .where(
          and(
            eq(notaryAssignmentLog.jobId, jobId),
            eq(notaryAssignmentLog.notaryId, req.user.id),
            eq(notaryAssignmentLog.assignmentStatus, 'assigned')
          )
        );

      res.json({
        success: true,
        message: 'Job rejected successfully',
        rejectedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error rejecting job:', error);
      res.status(500).json({ error: 'Failed to reject job' });
    }
  });

  /**
   * GET /api/approval/stats
   * Get approval statistics for the notary
   */
  app.get('/api/approval/stats', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'notary') {
        return res.status(403).json({ error: 'Only notaries can access approval stats' });
      }

      // Get pending approvals count
      const pendingQueue = await db
        .select()
        .from(notaryApprovalQueue)
        .where(eq(notaryApprovalQueue.notaryId, req.user.id));

      const stats = {
        pendingApprovals: pendingQueue.length,
        urgentCount: pendingQueue.filter(q => q.priority === 'urgent').length,
        overdueCount: pendingQueue.filter(q => q.deadline && new Date(q.deadline) < new Date()).length
      };

      res.json(stats);
    } catch (error) {
      console.error('Error fetching approval stats:', error);
      res.status(500).json({ error: 'Failed to fetch approval statistics' });
    }
  });
}
