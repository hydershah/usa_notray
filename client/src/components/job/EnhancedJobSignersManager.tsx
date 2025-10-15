import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Mail, 
  Phone, 
  User, 
  Shield, 
  AlertCircle,
  CheckCircle,
  Clock,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '../../lib/queryClient';
import { ParticipantRoleSummary, RoleAssignmentRequest } from '@shared/types';
import { VerificationToggleButton } from './VerificationToggleButton';
import { useAuth } from '@/hooks/use-auth';

interface EnhancedSignerFormData {
  signerName: string;
  signerEmail: string;
  signerPhoneNumber: string;
  signerRole: string; // Traditional signer role (borrower, co-borrower, etc.)
  jobSpecificRole: 'signer' | 'witness' | 'observer'; // Job-specific role
  requiresIdVerification: boolean;
  skipVerificationReason?: string; // For admin bypass
  isExistingUser?: boolean;
  userId?: number;
  primaryUserRole?: string; // User's primary system role
}

interface EnhancedJobSignersManagerProps {
  jobId: number;
  onSignersUpdated?: () => void;
  canEdit?: boolean;
  showDualRoleOptions?: boolean; // Feature flag for dual role functionality
}

const TRADITIONAL_SIGNER_ROLES = [
  { value: 'borrower', label: 'Borrower', description: 'Primary borrower signing loan documents' },
  { value: 'co-borrower', label: 'Co-Borrower', description: 'Secondary borrower on the loan' },
  { value: 'seller', label: 'Seller', description: 'Property seller in transaction' },
  { value: 'buyer', label: 'Buyer', description: 'Property buyer in transaction' },
  { value: 'power_of_attorney', label: 'Power of Attorney', description: 'Acting on behalf of another party' },
  { value: 'trust_beneficiary', label: 'Trust Beneficiary', description: 'Beneficiary of a trust' },
  { value: 'other', label: 'Other', description: 'Other role not listed' }
];

const JOB_SPECIFIC_ROLES = [
  { 
    value: 'signer', 
    label: 'Signer', 
    description: 'Signs documents - requires ID verification',
    requiresVerification: true,
    icon: <User className="h-4 w-4" />
  },
  { 
    value: 'witness', 
    label: 'Witness', 
    description: 'Witnesses signatures - requires ID verification',
    requiresVerification: true,
    icon: <Shield className="h-4 w-4" />
  },
  { 
    value: 'observer', 
    label: 'Observer', 
    description: 'Observes session - no verification required',
    requiresVerification: false,
    icon: <Info className="h-4 w-4" />
  }
];

const getVerificationStatusBadge = (participant: ParticipantRoleSummary) => {
  switch (participant.verificationStatus) {
    case 'verified':
      return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="h-3 w-3 mr-1" />
        Verified
      </Badge>;
    case 'verification_required':
      return <Badge variant="destructive">
        <AlertCircle className="h-3 w-3 mr-1" />
        Verification Required
      </Badge>;
    case 'no_verification_needed':
      return <Badge variant="secondary">
        <Info className="h-3 w-3 mr-1" />
        No Verification Needed
      </Badge>;
    default:
      return <Badge variant="outline">
        <Clock className="h-3 w-3 mr-1" />
        Unknown
      </Badge>;
  }
};

const getDualRoleBadge = (participant: ParticipantRoleSummary) => {
  if (!participant.hasDualRole) return null;
  
  return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
    {participant.userSystemRole} → {participant.jobRole}
  </Badge>;
};

