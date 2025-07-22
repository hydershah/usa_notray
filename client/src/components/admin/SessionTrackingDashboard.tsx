import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  Clock, 
  MapPin, 
  Monitor, 
  Shield, 
  AlertTriangle,
  Download,
  Eye,
  Activity,
  Globe,
  Smartphone,
  Wifi,
  Video,
  LogIn,
  MousePointer
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SessionActivity {
  id: number;
  sessionId?: string;
  jobId?: number;
  userId: number;
  userEmail: string;
  userName: string;
  userRole: string;
  activityType: 'login' | 'session_join' | 'video_join' | 'websocket_connect' | 'waiting_room_enter' | 'document_access' | 'session_complete' | 'logout';
  ipAddress: string;
  location: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    isp?: string;
    timezone?: string;
  };
  deviceInfo: {
    browser?: string;
    os?: string;
    device?: string;
    userAgent?: string;
    isMobile?: boolean;
  };
  securityFlags: {
    isVPN?: boolean;
    isProxy?: boolean;
    isTor?: boolean;
    riskScore?: number;
  };
  timestamp: Date;
  additionalData?: Record<string, any>;
}

interface JobSessionSummary {
  jobId: number;
  jobTitle: string;
  totalActivities: number;
  uniqueParticipants: number;
  sessionStartTime?: Date;
  sessionEndTime?: Date;
  activities: SessionActivity[];
  participants: {
    userId: number;
    userName: string;
    userEmail: string;
    userRole: string;
    firstJoin?: Date;
    lastActivity?: Date;
    totalActivities: number;
    location?: string;
    device?: string;
  }[];
}

interface SessionTrackingDashboardProps {
  jobId: number;
  className?: string;
  showExportButton?: boolean;
}

