import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Building2, User, MapPin, CreditCard, ArrowLeft } from 'lucide-react';

const companyRegistrationSchema = z.object({
  // Primary company information
  companyName: z.string().min(1, 'Company name is required'),
  
  // Primary user (company manager) - required fields
  primaryUserName: z.string().min(1, 'Primary user name is required'),
  primaryUserEmail: z.string().email('Valid primary user email is required'),
  primaryUserPassword: z.string().min(6, 'Password must be at least 6 characters'),
  
  // Company address - required fields
  address1: z.string().min(1, 'Address 1 is required'),
  address2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(1, 'Zip code is required'),
  
  // Billing address - optional fields
  useSeparateBilling: z.boolean().default(false),
  billingAddress1: z.string().optional(),
  billingAddress2: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingZipCode: z.string().optional(),
  
  // Payment method - required
  paymentMethod: z.enum(['invoiced', 'qualia', 'pre_pay'], {
    required_error: 'Payment method is required',
  }),
  
  // Contact and operational information
  contactName: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Valid email is required'),
  phoneNumber: z.string().optional(),
  
  // Optional fields
  defaultClosingType: z.string().optional(),
  allowUserSelfRegistration: z.boolean().default(false),
  requiresApprovalForNewUsers: z.boolean().default(true),
});

type CompanyRegistrationData = z.infer<typeof companyRegistrationSchema>;

export default function CompanyRegistration() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<CompanyRegistrationData>({
    resolver: zodResolver(companyRegistrationSchema),
    defaultValues: {
      useSeparateBilling: false,
      paymentMethod: 'invoiced',
      allowUserSelfRegistration: false,
      requiresApprovalForNewUsers: true,
    },
  });

  const useSeparateBilling = form.watch('useSeparateBilling');

  const registrationMutation = useMutation({
    mutationFn: async (data: CompanyRegistrationData) => {
      const { useSeparateBilling, ...registrationData } = data;
      
      // If not using separate billing, clear billing fields
      if (!useSeparateBilling) {
        registrationData.billingAddress1 = '';
        registrationData.billingAddress2 = '';
        registrationData.billingCity = '';
        registrationData.billingState = '';
        registrationData.billingZipCode = '';
      }
      
      const response = await apiRequest('POST', '/api/companies/register', registrationData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Registration Submitted!",
        description: `Company "${data.company.companyName}" registration has been submitted and is pending admin approval. You will be notified once approved.`,
      });
      // Redirect to login page
      setLocation('/login');
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "Failed to register company. Please try again.",
      });
    },
  });

  const handleSubmit = (data: CompanyRegistrationData) => {
    registrationMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-4xl">
        <div className="flex items-center justify-center mb-8">
          <Building2 className="h-12 w-12 text-primary mr-3" />
          <h2 className="text-3xl font-bold text-gray-900">
            Register Your Title Company
          </h2>
        </div>
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl text-center">
              Sign-up Company
            </CardTitle>
            <CardDescription className="text-center">
              Register your title company and create your primary manager account. 
              All fields marked with * are required.
            </CardDescription>
            <div className="flex justify-center">
              <Button
                variant="link"
                onClick={() => setLocation('/login')}
                className="text-sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
                
                {/* Primary User Information */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Primary User Information</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="primaryUserName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary User Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter primary user name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="primaryUserEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary User Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="Enter primary user email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="primaryUserPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary User Password *</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter password (min 6 characters)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Company Information */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Company Information</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter company name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter contact name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="Enter company email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter phone number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Company Address */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Company Address</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="address1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address 1 *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter street address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address 2</FormLabel>
                        <FormControl>
                          <Input placeholder="Apartment, suite, etc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter city" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter state" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zip Code *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter zip code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Billing Address */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Billing Information</h3>
                  </div>

                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="invoiced">Invoiced</SelectItem>
                            <SelectItem value="qualia">Qualia</SelectItem>
                            <SelectItem value="pre_pay">Pre-pay</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="useSeparateBilling"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Use separate billing address
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  {useSeparateBilling && (
                    <div className="space-y-4 pl-6 border-l-2 border-gray-200">
                      <FormField
                        control={form.control}
                        name="billingAddress1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Billing Address 1</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter billing street address" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="billingAddress2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Billing Address 2</FormLabel>
                            <FormControl>
                              <Input placeholder="Apartment, suite, etc." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="billingCity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Billing City</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter billing city" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="billingState"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Billing State</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter billing state" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="billingZipCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Billing Zip Code</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter billing zip code" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Company Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Company Settings</h3>
                  
                  <FormField
                    control={form.control}
                    name="allowUserSelfRegistration"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Allow user self-registration
                          </FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Users can register themselves and request to join your company
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="requiresApprovalForNewUsers"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Require approval for new users
                          </FormLabel>
                          <p className="text-sm text-muted-foreground">
                            New users must be approved by company managers before they can access the system
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="flex justify-center">
                  <Button 
                    type="submit" 
                    disabled={registrationMutation.isPending}
                    size="lg"
                    className="w-full md:w-auto px-12"
                  >
                    {registrationMutation.isPending ? 'Registering...' : 'Register Company'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 