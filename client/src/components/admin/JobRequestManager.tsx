import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Loader2, FileText, User, Calendar, Clock, MapPin, AlertCircle, CheckCircle, XCircle, UserCheck, ExternalLink, Edit, Trash2, Eye, Search, Filter, Plus, Mail, Phone, MapPin as LocationIcon, Download, File, X, FileImage, FileText as FileTextIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';
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
  requestorName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'assigned' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  reviewedBy?: number;
  reviewedAt?: string;
  reviewNotes?: string;
  assignedNotaryId?: number;
  assignedNotaryName?: string;
  assignedAt?: string;
  assignmentNotes?: string;
  convertedToJobId?: number;
  convertedAt?: string;
  documents?: Array<{
    id: number;
    name: string;
    url: string;
    uploadedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface Notary {
  id: number;
  name: string;
  email: string;
  status: string;
}

export function JobRequestManager() {
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [notaries, setNotaries] = useState<Notary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<JobRequest | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [selectedNotaryId, setSelectedNotaryId] = useState<string>('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetchAllRequests();
    fetchNotaries();
  }, []);

  const fetchAllRequests = async () => {
    try {
      const response = await apiRequest('GET', '/api/job-requests');
      const result = await response.json();
      const requestsData = result.data?.requests || result.data || [];
      setRequests(Array.isArray(requestsData) ? requestsData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requests');
      toast.error('Failed to fetch job requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchNotaries = async () => {
    try {
      const response = await apiRequest('GET', '/api/notaries/available');
      const result = await response.json();
      const notariesData = result.data || [];
      setNotaries(Array.isArray(notariesData) ? notariesData : []);
    } catch (err) {
      console.error('Failed to fetch notaries:', err);
    }
  };

  const handleReviewRequest = async (requestId: number, action: 'approve' | 'reject') => {
    try {
      await apiRequest('POST', `/api/job-requests/${requestId}/review`, {
        action,
        notes: reviewNotes
      });
      toast.success(`Request ${action}d successfully`);
      setIsViewDialogOpen(false);
      setReviewNotes('');
      setSelectedRequest(null);
      fetchAllRequests();
    } catch (error) {
      toast.error(`Failed to ${action} request`);
    }
  };

  const handleAssignRequest = async (requestId: number) => {
    if (!selectedNotaryId) {
      toast.error('Please select a notary');
      return;
    }

    try {
      await apiRequest('POST', `/api/job-requests/${requestId}/review`, {
        action: 'assign',
        assignedNotaryId: parseInt(selectedNotaryId),
        assignmentNotes
      });
      toast.success('Request assigned successfully');
      setIsAssignDialogOpen(false);
      setSelectedNotaryId('');
      setAssignmentNotes('');
      setSelectedRequest(null);
      fetchAllRequests();
    } catch (error) {
      toast.error('Failed to assign request');
    }
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
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-3 w-3" />;
      case 'approved':
        return <CheckCircle className="h-3 w-3" />;
      case 'rejected':
        return <XCircle className="h-3 w-3" />;
      case 'assigned':
        return <UserCheck className="h-3 w-3" />;
      case 'completed':
        return <CheckCircle className="h-3 w-3" />;
      case 'cancelled':
        return <XCircle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.requestorEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (request.requestorName && request.requestorName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesUrgency = urgencyFilter === 'all' || request.urgency === urgencyFilter;
    
    return matchesSearch && matchesStatus && matchesUrgency;
  });

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return <FileText className="h-8 w-8 text-red-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <FileImage className="h-8 w-8 text-green-500" />;
      case 'doc':
      case 'docx':
        return <FileTextIcon className="h-8 w-8 text-blue-500" />;
      default:
        return <File className="h-8 w-8 text-gray-500" />;
    }
  };

  const handleDocumentView = (url: string) => {
    setSelectedDocument(url);
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Job Request Management</h2>
          <p className="text-gray-600">Manage and review all job requests in the system</p>
        </div>
        <Badge variant="outline" className="text-sm">
          {filteredRequests.length} of {requests.length} Total
        </Badge>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Urgencies</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setUrgencyFilter('all');
            }}>
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Job Requests Found</h3>
            <p className="text-gray-500 text-center">
              {requests.length === 0 ? 'No job requests have been submitted yet.' : 'No requests match your current filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {request.title}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {request.description}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <Badge className={getUrgencyColor(request.urgency)}>
                      {request.urgency.toUpperCase()}
                    </Badge>
                    <Badge className={`${getStatusColor(request.status)} flex items-center gap-1`}>
                      {getStatusIcon(request.status)}
                      {request.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">{request.requestorName || request.requestorEmail}</span>
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
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Submitted {formatDate(request.createdAt)}</span>
                  </div>
                </div>

                {/* Review Notes */}
                {request.reviewNotes && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-200">
                    <h4 className="text-sm font-semibold text-blue-800 mb-1">Review Notes:</h4>
                    <p className="text-sm text-blue-700">{request.reviewNotes}</p>
                  </div>
                )}

                {/* Assignment Info */}
                {request.assignedNotaryName && (
                  <div className="mb-4 p-3 bg-green-50 rounded-md border border-green-200">
                    <h4 className="text-sm font-semibold text-green-800 mb-1">Assigned to:</h4>
                    <p className="text-sm text-green-700">{request.assignedNotaryName}</p>
                    {request.assignmentNotes && (
                      <p className="text-sm text-green-600 mt-1">{request.assignmentNotes}</p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-500">
                    Last updated {formatDate(request.updatedAt)}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    
                                        {/* View Button */}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setSelectedRequest(request);
                        setReviewNotes('');
                        setIsViewDialogOpen(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    
                    <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden p-0">
                        <div className="p-6 pb-4 border-b">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-50 rounded-lg">
                                <FileText className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <DialogTitle className="text-xl font-semibold">
                                  Job Request Details
                                </DialogTitle>
                                <DialogDescription>
                                  Complete information about this job request
                                </DialogDescription>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setIsViewDialogOpen(false)}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {selectedRequest && (
                          <div className="flex h-[calc(95vh-120px)]">
                            {/* Left Panel - Document Viewer */}
                            <div className="w-2/5 border-r bg-gray-50 flex flex-col">
                              <div className="p-4 border-b bg-white">
                                                                 <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                   <FileText className="h-5 w-5 text-blue-600" />
                                   Documents
                                 </h3>
                                {selectedRequest.documents && selectedRequest.documents.length > 0 ? (
                                  <div className="space-y-2">
                                    {selectedRequest.documents.map((doc) => (
                                      <div 
                                        key={doc.id} 
                                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => handleDocumentView(doc.url)}
                                      >
                                        <div className="flex items-center gap-3">
                                          {getFileIcon(doc.name)}
                                          <div>
                                            <p className="font-medium text-sm">{doc.name}</p>
                                            <p className="text-xs text-gray-500">Uploaded {formatDate(doc.uploadedAt)}</p>
                                          </div>
                                        </div>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(doc.url, '_blank');
                                          }}
                                        >
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-8 text-gray-500">
                                    <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                    <p>No documents uploaded</p>
                                  </div>
                                )}
                              </div>
                              
                              {/* Document Preview Area */}
                              <div className="flex-1 p-4">
                                {selectedDocument ? (
                                  <div className="h-full bg-white rounded-lg border overflow-hidden">
                                    <iframe
                                      src={selectedDocument}
                                      className="w-full h-full"
                                      title="Document Preview"
                                    />
                                  </div>
                                ) : (
                                  <div className="h-full bg-white rounded-lg border flex items-center justify-center">
                                    <div className="text-center text-gray-500">
                                      <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                                      <p className="text-lg font-medium">Document Preview</p>
                                      <p className="text-sm">Select a document to view</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right Panel - Request Details */}
                            <div className="w-3/5 overflow-y-auto">
                              <div className="p-6 space-y-6">
                                {/* Basic Information */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div>
                                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                      Request Information
                                    </h3>
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Title</label>
                                        <p className="text-sm text-gray-900 font-medium">{selectedRequest.title}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Description</label>
                                        <p className="text-sm text-gray-900">{selectedRequest.description}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Document Type</label>
                                        <p className="text-sm text-gray-900 capitalize">{selectedRequest.documentType.replace('_', ' ')}</p>
                                      </div>
                                      <div className="flex gap-4">
                                        <div>
                                          <label className="text-sm font-medium text-gray-700">Urgency</label>
                                          <Badge className={`${getUrgencyColor(selectedRequest.urgency)} mt-1`}>
                                            {selectedRequest.urgency.toUpperCase()}
                                          </Badge>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium text-gray-700">Status</label>
                                          <Badge className={`${getStatusColor(selectedRequest.status)} mt-1 flex items-center gap-1`}>
                                            {getStatusIcon(selectedRequest.status)}
                                            {selectedRequest.status.toUpperCase()}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div>
                                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                      Requestor Information
                                    </h3>
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-gray-500" />
                                        <div>
                                          <label className="text-sm font-medium text-gray-700">Name</label>
                                          <p className="text-sm text-gray-900">{selectedRequest.requestorName || 'Not provided'}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-gray-500" />
                                        <div>
                                          <label className="text-sm font-medium text-gray-700">Email</label>
                                          <p className="text-sm text-gray-900">{selectedRequest.requestorEmail}</p>
                                        </div>
                                      </div>
                                      {selectedRequest.requestorPhone && (
                                        <div className="flex items-center gap-2">
                                          <Phone className="h-4 w-4 text-gray-500" />
                                          <div>
                                            <label className="text-sm font-medium text-gray-700">Phone</label>
                                            <p className="text-sm text-gray-900">{selectedRequest.requestorPhone}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Scheduling Information */}
                                {(selectedRequest.preferredDate || selectedRequest.preferredTime || selectedRequest.location) && (
                                  <div>
                                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                      Scheduling Information
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      {selectedRequest.preferredDate && (
                                        <div className="flex items-center gap-2">
                                          <Calendar className="h-4 w-4 text-gray-500" />
                                          <div>
                                            <label className="text-sm font-medium text-gray-700">Preferred Date</label>
                                            <p className="text-sm text-gray-900">{selectedRequest.preferredDate}</p>
                                          </div>
                                        </div>
                                      )}
                                      {selectedRequest.preferredTime && (
                                        <div className="flex items-center gap-2">
                                          <Clock className="h-4 w-4 text-gray-500" />
                                          <div>
                                            <label className="text-sm font-medium text-gray-700">Preferred Time</label>
                                            <p className="text-sm text-gray-900">{selectedRequest.preferredTime}</p>
                                          </div>
                                        </div>
                                      )}
                                      {selectedRequest.location && (
                                        <div className="flex items-center gap-2">
                                          <LocationIcon className="h-4 w-4 text-gray-500" />
                                          <div>
                                            <label className="text-sm font-medium text-gray-700">Location</label>
                                            <p className="text-sm text-gray-900">{selectedRequest.location}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Review Notes */}
                                {selectedRequest.reviewNotes && (
                                  <div>
                                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                      Review Notes
                                    </h3>
                                    <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                                      <p className="text-sm text-blue-700">{selectedRequest.reviewNotes}</p>
                                    </div>
                                  </div>
                                )}

                                {/* Assignment Information */}
                                {selectedRequest.assignedNotaryName && (
                                  <div>
                                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                      Assignment Information
                                    </h3>
                                    <div className="p-3 bg-green-50 rounded-md border border-green-200">
                                      <div className="space-y-2">
                                        <div>
                                          <label className="text-sm font-medium text-green-800">Assigned Notary</label>
                                          <p className="text-sm text-green-700">{selectedRequest.assignedNotaryName}</p>
                                        </div>
                                        {selectedRequest.assignmentNotes && (
                                          <div>
                                            <label className="text-sm font-medium text-green-800">Assignment Notes</label>
                                            <p className="text-sm text-green-700">{selectedRequest.assignmentNotes}</p>
                                          </div>
                                        )}
                                        {selectedRequest.assignedAt && (
                                          <div>
                                            <label className="text-sm font-medium text-green-800">Assigned At</label>
                                            <p className="text-sm text-green-700">{formatDate(selectedRequest.assignedAt)}</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Timestamps */}
                                <div>
                                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                                    Timestamps
                                  </h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Created</label>
                                      <p className="text-gray-900">{formatDate(selectedRequest.createdAt)}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Last Updated</label>
                                      <p className="text-gray-900">{formatDate(selectedRequest.updatedAt)}</p>
                                    </div>
                                    {selectedRequest.reviewedAt && (
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Reviewed At</label>
                                        <p className="text-gray-900">{formatDate(selectedRequest.reviewedAt)}</p>
                                      </div>
                                    )}
                                    {selectedRequest.convertedAt && (
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Converted to Job</label>
                                        <p className="text-gray-900">{formatDate(selectedRequest.convertedAt)}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Action Buttons - Only for pending requests */}
                                {selectedRequest.status === 'pending' && (
                                  <div className="border-t pt-6">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                      Review Actions
                                    </h3>
                                    <div className="space-y-4">
                                      <div>
                                        <label className="text-sm font-medium">Review Notes</label>
                                        <Textarea
                                          value={reviewNotes}
                                          onChange={(e) => setReviewNotes(e.target.value)}
                                          placeholder="Enter your review notes..."
                                          rows={4}
                                        />
                                      </div>
                                      <div className="flex gap-3">
                                        <Button
                                          onClick={() => handleReviewRequest(selectedRequest.id, 'approve')}
                                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3"
                                          size="lg"
                                        >
                                          <CheckCircle className="h-5 w-5 mr-2" />
                                          Approve Request
                                        </Button>
                                        <Button
                                          variant="destructive"
                                          onClick={() => handleReviewRequest(selectedRequest.id, 'reject')}
                                          className="flex-1 py-3"
                                          size="lg"
                                        >
                                          <XCircle className="h-5 w-5 mr-2" />
                                          Reject Request
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* View Job Button - Only if converted to job */}
                                {selectedRequest.convertedToJobId && (
                                  <div className="border-t pt-6">
                                    <Button
                                      onClick={() => {
                                        setIsViewDialogOpen(false);
                                        setLocation(`/jobs/${selectedRequest.convertedToJobId}`);
                                      }}
                                      className="w-full py-3"
                                      size="lg"
                                    >
                                      <ExternalLink className="h-5 w-5 mr-2" />
                                      View Associated Job
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                                        {/* Assign Button */}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setSelectedRequest(request);
                        setSelectedNotaryId('');
                        setAssignmentNotes('');
                        setIsAssignDialogOpen(true);
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white min-w-[140px]"
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      Assign to Notary
                    </Button>
                    
                    <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <UserCheck className="h-5 w-5" />
                            Assign Job Request to Notary
                          </DialogTitle>
                          <DialogDescription>
                            Select an available notary and provide assignment details for this job request.
                          </DialogDescription>
                        </DialogHeader>
                        
                        {selectedRequest && (
                          <div className="space-y-6">
                            {/* Job Request Summary */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <h4 className="font-semibold text-sm mb-2">Job Request Summary</h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-600">Title:</span>
                                  <p className="font-medium">{selectedRequest.title}</p>
                                </div>
                                <div>
                                  <span className="text-gray-600">Document Type:</span>
                                  <p className="font-medium capitalize">{selectedRequest.documentType.replace('_', ' ')}</p>
                                </div>
                                <div>
                                  <span className="text-gray-600">Urgency:</span>
                                  <Badge className={`${getUrgencyColor(selectedRequest.urgency)} mt-1`}>
                                    {selectedRequest.urgency.toUpperCase()}
                                  </Badge>
                                </div>
                                <div>
                                  <span className="text-gray-600">Requestor:</span>
                                  <p className="font-medium">{selectedRequest.requestorName || selectedRequest.requestorEmail}</p>
                                </div>
                              </div>
                            </div>

                            {/* Notary Selection */}
                            <div>
                              <label className="text-sm font-medium mb-2 block">Select Notary</label>
                              <Select value={selectedNotaryId} onValueChange={setSelectedNotaryId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose an available notary" />
                                </SelectTrigger>
                                <SelectContent>
                                  {notaries.length === 0 ? (
                                    <SelectItem value="" disabled>
                                      No available notaries found
                                    </SelectItem>
                                  ) : (
                                    notaries.map((notary) => (
                                      <SelectItem key={notary.id} value={notary.id.toString()}>
                                        <div className="flex items-center gap-2">
                                          <User className="h-4 w-4" />
                                          <div>
                                            <div className="font-medium">{notary.name}</div>
                                            <div className="text-xs text-gray-500">{notary.email}</div>
                                          </div>
                                        </div>
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              {notaries.length === 0 && (
                                <p className="text-sm text-red-600 mt-2">
                                  No available notaries found. Please ensure notaries are active in the system.
                                </p>
                              )}
                            </div>

                            {/* Assignment Details */}
                            <div>
                              <label className="text-sm font-medium mb-2 block">Assignment Notes</label>
                              <Textarea
                                value={assignmentNotes}
                                onChange={(e) => setAssignmentNotes(e.target.value)}
                                placeholder="Provide specific instructions, special requirements, or notes for the assigned notary..."
                                rows={4}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                These notes will be visible to the assigned notary and included in the assignment notification.
                              </p>
                            </div>

                            {/* Assignment Preview */}
                            {selectedNotaryId && (
                              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <h4 className="font-semibold text-sm text-blue-800 mb-2">Assignment Preview</h4>
                                <div className="text-sm text-blue-700">
                                  <p><strong>Notary:</strong> {notaries.find(n => n.id.toString() === selectedNotaryId)?.name}</p>
                                  <p><strong>Email:</strong> {notaries.find(n => n.id.toString() === selectedNotaryId)?.email}</p>
                                  {assignmentNotes && (
                                    <p><strong>Notes:</strong> {assignmentNotes}</p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-4 border-t">
                              <Button
                                variant="outline"
                                onClick={() => setIsAssignDialogOpen(false)}
                                className="flex-1"
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => handleAssignRequest(selectedRequest.id)}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                                disabled={!selectedNotaryId || notaries.length === 0}
                              >
                                <UserCheck className="h-4 w-4 mr-2" />
                                Assign to Notary
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 