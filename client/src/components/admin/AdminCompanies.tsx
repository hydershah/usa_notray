import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Users
} from 'lucide-react';

interface CompanyData {
  id: number;
  companyName: string;
  contactEmail: string;
  contactName?: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  licenseNumber?: string;
  status: string;
  createdAt: string;
  lastActivity?: string;
  assignedNotaries?: number;
  completedJobs?: number;
}

export function AdminCompanies() {
  const [, setLocation] = useLocation();
  const [allCompanies, setAllCompanies] = useState<CompanyData[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompaniesData();
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
      setAllCompanies(Array.isArray(companies) ? companies : []);
    } catch (error) {
      console.error('Error fetching companies data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = allCompanies.filter(company => {
    const matchesSearch = company.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         company.contactEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || company.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      case 'pending':
        return 'Pending';
      case 'suspended':
        return 'Suspended';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Company Management</h1>
          <p className="text-gray-600 mt-2">Manage title companies and their operations</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Building2 className="h-3 w-3 mr-1" />
            {allCompanies.length} companies
          </Badge>
          <Button 
            onClick={() => setLocation('/title-companies')}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by company name or email..."
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
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Title Companies</CardTitle>
              <CardDescription>
                Showing {filteredCompanies.length} of {allCompanies.length} companies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {filteredCompanies.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No companies found</p>
                  </div>
                ) : (
                  filteredCompanies.map((company) => (
                    <div
                      key={company.id}
                      onClick={() => setSelectedCompany(company)}
                      className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedCompany?.id === company.id
                          ? 'bg-blue-50 border-2 border-blue-200'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Building2 className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{company.companyName}</p>
                            <p className="text-sm text-gray-600">{company.contactEmail}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${getStatusColor(company.status)}`}
                              >
                                {getStatusText(company.status)}
                              </Badge>
                              {company.assignedNotaries && (
                                <Badge variant="outline" className="text-xs">
                                  {company.assignedNotaries} notaries
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCompany(company);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Company Details */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Company Details</CardTitle>
              <CardDescription>
                {selectedCompany ? `Details for ${selectedCompany.companyName}` : 'Select a company to view details'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedCompany ? (
                <div className="space-y-6">
                  {/* Company Info */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-purple-100 rounded-lg">
                        <Building2 className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{selectedCompany.companyName}</h3>
                        <p className="text-sm text-gray-600">{selectedCompany.contactEmail}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Status:</span>
                        <Badge 
                          variant="secondary" 
                          className={getStatusColor(selectedCompany.status)}
                        >
                          {getStatusText(selectedCompany.status)}
                        </Badge>
                      </div>
                      
                      {selectedCompany.contactName && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Contact:</span>
                          <span className="text-gray-700">{selectedCompany.contactName}</span>
                        </div>
                      )}
                      
                      {selectedCompany.phoneNumber && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Phone:</span>
                          <span className="text-gray-700">{selectedCompany.phoneNumber}</span>
                        </div>
                      )}
                      
                      {selectedCompany.address && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Address:</span>
                          <span className="text-gray-700">{selectedCompany.address}</span>
                        </div>
                      )}
                      
                      {(selectedCompany.city || selectedCompany.state) && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Location:</span>
                          <span className="text-gray-700">
                            {selectedCompany.city && `${selectedCompany.city}, `}
                            {selectedCompany.state}
                            {selectedCompany.zipCode && ` ${selectedCompany.zipCode}`}
                          </span>
                        </div>
                      )}
                      
                      {selectedCompany.licenseNumber && (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">License:</span>
                          <span className="text-gray-700">{selectedCompany.licenseNumber}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Registered:</span>
                        <span className="text-gray-700">
                          {new Date(selectedCompany.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {selectedCompany.lastActivity && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Last Activity:</span>
                          <span className="text-gray-700">
                            {new Date(selectedCompany.lastActivity).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Performance Stats */}
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Performance:</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">
                            {selectedCompany.assignedNotaries || 0}
                          </p>
                          <p className="text-xs text-gray-500">Assigned Notaries</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {selectedCompany.completedJobs || 0}
                          </p>
                          <p className="text-xs text-gray-500">Completed Jobs</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation('/title-companies')}
                      className="w-full"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Company
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation('/title-company-assignments')}
                      className="w-full"
                    >
                      <Award className="h-4 w-4 mr-2" />
                      Notary Assignments
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Select a company to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 