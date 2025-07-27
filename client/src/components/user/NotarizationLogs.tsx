import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { 
  FileText, 
  Search, 
  Download, 
  Calendar, 
  Clock, 
  User, 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Eye,
  Filter,
  RefreshCw,
  Activity,
  Video,
  Stamp,
  Users,
  Building
} from 'lucide-react';

interface NotaryLogEntry {
  id: number;
  sessionId: number;
  notaryId: number;
  signerId: number;
  documentId: number;
  notarizationType: string;
  pageNumber: number;
  timestamp: string;
  createdAt: string;
  notaryName: string;
  signerName: string;
  documentName: string;
  jobTitle?: string;
  jobId?: number;
}

interface AuditTrailEntry {
  id: number;
  sessionId: number;
  userId: number;
  action: string;
  details: any;
  documentId?: number;
  pageNumber?: number;
  timestamp: string;
  userName: string;
  documentName?: string;
  jobTitle?: string;
}

interface SystemActivityLog {
  id: number;
  userId: number;
  userRole: string;
  userEmail: string;
  userName: string;
  action: string;
  actionCategory: string;
  actionDescription: string;
  targetType?: string;
  targetId?: number;
  targetName?: string;
  jobId?: number;
  requestMethod?: string;
  requestPath?: string;
  severity: string;
  isSuccessful: boolean;
  errorMessage?: string;
  createdAt: string;
}

interface NotarizationSession {
  id: number;
  jobId: number;
  jobTitle: string;
  titleCompany: string;
  notaryName: string;
  participantCount: number;
  status: string;
  startedAt: string;
  completedAt?: string;
  videoSessionId?: string;
  documents: string[];
}

