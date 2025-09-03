import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { UserForm } from '@/components/user/user-form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatDate } from '@/lib/utils';
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
  Award, 
  Shield, 
  Settings,
  Search,
  Filter,
  Eye,
  Edit,
  UserCheck,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Building,
  CheckCircle,
  XCircle,
  Clock,
  Hash,
  Plus,
  Trash2,
  UserX
} from 'lucide-react';
import { NotaryDocumentsModal } from './NotaryDocumentsModal';

interface NotaryData {
  id: number;
  fullName: string;
  email: string;
  role: string;
  notaryType: string;
  notaryIdCode?: string;
  isActive: boolean;
  approvalStatus: string;
  
  // Contact Information
  phoneNumber?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  
  // Commission Information
  nameOnCommission?: string;
  commissionNumber?: string;
  commissionExpiration?: string;
  commissionState?: string;
  commissionCounty?: string;
  commissionAddress1?: string;
  commissionAddress2?: string;
  commissionCity?: string;
  commissionZipCode?: string;
  
  // Qualifications
  isNotarySigningAgent?: boolean;
  notarySigningAgentExpiration?: string;
  isSpanishSpeaking?: boolean;
  foreignLanguages?: string[];
  maxConcurrentJobs?: number;
  
  // Insurance and Bond
  eoInsuranceCompany?: string;
  eoInsuranceAmount?: number;
  eoInsuranceExpiration?: string;
  bondCompanyName?: string;
  bondAmount?: number;
  bondExpiration?: string;
  
  // Document Files
  hasCommissionFile?: boolean;
  hasEOInsurance?: boolean;
  hasBond?: boolean;
  hasPublicCertificate?: boolean;
  hasSigningAgentFile?: boolean;
  
  // ID Verification
  idType?: string;
  idNumber?: string;
  idExpirationDate?: string;
  isVerified?: boolean;
  verificationStatus?: string;
  
  // Account Information
  accountBalance?: number;
  totalEarnings?: number;
  totalSpent?: number;
  
  // Timestamps
  createdAt: string;
  lastActivity?: string;
  approvedAt?: string;
  lastProfileUpdate?: string;
  
  // Performance
  assignedCompanies?: string[];
  completedJobs?: number;
}

