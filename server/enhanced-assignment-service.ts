import { eq, and, not, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { 
  users, 
  jobs, 
  titleCompanies,
  notaryAssignmentLog,
  jobDocuments,
  signers,
  jobParticipants,
  InsertNotaryAssignmentLog 
} from "../shared/schema";

export interface NotaryAssignmentResult {
  success: boolean;
  notaryId?: number;
  notaryName?: string;
  assignmentType?: 'admin_self' | 'subscriber_self' | 'preferred' | 'random' | 'manual';
  error?: string;
  requiresApproval?: boolean;
}

export interface JobValidationResult {
  isValid: boolean;
  hasNotary: boolean;
  hasParticipants: boolean;
  hasDocuments: boolean;
  errors: string[];
  warnings: string[];
}

export class EnhancedAssignmentService {
  
  /**
   * Comprehensive notary assignment with intelligent fallbacks
   */
  static async assignNotaryToJob(
    jobId: number, 
    userId: number, 
    userRole: string,
    notaryOption: string,
    selectedNotary?: string
  ): Promise<NotaryAssignmentResult> {
    try {
      // Get job details
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);

      if (!job) {
        return { success: false, error: 'Job not found' };
      }

      // If job already has notary, return success
      if (job.notaryId) {
        const [notary] = await db
          .select()
          .from(users)
          .where(eq(users.id, job.notaryId))
          .limit(1);

        return {
          success: true,
          notaryId: job.notaryId,
          notaryName: notary ? `${notary.firstName} ${notary.lastName}` : 'Unknown',
          assignmentType: 'manual' // Already assigned
        };
      }

      // Assignment logic based on user role and option
      let assignmentResult: NotaryAssignmentResult;

      switch (userRole) {
        case 'notary':
          assignmentResult = await this.handleNotaryCreatedJob(jobId, userId);
          break;
        
        case 'admin':
          assignmentResult = await this.handleAdminCreatedJob(jobId, userId, notaryOption, selectedNotary);
          break;
        
        case 'title_company':
          assignmentResult = await this.handleTitleCompanyCreatedJob(jobId, job.titleCompany, notaryOption, selectedNotary);
          break;
        
        default:
          assignmentResult = { success: false, error: `Unsupported user role: ${userRole}` };
      }

      // Log the assignment attempt
      if (assignmentResult.success && assignmentResult.notaryId) {
        await this.logAssignment(
          jobId, 
          assignmentResult.notaryId, 
          assignmentResult.assignmentType || 'manual',
          'assigned'
        );

        // Update job with notary assignment
        await db
          .update(jobs)
          .set({
            notaryId: assignmentResult.notaryId,
            selectedNotary: assignmentResult.notaryId.toString(),
            notaryApprovalStatus: assignmentResult.requiresApproval ? 'assigned_pending_approval' : 'approved'
          })
          .where(eq(jobs.id, jobId));
      }

      return assignmentResult;

    } catch (error) {
      console.error('Enhanced assignment service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Assignment failed'
      };
    }
  }

  /**
   * Handle notary-created job assignment
   */
  private static async handleNotaryCreatedJob(jobId: number, notaryUserId: number): Promise<NotaryAssignmentResult> {
    const [notary] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, notaryUserId),
        eq(users.role, 'notary'),
        eq(users.isActive, true)
      ))
      .limit(1);

    if (!notary) {
      return { success: false, error: 'Notary user not found or inactive' };
    }

    // Subscriber notaries auto-assign themselves
    if (notary.notaryType === 'subscriber') {
      return {
        success: true,
        notaryId: notary.id,
        notaryName: `${notary.firstName} ${notary.lastName}`,
        assignmentType: 'subscriber_self',
        requiresApproval: false // Subscriber notaries don't need approval for their own jobs
      };
    }

    // Contractor notaries can't assign themselves directly
    return { success: false, error: 'Contractor notaries cannot self-assign. Please use admin assignment.' };
  }

  /**
   * Handle admin-created job assignment
   */
  private static async handleAdminCreatedJob(
    jobId: number, 
    adminUserId: number, 
    notaryOption: string,
    selectedNotary?: string
  ): Promise<NotaryAssignmentResult> {
    const [admin] = await db
      .select()
      .from(users)
      .where(eq(users.id, adminUserId))
      .limit(1);

    if (!admin) {
      return { success: false, error: 'Admin user not found' };
    }

    switch (notaryOption) {
      case 'admin_self':
        // Admin assigns themselves as notary
        if (admin.role === 'admin' && admin.notaryType) {
          return {
            success: true,
            notaryId: admin.id,
            notaryName: `${admin.firstName} ${admin.lastName}`,
            assignmentType: 'admin_self',
            requiresApproval: false // Admin doesn't need approval for their own jobs
          };
        }
        return { success: false, error: 'Admin does not have notary privileges' };

      case 'assign':
        // Manual assignment to specific notary
        if (selectedNotary) {
          return await this.assignSpecificNotary(parseInt(selectedNotary));
        }
        return { success: false, error: 'No notary selected for manual assignment' };

      case 'auto':
        // Intelligent auto-assignment
        return await this.performAutoAssignment(jobId);

      default:
        return { success: false, error: `Unknown notary option: ${notaryOption}` };
    }
  }

  /**
   * Handle title company created job assignment
   */
  private static async handleTitleCompanyCreatedJob(
    jobId: number,
    titleCompanyName: string,
    notaryOption: string,
    selectedNotary?: string
  ): Promise<NotaryAssignmentResult> {
    switch (notaryOption) {
      case 'assign':
        // Manual assignment
        if (selectedNotary) {
          return await this.assignSpecificNotary(parseInt(selectedNotary));
        }
        return { success: false, error: 'No notary selected for manual assignment' };

      case 'auto':
        // Auto-assignment with preferred notary check
        return await this.performAutoAssignment(jobId, titleCompanyName);

      default:
        return { success: false, error: `Title companies cannot use notary option: ${notaryOption}` };
    }
  }

  /**
   * Assign specific notary by ID
   */
  private static async assignSpecificNotary(notaryId: number): Promise<NotaryAssignmentResult> {
    const [notary] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, notaryId),
        eq(users.role, 'notary'),
        eq(users.isActive, true)
      ))
      .limit(1);

    if (!notary) {
      return { success: false, error: 'Selected notary not found or inactive' };
    }

    return {
      success: true,
      notaryId: notary.id,
      notaryName: `${notary.firstName} ${notary.lastName}`,
      assignmentType: 'manual',
      requiresApproval: notary.notaryType === 'contractor' // Contractors need approval
    };
  }

  /**
   * Perform intelligent auto-assignment
   */
  static async performAutoAssignment(
    jobId: number, 
    titleCompanyName?: string
  ): Promise<NotaryAssignmentResult> {
    try {
      // Step 1: Try preferred notary if title company specified
      if (titleCompanyName) {
        const preferredResult = await this.tryPreferredNotary(titleCompanyName);
        if (preferredResult.success) {
          return preferredResult;
        }
      }

      // Step 2: Try random available notary
      const randomResult = await this.tryRandomNotary(jobId);
      if (randomResult.success) {
        return randomResult;
      }

      // Step 3: No notaries available
      return { 
        success: false, 
        error: 'No available notaries found. Please assign manually or try again later.' 
      };

    } catch (error) {
      return {
        success: false,
        error: `Auto-assignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Try to assign preferred notary for title company
   */
  private static async tryPreferredNotary(titleCompanyName: string): Promise<NotaryAssignmentResult> {
    const preferredNotaryQuery = await db
      .select({
        notaryId: titleCompanies.preferredNotaryId,
        notaryFirstName: users.firstName,
        notaryLastName: users.lastName,
        notaryActive: users.isActive
      })
      .from(titleCompanies)
      .leftJoin(users, eq(titleCompanies.preferredNotaryId, users.id))
      .where(eq(titleCompanies.companyName, titleCompanyName))
      .limit(1);

    const preferred = preferredNotaryQuery[0];
    
    if (preferred?.notaryId && preferred.notaryActive) {
      return {
        success: true,
        notaryId: preferred.notaryId,
        notaryName: `${preferred.notaryFirstName} ${preferred.notaryLastName}`,
        assignmentType: 'preferred',
        requiresApproval: false // AUTO ASSIGNMENT FIX: Preferred notaries are also automatically approved for auto assignments
      };
    }

    return { success: false, error: 'Preferred notary not available' };
  }

  /**
   * Try to assign random available notary
   */
  private static async tryRandomNotary(jobId: number): Promise<NotaryAssignmentResult> {
    // Get job details for rejected notaries
    const [job] = await db
      .select({ rejectedNotaries: jobs.rejectedNotaries })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    const rejectedIds = job?.rejectedNotaries || [];

    // Find available contractor notaries
    const availableNotariesQuery = await db
      .select()
      .from(users)
      .where(and(
        eq(users.role, 'notary'),
        eq(users.notaryType, 'contractor'),
        eq(users.isActive, true),
        ...(rejectedIds.length > 0 ? [not(inArray(users.id, rejectedIds.map(id => parseInt(id))))] : [])
      ))
      .limit(10); // Limit for performance

    if (availableNotariesQuery.length === 0) {
      return { success: false, error: 'No available contractor notaries found' };
    }

    // Select random notary
    const randomIndex = Math.floor(Math.random() * availableNotariesQuery.length);
    const selectedNotary = availableNotariesQuery[randomIndex];

    return {
      success: true,
      notaryId: selectedNotary.id,
      notaryName: `${selectedNotary.firstName} ${selectedNotary.lastName}`,
      assignmentType: 'random',
      requiresApproval: false // AUTO ASSIGNMENT FIX: Auto-assigned jobs are automatically approved
    };
  }

  /**
   * Validate job completeness
   */
  static async validateJobCompleteness(jobId: number): Promise<JobValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check notary assignment
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    const hasNotary = job?.notaryId !== null && job?.notaryId !== undefined;
    if (!hasNotary) {
      errors.push('No notary assigned to this job');
    }

    // Check participants (signers or job_participants)
    const [signerCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(signers)
      .where(eq(signers.jobId, jobId));

    const [participantCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobParticipants)
      .where(and(
        eq(jobParticipants.jobId, jobId),
        inArray(jobParticipants.role, ['signer', 'witness'])
      ));

    const hasParticipants = (signerCount?.count || 0) > 0 || (participantCount?.count || 0) > 0;
    if (!hasParticipants) {
      errors.push('No participants (signers/witnesses) added to this job');
    }

    // Check documents
    const [documentCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobDocuments)
      .where(eq(jobDocuments.jobId, jobId));

    const hasDocuments = (documentCount?.count || 0) > 0;
    if (!hasDocuments) {
      errors.push('No documents uploaded for this job');
    }

    // Add warnings for potential issues
    if (job?.notaryApprovalStatus === 'assigned_pending_approval') {
      warnings.push('Notary has not yet approved this job assignment');
    }

    if (job?.jobStatus === 'open' && hasNotary && hasParticipants && hasDocuments) {
      warnings.push('Job appears ready but is still in "open" status');
    }

    return {
      isValid: errors.length === 0,
      hasNotary,
      hasParticipants,
      hasDocuments,
      errors,
      warnings
    };
  }

  /**
   * Auto-fix jobs that can be automatically resolved
   */
  static async autoFixJob(jobId: number, userRole: string, userId: number): Promise<NotaryAssignmentResult> {
    const validation = await this.validateJobCompleteness(jobId);
    
    if (!validation.hasNotary) {
      // Try to auto-assign notary
      return await this.assignNotaryToJob(jobId, userId, userRole, 'auto');
    }

    if (validation.isValid) {
      return { success: true, error: 'Job is already valid' };
    }

    return {
      success: false,
      error: `Job requires manual intervention: ${validation.errors.join(', ')}`
    };
  }

  /**
   * Log notary assignment
   */
  private static async logAssignment(
    jobId: number,
    notaryId: number,
    assignmentType: string,
    assignmentStatus: string
  ): Promise<void> {
    try {
      await db.insert(notaryAssignmentLog).values({
        jobId,
        notaryId,
        assignmentType,
        assignmentStatus
      });
    } catch (error) {
      console.error('Failed to log assignment:', error);
      // Don't throw error for logging failures
    }
  }

  /**
   * Get assignment statistics
   */
  static async getAssignmentStats(): Promise<any> {
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN notary_id IS NOT NULL THEN 1 END) as jobs_with_notary,
        COUNT(CASE WHEN notary_approval_status = 'pending_assignment' THEN 1 END) as pending_assignment,
        COUNT(CASE WHEN notary_approval_status = 'assigned_pending_approval' THEN 1 END) as pending_approval,
        COUNT(CASE WHEN notary_approval_status = 'approved' THEN 1 END) as approved,
        AVG(assignment_attempts) as avg_assignment_attempts
      FROM jobs 
      WHERE job_status != 'cancelled'
    `);

    return stats.rows[0];
  }
} 