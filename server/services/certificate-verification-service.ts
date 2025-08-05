import { db } from '../db';
import { users, jobs, signers, selfSignedCertificates } from '../../shared/schema';
import { eq, and, or } from 'drizzle-orm';

export interface CertificateStatus {
  userId: number;
  userEmail: string;
  userName: string;
  userRole: string;
  hasCertificate: boolean;
  certificateValid: boolean;
  certificateExpired: boolean;
  certificateId?: string;
  certificateExpiry?: Date;
  certificateIssued?: Date;
  requiresCertificate: boolean;
  canProceed: boolean;
  issues: string[];
}

export interface JobCertificateVerification {
  jobId: number;
  canStartJob: boolean;
  allParticipantsReady: boolean;
  participantStatuses: CertificateStatus[];
  blockedBy: string[];
  summary: {
    totalParticipants: number;
    withValidCertificates: number;
    withoutCertificates: number;
    withExpiredCertificates: number;
  };
}

export class CertificateVerificationService {
  private static instance: CertificateVerificationService;

  public static getInstance(): CertificateVerificationService {
    if (!CertificateVerificationService.instance) {
      CertificateVerificationService.instance = new CertificateVerificationService();
    }
    return CertificateVerificationService.instance;
  }

  /**
   * Verify certificate requirements for all job participants
   */
  async verifyJobCertificateRequirements(jobId: number): Promise<JobCertificateVerification> {
    try {
      // Get job details
      const job = await this.getJobDetails(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      // Get all participants (notary + signers)
      const participants = await this.getJobParticipants(jobId);

      // Check certificate status for each participant
      const participantStatuses: CertificateStatus[] = [];
      const blockedBy: string[] = [];

      for (const participant of participants) {
        const status = await this.checkUserCertificateStatus(participant);
        participantStatuses.push(status);

        if (status.requiresCertificate && !status.canProceed) {
          blockedBy.push(`${status.userName} (${status.userEmail}) - ${status.issues.join(', ')}`);
        }
      }

      // Calculate summary
      const summary = {
        totalParticipants: participantStatuses.length,
        withValidCertificates: participantStatuses.filter(p => p.hasCertificate && p.certificateValid).length,
        withoutCertificates: participantStatuses.filter(p => p.requiresCertificate && !p.hasCertificate).length,
        withExpiredCertificates: participantStatuses.filter(p => p.hasCertificate && p.certificateExpired).length
      };

      const canStartJob = blockedBy.length === 0;
      const allParticipantsReady = participantStatuses.every(p => p.canProceed);

      return {
        jobId,
        canStartJob,
        allParticipantsReady,
        participantStatuses,
        blockedBy,
        summary
      };

    } catch (error) {
      console.error(`❌ Failed to verify certificate requirements for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Check certificate status for a specific user
   */
  async checkUserCertificateStatus(user: any): Promise<CertificateStatus> {
    try {
      const requiresCertificate = this.userRequiresCertificate(user.role);
      
      let hasCertificate = false;
      let certificateExpired = false;
      let certificateValid = false;
      let certificateId = '';
      let certificateExpiry: Date | undefined;
      let certificateIssued: Date | undefined;

      // For notaries, first check if they have uploaded .pfx certificate
      if (user.role === 'notary' && user.publicCertificateFile) {
        try {
          console.log(`📂 Checking uploaded notary certificate for ${user.email}: ${user.publicCertificateFile}`);
          
          // Check if uploaded certificate exists (we'll assume it's valid if the file field is set)
          hasCertificate = true;
          certificateId = user.publicCertificateFile;
          
          // Check expiration if provided
          if (user.publicCertificateExpiration) {
            certificateExpiry = new Date(user.publicCertificateExpiration);
            certificateExpired = certificateExpiry < new Date();
          }
          
          certificateValid = hasCertificate && !certificateExpired;
          console.log(`✅ Found uploaded notary certificate for ${user.email}`);
        } catch (error) {
          console.warn(`⚠️ Error checking uploaded certificate for notary ${user.email}:`, error);
          // Fall back to self-signed certificate check below
          hasCertificate = false;
        }
      }

      // If no uploaded certificate found, check self-signed certificates table
      if (!hasCertificate) {
        const [certificate] = await db
          .select()
          .from(selfSignedCertificates)
          .where(and(
            eq(selfSignedCertificates.userId, user.id),
            eq(selfSignedCertificates.status, 'active')
          ))
          .limit(1);

        if (certificate) {
          hasCertificate = true;
          certificateExpired = new Date(certificate.expiresAt) < new Date();
          certificateValid = hasCertificate && !certificateExpired;
          certificateId = certificate.serialNumber || certificate.id.toString();
          certificateExpiry = new Date(certificate.expiresAt);
          certificateIssued = new Date(certificate.createdAt);
        }
      }

      const issues: string[] = [];
      let canProceed = true;

      if (requiresCertificate) {
        if (!hasCertificate) {
          issues.push('No digital certificate found');
          canProceed = false;
        } else if (certificateExpired) {
          issues.push('Digital certificate has expired');
          canProceed = false;
        }
      }

      // Additional validation for notaries
      if (user.role === 'notary') {
        if (user.approvalStatus !== 'approved') {
          issues.push('Notary not approved');
          canProceed = false;
        }
        if (!user.profileSubmitted) {
          issues.push('Notary profile incomplete');
          canProceed = false;
        }
      }

      return {
        userId: user.id,
        userEmail: user.email,
        userName: user.fullName || `${user.firstName} ${user.lastName}`.trim() || user.email,
        userRole: user.role,
        hasCertificate,
        certificateValid,
        certificateExpired,
        certificateId,
        certificateExpiry,
        certificateIssued,
        requiresCertificate,
        canProceed,
        issues
      };

    } catch (error) {
      console.error(`❌ Failed to check certificate status for user ${user.id}:`, error);
      return {
        userId: user.id,
        userEmail: user.email || 'unknown',
        userName: 'Unknown User',
        userRole: user.role || 'unknown',
        hasCertificate: false,
        certificateValid: false,
        certificateExpired: false,
        certificateId: '',
        certificateExpiry: undefined,
        certificateIssued: undefined,
        requiresCertificate: true,
        canProceed: false,
        issues: ['Error checking certificate status']
      };
    }
  }

  /**
   * Get all participants for a job
   */
  private async getJobParticipants(jobId: number): Promise<any[]> {
    try {
      const participants: any[] = [];
      const participantIds = new Set<number>();

      // Get job details to find creator and notary
      const job = await this.getJobDetails(jobId);
      if (!job) {
        return participants;
      }
      
      // 1. Add Job Creator
      if (job.userId) {
        const [creator] = await db.select().from(users).where(eq(users.id, job.userId)).limit(1);
        if (creator && !participantIds.has(creator.id)) {
          participants.push(creator);
          participantIds.add(creator.id);
        }
      }

      // 2. Add Notary if assigned
      if (job.selectedNotary) {
        const notaryId = parseInt(job.selectedNotary);
        if (!isNaN(notaryId) && !participantIds.has(notaryId)) {
          const [notary] = await db.select().from(users).where(eq(users.id, notaryId)).limit(1);
          if (notary) {
            participants.push(notary);
            participantIds.add(notary.id);
          }
        }
      }

      // 3. Add all signers
      const jobSigners = await db
        .select({
          signerId: signers.userId,
          signerEmail: signers.signerEmail
        })
        .from(signers)
        .where(eq(signers.jobId, jobId));

      for (const signer of jobSigners) {
        if (signer.signerId && !participantIds.has(signer.signerId)) {
          // User exists in system
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, signer.signerId))
            .limit(1);

          if (user) {
            participants.push(user);
            participantIds.add(user.id);
          }
        } else if (!signer.signerId) {
          // External signer - create a placeholder entry
          participants.push({
            id: 0, // External users don't have an ID in our system
            email: signer.signerEmail,
            fullName: signer.signerEmail,
            role: 'signer',
            isExternal: true
          });
        }
      }

      return participants;

    } catch (error) {
      console.error(`❌ Failed to get job participants for job ${jobId}:`, error);
      return [];
    }
  }

  /**
   * Get job details
   */
  private async getJobDetails(jobId: number): Promise<any> {
    try {
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);

      return job;
    } catch (error) {
      console.error(`❌ Failed to get job details for job ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Check if user role requires a certificate
   */
  private userRequiresCertificate(role: string): boolean {
    // Only notaries require certificates - signers and witnesses are optional
    // External signers who haven't registered don't need certificates initially
    if (!role) {
      return false;
    }
    return ['notary'].includes(role);
  }

  /**
   * Generate certificate for user if they don't have one
   */
  async generateCertificateForUser(userId: number): Promise<{
    success: boolean;
    message: string;
    certificateId?: string;
  }> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Check if user already has an active certificate
      const [existingCert] = await db
        .select()
        .from(selfSignedCertificates)
        .where(and(
          eq(selfSignedCertificates.userId, userId),
          eq(selfSignedCertificates.status, 'active')
        ))
        .limit(1);

      if (existingCert) {
        return { 
          success: false, 
          message: 'User already has an active certificate',
          certificateId: existingCert.certificateId
        };
      }

      // Generate certificate using existing service
      const { selfSignedCertificateService } = await import('./self-signed-certificate-service');
      
      const result = await selfSignedCertificateService.generateCertificateForUser(userId);

      if (result.success) {
        return {
          success: true,
          message: 'Certificate generated successfully',
          certificateId: result.certificateId
        };
      } else {
        return {
          success: false,
          message: result.error || 'Failed to generate certificate'
        };
      }

    } catch (error) {
      console.error(`❌ Failed to generate certificate for user ${userId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Certificate generation failed'
      };
    }
  }

  /**
   * Check if job can start based on certificate requirements
   */
  async canJobStart(jobId: number): Promise<{
    canStart: boolean;
    reason?: string;
    missingCertificates?: string[];
  }> {
    try {
      const verification = await this.verifyJobCertificateRequirements(jobId);
      
      if (verification.canStartJob) {
        return { canStart: true };
      }

      return {
        canStart: false,
        reason: 'Missing or invalid certificates',
        missingCertificates: verification.blockedBy
      };

    } catch (error) {
      console.error(`❌ Failed to check if job ${jobId} can start:`, error);
      return {
        canStart: false,
        reason: 'Error checking certificate requirements'
      };
    }
  }
}