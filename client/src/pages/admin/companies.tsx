import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Phone
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/api';

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
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-12"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    { label: 'Total Companies', value: stats.total, icon: Building, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
    { label: 'Active', value: stats.active, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Inactive', value: stats.inactive, icon: AlertTriangle, color: 'text-gray-600', bg: 'bg-gray-100' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
      {statCards.map((stat, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
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
  onActivateCompany: (company: Company) => void;
  onDeactivateCompany: (company: Company) => void;
}> = ({ companies, loading, onViewCompany, onApproveCompany, onRejectCompany, onActivateCompany, onDeactivateCompany }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'approved': return <Badge variant="secondary" className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected': return <Badge variant="secondary" className="bg-red-100 text-red-800">Rejected</Badge>;
      case 'active': return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Active</Badge>;
      case 'inactive': return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Inactive</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'title_company': return <Badge variant="outline" className="text-blue-600">Title Company</Badge>;
      case 'lending_institution': return <Badge variant="outline" className="text-purple-600">Lending Institution</Badge>;
      case 'real_estate_agency': return <Badge variant="outline" className="text-green-600">Real Estate Agency</Badge>;
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
        <Card key={company.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{company.companyName}</h3>
                  {getStatusBadge(company.status)}
                  {getTypeBadge(company.companyType)}
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{company.primaryUserName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    <span>{company.primaryUserEmail}</span>
                  </div>
                  {company.primaryUserPhone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      <span>{company.primaryUserPhone}</span>
                    </div>
                  )}
                  {company.city && company.state && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{company.city}, {company.state}</span>
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-gray-400">
                  Created: {new Date(company.createdAt).toLocaleDateString()}
                  {company.approvedAt && (
                    <span className="ml-4">
                      Approved: {new Date(company.approvedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewCompany(company)}
                  className="h-8"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                
                {company.status === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onApproveCompany(company)}
                      className="h-8 text-green-600 border-green-200 hover:bg-green-50"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRejectCompany(company)}
                      className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </>
                )}
                
                {company.status === 'approved' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onActivateCompany(company)}
                    className="h-8 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Activate
                  </Button>
                )}
                
                {company.status === 'active' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDeactivateCompany(company)}
                    className="h-8 text-gray-600 border-gray-200 hover:bg-gray-50"
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Deactivate
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

  useEffect(() => {
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

  const handleApproveCompany = async (company: Company) => {
    try {
      const response = await apiRequest("PATCH", `/api/companies/${company.id}/status`, {
        status: 'approved',
        notes: 'Approved by admin'
      });
      
      if (response.ok) {
        fetchCompanies(); // Refresh the list
      }
    } catch (error) {
      console.error('Error approving company:', error);
    }
  };

  const handleRejectCompany = async (company: Company) => {
    try {
      const response = await apiRequest("PATCH", `/api/companies/${company.id}/status`, {
        status: 'rejected',
        notes: 'Rejected by admin'
      });
      
      if (response.ok) {
        fetchCompanies(); // Refresh the list
      }
    } catch (error) {
      console.error('Error rejecting company:', error);
    }
  };

  const handleActivateCompany = async (company: Company) => {
    try {
      const response = await apiRequest("PATCH", `/api/companies/${company.id}/status`, {
        status: 'active',
        notes: 'Activated by admin'
      });
      
      if (response.ok) {
        fetchCompanies(); // Refresh the list
      }
    } catch (error) {
      console.error('Error activating company:', error);
    }
  };

  const handleDeactivateCompany = async (company: Company) => {
    try {
      const response = await apiRequest("PATCH", `/api/companies/${company.id}/status`, {
        status: 'inactive',
        notes: 'Deactivated by admin'
      });
      
      if (response.ok) {
        fetchCompanies(); // Refresh the list
      }
    } catch (error) {
      console.error('Error deactivating company:', error);
    }
  };

  // Filter companies based on search and filters
  const filteredCompanies = companies.filter(company => {
    const matchesSearch = searchTerm === "" || 
      company.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.primaryUserName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.primaryUserEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (company.city && company.city.toLowerCase().includes(searchTerm.toLowerCase()));
    
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Company Management</h1>
        <p className="text-gray-600">Review and manage company registrations and approvals</p>
      </div>

      <CompanyStatsCards stats={stats} loading={loading} />
      
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
        onActivateCompany={handleActivateCompany}
        onDeactivateCompany={handleDeactivateCompany}
      />

      {!loading && filteredCompanies.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No companies found</h3>
            <p className="text-gray-600">There are no companies matching your current filters.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 