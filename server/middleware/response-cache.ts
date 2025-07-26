import { Request, Response, NextFunction } from 'express';
import { redisCache } from '../services/redis-cache';
import crypto from 'crypto';

/**
 * Intelligent Response-Level Caching Middleware
 * Implements smart caching with appropriate TTL values for different endpoint types
 */

interface CacheConfig {
  ttl: number; // Time to live in seconds
  staleWhileRevalidate?: number; // Serve stale content while revalidating
  varyBy?: string[]; // Headers to vary cache by
  invalidateOn?: string[]; // Operations that should invalidate this cache
  enabled: boolean;
}

interface CacheRule {
  pattern: RegExp;
  config: CacheConfig;
  description: string;
}

interface CachedResponse {
  statusCode: number;
  data: any;
  timestamp: number;
  rule: string;
}

export class ResponseCache {
  private static readonly CACHE_RULES: CacheRule[] = [
    // Session state - medium cache, frequent invalidation
    {
      pattern: /^\/api\/session\/[^\/]+\/state$/,
      config: {
        ttl: 30, // 30 seconds
        staleWhileRevalidate: 60,
        varyBy: ['authorization'],
        invalidateOn: ['session_state_change'],
        enabled: true
      },
      description: 'Session state endpoints'
    },

    // Tag lists - short cache, invalidate on tag changes
    {
      pattern: /^\/api\/editor\/session\/[^\/]+\/tags$/,
      config: {
        ttl: 15, // 15 seconds
        staleWhileRevalidate: 30,
        varyBy: ['authorization'],
        invalidateOn: ['tag_update', 'tag_placement', 'tag_delete'],
        enabled: true
      },
      description: 'Tag list endpoints'
    },

    // User profiles - longer cache, rarely changes
    {
      pattern: /^\/api\/users\/\d+\/profile/,
      config: {
        ttl: 300, // 5 minutes
        staleWhileRevalidate: 600,
        varyBy: ['authorization'],
        invalidateOn: ['user_update'],
        enabled: true
      },
      description: 'User profile endpoints'
    },

    // Job listings - medium cache
    {
      pattern: /^\/api\/jobs$/,
      config: {
        ttl: 60, // 1 minute
        staleWhileRevalidate: 120,
        varyBy: ['authorization', 'x-user-role'],
        invalidateOn: ['job_created', 'job_updated', 'job_deleted'],
        enabled: true
      },
      description: 'Job listing endpoints'
    },

    // Company data - long cache, infrequent changes
    {
      pattern: /^\/api\/companies/,
      config: {
        ttl: 600, // 10 minutes
        staleWhileRevalidate: 1200,
        varyBy: ['authorization'],
        invalidateOn: ['company_updated'],
        enabled: true
      },
      description: 'Company data endpoints'
    },

    // Document metadata - medium cache
    {
      pattern: /^\/api\/jobs\/\d+\/documents$/,
      config: {
        ttl: 120, // 2 minutes
        staleWhileRevalidate: 240,
        varyBy: ['authorization'],
        invalidateOn: ['document_uploaded', 'document_updated'],
        enabled: true
      },
      description: 'Document metadata endpoints'
    },

    // Notary availability - short cache, changes frequently
    {
      pattern: /^\/api\/notary\/availability/,
      config: {
        ttl: 30, // 30 seconds
        staleWhileRevalidate: 60,
        varyBy: ['authorization'],
        invalidateOn: ['availability_changed'],
        enabled: true
      },
      description: 'Notary availability endpoints'
    }
  ];

  /**
   * Create response caching middleware
   */
  static createMiddleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      const cacheRule = this.findMatchingRule(req.path);
      if (!cacheRule || !cacheRule.config.enabled) {
        return next();
      }

      const cacheKey = this.generateCacheKey(req, cacheRule);
      const startTime = Date.now();

