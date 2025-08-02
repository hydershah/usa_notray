import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, FileText, User, Calendar, Clock, MapPin, AlertCircle, CheckCircle, XCircle, UserCheck, ExternalLink, Edit, Trash2, Eye } from 'lucide-react';
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

interface MyJobRequestsProps {
  className?: string;
  onEditRequest?: (request: JobRequest) => void;
  onViewRequest?: (request: JobRequest) => void;
}

export function MyJobRequests({ className, onEditRequest, onViewRequest }: MyJobRequestsProps) {
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const fetchMyRequests = async () => {
    try {
      const response = await apiRequest('GET', '/api/job-requests/my-requests');
      const result = await response.json();

      // Handle the correct response structure
      // API returns { success: true, data: { requests: [...], total: ..., page: ..., limit: ... } }
      const requestsData = result.data?.requests || result.data || [];
      setRequests(Array.isArray(requestsData) ? requestsData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requests');
      toast.error('Failed to fetch your job requests');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = async (requestId: number) => {
    if (!confirm('Are you sure you want to delete this job request? This action cannot be undone.')) {
      return;
    }

    try {
      await apiRequest('DELETE', `/api/job-requests/${requestId}`);
      toast.success('Job request deleted successfully');
      fetchMyRequests();
    } catch (error) {
      toast.error('Failed to delete job request');
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
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      case 'assigned':
        return <UserCheck className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
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

  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Your request is being reviewed by our admin team.';
      case 'approved':
        return 'Your request has been approved and is being processed.';
      case 'rejected':
        return 'Your request has been rejected. Please check the review notes for details.';
      case 'assigned':
        return 'A notary has been assigned to your request.';
      case 'completed':
        return 'Your request has been completed and converted to a job.';
      case 'cancelled':
        return 'Your request has been cancelled.';
      default:
        return 'Unknown status.';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading your job requests...</span>
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
          <h2 className="text-2xl font-bold">My Job Requests</h2>
          <p className="text-gray-600">Track the status of your submitted job requests</p>
        </div>
        <Badge variant="outline" className="text-sm">
          {requests.length} Total
        </Badge>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Job Requests</h3>
            <p className="text-gray-500 text-center mb-4">
              You haven't submitted any job requests yet.
            </p>
            <Button onClick={() => setLocation('/job-request')}>
              Submit Your First Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
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
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Submitted {formatDate(request.createdAt)}</span>
                  </div>
                </div>

                {/* Status Description */}
                <div className="mb-4 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-700">
                    {getStatusDescription(request.status)}
                  </p>
                </div>

                {/* Review Notes */}
                {request.reviewNotes && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-200">
                    <h4 className="text-sm font-semibold text-blue-800 mb-1">Admin Review Notes:</h4>
                    <p className="text-sm text-blue-700">{request.reviewNotes}</p>
                  </div>
                )}

                {/* Assignment Notes */}
                {request.assignmentNotes && (
                  <div className="mb-4 p-3 bg-green-50 rounded-md border border-green-200">
                    <h4 className="text-sm font-semibold text-green-800 mb-1">Assignment Notes:</h4>
                    <p className="text-sm text-green-700">{request.assignmentNotes}</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Last updated {formatDate(request.updatedAt)}
                  </div>
                  <div className="flex gap-2">
                    {/* View Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewRequest ? onViewRequest(request) : null}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>

                    {/* Edit Button - Only for pending requests */}
                    {request.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditRequest ? onEditRequest(request) : null}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    )}

                    {/* Delete Button - Only for pending requests */}
                    {request.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRequest(request.id)}
                        className="text-red-500 hover:text-red-700 border-red-200 hover:border-red-300"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    )}

                    {/* View Job Button - Only if converted to job */}
                    {request.convertedToJobId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/jobs/${request.convertedToJobId}`)}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Job
                      </Button>
                    )}
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