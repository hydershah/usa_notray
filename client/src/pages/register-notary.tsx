import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { NotebookPen, ArrowLeft, Eye, EyeOff, Check, X, Shield, Award, FileText } from 'lucide-react';

export default function RegisterNotary() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
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
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

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
  };

  const passwordRequirements = [
    { test: (pwd: string) => pwd.length >= 8, text: 'At least 8 characters' },
    { test: (pwd: string) => /[A-Z]/.test(pwd), text: 'One uppercase letter' },
    { test: (pwd: string) => /[a-z]/.test(pwd), text: 'One lowercase letter' },
    { test: (pwd: string) => /\d/.test(pwd), text: 'One number' },
    { test: (pwd: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd), text: 'One special character' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const newErrors: Record<string, string> = {};
    
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.zipCode.trim()) newErrors.zipCode = 'ZIP code is required';
    if (!formData.commissionNumber.trim()) newErrors.commissionNumber = 'Commission number is required';
    if (!formData.commissionState.trim()) newErrors.commissionState = 'Commission state is required';
    if (!formData.commissionExpiration) newErrors.commissionExpiration = 'Commission expiration is required';
    if (!formData.yearsOfExperience.trim()) newErrors.yearsOfExperience = 'Years of experience is required';
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!acceptTerms) {
      newErrors.terms = 'Please accept the terms and conditions';
    }

    // Check password requirements
    const passwordValid = passwordRequirements.every(req => req.test(formData.password));
    if (!passwordValid) {
      newErrors.password = 'Password does not meet requirements';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
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
      const response = await fetch('/api/auth/register-notary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phoneNumber: formData.phone,
          password: formData.password,
          address1: formData.address,
          address2: '',
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          dateOfBirth: formData.dateOfBirth,
          commissionNumber: formData.commissionNumber,
          commissionState: formData.commissionState,
          commissionExpiration: formData.commissionExpiration,
          yearsOfExperience: formData.yearsOfExperience,
          specializations: formData.specializations,
          workingHours: formData.workingHours,
          bio: formData.bio,
          notaryType: 'contractor'
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Registration Successful!",
          description: "Welcome to Sharp Note! Your account will be reviewed and approved within 24-48 hours.",
        });
        setLocation('/login');
      } else {
        // Enhanced error handling for duplicate emails
        if (response.status === 409 && data.error === 'EMAIL_ALREADY_EXISTS') {
          setErrors({ 
            email: data.message || 'An account with this email address already exists. Email addresses must be unique across all account types.'
          });
          toast({
            variant: "destructive",
            title: "Email Already Registered",
            description: "This email is already associated with an account. Please use a different email or sign in to your existing account.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Registration Failed",
            description: data.message || "Unable to create account. Please try again.",
          });
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: error.message || "Unable to connect. Please try again.",
      });
    } finally {
      setIsLoading(false);
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
                src="/sharpnote_-_blue_background.jpg" 
                alt="Sharp Note Logo" 
                className="h-32 w-auto mx-auto mb-6 object-contain"
              />
              <h1 className="text-4xl font-bold mb-2">Join Our Network</h1>
              <p className="text-xl text-gray-200">Professional Notary Services</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Shield className="h-8 w-8 text-white" />
                <div className="text-left">
                  <p className="font-semibold text-white">Secure Platform</p>
                  <p className="text-sm text-gray-300">Work with confidence on our secure platform</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <Award className="h-8 w-8 text-white" />
                <div className="text-left">
                  <p className="font-semibold text-white">Flexible Schedule</p>
                  <p className="text-sm text-gray-300">Work when you want, where you want</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <FileText className="h-8 w-8 text-white" />
                <div className="text-left">
                  <p className="font-semibold text-white">Steady Income</p>
                  <p className="text-sm text-gray-300">Earn competitive fees for your services</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="absolute top-20 left-20 w-32 h-32 bg-white/5 rounded-full blur-xl" />
        <div className="absolute bottom-20 right-20 w-24 h-24 bg-white/5 rounded-full blur-xl" />
      </div>

      {/* Right Side - Registration Form */}
      <div className="flex-1 flex items-start lg:items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-5xl max-h-screen overflow-y-auto">
          <Card className="shadow-2xl border-0 bg-white my-4 lg:my-8 mx-2">
            <CardHeader className="text-center pb-6">
              <div className="lg:hidden mb-4">
                <img 
                  src="/sharpnote_-_blue_background.jpg" 
                  alt="Sharp Note Logo" 
                  className="h-16 w-auto mx-auto mb-2 object-contain"
                />
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900">
                Join as a Notary
              </CardTitle>
              <CardDescription className="text-gray-600">
                Apply to become a verified notary on Sharp Note
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6 sm:space-y-8 px-6 sm:px-8 lg:px-12 pb-6 sm:pb-8">
              <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6" noValidate>
                {/* Personal Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Personal Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                        First Name
                      </Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        placeholder="John"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        required
                        className={`h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.firstName ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {errors.firstName && <p className="text-red-600 text-xs mt-1">{errors.firstName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                        Last Name
                      </Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        placeholder="Doe"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        required
                        className={`h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.lastName ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {errors.lastName && <p className="text-red-600 text-xs mt-1">{errors.lastName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth" className="text-sm font-medium text-gray-700">
                        Date of Birth
                      </Label>
                      <Input
                        id="dateOfBirth"
                        name="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                        required
                        className={`h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.dateOfBirth ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {errors.dateOfBirth && <p className="text-red-600 text-xs mt-1">{errors.dateOfBirth}</p>}
                    </div>
                  </div>
                </div>

                {/* Contact Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Contact Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className={`h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                        className={`h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.phone ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone}</p>}
                    </div>
                  </div>
                </div>

                {/* Address Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Address Information</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                        Street Address
                      </Label>
                      <Input
                        id="address"
                        name="address"
                        placeholder="123 Main St"
                        value={formData.address}
                        onChange={handleInputChange}
                        required
                        className={`h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.address ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {errors.address && <p className="text-red-600 text-xs mt-1">{errors.address}</p>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city" className="text-sm font-medium text-gray-700">
                          City
                        </Label>
                        <Input
                          id="city"
                          name="city"
                          placeholder="New York"
                          value={formData.city}
                          onChange={handleInputChange}
                          required
                          className={`h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.city ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                        />
                        {errors.city && <p className="text-red-600 text-xs mt-1">{errors.city}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state" className="text-sm font-medium text-gray-700">
                          State
                        </Label>
                        <Input
                          id="state"
                          name="state"
                          placeholder="NY"
                          value={formData.state}
                          onChange={handleInputChange}
                          required
                          className={`h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.state ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                        />
                        {errors.state && <p className="text-red-600 text-xs mt-1">{errors.state}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zipCode" className="text-sm font-medium text-gray-700">
                          ZIP Code
                        </Label>
                        <Input
                          id="zipCode"
                          name="zipCode"
                          placeholder="10001"
                          value={formData.zipCode}
                          onChange={handleInputChange}
                          required
                          className={`h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.zipCode ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                        />
                        {errors.zipCode && <p className="text-red-600 text-xs mt-1">{errors.zipCode}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notary Credentials Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Notary Credentials</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="commissionNumber" className="text-sm font-medium text-gray-700">
                        Commission Number
                      </Label>
                      <Input
                        id="commissionNumber"
                        name="commissionNumber"
                        placeholder="Your notary commission number"
                        value={formData.commissionNumber}
                        onChange={handleInputChange}
                        required
                        className={`h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.commissionNumber ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {errors.commissionNumber && <p className="text-red-600 text-xs mt-1">{errors.commissionNumber}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="commissionState" className="text-sm font-medium text-gray-700">
                        Commission State
                      </Label>
                      <Select onValueChange={(value) => handleSelectChange('commissionState', value)}>
                        <SelectTrigger className={`h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.commissionState ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AL">Alabama</SelectItem>
                          <SelectItem value="AK">Alaska</SelectItem>
                          <SelectItem value="AZ">Arizona</SelectItem>
                          <SelectItem value="AR">Arkansas</SelectItem>
                          <SelectItem value="CA">California</SelectItem>
                          <SelectItem value="CO">Colorado</SelectItem>
                          <SelectItem value="CT">Connecticut</SelectItem>
                          <SelectItem value="DE">Delaware</SelectItem>
                          <SelectItem value="FL">Florida</SelectItem>
                          <SelectItem value="GA">Georgia</SelectItem>
                          <SelectItem value="HI">Hawaii</SelectItem>
                          <SelectItem value="ID">Idaho</SelectItem>
                          <SelectItem value="IL">Illinois</SelectItem>
                          <SelectItem value="IN">Indiana</SelectItem>
                          <SelectItem value="IA">Iowa</SelectItem>
                          <SelectItem value="KS">Kansas</SelectItem>
                          <SelectItem value="KY">Kentucky</SelectItem>
                          <SelectItem value="LA">Louisiana</SelectItem>
                          <SelectItem value="ME">Maine</SelectItem>
                          <SelectItem value="MD">Maryland</SelectItem>
                          <SelectItem value="MA">Massachusetts</SelectItem>
                          <SelectItem value="MI">Michigan</SelectItem>
                          <SelectItem value="MN">Minnesota</SelectItem>
                          <SelectItem value="MS">Mississippi</SelectItem>
                          <SelectItem value="MO">Missouri</SelectItem>
                          <SelectItem value="MT">Montana</SelectItem>
                          <SelectItem value="NE">Nebraska</SelectItem>
                          <SelectItem value="NV">Nevada</SelectItem>
                          <SelectItem value="NH">New Hampshire</SelectItem>
                          <SelectItem value="NJ">New Jersey</SelectItem>
                          <SelectItem value="NM">New Mexico</SelectItem>
                          <SelectItem value="NY">New York</SelectItem>
                          <SelectItem value="NC">North Carolina</SelectItem>
                          <SelectItem value="ND">North Dakota</SelectItem>
                          <SelectItem value="OH">Ohio</SelectItem>
                          <SelectItem value="OK">Oklahoma</SelectItem>
                          <SelectItem value="OR">Oregon</SelectItem>
                          <SelectItem value="PA">Pennsylvania</SelectItem>
                          <SelectItem value="RI">Rhode Island</SelectItem>
                          <SelectItem value="SC">South Carolina</SelectItem>
                          <SelectItem value="SD">South Dakota</SelectItem>
                          <SelectItem value="TN">Tennessee</SelectItem>
                          <SelectItem value="TX">Texas</SelectItem>
                          <SelectItem value="UT">Utah</SelectItem>
                          <SelectItem value="VT">Vermont</SelectItem>
                          <SelectItem value="VA">Virginia</SelectItem>
                          <SelectItem value="WA">Washington</SelectItem>
                          <SelectItem value="WV">West Virginia</SelectItem>
                          <SelectItem value="WI">Wisconsin</SelectItem>
                          <SelectItem value="WY">Wyoming</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="commissionExpiration" className="text-sm font-medium text-gray-700">
                        Commission Expiration Date
                      </Label>
                      <Input
                        id="commissionExpiration"
                        name="commissionExpiration"
                        type="date"
                        value={formData.commissionExpiration}
                        onChange={handleInputChange}
                        required
                        className={`h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.commissionExpiration ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {errors.commissionExpiration && <p className="text-red-600 text-xs mt-1">{errors.commissionExpiration}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="yearsOfExperience" className="text-sm font-medium text-gray-700">
                        Years of Experience
                      </Label>
                      <Select onValueChange={(value) => handleSelectChange('yearsOfExperience', value)}>
                        <SelectTrigger className={`h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.yearsOfExperience ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}>
                          <SelectValue placeholder="Select experience level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0-1">0-1 years</SelectItem>
                          <SelectItem value="1-3">1-3 years</SelectItem>
                          <SelectItem value="3-5">3-5 years</SelectItem>
                          <SelectItem value="5-10">5-10 years</SelectItem>
                          <SelectItem value="10+">10+ years</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.yearsOfExperience && <p className="text-red-600 text-xs mt-1">{errors.yearsOfExperience}</p>}
                    </div>
                  </div>
                  {errors.commissionState && <p className="text-red-600 text-xs mt-1">{errors.commissionState}</p>}
                </div>

                {/* Security Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Security</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a strong password"
                          value={formData.password}
                          onChange={handleInputChange}
                          required
                          className={`h-11 pr-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                        Confirm Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm your password"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          required
                          className={`h-11 pr-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors ${errors.confirmPassword ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                          aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.confirmPassword && <p className="text-red-600 text-xs mt-1">{errors.confirmPassword}</p>}
                      {formData.confirmPassword && (
                        <div className={`flex items-center gap-2 text-sm mt-2 p-2 rounded ${formData.password === formData.confirmPassword ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`} role="status" aria-live="polite">
                          {formData.password === formData.confirmPassword ? <Check className="h-4 w-4" aria-label="Success" /> : <X className="h-4 w-4" aria-label="Error" />}
                          <span>{formData.password === formData.confirmPassword ? 'Passwords match' : 'Passwords do not match'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {formData.password && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border" role="region" aria-label="Password requirements">
                      <p className="text-sm font-medium text-gray-700 mb-3">Password Requirements:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                        {passwordRequirements.map((req, index) => (
                          <div key={index} className={`flex items-center gap-2 ${req.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}>
                            {req.test(formData.password) ? <Check className="h-4 w-4" aria-label="Requirement met" /> : <X className="h-4 w-4" aria-label="Requirement not met" />}
                            <span>{req.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className={`flex items-start space-x-3 p-4 bg-gray-50 rounded-lg border ${errors.terms ? 'border-red-500 bg-red-50' : ''}`}>
                  <Checkbox 
                    id="acceptTerms" 
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                    className="mt-1"
                  />
                  <div>
                    <Label htmlFor="acceptTerms" className="text-sm text-gray-700 leading-relaxed">
                      I agree to the{' '}
                      <Button variant="link" className="p-0 h-auto text-blue-600 hover:text-blue-800 underline">
                        Terms of Service
                      </Button>{' '}
                      and{' '}
                      <Button variant="link" className="p-0 h-auto text-blue-600 hover:text-blue-800 underline">
                        Privacy Policy
                      </Button>
                    </Label>
                    {errors.terms && <p className="text-red-600 text-xs mt-1">{errors.terms}</p>}
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-gradient-to-r from-gray-900 to-black hover:from-black hover:to-gray-900 text-white font-medium rounded-lg shadow-lg transition-all duration-200 transform hover:scale-[1.02]" 
                  disabled={isLoading || !acceptTerms}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating Account...
                    </div>
                  ) : 'Apply to Join'}
                </Button>
              </form>
              
              <div className="text-center pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-4">
                  Already have an account?
                </p>
                <Button 
                  variant="ghost" 
                  onClick={() => setLocation('/login')}
                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 