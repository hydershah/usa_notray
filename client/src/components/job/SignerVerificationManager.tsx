import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Shield, 
  Eye, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  User,
  FileText,
  Camera,
  CreditCard,
  Clock,
  UserCheck,
  UserX,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SignerVerificationManagerProps {
  jobId: number;
  signer: {
    id: number;
    signerName: string;
    signerEmail: string;
    signerPhoneNumber: string;
    signerRole: string;
    userId?: number;
  };
  currentUserRole: string;
  onVerificationUpdate?: () => void;
}

interface VerificationData {
  user_id: number;
  full_name: string;
  email: string;
  is_verified: boolean;
  verification_status: string;
  is_verification_bypassed: boolean;
  notary_verification_bypassed: boolean;
  verification_bypass_reason?: string;
  notary_verification_bypass_reason?: string;
  bypassed_by_admin_name?: string;
  bypassed_by_notary_name?: string;
  evs_transaction_id?: string;
  evs_verification_confidence?: number;
  evs_verified_at?: string;
  id_type?: string;
  id_number?: string;
  id_expiration_date?: string;
  evs_face_match_result?: boolean;
  evs_face_match_confidence?: number;
  evs_liveness_score?: number;
  verification_image_front_url?: string;
  verification_image_back_url?: string;
  verification_image_selfie_url?: string;
  kba_verified?: boolean;
  kba_score?: number;
  verification_retry_count?: number;
  created_at: string;
}

interface VerificationImage {
  imageUrl: string;
  imageKey: string;
  expiresIn: number;
}

