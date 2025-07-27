import { Express } from 'express';
import { verifyToken } from '../auth';
import { CertificateVerificationService } from '../services/certificate-verification-service';
import { db } from '../db';
import { jobs, users, signers, jobParticipants } from '../../shared/schema';
import { eq, and, or } from 'drizzle-orm';

export function registerCertificateVerificationRoutes(app: Express) {
  const certificateVerificationService = CertificateVerificationService.getInstance();

  // Helper function to check if user has access to job
  async function checkJobAccess(jobId: number, user: any): Promise<{ hasAccess: boolean, job?: any }> {
    // Get job details
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (!job) {
      return { hasAccess: false };
    }

    // Check if user is admin, job creator, or assigned notary
    const basicAccess = 
      user.role === 'admin' ||
      job.userId === user.id ||
      job.selectedNotary === user.id.toString();

    if (basicAccess) {
      return { hasAccess: true, job };
    }

    // Check if user is a participant (signer) in this job
    const participantCheck = await db
      .select()
      .from(signers)
      .where(and(
        eq(signers.jobId, jobId),
        eq(signers.userId, user.id)
      ))
      .limit(1);

    const isParticipant = participantCheck.length > 0;

    return { hasAccess: isParticipant, job };
  }

  /**
   * Get certificate verification status for a job
   * GET /api/certificate-verification/job/:jobId
   */
  app.get('/api/certificate-verification/job/:jobId', verifyToken, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const user = req.user;

      console.log(`🔐 Certificate verification access check: User ${user.id} (${user.role}) for job ${jobId}`);

      // Check if user has access to this job
      const { hasAccess, job } = await checkJobAccess(parseInt(jobId), user);

      if (!hasAccess) {
        console.log(`❌ Access denied: User ${user.id} cannot access job ${jobId}`);
        return res.status(403).json({ message: 'Access denied' });
      }

      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      console.log(`✅ Access granted: User ${user.id} can access certificate verification for job ${jobId}`);
    

      // Get certificate verification status
      const verification = await certificateVerificationService.verifyJobCertificateRequirements(parseInt(jobId));

      res.json({
        success: true,
        data: verification
      });

    } catch (error) {
      console.error('Failed to verify job certificates:', error);
      res.status(500).json({
        message: 'Failed to verify certificate requirements',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Check if a job can start (certificate validation)
   * GET /api/certificate-verification/job/:jobId/can-start
   */
  app.get('/api/certificate-verification/job/:jobId/can-start', verifyToken, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const user = req.user;

      // Check if user has access to this job
      const { hasAccess, job } = await checkJobAccess(parseInt(jobId), user);

      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if job can start
      const canStartResult = await certificateVerificationService.canJobStart(parseInt(jobId));

      res.json({
        success: true,
        data: canStartResult
      });

    } catch (error) {
      console.error('Failed to check if job can start:', error);
      res.status(500).json({
        message: 'Failed to check job start requirements',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get certificate status for current user
   * GET /api/certificate-verification/my-status
   */
  app.get('/api/certificate-verification/my-status', verifyToken, async (req: any, res) => {
    try {
      const user = req.user;

      // Get full user details
      const [fullUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      if (!fullUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check certificate status
      const status = await certificateVerificationService.checkUserCertificateStatus(fullUser);

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Failed to get user certificate status:', error);
      res.status(500).json({
        message: 'Failed to get certificate status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Generate certificate for user
   * POST /api/certificate-verification/generate-certificate
   */
  app.post('/api/certificate-verification/generate-certificate', verifyToken, async (req: any, res) => {
    try {
      const user = req.user;
      const { userId } = req.body;

      // Determine which user to generate certificate for
      const targetUserId = userId || user.id;

      // Check permissions
      if (targetUserId !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: 'Can only generate certificates for yourself or admin can generate for anyone' });
      }

      // Generate certificate
      const result = await certificateVerificationService.generateCertificateForUser(targetUserId);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          data: {
            certificateId: result.certificateId
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }

    } catch (error) {
      console.error('Failed to generate certificate:', error);
      res.status(500).json({
        message: 'Failed to generate certificate',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get certificate status for a specific user (admin only)
   * GET /api/certificate-verification/user/:userId/status
   */
  app.get('/api/certificate-verification/user/:userId/status', verifyToken, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = req.user;

      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      // Get user details
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, parseInt(userId)))
        .limit(1);

      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check certificate status
      const status = await certificateVerificationService.checkUserCertificateStatus(targetUser);

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Failed to get user certificate status:', error);
      res.status(500).json({
        message: 'Failed to get certificate status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Refresh job certificate verification
   * POST /api/certificate-verification/job/:jobId/refresh
   */
  app.post('/api/certificate-verification/job/:jobId/refresh', verifyToken, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const user = req.user;

      // Check if user has access to this job
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, parseInt(jobId)))
        .limit(1);

      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check access permissions
      const hasAccess = 
        user.role === 'admin' ||
        job.userId === user.id ||
        job.selectedNotary === user.id.toString();

      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Re-verify certificate requirements
      const verification = await certificateVerificationService.verifyJobCertificateRequirements(parseInt(jobId));

      res.json({
        success: true,
        message: 'Certificate verification refreshed',
        data: verification
      });

    } catch (error) {
      console.error('Failed to refresh certificate verification:', error);
      res.status(500).json({
        message: 'Failed to refresh certificate verification',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
} 