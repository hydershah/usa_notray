import { db } from "../../db";
import { editorSessions, jobs, users, jobDocuments } from "../../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";


export interface CreateSessionRequest {
  jobId: number;
  sessionType: 'tagging' | 'notary';
  notaryId: number;
  videoSessionId?: string;
}

export interface EditorSessionData {
  id: string;
  jobId: number;
  sessionType: 'tagging' | 'notary';
  status: 'preparing' | 'active' | 'completed' | 'cancelled';
  notaryId: number;
  videoSessionId?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface SessionDocument {
  id: string;
  sessionId: string;
  fileName: string;
  fileUrl: string;
  pageCount: number;
  fileSize: number;
  uploadedAt: Date;
}

export interface SessionParticipant {
  id: string;
  sessionId: string;
  userId: string;
  userType: 'notary' | 'signer' | 'witness';
  status: 'invited' | 'joined' | 'active' | 'disconnected';
  currentPage: number;
  currentDocumentId?: string;
  joinedAt?: Date;
  lastActivityAt: Date;
  displayName: string;
  email: string;
  colorCode: string;
}

export class SessionService {
  
  /**
   * Create a new editor session from an existing job
   */
  static async createSession(request: CreateSessionRequest): Promise<EditorSessionData> {
    try {
      // Generate unique session ID
      const sessionId = nanoid(12);
      
      // Verify job exists and user has access
      const job = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, request.jobId))
        .limit(1);
      
      if (!job.length) {
        throw new Error('Job not found');
      }
      
      // Check if session already exists for this job
      const existingSession = await db
        .select()
        .from(editorSessions)
        .where(and(
          eq(editorSessions.jobId, request.jobId),
          eq(editorSessions.sessionType, request.sessionType)
        ))
        .orderBy(desc(editorSessions.createdAt)) // Get the most recent session
        .limit(1);
      
      if (existingSession.length) {
        const session = existingSession[0];
        
              // For tagging sessions: Always return existing session (even if completed)
      // This allows users to continue editing their tagged document
      if (request.sessionType === 'tagging' && session.status !== 'cancelled') {
        // If session is completed, reactivate it for continued editing
        if (session.status === 'completed') {
          await db
            .update(editorSessions)
            .set({ 
              status: 'active',
              updatedAt: new Date()
            })
            .where(eq(editorSessions.id, session.id));
          
          console.log(`🔄 Reactivated completed tagging session: ${session.sessionId} for continued editing`);
          
          // Return updated session data
          const updatedSession = { ...session, status: 'active' as const };
          return this.convertToEditorSessionData(updatedSession);
        }
        
        console.log(`🔄 Returning existing tagging session: ${session.sessionId} (status: ${session.status})`);
        return this.convertToEditorSessionData(session);
      }
        
        // For notary sessions: Only return if in progress
        if (request.sessionType === 'notary' && session.status === 'active') {
          console.log(`🔄 Returning existing notary session: ${session.sessionId}`);
          return this.convertToEditorSessionData(session);
        }
        
        // For completed notary sessions, create a new one
        if (request.sessionType === 'notary' && session.status === 'completed') {
          console.log(`✨ Creating new notary session (previous completed)`);
          // Continue to create new session below
        }
      }
      
      // Create new session
      const sessionData = {
        sessionId,
        jobId: request.jobId,
        notaryId: request.notaryId,
        sessionType: request.sessionType,
        status: 'preparing' as const,
        videoSessionId: request.videoSessionId,
        createdAt: new Date(),
      };
      
      const [createdSession] = await db
        .insert(editorSessions)
        .values(sessionData)
        .returning();
      
      console.log(`✅ Created ${request.sessionType} session: ${sessionId} for job ${request.jobId}`);
      
