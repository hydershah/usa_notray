import { redisCache } from './redis-cache';

/**
 * Centralized Cache Management Service
 * Provides consistent cache invalidation patterns across the application
 */
export class CacheManager {
  
  /**
   * Invalidate all job-related caches
   */
  static async invalidateJobCaches(jobId?: number, notaryId?: number, creatorId?: number): Promise<void> {
    try {
      const patterns = [
        '*jobs*',           // All job caches
        'api:*jobs*',       // API job caches
        'admin:*jobs*',     // Admin job caches
      ];

      if (notaryId) {
        patterns.push(`user:${notaryId}:*`);
      }
      
      if (creatorId) {
        patterns.push(`user:${creatorId}:*`);
      }

      if (jobId) {
        patterns.push(`job:${jobId}:*`);
      }

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await redisCache.delPattern(pattern);
        totalDeleted += deleted;
        console.log(`🧹 Cache: ${pattern} → ${deleted} keys deleted`);
      }

      console.log(`🧹 ✅ Job cache invalidation completed: ${totalDeleted} total keys deleted`);
    } catch (error) {
      console.error('❌ Failed to invalidate job caches:', error);
      throw error;
    }
  }

  /**
   * Invalidate all user-related caches
   */
  static async invalidateUserCaches(userId?: number): Promise<void> {
    try {
      const patterns = [
        '*users*',          // All user caches
        'api:*users*',      // API user caches
        'admin:*users*',    // Admin user caches
      ];

      if (userId) {
        patterns.push(`user:${userId}:*`);
      }

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await redisCache.delPattern(pattern);
        totalDeleted += deleted;
        console.log(`🧹 Cache: ${pattern} → ${deleted} keys deleted`);
      }

      console.log(`🧹 ✅ User cache invalidation completed: ${totalDeleted} total keys deleted`);
    } catch (error) {
      console.error('❌ Failed to invalidate user caches:', error);
      throw error;
    }
  }

  /**
   * Invalidate all company-related caches
   */
  static async invalidateCompanyCaches(companyId?: number): Promise<void> {
    try {
      const patterns = [
        '*companies*',      // All company caches
        'api:*companies*',  // API company caches
        'admin:*companies*', // Admin company caches
        'company:*',        // Company-specific caches
      ];

      if (companyId) {
        patterns.push(`company:${companyId}:*`);
      }

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await redisCache.delPattern(pattern);
        totalDeleted += deleted;
        console.log(`🧹 Cache: ${pattern} → ${deleted} keys deleted`);
      }

      console.log(`🧹 ✅ Company cache invalidation completed: ${totalDeleted} total keys deleted`);
    } catch (error) {
      console.error('❌ Failed to invalidate company caches:', error);
      throw error;
    }
  }

  /**
   * Invalidate all session-related caches
   */
  static async invalidateSessionCaches(sessionId: string): Promise<void> {
    try {
      const patterns = [
        `session:${sessionId}:*`,
        `session:*:participants`,
        '*session*',
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await redisCache.delPattern(pattern);
        totalDeleted += deleted;
        console.log(`🧹 Cache: ${pattern} → ${deleted} keys deleted`);
      }

      console.log(`🧹 ✅ Session cache invalidation completed: ${totalDeleted} total keys deleted`);
    } catch (error) {
      console.error('❌ Failed to invalidate session caches:', error);
      throw error;
    }
  }

  /**
   * Invalidate all admin dashboard caches
   */
  static async invalidateAdminCaches(): Promise<void> {
    try {
      const patterns = [
        'admin:*',          // All admin caches
        'api:*dashboard*',  // Dashboard API caches
        'api:*stats*',      // Statistics caches
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await redisCache.delPattern(pattern);
        totalDeleted += deleted;
        console.log(`🧹 Cache: ${pattern} → ${deleted} keys deleted`);
      }

      console.log(`🧹 ✅ Admin cache invalidation completed: ${totalDeleted} total keys deleted`);
    } catch (error) {
      console.error('❌ Failed to invalidate admin caches:', error);
      throw error;
    }
  }

  /**
   * Nuclear option: Clear all caches
   */
  static async invalidateAllCaches(): Promise<void> {
    try {
      const deleted = await redisCache.delPattern('*');
      console.log(`🧹 💥 NUCLEAR: Cleared ALL cache keys (${deleted} total)`);
    } catch (error) {
      console.error('❌ Failed to clear all caches:', error);
      throw error;
    }
  }

  /**
   * Safe cache invalidation with error handling
   */
  static async safeInvalidate(
    operation: () => Promise<void>, 
    operationName: string
  ): Promise<void> {
    try {
      await operation();
    } catch (error) {
      console.error(`❌ Cache invalidation failed for ${operationName}:`, error);
      // Don't throw - cache failures shouldn't break the main operation
    }
  }

  /**
   * Batch invalidation for multiple related operations
   */
  static async batchInvalidate(operations: Array<{
    name: string;
    operation: () => Promise<void>;
  }>): Promise<void> {
    const results = await Promise.allSettled(
      operations.map(({ operation, name }) => 
        operation().catch(error => {
          console.error(`❌ Cache invalidation failed for ${name}:`, error);
          throw error;
        })
      )
    );

    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`⚠️ ${failures.length}/${operations.length} cache invalidations failed`);
    } else {
      console.log(`🧹 ✅ All ${operations.length} cache invalidations completed successfully`);
    }
  }
}

