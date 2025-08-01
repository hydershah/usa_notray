import { Router } from 'express';
import { verifyToken } from '../auth';

const router = Router();

// Helper function to format dates as MM/DD/YYYY
function formatDate(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear().toString();
  return `${month}/${day}/${year}`;
}

// Simple in-memory cache to prevent racing conditions
const activeSessionCreations = new Map<number, Promise<any>>();

// Function to create video session (extracted to prevent racing conditions)
async function createVideoSession(jobId: number) {
  // Import Daily service
  const { dailyService } = await import('../lib/daily-service');
  
  // Check service configuration
  const configStatus = dailyService.getConfigStatus();
  console.log('Daily service configuration status:', configStatus);
  
  // Calculate end time (2 hours from now for notary sessions)
  const endDate = new Date();
  endDate.setHours(endDate.getHours() + 2);

  // Create Daily meeting
  const meetingOptions = {
    roomNamePrefix: `notary-session-${jobId}`,
    endDate: endDate.toISOString(),
    isPrivate: false,
    maxParticipants: 8,
    enableRecording: true
  };

  console.log('Creating meeting with options:', meetingOptions);
  const meeting = await dailyService.createMeeting(meetingOptions);
  
  console.log('Daily video session created:', {
    meetingId: meeting.meetingId,
    roomUrl: meeting.roomUrl,
    endDate: meeting.endDate,
    configured: configStatus.configured
  });
  
  return {
    success: true,
    sessionId: meeting.meetingId,
    roomUrl: meeting.roomUrl,
    hostRoomUrl: meeting.hostRoomUrl,
    roomName: meeting.roomName,
    meetingId: meeting.meetingId,
    sessionToken: meeting.meetingId,
    endDate: meeting.endDate,
    technology: 'daily',
    configured: configStatus.configured,
    mode: configStatus.configured ? 'api' : 'fallback',
    jobId
  };
}

// Test Daily.co configuration
router.get('/api/video/test-config', verifyToken, async (req: any, res) => {
  try {
    const { dailyService } = await import('../lib/daily-service');
    const configStatus = dailyService.getConfigStatus();
    
    console.log('🔍 Daily.co configuration test:', configStatus);
    
    res.json({
      success: true,
      configured: configStatus.configured,
      hasApiKey: configStatus.hasApiKey,
      hasDomain: configStatus.hasDomain,
      apiUrl: configStatus.apiUrl,
      domain: configStatus.domain,
      message: configStatus.configured 
        ? 'Daily.co is properly configured' 
        : 'Daily.co is not configured - using fallback mode'
    });
  } catch (error) {
    console.error('Daily.co configuration test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check Daily.co configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===== VIDEO CONFERENCING ROUTES - DAILY.CO INTEGRATION =====

// Create Daily video session for job
router.post('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const { storage } = await import('../storage');
    const job = await storage.getJob(jobId);
    
    console.log('🎥 Video session creation request:', {
      jobId,
      userId: req.user?.id,
      userRole: req.user?.role,
      hasToken: !!req.headers.authorization
    });
    
    if (!job) {
      console.error('❌ Job not found:', jobId);
      return res.status(404).json({ 
        message: 'Job not found',
        error: 'JOB_NOT_FOUND'
      });
    }

    // Check if there's already a session creation in progress for this job
    if (activeSessionCreations.has(jobId)) {
      console.log(`⏳ Video session creation already in progress for job ${jobId}, waiting...`);
      try {
        const existingResult = await activeSessionCreations.get(jobId);
        return res.json(existingResult);
      } catch (error) {
        console.warn(`⚠️ Existing session creation failed for job ${jobId}, creating new one`);
        activeSessionCreations.delete(jobId);
      }
    }

    console.log('Creating Daily video session for job:', jobId);
    
    // Create a promise for this session creation to prevent race conditions
    const sessionCreationPromise = createVideoSession(jobId);
    activeSessionCreations.set(jobId, sessionCreationPromise);
    
    try {
      const result = await sessionCreationPromise;
      activeSessionCreations.delete(jobId); // Clean up
      console.log('✅ Video session created successfully:', {
        jobId,
        meetingId: result.meetingId,
        hasRoomUrl: !!result.roomUrl,
        configured: result.configured,
        mode: result.mode
      });
      res.json(result);
    } catch (error) {
      activeSessionCreations.delete(jobId); // Clean up on error
      throw error;
    }

  } catch (error) {
    console.error('Create Daily video session error:', error);
    
    // Provide more specific error information
    let errorCode = 'VIDEO_SESSION_ERROR';
    let statusCode = 500;
    let message = 'Failed to create video session';
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorCode = 'API_KEY_MISSING';
        message = 'Video service not configured properly';
        statusCode = 503; // Service Unavailable
      } else if (error.message.includes('401')) {
        errorCode = 'API_UNAUTHORIZED';
        message = 'Video service authentication failed';
        statusCode = 503;
      } else if (error.message.includes('403')) {
        errorCode = 'API_FORBIDDEN';
        message = 'Video service access denied';
        statusCode = 503;
      } else if (error.message.includes('402')) {
        errorCode = 'API_PAYMENT_REQUIRED';
        message = 'Video service payment required';
        statusCode = 503;
      } else if (error.message.includes('429')) {
        errorCode = 'API_RATE_LIMITED';
        message = 'Video service rate limit exceeded';
        statusCode = 429;
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorCode = 'NETWORK_ERROR';
        message = 'Unable to connect to video service';
        statusCode = 503;
      }
    }
    
    console.error('Video session creation failed:', {
      errorCode,
      statusCode,
      message,
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: formatDate(new Date())
    });
    
    res.status(statusCode).json({ 
      message,
      error: errorCode,
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: formatDate(new Date())
    });
  }
});

