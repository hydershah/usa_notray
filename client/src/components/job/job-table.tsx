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
import { JobEditor } from './JobEditor';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getStatusColor, formatDate, formatDateTime } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Eye, 
  Download, 
  Edit, 
  Edit3,
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
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
  ExternalLink,
  Briefcase,
  Zap,
  Target,
  Settings,
  Grid3X3
} from 'lucide-react';
import { type Job } from '@shared/schema';
import { useLocation } from 'wouter';

// Type for paginated response
interface JobsResponse {
  jobs: Job[];
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}

// Type for current user
interface CurrentUser {
  id: number;
  role: string;
  notaryType?: string;
  name?: string;
  email?: string;
}

interface JobTableProps {
  onCreateJob: () => void;
}

export function JobTable({ onCreateJob }: JobTableProps) {
  const [, setLocation] = useLocation();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
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

  // Helpers to read fields from either camelCase (drizzle selects) or snake_case (raw SQL)
  const getValue = <T,>(obj: any, keys: string[], fallback?: T): T | undefined => {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== undefined && value !== null && String(value).length > 0) return value as T;
    }
    return fallback;
  };

  const getTitleCompany = (job: Job): string => getValue<string>(job as any, ['titleCompany', 'title_company'], '') || '';
  const getSelectedDate = (job: Job): string => getValue<string>(job as any, ['selectedDate', 'selected_date', 'scheduledDate', 'scheduled_date'], '') || '';
  const getSelectedTime = (job: Job): string => getValue<string>(job as any, ['selectedTime', 'selected_time', 'scheduledTime', 'scheduled_time'], '') || '';
  const getCreatedAt = (job: Job): Date | string | number => getValue<any>(job as any, ['createdAt', 'created_at'], 0) ?? 0;
  const getPropertyAddressOne = (job: Job): string => getValue<string>(job as any, ['propertyAddressOne', 'property_address_one'], '') || '';
  const getJobStatus = (job: Job): string => (getValue<string>(job as any, ['jobStatus', 'job_status', 'status'], 'open') || 'open');

  // Get current user data to check permissions
  const { data: currentUser } = useQuery<CurrentUser>({
    queryKey: ['/api/auth/me'],
  });

  // Check if user has permission to create jobs
  const canCreateJob = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.role === 'title_company' ||
    (currentUser.role === 'notary' && currentUser.notaryType === 'subscriber')
  );

  const { data: jobsResponse, isLoading } = useQuery<JobsResponse>({
    queryKey: ['/api/jobs'],
  });
  
  // Extract jobs array from pagination response, with fallback to empty array
  const jobs = jobsResponse?.jobs || [];

  // Enhanced filtering and sorting
  const filteredAndSortedJobs = useMemo(() => {
    if (!Array.isArray(jobs)) return [];
    
    let filtered = jobs.filter((job) => {
      const matchesSearch = searchTerm === '' || 
        job.internalReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getTitleCompany(job).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getPropertyAddressOne(job).toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.closingType?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || getJobStatus(job) === statusFilter;
      const matchesCompany = companyFilter === 'all' || getTitleCompany(job) === companyFilter;
      
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
          aValue = a.internalReference?.toLowerCase() || `job-${a.id}`;
          bValue = b.internalReference?.toLowerCase() || `job-${b.id}`;
          break;
        case 'status':
          aValue = getJobStatus(a).toLowerCase();
          bValue = getJobStatus(b).toLowerCase();
          break;
        case 'date':
          aValue = new Date(getSelectedDate(a) || getCreatedAt(a) || 0).getTime();
          bValue = new Date(getSelectedDate(b) || getCreatedAt(b) || 0).getTime();
          break;
        case 'company':
          aValue = getTitleCompany(a).toLowerCase();
          bValue = getTitleCompany(b).toLowerCase();
          break;
        case 'notary':
          aValue = getAssignedNotary(a).toLowerCase();
          bValue = getAssignedNotary(b).toLowerCase();
          break;
        case 'signer':
          aValue = getFirstSignerName(a).toLowerCase();
          bValue = getFirstSignerName(b).toLowerCase();
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
    const companies = new Set(jobs.map(job => getTitleCompany(job)).filter(Boolean));
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

  const handleViewDetails = (job: Job) => {
    // Open modal immediately with existing job data for better UX
    setSelectedJob(job);
    setIsModalOpen(true);
    
    // Fetch detailed data in background and update
    apiRequest('GET', `/api/jobs/${job.id}`)
      .then(response => response.json())
      .then(jobDetails => {
        setSelectedJob(jobDetails);
      })
      .catch((error: any) => {
        console.warn('Failed to load detailed job data:', error);
        // Modal already open, just show warning without blocking
        toast({
          variant: "destructive",
          title: "Warning",
          description: "Some job details may be outdated. Refresh to see latest data.",
        });
      });
  };

  const handleEditJob = (job: Job) => {
    setEditingJob(job);
    setIsEditModalOpen(true);
  };

  const handleJobUpdated = () => {
    // Refresh the jobs list
    queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    toast({
      title: "Job Updated",
      description: "Job has been updated successfully.",
    });
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

  // New utility function to format date as "Aug 14 / 6:00"
  const formatSigningDateTime = (date: string, time: string) => {
    if (!date || !time) return '—';
    
    const dateObj = new Date(date);
    const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
    const day = dateObj.getDate();
    
    // Format time to 12-hour format
    const timeObj = new Date(`2000-01-01T${time}`);
    const formattedTime = timeObj.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    return `${month} ${day} / ${formattedTime}`;
  };

  // Get first signer's name
  const getFirstSignerName = (job: Job): string => {
    // Prefer normalized camelCase if present
    const fromCamel = (job as any).firstSignerName as string | undefined;
    if (fromCamel && fromCamel.trim().length > 0) return fromCamel;

    // Support snake_case from raw SQL selections
    const fromSnake = (job as any).first_signer_name as string | undefined;
    if (fromSnake && fromSnake.trim().length > 0) return fromSnake;

    // Fallbacks: try embedded signers array if it exists for detailed fetches
    const signers = (job as any).signers as Array<{ signerName?: string }> | undefined;
    if (Array.isArray(signers) && signers.length > 0) {
      const name = signers[0]?.signerName || signers[0] && (signers[0] as any).signer_name;
      if (name && String(name).trim().length > 0) return String(name);
    }

    return '—';
  };

  // Check if user is title company (to conditionally show title company column)
  const isTitleCompany = currentUser?.role === 'title_company';
  
  // Check if user is notary (to conditionally show notary column)
  const isNotary = currentUser?.role === 'notary';

  const getStatusBadge = (status: string | null) => {
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

    const statusKey = (status || 'open') as keyof typeof config;
    const { icon: Icon, color, bgColor } = config[statusKey] || config.open;

    return (
      <Badge className={`flex items-center gap-1 ${bgColor} ${color} border hover:shadow-sm transition-all duration-200`}>
        <Icon className={`w-3 h-3`} />
        {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Open'}
      </Badge>
    );
  };

  const getJobProgress = (job: Job): number => {
    let progress = 0;
    if (job.propertyAddressOne) progress += 25;
    if (job.selectedDate && job.selectedTime) progress += 25;
    if (job.uploadedFile) progress += 25;
    if (getJobStatus(job) === 'completed') progress += 25;
    return progress;
  };

  const getAssignedNotary = (job: Job): string => {
    // Check if we have assignedNotary data with the name
    if ((job as any).notaryId || (job as any).notary_id) {
      const notaryId = (job as any).notaryId ?? (job as any).notary_id;
      return `Notary #${job.notaryId}`;
    }
    const selected = (job as any).selectedNotary ?? (job as any).selected_notary;
    if (selected) {
      return selected as string;
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
                  className="pl-12 pr-4 py-2 h-11 bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl shadow-sm"
                />
              </div>
            </div>
            
            <div className="flex gap-3 flex-wrap"></div>
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
                <Card key={job.id} className={`group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 ${
                  getJobStatus(job) === 'cancelled' 
                    ? 'bg-red-100 border-red-300 hover:border-red-400' 
                    : 'border-gray-100 hover:border-blue-200'
                }`}>
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedJobs.includes(job.id)}
                          onCheckedChange={(checked) => handleSelectJob(job.id, !!checked)}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(job)}
                        className="opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-50 hover:border-blue-300"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Job Details
                      </Button>
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
                      {getStatusBadge(getJobStatus(job))}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>Progress</span>
                          <span>{getJobProgress(job)}%</span>
                        </div>
                        <Progress value={getJobProgress(job)} className="h-2" />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <Button
                        onClick={() => handleViewDetails(job)}
                        variant="outline"
                        className="w-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Quick View
                      </Button>
                      <Button
                        onClick={() => window.open(`/jobs/${job.id}`, '_blank')}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Job View
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
                        Order Number
                        {getSortIcon('title')}
                      </Button>
                    </TableHead>
                    <TableHead className="py-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('date')}
                        className="h-8 px-3 font-semibold text-gray-700 hover:text-blue-600"
                      >
                        Signing Date
                        {getSortIcon('date')}
                      </Button>
                    </TableHead>
                    {!isTitleCompany && (
                      <TableHead className="py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('company')}
                          className="h-8 px-3 font-semibold text-gray-700 hover:text-blue-600"
                        >
                          Title Company
                          {getSortIcon('company')}
                        </Button>
                      </TableHead>
                    )}
                    {!isNotary && (
                      <TableHead className="py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('notary')}
                          className="h-8 px-3 font-semibold text-gray-700 hover:text-blue-600"
                        >
                          Notary
                          {getSortIcon('notary')}
                        </Button>
                      </TableHead>
                    )}
                    <TableHead className="py-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('signer')}
                        className="h-8 px-3 font-semibold text-gray-700 hover:text-blue-600"
                      >
                        First Signer
                        {getSortIcon('signer')}
                      </Button>
                    </TableHead>
                    <TableHead className="py-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('status')}
                        className="h-8 px-3 font-semibold text-gray-700 hover:text-blue-600"
                      >
                        Status
                        {getSortIcon('status')}
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
                        getJobStatus(job) === 'cancelled' 
                          ? 'bg-red-100 hover:bg-red-150' 
                          : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                      }`}
                    >
                      <TableCell className="py-4">
                        <Checkbox
                          checked={selectedJobs.includes(job.id)}
                          onCheckedChange={(checked) => handleSelectJob(job.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="font-semibold text-gray-900 text-base">
                          {job.internalReference || `Job #${job.id}`}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="text-sm text-gray-600">
                          {formatSigningDateTime(getSelectedDate(job) || '', getSelectedTime(job) || '')}
                        </div>
                      </TableCell>
                      {!isTitleCompany && (
                        <TableCell className="py-4">
                          <div className="text-sm text-gray-600">
                            {getTitleCompany(job) || '—'}
                          </div>
                        </TableCell>
                      )}
                      {!isNotary && (
                        <TableCell className="py-4">
                          <div className="text-sm text-gray-600">
                            {getAssignedNotary(job)}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="py-4">
                        <div className="text-sm text-gray-600">
                          {getFirstSignerName(job)}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {getStatusBadge(getJobStatus(job))}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(job)}
                            className="hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(`/jobs/${job.id}`)}
                            className="hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Details
                          </Button>
                          {canCreateJob && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditJob(job)}
                              className="hover:bg-green-50 hover:text-green-600 transition-colors"
                            >
                              <Edit3 className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                          )}
                        </div>
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

      {/* Enhanced Job Details Modal with better positioning and animation */}
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

      {/* Enhanced Job Editor Dialog with improved modal positioning */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="w-[95vw] max-w-7xl h-[95vh] p-0
                                 data-[state=open]:animate-in data-[state=closed]:animate-out 
                                 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 
                                 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 
                                 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] 
                                 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]
                                 sm:rounded-lg shadow-2xl border-2 border-gray-200">
          {editingJob && (
            <JobEditor
              jobId={editingJob.id}
              onJobUpdated={handleJobUpdated}
              onClose={() => {
                setIsEditModalOpen(false);
                setEditingJob(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Enhanced Bulk Action Confirmation Dialog */}
      <AlertDialog open={isBulkActionOpen} onOpenChange={setIsBulkActionOpen}>
        <AlertDialogContent className="sm:max-w-lg 
                                     data-[state=open]:animate-in data-[state=closed]:animate-out 
                                     data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 
                                     data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 
                                     data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] 
                                     data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]
                                     shadow-2xl border-2 border-gray-200">
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
