import { Express, Request, Response } from 'express';
import { openViduService } from '../lib/openvidu-service';
import { recordingService } from '../lib/recording-service';
import { verifyToken, type AuthUser } from '../auth';

// Extend Request interface to include user data
interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

// Request/Response interfaces
interface CreateSessionRequest {
  sessionId: string;
  jobId: number;
  participants: Array<{
    userId: number;
    role: string;
    displayName: string;
    email: string;
  }>;
  config?: {
    maxParticipants?: number;
    allowRecording?: boolean;
    autoStartRecording?: boolean;
  };
}

interface GenerateTokenRequest {
  sessionId: string;
  userId: number;
  role: string;
  displayName: string;
}

interface StartRecordingRequest {
  sessionId: string;
  layout?: 'grid' | 'focus' | 'custom';
  resolution?: '640x480' | '1280x720' | '1920x1080';
}

interface StopRecordingRequest {
  recordingId: string;
}

export function registerVideoRoutes(app: Express) {
  
  // ===== VIDEO SESSION ROUTES =====
  
  /**
   * Create OpenVidu video session for job
   * POST /api/jobs/:jobId/video-session
   */
  app.post('/api/jobs/:jobId/video-session', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { sessionId, participants, config }: CreateSessionRequest = req.body;

      console.log('📹 Creating OpenVidu video session:', {
        jobId,
        sessionId,
        participantCount: participants?.length || 0
      });

      // Validate request
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'SESSION_ID_REQUIRED',
          message: 'Session ID is required'
        });
      }

      if (!participants || participants.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'PARTICIPANTS_REQUIRED',
          message: 'At least one participant is required'
        });
      }

      // Create session with participants
      const sessionData = await openViduService.createSessionWithParticipants(
        sessionId,
        participants
      );

      // Auto-start recording if configured and user has permission
      let recordingId: string | undefined;
      if (config?.autoStartRecording && req.user) {
        const userCanRecord = ['notary', 'admin'].includes(req.user.role);
        if (userCanRecord) {
          try {
            const recordingResult = await recordingService.startRecording(
              sessionData.sessionId,
              jobId,
              participants.map(p => p.displayName)
            );
            recordingId = recordingResult.recordingId;
            console.log('🎬 Auto-started recording:', recordingId);
          } catch (recordingError) {
            console.warn('⚠️ Failed to auto-start recording:', recordingError);
            // Don't fail the entire request if recording fails
          }
        }
      }

      res.json({
        success: true,
        sessionId: sessionData.sessionId,
        sessionToken: sessionData.sessionToken,
        participants: sessionData.participants,
        recordingId,
        config: {
          recordingEnabled: !!recordingId,
          maxParticipants: config?.maxParticipants || 8
        }
      });

      console.log('✅ Video session created successfully:', {
        sessionId: sessionData.sessionId,
        participantCount: sessionData.participants.length,
        recordingStarted: !!recordingId
      });

    } catch (error) {
      console.error('❌ Error creating video session:', error);
      
      res.status(500).json({
        success: false,
        error: 'SESSION_CREATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create video session'
      });
    }
  });

  /**
   * Close video session
   * DELETE /api/jobs/:jobId/video-session/:sessionId
   */
  app.delete('/api/jobs/:jobId/video-session/:sessionId', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const sessionId = req.params.sessionId;

      console.log('🔚 Closing video session:', { jobId, sessionId });

      // Check authorization - only notary/admin can close sessions
      if (req.user && !['notary', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Only notaries and admins can close sessions'
        });
      }

      const success = await openViduService.closeSession(sessionId);

      if (success) {
        res.json({
          success: true,
          message: 'Session closed successfully'
        });
        console.log('✅ Video session closed:', sessionId);
      } else {
        res.status(404).json({
          success: false,
          error: 'SESSION_NOT_FOUND',
          message: 'Session not found or already closed'
        });
      }

    } catch (error) {
      console.error('❌ Error closing video session:', error);
      
      res.status(500).json({
        success: false,
        error: 'SESSION_CLOSE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to close session'
      });
    }
  });

  // ===== RECORDING ROUTES =====

  /**
   * Start recording for video session
   * POST /api/jobs/:jobId/video-recording/start
   */
  app.post('/api/jobs/:jobId/video-recording/start', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { sessionId, layout, resolution }: StartRecordingRequest = req.body;

      console.log('🎬 Starting video recording:', {
        jobId,
        sessionId,
        layout,
        resolution
      });

      // Check authorization - only notary/admin can start recordings
      if (req.user && !['notary', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Only notaries and admins can start recordings'
        });
      }

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'SESSION_ID_REQUIRED',
          message: 'Session ID is required'
        });
      }

      // Start recording with metadata
      const result = await recordingService.startRecording(
        sessionId,
        jobId,
        [], // Participants will be populated from session
        {
          layout: layout || 'grid',
          resolution: resolution || '1920x1080'
        }
      );

      res.json({
        success: true,
        recordingId: result.recordingId,
        status: result.status,
        sessionId,
        layout: layout || 'grid',
        resolution: resolution || '1920x1080'
      });

      console.log('✅ Video recording started:', {
        recordingId: result.recordingId,
        sessionId,
        jobId
      });

    } catch (error) {
      console.error('❌ Error starting video recording:', error);
      
      res.status(500).json({
        success: false,
        error: 'RECORDING_START_FAILED',
        message: error instanceof Error ? error.message : 'Failed to start recording'
      });
    }
  });

  /**
   * Stop recording
   * POST /api/jobs/:jobId/video-recording/stop
   */
  app.post('/api/jobs/:jobId/video-recording/stop', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { recordingId }: StopRecordingRequest = req.body;

      console.log('🛑 Stopping video recording:', {
        jobId,
        recordingId
      });

      // Check authorization - only notary/admin can stop recordings
      if (req.user && !['notary', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Only notaries and admins can stop recordings'
        });
      }

      if (!recordingId) {
        return res.status(400).json({
          success: false,
          error: 'RECORDING_ID_REQUIRED',
          message: 'Recording ID is required'
        });
      }

      // Stop recording and upload to Vultr
      const result = await recordingService.stopRecording(recordingId);

      res.json({
        success: true,
        recordingId: result.recordingId,
        status: result.status,
        vultrUrl: result.vultrUrl,
        cdnUrl: result.cdnUrl,
        size: result.size,
        uploadedToVultr: !!result.vultrUrl
      });

      console.log('✅ Video recording stopped and uploaded:', {
        recordingId: result.recordingId,
        vultrUrl: result.vultrUrl,
        size: result.size
      });

    } catch (error) {
      console.error('❌ Error stopping video recording:', error);
      
      res.status(500).json({
        success: false,
        error: 'RECORDING_STOP_FAILED',
        message: error instanceof Error ? error.message : 'Failed to stop recording'
      });
    }
  });

  /**
   * Get recordings for a job
   * GET /api/jobs/:jobId/video-recordings
   */
  app.get('/api/jobs/:jobId/video-recordings', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);

      console.log('📂 Getting video recordings for job:', jobId);

      // Get recordings for job
      const recordings = await recordingService.getJobRecordings(jobId);

      res.json({
        success: true,
        jobId,
        recordings: recordings.map(recording => ({
          recordingId: recording.recordingId,
          sessionId: recording.sessionId,
          vultrUrl: recording.vultrUrl,
          cdnUrl: recording.cdnUrl,
          size: recording.size,
          duration: recording.duration,
          createdAt: recording.createdAt,
          downloadUrl: recording.vultrUrl ? `${recording.vultrUrl}` : null
        })),
        count: recordings.length
      });

      console.log('✅ Retrieved video recordings:', {
        jobId,
        count: recordings.length
      });

    } catch (error) {
      console.error('❌ Error getting video recordings:', error);
      
      res.status(500).json({
        success: false,
        error: 'RECORDINGS_FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get recordings'
      });
    }
  });

  /**
   * Generate secure download URL for recording
   * POST /api/jobs/:jobId/video-recordings/:recordingId/download-url
   */
  app.post('/api/jobs/:jobId/video-recordings/:recordingId/download-url', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const recordingId = req.params.recordingId;
      const { expirationSeconds = 3600 } = req.body;

      console.log('🔗 Generating download URL for recording:', {
        jobId,
        recordingId,
        expirationSeconds
      });

      // Generate signed URL
      const downloadUrl = await recordingService.generateDownloadUrl(recordingId, expirationSeconds);

      if (downloadUrl) {
        res.json({
          success: true,
          recordingId,
          downloadUrl,
          expiresIn: expirationSeconds,
          expiresAt: new Date(Date.now() + expirationSeconds * 1000).toISOString()
        });

        console.log('✅ Download URL generated:', {
          recordingId,
          expiresIn: expirationSeconds
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'RECORDING_NOT_FOUND',
          message: 'Recording not found or not available for download'
        });
      }

    } catch (error) {
      console.error('❌ Error generating download URL:', error);
      
      res.status(500).json({
        success: false,
        error: 'DOWNLOAD_URL_FAILED',
        message: error instanceof Error ? error.message : 'Failed to generate download URL'
      });
    }
  });

  // ===== HEALTH AND STATUS ROUTES =====

  /**
   * OpenVidu service health check
   * GET /api/video/health
   */
  app.get('/api/video/health', async (req: Request, res: Response) => {
    try {
      const openViduHealth = await openViduService.healthCheck();
      const recordingHealth = await recordingService.healthCheck();

      const overallStatus = openViduHealth.status === 'healthy' && recordingHealth.status === 'healthy'
        ? 'healthy'
        : openViduHealth.status === 'error' || recordingHealth.status === 'error'
        ? 'error'
        : 'warning';

      res.json({
        status: overallStatus,
        services: {
          openvidu: openViduHealth,
          recording: recordingHealth
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error checking video service health:', error);
      
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * Get video service configuration status
   * GET /api/video/config
   */
  app.get('/api/video/config', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Only admin can view config status
      if (req.user && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Admin access required'
        });
      }

      const openViduConfig = openViduService.getConfigStatus();
      const recordingConfig = recordingService.getConfigStatus();

      res.json({
        success: true,
        config: {
          openvidu: openViduConfig,
          recording: recordingConfig,
          activeSessions: openViduService.getActiveSessionsCount(),
          activeRecordings: openViduService.getActiveRecordingsCount()
        }
      });

    } catch (error) {
      console.error('❌ Error getting video config:', error);
      
      res.status(500).json({
        success: false,
        error: 'CONFIG_FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get configuration'
      });
    }
  });

  /**
   * Get OpenVidu configuration for frontend
   * GET /api/video/config
   */
  app.get('/api/video/config', (req: Request, res: Response) => {
    try {
      const config = openViduService.getConfigStatus();
      
      res.json({
        success: true,
        serverUrl: process.env.OPENVIDU_SERVER_URL || 'https://localhost:4443',
        configured: config.configured,
        hasSecret: config.hasSecret
      });
    } catch (error) {
      console.error('Error getting video config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get video configuration'
      });
    }
  });

  /**
   * Generate token for joining existing session
   * POST /api/jobs/:jobId/video-token
   */
  app.post('/api/jobs/:jobId/video-token', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { sessionId, userId, role, displayName }: GenerateTokenRequest = req.body;

      console.log('🎟️ Generating video token:', {
        jobId,
        sessionId,
        userId,
        role
      });

      // Validate request
      if (!sessionId || !userId || !role || !displayName) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: 'sessionId, userId, role, and displayName are required'
        });
      }

      // Check authorization - users can only get tokens for themselves unless they're admin/notary
      if (req.user && req.user.id !== userId) {
        const canGenerateForOthers = ['notary', 'admin'].includes(req.user.role);
        if (!canGenerateForOthers) {
          return res.status(403).json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Cannot generate token for other users'
          });
        }
      }

      // Prepare participant data
      const participantData = JSON.stringify({
        userId,
        role,
        displayName,
        email: req.user?.email || '',
        jobId
      });

      // Generate token
      const token = await openViduService.generateToken(sessionId, {
        data: participantData,
        role: openViduService['mapRoleToOpenViduRole'](role) // Access private method
      });

      res.json({
        success: true,
        token,
        connectionId: `connection-${userId}-${Date.now()}`,
        sessionData: {
          sessionId,
          jobId,
          participant: {
            userId,
            role,
            displayName
          }
        }
      });

    } catch (error) {
      console.error('❌ Error generating video token:', error);
      
      let errorMessage = 'TOKEN_GENERATION_ERROR';
      let statusCode = 500;
      
      if (error instanceof Error) {
        if (error.message.includes('Session') && error.message.includes('not found')) {
          errorMessage = 'SESSION_NOT_FOUND';
          statusCode = 404;
        } else if (error.message.includes('401')) {
          errorMessage = 'OPENVIDU_AUTH_ERROR';
          statusCode = 401;
        }
      }

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        message: error instanceof Error ? error.message : 'Failed to generate video token'
      });
    }
  });

  console.log('📹 OpenVidu video routes registered successfully');
} 