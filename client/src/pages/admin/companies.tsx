import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Building, 
  Clock, 
  CheckCircle, 
  XCircle,
  Search,
  Filter,
  Eye,
  Mail,
  MoreHorizontal,
  Plus,
  Download,
  RefreshCw,
  AlertTriangle,
  User,
  Calendar,
  MapPin,
  Phone,
  Trash2
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Company {
  id: number;
  companyName: string;
  primaryUserName: string;
  primaryUserEmail: string;
  primaryUserPhone?: string;
  companyType: string;
  status: string;
  approvedBy?: number;
  approvedAt?: string;
  approvalNotes?: string;
  createdAt: string;
  updatedAt: string;
  // Additional fields
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phoneNumber?: string;
  website?: string;
  taxId?: string;
  licenseNumber?: string;
  licenseExpiration?: string;
}

interface CompanyStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  active: number;
  inactive: number;
}

// Stats Cards Component
const CompanyStatsCards: React.FC<{ stats: CompanyStats; loading: boolean }> = ({ stats, loading }) => {
  // This component is now removed - returning null
  return null;
};

// Company Filters Component
const CompanyFilters: React.FC<{
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  typeFilter: string;
  setTypeFilter: (type: string) => void;
  onRefresh: () => void;
  loading: boolean;
}> = ({ searchTerm, setSearchTerm, statusFilter, setStatusFilter, typeFilter, setTypeFilter, onRefresh, loading }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search companies by name, contact, or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="all">All Status</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      
      <select
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="all">All Types</option>
        <option value="title_company">Title Company</option>
        <option value="lending_institution">Lending Institution</option>
        <option value="real_estate_agency">Real Estate Agency</option>
        <option value="law_firm">Law Firm</option>
        <option value="other">Other</option>
      </select>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={loading}
        className="shrink-0"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  );
};

