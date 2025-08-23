import { Request, Response, NextFunction } from 'express';

// 🚀 HIGH PERFORMANCE: Request deduplication for tag operations
const requestCache = new Map<string, { promise: Promise<any>; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

/**
 * 🚀 HIGH PERFORMANCE: Tag request deduplication middleware
 * Prevents multiple identical requests from running simultaneously
 */
export const tagRequestDeduplication = (req: Request, res: Response, next: NextFunction) => {
  const { sessionId, tagId, documentId } = req.params;
  const { documentId: queryDocId } = req.query;
  
  // Create cache key based on request type and parameters
  const cacheKey = `${req.method}:${req.path}:${JSON.stringify(req.body)}:${queryDocId || documentId}`;
  
  // Check if identical request is already in progress
  const existingRequest = requestCache.get(cacheKey);
  if (existingRequest && Date.now() - existingRequest.timestamp < CACHE_TTL) {
    console.log(`🔄 Request deduplication: Reusing existing request for ${cacheKey}`);
    
    // Return the existing promise result
    existingRequest.promise
      .then(result => {
        res.json(result);
      })
      .catch(error => {
        res.status(500).json({ error: 'Request failed', details: error.message });
      });
    return;
  }
  
  // Create new request promise
  const requestPromise = new Promise((resolve, reject) => {
    // Store original response methods
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    
    // Override response methods to capture the result
    res.json = function(data: any) {
      resolve(data);
      return originalJson.call(this, data);
    };
    
    res.status = function(code: number) {
      if (code >= 400) {
        reject(new Error(`HTTP ${code}`));
      }
      return originalStatus.call(this, code);
    };
    
    // Continue to next middleware
    next();
  });
  
  // Store the request promise
  requestCache.set(cacheKey, { promise: requestPromise, timestamp: Date.now() });
  
  // Clean up expired cache entries
  setTimeout(() => {
    requestCache.delete(cacheKey);
  }, CACHE_TTL);
};

/**
 * 🚀 HIGH PERFORMANCE: Tag rate limiting middleware
 * Prevents excessive tag operations that could impact performance
 */
export const tagRateLimiting = (req: Request, res: Response, next: NextFunction) => {
  const { sessionId } = req.params;
  const clientId = req.headers['x-client-id'] || req.ip || 'unknown';
  
  const rateLimitKey = `rate_limit:tags:${sessionId}:${clientId}`;
  const now = Date.now();
  const windowMs = 1000; // 1 second window
  const maxRequests = 10; // Max 10 tag operations per second
  
  // Simple in-memory rate limiting (in production, use Redis)
  const clientRequests = (global as any).tagRateLimits = (global as any).tagRateLimits || new Map();
  const clientData = clientRequests.get(rateLimitKey) || { count: 0, resetTime: now + windowMs };
  
  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + windowMs;
  } else {
    clientData.count++;
  }
  
  clientRequests.set(rateLimitKey, clientData);
  
  if (clientData.count > maxRequests) {
    console.warn(`🚫 Rate limit exceeded for client ${clientId} in session ${sessionId}`);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many tag operations. Please slow down.',
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  }
  
  next();
};

/**
 * 🚀 HIGH PERFORMANCE: Tag response caching middleware
 * Caches successful tag responses to reduce database load
 */
export const tagResponseCaching = (req: Request, res: Response, next: NextFunction) => {
  const { sessionId } = req.params;
  const { documentId } = req.query;
  
  // Only cache GET requests for tag data
  if (req.method !== 'GET') {
    return next();
  }
  
  const cacheKey = `response:tags:${sessionId}:${documentId || 'all'}`;
  const cache = (global as any).tagResponseCache = (global as any).tagResponseCache || new Map();
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30000) { // 30 second TTL
    console.log(`⚡ Response cache HIT for ${cacheKey}`);
    return res.json(cached.data);
  }
  
  // Override response to cache successful responses
  const originalJson = res.json.bind(res);
  res.json = function(data: any) {
    if (res.statusCode === 200) {
      cache.set(cacheKey, { data, timestamp: Date.now() });
    }
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * 🚀 HIGH PERFORMANCE: Tag performance monitoring middleware
 * Tracks response times and performance metrics
 */
export const tagPerformanceMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const { sessionId } = req.params;
  
  // Add performance tracking to response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { method, path } = req;
    
    // Log performance metrics
    if (duration > 1000) {
      console.warn(`🐌 SLOW TAG OPERATION: ${method} ${path} took ${duration}ms`);
    } else if (duration > 500) {
      console.log(`⚠️ MEDIUM TAG OPERATION: ${method} ${path} took ${duration}ms`);
    } else {
      console.log(`⚡ FAST TAG OPERATION: ${method} ${path} took ${duration}ms`);
    }
    
    // Track performance metrics (could send to monitoring service)
    const metrics = {
      operation: `${method} ${path}`,
      sessionId,
      duration,
      timestamp: new Date().toISOString(),
      statusCode: res.statusCode
    };
    
    // Store metrics for analysis
    (global as any).tagPerformanceMetrics = (global as any).tagPerformanceMetrics || [];
    (global as any).tagPerformanceMetrics.push(metrics);
    
    // Keep only last 1000 metrics
    if ((global as any).tagPerformanceMetrics.length > 1000) {
      (global as any).tagPerformanceMetrics = (global as any).tagPerformanceMetrics.slice(-1000);
    }
  });
  
  next();
};

/**
 * 🚀 HIGH PERFORMANCE: Get performance metrics
 * Returns performance statistics for monitoring
 */
export const getTagPerformanceMetrics = () => {
  const metrics = (global as any).tagPerformanceMetrics || [];
  
  if (metrics.length === 0) {
    return { message: 'No performance data available' };
  }
  
  const recentMetrics = metrics.slice(-100); // Last 100 operations
  const durations = recentMetrics.map(m => m.duration);
  
  return {
    totalOperations: metrics.length,
    recentOperations: recentMetrics.length,
    averageResponseTime: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    minResponseTime: Math.min(...durations),
    maxResponseTime: Math.max(...durations),
    slowOperations: recentMetrics.filter(m => m.duration > 1000).length,
    fastOperations: recentMetrics.filter(m => m.duration < 200).length,
    lastUpdated: new Date().toISOString()
  };
};
