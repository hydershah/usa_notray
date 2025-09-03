import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, ArrowLeft, Check, X, Shield, Award } from 'lucide-react';

interface NotarySignupData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zipCode: string;
  dateOfBirth: string;
  commissionNumber: string;
  commissionState: string;
  commissionExpiration: string;
  yearsOfExperience: string;
  specializations: string;
  workingHours: string;
  bio: string;
  notaryType: 'contractor' | 'subscriber' | 'both';
}

interface FormErrors {
  [key: string]: string;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export default function SignupNotary() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<NotarySignupData>({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    dateOfBirth: '',
    commissionNumber: '',
    commissionState: '',
    commissionExpiration: '',
    yearsOfExperience: '',
    specializations: '',
    workingHours: '',
    bio: '',
    notaryType: 'contractor',
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear field-specific errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {};
    
    // Required field validation
    const requiredFields = [
      'firstName', 'lastName', 'email', 'phoneNumber', 'password', 'confirmPassword',
      'address1', 'city', 'state', 'zipCode', 'dateOfBirth',
      'commissionNumber', 'commissionState', 'commissionExpiration', 'yearsOfExperience'
    ];

    requiredFields.forEach(field => {
      if (!formData[field as keyof NotarySignupData]?.trim()) {
        newErrors[field] = `${field.replace(/([A-Z])/g, ' $1').toLowerCase()} is required`;
      }
    });
    
    // Email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Phone number validation
    if (formData.phoneNumber && !/^\d{10,}$/.test(formData.phoneNumber.replace(/\D/g, ''))) {
      newErrors.phoneNumber = 'Please enter a valid phone number';
    }
    
    // Password validation
    if (formData.password) {
      const hasValidPassword = passwordRequirements.every(req => req.test(formData.password));
      if (!hasValidPassword) {
        newErrors.password = 'Password does not meet requirements';
      }
    }
    
    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Date validation
    if (formData.dateOfBirth) {
      const birthDate = new Date(formData.dateOfBirth);
      const age = (new Date().getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 18) {
        newErrors.dateOfBirth = 'Must be at least 18 years old';
      }
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
      const response = await fetch('/api/auth/register-notary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
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
        } else if (data.errors) {
          const fieldErrors: FormErrors = {};
          data.errors.forEach((error: any) => {
            fieldErrors[error.field] = error.message;
          });
          setErrors(fieldErrors);
        } else {
          setErrors({ general: data.message || 'Registration failed' });
        }
        return;
      }

      toast({
        title: "Application Submitted!",
        description: "Your notary application has been submitted and is pending admin approval. You'll receive an email notification once approved.",
      });

      // Redirect to a success page or login
      setLocation('/signup-success?type=notary');

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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => setLocation('/')}
          className="mb-4 text-blue-600 hover:text-green-700"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>

        <Card className="shadow-lg border-0">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto mb-4 p-3 bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center">
              <Shield className="h-8 w-8 text-gray-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">Join Our Notary Network</CardTitle>
            <CardDescription className="text-gray-600">
              Become a certified notary on our platform and start earning with flexible scheduling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {errors.general && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                  {errors.general}
                </div>
              )}

              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Award className="mr-2 h-5 w-5 text-blue-600" />
                  Personal Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className={errors.firstName ? 'border-red-500' : ''}
                    />
                    {errors.firstName && <p className="text-red-500 text-sm">{errors.firstName}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className={errors.lastName ? 'border-red-500' : ''}
                    />
                    {errors.lastName && <p className="text-red-500 text-sm">{errors.lastName}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={errors.email ? 'border-red-500' : ''}
                    />
                    {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
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
                    {errors.phoneNumber && <p className="text-red-500 text-sm">{errors.phoneNumber}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className={errors.dateOfBirth ? 'border-red-500' : ''}
                  />
                  {errors.dateOfBirth && <p className="text-red-500 text-sm">{errors.dateOfBirth}</p>}
                </div>
              </div>

              {/* Address Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Address Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="address1">Street Address</Label>
                  <Input
                    id="address1"
                    name="address1"
                    value={formData.address1}
                    onChange={handleInputChange}
                    className={errors.address1 ? 'border-red-500' : ''}
                  />
                  {errors.address1 && <p className="text-red-500 text-sm">{errors.address1}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address2">Apartment, suite, etc. (optional)</Label>
                  <Input
                    id="address2"
                    name="address2"
                    value={formData.address2}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      className={errors.city ? 'border-red-500' : ''}
                    />
                    {errors.city && <p className="text-red-500 text-sm">{errors.city}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Select value={formData.state} onValueChange={(value) => handleSelectChange('state', value)}>
                      <SelectTrigger className={errors.state ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.state && <p className="text-red-500 text-sm">{errors.state}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleInputChange}
                      className={errors.zipCode ? 'border-red-500' : ''}
                    />
                    {errors.zipCode && <p className="text-red-500 text-sm">{errors.zipCode}</p>}
                  </div>
                </div>
              </div>

              {/* Notary Credentials */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Notary Credentials</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="commissionNumber">Commission Number</Label>
                    <Input
                      id="commissionNumber"
                      name="commissionNumber"
                      value={formData.commissionNumber}
                      onChange={handleInputChange}
                      className={errors.commissionNumber ? 'border-red-500' : ''}
                    />
                    {errors.commissionNumber && <p className="text-red-500 text-sm">{errors.commissionNumber}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="commissionState">Commission State</Label>
                    <Select value={formData.commissionState} onValueChange={(value) => handleSelectChange('commissionState', value)}>
                      <SelectTrigger className={errors.commissionState ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.commissionState && <p className="text-red-500 text-sm">{errors.commissionState}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="commissionExpiration">Commission Expiration</Label>
                    <Input
                      id="commissionExpiration"
                      name="commissionExpiration"
                      type="date"
                      value={formData.commissionExpiration}
                      onChange={handleInputChange}
                      className={errors.commissionExpiration ? 'border-red-500' : ''}
                    />
                    {errors.commissionExpiration && <p className="text-red-500 text-sm">{errors.commissionExpiration}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="yearsOfExperience">Years of Experience</Label>
                    <Input
                      id="yearsOfExperience"
                      name="yearsOfExperience"
                      type="number"
                      min="0"
                      value={formData.yearsOfExperience}
                      onChange={handleInputChange}
                      className={errors.yearsOfExperience ? 'border-red-500' : ''}
                    />
                    {errors.yearsOfExperience && <p className="text-red-500 text-sm">{errors.yearsOfExperience}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notaryType">Notary Type</Label>
                  <Select value={formData.notaryType} onValueChange={(value) => handleSelectChange('notaryType', value as 'contractor' | 'subscriber' | 'both')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contractor">Contractor - Get assigned jobs</SelectItem>
                      <SelectItem value="subscriber">Subscriber - Can create jobs</SelectItem>
                      <SelectItem value="both">Both - Can create and get assigned jobs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Professional Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Professional Details</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="specializations">Specializations (optional)</Label>
                  <Input
                    id="specializations"
                    name="specializations"
                    value={formData.specializations}
                    onChange={handleInputChange}
                    placeholder="e.g., Real estate, Legal documents, Healthcare"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workingHours">Preferred Working Hours (optional)</Label>
                  <Input
                    id="workingHours"
                    name="workingHours"
                    value={formData.workingHours}
                    onChange={handleInputChange}
                    placeholder="e.g., Monday-Friday 9AM-5PM"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Professional Bio (optional)</Label>
                  <Textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleInputChange}
                    placeholder="Tell us about your experience and what makes you a great notary..."
                    rows={4}
                  />
                </div>
              </div>

              {/* Password Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Account Security</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleInputChange}
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
                    {errors.password && <p className="text-red-500 text-sm">{errors.password}</p>}
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
                    {errors.confirmPassword && <p className="text-red-500 text-sm">{errors.confirmPassword}</p>}
                  </div>
                </div>

                {/* Password Requirements */}
                {formData.password && (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm font-medium text-gray-700 mb-2">Password Requirements:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
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
              </div>

              <Button 
                type="submit" 
                className="w-full text-white" 
                style={{backgroundColor: '#00335b'}} 
                onMouseEnter={(e) => e.target.style.backgroundColor = '#002347'} 
                onMouseLeave={(e) => e.target.style.backgroundColor = '#00335b'}
                disabled={isLoading}
              >
                {isLoading ? 'Submitting Application...' : 'Submit Notary Application'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <button
                  onClick={() => setLocation('/login')}
                  className="text-blue-600 hover:text-green-700 font-medium"
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