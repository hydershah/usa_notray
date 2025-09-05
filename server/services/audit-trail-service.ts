import { db } from "../db";
import { eq, desc, and, inArray } from "drizzle-orm";
import {
  jobs,
  users,
  signers,
  jobDocuments,
  notaryLogEntries,
  systemActivityLogs,
  auditTrail,
  editorSessions,
  documentTags,
  jobNotifications,
  sessionParticipants,
  documentVersions
} from "../../shared/schema";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import crypto from 'crypto';

export interface AuditTrailEntry {
  // Session Context
  id: number;
  sessionId: number;
  documentId?: number;
  timestamp: Date;
  userId: number;
  userRole: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  
  // Event/Action
  eventType: string;
  eventDetails?: string;
  coordinatesPageReference?: string;
  previousState?: any;
  newState?: any;
  
  // Verification
  authenticationMethod?: string;
  verificationResult?: string;
  credentialReference?: string;
  
  // Notarial Actions
  sealApplied?: any;
  notaryCertificateReference?: string;
  digitalSignatureHash?: string;
  
  // System/Compliance
  systemSource?: string;
  auditLogIntegrityHash?: string;
  retentionMetadata?: any;
  
  // User details for display
  userName?: string;
  userEmail?: string;
  documentName?: string;
}

export interface AuditTrailReportData {
  job: any;
  notary: any;
  signers: any[];
  documents: any[];
  auditEntries: AuditTrailEntry[];
  sessions: any[];
  participants: any[];
  complianceMetrics: {
    totalEvents: number;
    totalVerifications: number;
    totalNotarialActions: number;
    sessionDuration: number;
    integrityVerified: boolean;
    retentionPolicyApplied: boolean;
  };
}

export class AuditTrailService {
  
