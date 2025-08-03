import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  FileText, 
  Building, 
  Shield, 
  Briefcase,
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  Mail,
  RefreshCw,
  Calendar,
  MapPin,
  Phone,
  ChevronRight,
  TrendingUp,
  Activity
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/api';
import { useLocation } from 'wouter';

interface ApprovalStats {
  userProfileApprovals: number;
  jobRequestApprovals: number;
  companyApprovals: number;
  notaryJobApprovals: number;
  totalPending: number;
  urgentCount: number;
  overdueCount: number;
}

interface ApprovalSummary {
  id: string;
  type: 'user_profile' | 'job_request' | 'company' | 'notary_job';
  title: string;
  count: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  path: string;
  icon: any;
  color: string;
  bgColor: string;
}

export default function ApprovalsHub() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState<ApprovalStats>({
    userProfileApprovals: 0,
    jobRequestApprovals: 0,
    companyApprovals: 0,
    notaryJobApprovals: 0,
    totalPending: 0,
    urgentCount: 0,
    overdueCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    if (user?.role === 'admin' || user?.isAdmin) {
      fetchApprovalStats();
      // Refresh every 30 seconds
      const interval = setInterval(fetchApprovalStats, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchApprovalStats = async () => {
    try {
      setLoading(true);
      
      // Fetch all approval counts in parallel
      const [
        usersResponse,
        jobRequestsResponse,
        companiesResponse,
        notaryApprovalsResponse
      ] = await Promise.all([
        fetch('/api/users', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/api/job-requests?status=pending', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/api/companies?status=pending', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/api/approval-workflow/admin-queue', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      const [users, jobRequests, companies, notaryApprovals] = await Promise.all([
        usersResponse.json(),
        jobRequestsResponse.json(),
        companiesResponse.json(),
        notaryApprovalsResponse.json()
      ]);

      // Calculate stats
      const pendingUsers = Array.isArray(users) ? users.filter((u: any) => 
        u.approvalStatus === 'pending' ||
        u.approvalStatus === 'requires_update' ||
        (u.role === 'notary' && u.approvalStatus === 'pending')
      ).length : 0;

      const pendingJobRequests = Array.isArray(jobRequests) ? jobRequests.length : 0;
      const pendingCompanies = Array.isArray(companies) ? companies.length : 0;
      const pendingNotaryApprovals = Array.isArray(notaryApprovals) ? notaryApprovals.length : 0;

      const totalPending = pendingUsers + pendingJobRequests + pendingCompanies + pendingNotaryApprovals;

      // Calculate urgent and overdue counts
      const urgentCount = Array.isArray(notaryApprovals) ? 
        notaryApprovals.filter((a: any) => a.priority === 'urgent').length : 0;
      
      const overdueCount = Array.isArray(notaryApprovals) ? 
        notaryApprovals.filter((a: any) => {
          if (!a.deadline) return false;
          return new Date(a.deadline) < new Date();
        }).length : 0;

      setStats({
        userProfileApprovals: pendingUsers,
        jobRequestApprovals: pendingJobRequests,
        companyApprovals: pendingCompanies,
        notaryJobApprovals: pendingNotaryApprovals,
        totalPending,
        urgentCount,
        overdueCount
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching approval stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const approvalSummaries: ApprovalSummary[] = [
    {
      id: 'user_profile_approvals',
      type: 'user_profile',
      title: 'User Profile Approvals',
      count: stats.userProfileApprovals,
      priority: stats.userProfileApprovals > 5 ? 'high' : 'medium',
      description: 'Users waiting for profile verification and approval',
      path: '/admin/users?filter=pending',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      id: 'job_request_approvals',
      type: 'job_request',
      title: 'Job Request Approvals',
      count: stats.jobRequestApprovals,
      priority: stats.jobRequestApprovals > 3 ? 'high' : 'medium',
      description: 'Signer-initiated notarization requests awaiting review',
      path: '/admin/job-requests?status=pending',
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      id: 'company_approvals',
      type: 'company',
      title: 'Company Approvals',
      count: stats.companyApprovals,
      priority: stats.companyApprovals > 2 ? 'high' : 'medium',
      description: 'Company registrations waiting for approval',
      path: '/admin/companies?status=pending',
      icon: Building,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      id: 'notary_job_approvals',
      type: 'notary_job',
      title: 'Notary Job Approvals',
      count: stats.notaryJobApprovals,
      priority: stats.urgentCount > 0 ? 'urgent' : stats.notaryJobApprovals > 5 ? 'high' : 'medium',
      description: 'Jobs waiting for notary approval (admin oversight)',
      path: '/admin/notary-approvals',
      icon: Shield,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ];

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent': return <Badge className="bg-red-500 text-white">Urgent</Badge>;
      case 'high': return <Badge className="bg-orange-500 text-white">High</Badge>;
      case 'medium': return <Badge className="bg-blue-500 text-white">Medium</Badge>;
      case 'low': return <Badge className="bg-gray-500 text-white">Low</Badge>;
      default: return <Badge className="bg-gray-500 text-white">{priority}</Badge>;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return AlertTriangle;
      case 'high': return Clock;
      case 'medium': return Activity;
      case 'low': return CheckCircle;
      default: return Activity;
    }
  };

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
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Approvals Hub</h1>
            <p className="text-gray-600">Centralized dashboard for managing all approval requests</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">Last updated</p>
              <p className="text-sm font-medium text-gray-900">
                {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchApprovalStats}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Pending</p>
                <p className="text-3xl font-bold text-blue-900">{stats.totalPending}</p>
              </div>
              <div className="p-3 bg-blue-200 rounded-lg">
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Urgent</p>
                <p className="text-3xl font-bold text-orange-900">{stats.urgentCount}</p>
              </div>
              <div className="p-3 bg-orange-200 rounded-lg">
                <AlertTriangle className="h-8 w-8 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-red-50 to-red-100 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Overdue</p>
                <p className="text-3xl font-bold text-red-900">{stats.overdueCount}</p>
              </div>
              <div className="p-3 bg-red-200 rounded-lg">
                <Clock className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">All Caught Up</p>
                <p className="text-3xl font-bold text-green-900">
                  {stats.totalPending === 0 ? 'Yes' : 'No'}
                </p>
              </div>
              <div className="p-3 bg-green-200 rounded-lg">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approval Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {approvalSummaries.map((summary) => {
          const SummaryIcon = summary.icon;
          const PriorityIcon = getPriorityIcon(summary.priority);
          
          return (
            <Card 
              key={summary.id} 
              className="hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-gray-300"
              onClick={() => setLocation(summary.path)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${summary.bgColor}`}>
                      <SummaryIcon className={`h-6 w-6 ${summary.color}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{summary.title}</h3>
                      <p className="text-sm text-gray-600">{summary.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getPriorityBadge(summary.priority)}
                    {summary.priority === 'urgent' && (
                      <PriorityIcon className="h-4 w-4 text-red-500 animate-pulse" />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{summary.count}</p>
                      <p className="text-xs text-gray-500">Pending</p>
                    </div>
                    {summary.count > 0 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(summary.path);
                          }}
                          className="text-xs"
                        >
                          View All
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {summary.count === 0 && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">All caught up!</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      {stats.totalPending > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Common actions to help you manage approvals efficiently
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                onClick={() => setLocation('/admin/users?filter=pending')}
                className="h-12 justify-start"
              >
                <Users className="h-4 w-4 mr-2" />
                Review User Profiles
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setLocation('/admin/job-requests?status=pending')}
                className="h-12 justify-start"
              >
                <FileText className="h-4 w-4 mr-2" />
                Process Job Requests
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setLocation('/admin/notary-approvals')}
                className="h-12 justify-start"
              >
                <Shield className="h-4 w-4 mr-2" />
                Monitor Notary Approvals
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && stats.totalPending === 0 && (
        <Card className="mt-8">
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">All Approvals Complete!</h3>
            <p className="text-gray-600 mb-6">
              Great job! All approval requests have been processed. The system is running smoothly.
            </p>
            <div className="flex justify-center gap-4">
              <Button
                variant="outline"
                onClick={() => setLocation('/admin/users')}
              >
                <Users className="h-4 w-4 mr-2" />
                View All Users
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation('/admin/job-requests')}
              >
                <FileText className="h-4 w-4 mr-2" />
                View All Job Requests
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="mt-8">
          <CardContent className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading approval statistics...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 