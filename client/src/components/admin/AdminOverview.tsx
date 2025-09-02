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

function StatCard({ title, value, icon: Icon, description, trend, trendDirection, color = 'neutral' }: StatCardProps) {
  return (
    <Card className="border border-gray-200 hover:shadow-sm transition-all duration-200">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="p-1.5 bg-gray-100 rounded-md shadow-sm border border-gray-200">
            <Icon className="h-3.5 w-3.5 text-gray-700" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${
              trendDirection === 'up' 
                ? 'bg-gray-100 text-gray-700' 
                : 'bg-gray-100 text-gray-700'
            }`}>
              {trendDirection === 'up' ? (
                <ArrowUpRight className="h-2.5 w-2.5" />
              ) : (
                <ArrowDownRight className="h-2.5 w-2.5" />
              )}
              {trend}
            </div>
          )}
        </div>
        <div className="space-y-0.5">
          <h3 className="text-lg font-bold text-gray-900">{value}</h3>
          <p className="text-xs font-medium text-gray-600">{title}</p>
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
            className="bg-gray-800 hover:bg-gray-900 text-white shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Quick Actions
          </Button>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          icon={Users}
          description="All registered users"
          trend="+12.5%"
          trendDirection="up"
        />
        <StatCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          icon={AlertCircle}
          description="Users awaiting approval"
          trend={stats.pendingApprovals > 5 ? "High" : "Normal"}
          trendDirection={stats.pendingApprovals > 5 ? "up" : "down"}
        />
        <StatCard
          title="Active Notaries"
          value={stats.activeNotaries}
          icon={UserCheck}
          description="Approved and active notaries"
          trend="+8.2%"
          trendDirection="up"
        />
        <StatCard
          title="Total Title Companies"
          value={stats.totalCompanies}
          icon={Building2}
          description="Registered title companies"
          trend="+15.3%"
          trendDirection="up"
        />
      </div>

      {/* Job Request Statistics */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Request Management</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
          <StatCard
            title="Total Requests"
            value={stats.totalJobRequests}
            icon={FileText}
            description="All job requests"
          />
          <StatCard
            title="Pending Review"
            value={stats.pendingJobRequests}
            icon={Clock}
            description="Awaiting admin review"
            trend={stats.pendingJobRequests > 10 ? "High" : "Normal"}
            trendDirection={stats.pendingJobRequests > 10 ? "up" : "down"}
          />
          <StatCard
            title="Approved"
            value={stats.approvedJobRequests}
            icon={CheckCircle}
            description="Approved requests"
          />
          <StatCard
            title="Assigned"
            value={stats.assignedJobRequests}
            icon={UserCheck}
            description="Assigned to notaries"
          />
          <StatCard
            title="Rejected"
            value={stats.rejectedJobRequests}
            icon={XCircle}
            description="Rejected requests"
          />
        </div>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quick Actions */}
        <Card className="border border-gray-200 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-100 rounded-md shadow-sm border border-gray-200">
                <Zap className="h-3.5 w-3.5 text-gray-700" />
              </div>
              <div>
                <CardTitle className="text-sm">Quick Actions</CardTitle>
                <CardDescription className="text-xs">Common administrative tasks</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5">
              {[
                { label: 'Review Pending Approvals', icon: CheckCircle, path: '/admin/approvals', count: stats.pendingApprovals },
                { label: 'Job Request Management', icon: FileText, path: '/admin/job-requests', count: stats.pendingJobRequests },
                { label: 'Manage Users', icon: Users, path: '/admin/users', count: stats.totalUsers },
                { label: 'Notary Management', icon: Award, path: '/admin/notaries', count: stats.activeNotaries },
                { label: 'Title Company Management', icon: Building2, path: '/admin/companies', count: stats.totalCompanies },
                { label: 'System Logs', icon: Activity, path: '/admin/logs', count: null }
              ].map((action, index) => (
                <Button
                  key={index}
                  onClick={() => setLocation(action.path)}
                  className="w-full justify-between h-8 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:shadow-sm transition-all duration-200"
                  variant="outline"
                >
                  <div className="flex items-center gap-1.5">
                    <action.icon className="h-3.5 w-3.5 text-gray-500" />
                    <span className="text-xs font-medium">{action.label}</span>
                  </div>
                  {action.count !== null && (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs px-1.5 py-0.5">
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
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-100 rounded-md shadow-sm border border-gray-200">
                <Activity className="h-3.5 w-3.5 text-gray-700" />
              </div>
              <div>
                <CardTitle className="text-sm">Recent Activity</CardTitle>
                <CardDescription className="text-xs">Latest system events</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center gap-1.5 p-1.5 bg-gray-50 rounded-md">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">{activity.timestamp}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <Activity className="h-6 w-6 text-gray-300 mx-auto mb-1" />
                  <p className="text-gray-500 text-xs">No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Items */}
      {(pendingUsers.length > 0 || pendingCompanies.length > 0) && (
        <Card className="border border-gray-200 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending Items</CardTitle>
            <CardDescription className="text-xs">Items requiring your attention</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingUsers.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1.5 text-xs">Pending User Approvals</h4>
                  <div className="space-y-1.5">
                    {pendingUsers.slice(0, 3).map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-1.5 bg-gray-50 rounded-md">
                        <div>
                          <p className="font-medium text-gray-900 text-xs">{user.fullName}</p>
                          <p className="text-xs text-gray-600">{user.role}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setLocation('/admin/approvals')}
                          className="bg-gray-800 hover:bg-gray-900 text-white text-xs px-2 py-0.5 h-6"
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
                  <h4 className="font-semibold text-gray-900 mb-1.5 text-xs">Pending Company Approvals</h4>
                  <div className="space-y-1.5">
                    {pendingCompanies.slice(0, 3).map((company) => (
                      <div key={company.id} className="flex items-center justify-between p-1.5 bg-gray-50 rounded-md">
                        <div>
                          <p className="font-medium text-gray-900 text-xs">{company.companyName}</p>
                          <p className="text-xs text-gray-600">{company.contactEmail}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setLocation('/admin/companies')}
                          className="bg-gray-800 hover:bg-gray-900 text-white text-xs px-2 py-0.5 h-6"
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