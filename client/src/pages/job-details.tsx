import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Edit3
} from 'lucide-react';
import { getStatusColor, formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function JobDetailsPage() {
  const [, params] = useRoute('/jobs/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const jobId = params?.id ? parseInt(params.id) : null;

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
      return response.json();
    },
    enabled: !!jobId
  });

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

  const handleStartTagging = async () => {
    try {
      // Navigate directly to editor page - session will be created there
      setLocation(`/editor/${jobId}?mode=tagging`);
    } catch (error) {
      console.error('Failed to start tagging:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start tagging session. Please try again.",
      });
    }
  };

  const handleStartLiveSession = async () => {
    try {
      // Navigate to live signing session
      setLocation(`/editor/${jobId}?mode=signing`);
    } catch (error) {
      console.error('Failed to start live session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start live signing session. Please try again.",
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
            <Button onClick={handleStartTagging} variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
              <Edit3 className="h-4 w-4 mr-2" />
              Start Tagging
            </Button>
            <Button onClick={handleStartLiveSession} className="bg-green-600 hover:bg-green-700">
              <Video className="h-4 w-4 mr-2" />
              Start Live Session
            </Button>
            <Badge className={getStatusColor(job.jobStatus)}>
              {job.jobStatus}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              
              {job.scheduledAt && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Scheduled</label>
                  <div className="flex items-center mt-1">
                    <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                    <span className="text-sm">
                      {new Date(job.scheduledAt).toLocaleDateString()} at{' '}
                      {new Date(job.scheduledAt).toLocaleTimeString()}
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
                          {signer.invitationSentAt ? "✅ Invitation Sent" : "⏳ Pending"}
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
        </div>

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
                        onClick={handleStartTagging}
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
      </div>
    </MainLayout>
  );
} 