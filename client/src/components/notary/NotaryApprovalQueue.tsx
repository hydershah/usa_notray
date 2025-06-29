import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  FileText,
  MapPin,
  Calendar,
  Building2,
  Shield
} from 'lucide-react';

interface ApprovalQueueItem {
  id: number;
  jobId: number;
  titleCompany: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  deadline: string | null;
  specialInstructions: string | null;
  createdAt: string;
  closingType: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  scheduledDate: string;
  scheduledTime: string;
  jobStatus: string;
  notaryApprovalStatus: string;
  kbaRequired: boolean;
  requiresNSA: boolean;
  requiresSpanishSpeaking: boolean;
}

export function NotaryApprovalQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedJob, setSelectedJob] = useState<ApprovalQueueItem | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvalConditions, setApprovalConditions] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');

  // Fetch approval queue
  const { data: approvalQueue = [], isLoading, refetch } = useQuery<ApprovalQueueItem[]>({
    queryKey: ['/api/approval/queue'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Approve job mutation
  const approveJobMutation = useMutation({
    mutationFn: async ({ jobId, notes, conditions }: { jobId: number; notes?: string; conditions?: string }) => {
      const response = await apiRequest('POST', `/api/approval/approve/${jobId}`, {
        notes,
        conditions
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Job Approved",
        description: "The job has been approved and signer notifications will be sent automatically.",
      });
      setShowApprovalDialog(false);
      setApprovalNotes('');
      setApprovalConditions('');
      setSelectedJob(null);
      queryClient.invalidateQueries({ queryKey: ['/api/approval/queue'] });
      refetch();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Approval Failed",
        description: error.message || "Failed to approve the job. Please try again.",
      });
    },
  });

  // Reject job mutation
  const rejectJobMutation = useMutation({
    mutationFn: async ({ jobId, rejectionReason, notes }: { jobId: number; rejectionReason: string; notes?: string }) => {
      const response = await apiRequest('POST', `/api/approval/reject/${jobId}`, {
        rejectionReason,
        notes
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Job Rejected",
        description: "The job has been rejected and will be reassigned.",
      });
      setShowRejectDialog(false);
      setRejectionReason('');
      setRejectionNotes('');
      setSelectedJob(null);
      queryClient.invalidateQueries({ queryKey: ['/api/approval/queue'] });
      refetch();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Rejection Failed",
        description: error.message || "Failed to reject the job. Please try again.",
      });
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'normal': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const handleApprove = (job: ApprovalQueueItem) => {
    setSelectedJob(job);
    setShowApprovalDialog(true);
  };

  const handleReject = (job: ApprovalQueueItem) => {
    setSelectedJob(job);
    setShowRejectDialog(true);
  };

  const submitApproval = () => {
    if (!selectedJob) return;
    
    approveJobMutation.mutate({
      jobId: selectedJob.jobId,
      notes: approvalNotes,
      conditions: approvalConditions
    });
  };

  const submitRejection = () => {
    if (!selectedJob || !rejectionReason) {
      toast({
        variant: "destructive",
        title: "Rejection Reason Required",
        description: "Please provide a reason for rejecting this job.",
      });
      return;
    }
    
    rejectJobMutation.mutate({
      jobId: selectedJob.jobId,
      rejectionReason,
      notes: rejectionNotes
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approval Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading approval queue...</div>
        </CardContent>
      </Card>
    );
  }

  if (approvalQueue.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Approval Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
            <p className="text-gray-600">No jobs pending your approval at this time.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Approval Queue
              <Badge variant="outline">{approvalQueue.length} pending</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {approvalQueue.map((job) => (
              <Card key={job.id} className={`border ${isOverdue(job.deadline) ? 'border-red-300 bg-red-50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">Job #{job.jobId}</h3>
                        <Badge className={getPriorityColor(job.priority)}>
                          <span>{job.priority.toUpperCase()}</span>
                        </Badge>
                        {isOverdue(job.deadline) && (
                          <Badge variant="destructive">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            OVERDUE
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">{job.titleCompany}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-500" />
                            <span>{job.closingType}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span>{job.propertyAddress}, {job.propertyCity}, {job.propertyState}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span>{job.scheduledDate} at {job.scheduledTime}</span>
                          </div>
                          <div className="flex gap-1">
                            {job.kbaRequired && (
                              <Badge variant="outline" className="text-xs">KBA Required</Badge>
                            )}
                            {job.requiresNSA && (
                              <Badge variant="outline" className="text-xs">NSA Required</Badge>
                            )}
                            {job.requiresSpanishSpeaking && (
                              <Badge variant="outline" className="text-xs">Spanish Required</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {job.specialInstructions && (
                        <Alert className="mt-3">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Special Instructions:</strong> {job.specialInstructions}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <Button 
                        onClick={() => handleApprove(job)}
                        className="bg-green-600 hover:bg-green-700"
                        size="sm"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleReject(job)}
                        size="sm"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Job #{selectedJob?.jobId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="approval-notes">Approval Notes (Optional)</Label>
              <Textarea
                id="approval-notes"
                placeholder="Add any notes about this approval..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                rows={3}
              />
            </div>
            
            <div>
              <Label htmlFor="approval-conditions">Special Conditions (Optional)</Label>
              <Textarea
                id="approval-conditions"
                placeholder="Any special conditions or requirements..."
                value={approvalConditions}
                onChange={(e) => setApprovalConditions(e.target.value)}
                rows={2}
              />
            </div>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Approving this job will automatically send notifications to all signers and start the signing process.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={submitApproval}
                disabled={approveJobMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {approveJobMutation.isPending ? 'Approving...' : 'Approve Job'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Job #{selectedJob?.jobId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection-reason">Rejection Reason *</Label>
              <select
                id="rejection-reason"
                className="w-full mt-1 border border-gray-300 rounded-md px-3 py-2"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              >
                <option value="">Select a reason</option>
                <option value="scheduling_conflict">Scheduling Conflict</option>
                <option value="travel_distance">Travel Distance Too Far</option>
                <option value="missing_information">Missing Information</option>
                <option value="technical_requirements">Cannot Meet Technical Requirements</option>
                <option value="client_communication">Client Communication Issues</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div>
              <Label htmlFor="rejection-notes">Additional Notes (Optional)</Label>
              <Textarea
                id="rejection-notes"
                placeholder="Provide additional details about the rejection..."
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                rows={3}
              />
            </div>

            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Rejecting this job will remove you from the assignment and trigger re-assignment to another notary.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={submitRejection}
                disabled={rejectJobMutation.isPending || !rejectionReason}
              >
                {rejectJobMutation.isPending ? 'Rejecting...' : 'Reject Job'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
