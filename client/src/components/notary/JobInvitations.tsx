import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bell, 
  Clock, 
  MapPin, 
  Building, 
  Calendar,
  CheckCircle,
  XCircle,
  Eye,
  User,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Shield
} from 'lucide-react';

interface JobInvitation {
  id: number;
  title_company: string;
  closing_type: string;
  internal_reference?: string;
  selected_date: string;
  selected_time: string;
  job_status: string;
  notary_approval_status: string;
  property_address_one: string;
  property_city: string;
  property_state: string;
  property_zip_code: string;
  requires_nsa: boolean;
  requires_spanish_speaking: boolean;
  created_at: string;
  scheduled_at?: string;
  kba_required: boolean;
  total_participants: number;
  verified_participants: number;
  signer_count: number;
  witness_count: number;
  created_by_username: string;
  created_by_email: string;
  created_by_name: string;
  document_count: number;
}

interface JobInvitationsProps {
  refreshTrigger?: number;
}

export function JobInvitations({ refreshTrigger }: JobInvitationsProps) {
  const [, setLocation] = useLocation();
  const [jobInvitations, setJobInvitations] = useState<JobInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobInvitation | null>(null);

  useEffect(() => {
    fetchJobInvitations();
  }, [refreshTrigger]);

  const fetchJobInvitations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/notary/job-invitations', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch job invitations');
      }

      const jobs = await response.json();
      setJobInvitations(Array.isArray(jobs) ? jobs : []);
    } catch (error) {
      console.error('Error fetching job invitations:', error);
      setJobInvitations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleJobAction = async (jobId: number, action: 'approve' | 'reject', reason?: string) => {
    try {
      setActionLoading(jobId);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/notary/jobs/${jobId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(action === 'reject' ? { reason } : {})
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} job`);
      }

      const result = await response.json();
      
      // Remove the job from the invitations list
      setJobInvitations(prev => prev.filter(job => job.id !== jobId));
      
      // Clear selected job if it was the one acted upon
      if (selectedJob?.id === jobId) {
        setSelectedJob(null);
      }
      
      // Show success message
      console.log(`Job ${action}ed successfully:`, result);
      
    } catch (error) {
      console.error(`Error ${action}ing job:`, error);
      // You might want to show an error toast here
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = (jobId: number) => {
    handleJobAction(jobId, 'approve');
  };

  const handleReject = (jobId: number) => {
    const reason = prompt('Please provide a reason for rejecting this job:');
    if (reason && reason.trim()) {
      handleJobAction(jobId, 'reject', reason.trim());
    }
  };

  const isUrgent = (job: JobInvitation) => {
    if (!job.selected_date) return false;
    const jobDate = new Date(job.selected_date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return jobDate <= tomorrow;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading job invitations...</p>
        </div>
      </div>
    );
  }

  if (jobInvitations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Job Invitations</CardTitle>
          <CardDescription>
            No pending job invitations at the moment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
            <p className="text-gray-600">
              You have no pending job invitations. New invitations will appear here when they're assigned to you.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Alert */}
      <Alert className="border-orange-200 bg-orange-50">
        <AlertCircle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <strong>Action Required:</strong> You have {jobInvitations.length} job invitation{jobInvitations.length !== 1 ? 's' : ''} waiting for your response. 
          You must approve jobs before you can start working on them.
        </AlertDescription>
      </Alert>

      {/* Job Invitations List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invitations List */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Bell className="h-5 w-5 mr-2 text-orange-600" />
                Job Invitations ({jobInvitations.length})
              </CardTitle>
              <CardDescription>
                Click on a job to view details and take action
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {jobInvitations.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedJob?.id === job.id
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Building className="h-4 w-4 text-orange-600" />
                          <span className="font-medium text-gray-900">{job.title_company}</span>
                          <Badge variant="outline" className="text-xs">
                            {job.closing_type}
                          </Badge>
                          {isUrgent(job) && (
                            <Badge variant="destructive" className="text-xs">
                              Urgent
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-3 w-3" />
                            <span>{job.property_city}, {job.property_state}</span>
                          </div>
                          
                          {job.selected_date && (
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(job.selected_date).toLocaleDateString()}</span>
                              {job.selected_time && (
                                <span className="ml-1">at {job.selected_time}</span>
                              )}
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-1">
                            <User className="h-3 w-3" />
                            <span>{job.signer_count} signer{job.signer_count !== 1 ? 's' : ''}</span>
                            {job.witness_count > 0 && (
                              <span>, {job.witness_count} witness{job.witness_count !== 1 ? 'es' : ''}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        {job.requires_nsa && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                            NSA
                          </Badge>
                        )}
                        {job.requires_spanish_speaking && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                            ES
                          </Badge>
                        )}
                        {job.kba_required && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                            KBA
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Job Details Panel */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Details</CardTitle>
              <CardDescription>
                {selectedJob ? `Details for ${selectedJob.title_company}` : 'Select a job to view details'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedJob ? (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {selectedJob.title_company}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {selectedJob.closing_type}
                        {selectedJob.internal_reference && (
                          <span className="ml-2">• Ref: {selectedJob.internal_reference}</span>
                        )}
                      </p>
                    </div>
                    {isUrgent(selectedJob) && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Urgent
                      </Badge>
                    )}
                  </div>

                  {/* Property Details */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Property Information</h4>
                    <div className="text-sm space-y-1">
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span>
                          {selectedJob.property_address_one}<br />
                          {selectedJob.property_city}, {selectedJob.property_state} {selectedJob.property_zip_code}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Scheduling */}
                  {selectedJob.selected_date && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900">Scheduled Time</h4>
                      <div className="flex items-center space-x-2 text-sm">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>
                          {new Date(selectedJob.selected_date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                          {selectedJob.selected_time && (
                            <span className="ml-1">at {selectedJob.selected_time}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Requirements */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Requirements</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedJob.requires_nsa && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          <Shield className="h-3 w-3 mr-1" />
                          NSA Required
                        </Badge>
                      )}
                      {selectedJob.requires_spanish_speaking && (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          Spanish Speaking
                        </Badge>
                      )}
                      {selectedJob.kba_required && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          KBA Required
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Participants */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Participants</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Signers:</span> {selectedJob.signer_count}
                      </div>
                      <div>
                        <span className="font-medium">Witnesses:</span> {selectedJob.witness_count}
                      </div>
                      <div>
                        <span className="font-medium">Documents:</span> {selectedJob.document_count}
                      </div>
                      <div>
                        <span className="font-medium">Verified:</span> {selectedJob.verified_participants}/{selectedJob.total_participants}
                      </div>
                    </div>
                  </div>

                  {/* Created By */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Created By</h4>
                    <div className="text-sm">
                      <p className="font-medium">{selectedJob.created_by_name}</p>
                      <p className="text-gray-600">{selectedJob.created_by_email}</p>
                      <p className="text-gray-500">
                        {new Date(selectedJob.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-3 pt-4 border-t">
                    <Button
                      onClick={() => handleApprove(selectedJob.id)}
                      disabled={actionLoading === selectedJob.id}
                      className="bg-green-600 hover:bg-green-700 text-white flex-1"
                    >
                      {actionLoading === selectedJob.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Accept Job
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => handleReject(selectedJob.id)}
                      disabled={actionLoading === selectedJob.id}
                      className="text-red-600 border-red-200 hover:bg-red-50 flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Decline
                    </Button>
                    
                    <Button
                      variant="ghost"
                      onClick={() => setLocation(`/jobs/${selectedJob.id}`)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Full Details
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Select a job invitation to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 