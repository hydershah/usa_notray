import { performance } from 'perf_hooks';

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
  success: boolean;
}

interface DocumentLoadingMetrics {
  sessionCreation: PerformanceMetric[];
  documentPreview: PerformanceMetric[];
  cacheOperations: PerformanceMetric[];
  signedUrlGeneration: PerformanceMetric[];
}

export class DocumentPerformanceMonitor {
  private static instance: DocumentPerformanceMonitor;
  private metrics: DocumentLoadingMetrics = {
    sessionCreation: [],
    documentPreview: [],
    cacheOperations: [],
    signedUrlGeneration: []
  };
  
  private readonly MAX_METRICS_PER_TYPE = 100; // Keep last 100 metrics per type
  
  public static getInstance(): DocumentPerformanceMonitor {
    if (!DocumentPerformanceMonitor.instance) {
      DocumentPerformanceMonitor.instance = new DocumentPerformanceMonitor();
    }
    return DocumentPerformanceMonitor.instance;
  }
  
  /**
   * Track session creation performance
   */
  public trackSessionCreation(sessionId: string, duration: number, success: boolean, metadata: Record<string, any> = {}): void {
    const metric: PerformanceMetric = {
      operation: 'session_creation',
      duration,
      timestamp: new Date(),
      metadata: { sessionId, ...metadata },
      success
    };
    
    this.addMetric('sessionCreation', metric);
    this.logPerformanceIssue(metric, 500); // Alert if session creation > 500ms
  }
  
  /**
   * Track document preview performance
   */
  public trackDocumentPreview(documentId: string, jobId: string, duration: number, cacheHit: boolean, success: boolean): void {
    const metric: PerformanceMetric = {
      operation: 'document_preview',
      duration,
      timestamp: new Date(),
      metadata: { documentId, jobId, cacheHit },
      success
    };
    
    this.addMetric('documentPreview', metric);
    this.logPerformanceIssue(metric, cacheHit ? 50 : 300); // Different thresholds for cache hit/miss
  }
  
  /**
   * Track cache operation performance
   */
  public trackCacheOperation(operation: 'get' | 'set', key: string, duration: number, success: boolean): void {
    const metric: PerformanceMetric = {
      operation: `cache_${operation}`,
      duration,
      timestamp: new Date(),
      metadata: { key, cacheOperation: operation },
      success
    };
    
    this.addMetric('cacheOperations', metric);
    this.logPerformanceIssue(metric, 100); // Alert if cache operation > 100ms
  }
  
  /**
   * Track signed URL generation performance
   */
  public trackSignedUrlGeneration(filePath: string, duration: number, success: boolean): void {
    const metric: PerformanceMetric = {
      operation: 'signed_url_generation',
      duration,
      timestamp: new Date(),
      metadata: { filePath },
      success
    };
    
    this.addMetric('signedUrlGeneration', metric);
    this.logPerformanceIssue(metric, 200); // Alert if URL generation > 200ms
  }
  
  /**
   * Get performance summary for the last hour
   */
  public getPerformanceSummary(): Record<string, any> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const summary = {
      timestamp: now,
      timeframe: 'last_hour',
      sessionCreation: this.getOperationStats('sessionCreation', oneHourAgo),
      documentPreview: this.getOperationStats('documentPreview', oneHourAgo),
      cacheOperations: this.getOperationStats('cacheOperations', oneHourAgo),
      signedUrlGeneration: this.getOperationStats('signedUrlGeneration', oneHourAgo),
      cacheHitRate: this.calculateCacheHitRate(oneHourAgo)
    };
    
    return summary;
  }
  
  /**
   * Get document loading health status
   */
  public getHealthStatus(): { status: 'healthy' | 'degraded' | 'unhealthy', issues: string[] } {
    const summary = this.getPerformanceSummary();
    const issues: string[] = [];
    
    // Check session creation performance
    if (summary.sessionCreation.avgDuration > 800) {
      issues.push(`Session creation averaging ${Math.round(summary.sessionCreation.avgDuration)}ms (target: <500ms)`);
    }
    
    // Check document preview performance
    if (summary.documentPreview.avgDuration > 400) {
      issues.push(`Document preview averaging ${Math.round(summary.documentPreview.avgDuration)}ms (target: <200ms)`);
    }
    
    // Check cache hit rate
    if (summary.cacheHitRate < 0.7) {
      issues.push(`Cache hit rate too low: ${Math.round(summary.cacheHitRate * 100)}% (target: >70%)`);
    }
    
    // Check cache performance
    if (summary.cacheOperations.avgDuration > 150) {
      issues.push(`Cache operations averaging ${Math.round(summary.cacheOperations.avgDuration)}ms (target: <100ms)`);
    }
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (issues.length === 0) {
      status = 'healthy';
    } else if (issues.length <= 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }
    
    return { status, issues };
  }
  
  /**
   * Export performance data for analysis
   */
  public exportMetrics(): DocumentLoadingMetrics {
    return { ...this.metrics };
  }
  
  private addMetric(type: keyof DocumentLoadingMetrics, metric: PerformanceMetric): void {
    this.metrics[type].push(metric);
    
    // Keep only the most recent metrics
    if (this.metrics[type].length > this.MAX_METRICS_PER_TYPE) {
      this.metrics[type] = this.metrics[type].slice(-this.MAX_METRICS_PER_TYPE);
    }
  }
  
  private logPerformanceIssue(metric: PerformanceMetric, threshold: number): void {
    if (metric.duration > threshold) {
      console.warn(`🐌 SLOW ${metric.operation.toUpperCase()}: ${Math.round(metric.duration)}ms (threshold: ${threshold}ms)`, {
        operation: metric.operation,
        duration: `${Math.round(metric.duration)}ms`,
        threshold: `${threshold}ms`,
        metadata: metric.metadata,
        success: metric.success
      });
    }
  }
  
  private getOperationStats(type: keyof DocumentLoadingMetrics, since: Date): Record<string, any> {
    const recentMetrics = this.metrics[type].filter(m => m.timestamp >= since);
    
    if (recentMetrics.length === 0) {
      return { count: 0, avgDuration: 0, successRate: 0 };
    }
    
    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const successCount = recentMetrics.filter(m => m.success).length;
    
    return {
      count: recentMetrics.length,
      avgDuration: totalDuration / recentMetrics.length,
      maxDuration: Math.max(...recentMetrics.map(m => m.duration)),
      minDuration: Math.min(...recentMetrics.map(m => m.duration)),
      successRate: successCount / recentMetrics.length,
      lastUpdated: recentMetrics[recentMetrics.length - 1]?.timestamp
    };
  }
  
  private calculateCacheHitRate(since: Date): number {
    const recentPreviews = this.metrics.documentPreview.filter(m => m.timestamp >= since);
    
    if (recentPreviews.length === 0) {
      return 0;
    }
    
    const cacheHits = recentPreviews.filter(m => m.metadata?.cacheHit === true).length;
    return cacheHits / recentPreviews.length;
  }
}

// Export a singleton instance
export const documentPerformanceMonitor = DocumentPerformanceMonitor.getInstance(); 