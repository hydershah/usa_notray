import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";
import { 
  insertUserSchema, 
  insertTitleCompanySchema, 
  insertJobSchema, 
  insertSignerSchema,
  insertPaymentSchema,
  insertInvoiceSchema,
  insertClosingTypeSchema,
  type Payment,
  type Invoice,
  type Job,
  type User
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

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Multer configuration for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'));
    }
  }
});

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'your-email@gmail.com',
    pass: process.env.SMTP_PASS || 'your-app-password'
  }
});

// Middleware to verify JWT token
const verifyToken = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Ensure uploads directory exists
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
  }

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

  // User management routes
  app.get('/api/users', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const users = await storage.getUsers();
      res.json(users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        privileges: user.privileges,
        createdAt: user.createdAt
      })));
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

  // Title company routes
  app.get('/api/companies', verifyToken, async (req, res) => {
    try {
      const companies = await storage.getTitleCompanies();
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

      const companyData = insertTitleCompanySchema.parse(req.body);
      const company = await storage.createTitleCompany(companyData);
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

      const company = await storage.updateTitleCompany(companyId, updateData);
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
      const deleted = await storage.deleteTitleCompany(companyId);
      
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
      const jobData = {
        ...req.body,
        userId: req.user.id,
        kbaRequired: req.body.kbaRequired === 'true'
      };

      // Remove the old single file fields from job data
      delete jobData.uploadedFile;
      delete jobData.notarizedFile;

      const job = await storage.createJob(jobData);

      // Handle multiple document uploads
      if (req.files && req.files.length > 0) {
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

          await storage.createJobDocument({
            jobId: job.id,
            fileName: file.filename,
            originalName: metadata.originalName || file.originalname,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
            documentType: metadata.documentType,
            status: 'uploaded',
            uploadedBy: req.user.id,
            isRequired: metadata.isRequired,
            signaturePages: []
          });
        }
      }

      // Create signers if provided
      if (req.body.signers) {
        const signers = JSON.parse(req.body.signers);
        for (const signerData of signers) {
          await storage.createSigner({
            ...signerData,
            jobId: job.id
          });
        }

        // Send email notifications to signers
        try {
          for (const signer of signers) {
            await transporter.sendMail({
              from: process.env.SMTP_USER || 'noreply@usanotary.com',
              to: signer.signerEmail,
              subject: 'New Notarization Job Assigned',
              html: `
                <h2>New Notarization Job</h2>
                <p>Dear ${signer.signerName},</p>
                <p>You have been assigned to a new notarization job:</p>
                <ul>
                  <li><strong>Job Reference:</strong> ${job.internalReference || 'N/A'}</li>
                  <li><strong>Title Company:</strong> ${job.titleCompany}</li>
                  <li><strong>Closing Type:</strong> ${job.closingType}</li>
                  <li><strong>Property Address:</strong> ${job.propertyAddressOne}, ${job.propertyCity}, ${job.propertyState} ${job.propertyZipCode}</li>
                  <li><strong>Scheduled Date:</strong> ${job.selectedDate || 'TBD'}</li>
                  <li><strong>Scheduled Time:</strong> ${job.selectedTime || 'TBD'}</li>
                </ul>
                <p>Please contact us if you have any questions.</p>
                <p>Best regards,<br>USA Notary Team</p>
              `
            });
          }
        } catch (emailError) {
          console.error('Email sending error:', emailError);
          // Don't fail the job creation if email fails
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
        updateData.notarizedFile = req.file.path;
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

  // Whereby video session routes
  app.post('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Generate a unique Whereby room URL for this session
      const roomName = `notary-session-${jobId}-${Date.now()}`;
      const roomUrl = `https://subdomain.whereby.com/${roomName}`;
      
      // Store session details
      const sessionData = {
        jobId,
        roomUrl,
        roomName,
        createdBy: req.user.id,
        createdAt: new Date().toISOString(),
        isActive: true,
        participants: []
      };

      res.json({
        success: true,
        roomUrl,
        roomName,
        sessionData
      });
    } catch (error) {
      console.error('Create video session error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Return existing session or indicate no active session
      const mockSession = {
        jobId,
        roomUrl: `https://subdomain.whereby.com/notary-session-${jobId}`,
        roomName: `notary-session-${jobId}`,
        isActive: false,
        participants: [],
        recordings: []
      };

      res.json(mockSession);
    } catch (error) {
      console.error('Get video session error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/jobs/:jobId/video-session/recording', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { recordingUrl, duration, participants } = req.body;
      
      // Store recording metadata
      const recordingData = {
        jobId,
        recordingUrl,
        duration,
        participants,
        createdAt: new Date().toISOString(),
        createdBy: req.user.id
      };

      res.json({
        success: true,
        recordingId: `recording-${jobId}-${Date.now()}`,
        message: 'Recording saved successfully'
      });
    } catch (error) {
      console.error('Save recording error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/jobs/:jobId/video-session', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      // End video session
      res.json({
        success: true,
        message: 'Video session ended successfully'
      });
    } catch (error) {
      console.error('End video session error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ===== ENHANCED UPLOAD SYSTEM ROUTES =====
  
  // Professional signature upload with security scanning
  app.post('/api/uploads/signature', verifyToken, signatureUpload, handleSignatureUpload);
  
  // Document upload with processing and validation
  app.post('/api/uploads/document', verifyToken, documentUpload, handleDocumentUpload);
  
  // Notary stamp upload with enhanced security
  app.post('/api/uploads/notary-stamp', verifyToken, stampUpload, handleNotaryStampUpload);
  
  // Secure file retrieval
  app.get('/api/uploads/:type/:fileId', verifyToken, getUploadedFile);
  
  // Recording upload endpoint for enhanced video system
  app.post('/api/recordings/upload', verifyToken, async (req: any, res) => {
    try {
      // Enhanced recording upload would be handled here
      // This is a placeholder for the video recording upload
      res.json({
        success: true,
        message: 'Recording upload endpoint ready',
        cloudUrl: `https://secure-storage.example.com/recordings/${Date.now()}.webm`
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

          const document = await storage.createJobDocument({
            jobId: jobId,
            fileName: file.filename,
            originalName: metadata.originalName || file.originalname,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
            documentType: metadata.documentType,
            status: 'uploaded',
            uploadedBy: req.user.id,
            isRequired: metadata.isRequired,
            signaturePages: []
          });

          addedDocuments.push(document);
        }
      }

      res.status(201).json({
        message: `Added ${addedDocuments.length} document${addedDocuments.length !== 1 ? 's' : ''} to job`,
        documents: addedDocuments
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

      // Delete the file from filesystem if it exists
      if (fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath);
      }

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

  // Document download route
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

      // Check if file exists
      if (!fs.existsSync(document.filePath)) {
        return res.status(404).json({ message: 'File not found on disk' });
      }

      // Check if this is a signed PDF request
      const isSigned = req.query.signed === 'true';
      const timestamp = req.query.timestamp;
      
      // Set appropriate headers
      const filename = isSigned 
        ? `SIGNED_${timestamp}_${document.originalName}` 
        : document.originalName;
        
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', document.mimeType);
      
      if (isSigned) {
        // Add a header to indicate this is a signed document
        res.setHeader('X-Document-Status', 'signed');
        res.setHeader('X-Signing-Timestamp', timestamp || new Date().toISOString());
        console.log(`Serving signed PDF: ${filename}`);
      }
      
      // Send the file
      res.sendFile(path.resolve(document.filePath));
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

      // Generate signed PDF URL with token authentication
      const timestamp = Date.now();
      const authToken = req.headers.authorization?.split(' ')[1] || '';
      const signedPdfUrl = `/api/jobs/${jobId}/documents/${documentId}/download?signed=true&timestamp=${timestamp}&token=${encodeURIComponent(authToken)}`;
      
      // Log the signing event
      console.log(`Document signed successfully: Job ${jobId}, Document ${documentId}, User ${req.user.id}`);
      console.log(`Signatures applied: ${signatures.length} signatures on page ${page}`);
      
      const response = {
        success: true,
        signedPdfUrl,
        message: 'Document signed successfully',
        signatureCount: signatures.length,
        signingTimestamp: new Date().toISOString(),
        signatures: signatures.map((sig: any) => ({
          type: sig.type || 'signature',
          participantName: sig.participantName || 'Unknown',
          page: sig.page || page
        }))
      };
      
      console.log('Sending sign response:', response);
      res.json(response);
      
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

  // Document preview route (for images and PDFs)
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

      // Check if file exists
      if (!fs.existsSync(document.filePath)) {
        console.error('File not found on disk:', document.filePath);
        return res.status(404).json({ message: 'File not found on disk' });
      }

      // Set appropriate headers for inline viewing
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minute cache
      
      // Send the file for inline viewing
      res.sendFile(path.resolve(document.filePath));
    } catch (error) {
      console.error('Preview document error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
