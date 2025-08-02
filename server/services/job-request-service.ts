import { db } from '../db';
import { jobRequests, jobs, users, jobDocuments } from '../../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { InsertJobRequest, JobRequest } from '../../shared/schema';
import { emailService } from '../lib/email-service';

export interface CreateJobRequestData {
  title: string;
  description: string;
  documentType: string;
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  preferredDate?: string;
  preferredTime?: string;
  location?: string;
  requestorId: number;
  requestorEmail: string;
  requestorPhone?: string;
  documents?: Array<{
    fileName: string;
    originalName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
  }>;
}

export interface ReviewJobRequestData {
  requestId: number;
  adminId: number;
  action: 'approve' | 'reject' | 'assign';
  notes?: string;
  assignedNotaryId?: number;
  assignmentNotes?: string;
}

export class JobRequestService {
  
  /**
   * Create a new job request from a signer
   */
  static async createJobRequest(data: CreateJobRequestData): Promise<JobRequest> {
    try {
      console.log('Creating job request with data:', data);
      const [newRequest] = await db
        .insert(jobRequests)
        .values({
          title: data.title,
          description: data.description,
          documentType: data.documentType,
          urgency: data.urgency,
          preferredDate: data.preferredDate,
          preferredTime: data.preferredTime,
          location: data.location,
          requestorId: data.requestorId,
          requestorEmail: data.requestorEmail,
          requestorPhone: data.requestorPhone,
          status: 'pending',
          priority: data.urgency === 'urgent' ? 'high' : data.urgency === 'high' ? 'high' : 'normal',
        })
        .returning();

      if (data.documents && data.documents.length > 0) {
        console.log('Saving documents for job request:', newRequest.id);
        await this.saveJobRequestDocuments(newRequest.id, data.documents);
      }

      console.log('Notifying admins of new request:', newRequest.id);
      await this.notifyAdminsOfNewRequest(newRequest);

      // Transform the new request to include documents
      const transformedRequest = await this.transformJobRequestWithDocuments(newRequest);
      return transformedRequest;
    } catch (error) {
      console.error('Error creating job request:', error);
      throw new Error(`Failed to create job request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all pending job requests for admin review
   */
  static async getPendingRequests(): Promise<JobRequest[]> {
    try {
      console.log('Fetching pending job requests');
      const requests = await db
        .select()
        .from(jobRequests)
        .where(eq(jobRequests.status, 'pending'))
        .orderBy(desc(jobRequests.createdAt));

      // Transform requests to include documents in the expected format
      const transformedRequests = await Promise.all(requests.map(request => this.transformJobRequestWithDocuments(request)));

      console.log('Pending requests fetched:', transformedRequests);
      return transformedRequests;
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      throw new Error('Failed to fetch pending requests');
    }
  }

  /**
   * Get job requests by requestor
   */
  static async getRequestsByRequestor(requestorId: number): Promise<JobRequest[]> {
    try {
      console.log('Fetching job requests for requestor:', requestorId);
      const requests = await db
        .select()
        .from(jobRequests)
        .where(eq(jobRequests.requestorId, requestorId))
        .orderBy(desc(jobRequests.createdAt));

      // Transform requests to include documents in the expected format
      const transformedRequests = await Promise.all(requests.map(request => this.transformJobRequestWithDocuments(request)));

      console.log('Requests fetched for requestor:', transformedRequests);
      return transformedRequests;
    } catch (error) {
      console.error('Error fetching user requests:', error);
      throw new Error('Failed to fetch user requests');
    }
  }

  /**
   * Get job requests assigned to a specific notary
   */
  static async getJobRequestsByNotary(
    notaryId: number, 
    options: {
      page?: number;
      limit?: number;
      status?: string;
      urgency?: string;
    } = {}
  ): Promise<{ requests: JobRequest[]; total: number; page: number; limit: number }> {
    try {
      console.log('Fetching job requests for notary:', notaryId, 'with options:', options);
      const { page = 1, limit = 10, status, urgency } = options;
      const offset = (page - 1) * limit;

      let whereConditions = [eq(jobRequests.assignedNotaryId, notaryId)];

      if (status) {
        whereConditions.push(eq(jobRequests.status, status));
      }

      if (urgency) {
        whereConditions.push(eq(jobRequests.urgency, urgency));
      }

      const requests = await db
        .select()
        .from(jobRequests)
        .where(and(...whereConditions))
        .orderBy(desc(jobRequests.createdAt))
        .limit(limit)
        .offset(offset);

      const totalResult = await db
        .select({ count: sql`count(*)` })
        .from(jobRequests)
        .where(and(...whereConditions));

      const total = parseInt(totalResult[0]?.count?.toString() || '0');

      // Transform requests to include documents in the expected format
      const transformedRequests = await Promise.all(requests.map(request => this.transformJobRequestWithDocuments(request)));

      console.log('Notary requests fetched:', { requests: transformedRequests, total, page, limit });
      return {
        requests: transformedRequests,
        total,
        page,
        limit
      };
    } catch (error) {
      console.error('Error fetching notary job requests:', error);
      throw new Error('Failed to fetch notary job requests');
    }
  }

  /**
   * Get job requests by user with pagination and filtering
   */
  static async getJobRequestsByUser(
    userId: number, 
    options: {
      page?: number;
      limit?: number;
      status?: string;
      urgency?: string;
    } = {}
  ): Promise<{ requests: JobRequest[]; total: number; page: number; limit: number }> {
    try {
      console.log('Fetching job requests for user:', userId, 'with options:', options);
      const { page = 1, limit = 10, status, urgency } = options;
      const offset = (page - 1) * limit;

      let whereConditions = [eq(jobRequests.requestorId, userId)];

      if (status) {
        whereConditions.push(eq(jobRequests.status, status));
      }

      if (urgency) {
        whereConditions.push(eq(jobRequests.urgency, urgency));
      }

      const requests = await db
        .select()
        .from(jobRequests)
        .where(and(...whereConditions))
        .orderBy(desc(jobRequests.createdAt))
        .limit(limit)
        .offset(offset);

      const totalResult = await db
        .select({ count: sql`count(*)` })
        .from(jobRequests)
        .where(and(...whereConditions));

      const total = parseInt(totalResult[0]?.count?.toString() || '0');

      // Transform requests to include documents in the expected format
      const transformedRequests = await Promise.all(requests.map(request => this.transformJobRequestWithDocuments(request)));

      console.log('User requests fetched:', { requests: transformedRequests, total, page, limit });
      return {
        requests: transformedRequests,
        total,
        page,
        limit
      };
    } catch (error) {
      console.error('Error fetching user job requests:', error);
      throw new Error('Failed to fetch user job requests');
    }
  }

  /**
   * Transform job request data to include documents in the expected format
   */
  static async transformJobRequestWithDocuments(request: any): Promise<any> {
    const transformed = { ...request };
    
    // Extract documents from metadata and add them to the documents field
    if (request.metadata?.documents && Array.isArray(request.metadata.documents)) {
      const { VultrUploadHandler } = await import('../vultr-upload-handler');
      
      const documentsWithUrls = await Promise.all(
        request.metadata.documents.map(async (doc: any, index: number) => {
          // Generate signed URL for the document
          let documentUrl = doc.filePath; // Fallback to filePath
          
          try {
            if (doc.filePath && !doc.filePath.startsWith('/')) {
              // This looks like a Vultr key, generate signed URL
              const signedUrl = await VultrUploadHandler.generateSignedUrl(doc.filePath, 1); // 1 hour expiry
              if (signedUrl) {
                documentUrl = signedUrl;
              }
            }
          } catch (error) {
            console.warn(`Failed to generate signed URL for document ${doc.fileName}:`, error);
          }
          
          return {
            id: index + 1, // Generate a simple ID for the frontend
            name: doc.originalName || doc.fileName,
            url: documentUrl,
            uploadedAt: request.createdAt // Use request creation date as upload date
          };
        })
      );
      
      transformed.documents = documentsWithUrls;
    } else {
      transformed.documents = [];
    }
    
    return transformed;
  }

  /**
   * Get all job requests with pagination and filtering (admin only)
   */
  static async getAllJobRequests(
    options: {
      page?: number;
      limit?: number;
      status?: string;
      urgency?: string;
    } = {}
  ): Promise<{ requests: JobRequest[]; total: number; page: number; limit: number }> {
    try {
      console.log('Fetching all job requests with options:', options);
      const { page = 1, limit = 10, status, urgency } = options;
      const offset = (page - 1) * limit;
  
      let whereConditions: any[] = [];
  
      if (status) {
        whereConditions.push(eq(jobRequests.status, status));
      }
  
      if (urgency) {
        whereConditions.push(eq(jobRequests.urgency, urgency));
      }
  
      const requests = await db
        .select()
        .from(jobRequests)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(jobRequests.createdAt))
        .limit(limit)
        .offset(offset);
  
      const totalResult = await db
        .select({ count: sql`count(*)` })
        .from(jobRequests)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
  
      const total = parseInt(totalResult[0]?.count?.toString() || '0');

      // Transform requests to include documents in the expected format
      const transformedRequests = await Promise.all(requests.map(request => this.transformJobRequestWithDocuments(request)));
  
      console.log('All job requests fetched:', { requests: transformedRequests, total, page, limit });
      return {
        requests: transformedRequests,
        total,
        page,
        limit
      };
    } catch (error) {
      console.error('Error fetching all job requests:', error);
      throw new Error('Failed to fetch all job requests');
    }
  }

  /**
   * Review and approve/reject a job request
   */
  static async reviewJobRequest(data: ReviewJobRequestData): Promise<JobRequest> {
    try {
      console.log('Reviewing job request:', data);
      const [request] = await db
        .select()
        .from(jobRequests)
        .where(eq(jobRequests.id, data.requestId))
        .limit(1);

      if (!request) {
        throw new Error('Job request not found');
      }

      // Allow review if pending, or if approved/rejected and we're assigning a notary
      const canReview = request.status === 'pending' || 
                       ((data.action === 'approve' || data.action === 'assign') && data.assignedNotaryId && 
                        (request.status === 'approved' || request.status === 'rejected'));

      if (!canReview) {
        throw new Error('Job request cannot be reviewed in its current state');
      }

      const updateData: any = {
        reviewedBy: data.adminId,
        reviewedAt: new Date(),
        reviewNotes: data.notes,
        updatedAt: new Date(),
      };

      if (data.action === 'approve') {
        if (request.status === 'pending') {
          updateData.status = 'approved';
        }
        
        if (data.assignedNotaryId) {
          updateData.assignedNotaryId = data.assignedNotaryId;
          updateData.assignedAt = new Date();
          updateData.assignmentNotes = data.assignmentNotes;
          updateData.status = 'assigned';
        }
      } else if (data.action === 'assign') {
        if (data.assignedNotaryId) {
          updateData.assignedNotaryId = data.assignedNotaryId;
          updateData.assignedAt = new Date();
          updateData.assignmentNotes = data.assignmentNotes;
          updateData.status = 'assigned';
        }
      } else if (data.action === 'reject') {
        updateData.status = 'rejected';
      }

      const [updatedRequest] = await db
        .update(jobRequests)
        .set(updateData)
        .where(eq(jobRequests.id, data.requestId))
        .returning();

      console.log('Notifying requestor of review:', updatedRequest.id);
      await this.notifyRequestorOfReview(updatedRequest);

      if ((data.action === 'approve' || data.action === 'assign') && data.assignedNotaryId) {
        console.log('Notifying notary of assignment:', updatedRequest.id);
        await this.notifyNotaryOfAssignment(updatedRequest);
      }

      // Transform the updated request to include documents
      const transformedRequest = await this.transformJobRequestWithDocuments(updatedRequest);
      return transformedRequest;
    } catch (error) {
      console.error('Error reviewing job request:', error);
      throw new Error('Failed to review job request');
    }
  }

  /**
   * Convert an approved job request to a regular job
   */
  static async convertRequestToJob(requestId: number): Promise<{ request: JobRequest; job: any }> {
    try {
      console.log('Converting job request to job:', requestId);
      const [request] = await db
        .select()
        .from(jobRequests)
        .where(eq(jobRequests.id, requestId))
        .limit(1);

      if (!request) {
        throw new Error('Job request not found');
      }

      if (request.status !== 'approved' && request.status !== 'assigned') {
        throw new Error('Job request must be approved or assigned to convert to job');
      }

      if (request.convertedToJobId) {
        throw new Error('Job request has already been converted to a job');
      }

      const [newJob] = await db
        .insert(jobs)
        .values({
          titleCompany: 'Signer Request',
          closingType: 'other',
          propertyAddressOne: request.location || 'TBD',
          propertyCity: 'TBD',
          propertyState: 'TBD',
          propertyZipCode: 'TBD',
          jobStatus: 'request_approved',
          userId: request.requestorId,
          isSignerRequest: true,
          signerRequestNotes: request.description,
          requestPriority: request.priority,
          notaryId: request.assignedNotaryId || null,
          notaryOption: request.assignedNotaryId ? 'assign' : 'auto',
          selectedNotary: request.assignedNotaryId?.toString() || null,
          selectedDate: request.preferredDate,
          selectedTime: request.preferredTime,
        })
        .returning();

      if (request.metadata?.documents) {
        console.log('Moving documents to job:', newJob.id);
        await this.moveDocumentsToJob(newJob.id, request.metadata.documents, request.requestorId);
      }

      const [updatedRequest] = await db
        .update(jobRequests)
        .set({
          status: 'completed',
          convertedToJobId: newJob.id,
          convertedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobRequests.id, requestId))
        .returning();

      // Transform the updated request to include documents
      const transformedRequest = await this.transformJobRequestWithDocuments(updatedRequest);
      return { request: transformedRequest, job: newJob };
    } catch (error) {
      console.error('Error converting request to job:', error);
      throw new Error('Failed to convert request to job');
    }
  }

  /**
   * Get available notaries for assignment
   */
  static async getAvailableNotaries(): Promise<any[]> {
    try {
      console.log('Fetching available notaries');
      const notaries = await db
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
      console.log('Available notaries:', notaries);
      return notaries;
    } catch (error) {
      console.error('Error fetching available notaries:', error);
      throw new Error('Failed to fetch available notaries');
    }
  }

  /**
   * Notify admins of new job request
   */
  private static async notifyAdminsOfNewRequest(request: JobRequest): Promise<void> {
    try {
      console.log('Fetching admins for notification of job request:', request.id);
      const admins = await db
        .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(
          and(
            eq(users.role, 'admin'),
            eq(users.isActive, true)
          )
        );

      console.log('Admins found for notification:', admins);

      if (admins.length === 0) {
        console.warn('No active admins found to notify for job request:', request.id);
        return;
      }

      for (const admin of admins) {
        console.log(`Sending notification to admin: ${admin.email}`);
        await emailService.sendJobRequestNotification({
          to: admin.email,
          adminName: `${admin.firstName} ${admin.lastName}`,
          requestTitle: request.title,
          requestorEmail: request.requestorEmail,
          urgency: request.urgency,
          description: request.description,
        });
        console.log(`Notification sent to ${admin.email}`);
      }
    } catch (error) {
      console.error('Error notifying admins:', error);
    }
  }

  /**
   * Notify requestor of review decision
   */
  private static async notifyRequestorOfReview(request: JobRequest): Promise<void> {
    try {
      console.log('Notifying requestor of review for request:', request.id);
      await emailService.sendJobRequestReviewNotification({
        to: request.requestorEmail,
        requestTitle: request.title,
        status: request.status,
        reviewNotes: request.reviewNotes,
        assignedNotary: request.assignedNotaryId ? 'Yes' : 'No',
      });
      console.log('Notification sent to requestor:', request.requestorEmail);
    } catch (error) {
      console.error('Error notifying requestor:', error);
    }
  }

  /**
   * Notify notary of assignment
   */
  private static async notifyNotaryOfAssignment(request: JobRequest): Promise<void> {
    try {
      if (!request.assignedNotaryId) return;

      console.log('Fetching notary for assignment notification:', request.assignedNotaryId);
      const [notary] = await db
        .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, request.assignedNotaryId))
        .limit(1);

      if (notary) {
        console.log('Sending assignment notification to notary:', notary.email);
        await emailService.sendNotaryAssignmentNotification({
          to: notary.email,
          notaryName: `${notary.firstName} ${notary.lastName}`,
          requestTitle: request.title,
          requestorEmail: request.requestorEmail,
          description: request.description,
          preferredDate: request.preferredDate,
          preferredTime: request.preferredTime,
          location: request.location,
        });
        console.log('Notification sent to notary:', notary.email);
      } else {
        console.warn('Notary not found for ID:', request.assignedNotaryId);
      }
    } catch (error) {
      console.error('Error notifying notary:', error);
    }
  }

  /**
   * Get request statistics for dashboard
   */
  static async getRequestStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    assigned: number;
    completed: number;
  }> {
    try {
      console.log('Fetching request statistics');
      const allRequests = await db
        .select({ status: jobRequests.status })
        .from(jobRequests);

      const stats = {
        total: allRequests.length,
        pending: allRequests.filter(r => r.status === 'pending').length,
        approved: allRequests.filter(r => r.status === 'approved').length,
        rejected: allRequests.filter(r => r.status === 'rejected').length,
        assigned: allRequests.filter(r => r.status === 'assigned').length,
        completed: allRequests.filter(r => r.status === 'completed').length,
      };

      console.log('Request statistics:', stats);
      return stats;
    } catch (error) {
      console.error('Error fetching request stats:', error);
      throw new Error('Failed to fetch request statistics');
    }
  }

  /**
   * Save documents for a job request
   */
  private static async saveJobRequestDocuments(
    requestId: number, 
    documents: Array<{
      fileName: string;
      originalName: string;
      filePath: string;
      fileSize: number;
      mimeType: string;
    }>
  ): Promise<void> {
    try {
      console.log('Saving documents for job request:', requestId);
      const documentRecords = documents.map(doc => ({
        jobId: null,
        fileName: doc.fileName,
        originalName: doc.originalName,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        documentType: 'original',
        status: 'uploaded',
        uploadedBy: null,
        isRequired: false,
      }));

      await db
        .update(jobRequests)
        .set({
          metadata: { documents: documentRecords }
        })
        .where(eq(jobRequests.id, requestId));
      console.log('Documents saved for job request:', requestId);
    } catch (error) {
      console.error('Error saving job request documents:', error);
      throw new Error('Failed to save documents');
    }
  }

  /**
   * Get documents for a job request
   */
  static async getJobRequestDocuments(requestId: number): Promise<any[]> {
    try {
      console.log('Fetching documents for job request:', requestId);
      const [request] = await db
        .select({ metadata: jobRequests.metadata })
        .from(jobRequests)
        .where(eq(jobRequests.id, requestId))
        .limit(1);

      if (!request || !request.metadata?.documents) {
        console.log('No documents found for job request:', requestId);
        return [];
      }

      const { VultrUploadHandler } = await import('../vultr-upload-handler');
      
      // Transform documents to include signed URLs
      const documentsWithUrls = await Promise.all(
        request.metadata.documents.map(async (doc: any, index: number) => {
          // Generate signed URL for the document
          let documentUrl = doc.filePath; // Fallback to filePath
          
          try {
            if (doc.filePath && !doc.filePath.startsWith('/')) {
              // This looks like a Vultr key, generate signed URL
              const signedUrl = await VultrUploadHandler.generateSignedUrl(doc.filePath, 1); // 1 hour expiry
              if (signedUrl) {
                documentUrl = signedUrl;
              }
            }
          } catch (error) {
            console.warn(`Failed to generate signed URL for document ${doc.fileName}:`, error);
          }
          
          return {
            id: index + 1,
            name: doc.originalName || doc.fileName,
            url: documentUrl,
            uploadedAt: new Date().toISOString() // Use current time as fallback
          };
        })
      );

      console.log('Documents fetched for job request:', requestId, documentsWithUrls);
      return documentsWithUrls;
    } catch (error) {
      console.error('Error fetching job request documents:', error);
      throw new Error('Failed to fetch documents');
    }
  }

  /**
   * Update documents for a job request
   */
  static async updateJobRequestDocuments(
    requestId: number, 
    documents: Array<{
      fileName: string;
      originalName: string;
      filePath: string;
      fileSize: number;
      mimeType: string;
    }>
  ): Promise<void> {
    try {
      console.log('Updating documents for job request:', requestId);
      const documentRecords = documents.map(doc => ({
        jobId: null,
        fileName: doc.fileName,
        originalName: doc.originalName,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        documentType: 'original',
        status: 'uploaded',
        uploadedBy: null,
        isRequired: false,
      }));

      await db
        .update(jobRequests)
        .set({
          metadata: { documents: documentRecords }
        })
        .where(eq(jobRequests.id, requestId));
      console.log('Documents updated for job request:', requestId);
    } catch (error) {
      console.error('Error updating job request documents:', error);
      throw new Error('Failed to update documents');
    }
  }

  /**
   * Move documents from request metadata to job_documents table
   */
  private static async moveDocumentsToJob(
    jobId: number, 
    documents: any[], 
    uploadedBy: number
  ): Promise<void> {
    try {
      console.log('Moving documents to job:', jobId);
      const documentRecords = documents.map(doc => ({
        jobId: jobId,
        fileName: doc.fileName,
        originalName: doc.originalName,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        documentType: 'original',
        status: 'uploaded',
        uploadedBy: uploadedBy,
        isRequired: false,
      }));

      await db.insert(jobDocuments).values(documentRecords);
      console.log('Documents moved to job:', jobId);
    } catch (error) {
      console.error('Error moving documents to job:', error);
      throw new Error('Failed to move documents to job');
    }
  }

  /**
   * Update a job request
   */
  static async updateJobRequest(
    requestId: number, 
    updateData: Partial<CreateJobRequestData>
  ): Promise<JobRequest> {
    try {
      console.log('Updating job request:', requestId, 'with data:', updateData);
      const [updatedRequest] = await db
        .update(jobRequests)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(jobRequests.id, requestId))
        .returning();

      if (!updatedRequest) {
        throw new Error('Job request not found');
      }

      if (updateData.documents) {
        console.log('Updating documents for job request:', requestId);
        await this.updateJobRequestDocuments(requestId, updateData.documents);
      }

      // Transform the updated request to include documents
      const transformedRequest = await this.transformJobRequestWithDocuments(updatedRequest);
      return transformedRequest;
    } catch (error) {
      console.error('Error updating job request:', error);
      throw new Error('Failed to update job request');
    }
  }

  /**
   * Delete a job request
   */
  static async deleteJobRequest(requestId: number): Promise<void> {
    try {
      console.log('Deleting job request:', requestId);
      const result = await db
        .delete(jobRequests)
        .where(eq(jobRequests.id, requestId))
        .returning();

      if (result.length === 0) {
        throw new Error('Job request not found');
      }
      console.log('Job request deleted:', requestId);
    } catch (error) {
      console.error('Error deleting job request:', error);
      throw new Error('Failed to delete job request');
    }
  }

  /**
   * Delete a document from a job request
   */
  static async deleteJobRequestDocument(requestId: number, fileName: string): Promise<void> {
    try {
      console.log('Deleting document for job request:', requestId, 'file:', fileName);
      const [request] = await db
        .select({ metadata: jobRequests.metadata })
        .from(jobRequests)
        .where(eq(jobRequests.id, requestId))
        .limit(1);

      if (!request || !request.metadata?.documents) {
        throw new Error('Job request or documents not found');
      }

      const updatedDocuments = request.metadata.documents.filter(
        (doc: any) => doc.fileName !== fileName
      );

      await db
        .update(jobRequests)
        .set({
          metadata: { documents: updatedDocuments }
        })
        .where(eq(jobRequests.id, requestId));
      console.log('Document deleted for job request:', requestId);
    } catch (error) {
      console.error('Error deleting job request document:', error);
      throw new Error('Failed to delete document');
    }
  }

  /**
   * Convert job request to job (admin only)
   */
  static async convertToJob(requestId: number, jobData: any): Promise<any> {
    try {
      console.log('Converting job request to job:', requestId, 'with job data:', jobData);
      const [request] = await db
        .select()
        .from(jobRequests)
        .where(eq(jobRequests.id, requestId))
        .limit(1);

      if (!request) {
        throw new Error('Job request not found');
      }

      if (request.status !== 'approved' && request.status !== 'assigned') {
        throw new Error('Job request must be approved or assigned before conversion');
      }

      const [newJob] = await db
        .insert(jobs)
        .values({
          ...jobData,
          userId: request.requestorId,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const documents = await this.getJobRequestDocuments(requestId);
      if (documents.length > 0) {
        console.log('Moving documents to job:', newJob.id);
        await this.moveDocumentsToJob(newJob.id, documents, request.requestorId);
      }

      await db
        .update(jobRequests)
        .set({
          status: 'completed',
          convertedToJobId: newJob.id,
          convertedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobRequests.id, requestId));

      console.log('Job request converted to job:', newJob.id);
      return newJob;
    } catch (error) {
      console.error('Error converting job request to job:', error);
      throw new Error('Failed to convert job request to job');
    }
  }
}