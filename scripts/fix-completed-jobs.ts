import { db } from '../server/db';
import { jobs } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Fix already completed jobs that aren't showing completion status properly
 * This script:
 * 1. Checks job status in database
 * 2. Invalidates job caches 
 * 3. Generates missing completion reports
 * 4. Verifies document access
 */

async function fixCompletedJobs() {
  const jobIds = [20, 21]; // Jobs reported as having issues
  
  console.log('🔧 Starting fix for completed jobs:', jobIds);
  
  for (const jobId of jobIds) {
    try {
      console.log(`\n📋 Checking job ${jobId}...`);
      
      // 1. Check current job status in database
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
      
      if (!job) {
        console.log(`❌ Job ${jobId} not found in database`);
        continue;
      }
      
      console.log(`📊 Job ${jobId} status:`, {
        jobStatus: job.jobStatus,
        completedAt: job.completedAt,
        completionReportPath: job.completionReportPath,
        completionReportGeneratedAt: job.completionReportGeneratedAt
      });
      
      // 2. Invalidate all caches for this job
      console.log(`🧹 Invalidating caches for job ${jobId}...`);
      const { CacheManager } = await import('../server/services/cache-manager');
      await CacheManager.invalidateJobCaches(jobId);
      console.log(`✅ Cache invalidated for job ${jobId}`);
      
      // 3. Generate completion report if missing
      if (job.jobStatus === 'completed' && !job.completionReportPath) {
        console.log(`📊 Generating missing completion report for job ${jobId}...`);
        
        const { JobCompletionReportService } = await import('../server/services/job-completion-report-service');
        const reportResult = await JobCompletionReportService.generateJobCompletionReport(jobId);
        
        if (reportResult.success) {
          console.log(`✅ Completion report generated: ${reportResult.reportPath}`);
        } else {
          console.log(`❌ Failed to generate completion report: ${reportResult.error}`);
        }
      } else if (job.completionReportPath) {
        console.log(`✅ Completion report already exists: ${job.completionReportPath}`);
      }
      
      // 4. Check for completed documents
      console.log(`📄 Checking completed documents for job ${jobId}...`);
      
      // Check document versions table
      const { documentVersions } = await import('../shared/schema');
      const docs = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.originalDocumentId, jobId));
      
      console.log(`📄 Found ${docs.length} document versions for job ${jobId}`);
      docs.forEach(doc => {
        console.log(`  - ${doc.fileName} (${doc.status}) - ${doc.filePath}`);
      });
      
      // 5. Invalidate specific cache patterns that might be holding stale data
      const { redisCache } = await import('../server/services/redis-cache');
      const cachePatterns = [
        `job:${jobId}:*`,
        `*jobs*${jobId}*`,
        `response:*/api/jobs/${jobId}*`,
        `*completion-report*${jobId}*`,
        `*document*${jobId}*`
      ];
      
      for (const pattern of cachePatterns) {
        const deleted = await redisCache.delPattern(pattern);
        if (deleted > 0) {
          console.log(`🧹 Deleted ${deleted} cache keys matching: ${pattern}`);
        }
      }
      
      console.log(`✅ Job ${jobId} fix completed`);
      
    } catch (error) {
      console.error(`❌ Error fixing job ${jobId}:`, error);
    }
  }
  
  console.log('\n🎉 Completed job fix script');
  process.exit(0);
}

// Run the fix
fixCompletedJobs().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
