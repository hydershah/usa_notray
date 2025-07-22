import { redisCache } from './redis-cache';
import jwt from 'jsonwebtoken';

interface SessionInfo {
  userId: number;
  email: string;
  role: string;
  privileges?: string[];
  loginTime: number;
  lastActivity: number;
  userAgent?: string;
  ipAddress?: string;
  sessionId: string;
}

interface TokenPayload {
  id: number;
  email: string;
  role: string;
  privileges?: string[];
  iat?: number;
  exp?: number;
}

export class SessionManagementService {
  private static readonly TOKEN_BLACKLIST_PREFIX = 'blacklist:token:';
  private static readonly USER_SESSION_PREFIX = 'session:user:';
  private static readonly SESSION_INFO_PREFIX = 'session:info:';
  private static readonly SERVER_START_KEY = 'server:start_time';
  private static readonly ALL_SESSIONS_KEY = 'sessions:active';
  
  // Token blacklist TTL should match JWT expiration (24h = 86400 seconds)
  private static readonly TOKEN_BLACKLIST_TTL = 86400;
  private static readonly SESSION_TTL = 86400; // 24 hours
  private static readonly CLEANUP_INTERVAL = 3600; // 1 hour

  /**
   * Initialize session management - called on server startup
   */
  static async initialize(): Promise<void> {
    try {
      // Record server start time
      const serverStartTime = Date.now();
      await redisCache.set(this.SERVER_START_KEY, serverStartTime);
      
      console.log('🚀 Session Management initialized');
      console.log(`📅 Server start time: ${new Date(serverStartTime).toISOString()}`);
      
      // Clean up old sessions
      await this.cleanupExpiredSessions();
      
      // Set up periodic cleanup
      setInterval(() => {
        this.cleanupExpiredSessions().catch(err => {
          console.error('Session cleanup error:', err);
        });
      }, this.CLEANUP_INTERVAL * 1000);
      
    } catch (error) {
      console.error('❌ Failed to initialize session management:', error);
    }
  }

