import { performance } from 'perf_hooks';
import { pool } from '../db';
import { cacheService } from './cache-service';

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface SystemMetrics {
  database: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingClients: number;
    avgQueryTime: number;
    slowQueries: number;
  };
  cache: {
    hitRate: number;
    totalOperations: number;
    errors: number;
    isConnected: boolean;
  };
  memory: {
    used: number;
    free: number;
    total: number;
    usage: number; // percentage
  };
  api: {
    totalRequests: number;
    avgResponseTime: number;
    slowRequests: number;
    errorRate: number;
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private apiStats = {
    totalRequests: 0,
    totalResponseTime: 0,
    slowRequests: 0,
    errors: 0,
  };
  private slowQueryThreshold = 1000; // 1 second
  private slowRequestThreshold = 5000; // 5 seconds
  private maxMetricsHistory = 10000; // Keep last 10k metrics

  /**
   * Track a performance metric
   */
  track(operation: string, duration: number, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: new Date(),
      metadata,
    };

    this.metrics.push(metric);

    // Trim old metrics to prevent memory issues
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Log slow operations
    if (duration > this.slowQueryThreshold) {
      console.warn(`Slow operation detected: ${operation} took ${duration}ms`, metadata);
    }
  }

  /**
   * Measure execution time of a function
   */
  async measure<T>(operation: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.track(operation, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.track(operation, duration, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Track API request
   */
  trackApiRequest(duration: number, statusCode: number, method: string, path: string): void {
    this.apiStats.totalRequests++;
    this.apiStats.totalResponseTime += duration;

    if (duration > this.slowRequestThreshold) {
      this.apiStats.slowRequests++;
      console.warn(`Slow API request: ${method} ${path} took ${duration}ms`);
    }

    if (statusCode >= 400) {
      this.apiStats.errors++;
    }

    this.track('api_request', duration, {
      method,
      path,
      statusCode,
      isError: statusCode >= 400,
      isSlow: duration > this.slowRequestThreshold,
    });
  }

  /**
   * Get database metrics
   */
  async getDatabaseMetrics(): Promise<SystemMetrics['database']> {
    try {
      const poolStats = {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        activeConnections: pool.totalCount - pool.idleCount,
        waitingClients: pool.waitingCount,
      };

      // Calculate average query time from recent metrics
      const recentDbMetrics = this.metrics
        .filter(m => m.operation.startsWith('db_') && m.timestamp > new Date(Date.now() - 300000)) // Last 5 minutes
        .map(m => m.duration);

      const avgQueryTime = recentDbMetrics.length > 0 
        ? recentDbMetrics.reduce((a, b) => a + b, 0) / recentDbMetrics.length 
        : 0;

      const slowQueries = recentDbMetrics.filter(d => d > this.slowQueryThreshold).length;

      return {
        ...poolStats,
        avgQueryTime: Math.round(avgQueryTime),
        slowQueries,
      };
    } catch (error) {
      console.error('Failed to get database metrics:', error);
      return {
        totalConnections: 0,
        idleConnections: 0,
        activeConnections: 0,
        waitingClients: 0,
        avgQueryTime: 0,
        slowQueries: 0,
      };
    }
  }

  /**
   * Get cache metrics
   */
  async getCacheMetrics(): Promise<SystemMetrics['cache']> {
    try {
      const stats = cacheService.getStats();
      const totalOperations = stats.hits + stats.misses;
      const hitRate = totalOperations > 0 ? (stats.hits / totalOperations) * 100 : 0;

      return {
        hitRate: Math.round(hitRate * 100) / 100,
        totalOperations,
        errors: stats.errors,
        isConnected: stats.isConnected,
      };
    } catch (error) {
      console.error('Failed to get cache metrics:', error);
      return {
        hitRate: 0,
        totalOperations: 0,
        errors: 0,
        isConnected: false,
      };
    }
  }

  /**
   * Get memory metrics
   */
  getMemoryMetrics(): SystemMetrics['memory'] {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal + memUsage.external;
    const usedMemory = memUsage.heapUsed;
    const freeMemory = totalMemory - usedMemory;

    return {
      used: Math.round(usedMemory / 1024 / 1024), // MB
      free: Math.round(freeMemory / 1024 / 1024), // MB
      total: Math.round(totalMemory / 1024 / 1024), // MB
      usage: Math.round((usedMemory / totalMemory) * 100), // percentage
    };
  }

  /**
   * Get API metrics
   */
  getApiMetrics(): SystemMetrics['api'] {
    const avgResponseTime = this.apiStats.totalRequests > 0 
      ? this.apiStats.totalResponseTime / this.apiStats.totalRequests 
      : 0;

    const errorRate = this.apiStats.totalRequests > 0 
      ? (this.apiStats.errors / this.apiStats.totalRequests) * 100 
      : 0;

    return {
      totalRequests: this.apiStats.totalRequests,
      avgResponseTime: Math.round(avgResponseTime),
      slowRequests: this.apiStats.slowRequests,
      errorRate: Math.round(errorRate * 100) / 100,
    };
  }

  /**
   * Get comprehensive system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const [database, cache] = await Promise.all([
      this.getDatabaseMetrics(),
      this.getCacheMetrics(),
    ]);

    return {
      database,
      cache,
      memory: this.getMemoryMetrics(),
      api: this.getApiMetrics(),
    };
  }

  /**
   * Get performance summary for the last period
   */
  getPerformanceSummary(periodMinutes: number = 60): {
    totalOperations: number;
    slowOperations: number;
    avgDuration: number;
    operationBreakdown: Record<string, { count: number; avgDuration: number }>;
  } {
    const cutoff = new Date(Date.now() - periodMinutes * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);

    const slowOperations = recentMetrics.filter(m => m.duration > this.slowQueryThreshold).length;
    const avgDuration = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length 
      : 0;

    // Group by operation type
    const operationBreakdown: Record<string, { count: number; totalDuration: number }> = {};
    recentMetrics.forEach(metric => {
      if (!operationBreakdown[metric.operation]) {
        operationBreakdown[metric.operation] = { count: 0, totalDuration: 0 };
      }
      operationBreakdown[metric.operation].count++;
      operationBreakdown[metric.operation].totalDuration += metric.duration;
    });

    // Convert to averages
    const operationStats: Record<string, { count: number; avgDuration: number }> = {};
    Object.entries(operationBreakdown).forEach(([operation, stats]) => {
      operationStats[operation] = {
        count: stats.count,
        avgDuration: Math.round(stats.totalDuration / stats.count),
      };
    });

    return {
      totalOperations: recentMetrics.length,
      slowOperations,
      avgDuration: Math.round(avgDuration),
      operationBreakdown: operationStats,
    };
  }

  /**
   * Get alerts based on performance thresholds
   */
  async getPerformanceAlerts(): Promise<Array<{
    type: 'warning' | 'critical';
    message: string;
    metric: string;
    value: number | string;
    threshold: number | string;
  }>> {
    const alerts: Array<{
      type: 'warning' | 'critical';
      message: string;
      metric: string;
      value: number | string;
      threshold: number | string;
    }> = [];

    const metrics = await this.getSystemMetrics();

    // Database connection alerts
    if (metrics.database.activeConnections > 15) {
      alerts.push({
        type: 'warning',
        message: 'High database connection usage',
        metric: 'database.activeConnections',
        value: metrics.database.activeConnections,
        threshold: 15,
      });
    }

    if (metrics.database.avgQueryTime > 2000) {
      alerts.push({
        type: 'critical',
        message: 'High average database query time',
        metric: 'database.avgQueryTime',
        value: `${metrics.database.avgQueryTime}ms`,
        threshold: '2000ms',
      });
    }

    // Memory alerts
    if (metrics.memory.usage > 85) {
      alerts.push({
        type: 'critical',
        message: 'High memory usage',
        metric: 'memory.usage',
        value: `${metrics.memory.usage}%`,
        threshold: '85%',
      });
    } else if (metrics.memory.usage > 70) {
      alerts.push({
        type: 'warning',
        message: 'Elevated memory usage',
        metric: 'memory.usage',
        value: `${metrics.memory.usage}%`,
        threshold: '70%',
      });
    }

    // Cache alerts
    if (!metrics.cache.isConnected) {
      alerts.push({
        type: 'critical',
        message: 'Cache service is disconnected',
        metric: 'cache.isConnected',
        value: 'false',
        threshold: 'true',
      });
    } else if (metrics.cache.hitRate < 60) {
      alerts.push({
        type: 'warning',
        message: 'Low cache hit rate',
        metric: 'cache.hitRate',
        value: `${metrics.cache.hitRate}%`,
        threshold: '60%',
      });
    }

    // API performance alerts
    if (metrics.api.errorRate > 5) {
      alerts.push({
        type: 'critical',
        message: 'High API error rate',
        metric: 'api.errorRate',
        value: `${metrics.api.errorRate}%`,
        threshold: '5%',
      });
    }

    if (metrics.api.avgResponseTime > 3000) {
      alerts.push({
        type: 'warning',
        message: 'High average API response time',
        metric: 'api.avgResponseTime',
        value: `${metrics.api.avgResponseTime}ms`,
        threshold: '3000ms',
      });
    }

    return alerts;
  }

  /**
   * Clear old metrics and reset counters
   */
  reset(): void {
    this.metrics = [];
    this.apiStats = {
      totalRequests: 0,
      totalResponseTime: 0,
      slowRequests: 0,
      errors: 0,
    };
  }

  /**
   * Export metrics for external monitoring tools
   */
  exportMetrics(): {
    metrics: PerformanceMetric[];
    summary: ReturnType<typeof this.getPerformanceSummary>;
    timestamp: string;
  } {
    return {
      metrics: this.metrics,
      summary: this.getPerformanceSummary(),
      timestamp: new Date().toISOString(),
    };
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Express middleware to track API performance
export const performanceMiddleware = (req: any, res: any, next: any) => {
  const start = performance.now();

  res.on('finish', () => {
    const duration = performance.now() - start;
    performanceMonitor.trackApiRequest(duration, res.statusCode, req.method, req.path);
  });

  next();
};

// Database query wrapper with performance tracking
export const trackDbQuery = async <T>(
  operation: string,
  queryFn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> => {
  return performanceMonitor.measure(`db_${operation}`, queryFn, metadata);
}; 