import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, Check, X } from 'lucide-react';

interface RegistrationFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

interface PasswordRequirement {
  test: (password: string) => boolean;
  text: string;
}

export default function RegisterUser() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<RegistrationFormData>({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const { toast } = useToast();

  const passwordRequirements: readonly PasswordRequirement[] = [
    { test: (pwd: string) => pwd.length >= 8, text: 'At least 8 characters' },
    { test: (pwd: string) => /[A-Z]/.test(pwd), text: 'One uppercase letter' },
    { test: (pwd: string) => /[a-z]/.test(pwd), text: 'One lowercase letter' },
    { test: (pwd: string) => /\d/.test(pwd), text: 'One number' },
    { test: (pwd: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd), text: 'One special character' },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    const fieldName = name as keyof RegistrationFormData;
    
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
    
    // Clear field-specific errors when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: undefined }));
    }
  };

  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {};
    
    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const hasValidPassword = passwordRequirements.every(req => req.test(formData.password));
      if (!hasValidPassword) {
        newErrors.password = 'Password does not meet requirements';
      }
    }
    
    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast({
        variant: "destructive",
        title: "Form Validation Error",
        description: "Please fix the errors below and try again.",
      });
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Registration Successful!",
          description: "Please check your email and click the verification link to activate your account.",
        });
        
        // Show success message instead of redirecting
        setFormData({ email: '', password: '', confirmPassword: '' });
        setErrors({});
        
      } else {
        // Enhanced error handling for duplicate emails
        if (response.status === 409 && data.error === 'EMAIL_ALREADY_EXISTS') {
          setErrors({ 
            email: data.message || 'An account with this email address already exists. Email addresses must be unique across all account types.',
            general: data.details?.suggestion || 'Please use a different email address or sign in to your existing account.'
          });
          toast({
            variant: "destructive",
            title: "Email Already Registered",
            description: "This email is already associated with an account. Please use a different email or sign in to your existing account.",
          });
        } else {
          setErrors({ general: data.message || "Registration failed. Please try again." });
          toast({
            variant: "destructive",
            title: "Registration Failed",
            description: data.message || "Unable to create account. Please try again.",
          });
        }
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

  const isPasswordRequirementMet = (requirement: PasswordRequirement): boolean => {
    return formData.password ? requirement.test(formData.password) : false;
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gray-50">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{background: 'linear-gradient(to bottom right, #00335B, #001a2e, #00335B)'}}>
        <div className="absolute inset-0" style={{backgroundColor: 'rgba(0, 51, 91, 0.2)'}} />
        <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
          <div className="text-center max-w-lg">
            <div className="mb-8">
              <img 
                src="/sharpnote_-_blue_background.jpg" 
                alt="Sharp Note Logo" 
                className="h-32 w-auto mx-auto mb-6 object-contain"
              />
              <h1 className="text-4xl font-bold mb-2">Join Sharp Note</h1>
              <p className="text-xl text-gray-200">Professional Digital Notarization</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Mail className="h-8 w-8 text-white" />
                <div className="text-left">
                  <p className="font-semibold text-white">Simple Registration</p>
                  <p className="text-sm text-gray-300">Just email and password to get started</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <Lock className="h-8 w-8 text-white" />
                <div className="text-left">
                  <p className="font-semibold text-white">Secure Verification</p>
                  <p className="text-sm text-gray-300">Email verification for account security</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Registration Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0 bg-white">
            <CardHeader className="text-center pb-6">
              <div className="lg:hidden mb-4">
                <img 
                  src="/sharpnote_-_blue_background.jpg" 
                  alt="Sharp Note Logo" 
                  className="h-16 w-auto mx-auto mb-2 object-contain"
                />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Create Your Account
              </CardTitle>
              <CardDescription className="text-gray-600">
                Get started with Sharp Note today
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

                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email Address *
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email address"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`h-12 ${errors.email ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'} focus:ring-blue-500 transition-colors`}
                    autoComplete="email"
                    required
                  />
                  {errors.email && (
                    <p className="text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password *
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className={`h-12 pr-12 ${errors.password ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'} focus:ring-blue-500 transition-colors`}
                      autoComplete="new-password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-12 px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-600">{errors.password}</p>
                  )}
                  
                  {/* Password Requirements */}
                  {formData.password && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-md">
                      <p className="text-xs font-medium text-gray-700 mb-2">Password Requirements:</p>
                      <div className="grid grid-cols-1 gap-1">
                        {passwordRequirements.map((req, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            {isPasswordRequirementMet(req) ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <X className="h-3 w-3 text-red-400" />
                            )}
                            <span className={`text-xs ${isPasswordRequirementMet(req) ? 'text-blue-600' : 'text-gray-600'}`}>
                              {req.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                    Confirm Password *
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className={`h-12 pr-12 ${errors.confirmPassword ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'} focus:ring-blue-500 transition-colors`}
                      autoComplete="new-password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-12 px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-600">{errors.confirmPassword}</p>
                  )}
                  {formData.confirmPassword && (
                    <div className={`flex items-center gap-2 text-sm mt-2 p-2 rounded ${formData.password === formData.confirmPassword ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`} role="status" aria-live="polite">
                      {formData.password === formData.confirmPassword ? <Check className="h-4 w-4" aria-label="Success" /> : <X className="h-4 w-4" aria-label="Error" />}
                      <span>{formData.password === formData.confirmPassword ? 'Passwords match' : 'Passwords do not match'}</span>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium text-base transition-colors"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating Account..." : "Create Account"}
                </Button>
              </form>

              {/* Login Link */}
              <div className="text-center pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <Button
                    variant="link"
                    className="p-0 h-auto text-blue-600 hover:text-blue-700 font-medium"
                    onClick={() => setLocation('/login')}
                  >
                    Sign In
                  </Button>
                </p>
              </div>

              {/* Back to Home */}
              <div className="text-center">
                <Button
                  variant="ghost"
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => setLocation('/')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 