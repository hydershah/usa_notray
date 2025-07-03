import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ArrowLeft, ArrowRight, Plus, Trash2, Upload, FileText, CheckCircle, AlertCircle, User as UserIcon, Clock } from 'lucide-react';
import { type TitleCompany, type ClosingType, type User } from '@shared/schema';

const jobSchema = z.object({
  titleCompany: z.string().min(1, 'Title company is required'),
  closingType: z.string().min(1, 'Closing type is required'),
  internalReference: z.string().optional(),
  kbaRequired: z.boolean().default(false),
  propertyAddressOne: z.string().min(1, 'Property address is required').min(5, 'Address must be at least 5 characters'),
  propertyAddressTwo: z.string().optional(),
  propertyCity: z.string().min(1, 'City is required').min(2, 'City must be at least 2 characters'),
  propertyState: z.string().min(1, 'State is required').length(2, 'Please select a valid state'),
  propertyZipCode: z.string()
    .min(1, 'ZIP code is required')
    .regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format (12345 or 12345-6789)'),
  notaryOption: z.enum(['assign', 'auto']),
  selectedNotary: z.string().optional(),
  selectedDate: z.string().optional(),
  selectedTime: z.string().optional(),
  requiresNSA: z.boolean().default(false),
  requiresSpanishSpeaking: z.boolean().default(false),
});

const signerSchema = z.object({
  signerName: z.string().min(1, 'Signer name is required').min(2, 'Name must be at least 2 characters'),
  signerEmail: z.string().min(1, 'Email is required').email('Valid email is required'),
  signerPhoneNumber: z.string()
    .min(1, 'Phone number is required')
    .regex(/^[\d\s\-\(\)\+]+$/, 'Invalid phone number format')
    .min(10, 'Phone number must be at least 10 digits'),
  signerRole: z.string().min(1, 'Signer role is required'),
});

type JobFormData = z.infer<typeof jobSchema>;
type SignerFormData = z.infer<typeof signerSchema> & {
  existingUserId?: number;
};

interface DocumentFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  isRequired: boolean;
  documentType: 'original' | 'additional';
}

const steps = [
  { id: 1, title: 'Client Info', description: 'Basic job information' },
  { id: 2, title: 'Signers', description: 'Add signers to the job' },
  { id: 3, title: 'Schedule', description: 'Set appointment details' },
  { id: 4, title: 'Documents', description: 'Upload required files' },
  { id: 5, title: 'Review', description: 'Review and submit' },
];

