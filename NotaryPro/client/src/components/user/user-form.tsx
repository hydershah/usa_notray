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
import { Checkbox } from '@/components/ui/checkbox';

const userSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  role: z.enum(['admin', 'title_company', 'notary', 'client']),
  privileges: z.array(z.string()).default([]),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserFormProps {
  user?: any;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UserFormData) => void;
  isLoading?: boolean;
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

export function UserForm({ user, isOpen, onClose, onSubmit, isLoading = false }: UserFormProps) {
  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: user?.username || '',
      email: user?.email || '',
      password: '',
      role: user?.role || 'client',
      privileges: user?.privileges || [],
    },
  });

  const handleSubmit = (data: UserFormData) => {
    // Don't send empty password for updates
    if (user && !data.password) {
      delete data.password;
    }
    onSubmit(data);
    if (!user) {
      form.reset();
    }
  };

  const selectedRole = form.watch('role');

  // Default privileges based on role
  const getDefaultPrivileges = (role: string): string[] => {
    switch (role) {
      case 'admin':
        return availablePrivileges;
      case 'title_company':
        return ['dashboard', 'jobs', 'create_job'];
      case 'notary':
        return ['dashboard', 'jobs', 'notarization_logs'];
      case 'client':
        return ['dashboard', 'jobs'];
      default:
        return [];
    }
  };

  // Update privileges when role changes
  const handleRoleChange = (role: string) => {
    form.setValue('role', role as any);
    form.setValue('privileges', getDefaultPrivileges(role));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {user ? 'Edit User' : 'Add User'}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Enter email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Password {user && <span className="text-sm text-gray-500">(leave blank to keep current)</span>}
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder={user ? "Enter new password" : "Enter password"} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
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

            <FormField
              control={form.control}
              name="privileges"
              render={() => (
                <FormItem>
                  <FormLabel>Privileges</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {availablePrivileges.map((privilege) => (
                      <FormField
                        key={privilege}
                        control={form.control}
                        name="privileges"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={privilege}
                              className="flex flex-row items-start space-x-3 space-y-0"
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
                              <FormLabel className="text-sm font-normal capitalize">
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

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : user ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
