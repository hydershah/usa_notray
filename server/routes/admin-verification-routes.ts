import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users, userVerificationAttempts } from '../../shared/schema';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { verifyToken } from '../auth';

const router = Router();

// Middleware to ensure only admins can access these routes
const requireAdmin = (req: any, res: Response, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Get all users requiring verification (notary, signer, witness)
router.get('/verification-users', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const verificationUsers = await db.execute(sql`
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
        u.verification_bypassed_at,
        u.verification_bypass_reason,
        bypass_admin.full_name as bypassed_by_admin,
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
        -- Count of verification attempts
        (SELECT COUNT(*) FROM user_verification_attempts uva WHERE uva.user_id = u.id) as total_verification_attempts,
        -- Latest verification attempt
        (SELECT attempted_at FROM user_verification_attempts uva WHERE uva.user_id = u.id ORDER BY attempted_at DESC LIMIT 1) as latest_verification_attempt
      FROM users u
      LEFT JOIN users bypass_admin ON u.verification_bypassed_by = bypass_admin.id
      WHERE u.role IN ('notary', 'signer', 'witness')
      ORDER BY u.created_at DESC
    `);

    res.json(verificationUsers.rows);
  } catch (error) {
    console.error('Error fetching verification users:', error);
    res.status(500).json({ error: 'Failed to fetch verification users' });
  }
});

// Get verification attempts for a specific user
router.get('/verification-attempts/:userId', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const attempts = await db
      .select()
      .from(userVerificationAttempts)
      .where(eq(userVerificationAttempts.userId, userId))
      .orderBy(userVerificationAttempts.attemptedAt);

    res.json(attempts);
  } catch (error) {
    console.error('Error fetching verification attempts:', error);
    res.status(500).json({ error: 'Failed to fetch verification attempts' });
  }
});

// Get verification data for a specific user (frontend expects this path)
router.get('/users/:userId/verification-data', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const userData = await db.execute(sql`
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
        u.verification_bypassed_at,
        u.verification_bypass_reason,
        bypass_admin.full_name as bypassed_by_admin,
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
        u.kba_score
      FROM users u
      LEFT JOIN users bypass_admin ON u.verification_bypassed_by = bypass_admin.id
      WHERE u.id = ${userId}
    `);

    if (userData.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userData.rows[0]);
  } catch (error) {
    console.error('Error fetching user verification data:', error);
    res.status(500).json({ error: 'Failed to fetch user verification data' });
  }
});

// Get verification attempts for a specific user (frontend expects this path)
router.get('/users/:userId/verification-attempts', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const attempts = await db
      .select()
      .from(userVerificationAttempts)
      .where(eq(userVerificationAttempts.userId, userId))
      .orderBy(userVerificationAttempts.attemptedAt);

    res.json(attempts);
  } catch (error) {
    console.error('Error fetching verification attempts:', error);
    res.status(500).json({ error: 'Failed to fetch verification attempts' });
  }
});

// Bypass verification for a user
router.post('/bypass-verification/:userId', verifyToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const { reason } = req.body;
    const adminId = req.user.id;

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required for bypassing verification' });
    }

    // Check if user exists and has the right role
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!['notary', 'signer', 'witness'].includes(user[0].role)) {
      return res.status(400).json({ error: 'User role does not require verification' });
    }

    // Get current verification status for logging
    const previousStatus = user[0].verificationStatus;

    // Update user verification status with bypass
    await db
      .update(users)
      .set({
        isVerified: true,
        verificationStatus: 'approved',
        isVerificationBypassed: true,
        verificationBypassedBy: adminId,
        verificationBypassedAt: new Date(),
        verificationBypassReason: reason.trim(),
      })
      .where(eq(users.id, userId));

    // Log the bypass action (you can create a separate table for audit logs)
    await db.execute(sql`
      INSERT INTO verification_bypass_log (
        user_id, 
        admin_id, 
        action, 
        reason, 
        previous_verification_status,
        new_verification_status
      ) VALUES (
        ${userId},
        ${adminId},
        'bypass',
        ${reason.trim()},
        ${previousStatus},
        'approved'
      )
    `);

    res.json({ success: true, message: 'Verification bypassed successfully' });
  } catch (error) {
    console.error('Error bypassing verification:', error);
    res.status(500).json({ error: 'Failed to bypass verification' });
  }
});

