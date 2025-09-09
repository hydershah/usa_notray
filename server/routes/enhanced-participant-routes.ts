import { Express } from 'express';
import { db } from '../db.js';
import { users, jobParticipants, signers, jobs } from '../../shared/schema.js';
import { eq, and, or } from 'drizzle-orm';
import { verifyToken } from '../auth.js';
import { ParticipantRoleSummary, RoleAssignmentRequest } from '../../shared/types.js';
import { checkJobSpecificVerificationNeeded } from '../middleware/dual-role-verification.js';

export function registerEnhancedParticipantRoutes(app: Express) {

  /**
   * Get enhanced participant information for a job
   * Includes dual role information and verification status
   */
  app.get('/api/jobs/:jobId/participants/enhanced', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      if (!jobId || isNaN(jobId)) {
        return res.status(400).json({ error: 'Invalid job ID' });
      }

      // Check if user has access to this job
      const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Check permissions
      const canView = req.user.role === 'admin' || 
                     req.user.role === 'title_company' ||
                     req.user.role === 'notary' ||
                     job.userId === req.user.id;

      if (!canView) {
        return res.status(403).json({ error: 'You do not have permission to view participants for this job' });
      }

      // Get participants from job_participants table
      const jobParticipantsData = await db
        .select({
          id: jobParticipants.id,
          jobId: jobParticipants.jobId,
          userId: jobParticipants.userId,
          email: jobParticipants.email,
          role: jobParticipants.role,
          jobSpecificRole: jobParticipants.jobSpecificRole,
          primaryRole: jobParticipants.primaryRole,
          inviteStatus: jobParticipants.inviteStatus,
          requiresIdVerification: jobParticipants.requiresIdVerification,
          idVerificationCompleted: jobParticipants.idVerificationCompleted,
          joinedAt: jobParticipants.joinedAt,
          createdAt: jobParticipants.createdAt
        })
        .from(jobParticipants)
        .where(eq(jobParticipants.jobId, jobId));

      // Get signers from signers table
      const signersData = await db
        .select({
          id: signers.id,
          jobId: signers.jobId,
          userId: signers.userId,
          signerName: signers.signerName,
          signerEmail: signers.signerEmail,
          signerPhoneNumber: signers.signerPhoneNumber,
          signerRole: signers.signerRole,
          primaryUserRole: signers.primaryUserRole,
          invitationSentAt: signers.invitationSentAt,
          accessType: signers.accessType,
          signingStatus: signers.signingStatus,
          requiresIdVerification: signers.requiresIdVerification,
          idVerificationCompleted: signers.idVerificationCompleted
        })
        .from(signers)
        .where(eq(signers.jobId, jobId));

      // Combine and enhance participant data
      const enhancedParticipants: ParticipantRoleSummary[] = [];

      // Process job_participants
      for (const participant of jobParticipantsData) {
        let userInfo = null;
        if (participant.userId) {
          const [user] = await db
            .select({
              id: users.id,
              username: users.username,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
              role: users.role
            })
            .from(users)
            .where(eq(users.id, participant.userId))
            .limit(1);
          userInfo = user;
        }

        // Check verification status
        const verificationCheck = await checkJobSpecificVerificationNeeded(
          participant.userId || 0,
          jobId,
          participant.jobSpecificRole || participant.role || 'observer'
        );

        enhancedParticipants.push({
          id: participant.id,
          jobId: participant.jobId,
          userId: participant.userId,
          email: participant.email,
          username: userInfo?.username || null,
          firstName: userInfo?.firstName || null,
          lastName: userInfo?.lastName || null,
          userSystemRole: participant.primaryRole || userInfo?.role || 'unknown',
          jobRole: participant.jobSpecificRole || participant.role || 'observer',
          requiresIdVerification: participant.requiresIdVerification ?? verificationCheck.needsVerification,
          idVerificationCompleted: participant.idVerificationCompleted ?? verificationCheck.isVerified,
          inviteStatus: participant.inviteStatus || 'pending',
          hasDualRole: (participant.primaryRole || userInfo?.role) !== (participant.jobSpecificRole || participant.role),
          verificationStatus: participant.requiresIdVerification 
            ? (participant.idVerificationCompleted ? 'verified' : 'verification_required')
            : 'no_verification_needed'
        });
      }

      // Process signers (if not already in job_participants)
      for (const signer of signersData) {
        // Check if this signer is already in job_participants
        const existingParticipant = enhancedParticipants.find(p => 
          p.email.toLowerCase() === signer.signerEmail.toLowerCase()
        );

        if (!existingParticipant) {
          let userInfo = null;
          if (signer.userId) {
            const [user] = await db
              .select({
                id: users.id,
                username: users.username,
                firstName: users.firstName,
                lastName: users.lastName,
                email: users.email,
                role: users.role
              })
              .from(users)
              .where(eq(users.id, signer.userId))
              .limit(1);
            userInfo = user;
          }

          // Parse name from signerName
          const nameParts = signer.signerName.split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';

          // Check verification status
          const verificationCheck = await checkJobSpecificVerificationNeeded(
            signer.userId || 0,
            jobId,
            'signer'
          );

          enhancedParticipants.push({
            id: signer.id,
            jobId: signer.jobId,
            userId: signer.userId,
            email: signer.signerEmail,
            username: userInfo?.username || null,
            firstName: userInfo?.firstName || firstName,
            lastName: userInfo?.lastName || lastName,
            userSystemRole: signer.primaryUserRole || userInfo?.role || 'signer',
            jobRole: 'signer',
            requiresIdVerification: signer.requiresIdVerification ?? true,
            idVerificationCompleted: signer.idVerificationCompleted ?? verificationCheck.isVerified,
            inviteStatus: signer.signingStatus || 'pending',
            hasDualRole: (signer.primaryUserRole || userInfo?.role) !== 'signer',
            verificationStatus: (signer.requiresIdVerification ?? true)
              ? (signer.idVerificationCompleted ? 'verified' : 'verification_required')
              : 'no_verification_needed'
          });
        }
      }

      res.json(enhancedParticipants);

    } catch (error) {
      console.error('Error fetching enhanced participants:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Add a participant with dual role support
   */
  app.post('/api/jobs/:jobId/participants/enhanced', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const roleRequest: RoleAssignmentRequest = req.body;
      
      if (!jobId || isNaN(jobId)) {
        return res.status(400).json({ error: 'Invalid job ID' });
      }

      if (!roleRequest.email || !roleRequest.jobSpecificRole) {
        return res.status(400).json({ error: 'Email and job-specific role are required' });
      }

      // Check permissions
      const canEdit = req.user.role === 'admin' || 
                     req.user.role === 'title_company' ||
                     req.user.role === 'notary';

      if (!canEdit) {
        return res.status(403).json({ error: 'You do not have permission to add participants' });
      }

      // Check if participant already exists
      const existingParticipant = await db
        .select()
        .from(jobParticipants)
        .where(and(eq(jobParticipants.jobId, jobId), eq(jobParticipants.email, roleRequest.email)))
        .limit(1);

      if (existingParticipant.length > 0) {
        return res.status(400).json({ error: 'Participant with this email already exists for this job' });
      }

      // Look up user if userId provided or find by email
      let userId = roleRequest.userId;
      let primaryRole = 'unknown';

      if (!userId) {
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, roleRequest.email.toLowerCase()))
          .limit(1);

        if (existingUser) {
          userId = existingUser.id;
          primaryRole = existingUser.role;
        }
      } else {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (user) {
          primaryRole = user.role;
        }
      }

      // Determine verification requirements
      const rolesRequiringVerification = ['signer', 'witness'];
      const defaultRequiresVerification = rolesRequiringVerification.includes(roleRequest.jobSpecificRole);
      const requiresVerification = roleRequest.requiresIdVerification ?? defaultRequiresVerification;

      // Generate invite token
      const crypto = await import('crypto');
      const inviteToken = crypto.randomBytes(32).toString('hex');

      // Create participant record
      const [newParticipant] = await db
        .insert(jobParticipants)
        .values({
          jobId,
          userId: userId || null,
          email: roleRequest.email,
          role: roleRequest.jobSpecificRole, // Legacy field
          jobSpecificRole: roleRequest.jobSpecificRole,
          primaryRole: primaryRole,
          inviteStatus: 'pending',
          inviteToken,
          requiresIdVerification: requiresVerification,
          idVerificationCompleted: false
        })
        .returning();

      // If this is a signer role, also create a signer record for compatibility
      if (roleRequest.jobSpecificRole === 'signer') {
        // Parse name from email if not provided
        const emailParts = roleRequest.email.split('@')[0];
        const defaultName = emailParts.replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        await db
          .insert(signers)
          .values({
            jobId,
            userId: userId || null,
            signerName: defaultName, // This would ideally come from the form
            signerEmail: roleRequest.email,
            signerPhoneNumber: '', // This would ideally come from the form
            signerRole: 'borrower', // Default traditional role
            primaryUserRole: primaryRole,
            invitationToken: inviteToken,
            accessType: 'registered',
            guestVerificationStatus: 'pending',
            signingStatus: 'pending',
            requiresIdVerification: requiresVerification,
            idVerificationCompleted: false
          });
      }

      res.status(201).json({
        message: 'Participant added successfully',
        participant: newParticipant
      });

    } catch (error) {
      console.error('Error adding enhanced participant:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Update participant role assignment
   */
  app.put('/api/jobs/:jobId/participants/:participantId/enhanced', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const participantId = parseInt(req.params.participantId);
      const roleRequest: RoleAssignmentRequest = req.body;
      
      if (!jobId || isNaN(jobId) || !participantId || isNaN(participantId)) {
        return res.status(400).json({ error: 'Invalid job ID or participant ID' });
      }

      // Check permissions
      const canEdit = req.user.role === 'admin' || 
                     req.user.role === 'title_company' ||
                     req.user.role === 'notary';

      if (!canEdit) {
        return res.status(403).json({ error: 'You do not have permission to update participants' });
      }

      // Check if participant exists
      const [existingParticipant] = await db
        .select()
        .from(jobParticipants)
        .where(and(eq(jobParticipants.jobId, jobId), eq(jobParticipants.id, participantId)))
        .limit(1);

      if (!existingParticipant) {
        return res.status(404).json({ error: 'Participant not found' });
      }

      // Determine verification requirements
      const rolesRequiringVerification = ['signer', 'witness'];
      const defaultRequiresVerification = rolesRequiringVerification.includes(roleRequest.jobSpecificRole);
      const requiresVerification = roleRequest.requiresIdVerification ?? defaultRequiresVerification;

      // Update participant
      const [updatedParticipant] = await db
        .update(jobParticipants)
        .set({
          jobSpecificRole: roleRequest.jobSpecificRole,
          role: roleRequest.jobSpecificRole, // Update legacy field too
          requiresIdVerification: requiresVerification,
          // Reset verification status if requirements changed
          idVerificationCompleted: requiresVerification ? false : true
        })
        .where(eq(jobParticipants.id, participantId))
        .returning();

      res.json({
        message: 'Participant updated successfully',
        participant: updatedParticipant
      });

    } catch (error) {
      console.error('Error updating enhanced participant:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Get job-specific verification status for a user
   */
  app.get('/api/jobs/:jobId/users/:userId/verification-status', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const userId = parseInt(req.params.userId);
      
      if (!jobId || isNaN(jobId) || !userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid job ID or user ID' });
      }

      // Check permissions
      const canView = req.user.role === 'admin' || 
                     req.user.role === 'title_company' ||
                     req.user.role === 'notary' ||
                     req.user.id === userId;

      if (!canView) {
        return res.status(403).json({ error: 'You do not have permission to view verification status' });
      }

      // Import the verification function
      const { getJobSpecificVerificationStatus } = await import('../middleware/dual-role-verification.js');
      
      const verificationStatus = await getJobSpecificVerificationStatus(userId, jobId);
      
      if (!verificationStatus) {
        return res.status(404).json({ error: 'Verification status not found' });
      }

      res.json(verificationStatus);

    } catch (error) {
      console.error('Error getting job-specific verification status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * User lookup for participant assignment
   */
  app.get('/api/users/lookup', verifyToken, async (req: any, res) => {
    try {
      const { email, limit = 10 } = req.query;
      
      if (!email || typeof email !== 'string' || email.length < 3) {
        return res.status(400).json({ error: 'Email query must be at least 3 characters' });
      }

      // Check permissions
      const canLookup = req.user.role === 'admin' || 
                       req.user.role === 'title_company' ||
                       req.user.role === 'notary';

      if (!canLookup) {
        return res.status(403).json({ error: 'You do not have permission to lookup users' });
      }

      // Search for users by email
      const matchingUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          fullName: users.fullName,
          role: users.role,
          phoneNumber: users.phoneNumber,
          isActive: users.isActive
        })
        .from(users)
        .where(
          and(
            or(
              eq(users.email, email.toLowerCase()),
              // Add partial matching for email lookup
              // This would need to be implemented based on your DB's capabilities
            ),
            eq(users.isActive, true)
          )
        )
        .limit(parseInt(limit.toString()));

      res.json(matchingUsers);

    } catch (error) {
      console.error('Error looking up users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

}
