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

// Get recording details for a job
router.get('/api/jobs/:id/recording-details', verifyToken, async (req: any, res: Response) => {
  try {
    const jobId = parseInt(req.params.id);
    
    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    // Disable caching for this endpoint to ensure fresh data
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'ETag': `"recording-${jobId}-${Date.now()}"` // Fresh ETag per request
    });

    // Query job with recording information
    const result = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = result[0];
    console.log(`🎥 Fetching recording details for job ${jobId}`);

    // Check if there's recording metadata first
    let metadata = null;
    if (job.recordingMetadata) {
      try {
        metadata = JSON.parse(job.recordingMetadata);
        console.log('📋 Recording metadata:', metadata);
      } catch (e) {
        console.warn('Failed to parse recording metadata:', e);
      }
    }

    // Strategy 1: If we have a valid Daily recording ID from metadata (most reliable)
    if (metadata?.recordingId && !metadata.recordingId.startsWith('fallback-') && !metadata.recordingId.startsWith('mock-')) {
      console.log('🔍 Strategy 1: Trying direct Daily recording ID:', metadata.recordingId);
      const recordingData = await fetchDailyRecordingById(metadata.recordingId);
      if (recordingData) {
        console.log('✅ Found Daily recording via direct ID:', recordingData.id);
        return res.json(formatRecordingResponse(recordingData, jobId, metadata, ['Direct ID']));
      }
    }

    // Strategy 2: Use cached recordings list to avoid rate limits
    console.log('🔍 Strategy 2: Using cached Daily recordings list');
    const allRecordings = await getCachedDailyRecordings();
    
    if (allRecordings && allRecordings.length > 0) {
      // Get video session IDs for this job (limit to most recent 5 to avoid too many lookups)
      const { editorSessions } = await import('../../shared/schema');
      const editorSessionResults = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.jobId, jobId))
        .orderBy(desc(editorSessions.createdAt))
        .limit(5); // Limit to avoid rate limits

      const videoSessionIds = editorSessionResults
        .filter(session => session.videoSessionId)
        .map(session => session.videoSessionId as string);

      console.log(`🔍 Found ${videoSessionIds.length} video sessions (limited to 5 most recent):`, videoSessionIds.slice(0, 3));

      // Search for recordings that match any of our session IDs
      for (const sessionId of videoSessionIds) {
        const matchingRecordings = allRecordings.filter(recording => 
          recording.room_name === sessionId
        );
        
        if (matchingRecordings.length > 0) {
          // Get the most recent recording for this session
          const recording = matchingRecordings.sort((a, b) => b.start_ts - a.start_ts)[0];
          console.log(`✅ Found matching recording: ${recording.id} for session: ${sessionId}`);
          
          // Get access link for this recording
          const recordingWithLink = await fetchDailyRecordingById(recording.id);
          if (recordingWithLink) {
            return res.json(formatRecordingResponse(recordingWithLink, jobId, metadata, [`Session match: ${sessionId}`]));
          }
        }
      }

      // Strategy 3: Search by job pattern in cached recordings
      console.log('🔍 Strategy 3: Searching cached recordings by job pattern');
      const jobPatternRecordings = allRecordings.filter(recording => 
        recording.room_name && recording.room_name.includes(`notary-session-${jobId}`)
      );

      if (jobPatternRecordings.length > 0) {
        // Get the most recent recording
        const recording = jobPatternRecordings.sort((a, b) => b.start_ts - a.start_ts)[0];
        console.log(`✅ Found pattern-matched recording: ${recording.id}`);
        
        const recordingWithLink = await fetchDailyRecordingById(recording.id);
        if (recordingWithLink) {
          return res.json(formatRecordingResponse(recordingWithLink, jobId, metadata, [`Pattern match: notary-session-${jobId}`]));
        }
      }

      // Strategy 4: Search by time range (only if job has completion time)
      if (job.completedAt) {
        console.log('🔍 Strategy 4: Searching by completion time range');
        const completedTime = new Date(job.completedAt).getTime() / 1000;
        const timeRangeRecordings = allRecordings.filter(recording => 
          recording.start_ts >= completedTime - 3600 && recording.start_ts <= completedTime + 3600
        );

        if (timeRangeRecordings.length > 0) {
          // Get the recording closest to completion time
          const recording = timeRangeRecordings.sort((a, b) => 
            Math.abs(a.start_ts - completedTime) - Math.abs(b.start_ts - completedTime)
          )[0];
          console.log(`✅ Found time-matched recording: ${recording.id}`);
          
          const recordingWithLink = await fetchDailyRecordingById(recording.id);
          if (recordingWithLink) {
            return res.json(formatRecordingResponse(recordingWithLink, jobId, metadata, [`Time range match around ${new Date(job.completedAt).toISOString()}`]));
          }
        }
      }
    }

    // Handle fallback/mock recordings
    if (metadata?.recordingId?.startsWith('fallback-') || metadata?.recordingId?.startsWith('mock-')) {
      console.log('⚠️ Fallback/mock recording detected:', metadata.recordingId);
      return res.json({
        fileKey: null,
        fileUrl: null,
        fileName: null,
        duration: null,
        startedAt: job.recordingStartedAt || null,
        uploadedAt: null,
        participantCount: null,
        sessionId: job.recordingSessionId || null,
        liveSessionId: null,
        metadata: {
          ...metadata,
          error: 'Recording was created using fallback system - no video file available',
          technology: metadata?.technology || 'fallback'
        }
      });
    }

    // No recording found at all
    console.log('❌ No recording found for job:', jobId);
    return res.json({
      fileKey: null,
      fileUrl: null,
      fileName: null,
      duration: null,
      startedAt: null,
      uploadedAt: null,
      participantCount: null,
      sessionId: null,
      liveSessionId: null,
      metadata: {
        error: 'No recording found for this job'
      }
    });

  } catch (error) {
    console.error('❌ Error fetching recording details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cache for Daily.co recordings to avoid rate limits
let recordingsCache: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to get cached Daily recordings
async function getCachedDailyRecordings() {
  const now = Date.now();
  
  // Return cached data if it's still fresh
  if (recordingsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('📦 Using cached Daily recordings');
    return recordingsCache;
  }

  try {
    const dailyApiKey = process.env.DAILY_API_KEY;
    if (!dailyApiKey) {
      console.warn('No Daily API key configured');
      return null;
    }

    console.log('🔄 Refreshing Daily recordings cache');
    const response = await fetch(`https://api.daily.co/v1/recordings?limit=100`, {
      headers: {
        'Authorization': `Bearer ${dailyApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`Failed to fetch recordings: ${response.status}`);
      return recordingsCache; // Return old cache if available
    }

    const data = await response.json();
    recordingsCache = data.data || [];
    cacheTimestamp = now;
    
    console.log(`✅ Cached ${recordingsCache.length} Daily recordings`);
    return recordingsCache;
  } catch (error) {
    console.error('Error fetching Daily recordings for cache:', error);
    return recordingsCache; // Return old cache if available
  }
}

// Helper function to format recording response
function formatRecordingResponse(recordingData: any, jobId: number, metadata: any, searchAttempts: string[]) {
  return {
    fileKey: recordingData.s3key || null,
    fileUrl: recordingData.download_link || null,
    fileName: `recording-${jobId}-${recordingData.id}.mp4`,
    duration: recordingData.duration || null,
    startedAt: recordingData.start_ts ? new Date(recordingData.start_ts * 1000).toISOString() : null,
    uploadedAt: null,
    participantCount: recordingData.max_participants || null,
    sessionId: recordingData.room_name || null,
    liveSessionId: recordingData.mtgSessionId || null,
    metadata: {
      ...metadata,
      dailyRecordingId: recordingData.id,
      roomName: recordingData.room_name,
      status: recordingData.status,
      technology: 'daily',
      searchAttempts
    }
  };
}

// Helper function to fetch Daily recording by ID (with access link)
async function fetchDailyRecordingById(recordingId: string) {
  try {
    const dailyApiKey = process.env.DAILY_API_KEY;
    if (!dailyApiKey) {
      console.warn('No Daily API key configured');
      return null;
    }

    // First get the recording metadata
    const response = await fetch(`https://api.daily.co/v1/recordings/${recordingId}`, {
      headers: {
        'Authorization': `Bearer ${dailyApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`Daily recording ${recordingId} not found: ${response.status}`);
      return null;
    }

    const recording = await response.json();
    
    // Get access link for the recording
    const accessLinkResponse = await fetch(`https://api.daily.co/v1/recordings/${recordingId}/access-link?valid_for_secs=7200`, {
      headers: {
        'Authorization': `Bearer ${dailyApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (accessLinkResponse.ok) {
      const accessLink = await accessLinkResponse.json();
      recording.download_link = accessLink.download_link;
    }

    return recording;
  } catch (error) {
    console.error('Error fetching Daily recording by ID:', error);
    return null;
  }
}

// Task 10.1: Get activity log for a job
router.get('/api/jobs/:id/activity-log', verifyToken, async (req: any, res: Response) => {
  try {
    const jobId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    // Simplified query to avoid circular reference issues
    const systemLogs = await db
      .select()
      .from(systemActivityLogs)
      .where(eq(systemActivityLogs.jobId, jobId))
      .orderBy(desc(systemActivityLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Transform the results to include source field
    const transformedSystemLogs = systemLogs.map(log => ({
      id: log.id,
      userId: log.userId,
      userRole: log.userRole,
      userEmail: log.userEmail,
      userName: log.userName,
      action: log.action,
      actionCategory: log.actionCategory,
      actionDescription: log.actionDescription,
      targetType: log.targetType,
      targetId: log.targetId,
      targetName: log.targetName,
      details: log.details,
      createdAt: log.createdAt,
      source: 'system'
    }));

    // For now, only return system logs to avoid circular reference issues
    // TODO: Fix audit trail query in a separate task
    const auditLogs: any[] = [];

    // Combine and sort all logs by timestamp
    const allLogs = [...transformedSystemLogs, ...auditLogs]
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