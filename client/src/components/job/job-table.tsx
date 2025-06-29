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
  Briefcase
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
  const [sortBy, setSortBy] = useState('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedJobs, setSelectedJobs] = useState<number[]>([]);
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  
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
      
      return matchesSearch && matchesStatus && matchesCompany && matchesDate;
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
  }, [jobs, searchTerm, statusFilter, companyFilter, dateFilter, sortBy, sortOrder]);

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
      open: { variant: 'secondary' as const, icon: AlertCircle, color: 'text-blue-600' },
      pending: { variant: 'secondary' as const, icon: Clock, color: 'text-yellow-600' },
      completed: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
      cancelled: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
      expired: { variant: 'secondary' as const, icon: XCircle, color: 'text-gray-600' },
    };

    const { variant, icon: Icon, color } = config[status as keyof typeof config] || config.open;

    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className={`w-3 h-3 ${color}`} />
        {status}
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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleBulkAction = () => {
    if (selectedJobs.length > 0 && bulkAction) {
      if (bulkAction === 'delete') {
        setIsBulkActionOpen(true);
      } else {
        // Handle other bulk actions
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
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg">
                  <Briefcase className="h-6 w-6 text-white" />
                </div>
                Job Management
              </CardTitle>
              <p className="text-gray-600 mt-2">
                Manage notary jobs and track their progress
              </p>
            </div>
            <div className="flex gap-2 mt-4 sm:mt-0">
              {selectedJobs.length > 0 && (
                <>
                  <Select value={bulkAction} onValueChange={setBulkAction}>
                    <SelectTrigger className="w-[140px]">
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
                    size="sm"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Apply ({selectedJobs.length})
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => window.location.reload()} size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {canCreateJob && (
                <Button onClick={onCreateJob} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Job
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Enhanced Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by reference, company, address, or closing type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]">
                  <Filter className="h-4 w-4 mr-2" />
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
              
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="w-[160px]">
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
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results Summary */}
          <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
            <span>
              Showing {paginatedJobs.length} of {filteredAndSortedJobs.length} jobs
              {searchTerm && ` matching "${searchTerm}"`}
            </span>
            <span>Total: {Array.isArray(jobs) ? jobs.length : 0} jobs</span>
          </div>

          {/* Enhanced Jobs Table */}
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center gap-2 text-gray-600">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Loading jobs...
                </div>
              </div>
            ) : filteredAndSortedJobs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-2">
                  {searchTerm ? `No jobs found matching "${searchTerm}"` : "No jobs found"}
                </p>
                {canCreateJob && !searchTerm && (
                  <Button onClick={onCreateJob} variant="outline" className="mt-2">
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first job
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedJobs.length === paginatedJobs.length && paginatedJobs.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('title')}
                        className="h-8 px-2 font-medium"
                      >
                        Job Details
                        {getSortIcon('title')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('status')}
                        className="h-8 px-2 font-medium"
                      >
                        Status & Progress
                        {getSortIcon('status')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('date')}
                        className="h-8 px-2 font-medium"
                      >
                        Schedule
                        {getSortIcon('date')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('created')}
                        className="h-8 px-2 font-medium"
                      >
                        Created
                        {getSortIcon('created')}
                      </Button>
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedJobs.map((job) => (
                    <TableRow key={job.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <Checkbox
                          checked={selectedJobs.includes(job.id)}
                          onCheckedChange={(checked) => handleSelectJob(job.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                              <Building className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-gray-900">
                              {job.internalReference || `Job #${job.id}`}
                            </div>
                            <div className="text-sm text-gray-600 flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              {job.titleCompany}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {job.propertyAddressOne}
                            </div>
                            {job.closingType && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {job.closingType}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          {getStatusBadge(job.jobStatus)}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-gray-600">
                              <span>Progress</span>
                              <span>{getJobProgress(job)}%</span>
                            </div>
                            <Progress value={getJobProgress(job)} className="h-1" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {job.selectedDate && job.selectedTime ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm font-medium">
                              <Calendar className="h-3 w-3 text-blue-600" />
                              {formatDate(job.selectedDate)}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Clock className="h-3 w-3" />
                              {job.selectedTime}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Not scheduled
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-500">
                          {formatDateTime(job.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
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
                            {job.notarizedFile && (
                              <DropdownMenuItem onClick={() => handleDownload(job.id, 'notarized')}>
                                <Download className="h-4 w-4 mr-2 text-green-600" />
                                Download Notarized
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ jobId: job.id, status: 'cancelled' })}>
                              <XCircle className="h-4 w-4 mr-2 text-red-600" />
                              Cancel Job
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Enhanced Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages} • {filteredAndSortedJobs.length} total results
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
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
                        className="w-10"
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
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <JobDetailsModal
        job={selectedJob}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedJob(null);
        }}
        onStatusUpdate={(jobId, status) => {
          updateStatusMutation.mutate({ jobId, status });
        }}
      />

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={isBulkActionOpen} onOpenChange={setIsBulkActionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Confirm Bulk Action
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedJobs.length} selected jobs? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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