export function AdminNotaries() {
  const [, setLocation] = useLocation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedNotary, setSelectedNotary] = useState<NotaryData | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modal states
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [docsNotaryId, setDocsNotaryId] = useState<number | null>(null);
  const [docsNotaryName, setDocsNotaryName] = useState<string>('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/users', refreshTrigger],
    queryFn: async () => {
      // Force fresh data with cache-busting headers
      const response = await fetch('/api/users?' + new URLSearchParams({
        _t: Date.now().toString() // Cache busting parameter
      }), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    },
    staleTime: 0, // Always refetch
    gcTime: 0, // Don't cache
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Filter only notaries
  const notaries = useMemo(() => {
    console.log('🔍 All users received:', users);
    const filteredNotaries = users.filter((user: any) => user.role === 'notary');
    console.log('👨‍⚖️ Filtered notaries:', filteredNotaries);
    return filteredNotaries;
  }, [users]);

  // Convert to NotaryData format for detailed view compatibility
  const allNotaries = useMemo(() => {
    return notaries.map((user: any) => ({
      id: user.id,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
      email: user.email,
      role: user.role,
      notaryType: user.notaryType || 'contractor',
      notaryIdCode: user.notaryIdCode,
      isActive: user.isActive !== false,
      approvalStatus: user.approvalStatus || 'approved',
      phoneNumber: user.phoneNumber,
      address1: user.address1,
      address2: user.address2,
      city: user.city,
      state: user.state,
      zipCode: user.zipCode,
      nameOnCommission: user.nameOnCommission,
      commissionNumber: user.commissionNumber,
      commissionExpiration: user.commissionExpiration,
      commissionState: user.commissionState || user.state,
      commissionCounty: user.commissionCounty || user.county,
      commissionAddress1: user.commissionAddress1,
      commissionAddress2: user.commissionAddress2,
      commissionCity: user.commissionCity,
      commissionZipCode: user.commissionZipCode,
      isNotarySigningAgent: user.isNotarySigningAgent,
      notarySigningAgentExpiration: user.notarySigningAgentExpiration,
      isSpanishSpeaking: user.isSpanishSpeaking,
      foreignLanguages: user.foreignLanguages || [],
      maxConcurrentJobs: user.maxConcurrentJobs,
      eoInsuranceCompany: user.eoInsuranceCompany,
      eoInsuranceAmount: user.eoInsuranceAmount,
      eoInsuranceExpiration: user.eoInsuranceExpiration,
      bondCompanyName: user.bondCompanyName,
      bondAmount: user.bondAmount,
      bondExpiration: user.bondExpiration,
      hasCommissionFile: user.hasCommissionFile,
      hasEOInsurance: user.hasEOInsurance,
      hasBond: user.hasBond,
      hasPublicCertificate: user.hasPublicCertificate,
      hasSigningAgentFile: user.hasSigningAgentFile,
      idType: user.idType,
      idNumber: user.idNumber,
      idExpirationDate: user.idExpirationDate,
      isVerified: user.isVerified,
      accountBalance: user.accountBalance,
      totalEarnings: user.totalEarnings,
      totalSpent: user.totalSpent,
      createdAt: user.createdAt,
      lastActivity: user.lastActivity,
      approvedAt: user.approvedAt,
      lastProfileUpdate: user.lastProfileUpdate,
      completedJobs: user.completedJobs || 0,
      assignedCompanies: user.assignedCompanies || []
    }));
  }, [notaries]);

  // Filtered notaries
  const filteredNotaries = useMemo(() => {
    let filtered = notaries.filter((notary: any) => {
      const matchesSearch = 
        notary.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notary.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${notary.firstName || ''} ${notary.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === 'all' || notary.notaryType === typeFilter;
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && notary.isActive !== false) ||
        (statusFilter === 'inactive' && notary.isActive === false);
      
      return matchesSearch && matchesType && matchesStatus;
    });

    return filtered.sort((a: any, b: any) => {
      const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.username;
      const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.username;
      return aName.localeCompare(bName);
    });
  }, [notaries, searchTerm, typeFilter, statusFilter]);

  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await apiRequest('POST', '/api/auth/register-user', userData);
      return response.json();
    },
    onSuccess: () => {
      // Force a complete cache refresh
      setRefreshTrigger(prev => prev + 1);
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.refetchQueries({ queryKey: ['/api/users'] });
      queryClient.removeQueries({ queryKey: ['/api/users'] });
      refetch();
      toast({
        title: "Success",
        description: "Notary created successfully.",
      });
      setIsFormOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      let title = "Error";
      let description = error.message || "Failed to create notary.";
      
      // Handle email security errors specifically - check both error code and message
      if (error.error === 'EMAIL_ALREADY_EXISTS' || 
          error.response?.error === 'EMAIL_ALREADY_EXISTS' ||
          error.message?.includes('EMAIL_ALREADY_EXISTS') || 
          error.message?.includes('already exists') ||
          error.message?.includes('already associated')) {
        title = "Email Already Registered";
        description = error.response?.message || error.message || "This email address is already associated with an account. Email addresses must be unique across all account types.";
        
        // Add helpful suggestion if available
        if (error.details?.suggestion || error.response?.details?.suggestion) {
          description += " " + (error.details?.suggestion || error.response?.details?.suggestion);
        }
      }
      
      console.log('Admin Notary Creation Error:', error); // Debug logging
      
      toast({
        variant: "destructive", 
        title,
        description,
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest('PUT', `/api/users/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      // Force a complete cache refresh
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.refetchQueries({ queryKey: ['/api/users'] });
      queryClient.removeQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "Notary updated successfully.",
      });
      setIsFormOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update notary.",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest('DELETE', `/api/users/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      // Force a complete cache refresh
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.refetchQueries({ queryKey: ['/api/users'] });
      queryClient.removeQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "Notary deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      setSelectedNotary(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete notary.",
      });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const response = await apiRequest('PUT', `/api/users/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      // Force a complete cache refresh
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.refetchQueries({ queryKey: ['/api/users'] });
      queryClient.removeQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "Notary status updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update notary status.",
      });
    },
  });

  const handleCreateNotary = () => {
    setSelectedUser(null);
    setIsFormOpen(true);
  };

  const handleEditNotary = (user: any) => {
    setSelectedUser(user);
    setIsFormOpen(true);
  };

  const handleDeleteNotary = (user: any) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleFormSubmit = (formData: any) => {
    // Set role and userType to notary and default notary type if not specified
    const userData = {
      ...formData,
      role: 'notary',
      userType: 'notary', // Required for the register-user endpoint
      notaryType: formData.notaryType || 'contractor',
      registrationSource: 'admin_create' // Explicitly mark as admin-created
    };

    if (selectedUser) {
      updateUserMutation.mutate({ id: selectedUser.id, data: userData });
    } else {
      createUserMutation.mutate(userData);
    }
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  const handleToggleStatus = (user: any) => {
    toggleUserStatusMutation.mutate({ 
      id: user.id, 
      isActive: user.isActive === false ? true : false 
    });
  };

  const handleOpenDocuments = (id: number, name: string) => {
    setDocsNotaryId(id);
    setDocsNotaryName(name);
    setDocumentsModalOpen(true);
  };

  const handleCloseDocuments = () => setDocumentsModalOpen(false);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'subscriber':
        return 'bg-blue-100 text-blue-800';
      case 'contractor':
        return 'bg-green-100 text-green-800';
      case 'both':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadge = (user: any) => {
    if (user.isActive === false) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        Inactive
      </Badge>;
    }
    return <Badge variant="default" className="flex items-center gap-1 bg-green-500">
      <CheckCircle className="w-3 h-3" />
      Active
    </Badge>;
  };

  const getStatusColor = (notary: NotaryData) => {
    if (notary.approvalStatus === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (!notary.isActive) return 'bg-red-100 text-red-800';
    if (notary.approvalStatus === 'approved') return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (notary: NotaryData) => {
    if (notary.approvalStatus === 'pending') return 'Pending';
    if (!notary.isActive) return 'Inactive';
    if (notary.approvalStatus === 'approved') return 'Active';
    return 'Unknown';
  };

  const handleViewDetails = (notary: any) => {
    // Convert notary to NotaryData format for detailed view
    const notaryData: NotaryData = allNotaries.find(n => n.id === notary.id) || {
      id: notary.id,
      fullName: `${notary.firstName || ''} ${notary.lastName || ''}`.trim() || notary.username,
      email: notary.email,
      role: notary.role,
      notaryType: notary.notaryType || 'contractor',
      notaryIdCode: notary.notaryIdCode,
      isActive: notary.isActive !== false,
      approvalStatus: notary.approvalStatus || 'approved',
      createdAt: notary.createdAt
    };
    setSelectedNotary(notaryData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notary Management</h1>
          <p className="text-muted-foreground">
            Manage notaries in your system. Subscribers can create jobs, contractors get assigned jobs only.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            setRefreshTrigger(prev => prev + 1);
            refetch();
          }}>
            <Search className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleCreateNotary}>
            <Plus className="h-4 w-4 mr-2" />
            Add Notary
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notary List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Notaries ({filteredNotaries.length})</CardTitle>
                
                <div className="flex gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search notaries..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full sm:w-64"
                    />
                  </div>
                  
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[140px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="subscriber">Subscriber</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
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
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="overflow-x-auto">
                {isLoading ? (
                  <div className="text-center py-8">Loading notaries...</div>
                ) : filteredNotaries.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {notaries.length === 0 ? 'No notaries found' : 'No notaries match your filters'}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Notary</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Commission</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredNotaries.map((notary: any) => (
                        <TableRow key={notary.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <div className="font-medium">
                                  {`${notary.firstName || ''} ${notary.lastName || ''}`.trim() || notary.username}
                                </div>
                                <div className="text-sm text-gray-500">@{notary.username}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getTypeColor(notary.notaryType || 'contractor')}>
                              {notary.notaryType === 'subscriber' ? 'Subscriber' : 
                               notary.notaryType === 'both' ? 'Both' : 'Contractor'}
                            </Badge>
                            <div className="text-xs text-gray-500 mt-1">
                              {notary.notaryType === 'subscriber' 
                                ? 'Can create jobs' 
                                : notary.notaryType === 'both'
                                ? 'Can create and get assigned jobs'
                                : 'Admin assigns jobs'
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm">{notary.email}</div>
                              {notary.phoneNumber && (
                                <div className="text-sm text-gray-500">{notary.phoneNumber}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {notary.commissionNumber && (
                                <div className="text-sm">#{notary.commissionNumber}</div>
                              )}
                              {notary.commissionExpiration && (
                                <div className="text-sm text-gray-500">
                                  Exp: {formatDate(notary.commissionExpiration)}
                                </div>
                              )}
                              {notary.state && (
                                <div className="text-sm text-gray-500">{notary.state}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(notary)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-gray-500">
                              {formatDate(notary.createdAt)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDetails(notary)}
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditNotary(notary)}
                                title="Edit notary"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(notary)}
                                title={notary.isActive === false ? 'Activate notary' : 'Deactivate notary'}
                                className={notary.isActive === false ? 'text-blue-600' : 'text-red-600'}
                              >
                                {notary.isActive === false ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteNotary(notary)}
                                className="text-red-600 hover:text-red-700"
                                title="Delete notary"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notary Details Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notary Details</CardTitle>
              <CardDescription>
                {selectedNotary ? `Details for ${selectedNotary.fullName}` : 'Select a notary to view details'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedNotary ? (
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <Award className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{selectedNotary.fullName}</h3>
                        <p className="text-sm text-gray-600">{selectedNotary.email}</p>
                      </div>
                    </div>

                    {/* ID Code and Status */}
                    <div className="grid grid-cols-1 gap-3">
                      {selectedNotary.notaryIdCode && (
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">ID Code:</span>
                          <Badge variant="outline" className="font-mono text-blue-600 bg-blue-50">
                            {selectedNotary.notaryIdCode}
                          </Badge>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">Type:</span>
                        <Badge 
                          variant="secondary" 
                          className={getTypeColor(selectedNotary.notaryType)}
                        >
                          {selectedNotary.notaryType}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">Status:</span>
                        <Badge 
                          variant="secondary" 
                          className={getStatusColor(selectedNotary)}
                        >
                          {getStatusText(selectedNotary)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Contact Information
                    </h4>
                    <div className="space-y-2 text-sm">
                      {selectedNotary.phoneNumber && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-gray-400" />
                          <span>{selectedNotary.phoneNumber}</span>
                        </div>
                      )}
                      {(selectedNotary.address1 || selectedNotary.city || selectedNotary.state) && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span>
                            {[selectedNotary.address1, selectedNotary.city, selectedNotary.state, selectedNotary.zipCode]
                              .filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Commission Information */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Commission Details
                    </h4>
                    <div className="space-y-2 text-sm">
                      {selectedNotary.nameOnCommission && (
                        <div><strong>Name:</strong> {selectedNotary.nameOnCommission}</div>
                      )}
                      {selectedNotary.commissionNumber && (
                        <div><strong>Number:</strong> {selectedNotary.commissionNumber}</div>
                      )}
                      {selectedNotary.commissionExpiration && (
                        <div><strong>Expires:</strong> {new Date(selectedNotary.commissionExpiration).toLocaleDateString()}</div>
                      )}
                      {selectedNotary.commissionState && (
                        <div><strong>State:</strong> {selectedNotary.commissionState}</div>
                      )}
                      {selectedNotary.commissionCounty && (
                        <div><strong>County:</strong> {selectedNotary.commissionCounty}</div>
                      )}
                    </div>
                  </div>

                  {/* Qualifications */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Qualifications
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        {selectedNotary.isNotarySigningAgent ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span>Notary Signing Agent (NSA)</span>
                        {selectedNotary.notarySigningAgentExpiration && (
                          <span className="text-xs text-gray-500">
                            (Expires: {new Date(selectedNotary.notarySigningAgentExpiration).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedNotary.isSpanishSpeaking ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span>Spanish Speaking</span>
                      </div>
                      {selectedNotary.foreignLanguages && selectedNotary.foreignLanguages.length > 0 && (
                        <div>
                          <strong>Languages:</strong> {selectedNotary.foreignLanguages.join(', ')}
                        </div>
                      )}
                      {selectedNotary.maxConcurrentJobs && (
                        <div>
                          <strong>Max Concurrent Jobs:</strong> {selectedNotary.maxConcurrentJobs}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Document Status */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Required Documents
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'hasCommissionFile', label: 'Commission' },
                        { key: 'hasEOInsurance', label: 'E&O Insurance' },
                        { key: 'hasBond', label: 'Bond' },
                        { key: 'hasPublicCertificate', label: 'Certificate' },
                        { key: 'hasSigningAgentFile', label: 'NSA Certificate' }
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-2">
                          {selectedNotary[key as keyof NotaryData] ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-xs text-gray-600">{label}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => handleOpenDocuments(selectedNotary.id, selectedNotary.fullName)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Documents
                    </Button>
                  </div>

                  {/* Timestamps */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Activity
                    </h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div><strong>Created:</strong> {new Date(selectedNotary.createdAt).toLocaleDateString()}</div>
                      {selectedNotary.lastActivity && (
                        <div><strong>Last Active:</strong> {new Date(selectedNotary.lastActivity).toLocaleDateString()}</div>
                      )}
                      {selectedNotary.approvedAt && (
                        <div><strong>Approved:</strong> {new Date(selectedNotary.approvedAt).toLocaleDateString()}</div>
                      )}
                      {selectedNotary.lastProfileUpdate && (
                        <div><strong>Profile Updated:</strong> {new Date(selectedNotary.lastProfileUpdate).toLocaleDateString()}</div>
                      )}
                    </div>
                  </div>

                  {/* Performance Stats */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Performance:</h4>
                    <div className="text-sm text-gray-600">
                      <p>Completed Jobs: {selectedNotary.completedJobs || 0}</p>
                      {selectedNotary.assignedCompanies && (
                        <p>Assigned Companies: {selectedNotary.assignedCompanies.length}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Award className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Select a notary to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* User Form Modal */}
      <UserForm
        user={selectedUser}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedUser(null);
        }}
        onSubmit={handleFormSubmit}
        isLoading={createUserMutation.isPending || updateUserMutation.isPending}
        defaultRole="notary"
      />

      {/* Documents Modal */}
      {docsNotaryId && (
        <NotaryDocumentsModal
          isOpen={documentsModalOpen}
          onClose={handleCloseDocuments}
          notaryId={docsNotaryId}
          notaryName={docsNotaryName}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notary</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete notary "{userToDelete?.username}"? 
              This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}