import { Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { users, jobParticipants, signers } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';

/**
 * Enhanced verification middleware that supports dual-role verification
 * Checks both user's primary role and their job-specific role for verification requirements
 */

interface JobSpecificVerificationRequest extends Request {
  user: any;
  jobId?: number;
  participantRole?: string;
}

/**
 * Check if a user needs verification based on their job-specific role
 * This is the core logic for dual-role verification
 */
export const checkJobSpecificVerificationNeeded = async (
  userId: number, 
  jobId: number, 
  jobSpecificRole: string
): Promise<{
  needsVerification: boolean;
  isVerified: boolean;
  verificationMethod: string | null;
  bypassReason: string | null;
  primaryRole: string;
}> => {
  try {
    // Get user's primary information
    const [user] = await db
      .select({
        id: users.id,
        role: users.role,
        isVerified: users.isVerified,
        isVerificationBypassed: users.isVerificationBypassed,
        notaryVerificationBypassed: users.notaryVerificationBypassed,
        verificationStatus: users.verificationStatus,
        verificationBypassReason: users.verificationBypassReason,
        notaryVerificationBypassReason: users.notaryVerificationBypassReason
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return {
        needsVerification: false,
        isVerified: false,
        verificationMethod: null,
        bypassReason: null,
        primaryRole: 'unknown'
      };
    }

    // Check if job-specific role requires verification
    const rolesRequiringVerification = ['signer', 'witness'];
    const needsVerification = rolesRequiringVerification.includes(jobSpecificRole);

    if (!needsVerification) {
      return {
        needsVerification: false,
        isVerified: true, // No verification needed means they're "verified" for this role
        verificationMethod: 'not_required',
        bypassReason: null,
        primaryRole: user.role
      };
    }

    // Check verification status
    const isVerifiedByEVS = user.isVerified && user.verificationStatus === 'approved';
    const isBypassedByAdmin = user.isVerificationBypassed;
    const isBypassedByNotary = user.notaryVerificationBypassed;

    const isVerified = isVerifiedByEVS || isBypassedByAdmin || isBypassedByNotary;
    const verificationMethod = isVerifiedByEVS ? 'evs' : 
                              isBypassedByAdmin ? 'admin_bypass' : 
                              isBypassedByNotary ? 'notary_bypass' : null;
    const bypassReason = isBypassedByAdmin ? user.verificationBypassReason :
                        isBypassedByNotary ? user.notaryVerificationBypassReason : null;

    return {
      needsVerification,
      isVerified,
      verificationMethod,
      bypassReason,
      primaryRole: user.role
    };

  } catch (error) {
    console.error('Error checking job-specific verification:', error);
    return {
      needsVerification: false,
      isVerified: false,
      verificationMethod: null,
      bypassReason: null,
      primaryRole: 'unknown'
    };
  }
};

/**
 * Middleware for job-specific verification
 * Checks if user needs verification based on their role in a specific job
 */
export const requireJobSpecificVerification = async (req: JobSpecificVerificationRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    const jobId = req.params.jobId ? parseInt(req.params.jobId) : req.body.jobId;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required for verification check' });
    }

    // Admin always has access
    if (user.role === 'admin') {
      return next();
    }

    // Check if user is a participant in this job
    const [participant] = await db
      .select({
        id: jobParticipants.id,
        jobSpecificRole: jobParticipants.jobSpecificRole,
        primaryRole: jobParticipants.primaryRole,
        requiresIdVerification: jobParticipants.requiresIdVerification,
        idVerificationCompleted: jobParticipants.idVerificationCompleted
      })
      .from(jobParticipants)
      .where(and(eq(jobParticipants.jobId, jobId), eq(jobParticipants.userId, user.id)))
      .limit(1);

    // If not in job_participants, check signers table
    let jobSpecificRole = participant?.jobSpecificRole;
    let requiresVerification = participant?.requiresIdVerification ?? false;

    if (!participant) {
      const [signer] = await db
        .select({
          id: signers.id,
          signerRole: signers.signerRole,
          primaryUserRole: signers.primaryUserRole,
          requiresIdVerification: signers.requiresIdVerification,
          idVerificationCompleted: signers.idVerificationCompleted
        })
        .from(signers)
        .where(and(eq(signers.jobId, jobId), eq(signers.userId, user.id)))
        .limit(1);

      if (signer) {
        jobSpecificRole = 'signer'; // All entries in signers table are signers
        requiresVerification = signer.requiresIdVerification ?? true;
      }
    }

    if (!jobSpecificRole) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You are not a participant in this job'
      });
    }

    // Check verification requirements for this job-specific role
    const verificationCheck = await checkJobSpecificVerificationNeeded(
      user.id, 
      jobId, 
      jobSpecificRole
    );

    if (verificationCheck.needsVerification && !verificationCheck.isVerified) {
      return res.status(403).json({
        error: 'Verification required for job participation',
        message: `Your role as "${jobSpecificRole}" in this job requires identity verification`,
        verificationRequired: true,
        userRole: user.role,
        jobSpecificRole: jobSpecificRole,
        primaryRole: verificationCheck.primaryRole,
        redirectTo: '/verification',
        jobId: jobId
      });
    }

    // Add verification info to request for downstream use
    req.user.jobVerificationInfo = {
      jobId: jobId,
      jobSpecificRole: jobSpecificRole,
      primaryRole: verificationCheck.primaryRole,
      needsVerification: verificationCheck.needsVerification,
      isVerified: verificationCheck.isVerified,
      verificationMethod: verificationCheck.verificationMethod,
      bypassReason: verificationCheck.bypassReason
    };

    next();

  } catch (error) {
    console.error('Error in job-specific verification middleware:', error);
    return res.status(500).json({ error: 'Internal server error during verification check' });
  }
};

