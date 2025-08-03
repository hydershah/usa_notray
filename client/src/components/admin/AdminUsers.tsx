import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserDetailsModal } from './UserDetailsModal';
import { 
  Users, 
  UserCheck, 
  UserX,
  Search,
  Filter,
  Eye,
  Mail,
  MoreHorizontal,
  Plus,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle
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

interface UserStats {
  total: number;
  active: number;
  pending: number;
  inactive: number;
}

// Stats Cards Component
const UserStatsCards: React.FC<{ stats: UserStats; loading: boolean }> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
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
    { label: 'Total Users', value: stats.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Active', value: stats.active, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Pending', value: stats.pending, icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    { label: 'Inactive', value: stats.inactive, icon: UserX, color: 'text-red-600', bg: 'bg-red-100' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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

// User Filters Component
const UserFilters: React.FC<{
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  roleFilter: string;
  setRoleFilter: (role: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  onRefresh: () => void;
  loading: boolean;
}> = ({ searchTerm, setSearchTerm, roleFilter, setRoleFilter, statusFilter, setStatusFilter, onRefresh, loading }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      <select
        value={roleFilter}
        onChange={(e) => setRoleFilter(e.target.value)}
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

// User Table Component
const UserTable: React.FC<{
  users: UserData[];
  loading: boolean;
  onViewUser: (user: UserData) => void;
  onEmailUser: (user: UserData) => void;
}> = ({ users, loading, onViewUser, onEmailUser }) => {
  const getStatusBadge = (user: UserData) => {
    if (user.approvalStatus === 'pending') {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
    if (!user.isActive) {
      return <Badge variant="secondary" className="bg-red-100 text-red-800">Inactive</Badge>;
    }
    return <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800',
      notary: 'bg-blue-100 text-blue-800',
      title_company: 'bg-indigo-100 text-indigo-800',
      client: 'bg-gray-100 text-gray-800',
      signer: 'bg-green-100 text-green-800',
      witness: 'bg-orange-100 text-orange-800'
    };
    return (
      <Badge variant="outline" className={colors[role] || 'bg-gray-100 text-gray-800'}>
        {role.replace('_', ' ')}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg animate-pulse">
                <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-3 bg-gray-200 rounded w-48"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
                <div className="h-6 bg-gray-200 rounded w-12"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users ({users.length})</CardTitle>
        <CardDescription>Manage and view all system users</CardDescription>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No users found</p>
            <p className="text-gray-400 text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium text-sm">
                      {user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{user.fullName}</p>
                    <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      {getRoleBadge(user.role)}
                      {user.notaryType && (
                        <Badge variant="outline" className="text-xs">{user.notaryType}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    {getStatusBadge(user)}
                    {user.lastActivity && (
                      <p className="text-xs text-gray-400 mt-1">
                        Last active: {new Date(user.lastActivity).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewUser(user)}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEmailUser(user)}
                      className="h-8 w-8 p-0"
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export function AdminUsers() {
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isUserDetailsModalOpen, setIsUserDetailsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for URL parameters to set initial filters
    const urlParams = new URLSearchParams(window.location.search);
    const filterParam = urlParams.get('filter');
    if (filterParam === 'pending') {
      setStatusFilter('pending');
    }
    
    fetchUsersData();
  }, []);

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
      
      setAllUsers(mappedUsers);
    } catch (error) {
      console.error('Error fetching users data:', error);
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = (user.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && user.isActive) ||
                         (statusFilter === 'inactive' && !user.isActive) ||
                         (statusFilter === 'pending' && user.approvalStatus === 'pending');
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const userStats: UserStats = {
    total: allUsers.length,
    active: allUsers.filter(u => u.isActive).length,
    pending: allUsers.filter(u => u.approvalStatus === 'pending').length,
    inactive: allUsers.filter(u => !u.isActive).length
  };

  const handleViewUser = (user: UserData) => {
    setSelectedUser(user);
    setIsUserDetailsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsUserDetailsModalOpen(false);
    setSelectedUser(null);
  };

  const handleEmailUser = (user: UserData) => {
    window.open(`mailto:${user.email}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage all system users and their permissions</p>
        </div>
      </div>

      {/* Stats Cards */}
      <UserStatsCards stats={userStats} loading={loading} />

      {/* Filters */}
      <UserFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onRefresh={fetchUsersData}
        loading={loading}
      />

      {/* User Table */}
      <UserTable
        users={filteredUsers}
        loading={loading}
        onViewUser={handleViewUser}
        onEmailUser={handleEmailUser}
      />

      {/* User Details Modal */}
      <UserDetailsModal
        user={selectedUser}
        isOpen={isUserDetailsModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
} 