import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { 
  Briefcase, 
  Users, 
  FileText, 
  Calendar, 
  Settings, 
  PlusCircle,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Building2,
  Eye,
  UserCheck,
  Target,
  BarChart3,
  Shield,
  Bell,
  User
} from 'lucide-react';
import { type Job } from '@shared/types';
import { getStatusColor, isMobileDevice } from '@/lib/utils';

interface ManagerStats {
  totalJobs: number;
  pendingJobs: number;
  completedJobs: number;
  openJobs: number;
  monthlyRevenue: number;
  totalUsers: number;
  activeNotaries: number;
  pendingInvitations: number;
}

export function TitleCompanyDashboard() {
  const { user } = useAuth();
  const [signingJobs, setSigningJobs] = useState<any[]>([]);
  
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<ManagerStats>({
    queryKey: ['/api/dashboard/stats'],
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const { data: jobsResponse, isLoading: jobsLoading, error: jobsError } = useQuery<{
    jobs: Job[];
    totalCount: number;
    hasMore: boolean;
    currentPage: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['/api/jobs'],
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const getJobStatus = (job: any): string => job?.jobStatus || job?.job_status || job?.status || 'open';

  // Fetch signing assignments for dual role users
  useEffect(() => {
    const fetchSigningJobs = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await fetch('/api/jobs/signing-assignments', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setSigningJobs(data.jobs || []);
        }
      } catch (error) {
        console.warn('Error fetching signing assignments:', error);
        setSigningJobs([]);
      }
    };

    fetchSigningJobs();
  }, []);

  // Safely extract jobs array from response and ensure it's always an array
  const recentJobs = Array.isArray(jobsResponse?.jobs) ? jobsResponse.jobs : [];
  const recentJobsSlice = recentJobs.slice(0, 5);

  // Show error alerts if API calls fail
  if (statsError || jobsError) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Title Company Dashboard</h1>
        {statsError && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Stats Error:</strong> Unable to load dashboard statistics. Please refresh the page or contact support.
            </AlertDescription>
          </Alert>
        )}
        {jobsError && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Jobs Error:</strong> Unable to load recent jobs. Please refresh the page or contact support.
            </AlertDescription>
          </Alert>
        )}
        <Button 
          onClick={() => window.location.reload()} 
          className="mt-4"
        >
          Refresh Page
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Title Company Dashboard
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-gray-600">Welcome back, {user?.username}</p>
              <Badge variant="default" className="bg-blue-100 text-blue-800">
                <Building2 className="h-3 w-3 mr-1" />
                Title Company
              </Badge>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <Link to="/jobs">
                <Eye className="h-4 w-4 mr-2" />
                View All Orders
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/user-management">
                <Users className="h-4 w-4 mr-2" />
                Manage Users
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/create-job">
                <PlusCircle className="h-4 w-4 mr-2" />
                Create New Order
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <div className="text-3xl font-bold text-gray-900 mt-2">
                    {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.totalJobs || 0}
                  </div>
                </div>
                <Briefcase className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Orders</p>
                  <div className="text-3xl font-bold text-gray-900 mt-2">
                    {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.pendingJobs || 0}
                  </div>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <div className="text-3xl font-bold text-gray-900 mt-2">
                    {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.completedJobs || 0}
                  </div>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Notaries</p>
                  <div className="text-3xl font-bold text-gray-900 mt-2">
                    {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.activeNotaries || 0}
                  </div>
                </div>
                <UserCheck className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders Section */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Recent Orders
              </CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link to="/jobs">
                  View All Orders
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jobsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))
              ) : recentJobsSlice.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
                  <p className="text-gray-600 mb-4">Get started by creating your first notarization order</p>
                  <Button asChild>
                    <Link to="/create-job">Create First Order</Link>
                  </Button>
                </div>
              ) : (
                recentJobsSlice.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">Order #{job.id}</h4>
                          <p className="text-sm text-gray-600">{job.titleCompany}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {job.propertyAddressOne}
                            {job.propertyCity && `, ${job.propertyCity}`}
                            {job.propertyState && `, ${job.propertyState}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(getJobStatus(job))}>
                            {getJobStatus(job)}
                          </Badge>
                          {job.selectedDate && (
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(job.selectedDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Signing Jobs (Dual Role) */}
        {signingJobs.length > 0 && (
          <Card className="border-0 shadow-sm border-l-4 border-l-red-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4 text-red-600" />
                  Signing Assignments
                  <Badge className="bg-red-100 text-red-800 text-xs">
                    Acting as Signer
                  </Badge>
                </CardTitle>
                <div className="text-xs text-gray-500">
                  {signingJobs.length} job{signingJobs.length !== 1 ? 's' : ''}
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Jobs where you are invited as a signer (not title company role)
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {signingJobs.slice(0, 3).map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900 flex items-center gap-2">
                            Order #{job.id}
                            <Badge className="bg-red-100 text-red-800 text-xs">
                              Signing Job
                            </Badge>
                          </h4>
                          <p className="text-sm text-gray-600">{job.titleCompany}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Role: {job.userPrimaryRole} → {job.jobSpecificRole}
                          </p>
                          {job.propertyAddressOne && (
                            <p className="text-xs text-gray-500">
                              {job.propertyAddressOne}
                              {job.propertyCity && `, ${job.propertyCity}`}
                              {job.propertyState && `, ${job.propertyState}`}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex flex-col gap-2">
                          <Badge className={getStatusColor(getJobStatus(job))}>
                            {getJobStatus(job)}
                          </Badge>
                          {job.requiresIdVerification && !job.idVerificationCompleted ? (
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="text-xs border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                            >
                              <Link to={`/id-verification?jobId=${job.id}`}>
                                Complete Verification
                              </Link>
                            </Button>
                          ) : job.canJoinSigning ? (
                            <Button
                              size="sm"
                              className="text-xs bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => {
                                const signingUrl = `/editor/${job.id}?mode=signing`;
                                if (isMobileDevice()) {
                                  window.location.href = signingUrl;
                                } else {
                                  window.open(signingUrl, '_blank');
                                }
                              }}
                            >
                              Join Signing
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-500">Waiting for session</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Title Company Information */}
        <Alert className="border-blue-200 bg-blue-50">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Title Company Access:</strong> You have permissions to create notarization orders, manage signers, and oversee your company's operations. 
            You can efficiently create and manage notarization orders for your title company.
          </AlertDescription>
        </Alert>
      </div>
  );
} 