import { Express } from 'express';
import { verifyToken } from '../auth';
import { DigitalSignatureService } from '../services/digital-signature-service';
import { db } from '../db';
import { digitalSignatures, jobs, users } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export function registerDigitalSignatureRoutes(app: Express) {
  const digitalSignatureService = DigitalSignatureService.getInstance();

  /**
   * Get digital signatures for a specific job
   * GET /api/digital-signatures/job/:jobId
   */
  app.get('/api/digital-signatures/job/:jobId', verifyToken, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const user = req.user;

      // Verify user has access to this job
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

      // Get signatures for this job
      const signatures = await digitalSignatureService.getJobSignatures(parseInt(jobId));

      res.json({
        success: true,
        data: {
          jobId: parseInt(jobId),
          signatures,
          totalSignatures: signatures.length,
          hasDigitalSignatures: signatures.length > 0
        }
      });

    } catch (error) {
      console.error('Failed to get job signatures:', error);
      res.status(500).json({
        message: 'Failed to retrieve digital signatures',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Verify digital signatures in a PDF
   * POST /api/digital-signatures/verify
   */
  app.post('/api/digital-signatures/verify', verifyToken, async (req: any, res) => {
    try {
      const { pdfBuffer, jobId } = req.body;

      if (!pdfBuffer) {
        return res.status(400).json({ message: 'PDF buffer is required' });
      }

      // Convert base64 to buffer if needed
      let buffer: Buffer;
      if (typeof pdfBuffer === 'string') {
        buffer = Buffer.from(pdfBuffer, 'base64');
      } else {
        buffer = Buffer.from(pdfBuffer);
      }

      // Verify signatures
      const verificationResult = await digitalSignatureService.verifyPDFSignatures(buffer);

      // If jobId provided, also get stored signatures for comparison
      let storedSignatures = [];
      if (jobId) {
        storedSignatures = await digitalSignatureService.getJobSignatures(parseInt(jobId));
      }

      res.json({
        success: true,
        data: {
          verification: verificationResult,
          storedSignatures,
          isValid: verificationResult.isValid,
          signatureCount: verificationResult.signatures.length
        }
      });

    } catch (error) {
      console.error('Failed to verify PDF signatures:', error);
      res.status(500).json({
        message: 'Failed to verify digital signatures',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get signature details by signature ID
   * GET /api/digital-signatures/:signatureId
   */
  app.get('/api/digital-signatures/:signatureId', verifyToken, async (req: any, res) => {
    try {
      const { signatureId } = req.params;
      const user = req.user;

      // Get signature details
      const [signature] = await db
        .select({
          id: digitalSignatures.id,
          jobId: digitalSignatures.jobId,
          sessionId: digitalSignatures.sessionId,
          signerName: digitalSignatures.signerName,
          signerEmail: digitalSignatures.signerEmail,
          signatureType: digitalSignatures.signatureType,
          certificateId: digitalSignatures.certificateId,
          signatureHash: digitalSignatures.signatureHash,
          signedAt: digitalSignatures.signedAt,
          isValid: digitalSignatures.isValid,
          verificationStatus: digitalSignatures.verificationStatus,
          verifiedAt: digitalSignatures.verifiedAt,
          metadata: digitalSignatures.metadata,
          createdAt: digitalSignatures.createdAt
        })
        .from(digitalSignatures)
        .innerJoin(jobs, eq(digitalSignatures.jobId, jobs.id))
        .where(eq(digitalSignatures.id, parseInt(signatureId)))
        .limit(1);

      if (!signature) {
        return res.status(404).json({ message: 'Digital signature not found' });
      }

      // Get job for access control
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, signature.jobId))
        .limit(1);

      if (!job) {
        return res.status(404).json({ message: 'Associated job not found' });
      }

      // Check access permissions
      const hasAccess = 
        user.role === 'admin' ||
        job.userId === user.id ||
        job.selectedNotary === user.id.toString() ||
        signature.signerEmail === user.email;

      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json({
        success: true,
        data: signature
      });

    } catch (error) {
      console.error('Failed to get signature details:', error);
      res.status(500).json({
        message: 'Failed to retrieve signature details',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get all digital signatures for current user
   * GET /api/digital-signatures/my-signatures
   */
  app.get('/api/digital-signatures/my-signatures', verifyToken, async (req: any, res) => {
    try {
      const user = req.user;

      const userSignatures = await db
        .select({
          id: digitalSignatures.id,
          jobId: digitalSignatures.jobId,
          sessionId: digitalSignatures.sessionId,
          signerName: digitalSignatures.signerName,
          signatureType: digitalSignatures.signatureType,
          signatureHash: digitalSignatures.signatureHash,
          signedAt: digitalSignatures.signedAt,
          isValid: digitalSignatures.isValid,
          verificationStatus: digitalSignatures.verificationStatus,
          metadata: digitalSignatures.metadata
        })
        .from(digitalSignatures)
        .where(eq(digitalSignatures.signerId, user.id))
        .orderBy(desc(digitalSignatures.signedAt));

      res.json({
        success: true,
        data: {
          signatures: userSignatures,
          totalCount: userSignatures.length
        }
      });

    } catch (error) {
      console.error('Failed to get user signatures:', error);
      res.status(500).json({
        message: 'Failed to retrieve your signatures',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get signature statistics for admin dashboard
   * GET /api/digital-signatures/stats
   */
  app.get('/api/digital-signatures/stats', verifyToken, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      // Get signature statistics
      const allSignatures = await db
        .select()
        .from(digitalSignatures);

      const stats = {
        totalSignatures: allSignatures.length,
        validSignatures: allSignatures.filter(s => s.isValid).length,
        invalidSignatures: allSignatures.filter(s => !s.isValid).length,
        verifiedSignatures: allSignatures.filter(s => s.verificationStatus === 'verified').length,
        pendingSignatures: allSignatures.filter(s => s.verificationStatus === 'pending').length,
        failedSignatures: allSignatures.filter(s => s.verificationStatus === 'failed').length,
        notarySignatures: allSignatures.filter(s => s.signatureType === 'notary').length,
        userSignatures: allSignatures.filter(s => s.signatureType === 'user').length
      };

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Failed to get signature statistics:', error);
      res.status(500).json({
        message: 'Failed to retrieve signature statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
} 