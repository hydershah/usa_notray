import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VerificationDataView } from './VerificationDataView';
import { VerificationManagement } from './VerificationManagement';
import { 
  Users, 
  Building2, 
  ClipboardList, 
  UserCheck, 
  Settings, 
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Activity,
  Zap,
  Shield,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Eye,
  Star,
  Award,
  Sparkles,
  Layers,
  Bell,
  Search,
  Filter
} from 'lucide-react';

interface PendingUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
  notaryType?: string;
  phoneNumber: string;
  createdAt: string;
  hasCommissionFile: boolean;
  hasEOInsurance: boolean;
  hasBond: boolean;
  hasPublicCertificate: boolean;
}

interface PendingCompany {
  id: number;
  companyName: string;
  primaryUserName: string;
  primaryUserEmail: string;
  contactName: string;
  email: string;
  phoneNumber?: string;
  address1: string;
  city: string;
  state: string;
  zipCode: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

interface ApprovedCompany {
  id: number;
  companyName: string;
  primaryUserName: string;
  primaryUserEmail: string;
  contactName: string;
  email: string;
  phoneNumber?: string;
  address1: string;
  city: string;
  state: string;
  zipCode: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  approvedAt: string;
  approvedBy: number;
  approvalNotes?: string;
}

interface DashboardStats {
  totalUsers: number;
  pendingApprovals: number;
  activeNotaries: number;
  totalCompanies: number;
  pendingCompanies: number;
  activeJobs: number;
  completedJobs: number;
  monthlyRevenue: number;
  pendingPayments: number;
}

interface UserData {
  id: number;
  username: string;
  email: string;
  role: string;
  isVerified?: boolean;
  verificationStatus?: string;
  createdAt: string;
  isActive: boolean;
}

export function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    pendingApprovals: 0,
    activeNotaries: 0,
    totalCompanies: 0,
    pendingCompanies: 0,
    activeJobs: 0,
    completedJobs: 0,
    monthlyRevenue: 0,
    pendingPayments: 0
  });
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [pendingCompanies, setPendingCompanies] = useState<PendingCompany[]>([]);
  const [approvedCompanies, setApprovedCompanies] = useState<ApprovedCompany[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // User verification management state
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [verificationStats, setVerificationStats] = useState<any>(null);

  useEffect(() => {
    fetchDashboardData();
    fetchVerificationStats();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Check if we have a token
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        // Redirect to login or show login form
        window.location.href = '/login';
        return;
      }
      
      // Fetch dashboard statistics
      const [usersRes, companiesRes, jobsRes, pendingRes, pendingCompaniesRes] = await Promise.all([
        fetch('/api/users', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/companies', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/jobs', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/admin/users/pending-approval', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/admin/companies/pending', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      // Check if any response failed with authentication error
      if (usersRes.status === 401 || companiesRes.status === 401 || jobsRes.status === 401 || 
          pendingRes.status === 401 || pendingCompaniesRes.status === 401) {
        console.error('Authentication failed - invalid or expired token');
        localStorage.removeItem('token'); // Clear invalid token
        window.location.href = '/login';
        return;
      }

      // Check if all responses are successful
      if (!usersRes.ok || !companiesRes.ok || !jobsRes.ok || !pendingRes.ok || !pendingCompaniesRes.ok) {
        throw new Error('One or more API requests failed');
      }

      const users = await usersRes.json();
      const companies = await companiesRes.json();
      const jobs = await jobsRes.json();
      const pending = await pendingRes.json();
      const pendingCompaniesData = await pendingCompaniesRes.json();

      // Ensure all data is arrays before processing
      const usersArray = Array.isArray(users) ? users : [];
      const companiesArray = Array.isArray(companies) ? companies : [];
      const jobsArray = Array.isArray(jobs) ? jobs : [];
      const pendingArray = Array.isArray(pending) ? pending : [];
      const pendingCompaniesArray = Array.isArray(pendingCompaniesData) ? pendingCompaniesData : [];

      // Set all users for user management
      setAllUsers(usersArray);

      // Calculate statistics
      const activeNotaries = usersArray.filter((user: any) => 
        user.role === 'notary' && user.isActive && user.approvalStatus === 'approved'
      ).length;

      const activeJobs = jobsArray.filter((job: any) => 
        ['open', 'pending', 'in_progress'].includes(job.jobStatus)
      ).length;

      const completedJobs = jobsArray.filter((job: any) => 
        job.jobStatus === 'completed'
      ).length;

      setStats({
        totalUsers: usersArray.length,
        pendingApprovals: pendingArray.length,
        activeNotaries,
        totalCompanies: companiesArray.length,
        pendingCompanies: pendingCompaniesArray.length,
        activeJobs,
        completedJobs,
        monthlyRevenue: 15750, // Mock data - TODO: Calculate from payments
        pendingPayments: 3 // Mock data - TODO: Calculate from payments
      });

      setPendingUsers(pendingArray);
      setPendingCompanies(pendingCompaniesArray);
      // Filter out pending and rejected companies to show only approved ones
      setApprovedCompanies(companiesArray.filter((company: any) => company.status === 'active' || company.status === 'inactive'));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Set empty arrays to prevent filter errors
      setAllUsers([]);
      setPendingUsers([]);
      setPendingCompanies([]);
      setApprovedCompanies([]);
      setStats({
        totalUsers: 0,
        pendingApprovals: 0,
        activeNotaries: 0,
        totalCompanies: 0,
        pendingCompanies: 0,
        activeJobs: 0,
        completedJobs: 0,
        monthlyRevenue: 0,
        pendingPayments: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchVerificationStats = async () => {
    try {
      const response = await fetch('/api/admin/verification-stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const stats = await response.json();
        setVerificationStats(stats);
      }
    } catch (error) {
      console.error('Error fetching verification stats:', error);
    }
  };

  const handleManualVerificationAction = async (userId: number, action: 'approve' | 'reject', notes?: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/verification-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ action, notes })
      });

      if (response.ok) {
        // Refresh user data
        await fetchDashboardData();
        await fetchVerificationStats();
        
        // Update selected user if it's the same one
        if (selectedUser?.id === userId) {
          const updatedUser = allUsers.find(u => u.id === userId);
          if (updatedUser) {
            setSelectedUser(updatedUser);
          }
        }
      }
    } catch (error) {
      console.error('Error performing manual verification action:', error);
    }
  };

  const approveUser = async (userId: number) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notes: 'Approved by admin dashboard' })
      });

      if (response.ok) {
        fetchDashboardData(); // Refresh data
      }
    } catch (error) {
      console.error('Error approving user:', error);
    }
  };

  const rejectUser = async (userId: number, reason: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notes: reason })
      });

      if (response.ok) {
        fetchDashboardData(); // Refresh data
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
    }
  };

  const approveCompany = async (companyId: number) => {
    try {
      const response = await fetch(`/api/admin/companies/${companyId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notes: 'Approved by admin dashboard' })
      });

      if (response.ok) {
        fetchDashboardData(); // Refresh data
      }
    } catch (error) {
      console.error('Error approving company:', error);
    }
  };

  const rejectCompany = async (companyId: number, reason: string) => {
    try {
      const response = await fetch(`/api/admin/companies/${companyId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reason: reason })
      });

      if (response.ok) {
        fetchDashboardData(); // Refresh data
      }
    } catch (error) {
      console.error('Error rejecting company:', error);
    }
  };

  const activateCompany = async (companyId: number) => {
    try {
      const response = await fetch(`/api/companies/${companyId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: 'active' })
      });

      if (response.ok) {
        fetchDashboardData(); // Refresh data
      }
    } catch (error) {
      console.error('Error activating company:', error);
    }
  };

  const deactivateCompany = async (companyId: number) => {
    try {
      const response = await fetch(`/api/companies/${companyId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: 'inactive' })
      });

      if (response.ok) {
        fetchDashboardData(); // Refresh data
      }
    } catch (error) {
      console.error('Error deactivating company:', error);
    }
  };

  // Filter users based on search term and role
  const filteredUsers = Array.isArray(allUsers) ? allUsers.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(userSearchTerm.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter;
    return matchesSearch && matchesRole;
  }) : [];

  const StatCard = ({ title, value, icon: Icon, description, trend, trendDirection, color = "blue" }: any) => {
    const colorClasses = {
      blue: "from-blue-500 to-blue-600 text-blue-600 bg-blue-50",
      green: "from-green-500 to-green-600 text-green-600 bg-green-50",
      purple: "from-purple-500 to-purple-600 text-purple-600 bg-purple-50",
      orange: "from-orange-500 to-orange-600 text-orange-600 bg-orange-50",
      red: "from-red-500 to-red-600 text-red-600 bg-red-50",
      indigo: "from-indigo-500 to-indigo-600 text-indigo-600 bg-indigo-50"
    };

    return (
      <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-gray-900">{value}</p>
                {trend && (
                  <div className={`flex items-center text-sm font-medium ${
                    trendDirection === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {trendDirection === 'up' ? 
                      <ArrowUpRight className="h-4 w-4 mr-1" /> : 
                      <ArrowDownRight className="h-4 w-4 mr-1" />
                    }
                    {trend}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">{description}</p>
            </div>
            <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color].split(' ')[0]} ${colorClasses[color].split(' ')[1]} shadow-lg`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </CardContent>
        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${colorClasses[color].split(' ')[0]} ${colorClasses[color].split(' ')[1]}`} />
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-400 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <p className="mt-6 text-gray-600 font-medium">Loading admin dashboard...</p>
          <p className="text-sm text-gray-400">Setting up your control panel</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-500">
      {/* Enhanced Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 rounded-2xl opacity-10"></div>
        <div className="relative bg-white rounded-2xl border border-gray-200 shadow-lg p-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    USA Notary Dashboard
                  </h1>
                  <p className="text-gray-600 font-medium">Administrator Control Panel</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Activity className="h-4 w-4" />
                  <span>System Status: Active</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="h-4 w-4" />
                  <span>Last Updated: Just now</span>
                </div>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">All systems operational</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: FileText, label: 'Start New Signing', path: '/create-job', color: 'from-blue-500 to-blue-600', bgColor: 'hover:bg-blue-50' },
          { icon: ClipboardList, label: 'Pending Jobs', path: '/jobs', color: 'from-amber-500 to-orange-500', bgColor: 'hover:bg-amber-50' },
          { icon: Building2, label: 'Company Management', action: () => setActiveTab('companies'), color: 'from-purple-500 to-purple-600', bgColor: 'hover:bg-purple-50' },
          { icon: Users, label: 'User Manager', action: () => setActiveTab('users'), color: 'from-green-500 to-green-600', bgColor: 'hover:bg-green-50' }
        ].map((action, index) => (
          <Button
            key={index}
            onClick={action.path ? () => setLocation(action.path) : action.action}
            className={`h-24 flex flex-col items-center justify-center bg-white border border-gray-200 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${action.bgColor} text-gray-700 hover:text-gray-900`}
            variant="outline"
          >
            <div className={`p-2 rounded-lg bg-gradient-to-br ${action.color} shadow-lg mb-2`}>
              <action.icon className="h-5 w-5 text-white" />
            </div>
            <span className="text-sm font-medium text-center">{action.label}</span>
          </Button>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7 h-14 bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 border rounded-lg p-1 shadow-md">
          <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white hover:bg-blue-100">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white hover:bg-orange-100">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Approvals</span>
          </TabsTrigger>
          <TabsTrigger value="verification" className="flex items-center gap-2 data-[state=active]:bg-green-500 data-[state=active]:text-white hover:bg-green-100">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">KYC/KBA</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white hover:bg-purple-100">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="companies" className="flex items-center gap-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white hover:bg-indigo-100">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Companies</span>
          </TabsTrigger>
          <TabsTrigger value="notaries" className="flex items-center gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white hover:bg-amber-100">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Notaries</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2 data-[state=active]:bg-gray-500 data-[state=active]:text-white hover:bg-gray-100">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        {/* Enhanced Overview Tab */}
        <TabsContent value="overview" className="space-y-8 mt-8">
          {/* Statistics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Users"
              value={stats.totalUsers.toLocaleString()}
              icon={Users}
              description="All registered users"
              trend="+12.5%"
              trendDirection="up"
              color="blue"
            />
            <StatCard
              title="Pending Approvals"
              value={stats.pendingApprovals}
              icon={AlertCircle}
              description="Users awaiting approval"
              trend={stats.pendingApprovals > 5 ? "High" : "Normal"}
              trendDirection={stats.pendingApprovals > 5 ? "up" : "down"}
              color={stats.pendingApprovals > 5 ? "red" : "green"}
            />
            <StatCard
              title="Active Notaries"
              value={stats.activeNotaries}
              icon={UserCheck}
              description="Approved and active notaries"
              trend="+8.2%"
              trendDirection="up"
              color="green"
            />
            <StatCard
              title="Companies"
              value={stats.totalCompanies}
              icon={Building2}
              description="Registered companies"
              trend="+5.1%"
              trendDirection="up"
              color="purple"
            />
            <StatCard
              title="Pending Companies"
              value={stats.pendingCompanies}
              icon={AlertCircle}
              description="Companies awaiting approval"
              trend={stats.pendingCompanies > 2 ? "High" : "Normal"}
              trendDirection={stats.pendingCompanies > 2 ? "up" : "down"}
              color={stats.pendingCompanies > 2 ? "red" : "green"}
            />
            <StatCard
              title="Active Jobs"
              value={stats.activeJobs}
              icon={Clock}
              description="Jobs in progress"
              trend="+15.3%"
              trendDirection="up"
              color="orange"
            />
            <StatCard
              title="Completed Jobs"
              value={stats.completedJobs}
              icon={CheckCircle}
              description="Successfully completed"
              trend="+22.7%"
              trendDirection="up"
              color="green"
            />
            <StatCard
              title="Monthly Revenue"
              value={`$${stats.monthlyRevenue.toLocaleString()}`}
              icon={DollarSign}
              description="This month"
              trend="+18.5%"
              trendDirection="up"
              color="indigo"
            />
            <StatCard
              title="Pending Payments"
              value={stats.pendingPayments}
              icon={AlertCircle}
              description="Payments to process"
              trend={stats.pendingPayments > 5 ? "+2" : "Normal"}
              trendDirection={stats.pendingPayments > 5 ? "up" : "down"}
              color={stats.pendingPayments > 5 ? "red" : "green"}
            />
          </div>

          {/* Enhanced Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-blue-600" />
                      Recent Activity
                    </CardTitle>
                    <CardDescription>Latest system activities and user actions</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { action: "New user registration", user: "john.doe@email.com", time: "2 minutes ago", type: "user" },
                    { action: "Job completed", user: "Job #1234", time: "15 minutes ago", type: "success" },
                    { action: "Company registration", user: "ABC Title Corp", time: "1 hour ago", type: "company" },
                    { action: "Notary approved", user: "Jane Smith", time: "2 hours ago", type: "approval" }
                  ].map((activity, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 bg-white rounded-lg border border-gray-100 hover:shadow-md transition-all duration-200">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.type === 'success' ? 'bg-green-400' :
                        activity.type === 'approval' ? 'bg-blue-400' :
                        activity.type === 'company' ? 'bg-purple-400' : 'bg-gray-400'
                      } animate-pulse`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                        <p className="text-xs text-gray-600">{activity.user}</p>
                      </div>
                      <span className="text-xs text-gray-400">{activity.time}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      System Alerts
                    </CardTitle>
                    <CardDescription>Important notifications and warnings</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    Manage
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.pendingApprovals > 0 && (
                    <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-900">
                          {stats.pendingApprovals} users awaiting approval
                        </p>
                        <p className="text-xs text-amber-700">Review pending registrations</p>
                      </div>
                    </div>
                  )}
                  {stats.pendingCompanies > 0 && (
                    <div className="flex items-start gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <Building2 className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-purple-900">
                          {stats.pendingCompanies} companies awaiting approval
                        </p>
                        <p className="text-xs text-purple-700">Review company registrations</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-900">System backup completed</p>
                      <p className="text-xs text-green-700">Last backup: Today at 3:00 AM</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Server performance optimal</p>
                      <p className="text-xs text-blue-700">99.9% uptime this month</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Enhanced Approvals Tab */}
        <TabsContent value="approvals" className="space-y-8 mt-8">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg shadow-lg">
                      <UserCheck className="h-6 w-6 text-white" />
                    </div>
                    User Approvals
                  </CardTitle>
                  <CardDescription className="mt-2 text-base">
                    Review and approve pending user registrations, especially notaries
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                    {pendingUsers.length} Pending
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => fetchDashboardData()}
                  >
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {pendingUsers.length > 0 ? (
                  pendingUsers.map((user) => (
                    <div key={user.id} className="relative bg-white p-6 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                              <span className="text-white font-semibold text-lg">
                                {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{user.fullName}</h3>
                              <p className="text-gray-600">{user.email}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge 
                                  className={`${user.role === 'notary' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-gray-100 text-gray-800 border-gray-200'}`}
                                >
                                  {user.role}
                                </Badge>
                                {user.notaryType && (
                                  <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                                    {user.notaryType}
                                  </Badge>
                                )}
                                <span className="text-xs text-gray-500">
                                  Applied: {new Date(user.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Enhanced Document Status for Notaries */}
                          {user.role === 'notary' && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-4">
                              <h4 className="text-sm font-medium text-gray-700 mb-3">Document Verification Status</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                  { label: 'Commission', status: user.hasCommissionFile },
                                  { label: 'E&O Insurance', status: user.hasEOInsurance },
                                  { label: 'Bond', status: user.hasBond },
                                  { label: 'Certificate', status: user.hasPublicCertificate }
                                ].map((doc, index) => (
                                  <div key={index} className={`flex items-center gap-2 text-xs font-medium p-2 rounded-lg ${
                                    doc.status 
                                      ? 'bg-green-100 text-green-800 border border-green-200' 
                                      : 'bg-red-100 text-red-800 border border-red-200'
                                  }`}>
                                    {doc.status ? (
                                      <CheckCircle className="h-4 w-4" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4" />
                                    )}
                                    <span>{doc.label}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 ml-6">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setLocation(`/user-management`)}
                            className="hover:bg-blue-50 hover:border-blue-300"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Review Details
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => approveUser(user.id)}
                            className="bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => {
                              const reason = prompt('Please provide a reason for rejection:');
                              if (reason) rejectUser(user.id, reason);
                            }}
                            className="hover:bg-red-700 shadow-md hover:shadow-lg transition-all duration-200"
                          >
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16">
                    <div className="relative">
                      <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <CheckCircle className="h-10 w-10 text-white" />
                      </div>
                      <div className="absolute -top-2 -right-8 w-4 h-4 bg-green-300 rounded-full animate-pulse"></div>
                      <div className="absolute -bottom-2 -left-6 w-3 h-3 bg-green-200 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">All caught up!</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                      No pending user approvals at this time. New registrations will appear here for review.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* KYC/KBA Verification Management Tab */}
        <TabsContent value="verification" className="space-y-8 mt-8">
          <VerificationManagement />
        </TabsContent>

        {/* Enhanced Users Tab */}
        <TabsContent value="users" className="space-y-8 mt-8">
          {/* Verification Statistics */}
          {verificationStats && verificationStats.users && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Required</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {verificationStats.users.total_required_users || verificationStats.users.total_users || 0}
                      </p>
                    </div>
                    <Shield className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Verified</p>
                      <p className="text-2xl font-bold text-green-600">
                        {verificationStats.users.verified_users || 0}
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Pending</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {verificationStats.users.pending_users || 0}
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Failed</p>
                      <p className="text-2xl font-bold text-red-600">
                        {verificationStats.users.failed_users || 0}
                      </p>
                    </div>
                    <AlertCircle className="h-8 w-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* User List */}
            <div className="lg:col-span-2">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
                <CardHeader className="pb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                        User Management
                      </CardTitle>
                      <CardDescription className="mt-2 text-base">
                        Manage users and their verification status
                      </CardDescription>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                      {filteredUsers.length} of {allUsers.length} users
                    </Badge>
                  </div>
                  
                  {/* Search and Filter Controls */}
                  <div className="flex flex-col sm:flex-row gap-4 mt-6">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <select
                        value={userRoleFilter}
                        onChange={(e) => setUserRoleFilter(e.target.value)}
                        className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        <option value="all">All Roles</option>
                        <option value="signer">Signers</option>
                        <option value="witness">Witnesses</option>
                        <option value="notary">Notaries</option>
                        <option value="admin">Admins</option>
                        <option value="client">Clients</option>
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {filteredUsers.map((user) => (
                      <div 
                        key={user.id} 
                        className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                          selectedUser?.id === user.id 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedUser(user)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                              user.role === 'signer' ? 'bg-blue-500' :
                              user.role === 'witness' ? 'bg-green-500' :
                              user.role === 'notary' ? 'bg-purple-500' :
                              user.role === 'admin' ? 'bg-red-500' : 'bg-gray-500'
                            }`}>
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{user.username}</h4>
                              <p className="text-sm text-gray-600">{user.email}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Badge className={`text-xs ${
                              user.role === 'signer' ? 'bg-blue-100 text-blue-800' :
                              user.role === 'witness' ? 'bg-green-100 text-green-800' :
                              user.role === 'notary' ? 'bg-purple-100 text-purple-800' :
                              user.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role}
                            </Badge>
                            
                            {(user.role === 'signer' || user.role === 'witness') && (
                              <Badge className={`text-xs ${
                                user.isVerified ? 'bg-green-100 text-green-800 border-green-300' :
                                user.verificationStatus === 'pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                'bg-red-100 text-red-800 border-red-300'
                              }`}>
                                {user.isVerified ? 'Verified' : 
                                 user.verificationStatus === 'pending' ? 'Pending' : 'Not Verified'}
                              </Badge>
                            )}
                            
                            <Badge className={`text-xs ${
                              user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {filteredUsers.length === 0 && (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No users match your search criteria.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* User Detail Panel */}
            <div className="lg:col-span-1">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
                <CardHeader className="pb-6">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg">
                      <Eye className="h-6 w-6 text-white" />
                    </div>
                    User Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedUser ? (
                    <div className="space-y-6">
                      {/* User Basic Info */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Basic Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Username:</span>
                            <span className="font-medium">{selectedUser.username}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Email:</span>
                            <span className="font-medium">{selectedUser.email}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Role:</span>
                            <Badge className="text-xs">{selectedUser.role}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Status:</span>
                            <Badge className={`text-xs ${
                              selectedUser.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {selectedUser.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Created:</span>
                            <span className="font-medium text-xs">
                              {new Date(selectedUser.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Manual Verification Actions for Signers/Witnesses */}
                      {(selectedUser.role === 'signer' || selectedUser.role === 'witness') && 
                       !selectedUser.isVerified && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3">Manual Verification</h4>
                          <div className="space-y-2">
                            <Button
                              size="sm"
                              onClick={() => handleManualVerificationAction(selectedUser.id, 'approve', 'Manually approved by admin')}
                              className="w-full bg-green-600 hover:bg-green-700 text-white"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve Verification
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                const reason = prompt('Please provide a reason for rejection:');
                                if (reason) {
                                  handleManualVerificationAction(selectedUser.id, 'reject', reason);
                                }
                              }}
                              className="w-full"
                            >
                              <AlertCircle className="h-4 w-4 mr-2" />
                              Reject Verification
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation('/user-management')}
                          className="w-full"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Manage User
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

          {/* Verification Data View */}
          {selectedUser && (selectedUser.role === 'signer' || selectedUser.role === 'witness') && (
            <div className="mt-8">
              <VerificationDataView 
                userId={selectedUser.id} 
                userRole={selectedUser.role} 
                className="w-full"
              />
            </div>
          )}
        </TabsContent>

        {/* Enhanced Companies Tab */}
        <TabsContent value="companies" className="space-y-8 mt-8">
          {/* Pending Company Approvals */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg shadow-lg">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    Pending Company Approvals
                  </CardTitle>
                  <CardDescription className="mt-2 text-base">
                    Review and approve company registration applications
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                    {pendingCompanies.length} Pending
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => fetchDashboardData()}
                  >
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {pendingCompanies.length > 0 ? (
                  pendingCompanies.map((company) => (
                    <div key={company.id} className="relative bg-white p-6 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                              <Building2 className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{company.companyName}</h3>
                              <p className="text-gray-600">{company.email}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                                  {company.paymentMethod}
                                </Badge>
                                <span className="text-xs text-gray-500">
                                  Applied: {new Date(company.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Company Details */}
                          <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-3">Company Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="font-medium text-gray-600">Primary Contact:</span>
                                <p className="text-gray-900">{company.primaryUserName}</p>
                                <p className="text-gray-600">{company.primaryUserEmail}</p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-600">Business Contact:</span>
                                <p className="text-gray-900">{company.contactName}</p>
                                {company.phoneNumber && <p className="text-gray-600">{company.phoneNumber}</p>}
                              </div>
                              <div>
                                <span className="font-medium text-gray-600">Address:</span>
                                <p className="text-gray-900">{company.address1}</p>
                                <p className="text-gray-600">{company.city}, {company.state} {company.zipCode}</p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-600">Payment Method:</span>
                                <p className="text-gray-900 capitalize">{company.paymentMethod.replace('_', ' ')}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 ml-6">
                          <Button 
                            size="sm"
                            onClick={() => approveCompany(company.id)}
                            className="bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => {
                              const reason = prompt('Please provide a reason for rejection:');
                              if (reason) rejectCompany(company.id, reason);
                            }}
                            className="hover:bg-red-700 shadow-md hover:shadow-lg transition-all duration-200"
                          >
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16">
                    <div className="relative">
                      <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <CheckCircle className="h-10 w-10 text-white" />
                      </div>
                      <div className="absolute -top-2 -right-8 w-4 h-4 bg-green-300 rounded-full animate-pulse"></div>
                      <div className="absolute -bottom-2 -left-6 w-3 h-3 bg-green-200 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">All companies approved!</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                      No pending company registrations at this time. New applications will appear here for review.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Approved Companies Management */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    Approved Companies Management
                  </CardTitle>
                  <CardDescription className="mt-2 text-base">
                    Manage active and inactive approved companies
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    {approvedCompanies.filter(c => c.status === 'active').length} Active
                  </Badge>
                  <Badge className="bg-gray-100 text-gray-800 border-gray-200">
                    {approvedCompanies.filter(c => c.status === 'inactive').length} Inactive
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => fetchDashboardData()}
                  >
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {approvedCompanies.length > 0 ? (
                  approvedCompanies.map((company) => (
                    <div key={company.id} className="relative bg-white p-6 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${
                              company.status === 'active' 
                                ? 'bg-gradient-to-br from-green-500 to-green-600' 
                                : 'bg-gradient-to-br from-gray-500 to-gray-600'
                            }`}>
                              <Building2 className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold text-gray-900">{company.companyName}</h3>
                                <Badge className={`${
                                  company.status === 'active' 
                                    ? 'bg-green-100 text-green-800 border-green-200' 
                                    : 'bg-gray-100 text-gray-800 border-gray-200'
                                }`}>
                                  {company.status.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="text-gray-600">{company.email}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                                  {company.paymentMethod}
                                </Badge>
                                <span className="text-xs text-gray-500">
                                  Approved: {new Date(company.approvedAt || company.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Company Details */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-3">Company Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                              <div>
                                <span className="font-medium text-gray-600">Primary Contact:</span>
                                <p className="text-gray-900">{company.primaryUserName}</p>
                                <p className="text-gray-600">{company.primaryUserEmail}</p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-600">Business Contact:</span>
                                <p className="text-gray-900">{company.contactName}</p>
                                {company.phoneNumber && <p className="text-gray-600">{company.phoneNumber}</p>}
                              </div>
                              <div>
                                <span className="font-medium text-gray-600">Address:</span>
                                <p className="text-gray-900">{company.address1}</p>
                                <p className="text-gray-600">{company.city}, {company.state} {company.zipCode}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 ml-6">
                          {company.status === 'active' ? (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                if (confirm(`Are you sure you want to deactivate ${company.companyName}? This will prevent them from using the system.`)) {
                                  deactivateCompany(company.id);
                                }
                              }}
                              className="hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                            >
                              <AlertCircle className="h-4 w-4 mr-2" />
                              Deactivate
                            </Button>
                          ) : (
                            <Button 
                              size="sm"
                              onClick={() => {
                                if (confirm(`Are you sure you want to activate ${company.companyName}? This will allow them to use the system again.`)) {
                                  activateCompany(company.id);
                                }
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Activate
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setLocation(`/title-companies`)}
                            className="hover:bg-blue-50 hover:border-blue-300"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16">
                    <div className="relative">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <Building2 className="h-10 w-10 text-white" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No approved companies yet</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                      Approved companies will appear here for ongoing management.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Company Management Actions */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-purple-600">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    Company Management
                  </CardTitle>
                  <CardDescription className="mt-2 text-base">
                    Manage registered companies and their settings
                  </CardDescription>
                </div>
                <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                  {stats.totalCompanies} Companies
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { 
                    icon: Plus, 
                    title: 'Register Company', 
                    description: 'Add new title companies to the platform',
                    color: 'from-purple-500 to-purple-600',
                    bgColor: 'hover:bg-purple-50',
                    path: '/title-companies'
                  },
                  { 
                    icon: Building2, 
                    title: 'View All Companies', 
                    description: 'Browse and manage registered companies',
                    color: 'from-indigo-500 to-indigo-600',
                    bgColor: 'hover:bg-indigo-50',
                    path: '/title-companies'
                  },
                  { 
                    icon: Settings, 
                    title: 'Company Settings', 
                    description: 'Configure company-specific settings',
                    color: 'from-gray-500 to-gray-600',
                    bgColor: 'hover:bg-gray-50',
                    path: '/title-companies'
                  }
                ].map((action, index) => (
                  <Card key={index} className="border border-gray-200 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group">
                    <CardContent className="p-6">
                      <div className="text-center">
                        <div className={`mx-auto mb-4 w-16 h-16 bg-gradient-to-br ${action.color} rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300`}>
                          <action.icon className="h-8 w-8 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{action.title}</h3>
                        <p className="text-sm text-gray-600 mb-4">{action.description}</p>
                        <Button 
                          onClick={() => setLocation(action.path)}
                          className={`w-full ${action.bgColor} border-gray-200 hover:border-gray-300 transition-all duration-200`}
                          variant="outline"
                        >
                          Get Started
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Enhanced Notaries Tab */}
        <TabsContent value="notaries" className="space-y-8 mt-8">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg shadow-lg">
                      <Award className="h-6 w-6 text-white" />
                    </div>
                    Notary Management
                  </CardTitle>
                  <CardDescription className="mt-2 text-base">
                    Manage notary assignments and qualifications
                  </CardDescription>
                </div>
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                  {stats.activeNotaries} Active Notaries
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { 
                    icon: UserCheck, 
                    title: 'Assignment Options', 
                    description: 'Configure notary assignment preferences',
                    color: 'from-green-500 to-green-600',
                    bgColor: 'hover:bg-green-50',
                    path: '/notary-management'
                  },
                  { 
                    icon: Star, 
                    title: 'Qualifications', 
                    description: 'Manage notary qualifications and certifications',
                    color: 'from-blue-500 to-blue-600',
                    bgColor: 'hover:bg-blue-50',
                    path: '/notary-management'
                  },
                  { 
                    icon: Sparkles, 
                    title: 'Random Assignment', 
                    description: 'Configure automatic notary assignment',
                    color: 'from-purple-500 to-purple-600',
                    bgColor: 'hover:bg-purple-50',
                    path: '/notary-management'
                  }
                ].map((action, index) => (
                  <Card key={index} className="border border-gray-200 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group">
                    <CardContent className="p-6">
                      <div className="text-center">
                        <div className={`mx-auto mb-4 w-16 h-16 bg-gradient-to-br ${action.color} rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300`}>
                          <action.icon className="h-8 w-8 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{action.title}</h3>
                        <p className="text-sm text-gray-600 mb-4">{action.description}</p>
                        <Button 
                          onClick={() => setLocation(action.path)}
                          className={`w-full ${action.bgColor} border-gray-200 hover:border-gray-300 transition-all duration-200`}
                          variant="outline"
                        >
                          Get Started
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Enhanced Settings Tab */}
        <TabsContent value="settings" className="space-y-8 mt-8">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg shadow-lg">
                      <Settings className="h-6 w-6 text-white" />
                    </div>
                    System Settings
                  </CardTitle>
                  <CardDescription className="mt-2 text-base">
                    Configure system-wide settings and preferences
                  </CardDescription>
                </div>
                <Badge className="bg-gray-100 text-gray-800 border-gray-200">
                  Configuration
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Services Column */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg">
                      <Layers className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Services</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: 'Configure Closing Types', icon: FileText, path: '/closing-types' },
                      { label: 'Payment Settings', icon: DollarSign, path: '/payments' },
                      { label: 'Email Templates', icon: FileText, path: '/email-templates' },
                      { label: 'Notification Settings', icon: Bell, path: '/email-settings' }
                    ].map((setting, index) => (
                      <Card key={index} className="border border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer group">
                        <CardContent className="p-4">
                          <Button 
                            onClick={() => setLocation(setting.path)}
                            className="w-full justify-start h-auto p-0 bg-transparent hover:bg-transparent text-gray-700 hover:text-gray-900 group-hover:translate-x-1 transition-all duration-200"
                            variant="ghost"
                          >
                            <setting.icon className="h-5 w-5 mr-3 text-gray-500 group-hover:text-blue-600 transition-colors duration-200" />
                            <span className="text-sm font-medium">{setting.label}</span>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Account Management Column */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Account Management</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: 'System Backup', icon: Shield, description: 'Backup system data' },
                      { label: 'Audit Logs', icon: ClipboardList, description: 'View system logs' },
                      { label: 'Security Settings', icon: AlertCircle, description: 'Configure security' },
                      { label: 'User Permissions', icon: Users, description: 'Manage permissions' }
                    ].map((setting, index) => (
                      <Card key={index} className="border border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer group">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <setting.icon className="h-5 w-5 text-gray-500 group-hover:text-purple-600 transition-colors duration-200" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{setting.label}</p>
                                <p className="text-xs text-gray-500">{setting.description}</p>
                              </div>
                            </div>
                            <Button size="sm" variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              Configure
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 