import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VerificationDataView } from './VerificationDataView';
import { VerificationManagement } from './VerificationManagement';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Shield, 
  UserCheck, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Search,
  Filter
} from 'lucide-react';

interface UserData {
  id: number;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  approvalStatus: string;
  verificationStatus?: string;
  createdAt: string;
  lastActivity?: string;
}

export function AdminVerification() {
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [verificationStats, setVerificationStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVerificationData();
  }, []);

  const fetchVerificationData = async () => {
    try {
      setLoading(true);
      const [usersRes, statsRes] = await Promise.all([
        fetch('/api/users', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/admin/verification-stats', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (!usersRes.ok) {
        throw new Error('Failed to fetch users');
      }

      const users = await usersRes.json();
      const stats = statsRes.ok ? await statsRes.json() : null;

      setAllUsers(Array.isArray(users) ? users : []);
      setVerificationStats(stats);
    } catch (error) {
      console.error('Error fetching verification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = allUsers.filter(user => {
    const fullName = user.fullName || '';
    const email = user.email || '';
    const searchTerm = userSearchTerm.toLowerCase();
    
    const matchesSearch = fullName.toLowerCase().includes(searchTerm) ||
                         email.toLowerCase().includes(searchTerm);
    const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter;
    
    // Only show users that require verification (signers, witnesses, etc.)
    const requiresVerification = ['signer', 'witness', 'client'].includes(user.role);
    
    return matchesSearch && matchesRole && requiresVerification;
  });

  const getVerificationStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
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
          <h1 className="text-3xl font-bold text-gray-900">KYC/KBA Verification</h1>
          <p className="text-gray-600 mt-2">Manage identity verification and background checks</p>
        </div>
        <div className="flex items-center gap-2">
          {verificationStats && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <Shield className="h-3 w-3 mr-1" />
              {verificationStats.totalVerifications || 0} verifications
            </Badge>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      {verificationStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Verifications</p>
                  <p className="text-2xl font-bold text-gray-900">{verificationStats.totalVerifications || 0}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Verified Users</p>
                  <p className="text-2xl font-bold text-blue-600">{verificationStats.verifiedUsers || 0}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Verifications</p>
                  <p className="text-2xl font-bold text-yellow-600">{verificationStats.pendingVerifications || 0}</p>
                </div>
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Failed Verifications</p>
                  <p className="text-2xl font-bold text-red-600">{verificationStats.failedVerifications || 0}</p>
                </div>
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Users Requiring Verification</CardTitle>
              <CardDescription>Select a user to view their verification data</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="space-y-4 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Roles</option>
                  <option value="signer">Signer</option>
                  <option value="witness">Witness</option>
                  <option value="client">Client</option>
                </select>
              </div>

              {/* User List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No users found</p>
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedUser?.id === user.id
                          ? 'bg-blue-50 border-2 border-blue-200'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{user.fullName}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {user.role}
                            </Badge>
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${getVerificationStatusColor(user.verificationStatus || 'unverified')}`}
                            >
                              {user.verificationStatus || 'unverified'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUser(user);
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

        {/* User Details */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedUser ? `Verification Details - ${selectedUser.fullName}` : 'User Verification Details'}
              </CardTitle>
              <CardDescription>
                {selectedUser ? `${selectedUser.role} - ${selectedUser.email}` : 'Select a user to view their verification data'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedUser ? (
                <div className="space-y-6">
                  {/* User Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">User Information</h4>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium">Role:</span> {selectedUser.role}</p>
                        <p><span className="font-medium">Status:</span> {selectedUser.isActive ? 'Active' : 'Inactive'}</p>
                        <p><span className="font-medium">Registered:</span> {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                        {selectedUser.lastActivity && (
                          <p><span className="font-medium">Last Activity:</span> {new Date(selectedUser.lastActivity).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Verification Status</h4>
                      <div className="space-y-2">
                        <Badge 
                          variant="secondary" 
                          className={`${getVerificationStatusColor(selectedUser.verificationStatus || 'unverified')}`}
                        >
                          {selectedUser.verificationStatus || 'unverified'}
                        </Badge>
                        <div className="space-y-2 text-sm">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedUser(selectedUser)}
                            className="w-full"
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            View Full Verification Data
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Verification Data Component */}
                  <div className="border-t pt-6">
                    <VerificationDataView 
                      userId={selectedUser.id} 
                      userRole={selectedUser.role}
                      className="w-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Select a user to view their verification details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Verification Management Component */}
      <div className="mt-8">
        <VerificationManagement />
      </div>
    </div>
  );
} 