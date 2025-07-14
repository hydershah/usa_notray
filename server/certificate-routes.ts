import { Router, Request, Response } from 'express';
import { certificateService } from './certificate-service';
import { verifyToken } from './auth';
import { createReadStream } from 'fs';
import { basename } from 'path';

const router = Router();

// Initialize certificate service on startup
certificateService.initialize().catch(console.error);

/**
 * Generate certificate for a notary user
 * POST /api/certificates/generate/:userId
 */
router.post('/generate/:userId', verifyToken, async (req: any, res: Response) => {
  try {
    // Only admins can generate certificates for other users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin access required.'
      });
    }

    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    const result = await certificateService.generateNotaryCertificate(userId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Certificate generated successfully',
        certificateId: result.certificateId,
        downloadUrl: `/api/certificates/download/${userId}`,
        password: result.p12Password
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Error generating certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate certificate'
    });
  }
});

/**
 * Generate certificate for current user (self-service for approved notaries)
 * POST /api/certificates/generate-self
 */
router.post('/generate-self', verifyToken, async (req: any, res: Response) => {
  try {
    // Only notaries can generate their own certificates
    if (req.user.role !== 'notary') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only notaries can generate certificates.'
      });
    }

    const userId = req.user.id;
    
    // Check if user is approved (import storage directly)
    const { storage } = await import('./storage');
    const user = await storage.getUserById(userId);
    if (!user || user.approvalStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'Certificate generation is only available for approved notaries'
      });
    }

    const result = await certificateService.generateNotaryCertificate(userId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Certificate generated successfully',
        certificateId: result.certificateId,
        downloadUrl: `/api/certificates/download/${userId}`,
        password: result.p12Password
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Error generating certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate certificate'
    });
  }
});

/**
 * Generate certificate for a verified signer/witness user
 * POST /api/certificates/generate-signer/:userId
 */
router.post('/generate-signer/:userId', verifyToken, async (req: any, res: Response) => {
  try {
    const requestedUserId = parseInt(req.params.userId);
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;
    
    if (isNaN(requestedUserId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    // Authorization: Users can generate their own certificates, admins can generate for anyone
    if (requestedUserId !== currentUserId && currentUserRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only generate certificates for yourself.'
      });
    }

    const result = await certificateService.generateSignerCertificate(requestedUserId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Certificate generated successfully',
        certificateId: result.certificateId,
        downloadUrl: `/api/certificates/download/${requestedUserId}`,
        password: result.p12Password
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Error generating signer certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate certificate'
    });
  }
});

/**
 * Generate certificate for current verified signer/witness (self-service)
 * POST /api/certificates/generate-signer-self
 */
router.post('/generate-signer-self', verifyToken, async (req: any, res: Response) => {
  try {
    // Only verified signers and witnesses can generate their own certificates
    if (!['signer', 'witness'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only signers and witnesses can generate certificates.'
      });
    }

    const userId = req.user.id;
    
    // Check if user is verified (import storage directly)
    const { storage } = await import('./storage');
    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.isVerified && !user.isVerificationBypassed && !user.notaryVerificationBypassed) {
      return res.status(403).json({
        success: false,
        error: 'Certificate generation is only available for verified users. Please complete ID verification first.'
      });
    }

    const result = await certificateService.generateSignerCertificate(userId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Certificate generated successfully',
        certificateId: result.certificateId,
        downloadUrl: `/api/certificates/download/${userId}`,
        password: result.p12Password,
        userRole: user.role
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Error generating signer certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate certificate'
    });
  }
});

/**
 * Universal certificate generation - supports all user types
 * POST /api/certificates/generate-universal/:userId
 */
router.post('/generate-universal/:userId', verifyToken, async (req: any, res: Response) => {
  try {
    // Only admins can use universal generation for other users
    const requestedUserId = parseInt(req.params.userId);
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;
    
    if (isNaN(requestedUserId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    // Authorization: Users can generate their own certificates, admins can generate for anyone
    if (requestedUserId !== currentUserId && currentUserRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only generate certificates for yourself.'
      });
    }

    const result = await certificateService.generateUserCertificate(requestedUserId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Certificate generated successfully',
        certificateId: result.certificateId,
        downloadUrl: `/api/certificates/download/${requestedUserId}`,
        password: result.p12Password
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Error generating universal certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate certificate'
    });
  }
});

/**
 * Validate user certificate
 * GET /api/certificates/validate/:userId
 */
