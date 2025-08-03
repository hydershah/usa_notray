import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle,
  Search,
  Filter,
  Eye,
  Mail,
  MoreHorizontal,
  Plus,
  Download,
  RefreshCw,
  AlertTriangle,
  User,
  Calendar,
  MapPin
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/api';

interface JobRequest {
  id: number;
  title: string;
  description: string;
  documentType: string;
  urgency: string;
  preferredDate?: string;
  preferredTime?: string;
  location?: string;
  requestorId: number;
  requestorEmail: string;
  requestorPhone?: string;
  status: string;
  priority: string;
  reviewedBy?: number;
  reviewedAt?: string;
  reviewNotes?: string;
  assignedNotaryId?: number;
  assignedAt?: string;
  assignmentNotes?: string;
  convertedToJobId?: number;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: any;
}

interface JobRequestStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  assigned: number;
  completed: number;
}

// Stats Cards Component
const JobRequestStatsCards: React.FC<{ stats: JobRequestStats; loading: boolean }> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-12"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    { label: 'Total Requests', value: stats.total, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
    { label: 'Assigned', value: stats.assigned, icon: User, color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
      {statCards.map((stat, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// Job Request Filters Component
const JobRequestFilters: React.FC<{
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  urgencyFilter: string;
  setUrgencyFilter: (urgency: string) => void;
  onRefresh: () => void;
  loading: boolean;
}> = ({ searchTerm, setSearchTerm, statusFilter, setStatusFilter, urgencyFilter, setUrgencyFilter, onRefresh, loading }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search requests by title, description, or requestor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="all">All Status</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="assigned">Assigned</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>
      
      <select
        value={urgencyFilter}
        onChange={(e) => setUrgencyFilter(e.target.value)}
        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="all">All Urgency</option>
        <option value="low">Low</option>
        <option value="normal">Normal</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={loading}
        className="shrink-0"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  );
};

// Job Request Table Component
const JobRequestTable: React.FC<{
  requests: JobRequest[];
  loading: boolean;
  onViewRequest: (request: JobRequest) => void;
  onApproveRequest: (request: JobRequest) => void;
  onRejectRequest: (request: JobRequest) => void;
  onAssignNotary: (request: JobRequest) => void;
}> = ({ requests, loading, onViewRequest, onApproveRequest, onRejectRequest, onAssignNotary }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'approved': return <Badge variant="secondary" className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected': return <Badge variant="secondary" className="bg-red-100 text-red-800">Rejected</Badge>;
      case 'assigned': return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Assigned</Badge>;
      case 'completed': return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Completed</Badge>;
      case 'cancelled': return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'low': return <Badge variant="outline" className="text-gray-600">Low</Badge>;
      case 'normal': return <Badge variant="outline" className="text-blue-600">Normal</Badge>;
      case 'high': return <Badge variant="outline" className="text-orange-600">High</Badge>;
      case 'urgent': return <Badge variant="outline" className="text-red-600">Urgent</Badge>;
      default: return <Badge variant="outline">{urgency}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="flex gap-2">
                <div className="h-6 bg-gray-200 rounded w-16"></div>
                <div className="h-6 bg-gray-200 rounded w-20"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <Card key={request.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{request.title}</h3>
                  {getStatusBadge(request.status)}
                  {getUrgencyBadge(request.urgency)}
                </div>
                
                <p className="text-gray-600 mb-3 line-clamp-2">{request.description}</p>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    <span>{request.documentType}</span>
                  </div>
                  {request.preferredDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{request.preferredDate}</span>
                    </div>
                  )}
                  {request.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{request.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{request.requestorEmail}</span>
                  </div>
                </div>
                
                <div className="text-xs text-gray-400">
                  Created: {new Date(request.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewRequest(request)}
                  className="h-8"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                
                {request.status === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onApproveRequest(request)}
                      className="h-8 text-green-600 border-green-200 hover:bg-green-50"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRejectRequest(request)}
                      className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </>
                )}
                
                {request.status === 'approved' && !request.assignedNotaryId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAssignNotary(request)}
                    className="h-8 text-purple-600 border-purple-200 hover:bg-purple-50"
                  >
                    <User className="h-4 w-4 mr-1" />
                    Assign
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default function AdminJobRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [stats, setStats] = useState<JobRequestStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    assigned: 0,
    completed: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");

  useEffect(() => {
    if (user?.role === 'admin' || user?.isAdmin) {
      fetchJobRequests();
    }
  }, [user]);

  const fetchJobRequests = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("GET", "/api/job-requests");
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setRequests(data);
        
        // Calculate stats
        const stats = {
          total: data.length,
          pending: data.filter(r => r.status === 'pending').length,
          approved: data.filter(r => r.status === 'approved').length,
          rejected: data.filter(r => r.status === 'rejected').length,
          assigned: data.filter(r => r.status === 'assigned').length,
          completed: data.filter(r => r.status === 'completed').length
        };
        setStats(stats);
      }
    } catch (error) {
      console.error('Error fetching job requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewRequest = (request: JobRequest) => {
    // TODO: Implement detailed view modal
    console.log('View request:', request);
  };

  const handleApproveRequest = async (request: JobRequest) => {
    try {
      const response = await apiRequest("POST", `/api/job-requests/${request.id}/review`, {
        action: 'approve',
        notes: 'Approved by admin'
      });
      
      if (response.ok) {
        fetchJobRequests(); // Refresh the list
      }
    } catch (error) {
      console.error('Error approving request:', error);
    }
  };

  const handleRejectRequest = async (request: JobRequest) => {
    try {
      const response = await apiRequest("POST", `/api/job-requests/${request.id}/review`, {
        action: 'reject',
        notes: 'Rejected by admin'
      });
      
      if (response.ok) {
        fetchJobRequests(); // Refresh the list
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const handleAssignNotary = async (request: JobRequest) => {
    // TODO: Implement notary assignment modal
    console.log('Assign notary to request:', request);
  };

  // Filter requests based on search and filters
  const filteredRequests = requests.filter(request => {
    const matchesSearch = searchTerm === "" || 
      request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.requestorEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    const matchesUrgency = urgencyFilter === "all" || request.urgency === urgencyFilter;
    
    return matchesSearch && matchesStatus && matchesUrgency;
  });

  if (!user || (user.role !== 'admin' && !user.isAdmin)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Request Management</h1>
        <p className="text-gray-600">Review and manage signer-initiated notarization requests</p>
      </div>

      <JobRequestStatsCards stats={stats} loading={loading} />
      
      <JobRequestFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        urgencyFilter={urgencyFilter}
        setUrgencyFilter={setUrgencyFilter}
        onRefresh={fetchJobRequests}
        loading={loading}
      />

      <JobRequestTable
        requests={filteredRequests}
        loading={loading}
        onViewRequest={handleViewRequest}
        onApproveRequest={handleApproveRequest}
        onRejectRequest={handleRejectRequest}
        onAssignNotary={handleAssignNotary}
      />

      {!loading && filteredRequests.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No job requests found</h3>
            <p className="text-gray-600">There are no job requests matching your current filters.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 