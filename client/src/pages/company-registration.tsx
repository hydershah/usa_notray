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
import { Building2, User, MapPin, CreditCard, ArrowLeft, Shield, Award, FileText } from 'lucide-react';

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
              <h1 className="text-4xl font-bold mb-2">Register Your Company</h1>
              <p className="text-xl text-gray-200">Professional Title Company Services</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Shield className="h-8 w-8 text-white" />
                <div className="text-left">
                  <p className="font-semibold text-white">Enterprise Security</p>
                  <p className="text-sm text-gray-300">Advanced security for your business operations</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <Award className="h-8 w-8 text-white" />
                <div className="text-left">
                  <p className="font-semibold text-white">Team Management</p>
                  <p className="text-sm text-gray-300">Manage your entire team and workflow</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <FileText className="h-8 w-8 text-white" />
                <div className="text-left">
                  <p className="font-semibold text-white">Volume Processing</p>
                  <p className="text-sm text-gray-300">Handle high volumes efficiently</p>
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
        <div className="w-full max-w-6xl max-h-screen overflow-y-auto">
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
                Register Your Title Company
              </CardTitle>
              <CardDescription className="text-gray-600">
                Create your company account and set up your primary manager
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6 sm:space-y-8 px-6 sm:px-8 lg:px-12 pb-6 sm:pb-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 sm:space-y-8">
                  
                  {/* Primary User Information */}
                  <div className="space-y-5">
                    <div className="flex items-center space-x-2 border-b border-gray-200 pb-2">
                      <User className="h-5 w-5 text-gray-800" />
                      <h3 className="text-lg font-semibold text-gray-800">Primary User Information</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="primaryUserName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Primary User Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter primary user name" 
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors h-11"
                                {...field} 
                              />
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
                            <FormLabel className="text-sm font-medium text-gray-700">Primary User Email *</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                placeholder="Enter primary user email" 
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors h-11"
                                {...field} 
                              />
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
                          <FormLabel className="text-sm font-medium text-gray-700">Primary User Password *</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Enter password (min 6 characters)" 
                              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors h-11"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  {/* Company Information */}
                  <div className="space-y-5">
                    <div className="flex items-center space-x-2 border-b border-gray-200 pb-2">
                      <Building2 className="h-5 w-5 text-gray-800" />
                      <h3 className="text-lg font-semibold text-gray-800">Company Information</h3>
                    </div>
                    
                    <div className="lg:col-span-3">
                      <FormField
                        control={form.control}
                        name="companyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Company Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter company name" 
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors h-11"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="contactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Contact Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter contact name" 
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors h-11"
                                {...field} 
                              />
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
                            <FormLabel className="text-sm font-medium text-gray-700">Company Email *</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                placeholder="Enter company email" 
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors h-11"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="lg:col-span-1">
                      <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Phone Number</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter phone number" 
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors h-11"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Company Address */}
                  <div className="space-y-5">
                    <div className="flex items-center space-x-2 border-b border-gray-200 pb-2">
                      <MapPin className="h-5 w-5 text-gray-800" />
                      <h3 className="text-lg font-semibold text-gray-800">Company Address</h3>
                    </div>
                    
                    <div className="lg:col-span-3">
                      <FormField
                        control={form.control}
                        name="address1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Address 1 *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter street address" 
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors h-11"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="lg:col-span-3">
                      <FormField
                        control={form.control}
                        name="address2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Address 2</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Apartment, suite, etc." 
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors h-11"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">City *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter city" 
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors h-11"
                                {...field} 
                              />
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
                            <FormLabel className="text-sm font-medium text-gray-700">State *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter state" 
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors h-11"
                                {...field} 
                              />
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
                            <FormLabel className="text-sm font-medium text-gray-700">Zip Code *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter zip code" 
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors h-11"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Payment Method */}
                  <div className="space-y-5">
                    <div className="flex items-center space-x-2 border-b border-gray-200 pb-2">
                      <CreditCard className="h-5 w-5 text-gray-800" />
                      <h3 className="text-lg font-semibold text-gray-800">Payment Method</h3>
                    </div>

                    <div className="max-w-md">
                      <FormField
                        control={form.control}
                        name="paymentMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Payment Method *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors h-11">
                                  <SelectValue placeholder="Select payment method" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="invoiced">💳 Invoiced</SelectItem>
                                <SelectItem value="qualia">🏢 Qualia</SelectItem>
                                <SelectItem value="pre_pay">💰 Pre-pay</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Company Settings */}
                  <div className="space-y-5">
                    <div className="border-b border-gray-200 pb-2">
                      <h3 className="text-lg font-semibold text-gray-800">Company Settings</h3>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="allowUserSelfRegistration"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border border-gray-200 p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-medium text-gray-700">
                              Allow User Self-Registration
                            </FormLabel>
                            <p className="text-xs text-gray-500">
                              Allow users to register themselves for this company
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requiresApprovalForNewUsers"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border border-gray-200 p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-medium text-gray-700">
                              Require Approval for New Users
                            </FormLabel>
                            <p className="text-xs text-gray-500">
                              New users will require approval before accessing the system
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="pt-6">
                    <Button 
                      type="submit" 
                      className="w-full h-12 bg-gradient-to-r from-gray-900 to-black hover:from-black hover:to-gray-900 text-white font-medium rounded-lg shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
                      disabled={registrationMutation.isPending}
                    >
                      {registrationMutation.isPending ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Registering Company...
                        </div>
                      ) : 'Register Company'}
                    </Button>
                  </div>
                </form>
              </Form>
              
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