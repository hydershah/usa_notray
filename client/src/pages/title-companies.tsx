import { useState, useMemo } from 'react';
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
  Users
} from 'lucide-react';
import { type Company } from '@shared/types';

export default function TitleCompanies() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
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

  const { data: companies = [], isLoading } = useQuery<Company[]>({
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
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create title company.",
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
      const response = await apiRequest('DELETE', `/api/companies/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({
        title: "Success",
        description: "Title company deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      setCompanyToDelete(null);
    },
    onError: (error: any) => {
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

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company);
    setIsFormOpen(true);
  };

  const handleDeleteCompany = (company: Company) => {
    setCompanyToDelete(company);
    setIsDeleteDialogOpen(true);
  };

  const handleFormSubmit = (data: any) => {
    if (selectedCompany) {
      updateCompanyMutation.mutate({ id: selectedCompany.id, data });
    } else {
      createCompanyMutation.mutate(data);
    }
  };

  const confirmDelete = () => {
    if (companyToDelete) {
      deleteCompanyMutation.mutate(companyToDelete.id);
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
      active: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
      inactive: { variant: 'secondary' as const, icon: XCircle, color: 'text-gray-600' },
      suspended: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
      pending: { variant: 'secondary' as const, icon: AlertCircle, color: 'text-yellow-600' },
    };

    const { variant, icon: Icon, color } = config[status as keyof typeof config] || config.active;

    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className={`w-3 h-3 ${color}`} />
        {status}
      </Badge>
    );
  };

  const getCompanyCompletion = (company: Company): number => {
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
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
          <CardHeader className="pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 bg-blue-500 rounded-lg shadow-lg">
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
                <Button onClick={handleAddCompany} className="bg-blue-600 hover:bg-blue-700">
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
                  <SelectTrigger className="w-[120px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
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
                      <TableRow key={company.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell>
                          <Checkbox
                            checked={selectedCompanies.includes(company.id)}
                            onCheckedChange={(checked) => handleSelectCompany(company.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-blue-500 text-white">
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditCompany(company)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Company
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(company.companyName)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Copy Name
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(company.email)}>
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

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-600" />
                Are you sure?
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
    </MainLayout>
  );
}
