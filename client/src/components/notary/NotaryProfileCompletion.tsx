import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Upload, 
  Shield, 
  MapPin, 
  DollarSign, 
  Calendar,
  CheckCircle,
  AlertTriangle,
  Globe,
  FileUp,
  Save,
  User
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// Updated schema with all optional fields including basic user information
const notaryProfileSchema = z.object({
  // Basic Personal Information
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  phoneNumber: z.string().optional(),
  
  // Personal Address Information  
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  
  // Name on Commission
  nameOnCommission: z.string().optional(),
  
  // Commission Address
  commissionAddress1: z.string().optional(),
  commissionAddress2: z.string().optional(),
  commissionCity: z.string().optional(),
  commissionState: z.string().optional(),
  commissionZipCode: z.string().optional(),
  commissionCounty: z.string().optional(),
  
  // Commission Details
  commissionNumber: z.string().optional(),
  commissionExpiration: z.string().optional(),
  
  // E&O Insurance
  eoInsuranceCompany: z.string().optional(),
  eoInsuranceAmount: z.number().optional(),
  eoInsuranceExpiration: z.string().optional(),
  
  // Public Certificate
  publicCertificateExpiration: z.string().optional(),
  publicCertificatePassword: z.string().optional(),
  
  // Bond Information
  bondCompanyName: z.string().optional(),
  bondAmount: z.number().optional(),
  bondExpiration: z.string().optional(),
  
  // Signing Agent Certification
  signingAgentCertified: z.boolean().optional(),
  signingAgentExpirationDate: z.string().optional(),
  
  // Foreign Languages
  foreignLanguages: z.array(z.string()).default([]),
});

type NotaryProfileFormData = z.infer<typeof notaryProfileSchema>;

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const FOREIGN_LANGUAGES = [
  'Spanish',
  'Italian', 
  'French',
  'Portuguese',
  'German',
  'Mandarin'
];

interface FileUploadStatus {
  notaryCommissionFile: File | null;
  eoInsuranceFile: File | null;
  publicCertificateFile: File | null;
  bondFile: File | null;
  signingAgentFile: File | null;
}

