import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { jobs } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { hasNotaryPrivileges } from '../auth';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    role: string;
    privileges?: string[];
  };
}

/**
 * Middleware to check if a notary has pending job approvals
 * Prevents access to signing/tagging features until jobs are approved
 */
export async function notaryApprovalGuard(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Only apply this guard to notaries
    if (!hasNotaryPrivileges(req.user)) {
      return next();
    }

    const notaryId = req.user.id;

    // Check if notary has any pending job approvals
    const pendingJobs = await db.execute(sql`
      SELECT COUNT(*) as pending_count
      FROM jobs
      WHERE notary_id = ${notaryId}
      AND notary_approval_status = 'assigned_pending_approval'
      AND job_status IN ('open', 'pending')
    `);

    const pendingCount = pendingJobs.rows[0]?.pending_count || 0;

    if (pendingCount > 0) {
      return res.status(403).json({
        error: 'Job approval required',
        message: `You have ${pendingCount} pending job invitation${pendingCount !== 1 ? 's' : ''} that must be approved before you can access signing features.`,
        pendingJobCount: pendingCount,
        redirectTo: '/dashboard?tab=invitations',
        errorType: 'pending_approvals'
      });
    }

    // If no pending approvals, allow access
    next();
  } catch (error) {
    console.error('Error checking notary approval status:', error);
    // In case of error, don't block access to prevent system lockout
    next();
  }
}

/**
 * Middleware to check if a specific job is approved before allowing access
 */
export async function jobApprovalGuard(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Only apply this guard to notaries
    if (!hasNotaryPrivileges(req.user)) {
      return next();
    }

    const jobId = parseInt(req.params.jobId || req.params.id);
    const notaryId = req.user.id;

    if (isNaN(jobId)) {
      return res.status(400).json({
        error: 'Invalid job ID',
        message: 'A valid job ID is required'
      });
    }

    // Check if this job is assigned to the notary and is approved
    const job = await db.execute(sql`
      SELECT 
        id,
        notary_id,
        notary_approval_status,
        job_status,
        title_company
      FROM jobs
      WHERE id = ${jobId}
      AND notary_id = ${notaryId}
    `);

    if (job.rows.length === 0) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'This job is not assigned to you or does not exist'
      });
    }

    const jobData = job.rows[0];

    // Check if job is approved
    if (jobData.notary_approval_status !== 'approved') {
      return res.status(403).json({
        error: 'Job not approved',
        message: 'This job must be approved before you can access signing features.',
        jobId: jobId,
        currentStatus: jobData.notary_approval_status,
        jobDetails: {
          titleCompany: jobData.title_company,
          status: jobData.job_status
        },
        redirectTo: '/dashboard?tab=invitations',
        errorType: 'job_not_approved'
      });
    }

    // Job is approved, allow access
    next();
  } catch (error) {
    console.error('Error checking job approval status:', error);
    // In case of error, don't block access to prevent system lockout
    next();
  }
} 