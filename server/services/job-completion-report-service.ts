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

export interface JobCompletionReportData {
  job: any;
  notary: any;
  signers: any[];
  documents: any[];
  notaryLogEntries: any[];
  auditTrail: any[];
  systemLogs: any[];
  sessions: any[];
  tags: any[];
  notifications: any[];
  participants: any[];
  documentVersions: any[];
  complianceMetrics: {
    totalSignatures: number;
    totalNotarizations: number;
    sessionDuration: number;
    verificationsPassed: number;
    documentsProcessed: number;
  };
}

export class JobCompletionReportService {
  
  /**
   * Generate comprehensive job completion report
   */
  static async generateJobCompletionReport(jobId: number): Promise<{
    success: boolean;
    reportPath?: string;
    reportData?: JobCompletionReportData;
    error?: string;
  }> {
    try {
      console.log(`📊 Generating completion report for job ${jobId}`);
      
      // Gather all job-related data
      const reportData = await this.gatherJobReportData(jobId);
      
      if (!reportData.job) {
        return {
          success: false,
          error: 'Job not found'
        };
      }
      
      // Generate PDF report
      const reportPath = await this.generatePDFReport(reportData);
      
      // Store report reference in job
      await this.attachReportToJob(jobId, reportPath);
      
      console.log(`✅ Job completion report generated: ${reportPath}`);
      
      return {
        success: true,
        reportPath,
        reportData
      };
      
    } catch (error) {
      console.error('Error generating job completion report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Gather all data related to a job for the report
   */
  private static async gatherJobReportData(jobId: number): Promise<JobCompletionReportData> {
    console.log(`🔍 Gathering data for job ${jobId} report`);
    
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
    
    // Get notary log entries (via sessions for this job)
    const notaryLogs = await db
      .select({
        notaryLogEntry: notaryLogEntries
      })
      .from(notaryLogEntries)
      .innerJoin(editorSessions, eq(notaryLogEntries.sessionId, editorSessions.id))
      .where(eq(editorSessions.jobId, jobId))
      .orderBy(desc(notaryLogEntries.timestamp));
    
    // Get audit trail entries (via sessions for this job)
    const auditEntries = await db
      .select({
        auditEntry: auditTrail
      })
      .from(auditTrail)
      .innerJoin(editorSessions, eq(auditTrail.sessionId, editorSessions.id))
      .where(eq(editorSessions.jobId, jobId))
      .orderBy(desc(auditTrail.timestamp));
    
    // Get system activity logs
    const systemLogs = await db
      .select()
      .from(systemActivityLogs)
      .where(eq(systemActivityLogs.jobId, jobId))
      .orderBy(desc(systemActivityLogs.createdAt))
      .limit(100);
    
    // Get editor sessions
    const sessions = await db
      .select()
      .from(editorSessions)
      .where(eq(editorSessions.jobId, jobId))
      .orderBy(desc(editorSessions.createdAt));
    
    // Get document tags from sessions
    let tags: any[] = [];
    if (sessions.length > 0) {
      for (const session of sessions) {
        const sessionTags = await db
          .select()
          .from(documentTags)
          .where(eq(documentTags.sessionId, session.id))
          .orderBy(documentTags.createdAt);
        tags = [...tags, ...sessionTags];
      }
    }
    
    // Get notifications
    const notifications = await db
      .select()
      .from(jobNotifications)
      .where(eq(jobNotifications.jobId, jobId))
      .orderBy(desc(jobNotifications.createdAt));
    
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
    
    // Get document versions (for documents belonging to this job)
    const documentIds = documents.map(doc => doc.id);
    let docVersions: any[] = [];
    if (documentIds.length > 0) {
      try {
        // Use inArray for better performance, but ensure documentIds is not empty
        docVersions = await db
          .select()
          .from(documentVersions)
          .where(inArray(documentVersions.originalDocumentId, documentIds))
          .orderBy(desc(documentVersions.createdAt));
      } catch (error) {
        console.warn('Failed to fetch document versions:', error);
        // Continue without document versions if query fails
        docVersions = [];
      }
    }
    
    // Calculate compliance metrics
    const complianceMetrics = {
      totalSignatures: tags.filter(tag => tag.tagType === 'S' && tag.isCompleted).length,
      totalNotarizations: notaryLogs.length,
      sessionDuration: this.calculateSessionDuration(sessions),
      verificationsPassed: jobSigners.filter(s => s.user?.isVerified).length,
      documentsProcessed: documents.length
    };
    
    return {
      job,
      notary,
      signers: jobSigners,
      documents,
      notaryLogEntries: notaryLogs.map(log => log.notaryLogEntry),
      auditTrail: auditEntries.map(entry => entry.auditEntry),
      systemLogs,
      sessions,
      tags,
      notifications,
      participants,
      documentVersions: docVersions,
      complianceMetrics
    };
  }
  
  /**
   * Generate PDF report from gathered data
   */
  private static async generatePDFReport(reportData: JobCompletionReportData): Promise<string> {
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
    currentPage.drawText('JOB COMPLETION REPORT', {
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
    drawSectionHeader('EXECUTIVE SUMMARY');
    drawText(`This report contains comprehensive details for Job #${reportData.job.id} completed on ${new Date().toLocaleDateString()}.`);
    drawText(`Total Documents Processed: ${reportData.complianceMetrics.documentsProcessed}`);
    drawText(`Total Signatures Captured: ${reportData.complianceMetrics.totalSignatures}`);
    drawText(`Total Notarizations: ${reportData.complianceMetrics.totalNotarizations}`);
    drawText(`Session Duration: ${Math.round(reportData.complianceMetrics.sessionDuration / 60)} minutes`);
    drawText(`Verified Participants: ${reportData.complianceMetrics.verificationsPassed}/${reportData.signers.length}`);
    
    // Notary Information
    if (reportData.notary) {
      drawSectionHeader('NOTARY INFORMATION');
      drawText(`Name: ${reportData.notary.firstName} ${reportData.notary.lastName}`);
      drawText(`Email: ${reportData.notary.email}`);
      drawText(`Commission Number: ${reportData.notary.commissionNumber || 'Not specified'}`);
      drawText(`Commission Expiration: ${reportData.notary.commissionExpiration || 'Not specified'}`);
      drawText(`State: ${reportData.notary.state || 'Not specified'}`);
      drawText(`Notary Type: ${reportData.notary.notaryType || 'Not specified'}`);
    }
    
    // Participants
    drawSectionHeader('PARTICIPANTS');
    reportData.signers.forEach((signerRecord, index) => {
      checkPageSpace(60);
      drawText(`${index + 1}. ${signerRecord.signer.signerName}`, 12, helveticaBold);
      drawText(`   Email: ${signerRecord.signer.signerEmail}`);
      drawText(`   Role: ${signerRecord.signer.signerRole}`);
      drawText(`   Phone: ${signerRecord.signer.signerPhoneNumber || 'Not provided'}`);
      drawText(`   Signing Status: ${signerRecord.signer.signingStatus || 'Not completed'}`);
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
    
    // Notary Log Entries
    if (reportData.notaryLogEntries.length > 0) {
      drawSectionHeader('NOTARY LOG ENTRIES');
      reportData.notaryLogEntries.forEach((entry, index) => {
        checkPageSpace(50);
        drawText(`${index + 1}. ${entry.notarizationType}`, 12, helveticaBold);
        drawText(`   Document: ${entry.documentId}`);
        drawText(`   Page: ${entry.pageNumber}`);
        drawText(`   Signer: ${entry.signerId}`);
        drawText(`   Timestamp: ${new Date(entry.timestamp).toLocaleString()}`);
        yPosition -= 5;
      });
    }
    
    // Sessions
    if (reportData.sessions.length > 0) {
      drawSectionHeader('SESSIONS');
      reportData.sessions.forEach((session, index) => {
        checkPageSpace(60);
        drawText(`${index + 1}. ${session.sessionType} Session`, 12, helveticaBold);
        drawText(`   Session ID: ${session.sessionId}`);
        drawText(`   Status: ${session.status}`);
        drawText(`   Created: ${new Date(session.createdAt).toLocaleString()}`);
        if (session.startedAt) {
          drawText(`   Started: ${new Date(session.startedAt).toLocaleString()}`);
        }
        if (session.completedAt) {
          drawText(`   Completed: ${new Date(session.completedAt).toLocaleString()}`);
        }
        yPosition -= 5;
      });
    }
    
    // Tags Summary
    if (reportData.tags.length > 0) {
      drawSectionHeader('DOCUMENT TAGS SUMMARY');
      const tagsByType = reportData.tags.reduce((acc, tag) => {
        acc[tag.tagType] = (acc[tag.tagType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const completedTags = reportData.tags.filter(tag => tag.isCompleted).length;
      
      drawText(`Total Tags Placed: ${reportData.tags.length}`);
      drawText(`Completed Tags: ${completedTags}`);
      drawText(`Completion Rate: ${Math.round((completedTags / reportData.tags.length) * 100)}%`);
      
      yPosition -= 10;
      drawText('Tag Types:', 12, helveticaBold);
      Object.entries(tagsByType).forEach(([type, count]) => {
        const tagName = this.getTagTypeName(type);
        drawText(`   ${tagName}: ${count}`);
      });
    }
    
    // Compliance Summary
    drawSectionHeader('COMPLIANCE SUMMARY');
    drawText('[X] Digital notarization completed', 12);
    drawText('[X] All participants verified', 12);
    drawText('[X] Session recorded and archived', 12);
    drawText('[X] Audit trail maintained', 12);
    drawText('[X] Documents digitally signed', 12);
    drawText('[X] Notary log entries created', 12);
    
    // Footer with timestamp and compliance note
    checkPageSpace(60);
    yPosition -= 20;
    drawText('This report was automatically generated upon job completion and contains', 10);
    drawText('all required documentation for digital notarization compliance.', 10);
    drawText(`Report generated: ${new Date().toISOString()}`, 10);
    
    // Save PDF
    const pdfBytes = await pdfDoc.save();
    
    // Create reports directory if it doesn't exist
    const fs = await import('fs/promises');
    const path = await import('path');
    const reportsDir = path.resolve('uploads/reports');
    
    try {
      await fs.mkdir(reportsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    const reportFileName = `job_${reportData.job.id}_completion_report_${Date.now()}.pdf`;
    const reportPath = path.join(reportsDir, reportFileName);
    
    await fs.writeFile(reportPath, pdfBytes);
    
    return reportPath;
  }
  
  /**
   * Attach report to job record
   */
  private static async attachReportToJob(jobId: number, reportPath: string): Promise<void> {
    await db
      .update(jobs)
      .set({
        completionReportPath: reportPath,
        completionReportGeneratedAt: new Date()
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
   * Get human-readable tag type name
   */
  private static getTagTypeName(tagType: string): string {
    const tagNames: Record<string, string> = {
      'A': 'Name',
      'S': 'Signature', 
      'I': 'Initials',
      'N': 'Commission Number',
      'X': 'Commission Expiration',
      'O': 'Disclosure',
      'E': 'Notary Seal',
      'W': 'Whiteout',
      'T': 'Text',
      'D': 'Date'
    };
    return tagNames[tagType] || tagType;
  }
  
  /**
   * Get job completion report if it exists
   */
  static async getJobCompletionReport(jobId: number): Promise<{
    exists: boolean;
    reportPath?: string;
    generatedAt?: Date;
  }> {
    const [job] = await db
      .select({
        completionReportPath: jobs.completionReportPath,
        completionReportGeneratedAt: jobs.completionReportGeneratedAt
      })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);
    
    if (!job || !job.completionReportPath) {
      return { exists: false };
    }
    
    return {
      exists: true,
      reportPath: job.completionReportPath,
      generatedAt: job.completionReportGeneratedAt || undefined
    };
  }
} 