export function JobWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [signers, setSigners] = useState<SignerFormData[]>([]);
  const [signerErrors, setSignerErrors] = useState<Record<number, Record<string, string>>>({});
  const [signerModes, setSignerModes] = useState<Record<number, 'existing' | 'new'>>({});
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Random notary assignment states
  const [availableTimeSlots, setAvailableTimeSlots] = useState<any[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<any>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [preferredNotary, setPreferredNotary] = useState<any>(null);

  // Get current user data to check permissions
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
  });

  // Check if user has permission to create jobs
  const canCreateJob = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.role === 'title_company' ||
    (currentUser.role === 'notary' && currentUser.notaryType === 'subscriber')
  );

  // Redirect if user doesn't have permission
  React.useEffect(() => {
    if (currentUser && !canCreateJob) {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "You don't have permission to create jobs. Only administrators, title companies, and subscriber notaries can create jobs.",
      });
      setLocation('/jobs');
    }
  }, [currentUser, canCreateJob, setLocation, toast]);

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      kbaRequired: false,
      notaryOption: 'auto',
      requiresNSA: false,
      requiresSpanishSpeaking: false,
    },
  });

  const { data: titleCompanies = [] } = useQuery<TitleCompany[]>({
    queryKey: ['/api/companies'],
  });

  const { data: notaries = [] } = useQuery<any[]>({
    queryKey: ['/api/notaries/available'],
    queryFn: async () => {
      const response = await fetch('/api/notaries/available', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch available notaries');
      }
      return response.json();
    }
  });

  const { data: existingSigners = [] } = useQuery<any[]>({
    queryKey: ['/api/users/signers'],
    queryFn: async () => {
      const response = await fetch('/api/users/signers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch existing signers');
      }
      return response.json();
    }
  });

  const { data: closingTypes = [] } = useQuery<ClosingType[]>({
    queryKey: ['/api/closing-types/active'],
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: data,
      });
      
      if (!response.ok) {
        throw new Error('Failed to create job');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Success",
        description: "Job created successfully with all documents!",
      });
      setLocation('/jobs');
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create job.",
      });
    },
  });

  // Check for preferred notary when title company changes
  const watchTitleCompany = form.watch('titleCompany');
  React.useEffect(() => {
    if (watchTitleCompany && form.watch('notaryOption') === 'auto') {
      checkPreferredNotary(watchTitleCompany);
    }
  }, [watchTitleCompany]);

  const checkPreferredNotary = async (companyName: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/title-companies/${encodeURIComponent(companyName)}/preferred-notary`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const company = await response.json();
        if (company.preferredNotaryId && company.preferredNotaryActive) {
          setPreferredNotary({
            id: company.preferredNotaryId,
            name: company.preferredNotaryName,
            firstName: company.preferredNotaryFirstName,
            lastName: company.preferredNotaryLastName,
            email: company.preferredNotaryEmail
          });
        } else {
          setPreferredNotary(null);
        }
      }
    } catch (error) {
      console.error('Error checking preferred notary:', error);
      setPreferredNotary(null);
    }
  };

  // Load available time slots for random assignment
  const loadAvailableTimeSlots = async (date: string) => {
    if (form.watch('notaryOption') !== 'auto' || preferredNotary) return;

    setIsLoadingAvailability(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const qualifications = {
        requiresNSA: form.watch('requiresNSA'),
        requiresSpanishSpeaking: form.watch('requiresSpanishSpeaking')
      };

      const queryParams = new URLSearchParams({
        requiresNSA: qualifications.requiresNSA.toString(),
        requiresSpanishSpeaking: qualifications.requiresSpanishSpeaking.toString()
      });

      const response = await fetch(`/api/random-notary/availability/${date}?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const availability = await response.json();
        setAvailableTimeSlots(availability.timeSlots || []);
      } else {
        setAvailableTimeSlots([]);
        toast({
          variant: "destructive",
          title: "No Availability",
          description: "No qualified notaries are available for the selected requirements.",
        });
      }
    } catch (error) {
      console.error('Error loading availability:', error);
      setAvailableTimeSlots([]);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load notary availability. Please try again.",
      });
    } finally {
      setIsLoadingAvailability(false);
    }
  };

  // Handle date selection for random assignment
  const handleDateSelection = (date: string) => {
    form.setValue('selectedDate', date);
    setSelectedTimeSlot(null);
    if (date && form.watch('notaryOption') === 'auto' && !preferredNotary) {
      loadAvailableTimeSlots(date);
    }
  };

  // Handle time slot selection for random assignment  
  const handleTimeSlotSelection = (timeSlot: any) => {
    setSelectedTimeSlot(timeSlot);
    form.setValue('selectedTime', timeSlot.startTime);
  };

  const validateStep = async (step: number) => {
    switch (step) {
      case 1:
        // Validate client information
        const fieldsToValidate = [
          'titleCompany', 'closingType', 'propertyAddressOne', 
          'propertyCity', 'propertyState', 'propertyZipCode'
        ] as const;
        
        const results = await Promise.all(
          fieldsToValidate.map(field => form.trigger(field))
        );
        
        if (!results.every(result => result)) {
          toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please fill in all required fields correctly.",
          });
          return false;
        }
        return true;

      case 2:
        // Validate signers
        if (signers.length === 0) {
          toast({
            variant: "destructive",
            title: "No Signers",
            description: "Please add at least one signer.",
          });
          return false;
        }

        // Validate each signer
        const invalidSigners: number[] = [];
        signers.forEach((signer, index) => {
          try {
            signerSchema.parse(signer);
          } catch (error) {
            invalidSigners.push(index + 1);
          }
        });

        if (invalidSigners.length > 0) {
          toast({
            variant: "destructive",
            title: "Invalid Signer Information",
            description: `Please check signer(s): ${invalidSigners.join(', ')}`,
          });
          return false;
        }
        return true;

      case 3:
        // Schedule validation is optional for now
        return true;

      case 4:
        // Validate documents
        if (documents.length === 0) {
          toast({
            variant: "destructive",
            title: "No Documents",
            description: "Please upload at least one document.",
          });
          return false;
        }
        return true;

      case 5:
        // Review step - validate all previous steps
        const allFieldsValid = await form.trigger();
        if (!allFieldsValid) {
          toast({
            variant: "destructive",
            title: "Missing Information",
            description: "Please complete all required fields.",
          });
          return false;
        }
        
        if (signers.length === 0 || documents.length === 0) {
          toast({
            variant: "destructive",
            title: "Incomplete Job",
            description: "Please add signers and documents before submitting.",
          });
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleAddSigner = () => {
    const newIndex = signers.length;
    setSigners(prev => [...prev, {
      signerName: '',
      signerEmail: '',
      signerPhoneNumber: '',
      signerRole: '',
    }]);
    setSignerModes(prev => ({ ...prev, [newIndex]: 'new' }));
  };

  const handleRemoveSigner = (index: number) => {
    setSigners(prev => prev.filter((_, i) => i !== index));
    setSignerModes(prev => {
      const newModes = { ...prev };
      delete newModes[index];
      // Reindex remaining modes
      const reindexedModes: Record<number, 'existing' | 'new'> = {};
      Object.entries(newModes).forEach(([key, value]) => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          reindexedModes[oldIndex - 1] = value;
        } else if (oldIndex < index) {
          reindexedModes[oldIndex] = value;
        }
      });
      return reindexedModes;
    });
  };

  const handleSignerModeChange = (index: number, mode: 'existing' | 'new') => {
    setSignerModes(prev => ({ ...prev, [index]: mode }));
    if (mode === 'new') {
      // Clear fields when switching to new mode
      setSigners(prev => prev.map((signer, i) => 
        i === index ? {
          signerName: '',
          signerEmail: '',
          signerPhoneNumber: '',
          signerRole: '',
        } : signer
      ));
    }
  };

  const handleExistingSignerSelect = (index: number, userId: string) => {
    const selectedUser = existingSigners.find(user => user.id.toString() === userId);
    if (selectedUser) {
      setSigners(prev => prev.map((signer, i) => 
        i === index ? {
          signerName: selectedUser.firstName && selectedUser.lastName 
            ? `${selectedUser.firstName} ${selectedUser.lastName}` 
            : selectedUser.username,
          signerEmail: selectedUser.email,
          signerPhoneNumber: selectedUser.phoneNumber || '',
          signerRole: '',
          existingUserId: selectedUser.id, // Store the user ID for reference
        } : signer
      ));
    }
  };

  const handleSignerChange = (index: number, field: keyof SignerFormData, value: string) => {
    setSigners(prev => prev.map((signer, i) => 
      i === index ? { ...signer, [field]: value } : signer
    ));
    
    // Clear error for this field when user starts typing
    setSignerErrors(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: ''
      }
    }));
  };

  const validateSigner = (signer: SignerFormData, index: number) => {
    const errors: Record<string, string> = {};
    
    try {
      signerSchema.parse(signer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => {
          if (err.path[0]) {
            errors[err.path[0] as string] = err.message;
          }
        });
      }
    }
    
    setSignerErrors(prev => ({
      ...prev,
      [index]: errors
    }));
    
    return Object.keys(errors).length === 0;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      const invalidFiles: string[] = [];
      
      const validFiles = Array.from(files).filter(file => {
        if (file.size > maxSize) {
          invalidFiles.push(`${file.name} (exceeds 10MB)`);
          return false;
        }
        if (!allowedTypes.includes(file.type)) {
          invalidFiles.push(`${file.name} (invalid type, only PDF/JPG/PNG allowed)`);
          return false;
        }
        return true;
      });

      if (invalidFiles.length > 0) {
        toast({
          variant: "destructive",
          title: "Invalid Files",
          description: `The following files were rejected: ${invalidFiles.join(', ')}`,
        });
      }

      if (validFiles.length > 0) {
        const newDocuments: DocumentFile[] = validFiles.map(file => ({
          id: Math.random().toString(36).substring(2) + Date.now().toString(36),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          isRequired: true,
          documentType: 'original' as const,
        }));
        
        setDocuments(prev => [...prev, ...newDocuments]);
      }
    }
    // Clear the input to allow re-selecting the same file
    event.target.value = '';
  };

  const handleRemoveDocument = (documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
  };

  const handleToggleRequired = (documentId: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === documentId ? { ...doc, isRequired: !doc.isRequired } : doc
    ));
  };

  const handleSubmit = async (data: JobFormData) => {
    // Prevent double submission
    if (isSubmitting) return;
    
    // Validate all steps before submitting
    let allValid = true;
    
    // Validate signers
    if (signers.length === 0) {
      toast({
        variant: "destructive",
        title: "No Signers",
        description: "Please add at least one signer.",
      });
      setCurrentStep(2);
      return;
    }
    
    signers.forEach((signer, index) => {
      if (!validateSigner(signer, index)) {
        allValid = false;
      }
    });
    
    if (!allValid) {
      toast({
        variant: "destructive",
        title: "Invalid Signer Information",
        description: "Please fix signer information errors.",
      });
      setCurrentStep(2);
      return;
    }
    
    // Validate documents
    if (documents.length === 0) {
      toast({
        variant: "destructive",
        title: "No Documents",
        description: "Please upload at least one document.",
      });
      setCurrentStep(4);
      return;
    }
    
    setIsSubmitting(true);
    
    const formData = new FormData();
    
    // Add job data
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, value.toString());
      }
    });
    
    // Add signers
    formData.append('signers', JSON.stringify(signers));
    
    // Add multiple documents
    documents.forEach((doc, index) => {
      formData.append(`documents`, doc.file);
      formData.append(`documentMetadata_${index}`, JSON.stringify({
        originalName: doc.name,
        isRequired: doc.isRequired,
        documentType: doc.documentType,
      }));
    });
    
    try {
      await createJobMutation.mutateAsync(formData);
    } catch (error) {
      setIsSubmitting(false);
    }
  };

  const progress = (currentStep / steps.length) * 100;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Enhanced Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Create New Job</h1>
          <p className="text-lg text-gray-600">Follow the steps below to create your notarization job</p>
        </div>

        {/* Enhanced Progress Indicator */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  {/* Step Circle */}
                  <div className={`relative w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    currentStep > step.id 
                      ? 'bg-green-500 text-white shadow-lg' 
                      : currentStep === step.id 
                        ? 'bg-blue-600 text-white shadow-lg ring-4 ring-blue-200' 
                        : 'bg-gray-200 text-gray-600'
                  }`}>
                    {currentStep > step.id ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <span>{step.id}</span>
                    )}
                    
                    {/* Pulse animation for current step */}
                    {currentStep === step.id && (
                      <div className="absolute inset-0 rounded-full bg-blue-600 animate-ping opacity-25"></div>
                    )}
                  </div>
                  
                  {/* Step Labels */}
                  <div className="mt-3 text-center">
                    <div className={`text-sm font-medium transition-colors ${
                      currentStep >= step.id ? 'text-blue-600' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </div>
                    <div className={`text-xs mt-1 ${
                      currentStep >= step.id ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      {step.description}
                    </div>
                  </div>
                </div>
                
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 transition-colors ${
                    currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                  }`}></div>
                )}
              </div>
            ))}
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Main Content Card */}
        <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8 md:p-12">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
                
                {/* Step 1: Client Information */}
                {currentStep === 1 && (
                  <div className="space-y-8">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-blue-600" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Client Information</h2>
                      {currentUser?.role === 'notary' && currentUser?.notaryType === 'subscriber' ? (
                        <p className="text-gray-600">Create a new job for your personal clients</p>
                      ) : (
                        <p className="text-gray-600">Create a new title company job</p>
                      )}
                    </div>

                    {/* Different messaging based on user type */}
                    {currentUser?.role === 'notary' && currentUser?.notaryType === 'subscriber' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <UserIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                          </div>
                          <div className="ml-3">
                            <h4 className="text-sm font-medium text-blue-900">Personal Client Job</h4>
                            <p className="text-sm text-blue-800 mt-1">
                              You're creating a job for your personal clients. You will automatically be assigned as the notary for this job.
                              Platform fees will be deducted from your account upon completion.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {(currentUser?.role === 'admin' || currentUser?.role === 'title_company') && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          </div>
                          <div className="ml-3">
                            <h4 className="text-sm font-medium text-green-900">Title Company Job</h4>
                            <p className="text-sm text-green-800 mt-1">
                              You're creating a job for USA Notary clients. The system will assign a qualified contractor notary based on your preferences.
                              The assigned notary will be paid from the client fees.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                        <div className="w-2 h-6 bg-blue-500 rounded-full mr-3"></div>
                        Primary Details
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="titleCompany"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">Title Company *</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                                    <SelectValue placeholder="Select title company" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {titleCompanies.map((company: any) => (
                                    <SelectItem key={company.id} value={company.companyName}>
                                      {company.companyName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="closingType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">Closing Type *</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                                    <SelectValue placeholder="Select closing type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {closingTypes.map((closingType: any) => (
                                    <SelectItem key={closingType.id} value={closingType.name}>
                                      {closingType.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <FormField
                          control={form.control}
                          name="internalReference"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">Internal Reference</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter internal reference" 
                                  className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="kbaRequired"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">KBA Required</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={(value) => field.onChange(value === 'true')}
                                  defaultValue={field.value ? 'true' : 'false'}
                                  className="flex items-center space-x-8 mt-2"
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="true" id="kba-yes" />
                                    <Label htmlFor="kba-yes" className="text-sm font-medium">Yes</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="false" id="kba-no" />
                                    <Label htmlFor="kba-no" className="text-sm font-medium">No</Label>
                                  </div>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Property Address */}
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                        <div className="w-2 h-6 bg-green-500 rounded-full mr-3"></div>
                        Property Address
                      </h3>
                      
                      <div className="space-y-6">
                        <FormField
                          control={form.control}
                          name="propertyAddressOne"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">Address Line 1 *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter street address" 
                                  className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="propertyAddressTwo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">Address Line 2</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Apt, suite, etc. (optional)" 
                                  className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <FormField
                            control={form.control}
                            name="propertyCity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">City *</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="Enter city" 
                                    className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="propertyState"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">State *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                                      <SelectValue placeholder="Select state" />
                                    </SelectTrigger>
                                  </FormControl>
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
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="propertyZipCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">ZIP Code *</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="Enter ZIP code" 
                                    className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Signers */}
                {currentStep === 2 && (
                  <div className="space-y-8">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserIcon className="w-8 h-8 text-green-600" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Signer Information</h2>
                      <p className="text-gray-600">Add all the signers who will participate in this notarization</p>
                    </div>

                    <div className="flex items-center justify-between bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <AlertCircle className="w-5 h-5 text-blue-600 mr-2" />
                        <span className="text-sm font-medium text-blue-800">
                          {signers.length} signer{signers.length !== 1 ? 's' : ''} added
                        </span>
                      </div>
                      <Button 
                        type="button" 
                        onClick={handleAddSigner} 
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Signer
                      </Button>
                    </div>

                    {signers.length === 0 ? (
                      <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <UserIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No signers added yet</h3>
                        <p className="text-gray-600 mb-6">Click "Add Signer" to get started</p>
                        <Button 
                          type="button" 
                          onClick={handleAddSigner} 
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Your First Signer
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {signers.map((signer, index) => (
                          <Card key={index} className="border-2 border-gray-100 hover:border-blue-200 transition-colors">
                            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm mr-3">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-gray-900">
                                      {signer.signerName || `Signer ${index + 1}`}
                                    </h4>
                                    <p className="text-sm text-gray-600">
                                      {signer.signerRole || 'Role not specified'}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveSigner(index)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardHeader>
                            
                            <CardContent className="p-6">
                              {/* Mode Selection */}
                              <div className="mb-6">
                                <Label className="text-sm font-medium text-gray-700 mb-3 block">Signer Type</Label>
                                <RadioGroup
                                  value={signerModes[index] || 'new'}
                                  onValueChange={(value: 'existing' | 'new') => handleSignerModeChange(index, value)}
                                  className="grid grid-cols-2 gap-4"
                                >
                                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                                    <RadioGroupItem value="existing" id={`existing-${index}`} />
                                    <div>
                                      <Label htmlFor={`existing-${index}`} className="font-medium text-gray-900">Existing User</Label>
                                      <p className="text-xs text-gray-600">Select from registered users</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                                    <RadioGroupItem value="new" id={`new-${index}`} />
                                    <div>
                                      <Label htmlFor={`new-${index}`} className="font-medium text-gray-900">New Signer</Label>
                                      <p className="text-xs text-gray-600">Add new person details</p>
                                    </div>
                                  </div>
                                </RadioGroup>
                              </div>

                              {/* Existing User Selection */}
                              {signerModes[index] === 'existing' && (
                                <div className="mb-6">
                                  <Label className="text-sm font-medium text-gray-700">Select User</Label>
                                  <Select onValueChange={(value) => handleExistingSignerSelect(index, value)}>
                                    <SelectTrigger className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 mt-2">
                                      <SelectValue placeholder="Choose an existing user" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {existingSigners.map((user: any) => (
                                        <SelectItem key={user.id} value={user.id.toString()}>
                                          <div className="flex items-center justify-between w-full">
                                            <span className="font-medium">
                                              {user.firstName && user.lastName 
                                                ? `${user.firstName} ${user.lastName}` 
                                                : user.username}
                                            </span>
                                            <span className="text-xs text-gray-500 ml-2">
                                              {user.email}
                                            </span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {/* Signer Details */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <Label className={`text-sm font-medium ${signerErrors[index]?.signerName ? 'text-red-600' : 'text-gray-700'}`}>
                                    Signer Name *
                                  </Label>
                                  <Input
                                    value={signer.signerName}
                                    onChange={(e) => handleSignerChange(index, 'signerName', e.target.value)}
                                    placeholder="Enter signer name"
                                    className={`h-12 mt-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${signerErrors[index]?.signerName ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                                    onBlur={() => validateSigner(signer, index)}
                                    disabled={signerModes[index] === 'existing'}
                                  />
                                  {signerErrors[index]?.signerName && (
                                    <p className="text-sm text-red-600 mt-1">{signerErrors[index].signerName}</p>
                                  )}
                                </div>
                                
                                <div>
                                  <Label className={`text-sm font-medium ${signerErrors[index]?.signerEmail ? 'text-red-600' : 'text-gray-700'}`}>
                                    Email Address *
                                  </Label>
                                  <Input
                                    type="email"
                                    value={signer.signerEmail}
                                    onChange={(e) => handleSignerChange(index, 'signerEmail', e.target.value)}
                                    placeholder="Enter email address"
                                    className={`h-12 mt-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${signerErrors[index]?.signerEmail ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                                    onBlur={() => validateSigner(signer, index)}
                                    disabled={signerModes[index] === 'existing'}
                                  />
                                  {signerErrors[index]?.signerEmail && (
                                    <p className="text-sm text-red-600 mt-1">{signerErrors[index].signerEmail}</p>
                                  )}
                                </div>
                                
                                <div>
                                  <Label className={`text-sm font-medium ${signerErrors[index]?.signerPhoneNumber ? 'text-red-600' : 'text-gray-700'}`}>
                                    Phone Number *
                                  </Label>
                                  <Input
                                    value={signer.signerPhoneNumber}
                                    onChange={(e) => handleSignerChange(index, 'signerPhoneNumber', e.target.value)}
                                    placeholder="(123) 456-7890"
                                    className={`h-12 mt-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${signerErrors[index]?.signerPhoneNumber ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                                    onBlur={() => validateSigner(signer, index)}
                                    disabled={signerModes[index] === 'existing'}
                                  />
                                  {signerErrors[index]?.signerPhoneNumber && (
                                    <p className="text-sm text-red-600 mt-1">{signerErrors[index].signerPhoneNumber}</p>
                                  )}
                                </div>
                                
                                <div>
                                  <Label className={`text-sm font-medium ${signerErrors[index]?.signerRole ? 'text-red-600' : 'text-gray-700'}`}>
                                    Role *
                                  </Label>
                                  <Select
                                    value={signer.signerRole}
                                    onValueChange={(value) => {
                                      handleSignerChange(index, 'signerRole', value);
                                      validateSigner({ ...signer, signerRole: value }, index);
                                    }}
                                  >
                                    <SelectTrigger className={`h-12 mt-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${signerErrors[index]?.signerRole ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}>
                                      <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="borrower">Borrower</SelectItem>
                                      <SelectItem value="co-borrower">Co-Borrower</SelectItem>
                                      <SelectItem value="seller">Seller</SelectItem>
                                      <SelectItem value="buyer">Buyer</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {signerErrors[index]?.signerRole && (
                                    <p className="text-sm text-red-600 mt-1">{signerErrors[index].signerRole}</p>
                                  )}
                                </div>
                              </div>

                              {/* Existing User Info */}
                              {signerModes[index] === 'existing' && signer.existingUserId && (
                                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                  <div className="flex items-center">
                                    <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />
                                    <div>
                                      <p className="text-sm font-medium text-blue-800">
                                        Selected User: {signer.signerName}
                                      </p>
                                      <p className="text-xs text-blue-600">
                                        {signer.signerEmail} • Information auto-populated
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Schedule */}
                {currentStep === 3 && (
                  <div className="space-y-8">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-8 h-8 text-purple-600" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Schedule Appointment</h2>
                      {currentUser?.role === 'notary' && currentUser?.notaryType === 'subscriber' ? (
                        <p className="text-gray-600">Set the appointment details for your personal client job</p>
                      ) : (
                        <p className="text-gray-600">Choose how you'd like to assign a notary and schedule the appointment</p>
                      )}
                    </div>
                    
                    {/* Subscriber Notary: Simple date/time selection */}
                    {currentUser?.role === 'notary' && currentUser?.notaryType === 'subscriber' ? (
                      <div className="space-y-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start">
                            <div className="flex-shrink-0">
                              <UserIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                            </div>
                            <div className="ml-3">
                              <h4 className="text-sm font-medium text-blue-900">You are the assigned notary</h4>
                              <p className="text-sm text-blue-800 mt-1">
                                As a subscriber notary, you are automatically assigned to handle this job for your personal clients.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                            <div className="w-2 h-6 bg-purple-500 rounded-full mr-3"></div>
                            Appointment Details
                          </h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                              control={form.control}
                              name="selectedDate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-gray-700">Appointment Date</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="selectedTime"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-gray-700">Appointment Time</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="time"
                                      {...field}
                                      className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Title Company/Admin: Full notary assignment workflow */
                      <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                          <div className="w-2 h-6 bg-purple-500 rounded-full mr-3"></div>
                          Notary Assignment
                        </h3>
                        
                        <FormField
                          control={form.control}
                          name="notaryOption"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700 mb-4 block">Assignment Method</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={(value) => {
                                    field.onChange(value);
                                    if (value === 'auto') {
                                      form.setValue('selectedNotary', undefined);
                                      if (watchTitleCompany) {
                                        checkPreferredNotary(watchTitleCompany);
                                      }
                                    } else {
                                      setPreferredNotary(null);
                                    }
                                  }}
                                  defaultValue={field.value}
                                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                                >
                                  <div className="relative">
                                    <div className="flex items-start space-x-4 p-6 border-2 rounded-xl hover:border-blue-200 transition-colors cursor-pointer">
                                      <RadioGroupItem value="assign" id="assign" className="mt-1" />
                                      <div className="flex-1">
                                        <Label htmlFor="assign" className="text-lg font-semibold text-gray-900 cursor-pointer">Assign Specific Notary</Label>
                                        <p className="text-sm text-gray-600 mt-1">Choose from available contractor notaries</p>
                                        <div className="mt-3 flex items-center text-xs text-blue-600">
                                          <CheckCircle className="w-4 h-4 mr-1" />
                                          Direct selection control
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="relative">
                                    <div className="flex items-start space-x-4 p-6 border-2 rounded-xl hover:border-blue-200 transition-colors cursor-pointer">
                                      <RadioGroupItem value="auto" id="auto" className="mt-1" />
                                      <div className="flex-1">
                                        <Label htmlFor="auto" className="text-lg font-semibold text-gray-900 cursor-pointer">Auto Assignment</Label>
                                        <p className="text-sm text-gray-600 mt-1">System assigns best contractor notary match</p>
                                        <div className="mt-3 flex items-center text-xs text-green-600">
                                          <CheckCircle className="w-4 h-4 mr-1" />
                                          Optimal matching algorithm
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Show preferred notary info when auto assignment is selected */}
                        {form.watch('notaryOption') === 'auto' && preferredNotary && (
                          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center">
                              <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                              <div>
                                <p className="text-sm font-medium text-green-800">
                                  Preferred Contractor Available: {preferredNotary.fullName}
                                </p>
                                <p className="text-xs text-green-600 mt-1">
                                  This contractor notary is preferred by {watchTitleCompany}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Manual notary selection - only contractor notaries */}
                        {form.watch('notaryOption') === 'assign' && (
                          <div className="mt-6">
                            <FormField
                              control={form.control}
                              name="selectedNotary"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-gray-700">Select Contractor Notary</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 mt-2">
                                        <SelectValue placeholder="Choose a contractor notary" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {notaries.filter(notary => notary.notaryType === 'contractor').map((notary: any) => (
                                        <SelectItem key={notary.id} value={notary.id.toString()}>
                                          <div className="flex items-center justify-between w-full">
                                            <span className="font-medium">{notary.fullName}</span>
                                            <span className="text-xs text-gray-500 ml-2">{notary.email}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Additional Requirements - only for title company jobs */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'title_company') && (
                      <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                          <div className="w-2 h-6 bg-orange-500 rounded-full mr-3"></div>
                          Special Requirements
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={form.control}
                            name="requiresNSA"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-3 p-4 border rounded-lg">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div>
                                  <FormLabel className="text-sm font-medium text-gray-900">NSA Required</FormLabel>
                                  <p className="text-xs text-gray-600">Notary Signing Agent certification required</p>
                                </div>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="requiresSpanishSpeaking"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-3 p-4 border rounded-lg">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div>
                                  <FormLabel className="text-sm font-medium text-gray-900">Spanish Speaking</FormLabel>
                                  <p className="text-xs text-gray-600">Bilingual notary required</p>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4: Documents */}
                {currentStep === 4 && (
                  <div className="space-y-8">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Upload className="w-8 h-8 text-indigo-600" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Documents</h2>
                      <p className="text-gray-600">Add all the documents that need to be notarized</p>
                    </div>
                    
                    <div className="flex items-center justify-between bg-indigo-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-indigo-600 mr-2" />
                        <span className="text-sm font-medium text-indigo-800">
                          {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded
                        </span>
                      </div>
                      <div className="text-xs text-indigo-600">
                        PDF, DOC, DOCX supported • Max 10MB each
                      </div>
                    </div>
                    
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-400 transition-colors">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Upload className="h-8 w-8 text-blue-600" />
                      </div>
                      <div className="mb-6">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload Multiple Documents</h3>
                        <p className="text-gray-600">Drag and drop files here, or click to browse your computer</p>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                      />
                      <Button
                        type="button"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
                      >
                        <Plus className="h-5 w-5 mr-3" />
                        Select Documents
                      </Button>
                      <p className="text-sm text-gray-500 mt-4">
                        Supported formats: PDF, DOC, DOCX, JPG, PNG • Maximum 10MB per file
                      </p>
                    </div>

                    {/* Document List */}
                    {documents.length > 0 && (
                      <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                          <div className="w-2 h-6 bg-indigo-500 rounded-full mr-3"></div>
                          Uploaded Documents
                        </h3>
                        
                        <div className="space-y-4">
                          {documents.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                              <div className="flex items-center flex-1">
                                <FileText className="h-8 w-8 text-blue-600 mr-4" />
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900">{doc.name}</h4>
                                  <div className="flex items-center space-x-4 mt-1">
                                    <span className="text-sm text-gray-500">{formatFileSize(doc.size)}</span>
                                    <Badge variant={doc.isRequired ? "default" : "secondary"} className="text-xs">
                                      {doc.isRequired ? 'Required' : 'Optional'}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleRequired(doc.id)}
                                  className="text-xs"
                                >
                                  {doc.isRequired ? 'Make Optional' : 'Make Required'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveDocument(doc.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 5: Review */}
                {currentStep === 5 && (
                  <div className="space-y-8">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Job Details</h2>
                      <p className="text-gray-600">Please review all the information before submitting your job</p>
                    </div>
                    
                    {/* Client Information Summary */}
                    <Card className="border-2 border-gray-100">
                      <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                          <CheckCircle className="h-6 w-6 text-green-500 mr-3" />
                          Client Information
                        </h3>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                          <div className="space-y-3">
                            <div>
                              <span className="text-gray-600 font-medium">Title Company:</span>
                              <p className="text-gray-900 font-semibold">{form.watch('titleCompany') || 'Not specified'}</p>
                            </div>
                            <div>
                              <span className="text-gray-600 font-medium">Closing Type:</span>
                              <p className="text-gray-900 font-semibold">{form.watch('closingType') || 'Not specified'}</p>
                            </div>
                            <div>
                              <span className="text-gray-600 font-medium">Internal Reference:</span>
                              <p className="text-gray-900">{form.watch('internalReference') || 'None'}</p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <span className="text-gray-600 font-medium">KBA Required:</span>
                              <p className="text-gray-900">{form.watch('kbaRequired') ? 'Yes' : 'No'}</p>
                            </div>
                            <div>
                              <span className="text-gray-600 font-medium">Property Address:</span>
                              <p className="text-gray-900">
                                {form.watch('propertyAddressOne')}<br />
                                {form.watch('propertyAddressTwo') && <>{form.watch('propertyAddressTwo')}<br /></>}
                                {form.watch('propertyCity')}, {form.watch('propertyState')} {form.watch('propertyZipCode')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Signers Summary */}
                    <Card className="border-2 border-gray-100">
                      <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 border-b">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                          <CheckCircle className="h-6 w-6 text-green-500 mr-3" />
                          Signers ({signers.length})
                        </h3>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          {signers.map((signer, index) => (
                            <div key={index} className="p-4 bg-gray-50 rounded-lg border">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm mr-3">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-gray-900">{signer.signerName}</h4>
                                    <p className="text-sm text-gray-600">{signer.signerEmail}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <Badge variant="outline">{signer.signerRole}</Badge>
                                  <p className="text-xs text-gray-500 mt-1">{signer.signerPhoneNumber}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Documents Summary */}
                    <Card className="border-2 border-gray-100">
                      <CardHeader className="bg-gradient-to-r from-indigo-50 to-indigo-100 border-b">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                          <CheckCircle className="h-6 w-6 text-green-500 mr-3" />
                          Documents ({documents.length})
                        </h3>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="space-y-3">
                          {documents.map((doc, index) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                              <div className="flex items-center">
                                <FileText className="h-5 w-5 text-blue-600 mr-3" />
                                <div>
                                  <span className="font-medium text-gray-900">{doc.name}</span>
                                  <span className="text-sm text-gray-500 ml-2">({formatFileSize(doc.size)})</span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge variant={doc.isRequired ? "default" : "secondary"} className="text-xs">
                                  {doc.isRequired ? 'Required' : 'Optional'}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Final Confirmation */}
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
                      <div className="flex items-center">
                        <AlertCircle className="w-6 h-6 text-green-600 mr-3" />
                        <div>
                          <h3 className="font-semibold text-gray-900">Ready to Submit</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            By submitting this job, you confirm that all information is accurate and you authorize the notarization process.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Enhanced Navigation */}
                <div className="flex justify-between items-center pt-8 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentStep === 1}
                    className="px-6 py-3 border-2 border-gray-300 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <span>Step {currentStep} of {steps.length}</span>
                  </div>
                  
                  {currentStep < steps.length ? (
                    <Button 
                      type="button" 
                      onClick={handleNext}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-shadow"
                    >
                      Next Step
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Button 
                      type="submit" 
                      disabled={createJobMutation.isPending || isSubmitting}
                      className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:transform-none disabled:opacity-50"
                    >
                      {createJobMutation.isPending || isSubmitting ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                          Creating Job...
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <CheckCircle className="h-5 w-5 mr-2" />
                          Create Job
                        </div>
                      )}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
