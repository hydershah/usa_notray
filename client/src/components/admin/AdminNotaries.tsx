import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Clock
} from 'lucide-react';

interface NotaryData {
  id: number;
  fullName: string;
  email: string;
  role: string;
  notaryType: string;
  isActive: boolean;
  approvalStatus: string;
  phoneNumber?: string;
  state?: string;
  city?: string;
  licenseNumber?: string;
  commissionExpiry?: string;
  createdAt: string;
  lastActivity?: string;
  hasCommissionFile: boolean;
  hasEOInsurance: boolean;
  hasBond: boolean;
  hasPublicCertificate: boolean;
  assignedCompanies?: string[];
  completedJobs?: number;
}

export function AdminNotaries() {
  const [, setLocation] = useLocation();
  const [allNotaries, setAllNotaries] = useState<NotaryData[]>([]);
  const [selectedNotary, setSelectedNotary] = useState<NotaryData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotariesData();
  }, []);

  const fetchNotariesData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const users = await response.json();
      console.log('📊 All users fetched:', users);
      
      // Filter only notaries and map to the expected structure
      const notaries = Array.isArray(users) ? users
        .filter((user: any) => user.role === 'notary')
        .map((user: any) => ({
          id: user.id,
          fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email,
          email: user.email,
          role: user.role,
          notaryType: user.notaryType || 'contractor',
          isActive: user.isActive !== false,
          approvalStatus: user.approvalStatus || (user.isActive ? 'approved' : 'pending'),
          phoneNumber: user.phoneNumber,
          state: user.state,
          city: user.city,
          licenseNumber: user.commissionNumber,
          commissionExpiry: user.commissionExpiration,
          createdAt: user.createdAt,
          lastActivity: user.lastLoginAt,
          hasCommissionFile: user.hasCommissionFile || false,
          hasEOInsurance: user.hasEOInsurance || false,
          hasBond: user.hasBond || false,
          hasPublicCertificate: user.hasPublicCertificate || false,
          assignedCompanies: [],
          completedJobs: 0
        })) : [];
      
      console.log('👨‍⚖️ Processed notaries:', notaries);
      setAllNotaries(notaries);
    } catch (error) {
      console.error('Error fetching notaries data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredNotaries = allNotaries.filter(notary => {
    const matchesSearch = notary.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notary.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || notary.notaryType === typeFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && notary.isActive && notary.approvalStatus === 'approved') ||
                         (statusFilter === 'inactive' && !notary.isActive) ||
                         (statusFilter === 'pending' && notary.approvalStatus === 'pending');
    
    return matchesSearch && matchesType && matchesStatus;
  });

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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'subscriber':
        return 'bg-blue-100 text-blue-800';
      case 'contractor':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
          <h1 className="text-3xl font-bold text-gray-900">Notary Management</h1>
          <p className="text-gray-600 mt-2">Manage notaries and their assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Award className="h-3 w-3 mr-1" />
            {allNotaries.length} notaries
          </Badge>
          <Button 
            onClick={() => setLocation('/notary-management')}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Settings className="h-4 w-4 mr-2" />
            Advanced Management
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Types</option>
          <option value="subscriber">Subscriber</option>
          <option value="contractor">Contractor</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notary List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notaries</CardTitle>
              <CardDescription>
                Showing {filteredNotaries.length} of {allNotaries.length} notaries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {filteredNotaries.length === 0 ? (
                  <div className="text-center py-8">
                    <Award className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No notaries found</p>
                  </div>
                ) : (
                  filteredNotaries.map((notary) => (
                    <div
                      key={notary.id}
                      onClick={() => setSelectedNotary(notary)}
                      className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedNotary?.id === notary.id
                          ? 'bg-blue-50 border-2 border-blue-200'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Award className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{notary.fullName}</p>
                            <p className="text-sm text-gray-600">{notary.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${getTypeColor(notary.notaryType)}`}
                              >
                                {notary.notaryType}
                              </Badge>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${getStatusColor(notary)}`}
                              >
                                {getStatusText(notary)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedNotary(notary);
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

        {/* Notary Details */}
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
                  {/* Notary Info */}
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

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Type:</span>
                        <Badge 
                          variant="secondary" 
                          className={getTypeColor(selectedNotary.notaryType)}
                        >
                          {selectedNotary.notaryType}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Status:</span>
                        <Badge 
                          variant="secondary" 
                          className={getStatusColor(selectedNotary)}
                        >
                          {getStatusText(selectedNotary)}
                        </Badge>
                      </div>
                      
                      {selectedNotary.phoneNumber && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Phone:</span>
                          <span className="text-gray-700">{selectedNotary.phoneNumber}</span>
                        </div>
                      )}
                      
                      {selectedNotary.state && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Location:</span>
                          <span className="text-gray-700">
                            {selectedNotary.city && `${selectedNotary.city}, `}{selectedNotary.state}
                          </span>
                        </div>
                      )}
                      
                      {selectedNotary.licenseNumber && (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">License:</span>
                          <span className="text-gray-700">{selectedNotary.licenseNumber}</span>
                        </div>
                      )}
                      
                      {selectedNotary.commissionExpiry && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Commission Expires:</span>
                          <span className="text-gray-700">
                            {new Date(selectedNotary.commissionExpiry).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Documents Status */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Required Documents:</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: 'hasCommissionFile', label: 'Commission' },
                          { key: 'hasEOInsurance', label: 'E&O Insurance' },
                          { key: 'hasBond', label: 'Bond' },
                          { key: 'hasPublicCertificate', label: 'Certificate' }
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
                    </div>

                    {/* Performance Stats */}
                    {selectedNotary.completedJobs !== undefined && (
                      <div className="pt-4 border-t">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Performance:</h4>
                        <div className="text-sm text-gray-600">
                          <p>Completed Jobs: {selectedNotary.completedJobs}</p>
                          {selectedNotary.assignedCompanies && (
                            <p>Assigned Companies: {selectedNotary.assignedCompanies.length}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation('/notary-management')}
                      className="w-full"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Notary
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation('/title-company-assignments')}
                      className="w-full"
                    >
                      <Building className="h-4 w-4 mr-2" />
                      Company Assignments
                    </Button>
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
    </div>
  );
} 