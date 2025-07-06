import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  User, 
  Calendar, 
  MapPin, 
  CreditCard, 
  Eye, 
  Clock, 
  Globe, 
  Activity,
  FileText,
  Smartphone,
  RefreshCw,
  Image as ImageIcon,
  Download,
  ZoomIn
} from 'lucide-react';
import { format } from 'date-fns';

interface VerificationData {
  // Basic verification status
  isVerified: boolean;
  verificationStatus: string;
  
  // EVS comprehensive data
  evsTransactionId?: string;
  evsVerificationConfidence?: number;
  evsVerifiedAt?: string;
  
  // Extracted document data
  evsExtractedFirstName?: string;
  evsExtractedLastName?: string;
  evsExtractedFullName?: string;
  evsExtractedDateOfBirth?: string;
  evsExtractedAddress?: string;
  
  // Biometric data
  evsFaceMatchResult?: boolean;
  evsFaceMatchConfidence?: number;
  evsLivenessScore?: number;
  
  // Metadata
  evsVerificationErrors?: string[];
  evsVerificationWarnings?: string[];
  evsDocumentTypeDetected?: string;
  evsVerificationMethod?: string;
  verificationIpAddress?: string;
  verificationUserAgent?: string;
  verificationRetryCount?: number;
  
  // Basic ID fields for comparison
  idType?: string;
  idNumber?: string;
  idExpirationDate?: string;
  idIssueDate?: string;
  
  // Verification image URLs
  verificationImageFrontUrl?: string;
  verificationImageBackUrl?: string;
  verificationImageSelfieUrl?: string;
}

interface VerificationAttempt {
  id: number;
  attemptNumber: number;
  evsTransactionId?: string;
  status: string;
  confidenceScore?: number;
  documentType?: string;
  extractedFirstName?: string;
  extractedLastName?: string;
  extractedDateOfBirth?: string;
  extractedDocumentNumber?: string;
  extractedExpirationDate?: string;
  extractedAddress?: string;
  faceMatchResult?: boolean;
  faceMatchConfidence?: number;
  livenessScore?: number;
  errors?: string[];
  warnings?: string[];
  ipAddress?: string;
  userAgent?: string;
  attemptedAt: string;
  processingTimeMs?: number;
  apiEnvironment?: string;
}

interface VerificationDataViewProps {
  userId: number;
  userRole: string;
  className?: string;
}