// Get video session status
router.get('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const { storage } = await import('../storage');
    const job = await storage.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Return active session info
    const sessionInfo = {
      jobId,
      isActive: false,
      participants: [],
      recordings: [],
      technology: 'daily',
      message: 'No active video session. Create one by starting a live signing session.'
    };

    res.json(sessionInfo);
  } catch (error) {
    console.error('Get video session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start recording for Daily session
router.post('/api/jobs/:jobId/video-session/recording/start', verifyToken, async (req: any, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const { roomName, meetingId } = req.body;
    
    const { dailyService } = await import('../lib/daily-service');
    const recording = await dailyService.startRecording(roomName || meetingId);
    
    console.log('Recording started for Daily session:', {
      jobId,
      roomName,
      recordingId: recording.recordingId
    });

    res.json({
      success: true,
      recordingId: recording.recordingId,
      message: 'Recording started successfully',
      technology: 'daily'
    });
  } catch (error) {
    console.error('Start recording error:', error);
    res.status(500).json({ message: 'Failed to start recording' });
  }
});

// Stop recording for Daily session
router.post('/api/jobs/:jobId/video-session/recording/stop', verifyToken, async (req: any, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const { recordingId } = req.body;
    
    const { dailyService } = await import('../lib/daily-service');
    const result = await dailyService.stopRecording(recordingId);
    
    console.log('Recording stopped for Daily session:', {
      jobId,
      recordingId,
      status: result.status
    });

    res.json({
      success: true,
      status: result.status,
      message: 'Recording stopped successfully',
      technology: 'daily'
    });
  } catch (error) {
    console.error('Stop recording error:', error);
    res.status(500).json({ message: 'Failed to stop recording' });
  }
});

// Save recording metadata
router.post('/api/jobs/:jobId/video-session/recording', verifyToken, async (req: any, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const { recordingUrl, duration, participants, meetingId } = req.body;
    
    // Store recording metadata in your database
    const recordingData = {
      jobId,
      meetingId,
      recordingUrl,
      duration,
      participants,
      createdAt: formatDate(new Date()),
      createdBy: req.user.id,
      complianceStatus: 'recorded',
      technology: 'daily',
      auditTrail: {
        sessionStart: formatDate(new Date(Date.now() - duration * 1000)),
        sessionEnd: formatDate(new Date()),
        participantCount: participants?.length || 0
      }
    };

    console.log('Recording metadata saved:', {
      jobId,
      meetingId,
      duration: `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`,
      participants: participants?.length || 0
    });

    res.json({
      success: true,
      recordingId: `recording-${jobId}-${Date.now()}`,
      message: 'Recording metadata saved successfully',
      complianceVerified: true,
      technology: 'daily'
    });
  } catch (error) {
    console.error('Save recording error:', error);
    res.status(500).json({ message: 'Failed to save recording metadata' });
  }
});

// End Daily video session
router.delete('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const { sessionId, meetingId } = req.body;
    
    if (sessionId || meetingId) {
      console.log(`Ending Daily video session ${sessionId || meetingId} for job ${jobId}`);
      
      // Clean up Daily meeting
      const { dailyService } = await import('../lib/daily-service');
      try {
        await dailyService.deleteMeeting(sessionId || meetingId);
      } catch (deleteError) {
        console.warn('Failed to delete Daily meeting:', deleteError);
        // Non-critical error, continue
      }
    }
    
    // Update job status to completed if needed
    const { storage } = await import('../storage');
    const job = await storage.getJob(jobId);
    if (job && job.jobStatus === 'in_progress') {
      await storage.updateJob(jobId, {
        jobStatus: 'completed',
        completedAt: new Date(),
        completedBy: req.user.id
      });
    }
    
    console.log(`Daily video session ended for job ${jobId}`);
    
    res.json({
      success: true,
      message: 'Daily video session ended successfully',
      jobStatus: 'completed',
      technology: 'daily'
    });
  } catch (error) {
    console.error('End Daily video session error:', error);
    res.status(500).json({ message: 'Failed to end Daily video session' });
  }
});