      return this.convertToEditorSessionData(createdSession);
      
    } catch (error) {
      console.error('Failed to create editor session:', error);
      throw new Error(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get session data by session ID
   */
  static async getSession(sessionId: string): Promise<EditorSessionData | null> {
    try {
      const [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.sessionId, sessionId))
        .limit(1);
      
      if (!session) {
        return null;
      }
      
      return this.convertToEditorSessionData(session);
      
    } catch (error) {
      console.error('Failed to get session:', error);
      throw new Error(`Failed to get session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get session documents from job documents
   */
  static async getSessionDocuments(jobId: number): Promise<SessionDocument[]> {
    try {
      const documents = await db
        .select()
        .from(jobDocuments)
        .where(eq(jobDocuments.jobId, jobId));
      
      return documents.map(doc => ({
        id: doc.id.toString(),
        sessionId: `session_${jobId}`,
        fileName: doc.fileName,
        fileUrl: this.generateDocumentUrl(doc.filePath),
        pageCount: 1, // TODO: Extract from PDF metadata
        fileSize: doc.fileSize,
        uploadedAt: doc.createdAt
      }));
      
    } catch (error) {
      console.error('Failed to get session documents:', error);
      throw new Error(`Failed to get documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get session participants from job data
   */
  static async getSessionParticipants(jobId: number): Promise<SessionParticipant[]> {
    try {
      // Get job data with participants
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
      
      if (!job) {
        throw new Error('Job not found');
      }
      
      // Debug logging to see what job data we actually have
      console.log('🔍 Job data for participants:', {
        jobId,
        selectedNotary: job.selectedNotary,
        notaryId: job.notaryId,
        hasSignerDetails: !!job.signerDetails
      });
      
      const participants: SessionParticipant[] = [];
      
      // Add notary - Check multiple possible fields
      let notaryAdded = false;
      const notaryId = job.selectedNotary || job.notaryId;
      
      if (notaryId) {
        const [notary] = await db
          .select()
          .from(users)
          .where(eq(users.id, parseInt(notaryId.toString())))
          .limit(1);
        
        if (notary) {
          participants.push({
            id: `participant_notary_${notary.id}`,
            sessionId: `session_${jobId}`,
            userId: notary.id.toString(),
            userType: 'notary',
            status: 'invited',
            currentPage: 1,
            joinedAt: undefined,
            lastActivityAt: new Date(),
            displayName: `${notary.firstName} ${notary.lastName} (Notary)`,
            email: notary.email,
            colorCode: '#FF6B6B' // Notary color
          });
          notaryAdded = true;
          console.log(`✅ Added real notary: ${notary.firstName} ${notary.lastName}`);
        }
      }
      
      // Add signers from signers table
      try {
        const { signers } = await import("../../../shared/schema");
        const jobSigners = await db
          .select()
          .from(signers)
          .where(eq(signers.jobId, jobId));
        
        console.log(`📝 Found ${jobSigners.length} signers for job ${jobId}`);
        
        for (const [index, signer] of jobSigners.entries()) {
          // Find the actual user ID by email
          let actualUserId = null;
          const [signerUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, signer.signerEmail))
            .limit(1);
          
          if (signerUser) {
            actualUserId = signerUser.id.toString();
            console.log(`🔗 Mapped signer "${signer.signerName}" (${signer.signerEmail}) to user ID ${actualUserId}`);
          } else {
            console.warn(`⚠️ No user found for signer email: ${signer.signerEmail}`);
            actualUserId = signer.id.toString(); // Fallback to signer ID
          }
          
          participants.push({
            id: `participant_signer_${signer.id}`,
            sessionId: `session_${jobId}`,
            userId: actualUserId,
            userType: 'signer',
            status: 'invited',
            currentPage: 1,
            joinedAt: undefined,
            lastActivityAt: new Date(),
            displayName: signer.signerName,
            email: signer.signerEmail,
            colorCode: this.getSignerColor(index + 1)
          });
          console.log(`✅ Added real signer: ${signer.signerName} with user ID ${actualUserId}`);
        }
      } catch (error) {
        console.error('Failed to fetch signers from database:', error);
      }
      
      // Log final participant count
      console.log(`✅ Session participants: ${participants.length} total (${participants.filter(p => p.userType === 'notary').length} notaries, ${participants.filter(p => p.userType === 'signer').length} signers)`);
      
      // If no participants found at all, log warning but don't create dummy data
      if (participants.length === 0) {
        console.warn(`⚠️ No participants found for job ${jobId}. Job may need notary assignment and signers.`);
        throw new Error('No participants found for this job. Please ensure the job has a notary assigned and signers added.');
      }
      
      return participants;
      
    } catch (error) {
      console.error('Failed to get session participants:', error);
      throw new Error(`Failed to get participants: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Update session status
   */
  static async updateSessionStatus(
    sessionId: string, 
    status: 'preparing' | 'active' | 'completed' | 'cancelled',
    data: { startedAt?: Date; completedAt?: Date } = {}
  ): Promise<void> {
    try {
      const updateData: any = { 
        status,
        updatedAt: new Date()
      };
      
      if (data.startedAt) updateData.startedAt = data.startedAt;
      if (data.completedAt) updateData.completedAt = data.completedAt;
      
      await db
        .update(editorSessions)
        .set(updateData)
        .where(eq(editorSessions.sessionId, sessionId));
      
      console.log(`✅ Updated session ${sessionId} status to: ${status}`);
      
    } catch (error) {
      console.error('Failed to update session status:', error);
      throw new Error(`Failed to update session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Delete/cancel session
   */
  static async cancelSession(sessionId: string): Promise<void> {
    try {
      await this.updateSessionStatus(sessionId, 'cancelled');
      console.log(`✅ Cancelled session: ${sessionId}`);
      
    } catch (error) {
      console.error('Failed to cancel session:', error);
      throw error;
    }
  }
  
  // Helper methods
  
  private static convertToEditorSessionData(session: any): EditorSessionData {
    return {
      id: session.sessionId,
      jobId: session.jobId,
      sessionType: session.sessionType,
      status: session.status,
      notaryId: session.notaryId,
      videoSessionId: session.videoSessionId,
      createdAt: session.createdAt,
      startedAt: session.startedAt,
      completedAt: session.completedAt
    };
  }
  
  private static generateDocumentUrl(filePath: string): string {
    console.log('🔗 Generating document URL for:', filePath);
    
    // Check if this is a Vultr file (doesn't start with / or contain file system path separators)
    const isVultrFile = !filePath.startsWith('/') && !filePath.includes('\\') && !filePath.includes('uploads/');
    
    if (isVultrFile) {
      // Generate URL for Vultr storage
      const url = `/api/documents/${encodeURIComponent(filePath)}`;
      console.log('📁 Vultr document URL:', url);
      return url;
    } else {
      // Local file path
      const url = `/api/documents/${encodeURIComponent(filePath)}`;
      console.log('📁 Local document URL:', url);
      return url;
    }
  }
  
  private static getSignerColor(signerNumber: number): string {
    const colors = [
      '#4ECDC4', // Turquoise
      '#45B7D1', // Sky Blue
      '#96CEB4', // Sage Green
      '#FFEAA7', // Soft Yellow
      '#DDA0DD', // Plum
      '#98D8C8', // Mint
      '#F7DC6F', // Light Gold
      '#BB8FCE'  // Lavender
    ];
    
    return colors[(signerNumber - 1) % colors.length];
  }
}

export default SessionService; 