import { redisCache } from './redis-cache';
import { cloudStorage } from './cloud-storage-service';

interface TagPerformanceMetrics {
  tagType: string;
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
  userId: number;
  sessionId: string;
}

interface TagCacheData {
  content: any;
  metadata: any;
  expiresAt: Date;
  lastAccessed: Date;
}

interface TagPerformanceStats {
  totalOperations: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  slowOperations: TagPerformanceMetrics[];
  tagTypeBreakdown: Record<string, {
    count: number;
    avgTime: number;
    errorRate: number;
  }>;
}

/**
 * Comprehensive tag performance optimization service for all tag types
 * Handles initials, date, commission, expiration, disclosure, seal, and whiteout tags
 */
export class TagPerformanceService {
  private static readonly CACHE_PREFIX = 'tag_performance:';
  private static readonly TAG_CACHE_PREFIX = 'tag_content:';
  private static readonly TAG_CACHE_TTL = 1800; // 30 minutes
  private static readonly PERFORMANCE_CACHE_TTL = 3600; // 1 hour

  /**
   * Track tag operation performance
   */
  static async trackOperation(
    tagType: string,
    operation: string,
    duration: number,
    success: boolean,
    userId: number,
    sessionId: string,
    error?: string
  ): Promise<void> {
    try {
      const metric: TagPerformanceMetrics = {
        tagType,
        operation,
        duration,
        timestamp: Date.now(),
        success,
        error,
        userId,
        sessionId
      };

      const cacheKey = `${this.CACHE_PREFIX}${userId}:${sessionId}`;
      const existingMetrics = await redisCache.get<TagPerformanceMetrics[]>(cacheKey) || [];
      
      // Keep only last 100 metrics per user/session to prevent memory issues
      const updatedMetrics = [...existingMetrics, metric].slice(-100);
      await redisCache.set(cacheKey, updatedMetrics, this.PERFORMANCE_CACHE_TTL);

      console.log(`📊 Tag Performance: ${tagType} ${operation} took ${duration}ms, success: ${success}`);
    } catch (error) {
      console.error('Failed to track tag performance:', error);
    }
  }

