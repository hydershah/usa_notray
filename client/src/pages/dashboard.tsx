import { MainLayout } from '@/components/layout/main-layout';
import { useAuth } from '@/hooks/use-auth';
import { useNotaryProfileStatus } from '@/hooks/use-notary-profile-status';
import { useLocation } from 'wouter';
import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { type Job } from '@shared/types';
import { getStatusColor, isMobileDevice } from '@/lib/utils';
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
  XCircle,
  ToggleLeft,
  ToggleRight,
  PenTool,
  Video,
  Download
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { EVSVerification } from '@/components/verification/evs-verification';
import { KBAVerification } from '@/components/verification/kba-verification';

// Import role-specific dashboard components
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminOverview } from '@/components/admin/AdminOverview';
import { NotaryDashboard } from '@/components/notary/NotaryDashboard';
import { ClientDashboard } from '@/components/client/ClientDashboard';
import { TitleCompanyDashboard } from '@/components/admin/ManagerDashboard';

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
  );
}

// Signer Dashboard - for document signers
function SignerDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [invitedJobs, setInvitedJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVerification, setShowVerification] = useState(false);
  const [showKBAVerification, setShowKBAVerification] = useState(false);
  const [selectedJobForDocuments, setSelectedJobForDocuments] = useState<any>(null);
  const [jobDocuments, setJobDocuments] = useState<any[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  const fetchJobDocuments = async (jobId: number) => {
    setDocumentsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/jobs/${jobId}/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const documents = await response.json();
      setJobDocuments(documents);
    } catch (error) {
      console.error('Failed to fetch job documents:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load documents. Please try again.",
      });
      setJobDocuments([]);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleViewDocuments = (job: any) => {
    setSelectedJobForDocuments(job);
    fetchJobDocuments(job.id);
  };

  const handlePreviewDocument = (documentId: number) => {
    const previewUrl = `/api/jobs/${selectedJobForDocuments.id}/documents/${documentId}/preview?token=${localStorage.getItem('token')}`;
    window.open(previewUrl, '_blank');
  };

  const fetchSignerProfile = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const userId = user.id;
      
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
      
      console.log('Signer profile data:', data); // Debug log
      
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
      console.error('Error fetching signer profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitedJobs = async () => {
    if (!user?.id) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/jobs/invited', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        console.error('Invited jobs fetch failed:', response.status, response.statusText);
        return;
      }
      
      const jobs = await response.json();
      console.log('Signer invited jobs:', jobs); // Debug log
      
      setInvitedJobs(jobs);
    } catch (error) {
      console.error('Error fetching invited jobs:', error);
    }
  };

  const handleVerificationComplete = (result: any) => {
    fetchSignerProfile(); // Refresh profile
    setShowVerification(false);
  };

  const handleVerificationFailed = (error: string) => {
    console.error('Verification failed:', error);
  };

  const handleKBAVerificationComplete = (result: any) => {
    fetchSignerProfile(); // Refresh profile to get updated KBA status
    setShowKBAVerification(false);
    toast({
      title: "KBA Verification Complete",
      description: `You scored ${result.score}% - verification successful!`,
    });
  };

  const handleKBAVerificationFailed = (error: string) => {
    console.error('KBA verification failed:', error);
    toast({
      variant: "destructive",
      title: "KBA Verification Failed",
      description: error,
    });
  };

  useEffect(() => {
    fetchSignerProfile();
    fetchInvitedJobs();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.username}</h1>
        <div className="flex items-center space-x-4 mt-2">
          <p className="text-gray-600">Signer Dashboard</p>
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

      {/* Verification Status Alert */}
      {!profile?.isVerified ? (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>ID Verification Required:</strong> Complete identity verification to participate in document signing sessions.
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                onClick={() => setShowVerification(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Shield className="h-4 w-4 mr-2" />
                Start Verification
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setLoading(true);
                  fetchSignerProfile();
                }}
              >
                Refresh Status
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Verification Complete:</strong> You're ready to sign documents!
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

      {/* Invited Jobs Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Your Signing Jobs</h2>
          <Badge variant="outline" className="text-sm">
            {invitedJobs.length} {invitedJobs.length === 1 ? 'job' : 'jobs'}
          </Badge>
        </div>

        {invitedJobs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No signing jobs yet</h3>
              <p className="text-gray-600 mb-4">
                When you're invited to sign documents, they'll appear here.
              </p>
              <div className="text-sm text-gray-500">
                Check your email for invitations or contact the notary/title company if you're expecting an invitation.
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {invitedJobs.map((job, index) => (
              <Card key={job.id} className="border-l-4 border-l-blue-500">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {job.titleCompany}
                        </h3>
                        <Badge 
                          variant={job.signingStatus === 'completed' ? 'default' : 'secondary'}
                          className={
                            job.signingStatus === 'completed' ? 'bg-green-100 text-green-800' :
                            job.signingStatus === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {job.signingStatus === 'pending' ? 'Pending' :
                           job.signingStatus === 'in_progress' ? 'In Progress' :
                           job.signingStatus === 'completed' ? 'Completed' : 
                           job.signingStatus}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Document Type</p>
                          <p className="font-medium">{job.closingType}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Your Role</p>
                          <p className="font-medium capitalize">{job.signerRole}</p>
                        </div>
                        {job.propertyAddressOne && (
                          <div className="md:col-span-2">
                            <p className="text-sm text-gray-600">Property Address</p>
                            <p className="font-medium">
                              {job.propertyAddressOne}
                              {job.propertyCity && `, ${job.propertyCity}`}
                              {job.propertyState && `, ${job.propertyState}`}
                            </p>
                          </div>
                        )}
                        {job.selectedDate && (
                          <div>
                            <p className="text-sm text-gray-600">Scheduled Date</p>
                            <p className="font-medium">{new Date(job.selectedDate).toLocaleDateString()}</p>
                          </div>
                        )}
                        {job.selectedTime && (
                          <div>
                            <p className="text-sm text-gray-600">Scheduled Time</p>
                            <p className="font-medium">{job.selectedTime}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-gray-500">
                      Invited: {job.invitationSentAt ? new Date(job.invitationSentAt).toLocaleDateString() : 'Not sent'}
                    </div>
                    
                    <div className="flex gap-2">
                      {/* View Documents Button - Always available for signers */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleViewDocuments(job)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Documents
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Documents for {job.titleCompany}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            {documentsLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="text-center">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                  <p className="mt-2 text-gray-600">Loading documents...</p>
                                </div>
                              </div>
                            ) : jobDocuments.length > 0 ? (
                              <div className="space-y-3">
                                {jobDocuments.map((document: any) => (
                                  <div key={document.id} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                                    <div className="flex items-center space-x-3">
                                      <FileText className="h-8 w-8 text-blue-600" />
                                      <div>
                                        <p className="font-medium">{document.originalName}</p>
                                        <p className="text-sm text-gray-600">
                                          Type: {document.documentType || 'Document'}
                                          {document.isRequired && (
                                            <Badge className="ml-2 bg-red-100 text-red-800">Required</Badge>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handlePreviewDocument(document.id)}
                                        title="Preview document"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600">No documents found for this job.</p>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>

                      {job.signingStatus === 'pending' && profile?.isVerified && (
                        <Button 
                          size="sm" 
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={async () => {
                            try {
                              // For mobile devices, prepare the window reference before async operations
                              const isMobile = isMobileDevice();
                              let newWindow: Window | null = null;
                              
                              if (!isMobile) {
                                // For desktop, prepare the window reference before the async call
                                newWindow = window.open('about:blank', '_blank');
                              }

                              // Check if user has access to this job session
                              const token = localStorage.getItem('token');
                              const sessionAccessResponse = await fetch(`/api/jobs/${job.id}/session-access`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                              });

                              if (!sessionAccessResponse.ok) {
                                const errorData = await sessionAccessResponse.json();
                                // Close the prepared window if it was opened
                                if (newWindow) {
                                  newWindow.close();
                                }
                                throw new Error(errorData.message || 'Access denied to session');
                              }

                              const signingUrl = `/editor/${job.id}?mode=signing`;
                              
                              // Navigate based on device type
                              if (isMobile) {
                                // For mobile devices, navigate in the same tab
                                window.location.href = signingUrl;
                              } else {
                                // For desktop, use the prepared window
                                if (newWindow) {
                                  newWindow.location.href = signingUrl;
                                } else {
                                  // Fallback if window.open failed
                                  window.open(signingUrl, '_blank');
                                }
                              }
                              
                              toast({
                                title: "Joining Session",
                                description: "Redirecting you to the signing session...",
                              });
                            } catch (error) {
                              console.error('❌ Failed to join session:', error);
                              toast({
                                variant: "destructive",
                                title: "Failed to Join Session",
                                description: error instanceof Error ? error.message : 'Unable to join session. Please try again.',
                              });
                            }
                          }}
                        >
                          <Video className="h-4 w-4 mr-2" />
                          Join Session
                        </Button>
                      )}
                      {job.signingStatus === 'pending' && (
                        // Show appropriate verification button based on job requirements
                        job.kbaRequired ? (
                          // KBA Required Jobs
                          !profile?.kbaVerified && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => setShowKBAVerification(true)}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Complete KBA Verification
                            </Button>
                          )
                        ) : (
                          // Regular ID Verification Jobs
                          !profile?.isVerified && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => setShowVerification(true)}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Verify ID First
                            </Button>
                          )
                        )
                      )}
                      {job.signingStatus === 'completed' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={async () => {
                            try {
                              const token = localStorage.getItem('token');
                              const response = await fetch(`/api/jobs/${job.id}/download`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                              });

                              if (!response.ok) {
                                throw new Error('Failed to download document');
                              }

                              // Create download link
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = `${job.titleCompany}_${job.closingType}_signed.pdf`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              window.URL.revokeObjectURL(url);

                              toast({
                                title: "Download Started",
                                description: "Your signed document is downloading...",
                              });
                            } catch (error) {
                              console.error('❌ Failed to download:', error);
                              toast({
                                variant: "destructive",
                                title: "Download Failed",
                                description: "Unable to download the document. Please try again.",
                              });
                            }
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Your Role: Document Signer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <PenTool className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium">Sign Documents</p>
                  <p className="text-sm text-gray-600">Electronically sign legal documents</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <UserCheck className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Identity Verification</p>
                  <p className="text-sm text-gray-600">Confirm your identity before signing</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium">Review Documents</p>
                  <p className="text-sm text-gray-600">Access and review documents before signing</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-medium">Secure Process</p>
                  <p className="text-sm text-gray-600">All signatures are legally binding and secure</p>
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
              
              {!profile?.isVerified && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 font-medium">Verification Required</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Complete ID verification to participate in document signing.
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

      {/* KBA Verification Modal */}
      {showKBAVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto">
            <KBAVerification
              userId={user?.id?.toString() || '0'}
              userInfo={{
                firstName: profile?.firstName || '',
                lastName: profile?.lastName || '',
                dateOfBirth: profile?.dateOfBirth || '',
                address: {
                  street: profile?.address1 || '',
                  city: profile?.city || '',
                  state: profile?.state || '',
                  zipCode: profile?.zipCode || ''
                },
                ssn: profile?.ssn || '',
                phone: profile?.phoneNumber || '',
                email: profile?.email || user?.email || ''
              }}
              onVerificationComplete={handleKBAVerificationComplete}
              onVerificationFailed={handleKBAVerificationFailed}
              requireKBA={true}
            />
            <div className="p-6 border-t">
              <Button 
                onClick={() => setShowKBAVerification(false)}
                variant="outline"
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
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

      {/* Verification Status Alert */}
      {!profile?.isVerified ? (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>ID Verification Required:</strong> Complete identity verification to participate in notarization sessions.
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                onClick={() => setShowVerification(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Shield className="h-4 w-4 mr-2" />
                Start Verification
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
      ) : (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Verification Complete:</strong> You're ready to participate in notarization sessions!
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <Button 
              asChild 
              variant="ghost" 
              className="w-full h-auto p-0 flex flex-col items-center justify-center gap-3"
              disabled={!profile?.isVerified}
            >
              <Link to="/jobs">
                <div className={`p-3 rounded-lg ${profile?.isVerified ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <Eye className={`h-8 w-8 ${profile?.isVerified ? 'text-blue-600' : 'text-gray-400'}`} />
                </div>
                <div className="text-center">
                  <h3 className="font-medium text-gray-900">Available Sessions</h3>
                  <p className="text-sm text-gray-600 mt-1">View and join witnessing sessions</p>
                </div>
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <Button 
              asChild 
              variant="ghost" 
              className="w-full h-auto p-0 flex flex-col items-center justify-center gap-3"
            >
              <Link to="/profile">
                <div className="p-3 rounded-lg bg-green-100">
                  <User className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-center">
                  <h3 className="font-medium text-gray-900">Profile Settings</h3>
                  <p className="text-sm text-gray-600 mt-1">Update your account information</p>
                </div>
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <Button 
              onClick={() => profile?.isVerified ? null : setShowVerification(true)}
              variant="ghost" 
              className="w-full h-auto p-0 flex flex-col items-center justify-center gap-3"
              disabled={profile?.isVerified}
            >
              <div className={`p-3 rounded-lg ${profile?.isVerified ? 'bg-green-100' : 'bg-orange-100'}`}>
                <Shield className={`h-8 w-8 ${profile?.isVerified ? 'text-green-600' : 'text-orange-600'}`} />
              </div>
              <div className="text-center">
                <h3 className="font-medium text-gray-900">
                  {profile?.isVerified ? 'ID Verified' : 'Verify Identity'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {profile?.isVerified ? 'Verification complete' : 'Complete ID verification'}
                </p>
              </div>
            </Button>
          </CardContent>
        </Card>
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
                  <p className="text-sm text-yellow-800 font-medium">Verification Required</p>
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
  );
}

// Observer Dashboard (very limited features)
function ObserverDashboard() {
  const { user } = useAuth();

  return (
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
              <UserCheck className="h-5 w-5 text-gray-600" />
              <div>
                <p className="font-medium">Limited Access</p>
                <p className="text-sm text-gray-600">View-only access to authorized sessions</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
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
  
  // State for role switching (for users with multiple privileges)
  const [activeRole, setActiveRole] = useState<'admin' | 'notary' | null>(null);

  // Determine if user has multiple privileges
  const hasMultiplePrivileges = user && 
    ((user.isAdmin || user.role === 'admin') && (user.isNotary || user.role === 'notary'));

  // Set default active role - ALWAYS prioritize admin for admin users
  useEffect(() => {
    if (user && !activeRole) {
      // Admin users ALWAYS default to admin view, regardless of other privileges
      if (user.isAdmin || user.role === 'admin') {
        setActiveRole('admin');
      } else if (user.role === 'notary' || user.isNotary) {
        setActiveRole('notary');
      }
    }
  }, [user, activeRole, hasMultiplePrivileges]);

  // Use effect to handle navigation instead of during render
  // Only redirect pure notary users (not admin users with notary privileges) to profile completion
  useEffect(() => {
    if (user?.role === 'notary' && !user?.isAdmin && !profileStatusLoading && needsProfileCompletion) {
      setLocation('/notary/profile/complete');
    }
  }, [user?.role, user?.isAdmin, profileStatusLoading, needsProfileCompletion, setLocation]);

  // Check if pure notary user (not admin) needs to complete profile
  if (user?.role === 'notary' && !user?.isAdmin && !profileStatusLoading && needsProfileCompletion) {
    return null; // Return null while navigating
  }

  // Show pending approval status for notaries (but not admin users with notary privileges)
  if (user?.role === 'notary' && !user?.isAdmin && !profileStatusLoading && needsApproval) {
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

  // Show rejection status for notaries (but not admin users with notary privileges)
  if (user?.role === 'notary' && !user?.isAdmin && !profileStatusLoading && isRejected) {
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

  // Route to appropriate dashboard - ALWAYS prioritize admin access
  const getCurrentDashboard = () => {
    // FIRST: Check if user has admin privileges - admin always takes precedence
    if (user?.isAdmin || user?.role === 'admin') {
      // For admin users with multiple privileges, respect their chosen view
      if (hasMultiplePrivileges && activeRole === 'notary') {
        return <NotaryDashboard />;
      }
      // Default to admin dashboard for all admin users
      return <AdminOverview />;
    }
    
    // THEN: Handle non-admin users based on their role
    if (user?.isNotary || user?.role === 'notary') {
      return <NotaryDashboard />;
    } else if (user?.role === 'client') {
      return <ClientDashboard />;
    } else if (['company_user', 'title_company'].includes(user?.role)) {
      return <TitleCompanyDashboard />;
    } else if (user?.role === 'signer') {
      return <SignerDashboard />;
    } else if (user?.role === 'witness') {
      return <WitnessDashboard />;
    } else if (user?.role === 'observer') {
      return <ObserverDashboard />;
    } else {
      // Fallback for unknown roles
      return (
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome to Sharp Note</h1>
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
      );
    }
  };

  return (
    <MainLayout>
      {/* Role Switcher for admin users with notary privileges - Admin is default */}
      {hasMultiplePrivileges && (
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-gray-900">Dashboard View:</span>
              <div className="flex items-center gap-2">
                <Badge variant={activeRole === 'admin' ? 'default' : 'outline'}>
                  Administrator (Default)
                </Badge>
                <Badge variant={activeRole === 'notary' ? 'default' : 'outline'}>
                  Notary Public (Optional)
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={activeRole === 'admin' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveRole('admin')}
                className="flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Admin View
              </Button>
              <Button
                variant={activeRole === 'notary' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveRole('notary')}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Notary View
              </Button>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            <strong>Administrator privileges:</strong> You have full system access by default. 
            Optionally switch to notary view to use notary-specific features.
          </p>
        </div>
      )}

      {/* Optional Notary Profile Notice for Admin Users - Only show in notary view */}
      {user?.isAdmin && user?.isNotary && needsProfileCompletion && activeRole === 'notary' && (
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <strong>Optional Notary Setup:</strong> Complete your notary profile to access notary-specific features. 
                <div className="text-sm mt-1 text-blue-600">
                  ℹ️ This is completely optional - your admin privileges provide full system access.
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setActiveRole('admin')}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  Back to Admin
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setLocation('/notary/profile/complete')}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  Complete Profile
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {getCurrentDashboard()}
    </MainLayout>
  );
}
