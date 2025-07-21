import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users, userVerificationAttempts } from '../../shared/schema';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { verifyToken, hasAdminPrivileges } from '../auth';

const router = Router();

// Middleware to ensure only admins can access these routes
const requireAdmin = (req: any, res: Response, next: any) => {
  if (!hasAdminPrivileges(req.user)) {
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
        u.kba_score,
        u.verification_image_front_url,
        u.verification_image_back_url,
        u.verification_image_selfie_url
      FROM users u
      LEFT JOIN users bypass_admin ON u.verification_bypassed_by = bypass_admin.id
      WHERE u.id = ${userId}
    `);

    if (userData.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userInfo = userData.rows[0];
    
    // Add certificate information for signers and witnesses
    let certificateInfo = null;
    if (['signer', 'witness'].includes(userInfo.role)) {
      try {
        const { selfSignedCertificateService } = await import('../services/self-signed-certificate-service');
        const certificate = await selfSignedCertificateService.getUserCertificate(userId);
        
        if (certificate) {
          const isExpired = new Date() > new Date(certificate.expires_at);
          certificateInfo = {
            hasCertificate: true,
            certificateId: certificate.certificate_id,
            commonName: certificate.common_name,
            issuedAt: certificate.issued_at,
            expiresAt: certificate.expires_at,
            status: certificate.status,
            isExpired,
            certificateType: 'self-signed',
            downloadUrl: `/api/admin/users/${userId}/certificate/download`
          };
        } else {
          certificateInfo = {
            hasCertificate: false,
            eligibleForGeneration: userInfo.is_verified || userInfo.is_verification_bypassed,
            reason: (userInfo.is_verified || userInfo.is_verification_bypassed) 
              ? 'User is verified but no certificate generated yet' 
              : 'User must complete ID verification first'
          };
        }
      } catch (error) {
        console.error('Error getting certificate info:', error);
        certificateInfo = {
          hasCertificate: false,
          error: 'Failed to load certificate information'
        };
      }
    }

    res.json({
      ...userInfo,
      selfSignedCertificate: certificateInfo
    });
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

    // TODO: Log the bypass action (verification_bypass_log table needs to be created)
    console.log(`Admin ${adminId} bypassed verification for user ${userId}:`, {
      reason: reason.trim(),
      previousStatus,
      newStatus: 'approved'
    });

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

    // TODO: Log the bypass removal action (verification_bypass_log table needs to be created)
    console.log(`Admin ${adminId} removed verification bypass for user ${userId}:`, {
      reason: reason.trim(),
      previousStatus,
      newStatus: 'pending'
    });

    res.json({ success: true, message: 'Verification bypass removed successfully' });
  } catch (error) {
    console.error('Error removing verification bypass:', error);
    res.status(500).json({ error: 'Failed to remove verification bypass' });
  }
});

// Revoke KYC/EVS verification for a user (admin version)
router.post('/revoke-kyc/:userId', verifyToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const { reason } = req.body;
    const adminId = req.user.id;

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required for revoking KYC verification' });
    }

    // Check if user exists
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

    // TODO: Log the KYC revocation action (admin_audit_log table needs to be created)
    console.log(`Admin ${adminId} revoked KYC verification for user ${userId}:`, {
      reason: reason.trim(),
      previousStatus,
      newStatus: 'pending'
    });

    res.json({ 
      success: true, 
      message: 'KYC verification revoked successfully',
      userName: user[0].fullName || user[0].username
    });
  } catch (error) {
    console.error('Error revoking KYC verification:', error);
    res.status(500).json({ error: 'Failed to revoke KYC verification' });
  }
});

// Get verification bypass audit log
router.get('/bypass-log', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // TODO: Implement after creating verification_bypass_log table
    res.json([]);
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

// Get verification image with proper authentication
router.get('/users/:userId/verification-image/:imageType', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const imageType = req.params.imageType;
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    if (!['front', 'back', 'selfie'].includes(imageType)) {
      return res.status(400).json({ error: 'Invalid image type' });
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

// Export a registration function to match the pattern used by other routes
export function registerAdminVerificationRoutes(app: any) {
  app.use('/api/admin', router);
}

export default router; 