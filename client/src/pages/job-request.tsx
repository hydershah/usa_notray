import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { JobRequestForm } from '../components/job-request/JobRequestForm';
import { MyJobRequests } from '../components/job-request/MyJobRequests';
import { JobRequestDocuments } from '../components/job-request/JobRequestDocuments';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Plus, FileText, Clock, CheckCircle, AlertCircle, Edit, Eye, Trash2, RefreshCw, Calendar, MapPin, Phone, User, CalendarDays, Loader2, X, FileImage, FileText as FileTextIcon, File, Download } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { apiRequest } from '../lib/queryClient';

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

export default function JobRequestPage() {
  const [, setLocation] = useLocation();
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<JobRequest | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await apiRequest('GET', '/api/job-requests/my-requests');
      const result = await response.json();
      // Handle the correct response structure
      // API returns { success: true, data: { requests: [...], total: ..., page: ..., limit: ... } }
      const requestsData = result.data?.requests || result.data || [];
      setRequests(Array.isArray(requestsData) ? requestsData : []);
    } catch (error) {
      toast.error('Failed to fetch job requests');
      console.error('Error fetching requests:', error);
      setRequests([]); // Ensure we set an empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    fetchRequests();
    toast.success('Job request submitted successfully!');
  };

  const handleEditRequest = (request: JobRequest) => {
    setSelectedRequest(request);
    setIsEditing(true);
    setIsViewing(false);
    setIsModalOpen(true);
  };

  const handleViewRequest = (request: JobRequest) => {
    setSelectedRequest(request);
    setIsViewing(true);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleCreateRequest = () => {
    setSelectedRequest(null);
    setIsViewing(false);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleDeleteRequest = async (requestId: number) => {
    if (window.confirm('Are you sure you want to delete this request?')) {
      try {
        await apiRequest('DELETE', `/api/job-requests/${requestId}`);
        toast.success('Job request deleted successfully!');
        fetchRequests();
      } catch (error) {
        toast.error('Failed to delete job request');
        console.error('Error deleting request:', error);
      }
    }
  };

  const getStatusStats = () => {
    const stats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      assigned: 0,
      completed: 0,
      cancelled: 0,
    };

    if (Array.isArray(requests)) {
      requests.forEach(request => {
        stats[request.status as keyof typeof stats]++;
      });
    }

    return stats;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'assigned':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'cancelled':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'normal':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'low':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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

  const stats = getStatusStats();

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Requests</h1>
            <p className="text-gray-600 mt-1">Manage your notarization service requests</p>
          </div>
          <Button
            onClick={handleCreateRequest}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            New Request
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Pending</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.pending}</p>
                </div>
                <div className="p-2 bg-blue-200 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-700">Approved</p>
                  <p className="text-2xl font-bold text-emerald-900">{stats.approved}</p>
                </div>
                <div className="p-2 bg-emerald-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700">Rejected</p>
                  <p className="text-2xl font-bold text-red-900">{stats.rejected}</p>
                </div>
                <div className="p-2 bg-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Assigned</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.assigned}</p>
                </div>
                <div className="p-2 bg-blue-200 rounded-lg">
                  <User className="h-5 w-5 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Completed</p>
                  <p className="text-2xl font-bold text-green-900">{stats.completed}</p>
                </div>
                <div className="p-2 bg-green-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Cancelled</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.cancelled}</p>
                </div>
                <div className="p-2 bg-gray-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-gray-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b border-gray-200 px-6">
                <TabsList className="grid w-full grid-cols-3 bg-gray-50">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-blue-600">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="requests" className="data-[state=active]:bg-white data-[state=active]:text-blue-600">
                    My Requests
                  </TabsTrigger>
                  <TabsTrigger value="create" className="data-[state=active]:bg-white data-[state=active]:text-blue-600">
                    Create New
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="p-6">
                <TabsContent value="overview" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="border-gray-200">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <FileText className="h-5 w-5 text-blue-600" />
                          Recent Requests
                        </CardTitle>
                        <CardDescription>
                          Your latest job requests and their current status
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {loading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                          </div>
                        ) : requests.length === 0 ? (
                          <div className="text-center py-8">
                            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">No job requests found</p>
                            <Button
                              onClick={handleCreateRequest}
                              variant="outline"
                              className="mt-4"
                            >
                              Create Your First Request
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {requests.slice(0, 5).map((request) => (
                              <div
                                key={request.id}
                                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                              >
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900">{request.title}</h4>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {request.documentType.replace('_', ' ')}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={getStatusColor(request.status)}>
                                    {request.status}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewRequest(request)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-gray-200">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Calendar className="h-5 w-5 text-blue-600" />
                          Quick Actions
                        </CardTitle>
                        <CardDescription>
                          Common actions for managing your requests
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Button
                          onClick={handleCreateRequest}
                          className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Submit New Request
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setActiveTab('requests')}
                          className="w-full justify-start"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View All Requests
                        </Button>
                        <Button
                          variant="outline"
                          onClick={fetchRequests}
                          className="w-full justify-start"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh Data
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="requests">
                  <MyJobRequests 
                    onEditRequest={handleEditRequest}
                    onViewRequest={handleViewRequest}
                  />
                </TabsContent>

                <TabsContent value="create">
                  <Card className="border-gray-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5 text-blue-600" />
                        Create New Job Request
                      </CardTitle>
                      <CardDescription>
                        Submit a new request for notarization services
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <JobRequestForm onSuccess={handleSuccess} />
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Modal for Create/Edit/View */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 bg-white">
          {/* Enhanced Header */}
          <div className="p-4 pb-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-gray-900">
                    {isViewing ? 'Job Request Details' : isEditing ? 'Edit Job Request' : 'Submit New Job Request'}
                  </DialogTitle>
                  <DialogDescription>
                    {isViewing 
                      ? 'View the complete details of your job request and its current status.'
                      : isEditing 
                      ? 'Update your job request details below. Only pending requests can be edited.'
                      : 'Submit a comprehensive request for notarization services. Our admin team will review your request and assign a qualified notary.'
                    }
                  </DialogDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {isViewing && selectedRequest ? (
            <div className="flex h-[calc(90vh-120px)]">
              {/* Left Panel - Document Viewer */}
              <div className="w-2/5 border-r border-gray-200 bg-gray-50 flex flex-col">
                <div className="p-4 border-b border-gray-200 bg-white">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-900">
                    <div className="p-1.5 bg-blue-100 rounded-lg">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    Documents
                  </h3>
                  <JobRequestDocuments requestId={selectedRequest.id} canView={true} />
                </div>
                
                {/* Document Preview Area */}
                <div className="flex-1 p-4">
                  {selectedDocument ? (
                    <div className="h-full bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                      <iframe
                        src={selectedDocument}
                        className="w-full h-full"
                        title="Document Preview"
                      />
                    </div>
                  ) : (
                    <div className="h-full bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-base font-medium">Document Preview</p>
                        <p className="text-sm">Select a document to view</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel - Request Details */}
              <div className="w-3/5 overflow-y-auto bg-white">
                <div className="p-6 space-y-6">
                  {/* Request Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-900">
                          <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>
                          Request Information
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium text-gray-700">Title</label>
                            <p className="text-sm text-gray-900 font-medium mt-1">{selectedRequest.title}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700">Description</label>
                            <p className="text-sm text-gray-900 mt-1 leading-relaxed">{selectedRequest.description}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700">Document Type</label>
                            <p className="text-sm text-gray-900 capitalize mt-1">{selectedRequest.documentType.replace('_', ' ')}</p>
                          </div>
                          <div className="flex gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700">Status</label>
                              <Badge className={`${getStatusColor(selectedRequest.status)} mt-2 flex items-center gap-1`}>
                                {selectedRequest.status.toUpperCase()}
                              </Badge>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700">Urgency</label>
                              <Badge className={`${getUrgencyColor(selectedRequest.urgency)} mt-2`}>
                                {selectedRequest.urgency.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-3 text-gray-900">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          Schedule & Location
                        </h3>
                        <div className="space-y-4">
                          {selectedRequest.preferredDate && (
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                              <Calendar className="h-5 w-5 text-gray-500" />
                              <div>
                                <label className="text-sm font-medium text-gray-700">Preferred Date</label>
                                <p className="text-sm text-gray-900 font-medium">{formatDate(selectedRequest.preferredDate)}</p>
                              </div>
                            </div>
                          )}
                          {selectedRequest.preferredTime && (
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                              <Clock className="h-5 w-5 text-gray-500" />
                              <div>
                                <label className="text-sm font-medium text-gray-700">Preferred Time</label>
                                <p className="text-sm text-gray-900 font-medium">{formatTime(selectedRequest.preferredTime)}</p>
                              </div>
                            </div>
                          )}
                          {selectedRequest.location && (
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                              <MapPin className="h-5 w-5 text-gray-500" />
                              <div>
                                <label className="text-sm font-medium text-gray-700">Location</label>
                                <p className="text-sm text-gray-900 font-medium">{selectedRequest.location}</p>
                              </div>
                            </div>
                          )}
                          {selectedRequest.requestorPhone && (
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                              <Phone className="h-5 w-5 text-gray-500" />
                              <div>
                                <label className="text-sm font-medium text-gray-700">Contact Phone</label>
                                <p className="text-sm text-gray-900 font-medium">{selectedRequest.requestorPhone}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-3 text-gray-900">
                      <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                      Timeline
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Calendar className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">Created</label>
                          <p className="text-sm text-gray-900 font-medium">{formatDate(selectedRequest.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex gap-3">
                      {selectedRequest.status === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsViewing(false);
                              setIsEditing(true);
                            }}
                            className="flex items-center gap-2 hover:bg-gray-50"
                          >
                            <Edit className="h-4 w-4" />
                            Edit Request
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleDeleteRequest(selectedRequest.id)}
                            className="flex items-center gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Request
                          </Button>
                        </>
                      )}
                      <Button 
                        variant="outline" 
                        onClick={() => setIsModalOpen(false)}
                        className="ml-auto hover:bg-gray-50"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto bg-gray-50">
              <div className="p-4">
                <JobRequestForm 
                  onSuccess={handleSuccess}
                  editData={isEditing ? selectedRequest : undefined}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
} 