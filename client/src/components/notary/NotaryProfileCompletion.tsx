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
import { Progress } from '@/components/ui/progress';
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
  FileUp
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const notaryProfileSchema = z.object({
  // Name on Commission
  nameOnCommission: z.string().min(1, 'Name on commission is required'),
  
  // Commission Address
  commissionAddress1: z.string().min(1, 'Commission address is required'),
  commissionAddress2: z.string().optional(),
  commissionCity: z.string().min(1, 'Commission city is required'),
  commissionState: z.string().min(2, 'Commission state is required').max(2, 'Use 2-letter state code'),
  commissionZipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  commissionCounty: z.string().min(1, 'Commission county/parish is required'),
  
  // Commission Details
  commissionNumber: z.string().min(1, 'Commission number is required'),
  commissionExpiration: z.string().min(1, 'Commission expiration date is required'),
  
  // E&O Insurance
  eoInsuranceCompany: z.string().min(1, 'E&O insurance company is required'),
  eoInsuranceAmount: z.number().min(1, 'E&O insurance amount is required'),
  eoInsuranceExpiration: z.string().min(1, 'E&O insurance expiration is required'),
  
  // Public Certificate
  publicCertificateExpiration: z.string().min(1, 'Public certificate expiration is required'),
  publicCertificatePassword: z.string().min(1, 'Public certificate password is required'),
  
  // Bond Information
  bondCompanyName: z.string().min(1, 'Bond company name is required'),
  bondAmount: z.number().min(1, 'Bond amount is required'),
  bondExpiration: z.string().min(1, 'Bond expiration date is required'),
  
  // Signing Agent Certification
  signingAgentCertified: z.boolean(),
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
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadStatus>({
    notaryCommissionFile: null,
    eoInsuranceFile: null,
    publicCertificateFile: null,
    bondFile: null,
    signingAgentFile: null,
  });
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [completionProgress, setCompletionProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<NotaryProfileFormData>({
    resolver: zodResolver(notaryProfileSchema),
    defaultValues: {
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

  // Calculate completion progress
  useEffect(() => {
    try {
      const watchedValues = form.watch();
      const totalFields = Object.keys(watchedValues).length;
      const completedFields = Object.values(watchedValues).filter(value => {
        if (typeof value === 'string') return value.trim() !== '';
        if (typeof value === 'number') return value > 0;
        if (typeof value === 'boolean') return true; // Booleans are always "complete"
        if (Array.isArray(value)) return true; // Arrays are always "complete"
        return false;
      }).length;
      
      // Add file uploads to completion calculation
      const uploadedFileCount = Object.values(uploadedFiles).filter(file => file !== null).length;
      const requiredFiles = 4; // Commission, E&O, Certificate, Bond (Signing Agent is optional)
      
      const progress = Math.round(((completedFields + uploadedFileCount) / (totalFields + requiredFiles)) * 100);
      setCompletionProgress(Math.min(progress, 100));
    } catch (err) {
      console.error('Error calculating progress:', err);
      setCompletionProgress(0);
    }
  }, [form.watch(), uploadedFiles]);

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

      // Check required files
      const requiredFiles = ['notaryCommissionFile', 'eoInsuranceFile', 'publicCertificateFile', 'bondFile'] as const;
      const missingFiles = requiredFiles.filter(fileType => !uploadedFiles[fileType]);
      
      if (missingFiles.length > 0) {
        toast({
          title: 'Missing required files',
          description: 'Please upload all required documents.',
          variant: 'destructive',
        });
        return;
      }

      // Upload files first
      const formData = new FormData();
      Object.entries(uploadedFiles).forEach(([key, file]) => {
        if (file) {
          formData.append(key, file);
        }
      });

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const fileUploadResponse = await fetch('/api/notary/profile/upload-documents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!fileUploadResponse.ok) {
        const errorText = await fileUploadResponse.text();
        throw new Error(`Failed to upload documents: ${fileUploadResponse.status} ${errorText}`);
      }

      const fileUploadResult = await fileUploadResponse.json();

      // Submit profile data with file paths
      const profileData = {
        ...data,
        eoInsuranceAmount: data.eoInsuranceAmount * 100, // Convert to cents
        bondAmount: data.bondAmount * 100, // Convert to cents
        foreignLanguages: selectedLanguages,
        // Add file paths from upload response
        notaryCommissionFile: fileUploadResult.notaryCommissionFile,
        eoInsuranceFile: fileUploadResult.eoInsuranceFile,
        publicCertificateFile: fileUploadResult.publicCertificateFile,
        bondFile: fileUploadResult.bondFile,
        signingAgentFile: fileUploadResult.signingAgentFile,
      };

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
        throw new Error(`Failed to save profile: ${response.status} ${errorText}`);
      }

      toast({
        title: 'Profile completed successfully!',
        description: 'Your profile has been submitted for admin approval.',
      });

      // Redirect to dashboard
      setLocation('/dashboard');

    } catch (error) {
      console.error('Profile completion error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: 'Failed to complete profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const FileUploadCard = ({ 
    title, 
    fileType, 
    required = true,
    description 
  }: { 
    title: string; 
    fileType: keyof FileUploadStatus; 
    required?: boolean;
    description: string;
  }) => (
    <Card className="border-dashed">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileUp className="h-4 w-4" />
          {title}
          {required && <span className="text-red-500">*</span>}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(fileType, file);
            }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {uploadedFiles[fileType] && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              {uploadedFiles[fileType]!.name}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Notary Profile</h1>
          <p className="text-gray-600 mb-4">
            Please complete all required fields to activate your notary account
          </p>
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Completion Progress</span>
              <span>{completionProgress}%</span>
            </div>
            <Progress value={completionProgress} className="h-2" />
          </div>
          
          {error && (
            <Alert className="mt-6 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Error:</strong> {error}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Commission Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Commission Information
              </CardTitle>
              <CardDescription>
                Provide your notary commission details exactly as they appear on your commission certificate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="nameOnCommission">Name on Commission *</Label>
                <Input
                  id="nameOnCommission"
                  {...form.register('nameOnCommission')}
                  placeholder="Full name as it appears on commission"
                />
                {form.formState.errors.nameOnCommission && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.nameOnCommission.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="commissionNumber">Commission Number *</Label>
                  <Input
                    id="commissionNumber"
                    {...form.register('commissionNumber')}
                    placeholder="Commission number"
                  />
                  {form.formState.errors.commissionNumber && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.commissionNumber.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="commissionExpiration">Commission Expiration Date *</Label>
                  <Input
                    id="commissionExpiration"
                    type="date"
                    {...form.register('commissionExpiration')}
                  />
                  {form.formState.errors.commissionExpiration && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.commissionExpiration.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Commission Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Commission Address
              </CardTitle>
              <CardDescription>
                Address associated with your notary commission
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="commissionAddress1">Address Line 1 *</Label>
                <Input
                  id="commissionAddress1"
                  {...form.register('commissionAddress1')}
                  placeholder="Street address"
                />
                {form.formState.errors.commissionAddress1 && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.commissionAddress1.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="commissionAddress2">Address Line 2</Label>
                <Input
                  id="commissionAddress2"
                  {...form.register('commissionAddress2')}
                  placeholder="Apartment, suite, etc."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="commissionCity">City *</Label>
                  <Input
                    id="commissionCity"
                    {...form.register('commissionCity')}
                    placeholder="City"
                  />
                  {form.formState.errors.commissionCity && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.commissionCity.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="commissionState">State *</Label>
                  <Select
                    value={form.watch('commissionState')}
                    onValueChange={(value) => form.setValue('commissionState', value)}
                  >
                    <SelectTrigger>
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
                  {form.formState.errors.commissionState && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.commissionState.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="commissionZipCode">ZIP Code *</Label>
                  <Input
                    id="commissionZipCode"
                    {...form.register('commissionZipCode')}
                    placeholder="ZIP Code"
                  />
                  {form.formState.errors.commissionZipCode && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.commissionZipCode.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="commissionCounty">County/Parish *</Label>
                <Input
                  id="commissionCounty"
                  {...form.register('commissionCounty')}
                  placeholder="County or Parish"
                />
                {form.formState.errors.commissionCounty && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.commissionCounty.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Insurance & Bond Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Insurance & Bond Information
              </CardTitle>
              <CardDescription>
                Errors & Omissions Insurance and Bond details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* E&O Insurance */}
              <div className="space-y-4">
                <h4 className="font-medium">Errors & Omissions Insurance</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="eoInsuranceCompany">Insurance Company *</Label>
                    <Input
                      id="eoInsuranceCompany"
                      {...form.register('eoInsuranceCompany')}
                      placeholder="Insurance company name"
                    />
                    {form.formState.errors.eoInsuranceCompany && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.eoInsuranceCompany.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="eoInsuranceAmount">Insurance Amount ($) *</Label>
                    <Input
                      id="eoInsuranceAmount"
                      type="number"
                      {...form.register('eoInsuranceAmount', { valueAsNumber: true })}
                      placeholder="25000"
                    />
                    {form.formState.errors.eoInsuranceAmount && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.eoInsuranceAmount.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="eoInsuranceExpiration">Expiration Date *</Label>
                    <Input
                      id="eoInsuranceExpiration"
                      type="date"
                      {...form.register('eoInsuranceExpiration')}
                    />
                    {form.formState.errors.eoInsuranceExpiration && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.eoInsuranceExpiration.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bond Information */}
              <div className="space-y-4">
                <h4 className="font-medium">Bond Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="bondCompanyName">Bond Company *</Label>
                    <Input
                      id="bondCompanyName"
                      {...form.register('bondCompanyName')}
                      placeholder="Bond company name"
                    />
                    {form.formState.errors.bondCompanyName && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.bondCompanyName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="bondAmount">Bond Amount ($) *</Label>
                    <Input
                      id="bondAmount"
                      type="number"
                      {...form.register('bondAmount', { valueAsNumber: true })}
                      placeholder="15000"
                    />
                    {form.formState.errors.bondAmount && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.bondAmount.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="bondExpiration">Expiration Date *</Label>
                    <Input
                      id="bondExpiration"
                      type="date"
                      {...form.register('bondExpiration')}
                    />
                    {form.formState.errors.bondExpiration && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.bondExpiration.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Public Certificate */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Public Certificate Information
              </CardTitle>
              <CardDescription>
                Digital certificate details for electronic notarization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="publicCertificateExpiration">Certificate Expiration Date *</Label>
                  <Input
                    id="publicCertificateExpiration"
                    type="date"
                    {...form.register('publicCertificateExpiration')}
                  />
                  {form.formState.errors.publicCertificateExpiration && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.publicCertificateExpiration.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="publicCertificatePassword">Certificate Password *</Label>
                  <Input
                    id="publicCertificatePassword"
                    type="password"
                    {...form.register('publicCertificatePassword')}
                    placeholder="Certificate password"
                  />
                  {form.formState.errors.publicCertificatePassword && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.publicCertificatePassword.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Signing Agent Certification */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Signing Agent Certification
              </CardTitle>
              <CardDescription>
                Notary Signing Agent certification details (if applicable)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="signingAgentCertified"
                  checked={form.watch('signingAgentCertified')}
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
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Foreign Languages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Foreign Languages
              </CardTitle>
              <CardDescription>
                Select languages you can provide notary services in (besides English)
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                      <Badge key={language} variant="secondary">
                        {language}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* File Uploads */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Required Documents
              </CardTitle>
              <CardDescription>
                Upload all required notary documents (PDF, JPG, PNG - max 10MB each)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  description="Upload your digital public certificate (PFX file)"
                />

                <FileUploadCard
                  title="Bond Certificate"
                  fileType="bondFile"
                  description="Upload your notary bond certificate"
                />

                {form.watch('signingAgentCertified') && (
                  <FileUploadCard
                    title="NSA Certification"
                    fileType="signingAgentFile"
                    required={false}
                    description="Upload your NSA certification document"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit Section */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    By submitting this form, you confirm that all information provided is accurate and complete. 
                    Your profile will be reviewed by an administrator before your account is activated.
                  </AlertDescription>
                </Alert>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation('/login')}
                    disabled={isSubmitting}
                  >
                    Save as Draft & Logout
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || completionProgress < 90}
                    className="min-w-[200px]"
                  >
                    {isSubmitting ? 'Submitting...' : 'Complete Profile'}
                  </Button>
                </div>
                
                {completionProgress < 90 && (
                  <p className="text-sm text-orange-600 text-center">
                    Please complete at least 90% of the form to submit
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
} 