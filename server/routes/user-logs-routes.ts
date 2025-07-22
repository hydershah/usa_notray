import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  notaryLogEntries, 
  auditTrail, 
  systemActivityLogs, 
  editorSessions,
  users,
  jobs,
  jobDocuments,
  sessionParticipants
} from '../../shared/schema';
import { eq, and, desc, gte, lte, like, sql, count, or } from 'drizzle-orm';
import { verifyToken } from '../auth';

const router = Router();

// Get user's notarization logs
router.get('/notarization-logs', verifyToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    const logs = await db
      .select({
        id: notaryLogEntries.id,
        sessionId: notaryLogEntries.sessionId,
        notaryId: notaryLogEntries.notaryId,
        signerId: notaryLogEntries.signerId,
        documentId: notaryLogEntries.documentId,
        notarizationType: notaryLogEntries.notarizationType,
        pageNumber: notaryLogEntries.pageNumber,
        timestamp: notaryLogEntries.timestamp,
        createdAt: notaryLogEntries.createdAt,
        // Join data - simplified approach
        documentName: jobDocuments.originalName,
        jobTitle: jobs.titleCompany,
        jobId: jobs.id
      })
      .from(notaryLogEntries)
      .leftJoin(jobDocuments, eq(notaryLogEntries.documentId, jobDocuments.id))
      .leftJoin(editorSessions, eq(notaryLogEntries.sessionId, editorSessions.id))
      .leftJoin(jobs, eq(editorSessions.jobId, jobs.id))
      .where(
        or(
          eq(notaryLogEntries.notaryId, userId),
          eq(notaryLogEntries.signerId, userId)
        )
      )
      .orderBy(desc(notaryLogEntries.createdAt))
      .limit(100);

    res.json(logs);
  } catch (error) {
    console.error('Error fetching user notarization logs:', error);
    res.status(500).json({ error: 'Failed to fetch notarization logs' });
  }
});

// Get user's audit trail
router.get('/audit-trail', verifyToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    // Simplified query with minimal joins to avoid issues
    const trail = await db
      .select()
      .from(auditTrail)
      .where(eq(auditTrail.userId, userId))
      .orderBy(desc(auditTrail.timestamp))
      .limit(100);

    res.json(trail);
  } catch (error) {
    console.error('Error fetching user audit trail:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
});

// Get user's system activity logs
router.get('/activity-logs', verifyToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    const logs = await db
      .select()
      .from(systemActivityLogs)
      .where(eq(systemActivityLogs.userId, userId))
      .orderBy(desc(systemActivityLogs.createdAt))
      .limit(100);

    res.json(logs);
  } catch (error) {
    console.error('Error fetching user activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// Get user's notarization sessions
router.get('/notarization-sessions', verifyToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    // Simplified query - just get the basic data
    const rawSessions = await db
      .select()
      .from(editorSessions)
      .leftJoin(jobs, eq(editorSessions.jobId, jobs.id))
      .where(
        or(
          eq(jobs.notaryId, userId),
          eq(jobs.userId, userId)
        )
      )
      .orderBy(desc(editorSessions.createdAt))
      .limit(50);

    // Transform the raw data to match frontend expectations
    const sessions = rawSessions.map(row => {
      const session = row.editor_sessions;
      const job = row.jobs;
      
      return {
        id: session?.id || 0,
        jobId: session?.jobId || 0,
        jobTitle: job?.titleCompany || 'Unknown Job',
        titleCompany: job?.titleCompany || 'Unknown Company',
        notaryName: 'Notary User', // We'll enhance this later
        participantCount: 1, // Default value
        status: session?.status || 'unknown',
        startedAt: session?.startedAt || '',
        completedAt: session?.completedAt || '',
        documents: [] // Default empty array
      };
    });

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching user notarization sessions:', error);
    res.status(500).json({ error: 'Failed to fetch notarization sessions' });
  }
});

// Download user logs as PDF
router.get('/download-logs', verifyToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { type } = req.query;

    // This would integrate with a PDF generation service
    // For now, return a placeholder response
    res.status(501).json({ 
      message: 'PDF download not yet implemented',
      type,
      userId 
    });
  } catch (error) {
    console.error('Error downloading user logs:', error);
    res.status(500).json({ error: 'Failed to download logs' });
  }
});

// User download their own certificate
router.get('/certificate/download', verifyToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Get the user to verify role
    const [user] = await db
      .select({ id: users.id, role: users.role, fullName: users.fullName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
      
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Only signers and witnesses have self-signed certificates
    if (!['signer', 'witness'].includes(user.role)) {
      return res.status(400).json({ 
        error: `Your role '${user.role}' does not have self-signed certificates. Only signers and witnesses have auto-generated certificates.` 
      });
    }
    
    const { selfSignedCertificateService } = await import('../services/self-signed-certificate-service');
    const certificate = await selfSignedCertificateService.getUserCertificate(userId);
    
    if (!certificate || !certificate.certificate_content) {
      return res.status(404).json({ 
        error: 'No certificate found',
        suggestion: 'Complete ID verification to automatically generate your certificate'
      });
    }
    
    // Set headers for file download
    const filename = `${user.fullName || 'my'}_${user.role}_certificate.pem`;
    res.setHeader('Content-Type', 'application/x-pem-file');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Send the certificate content
    res.send(certificate.certificate_content);
    
  } catch (error) {
    console.error('User certificate download error:', error);
    res.status(500).json({ error: 'Failed to download certificate' });
  }
});

export default router; 