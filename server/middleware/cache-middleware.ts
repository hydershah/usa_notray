import { Request, Response, NextFunction } from 'express';
import { redisCache } from '../services/redis-cache';
import { hasAdminPrivileges } from '../auth';

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

    // Generate cache key (optimized)
    const cacheKey = keyGenerator 
      ? keyGenerator(req)
      : `api:${req.originalUrl}:${req.url.includes('?') ? req.url.split('?')[1] : ''}`;

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
      const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
      return `user:${userId}:${req.originalUrl}:${queryString}`;
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
      const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
      return `admin:${req.originalUrl}:${queryString}`;
    },
    condition: (req: Request) => {
      return hasAdminPrivileges(req.user);
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
      const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
      return `company:${companyId}:${req.originalUrl}:${queryString}`;
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
      const sessionId = req.params.sessionId;
      const documentId = req.query.documentId;
      
      // For editor endpoints, include session and document context
      if (sessionId && req.originalUrl.includes('/editor/session/')) {
        const docContext = documentId ? `:doc:${documentId}` : '';
        const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
        return `job:${jobId}:session:${sessionId}${docContext}:${req.originalUrl}:${queryString}`;
      }
      
      const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
      return `job:${jobId}:${req.originalUrl}:${queryString}`;
    }
  });
}

/**
 * Cache invalidation middleware
 */
export async function invalidateCache(patterns: string[]) {
  for (const pattern of patterns) {
    await redisCache.delPattern(pattern);
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