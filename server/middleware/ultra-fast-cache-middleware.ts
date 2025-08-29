/**
 * Ultra-Fast Cache Middleware
 * Target: Get Railway queries under 20ms
 */

import { Request, Response, NextFunction } from 'express';
import { ultraCache, cachedQuery, CachePresets } from '../lib/ultra-fast-cache.js';

interface CachedRequest extends Request {
  cacheKey?: string;
  cacheSkip?: boolean;
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: CachedRequest): string {
  const { method, path, query, user } = req;
  const userId = user?.id || 'anonymous';
  
  // Include relevant query params in cache key
  const queryString = new URLSearchParams(query as Record<string, string>).toString();
  const baseKey = `${method}:${path}:${userId}`;
  
  return queryString ? `${baseKey}:${queryString}` : baseKey;
}

/**
 * Ultra-fast cache middleware for GET requests
 */
export function ultraFastCache(ttlSeconds: number = CachePresets.USER_DATA) {
  return (req: CachedRequest, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip if explicitly disabled
    if (req.cacheSkip) {
      return next();
    }

    const cacheKey = generateCacheKey(req);
    req.cacheKey = cacheKey;

    // Try to get from cache
    const cached = ultraCache.get(cacheKey);
    if (cached !== null) {
      // Cache hit - return immediately
      const start = Date.now();
      res.json(cached);
      const duration = Date.now() - start;
      console.log(`⚡ ULTRA-FAST: ${req.path} served from cache in ${duration}ms`);
      return;
    }

    // Cache miss - intercept response
    const originalJson = res.json;
    res.json = function(data: any) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        ultraCache.set(cacheKey, data, ttlSeconds);
      }
      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Smart cache invalidation middleware for POST/PUT/DELETE
 */
export function smartCacheInvalidation(patterns: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Hook into response to invalidate after successful operations
    const originalJson = res.json;
    res.json = function(data: any) {
      // Only invalidate on successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const start = Date.now();
        const cleared = ultraCache.invalidate(patterns);
        const duration = Date.now() - start;
        console.log(`🎯 Smart invalidation: ${patterns.join(', ')} affecting ${cleared} keys (${duration}ms)`);
      }
      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Endpoint-specific cache configurations
 */
export const CacheConfigs = {
  // Users endpoint - cache for 2 minutes
  users: {
    middleware: ultraFastCache(CachePresets.USER_DATA),
    invalidateOn: ['user_update', 'user_create', 'user_delete']
  },

  // Companies endpoint - cache for 5 minutes  
  companies: {
    middleware: ultraFastCache(CachePresets.STATIC),
    invalidateOn: ['company_update', 'company_create', 'company_approval']
  },

  // Job requests - cache for 30 seconds
  jobRequests: {
    middleware: ultraFastCache(CachePresets.SESSION_DATA),
    invalidateOn: ['job_update', 'job_create', 'job_status_change']
  },

  // Admin queue - cache for 30 seconds
  adminQueue: {
    middleware: ultraFastCache(CachePresets.SESSION_DATA),
    invalidateOn: ['approval_update', 'job_status_change']
  },

  // Session state - cache for 15 seconds
  sessionState: {
    middleware: ultraFastCache(CachePresets.TAGS),
    invalidateOn: ['tag_placement', 'session_update', 'document_update']
  },

  // Tags data - cache for 15 seconds
  tags: {
    middleware: ultraFastCache(CachePresets.TAGS),
    invalidateOn: ['tag_placement', 'tag_update', 'tag_delete']
  }
} as const;

/**
 * Preload frequently accessed data
 */
export function preloadCache(storage: any) {
  console.log('🔥 Preloading ultra-fast cache...');

  // Preload active users
  ultraCache.warmup('/api/users', async () => {
    return await storage.getUsers();
  }, CachePresets.USER_DATA);

  // Preload active companies
  ultraCache.warmup('/api/companies', async () => {
    return await storage.getCompanies();
  }, CachePresets.STATIC);

  // Preload closing types
  ultraCache.warmup('/api/closing-types/active', async () => {
    return await storage.getActiveClosingTypes();
  }, CachePresets.STATIC);

  // Preload participant roles
  ultraCache.warmup('/api/participant-roles', async () => {
    return await storage.getParticipantRoles();
  }, CachePresets.STATIC);

  console.log('🔥 Cache preloading initiated');
}

/**
 * Performance monitoring middleware
 */
export function performanceMonitor() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    // Hook into response
    const originalJson = res.json;
    res.json = function(data: any) {
      const duration = Date.now() - start;
      
      // Log slow requests
      if (duration > 50) {
        console.log(`🐌 SLOW REQUEST: ${req.method} ${req.path} - ${duration}ms`);
      } else if (duration < 20) {
        console.log(`⚡ FAST REQUEST: ${req.method} ${req.path} - ${duration}ms`);
      }

      return originalJson.call(this, data);
    };

    next();
  };
}

export default {
  ultraFastCache,
  smartCacheInvalidation,
  CacheConfigs,
  preloadCache,
  performanceMonitor
};
