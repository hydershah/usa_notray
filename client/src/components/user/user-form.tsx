import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { insertUserSchema, type User } from '@shared/types';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User as UserIcon, Shield, FileText, Settings, Eye, EyeOff } from 'lucide-react';

// Create a partial schema for updates that makes most fields optional
const userUpdateSchema = z.object({
  username: z.string().min(1, 'Username is required').optional(),
  email: z.string().email('Valid email is required').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  role: z.string().optional(),
  privileges: z.array(z.string()).optional(),
  notaryType: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  phoneNumber: z.string().optional(),
  commissionNumber: z.string().optional(),
  commissionExpiration: z.string().optional(),
  state: z.string().optional(),
  county: z.string().optional(),
  isActive: z.boolean().optional(),
  isNotarySigningAgent: z.boolean().optional(),
  isSpanishSpeaking: z.boolean().optional(),
});

// Use strict schema for creation, partial for updates
const userSchema = insertUserSchema.extend({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserFormProps {
  user?: any;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UserFormData | Partial<UserFormData>) => void;
  isLoading?: boolean;
  defaultRole?: 'admin' | 'title_company' | 'notary' | 'client';
}

const availablePrivileges = [
  'dashboard',
  'jobs',
  'create_job',
  'notary_management',
  'title_companies',
  'user_management',
  'notarization_logs',
];

export function UserForm({ user, isOpen, onClose, onSubmit, isLoading = false, defaultRole = 'client' }: UserFormProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const isUpdate = !!user;
  
  const form = useForm<UserFormData>({
    resolver: zodResolver(isUpdate ? userUpdateSchema : userSchema),
    defaultValues: {
      username: user?.username || '',
      email: user?.email || '',
      password: '',
      role: user?.role || defaultRole,
      privileges: user?.privileges || [],
      notaryType: user?.notaryType || 'contractor',
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      fullName: user?.fullName || '',
      phoneNumber: user?.phoneNumber || '',
      commissionNumber: user?.commissionNumber || '',
      commissionExpiration: user?.commissionExpiration || '',
      state: user?.state || '',
      county: user?.county || '',
      isActive: user?.isActive ?? true,
      isNotarySigningAgent: user?.isNotarySigningAgent ?? false,
      isSpanishSpeaking: user?.isSpanishSpeaking ?? false,
    },
  });

  // Reset form when user data changes or dialog opens
  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        username: user?.username || '',
        email: user?.email || '',
        password: '', // Always empty for security
        role: user?.role || defaultRole,
        privileges: user?.privileges || [],
        notaryType: user?.notaryType || 'contractor',
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        fullName: user?.fullName || '',
        phoneNumber: user?.phoneNumber || '',
        commissionNumber: user?.commissionNumber || '',
        commissionExpiration: user?.commissionExpiration || '',
        state: user?.state || '',
        county: user?.county || '',
        isActive: user?.isActive ?? true,
        isNotarySigningAgent: user?.isNotarySigningAgent ?? false,
        isSpanishSpeaking: user?.isSpanishSpeaking ?? false,
      });
    }
  }, [user, isOpen, form, defaultRole]);

  const handleSubmit = (data: UserFormData) => {
    if (isUpdate) {
      // For updates, only send changed fields
      const changedData: Partial<UserFormData> = {};
      
      Object.keys(data).forEach((key) => {
        const fieldKey = key as keyof UserFormData;
        const newValue = data[fieldKey];
        const oldValue = user?.[fieldKey];
        
        // Only include field if it's changed and not empty
        if (newValue !== oldValue && newValue !== '' && newValue !== undefined) {
          (changedData as any)[fieldKey] = newValue;
        }
      });
      
      // Don't send empty password
      if ('password' in changedData && changedData.password === '') {
        delete (changedData as any).password;
      }
      
      // Only submit if there are actual changes
      if (Object.keys(changedData).length > 0) {
        onSubmit(changedData);
      } else {
        onClose(); // No changes to save
      }
    } else {
      // For creation, send all data
      onSubmit(data);
      form.reset();
    }
  };

  const selectedRole = form.watch('role');
  const firstName = form.watch('firstName');
  const lastName = form.watch('lastName');

  // Auto-generate fullName from firstName and lastName
  React.useEffect(() => {
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (fullName && fullName !== form.getValues('fullName')) {
      form.setValue('fullName', fullName);
    }
  }, [firstName, lastName, form]);

  // Default privileges based on role and notary type
  const getDefaultPrivileges = (role: string, notaryType?: string): string[] => {
    switch (role) {
      case 'admin':
        return availablePrivileges;
      case 'title_company':
        return ['dashboard', 'jobs', 'create_job'];
      case 'notary':
        if (notaryType === 'subscriber') {
          return ['dashboard', 'jobs', 'create_job', 'notarization_logs'];
        } else {
          // contractor
          return ['dashboard', 'jobs', 'notarization_logs'];
        }
      case 'client':
        return ['dashboard', 'jobs'];
      default:
        return [];
    }
  };

  // Update privileges when role changes
  const handleRoleChange = (role: string) => {
    form.setValue('role', role as any);
    const currentNotaryType = form.getValues('notaryType');
    form.setValue('privileges', getDefaultPrivileges(role, currentNotaryType));
    
    // Set default notary type if switching to notary role
    if (role === 'notary' && !currentNotaryType) {
      form.setValue('notaryType', 'contractor');
    }
  };

  // Update privileges when notary type changes
  const handleNotaryTypeChange = (notaryType: string) => {
    form.setValue('notaryType', notaryType as any);
    const currentRole = form.getValues('role');
    form.setValue('privileges', getDefaultPrivileges(currentRole, notaryType));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[750px] lg:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
            <UserIcon className="h-6 w-6" />
            {user ? 'Edit User' : 'Add User'}
          </DialogTitle>
          {isUpdate && (
            <p className="text-sm text-muted-foreground mt-2">
              Only modify the fields you want to change. Empty fields will keep their current values.
            </p>
          )}
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            {/* Account Information Section */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          Username {!isUpdate && '*'}
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Enter username" {...field} />
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
                        <FormLabel className="text-sm font-medium">
                          Email {!isUpdate && '*'}
                        </FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Enter email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          Password {!isUpdate && '*'}
                          {user && <span className="text-sm text-muted-foreground ml-1">(leave blank to keep current)</span>}
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type={showPassword ? "text" : "password"} 
                              placeholder={user ? "Enter new password" : "Enter password"} 
                              className="pr-12"
                              {...field} 
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Role</FormLabel>
                        <Select onValueChange={handleRoleChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="title_company">Title Company</SelectItem>
                            <SelectItem value="notary">Notary</SelectItem>
                            <SelectItem value="client">Client</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Notary Type Field - Only show for notaries */}
                  {selectedRole === 'notary' && (
                    <FormField
                      control={form.control}
                      name="notaryType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Notary Type</FormLabel>
                          <Select onValueChange={handleNotaryTypeChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select notary type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="contractor">Contractor - Jobs assigned by admin only</SelectItem>
                              <SelectItem value="subscriber">Subscriber - Can create and get assigned jobs</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Personal Information Section */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserIcon className="h-5 w-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="First name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Last name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Full Name (Auto-generated) {!isUpdate && '*'}
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Full name" 
                          {...field} 
                          readOnly
                          className="bg-gray-50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Phone Number {!isUpdate && '*'}
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Enhanced User Status Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-3 border rounded-lg">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-medium">
                            Active User
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isNotarySigningAgent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-3 border rounded-lg">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-medium">
                            Notary Signing Agent
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isSpanishSpeaking"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-3 border rounded-lg">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-medium">
                            Spanish Speaking
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notary-specific fields - Only show for notaries */}
            {selectedRole === 'notary' && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Notary Credentials
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="commissionNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Commission Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Commission number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="commissionExpiration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Commission Expiration</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">State</FormLabel>
                          <FormControl>
                            <Input placeholder="State" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="county"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">County</FormLabel>
                          <FormControl>
                            <Input placeholder="County" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Privileges Section */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Privileges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="privileges"
                  render={() => (
                    <FormItem>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {availablePrivileges.map((privilege) => (
                          <FormField
                            key={privilege}
                            control={form.control}
                            name="privileges"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={privilege}
                                  className="flex flex-row items-start space-x-3 space-y-0 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(privilege)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, privilege])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== privilege
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-medium capitalize cursor-pointer">
                                    {privilege.replace('_', ' ')}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <Button type="button" variant="outline" onClick={onClose} size="lg">
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} size="lg">
                {isLoading ? 'Saving...' : user ? 'Update User' : 'Create User'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
