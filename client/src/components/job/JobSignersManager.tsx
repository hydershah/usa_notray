import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/api';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Mail, 
  Phone, 
  User, 
  UserCheck, 
  UserX,
  Send,
  Eye,
  RefreshCw
} from 'lucide-react';

interface JobSignersManagerProps {
  jobId: number;
  onSignersUpdated?: () => void;
}

interface Signer {
  id: number;
  jobId: number;
  userId?: number;
  signerName: string;
  signerEmail: string;
  signerPhoneNumber: string;
  signerRole: string;
  invitationToken?: string;
  invitationSentAt?: string;
  accessType: string;
  guestVerificationStatus: string;
  signingStatus: string;
  createdAt: string;
}

interface SignerFormData {
  signerName: string;
  signerEmail: string;
  signerPhoneNumber: string;
  signerRole: string;
}

const SIGNER_ROLES = [
  { value: 'borrower', label: 'Borrower (Signs documents)' },
  { value: 'co-borrower', label: 'Co-Borrower (Signs documents)' },
  { value: 'seller', label: 'Seller (Signs documents)' },
  { value: 'buyer', label: 'Buyer (Signs documents)' },
  { value: 'witness', label: 'Witness (Observes signing)' },
  { value: 'power_of_attorney', label: 'Power of Attorney' },
  { value: 'trust_beneficiary', label: 'Trust Beneficiary' },
  { value: 'other', label: 'Other' }
];

