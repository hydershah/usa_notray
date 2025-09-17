import { db } from "../../db";
import { editorSessions, jobs, users, jobDocuments } from "../../../shared/schema";
import { eq, and, desc, asc, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";


export interface CreateSessionRequest {
  jobId: number;
  sessionType: 'tagging' | 'notary';
  notaryId: number;
  videoSessionId?: string;
}

export interface EditorSessionData {
  id: string;
  sessionId: string; // CRITICAL: Explicit sessionId field for WebSocket compatibility
  jobId: number;
  sessionType: 'tagging' | 'notary';
  status: 'preparing' | 'active' | 'completed' | 'cancelled';
  notaryId: number;
  videoSessionId?: string;
  isLiveSession?: boolean;
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
          
          // CRITICAL FIX: Ensure tags are available for ALL users accessing the notary session
          // This is essential for signers who join after the notary
          const { LiveSigningSessionService } = await import('../session/LiveSigningSessionService');
          await (LiveSigningSessionService as any).ensureTagsForLiveSession(session, request.notaryId);
          
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
      
      // CRITICAL FIX: For notary sessions, ensure tags are copied from tagging session
      if (request.sessionType === 'notary') {
        const { LiveSigningSessionService } = await import('../session/LiveSigningSessionService');
        await (LiveSigningSessionService as any).ensureTagsForLiveSession(createdSession, request.notaryId);
        console.log(`🏷️ Ensured tags are available for new notary session ${sessionId}`);
      }
      
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
      
      // CRITICAL FIX: For notary/signing sessions, ensure tags are available
      // This handles page refreshes and direct session access
      if (session.sessionType === 'notary' && session.status === 'active') {
        console.log(`🔄 Ensuring tags for notary session ${sessionId} (refresh/direct access)`);
        const { LiveSigningSessionService } = await import('../session/LiveSigningSessionService');
        await (LiveSigningSessionService as any).ensureTagsForLiveSession(session, session.notaryId);
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
      // Order documents to prioritize original documents first, then by creation date
      const documents = await db
        .select()
        .from(jobDocuments)
        .where(eq(jobDocuments.jobId, jobId))
        .orderBy(
          // Original documents first (document_type = 'original')
          sql`CASE WHEN ${jobDocuments.documentType} = 'original' THEN 0 ELSE 1 END`,
          // Then by creation date (oldest first - original docs uploaded first)
          asc(jobDocuments.createdAt)
        );
      
      console.log(`📄 Retrieved ${documents.length} documents for job ${jobId}:`);
      documents.forEach((doc, index) => {
        console.log(`  ${index + 1}. ${doc.fileName} (${doc.documentType}) - ${doc.createdAt}`);
      });
      
      return documents.map(doc => ({
        id: doc.id.toString(),
        sessionId: `session_${jobId}`,
        fileName: doc.fileName,
        fileUrl: this.generateDocumentPreviewUrl(jobId, doc.id),
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
      let signerIndex = 0; // Track signer position for color assignment
      
      try {
        const { signers } = await import("../../../shared/schema");
        const jobSigners = await db
          .select()
          .from(signers)
          .where(eq(signers.jobId, jobId));
        
        console.log(`📝 Found ${jobSigners.length} signers for job ${jobId}`);
        
        for (const signer of jobSigners) {
          // Find the actual user ID by email
          let actualUserId = null;
          const [signerUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, signer.signerEmail.trim().toLowerCase()))
            .limit(1);
          
          if (signerUser) {
            actualUserId = signerUser.id.toString();
            console.log(`🔗 Mapped signer "${signer.signerName}" (${signer.signerEmail}) to user ID ${actualUserId}`);
          } else {
            console.warn(`⚠️ No user found for signer email: ${signer.signerEmail}`);
            actualUserId = signer.id.toString(); // Fallback to signer ID
          }
          
          signerIndex++;
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
            colorCode: this.getSignerColor(signerIndex)
          });
          console.log(`✅ Added real signer: ${signer.signerName} with user ID ${actualUserId} (color ${signerIndex})`);
        }
      } catch (error) {
        console.error('Failed to fetch signers from database:', error);
      }
      
      // Add dual role participants (notary/title_company acting as signers)
      try {
        const { jobParticipants } = await import("../../../shared/schema");
        const dualRoleParticipants = await db
          .select()
          .from(jobParticipants)
          .leftJoin(users, eq(jobParticipants.userId, users.id))
          .where(and(
            eq(jobParticipants.jobId, jobId),
            or(
              eq(jobParticipants.jobSpecificRole, 'signer'),
              eq(jobParticipants.jobSpecificRole, 'witness')
            )
          ));
        
        console.log(`🎭 Found ${dualRoleParticipants.length} dual role participants for job ${jobId}`);
        
        for (const participant of dualRoleParticipants) {
          const user = participant.users;
          const jobParticipant = participant.job_participants;
          
          if (!user || !jobParticipant) continue;
          
          // Check if this user is already added as notary - if so, skip the notary entry
          // and replace it with their dual role
          const existingNotaryIndex = participants.findIndex(p => 
            p.userId === user.id.toString() && p.userType === 'notary'
          );
          
          if (existingNotaryIndex !== -1) {
            // Remove the notary entry, they'll be added as signer instead
            participants.splice(existingNotaryIndex, 1);
            console.log(`🔄 Removed notary entry for ${user.firstName} ${user.lastName} (acting as ${jobParticipant.jobSpecificRole})`);
          }
          
          signerIndex++;
          const userType = jobParticipant.jobSpecificRole as 'signer' | 'witness';
          const displayName = `${user.firstName} ${user.lastName} (${user.role === 'notary' ? 'Notary → ' : 'Title → '}${userType.charAt(0).toUpperCase() + userType.slice(1)})`;
          
          participants.push({
            id: `participant_dual_${jobParticipant.id}`,
            sessionId: `session_${jobId}`,
            userId: user.id.toString(),
            userType: userType,
            status: 'invited',
            currentPage: 1,
            joinedAt: undefined,
            lastActivityAt: new Date(),
            displayName: displayName,
            email: user.email,
            colorCode: this.getSignerColor(signerIndex) // Give them unique signer color
          });
          console.log(`✅ Added dual role participant: ${displayName} with signer color ${signerIndex} (${this.getSignerColor(signerIndex)})`);
        }
      } catch (error) {
        console.error('Failed to fetch dual role participants from database:', error);
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
    // CRITICAL FIX: Always ensure we return the string sessionId, not the numeric database ID
    const sessionIdToReturn = session.sessionId || session.id;
    console.log(`🔍 Converting session data - DB ID: ${session.id}, sessionId: ${session.sessionId}, returning: ${sessionIdToReturn}`);
    
    return {
      id: sessionIdToReturn, // This MUST be the string sessionId for WebSocket to work
      sessionId: sessionIdToReturn, // Add explicit sessionId field as well
      jobId: session.jobId,
      sessionType: session.sessionType,
      status: session.status,
      notaryId: session.notaryId,
      videoSessionId: session.videoSessionId,
      isLiveSession: session.isLiveSession,
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
  
  /**
   * Generate document preview URL using the working preview endpoint with token support
   */
  private static generateDocumentPreviewUrl(jobId: number, documentId: number): string {
    // Include token parameter for authentication compatibility with iframes/PDFViewer
    const url = `/api/jobs/${jobId}/documents/${documentId}/preview?token={{TOKEN}}`;
    console.log('🔗 Generated document preview URL template:', url);
    return url;
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
      '#BB8FCE', // Lavender
      '#FF8A65'  // Coral Orange
    ];
    
    return colors[(signerNumber - 1) % colors.length];
  }
}

export default SessionService; 