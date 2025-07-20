import { Router, Request, Response } from 'express';
import { db } from '../db';
import { jobs, users, notaryAssignmentLog, jobNotifications } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { verifyToken, hasAdminPrivileges, hasNotaryPrivileges } from '../auth';
import { cacheUserData } from '../middleware/cache-middleware';

const router = Router();

// Middleware to ensure only notaries and admins can access these routes
const requireNotaryOrAdmin = (req: any, res: Response, next: any) => {
  if (!hasNotaryPrivileges(req.user) && !hasAdminPrivileges(req.user)) {
    return res.status(403).json({ error: 'Notary or admin access required' });
  }
  next();
};

/**
 * GET /api/notary/pending-jobs
 * Get all jobs pending approval for the current notary
 */
router.get('/pending-jobs', verifyToken, requireNotaryOrAdmin, async (req: any, res: Response) => {
  try {
    const notaryId = req.user.id;

    // Get all jobs assigned to this notary that are pending approval
    const pendingJobs = await db.execute(sql`
      SELECT 
        j.id,
        j.title_company,
        j.closing_type,
        j.internal_reference,
        j.selected_date,
        j.selected_time,
        j.job_status,
        j.notary_approval_status,
        j.property_address_one,
        j.property_city,
        j.property_state,
        j.property_zip_code,
        j.requires_nsa,
        j.requires_spanish_speaking,
        j.created_at,
        j.scheduled_at,
        j.kba_required,
        -- Count participants
        COUNT(CASE 
          WHEN jp.role IN ('signer', 'witness') AND (u.id IS NULL OR u.role NOT IN ('admin', 'notary')) THEN 1 
          ELSE NULL 
        END) as total_participants,
        COUNT(CASE 
          WHEN jp.user_id IS NOT NULL AND jp.role IN ('signer', 'witness') AND (u.is_verified = true OR u.is_verification_bypassed = true OR u.notary_verification_bypassed = true) AND u.role NOT IN ('admin', 'notary') THEN 1 
          ELSE NULL 
        END) as verified_participants,
        COUNT(CASE 
          WHEN jp.role = 'signer' AND (u.id IS NULL OR u.role NOT IN ('admin', 'notary')) THEN 1 
          ELSE NULL 
        END) as signer_count,
        COUNT(CASE 
          WHEN jp.role = 'witness' AND (u.id IS NULL OR u.role NOT IN ('admin', 'notary')) THEN 1 
          ELSE NULL 
        END) as witness_count,
        -- Get creator info
        creator.username as created_by_username,
        creator.email as created_by_email,
        COALESCE(creator.full_name, creator.first_name || ' ' || creator.last_name) as created_by_name
      FROM jobs j
      LEFT JOIN job_participants jp ON j.id = jp.job_id
      LEFT JOIN users u ON jp.user_id = u.id
      LEFT JOIN users creator ON j.user_id = creator.id
      WHERE j.notary_id = ${notaryId}
      AND j.notary_approval_status = 'assigned_pending_approval'
      AND j.job_status IN ('open', 'pending')
      GROUP BY j.id, creator.username, creator.email, creator.full_name, creator.first_name, creator.last_name
      ORDER BY j.created_at DESC
    `);

    res.json(pendingJobs.rows);
  } catch (error) {
    console.error('Error fetching pending jobs:', error);
    res.status(500).json({ error: 'Failed to fetch pending jobs' });
  }
});

/**
 * GET /api/notary/job-invitations
 * Get all job invitations for the current notary (same as pending-jobs but clearer name)
 */
