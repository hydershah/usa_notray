import { db } from '../db';
import { jobRequests, jobs, users, jobDocuments } from '../../shared/schema';
import { eq, and, desc, isNull, isNotNull, sql } from 'drizzle-orm';
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
  action: 'approve' | 'reject';
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

      // Handle document uploads if provided
      if (data.documents && data.documents.length > 0) {
        await this.saveJobRequestDocuments(newRequest.id, data.documents);
      }

      // Send notification to admins about new request
      await this.notifyAdminsOfNewRequest(newRequest);

      return newRequest;
    } catch (error) {
      console.error('Error creating job request:', error);
      // Preserve the original error message for better debugging
      if (error instanceof Error) {
        throw new Error(`Failed to create job request: ${error.message}`);
      }
      throw new Error('Failed to create job request: Unknown error');
    }
  }

  /**
   * Get all pending job requests for admin review
   */
  static async getPendingRequests(): Promise<JobRequest[]> {
    try {
      return await db
        .select()
        .from(jobRequests)
        .where(eq(jobRequests.status, 'pending'))
        .orderBy(desc(jobRequests.priority), desc(jobRequests.createdAt));
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      throw new Error('Failed to fetch pending requests');
    }
  }

  /**
   * Get job requests by requestor (signer)
   */
  static async getRequestsByRequestor(requestorId: number): Promise<JobRequest[]> {
    try {
      return await db
        .select()
        .from(jobRequests)
        .where(eq(jobRequests.requestorId, requestorId))
        .orderBy(desc(jobRequests.createdAt));
    } catch (error) {
      console.error('Error fetching user requests:', error);
      throw new Error('Failed to fetch user requests');
    }
  }

  /**
   * Get job requests assigned to a specific notary
   */
  static async getRequestsByNotary(notaryId: number): Promise<JobRequest[]> {
    try {
      return await db
        .select()
        .from(jobRequests)
        .where(eq(jobRequests.assignedNotaryId, notaryId))
        .orderBy(desc(jobRequests.createdAt));
    } catch (error) {
      console.error('Error fetching notary requests:', error);
      throw new Error('Failed to fetch notary requests');
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
      console.log('getJobRequestsByUser called with userId:', userId, 'options:', options);
      
      const { page = 1, limit = 10, status, urgency } = options;
      const offset = (page - 1) * limit;

      let whereConditions = [eq(jobRequests.requestorId, userId)];
      console.log('Base where condition:', whereConditions);

      if (status) {
        whereConditions.push(eq(jobRequests.status, status as any));
        console.log('Added status condition:', status);
      }

      if (urgency) {
        whereConditions.push(eq(jobRequests.urgency, urgency as any));
        console.log('Added urgency condition:', urgency);
      }

      console.log('Final where conditions:', whereConditions);

      const requests = await db
        .select()
        .from(jobRequests)
        .where(and(...whereConditions))
        .orderBy(desc(jobRequests.createdAt))
        .limit(limit)
        .offset(offset);

      console.log('Requests query result:', requests);

      const totalResult = await db
        .select({ count: sql`count(*)` })
        .from(jobRequests)
        .where(and(...whereConditions));

      console.log('Total count result:', totalResult);

      const total = parseInt(totalResult[0]?.count?.toString() || '0');

      const result = {
        requests,
        total,
        page,
        limit
      };

      console.log('Returning result:', result);
      return result;
    } catch (error) {
      console.error('Error fetching user job requests:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw new Error('Failed to fetch user job requests');
    }
  }

  /**
   * Get job requests by notary with pagination and filtering
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
      const { page = 1, limit = 10, status, urgency } = options;
      const offset = (page - 1) * limit;

      let whereConditions = [eq(jobRequests.assignedNotaryId, notaryId)];

      if (status) {
        whereConditions.push(eq(jobRequests.status, status as any));
      }

      if (urgency) {
        whereConditions.push(eq(jobRequests.urgency, urgency as any));
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

      return {
        requests,
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
      const { page = 1, limit = 10, status, urgency } = options;
      const offset = (page - 1) * limit;

      let whereConditions: any[] = [];

      if (status) {
        whereConditions.push(eq(jobRequests.status, status as any));
      }

      if (urgency) {
        whereConditions.push(eq(jobRequests.urgency, urgency as any));
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

      return {
        requests,
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
      const [request] = await db
        .select()
        .from(jobRequests)
        .where(eq(jobRequests.id, data.requestId))
        .limit(1);

      if (!request) {
        throw new Error('Job request not found');
      }

      if (request.status !== 'pending') {
        throw new Error('Job request has already been reviewed');
      }

      const updateData: any = {
        status: data.action === 'approve' ? 'approved' : 'rejected',
        reviewedBy: data.adminId,
        reviewedAt: new Date(),
        reviewNotes: data.notes,
        updatedAt: new Date(),
      };

      // If approved and notary assigned, update assignment fields
      if (data.action === 'approve' && data.assignedNotaryId) {
        updateData.assignedNotaryId = data.assignedNotaryId;
        updateData.assignedAt = new Date();
        updateData.assignmentNotes = data.assignmentNotes;
        updateData.status = 'assigned';
      }

      const [updatedRequest] = await db
        .update(jobRequests)
        .set(updateData)
        .where(eq(jobRequests.id, data.requestId))
        .returning();

      // Send notification to requestor
      await this.notifyRequestorOfReview(updatedRequest);

      // If assigned to notary, notify the notary
      if (data.action === 'approve' && data.assignedNotaryId) {
        await this.notifyNotaryOfAssignment(updatedRequest);
      }

      return updatedRequest;
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

      // Create a new job from the request
      const [newJob] = await db
        .insert(jobs)
        .values({
          titleCompany: 'Signer Request', // Default title company for signer requests
          closingType: 'other', // Default closing type
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

      // Move documents from request metadata to job_documents table
      if (request.metadata?.documents) {
        await this.moveDocumentsToJob(newJob.id, request.metadata.documents, request.requestorId);
      }

      // Update the request to mark it as converted
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

      return { request: updatedRequest, job: newJob };
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
      return await db
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
      const admins = await db
        .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.role, 'admin'));

      for (const admin of admins) {
        await emailService.sendJobRequestNotification({
          to: admin.email,
          adminName: `${admin.firstName} ${admin.lastName}`,
          requestTitle: request.title,
          requestorEmail: request.requestorEmail,
          urgency: request.urgency,
          description: request.description,
        });
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
      await emailService.sendJobRequestReviewNotification({
        to: request.requestorEmail,
        requestTitle: request.title,
        status: request.status,
        reviewNotes: request.reviewNotes,
        assignedNotary: request.assignedNotaryId ? 'Yes' : 'No',
      });
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

      const [notary] = await db
        .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, request.assignedNotaryId))
        .limit(1);

      if (notary) {
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
      const documentRecords = documents.map(doc => ({
        jobId: null, // Will be set when converted to job
        fileName: doc.fileName,
        originalName: doc.originalName,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        documentType: 'original',
        status: 'uploaded',
        uploadedBy: null, // Will be set when we have the requestor info
        isRequired: false,
      }));

      // Store documents in metadata for now, will be moved to job_documents when converted
      await db
        .update(jobRequests)
        .set({
          metadata: { documents: documentRecords }
        })
        .where(eq(jobRequests.id, requestId));
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
      const [request] = await db
        .select({ metadata: jobRequests.metadata })
        .from(jobRequests)
        .where(eq(jobRequests.id, requestId))
        .limit(1);

      if (!request || !request.metadata?.documents) {
        return [];
      }

      return request.metadata.documents;
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
      const documentRecords = documents.map(doc => ({
        jobId: null, // Will be set when converted to job
        fileName: doc.fileName,
        originalName: doc.originalName,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        documentType: 'original',
        status: 'uploaded',
        uploadedBy: null, // Will be set when we have the requestor info
        isRequired: false,
      }));

      // Update documents in metadata
      await db
        .update(jobRequests)
        .set({
          metadata: { documents: documentRecords }
        })
        .where(eq(jobRequests.id, requestId));
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

      // Update documents if provided
      if (updateData.documents) {
        await this.updateJobRequestDocuments(requestId, updateData.documents);
      }

      return updatedRequest;
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
      const result = await db
        .delete(jobRequests)
        .where(eq(jobRequests.id, requestId))
        .returning();

      if (result.length === 0) {
        throw new Error('Job request not found');
      }
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

      // Create the job
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

      // Move documents from request to job
      const documents = await this.getJobRequestDocuments(requestId);
      if (documents.length > 0) {
        await this.moveDocumentsToJob(newJob.id, documents, request.requestorId);
      }

      // Update request status
      await db
        .update(jobRequests)
        .set({
          status: 'completed',
          convertedToJobId: newJob.id,
          convertedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobRequests.id, requestId));

      return newJob;
    } catch (error) {
      console.error('Error converting job request to job:', error);
      throw new Error('Failed to convert job request to job');
    }
  }
} 