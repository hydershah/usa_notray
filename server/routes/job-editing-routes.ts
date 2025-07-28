import { Express } from 'express';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { verifyToken } from '../auth';
import { storage } from '../storage';
import { db } from '../db';
import { jobs, signers, users } from '../../shared/schema';
import { emailService } from '../lib/email-service';

export function registerJobEditingRoutes(app: Express) {
  
  // Job details update endpoint for editing job information
  app.put('/api/jobs/:id/details', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      
      if (isNaN(jobId) || jobId <= 0) {
        return res.status(400).json({ 
          message: 'Invalid job ID provided',
          error: 'invalid_job_id'
        });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check permissions - admin, job creator, or assigned notary can edit
      const canEdit = req.user.role === 'admin' || 
                      job.userId === req.user.id || 
                      job.selectedNotary === req.user.id.toString() ||
                      job.notaryId === req.user.id;

      if (!canEdit) {
        return res.status(403).json({ 
          message: 'Access denied. You do not have permission to edit this job.' 
        });
      }

      // Prevent editing completed or cancelled jobs
      if (job.jobStatus === 'completed' || job.jobStatus === 'cancelled') {
        return res.status(400).json({ 
          message: `Cannot edit ${job.jobStatus} jobs`,
          error: 'job_status_locked'
        });
      }

      // Extract editable job detail fields from request body
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
        selectedDate,
        selectedTime,
        requiresNSA,
        requiresSpanishSpeaking
      } = req.body;

      // Build update data with only the fields that were provided
      const updateData: any = {};
      
      // Basic job information
      if (titleCompany !== undefined) updateData.titleCompany = titleCompany?.trim();
      if (closingType !== undefined) updateData.closingType = closingType?.trim();
      if (internalReference !== undefined) updateData.internalReference = internalReference?.trim() || null;
      if (kbaRequired !== undefined) updateData.kbaRequired = Boolean(kbaRequired);

      // Property address validation and update
      if (propertyAddressOne !== undefined) {
        if (!propertyAddressOne?.trim()) {
          return res.status(400).json({ 
            message: 'Property address line 1 is required',
            error: 'validation_error',
            field: 'propertyAddressOne'
          });
        }
        updateData.propertyAddressOne = propertyAddressOne.trim();
      }
      
      if (propertyAddressTwo !== undefined) updateData.propertyAddressTwo = propertyAddressTwo?.trim() || null;
      
      if (propertyCity !== undefined) {
        if (!propertyCity?.trim()) {
          return res.status(400).json({ 
            message: 'Property city is required',
            error: 'validation_error',
            field: 'propertyCity'
          });
        }
        updateData.propertyCity = propertyCity.trim();
      }
      
      if (propertyState !== undefined) {
        if (!propertyState?.trim()) {
          return res.status(400).json({ 
            message: 'Property state is required',
            error: 'validation_error',
            field: 'propertyState'
          });
        }
        updateData.propertyState = propertyState.trim();
      }
      
      if (propertyZipCode !== undefined) {
        if (!propertyZipCode?.trim()) {
          return res.status(400).json({ 
            message: 'Property zip code is required',
            error: 'validation_error',
            field: 'propertyZipCode'
          });
        }
        // Basic zip code validation (5 digits or 5+4 format)
        const zipPattern = /^\d{5}(-\d{4})?$/;
        if (!zipPattern.test(propertyZipCode.trim())) {
          return res.status(400).json({ 
            message: 'Invalid zip code format. Use 12345 or 12345-6789 format.',
            error: 'validation_error',
            field: 'propertyZipCode'
          });
        }
        updateData.propertyZipCode = propertyZipCode.trim();
      }

      // Schedule updates
      if (selectedDate !== undefined) updateData.selectedDate = selectedDate?.trim() || null;
      if (selectedTime !== undefined) updateData.selectedTime = selectedTime?.trim() || null;

      // Notary requirements
      if (requiresNSA !== undefined) updateData.requiresNSA = Boolean(requiresNSA);
      if (requiresSpanishSpeaking !== undefined) updateData.requiresSpanishSpeaking = Boolean(requiresSpanishSpeaking);

      // Validate required fields if they're being updated
      if (updateData.titleCompany !== undefined && !updateData.titleCompany) {
        return res.status(400).json({ 
          message: 'Title company is required',
          error: 'validation_error',
          field: 'titleCompany'
        });
      }

      if (updateData.closingType !== undefined && !updateData.closingType) {
        return res.status(400).json({ 
          message: 'Closing type is required',
          error: 'validation_error',
          field: 'closingType'
        });
      }

      // Check if there are any fields to update
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ 
          message: 'No valid fields provided for update',
          error: 'no_update_fields'
        });
      }

      // Update the job
      const updatedJob = await storage.updateJob(jobId, updateData);
      
      if (!updatedJob) {
        return res.status(500).json({ 
          message: 'Failed to update job details',
          error: 'update_failed'
        });
      }

      // Log the update for audit purposes
      console.log(`✅ Job ${jobId} details updated by user ${req.user.id}:`, {
        updatedFields: Object.keys(updateData),
        userId: req.user.id,
        userRole: req.user.role
      });

      res.json({
        success: true,
        message: 'Job details updated successfully',
        job: updatedJob,
        updatedFields: Object.keys(updateData)
      });

    } catch (error) {
      console.error('Update job details error:', error);
      res.status(500).json({ 
        message: 'Internal server error',
        error: 'internal_error'
      });
    }
  });

  // Add new signer to job
  app.post('/api/jobs/:id/signers', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      
      if (isNaN(jobId) || jobId <= 0) {
        return res.status(400).json({ 
          message: 'Invalid job ID provided',
          error: 'invalid_job_id'
        });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check permissions - admin, job creator, or assigned notary can add signers
      const canEdit = req.user.role === 'admin' || 
                      job.userId === req.user.id || 
                      job.selectedNotary === req.user.id.toString() ||
                      job.notaryId === req.user.id;

      if (!canEdit) {
        return res.status(403).json({ 
          message: 'Access denied. You do not have permission to add signers to this job.' 
        });
      }

      // Prevent adding signers to completed or cancelled jobs
      if (job.jobStatus === 'completed' || job.jobStatus === 'cancelled') {
        return res.status(400).json({ 
          message: `Cannot add signers to ${job.jobStatus} jobs`,
          error: 'job_status_locked'
        });
      }

      // Extract signer data from request body
      const {
        signerName,
        signerEmail,
        signerPhoneNumber,
        signerRole
      } = req.body;

      // Validate required fields
      if (!signerName?.trim()) {
        return res.status(400).json({ 
          message: 'Signer name is required',
          error: 'validation_error',
          field: 'signerName'
        });
      }

      if (!signerEmail?.trim()) {
        return res.status(400).json({ 
          message: 'Signer email is required',
          error: 'validation_error',
          field: 'signerEmail'
        });
      }

      // Email validation
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(signerEmail.trim())) {
        return res.status(400).json({ 
          message: 'Invalid email format',
          error: 'validation_error',
          field: 'signerEmail'
        });
      }

      if (!signerPhoneNumber?.trim()) {
        return res.status(400).json({ 
          message: 'Signer phone number is required',
          error: 'validation_error',
          field: 'signerPhoneNumber'
        });
      }

      if (!signerRole?.trim()) {
        return res.status(400).json({ 
          message: 'Signer role is required',
          error: 'validation_error',
          field: 'signerRole'
        });
      }

      // Validate signer role
      const validRoles = ['buyer', 'seller', 'borrower', 'co-borrower', 'witness'];
      if (!validRoles.includes(signerRole.toLowerCase())) {
        return res.status(400).json({ 
          message: `Invalid signer role. Must be one of: ${validRoles.join(', ')}`,
          error: 'validation_error',
          field: 'signerRole'
        });
      }

      // Check for duplicate email in this job
      const existingSigners = await db
        .select()
        .from(signers)
        .where(eq(signers.jobId, jobId));

      const emailExists = existingSigners.some(s => 
        s.signerEmail.toLowerCase() === signerEmail.trim().toLowerCase()
      );

      if (emailExists) {
        return res.status(400).json({ 
          message: 'A signer with this email already exists in this job',
          error: 'duplicate_email'
        });
      }

      // Check if user exists in system by email
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, signerEmail.trim().toLowerCase()))
        .limit(1);

      // Generate invitation token
      const invitationToken = crypto.randomUUID();

      // Create new signer
      const [newSigner] = await db
        .insert(signers)
        .values({
          jobId,
          userId: existingUser?.id || null,
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim().toLowerCase(),
          signerPhoneNumber: signerPhoneNumber.trim(),
          signerRole: signerRole.toLowerCase(),
          invitationToken,
          invitationSentAt: new Date(),
          accessType: 'registered',
          guestVerificationStatus: 'pending',
          signingStatus: 'pending'
        })
        .returning();

      if (!newSigner) {
        return res.status(500).json({ 
          message: 'Failed to create signer',
          error: 'create_failed'
        });
      }

      // Send invitation email
      try {
        await emailService.sendSignerInvitation({
          signerName: newSigner.signerName,
          signerEmail: newSigner.signerEmail,
          signerRole: newSigner.signerRole,
          invitationToken,
          titleCompany: job.titleCompany,
          closingType: job.closingType,
          propertyAddress: `${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState} ${job.propertyZipCode}`,
          scheduledDate: job.selectedDate,
          scheduledTime: job.selectedTime
        });

        console.log(`✅ Invitation email sent to ${newSigner.signerEmail} for job ${jobId}`);
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
        // Don't fail the request if email fails, but log it
      }

      // Log the addition for audit purposes
      console.log(`✅ New signer added to job ${jobId} by user ${req.user.id}:`, {
        signerId: newSigner.id,
        signerEmail: newSigner.signerEmail,
        signerRole: newSigner.signerRole,
        userId: req.user.id,
        userRole: req.user.role
      });

      res.status(201).json({
        success: true,
        message: 'Signer added successfully',
        signer: {
          id: newSigner.id,
          signerName: newSigner.signerName,
          signerEmail: newSigner.signerEmail,
          signerPhoneNumber: newSigner.signerPhoneNumber,
          signerRole: newSigner.signerRole,
          invitationToken: newSigner.invitationToken,
          invitationSentAt: newSigner.invitationSentAt,
          signingStatus: newSigner.signingStatus,
          isExistingUser: !!existingUser
        }
      });

    } catch (error) {
      console.error('Add signer error:', error);
      res.status(500).json({ 
        message: 'Internal server error',
        error: 'internal_error'
      });
    }
  });

  // Update existing signer
  app.put('/api/jobs/:id/signers/:signerId', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const signerId = parseInt(req.params.signerId);
      
      if (isNaN(jobId) || jobId <= 0 || isNaN(signerId) || signerId <= 0) {
        return res.status(400).json({ 
          message: 'Invalid job ID or signer ID provided',
          error: 'invalid_ids'
        });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check permissions
      const canEdit = req.user.role === 'admin' || 
                      job.userId === req.user.id || 
                      job.selectedNotary === req.user.id.toString() ||
                      job.notaryId === req.user.id;

      if (!canEdit) {
        return res.status(403).json({ 
          message: 'Access denied. You do not have permission to edit signers in this job.' 
        });
      }

      // Prevent editing signers in completed or cancelled jobs
      if (job.jobStatus === 'completed' || job.jobStatus === 'cancelled') {
        return res.status(400).json({ 
          message: `Cannot edit signers in ${job.jobStatus} jobs`,
          error: 'job_status_locked'
        });
      }

      // Get existing signer
      const [existingSigner] = await db
        .select()
        .from(signers)
        .where(eq(signers.id, signerId))
        .limit(1);

      if (!existingSigner || existingSigner.jobId !== jobId) {
        return res.status(404).json({ message: 'Signer not found in this job' });
      }

      // Extract updateable fields
      const {
        signerName,
        signerEmail,
        signerPhoneNumber,
        signerRole
      } = req.body;

      const updateData: any = {};
      let shouldResendInvitation = false;

      // Validate and update fields
      if (signerName !== undefined) {
        if (!signerName?.trim()) {
          return res.status(400).json({ 
            message: 'Signer name cannot be empty',
            error: 'validation_error',
            field: 'signerName'
          });
        }
        updateData.signerName = signerName.trim();
      }

      if (signerEmail !== undefined) {
        if (!signerEmail?.trim()) {
          return res.status(400).json({ 
            message: 'Signer email cannot be empty',
            error: 'validation_error',
            field: 'signerEmail'
          });
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(signerEmail.trim())) {
          return res.status(400).json({ 
            message: 'Invalid email format',
            error: 'validation_error',
            field: 'signerEmail'
          });
        }

        const newEmail = signerEmail.trim().toLowerCase();
        if (newEmail !== existingSigner.signerEmail) {
          // Check for duplicate email in this job (excluding current signer)
          const duplicateCheck = await db
            .select()
            .from(signers)
            .where(eq(signers.jobId, jobId));

          const emailExists = duplicateCheck.some(s => 
            s.id !== signerId && s.signerEmail.toLowerCase() === newEmail
          );

          if (emailExists) {
            return res.status(400).json({ 
              message: 'A signer with this email already exists in this job',
              error: 'duplicate_email'
            });
          }

          updateData.signerEmail = newEmail;
          shouldResendInvitation = true;
        }
      }

      if (signerPhoneNumber !== undefined) {
        if (!signerPhoneNumber?.trim()) {
          return res.status(400).json({ 
            message: 'Signer phone number cannot be empty',
            error: 'validation_error',
            field: 'signerPhoneNumber'
          });
        }
        updateData.signerPhoneNumber = signerPhoneNumber.trim();
      }

      if (signerRole !== undefined) {
        if (!signerRole?.trim()) {
          return res.status(400).json({ 
            message: 'Signer role cannot be empty',
            error: 'validation_error',
            field: 'signerRole'
          });
        }

        const validRoles = ['buyer', 'seller', 'borrower', 'co-borrower', 'witness'];
        if (!validRoles.includes(signerRole.toLowerCase())) {
          return res.status(400).json({ 
            message: `Invalid signer role. Must be one of: ${validRoles.join(', ')}`,
            error: 'validation_error',
            field: 'signerRole'
          });
        }
        updateData.signerRole = signerRole.toLowerCase();
      }

      // Check if there are any fields to update
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ 
          message: 'No valid fields provided for update',
          error: 'no_update_fields'
        });
      }

      // Update the signer
      const [updatedSigner] = await db
        .update(signers)
        .set(updateData)
        .where(eq(signers.id, signerId))
        .returning();

      if (!updatedSigner) {
        return res.status(500).json({ 
          message: 'Failed to update signer',
          error: 'update_failed'
        });
      }

      // Resend invitation if email changed
      if (shouldResendInvitation && updatedSigner.invitationToken) {
        try {
          await emailService.sendSignerInvitation({
            signerName: updatedSigner.signerName,
            signerEmail: updatedSigner.signerEmail,
            signerRole: updatedSigner.signerRole,
            invitationToken: updatedSigner.invitationToken,
            titleCompany: job.titleCompany,
            closingType: job.closingType,
            propertyAddress: `${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState} ${job.propertyZipCode}`,
            scheduledDate: job.selectedDate,
            scheduledTime: job.selectedTime
          });

          // Update invitation sent timestamp
          await db
            .update(signers)
            .set({ invitationSentAt: new Date() })
            .where(eq(signers.id, signerId));

          console.log(`✅ New invitation email sent to ${updatedSigner.signerEmail} for job ${jobId}`);
        } catch (emailError) {
          console.error('Failed to send updated invitation email:', emailError);
        }
      }

      // Log the update for audit purposes
      console.log(`✅ Signer ${signerId} updated in job ${jobId} by user ${req.user.id}:`, {
        updatedFields: Object.keys(updateData),
        emailChanged: shouldResendInvitation,
        userId: req.user.id,
        userRole: req.user.role
      });

      res.json({
        success: true,
        message: 'Signer updated successfully',
        signer: updatedSigner,
        updatedFields: Object.keys(updateData),
        invitationResent: shouldResendInvitation
      });

    } catch (error) {
      console.error('Update signer error:', error);
      res.status(500).json({ 
        message: 'Internal server error',
        error: 'internal_error'
      });
    }
  });

  // Delete signer from job
  app.delete('/api/jobs/:id/signers/:signerId', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const signerId = parseInt(req.params.signerId);
      
      if (isNaN(jobId) || jobId <= 0 || isNaN(signerId) || signerId <= 0) {
        return res.status(400).json({ 
          message: 'Invalid job ID or signer ID provided',
          error: 'invalid_ids'
        });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check permissions
      const canEdit = req.user.role === 'admin' || 
                      job.userId === req.user.id || 
                      job.selectedNotary === req.user.id.toString() ||
                      job.notaryId === req.user.id;

      if (!canEdit) {
        return res.status(403).json({ 
          message: 'Access denied. You do not have permission to remove signers from this job.' 
        });
      }

      // Prevent removing signers from completed or cancelled jobs
      if (job.jobStatus === 'completed' || job.jobStatus === 'cancelled') {
        return res.status(400).json({ 
          message: `Cannot remove signers from ${job.jobStatus} jobs`,
          error: 'job_status_locked'
        });
      }

      // Get existing signer
      const [existingSigner] = await db
        .select()
        .from(signers)
        .where(eq(signers.id, signerId))
        .limit(1);

      if (!existingSigner || existingSigner.jobId !== jobId) {
        return res.status(404).json({ message: 'Signer not found in this job' });
      }

      // Check if signer has already signed (prevent deletion of completed signers)
      if (existingSigner.signingStatus === 'completed') {
        return res.status(400).json({ 
          message: 'Cannot remove signer who has already completed signing',
          error: 'signer_already_signed'
        });
      }

      // Delete the signer
      const deleteResult = await db
        .delete(signers)
        .where(eq(signers.id, signerId));

      if (deleteResult.rowCount === 0) {
        return res.status(500).json({ 
          message: 'Failed to remove signer',
          error: 'delete_failed'
        });
      }

      // Log the deletion for audit purposes
      console.log(`✅ Signer ${signerId} removed from job ${jobId} by user ${req.user.id}:`, {
        signerName: existingSigner.signerName,
        signerEmail: existingSigner.signerEmail,
        userId: req.user.id,
        userRole: req.user.role
      });

      res.json({
        success: true,
        message: 'Signer removed successfully',
        removedSigner: {
          id: existingSigner.id,
          signerName: existingSigner.signerName,
          signerEmail: existingSigner.signerEmail
        }
      });

    } catch (error) {
      console.error('Delete signer error:', error);
      res.status(500).json({ 
        message: 'Internal server error',
        error: 'internal_error'
      });
    }
  });

} 