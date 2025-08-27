import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { 
  User, 
  MapPin, 
  Phone, 
  Shield,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Clock,
  AlertCircle,
  FileText,
  Upload,
  Calendar,
  DollarSign,
  Lock,
  LogOut,
  Building,
  CreditCard,
  Pencil,
  Type,
  Star,
  Plus,
  Eye,
  Trash2,
  FileUp,
  Globe,
  X
} from 'lucide-react';

interface NotaryProfileCompletionOverlayProps {
  isOpen: boolean;
  onComplete: () => void;
}

interface NotaryProfileForm {
  // Personal Information
  firstName: string;
  lastName: string;
  phoneNumber: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zipCode: string;
  
  // Notary Credentials
  title: string;
  nameOnCommission: string;
  commissionNumber: string;
  commissionExpiration: string;
  commissionState: string;
  commissionCounty: string;
  disclosure: string;
  
  // Commission Address
  commissionAddress1: string;
  commissionAddress2: string;
  commissionCity: string;
  commissionZipCode: string;
  
  // Insurance & Bond
  eoInsuranceCompany: string;
  eoInsuranceAmount: string;
  eoInsuranceExpiration: string;
  bondCompanyName: string;
  bondAmount: string;
  bondExpiration: string;
  
  // Digital Certificate
  digitalCertificateExpiration: string;
  publicCertificatePassword: string;
  
  // NSA Certification
  signingAgentCertified: boolean;
  signingAgentExpirationDate: string;
  
  // Languages
  foreignLanguages: string[];
}

interface FileUploadStatus {
  notaryCommissionFile: File | null;
  eoInsuranceFile: File | null;
  publicCertificateFile: File | null;
  bondFile: File | null;
  signingAgentFile: File | null;
}

interface FormErrors {
  [key: string]: string;
}

interface UserSignature {
  id: string;
  name: string;
  type: 'uploaded' | 'drawn' | 'generated';
  imageUrl: string;
  isDefault: boolean;
  createdAt: string;
  metadata?: {
    originalName?: string;
    fontFamily?: string;
    style?: string;
  };
}

interface NotaryStamp {
  id: string;
  imageUrl: string;
  isActive: boolean;
  uploadedAt: string;
}

type CompletionStep = 'personal' | 'credentials' | 'documents' | 'signatures' | 'complete';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const LANGUAGES = [
  'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Mandarin', 'Japanese', 'Korean', 'Russian', 'Arabic'
];