export function NotarizationLogs() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<NotarizationSession | null>(null);

  // Fetch user's notarization logs
  const { data: notaryLogs = [], isLoading: notaryLogsLoading, refetch: refetchNotaryLogs } = useQuery({
    queryKey: ['/api/user/notarization-logs'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/user/notarization-logs');
      return response.json();
    },
  });

  // Fetch user's audit trail
  const { data: auditTrail = [], isLoading: auditTrailLoading, refetch: refetchAuditTrail } = useQuery({
    queryKey: ['/api/user/audit-trail'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/user/audit-trail');
      return response.json();
    },
  });

  // Fetch user's system activity logs
  const { data: activityLogs = [], isLoading: activityLogsLoading, refetch: refetchActivityLogs } = useQuery({
    queryKey: ['/api/user/activity-logs'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/user/activity-logs');
      return response.json();
    },
  });

  // Fetch user's notarization sessions
  const { data: sessions = [], isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['/api/user/notarization-sessions'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/user/notarization-sessions');
      return response.json();
    },
  });

  const refreshAllData = () => {
    refetchNotaryLogs();
    refetchAuditTrail();
    refetchActivityLogs();
    refetchSessions();
  };

  const getNotarizationTypeColor = (type: string) => {
    const colors = {
      jurat: 'bg-blue-100 text-blue-800 border-blue-200',
      acknowledgment: 'bg-green-100 text-green-800 border-green-200',
      copy_certification: 'bg-purple-100 text-purple-800 border-purple-200',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getActionColor = (action: string) => {
    if (action.includes('signed') || action.includes('completed')) return 'text-green-600';
    if (action.includes('failed') || action.includes('error')) return 'text-red-600';
    if (action.includes('started') || action.includes('created')) return 'text-blue-600';
    return 'text-gray-600';
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      critical: 'bg-red-200 text-red-900',
    };
    return colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const downloadAuditReport = async (type: 'notary' | 'audit' | 'activity' | 'sessions') => {
    try {
      const response = await apiRequest('GET', `/api/user/download-logs?type=${type}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${user?.username}_${type}_logs_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const createSampleData = async () => {
    try {
      const response = await apiRequest('POST', '/api/dev/create-sample-logs');
      const result = await response.json();
      if (result.success) {
        // Refresh all data after creating samples
        refreshAllData();
        alert('Sample data created successfully! Refresh the page to see the new logs.');
      }
    } catch (error) {
      console.error('Failed to create sample data:', error);
      alert('Failed to create sample data. Check console for details.');
    }
  };

  const filteredNotaryLogs = notaryLogs.filter((log: NotaryLogEntry) => {
    const matchesSearch = 
      log.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.documentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.notarizationType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || log.notarizationType === typeFilter;
    
    const matchesDate = dateFilter === 'all' || (() => {
      const logDate = new Date(log.createdAt);
      const now = new Date();
      switch (dateFilter) {
        case 'today':
          return logDate.toDateString() === now.toDateString();
        case 'week':
          return logDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case 'month':
          return logDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        default:
          return true;
      }
    })();
    
    return matchesSearch && matchesType && matchesDate;
  });

  const filteredAuditTrail = auditTrail.filter((entry: AuditTrailEntry) => {
    const matchesSearch = 
      entry.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.documentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const filteredActivityLogs = activityLogs.filter((log: SystemActivityLog) => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actionDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.targetName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const filteredSessions = sessions.filter((session: NotarizationSession) => {
    const matchesSearch = 
      session.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.titleCompany.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.notaryName.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Notarization & Audit Logs</h1>
          <p className="text-gray-600">Track your notarization activities and system interactions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={refreshAllData} size="sm" variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={createSampleData} size="sm" variant="outline">
            <Activity className="w-4 h-4 mr-2" />
            Create Sample Data
          </Button>
          <Button onClick={() => downloadAuditReport('activity')} size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search logs, documents, or actions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="jurat">Jurat</SelectItem>
                <SelectItem value="acknowledgment">Acknowledgment</SelectItem>
                <SelectItem value="copy_certification">Copy Certification</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different log types */}
      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Video className="w-4 h-4" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="notarizations" className="flex items-center gap-2">
            <Stamp className="w-4 h-4" />
            Notarizations
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Audit Trail
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            System Activity
          </TabsTrigger>
        </TabsList>

        {/* Notarization Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Notarization Sessions</h3>
            <Button onClick={() => downloadAuditReport('sessions')} size="sm" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Sessions
            </Button>
          </div>
          
          {sessionsLoading ? (
            <div className="text-center py-8">Loading sessions...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No notarization sessions found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSessions.map((session: NotarizationSession) => (
                <Card key={session.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <h4 className="text-lg font-semibold text-gray-900">{session.jobTitle}</h4>
                          <Badge className={session.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                            {session.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4" />
                            <span>{session.titleCompany}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>Notary: {session.notaryName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>{session.participantCount} participants</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Started: {new Date(session.startedAt).toLocaleString()}</span>
                          </div>
                          {session.completedAt && (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              <span>Completed: {new Date(session.completedAt).toLocaleString()}</span>
                            </div>
                          )}
                        </div>

                        {session.documents.length > 0 && (
                          <div>
                            <span className="text-sm font-medium text-gray-700">Documents:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {session.documents.map((doc, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  <FileText className="w-3 h-3 mr-1" />
                                  {doc}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2 ml-4">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setSelectedSession(session)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Session Details - {session.jobTitle}</DialogTitle>
                              <DialogDescription>
                                Complete information about this notarization session
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">Session ID:</span>
                                  <p className="text-gray-600">{session.id}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Job ID:</span>
                                  <p className="text-gray-600">{session.jobId}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Status:</span>
                                  <p className="text-gray-600">{session.status}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Participants:</span>
                                  <p className="text-gray-600">{session.participantCount}</p>
                                </div>
                              </div>
                              
                              {session.videoSessionId && (
                                <div>
                                  <span className="font-medium text-sm">Video Session:</span>
                                  <div className="mt-2">
                                    <Badge variant="outline" className="text-xs">
                                      <Video className="w-3 h-3 mr-1" />
                                      Session ID: {session.videoSessionId}
                                    </Badge>
                                  </div>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        {session.videoSessionId && (
                          <Button size="sm" variant="outline" disabled>
                            <Video className="w-4 h-4 mr-2" />
                            Video Session
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Notarization Logs Tab */}
        <TabsContent value="notarizations" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Notarization Actions</h3>
            <Button onClick={() => downloadAuditReport('notary')} size="sm" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Notarizations
            </Button>
          </div>
          
          {notaryLogsLoading ? (
            <div className="text-center py-8">Loading notarization logs...</div>
          ) : filteredNotaryLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No notarization logs found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotaryLogs.map((log: NotaryLogEntry) => (
                <Card key={log.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <Badge className={getNotarizationTypeColor(log.notarizationType)}>
                            {log.notarizationType.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <span className="text-sm font-medium text-gray-900">
                            {log.documentName || 'Document'}
                          </span>
                          <span className="text-xs text-gray-500">Page {log.pageNumber}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>Notary: {log.notaryName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>Signer: {log.signerName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                        
                        {log.jobTitle && (
                          <div className="text-xs text-gray-500">
                            Job: {log.jobTitle}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Session Audit Trail</h3>
            <Button onClick={() => downloadAuditReport('audit')} size="sm" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Audit Trail
            </Button>
          </div>
          
          {auditTrailLoading ? (
            <div className="text-center py-8">Loading audit trail...</div>
          ) : filteredAuditTrail.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No audit trail entries found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAuditTrail.map((entry: AuditTrailEntry) => (
                <Card key={entry.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-medium ${getActionColor(entry.action)}`}>
                            {entry.action.replace('_', ' ').toUpperCase()}
                          </span>
                          {entry.documentName && (
                            <span className="text-sm text-gray-600">on {entry.documentName}</span>
                          )}
                          {entry.pageNumber && (
                            <span className="text-xs text-gray-500">Page {entry.pageNumber}</span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{entry.userName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(entry.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                        
                        {entry.details && (
                          <div className="bg-gray-50 rounded p-2 text-xs">
                            <pre className="whitespace-pre-wrap text-gray-700">
                              {JSON.stringify(entry.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* System Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">System Activity</h3>
            <Button onClick={() => downloadAuditReport('activity')} size="sm" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Activity
            </Button>
          </div>
          
          {activityLogsLoading ? (
            <div className="text-center py-8">Loading activity logs...</div>
          ) : filteredActivityLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No activity logs found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActivityLogs.map((log: SystemActivityLog) => (
                <Card key={log.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <Badge className={getSeverityBadge(log.severity)}>
                            {log.severity.toUpperCase()}
                          </Badge>
                          <span className="text-sm font-medium text-gray-900">
                            {log.actionDescription}
                          </span>
                          {!log.isSuccessful && (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            <span>{log.action}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Filter className="w-3 h-3" />
                            <span>{log.actionCategory}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(log.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                        
                        {log.targetName && (
                          <div className="text-xs text-gray-500">
                            Target: {log.targetName}
                          </div>
                        )}
                        
                        {log.errorMessage && (
                          <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
                            {log.errorMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 