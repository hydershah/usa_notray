import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { IdCard, Shield, Smartphone, FileText, NotebookPen, Building, User, ArrowRight, Eye, EyeOff, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import TwoFactorAuth from '@/components/TwoFactorAuth';

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupOptions, setShowSignupOptions] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isForgotPasswordLoading, setIsForgotPasswordLoading] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  
  const { toast } = useToast();
  const { login, isAuthenticated, user } = useAuth();



  // Check for redirect reasons and show appropriate messages
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const reason = urlParams.get('reason');
    const reset = urlParams.get('reset');
    const setup = urlParams.get('setup');
    
    if (reason === 'expired') {
      toast({
        variant: "destructive",
        title: "Session Expired",
        description: "Your session has expired. Please log in again to continue.",
      });
    } else if (reason === 'required') {
      toast({
        title: "Authentication Required",
        description: "Please log in to access the requested page.",
      });
    } else if (reason === 'no-token') {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "No valid authentication token found. Please log in.",
      });
    } else if (reset === 'success') {
      toast({
        title: "Password Reset Complete",
        description: "Your password has been successfully reset. You can now log in with your new password.",
      });
    } else if (setup === 'success') {
      toast({
        title: "Account Setup Complete",
        description: "Your account has been successfully set up. Please log in to continue.",
      });
    }

    // Clear the URL parameters
    if (reason || reset || setup) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      // Role-based redirect: signers/witnesses to dashboard, others to jobs
      if (user.role === 'signer' || user.role === 'witness') {
        setLocation('/dashboard');
      } else {
        setLocation('/jobs');
      }
    }
  }, [isAuthenticated, user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError(null); // Clear any previous errors
    
    console.log('Login attempt:', { email, password: '***' });

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          twoFactorCode: twoFactorCode || undefined 
        })
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        if (data.requiresTwoFactor) {
          setRequiresTwoFactor(true);
          sonnerToast.info("2FA Required: Please enter your two-factor authentication code.");
          toast({
            title: "2FA Required",
            description: "Please enter your two-factor authentication code.",
          });
        } else {
          // Complete login
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          sonnerToast.success("Welcome back! You have been logged in successfully.");
          toast({
            title: "Welcome back!",
            description: "You have been logged in successfully.",
          });
          
          // Role-based redirect: signers/witnesses to dashboard, others to jobs
          if (data.user?.role === 'signer' || data.user?.role === 'witness') {
            setLocation('/dashboard');
          } else {
            setLocation('/jobs');
          }
        }
      } else {
        console.log('Login failed, showing error toast');
        
        // Get user-friendly error message
        let errorMessage = "Invalid email or password. Please check your credentials and try again.";
        
        if (response.status === 423) {
          errorMessage = "Account temporarily locked due to too many failed attempts. Please try again later.";
        } else if (response.status === 401) {
          if (data.message?.includes('Two-factor')) {
            errorMessage = "Invalid two-factor authentication code. Please try again.";
          } else {
            errorMessage = "Invalid email or password. Please check your credentials and try again.";
          }
        } else if (response.status >= 500) {
          errorMessage = "Server error. Please try again in a few minutes.";
        } else if (data.message) {
          errorMessage = data.message;
        }
        
        // Set inline error
        setLoginError(errorMessage);
        
        // Show prominent toast notifications
        sonnerToast.error(errorMessage, {
          duration: 6000,
          position: 'top-center'
        });
        
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: errorMessage,
        });
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      const errorMessage = "Unable to connect to the server. Please check your internet connection and try again.";
      
      // Set inline error
      setLoginError(errorMessage);
      
      // Show prominent toast notifications
      sonnerToast.error(errorMessage, {
        duration: 6000,
        position: 'top-center'
      });
      
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsForgotPasswordLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail })
      });

      const data = await response.json();

      if (response.ok) {
        setForgotPasswordSuccess(true);
        toast({
          title: "Reset Link Sent",
          description: "If an account with this email exists, a password reset link has been sent.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.message || "Failed to send reset link. Please try again.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: error.message || "Unable to connect. Please try again.",
      });
    } finally {
      setIsForgotPasswordLoading(false);
    }
  };

  const handleCloseForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotPasswordEmail('');
    setForgotPasswordSuccess(false);
    setIsForgotPasswordLoading(false);
  };

  const SignupOptions = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Join Sharp Note</h3>
        <p className="text-gray-600">Choose how you'd like to get started</p>
      </div>
      
      <div className="space-y-4">
        {/* User Signup */}
        <Card className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50/50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="h-14 w-14 bg-blue-100 group-hover:bg-blue-600 rounded-xl flex items-center justify-center transition-colors duration-300 shadow-sm">
                  <FileText className="h-7 w-7 text-blue-600 group-hover:text-white transition-colors duration-300" />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-900 mb-1">I need documents notarized</h4>
                <p className="text-sm text-gray-600 mb-4">Get your documents notarized quickly and securely</p>
                <Button 
                  onClick={() => setLocation('/register-user')}
                  className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg shadow-md transition-all duration-200 transform group-hover:scale-[1.02]"
                >
                  Sign Up as User
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notary Signup */}
        <Card className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 border-gray-200 hover:border-green-400 hover:bg-green-50/50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="h-14 w-14 bg-green-100 group-hover:bg-green-600 rounded-xl flex items-center justify-center transition-colors duration-300 shadow-sm">
                  <NotebookPen className="h-7 w-7 text-green-600 group-hover:text-white transition-colors duration-300" />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-900 mb-1">I'm a notary</h4>
                <p className="text-sm text-gray-600 mb-4">Join our network of professional notaries</p>
                <Button 
                  onClick={() => setLocation('/register-notary')}
                  className="w-full h-11 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium rounded-lg shadow-md transition-all duration-200 transform group-hover:scale-[1.02]"
                >
                  Sign Up as Notary
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500 font-medium">or</span>
          </div>
        </div>

        {/* Title Company Registration */}
        <Card className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50/50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="h-14 w-14 bg-purple-100 group-hover:bg-purple-600 rounded-xl flex items-center justify-center transition-colors duration-300 shadow-sm">
                  <Building className="h-7 w-7 text-purple-600 group-hover:text-white transition-colors duration-300" />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-900 mb-1">Register Your Title Company</h4>
                <p className="text-sm text-gray-600 mb-4">Create an account for your title company and manage your team</p>
                <Button 
                  onClick={() => setLocation('/register-company')}
                  className="w-full h-11 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-lg shadow-md transition-all duration-200 transform group-hover:scale-[1.02]"
                >
                  Register Title Company
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center pt-6 border-t border-gray-200">
        <Button 
          variant="ghost" 
          onClick={() => setShowSignupOptions(false)}
          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 font-medium transition-colors"
        >
          ← Back to Login
        </Button>
      </div>
    </div>
  );

  return (
    <>
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
              <p className="text-xl text-gray-200">Professional Digital Notary Services</p>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-white/10 rounded-full flex items-center justify-center">
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">Secure & Compliant</p>
                  <p className="text-sm text-gray-300">Bank-level security with full legal compliance</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-white/10 rounded-full flex items-center justify-center">
                    <Smartphone className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">Remote Notarization</p>
                  <p className="text-sm text-gray-300">Get documents notarized from anywhere</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-white/10 rounded-full flex items-center justify-center">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">Digital Workflow</p>
                  <p className="text-sm text-gray-300">Streamlined process for faster turnaround</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-20 left-20 w-32 h-32 bg-white/5 rounded-full blur-xl" />
        <div className="absolute bottom-20 right-20 w-24 h-24 bg-white/5 rounded-full blur-xl" />
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-lg">
          {!showSignupOptions ? (
            <Card className="shadow-2xl border-0 bg-white mx-2">
              <CardHeader className="text-center pb-6">
                <div className="lg:hidden mb-4">
                  <img 
                    src="/logo.jpeg" 
                    alt="Sharp Note Logo" 
                    className="h-16 w-auto mx-auto mb-2 object-contain"
                  />
                </div>
                <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900">
                  {requiresTwoFactor ? 'Verify Your Identity' : 'Welcome Back'}
                </CardTitle>
                <CardDescription className="text-gray-600">
                  {requiresTwoFactor ? 'Enter your two-factor authentication code' : 'Sign in to your Sharp Note account'}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6 px-6 sm:px-8 pb-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {!requiresTwoFactor && (
                    <>
                      <div className="space-y-3">
                        <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (loginError) setLoginError(null); // Clear error when user types
                          }}
                          required
                          className={`h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors text-base ${
                            loginError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                          }`}
                        />
                      </div>
                      
                      <div className="space-y-3">
                        <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                          Password
                        </Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              if (loginError) setLoginError(null); // Clear error when user types
                            }}
                            required
                            className={`h-12 pr-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors text-base ${
                              loginError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded p-1"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>
                      
                      {/* Error Message Display */}
                      {loginError && !requiresTwoFactor && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              <AlertCircle className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-red-800">Login Failed</p>
                              <p className="text-sm text-red-700 mt-1">{loginError}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {requiresTwoFactor && (
                    <div className="space-y-5 p-6 border border-gray-200 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50">
                      <div className="flex items-center gap-3 text-gray-800">
                        <div className="p-2 bg-blue-100 rounded-full">
                          <Shield className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="font-semibold text-lg">Two-Factor Authentication</span>
                      </div>
                      <div className="space-y-4">
                        <Label className="text-sm font-medium text-gray-700">
                          Enter the 6-digit code from your authenticator app
                        </Label>
                        <div className="flex justify-center">
                          <InputOTP
                            maxLength={6}
                            value={twoFactorCode}
                            onChange={(value) => {
                              setTwoFactorCode(value);
                              if (loginError) setLoginError(null); // Clear error when user types
                            }}
                          >
                            <InputOTPGroup className="gap-3">
                              <InputOTPSlot index={0} className="h-12 w-12 text-lg" />
                              <InputOTPSlot index={1} className="h-12 w-12 text-lg" />
                              <InputOTPSlot index={2} className="h-12 w-12 text-lg" />
                              <InputOTPSlot index={3} className="h-12 w-12 text-lg" />
                              <InputOTPSlot index={4} className="h-12 w-12 text-lg" />
                              <InputOTPSlot index={5} className="h-12 w-12 text-lg" />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 justify-center bg-white/60 backdrop-blur-sm rounded-lg p-3">
                          <Smartphone className="h-4 w-4 text-blue-600" />
                          <span>Check your authenticator app for the current code</span>
                        </div>
                        
                        {/* Error Message Display for 2FA */}
                        {loginError && requiresTwoFactor && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0">
                                <AlertCircle className="h-5 w-5 text-red-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-red-800">Verification Failed</p>
                                <p className="text-sm text-red-700 mt-1">{loginError}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!requiresTwoFactor && (
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center space-x-3">
                        <Checkbox 
                          id="remember" 
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                          className="border-gray-300"
                        />
                        <Label htmlFor="remember" className="text-sm text-gray-700 font-medium">
                          Remember me
                        </Label>
                      </div>
                      <Button 
                        type="button"
                        variant="link" 
                        className="p-0 h-auto text-sm text-blue-600 hover:text-blue-800 font-medium" 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowForgotPassword(true);
                        }}
                      >
                        Forgot password?
                      </Button>
                    </div>
                  )}

                  <div className="space-y-4 pt-2">
                    <Button 
                      type="submit" 
                      className="w-full h-12 bg-gradient-to-r from-gray-900 to-black hover:from-black hover:to-gray-900 text-white font-semibold rounded-lg shadow-lg transition-all duration-200 transform hover:scale-[1.02] text-base" 
                      disabled={isLoading || (requiresTwoFactor && twoFactorCode.length !== 6)}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Signing in...
                        </div>
                      ) : requiresTwoFactor ? 'Verify & Sign In' : 'Sign In'}
                    </Button>
                    
                    {requiresTwoFactor && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full h-12 border-gray-300 hover:bg-gray-50 font-medium text-base" 
                        onClick={() => {
                          setRequiresTwoFactor(false);
                          setTwoFactorCode('');
                        }}
                      >
                        ← Back to Login
                      </Button>
                    )}
                  </div>
                </form>
                
                {!requiresTwoFactor && (
                  <div className="text-center pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-4">
                      Don't have an account?
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full h-12 border-gray-300 hover:bg-blue-50 hover:border-blue-300 text-blue-600 hover:text-blue-700 font-medium text-base transition-colors"
                      onClick={() => setShowSignupOptions(true)}
                    >
                      <User className="mr-2 h-5 w-5" />
                      Create New Account
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-2xl border-0 bg-white mx-2">
              <CardContent className="p-6 sm:p-8">
                <SignupOptions />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>

      {/* Forgot Password Modal */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Reset Password
          </DialogTitle>
          <DialogDescription>
            Enter your email address and we'll send you a link to reset your password.
          </DialogDescription>
        </DialogHeader>
        
        {forgotPasswordSuccess ? (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Check Your Email</h3>
              <p className="text-sm text-gray-600 mb-4">
                If an account with this email exists, we've sent a password reset link to:
              </p>
              <p className="font-medium text-blue-600">{forgotPasswordEmail}</p>
              <p className="text-sm text-gray-600 mt-2">
                The link will expire in 24 hours.
              </p>
            </div>
            <Button 
              onClick={handleCloseForgotPassword} 
              className="w-full"
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email Address</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="Enter your email address"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleCloseForgotPassword}
                disabled={isForgotPasswordLoading}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isForgotPasswordLoading || !forgotPasswordEmail}
              >
                {isForgotPasswordLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Reset Link
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
