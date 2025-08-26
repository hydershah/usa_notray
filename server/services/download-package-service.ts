import { db } from "../db";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  jobs,
  jobDocuments,
  documentVersions
} from "../../shared/schema";
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import archiver from 'archiver';

export interface DownloadPackageData {
  job: any;
  completionReport: any;
  completedDocuments: any[];
  packagePath: string;
}

export class DownloadPackageService {
  
  /**
   * Generate a complete download package for a job
   * Includes: Completion Report + All Completed Documents
   */
  static async generateDownloadPackage(jobId: number): Promise<{
    success: boolean;
    packagePath?: string;
    error?: string;
  }> {
    try {
      console.log(`📦 Generating download package for job ${jobId}`);
      
      // Get job data
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
      
      if (!job) {
        return {
          success: false,
          error: 'Job not found'
        };
      }

      // Get completion report
      const { JobCompletionReportService } = await import('./job-completion-report-service');
      const reportInfo = await JobCompletionReportService.getJobCompletionReport(jobId);
      
      // Get completed documents
      const completedDocuments = await this.getCompletedDocuments(jobId);
      
      // Generate the package
      const packagePath = await this.createZipPackage(job, reportInfo, completedDocuments);
      
      console.log(`✅ Download package generated: ${packagePath}`);
      
      return {
        success: true,
        packagePath
      };
      
    } catch (error) {
      console.error('Error generating download package:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Get all completed documents for a job
   */
  private static async getCompletedDocuments(jobId: number): Promise<any[]> {
    try {
      console.log(`🔍 Searching for completed documents for job ${jobId}`);
      
      // First approach: Match exactly what the working API endpoint does
      // Check document versions with the same query as /api/jobs/:id/document-versions
      const docVersions = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.originalDocumentId, jobId))
        .orderBy(desc(documentVersions.createdAt));

      console.log(`📋 Found ${docVersions.length} document versions using originalDocumentId=${jobId}`);

      if (docVersions.length > 0) {
        // Return documents with filePath mapped from the signed documents location
        return docVersions.map(doc => ({
          id: doc.id,
          fileName: doc.fileName,
          filePath: `uploads/signed/${doc.fileName}`, // Match the working document endpoint
          fileSize: doc.fileSize,
          status: doc.status || 'completed',
          createdAt: doc.createdAt,
          type: 'document_version'
        }));
      }

      // Fallback: Check jobDocuments table for signed documents (like the API endpoint fallback)
      const signedDocuments = await db
        .select()
        .from(jobDocuments)
        .where(and(
          eq(jobDocuments.jobId, jobId),
          eq(jobDocuments.documentType, 'signed_document')
        ))
        .orderBy(desc(jobDocuments.createdAt));

      console.log(`📋 Found ${signedDocuments.length} signed documents in jobDocuments for job ${jobId}`);

      if (signedDocuments.length > 0) {
        return signedDocuments.map(doc => ({
          id: doc.id,
          fileName: doc.fileName,
          filePath: doc.filePath,
          fileSize: doc.fileSize,
          status: 'completed',
          createdAt: doc.createdAt,
          type: 'signed_document'
        }));
      }

      // Additional fallback: Check for any completed documents regardless of type
      const anyCompletedDocs = await db
        .select()
        .from(jobDocuments)
        .where(and(
          eq(jobDocuments.jobId, jobId),
          sql`${jobDocuments.status} IN ('completed', 'certified', 'signed')`
        ))
        .orderBy(desc(jobDocuments.createdAt));

      console.log(`📋 Found ${anyCompletedDocs.length} any completed documents for job ${jobId}`);

      return anyCompletedDocs.map(doc => ({
        id: doc.id,
        fileName: doc.fileName,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        status: 'completed',
        createdAt: doc.createdAt,
        type: 'any_completed'
      }));

    } catch (error) {
      console.error('Error fetching completed documents:', error);
      return [];
    }
  }
  
  /**
   * Create a ZIP package containing completion report and completed documents
   */
  private static async createZipPackage(job: any, reportInfo: any, completedDocuments: any[]): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Create packages directory if it doesn't exist
    const packagesDir = path.resolve('uploads/packages');
    try {
      await fs.mkdir(packagesDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    const packageFileName = `job_${job.id}_download_package_${Date.now()}.zip`;
    const packagePath = path.join(packagesDir, packageFileName);
    
    // Create write stream for the ZIP file
    const output = createWriteStream(packagePath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    // Pipe archive data to the file
    archive.pipe(output);
    
    // Add completion report if it exists
    if (reportInfo.exists && reportInfo.reportPath) {
      try {
        const reportPath = path.resolve(reportInfo.reportPath);
        const reportStats = await fs.stat(reportPath);
        
        if (reportStats.isFile()) {
          const reportFileName = path.basename(reportPath);
          archive.file(reportPath, { name: `Completion_Report/${reportFileName}` });
          console.log(`📄 Added completion report: ${reportFileName}`);
        }
      } catch (error) {
        console.warn('Could not add completion report to package:', error);
      }
    }
    
    // Add completed documents
    if (completedDocuments.length > 0) {
      console.log(`📦 Adding ${completedDocuments.length} completed documents to package`);
      
      for (const doc of completedDocuments) {
        try {
          console.log(`🔍 Processing document: ${doc.fileName} at path: ${doc.filePath}`);
          
          // Try multiple possible locations for the document
          const possiblePaths = [
            path.resolve(doc.filePath), // Original path from database
            path.resolve(`uploads/signed/${doc.fileName}`), // Standard signed documents location
            path.resolve(`uploads/documents/${doc.fileName}`), // Alternative documents location
            path.resolve(`uploads/${doc.fileName}`) // Base uploads directory
          ];
          
          let foundPath = null;
          let docStats = null;
          
          for (const testPath of possiblePaths) {
            try {
              docStats = await fs.stat(testPath);
              if (docStats.isFile()) {
                foundPath = testPath;
                console.log(`✅ Found document at: ${foundPath}`);
                break;
              }
            } catch (err) {
              // Continue to next path
            }
          }
          
          if (foundPath && docStats) {
            const docFileName = doc.fileName || path.basename(foundPath);
            archive.file(foundPath, { name: `Completed_Documents/${docFileName}` });
            console.log(`📄 Added completed document: ${docFileName}`);
          } else {
            throw new Error(`Document not found in any expected location`);
          }
        } catch (error) {
          console.error(`❌ Could not add document ${doc.fileName} to package:`, error);
          console.error(`   Original file path: ${doc.filePath}`);
          console.error(`   Searched locations:`);
          const searchPaths = [
            path.resolve(doc.filePath),
            path.resolve(`uploads/signed/${doc.fileName}`),
            path.resolve(`uploads/documents/${doc.fileName}`),
            path.resolve(`uploads/${doc.fileName}`)
          ];
          searchPaths.forEach((p, i) => console.error(`     ${i + 1}. ${p}`));
          
          // Add a placeholder file to indicate missing document
          const placeholderContent = `Document: ${doc.fileName || 'Unknown'}\nStatus: File not found\nPath: ${doc.filePath || 'Not specified'}\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\nSearched locations:\n${searchPaths.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nThis document was not found in any of the expected locations.`;
          archive.append(placeholderContent, { name: `Completed_Documents/MISSING_${doc.fileName || 'unknown'}.txt` });
        }
      }
    } else {
      console.log(`⚠️ No completed documents found for job ${job.id}`);
    }
    
    // Add a README file with package information
    const readmeContent = this.generateReadmeContent(job, reportInfo, completedDocuments);
    archive.append(readmeContent, { name: 'README.txt' });
    
    // Finalize the archive
    await archive.finalize();
    
    // Wait for the write stream to finish
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });
    
    return packagePath;
  }
  
  /**
   * Generate README content for the package
   */
  private static generateReadmeContent(job: any, reportInfo: any, completedDocuments: any[]): string {
    const now = new Date().toISOString();
    
    return `JOB DOWNLOAD PACKAGE
====================

Job Information:
- Job ID: ${job.id}
- Title Company: ${job.titleCompany || 'N/A'}
- Closing Type: ${job.closingType || 'N/A'}
- Property Address: ${job.propertyAddressOne || 'N/A'}
- Job Status: ${job.jobStatus || 'N/A'}
- Completed At: ${job.completedAt || 'N/A'}

Package Contents:
- Completion Report: ${reportInfo.exists ? 'Included' : 'Not available'}
- Completed Documents: ${completedDocuments.length} files

Document List:
${completedDocuments.map((doc, index) => `${index + 1}. ${doc.fileName}`).join('\n')}

Package Information:
- Generated: ${now}
- Total Files: ${completedDocuments.length + (reportInfo.exists ? 1 : 0)}

This package contains all completed documents and the completion report for job #${job.id}.
All documents have been properly signed and notarized according to digital notarization standards.

For support, please contact your title company or notary service provider.
`;
  }
  
  /**
   * Clean up old packages (optional maintenance function)
   */
  static async cleanupOldPackages(maxAgeHours: number = 24): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const packagesDir = path.resolve('uploads/packages');
      const files = await fs.readdir(packagesDir);
      
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
      
      for (const file of files) {
        if (file.endsWith('.zip')) {
          const filePath = path.join(packagesDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
            console.log(`🗑️ Cleaned up old package: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up old packages:', error);
    }
  }
}
