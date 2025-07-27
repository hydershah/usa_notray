import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Building2, 
  UserCheck, 
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Eye,
  FileText,
  Shield,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Filter,
  Search
} from 'lucide-react';

interface PendingUser {
  id: number;
  fullName: string | null;
  email: string | null;
  role: string;
  notaryType?: string;
  phoneNumber: string;
  createdAt: string;
  hasCommissionFile: boolean;
  hasEOInsurance: boolean;
  hasBond: boolean;
  hasPublicCertificate: boolean;
  state?: string;
  city?: string;
  licenseNumber?: string;
  commissionExpiry?: string;
}

interface PendingCompany {
  id: number;
  companyName: string | null;
  contactEmail: string | null;
  status: string;
  createdAt: string;
  licenseNumber?: string;
  state?: string;
  contactName?: string;
  address?: string;
  phoneNumber?: string;
}

export function AdminApprovals() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [pendingCompanies, setPendingCompanies] = useState<PendingCompany[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'companies'>('users');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const [usersRes, companiesRes] = await Promise.all([
        fetch('/api/admin/users/pending-approval', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }),
        fetch('/api/admin/companies/pending', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        })
      ]);

      if (!usersRes.ok || !companiesRes.ok) {
        throw new Error('Failed to fetch pending approvals');
      }

      const users = await usersRes.json();
      const companies = await companiesRes.json();

      setPendingUsers(Array.isArray(users) ? users : []);
      setPendingCompanies(Array.isArray(companies) ? companies : []);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveUser = async (userId: number) => {
    try {
      setProcessingIds(prev => new Set(prev).add(userId));
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ notes: 'Approved by admin dashboard' })
      });

      if (response.ok) {
        // Add a small delay to ensure backend processing is complete
        await new Promise(resolve => setTimeout(resolve, 500));
        await fetchPendingApprovals();
      } else {
        console.error('Failed to approve user:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error approving user:', error);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const rejectUser = async (userId: number) => {
    try {
      setProcessingIds(prev => new Set(prev).add(userId));
      const response = await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ notes: 'Rejected by admin dashboard' })
      });

      if (response.ok) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await fetchPendingApprovals();
      } else {
        console.error('Failed to reject user:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const approveCompany = async (companyId: number) => {
    try {
      setProcessingIds(prev => new Set(prev).add(companyId));
      const response = await fetch(`/api/admin/companies/${companyId}/approve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ notes: 'Approved by admin dashboard' })
      });

      if (response.ok) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await fetchPendingApprovals();
      } else {
        console.error('Failed to approve company:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error approving company:', error);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(companyId);
        return newSet;
      });
    }
  };

  const rejectCompany = async (companyId: number) => {
    try {
      setProcessingIds(prev => new Set(prev).add(companyId));
      const response = await fetch(`/api/admin/companies/${companyId}/reject`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ reason: 'Rejected by admin dashboard' })
      });

      if (response.ok) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await fetchPendingApprovals();
      } else {
        console.error('Failed to reject company:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error rejecting company:', error);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(companyId);
        return newSet;
      });
    }
  };

  const filteredUsers = pendingUsers.filter(user => {
    const matchesSearch = (user.fullName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    // Only show notary and title_company users, exclude clients/signers
    const isApprovalRole = user.role === 'notary' || user.role === 'title_company';
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole && isApprovalRole;
  });

  const filteredCompanies = pendingCompanies.filter(company => {
    const matchesSearch = (company.companyName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (company.contactEmail?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

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
          <h1 className="text-3xl font-bold text-gray-900">Pending Approvals</h1>
          <p className="text-gray-600 mt-2">Review and approve notary and title company registrations</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            <Clock className="h-3 w-3 mr-1" />
            {pendingUsers.filter(user => user.role === 'notary' || user.role === 'title_company').length + pendingCompanies.length} pending
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-2 px-1 font-medium transition-colors ${
            activeTab === 'users'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Professionals ({pendingUsers.filter(user => user.role === 'notary' || user.role === 'title_company').length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('companies')}
          className={`pb-2 px-1 font-medium transition-colors ${
            activeTab === 'companies'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Companies ({pendingCompanies.length})
          </div>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
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
        {activeTab === 'users' && (
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Roles</option>
            <option value="notary">Notary</option>
            <option value="title_company">Title Company</option>
          </select>
        )}
      </div>

      {/* Content */}
      {activeTab === 'users' ? (
        <div className="grid gap-4">
          {filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <UserCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No pending user approvals</p>
              </CardContent>
            </Card>
          ) : (
            filteredUsers.map((user) => (
              <Card key={user.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{user.fullName || 'No name provided'}</h3>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {user.role}
                            </Badge>
                            {user.notaryType && (
                              <Badge variant="secondary" className="text-xs">
                                {user.notaryType}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="h-4 w-4" />
                            {user.email || 'No email provided'}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="h-4 w-4" />
                            {user.phoneNumber}
                          </div>
                          {user.state && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <MapPin className="h-4 w-4" />
                              {user.city && `${user.city}, `}{user.state}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="h-4 w-4" />
                            Applied: {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                          {user.licenseNumber && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <FileText className="h-4 w-4" />
                              License: {user.licenseNumber}
                            </div>
                          )}
                          {user.commissionExpiry && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Shield className="h-4 w-4" />
                              Expires: {new Date(user.commissionExpiry).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>

                      {user.role === 'notary' && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Required Documents:</h4>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { key: 'hasCommissionFile', label: 'Commission File' },
                              { key: 'hasEOInsurance', label: 'E&O Insurance' },
                              { key: 'hasBond', label: 'Bond' },
                              { key: 'hasPublicCertificate', label: 'Public Certificate' }
                            ].map(({ key, label }) => (
                              <Badge
                                key={key}
                                variant={user[key as keyof PendingUser] ? 'default' : 'secondary'}
                                className={`text-xs ${
                                  user[key as keyof PendingUser]
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {user[key as keyof PendingUser] ? 'Yes' : 'No'} {label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        onClick={() => approveUser(user.id)}
                        className="bg-green-500 hover:bg-green-600 text-white"
                        size="sm"
                        disabled={processingIds.has(user.id)}
                      >
                        {processingIds.has(user.id) ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        )}
                        {processingIds.has(user.id) ? 'Processing...' : 'Approve'}
                      </Button>
                      <Button
                        onClick={() => rejectUser(user.id)}
                        variant="destructive"
                        size="sm"
                        disabled={processingIds.has(user.id)}
                      >
                        {processingIds.has(user.id) ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                        ) : (
                          <XCircle className="h-4 w-4 mr-1" />
                        )}
                        {processingIds.has(user.id) ? 'Processing...' : 'Reject'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredCompanies.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No pending company approvals</p>
              </CardContent>
            </Card>
          ) : (
            filteredCompanies.map((company) => (
              <Card key={company.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Building2 className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{company.companyName || 'No company name provided'}</h3>
                          <Badge variant="outline" className="text-xs">
                            {company.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="h-4 w-4" />
                            {company.contactEmail || 'No email provided'}
                          </div>
                          {company.phoneNumber && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="h-4 w-4" />
                              {company.phoneNumber}
                            </div>
                          )}
                          {company.contactName && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <User className="h-4 w-4" />
                              {company.contactName}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="h-4 w-4" />
                            Applied: {new Date(company.createdAt).toLocaleDateString()}
                          </div>
                          {company.licenseNumber && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <FileText className="h-4 w-4" />
                              License: {company.licenseNumber}
                            </div>
                          )}
                          {company.state && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <MapPin className="h-4 w-4" />
                              {company.state}
                            </div>
                          )}
                        </div>
                      </div>

                      {company.address && (
                        <div className="mb-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="h-4 w-4" />
                            {company.address}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        onClick={() => approveCompany(company.id)}
                        className="bg-green-500 hover:bg-green-600 text-white"
                        size="sm"
                        disabled={processingIds.has(company.id)}
                      >
                        {processingIds.has(company.id) ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        )}
                        {processingIds.has(company.id) ? 'Processing...' : 'Approve'}
                      </Button>
                      <Button
                        onClick={() => rejectCompany(company.id)}
                        variant="destructive"
                        size="sm"
                        disabled={processingIds.has(company.id)}
                      >
                        {processingIds.has(company.id) ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                        ) : (
                          <XCircle className="h-4 w-4 mr-1" />
                        )}
                        {processingIds.has(company.id) ? 'Processing...' : 'Reject'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
} 