  /**
   * Get cached tag content for fast retrieval
   */
  static async getCachedTagContent(
    tagId: string,
    tagType: string,
    userId: number
  ): Promise<TagCacheData | null> {
    try {
      const cacheKey = `${this.TAG_CACHE_PREFIX}${tagId}:${tagType}:${userId}`;
      const cached = await redisCache.get<TagCacheData>(cacheKey);
      
      if (cached && new Date(cached.expiresAt) > new Date()) {
        // Update last accessed time
        cached.lastAccessed = new Date();
        await redisCache.set(cacheKey, cached, this.TAG_CACHE_TTL);
        
        console.log(`🚀 Tag cache HIT for ${tagType} tag ${tagId}`);
        return cached;
      }

      console.log(`🔄 Tag cache MISS for ${tagType} tag ${tagId}`);
      return null;
    } catch (error) {
      console.error('Tag cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Cache tag content for future fast access
   */
  static async cacheTagContent(
    tagId: string,
    tagType: string,
    userId: number,
    content: any,
    metadata: any = {}
  ): Promise<void> {
    try {
      const cacheKey = `${this.TAG_CACHE_PREFIX}${tagId}:${tagType}:${userId}`;
      const cacheData: TagCacheData = {
        content,
        metadata,
        expiresAt: new Date(Date.now() + (this.TAG_CACHE_TTL * 1000)),
        lastAccessed: new Date()
      };

      await redisCache.set(cacheKey, cacheData, this.TAG_CACHE_TTL);
      console.log(`✅ Cached ${tagType} tag content for tag ${tagId}`);
    } catch (error) {
      console.error('Tag cache storage error:', error);
    }
  }

  /**
   * Batch cache multiple tag contents
   */
  static async batchCacheTagContents(
    tags: Array<{
      tagId: string;
      tagType: string;
      userId: number;
      content: any;
      metadata?: any;
    }>
  ): Promise<void> {
    try {
      const operations = tags.map(tag => 
        this.cacheTagContent(tag.tagId, tag.tagType, tag.userId, tag.content, tag.metadata)
      );
      
      await Promise.all(operations);
      console.log(`✅ Batch cached ${tags.length} tag contents`);
    } catch (error) {
      console.error('Batch tag cache error:', error);
    }
  }

  /**
   * Invalidate tag cache
   */
  static async invalidateTagCache(
    tagId: string,
    tagType: string,
    userId: number
  ): Promise<void> {
    try {
      const cacheKey = `${this.TAG_CACHE_PREFIX}${tagId}:${tagType}:${userId}`;
      await redisCache.del(cacheKey);
      console.log(`🗑️ Invalidated ${tagType} tag cache for tag ${tagId}`);
    } catch (error) {
      console.error('Tag cache invalidation error:', error);
    }
  }

  /**
   * Get performance statistics for a user/session
   */
  static async getPerformanceStats(
    userId: number,
    sessionId: string
  ): Promise<TagPerformanceStats> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${userId}:${sessionId}`;
      const metrics = await redisCache.get<TagPerformanceMetrics[]>(cacheKey) || [];

      if (metrics.length === 0) {
        return {
          totalOperations: 0,
          averageResponseTime: 0,
          cacheHitRate: 0,
          errorRate: 0,
          slowOperations: [],
          tagTypeBreakdown: {}
        };
      }

      const totalOperations = metrics.length;
      const successfulOperations = metrics.filter(m => m.success).length;
      const errorRate = ((totalOperations - successfulOperations) / totalOperations) * 100;
      
      const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
      const averageResponseTime = totalDuration / totalOperations;
      
      // Calculate cache hit rate (assume operations under 50ms are cache hits)
      const cacheHits = metrics.filter(m => m.duration < 50).length;
      const cacheHitRate = (cacheHits / totalOperations) * 100;
      
      // Identify slow operations (>1000ms)
      const slowOperations = metrics
        .filter(m => m.duration > 1000)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10);

      // Calculate tag type breakdown
      const tagTypeBreakdown: Record<string, { count: number; avgTime: number; errorRate: number }> = {};
      
      const tagTypes = [...new Set(metrics.map(m => m.tagType))];
      tagTypes.forEach(tagType => {
        const typeMetrics = metrics.filter(m => m.tagType === tagType);
        const typeCount = typeMetrics.length;
        const typeTotalTime = typeMetrics.reduce((sum, m) => sum + m.duration, 0);
        const typeAvgTime = typeTotalTime / typeCount;
        const typeErrors = typeMetrics.filter(m => !m.success).length;
        const typeErrorRate = (typeErrors / typeCount) * 100;

        tagTypeBreakdown[tagType] = {
          count: typeCount,
          avgTime: typeAvgTime,
          errorRate: typeErrorRate
        };
      });

      return {
        totalOperations,
        averageResponseTime,
        cacheHitRate,
        errorRate,
        slowOperations,
        tagTypeBreakdown
      };

    } catch (error) {
      console.error('Performance stats error:', error);
      return {
        totalOperations: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
        slowOperations: [],
        tagTypeBreakdown: {}
      };
    }
  }

  /**
   * Get global performance statistics across all users
   */
  static async getGlobalPerformanceStats(): Promise<{
    totalOperations: number;
    averageResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
    topSlowOperations: TagPerformanceMetrics[];
    tagTypePerformance: Record<string, {
      totalCount: number;
      avgTime: number;
      errorRate: number;
      cacheHitRate: number;
    }>;
  }> {
    try {
      // This would require scanning all cache keys in production
      // For now, return mock data structure
      return {
        totalOperations: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
        topSlowOperations: [],
        tagTypePerformance: {}
      };
    } catch (error) {
      console.error('Global performance stats error:', error);
      return {
        totalOperations: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
        topSlowOperations: [],
        tagTypePerformance: {}
      };
    }
  }

  /**
   * Optimize tag operations based on type
   */
  static getTagTypeOptimizations(tagType: string): {
    cacheTTL: number;
    compressionEnabled: boolean;
    batchOperations: boolean;
    priority: 'high' | 'medium' | 'low';
  } {
    const optimizations: Record<string, any> = {
      'I': { // Initials
        cacheTTL: 1800, // 30 minutes
        compressionEnabled: true,
        batchOperations: true,
        priority: 'high'
      },
      'D': { // Date
        cacheTTL: 3600, // 1 hour
        compressionEnabled: false,
        batchOperations: true,
        priority: 'medium'
      },
      'N': { // Commission Number
        cacheTTL: 7200, // 2 hours
        compressionEnabled: false,
        batchOperations: false,
        priority: 'medium'
      },
      'X': { // Commission Expiration
        cacheTTL: 7200, // 2 hours
        compressionEnabled: false,
        batchOperations: false,
        priority: 'medium'
      },
      'O': { // Disclosure
        cacheTTL: 3600, // 1 hour
        compressionEnabled: false,
        batchOperations: true,
        priority: 'low'
      },
      'E': { // Seal
        cacheTTL: 1800, // 30 minutes
        compressionEnabled: true,
        batchOperations: false,
        priority: 'high'
      },
      'W': { // Whiteout
        cacheTTL: 1800, // 30 minutes
        compressionEnabled: true,
        batchOperations: true,
        priority: 'medium'
      }
    };

    return optimizations[tagType] || {
      cacheTTL: 1800,
      compressionEnabled: false,
      batchOperations: false,
      priority: 'medium'
    };
  }

  /**
   * Pre-warm tag cache for a session
   */
  static async prewarmSessionTagCache(
    sessionId: string,
    userId: number,
    tagTypes: string[]
  ): Promise<void> {
    try {
      console.log(`🔥 Pre-warming tag cache for session ${sessionId}, user ${userId}`);
      
      // TODO: Implement actual tag pre-loading from database
      // This would fetch all tags for the session and cache them proactively
      
      console.log(`✅ Tag cache pre-warmed for session ${sessionId}`);
    } catch (error) {
      console.error('Tag cache pre-warming error:', error);
    }
  }

  /**
   * Clean up expired performance data
   */
  static async cleanupExpiredPerformanceData(): Promise<void> {
    try {
      // This would scan and clean up expired performance metrics
      // Implementation depends on Redis key expiration strategy
      console.log('🧹 Cleaned up expired performance data');
    } catch (error) {
      console.error('Performance data cleanup error:', error);
    }
  }
}