export function JobSignersManager({ jobId, onSignersUpdated }: JobSignersManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSigner, setEditingSigner] = useState<Signer | null>(null);
  const [deletingSigner, setDeletingSigner] = useState<Signer | null>(null);
  const [formData, setFormData] = useState<SignerFormData>({
    signerName: '',
    signerEmail: '',
    signerPhoneNumber: '',
    signerRole: 'borrower'
  });

  // Data fetching
  const { data: signers = [], isLoading, refetch } = useQuery<Signer[]>({
    queryKey: [`/api/jobs/${jobId}/signers`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/jobs/${jobId}/signers`);
      return response.json();
    }
  });

  // Add signer mutation
  const addSignerMutation = useMutation({
    mutationFn: async (signerData: SignerFormData) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/signers`, signerData);
      return response.json();
    }
  });

  // Update signer mutation
  const updateSignerMutation = useMutation({
    mutationFn: async ({ signerId, signerData }: { signerId: number; signerData: SignerFormData }) => {
      const response = await apiRequest("PUT", `/api/jobs/${jobId}/signers/${signerId}`, signerData);
      return response.json();
    }
  });

  // Delete signer mutation
  const deleteSignerMutation = useMutation({
    mutationFn: async (signerId: number) => {
      const response = await apiRequest("DELETE", `/api/jobs/${jobId}/signers/${signerId}`);
      return response.json();
    }
  });

  // Send invitation mutation
  const sendInvitationMutation = useMutation({
    mutationFn: async (signerId: number) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/signers/${signerId}/invite`);
      return response.json();
    }
  });

  // Handle mutation results
  useEffect(() => {
    if (addSignerMutation.isSuccess) {
      refetch();
      onSignersUpdated?.();
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Signer Added",
        description: "New signer has been added to the job successfully.",
      });
    }
    if (addSignerMutation.isError) {
      toast({
        title: "Add Failed",
        description: (addSignerMutation.error as any)?.message || "Failed to add signer.",
        variant: "destructive"
      });
    }
  }, [addSignerMutation.isSuccess, addSignerMutation.isError, addSignerMutation.error, refetch, onSignersUpdated, toast]);

  useEffect(() => {
    if (updateSignerMutation.isSuccess) {
      refetch();
      onSignersUpdated?.();
      setEditingSigner(null);
      resetForm();
      toast({
        title: "Signer Updated",
        description: "Signer information has been updated successfully.",
      });
    }
    if (updateSignerMutation.isError) {
      toast({
        title: "Update Failed",
        description: (updateSignerMutation.error as any)?.message || "Failed to update signer.",
        variant: "destructive"
      });
    }
  }, [updateSignerMutation.isSuccess, updateSignerMutation.isError, updateSignerMutation.error, refetch, onSignersUpdated, toast]);

  useEffect(() => {
    if (deleteSignerMutation.isSuccess) {
      refetch();
      onSignersUpdated?.();
      setDeletingSigner(null);
      toast({
        title: "Signer Removed",
        description: "Signer has been removed from the job successfully.",
      });
    }
    if (deleteSignerMutation.isError) {
      toast({
        title: "Delete Failed",
        description: (deleteSignerMutation.error as any)?.message || "Failed to remove signer.",
        variant: "destructive"
      });
    }
  }, [deleteSignerMutation.isSuccess, deleteSignerMutation.isError, deleteSignerMutation.error, refetch, onSignersUpdated, toast]);

  useEffect(() => {
    if (sendInvitationMutation.isSuccess) {
      refetch();
      toast({
        title: "Invitation Sent",
        description: "Invitation has been sent to the signer successfully.",
      });
    }
    if (sendInvitationMutation.isError) {
      toast({
        title: "Send Failed",
        description: (sendInvitationMutation.error as any)?.message || "Failed to send invitation.",
        variant: "destructive"
      });
    }
  }, [sendInvitationMutation.isSuccess, sendInvitationMutation.isError, sendInvitationMutation.error, refetch, toast]);

  // Permission checks
  const canEditSigners = user && (
    user.role === 'admin' || 
    user.role === 'title_company'
  );

  const resetForm = () => {
    setFormData({
      signerName: '',
      signerEmail: '',
      signerPhoneNumber: '',
      signerRole: 'borrower'
    });
  };

  const handleAddSigner = () => {
    if (!formData.signerName || !formData.signerEmail || !formData.signerPhoneNumber) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    addSignerMutation.mutate(formData);
  };

  const handleEditSigner = (signer: Signer) => {
    setEditingSigner(signer);
    setFormData({
      signerName: signer.signerName,
      signerEmail: signer.signerEmail,
      signerPhoneNumber: signer.signerPhoneNumber,
      signerRole: signer.signerRole
    });
  };

  const handleUpdateSigner = () => {
    if (!editingSigner) return;

    if (!formData.signerName || !formData.signerEmail || !formData.signerPhoneNumber) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    updateSignerMutation.mutate({
      signerId: editingSigner.id,
      signerData: formData
    });
  };

  const handleDeleteSigner = (signer: Signer) => {
    setDeletingSigner(signer);
  };

  const confirmDeleteSigner = () => {
    if (deletingSigner) {
      deleteSignerMutation.mutate(deletingSigner.id);
    }
  };

  const handleSendInvitation = (signerId: number) => {
    sendInvitationMutation.mutate(signerId);
  };

  const getStatusBadge = (signer: Signer) => {
    switch (signer.signingStatus) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'declined':
        return <Badge className="bg-red-100 text-red-800">Declined</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getVerificationBadge = (signer: Signer) => {
    switch (signer.guestVerificationStatus) {
      case 'verified':
        return <Badge className="bg-green-100 text-green-800">Verified</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const SignerForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signerName">Full Name *</Label>
        <Input
          id="signerName"
          value={formData.signerName}
          onChange={(e) => setFormData({ ...formData, signerName: e.target.value })}
          placeholder="Enter signer's full name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signerEmail">Email Address *</Label>
        <Input
          id="signerEmail"
          type="email"
          value={formData.signerEmail}
          onChange={(e) => setFormData({ ...formData, signerEmail: e.target.value })}
          placeholder="Enter signer's email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signerPhoneNumber">Phone Number *</Label>
        <Input
          id="signerPhoneNumber"
          type="tel"
          value={formData.signerPhoneNumber}
          onChange={(e) => setFormData({ ...formData, signerPhoneNumber: e.target.value })}
          placeholder="Enter signer's phone number"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signerRole">Role *</Label>
        <Select
          value={formData.signerRole}
          onValueChange={(value) => setFormData({ ...formData, signerRole: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select signer role" />
          </SelectTrigger>
          <SelectContent>
            {SIGNER_ROLES.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading signers...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Job Signers</h3>
          <p className="text-sm text-muted-foreground">
            Manage the signers and participants for this job
          </p>
        </div>
                 {canEditSigners && (
           <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
             <DialogTrigger>
               <Button onClick={() => resetForm()}>
                 <Plus className="h-4 w-4 mr-2" />
                 Add Signer
               </Button>
             </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Signer</DialogTitle>
              </DialogHeader>
              <SignerForm />
              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddSigner}
                  disabled={addSignerMutation.isPending}
                >
                  {addSignerMutation.isPending ? "Adding..." : "Add Signer"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Signers Table */}
      <Card>
        <CardContent className="p-0">
          {signers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No signers added to this job yet.</p>
              {canEditSigners && (
                <p className="text-sm">Click "Add Signer" to get started.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Signer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Invitation</TableHead>
                  {canEditSigners && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {signers.map((signer) => (
                  <TableRow key={signer.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{signer.signerName}</div>
                        <div className="text-sm text-muted-foreground">
                          ID: {signer.id}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm">
                          <Mail className="h-3 w-3" />
                          <span>{signer.signerEmail}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                          <Phone className="h-3 w-3" />
                          <span>{signer.signerPhoneNumber}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {SIGNER_ROLES.find(role => role.value === signer.signerRole)?.label || signer.signerRole}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(signer)}
                    </TableCell>
                    <TableCell>
                      {getVerificationBadge(signer)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {signer.invitationSentAt ? (
                          <div className="text-sm text-muted-foreground">
                            Sent {new Date(signer.invitationSentAt).toLocaleDateString()}
                          </div>
                        ) : (
                          <Badge variant="outline">Not Sent</Badge>
                        )}
                        {canEditSigners && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendInvitation(signer.id)}
                            disabled={sendInvitationMutation.isPending}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    {canEditSigners && (
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditSigner(signer)}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteSigner(signer)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Signer Dialog */}
      <Dialog open={!!editingSigner} onOpenChange={(open) => !open && setEditingSigner(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Signer</DialogTitle>
          </DialogHeader>
          <SignerForm />
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setEditingSigner(null)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateSigner}
              disabled={updateSignerMutation.isPending}
            >
              {updateSignerMutation.isPending ? "Updating..." : "Update Signer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={!!deletingSigner}
        onClose={() => setDeletingSigner(null)}
        onConfirm={confirmDeleteSigner}
        title="Remove Signer"
        description={`Are you sure you want to remove ${deletingSigner?.signerName} from this job? This action cannot be undone.`}
        confirmText="Remove Signer"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteSignerMutation.isPending}
      />
    </div>
  );
} 