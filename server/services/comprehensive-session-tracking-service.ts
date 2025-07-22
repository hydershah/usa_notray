import { db } from '../db';
import { systemActivityLogs, users, editorSessions, jobs } from '../../shared/schema';
import { enhancedLocationService } from './enhanced-location-service';
import { auditLoggingService } from './audit-logging-service';
import { eq, desc, and, inArray } from 'drizzle-orm';

export interface SessionActivity {
  id: number;
  sessionId?: string;
  jobId?: number;
  userId: number;
  userEmail: string;
  userName: string;
  userRole: string;
  activityType: 'login' | 'session_join' | 'video_join' | 'websocket_connect' | 'waiting_room_enter' | 'document_access' | 'session_complete' | 'logout';
  ipAddress: string;
  location: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    isp?: string;
    timezone?: string;
  };
  deviceInfo: {
    browser?: string;
    os?: string;
    device?: string;
    userAgent?: string;
    isMobile?: boolean;
  };
  securityFlags: {
    isVPN?: boolean;
    isProxy?: boolean;
    isTor?: boolean;
    riskScore?: number;
  };
  timestamp: Date;
  additionalData?: Record<string, any>;
}

export interface JobSessionSummary {
  jobId: number;
  jobTitle: string;
  totalActivities: number;
  uniqueParticipants: number;
  sessionStartTime?: Date;
  sessionEndTime?: Date;
  activities: SessionActivity[];
  participants: {
    userId: number;
    userName: string;
    userEmail: string;
    userRole: string;
    firstJoin?: Date;
    lastActivity?: Date;
    totalActivities: number;
    location?: string;
    device?: string;
  }[];
}

class ComprehensiveSessionTrackingService {
  /**
   * Track any session-related activity with full location and device data
   */
  async trackSessionActivity(
    activityType: SessionActivity['activityType'],
    req: any,
    options: {
      sessionId?: string;
      jobId?: number;
      userId: number;
      userEmail: string;
      userName: string;
      userRole: string;
      additionalData?: Record<string, any>;
    }
  ): Promise<SessionActivity> {
    try {
      console.log(`🔍 Tracking ${activityType} for user ${options.userName} (${options.userEmail})`);

      // Get comprehensive location and device data
      const comprehensiveData = await enhancedLocationService.getComprehensiveLocationData(req, true);

      // Create session activity record
      const activityData = {
        sessionId: options.sessionId,
        jobId: options.jobId,
        userId: options.userId,
        userEmail: options.userEmail,
        userName: options.userName,
        userRole: options.userRole,
        activityType,
        ipAddress: comprehensiveData.ip,
        location: comprehensiveData.location,
        deviceInfo: comprehensiveData.deviceInfo,
        securityFlags: {
          isVPN: comprehensiveData.location.security?.isVPN || false,
          isProxy: comprehensiveData.location.security?.isProxy || false,
          isTor: comprehensiveData.location.security?.isTor || false,
          riskScore: comprehensiveData.location.security?.riskScore || 0
        },
        timestamp: comprehensiveData.timestamp,
        additionalData: options.additionalData
      };

      // Store in system activity logs with enhanced details
      await auditLoggingService.createLog({
        user: {
          id: options.userId,
          email: options.userEmail,
          fullName: options.userName,
          role: options.userRole
        },
        action: activityType,
        actionCategory: 'session_tracking',
        actionDescription: `${activityType.toUpperCase()}: ${options.userName} from ${comprehensiveData.location.city || 'Unknown'}, ${comprehensiveData.location.country || 'Unknown'}`,
        targetType: 'session',
        targetId: options.jobId,
        jobId: options.jobId,
        severity: 'info',
        details: {
          sessionId: options.sessionId,
          jobId: options.jobId,
          location: comprehensiveData.location,
          deviceInfo: comprehensiveData.deviceInfo,
          security: activityData.securityFlags,
          coordinates: comprehensiveData.location.latitude && comprehensiveData.location.longitude ? {
            lat: comprehensiveData.location.latitude,
            lng: comprehensiveData.location.longitude
          } : null,
          ipAddress: comprehensiveData.ip,
          userAgent: comprehensiveData.deviceInfo.userAgent,
          ...options.additionalData
        }
      });

      console.log(`✅ Session activity tracked: ${activityType} for ${options.userName} from ${comprehensiveData.location.city || 'Unknown Location'}`);

      return {
        id: Date.now(), // Use timestamp as unique ID for tracking
        ...activityData
      } as SessionActivity;

    } catch (error) {
      console.error(`❌ Failed to track session activity (${activityType}):`, error);
      throw error;
    }
  }

