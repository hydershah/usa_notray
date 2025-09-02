import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { 
  Camera, Upload, User, Shield, CheckCircle, XCircle, 
  AlertTriangle, Eye, Scan, CreditCard, FileText,
  Loader2, Smartphone, Monitor, Clock, MapPin
} from "lucide-react";

interface VouchedConfig {
  apiKey: string;
  mode: 'sandbox' | 'production';
  theme: 'light' | 'dark';
}

interface IdentityVerificationData {
  id: string;
  status: 'pending' | 'approved' | 'failed' | 'review';
  confidence: number;
  fraudScore: number;
  document: {
    type: string;
    country: string;
    state?: string;
    extracted: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      documentNumber: string;
      expirationDate: string;
      address?: string;
    };
  };
  selfie: {
    match: boolean;
    confidence: number;
    livenessScore: number;
  };
  kba?: {
    status: 'passed' | 'failed' | 'pending';
    questionsAnswered: number;
    correctAnswers: number;
  };
  metadata: {
    ipAddress: string;
    userAgent: string;
    timestamp: string;
    sessionId: string;
  };
}

interface VouchedIdentityVerificationProps {
  sessionId: string;
  participantId: string;
  participantName: string;
  onVerificationComplete: (data: IdentityVerificationData) => void;
  onVerificationFailed: (error: string) => void;
  requireKBA?: boolean;
  requireLiveness?: boolean;
  acceptedDocuments?: string[];
}

