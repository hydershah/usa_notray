import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Loader2, FileText, User, Calendar, Clock, MapPin, AlertCircle, CheckCircle, XCircle, Search, Filter, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '../../lib/queryClient';

interface JobRequest {
  id: number;
  title: string;
  description: string;
  documentType: string;
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  preferredDate?: string;
  preferredTime?: string;
  location?: string;
  requestorId: number;
  requestorEmail: string;
  requestorPhone?: string;
  status: 'pending' | 'approved' | 'rejected' | 'assigned' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  reviewedBy?: number;
  reviewedAt?: string;
  reviewNotes?: string;
  assignedNotaryId?: number;
  assignedAt?: string;
  assignmentNotes?: string;
  convertedToJobId?: number;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Notary {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  notaryType: string;
  isActive: boolean;
}

interface JobRequestManagerProps {
  className?: string;
}

export function JobRequestManager({ className }: JobRequestManagerProps) {
  console.log('JobRequestManager component rendered');
  
  const [allRequests, setAllRequests] = useState<JobRequest[]>([]);
  const [notaries, setNotaries] = useState<Notary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<JobRequest | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [selectedRequests, setSelectedRequests] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>('');

  console.log('Component state:', {
    allRequests: allRequests.length,
    loading,
    error,
    selectedRequest: selectedRequest?.id,
    reviewDialogOpen,
    isProcessing,
    searchTerm,
    urgencyFilter,
    activeTab,
    selectedRequests: selectedRequests.size,
    bulkAction
  });

  useEffect(() => {
    fetchAllRequests();
    fetchNotaries();
    const interval = setInterval(fetchAllRequests, 30000); // Poll every 30 seconds
    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  const fetchAllRequests = async () => {
    try {
      setLoading(true);
      console.log('Fetching all job requests...');
      const response = await apiRequest('GET', '/api/job-requests');
      const result = await response.json();
      console.log('Fetched job requests:', result); // Log response

      // Handle both response formats for backward compatibility
      let requestsData = [];
      if (result.data?.requests && Array.isArray(result.data.requests)) {
        // New format: { data: { requests: [], total: number, page: number, limit: number } }
        requestsData = result.data.requests;
      } else if (Array.isArray(result.data)) {
        // Old format: { data: [] }
        requestsData = result.data;
      } else if (Array.isArray(result)) {
        // Direct array format: []
        requestsData = result;
      } else {
        console.error('Invalid response format:', result);
        setError('Invalid response format from server');
        toast.error('Invalid response format from server');
        setAllRequests([]);
        return;
      }

      console.log('Processed requests data:', requestsData);
      setAllRequests(requestsData);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch job requests:', err);
      setError('Failed to fetch job requests');
      toast.error('Failed to fetch job requests');
      setAllRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotaries = async () => {
    try {
      const response = await apiRequest('GET', '/api/job-requests/notaries');
      const result = await response.json();
      console.log('Fetched notaries:', result); // Log response

      // Handle different response formats
      let notariesData = [];
      if (result.data && Array.isArray(result.data)) {
        notariesData = result.data;
      } else if (Array.isArray(result)) {
        notariesData = result;
      } else {
        console.error('Invalid notaries response format:', result);
        notariesData = [];
      }
      
      setNotaries(notariesData);
    } catch (err) {
      console.error('Failed to fetch notaries:', err);
      toast.error('Failed to fetch notaries');
    }
  };

  const handleReview = async (action: 'approve' | 'reject', notes?: string, assignedNotaryId?: number, assignmentNotes?: string, requestId?: number) => {
    console.log('handleReview called with:', { action, notes, assignedNotaryId, assignmentNotes, requestId, selectedRequest: selectedRequest?.id });
    
    const targetRequestId = requestId || selectedRequest?.id;
    console.log('targetRequestId:', targetRequestId);
    
    if (!targetRequestId) {
      console.error('No target request ID found');
      toast.error('No target request ID found');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('Making API request to:', `/api/job-requests/${targetRequestId}/review`);
      const response = await apiRequest('POST', `/api/job-requests/${targetRequestId}/review`, {
        action,
        notes,
        assignedNotaryId,
        assignmentNotes,
      });
      const result = await response.json();
      console.log('Review result:', result); // Log review result

      if (result.success) {
        toast.success(`Request ${action}d successfully`);
        setReviewDialogOpen(false);
        setSelectedRequest(null);
        await fetchAllRequests(); // Refresh the list
      } else {
        toast.error(result.error || `Failed to ${action} request`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to review request';
      console.error('Review error:', err);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConvertToJob = async (requestId: number) => {
    setIsProcessing(true);
    try {
      const response = await apiRequest('POST', `/api/job-requests/${requestId}/convert`, {});
      const result = await response.json();
      console.log('Convert to job result:', result); // Log result

      toast.success('Request converted to job successfully');
      await fetchAllRequests(); // Refresh the list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to convert request to job';
      console.error('Convert error:', err);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkAction = async () => {
    if (selectedRequests.size === 0 || !bulkAction) return;

    setIsProcessing(true);
    try {
      const requestIds = Array.from(selectedRequests);
      let successCount = 0;
      let errorCount = 0;

      for (const requestId of requestIds) {
        try {
          if (bulkAction === 'approve') {
            await apiRequest('POST', `/api/job-requests/${requestId}/review`, {
              action: 'approve',
              notes: 'Bulk approved by admin',
            });
          } else if (bulkAction === 'reject') {
            await apiRequest('POST', `/api/job-requests/${requestId}/review`, {
              action: 'reject',
              notes: 'Bulk rejected by admin',
            });
          } else if (bulkAction === 'convert') {
            await apiRequest('POST', `/api/job-requests/${requestId}/convert`, {});
          }
          successCount++;
        } catch (err) {
          errorCount++;
          console.error(`Failed to process request ${requestId}:`, err);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully processed ${successCount} requests`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to process ${errorCount} requests`);
      }

      setSelectedRequests(new Set());
      setBulkAction('');
      await fetchAllRequests();
    } catch (err) {
      toast.error('Bulk action failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleRequestSelection = (requestId: number) => {
    const newSelected = new Set(selectedRequests);
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId);
    } else {
      newSelected.add(requestId);
    }
    setSelectedRequests(newSelected);
  };

  const selectAllRequests = () => {
    const allIds = filteredRequests.map(req => req.id);
    setSelectedRequests(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedRequests(new Set());
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normal':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'assigned':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter requests based on search term, urgency filter, and active tab
  const filteredRequests = allRequests.filter((request) => {
    const matchesSearch = searchTerm === '' || 
      request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.requestorEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.documentType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesUrgency = urgencyFilter === 'all' || request.urgency === urgencyFilter;
    const matchesStatus = activeTab === 'all' || request.status === activeTab;
    
    return matchesSearch && matchesUrgency && matchesStatus;
  });

  console.log('Filtered requests:', filteredRequests);
  console.log('Active tab:', activeTab);
  console.log('Search term:', searchTerm);
  console.log('Urgency filter:', urgencyFilter);

  const getStatusCount = (status: string) => {
    return allRequests.filter(req => status === 'all' || req.status === status).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading job requests...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Request Management</h1>
          <p className="text-gray-600">Review and manage signer-initiated job requests. Approve, reject, and assign notaries to requests.</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAllRequests}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Badge variant="outline" className="text-sm">
            {allRequests.length} Total
          </Badge>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search requests by title, description, email, or document type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by urgency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Urgencies</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedRequests.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedRequests.size} request{selectedRequests.size !== 1 ? 's' : ''} selected
              </span>
              <Select value={bulkAction} onValueChange={setBulkAction}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select bulk action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approve">Approve All</SelectItem>
                  <SelectItem value="reject">Reject All</SelectItem>
                  <SelectItem value="convert">Convert to Jobs</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleBulkAction}
                disabled={!bulkAction || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  'Apply'
                )}
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all" className="flex items-center gap-2">
            All
            <Badge variant="secondary" className="text-xs">
              {getStatusCount('all')}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            Pending
            <Badge variant="secondary" className="text-xs">
              {getStatusCount('pending')}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            Approved
            <Badge variant="secondary" className="text-xs">
              {getStatusCount('approved')}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="assigned" className="flex items-center gap-2">
            Assigned
            <Badge variant="secondary" className="text-xs">
              {getStatusCount('assigned')}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            Rejected
            <Badge variant="secondary" className="text-xs">
              {getStatusCount('rejected')}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            Completed
            <Badge variant="secondary" className="text-xs">
              {getStatusCount('completed')}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8">
                <FileText className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  No {activeTab === 'all' ? '' : activeTab} Requests
                </h3>
                <p className="text-gray-500 text-center">
                  {activeTab === 'all'
                    ? 'There are currently no job requests.'
                    : `There are currently no ${activeTab} job requests.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''} found
                  </span>
                  {filteredRequests.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllRequests}
                    >
                      Select All
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                {filteredRequests.map((request) => {
                  console.log('Rendering request card:', request.id, request.title);
                  console.log('Request status:', request.status);
                  return (
                    <Card key={request.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <input
                              type="checkbox"
                              checked={selectedRequests.has(request.id)}
                              onChange={() => toggleRequestSelection(request.id)}
                              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="flex-1">
                              <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                {request.title}
                              </CardTitle>
                              <CardDescription className="mt-2">
                                {request.description}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 ml-4">
                            <Badge className={getUrgencyColor(request.urgency)}>
                              {request.urgency.toUpperCase()}
                            </Badge>
                            <Badge className={getStatusColor(request.status)}>
                              {request.status.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-600">{request.requestorEmail}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-600 capitalize">{request.documentType.replace('_', ' ')}</span>
                          </div>
                          {request.preferredDate && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-gray-600">{request.preferredDate}</span>
                            </div>
                          )}
                          {request.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-gray-600">{request.location}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-500">
                            Submitted {formatDate(request.createdAt)}
                          </div>
                          <div className="flex gap-2">
                            {/* Always show management actions for admins */}
                            {console.log('Checking if request is pending:', request.status === 'pending')}
                            {request.status === 'pending' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('Review button clicked for request:', request.id);
                                    console.log('Event target:', e.target);
                                    console.log('Current request:', request);
                                    toast.info('Review button clicked!');
                                    setSelectedRequest(request);
                                    setReviewDialogOpen(true);
                                  }}
                                  style={{ cursor: 'pointer' }}
                                >
                                  Review
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('Quick Approve button clicked for request:', request.id);
                                    console.log('Event target:', e.target);
                                    handleReview('approve', 'Auto-approved', undefined, 'Auto-assigned', request.id);
                                  }}
                                  disabled={isProcessing}
                                >
                                  {isProcessing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Quick Approve'
                                  )}
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('Reject button clicked for request:', request.id);
                                    console.log('Event target:', e.target);
                                    handleReview('reject', 'Rejected by admin', undefined, undefined, request.id);
                                  }}
                                  disabled={isProcessing}
                                >
                                  {isProcessing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Reject'
                                  )}
                                </Button>
                              </>
                            )}

                            {request.status === 'approved' && !request.convertedToJobId && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleConvertToJob(request.id)}
                                  disabled={isProcessing}
                                >
                                  {isProcessing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Convert to Job'
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setReviewDialogOpen(true);
                                  }}
                                >
                                  Reassign
                                </Button>
                              </>
                            )}

                            {request.status === 'assigned' && !request.convertedToJobId && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleConvertToJob(request.id)}
                                  disabled={isProcessing}
                                >
                                  {isProcessing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Convert to Job'
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setReviewDialogOpen(true);
                                  }}
                                >
                                  Reassign
                                </Button>
                              </>
                            )}

                            {request.convertedToJobId && (
                              <Badge variant="outline" className="text-xs">
                                Job #{request.convertedToJobId}
                              </Badge>
                            )}

                            {/* Show action buttons for all statuses */}
                            {console.log('Rendering Actions button for request:', request.id)}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('Actions button clicked for request:', request.id);
                                console.log('Event target:', e.target);
                                console.log('Current request:', request);
                                toast.info('Actions button clicked!');
                                setSelectedRequest(request);
                                setReviewDialogOpen(true);
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              Actions
                            </Button>
                            
                            {/* Test button to check if buttons work at all */}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                console.log('Test button clicked!');
                                alert('Test button works!');
                              }}
                            >
                              Test
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Review Dialog - Always available */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Job Request</DialogTitle>
            <DialogDescription>
              Review and approve or reject this job request.
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <ReviewDialog
              request={selectedRequest}
              notaries={notaries}
              onApprove={(notes, assignedNotaryId, assignmentNotes) =>
                handleReview('approve', notes, assignedNotaryId, assignmentNotes)
              }
              onReject={(notes) => handleReview('reject', notes)}
              isProcessing={isProcessing}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ReviewDialogProps {
  request: JobRequest;
  notaries: Notary[];
  onApprove: (notes?: string, assignedNotaryId?: number, assignmentNotes?: string) => void;
  onReject: (notes?: string) => void;
  isProcessing: boolean;
}

function ReviewDialog({ request, notaries, onApprove, onReject, isProcessing }: ReviewDialogProps) {
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [notes, setNotes] = useState('');
  const [assignedNotaryId, setAssignedNotaryId] = useState<string>('');
  const [assignmentNotes, setAssignmentNotes] = useState('');

  const handleSubmit = () => {
    if (action === 'approve') {
      onApprove(notes, assignedNotaryId ? parseInt(assignedNotaryId) : undefined, assignmentNotes);
    } else {
      onReject(notes);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Action</Label>
        <Select value={action} onValueChange={(value) => setAction(value as 'approve' | 'reject')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="approve">Approve</SelectItem>
            <SelectItem value="reject">Reject</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {action === 'approve' && (
        <>
          <div className="space-y-2">
            <Label>Assign Notary (Optional)</Label>
            <Select value={assignedNotaryId} onValueChange={setAssignedNotaryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a notary or leave for auto-assignment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Auto-assign</SelectItem>
                {notaries.map((notary) => (
                  <SelectItem key={notary.id} value={notary.id.toString()}>
                    {notary.firstName} {notary.lastName} ({notary.notaryType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {assignedNotaryId && (
            <div className="space-y-2">
              <Label>Assignment Notes (Optional)</Label>
              <Textarea
                placeholder="Any special instructions for the notary..."
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
              />
            </div>
          )}
        </>
      )}

      <div className="space-y-2">
        <Label>Review Notes (Optional)</Label>
        <Textarea
          placeholder={`${action === 'approve' ? 'Approval' : 'Rejection'} notes...`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button
          variant={action === 'approve' ? 'default' : 'outline'}
          onClick={handleSubmit}
          disabled={isProcessing}
          className="flex-1"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : action === 'approve' ? (
            <CheckCircle className="h-4 w-4 mr-2" />
          ) : (
            <XCircle className="h-4 w-4 mr-2" />
          )}
          {action === 'approve' ? 'Approve' : 'Reject'}
        </Button>
      </div>
    </div>
  );
}