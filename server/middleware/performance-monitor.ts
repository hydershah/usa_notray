import { Request, Response, NextFunction } from 'express';

interface PerformanceMetrics {
  averageResponseTime: number;
  requestCount: number;
  errorCount: number;
  slowRequestCount: number;
  errorRate: number;
}

interface RequestRecord {
  timestamp: number;
  duration: number;
  statusCode: number;
  isError: boolean;
}

class PerformanceMonitor {
  private requests: RequestRecord[] = [];
  private readonly WINDOW_SIZE_MS = 5 * 60 * 1000; // 5 minutes sliding window
  private readonly MAX_RECORDS = 1000; // Prevent memory bloat

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        // Skip health check endpoints from error metrics to prevent death spiral
        const isHealthCheck = req.path === '/health' || req.path === '/api/health';
        const isError = res.statusCode >= 400 && !isHealthCheck;
        
        this.recordRequest({
          timestamp: Date.now(),
          duration,
          statusCode: res.statusCode,
          isError
        });
        
        // Log slow requests (>1000ms) but exclude health checks
        if (duration > 1000 && !isHealthCheck) {
          console.warn(`🐌 SLOW REQUEST: ${req.method} ${req.path} - ${duration}ms`);
        }
        
        // Log API requests with timing (exclude health checks)
        if (req.path.startsWith('/api/') && !isHealthCheck) {
          console.log(`📊 API ${req.method} ${req.path}: ${duration}ms (${res.statusCode})`);
        }
      });
      
      next();
    };
  }

  private recordRequest(record: RequestRecord) {
    this.requests.push(record);
    
    // Clean old records outside sliding window
    const cutoff = Date.now() - this.WINDOW_SIZE_MS;
    this.requests = this.requests.filter(r => r.timestamp > cutoff);
    
    // Prevent memory bloat
    if (this.requests.length > this.MAX_RECORDS) {
      this.requests = this.requests.slice(-this.MAX_RECORDS);
    }
  }

  getMetrics(): PerformanceMetrics {
    // Clean old records
    const cutoff = Date.now() - this.WINDOW_SIZE_MS;
    const recentRequests = this.requests.filter(r => r.timestamp > cutoff);
    
    if (recentRequests.length === 0) {
      return {
        averageResponseTime: 0,
        requestCount: 0,
        errorCount: 0,
        slowRequestCount: 0,
        errorRate: 0
      };
    }

    const errorCount = recentRequests.filter(r => r.isError).length;
    const slowRequestCount = recentRequests.filter(r => r.duration > 1000).length;
    const totalDuration = recentRequests.reduce((sum, r) => sum + r.duration, 0);
    const averageResponseTime = totalDuration / recentRequests.length;
    const errorRate = (errorCount / recentRequests.length) * 100;

    return {
      averageResponseTime,
      requestCount: recentRequests.length,
      errorCount,
      slowRequestCount,
      errorRate
    };
  }

  logSummary() {
    const metrics = this.getMetrics();
    console.log('📊 PERFORMANCE SUMMARY (5min window):');
    console.log(`   Average Response Time: ${metrics.averageResponseTime.toFixed(2)}ms`);
    console.log(`   Total Requests: ${metrics.requestCount}`);
    console.log(`   Error Count: ${metrics.errorCount}`);
    console.log(`   Slow Requests (>1s): ${metrics.slowRequestCount}`);
    console.log(`   Error Rate: ${metrics.errorRate.toFixed(2)}%`);
  }

  // Reset all metrics (useful for testing or manual reset)
  reset() {
    this.requests = [];
    console.log('🔄 Performance metrics reset');
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Log summary every 5 minutes
setInterval(() => {
  performanceMonitor.logSummary();
}, 5 * 60 * 1000);