/**
 * Get verification status for a user in a specific job
 * Useful for UI to show verification requirements and status
 */
export const getJobSpecificVerificationStatus = async (userId: number, jobId: number) => {
  try {
    // Get user's roles in this job
    const [participant] = await db
      .select({
        jobSpecificRole: jobParticipants.jobSpecificRole,
        primaryRole: jobParticipants.primaryRole,
        requiresIdVerification: jobParticipants.requiresIdVerification,
        idVerificationCompleted: jobParticipants.idVerificationCompleted,
        idVerificationCompletedAt: jobParticipants.idVerificationCompletedAt,
        idVerificationBypassReason: jobParticipants.idVerificationBypassReason
      })
      .from(jobParticipants)
      .where(and(eq(jobParticipants.jobId, jobId), eq(jobParticipants.userId, userId)))
      .limit(1);

    if (!participant) {
      // Check signers table
      const [signer] = await db
        .select({
          signerRole: signers.signerRole,
          primaryUserRole: signers.primaryUserRole,
          requiresIdVerification: signers.requiresIdVerification,
          idVerificationCompleted: signers.idVerificationCompleted,
          idVerificationCompletedAt: signers.idVerificationCompletedAt
        })
        .from(signers)
        .where(and(eq(signers.jobId, jobId), eq(signers.userId, userId)))
        .limit(1);

      if (signer) {
        const verificationCheck = await checkJobSpecificVerificationNeeded(
          userId, 
          jobId, 
          'signer'
        );

        return {
          isParticipant: true,
          jobSpecificRole: 'signer',
          primaryRole: signer.primaryUserRole,
          needsVerification: verificationCheck.needsVerification,
          isVerified: verificationCheck.isVerified,
          verificationMethod: verificationCheck.verificationMethod,
          verificationCompletedAt: signer.idVerificationCompletedAt,
          bypassReason: verificationCheck.bypassReason,
          hasDualRole: signer.primaryUserRole !== 'signer'
        };
      }
    }

    if (!participant) {
      return {
        isParticipant: false,
        jobSpecificRole: null,
        primaryRole: null,
        needsVerification: false,
        isVerified: false,
        verificationMethod: null,
        verificationCompletedAt: null,
        bypassReason: null,
        hasDualRole: false
      };
    }

    const verificationCheck = await checkJobSpecificVerificationNeeded(
      userId, 
      jobId, 
      participant.jobSpecificRole || 'unknown'
    );

    return {
      isParticipant: true,
      jobSpecificRole: participant.jobSpecificRole,
      primaryRole: participant.primaryRole,
      needsVerification: verificationCheck.needsVerification,
      isVerified: verificationCheck.isVerified,
      verificationMethod: verificationCheck.verificationMethod,
      verificationCompletedAt: participant.idVerificationCompletedAt,
      bypassReason: verificationCheck.bypassReason,
      hasDualRole: participant.primaryRole !== participant.jobSpecificRole
    };

  } catch (error) {
    console.error('Error getting job-specific verification status:', error);
    return null;
  }
};

/**
 * Middleware to add job-specific verification status to request
 * Non-blocking - adds info for UI use
 */
export const addJobSpecificVerificationStatus = async (req: JobSpecificVerificationRequest, res: Response, next: NextFunction) => {
  try {
    const jobId = req.params.jobId ? parseInt(req.params.jobId) : req.body.jobId;
    
    if (req.user && jobId) {
      const verificationStatus = await getJobSpecificVerificationStatus(req.user.id, jobId);
      req.user.jobSpecificVerificationInfo = verificationStatus;
    }
    next();
  } catch (error) {
    console.error('Error adding job-specific verification status:', error);
    next(); // Don't block request on error
  }
};

export default {
  requireJobSpecificVerification,
  checkJobSpecificVerificationNeeded,
  getJobSpecificVerificationStatus,
  addJobSpecificVerificationStatus
};
