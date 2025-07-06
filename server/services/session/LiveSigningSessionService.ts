import { db } from "../../db";
import { editorSessions, users, sessionParticipantsStatus, liveSessionEvents, documentTags } from "../../../shared/schema";
import { eq, and, or } from "drizzle-orm";
import { withDatabaseProtection } from '../../middleware/circuit-breaker';
import { redisCache } from '../redis-cache';

export enum SigningSessionState {
  WAITING = 'waiting',          // Participants joining, not started
  ACTIVE = 'active',            // Live signing in progress
  PAUSED = 'paused',            // Session paused mid-signing
  COMPLETING = 'completing',    // Finalizing documents
  COMPLETED = 'completed'       // Session ended
}

export interface LiveSigningSession {
  id: number;
  sessionId: string;
  state: SigningSessionState;
  activeUserId?: number;
  startedAt?: Date;
  pausedAt?: Date;
  resumedAt?: Date;
  completedAt?: Date;
  isLiveSession: boolean;
  participants: SessionParticipant[];
}

export interface SessionParticipant {
  userId: number;
  displayName: string;
  userType: 'notary' | 'signer' | 'witness';
  isActive: boolean;
  canInteract: boolean;
  joinedAt?: Date;
  leftAt?: Date;
  lastActivity?: Date;
}

export interface SessionTransitionResult {
  success: boolean;
  newState: SigningSessionState;
  message: string;
  timestamp: Date;
}

export class LiveSigningSessionService {
  
