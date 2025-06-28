import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { 
  CheckCircle, XCircle, AlertCircle, FileSignature, 
  User, Clock, Camera, Fingerprint, Eye
} from "lucide-react";

// Import verification and signature components
import { VouchedIdentityVerification } from '../verification/vouched-identity-verification';
import { SignatureCaptureModal } from './signature-capture-modal';

interface GuestSignerAccessProps {
  invitationToken: string;
  onAccessGranted: (sessionData: any) => void;
  onRegistrationRequest: (signerData: any) => void;
}

interface SignerInvitation {
  id: number;
  signerName: string;
  signerEmail: string;
  signerPhoneNumber: string;
  signerRole: string;
  jobId: number;
  jobTitle: string;
  titleCompany: string;
  scheduledDate?: string;
  scheduledTime?: string;
  accessType: 'guest' | 'registered';
  guestVerificationStatus: string;
  signingStatus: string;
}

export function GuestSignerAccess({ 
  invitationToken, 
  onAccessGranted, 
  onRegistrationRequest 
}: GuestSignerAccessProps) {
  const [invitation, setInvitation] = useState<SignerInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<'verify' | 'choice' | 'guest-sign'>('verify');
  
  // Verification states
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [verificationData, setVerificationData] = useState<any>(null);
  const [showIdentityVerification, setShowIdentityVerification] = useState(false);
  
  // Guest signing states
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);
  const [tempSignature, setTempSignature] = useState<string>('');
  const [tempInitial, setTempInitial] = useState<string>('');
  
  // Session states
  const [sessionToken, setSessionToken] = useState<string>('');
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string>('');

  // Mock data for development
  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const response = await fetch(`/api/signers/invitation/${invitationToken}`);
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.message || 'Failed to load invitation');
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        if (data.success && data.invitation) {
          setInvitation(data.invitation);
        } else {
          setError('Invalid invitation data');
        }
      } catch (error) {
        console.error('Error fetching invitation:', error);
        setError('Failed to load invitation. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchInvitation();
  }, [invitationToken]);

  const handleIdentityVerification = async (verificationResult: any) => {
    try {
      // Send verification data to backend
      const response = await fetch('/api/signers/guest-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invitationToken,
          verificationData: verificationResult,
          deviceFingerprint: navigator.userAgent // Simple fingerprint for demo
        })
      });
      
      if (!response.ok) {
        throw new Error('Verification failed');
      }
      
      setVerificationData(verificationResult);
      setVerificationComplete(true);
      setCurrentStep('choice');
      
      toast({
        title: "Identity Verified",
        description: "Choose how you'd like to proceed with signing.",
      });
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: "Verification Failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
    setShowIdentityVerification(false);
  };

  const handleGuestSigningChoice = async () => {
    try {
      // Create guest session
      const response = await fetch('/api/signers/create-guest-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invitationToken,
          deviceFingerprint: navigator.userAgent,
          verificationData
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create session');
      }
      
      const data = await response.json();
      if (data.success) {
        setCurrentStep('guest-sign');
        setSessionToken(data.sessionToken);
        setSessionExpiresAt(data.expiresAt);
      } else {
        throw new Error(data.message || 'Session creation failed');
      }
    } catch (error) {
      console.error('Session creation error:', error);
      toast({
        title: "Session Creation Failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleProceedToSigning = async () => {
    if (!tempSignature) {
      toast({
        title: "Signature Required",
        description: "Please capture your signature before proceeding.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Save temporary signature
      const response = await fetch('/api/signers/save-temp-signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionToken,
          tempSignatureData: tempSignature,
          tempInitialData: tempInitial
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save signature');
      }
      
      onAccessGranted({
        sessionToken,
        signerId: invitation?.id,
        signerName: invitation?.signerName,
        signerEmail: invitation?.signerEmail,
        jobId: invitation?.jobId,
        accessType: 'guest',
        tempSignature,
        tempInitial,
        verificationData,
        expiresAt: sessionExpiresAt
      });
    } catch (error) {
      console.error('Save signature error:', error);
      toast({
        title: "Failed to Save Signature",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invitation details...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center text-red-600">
              <XCircle className="h-5 w-5 mr-2" />
              Access Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileSignature className="h-6 w-6 mr-2" />
              Document Signing Invitation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p><strong>Document:</strong> {invitation.jobTitle}</p>
                <p><strong>Title Company:</strong> {invitation.titleCompany}</p>
                <p><strong>Your Role:</strong> {invitation.signerRole}</p>
              </div>
              <div>
                <p><strong>Name:</strong> {invitation.signerName}</p>
                <p><strong>Email:</strong> {invitation.signerEmail}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress Steps */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${currentStep === 'verify' ? 'text-blue-600' : verificationComplete ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${verificationComplete ? 'bg-green-600 text-white' : currentStep === 'verify' ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                {verificationComplete ? <CheckCircle className="h-4 w-4" /> : '1'}
              </div>
              Verify Identity
            </div>
            <div className={`flex items-center ${currentStep === 'choice' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${currentStep === 'choice' || currentStep === 'guest-sign' ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                2
              </div>
              Choose Access Type
            </div>
            <div className={`flex items-center ${currentStep === 'guest-sign' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${currentStep === 'guest-sign' ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                3
              </div>
              Setup & Sign
            </div>
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 'verify' && (
          <Card>
            <CardHeader>
              <CardTitle>Identity Verification Required</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                To ensure document security and legal compliance, we need to verify your identity before you can access the signing session.
              </p>
              <Button 
                onClick={() => setShowIdentityVerification(true)}
                className="w-full"
              >
                <Camera className="h-4 w-4 mr-2" />
                Start Identity Verification
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStep === 'choice' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleGuestSigningChoice}>
              <CardHeader>
                <CardTitle className="flex items-center text-blue-600">
                  <Clock className="h-5 w-5 mr-2" />
                  Quick Guest Signing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Sign documents immediately</li>
                  <li>• Temporary 24-hour access</li>
                  <li>• Basic signature capture</li>
                  <li>• No account creation needed</li>
                  <li>• Session expires after signing</li>
                </ul>
                <Badge className="mt-4 bg-blue-100 text-blue-800">Recommended for one-time signing</Badge>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onRegistrationRequest(invitation)}>
              <CardHeader>
                <CardTitle className="flex items-center text-green-600">
                  <User className="h-5 w-5 mr-2" />
                  Full Account Registration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Create permanent account</li>
                  <li>• Upload professional signatures</li>
                  <li>• Access to all platform features</li>
                  <li>• Document history & management</li>
                  <li>• Future signing sessions</li>
                </ul>
                <Badge className="mt-4 bg-green-100 text-green-800">Best for regular users</Badge>
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 'guest-sign' && (
          <Card>
            <CardHeader>
              <CardTitle>Prepare for Signing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                    <span className="font-medium">Session Expires:</span>
                    <span className="ml-2">{new Date(sessionExpiresAt).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Capture Your Signatures</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Full Signature</Label>
                      <div className="mt-2">
                        {tempSignature ? (
                          <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                            <img src={tempSignature} alt="Signature" className="max-h-20 mx-auto" />
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setShowSignatureCapture(true)}
                              className="w-full mt-2"
                            >
                              Recapture
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            onClick={() => setShowSignatureCapture(true)}
                            variant="outline"
                            className="w-full"
                          >
                            <Fingerprint className="h-4 w-4 mr-2" />
                            Capture Signature
                          </Button>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label>Initials (Optional)</Label>
                      <div className="mt-2">
                        {tempInitial ? (
                          <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                            <img src={tempInitial} alt="Initial" className="max-h-20 mx-auto" />
                          </div>
                        ) : (
                          <Button 
                            onClick={() => setShowSignatureCapture(true)}
                            variant="outline"
                            className="w-full"
                          >
                            <Fingerprint className="h-4 w-4 mr-2" />
                            Capture Initial
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button 
                    onClick={handleProceedToSigning}
                    disabled={!tempSignature}
                    className="w-full"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Proceed to Document Signing
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modals */}
        {showIdentityVerification && (
          <Dialog open={showIdentityVerification} onOpenChange={setShowIdentityVerification}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Identity Verification</DialogTitle>
              </DialogHeader>
              <VouchedIdentityVerification
                onVerificationComplete={handleIdentityVerification}
                onVerificationFailed={() => setShowIdentityVerification(false)}
                participantId={invitation.id.toString()}
                participantName={invitation.signerName}
                sessionId={`guest-${invitation.id}-${Date.now()}`}
              />
            </DialogContent>
          </Dialog>
        )}

        {showSignatureCapture && (
          <SignatureCaptureModal
            isOpen={showSignatureCapture}
            onClose={() => setShowSignatureCapture(false)}
            onSave={(data) => {
              setTempSignature(data);
              setShowSignatureCapture(false);
            }}
            participantName={invitation.signerName}
            signatureType="signature"
          />
        )}
      </div>
    </div>
  );
} 