  /**
   * Get comprehensive session tracking data for a specific job
   */
  async getJobSessionSummary(jobId: number): Promise<JobSessionSummary> {
    try {
      console.log(`📊 Getting session summary for job ${jobId}`);

      // Get job details
      const job = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
      if (!job.length) {
        throw new Error(`Job ${jobId} not found`);
      }

      // Get all session activities for this job
      const activities = await db
        .select()
        .from(systemActivityLogs)
        .where(
          and(
            eq(systemActivityLogs.actionCategory, 'session_tracking'),
            eq(systemActivityLogs.jobId, jobId)
          )
        )
        .orderBy(desc(systemActivityLogs.createdAt));

      // Process activities into our format
      const sessionActivities: SessionActivity[] = activities.map(log => ({
        id: log.id,
        sessionId: log.details?.sessionId,
        jobId: jobId,
        userId: log.userId,
        userEmail: log.userEmail,
        userName: log.details?.userName || 'Unknown User',
        userRole: log.details?.userRole || 'unknown',
        activityType: log.action as SessionActivity['activityType'],
        ipAddress: log.ipAddress || 'unknown',
        location: log.details?.location || {},
        deviceInfo: log.details?.deviceInfo || {},
        securityFlags: log.details?.security || {},
        timestamp: log.createdAt,
        additionalData: log.details
      }));

      // Get unique participants and their stats
      const participantStats = this.calculateParticipantStats(sessionActivities);

      // Calculate session times
      const sessionTimes = this.calculateSessionTimes(sessionActivities);

      const summary: JobSessionSummary = {
        jobId,
        jobTitle: job[0].titleCompany || 'Unknown Job',
        totalActivities: sessionActivities.length,
        uniqueParticipants: participantStats.length,
        sessionStartTime: sessionTimes.start,
        sessionEndTime: sessionTimes.end,
        activities: sessionActivities,
        participants: participantStats
      };

      console.log(`✅ Job session summary generated: ${summary.totalActivities} activities, ${summary.uniqueParticipants} participants`);
      return summary;

    } catch (error) {
      console.error(`❌ Failed to get job session summary for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get real-time session participants for active sessions
   */
  async getActiveSessionParticipants(sessionId: string): Promise<SessionActivity[]> {
    try {
      const activities = await db
        .select()
        .from(systemActivityLogs)
        .where(eq(systemActivityLogs.actionCategory, 'session_tracking'))
        .orderBy(desc(systemActivityLogs.createdAt))
        .limit(50);

      return activities.map(log => ({
        id: log.id,
        sessionId: sessionId,
        jobId: log.details?.jobId,
        userId: log.userId,
        userEmail: log.userEmail,
        userName: log.details?.userName || 'Unknown User',
        userRole: log.details?.userRole || 'unknown',
        activityType: log.action as SessionActivity['activityType'],
        ipAddress: log.ipAddress || 'unknown',
        location: log.details?.location || {},
        deviceInfo: log.details?.deviceInfo || {},
        securityFlags: log.details?.security || {},
        timestamp: log.createdAt,
        additionalData: log.details
      }));

    } catch (error) {
      console.error(`❌ Failed to get active session participants for ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * Track user login with session context
   */
  async trackLogin(req: any, user: any, sessionId?: string): Promise<SessionActivity> {
    return this.trackSessionActivity('login', req, {
      sessionId,
      userId: user.id,
      userEmail: user.email,
      userName: user.username || user.name || 'Unknown User',
      userRole: user.role || 'unknown',
      additionalData: {
        loginMethod: 'password',
        sessionId: sessionId
      }
    });
  }

  /**
   * Track session join (when user accesses a specific job session)
   */
  async trackSessionJoin(req: any, jobId: number, user: any, sessionId: string): Promise<SessionActivity> {
    return this.trackSessionActivity('session_join', req, {
      sessionId,
      jobId,
      userId: user.id,
      userEmail: user.email,
      userName: user.username || user.name || 'Unknown User',
      userRole: user.role || 'unknown',
      additionalData: {
        joinMethod: 'web_browser',
        jobId: jobId
      }
    });
  }

  /**
   * Track video conference join
   */
  async trackVideoJoin(req: any, jobId: number, sessionId: string, user: any): Promise<SessionActivity> {
    return this.trackSessionActivity('video_join', req, {
      sessionId,
      jobId,
      userId: user.id,
      userEmail: user.email,
      userName: user.username || user.name || 'Unknown User',
      userRole: user.role || 'unknown',
      additionalData: {
        videoProvider: 'whereby',
        joinMethod: 'embedded_iframe'
      }
    });
  }

  /**
   * Track WebSocket connection for real-time collaboration
   */
  async trackWebSocketConnect(req: any, sessionId: string, user: any, jobId?: number): Promise<SessionActivity> {
    return this.trackSessionActivity('websocket_connect', req, {
      sessionId,
      jobId,
      userId: user.id,
      userEmail: user.email,
      userName: user.username || user.name || 'Unknown User',
      userRole: user.role || 'unknown',
      additionalData: {
        connectionType: 'websocket',
        protocol: 'ws'
      }
    });
  }

  /**
   * Calculate participant statistics from activities
   */
  private calculateParticipantStats(activities: SessionActivity[]) {
    const participantMap = new Map();

    activities.forEach(activity => {
      const key = activity.userId;
      if (!participantMap.has(key)) {
        participantMap.set(key, {
          userId: activity.userId,
          userName: activity.userName,
          userEmail: activity.userEmail,
          userRole: activity.userRole,
          firstJoin: activity.timestamp,
          lastActivity: activity.timestamp,
          totalActivities: 1,
          location: `${activity.location.city || 'Unknown'}, ${activity.location.country || 'Unknown'}`,
          device: `${activity.deviceInfo.browser || 'Unknown'} on ${activity.deviceInfo.os || 'Unknown'}`
        });
      } else {
        const participant = participantMap.get(key);
        participant.totalActivities++;
        if (activity.timestamp > participant.lastActivity) {
          participant.lastActivity = activity.timestamp;
        }
        if (activity.timestamp < participant.firstJoin) {
          participant.firstJoin = activity.timestamp;
        }
      }
    });

    return Array.from(participantMap.values());
  }

  /**
   * Calculate session start and end times
   */
  private calculateSessionTimes(activities: SessionActivity[]) {
    if (activities.length === 0) {
      return { start: undefined, end: undefined };
    }

    const times = activities.map(a => a.timestamp).sort();
    return {
      start: times[0],
      end: times[times.length - 1]
    };
  }
}

export const comprehensiveSessionTrackingService = new ComprehensiveSessionTrackingService(); 