  /**
   * Start a live signing session
   */
  static async startLiveSigningSession(
    sessionId: string, 
    notaryUserId: number
  ): Promise<SessionTransitionResult> {
    try {
      console.log(`🚀 Starting live signing session ${sessionId} by notary ${notaryUserId}`);
      
      // Use circuit breaker protection for database operations
      const result = await withDatabaseProtection(async () => {
        // First, try to find existing editor session by sessionId
        let [session] = await db
          .select()
          .from(editorSessions)
          .where(eq(editorSessions.sessionId, sessionId))
          .limit(1);
        
        // If no session found by sessionId, try to find by jobId (in case sessionId is actually jobId)
        if (!session) {
          const jobIdNum = parseInt(sessionId);
          if (!isNaN(jobIdNum)) {
            console.log(`🔍 No session found with sessionId ${sessionId}, checking if it's a jobId...`);
            [session] = await db
              .select()
              .from(editorSessions)
              .where(eq(editorSessions.jobId, jobIdNum))
              .limit(1);
          }
        }
        
        // If still no session, create a new one for this job
        if (!session) {
          const jobIdNum = parseInt(sessionId);
          if (isNaN(jobIdNum)) {
            throw new Error('Invalid session ID or job ID');
          }
          
          console.log(`🆕 Creating new editor session for job ${jobIdNum}`);
          const newSessionId = `live_${jobIdNum}_${Date.now()}`;
          const [insertedSession] = await db.insert(editorSessions).values({
            sessionId: newSessionId,
            jobId: jobIdNum,
            notaryId: notaryUserId,
            status: 'active',
            sessionType: 'notary',
            isLiveSession: true,
            signingState: 'waiting',
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning();

          if (!insertedSession) {
            throw new Error('Failed to create editor session');
          }

          console.log(`✅ Created new editor session: ${newSessionId}`);
          session = insertedSession;
        }
        
        // Verify user is the notary for this session
        if (session.notaryId !== notaryUserId) {
          throw new Error('Only the assigned notary can start the session');
        }
        
        // Update session to live signing mode
        await db
          .update(editorSessions)
          .set({
            signingState: SigningSessionState.ACTIVE,
            isLiveSession: true,
            startedAt: new Date(),
            activeUserId: notaryUserId,
            updatedAt: new Date()
          })
          .where(eq(editorSessions.id, session.id));
        
        // Log the transition
        await this.logSessionEvent(session.id, notaryUserId, 'session_started', {
          previousState: session.signingState,
          newState: SigningSessionState.ACTIVE,
          startedBy: notaryUserId
        });
        
        return {
          success: true,
          newState: SigningSessionState.ACTIVE,
          message: 'Live signing session started successfully',
          timestamp: new Date()
        };
      }, 'start_live_signing_session');

      // Activate the notary as the initial active user
      await this.setActiveUser(sessionId, notaryUserId);
      
      // Clear cache after state change
      await this.clearSessionCache(sessionId);
      
      console.log(`✅ Live signing session started: ${sessionId}`);
      
      return result;
      
    } catch (error) {
      console.error('Failed to start live signing session:', error);
      throw new Error(`Failed to start session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Clear session cache when state changes
   */
  private static async clearSessionCache(sessionId: string): Promise<void> {
    try {
      const cacheKey = `session:${sessionId}:state`;
      await redisCache.del(cacheKey);
    } catch (error) {
      console.warn('Failed to clear session cache:', error);
      // Don't throw - cache failures shouldn't break the main flow
    }
  }
  
  /**
   * Set the active user who can interact with tags
   */
  static async setActiveUser(sessionId: string, userId: number): Promise<void> {
    try {
      // Use circuit breaker protection for database operations
      await withDatabaseProtection(async () => {
        // Get session - try sessionId first, then jobId
        let [session] = await db
          .select()
          .from(editorSessions)
          .where(eq(editorSessions.sessionId, sessionId))
          .limit(1);
        
        if (!session) {
          const jobIdNum = parseInt(sessionId);
          if (!isNaN(jobIdNum)) {
            [session] = await db
              .select()
              .from(editorSessions)
              .where(eq(editorSessions.jobId, jobIdNum))
              .limit(1);
          }
        }
        
        if (!session) {
          throw new Error('Session not found');
        }
        
        // Update active user
        await db
          .update(editorSessions)
          .set({
            activeUserId: userId,
            updatedAt: new Date()
          })
          .where(eq(editorSessions.id, session.id));
        
        // Update participant status with error handling
        try {
          await db
            .update(sessionParticipantsStatus)
            .set({ isActive: false })
            .where(eq(sessionParticipantsStatus.sessionId, session.id));
          
          await db
            .update(sessionParticipantsStatus)
            .set({ 
              isActive: true, 
              lastActivity: new Date(),
              canInteract: true 
            })
            .where(and(
              eq(sessionParticipantsStatus.sessionId, session.id),
              eq(sessionParticipantsStatus.userId, userId)
            ));
        } catch (participantError) {
          console.warn('Failed to update participant status:', participantError);
          // Don't throw - this is not critical for the main flow
        }
        
        // Log the user activation
        await this.logSessionEvent(session.id, userId, 'user_activated', {
          activeUserId: userId
        });
        
        console.log(`👤 Active user set to ${userId} in session ${sessionId}`);
        
      }, 'set_active_user');
      
      // Clear cache after state change
      await this.clearSessionCache(sessionId);
      
    } catch (error) {
      console.error('Failed to set active user:', error);
      throw error;
    }
  }
  
  /**
   * Pause a live signing session
   */
  static async pauseSession(
    sessionId: string, 
    userId: number, 
    reason?: string
  ): Promise<SessionTransitionResult> {
    try {
      let [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.sessionId, sessionId))
        .limit(1);
      
      if (!session) {
        const jobIdNum = parseInt(sessionId);
        if (!isNaN(jobIdNum)) {
          [session] = await db
            .select()
            .from(editorSessions)
            .where(eq(editorSessions.jobId, jobIdNum))
            .limit(1);
        }
      }
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      if (session.signingState !== SigningSessionState.ACTIVE) {
        throw new Error('Can only pause active sessions');
      }
      
      // Update session state
      await db
        .update(editorSessions)
        .set({
          signingState: SigningSessionState.PAUSED,
          pausedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(editorSessions.id, session.id));
      
      // Log the pause
      await this.logSessionEvent(session.id, userId, 'session_paused', {
        reason: reason || 'Manual pause',
        pausedBy: userId
      });
      
      console.log(`⏸️ Session paused: ${sessionId} by user ${userId}`);
      
      return {
        success: true,
        newState: SigningSessionState.PAUSED,
        message: 'Session paused successfully',
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('Failed to pause session:', error);
      throw error;
    }
  }
  
  /**
   * Resume a paused session
   */
  static async resumeSession(sessionId: string, userId: number): Promise<SessionTransitionResult> {
    try {
      let [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.sessionId, sessionId))
        .limit(1);
      
      if (!session) {
        const jobIdNum = parseInt(sessionId);
        if (!isNaN(jobIdNum)) {
          [session] = await db
            .select()
            .from(editorSessions)
            .where(eq(editorSessions.jobId, jobIdNum))
            .limit(1);
        }
      }
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      if (session.signingState !== SigningSessionState.PAUSED) {
        throw new Error('Can only resume paused sessions');
      }
      
      // Update session state
      await db
        .update(editorSessions)
        .set({
          signingState: SigningSessionState.ACTIVE,
          resumedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(editorSessions.id, session.id));
      
      // Log the resume
      await this.logSessionEvent(session.id, userId, 'session_resumed', {
        resumedBy: userId
      });
      
      console.log(`▶️ Session resumed: ${sessionId} by user ${userId}`);
      
      return {
        success: true,
        newState: SigningSessionState.ACTIVE,
        message: 'Session resumed successfully',
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('Failed to resume session:', error);
      throw error;
    }
  }
  
  /**
   * Get current session state and participants
   */
  static async getSessionState(sessionId: string): Promise<LiveSigningSession> {
    const cacheKey = `session:${sessionId}:state`;
    
    try {
      // Try to get from cache first
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Use circuit breaker protection for database operations
      const result = await withDatabaseProtection(async () => {
        // First, try to find existing editor session by sessionId
        let [session] = await db
          .select()
          .from(editorSessions)
          .where(eq(editorSessions.sessionId, sessionId))
          .limit(1);
        
        // If no session found by sessionId, try to find by jobId (in case sessionId is actually jobId)
        if (!session) {
          const jobIdNum = parseInt(sessionId);
          if (!isNaN(jobIdNum)) {
            [session] = await db
              .select()
              .from(editorSessions)
              .where(eq(editorSessions.jobId, jobIdNum))
              .limit(1);
          }
        }
        
        if (!session) {
          throw new Error('Session not found');
        }
        
        // Get participants with circuit breaker protection
        const participants = await this.getSessionParticipants(session.id);
        
        return {
          id: session.id,
          sessionId: session.sessionId,
          state: session.signingState as SigningSessionState,
          activeUserId: session.activeUserId || undefined,
          startedAt: session.startedAt || undefined,
          pausedAt: session.pausedAt || undefined,
          resumedAt: session.resumedAt || undefined,
          completedAt: session.completedAt || undefined,
          isLiveSession: session.isLiveSession || false,
          participants
        };
      }, 'get_session_state');

      // Cache the result for 30 seconds
      await redisCache.set(cacheKey, result, 30);
      
      return result;
      
    } catch (error) {
      console.error('Failed to get session state:', error);
      throw error;
    }
  }
  
  /**
   * Get session participants with status
   */
  static async getSessionParticipants(sessionDbId: number): Promise<SessionParticipant[]> {
    try {
      console.log(`🔍 Getting participants for session ${sessionDbId}`);
      
      // First, get the session to validate it exists
      const [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.id, sessionDbId))
        .limit(1);
      
      if (!session) {
        console.warn(`Session ${sessionDbId} not found`);
        return [];
      }

      // Initialize participants array
      let participants: SessionParticipant[] = [];

      // Try to get participants from session_participants_status table first
      try {
        const statusParticipants = await db
          .select()
          .from(sessionParticipantsStatus)
          .where(eq(sessionParticipantsStatus.sessionId, sessionDbId));

        console.log(`📊 Found ${statusParticipants.length} participants in status table`);

        // If we have participants in status table, get their user details
        if (statusParticipants.length > 0) {
          for (const statusParticipant of statusParticipants) {
            try {
              const [user] = await db
                .select({
                  id: users.id,
                  firstName: users.firstName,
                  lastName: users.lastName,
                  username: users.username,
                  userType: users.role // Use role field as userType
                })
                .from(users)
                .where(eq(users.id, statusParticipant.userId))
                .limit(1);

              if (user) {
                participants.push({
                  userId: user.id,
                  displayName: user.firstName || user.username || 'Unknown User',
                  userType: (user.userType === 'notary' ? 'notary' : 'signer') as 'notary' | 'signer' | 'witness',
                  isActive: statusParticipant.isActive || false,
                  canInteract: statusParticipant.canInteract || false,
                  joinedAt: statusParticipant.joinedAt || undefined,
                  leftAt: statusParticipant.leftAt || undefined,
                  lastActivity: statusParticipant.lastActivity || undefined
                });
              }
            } catch (userError) {
              console.warn(`Failed to get user details for participant ${statusParticipant.userId}:`, userError);
            }
          }
        }
      } catch (statusError) {
        console.warn('Failed to query session participants status table:', statusError);
      }

      // If no participants found in status table, fall back to job-based participants
      if (participants.length === 0) {
        console.log(`🔄 No participants in status table, falling back to job-based participants for job ${session.jobId}`);
        
        try {
          const { jobs, signers } = await import("../../../shared/schema");
          
          // Get job details
          const [job] = await db
            .select()
            .from(jobs)
            .where(eq(jobs.id, session.jobId))
            .limit(1);
          
          if (job) {
            console.log(`🔍 Job data for participants:`, {
              jobId: job.id,
              selectedNotary: job.selectedNotary,
              notaryId: job.notaryId,
              hasSignerDetails: !!job.selectedNotary || !!job.notaryId
            });
            
            // Add notary if available
            const notaryId = job.notaryId || (job.selectedNotary ? parseInt(job.selectedNotary) : null);
            if (notaryId) {
              try {
                const [notary] = await db
                  .select({
                    id: users.id,
                    firstName: users.firstName,
                    lastName: users.lastName,
                    username: users.username
                  })
                  .from(users)
                  .where(eq(users.id, notaryId))
                  .limit(1);
                
                if (notary) {
                  participants.push({
                    userId: notary.id,
                    displayName: notary.firstName || notary.username || 'Notary',
                    userType: 'notary',
                    isActive: session.activeUserId === notary.id,
                    canInteract: true,
                    joinedAt: undefined,
                    leftAt: undefined,
                    lastActivity: undefined
                  });
                  console.log(`✅ Added real notary: ${notary.firstName || notary.username}`);
                }
              } catch (notaryError) {
                console.warn(`Failed to get notary details for ID ${notaryId}:`, notaryError);
              }
            }
            
            // Add signers from signers table
            try {
              const jobSigners = await db
                .select()
                .from(signers)
                .where(eq(signers.jobId, session.jobId));
              
              console.log(`📝 Found ${jobSigners.length} signers for job ${session.jobId}`);
              
              for (const signer of jobSigners) {
                participants.push({
                  userId: signer.id, // Use signer ID, not user ID
                  displayName: signer.signerName,
                  userType: 'signer',
                  isActive: false,
                  canInteract: false,
                  joinedAt: undefined,
                  leftAt: undefined,
                  lastActivity: undefined
                });
                console.log(`✅ Added real signer: ${signer.signerName}`);
              }
            } catch (signerError) {
              console.warn('Could not fetch signers:', signerError);
            }
          }
        } catch (jobError) {
          console.warn('Could not fetch job participants:', jobError);
        }
      }
      
      console.log(`✅ Session participants: ${participants.length} total (${participants.filter(p => p.userType === 'notary').length} notaries, ${participants.filter(p => p.userType === 'signer').length} signers)`);
      
      return participants;
      
    } catch (error) {
      console.error('Failed to get session participants:', error);
      return [];
    }
  }
  
  /**
   * Log session events for audit trail
   */
  static async logSessionEvent(
    sessionDbId: number, 
    userId: number, 
    eventType: string, 
    eventData: any
  ): Promise<void> {
    try {
      await db
        .insert(liveSessionEvents)
        .values({
          sessionId: sessionDbId,
          userId,
          eventType,
          eventData: JSON.stringify(eventData),
          timestamp: new Date()
        });
      
    } catch (error) {
      console.error('Failed to log session event:', error);
      // Don't throw - logging failures shouldn't break the main flow
    }
  }
  
  /**
   * Check if user can interact with tags (is active user)
   */
  static async canUserInteract(sessionId: string, userId: number): Promise<boolean> {
    try {
      let [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.sessionId, sessionId))
        .limit(1);
      
      if (!session) {
        const jobIdNum = parseInt(sessionId);
        if (!isNaN(jobIdNum)) {
          [session] = await db
            .select()
            .from(editorSessions)
            .where(eq(editorSessions.jobId, jobIdNum))
            .limit(1);
        }
      }
      
      if (!session) {
        return false;
      }
      
      // In live session, only active user can interact
      if (session.isLiveSession) {
        return session.activeUserId === userId;
      }
      
      // In tagging mode, all authorized users can interact
      return true;
      
    } catch (error) {
      console.error('Failed to check user interaction permission:', error);
      return false;
    }
  }
} 