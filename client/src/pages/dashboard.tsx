import { MainLayout } from '@/components/layout/main-layout';
import { useAuth } from '@/hooks/use-auth';
import { useNotaryProfileStatus } from '@/hooks/use-notary-profile-status';
import { useLocation } from 'wouter';

// Import role-specific dashboard components
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { NotaryDashboard } from '@/components/notary/NotaryDashboard';
import { ClientDashboard } from '@/components/client/ClientDashboard';
import { SignerDashboard } from '@/components/signer/SignerDashboard';

// Import fallback components for roles without specific dashboards
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  User,
  Eye,
  UserCheck,
  Briefcase, 
  CheckCircle, 
  Clock, 
  FileText,
  Bell,
  Calendar,
  Settings,
  AlertCircle,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'wouter';
import { type Job } from '@shared/schema';
import { getStatusColor } from '@/lib/utils';

interface DashboardStats {
  totalJobs: number;
  completedJobs: number;
  pendingJobs: number;
  openJobs: number;
}

// Company User Dashboard (for title company users)
function CompanyUserDashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  const { data: recentJobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const recentJobsSlice = recentJobs.slice(0, 3);

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.username}</h1>
            <p className="text-gray-600 mt-1">Title Company Dashboard - Manage your notary orders</p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline" size="sm">
              <Link to="/jobs">
                <Briefcase className="h-4 w-4 mr-2" />
                View Orders
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/create-job">
                <FileText className="h-4 w-4 mr-2" />
                Create New Order
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick Actions for Title Company */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button asChild className="h-20 flex flex-col items-center justify-center">
            <Link to="/create-job">
              <FileText className="h-6 w-6 mb-2" />
              <span>Create New Order</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center">
            <Link to="/jobs">
              <Briefcase className="h-6 w-6 mb-2" />
              <span>Manage Orders</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center">
            <Link to="/payments">
              <CheckCircle className="h-6 w-6 mb-2" />
              <span>Payments</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center">
            <Link to="/profile">
              <Settings className="h-6 w-6 mb-2" />
              <span>Company Settings</span>
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Orders</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalJobs || 0}</p>
                    </div>
                    <Briefcase className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Completed</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.completedJobs || 0}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pending</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.pendingJobs || 0}</p>
                    </div>
                    <Clock className="h-8 w-8 text-amber-600" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Open</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.openJobs || 0}</p>
                    </div>
                    <FileText className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Recent Orders */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))
              ) : recentJobsSlice.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No orders yet</p>
                  <Button variant="outline" size="sm" className="mt-3" asChild>
                    <Link to="/create-job">Create your first order</Link>
                  </Button>
                </div>
              ) : (
                recentJobsSlice.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{job.titleCompany}</p>
                      <p className="text-sm text-gray-600">{job.propertyAddressOne}</p>
                    </div>
                    <Badge className={getStatusColor(job.jobStatus)}>
                      {job.jobStatus}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

// Witness Dashboard (limited features)
function WitnessDashboard() {
  const { user } = useAuth();

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.username}</h1>
          <p className="text-gray-600 mt-1">Witness Dashboard - View your signing sessions</p>
        </div>

        {/* Quick Actions for Witness */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center">
            <Link to="/jobs">
              <Eye className="h-6 w-6 mb-2" />
              <span>Start New Signing</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center">
            <Link to="/jobs">
              <Briefcase className="h-6 w-6 mb-2" />
              <span>Pending List of Jobs</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center">
            <Link to="/profile">
              <User className="h-6 w-6 mb-2" />
              <span>Profile Update</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center">
            <Link to="/payments">
              <CheckCircle className="h-6 w-6 mb-2" />
              <span>Payments / Payouts</span>
            </Link>
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Sessions Completed</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">12</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Earned</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">$360</p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Payments</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">$90</p>
                </div>
                <Clock className="h-8 w-8 text-amber-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Invitations</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">3</p>
                </div>
                <Bell className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Alert className="border-blue-200 bg-blue-50">
          <Eye className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            As a witness, you can view and participate in signing sessions when invited. 
            <Link to="/jobs" className="ml-1 underline font-medium">Check for pending invitations →</Link>
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Role: Witness</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Eye className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Witness Signing Sessions</p>
                    <p className="text-sm text-gray-600">Observe and verify document signing processes</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <UserCheck className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Verify Signer Identity</p>
                    <p className="text-sm text-gray-600">Confirm the identity of document signers</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium">Review Documents</p>
                    <p className="text-sm text-gray-600">Access documents relevant to your witnessing role</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="font-medium">Receive Compensation</p>
                    <p className="text-sm text-gray-600">Get paid for your witnessing services</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-gray-600" />
                  <div>
                    <p className="font-medium">Profile Settings</p>
                    <p className="text-sm text-gray-600">Update your contact and preference information</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Payment Settings</p>
                    <p className="text-sm text-gray-600">Manage payment methods and payout preferences</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium">Notifications</p>
                    <p className="text-sm text-gray-600">Configure how you receive session invitations</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

// Observer Dashboard (very limited features)
function ObserverDashboard() {
  const { user } = useAuth();

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.username}</h1>
          <p className="text-gray-600 mt-1">Observer Dashboard - Monitor signing sessions</p>
        </div>

        {/* Quick Actions for Observer */}
        <div className="grid grid-cols-2 gap-4">
          <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center">
            <Link to="/jobs">
              <Eye className="h-6 w-6 mb-2" />
              <span>View Sessions</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center">
            <Link to="/profile">
              <User className="h-6 w-6 mb-2" />
              <span>Profile</span>
            </Link>
          </Button>
        </div>

        <Alert className="border-gray-200 bg-gray-50">
          <Eye className="h-4 w-4 text-gray-600" />
          <AlertDescription className="text-gray-800">
            As an observer, you can monitor signing sessions when granted access. 
            <Link to="/jobs" className="ml-1 underline font-medium">Check for available sessions →</Link>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Your Role: Observer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="font-medium">Monitor Sessions</p>
                  <p className="text-sm text-gray-600">Observe signing sessions as permitted</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="font-medium">View Documentation</p>
                  <p className="text-sm text-gray-600">Access session logs and documentation</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const { 
    needsProfileCompletion, 
    needsApproval, 
    isRejected, 
    requiresUpdate,
    canAccessDashboard,
    isLoading: profileStatusLoading 
  } = useNotaryProfileStatus();
  const [, setLocation] = useLocation();

  // Check if notary needs to complete profile
  if (user?.role === 'notary' && !profileStatusLoading && needsProfileCompletion) {
    setLocation('/notary/profile/complete');
    return null;
  }

  // Show pending approval status for notaries
  if (user?.role === 'notary' && !profileStatusLoading && needsApproval) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md">
            <div className="mb-6">
              <AlertCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Under Review</h2>
              <p className="text-gray-600">
                Your notary profile has been submitted and is currently under review by our administrators. 
                You will be notified once your account is approved.
              </p>
            </div>
            <Button variant="outline" onClick={() => setLocation('/login')}>
              Logout
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Show rejection status for notaries
  if (user?.role === 'notary' && !profileStatusLoading && isRejected) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md">
            <div className="mb-6">
              <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Rejected</h2>
              <p className="text-gray-600 mb-4">
                Your notary profile has been rejected. Please update your information and resubmit.
              </p>
              <Button onClick={() => setLocation('/notary/profile/complete')}>
                Update Profile
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (isLoading || profileStatusLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Route to appropriate dashboard based on user role
  switch (user?.role) {
    case 'admin':
      return (
        <MainLayout>
          <AdminDashboard />
        </MainLayout>
      );
    
    case 'notary':
      return (
        <MainLayout>
          <NotaryDashboard />
        </MainLayout>
      );
    
    case 'client':
      return (
        <MainLayout>
          <ClientDashboard />
        </MainLayout>
      );
    
    case 'signer':
      return (
        <MainLayout>
          <SignerDashboard />
        </MainLayout>
      );
    
    case 'company_user':
    case 'title_company':
    case 'manager':
      return <CompanyUserDashboard />;
    
    case 'witness':
      return <WitnessDashboard />;
    
    case 'observer':
      return <ObserverDashboard />;
    
    default:
      // Fallback for unknown roles
      return (
        <MainLayout>
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Welcome to USA Notary</h1>
              <p className="text-gray-600 mt-1">Your account is being set up. Please contact support if you need assistance.</p>
            </div>
            
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Your user role is not recognized. Please contact support for assistance.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Username:</strong> {user?.username}</p>
                  <p><strong>Email:</strong> {user?.email}</p>
                  <p><strong>Role:</strong> {user?.role || 'Not assigned'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </MainLayout>
      );
  }
}
