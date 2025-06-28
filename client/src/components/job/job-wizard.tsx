import { useState } from 'react';
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
import { ArrowLeft, ArrowRight, Plus, Trash2, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
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
type SignerFormData = z.infer<typeof signerSchema>;

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
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      kbaRequired: false,
      notaryOption: 'auto',
    },
  });

  const { data: titleCompanies = [] } = useQuery<TitleCompany[]>({
    queryKey: ['/api/companies'],
  });

  const { data: notaries = [] } = useQuery<User[]>({
    queryKey: ['/api/users/notaries'],
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
    setSigners(prev => [...prev, {
      signerName: '',
      signerEmail: '',
      signerPhoneNumber: '',
      signerRole: '',
    }]);
  };

  const handleRemoveSigner = (index: number) => {
    setSigners(prev => prev.filter((_, i) => i !== index));
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
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Create New Job</CardTitle>
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <div className="flex justify-between text-sm text-gray-600">
            {steps.map((step) => (
              <div key={step.id} className={`flex items-center ${
                currentStep >= step.id ? 'text-primary font-medium' : ''
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 transition-all ${
                  currentStep > step.id ? 'bg-green-500 text-white' : 
                  currentStep === step.id ? 'bg-primary text-white ring-2 ring-primary ring-offset-2' : 
                  'bg-gray-200'
                }`}>
                  {currentStep > step.id ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    step.id
                  )}
                </div>
                <span className="hidden sm:inline">{step.title}</span>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            
            {/* Step 1: Client Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Client Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="titleCompany"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title Company</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
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
                        <FormLabel>Closing Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="internalReference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Reference</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter internal reference" {...field} />
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
                        <FormLabel>KBA Required</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => field.onChange(value === 'true')}
                            defaultValue={field.value ? 'true' : 'false'}
                            className="flex items-center space-x-6"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="true" id="kba-yes" />
                              <Label htmlFor="kba-yes">Yes</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="false" id="kba-no" />
                              <Label htmlFor="kba-no">No</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Property Address</h4>
                  
                  <FormField
                    control={form.control}
                    name="propertyAddressOne"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 1</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter street address" {...field} />
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
                        <FormLabel>Address Line 2 (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Apt, suite, etc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="propertyCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter city" {...field} />
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
                          <FormLabel>State</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
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
                          <FormLabel>ZIP Code</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter ZIP code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Signers */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Signer Information</h3>
                  <Button type="button" onClick={handleAddSigner} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Signer
                  </Button>
                </div>

                {signers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No signers added yet. Click "Add Signer" to get started.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {signers.map((signer, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium">Signer {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSigner(index)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className={signerErrors[index]?.signerName ? 'text-destructive' : ''}>
                              Signer Name *
                            </Label>
                            <Input
                              value={signer.signerName}
                              onChange={(e) => handleSignerChange(index, 'signerName', e.target.value)}
                              placeholder="Enter signer name"
                              className={signerErrors[index]?.signerName ? 'border-destructive' : ''}
                              onBlur={() => validateSigner(signer, index)}
                            />
                            {signerErrors[index]?.signerName && (
                              <p className="text-sm text-destructive mt-1">{signerErrors[index].signerName}</p>
                            )}
                          </div>
                          
                          <div>
                            <Label className={signerErrors[index]?.signerEmail ? 'text-destructive' : ''}>
                              Email *
                            </Label>
                            <Input
                              type="email"
                              value={signer.signerEmail}
                              onChange={(e) => handleSignerChange(index, 'signerEmail', e.target.value)}
                              placeholder="Enter email"
                              className={signerErrors[index]?.signerEmail ? 'border-destructive' : ''}
                              onBlur={() => validateSigner(signer, index)}
                            />
                            {signerErrors[index]?.signerEmail && (
                              <p className="text-sm text-destructive mt-1">{signerErrors[index].signerEmail}</p>
                            )}
                          </div>
                          
                          <div>
                            <Label className={signerErrors[index]?.signerPhoneNumber ? 'text-destructive' : ''}>
                              Phone Number *
                            </Label>
                            <Input
                              value={signer.signerPhoneNumber}
                              onChange={(e) => handleSignerChange(index, 'signerPhoneNumber', e.target.value)}
                              placeholder="(123) 456-7890"
                              className={signerErrors[index]?.signerPhoneNumber ? 'border-destructive' : ''}
                              onBlur={() => validateSigner(signer, index)}
                            />
                            {signerErrors[index]?.signerPhoneNumber && (
                              <p className="text-sm text-destructive mt-1">{signerErrors[index].signerPhoneNumber}</p>
                            )}
                          </div>
                          
                          <div>
                            <Label className={signerErrors[index]?.signerRole ? 'text-destructive' : ''}>
                              Role *
                            </Label>
                            <Select
                              value={signer.signerRole}
                              onValueChange={(value) => {
                                handleSignerChange(index, 'signerRole', value);
                                validateSigner({ ...signer, signerRole: value }, index);
                              }}
                            >
                              <SelectTrigger className={signerErrors[index]?.signerRole ? 'border-destructive' : ''}>
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
                              <p className="text-sm text-destructive mt-1">{signerErrors[index].signerRole}</p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Schedule */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Schedule Appointment</h3>
                
                <FormField
                  control={form.control}
                  name="notaryOption"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notary Option</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                          <div className="flex items-center space-x-2 p-4 border rounded-lg">
                            <RadioGroupItem value="assign" id="assign" />
                            <div>
                              <Label htmlFor="assign" className="font-medium">Assign Specific Notary</Label>
                              <p className="text-sm text-gray-600">Choose from available notaries</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 p-4 border rounded-lg">
                            <RadioGroupItem value="auto" id="auto" />
                            <div>
                              <Label htmlFor="auto" className="font-medium">Auto Assignment</Label>
                              <p className="text-sm text-gray-600">System will assign best match</p>
                            </div>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch('notaryOption') === 'assign' && (
                  <FormField
                    control={form.control}
                    name="selectedNotary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Notary</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a notary" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {notaries.map((notary: any) => (
                              <SelectItem key={notary.id} value={notary.id.toString()}>
                                {notary.username}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="selectedDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Appointment Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
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
                        <FormLabel>Appointment Time</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="09:00">9:00 AM</SelectItem>
                            <SelectItem value="10:00">10:00 AM</SelectItem>
                            <SelectItem value="11:00">11:00 AM</SelectItem>
                            <SelectItem value="14:00">2:00 PM</SelectItem>
                            <SelectItem value="15:00">3:00 PM</SelectItem>
                            <SelectItem value="16:00">4:00 PM</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Step 4: Documents */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Upload Documents</h3>
                  <div className="text-sm text-gray-600">
                    {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded
                  </div>
                </div>
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <div className="mb-4">
                    <p className="text-lg font-medium text-gray-900">Upload Multiple Documents</p>
                    <p className="text-sm text-gray-600">Drag and drop files here, or click to browse</p>
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
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Documents
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    Supported formats: PDF, DOC, DOCX (Max 10MB each) • Select multiple files
                  </p>
                </div>

                {documents.length > 0 ? (
                  <div className="space-y-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Uploaded Documents ({documents.length})
                    </div>
                    {documents.map((doc) => (
                      <Card key={doc.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <FileText className="h-8 w-8 text-blue-500" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                              <div className="flex items-center space-x-2 text-xs text-gray-500">
                                <span>{formatFileSize(doc.size)}</span>
                                <span>•</span>
                                <span className={doc.isRequired ? 'text-green-600' : 'text-gray-500'}>
                                  {doc.isRequired ? 'Required' : 'Optional'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleRequired(doc.id)}
                              title={doc.isRequired ? 'Mark as optional' : 'Mark as required'}
                            >
                              {doc.isRequired ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <FileText className="h-4 w-4 text-gray-400" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveDocument(doc.id)}
                              title="Remove document"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p>No documents uploaded yet</p>
                    <p className="text-sm">Upload documents for this notarization job</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Review */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Review Job Details</h3>
                <p className="text-sm text-gray-600">Please review all the information before submitting</p>
                
                {/* Client Information Summary */}
                <Card className="p-4">
                  <h4 className="font-medium mb-3 flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    Client Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Title Company:</span>
                      <p className="font-medium">{form.watch('titleCompany') || 'Not specified'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Closing Type:</span>
                      <p className="font-medium">{form.watch('closingType') || 'Not specified'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Internal Reference:</span>
                      <p className="font-medium">{form.watch('internalReference') || 'None'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">KBA Required:</span>
                      <p className="font-medium">{form.watch('kbaRequired') ? 'Yes' : 'No'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-gray-600">Property Address:</span>
                      <p className="font-medium">
                        {form.watch('propertyAddressOne')}
                        {form.watch('propertyAddressTwo') && `, ${form.watch('propertyAddressTwo')}`}
                        <br />
                        {form.watch('propertyCity')}, {form.watch('propertyState')} {form.watch('propertyZipCode')}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Signers Summary */}
                <Card className="p-4">
                  <h4 className="font-medium mb-3 flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    Signers ({signers.length})
                  </h4>
                  {signers.length > 0 ? (
                    <div className="space-y-2">
                      {signers.map((signer, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="text-sm">
                            <p className="font-medium">{signer.signerName}</p>
                            <p className="text-gray-600">{signer.signerEmail} • {signer.signerPhoneNumber}</p>
                          </div>
                          <Badge>{signer.signerRole}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No signers added</p>
                  )}
                </Card>

                {/* Schedule Summary */}
                <Card className="p-4">
                  <h4 className="font-medium mb-3 flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    Schedule
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Notary Option:</span>
                      <p className="font-medium">{form.watch('notaryOption') === 'assign' ? 'Specific Notary' : 'Auto Assignment'}</p>
                    </div>
                    {form.watch('notaryOption') === 'assign' && form.watch('selectedNotary') && (
                      <div>
                        <span className="text-gray-600">Selected Notary:</span>
                        <p className="font-medium">
                          {notaries.find(n => n.id.toString() === form.watch('selectedNotary'))?.username || 'Not found'}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600">Date:</span>
                      <p className="font-medium">{form.watch('selectedDate') || 'Not scheduled'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Time:</span>
                      <p className="font-medium">{form.watch('selectedTime') || 'Not scheduled'}</p>
                    </div>
                  </div>
                </Card>

                {/* Documents Summary */}
                <Card className="p-4">
                  <h4 className="font-medium mb-3 flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    Documents ({documents.length})
                  </h4>
                  {documents.length > 0 ? (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center space-x-2 text-sm">
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">{doc.name}</span>
                            <span className="text-gray-500">({formatFileSize(doc.size)})</span>
                          </div>
                          <Badge variant={doc.isRequired ? "default" : "secondary"}>
                            {doc.isRequired ? 'Required' : 'Optional'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No documents uploaded</p>
                  )}
                </Card>

                {/* Final Check */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-900">Please confirm all information is correct</p>
                      <p className="text-blue-700 mt-1">
                        Once submitted, this job will be created and notifications will be sent to all signers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              
              {currentStep < steps.length ? (
                <Button type="button" onClick={handleNext}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={createJobMutation.isPending || isSubmitting}
                  className="bg-success hover:bg-success/90"
                >
                  {createJobMutation.isPending || isSubmitting ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating Job...
                    </div>
                  ) : (
                    'Create Job'
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