  /**
   * Create a new session when user logs in
   */
  static async createSession(tokenPayload: TokenPayload, req: any): Promise<string> {
    try {
      const sessionId = this.generateSessionId();
      const now = Date.now();
      
      const sessionInfo: SessionInfo = {
        userId: tokenPayload.id,
        email: tokenPayload.email,
        role: tokenPayload.role,
        privileges: tokenPayload.privileges || [],
        loginTime: now,
        lastActivity: now,
        userAgent: req.headers['user-agent'] || 'unknown',
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        sessionId
      };

      // Store session info
      await redisCache.set(
        `${this.SESSION_INFO_PREFIX}${sessionId}`, 
        sessionInfo, 
        this.SESSION_TTL
      );

      // Track user's active sessions
      const userSessionsKey = `${this.USER_SESSION_PREFIX}${tokenPayload.id}`;
      const userSessions = await redisCache.get<string[]>(userSessionsKey) || [];
      userSessions.push(sessionId);
      await redisCache.set(userSessionsKey, userSessions, this.SESSION_TTL);

      // Add to global active sessions list
      const activeSessions = await redisCache.get<string[]>(this.ALL_SESSIONS_KEY) || [];
      activeSessions.push(sessionId);
      await redisCache.set(this.ALL_SESSIONS_KEY, activeSessions, this.SESSION_TTL);

      console.log(`✅ Session created: ${sessionId} for user ${tokenPayload.id} (${tokenPayload.email})`);
      return sessionId;
      
    } catch (error) {
      console.error('❌ Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Blacklist a token (for logout)
   */
  static async blacklistToken(token: string, reason: string = 'logout'): Promise<void> {
    try {
      // Extract token without Bearer prefix
      const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
      
      // Get token expiration to set appropriate TTL
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      const decoded = jwt.decode(cleanToken) as any;
      
      if (!decoded || !decoded.exp) {
        console.warn('⚠️ Cannot blacklist token: no expiration found');
        return;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const ttl = decoded.exp - currentTime;
      
      if (ttl <= 0) {
        console.log('ℹ️ Token already expired, no need to blacklist');
        return;
      }

      // Add to blacklist with remaining TTL
      const blacklistKey = `${this.TOKEN_BLACKLIST_PREFIX}${cleanToken}`;
      await redisCache.set(blacklistKey, {
        reason,
        blacklistedAt: Date.now(),
        userId: decoded.id,
        email: decoded.email
      }, ttl);

      console.log(`🚫 Token blacklisted: ${decoded.email} (${reason}), TTL: ${ttl}s`);
      
    } catch (error) {
      console.error('❌ Failed to blacklist token:', error);
      throw error;
    }
  }

  /**
   * Check if a token is blacklisted
   */
  static async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
      const blacklistKey = `${this.TOKEN_BLACKLIST_PREFIX}${cleanToken}`;
      const blacklisted = await redisCache.get(blacklistKey);
      return blacklisted !== null;
    } catch (error) {
      console.error('❌ Error checking token blacklist:', error);
      return false; // Fail open for availability
    }
  }

  /**
   * Check if session was created before server restart
   */
  static async isSessionStale(sessionId: string): Promise<boolean> {
    try {
      const serverStartTime = await redisCache.get<number>(this.SERVER_START_KEY);
      if (!serverStartTime) return false;

      const sessionInfo = await redisCache.get<SessionInfo>(`${this.SESSION_INFO_PREFIX}${sessionId}`);
      if (!sessionInfo) return true;

      return sessionInfo.loginTime < serverStartTime;
    } catch (error) {
      console.error('❌ Error checking session staleness:', error);
      return false;
    }
  }

  /**
   * Invalidate a specific session
   */
  static async invalidateSession(sessionId: string, reason: string = 'manual'): Promise<void> {
    try {
      const sessionInfo = await redisCache.get<SessionInfo>(`${this.SESSION_INFO_PREFIX}${sessionId}`);
      if (!sessionInfo) return;

      // Remove session info
      await redisCache.del(`${this.SESSION_INFO_PREFIX}${sessionId}`);

      // Remove from user's sessions list
      const userSessionsKey = `${this.USER_SESSION_PREFIX}${sessionInfo.userId}`;
      const userSessions = await redisCache.get<string[]>(userSessionsKey) || [];
      const updatedSessions = userSessions.filter(s => s !== sessionId);
      if (updatedSessions.length > 0) {
        await redisCache.set(userSessionsKey, updatedSessions, this.SESSION_TTL);
      } else {
        await redisCache.del(userSessionsKey);
      }

      // Remove from global sessions list
      const activeSessions = await redisCache.get<string[]>(this.ALL_SESSIONS_KEY) || [];
      const updatedActiveSessions = activeSessions.filter(s => s !== sessionId);
      await redisCache.set(this.ALL_SESSIONS_KEY, updatedActiveSessions, this.SESSION_TTL);

      console.log(`🗑️ Session invalidated: ${sessionId} for user ${sessionInfo.userId} (${reason})`);
      
    } catch (error) {
      console.error('❌ Failed to invalidate session:', error);
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  static async invalidateUserSessions(userId: number, reason: string = 'admin_action'): Promise<void> {
    try {
      const userSessionsKey = `${this.USER_SESSION_PREFIX}${userId}`;
      const userSessions = await redisCache.get<string[]>(userSessionsKey) || [];

      for (const sessionId of userSessions) {
        await this.invalidateSession(sessionId, reason);
      }

      await redisCache.del(userSessionsKey);
      console.log(`🗑️ All sessions invalidated for user ${userId} (${reason})`);
      
    } catch (error) {
      console.error('❌ Failed to invalidate user sessions:', error);
    }
  }

  /**
   * Invalidate all sessions (server restart, security incident)
   */
  static async invalidateAllSessions(reason: string = 'server_restart'): Promise<void> {
    try {
      const activeSessions = await redisCache.get<string[]>(this.ALL_SESSIONS_KEY) || [];
      
      console.log(`🚨 Invalidating ${activeSessions.length} active sessions (${reason})`);
      
      for (const sessionId of activeSessions) {
        await this.invalidateSession(sessionId, reason);
      }

      // Clear the active sessions list
      await redisCache.del(this.ALL_SESSIONS_KEY);
      
      console.log(`✅ All ${activeSessions.length} sessions invalidated (${reason})`);
      
    } catch (error) {
      console.error('❌ Failed to invalidate all sessions:', error);
    }
  }

  /**
   * Update session activity
   */
  static async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      const sessionInfo = await redisCache.get<SessionInfo>(`${this.SESSION_INFO_PREFIX}${sessionId}`);
      if (sessionInfo) {
        sessionInfo.lastActivity = Date.now();
        await redisCache.set(`${this.SESSION_INFO_PREFIX}${sessionId}`, sessionInfo, this.SESSION_TTL);
      }
    } catch (error) {
      console.error('❌ Failed to update session activity:', error);
    }
  }

  /**
   * Get session info
   */
  static async getSessionInfo(sessionId: string): Promise<SessionInfo | null> {
    try {
      return await redisCache.get<SessionInfo>(`${this.SESSION_INFO_PREFIX}${sessionId}`);
    } catch (error) {
      console.error('❌ Failed to get session info:', error);
      return null;
    }
  }

  /**
   * Get all active sessions for admin monitoring
   */
  static async getActiveSessions(): Promise<SessionInfo[]> {
    try {
      const activeSessions = await redisCache.get<string[]>(this.ALL_SESSIONS_KEY) || [];
      const sessions: SessionInfo[] = [];

      for (const sessionId of activeSessions) {
        const sessionInfo = await this.getSessionInfo(sessionId);
        if (sessionInfo) {
          sessions.push(sessionInfo);
        }
      }

      return sessions;
    } catch (error) {
      console.error('❌ Failed to get active sessions:', error);
      return [];
    }
  }

  /**
   * Clean up expired sessions
   */
  private static async cleanupExpiredSessions(): Promise<void> {
    try {
      const activeSessions = await redisCache.get<string[]>(this.ALL_SESSIONS_KEY) || [];
      const validSessions: string[] = [];
      const now = Date.now();

      for (const sessionId of activeSessions) {
        const sessionInfo = await redisCache.get<SessionInfo>(`${this.SESSION_INFO_PREFIX}${sessionId}`);
        
        if (sessionInfo) {
          // Check if session is expired (no activity for SESSION_TTL)
          const inactiveTime = now - sessionInfo.lastActivity;
          if (inactiveTime < this.SESSION_TTL * 1000) {
            validSessions.push(sessionId);
          } else {
            await this.invalidateSession(sessionId, 'expired');
          }
        }
      }

      // Update active sessions list
      if (validSessions.length !== activeSessions.length) {
        await redisCache.set(this.ALL_SESSIONS_KEY, validSessions, this.SESSION_TTL);
        console.log(`🧹 Session cleanup: ${activeSessions.length - validSessions.length} expired sessions removed`);
      }
      
    } catch (error) {
      console.error('❌ Session cleanup error:', error);
    }
  }

  /**
   * Generate a unique session ID
   */
  private static generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get session statistics for monitoring
   */
  static async getSessionStats(): Promise<{
    totalActive: number;
    byRole: Record<string, number>;
    byUser: Record<string, number>;
    serverUptime: number;
  }> {
    try {
      const activeSessions = await this.getActiveSessions();
      const serverStartTime = await redisCache.get<number>(this.SERVER_START_KEY) || Date.now();
      
      const stats = {
        totalActive: activeSessions.length,
        byRole: {} as Record<string, number>,
        byUser: {} as Record<string, number>,
        serverUptime: Date.now() - serverStartTime
      };

      for (const session of activeSessions) {
        // Count by role
        stats.byRole[session.role] = (stats.byRole[session.role] || 0) + 1;
        
        // Count by user
        const userKey = `${session.userId}:${session.email}`;
        stats.byUser[userKey] = (stats.byUser[userKey] || 0) + 1;
      }

      return stats;
    } catch (error) {
      console.error('❌ Failed to get session stats:', error);
      return {
        totalActive: 0,
        byRole: {},
        byUser: {},
        serverUptime: 0
      };
    }
  }
} 