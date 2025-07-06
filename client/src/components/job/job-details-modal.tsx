import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  User, 
  Calendar, 
  Home, 
  Download, 
  Eye, 
  Trash2, 
  MapPin,
  Phone,
  Mail,
  Clock,
  Video,
  Tag,
  CheckCircle,
  AlertCircle,
  Copy,
  RefreshCw,
  Link2,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Building2,
  FileCheck,
  Upload,
  Users,
  Shield,
  Hash,
  Save,
  X,
  Edit3
} from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { JobStatus } from '@/types/job';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

interface JobDetailsModalProps {
  job: any;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdate?: (newStatus: JobStatus) => void;
}

export function JobDetailsModal({ job, isOpen, onClose, onStatusUpdate }: JobDetailsModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [jobDocuments, setJobDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [completedDocuments, setCompletedDocuments] = useState<any[]>([]);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<{
    jobInfo: boolean;
    schedule: boolean;
    signers: boolean;
    documents: boolean;
    completed: boolean;
  }>({
    jobInfo: true,
    schedule: true,
    signers: true,
    documents: true,
    completed: false
  });
  
  // Notary change functionality
  const [isChangingNotary, setIsChangingNotary] = useState(false);
  const [availableNotaries, setAvailableNotaries] = useState<any[]>([]);
  const [selectedNewNotary, setSelectedNewNotary] = useState<string>('');
  const [notarySearchCode, setNotarySearchCode] = useState<string>('');
  const [loadingNotaries, setLoadingNotaries] = useState(false);
  const [changingNotary, setChangingNotary] = useState(false);
  
  // Get current user data to check permissions
  const { data: currentUser } = useQuery<any>({
    queryKey: ['/api/auth/me'],
  });
  
  // Check if user can change notaries (only admins)
  const canChangeNotary = currentUser && (currentUser.role === 'admin');
  
  // Confirmation dialog state
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    documentId?: number;
    documentName?: string;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });
  
  // Load job documents when modal opens
  useEffect(() => {
    if (isOpen && job?.id) {
      loadJobDocuments();
      loadCompletedDocuments();
    }
  }, [isOpen, job?.id]);

  // Load available notaries when changing notary mode is activated
  useEffect(() => {
    if (isChangingNotary) {
      loadAvailableNotaries();
    }
  }, [isChangingNotary]);
  
  if (!job) return null;

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'in_progress':
        return <Clock className="h-4 w-4" />;
      case 'pending':
      case 'open':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
      case 'open':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDocumentTypeColor = (type: string) => {
    switch (type) {
      case 'original': return 'bg-blue-100 text-blue-800';
      case 'notarized': return 'bg-green-100 text-green-800';
      case 'additional': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRole = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'buyer':
        return 'bg-blue-100 text-blue-800';
      case 'seller':
        return 'bg-green-100 text-green-800';
      case 'witness':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Link copied to clipboard",
    });
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('documents', files[i]);
    }

    try {
      const response = await fetch(`/api/jobs/${job.id}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `${files.length} document(s) uploaded successfully`,
        });
        await loadJobDocuments();
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Unable to upload documents. Please try again.",
      });
    }
  };

  const loadAvailableNotaries = async () => {
    try {
      setLoadingNotaries(true);
      const response = await fetch('/api/notaries/available', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const notaries = await response.json();
        setAvailableNotaries(notaries);
      } else {
        console.error('Failed to load notaries');
        setAvailableNotaries([]);
      }
    } catch (error) {
      console.error('Error loading notaries:', error);
      setAvailableNotaries([]);
    } finally {
      setLoadingNotaries(false);
    }
  };

  const handleNotarySearch = async (searchTerm: string) => {
    setNotarySearchCode(searchTerm);
    if (searchTerm.length < 2) {
      await loadAvailableNotaries();
      return;
    }

    try {
      setLoadingNotaries(true);
      const response = await fetch(`/api/notaries/search?q=${encodeURIComponent(searchTerm)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const notaries = await response.json();
        setAvailableNotaries(notaries);
      }
    } catch (error) {
      console.error('Error searching notaries:', error);
    } finally {
      setLoadingNotaries(false);
    }
  };

  const handleNotaryChange = async () => {
    if (!selectedNewNotary) return;

    try {
      setChangingNotary(true);
      const response = await fetch(`/api/jobs/${job.id}/notary`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notaryId: selectedNewNotary })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Notary has been successfully reassigned",
        });
        setIsChangingNotary(false);
        setSelectedNewNotary('');
        setNotarySearchCode('');
        // Reload job data
        window.location.reload();
      } else {
        throw new Error('Failed to change notary');
      }
    } catch (error) {
      console.error('Error changing notary:', error);
      toast({
        variant: "destructive",
        title: "Failed to Change Notary",
        description: error instanceof Error ? error.message : "Unable to change the assigned notary. Please try again.",
      });
    } finally {
      setChangingNotary(false);
    }
  };

  const cancelNotaryChange = () => {
    setIsChangingNotary(false);
    setSelectedNewNotary('');
    setNotarySearchCode('');
  };

  const handlePreview = (documentId: number) => {
    // Open preview in a new tab
    const previewUrl = `/api/jobs/${job.id}/documents/${documentId}/preview`;
    const token = localStorage.getItem('token');
    
    // Create a form to send the token in a POST request for the preview
    const form = document.createElement('form');
    form.method = 'GET';
    form.action = previewUrl;
    form.target = '_blank';
    
    const tokenInput = document.createElement('input');
    tokenInput.type = 'hidden';
    tokenInput.name = 'token';
    tokenInput.value = token || '';
    form.appendChild(tokenInput);
    
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  const handleDownload = async (documentId: number, fileName: string) => {
    try {
      const response = await fetch(`/api/jobs/${job.id}/documents/${documentId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Create blob from response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Downloaded ${fileName}`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Unable to download the document.",
      });
    }
  };

  const handleDeleteDocument = (documentId: number, documentName: string) => {
    setConfirmationDialog({
      isOpen: true,
      documentId,
      documentName,
      title: 'Delete Document',
      description: `Are you sure you want to delete "${documentName}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/jobs/${job.id}/documents/${documentId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (!response.ok) {
            throw new Error('Delete failed');
          }

          // Refresh the documents list
          await loadJobDocuments();

          toast({
            title: "Document Deleted",
            description: `${documentName} has been deleted successfully.`,
          });
        } catch (error) {
          console.error('Delete failed:', error);
          toast({
            variant: "destructive",
            title: "Delete Failed",
            description: "Unable to delete the document.",
          });
        } finally {
          setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const loadJobDocuments = async () => {
    try {
      setLoadingDocuments(true);
      const response = await fetch(`/api/jobs/${job.id}/documents`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const documents = await response.json();
        setJobDocuments(documents);
      } else {
        console.warn('Failed to load job documents');
        setJobDocuments([]);
      }
    } catch (error) {
      console.error('Error loading job documents:', error);
      setJobDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const loadCompletedDocuments = async () => {
    try {
      setLoadingCompleted(true);
      // Load from localStorage for demo purposes
      const completedDocsString = localStorage.getItem(`completed_documents_${job.id}`);
      if (completedDocsString) {
        const completedDocs = JSON.parse(completedDocsString);
        setCompletedDocuments(completedDocs);
      } else {
        setCompletedDocuments([]);
      }
    } catch (error) {
      console.error('Error loading completed documents:', error);
      setCompletedDocuments([]);
    } finally {
      setLoadingCompleted(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0" aria-describedby="job-details-description">
        <DialogHeader className="px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                Job Details
              </DialogTitle>
              <p className="text-sm text-gray-600 mt-1">
                Comprehensive view of job #{job.id} information
              </p>
            </div>
            <Badge className={cn("px-3 py-1 border", getStatusColor(job.jobStatus))}>
              {getStatusIcon(job.jobStatus)}
              <span className="ml-1 font-medium">{job.jobStatus?.toUpperCase()}</span>
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Job Information Section */}
          <Card className="border-0 shadow-sm">
            <CardHeader 
              className="cursor-pointer hover:bg-gray-50 transition-colors rounded-t-lg"
              onClick={() => toggleSection('jobInfo')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Job Information
                </CardTitle>
                {expandedSections.jobInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {expandedSections.jobInfo && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Reference:</span>
                      <span className="text-sm font-medium">Job #{job.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Title Company:</span>
                      <span className="text-sm font-medium">{job.titleCompany || 'Not specified'}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Closing Type:</span>
                      <span className="text-sm font-medium">{job.closingType || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">KBA Required:</span>
                      <Badge variant={job.kbaRequired ? "destructive" : "secondary"} className="text-xs">
                        {job.kbaRequired ? 'YES' : 'NO'}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                {/* Status Update Section */}
                {onStatusUpdate && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Update Status:</span>
                      <select
                        value={job.jobStatus}
                        onChange={(e) => onStatusUpdate(e.target.value as JobStatus)}
                        className="text-sm border rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="open">Open</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Schedule & Property Section */}
          <Card className="border-0 shadow-sm">
            <CardHeader 
              className="cursor-pointer hover:bg-gray-50 transition-colors rounded-t-lg"
              onClick={() => toggleSection('schedule')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Schedule & Property
                </CardTitle>
                {expandedSections.schedule ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {expandedSections.schedule && (
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Schedule Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Date:</span>
                      <span className="text-sm font-medium">
                        {job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString() : 'Not scheduled'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Time:</span>
                      <span className="text-sm font-medium">
                        {job.scheduledTime || 'Not scheduled'}
                      </span>
                    </div>
                  </div>

                  {/* Notary Assignment */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Assigned Notary:</span>
                      </div>
                      {canChangeNotary && job.assignedNotary && !isChangingNotary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsChangingNotary(true)}
                          className="text-xs"
                        >
                          Change
                        </Button>
                      )}
                    </div>
                    {isChangingNotary ? (
                      <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                        <div>
                          <Label htmlFor="notary-search" className="text-xs font-medium">
                            Search by notary code/name:
                          </Label>
                          <Input
                            id="notary-search"
                            placeholder="Enter notary username, name, or email..."
                            value={notarySearchCode}
                            onChange={(e) => handleNotarySearch(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="notary-select" className="text-xs font-medium">
                            Select notary:
                          </Label>
                          <Select value={selectedNewNotary} onValueChange={setSelectedNewNotary}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder={loadingNotaries ? "Loading..." : "Choose a notary"} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableNotaries.map((notary) => (
                                <SelectItem key={notary.id} value={notary.id.toString()}>
                                  <div className="flex items-center justify-between w-full">
                                    <span>
                                      {`${notary.firstName || ''} ${notary.lastName || ''}`.trim() || notary.username}
                                    </span>
                                    <span className="text-xs text-gray-500 ml-2">
                                      @{notary.username}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={handleNotaryChange}
                            disabled={!selectedNewNotary || changingNotary}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Save className="h-3 w-3 mr-1" />
                            {changingNotary ? 'Saving...' : 'Save'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelNotaryChange}
                            disabled={changingNotary}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="pl-6">
                        {job.assignedNotary ? (
                          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{job.assignedNotary.name}</p>
                              <p className="text-xs text-gray-600">ID: {job.assignedNotary.notaryIdCode || 'N/A'}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No notary assigned yet</p>
                        )}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Property Address */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">Property Address</span>
                    </div>
                    {job.propertyAddress ? (
                      <div className="pl-6 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm">{job.propertyAddress.houseNo} {job.propertyAddress.street}</p>
                        <p className="text-sm">{job.propertyAddress.city}, {job.propertyAddress.state} {job.propertyAddress.zipCode}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic pl-6">No property address provided</p>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Signers & Invitations Section */}
          {job.signers && job.signers.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader 
                className="cursor-pointer hover:bg-gray-50 transition-colors rounded-t-lg"
                onClick={() => toggleSection('signers')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Signers & Invitations
                    <Badge variant="secondary" className="ml-2">{job.signers.length}</Badge>
                  </CardTitle>
                  {expandedSections.signers ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
              {expandedSections.signers && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {job.signers.map((signer: any) => (
                      <div key={signer.id} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center border-2 border-gray-200">
                              <User className="h-5 w-5 text-gray-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{signer.signerName}</p>
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
                            <Badge className={getRoleColor(signer.signerRole)}>
                              {formatRole(signer.signerRole)}
                            </Badge>
                            <Badge variant={signer.invitationSentAt ? "success" : "secondary"}>
                              {signer.invitationSentAt ? 'Invited' : 'Pending'}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Invitation Actions */}
                        <div className="flex items-center gap-2 mt-3">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (signer.invitationToken) {
                                      copyToClipboard(`${window.location.origin}/sign/${signer.invitationToken}`);
                                    }
                                  }}
                                  className="h-8"
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy Link
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy invitation link</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      const response = await fetch(`/api/signers/${signer.id}/resend-invitation`, {
                                        method: 'POST',
                                        headers: {
                                          'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                          'Content-Type': 'application/json'
                                        }
                                      });
                                      
                                      if (response.ok) {
                                        toast({
                                          title: "Invitation Sent",
                                          description: `Invitation resent to ${signer.signerEmail}`,
                                        });
                                      } else {
                                        throw new Error('Failed to resend invitation');
                                      }
                                    } catch (error) {
                                      toast({
                                        variant: "destructive",
                                        title: "Resend Failed",
                                        description: "Could not resend invitation. Please try again.",
                                      });
                                    }
                                  }}
                                  className="h-8"
                                >
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Resend
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Resend invitation email</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (signer.invitationToken) {
                                      window.open(`/sign/${signer.invitationToken}`, '_blank');
                                    }
                                  }}
                                  className="h-8"
                                >
                                  <Link2 className="h-3 w-3 mr-1" />
                                  Test
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Test invitation link</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Documents Section */}
          <Card className="border-0 shadow-sm">
            <CardHeader 
              className="cursor-pointer hover:bg-gray-50 transition-colors rounded-t-lg"
              onClick={() => toggleSection('documents')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Documents
                  <Badge variant="secondary" className="ml-2">{jobDocuments.length}</Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx"
                    onChange={handleDocumentUpload}
                    className="hidden"
                    id="document-upload"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById('document-upload')?.click();
                    }}
                    className="h-8"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Upload
                  </Button>
                  {expandedSections.documents ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </CardHeader>
            {expandedSections.documents && (
              <CardContent className="pt-0">
                {loadingDocuments ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    Loading documents...
                  </div>
                ) : jobDocuments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="font-medium mb-1">No documents uploaded yet</p>
                    <p className="text-sm">Click "Upload" to add documents to this job</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {jobDocuments.map((document) => (
                      <div key={document.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FileText className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">{document.originalName}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-500">
                                {formatFileSize(document.fileSize)}
                              </span>
                              <Badge className="text-xs" variant={document.documentType === 'original' ? 'default' : 'secondary'}>
                                {document.documentType}
                              </Badge>
                              {document.isRequired && (
                                <Badge variant="destructive" className="text-xs">
                                  Required
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePreview(document.id)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Preview</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownload(document.id, document.originalName)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteDocument(document.id, document.originalName)}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Completed Documents Section */}
          <Card className="border-0 shadow-sm">
            <CardHeader 
              className="cursor-pointer hover:bg-gray-50 transition-colors rounded-t-lg"
              onClick={() => toggleSection('completed')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-green-600" />
                  Completed Documents
                  <Badge variant="success" className="ml-2">{completedDocuments.length}</Badge>
                </CardTitle>
                {expandedSections.completed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {expandedSections.completed && (
              <CardContent className="pt-0">
                {loadingCompleted ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                    Loading completed documents...
                  </div>
                ) : completedDocuments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="font-medium mb-1">No completed documents yet</p>
                    <p className="text-sm">Documents will appear here after signing sessions</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {completedDocuments.map((completedDoc, index) => (
                      <div key={index} className="border border-green-200 bg-green-50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-green-900">{completedDoc.documentName}</h4>
                            <p className="text-sm text-green-700">
                              Completed: {new Date(completedDoc.completedAt).toLocaleString()}
                            </p>
                            {completedDoc.sessionData?.duration && (
                              <p className="text-xs text-green-600">
                                Session duration: {Math.floor(completedDoc.sessionData.duration / 60)}:{(completedDoc.sessionData.duration % 60).toString().padStart(2, '0')}
                              </p>
                            )}
                          </div>
                          <Badge className="bg-green-100 text-green-800">
                            Signed & Completed
                          </Badge>
                        </div>

                        {/* Participants Summary */}
                        <div className="mb-3">
                          <h5 className="text-sm font-medium text-green-900 mb-2">Participants:</h5>
                          <div className="flex flex-wrap gap-2">
                            {completedDoc.participants.map((participant: any, pIndex: number) => (
                              <div key={pIndex} className="flex items-center gap-1 text-xs">
                                <User className="w-3 h-3" />
                                <span className="font-medium">{participant.name}</span>
                                <span className="text-green-600">({participant.role})</span>
                                {participant.hasAgreed && (
                                  <span className="text-green-700">✓ Signed</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Signatures Summary */}
                        <div className="mb-3">
                          <h5 className="text-sm font-medium text-green-900 mb-2">
                            Signatures: {completedDoc.signatures.length}
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {completedDoc.signatures.slice(0, 4).map((signature: any, sIndex: number) => (
                              <div key={sIndex} className="text-xs bg-white rounded p-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">
                                    {signature.type === 'signature' ? '✍️ Signature' : 
                                     signature.type === 'initial' ? '✓ Initial' : 
                                     signature.type === 'stamp' ? '🔘 Stamp' : '📝 Text'}
                                  </span>
                                  <span className="text-green-600">{signature.participantName}</span>
                                </div>
                                {signature.signedAt && (
                                  <div className="text-gray-500 mt-1">
                                    {new Date(signature.signedAt).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            ))}
                            {completedDoc.signatures.length > 4 && (
                              <div className="text-xs text-green-600 font-medium">
                                +{completedDoc.signatures.length - 4} more signatures
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2 border-t border-green-200">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Download completed document (would generate PDF in real app)
                              const dataStr = JSON.stringify(completedDoc, null, 2);
                              const blob = new Blob([dataStr], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = `${completedDoc.documentName}_completed.json`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              URL.revokeObjectURL(url);
                            }}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // View details (expand/modal in real app)
                              console.log('Completed document details:', completedDoc);
                              toast({
                                title: "Document Details",
                                description: "Check browser console for complete document data",
                              });
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Job #{job.id} • Last updated: {new Date().toLocaleDateString()}
          </div>
          <div className="flex items-center gap-3">
            {(job.jobStatus === 'open' || job.jobStatus === 'pending') && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setLocation(`/editor/${job.id}?mode=tagging`);
                    onClose();
                  }}
                  className="bg-orange-50 text-orange-600 border-orange-300 hover:bg-orange-100"
                >
                  <Tag className="h-4 w-4 mr-2" />
                  Start Tagging
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      // First, start the live signing session
                      const response = await fetch(`/api/session/${job.sessionId || job.id}/start-signing`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${localStorage.getItem('token')}`,
                          'Content-Type': 'application/json'
                        }
                      });

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Failed to start live signing session');
                      }

                      const result = await response.json();
                      console.log('✅ Live signing session started:', result);

                      // Show success toast
                      toast({
                        title: "Live Signing Session Started",
                        description: "Session is now active for signing",
                      });

                      // Navigate to editor in signing mode
                      setLocation(`/editor/${job.id}?mode=signing&session=${job.sessionId || job.id}`);
                      onClose();

                    } catch (error) {
                      console.error('❌ Failed to start live signing session:', error);
                      toast({
                        variant: "destructive",
                        title: "Failed to Start Session",
                        description: error instanceof Error ? error.message : "Unable to start live signing session. Please try again.",
                      });
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Video className="h-4 w-4 mr-2" />
                  Start Live Signing
                </Button>
              </>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
      
      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmationDialog.isOpen}
        onClose={() => setConfirmationDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmationDialog.onConfirm}
        title={confirmationDialog.title}
        description={confirmationDialog.description}
        variant="destructive"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </Dialog>
  );
}
