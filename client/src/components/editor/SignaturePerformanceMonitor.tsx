import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

interface SignaturePerformanceStats {
  totalOperations: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  slowOperations: PerformanceMetric[];
}

/**
 * Performance monitoring component for signature tag operations
 * Helps identify bottlenecks and performance issues
 */
export const SignaturePerformanceMonitor: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [stats, setStats] = useState<SignaturePerformanceStats>({
    totalOperations: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    errorRate: 0,
    slowOperations: []
  });

  // Track performance metrics
  const trackOperation = useCallback((operation: string, duration: number, success: boolean, error?: string) => {
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: Date.now(),
      success,
      error
    };

    setMetrics(prev => {
      const newMetrics = [...prev, metric];
      // Keep only last 100 metrics to prevent memory issues
      return newMetrics.slice(-100);
    });
  }, []);

  // Calculate performance statistics
  useEffect(() => {
    if (metrics.length === 0) return;

    const totalOperations = metrics.length;
    const successfulOperations = metrics.filter(m => m.success).length;
    const errorRate = ((totalOperations - successfulOperations) / totalOperations) * 100;
    
    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageResponseTime = totalDuration / totalOperations;
    
    // Calculate cache hit rate (assume operations under 50ms are cache hits)
    const cacheHits = metrics.filter(m => m.duration < 50).length;
    const cacheHitRate = (cacheHits / totalOperations) * 100;
    
    // Identify slow operations (>1000ms)
    const slowOperations = metrics
      .filter(m => m.duration > 1000)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    setStats({
      totalOperations,
      averageResponseTime,
      cacheHitRate,
      errorRate,
      slowOperations
    });
  }, [metrics]);

  // Clear metrics
  const clearMetrics = useCallback(() => {
    setMetrics([]);
    setStats({
      totalOperations: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      slowOperations: []
    });
  }, []);

  // Export performance data
  const exportMetrics = useCallback(() => {
    const dataStr = JSON.stringify(metrics, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `signature-performance-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [metrics]);

  // Performance status indicator
  const getPerformanceStatus = () => {
    if (stats.averageResponseTime < 100) return { status: 'excellent', color: 'bg-green-500', icon: CheckCircle };
    if (stats.averageResponseTime < 500) return { status: 'good', color: 'bg-yellow-500', icon: Clock };
    if (stats.averageResponseTime < 1000) return { status: 'poor', color: 'bg-orange-500', icon: AlertTriangle };
    return { status: 'critical', color: 'bg-red-500', icon: AlertTriangle };
  };

  const performanceStatus = getPerformanceStatus();

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50"
      >
        <Clock className="w-4 h-4 mr-2" />
        Performance
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 z-50 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Signature Performance Monitor</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Performance Status */}
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${performanceStatus.color}`} />
          <span className="text-sm font-medium capitalize">{performanceStatus.status}</span>
          <performanceStatus.icon className="w-4 h-4" />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <div className="text-gray-500">Total Operations</div>
            <div className="font-mono">{stats.totalOperations}</div>
          </div>
          <div className="space-y-1">
            <div className="text-gray-500">Avg Response</div>
            <div className="font-mono">{stats.averageResponseTime.toFixed(0)}ms</div>
          </div>
          <div className="space-y-1">
            <div className="text-gray-500">Cache Hit Rate</div>
            <div className="font-mono">{stats.cacheHitRate.toFixed(1)}%</div>
          </div>
          <div className="space-y-1">
            <div className="text-gray-500">Error Rate</div>
            <div className="font-mono">{stats.errorRate.toFixed(1)}%</div>
          </div>
        </div>

        {/* Slow Operations */}
        {stats.slowOperations.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-700">Slow Operations (>1s)</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {stats.slowOperations.map((op, index) => (
                <div key={index} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                  <span className="truncate">{op.operation}</span>
                  <Badge variant={op.success ? "default" : "destructive"}>
                    {op.duration}ms
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearMetrics}
            className="flex-1"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Clear
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportMetrics}
            className="flex-1"
          >
            Export
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Export the tracking function for use in other components
export const useSignaturePerformanceTracking = () => {
  const trackOperation = useCallback((operation: string, duration: number, success: boolean, error?: string) => {
    // Send to global performance tracker
    if (window.signaturePerformanceTracker) {
      window.signaturePerformanceTracker(operation, duration, success, error);
    }
  }, []);

  return { trackOperation };
};

// Global performance tracker
declare global {
  interface Window {
    signaturePerformanceTracker?: (operation: string, duration: number, success: boolean, error?: string) => void;
  }
}

// Initialize global tracker
if (typeof window !== 'undefined') {
  window.signaturePerformanceTracker = (operation: string, duration: number, success: boolean, error?: string) => {
    // This will be connected to the monitor component
    console.log(`📊 Performance: ${operation} took ${duration}ms, success: ${success}`);
  };
}
