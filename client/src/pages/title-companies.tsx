import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { CompanyForm } from '@/components/company/company-form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Building,
  MapPin,
  Mail,
  Phone,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  RefreshCw,
  Copy,
  Eye,
  Download,
  FileText,
  Users,
  UserCheck
} from 'lucide-react';
import { type Company as BaseCompany } from '@shared/types';
type UICompany = BaseCompany & {
  companyName?: string;
  primaryUserName?: string;
  email?: string;
  phoneNumber?: string;
  paymentMethod?: string;
};
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TitleCompanyNotaryAssignments } from '@/components/admin/title-company-notary-assignments';

export default function TitleCompanies() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<UICompany | null>(null);
  const [isAssignmentsOpen, setIsAssignmentsOpen] = useState(false);
  const [assignCompany, setAssignCompany] = useState<UICompany | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<UICompany | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [companyToApprove, setCompanyToApprove] = useState<UICompany | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [companyToView, setCompanyToView] = useState<UICompany | null>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [companyToReject, setCompanyToReject] = useState<UICompany | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Open the create form directly when arriving with ?action=add
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if ((params.get('action') || '').toLowerCase() === 'add') {
        setIsFormOpen(true);
      }
    } catch {}
  }, []);

  const { data: companies = [], isLoading } = useQuery<UICompany[]>({
    queryKey: ['/api/companies'],
    staleTime: 0, // Always refetch
    gcTime: 0, // Don't cache
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Enhanced filtering and sorting
  const filteredAndSortedCompanies = useMemo(() => {
    if (!Array.isArray(companies)) return [];
    
    let filtered = companies.filter((company) => {
      const matchesSearch = searchTerm === '' || 
        company.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.primaryUserName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.state?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || company.status === statusFilter;
      const matchesPayment = paymentFilter === 'all' || company.paymentMethod === paymentFilter;
      
      return matchesSearch && matchesStatus && matchesPayment;
    });

    // Sort companies
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.companyName?.toLowerCase() || '';
          bValue = b.companyName?.toLowerCase() || '';
          break;
        case 'contact':
          aValue = a.contactName?.toLowerCase() || '';
          bValue = b.contactName?.toLowerCase() || '';
          break;
        case 'location':
          aValue = `${a.city}, ${a.state}`.toLowerCase();
          bValue = `${b.city}, ${b.state}`.toLowerCase();
          break;
        case 'status':
          aValue = a.status?.toLowerCase() || '';
          bValue = b.status?.toLowerCase() || '';
          break;
        case 'created':
          aValue = new Date(a.createdAt || 0).getTime();
          bValue = new Date(b.createdAt || 0).getTime();
          break;
        default:
          aValue = a.companyName?.toLowerCase() || '';
          bValue = b.companyName?.toLowerCase() || '';
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [companies, searchTerm, statusFilter, paymentFilter, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedCompanies.length / itemsPerPage);
  const paginatedCompanies = filteredAndSortedCompanies.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const createCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/companies', data);
      return response.json();
    },
    onSuccess: () => {
      // Force a complete cache refresh
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      queryClient.refetchQueries({ queryKey: ['/api/companies'] });
      // Also clear the browser cache by adding a timestamp
      queryClient.removeQueries({ queryKey: ['/api/companies'] });
      toast({
        title: "Success",
        description: "Title company created successfully.",
      });
      setIsFormOpen(false);
      setSelectedCompany(null);
    },
    onError: (error: any) => {
      let title = "Error";
      let description = error.message || "Failed to create title company.";
      
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
      
      console.log('Company Creation Error:', error); // Debug logging
      
      toast({
        variant: "destructive",
        title,
        description,
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest('PATCH', `/api/companies/${id}/quick-update`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({
        title: "Success",
        description: "Title company updated successfully.",
      });
      setIsFormOpen(false);
      setSelectedCompany(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update title company.",
      });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log('🗑️ Attempting to delete company with ID:', id);
      try {
        const response = await apiRequest('DELETE', `/api/companies/${id}`);
        console.log('✅ Delete response status:', response.status);
        const result = await response.json();
        console.log('✅ Delete response data:', result);
        return result;
      } catch (error) {
        console.error('❌ Delete request failed:', error);
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      console.log('🎉 Delete mutation successful for company ID:', variables);
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({
        title: "Success",
        description: "Title company deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      setCompanyToDelete(null);
    },
    onError: (error: any, variables) => {
      console.error('❌ Delete mutation failed for company ID:', variables, 'Error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete title company.",
      });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ companyIds, action, value }: { companyIds: number[]; action: string; value?: string }) => {
      const promises = companyIds.map(id => {
        switch (action) {
          case 'status':
            return apiRequest('PATCH', `/api/companies/${id}/quick-update`, { status: value });
          case 'delete':
            return apiRequest('DELETE', `/api/companies/${id}`);
          default:
            return Promise.resolve();
        }
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({
        title: "Success",
        description: `Bulk action completed for ${selectedCompanies.length} companies.`,
      });
      setSelectedCompanies([]);
      setIsBulkActionOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to complete bulk action.",
      });
    },
  });

  const handleAddCompany = () => {
    setSelectedCompany(null);
    setIsFormOpen(true);
  };

  const handleEditCompany = (company: UICompany) => {
    setSelectedCompany(company);
    setIsFormOpen(true);
  };

  const handleDeleteCompany = (company: UICompany) => {
    console.log('🎯 handleDeleteCompany called with company:', company);
    setCompanyToDelete(company);
    setIsDeleteDialogOpen(true);
    console.log('🎯 Dialog state set, isDeleteDialogOpen should be true');
  };

  const handleManageAssignments = (company: UICompany) => {
    setAssignCompany(company);
    setIsAssignmentsOpen(true);
  };

  const handleViewDetails = (company: UICompany) => {
    setCompanyToView(company);
    setIsDetailsDialogOpen(true);
  };

  const handleFormSubmit = (data: any) => {
    if (selectedCompany) {
      updateCompanyMutation.mutate({ id: selectedCompany.id, data });
    } else {
      createCompanyMutation.mutate(data);
    }
  };

  const confirmDelete = () => {
    console.log('🔄 confirmDelete called, companyToDelete:', companyToDelete);
    if (companyToDelete) {
      console.log('🗑️ Calling deleteCompanyMutation.mutate with ID:', companyToDelete.id);
      deleteCompanyMutation.mutate(companyToDelete.id);
    } else {
      console.error('❌ No company to delete found');
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleSelectCompany = (companyId: number, checked: boolean) => {
    if (checked) {
      setSelectedCompanies([...selectedCompanies, companyId]);
    } else {
      setSelectedCompanies(selectedCompanies.filter(id => id !== companyId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCompanies(paginatedCompanies.map(company => company.id));
    } else {
      setSelectedCompanies([]);
    }
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortOrder === 'asc' ? 
      <ArrowUp className="w-4 h-4" /> : 
      <ArrowDown className="w-4 h-4" />;
  };

  const getStatusBadge = (status: string) => {
    const config = {
      active: { variant: 'default' as const, icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
      inactive: { variant: 'secondary' as const, icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-50' },
      suspended: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
      pending: { variant: 'secondary' as const, icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
      approved: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
      rejected: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    };

    const { variant, icon: Icon, color, bg } = config[status as keyof typeof config] || config.active;

    return (
      <Badge variant={variant} className={`flex items-center gap-1 ${bg} ${color} font-semibold`}>
        <Icon className={`w-3 h-3 ${color}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Calculate pending companies count
  const pendingCount = useMemo(() => {
    return companies?.filter(c => c.status === 'pending').length || 0;
  }, [companies]);

  const getCompanyCompletion = (company: UICompany): number => {
    let completion = 0;
    if (company.companyName) completion += 20;
    if (company.contactName) completion += 20;
    if (company.email) completion += 20;
    if (company.address1 && company.city && company.state) completion += 20;
    if (company.paymentMethod) completion += 20;
    return completion;
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleBulkAction = () => {
    if (selectedCompanies.length > 0 && bulkAction) {
      if (bulkAction === 'delete') {
        setIsBulkActionOpen(true);
      } else {
        bulkUpdateMutation.mutate({ 
          companyIds: selectedCompanies, 
          action: bulkAction.split('-')[0], 
          value: bulkAction.split('-')[1] 
        });
      }
    }
  };

  const confirmBulkAction = () => {
    bulkUpdateMutation.mutate({ 
      companyIds: selectedCompanies, 
      action: bulkAction 
    });
  };

  return (
    <MainLayout>
      <TooltipProvider>
        {/* Pending Approvals Alert Banner */}
        {pendingCount > 0 && (
          <div className="mb-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 rounded-r-lg shadow-md">
            <div className="p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-6 w-6 text-yellow-600 animate-pulse" />
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-bold text-yellow-800">
                    {pendingCount} {pendingCount === 1 ? 'Company' : 'Companies'} Awaiting Approval
                  </h3>
                  <p className="mt-1 text-sm text-yellow-700">
                    Review and take action on pending company registrations. Click the filters below to view only pending companies.
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-yellow-300 hover:bg-yellow-100 text-yellow-800"
                    onClick={() => setStatusFilter('pending')}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Pending
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
          <CardHeader className="pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg">
                    <Building className="h-6 w-6 text-white" />
                  </div>
                  Title Company Management
                </CardTitle>
                <p className="text-gray-600 mt-2">
                  Manage title companies and their information
                </p>
              </div>
              <div className="flex gap-2 mt-4 sm:mt-0">
                {selectedCompanies.length > 0 && (
                  <>
                    <Select value={bulkAction} onValueChange={setBulkAction}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Bulk Action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="status-active">Mark Active</SelectItem>
                        <SelectItem value="status-inactive">Mark Inactive</SelectItem>
                        <SelectItem value="status-suspended">Suspend</SelectItem>
                        <SelectItem value="delete">Delete Companies</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={handleBulkAction}
                      disabled={!bulkAction || bulkUpdateMutation.isPending}
                      size="sm"
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      Apply ({selectedCompanies.length})
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => window.location.reload()} size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button onClick={handleAddCompany} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Company
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Enhanced Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by company name, contact, email, or location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Status ({companies?.length || 0})
                    </SelectItem>
                    <SelectItem value="pending">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-3 w-3 text-yellow-600" />
                        Pending {pendingCount > 0 && `(${pendingCount})`}
                      </div>
                    </SelectItem>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-blue-600" />
                        Active
                      </div>
                    </SelectItem>
                    <SelectItem value="inactive">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-3 w-3 text-gray-600" />
                        Inactive
                      </div>
                    </SelectItem>
                    <SelectItem value="suspended">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-3 w-3 text-red-600" />
                        Suspended
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payment</SelectItem>
                    <SelectItem value="invoiced">Invoiced</SelectItem>
                    <SelectItem value="qualia">Qualia</SelectItem>
                    <SelectItem value="pre_pay">Pre-Pay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results Summary */}
            <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
              <span>
                Showing {paginatedCompanies.length} of {filteredAndSortedCompanies.length} companies
                {searchTerm && ` matching "${searchTerm}"`}
              </span>
              <span>Total: {Array.isArray(companies) ? companies.length : 0} companies</span>
            </div>

            {/* Enhanced Companies Table */}
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center gap-2 text-gray-600">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Loading companies...
                  </div>
                </div>
              ) : filteredAndSortedCompanies.length === 0 ? (
                <div className="text-center py-12">
                  <Building className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg mb-2">
                    {searchTerm ? `No companies found matching "${searchTerm}"` : "No companies found"}
                  </p>
                  {!searchTerm && (
                    <Button onClick={handleAddCompany} variant="outline" className="mt-2">
                      <Plus className="h-4 w-4 mr-2" />
                      Add your first company
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedCompanies.length === paginatedCompanies.length && paginatedCompanies.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('name')}
                          className="h-8 px-2 font-medium"
                        >
                          Company Details
                          {getSortIcon('name')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('contact')}
                          className="h-8 px-2 font-medium"
                        >
                          Contact Information
                          {getSortIcon('contact')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('location')}
                          className="h-8 px-2 font-medium"
                        >
                          Location & Payment
                          {getSortIcon('location')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('status')}
                          className="h-8 px-2 font-medium"
                        >
                          Status & Progress
                          {getSortIcon('status')}
                        </Button>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCompanies.map((company) => (
                      <TableRow 
                        key={company.id} 
                        className={`hover:bg-muted/50 transition-colors ${
                          company.status === 'pending' 
                            ? 'bg-yellow-50/50 border-l-4 border-l-yellow-400' 
                            : ''
                        }`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedCompanies.includes(company.id)}
                            onCheckedChange={(checked) => handleSelectCompany(company.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                                <Building className="h-5 w-5" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-gray-900">
                                {company.companyName}
                              </div>
                              <div className="text-sm text-gray-600 flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {company.primaryUserName || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{company.contactName}</div>
                            <div className="text-sm text-gray-600 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {company.email}
                            </div>
                            {company.phoneNumber && (
                              <div className="text-sm text-gray-500 flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {company.phoneNumber}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {company.city}, {company.state}
                            </div>
                            <div className="flex items-center gap-1">
                              <CreditCard className="h-3 w-3" />
                              <Badge variant="outline" className="text-xs">
                                {company.paymentMethod?.replace('_', '-') || 'N/A'}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            {getStatusBadge(company.status)}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs text-gray-600">
                                <span>Profile</span>
                                <span>{getCompanyCompletion(company)}%</span>
                              </div>
                              <Progress value={getCompanyCompletion(company)} className="h-1" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {company.status === 'pending' ? (
                            <div className="flex items-center gap-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700 text-white shadow-md"
                                      onClick={() => {
                                        setCompanyToApprove(company);
                                        setIsApproveDialogOpen(true);
                                      }}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Approve
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Approve this company and grant access</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="shadow-md"
                                      onClick={() => {
                                        setCompanyToReject(company);
                                        setIsRejectDialogOpen(true);
                                      }}
                                    >
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Reject
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Reject this company registration</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditCompany(company)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteCompany(company)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Company
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetails(company)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleEditCompany(company)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Company
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleManageAssignments(company)}>
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Manage Assignments
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(company.companyName ?? '')}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy Name
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(company.email ?? '')}>
                                  <Mail className="h-4 w-4 mr-2" />
                                  Copy Email
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteCompany(company)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Company
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Enhanced Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages} • {filteredAndSortedCompanies.length} total results
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

        <CompanyForm
          company={selectedCompany}
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setSelectedCompany(null);
          }}
          onSubmit={handleFormSubmit}
          isLoading={createCompanyMutation.isPending || updateCompanyMutation.isPending}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-600" />
                Delete Company?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the title company
                "{companyToDelete?.companyName}" and all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Company
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Approve Confirmation Dialog */}
        <AlertDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Approve Company Registration?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to approve "{companyToApprove?.companyName}"? 
                This will grant them access to the platform and allow them to create jobs.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCompanyToApprove(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (companyToApprove) {
                    updateCompanyMutation.mutate({ 
                      id: companyToApprove.id, 
                      data: { status: 'approved' } 
                    });
                    setIsApproveDialogOpen(false);
                    setCompanyToApprove(null);
                  }
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                Approve Company
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reject Confirmation Dialog */}
        <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                Reject Company Registration?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to reject "{companyToReject?.companyName}"? 
                They will be notified of this decision and will not be granted platform access.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCompanyToReject(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (companyToReject) {
                    updateCompanyMutation.mutate({ 
                      id: companyToReject.id, 
                      data: { status: 'rejected' } 
                    });
                    setIsRejectDialogOpen(false);
                    setCompanyToReject(null);
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Reject Company
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Action Confirmation Dialog */}
        <AlertDialog open={isBulkActionOpen} onOpenChange={setIsBulkActionOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-600" />
                Confirm Bulk Action
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCompanies.length} selected companies? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmBulkAction}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Companies
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
      {/* Assignments Dialog */}
      <Dialog open={isAssignmentsOpen} onOpenChange={setIsAssignmentsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader onClose={() => setIsAssignmentsOpen(false)}>
            <DialogTitle>Manage Notary Assignments</DialogTitle>
            <DialogDescription>
              Assign or update preferred notaries for {assignCompany?.companyName ?? ''}.
            </DialogDescription>
          </DialogHeader>
          {assignCompany && (
            <div className="mt-2">
              <TitleCompanyNotaryAssignments embedded company={{ id: assignCompany.id, companyName: assignCompany.companyName ?? '' }} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Company Details
            </DialogTitle>
            <DialogDescription>
              Complete information for {companyToView?.companyName}
            </DialogDescription>
          </DialogHeader>
          
          {companyToView && (
            <div className="space-y-6">
              {/* Status Badge */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Status:</span>
                  <Badge variant={companyToView.status === 'active' ? 'default' : 'secondary'}>
                    {companyToView.status === 'pending' && '⏱️ Pending Approval'}
                    {companyToView.status === 'active' && '✓ Active'}
                    {companyToView.status === 'inactive' && 'Inactive'}
                    {companyToView.status === 'rejected' && '✗ Rejected'}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsDetailsDialogOpen(false);
                      handleEditCompany(companyToView);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>
              
              {/* Company Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Company Information
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-500">Company Name</span>
                      <p className="text-sm mt-1">{companyToView.companyName || 'N/A'}</p>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium text-gray-500">Company Type</span>
                      <p className="text-sm mt-1">{companyToView.companyType || 'N/A'}</p>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium text-gray-500">Payment Method</span>
                      <p className="text-sm mt-1 flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        {companyToView.paymentMethod || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Primary Contact
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-500">Contact Name</span>
                      <p className="text-sm mt-1">{companyToView.primaryUserName || companyToView.contactName || 'N/A'}</p>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium text-gray-500">Email</span>
                      <p className="text-sm mt-1 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {companyToView.primaryUserEmail || companyToView.email || 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium text-gray-500">Phone</span>
                      <p className="text-sm mt-1 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {companyToView.primaryUserPhone || companyToView.phoneNumber || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Address Information */}
              {(companyToView.address1 || companyToView.city || companyToView.state) && (
                <>
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
                      <MapPin className="h-5 w-5" />
                      Address
                    </h3>
                    
                    <div className="text-sm space-y-1">
                      {companyToView.address1 && <p>{companyToView.address1}</p>}
                      {companyToView.address2 && <p>{companyToView.address2}</p>}
                      {(companyToView.city || companyToView.state || companyToView.zipCode) && (
                        <p>
                          {companyToView.city}
                          {companyToView.city && companyToView.state && ', '}
                          {companyToView.state} {companyToView.zipCode}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
              
              {/* Additional Details */}
              <div className="border-t pt-4 grid grid-cols-2 gap-4 text-sm text-gray-500">
                <div>
                  <span className="font-medium">Created:</span>{' '}
                  {companyToView.createdAt ? new Date(companyToView.createdAt).toLocaleDateString() : 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Last Updated:</span>{' '}
                  {companyToView.updatedAt ? new Date(companyToView.updatedAt).toLocaleDateString() : 'N/A'}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