router.get('/job-invitations', verifyToken, requireNotaryOrAdmin, cacheUserData(60), async (req: any, res: Response) => {
  try {
    const notaryId = req.user.id;

    // OPTIMIZED: Split into smaller, faster queries instead of one complex query
    
    // Step 1: Get basic job information (fastest query)
    const basicJobs = await db.execute(sql`
      SELECT 
        j.id,
        j.title_company,
        j.closing_type,
        j.internal_reference,
        j.selected_date,
        j.selected_time,
        j.job_status,
        j.notary_approval_status,
        j.property_address_one,
        j.property_city,
        j.property_state,
        j.property_zip_code,
        j.requires_nsa,
        j.requires_spanish_speaking,
        j.created_at,
        j.scheduled_at,
        j.kba_required,
        -- Get creator info in the same query
        creator.username as created_by_username,
        creator.email as created_by_email,
        COALESCE(creator.full_name, creator.first_name || ' ' || creator.last_name) as created_by_name
      FROM jobs j
      LEFT JOIN users creator ON j.user_id = creator.id
      WHERE j.notary_id = ${notaryId}
      AND j.notary_approval_status = 'assigned_pending_approval'
      AND j.job_status IN ('open', 'pending')
      ORDER BY j.created_at DESC
      LIMIT 50
    `);

    if (basicJobs.rows.length === 0) {
      return res.json([]);
    }

    const jobIds = basicJobs.rows.map(job => job.id);

    // Step 2: Get participant counts efficiently (single query for all jobs)
    const participantStats = await db.execute(sql`
      SELECT 
        jp.job_id,
        COUNT(CASE WHEN jp.role IN ('signer', 'witness') THEN 1 END) as total_participants,
        COUNT(CASE WHEN jp.role = 'signer' THEN 1 END) as signer_count,
        COUNT(CASE WHEN jp.role = 'witness' THEN 1 END) as witness_count,
        COUNT(CASE 
          WHEN jp.user_id IS NOT NULL 
          AND jp.role IN ('signer', 'witness')
          AND u.is_verified = true 
          THEN 1 
        END) as verified_participants
      FROM job_participants jp
      LEFT JOIN users u ON jp.user_id = u.id AND u.role NOT IN ('admin', 'notary')
      WHERE jp.job_id = ANY(${jobIds})
      GROUP BY jp.job_id
    `);

    // Step 3: Get document counts efficiently (single query for all jobs)  
    const documentCounts = await db.execute(sql`
      SELECT job_id, COUNT(*) as document_count
      FROM job_documents
      WHERE job_id = ANY(${jobIds})
      GROUP BY job_id
    `);

    // Step 4: Combine results efficiently
    const participantMap = new Map(participantStats.rows.map(row => [row.job_id, row]));
    const documentMap = new Map(documentCounts.rows.map(row => [row.job_id, row]));

    const enrichedJobs = basicJobs.rows.map(job => {
      const participants = participantMap.get(job.id) || {
        total_participants: 0,
        signer_count: 0,
        witness_count: 0,
        verified_participants: 0
      };
      const documents = documentMap.get(job.id) || { document_count: 0 };

      return {
        ...job,
        total_participants: parseInt(participants.total_participants) || 0,
        verified_participants: parseInt(participants.verified_participants) || 0,
        signer_count: parseInt(participants.signer_count) || 0,
        witness_count: parseInt(participants.witness_count) || 0,
        document_count: parseInt(documents.document_count) || 0
      };
    });

    res.json(enrichedJobs);
  } catch (error) {
    console.error('Error fetching job invitations:', error);
    res.status(500).json({ error: 'Failed to fetch job invitations' });
  }
});

/**
 * POST /api/notary/jobs/:jobId/approve
 * Approve a job assignment
 */
router.post('/jobs/:jobId/approve', verifyToken, requireNotaryOrAdmin, async (req: any, res: Response) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const notaryId = req.user.id;
    const { notes } = req.body;

    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    // Check if this notary is assigned to this job
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.notaryId, notaryId)
      ))
      .limit(1);

    if (!job) {
      return res.status(404).json({ error: 'Job not found or not assigned to you' });
    }

    if (job.notaryApprovalStatus !== 'assigned_pending_approval') {
      return res.status(400).json({ 
        error: 'Job is not pending approval', 
        currentStatus: job.notaryApprovalStatus 
      });
    }

    // Update job approval status
    await db
      .update(jobs)
      .set({
        notaryApprovalStatus: 'approved',
        notaryApprovedAt: new Date(),
        notaryApprovalNotes: notes || null,
        jobStatus: 'pending' // Move to pending status once approved
      })
      .where(eq(jobs.id, jobId));

    // Log the approval
    await db
      .update(notaryAssignmentLog)
      .set({
        assignmentStatus: 'accepted',
        respondedAt: new Date()
      })
      .where(and(
        eq(notaryAssignmentLog.jobId, jobId),
        eq(notaryAssignmentLog.notaryId, notaryId)
      ));

    // Send notification to job creator
    try {
      const { NotificationService } = await import('../notification-service');
      const notificationService = new NotificationService();
      await notificationService.sendJobApprovalNotification(jobId, notaryId, 'approved');
    } catch (notificationError) {
      console.error('Failed to send job approval notification:', notificationError);
    }

    // Send invitations to signers now that notary has approved
    try {
      const { sendSignerInvitations } = await import('../services/signer-invitation-service');
      await sendSignerInvitations(jobId);
    } catch (invitationError) {
      console.error('Failed to send signer invitations:', invitationError);
    }

    res.json({ 
      success: true, 
      message: 'Job approved successfully. Signer invitations have been sent.',
      jobId,
      approvedAt: new Date()
    });
  } catch (error) {
    console.error('Error approving job:', error);
    res.status(500).json({ error: 'Failed to approve job' });
  }
});

/**
 * POST /api/notary/jobs/:jobId/reject
 * Reject a job assignment
 */
