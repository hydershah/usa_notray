import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { JobDetailsModal } from './job-details-modal';
import { getStatusColor, formatDate } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Eye, 
  Download, 
  Edit, 
  Search,
  Plus 
} from 'lucide-react';

interface JobTableProps {
  onCreateJob: () => void;
}

export function JobTable({ onCreateJob }: JobTableProps) {
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['/api/jobs'],
  });

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

  const filteredJobs = jobs.filter((job: any) => {
    const matchesStatus = statusFilter === 'all' || job.jobStatus === statusFilter;
    const matchesSearch = searchTerm === '' || 
      job.internalReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.titleCompany?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.propertyAddressOne?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  const handleViewDetails = async (job: any) => {
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

  const statusFilters = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'expired', label: 'Expired' },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Job Management</CardTitle>
            <Button onClick={onCreateJob} className="mt-4 sm:mt-0">
              <Plus className="h-4 w-4 mr-2" />
              Create New Job
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 mb-6">
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((filter) => (
                <Button
                  key={filter.value}
                  variant={statusFilter === filter.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
          </div>

          {/* Jobs Table */}
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-8">Loading jobs...</div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No jobs found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Name</TableHead>
                    <TableHead>Title Company</TableHead>
                    <TableHead>Closing Type</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job: any) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">
                            {job.internalReference || `Job #${job.id}`}
                          </div>
                          <div className="text-sm text-gray-500">
                            {job.propertyAddressOne}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{job.titleCompany}</TableCell>
                      <TableCell>{job.closingType}</TableCell>
                      <TableCell>
                        {job.selectedDate && job.selectedTime ? (
                          <div>
                            <div>{formatDate(job.selectedDate)}</div>
                            <div className="text-sm text-gray-500">{job.selectedTime}</div>
                          </div>
                        ) : (
                          'Not scheduled'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(job.jobStatus)}>
                          {job.jobStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(job)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {job.uploadedFile && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(job.id, 'original')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          {job.notarizedFile && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(job.id, 'notarized')}
                              className="text-success"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
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
    </>
  );
}
