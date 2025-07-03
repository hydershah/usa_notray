import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { users, jobs, jobParticipants } from '../../shared/schema.js';
import { eq, and, sql, or } from 'drizzle-orm';
import { verifyToken } from '../auth.js';

const router = Router();

// Middleware to ensure only notaries and admins can access these routes
const requireNotaryOrAdmin = (req: any, res: Response, next: any) => {
  if (req.user?.role !== 'notary' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Notary or admin access required' });
  }
  next();
};

/**
 * GET /api/notary/job-participants/:jobId
 * Get all participants for a job that the notary is assigned to
 * Shows their verification status and whether they need bypass
 */
router.get('/job-participants/:jobId', verifyToken, requireNotaryOrAdmin, async (req: any, res: Response) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const notaryId = req.user.id;

    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    // First check if this notary is assigned to this job (or if admin)
    if (req.user.role === 'notary') {
      const job = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.notaryId, notaryId)))
        .limit(1);

      if (job.length === 0) {
        return res.status(403).json({ error: 'You are not assigned to this job' });
      }
    }

    // Get all participants for this job with their verification status
    const participants = await db.execute(sql`
      SELECT 
        jp.id as participant_id,
        jp.job_id,
        jp.user_id,
        jp.role as participant_role,
        jp.invite_status,
        jp.joined_at,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.full_name,
        u.phone_number,
        u.is_verified,
        u.verification_status,
        u.is_verification_bypassed as admin_bypassed,
        u.notary_verification_bypassed,
        u.notary_verification_bypassed_by,
        u.notary_verification_bypassed_at,
        u.notary_verification_bypass_reason,
        bypass_notary.full_name as bypassed_by_notary_name,
        u.evs_transaction_id,
        u.evs_verification_confidence,
        u.evs_verified_at,
        u.id_type,
        u.id_number,
        u.verification_retry_count,
        u.created_at,
        u.last_login_at
      FROM job_participants jp
      INNER JOIN users u ON jp.user_id = u.id
      LEFT JOIN users bypass_notary ON u.notary_verification_bypassed_by = bypass_notary.id
      WHERE jp.job_id = ${jobId}
      AND jp.role IN ('signer', 'witness')
      ORDER BY jp.role, u.full_name
    `);

    res.json(participants.rows);
  } catch (error) {
    console.error('Error fetching job participants:', error);
    res.status(500).json({ error: 'Failed to fetch job participants' });
  }
});

/**
 * GET /api/notary/assigned-jobs
 * Get all jobs assigned to notary with participant verification status
 */
router.get('/assigned-jobs', verifyToken, requireNotaryOrAdmin, async (req: any, res: Response) => {
  try {
    const notaryId = req.user.id;

    // Get all jobs assigned to this notary with participant counts
    const assignedJobs = await db.execute(sql`
      SELECT 
        j.id,
        j.title_company,
        j.closing_type,
        j.selected_date,
        j.selected_time,
        j.job_status,
        j.property_address_one,
        j.property_city,
        j.property_state,
        j.created_at,
        COUNT(jp.id) as total_participants,
        COUNT(CASE WHEN u.is_verified = true OR u.is_verification_bypassed = true OR u.notary_verification_bypassed = true THEN 1 END) as verified_participants,
        COUNT(CASE WHEN jp.role = 'signer' THEN 1 END) as signer_count,
        COUNT(CASE WHEN jp.role = 'witness' THEN 1 END) as witness_count
      FROM jobs j
      LEFT JOIN job_participants jp ON j.id = jp.job_id AND jp.role IN ('signer', 'witness')
      LEFT JOIN users u ON jp.user_id = u.id
      WHERE j.notary_id = ${notaryId}
      AND j.job_status IN ('open', 'pending')
      GROUP BY j.id
      ORDER BY j.created_at DESC
    `);

    res.json(assignedJobs.rows);
  } catch (error) {
    console.error('Error fetching assigned jobs:', error);
    res.status(500).json({ error: 'Failed to fetch assigned jobs' });
  }
});

/**
 * POST /api/notary/bypass-verification/:userId/:jobId
 * Bypass verification for a participant (notary can only bypass for their job participants)
 */
