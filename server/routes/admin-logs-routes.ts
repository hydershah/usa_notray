import { Router, Request, Response } from 'express';
import { db } from '../db';
import { systemActivityLogs, users, jobs, companies } from '@shared/schema';
import { eq, and, desc, gte, lte, like, sql, count } from 'drizzle-orm';
import { verifyToken, hasAdminPrivileges } from '../auth';

const router = Router();

const requireAdmin = (req: any, res: Response, next: any) => {
  if (!hasAdminPrivileges(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

router.get('/logs', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      category,
      severity,
      userId,
      action,
      startDate,
      endDate,
      search,
      targetType
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];

    if (category) {
      conditions.push(eq(systemActivityLogs.actionCategory, category as string));
    }

    if (severity) {
      conditions.push(eq(systemActivityLogs.severity, severity as string));
    }

    if (userId) {
      conditions.push(eq(systemActivityLogs.userId, parseInt(userId as string)));
    }

    if (action) {
      conditions.push(eq(systemActivityLogs.action, action as string));
    }

    if (targetType) {
      conditions.push(eq(systemActivityLogs.targetType, targetType as string));
    }

    if (startDate) {
      conditions.push(gte(systemActivityLogs.createdAt, new Date(startDate as string)));
    }

    if (endDate) {
      conditions.push(lte(systemActivityLogs.createdAt, new Date(endDate as string)));
    }

    if (search) {
      conditions.push(like(systemActivityLogs.actionDescription, `%${search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const totalCountQuery = await db
      .select({ count: count() })
      .from(systemActivityLogs)
      .where(whereClause);

    const totalCount = totalCountQuery[0].count;

    const logs = await db
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
        jobId: systemActivityLogs.jobId,
        companyId: systemActivityLogs.companyId,
        requestMethod: systemActivityLogs.requestMethod,
        requestPath: systemActivityLogs.requestPath,
        responseStatus: systemActivityLogs.responseStatus,
        details: systemActivityLogs.details,
        ipAddress: systemActivityLogs.ipAddress,
        severity: systemActivityLogs.severity,
        isSystemAction: systemActivityLogs.isSystemAction,
        isSuccessful: systemActivityLogs.isSuccessful,
        errorMessage: systemActivityLogs.errorMessage,
        createdAt: systemActivityLogs.createdAt,
        userFullName: users.fullName,
        userUsername: users.username,
        jobTitleCompany: jobs.titleCompany,
        jobClosingType: jobs.closingType,
        jobPropertyAddress: jobs.propertyAddressOne,
        companyName: companies.companyName,
      })
      .from(systemActivityLogs)
      .leftJoin(users, eq(systemActivityLogs.userId, users.id))
      .leftJoin(jobs, eq(systemActivityLogs.jobId, jobs.id))
      .leftJoin(companies, eq(systemActivityLogs.companyId, companies.id))
      .where(whereClause)
      .orderBy(desc(systemActivityLogs.createdAt))
      .limit(limitNum)
      .offset(offset);

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

router.get('/logs/stats', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { timeRange = '24h' } = req.query;

    let startDate = new Date();
    switch (timeRange) {
      case '1h':
        startDate.setHours(startDate.getHours() - 1);
        break;
      case '24h':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setDate(startDate.getDate() - 1);
    }

    const categoryStats = await db
      .select({
        category: systemActivityLogs.actionCategory,
        count: count(),
      })
      .from(systemActivityLogs)
      .where(gte(systemActivityLogs.createdAt, startDate))
      .groupBy(systemActivityLogs.actionCategory);

    const severityStats = await db
      .select({
        severity: systemActivityLogs.severity,
        count: count(),
      })
      .from(systemActivityLogs)
      .where(gte(systemActivityLogs.createdAt, startDate))
      .groupBy(systemActivityLogs.severity);

    const totalActivity = await db
      .select({ count: count() })
      .from(systemActivityLogs)
      .where(gte(systemActivityLogs.createdAt, startDate));

    const errorCount = await db
      .select({ count: count() })
      .from(systemActivityLogs)
      .where(
        and(
          gte(systemActivityLogs.createdAt, startDate),
          eq(systemActivityLogs.isSuccessful, false)
        )
      );

    const activeUsers = await db
      .select({
        userId: systemActivityLogs.userId,
        userName: systemActivityLogs.userName,
        userEmail: systemActivityLogs.userEmail,
        userRole: systemActivityLogs.userRole,
        activityCount: count(),
      })
      .from(systemActivityLogs)
      .where(
        and(
          gte(systemActivityLogs.createdAt, startDate),
          sql`${systemActivityLogs.userId} IS NOT NULL`
        )
      )
      .groupBy(
        systemActivityLogs.userId,
        systemActivityLogs.userName,
        systemActivityLogs.userEmail,
        systemActivityLogs.userRole
      )
      .orderBy(desc(count()))
      .limit(10);

    res.json({
      totalActivity: totalActivity[0].count,
      errorCount: errorCount[0].count,
      categoryStats,
      severityStats,
      activeUsers,
      timeRange,
    });
  } catch (error) {
    console.error('Error fetching log stats:', error);
    res.status(500).json({ error: 'Failed to fetch log statistics' });
  }
});

router.get('/logs/:id', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const logId = parseInt(req.params.id);

    if (isNaN(logId)) {
      return res.status(400).json({ error: 'Invalid log ID' });
    }

    const logEntry = await db
      .select()
      .from(systemActivityLogs)
      .leftJoin(users, eq(systemActivityLogs.userId, users.id))
      .leftJoin(jobs, eq(systemActivityLogs.jobId, jobs.id))
      .leftJoin(companies, eq(systemActivityLogs.companyId, companies.id))
      .where(eq(systemActivityLogs.id, logId))
      .limit(1);

    if (logEntry.length === 0) {
      return res.status(404).json({ error: 'Log entry not found' });
    }

    res.json(logEntry[0]);
  } catch (error) {
    console.error('Error fetching log entry:', error);
    res.status(500).json({ error: 'Failed to fetch log entry' });
  }
});

router.get('/logs/user/:userId', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const { page = '1', limit = '20' } = req.query;

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const userLogs = await db
      .select()
      .from(systemActivityLogs)
      .where(eq(systemActivityLogs.userId, userId))
      .orderBy(desc(systemActivityLogs.createdAt))
      .limit(limitNum)
      .offset(offset);

    const totalCount = await db
      .select({ count: count() })
      .from(systemActivityLogs)
      .where(eq(systemActivityLogs.userId, userId));

    res.json({
      logs: userLogs,
      totalCount: totalCount[0].count,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount[0].count / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching user logs:', error);
    res.status(500).json({ error: 'Failed to fetch user activity logs' });
  }
});

router.get('/logs/job/:jobId', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const jobId = parseInt(req.params.jobId);

    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const jobLogs = await db
      .select()
      .from(systemActivityLogs)
      .where(eq(systemActivityLogs.jobId, jobId))
      .orderBy(desc(systemActivityLogs.createdAt));

    res.json(jobLogs);
  } catch (error) {
    console.error('Error fetching job logs:', error);
    res.status(500).json({ error: 'Failed to fetch job activity logs' });
  }
});

export default router; 