router.post('/jobs/:jobId/reject', verifyToken, requireNotaryOrAdmin, async (req: any, res: Response) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const notaryId = req.user.id;
    const { reason } = req.body;

    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    // Check if this notary is assigned to this job
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.notaryId, notaryId)
      ))
      .limit(1);

    if (!job) {
      return res.status(404).json({ error: 'Job not found or not assigned to you' });
    }

    if (job.notaryApprovalStatus !== 'assigned_pending_approval') {
      return res.status(400).json({ 
        error: 'Job is not pending approval', 
        currentStatus: job.notaryApprovalStatus 
      });
    }

    // Update job approval status
    await db
      .update(jobs)
      .set({
        notaryApprovalStatus: 'rejected',
        notaryApprovalNotes: reason.trim(),
        // Clear notary assignment so it can be reassigned
        notaryId: null,
        selectedNotary: null,
        // Add this notary to rejected list
        rejectedNotaries: sql`array_append(COALESCE(rejected_notaries, '{}'), ${notaryId})`
      })
      .where(eq(jobs.id, jobId));

    // Log the rejection
    await db
      .update(notaryAssignmentLog)
      .set({
        assignmentStatus: 'rejected',
        respondedAt: new Date(),
        rejectionReason: reason.trim()
      })
      .where(and(
        eq(notaryAssignmentLog.jobId, jobId),
        eq(notaryAssignmentLog.notaryId, notaryId)
      ));

    // Send notification to job creator
    try {
      const { NotificationService } = await import('../notification-service');
      const notificationService = new NotificationService();
      await notificationService.sendJobApprovalNotification(jobId, notaryId, 'rejected', reason.trim());
    } catch (notificationError) {
      console.error('Failed to send job rejection notification:', notificationError);
    }

    // Try to find another notary for this job
    let reassignmentResult = null;
    if (job.isRandomAssignment) {
      try {
        const { EnhancedAssignmentService } = await import('../enhanced-assignment-service');
        reassignmentResult = await EnhancedAssignmentService.performAutoAssignment(jobId, job.titleCompany);
        
        if (reassignmentResult.success) {
          console.log(`✅ Reassigned job ${jobId} to ${reassignmentResult.notaryName} after rejection`);
        } else {
          console.log(`❌ Failed to reassign job ${jobId} after rejection: ${reassignmentResult.error}`);
        }
      } catch (reassignError) {
        console.error('Failed to reassign job after rejection:', reassignError);
      }
    }

    res.json({ 
      success: true, 
      message: 'Job rejected successfully. The job will be reassigned to another notary.',
      jobId,
      rejectedAt: new Date(),
      reassignmentResult
    });
  } catch (error) {
    console.error('Error rejecting job:', error);
    res.status(500).json({ error: 'Failed to reject job' });
  }
});

/**
 * GET /api/notary/jobs/:jobId/details
 * Get detailed information about a job for approval decision
 */
router.get('/jobs/:jobId/details', verifyToken, requireNotaryOrAdmin, async (req: any, res: Response) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const notaryId = req.user.id;

    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    // Get job details with participant information
    const jobDetails = await db.execute(sql`
      SELECT 
        j.*,
        -- Creator info
        creator.username as created_by_username,
        creator.email as created_by_email,
        COALESCE(creator.full_name, creator.first_name || ' ' || creator.last_name) as created_by_name,
        creator.role as created_by_role,
        -- Company info (if applicable)
        c.company_name as company_name,
        c.company_type as company_type,
        -- Count participants
        COUNT(CASE WHEN jp.role = 'signer' THEN 1 END) as signer_count,
        COUNT(CASE WHEN jp.role = 'witness' THEN 1 END) as witness_count,
        COUNT(CASE WHEN jp.role IN ('signer', 'witness') THEN 1 END) as total_participants,
        -- Document count
        (SELECT COUNT(*) FROM job_documents jd WHERE jd.job_id = j.id) as document_count
      FROM jobs j
      LEFT JOIN users creator ON j.user_id = creator.id
      LEFT JOIN companies c ON creator.company_id = c.id
      LEFT JOIN job_participants jp ON j.id = jp.job_id
      WHERE j.id = ${jobId}
      AND j.notary_id = ${notaryId}
      GROUP BY j.id, creator.username, creator.email, creator.full_name, creator.first_name, creator.last_name, creator.role, c.company_name, c.company_type
    `);

    if (jobDetails.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or not assigned to you' });
    }

    const job = jobDetails.rows[0];

    // Get signers information
    const signers = await db.execute(sql`
      SELECT 
        s.id,
        s.signer_name,
        s.signer_email,
        s.signer_phone_number,
        s.signer_role,
        s.signing_status,
        s.access_type,
        s.guest_verification_status,
        -- User account info if linked
        u.username,
        u.is_verified,
        u.verification_status,
        u.is_verification_bypassed,
        u.notary_verification_bypassed
      FROM signers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.job_id = ${jobId}
      ORDER BY s.signer_role, s.signer_name
    `);

    // Get job documents
    const documents = await db.execute(sql`
      SELECT 
        jd.id,
        jd.file_name,
        jd.original_name,
        jd.file_size,
        jd.mime_type,
        jd.document_type,
        jd.status,
        jd.is_required,
        jd.created_at
      FROM job_documents jd
      WHERE jd.job_id = ${jobId}
      ORDER BY jd.created_at
    `);

    res.json({
      job,
      signers: signers.rows,
      documents: documents.rows,
      participantSummary: {
        totalParticipants: job.total_participants,
        signerCount: job.signer_count,
        witnessCount: job.witness_count,
        documentCount: job.document_count
      }
    });
  } catch (error) {
    console.error('Error fetching job details:', error);
    res.status(500).json({ error: 'Failed to fetch job details' });
  }
});

export default router; 