export function VerificationDataView({ 
  userId, 
  userRole, 
  className = "" 
}: VerificationDataViewProps) {
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
  const [verificationAttempts, setVerificationAttempts] = useState<VerificationAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchVerificationData();
  }, [userId]);

  const fetchVerificationData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch user verification data
      const userResponse = await fetch(`/api/admin/users/${userId}/verification-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setVerificationData(userData);
      }

      // Fetch verification attempts history
      const attemptsResponse = await fetch(`/api/admin/users/${userId}/verification-attempts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (attemptsResponse.ok) {
        const attemptsData = await attemptsResponse.json();
        setVerificationAttempts(attemptsData);
      }
    } catch (error) {
      console.error('Error fetching verification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVerificationStatusBadge = (status: string, isVerified: boolean) => {
    if (isVerified && status === 'verified') {
      return <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
        <CheckCircle className="w-3 h-3 mr-1" />
        Verified
      </Badge>;
    }
    
    if (status === 'pending') {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
        <Clock className="w-3 h-3 mr-1" />
        Pending
      </Badge>;
    }
    
          if (status === 'denied') {
      return <Badge variant="destructive">
        <XCircle className="w-3 h-3 mr-1" />
        Failed
      </Badge>;
    }
    
    return <Badge variant="outline">
      <AlertTriangle className="w-3 h-3 mr-1" />
      {status}
    </Badge>;
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-500';
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBiometricStatusIcon = (result?: boolean, confidence?: number) => {
    if (result === true && confidence && confidence >= 75) {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
    if (result === false || (confidence && confidence < 75)) {
      return <XCircle className="w-4 h-4 text-red-600" />;
    }
    return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!verificationData) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <Shield className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No verification data available for this user.</p>
        </CardContent>
      </Card>
    );
  }

  // Only show verification data for signers and witnesses
  if (userRole !== 'signer' && userRole !== 'witness') {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <User className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">ID verification not required for {userRole} users.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-6 h-6" />
          <h3 className="text-lg font-semibold">Identity Verification Data</h3>
        </div>
        <div className="flex items-center space-x-2">
          {getVerificationStatusBadge(verificationData.verificationStatus, verificationData.isVerified)}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchVerificationData}
            className="flex items-center space-x-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">ID Documents</TabsTrigger>
          <TabsTrigger value="extracted">Extracted Data</TabsTrigger>
          <TabsTrigger value="biometric">Biometric</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Verification Status Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Verification Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  {getVerificationStatusBadge(verificationData.verificationStatus, verificationData.isVerified)}
                </div>
                
                {verificationData.evsVerificationConfidence && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Confidence Score</span>
                    <span className={`font-semibold ${getConfidenceColor(verificationData.evsVerificationConfidence)}`}>
                      {verificationData.evsVerificationConfidence}%
                    </span>
                  </div>
                )}
                
                {verificationData.evsTransactionId && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Transaction ID</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {verificationData.evsTransactionId.slice(-8)}
                    </code>
                  </div>
                )}
                
                {verificationData.evsVerifiedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Verified At</span>
                    <span className="text-sm">
                      {format(new Date(verificationData.evsVerifiedAt), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Document Information Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Document Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Document Type</span>
                  <span className="text-sm font-medium">
                    {verificationData.evsDocumentTypeDetected || verificationData.idType || 'N/A'}
                  </span>
                </div>
                
                {verificationData.idNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Document Number</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      ***{verificationData.idNumber.slice(-4)}
                    </code>
                  </div>
                )}
                
                {verificationData.idExpirationDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Expiration Date</span>
                    <span className="text-sm">{verificationData.idExpirationDate}</span>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Verification Method</span>
                  <Badge variant="outline" className="text-xs">
                    {verificationData.evsVerificationMethod || 'api'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Errors and Warnings */}
          {(verificationData.evsVerificationErrors?.length || verificationData.evsVerificationWarnings?.length) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Issues & Warnings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {verificationData.evsVerificationErrors?.map((error, index) => (
                  <div key={index} className="flex items-start space-x-2 p-3 bg-red-50 rounded-lg">
                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                ))}
                
                {verificationData.evsVerificationWarnings?.map((warning, index) => (
                  <div key={index} className="flex items-start space-x-2 p-3 bg-yellow-50 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-yellow-700">{warning}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>ID Verification Documents</span>
              </CardTitle>
              <CardDescription>
                View the identity documents submitted during verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IdDocumentViewer 
                userId={userId} 
                frontImageUrl={verificationData.verificationImageFrontUrl}
                backImageUrl={verificationData.verificationImageBackUrl}
                selfieImageUrl={verificationData.verificationImageSelfieUrl}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extracted" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>Extracted Document Data</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">First Name</label>
                  <p className="text-sm mt-1 p-2 bg-gray-50 rounded">
                    {verificationData.evsExtractedFirstName || 'Not extracted'}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Last Name</label>
                  <p className="text-sm mt-1 p-2 bg-gray-50 rounded">
                    {verificationData.evsExtractedLastName || 'Not extracted'}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Date of Birth</label>
                  <p className="text-sm mt-1 p-2 bg-gray-50 rounded">
                    {verificationData.evsExtractedDateOfBirth || 'Not extracted'}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Full Name</label>
                  <p className="text-sm mt-1 p-2 bg-gray-50 rounded">
                    {verificationData.evsExtractedFullName || 'Not extracted'}
                  </p>
                </div>
              </div>
              
              {verificationData.evsExtractedAddress && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Address</label>
                  <p className="text-sm mt-1 p-2 bg-gray-50 rounded">
                    {verificationData.evsExtractedAddress}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="biometric" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Eye className="w-5 h-5" />
                <span>Biometric Verification Results</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Face Match</span>
                    {getBiometricStatusIcon(verificationData.evsFaceMatchResult, verificationData.evsFaceMatchConfidence)}
                  </div>
                  <p className="text-lg font-semibold">
                    {verificationData.evsFaceMatchResult ? 'Passed' : 'Failed'}
                  </p>
                  {verificationData.evsFaceMatchConfidence && (
                    <p className={`text-sm ${getConfidenceColor(verificationData.evsFaceMatchConfidence)}`}>
                      {verificationData.evsFaceMatchConfidence}% confidence
                    </p>
                  )}
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Liveness Detection</span>
                    {getBiometricStatusIcon(
                      verificationData.evsLivenessScore ? verificationData.evsLivenessScore >= 75 : undefined, 
                      verificationData.evsLivenessScore
                    )}
                  </div>
                  <p className="text-lg font-semibold">
                    {verificationData.evsLivenessScore || 0}%
                  </p>
                  <p className="text-xs text-gray-500">
                    {(verificationData.evsLivenessScore || 0) >= 75 ? 'Live person detected' : 'Liveness check failed'}
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Overall Score</span>
                    {verificationData.evsVerificationConfidence && verificationData.evsVerificationConfidence >= 75 ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <p className={`text-lg font-semibold ${getConfidenceColor(verificationData.evsVerificationConfidence)}`}>
                    {verificationData.evsVerificationConfidence || 0}%
                  </p>
                  <p className="text-xs text-gray-500">Combined confidence</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5" />
                <span>Verification Attempts History</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {verificationAttempts.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No verification attempts recorded.</p>
              ) : (
                <div className="space-y-4">
                  {verificationAttempts.map((attempt) => (
                    <div key={attempt.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">Attempt #{attempt.attemptNumber}</Badge>
                          {getVerificationStatusBadge(attempt.status, attempt.status === 'approved')}
                        </div>
                        <span className="text-sm text-gray-500">
                          {format(new Date(attempt.attemptedAt), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Confidence:</span>
                          <span className={`ml-1 ${getConfidenceColor(attempt.confidenceScore)}`}>
                            {attempt.confidenceScore || 0}%
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Document:</span>
                          <span className="ml-1">{attempt.documentType || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium">Processing:</span>
                          <span className="ml-1">{attempt.processingTimeMs || 0}ms</span>
                        </div>
                        <div>
                          <span className="font-medium">Environment:</span>
                          <span className="ml-1">{attempt.apiEnvironment || 'sandbox'}</span>
                        </div>
                      </div>
                      
                      {(attempt.errors?.length || attempt.warnings?.length) && (
                        <div className="mt-3 space-y-1">
                          {attempt.errors?.map((error, idx) => (
                            <p key={idx} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                              ❌ {error}
                            </p>
                          ))}
                          {attempt.warnings?.map((warning, idx) => (
                            <p key={idx} className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
                              ⚠️ {warning}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// IdDocumentViewer Component
interface IdDocumentViewerProps {
  userId: number;
  frontImageUrl?: string;
  backImageUrl?: string;
  selfieImageUrl?: string;
}

function IdDocumentViewer({ userId, frontImageUrl, backImageUrl, selfieImageUrl }: IdDocumentViewerProps) {
  const [imageUrls, setImageUrls] = useState<{
    front?: string;
    back?: string;
    selfie?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    front?: string;
    back?: string;
    selfie?: string;
  }>({});

  useEffect(() => {
    loadImages();
  }, [userId, frontImageUrl, backImageUrl, selfieImageUrl]);

  const loadImages = async () => {
    setLoading(true);
    setErrors({});
    const token = localStorage.getItem('token');
    const newImageUrls: { front?: string; back?: string; selfie?: string } = {};
    const newErrors: { front?: string; back?: string; selfie?: string } = {};

    // Debug logging
    console.log('🔍 IdDocumentViewer - loadImages called with:', {
      userId,
      frontImageUrl,
      backImageUrl,
      selfieImageUrl
    });

    // Load each image that has a URL
    const imageTypes = [
      { type: 'front', url: frontImageUrl },
      { type: 'back', url: backImageUrl },
      { type: 'selfie', url: selfieImageUrl }
    ] as const;

    for (const { type, url } of imageTypes) {
      if (url) {
        try {
          // If the URL is already a full URL (starts with http), use it directly
          if (url.startsWith('http')) {
            newImageUrls[type] = url;
          } else {
            // Otherwise, treat it as a file key and get signed URL from API
            const response = await fetch(`/api/admin/users/${userId}/verification-image/${type}`, {
              headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
              const data = await response.json();
              newImageUrls[type] = data.imageUrl;
            } else {
              newErrors[type] = 'Failed to load image';
            }
          }
        } catch (error) {
          newErrors[type] = 'Error loading image';
        }
      }
    }

    setImageUrls(newImageUrls);
    setErrors(newErrors);
    setLoading(false);
  };

  const hasAnyImage = frontImageUrl || backImageUrl || selfieImageUrl;

  if (!hasAnyImage) {
    return (
      <div className="text-center py-8">
        <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">No verification documents uploaded</p>
        <p className="text-sm text-gray-400 mt-1">
          Documents will appear here after the user completes ID verification
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-32 bg-gray-200 rounded-lg mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  const DocumentImage = ({ 
    type, 
    title, 
    url, 
    error 
  }: { 
    type: 'front' | 'back' | 'selfie'; 
    title: string; 
    url?: string; 
    error?: string; 
  }) => (
    <div className="border rounded-lg overflow-hidden">
      <div className="p-3 bg-gray-50 border-b">
        <h4 className="text-sm font-medium text-gray-900">{title}</h4>
      </div>
      <div className="p-4">
        {error ? (
          <div className="h-32 bg-red-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        ) : url ? (
          <div className="relative group">
            <img 
              src={url} 
              alt={title}
              className="w-full h-32 object-cover rounded-lg"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                setErrors(prev => ({ ...prev, [type]: 'Failed to display image' }));
              }}
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="secondary" className="bg-white/90 hover:bg-white">
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>{title}</DialogTitle>
                      <DialogDescription>
                        Verification document submitted by user
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                      <img 
                        src={url} 
                        alt={title}
                        className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="bg-white/90 hover:bg-white"
                  onClick={() => window.open(url, '_blank')}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Not provided</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DocumentImage 
          type="front"
          title="Front of ID"
          url={imageUrls.front}
          error={errors.front}
        />
        <DocumentImage 
          type="back"
          title="Back of ID"
          url={imageUrls.back}
          error={errors.back}
        />
        <DocumentImage 
          type="selfie"
          title="Selfie Photo"
          url={imageUrls.selfie}
          error={errors.selfie}
        />
      </div>
      
      {(errors.front || errors.back || errors.selfie) && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-yellow-800 font-medium">Some images failed to load</p>
              <p className="text-xs text-yellow-700 mt-1">
                This might be due to storage issues or the images may have been deleted. 
                Contact support if this persists.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
        <span>Images are securely stored and automatically expire after viewing</span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={loadImages}
          className="text-xs"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Refresh
        </Button>
      </div>
    </div>
  );
}