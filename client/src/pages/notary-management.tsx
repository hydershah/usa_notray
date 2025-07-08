import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { UserForm } from '@/components/user/user-form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatDate } from '@/lib/utils';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  User,
  CheckCircle,
  XCircle,
  UserCheck,
  UserX
} from 'lucide-react';

export default function NotaryManagement() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
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
      const response = await apiRequest('POST', '/api/auth/register', userData);
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
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create notary.",
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
    // Set role to notary and default notary type if not specified
    const userData = {
      ...formData,
      role: 'notary',
      notaryType: formData.notaryType || 'contractor'
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'subscriber':
        return 'bg-blue-100 text-blue-800';
      case 'contractor':
        return 'bg-green-100 text-green-800';
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

  return (
    <MainLayout>
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
                            {notary.notaryType === 'subscriber' ? 'Subscriber' : 'Contractor'}
                          </Badge>
                          <div className="text-xs text-gray-500 mt-1">
                            {notary.notaryType === 'subscriber' 
                              ? 'Can create jobs' 
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
                              className={notary.isActive === false ? 'text-green-600' : 'text-red-600'}
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
    </MainLayout>
  );
} 