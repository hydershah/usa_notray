import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { users, jobs, jobParticipants, signers } from '../../shared/schema.js';
import { eq, and, sql, or } from 'drizzle-orm';
import { verifyToken, hasAdminPrivileges, hasNotaryPrivileges } from '../auth.js';

const router = Router();

// Middleware to ensure only notaries and admins can access these routes
const requireNotaryOrAdmin = (req: any, res: Response, next: any) => {
  if (!hasNotaryPrivileges(req.user) && !hasAdminPrivileges(req.user)) {
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
    // Exclude admin and notary users who shouldn't be participants
    const participants = await db.execute(sql`
      SELECT 
        jp.id as participant_id,
        jp.job_id,
        jp.user_id,
        jp.role as participant_role,
        jp.invite_status,
        jp.joined_at,
        jp.email as participant_email,
        jp.created_at as participant_created_at,
        u.username,
        u.first_name,
        u.last_name,
        u.phone_number,
        u.id_type,
        u.id_number,
        u.verification_retry_count,
        u.created_at,
        u.last_login_at,
        u.evs_transaction_id,
        u.evs_verification_confidence,
        u.evs_verified_at,
        u.notary_verification_bypassed_by,
        u.notary_verification_bypassed_at,
        u.notary_verification_bypass_reason,
        bypass_notary.full_name as bypassed_by_notary_name,
        -- Handle participants without user accounts
        CASE 
          WHEN u.id IS NULL THEN FALSE
          ELSE COALESCE(u.is_verified, FALSE)
        END as is_verified,
        CASE 
          WHEN u.id IS NULL THEN 'pending'
          ELSE COALESCE(u.verification_status, 'pending')
        END as verification_status,
        CASE 
          WHEN u.id IS NULL THEN FALSE
          ELSE COALESCE(u.is_verification_bypassed, FALSE)
        END as admin_bypassed,
        CASE 
          WHEN u.id IS NULL THEN FALSE
          ELSE COALESCE(u.notary_verification_bypassed, FALSE)
        END as notary_verification_bypassed,
        CASE 
          WHEN u.id IS NULL THEN jp.email
          ELSE COALESCE(u.email, jp.email)
        END as email,
        CASE 
          WHEN u.id IS NULL THEN SPLIT_PART(jp.email, '@', 1)
          ELSE COALESCE(u.full_name, u.first_name || ' ' || u.last_name, SPLIT_PART(jp.email, '@', 1))
        END as full_name
      FROM job_participants jp
      LEFT JOIN users u ON jp.user_id = u.id
      LEFT JOIN users bypass_notary ON u.notary_verification_bypassed_by = bypass_notary.id
      WHERE jp.job_id = ${jobId}
      AND jp.role IN ('signer', 'witness')
      -- Exclude admin and notary users who shouldn't be participants
      AND (u.id IS NULL OR u.role NOT IN ('admin', 'notary'))
      ORDER BY jp.role, 
               CASE 
                 WHEN u.id IS NULL THEN SPLIT_PART(jp.email, '@', 1)
                 ELSE COALESCE(u.full_name, u.first_name || ' ' || u.last_name, SPLIT_PART(jp.email, '@', 1))
               END
    `);

    res.json(participants.rows);
  } catch (error) {
    console.error('Error fetching job participants:', error);
    res.status(500).json({ error: 'Failed to fetch job participants' });
  }
});

/**
 * POST /api/notary/revoke-kyc/:userId/:jobId
 * Revoke KYC/EVS verification for a participant (reset their verification status)
 */
