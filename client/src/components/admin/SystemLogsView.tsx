import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Calendar,
  User,
  Building,
  FileText,
  AlertTriangle,
  Info,
  AlertCircle,
  CheckCircle,
  Eye,
  Clock,
  Globe,
  Smartphone,
  Shield,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';

interface LogEntry {
  id: number;
  userId?: number;
  userRole?: string;
  userEmail?: string;
  userName?: string;
  action: string;
  actionCategory: string;
  actionDescription: string;
  targetType?: string;
  targetId?: number;
  targetName?: string;
  jobId?: number;
  companyId?: number;
  requestMethod?: string;
  requestPath?: string;
  responseStatus?: number;
  details?: any;
  ipAddress?: string;
  severity: string;
  isSystemAction: boolean;
  isSuccessful: boolean;
  errorMessage?: string;
  createdAt: string;
  userFullName?: string;
  userUsername?: string;
  jobTitleCompany?: string;
  jobClosingType?: string;
  companyName?: string;
}

interface LogStats {
  totalActivity: number;
  errorCount: number;
  categoryStats: Array<{ category: string; count: number }>;
  severityStats: Array<{ severity: string; count: number }>;
  activeUsers: Array<{
    userId: number;
    userName: string;
    userEmail: string;
    userRole: string;
    activityCount: number;
  }>;
  timeRange: string;
}

export function SystemLogsView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [statsTimeRange, setStatsTimeRange] = useState('24h');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(categoryFilter && categoryFilter !== 'all' && { category: categoryFilter }),
        ...(severityFilter && severityFilter !== 'all' && { severity: severityFilter }),
        ...(userFilter && { userId: userFilter }),
        ...(actionFilter && { action: actionFilter }),
        ...(targetTypeFilter && { targetType: targetTypeFilter }),
        ...(dateFromFilter && { startDate: dateFromFilter }),
        ...(dateToFilter && { endDate: dateToFilter }),
      });

      const response = await fetch(`/api/admin/logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setTotalCount(data.pagination.totalCount);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/logs/stats?timeRange=${statsTimeRange}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, categoryFilter, severityFilter, userFilter, actionFilter, targetTypeFilter, dateFromFilter, dateToFilter]);

  useEffect(() => {
    fetchStats();
  }, [statsTimeRange]);

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info':
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'authentication':
        return <Shield className="h-4 w-4" />;
      case 'job_management':
        return <FileText className="h-4 w-4" />;
      case 'user_management':
        return <User className="h-4 w-4" />;
      case 'company_management':
        return <Building className="h-4 w-4" />;
      case 'document_management':
        return <FileText className="h-4 w-4" />;
      case 'payment':
        return <TrendingUp className="h-4 w-4" />;
      case 'system_admin':
        return <Activity className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const formatUserAgent = (userAgent: string | undefined) => {
    if (!userAgent) return 'Unknown';
    
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    
    return userAgent.substring(0, 20) + '...';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Activity Logs</h2>
          <p className="text-gray-600">Comprehensive audit trail of all system activities</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchLogs} size="sm" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Activity Logs
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Statistics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Activity Statistics</h3>
            <Select value={statsTimeRange} onValueChange={setStatsTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalActivity}</div>
                  <p className="text-xs text-gray-500">actions logged</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Error Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.errorCount}</div>
                  <p className="text-xs text-gray-500">failed actions</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.categoryStats.length}</div>
                  <p className="text-xs text-gray-500">active categories</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Active Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeUsers.length}</div>
                  <p className="text-xs text-gray-500">users active</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search actions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      <SelectItem value="authentication">Authentication</SelectItem>
                      <SelectItem value="job_management">Job Management</SelectItem>
                      <SelectItem value="user_management">User Management</SelectItem>
                      <SelectItem value="company_management">Company Management</SelectItem>
                      <SelectItem value="document_management">Document Management</SelectItem>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="system_admin">System Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Severity</label>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All severities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All severities</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button onClick={handleSearch} className="w-full">
                    Apply Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Activity Logs ({totalCount} total)</span>
                <Badge variant="outline">{logs.length} showing</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading logs...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-gray-50">
                          <TableCell className="font-mono text-xs">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-gray-400" />
                              {format(new Date(log.createdAt), 'MMM dd, HH:mm:ss')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <div>
                                <div className="font-medium text-sm">
                                  {log.userName || log.userUsername || 'System'}
                                </div>
                                <div className="text-xs text-gray-500">{log.userRole}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs truncate text-sm" title={log.actionDescription}>
                              {log.actionDescription}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getCategoryIcon(log.actionCategory)}
                              <span className="text-sm capitalize">
                                {log.actionCategory.replace('_', ' ')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {log.isSuccessful ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span className="text-xs">
                                {log.responseStatus && `${log.responseStatus}`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${getSeverityColor(log.severity)} text-xs`}>
                              <div className="flex items-center gap-1">
                                {getSeverityIcon(log.severity)}
                                {log.severity}
                              </div>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setSelectedLog(log)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Log Entry Details</DialogTitle>
                                  <DialogDescription>
                                    Full details for log entry #{log.id}
                                  </DialogDescription>
                                </DialogHeader>
                                {selectedLog && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Timestamp</label>
                                        <p className="text-sm">{format(new Date(selectedLog.createdAt), 'PPpp')}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">User</label>
                                        <p className="text-sm">{selectedLog.userName || 'System Action'}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Action</label>
                                        <p className="text-sm">{selectedLog.action}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Category</label>
                                        <p className="text-sm capitalize">{selectedLog.actionCategory.replace('_', ' ')}</p>
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <label className="text-sm font-medium text-gray-600">Description</label>
                                      <p className="text-sm bg-gray-50 p-3 rounded-md">{selectedLog.actionDescription}</p>
                                    </div>

                                    {selectedLog.details && (
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Additional Details</label>
                                        <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-auto">
                                          {JSON.stringify(selectedLog.details, null, 2)}
                                        </pre>
                                      </div>
                                    )}

                                    {selectedLog.errorMessage && (
                                      <div>
                                        <label className="text-sm font-medium text-red-600">Error Message</label>
                                        <p className="text-sm bg-red-50 text-red-800 p-3 rounded-md border border-red-200">
                                          {selectedLog.errorMessage}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-600">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} entries
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">Page {page}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page * pageSize >= totalCount}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 