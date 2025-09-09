import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, FileText, User, AlertCircle, CheckCircle, XCircle, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useAuth } from '../hooks/use-auth';
import { apiRequest } from '../lib/api';
import { MainLayout } from '../components/layout/main-layout';

interface SigningJob {
  id: number;
  titleCompany: string;
  closingType: string;
  selectedDate: string;
  selectedTime: string;
  jobStatus: string;
  propertyAddressOne: string;
  propertyCity: string;
  propertyState: string;
  createdAt: string;
  
  // Dual role specific fields
  userPrimaryRole: string;
  jobSpecificRole: string;
  requiresIdVerification: boolean;
  idVerificationCompleted: boolean;
  idVerificationStatus: 'pending' | 'completed' | 'bypassed';
  canJoinSigning: boolean;
  blockingReason?: 'verification_required' | 'other';
  
  // Participant info
  totalParticipants: number;
  verifiedParticipants: number;
  
  // Additional metadata
  firstSignerName?: string;
  notaryName?: string;
}

interface SigningJobsResponse {
  jobs: SigningJob[];
  totalCount: number;
  hasMore: boolean;
}

const SigningJobs: React.FC = () => {
  const { user } = useAuth();
  const [selectedJob, setSelectedJob] = useState<SigningJob | null>(null);
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);

  const { data: signingJobsData, isLoading, error, refetch } = useQuery({
    queryKey: ['signing-jobs'],
    queryFn: async (): Promise<SigningJobsResponse> => {
      const response = await apiRequest('GET', '/api/jobs/signing-assignments');
      const data = await response.json();
      return data;
    },
  });

  const handleJoinSigning = async (job: SigningJob) => {
    if (!job.canJoinSigning) {
      // For signers, only ID verification is required
      if (job.blockingReason === 'verification_required') {
        setSelectedJob(job);
        setShowVerificationPrompt(true);
        return;
      }
      
      // Other blocking reasons
      alert('Cannot join signing session at this time. Please check job requirements.');
      return;
    }

    // Redirect to signing session via editor with signing mode
    window.location.href = `/editor/${job.id}?mode=signing`;
  };

  const handleCompleteVerification = () => {
    // Redirect to ID verification flow
    window.location.href = `/id-verification`;
  };

  const getJobStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVerificationStatusIcon = (job: SigningJob) => {
    if (!job.requiresIdVerification) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    
    if (job.idVerificationCompleted || job.idVerificationStatus === 'bypassed') {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    
    return <AlertCircle className="h-4 w-4 text-yellow-600" />;
  };

  const getRoleDisplay = (job: SigningJob) => {
    if (job.userPrimaryRole === job.jobSpecificRole) {
      return job.userPrimaryRole;
    }
    
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">{job.userPrimaryRole}</span>
        <span className="text-xs text-gray-400">→</span>
        <Badge variant="outline" className="text-xs">
          Acting as {job.jobSpecificRole}
        </Badge>
      </div>
    );
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Signing Jobs</h1>
            <p className="text-gray-600 mt-1">
              Jobs where you're assigned as a signer. Complete your profile to access signing sessions.
            </p>
          </div>
          
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Unable to load signing jobs.</strong> There may be a temporary issue with the service. 
              Please try again in a few moments.
            </AlertDescription>
          </Alert>
          
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => refetch()}
            >
              Try Again
            </Button>
            <Button
              onClick={() => window.location.href = '/dashboard'}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const jobs = signingJobsData?.jobs || [];

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Signing Jobs</h1>
          <p className="text-gray-600 mt-1">
            Jobs where you're assigned as a signer. Complete ID verification to access signing sessions.
          </p>
        </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Signing Jobs</p>
                <p className="text-2xl font-bold">{jobs.length}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Ready to Sign</p>
                <p className="text-2xl font-bold text-green-600">
                  {jobs.filter(job => job.canJoinSigning).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Need Verification</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {jobs.filter(job => job.blockingReason === 'verification_required').length}
                </p>
              </div>
              <Shield className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Your Role</p>
                <p className="text-sm font-semibold text-gray-900 capitalize">{user?.role}</p>
              </div>
              <User className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {jobs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Signing Jobs</h3>
              <p className="text-gray-600">
                You don't have any jobs where you're assigned as a signer at the moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          jobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      Job #{job.id} - {job.titleCompany}
                    </CardTitle>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(job.selectedDate).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {job.selectedTime}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getVerificationStatusIcon(job)}
                    <Badge className={getJobStatusColor(job.jobStatus)}>
                      {job.jobStatus}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Property</p>
                    <p className="text-sm font-medium">
                      {job.propertyAddressOne}
                      <br />
                      {job.propertyCity}, {job.propertyState}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Closing Type</p>
                    <p className="text-sm font-medium">{job.closingType}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Your Role</p>
                    <div className="text-sm font-medium">
                      {getRoleDisplay(job)}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Participants</p>
                    <p className="text-sm font-medium">
                      {job.verifiedParticipants}/{job.totalParticipants} verified
                    </p>
                  </div>
                </div>

                {/* Status Alerts */}
                {!job.canJoinSigning && job.blockingReason === 'verification_required' && (
                  <Alert className="mb-4">
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      <strong>ID Verification Required:</strong> You must complete identity verification 
                      before joining this signing session as a signer.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Created {new Date(job.createdAt).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `/jobs/${job.id}`}
                    >
                      View Details
                    </Button>
                    
                    {job.canJoinSigning ? (
                      <Button
                        size="sm"
                        onClick={() => handleJoinSigning(job)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Join Signing
                      </Button>
                    ) : job.blockingReason === 'verification_required' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleJoinSigning(job)}
                        className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                      >
                        Complete Verification
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled
                        variant="outline"
                      >
                        Cannot Join
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ID Verification Prompt Modal */}
      {showVerificationPrompt && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-yellow-600" />
                ID Verification Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-600">
                  To join the signing session for <strong>Job #{selectedJob.id}</strong>, 
                  you need to complete identity verification first.
                </p>
                
                <div className="bg-yellow-50 p-3 rounded-md">
                  <p className="text-sm text-yellow-800">
                    <strong>Why is this required?</strong><br />
                    Since you're acting as a <strong>{selectedJob.jobSpecificRole}</strong> 
                    for this job, identity verification is required by law for document signing.
                  </p>
                </div>
                
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={() => setShowVerificationPrompt(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCompleteVerification}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    Complete Verification
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </MainLayout>
  );
};

export default SigningJobs;