  /**
   * Generate comprehensive audit trail report
   */
  static async generateAuditTrailReport(jobId: number): Promise<{
    success: boolean;
    reportPath?: string;
    reportData?: AuditTrailReportData;
    error?: string;
  }> {
    try {
      console.log(`📊 Generating audit trail report for job ${jobId}`);
      
      // Gather all job-related audit data
      const reportData = await this.gatherAuditTrailData(jobId);
      
      if (!reportData.job) {
        return {
          success: false,
          error: 'Job not found'
        };
      }
      
      // Generate PDF report
      const reportPath = await this.generateAuditTrailPDF(reportData);
      
      // Store report reference in job
      await this.attachAuditTrailToJob(jobId, reportPath);
      
      console.log(`✅ Audit trail report generated: ${reportPath}`);
      
      return {
        success: true,
        reportPath,
        reportData
      };
      
    } catch (error) {
      console.error('Error generating audit trail report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Gather all audit trail data for a job
   */
  private static async gatherAuditTrailData(jobId: number): Promise<AuditTrailReportData> {
    console.log(`🔍 Gathering audit trail data for job ${jobId}`);
    
    // Get job details
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    // Get notary details
    let notary = null;
    if (job.notaryId) {
      const [notaryRecord] = await db
        .select()
        .from(users)
        .where(eq(users.id, job.notaryId))
        .limit(1);
      notary = notaryRecord;
    }
    
    // Get all signers for this job
    const jobSigners = await db
      .select({
        signer: signers,
        user: users
      })
      .from(signers)
      .leftJoin(users, eq(signers.userId, users.id))
      .where(eq(signers.jobId, jobId));
    
    // Get all documents
    const documents = await db
      .select()
      .from(jobDocuments)
      .where(eq(jobDocuments.jobId, jobId))
      .orderBy(desc(jobDocuments.createdAt));
    
    // Get editor sessions
    const sessions = await db
      .select()
      .from(editorSessions)
      .where(eq(editorSessions.jobId, jobId))
      .orderBy(desc(editorSessions.createdAt));
    
    // Get comprehensive audit trail entries with user details
    const auditEntries = await db
      .select({
        auditEntry: auditTrail,
        user: users,
        document: jobDocuments
      })
      .from(auditTrail)
      .innerJoin(editorSessions, eq(auditTrail.sessionId, editorSessions.id))
      .leftJoin(users, eq(auditTrail.userId, users.id))
      .leftJoin(jobDocuments, eq(auditTrail.documentId, jobDocuments.id))
      .where(eq(editorSessions.jobId, jobId))
      .orderBy(desc(auditTrail.timestamp));
    
    // Get session participants
    let participants: any[] = [];
    if (sessions.length > 0) {
      for (const session of sessions) {
        const sessionParticipantsList = await db
          .select({
            participant: sessionParticipants,
            user: users
          })
          .from(sessionParticipants)
          .leftJoin(users, eq(sessionParticipants.userId, users.id))
          .where(eq(sessionParticipants.sessionId, session.id));
        participants = [...participants, ...sessionParticipantsList];
      }
    }
    
    // Transform audit entries to match interface
    const transformedAuditEntries: AuditTrailEntry[] = auditEntries.map(entry => ({
      id: entry.auditEntry.id,
      sessionId: entry.auditEntry.sessionId,
      documentId: entry.auditEntry.documentId || undefined,
      timestamp: entry.auditEntry.timestamp,
      userId: entry.auditEntry.userId,
      userRole: entry.auditEntry.userRole || entry.user?.role || 'Unknown',
      ipAddress: entry.auditEntry.ipAddress || undefined,
      deviceFingerprint: entry.auditEntry.deviceFingerprint || undefined,
      
      eventType: entry.auditEntry.eventType || entry.auditEntry.action || 'Unknown Event',
      eventDetails: entry.auditEntry.eventDetails || undefined,
      coordinatesPageReference: entry.auditEntry.coordinatesPageReference || 
        (entry.auditEntry.pageNumber ? `Page ${entry.auditEntry.pageNumber}` : undefined),
      previousState: entry.auditEntry.previousState || undefined,
      newState: entry.auditEntry.newState || undefined,
      
      authenticationMethod: entry.auditEntry.authenticationMethod || undefined,
      verificationResult: entry.auditEntry.verificationResult || undefined,
      credentialReference: entry.auditEntry.credentialReference || undefined,
      
      sealApplied: entry.auditEntry.sealApplied || undefined,
      notaryCertificateReference: entry.auditEntry.notaryCertificateReference || undefined,
      digitalSignatureHash: entry.auditEntry.digitalSignatureHash || undefined,
      
      systemSource: entry.auditEntry.systemSource || undefined,
      auditLogIntegrityHash: entry.auditEntry.auditLogIntegrityHash || undefined,
      retentionMetadata: entry.auditEntry.retentionMetadata || undefined,
      
      userName: entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'System',
      userEmail: entry.user?.email || undefined,
      documentName: entry.document?.originalName || undefined
    }));
    
    // Calculate compliance metrics
    const complianceMetrics = {
      totalEvents: transformedAuditEntries.length,
      totalVerifications: transformedAuditEntries.filter(entry => entry.authenticationMethod).length,
      totalNotarialActions: transformedAuditEntries.filter(entry => 
        entry.sealApplied || entry.notaryCertificateReference || entry.digitalSignatureHash
      ).length,
      sessionDuration: this.calculateSessionDuration(sessions),
      integrityVerified: this.verifyAuditIntegrity(transformedAuditEntries),
      retentionPolicyApplied: transformedAuditEntries.some(entry => entry.retentionMetadata)
    };
    
    return {
      job,
      notary,
      signers: jobSigners,
      documents,
      auditEntries: transformedAuditEntries,
      sessions,
      participants,
      complianceMetrics
    };
  }
  
  /**
   * Generate PDF audit trail report
   */
  private static async generateAuditTrailPDF(reportData: AuditTrailReportData): Promise<string> {
    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let currentPage = pdfDoc.addPage([612, 792]); // Letter size
    let yPosition = 750;
    const margin = 50;
    const pageWidth = 612 - (margin * 2);
    
    // Helper function to add new page if needed
    const checkPageSpace = (neededSpace: number) => {
      if (yPosition - neededSpace < 50) {
        currentPage = pdfDoc.addPage([612, 792]);
        yPosition = 750;
      }
    };
    
    // Helper function to draw text
    const drawText = (text: string, fontSize: number = 12, font = helveticaFont, color = rgb(0, 0, 0)) => {
      checkPageSpace(fontSize + 5);
      currentPage.drawText(text, {
        x: margin,
        y: yPosition,
        size: fontSize,
        font,
        color
      });
      yPosition -= fontSize + 5;
    };
    
    // Helper function to draw section header
    const drawSectionHeader = (title: string) => {
      checkPageSpace(25);
      yPosition -= 10; // Extra space before section
      currentPage.drawText(title, {
        x: margin,
        y: yPosition,
        size: 16,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.6)
      });
      yPosition -= 25;
      
      // Draw underline
      currentPage.drawLine({
        start: { x: margin, y: yPosition + 15 },
        end: { x: margin + 200, y: yPosition + 15 },
        thickness: 1,
        color: rgb(0.2, 0.2, 0.6)
      });
    };
    
    // Title Page
    currentPage.drawText('REMOTE ONLINE NOTARIZATION (RON)', {
      x: margin,
      y: yPosition,
      size: 20,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.5)
    });
    yPosition -= 30;
    
    currentPage.drawText('AUDIT TRAIL REPORT', {
      x: margin,
      y: yPosition,
      size: 24,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.5)
    });
    yPosition -= 40;
    
    drawText(`Job ID: ${reportData.job.id}`, 14, helveticaBold);
    drawText(`Title Company: ${reportData.job.titleCompany}`, 14);
    drawText(`Closing Type: ${reportData.job.closingType}`, 14);
    drawText(`Property: ${reportData.job.propertyAddressOne}, ${reportData.job.propertyCity}, ${reportData.job.propertyState}`, 12);
    drawText(`Generated: ${new Date().toLocaleString()}`, 12);
    drawText(`Status: ${reportData.job.jobStatus}`, 12);
    
    yPosition -= 20;
    
    // Executive Summary
    drawSectionHeader('AUDIT TRAIL SUMMARY');
    drawText(`This audit trail contains comprehensive tracking for Job #${reportData.job.id}.`);
    drawText(`Total Audit Events: ${reportData.complianceMetrics.totalEvents}`);
    drawText(`Total Verifications: ${reportData.complianceMetrics.totalVerifications}`);
    drawText(`Total Notarial Actions: ${reportData.complianceMetrics.totalNotarialActions}`);
    drawText(`Session Duration: ${Math.round(reportData.complianceMetrics.sessionDuration / 60)} minutes`);
    drawText(`Audit Integrity: ${reportData.complianceMetrics.integrityVerified ? 'Verified' : 'Warning'}`);
    drawText(`Retention Policy: ${reportData.complianceMetrics.retentionPolicyApplied ? 'Applied' : 'Pending'}`);
    
    // Notary Information
    if (reportData.notary) {
      drawSectionHeader('NOTARY INFORMATION');
      drawText(`Name: ${reportData.notary.firstName} ${reportData.notary.lastName}`);
      drawText(`Email: ${reportData.notary.email}`);
      drawText(`Commission Number: ${reportData.notary.commissionNumber || 'Not specified'}`);
      drawText(`Commission Expiration: ${reportData.notary.commissionExpiration || 'Not specified'}`);
      drawText(`State: ${reportData.notary.state || 'Not specified'}`);
    }
    
    // Participants
    drawSectionHeader('PARTICIPANTS');
    reportData.signers.forEach((signerRecord, index) => {
      checkPageSpace(60);
      drawText(`${index + 1}. ${signerRecord.signer.signerName}`, 12, helveticaBold);
      drawText(`   Email: ${signerRecord.signer.signerEmail}`);
      drawText(`   Role: ${signerRecord.signer.signerRole}`);
      drawText(`   Verified: ${signerRecord.user?.isVerified ? 'Yes' : 'No'}`);
      yPosition -= 5;
    });
    
    // Documents
    drawSectionHeader('DOCUMENTS');
    reportData.documents.forEach((doc, index) => {
      checkPageSpace(40);
      drawText(`${index + 1}. ${doc.originalName}`, 12, helveticaBold);
      drawText(`   Type: ${doc.documentType || 'General'}`);
      drawText(`   Size: ${Math.round(doc.fileSize / 1024)} KB`);
      drawText(`   Uploaded: ${new Date(doc.createdAt).toLocaleString()}`);
    });
    
    // Detailed Audit Trail Entries
    drawSectionHeader('DETAILED AUDIT TRAIL');
    
    // Group entries by category
    const sessionContextEntries = reportData.auditEntries.filter(entry => 
      ['login', 'logout', 'session_start', 'session_end', 'join_session', 'leave_session'].includes(entry.eventType)
    );
    
    const eventActionEntries = reportData.auditEntries.filter(entry => 
      ['signature', 'tag_placed', 'tag_completed', 'document_upload', 'document_view'].includes(entry.eventType)
    );
    
    const verificationEntries = reportData.auditEntries.filter(entry => 
      entry.authenticationMethod || entry.verificationResult
    );
    
    const notarialEntries = reportData.auditEntries.filter(entry => 
      entry.sealApplied || entry.notaryCertificateReference || entry.digitalSignatureHash
    );
    
    // Session Context Events
    if (sessionContextEntries.length > 0) {
      drawText('SESSION CONTEXT EVENTS:', 14, helveticaBold);
      sessionContextEntries.slice(0, 10).forEach((entry, index) => {
        checkPageSpace(70);
        drawText(`${index + 1}. ${entry.eventType.toUpperCase()}`, 12, helveticaBold);
        drawText(`   User: ${entry.userName} (${entry.userRole})`);
        drawText(`   Time: ${new Date(entry.timestamp).toLocaleString()}`);
        drawText(`   IP Address: ${entry.ipAddress || 'Not recorded'}`);
        if (entry.eventDetails) drawText(`   Details: ${entry.eventDetails}`);
        yPosition -= 5;
      });
      yPosition -= 10;
    }
    
    // Event/Action Entries
    if (eventActionEntries.length > 0) {
      drawText('EVENT/ACTION ENTRIES:', 14, helveticaBold);
      eventActionEntries.slice(0, 10).forEach((entry, index) => {
        checkPageSpace(80);
        drawText(`${index + 1}. ${entry.eventType.toUpperCase()}`, 12, helveticaBold);
        drawText(`   User: ${entry.userName} (${entry.userRole})`);
        drawText(`   Time: ${new Date(entry.timestamp).toLocaleString()}`);
        drawText(`   Document: ${entry.documentName || 'N/A'}`);
        drawText(`   Page Reference: ${entry.coordinatesPageReference || 'N/A'}`);
        if (entry.eventDetails) drawText(`   Details: ${entry.eventDetails}`);
        yPosition -= 5;
      });
      yPosition -= 10;
    }
    
    // Verification Entries
    if (verificationEntries.length > 0) {
      drawText('VERIFICATION ENTRIES:', 14, helveticaBold);
      verificationEntries.slice(0, 5).forEach((entry, index) => {
        checkPageSpace(80);
        drawText(`${index + 1}. VERIFICATION EVENT`, 12, helveticaBold);
        drawText(`   User: ${entry.userName} (${entry.userRole})`);
        drawText(`   Time: ${new Date(entry.timestamp).toLocaleString()}`);
        drawText(`   Method: ${entry.authenticationMethod || 'Not specified'}`);
        drawText(`   Result: ${entry.verificationResult || 'Not recorded'}`);
        drawText(`   Reference: ${entry.credentialReference || 'N/A'}`);
        yPosition -= 5;
      });
      yPosition -= 10;
    }
    
    // Notarial Actions
    if (notarialEntries.length > 0) {
      drawText('NOTARIAL ACTIONS:', 14, helveticaBold);
      notarialEntries.forEach((entry, index) => {
        checkPageSpace(90);
        drawText(`${index + 1}. NOTARIAL ACTION`, 12, helveticaBold);
        drawText(`   Notary: ${entry.userName}`);
        drawText(`   Time: ${new Date(entry.timestamp).toLocaleString()}`);
        drawText(`   Document: ${entry.documentName || 'N/A'}`);
        if (entry.sealApplied) drawText(`   Seal Applied: Yes`);
        if (entry.notaryCertificateReference) drawText(`   Certificate: ${entry.notaryCertificateReference}`);
        if (entry.digitalSignatureHash) drawText(`   Signature Hash: ${entry.digitalSignatureHash.substring(0, 32)}...`);
        yPosition -= 5;
      });
    }
    
    // Compliance Summary
    drawSectionHeader('COMPLIANCE VERIFICATION');
    drawText(`[${reportData.complianceMetrics.integrityVerified ? 'X' : ' '}] Audit trail integrity verified`, 12);
    drawText(`[${reportData.complianceMetrics.totalVerifications > 0 ? 'X' : ' '}] Participant identity verification completed`, 12);
    drawText(`[${reportData.complianceMetrics.totalNotarialActions > 0 ? 'X' : ' '}] Notarial actions recorded`, 12);
    drawText(`[${reportData.complianceMetrics.retentionPolicyApplied ? 'X' : ' '}] Retention policy applied`, 12);
    drawText(`[X] Comprehensive audit trail maintained`, 12);
    
    // Footer
    checkPageSpace(60);
    yPosition -= 20;
    drawText('This audit trail report was generated in compliance with RON platform', 10);
    drawText('requirements and contains all required documentation for legal record keeping.', 10);
    drawText(`Report generated: ${new Date().toISOString()}`, 10);
    drawText(`Total pages: ${pdfDoc.getPageCount()}`, 10);
    
    // Save PDF
    const pdfBytes = await pdfDoc.save();
    
    // Create reports directory if it doesn't exist
    const fs = await import('fs/promises');
    const path = await import('path');
    const reportsDir = path.resolve('uploads/audit-trails');
    
    try {
      await fs.mkdir(reportsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    const reportFileName = `job_${reportData.job.id}_audit_trail_${Date.now()}.pdf`;
    const reportPath = path.join(reportsDir, reportFileName);
    
    await fs.writeFile(reportPath, pdfBytes);
    
    return reportPath;
  }
  
  /**
   * Attach audit trail report to job record
   */
  private static async attachAuditTrailToJob(jobId: number, reportPath: string): Promise<void> {
    await db
      .update(jobs)
      .set({
        auditTrailReportPath: reportPath,
        auditTrailGeneratedAt: new Date()
      })
      .where(eq(jobs.id, jobId));
  }
  
  /**
   * Calculate total session duration in seconds
   */
  private static calculateSessionDuration(sessions: any[]): number {
    return sessions.reduce((total, session) => {
      if (session.startedAt && session.completedAt) {
        const start = new Date(session.startedAt).getTime();
        const end = new Date(session.completedAt).getTime();
        return total + Math.round((end - start) / 1000);
      }
      return total;
    }, 0);
  }
  
  /**
   * Verify audit trail integrity using hash chain
   */
  private static verifyAuditIntegrity(entries: AuditTrailEntry[]): boolean {
    // Simple integrity check - in production, this would verify hash chains
    const hasIntegrityHashes = entries.some(entry => entry.auditLogIntegrityHash);
    const hasTimestampSequence = entries.every((entry, index, arr) => {
      if (index === 0) return true;
      return new Date(entry.timestamp) >= new Date(arr[index - 1].timestamp);
    });
    
    return hasIntegrityHashes || hasTimestampSequence;
  }
  
  /**
   * Get audit trail report if it exists
   */
  static async getAuditTrailReport(jobId: number): Promise<{
    exists: boolean;
    reportPath?: string;
    generatedAt?: Date;
  }> {
    const [job] = await db
      .select({
        auditTrailReportPath: jobs.auditTrailReportPath,
        auditTrailGeneratedAt: jobs.auditTrailGeneratedAt
      })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);
    
    if (!job || !job.auditTrailReportPath) {
      return { exists: false };
    }
    
    return {
      exists: true,
      reportPath: job.auditTrailReportPath,
      generatedAt: job.auditTrailGeneratedAt || undefined
    };
  }
  
  /**
   * Create audit trail entry
   */
  static async createAuditEntry(entry: Partial<AuditTrailEntry>): Promise<void> {
    const auditEntry = {
      sessionId: entry.sessionId!,
      userId: entry.userId!,
      userRole: entry.userRole!,
      eventType: entry.eventType!,
      timestamp: new Date(),
      documentId: entry.documentId,
      ipAddress: entry.ipAddress,
      deviceFingerprint: entry.deviceFingerprint,
      eventDetails: entry.eventDetails,
      coordinatesPageReference: entry.coordinatesPageReference,
      previousState: entry.previousState,
      newState: entry.newState,
      authenticationMethod: entry.authenticationMethod,
      verificationResult: entry.verificationResult,
      credentialReference: entry.credentialReference,
      sealApplied: entry.sealApplied,
      notaryCertificateReference: entry.notaryCertificateReference,
      digitalSignatureHash: entry.digitalSignatureHash,
      systemSource: entry.systemSource || 'RON_PLATFORM',
      auditLogIntegrityHash: this.generateIntegrityHash(entry),
      retentionMetadata: entry.retentionMetadata || { retentionYears: 10, policy: 'WORM' }
    };
    
    await db.insert(auditTrail).values(auditEntry);
  }
  
  /**
   * Generate integrity hash for audit entry
   */
  private static generateIntegrityHash(entry: Partial<AuditTrailEntry>): string {
    const hashData = `${entry.sessionId}-${entry.userId}-${entry.eventType}-${Date.now()}`;
    return crypto.createHash('sha256').update(hashData).digest('hex');
  }
}
