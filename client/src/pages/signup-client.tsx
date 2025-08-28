import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, ArrowLeft, Check, X, FileText } from 'lucide-react';

interface ClientSignupData {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export default function SignupClient() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<ClientSignupData>({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const { toast } = useToast();

  const passwordRequirements = [
    { test: (pwd: string) => pwd.length >= 8, text: 'At least 8 characters' },
    { test: (pwd: string) => /[A-Z]/.test(pwd), text: 'One uppercase letter' },
    { test: (pwd: string) => /[a-z]/.test(pwd), text: 'One lowercase letter' },
    { test: (pwd: string) => /\d/.test(pwd), text: 'One number' },
    { test: (pwd: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd), text: 'One special character' },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const fieldName = name as keyof ClientSignupData;
    
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
    
    // Full name validation
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().split(' ').length < 2) {
      newErrors.fullName = 'Please enter both first and last name';
    }
    
    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Phone number validation
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!/^\d{10,}$/.test(formData.phoneNumber.replace(/\D/g, ''))) {
      newErrors.phoneNumber = 'Please enter a valid phone number';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/auth/register-client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          // Enhanced security message for duplicate emails
          if (data.error === 'EMAIL_ALREADY_EXISTS') {
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
            setErrors({ email: 'An account with this email already exists' });
          }
        } else {
          setErrors({ general: data.message || 'Registration failed' });
        }
        return;
      }

      toast({
        title: "Account Created!",
        description: "Welcome to Sharp Note! You can now log in to your account.",
      });

      // Redirect to login page after successful registration
      setLocation('/login');

    } catch (error) {
      console.error('Registration error:', error);
      setErrors({ general: 'Registration failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    const phoneNumber = value.replace(/\D/g, '');
    if (phoneNumber.length <= 3) return phoneNumber;
    if (phoneNumber.length <= 6) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => setLocation('/')}
          className="mb-4 text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>

        <Card className="shadow-lg border-0">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">Get Documents Notarized</CardTitle>
            <CardDescription className="text-gray-600">
              Create your account to start notarizing documents quickly and securely
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors.general && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                  {errors.general}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                  className={errors.fullName ? 'border-red-500' : ''}
                />
                {errors.fullName && (
                  <p className="text-red-500 text-sm">{errors.fullName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-red-500 text-sm">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  value={formatPhoneNumber(formData.phoneNumber)}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    handleInputChange({ target: { name: 'phoneNumber', value } } as any);
                  }}
                  placeholder="(555) 123-4567"
                  className={errors.phoneNumber ? 'border-red-500' : ''}
                />
                {errors.phoneNumber && (
                  <p className="text-red-500 text-sm">{errors.phoneNumber}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Create a strong password"
                    className={errors.password ? 'border-red-500' : ''}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-sm">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm your password"
                    className={errors.confirmPassword ? 'border-red-500' : ''}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-500 text-sm">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Password Requirements */}
              {formData.password && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm font-medium text-gray-700 mb-2">Password Requirements:</p>
                  <div className="space-y-1">
                    {passwordRequirements.map((req, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        {req.test(formData.password) ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`text-sm ${req.test(formData.password) ? 'text-green-700' : 'text-red-700'}`}>
                          {req.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700" 
                disabled={isLoading}
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <button
                  onClick={() => setLocation('/login')}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign in here
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 