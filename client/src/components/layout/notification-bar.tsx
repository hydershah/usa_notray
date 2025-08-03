import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { 
  Bell, 
  Clock, 
  Briefcase, 
  CheckCircle, 
  AlertTriangle,
  Users,
  Calendar,
  ChevronRight,
  Building,
  User,
  FileText,
  Shield,
  CheckSquare
} from 'lucide-react';

interface NotificationBarProps {
  className?: string;
}

interface PendingTask {
  id: string;
  type: 'job_invitation' | 'verification_required' | 'profile_approval' | 'document_review' | 'job_request_approval' | 'company_approval';
  title: string;
  count: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  path: string;
  icon: any;
  description?: string;
}

export function NotificationBar({ className }: NotificationBarProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user?.id, user?.role]); // Only depend on stable user properties

  const fetchNotifications = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const tasks: PendingTask[] = [];

      // Notary-specific notifications - ONLY pending job invitations that need approval
      if (user.role === 'notary' || user.isNotary) {
        try {
          const jobInvitationsResponse = await fetch('/api/notary/job-invitations', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          
          if (jobInvitationsResponse.ok) {
            const jobInvitations = await jobInvitationsResponse.json();
            if (Array.isArray(jobInvitations)) {
              // Only show jobs that are actually pending approval (not completed/accepted already)
              const pendingInvitations = jobInvitations.filter((job: any) => 
                job.notary_approval_status === 'assigned_pending_approval' || 
                job.notary_approval_status === 'pending_assignment'
              );
              
              if (pendingInvitations.length > 0) {
                tasks.push({
                  id: 'job_invitations',
                  type: 'job_invitation',
                  title: 'Job Approvals',
                  count: pendingInvitations.length,
                  priority: pendingInvitations.some((job: any) => {
                    if (!job.selected_date) return false;
                    const jobDate = new Date(job.selected_date);
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return jobDate <= tomorrow;
                  }) ? 'urgent' : 'high',
                  path: '/notary-approval-dashboard',
                  icon: Briefcase,
                  description: 'Jobs waiting for your approval'
                });
              }
            }
          }
        } catch (error) {
          console.error('Error fetching job invitations:', error);
        }
      }

      // Admin-specific notifications - Categorized by approval type
      if (user.role === 'admin' || user.isAdmin) {
        try {
          // User Profile Approvals
          const usersResponse = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          
          if (usersResponse.ok) {
            const users = await usersResponse.json();
            if (Array.isArray(users)) {
              // Only count users that actually need approval action
              const pendingUsers = users.filter((u: any) => 
                u.approvalStatus === 'pending' ||
                u.approvalStatus === 'requires_update' ||
                (u.role === 'notary' && u.approvalStatus === 'pending')
              );
              
              if (pendingUsers.length > 0 && pendingUsers.length <= 50) {
                tasks.push({
                  id: 'user_approvals',
                  type: 'profile_approval',
                  title: 'User Profile Approvals',
                  count: pendingUsers.length,
                  priority: 'high',
                  path: '/admin/users?filter=pending',
                  icon: Users,
                  description: 'Users waiting for profile approval'
                });
              }
            }
          }

          // Job Request Approvals
          try {
            const jobRequestsResponse = await fetch('/api/job-requests?status=pending', {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (jobRequestsResponse.ok) {
              const jobRequests = await jobRequestsResponse.json();
              if (Array.isArray(jobRequests) && jobRequests.length > 0) {
                tasks.push({
                  id: 'job_request_approvals',
                  type: 'job_request_approval',
                  title: 'Job Request Approvals',
                  count: jobRequests.length,
                  priority: 'medium',
                  path: '/admin/job-requests?status=pending',
                  icon: FileText,
                  description: 'Signer requests waiting for approval'
                });
              }
            }
          } catch (error) {
            console.error('Error fetching job requests:', error);
          }

          // Company Approvals
          try {
            const companiesResponse = await fetch('/api/companies?status=pending', {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (companiesResponse.ok) {
              const companies = await companiesResponse.json();
              if (Array.isArray(companies) && companies.length > 0) {
                tasks.push({
                  id: 'company_approvals',
                  type: 'company_approval',
                  title: 'Company Approvals',
                  count: companies.length,
                  priority: 'medium',
                  path: '/admin/companies?status=pending',
                  icon: Building,
                  description: 'Companies waiting for approval'
                });
              }
            }
          } catch (error) {
            console.error('Error fetching company approvals:', error);
          }

          // Notary Job Approvals (for admin oversight)
          try {
            const notaryApprovalsResponse = await fetch('/api/approval-workflow/admin-queue', {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (notaryApprovalsResponse.ok) {
              const notaryApprovals = await notaryApprovalsResponse.json();
              if (Array.isArray(notaryApprovals) && notaryApprovals.length > 0) {
                tasks.push({
                  id: 'notary_job_approvals',
                  type: 'job_invitation',
                  title: 'Notary Job Approvals',
                  count: notaryApprovals.length,
                  priority: 'high',
                  path: '/admin/notary-approvals',
                  icon: Shield,
                  description: 'Jobs waiting for notary approval'
                });
              }
            }
          } catch (error) {
            console.error('Error fetching notary job approvals:', error);
          }

        } catch (error) {
          console.error('Error fetching admin approvals:', error);
        }
      }

      // Filter and cap the tasks to prevent overwhelming numbers
      const filteredTasks = tasks.filter(task => task.count > 0 && task.count < 100); // Cap at 100 to prevent data issues
      
      // Only log if there are actual tasks to reduce console noise
      if (filteredTasks.length > 0) {
        console.log('NotificationBar: Fetched tasks for user', user.role, ':', filteredTasks.map(t => ({ id: t.id, count: t.count })));
      }
      
      setPendingTasks(filteredTasks);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-blue-500 text-white';
      case 'low': return 'bg-gray-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return AlertTriangle;
      case 'high': return Clock;
      case 'medium': return Bell;
      case 'low': return CheckCircle;
      default: return Bell;
    }
  };

  const totalTasks = pendingTasks.reduce((sum, task) => sum + task.count, 0);

  if (loading || pendingTasks.length === 0) {
    return (
      <div className={`bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100 ${className}`}>
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-12">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">All caught up! No pending tasks</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-r from-orange-50 via-yellow-50 to-orange-50 border-b border-orange-200 ${className}`}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 py-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-orange-100 rounded-lg">
                <Bell className="h-4 w-4 text-orange-600" />
              </div>
              <span className="text-sm font-semibold text-orange-900">
                {totalTasks} Pending Task{totalTasks !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="hidden md:flex items-center gap-3">
              {pendingTasks.slice(0, 3).map((task) => {
                const TaskIcon = task.icon;
                const PriorityIcon = getPriorityIcon(task.priority);
                
                return (
                  <Button
                    key={task.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation(task.path)}
                    className="h-8 px-3 bg-white/70 hover:bg-white hover:shadow-sm border border-orange-200/50 text-orange-900 transition-all duration-200 group"
                    title={task.description}
                  >
                    <div className="flex items-center gap-2">
                      <TaskIcon className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{task.title}</span>
                      <Badge className={`h-5 w-5 p-0 flex items-center justify-center text-xs font-bold ${getPriorityColor(task.priority)}`}>
                        {task.count}
                      </Badge>
                      {task.priority === 'urgent' && (
                        <PriorityIcon className="h-3 w-3 text-red-500 animate-pulse" />
                      )}
                    </div>
                  </Button>
                );
              })}
              
              {pendingTasks.length > 3 && (
                <span className="text-xs text-orange-600 font-medium">
                  +{pendingTasks.length - 3} more
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation('/admin/approvals-hub')}
              className="h-8 bg-white/70 hover:bg-white border-orange-200 text-orange-900 hover:text-orange-950"
            >
              <span className="text-xs font-medium">Approvals Hub</span>
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation('/dashboard')}
              className="h-8 bg-white/70 hover:bg-white border-orange-200 text-orange-900 hover:text-orange-950"
            >
              <span className="text-xs font-medium">View All</span>
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 