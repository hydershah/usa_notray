import { db } from '../db.js';
import { users, jobParticipants, signers } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';

export interface VerificationRequirement {
  userId: number;
  jobId: number;
  jobSpecificRole: string;
  primaryRole: string;
  requiresVerification: boolean;
  isCurrentlyVerified: boolean;
  verificationMethod: string | null;
  canBypassVerification: boolean;
  bypassReason: string | null;
}

export interface VerificationAction {
  action: 'verify' | 'bypass' | 'require';
  reason?: string;
  bypassedBy?: number;
  method?: 'evs' | 'admin_bypass' | 'notary_bypass';
}

export class DualRoleVerificationService {
  private static instance: DualRoleVerificationService;

  public static getInstance(): DualRoleVerificationService {
    if (!DualRoleVerificationService.instance) {
      DualRoleVerificationService.instance = new DualRoleVerificationService();
    }
    return DualRoleVerificationService.instance;
  }

  /**
   * Get verification requirements for a user in a specific job
   */
  async getVerificationRequirements(userId: number, jobId: number): Promise<VerificationRequirement | null> {
    try {
      // Get user's basic information
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
        return null;
      }

      // Check job_participants table for job-specific role
      const [participant] = await db
        .select({
          jobSpecificRole: jobParticipants.jobSpecificRole,
          primaryRole: jobParticipants.primaryRole,
          requiresIdVerification: jobParticipants.requiresIdVerification,
          idVerificationCompleted: jobParticipants.idVerificationCompleted,
          idVerificationBypassReason: jobParticipants.idVerificationBypassReason
        })
        .from(jobParticipants)
        .where(and(eq(jobParticipants.jobId, jobId), eq(jobParticipants.userId, userId)))
        .limit(1);

      // If not in job_participants, check signers table
      let jobSpecificRole = participant?.jobSpecificRole || null;
      let requiresVerification = participant?.requiresIdVerification ?? null;
      let isJobSpecificVerified = participant?.idVerificationCompleted ?? false;
      let jobSpecificBypassReason = participant?.idVerificationBypassReason || null;

      if (!participant) {
        const [signer] = await db
          .select({
            signerRole: signers.signerRole,
            primaryUserRole: signers.primaryUserRole,
            requiresIdVerification: signers.requiresIdVerification,
            idVerificationCompleted: signers.idVerificationCompleted
          })
          .from(signers)
          .where(and(eq(signers.jobId, jobId), eq(signers.userId, userId)))
          .limit(1);

        if (signer) {
          jobSpecificRole = 'signer';
          requiresVerification = signer.requiresIdVerification ?? true;
          isJobSpecificVerified = signer.idVerificationCompleted ?? false;
        }
      }

      if (!jobSpecificRole) {
        return null; // User is not a participant in this job
      }

      // Determine if verification is required based on job-specific role
      const rolesRequiringVerification = ['signer', 'witness'];
      const needsVerification = requiresVerification ?? rolesRequiringVerification.includes(jobSpecificRole);

      // Check current verification status
      const isUserLevelVerified = user.isVerified || user.isVerificationBypassed || user.notaryVerificationBypassed;
      const isCurrentlyVerified = isJobSpecificVerified || isUserLevelVerified;

      // Determine verification method
      let verificationMethod = null;
      let bypassReason = null;

      if (isCurrentlyVerified) {
        if (isJobSpecificVerified) {
          verificationMethod = 'job_specific';
          bypassReason = jobSpecificBypassReason;
        } else if (user.isVerified) {
          verificationMethod = 'evs';
        } else if (user.isVerificationBypassed) {
          verificationMethod = 'admin_bypass';
          bypassReason = user.verificationBypassReason;
        } else if (user.notaryVerificationBypassed) {
          verificationMethod = 'notary_bypass';
          bypassReason = user.notaryVerificationBypassReason;
        }
      }

      // Determine if bypass is allowed
      const canBypassVerification = ['admin', 'notary'].includes(user.role) || 
                                   user.role === 'title_company'; // Title companies can often bypass for their employees

      return {
        userId,
        jobId,
        jobSpecificRole,
        primaryRole: participant?.primaryRole || user.role,
        requiresVerification: needsVerification,
        isCurrentlyVerified,
        verificationMethod,
        canBypassVerification,
        bypassReason
      };

    } catch (error) {
      console.error('Error getting verification requirements:', error);
      return null;
    }
  }

  /**
   * Update verification status for a user in a specific job
   */
  async updateVerificationStatus(
    userId: number, 
    jobId: number, 
    action: VerificationAction,
    adminUserId?: number
  ): Promise<boolean> {
    try {
      const requirements = await this.getVerificationRequirements(userId, jobId);
      if (!requirements) {
        throw new Error('User is not a participant in this job');
      }

      // Check if user is in job_participants table
      const [participant] = await db
        .select()
        .from(jobParticipants)
        .where(and(eq(jobParticipants.jobId, jobId), eq(jobParticipants.userId, userId)))
        .limit(1);

      if (participant) {
        // Update job_participants table
        const updateData: any = {};

        switch (action.action) {
          case 'verify':
            updateData.idVerificationCompleted = true;
            updateData.idVerificationCompletedAt = new Date();
            updateData.idVerificationBypassReason = null;
            break;

          case 'bypass':
            updateData.idVerificationCompleted = true;
            updateData.idVerificationCompletedAt = new Date();
            updateData.idVerificationBypassReason = action.reason || 'Admin bypass';
            updateData.idVerificationBypassedBy = adminUserId;
            updateData.idVerificationBypassedAt = new Date();
            break;

          case 'require':
            updateData.idVerificationCompleted = false;
            updateData.idVerificationCompletedAt = null;
            updateData.idVerificationBypassReason = null;
            updateData.idVerificationBypassedBy = null;
            updateData.idVerificationBypassedAt = null;
            break;
        }

        await db
          .update(jobParticipants)
          .set(updateData)
          .where(eq(jobParticipants.id, participant.id));
      }

      // Also update signers table if applicable
      const [signer] = await db
        .select()
        .from(signers)
        .where(and(eq(signers.jobId, jobId), eq(signers.userId, userId)))
        .limit(1);

      if (signer) {
        const updateData: any = {};

        switch (action.action) {
          case 'verify':
            updateData.idVerificationCompleted = true;
            updateData.idVerificationCompletedAt = new Date();
            updateData.idVerificationMethod = action.method || 'manual';
            break;

          case 'bypass':
            updateData.idVerificationCompleted = true;
            updateData.idVerificationCompletedAt = new Date();
            updateData.idVerificationMethod = 'admin_bypass';
            break;

          case 'require':
            updateData.idVerificationCompleted = false;
            updateData.idVerificationCompletedAt = null;
            updateData.idVerificationMethod = null;
            break;
        }

        await db
          .update(signers)
          .set(updateData)
          .where(eq(signers.id, signer.id));
      }

      return true;

    } catch (error) {
      console.error('Error updating verification status:', error);
      return false;
    }
  }

  /**
   * Check if a user can access a session based on their job-specific role and verification status
   */
  async canAccessSession(userId: number, jobId: number): Promise<{
    canAccess: boolean;
    reason: string;
    requiresAction: string | null;
  }> {
    try {
      const requirements = await this.getVerificationRequirements(userId, jobId);
      
      if (!requirements) {
        return {
          canAccess: false,
          reason: 'User is not a participant in this job',
          requiresAction: null
        };
      }

      // Admin always has access
      if (requirements.primaryRole === 'admin') {
        return {
          canAccess: true,
          reason: 'Admin access',
          requiresAction: null
        };
      }

      // Check if verification is required and completed
      if (requirements.requiresVerification && !requirements.isCurrentlyVerified) {
        return {
          canAccess: false,
          reason: `Your role as "${requirements.jobSpecificRole}" requires ID verification`,
          requiresAction: 'complete_verification'
        };
      }

      // Check if user has completed profile setup (for roles that require it)
      const [user] = await db
        .select({ accountSetupComplete: users.accountSetupComplete })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const needsProfileSetup = ['signer', 'witness'].includes(requirements.jobSpecificRole);
      if (needsProfileSetup && !user?.accountSetupComplete) {
        return {
          canAccess: false,
          reason: 'Profile setup is incomplete',
          requiresAction: 'complete_profile'
        };
      }

      return {
        canAccess: true,
        reason: `Access granted for ${requirements.jobSpecificRole} role`,
        requiresAction: null
      };

    } catch (error) {
      console.error('Error checking session access:', error);
      return {
        canAccess: false,
        reason: 'Error checking access permissions',
        requiresAction: null
      };
    }
  }

  /**
   * Get all participants in a job with their verification requirements
   */
  async getJobParticipantsWithVerification(jobId: number): Promise<VerificationRequirement[]> {
    try {
      const requirements: VerificationRequirement[] = [];

      // Get all participants from job_participants table
      const participants = await db
        .select({
          userId: jobParticipants.userId
        })
        .from(jobParticipants)
        .where(eq(jobParticipants.jobId, jobId));

      // Get all signers from signers table
      const signerParticipants = await db
        .select({
          userId: signers.userId
        })
        .from(signers)
        .where(eq(signers.jobId, jobId));

      // Combine and deduplicate user IDs
      const allUserIds = new Set<number>();
      participants.forEach(p => p.userId && allUserIds.add(p.userId));
      signerParticipants.forEach(s => s.userId && allUserIds.add(s.userId));

      // Get verification requirements for each user
      for (const userId of allUserIds) {
        const requirement = await this.getVerificationRequirements(userId, jobId);
        if (requirement) {
          requirements.push(requirement);
        }
      }

      return requirements;

    } catch (error) {
      console.error('Error getting job participants with verification:', error);
      return [];
    }
  }

  /**
   * Batch update verification status for multiple users
   */
  async batchUpdateVerificationStatus(
    updates: Array<{
      userId: number;
      jobId: number;
      action: VerificationAction;
    }>,
    adminUserId?: number
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const update of updates) {
      try {
        const result = await this.updateVerificationStatus(
          update.userId,
          update.jobId,
          update.action,
          adminUserId
        );

        if (result) {
          success++;
        } else {
          failed++;
          errors.push(`Failed to update user ${update.userId}`);
        }
      } catch (error) {
        failed++;
        errors.push(`Error updating user ${update.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { success, failed, errors };
  }
}

export default DualRoleVerificationService;