router.post('/revoke-kyc/:userId/:jobId', verifyToken, requireNotaryOrAdmin, async (req: any, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const jobId = parseInt(req.params.jobId);
    const { reason } = req.body;
    const notaryId = req.user.id;

    if (isNaN(userId) || isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid user ID or job ID' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required for revoking KYC verification' });
    }

    // Check if notary can revoke verification for this participant
    const canRevoke = await db.execute(sql`
      SELECT can_notary_bypass_verification(${notaryId}, ${userId}, ${jobId}) as can_revoke
    `);

    if (!canRevoke.rows[0]?.can_revoke && !hasAdminPrivileges(req.user)) {
      return res.status(403).json({ error: 'You do not have permission to revoke KYC verification for this participant' });
    }

    // Check if user is a participant in this job (check both job_participants and signers tables)
    let participant = await db
      .select()
      .from(jobParticipants)
      .where(and(
        eq(jobParticipants.jobId, jobId),
        eq(jobParticipants.userId, userId),
        or(eq(jobParticipants.role, 'signer'), eq(jobParticipants.role, 'witness'))
      ))
      .limit(1);

    // If not found in job_participants, check signers table
    if (participant.length === 0) {
      const signer = await db
        .select()
        .from(signers)
        .where(and(
          eq(signers.jobId, jobId),
          eq(signers.userId, userId)
        ))
        .limit(1);

      if (signer.length === 0) {
        return res.status(404).json({ error: 'Participant not found in this job' });
      }
      
      // Create a participant-like object for compatibility
      participant = [{
        id: signer[0].id,
        jobId: jobId,
        userId: userId,
        email: signer[0].signerEmail,
        role: 'signer',
        inviteStatus: 'accepted',
        inviteToken: signer[0].invitationToken,
        joinedAt: signer[0].createdAt,
        createdAt: signer[0].createdAt
      }];
    }

    // Get user to check current verification status
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has KYC verification to revoke
    if (!user[0].evsTransactionId && !user[0].evsVerifiedAt) {
      return res.status(400).json({ error: 'User does not have KYC verification to revoke' });
    }

    const previousStatus = user[0].verificationStatus;

    // Revoke KYC verification (reset EVS fields and verification status)
    await db
      .update(users)
      .set({
        isVerified: false,
        verificationStatus: 'pending',
        // Reset EVS fields
        evsTransactionId: null,
        evsVerificationConfidence: null,
        evsVerifiedAt: null,
        evsExtractedFirstName: null,
        evsExtractedLastName: null,
        evsExtractedDateOfBirth: null,
        evsFaceMatchResult: null,
        evsFaceMatchConfidence: null,
        evsLivenessScore: null,
        // Reset verification images
        verificationImageFrontUrl: null,
        verificationImageBackUrl: null,
        verificationImageSelfieUrl: null,
        // Keep admin/notary bypasses if they exist (those are separate from KYC)
        // Reset verification retry count to allow new attempts
        verificationRetryCount: 0,
      })
      .where(eq(users.id, userId));

    // Log the KYC revocation
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
        'revoke_kyc',
        ${reason.trim()},
        ${previousStatus}
      )
    `);

    res.json({ 
      success: true, 
      message: 'KYC verification revoked successfully',
      participantName: user[0].fullName || user[0].username,
      jobId
    });
  } catch (error) {
    console.error('Error revoking KYC verification:', error);
    res.status(500).json({ error: 'Failed to revoke KYC verification' });
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
        END) as witness_count
      FROM jobs j
      LEFT JOIN job_participants jp ON j.id = jp.job_id
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

    if (!canBypass.rows[0]?.can_bypass && !hasAdminPrivileges(req.user)) {
      return res.status(403).json({ error: 'You do not have permission to bypass verification for this participant' });
    }

    // Check if user is a participant in this job (check both job_participants and signers tables)
    let participant = await db
      .select()
      .from(jobParticipants)
      .where(and(
        eq(jobParticipants.jobId, jobId),
        eq(jobParticipants.userId, userId),
        or(eq(jobParticipants.role, 'signer'), eq(jobParticipants.role, 'witness'))
      ))
      .limit(1);

    // If not found in job_participants, check signers table
    if (participant.length === 0) {
      const signer = await db
        .select()
        .from(signers)
        .where(and(
          eq(signers.jobId, jobId),
          eq(signers.userId, userId)
        ))
        .limit(1);

      if (signer.length === 0) {
        return res.status(404).json({ error: 'Participant not found in this job' });
      }
      
      // Create a participant-like object for compatibility
      participant = [{
        id: signer[0].id,
        jobId: jobId,
        userId: userId,
        email: signer[0].signerEmail,
        role: 'signer',
        inviteStatus: 'accepted',
        inviteToken: signer[0].invitationToken,
        joinedAt: signer[0].createdAt,
        createdAt: signer[0].createdAt
      }];
    }

    // Check if participant has a user account (should always have one since we found by userId)
    if (!participant[0].userId) {
      return res.status(400).json({ error: 'Participant must have a user account before verification can be bypassed. Please ensure they have registered and joined the job.' });
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

    // Also check if this user is a participant in the job (check both job_participants and signers tables)
    let participant = await db
      .select()
      .from(jobParticipants)
      .where(and(
        eq(jobParticipants.jobId, jobId),
        eq(jobParticipants.userId, userId),
        or(eq(jobParticipants.role, 'signer'), eq(jobParticipants.role, 'witness'))
      ))
      .limit(1);

    // If not found in job_participants, check signers table
    if (participant.length === 0) {
      const signer = await db
        .select()
        .from(signers)
        .where(and(
          eq(signers.jobId, jobId),
          eq(signers.userId, userId)
        ))
        .limit(1);

      if (signer.length === 0) {
        return res.status(404).json({ error: 'Participant not found in this job' });
      }
      
      // Create a participant-like object for compatibility
      participant = [{
        id: signer[0].id,
        jobId: jobId,
        userId: userId,
        email: signer[0].signerEmail,
        role: 'signer',
        inviteStatus: 'accepted',
        inviteToken: signer[0].invitationToken,
        joinedAt: signer[0].createdAt,
        createdAt: signer[0].createdAt
      }];
    }

    if (!user[0].notaryVerificationBypassed) {
      return res.status(400).json({ error: 'User does not have a notary verification bypass' });
    }

    // Only the notary who bypassed or an admin can remove the bypass
    if (user[0].notaryVerificationBypassedBy !== notaryId && !hasAdminPrivileges(req.user)) {
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
    const isAdmin = hasAdminPrivileges((req as any).user);

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

/**
 * GET /api/notary/job-participants/:jobId/verification-documents
 * Get verification documents for all participants in a job (notary-specific)
 */
router.get('/job-participants/:jobId/verification-documents', verifyToken, requireNotaryOrAdmin, async (req: any, res: Response) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const notaryId = req.user.id;

    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    // Check if this notary is assigned to this job (or if admin)
    if (!hasAdminPrivileges(req.user)) {
      const job = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.notaryId, notaryId)))
        .limit(1);

      if (job.length === 0) {
        return res.status(403).json({ error: 'You are not assigned to this job' });
      }
    }

    // Get all participants with their verification documents
    const participants = await db.execute(sql`
      SELECT 
        jp.id as participant_id,
        jp.user_id,
        jp.role as participant_role,
        jp.signer_name,
        jp.signer_email,
        jp.signer_phone_number,
        -- User verification data
        u.id as user_id,
        u.username,
        u.email,
        u.full_name,
        u.first_name,
        u.last_name,
        u.is_verified,
        u.verification_status,
        u.is_verification_bypassed,
        u.notary_verification_bypassed,
        u.verification_bypassed_at,
        u.verification_bypass_reason,
        u.notary_verification_bypassed_at,
        u.notary_verification_bypass_reason,
        u.notary_verification_bypassed_by,
        bypass_admin.full_name as bypassed_by_admin_name,
        notary_bypassed.full_name as bypassed_by_notary_name,
        -- EVS verification data
        u.evs_transaction_id,
        u.evs_verification_confidence,
        u.evs_verified_at,
        u.evs_extracted_first_name,
        u.evs_extracted_last_name,
        u.evs_extracted_date_of_birth,
        u.id_type,
        u.id_number,
        u.id_expiration_date,
        u.evs_face_match_result,
        u.evs_face_match_confidence,
        u.evs_liveness_score,
        u.verification_retry_count,
        u.kba_verified,
        u.kba_verification_date,
        u.kba_score,
        -- Verification image URLs
        u.verification_image_front_url,
        u.verification_image_back_url,
        u.verification_image_selfie_url
      FROM job_participants jp
      LEFT JOIN users u ON jp.user_id = u.id
      LEFT JOIN users bypass_admin ON u.verification_bypassed_by = bypass_admin.id
      LEFT JOIN users notary_bypassed ON u.notary_verification_bypassed_by = notary_bypassed.id
      WHERE jp.job_id = ${jobId}
      AND jp.role IN ('signer', 'witness')
      ORDER BY jp.role, jp.signer_name
    `);

    res.json(participants.rows);
  } catch (error) {
    console.error('Error fetching job participants verification documents:', error);
    res.status(500).json({ error: 'Failed to fetch participants verification documents' });
  }
});

/**
 * GET /api/notary/participant/:userId/verification-documents/:jobId
 * Get detailed verification documents for a specific participant
 */
router.get('/participant/:userId/verification-documents/:jobId', verifyToken, requireNotaryOrAdmin, async (req: any, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const jobId = parseInt(req.params.jobId);
    const notaryId = req.user.id;

    if (isNaN(userId) || isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid user ID or job ID' });
    }

    // Check if this notary is assigned to this job (or if admin)
    if (!hasAdminPrivileges(req.user)) {
      const job = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.notaryId, notaryId)))
        .limit(1);

      if (job.length === 0) {
        return res.status(403).json({ error: 'You are not assigned to this job' });
      }
    }

    // Check if user is a participant in this job (check both job_participants and signers tables)
    let participant = await db
      .select()
      .from(jobParticipants)
      .where(and(
        eq(jobParticipants.jobId, jobId),
        eq(jobParticipants.userId, userId),
        or(eq(jobParticipants.role, 'signer'), eq(jobParticipants.role, 'witness'))
      ))
      .limit(1);

    // If not found in job_participants, check signers table
    if (participant.length === 0) {
      const signer = await db
        .select()
        .from(signers)
        .where(and(
          eq(signers.jobId, jobId),
          eq(signers.userId, userId)
        ))
        .limit(1);

      if (signer.length === 0) {
        return res.status(404).json({ error: 'Participant not found in this job' });
      }
      
      // Create a participant-like object for compatibility
      participant = [{
        id: signer[0].id,
        jobId: jobId,
        userId: userId,
        email: signer[0].signerEmail,
        role: 'signer',
        inviteStatus: 'accepted',
        inviteToken: signer[0].invitationToken,
        joinedAt: signer[0].createdAt,
        createdAt: signer[0].createdAt
      }];
    }

    // Get comprehensive verification data
    const verificationData = await db.execute(sql`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.full_name,
        u.role,
        u.phone_number,
        u.is_verified,
        u.verification_status,
        u.is_verification_bypassed,
        u.notary_verification_bypassed,
        u.verification_bypassed_at,
        u.verification_bypass_reason,
        u.notary_verification_bypassed_at,
        u.notary_verification_bypass_reason,
        u.notary_verification_bypassed_by,
        u.notary_verification_bypassed_job_id,
        bypass_admin.full_name as bypassed_by_admin_name,
        notary_bypassed.full_name as bypassed_by_notary_name,
        u.evs_transaction_id,
        u.evs_verification_confidence,
        u.evs_verified_at,
        u.evs_extracted_first_name,
        u.evs_extracted_last_name,
        u.evs_extracted_date_of_birth,
        u.id_type,
        u.id_number,
        u.id_expiration_date,
        u.evs_face_match_result,
        u.evs_face_match_confidence,
        u.evs_liveness_score,
        u.verification_retry_count,
        u.created_at,
        u.last_login_at,
        u.is_active,
        u.kba_verified,
        u.kba_verification_date,
        u.kba_score,
        u.verification_image_front_url,
        u.verification_image_back_url,
        u.verification_image_selfie_url,
        u.verification_ip_address,
        u.verification_user_agent
      FROM users u
      LEFT JOIN users bypass_admin ON u.verification_bypassed_by = bypass_admin.id
      LEFT JOIN users notary_bypassed ON u.notary_verification_bypassed_by = notary_bypassed.id
      WHERE u.id = ${userId}
    `);

    if (verificationData.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get verification attempts history
    const verificationAttempts = await db.execute(sql`
      SELECT 
        uva.id,
        uva.attempted_at,
        uva.status,
        uva.confidence_score,
        uva.processing_time_ms,
        uva.errors,
        uva.warnings,
        uva.ip_address,
        uva.user_agent,
        uva.api_environment,
        uva.document_type,
        uva.front_image_uploaded,
        uva.back_image_uploaded,
        uva.selfie_uploaded
      FROM user_verification_attempts uva
      WHERE uva.user_id = ${userId}
      ORDER BY uva.attempted_at DESC
      LIMIT 10
    `);

    res.json({
      user: verificationData.rows[0],
      attempts: verificationAttempts.rows,
      jobId: jobId,
      participantRole: participant[0].role
    });
  } catch (error) {
    console.error('Error fetching participant verification documents:', error);
    res.status(500).json({ error: 'Failed to fetch participant verification documents' });
  }
});

/**
 * GET /api/notary/participant/:userId/verification-image/:imageType/:jobId
 * Get verification image with proper authorization for notaries
 */
router.get('/participant/:userId/verification-image/:imageType/:jobId', verifyToken, requireNotaryOrAdmin, async (req: any, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const imageType = req.params.imageType;
    const jobId = parseInt(req.params.jobId);
    const notaryId = req.user.id;

    if (isNaN(userId) || isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid user ID or job ID' });
    }

    if (!['front', 'back', 'selfie'].includes(imageType)) {
      return res.status(400).json({ error: 'Invalid image type' });
    }

    // Check if this notary is assigned to this job (or if admin)
    if (!hasAdminPrivileges(req.user)) {
      const job = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.notaryId, notaryId)))
        .limit(1);

      if (job.length === 0) {
        return res.status(403).json({ error: 'You are not assigned to this job' });
      }
    }

    // Check if user is a participant in this job (check both job_participants and signers tables)
    let participant = await db
      .select()
      .from(jobParticipants)
      .where(and(
        eq(jobParticipants.jobId, jobId),
        eq(jobParticipants.userId, userId),
        or(eq(jobParticipants.role, 'signer'), eq(jobParticipants.role, 'witness'))
      ))
      .limit(1);

    // If not found in job_participants, check signers table
    if (participant.length === 0) {
      const signer = await db
        .select()
        .from(signers)
        .where(and(
          eq(signers.jobId, jobId),
          eq(signers.userId, userId)
        ))
        .limit(1);

      if (signer.length === 0) {
        return res.status(404).json({ error: 'Participant not found in this job' });
      }
      
      // Create a participant-like object for compatibility
      participant = [{
        id: signer[0].id,
        jobId: jobId,
        userId: userId,
        email: signer[0].signerEmail,
        role: 'signer',
        inviteStatus: 'accepted',
        inviteToken: signer[0].invitationToken,
        joinedAt: signer[0].createdAt,
        createdAt: signer[0].createdAt
      }];
    }

    // Get user's verification image URLs
    const user = await db.execute(sql`
      SELECT 
        verification_image_front_url,
        verification_image_back_url,
        verification_image_selfie_url
      FROM users 
      WHERE id = ${userId}
    `);

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = user.rows[0];
    let imageKey;

    switch (imageType) {
      case 'front':
        imageKey = userData.verification_image_front_url;
        break;
      case 'back':
        imageKey = userData.verification_image_back_url;
        break;
      case 'selfie':
        imageKey = userData.verification_image_selfie_url;
        break;
    }

    if (!imageKey) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Generate signed URL for secure access
    const { VultrUploadHandler } = await import('../vultr-upload-handler');
    const signedUrl = await VultrUploadHandler.generateSignedUrl(imageKey);

    if (!signedUrl) {
      return res.status(500).json({ error: 'Failed to generate secure image URL' });
    }

    res.json({
      imageUrl: signedUrl,
      imageKey: imageKey,
      expiresIn: 3600 // 1 hour
    });

  } catch (error) {
    console.error('Error fetching verification image:', error);
    res.status(500).json({ error: 'Failed to fetch verification image' });
  }
});

export default router; 