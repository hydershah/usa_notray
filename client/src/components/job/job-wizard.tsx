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
import { type TitleCompany, type ClosingType, type User } from '@shared/types';
import { NotaryAvailabilitySelector } from './notary-availability-selector';
import { MainLayout } from '@/components/layout/main-layout';
import { JobCreationProgress } from './JobCreationProgress';

// Add props to support single-page rendering
interface JobWizardProps {
  singlePage?: boolean;
}

// Error Boundary component to catch crashes
class JobWizardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('JobWizard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <MainLayout>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
                <p className="text-gray-600 mb-4">The create job page encountered an error.</p>
                <Button onClick={() => window.location.reload()}>
                  Refresh Page
                </Button>
              </div>
            </div>
          </div>
        </MainLayout>
      );
    }

    return this.props.children;
  }
}

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
  notaryOption: z.enum(['assign', 'auto', 'admin_self', 'id_code']),
  selectedNotary: z.string().optional(),
  notaryIdCode: z.string().optional(),
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
  { id: 2, title: 'Participants', description: 'Add signers and witnesses' },
  { id: 3, title: 'Schedule', description: 'Set appointment details' },
  { id: 4, title: 'Documents', description: 'Upload required files' },
  { id: 5, title: 'Review', description: 'Review and submit' },
];

