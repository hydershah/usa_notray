import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { 
  CheckCircle, XCircle, AlertCircle, ShieldCheck, UserCheck, 
  UserX, Calendar, Briefcase, RefreshCw, History, User
} from "lucide-react";

interface JobParticipant {
  participant_id: number;
  job_id: number;
  user_id: number;
  participant_role: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone_number: string;
  is_verified: boolean;
  verification_status: string;
  admin_bypassed: boolean;
  notary_verification_bypassed: boolean;
  notary_verification_bypassed_by: number | null;
  notary_verification_bypassed_at: string | null;
  notary_verification_bypass_reason: string | null;
  bypassed_by_notary_name: string | null;
  evs_transaction_id: string | null;
  evs_verification_confidence: number | null;
  invite_status: string;
  joined_at: string | null;
}

interface AssignedJob {
  id: number;
  title_company: string;
  closing_type: string;
  selected_date: string;
  selected_time: string;
  job_status: string;
  property_address_one: string;
  property_city: string;
  property_state: string;
  total_participants: number;
  verified_participants: number;
  signer_count: number;
  witness_count: number;
}

interface BypassLog {
  id: number;
  job_id: number;
  participant_id: number;
  notary_id: number;
  action: 'bypass' | 'remove_bypass';
  reason: string;
  previous_verification_status: string;
  created_at: string;
  participant_name: string;
  participant_email: string;
  notary_name: string;
  title_company: string;
  closing_type: string;
}