router.get('/validate/:userId', verifyToken, async (req: any, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const currentUserId = req.user.id;
    const userRole = req.user.role;
    
    // Allow users to validate their own certificates or admins to validate any
    if (userId !== currentUserId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const result = await certificateService.validateUserCertificate(userId);
    res.json(result);

  } catch (error) {
    console.error('Error validating certificate:', error);
    res.status(500).json({
      valid: false,
      error: 'Failed to validate certificate'
    });
  }
});

/**
 * Download certificate file
 * GET /api/certificates/download/:userId
 */
router.get('/download/:userId', verifyToken, async (req: any, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const currentUserId = req.user.id;
    const userRole = req.user.role;
    const fileType = req.query.type as 'p12' | 'pem' || 'p12';
    
    // Allow users to download their own certificates or admins to download any
    if (userId !== currentUserId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const result = await certificateService.getCertificateFile(userId, fileType);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    // Set appropriate headers for file download
    const fileName = `notary-certificate-${userId}.${fileType}`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', fileType === 'p12' ? 'application/x-pkcs12' : 'application/x-pem-file');
    
    // Include password in response headers for P12 files
    if (fileType === 'p12' && result.password) {
      res.setHeader('X-Certificate-Password', result.password);
    }

    // Stream the file
    const fileStream = createReadStream(result.filePath!);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error downloading certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download certificate'
    });
  }
});

/**
 * Revoke certificate
 * POST /api/certificates/revoke/:userId
 */
router.post('/revoke/:userId', verifyToken, async (req: any, res: Response) => {
  try {
    // Only admins can revoke certificates
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin access required.'
      });
    }

    const userId = parseInt(req.params.userId);
    const { reason } = req.body;
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    const result = await certificateService.revokeCertificate(userId, reason);
    res.json(result);

  } catch (error) {
    console.error('Error revoking certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke certificate'
    });
  }
});

/**
 * Get certificate statistics (Admin only)
 * GET /api/certificates/stats
 */
router.get('/stats', verifyToken, async (req: any, res: Response) => {
  try {
    // Only admins can view certificate statistics
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin access required.'
      });
    }

    const stats = await certificateService.getCertificateStats();
    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting certificate stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get certificate statistics'
    });
  }
});

/**
 * Check all certificates for expiry (Admin only)
 * POST /api/certificates/check-expiry
 */
router.post('/check-expiry', verifyToken, async (req: any, res: Response) => {
  try {
    // Only admins can check certificate expiry
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin access required.'
      });
    }

    const result = await certificateService.checkAllCertificatesExpiry();
    res.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Error checking certificate expiry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check certificate expiry'
    });
  }
});

/**
 * Get user's certificate status
 * GET /api/certificates/status
 */
router.get('/status', verifyToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const validation = await certificateService.validateUserCertificate(userId);
    
    res.json({
      success: true,
      hasCertificate: validation.valid || validation.error !== 'No active certificate found',
      valid: validation.valid,
      expired: validation.expired,
      nearExpiry: validation.nearExpiry,
      daysRemaining: validation.daysRemaining,
      error: validation.error
    });

  } catch (error) {
    console.error('Error getting certificate status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get certificate status'
    });
  }
});

/**
 * Bulk certificate operations (Admin only)
 * POST /api/certificates/bulk
 */
router.post('/bulk', verifyToken, async (req: any, res: Response) => {
  try {
    // Only admins can perform bulk operations
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin access required.'
      });
    }

    const { action, userIds } = req.body;
    
    if (!action || !Array.isArray(userIds)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format'
      });
    }

    const results = [];
    
    for (const userId of userIds) {
      try {
        let result;
        
        switch (action) {
          case 'generate':
            result = await certificateService.generateNotaryCertificate(userId);
            break;
          case 'validate':
            result = await certificateService.validateUserCertificate(userId);
            break;
          case 'revoke':
            result = await certificateService.revokeCertificate(userId, 'bulk_operation');
            break;
          default:
            result = { success: false, error: 'Invalid action' };
        }
        
        results.push({
          userId,
          ...result
        });
        
      } catch (error) {
        results.push({
          userId,
          success: false,
          error: (error as Error).message
        });
      }
    }

    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Error in bulk certificate operation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk operation'
    });
  }
});

/**
 * Get CA certificate for client installation
 * GET /api/certificates/ca-cert
 */
router.get('/ca-cert', verifyToken, async (req: any, res: Response) => {
  try {
    const caPath = './certs/ca-cert.pem';
    
    res.setHeader('Content-Disposition', 'attachment; filename="usa-notary-ca.pem"');
    res.setHeader('Content-Type', 'application/x-pem-file');
    
    const fileStream = createReadStream(caPath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error downloading CA certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download CA certificate'
    });
  }
});

export default router; 