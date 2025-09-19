import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  Crown, 
  CheckCircle, 
  XCircle, 
  Clock,
  Settings,
  FileText,
  Briefcase
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface Manager {
  id: number;
  companyId: number;
  userId: number;
  managerRole: 'admin' | 'manager' | 'limited';
  permissions: {
    jobs: {
      create: boolean;
      edit: boolean;
      delete: boolean;
      assign_notary: boolean;
      manage_signers: boolean;
      view_all: boolean;
    };
    users: {
      invite: boolean;
      manage: boolean;
      remove: boolean;
      view_all: boolean;
    };
    company: {
      edit_settings: boolean;
      manage_billing: boolean;
      view_reports: boolean;
      manage_managers: boolean;
    };
    documents: {
      upload: boolean;
      download: boolean;
      delete: boolean;
      share: boolean;
    };
  };
  isActive: boolean;
  isPrimary: boolean;
  status: 'pending' | 'active' | 'suspended' | 'removed';
  createdAt: string;
  acceptedAt?: string;
  user?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
  };
}

interface PermissionTemplate {
  id: number;
  templateName: string;
  description?: string;
  permissions: Manager['permissions'];
  isDefault: boolean;
}

interface ManagerManagementProps {
  companyId: number;
}

export default function ManagerManagement({ companyId }: ManagerManagementProps) {
  const { user } = useAuth();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    managerRole: 'manager' as 'admin' | 'manager' | 'limited',
    templateId: ''
  });

  useEffect(() => {
    loadManagers();
    loadTemplates();
  }, [companyId]);

  const loadManagers = async () => {
    try {
      const response = await fetch(`/api/companies/${companyId}/managers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load managers');
      }

      const data = await response.json();
      setManagers(data.managers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load managers');
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch(`/api/companies/${companyId}/permission-templates`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load templates');
      }

      const data = await response.json();
      setTemplates(data.templates);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteManager = async () => {
    try {
      setInviteLoading(true);
      setError(null);
      
      const response = await fetch(`/api/companies/${companyId}/managers/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...inviteForm,
          templateId: inviteForm.templateId && inviteForm.templateId !== "default" ? parseInt(inviteForm.templateId) : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to invite manager');
      }

      const data = await response.json();
      
      // Reset form and close dialog
      setInviteForm({
        email: '',
        firstName: '',
        lastName: '',
        managerRole: 'manager',
        templateId: ''
      });
      setShowInviteDialog(false);
      setError('');
      
      // Show success message
      const successMessage = `✅ Invitation sent successfully to ${inviteForm.email}!`;
      setError(successMessage);
      setTimeout(() => setError(''), 5000);
      
      // Reload managers
      await loadManagers();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite manager');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveManager = async (managerId: number) => {
    if (!confirm('Are you sure you want to remove this manager?')) {
      return;
    }

    try {
      const response = await fetch(`/api/companies/${companyId}/managers/${managerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove manager');
      }

      await loadManagers();
      alert('Manager removed successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove manager');
    }
  };

  const getStatusBadge = (manager: Manager) => {
    const statusConfig = {
      pending: { variant: 'outline' as const, text: 'Pending' },
      active: { variant: 'default' as const, text: 'Active' },
      suspended: { variant: 'destructive' as const, text: 'Suspended' },
      removed: { variant: 'secondary' as const, text: 'Removed' }
    };

    const config = statusConfig[manager.status];
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      admin: { variant: 'default' as const, text: 'Admin', icon: Crown },
      manager: { variant: 'secondary' as const, text: 'Manager', icon: Users },
      limited: { variant: 'outline' as const, text: 'Limited', icon: FileText }
    };

    const config = roleConfig[role as keyof typeof roleConfig];
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading managers...</div>;
  }

  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Company Managers</h2>
          <p className="text-muted-foreground">
            Manage access and permissions for your title company
          </p>
        </div>
      </div>

      {/* Main invite button */}
      <div className="flex justify-end mb-4">
        <Button 
          onClick={() => setShowInviteDialog(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg shadow-md"
          size="lg"
        >
          <UserPlus className="h-5 w-5" />
          Invite Manager
        </Button>
      </div>

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                Invite New Manager
              </DialogTitle>
              <DialogDescription>
                Send an invitation to add a new manager to your title company. They'll receive an email with setup instructions.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
                  <Input
                    id="firstName"
                    value={inviteForm.firstName}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Enter first name"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
                  <Input
                    id="lastName"
                    value={inviteForm.lastName}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Enter last name"
                    className="h-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="manager@company.com"
                  className="h-10"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="managerRole" className="text-sm font-medium">Manager Role</Label>
                <Select 
                  value={inviteForm.managerRole} 
                  onValueChange={(value) => setInviteForm(prev => ({ ...prev, managerRole: value as any }))}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex flex-col">
                        <span className="font-medium">Admin</span>
                        <span className="text-sm text-muted-foreground">Full access to all features</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="manager">
                      <div className="flex flex-col">
                        <span className="font-medium">Manager</span>
                        <span className="text-sm text-muted-foreground">Limited administrative access</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="limited">
                      <div className="flex flex-col">
                        <span className="font-medium">Limited</span>
                        <span className="text-sm text-muted-foreground">View-only access</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {templates.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="template" className="text-sm font-medium">Permission Template (Optional)</Label>
                  <Select 
                    value={inviteForm.templateId} 
                    onValueChange={(value) => setInviteForm(prev => ({ ...prev, templateId: value }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Choose a permission template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">
                        <div className="flex flex-col">
                          <span className="font-medium">Use Role Defaults</span>
                          <span className="text-sm text-muted-foreground">Standard permissions for the selected role</span>
                        </div>
                      </SelectItem>
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          <div className="flex flex-col">
                            <span className="font-medium">{template.templateName}</span>
                            <span className="text-sm text-muted-foreground">Custom permission template</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            {error && (
              <Alert>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <DialogFooter className="gap-3 pt-6">
              <Button 
                variant="outline" 
                onClick={() => setShowInviteDialog(false)}
                className="flex-1 h-10"
                disabled={inviteLoading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleInviteManager}
                disabled={inviteLoading || !inviteForm.email || !inviteForm.firstName || !inviteForm.lastName || !inviteForm.managerRole}
                className="flex-1 h-10 bg-blue-600 hover:bg-blue-700"
              >
                {inviteLoading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Sending...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {error && (
        <Alert className={error.startsWith('✅') ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active Managers</CardTitle>
          <CardDescription>
            Current managers and their access levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Manager</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managers.map(manager => (
                <TableRow key={manager.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {manager.isPrimary && <Crown className="h-4 w-4 text-yellow-500" />}
                      <div>
                        <div className="font-medium">{manager.user?.fullName}</div>
                        <div className="text-sm text-muted-foreground">{manager.user?.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getRoleBadge(manager.managerRole)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(manager)}
                  </TableCell>
                  <TableCell>
                    {manager.acceptedAt 
                      ? new Date(manager.acceptedAt).toLocaleDateString()
                      : 'Not accepted'
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedManager(manager);
                          setShowPermissionsDialog(true);
                        }}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      {!manager.isPrimary && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleRemoveManager(manager.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {managers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No managers found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Permission Details Dialog */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manager Permissions</DialogTitle>
            <DialogDescription>
              View permissions for {selectedManager?.user?.fullName}
            </DialogDescription>
          </DialogHeader>
          
          {selectedManager && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Job Management
                  </h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Create Jobs</span>
                      {selectedManager.permissions.jobs.create ? 
                        <CheckCircle className="h-4 w-4 text-green-500" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />
                      }
                    </div>
                    <div className="flex justify-between">
                      <span>Edit Jobs</span>
                      {selectedManager.permissions.jobs.edit ? 
                        <CheckCircle className="h-4 w-4 text-green-500" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />
                      }
                    </div>
                    <div className="flex justify-between">
                      <span>Delete Jobs</span>
                      {selectedManager.permissions.jobs.delete ? 
                        <CheckCircle className="h-4 w-4 text-green-500" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />
                      }
                    </div>
                    <div className="flex justify-between">
                      <span>Assign Notary</span>
                      {selectedManager.permissions.jobs.assign_notary ? 
                        <CheckCircle className="h-4 w-4 text-green-500" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />
                      }
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    User Management
                  </h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Invite Users</span>
                      {selectedManager.permissions.users.invite ? 
                        <CheckCircle className="h-4 w-4 text-green-500" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />
                      }
                    </div>
                    <div className="flex justify-between">
                      <span>Manage Users</span>
                      {selectedManager.permissions.users.manage ? 
                        <CheckCircle className="h-4 w-4 text-green-500" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />
                      }
                    </div>
                    <div className="flex justify-between">
                      <span>Remove Users</span>
                      {selectedManager.permissions.users.remove ? 
                        <CheckCircle className="h-4 w-4 text-green-500" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermissionsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
