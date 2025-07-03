import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { registerCompanyRoutes } from "./company-routes";
import { registerUserManagementRoutes } from "./user-management-routes";
import { registerNotaryProfileRoutes } from "./notary-profile-routes";
import { registerApprovalWorkflowRoutes } from "./approval-workflow-routes";
import { registerFeeRoutes } from "./fee-routes";
import { notificationService } from "./notification-service";
import { verifyToken } from "./auth";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { randomNotaryService, NotaryQualifications, TimeSlotRequest } from "./random-notary-service";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import nodemailer from "nodemailer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { 
  insertUserSchema, 
  insertTitleCompanySchema,
  insertCompanySchema, 
  insertJobSchema, 
  insertSignerSchema,
  insertPaymentSchema,
  insertInvoiceSchema,
  insertClosingTypeSchema,
  insertNotaryStampSchema,
  type Payment,
  type Invoice,
  type Job,
  type User,
  type NotaryStamp,
  type Company,
  // Calendar tables
  notaryTimeSlots,
  calendarEvents,
  notaryWorkingHours,
  notaryAvailability,
  users,
  jobs,
  signers,
  jobParticipants,
  jobDocuments,
  notaryStamps,
  payments,
  paymentSchedules,
  closingTypes,
  systemSettings,
  notaryAssignmentLog,
  titleCompanies,
  companies,
  insertJobParticipantSchema,
  insertJobDocumentSchema,
  insertPaymentScheduleSchema,
  insertSystemSettingSchema,
  insertNotaryAssignmentLogSchema,
  passwordResetTokens,
} from "@shared/schema";

// Import enhanced upload handlers
import { 
  signatureUpload, 
  documentUpload, 
  stampUpload,
  handleSignatureUpload,
  handleDocumentUpload,
  handleNotaryStampUpload,
  getUploadedFile
} from "./enhanced-upload";

import passport from 'passport';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { z } from 'zod';
import { DrizzleError } from 'drizzle-orm';
import fetch from 'node-fetch';
// Note: verifyToken is defined below instead of importing

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Professional multer configuration optimized for Vultr cloud storage
const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage for direct cloud uploads
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for cloud storage
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain',
      'video/mp4',
      'video/webm',
      'video/mov',
      'audio/wav',
      'audio/mp3'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload PDF, DOC, DOCX, images, videos, or audio files only.'));
    }
  }
});

// Import the professional email service
import { emailService } from './lib/email-service';

// Import email template routes
import {
  getAllTemplates,
  getTemplate,
  getTemplateVariables,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
  sendTestEmail,
  getEmailLogs,
  getTemplateCategories
} from './email-template-routes';

