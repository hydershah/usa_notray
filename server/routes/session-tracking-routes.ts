import { Router } from 'express';
import { comprehensiveSessionTrackingService, SessionActivity, JobSessionSummary } from '../services/comprehensive-session-tracking-service';
import { verifyToken, requireAdmin, requireNotaryOrAdmin } from '../auth';

const router = Router();

/**
 * Get comprehensive session summary for a specific job
 * Accessible by notaries and admins
 */
router.get('/jobs/:jobId/session-summary', verifyToken, requireNotaryOrAdmin, async (req: any, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    
    if (isNaN(jobId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid job ID'
      });
    }

    console.log(`📊 Getting session summary for job ${jobId} requested by ${req.user.email}`);

    const summary = await comprehensiveSessionTrackingService.getJobSessionSummary(jobId);

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('❌ Failed to get job session summary:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get session summary'
    });
  }
});

/**
 * Get real-time active participants for a session
 * Accessible by notaries and admins during active sessions
 */
router.get('/sessions/:sessionId/active-participants', verifyToken, requireNotaryOrAdmin, async (req: any, res) => {
  try {
    const sessionId = req.params.sessionId;

    console.log(`👥 Getting active participants for session ${sessionId} requested by ${req.user.email}`);

    const participants = await comprehensiveSessionTrackingService.getActiveSessionParticipants(sessionId);

    res.json({
      success: true,
      data: participants
    });

  } catch (error) {
    console.error('❌ Failed to get active session participants:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get active participants'
    });
  }
});

/**
 * Get session tracking data for multiple jobs (admin dashboard)
 * Accessible by admins only
 */
router.get('/jobs/session-summaries', verifyToken, requireAdmin, async (req: any, res) => {
  try {
    const { jobIds, limit = 50, offset = 0 } = req.query;

    console.log(`📊 Getting multiple session summaries requested by admin ${req.user.email}`);

    let targetJobIds: number[] = [];
    
    if (jobIds) {
      // Parse comma-separated job IDs
      targetJobIds = jobIds.split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id));
    }

    // If no specific job IDs provided, we'd need to implement a method to get recent jobs
    // For now, return error asking for specific job IDs
    if (targetJobIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide jobIds parameter with comma-separated job IDs'
      });
    }

    // Get summaries for all requested jobs
    const summaries: JobSessionSummary[] = [];
    
    for (const jobId of targetJobIds.slice(offset, offset + limit)) {
      try {
        const summary = await comprehensiveSessionTrackingService.getJobSessionSummary(jobId);
        summaries.push(summary);
      } catch (error) {
        console.warn(`⚠️ Failed to get summary for job ${jobId}:`, error);
        // Continue with other jobs even if one fails
      }
    }

    res.json({
      success: true,
      data: {
        summaries,
        total: summaries.length,
        offset: parseInt(offset as string),
        limit: parseInt(limit as string)
      }
    });

  } catch (error) {
    console.error('❌ Failed to get multiple session summaries:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get session summaries'
    });
  }
});

/**
 * Get detailed tracking data for a specific user across sessions
 * Accessible by admins only
 */
router.get('/users/:userId/session-history', verifyToken, requireAdmin, async (req: any, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { limit = 100, offset = 0 } = req.query;

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    console.log(`👤 Getting session history for user ${userId} requested by admin ${req.user.email}`);

    // This would require a new method in the service - for now return placeholder
    res.json({
      success: true,
      data: {
        userId,
        message: 'User session history endpoint - implementation needed',
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });

  } catch (error) {
    console.error('❌ Failed to get user session history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user session history'
    });
  }
});

/**
 * Get session security analytics (high-risk connections, etc.)
 * Accessible by admins only
 */
router.get('/security/session-analytics', verifyToken, requireAdmin, async (req: any, res) => {
  try {
    const { timeframe = '24h', riskThreshold = 5 } = req.query;

    console.log(`🔒 Getting session security analytics requested by admin ${req.user.email}`);

    // Placeholder for security analytics
    res.json({
      success: true,
      data: {
        timeframe,
        riskThreshold: parseInt(riskThreshold as string),
        analytics: {
          totalSessions: 0,
          highRiskConnections: 0,
          vpnConnections: 0,
          proxyConnections: 0,
          torConnections: 0,
          suspiciousActivities: []
        },
        message: 'Security analytics endpoint - implementation needed'
      }
    });

  } catch (error) {
    console.error('❌ Failed to get session security analytics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get security analytics'
    });
  }
});

/**
 * Export session tracking data for compliance/audit purposes
 * Accessible by admins only
 */
router.get('/jobs/:jobId/export-tracking', verifyToken, requireAdmin, async (req: any, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const { format = 'json' } = req.query;

    if (isNaN(jobId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid job ID'
      });
    }

    console.log(`📋 Exporting session tracking for job ${jobId} requested by admin ${req.user.email}`);

    const summary = await comprehensiveSessionTrackingService.getJobSessionSummary(jobId);

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = 'Timestamp,User,Email,Role,Activity,IP Address,Location,Device,Browser,Security Risk\n';
      const csvRows = summary.activities.map(activity => {
        return [
          activity.timestamp.toISOString(),
          activity.userName,
          activity.userEmail,
          activity.userRole,
          activity.activityType,
          activity.ipAddress,
          `"${activity.location.city || ''}, ${activity.location.country || ''}"`,
          `"${activity.deviceInfo.device || 'Unknown'}"`,
          `"${activity.deviceInfo.browser || 'Unknown'}"`,
          activity.securityFlags.riskScore || 0
        ].join(',');
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="job-${jobId}-session-tracking.csv"`);
      res.send(csvHeader + csvRows);
    } else {
      // Return JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="job-${jobId}-session-tracking.json"`);
      res.json({
        export: {
          jobId,
          exportedAt: new Date().toISOString(),
          exportedBy: req.user.email,
          format: 'json'
        },
        data: summary
      });
    }

  } catch (error) {
    console.error('❌ Failed to export session tracking:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export tracking data'
    });
  }
});

export default router; 