      try {
        // Try to get cached response
        const cachedResponse = await redisCache.get(cacheKey) as CachedResponse | null;
        
        if (cachedResponse) {
          const age = Math.floor((Date.now() - cachedResponse.timestamp) / 1000);
          const isStale = age > cacheRule.config.ttl;
          const canServeStale = cacheRule.config.staleWhileRevalidate && 
                                age <= (cacheRule.config.ttl + cacheRule.config.staleWhileRevalidate);

          // Serve cached response with appropriate headers
          res.set({
            'X-Cache': isStale ? 'STALE' : 'HIT',
            'X-Cache-Age': age.toString(),
            'X-Cache-Rule': cacheRule.description,
            'Cache-Control': `max-age=${Math.max(0, cacheRule.config.ttl - age)}, stale-while-revalidate=${cacheRule.config.staleWhileRevalidate || 0}`
          });

          if (!isStale || canServeStale) {
            const duration = Date.now() - startTime;
            console.log(`📦 Cache ${isStale ? 'STALE' : 'HIT'}: ${req.path} (${duration}ms, age: ${age}s)`);
            
            // If serving stale content, trigger background revalidation
            if (isStale && canServeStale) {
              this.triggerBackgroundRevalidation(req, cacheKey, cacheRule).catch(err => 
                console.warn('Background revalidation failed:', err)
              );
            }

                         res.status(cachedResponse.statusCode).json(cachedResponse.data);
             return;
          }
        }

        // Cache miss - proceed with request and cache the response
        console.log(`🔍 Cache MISS: ${req.path}`);
        this.setupResponseCaching(req, res, cacheKey, cacheRule);
        next();

      } catch (error) {
        console.warn('Response cache error:', error);
        next();
      }
    };
  }

  /**
   * Find matching cache rule for a request path
   */
  private static findMatchingRule(path: string): CacheRule | null {
    return this.CACHE_RULES.find(rule => rule.pattern.test(path)) || null;
  }

  /**
   * Generate cache key based on request and cache rule
   */
  private static generateCacheKey(req: Request, rule: CacheRule): string {
    const baseKey = `response:${req.path}`;
    
    // Add query parameters
    const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
    const pathWithQuery = queryString ? `${req.path}?${queryString}` : req.path;
    
    // Add vary headers
    const varyParts: string[] = [];
    if (rule.config.varyBy) {
      for (const header of rule.config.varyBy) {
        const value = req.headers[header.toLowerCase()];
        if (value) {
          // Hash sensitive headers like authorization
          if (header.toLowerCase() === 'authorization') {
            const hash = crypto.createHash('md5').update(value.toString()).digest('hex').substring(0, 8);
            varyParts.push(`${header}:${hash}`);
          } else {
            varyParts.push(`${header}:${value}`);
          }
        }
      }
    }
    
    const varyString = varyParts.length > 0 ? `:${varyParts.join(':')}` : '';
    return `${baseKey}${varyString}:${crypto.createHash('md5').update(pathWithQuery).digest('hex').substring(0, 8)}`;
  }

  /**
   * Setup response caching for a request
   */
  private static setupResponseCaching(req: Request, res: Response, cacheKey: string, rule: CacheRule): void {
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    
    let statusCode = 200;
    
    // Override res.status to capture status code
    res.status = (code: number) => {
      statusCode = code;
      return originalStatus(code);
    };

    // Override res.json to cache the response
    res.json = (data: any) => {
      // Only cache successful responses
      if (statusCode >= 200 && statusCode < 300) {
        const cacheData = {
          statusCode,
          data,
          timestamp: Date.now(),
          rule: rule.description
        };
        
        // Cache in background to avoid blocking response
        redisCache.set(cacheKey, cacheData, rule.config.ttl)
          .then(() => {
            console.log(`💾 Cached response: ${req.path} (TTL: ${rule.config.ttl}s)`);
          })
          .catch(err => {
            console.warn('Failed to cache response:', err);
          });

        // Set cache headers
        res.set({
          'X-Cache': 'MISS',
          'X-Cache-Rule': rule.description,
          'Cache-Control': `max-age=${rule.config.ttl}, stale-while-revalidate=${rule.config.staleWhileRevalidate || 0}`
        });
      }
      
      return originalJson(data);
    };
  }

  /**
   * Trigger background revalidation for stale content
   */
  private static async triggerBackgroundRevalidation(req: Request, cacheKey: string, rule: CacheRule): Promise<void> {
    // This is a placeholder for background revalidation
    // In a full implementation, this would make a fresh request to update the cache
    console.log(`🔄 Triggering background revalidation for: ${req.path}`);
    
    // Mark for revalidation (could trigger a background job)
    const revalidationKey = `revalidate:${cacheKey}`;
    await redisCache.set(revalidationKey, { path: req.path, timestamp: Date.now() }, 60);
  }

  /**
   * Invalidate cached responses by pattern
   */
  static async invalidateByPattern(pattern: string, operationType: string): Promise<number> {
    try {
      // Find all cache rules that should be invalidated by this operation
      const affectedRules = this.CACHE_RULES.filter(rule => 
        rule.config.invalidateOn?.includes(operationType)
      );

      if (affectedRules.length === 0) {
        return 0;
      }

      let totalCleared = 0;
      
      // Clear caches for affected rules
      for (const rule of affectedRules) {
        const cachePattern = `response:${pattern}*`;
        const cleared = await redisCache.delPattern(cachePattern);
        totalCleared += cleared;
        
        if (cleared > 0) {
          console.log(`🧹 Response cache cleared: ${rule.description} (${cleared} keys)`);
        }
      }

      return totalCleared;

    } catch (error) {
      console.error('Failed to invalidate response cache:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    hitRate: number;
    totalRequests: number;
    cachedResponses: number;
    averageAge: number;
  }> {
    try {
      // This would be implemented with proper metrics collection
      // For now, return placeholder values
      return {
        hitRate: 0.75, // Target: 75%+ hit rate
        totalRequests: 0,
        cachedResponses: 0,
        averageAge: 0
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return { hitRate: 0, totalRequests: 0, cachedResponses: 0, averageAge: 0 };
    }
  }

  /**
   * Warm cache for frequently accessed endpoints
   */
  static async warmCache(endpoints: string[]): Promise<void> {
    console.log(`🔥 Warming response cache for ${endpoints.length} endpoints...`);
    
    for (const endpoint of endpoints) {
      try {
        // This would make actual requests to warm the cache
        // For now, just log the warming attempt
        console.log(`🔥 Warming: ${endpoint}`);
      } catch (error) {
        console.warn(`Failed to warm cache for ${endpoint}:`, error);
      }
    }
  }

  /**
   * Clear all response caches
   */
  static async clearAllCaches(): Promise<number> {
    try {
      const cleared = await redisCache.delPattern('response:*');
      console.log(`🧹 Cleared all response caches: ${cleared} keys`);
      return cleared;
    } catch (error) {
      console.error('Failed to clear all response caches:', error);
      return 0;
    }
  }
}

// Export convenience middleware function
export const responseCacheMiddleware = ResponseCache.createMiddleware();

// Integration with smart cache invalidation
export const responseCacheInvalidation = {
  onSessionStateChanged: (sessionId: string) => 
    ResponseCache.invalidateByPattern(`/api/session/${sessionId}`, 'session_state_change'),
  
  onTagChanged: (sessionId: string) =>
    ResponseCache.invalidateByPattern(`/api/editor/session/${sessionId}`, 'tag_update'),
  
  onUserUpdated: (userId: number) =>
    ResponseCache.invalidateByPattern(`/api/users/${userId}`, 'user_update'),
  
  onJobChanged: () =>
    ResponseCache.invalidateByPattern('/api/jobs', 'job_updated'),
  
  onCompanyUpdated: () =>
    ResponseCache.invalidateByPattern('/api/companies', 'company_updated')
}; 