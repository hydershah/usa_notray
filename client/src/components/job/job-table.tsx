import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { JobDetailsModal } from './job-details-modal';
import { getStatusColor, formatDate, formatDateTime } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Eye, 
  Download, 
  Edit, 
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  FileText,
  Calendar,
  Building,
  User,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Trash2,
  RefreshCw,
  Copy,
  ExternalLink,
  Briefcase,
  Zap,
  Target,
  Settings,
  Grid3X3
} from 'lucide-react';
import { type Job } from '@shared/schema';

interface JobTableProps {
  onCreateJob: () => void;
}

export function JobTable({ onCreateJob }: JobTableProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all'); // New filter for assignment status
  const [notaryFilter, setNotaryFilter] = useState('all'); // New filter for notary assignments
  const [sortBy, setSortBy] = useState('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedJobs, setSelectedJobs] = useState<number[]>([]);
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user data to check permissions
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
  });

  // Check if user has permission to create jobs
  const canCreateJob = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.role === 'title_company' ||
    (currentUser.role === 'notary' && currentUser.notaryType === 'subscriber')
  );

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  // Enhanced filtering and sorting
  const filteredAndSortedJobs = useMemo(() => {
    if (!Array.isArray(jobs)) return [];
    
    let filtered = jobs.filter((job) => {
      const matchesSearch = searchTerm === '' || 
        job.internalReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.titleCompany?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.propertyAddressOne?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.closingType?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || job.jobStatus === statusFilter;
      const matchesCompany = companyFilter === 'all' || job.titleCompany === companyFilter;
      
      // Assignment status filter
      let matchesAssignment = true;
      if (assignmentFilter !== 'all') {
        switch (assignmentFilter) {
          case 'unassigned':
            matchesAssignment = !job.notaryId && !job.selectedNotary;
            break;
          case 'pending_approval':
            matchesAssignment = job.notaryApprovalStatus === 'assigned_pending_approval';
            break;
          case 'approved':
            matchesAssignment = job.notaryApprovalStatus === 'approved';
            break;
          case 'rejected':
            matchesAssignment = job.notaryApprovalStatus === 'rejected';
            break;
          case 'assigned':
            matchesAssignment = !!(job.notaryId || job.selectedNotary);
            break;
        }
      }
      
      // Notary filter
      let matchesNotary = true;
      if (notaryFilter !== 'all') {
        if (notaryFilter === 'unassigned') {
          matchesNotary = !job.notaryId && !job.selectedNotary;
        } else {
          matchesNotary = job.notaryId?.toString() === notaryFilter || job.selectedNotary === notaryFilter;
        }
      }
      
      // Date filter logic
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const jobDate = new Date(job.createdAt || '');
        const now = new Date();
        switch (dateFilter) {
          case 'today':
            matchesDate = jobDate.toDateString() === now.toDateString();
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchesDate = jobDate >= weekAgo;
            break;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            matchesDate = jobDate >= monthAgo;
            break;
        }
      }
      
      return matchesSearch && matchesStatus && matchesCompany && matchesAssignment && matchesNotary && matchesDate;
    });

    // Sort jobs
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'title':
          aValue = a.titleCompany?.toLowerCase() || '';
          bValue = b.titleCompany?.toLowerCase() || '';
          break;
        case 'status':
          aValue = a.jobStatus?.toLowerCase() || '';
          bValue = b.jobStatus?.toLowerCase() || '';
          break;
        case 'date':
          aValue = new Date(a.selectedDate || a.createdAt || 0).getTime();
          bValue = new Date(b.selectedDate || b.createdAt || 0).getTime();
          break;
        case 'created':
          aValue = new Date(a.createdAt || 0).getTime();
          bValue = new Date(b.createdAt || 0).getTime();
          break;
        case 'assignment':
          // Sort by assignment status priority: unassigned -> pending -> approved -> rejected
          const statusOrder = { 'pending_assignment': 0, 'assigned_pending_approval': 1, 'approved': 2, 'rejected': 3 };
          aValue = statusOrder[a.notaryApprovalStatus as keyof typeof statusOrder] || 0;
          bValue = statusOrder[b.notaryApprovalStatus as keyof typeof statusOrder] || 0;
          break;
        default:
          aValue = a.internalReference?.toLowerCase() || `job-${a.id}`;
          bValue = b.internalReference?.toLowerCase() || `job-${b.id}`;
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [jobs, searchTerm, statusFilter, companyFilter, dateFilter, assignmentFilter, notaryFilter, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedJobs.length / itemsPerPage);
  const paginatedJobs = filteredAndSortedJobs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get unique companies for filter
  const uniqueCompanies = useMemo(() => {
    const companies = new Set(jobs.map(job => job.titleCompany).filter(Boolean));
    return Array.from(companies);
  }, [jobs]);

  // Get unique notaries for filter
  const uniqueNotaries = useMemo(() => {
    const notaries = new Set();
    jobs.forEach(job => {
      if (job.notaryId) {
        notaries.add(job.notaryId.toString());
      }
      if (job.selectedNotary) {
        notaries.add(job.selectedNotary);
      }
    });
    return Array.from(notaries);
  }, [jobs]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: number; status: string }) => {
      const response = await apiRequest('PUT', `/api/jobs/${jobId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Success",
        description: "Job status updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update job status.",
      });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ jobIds, action, value }: { jobIds: number[]; action: string; value?: string }) => {
      const promises = jobIds.map(id => {
        switch (action) {
          case 'status':
            return apiRequest('PUT', `/api/jobs/${id}/status`, { status: value });
          case 'delete':
            return apiRequest('DELETE', `/api/jobs/${id}`);
          default:
            return Promise.resolve();
        }
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Success",
        description: `Bulk action completed for ${selectedJobs.length} jobs.`,
      });
      setSelectedJobs([]);
      setIsBulkActionOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to complete bulk action.",
      });
    },
  });

  const handleViewDetails = async (job: Job) => {
    try {
      const response = await apiRequest('GET', `/api/jobs/${job.id}`);
      const jobDetails = await response.json();
      setSelectedJob(jobDetails);
      setIsModalOpen(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load job details.",
      });
    }
  };

  const handleDownload = async (jobId: number, type: 'original' | 'notarized') => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/download/${type}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `job_${jobId}_${type}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to download file.",
      });
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleSelectJob = (jobId: number, checked: boolean) => {
    if (checked) {
      setSelectedJobs([...selectedJobs, jobId]);
    } else {
      setSelectedJobs(selectedJobs.filter(id => id !== jobId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobs(paginatedJobs.map(job => job.id));
    } else {
      setSelectedJobs([]);
    }
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortOrder === 'asc' ? 
      <ArrowUp className="w-4 h-4" /> : 
      <ArrowDown className="w-4 h-4" />;
  };

  const getStatusBadge = (status: string) => {
    const config = {
      open: { 
        variant: 'secondary' as const, 
        icon: AlertCircle, 
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 border-blue-200'
      },
      pending: { 
        variant: 'secondary' as const, 
        icon: Clock, 
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50 border-yellow-200'
      },
      completed: { 
        variant: 'default' as const, 
        icon: CheckCircle, 
        color: 'text-green-600',
        bgColor: 'bg-green-50 border-green-200'
      },
      cancelled: { 
        variant: 'destructive' as const, 
        icon: XCircle, 
        color: 'text-red-600',
        bgColor: 'bg-red-50 border-red-200'
      },
      expired: { 
        variant: 'secondary' as const, 
        icon: XCircle, 
        color: 'text-gray-600',
        bgColor: 'bg-gray-50 border-gray-200'
      },
    };

    const { icon: Icon, color, bgColor } = config[status as keyof typeof config] || config.open;

    return (
      <Badge className={`flex items-center gap-1 ${bgColor} ${color} border hover:shadow-sm transition-all duration-200`}>
        <Icon className={`w-3 h-3`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getJobProgress = (job: Job): number => {
    let progress = 0;
    if (job.propertyAddressOne) progress += 25;
    if (job.selectedDate && job.selectedTime) progress += 25;
    if (job.uploadedFile) progress += 25;
    if (job.jobStatus === 'completed') progress += 25;
    return progress;
  };

  const getAssignedNotary = (job: Job): string => {
    if (job.selectedNotary) {
      return job.selectedNotary;
    }
    return 'Unassigned';
  };

  const getAssignmentBadge = (job: Job) => {
    if (!job.notaryId && !job.selectedNotary) {
      return (
        <Badge className="flex items-center gap-1 bg-gray-50 border-gray-200 text-gray-600 hover:shadow-sm transition-all duration-200">
          <AlertCircle className="w-3 h-3" />
          Unassigned
        </Badge>
      );
    }

    const config = {
      pending_assignment: {
        icon: Clock,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50 border-orange-200',
        text: 'Pending Assignment'
      },
      assigned_pending_approval: {
        icon: Clock,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50 border-yellow-200',
        text: 'Pending Approval'
      },
      approved: {
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-50 border-green-200',
        text: 'Approved'
      },
      rejected: {
        icon: XCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-50 border-red-200',
        text: 'Rejected'
      },
      approved_with_conditions: {
        icon: AlertCircle,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 border-blue-200',
        text: 'Approved (Conditions)'
      }
    };

    const status = job.notaryApprovalStatus || 'pending_assignment';
    const { icon: Icon, color, bgColor, text } = config[status as keyof typeof config] || config.pending_assignment;

    return (
      <Badge className={`flex items-center gap-1 ${bgColor} ${color} border hover:shadow-sm transition-all duration-200`}>
        <Icon className="w-3 h-3" />
        {text}
      </Badge>
    );
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleBulkAction = () => {
    if (selectedJobs.length > 0 && bulkAction) {
      if (bulkAction === 'delete') {
        setIsBulkActionOpen(true);
      } else {
        bulkUpdateMutation.mutate({ 
          jobIds: selectedJobs, 
          action: bulkAction.split('-')[0], 
          value: bulkAction.split('-')[1] 
        });
      }
    }
  };

  const confirmBulkAction = () => {
    bulkUpdateMutation.mutate({ 
      jobIds: selectedJobs, 
      action: bulkAction 
    });
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Enhanced Header */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-t-3xl border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">All Jobs</h2>
                <p className="text-sm text-gray-600">
                  Showing {paginatedJobs.length} of {filteredAndSortedJobs.length} jobs
                  {searchTerm && ` matching "${searchTerm}"`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex bg-gray-200 rounded-lg p-1">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="h-8 px-3"
                >
                  <FileText className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-8 px-3"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
              </div>

              {/* Bulk Actions */}
              {selectedJobs.length > 0 && (
                <>
                  <Select value={bulkAction} onValueChange={setBulkAction}>
                    <SelectTrigger className="w-[140px] bg-white border-2 border-gray-200">
                      <SelectValue placeholder="Bulk Action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="status-completed">Mark Completed</SelectItem>
                      <SelectItem value="status-cancelled">Mark Cancelled</SelectItem>
                      <SelectItem value="delete">Delete Jobs</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={handleBulkAction}
                    disabled={!bulkAction || bulkUpdateMutation.isPending}
                    className="bg-white border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Apply ({selectedJobs.length})
                  </Button>
                </>
              )}

              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="bg-white border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>

              {canCreateJob && (
                <Button 
                  onClick={onCreateJob} 
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Job
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Filter Bar */}
        <div className="px-6">
          <div className="flex gap-2 flex-wrap mb-4">
            <Button
              variant={statusFilter === 'all' && assignmentFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                setAssignmentFilter('all');
                setNotaryFilter('all');
              }}
              className="h-8 px-3"
            >
              All Jobs
            </Button>
            <Button
              variant={statusFilter === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter('completed');
                setAssignmentFilter('all');
              }}
              className="h-8 px-3"
            >
              Completed
            </Button>
            <Button
              variant={assignmentFilter === 'unassigned' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setAssignmentFilter('unassigned');
                setStatusFilter('all');
              }}
              className="h-8 px-3"
            >
              Unassigned
            </Button>
            <Button
              variant={assignmentFilter === 'pending_approval' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setAssignmentFilter('pending_approval');
                setStatusFilter('all');
              }}
              className="h-8 px-3"
            >
              Pending Approval
            </Button>
            <Button
              variant={assignmentFilter === 'approved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setAssignmentFilter('approved');
                setStatusFilter('all');
              }}
              className="h-8 px-3"
            >
              Approved
            </Button>
            <Button
              variant={statusFilter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter('pending');
                setAssignmentFilter('all');
              }}
              className="h-8 px-3"
            >
              In Progress
            </Button>
          </div>
        </div>

        {/* Enhanced Filters */}
        <div className="px-6 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  placeholder="Search jobs by reference, company, address, or closing type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-11 bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl shadow-sm"
                />
              </div>
            </div>
            
            <div className="flex gap-3 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-11 bg-white border-2 border-gray-200 rounded-xl">
                  <Filter className="h-4 w-4 mr-2 text-gray-500" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>

              <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
                <SelectTrigger className="w-[160px] h-11 bg-white border-2 border-gray-200 rounded-xl">
                  <User className="h-4 w-4 mr-2 text-gray-500" />
                  <SelectValue placeholder="Assignment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignments</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Select value={notaryFilter} onValueChange={setNotaryFilter}>
                <SelectTrigger className="w-[150px] h-11 bg-white border-2 border-gray-200 rounded-xl">
                  <Briefcase className="h-4 w-4 mr-2 text-gray-500" />
                  <SelectValue placeholder="Notary" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Notaries</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {uniqueNotaries.map(notaryId => (
                    <SelectItem key={notaryId as string} value={notaryId as string}>
                      Notary {notaryId as string}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="w-[160px] h-11 bg-white border-2 border-gray-200 rounded-xl">
                  <Building className="h-4 w-4 mr-2 text-gray-500" />
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {uniqueCompanies.map(company => (
                    <SelectItem key={company} value={company}>{company}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[130px] h-11 bg-white border-2 border-gray-200 rounded-xl">
                  <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setAssignmentFilter('all');
                  setNotaryFilter('all');
                  setCompanyFilter('all');
                  setDateFilter('all');
                  setCurrentPage(1);
                }}
                className="h-11 px-4 bg-white border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="px-6 pb-6">
          {isLoading ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center gap-3 text-gray-600">
                <RefreshCw className="h-6 w-6 animate-spin" />
                <span className="text-lg">Loading jobs...</span>
              </div>
            </div>
          ) : filteredAndSortedJobs.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FileText className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchTerm ? `No jobs found matching "${searchTerm}"` : "No jobs found"}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm ? "Try adjusting your search criteria" : "Get started by creating your first job"}
              </p>
              {canCreateJob && !searchTerm && (
                <Button onClick={onCreateJob} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first job
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            // Grid View
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedJobs.map((job) => (
                <Card key={job.id} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 border-gray-100 hover:border-blue-200">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedJobs.includes(job.id)}
                          onCheckedChange={(checked) => handleSelectJob(job.id, !!checked)}
                        />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(job)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`Job #${job.id}`)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Job ID
                          </DropdownMenuItem>
                          {job.uploadedFile && (
                            <DropdownMenuItem onClick={() => handleDownload(job.id, 'original')}>
                              <Download className="h-4 w-4 mr-2" />
                              Download Original
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardTitle className="text-lg font-semibold">
                      {job.internalReference || `Job #${job.id}`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Building className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{job.titleCompany}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="h-4 w-4" />
                        <span>{getAssignedNotary(job)}</span>
                      </div>
                      {job.closingType && (
                        <Badge variant="outline" className="text-xs">
                          {job.closingType}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2">
                      {getStatusBadge(job.jobStatus)}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>Progress</span>
                          <span>{getJobProgress(job)}%</span>
                        </div>
                        <Progress value={getJobProgress(job)} className="h-2" />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <Button
                        onClick={() => handleViewDetails(job)}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // Enhanced Table View
            <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-gray-50/50">
                    <TableHead className="w-12 py-4">
                      <Checkbox
                        checked={selectedJobs.length === paginatedJobs.length && paginatedJobs.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="py-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('title')}
                        className="h-8 px-3 font-semibold text-gray-700 hover:text-blue-600"
                      >
                        Job Details
                        {getSortIcon('title')}
                      </Button>
                    </TableHead>
                    <TableHead className="py-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('status')}
                        className="h-8 px-3 font-semibold text-gray-700 hover:text-blue-600"
                      >
                        Status & Progress
                        {getSortIcon('status')}
                      </Button>
                    </TableHead>
                    <TableHead className="py-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('assignment')}
                        className="h-8 px-3 font-semibold text-gray-700 hover:text-blue-600"
                      >
                        Assignment
                        {getSortIcon('assignment')}
                      </Button>
                    </TableHead>
                    <TableHead className="py-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('date')}
                        className="h-8 px-3 font-semibold text-gray-700 hover:text-blue-600"
                      >
                        Schedule
                        {getSortIcon('date')}
                      </Button>
                    </TableHead>
                    <TableHead className="py-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('created')}
                        className="h-8 px-3 font-semibold text-gray-700 hover:text-blue-600"
                      >
                        Created
                        {getSortIcon('created')}
                      </Button>
                    </TableHead>
                    <TableHead className="py-4 font-semibold text-gray-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedJobs.map((job, index) => (
                    <TableRow 
                      key={job.id} 
                      className={`hover:bg-blue-50/50 transition-colors border-b border-gray-100 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                      }`}
                    >
                      <TableCell className="py-4">
                        <Checkbox
                          checked={selectedJobs.includes(job.id)}
                          onCheckedChange={(checked) => handleSelectJob(job.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="font-semibold text-gray-900 text-base">
                              {job.internalReference || `Job #${job.id}`}
                            </div>
                            <div className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                              <Building className="h-3 w-3" />
                              {job.titleCompany}
                            </div>
                                                      <div className="text-sm text-gray-500 flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {getAssignedNotary(job)}
                          </div>
                            {job.closingType && (
                              <Badge variant="outline" className="text-xs mt-2">
                                {job.closingType}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="space-y-3">
                          {getStatusBadge(job.jobStatus)}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-gray-600">
                              <span className="font-medium">Progress</span>
                              <span className="font-semibold">{getJobProgress(job)}%</span>
                            </div>
                            <Progress value={getJobProgress(job)} className="h-2" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="space-y-2">
                          {getAssignmentBadge(job)}
                          <div className="text-sm text-gray-600">
                            {getAssignedNotary(job)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {job.selectedDate && job.selectedTime ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Calendar className="h-4 w-4 text-blue-600" />
                              {formatDate(job.selectedDate)}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="h-4 w-4" />
                              {job.selectedTime}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Not scheduled
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="text-sm text-gray-600">
                          {formatDateTime(job.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-9 w-9 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleViewDetails(job)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`Job #${job.id}`)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Job ID
                            </DropdownMenuItem>
                            {job.uploadedFile && (
                              <DropdownMenuItem onClick={() => handleDownload(job.id, 'original')}>
                                <Download className="h-4 w-4 mr-2" />
                                Download Original
                              </DropdownMenuItem>
                            )}
                            {job.notarizedFile && (
                              <DropdownMenuItem onClick={() => handleDownload(job.id, 'notarized')}>
                                <Download className="h-4 w-4 mr-2 text-green-600" />
                                Download Notarized
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => updateStatusMutation.mutate({ jobId: job.id, status: 'cancelled' })}
                              className="text-red-600"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel Job
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Enhanced Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8 bg-white rounded-xl p-4 border-2 border-gray-100">
              <div className="text-sm text-gray-600 font-medium">
                Page {currentPage} of {totalPages} • {filteredAndSortedJobs.length} total results
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="border-2"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="border-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                {/* Page numbers */}
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-10 ${pageNum === currentPage ? 'bg-blue-600 hover:bg-blue-700' : 'border-2'}`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="border-2"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="border-2"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Replace the existing JobDetailsModal with EnhancedJobDetailsModal */}
      <JobDetailsModal
        job={selectedJob}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedJob(null);
        }}
        onStatusUpdate={(status) => {
          if (selectedJob) {
            updateStatusMutation.mutate({ jobId: selectedJob.id, status });
          }
        }}
      />

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={isBulkActionOpen} onOpenChange={setIsBulkActionOpen}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Confirm Bulk Action
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to delete {selectedJobs.length} selected jobs? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-2">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkAction}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Jobs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