// Company Table Component
const CompanyTable: React.FC<{
  companies: Company[];
  loading: boolean;
  onViewCompany: (company: Company) => void;
  onApproveCompany: (company: Company) => void;
  onRejectCompany: (company: Company) => void;
  onDeleteCompany: (company: Company) => void;
  onActivateCompany: (company: Company) => void;
  onDeactivateCompany: (company: Company) => void;
}> = ({ companies, loading, onViewCompany, onApproveCompany, onRejectCompany, onDeleteCompany, onActivateCompany, onDeactivateCompany }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 font-semibold">⏱️ Pending Review</Badge>;
      case 'approved': return <Badge variant="secondary" className="bg-green-100 text-green-800">✓ Approved</Badge>;
      case 'rejected': return <Badge variant="secondary" className="bg-red-100 text-red-800">✗ Rejected</Badge>;
      case 'active': return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">✓ Active</Badge>;
      case 'inactive': return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Inactive</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'title_company': return <Badge variant="outline" className="text-blue-600">Title Company</Badge>;
      case 'lending_institution': return <Badge variant="outline" className="text-blue-600">Lending Institution</Badge>;
      case 'real_estate_agency': return <Badge variant="outline" className="text-blue-600">Real Estate Agency</Badge>;
      case 'law_firm': return <Badge variant="outline" className="text-orange-600">Law Firm</Badge>;
      case 'other': return <Badge variant="outline" className="text-gray-600">Other</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="flex gap-2">
                <div className="h-6 bg-gray-200 rounded w-16"></div>
                <div className="h-6 bg-gray-200 rounded w-20"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {companies.map((company) => (
        <Card key={company.id} className={`hover:shadow-lg transition-all ${company.status === 'pending' ? 'border-2 border-yellow-300 bg-yellow-50/30' : ''}`}>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-blue-600" />
                    <h3 className="text-xl font-bold text-gray-900">{company.companyName}</h3>
                  </div>
                  {getStatusBadge(company.status)}
                  {getTypeBadge(company.companyType)}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span><strong>Contact:</strong> {company.primaryUserName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span>{company.primaryUserEmail}</span>
                  </div>
                  {company.primaryUserPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{company.primaryUserPhone}</span>
                    </div>
                  )}
                  {company.city && company.state && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span>{company.city}, {company.state} {company.zipCode}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Created: {new Date(company.createdAt).toLocaleDateString()}</span>
                  </div>
                  {company.approvedAt && (
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span>Approved: {new Date(company.approvedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col gap-2 lg:min-w-[200px]">
                {company.status === 'pending' && (
                  <>
                    <Button
                      onClick={() => onApproveCompany(company)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold shadow-md"
                      size="lg"
                    >
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Approve Company
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => onRejectCompany(company)}
                      className="w-full font-semibold shadow-md"
                      size="lg"
                    >
                      <XCircle className="h-5 w-5 mr-2" />
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => onDeleteCompany(company)}
                      className="w-full text-red-600 border-red-300 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </>
                )}
                
                {company.status === 'approved' && (
                  <Button
                    onClick={() => onActivateCompany(company)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Activate
                  </Button>
                )}
                
                {company.status === 'active' && (
                  <Button
                    variant="outline"
                    onClick={() => onDeactivateCompany(company)}
                    className="w-full"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Deactivate
                  </Button>
                )}

                {company.status !== 'pending' && (
                  <Button
                    variant="outline"
                    onClick={() => onViewCompany(company)}
                    className="w-full"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default function AdminCompanies() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<CompanyStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    active: 0,
    inactive: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
    actionText: string;
    variant?: 'default' | 'destructive';
  }>({
    open: false,
    title: '',
    description: '',
    action: () => {},
    actionText: 'Confirm',
  });

  useEffect(() => {
    // Initialize filter from URL query (e.g., ?status=pending)
    try {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      if (status) {
        setStatusFilter(status);
      }
    } catch {}

    if (user?.role === 'admin' || user?.isAdmin) {
      fetchCompanies();
    }
  }, [user]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("GET", "/api/companies");
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setCompanies(data);
        
        // Calculate stats
        const stats = {
          total: data.length,
          pending: data.filter(c => c.status === 'pending').length,
          approved: data.filter(c => c.status === 'approved').length,
          rejected: data.filter(c => c.status === 'rejected').length,
          active: data.filter(c => c.status === 'active').length,
          inactive: data.filter(c => c.status === 'inactive').length
        };
        setStats(stats);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewCompany = (company: Company) => {
    // TODO: Implement detailed view modal
    console.log('View company:', company);
  };

  const handleApproveCompany = (company: Company) => {
    setConfirmDialog({
      open: true,
      title: 'Approve Company',
      description: `Are you sure you want to approve "${company.companyName}"? This will grant them access to the platform.`,
      actionText: 'Approve',
      variant: 'default',
      action: async () => {
        try {
          const response = await apiRequest("PATCH", `/api/companies/${company.id}/status`, {
            status: 'approved',
            notes: 'Approved by admin'
          });
          
          if (response.ok) {
            toast({
              title: "Company Approved",
              description: `${company.companyName} has been successfully approved.`,
            });
            fetchCompanies();
          } else {
            throw new Error('Failed to approve company');
          }
        } catch (error) {
          console.error('Error approving company:', error);
          toast({
            title: "Error",
            description: "Failed to approve company. Please try again.",
            variant: "destructive",
          });
        }
      }
    });
  };

  const handleRejectCompany = (company: Company) => {
    setConfirmDialog({
      open: true,
      title: 'Reject Company',
      description: `Are you sure you want to reject "${company.companyName}"? They will be notified of this decision.`,
      actionText: 'Reject',
      variant: 'destructive',
      action: async () => {
        try {
          const response = await apiRequest("PATCH", `/api/companies/${company.id}/status`, {
            status: 'rejected',
            notes: 'Rejected by admin'
          });
          
          if (response.ok) {
            toast({
              title: "Company Rejected",
              description: `${company.companyName} has been rejected.`,
            });
            fetchCompanies();
          } else {
            throw new Error('Failed to reject company');
          }
        } catch (error) {
          console.error('Error rejecting company:', error);
          toast({
            title: "Error",
            description: "Failed to reject company. Please try again.",
            variant: "destructive",
          });
        }
      }
    });
  };

  const handleDeleteCompany = (company: Company) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Company',
      description: `Are you sure you want to permanently delete "${company.companyName}"? This action cannot be undone and will remove all associated data.`,
      actionText: 'Delete Permanently',
      variant: 'destructive',
      action: async () => {
        try {
          const response = await apiRequest("DELETE", `/api/companies/${company.id}`);
          
          if (response.ok) {
            toast({
              title: "Company Deleted",
              description: `${company.companyName} has been permanently deleted.`,
            });
            fetchCompanies();
          } else {
            throw new Error('Failed to delete company');
          }
        } catch (error) {
          console.error('Error deleting company:', error);
          toast({
            title: "Error",
            description: "Failed to delete company. Please try again.",
            variant: "destructive",
          });
        }
      }
    });
  };

  const handleActivateCompany = async (company: Company) => {
    try {
      const response = await apiRequest("PATCH", `/api/companies/${company.id}/status`, {
        status: 'active',
        notes: 'Activated by admin'
      });
      
      if (response.ok) {
        toast({
          title: "Company Activated",
          description: `${company.companyName} is now active.`,
        });
        fetchCompanies();
      }
    } catch (error) {
      console.error('Error activating company:', error);
      toast({
        title: "Error",
        description: "Failed to activate company. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeactivateCompany = (company: Company) => {
    setConfirmDialog({
      open: true,
      title: 'Deactivate Company',
      description: `Are you sure you want to deactivate "${company.companyName}"? This will restrict their access to the platform.`,
      actionText: 'Deactivate',
      variant: 'destructive',
      action: async () => {
        try {
          const response = await apiRequest("PATCH", `/api/companies/${company.id}/status`, {
            status: 'inactive',
            notes: 'Deactivated by admin'
          });
          
          if (response.ok) {
            toast({
              title: "Company Deactivated",
              description: `${company.companyName} has been deactivated.`,
            });
            fetchCompanies();
          } else {
            throw new Error('Failed to deactivate company');
          }
        } catch (error) {
          console.error('Error deactivating company:', error);
          toast({
            title: "Error",
            description: "Failed to deactivate company. Please try again.",
            variant: "destructive",
          });
        }
      }
    });
  };

  // Filter companies based on search and filters
  const filteredCompanies = companies.filter(company => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === "" || 
      (company.companyName?.toLowerCase().includes(term) ?? false) ||
      (company.primaryUserName?.toLowerCase().includes(term) ?? false) ||
      (company.primaryUserEmail?.toLowerCase().includes(term) ?? false) ||
      (company.city?.toLowerCase().includes(term) ?? false);
    
    const matchesStatus = statusFilter === "all" || company.status === statusFilter;
    const matchesType = typeFilter === "all" || company.companyType === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  if (!user || (user.role !== 'admin' && !user.isAdmin)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Title Company Management</h1>
        <p className="text-gray-600">Review and manage title company registrations and approvals</p>
      </div>

      {stats.pending > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3" />
            <div>
              <h3 className="text-sm font-semibold text-yellow-800">
                {stats.pending} {stats.pending === 1 ? 'Company' : 'Companies'} Pending Approval
              </h3>
              <p className="text-sm text-yellow-700">
                Review and take action on pending company registrations below.
              </p>
            </div>
          </div>
        </div>
      )}

      <CompanyFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        onRefresh={fetchCompanies}
        loading={loading}
      />

      <CompanyTable
        companies={filteredCompanies}
        loading={loading}
        onViewCompany={handleViewCompany}
        onApproveCompany={handleApproveCompany}
        onRejectCompany={handleRejectCompany}
        onDeleteCompany={handleDeleteCompany}
        onActivateCompany={handleActivateCompany}
        onDeactivateCompany={handleDeactivateCompany}
      />

      {!loading && filteredCompanies.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No title companies found</h3>
            <p className="text-gray-600">There are no title companies matching your current filters.</p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmDialog.action();
                setConfirmDialog({ ...confirmDialog, open: false });
              }}
              className={confirmDialog.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {confirmDialog.actionText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 