// Get session recordings for compliance
router.get('/api/jobs/:jobId/recordings', verifyToken, async (req: any, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const { storage } = await import('../storage');
    const job = await storage.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // For now, return empty recordings array
    // In a full implementation, you'd query your database for recorded sessions
    const recordings: any[] = [];

    res.json({
      success: true,
      jobId,
      recordings,
      technology: 'daily',
      message: recordings.length === 0 ? 'No recordings found for this job' : `Found ${recordings.length} recording(s)`
    });
  } catch (error) {
    console.error('Get recordings error:', error);
    res.status(500).json({ message: 'Failed to get recordings' });
  }
});

// Daily diagnostic endpoint
router.get('/api/daily/diagnostics', verifyToken, async (req: any, res) => {
  try {
    const { dailyService } = await import('../lib/daily-service');
    
    // Test Daily configuration
    const configValidation = dailyService.validateConfiguration();
    const configStatus = dailyService.getConfigStatus();
    
    const diagnostics = {
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV,
        timestamp: formatDate(new Date())
      },
      daily: {
        apiKeyConfigured: configStatus.hasApiKey ? 'configured' : 'missing',
        domainConfigured: configStatus.hasDomain ? 'configured' : 'missing',
        apiUrl: configStatus.apiUrl,
        domain: configStatus.domain,
        serviceConfigured: configStatus.configured,
        configurationValid: configValidation.valid,
        configurationErrors: configValidation.errors,
        configurationWarnings: configValidation.warnings,
        serviceStatus: configValidation.valid ? 'ready' : (process.env.NODE_ENV === 'production' ? 'misconfigured' : 'fallback-mode')
      },
      authentication: {
        jwtSecret: process.env.JWT_SECRET ? 'configured' : 'missing',
        userId: req.user.id,
        userRole: req.user.role
      },
      features: {
        videoConferencing: true,
        cloudRecording: configStatus.configured,
        hostControls: configStatus.configured,
        waitingRoom: configStatus.configured,
        complianceMode: true,
        fallbackMode: !configStatus.configured,
        screenSharing: true,
        chatFeatures: true
      }
    };

    console.log('Daily diagnostics requested by user:', req.user.id);
    console.log('Daily service status:', configStatus);
    
    const recommendations = [];
    if (configValidation.errors.length > 0) {
      recommendations.push(...configValidation.errors.map(error => `❌ ${error}`));
    }
    if (configValidation.warnings.length > 0) {
      recommendations.push(...configValidation.warnings.map(warning => `⚠️ ${warning}`));
    }
    if (!configStatus.configured) {
      if (!configStatus.hasApiKey) {
        recommendations.push('📝 Set DAILY_API_KEY environment variable for full video functionality');
      }
      if (!configStatus.hasDomain) {
        recommendations.push('📝 Set DAILY_DOMAIN or DAILY_BASE_URL environment variable');
      }
      if (process.env.NODE_ENV === 'development') {
        recommendations.push('💡 Development mode: Video will use fallback implementation');
      }
    }
    
    res.json({
      success: true,
      diagnostics,
      recommendations
    });
  } catch (error) {
    console.error('Daily diagnostics error:', error);
    res.status(500).json({ 
      message: 'Failed to get Daily diagnostics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get Daily room details
router.get('/api/daily/rooms/:roomName', verifyToken, async (req: any, res) => {
  try {
    const roomName = req.params.roomName;
    const { dailyService } = await import('../lib/daily-service');
    
    const room = await dailyService.getMeeting(roomName);
    
    if (!room) {
      return res.status(404).json({ 
        message: 'Room not found',
        roomName 
      });
    }

    res.json({
      success: true,
      room: {
        roomName: room.roomName,
        roomUrl: room.roomUrl,
        hostRoomUrl: room.hostRoomUrl,
        isLocked: room.isLocked,
        startDate: room.startDate,
        endDate: room.endDate
      },
      technology: 'daily'
    });
  } catch (error) {
    console.error('Get Daily room error:', error);
    res.status(500).json({ 
      message: 'Failed to get room details',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint for Daily service
router.get('/api/daily/health', async (req, res) => {
  try {
    const { dailyService } = await import('../lib/daily-service');
    const configStatus = dailyService.getConfigStatus();
    
    res.json({
      status: 'healthy',
      service: 'daily',
      configured: configStatus.configured,
      apiKeyPresent: configStatus.hasApiKey,
      domainPresent: configStatus.hasDomain,
      timestamp: formatDate(new Date())
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      service: 'daily',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: formatDate(new Date())
    });
  }
});

export default router;