export async function registerRoutes(app: Express): Promise<Server> {

  // Authentication routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          privileges: user.privileges
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });

      res.status(201).json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/auth/me', verifyToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        privileges: user.privileges
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/logout', verifyToken, async (req: any, res) => {
    try {
      // In a real application, you might want to:
      // 1. Add the token to a blacklist
      // 2. Update user's last logout time
      // 3. Log the logout event for audit purposes
      
      // For now, we'll just return success
      // The client will handle clearing localStorage
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // User management routes
  app.get('/api/users', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/users/notaries', verifyToken, async (req: any, res) => {
    try {
      const notaries = await storage.getNotaryUsers();
      res.json(notaries.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email
      })));
    } catch (error) {
      console.error('Get notaries error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get users that can be signers (for job creation)
  app.get('/api/users/signers', verifyToken, async (req: any, res) => {
    try {
      // Check if user has permission to access this endpoint
      const userCanCreateJob = 
        req.user.role === 'admin' ||
        req.user.role === 'title_company' ||
        (req.user.role === 'notary' && req.user.notaryType === 'subscriber');

      if (!userCanCreateJob) {
        return res.status(403).json({ 
          message: 'Access denied. Only administrators, title companies, and subscriber notaries can access signers.' 
        });
      }

      // Get users who can be signers (clients, customers, and other non-notary users)
      const signerUsers = await db
        .select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          phoneNumber: users.phoneNumber,
          role: users.role,
          isActive: users.isActive
        })
        .from(users)
        .where(
          and(
            eq(users.isActive, true),
            // Include clients, customers, and title company users, but exclude admins and notaries
            inArray(users.role, ['client', 'customer', 'title_company'])
          )
        )
        .orderBy(users.firstName, users.lastName, users.username);

      res.json(signerUsers);
    } catch (error) {
      console.error('Get signer users error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/users/:id', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const userId = parseInt(req.params.id);
      const updateData = req.body;

      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }

      const user = await storage.updateUser(userId, updateData);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        privileges: user.privileges
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/users/:id', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const userId = parseInt(req.params.id);
      const deleted = await storage.deleteUser(userId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get user signatures endpoint
  app.get('/api/users/:id/signatures', verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if user can access these signatures
      if (req.user.role !== 'admin' && req.user.id !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // In a real app, this would query from database
      // For now, we'll return empty array since signatures are stored in localStorage on frontend
      // The dashboard component manages signatures locally
      const signatures: any[] = [];
      
      res.json(signatures);
    } catch (error) {
      console.error('Get user signatures error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get user profile with notary details
  app.get('/api/users/:id/profile', verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if user can access this profile
      if (req.user.role !== 'admin' && req.user.id !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Return user profile with notary-specific fields
      const profile = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        fullName: user.fullName || '',
        role: user.role,
        title: user.title || 'Notary Public',
        commissionNumber: user.commissionNumber || '',
        commissionExpiration: user.commissionExpiration || '',
        state: user.state || '',
        county: user.county || '',
        disclosure: user.disclosure || 'I acknowledge that this document was signed before me on this date.',
        signatureData: user.signatureData || '',
        initialData: user.initialData || '',
        phoneNumber: user.phoneNumber || '',
        address: user.address || '',
        isActive: user.isActive,
        isNotarySigningAgent: user.isNotarySigningAgent,
        isSpanishSpeaking: user.isSpanishSpeaking,
        notaryType: user.notaryType,
      };

      res.json(profile);
    } catch (error) {
      console.error('Get user profile error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update user profile with notary details
  app.put('/api/users/:id/profile', verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if user can update this profile
      if (req.user.role !== 'admin' && req.user.id !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const profileData = req.body;
      
      // Update user with new profile data
      const updateData: any = {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        title: profileData.title,
        commissionNumber: profileData.commissionNumber,
        commissionExpiration: profileData.commissionExpiration,
        state: profileData.state,
        county: profileData.county,
        disclosure: profileData.disclosure,
        phoneNumber: profileData.phoneNumber,
        address: profileData.address,
        isActive: profileData.isActive,
        isNotarySigningAgent: profileData.isNotarySigningAgent,
        isSpanishSpeaking: profileData.isSpanishSpeaking,
        notaryType: profileData.notaryType,
      };

      // Auto-generate fullName from firstName and lastName if provided
      if (profileData.firstName || profileData.lastName) {
        const fullName = [profileData.firstName, profileData.lastName].filter(Boolean).join(' ').trim();
        if (fullName) {
          updateData.fullName = fullName;
        }
      }

      const updatedUser = await storage.updateUser(userId, updateData);

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('Update user profile error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get notary stamps endpoint
  app.get('/api/notary/:id/stamps', verifyToken, async (req: any, res) => {
    try {
      const notaryId = parseInt(req.params.id);
      
      // Check if user can access these stamps
      if (req.user.role !== 'admin' && req.user.id !== notaryId && req.user.role !== 'notary') {
        return res.status(403).json({ message: 'Access denied' });
      }

      // For now, return mock notary stamp data - in production this would come from database
      const stamps = [
        {
          id: 1,
          notaryId: notaryId,
          notaryName: 'John Doe',
          commissionNumber: 'NC123456',
          state: 'North Carolina',
          expirationDate: '2025-12-31',
          stampImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          createdAt: new Date().toISOString()
        }
      ];
      
      res.json(stamps);
    } catch (error) {
      console.error('Get notary stamps error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Title company routes - Updated to use enhanced companies table
  app.get('/api/companies', verifyToken, async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      console.error('Get companies error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/companies', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const companyData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(companyData);
      res.status(201).json(company);
    } catch (error) {
      console.error('Create company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/companies/:id', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const companyId = parseInt(req.params.id);
      const updateData = req.body;

      const company = await storage.updateCompany(companyId, updateData);
      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }

      res.json(company);
    } catch (error) {
      console.error('Update company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/companies/:id', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const companyId = parseInt(req.params.id);
      const deleted = await storage.deleteCompany(companyId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Company not found' });
      }

      res.json({ message: 'Company deleted successfully' });
    } catch (error) {
      console.error('Delete company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Job routes
  app.get('/api/jobs', verifyToken, async (req: any, res) => {
    try {
      const jobs = await storage.getRoleBasedJobs(req.user.id, req.user.role);
      res.json(jobs);
    } catch (error) {
      console.error('Get jobs error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/jobs/:id', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const signers = await storage.getSignersByJobId(jobId);
      
      // Map database fields to frontend expected format
      const jobResponse = {
        ...job,
        uploadedFile: job.uploadedFile,
        notarizedFile: job.notarizedFile,
        signers
      };
      
      res.json(jobResponse);
    } catch (error) {
      console.error('Get job error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/jobs', verifyToken, upload.array('documents', 10), async (req: any, res) => {
    try {
      // Check if user has permission to create jobs
      const userCanCreateJob = 
        req.user.role === 'admin' ||
        req.user.role === 'title_company' ||
        (req.user.role === 'notary' && req.user.notaryType === 'subscriber');

      if (!userCanCreateJob) {
        return res.status(403).json({ 
          message: 'Access denied. Only administrators, title companies, and subscriber notaries can create jobs.' 
        });
      }

      const jobData = {
        ...req.body,
        userId: req.user.id,
        kbaRequired: req.body.kbaRequired === 'true'
      };

      // Remove the old single file fields from job data
      delete jobData.uploadedFile;
      delete jobData.notarizedFile;

      const job = await storage.createJob(jobData);

      // Handle notary assignment logic based on the business requirements
      let assignedNotary = null;
      if (jobData.notaryOption === 'auto' && !jobData.selectedNotary) {
        // Check if title company has a preferred notary
        const titleCompany = await db
          .select()
          .from(companies)
          .where(eq(companies.companyName, jobData.titleCompany))
          .limit(1);

        if (titleCompany.length > 0 && titleCompany[0].preferredNotaryId) {
          // Use preferred notary if available and active
          const preferredNotary = await db
            .select()
            .from(users)
            .where(
              and(
                eq(users.id, titleCompany[0].preferredNotaryId),
                eq(users.isActive, true),
                eq(users.role, 'notary')
              )
            )
            .limit(1);

          if (preferredNotary.length > 0) {
            assignedNotary = preferredNotary[0];
            await storage.updateJob(job.id, {
              notaryId: assignedNotary.id,
              selectedNotary: assignedNotary.id.toString(),
              jobStatus: 'open', // Keep as open until notary approves
              notaryApprovalStatus: 'assigned_pending_approval'
            });

            // Log the preferred assignment
            await db.insert(notaryAssignmentLog).values({
              jobId: job.id,
              notaryId: assignedNotary.id,
              assignmentType: 'preferred',
              assignmentStatus: 'assigned'
            });

            // Send job assignment notification to notary (requires approval)
            try {
              await notificationService.sendJobAssignmentNotification(job.id, assignedNotary.id);
            } catch (notificationError) {
              console.error('Failed to send job assignment notification:', notificationError);
            }

            // Create calendar event for the assigned notary if date and time are provided
            if (jobData.selectedDate && jobData.selectedTime) {
              try {
                const startDateTime = new Date(`${jobData.selectedDate} ${jobData.selectedTime}`);
                const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration
                
                await db.insert(calendarEvents).values({
                  notaryId: assignedNotary.id,
                  title: `Notarization Job #${job.id}`,
                  description: `Job for ${jobData.titleCompany} - ${jobData.closingType}\nProperty: ${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState}`,
                  startDateTime,
                  endDateTime,
                  location: `${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState} ${jobData.propertyZipCode}`,
                  eventType: 'job',
                  jobId: job.id,
                  isAllDay: false
                });
              } catch (error) {
                console.warn('Failed to create calendar event for preferred notary assignment:', error);
              }
            }
          }
        }

        // If no preferred notary or preferred notary not available, use random assignment
        if (!assignedNotary) {
          // Update job to mark it for random assignment (will be completed when time is selected)
          await storage.updateJob(job.id, {
            isRandomAssignment: true,
            requiresNSA: jobData.requiresNSA === 'true' || false,
            requiresSpanishSpeaking: jobData.requiresSpanishSpeaking === 'true' || false
          });
        }
      } else if (jobData.notaryOption === 'assign' && jobData.selectedNotary) {
        // Manual assignment
        const selectedNotaryId = parseInt(jobData.selectedNotary);
        await storage.updateJob(job.id, {
          notaryId: selectedNotaryId,
          jobStatus: 'open', // Keep as open until notary approves
          notaryApprovalStatus: 'assigned_pending_approval'
        });

        // Log the manual assignment
        await db.insert(notaryAssignmentLog).values({
          jobId: job.id,
          notaryId: selectedNotaryId,
          assignmentType: 'manual',
          assignmentStatus: 'assigned'
        });

        // Send job assignment notification to notary (requires approval)
        try {
          await notificationService.sendJobAssignmentNotification(job.id, selectedNotaryId);
        } catch (notificationError) {
          console.error('Failed to send job assignment notification:', notificationError);
        }

        // Create calendar event for the assigned notary if date and time are provided
        if (jobData.selectedDate && jobData.selectedTime) {
          try {
            const startDateTime = new Date(`${jobData.selectedDate} ${jobData.selectedTime}`);
            const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration
            
            await db.insert(calendarEvents).values({
              notaryId: selectedNotaryId,
              title: `Notarization Job #${job.id}`,
              description: `Job for ${jobData.titleCompany} - ${jobData.closingType}\nProperty: ${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState}`,
              startDateTime,
              endDateTime,
              location: `${jobData.propertyAddressOne}, ${jobData.propertyCity}, ${jobData.propertyState} ${jobData.propertyZipCode}`,
              eventType: 'job',
              jobId: job.id,
              isAllDay: false
            });
          } catch (error) {
            console.warn('Failed to create calendar event for manual notary assignment:', error);
          }
        }
      }

      // Handle multiple document uploads to Vultr with intelligent organization
      if (req.files && req.files.length > 0) {
        const { VultrUploadHandler } = await import('./vultr-upload-handler');
        
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const metadataKey = `documentMetadata_${i}`;
          let metadata = { isRequired: false, documentType: 'original', originalName: file.originalname };
          
          if (req.body[metadataKey]) {
            try {
              metadata = { ...metadata, ...JSON.parse(req.body[metadataKey]) };
            } catch (e) {
              console.warn('Failed to parse document metadata:', e);
            }
          }

          // Upload to Vultr with intelligent organization
          const fileBuffer = Buffer.from(file.buffer || await fs.promises.readFile(file.path));
          
          const uploadResult = await VultrUploadHandler.handleJobDocumentUpload(
            fileBuffer,
            file.originalname,
            job.id,
            req.user.id,
            {
              ...metadata,
              userRole: req.user.role,
              titleCompany: jobData.titleCompany
            }
          );

          if (!uploadResult.success) {
            console.error(`Failed to upload document to Vultr: ${uploadResult.error}`);
            return res.status(500).json({ 
              message: `Failed to upload document: ${uploadResult.error}`,
              error: 'vultr_upload_failed'
            });
          }
          // If successful, the document record was already created by VultrUploadHandler
        }
      }

      // Create signers if provided
      if (req.body.signers) {
        const signers = JSON.parse(req.body.signers);
        for (const signerData of signers) {
          // Check if user already exists
          const [existingUser] = await db.select()
            .from(users)
            .where(eq(users.email, signerData.signerEmail));

          let userId;
          if (!existingUser) {
            // Create new user account for the signer
            const hashedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
            const [newUser] = await db.insert(users).values({
              username: signerData.signerEmail,
              email: signerData.signerEmail,
              password: hashedPassword, // Temporary password, will be reset
              role: 'signer',
              firstName: signerData.signerName.split(' ')[0] || '',
              lastName: signerData.signerName.split(' ').slice(1).join(' ') || '',
              phoneNumber: signerData.signerPhoneNumber || '',
              isVerified: false, // Account not verified yet
              verificationStatus: 'pending', // Pending verification
              accountSetupComplete: false, // Password needs to be set
              createdAt: new Date()
            }).returning();
            userId = newUser.id;
          } else {
            userId = existingUser.id;
          }

          // Create signer record linked to user
          await storage.createSigner({
            ...signerData,
            jobId: job.id,
            userId: userId,
            invitationToken: crypto.randomUUID()
          });

          // Generate password reset token for account setup
          const passwordResetToken = crypto.randomUUID();
          const tokenExpiry = new Date();
          tokenExpiry.setHours(tokenExpiry.getHours() + 24); // 24 hour expiry

          // Store password reset token
          await db.insert(passwordResetTokens).values({
            userId: userId,
            token: passwordResetToken,
            expiresAt: tokenExpiry,
            used: false
          });

          // NOTE: Signer notifications will be sent after notary approval
          // Account setup emails are deferred until notary approves the job
          console.log(`Signer account created for ${signerData.signerEmail} - notifications will be sent after notary approval`);
        }
      }

      // Return job with document count
      const documentCount = req.files ? req.files.length : 0;
      res.status(201).json({
        ...job,
        documentCount,
        message: `Job created successfully with ${documentCount} document${documentCount !== 1 ? 's' : ''}`
      });
    } catch (error) {
      console.error('Create job error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/jobs/:id/status', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const { status } = req.body;

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to update this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updatedJob = await storage.updateJob(jobId, { jobStatus: status });
      res.json(updatedJob);
    } catch (error) {
      console.error('Update job status error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete individual job endpoint
  app.delete('/api/jobs/:id', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to delete this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied. Only job creator or admin can delete jobs.' });
      }

      // Get all documents associated with this job for cleanup
      const documents = await storage.getJobDocumentsByJobId(jobId);
      
      // Delete all associated files (both local and Vultr)
      for (const document of documents) {
        try {
          const filePath = document.filePath;
          const isVultrFile = !filePath.startsWith('/') && !filePath.includes('\\') && !filePath.includes('uploads/');
          
          if (isVultrFile) {
            // Delete from Vultr cloud storage
            const { cloudStorage } = await import('./lib/cloud-storage-service');
            try {
              const fileExists = await cloudStorage.fileExists(filePath);
              if (fileExists) {
                await cloudStorage.deleteFile(filePath);
                console.log(`✅ Deleted file from Vultr: ${filePath}`);
              }
            } catch (vultrError) {
              console.error(`❌ Failed to delete file from Vultr: ${filePath}`, vultrError);
            }
          } else {
            // Delete local file if it exists
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`✅ Deleted local file: ${filePath}`);
            }
          }
        } catch (fileError) {
          console.error(`Error deleting file for document ${document.id}:`, fileError);
          // Continue with job deletion even if file cleanup fails
        }
      }

      // Delete job from database (cascade will handle related records)
      const deleted = await storage.deleteJob(jobId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Job not found' });
      }

      res.json({ message: 'Job and associated files deleted successfully' });
    } catch (error) {
      console.error('Delete job error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/jobs/:id/file', verifyToken, upload.single('notarizedFile'), async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const { status } = req.body;

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to update this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updateData: any = {};
      
      if (req.file) {
        // Upload notarized file to Vultr
        const { VultrUploadHandler } = await import('./vultr-upload-handler');
        
        const fileBuffer = req.file.buffer ? Buffer.from(req.file.buffer) : await fs.promises.readFile(req.file.path);
        
        const uploadResult = await VultrUploadHandler.handleJobDocumentUpload(
          fileBuffer,
          req.file.originalname,
          jobId,
          req.user.id,
          {
            documentType: 'notarized',
            userRole: req.user.role,
            jobId: jobId
          }
        );

        if (!uploadResult.success) {
          return res.status(500).json({ 
            message: `Failed to upload notarized file: ${uploadResult.error}`,
            error: 'vultr_upload_failed'
          });
        }
        
        updateData.notarizedFile = uploadResult.fileKey;
        console.log(`✅ Uploaded notarized file to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`);
      }
      
      if (status) {
        updateData.jobStatus = status;
      }

      const updatedJob = await storage.updateJob(jobId, updateData);
      res.json(updatedJob);
    } catch (error) {
      console.error('Update job file error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // File download routes
  app.get('/api/jobs/:id/download/:type', async (req: any, res) => {
    try {
      // Handle authentication via header or query parameter (for iframe compatibility)
      let token = req.headers.authorization?.split(' ')[1];
      if (!token && req.query.token) {
        token = req.query.token as string;
      }
      
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      let user;
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        user = decoded;
      } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const jobId = parseInt(req.params.id);
      const fileType = req.params.type; // 'original' or 'notarized'

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to this job
      if (user.role !== 'admin' && job.userId !== user.id && job.selectedNotary !== user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const filePath = fileType === 'original' ? job.uploadedFile : job.notarizedFile;
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found' });
      }

      // Set appropriate headers for inline viewing
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minute cache
      
      res.sendFile(path.resolve(filePath));
    } catch (error) {
      console.error('Download file error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', verifyToken, async (req: any, res) => {
    try {
      const jobs = await storage.getRoleBasedJobs(req.user.id, req.user.role);
      
      const stats: any = {
        totalJobs: jobs.length,
        completedJobs: jobs.filter(job => job.jobStatus === 'completed').length,
        pendingJobs: jobs.filter(job => job.jobStatus === 'pending').length,
        openJobs: jobs.filter(job => job.jobStatus === 'open').length,
        cancelledJobs: jobs.filter(job => job.jobStatus === 'cancelled').length,
        expiredJobs: jobs.filter(job => job.jobStatus === 'expired').length,
      };

      if (req.user.role === 'admin') {
        const notaries = await storage.getNotaryUsers();
        stats.activeNotaries = notaries.length;
      }

      res.json(stats);
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Session access control for live signing
  app.get('/api/jobs/:id/session-access', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const userId = decoded.id;
      const jobId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const hasAccess = await storage.verifySessionAccess(jobId, userId);
      
      if (!hasAccess) {
        return res.status(403).json({ 
          message: 'Access denied. You are not authorized to join this signing session.' 
        });
      }

      const sessionToken = await storage.generateSessionToken(jobId);
      
      res.json({ 
        hasAccess: true, 
        sessionToken,
        message: 'Session access granted'
      });
    } catch (error) {
      console.error('Session access verification error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Document download route
  app.get('/api/jobs/:id/download/:type', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const type = req.params.type;
      
      console.log(`Download request: Job ${jobId}, Type ${type}, User ${req.user?.id}`);
      
      const job = await storage.getJob(jobId);
      if (!job) {
        console.log('Job not found for ID:', jobId);
        return res.status(404).json({ message: 'Job not found' });
      }

      console.log('Job found:', { id: job.id, uploadedFile: job.uploadedFile, userId: job.userId });
      console.log('User info:', { id: req.user.id, role: req.user.role });

      // Always allow download for demo
      const filename = type === 'original' ? 'sample_purchase_agreement.pdf' : 'notarized_purchase_agreement.pdf';
      
      console.log('Returning success for filename:', filename);
      
      res.json({ 
        success: true,
        message: 'File download initiated',
        filename: filename,
        type: type,
        jobId: jobId
      });
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({ message: 'Download failed' });
    }
  });

  // Job participants management
  app.get('/api/jobs/:id/participants', async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const participants = await storage.getJobParticipantsByJobId(jobId);
      res.json(participants);
    } catch (error) {
      console.error('Get job participants error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/jobs/:id/participants', async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const participantData = {
        ...req.body,
        jobId,
        inviteToken: Math.random().toString(36).substring(2) + Date.now().toString(36),
        inviteStatus: 'pending'
      };

      const participant = await storage.createJobParticipant(participantData);
      
      // Send email notification (mock implementation)
      console.log(`Email invitation sent to ${participant.email} for job ${jobId}`);
      
      res.status(201).json(participant);
    } catch (error) {
      console.error('Create job participant error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Payment management routes
  app.get('/api/payments', verifyToken, async (req: any, res) => {
    try {
      let payments: Payment[];
      if (req.user.role === 'admin') {
        // Admin can see all payments - for demo purposes, return empty array
        payments = [];
      } else {
        payments = await storage.getPaymentsByUserId(req.user.id);
      }
      res.json(payments);
    } catch (error) {
      console.error('Get payments error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/payments', verifyToken, async (req: any, res) => {
    try {
      const payment = await storage.createPayment({
        ...req.body,
        payerId: req.user.id
      });
      res.json(payment);
    } catch (error) {
      console.error('Create payment error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/payments/:id', verifyToken, async (req: any, res) => {
    try {
      const paymentId = parseInt(req.params.id);
      const payment = await storage.updatePayment(paymentId, req.body);
      
      if (!payment) {
        return res.status(404).json({ message: 'Payment not found' });
      }
      
      res.json(payment);
    } catch (error) {
      console.error('Update payment error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Invoice management routes
  app.get('/api/invoices', verifyToken, async (req: any, res) => {
    try {
      let invoices: Invoice[];
      if (req.user.role === 'admin') {
        // Admin gets all invoices - for demo purposes, return empty array
        invoices = [];
      } else if (req.user.role === 'notary') {
        invoices = await storage.getInvoicesByNotaryId(req.user.id);
      } else {
        invoices = await storage.getInvoicesByClientId(req.user.id);
      }
      res.json(invoices);
    } catch (error) {
      console.error('Get invoices error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/invoices', verifyToken, async (req: any, res) => {
    try {
      const invoiceNumber = await storage.generateInvoiceNumber();
      const invoice = await storage.createInvoice({
        ...req.body,
        invoiceNumber
      });
      res.json(invoice);
    } catch (error) {
      console.error('Create invoice error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/invoices/:id', verifyToken, async (req: any, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const invoice = await storage.updateInvoice(invoiceId, req.body);
      
      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      
      res.json(invoice);
    } catch (error) {
      console.error('Update invoice error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Closing Types management routes (Admin only)
  app.get('/api/closing-types', verifyToken, async (req: any, res) => {
    try {
      const closingTypes = await storage.getClosingTypes();
      res.json(closingTypes);
    } catch (error) {
      console.error('Get closing types error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/closing-types/active', verifyToken, async (req: any, res) => {
    try {
      const closingTypes = await storage.getActiveClosingTypes();
      res.json(closingTypes);
    } catch (error) {
      console.error('Get active closing types error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/closing-types', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const closingType = await storage.createClosingType(req.body);
      res.json(closingType);
    } catch (error) {
      console.error('Create closing type error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/closing-types/:id', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const closingTypeId = parseInt(req.params.id);
      const closingType = await storage.updateClosingType(closingTypeId, req.body);
      
      if (!closingType) {
        return res.status(404).json({ message: 'Closing type not found' });
      }
      
      res.json(closingType);
    } catch (error) {
      console.error('Update closing type error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/closing-types/:id', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const closingTypeId = parseInt(req.params.id);
      const deleted = await storage.deleteClosingType(closingTypeId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Closing type not found' });
      }
      
      res.json({ message: 'Closing type deleted successfully' });
    } catch (error) {
      console.error('Delete closing type error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Mock video session routes (Whereby API removed)
  app.post('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      console.log('Creating mock video session for job:', jobId);
      
      // Calculate end time (2 hours from now for notary sessions)
      const endDate = new Date();
      endDate.setHours(endDate.getHours() + 2);

      // Create mock session data
      const mockRoomUrl = `https://mock-video.example.com/notary-session-${jobId}-${Date.now()}`;
      const mockSessionData = {
        jobId,
        meetingId: `mock-${jobId}-${Date.now()}`,
        roomUrl: mockRoomUrl,
        roomName: `notary-session-${jobId}`,
        hostRoomUrl: mockRoomUrl,
        endDate: endDate.toISOString(),
        createdBy: req.user.id,
        createdAt: new Date().toISOString(),
        isActive: true,
        participants: req.body.participants || [],
        mockMode: true
      };

      console.log('Mock video session created:', {
        meetingId: mockSessionData.meetingId,
        roomName: mockSessionData.roomName,
        endDate: mockSessionData.endDate
      });
      
      console.log('Sending mock room URL to client:', mockRoomUrl);
      
      res.json({
        success: true,
        roomUrl: mockRoomUrl,
        roomName: mockSessionData.roomName,
        meetingId: mockSessionData.meetingId,
        sessionToken: mockSessionData.roomName,
        sessionData: mockSessionData
      });
    } catch (error) {
      console.error('Create mock video session error:', error);
      res.status(500).json({ 
        message: 'Failed to create mock video session',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // In a real implementation, you would store meeting IDs in your database
      // For now, return a placeholder indicating no active session
      const sessionInfo = {
        jobId,
        isActive: false,
        participants: [],
        recordings: [],
        message: 'No active video session. Create one by starting a live signing session.'
      };

      res.json(sessionInfo);
    } catch (error) {
      console.error('Get video session error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/jobs/:jobId/video-session/recording', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { recordingUrl, duration, participants, meetingId } = req.body;
      
      // Store recording metadata in your database
      // In a real implementation, you would save this to your database
      const recordingData = {
        jobId,
        meetingId,
        recordingUrl,
        duration,
        participants,
        createdAt: new Date().toISOString(),
        createdBy: req.user.id,
        complianceStatus: 'recorded',
        auditTrail: {
          sessionStart: new Date(Date.now() - duration * 1000).toISOString(),
          sessionEnd: new Date().toISOString(),
          participantCount: participants?.length || 0
        }
      };

      console.log('Recording metadata saved:', {
        jobId,
        meetingId,
        duration: `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`,
        participants: participants?.length || 0
      });

      res.json({
        success: true,
        recordingId: `recording-${jobId}-${Date.now()}`,
        message: 'Recording metadata saved successfully',
        complianceVerified: true
      });
    } catch (error) {
      console.error('Save recording error:', error);
      res.status(500).json({ message: 'Failed to save recording metadata' });
    }
  });

  app.delete('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { meetingId } = req.body;
      
      if (meetingId) {
        console.log(`Mock video session ${meetingId} cleanup - no external API calls needed`);
      }
      
      // Update job status to completed if needed
      const job = await storage.getJob(jobId);
      if (job && job.jobStatus === 'in_progress') {
        await storage.updateJob(jobId, {
          jobStatus: 'completed',
          completedAt: new Date(),
          completedBy: req.user.id
        });
      }
      
      console.log(`Mock video session ended for job ${jobId}`);
      
      res.json({
        success: true,
        message: 'Mock video session ended successfully',
        jobStatus: 'completed'
      });
    } catch (error) {
      console.error('End mock video session error:', error);
      res.status(500).json({ message: 'Failed to end mock video session' });
    }
  });

  // Get mock session recordings for compliance
  app.get('/api/jobs/:jobId/recordings', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      console.log(`Getting mock recordings for job ${jobId}`);
      
      // Return mock recordings data
      const mockRecordings = [
        {
          id: `mock-recording-${jobId}`,
          name: `Notary Session ${jobId}`,
          duration: '15:23',
          createdAt: new Date().toISOString(),
          status: 'completed',
          downloadUrl: null, // No actual recordings in mock mode
          type: 'mock'
        }
      ];
      
      res.json({
        success: true,
        jobId,
        recordings: mockRecordings,
        message: 'Mock recordings retrieved (no actual recordings available)'
      });
    } catch (error) {
      console.error('Get mock recordings error:', error);
      res.status(500).json({ message: 'Failed to retrieve mock recordings' });
    }
  });

  // ===== ENHANCED UPLOAD SYSTEM ROUTES (VULTR-ENABLED) =====
  
  // Professional signature upload with Vultr cloud storage
  app.post('/api/uploads/signature', 
    process.env.NODE_ENV === 'development' ? 
      (req: any, res: any, next: any) => {
        console.log('Development mode: bypassing authentication for signature upload');
        req.user = { id: 1, role: 'admin' };
        next();
      } : verifyToken, 
    upload.single('signature'), async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No signature file uploaded' });
        }

        const { sessionId, participantId, signatureType = 'signature' } = req.body;
        
        if (!sessionId || !participantId) {
          return res.status(400).json({ error: 'sessionId and participantId are required' });
        }

        // Upload signature to Vultr
        const { VultrUploadHandler } = await import('./vultr-upload-handler');
        
        const uploadResult = await VultrUploadHandler.handleSignatureUpload(
          req.file.buffer,
          req.file.originalname,
          sessionId,
          parseInt(participantId),
          signatureType
        );

        if (!uploadResult.success) {
          return res.status(500).json({ 
            error: `Failed to upload signature: ${uploadResult.error}`,
            code: 'vultr_upload_failed'
          });
        }

        console.log(`✅ Uploaded signature to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`);

        res.json({
          success: true,
          message: 'Signature uploaded successfully to Vultr',
          fileKey: uploadResult.fileKey,
          fileUrl: uploadResult.signedUrl,
          size: uploadResult.size,
          storageType: 'vultr',
          signatureType
        });
      } catch (error) {
        console.error('Signature upload error:', error);
        res.status(500).json({ error: 'Signature upload failed' });
      }
    });
  
  // Document upload with Vultr cloud storage
  app.post('/api/uploads/document', 
    process.env.NODE_ENV === 'development' ? 
      (req: any, res: any, next: any) => {
        console.log('Development mode: bypassing authentication for document upload');
        req.user = { id: 1, role: 'admin' };
        next();
      } : verifyToken, 
    upload.single('document'), async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No document file uploaded' });
        }

        const { jobId, sessionId, documentType = 'additional' } = req.body;
        
        if (!jobId && !sessionId) {
          return res.status(400).json({ error: 'Either jobId or sessionId is required' });
        }

        // Upload document to Vultr
        const { VultrUploadHandler } = await import('./vultr-upload-handler');
        
        let uploadResult;
        
        if (jobId) {
          // Job-specific document upload
          uploadResult = await VultrUploadHandler.handleJobDocumentUpload(
            req.file.buffer,
            req.file.originalname,
            parseInt(jobId),
            req.user.id,
            {
              documentType,
              userRole: req.user.role,
              uploadType: 'general'
            }
          );
        } else {
          // General document upload for sessions (use signature handler with 'signature' type)
          uploadResult = await VultrUploadHandler.handleSignatureUpload(
            req.file.buffer,
            req.file.originalname,
            sessionId,
            req.user.id,
            'signature'
          );
        }

        if (!uploadResult.success) {
          return res.status(500).json({ 
            error: `Failed to upload document: ${uploadResult.error}`,
            code: 'vultr_upload_failed'
          });
        }

        console.log(`✅ Uploaded document to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`);

        res.json({
          success: true,
          message: 'Document uploaded successfully to Vultr',
          fileKey: uploadResult.fileKey,
          fileUrl: uploadResult.signedUrl,
          size: uploadResult.size,
          storageType: 'vultr',
          documentType
        });
      } catch (error) {
        console.error('Document upload error:', error);
        res.status(500).json({ error: 'Document upload failed' });
      }
    });
  
  // Notary stamp upload with Vultr cloud storage
  app.post('/api/uploads/notary-stamp', 
    process.env.NODE_ENV === 'development' ? 
      (req: any, res: any, next: any) => {
        console.log('Development mode: bypassing authentication for stamp upload');
        req.user = { id: 1, role: 'admin' };
        next();
      } : verifyToken, 
    upload.single('stamp'), async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No stamp image uploaded' });
        }

        const { notaryId, state, commission } = req.body;
        
        if (!notaryId) {
          return res.status(400).json({ error: 'notaryId is required' });
        }

        // Upload notary stamp to Vultr
        const { VultrUploadHandler } = await import('./vultr-upload-handler');
        
        const uploadResult = await VultrUploadHandler.handleNotaryStampUpload(
          req.file.buffer,
          req.file.originalname,
          parseInt(notaryId),
          {
            state,
            commission,
            uploadedBy: req.user.id,
            uploadType: 'notary_stamp'
          }
        );

        if (!uploadResult.success) {
          return res.status(500).json({ 
            error: `Failed to upload notary stamp: ${uploadResult.error}`,
            code: 'vultr_upload_failed'
          });
        }

        // Create notary stamp record in database
        await db.insert(notaryStamps).values({
          notaryId: parseInt(notaryId),
          stampType: 'notary',
          stampData: uploadResult.fileKey!, // Store Vultr key instead of base64 data
          isActive: false // Admin needs to approve
        });

        console.log(`✅ Uploaded notary stamp to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`);

        res.json({
          success: true,
          message: 'Notary stamp uploaded successfully to Vultr',
          fileKey: uploadResult.fileKey,
          fileUrl: uploadResult.signedUrl,
          size: uploadResult.size,
          storageType: 'vultr',
          note: 'Stamp requires admin approval before activation'
        });
      } catch (error) {
        console.error('Notary stamp upload error:', error);
        res.status(500).json({ error: 'Notary stamp upload failed' });
      }
    });
  
  // Secure file retrieval
  app.get('/api/uploads/:type/:fileId', verifyToken, getUploadedFile);

  // Serve uploaded stamp images (with authentication)
  app.get('/uploads/stamps/:notaryId/:filename', 
    // In development, bypass authentication for images
    process.env.NODE_ENV === 'development' ? 
      (req: any, res: any, next: any) => {
        console.log(`Development mode: serving stamp image ${req.params.notaryId}/${req.params.filename}`);
        req.user = { id: 1, role: 'admin' };
        next();
      } : verifyToken, 
    async (req: any, res) => {
    try {
      const { notaryId, filename } = req.params;
      
      // Check if user can access this stamp
      if (req.user.role !== 'admin' && req.user.role !== 'notary' && req.user.id.toString() !== notaryId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const filePath = path.join(process.cwd(), 'uploads', 'stamps', notaryId, filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`Stamp image not found: ${filePath}`);
        return res.status(404).json({ message: 'Stamp image not found' });
      }
      
      // Set appropriate headers
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      
      // Send the file
      res.sendFile(path.resolve(filePath));
    } catch (error) {
      console.error('Serve stamp image error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ===== NOTARY STAMP MANAGEMENT ROUTES =====

  // Set active notary stamp
  app.put('/api/notary/stamps/:stampId/activate', verifyToken, async (req: any, res) => {
    try {
      const stampId = req.params.stampId;
      
      // Check if user is a notary or admin
      if (req.user.role !== 'admin' && req.user.role !== 'notary') {
        return res.status(403).json({ message: 'Access denied - notary access required' });
      }
      
      // In production, this would update the database to set this stamp as active
      // For now, just return success
      res.json({
        success: true,
        message: 'Stamp activated successfully'
      });
    } catch (error) {
      console.error('Activate stamp error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete notary stamp
  app.delete('/api/notary/stamps/:stampId', verifyToken, async (req: any, res) => {
    try {
      const stampId = req.params.stampId;
      
      // Check if user is a notary or admin
      if (req.user.role !== 'admin' && req.user.role !== 'notary') {
        return res.status(403).json({ message: 'Access denied - notary access required' });
      }
      
      // In production, this would delete from database and file system
      // For now, just return success
      res.json({
        success: true,
        message: 'Stamp deleted successfully'
      });
    } catch (error) {
      console.error('Delete stamp error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Recording upload endpoint for enhanced video system  
  app.post('/api/recordings/upload', verifyToken, upload.single('recording'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No recording file provided' });
      }

      const { jobId, recordingType = 'notarization' } = req.body;
      
      if (!jobId) {
        return res.status(400).json({ message: 'Job ID is required' });
      }

      // Upload recording to Vultr
      const { VultrUploadHandler } = await import('./vultr-upload-handler');
      
      const fileBuffer = req.file.buffer ? Buffer.from(req.file.buffer) : await fs.promises.readFile(req.file.path);
      
      const uploadResult = await VultrUploadHandler.handleVideoRecordingUpload(
        fileBuffer,
        req.file.originalname,
        parseInt(jobId),
        {
          recordingType,
          userRole: req.user.role,
          userId: req.user.id,
          timestamp: new Date().toISOString()
        }
      );

      if (!uploadResult.success) {
        return res.status(500).json({ 
          message: `Failed to upload recording: ${uploadResult.error}`,
          error: 'vultr_upload_failed'
        });
      }

      console.log(`✅ Uploaded recording to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`);

      res.json({
        success: true,
        message: 'Recording uploaded successfully to Vultr',
        fileKey: uploadResult.fileKey,
        fileUrl: uploadResult.signedUrl,
        size: uploadResult.size,
        storageType: 'vultr'
      });
    } catch (error) {
      console.error('Recording upload error:', error);
      res.status(500).json({ message: 'Recording upload failed' });
    }
  });

  // Identity verification webhook for Vouched.id
  app.post('/api/verification/webhook', async (req, res) => {
    try {
      // Vouched.id webhook handler
      const { event, data } = req.body;
      
      console.log('Identity verification webhook:', { event, data });
      
      // Process verification results
      if (event === 'verification.completed') {
        // Store verification results in database
        // Update participant verification status
        // Log compliance event
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Verification webhook error:', error);
      res.status(500).json({ message: 'Webhook processing failed' });
    }
  });

  // Compliance reporting endpoint
  app.get('/api/compliance/report/:sessionId', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'notary') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const sessionId = req.params.sessionId;
      
      // Generate compliance report using the framework
      // This would integrate with the compliance framework
      const mockReport = {
        sessionId,
        timestamp: new Date().toISOString(),
        complianceScore: 95,
        checks: [
          { category: 'identity', status: 'passed', description: 'Identity verification completed' },
          { category: 'recording', status: 'passed', description: 'Session recorded with high quality' },
          { category: 'signature', status: 'passed', description: 'Professional signatures captured' },
          { category: 'audit', status: 'passed', description: 'Complete audit trail maintained' }
        ],
        recommendations: [
          'Continue using enhanced identity verification for all signers',
          'Maintain backup recordings for critical sessions'
        ]
      };
      
      res.json(mockReport);
    } catch (error) {
      console.error('Compliance report error:', error);
      res.status(500).json({ message: 'Report generation failed' });
    }
  });

  // Enhanced session status endpoint
  app.get('/api/sessions/:sessionId/status', verifyToken, async (req: any, res) => {
    try {
      const sessionId = req.params.sessionId;
      
      // Mock enhanced session status
      const sessionStatus = {
        sessionId,
        status: 'active',
        participants: [
          { id: '1', name: 'Demo User', role: 'signer', verified: true, connected: true },
          { id: '2', name: 'Notary Public', role: 'notary', verified: true, connected: true }
        ],
        recording: {
          active: true,
          quality: 'FHD',
          duration: 1245, // seconds
          cloudBackup: true
        },
        compliance: {
          identityVerification: 'completed',
          recordingQuality: 'high',
          auditTrail: 'complete',
          overallScore: 98
        },
        lastActivity: new Date().toISOString()
      };
      
      res.json(sessionStatus);
    } catch (error) {
      console.error('Session status error:', error);
      res.status(500).json({ message: 'Session status retrieval failed' });
    }
  });

  // Job document management routes
  app.get('/api/jobs/:id/documents', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const documents = await storage.getJobDocumentsByJobId(jobId);
      res.json(documents);
    } catch (error) {
      console.error('Get job documents error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/jobs/:id/documents', verifyToken, upload.array('documents', 10), async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has access to add documents to this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const addedDocuments = [];

      if (req.files && req.files.length > 0) {
        const { VultrUploadHandler } = await import('./vultr-upload-handler');
        
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const metadataKey = `documentMetadata_${i}`;
          let metadata = { isRequired: false, documentType: 'additional', originalName: file.originalname };
          
          if (req.body[metadataKey]) {
            try {
              metadata = { ...metadata, ...JSON.parse(req.body[metadataKey]) };
            } catch (e) {
              console.warn('Failed to parse document metadata:', e);
            }
          }

          // Upload to Vultr with intelligent organization
          try {
            const fileBuffer = Buffer.from(file.buffer || await fs.promises.readFile(file.path));
            
            const uploadResult = await VultrUploadHandler.handleJobDocumentUpload(
              fileBuffer,
              file.originalname,
              jobId,
              req.user.id,
              {
                ...metadata,
                userRole: req.user.role,
                jobId: jobId
              }
            );

            if (uploadResult.success) {
              // Get the created document from database
              const documents = await storage.getJobDocumentsByJobId(jobId);
              const latestDocument = documents[documents.length - 1]; // Get the most recently added
              addedDocuments.push(latestDocument);
              
              console.log(`✅ Document uploaded to Vultr: ${file.originalname} → ${uploadResult.fileKey}`);
            } else {
              throw new Error(uploadResult.error || 'Upload failed');
            }
            
          } catch (vultrError) {
            console.error(`Vultr upload failed for ${file.originalname}:`, vultrError);
            return res.status(500).json({ 
              message: `Failed to upload document: ${vultrError instanceof Error ? vultrError.message : 'Unknown error'}`,
              error: 'vultr_upload_failed',
              fileName: file.originalname
            });
          }
        }
      }

      res.status(201).json({
        message: `Added ${addedDocuments.length} document${addedDocuments.length !== 1 ? 's' : ''} to job`,
        documents: addedDocuments,
        vultrOrganized: true // Indicate that files are organized in Vultr
      });
    } catch (error) {
      console.error('Add job documents error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/jobs/:jobId/documents/:documentId', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const documentId = parseInt(req.params.documentId);

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      const document = await storage.getJobDocument(documentId);
      if (!document || document.jobId !== jobId) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Check if user has access to delete documents from this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && document.uploadedBy !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Delete the file from both local filesystem and Vultr cloud storage
      const filePath = document.filePath;
      const isVultrFile = !filePath.startsWith('/') && !filePath.includes('\\') && !filePath.includes('uploads/');
      
      if (isVultrFile) {
        // Delete from Vultr cloud storage
        try {
          const { cloudStorage } = await import('./lib/cloud-storage-service');
          const fileExists = await cloudStorage.fileExists(filePath);
          if (fileExists) {
            await cloudStorage.deleteFile(filePath);
            console.log(`✅ Deleted document from Vultr: ${filePath}`);
          }
        } catch (vultrError) {
          console.error(`❌ Failed to delete document from Vultr: ${filePath}`, vultrError);
          // Continue with database deletion even if cloud file deletion fails
        }
      } else {
        // Delete local file if it exists (legacy support)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`✅ Deleted local document: ${filePath}`);
        }
      }

      // Delete from database
      const deleted = await storage.deleteJobDocument(documentId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Document not found' });
      }

      res.json({ message: 'Document deleted successfully' });
    } catch (error) {
      console.error('Delete job document error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/jobs/:jobId/documents/:documentId', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const documentId = parseInt(req.params.documentId);

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      const document = await storage.getJobDocument(documentId);
      if (!document || document.jobId !== jobId) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Check if user has access to update documents in this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updatedDocument = await storage.updateJobDocument(documentId, req.body);
      
      if (!updatedDocument) {
        return res.status(404).json({ message: 'Document not found' });
      }

      res.json(updatedDocument);
    } catch (error) {
      console.error('Update job document error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Document download route (Vultr-enabled)
  app.get('/api/jobs/:jobId/documents/:documentId/download', async (req: any, res) => {
    try {
      // Handle authentication via header or query parameter (for iframe compatibility)
      let token = req.headers.authorization?.split(' ')[1];
      if (!token && req.query.token) {
        token = req.query.token as string;
      }
      
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      let user;
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        user = decoded;
      } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const jobId = parseInt(req.params.jobId);
      const documentId = parseInt(req.params.documentId);

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      const document = await storage.getJobDocument(documentId);
      if (!document || document.jobId !== jobId) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Check if user has access to download documents from this job
      if (user.role !== 'admin' && job.userId !== user.id && job.selectedNotary !== user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Handle both local files (legacy) and Vultr files
      const filePath = document.filePath;
      
      // Check if this is a Vultr key (doesn't start with / or contain file system path separators)
      const isVultrFile = !filePath.startsWith('/') && !filePath.includes('\\') && !filePath.includes('uploads/');
      
      if (isVultrFile) {
        // File is stored in Vultr - generate signed URL and redirect
        try {
          const { cloudStorage } = await import('./lib/cloud-storage-service');
          
          // Check if file exists in Vultr
          const fileExists = await cloudStorage.fileExists(filePath);
          if (!fileExists) {
            return res.status(404).json({ message: 'File not found in cloud storage' });
          }
          
          // Generate signed URL for download (valid for 1 hour)
          const signedUrl = await cloudStorage.getSignedUrl(filePath, 3600);
          
          // Check if this is a signed PDF request
          const isSigned = req.query.signed === 'true';
          const timestamp = req.query.timestamp;
          
          // Set appropriate headers for download
          const filename = isSigned 
            ? `SIGNED_${timestamp}_${document.originalName}` 
            : document.originalName;
            
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          
          if (isSigned) {
            res.setHeader('X-Document-Status', 'signed');
            res.setHeader('X-Signing-Timestamp', timestamp || new Date().toISOString());
            console.log(`Serving signed PDF from Vultr: ${filename}`);
          }
          
          // Redirect to Vultr signed URL
          console.log(`Redirecting to Vultr download: ${document.originalName}`);
          res.redirect(302, signedUrl);
          
        } catch (vultrError) {
          console.error('Vultr download error:', vultrError);
          return res.status(500).json({ message: 'Failed to access file in cloud storage' });
        }
      } else {
        // Legacy local file handling
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ message: 'File not found on disk' });
        }

        const isSigned = req.query.signed === 'true';
        const timestamp = req.query.timestamp;
        
        const filename = isSigned 
          ? `SIGNED_${timestamp}_${document.originalName}` 
          : document.originalName;
          
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', document.mimeType);
        
        if (isSigned) {
          res.setHeader('X-Document-Status', 'signed');
          res.setHeader('X-Signing-Timestamp', timestamp || new Date().toISOString());
          console.log(`Serving signed PDF from local: ${filename}`);
        }
        
        res.sendFile(path.resolve(filePath));
      }
    } catch (error) {
      console.error('Download document error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Document signing route - generates signed PDF
  app.post('/api/jobs/:jobId/documents/:documentId/sign', verifyToken, async (req: any, res) => {
    // Ensure we always return JSON
    res.setHeader('Content-Type', 'application/json');
    
    try {
      console.log('Sign endpoint called:', {
        jobId: req.params.jobId,
        documentId: req.params.documentId,
        userId: req.user.id,
        bodyKeys: Object.keys(req.body || {})
      });

      const jobId = parseInt(req.params.jobId);
      const documentId = parseInt(req.params.documentId);
      
      if (isNaN(jobId) || isNaN(documentId)) {
        console.log('Invalid job or document ID:', { jobId, documentId });
        return res.status(400).json({ message: 'Invalid job or document ID' });
      }
      
      const { signatures = [], page = 1, scale = 1.0 } = req.body || {};
      
      console.log('Sign request details:', {
        jobId,
        documentId,
        signaturesCount: signatures.length,
        page,
        scale
      });

      const job = await storage.getJob(jobId);
      if (!job) {
        console.log('Job not found:', jobId);
        return res.status(404).json({ message: 'Job not found' });
      }

      const document = await storage.getJobDocument(documentId);
      if (!document || document.jobId !== jobId) {
        console.log('Document not found or mismatch:', { documentId, jobId, found: !!document });
        return res.status(404).json({ message: 'Document not found' });
      }

      // Check if user has access to sign documents in this job
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        console.log('Access denied for user:', req.user.id);
        return res.status(403).json({ message: 'Access denied' });
      }

      // Generate signed PDF
      try {
        let pdfBytes: Buffer;
        
        // Handle both local files (legacy) and Vultr files
        const filePath = document.filePath;
        const isVultrFile = !filePath.startsWith('/') && !filePath.includes('\\') && !filePath.includes('uploads/');
        
        if (isVultrFile) {
          // File is stored in Vultr - download for processing
          const { cloudStorage } = await import('./lib/cloud-storage-service');
          
          const fileExists = await cloudStorage.fileExists(filePath);
          if (!fileExists) {
            return res.status(404).json({ message: 'PDF file not found in cloud storage' });
          }
          
          // Get signed URL to download the file content
          const signedUrl = await cloudStorage.getSignedUrl(filePath, 300); // 5 minutes for processing
          
          // Fetch the file content from Vultr
          const response = await fetch(signedUrl);
          if (!response.ok) {
            throw new Error(`Failed to download PDF from Vultr: ${response.statusText}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          pdfBytes = Buffer.from(arrayBuffer);
          console.log(`Downloaded PDF from Vultr for signing: ${document.originalName}`);
        } else {
          // Legacy local file handling
          pdfBytes = await fs.promises.readFile(filePath);
          console.log(`Read PDF from local storage for signing: ${document.originalName}`);
        }
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const signatureFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

        for (const sig of signatures) {
          const pageIndex = (sig.page || 1) - 1;
          if (pageIndex < 0 || pageIndex >= pages.length) {
            console.warn(`Invalid page number ${sig.page} for signature. Skipping.`);
            continue;
          }

          const page = pages[pageIndex];
          const pageDimensions = page.getSize();
          
          // Use client-provided dimensions for scaling, or default to page dimensions
          const clientWidth = sig.clientWidth || pageDimensions.width;
          const clientHeight = sig.clientHeight || pageDimensions.height;

          const widthScale = pageDimensions.width / clientWidth;
          const heightScale = pageDimensions.height / clientHeight;

          const x = sig.x * widthScale;
          const y = pageDimensions.height - (sig.y * heightScale);
          const signatureWidth = sig.width * widthScale;
          const signatureHeight = sig.height * heightScale;
          
          // Adjust y-coordinate for the height of the signature itself
          const finalY = y - signatureHeight;

          try {
            if (sig.type === 'signature' || sig.type === 'initial' || sig.type === 'stamp') {
              if (sig.signatureImage) {
                const base64Data = sig.signatureImage.split(',')[1];
                if (base64Data) {
                  const imageBytes = Buffer.from(base64Data, 'base64');
                  
                  let image;
                  try {
                    if (sig.signatureImage.startsWith('data:image/jpeg') || sig.signatureImage.startsWith('data:image/jpg')) {
                      image = await pdfDoc.embedJpg(imageBytes);
                    } else {
                      image = await pdfDoc.embedPng(imageBytes);
                    }
                    
                    page.drawImage(image, {
                      x,
                      y: finalY,
                      width: signatureWidth,
                      height: signatureHeight,
                    });

                  } catch (embedError) {
                    console.error('Failed to embed image:', embedError);
                  }
                }
              }
            } else if (sig.type === 'checkbox') {
              // Draw a checkmark manually instead of using a text character
              const checkmarkSize = Math.min(signatureWidth, signatureHeight) * 0.8;
              const xPos = x + (signatureWidth / 2);
              const yPos = finalY + (signatureHeight / 2);
              
              const p1 = { x: xPos - checkmarkSize / 2, y: yPos };
              const p2 = { x: xPos - checkmarkSize / 4, y: yPos - checkmarkSize / 2 };
              const p3 = { x: xPos + checkmarkSize / 2, y: yPos + checkmarkSize / 2 };

              page.drawLine({
                start: p1,
                end: p2,
                thickness: 2,
                color: rgb(0, 0, 0),
              });
              page.drawLine({
                start: p2,
                end: p3,
                thickness: 2,
                color: rgb(0, 0, 0),
              });
            } else if (sig.content) {
              page.drawText(sig.content, {
                x,
                y: finalY,
                font: helveticaFont,
                size: 12, // Or a dynamic size
                color: rgb(0, 0, 0),
              });
            }
          } catch (err) {
            console.error(`Failed to draw signature (ID: ${sig.id}, Type: ${sig.type}):`, err);
            // Continue to next signature
          }
        }

        const signedPdfBytes = await pdfDoc.save();

        console.log(`Successfully generated signed PDF for document ${documentId}`);
        const filename = `SIGNED_${Date.now()}_${document.originalName}`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(Buffer.from(signedPdfBytes));

      } catch (pdfError) {
        console.error('Error during PDF signing process:', pdfError);
        res.status(500).json({
            success: false,
            message: 'Failed to generate signed PDF.',
            error: pdfError instanceof Error ? pdfError.message : String(pdfError),
        });
      }
    } catch (error) {
      console.error('Sign document error:', error);
      
      // Ensure we return JSON even on error
      const errorResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      };
      
      res.status(500).json(errorResponse);
    }
  });

  // Document preview route (for images and PDFs) - Vultr-enabled
  app.get('/api/jobs/:jobId/documents/:documentId/preview', async (req: any, res) => {
    try {
      // Handle authentication via header or query parameter (for iframe compatibility)
      let token = req.headers.authorization?.split(' ')[1];
      if (!token && req.query.token) {
        token = req.query.token as string;
      }
      
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      let user;
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        user = decoded;
      } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const jobId = parseInt(req.params.jobId);
      const documentId = parseInt(req.params.documentId);

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      const document = await storage.getJobDocument(documentId);
      if (!document || document.jobId !== jobId) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Check if user has access to preview documents from this job
      if (user.role !== 'admin' && job.userId !== user.id && job.selectedNotary !== user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Handle both local files (legacy) and Vultr files
      const filePath = document.filePath;
      
      // Check if this is a Vultr key (doesn't start with / or contain file system path separators)
      const isVultrFile = !filePath.startsWith('/') && !filePath.includes('\\') && !filePath.includes('uploads/');
      
      if (isVultrFile) {
        // File is stored in Vultr - generate signed URL and redirect
        try {
          const { cloudStorage } = await import('./lib/cloud-storage-service');
          
          // Check if file exists in Vultr
          const fileExists = await cloudStorage.fileExists(filePath);
          if (!fileExists) {
            return res.status(404).json({ message: 'File not found in cloud storage' });
          }
          
          // Generate signed URL for preview (valid for 1 hour)
          const signedUrl = await cloudStorage.getSignedUrl(filePath, 3600);
          
          // Set appropriate headers for inline viewing
          res.setHeader('Content-Type', document.mimeType);
          res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minute cache
          
          // Redirect to Vultr signed URL for inline viewing
          console.log(`Redirecting to Vultr preview: ${document.originalName}`);
          res.redirect(302, signedUrl);
          
        } catch (vultrError) {
          console.error('Vultr preview error:', vultrError);
          return res.status(500).json({ message: 'Failed to access file in cloud storage' });
        }
      } else {
        // Legacy local file handling
        if (!fs.existsSync(filePath)) {
          console.error('File not found on disk:', filePath);
          return res.status(404).json({ message: 'File not found on disk' });
        }

        // Set appropriate headers for inline viewing
        res.setHeader('Content-Type', document.mimeType);
        res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minute cache
        
        // Send the file for inline viewing
        res.sendFile(path.resolve(filePath));
      }
    } catch (error) {
      console.error('Preview document error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Calendar Management API

  // Get notary time slots
app.get('/api/calendar/time-slots', verifyToken, async (req, res) => {
    try {
      const { month, year } = req.query;
      const notaryId = req.user?.id;

      if (req.user?.role !== 'notary' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      let query = db
        .select()
        .from(notaryTimeSlots)
        .where(eq(notaryTimeSlots.notaryId, notaryId))
        .orderBy(notaryTimeSlots.date, notaryTimeSlots.startTime);

      // Filter by month/year if provided
      if (month && year) {
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
        query = query.where(
          and(
            gte(notaryTimeSlots.date, startDate),
            lte(notaryTimeSlots.date, endDate)
          )
        );
      }

      const timeSlots = await query;
      res.json(timeSlots);
    } catch (error) {
      console.error('Error fetching time slots:', error);
      res.status(500).json({ error: 'Failed to fetch time slots' });
    }
  });

  // Create time slot
  app.post('/api/calendar/time-slots', verifyToken, async (req, res) => {
    try {
      const notaryId = req.user?.id;
      const { date, startTime, endTime, status, blockReason } = req.body;

      if (req.user?.role !== 'notary' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const newSlot = await db
        .insert(notaryTimeSlots)
        .values({
          notaryId,
          date,
          startTime,
          endTime,
          status: status || 'available',
          blockReason,
          isManualBlock: status === 'blocked'
        })
        .returning();

      res.json(newSlot[0]);
    } catch (error) {
      console.error('Error creating time slot:', error);
      res.status(500).json({ error: 'Failed to create time slot' });
    }
  });

  // Update time slot
  app.put('/api/calendar/time-slots/:id', verifyToken, async (req, res) => {
    try {
      const notaryId = req.user?.id;
      const slotId = parseInt(req.params.id);
      const updates = req.body;

      if (req.user?.role !== 'notary' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Verify slot belongs to the notary
      const existingSlot = await db
        .select()
        .from(notaryTimeSlots)
        .where(
          and(
            eq(notaryTimeSlots.id, slotId),
            eq(notaryTimeSlots.notaryId, notaryId)
          )
        );

      if (existingSlot.length === 0) {
        return res.status(404).json({ error: 'Time slot not found' });
      }

      const updatedSlot = await db
        .update(notaryTimeSlots)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(notaryTimeSlots.id, slotId))
        .returning();

      res.json(updatedSlot[0]);
    } catch (error) {
      console.error('Error updating time slot:', error);
      res.status(500).json({ error: 'Failed to update time slot' });
    }
  });

  // Delete time slot
  app.delete('/api/calendar/time-slots/:id', verifyToken, async (req, res) => {
    try {
      const notaryId = req.user?.id;
      const slotId = parseInt(req.params.id);

      if (req.user?.role !== 'notary' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Verify slot belongs to the notary and is not booked
      const existingSlot = await db
        .select()
        .from(notaryTimeSlots)
        .where(
          and(
            eq(notaryTimeSlots.id, slotId),
            eq(notaryTimeSlots.notaryId, notaryId)
          )
        );

      if (existingSlot.length === 0) {
        return res.status(404).json({ error: 'Time slot not found' });
      }

      if (existingSlot[0].status === 'booked') {
        return res.status(400).json({ error: 'Cannot delete booked time slot' });
      }

      await db
        .delete(notaryTimeSlots)
        .where(eq(notaryTimeSlots.id, slotId));

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting time slot:', error);
      res.status(500).json({ error: 'Failed to delete time slot' });
    }
  });

  // Get calendar events
  app.get('/api/calendar/events', verifyToken, async (req, res) => {
    try {
      const { month, year } = req.query;
      const notaryId = req.user?.id;

      if (req.user?.role !== 'notary' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      let query = db
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.notaryId, notaryId))
        .orderBy(calendarEvents.startDateTime);

      // Filter by month/year if provided
      if (month && year) {
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0);
        
        query = query.where(
          and(
            gte(calendarEvents.startDateTime, startDate),
            lte(calendarEvents.startDateTime, endDate)
          )
        );
      }

      const events = await query;
      res.json(events);
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  });

  // Create calendar event
  app.post('/api/calendar/events', verifyToken, async (req, res) => {
    try {
      const notaryId = req.user?.id;
      const { title, description, startDateTime, endDateTime, location, eventType, isAllDay } = req.body;

      if (req.user?.role !== 'notary' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const newEvent = await db
        .insert(calendarEvents)
        .values({
          notaryId,
          title,
          description,
          startDateTime: new Date(startDateTime),
          endDateTime: new Date(endDateTime),
          location,
          eventType: eventType || 'personal',
          isAllDay: isAllDay || false
        })
        .returning();

      res.json(newEvent[0]);
    } catch (error) {
      console.error('Error creating event:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  });

  // Get working hours
  app.get('/api/calendar/working-hours', verifyToken, async (req, res) => {
    try {
      const notaryId = req.user?.id;

      if (req.user?.role !== 'notary' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const workingHours = await db
        .select()
        .from(notaryWorkingHours)
        .where(eq(notaryWorkingHours.notaryId, notaryId))
        .orderBy(notaryWorkingHours.dayOfWeek);

      res.json(workingHours);
    } catch (error) {
      console.error('Error fetching working hours:', error);
      res.status(500).json({ error: 'Failed to fetch working hours' });
    }
  });

  // Update working hours
  app.put('/api/calendar/working-hours', verifyToken, async (req, res) => {
    try {
      const notaryId = req.user?.id;
      const { workingHours } = req.body;

      if (req.user?.role !== 'notary' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Delete existing working hours
      await db
        .delete(notaryWorkingHours)
        .where(eq(notaryWorkingHours.notaryId, notaryId));

      // Insert new working hours
      if (workingHours && workingHours.length > 0) {
        const hoursToInsert = workingHours
          .filter((h: any) => h.isActive)
          .map((h: any) => ({
            notaryId,
            dayOfWeek: h.dayOfWeek,
            startTime: h.startTime,
            endTime: h.endTime,
            isActive: h.isActive
          }));

        if (hoursToInsert.length > 0) {
          await db.insert(notaryWorkingHours).values(hoursToInsert);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating working hours:', error);
      res.status(500).json({ error: 'Failed to update working hours' });
    }
  });

  // Get available notaries for a specific date/time
  app.get('/api/calendar/available-notaries', verifyToken, async (req, res) => {
    try {
      const { date, startTime, endTime } = req.query;

      if (!date || !startTime || !endTime) {
        return res.status(400).json({ error: 'Date, start time, and end time are required' });
      }

      // Get notaries with available time slots
      const availableNotaries = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          timeSlots: notaryTimeSlots
        })
        .from(users)
        .leftJoin(notaryTimeSlots, 
          and(
            eq(users.id, notaryTimeSlots.notaryId),
            eq(notaryTimeSlots.date, date as string),
            eq(notaryTimeSlots.status, 'available'),
            gte(notaryTimeSlots.startTime, startTime as string),
            lte(notaryTimeSlots.endTime, endTime as string)
          )
        )
        .where(
          and(
            eq(users.role, 'notary'),
            eq(users.isActive, true)
          )
        );

      // Group by notary
      const groupedNotaries = availableNotaries.reduce((acc: any, row) => {
        if (!acc[row.id]) {
          acc[row.id] = {
            id: row.id,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            availableSlots: []
          };
        }
        if (row.timeSlots) {
          acc[row.id].availableSlots.push(row.timeSlots);
        }
        return acc;
      }, {});

      res.json(Object.values(groupedNotaries).filter((n: any) => n.availableSlots.length > 0));
    } catch (error) {
      console.error('Error fetching available notaries:', error);
      res.status(500).json({ error: 'Failed to fetch available notaries' });
    }
  });

  // Get all available notaries (for notary change functionality)
  app.get('/api/notaries/available', verifyToken, async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'title_company') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const availableNotaries = await db
        .select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          isNotarySigningAgent: users.isNotarySigningAgent,
          isSpanishSpeaking: users.isSpanishSpeaking,
          notaryType: users.notaryType,
          maxConcurrentJobs: users.maxConcurrentJobs
        })
        .from(users)
        .where(
          and(
            eq(users.role, 'notary'),
            eq(users.isActive, true)
            // Removed the restrictive notaryType filter - include all active notaries
          )
        )
        .orderBy(users.firstName, users.lastName, users.username);

      res.json(availableNotaries);
    } catch (error) {
      console.error('Error fetching available notaries:', error);
      res.status(500).json({ error: 'Failed to fetch available notaries' });
    }
  });

  // Book a time slot for a job
  app.post('/api/calendar/book-slot', verifyToken, async (req, res) => {
    try {
      const { slotId, jobId } = req.body;

      if (!slotId || !jobId) {
        return res.status(400).json({ error: 'Slot ID and Job ID are required' });
      }

      // Verify the slot is available
      const slot = await db
        .select()
        .from(notaryTimeSlots)
        .where(
          and(
            eq(notaryTimeSlots.id, slotId),
            eq(notaryTimeSlots.status, 'available')
          )
        );

      if (slot.length === 0) {
        return res.status(400).json({ error: 'Time slot is not available' });
      }

      // Update the slot status to booked
      await db
        .update(notaryTimeSlots)
        .set({ 
          status: 'booked',
          jobId,
          updatedAt: new Date()
        })
        .where(eq(notaryTimeSlots.id, slotId));

      // Create a calendar event for the job
      await db
        .insert(calendarEvents)
        .values({
          notaryId: slot[0].notaryId,
          title: `Notarization Job #${jobId}`,
          description: 'Scheduled notarization appointment',
          startDateTime: new Date(`${slot[0].date} ${slot[0].startTime}`),
          endDateTime: new Date(`${slot[0].date} ${slot[0].endTime}`),
          eventType: 'job',
          jobId,
          isAllDay: false
        });

      res.json({ success: true, message: 'Time slot booked successfully' });
    } catch (error) {
      console.error('Error booking time slot:', error);
      res.status(500).json({ error: 'Failed to book time slot' });
    }
  });

  // Random Notary Assignment API

  // Get aggregated availability for qualified notaries
  app.get('/api/random-notary/availability/:date', verifyToken, async (req: any, res) => {
    try {
      const { date } = req.params;
      const { requiresNSA, requiresSpanishSpeaking, excludeNotaryIds } = req.query;

      if (req.user.role !== 'admin' && req.user.role !== 'title_company') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const qualifications: NotaryQualifications = {
        requiresNSA: requiresNSA === 'true',
        requiresSpanishSpeaking: requiresSpanishSpeaking === 'true'
      };

      const excludeIds = excludeNotaryIds ? 
        (Array.isArray(excludeNotaryIds) ? excludeNotaryIds : [excludeNotaryIds]).map((id: string) => parseInt(id)) : 
        [];

      const availability = await randomNotaryService.aggregateAvailability(qualifications, date, excludeIds);
      res.json(availability);
    } catch (error) {
      console.error('Error getting notary availability:', error);
      res.status(500).json({ error: 'Failed to get notary availability' });
    }
  });

  // Get qualified notaries for a job
  app.get('/api/random-notary/qualified', verifyToken, async (req: any, res) => {
    try {
      const { requiresNSA, requiresSpanishSpeaking, excludeNotaryIds } = req.query;

      if (req.user.role !== 'admin' && req.user.role !== 'title_company') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const qualifications: NotaryQualifications = {
        requiresNSA: requiresNSA === 'true',
        requiresSpanishSpeaking: requiresSpanishSpeaking === 'true'
      };

      const excludeIds = excludeNotaryIds ? 
        (Array.isArray(excludeNotaryIds) ? excludeNotaryIds : [excludeNotaryIds]).map((id: string) => parseInt(id)) : 
        [];

      const qualifiedNotaries = await randomNotaryService.getQualifiedNotaries(qualifications, excludeIds);
      res.json(qualifiedNotaries);
    } catch (error) {
      console.error('Error getting qualified notaries:', error);
      res.status(500).json({ error: 'Failed to get qualified notaries' });
    }
  });

  // Select random notary for a specific time slot
  app.post('/api/random-notary/select', verifyToken, async (req: any, res) => {
    try {
      const { qualifications, timeSlot, excludeNotaryIds } = req.body;

      if (req.user.role !== 'admin' && req.user.role !== 'title_company') {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!qualifications || !timeSlot) {
        return res.status(400).json({ error: 'Qualifications and time slot are required' });
      }

      const selectedNotary = await randomNotaryService.selectRandomNotary(
        qualifications, 
        timeSlot, 
        excludeNotaryIds || []
      );

      if (!selectedNotary) {
        return res.status(404).json({ error: 'No qualified notaries available for the selected time slot' });
      }

      res.json(selectedNotary);
    } catch (error) {
      console.error('Error selecting random notary:', error);
      res.status(500).json({ error: 'Failed to select random notary' });
    }
  });

  // Assign notary to job (supports random, preferred, and manual assignment)
  app.post('/api/random-notary/assign', verifyToken, async (req: any, res) => {
    try {
      const { jobId, notaryId, timeSlot, assignmentType } = req.body;

      if (req.user.role !== 'admin' && req.user.role !== 'title_company') {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!jobId || !notaryId || !timeSlot) {
        return res.status(400).json({ error: 'Job ID, notary ID, and time slot are required' });
      }

      const success = await randomNotaryService.assignNotaryToJob(
        jobId, 
        notaryId, 
        timeSlot, 
        assignmentType || 'manual'
      );

      if (success) {
        res.json({ success: true, message: 'Notary assigned successfully' });
      } else {
        res.status(500).json({ error: 'Failed to assign notary to job' });
      }
    } catch (error) {
      console.error('Error assigning notary to job:', error);
      res.status(500).json({ error: 'Failed to assign notary to job' });
    }
  });

  // Handle notary rejection
  app.post('/api/random-notary/reject', verifyToken, async (req: any, res) => {
    try {
      const { jobId, rejectionReason } = req.body;
      const notaryId = req.user.id;

      if (req.user.role !== 'notary') {
        return res.status(403).json({ error: 'Only notaries can reject assignments' });
      }

      if (!jobId) {
        return res.status(400).json({ error: 'Job ID is required' });
      }

      const newNotary = await randomNotaryService.handleNotaryRejection(
        jobId, 
        notaryId, 
        rejectionReason
      );

      if (newNotary) {
        res.json({ 
          success: true, 
          message: 'Assignment rejected and new notary assigned',
          newNotary 
        });
      } else {
        // Send priority alert to admin
        await randomNotaryService.sendPriorityAlert(
          jobId,
          `No available notaries found for job ${jobId} after rejection by notary ${notaryId}`
        );

        res.json({ 
          success: true, 
          message: 'Assignment rejected. Admin has been notified to manually assign a notary.',
          requiresManualAssignment: true
        });
      }
    } catch (error) {
      console.error('Error handling notary rejection:', error);
      res.status(500).json({ error: 'Failed to handle notary rejection' });
    }
  });

  // Get assignment history for a job
  app.get('/api/random-notary/assignment-history/:jobId', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);

      if (req.user.role !== 'admin' && req.user.role !== 'title_company') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const assignmentHistory = await db
        .select({
          id: notaryAssignmentLog.id,
          notaryId: notaryAssignmentLog.notaryId,
          assignmentType: notaryAssignmentLog.assignmentType,
          assignmentStatus: notaryAssignmentLog.assignmentStatus,
          assignedAt: notaryAssignmentLog.assignedAt,
          respondedAt: notaryAssignmentLog.respondedAt,
          rejectionReason: notaryAssignmentLog.rejectionReason,
          notaryName: users.username,
          notaryFirstName: users.firstName,
          notaryLastName: users.lastName,
          notaryEmail: users.email
        })
        .from(notaryAssignmentLog)
        .leftJoin(users, eq(notaryAssignmentLog.notaryId, users.id))
        .where(eq(notaryAssignmentLog.jobId, jobId))
        .orderBy(desc(notaryAssignmentLog.assignedAt));

      res.json(assignmentHistory);
    } catch (error) {
      console.error('Error getting assignment history:', error);
      res.status(500).json({ error: 'Failed to get assignment history' });
    }
  });

  // Check if title company has preferred notary
  app.get('/api/title-companies/:companyName/preferred-notary', verifyToken, async (req: any, res) => {
    try {
      const { companyName } = req.params;

      const company = await db
        .select({
          id: companies.id,
          companyName: companies.companyName,
          preferredNotaryId: companies.preferredNotaryId,
          preferredNotaryName: users.username,
          preferredNotaryFirstName: users.firstName,
          preferredNotaryLastName: users.lastName,
          preferredNotaryEmail: users.email,
          preferredNotaryActive: users.isActive
        })
        .from(companies)
        .leftJoin(users, eq(companies.preferredNotaryId, users.id))
        .where(eq(companies.companyName, companyName))
        .limit(1);

      if (company.length === 0) {
        return res.status(404).json({ error: 'Title company not found' });
      }

      res.json(company[0]);
    } catch (error) {
      console.error('Error getting preferred notary:', error);
      res.status(500).json({ error: 'Failed to get preferred notary' });
    }
  });

  // Email Settings API Routes
  app.get('/api/settings/email', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const settingsData = await db.select().from(systemSettings).where(
        inArray(systemSettings.key, [
          'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 
          'smtp_secure', 'from_email', 'from_name'
        ])
      );

      const settings: any = {};
      settingsData.forEach(setting => {
        // Don't expose password in plain text
        if (setting.key === 'smtp_pass') {
          settings[setting.key] = setting.value ? '••••••••' : '';
        } else {
          settings[setting.key] = setting.value;
        }
      });

      res.json(settings);
    } catch (error) {
      console.error('Get email settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/settings/email', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_email, from_name } = req.body;

      const emailSettings = [
        { key: 'smtp_host', value: smtp_host, description: 'SMTP server hostname' },
        { key: 'smtp_port', value: smtp_port, description: 'SMTP server port' },
        { key: 'smtp_user', value: smtp_user, description: 'SMTP username/email' },
        { key: 'smtp_secure', value: smtp_secure, description: 'Use SSL/TLS for SMTP' },
        { key: 'from_email', value: from_email, description: 'From email address' },
        { key: 'from_name', value: from_name, description: 'From display name' }
      ];

      // Only update password if it's not the masked value
      if (smtp_pass && smtp_pass !== '••••••••') {
        emailSettings.push({ 
          key: 'smtp_pass', 
          value: smtp_pass, 
          description: 'SMTP password' 
        });
      }

      // Update or insert each setting
      for (const setting of emailSettings) {
        const existing = await db.select()
          .from(systemSettings)
          .where(eq(systemSettings.key, setting.key))
          .limit(1);

        if (existing.length > 0) {
          await db.update(systemSettings)
            .set({
              value: setting.value,
              description: setting.description,
              updatedAt: new Date()
            })
            .where(eq(systemSettings.key, setting.key));
        } else {
          await db.insert(systemSettings).values({
            key: setting.key,
            value: setting.value,
            type: 'string',
            description: setting.description,
            isProtected: false
          });
        }
      }

      // Clear email service cache to force reload of new settings
      emailService.clearCache();
      console.log('Email settings updated and cache cleared');

      res.json({ message: 'Email settings updated successfully' });
    } catch (error) {
      console.error('Update email settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/settings/email/test', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { testEmail } = req.body;
      if (!testEmail) {
        return res.status(400).json({ message: 'Test email address is required' });
      }

      const result = await emailService.testConfiguration(testEmail);
      res.json({ message: result });
    } catch (error) {
      console.error('Email test error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Email test failed' });
    }
  });

  // Resend signer invitation
  app.post('/api/signers/:id/resend-invitation', verifyToken, async (req: any, res) => {
    try {
      const signerId = parseInt(req.params.id);

      // Get signer details
      const [signer] = await db.select({
        signer: signers,
        job: jobs
      })
      .from(signers)
      .leftJoin(jobs, eq(signers.jobId, jobs.id))
      .where(eq(signers.id, signerId));

      if (!signer) {
        return res.status(404).json({ message: 'Signer not found' });
      }

      // Generate new invitation token if needed
      const invitationToken = signer.signer.invitationToken || crypto.randomUUID();
      
      if (!signer.signer.invitationToken) {
        await db.update(signers)
          .set({ 
            invitationToken,
            invitationSentAt: new Date()
          })
          .where(eq(signers.id, signerId));
      } else {
        await db.update(signers)
          .set({ invitationSentAt: new Date() })
          .where(eq(signers.id, signerId));
      }

      // Send professional email invitation
      await emailService.sendSignerInvitation({
        signerName: signer.signer.signerName,
        signerEmail: signer.signer.signerEmail,
        signerRole: signer.signer.signerRole,
        invitationToken,
        titleCompany: signer.job?.titleCompany || 'Unknown Company',
        closingType: signer.job?.closingType || 'Document Signing',
        propertyAddress: signer.job ? 
          `${signer.job.propertyAddressOne}, ${signer.job.propertyCity}, ${signer.job.propertyState} ${signer.job.propertyZipCode}` : 
          undefined,
        scheduledDate: signer.job?.selectedDate,
        scheduledTime: signer.job?.selectedTime
      });

      res.json({ message: 'Invitation resent successfully' });
    } catch (error) {
      console.error('Resend invitation error:', error);
      res.status(500).json({ message: 'Failed to resend invitation' });
    }
  });

  // Register enhanced user management and company routes
  registerUserManagementRoutes(app);
  registerCompanyRoutes(app);
  registerApprovalWorkflowRoutes(app);
  registerNotaryProfileRoutes(app);
  registerFeeRoutes(app);

  // Password reset and setup routes
  app.post('/api/auth/validate-password-reset-token', async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: 'Token is required' });
      }

      // Find the password reset token
      const [resetToken] = await db.select({
        token: passwordResetTokens,
        user: users
      })
      .from(passwordResetTokens)
      .leftJoin(users, eq(passwordResetTokens.userId, users.id))
      .where(eq(passwordResetTokens.token, token));

      if (!resetToken) {
        return res.status(404).json({ message: 'Invalid token' });
      }

      // Check if token is expired
      if (new Date() > resetToken.token.expiresAt) {
        return res.status(400).json({ message: 'Token has expired' });
      }

      // Check if token is already used
      if (resetToken.token.used) {
        return res.status(400).json({ message: 'Token has already been used' });
      }

      // Return user info for display
      res.json({
        valid: true,
        user: {
          name: `${resetToken.user.firstName || ''} ${resetToken.user.lastName || ''}`.trim() || resetToken.user.username,
          email: resetToken.user.email,
          role: resetToken.user.role
        }
      });
    } catch (error) {
      console.error('Token validation error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/set-password', async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: 'Token and password are required' });
      }

      // Find the password reset token
      const [resetToken] = await db.select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token));

      if (!resetToken) {
        return res.status(404).json({ message: 'Invalid token' });
      }

      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: 'Token has expired' });
      }

      // Check if token is already used
      if (resetToken.used) {
        return res.status(400).json({ message: 'Token has already been used' });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update user password and mark account setup as complete
      await db.update(users)
        .set({ 
          password: hashedPassword,
          accountSetupComplete: true,
          updatedAt: new Date()
        })
        .where(eq(users.id, resetToken.userId));

      // Mark token as used
      await db.update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, resetToken.id));

      res.json({ message: 'Password set successfully' });
    } catch (error) {
      console.error('Password setup error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // EVS Verification route with Vultr storage
  app.post('/api/verification/evs-verify', verifyToken, upload.fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'backImage', maxCount: 1 },
    { name: 'selfieImage', maxCount: 1 }
  ]), async (req: any, res) => {
    try {
      const { userId } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!files.frontImage || !files.selfieImage) {
        return res.status(400).json({ message: 'Front image and selfie are required' });
      }

      // Store verification images in Vultr for compliance and audit purposes
      const { VultrUploadHandler } = await import('./vultr-upload-handler');
      const uploadedFiles: { [key: string]: any } = {};
      const sessionId = `evs-verification-${userId}-${Date.now()}`;

      try {
        // Upload front image
        const frontResult = await VultrUploadHandler.handleSignatureUpload(
          files.frontImage[0].buffer,
          `front-id-${userId}-${Date.now()}.jpg`,
          sessionId,
          parseInt(userId),
          'id_verification'
        );
        
        if (frontResult.success) {
          uploadedFiles.frontImage = frontResult.fileKey;
        }

        // Upload back image if provided
        if (files.backImage && files.backImage[0]) {
          const backResult = await VultrUploadHandler.handleSignatureUpload(
            files.backImage[0].buffer,
            `back-id-${userId}-${Date.now()}.jpg`,
            sessionId,
            parseInt(userId),
            'id_verification'
          );
          
          if (backResult.success) {
            uploadedFiles.backImage = backResult.fileKey;
          }
        }

        // Upload selfie image
        const selfieResult = await VultrUploadHandler.handleSignatureUpload(
          files.selfieImage[0].buffer,
          `selfie-${userId}-${Date.now()}.jpg`,
          sessionId,
          parseInt(userId),
          'id_verification'
        );
        
        if (selfieResult.success) {
          uploadedFiles.selfieImage = selfieResult.fileKey;
        }

        console.log(`✅ Uploaded verification images to Vultr for user ${userId}`);
      } catch (uploadError) {
        console.error('Failed to upload verification images to Vultr:', uploadError);
        // Continue with verification even if upload fails, but log the issue
      }

      // TODO: Integrate with actual EVS Solutions API
      // For now, we'll simulate the verification process
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate verification result (95% success rate)
      const isSuccessful = Math.random() > 0.05;
      const confidence = Math.floor(Math.random() * 20) + 80; // 80-100%
      const verificationId = `evs_${Date.now()}`;

      if (isSuccessful) {
        // Update user verification status with stored file references
        await db.update(users)
          .set({ 
            isVerified: true,
            verificationStatus: 'verified',
            idType: 'drivers_license', // This would come from EVS API
            idNumber: 'D123456789', // This would come from EVS API  
            idExpirationDate: '2028-12-31', // This would come from EVS API
            evsTransactionId: verificationId,
            evsVerificationConfidence: confidence,
            evsVerifiedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(users.id, parseInt(userId)));

        res.json({
          success: true,
          status: 'verified',
          confidence: confidence,
          message: 'Identity successfully verified',
          verificationId,
          verifiedAt: new Date().toISOString(),
          storedImages: uploadedFiles,
          storageType: 'vultr'
        });
      } else {
        // Update user verification status as failed
        await db.update(users)
          .set({ 
            isVerified: false,
            verificationStatus: 'failed',
            evsTransactionId: verificationId,
            evsVerificationConfidence: confidence,
            updatedAt: new Date()
          })
          .where(eq(users.id, parseInt(userId)));

        res.status(400).json({
          success: false,
          status: 'failed',
          message: 'Identity verification failed. Please ensure your documents are clear and try again.',
          reasons: ['Low image quality', 'Document not readable'],
          verificationId,
          storedImages: uploadedFiles, // Keep images for review even on failure
          storageType: 'vultr'
        });
      }

    } catch (error) {
      console.error('EVS verification error:', error);
      res.status(500).json({ message: 'Verification service error' });
    }
  });

  // Email Template Management Routes
  app.get('/api/email-templates', verifyToken, getAllTemplates);
  app.get('/api/email-templates/variables/all', verifyToken, getTemplateVariables);
  app.get('/api/email-templates/categories/all', verifyToken, getTemplateCategories);
  app.get('/api/email-templates/logs/all', verifyToken, getEmailLogs);
  app.get('/api/email-templates/:template_key', verifyToken, getTemplate);
  app.post('/api/email-templates', verifyToken, createTemplate);
  app.put('/api/email-templates/:id', verifyToken, updateTemplate);
  app.delete('/api/email-templates/:id', verifyToken, deleteTemplate);
  app.post('/api/email-templates/:template_key/preview', verifyToken, previewTemplate);
  app.post('/api/email-templates/send-test', verifyToken, sendTestEmail);

  // ==========================================
  // EDITOR ROUTES - PDF Tagging & Signing Sessions
  // ==========================================

  // Create editor session from job
  app.post('/api/editor/job/:jobId/session', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { sessionType = 'tagging', videoSessionId } = req.body;
      
      if (!jobId || isNaN(jobId)) {
        return res.status(400).json({ message: 'Invalid job ID' });
      }
      
      // Import SessionService dynamically
      const { SessionService } = await import('./services/editor/SessionService');
      
      const session = await SessionService.createSession({
        jobId,
        sessionType,
        notaryId: req.user.id,
        videoSessionId
      });
      
      res.json({
        success: true,
        session,
        message: `${sessionType} session created successfully`
      });
      
    } catch (error) {
      console.error('Create editor session error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to create session',
        error: 'session_creation_failed'
      });
    }
  });

  // Get editor session data
  app.get('/api/editor/session/:sessionId', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      
      const { SessionService } = await import('./services/editor/SessionService');
      
      const session = await SessionService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // Get session documents and participants
      const [documents, participants] = await Promise.all([
        SessionService.getSessionDocuments(session.jobId),
        SessionService.getSessionParticipants(session.jobId)
      ]);
      
      res.json({
        session,
        documents,
        participants
      });
      
    } catch (error) {
      console.error('Get editor session error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get session',
        error: 'session_fetch_failed'
      });
    }
  });

  // Update session status
  app.put('/api/editor/session/:sessionId/status', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { status, startedAt, completedAt } = req.body;
      
      const { SessionService } = await import('./services/editor/SessionService');
      
      await SessionService.updateSessionStatus(sessionId, status, {
        startedAt: startedAt ? new Date(startedAt) : undefined,
        completedAt: completedAt ? new Date(completedAt) : undefined
      });
      
      res.json({
        success: true,
        message: `Session status updated to ${status}`
      });
      
    } catch (error) {
      console.error('Update session status error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to update session',
        error: 'session_update_failed'
      });
    }
  });

  // Get job participants for editor
  app.get('/api/jobs/:jobId/participants', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      const { SessionService } = await import('./services/editor/SessionService');
      
      const participants = await SessionService.getSessionParticipants(jobId);
      
      res.json({
        participants,
        count: participants.length
      });
      
    } catch (error) {
      console.error('Get job participants error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get participants',
        error: 'participants_fetch_failed'
      });
    }
  });

  // Cancel editor session
  app.delete('/api/editor/session/:sessionId', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      
      const { SessionService } = await import('./services/editor/SessionService');
      
      await SessionService.cancelSession(sessionId);
      
      res.json({
        success: true,
        message: 'Session cancelled successfully'
      });
      
    } catch (error) {
      console.error('Cancel session error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to cancel session',
        error: 'session_cancel_failed'
      });
    }
  });

  // ==========================================
  // TAG MANAGEMENT ROUTES - Place, Update, Delete Tags
  // ==========================================

  // Place a new tag
  app.post('/api/editor/session/:sessionId/place-tag', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { documentId, tagType, coordinates, assignedUserId } = req.body;
      
      if (!documentId || !tagType || !coordinates) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      const { TagService } = await import('./services/editor/TagService');
      
      const tag = await TagService.placeTag({
        sessionId,
        documentId,
        tagType,
        coordinates,
        assignedUserId: assignedUserId || req.user.id,
        placedBy: req.user.id
      });
      
      res.json({
        success: true,
        tag,
        message: 'Tag placed successfully'
      });
      
    } catch (error) {
      console.error('Place tag error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to place tag',
        error: 'tag_place_failed'
      });
    }
  });

  // Get all tags for a session
  app.get('/api/editor/session/:sessionId/tags', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      
      const { TagService } = await import('./services/editor/TagService');
      
      const tags = await TagService.getSessionTags(sessionId);
      
      res.json({
        tags,
        count: tags.length
      });
      
    } catch (error) {
      console.error('Get tags error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get tags',
        error: 'tags_fetch_failed'
      });
    }
  });

  // Update a tag
  app.put('/api/editor/session/:sessionId/tag/:tagId', verifyToken, async (req: any, res) => {
    try {
      const { sessionId, tagId } = req.params;
      const updates = req.body;
      
      const { TagService } = await import('./services/editor/TagService');
      
      const tag = await TagService.updateTag(tagId, {
        ...updates,
        updatedBy: req.user.id
      });
      
      res.json({
        success: true,
        tag,
        message: 'Tag updated successfully'
      });
      
    } catch (error) {
      console.error('Update tag error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to update tag',
        error: 'tag_update_failed'
      });
    }
  });

  // Delete a tag
  app.delete('/api/editor/session/:sessionId/tag/:tagId', verifyToken, async (req: any, res) => {
    try {
      const { sessionId, tagId } = req.params;
      
      const { TagService } = await import('./services/editor/TagService');
      
      await TagService.deleteTag(tagId, req.user.id);
      
      res.json({
        success: true,
        message: 'Tag deleted successfully'
      });
      
    } catch (error) {
      console.error('Delete tag error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to delete tag',
        error: 'tag_delete_failed'
      });
    }
  });

  // Replace all tags with content (live signing mode)
  app.post('/api/editor/session/:sessionId/replace-all', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      
      const { TagService } = await import('./services/editor/TagService');
      
      const result = await TagService.replaceAllTagsWithContent(sessionId, req.user.id);
      
      res.json({
        success: true,
        ...result,
        message: 'All tags replaced with content successfully'
      });
      
    } catch (error) {
      console.error('Replace all tags error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to replace tags',
        error: 'replace_all_failed'
      });
    }
  });

  // Handle preflight OPTIONS requests for document serving
  app.options('/api/documents/:filePath(*)', (req: any, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
  });

  // Serve documents directly by file path for editor
  app.get('/api/documents/:filePath(*)', async (req: any, res) => {
    try {
      const filePath = decodeURIComponent(req.params.filePath);
      console.log('📄 Document request for:', filePath);
      
      // Set response timeout to prevent hanging
      req.setTimeout(30000); // 30 second timeout
      res.setTimeout(30000);
      
      // Check if this is a Vultr file or local file
      const isVultrFile = !filePath.startsWith('/') && !filePath.includes('\\') && !filePath.includes('uploads/');
      
      if (isVultrFile) {
        // Handle Vultr stored files with retry logic
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            const { cloudStorage } = await import('./lib/cloud-storage-service');
            
            // Check file existence with timeout
            const fileExistsPromise = cloudStorage.fileExists(filePath);
            const fileExistsTimeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('File existence check timeout')), 10000)
            );
            
            const fileExists = await Promise.race([fileExistsPromise, fileExistsTimeout]) as boolean;
            if (!fileExists) {
              console.log('📄 File not found in Vultr:', filePath);
              return res.status(404).json({ message: 'Document not found in cloud storage' });
            }
            
            // Get signed URL with timeout
            const signedUrlPromise = cloudStorage.getSignedUrl(filePath, 3600); // 1 hour
            const signedUrlTimeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Signed URL generation timeout')), 10000)
            );
            
            const signedUrl = await Promise.race([signedUrlPromise, signedUrlTimeout]) as string;
            console.log('📄 Proxying Vultr content for:', filePath);
            
            // Fetch the file content from Vultr with timeout and better error handling
            console.log('📄 Fetching from Vultr URL (truncated):', signedUrl.substring(0, 100) + '...');
            
            const fetchController = new AbortController();
            const fetchTimeout = setTimeout(() => {
              fetchController.abort();
              console.log('📄 Fetch aborted due to timeout');
            }, 20000); // 20 second fetch timeout
            
            const response = await fetch(signedUrl, {
              method: 'GET',
              signal: fetchController.signal,
              headers: {
                'User-Agent': 'NotaryPlatform/1.0',
                'Accept': 'application/pdf,*/*'
              }
            });
            
            clearTimeout(fetchTimeout);
            
            console.log('📄 Vultr response:', {
              status: response.status,
              statusText: response.statusText,
              contentType: response.headers.get('content-type'),
              contentLength: response.headers.get('content-length')
            });
            
            if (!response.ok) {
              throw new Error(`Vultr fetch failed: ${response.status} ${response.statusText}`);
            }
            
            // Get the content type from Vultr response or default to PDF
            const contentType = response.headers.get('content-type') || 'application/pdf';
            const contentLength = response.headers.get('content-length');
            
            console.log('📄 Serving PDF:', { contentType, contentLength });
            
            // Set proper headers for PDF viewing including CORS
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'private, max-age=300');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            if (contentLength) {
              res.setHeader('Content-Length', contentLength);
            }
            
            // Stream the content from Vultr through our server with timeout
            const bufferPromise = response.arrayBuffer();
            const bufferTimeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Buffer read timeout')), 15000)
            );
            
            const buffer = await Promise.race([bufferPromise, bufferTimeout]) as ArrayBuffer;
            console.log('📄 PDF buffer size:', buffer.byteLength, 'bytes');
            
            res.send(Buffer.from(buffer));
            return; // Success, exit retry loop
            
          } catch (vultrError: any) {
            retryCount++;
            console.error(`📄 Vultr document error (attempt ${retryCount}/${maxRetries}):`, vultrError.message || vultrError);
            
            if (retryCount >= maxRetries) {
              // After all retries failed, check if we can fallback to local storage
              console.log('📄 Vultr retries exhausted, checking for local fallback...');
              
              // Try to find the file in local storage as a fallback
              const possibleLocalPaths = [
                path.join('uploads', filePath),
                path.join(__dirname, '..', 'uploads', filePath),
                filePath
              ];
              
              for (const localPath of possibleLocalPaths) {
                if (fs.existsSync(localPath)) {
                  console.log('📄 Found local fallback:', localPath);
                  res.setHeader('Content-Type', 'application/pdf');
                  res.setHeader('Cache-Control', 'private, max-age=300');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
                  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                  res.setHeader('X-Served-From', 'local-fallback');
                  return res.sendFile(path.resolve(localPath));
                }
              }
              
              // No fallback found, return error
              return res.status(500).json({ 
                message: 'Failed to access document in cloud storage after retries',
                error: 'vultr_timeout_exhausted',
                retries: maxRetries
              });
            }
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          }
        }
      } else {
        // Handle local files
        const fullPath = path.resolve(filePath);
        
        if (!fs.existsSync(fullPath)) {
          console.log('📄 Local file not found:', fullPath);
          return res.status(404).json({ message: 'Document not found on disk' });
        }
        
        // Set proper headers for PDF viewing including CORS
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        console.log('📄 Serving local file:', fullPath);
        res.sendFile(fullPath);
      }
      
    } catch (error) {
      console.error('📄 Document serving error:', error);
      res.status(500).json({ message: 'Failed to serve document' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
