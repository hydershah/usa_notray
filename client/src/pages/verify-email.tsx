import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Shield, ArrowLeft, RefreshCw } from 'lucide-react';

interface VerificationFormData {
  otpCode: string;
}

interface FormErrors {
  otpCode?: string;
  general?: string;
}

interface ApiResponse {
  message: string;
  error?: string;
  data?: any;
}

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<VerificationFormData>({
    otpCode: '',
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 minutes in seconds
  const [canResend, setCanResend] = useState<boolean>(false);
  const { toast } = useToast();

  // Get email and password from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    
    if (!emailParam) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please start the registration process again.",
      });
      setLocation('/register-user');
      return;
    }
    
    setEmail(emailParam);
    
    // Get password from sessionStorage if available
    const storedPassword = sessionStorage.getItem('registration_password');
    if (storedPassword) {
      setPassword(storedPassword);
      sessionStorage.removeItem('registration_password');
    }
  }, [setLocation, toast]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    
    // Only allow numbers and limit to 6 digits
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    
    setFormData(prev => ({
      ...prev,
      [name]: numericValue
    }));
    
    // Clear errors when user starts typing
    if (errors.otpCode) {
      setErrors(prev => ({ ...prev, otpCode: undefined }));
    }
  };

  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {};
    
    if (!formData.otpCode) {
      newErrors.otpCode = 'Verification code is required';
    } else if (formData.otpCode.length !== 6) {
      newErrors.otpCode = 'Verification code must be 6 digits';
    } else if (!/^\d{6}$/.test(formData.otpCode)) {
      newErrors.otpCode = 'Verification code must contain only numbers';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (!password) {
      toast({
        variant: "destructive",
        title: "Missing Password",
        description: "Please start the registration process again.",
      });
      setLocation('/register-user');
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otpCode: formData.otpCode,
          password: password,
        })
      });

      const data: ApiResponse = await response.json();

      if (response.ok) {
        toast({
          title: "Account Created Successfully!",
          description: "Your email has been verified. You can now log in to your account.",
        });
        setLocation('/login');
      } else {
        if (data.error === 'INVALID_OTP') {
          setErrors({ otpCode: data.message });
        } else if (data.error === 'OTP_EXPIRED') {
          setErrors({ general: data.message });
          setCanResend(true);
          setTimeLeft(0);
        } else if (data.error === 'OTP_LOCKED') {
          setErrors({ general: data.message });
        } else {
          setErrors({ general: data.message || "Verification failed. Please try again." });
        }
        
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: data.message || "Unable to verify your email. Please try again.",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to connect. Please try again.';
      setErrors({ general: errorMessage });
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async (): Promise<void> => {
    if (!canResend) return;
    
    setIsResending(true);
    setErrors({});

    try {
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
        })
      });

      const data: ApiResponse = await response.json();

      if (response.ok) {
        toast({
          title: "Code Sent!",
          description: "A new verification code has been sent to your email.",
        });
        setCanResend(false);
        setTimeLeft(600); // Reset to 10 minutes
        setFormData({ otpCode: '' }); // Clear the current code
      } else {
        setErrors({ general: data.message || "Failed to send new code. Please try again." });
        toast({
          variant: "destructive",
          title: "Failed to Send Code",
          description: data.message || "Unable to send new verification code. Please try again.",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to connect. Please try again.';
      setErrors({ general: errorMessage });
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: errorMessage,
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gray-50">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 via-black to-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
          <div className="text-center max-w-lg">
            <div className="mb-8">
              <img 
                src="/logo.jpeg" 
                alt="Sharp Note Logo" 
                className="h-32 w-auto mx-auto mb-6 object-contain"
              />
              <h1 className="text-4xl font-bold mb-2">Almost There!</h1>
              <p className="text-xl text-gray-200">Verify your email to complete registration</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Mail className="h-8 w-8 text-white" />
                <div className="text-left">
                  <p className="font-semibold text-white">Check Your Email</p>
                  <p className="text-sm text-gray-300">We sent a 6-digit code to your email</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <Shield className="h-8 w-8 text-white" />
                <div className="text-left">
                  <p className="font-semibold text-white">Secure Verification</p>
                  <p className="text-sm text-gray-300">Code expires in 10 minutes for security</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Verification Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0 bg-white">
            <CardHeader className="text-center pb-6">
              <div className="lg:hidden mb-4">
                <img 
                  src="/logo.jpeg" 
                  alt="Sharp Note Logo" 
                  className="h-16 w-auto mx-auto mb-2 object-contain"
                />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Verify Your Email
              </CardTitle>
              <CardDescription className="text-gray-600">
                Enter the 6-digit code sent to<br />
                <span className="font-medium text-gray-800">{email}</span>
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6 px-6 sm:px-8 pb-6 sm:pb-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* General Error */}
                {errors.general && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{errors.general}</p>
                  </div>
                )}

                {/* OTP Code Field */}
                <div className="space-y-2">
                  <Label htmlFor="otpCode" className="text-sm font-medium text-gray-700">
                    Verification Code *
                  </Label>
                  <Input
                    id="otpCode"
                    name="otpCode"
                    type="text"
                    placeholder="000000"
                    value={formData.otpCode}
                    onChange={handleInputChange}
                    className={`h-12 text-center text-2xl font-mono tracking-wider ${errors.otpCode ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'} focus:ring-blue-500 transition-colors`}
                    maxLength={6}
                    autoComplete="one-time-code"
                    required
                  />
                  {errors.otpCode && (
                    <p className="text-sm text-red-600">{errors.otpCode}</p>
                  )}
                  
                  {/* Timer */}
                  <div className="text-center">
                    {timeLeft > 0 ? (
                      <p className="text-sm text-gray-500">
                        Code expires in {formatTime(timeLeft)}
                      </p>
                    ) : (
                      <p className="text-sm text-red-600">
                        Code has expired. Please request a new one.
                      </p>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium text-base transition-colors"
                  disabled={isLoading || formData.otpCode.length !== 6}
                >
                  {isLoading ? "Verifying..." : "Verify Email"}
                </Button>
              </form>

              {/* Resend Code */}
              <div className="text-center pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-3">
                  Didn't receive the code?
                </p>
                <Button
                  variant="ghost"
                  className={`text-blue-600 hover:text-blue-700 ${!canResend ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={handleResendCode}
                  disabled={!canResend || isResending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isResending ? 'animate-spin' : ''}`} />
                  {isResending ? 'Sending...' : 'Send New Code'}
                </Button>
              </div>

              {/* Back to Registration */}
              <div className="text-center">
                <Button
                  variant="ghost"
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => setLocation('/register-user')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Registration
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 