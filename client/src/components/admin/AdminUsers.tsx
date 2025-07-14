import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  UserCheck, 
  Settings,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Shield,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Activity,
  Download,
  Key,
  Award,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface UserData {
  id: number;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  approvalStatus: string;
  phoneNumber?: string;
  state?: string;
  city?: string;
  createdAt: string;
  lastActivity?: string;
  notaryType?: string;
  isAdmin?: boolean;
  isNotary?: boolean;
}

interface CertificateStatus {
  hasCertificate: boolean;
  certificate?: {
    id: string;
    certificateId: string;
    commonName: string;
    userRole: string;
    issuedAt: string;
    expiresAt: string;
    status: string;
    isExpired: boolean;
    downloadUrl: string;
  };
  error?: string;
}

export function AdminUsers() {
  const [, setLocation] = useLocation();
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [certificateStatus, setCertificateStatus] = useState<CertificateStatus | null>(null);
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsersData();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchCertificateStatus(selectedUser.id);
    } else {
      setCertificateStatus(null);
    }
  }, [selectedUser]);

  const fetchUsersData = async () => {
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
      console.log('📊 Raw user data from API:', users);
      
      // Map the API response to match our interface
      const mappedUsers = Array.isArray(users) ? users.map((user: any) => ({
        id: user.id,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || 'Unknown User',
        email: user.email || '',
        role: user.role || 'unknown',
        isActive: user.isActive !== false,
        approvalStatus: user.approvalStatus || (user.isActive ? 'approved' : 'pending'),
        phoneNumber: user.phoneNumber,
        state: user.state,
        city: user.city,
        createdAt: user.createdAt || new Date().toISOString(),
        lastActivity: user.lastLoginAt || user.lastActivity,
        notaryType: user.notaryType,
        isAdmin: user.isAdmin,
        isNotary: user.isNotary
      })) : [];
      
      console.log('👥 Mapped users:', mappedUsers);
      setAllUsers(mappedUsers);
    } catch (error) {
      console.error('Error fetching users data:', error);
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCertificateStatus = async (userId: number) => {
    // Only fetch certificate status for signers and witnesses
    const user = allUsers.find(u => u.id === userId);
    if (!user || !['signer', 'witness'].includes(user.role)) {
      setCertificateStatus({ hasCertificate: false, error: 'Self-signed certificates are only available for signers and witnesses' });
      return;
    }

    try {
      setCertificateLoading(true);
      const response = await fetch(`/api/admin/users/${userId}/certificate`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCertificateStatus(data);
      } else {
        const errorData = await response.json();
        setCertificateStatus({ hasCertificate: false, error: errorData.error || 'Failed to fetch certificate status' });
      }
    } catch (error) {
      console.error('Error fetching certificate status:', error);
      setCertificateStatus({ hasCertificate: false, error: 'Failed to fetch certificate status' });
    } finally {
      setCertificateLoading(false);
    }
  };

  const downloadCertificate = async (userId: number) => {
    try {
      // Check if current user is admin and if they're downloading their own cert
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const isAdmin = currentUser.role === 'admin' || (currentUser.privileges && currentUser.privileges.includes('admin'));
      const isOwnCertificate = currentUser.id === userId;
      
      // Use appropriate endpoint based on permissions
      let downloadUrl;
      if (isAdmin && !isOwnCertificate) {
        // Admin downloading another user's certificate
        downloadUrl = `/api/admin/users/${userId}/certificate/download`;
      } else {
        // User downloading their own certificate or admin downloading their own
        downloadUrl = `/api/user/certificate/download`;
      }
      
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `user-${userId}-certificate.pem`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const errorData = await response.json();
        if (errorData.error === 'Admin access required' && !isAdmin) {
          alert('You can only download your own certificate. Admin access is required to download other users\' certificates.');
        } else {
          alert(`Download failed: ${errorData.error}`);
        }
      }
    } catch (error) {
      console.error('Error downloading certificate:', error);
      alert('Failed to download certificate');
    }
  };

  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = (user.fullName || '').toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                         (user.email || '').toLowerCase().includes(userSearchTerm.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && user.isActive) ||
                         (statusFilter === 'inactive' && !user.isActive) ||
                         (statusFilter === 'pending' && user.approvalStatus === 'pending');
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getStatusColor = (user: UserData) => {
    if (user.approvalStatus === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (!user.isActive) return 'bg-red-100 text-red-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (user: UserData) => {
    if (user.approvalStatus === 'pending') return 'Pending';
    if (!user.isActive) return 'Inactive';
    return 'Active';
  };

  const getCertificateStatusIcon = () => {
    if (certificateLoading) {
      return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (!certificateStatus) {
      return <XCircle className="h-4 w-4 text-gray-400" />;
    }
    if (certificateStatus.error) {
      return <XCircle className="h-4 w-4 text-gray-400" />;
    }
    if (!certificateStatus.hasCertificate) {
      return <XCircle className="h-4 w-4 text-gray-400" />;
    }
    if (certificateStatus.certificate?.isExpired) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getCertificateStatusText = () => {
    if (certificateLoading) return 'Loading...';
    if (!certificateStatus) return 'Unknown';
    if (certificateStatus.error) return 'Not Available';
    if (!certificateStatus.hasCertificate) return 'No Certificate';
    if (certificateStatus.certificate?.isExpired) return 'Expired';
    return 'Valid';
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
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-2">Manage all system users and their permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Users className="h-3 w-3 mr-1" />
            {allUsers.length} users
          </Badge>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={userSearchTerm}
            onChange={(e) => setUserSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={userRoleFilter}
          onChange={(e) => setUserRoleFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="notary">Notary</option>
          <option value="title_company">Title Company</option>
          <option value="client">Client</option>
          <option value="signer">Signer</option>
          <option value="witness">Witness</option>
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
        {/* User List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System Users</CardTitle>
              <CardDescription>
                Showing {filteredUsers.length} of {allUsers.length} users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
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
                      className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedUser?.id === user.id
                          ? 'bg-blue-50 border-2 border-blue-200'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.fullName}</p>
                            <p className="text-sm text-gray-600">{user.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {user.role}
                              </Badge>
                              {user.notaryType && (
                                <Badge variant="secondary" className="text-xs">
                                  {user.notaryType}
                                </Badge>
                              )}
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${getStatusColor(user)}`}
                              >
                                {getStatusText(user)}
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
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">User Details</CardTitle>
              <CardDescription>
                {selectedUser ? `Details for ${selectedUser.fullName}` : 'Select a user to view details'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedUser ? (
                <div className="space-y-6">
                  {/* User Info */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <User className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{selectedUser.fullName}</h3>
                        <p className="text-sm text-gray-600">{selectedUser.email}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Shield className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Role:</span>
                        <Badge variant="outline">{selectedUser.role}</Badge>
                      </div>
                      
                      {selectedUser.phoneNumber && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Phone:</span>
                          <span className="text-gray-700">{selectedUser.phoneNumber}</span>
                        </div>
                      )}
                      
                      {selectedUser.state && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Location:</span>
                          <span className="text-gray-700">
                            {selectedUser.city && `${selectedUser.city}, `}{selectedUser.state}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Registered:</span>
                        <span className="text-gray-700">{new Date(selectedUser.createdAt).toLocaleDateString()}</span>
                      </div>
                      
                      {selectedUser.lastActivity && (
                        <div className="flex items-center gap-2 text-sm">
                          <Activity className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Last Activity:</span>
                          <span className="text-gray-700">{new Date(selectedUser.lastActivity).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Status:</span>
                      <Badge 
                        variant="secondary" 
                        className={getStatusColor(selectedUser)}
                      >
                        {getStatusText(selectedUser)}
                      </Badge>
                    </div>
                  </div>

                  {/* Certificate Information - NEW SECTION */}
                  {selectedUser && ['signer', 'witness'].includes(selectedUser.role) && (
                    <div className="border-t pt-6">
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Self-Signed Certificate
                      </h4>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          {getCertificateStatusIcon()}
                          <span className="font-medium">Status:</span>
                          <span className="text-gray-700">{getCertificateStatusText()}</span>
                        </div>
                        
                        {certificateStatus?.hasCertificate && certificateStatus.certificate && (
                          <>
                            <div className="text-sm space-y-2">
                              <div>
                                <span className="font-medium text-gray-600">Certificate ID:</span>
                                <span className="ml-2 text-gray-900 font-mono text-xs">
                                  {certificateStatus.certificate.certificateId}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-600">Common Name:</span>
                                <span className="ml-2 text-gray-900">
                                  {certificateStatus.certificate.commonName}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-600">Issued:</span>
                                <span className="ml-2 text-gray-900">
                                  {new Date(certificateStatus.certificate.issuedAt).toLocaleDateString()}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-600">Expires:</span>
                                <span className="ml-2 text-gray-900">
                                  {new Date(certificateStatus.certificate.expiresAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadCertificate(selectedUser.id)}
                              className="w-full"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download Certificate (.pem)
                            </Button>
                          </>
                        )}
                        
                        {certificateStatus?.error && (
                          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                            {certificateStatus.error}
                          </div>
                        )}
                        
                        {!certificateStatus?.hasCertificate && !certificateStatus?.error && !certificateLoading && (
                          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                            <p className="font-medium text-blue-900 mb-1">Certificate Not Generated</p>
                            <p className="text-blue-800">
                              This user needs to complete ID verification to automatically generate their self-signed certificate.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`mailto:${selectedUser.email}`, '_blank')}
                      className="w-full"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Contact User
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Select a user to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 