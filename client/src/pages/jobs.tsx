import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { JobTable } from '@/components/job/job-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthenticatedQuery } from '@/hooks/use-auth';
import { 
  Briefcase, 
  Calendar, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Plus,
  Filter,
  BarChart3,
  Users,
  FileText,
  Activity,
  AlertCircle,
  Building
} from 'lucide-react';
import { type Job } from '@shared/types';

// Type for paginated response
interface JobsResponse {
  jobs: Job[];
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}

export default function Jobs() {
  const [, setLocation] = useLocation();

  const handleCreateJob = () => {
    setLocation('/create-job');
  };

  // Get jobs data with pagination (only when authenticated)
  const { data: jobsResponse } = useAuthenticatedQuery<JobsResponse>(['/api/jobs']);
  
  // Extract jobs array from pagination response, with fallback to empty array
  const jobs = jobsResponse?.jobs || [];

  // Calculate statistics
  const stats = {
    total: jobs.length,
    open: jobs.filter(job => job.status === 'open').length,
    pending: jobs.filter(job => job.status === 'pending').length,
    completed: jobs.filter(job => job.status === 'completed').length,
    unassigned: jobs.filter(job => !job.notaryId && !job.selectedNotary).length,
    pendingApproval: jobs.filter(job => job.approvalStatus === 'assigned_pending_approval').length,
    approved: jobs.filter(job => job.approvalStatus === 'approved').length,
    thisWeek: jobs.filter(job => {
      const jobDate = new Date(job.createdAt || '');
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return jobDate >= weekAgo;
    }).length,
    thisMonth: jobs.filter(job => {
      const jobDate = new Date(job.createdAt || '');
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return jobDate >= monthAgo;
    }).length
  };

  // Get current user for permissions (only when authenticated)
  const { data: currentUser } = useAuthenticatedQuery(['/api/auth/me']);

  const canCreateJob = currentUser && (
    (currentUser as any).isAdmin ||
    (currentUser as any).role === 'admin' ||
    (currentUser as any).role === 'title_company' ||
    ((currentUser as any).role === 'notary' && (currentUser as any).notaryType === 'subscriber')
  );

  return (
    <MainLayout>
      <div className="min-h-screen bg-white">
        <div className="w-full h-full">
          {/* Enhanced Job Table */}
          <div className="w-full h-full">
            <JobTable onCreateJob={handleCreateJob} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
