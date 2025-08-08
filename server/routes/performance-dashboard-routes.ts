import { Express } from 'express';
import { documentPerformanceMonitor } from '../services/performance-monitor';

export function registerPerformanceDashboardRoutes(app: Express) {
  
  /**
   * GET /api/performance/dashboard
   * Get real-time performance metrics dashboard
   */
  app.get('/api/performance/dashboard', async (req: any, res) => {
    try {
      const summary = documentPerformanceMonitor.getPerformanceSummary();
      const health = documentPerformanceMonitor.getHealthStatus();
      
      const dashboard = {
        timestamp: new Date(),
        health,
        metrics: summary,
        insights: generatePerformanceInsights(summary),
        recommendations: generatePerformanceRecommendations(health, summary)
      };
      
      res.json(dashboard);
    } catch (error) {
      console.error('Performance dashboard error:', error);
      res.status(500).json({ message: 'Failed to generate performance dashboard' });
    }
  });
  
  /**
   * GET /api/performance/metrics/export
   * Export detailed performance metrics for analysis
   */
  app.get('/api/performance/metrics/export', async (req: any, res) => {
    try {
      const metrics = documentPerformanceMonitor.exportMetrics();
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=performance-metrics.json');
      res.json({
        exported: new Date(),
        metrics,
        summary: documentPerformanceMonitor.getPerformanceSummary()
      });
    } catch (error) {
      console.error('Performance export error:', error);
      res.status(500).json({ message: 'Failed to export performance metrics' });
    }
  });
  
  /**
   * GET /api/performance/health
   * Quick health check endpoint
   */
  app.get('/api/performance/health', async (req: any, res) => {
    try {
      const health = documentPerformanceMonitor.getHealthStatus();
      
      // Set appropriate HTTP status based on health
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 206 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      console.error('Performance health check error:', error);
      res.status(500).json({ 
        status: 'unhealthy', 
        issues: ['Performance monitoring system error'] 
      });
    }
  });
}

/**
 * Generate performance insights from metrics
 */
function generatePerformanceInsights(summary: Record<string, any>): string[] {
  const insights: string[] = [];
  
  // Session creation insights
  if (summary.sessionCreation.count > 0) {
    const avgTime = Math.round(summary.sessionCreation.avgDuration);
    if (avgTime < 200) {
      insights.push(`🚀 Excellent session creation: averaging ${avgTime}ms`);
    } else if (avgTime < 500) {
      insights.push(`✅ Good session creation: averaging ${avgTime}ms`);
    } else {
      insights.push(`⚠️ Slow session creation: averaging ${avgTime}ms`);
    }
  }
  
  // Document preview insights
  if (summary.documentPreview.count > 0) {
    const avgTime = Math.round(summary.documentPreview.avgDuration);
    const cacheHitRate = Math.round(summary.cacheHitRate * 100);
    
    if (cacheHitRate > 80) {
      insights.push(`💎 Excellent cache hit rate: ${cacheHitRate}% (avg response: ${avgTime}ms)`);
    } else if (cacheHitRate > 60) {
      insights.push(`✅ Good cache hit rate: ${cacheHitRate}% (avg response: ${avgTime}ms)`);
    } else {
      insights.push(`📈 Cache hit rate needs improvement: ${cacheHitRate}% (avg response: ${avgTime}ms)`);
    }
  }
  
  // Performance improvement tracking
  const fastSessions = summary.sessionCreation.count ? 
    (summary.sessionCreation.count - (summary.sessionCreation.avgDuration > 500 ? 1 : 0)) : 0;
  
  if (fastSessions > 0) {
    insights.push(`⚡ ${fastSessions} fast session(s) created in the last hour`);
  }
  
  return insights;
}

/**
 * Generate performance recommendations
 */
function generatePerformanceRecommendations(health: any, summary: Record<string, any>): string[] {
  const recommendations: string[] = [];
  
  if (health.status === 'healthy') {
    recommendations.push('✅ All systems performing optimally');
    return recommendations;
  }
  
  // Session creation recommendations
  if (summary.sessionCreation.avgDuration > 600) {
    recommendations.push('🔧 Consider implementing session pre-warming for frequently accessed jobs');
    recommendations.push('🗄️ Review database connection pooling configuration');
  }
  
  // Cache recommendations
  if (summary.cacheHitRate < 0.6) {
    recommendations.push('📦 Increase cache TTL for document previews');
    recommendations.push('🔄 Implement cache warming for popular documents');
  }
  
  // Redis performance recommendations
  if (summary.cacheOperations.avgDuration > 100) {
    recommendations.push('⚡ Check Redis server performance and memory usage');
    recommendations.push('🌐 Consider Redis connection pooling optimization');
  }
  
  // Signed URL recommendations
  if (summary.signedUrlGeneration.avgDuration > 250) {
    recommendations.push('🔗 Review Vultr API performance and timeout settings');
    recommendations.push('📊 Consider implementing signed URL batch generation');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('🔍 Performance issues detected - review specific metrics for details');
  }
  
  return recommendations;
} 