import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserForm } from '@/components/user/user-form';
import { AdminCertificateManager } from '@/components/admin/AdminCertificateManager';
import { NotaryDetailView } from '@/components/admin/NotaryDetailView';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { getRoleColor, formatRole, formatDate, formatDateTime } from '@/lib/utils';
import { 
  Plus, 
  Edit, 
  Trash2, 
  User, 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  UserCheck,
  UserX,
  Mail,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Key,
  RotateCcw,
  Download,
  FileText,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  MoreHorizontal,
  Globe,
  Lock,
  Unlock,
  Calendar,
  Database
} from 'lucide-react';

export default function UserManagement() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [isUserDetailsOpen, setIsUserDetailsOpen] = useState(false);
  const [userForDetails, setUserForDetails] = useState<any>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [auditUser, setAuditUser] = useState<any>(null);
  const [isRoleEditOpen, setIsRoleEditOpen] = useState(false);
  const [roleEditUser, setRoleEditUser] = useState<any>(null);
  const [isCertificateManagementOpen, setIsCertificateManagementOpen] = useState(false);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [twoFAFilter, setTwoFAFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Bulk actions state
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkRoleChangeOpen, setIsBulkRoleChangeOpen] = useState(false);
  const [bulkNewRole, setBulkNewRole] = useState('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['/api/users'],
  });

  // Filtered and sorted users with pagination
  const filteredAndSortedUsers = useMemo(() => {
    if (!Array.isArray(users)) return [];
    
    let filtered = users.filter((user: any) => {
      const matchesSearch = 
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || 
        user.role === roleFilter ||
        (roleFilter === 'notary_contractor' && user.role === 'notary' && user.notaryType === 'contractor') ||
        (roleFilter === 'notary_subscriber' && user.role === 'notary' && user.notaryType === 'subscriber');
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && user.isActive !== false) ||
        (statusFilter === 'inactive' && user.isActive === false);
      
      return matchesSearch && matchesRole && matchesStatus;
    });

    // Sort users
    filtered.sort((a: any, b: any) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.username?.toLowerCase() || '';
          bValue = b.username?.toLowerCase() || '';
          break;
        case 'email':
          aValue = a.email?.toLowerCase() || '';
          bValue = b.email?.toLowerCase() || '';
          break;
        case 'role':
          aValue = a.role?.toLowerCase() || '';
          bValue = b.role?.toLowerCase() || '';
          break;
        case 'created':
          aValue = new Date(a.createdAt || 0).getTime();
          bValue = new Date(b.createdAt || 0).getTime();
          break;
        default:
          aValue = a.username?.toLowerCase() || '';
          bValue = b.username?.toLowerCase() || '';
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [users, searchTerm, roleFilter, statusFilter, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);
  const paginatedUsers = filteredAndSortedUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/auth/register', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "User created successfully.",
      });
      setIsFormOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create user.",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest('PATCH', `/api/users/${id}/quick-update`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "User updated successfully.",
      });
      setIsFormOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update user.",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/users/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "User deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete user.",
      });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ id, isActive, role }: { id: number; isActive: boolean; role: string }) => {
      const payload: { isActive: boolean; approvalStatus?: string } = { isActive };
      
      // For notary users, also set approval status when activating
      if (role === 'notary' && isActive) {
        payload.approvalStatus = 'approved';
      }
      
      const response = await apiRequest('PATCH', `/api/users/${id}/status`, payload);
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      
      const isNotaryApproval = variables.role === 'notary' && variables.isActive;
      toast({
        title: "Success",
        description: isNotaryApproval 
          ? "Notary user approved and activated successfully." 
          : "User status updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update user status.",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (userIds: number[]) => {
      await Promise.all(userIds.map(id => apiRequest('DELETE', `/api/users/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: `${selectedUsers.length} users deleted successfully.`,
      });
      setIsBulkDeleteOpen(false);
      setSelectedUsers([]);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete users.",
      });
    },
  });

  const bulkRoleChangeMutation = useMutation({
    mutationFn: async ({ userIds, role }: { userIds: number[]; role: string }) => {
      await Promise.all(userIds.map(id => apiRequest('PATCH', `/api/users/${id}/quick-update`, { role })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: `Role updated for ${selectedUsers.length} users.`,
      });
      setIsBulkRoleChangeOpen(false);
      setSelectedUsers([]);
      setBulkNewRole('');
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update user roles.",
      });
    },
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (data: { email: string; role: string; message?: string }) => {
      const response = await apiRequest('POST', '/api/users/invite', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "Invitation sent successfully.",
      });
      setIsInviteModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send invitation.",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest('POST', `/api/users/${userId}/reset-password`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password reset email sent to user.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to reset password.",
      });
    },
  });

  const toggle2FAMutation = useMutation({
    mutationFn: async ({ userId, enabled }: { userId: number; enabled: boolean }) => {
      const response = await apiRequest('PATCH', `/api/users/${userId}/2fa/toggle`, { enabled });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "2FA settings updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update 2FA settings.",
      });
    },
  });

  const generateAPIKeyMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest('POST', `/api/users/${userId}/api-key`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "API Key Generated",
        description: `New API key: ${data.apiKey}`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to generate API key.",
      });
    },
  });

  const generateCertificateMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest('POST', `/api/certificates/generate/${userId}`);
      return response.json();
    },
    onSuccess: (data, userId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Certificate Generated",
        description: `Certificate generated successfully for user ${userId}`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to generate certificate",
      });
    },
  });

  const revokeCertificateMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: number; reason: string }) => {
      const response = await apiRequest('POST', `/api/certificates/revoke/${userId}`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Certificate Revoked",
        description: "Certificate has been revoked successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to revoke certificate",
      });
    },
  });

  const handleAddUser = () => {
    setSelectedUser(null);
    setIsFormOpen(true);
  };

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setIsFormOpen(true);
  };

  const handleDeleteUser = (user: any) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleViewUser = (user: any) => {
    setUserForDetails(user);
    setIsUserDetailsOpen(true);
  };

  const handleFormSubmit = (data: any) => {
    if (selectedUser) {
      updateUserMutation.mutate({ id: selectedUser.id, data });
    } else {
      createUserMutation.mutate(data);
    }
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  const handleToggleUserStatus = (user: any) => {
    toggleUserStatusMutation.mutate({ 
      id: user.id, 
      isActive: user.isActive === false ? true : false,
      role: user.role
    });
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleSelectUser = (userId: number, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(paginatedUsers.map((user: any) => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleBulkDelete = () => {
    if (selectedUsers.length > 0) {
      setIsBulkDeleteOpen(true);
    }
  };

  const confirmBulkDelete = () => {
    bulkDeleteMutation.mutate(selectedUsers);
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortOrder === 'asc' ? 
      <ArrowUp className="w-4 h-4" /> : 
      <ArrowDown className="w-4 h-4" />;
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleInviteUser = () => {
    setIsInviteModalOpen(true);
  };

  const handleViewAuditLog = (user: any) => {
    setAuditUser(user);
    setIsAuditLogOpen(true);
  };

  const handleEditRole = (user: any) => {
    setRoleEditUser(user);
    setIsRoleEditOpen(true);
  };

  const handleResetPassword = (user: any) => {
    resetPasswordMutation.mutate(user.id);
  };

    const handleToggle2FA = (user: any) => {
    toggle2FAMutation.mutate({
      userId: user.id,
      enabled: !user.mfaEnabled
    });
  };

  const handleBulk2FAToggle = (enabled: boolean) => {
    if (selectedUsers.length === 0) return;
    
    // Toggle 2FA for all selected users
    selectedUsers.forEach(userId => {
      toggle2FAMutation.mutate({
        userId,
        enabled
      });
    });
    
    // Clear selection after operation
    setSelectedUsers([]);
    
    toast({
      title: `2FA ${enabled ? 'Enabled' : 'Disabled'}`,
      description: `Two-factor authentication has been ${enabled ? 'enabled' : 'disabled'} for ${selectedUsers.length} selected user(s).`,
    });
  };

  const handleGenerateAPIKey = (user: any) => {
    generateAPIKeyMutation.mutate(user.id);
  };

  const handleGenerateCertificate = (user: any) => {
    generateCertificateMutation.mutate(user.id);
  };

  const handleDownloadCertificate = async (user: any, fileType: 'p12' | 'pem' = 'p12') => {
    try {
      const response = await apiRequest('GET', `/api/certificates/download/${user.id}?type=${fileType}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notary-certificate-${user.id}.${fileType}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        // Show password if available
        const password = response.headers.get('X-Certificate-Password');
        if (password && fileType === 'p12') {
          toast({
            title: "Certificate Downloaded",
            description: `P12 Password: ${password}`,
          });
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: error.message || "Failed to download certificate",
      });
    }
  };

  const handleRevokeCertificate = (user: any) => {
    const reason = prompt('Enter reason for revocation:');
    if (reason) {
      revokeCertificateMutation.mutate({ userId: user.id, reason });
    }
  };

  const handleValidateCertificate = async (user: any) => {
    try {
      const response = await apiRequest('GET', `/api/certificates/validate/${user.id}`);
      const data = await response.json();
      
      if (data.valid) {
        toast({
          title: "Certificate Valid",
          description: `Certificate is valid. Days remaining: ${data.daysRemaining}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Certificate Invalid",
          description: data.error || "Certificate is not valid",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Validation Failed",
        description: error.message || "Failed to validate certificate",
      });
    }
  };

  const handleBulkRoleChange = () => {
    if (selectedUsers.length > 0) {
      setIsBulkRoleChangeOpen(true);
    }
  };

  const confirmBulkRoleChange = () => {
    if (bulkNewRole && selectedUsers.length > 0) {
      bulkRoleChangeMutation.mutate({ userIds: selectedUsers, role: bulkNewRole });
    }
  };

  const handleExportUsers = (format: 'csv' | 'pdf') => {
    const exportData = filteredAndSortedUsers.map((user: any) => ({
      username: user.username,
      email: user.email,
      role: formatRole(user.role),
      status: user.isActive !== false ? 'Active' : 'Inactive',
              twoFA: user.mfaEnabled ? 'Enabled' : 'Disabled',
      lastLogin: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never',
      created: formatDate(user.createdAt),
      profileCompletion: `${getProfileCompletion(user)}%`
    }));

    if (format === 'csv') {
      const csv = [
        Object.keys(exportData[0] || {}).join(','),
        ...exportData.map(row => Object.values(row).join(','))
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // PDF export requires jsPDF library
      toast({
        variant: "destructive",
        title: "PDF Export Not Available",
        description: "PDF export functionality requires jsPDF library. Please install it using: npm install jspdf @types/jspdf",
      });
    }
  };

  const getStatusBadge = (user: any) => {
    if (user.isActive === false) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        Suspended
      </Badge>;
    }
    if (user.emailVerified === false) {
      return <Badge variant="secondary" className="flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Pending
      </Badge>;
    }
    return <Badge variant="default" className="flex items-center gap-1 bg-green-500">
      <CheckCircle className="w-3 h-3" />
      Active
    </Badge>;
  };

  const getProfileCompletion = (user: any): number => {
    let completion = 0;
    if (user.username) completion += 20;
    if (user.email) completion += 20;
    if (user.emailVerified) completion += 20;
    if (user.role) completion += 20;
    if (user.mfaEnabled) completion += 20;
    return completion;
  };

  const getRolePermissions = (role: string, notaryType?: string): string[] => {
    switch (role) {
      case 'admin':
        return ['Full system access', 'User management', 'System settings', 'All documents'];
      case 'title_company':
        return ['Create jobs', 'Manage signers', 'View documents', 'Company settings'];
      case 'notary':
        const baseNotaryPerms = ['Accept jobs', 'Sign documents', 'Schedule appointments', 'View assigned jobs'];
        if (notaryType === 'subscriber') {
          return [...baseNotaryPerms, 'Create jobs', 'Manage own clients'];
        } else {
          return [...baseNotaryPerms, 'Jobs assigned by admin only'];
        }
      case 'client':
        return ['View assigned documents', 'Sign documents', 'Basic profile'];
      default:
        return ['Basic access'];
    }
  };

  return (
    <MainLayout>
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-12">
        <div className="px-1 sm:px-2 lg:px-3 xl:px-4">
          <TooltipProvider>
            <Card className="w-full max-w-none border-0 shadow-sm min-w-0">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Management
              </CardTitle>
              <div className="flex gap-2 mt-4 sm:mt-0">
                {selectedUsers.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleBulkRoleChange}
                      size="sm"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Change Role ({selectedUsers.length})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleBulk2FAToggle(true)}
                      size="sm"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Enable 2FA ({selectedUsers.length})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleBulk2FAToggle(false)}
                      size="sm"
                    >
                      <ShieldAlert className="h-4 w-4 mr-2" />
                      Disable 2FA ({selectedUsers.length})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsCertificateManagementOpen(true)}
                      size="sm"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Certificate Management
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleBulkDelete}
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected ({selectedUsers.length})
                    </Button>
                  </>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleExportUsers('csv')}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportUsers('pdf')}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export as PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={handleInviteUser} size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Invite User
                </Button>
                <Button onClick={handleAddUser}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="px-2 sm:px-4 lg:px-6">
            {/* Advanced Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by name, email, or role..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="title_company">Title Company</SelectItem>
                    <SelectItem value="notary">All Notaries</SelectItem>
                    <SelectItem value="notary_contractor">Notary - Contractor</SelectItem>
                    <SelectItem value="notary_subscriber">Notary - Subscriber</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={verificationFilter} onValueChange={setVerificationFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Verification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={twoFAFilter} onValueChange={setTwoFAFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="2FA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All 2FA</SelectItem>
                    <SelectItem value="enabled">Enabled</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results Summary */}
            <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
              <span>
                Showing {paginatedUsers.length} of {filteredAndSortedUsers.length} users
                {searchTerm && ` matching "${searchTerm}"`}
              </span>
              <span>Total: {Array.isArray(users) ? users.length : 0} users</span>
            </div>

                         <div className="overflow-x-auto w-full -mx-2 sm:-mx-4 lg:-mx-6">
               <div className="inline-block min-w-full align-middle px-2 sm:px-4 lg:px-6">
              {isLoading ? (
                <div className="text-center py-8">Loading users...</div>
              ) : filteredAndSortedUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? `No users found matching "${searchTerm}"` : "No users found. Invite or add users to get started."}
                </div>
              ) : (
                <Table className="w-full min-w-full table-fixed lg:table-auto">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-48 lg:w-56">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('name')}
                          className="h-8 px-2 font-medium"
                        >
                          User
                          {getSortIcon('name')}
                        </Button>
                      </TableHead>
                      <TableHead className="w-56 lg:w-64">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('email')}
                          className="h-8 px-2 font-medium"
                        >
                          Email
                          {getSortIcon('email')}
                        </Button>
                      </TableHead>
                      <TableHead className="w-40 lg:w-48">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('role')}
                          className="h-8 px-2 font-medium"
                        >
                          Role
                          {getSortIcon('role')}
                        </Button>
                      </TableHead>
                      <TableHead className="w-32 lg:w-36">Status</TableHead>
                      <TableHead className="w-32 lg:w-36">Security</TableHead>
                      <TableHead className="w-40 lg:w-48">Last Login</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedUsers.includes(user.id)}
                            onCheckedChange={(checked) => handleSelectUser(user.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Avatar className="h-10 w-10 mr-3">
                              <AvatarFallback>
                                <User className="h-5 w-5" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-gray-900">{user.username}</div>
                              <div className="text-sm text-gray-500">@{user.username.toLowerCase()}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[180px]">
                            <div className="font-medium">{user.email}</div>
                            <div className="flex items-center gap-1 mt-1">
                              {user.emailVerified !== false ? (
                                <Badge variant="default" className="text-xs bg-green-500">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Verified
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Unverified
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className={getRoleColor(user.role)}>
                                {formatRole(user.role)}
                              </Badge>
                              {user.role === 'notary' && user.notaryType && (
                                <Badge variant="secondary" className="text-xs">
                                  {user.notaryType === 'contractor' ? 'Contractor' : 'Subscriber'}
                                </Badge>
                              )}
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => handleEditRole(user)}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm">
                                  <div className="font-medium">Role Permissions:</div>
                                  <ul className="list-disc list-inside">
                                    {getRolePermissions(user.role, user.notaryType).map((perm, i) => (
                                      <li key={i}>{perm}</li>
                                    ))}
                                  </ul>
                                  {user.role === 'notary' && (
                                    <div className="mt-2 text-xs text-gray-500">
                                      Type: {user.notaryType === 'contractor' ? 'Contractor (Admin assigns jobs)' : 'Subscriber (Can create jobs)'}
                                    </div>
                                  )}
                                  <div className="mt-2 text-xs text-gray-500">
                                    Click to edit role
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(user)}
                            <Switch
                              checked={user.isActive !== false}
                              onCheckedChange={() => handleToggleUserStatus(user)}
                              disabled={toggleUserStatusMutation.isPending}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Badge variant={user.mfaEnabled ? "default" : "secondary"} className="text-xs cursor-pointer">
                                    {user.mfaEnabled ? (
                                      <Shield className="w-3 h-3 mr-1" />
                                    ) : (
                                      <ShieldAlert className="w-3 h-3 mr-1" />
                                    )}
                                    2FA
                                  </Badge>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm">
                                  <div className="font-medium">Two-Factor Authentication</div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Status: {user.mfaEnabled ? 'Enabled' : 'Disabled'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Click the options menu to toggle
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                            {(user.role === 'title_company' || user.role === 'admin') && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Badge variant="outline" className="text-xs cursor-pointer">
                                      <Key className="w-3 h-3 mr-1" />
                                      API
                                    </Badge>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-sm">
                                    <div className="font-medium">API Access</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      API key generation available
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Use options menu to generate
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm min-w-[140px]">
                            {user.lastLoginAt ? (
                              <div className="space-y-1">
                                <div className="font-medium">{formatDate(user.lastLoginAt)}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(user.lastLoginAt).toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </div>
                                {user.lastLoginIP && (
                                  <div className="text-xs text-gray-500 flex items-center gap-1">
                                    <Globe className="w-3 h-3" />
                                    {user.lastLoginIP}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-500">Never</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewUser(user)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleViewAuditLog(user)}>
                                <Activity className="h-4 w-4 mr-2" />
                                View Audit Log
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit User
                              </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset Password
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggle2FA(user)}>
                        <Shield className="h-4 w-4 mr-2" />
                        {user.mfaEnabled ? 'Disable' : 'Enable'} 2FA
                      </DropdownMenuItem>
                      
                      {/* Certificate Management - Only for Notaries */}
                      {user.role === 'notary' && (
                        <>
                          <DropdownMenuItem onClick={() => handleGenerateCertificate(user)}>
                            <Key className="h-4 w-4 mr-2" />
                            Generate Certificate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadCertificate(user, 'p12')}>
                            <Download className="h-4 w-4 mr-2" />
                            Download Certificate (.p12)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadCertificate(user, 'pem')}>
                            <FileText className="h-4 w-4 mr-2" />
                            Download Certificate (.pem)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleValidateCertificate(user)}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Validate Certificate
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleRevokeCertificate(user)}
                            className="text-orange-600"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Revoke Certificate
                          </DropdownMenuItem>
                        </>
                      )}
                      
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDeleteUser(user)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete User
                      </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              </div>
            </div>

            {/* Enhanced Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages} • {filteredAndSortedUsers.length} total results
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  {/* Page numbers */}
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === currentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="w-10"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    Last
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
          </TooltipProvider>
        </div>
      </div>

      <UserForm
        user={selectedUser}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedUser(null);
        }}
        onSubmit={handleFormSubmit}
        isLoading={createUserMutation.isPending || updateUserMutation.isPending}
      />

      {/* Enhanced Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete User Account
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user
              <strong> "{userToDelete?.username}" </strong> and all associated data including:
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>User profile and account information</li>
                <li>Job history and documents</li>
                <li>Audit logs and activity records</li>
                <li>API keys and authentication tokens</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Multiple Users
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to permanently delete <strong>{selectedUsers.length} users</strong>. 
              This action cannot be undone and will remove all associated data for each user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedUsers.length} Users`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Role Change Dialog */}
      <AlertDialog open={isBulkRoleChangeOpen} onOpenChange={setIsBulkRoleChangeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Change User Roles
            </AlertDialogTitle>
            <AlertDialogDescription>
              Change the role for {selectedUsers.length} selected users. This will update their permissions immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={bulkNewRole} onValueChange={setBulkNewRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select new role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="title_company">Title Company</SelectItem>
                <SelectItem value="notary">Notary</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkRoleChange}
              disabled={!bulkNewRole || bulkRoleChangeMutation.isPending}
            >
              {bulkRoleChangeMutation.isPending ? "Updating..." : "Update Roles"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite User Dialog */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Invite New User
            </DialogTitle>
            <DialogDescription>
              Send an email invitation to a new user with a pre-assigned role.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const email = formData.get('email') as string;
            const role = formData.get('role') as string;
            const message = formData.get('message') as string;
            
            if (!email || !role) {
              toast({
                variant: "destructive",
                title: "Error",
                description: "Please fill in all required fields.",
              });
              return;
            }
            
            inviteUserMutation.mutate({ email, role, message });
          }}>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Email Address *</label>
                <Input
                  name="email"
                  type="email"
                  placeholder="user@example.com"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Role *</label>
                <select 
                  name="role" 
                  required
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select role</option>
                  <option value="title_company">Title Company</option>
                  <option value="notary">Notary</option>
                  <option value="client">Client</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Custom Message (Optional)</label>
                <Input
                  name="message"
                  placeholder="Welcome to our platform..."
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsInviteModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteUserMutation.isPending}>
                {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* User Details Dialog */}
      <Dialog open={isUserDetailsOpen} onOpenChange={setIsUserDetailsOpen}>
        <DialogContent className={`${userForDetails?.role === 'notary' ? 'sm:max-w-7xl' : 'sm:max-w-2xl'} max-h-[90vh] overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {userForDetails?.role === 'notary' ? 'Comprehensive Notary Profile' : 'User Details'} - {userForDetails?.username}
            </DialogTitle>
            <DialogDescription>
              {userForDetails?.role === 'notary' 
                ? 'Complete notary profile information, commission details, and system information'
                : 'Complete user profile and system information'
              }
            </DialogDescription>
          </DialogHeader>
          {userForDetails && (
            <>
              {/* For Notary Users - Show Comprehensive Notary Profile */}
              {userForDetails.role === 'notary' ? (
                <NotaryDetailView 
                  notaryId={userForDetails.id}
                  onClose={() => setIsUserDetailsOpen(false)}
                />
              ) : (
                /* For Non-Notary Users - Show Basic User Details */
                <div className="space-y-6 py-4">
                  {/* Basic Information */}
              <div>
                <h3 className="font-medium text-sm text-gray-900 mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Username:</span>
                    <div className="font-medium">{userForDetails.username}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <div className="font-medium">{userForDetails.email}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Role:</span>
                    <div>
                      <Badge className={getRoleColor(userForDetails.role)}>
                        {formatRole(userForDetails.role)}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <div>{getStatusBadge(userForDetails)}</div>
                  </div>
                </div>
              </div>

              {/* Security Information */}
              <div>
                <h3 className="font-medium text-sm text-gray-900 mb-3">Security & Access</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Two-Factor Auth:</span>
                    <div className="flex items-center gap-2">
                      {userForDetails.mfaEnabled ? (
                        <Badge variant="default" className="text-xs">
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <ShieldAlert className="w-3 h-3 mr-1" />
                          Disabled
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Email Verified:</span>
                    <div className="flex items-center gap-2">
                      {userForDetails.emailVerified !== false ? (
                        <Badge variant="default" className="text-xs bg-green-500">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Last Login:</span>
                    <div>{userForDetails.lastLoginAt ? formatDateTime(userForDetails.lastLoginAt) : 'Never'}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Login IP:</span>
                    <div className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {userForDetails.lastLoginIP || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Completion */}
              <div>
                <h3 className="font-medium text-sm text-gray-900 mb-3">Profile Completion</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Overall Progress</span>
                    <span className="text-sm font-medium">{getProfileCompletion(userForDetails)}%</span>
                  </div>
                  <Progress value={getProfileCompletion(userForDetails)} className="h-2" />
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      {userForDetails.username ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                      Username
                    </div>
                    <div className="flex items-center gap-1">
                      {userForDetails.email ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                      Email
                    </div>
                    <div className="flex items-center gap-1">
                      {userForDetails.emailVerified !== false ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                      Email Verified
                    </div>
                    <div className="flex items-center gap-1">
                      {userForDetails.mfaEnabled ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                      Two-Factor Auth
                    </div>
                  </div>
                </div>
              </div>

              {/* Role Permissions */}
              <div>
                <h3 className="font-medium text-sm text-gray-900 mb-3">Role Permissions</h3>
                <div className="bg-gray-50 rounded-lg p-3">
                  <ul className="text-sm space-y-1">
                    {getRolePermissions(userForDetails.role, userForDetails.notaryType).map((permission, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        {permission}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* API Access (for applicable roles) */}
              {(userForDetails.role === 'title_company' || userForDetails.role === 'admin') && (
                <div>
                  <h3 className="font-medium text-sm text-gray-900 mb-3">API Access</h3>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">API Key Status:</span>
                      <Badge variant="outline" className="text-xs">
                        <Key className="w-3 h-3 mr-1" />
                        {userForDetails.apiKey ? 'Active' : 'Not Generated'}
                      </Badge>
                    </div>
                    {!userForDetails.apiKey && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateAPIKey(userForDetails)}
                        disabled={generateAPIKeyMutation.isPending}
                      >
                        <Key className="w-3 h-3 mr-1" />
                        Generate API Key
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Account Timestamps */}
              <div>
                <h3 className="font-medium text-sm text-gray-900 mb-3">Account History</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Created:</span>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDateTime(userForDetails.createdAt)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Last Updated:</span>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {userForDetails.updatedAt ? formatDateTime(userForDetails.updatedAt) : 'Never'}
                    </div>
                  </div>
                </div>
              </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsUserDetailsOpen(false)}>
                      Close
                    </Button>
                    <Button onClick={() => {
                      setIsUserDetailsOpen(false);
                      handleEditUser(userForDetails);
                    }}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit User
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Audit Log Dialog */}
      <Dialog open={isAuditLogOpen} onOpenChange={setIsAuditLogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Audit Log - {auditUser?.username}
            </DialogTitle>
            <DialogDescription>
              Recent activity and system events for this user
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-3">
              {/* Audit log entries */}
              {[
                { action: 'Login', timestamp: new Date().toISOString(), ip: '192.168.1.100', details: 'Successful login from Chrome browser' },
                { action: 'Document Signed', timestamp: new Date(Date.now() - 3600000).toISOString(), ip: '192.168.1.100', details: 'Signed purchase agreement #4' },
                { action: 'Profile Updated', timestamp: new Date(Date.now() - 7200000).toISOString(), ip: '192.168.1.100', details: 'Updated email address' },
                { action: '2FA Enabled', timestamp: new Date(Date.now() - 86400000).toISOString(), ip: '192.168.1.100', details: 'Two-factor authentication activated' },
                { action: 'Password Changed', timestamp: new Date(Date.now() - 172800000).toISOString(), ip: '192.168.1.50', details: 'Password reset completed' }
              ].map((entry, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{entry.action}</span>
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDateTime(entry.timestamp)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{entry.details}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <Globe className="w-3 h-3" />
                      {entry.ip}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsAuditLogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Edit Dialog */}
      <Dialog open={isRoleEditOpen} onOpenChange={setIsRoleEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Change User Role
            </DialogTitle>
            <DialogDescription>
              Update the role for {roleEditUser?.username}. This will change their system permissions immediately.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const newRole = formData.get('newRole') as string;
            
            if (!newRole || !roleEditUser) {
              toast({
                variant: "destructive",
                title: "Error",
                description: "Please select a new role.",
              });
              return;
            }
            
            updateUserMutation.mutate({ 
              id: roleEditUser.id, 
              data: { role: newRole } 
            });
            setIsRoleEditOpen(false);
          }}>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Current Role</label>
                <div className="mt-1">
                  <Badge className={getRoleColor(roleEditUser?.role || '')}>
                    {formatRole(roleEditUser?.role || '')}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">New Role</label>
                <select 
                  name="newRole" 
                  defaultValue={roleEditUser?.role}
                  required
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="admin">Admin</option>
                  <option value="title_company">Title Company</option>
                  <option value="notary">Notary</option>
                  <option value="client">Client</option>
                </select>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <h4 className="font-medium text-sm mb-2">New permissions will include:</h4>
                <ul className="text-sm space-y-1">
                  {getRolePermissions(roleEditUser?.role || '', roleEditUser?.notaryType).map((permission, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      {permission}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsRoleEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? "Updating..." : "Update Role"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Certificate Management Dialog */}
      <Dialog open={isCertificateManagementOpen} onOpenChange={setIsCertificateManagementOpen}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Digital Certificate Management
            </DialogTitle>
            <DialogDescription>
              Manage digital certificates for notary users in the system
            </DialogDescription>
          </DialogHeader>
          <AdminCertificateManager 
            selectedUserIds={selectedUsers}
            onClose={() => setIsCertificateManagementOpen(false)}
          />
        </DialogContent>
      </Dialog>

    </MainLayout>
  );
}
