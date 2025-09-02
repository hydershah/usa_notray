import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, User, CheckCircle, Clock, XCircle, AlertCircle, Brain, RefreshCw 
} from 'lucide-react';

interface KBAQuestion {
  id: string;
  questionId: number;
  questionText: string;
  questionType: 'multiple_choice' | 'true_false' | 'numeric';
  answers: string[];
  category: 'address' | 'financial' | 'personal' | 'vehicle' | 'employment';
}

interface KBAVerificationProps {
  userId: string;
  userInfo: {
    firstName: string;
    lastName: string;
    dateOfBirth: string; // YYYY-MM-DD
    ssn?: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
    phone?: string;
    email?: string;
  };
  onVerificationComplete: (result: any) => void;
  onVerificationFailed: (error: string) => void;
  requireKBA?: boolean;
  className?: string;
}

export function KBAVerification({
  userId,
  userInfo,
  onVerificationComplete,
  onVerificationFailed,
  requireKBA = true,
  className = ""
}: KBAVerificationProps) {
  const [currentStep, setCurrentStep] = useState<'intro' | 'questions' | 'submitting' | 'complete' | 'failed'>('intro');
  const [questions, setQuestions] = useState<KBAQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, { answer: string; index: number }>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(600); // 10 minutes in seconds
  const [provider, setProvider] = useState<string>('evs');
  
  const { toast } = useToast();

  // Step progress mapping
  const stepProgress = {
    intro: 10,
    questions: 50,
    submitting: 85,
    complete: 100,
    failed: 0
  };

  useEffect(() => {
    setProgress(stepProgress[currentStep]);
  }, [currentStep]);

  // Countdown timer for session expiration
  useEffect(() => {
    if (currentStep === 'questions' && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleSessionTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentStep, timeRemaining]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSessionTimeout = () => {
    setError('Your KBA session has expired. Please try again.');
    setCurrentStep('failed');
    onVerificationFailed('KBA session expired');
  };

  const initializeKBA = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🧠 Initializing KBA session...');

      const token = localStorage.getItem('token');
      const response = await fetch('/api/kba/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId,
          firstName: userInfo.firstName,
          lastName: userInfo.lastName,
          dateOfBirth: userInfo.dateOfBirth,
          ssn: userInfo.ssn,
          address: userInfo.address,
          phone: userInfo.phone,
          email: userInfo.email
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'KBA initialization failed');
      }

      if (!result.success) {
        throw new Error(result.message || 'KBA initialization failed');
      }

      setSessionId(result.sessionId);
      setQuestions(result.questions || []);
      setProvider(result.provider || 'evs');
      setCurrentStep('questions');
      setTimeRemaining(600); // Reset timer

      toast({
        title: "KBA Session Started",
        description: `${result.questions?.length || 0} questions loaded successfully`,
      });

    } catch (error) {
      console.error('KBA initialization error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      setCurrentStep('failed');
      onVerificationFailed(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (questionId: number, answer: string, answerIndex: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { answer, index: answerIndex }
    }));
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const submitKBAAnswers = async () => {
    setIsLoading(true);
    setCurrentStep('submitting');
    setError(null);

    try {
      // Validate all questions are answered
      const unansweredQuestions = questions.filter(q => !answers[q.questionId]);
      if (unansweredQuestions.length > 0) {
        throw new Error(`Please answer all questions. ${unansweredQuestions.length} questions remaining.`);
      }

      // Format answers for submission
      const formattedAnswers = questions.map(question => ({
        questionId: question.questionId,
        selectedAnswer: answers[question.questionId].answer,
        selectedAnswerIndex: answers[question.questionId].index
      }));

      console.log('📝 Submitting KBA answers...');

      const token = localStorage.getItem('token');
      const response = await fetch('/api/kba/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          userId,
          answers: formattedAnswers
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'KBA submission failed');
      }

      setVerificationResult(result);

      if (result.status === 'passed') {
        setCurrentStep('complete');
        toast({
          title: "KBA Verification Passed",
          description: `You scored ${result.score}% - verification successful!`,
        });
        onVerificationComplete(result);
      } else {
        setCurrentStep('failed');
        const errorMessage = `KBA verification failed with score ${result.score}% (required: ${result.passingScore}%)`;
        setError(errorMessage);
        onVerificationFailed(errorMessage);
      }

    } catch (error) {
      console.error('KBA submission error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      setCurrentStep('failed');
      onVerificationFailed(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const renderIntroStep = () => (
    <div className="space-y-6 text-center">
      <div className="p-6 bg-blue-50 rounded-lg">
        <Brain className="w-16 h-16 mx-auto text-blue-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Knowledge-Based Authentication</h3>
        <p className="text-gray-600">
          We need to verify your identity by asking you questions based on your public records. 
          This is an additional security measure required for notary services.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border rounded-lg">
          <User className="w-8 h-8 mx-auto text-blue-600 mb-2" />
          <h4 className="font-medium">Personal History</h4>
          <p className="text-sm text-gray-600">Questions about your addresses and personal information</p>
        </div>
        <div className="p-4 border rounded-lg">
          <Shield className="w-8 h-8 mx-auto text-blue-600 mb-2" />
          <h4 className="font-medium">Secure & Private</h4>
          <p className="text-sm text-gray-600">Information is encrypted and only used for verification</p>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You'll have 10 minutes to complete {provider === 'lexisnexis' ? '3-5' : '4'} questions. 
          A score of 75% or higher is required to pass.
        </AlertDescription>
      </Alert>

      <Button 
        onClick={initializeKBA} 
        disabled={isLoading}
        className="px-8 py-3"
      >
        {isLoading ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Loading Questions...
          </>
        ) : (
          'Start KBA Verification'
        )}
      </Button>
    </div>
  );

  const renderQuestionsStep = () => {
    const currentQuestion = questions[currentQuestionIndex];
    
    if (!currentQuestion) {
      return (
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
          <p>No questions available. Please try again.</p>
        </div>
      );
    }

    const allQuestionsAnswered = questions.every(q => answers[q.questionId]);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Badge variant="outline">
            Question {currentQuestionIndex + 1} of {questions.length}
          </Badge>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span className={timeRemaining < 60 ? 'text-red-600 font-medium' : ''}>
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="mb-4">
              <Badge className="mb-3" variant="secondary">
                {currentQuestion.category.charAt(0).toUpperCase() + currentQuestion.category.slice(1)}
              </Badge>
              <h4 className="font-medium text-lg mb-4">
                {currentQuestion.questionText}
              </h4>
            </div>
            
            <div className="space-y-3">
              {currentQuestion.answers.map((answer: string, index: number) => (
                <label 
                  key={index} 
                  className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    answers[currentQuestion.questionId]?.index === index 
                      ? 'bg-blue-50 border-blue-300' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`kba_${currentQuestion.questionId}`}
                    value={answer}
                    checked={answers[currentQuestion.questionId]?.index === index}
                    onChange={() => handleAnswerSelect(currentQuestion.questionId, answer, index)}
                    className="text-blue-600"
                  />
                  <span className="flex-1">{answer}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button 
            variant="outline"
            onClick={goToPreviousQuestion}
            disabled={currentQuestionIndex === 0}
          >
            Previous
          </Button>
          
          <div className="flex gap-2">
            {currentQuestionIndex < questions.length - 1 ? (
              <Button 
                onClick={goToNextQuestion}
                disabled={!answers[currentQuestion.questionId]}
              >
                Next Question
              </Button>
            ) : (
              <Button 
                onClick={submitKBAAnswers}
                disabled={!allQuestionsAnswered || isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? 'Submitting...' : 'Submit Answers'}
              </Button>
            )}
          </div>
        </div>

        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Questions Answered</span>
            <span>{Object.keys(answers).length}/{questions.length}</span>
          </div>
          <Progress 
            value={(Object.keys(answers).length / questions.length) * 100} 
            className="h-2" 
          />
        </div>
      </div>
    );
  };

  const renderSubmittingStep = () => (
    <div className="space-y-6 text-center">
      <div className="p-6">
        <RefreshCw className="w-16 h-16 mx-auto text-blue-600 mb-4 animate-spin" />
        <h3 className="text-xl font-semibold mb-2">Processing Your Answers</h3>
        <p className="text-gray-600">
          Please wait while we verify your responses...
        </p>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6 text-center">
      <div className="p-6 bg-green-50 rounded-lg">
        <CheckCircle className="w-16 h-16 mx-auto text-blue-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2 text-green-800">KBA Verification Passed!</h3>
        <p className="text-green-700">
          You successfully passed the knowledge-based authentication with a score of {verificationResult?.score}%
        </p>
      </div>

      {verificationResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4" />
                Verification Results
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Score:</span>
                  <Badge className="bg-green-100 text-green-800">
                    {verificationResult.score}%
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Questions Answered:</span>
                  <span className="text-sm font-medium">
                    {verificationResult.questionsAnswered}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Correct Answers:</span>
                  <span className="text-sm font-medium">
                    {verificationResult.correctAnswers}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4" />
                Verification Level
              </h4>
              <div className="space-y-2">
                <Badge 
                  className={
                    verificationResult.verificationLevel === 'premium' 
                      ? 'bg-purple-100 text-purple-800'
                      : verificationResult.verificationLevel === 'enhanced'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }
                >
                  {verificationResult.verificationLevel?.toUpperCase()}
                </Badge>
                <p className="text-xs text-gray-500">
                  Provider: {provider.toUpperCase()}
                </p>
                <p className="text-xs text-gray-500">
                  Session: {sessionId.substring(0, 8)}...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Your identity has been successfully verified. You can now proceed with the notary session.
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderFailedStep = () => (
    <div className="space-y-6 text-center">
      <div className="p-6 bg-red-50 rounded-lg">
        <XCircle className="w-16 h-16 mx-auto text-red-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2 text-red-800">KBA Verification Failed</h3>
        <p className="text-red-700">
          {error || 'The knowledge-based authentication did not meet the required threshold.'}
        </p>
      </div>

      {verificationResult && (
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4" />
                Results Summary
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Your Score:</span>
                  <Badge variant="destructive">
                    {verificationResult.score}%
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Required Score:</span>
                  <span className="font-medium">{verificationResult.passingScore}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Questions Answered:</span>
                  <span className="font-medium">
                    {verificationResult.correctAnswers}/{verificationResult.questionsAnswered}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You may retry the verification process or contact support for assistance.
        </AlertDescription>
      </Alert>

      <Button 
        onClick={() => {
          setCurrentStep('intro');
          setAnswers({});
          setCurrentQuestionIndex(0);
          setError(null);
          setVerificationResult(null);
        }}
        variant="outline"
        className="px-8"
      >
        Try Again
      </Button>
    </div>
  );

  if (!requireKBA) {
    return null;
  }

  return (
    <Card className={`w-full max-w-4xl mx-auto ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Knowledge-Based Authentication
            </CardTitle>
            <p className="text-sm text-gray-600">
              Additional identity verification through personal history questions
            </p>
          </div>
          {provider && (
            <Badge variant="outline">
              {provider.toUpperCase()}
            </Badge>
          )}
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
        {error && currentStep !== 'failed' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {currentStep === 'intro' && renderIntroStep()}
        {currentStep === 'questions' && renderQuestionsStep()}
        {currentStep === 'submitting' && renderSubmittingStep()}
        {currentStep === 'complete' && renderCompleteStep()}
        {currentStep === 'failed' && renderFailedStep()}
      </CardContent>
    </Card>
  );
} 