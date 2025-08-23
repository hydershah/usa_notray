import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Download,
  Settings
} from 'lucide-react';

interface TagPerformanceData {
  tagType: string;
  totalOperations: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  lastUpdated: string;
}

interface PerformanceMetrics {
  totalOperations: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  slowOperations: Array<{
    tagType: string;
    operation: string;
    duration: number;
    timestamp: string;
  }>;
  tagTypeBreakdown: Record<string, TagPerformanceData>;
}

/**
 * Comprehensive tag performance monitoring dashboard
 * Tracks performance for all tag types: signature, initials, date, commission, expiration, disclosure, seal, and whiteout
 */
export const TagPerformanceDashboard: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics>({
    totalOperations: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    errorRate: 0,
    slowOperations: [],
    tagTypeBreakdown: {}
  });
  const [isLoading, setIsLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds

  // Mock performance data for demonstration
  const mockPerformanceData: PerformanceMetrics = {
    totalOperations: 1247,
    averageResponseTime: 156,
    cacheHitRate: 87.3,
    errorRate: 2.1,
    slowOperations: [
      { tagType: 'S', operation: 'signature_upload', duration: 2340, timestamp: '2025-01-27T10:30:00Z' },
      { tagType: 'E', operation: 'seal_generation', duration: 1890, timestamp: '2025-01-27T10:28:00Z' },
      { tagType: 'I', operation: 'initials_validation', duration: 1560, timestamp: '2025-01-27T10:25:00Z' }
    ],
    tagTypeBreakdown: {
      'S': { tagType: 'S', totalOperations: 456, averageResponseTime: 89, cacheHitRate: 92.1, errorRate: 1.2, lastUpdated: '2025-01-27T10:30:00Z' },
      'I': { tagType: 'I', totalOperations: 234, averageResponseTime: 45, cacheHitRate: 95.7, errorRate: 0.8, lastUpdated: '2025-01-27T10:29:00Z' },
      'D': { tagType: 'D', totalOperations: 189, averageResponseTime: 23, cacheHitRate: 98.9, errorRate: 0.1, lastUpdated: '2025-01-27T10:28:00Z' },
      'N': { tagType: 'N', totalOperations: 156, averageResponseTime: 67, cacheHitRate: 88.5, errorRate: 2.8, lastUpdated: '2025-01-27T10:27:00Z' },
      'X': { tagType: 'X', totalOperations: 134, averageResponseTime: 34, cacheHitRate: 96.2, errorRate: 0.7, lastUpdated: '2025-01-27T10:26:00Z' },
      'O': { tagType: 'O', totalOperations: 98, averageResponseTime: 78, cacheHitRate: 85.1, errorRate: 3.2, lastUpdated: '2025-01-27T10:25:00Z' },
      'E': { tagType: 'E', totalOperations: 89, averageResponseTime: 234, cacheHitRate: 76.3, errorRate: 4.5, lastUpdated: '2025-01-27T10:24:00Z' },
      'W': { tagType: 'W', totalOperations: 67, averageResponseTime: 56, cacheHitRate: 91.0, errorRate: 1.8, lastUpdated: '2025-01-27T10:23:00Z' }
    }
  };

  // Load performance data
  const loadPerformanceData = useCallback(async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call to TagPerformanceService
      // const response = await fetch('/api/tag-performance/stats');
      // const data = await response.json();
      
      // For now, use mock data
      setPerformanceData(mockPerformanceData);
    } catch (error) {
      console.error('Failed to load performance data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-refresh performance data
  useEffect(() => {
    if (!isVisible) return;

    loadPerformanceData();
    const interval = setInterval(loadPerformanceData, refreshInterval);
    
    return () => clearInterval(interval);
  }, [isVisible, refreshInterval, loadPerformanceData]);

  // Get performance status
  const getPerformanceStatus = () => {
    if (performanceData.averageResponseTime < 100) return { status: 'excellent', color: 'bg-green-500', icon: CheckCircle };
    if (performanceData.averageResponseTime < 300) return { status: 'good', color: 'bg-yellow-500', icon: Clock };
    if (performanceData.averageResponseTime < 500) return { status: 'fair', color: 'bg-orange-500', icon: AlertTriangle };
    return { status: 'poor', color: 'bg-red-500', icon: AlertTriangle };
  };

  // Get tag type display info
  const getTagTypeDisplay = (tagType: string) => {
    const displays: Record<string, { label: string; icon: string; color: string }> = {
      'S': { label: 'Signature', icon: '✍️', color: 'bg-blue-500' },
      'I': { label: 'Initials', icon: '🔤', color: 'bg-green-500' },
      'D': { label: 'Date', icon: '📅', color: 'bg-purple-500' },
      'N': { label: 'Commission', icon: '🆔', color: 'bg-orange-500' },
      'X': { label: 'Expiration', icon: '⏰', color: 'bg-red-500' },
      'O': { label: 'Disclosure', icon: '📋', color: 'bg-yellow-500' },
      'E': { label: 'Seal', icon: '🔖', color: 'bg-indigo-500' },
      'W': { label: 'Whiteout', icon: '⬜', color: 'bg-gray-500' }
    };
    
    return displays[tagType] || { label: 'Unknown', icon: '🏷️', color: 'bg-gray-400' };
  };

  // Export performance data
  const exportPerformanceData = useCallback(() => {
    const dataStr = JSON.stringify(performanceData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tag-performance-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [performanceData]);

  const performanceStatus = getPerformanceStatus();

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-20 z-50"
      >
        <BarChart3 className="w-4 h-4 mr-2" />
        Performance
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-[800px] z-50 shadow-lg max-h-[600px] overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Tag Performance Dashboard</span>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadPerformanceData}
              disabled={isLoading}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="breakdown">Tag Types</TabsTrigger>
            <TabsTrigger value="slow">Slow Ops</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Performance Status */}
            <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className={`w-4 h-4 rounded-full ${performanceStatus.color}`} />
              <span className="text-lg font-semibold capitalize">{performanceStatus.status}</span>
              <performanceStatus.icon className="w-6 h-6" />
              
              <div className="ml-auto text-right">
                <div className="text-2xl font-bold">{performanceData.averageResponseTime}ms</div>
                <div className="text-sm text-gray-600">Average Response</div>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium">Total Operations</span>
                  </div>
                  <div className="text-2xl font-bold mt-2">{performanceData.totalOperations.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium">Cache Hit Rate</span>
                  </div>
                  <div className="text-2xl font-bold mt-2">{performanceData.cacheHitRate.toFixed(1)}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <TrendingDown className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium">Error Rate</span>
                  </div>
                  <div className="text-2xl font-bold mt-2">{performanceData.errorRate.toFixed(1)}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-medium">Slow Operations</span>
                  </div>
                  <div className="text-2xl font-bold mt-2">{performanceData.slowOperations.length}</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tag Types Breakdown Tab */}
          <TabsContent value="breakdown" className="space-y-4">
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {Object.entries(performanceData.tagTypeBreakdown).map(([tagType, data]) => {
                const display = getTagTypeDisplay(tagType);
                return (
                  <Card key={tagType}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${display.color}`}>
                            {display.icon}
                          </div>
                          <div>
                            <div className="font-medium">{display.label}</div>
                            <div className="text-sm text-gray-600">{data.totalOperations} operations</div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-lg font-bold">{data.averageResponseTime}ms</div>
                          <div className="text-sm text-gray-600">
                            {data.cacheHitRate.toFixed(1)}% cache hit
                          </div>
                          <Badge variant={data.errorRate < 2 ? "default" : "destructive"}>
                            {data.errorRate.toFixed(1)}% errors
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Slow Operations Tab */}
          <TabsContent value="slow" className="space-y-4">
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {performanceData.slowOperations.map((op, index) => {
                const display = getTagTypeDisplay(op.tagType);
                return (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${display.color}`}>
                            {display.icon}
                          </div>
                          <div>
                            <div className="font-medium">{display.label} - {op.operation}</div>
                            <div className="text-sm text-gray-600">
                              {new Date(op.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        
                        <Badge variant="destructive" className="text-lg">
                          {op.duration}ms
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            <div className="text-center text-gray-500 py-8">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>Performance trends and analytics</p>
              <p className="text-sm">Coming soon...</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex space-x-2 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={exportPerformanceData}
            className="flex-1"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshInterval(prev => prev === 5000 ? 10000 : 5000)}
            className="flex-1"
          >
            <Settings className="w-4 h-4 mr-2" />
            {refreshInterval === 5000 ? '5s' : '10s'} Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
