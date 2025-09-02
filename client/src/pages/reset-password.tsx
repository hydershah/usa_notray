import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, CheckCircle, XCircle, ArrowLeft, KeyRound, Shield } from 'lucide-react';

function ResetPasswordPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);

  // Get token from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    
    if (!resetToken) {
      toast({
        title: "Invalid Link",
        description: "No reset token provided. Please use the link from your email.",
        variant: "destructive",
      });
      setLocation('/login');
      return;
    }
    
    setToken(resetToken);
    validateToken(resetToken);
  }, []);

  const validateToken = async (resetToken: string) => {
    try {
      const response = await fetch('/api/auth/validate-password-reset-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: resetToken })
      });

      if (response.ok) {
        const data = await response.json();
        setTokenValid(true);
        setUserInfo(data.user);
      } else {
        const errorData = await response.json();
        setTokenValid(false);
        toast({
          title: "Invalid or Expired Link",
          description: errorData.message || "This reset link is invalid or has expired. Please request a new one.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setTokenValid(false);
      toast({
        title: "Validation Error",
        description: "Unable to validate reset link. Please try again.",
        variant: "destructive",
      });
    }
  };

  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return {
      minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
      isValid: minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar
    };
  };

  const passwordValidation = validatePassword(password);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordValidation.isValid) {
      toast({
        title: "Invalid Password",
        description: "Please meet all password requirements.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure both passwords match.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          password
        })
      });

      if (response.ok) {
        toast({
          title: "Password Reset Successful",
          description: "Your password has been updated. You can now log in with your new password.",
        });

        // Redirect to login page after successful password reset
        setTimeout(() => {
          setLocation('/login?reset=success');
        }, 1500);
      } else {
        const errorData = await response.json();
        toast({
          title: "Reset Failed",
          description: errorData.message || "Failed to reset password. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Unable to connect to the server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validating reset link...</p>
        </div>
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-xl text-red-600">Invalid Reset Link</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Button 
              onClick={() => setLocation('/login')}
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <KeyRound className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-xl">Reset Your Password</CardTitle>
          <p className="text-gray-600 mt-2">
            Enter a new password for your account
          </p>
          {userInfo && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Account:</strong> {userInfo.email}
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Password Requirements:</Label>
              <div className="space-y-1">
                <div className={`flex items-center text-sm ${passwordValidation.minLength ? 'text-blue-600' : 'text-gray-500'}`}>
                  {passwordValidation.minLength ? <CheckCircle className="h-3 w-3 mr-2" /> : <XCircle className="h-3 w-3 mr-2" />}
                  At least 8 characters
                </div>
                <div className={`flex items-center text-sm ${passwordValidation.hasUpperCase ? 'text-blue-600' : 'text-gray-500'}`}>
                  {passwordValidation.hasUpperCase ? <CheckCircle className="h-3 w-3 mr-2" /> : <XCircle className="h-3 w-3 mr-2" />}
                  One uppercase letter
                </div>
                <div className={`flex items-center text-sm ${passwordValidation.hasLowerCase ? 'text-blue-600' : 'text-gray-500'}`}>
                  {passwordValidation.hasLowerCase ? <CheckCircle className="h-3 w-3 mr-2" /> : <XCircle className="h-3 w-3 mr-2" />}
                  One lowercase letter
                </div>
                <div className={`flex items-center text-sm ${passwordValidation.hasNumbers ? 'text-blue-600' : 'text-gray-500'}`}>
                  {passwordValidation.hasNumbers ? <CheckCircle className="h-3 w-3 mr-2" /> : <XCircle className="h-3 w-3 mr-2" />}
                  One number
                </div>
                <div className={`flex items-center text-sm ${passwordValidation.hasSpecialChar ? 'text-blue-600' : 'text-gray-500'}`}>
                  {passwordValidation.hasSpecialChar ? <CheckCircle className="h-3 w-3 mr-2" /> : <XCircle className="h-3 w-3 mr-2" />}
                  One special character
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation('/login')}
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Button>
              <Button
                type="submit"
                disabled={loading || !passwordValidation.isValid || password !== confirmPassword}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Reset Password
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default ResetPasswordPage; 