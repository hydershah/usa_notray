import { Request, Response, NextFunction } from 'express';
import { redisCache } from '../services/redis-cache';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request, res: Response) => boolean;
}

/**
 * Cache middleware for API responses
 */
export function cacheResponse(options: CacheOptions = {}) {
  const { ttl = 300, keyGenerator, condition } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator 
      ? keyGenerator(req)
      : `api:${req.originalUrl}:${JSON.stringify(req.query)}`;

    // Check condition if provided
    if (condition && !condition(req, res)) {
      return next();
    }

    try {
      // Try to get from cache
      const cachedResponse = await redisCache.get(cacheKey);
      
      if (cachedResponse) {
        console.log(`📦 Cache HIT: ${req.originalUrl}`);
        res.set('X-Cache', 'HIT');
        return res.json(cachedResponse);
      }

      // Cache miss - continue to handler
      console.log(`🔍 Cache MISS: ${req.originalUrl}`);
      res.set('X-Cache', 'MISS');

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function(data: any) {
        // Cache successful responses only
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisCache.set(cacheKey, data, ttl).catch(err => {
            console.error('Failed to cache response:', err);
          });
        }
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next(); // Continue without caching on error
    }
  };
}

/**
 * Cache middleware for user-specific data
 */
export function cacheUserData(ttl: number = 600) {
  return cacheResponse({
    ttl,
    keyGenerator: (req: Request) => {
      const userId = req.user?.id || 'anonymous';
      return `user:${userId}:${req.originalUrl}:${JSON.stringify(req.query)}`;
    }
  });
}

/**
 * Cache middleware for admin dashboard data
 */
export function cacheAdminData(ttl: number = 300) {
  return cacheResponse({
    ttl,
    keyGenerator: (req: Request) => {
      return `admin:${req.originalUrl}:${JSON.stringify(req.query)}`;
    },
    condition: (req: Request) => {
      return req.user?.role === 'admin';
    }
  });
}

/**
 * Cache middleware for company data
 */
export function cacheCompanyData(ttl: number = 600) {
  return cacheResponse({
    ttl,
    keyGenerator: (req: Request) => {
      const companyId = req.user?.company_id || 'none';
      return `company:${companyId}:${req.originalUrl}:${JSON.stringify(req.query)}`;
    }
  });
}

/**
 * Cache middleware for job data
 */
export function cacheJobData(ttl: number = 180) {
  return cacheResponse({
    ttl,
    keyGenerator: (req: Request) => {
      const jobId = req.params.id || req.query.jobId;
      return `job:${jobId}:${req.originalUrl}:${JSON.stringify(req.query)}`;
    }
  });
}

/**
 * Cache invalidation middleware
 */
export async function invalidateCache(patterns: string[]) {
  for (const pattern of patterns) {
    await redisCache.delByPattern(pattern);
  }
}

/**
 * Cache warming middleware - pre-populate cache with common queries
 */
export async function warmCache() {
  console.log('🔥 Warming cache with common queries...');
  
  // This would typically be called during startup
  // to pre-populate cache with frequently accessed data
  
  // Example: Pre-cache user roles, system settings, etc.
  try {
    // Add cache warming logic here
    console.log('✅ Cache warming completed');
  } catch (error) {
    console.error('❌ Cache warming failed:', error);
  }
} 