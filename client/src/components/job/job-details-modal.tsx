import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getStatusColor, getRoleColor, formatDate, formatRole } from '@/lib/utils';
import { Download, FileText, User, Video, Tag, Eye, Upload, Edit3, Save, X, Trash2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface JobDetailsModalProps {
  job: any;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdate: (jobId: number, status: string) => void;
}

export function JobDetailsModal({ job, isOpen, onClose, onStatusUpdate }: JobDetailsModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [jobDocuments, setJobDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [completedDocuments, setCompletedDocuments] = useState<any[]>([]);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  
  // Notary change functionality
  const [isChangingNotary, setIsChangingNotary] = useState(false);
  const [availableNotaries, setAvailableNotaries] = useState<any[]>([]);
  const [selectedNewNotary, setSelectedNewNotary] = useState<string>('');
  const [notarySearchCode, setNotarySearchCode] = useState<string>('');
  const [loadingNotaries, setLoadingNotaries] = useState(false);
  const [changingNotary, setChangingNotary] = useState(false);
  
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

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate files before upload
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    for (const file of Array.from(files)) {
      if (file.size > maxSize) {
        toast({
          variant: "destructive",
          title: "File Too Large",
          description: `${file.name} is larger than 10MB. Please choose a smaller file.`,
        });
        event.target.value = '';
        return;
      }
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: `${file.name} is not a supported file type. Please upload PDF, DOC, or DOCX files.`,
        });
        event.target.value = '';
        return;
      }
    }

    const formData = new FormData();
    Array.from(files).forEach((file, index) => {
      formData.append('documents', file);
      formData.append(`documentMetadata_${index}`, JSON.stringify({
        originalName: file.name,
        isRequired: false,
        documentType: 'additional'
      }));
    });

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`/api/jobs/${job.id}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Documents Uploaded Successfully",
          description: result.message || `Uploaded ${files.length} document(s)`,
        });
        loadJobDocuments(); // Reload documents
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload documents. Please try again.",
      });
    }

    // Clear the input
    event.target.value = '';
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
        console.warn('Failed to load available notaries');
        setAvailableNotaries([]);
      }
    } catch (error) {
      console.error('Error loading available notaries:', error);
      setAvailableNotaries([]);
    } finally {
      setLoadingNotaries(false);
    }
  };

  const handleNotarySearch = (searchTerm: string) => {
    setNotarySearchCode(searchTerm);
    if (searchTerm.length >= 2) {
      const filtered = availableNotaries.filter(notary => 
        notary.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notary.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notary.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notary.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (filtered.length === 1) {
        setSelectedNewNotary(filtered[0].id.toString());
      }
    }
  };

  const handleNotaryChange = async () => {
    if (!selectedNewNotary) {
      toast({
        variant: "destructive",
        title: "No Notary Selected",
        description: "Please select a notary to assign to this job.",
      });
      return;
    }

    try {
      setChangingNotary(true);
      
      // Prepare the assignment data
      const assignmentData = {
        jobId: job.id,
        notaryId: parseInt(selectedNewNotary),
        timeSlot: {
          date: job.selectedDate,
          startTime: job.selectedTime,
          endTime: job.selectedTime // This should be calculated based on appointment duration
        },
        assignmentType: 'manual'
      };

      const response = await fetch('/api/random-notary/assign', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(assignmentData)
      });

      if (response.ok) {
        const selectedNotary = availableNotaries.find(n => n.id.toString() === selectedNewNotary);
        const notaryName = selectedNotary ? 
          `${selectedNotary.firstName || ''} ${selectedNotary.lastName || ''}`.trim() || selectedNotary.username :
          'Unknown Notary';

        toast({
          title: "Notary Changed Successfully",
          description: `Job has been reassigned to ${notaryName}`,
        });

        // Reset states
        setIsChangingNotary(false);
        setSelectedNewNotary('');
        setNotarySearchCode('');
        
        // Trigger a refresh of the job data (you may need to implement this)
        window.location.reload();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change notary');
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="job-details-description">
        <DialogHeader>
          <DialogTitle>Job Details</DialogTitle>
          <div id="job-details-description" className="sr-only">
            View comprehensive job information including property details, signers, documents, and scheduling
          </div>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-sm text-gray-600">Job Reference:</span>
                <span className="ml-2 text-sm font-medium text-gray-900">
                  {job.internalReference || `Job #${job.id}`}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-600">Title Company:</span>
                <span className="ml-2 text-sm font-medium text-gray-900">{job.titleCompany}</span>
              </div>
              <div>
                <span className="text-sm text-gray-600">Closing Type:</span>
                <span className="ml-2 text-sm font-medium text-gray-900">{job.closingType}</span>
              </div>
              <div>
                <span className="text-sm text-gray-600">KBA Required:</span>
                <span className="ml-2 text-sm font-medium text-gray-900">
                  {job.kbaRequired ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-600">Status:</span>
                <Badge className={`ml-2 ${getStatusColor(job.jobStatus)}`}>
                  {job.jobStatus}
                </Badge>
              </div>
              <div className="mt-4">
                <span className="text-sm text-gray-600">Update Status:</span>
                <Select onValueChange={(value) => onStatusUpdate(job.id, value)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Change status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Schedule & Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-sm text-gray-600">Date:</span>
                <span className="ml-2 text-sm font-medium text-gray-900">
                  {job.selectedDate ? formatDate(job.selectedDate) : 'Not scheduled'}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-600">Time:</span>
                <span className="ml-2 text-sm font-medium text-gray-900">
                  {job.selectedTime || 'Not scheduled'}
                </span>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Notary:</span>
                  {job.selectedNotary && !isChangingNotary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsChangingNotary(true)}
                      className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
                    >
                      <Edit3 className="h-3 w-3 mr-1" />
                      Change
                    </Button>
                  )}
                </div>
                
                {!isChangingNotary ? (
                  <span className="ml-2 text-sm font-medium text-gray-900">
                    {job.selectedNotary || 'Not assigned'}
                  </span>
                ) : (
                  <div className="mt-2 space-y-3">
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
                )}
              </div>
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Property Address</h4>
                <div className="text-sm text-gray-700">
                  <div>{job.propertyAddressOne}</div>
                  {job.propertyAddressTwo && <div>{job.propertyAddressTwo}</div>}
                  <div>{job.propertyCity}, {job.propertyState} {job.propertyZipCode}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {job.signers && job.signers.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Signers & Invitations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {job.signers.map((signer: any) => (
                  <div key={signer.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                          <User className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{signer.signerName}</p>
                          <p className="text-sm text-gray-600">
                            {signer.signerEmail} • {signer.signerPhoneNumber}
                          </p>
                        </div>
                      </div>
                      <Badge className={getRoleColor(signer.signerRole)}>
                        {formatRole(signer.signerRole)}
                      </Badge>
                    </div>
                    
                    {/* Invitation Management */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <div className="flex items-center space-x-2">
                        <Badge 
                          className={signer.invitationSentAt ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}
                        >
                          {signer.invitationSentAt ? "✅ Invitation Sent" : "⏳ Pending"}
                        </Badge>
                        {signer.invitationSentAt && (
                          <span className="text-xs text-gray-500">
                            {new Date(signer.invitationSentAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const invitationLink = `${window.location.origin}/sign/${signer.invitationToken || 'demo-token'}`;
                            navigator.clipboard.writeText(invitationLink);
                            toast({
                              title: "Link Copied",
                              description: "Invitation link copied to clipboard.",
                            });
                          }}
                          title="Copy invitation link"
                        >
                          📋 Copy Link
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              // Call resend invitation API
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
                          title="Resend invitation email"
                        >
                          📧 Resend
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (signer.invitationToken) {
                              window.open(`/sign/${signer.invitationToken}`, '_blank');
                            } else {
                              toast({
                                variant: "destructive",
                                title: "No Token",
                                description: "No invitation token found for this signer.",
                              });
                            }
                          }}
                          title="Test invitation link"
                        >
                          🔗 Test
                        </Button>
                      </div>
                    </div>
                    
                    {/* Invitation Link Display */}
                    {signer.invitationToken && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Invitation Link:</div>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded block break-all">
                          {window.location.origin}/sign/{signer.invitationToken}
                        </code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Documents</CardTitle>
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
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('document-upload')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingDocuments ? (
              <div className="text-center py-4 text-gray-500">
                Loading documents...
              </div>
            ) : (
              <div className="space-y-2">
                {jobDocuments.map((document) => (
                  <div key={document.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center flex-1">
                      <FileText className="h-5 w-5 text-primary mr-3" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-900">{document.originalName}</p>
                          <Badge className={`text-xs ${getDocumentTypeColor(document.documentType)}`}>
                            {document.documentType}
                          </Badge>
                          {document.isRequired && (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(document.fileSize)} • {document.mimeType}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(document.id)}
                        title="Preview document"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(document.id, document.originalName)}
                        title="Download document"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDocument(document.id, document.originalName)}
                        title="Delete document"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {!jobDocuments.length && (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-2">No documents uploaded yet</p>
                    <p className="text-xs">Click "Upload" to add documents to this job</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Documents Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              Completed Documents ({completedDocuments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCompleted ? (
              <div className="text-center py-4 text-gray-500">
                Loading completed documents...
              </div>
            ) : completedDocuments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">No completed documents yet</p>
                <p className="text-xs">Documents will appear here after signing sessions are completed</p>
              </div>
            ) : (
              <div className="space-y-4">
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
        </Card>

        <div className="flex justify-end space-x-3 mt-6">
          {(job.jobStatus === 'open' || job.jobStatus === 'pending') && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  // Navigate to editor in tagging mode
                  setLocation(`/editor/${job.id}?mode=tagging`);
                  onClose();
                }}
                className="text-orange-600 border-orange-600 hover:bg-orange-50"
              >
                <Tag className="h-4 w-4 mr-2" />
                Start Document Tagging
              </Button>
              <Button
                onClick={() => {
                  // Navigate to editor in signing mode
                  setLocation(`/editor/${job.id}?mode=signing`);
                  onClose();
                }}
                className="bg-blue-600 hover:bg-blue-700"
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
