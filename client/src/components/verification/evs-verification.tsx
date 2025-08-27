import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { 
  Upload, Camera, FileText, AlertCircle, CheckCircle, 
  XCircle, RefreshCw, Eye, User, CreditCard, Shield 
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EVSVerificationProps {
  userId: number;
  onVerificationComplete: (result: any) => void;
  onVerificationFailed: (error: string) => void;
}

interface VerificationState {
  step: 'upload' | 'capture' | 'processing' | 'complete' | 'failed';
  frontImageData?: string;
  backImageData?: string;
  selfieData?: string;
  verificationResult?: any;
  error?: string;
  documentType?: string;
}

export function EVSVerification({ 
  userId, 
  onVerificationComplete, 
  onVerificationFailed 
}: EVSVerificationProps) {
  const [state, setState] = useState<VerificationState>({ 
    step: 'upload',
    documentType: 'drivers_license' 
  });
  const [loading, setLoading] = useState(false);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showSelfieCapture, setShowSelfieCapture] = useState(false);

  const handleFileUpload = (type: 'front' | 'back', file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setState(prev => ({
        ...prev,
        [type === 'front' ? 'frontImageData' : 'backImageData']: imageData
      }));
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowSelfieCapture(true);
    } catch (error) {
      console.error('Camera access error:', error);
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to complete verification",
        variant: "destructive",
      });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    ctx?.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setState(prev => ({ ...prev, selfieData: imageData }));
    
    // Stop camera
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowSelfieCapture(false);
  };

  const handleSelfieUpload = (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setState(prev => ({ ...prev, selfieData: imageData }));
    };
    reader.readAsDataURL(file);
  };

  const submitVerification = async () => {
    if (!state.frontImageData || !state.selfieData) {
      toast({
        title: "Missing Documents",
        description: "Please upload all required documents",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setState(prev => ({ ...prev, step: 'processing' }));

    try {
      const formData = new FormData();
      formData.append('userId', userId.toString());
      formData.append('frontImage', dataURLtoBlob(state.frontImageData));
      if (state.backImageData) {
        formData.append('backImage', dataURLtoBlob(state.backImageData));
      }
      formData.append('selfieImage', dataURLtoBlob(state.selfieData));
      
      // For international documents like Emirates ID, treat as passport for better recognition
      formData.append('documentType', state.documentType || 'drivers_license');

      const token = localStorage.getItem('token');
      
      // Create AbortController for timeout handling (increase to 90s to avoid premature errors)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('⏰ Verification timeout reached (90 seconds)');
        controller.abort();
      }, 90000);

      console.log('🔍 Starting ID verification request...');
      const startTime = Date.now();

      const response = await fetch('/api/verification/evs-verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`📥 ID verification response received after ${duration}ms`);

      if (response.ok) {
        const result = await response.json();
        console.log('📥 HTTP 200 response received:', result);
        console.log('   result.success:', result.success);
        console.log('   result.status:', result.status);
        console.log('   result.confidence:', result.confidence);
        
        // Check for both HTTP 200 AND result.success === true
        if (result.success === true || result.status === 'approved') {
          console.log('✅ Verification completed successfully - updating UI state');
          setState(prev => ({ 
            ...prev, 
            step: 'complete', 
            verificationResult: result 
          }));
          onVerificationComplete(result);
          
          toast({
            title: "Verification Complete",
            description: "Your identity has been successfully verified!",
          });
          console.log('🎉 Success toast displayed and callbacks executed');
        } else {
          // HTTP 200 but result.success === false - treat as error
          console.log('❌ Backend returned HTTP 200 but success=false:', result);
          console.log('   result.message:', result.message);
          console.log('   result.reasons:', result.reasons);
          throw new Error(result.message || result.reasons?.join('; ') || 'Verification failed despite HTTP 200');
        }
      } else {
        console.log(`❌ HTTP Error ${response.status}:`, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.log('📥 Full error response:', errorData);
        
        let errorMessage = errorData.message || 'Verification failed';
        
        // Handle specific error types
        if (response.status === 400 && errorData.status === 'review') {
          errorMessage = 'Your verification has been submitted for manual review due to service configuration issues. This is not a problem with your documents.';
          setState(prev => ({ 
            ...prev, 
            step: 'complete', 
            verificationResult: { status: 'review', message: errorMessage }
          }));
          onVerificationComplete({ status: 'review', message: errorMessage });
          
          toast({
            title: "Manual Review Required",
            description: errorMessage,
            variant: "default",
          });
          return;
        }
        
        // Handle HTTP 200 with success=false (should not reach here due to above fix)
        if (response.status === 200 && errorData.success === false) {
          console.log('⚠️ HTTP 200 with success=false - backend issues');
          errorMessage = errorData.message || errorData.reasons?.join('; ') || 'Backend processing failed';
        }
        
        // Provide more specific guidance based on the error
        if (errorMessage.includes('could not be processed') || errorMessage.includes('image quality')) {
          errorMessage = 'Document images could not be processed. Please ensure:\n• Images are clear and well-lit\n• Entire document is visible\n• No glare or shadows\n• Camera is steady when taking photos';
        }
        
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('🚨 Verification error caught:', error);
      console.error('   Error name:', error instanceof Error ? error.name : 'Unknown');
      console.error('   Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('   Error stack:', error instanceof Error ? error.stack : 'No stack');
      
      let errorMessage = 'Verification failed';
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('⏰ Request was aborted due to timeout');
          errorMessage = 'Verification timed out after 45 seconds. The verification may still be processing on our servers and could complete successfully. Please click "Check Status" below to see if it completed.';
          
          // Auto-check status after timeout (give server time to complete)
          setTimeout(() => {
            console.log('🔄 Auto-checking verification status after timeout...');
            checkVerificationStatus();
          }, 5000); // Check again in 5 seconds (faster check)
          
        } else if (error.message === 'Failed to fetch') {
          console.log('🌐 Network fetch failed - likely due to timeout or network latency');
          errorMessage = 'Network connection issue or request timed out. The verification may still be processing on our servers and could complete successfully. Please click "Check Status" below to check if it completed.';
          
          // Also auto-check for network timeouts (faster since we know backend often succeeds)
          setTimeout(() => {
            console.log('🔄 Auto-checking verification status after network error...');
            checkVerificationStatus();
          }, 3000); // Check again in 3 seconds (much faster)
          
        } else if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
          console.log('🌐 Network error detected');
          errorMessage = 'Network error occurred during verification. Please check your internet connection. The verification may still be processing - try "Check Status" in a moment.';
        } else {
          console.log('📝 Using error message:', error.message);
          errorMessage = error.message;
        }
      } else {
        console.log('❓ Non-Error object thrown:', typeof error, error);
      }
      
      setState(prev => ({ 
        ...prev, 
        step: 'failed', 
        error: errorMessage 
      }));
      onVerificationFailed(errorMessage);
      
      toast({
        title: "Verification Issue",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const dataURLtoBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const resetVerification = () => {
    setState({ step: 'upload' });
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowSelfieCapture(false);
  };

  const checkVerificationStatus = async () => {
    try {
      setLoading(true);
      console.log('🔄 Checking verification status for user', userId);
      const token = localStorage.getItem('token');

      // Use comprehensive profile (includes verification fields) and bypass cache with a timestamp
      const statusUrl = `/api/users/${userId}/profile/comprehensive?t=${Date.now()}`;
      const response = await fetch(statusUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('📥 Profile response status:', response.status);
      
      if (response.ok) {
        const userData = await response.json();
        console.log('👤 User data retrieved:', {
          isVerified: userData.isVerified,
          verificationStatus: userData.verificationStatus,
          evsVerificationConfidence: userData.evsVerificationConfidence
        });
        
        if ((userData.isVerified === true) && (userData.verificationStatus === 'approved')) {
          // Verification completed in background!
          console.log('✅ Background verification detected - updating UI');
          setState(prev => ({ 
            ...prev, 
            step: 'complete',
            verificationResult: { 
              status: 'approved', 
              confidence: userData.evsVerificationConfidence ?? 100,
              message: 'Verification completed successfully' 
            }
          }));
          onVerificationComplete({ status: 'approved' });
          
          toast({
            title: "Verification Complete!",
            description: "Your identity verification was completed successfully in the background.",
            className: "bg-green-50 border-green-200",
          });
        } else {
          console.log('⏳ Verification still in progress');
          toast({
            title: "Still Processing",
            description: "Verification is still in progress. Please wait a bit longer.",
          });
        }
      } else {
        console.log('❌ Profile fetch failed:', response.status, response.statusText);
        toast({
          title: "Status Check Failed",
          description: "Could not check verification status. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Status check error:', error);
      toast({
        title: "Unable to Check Status",
        description: "Could not check verification status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (state.step === 'processing') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-600">
            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
            Processing Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-pulse">
              <Shield className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            </div>
            <h3 className="text-lg font-medium mb-2">Verifying Your Identity</h3>
            <p className="text-gray-600 mb-4">
              Please wait while we verify your documents with EVS Solutions...
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 mb-2">
                <strong>Expected Processing Time:</strong> 30-60 seconds
              </p>
              <p className="text-sm text-blue-800 mb-2">
                Your documents are being analyzed for authenticity, data extraction, and biometric matching.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> Please do not close this window or navigate away. 
                  If verification takes longer than expected, it may still complete successfully in the background.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state.step === 'complete') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center text-green-600">
            <CheckCircle className="h-5 w-5 mr-2" />
            Verification Complete
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Identity Successfully Verified</h3>
            <p className="text-gray-600 mb-4">
              Your identity has been verified through EVS Solutions. You can now participate in signing sessions.
            </p>
            
            {state.verificationResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
                <h4 className="font-medium text-green-900 mb-2">Verification Details</h4>
                <div className="text-sm text-green-800 space-y-1">
                  <p><strong>Status:</strong> {state.verificationResult.status}</p>
                  <p><strong>Confidence Score:</strong> {state.verificationResult.confidence}%</p>
                  <p><strong>Verified At:</strong> {new Date().toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state.step === 'failed') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <XCircle className="h-5 w-5 mr-2" />
            Verification Issue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Verification Could Not Be Completed</h3>
            <p className="text-gray-600 mb-4">
              {state.error || 'Unable to verify your identity. Please try again with clearer images.'}
            </p>
            
            {/* Show different UI based on error type */}
            {(state.error?.includes('timed out') || state.error?.includes('Network connection') || state.error?.includes('Network error')) ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-blue-900 mb-2">⏰ Processing May Still Be Active</h4>
                <p className="text-sm text-blue-800 mb-3">
                  Identity verification typically takes 30-60 seconds. Your request may still be processing on our servers even though the connection timed out.
                </p>
                <div className="space-y-3">
                  <Button onClick={checkVerificationStatus} className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Check Status Now
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-blue-700">
                    Wait 10-15 seconds before checking if you just submitted
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-red-900 mb-2">Tips for Better Results</h4>
                <ul className="text-sm text-red-800 text-left space-y-1">
                  <li>• Ensure good lighting when taking photos</li>
                  <li>• Make sure your ID is clearly visible and not blurry</li>
                  <li>• Keep your face clearly visible in the selfie</li>
                  <li>• Avoid glare or shadows on your documents</li>
                </ul>
              </div>
            )}
            
            <div className="space-y-3">
              {!state.error?.includes('timed out') && !state.error?.includes('Network connection') && (
                <Button onClick={resetVerification} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
              
              {(state.error?.includes('timed out') || state.error?.includes('Network connection')) && (
                <Button onClick={resetVerification} variant="outline" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Start New Verification
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center text-blue-600">
          <Shield className="h-5 w-5 mr-2" />
          Identity Verification
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <h3 className="text-lg font-medium mb-2">Identity Verification Required</h3>
          <p className="text-gray-600 mb-4">
            Upload clear photos of your government-issued ID and take a selfie to verify your identity through EVS Solutions.
          </p>
          
          {/* Image quality requirements removed - pre-validation disabled
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Image Quality Requirements:</strong>
              <ul className="list-disc ml-6 mt-2">
                <li>Minimum size: 200KB for ID photos, 150KB for selfie</li>
                <li>Use good lighting - avoid shadows or glare</li>
                <li>Ensure entire document is visible and in focus</li>
                <li>Hold camera steady to avoid blur</li>
                <li>Supported formats: JPEG or PNG</li>
              </ul>
            </AlertDescription>
          </Alert>
          */}

          <div className="space-y-4">
            <div>
              <Label htmlFor="documentType">Document Type</Label>
              <select 
                value={state.documentType || 'drivers_license'}
                onChange={(e) => setState(prev => ({ ...prev, documentType: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="drivers_license">Driving License</option>
                <option value="passport">Passport</option>
                <option value="state_id">State ID</option>
                <option value="national_id">National ID</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select the type of document you're uploading for better recognition
              </p>
            </div>

            {/* Front of ID */}
            <div>
              <Label className="text-base font-medium flex items-center mb-3">
                <CreditCard className="h-4 w-4 mr-2" />
                Front of Government ID
              </Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {state.frontImageData ? (
                  <div className="space-y-3">
                    <img 
                      src={state.frontImageData} 
                      alt="Front of ID" 
                      className="max-h-48 mx-auto rounded border"
                    />
                    <div className="flex items-center justify-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">Front of ID uploaded</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => frontInputRef.current?.click()}
                    >
                      Replace Image
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                    <div>
                      <p className="text-gray-600">Upload front of your ID</p>
                      <p className="text-sm text-gray-500">Driving License, Passport, or State ID</p>
                    </div>
                    <Button 
                      onClick={() => frontInputRef.current?.click()}
                      className="w-full"
                    >
                      Choose File
                    </Button>
                  </div>
                )}
                <input
                  ref={frontInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload('front', e.target.files[0])}
                />
              </div>
            </div>

            {/* Back of ID (Optional) */}
            <div>
              <Label className="text-base font-medium flex items-center mb-3">
                <CreditCard className="h-4 w-4 mr-2" />
                Back of ID (Optional)
              </Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {state.backImageData ? (
                  <div className="space-y-3">
                    <img 
                      src={state.backImageData} 
                      alt="Back of ID" 
                      className="max-h-48 mx-auto rounded border"
                    />
                    <div className="flex items-center justify-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">Back of ID uploaded</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => backInputRef.current?.click()}
                    >
                      Replace Image
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                    <div>
                      <p className="text-gray-600">Upload back of your ID</p>
                      <p className="text-sm text-gray-500">Required for Driving License</p>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={() => backInputRef.current?.click()}
                      className="w-full"
                    >
                      Choose File
                    </Button>
                  </div>
                )}
                <input
                  ref={backInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload('back', e.target.files[0])}
                />
              </div>
            </div>

            {/* Selfie */}
            <div>
              <Label className="text-base font-medium flex items-center mb-3">
                <User className="h-4 w-4 mr-2" />
                Selfie Photo
              </Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {state.selfieData ? (
                  <div className="space-y-3">
                    <img 
                      src={state.selfieData} 
                      alt="Selfie" 
                      className="max-h-48 mx-auto rounded border"
                    />
                    <div className="flex items-center justify-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">Selfie captured</span>
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={startCamera}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Retake
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => selfieInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Camera className="h-12 w-12 text-gray-400 mx-auto" />
                    <div>
                      <p className="text-gray-600">Take a selfie or upload a photo</p>
                      <p className="text-sm text-gray-500">Make sure your face is clearly visible</p>
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        onClick={startCamera}
                        className="flex-1"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Take Photo
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => selfieInputRef.current?.click()}
                        className="flex-1"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                    </div>
                  </div>
                )}
                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleSelfieUpload(e.target.files[0])}
                />
              </div>
            </div>

            {/* Camera Capture Modal */}
            {showSelfieCapture && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                  <h3 className="text-lg font-medium mb-4">Take Your Selfie</h3>
                  <div className="space-y-4">
                    <video 
                      ref={videoRef}
                      autoPlay 
                      playsInline
                      className="w-full rounded border"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex space-x-2">
                      <Button onClick={capturePhoto} className="flex-1">
                        <Camera className="h-4 w-4 mr-2" />
                        Capture
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          if (cameraStream) {
                            cameraStream.getTracks().forEach(track => track.stop());
                            setCameraStream(null);
                          }
                          setShowSelfieCapture(false);
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4">
              <Button 
                onClick={submitVerification}
                disabled={!state.frontImageData || !state.selfieData || loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Submit for Verification
                  </>
                )}
              </Button>
              
              {(!state.frontImageData || !state.selfieData) && (
                <p className="text-sm text-gray-500 text-center mt-2">
                  Please upload front of ID and take a selfie to continue
                </p>
              )}
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-1">Privacy & Security</p>
                  <p>Your documents are processed securely through EVS Solutions and are only used for identity verification. Images are encrypted and stored according to industry standards.</p>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-2">📸 Photo Tips for Better Results</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-semibold mb-1">Document Photos:</p>
                      <ul className="space-y-1">
                        <li>• Use bright, even lighting - no shadows</li>
                        <li>• Document completely flat and in frame</li>
                        <li>• Text must be sharp and readable</li>
                        <li>• No glare or reflections</li>
                        <li>• JPEG or PNG format</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Selfie Photo:</p>
                      <ul className="space-y-1">
                        <li>• Face clearly visible and well-lit</li>
                        <li>• Look directly at camera</li>
                        <li>• Remove glasses if possible</li>
                        <li>• Plain background preferred</li>
                        <li>• Natural expression</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-2 p-2 bg-amber-100 border border-amber-300 rounded text-xs">
                    <strong>Note:</strong> All images will be sent to EVS for verification. Poor quality photos may still be rejected by the verification service.
                  </div>
                </div>
              </div>
            </div>

            {state.documentType === 'national_id' ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-2">🌍 International Document Notice</p>
                    <p className="mb-2">
                      You've selected an international document. Our system will process this as a passport-type document for better recognition.
                    </p>
                    <ul className="space-y-1 text-xs">
                      <li>• Ensure all text is in English or has English translation visible</li>
                      <li>• Document must have photo and personal details clearly visible</li>
                      <li>• International documents may take longer to process</li>
                      <li>• If verification fails, you may need manual admin approval</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 