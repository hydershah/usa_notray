import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { 
  Upload, 
  FileText, 
  Download, 
  Eye, 
  Edit, 
  Trash2,
  CheckCircle, 
  Clock, 
  AlertCircle,
  Plus,
  File,
  FileCheck,
  FileX,
  Paperclip,
  RotateCcw,
  Save,
  X
} from "lucide-react";
import { formatDate, formatFileSize } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface JobDocument {
  id: number;
  jobId: number;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  documentType: 'original' | 'notarized' | 'additional';
  status: 'uploaded' | 'processing' | 'ready' | 'signed';
  uploadedBy: number;
  isRequired: boolean;
  signaturePages: number[];
  createdAt: string;
  updatedAt: string;
  uploadedByName?: string;
}

interface DocumentUploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

interface EnhancedDocumentManagerProps {
  jobId: number;
  userRole: string;
  jobStatus: string;
  onDocumentsChange?: () => void;
}

export default function EnhancedDocumentManager({ 
  jobId, 
  userRole, 
  jobStatus,
  onDocumentsChange 
}: EnhancedDocumentManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedDocument, setSelectedDocument] = useState<JobDocument | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<DocumentUploadProgress[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Document edit form
  const [editForm, setEditForm] = useState({
    documentType: 'original' as const,
    isRequired: false,
    signaturePages: [] as number[]
  });
  
  // Confirmation dialog state
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    type: 'single' | 'bulk';
    document?: JobDocument;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    type: 'single',
    title: '',
    description: '',
    onConfirm: () => {}
  });

  // Data fetching
  const { data: documents = [], isLoading, refetch } = useQuery<JobDocument[]>({
    queryKey: [`/api/jobs/${jobId}/documents`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/jobs/${jobId}/documents`);
      return response.json();
    }
  });

  // Mutations
  const uploadDocumentsMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      
      Array.from(files).forEach((file, index) => {
        formData.append('documents', file);
        formData.append(`documentMetadata_${index}`, JSON.stringify({
          isRequired: false,
          documentType: 'original',
          originalName: file.name
        }));
      });

      const response = await apiRequest("POST", `/api/jobs/${jobId}/documents`, formData);
      return response.json();
    },
    onSuccess: () => {
      refetch();
      onDocumentsChange?.();
      setUploadProgress([]);
      toast({
        title: "Documents Uploaded",
        description: "Documents have been uploaded successfully.",
      });
    },
    onError: (error: any) => {
      setUploadProgress([]);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload documents.",
        variant: "destructive"
      });
    }
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async ({ documentId, data }: { documentId: number; data: any }) => {
      const response = await apiRequest("PUT", `/api/jobs/${jobId}/documents/${documentId}`, data);
      return response.json();
    },
    onSuccess: () => {
      refetch();
      onDocumentsChange?.();
      setIsEditOpen(false);
      toast({
        title: "Document Updated",
        description: "Document settings have been updated.",
      });
    }
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      const response = await apiRequest("DELETE", `/api/jobs/${jobId}/documents/${documentId}`);
      return response.json();
    },
    onSuccess: () => {
      refetch();
      onDocumentsChange?.();
      toast({
        title: "Document Deleted",
        description: "Document has been deleted successfully.",
      });
    }
  });

  const bulkDeleteDocumentsMutation = useMutation({
    mutationFn: async (documentIds: number[]) => {
      const promises = documentIds.map(id => 
        apiRequest("DELETE", `/api/jobs/${jobId}/documents/${id}`)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      refetch();
      onDocumentsChange?.();
      setSelectedDocuments([]);
      setShowBulkActions(false);
      toast({
        title: "Documents Deleted",
        description: `${selectedDocuments.length} documents have been deleted successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Delete Failed",
        description: error.message || "Some documents could not be deleted.",
        variant: "destructive"
      });
    }
  });

  // Helper functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploaded':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'ready':
        return <FileCheck className="h-4 w-4 text-green-500" />;
      case 'signed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <File className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      uploaded: "bg-blue-100 text-blue-800",
      processing: "bg-yellow-100 text-yellow-800", 
      ready: "bg-green-100 text-green-800",
      signed: "bg-green-100 text-green-800"
    };

    const colorClass = colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";

    return (
      <Badge className={`${colorClass} border-0`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getDocumentTypeIcon = (type: string) => {
    switch (type) {
      case 'original':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'notarized':
        return <FileCheck className="h-4 w-4 text-green-500" />;
      case 'additional':
        return <Paperclip className="h-4 w-4 text-purple-500" />;
      default:
        return <File className="h-4 w-4 text-gray-500" />;
    }
  };

  const canEditDocuments = userRole === 'admin' || userRole === 'title_company' || 
                           (userRole === 'notary' && ['open', 'pending'].includes(jobStatus));

  // Enhanced delete permissions: admin, job creator, or document uploader
  const canDeleteDocument = (document: JobDocument) => {
    return userRole === 'admin' || 
           userRole === 'title_company' || 
           document.uploadedBy === user?.id ||
           userRole === 'notary'; // Allow notaries to delete documents too
  };

  // File handling
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (!canEditDocuments) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to upload documents.",
        variant: "destructive"
      });
      return;
    }

    // Initialize upload progress tracking
    const progressItems: DocumentUploadProgress[] = Array.from(files).map(file => ({
      fileName: file.name,
      progress: 0,
      status: 'uploading'
    }));
    setUploadProgress(progressItems);

    uploadDocumentsMutation.mutate(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDownload = async (document: JobDocument) => {
    try {
      const response = await apiRequest("GET", `/api/jobs/${jobId}/documents/${document.id}/download`);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download document.",
        variant: "destructive"
      });
    }
  };

  const handlePreview = (document: JobDocument) => {
    // Open document preview in new tab
    const previewUrl = `/api/jobs/${jobId}/documents/${document.id}/preview?token=${localStorage.getItem('token')}`;
    window.open(previewUrl, '_blank');
  };

  const handleEdit = (document: JobDocument) => {
    setSelectedDocument(document);
    setEditForm({
      documentType: document.documentType,
      isRequired: document.isRequired,
      signaturePages: document.signaturePages || []
    });
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedDocument) return;

    updateDocumentMutation.mutate({
      documentId: selectedDocument.id,
      data: {
        documentType: editForm.documentType,
        isRequired: editForm.isRequired,
        signaturePages: editForm.signaturePages
      }
    });
  };

  const handleDelete = (document: JobDocument) => {
    setConfirmationDialog({
      isOpen: true,
      type: 'single',
      document,
      title: 'Delete Document',
      description: `Are you sure you want to delete "${document.originalName}"? This action cannot be undone.`,
      onConfirm: () => {
        deleteDocumentMutation.mutate(document.id);
        setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleSelectDocument = (documentId: number, checked: boolean) => {
    if (checked) {
      setSelectedDocuments(prev => [...prev, documentId]);
    } else {
      setSelectedDocuments(prev => prev.filter(id => id !== documentId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const deletableDocIds = documents
        .filter(doc => canDeleteDocument(doc))
        .map(doc => doc.id);
      setSelectedDocuments(deletableDocIds);
    } else {
      setSelectedDocuments([]);
    }
  };

  const handleBulkDelete = () => {
    const selectedDocs = documents.filter(doc => selectedDocuments.includes(doc.id));
    const docNames = selectedDocs.map(doc => doc.originalName).join(', ');
    
    setConfirmationDialog({
      isOpen: true,
      type: 'bulk',
      title: `Delete ${selectedDocuments.length} Documents`,
      description: selectedDocuments.length > 3 
        ? `Are you sure you want to delete ${selectedDocuments.length} documents? This action cannot be undone.`
        : `Are you sure you want to delete the following documents? This action cannot be undone.\n\n${docNames}`,
      onConfirm: () => {
        bulkDeleteDocumentsMutation.mutate(selectedDocuments);
        setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const addSignaturePage = () => {
    const pageNumber = editForm.signaturePages.length + 1;
    setEditForm(prev => ({
      ...prev,
      signaturePages: [...prev.signaturePages, pageNumber]
    }));
  };

  const removeSignaturePage = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      signaturePages: prev.signaturePages.filter((_, i) => i !== index)
    }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading documents...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {canEditDocuments && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drag and drop documents here
              </p>
              <p className="text-sm text-gray-500 mb-4">
                or click to select files
              </p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadDocumentsMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Select Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>

            {/* Upload Progress */}
            {uploadProgress.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploadProgress.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span className="text-sm flex-1">{item.fileName}</span>
                    <div className="w-32">
                      <Progress value={item.progress} className="h-2" />
                    </div>
                    <span className="text-xs text-gray-500 w-16">
                      {item.status === 'uploading' ? `${item.progress}%` : item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documents ({documents.length})
              {selectedDocuments.length > 0 && (
                <Badge className="bg-blue-100 text-blue-800">
                  {selectedDocuments.length} selected
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              {selectedDocuments.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteDocumentsMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedDocuments.length})
                </Button>
              )}
              {documents.filter(d => d.status === 'ready').length > 0 && (
                <Badge className="bg-green-100 text-green-800">
                  {documents.filter(d => d.status === 'ready').length} Ready
                </Badge>
              )}
              {documents.filter(d => d.status === 'signed').length > 0 && (
                <Badge className="bg-blue-100 text-blue-800">
                  {documents.filter(d => d.status === 'signed').length} Signed
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileX className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No documents uploaded yet.</p>
              {canEditDocuments && (
                <p className="text-sm">Upload documents to get started.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedDocuments.length > 0 && 
                               selectedDocuments.length === documents.filter(doc => canDeleteDocument(doc)).length}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all documents"
                    />
                  </TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>
                      {canDeleteDocument(document) && (
                        <Checkbox
                          checked={selectedDocuments.includes(document.id)}
                          onCheckedChange={(checked) => handleSelectDocument(document.id, !!checked)}
                          aria-label={`Select ${document.originalName}`}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {getDocumentTypeIcon(document.documentType)}
                        <div>
                          <div className="font-medium">{document.originalName}</div>
                          <div className="text-sm text-gray-500">{document.fileName}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {document.documentType.charAt(0).toUpperCase() + document.documentType.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatFileSize(document.fileSize)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(document.status)}
                        {getStatusBadge(document.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {document.isRequired ? (
                        <Badge className="bg-red-100 text-red-800">Required</Badge>
                      ) : (
                        <Badge variant="outline">Optional</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{formatDate(document.createdAt)}</div>
                        {document.uploadedByName && (
                          <div className="text-gray-500">by {document.uploadedByName}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(document)}
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(document)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {canEditDocuments && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(document)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDeleteDocument(document) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(document)}
                            title="Delete"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Document Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">File Name</label>
                  <p className="text-sm">{selectedDocument.originalName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Document Type</label>
                  <div>{getDocumentTypeIcon(selectedDocument.documentType)} {selectedDocument.documentType}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">File Size</label>
                  <p className="text-sm">{formatFileSize(selectedDocument.fileSize)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div>{getStatusBadge(selectedDocument.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Required</label>
                  <p className="text-sm">{selectedDocument.isRequired ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">MIME Type</label>
                  <p className="text-sm">{selectedDocument.mimeType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Uploaded</label>
                  <p className="text-sm">{formatDate(selectedDocument.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Updated</label>
                  <p className="text-sm">{formatDate(selectedDocument.updatedAt)}</p>
                </div>
              </div>
              
              {selectedDocument.signaturePages.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Signature Pages</label>
                  <div className="flex gap-1 mt-1">
                    {selectedDocument.signaturePages.map((page, index) => (
                      <Badge key={index} variant="outline">Page {page}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Document Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Document Settings</DialogTitle>
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Document Type</label>
                <Select 
                  value={editForm.documentType} 
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, documentType: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">Original</SelectItem>
                    <SelectItem value="notarized">Notarized</SelectItem>
                    <SelectItem value="additional">Additional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isRequired"
                  checked={editForm.isRequired}
                  onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isRequired: !!checked }))}
                />
                <label htmlFor="isRequired" className="text-sm font-medium">
                  This document is required for job completion
                </label>
              </div>

              <div>
                <label className="text-sm font-medium">Signature Pages</label>
                <div className="space-y-2 mt-2">
                  {editForm.signaturePages.map((page, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={page}
                        onChange={(e) => {
                          const newPages = [...editForm.signaturePages];
                          newPages[index] = parseInt(e.target.value) || 1;
                          setEditForm(prev => ({ ...prev, signaturePages: newPages }));
                        }}
                        className="w-24"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSignaturePage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addSignaturePage}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Signature Page
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleUpdate}
                  disabled={updateDocumentMutation.isPending}
                  className="flex-1"
                >
                  {updateDocumentMutation.isPending ? 'Updating...' : 'Update Document'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
        isLoading={deleteDocumentMutation.isPending || bulkDeleteDocumentsMutation.isPending}
      />
    </div>
  );
} 