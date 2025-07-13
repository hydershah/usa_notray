import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Clock, 
  ChevronRight, 
  MapPin, 
  Building, 
  Calendar,
  X,
  CheckCircle,
  XCircle,
  Eye,
  User,
  FileText
} from 'lucide-react';

interface PendingJob {
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

interface PendingJobsNotificationProps {
  onDismiss?: () => void;
}

export function PendingJobsNotification({ onDismiss }: PendingJobsNotificationProps) {
  const [, setLocation] = useLocation();
  const [pendingJobs, setPendingJobs] = useState<PendingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    fetchPendingJobs();
  }, []);

  const fetchPendingJobs = async () => {
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
      setPendingJobs(Array.isArray(jobs) ? jobs : []);
    } catch (error) {
      console.error('Error fetching job invitations:', error);
      setPendingJobs([]);
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
      
      // Remove the job from the pending list
      setPendingJobs(prev => prev.filter(job => job.id !== jobId));
      
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

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleViewJobs = () => {
    setLocation('/jobs');
  };

  if (loading || dismissed || pendingJobs.length === 0) {
    return null;
  }

  const totalPendingJobs = pendingJobs.length;
  const urgentJobs = pendingJobs.filter(job => {
    if (!job.selected_date) return false;
    const jobDate = new Date(job.selected_date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return jobDate <= tomorrow;
  });

  return (
    <Alert className="border-l-4 border-l-orange-500 bg-orange-50 border-orange-200 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Bell className="h-5 w-5 text-orange-600" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="font-semibold text-orange-900">
                {totalPendingJobs} Job Invitation{totalPendingJobs !== 1 ? 's' : ''} Awaiting Your Response
              </h3>
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                <Clock className="h-3 w-3 mr-1" />
                {totalPendingJobs}
              </Badge>
              {urgentJobs.length > 0 && (
                <Badge variant="destructive" className="bg-red-100 text-red-800">
                  {urgentJobs.length} Urgent
                </Badge>
              )}
            </div>
            
            <AlertDescription className="text-orange-800 mb-4">
              You have {totalPendingJobs} job invitation{totalPendingJobs !== 1 ? 's' : ''} that need your approval before you can start working.
              {urgentJobs.length > 0 && (
                <span className="font-medium text-red-700 ml-1">
                  {urgentJobs.length} job{urgentJobs.length !== 1 ? 's' : ''} scheduled for today/tomorrow.
                </span>
              )}
            </AlertDescription>

            {/* Show preview of first few jobs */}
            <div className="space-y-3 mb-4">
              {pendingJobs.slice(0, 3).map((job) => (
                <div key={job.id} className="flex items-start justify-between p-4 bg-white rounded-lg border border-orange-200 shadow-sm">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Building className="h-4 w-4 text-orange-600" />
                      <span className="font-medium text-gray-900">{job.title_company}</span>
                      <Badge variant="outline" className="text-xs">
                        {job.closing_type}
                      </Badge>
                      {job.requires_nsa && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                          NSA Required
                        </Badge>
                      )}
                      {job.requires_spanish_speaking && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                          Spanish
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
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
                      <div className="flex items-center space-x-1">
                        <FileText className="h-3 w-3" />
                        <span>{job.document_count} document{job.document_count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-gray-500 mb-3">
                      <span>Created by: {job.created_by_name}</span>
                      <span>•</span>
                      <span>{new Date(job.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(job.id)}
                        disabled={actionLoading === job.id}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {actionLoading === job.id ? 'Approving...' : 'Accept'}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(job.id)}
                        disabled={actionLoading === job.id}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLocation(`/jobs/${job.id}`)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              
              {pendingJobs.length > 3 && (
                <div className="text-center text-sm text-orange-600">
                  +{pendingJobs.length - 3} more invitation{pendingJobs.length - 3 !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <Button 
                onClick={handleViewJobs}
                className="bg-orange-600 hover:bg-orange-700 text-white"
                size="sm"
              >
                <Clock className="h-4 w-4 mr-2" />
                View All Invitations
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleDismiss}
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="text-orange-600 hover:bg-orange-100"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
} 