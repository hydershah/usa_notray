import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Filter,
  XCircle
} from 'lucide-react';

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
  // Job Request Statistics
  totalJobRequests: number;
  pendingJobRequests: number;
  approvedJobRequests: number;
  rejectedJobRequests: number;
  assignedJobRequests: number;
}

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
  contactEmail: string;
  status: string;
  createdAt: string;
  licenseNumber?: string;
  state?: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
  description: string;
  trend?: string;
  trendDirection?: 'up' | 'down';
  color?: string;
}

function StatCard({ title, value, icon: Icon, description, trend, trendDirection, color = 'blue' }: StatCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
    indigo: 'from-indigo-500 to-indigo-600'
  };

  return (
    <Card className="border border-gray-200 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue} rounded-xl shadow-lg`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              trendDirection === 'up' 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {trendDirection === 'up' ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {trend}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminOverview() {
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    pendingApprovals: 0,
    activeNotaries: 0,
    totalCompanies: 0,
    pendingCompanies: 0,
    activeJobs: 0,
    completedJobs: 0,
    monthlyRevenue: 0,
    pendingPayments: 0,
    // Job Request Statistics
    totalJobRequests: 0,
    pendingJobRequests: 0,
    approvedJobRequests: 0,
    rejectedJobRequests: 0,
    assignedJobRequests: 0
  });
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [pendingCompanies, setPendingCompanies] = useState<PendingCompany[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all required data
      const [usersRes, companiesRes, jobsRes, pendingRes, pendingCompaniesRes, revenueRes, jobRequestsRes] = await Promise.all([
        fetch('/api/users', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/companies', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/jobs', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/admin/users/pending-approval', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/admin/companies/pending', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/admin/revenue-stats', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/job-requests', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      const users = await usersRes.json();
      const companies = await companiesRes.json();
      const jobs = await jobsRes.json();
      const pending = await pendingRes.json();
      const pendingCompaniesData = await pendingCompaniesRes.json();
      const revenueData = await revenueRes.json();
      const jobRequestsData = await jobRequestsRes.json();

      // Ensure all data is arrays before processing
      const usersArray = Array.isArray(users) ? users : [];
      const companiesArray = Array.isArray(companies) ? companies : [];
      const jobsArray = Array.isArray(jobs) ? jobs : [];
      const pendingArray = Array.isArray(pending) ? pending : [];
      const pendingCompaniesArray = Array.isArray(pendingCompaniesData) ? pendingCompaniesData : [];
      const jobRequestsArray = Array.isArray(jobRequestsData.data?.requests) ? jobRequestsData.data.requests : 
                              Array.isArray(jobRequestsData.data) ? jobRequestsData.data : 
                              Array.isArray(jobRequestsData) ? jobRequestsData : [];

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

      // Calculate job request statistics
      const pendingJobRequests = jobRequestsArray.filter((req: any) => req.status === 'pending').length;
      const approvedJobRequests = jobRequestsArray.filter((req: any) => req.status === 'approved').length;
      const rejectedJobRequests = jobRequestsArray.filter((req: any) => req.status === 'rejected').length;
      const assignedJobRequests = jobRequestsArray.filter((req: any) => req.status === 'assigned').length;

      setStats({
        totalUsers: usersArray.length,
        pendingApprovals: pendingArray.length,
        activeNotaries,
        totalCompanies: companiesArray.length,
        pendingCompanies: pendingCompaniesArray.length,
        activeJobs,
        completedJobs,
        monthlyRevenue: parseFloat(revenueData.monthly_revenue) || 0,
        pendingPayments: parseInt(revenueData.pending_payments) || 0,
        // Job Request Statistics
        totalJobRequests: jobRequestsArray.length,
        pendingJobRequests,
        approvedJobRequests,
        rejectedJobRequests,
        assignedJobRequests
      });

      setPendingUsers(pendingArray);
      setPendingCompanies(pendingCompaniesArray);
      setRecentActivity([]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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
    <div className="space-y-8 animate-in fade-in-50 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Overview</h1>
          <p className="text-gray-600 mt-2">System dashboard and statistics</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => setLocation('/admin/approvals')}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Quick Actions
          </Button>
        </div>
      </div>

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
          title="Total Companies"
          value={stats.totalCompanies}
          icon={Building2}
          description="Registered title companies"
          trend="+15.3%"
          trendDirection="up"
          color="blue"
        />
      </div>

      {/* Job Request Statistics */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Request Management</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Requests"
            value={stats.totalJobRequests}
            icon={FileText}
            description="All job requests"
            color="blue"
          />
          <StatCard
            title="Pending Review"
            value={stats.pendingJobRequests}
            icon={Clock}
            description="Awaiting admin review"
            trend={stats.pendingJobRequests > 10 ? "High" : "Normal"}
            trendDirection={stats.pendingJobRequests > 10 ? "up" : "down"}
            color={stats.pendingJobRequests > 10 ? "red" : "yellow"}
          />
          <StatCard
            title="Approved"
            value={stats.approvedJobRequests}
            icon={CheckCircle}
            description="Approved requests"
            color="green"
          />
          <StatCard
            title="Assigned"
            value={stats.assignedJobRequests}
            icon={UserCheck}
            description="Assigned to notaries"
            color="blue"
          />
          <StatCard
            title="Rejected"
            value={stats.rejectedJobRequests}
            icon={XCircle}
            description="Rejected requests"
            color="red"
          />
        </div>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card className="border border-gray-200 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
                <CardDescription>Common administrative tasks</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Review Pending Approvals', icon: CheckCircle, path: '/admin/approvals', count: stats.pendingApprovals },
                { label: 'Job Request Management', icon: FileText, path: '/admin/job-requests', count: stats.pendingJobRequests },
                { label: 'Manage Users', icon: Users, path: '/admin/users', count: stats.totalUsers },
                { label: 'Notary Management', icon: Award, path: '/admin/notaries', count: stats.activeNotaries },
                { label: 'Company Management', icon: Building2, path: '/admin/companies', count: stats.totalCompanies },
                { label: 'System Logs', icon: Activity, path: '/admin/logs', count: null }
              ].map((action, index) => (
                <Button
                  key={index}
                  onClick={() => setLocation(action.path)}
                  className="w-full justify-between h-12 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:shadow-md transition-all duration-200"
                  variant="outline"
                >
                  <div className="flex items-center gap-3">
                    <action.icon className="h-5 w-5 text-gray-500" />
                    <span className="text-sm font-medium">{action.label}</span>
                  </div>
                  {action.count !== null && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      {action.count}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border border-gray-200 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Latest system events</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">{activity.timestamp}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Items */}
      {(pendingUsers.length > 0 || pendingCompanies.length > 0) && (
        <Card className="border border-gray-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Pending Items</CardTitle>
            <CardDescription>Items requiring your attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingUsers.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Pending User Approvals</h4>
                  <div className="space-y-2">
                    {pendingUsers.slice(0, 3).map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{user.fullName}</p>
                          <p className="text-sm text-gray-600">{user.role}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setLocation('/admin/approvals')}
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          Review
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingCompanies.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Pending Company Approvals</h4>
                  <div className="space-y-2">
                    {pendingCompanies.slice(0, 3).map((company) => (
                      <div key={company.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{company.companyName}</p>
                          <p className="text-sm text-gray-600">{company.contactEmail}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setLocation('/admin/companies')}
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          Review
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 