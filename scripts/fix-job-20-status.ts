import { db } from '../server/db';
import { jobs } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Fix Job 20 which has a completion report but wrong status
 */

async function fixJob20Status() {
  console.log('🔧 Fixing Job 20 status...');
  
  try {
    // Update job 20 status to completed since it has a completion report
    const [updatedJob] = await db
      .update(jobs)
      .set({
        jobStatus: 'completed',
        completedAt: new Date()
      })
      .where(eq(jobs.id, 20))
      .returning();
    
    console.log('✅ Job 20 status updated:', {
      id: updatedJob.id,
      jobStatus: updatedJob.jobStatus,
      completedAt: updatedJob.completedAt
    });
    
    // Invalidate cache again for job 20
    const { CacheManager } = await import('../server/services/cache-manager');
    await CacheManager.invalidateJobCaches(20);
    console.log('🧹 Cache invalidated for job 20');
    
    // Also clear specific cache patterns
    const { redisCache } = await import('../server/services/redis-cache');
    const cachePatterns = [
      `job:20:*`,
      `*jobs*20*`,
      `response:*/api/jobs/20*`,
      `*completion-report*20*`,
      `*document*20*`
    ];
    
    for (const pattern of cachePatterns) {
      const deleted = await redisCache.delPattern(pattern);
      if (deleted > 0) {
        console.log(`🧹 Deleted ${deleted} cache keys matching: ${pattern}`);
      }
    }
    
    console.log('✅ Job 20 fix completed successfully');
    
  } catch (error) {
    console.error('❌ Error fixing job 20:', error);
  }
  
  process.exit(0);
}

// Run the fix
fixJob20Status().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
