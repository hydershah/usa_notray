import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  UserCheck, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  FileText,
  Calendar,
  Shield,
  Bell,
  Search,
  Filter,
  MessageSquare,
  Download,
  UserX,
  CheckSquare,
  AlertCircle,
  Building2,
  Mail,
  Phone
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface NotaryApprovalQueue {
  id: number;
  jobId: number;
  notaryId: number;
  titleCompany: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  deadline?: string;
  specialInstructions?: string;
  createdAt: string;
  updatedAt: string;
  // Virtual fields from joins
  job?: {
    closingType: string;
    propertyAddress: string;
    selectedDate?: string;
    selectedTime?: string;
    notaryApprovalStatus: string;
    notaryApprovalNotes?: string;
    notaryApprovalConditions?: string;
  };
  notary?: {
    username: string;
    firstName?: string;
    lastName?: string;
    email: string;
    phoneNumber?: string;
    commissionNumber?: string;
    commissionExpiration?: string;
    state?: string;
    approvalStatus: string;
    lastProfileUpdate?: string;
  };
}

interface JobNotification {
  id: number;
  jobId: number;
  recipientId: number;
  recipientEmail: string;
  notificationType: string;
  status: string;
  subject: string;
  message: string;
  sentAt?: string;
  openedAt?: string;
  retryCount: number;
  createdAt: string;
}

interface ApprovalAction {
  action: 'approve' | 'reject' | 'request_changes';
  notes: string;
  conditions?: string;
}

