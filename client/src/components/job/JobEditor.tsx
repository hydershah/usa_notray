import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Calendar,
  Users,
  FileText,
  Save,
  X,
  Plus,
  Edit3,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Hash,
  Shield,
  Clock,
  User,
  AlertCircle
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface JobEditorProps {
  job: any;
  isOpen: boolean;
  onClose: () => void;
  onJobUpdated?: (updatedJob: any) => void;
}

interface JobDetailsForm {
  titleCompany: string;
  closingType: string;
  internalReference: string;
  kbaRequired: boolean;
  propertyAddressOne: string;
  propertyAddressTwo: string;
  propertyCity: string;
  propertyState: string;
  propertyZipCode: string;
  selectedDate: string;
  selectedTime: string;
  requiresNSA: boolean;
  requiresSpanishSpeaking: boolean;
}

interface SignerForm {
  signerName: string;
  signerEmail: string;
  signerPhoneNumber: string;
  signerRole: string;
}

export function JobEditor({ job, isOpen, onClose, onJobUpdated }: JobEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('details');
  const [jobForm, setJobForm] = useState<JobDetailsForm>({
    titleCompany: '',
    closingType: '',
    internalReference: '',
    kbaRequired: false,
    propertyAddressOne: '',
    propertyAddressTwo: '',
    propertyCity: '',
    propertyState: '',
    propertyZipCode: '',
    selectedDate: '',
    selectedTime: '',
    requiresNSA: false,
    requiresSpanishSpeaking: false
  });

  const [isAddingSigners, setIsAddingSigners] = useState(false);
  const [newSignerForm, setNewSignerForm] = useState<SignerForm>({
    signerName: '',
    signerEmail: '',
    signerPhoneNumber: '',
    signerRole: ''
  });

  const [editingSignerId, setEditingSignerId] = useState<number | null>(null);
  const [editSignerForm, setEditSignerForm] = useState<SignerForm>({
    signerName: '',
    signerEmail: '',
    signerPhoneNumber: '',
    signerRole: ''
  });

  // Load job data into form when job changes
  useEffect(() => {
    if (job) {
      setJobForm({
        titleCompany: job.titleCompany || '',
        closingType: job.closingType || '',
        internalReference: job.internalReference || '',
        kbaRequired: job.kbaRequired || false,
        propertyAddressOne: job.propertyAddressOne || '',
        propertyAddressTwo: job.propertyAddressTwo || '',
        propertyCity: job.propertyCity || '',
        propertyState: job.propertyState || '',
        propertyZipCode: job.propertyZipCode || '',
        selectedDate: job.selectedDate || '',
        selectedTime: job.selectedTime || '',
        requiresNSA: job.requiresNSA || false,
        requiresSpanishSpeaking: job.requiresSpanishSpeaking || false
      });
    }
  }, [job]);

  // Get job signers
  const { data: signers = [], refetch: refetchSigners } = useQuery({
    queryKey: ['job-signers', job?.id],
    queryFn: async () => {
      if (!job?.id) return [];
      // Use existing signers from job object or fetch from API
      return job.signers || [];
    },
    enabled: !!job?.id && isOpen
  });

  // Job details update mutation
  const updateJobDetailsMutation = useMutation({
    mutationFn: async (data: Partial<JobDetailsForm>) => {
      const response = await apiRequest('PUT', `/api/jobs/${job.id}/details`, data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Job Updated",
        description: "Job details have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      onJobUpdated?.(data.job);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update job details.",
      });
    }
  });

  // Add signer mutation
  const addSignerMutation = useMutation({
    mutationFn: async (signerData: SignerForm) => {
      const response = await apiRequest('POST', `/api/jobs/${job.id}/signers`, signerData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Signer Added",
        description: "New signer has been added and invited.",
      });
      setNewSignerForm({
        signerName: '',
        signerEmail: '',
        signerPhoneNumber: '',
        signerRole: ''
      });
      setIsAddingSigners(false);
      refetchSigners();
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Add Signer Failed",
        description: error.message || "Failed to add signer.",
      });
    }
  });

  // Update signer mutation
  const updateSignerMutation = useMutation({
    mutationFn: async ({ signerId, data }: { signerId: number; data: Partial<SignerForm> }) => {
      const response = await apiRequest('PUT', `/api/jobs/${job.id}/signers/${signerId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Signer Updated",
        description: "Signer details have been updated.",
      });
      setEditingSignerId(null);
      refetchSigners();
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update Signer Failed",
        description: error.message || "Failed to update signer.",
      });
    }
  });

  // Delete signer mutation
  const deleteSignerMutation = useMutation({
    mutationFn: async (signerId: number) => {
      const response = await apiRequest('DELETE', `/api/jobs/${job.id}/signers/${signerId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Signer Removed",
        description: "Signer has been removed from the job.",
      });
      refetchSigners();
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Remove Signer Failed",
        description: error.message || "Failed to remove signer.",
      });
    }
  });

  const handleSaveJobDetails = () => {
    const changedFields: Partial<JobDetailsForm> = {};
    
    // Only include fields that have changed
    Object.keys(jobForm).forEach((key) => {
      const formKey = key as keyof JobDetailsForm;
      if (jobForm[formKey] !== (job[formKey] || '')) {
        changedFields[formKey] = jobForm[formKey];
      }
    });

    if (Object.keys(changedFields).length === 0) {
      toast({
        title: "No Changes",
        description: "No changes were made to save.",
      });
      return;
    }

    updateJobDetailsMutation.mutate(changedFields);
  };

  const handleAddSigner = () => {
    if (!newSignerForm.signerName || !newSignerForm.signerEmail || 
        !newSignerForm.signerPhoneNumber || !newSignerForm.signerRole) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in all signer fields.",
      });
      return;
    }

    addSignerMutation.mutate(newSignerForm);
  };

  const handleUpdateSigner = (signerId: number) => {
    if (!editSignerForm.signerName || !editSignerForm.signerEmail || 
        !editSignerForm.signerPhoneNumber || !editSignerForm.signerRole) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in all signer fields.",
      });
      return;
    }

    updateSignerMutation.mutate({ signerId, data: editSignerForm });
  };

  const startEditingSigner = (signer: any) => {
    setEditingSignerId(signer.id);
    setEditSignerForm({
      signerName: signer.signerName,
      signerEmail: signer.signerEmail,
      signerPhoneNumber: signer.signerPhoneNumber,
      signerRole: signer.signerRole
    });
  };

  const cancelEditingSigner = () => {
    setEditingSignerId(null);
    setEditSignerForm({
      signerName: '',
      signerEmail: '',
      signerPhoneNumber: '',
      signerRole: ''
    });
  };

  const signerRoleOptions = [
    { value: 'buyer', label: 'Buyer' },
    { value: 'seller', label: 'Seller' },
    { value: 'borrower', label: 'Borrower' },
    { value: 'co-borrower', label: 'Co-Borrower' },
    { value: 'witness', label: 'Witness' }
  ];

  if (!job) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-primary" />
                Edit Job #{job.id}
              </DialogTitle>
              <p className="text-sm text-gray-600 mt-1">
                Make changes to job details and manage signers
              </p>
            </div>
            <Badge variant="outline" className="px-3 py-1">
              {job.jobStatus?.toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Job Details
              </TabsTrigger>
              <TabsTrigger value="signers" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Signers ({signers.length})
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents
              </TabsTrigger>
            </TabsList>

            {/* Job Details Tab */}
            <TabsContent value="details" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="titleCompany">Title Company *</Label>
                      <Input
                        id="titleCompany"
                        value={jobForm.titleCompany}
                        onChange={(e) => setJobForm(prev => ({ ...prev, titleCompany: e.target.value }))}
                        placeholder="Enter title company name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="closingType">Closing Type *</Label>
                      <Input
                        id="closingType"
                        value={jobForm.closingType}
                        onChange={(e) => setJobForm(prev => ({ ...prev, closingType: e.target.value }))}
                        placeholder="Enter closing type"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="internalReference">Internal Reference</Label>
                    <Input
                      id="internalReference"
                      value={jobForm.internalReference}
                      onChange={(e) => setJobForm(prev => ({ ...prev, internalReference: e.target.value }))}
                      placeholder="Enter internal reference number"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="kbaRequired"
                      checked={jobForm.kbaRequired}
                      onCheckedChange={(checked) => setJobForm(prev => ({ ...prev, kbaRequired: Boolean(checked) }))}
                    />
                    <Label htmlFor="kbaRequired" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      KBA (Knowledge-Based Authentication) Required
                    </Label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Property Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="propertyAddressOne">Address Line 1 *</Label>
                    <Input
                      id="propertyAddressOne"
                      value={jobForm.propertyAddressOne}
                      onChange={(e) => setJobForm(prev => ({ ...prev, propertyAddressOne: e.target.value }))}
                      placeholder="Enter street address"
                    />
                  </div>

                  <div>
                    <Label htmlFor="propertyAddressTwo">Address Line 2</Label>
                    <Input
                      id="propertyAddressTwo"
                      value={jobForm.propertyAddressTwo}
                      onChange={(e) => setJobForm(prev => ({ ...prev, propertyAddressTwo: e.target.value }))}
                      placeholder="Apartment, suite, etc. (optional)"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="propertyCity">City *</Label>
                      <Input
                        id="propertyCity"
                        value={jobForm.propertyCity}
                        onChange={(e) => setJobForm(prev => ({ ...prev, propertyCity: e.target.value }))}
                        placeholder="Enter city"
                      />
                    </div>
                    <div>
                      <Label htmlFor="propertyState">State *</Label>
                      <Input
                        id="propertyState"
                        value={jobForm.propertyState}
                        onChange={(e) => setJobForm(prev => ({ ...prev, propertyState: e.target.value }))}
                        placeholder="Enter state"
                      />
                    </div>
                    <div>
                      <Label htmlFor="propertyZipCode">Zip Code *</Label>
                      <Input
                        id="propertyZipCode"
                        value={jobForm.propertyZipCode}
                        onChange={(e) => setJobForm(prev => ({ ...prev, propertyZipCode: e.target.value }))}
                        placeholder="12345"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Schedule & Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="selectedDate">Scheduled Date</Label>
                      <Input
                        id="selectedDate"
                        type="date"
                        value={jobForm.selectedDate}
                        onChange={(e) => setJobForm(prev => ({ ...prev, selectedDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="selectedTime">Scheduled Time</Label>
                      <Input
                        id="selectedTime"
                        type="time"
                        value={jobForm.selectedTime}
                        onChange={(e) => setJobForm(prev => ({ ...prev, selectedTime: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="requiresNSA"
                        checked={jobForm.requiresNSA}
                        onCheckedChange={(checked) => setJobForm(prev => ({ ...prev, requiresNSA: Boolean(checked) }))}
                      />
                      <Label htmlFor="requiresNSA">Requires Notary Signing Agent (NSA)</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="requiresSpanishSpeaking"
                        checked={jobForm.requiresSpanishSpeaking}
                        onCheckedChange={(checked) => setJobForm(prev => ({ ...prev, requiresSpanishSpeaking: Boolean(checked) }))}
                      />
                      <Label htmlFor="requiresSpanishSpeaking">Requires Spanish Speaking Notary</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={updateJobDetailsMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveJobDetails}
                  disabled={updateJobDetailsMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {updateJobDetailsMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </TabsContent>

            {/* Signers Tab */}
            <TabsContent value="signers" className="space-y-6 mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Manage Signers</h3>
                <Button
                  onClick={() => setIsAddingSigners(true)}
                  disabled={job.jobStatus === 'completed' || job.jobStatus === 'cancelled'}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Signer
                </Button>
              </div>

              {/* Add New Signer Form */}
              {isAddingSigners && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-base">Add New Signer</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="newSignerName">Full Name *</Label>
                        <Input
                          id="newSignerName"
                          value={newSignerForm.signerName}
                          onChange={(e) => setNewSignerForm(prev => ({ ...prev, signerName: e.target.value }))}
                          placeholder="Enter full name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="newSignerRole">Role *</Label>
                        <Select
                          value={newSignerForm.signerRole}
                          onValueChange={(value) => setNewSignerForm(prev => ({ ...prev, signerRole: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {signerRoleOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="newSignerEmail">Email *</Label>
                        <Input
                          id="newSignerEmail"
                          type="email"
                          value={newSignerForm.signerEmail}
                          onChange={(e) => setNewSignerForm(prev => ({ ...prev, signerEmail: e.target.value }))}
                          placeholder="Enter email address"
                        />
                      </div>
                      <div>
                        <Label htmlFor="newSignerPhone">Phone Number *</Label>
                        <Input
                          id="newSignerPhone"
                          type="tel"
                          value={newSignerForm.signerPhoneNumber}
                          onChange={(e) => setNewSignerForm(prev => ({ ...prev, signerPhoneNumber: e.target.value }))}
                          placeholder="Enter phone number"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsAddingSigners(false);
                          setNewSignerForm({
                            signerName: '',
                            signerEmail: '',
                            signerPhoneNumber: '',
                            signerRole: ''
                          });
                        }}
                        disabled={addSignerMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddSigner}
                        disabled={addSignerMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        {addSignerMutation.isPending ? 'Adding...' : 'Add Signer'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Existing Signers List */}
              <div className="space-y-3">
                {signers.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p className="font-medium mb-1">No signers added yet</p>
                      <p className="text-sm">Click "Add Signer" to get started</p>
                    </CardContent>
                  </Card>
                ) : (
                  signers.map((signer: any) => (
                    <Card key={signer.id}>
                      <CardContent className="p-4">
                        {editingSignerId === signer.id ? (
                          // Edit Mode
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor={`editSignerName-${signer.id}`}>Full Name *</Label>
                                <Input
                                  id={`editSignerName-${signer.id}`}
                                  value={editSignerForm.signerName}
                                  onChange={(e) => setEditSignerForm(prev => ({ ...prev, signerName: e.target.value }))}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`editSignerRole-${signer.id}`}>Role *</Label>
                                <Select
                                  value={editSignerForm.signerRole}
                                  onValueChange={(value) => setEditSignerForm(prev => ({ ...prev, signerRole: value }))}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {signerRoleOptions.map(option => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor={`editSignerEmail-${signer.id}`}>Email *</Label>
                                <Input
                                  id={`editSignerEmail-${signer.id}`}
                                  type="email"
                                  value={editSignerForm.signerEmail}
                                  onChange={(e) => setEditSignerForm(prev => ({ ...prev, signerEmail: e.target.value }))}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`editSignerPhone-${signer.id}`}>Phone Number *</Label>
                                <Input
                                  id={`editSignerPhone-${signer.id}`}
                                  type="tel"
                                  value={editSignerForm.signerPhoneNumber}
                                  onChange={(e) => setEditSignerForm(prev => ({ ...prev, signerPhoneNumber: e.target.value }))}
                                />
                              </div>
                            </div>

                            <div className="flex justify-end gap-3">
                              <Button
                                variant="outline"
                                onClick={cancelEditingSigner}
                                disabled={updateSignerMutation.isPending}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => handleUpdateSigner(signer.id)}
                                disabled={updateSignerMutation.isPending}
                                className="flex items-center gap-2"
                              >
                                <Save className="h-4 w-4" />
                                {updateSignerMutation.isPending ? 'Saving...' : 'Save Changes'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // View Mode
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{signer.signerName}</p>
                                  <Badge variant="outline" className="text-xs">
                                    {signer.signerRole?.charAt(0)?.toUpperCase() + signer.signerRole?.slice(1)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {signer.signerEmail}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {signer.signerPhoneNumber}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge
                                variant={signer.invitationSentAt ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {signer.invitationSentAt ? "Invited" : "Pending"}
                              </Badge>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditingSigner(signer)}
                                disabled={job.jobStatus === 'completed' || job.jobStatus === 'cancelled'}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to remove ${signer.signerName}?`)) {
                                    deleteSignerMutation.mutate(signer.id);
                                  }
                                }}
                                disabled={job.jobStatus === 'completed' || job.jobStatus === 'cancelled' || signer.signingStatus === 'completed'}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-6 mt-6">
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium mb-1">Document Management</p>
                <p className="text-sm">Document editing features will be implemented in the next phase</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Editing Job #{job.id} • {job.titleCompany}
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 