import express from 'express';
import { JobRequestService, CreateJobRequestData, ReviewJobRequestData } from '../services/job-request-service';
import { verifyToken, hasAdminPrivileges } from '../auth';
import { upload } from '../middleware/index';
import { db } from '../db';
import { jobRequests } from '../../shared/schema';
import { sql } from 'drizzle-orm';

const router = express.Router();

// Helper function to check if user has required role or privilege
const requireRole = (allowedRoles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const hasRole = allowedRoles.includes(req.user.role);
    const hasAdminPrivilege = req.user.privileges && req.user.privileges.includes('admin');
    
    if (!hasRole && !hasAdminPrivilege) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

/**
 * GET /api/job-requests/test-db
 * Test database connection and table existence
 */
router.get('/test-db', 
  process.env.NODE_ENV === 'development' ? 
    (req: any, res: any, next: any) => {
      console.log('Development mode: bypassing authentication for database test');
      req.user = { id: 1, role: 'admin', email: 'admin@example.com', privileges: ['admin'] };
      next();
    } : verifyToken, 
  async (req, res) => {
    try {
      console.log('Testing database connection...');
      
      const result = await db.select().from(jobRequests).limit(1);
      console.log('Job requests table exists and is accessible');
      console.log('Sample result:', result);
      
      const countResult = await db.select({ count: sql`count(*)` }).from(jobRequests);
      console.log('Total job requests:', countResult[0]?.count);
      
      res.json({
        success: true,
        message: 'Database connection successful',
        tableExists: true,
        totalRecords: countResult[0]?.count || 0,
        sampleData: result
      });
    } catch (error) {
      console.error('Database test failed:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({
        success: false,
        error: 'Database test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
    }
  });

/**
 * POST /api/job-requests/upload-document
 * Upload document for job request (before job request is created)
 */
router.post('/upload-document', 
  process.env.NODE_ENV === 'development' ? 
    (req: any, res: any, next: any) => {
      console.log('Development mode: bypassing authentication for job request document upload');
      req.user = { id: 1, role: 'admin', email: 'admin@example.com', privileges: ['admin'] };
      next();
    } : verifyToken, 
  upload.single('document'), async (req: any, res) => {
    try {
      console.log('Job request document upload request received');
      console.log('Request body:', req.body);
      console.log('Request file:', req.file);
      
      if (!req.file) {
        console.error('No file uploaded');
        return res.status(400).json({ error: 'No document file uploaded' });
      }

      const { VultrUploadHandler } = await import('../vultr-upload-handler');
      const tempSessionId = `job-request-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      const uploadResult = await VultrUploadHandler.handleJobDocumentUpload(
        req.file.buffer,
        req.file.originalname,
        0,
        req.user.id,
        {
          documentType: 'job_request',
          userRole: req.user.role,
          uploadType: 'job_request_temp',
          tempSessionId
        }
      );

      if (!uploadResult.success) {
        console.error('Vultr upload failed:', uploadResult.error);
        return res.status(500).json({ 
          error: `Failed to upload document: ${uploadResult.error}`,
          code: 'vultr_upload_failed'
        });
      }

      console.log(`✅ Uploaded job request document to Vultr: ${req.file.originalname} → ${uploadResult.fileKey}`);

      res.json({
        success: true,
        message: 'Job request document uploaded successfully',
        fileKey: uploadResult.fileKey,
        fileUrl: uploadResult.signedUrl,
        fileName: req.file.originalname,
        filePath: uploadResult.fileKey,
        fileSize: uploadResult.size,
        mimeType: req.file.mimetype,
        storageType: 'vultr',
        documentType: 'job_request'
      });
    } catch (error) {
      console.error('Job request document upload error:', error);
      res.status(500).json({ error: 'Job request document upload failed' });
    }
  });

/**
 * POST /api/job-requests
 * Create a new job request (signers only)
 */
router.post('/', verifyToken, requireRole(['signer', 'client']), async (req, res) => {
  try {
    const {
      title,
      description,
      documentType,
      urgency,
      preferredDate,
      preferredTime,
      location,
      requestorPhone,
      documents,
    } = req.body;

    if (!title || !description || !documentType) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, and document type are required',
      });
    }

    if (urgency && !['low', 'normal', 'high', 'urgent'].includes(urgency)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid urgency level',
      });
    }

    if (documents && Array.isArray(documents)) {
      for (const doc of documents) {
        if (!doc.fileName || !doc.originalName || !doc.filePath || !doc.fileSize || !doc.mimeType) {
          return res.status(400).json({
            success: false,
            error: 'Invalid document format. All document fields are required.',
          });
        }
      }
    }

    const requestData: CreateJobRequestData = {
      title,
      description,
      documentType,
      urgency: urgency || 'normal',
      preferredDate,
      preferredTime,
      location,
      requestorId: req.user.id,
      requestorEmail: req.user.email,
      requestorPhone,
      documents,
    };

    const newRequest = await JobRequestService.createJobRequest(requestData);

    res.status(201).json({
      success: true,
      data: newRequest,
      message: 'Job request created successfully',
    });
  } catch (error) {
    console.error('Error creating job request:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create job request',
    });
  }
});

/**
 * PUT /api/job-requests/:id
 * Update an existing job request (only requestor or admin)
 */
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { jobRequests } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    const { db } = await import('../db');

    const [existingRequest] = await db
      .select()
      .from(jobRequests)
      .where(eq(jobRequests.id, requestId))
      .limit(1);

    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Job request not found',
      });
    }

    const isOwner = existingRequest.requestorId === req.user.id;
    const isAdmin = req.user.role === 'admin' || (req.user.privileges && req.user.privileges.includes('admin'));

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const {
      title,
      description,
      documentType,
      urgency,
      preferredDate,
      preferredTime,
      location,
      requestorPhone,
      documents,
    } = req.body;

    if (!title || !description || !documentType) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, and document type are required',
      });
    }

    if (urgency && !['low', 'normal', 'high', 'urgent'].includes(urgency)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid urgency level',
      });
    }

    if (documents && Array.isArray(documents)) {
      for (const doc of documents) {
        if (!doc.fileName || !doc.originalName || !doc.filePath || !doc.fileSize || !doc.mimeType) {
          return res.status(400).json({
            success: false,
            error: 'Invalid document format. All document fields are required.',
          });
        }
      }
    }

    const updateData: Partial<CreateJobRequestData> = {
      title,
      description,
      documentType,
      urgency: urgency || 'normal',
      preferredDate,
      preferredTime,
      location,
      requestorPhone,
      documents,
    };

    const updatedRequest = await JobRequestService.updateJobRequest(requestId, updateData);

    res.json({
      success: true,
      data: updatedRequest,
      message: 'Job request updated successfully',
    });
  } catch (error) {
    console.error('Error updating job request:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update job request',
    });
  }
});

/**
 * GET /api/job-requests
 * Get all job requests (filtered by user role)
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('GET /api/job-requests called for user:', req.user);
    const { page = 1, limit = 10, status, urgency } = req.query;
    
    let requests;
    
    if (req.user.role === 'admin' || (req.user.privileges && req.user.privileges.includes('admin'))) {
      console.log('User has admin privileges, fetching all requests');
      requests = await JobRequestService.getAllJobRequests({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
        urgency: urgency as string,
      });
    } else if (req.user.role === 'notary') {
      console.log('User is notary, fetching assigned requests');
      requests = await JobRequestService.getJobRequestsByNotary(req.user.id, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
        urgency: urgency as string,
      });
    } else {
      console.log('User is regular user, fetching own requests');
      requests = await JobRequestService.getJobRequestsByUser(req.user.id, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
        urgency: urgency as string,
      });
    }

    console.log('Requests fetched:', requests);
    
    // For admin users, return the full response object with requests array
    if (req.user.role === 'admin' || (req.user.privileges && req.user.privileges.includes('admin'))) {
      res.json({
        success: true,
        data: {
          requests: requests.requests || requests,
          total: requests.total || 0,
          page: requests.page || 1,
          limit: requests.limit || 10
        },
      });
    } else {
      // For other users, return the requests directly
      res.json({
        success: true,
        data: requests.requests || requests,
      });
    }
  } catch (error) {
    console.error('Error fetching job requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job requests',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/job-requests/my-requests
 * Get current user's job requests
 */
router.get('/my-requests', verifyToken, async (req, res) => {
  try {
    console.log('GET /my-requests called for user:', req.user);
    const { page = 1, limit = 10, status, urgency } = req.query;
    
    let requests;
    
    if (req.user.role === 'admin' || (req.user.privileges && req.user.privileges.includes('admin'))) {
      console.log('User has admin privileges, fetching all requests');
      requests = await JobRequestService.getAllJobRequests({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
        urgency: urgency as string,
      });
    } else if (req.user.role === 'notary') {
      console.log('User is notary, fetching assigned requests');
      requests = await JobRequestService.getJobRequestsByNotary(req.user.id, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
        urgency: urgency as string,
      });
    } else {
      console.log('User is regular user, fetching own requests');
      requests = await JobRequestService.getJobRequestsByUser(req.user.id, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
        urgency: urgency as string,
      });
    }

    console.log('Requests fetched:', requests);
    res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error('Error fetching my job requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job requests',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/job-requests/pending
 * Get all pending job requests for admin review
 */
router.get('/pending', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    console.log('GET /pending called for user:', req.user);
    
    const pendingRequests = await JobRequestService.getPendingRequests();
    
    console.log('Pending requests fetched:', pendingRequests);
    res.json({
      success: true,
      data: pendingRequests,
    });
  } catch (error) {
    console.error('Error fetching pending job requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending job requests',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/job-requests/notaries
 * Get all available notaries for assignment
 */
router.get('/notaries', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    console.log('GET /notaries called for user:', req.user);
    
    const { users } = await import('../../shared/schema');
    const { eq, and } = await import('drizzle-orm');
    const { db } = await import('../db');

    const availableNotaries = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        notaryType: users.notaryType,
        isActive: users.isActive,
      })
      .from(users)
      .where(
        and(
          eq(users.role, 'notary'),
          eq(users.isActive, true)
        )
      )
      .orderBy(users.firstName, users.lastName);

    console.log('Available notaries fetched:', availableNotaries);
    res.json({
      success: true,
      data: availableNotaries,
    });
  } catch (error) {
    console.error('Error fetching available notaries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available notaries',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/job-requests/:id
 * Get a specific job request
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    
    const { jobRequests } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    const { db } = await import('../db');

    const [request] = await db
      .select()
      .from(jobRequests)
      .where(eq(jobRequests.id, requestId))
      .limit(1);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Job request not found',
      });
    }

    const isOwner = request.requestorId === req.user.id;
    const isAdmin = req.user.role === 'admin' || (req.user.privileges && req.user.privileges.includes('admin'));
    const isAssignedNotary = request.assignedNotaryId === req.user.id;

    if (!isOwner && !isAdmin && !isAssignedNotary) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error('Error fetching job request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job request',
    });
  }
});

/**
 * DELETE /api/job-requests/:id
 * Delete a job request (only requestor or admin)
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    
    const { jobRequests } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    const { db } = await import('../db');

    const [existingRequest] = await db
      .select()
      .from(jobRequests)
      .where(eq(jobRequests.id, requestId))
      .limit(1);

    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Job request not found',
      });
    }

    const isOwner = existingRequest.requestorId === req.user.id;
    const isAdmin = req.user.role === 'admin' || (req.user.privileges && req.user.privileges.includes('admin'));

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    if (existingRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete job request that has been processed',
      });
    }

    await JobRequestService.deleteJobRequest(requestId);

    res.json({
      success: true,
      message: 'Job request deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting job request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete job request',
    });
  }
});

/**
 * POST /api/job-requests/:id/review
 * Review a job request (admin only)
 */
router.post('/:id/review', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { action, notes, assignedNotaryId, assignmentNotes } = req.body;

    if (!['approve', 'reject', 'assign'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be approve, reject, or assign',
      });
    }

    const reviewData: ReviewJobRequestData = {
      requestId,
      adminId: req.user.id,
      action,
      notes,
      assignedNotaryId: assignedNotaryId ? parseInt(assignedNotaryId) : undefined,
      assignmentNotes,
    };

    const updatedRequest = await JobRequestService.reviewJobRequest(reviewData);

    res.json({
      success: true,
      data: updatedRequest,
      message: 'Job request reviewed successfully',
    });
  } catch (error) {
    console.error('Error reviewing job request:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to review job request',
    });
  }
});

/**
 * POST /api/job-requests/:id/convert
 * Convert job request to job (admin only)
 */
router.post('/:id/convert', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);

    const convertedJob = await JobRequestService.convertRequestToJob(requestId);

    res.json({
      success: true,
      data: convertedJob,
      message: 'Job request converted to job successfully',
    });
  } catch (error) {
    console.error('Error converting job request to job:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to convert job request to job',
    });
  }
});

/**
 * GET /api/job-requests/:id/documents
 * Get documents for a specific job request
 */
router.get('/:id/documents', verifyToken, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    
    const { jobRequests } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    const { db } = await import('../db');

    const [request] = await db
      .select()
      .from(jobRequests)
      .where(eq(jobRequests.id, requestId))
      .limit(1);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Job request not found',
      });
    }

    const isOwner = request.requestorId === req.user.id;
    const isAdmin = req.user.role === 'admin' || (req.user.privileges && req.user.privileges.includes('admin'));
    const isAssignedNotary = request.assignedNotaryId === req.user.id;

    if (!isOwner && !isAdmin && !isAssignedNotary) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const documents = await JobRequestService.getJobRequestDocuments(requestId);

    res.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    console.error('Error fetching job request documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job request documents',
    });
  }
});

/**
 * DELETE /api/job-requests/:id/documents/:fileName
 * Delete a document from a job request
 */
router.delete('/:id/documents/:fileName', verifyToken, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const fileName = decodeURIComponent(req.params.fileName);
    
    const { jobRequests } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    const { db } = await import('../db');

    const [request] = await db
      .select()
      .from(jobRequests)
      .where(eq(jobRequests.id, requestId))
      .limit(1);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Job request not found',
      });
    }

    const isOwner = request.requestorId === req.user.id;
    const isAdmin = req.user.role === 'admin' || (req.user.privileges && req.user.privileges.includes('admin'));

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    await JobRequestService.deleteJobRequestDocument(requestId, fileName);

    res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting job request document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document',
    });
  }
});

export default router;