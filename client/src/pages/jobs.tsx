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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Enhanced Header Section */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl opacity-90"></div>
            <div className="relative bg-white/10 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/20">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-white/20 to-white/10 rounded-2xl flex items-center justify-center text-white shadow-lg ring-4 ring-white/20">
                    <Briefcase className="w-8 h-8" />
                  </div>
                  <div className="text-white">
                    <h1 className="text-3xl font-bold mb-2">Job Management</h1>
                    <p className="text-white/80 text-lg">Track and manage all notary appointments</p>
                    <div className="flex items-center gap-4 mt-3 text-white/80">
                      <div className="flex items-center gap-1">
                        <Activity className="w-4 h-4" />
                        <span className="text-sm">{stats.total} Total Jobs</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm">{stats.thisWeek} This Week</span>
                      </div>
                    </div>
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

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Total Jobs</p>
                    <p className="text-3xl font-bold text-blue-800">{stats.total}</p>
                    <p className="text-xs text-blue-600 mt-1">All time</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <Briefcase className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-600 font-medium">Open Jobs</p>
                    <p className="text-3xl font-bold text-orange-800">{stats.open}</p>
                    <p className="text-xs text-orange-600 mt-1">Awaiting assignment</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-600 font-medium">In Progress</p>
                    <p className="text-3xl font-bold text-yellow-800">{stats.pending}</p>
                    <p className="text-xs text-yellow-600 mt-1">Active appointments</p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium">Completed</p>
                    <p className="text-3xl font-bold text-green-800">{stats.completed}</p>
                    <p className="text-xs text-green-600 mt-1">Successfully notarized</p>
                  </div>
                  <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="group hover:shadow-lg transition-all duration-300 bg-white border border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors duration-200">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">This Week</h3>
                    <p className="text-sm text-gray-600">{stats.thisWeek} jobs scheduled</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 bg-white border border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors duration-200">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">This Month</h3>
                    <p className="text-sm text-gray-600">{stats.thisMonth} jobs created</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 bg-white border border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors duration-200">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Success Rate</h3>
                    <p className="text-sm text-gray-600">
                      {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% completion
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Job Table */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
            <JobTable onCreateJob={handleCreateJob} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