export const SessionTrackingDashboard: React.FC<SessionTrackingDashboardProps> = ({
  jobId,
  className = '',
  showExportButton = true
}) => {
  const [sessionSummary, setSessionSummary] = useState<JobSessionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<SessionActivity | null>(null);
  const { toast } = useToast();

  // Fetch session tracking data
  useEffect(() => {
    fetchSessionSummary();
  }, [jobId]);

  const fetchSessionSummary = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/session-tracking/jobs/${jobId}/session-summary`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch session summary: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Convert timestamp strings to Date objects
        const summary = {
          ...data.data,
          sessionStartTime: data.data.sessionStartTime ? new Date(data.data.sessionStartTime) : undefined,
          sessionEndTime: data.data.sessionEndTime ? new Date(data.data.sessionEndTime) : undefined,
          activities: data.data.activities.map((activity: any) => ({
            ...activity,
            timestamp: new Date(activity.timestamp)
          })),
          participants: data.data.participants.map((participant: any) => ({
            ...participant,
            firstJoin: participant.firstJoin ? new Date(participant.firstJoin) : undefined,
            lastActivity: participant.lastActivity ? new Date(participant.lastActivity) : undefined
          }))
        };
        
        setSessionSummary(summary);
      } else {
        throw new Error(data.error || 'Failed to load session summary');
      }

    } catch (err) {
      console.error('Failed to fetch session summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load session data');
    } finally {
      setIsLoading(false);
    }
  };

  // Export session data
  const exportSessionData = async (format: 'json' | 'csv' = 'json') => {
    try {
      const response = await fetch(`/api/session-tracking/jobs/${jobId}/export-tracking?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export session data');
      }

      // Create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job-${jobId}-session-tracking.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: `Session tracking data exported as ${format.toUpperCase()}`,
      });

    } catch (err) {
      console.error('Export failed:', err);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export session tracking data",
      });
    }
  };

  // Get activity icon
  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'login': return <LogIn className="h-4 w-4" />;
      case 'session_join': return <Users className="h-4 w-4" />;
      case 'video_join': return <Video className="h-4 w-4" />;
      case 'websocket_connect': return <Wifi className="h-4 w-4" />;
      case 'document_access': return <Eye className="h-4 w-4" />;
      case 'waiting_room_enter': return <Clock className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  // Get activity color
  const getActivityColor = (activityType: string) => {
    switch (activityType) {
      case 'login': return 'bg-green-100 text-green-800 border-green-200';
      case 'session_join': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'video_join': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'websocket_connect': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'document_access': return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'logout': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get role badge color
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'notary': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'signer': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'witness': return 'bg-green-100 text-green-800 border-green-200';
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get security risk badge
  const getSecurityRiskBadge = (riskScore: number) => {
    if (riskScore >= 7) {
      return <Badge className="bg-red-100 text-red-800 border-red-200"><AlertTriangle className="h-3 w-3 mr-1" />High Risk</Badge>;
    } else if (riskScore >= 4) {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Shield className="h-3 w-3 mr-1" />Medium Risk</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800 border-green-200"><Shield className="h-3 w-3 mr-1" />Low Risk</Badge>;
    }
  };

  // Format timestamp
  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading session tracking data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button variant="outline" size="sm" onClick={fetchSessionSummary} className="ml-2">
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!sessionSummary) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No session tracking data available for this job.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Session Tracking Dashboard
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Job #{jobId}: {sessionSummary.jobTitle}
            </p>
          </div>
          {showExportButton && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => exportSessionData('csv')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => exportSessionData('json')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Participants</span>
            </div>
            <p className="text-2xl font-bold text-blue-900 mt-1">{sessionSummary.uniqueParticipants}</p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">Total Activities</span>
            </div>
            <p className="text-2xl font-bold text-green-900 mt-1">{sessionSummary.totalActivities}</p>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">Session Duration</span>
            </div>
            <p className="text-lg font-bold text-purple-900 mt-1">
              {sessionSummary.sessionStartTime && sessionSummary.sessionEndTime ? 
                `${Math.round((sessionSummary.sessionEndTime.getTime() - sessionSummary.sessionStartTime.getTime()) / (1000 * 60))} min` :
                'Active'
              }
            </p>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">Security Status</span>
            </div>
            <p className="text-lg font-bold text-orange-900 mt-1">
              {sessionSummary.activities.some(a => a.securityFlags.riskScore && a.securityFlags.riskScore >= 7) ? 
                'High Risk' : 
                sessionSummary.activities.some(a => a.securityFlags.riskScore && a.securityFlags.riskScore >= 4) ?
                'Medium Risk' : 'Low Risk'
              }
            </p>
          </div>
        </div>

        <Tabs defaultValue="activities" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="activities">Activity Timeline</TabsTrigger>
            <TabsTrigger value="participants">Participants</TabsTrigger>
            <TabsTrigger value="security">Security Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="activities" className="space-y-4">
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {sessionSummary.activities.map((activity, index) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedActivity(activity)}
                  >
                    <div className={`p-2 rounded-full ${getActivityColor(activity.activityType)}`}>
                      {getActivityIcon(activity.activityType)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{activity.userName}</span>
                        <Badge className={getRoleBadgeColor(activity.userRole)}>
                          {activity.userRole}
                        </Badge>
                        <Badge className={getActivityColor(activity.activityType)}>
                          {activity.activityType.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {activity.location.city || 'Unknown'}, {activity.location.country || 'Unknown'}
                        </div>
                        <div className="flex items-center gap-1">
                          <Monitor className="h-3 w-3" />
                          {activity.deviceInfo.browser || 'Unknown'} on {activity.deviceInfo.os || 'Unknown'}
                        </div>
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {activity.ipAddress}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(activity.timestamp)}
                        </span>
                        {activity.securityFlags.riskScore && activity.securityFlags.riskScore > 0 && (
                          getSecurityRiskBadge(activity.securityFlags.riskScore)
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="participants" className="space-y-4">
            <div className="grid gap-4">
              {sessionSummary.participants.map((participant) => (
                <Card key={participant.userId}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{participant.userName}</h4>
                        <p className="text-sm text-gray-600">{participant.userEmail}</p>
                      </div>
                      <Badge className={getRoleBadgeColor(participant.userRole)}>
                        {participant.userRole}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">First Join:</span>
                        <p className="font-medium">
                          {participant.firstJoin ? formatTimestamp(participant.firstJoin) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Last Activity:</span>
                        <p className="font-medium">
                          {participant.lastActivity ? formatTimestamp(participant.lastActivity) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Total Activities:</span>
                        <p className="font-medium">{participant.totalActivities}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Location:</span>
                        <p className="font-medium">{participant.location || 'Unknown'}</p>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t">
                      <span className="text-gray-500 text-sm">Device:</span>
                      <p className="font-medium text-sm">{participant.device || 'Unknown'}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <div className="space-y-4">
              {/* Security Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Security Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">
                        {sessionSummary.activities.filter(a => a.securityFlags.isVPN).length}
                      </p>
                      <p className="text-sm text-gray-600">VPN Connections</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600">
                        {sessionSummary.activities.filter(a => a.securityFlags.isProxy).length}
                      </p>
                      <p className="text-sm text-gray-600">Proxy Connections</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {sessionSummary.activities.filter(a => a.securityFlags.isTor).length}
                      </p>
                      <p className="text-sm text-gray-600">Tor Connections</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-600">
                        {sessionSummary.activities.filter(a => a.securityFlags.riskScore && a.securityFlags.riskScore >= 7).length}
                      </p>
                      <p className="text-sm text-gray-600">High Risk Activities</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* High Risk Activities */}
              {sessionSummary.activities.filter(a => a.securityFlags.riskScore && a.securityFlags.riskScore >= 4).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      Security Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {sessionSummary.activities
                        .filter(a => a.securityFlags.riskScore && a.securityFlags.riskScore >= 4)
                        .map((activity) => (
                          <div key={activity.id} className="p-3 border border-red-200 bg-red-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{activity.userName} - {activity.activityType}</span>
                              {getSecurityRiskBadge(activity.securityFlags.riskScore || 0)}
                            </div>
                            <div className="text-sm text-gray-600">
                              <p>IP: {activity.ipAddress} | Location: {activity.location.city}, {activity.location.country}</p>
                              <p>Time: {formatTimestamp(activity.timestamp)}</p>
                              {activity.securityFlags.isVPN && <p className="text-red-600">⚠️ VPN detected</p>}
                              {activity.securityFlags.isProxy && <p className="text-orange-600">⚠️ Proxy detected</p>}
                              {activity.securityFlags.isTor && <p className="text-purple-600">⚠️ Tor detected</p>}
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Activity Detail Modal */}
        {selectedActivity && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-2xl w-full max-h-96 overflow-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Activity Details</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedActivity(null)}>
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-500">User:</span>
                      <p>{selectedActivity.userName} ({selectedActivity.userEmail})</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Role:</span>
                      <Badge className={getRoleBadgeColor(selectedActivity.userRole)}>
                        {selectedActivity.userRole}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Activity:</span>
                      <Badge className={getActivityColor(selectedActivity.activityType)}>
                        {selectedActivity.activityType.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Timestamp:</span>
                      <p>{formatTimestamp(selectedActivity.timestamp)}</p>
                    </div>
                  </div>

                  <div>
                    <span className="text-sm font-medium text-gray-500">Location:</span>
                    <p>{selectedActivity.location.city}, {selectedActivity.location.region}, {selectedActivity.location.country}</p>
                    <p className="text-sm text-gray-600">ISP: {selectedActivity.location.isp}</p>
                    {selectedActivity.location.latitude && selectedActivity.location.longitude && (
                      <p className="text-sm text-gray-600">
                        Coordinates: {selectedActivity.location.latitude}, {selectedActivity.location.longitude}
                      </p>
                    )}
                  </div>

                  <div>
                    <span className="text-sm font-medium text-gray-500">Device:</span>
                    <p>{selectedActivity.deviceInfo.browser} on {selectedActivity.deviceInfo.os}</p>
                    <p className="text-sm text-gray-600">Device Type: {selectedActivity.deviceInfo.device}</p>
                    {selectedActivity.deviceInfo.isMobile && (
                      <Badge className="bg-blue-100 text-blue-800">
                        <Smartphone className="h-3 w-3 mr-1" />
                        Mobile
                      </Badge>
                    )}
                  </div>

                  <div>
                    <span className="text-sm font-medium text-gray-500">Network:</span>
                    <p>IP Address: {selectedActivity.ipAddress}</p>
                    <div className="flex gap-2 mt-1">
                      {selectedActivity.securityFlags.isVPN && (
                        <Badge className="bg-red-100 text-red-800">VPN</Badge>
                      )}
                      {selectedActivity.securityFlags.isProxy && (
                        <Badge className="bg-orange-100 text-orange-800">Proxy</Badge>
                      )}
                      {selectedActivity.securityFlags.isTor && (
                        <Badge className="bg-purple-100 text-purple-800">Tor</Badge>
                      )}
                      {selectedActivity.securityFlags.riskScore && selectedActivity.securityFlags.riskScore > 0 && (
                        getSecurityRiskBadge(selectedActivity.securityFlags.riskScore)
                      )}
                    </div>
                  </div>

                  {selectedActivity.additionalData && Object.keys(selectedActivity.additionalData).length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">Additional Data:</span>
                      <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                        {JSON.stringify(selectedActivity.additionalData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 