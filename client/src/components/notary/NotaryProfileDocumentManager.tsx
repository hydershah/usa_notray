import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { 
  Upload, 
  FileText, 
  Download, 
  Eye, 
  Edit, 
  Trash2,
  CheckCircle, 
  X,
  AlertCircle,
  Plus,
  Shield,
  Lock,
  Award,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';

interface NotaryDocument {
  id: string;
  fileName: string;
  originalName: string;
  fileKey: string;
  fileUrl: string;
  uploadedAt: string;
  hasFile: boolean;
}

interface NotaryDocumentSet {
  hasNotaryCommissionFile: boolean;
  hasEOInsuranceFile: boolean;
  hasPublicCertificateFile: boolean;
  hasBondFile: boolean;
  hasSigningAgentFile: boolean;
  notaryCommissionFile?: string;
  eoInsuranceFile?: string;
  publicCertificateFile?: string;
  bondFile?: string;
  signingAgentFile?: string;
}

const DOCUMENT_TYPES = [
  {
    key: 'notaryCommissionFile',
    label: 'Commission Certificate',
    icon: FileText,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    required: true
  },
  {
    key: 'eoInsuranceFile',
    label: 'E&O Insurance',
    icon: Shield,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    required: true
  },
  {
    key: 'publicCertificateFile',
    label: 'Digital Certificate',
    icon: Lock,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    required: true
  },
  {
    key: 'bondFile',
    label: 'Bond Certificate',
    icon: FileText,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    required: true
  },
  {
    key: 'signingAgentFile',
    label: 'NSA Certificate',
    icon: Award,
    color: 'text-teal-500',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    required: false
  }
];

interface NotaryProfileDocumentManagerProps {
  notaryId: number;
  onDocumentsChange?: () => void;
}

export function NotaryProfileDocumentManager({ 
  notaryId, 
  onDocumentsChange 
}: NotaryProfileDocumentManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  // Handle keyboard events for modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isUploadDialogOpen && !isUploading) {
        setIsUploadDialogOpen(false);
      }
    };

    if (isUploadDialogOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isUploadDialogOpen, isUploading]);

  // Fetch notary document status
  const { data: documentStatus, isLoading, refetch } = useQuery<NotaryDocumentSet>({
    queryKey: [`/api/notary/profile/documents/${notaryId}`],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/notary/profile/documents/${notaryId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch document status');
      return response.json();
    }
  });

  // Upload document mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: string }) => {
      const formData = new FormData();
      formData.append(documentType, file);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/notary/profile/upload-documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload document');
      }

      return response.json();
    },
    onSuccess: () => {
      setIsUploading(false);
      setUploadProgress(0);
      setIsUploadDialogOpen(false);
      setSelectedDocumentType('');
      refetch();
      onDocumentsChange?.();
      toast({
        title: "Document Uploaded",
        description: "Your document has been uploaded successfully.",
      });
    },
    onError: (error: any) => {
      setIsUploading(false);
      setUploadProgress(0);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document.",
        variant: "destructive"
      });
    }
  });

  // Migrate documents mutation
  const migrateDocumentsMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/notary/profile/migrate-documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to migrate documents');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setIsMigrating(false);
      refetch();
      onDocumentsChange?.();
      toast({
        title: "Migration Completed",
        description: `${data.migratedCount} documents migrated to cloud storage.`,
      });
    },
    onError: (error: any) => {
      setIsMigrating(false);
      toast({
        title: "Migration Failed",
        description: error.message || "Failed to migrate documents.",
        variant: "destructive"
      });
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedDocumentType) return;

    // Validate file type based on document type
    const isValidFileType = (documentType: string, file: File) => {
      if (documentType === 'publicCertificateFile') {
        // Digital certificates should be .pfx or .p12 files
        const validExtensions = ['.pfx', '.p12'];
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        return validExtensions.includes(fileExtension);
      } else {
        // Other documents should be PDF, JPG, JPEG, or PNG
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        return allowedTypes.includes(file.type);
      }
    };

    if (!isValidFileType(selectedDocumentType, file)) {
      const allowedTypes = selectedDocumentType === 'publicCertificateFile' 
        ? '.pfx or .p12 files' 
        : 'PDF, JPG, JPEG, or PNG files';
      
      toast({
        title: "Invalid File Type",
        description: `Please select ${allowedTypes} only.`,
        variant: "destructive"
      });
      return;
    }

    // Validate file size (25MB max)
    if (file.size > 25 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select a file smaller than 25MB.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    uploadDocumentMutation.mutate({ file, documentType: selectedDocumentType });
  };

  const handleDownload = async (documentType: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/notary/profile/documents/${notaryId}/download/${documentType}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to download document');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${documentType}-${Date.now()}`;
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

  const handlePreview = (documentType: string) => {
    const token = localStorage.getItem('token');
    const previewUrl = `/api/notary/profile/documents/${notaryId}/preview/${documentType}?token=${token}`;
    window.open(previewUrl, '_blank');
  };

  const handleReupload = (documentType: string) => {
    const docType = DOCUMENT_TYPES.find(d => d.key === documentType);
    if (!docType) return;

    setConfirmationDialog({
      isOpen: true,
      title: 'Replace Document',
      description: `Are you sure you want to replace your ${docType.label}? This will remove the current file and upload a new one.`,
      onConfirm: () => {
        setSelectedDocumentType(documentType);
        setIsUploadDialogOpen(true);
        setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleMigrateDocuments = () => {
    setConfirmationDialog({
      isOpen: true,
      title: 'Migrate Documents to Cloud Storage',
      description: 'This will move your existing documents from local storage to cloud storage for better reliability and access. This operation is safe and reversible.',
      onConfirm: () => {
        setIsMigrating(true);
        migrateDocumentsMutation.mutate();
        setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Check if user has any local documents that need migration
  const hasLocalDocuments = documentStatus && Object.entries(documentStatus).some(([key, value]) => {
    return key.includes('File') && typeof value === 'string' && 
           (value.startsWith('/uploads/') || value.startsWith('uploads/'));
  });

  const renderDocumentCard = (docType: typeof DOCUMENT_TYPES[0]) => {
    const hasFile = documentStatus?.[`has${docType.key.charAt(0).toUpperCase() + docType.key.slice(1, -4)}File` as keyof NotaryDocumentSet] as boolean;
    const Icon = docType.icon;

    return (
      <Card key={docType.key} className={`${docType.bgColor} ${docType.borderColor} border-2`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasFile ? 'bg-green-500' : 'bg-gray-400'}`}>
                {hasFile ? (
                  <CheckCircle className="w-5 h-5 text-white" />
                ) : (
                  <Icon className={`w-5 h-5 text-white`} />
                )}
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{docType.label}</h4>
                <p className={`text-sm ${hasFile ? 'text-green-600' : 'text-gray-600'}`}>
                  {hasFile ? 'Uploaded' : 'Not uploaded'}
                  {docType.required && !hasFile && ' (Required)'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {hasFile ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePreview(docType.key)}
                    title="Preview document"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(docType.key)}
                    title="Download document"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReupload(docType.key)}
                    title="Replace document"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedDocumentType(docType.key);
                    setIsUploadDialogOpen(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Upload
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading documents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-500 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Document Management</h3>
            <p className="text-gray-600">View, download, and manage your notary documents</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasLocalDocuments && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMigrateDocuments}
              disabled={isMigrating}
              className="flex items-center gap-2"
            >
              {isMigrating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isMigrating ? 'Migrating...' : 'Migrate to Cloud'}
            </Button>
          )}
          <Badge className="bg-gray-100 text-gray-800">
            {documentStatus ? Object.values(documentStatus).filter(Boolean).length : 0} / {DOCUMENT_TYPES.length} Files
          </Badge>
        </div>
      </div>

      {/* Document Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DOCUMENT_TYPES.map(renderDocumentCard)}
      </div>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Upload Document</DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsUploadDialogOpen(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            {selectedDocumentType && (
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Upload your {DOCUMENT_TYPES.find(d => d.key === selectedDocumentType)?.label}
                </p>
                
                {isUploading ? (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="w-full" />
                    <p className="text-sm text-gray-600">Uploading... {uploadProgress}%</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors">
                      <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-sm text-gray-600 mb-2">
                        Drag and drop or click to select
                      </p>
                      <p className="text-xs text-gray-500">
                        {selectedDocumentType === 'publicCertificateFile' 
                          ? 'PFX or P12 files (max 25MB)' 
                          : 'PDF, JPG, JPEG, or PNG (max 25MB)'}
                      </p>
                    </div>
                    
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                      disabled={isUploading}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Select File
                    </Button>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={selectedDocumentType === 'publicCertificateFile' ? '.pfx,.p12' : '.pdf,.jpg,.jpeg,.png'}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsUploadDialogOpen(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmationDialog.isOpen}
        onClose={() => setConfirmationDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmationDialog.onConfirm}
        title={confirmationDialog.title}
        description={confirmationDialog.description}
      />
    </div>
  );
} 