export function SignerVerificationManager({ 
  jobId, 
  signer, 
  currentUserRole, 
  onVerificationUpdate 
}: SignerVerificationManagerProps) {
  const { toast } = useToast();
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [verificationImages, setVerificationImages] = useState<{
    front?: VerificationImage;
    back?: VerificationImage;
    selfie?: VerificationImage;
  }>({});
  const [loadingImages, setLoadingImages] = useState(false);
  const [bypassDialog, setBypassDialog] = useState<{
    open: boolean;
    action: 'bypass' | 'revoke';
  }>({ open: false, action: 'bypass' });
  const [bypassReason, setBypassReason] = useState('');
  const [processingBypass, setProcessingBypass] = useState(false);

  const isNotary = currentUserRole === 'notary';
  const isAdmin = currentUserRole === 'admin';
  const canManageVerification = isNotary || isAdmin;

  // Don't show if no user ID (guest signer)
  if (!signer.userId) {
    return null;
  }

  const fetchVerificationData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/notary/participant/${signer.userId}/verification-documents/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVerificationData(data.user);
      } else {
        console.error('Failed to fetch verification data');
      }
    } catch (error) {
      console.error('Error fetching verification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVerificationImages = async () => {
    if (!verificationData) return;

    try {
      setLoadingImages(true);
      const imageTypes = ['front', 'back', 'selfie'];
      const imagePromises = imageTypes.map(async (imageType) => {
        try {
          const response = await fetch(`/api/notary/participant/${signer.userId}/verification-image/${imageType}/${jobId}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          if (response.ok) {
            const imageData = await response.json();
            return { type: imageType, data: imageData };
          }
        } catch (error) {
          console.error(`Error fetching ${imageType} image:`, error);
        }
        return null;
      });

      const results = await Promise.all(imagePromises);
      const newImages: any = {};
      
      results.forEach(result => {
        if (result) {
          newImages[result.type] = result.data;
        }
      });
      
      setVerificationImages(newImages);
    } catch (error) {
      console.error('Error fetching verification images:', error);
    } finally {
      setLoadingImages(false);
    }
  };

  const handleBypassVerification = async () => {
    if (!bypassReason.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide a reason for the bypass"
      });
      return;
    }

    try {
      setProcessingBypass(true);
      const endpoint = bypassDialog.action === 'bypass' 
        ? `/api/notary/bypass-verification/${signer.userId}/${jobId}`
        : `/api/notary/remove-bypass/${signer.userId}/${jobId}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: bypassReason })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: bypassDialog.action === 'bypass' 
            ? "Verification bypassed successfully" 
            : "Bypass revoked successfully"
        });
        
        // Refresh verification data
        await fetchVerificationData();
        
        // Close dialog
        setBypassDialog({ open: false, action: 'bypass' });
        setBypassReason('');
        
        // Notify parent component
        if (onVerificationUpdate) {
          onVerificationUpdate();
        }
      } else {
        const error = await response.json();
        toast({
          variant: "destructive",
          title: "Error",
          description: error.error || "Failed to update verification status"
        });
      }
    } catch (error) {
      console.error('Error updating verification status:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update verification status"
      });
    } finally {
      setProcessingBypass(false);
    }
  };

  const getVerificationStatus = () => {
    if (!verificationData) return null;

    const { is_verified, verification_status, is_verification_bypassed, notary_verification_bypassed } = verificationData;

    if (is_verification_bypassed) {
      return {
        status: 'bypassed_admin',
        label: 'Admin Bypassed',
        color: 'bg-purple-100 text-purple-800',
        icon: <Shield className="h-3 w-3" />
      };
    }

    if (notary_verification_bypassed) {
      return {
        status: 'bypassed_notary',
        label: 'Notary Bypassed',
        color: 'bg-blue-100 text-blue-800',
        icon: <Shield className="h-3 w-3" />
      };
    }

    if (is_verified && verification_status === 'approved') {
      return {
        status: 'verified',
        label: 'Verified',
        color: 'bg-green-100 text-green-800',
        icon: <CheckCircle className="h-3 w-3" />
      };
    }

    if (verification_status === 'pending') {
      return {
        status: 'pending',
        label: 'Pending',
        color: 'bg-yellow-100 text-yellow-800',
        icon: <Clock className="h-3 w-3" />
      };
    }

    if (verification_status === 'denied') {
      return {
        status: 'denied',
        label: 'Denied',
        color: 'bg-red-100 text-red-800',
        icon: <XCircle className="h-3 w-3" />
      };
    }

    return {
      status: 'unknown',
      label: 'Unknown',
      color: 'bg-gray-100 text-gray-800',
      icon: <AlertCircle className="h-3 w-3" />
    };
  };

  const renderVerificationDocuments = () => {
    if (!verificationData) return null;

    const status = getVerificationStatus();
    const hasImages = verificationData.verification_image_front_url || 
                     verificationData.verification_image_back_url || 
                     verificationData.verification_image_selfie_url;

    return (
      <div className="space-y-4">
        {/* Verification Status */}
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Verification Status</h4>
          {status && (
            <Badge className={status.color}>
              {status.icon}
              <span className="ml-1">{status.label}</span>
            </Badge>
          )}
        </div>

        {/* EVS Verification Details */}
        {verificationData.evs_transaction_id && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h5 className="font-medium mb-2">EVS Verification Details</h5>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">Transaction ID:</span>
                  <div className="font-mono text-xs">{verificationData.evs_transaction_id}</div>
                </div>
                <div>
                  <span className="font-medium">Confidence:</span>
                  <div>{verificationData.evs_verification_confidence}%</div>
                </div>
              </div>
              
              {verificationData.evs_verified_at && (
                <div>
                  <span className="font-medium">Verified:</span>
                  <div>{new Date(verificationData.evs_verified_at).toLocaleString()}</div>
                </div>
              )}
              
              {verificationData.evs_face_match_result !== undefined && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium">Face Match:</span>
                    <div className="flex items-center gap-1">
                      {verificationData.evs_face_match_result ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span>{verificationData.evs_face_match_result ? 'Pass' : 'Fail'}</span>
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Face Confidence:</span>
                    <div>{verificationData.evs_face_match_confidence}%</div>
                  </div>
                </div>
              )}
              
              {verificationData.evs_liveness_score && (
                <div>
                  <span className="font-medium">Liveness Score:</span>
                  <div>{verificationData.evs_liveness_score}%</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ID Document Information */}
        {verificationData.id_type && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h5 className="font-medium mb-2">ID Document Information</h5>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">Document Type:</span>
                  <div>{verificationData.id_type}</div>
                </div>
                {verificationData.id_number && (
                  <div>
                    <span className="font-medium">ID Number:</span>
                    <div className="font-mono">{verificationData.id_number}</div>
                  </div>
                )}
              </div>
              
              {verificationData.id_expiration_date && (
                <div>
                  <span className="font-medium">Expiration:</span>
                  <div>{new Date(verificationData.id_expiration_date).toLocaleDateString()}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* KBA Information */}
        {verificationData.kba_verified && (
          <div className="bg-green-50 p-4 rounded-lg">
            <h5 className="font-medium mb-2">KBA Verification</h5>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>KBA Passed</span>
              </div>
              {verificationData.kba_score && (
                <div>
                  <span className="font-medium">Score:</span>
                  <div>{verificationData.kba_score}%</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verification Images */}
        {hasImages && (
          <div className="space-y-3">
            <h5 className="font-medium">Verification Images</h5>
            {loadingImages ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading images...</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {['front', 'back', 'selfie'].map((imageType) => (
                  <div key={imageType} className="space-y-2">
                    <div className="text-sm font-medium capitalize">{imageType} Image</div>
                    {verificationImages[imageType] ? (
                      <img
                        src={verificationImages[imageType].imageUrl}
                        alt={`${imageType} ID image`}
                        className="w-full h-32 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-full h-32 bg-gray-100 rounded border flex items-center justify-center">
                        <Camera className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Retry Information */}
        {verificationData.verification_retry_count > 0 && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">Verification Attempts:</span> {verificationData.verification_retry_count}
          </div>
        )}
      </div>
    );
  };

  const statusInfo = getVerificationStatus();

  // Fetch verification data on component mount to show status immediately
  useEffect(() => {
    fetchVerificationData();
  }, []);

  return (
    <div className="space-y-3">
      {/* First Row: Verification Status Badge */}
      <div className="flex items-center justify-between">
        <div>
          {loading ? (
            <Badge variant="outline" className="bg-gray-100">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Loading...
            </Badge>
          ) : statusInfo ? (
            <Badge variant="outline" className={statusInfo.color}>
              {statusInfo.icon}
              <span className="ml-1">{statusInfo.label}</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-gray-100 text-gray-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              No Account
            </Badge>
          )}
        </div>
      </div>

      {/* Bypass Information */}
      {verificationData && (verificationData.is_verification_bypassed || verificationData.notary_verification_bypassed) && (
        <div className="text-xs text-gray-600 bg-amber-50 p-2 rounded border border-amber-200">
          {verificationData.is_verification_bypassed && (
            <div>
              <span className="font-medium text-purple-700">Admin Bypass:</span> {verificationData.bypassed_by_admin_name}
              {verificationData.verification_bypass_reason && (
                <div className="mt-1">Reason: {verificationData.verification_bypass_reason}</div>
              )}
            </div>
          )}
          {verificationData.notary_verification_bypassed && (
            <div>
              <span className="font-medium text-blue-700">Notary Bypass:</span> {verificationData.bypassed_by_notary_name}
              {verificationData.notary_verification_bypass_reason && (
                <div className="mt-1">Reason: {verificationData.notary_verification_bypass_reason}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Second Row: Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* View Documents Button */}
        <Dialog open={showDocuments} onOpenChange={setShowDocuments}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowDocuments(true);
                if (!verificationData) {
                  fetchVerificationData();
                }
              }}
            >
              <Eye className="h-3 w-3 mr-1" />
              View Documents
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Verification Documents - {signer.signerName}</DialogTitle>
              <DialogDescription>
                View verification documents and status for this signer
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading verification data...</span>
                </div>
              ) : verificationData ? (
                <>
                  {renderVerificationDocuments()}
                  
                  {/* Load Images Button */}
                  {!loadingImages && Object.keys(verificationImages).length === 0 && (
                    <Button
                      variant="outline"
                      onClick={fetchVerificationImages}
                      className="w-full"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Load Verification Images
                    </Button>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No verification data available</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Bypass/Revoke Buttons - Only for Notaries and when user account exists */}
        {canManageVerification && verificationData && (
          <>
            {/* Bypass Button - Show only if not already bypassed by notary */}
            {!verificationData.notary_verification_bypassed && !loading && (
              <Dialog open={bypassDialog.open && bypassDialog.action === 'bypass'} onOpenChange={(open) => setBypassDialog({ open, action: 'bypass' })}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-green-300 text-green-600 hover:bg-green-50"
                  >
                    <UserCheck className="h-3 w-3 mr-1" />
                    Bypass
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Bypass Verification</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to bypass verification for {signer.signerName}? 
                      This will mark them as verified without completing the standard verification process.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Reason for bypass:</label>
                      <Textarea
                        value={bypassReason}
                        onChange={(e) => setBypassReason(e.target.value)}
                        placeholder="Please provide a reason for bypassing verification..."
                        className="mt-1"
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setBypassDialog({ open: false, action: 'bypass' });
                          setBypassReason('');
                        }}
                        disabled={processingBypass}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleBypassVerification}
                        disabled={!bypassReason.trim() || processingBypass}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {processingBypass ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Confirm Bypass
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Revoke Button - Show only if bypassed by notary */}
            {verificationData.notary_verification_bypassed && !loading && (
              <Dialog open={bypassDialog.open && bypassDialog.action === 'revoke'} onOpenChange={(open) => setBypassDialog({ open, action: 'revoke' })}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <UserX className="h-3 w-3 mr-1" />
                    Revoke
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Revoke Verification Bypass</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to revoke the verification bypass for {signer.signerName}? 
                      This will mark them as not verified and they will need to complete the standard verification process.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Reason for revocation:</label>
                      <Textarea
                        value={bypassReason}
                        onChange={(e) => setBypassReason(e.target.value)}
                        placeholder="Please provide a reason for revoking the bypass..."
                        className="mt-1"
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setBypassDialog({ open: false, action: 'revoke' });
                          setBypassReason('');
                        }}
                        disabled={processingBypass}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleBypassVerification}
                        disabled={!bypassReason.trim() || processingBypass}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {processingBypass ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <UserX className="h-4 w-4 mr-2" />
                            Confirm Revoke
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </>
        )}
      </div>
    </div>
  );
} 