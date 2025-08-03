import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
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
  MapPin,
  Phone,
  Briefcase
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/api';

interface NotaryApproval {
  id: number;
  jobId: number;
  notaryId: number;
  titleCompany: string;
  priority: string;
  deadline?: string;
  specialInstructions?: string;
  createdAt: string;
  // Job details
  closingType?: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  jobStatus: string;
  notaryApprovalStatus: string;
  kbaRequired?: boolean;
  requiresNSA?: boolean;
  requiresSpanishSpeaking?: boolean;
  // Notary details
  notaryName?: string;
  notaryEmail?: string;
  notaryPhone?: string;
}

interface NotaryApprovalStats {
  total: number;
  pending: number;
  urgent: number;
  overdue: number;
  high: number;
  medium: number;
  low: number;
}

// Stats Cards Component
const NotaryApprovalStatsCards: React.FC<{ stats: NotaryApprovalStats; loading: boolean }> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-6">
        {Array.from({ length: 7 }).map((_, i) => (
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
    { label: 'Total Pending', value: stats.total, icon: Shield, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    { label: 'Urgent', value: stats.urgent, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
    { label: 'Overdue', value: stats.overdue, icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
    { label: 'High Priority', value: stats.high, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100' },
    { label: 'Medium Priority', value: stats.medium, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Low Priority', value: stats.low, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-6">
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

// Notary Approval Filters Component
const NotaryApprovalFilters: React.FC<{
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  priorityFilter: string;
  setPriorityFilter: (priority: string) => void;
  notaryFilter: string;
  setNotaryFilter: (notary: string) => void;
  onRefresh: () => void;
  loading: boolean;
}> = ({ searchTerm, setSearchTerm, priorityFilter, setPriorityFilter, notaryFilter, setNotaryFilter, onRefresh, loading }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by notary name, job details, or property address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      <select
        value={priorityFilter}
        onChange={(e) => setPriorityFilter(e.target.value)}
        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="all">All Priorities</option>
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      
      <select
        value={notaryFilter}
        onChange={(e) => setNotaryFilter(e.target.value)}
        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="all">All Notaries</option>
        {/* TODO: Populate with actual notary names */}
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

// Notary Approval Table Component
const NotaryApprovalTable: React.FC<{
  approvals: NotaryApproval[];
  loading: boolean;
  onViewApproval: (approval: NotaryApproval) => void;
  onContactNotary: (approval: NotaryApproval) => void;
  onEscalateApproval: (approval: NotaryApproval) => void;
}> = ({ approvals, loading, onViewApproval, onContactNotary, onEscalateApproval }) => {
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent': return <Badge variant="secondary" className="bg-red-100 text-red-800">Urgent</Badge>;
      case 'high': return <Badge variant="secondary" className="bg-orange-100 text-orange-800">High</Badge>;
      case 'medium': return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Medium</Badge>;
      case 'low': return <Badge variant="secondary" className="bg-green-100 text-green-800">Low</Badge>;
      default: return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  const getOverdueStatus = (deadline?: string) => {
    if (!deadline) return null;
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const isOverdue = deadlineDate < now;
    const daysOverdue = Math.floor((now.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (isOverdue) {
      return (
        <Badge variant="secondary" className="bg-red-100 text-red-800">
          {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
        </Badge>
      );
    }
    return null;
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
      {approvals.map((approval) => (
        <Card key={approval.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Job #{approval.jobId} - {approval.closingType || 'Notarization'}
                  </h3>
                  {getPriorityBadge(approval.priority)}
                  {getOverdueStatus(approval.deadline)}
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{approval.notaryName || 'Unknown Notary'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    <span>{approval.notaryEmail || 'No email'}</span>
                  </div>
                  {approval.propertyAddress && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{approval.propertyAddress}, {approval.propertyCity}, {approval.propertyState}</span>
                    </div>
                  )}
                  {approval.scheduledDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{approval.scheduledDate} {approval.scheduledTime}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    <span>{approval.titleCompany}</span>
                  </div>
                </div>
                
                {approval.specialInstructions && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>Special Instructions:</strong> {approval.specialInstructions}
                    </p>
                  </div>
                )}
                
                <div className="text-xs text-gray-400">
                  Assigned: {new Date(approval.createdAt).toLocaleDateString()}
                  {approval.deadline && (
                    <span className="ml-4">
                      Deadline: {new Date(approval.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewApproval(approval)}
                  className="h-8"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onContactNotary(approval)}
                  className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Contact
                </Button>
                
                {approval.priority === 'urgent' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEscalateApproval(approval)}
                    className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Escalate
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

export default function AdminNotaryApprovals() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<NotaryApproval[]>([]);
  const [stats, setStats] = useState<NotaryApprovalStats>({
    total: 0,
    pending: 0,
    urgent: 0,
    overdue: 0,
    high: 0,
    medium: 0,
    low: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [notaryFilter, setNotaryFilter] = useState("all");

  useEffect(() => {
    if (user?.role === 'admin' || user?.isAdmin) {
      fetchNotaryApprovals();
    }
  }, [user]);

  const fetchNotaryApprovals = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("GET", "/api/approval-workflow/admin-queue");
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setApprovals(data);
        
        // Calculate stats
        const now = new Date();
        const stats = {
          total: data.length,
          pending: data.length,
          urgent: data.filter(a => a.priority === 'urgent').length,
          overdue: data.filter(a => a.deadline && new Date(a.deadline) < now).length,
          high: data.filter(a => a.priority === 'high').length,
          medium: data.filter(a => a.priority === 'medium').length,
          low: data.filter(a => a.priority === 'low').length
        };
        setStats(stats);
      }
    } catch (error) {
      console.error('Error fetching notary approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewApproval = (approval: NotaryApproval) => {
    // TODO: Implement detailed view modal
    console.log('View approval:', approval);
  };

  const handleContactNotary = (approval: NotaryApproval) => {
    // TODO: Implement contact notary functionality
    console.log('Contact notary:', approval);
  };

  const handleEscalateApproval = (approval: NotaryApproval) => {
    // TODO: Implement escalation functionality
    console.log('Escalate approval:', approval);
  };

  // Filter approvals based on search and filters
  const filteredApprovals = approvals.filter(approval => {
    const matchesSearch = searchTerm === "" || 
      (approval.notaryName && approval.notaryName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (approval.propertyAddress && approval.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (approval.closingType && approval.closingType.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesPriority = priorityFilter === "all" || approval.priority === priorityFilter;
    const matchesNotary = notaryFilter === "all" || approval.notaryId.toString() === notaryFilter;
    
    return matchesSearch && matchesPriority && matchesNotary;
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Notary Approval Oversight</h1>
        <p className="text-gray-600">Monitor and manage pending notary job approvals across the system</p>
      </div>

      <NotaryApprovalStatsCards stats={stats} loading={loading} />
      
      <NotaryApprovalFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        notaryFilter={notaryFilter}
        setNotaryFilter={setNotaryFilter}
        onRefresh={fetchNotaryApprovals}
        loading={loading}
      />

      <NotaryApprovalTable
        approvals={filteredApprovals}
        loading={loading}
        onViewApproval={handleViewApproval}
        onContactNotary={handleContactNotary}
        onEscalateApproval={handleEscalateApproval}
      />

      {!loading && filteredApprovals.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No pending approvals</h3>
            <p className="text-gray-600">All notaries are caught up with their job approvals.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 