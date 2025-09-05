import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
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
  FileCheck,
  Loader2,
  UserCheck
} from 'lucide-react';
import { getStatusColor, formatDate, isMobileDevice } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AuditTrail } from '@/components/job/AuditTrail';
import { NotaryAssignmentCard } from '@/components/job/NotaryAssignmentCard';
import { SessionRecordingCard } from '@/components/job/SessionRecordingCard';
import { ActivityTimelineCard } from '@/components/job/ActivityTimelineCard';
import { JobEditor } from '@/components/job/JobEditor';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export default function JobDetailsPage() {
  const [, params] = useRoute('/jobs/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const jobId = params?.id ? parseInt(params.id) : null;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [downloadingPackage, setDownloadingPackage] = useState(false);

  // Debug jobId (only log on changes)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && jobId) {
      console.log('🆔 JobDetailsPage - Current jobId:', jobId);
    }
  }, [jobId]);

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
        return null;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 Fetching certificate verification for job ${jobId}`);
      }
      
      const response = await fetch(`/api/certificate-verification/job/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Certificate verification API failed:', response.status, errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      if (process.env.NODE_ENV === 'development') {
        console.log('📋 Certificate verification data:', result);
      }
      return result.data as JobCertificateVerification;
    },
    enabled: !!jobId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 0, // Always fetch fresh data
    gcTime: 0 // Don't cache old data
  });

  // Debug certificate verification query state (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && (certificateError || isLoadingCertificates)) {
      console.log('🔒 Certificate verification query state:', {
        jobId,
        isLoading: isLoadingCertificates,
        hasData: !!certificateVerification,
        hasError: !!certificateError,
        error: certificateError?.message
      });
    }
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
        description: "The notary must have a valid digital certificate before starting the live session.",
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

  const handleDownloadPackage = async () => {
    if (!jobId) return;
    
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
      
      toast({
        title: "Download Started",
        description: "Your completion package is being downloaded.",
      });
      
    } catch (error) {
      console.error('Error downloading package:', error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download package. Please try again.",
      });
    } finally {
      setDownloadingPackage(false);
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 animate-in fade-in-50 duration-500">
        
        {/* Header Section - Clean and Professional */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={handleBackToJobs}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Jobs
            </Button>
            <div className="border-l border-gray-300 pl-4">
              <h1 className="text-3xl font-bold text-gray-900">Job #{job.id}</h1>
              <p className="text-gray-600 mt-2">{job.titleCompany}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Edit and Tag Buttons - Hidden from signers */}
            {user?.role !== 'signer' && 
             !(user?.role === 'title_company' || user?.role === 'company_manager' || user?.role === 'client') && (
              <>
                <Button 
                  onClick={() => setIsEditModalOpen(true)}
                  variant="outline"
                  disabled={job.jobStatus === 'completed'}
                  className={`transition-colors duration-150 ${
                    job.jobStatus === 'completed'
                      ? 'border-gray-400 text-gray-400 cursor-not-allowed'
                      : 'border-[#002A5C] text-[#002A5C] hover:bg-[#002A5C]/5'
                  }`}
                  title={
                    job.jobStatus === 'completed'
                      ? 'Cannot edit completed job'
                      : 'Edit job details, signers, and documents'
                  }
                  size="sm"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  onClick={handleStartTagging} 
                  variant="outline" 
                  disabled={
                    job.jobStatus === 'completed' ||
                    certificateVerification?.participantStatuses?.some((p: any) => p.userRole === 'notary' && !p.canProceed) || false
                  }
                  className={`transition-colors duration-150 ${
                    job.jobStatus === 'completed' ||
                    certificateVerification?.participantStatuses?.some((p: any) => p.userRole === 'notary' && !p.canProceed)
                      ? 'border-gray-400 text-gray-400 cursor-not-allowed'
                      : 'border-[#002A5C] text-[#002A5C] hover:bg-[#002A5C]/5'
                  }`}
                  title={
                    job.jobStatus === 'completed'
                      ? 'Cannot tag documents for completed job'
                      : certificateVerification?.participantStatuses?.some((p: any) => p.userRole === 'notary' && !p.canProceed)
                      ? 'Notary needs a valid digital certificate to start tagging'
                      : 'Start tagging documents'
                  }
                  size="sm"
                >
                  <Tag className="h-4 w-4 mr-2" />
                  Tag
                </Button>
              </>
            )}
            
            {/* Live Session Button - Available to all roles except title companies for open jobs */}
            {!(user?.role === 'title_company' || user?.role === 'company_manager' || user?.role === 'client') && (
              <Button 
                onClick={handleStartLiveSession} 
                disabled={
                  job.jobStatus === 'completed' ||
                  Boolean(certificateVerification && !certificateVerification.canStartJob)
                }
                className={`transition-colors duration-150 ${
                  job.jobStatus === 'completed' ||
                  (certificateVerification && !certificateVerification.canStartJob)
                    ? 'bg-gray-400 hover:bg-gray-500 cursor-not-allowed'
                    : 'bg-[#002A5C] hover:bg-[#002A5C]/90'
                }`}
                title={
                  job.jobStatus === 'completed'
                    ? 'Cannot start live session for completed job'
                    : certificateVerification && !certificateVerification.canStartJob
                    ? 'All participants need valid digital certificates to start'
                    : 'Start the live signing session'
                }
                size="sm"
              >
                <Video className="h-4 w-4 mr-2" />
                Live Session
              </Button>
            )}
            
            {/* Show Download Package button for completed jobs */}
            {job.jobStatus === 'completed' && (
              <Button 
                onClick={handleDownloadPackage}
                variant="outline"
                className="border-[#002A5C] text-[#002A5C] hover:bg-[#002A5C]/5"
                title="Download completion report and completed documents"
                size="sm"
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
            
            <Badge className={getStatusColor(job.jobStatus)}>
              {job.jobStatus}
            </Badge>
          </div>
        </div>



        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Assigned Notary & Audit Trail */}
          <div className="lg:col-span-1 space-y-4">
            <NotaryAssignmentCard jobId={job.id} />
            <AuditTrail 
              jobId={job.id} 
              jobStatus={job.jobStatus}
              minimal
            />
          </div>

          {/* Job Information */}
          <Card className="border border-gray-200 hover:shadow-sm transition-all duration-200 lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
                <Building className="h-5 w-5 mr-2 text-[#002A5C]" />
                Job Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-6">
              {/* Basic Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reference</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{job.internalReference || `Job #${job.id}`}</p>
                    </div>
                    <FileText className="h-4 w-4 text-[#002A5C]" />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">KBA Required</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{job.kbaRequired ? 'Yes' : 'No'}</p>
                    </div>
                    <Shield className="h-4 w-4 text-[#002A5C]" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Closing Type</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{job.closingType}</p>
                    </div>
                    <Building className="h-4 w-4 text-[#002A5C]" />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{formatDate(job.createdAt)}</p>
                    </div>
                    <Calendar className="h-4 w-4 text-[#002A5C]" />
                  </div>
                </div>
              </div>

              {/* Scheduling Information */}
              {(job.scheduledAt || job.selectedDate || job.selectedTime) && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between p-4 bg-[#002A5C]/5 rounded-lg border border-[#002A5C]/20">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Scheduled Appointment</p>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-[#002A5C]" />
                        <span className="text-sm font-semibold text-gray-900">
                          {job.scheduledAt ? (
                            `${new Date(job.scheduledAt).toLocaleDateString()} at ${new Date(job.scheduledAt).toLocaleTimeString()}`
                          ) : (
                            `${job.selectedDate ? new Date(job.selectedDate).toLocaleDateString() : 'Not scheduled'} at ${job.selectedTime || 'Not scheduled'}`
                          )}
                        </span>
                      </div>
                    </div>
                    <Clock className="h-6 w-6 text-[#002A5C]" />
                  </div>
                </div>
              )}

              {/* Property Address */}
              {job.propertyAddressOne && (
                <div className="border-t pt-4">
                  <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Property Address</p>
                      <div className="flex items-start">
                        <MapPin className="h-4 w-4 mr-2 text-[#002A5C] mt-0.5 flex-shrink-0" />
                        <div className="text-sm font-medium text-gray-900">
                          <p>{job.propertyAddressOne}</p>
                          {job.propertyAddressTwo && <p>{job.propertyAddressTwo}</p>}
                          <p className="text-gray-600">{job.propertyCity}, {job.propertyState} {job.propertyZipCode}</p>
                        </div>
                      </div>
                    </div>
                    <Building className="h-6 w-6 text-[#002A5C] ml-4" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signers */}
          <Card className="border border-gray-200 hover:shadow-sm transition-all duration-200 lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
                <Users className="h-5 w-5 mr-2 text-gray-700" />
                Signers ({job.signers?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {job.signers && job.signers.length > 0 ? (
                <div className="space-y-4">
                  {job.signers.map((signer: any, index: number) => (
                    <div key={signer.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-all duration-200">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-gray-900">{signer.signerName}</p>
                          <p className="text-sm text-gray-600 capitalize">{signer.signerRole}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">Signer {index + 1}</Badge>
                      </div>
                      {(signer.signerEmail || signer.signerPhone) && (
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                          {signer.signerEmail && (
                            <div className="flex items-center">
                              <Mail className="h-4 w-4 mr-2 text-[#002A5C]" />
                              {signer.signerEmail}
                            </div>
                          )}
                          {signer.signerPhone && (
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 mr-2 text-[#002A5C]" />
                              {signer.signerPhone}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-2">
                        <Badge className={signer.invitationSentAt ? 'bg-[#002A5C]/10 text-[#002A5C]' : 'bg-gray-100 text-gray-700'}>
                          {signer.invitationSentAt ? 'Invitation Sent' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No signers added yet</p>
                  <p className="text-xs mt-1">Signers will appear here once added to the job</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>



        {/* Documents Section */}
        <Card className="border border-gray-200 hover:shadow-sm transition-all duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg font-semibold text-gray-900">
              <div className="flex items-center">
                <FileText className="h-5 w-5 mr-2 text-gray-700" />
                Documents ({documents.length})
              </div>
              <Badge variant="outline" className="text-xs">
                {documents.length} total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {documents.length > 0 ? (
              <div className="space-y-3">
                {documents.map((document: any) => (
                  <div key={document.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-all duration-200 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-[#002A5C]/10 rounded-lg">
                          <FileText className="h-6 w-6 text-[#002A5C]" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 text-sm">{document.originalName}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-600 mt-1">
                            <div className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              Uploaded {document.uploadedAt ? formatDate(document.uploadedAt) : 'Invalid Date'}
                            </div>
                            {document.fileSize && (
                              <div className="flex items-center">
                                <FileText className="h-3 w-3 mr-1" />
                                {(document.fileSize / 1024 / 1024).toFixed(2)} MB
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-gray-100 text-gray-700 text-xs">
                          Original
                        </Badge>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreview(document.id)}
                            title="Preview document"
                            className="h-8 w-8 p-0 border-[#002A5C] text-[#002A5C] hover:bg-[#002A5C]/5"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(document.id, document.originalName)}
                            title="Download document"
                            className="h-8 w-8 p-0 border-[#002A5C] text-[#002A5C] hover:bg-[#002A5C]/5"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {user?.role !== 'signer' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`/editor/${jobId}?mode=tagging`, '_blank')}
                              title="Tag document"
                              className="h-8 w-8 p-0 border-[#002A5C] text-[#002A5C] hover:bg-[#002A5C]/5"
                            >
                              <Tag className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm font-medium">No documents uploaded yet</p>
                <p className="text-xs mt-1">Documents will appear here once uploaded to the job</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Documents Section */}
        <Card className="border border-gray-200 hover:shadow-sm transition-all duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg font-semibold text-gray-900">
              <div className="flex items-center">
                <FileCheck className="h-5 w-5 mr-2 text-gray-700" />
                Completed Documents ({completedDocuments.length})
              </div>
              <Badge variant="outline" className="text-xs">
                {completedDocuments.length} signed
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {completedDocuments.length > 0 ? (
              <div className="space-y-3">
                {completedDocuments.map((document: any) => (
                  <div key={document.id} className="border border-[#002A5C]/20 rounded-lg p-4 hover:shadow-sm transition-all duration-200 bg-[#002A5C]/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-[#002A5C]/20 rounded-lg">
                          <FileCheck className="h-6 w-6 text-[#002A5C]" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 text-sm">{document.fileName || `job_${jobId}_signed.pdf`}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-600 mt-1">
                            <div className="flex items-center">
                              <CheckCircle className="h-3 w-3 mr-1 text-[#002A5C]" />
                              Completed: {formatDate(document.completedAt || document.createdAt)}
                            </div>
                            {document.fileSize && (
                              <div className="flex items-center">
                                <FileText className="h-3 w-3 mr-1" />
                                {(document.fileSize / 1024 / 1024).toFixed(2)} MB
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#002A5C]/15 text-[#002A5C] border-[#002A5C]/30 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Signed & Completed
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const downloadUrl = `/api/documents/signed/${encodeURIComponent(document.fileName)}`;
                            window.open(downloadUrl, '_blank');
                          }}
                          title="Download signed document"
                          className="h-8 w-8 p-0 border-[#002A5C] text-[#002A5C] hover:bg-[#002A5C]/10"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm font-medium">No completed documents yet</p>
                <p className="text-xs mt-1">Documents will appear here after signing sessions</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session Recording & Activity Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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