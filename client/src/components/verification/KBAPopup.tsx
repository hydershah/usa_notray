import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Brain, Clock, Shield, XCircle, CheckCircle, AlertCircle, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface KBAQuestion {
  text: string;
  questionType: number;
  answers: Array<{ text: string }>;
}

interface KBAPopupProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  userInfo: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    ssn?: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
    phone?: string;
    email: string;
  };
  onSuccess: () => void;
}

export function KBAPopup({ isOpen, onClose, userId, userInfo, onSuccess }: KBAPopupProps) {
  const { toast } = useToast();
  
  const [step, setStep] = useState<'loading' | 'questions' | 'results' | 'locked'>('loading');
  const [questions, setQuestions] = useState<KBAQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [sessionId, setSessionId] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(2);
  const [results, setResults] = useState<any>(null);

  // Timer countdown
  useEffect(() => {
    if (step === 'questions' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [step, timeLeft]);

  // Initialize KBA when popup opens
  useEffect(() => {
    if (isOpen && step === 'loading') {
      initializeKBA();
    }
  }, [isOpen]);

  const initializeKBA = async () => {
    try {
      const response = await fetch('/api/kba/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userId,
          ...userInfo
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 423) {
          // User is locked
          setStep('locked');
          setResults(data);
        } else {
          throw new Error(data.message || 'Failed to initialize KBA');
        }
        return;
      }

      if (data.alreadyVerified) {
        toast({
          title: "Already Verified",
          description: "KBA verification already completed",
          variant: "default"
        });
        onSuccess();
        onClose();
        return;
      }

      setQuestions(data.questions);
      setSessionId(data.sessionId);
      setAttemptsRemaining(data.attemptsRemaining);
      setStep('questions');
      
    } catch (error) {
      console.error('KBA initialization error:', error);
      toast({
        title: "Initialization Failed",
        description: error instanceof Error ? error.message : "Failed to start KBA verification",
        variant: "destructive"
      });
      onClose();
    }
  };

  const handleTimeout = () => {
    toast({
      title: "Session Expired",
      description: "KBA session has expired. Please try again.",
      variant: "destructive"
    });
    onClose();
  };

  const handleAnswerSelect = (questionIndex: number, answerIndex: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: answerIndex
    }));
  };

  const submitAnswers = async () => {
    if (Object.keys(selectedAnswers).length < questions.length) {
      toast({
        title: "Incomplete Answers",
        description: "Please answer all questions before submitting.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const answers = questions.map((_, index) => ({
        questionIndex: index,
        selectedAnswerIndex: selectedAnswers[index]
      }));

      const response = await fetch('/api/kba/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sessionId,
          userId,
          answers
        })
      });

      const data = await response.json();
      setResults(data);

      if (data.success && data.passed) {
        setStep('results');
        toast({
          title: "KBA Verification Successful! ✅",
          description: `You scored ${data.score}% (${data.correctAnswers}/${data.totalQuestions} correct)`,
          variant: "default"
        });
        
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 3000);
        
      } else if (data.locked) {
        setStep('locked');
        toast({
          title: "Account Locked",
          description: "Too many failed attempts. Account locked for 24 hours.",
          variant: "destructive"
        });
        
      } else {
        setStep('results');
        toast({
          title: "KBA Verification Failed",
          description: `You scored ${data.score}% (${data.correctAnswers}/${data.totalQuestions} correct). ${data.attemptsRemaining || 0} attempts remaining.`,
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('KBA submission error:', error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Failed to submit KBA answers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderLoadingStep = () => (
    <div className="text-center py-8">
      <Brain className="mx-auto h-16 w-16 text-blue-500 animate-pulse mb-4" />
      <h3 className="text-lg font-semibold mb-2">Preparing KBA Verification</h3>
      <p className="text-gray-600">Retrieving your knowledge-based authentication questions...</p>
    </div>
  );

  const renderQuestionsStep = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-blue-500" />
          <div>
            <h3 className="font-semibold">KBA Verification</h3>
            <p className="text-sm text-gray-600">Answer 5 questions about your personal history</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          <span className={timeLeft < 60 ? 'text-red-500 font-semibold' : 'text-gray-600'}>
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Progress</span>
          <span>{Object.keys(selectedAnswers).length}/{questions.length}</span>
        </div>
        <Progress value={(Object.keys(selectedAnswers).length / questions.length) * 100} />
      </div>

      {/* Attempts remaining */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You have <strong>{attemptsRemaining}</strong> attempts remaining. Need 4 out of 5 correct answers to pass.
        </AlertDescription>
      </Alert>

      {/* Questions */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {questions.map((question, questionIndex) => (
          <Card key={questionIndex} className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">
                  Q{questionIndex + 1}
                </span>
                {question.text}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {question.answers.map((answer, answerIndex) => (
                <button
                  key={answerIndex}
                  onClick={() => handleAnswerSelect(questionIndex, answerIndex)}
                  className={`w-full p-3 text-left rounded-lg border-2 transition-all duration-200 ${
                    selectedAnswers[questionIndex] === answerIndex
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      selectedAnswers[questionIndex] === answerIndex
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedAnswers[questionIndex] === answerIndex && (
                        <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                      )}
                    </div>
                    <span>{answer.text}</span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submit button */}
      <div className="flex justify-end pt-4 border-t">
        <Button
          onClick={submitAnswers}
          disabled={loading || Object.keys(selectedAnswers).length < questions.length}
          className="px-8"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Submit Answers
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderResultsStep = () => (
    <div className="text-center py-8">
      {results?.passed ? (
        <div className="space-y-4">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          <div>
            <h3 className="text-xl font-semibold text-green-800 mb-2">KBA Verification Successful!</h3>
            <p className="text-gray-600 mb-4">You have successfully completed the knowledge-based authentication.</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="font-semibold text-green-800">
                Score: {results.score}% ({results.correctAnswers}/{results.totalQuestions} correct)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <XCircle className="mx-auto h-16 w-16 text-red-500" />
          <div>
            <h3 className="text-xl font-semibold text-red-800 mb-2">KBA Verification Failed</h3>
            <p className="text-gray-600 mb-4">{results?.message}</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="font-semibold text-red-800 mb-2">
                Score: {results?.score}% ({results?.correctAnswers}/{results?.totalQuestions} correct)
              </p>
              {results?.attemptsRemaining > 0 && (
                <p className="text-sm text-red-700">
                  You have {results.attemptsRemaining} attempt(s) remaining.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderLockedStep = () => (
    <div className="text-center py-8">
      <Lock className="mx-auto h-16 w-16 text-red-500 mb-4" />
      <h3 className="text-xl font-semibold text-red-800 mb-2">Account Locked</h3>
      <p className="text-gray-600 mb-4">
        Your account has been temporarily locked due to multiple failed KBA verification attempts.
      </p>
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-red-800">
          <strong>Lockout until:</strong> {results?.lockedUntil ? new Date(results.lockedUntil).toLocaleString() : 'Unknown'}
          <br />
          Please try again after the lockout period expires or contact support for assistance.
        </AlertDescription>
      </Alert>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-500" />
            Knowledge-Based Authentication
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          {step === 'loading' && renderLoadingStep()}
          {step === 'questions' && renderQuestionsStep()}
          {step === 'results' && renderResultsStep()}
          {step === 'locked' && renderLockedStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
} 