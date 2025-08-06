import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  User, 
  FileText, 
  Clock, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp,
  Eye,
  Edit,
  Check,
  X,
  Upload,
  Download,
  RefreshCw
} from 'lucide-react';

interface ActivityItem {
  id: number;
  userId: number;
  userRole: string;
  userEmail: string;
  userName: string;
  action: string;
  actionCategory: string;
  actionDescription: string;
  targetType: string;
  targetId: number;
  targetName: string;
  details: any;
  createdAt: string;
  source: 'system' | 'editor';
}

interface ActivityTimelineCardProps {
  jobId: number;
}

export function ActivityTimelineCard({ jobId }: ActivityTimelineCardProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const fetchActivityLog = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/jobs/${jobId}/activity-log?limit=20`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch activity log');
        }

        const data = await response.json();
        setActivities(data.activities || []);
        setHasMore(data.hasMore || false);
      } catch (err) {
        console.error('Error fetching activity log:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      fetchActivityLog();
    }
  }, [jobId]);

  const getActionIcon = (action: string, category: string) => {
    switch (category) {
      case 'authentication':
        return <User className="h-4 w-4" />;
      case 'job_management':
        return <FileText className="h-4 w-4" />;
      case 'document_management':
        return <FileText className="h-4 w-4" />;
      case 'user_management':
        return <User className="h-4 w-4" />;
      default:
        if (action.includes('upload')) return <Upload className="h-4 w-4" />;
        if (action.includes('download')) return <Download className="h-4 w-4" />;
        if (action.includes('view')) return <Eye className="h-4 w-4" />;
        if (action.includes('edit')) return <Edit className="h-4 w-4" />;
        if (action.includes('approve')) return <Check className="h-4 w-4" />;
        if (action.includes('reject')) return <X className="h-4 w-4" />;
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActionColor = (category: string, action: string) => {
    if (action.includes('approve') || action.includes('complete')) {
      return 'text-green-600 bg-green-100';
    }
    if (action.includes('reject') || action.includes('delete') || action.includes('cancel')) {
      return 'text-red-600 bg-red-100';
    }
    if (action.includes('warning') || action.includes('pending')) {
      return 'text-yellow-600 bg-yellow-100';
    }
    
    switch (category) {
      case 'authentication':
        return 'text-blue-600 bg-blue-100';
      case 'job_management':
        return 'text-blue-600 bg-blue-100';
      case 'document_management':
        return 'text-orange-600 bg-orange-100';
      case 'user_management':
        return 'text-indigo-600 bg-indigo-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const displayedActivities = expanded ? activities : activities.slice(0, 5);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading activity log...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-red-600">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span>Error: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Activity Timeline
          </div>
          {activities.length > 0 && (
            <Badge variant="outline">{activities.length} events</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length > 0 ? (
          <div className="space-y-4">
            {/* Timeline */}
            <div className="relative">
              {displayedActivities.map((activity, index) => (
                <div key={activity.id} className="relative flex items-start space-x-3 pb-4">
                  {/* Timeline line */}
                  {index < displayedActivities.length - 1 && (
                    <div className="absolute left-4 top-8 h-full w-0.5 bg-gray-200"></div>
                  )}
                  
                  {/* Activity icon */}
                  <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${getActionColor(activity.actionCategory, activity.action)}`}>
                    {getActionIcon(activity.action, activity.actionCategory)}
                  </div>
                  
                  {/* Activity content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {activity.actionDescription || activity.action}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <p className="text-xs text-gray-500">
                            {activity.userName || activity.userEmail || 'System'}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {activity.userRole || activity.source}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center text-xs text-gray-500">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatTimeAgo(activity.createdAt)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Target info */}
                    {activity.targetType && activity.targetName && (
                      <p className="text-xs text-gray-600 mt-1">
                        Target: {activity.targetType} - {activity.targetName}
                      </p>
                    )}
                    
                    {/* Additional details */}
                    {activity.details && Object.keys(activity.details).length > 0 && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                        <pre className="text-gray-600 whitespace-pre-wrap">
                          {JSON.stringify(activity.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Show more/less button */}
            {activities.length > 5 && (
              <div className="flex justify-center pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show More ({activities.length - 5} more)
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Load more button */}
            {hasMore && expanded && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // TODO: Implement pagination
                    console.log('Load more activities');
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Load More
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <Activity className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-2">No activity recorded</p>
            <p className="text-xs text-gray-400">
              Activity will appear here as users interact with this job
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 