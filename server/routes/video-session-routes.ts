/**
 * Video Session Routes for Daily.co Integration
 * Handles notary video session creation, management, and recording
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { editorSessions, sessionParticipants } from '../../shared/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { dailyApi, type DailyParticipant } from '../lib/daily-api-service';
import { verifyToken, type AuthUser } from '../auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Validation schemas
const createSessionSchema = z.object({
  participants: z.array(z.object({
    id: z.string(),
    name: z.string(),
    role: z.enum(['notary', 'signer', 'witness', 'observer']),
    email: z.string().email().optional()
  })).max(8, 'Maximum 8 participants allowed').min(1, 'At least one participant is required')
});

const recordingActionSchema = z.object({
  action: z.enum(['start', 'stop'])
});

// Helper function to check if database schema exists
const checkDatabaseSchema = async () => {
  try {
    // Try to access the editorSessions table to check if schema exists
    await db.select().from(editorSessions).limit(1);
    return true;
  } catch (error) {
    console.log('⚠️ Database schema not ready:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
};

/**
 * Create a new video session for a notary job
 * POST /api/notary/:jobId/video-session
 */
router.post('/notary/:jobId/video-session',
  verifyToken,
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const { participants } = req.body;

      // Check if database schema exists
      const schemaExists = await checkDatabaseSchema();
      if (!schemaExists) {
        return res.status(503).json({
          error: 'Database schema not ready',
          message: 'Video session database tables are not yet configured. Please run database migrations.'
        });
      }

      // Try to create Daily room
      const room = await dailyApi.createNotaryRoom(jobId);
      
      // Generate tokens for each participant
      const tokens = await Promise.all(
        participants.map((participant: any) =>
          dailyApi.createMeetingToken(room.name, participant)
        )
      );

      // Store session in database
      try {
        // Create the editor session with video session info
        const [session] = await db
          .insert(editorSessions)
          .values({
            jobId: parseInt(jobId),
            sessionId: `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            notaryId: (req.user as AuthUser)?.id || 0,
            status: 'active',
            sessionType: 'notary',
            videoSessionId: room.name,
            isLiveSession: true,
            startedAt: new Date()
          })
          .returning();

        // Create participants
        const participantData = participants.map((p: any) => ({
          sessionId: session.id,
          userId: parseInt(p.id),
          role: p.role,
          userColor: `#${Math.floor(Math.random()*16777215).toString(16)}`,
          joinedAt: new Date()
        }));

        await db.insert(sessionParticipants).values(participantData);

        res.json({
          sessionId: session.sessionId,
          videoSessionId: session.videoSessionId,
          roomUrl: room.url,
          roomName: room.name,
          status: 'active',
          message: 'Video session created successfully',
          participants: participants.map((p: any, index: number) => ({
            ...p,
            token: tokens[index]
          }))
        });
      } catch (dbError) {
        console.error('❌ Database error:', dbError);
        return res.status(500).json({
          error: 'Failed to store session in database',
          message: 'Database operation failed. Please check database configuration.'
        });
      }
    } catch (error) {
      console.error('❌ Failed to create video session:', error);
      res.status(500).json({ 
        error: 'Failed to create video session',
        details: error instanceof Error ? error.message : 'Unknown error',
        message: 'The video session could not be created. The system will fall back to basic functionality.'
      });
    }
  }
);

/**
 * Get existing video session
 * GET /api/notary/:jobId/video-session
 */
