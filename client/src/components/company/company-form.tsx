import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import React from 'react';

// Create separate schemas for creation and updates
const companyCreateSchema = z.object({
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
  
  // Status
  status: z.string().min(1, 'Status is required'),
});

// For updates, only validate non-empty strings
const companyUpdateSchema = z.object({
  companyName: z.union([z.string().min(1, 'Company name is required'), z.literal('')]).optional(),
  primaryUserName: z.union([z.string().min(1, 'Primary user name is required'), z.literal('')]).optional(),
  primaryUserEmail: z.union([z.string().email('Valid primary user email is required'), z.literal('')]).optional(),
  primaryUserPassword: z.union([z.string().min(6, 'Password must be at least 6 characters'), z.literal('')]).optional(),
  address1: z.union([z.string().min(1, 'Address 1 is required'), z.literal('')]).optional(),
  address2: z.string().optional(),
  city: z.union([z.string().min(1, 'City is required'), z.literal('')]).optional(),
  state: z.union([z.string().min(1, 'State is required'), z.literal('')]).optional(),
  zipCode: z.union([z.string().min(1, 'Zip code is required'), z.literal('')]).optional(),
  billingAddress1: z.string().optional(),
  billingAddress2: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingZipCode: z.string().optional(),
  paymentMethod: z.enum(['invoiced', 'qualia', 'pre_pay']).optional(),
  contactName: z.union([z.string().min(1, 'Contact name is required'), z.literal('')]).optional(),
  email: z.union([z.string().email('Valid email is required'), z.literal('')]).optional(),
  phoneNumber: z.string().optional(),
  status: z.union([z.string().min(1, 'Status is required'), z.literal('')]).optional(),
});

type CompanyFormData = z.infer<typeof companyCreateSchema>;

interface CompanyFormProps {
  company?: any;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CompanyFormData | Partial<CompanyFormData>) => void;
  isLoading?: boolean;
}

export function CompanyForm({ company, isOpen, onClose, onSubmit, isLoading = false }: CompanyFormProps) {
  const [useSeparateBilling, setUseSeparateBilling] = useState(false);
  const isUpdate = !!company;

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(isUpdate ? companyUpdateSchema : companyCreateSchema),
    defaultValues: {
      companyName: '',
      primaryUserName: '',
      primaryUserEmail: '',
      primaryUserPassword: '',
      address1: '',
      address2: '',
      city: '',
      state: '',
      zipCode: '',
      billingAddress1: '',
      billingAddress2: '',
      billingCity: '',
      billingState: '',
      billingZipCode: '',
      paymentMethod: 'invoiced',
      contactName: '',
      email: '',
      phoneNumber: '',
      status: 'active',
    },
  });

  // Reset form when company changes or modal opens
  React.useEffect(() => {
    if (isOpen) {
      const defaultValues = {
        companyName: company?.companyName || '',
        primaryUserName: company?.primaryUserName || '',
        primaryUserEmail: company?.primaryUserEmail || '',
        primaryUserPassword: '', // Never pre-fill password
        address1: company?.address1 || '',
        address2: company?.address2 || '',
        city: company?.city || '',
        state: company?.state || '',
        zipCode: company?.zipCode || '',
        billingAddress1: company?.billingAddress1 || '',
        billingAddress2: company?.billingAddress2 || '',
        billingCity: company?.billingCity || '',
        billingState: company?.billingState || '',
        billingZipCode: company?.billingZipCode || '',
        paymentMethod: company?.paymentMethod || 'invoiced',
        contactName: company?.contactName || '',
        email: company?.email || '',
        phoneNumber: company?.phoneNumber || '',
        status: company?.status || 'active',
      };
      
      form.reset(defaultValues);
      
      // Set billing address checkbox state
      const hasBillingAddress = company?.billingAddress1 || company?.billingCity || company?.billingState;
      setUseSeparateBilling(!!hasBillingAddress);
    }
  }, [company, isOpen, form]);

  const handleSubmit = (data: CompanyFormData) => {
    if (isUpdate) {
      // For updates, only send changed fields that have meaningful values
      const changedData: Partial<CompanyFormData> = {};
      
      Object.keys(data).forEach((key) => {
        const fieldKey = key as keyof CompanyFormData;
        const newValue = data[fieldKey];
        const oldValue = company?.[fieldKey];
        
        // Only include field if it's meaningfully changed
        if (newValue !== oldValue && newValue !== '' && newValue !== undefined) {
          (changedData as any)[fieldKey] = newValue;
        }
      });
      
      // Don't send empty password
      if ('primaryUserPassword' in changedData && !changedData.primaryUserPassword) {
        delete (changedData as any).primaryUserPassword;
      }
      
      // Handle billing address logic
      if (!useSeparateBilling) {
        // Clear billing address if not using separate billing
        if (company?.billingAddress1 || company?.billingCity || company?.billingState) {
          (changedData as any).billingAddress1 = '';
          (changedData as any).billingAddress2 = '';
          (changedData as any).billingCity = '';
          (changedData as any).billingState = '';
          (changedData as any).billingZipCode = '';
        }
      }
      
      // Only submit if there are actual changes
      if (Object.keys(changedData).length > 0) {
        console.log('Submitting update data:', changedData);
        onSubmit(changedData);
      } else {
        console.log('No changes detected, closing modal');
        onClose(); // No changes to save
      }
    } else {
      // For creation, send all data
      if (!useSeparateBilling) {
        data.billingAddress1 = '';
        data.billingAddress2 = '';
        data.billingCity = '';
        data.billingState = '';
        data.billingZipCode = '';
      }
      
      console.log('Submitting create data:', data);
      onSubmit(data);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {company ? 'Edit Title Company' : 'Register Title Company'}
          </DialogTitle>
          {isUpdate && (
            <p className="text-sm text-muted-foreground mt-2">
              Only modify the fields you want to change. Empty fields will keep their current values.
            </p>
          )}
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            
            {/* Primary User Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Primary User Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="primaryUserName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary User Name {!isUpdate && '*'}</FormLabel>
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
                      <FormLabel>Primary User Email {!isUpdate && '*'}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter primary user email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!company && (
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
                )}
              </CardContent>
            </Card>

            {/* Company Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name {!isUpdate && '*'}</FormLabel>
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
                        <FormLabel>Contact Name {!isUpdate && '*'}</FormLabel>
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
                        <FormLabel>Company Email {!isUpdate && '*'}</FormLabel>
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status {!isUpdate && '*'}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Company Address */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Company Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="address1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address 1 {!isUpdate && '*'}</FormLabel>
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
                        <FormLabel>City {!isUpdate && '*'}</FormLabel>
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
                        <FormLabel>State {!isUpdate && '*'}</FormLabel>
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
                        <FormLabel>Zip Code {!isUpdate && '*'}</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter zip code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Billing Address */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Billing Address</CardTitle>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="separateBilling"
                    checked={useSeparateBilling}
                    onChange={(e) => setUseSeparateBilling(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="separateBilling" className="text-sm">
                    Use separate billing address
                  </label>
                </div>
              </CardHeader>
              
              {useSeparateBilling && (
                <CardContent className="space-y-4">
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
                </CardContent>
              )}
            </Card>

            <Separator />

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : company ? 'Update Company' : 'Register Company'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
