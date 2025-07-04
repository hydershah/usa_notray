import { Request, Response } from 'express';
import { pool } from './db';
import { performanceMonitor } from './middleware/performance-monitor';
import { redisCache } from './services/redis-cache';
import { getCircuitBreakerStatus } from './middleware/circuit-breaker';

export async function healthCheck(req: Request, res: Response) {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'unknown',
    redis: 'unknown',
    performance: performanceMonitor.getMetrics(),
    circuitBreakers: {},
    version: process.env.npm_package_version || '1.0.0',
    requestId: (req as any).requestId || 'unknown'
  };

  try {
    // Test database connection
    const client = await pool.connect();
    const dbStart = Date.now();
    await client.query('SELECT 1');
    const dbDuration = Date.now() - dbStart;
    client.release();
    
    health.database = dbDuration < 100 ? 'healthy' : 'slow';
    
    // Test Redis connection
    const redisHealth = await redisCache.healthCheck();
    if (redisHealth.healthy) {
      health.redis = redisHealth.latency < 10 ? 'healthy' : 'slow';
    } else {
      health.redis = 'error';
    }
    
    // Get circuit breaker status
    const circuitBreakerStatus = getCircuitBreakerStatus();
    health.circuitBreakers = circuitBreakerStatus.reduce((acc, cb) => {
      acc[cb.name] = {
        state: cb.state,
        failureCount: cb.failureCount,
        failureThreshold: cb.failureThreshold
      };
      return acc;
    }, {} as any);
    
    // Check if system is overloaded
    const metrics = performanceMonitor.getMetrics();
    if (metrics.averageResponseTime > 2000 || metrics.errorCount > 10) {
      health.status = 'degraded';
    }
    
    // If Redis is down, mark as degraded
    if (health.redis === 'error') {
      health.status = 'degraded';
    }
    
    // If any circuit breaker is open, mark as degraded
    const openCircuits = circuitBreakerStatus.filter(cb => cb.state === 'OPEN');
    if (openCircuits.length > 0) {
      health.status = 'degraded';
      console.warn('⚠️ Circuit breakers OPEN:', openCircuits.map(cb => cb.name));
    }
    
  } catch (error) {
    health.status = 'unhealthy';
    health.database = 'error';
    console.error('Health check error:', error);
  }

  const responseTime = Date.now() - startTime;
  
  // Add response headers for monitoring
  res.setHeader('X-Response-Time', `${responseTime}ms`);
  res.setHeader('X-System-Status', health.status);
  res.setHeader('X-Request-ID', health.requestId);
  
  res.status(health.status === 'healthy' ? 200 : 503).json({
    ...health,
    responseTime: `${responseTime}ms`
  });
}
