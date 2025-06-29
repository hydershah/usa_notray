import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

function SetPasswordPage() {
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
        description: "No setup token provided. Please use the link from your email.",
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
          description: errorData.message || "This setup link is invalid or has expired.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setTokenValid(false);
      toast({
        title: "Validation Error",
        description: "Unable to validate setup link. Please try again.",
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

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordValidation.isValid) {
      toast({
        title: "Invalid Password",
        description: "Please ensure your password meets all requirements.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/set-password', {
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
        const data = await response.json();
        
        toast({
          title: "Password Set Successfully",
          description: "Your account is now ready. Please log in to access your dashboard.",
        });

        // Store user info temporarily for auto-login
        localStorage.setItem('tempUserInfo', JSON.stringify({
          email: userInfo?.email,
          name: userInfo?.name
        }));

        // Redirect to login with success message
        setTimeout(() => {
          setLocation('/login?setup=success');
        }, 2000);
      } else {
        const errorData = await response.json();
        toast({
          title: "Setup Failed",
          description: errorData.message || "Failed to set password. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Setup Error",
        description: "Unable to complete password setup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (tokenValid === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Validating setup link...</p>
        </div>
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center text-red-600">
              <XCircle className="h-5 w-5 mr-2" />
              Invalid Setup Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              This account setup link is invalid or has expired. Please request a new invitation or contact support.
            </p>
            <Button onClick={() => setLocation('/login')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 py-8">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-blue-600">
              <CheckCircle className="h-5 w-5 mr-2" />
              Complete Account Setup
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userInfo && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Account Information</h3>
                <p><strong>Name:</strong> {userInfo.name}</p>
                <p><strong>Email:</strong> {userInfo.email}</p>
                <p><strong>Role:</strong> {userInfo.role}</p>
              </div>
            )}
            
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div>
                <Label htmlFor="password">Create Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                    placeholder="Confirm your password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Password Requirements */}
              <div className="text-sm">
                <p className="font-medium text-gray-700 mb-2">Password Requirements:</p>
                <ul className="space-y-1">
                  <li className={`flex items-center ${passwordValidation.minLength ? 'text-green-600' : 'text-red-600'}`}>
                    {passwordValidation.minLength ? <CheckCircle className="h-3 w-3 mr-2" /> : <XCircle className="h-3 w-3 mr-2" />}
                    At least 8 characters
                  </li>
                  <li className={`flex items-center ${passwordValidation.hasUpperCase ? 'text-green-600' : 'text-red-600'}`}>
                    {passwordValidation.hasUpperCase ? <CheckCircle className="h-3 w-3 mr-2" /> : <XCircle className="h-3 w-3 mr-2" />}
                    One uppercase letter
                  </li>
                  <li className={`flex items-center ${passwordValidation.hasLowerCase ? 'text-green-600' : 'text-red-600'}`}>
                    {passwordValidation.hasLowerCase ? <CheckCircle className="h-3 w-3 mr-2" /> : <XCircle className="h-3 w-3 mr-2" />}
                    One lowercase letter
                  </li>
                  <li className={`flex items-center ${passwordValidation.hasNumbers ? 'text-green-600' : 'text-red-600'}`}>
                    {passwordValidation.hasNumbers ? <CheckCircle className="h-3 w-3 mr-2" /> : <XCircle className="h-3 w-3 mr-2" />}
                    One number
                  </li>
                  <li className={`flex items-center ${passwordValidation.hasSpecialChar ? 'text-green-600' : 'text-red-600'}`}>
                    {passwordValidation.hasSpecialChar ? <CheckCircle className="h-3 w-3 mr-2" /> : <XCircle className="h-3 w-3 mr-2" />}
                    One special character
                  </li>
                </ul>
              </div>

              {/* Password Match Indicator */}
              {confirmPassword && (
                <div className={`text-sm flex items-center ${password === confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                  {password === confirmPassword ? <CheckCircle className="h-3 w-3 mr-2" /> : <XCircle className="h-3 w-3 mr-2" />}
                  {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !passwordValidation.isValid || password !== confirmPassword}
              >
                {loading ? 'Setting Up Account...' : 'Complete Setup'}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-900 mb-2">Next Steps</h4>
              <ol className="text-sm text-yellow-800 space-y-1">
                <li>1. Complete password setup</li>
                <li>2. Log in to your dashboard</li>
                <li>3. Complete ID verification</li>
                <li>4. Wait for account approval</li>
                <li>5. Join signing sessions once verified</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SetPasswordPage; 