router.post('/bypass-verification/:userId/:jobId', verifyToken, requireNotaryOrAdmin, async (req: any, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const jobId = parseInt(req.params.jobId);
    const { reason } = req.body;
    const notaryId = req.user.id;

    if (isNaN(userId) || isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid user ID or job ID' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required for bypassing verification' });
    }

    // Check if notary can bypass verification for this participant
    const canBypass = await db.execute(sql`
      SELECT can_notary_bypass_verification(${notaryId}, ${userId}, ${jobId}) as can_bypass
    `);

    if (!canBypass.rows[0]?.can_bypass && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to bypass verification for this participant' });
    }

    // Check if user is a participant in this job
    const participant = await db
      .select()
      .from(jobParticipants)
      .where(and(
        eq(jobParticipants.jobId, jobId),
        eq(jobParticipants.userId, userId),
        or(eq(jobParticipants.role, 'signer'), eq(jobParticipants.role, 'witness'))
      ))
      .limit(1);

    if (participant.length === 0) {
      return res.status(404).json({ error: 'Participant not found in this job' });
    }

    // Get current verification status for logging
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const previousStatus = user[0].verificationStatus;

    // Update user verification status with notary bypass
    await db
      .update(users)
      .set({
        isVerified: true,
        verificationStatus: 'approved',
        notaryVerificationBypassed: true,
        notaryVerificationBypassedBy: notaryId,
        notaryVerificationBypassedAt: new Date(),
        notaryVerificationBypassJobId: jobId,
        notaryVerificationBypassReason: reason.trim(),
      })
      .where(eq(users.id, userId));

    // Log the bypass action
    await db.execute(sql`
      INSERT INTO notary_verification_bypass_log (
        job_id,
        participant_id,
        notary_id,
        action,
        reason,
        previous_verification_status
      ) VALUES (
        ${jobId},
        ${userId},
        ${notaryId},
        'bypass',
        ${reason.trim()},
        ${previousStatus}
      )
    `);

    res.json({ 
      success: true, 
      message: 'Verification bypassed successfully',
      participantName: user[0].fullName || user[0].username,
      jobId
    });
  } catch (error) {
    console.error('Error bypassing verification:', error);
    res.status(500).json({ error: 'Failed to bypass verification' });
  }
});

/**
 * POST /api/notary/remove-bypass/:userId/:jobId
 * Remove notary verification bypass
 */
router.post('/remove-bypass/:userId/:jobId', verifyToken, requireNotaryOrAdmin, async (req: any, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const jobId = parseInt(req.params.jobId);
    const { reason } = req.body;
    const notaryId = req.user.id;

    if (isNaN(userId) || isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid user ID or job ID' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required for removing verification bypass' });
    }

    // Check if user has a notary bypass for this job
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user[0].notaryVerificationBypassed) {
      return res.status(400).json({ error: 'User does not have a notary verification bypass' });
    }

    // Only the notary who bypassed or an admin can remove the bypass
    if (user[0].notaryVerificationBypassedBy !== notaryId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the notary who bypassed or an admin can remove the bypass' });
    }

    // Get current verification status for logging
    const previousStatus = user[0].verificationStatus;

    // Remove notary bypass (keeps admin bypass if exists)
    await db
      .update(users)
      .set({
        notaryVerificationBypassed: false,
        notaryVerificationBypassedBy: null,
        notaryVerificationBypassedAt: null,
        notaryVerificationBypassJobId: null,
        notaryVerificationBypassReason: null,
        // Only reset verification if no admin bypass exists and no EVS verification
        isVerified: user[0].isVerificationBypassed || (user[0].evsTransactionId && user[0].verificationStatus === 'approved') ? true : false,
        verificationStatus: user[0].isVerificationBypassed || (user[0].evsTransactionId && user[0].verificationStatus === 'approved') ? 'approved' : 'pending',
      })
      .where(eq(users.id, userId));

    // Log the bypass removal
    await db.execute(sql`
      INSERT INTO notary_verification_bypass_log (
        job_id,
        participant_id,
        notary_id,
        action,
        reason,
        previous_verification_status
      ) VALUES (
        ${jobId},
        ${userId},
        ${notaryId},
        'remove_bypass',
        ${reason.trim()},
        ${previousStatus}
      )
    `);

    res.json({ 
      success: true, 
      message: 'Verification bypass removed successfully',
      participantName: user[0].fullName || user[0].username,
      jobId
    });
  } catch (error) {
    console.error('Error removing verification bypass:', error);
    res.status(500).json({ error: 'Failed to remove verification bypass' });
  }
});

/**
 * GET /api/notary/bypass-log/:jobId?
 * Get notary verification bypass audit log for specific jobs
 */
router.get('/bypass-log/:jobId?', verifyToken, requireNotaryOrAdmin, async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId ? parseInt(req.params.jobId) : null;
    const notaryId = (req as any).user.id;
    const isAdmin = (req as any).user.role === 'admin';

    let query = sql`
      SELECT 
        nvbl.*,
        u.full_name as participant_name,
        u.email as participant_email,
        notary.full_name as notary_name,
        notary.email as notary_email,
        j.title_company,
        j.closing_type
      FROM notary_verification_bypass_log nvbl
      JOIN users u ON nvbl.participant_id = u.id
      JOIN users notary ON nvbl.notary_id = notary.id
      JOIN jobs j ON nvbl.job_id = j.id
    `;

    // Filter by job if specified
    if (jobId && !isNaN(jobId)) {
      // For notaries, ensure they're assigned to this job
      if (!isAdmin) {
        query = sql`${query} WHERE nvbl.job_id = ${jobId} AND j.notary_id = ${notaryId}`;
      } else {
        query = sql`${query} WHERE nvbl.job_id = ${jobId}`;
      }
    } else if (!isAdmin) {
      // For notaries without specific job, show only their jobs
      query = sql`${query} WHERE j.notary_id = ${notaryId}`;
    }

    query = sql`${query} ORDER BY nvbl.created_at DESC LIMIT 100`;

    const bypassLog = await db.execute(query);

    res.json(bypassLog.rows);
  } catch (error) {
    console.error('Error fetching bypass log:', error);
    res.status(500).json({ error: 'Failed to fetch bypass log' });
  }
});

export default router; 