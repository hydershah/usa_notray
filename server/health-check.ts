import { Request, Response } from 'express';
import { pool } from './db';
import { performanceMonitor } from './middleware/performance-monitor';
import { redisCache } from './services/redis-cache';
import { getCircuitBreakerStatus } from './middleware/circuit-breaker';

interface CachedHealthResult {
  result: any;
  timestamp: number;
}

class HealthCheckCache {
  private cache: CachedHealthResult | null = null;
  private readonly CACHE_TTL = 30000; // 30 seconds cache

  async getHealth(): Promise<any> {
    // Return cached result if valid
    if (this.cache && (Date.now() - this.cache.timestamp < this.CACHE_TTL)) {
      return this.cache.result;
    }

    // Run expensive checks
    const result = await this.runHealthChecks();
    
    // Cache the result
    this.cache = {
      result,
      timestamp: Date.now()
    };

    return result;
  }

  private async runHealthChecks() {
    const health = {
      database: 'unknown',
      redis: 'unknown',
      dbLatency: 0,
      redisLatency: 0
    };

    try {
      // Test database connection with timeout
      const dbStart = Date.now();
      const client = await pool.connect();
      await client.query('SELECT 1');
      const dbDuration = Date.now() - dbStart;
      client.release();
      
      health.database = dbDuration < 200 ? 'healthy' : 'slow';
      health.dbLatency = dbDuration;
      
    } catch (error) {
      health.database = 'error';
    }

    try {
      // Test Redis connection
      const redisHealth = await redisCache.healthCheck();
      if (redisHealth.healthy) {
        health.redis = redisHealth.latency < 50 ? 'healthy' : 'slow';
        health.redisLatency = redisHealth.latency || 0;
      } else {
        health.redis = 'error';
      }
    } catch (error) {
      health.redis = 'error';
    }

    return health;
  }
}

const healthCache = new HealthCheckCache();

export async function healthCheck(req: Request, res: Response) {
  const startTime = Date.now();
  
  try {
    // Get cached health data
    const healthData = await healthCache.getHealth();
    
    // Get current metrics
    const metrics = performanceMonitor.getMetrics();
    
    // Get circuit breaker status
    const circuitBreakerStatus = getCircuitBreakerStatus();
    const circuitBreakers = circuitBreakerStatus.reduce((acc, cb) => {
      acc[cb.name] = {
        state: cb.state,
        failureCount: cb.failureCount,
        failureThreshold: cb.failureThreshold
      };
      return acc;
    }, {} as any);

    // Determine overall status - MUCH more lenient criteria
    let status = 'healthy';
    let reasons = [];

    // Only mark as degraded for severe issues
    if (healthData.database === 'error') {
      status = 'degraded';
      reasons.push('Database offline');
    }

    // Redis down is degraded, not unhealthy
    if (healthData.redis === 'error') {
      status = 'degraded';
      reasons.push('Redis offline');
    }

    // Very high error rate (>90%) for actual errors only
    if (metrics.errorRate > 90) {
      status = 'degraded';
      reasons.push('Very high error rate');
    }

    // Open circuit breakers
    const openCircuits = circuitBreakerStatus.filter(cb => cb.state === 'OPEN');
    if (openCircuits.length > 2) { // More than 2 circuits open
      status = 'degraded';
      reasons.push('Multiple circuit breakers open');
    }

    const responseTime = Date.now() - startTime;

    const health = {
      status,
      reasons: reasons.length > 0 ? reasons : undefined,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: healthData.database,
      redis: healthData.redis,
      performance: {
        ...metrics,
        healthCheckLatency: responseTime
      },
      circuitBreakers,
      version: process.env.npm_package_version || '1.0.0',
      requestId: (req as any).requestId || 'unknown',
      responseTime: `${responseTime}ms`
    };

    // Add response headers for monitoring
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    res.setHeader('X-System-Status', status);
    res.setHeader('X-Request-ID', health.requestId);
    
    // Always return 200 unless database is completely offline
    const httpStatus = healthData.database === 'error' ? 503 : 200;
    
    res.status(httpStatus).json(health);

  } catch (error) {
    console.error('Health check error:', error);
    
    const responseTime = Date.now() - startTime;
    
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      requestId: (req as any).requestId || 'unknown'
    });
  }
}