export function ParticipantVerificationManager() {
  const [assignedJobs, setAssignedJobs] = useState<AssignedJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<AssignedJob | null>(null);
  const [participants, setParticipants] = useState<JobParticipant[]>([]);
  const [bypassLogs, setBypassLogs] = useState<BypassLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [bypassDialog, setBypassDialog] = useState<{
    open: boolean;
    participant: JobParticipant | null;
    action: 'bypass' | 'remove';
  }>({ open: false, participant: null, action: 'bypass' });
  const [bypassReason, setBypassReason] = useState('');
  const [activeTab, setActiveTab] = useState('participants');

  useEffect(() => {
    fetchAssignedJobs();
  }, []);

  useEffect(() => {
    if (selectedJob) {
      fetchJobParticipants(selectedJob.id);
      if (activeTab === 'history') {
        fetchBypassLogs(selectedJob.id);
      }
    }
  }, [selectedJob, activeTab]);

  const fetchAssignedJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notary/assigned-jobs', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAssignedJobs(data);
        if (data.length > 0 && !selectedJob) {
          setSelectedJob(data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching assigned jobs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch assigned jobs"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchJobParticipants = async (jobId: number) => {
    try {
      const response = await fetch(`/api/notary/job-participants/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setParticipants(data);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch job participants"
      });
    }
  };

  const fetchBypassLogs = async (jobId: number) => {
    try {
      const response = await fetch(`/api/notary/bypass-log/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBypassLogs(data);
      }
    } catch (error) {
      console.error('Error fetching bypass logs:', error);
    }
  };

  const handleBypassVerification = async () => {
    if (!bypassDialog.participant || !selectedJob || !bypassReason.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide a reason for the bypass"
      });
      return;
    }

    try {
      const endpoint = bypassDialog.action === 'bypass' 
        ? `/api/notary/bypass-verification/${bypassDialog.participant.user_id}/${selectedJob.id}`
        : `/api/notary/remove-bypass/${bypassDialog.participant.user_id}/${selectedJob.id}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: bypassReason })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: bypassDialog.action === 'bypass' 
            ? "Verification bypassed successfully" 
            : "Bypass removed successfully"
        });
        
        // Refresh data
        fetchJobParticipants(selectedJob.id);
        if (activeTab === 'history') {
          fetchBypassLogs(selectedJob.id);
        }
        
        // Close dialog
        setBypassDialog({ open: false, participant: null, action: 'bypass' });
        setBypassReason('');
      } else {
        const error = await response.json();
        toast({
          variant: "destructive",
          title: "Error",
          description: error.error || "Failed to update verification status"
        });
      }
    } catch (error) {
      console.error('Error updating verification:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update verification status"
      });
    }
  };

  const getVerificationStatus = (participant: JobParticipant) => {
    if (participant.is_verified) {
      if (participant.notary_verification_bypassed) {
        return { label: 'Notary Bypassed', color: 'bg-purple-100 text-purple-800' };
      } else if (participant.admin_bypassed) {
        return { label: 'Admin Bypassed', color: 'bg-blue-100 text-blue-800' };
      } else {
        return { label: 'EVS Verified', color: 'bg-green-100 text-green-800' };
      }
    } else {
      return { label: 'Not Verified', color: 'bg-red-100 text-red-800' };
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Participant Verification Manager</h2>
        <p className="text-gray-600">
          Manage ID verification for signers and witnesses in your assigned jobs
        </p>
      </div>

      {/* Job Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Job</CardTitle>
        </CardHeader>
        <CardContent>
          <Select 
            value={selectedJob?.id.toString()} 
            onValueChange={(value) => {
              const job = assignedJobs.find(j => j.id.toString() === value);
              setSelectedJob(job || null);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a job" />
            </SelectTrigger>
            <SelectContent>
              {assignedJobs.map((job) => (
                <SelectItem key={job.id} value={job.id.toString()}>
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">{job.title_company} - {job.closing_type}</span>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge variant="outline">
                        {job.verified_participants}/{job.total_participants} verified
                      </Badge>
                      {job.selected_date && (
                        <span className="text-sm text-gray-500">
                          {new Date(job.selected_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedJob && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Property:</span>
                  <p className="font-medium">
                    {selectedJob.property_address_one}, {selectedJob.property_city}, {selectedJob.property_state}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Participants:</span>
                  <p className="font-medium">
                    {selectedJob.signer_count} Signers, {selectedJob.witness_count} Witnesses
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      {selectedJob && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="participants">
              <UserCheck className="w-4 h-4 mr-2" />
              Participants
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-2" />
              Bypass History
            </TabsTrigger>
          </TabsList>

          {/* Participants Tab */}
          <TabsContent value="participants" className="space-y-4">
            {participants.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <p className="text-gray-500">No participants found for this job</p>
                </CardContent>
              </Card>
            ) : (
              participants.map((participant) => {
                const status = getVerificationStatus(participant);
                return (
                  <Card key={participant.participant_id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-3">
                            <User className="w-8 h-8 text-gray-400" />
                            <div>
                              <h4 className="font-semibold text-lg">
                                {participant.full_name || `${participant.first_name} ${participant.last_name}`}
                              </h4>
                              <p className="text-sm text-gray-600">{participant.email}</p>
                            </div>
                            <Badge variant="outline" className="ml-2">
                              {participant.participant_role}
                            </Badge>
                            <Badge className={status.color}>
                              {status.label}
                            </Badge>
                          </div>

                          {participant.notary_verification_bypassed && (
                            <Alert>
                              <ShieldCheck className="h-4 w-4" />
                              <AlertDescription>
                                <strong>Bypassed by:</strong> {participant.bypassed_by_notary_name || 'You'} on{' '}
                                {new Date(participant.notary_verification_bypassed_at!).toLocaleString()}
                                <br />
                                <strong>Reason:</strong> {participant.notary_verification_bypass_reason}
                              </AlertDescription>
                            </Alert>
                          )}

                          {participant.admin_bypassed && !participant.notary_verification_bypassed && (
                            <Alert>
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                This participant was already verified by an administrator
                              </AlertDescription>
                            </Alert>
                          )}

                          {participant.evs_transaction_id && !participant.notary_verification_bypassed && !participant.admin_bypassed && (
                            <div className="text-sm text-gray-600">
                              <strong>EVS Verified:</strong> Confidence {participant.evs_verification_confidence}%
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {!participant.is_verified && (
                            <Button
                              onClick={() => setBypassDialog({ 
                                open: true, 
                                participant, 
                                action: 'bypass' 
                              })}
                              variant="outline"
                              className="text-purple-600 border-purple-300 hover:bg-purple-50"
                            >
                              <ShieldCheck className="w-4 h-4 mr-2" />
                              Bypass Verification
                            </Button>
                          )}
                          
                          {participant.notary_verification_bypassed && (
                            <Button
                              onClick={() => setBypassDialog({ 
                                open: true, 
                                participant, 
                                action: 'remove' 
                              })}
                              variant="outline"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Remove Bypass
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            {bypassLogs.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <p className="text-gray-500">No bypass history for this job</p>
                </CardContent>
              </Card>
            ) : (
              bypassLogs.map((log) => (
                <Card key={log.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={log.action === 'bypass' ? 'default' : 'destructive'}>
                            {log.action === 'bypass' ? 'Bypassed' : 'Removed'}
                          </Badge>
                          <span className="font-medium">{log.participant_name}</span>
                          <span className="text-sm text-gray-500">({log.participant_email})</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          <strong>Reason:</strong> {log.reason}
                        </p>
                        <p className="text-xs text-gray-500">
                          By {log.notary_name} on {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Bypass Dialog */}
      <Dialog open={bypassDialog.open} onOpenChange={(open) => {
        if (!open) {
          setBypassDialog({ open: false, participant: null, action: 'bypass' });
          setBypassReason('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bypassDialog.action === 'bypass' ? 'Bypass Verification' : 'Remove Bypass'}
            </DialogTitle>
            <DialogDescription>
              {bypassDialog.action === 'bypass' 
                ? `This will allow ${bypassDialog.participant?.full_name} to join the signing session without completing ID verification.`
                : `This will remove the verification bypass for ${bypassDialog.participant?.full_name}.`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason *</label>
              <Textarea
                placeholder={
                  bypassDialog.action === 'bypass'
                    ? "Example: I personally know this participant and have verified their identity in person"
                    : "Example: Participant needs to complete formal ID verification"
                }
                value={bypassReason}
                onChange={(e) => setBypassReason(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>

            {bypassDialog.action === 'bypass' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> By bypassing verification, you are personally attesting to the identity of this participant. 
                  This bypass only applies to this specific job.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBypassDialog({ open: false, participant: null, action: 'bypass' });
                setBypassReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBypassVerification}
              disabled={!bypassReason.trim()}
              variant={bypassDialog.action === 'bypass' ? 'default' : 'destructive'}
            >
              {bypassDialog.action === 'bypass' ? 'Bypass Verification' : 'Remove Bypass'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 