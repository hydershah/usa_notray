import { Request, Response, NextFunction } from 'express';

interface PerformanceMetrics {
  averageResponseTime: number;
  requestCount: number;
  errorCount: number;
  slowRequestCount: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    averageResponseTime: 0,
    requestCount: 0,
    errorCount: 0,
    slowRequestCount: 0
  };

  private responseTimes: number[] = [];

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.recordMetric(duration, res.statusCode);
        
        // Log slow requests (>1000ms)
        if (duration > 1000) {
          console.warn(`🐌 SLOW REQUEST: ${req.method} ${req.path} - ${duration}ms`);
        }
        
        // Log all API requests with timing
        if (req.path.startsWith('/api/')) {
          console.log(`📊 API ${req.method} ${req.path}: ${duration}ms (${res.statusCode})`);
        }
      });
      
      next();
    };
  }

  private recordMetric(duration: number, statusCode: number) {
    this.metrics.requestCount++;
    
    if (statusCode >= 400) {
      this.metrics.errorCount++;
    }
    
    if (duration > 1000) {
      this.metrics.slowRequestCount++;
    }
    
    // Keep last 100 response times for average calculation
    this.responseTimes.push(duration);
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
    
    // Calculate rolling average
    this.metrics.averageResponseTime = 
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  logSummary() {
    console.log('📊 PERFORMANCE SUMMARY:');
    console.log(`   Average Response Time: ${this.metrics.averageResponseTime.toFixed(2)}ms`);
    console.log(`   Total Requests: ${this.metrics.requestCount}`);
    console.log(`   Error Count: ${this.metrics.errorCount}`);
    console.log(`   Slow Requests (>1s): ${this.metrics.slowRequestCount}`);
    console.log(`   Error Rate: ${((this.metrics.errorCount / this.metrics.requestCount) * 100).toFixed(2)}%`);
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Log summary every 5 minutes
setInterval(() => {
  performanceMonitor.logSummary();
}, 5 * 60 * 1000);