/**
 * Convenience functions for common cache invalidation patterns
 */
export const cacheInvalidation = {
  
  // Job-related
  onJobCreated: (jobId: number, notaryId?: number, creatorId?: number) =>
    CacheManager.safeInvalidate(
      () => CacheManager.invalidateJobCaches(jobId, notaryId, creatorId),
      `job_created_${jobId}`
    ),

  onJobUpdated: (jobId: number, notaryId?: number, creatorId?: number) =>
    CacheManager.safeInvalidate(
      () => CacheManager.invalidateJobCaches(jobId, notaryId, creatorId),
      `job_updated_${jobId}`
    ),

  onJobDeleted: (jobId: number) =>
    CacheManager.safeInvalidate(
      () => CacheManager.invalidateJobCaches(jobId),
      `job_deleted_${jobId}`
    ),

  // User-related
  onUserCreated: (userId: number) =>
    CacheManager.safeInvalidate(
      () => CacheManager.invalidateUserCaches(userId),
      `user_created_${userId}`
    ),

  onUserUpdated: (userId: number) =>
    CacheManager.safeInvalidate(
      () => CacheManager.invalidateUserCaches(userId),
      `user_updated_${userId}`
    ),

  onUserDeleted: (userId: number) =>
    CacheManager.safeInvalidate(
      () => CacheManager.invalidateUserCaches(userId),
      `user_deleted_${userId}`
    ),

  // Company-related
  onCompanyCreated: (companyId: number) =>
    CacheManager.safeInvalidate(
      () => CacheManager.invalidateCompanyCaches(companyId),
      `company_created_${companyId}`
    ),

  onCompanyUpdated: (companyId: number) =>
    CacheManager.safeInvalidate(
      () => CacheManager.invalidateCompanyCaches(companyId),
      `company_updated_${companyId}`
    ),

  onCompanyDeleted: (companyId: number) =>
    CacheManager.safeInvalidate(
      () => CacheManager.invalidateCompanyCaches(companyId),
      `company_deleted_${companyId}`
    ),

  // Session-related  
  onSessionStateChanged: (sessionId: string) =>
    CacheManager.safeInvalidate(
      () => CacheManager.invalidateSessionCaches(sessionId),
      `session_changed_${sessionId}`
    ),

  // Admin operations
  onAdminOperation: () =>
    CacheManager.safeInvalidate(
      () => CacheManager.invalidateAdminCaches(),
      'admin_operation'
    ),
}; 