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
import { type Job } from '@shared/schema';

export default function Jobs() {
  const [, setLocation] = useLocation();

  const handleCreateJob = () => {
    setLocation('/create-job');
  };

  // Get jobs data for stats (only when authenticated)
  const { data: jobs = [] } = useAuthenticatedQuery<Job[]>(['/api/jobs']);

  // Calculate statistics
  const stats = {
    total: jobs.length,
    open: jobs.filter(job => job.jobStatus === 'open').length,
    pending: jobs.filter(job => job.jobStatus === 'pending').length,
    completed: jobs.filter(job => job.jobStatus === 'completed').length,
    unassigned: jobs.filter(job => !job.notaryId && !job.selectedNotary).length,
    pendingApproval: jobs.filter(job => job.notaryApprovalStatus === 'assigned_pending_approval').length,
    approved: jobs.filter(job => job.notaryApprovalStatus === 'approved').length,
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4">
          {/* Enhanced Header Section */}
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl opacity-90"></div>
            <div className="relative bg-white/10 backdrop-blur-sm rounded-xl p-4 shadow-2xl border border-white/20">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-white/20 to-white/10 rounded-xl flex items-center justify-center text-white shadow-lg ring-4 ring-white/20">
                <Briefcase className="w-6 h-6" />
              </div>
              <div className="text-white">
                <h1 className="text-2xl font-bold mb-1">Job Management</h1>
                <p className="text-white/80 text-sm">Track and manage all notary appointments</p>
              </div>
            </div>
                <div className="flex items-center gap-4">
                  <Button 
                    variant="ghost"
                    size="lg"
                    onClick={() => setLocation('/jobs/analytics')}
                    className="text-white hover:bg-white/10 border-2 border-white/20 hover:border-white/30 transition-all duration-200"
                  >
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Analytics
                  </Button>
                  {canCreateJob && (
                    <Button 
                      size="lg"
                      onClick={handleCreateJob}
                      className="bg-white text-gray-900 hover:bg-gray-100 px-6 py-3 rounded-xl shadow-lg transition-all duration-200"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Create New Job
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Compact Stats Cards */}
          <div className="grid grid-cols-6 gap-2 mb-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-2">
                <div className="text-center">
                  <div className="w-5 h-5 bg-blue-500 rounded mx-auto mb-1 flex items-center justify-center">
                    <Briefcase className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-xs text-blue-600 font-medium">Total</p>
                  <p className="text-lg font-bold text-blue-800">{stats.total}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-2">
                <div className="text-center">
                  <div className="w-5 h-5 bg-orange-500 rounded mx-auto mb-1 flex items-center justify-center">
                    <AlertCircle className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-xs text-orange-600 font-medium">Open</p>
                  <p className="text-lg font-bold text-orange-800">{stats.open}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
              <CardContent className="p-2">
                <div className="text-center">
                  <div className="w-5 h-5 bg-yellow-500 rounded mx-auto mb-1 flex items-center justify-center">
                    <Clock className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-xs text-yellow-600 font-medium">In Progress</p>
                  <p className="text-lg font-bold text-yellow-800">{stats.pending}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-2">
                <div className="text-center">
                  <div className="w-5 h-5 bg-green-500 rounded mx-auto mb-1 flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-xs text-green-600 font-medium">Completed</p>
                  <p className="text-lg font-bold text-green-800">{stats.completed}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <CardContent className="p-2">
                <div className="text-center">
                  <div className="w-5 h-5 bg-red-500 rounded mx-auto mb-1 flex items-center justify-center">
                    <AlertCircle className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-xs text-red-600 font-medium">Unassigned</p>
                  <p className="text-lg font-bold text-red-800">{stats.unassigned}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-2">
                <div className="text-center">
                  <div className="w-5 h-5 bg-purple-500 rounded mx-auto mb-1 flex items-center justify-center">
                    <Clock className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-xs text-purple-600 font-medium">Pending</p>
                  <p className="text-lg font-bold text-purple-800">{stats.pendingApproval}</p>
                </div>
              </CardContent>
            </Card>
          </div>



          {/* Enhanced Job Table */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <JobTable onCreateJob={handleCreateJob} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
