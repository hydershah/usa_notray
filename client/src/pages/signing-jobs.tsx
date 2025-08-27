import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AccountSetupModal } from '@/components/ui/account-setup-modal';
import { useAccountCompletion } from '@/hooks/use-account-completion';
import { 
  PenTool,
  FileText,
  Calendar,
  MapPin,
  AlertCircle,
  Eye,
  Download,
  Video,
  User,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { isMobileDevice } from '@/lib/utils';

interface SigningJob {
  id: number;
  titleCompany: string;
  closingType: string;
  signerRole: string;
  signingStatus: string;
  propertyAddressOne?: string;
  propertyCity?: string;
  propertyState?: string;
  selectedDate?: string;
  selectedTime?: string;
  invitationSentAt?: string;
  jobStatus: string;
  notaryApprovalStatus: string;
}

export default function SigningJobs() {
  const { user } = useAuth();
  const { showOverlay: hasAccountCompletionOverlay } = useAccountCompletion();
  const [, setLocation] = useLocation();

  const [loading, setLoading] = useState(false);
  const [downloadingPackage, setDownloadingPackage] = useState(false);
  const [accountSetupModal, setAccountSetupModal] = useState<{
    isOpen: boolean;
    requirements: string[];
  }>({
    isOpen: false,
    requirements: []
  });

  // Fetch invited jobs
  const { 
    data: signingJobs = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery<SigningJob[]>({
    queryKey: ['/api/jobs/invited'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });



  const handleJoinSession = async (job: SigningJob) => {
    setLoading(true);
    try {
      const isMobile = isMobileDevice();
      let newWindow: Window | null = null;
      
      if (!isMobile) {
        newWindow = window.open('about:blank', '_blank');
      }

      // Check session access
      const token = localStorage.getItem('token');
      const sessionAccessResponse = await fetch(`/api/jobs/${job.id}/session-access`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!sessionAccessResponse.ok) {
        throw new Error('Access denied');
      }

      const accessData = await sessionAccessResponse.json();
      
      if (!accessData.hasAccess) {
        if (newWindow) newWindow.close();
        
        // Handle account setup required case with professional modal
        // Only show the setup modal if the main overlay is not already shown
        if (accessData.errorType === 'account_setup_required' && !hasAccountCompletionOverlay) {
          setAccountSetupModal({
            isOpen: true,
            requirements: accessData.requirements || []
          });
          return;
        }
        
        // Show a clearer message if the session has been completed
        const message = accessData.errorType === 'session_completed'
          ? 'This signing session has been completed. You can download your documents from the job details.'
          : (accessData.message || 'Access denied to this session');
        alert(message);
        return;
      }

      // Navigate to signing session
      const sessionUrl = `/jobs/${job.id}/sign`;
      
      if (isMobile) {
        setLocation(sessionUrl);
      } else if (newWindow) {
        newWindow.location.href = sessionUrl;
        newWindow.focus();
      }
    } catch (error) {
      console.error('Error joining session:', error);
      alert('Failed to join session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPackage = async (jobId: number) => {
    setDownloadingPackage(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/jobs/${jobId}/download-package`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download package');
      }

      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job-${jobId}-completion-package.zip`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Error downloading package:', error);
      alert('Failed to download package. Please try again.');
    } finally {
      setDownloadingPackage(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'border-l-yellow-500';
      case 'in_progress': return 'border-l-blue-500';
      case 'completed': return 'border-l-green-500';
      default: return 'border-l-gray-500';
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading your signing jobs...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">My Signing Jobs</h1>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Failed to load signing jobs. Please check your connection and try again.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Signing Jobs</h1>
            <p className="text-gray-600 mt-1">
              Your signing assignments
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>





        {/* Jobs List */}
        {signingJobs.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <PenTool className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No signing jobs yet
              </h3>
              <p className="text-gray-600 mb-4">
                When you're invited to sign documents, they'll appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {signingJobs.map((job) => (
              <Card key={job.id} className={`border-l-4 ${getStatusColor(job.signingStatus)}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {job.titleCompany}
                        </h3>
                        {getStatusBadge(job.signingStatus)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-600">Document Type</p>
                            <p className="font-medium">{job.closingType}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-600">Your Role</p>
                            <p className="font-medium capitalize">{job.signerRole}</p>
                          </div>
                        </div>
                        
                        {job.selectedDate && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <div>
                              <p className="text-sm text-gray-600">Scheduled</p>
                              <p className="font-medium">
                                {new Date(job.selectedDate).toLocaleDateString()}
                                {job.selectedTime && ` at ${job.selectedTime}`}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {job.propertyAddressOne && (
                          <div className="flex items-center gap-2 md:col-span-2 lg:col-span-3">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <div>
                              <p className="text-sm text-gray-600">Property Address</p>
                              <p className="font-medium">
                                {job.propertyAddressOne}
                                {job.propertyCity && `, ${job.propertyCity}`}
                                {job.propertyState && `, ${job.propertyState}`}
                              </p>
                            </div>
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
                      {job.signingStatus === 'pending' && job.jobStatus !== 'completed' && user?.isVerified && (
                        <Button 
                          size="sm" 
                          onClick={() => handleJoinSession(job)}
                          disabled={loading}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Video className="h-4 w-4 mr-2" />
                          )}
                          Join Session
                        </Button>
                      )}
                      
                      {job.jobStatus === 'completed' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDownloadPackage(job.id)}
                          disabled={downloadingPackage}
                        >
                          {downloadingPackage ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Download Package
                        </Button>
                      )}
                      
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setLocation(`/jobs/${job.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Account Setup Modal */}
      <AccountSetupModal
        isOpen={accountSetupModal.isOpen}
        onClose={() => setAccountSetupModal({ isOpen: false, requirements: [] })}
        requirements={accountSetupModal.requirements}
        onSetupClick={() => setLocation('/profile')}
      />
    </MainLayout>
  );
} 