export function NotaryProfileCompletion() {
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadStatus>({
    notaryCommissionFile: null,
    eoInsuranceFile: null,
    publicCertificateFile: null,
    bondFile: null,
    signingAgentFile: null,
  });
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<NotaryProfileFormData>({
    resolver: zodResolver(notaryProfileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      fullName: '',
      phoneNumber: '',
      address1: '',
      address2: '',
      city: '',
      state: '',
      zipCode: '',
      nameOnCommission: '',
      commissionAddress1: '',
      commissionAddress2: '',
      commissionCity: '',
      commissionState: '',
      commissionZipCode: '',
      commissionCounty: '',
      commissionNumber: '',
      commissionExpiration: '',
      eoInsuranceCompany: '',
      eoInsuranceAmount: 0,
      eoInsuranceExpiration: '',
      publicCertificateExpiration: '',
      publicCertificatePassword: '',
      bondCompanyName: '',
      bondAmount: 0,
      bondExpiration: '',
      signingAgentCertified: false,
      signingAgentExpirationDate: '',
      foreignLanguages: [],
    },
  });

  // Load existing profile data on component mount
  useEffect(() => {
    loadExistingProfile();
  }, []);

  const loadExistingProfile = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token found, skipping profile load');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/notary/profile/comprehensive', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const profileData = await response.json();
        console.log('Loaded existing profile:', profileData);

        // Pre-populate form with existing data
        const formValues = {
          firstName: profileData.firstName || '',
          lastName: profileData.lastName || '',
          fullName: profileData.fullName || '',
          phoneNumber: profileData.phoneNumber || '',
          address1: profileData.address1 || '',
          address2: profileData.address2 || '',
          city: profileData.city || '',
          state: profileData.state || '',
          zipCode: profileData.zipCode || '',
          nameOnCommission: profileData.nameOnCommission || '',
          commissionAddress1: profileData.commissionAddress1 || '',
          commissionAddress2: profileData.commissionAddress2 || '',
          commissionCity: profileData.commissionCity || '',
          commissionState: profileData.commissionState || '',
          commissionZipCode: profileData.commissionZipCode || '',
          commissionCounty: profileData.commissionCounty || '',
          commissionNumber: profileData.commissionNumber || '',
          commissionExpiration: profileData.commissionExpiration || '',
          eoInsuranceCompany: profileData.eoInsuranceCompany || '',
          eoInsuranceAmount: profileData.eoInsuranceAmount || 0,
          eoInsuranceExpiration: profileData.eoInsuranceExpiration || '',
          publicCertificateExpiration: profileData.publicCertificateExpiration || '',
          publicCertificatePassword: '', // Always empty for security
          bondCompanyName: profileData.bondCompanyName || '',
          bondAmount: profileData.bondAmount || 0,
          bondExpiration: profileData.bondExpiration || '',
          signingAgentCertified: profileData.signingAgentCertified || false,
          signingAgentExpirationDate: profileData.signingAgentExpirationDate || '',
          foreignLanguages: profileData.foreignLanguages || [],
        };

        // Reset form with loaded data
        form.reset(formValues);
        
        // Set selected languages
        setSelectedLanguages(profileData.foreignLanguages || []);

        console.log('Form pre-populated with existing data');
      } else {
        console.log('No existing profile found or error loading profile');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (fileType: keyof FileUploadStatus, file: File) => {
    try {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: 'File too large',
          description: 'Please select a file smaller than 10MB.',
          variant: 'destructive',
        });
        return;
      }

      // Validate file type based on the document type
      const isValidFileType = (fileType: keyof FileUploadStatus, file: File) => {
        if (fileType === 'publicCertificateFile') {
          // Digital certificates should be .pfx or .p12 files
          const validExtensions = ['.pfx', '.p12'];
          const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
          return validExtensions.includes(fileExtension);
        } else {
          // Other documents should be PDF, JPG, JPEG, or PNG
          const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
          return validTypes.includes(file.type);
        }
      };

      if (!isValidFileType(fileType, file)) {
        const allowedTypes = fileType === 'publicCertificateFile' 
          ? '.pfx or .p12 files' 
          : 'PDF, JPG, JPEG, or PNG files';
        
        toast({
          title: 'Invalid file type',
          description: `Please select ${allowedTypes} only.`,
          variant: 'destructive',
        });
        return;
      }

      setUploadedFiles(prev => ({
        ...prev,
        [fileType]: file,
      }));

      toast({
        title: 'File uploaded',
        description: `${file.name} has been selected for upload.`,
      });
    } catch (err) {
      console.error('Error handling file upload:', err);
      toast({
        title: 'Upload Error',
        description: 'Failed to process file upload.',
        variant: 'destructive',
      });
    }
  };

  const handleLanguageToggle = (language: string) => {
    try {
      setSelectedLanguages(prev => {
        const newLanguages = prev.includes(language)
          ? prev.filter(l => l !== language)
          : [...prev, language];
        
        form.setValue('foreignLanguages', newLanguages);
        return newLanguages;
      });
    } catch (err) {
      console.error('Error toggling language:', err);
    }
  };

  const onSubmit = async (data: NotaryProfileFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);

      console.log('Starting form submission...', data);

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      let fileUploadResult: any = {};

      // Only upload files if any are provided
      const hasFiles = Object.values(uploadedFiles).some(file => file !== null);
      
      if (hasFiles) {
        console.log('Uploading files...');
        const formData = new FormData();
        Object.entries(uploadedFiles).forEach(([key, file]) => {
          if (file) {
            formData.append(key, file);
          }
        });

        const fileUploadResponse = await fetch('/api/notary/profile/upload-documents', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!fileUploadResponse.ok) {
          const errorText = await fileUploadResponse.text();
          console.warn(`File upload failed: ${fileUploadResponse.status} ${errorText}`);
          // Continue with submission even if file upload fails
          toast({
            title: 'File upload warning',
            description: 'Some files could not be uploaded, but your profile will be saved.',
            variant: 'default',
          });
        } else {
          fileUploadResult = await fileUploadResponse.json();
          console.log('File upload successful:', fileUploadResult);
        }
      }

      // Submit profile data with optional file paths
      const profileData = {
        ...data,
        eoInsuranceAmount: data.eoInsuranceAmount ? data.eoInsuranceAmount * 100 : undefined, // Convert to cents if provided
        bondAmount: data.bondAmount ? data.bondAmount * 100 : undefined, // Convert to cents if provided
        foreignLanguages: selectedLanguages,
        // Add file paths from upload response if available
        notaryCommissionFile: fileUploadResult.notaryCommissionFile || null,
        eoInsuranceFile: fileUploadResult.eoInsuranceFile || null,
        publicCertificateFile: fileUploadResult.publicCertificateFile || null,
        bondFile: fileUploadResult.bondFile || null,
        signingAgentFile: fileUploadResult.signingAgentFile || null,
      };

      console.log('Submitting profile data...', profileData);

      const response = await fetch('/api/notary/profile/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Profile submission failed:', response.status, errorText);
        throw new Error(`Failed to save profile: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Profile submission successful:', result);

      toast({
        title: 'Profile saved successfully!',
        description: 'Your notary profile has been updated. Redirecting to your profile page...',
        duration: 3000,
      });

      // Add a small delay to let the user see the success message
      setTimeout(() => {
        console.log('Redirecting to profile page...');
        setLocation('/profile');
      }, 1500);

    } catch (error) {
      console.error('Profile completion error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: 'Failed to save profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const FileUploadCard = ({ 
    title, 
    fileType, 
    description 
  }: { 
    title: string; 
    fileType: keyof FileUploadStatus; 
    description: string;
  }) => {
    // Define accepted file types based on the file type
    const getAcceptedFileTypes = (fileType: keyof FileUploadStatus) => {
      if (fileType === 'publicCertificateFile') {
        return '.pfx,.p12'; // Digital certificates
      }
      return '.pdf,.jpg,.jpeg,.png'; // Standard documents
    };

    return (
      <Card className="border-dashed hover:border-blue-300 transition-colors duration-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileUp className="h-4 w-4 text-blue-600" />
            {title}
          </CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <input
              type="file"
              accept={getAcceptedFileTypes(fileType)}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(fileType, file);
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors duration-200"
            />
            {uploadedFiles[fileType] && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <CheckCircle className="h-4 w-4" />
                {uploadedFiles[fileType]!.name}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Header */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl opacity-90"></div>
          <div className="relative bg-white/10 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/20">
            <div className="text-center text-white">
              <div className="w-16 h-16 bg-gradient-to-br from-white/20 to-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg ring-4 ring-white/20">
                <User className="w-8 h-8" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Complete Your Notary Profile</h1>
              <p className="text-white/80 text-lg">
                Fill out any information you'd like to provide. All fields are optional and can be completed later.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your profile...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Basic Personal Information */}
          <Card className="border-2 border-gray-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                Basic Personal Information
              </CardTitle>
              <CardDescription>
                Provide your basic personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  {...form.register('firstName')}
                  placeholder="Your first name"
                  className="mt-1 h-11"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  {...form.register('lastName')}
                  placeholder="Your last name"
                  className="mt-1 h-11"
                />
              </div>
              <div>
                <Label htmlFor="fullName">Full Name (as it appears on commission)</Label>
                <Input
                  id="fullName"
                  {...form.register('fullName')}
                  placeholder="Full name as it appears on commission (optional)"
                  className="mt-1 h-11"
                />
              </div>
              <div>
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  {...form.register('phoneNumber')}
                  placeholder="Your phone number (optional)"
                  className="mt-1 h-11"
                />
              </div>
            </CardContent>
          </Card>

          {/* Personal Address */}
          <Card className="border-2 border-gray-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                Personal Address
              </CardTitle>
              <CardDescription>
                Your current residential address (optional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div>
                <Label htmlFor="address1">Address Line 1</Label>
                <Input
                  id="address1"
                  {...form.register('address1')}
                  placeholder="Street address (optional)"
                  className="mt-1 h-11"
                />
              </div>
              <div>
                <Label htmlFor="address2">Address Line 2</Label>
                <Input
                  id="address2"
                  {...form.register('address2')}
                  placeholder="Apartment, suite, etc. (optional)"
                  className="mt-1 h-11"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    {...form.register('city')}
                    placeholder="City (optional)"
                    className="mt-1 h-11"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={form.watch('state') || ''}
                    onValueChange={(value) => form.setValue('state', value)}
                  >
                    <SelectTrigger className="mt-1 h-11">
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    {...form.register('zipCode')}
                    placeholder="ZIP Code (optional)"
                    className="mt-1 h-11"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Commission Information */}
          <Card className="border-2 border-gray-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                Commission Information
              </CardTitle>
              <CardDescription>
                Provide your notary commission details if available
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div>
                <Label htmlFor="nameOnCommission">Name on Commission</Label>
                <Input
                  id="nameOnCommission"
                  {...form.register('nameOnCommission')}
                  placeholder="Full name as it appears on commission (optional)"
                  className="mt-1 h-11"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="commissionNumber">Commission Number</Label>
                  <Input
                    id="commissionNumber"
                    {...form.register('commissionNumber')}
                    placeholder="Commission number (optional)"
                    className="mt-1 h-11"
                  />
                </div>

                <div>
                  <Label htmlFor="commissionExpiration">Commission Expiration Date</Label>
                  <Input
                    id="commissionExpiration"
                    type="date"
                    {...form.register('commissionExpiration')}
                    className="mt-1 h-11"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Commission Address */}
          <Card className="border-2 border-gray-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-yellow-50 to-orange-50">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                Commission Address
              </CardTitle>
              <CardDescription>
                Address associated with your notary commission (optional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div>
                <Label htmlFor="commissionAddress1">Address Line 1</Label>
                <Input
                  id="commissionAddress1"
                  {...form.register('commissionAddress1')}
                  placeholder="Street address (optional)"
                  className="mt-1 h-11"
                />
              </div>

              <div>
                <Label htmlFor="commissionAddress2">Address Line 2</Label>
                <Input
                  id="commissionAddress2"
                  {...form.register('commissionAddress2')}
                  placeholder="Apartment, suite, etc. (optional)"
                  className="mt-1 h-11"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="commissionCity">City</Label>
                  <Input
                    id="commissionCity"
                    {...form.register('commissionCity')}
                    placeholder="City (optional)"
                    className="mt-1 h-11"
                  />
                </div>

                <div>
                  <Label htmlFor="commissionState">State</Label>
                  <Select
                    value={form.watch('commissionState') || ''}
                    onValueChange={(value) => form.setValue('commissionState', value)}
                  >
                    <SelectTrigger className="mt-1 h-11">
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="commissionZipCode">ZIP Code</Label>
                  <Input
                    id="commissionZipCode"
                    {...form.register('commissionZipCode')}
                    placeholder="ZIP Code (optional)"
                    className="mt-1 h-11"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="commissionCounty">County/Parish</Label>
                <Input
                  id="commissionCounty"
                  {...form.register('commissionCounty')}
                  placeholder="County or Parish (optional)"
                  className="mt-1 h-11"
                />
              </div>
            </CardContent>
          </Card>

          {/* Insurance & Bond Information */}
          <Card className="border-2 border-gray-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-yellow-50">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                Insurance & Bond Information
              </CardTitle>
              <CardDescription>
                E&O Insurance and Bond details (optional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              {/* E&O Insurance */}
              <div className="space-y-4">
                <h4 className="font-medium text-lg">Errors & Omissions Insurance</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="eoInsuranceCompany">Insurance Company</Label>
                    <Input
                      id="eoInsuranceCompany"
                      {...form.register('eoInsuranceCompany')}
                      placeholder="Insurance company name (optional)"
                      className="mt-1 h-11"
                    />
                  </div>

                  <div>
                    <Label htmlFor="eoInsuranceAmount">Insurance Amount ($)</Label>
                    <Input
                      id="eoInsuranceAmount"
                      type="number"
                      {...form.register('eoInsuranceAmount', { valueAsNumber: true })}
                      placeholder="25000 (optional)"
                      className="mt-1 h-11"
                    />
                  </div>

                  <div>
                    <Label htmlFor="eoInsuranceExpiration">Expiration Date</Label>
                    <Input
                      id="eoInsuranceExpiration"
                      type="date"
                      {...form.register('eoInsuranceExpiration')}
                      className="mt-1 h-11"
                    />
                  </div>
                </div>
              </div>

              {/* Bond Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-lg">Bond Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="bondCompanyName">Bond Company</Label>
                    <Input
                      id="bondCompanyName"
                      {...form.register('bondCompanyName')}
                      placeholder="Bond company name (optional)"
                      className="mt-1 h-11"
                    />
                  </div>

                  <div>
                    <Label htmlFor="bondAmount">Bond Amount ($)</Label>
                    <Input
                      id="bondAmount"
                      type="number"
                      {...form.register('bondAmount', { valueAsNumber: true })}
                      placeholder="15000 (optional)"
                      className="mt-1 h-11"
                    />
                  </div>

                  <div>
                    <Label htmlFor="bondExpiration">Expiration Date</Label>
                    <Input
                      id="bondExpiration"
                      type="date"
                      {...form.register('bondExpiration')}
                      className="mt-1 h-11"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Public Certificate */}
          <Card className="border-2 border-gray-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                Public Certificate Information
              </CardTitle>
              <CardDescription>
                Digital certificate details for electronic notarization (optional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="publicCertificateExpiration">Certificate Expiration Date</Label>
                  <Input
                    id="publicCertificateExpiration"
                    type="date"
                    {...form.register('publicCertificateExpiration')}
                    className="mt-1 h-11"
                  />
                </div>

                <div>
                  <Label htmlFor="publicCertificatePassword">Certificate Password</Label>
                  <Input
                    id="publicCertificatePassword"
                    type="password"
                    {...form.register('publicCertificatePassword')}
                    placeholder="Certificate password (optional)"
                    className="mt-1 h-11"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Signing Agent Certification */}
          <Card className="border-2 border-gray-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                Signing Agent Certification
              </CardTitle>
              <CardDescription>
                Notary Signing Agent certification details (optional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="signingAgentCertified"
                  checked={form.watch('signingAgentCertified') || false}
                  onCheckedChange={(checked) => 
                    form.setValue('signingAgentCertified', checked as boolean)
                  }
                />
                <Label htmlFor="signingAgentCertified">
                  I am a certified Notary Signing Agent (NSA)
                </Label>
              </div>

              {form.watch('signingAgentCertified') && (
                <div>
                  <Label htmlFor="signingAgentExpirationDate">NSA Certification Expiration Date</Label>
                  <Input
                    id="signingAgentExpirationDate"
                    type="date"
                    {...form.register('signingAgentExpirationDate')}
                    className="mt-1 h-11"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Foreign Languages */}
          <Card className="border-2 border-gray-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
                  <Globe className="h-5 w-5 text-white" />
                </div>
                Foreign Languages
              </CardTitle>
              <CardDescription>
                Select languages you can provide notary services in (besides English)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {FOREIGN_LANGUAGES.map((language) => (
                  <div key={language} className="flex items-center space-x-2">
                    <Checkbox
                      id={`language-${language}`}
                      checked={selectedLanguages.includes(language)}
                      onCheckedChange={() => handleLanguageToggle(language)}
                    />
                    <Label htmlFor={`language-${language}`}>{language}</Label>
                  </div>
                ))}
              </div>
              
              {selectedLanguages.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">Selected languages:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedLanguages.map((language) => (
                      <Badge key={language} variant="secondary" className="bg-indigo-100 text-indigo-800">
                        {language}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* File Uploads */}
          <Card className="border-2 border-gray-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-gray-500 rounded-xl flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                Document Uploads
              </CardTitle>
              <CardDescription>
                Upload notary documents when available (all optional - PDF, JPG, PNG - max 10MB each)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FileUploadCard
                  title="Notary Commission Certificate"
                  fileType="notaryCommissionFile"
                  description="Upload your official notary commission certificate"
                />

                <FileUploadCard
                  title="E&O Insurance Certificate"
                  fileType="eoInsuranceFile"
                  description="Upload your E&O insurance certificate"
                />

                <FileUploadCard
                  title="Public Certificate"
                  fileType="publicCertificateFile"
                  description="Upload your digital public certificate (.pfx or .p12 file)"
                />

                <FileUploadCard
                  title="Bond Certificate"
                  fileType="bondFile"
                  description="Upload your notary bond certificate"
                />

                {form.watch('signingAgentCertified') && (
                  <div className="md:col-span-2">
                    <FileUploadCard
                      title="NSA Certification"
                      fileType="signingAgentFile"
                      description="Upload your NSA certification document"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit Section */}
          <Card className="border-2 border-gray-100 shadow-lg">
            <CardContent className="p-6">
              <div className="space-y-6">
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Note:</strong> All fields are optional. You can save your profile with any amount of information 
                    and complete additional details later. Your profile can be updated at any time.
                  </AlertDescription>
                </Alert>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation('/dashboard')}
                    disabled={isSubmitting}
                    className="border-2 border-gray-300 hover:border-gray-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-w-[200px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSubmitting ? 'Saving...' : 'Save Profile'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
        )}
      </div>
    </div>
  );
} 