// Remove verification bypass for a user
router.post('/remove-bypass/:userId', verifyToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const { reason } = req.body;
    const adminId = req.user.id;

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required for removing verification bypass' });
    }

    // Check if user exists and is currently bypassed
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user[0].isVerificationBypassed) {
      return res.status(400).json({ error: 'User does not have a verification bypass to remove' });
    }

    // Get current verification status for logging
    const previousStatus = user[0].verificationStatus;

    // Remove bypass and reset verification status
    await db
      .update(users)
      .set({
        isVerified: false,
        verificationStatus: 'pending',
        isVerificationBypassed: false,
        verificationBypassedBy: null,
        verificationBypassedAt: null,
        verificationBypassReason: null,
      })
      .where(eq(users.id, userId));

    // Log the bypass removal action
    await db.execute(sql`
      INSERT INTO verification_bypass_log (
        user_id, 
        admin_id, 
        action, 
        reason, 
        previous_verification_status,
        new_verification_status
      ) VALUES (
        ${userId},
        ${adminId},
        'remove_bypass',
        ${reason.trim()},
        ${previousStatus},
        'pending'
      )
    `);

    res.json({ success: true, message: 'Verification bypass removed successfully' });
  } catch (error) {
    console.error('Error removing verification bypass:', error);
    res.status(500).json({ error: 'Failed to remove verification bypass' });
  }
});

// Get verification bypass audit log
router.get('/bypass-log', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const bypassLog = await db.execute(sql`
      SELECT 
        vbl.*,
        u.full_name as user_name,
        u.email as user_email,
        admin.full_name as admin_name,
        admin.email as admin_email
      FROM verification_bypass_log vbl
      JOIN users u ON vbl.user_id = u.id
      JOIN users admin ON vbl.admin_id = admin.id
      ORDER BY vbl.created_at DESC
      LIMIT 100
    `);

    res.json(bypassLog.rows);
  } catch (error) {
    console.error('Error fetching bypass log:', error);
    res.status(500).json({ error: 'Failed to fetch bypass log' });
  }
});

// Get verification statistics
router.get('/verification-stats', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_users,
        COUNT(CASE WHEN is_verification_bypassed = true THEN 1 END) as bypassed_users,
        COUNT(CASE WHEN verification_status = 'pending' THEN 1 END) as pending_users,
        COUNT(CASE WHEN verification_status = 'denied' THEN 1 END) as denied_users,
        COUNT(CASE WHEN verification_status = 'review' THEN 1 END) as review_users,
        COUNT(CASE WHEN role = 'notary' THEN 1 END) as notary_users,
        COUNT(CASE WHEN role = 'signer' THEN 1 END) as signer_users,
        COUNT(CASE WHEN role = 'witness' THEN 1 END) as witness_users
      FROM users 
      WHERE role IN ('notary', 'signer', 'witness')
    `);

    const attemptStats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as successful_attempts,
        COUNT(CASE WHEN status = 'denied' THEN 1 END) as failed_attempts,
        AVG(confidence_score) as avg_confidence_score,
        AVG(processing_time_ms) as avg_processing_time
      FROM user_verification_attempts
    `);

    res.json({
      users: stats.rows[0],
      attempts: attemptStats.rows[0]
    });
  } catch (error) {
    console.error('Error fetching verification stats:', error);
    res.status(500).json({ error: 'Failed to fetch verification statistics' });
  }
});

export default router; 