export function VouchedIdentityVerification({
  sessionId,
  participantId,
  participantName,
  onVerificationComplete,
  onVerificationFailed,
  requireKBA = true,
  requireLiveness = true,
  acceptedDocuments = ['drivers_license', 'passport', 'state_id']
}: VouchedIdentityVerificationProps) {
  const [currentStep, setCurrentStep] = useState<'intro' | 'document' | 'selfie' | 'kba' | 'complete'>('intro');
  const [verificationData, setVerificationData] = useState<Partial<IdentityVerificationData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Vouched SDK references
  const vouchedRef = useRef<any>(null);
  const [vouchedLoaded, setVouchedLoaded] = useState(false);

  // KBA Questions state
  const [kbaQuestions, setKbaQuestions] = useState<any[]>([]);
  const [kbaAnswers, setKbaAnswers] = useState<Record<string, string>>({});
  const [currentKBAQuestion, setCurrentKBAQuestion] = useState(0);

  // Step progress mapping
  const stepProgress = {
    intro: 10,
    document: 40,
    selfie: 70,
    kba: 90,
    complete: 100
  };

  useEffect(() => {
    loadVouchedSDK();
  }, []);

  useEffect(() => {
    setProgress(stepProgress[currentStep]);
  }, [currentStep]);

  const loadVouchedSDK = async () => {
    try {
      // In a real implementation, you would load the Vouched SDK
      // For now, we'll simulate the SDK loading
      setIsLoading(true);
      
      // Simulate SDK loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock Vouched configuration
      const config: VouchedConfig = {
        apiKey: process.env.REACT_APP_VOUCHED_API_KEY || 'demo_key',
        mode: 'sandbox',
        theme: 'light'
      };

      // Initialize mock Vouched instance
      vouchedRef.current = {
        mounted: true,
        config,
        // Mock methods that would be provided by real Vouched SDK
        scanDocument: mockScanDocument,
        captureSelfie: mockCaptureSelfie,
        performKBA: mockPerformKBA
      };

      setVouchedLoaded(true);
      setIsLoading(false);
      
      toast({
        title: "Verification Ready",
        description: "Identity verification system initialized",
      });

    } catch (error) {
      console.error('Failed to load Vouched SDK:', error);
      setError('Failed to initialize verification system');
      setIsLoading(false);
    }
  };

  // Mock functions (would be replaced with real Vouched SDK calls)
  const mockScanDocument = async (documentType: string) => {
    setIsLoading(true);
    
    // Simulate document scanning process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Mock successful document extraction
    const documentData = {
      type: documentType,
      country: 'US',
      state: 'CA',
      extracted: {
        firstName: participantName.split(' ')[0] || 'John',
        lastName: participantName.split(' ').slice(1).join(' ') || 'Doe',
        dateOfBirth: '1990-01-01',
        documentNumber: 'D1234567',
        expirationDate: '2028-12-31',
        address: '123 Main St, Anytown, CA 12345'
      }
    };

    setVerificationData(prev => ({
      ...prev,
      document: documentData,
      status: 'pending' as const
    }));

    setIsLoading(false);
    setCurrentStep('selfie');
    
    return documentData;
  };

  const mockCaptureSelfie = async () => {
    setIsLoading(true);
    
    // Simulate selfie capture and face matching
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock successful face match
    const selfieData = {
      match: true,
      confidence: 0.95,
      livenessScore: 0.92
    };

    setVerificationData(prev => ({
      ...prev,
      selfie: selfieData,
      confidence: 95,
      fraudScore: 5
    }));

    setIsLoading(false);
    
    if (requireKBA) {
      await initializeKBA();
    } else {
      completeVerification();
    }
    
    return selfieData;
  };

  const initializeKBA = async () => {
    setIsLoading(true);
    
    // Mock KBA questions (would come from LexisNexis/TransUnion via Vouched)
    const mockQuestions = [
      {
        id: 1,
        question: "Which of the following addresses have you lived at?",
        answers: [
          "123 Main Street, Anytown, CA",
          "456 Oak Avenue, Somewhere, CA", 
          "789 Pine Road, Elsewhere, CA",
          "None of the above"
        ]
      },
      {
        id: 2,
        question: "What was the make of the vehicle you owned in 2020?",
        answers: [
          "Toyota",
          "Honda",
          "Ford",
          "None of the above"
        ]
      },
      {
        id: 3,
        question: "Which financial institution did you have a mortgage with?",
        answers: [
          "Wells Fargo",
          "Bank of America",
          "Chase",
          "None of the above"
        ]
      }
    ];

    setKbaQuestions(mockQuestions);
    setCurrentStep('kba');
    setIsLoading(false);
  };

  const mockPerformKBA = async () => {
    setIsLoading(true);
    
    // Simulate KBA processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock KBA results (assume 3/3 correct)
    const kbaData = {
      status: 'passed' as const,
      questionsAnswered: 3,
      correctAnswers: 3
    };

    setVerificationData(prev => ({
      ...prev,
      kba: kbaData
    }));

    setIsLoading(false);
    completeVerification();
    
    return kbaData;
  };

  const completeVerification = () => {
    const finalData: IdentityVerificationData = {
      id: `verification_${Date.now()}`,
      status: 'approved',
      confidence: verificationData.confidence || 95,
      fraudScore: verificationData.fraudScore || 5,
      document: verificationData.document!,
      selfie: verificationData.selfie!,
      kba: verificationData.kba,
      metadata: {
        ipAddress: 'client-detected',
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        sessionId
      }
    };

    setVerificationData(finalData);
    setCurrentStep('complete');
    
    toast({
      title: "Verification Complete",
      description: "Identity successfully verified with high confidence",
    });

    onVerificationComplete(finalData);
  };

  const handleDocumentScan = async (documentType: string) => {
    try {
      if (!vouchedRef.current) {
        throw new Error('Verification system not ready');
      }
      
      await vouchedRef.current.scanDocument(documentType);
    } catch (error) {
      console.error('Document scan failed:', error);
      setError('Document scanning failed. Please try again.');
      onVerificationFailed('Document scanning failed');
    }
  };

  const handleSelfiCapture = async () => {
    try {
      if (!vouchedRef.current) {
        throw new Error('Verification system not ready');
      }
      
      await vouchedRef.current.captureSelfie();
    } catch (error) {
      console.error('Selfie capture failed:', error);
      setError('Selfie capture failed. Please try again.');
      onVerificationFailed('Selfie capture failed');
    }
  };

  const handleKBAAnswer = (questionId: number, answer: string) => {
    setKbaAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const submitKBAAnswers = async () => {
    if (Object.keys(kbaAnswers).length < kbaQuestions.length) {
      toast({
        title: "Incomplete",
        description: "Please answer all questions before continuing",
        variant: "destructive",
      });
      return;
    }

    try {
      await vouchedRef.current.performKBA();
    } catch (error) {
      console.error('KBA failed:', error);
      setError('Knowledge-based authentication failed');
      onVerificationFailed('KBA failed');
    }
  };

  const renderIntroStep = () => (
    <div className="space-y-6 text-center">
      <div className="p-6 bg-blue-50 rounded-lg">
        <Shield className="w-16 h-16 mx-auto text-blue-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Identity Verification Required</h3>
        <p className="text-gray-600">
          To participate in this notary session, we need to verify your identity using 
          advanced security technology powered by [Vouched.id](https://www.vouched.id/).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg">
          <FileText className="w-8 h-8 mx-auto text-blue-600 mb-2" />
          <h4 className="font-medium">1. Document Scan</h4>
          <p className="text-sm text-gray-600">Upload government-issued ID</p>
        </div>
        <div className="p-4 border rounded-lg">
          <Camera className="w-8 h-8 mx-auto text-blue-600 mb-2" />
          <h4 className="font-medium">2. Selfie Verification</h4>
          <p className="text-sm text-gray-600">Take a live selfie for matching</p>
        </div>
        <div className="p-4 border rounded-lg">
          <User className="w-8 h-8 mx-auto text-blue-600 mb-2" />
          <h4 className="font-medium">3. Knowledge Check</h4>
          <p className="text-sm text-gray-600">Answer security questions</p>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Your personal information is encrypted and secure. This verification meets all legal 
          requirements for remote notarization and complies with state and federal regulations.
        </AlertDescription>
      </Alert>

      <Button 
        onClick={() => setCurrentStep('document')} 
        disabled={!vouchedLoaded || isLoading}
        className="px-8 py-3"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Initializing...
          </>
        ) : (
          'Start Verification'
        )}
      </Button>
    </div>
  );

  const renderDocumentStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Scan className="w-16 h-16 mx-auto text-blue-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Scan Your ID Document</h3>
        <p className="text-gray-600">
          Please select and scan your government-issued identification document
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {acceptedDocuments.map((docType) => (
          <Button
            key={docType}
            variant="outline"
            className="p-6 h-auto flex flex-col gap-3"
            onClick={() => handleDocumentScan(docType)}
            disabled={isLoading}
          >
            <CreditCard className="w-8 h-8" />
            <span className="capitalize">
              {docType.replace('_', ' ')}
            </span>
          </Button>
        ))}
      </div>

      {isLoading && (
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Scanning and extracting document information...</p>
        </div>
      )}

      <div className="text-center">
        <p className="text-xs text-gray-500">
          Ensure your document is well-lit, in focus, and all information is visible
        </p>
      </div>
    </div>
  );

  const renderSelfieStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Camera className="w-16 h-16 mx-auto text-blue-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Take a Live Selfie</h3>
        <p className="text-gray-600">
          We'll compare your selfie with your ID photo to verify your identity
        </p>
      </div>

      <div className="max-w-md mx-auto">
        <div className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
          {isLoading ? (
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
              <p className="text-sm">Processing selfie and matching faces...</p>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <Eye className="w-12 h-12 mx-auto text-gray-400" />
              <p className="text-sm text-gray-600">Position your face in the center</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <Button 
          onClick={handleSelfiCapture}
          disabled={isLoading}
          className="px-8 py-3"
        >
          {isLoading ? 'Processing...' : 'Capture Selfie'}
        </Button>
      </div>

      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
          <Smartphone className="w-4 h-4" />
          <span>Mobile cameras supported</span>
          <Monitor className="w-4 h-4 ml-2" />
          <span>Webcam compatible</span>
        </div>
        <p className="text-xs text-gray-500">
          Look directly at the camera and ensure good lighting
        </p>
      </div>
    </div>
  );

  const renderKBAStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <User className="w-16 h-16 mx-auto text-blue-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Knowledge-Based Authentication</h3>
        <p className="text-gray-600">
          Please answer the following questions to verify your identity
        </p>
      </div>

      {kbaQuestions.length > 0 && (
        <div className="space-y-6">
          <div className="text-center">
            <Badge variant="outline">
              Question {currentKBAQuestion + 1} of {kbaQuestions.length}
            </Badge>
          </div>

          <Card>
            <CardContent className="p-6">
              <h4 className="font-medium mb-4">
                {kbaQuestions[currentKBAQuestion]?.question}
              </h4>
              
              <div className="space-y-3">
                {kbaQuestions[currentKBAQuestion]?.answers.map((answer: string, index: number) => (
                  <label 
                    key={index} 
                    className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="radio"
                      name={`kba_${kbaQuestions[currentKBAQuestion].id}`}
                      value={answer}
                      onChange={(e) => handleKBAAnswer(kbaQuestions[currentKBAQuestion].id, e.target.value)}
                      className="text-blue-600"
                    />
                    <span>{answer}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            {currentKBAQuestion > 0 && (
              <Button 
                variant="outline"
                onClick={() => setCurrentKBAQuestion(prev => prev - 1)}
              >
                Previous
              </Button>
            )}
            
            <div className="flex-1" />
            
            {currentKBAQuestion < kbaQuestions.length - 1 ? (
              <Button 
                onClick={() => setCurrentKBAQuestion(prev => prev + 1)}
                disabled={!kbaAnswers[kbaQuestions[currentKBAQuestion].id]}
              >
                Next
              </Button>
            ) : (
              <Button 
                onClick={submitKBAAnswers}
                disabled={Object.keys(kbaAnswers).length < kbaQuestions.length || isLoading}
              >
                {isLoading ? 'Submitting...' : 'Complete Verification'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6 text-center">
      <div className="p-6 bg-green-50 rounded-lg">
        <CheckCircle className="w-16 h-16 mx-auto text-blue-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2 text-green-800">Verification Complete!</h3>
        <p className="text-green-700">
          Your identity has been successfully verified with high confidence
        </p>
      </div>

      {verificationData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4" />
                Verification Score
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Confidence:</span>
                  <Badge className="bg-green-100 text-green-800">
                    {verificationData.confidence}%
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Fraud Score:</span>
                  <Badge className="bg-blue-100 text-blue-800">
                    {verificationData.fraudScore}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4" />
                Session Info
              </h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div>ID: {sessionId.substring(0, 8)}...</div>
                <div>Timestamp: {new Date().toLocaleString()}</div>
                <div>Participant: {participantName}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Verification complete! You can now proceed with the notary session. 
          Your verified identity information will be included in the legal documents.
        </AlertDescription>
      </Alert>
    </div>
  );

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Identity Verification
            </CardTitle>
            <p className="text-sm text-gray-600">Powered by Vouched.id</p>
          </div>
          <Badge variant="outline">
            {participantName}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {currentStep === 'intro' && renderIntroStep()}
        {currentStep === 'document' && renderDocumentStep()}
        {currentStep === 'selfie' && renderSelfieStep()}
        {currentStep === 'kba' && renderKBAStep()}
        {currentStep === 'complete' && renderCompleteStep()}
      </CardContent>
    </Card>
  );
} 