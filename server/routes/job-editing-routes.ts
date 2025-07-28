import { Express } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { jobs, signers, jobParticipants, jobDocuments, users } from '../../shared/schema';
import { verifyToken, hasAdminPrivileges, hasNotaryPrivileges } from '../auth';

export function registerJobEditingRoutes(app: Express) {
  
  // ===========================
  // JOB BASIC INFO MANAGEMENT
  // ===========================
  
  // Update job basic information
  app.put('/api/jobs/:jobId', verifyToken, hasAdminPrivileges, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const userId = req.user.id;
      
      if (!jobId || isNaN(jobId)) {
        return res.status(400).json({ message: 'Invalid job ID' });
      }

      // Check permissions - admin, title_company, or job owner
      const job = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
      if (!job.length) {
        return res.status(404).json({ message: 'Job not found' });
      }

      const canEdit = req.user.role === 'admin' || 
                     req.user.role === 'title_company' ||
                     (req.user.role === 'notary' && ['open', 'pending'].includes(job[0].jobStatus));

      if (!canEdit) {
        return res.status(403).json({ message: 'You do not have permission to edit this job' });
      }

      // Extract allowed fields from request body
      const {
        titleCompany,
        closingType,
        internalReference,
        kbaRequired,
        propertyAddressOne,
        propertyAddressTwo,
        propertyCity,
        propertyState,
        propertyZipCode,
        notaryOption,
        selectedNotary,
        selectedDate,
        selectedTime,
        requiresNSA,
        requiresSpanishSpeaking,
        jobType
      } = req.body;

      // Update job
      const updateData: any = {};
      if (titleCompany !== undefined) updateData.titleCompany = titleCompany;
      if (closingType !== undefined) updateData.closingType = closingType;
      if (internalReference !== undefined) updateData.internalReference = internalReference;
      if (kbaRequired !== undefined) updateData.kbaRequired = kbaRequired;
      if (propertyAddressOne !== undefined) updateData.propertyAddressOne = propertyAddressOne;
      if (propertyAddressTwo !== undefined) updateData.propertyAddressTwo = propertyAddressTwo;
      if (propertyCity !== undefined) updateData.propertyCity = propertyCity;
      if (propertyState !== undefined) updateData.propertyState = propertyState;
      if (propertyZipCode !== undefined) updateData.propertyZipCode = propertyZipCode;
      if (notaryOption !== undefined) updateData.notaryOption = notaryOption;
      if (selectedNotary !== undefined) updateData.selectedNotary = selectedNotary;
      if (selectedDate !== undefined) updateData.selectedDate = selectedDate;
      if (selectedTime !== undefined) updateData.selectedTime = selectedTime;
      if (requiresNSA !== undefined) updateData.requiresNSA = requiresNSA;
      if (requiresSpanishSpeaking !== undefined) updateData.requiresSpanishSpeaking = requiresSpanishSpeaking;
      if (jobType !== undefined) updateData.jobType = jobType;

      await db.update(jobs).set(updateData).where(eq(jobs.id, jobId));

      // Get updated job
      const [updatedJob] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);

      res.json({
        message: 'Job updated successfully',
        job: updatedJob
      });

    } catch (error) {
      console.error('Update job error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to update job',
        error: 'job_update_failed'
      });
    }
  });

  // ===========================
  // SIGNERS MANAGEMENT
  // ===========================

  // Get signers for a job
  app.get('/api/jobs/:jobId/signers', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      if (!jobId || isNaN(jobId)) {
        return res.status(400).json({ message: 'Invalid job ID' });
      }

      // Get all signers for the job
      const jobSigners = await db
        .select()
        .from(signers)
        .where(eq(signers.jobId, jobId))
        .orderBy(signers.createdAt);

      res.json(jobSigners);

    } catch (error) {
      console.error('Get signers error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get signers',
        error: 'signers_fetch_failed'
      });
    }
  });

  // Add new signer to job
  app.post('/api/jobs/:jobId/signers', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const userId = req.user.id;
      
      if (!jobId || isNaN(jobId)) {
        return res.status(400).json({ message: 'Invalid job ID' });
      }

      // Check permissions
      const canEdit = req.user.role === 'admin' || 
                     req.user.role === 'title_company';

      if (!canEdit) {
        return res.status(403).json({ message: 'You do not have permission to add signers' });
      }

      // Validate required fields
      const { signerName, signerEmail, signerPhoneNumber, signerRole } = req.body;

      if (!signerName || !signerEmail || !signerPhoneNumber || !signerRole) {
        return res.status(400).json({ 
          message: 'All fields are required: signerName, signerEmail, signerPhoneNumber, signerRole' 
        });
      }

      // Check if email is already used for this job
      const existingSigner = await db
        .select()
        .from(signers)
        .where(and(eq(signers.jobId, jobId), eq(signers.signerEmail, signerEmail)))
        .limit(1);

      if (existingSigner.length > 0) {
        return res.status(400).json({ 
          message: 'A signer with this email is already added to this job' 
        });
      }

      // Find or create user account for the signer
      let signerUserId = null;
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, signerEmail))
        .limit(1);

      if (existingUser.length > 0) {
        signerUserId = existingUser[0].id;
      }

      // Insert new signer
      const [newSigner] = await db
        .insert(signers)
        .values({
          jobId,
          userId: signerUserId,
          signerName,
          signerEmail,
          signerPhoneNumber,
          signerRole,
          accessType: 'registered',
          guestVerificationStatus: 'pending',
          signingStatus: 'pending'
        })
        .returning();

      res.status(201).json({
        message: 'Signer added successfully',
        signer: newSigner
      });

    } catch (error) {
      console.error('Add signer error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to add signer',
        error: 'signer_add_failed'
      });
    }
  });

  // Update signer information
  app.put('/api/jobs/:jobId/signers/:signerId', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const signerId = parseInt(req.params.signerId);
      
      if (!jobId || isNaN(jobId) || !signerId || isNaN(signerId)) {
        return res.status(400).json({ message: 'Invalid job ID or signer ID' });
      }

      // Check permissions
      const canEdit = req.user.role === 'admin' || 
                     req.user.role === 'title_company';

      if (!canEdit) {
        return res.status(403).json({ message: 'You do not have permission to edit signers' });
      }

      // Check if signer exists and belongs to this job
      const existingSigner = await db
        .select()
        .from(signers)
        .where(and(eq(signers.id, signerId), eq(signers.jobId, jobId)))
        .limit(1);

      if (!existingSigner.length) {
        return res.status(404).json({ message: 'Signer not found for this job' });
      }

      // Validate and extract update fields
      const { signerName, signerEmail, signerPhoneNumber, signerRole } = req.body;

      if (!signerName || !signerEmail || !signerPhoneNumber || !signerRole) {
        return res.status(400).json({ 
          message: 'All fields are required: signerName, signerEmail, signerPhoneNumber, signerRole' 
        });
      }

      // Check if new email conflicts with other signers (excluding current signer)
      if (signerEmail !== existingSigner[0].signerEmail) {
        const emailConflict = await db
          .select()
          .from(signers)
          .where(and(
            eq(signers.jobId, jobId), 
            eq(signers.signerEmail, signerEmail),
            eq(signers.id, signerId) // Exclude current signer
          ))
          .limit(1);

        if (emailConflict.length > 0) {
          return res.status(400).json({ 
            message: 'Another signer with this email already exists for this job' 
          });
        }
      }

      // Update signer
      const [updatedSigner] = await db
        .update(signers)
        .set({
          signerName,
          signerEmail,
          signerPhoneNumber,
          signerRole
        })
        .where(eq(signers.id, signerId))
        .returning();

      res.json({
        message: 'Signer updated successfully',
        signer: updatedSigner
      });

    } catch (error) {
      console.error('Update signer error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to update signer',
        error: 'signer_update_failed'
      });
    }
  });

  // Delete signer from job
  app.delete('/api/jobs/:jobId/signers/:signerId', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const signerId = parseInt(req.params.signerId);
      
      if (!jobId || isNaN(jobId) || !signerId || isNaN(signerId)) {
        return res.status(400).json({ message: 'Invalid job ID or signer ID' });
      }

      // Check permissions
      const canEdit = req.user.role === 'admin' || 
                     req.user.role === 'title_company';

      if (!canEdit) {
        return res.status(403).json({ message: 'You do not have permission to remove signers' });
      }

      // Check if signer exists and belongs to this job
      const existingSigner = await db
        .select()
        .from(signers)
        .where(and(eq(signers.id, signerId), eq(signers.jobId, jobId)))
        .limit(1);

      if (!existingSigner.length) {
        return res.status(404).json({ message: 'Signer not found for this job' });
      }

      // Check if signing has already started
      if (existingSigner[0].signingStatus === 'in_progress' || existingSigner[0].signingStatus === 'completed') {
        return res.status(400).json({ 
          message: 'Cannot remove signer who has already started or completed signing' 
        });
      }

      // Delete signer
      await db.delete(signers).where(eq(signers.id, signerId));

      res.json({
        message: 'Signer removed successfully',
        removedSignerId: signerId
      });

    } catch (error) {
      console.error('Delete signer error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to remove signer',
        error: 'signer_delete_failed'
      });
    }
  });

  // Send invitation to signer
  app.post('/api/jobs/:jobId/signers/:signerId/invite', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const signerId = parseInt(req.params.signerId);
      
      if (!jobId || isNaN(jobId) || !signerId || isNaN(signerId)) {
        return res.status(400).json({ message: 'Invalid job ID or signer ID' });
      }

      // Check permissions
      const canEdit = req.user.role === 'admin' || 
                     req.user.role === 'title_company';

      if (!canEdit) {
        return res.status(403).json({ message: 'You do not have permission to send invitations' });
      }

      // Get signer details
      const [signer] = await db
        .select()
        .from(signers)
        .where(and(eq(signers.id, signerId), eq(signers.jobId, jobId)))
        .limit(1);

      if (!signer) {
        return res.status(404).json({ message: 'Signer not found for this job' });
      }

      // Generate invitation token
      const crypto = await import('crypto');
      const invitationToken = crypto.randomBytes(32).toString('hex');

      // Update signer with invitation details
      await db
        .update(signers)
        .set({
          invitationToken,
          invitationSentAt: new Date()
        })
        .where(eq(signers.id, signerId));

      // TODO: Send actual email invitation
      // For now, we'll just log the invitation details
      console.log(`Invitation sent to ${signer.signerEmail} for job ${jobId}`);
      console.log(`Invitation token: ${invitationToken}`);

      res.json({
        message: 'Invitation sent successfully',
        invitationToken,
        sentAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('Send invitation error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to send invitation',
        error: 'invitation_send_failed'
      });
    }
  });

  // ===========================
  // JOB PARTICIPANTS MANAGEMENT
  // ===========================

  // Get job participants (includes signers and other participants)
  app.get('/api/jobs/:jobId/participants', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      if (!jobId || isNaN(jobId)) {
        return res.status(400).json({ message: 'Invalid job ID' });
      }

      // Get job participants
      const participants = await db
        .select()
        .from(jobParticipants)
        .where(eq(jobParticipants.jobId, jobId))
        .orderBy(jobParticipants.createdAt);

      res.json(participants);

    } catch (error) {
      console.error('Get participants error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get participants',
        error: 'participants_fetch_failed'
      });
    }
  });

  // Add participant to job
  app.post('/api/jobs/:jobId/participants', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      if (!jobId || isNaN(jobId)) {
        return res.status(400).json({ message: 'Invalid job ID' });
      }

      // Check permissions
      const canEdit = req.user.role === 'admin' || 
                     req.user.role === 'title_company';

      if (!canEdit) {
        return res.status(403).json({ message: 'You do not have permission to add participants' });
      }

      const { email, role, userId } = req.body;

      if (!email || !role) {
        return res.status(400).json({ 
          message: 'Email and role are required' 
        });
      }

      // Check if participant already exists
      const existingParticipant = await db
        .select()
        .from(jobParticipants)
        .where(and(eq(jobParticipants.jobId, jobId), eq(jobParticipants.email, email)))
        .limit(1);

      if (existingParticipant.length > 0) {
        return res.status(400).json({ 
          message: 'Participant with this email already exists for this job' 
        });
      }

      // Generate invite token
      const crypto = await import('crypto');
      const inviteToken = crypto.randomBytes(32).toString('hex');

      // Insert new participant
      const [newParticipant] = await db
        .insert(jobParticipants)
        .values({
          jobId,
          userId: userId || null,
          email,
          role,
          inviteStatus: 'pending',
          inviteToken
        })
        .returning();

      res.status(201).json({
        message: 'Participant added successfully',
        participant: newParticipant
      });

    } catch (error) {
      console.error('Add participant error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to add participant',
        error: 'participant_add_failed'
      });
    }
  });

  // Remove participant from job
  app.delete('/api/jobs/:jobId/participants/:participantId', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const participantId = parseInt(req.params.participantId);
      
      if (!jobId || isNaN(jobId) || !participantId || isNaN(participantId)) {
        return res.status(400).json({ message: 'Invalid job ID or participant ID' });
      }

      // Check permissions
      const canEdit = req.user.role === 'admin' || 
                     req.user.role === 'title_company';

      if (!canEdit) {
        return res.status(403).json({ message: 'You do not have permission to remove participants' });
      }

      // Check if participant exists and belongs to this job
      const existingParticipant = await db
        .select()
        .from(jobParticipants)
        .where(and(eq(jobParticipants.id, participantId), eq(jobParticipants.jobId, jobId)))
        .limit(1);

      if (!existingParticipant.length) {
        return res.status(404).json({ message: 'Participant not found for this job' });
      }

      // Delete participant
      await db.delete(jobParticipants).where(eq(jobParticipants.id, participantId));

      res.json({
        message: 'Participant removed successfully',
        removedParticipantId: participantId
      });

    } catch (error) {
      console.error('Delete participant error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to remove participant',
        error: 'participant_delete_failed'
      });
    }
  });
} 