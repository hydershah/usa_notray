import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Shield,
  CheckCircle,
  AlertCircle,
  UserCheck,
  Camera,
  CreditCard,
  FileText,
  Clock,
  Loader2,
  RefreshCw,
  Download,
  Upload,
  Eye,
  XCircle,
  Info,
  Award,
  Lock
} from 'lucide-react';
import { EVSVerification } from '@/components/verification/evs-verification';
import { KBAVerification } from '@/components/verification/kba-verification';
import { useToast } from '@/hooks/use-toast';

interface VerificationStatus {
  idVerified: boolean;
  kbaVerified: boolean;
  verificationStatus: string;
  verificationDate?: string;
  kbaVerificationDate?: string;
  kbaScore?: number;
  verificationMethod?: string;
  isVerificationBypassed: boolean;
  notaryVerificationBypassed: boolean;
  verificationImageUrls?: {
    front?: string;
    back?: string;
    selfie?: string;
  };
  certificate?: {
    hasCertificate: boolean;
    certificateId?: string;
    downloadUrl?: string;
    expirationDate?: string;
  };
}

export default function IDVerification() {
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const [showEVSVerification, setShowEVSVerification] = useState(false);
  const [showKBAVerification, setShowKBAVerification] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Use user data directly from auth instead of separate query
  const verificationStatus: VerificationStatus | undefined = user ? {
    idVerified: user.isVerified || false,
    kbaVerified: user.kbaVerified || false,
    verificationStatus: user.verificationStatus || 'pending',
    verificationDate: user.evsVerifiedAt || undefined,
    kbaVerificationDate: user.kbaVerificationDate || undefined,
    kbaScore: user.kbaScore || undefined,
    verificationMethod: user.isVerified ? 'ID Verification' : 
                       user.isVerificationBypassed ? 'Admin Bypass' : 
                       user.notaryVerificationBypassed ? 'Notary Bypass' : undefined,
    isVerificationBypassed: user.isVerificationBypassed || false,
    notaryVerificationBypassed: user.notaryVerificationBypassed || false,
    verificationImageUrls: {
      front: user.verificationImageFrontUrl || undefined,
      back: user.verificationImageBackUrl || undefined,
      selfie: user.verificationImageSelfieUrl || undefined,
    },
    certificate: {
      hasCertificate: false, // Will be fetched separately if needed
    }
  } : undefined;

  const isLoading = !user;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch?.();
      toast({
        title: "Status Updated",
        description: "Verification status has been refreshed.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: "Failed to refresh verification status. Please try again.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleEVSVerificationComplete = (result: any) => {
    setShowEVSVerification(false);
    refetch?.();
    toast({
      title: "ID Verification Complete",
      description: "Your identity has been successfully verified!",
    });
  };

  const handleEVSVerificationFailed = (error: string) => {
    setShowEVSVerification(false);
    toast({
      variant: "destructive",
      title: "ID Verification Failed",
      description: error,
    });
  };

  const handleKBAVerificationComplete = (result: any) => {
    setShowKBAVerification(false);
    refetch?.();
    toast({
      title: "KBA Verification Complete",
      description: `Knowledge-based authentication completed with ${result.score}% score!`,
    });
  };

  const handleKBAVerificationFailed = (error: string) => {
    setShowKBAVerification(false);
    toast({
      variant: "destructive",
      title: "KBA Verification Failed",
      description: error,
    });
  };

  const getVerificationProgress = () => {
    if (!verificationStatus) return 0;
    
    let progress = 0;
    if (verificationStatus.idVerified || verificationStatus.isVerificationBypassed) progress += 50;
    if (verificationStatus.kbaVerified) progress += 25;
    if (verificationStatus.certificate?.hasCertificate) progress += 25;
    
    return progress;
  };

  const getVerificationStatusBadge = () => {
    if (!verificationStatus) return null;
    
    // Check for any form of verification
    const isVerifiedViaID = verificationStatus.idVerified;
    const isBypassedByAdmin = verificationStatus.isVerificationBypassed;
    const isBypassedByNotary = verificationStatus.notaryVerificationBypassed;
    const hasApprovedStatus = verificationStatus.verificationStatus === 'approved';
    
    // User is considered verified if they have ID verification OR any bypass OR approved status
    const isFullyVerified = isVerifiedViaID || isBypassedByAdmin || isBypassedByNotary || hasApprovedStatus;
    
    if (isFullyVerified) {
      let verificationMethod = '';
      if (isVerifiedViaID) verificationMethod = 'ID Verified';
      else if (isBypassedByAdmin) verificationMethod = 'Admin Approved';
      else if (isBypassedByNotary) verificationMethod = 'Notary Approved';
      else if (hasApprovedStatus) verificationMethod = 'Approved';
      
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Verified {verificationMethod && `(${verificationMethod})`}</Badge>;
    } else if (verificationStatus.verificationStatus === 'pending' || verificationStatus.verificationStatus === 'review') {
      return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending Review</Badge>;
    } else if (verificationStatus.verificationStatus === 'failed' || verificationStatus.verificationStatus === 'denied') {
      return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    } else {
      return <Badge className="bg-gray-100 text-gray-800"><AlertCircle className="h-3 w-3 mr-1" />Not Started</Badge>;
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading verification status...</p>
          </div>
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
            <h1 className="text-3xl font-bold text-gray-900">ID Verification</h1>
            <p className="text-gray-600 mt-1">
              Identity verification and KYC
            </p>
          </div>
          <div className="flex items-center gap-3">
            {getVerificationStatusBadge()}
            <Button onClick={handleRefresh} variant="outline" size="sm" disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Verification Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Verification Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                <span className="text-sm text-gray-500">{getVerificationProgress()}%</span>
              </div>
              <Progress value={getVerificationProgress()} className="h-2" />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                {/* ID Verification */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`p-2 rounded-lg ${
                    verificationStatus?.idVerified || verificationStatus?.isVerificationBypassed 
                      ? 'bg-green-100' : 'bg-gray-200'
                  }`}>
                    <UserCheck className={`h-5 w-5 ${
                      verificationStatus?.idVerified || verificationStatus?.isVerificationBypassed 
                        ? 'text-green-600' : 'text-gray-500'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">ID Verification</p>
                    <p className="text-sm text-gray-600">
                      {verificationStatus?.idVerified || verificationStatus?.isVerificationBypassed 
                        ? 'Complete' : 'Required'}
                    </p>
                  </div>
                </div>

                {/* KBA Verification */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`p-2 rounded-lg ${
                    verificationStatus?.kbaVerified ? 'bg-green-100' : 'bg-gray-200'
                  }`}>
                    <FileText className={`h-5 w-5 ${
                      verificationStatus?.kbaVerified ? 'text-green-600' : 'text-gray-500'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">KBA Verification</p>
                    <p className="text-sm text-gray-600">
                      {verificationStatus?.kbaVerified ? 'Complete' : 'Optional'}
                    </p>
                  </div>
                </div>

                {/* Digital Certificate */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`p-2 rounded-lg ${
                    verificationStatus?.certificate?.hasCertificate ? 'bg-green-100' : 'bg-gray-200'
                  }`}>
                    <Award className={`h-5 w-5 ${
                      verificationStatus?.certificate?.hasCertificate ? 'text-green-600' : 'text-gray-500'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Digital Certificate</p>
                    <p className="text-sm text-gray-600">
                      {verificationStatus?.certificate?.hasCertificate ? 'Generated' : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Verification Sections */}
        <Tabs defaultValue="id-verification" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="id-verification">ID Verification</TabsTrigger>
            <TabsTrigger value="kba-verification">KBA Verification</TabsTrigger>
            <TabsTrigger value="certificate">Digital Certificate</TabsTrigger>
          </TabsList>

          {/* ID Verification Tab */}
          <TabsContent value="id-verification" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-blue-600" />
                  Identity Verification (EVS)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {verificationStatus?.idVerified || verificationStatus?.isVerificationBypassed ? (
                  <div className="space-y-4">
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        <strong>Identity Verified!</strong> Your identity has been successfully verified
                        {verificationStatus.verificationDate && 
                          ` on ${new Date(verificationStatus.verificationDate).toLocaleDateString()}`
                        }.
                        {verificationStatus.isVerificationBypassed && (
                          <span className="block mt-1 text-sm">
                            (Verification was bypassed by administrator)
                          </span>
                        )}
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="font-medium text-gray-900">Verification Method</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {verificationStatus.verificationMethod || 'EVS Solutions ID Verification'}
                        </p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="font-medium text-gray-900">Status</p>
                        <p className="text-sm text-gray-600 mt-1 capitalize">
                          {verificationStatus.verificationStatus}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert className="border-orange-200 bg-orange-50">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-orange-800">
                        <strong>ID Verification Required:</strong> Complete identity verification to participate in document signing sessions.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3">
                          <Camera className="h-8 w-8 text-blue-600" />
                          <div>
                            <p className="font-medium">1. Upload ID</p>
                            <p className="text-sm text-gray-600">Take photos of your government ID</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <UserCheck className="h-8 w-8 text-blue-600" />
                          <div>
                            <p className="font-medium">2. Take Selfie</p>
                            <p className="text-sm text-gray-600">Verify your identity with a selfie</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Shield className="h-8 w-8 text-blue-600" />
                          <div>
                            <p className="font-medium">3. Instant Verification</p>
                            <p className="text-sm text-gray-600">Get verified in seconds</p>
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        onClick={() => setShowEVSVerification(true)}
                        className="w-full sm:w-auto"
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Start ID Verification
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* KBA Verification Tab */}
          <TabsContent value="kba-verification" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Knowledge-Based Authentication (KBA)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {verificationStatus?.kbaVerified ? (
                  <div className="space-y-4">
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        <strong>KBA Verification Complete!</strong> You scored {verificationStatus.kbaScore}%
                        {verificationStatus.kbaVerificationDate && 
                          ` on ${new Date(verificationStatus.kbaVerificationDate).toLocaleDateString()}`
                        }.
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert className="border-blue-200 bg-blue-50">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        <strong>Enhanced Security:</strong> KBA provides additional identity verification for high-value transactions.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="space-y-4">
                      <p className="text-gray-600">
                        Knowledge-Based Authentication uses questions based on your credit history and public records 
                        to further verify your identity. This is required for certain high-value document signings.
                      </p>
                      
                      {(verificationStatus?.idVerified || verificationStatus?.isVerificationBypassed) ? (
                        <Button 
                          onClick={() => setShowKBAVerification(true)}
                          className="w-full sm:w-auto"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Start KBA Verification
                        </Button>
                      ) : (
                        <Alert className="border-orange-200 bg-orange-50">
                          <AlertCircle className="h-4 w-4 text-orange-600" />
                          <AlertDescription className="text-orange-800">
                            Complete ID verification first before starting KBA verification.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Digital Certificate Tab */}
          <TabsContent value="certificate" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-blue-600" />
                  Digital Certificate
                </CardTitle>
              </CardHeader>
              <CardContent>
                {verificationStatus?.certificate?.hasCertificate ? (
                  <div className="space-y-4">
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        <strong>Certificate Generated!</strong> Your digital certificate is ready for secure document signing.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="font-medium text-gray-900">Certificate ID</p>
                        <p className="text-sm text-gray-600 mt-1 font-mono">
                          {verificationStatus.certificate.certificateId}
                        </p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="font-medium text-gray-900">Expires</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {verificationStatus.certificate.expirationDate && 
                            new Date(verificationStatus.certificate.expirationDate).toLocaleDateString()
                          }
                        </p>
                      </div>
                    </div>
                    
                    {verificationStatus.certificate.downloadUrl && (
                      <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Download Certificate
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert className="border-blue-200 bg-blue-50">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        <strong>Automatic Generation:</strong> Your digital certificate will be automatically generated after ID verification.
                      </AlertDescription>
                    </Alert>
                    
                    <p className="text-gray-600">
                      A self-signed digital certificate will be automatically created for you once identity verification 
                      is complete. This certificate enables secure digital signing of documents.
                    </p>
                    
                    {!(verificationStatus?.idVerified || verificationStatus?.isVerificationBypassed) && (
                      <Alert className="border-orange-200 bg-orange-50">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-800">
                          Complete ID verification to automatically generate your digital certificate.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* EVS Verification Modal */}
        {showEVSVerification && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">ID Verification</h2>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowEVSVerification(false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <EVSVerification
                  userId={user?.id || 0}
                  onVerificationComplete={handleEVSVerificationComplete}
                  onVerificationFailed={handleEVSVerificationFailed}
                />
              </div>
            </div>
          </div>
        )}

        {/* KBA Verification Modal */}
        {showKBAVerification && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">KBA Verification</h2>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowKBAVerification(false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <KBAVerification
                  userId={user?.id?.toString() || '0'}
                  onVerificationComplete={handleKBAVerificationComplete}
                  onVerificationFailed={handleKBAVerificationFailed}
                  requireKBA={true}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
} 