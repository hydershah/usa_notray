import { Router, Response } from 'express';
import { db } from '../db';
import { jobs, users, systemActivityLogs, auditTrail, editorSessions } from '../../shared/schema';
import { eq, desc, or, and } from 'drizzle-orm';
import { verifyToken } from '../auth';

const router = Router();

// Task 1.1: Get assigned notary details for a job
router.get('/api/jobs/:id/notary-details', verifyToken, async (req: any, res: Response) => {
  try {
    const jobId = parseInt(req.params.id);
    
    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    // Query job with assigned notary information
    const result = await db
      .select({
        jobId: jobs.id,
        notaryId: jobs.notaryId,
        notaryName: users.firstName,
        notaryLastName: users.lastName,
        notaryEmail: users.email,
        notaryType: users.notaryType,
      })
      .from(jobs)
      .leftJoin(users, eq(jobs.notaryId, users.id))
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const jobData = result[0];

    // If no notary is assigned
    if (!jobData.notaryId) {
      return res.json({
        jobId: jobData.jobId,
        notary: null,
        message: 'No notary assigned to this job'
      });
    }

    // Return assigned notary information
    return res.json({
      jobId: jobData.jobId,
      notary: {
        id: jobData.notaryId,
        name: `${jobData.notaryName || ''} ${jobData.notaryLastName || ''}`.trim(),
        email: jobData.notaryEmail,
        type: jobData.notaryType
      }
    });

  } catch (error) {
    console.error('Error fetching notary details:', error);
    return res.status(500).json({ error: 'Failed to fetch notary details' });
  }
});

// Task 8.1: Get session recording details for a job
router.get('/api/jobs/:id/recording-details', verifyToken, async (req: any, res: Response) => {
  try {
    const jobId = parseInt(req.params.id);
    
    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    // Query job recording information
    const result = await db
      .select({
        jobId: jobs.id,
        recordingFileKey: jobs.recordingFileKey,
        recordingFileUrl: jobs.recordingFileUrl,
        recordingFileName: jobs.recordingFileName,
        recordingDuration: jobs.recordingDuration,
        recordingStartedAt: jobs.recordingStartedAt,
        recordingUploadedAt: jobs.recordingUploadedAt,
        recordingParticipantCount: jobs.recordingParticipantCount,
        recordingSessionId: jobs.recordingSessionId,
        recordingLiveSessionId: jobs.recordingLiveSessionId,
        recordingMetadata: jobs.recordingMetadata,
      })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const jobData = result[0];

    // Check if recording exists
    const hasRecording = !!(jobData.recordingFileKey || jobData.recordingFileUrl);

    return res.json({
      jobId: jobData.jobId,
      hasRecording,
      recording: hasRecording ? {
        fileKey: jobData.recordingFileKey,
        fileUrl: jobData.recordingFileUrl,
        fileName: jobData.recordingFileName,
        duration: jobData.recordingDuration,
        startedAt: jobData.recordingStartedAt,
        uploadedAt: jobData.recordingUploadedAt,
        participantCount: jobData.recordingParticipantCount,
        sessionId: jobData.recordingSessionId,
        liveSessionId: jobData.recordingLiveSessionId,
        metadata: jobData.recordingMetadata,
      } : null
    });

  } catch (error) {
    console.error('Error fetching recording details:', error);
    return res.status(500).json({ error: 'Failed to fetch recording details' });
  }
});

// Task 10.1: Get activity log for a job
router.get('/api/jobs/:id/activity-log', verifyToken, async (req: any, res: Response) => {
  try {
    const jobId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    // Query system activity logs related to this job
    const systemLogs = await db
      .select({
        id: systemActivityLogs.id,
        userId: systemActivityLogs.userId,
        userRole: systemActivityLogs.userRole,
        userEmail: systemActivityLogs.userEmail,
        userName: systemActivityLogs.userName,
        action: systemActivityLogs.action,
        actionCategory: systemActivityLogs.actionCategory,
        actionDescription: systemActivityLogs.actionDescription,
        targetType: systemActivityLogs.targetType,
        targetId: systemActivityLogs.targetId,
        targetName: systemActivityLogs.targetName,
        details: systemActivityLogs.details,
        createdAt: systemActivityLogs.createdAt,
        source: 'system',
      })
      .from(systemActivityLogs)
      .where(eq(systemActivityLogs.jobId, jobId))
      .orderBy(desc(systemActivityLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Query audit trail from editor sessions related to this job
    const auditLogs = await db
      .select({
        id: auditTrail.id,
        userId: auditTrail.userId,
        userRole: users.role,
        userEmail: users.email,
        userName: users.firstName,
        action: auditTrail.action,
        actionCategory: 'document_management',
        actionDescription: auditTrail.action,
        targetType: 'document',
        targetId: auditTrail.documentId,
        targetName: 'Document',
        details: auditTrail.details,
        createdAt: auditTrail.timestamp,
        source: 'editor',
      })
      .from(auditTrail)
      .leftJoin(users, eq(auditTrail.userId, users.id))
      .leftJoin(editorSessions, eq(auditTrail.sessionId, editorSessions.id))
      .where(eq(editorSessions.jobId, jobId))
      .orderBy(desc(auditTrail.timestamp))
      .limit(limit)
      .offset(offset);

    // Combine and sort all logs by timestamp
    const allLogs = [...systemLogs, ...auditLogs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return res.json({
      jobId,
      activities: allLogs,
      total: allLogs.length,
      hasMore: allLogs.length === limit
    });

  } catch (error) {
    console.error('Error fetching activity log:', error);
    return res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

export { router as jobDetailsRoutes }; 