export default function NotaryApprovalDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedApproval, setSelectedApproval] = useState<NotaryApprovalQueue | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("queue");

  // Approval action form
  const [approvalForm, setApprovalForm] = useState<ApprovalAction>({
    action: 'approve',
    notes: '',
    conditions: ''
  });

  // Data fetching
  const { data: approvalQueue = [], isLoading: queueLoading } = useQuery<NotaryApprovalQueue[]>({
    queryKey: ['/api/notary-approval/queue'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/approval-workflow/queue");
      return response.json();
    },
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery<JobNotification[]>({
    queryKey: ['/api/notifications/recent'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/approval-workflow/notifications");
      return response.json();
    },
    enabled: activeTab === 'notifications'
  });

  const { data: pendingNotaries = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['/api/notaries/pending-approval'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/notary-profile/pending");
      return response.json();
    },
    enabled: activeTab === 'notaries'
  });

  // Mutations
  const processApprovalMutation = useMutation({
    mutationFn: async ({ queueId, action }: { queueId: number; action: ApprovalAction }) => {
      const response = await apiRequest("POST", `/api/approval-workflow/process/${queueId}`, action);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notary-approval/queue'] });
      setIsActionDialogOpen(false);
      setSelectedApproval(null);
      toast({
        title: "Approval Processed",
        description: "The approval request has been processed successfully.",
      });
    }
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async ({ jobId, type }: { jobId: number; type: string }) => {
      const response = await apiRequest("POST", `/api/approval-workflow/send-notification`, {
        jobId,
        notificationType: type
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/recent'] });
      toast({
        title: "Notification Sent",
        description: "Notification has been sent successfully.",
      });
    }
  });

  const approveNotaryMutation = useMutation({
    mutationFn: async ({ notaryId, action, notes }: { notaryId: number; action: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/notary-profile/approve/${notaryId}`, {
        action,
        notes
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notaries/pending-approval'] });
      toast({
        title: "Notary Status Updated",
        description: "Notary approval status has been updated.",
      });
    }
  });

  // Helper functions
  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: "bg-blue-100 text-blue-800",
      normal: "bg-gray-100 text-gray-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800"
    };

    const colorClass = colors[priority as keyof typeof colors] || "bg-gray-100 text-gray-800";

    return (
      <Badge className={`${colorClass} border-0`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  const getApprovalStatusBadge = (status: string) => {
    const colors = {
      pending_assignment: "bg-yellow-100 text-yellow-800",
      assigned_pending_approval: "bg-blue-100 text-blue-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
             approved_with_conditions: "bg-blue-100 text-blue-800"
    };

    const colorClass = colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
    const label = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return (
      <Badge className={`${colorClass} border-0`}>
        {label}
      </Badge>
    );
  };

  const getNotificationStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'opened':
        return <Eye className="h-4 w-4 text-blue-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const handleProcessApproval = (action: 'approve' | 'reject' | 'request_changes') => {
    setApprovalForm({ action, notes: '', conditions: '' });
    setIsActionDialogOpen(true);
  };

  const handleSubmitApproval = () => {
    if (!selectedApproval) return;

    processApprovalMutation.mutate({
      queueId: selectedApproval.id,
      action: approvalForm
    });
  };

  const filteredQueue = approvalQueue.filter((item) =>
    (statusFilter === "all" || item.job?.notaryApprovalStatus === statusFilter) &&
    (priorityFilter === "all" || item.priority === priorityFilter) &&
    (item.titleCompany.toLowerCase().includes(searchTerm.toLowerCase()) ||
     item.notary?.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (item.notary?.firstName && item.notary.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
     (item.notary?.lastName && item.notary.lastName.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const stats = {
    total: approvalQueue.length,
    pending: approvalQueue.filter(item => item.job?.notaryApprovalStatus === 'assigned_pending_approval').length,
    approved: approvalQueue.filter(item => item.job?.notaryApprovalStatus === 'approved').length,
    urgent: approvalQueue.filter(item => item.priority === 'urgent').length,
    overdue: approvalQueue.filter(item => 
      item.deadline && new Date(item.deadline) < new Date()
    ).length
  };

  if (!user || user.role !== 'admin') {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
          <p className="text-gray-600">This page is only accessible to administrators.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notary Approval Dashboard</h1>
            <p className="text-gray-600">Manage notary job approvals and notifications</p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
              <Bell className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Queue</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <UserCheck className="h-8 w-8 text-yellow-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Approval</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Urgent</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.urgent}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Overdue</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.overdue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="queue">Approval Queue</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="notaries">Notary Approvals</TabsTrigger>
          </TabsList>

          {/* Approval Queue Tab */}
          <TabsContent value="queue" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search by company or notary..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <span>Status: {statusFilter === 'all' ? 'All' : statusFilter.replace(/_/g, ' ')}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="assigned_pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="approved_with_conditions">Approved with Conditions</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[200px]">
                  <span>Priority: {priorityFilter === 'all' ? 'All' : priorityFilter}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Approval Queue Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Job Approval Queue
                </CardTitle>
              </CardHeader>
              <CardContent>
                {queueLoading ? (
                  <div className="text-center py-8">Loading approval queue...</div>
                ) : filteredQueue.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No items in approval queue.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job #</TableHead>
                        <TableHead>Title Company</TableHead>
                        <TableHead>Notary</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredQueue.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">#{item.jobId}</div>
                              <div className="text-sm text-gray-500">
                                {item.job?.closingType}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-gray-400" />
                              {item.titleCompany}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {item.notary?.firstName && item.notary?.lastName 
                                  ? `${item.notary.firstName} ${item.notary.lastName}`
                                  : item.notary?.username}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {item.notary?.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getPriorityBadge(item.priority)}
                          </TableCell>
                          <TableCell>
                            {getApprovalStatusBadge(item.job?.notaryApprovalStatus || 'pending')}
                          </TableCell>
                          <TableCell>
                            {item.deadline ? (
                              <div className={`text-sm ${
                                new Date(item.deadline) < new Date() ? 'text-red-600 font-medium' : 'text-gray-600'
                              }`}>
                                {formatDateTime(item.deadline)}
                              </div>
                            ) : (
                              <span className="text-gray-400">No deadline</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedApproval(item);
                                  setIsDetailsOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {item.job?.notaryApprovalStatus === 'assigned_pending_approval' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedApproval(item);
                                      handleProcessApproval('approve');
                                    }}
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedApproval(item);
                                      handleProcessApproval('reject');
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Recent Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                {notificationsLoading ? (
                  <div className="text-center py-8">Loading notifications...</div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No recent notifications.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job #</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Retries</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notifications.map((notification) => (
                        <TableRow key={notification.id}>
                          <TableCell>#{notification.jobId}</TableCell>
                          <TableCell>{notification.recipientEmail}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {notification.notificationType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getNotificationStatusIcon(notification.status)}
                              <span className="text-sm">{notification.status}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {notification.sentAt ? formatDateTime(notification.sentAt) : 'Not sent'}
                          </TableCell>
                          <TableCell>
                            {notification.retryCount > 0 && (
                              <Badge variant="secondary">{notification.retryCount}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notary Approvals Tab */}
          <TabsContent value="notaries" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Pending Notary Approvals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingLoading ? (
                  <div className="text-center py-8">Loading pending notaries...</div>
                ) : pendingNotaries.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No notaries pending approval.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingNotaries.map((notary: any) => (
                      <Card key={notary.id} className="border-l-4 border-l-yellow-400">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">
                                  {notary.firstName && notary.lastName 
                                    ? `${notary.firstName} ${notary.lastName}`
                                    : notary.username}
                                </h3>
                                <Badge className="bg-yellow-100 text-yellow-800">
                                  {notary.approvalStatus}
                                </Badge>
                              </div>
                              <div className="text-sm text-gray-600 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4" />
                                  {notary.email}
                                </div>
                                {notary.phoneNumber && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4" />
                                    {notary.phoneNumber}
                                  </div>
                                )}
                                <div>Commission: {notary.commissionNumber || 'Not provided'}</div>
                                <div>State: {notary.state || 'Not provided'}</div>
                                <div>Last Updated: {formatDate(notary.lastProfileUpdate)}</div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => approveNotaryMutation.mutate({
                                  notaryId: notary.id,
                                  action: 'approve',
                                  notes: 'Approved via dashboard'
                                })}
                                disabled={approveNotaryMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approveNotaryMutation.mutate({
                                  notaryId: notary.id,
                                  action: 'request_changes',
                                  notes: 'Changes requested via dashboard'
                                })}
                                disabled={approveNotaryMutation.isPending}
                              >
                                <MessageSquare className="h-4 w-4 mr-1" />
                                Request Changes
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => approveNotaryMutation.mutate({
                                  notaryId: notary.id,
                                  action: 'reject',
                                  notes: 'Rejected via dashboard'
                                })}
                                disabled={approveNotaryMutation.isPending}
                              >
                                <UserX className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Approval Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Job Approval Details</DialogTitle>
            </DialogHeader>
            {selectedApproval && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Job ID</label>
                    <p className="text-sm">#{selectedApproval.jobId}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Priority</label>
                    <div>{getPriorityBadge(selectedApproval.priority)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Title Company</label>
                    <p className="text-sm">{selectedApproval.titleCompany}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div>{getApprovalStatusBadge(selectedApproval.job?.notaryApprovalStatus || 'pending')}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Closing Type</label>
                    <p className="text-sm">{selectedApproval.job?.closingType}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Scheduled</label>
                    <p className="text-sm">
                      {selectedApproval.job?.selectedDate && selectedApproval.job?.selectedTime
                        ? `${selectedApproval.job.selectedDate} at ${selectedApproval.job.selectedTime}`
                        : 'Not scheduled'}
                    </p>
                  </div>
                </div>
                
                {selectedApproval.job?.propertyAddress && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Property Address</label>
                    <p className="text-sm">{selectedApproval.job.propertyAddress}</p>
                  </div>
                )}

                {selectedApproval.specialInstructions && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Special Instructions</label>
                    <p className="text-sm">{selectedApproval.specialInstructions}</p>
                  </div>
                )}

                {selectedApproval.job?.notaryApprovalNotes && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Previous Notes</label>
                    <p className="text-sm">{selectedApproval.job.notaryApprovalNotes}</p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium mb-2">Notary Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Name</label>
                      <p className="text-sm">
                        {selectedApproval.notary?.firstName && selectedApproval.notary?.lastName 
                          ? `${selectedApproval.notary.firstName} ${selectedApproval.notary.lastName}`
                          : selectedApproval.notary?.username}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-sm">{selectedApproval.notary?.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Commission Number</label>
                      <p className="text-sm">{selectedApproval.notary?.commissionNumber || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">State</label>
                      <p className="text-sm">{selectedApproval.notary?.state || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Approval Action Dialog */}
        <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {approvalForm.action === 'approve' ? 'Approve Job' : 
                 approvalForm.action === 'reject' ? 'Reject Job' : 'Request Changes'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  value={approvalForm.notes}
                  onChange={(e) => setApprovalForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Enter notes about this decision..."
                  rows={3}
                />
              </div>

              {approvalForm.action === 'approve' && (
                <div>
                  <label className="text-sm font-medium">Conditions (Optional)</label>
                  <Textarea
                    value={approvalForm.conditions}
                    onChange={(e) => setApprovalForm(prev => ({ ...prev, conditions: e.target.value }))}
                    placeholder="Enter any special conditions for approval..."
                    rows={2}
                  />
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleSubmitApproval}
                  disabled={processApprovalMutation.isPending || !approvalForm.notes.trim()}
                  className="flex-1"
                  variant={approvalForm.action === 'reject' ? 'destructive' : 'default'}
                >
                  {processApprovalMutation.isPending ? 'Processing...' : 
                   approvalForm.action === 'approve' ? 'Approve Job' : 
                   approvalForm.action === 'reject' ? 'Reject Job' : 'Request Changes'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsActionDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
} 