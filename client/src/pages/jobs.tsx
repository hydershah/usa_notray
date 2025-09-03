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
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4">
          {/* Enhanced Job Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <JobTable onCreateJob={handleCreateJob} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
