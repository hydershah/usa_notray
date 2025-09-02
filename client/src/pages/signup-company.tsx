import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Building2, User, MapPin } from 'lucide-react';

interface CompanySignupData {
  companyName: string;
  primaryUserName: string;
  primaryUserEmail: string;
  primaryUserPassword: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zipCode: string;
  paymentMethod: 'invoiced' | 'qualia' | 'pre_pay';
  contactName: string;
  email: string;
  phoneNumber: string;
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

export default function SignupCompany() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<CompanySignupData>({
    companyName: '',
    primaryUserName: '',
    primaryUserEmail: '',
    primaryUserPassword: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    paymentMethod: 'invoiced',
    contactName: '',
    email: '',
    phoneNumber: '',
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      'companyName', 'primaryUserName', 'primaryUserEmail', 'primaryUserPassword',
      'address1', 'city', 'state', 'zipCode', 'contactName', 'email'
    ];

    requiredFields.forEach(field => {
      if (!formData[field as keyof CompanySignupData]?.trim()) {
        newErrors[field] = `${field.replace(/([A-Z])/g, ' $1').toLowerCase()} is required`;
      }
    });
    
    // Email validation
    if (formData.primaryUserEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.primaryUserEmail)) {
      newErrors.primaryUserEmail = 'Please enter a valid email address';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Password validation
    if (formData.primaryUserPassword && formData.primaryUserPassword.length < 6) {
      newErrors.primaryUserPassword = 'Password must be at least 6 characters';
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
      const response = await fetch('/api/auth/register-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          if (data.message.includes('Company')) {
            setErrors({ companyName: 'A company with this name already exists' });
          } else if (data.error === 'EMAIL_ALREADY_EXISTS') {
            // Enhanced security message for duplicate emails
            setErrors({ 
              primaryUserEmail: data.message || 'An account with this email address already exists. Email addresses must be unique across all account types.',
              general: data.details?.suggestion || 'Please use a different email address or sign in to your existing account.'
            });
            toast({
              variant: "destructive",
              title: "Email Already Registered",
              description: "This email is already associated with an account. Please use a different email or sign in to your existing account.",
            });
          } else {
            setErrors({ primaryUserEmail: 'An account with this email already exists' });
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
        title: "Company Registered!",
        description: "Your company has been registered and is pending admin approval. You'll receive an email notification once approved.",
      });

      // Redirect to a success page
      setLocation('/signup-success?type=company');

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
      <div className="w-full max-w-2xl">
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
            <div className="mx-auto mb-4 p-3 bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-gray-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">Register Your Title Company</CardTitle>
            <CardDescription className="text-gray-600">
              Join our network of title companies and streamline your notarization process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {errors.general && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                  {errors.general}
                </div>
              )}

              {/* Company Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Building2 className="mr-2 h-5 w-5 text-blue-600" />
                  Company Information
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    placeholder="Enter your company name"
                    className={errors.companyName ? 'border-red-500' : ''}
                  />
                  {errors.companyName && <p className="text-red-500 text-sm">{errors.companyName}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Primary Contact Name</Label>
                    <Input
                      id="contactName"
                      name="contactName"
                      value={formData.contactName}
                      onChange={handleInputChange}
                      placeholder="Contact person name"
                      className={errors.contactName ? 'border-red-500' : ''}
                    />
                    {errors.contactName && <p className="text-red-500 text-sm">{errors.contactName}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Company Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="company@example.com"
                      className={errors.email ? 'border-red-500' : ''}
                    />
                    {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Company Phone (optional)</Label>
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
                  />
                </div>
              </div>

              {/* Company Address */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <MapPin className="mr-2 h-5 w-5 text-blue-600" />
                  Company Address
                </h3>
                
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
                  <Label htmlFor="address2">Suite, Floor, etc. (optional)</Label>
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

              {/* Primary User Account */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <User className="mr-2 h-5 w-5 text-blue-600" />
                  Primary Manager Account
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="primaryUserName">Manager Full Name</Label>
                  <Input
                    id="primaryUserName"
                    name="primaryUserName"
                    value={formData.primaryUserName}
                    onChange={handleInputChange}
                    placeholder="Full name of the primary manager"
                    className={errors.primaryUserName ? 'border-red-500' : ''}
                  />
                  {errors.primaryUserName && <p className="text-red-500 text-sm">{errors.primaryUserName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primaryUserEmail">Manager Email</Label>
                  <Input
                    id="primaryUserEmail"
                    name="primaryUserEmail"
                    type="email"
                    value={formData.primaryUserEmail}
                    onChange={handleInputChange}
                    placeholder="manager@company.com"
                    className={errors.primaryUserEmail ? 'border-red-500' : ''}
                  />
                  {errors.primaryUserEmail && <p className="text-red-500 text-sm">{errors.primaryUserEmail}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primaryUserPassword">Manager Password</Label>
                  <Input
                    id="primaryUserPassword"
                    name="primaryUserPassword"
                    type="password"
                    value={formData.primaryUserPassword}
                    onChange={handleInputChange}
                    placeholder="Create a secure password"
                    className={errors.primaryUserPassword ? 'border-red-500' : ''}
                  />
                  {errors.primaryUserPassword && <p className="text-red-500 text-sm">{errors.primaryUserPassword}</p>}
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Payment Method</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Preferred Payment Method</Label>
                  <Select value={formData.paymentMethod} onValueChange={(value) => handleSelectChange('paymentMethod', value as 'invoiced' | 'qualia' | 'pre_pay')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invoiced">Invoiced</SelectItem>
                      <SelectItem value="qualia">Qualia Integration</SelectItem>
                      <SelectItem value="pre_pay">Pre-paid Credits</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700" 
                disabled={isLoading}
              >
                {isLoading ? 'Registering Company...' : 'Register Company'}
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