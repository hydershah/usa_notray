import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import CertificateStatusCard, { type JobCertificateVerification } from '@/components/certificate/CertificateStatusCard';
import { 
  ArrowLeft, 
  FileText, 
  Users, 
  Calendar, 
  MapPin, 
  Building, 
  Phone, 
  Mail,
  Tag,
  Video,
  Download,
  Eye,
  AlertTriangle,
  Clock,
  CheckCircle,
  Edit3,
  Shield,
  FileCheck
} from 'lucide-react';
import { getStatusColor, formatDate, isMobileDevice } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { JobCompletionReport } from '@/components/job/JobCompletionReport';
import { NotaryAssignmentCard } from '@/components/job/NotaryAssignmentCard';
import { SessionRecordingCard } from '@/components/job/SessionRecordingCard';
import { ActivityTimelineCard } from '@/components/job/ActivityTimelineCard';
import { JobEditor } from '@/components/job/JobEditor';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export default function JobDetailsPage() {
  const [, params] = useRoute('/jobs/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const jobId = params?.id ? parseInt(params.id) : null;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Debug jobId
  useEffect(() => {
    console.log('🆔 JobDetailsPage - Current jobId:', jobId, 'params:', params);
  }, [jobId, params]);

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      if (!jobId) throw new Error('No job ID provided');
      
      const response = await fetch(`/api/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch job details');
      }
      
      return response.json();
    },
    enabled: !!jobId
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['job-documents', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      
      const response = await fetch(`/api/jobs/${jobId}/documents`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) return [];
      const allDocuments = await response.json();
      
      // Filter to show only original documents (not signed ones) in the Documents section
      return allDocuments.filter((doc: any) => 
        doc.status !== 'signed' && doc.documentType === 'original'
      );
    },
    enabled: !!jobId
  });

  const { data: completedDocuments = [] } = useQuery({
    queryKey: ['job-completed-documents', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      
      const response = await fetch(`/api/jobs/${jobId}/document-versions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!jobId
  });

  const { data: certificateVerification, isLoading: isLoadingCertificates, refetch: refetchCertificates, error: certificateError } = useQuery({
    queryKey: ['certificate-verification', jobId],
    queryFn: async () => {
      if (!jobId) {
        console.log('❌ Certificate verification: jobId is null');
        return null;
      }
      
      console.log(`🔍 Fetching certificate verification for job ${jobId}`);
      
      const response = await fetch(`/api/certificate-verification/job/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      console.log(`📡 Certificate verification API response: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Certificate verification API failed:', response.status, errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('📋 Certificate verification data:', result);
      return result.data as JobCertificateVerification;
    },
    enabled: !!jobId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 0, // Always fetch fresh data
    gcTime: 0 // Don't cache old data
  });

  // Debug certificate verification query state
  useEffect(() => {
    console.log('🔒 Certificate verification query state:', {
      jobId,
      enabled: !!jobId,
      isLoading: isLoadingCertificates,
      hasData: !!certificateVerification,
      hasError: !!certificateError,
      error: certificateError?.message
    });
  }, [jobId, isLoadingCertificates, certificateVerification, certificateError]);

  const handleBackToJobs = () => {
    setLocation('/jobs');
  };

  const handleDownload = async (documentId: number, fileName: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/documents/${documentId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Downloaded ${fileName}`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Unable to download the document.",
      });
    }
  };

  const handlePreview = (documentId: number) => {
    const previewUrl = `/api/jobs/${jobId}/documents/${documentId}/preview?token=${localStorage.getItem('token')}`;
    window.open(previewUrl, '_blank');
  };

  const handleStartTagging = () => {
    // Check certificate requirements first for notary
    if (certificateVerification && certificateVerification.participantStatuses) {
      const notaryStatus = certificateVerification.participantStatuses.find((p: any) => p.userRole === 'notary');
      if (notaryStatus && !notaryStatus.canProceed) {
        toast({
          variant: "destructive",
          title: "Cannot Start Tagging",
          description: "The notary must have a valid digital certificate before starting the tagging session.",
        });
        return;
      }
    }

    // Navigate directly to editor page in new tab - session will be created there
    window.open(`/editor/${jobId}?mode=tagging`, '_blank');
  };

  const handleStartLiveSession = () => {
    // Check certificate requirements first
    if (certificateVerification && !certificateVerification.canStartJob) {
      toast({
        variant: "destructive",
        title: "Cannot Start Session",
        description: "All participants must have valid digital certificates before starting the live session.",
      });
      return;
    }

    // Navigate immediately for better user experience
    const signingUrl = `/editor/${jobId}?mode=signing`;
    
    // Navigate based on device type
    if (isMobileDevice()) {
      // For mobile devices, navigate in the same tab
      window.location.href = signingUrl;
    } else {
      // For desktop, open in new tab
      window.open(signingUrl, '_blank');
    }
  };

  const handleGenerateCertificate = async (userId: number) => {
    try {
      const response = await fetch('/api/certificate-verification/generate-certificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate certificate');
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: result.message,
      });

      // Refresh certificate verification
      refetchCertificates();

    } catch (error) {
      console.error('Certificate generation failed:', error);
      toast({
        variant: "destructive",
        title: "Certificate Generation Failed",
        description: error instanceof Error ? error.message : "Unable to generate certificate.",
      });
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Loading job details...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error || !job) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error?.message || 'Job not found'}
            </AlertDescription>
          </Alert>
          <Button onClick={handleBackToJobs} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={handleBackToJobs}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Jobs
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Job #{job.id}</h1>
              <p className="text-gray-600">{job.titleCompany}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              onClick={() => setIsEditModalOpen(true)}
              variant="outline"
              className="border-orange-600 text-orange-600 hover:bg-orange-50"
              title="Edit job details, signers, and documents"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Job
            </Button>
            <Button 
              onClick={handleStartTagging} 
              variant="outline" 
              disabled={
                certificateVerification?.participantStatuses?.some((p: any) => p.userRole === 'notary' && !p.canProceed) || false
              }
              className={`transition-colors duration-150 ${
                certificateVerification?.participantStatuses?.some((p: any) => p.userRole === 'notary' && !p.canProceed)
                  ? 'border-gray-400 text-gray-400 cursor-not-allowed'
                  : 'border-blue-600 text-blue-600 hover:bg-blue-50'
              }`}
              title={
                certificateVerification?.participantStatuses?.some((p: any) => p.userRole === 'notary' && !p.canProceed)
                  ? 'Notary needs a valid digital certificate to start tagging'
                  : 'Start tagging documents'
              }
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Start Tagging
            </Button>
            <Button 
              onClick={handleStartLiveSession} 
              disabled={Boolean(certificateVerification && !certificateVerification.canStartJob)}
              className={`transition-colors duration-150 ${
                certificateVerification && !certificateVerification.canStartJob
                  ? 'bg-gray-400 hover:bg-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
              title={
                certificateVerification && !certificateVerification.canStartJob
                  ? 'All participants need valid digital certificates to start'
                  : 'Start the live signing session'
              }
            >
              <Video className="h-4 w-4 mr-2" />
              Start Live Session
            </Button>
            <Badge className={getStatusColor(job.jobStatus)}>
              {job.jobStatus}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Assigned Notary */}
          <NotaryAssignmentCard jobId={job.id} />

          {/* Job Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Job Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Reference</label>
                  <p className="text-sm">{job.internalReference || `Job #${job.id}`}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Closing Type</label>
                  <p className="text-sm">{job.closingType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">KBA Required</label>
                  <p className="text-sm">{job.kbaRequired ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <p className="text-sm">{formatDate(job.createdAt)}</p>
                </div>
              </div>
              
              {(job.scheduledAt || job.selectedDate || job.selectedTime) && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Scheduled</label>
                  <div className="flex items-center mt-1">
                    <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                    <span className="text-sm">
                      {job.scheduledAt ? (
                        `${new Date(job.scheduledAt).toLocaleDateString()} at ${new Date(job.scheduledAt).toLocaleTimeString()}`
                      ) : (
                        `${job.selectedDate ? new Date(job.selectedDate).toLocaleDateString() : 'Not scheduled'} at ${job.selectedTime || 'Not scheduled'}`
                      )}
                    </span>
                  </div>
                </div>
              )}

              {job.propertyAddressOne && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Property Address</label>
                  <div className="flex items-start mt-1">
                    <MapPin className="h-4 w-4 mr-2 text-gray-600 mt-0.5" />
                    <div className="text-sm">
                      <p>{job.propertyAddressOne}</p>
                      {job.propertyAddressTwo && <p>{job.propertyAddressTwo}</p>}
                      <p>{job.propertyCity}, {job.propertyState} {job.propertyZipCode}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Signers ({job.signers?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {job.signers && job.signers.length > 0 ? (
                <div className="space-y-3">
                  {job.signers.map((signer: any, index: number) => (
                    <div key={signer.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{signer.signerName}</p>
                          <p className="text-sm text-gray-600 capitalize">{signer.signerRole}</p>
                        </div>
                        <Badge variant="outline">
                          Signer {index + 1}
                        </Badge>
                      </div>
                      
                      {(signer.signerEmail || signer.signerPhone) && (
                        <div className="mt-2 space-y-1">
                          {signer.signerEmail && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Mail className="h-3 w-3 mr-2" />
                              {signer.signerEmail}
                            </div>
                          )}
                          {signer.signerPhone && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Phone className="h-3 w-3 mr-2" />
                              {signer.signerPhone}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="mt-2">
                        <Badge className={signer.invitationSentAt ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                          {signer.invitationSentAt ? "Invitation Sent" : "Pending"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No signers added yet</p>
              )}
            </CardContent>
          </Card>

          {/* Completion Report */}
          <JobCompletionReport 
            jobId={job.id} 
            jobStatus={job.jobStatus} 
          />
        </div>

        {/* Digital Certificate Status */}
        {isLoadingCertificates && (
          <Card className="border-blue-300 bg-blue-50">
            <CardContent className="pt-6">
              <div className="text-blue-800 flex items-center space-x-2">
                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <p>🔄 <strong>Loading certificate verification...</strong></p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {certificateError && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="pt-6">
              <div className="text-red-800">
                <p>❌ <strong>Certificate Verification Error:</strong></p>
                <p className="text-sm mt-1">{certificateError.message}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchCertificates()}
                  className="mt-2"
                >
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {!isLoadingCertificates && !certificateError && !certificateVerification && (
          <Card className="border-yellow-300 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="text-yellow-800">
                <p>🔍 <strong>DEBUG:</strong> Certificate verification data not loaded</p>
                <p className="text-sm">jobId: {jobId}</p>
                <p className="text-sm">API call succeeded but returned no data</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchCertificates()}
                  className="mt-2"
                >
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {certificateVerification && (
          <CertificateStatusCard
            verification={certificateVerification}
            onGenerateCertificate={handleGenerateCertificate}
            onRefresh={refetchCertificates}
            isLoading={isLoadingCertificates}
          />
        )}



        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Documents ({documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length > 0 ? (
              <div className="space-y-3">
                {documents.map((document: any) => (
                  <div key={document.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="font-medium">{document.originalName}</p>
                        <p className="text-sm text-gray-600">
                          Uploaded {formatDate(document.uploadedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(document.id)}
                        title="Preview document"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(document.id, document.originalName)}
                        title="Download document"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/editor/${jobId}?mode=tagging`, '_blank')}
                        title="Tag document"
                      >
                        <Tag className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">No documents uploaded yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileCheck className="h-5 w-5 mr-2 text-green-600" />
              Completed Documents ({completedDocuments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {completedDocuments.length > 0 ? (
              <div className="space-y-3">
                {completedDocuments.map((document: any) => (
                  <div key={document.id} className="flex items-center justify-between p-3 border border-green-200 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileCheck className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="font-medium text-green-900">{document.fileName || `job_${jobId}_signed.pdf`}</p>
                        <p className="text-sm text-green-700">
                          Completed: {formatDate(document.completedAt || document.createdAt)}
                        </p>
                        {document.fileSize && (
                          <p className="text-xs text-green-600">
                            Size: {(document.fileSize / 1024 / 1024).toFixed(2)} MB
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Signed & Completed
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Download signed document
                          const downloadUrl = `/api/documents/signed/${encodeURIComponent(document.fileName)}`;
                          window.open(downloadUrl, '_blank');
                        }}
                        title="Download signed document"
                        className="text-green-700 border-green-300 hover:bg-green-100"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">No completed documents yet</p>
                <p className="text-sm">Documents will appear here after signing sessions</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session Recording & Activity Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SessionRecordingCard jobId={job.id} />
          <ActivityTimelineCard jobId={job.id} />
        </div>
      </div>

      {/* Job Editor Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <JobEditor 
            jobId={job.id}
            onClose={() => setIsEditModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
} 