export function EnhancedJobSignersManager({ 
  jobId, 
  onSignersUpdated, 
  canEdit = true,
  showDualRoleOptions = true 
}: EnhancedJobSignersManagerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<ParticipantRoleSummary | null>(null);
  const [formData, setFormData] = useState<EnhancedSignerFormData>({
    signerName: '',
    signerEmail: '',
    signerPhoneNumber: '',
    signerRole: 'borrower',
    jobSpecificRole: 'signer',
    requiresIdVerification: true,
    isExistingUser: false
  });
  const [userLookupResults, setUserLookupResults] = useState<any[]>([]);
  const [isLookingUpUser, setIsLookingUpUser] = useState(false);

  // Fetch participants with enhanced role information
  const { data: participants = [], isLoading, refetch } = useQuery<ParticipantRoleSummary[]>({
    queryKey: [`/api/jobs/${jobId}/participants/enhanced`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/jobs/${jobId}/participants/enhanced`);
      return response.json();
    }
  });

  // Add participant mutation
  const addParticipantMutation = useMutation({
    mutationFn: async (participantData: RoleAssignmentRequest) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/participants/enhanced`, participantData);
      return response.json();
    },
    onSuccess: () => {
      toast.success('Participant added successfully!');
      refetch();
      onSignersUpdated?.();
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add participant');
    }
  });

  // Update participant mutation
  const updateParticipantMutation = useMutation({
    mutationFn: async ({ participantId, participantData }: { participantId: number; participantData: RoleAssignmentRequest }) => {
      const response = await apiRequest("PUT", `/api/jobs/${jobId}/participants/${participantId}/enhanced`, participantData);
      return response.json();
    },
    onSuccess: () => {
      toast.success('Participant updated successfully!');
      refetch();
      onSignersUpdated?.();
      setEditingParticipant(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update participant');
    }
  });

  // User lookup for existing users
  const lookupUserByEmail = async (email: string) => {
    if (!email || email.length < 3) {
      setUserLookupResults([]);
      return;
    }

    setIsLookingUpUser(true);
    try {
      const response = await apiRequest("GET", `/api/users/lookup?email=${encodeURIComponent(email)}`);
      const users = await response.json();
      setUserLookupResults(users);
      
      // Auto-populate if exact match found
      const exactMatch = users.find((user: any) => user.email.toLowerCase() === email.toLowerCase());
      if (exactMatch) {
        setFormData(prev => ({
          ...prev,
          signerName: exactMatch.fullName || `${exactMatch.firstName} ${exactMatch.lastName}`,
          signerPhoneNumber: exactMatch.phoneNumber || prev.signerPhoneNumber,
          isExistingUser: true,
          userId: exactMatch.id,
          primaryUserRole: exactMatch.role
        }));
      }
    } catch (error) {
      console.error('Error looking up user:', error);
      setUserLookupResults([]);
    } finally {
      setIsLookingUpUser(false);
    }
  };

  // Handle email changes with user lookup
  const handleEmailChange = (email: string) => {
    setFormData(prev => ({ ...prev, signerEmail: email }));
    
    // Debounce user lookup
    const timeoutId = setTimeout(() => {
      lookupUserByEmail(email);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // Handle job-specific role change
  const handleJobSpecificRoleChange = (role: 'signer' | 'witness' | 'observer') => {
    const roleInfo = JOB_SPECIFIC_ROLES.find(r => r.value === role);
    setFormData(prev => ({
      ...prev,
      jobSpecificRole: role,
      requiresIdVerification: roleInfo?.requiresVerification ?? true
    }));
  };

  const resetForm = () => {
    setFormData({
      signerName: '',
      signerEmail: '',
      signerPhoneNumber: '',
      signerRole: 'borrower',
      jobSpecificRole: 'signer',
      requiresIdVerification: true,
      isExistingUser: false
    });
    setUserLookupResults([]);
  };

  const handleAddParticipant = () => {
    const participantData: RoleAssignmentRequest = {
      userId: formData.userId,
      email: formData.signerEmail,
      jobSpecificRole: formData.jobSpecificRole,
      requiresIdVerification: formData.requiresIdVerification,
      skipVerificationReason: formData.skipVerificationReason
    };

    addParticipantMutation.mutate(participantData);
  };

  const handleEditParticipant = (participant: ParticipantRoleSummary) => {
    setEditingParticipant(participant);
    setFormData({
      signerName: `${participant.firstName} ${participant.lastName}`,
      signerEmail: participant.email,
      signerPhoneNumber: '', // Would need to fetch from user data
      signerRole: 'borrower', // Would need traditional role mapping
      jobSpecificRole: participant.jobRole as 'signer' | 'witness' | 'observer',
      requiresIdVerification: participant.requiresIdVerification,
      isExistingUser: true,
      userId: participant.userId || undefined,
      primaryUserRole: participant.userSystemRole
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading participants...</div>
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
          <h3 className="text-lg font-medium">Job Participants</h3>
          <p className="text-sm text-muted-foreground">
            Manage signers, witnesses, and observers for this job
          </p>
        </div>
        {canEdit && (
          <Button 
            onClick={() => {
              resetForm();
              setIsAddDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Participant
          </Button>
        )}
      </div>

      {/* Dual Role Info Alert */}
      {showDualRoleOptions && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Dual Role Support:</strong> Users can now have different roles within jobs. 
            For example, a notary can also be a signer and will need ID verification for the signing role.
          </AlertDescription>
        </Alert>
      )}

      {/* Add/Edit Participant Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Participant</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="font-medium">Basic Information</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="signerName">Full Name *</Label>
                  <Input
                    id="signerName"
                    value={formData.signerName}
                    onChange={(e) => setFormData(prev => ({ ...prev, signerName: e.target.value }))}
                    placeholder="Enter participant's full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signerEmail">Email Address *</Label>
                  <Input
                    id="signerEmail"
                    type="email"
                    value={formData.signerEmail}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="Enter participant's email"
                  />
                  {isLookingUpUser && (
                    <div className="text-xs text-muted-foreground">Looking up user...</div>
                  )}
                  {formData.isExistingUser && formData.primaryUserRole && (
                    <div className="text-xs text-blue-600">
                      ✓ Existing user found - Primary role: {formData.primaryUserRole}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signerPhoneNumber">Phone Number</Label>
                <Input
                  id="signerPhoneNumber"
                  type="tel"
                  value={formData.signerPhoneNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, signerPhoneNumber: e.target.value }))}
                  placeholder="Enter participant's phone number"
                />
              </div>
            </div>

            {/* Role Assignment */}
            <div className="space-y-4">
              <h4 className="font-medium">Role Assignment</h4>
              
              {showDualRoleOptions && (
                <>
                  <div className="space-y-2">
                    <Label>Job-Specific Role *</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {JOB_SPECIFIC_ROLES.map((role) => (
                        <div
                          key={role.value}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            formData.jobSpecificRole === role.value
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleJobSpecificRoleChange(role.value as any)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {role.icon}
                              <div>
                                <div className="font-medium">{role.label}</div>
                                <div className="text-sm text-muted-foreground">{role.description}</div>
                              </div>
                            </div>
                            {role.requiresVerification && (
                              <Badge variant="outline" className="text-xs">
                                <Shield className="h-3 w-3 mr-1" />
                                Verification Required
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {formData.jobSpecificRole === 'signer' && (
                    <div className="space-y-2">
                      <Label>Traditional Signer Role</Label>
                      <Select 
                        value={formData.signerRole} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, signerRole: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select signer role" />
                        </SelectTrigger>
                        <SelectContent>
                          {TRADITIONAL_SIGNER_ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              <div>
                                <div className="font-medium">{role.label}</div>
                                <div className="text-xs text-muted-foreground">{role.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Verification Settings */}
            {formData.requiresIdVerification && (
              <div className="space-y-4">
                <h4 className="font-medium">Verification Settings</h4>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requiresVerification"
                    checked={formData.requiresIdVerification}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, requiresIdVerification: checked as boolean }))
                    }
                  />
                  <Label htmlFor="requiresVerification">Requires ID verification</Label>
                </div>

                {!formData.requiresIdVerification && (
                  <div className="space-y-2">
                    <Label htmlFor="skipReason">Reason for skipping verification</Label>
                    <Input
                      id="skipReason"
                      value={formData.skipVerificationReason || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, skipVerificationReason: e.target.value }))}
                      placeholder="Enter reason for admin bypass"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddParticipant}
              disabled={addParticipantMutation.isPending}
            >
              {addParticipantMutation.isPending ? "Adding..." : "Add Participant"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Participants List */}
      <Card>
        <CardHeader>
          <CardTitle>Current Participants ({participants.length})</CardTitle>
          <CardDescription>
            All participants assigned to this job with their roles and verification status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {participants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No participants added yet. Click "Add Participant" to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-600" />
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">
                          {participant.firstName} {participant.lastName}
                        </h4>
                        {getDualRoleBadge(participant)}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          {participant.email}
                        </span>
                        <span>Role: {participant.jobRole}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2 mt-2">
                        {getVerificationStatusBadge(participant)}
                        <Badge variant="outline">
                          {participant.inviteStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center space-x-2">
                      {participant.userId && (
                        <VerificationToggleButton
                          userId={participant.userId}
                          jobId={jobId}
                          currentUserRole={user?.role || 'user'}
                          isVerified={participant.verificationStatus === 'verified' || participant.idVerificationCompleted || false}
                          signerName={`${participant.firstName} ${participant.lastName}`}
                          onToggleComplete={() => refetch()}
                          compact={true}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditParticipant(participant)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