router.get('/notary/:jobId/video-session',
  verifyToken,
  async (req, res) => {
    try {
      const { jobId } = req.params;

      // Check if database schema exists
      const schemaExists = await checkDatabaseSchema();
      if (!schemaExists) {
        return res.status(503).json({
          error: 'Database schema not ready',
          message: 'Video session database tables are not yet configured. Please run database migrations.'
        });
      }

      try {
        const [session] = await db
          .select()
          .from(editorSessions)
          .where(
            and(
              eq(editorSessions.jobId, parseInt(jobId)),
              inArray(editorSessions.status, ['active', 'recording'])
            )
          )
          .orderBy(desc(editorSessions.createdAt))
          .limit(1);

        if (!session) {
          return res.status(404).json({ 
            error: 'No active video session found' 
          });
        }

        // Get participants for this session
        const participants = await db
          .select()
          .from(sessionParticipants)
          .where(eq(sessionParticipants.sessionId, session.id));

        // Find current user's participant data
        const userParticipant = participants.find(p => p.userId === (req.user as AuthUser)?.id);
        
        if (!userParticipant) {
          // Instead of returning 403, check if user has access to the job
          // For now, if they're an admin/notary or the job is theirs, return 404 so they can create a new session
          const user = req.user as AuthUser;
          const hasAdminAccess = user.role === 'admin' || user.role === 'notary' || 
                                (user.privileges && (user.privileges.includes('admin') || user.privileges.includes('view_all_jobs')));
          
          if (hasAdminAccess) {
            // Return 404 so the client can create a new session
            return res.status(404).json({ 
              error: 'No active video session found for this user' 
            });
          } else {
            return res.status(403).json({ 
              error: 'User not authorized for this session' 
            });
          }
        }

        // For existing sessions, we need to generate a token for the current user
        await dailyApi.ensureRoom(session.videoSessionId);
        const userToken = await dailyApi.createMeetingToken(session.videoSessionId, {
          id: userParticipant.userId.toString(),
          name: userParticipant.role === 'notary' ? 'Notary' : 'Participant',
          role: userParticipant.role
        });

        res.json({
          sessionId: session.sessionId, // Using sessionId from editorSessions
          videoSessionId: session.videoSessionId,
          roomUrl: session.videoSessionId ? `https://usanotray.daily.co/${session.videoSessionId}` : undefined,
          roomName: session.videoSessionId || 'demo-room',
          status: session.status,
          userRole: userParticipant.role,
          userToken: userToken,
          participantCount: participants.length,
          maxParticipants: 8,
          createdAt: session.createdAt
        });
      } catch (dbError) {
        console.error('❌ Database error:', dbError);
        return res.status(500).json({
          error: 'Database operation failed',
          message: 'Unable to retrieve session from database.'
        });
      }

    } catch (error) {
      console.error('❌ Failed to get video session:', error);
      res.status(500).json({ 
        error: 'Failed to get video session',
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
);

/**
 * Control recording for a video session
 * POST /api/notary/:jobId/recording
 */
router.post('/notary/:jobId/recording',
  verifyToken,
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const { action } = req.body;

      // Check if database schema exists
      const schemaExists = await checkDatabaseSchema();
      if (!schemaExists) {
        return res.status(503).json({
          error: 'Database schema not ready',
          message: 'Video session database tables are not yet configured. Please run database migrations.'
        });
      }

      try {
        // Get active session
        const [session] = await db
          .select()
          .from(editorSessions)
          .where(
            and(
              eq(editorSessions.jobId, parseInt(jobId)),
              inArray(editorSessions.status, ['active', 'recording'])
            )
          )
          .orderBy(desc(editorSessions.createdAt))
          .limit(1);

        if (!session) {
          return res.status(404).json({ 
            error: 'No active video session found' 
          });
        }

        // Get participants and check if user is notary
        const participants = await db
          .select()
          .from(sessionParticipants)
          .where(eq(sessionParticipants.sessionId, session.id));

        const userParticipant = participants.find(p => p.userId === (req.user as AuthUser)?.id);
        const userRole = (req.user as AuthUser)?.role;
        
        // Allow notaries and admins to control recording
        if (!userParticipant || (userParticipant.role !== 'notary' && userRole !== 'admin')) {
          return res.status(403).json({ 
            error: 'Only notaries and admins can control recording' 
          });
        }

        let result;
        if (action === 'start') {
          if (session.status === 'recording') {
            return res.status(409).json({ 
              error: 'Recording already in progress' 
            });
          }

          // Start recording via Daily API
          if (!session.videoSessionId) {
            return res.status(400).json({ 
              error: 'No video session ID found' 
            });
          }
          result = await dailyApi.startRecording(session.videoSessionId);

          // Update session status
          await db
            .update(editorSessions)
            .set({ 
              status: 'recording',
              updatedAt: new Date()
            })
            .where(eq(editorSessions.id, session.id));

          res.json({
            message: 'Recording started successfully',
            recordingId: result.id
          });

        } else if (action === 'stop') {
          if (session.status !== 'recording') {
            return res.status(409).json({ 
              error: 'No recording in progress' 
            });
          }

          // Stop recording via Daily API
          if (!session.videoSessionId) {
            return res.status(400).json({ 
              error: 'No video session ID found' 
            });
          }
          await dailyApi.stopRecording(session.videoSessionId);

          // Update session status
          await db
            .update(editorSessions)
            .set({ 
              status: 'active',
              updatedAt: new Date()
            })
            .where(eq(editorSessions.id, session.id));

          res.json({
            message: 'Recording stopped successfully'
          });
        }

      } catch (dbError) {
        console.error('❌ Database error:', dbError);
        return res.status(500).json({
          error: 'Database operation failed',
          message: 'Unable to update session recording status.'
        });
      }

    } catch (error) {
      console.error('❌ Failed to control recording:', error);
      res.status(500).json({ 
        error: 'Failed to control recording',
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
);

/**
 * End a video session
 * POST /api/notary/:jobId/end-session
 */
router.post('/notary/:jobId/end-session',
  verifyToken,
  async (req, res) => {
    try {
      const { jobId } = req.params;

      // Check if database schema exists
      const schemaExists = await checkDatabaseSchema();
      if (!schemaExists) {
        return res.status(503).json({
          error: 'Database schema not ready',
          message: 'Video session database tables are not yet configured. Please run database migrations.'
        });
      }

      try {
        const [session] = await db
          .select()
          .from(editorSessions)
          .where(
            and(
              eq(editorSessions.jobId, parseInt(jobId)),
              inArray(editorSessions.status, ['active', 'recording'])
            )
          )
          .orderBy(desc(editorSessions.createdAt))
          .limit(1);

        if (!session) {
          return res.status(404).json({ 
            error: 'No active video session found' 
          });
        }

        // Update session status
        await db
          .update(editorSessions)
          .set({ 
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(editorSessions.id, session.id));

        res.json({
          message: 'Session ended successfully'
        });

      } catch (dbError) {
        console.error('❌ Database error:', dbError);
        return res.status(500).json({
          error: 'Database operation failed',
          message: 'Unable to end session in database.'
        });
      }

    } catch (error) {
      console.error('❌ Failed to end session:', error);
      res.status(500).json({ 
        error: 'Failed to end session',
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
);

/**
 * Get recordings for a job
 * GET /api/notary/:jobId/recordings
 */
router.get('/notary/:jobId/recordings',
  verifyToken,
  async (req, res) => {
    try {
      const { jobId } = req.params;

      // Check if database schema exists
      const schemaExists = await checkDatabaseSchema();
      if (!schemaExists) {
        return res.status(503).json({
          error: 'Database schema not ready',
          message: 'Video session database tables are not yet configured. Please run database migrations.'
        });
      }

      try {
        // Get sessions that have video session IDs (indicating they had video)
        const sessions = await db
          .select()
          .from(editorSessions)
          .where(
            and(
              eq(editorSessions.jobId, parseInt(jobId)),
              // Only sessions that have completed and had video
              eq(editorSessions.status, 'completed'),
              // Must have a video session ID
              // Note: We can't directly check for "not null" in Drizzle, so we'll filter client-side
            )
          )
          .orderBy(desc(editorSessions.createdAt));

        // Filter sessions that actually had video sessions
        const videoSessions = sessions.filter(session => session.videoSessionId);

        res.json({
          recordings: videoSessions.map(session => ({
            id: session.videoSessionId, // Using video session ID as recording identifier
            sessionId: session.sessionId,
            status: session.status,
            createdAt: session.createdAt,
            endedAt: session.completedAt
          }))
        });

      } catch (dbError) {
        console.error('❌ Database error:', dbError);
        return res.status(500).json({
          error: 'Database operation failed',
          message: 'Unable to retrieve recordings from database.'
        });
      }

    } catch (error) {
      console.error('❌ Failed to get recordings:', error);
      res.status(500).json({ 
        error: 'Failed to get recordings',
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
);

export default router;