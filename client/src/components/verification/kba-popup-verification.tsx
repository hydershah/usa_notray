import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Brain, Clock, Shield, XCircle, CheckCircle, AlertCircle, Lock } from 'lucide-react';

interface EVSKBAQuestion {
  text: string;
  questionType: number;
  answers: Array<{
    text: string;
    isCorrect: boolean;
  }>;
}

interface KBAPopupProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  jobId: string;
  onVerificationComplete: (result: any) => void;
  onVerificationFailed: (reason: string) => void;
  evsQuestions?: EVSKBAQuestion[]; // Questions from EVS ID verification
}

interface KBAStatus {
  verified: boolean;
  locked: boolean;
  attemptsRemaining: number;
  lockedUntil?: string;
  lastAttempt?: string;
}

interface KBAResult {
  success: boolean;
  status: 'passed' | 'failed' | 'locked' | 'expired';
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  attemptsRemaining: number;
  lockedUntil?: string;
  canRetry: boolean;
}

export function KBAPopupVerification({
  isOpen,
  onClose,
  userId,
  jobId,
  onVerificationComplete,
  onVerificationFailed,
  evsQuestions = []
}: KBAPopupProps) {
  const [currentStep, setCurrentStep] = useState<'status' | 'questions' | 'submitting' | 'result'>('status');
  const [questions, setQuestions] = useState<EVSKBAQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(600); // 10 minutes
  const [kbaStatus, setKbaStatus] = useState<KBAStatus | null>(null);
  const [kbaResult, setKbaResult] = useState<KBAResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Check KBA status when popup opens
  useEffect(() => {
    if (isOpen) {
      checkKBAStatus();
    }
  }, [isOpen, userId]);

  // Countdown timer
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

  const checkKBAStatus = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/kba/status/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const status = await response.json();
        setKbaStatus(status);

        if (status.verified) {
          // User already passed KBA
          onVerificationComplete({ status: 'already_verified' });
          onClose();
        } else if (status.locked) {
          setCurrentStep('result');
          setKbaResult({
            success: false,
            status: 'locked',
            score: 0,
            correctAnswers: 0,
            totalQuestions: 5,
            attemptsRemaining: 0,
            lockedUntil: status.lockedUntil,
            canRetry: false
          });
        } else {
          // Can proceed with KBA
          initializeKBASession();
        }
      }
    } catch (error) {
      console.error('Error checking KBA status:', error);
      setError('Failed to check KBA status');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeKBASession = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Use EVS questions if available, otherwise fetch new ones
      let questionsToUse = evsQuestions;
      
      if (!questionsToUse || questionsToUse.length === 0) {
        // Fetch questions from KBA service
        const token = localStorage.getItem('token');
        const response = await fetch('/api/kba/initialize-popup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            userId,
            jobId,
            useStoredQuestions: true
          })
        });

        if (!response.ok) {
          throw new Error('Failed to initialize KBA session');
        }

        const result = await response.json();
        questionsToUse = result.questions;
        setSessionId(result.sessionId);
      } else {
        // Use EVS questions directly
        setSessionId(`evs_kba_${Date.now()}_${userId}`);
      }

      // Select 5 random questions
      const selectedQuestions = selectRandomQuestions(questionsToUse, 5);
      setQuestions(selectedQuestions);
      setCurrentStep('questions');
      setTimeRemaining(600); // Reset timer

      toast({
        title: "KBA Session Started",
        description: "You have 10 minutes to answer 5 questions. You need 80% (4/5) to pass.",
      });

    } catch (error) {
      console.error('KBA initialization error:', error);
      setError('Failed to start KBA verification');
      setCurrentStep('result');
    } finally {
      setIsLoading(false);
    }
  };

  const selectRandomQuestions = (allQuestions: EVSKBAQuestion[], count: number): EVSKBAQuestion[] => {
    if (allQuestions.length <= count) {
      return allQuestions;
    }
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  };

  const handleAnswerSelect = (questionIndex: number, answerIndex: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: answerIndex
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

  const handleSessionTimeout = () => {
    setError('Your KBA session has expired. Please try again.');
    setCurrentStep('result');
    setKbaResult({
      success: false,
      status: 'expired',
      score: 0,
      correctAnswers: 0,
      totalQuestions: questions.length,
      attemptsRemaining: kbaStatus?.attemptsRemaining || 0,
      canRetry: (kbaStatus?.attemptsRemaining || 0) > 0
    });
  };

  const submitKBAAnswers = async () => {
    // Validate all questions are answered
    const unansweredQuestions = questions.filter((_, index) => answers[index] === undefined);
    if (unansweredQuestions.length > 0) {
      toast({
        title: "Incomplete",
        description: `Please answer all questions. ${unansweredQuestions.length} questions remaining.`,
        variant: "destructive",
      });
      return;
    }

    setCurrentStep('submitting');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/kba/submit-popup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId,
          jobId,
          sessionId,
          questions,
          answers: Object.entries(answers).map(([questionIndex, answerIndex]) => ({
            questionIndex: parseInt(questionIndex),
            selectedAnswerIndex: answerIndex
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit KBA answers');
      }

      const result = await response.json();
      setKbaResult(result);
      setCurrentStep('result');

      if (result.success) {
        toast({
          title: "KBA Passed!",
          description: `You scored ${result.score}% - verification successful!`,
        });
        onVerificationComplete(result);
      } else {
        toast({
          title: "KBA Failed",
          description: result.status === 'locked' 
            ? "Too many failed attempts. You are locked out for 24 hours."
            : `You scored ${result.score}%. You need 80% to pass.`,
          variant: "destructive",
        });
        onVerificationFailed(result.status);
      }

    } catch (error) {
      console.error('KBA submission error:', error);
      setError('Failed to submit KBA answers');
      setCurrentStep('result');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStatusStep = () => (
    <div className="space-y-6 text-center">
      <div className="p-6 bg-blue-50 rounded-lg">
        <Brain className="w-16 h-16 mx-auto text-blue-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">KBA Verification Required</h3>
        <p className="text-gray-600">
          This job requires Knowledge-Based Authentication. You'll answer 5 questions based on your personal history.
        </p>
      </div>

      {kbaStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Attempts Remaining</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kbaStatus.attemptsRemaining}/2</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Passing Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">80%</div>
              <p className="text-sm text-gray-500">4 out of 5 correct</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You have 10 minutes to complete 5 questions. After 2 failed attempts, you'll be locked out for 24 hours.
        </AlertDescription>
      </Alert>

      <Button 
        onClick={initializeKBASession} 
        disabled={isLoading}
        className="px-8 py-3"
      >
        {isLoading ? 'Loading...' : 'Start KBA Verification'}
      </Button>
    </div>
  );

  const renderQuestionsStep = () => {
    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Badge variant="outline">
            Question {currentQuestionIndex + 1} of {questions.length}
          </Badge>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>{formatTime(timeRemaining)}</span>
          </div>
        </div>

        <Progress value={progress} className="h-2" />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{currentQuestion?.text}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentQuestion?.answers.map((answer, index) => (
              <label
                key={index}
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                  answers[currentQuestionIndex] === index
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name={`question_${currentQuestionIndex}`}
                  value={index}
                  checked={answers[currentQuestionIndex] === index}
                  onChange={() => handleAnswerSelect(currentQuestionIndex, index)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                  answers[currentQuestionIndex] === index
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}>
                  {answers[currentQuestionIndex] === index && (
                    <div className="w-full h-full rounded-full bg-white scale-50"></div>
                  )}
                </div>
                <span>{answer.text}</span>
              </label>
            ))}
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
          
          {currentQuestionIndex === questions.length - 1 ? (
            <Button
              onClick={submitKBAAnswers}
              disabled={Object.keys(answers).length < questions.length}
              className="px-8"
            >
              Submit Answers
            </Button>
          ) : (
            <Button
              onClick={goToNextQuestion}
              disabled={answers[currentQuestionIndex] === undefined}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderSubmittingStep = () => (
    <div className="text-center space-y-4">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
      <p>Processing your answers...</p>
    </div>
  );

  const renderResultStep = () => {
    if (!kbaResult) return null;

    const isLocked = kbaResult.status === 'locked';
    const isPassed = kbaResult.success;
    const isExpired = kbaResult.status === 'expired';

    return (
      <div className="text-center space-y-6">
        {isPassed ? (
          <div className="p-6 bg-green-50 rounded-lg">
            <CheckCircle className="w-16 h-16 mx-auto text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold text-green-800 mb-2">KBA Verification Passed!</h3>
            <p className="text-green-700">
              You scored {kbaResult.score}% ({kbaResult.correctAnswers}/{kbaResult.totalQuestions} correct)
            </p>
          </div>
        ) : isLocked ? (
          <div className="p-6 bg-red-50 rounded-lg">
            <Lock className="w-16 h-16 mx-auto text-red-600 mb-4" />
            <h3 className="text-xl font-semibold text-red-800 mb-2">Account Locked</h3>
            <p className="text-red-700">
              Too many failed attempts. You are locked out until{' '}
              {kbaResult.lockedUntil && new Date(kbaResult.lockedUntil).toLocaleString()}
            </p>
          </div>
        ) : isExpired ? (
          <div className="p-6 bg-orange-50 rounded-lg">
            <Clock className="w-16 h-16 mx-auto text-orange-600 mb-4" />
            <h3 className="text-xl font-semibold text-orange-800 mb-2">Session Expired</h3>
            <p className="text-orange-700">
              Your KBA session expired. You have {kbaResult.attemptsRemaining} attempts remaining.
            </p>
          </div>
        ) : (
          <div className="p-6 bg-red-50 rounded-lg">
            <XCircle className="w-16 h-16 mx-auto text-red-600 mb-4" />
            <h3 className="text-xl font-semibold text-red-800 mb-2">KBA Verification Failed</h3>
            <p className="text-red-700">
              You scored {kbaResult.score}% ({kbaResult.correctAnswers}/{kbaResult.totalQuestions} correct). 
              You need 80% to pass.
            </p>
            <p className="text-sm text-red-600 mt-2">
              Attempts remaining: {kbaResult.attemptsRemaining}
            </p>
          </div>
        )}

        <div className="flex justify-center gap-4">
          {kbaResult.canRetry && !isPassed && (
            <Button onClick={() => {
              setCurrentStep('status');
              setAnswers({});
              setCurrentQuestionIndex(0);
              setError(null);
              setKbaResult(null);
            }}>
              Try Again
            </Button>
          )}
          
          <Button variant="outline" onClick={onClose}>
            {isPassed ? 'Continue' : 'Close'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Knowledge-Based Authentication
          </DialogTitle>
          <DialogDescription>
            Verify your identity by answering questions based on your personal history
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {currentStep === 'status' && renderStatusStep()}
          {currentStep === 'questions' && renderQuestionsStep()}
          {currentStep === 'submitting' && renderSubmittingStep()}
          {currentStep === 'result' && renderResultStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
} 