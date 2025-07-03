import { MainLayout } from '@/components/layout/main-layout';
import { useAuth } from '@/hooks/use-auth';
import { useNotaryProfileStatus } from '@/hooks/use-notary-profile-status';
import { useLocation } from 'wouter';
import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { type Job } from '@shared/schema';
import { getStatusColor } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
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
  AlertTriangle,
  Shield,
  XCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EVSVerification } from '@/components/verification/evs-verification';

// Import role-specific dashboard components
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { NotaryDashboard } from '@/components/notary/NotaryDashboard';
import { ClientDashboard } from '@/components/client/ClientDashboard';

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
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<any>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWitnessProfile();
  }, []);

  const fetchWitnessProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No authentication token found');
        setLoading(false);
        return;
      }
      
      // Get user ID with improved fallback logic
      let userId = user?.id;
      
      // First fallback: Get from localStorage
      if (!userId) {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            userId = parsedUser.id;
            console.log('Got user ID from localStorage:', userId);
          } catch (e) {
            console.error('Error parsing stored user:', e);
          }
        }
      }
      
      // Second fallback: Get from /api/auth/me endpoint
      if (!userId) {
        console.log('Fetching user ID from /api/auth/me');
        const meResponse = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (meResponse.ok) {
          const meData = await meResponse.json();
          userId = meData.id;
          console.log('Got user ID from /api/auth/me:', userId);
        } else {
          console.error('Failed to get user from /api/auth/me:', meResponse.status);
        }
      }
      
      if (!userId) {
        console.error('No user ID available after all fallback methods');
        setLoading(false);
        return;
      }
      
      console.log('Fetching profile for user ID:', userId); // Debug log
      
      // Add cache-busting parameter to ensure fresh data
      const response = await fetch(`/api/users/${userId}/profile/comprehensive?_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        console.error('Profile fetch failed:', response.status, response.statusText);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      
      console.log('Witness profile data:', data); // Debug log
      
      setProfile({
        ...data,
        isVerified: data.isVerified || false,
        verificationStatus: data.verificationStatus || 'pending',
        accountSetupComplete: data.accountSetupComplete || false,
      });
      
      // Update localStorage user data if the verification status changed
      if (data.isVerified !== undefined) {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userData.isVerified = data.isVerified;
          userData.verificationStatus = data.verificationStatus;
          localStorage.setItem('user', JSON.stringify(userData));
        }
      }
    } catch (error) {
      console.error('Error fetching witness profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationComplete = (result: any) => {
    fetchWitnessProfile(); // Refresh profile
    setShowVerification(false);
  };

  const handleVerificationFailed = (error: string) => {
    console.error('Verification failed:', error);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.username}</h1>
          <div className="flex items-center space-x-4 mt-2">
            <p className="text-gray-600">Witness Dashboard</p>
            {profile?.isVerified ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <Shield className="h-3 w-3 mr-1" />
                ID Verified
              </Badge>
            ) : (
              <Badge variant="default" className="bg-orange-100 text-orange-800">
                <AlertCircle className="h-3 w-3 mr-1" />
                Verification Required
              </Badge>
            )}
          </div>
        </div>

        {/* Verification Alert */}
        {!profile?.isVerified && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>ID Verification Required:</strong> As a witness, you must complete identity verification before participating in any notarization sessions.
              <div className="flex gap-2 mt-2">
                <Button 
                  size="sm" 
                  onClick={() => setShowVerification(true)}
                >
                  Verify Now
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    setLoading(true);
                    fetchWitnessProfile();
                  }}
                >
                  Refresh Status
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* ID Verification Modal/Component */}
        {showVerification && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">ID Verification Required</h2>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowVerification(false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <EVSVerification
                  userId={(() => {
                    let id = user?.id;
                    if (!id) {
                      const storedUser = localStorage.getItem('user');
                      if (storedUser) {
                        try {
                          const parsedUser = JSON.parse(storedUser);
                          id = parsedUser.id;
                        } catch (e) {
                          console.error('Error parsing stored user:', e);
                        }
                      }
                    }
                    return id || 0;
                  })()}
                  onVerificationComplete={handleVerificationComplete}
                  onVerificationFailed={handleVerificationFailed}
                />
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions for Witness */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button 
            asChild 
            variant="outline" 
            className="h-20 flex flex-col items-center justify-center"
            disabled={!profile?.isVerified}
          >
            <Link to="/jobs">
              <Eye className="h-6 w-6 mb-2" />
              <span>View Sessions</span>
            </Link>
          </Button>
          <Button 
            asChild 
            variant="outline" 
            className="h-20 flex flex-col items-center justify-center"
            disabled={!profile?.isVerified}
          >
            <Link to="/jobs">
              <Briefcase className="h-6 w-6 mb-2" />
              <span>Pending Invitations</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center">
            <Link to="/profile">
              <User className="h-6 w-6 mb-2" />
              <span>Profile Update</span>
            </Link>
          </Button>
          <Button 
            onClick={() => setShowVerification(true)}
            variant="outline" 
            className="h-20 flex flex-col items-center justify-center"
            disabled={profile?.isVerified}
          >
            <Shield className="h-6 w-6 mb-2" />
            <span>{profile?.isVerified ? 'Verified' : 'Verify ID'}</span>
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Verification Status</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {profile?.isVerified ? 'Verified' : 'Pending'}
                  </p>
                </div>
                <Shield className={`h-8 w-8 ${profile?.isVerified ? 'text-green-600' : 'text-orange-600'}`} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Sessions Available</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">2</p>
                </div>
                <Eye className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Invitations</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">1</p>
                </div>
                <Bell className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Session Access Information */}
        {!profile?.isVerified ? (
          <Alert className="border-red-200 bg-red-50">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Session Access Restricted:</strong> You cannot join witnessing sessions until your identity is verified. 
              <Link to="#" onClick={() => setShowVerification(true)} className="ml-1 underline font-medium">
                Complete verification now →
              </Link>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Ready to Witness:</strong> Your identity is verified. You can now participate in notarization sessions.
              <Link to="/jobs" className="ml-1 underline font-medium">View available sessions →</Link>
            </AlertDescription>
          </Alert>
        )}

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
              <CardTitle>Account Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${profile?.accountSetupComplete ? 'bg-green-500' : 'bg-gray-300'}`}>
                    {profile?.accountSetupComplete && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className="font-medium">Account Setup</p>
                    <p className="text-sm text-gray-600">Complete profile and contact information</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${profile?.isVerified ? 'bg-green-500' : 'bg-gray-300'}`}>
                    {profile?.isVerified && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className="font-medium">ID Verification</p>
                    <p className="text-sm text-gray-600">Government ID and selfie verification</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium">Session Notifications</p>
                    <p className="text-sm text-gray-600">Receive invitations to witnessing sessions</p>
                  </div>
                </div>
                
                {!profile?.isVerified && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 font-medium">⚠️ Verification Required</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Complete ID verification to participate in witnessing sessions.
                    </p>
                    <Button 
                      size="sm" 
                      className="mt-2 w-full"
                      onClick={() => setShowVerification(true)}
                    >
                      Start Verification
                    </Button>
                  </div>
                )}
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

  // Use effect to handle navigation instead of during render
  useEffect(() => {
    if (user?.role === 'notary' && !profileStatusLoading && needsProfileCompletion) {
      setLocation('/notary/profile/complete');
    }
  }, [user?.role, profileStatusLoading, needsProfileCompletion, setLocation]);

  // Check if notary needs to complete profile
  if (user?.role === 'notary' && !profileStatusLoading && needsProfileCompletion) {
    return null; // Return null while navigating
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
