import { db } from '../server/db';
import { jobs, jobDocuments, documentVersions, signers } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Check for documents related to jobs 20 and 21
 */

async function checkJobDocuments() {
  const jobIds = [20, 21, 22];
  
  console.log('📄 Checking documents for jobs:', jobIds);
  
  for (const jobId of jobIds) {
    try {
      console.log(`\n📋 === JOB ${jobId} DOCUMENTS ===`);
      
      // 1. Check job documents table
      const documents = await db
        .select()
        .from(jobDocuments)
        .where(eq(jobDocuments.jobId, jobId));
      
      console.log(`📄 Job documents: ${documents.length} found`);
      documents.forEach(doc => {
        console.log(`  - ${doc.fileName} (${doc.documentType}) - ${doc.filePath}`);
      });
      
      // 2. Check document versions
      const versions = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.originalDocumentId, jobId));
      
      console.log(`📄 Document versions: ${versions.length} found`);
      versions.forEach(version => {
        console.log(`  - ${version.fileName} (${version.status}) - ${version.filePath}`);
      });
      
      // 3. Check signers to see signing status
      const jobSigners = await db
        .select()
        .from(signers)
        .where(eq(signers.jobId, jobId));
      
      console.log(`👥 Signers: ${jobSigners.length} found`);
      jobSigners.forEach(signer => {
        console.log(`  - ${signer.name} (${signer.signingStatus}) - ${signer.email}`);
      });
      
      // 4. Check uploads directory for signed documents
      const uploadsDir = 'uploads';
      const signedDir = join(uploadsDir, 'signed');
      
      try {
        const uploadPaths = [
          uploadsDir,
          signedDir,
          join(uploadsDir, 'job-documents'),
          join(uploadsDir, `job-${jobId}`)
        ];
        
        for (const path of uploadPaths) {
          try {
            const files = readdirSync(path);
            const jobFiles = files.filter(file => 
              file.includes(`job_${jobId}`) || 
              file.includes(`job${jobId}`) ||
              file.includes(`-${jobId}-`) ||
              file.includes(`_${jobId}_`)
            );
            
            if (jobFiles.length > 0) {
              console.log(`📁 Files in ${path}: ${jobFiles.length}`);
              jobFiles.forEach(file => {
                const fullPath = join(path, file);
                const stats = statSync(fullPath);
                console.log(`  - ${file} (${Math.round(stats.size / 1024)}KB) - ${stats.mtime.toISOString()}`);
              });
            }
          } catch (error) {
            // Directory might not exist, continue
          }
        }
      } catch (error) {
        console.log(`📁 Could not check uploads directory: ${error.message}`);
      }
      
      // 5. Check job details for any document references
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
      
      if (job) {
        console.log(`🎯 Job details:`, {
          uploadedFile: job.uploadedFile,
          notarizedFile: job.notarizedFile,
          signedDocumentId: job.signedDocumentId,
          jobStatus: job.jobStatus,
          completedAt: job.completedAt
        });
      }
      
    } catch (error) {
      console.error(`❌ Error checking job ${jobId}:`, error);
    }
  }
  
  console.log('\n✅ Document check completed');
  process.exit(0);
}

// Run the check
checkJobDocuments().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