export function NotaryProfileCompletionOverlay({ isOpen, onComplete }: NotaryProfileCompletionOverlayProps) {
  const { user, refetch, logout } = useAuth();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<CompletionStep>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileForm, setProfileForm] = useState<NotaryProfileForm>({
    // Personal Information
    firstName: '',
    lastName: '',
    phoneNumber: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    
    // Notary Credentials
    title: 'Notary Public',
    nameOnCommission: '',
    commissionNumber: '',
    commissionExpiration: '',
    commissionState: '',
    commissionCounty: '',
    disclosure: 'Default Disclosure Text',
    
    // Commission Address
    commissionAddress1: '',
    commissionAddress2: '',
    commissionCity: '',
    commissionZipCode: '',
    
    // Insurance & Bond
    eoInsuranceCompany: '',
    eoInsuranceAmount: '',
    eoInsuranceExpiration: '',
    bondCompanyName: '',
    bondAmount: '',
    bondExpiration: '',
    
    // Digital Certificate
    digitalCertificateExpiration: '',
    publicCertificatePassword: '',
    
    // NSA Certification
    signingAgentCertified: false,
    signingAgentExpirationDate: '',
    
    // Languages
    foreignLanguages: []
  });

  const [uploadedFiles, setUploadedFiles] = useState<FileUploadStatus>({
    notaryCommissionFile: null,
    eoInsuranceFile: null,
    publicCertificateFile: null,
    bondFile: null,
    signingAgentFile: null
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const hasPrefilledRef = useRef(false);
  
  // Signature & Stamp Management State
  const [signatures, setSignatures] = useState<UserSignature[]>([]);
  const [stamps, setStamps] = useState<NotaryStamp[]>([]);
  const [signatureLoading, setSignatureLoading] = useState(true);
  const [stampLoading, setStampLoading] = useState(true);
  const [showSignatureUpload, setShowSignatureUpload] = useState(false);
  const [showStampUpload, setShowStampUpload] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string>('');
  const [stampFile, setStampFile] = useState<File | null>(null);
  const [stampPreview, setStampPreview] = useState<string>('');

  // Check completion status and pre-fill form
  useEffect(() => {
    if (user && isOpen && !hasPrefilledRef.current) {
      hasPrefilledRef.current = true;
      
      // Pre-fill form with existing user data
      setProfileForm(prev => ({
        ...prev,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phoneNumber: user.phoneNumber || user.phone || '',
        address1: user.address1 || '',
        address2: user.address2 || '',
        city: user.city || '',
        state: user.state || '',
        zipCode: user.zipCode || '',
        nameOnCommission: user.nameOnCommission || '',
        commissionNumber: user.commissionNumber || '',
        commissionExpiration: user.commissionExpiration || '',
        commissionState: user.commissionState || user.state || '',
        commissionCounty: user.commissionCounty || user.county || '',
        disclosure: user.disclosure || 'Default Disclosure Text',
        commissionAddress1: user.commissionAddress1 || user.address1 || '',
        commissionAddress2: user.commissionAddress2 || user.address2 || '',
        commissionCity: user.commissionCity || user.city || '',
        commissionZipCode: user.commissionZipCode || user.zipCode || '',
        eoInsuranceCompany: user.eoInsuranceCompany || '',
        eoInsuranceAmount: user.eoInsuranceAmount ? (user.eoInsuranceAmount / 100).toString() : '',
        eoInsuranceExpiration: user.eoInsuranceExpiration || '',
        bondCompanyName: user.bondCompanyName || '',
        bondAmount: user.bondAmount ? (user.bondAmount / 100).toString() : '',
        bondExpiration: user.bondExpiration || '',
        digitalCertificateExpiration: user.digitalCertificateExpiration || '',
        signingAgentCertified: user.signingAgentCertified || false,
        signingAgentExpirationDate: user.signingAgentExpirationDate || '',
        foreignLanguages: user.foreignLanguages || []
      }));
      
      // Determine starting step based on completion
      const hasPersonalInfo = user.firstName && user.lastName && user.phoneNumber && user.address1;
      const hasCredentials = user.nameOnCommission && user.commissionNumber && user.commissionExpiration;
      
      if (!hasPersonalInfo) {
        setCurrentStep('personal');
      } else if (!hasCredentials) {
        setCurrentStep('credentials');
      } else {
        setCurrentStep('documents');
      }
    }
  }, [user, isOpen]);

  // Reset prefill flag when overlay closes
  useEffect(() => {
    if (!isOpen) {
      hasPrefilledRef.current = false;
    }
  }, [isOpen]);

  const validateField = (field: string, value: any): string => {
    switch (field) {
      case 'firstName':
      case 'lastName':
        return value?.trim() ? '' : `${field === 'firstName' ? 'First' : 'Last'} name is required`;
      case 'phoneNumber':
        const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
        if (!value?.trim()) return 'Phone number is required';
        if (!phoneRegex.test(value.replace(/\D/g, ''))) return 'Enter a valid 10-digit phone number';
        return '';
      case 'address1':
        return value?.trim() ? '' : 'Street address is required';
      case 'city':
        return value?.trim() ? '' : 'City is required';
      case 'state':
        return value?.trim() ? '' : 'State is required';
      case 'zipCode':
        const zipRegex = /^\d{5}(-\d{4})?$/;
        if (!value?.trim()) return 'ZIP code is required';
        if (!zipRegex.test(value)) return 'Enter a valid ZIP code';
        return '';
      case 'nameOnCommission':
        return value?.trim() ? '' : 'Name on commission is required';
      case 'commissionNumber':
        return value?.trim() ? '' : 'Commission number is required';
      case 'commissionExpiration':
        if (!value?.trim()) return 'Commission expiration is required';
        const expDate = new Date(value);
        if (isNaN(expDate.getTime())) return 'Enter a valid date';
        if (expDate <= new Date()) return 'Commission must not be expired';
        return '';
      case 'commissionState':
        return value?.trim() ? '' : 'Commission state is required';
      default:
        return '';
    }
  };

  const validateCurrentStep = (): boolean => {
    const errors: FormErrors = {};
    
    if (currentStep === 'personal') {
      const personalFields = ['firstName', 'lastName', 'phoneNumber', 'address1', 'city', 'state', 'zipCode'];
      personalFields.forEach(field => {
        const error = validateField(field, profileForm[field as keyof NotaryProfileForm]);
        if (error) errors[field] = error;
      });
    } else if (currentStep === 'credentials') {
      const credentialFields = ['nameOnCommission', 'commissionNumber', 'commissionExpiration', 'commissionState'];
      credentialFields.forEach(field => {
        const error = validateField(field, profileForm[field as keyof NotaryProfileForm]);
        if (error) errors[field] = error;
      });
    } else if (currentStep === 'signatures') {
      // Validation for signatures step - at least one signature is recommended
      if (signatures.length === 0) {
        toast({
          title: "No Signatures",
          description: "It's recommended to upload at least one signature before completing your profile.",
          variant: "default"
        });
      }
      // Stamps are not required but recommended for notaries
      if (stamps.length === 0) {
        toast({
          title: "No Stamp Uploaded",
          description: "It's recommended to upload your notary stamp before completing your profile.",
          variant: "default"
        });
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before continuing.",
        variant: "destructive",
      });
      return;
    }

    if (currentStep === 'personal') {
      setCurrentStep('credentials');
    } else if (currentStep === 'credentials') {
      setCurrentStep('documents');
    } else if (currentStep === 'documents') {
      setCurrentStep('signatures');
    } else if (currentStep === 'signatures') {
      await handleSubmitProfile();
    }
  };

  const handleBack = () => {
    if (currentStep === 'credentials') {
      setCurrentStep('personal');
    } else if (currentStep === 'documents') {
      setCurrentStep('credentials');
    } else if (currentStep === 'signatures') {
      setCurrentStep('documents');
    }
  };

  const handleFileUpload = (fileType: keyof FileUploadStatus, file: File | null) => {
    setUploadedFiles(prev => ({
      ...prev,
      [fileType]: file
    }));
  };

  const handleSubmitProfile = async () => {
    setIsSubmitting(true);
    
    try {
      const token = localStorage.getItem('token');
      
      // Upload files first if any
      const fileUploadResult: any = {};
      
      if (Object.values(uploadedFiles).some(file => file !== null)) {
        const formData = new FormData();
        Object.entries(uploadedFiles).forEach(([key, file]) => {
          if (file) {
            formData.append(key, file);
          }
        });

        const uploadResponse = await fetch('/api/notary/profile/upload-documents', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          Object.keys(uploadData.uploadedFiles || {}).forEach(fileType => {
            fileUploadResult[fileType] = uploadData.uploadedFiles[fileType].fileKey;
          });
        }
      }

      // Submit profile data
      const profileData = {
        ...profileForm,
        // Convert amounts to cents
        eoInsuranceAmount: profileForm.eoInsuranceAmount ? parseInt(profileForm.eoInsuranceAmount) * 100 : undefined,
        bondAmount: profileForm.bondAmount ? parseInt(profileForm.bondAmount) * 100 : undefined,
        // Add file paths from upload result
        ...fileUploadResult
      };

      const response = await fetch('/api/notary/profile/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to complete profile');
      }

      // Refresh user data
      await refetch?.();
      
      toast({
        title: "Profile Completed!",
        description: "Your notary profile has been submitted for approval.",
        className: "bg-green-50 border-green-200",
      });

      setCurrentStep('complete');
      onComplete();
      
    } catch (error) {
      console.error('Profile completion error:', error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Failed to complete profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Load signatures and stamps
  const loadSignatures = async () => {
    if (!user?.id) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${user.id}/signatures`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSignatures(data);
      }
    } catch (error) {
      console.error('Error loading signatures:', error);
    } finally {
      setSignatureLoading(false);
    }
  };

  const loadStamps = async () => {
    if (!user?.id) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/notary/${user.id}/stamps`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStamps(data.map((stamp: any) => ({
          id: stamp.id,
          imageUrl: stamp.imageUrl,
          isActive: stamp.isActive,
          uploadedAt: stamp.uploadedAt
        })));
      }
    } catch (error) {
      console.error('Error loading stamps:', error);
    } finally {
      setStampLoading(false);
    }
  };

  // Upload signature
  const handleSignatureUpload = async () => {
    if (!signatureFile || !user?.id) return;

    try {
      const formData = new FormData();
      formData.append('signature', signatureFile);
      formData.append('name', `Signature ${new Date().toLocaleDateString()}`);
      formData.append('type', 'uploaded');

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${user.id}/signatures`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        await loadSignatures();
        setShowSignatureUpload(false);
        setSignatureFile(null);
        setSignaturePreview('');
        toast({
          title: "Success",
          description: "Signature uploaded successfully"
        });
      }
    } catch (error) {
      console.error('Error uploading signature:', error);
      toast({
        title: "Error",
        description: "Failed to upload signature",
        variant: "destructive"
      });
    }
  };

  // Upload stamp
  const handleStampUpload = async () => {
    if (!stampFile || !user?.id) return;

    try {
      const formData = new FormData();
      formData.append('stamp', stampFile);

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/notary/${user.id}/stamps`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        await loadStamps();
        setShowStampUpload(false);
        setStampFile(null);
        setStampPreview('');
        toast({
          title: "Success",
          description: "Notary stamp uploaded successfully"
        });
      }
    } catch (error) {
      console.error('Error uploading stamp:', error);
      toast({
        title: "Error",
        description: "Failed to upload notary stamp",
        variant: "destructive"
      });
    }
  };

  // Handle file selection for signatures
  const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSignatureFile(file);
      const reader = new FileReader();
      reader.onload = () => setSignaturePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Handle file selection for stamps
  const handleStampFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setStampFile(file);
      const reader = new FileReader();
      reader.onload = () => setStampPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Load signatures and stamps when step changes to signatures
  useEffect(() => {
    if (currentStep === 'signatures' && user?.id) {
      loadSignatures();
      loadStamps();
    }
  }, [currentStep, user?.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Complete Notary Profile</h2>
                <p className="text-blue-100 text-sm">Required to access your dashboard and start signing jobs</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white hover:bg-white/20 hover:text-white"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex-shrink-0 bg-gray-50 px-6 py-4 border-b">
          <div className="flex items-center justify-center space-x-8">
            {[
              { key: 'personal', label: 'Personal Information', icon: User },
              { key: 'credentials', label: 'Notary Credentials', icon: Shield },
              { key: 'documents', label: 'Document Upload', icon: FileText },
              { key: 'signatures', label: 'Signatures & Stamps', icon: Pencil }
            ].map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.key;
              const isCompleted = (
                (step.key === 'personal' && ['credentials', 'documents', 'signatures', 'complete'].includes(currentStep)) ||
                (step.key === 'credentials' && ['documents', 'signatures', 'complete'].includes(currentStep)) ||
                (step.key === 'documents' && ['signatures', 'complete'].includes(currentStep)) ||
                (step.key === 'signatures' && currentStep === 'complete')
              );
              
              return (
                <div key={step.key} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isActive ? 'bg-blue-600 text-white' : 
                    isCompleted ? 'bg-green-600 text-white' :
                    'bg-gray-300 text-gray-600'
                  }`}>
                    {isCompleted ? <CheckCircle className="h-5 w-5" /> : index + 1}
                  </div>
                  <span className={`text-sm font-medium ${
                    isActive ? 'text-blue-600' : 
                    isCompleted ? 'text-green-600' :
                    'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                  {index < 3 && <ArrowRight className="h-4 w-4 text-gray-400 ml-4" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {currentStep === 'personal' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Personal Information
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Basic personal information for your notary profile.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Personal Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder="Enter your first name"
                      className={formErrors.firstName ? 'border-red-500' : ''}
                    />
                    {formErrors.firstName && (
                      <p className="text-sm text-red-600">{formErrors.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Enter your last name"
                      className={formErrors.lastName ? 'border-red-500' : ''}
                    />
                    {formErrors.lastName && (
                      <p className="text-sm text-red-600">{formErrors.lastName}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number *</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={profileForm.phoneNumber}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    placeholder="(555) 123-4567"
                    className={formErrors.phoneNumber ? 'border-red-500' : ''}
                  />
                  {formErrors.phoneNumber && (
                    <p className="text-sm text-red-600">{formErrors.phoneNumber}</p>
                  )}
                </div>

                {/* Address Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Address Information
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="address1">Address Line 1 *</Label>
                      <Input
                        id="address1"
                        value={profileForm.address1}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, address1: e.target.value }))}
                        placeholder="Street address"
                        className={formErrors.address1 ? 'border-red-500' : ''}
                      />
                      {formErrors.address1 && (
                        <p className="text-sm text-red-600">{formErrors.address1}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address2">Address Line 2</Label>
                      <Input
                        id="address2"
                        value={profileForm.address2}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, address2: e.target.value }))}
                        placeholder="Apartment, suite, unit, etc. (optional)"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          value={profileForm.city}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, city: e.target.value }))}
                          placeholder="City"
                          className={formErrors.city ? 'border-red-500' : ''}
                        />
                        {formErrors.city && (
                          <p className="text-sm text-red-600">{formErrors.city}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State *</Label>
                        <Select value={profileForm.state} onValueChange={(value) => setProfileForm(prev => ({ ...prev, state: value }))}>
                          <SelectTrigger className={formErrors.state ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {US_STATES.map(state => (
                              <SelectItem key={state} value={state}>{state}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {formErrors.state && (
                          <p className="text-sm text-red-600">{formErrors.state}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zipCode">ZIP Code *</Label>
                        <Input
                          id="zipCode"
                          value={profileForm.zipCode}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, zipCode: e.target.value }))}
                          placeholder="ZIP Code"
                          className={formErrors.zipCode ? 'border-red-500' : ''}
                        />
                        {formErrors.zipCode && (
                          <p className="text-sm text-red-600">{formErrors.zipCode}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 'credentials' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  Notary Credentials
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Your notary commission and certification information.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Basic Notary Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={profileForm.title}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Notary Public"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nameOnCommission">Name on Commission *</Label>
                    <Input
                      id="nameOnCommission"
                      value={profileForm.nameOnCommission}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, nameOnCommission: e.target.value }))}
                      placeholder="Full name as it appears on commission"
                      className={formErrors.nameOnCommission ? 'border-red-500' : ''}
                    />
                    {formErrors.nameOnCommission && (
                      <p className="text-sm text-red-600">{formErrors.nameOnCommission}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="commissionNumber">Commission Number *</Label>
                    <Input
                      id="commissionNumber"
                      value={profileForm.commissionNumber}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, commissionNumber: e.target.value }))}
                      placeholder="Your commission number"
                      className={formErrors.commissionNumber ? 'border-red-500' : ''}
                    />
                    {formErrors.commissionNumber && (
                      <p className="text-sm text-red-600">{formErrors.commissionNumber}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="commissionExpiration">Commission Expiration *</Label>
                    <Input
                      id="commissionExpiration"
                      type="date"
                      value={profileForm.commissionExpiration}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, commissionExpiration: e.target.value }))}
                      className={formErrors.commissionExpiration ? 'border-red-500' : ''}
                    />
                    {formErrors.commissionExpiration && (
                      <p className="text-sm text-red-600">{formErrors.commissionExpiration}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="commissionState">State *</Label>
                    <Select value={profileForm.commissionState} onValueChange={(value) => setProfileForm(prev => ({ ...prev, commissionState: value }))}>
                      <SelectTrigger className={formErrors.commissionState ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select commission state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.commissionState && (
                      <p className="text-sm text-red-600">{formErrors.commissionState}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="commissionCounty">County</Label>
                    <Input
                      id="commissionCounty"
                      value={profileForm.commissionCounty}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, commissionCounty: e.target.value }))}
                      placeholder="County of commission"
                    />
                  </div>
                </div>

                {/* Insurance Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    E&O Insurance Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="eoInsuranceCompany">Insurance Company</Label>
                      <Input
                        id="eoInsuranceCompany"
                        value={profileForm.eoInsuranceCompany}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, eoInsuranceCompany: e.target.value }))}
                        placeholder="Insurance company name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eoInsuranceAmount">Coverage Amount ($)</Label>
                      <Input
                        id="eoInsuranceAmount"
                        type="number"
                        value={profileForm.eoInsuranceAmount}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, eoInsuranceAmount: e.target.value }))}
                        placeholder="25000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eoInsuranceExpiration">Expiration Date</Label>
                      <Input
                        id="eoInsuranceExpiration"
                        type="date"
                        value={profileForm.eoInsuranceExpiration}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, eoInsuranceExpiration: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Bond Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Bond Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bondCompanyName">Bond Company</Label>
                      <Input
                        id="bondCompanyName"
                        value={profileForm.bondCompanyName}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, bondCompanyName: e.target.value }))}
                        placeholder="Bond company name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bondAmount">Bond Amount ($)</Label>
                      <Input
                        id="bondAmount"
                        type="number"
                        value={profileForm.bondAmount}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, bondAmount: e.target.value }))}
                        placeholder="10000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bondExpiration">Expiration Date</Label>
                      <Input
                        id="bondExpiration"
                        type="date"
                        value={profileForm.bondExpiration}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, bondExpiration: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* NSA Certification */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notary Signing Agent (NSA) Certification
                  </h3>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="signingAgentCertified"
                      checked={profileForm.signingAgentCertified}
                      onCheckedChange={(checked) => setProfileForm(prev => ({ ...prev, signingAgentCertified: checked as boolean }))}
                    />
                    <Label htmlFor="signingAgentCertified">I am a certified Notary Signing Agent</Label>
                  </div>
                  {profileForm.signingAgentCertified && (
                    <div className="space-y-2">
                      <Label htmlFor="signingAgentExpirationDate">NSA Certification Expiration</Label>
                      <Input
                        id="signingAgentExpirationDate"
                        type="date"
                        value={profileForm.signingAgentExpirationDate}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, signingAgentExpirationDate: e.target.value }))}
                      />
                    </div>
                  )}
                </div>

                {/* Default Disclosure Text */}
                <div className="space-y-2">
                  <Label htmlFor="disclosure">Default Disclosure Text</Label>
                  <Textarea
                    id="disclosure"
                    value={profileForm.disclosure}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, disclosure: e.target.value }))}
                    placeholder="Enter your default disclosure text for notarizations"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 'documents' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Document Upload
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Upload your required notary documents. All documents must be clear and legible.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Upload clear, high-quality documents. Accepted formats: PDF, JPG, PNG. For digital certificates: PFX, P12.
                  </AlertDescription>
                </Alert>

                {/* Document Upload Sections */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Commission Certificate */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-red-500" />
                      <Label className="font-medium">Commission Certificate *</Label>
                      <Badge variant="destructive">Required</Badge>
                    </div>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload('notaryCommissionFile', e.target.files?.[0] || null)}
                        className="hidden"
                        id="notaryCommissionFile"
                      />
                      <label htmlFor="notaryCommissionFile" className="cursor-pointer">
                        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          {uploadedFiles.notaryCommissionFile ? uploadedFiles.notaryCommissionFile.name : 'Click to upload commission certificate'}
                        </p>
                      </label>
                    </div>
                  </div>

                  {/* E&O Insurance */}
                                      <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-blue-500" />
                        <Label className="font-medium">E&O Insurance</Label>
                        <Badge variant="outline">Optional</Badge>
                      </div>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileUpload('eoInsuranceFile', e.target.files?.[0] || null)}
                          className="hidden"
                          id="eoInsuranceFile"
                        />
                        <label htmlFor="eoInsuranceFile" className="cursor-pointer">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">
                            {uploadedFiles.eoInsuranceFile ? uploadedFiles.eoInsuranceFile.name : 'Click to upload E&O insurance certificate (optional)'}
                          </p>
                        </label>
                      </div>
                    </div>

                  {/* Digital Certificate */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-red-500" />
                      <Label className="font-medium">Digital Certificate *</Label>
                      <Badge variant="destructive">Required</Badge>
                    </div>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept=".pfx,.p12"
                        onChange={(e) => handleFileUpload('publicCertificateFile', e.target.files?.[0] || null)}
                        className="hidden"
                        id="publicCertificateFile"
                      />
                      <label htmlFor="publicCertificateFile" className="cursor-pointer">
                        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          {uploadedFiles.publicCertificateFile ? uploadedFiles.publicCertificateFile.name : 'Click to upload digital certificate (.pfx/.p12)'}
                        </p>
                      </label>
                    </div>
                    {uploadedFiles.publicCertificateFile && (
                      <div className="space-y-2">
                        <Label htmlFor="publicCertificatePassword">Certificate Password</Label>
                        <Input
                          id="publicCertificatePassword"
                          type="password"
                          value={profileForm.publicCertificatePassword}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, publicCertificatePassword: e.target.value }))}
                          placeholder="Enter certificate password"
                        />
                      </div>
                    )}
                  </div>

                  {/* Bond Certificate */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-500" />
                      <Label className="font-medium">Bond Certificate</Label>
                      <Badge variant="outline">Optional</Badge>
                    </div>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload('bondFile', e.target.files?.[0] || null)}
                        className="hidden"
                        id="bondFile"
                      />
                      <label htmlFor="bondFile" className="cursor-pointer">
                        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          {uploadedFiles.bondFile ? uploadedFiles.bondFile.name : 'Click to upload bond certificate (optional)'}
                        </p>
                      </label>
                    </div>
                  </div>

                  {/* NSA Certificate */}
                  {profileForm.signingAgentCertified && (
                    <div className="space-y-3 md:col-span-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-orange-500" />
                        <Label className="font-medium">NSA Certificate</Label>
                        <Badge variant="secondary">Optional</Badge>
                      </div>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileUpload('signingAgentFile', e.target.files?.[0] || null)}
                          className="hidden"
                          id="signingAgentFile"
                        />
                        <label htmlFor="signingAgentFile" className="cursor-pointer">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">
                            {uploadedFiles.signingAgentFile ? uploadedFiles.signingAgentFile.name : 'Click to upload NSA certificate'}
                          </p>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Document Requirements Info */}
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Document Requirements:</strong>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>• <strong>Commission Certificate:</strong> Your official notary commission from the state (Required)</li>
                      <li>• <strong>E&O Insurance:</strong> Errors & Omissions insurance policy or certificate (Optional)</li>
                      <li>• <strong>Digital Certificate:</strong> Your digital signing certificate (.pfx or .p12 format) (Required)</li>
                      <li>• <strong>Bond Certificate:</strong> Your notary bond certificate (Optional)</li>
                      <li>• <strong>NSA Certificate:</strong> Required only if you are a certified Notary Signing Agent</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {currentStep === 'signatures' && (
            <div className="space-y-6">
              {/* Signatures Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Pencil className="h-5 w-5 text-blue-600" />
                    Digital Signatures
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Upload your digital signatures for document signing.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {signatureLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Clock className="h-6 w-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-600">Loading signatures...</span>
                    </div>
                  ) : (
                    <>
                      {!showSignatureUpload ? (
                        <>
                          {signatures.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {signatures.map((signature) => (
                                <div key={signature.id} className="border rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium">{signature.name}</h4>
                                    {signature.isDefault && (
                                      <Badge variant="default" className="text-xs">
                                        <Star className="h-3 w-3 mr-1" />
                                        Default
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="bg-gray-50 rounded border-2 border-dashed border-gray-200 p-4 mb-3">
                                    <img 
                                      src={signature.imageUrl} 
                                      alt={signature.name}
                                      className="max-h-16 mx-auto"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span className="capitalize">{signature.type}</span>
                                    <span>{new Date(signature.createdAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                              <Pencil className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <h3 className="text-lg font-medium text-gray-900 mb-2">No signatures uploaded</h3>
                              <p className="text-gray-600 mb-4">Upload your first signature to get started</p>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-center pt-4">
                            <Button
                              variant="outline"
                              onClick={() => setShowSignatureUpload(true)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Signature
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 bg-blue-50">
                          <div className="text-center">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleSignatureFileChange}
                              className="hidden"
                              id="signatureUpload"
                            />
                            <label htmlFor="signatureUpload" className="cursor-pointer">
                              {signaturePreview ? (
                                <img src={signaturePreview} alt="Preview" className="max-h-24 mx-auto mb-2" />
                              ) : (
                                <Upload className="h-12 w-12 text-blue-500 mx-auto mb-2" />
                              )}
                              <p className="text-sm text-blue-700 mb-4">
                                {signatureFile ? signatureFile.name : 'Click to select signature image'}
                              </p>
                            </label>
                            <div className="flex gap-2 justify-center">
                              {signatureFile && (
                                <Button onClick={handleSignatureUpload}>
                                  Upload Signature
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                onClick={() => {
                                  setShowSignatureUpload(false);
                                  setSignatureFile(null);
                                  setSignaturePreview('');
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Stamps Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    Notary Stamps
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Upload your official notary stamp for document authentication.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stampLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Clock className="h-6 w-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-600">Loading stamps...</span>
                    </div>
                  ) : (
                    <>
                      {!showStampUpload ? (
                        <>
                          {stamps.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {stamps.map((stamp) => (
                                <div key={stamp.id} className="border rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium">Official Notary Stamp</h4>
                                    {stamp.isActive && (
                                      <Badge variant="default" className="text-xs">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Active
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="bg-gray-50 rounded border-2 border-dashed border-gray-200 p-4 mb-3">
                                    <img 
                                      src={stamp.imageUrl} 
                                      alt="Notary Stamp"
                                      className="max-h-20 mx-auto"
                                    />
                                  </div>
                                  <div className="text-xs text-gray-500 text-center">
                                    Uploaded: {new Date(stamp.uploadedAt).toLocaleDateString()}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                              <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <h3 className="text-lg font-medium text-gray-900 mb-2">No stamp uploaded</h3>
                              <p className="text-gray-600 mb-4">Upload your official notary stamp</p>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-center pt-4">
                            <Button
                              variant="outline"
                              onClick={() => setShowStampUpload(true)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Stamp
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="border-2 border-dashed border-green-300 rounded-lg p-6 bg-green-50">
                          <div className="text-center">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleStampFileChange}
                              className="hidden"
                              id="stampUpload"
                            />
                            <label htmlFor="stampUpload" className="cursor-pointer">
                              {stampPreview ? (
                                <img src={stampPreview} alt="Preview" className="max-h-24 mx-auto mb-2" />
                              ) : (
                                <Upload className="h-12 w-12 text-green-500 mx-auto mb-2" />
                              )}
                              <p className="text-sm text-green-700 mb-4">
                                {stampFile ? stampFile.name : 'Click to select stamp image'}
                              </p>
                            </label>
                            <div className="flex gap-2 justify-center">
                              {stampFile && (
                                <Button onClick={handleStampUpload}>
                                  Upload Stamp
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                onClick={() => {
                                  setShowStampUpload(false);
                                  setStampFile(null);
                                  setStampPreview('');
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}



          {currentStep === 'complete' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  Profile Submitted Successfully!
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Profile Under Review
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Your notary profile has been submitted for admin approval. You will be notified once it has been reviewed and approved.
                  </p>
                  <Button 
                    onClick={onComplete}
                    className="w-full md:w-auto"
                  >
                    Continue to Dashboard
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        {currentStep !== 'complete' && (
          <div className="flex-shrink-0 bg-gray-50 px-6 py-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span>Complete profile required to access notary dashboard and start signing jobs.</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                {currentStep !== 'personal' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBack}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Continue Later
                </Button>
              </div>
              <Button
                onClick={handleNext}
                disabled={isSubmitting}
                className="min-w-[120px]"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    {currentStep === 'signatures' ? 'Submitting...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    {currentStep === 'signatures' ? 'Complete Profile' : 'Continue'}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