// Internal JobWizard component
function JobWizardInternal({ singlePage = false }: JobWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [signers, setSigners] = useState<SignerFormData[]>([{
    signerName: '',
    signerEmail: '',
    signerPhoneNumber: '',
    signerRole: '',
  }]);
  const [signerErrors, setSignerErrors] = useState<Record<number, Record<string, string>>>({});
  const [autoPopulatedSigners, setAutoPopulatedSigners] = useState<Record<number, boolean>>({});
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

  // Notary ID Code lookup state
  const [notaryIdCodeLookup, setNotaryIdCodeLookup] = useState<{
    isLoading: boolean;
    result: any | null;
    error: string | null;
  }>({
    isLoading: false,
    result: null,
    error: null
  });

  // Job creation progress state
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressStep, setProgressStep] = useState('preparing');
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [creationProgress, setCreationProgress] = useState(0);

  // CRITICAL FIX: Move all hooks to the top and never conditionally call them
  // Get current user data to check permissions
  const { data: currentUser, isLoading: isUserLoading, error: userError } = useQuery<User & { 
    companyName?: string; 
    isAdmin?: boolean; 
    isNotary?: boolean; 
  }>({
    queryKey: ['/api/auth/me'],
    retry: 3,
    retryDelay: 1000,
  });

  // Check if user is admin (multiple ways to be admin)
  const isAdmin = currentUser && (
    currentUser.role === 'admin' || 
    currentUser.isAdmin === true ||
    (currentUser as any).privileges?.includes('admin')
  );

  // Initialize form hook BEFORE any conditional logic
  const form = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      kbaRequired: false,
      notaryOption: 'auto', // Set default, will be updated in effect
      requiresNSA: false,
      requiresSpanishSpeaking: false,
      titleCompany: '', // Will be set in effect
    },
  });

  const { data: titleCompanies = [] } = useQuery<TitleCompany[]>({
    queryKey: ['/api/companies'],
    enabled: !!currentUser, // Only fetch when user is loaded
  });

  const { data: notaries = [] } = useQuery<any[]>({
    queryKey: ['/api/notaries/available'],
    enabled: !!currentUser, // Only fetch when user is loaded
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
    enabled: !!currentUser, // Only fetch when user is loaded
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
    enabled: !!currentUser, // Only fetch when user is loaded
  });

  const { data: participantRoles = [] } = useQuery<any[]>({
    queryKey: ['/api/participant-roles/active'],
    enabled: !!currentUser, // Only fetch when user is loaded
    queryFn: async () => {
      const response = await fetch('/api/participant-roles/active', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch participant roles');
      }
      return response.json();
    }
  });

  // MOVED: useMutation hook to top to prevent hooks order violation
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
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to create job');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    },
    onError: (error: any) => {
      console.error('Create job mutation error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create job.",
      });
    },
  });

  // CRITICAL: Move ALL form.watch and useEffect calls to the top
  const watchTitleCompany = form.watch('titleCompany');
  const watchNotaryOption = form.watch('notaryOption');

  // Check if user has permission to create jobs
  const canCreateJob = currentUser && (
    (currentUser as any).isAdmin ||
    (currentUser as any).role === 'admin' ||
    (currentUser as any).role === 'title_company' ||
    ((currentUser as any).role === 'notary' && (currentUser as any).notaryType === 'subscriber')
  );

  // Update form default value when user data loads
  React.useEffect(() => {
    if (currentUser && !isUserLoading) {
      const expectedDefault = isAdmin ? 'admin_self' : 'auto';
      const currentValue = form.getValues('notaryOption');
      
      if (currentValue !== expectedDefault) {
        form.setValue('notaryOption', expectedDefault);
      }
    }
  }, [currentUser, isAdmin, isUserLoading, form]);

  // Update form field when currentUser changes for title company users
  React.useEffect(() => {
    if (currentUser?.role === 'title_company' && currentUser?.companyName) {
      const currentValue = form.getValues('titleCompany');
      if (currentValue !== currentUser.companyName) {
        form.setValue('titleCompany', currentUser.companyName);
        // Force validation to clear any existing errors
        form.trigger('titleCompany');
      }
    }
  }, [currentUser?.companyName, currentUser?.role, form]);

  // Handle permission redirects with proper error handling
  React.useEffect(() => {
    if (currentUser && !isUserLoading && !canCreateJob) {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "You don't have permission to create jobs. Only administrators, title companies, and subscriber notaries can create jobs.",
      });
      setLocation('/jobs');
    }
  }, [currentUser, canCreateJob, isUserLoading, setLocation, toast]);

  // Check for preferred notary when title company changes
  React.useEffect(() => {
    if (watchTitleCompany && watchNotaryOption === 'auto') {
      checkPreferredNotary(watchTitleCompany);
    }
  }, [watchTitleCompany, watchNotaryOption]);

  // FIXED: Conditional rendering after all hooks
  // Show loading state while user data is loading
  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
            <p className="text-lg text-gray-600">Loading user data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if user data failed to load
  if (userError || (!currentUser && !isUserLoading)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <p className="text-lg text-red-600">Failed to load user data. Please refresh the page.</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Return null if user doesn't have permission (redirect will handle navigation)
  if (!canCreateJob) {
    return null;
  }

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

  // Lookup notary by ID code
  const lookupNotaryByCode = async (notaryCode: string) => {
    if (!notaryCode || notaryCode.length < 5) {
      setNotaryIdCodeLookup({ isLoading: false, result: null, error: null });
      form.setValue('selectedNotary', undefined);
      return;
    }

    // Validate format (CY followed by 4 digits)
    if (!/^CY\d{4}$/i.test(notaryCode)) {
      setNotaryIdCodeLookup({ 
        isLoading: false, 
        result: null, 
        error: 'Invalid format. Expected: CY#### (e.g., CY0123)' 
      });
      form.setValue('selectedNotary', undefined);
      return;
    }

    setNotaryIdCodeLookup({ isLoading: true, result: null, error: null });

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/notaries/by-code/${notaryCode.toUpperCase()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const notary = await response.json();
        setNotaryIdCodeLookup({ 
          isLoading: false, 
          result: notary, 
          error: null 
        });
        form.setValue('selectedNotary', notary.id.toString());
      } else if (response.status === 404) {
        setNotaryIdCodeLookup({ 
          isLoading: false, 
          result: null, 
          error: 'Notary not found or inactive' 
        });
        form.setValue('selectedNotary', undefined);
      } else if (response.status === 403) {
        setNotaryIdCodeLookup({ 
          isLoading: false, 
          result: null, 
          error: 'Access denied' 
        });
        form.setValue('selectedNotary', undefined);
      } else {
        throw new Error('Lookup failed');
      }
    } catch (error) {
      console.error('Error looking up notary by code:', error);
      setNotaryIdCodeLookup({ 
        isLoading: false, 
        result: null, 
        error: 'Lookup failed. Please try again.' 
      });
      form.setValue('selectedNotary', undefined);
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

  // Handle notary-specific date/time selection
  const handleNotaryDateTimeSelect = (date: string, time: string) => {
    form.setValue('selectedDate', date);
    form.setValue('selectedTime', time);
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
            title: "No Participants",
            description: "Please add at least one participant (signer or witness).",
          });
          return false;
        }

        // Validate each signer and set field-level errors
        const invalidSigners: number[] = [];
        let hasValidationErrors = false;
        
        signers.forEach((signer, index) => {
          const isValid = validateSigner(signer, index);
          if (!isValid) {
            invalidSigners.push(index + 1);
            hasValidationErrors = true;
          }
        });

        if (hasValidationErrors) {
          toast({
            variant: "destructive",
            title: "Invalid Participant Information",
            description: `Please check participant(s): ${invalidSigners.join(', ')}`,
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
            description: "Please add participants and documents before submitting.",
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
    setSigners(prev => [...prev, {
      signerName: '',
      signerEmail: '',
      signerPhoneNumber: '',
      signerRole: '',
    }]);
  };

  const handleRemoveSigner = (index: number) => {
    setSigners(prev => prev.filter((_, i) => i !== index));
    setAutoPopulatedSigners(prev => {
      const newAutoPopulated = { ...prev };
      delete newAutoPopulated[index];
      // Reindex remaining entries
      const reindexedAutoPopulated: Record<number, boolean> = {};
      Object.entries(newAutoPopulated).forEach(([key, value]) => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          reindexedAutoPopulated[oldIndex - 1] = value;
        } else if (oldIndex < index) {
          reindexedAutoPopulated[oldIndex] = value;
        }
      });
      return reindexedAutoPopulated;
    });
  };

  const handleEmailLookup = (index: number, email: string) => {
    // First update the email field
    setSigners(prev => prev.map((signer, i) => 
      i === index ? { ...signer, signerEmail: email } : signer
    ));

    // Check if email exists in existing signers
    const existingUser = existingSigners.find(user => 
      user.email.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      // Auto-populate fields from existing user
      setSigners(prev => prev.map((signer, i) => 
        i === index ? {
          signerName: existingUser.firstName && existingUser.lastName 
            ? `${existingUser.firstName} ${existingUser.lastName}` 
            : existingUser.username,
          signerEmail: existingUser.email,
          signerPhoneNumber: existingUser.phoneNumber || '',
          signerRole: signer.signerRole, // Keep the selected role
          existingUserId: existingUser.id,
        } : signer
      ));
      setAutoPopulatedSigners(prev => ({ ...prev, [index]: true }));
    } else {
      // Clear auto-population flag for manual entry
      setSigners(prev => prev.map((signer, i) => 
        i === index ? { ...signer, existingUserId: undefined } : signer
      ));
      setAutoPopulatedSigners(prev => ({ ...prev, [index]: false }));
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

  const submitJobWithProgress = async (data: JobFormData) => {
    const updateProgress = (step: string, progress: number, completed: string[] = []) => {
      setProgressStep(step);
      setCreationProgress(progress);
      setCompletedSteps(completed);
    };

    // Step 1: Preparing Job (20%)
    updateProgress('preparing', 20);
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UX

    const formData = new FormData();
    
    // Add job data
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, value.toString());
      }
    });
    
    // Add signers
    formData.append('signers', JSON.stringify(signers));
    
    // Step 2: Uploading Documents (40%)
    updateProgress('uploading', 40, ['preparing']);
    
    // Add multiple documents
    documents.forEach((doc, index) => {
      formData.append(`documents`, doc.file);
      formData.append(`documentMetadata_${index}`, JSON.stringify({
        originalName: doc.name,
        isRequired: doc.isRequired,
        documentType: doc.documentType,
      }));
    });

    // Step 3: Creating Participants (60%)
    updateProgress('creating-signers', 60, ['preparing', 'uploading']);
    
    try {
      // Call the actual API
      const result = await createJobMutation.mutateAsync(formData);
      
      // Step 4: Sending Invitations (80%)
      updateProgress('sending-invites', 80, ['preparing', 'uploading', 'creating-signers']);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for background processing
      
      // Step 5: Finalizing (100%)
      updateProgress('finalizing', 100, ['preparing', 'uploading', 'creating-signers', 'sending-invites']);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Job created successfully - redirect to job details
      setShowProgressModal(false);
      setIsSubmitting(false);
      
      toast({
        title: "Success",
        description: "Job created successfully with all documents!",
      });
      
      // Redirect to the job details page
      setLocation(`/jobs/${result.id}`);
      
    } catch (error: any) {
      setProgressError(error.message || 'Failed to create job');
      setProgressStep('preparing'); // Reset to first step on error
      throw error;
    }
  };

  const handleSubmit = async (data: JobFormData) => {
    // Prevent double submission
    if (isSubmitting) return;
    
    // Only allow submission on the final step
    if (!singlePage && currentStep !== steps.length) {
      return;
    }
    
    // Validate all steps before submitting
    let allValid = true;
    
    // Validate signers
    if (signers.length === 0) {
      toast({
        variant: "destructive",
        title: "No Participants",
        description: "Please add at least one participant (signer or witness).",
      });
      setCurrentStep(2);
      return;
    }
    
    const invalidSigners: number[] = [];
    signers.forEach((signer, index) => {
      if (!validateSigner(signer, index)) {
        allValid = false;
        invalidSigners.push(index + 1);
      }
    });
    
    if (!allValid) {
      toast({
        variant: "destructive",
        title: "Invalid Participant Information",
        description: `Please fix participant information errors for participant(s): ${invalidSigners.join(', ')}`,
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
    setShowProgressModal(true);
    setProgressError(null);
    setCompletedSteps([]);
    setCreationProgress(0);
    
    try {
      await submitJobWithProgress(data);
    } catch (error) {
      setIsSubmitting(false);
      setShowProgressModal(false);
      setProgressError(null);
      setCompletedSteps([]);
      setCreationProgress(0);
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
    <div className={singlePage ? "min-h-screen bg-white" : "min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50"}>
      <div className={singlePage ? "max-w-5xl mx-auto px-3 py-2" : "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2"}>
        
        {/* Enhanced Header */}
        <div className="text-center mb-3">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create New Job</h1>
          <p className="text-sm text-gray-600">{singlePage ? 'Fill out the form below to create your notarization job' : 'Follow the steps below to create your notarization job'}</p>
        </div>

        {/* Enhanced Progress Indicator */}
        {!singlePage && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-3">
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
                  <div className="mt-2 text-center">
                    <div className={`text-sm font-medium transition-colors ${
                      currentStep >= step.id ? 'text-blue-600' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </div>
                    <div className={`text-xs mt-0.5 ${
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
        )}

        {/* Main Content Card */}
        <Card className={singlePage ? "border bg-white" : "shadow-lg border-0 bg-white"}>
          <CardContent className={singlePage ? "p-3" : "p-4 md:p-6"}>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} onKeyDown={(e) => {
                // Prevent form submission on Enter key press
                if (!singlePage && e.key === 'Enter' && currentStep < steps.length) {
                   e.preventDefault();
                   e.stopPropagation();
                 }
               }} className="space-y-4">
                
                {/* Step 1: Job Details */}
                {(singlePage || currentStep === 1) && (
                  <div className="space-y-4">

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

                    {currentUser?.role === 'admin' && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <CheckCircle className="h-5 w-5 text-purple-600 mt-0.5" />
                          </div>
                          <div className="ml-3">
                            <h4 className="text-sm font-medium text-purple-900">Admin Job Creation</h4>
                            <p className="text-sm text-purple-800 mt-1">
                              As an admin, you can assign yourself as the notary, automatically assign a contractor notary, or manually select a specific notary.
                              You have full control over the assignment process.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentUser?.role === 'title_company' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          </div>
                          <div className="ml-3">
                            <h4 className="text-sm font-medium text-green-900">Title Company Job</h4>
                            <p className="text-sm text-green-800 mt-1">
                              You're creating a job for Sharp Note clients. The system will assign a qualified contractor notary based on your preferences.
                              The assigned notary will be paid from the client fees.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                                          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                          <div className="w-2 h-4 bg-blue-500 rounded-full mr-2"></div>
                          Primary Details
                        </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="titleCompany"
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormLabel className={`text-sm font-medium ${fieldState.error ? 'text-red-600' : 'text-gray-700'}`}>
                                Title Company *
                              </FormLabel>
                              {currentUser?.role === 'title_company' ? (
                                // Title company users see their own company name (read-only)
                                <FormControl>
                                  <Input
                                    {...field}
                                    disabled
                                    className={`h-12 border-gray-200 bg-gray-50 cursor-not-allowed ${fieldState.error ? 'border-red-300' : ''}`}
                                  />
                                </FormControl>
                              ) : (
                                // Other users can select from available companies
                                <Select 
                                  onValueChange={(value) => {
                                    field.onChange(value);
                                    // Trigger validation after change
                                    setTimeout(() => form.trigger('titleCompany'), 0);
                                  }} 
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger className={`h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${fieldState.error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}>
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
                              )}
                              <FormMessage className="text-red-600 text-sm mt-1" />
                              {currentUser?.role === 'title_company' && (
                                <p className="text-xs text-gray-500 mt-1">
                                  You can only create jobs for your own company
                                </p>
                              )}
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="closingType"
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormLabel className={`text-sm font-medium ${fieldState.error ? 'text-red-600' : 'text-gray-700'}`}>
                                Closing Type *
                              </FormLabel>
                              <Select 
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  // Trigger validation after change
                                  setTimeout(() => form.trigger('closingType'), 0);
                                }} 
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className={`h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${fieldState.error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}>
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
                              <FormMessage className="text-red-600 text-sm mt-1" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <FormField
                          control={form.control}
                          name="internalReference"
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormLabel className={`text-sm font-medium ${fieldState.error ? 'text-red-600' : 'text-gray-700'}`}>
                                Internal Reference
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter internal reference" 
                                  className={`h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${fieldState.error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                                  {...field}
                                  onBlur={() => form.trigger('internalReference')}
                                />
                              </FormControl>
                              <FormMessage className="text-red-600 text-sm mt-1" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="kbaRequired"
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormLabel className={`text-sm font-medium ${fieldState.error ? 'text-red-600' : 'text-gray-700'}`}>
                                KBA Required
                              </FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={(value) => {
                                    field.onChange(value === 'true');
                                    // Trigger validation after change
                                    setTimeout(() => form.trigger('kbaRequired'), 0);
                                  }}
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
                              <FormMessage className="text-red-600 text-sm mt-1" />
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
                      
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="propertyAddressOne"
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormLabel className={`text-sm font-medium ${fieldState.error ? 'text-red-600' : 'text-gray-700'}`}>
                                Address Line 1 *
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter street address" 
                                  className={`h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${fieldState.error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                                  {...field}
                                  onBlur={() => form.trigger('propertyAddressOne')}
                                />
                              </FormControl>
                              <FormMessage className="text-red-600 text-sm mt-1" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="propertyAddressTwo"
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormLabel className={`text-sm font-medium ${fieldState.error ? 'text-red-600' : 'text-gray-700'}`}>
                                Address Line 2
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Apt, suite, etc. (optional)" 
                                  className={`h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${fieldState.error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                                  {...field}
                                  onBlur={() => form.trigger('propertyAddressTwo')}
                                />
                              </FormControl>
                              <FormMessage className="text-red-600 text-sm mt-1" />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <FormField
                            control={form.control}
                            name="propertyCity"
                            render={({ field, fieldState }) => (
                              <FormItem>
                                <FormLabel className={`text-sm font-medium ${fieldState.error ? 'text-red-600' : 'text-gray-700'}`}>
                                  City *
                                </FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="Enter city" 
                                    className={`h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${fieldState.error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                                    {...field}
                                    onBlur={() => form.trigger('propertyCity')}
                                  />
                                </FormControl>
                                <FormMessage className="text-red-600 text-sm mt-1" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="propertyState"
                            render={({ field, fieldState }) => (
                              <FormItem>
                                <FormLabel className={`text-sm font-medium ${fieldState.error ? 'text-red-600' : 'text-gray-700'}`}>
                                  State *
                                </FormLabel>
                                <Select 
                                  onValueChange={(value) => {
                                    field.onChange(value);
                                    // Trigger validation after change
                                    setTimeout(() => form.trigger('propertyState'), 0);
                                  }} 
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger className={`h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${fieldState.error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}>
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
                                <FormMessage className="text-red-600 text-sm mt-1" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="propertyZipCode"
                            render={({ field, fieldState }) => (
                              <FormItem>
                                <FormLabel className={`text-sm font-medium ${fieldState.error ? 'text-red-600' : 'text-gray-700'}`}>
                                  ZIP Code *
                                </FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="Enter ZIP code" 
                                    className={`h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${fieldState.error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                                    {...field}
                                    onBlur={() => form.trigger('propertyZipCode')}
                                  />
                                </FormControl>
                                <FormMessage className="text-red-600 text-sm mt-1" />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Signers */}
                {(singlePage || currentStep === 2) && (
                  <div className="space-y-4">

                    <div className={singlePage ? "flex items-center justify-between p-2" : "flex items-center justify-between bg-blue-50 rounded-lg p-4"}>
                      <div className="flex items-center">
                        <AlertCircle className="w-4 h-4 text-blue-600 mr-2" />
                        <span className="text-sm font-medium text-gray-800">
                          {signers.length} participant{signers.length !== 1 ? 's' : ''} added
                        </span>
                      </div>
                      <Button 
                        type="button" 
                        onClick={handleAddSigner} 
                        size={singlePage ? "sm" : undefined}
                        className={singlePage ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white shadow-md"}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Participant
                      </Button>
                    </div>

                    {/* Show validation warning if no participants */}
                    {signers.length === 0 && (
                      singlePage ? (
                        <div className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm text-gray-600">No participants yet</span>
                          <Button type="button" size="sm" onClick={handleAddSigner} className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="h-4 w-4 mr-2" /> Add
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                          <UserIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No participants added yet</h3>
                          <p className="text-gray-600 mb-6">Click "Add Participant" to add signers and witnesses</p>
                          <Button type="button" onClick={handleAddSigner} className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="h-4 w-4 mr-2" /> Add Your First Participant
                          </Button>
                        </div>
                      )
                    )}

                    {signers.length === 0 ? (
                      <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <UserIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No participants added yet</h3>
                        <p className="text-gray-600 mb-6">Click "Add Participant" to add signers and witnesses</p>
                        <Button 
                          type="button" 
                          onClick={handleAddSigner} 
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Your First Participant
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {signers.map((signer, index) => (
                          <Card key={index} className={singlePage ? "border rounded-md" : "border-2 border-gray-100 hover:border-blue-200 transition-colors"}>
                            <CardHeader className={singlePage ? "py-2 px-3 border-b bg-white" : "bg-gradient-to-r from-gray-50 to-gray-100 border-b"}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className={singlePage ? "w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-xs mr-2" : "w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm mr-3"}>
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
                                  size={singlePage ? "sm" : "sm"}
                                  onClick={() => handleRemoveSigner(index)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardHeader>
                            
                            <CardContent className={singlePage ? "p-3" : "p-6"}>
                              {/* Email Lookup Info */}
                              {!singlePage && (
                                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                  <div className="flex items-center">
                                    <AlertCircle className="w-5 h-5 text-blue-600 mr-2" />
                                    <div>
                                      <h4 className="text-sm font-medium text-blue-800">Smart Participant Entry</h4>
                                      <p className="text-xs text-blue-700 mt-1">
                                        Enter an email address below. If the user exists in our system, their details will auto-populate. Otherwise, you can manually enter their information.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Signer Details */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <Label className={`text-sm font-medium ${signerErrors[index]?.signerName ? 'text-red-600' : 'text-gray-700'}`}>
                                    Participant Name *
                                  </Label>
                                  <Input
                                    value={signer.signerName}
                                    onChange={(e) => handleSignerChange(index, 'signerName', e.target.value)}
                                    placeholder="Enter participant name"
                                    className={`${singlePage ? 'h-10' : 'h-12'} mt-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${signerErrors[index]?.signerName ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                                    onBlur={() => validateSigner(signer, index)}
                                    disabled={autoPopulatedSigners[index] && !isAdmin}
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
                                    onChange={(e) => handleEmailLookup(index, e.target.value)}
                                    placeholder="Enter email address (will auto-populate if user exists)"
                                    className={`${singlePage ? 'h-10' : 'h-12'} mt-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${signerErrors[index]?.signerEmail ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                                    onBlur={() => validateSigner(signer, index)}
                                  />
                                  {signerErrors[index]?.signerEmail && (
                                    <p className="text-sm text-red-600 mt-1">{signerErrors[index].signerEmail}</p>
                                  )}
                                  {autoPopulatedSigners[index] && (
                                    <p className="text-xs text-green-600 mt-1 flex items-center">
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      User found! Details auto-populated from existing account.
                                    </p>
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
                                    className={`${singlePage ? 'h-10' : 'h-12'} mt-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${signerErrors[index]?.signerPhoneNumber ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                                    onBlur={() => validateSigner(signer, index)}
                                    disabled={autoPopulatedSigners[index] && !isAdmin}
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
                                    <SelectTrigger className={`${singlePage ? 'h-10' : 'h-12'} mt-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${signerErrors[index]?.signerRole ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}>
                                      <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {participantRoles.map((role: any) => (
                                        <SelectItem key={role.id} value={role.name}>
                                          {role.displayName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {signerErrors[index]?.signerRole && (
                                    <p className="text-sm text-red-600 mt-1">{signerErrors[index].signerRole}</p>
                                  )}
                                  {signer.signerRole === 'witness' && (
                                    <p className="text-xs text-blue-600 mt-1">
                                      <span className="font-medium">Witness:</span> This person will observe the signing but won't sign documents themselves.
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Auto-populated User Info */}
                              {autoPopulatedSigners[index] && signer.existingUserId && (
                                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                                  <div className="flex items-center">
                                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                                    <div>
                                      <p className="text-sm font-medium text-green-800">
                                        Existing User: {signer.signerName}
                                      </p>
                                      <p className="text-xs text-green-600">
                                        {signer.signerEmail} • Information auto-populated from existing account
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
                {(singlePage || currentStep === 3) && (
                  <div className="space-y-4">
                    
                    {/* Subscriber Notary: Simple date/time selection */}
                    {currentUser?.role === 'notary' && currentUser?.notaryType === 'subscriber' ? (
                      <div className="space-y-6">
                        <div className={singlePage ? "p-3 border rounded" : "bg-blue-50 border border-blue-200 rounded-lg p-4"}>
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

                        <div className={singlePage ? "border rounded-md p-3" : "bg-gray-50 rounded-lg p-4 border border-gray-100"}>
                          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                            <div className="w-2 h-4 bg-purple-500 rounded-full mr-2"></div>
                            Your Available Times
                          </h3>
                          
                          <NotaryAvailabilitySelector
                            notaryId={currentUser?.id || 0}
                            selectedDate={form.watch('selectedDate')}
                            selectedTime={form.watch('selectedTime')}
                            onDateTimeSelect={handleNotaryDateTimeSelect}
                          />
                        </div>
                      </div>
                    ) : (
                      /* Title Company/Admin: Full notary assignment workflow */
                      <div className={singlePage ? "border rounded-md p-3" : "bg-gray-50 rounded-xl p-6 border border-gray-100"}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                          <div className="w-2 h-6 bg-purple-500 rounded-full mr-3"></div>
                          Notary Assignment
                        </h3>
                        
                        <FormField
                          control={form.control}
                          name="notaryOption"
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormLabel className={`text-sm font-medium ${fieldState.error ? 'text-red-600' : 'text-gray-700'} mb-4 block`}>
                                Assignment Method
                              </FormLabel>
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
                                  className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-3' : currentUser?.role === 'title_company' ? 'md:grid-cols-2' : 'md:grid-cols-2'} ${singlePage ? 'gap-3' : 'gap-6'}`}
                                >
                                  {/* options unchanged */}
                                </RadioGroup>
                              </FormControl>
                              <FormMessage className="text-red-600 text-sm mt-1" />
                              {currentUser?.role === 'title_company' && (
                                <p className="text-xs text-gray-500 mt-1">
                                  You can only create jobs for your own company
                                </p>
                              )}
                            </FormItem>
                          )}
                        />

                        {/* Manual notary selection */}
                        {form.watch('notaryOption') === 'assign' && (
                          <div className="mt-6">
                            <FormField
                              control={form.control}
                              name="selectedNotary"
                              render={({ field, fieldState }) => (
                                <FormItem>
                                  <FormLabel className={`text-sm font-medium ${fieldState.error ? 'text-red-600' : 'text-gray-700'}`}>
                                    Select Contractor Notary
                                  </FormLabel>
                                  <Select 
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      setTimeout(() => form.trigger('selectedNotary'), 0);
                                    }} 
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className={`${singlePage ? 'h-10' : 'h-12'} border-gray-200 focus:border-blue-500 focus:ring-blue-500 mt-2 ${fieldState.error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}>
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
                                  <FormMessage className="text-red-600 text-sm mt-1" />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}

                        {/* Notary ID Code Input - for title companies and admins */}
                        {form.watch('notaryOption') === 'id_code' && (
                          <div className="mt-6">
                            <FormField
                              control={form.control}
                              name="notaryIdCode"
                              render={({ field, fieldState }) => (
                                <FormItem>
                                  <FormLabel className={`text-sm font-medium ${fieldState.error ? 'text-red-600' : 'text-gray-700'}`}>
                                    Enter Notary ID Code
                                  </FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input
                                        {...field}
                                        placeholder="CY0123"
                                        className={`h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 mt-2 uppercase ${fieldState.error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                                        onChange={(e) => {
                                          const value = e.target.value.toUpperCase();
                                          field.onChange(value);
                                          lookupNotaryByCode(value);
                                        }}
                                        maxLength={6}
                                      />
                                      {notaryIdCodeLookup.isLoading && (
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 mt-1">
                                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                        </div>
                                      )}
                                    </div>
                                  </FormControl>
                                  <div className="mt-2 text-xs text-gray-500">
                                    Format: CY#### (e.g., CY0123)
                                  </div>
                                  <FormMessage className="text-red-600 text-sm mt-1" />
                                </FormItem>
                              )}
                            />

                            {/* Lookup Results */}
                            {form.watch('notaryIdCode') && (
                              <div className="mt-4">
                                {notaryIdCodeLookup.error && (
                                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="flex items-center">
                                      <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                                      <div>
                                        <h4 className="text-sm font-medium text-red-800">Lookup Failed</h4>
                                        <p className="text-xs text-red-700 mt-1">{notaryIdCodeLookup.error}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {notaryIdCodeLookup.result && (
                                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-center">
                                      <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                                      <div className="flex-1">
                                        <h4 className="text-sm font-medium text-green-800">
                                          Notary Found: {notaryIdCodeLookup.result.firstName} {notaryIdCodeLookup.result.lastName}
                                        </h4>
                                        <p className="text-xs text-green-700 mt-1">
                                          Code: {notaryIdCodeLookup.result.notaryIdCode}
                                        </p>
                                        <div className="flex items-center space-x-4 mt-2">
                                          {notaryIdCodeLookup.result.isNotarySigningAgent && (
                                            <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                                              NSA Certified
                                            </Badge>
                                          )}
                                          {notaryIdCodeLookup.result.isSpanishSpeaking && (
                                            <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                                              Spanish Speaking
                                            </Badge>
                                          )}
                                          <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">
                                            {notaryIdCodeLookup.result.isActive ? 'Active' : 'Inactive'}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Availability Selector for Manual Assignment */}
                        {form.watch('notaryOption') === 'assign' && form.watch('selectedNotary') && (
                          <div className="mt-6">
                            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                                <div className="w-2 h-6 bg-blue-500 rounded-full mr-3"></div>
                                Available Appointment Times
                                <Badge variant="outline" className="ml-3">
                                  {(() => {
                                    const selectedNotary = notaries.find(n => n.id.toString() === form.watch('selectedNotary'));
                                    return selectedNotary ? selectedNotary.fullName : 'Selected Notary';
                                  })()}
                                </Badge>
                              </h3>
                              <NotaryAvailabilitySelector
                                notaryId={parseInt(form.watch('selectedNotary') || '0')}
                                selectedDate={form.watch('selectedDate')}
                                selectedTime={form.watch('selectedTime')}
                                onDateTimeSelect={handleNotaryDateTimeSelect}
                              />
                            </div>
                          </div>
                        )}

                        {/* Availability Selector for ID Code Assignment */}
                        {form.watch('notaryOption') === 'id_code' && notaryIdCodeLookup.result && notaryIdCodeLookup.result.id && (
                          <div className="mt-6">
                            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                                <div className="w-2 h-6 bg-orange-500 rounded-full mr-3"></div>
                                Available Appointment Times
                                <Badge variant="outline" className="ml-3">
                                  {notaryIdCodeLookup.result.firstName} {notaryIdCodeLookup.result.lastName}
                                </Badge>
                              </h3>
                              <NotaryAvailabilitySelector
                                notaryId={notaryIdCodeLookup.result.id}
                                selectedDate={form.watch('selectedDate')}
                                selectedTime={form.watch('selectedTime')}
                                onDateTimeSelect={handleNotaryDateTimeSelect}
                              />
                            </div>
                          </div>
                        )}

                        {/* Self-Assignment Date/Time for Admin */}
                        {form.watch('notaryOption') === 'admin_self' && (
                          <div className="mt-6">
                            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                                <div className="w-2 h-6 bg-purple-500 rounded-full mr-3"></div>
                                Your Available Times
                                <Badge variant="outline" className="ml-3">
                                  {currentUser?.firstName && currentUser?.lastName 
                                    ? `${currentUser.firstName} ${currentUser.lastName}` 
                                    : currentUser?.username || 'Admin'}
                                </Badge>
                              </h3>
                              <NotaryAvailabilitySelector
                                notaryId={currentUser?.id || 0}
                                selectedDate={form.watch('selectedDate')}
                                selectedTime={form.watch('selectedTime')}
                                onDateTimeSelect={handleNotaryDateTimeSelect}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Additional Requirements - only for title company jobs */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'title_company') && (
                      <div className={singlePage ? "border rounded-md p-3" : "bg-gray-50 rounded-xl p-6 border border-gray-100"}>
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
                {(singlePage || currentStep === 4) && (
                  <div className="space-y-4">
                    <div className={singlePage ? "flex items-center justify-between p-2" : "flex items-center justify-between bg-indigo-50 rounded-lg p-4"}>
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 text-indigo-600 mr-2" />
                        <span className="text-sm font-medium text-gray-800">
                          {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded
                        </span>
                      </div>
                      {!singlePage && (
                        <div className="text-xs text-indigo-600">PDF, DOC, DOCX supported • Max 10MB each</div>
                      )}
                    </div>

                    {singlePage ? (
                      <div className="space-y-2 border rounded-md p-3">
                        <Label className="text-sm font-medium">Upload Documents</Label>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple onChange={handleFileUpload} className="block text-sm" />
                        <p className="text-xs text-gray-500">PDF, DOC, DOCX, JPG, PNG • Max 10MB each</p>
                      </div>
                    ) : (
                      <div className={`border-2 border-dashed rounded-xl p-12 text-center hover:border-blue-400 transition-colors ${documents.length === 0 ? 'border-yellow-300 bg-yellow-50' : 'border-gray-300'}`}>
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Upload className="h-8 w-8 text-blue-600" />
                        </div>
                        <div className="mb-6">
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload Multiple Documents</h3>
                          <p className="text-gray-600">Drag and drop files here, or click to browse your computer</p>
                        </div>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple onChange={handleFileUpload} className="hidden" id="file-upload" />
                        <Button type="button" onClick={() => document.getElementById('file-upload')?.click()} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg">
                          <Plus className="h-5 w-5 mr-3" /> Select Documents
                        </Button>
                        <p className="text-sm text-gray-500 mt-4">Supported formats: PDF, DOC, DOCX, JPG, PNG • Maximum 10MB per file</p>
                      </div>
                    )}

                    {/* Document List */}
                    {documents.length > 0 && (
                      <div className={singlePage ? "border rounded-md p-3" : "bg-gray-50 rounded-xl p-6 border border-gray-100"}>
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
                {!singlePage && currentStep === 5 && (
                  <div className="space-y-4">
                    
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
                          Participants ({signers.length})
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
                {singlePage ? (
                  <div className="flex justify-end items-center pt-8 border-t border-gray-200">
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
                  </div>
                ) : (
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
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleNext();
                        }}
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
                )}
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Job Creation Progress Modal */}
        <JobCreationProgress
          isOpen={showProgressModal}
          currentStep={progressStep}
          completedSteps={completedSteps}
          error={progressError}
          progress={creationProgress}
        />
      </div>
    </div>
  );
}

export function JobWizard({ singlePage = false }: JobWizardProps) {
  return (
    <JobWizardErrorBoundary>
      <JobWizardInternal singlePage={singlePage} />
    </JobWizardErrorBoundary>
  );
}
