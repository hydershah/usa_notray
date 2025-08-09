import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { editorSessions, sessionParticipantsStatus, liveSessionEvents, users, documentTags } from '../../../shared/schema';
import { redisCache } from '../redis-cache';
import { withDatabaseProtection } from '../../middleware/circuit-breaker';

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
  sessionId?: string; // Added for clarity in the new_code
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
        let session = null;
        
        // Execute parallel queries for better performance
        const [sessionResults, userResult] = await Promise.all([
          // Query 1: Try to find existing editor session by sessionId
          db
            .select()
            .from(editorSessions)
            .where(eq(editorSessions.sessionId, sessionId))
            .limit(1),
          // Query 2: Get user permissions (we'll need this anyway)
          db
            .select({ role: users.role, privileges: users.privileges })
            .from(users)
            .where(eq(users.id, notaryUserId))
            .limit(1)
        ]);
        
        session = sessionResults[0];
        const currentUser = userResult[0];
        
        // Strategy 2: If no session found by sessionId, look for existing sessions by jobId
        if (!session) {
          const jobIdNum = parseInt(sessionId);
          if (!isNaN(jobIdNum)) {
            // Look for existing sessions for this job
            const existingSessions = await db
              .select()
              .from(editorSessions)
              .where(
                and(
                  eq(editorSessions.jobId, jobIdNum),
                  eq(editorSessions.isLiveSession, true)
                )
              )
              .orderBy(desc(editorSessions.createdAt))
              .limit(1);
            
            if (existingSessions.length > 0) {
              session = existingSessions[0];
              console.log(`📄 Found existing session ${session.sessionId} for job ${jobIdNum}`);
              
              // Check if session is already in progress
              if (session.signingState === 'active' || session.signingState === 'paused') {
                console.log(`⚠️ Session ${session.sessionId} is already in progress (${session.signingState})`);
                
                // Return existing session state without modification
                return {
                  success: true,
                  newState: session.signingState === 'active' ? SigningSessionState.ACTIVE : SigningSessionState.PAUSED,
                  state: session.signingState as 'active' | 'paused',
                  message: `Session is already ${session.signingState}`,
                  timestamp: new Date(),
                  sessionId: session.sessionId
                };
              } else if (session.signingState === 'completed') {
                console.log(`✅ Creating new session as previous one is completed`);
              } else {
                console.log(`♻️ Reusing existing session ${session.sessionId}`);
              }
            }
          }
        }
        
        // Strategy 3: If still no session, create a new one for this job
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
        
        // Verify user is the notary for this session or is an admin
        const isAdmin = currentUser?.role === 'admin' || (currentUser?.privileges && currentUser.privileges.includes('admin'));
        const isAssignedNotary = session.notaryId === notaryUserId;
        
        if (!isAssignedNotary && !isAdmin) {
          throw new Error('Only the assigned notary or admin can start the session');
        }
        
        // **CRITICAL FIX**: Transition existing session to live signing mode (preserve tags!)
        // Only update if not already active
        if (session.signingState !== 'active') {
          console.log(`🔄 Transitioned session ${session.sessionId} to live signing mode (tags preserved)`);
          
          // Execute both updates in parallel for better performance
          await Promise.all([
            // Update 1: Set signing state to active
            db.update(editorSessions)
              .set({
                signingState: 'active',
                isLiveSession: true,
                status: 'active',
                updatedAt: new Date()
              })
              .where(eq(editorSessions.sessionId, session.sessionId)),
            
            // Update 2: Set active user (if needed)
            this.setActiveUser(session.sessionId, notaryUserId)
          ]);

          // Invalidate caches that affect session state visibility immediately
          try {
            const { SmartCacheInvalidation } = await import('../smart-cache-invalidation');
            await SmartCacheInvalidation.invalidateByContext({
              sessionId: session.sessionId,
              operationType: 'session_state_change'
            });
          } catch (invalidateError) {
            console.warn('⚠️ Smart cache invalidation failed:', invalidateError);
          }
        }
        
        // Clear session cache to ensure fresh data
        if (!redisCache.isRedisDisabled()) {
          await Promise.all([
            redisCache.delPattern(`session:${session.sessionId}:*`),
            redisCache.delPattern(`job:*:session:${session.jobId}:*`)
          ]);
          console.log(`🧹 Cleared session cache for ${session.sessionId}`);
        }
        
        console.log(`✅ Live signing session started: ${session.sessionId}`);
        
        return {
          success: true,
          newState: SigningSessionState.ACTIVE,
          state: 'active',
          message: 'Live signing session started',
          timestamp: new Date(),
          sessionId: session.sessionId
        };
      }, 'start_live_signing_session');
      
      return result;
      
    } catch (error) {
      console.error('Failed to start live signing session:', error);
      throw error;
    }
  }
  
  /**
   * Clear session cache when state changes - OPTIMIZED VERSION
   */
  private static async clearSessionCache(sessionId: string): Promise<void> {
    try {
      const keys = [
        `session:${sessionId}:state`,
        `session:*:participants`, // Clear participants cache pattern
        `job:${sessionId}:*` // Clear job-related caches
      ];
      
      for (const key of keys) {
        if (key.includes('*')) {
          // Handle pattern-based deletion
          await redisCache.delPattern(key);
        } else {
          await redisCache.del(key);
        }
      }
      
      console.log(`🧹 Cleared session cache for ${sessionId}`);
    } catch (error) {
      console.warn('Failed to clear session cache:', error);
      // Don't throw - cache failures shouldn't break the main flow
    }
  }
  
  /**
   * Set the active user for a session
   */
  static async setActiveUser(
    sessionId: string, 
    userId: number
  ): Promise<void> {
    try {
      console.log(`👤 Active user set to ${userId} in session ${sessionId}`);
      
      await db.update(editorSessions)
        .set({
          activeUserId: userId,
          updatedAt: new Date()
        })
        .where(eq(editorSessions.sessionId, sessionId));
      
      // Clear relevant caches
      if (!redisCache.isRedisDisabled()) {
        await Promise.all([
          redisCache.delPattern(`session:${sessionId}:*`),
          redisCache.delPattern(`job:*:session:${sessionId}:*`)
        ]);
        console.log(`🧹 Cleared session cache for ${sessionId}`);
      }
      
      console.log(`✅ Live signing session started: ${sessionId}`);
      
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
   * Get current session state and participants - ULTRA OPTIMIZED VERSION
   */
  static async getSessionStateOptimized(sessionId: string): Promise<LiveSigningSession> {
    try {
      // Use circuit breaker protection for database operations
      const result = await withDatabaseProtection(async () => {
        // STEP 1: Single optimized query to get session data with fallback logic
        let sessionQuery = db
          .select({
            id: editorSessions.id,
            sessionId: editorSessions.sessionId,
            jobId: editorSessions.jobId,
            signingState: editorSessions.signingState,
            activeUserId: editorSessions.activeUserId,
            startedAt: editorSessions.startedAt,
            pausedAt: editorSessions.pausedAt,
            resumedAt: editorSessions.resumedAt,
            completedAt: editorSessions.completedAt,
            isLiveSession: editorSessions.isLiveSession
          })
          .from(editorSessions);
        
        // Try by sessionId first, fallback to jobId if needed
        let [session] = await sessionQuery
          .where(eq(editorSessions.sessionId, sessionId))
          .limit(1);
        
        if (!session && !isNaN(parseInt(sessionId))) {
          [session] = await sessionQuery
            .where(eq(editorSessions.jobId, parseInt(sessionId)))
            .orderBy(desc(editorSessions.updatedAt))
            .limit(1);
        }
        
        if (!session) {
          throw new Error('Session not found');
        }
        
        // STEP 2: Ultra-fast participants query with minimal data
        const participants = await this.getSessionParticipantsOptimized(session.id);
        
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
      }, 'get_session_state_optimized');

      return result;
      
    } catch (error) {
      console.error('Failed to get session state (optimized):', error);
      throw error;
    }
  }

  /**
   * Get session participants - ULTRA OPTIMIZED VERSION V2
   */
  static async getSessionParticipantsOptimized(sessionDbId: number): Promise<SessionParticipant[]> {
    const cacheKey = `participants:${sessionDbId}:v2`;
    
    try {
      // Check cache first
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // ULTRA OPTIMIZED: Single query with minimal data - no complex JOINs
      const startTime = Date.now();
      
      const participantsData = await db
        .select({
          userId: sessionParticipantsStatus.userId,
          isActive: sessionParticipantsStatus.isActive,
          canInteract: sessionParticipantsStatus.canInteract,
        })
        .from(sessionParticipantsStatus)
        .where(eq(sessionParticipantsStatus.sessionId, sessionDbId));

      const queryTime = Date.now() - startTime;
      
      if (participantsData.length === 0) {
        console.log(`📭 No participants found for session ${sessionDbId}`);
        // PERFORMANCE FIX: Aggressively cache empty results to prevent repeated slow queries
        try {
          await redisCache.set(cacheKey, [], 1800); // Cache empty result for 30 minutes
          console.log(`💾 Cached empty participants for session ${sessionDbId} (30min TTL)`);
        } catch (cacheError) {
          console.warn('Failed to cache empty participants:', cacheError);
        }
        return [];
      }

      // Get user details in bulk with single query
      const userIds = participantsData.map(p => p.userId);
      
      // Safety check: if no participants, return empty array
      if (userIds.length === 0) {
        console.log('⚠️  No participants found for session', sessionDbId);
        await redisCache.set(cacheKey, [], 300); // Cache empty result for 5 minutes
        return [];
      }
      
      const usersData = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          role: users.role
        })
        .from(users)
        .where(inArray(users.id, userIds));

      // Create user lookup map for O(1) access
      const userMap = new Map(usersData.map(u => [u.id, u]));

      // Fast conversion with map lookup
      const participants = participantsData.map(p => {
        const user = userMap.get(p.userId);
        return {
          userId: p.userId,
          displayName: user?.firstName || user?.username || 'User',
          userType: (user?.role === 'notary' ? 'notary' : 'signer') as 'notary' | 'signer' | 'witness',
          isActive: p.isActive || false,
          canInteract: p.canInteract || true,
          joinedAt: undefined, // Skip for performance
          leftAt: undefined,   // Skip for performance  
          lastActivity: undefined // Skip for performance
        };
      });

      console.log(`⚡ Ultra-fast participants query: ${queryTime}ms for ${participants.length} participants`);

      // Cache for 60 seconds
      try {
        await redisCache.set(cacheKey, participants, 60);
      } catch (cacheError) {
        console.warn('Failed to cache participants:', cacheError);
      }

      return participants;
      
    } catch (error) {
      console.warn(`❌ Participants query failed for session ${sessionDbId}:`, error);
      return [];
    }
  }
  
  /**
   * Get current session state and participants - OPTIMIZED VERSION
   */
  static async getSessionState(sessionId: string): Promise<LiveSigningSession> {
    const cacheKey = `session:${sessionId}:state`;
    
    try {
      // Try to get from cache first with debug logging
      const startTime = Date.now();
      const cached = await redisCache.get(cacheKey);
      const cacheTime = Date.now() - startTime;
      
      if (cached) {
        console.log(`📦 Cache HIT: session state for ${sessionId} (${cacheTime.toFixed(2)}ms)`);
        return cached;
      }
      
      console.log(`🔍 Cache MISS: session state for ${sessionId} (${cacheTime.toFixed(2)}ms)`);

      // Use circuit breaker protection for database operations
      const dbStartTime = Date.now();
      const result = await withDatabaseProtection(async () => {
        // OPTIMIZED: Single query to get session data
        let [session] = await db
          .select({
            id: editorSessions.id,
            sessionId: editorSessions.sessionId,
            jobId: editorSessions.jobId,
            signingState: editorSessions.signingState,
            activeUserId: editorSessions.activeUserId,
            startedAt: editorSessions.startedAt,
            pausedAt: editorSessions.pausedAt,
            resumedAt: editorSessions.resumedAt,
            completedAt: editorSessions.completedAt,
            isLiveSession: editorSessions.isLiveSession
          })
          .from(editorSessions)
          .where(eq(editorSessions.sessionId, sessionId))
          .limit(1);
        
        // If no session found by sessionId, try to find by jobId (in case sessionId is actually jobId)
        if (!session) {
          const jobIdNum = parseInt(sessionId);
          if (!isNaN(jobIdNum)) {
            [session] = await db
              .select({
                id: editorSessions.id,
                sessionId: editorSessions.sessionId,
                jobId: editorSessions.jobId,
                signingState: editorSessions.signingState,
                activeUserId: editorSessions.activeUserId,
                startedAt: editorSessions.startedAt,
                pausedAt: editorSessions.pausedAt,
                resumedAt: editorSessions.resumedAt,
                completedAt: editorSessions.completedAt,
                isLiveSession: editorSessions.isLiveSession
              })
              .from(editorSessions)
              .where(eq(editorSessions.jobId, jobIdNum))
              .limit(1);
          }
        }
        
        if (!session) {
          throw new Error('Session not found');
        }
        
        // Get participants with optimized query
        const participantsStartTime = Date.now();
        const participants = await this.getSessionParticipants(session.id);
        const participantsTime = Date.now() - participantsStartTime;
        
        console.log(`✅ DATABASE:get_session_state succeeded in ${Date.now() - dbStartTime}ms (participants: ${participantsTime}ms)`);
        
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

      // Cache the result for 30 seconds with better error handling
      try {
        const setCacheStartTime = Date.now();
        await redisCache.set(cacheKey, result, 30);
        const setCacheTime = Date.now() - setCacheStartTime;
        
        if (setCacheTime > 20) {
          console.log(`🐌 Slow Redis SET: ${cacheKey} (${setCacheTime.toFixed(2)}ms)`);
        }
      } catch (cacheError) {
        console.warn('Failed to cache session state:', cacheError);
        // Don't throw - continue without caching
      }
      
      return result;
      
    } catch (error) {
      console.error('Failed to get session state:', error);
      throw error;
    }
  }
  
  /**
   * Get session participants with status - OPTIMIZED VERSION
   */
  static async getSessionParticipants(sessionDbId: number): Promise<SessionParticipant[]> {
    const cacheKey = `session:${sessionDbId}:participants`;
    
    try {
      // Try to get from cache first with shorter TTL to allow updates
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`📦 Cache HIT: participants for session ${sessionDbId}`);
        return cached;
      }
      
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

      let participants: SessionParticipant[] = [];

      // OPTIMIZED: Try to get participants from session_participants_status table with JOIN
      try {
        const statusParticipants = await db
          .select({
            userId: sessionParticipantsStatus.userId,
            isActive: sessionParticipantsStatus.isActive,
            canInteract: sessionParticipantsStatus.canInteract,
            joinedAt: sessionParticipantsStatus.joinedAt,
            leftAt: sessionParticipantsStatus.leftAt,
            lastActivity: sessionParticipantsStatus.lastActivity,
            firstName: users.firstName,
            lastName: users.lastName,
            username: users.username,
            role: users.role
          })
          .from(sessionParticipantsStatus)
          .innerJoin(users, eq(sessionParticipantsStatus.userId, users.id))
          .where(eq(sessionParticipantsStatus.sessionId, sessionDbId));

        console.log(`📊 Found ${statusParticipants.length} participants in status table`);

        // Convert to participants array with single query
        if (statusParticipants.length > 0) {
          participants = statusParticipants.map(participant => ({
            userId: participant.userId,
            displayName: participant.firstName || participant.username || 'Unknown User',
            userType: (participant.role === 'notary' ? 'notary' : 'signer') as 'notary' | 'signer' | 'witness',
            isActive: participant.isActive || false,
            canInteract: participant.canInteract || false,
            joinedAt: participant.joinedAt || undefined,
            leftAt: participant.leftAt || undefined,
            lastActivity: participant.lastActivity || undefined
          }));
        }
      } catch (statusError) {
        console.warn('Failed to query session participants status table:', statusError);
      }

      // OPTIMIZED: If no participants found in status table, use job-based participants with JOINs
      if (participants.length === 0) {
        console.log(`🔄 No participants in status table, falling back to job-based participants for job ${session.jobId}`);
        
        try {
          const { jobs, signers } = await import("../../../shared/schema");
          
          // OPTIMIZED: Get job with notary details in one query
          const [jobWithNotary] = await db
            .select({
              jobId: jobs.id,
              selectedNotary: jobs.selectedNotary,
              notaryId: jobs.notaryId,
              notaryFirstName: users.firstName,
              notaryLastName: users.lastName,
              notaryUsername: users.username
            })
            .from(jobs)
            .leftJoin(users, eq(jobs.notaryId, users.id))
            .where(eq(jobs.id, session.jobId))
            .limit(1);
          
          if (jobWithNotary) {
            console.log(`🔍 Job data for participants:`, {
              jobId: jobWithNotary.jobId,
              selectedNotary: jobWithNotary.selectedNotary,
              notaryId: jobWithNotary.notaryId,
              hasNotaryData: !!jobWithNotary.notaryFirstName
            });
            
            // Add notary if available
            if (jobWithNotary.notaryId && jobWithNotary.notaryFirstName) {
              participants.push({
                userId: jobWithNotary.notaryId,
                displayName: jobWithNotary.notaryFirstName || jobWithNotary.notaryUsername || 'Notary',
                userType: 'notary',
                isActive: session.activeUserId === jobWithNotary.notaryId,
                canInteract: true,
                joinedAt: undefined,
                leftAt: undefined,
                lastActivity: undefined
              });
              console.log(`✅ Added notary: ${jobWithNotary.notaryFirstName || jobWithNotary.notaryUsername}`);
            }
            
            // OPTIMIZED: Get all signers in one query
            const jobSigners = await db
              .select()
              .from(signers)
              .where(eq(signers.jobId, session.jobId));
              
            console.log(`📝 Found ${jobSigners.length} signers for job ${session.jobId}`);
            
            for (const signer of jobSigners) {
              // Find the actual user ID by email
              let actualUserId = signer.id; // Default fallback
              const [signerUser] = await db
                .select()
                .from(users)
                .where(eq(users.email, signer.signerEmail))
                .limit(1);
              
              if (signerUser) {
                actualUserId = signerUser.id;
                console.log(`🔗 Mapped signer "${signer.signerName}" (${signer.signerEmail}) to user ID ${actualUserId}`);
              } else {
                console.warn(`⚠️ No user found for signer email: ${signer.signerEmail}, using signer ID ${signer.id}`);
              }
              
              participants.push({
                userId: actualUserId, // Use actual user ID, not signer record ID
                displayName: signer.signerName,
                userType: 'signer',
                isActive: false,
                canInteract: false,
                joinedAt: undefined,
                leftAt: undefined,
                lastActivity: undefined
              });
              console.log(`✅ Added signer: ${signer.signerName} with user ID ${actualUserId}`);
            }
          }
        } catch (jobError) {
          console.warn('Could not fetch job participants:', jobError);
        }
      }
      
      // Deduplicate participants by userId - if someone is both notary and signer, prioritize notary role
      const uniqueParticipants = new Map<number, SessionParticipant>();
      
      for (const participant of participants) {
        const existingParticipant = uniqueParticipants.get(participant.userId);
        
        if (!existingParticipant) {
          uniqueParticipants.set(participant.userId, participant);
        } else {
          // If user exists, prioritize notary role over signer
          if (participant.userType === 'notary' && existingParticipant.userType === 'signer') {
            uniqueParticipants.set(participant.userId, participant);
            console.log(`🔄 User ${participant.userId} is both notary and signer - prioritizing notary role`);
          }
        }
      }
      
      const deduplicatedParticipants = Array.from(uniqueParticipants.values());
      
      console.log(`✅ Session participants: ${deduplicatedParticipants.length} total (${deduplicatedParticipants.filter(p => p.userType === 'notary').length} notaries, ${deduplicatedParticipants.filter(p => p.userType === 'signer').length} signers)`);
      
      // Cache the result for 15 seconds (shorter TTL for active sessions)
      await redisCache.set(cacheKey, deduplicatedParticipants, 15);
      
      return deduplicatedParticipants;
      
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

  /**
   * Complete a live signing session
   */
  static async completeSession(sessionId: string, userId: number): Promise<void> {
    try {
      // Get session
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
      
      // Update session state to completed
      await db
        .update(editorSessions)
        .set({
          signingState: SigningSessionState.COMPLETED,
          completedAt: new Date(),
          status: 'completed',
          updatedAt: new Date()
        })
        .where(eq(editorSessions.id, session.id));
      
      // Log completion event
      await db.insert(liveSessionEvents).values({
        sessionId: session.id,
        userId: userId,
        eventType: 'session_completed',
        eventData: {
          completedBy: userId,
          completedAt: new Date().toISOString()
        },
        timestamp: new Date()
      });
      
      // Clear any cached data
      const cacheKey = `session_state:${sessionId}`;
      await redisCache.del(cacheKey);
      
      console.log(`✅ Live signing session completed: ${sessionId} by user ${userId}`);
      
    } catch (error) {
      console.error('Failed to complete session:', error);
      throw error;
    }
  }
} 