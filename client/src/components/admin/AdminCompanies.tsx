import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  Settings,
  Search,
  Filter,
  Eye,
  Edit,
  Plus,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Award,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  Activity,
  DollarSign,
  TrendingUp,
  ArrowUpDown,
  Download,
  Upload,
  Trash2,
  Archive,
  Star,
  AlertTriangle,
  BarChart3,
  PieChart,
  Zap,
  Shield
} from 'lucide-react';

interface CompanyData {
  id: number;
  companyName: string;
  contactEmail: string;
  contactName?: string;
  phoneNumber?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  licenseNumber?: string;
  status: string;
  paymentMethod?: string;
  createdAt: string;
  lastActivity?: string;
  assignedNotaries?: number;
  completedJobs?: number;
  totalSpent?: number;
  averageJobValue?: number;
  preferredNotaryId?: number;
  subscriptionPlan?: string;
  nextBillingDate?: string;
}

type SortField = keyof CompanyData;
type SortDirection = 'asc' | 'desc';

interface CompanyStats {
  totalCompanies: number;
  activeCompanies: number;
  totalRevenue: number;
  avgJobsPerCompany: number;
  topPerformingCompany: string;
  recentSignups: number;
}

export function AdminCompanies() {
  const [, setLocation] = useLocation();
  const [allCompanies, setAllCompanies] = useState<CompanyData[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyData | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('companyName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    // Initialize from URL query if provided (e.g., ?status=pending)
    try {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      if (status) {
        setStatusFilter(status);
      }
    } catch {}

    fetchCompaniesData();
    fetchStats();
  }, []);

  const fetchCompaniesData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/companies', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch companies');
      }
      
      const companies = await response.json();
      const mapped = (Array.isArray(companies) ? companies : []).map((c: any) => ({
        id: c.id,
        companyName: c.companyName ?? c.name ?? '',
        contactEmail: c.contactEmail ?? c.email ?? c.primaryUserEmail ?? '',
        contactName: c.contactName ?? c.primaryUserName ?? '',
        phoneNumber: c.phoneNumber ?? c.primaryUserPhone ?? '',
        address1: c.address1,
        address2: c.address2,
        city: c.city,
        state: c.state,
        zipCode: c.zipCode,
        licenseNumber: c.licenseNumber,
        status: c.status ?? 'active',
        paymentMethod: c.paymentMethod,
        createdAt: c.createdAt ?? new Date().toISOString(),
        lastActivity: c.updatedAt,
        assignedNotaries: c.assignedNotaries,
        completedJobs: c.completedJobs,
        totalSpent: c.totalSpent,
        averageJobValue: c.averageJobValue,
        preferredNotaryId: c.preferredNotaryId,
        subscriptionPlan: c.subscriptionPlan,
        nextBillingDate: c.nextBillingDate,
      }));
      setAllCompanies(mapped);
    } catch (error) {
      console.error('Error fetching companies data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Mock stats for now - replace with actual API call
      setStats({
        totalCompanies: allCompanies.length,
        activeCompanies: allCompanies.filter(c => c.status === 'active').length,
        totalRevenue: 127350,
        avgJobsPerCompany: 12.4,
        topPerformingCompany: 'Premier Title Group',
        recentSignups: 3
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const filteredAndSortedCompanies = useMemo(() => {
    let filtered = allCompanies.filter(company => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (company.companyName?.toLowerCase().includes(term) ?? false) ||
        (company.contactEmail?.toLowerCase().includes(term) ?? false) ||
        (company.contactName?.toLowerCase().includes(term) ?? false) ||
        (company.city?.toLowerCase().includes(term) ?? false) ||
        (company.state?.toLowerCase().includes(term) ?? false);
      
      const matchesStatus = statusFilter === 'all' || company.status === statusFilter;
      const matchesPayment = paymentFilter === 'all' || company.paymentMethod === paymentFilter;
      
      return matchesSearch && matchesStatus && matchesPayment;
    });

    // Sort companies
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;
      
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [allCompanies, searchTerm, statusFilter, paymentFilter, sortField, sortDirection]);

  const paginatedCompanies = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedCompanies.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedCompanies, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedCompanies.length / itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
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
      setSelectedCompanies(paginatedCompanies.map(c => c.id));
    } else {
      setSelectedCompanies([]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'suspended':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-3 w-3" />;
      case 'inactive':
        return <XCircle className="h-3 w-3" />;
      case 'pending':
        return <Clock className="h-3 w-3" />;
      case 'suspended':
        return <AlertTriangle className="h-3 w-3" />;
      default:
        return <XCircle className="h-3 w-3" />;
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'invoiced':
        return 'bg-blue-100 text-blue-800';
      case 'qualia':
        return 'bg-purple-100 text-purple-800';
      case 'pre_pay':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-in fade-in-50 duration-500">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="h-8 w-8 text-blue-600" />
            Company Management
          </h1>
          <p className="text-gray-600 mt-2">
            Manage title companies, track performance, and oversee operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline"
            onClick={() => window.print()}
            className="hidden lg:flex"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button 
            onClick={() => setLocation('/title-companies')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Companies</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalCompanies}</p>
                  <p className="text-xs text-blue-600 mt-1">
                    +{stats.recentSignups} this month
                  </p>
                </div>
                <Building2 className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Active Companies</p>
                  <p className="text-2xl font-bold text-green-900">{stats.activeCompanies}</p>
                  <p className="text-xs text-green-600 mt-1">
                    {((stats.activeCompanies / stats.totalCompanies) * 100).toFixed(1)}% active rate
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-purple-900">
                    ${stats.totalRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    <TrendingUp className="h-3 w-3 inline mr-1" />
                    +12.5% this quarter
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Avg Jobs/Company</p>
                  <p className="text-2xl font-bold text-orange-900">{stats.avgJobsPerCompany}</p>
                  <p className="text-xs text-orange-600 mt-1">
                    <Activity className="h-3 w-3 inline mr-1" />
                    Performance metric
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search companies by name, email, contact, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment Methods</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
                <SelectItem value="qualia">Qualia</SelectItem>
                <SelectItem value="pre_pay">Pre-pay</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedCompanies.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-900">
                  {selectedCompanies.length} companies selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Companies</CardTitle>
              <CardDescription>
                Showing {paginatedCompanies.length} of {filteredAndSortedCompanies.length} companies
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <Building2 className="h-3 w-3 mr-1" />
                {filteredAndSortedCompanies.length} companies
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        paginatedCompanies.length > 0 &&
                        paginatedCompanies.every(company => selectedCompanies.includes(company.id))
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort('companyName')}
                      className="h-auto p-0 font-semibold"
                    >
                      Company
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Contact Information</TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort('status')}
                      className="h-auto p-0 font-semibold"
                    >
                      Status
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Performance</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 text-lg">No companies found</p>
                      <p className="text-gray-400 text-sm">
                        Try adjusting your search or filter criteria
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCompanies.map((company) => (
                    <TableRow 
                      key={company.id} 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedCompany(company)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedCompanies.includes(company.id)}
                          onCheckedChange={(checked) => 
                            handleSelectCompany(company.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Building2 className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{company.companyName}</p>
                            <p className="text-sm text-gray-500">
                              {company.city && company.state && `${company.city}, ${company.state}`}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900">{company.contactName}</p>
                          <p className="text-sm text-gray-500">{company.contactEmail}</p>
                          {company.phoneNumber && (
                            <p className="text-sm text-gray-500">{company.phoneNumber}</p>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge className={`${getStatusColor(company.status)} flex items-center gap-1 w-fit`}>
                          {getStatusIcon(company.status)}
                          {company.status.charAt(0).toUpperCase() + company.status.slice(1)}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        {company.paymentMethod && (
                          <Badge 
                            variant="outline" 
                            className={getPaymentMethodColor(company.paymentMethod)}
                          >
                            {company.paymentMethod.replace('_', ' ').toUpperCase()}
                          </Badge>
                        )}
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <div className="space-y-1">
                          <div className="flex justify-end items-center gap-2">
                            <Users className="h-3 w-3 text-gray-400" />
                            <span className="text-sm font-medium">
                              {company.assignedNotaries || 0}
                            </span>
                          </div>
                          <div className="flex justify-end items-center gap-2">
                            <FileText className="h-3 w-3 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {company.completedJobs || 0} jobs
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedCompany(company)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation(`/title-companies/${company.id}`)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Company
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation(`/title-company-assignments`)}>
                              <Award className="h-4 w-4 mr-2" />
                              Manage Notaries
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Company
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedCompanies.length)} of {filteredAndSortedCompanies.length} companies
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                
                {[...Array(totalPages)].map((_, i) => {
                  const page = i + 1;
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return <span key={page} className="px-2">...</span>;
                  }
                  return null;
                })}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Details Sheet */}
      {selectedCompany && (
        <Sheet open={!!selectedCompany} onOpenChange={() => setSelectedCompany(null)}>
          <SheetContent className="w-full sm:max-w-2xl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                {selectedCompany.companyName}
              </SheetTitle>
              <SheetDescription>
                Comprehensive company information and performance metrics
              </SheetDescription>
            </SheetHeader>
            
            <div className="mt-6 space-y-6">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="performance">Performance</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-4">
                  {/* Company Status */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Company Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <Badge className={`${getStatusColor(selectedCompany.status)} flex items-center gap-2`}>
                          {getStatusIcon(selectedCompany.status)}
                          {selectedCompany.status.charAt(0).toUpperCase() + selectedCompany.status.slice(1)}
                        </Badge>
                        {selectedCompany.paymentMethod && (
                          <Badge variant="outline" className={getPaymentMethodColor(selectedCompany.paymentMethod)}>
                            {selectedCompany.paymentMethod.replace('_', ' ').toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contact Information */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedCompany.contactName && (
                        <div className="flex items-center gap-3">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Contact:</span>
                          <span className="text-gray-700">{selectedCompany.contactName}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Email:</span>
                        <span className="text-gray-700">{selectedCompany.contactEmail}</span>
                      </div>
                      
                      {selectedCompany.phoneNumber && (
                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Phone:</span>
                          <span className="text-gray-700">{selectedCompany.phoneNumber}</span>
                        </div>
                      )}
                      
                      {(selectedCompany.address1 || selectedCompany.city) && (
                        <div className="flex items-start gap-3">
                          <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                          <div>
                            <span className="font-medium">Address:</span>
                            <div className="text-gray-700">
                              {selectedCompany.address1 && (
                                <div>{selectedCompany.address1}</div>
                              )}
                              {selectedCompany.address2 && (
                                <div>{selectedCompany.address2}</div>
                              )}
                              {(selectedCompany.city || selectedCompany.state) && (
                                <div>
                                  {selectedCompany.city && `${selectedCompany.city}, `}
                                  {selectedCompany.state}
                                  {selectedCompany.zipCode && ` ${selectedCompany.zipCode}`}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Registered:</span>
                        <span className="text-gray-700">
                          {new Date(selectedCompany.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="performance" className="space-y-4">
                  {/* Performance Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {selectedCompany.assignedNotaries || 0}
                        </div>
                        <div className="text-sm text-gray-500">Assigned Notaries</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {selectedCompany.completedJobs || 0}
                        </div>
                        <div className="text-sm text-gray-500">Completed Jobs</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          ${selectedCompany.totalSpent?.toLocaleString() || '0'}
                        </div>
                        <div className="text-sm text-gray-500">Total Spent</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          ${selectedCompany.averageJobValue?.toLocaleString() || '0'}
                        </div>
                        <div className="text-sm text-gray-500">Avg Job Value</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Performance Score */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Performance Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>Overall Performance</span>
                          <span className="font-medium">85%</span>
                        </div>
                        <Progress value={85} className="h-2" />
                        
                        <div className="grid grid-cols-3 gap-4 text-center text-xs">
                          <div>
                            <div className="text-green-600 font-medium">92%</div>
                            <div className="text-gray-500">Job Completion</div>
                          </div>
                          <div>
                            <div className="text-blue-600 font-medium">78%</div>
                            <div className="text-gray-500">Response Time</div>
                          </div>
                          <div>
                            <div className="text-purple-600 font-medium">85%</div>
                            <div className="text-gray-500">Client Satisfaction</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="settings" className="space-y-4">
                  {/* Quick Actions */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => setLocation(`/title-companies/${selectedCompany.id}`)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Company Details
                      </Button>
                      
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => setLocation('/title-company-assignments')}
                      >
                        <Award className="h-4 w-4 mr-2" />
                        Manage Notary Assignments
                      </Button>
                      
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Job History
                      </Button>
                      
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Billing & Payments
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Subscription Info */}
                  {selectedCompany.subscriptionPlan && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Subscription</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Plan:</span>
                            <Badge>{selectedCompany.subscriptionPlan}</Badge>
                          </div>
                          {selectedCompany.nextBillingDate && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Next Billing:</span>
                              <span className="text-sm text-gray-600">
                                {new Date(selectedCompany.nextBillingDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
} 