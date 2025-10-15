import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { 
  Upload, 
  FileText, 
  Download, 
  Eye, 
  X,
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
    required: true
  },
  {
    key: 'eoInsuranceFile',
    label: 'E&O Insurance',
    icon: Shield,
    required: true
  },
  {
    key: 'publicCertificateFile',
    label: 'Digital Certificate',
    icon: Lock,
    required: true
  },
  {
    key: 'bondFile',
    label: 'Bond Certificate',
    icon: FileText,
    required: true
  },
  {
    key: 'signingAgentFile',
    label: 'NSA Certificate',
    icon: Award,
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCertificateDialogOpen, setIsCertificateDialogOpen] = useState(false);
  const [certificateData, setCertificateData] = useState({
    expirationDate: '',
    password: ''
  });
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
    mutationFn: async ({ 
      file, 
      documentType, 
      certificateExpiration, 
      certificatePassword 
    }: { 
      file: File; 
      documentType: string;
      certificateExpiration?: string;
      certificatePassword?: string;
    }) => {
      const formData = new FormData();
      formData.append(documentType, file);
      
      // Add certificate metadata if provided
      if (documentType === 'publicCertificateFile' && certificateExpiration && certificatePassword) {
        formData.append('publicCertificateExpiration', certificateExpiration);
        formData.append('publicCertificatePassword', certificatePassword);
      }

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
      setIsCertificateDialogOpen(false);
      setSelectedDocumentType('');
      setSelectedFile(null);
      setCertificateData({ expirationDate: '', password: '' });
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

    // If it's a digital certificate, show metadata dialog
    if (selectedDocumentType === 'publicCertificateFile') {
      setSelectedFile(file);
      setIsUploadDialogOpen(false);
      setIsCertificateDialogOpen(true);
      return;
    }

    // For other documents, upload directly
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

  const handleCertificateUpload = () => {
    if (!selectedFile || !certificateData.expirationDate || !certificateData.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in both certificate expiration date and password.",
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

    uploadDocumentMutation.mutate({ 
      file: selectedFile, 
      documentType: 'publicCertificateFile',
      certificateExpiration: certificateData.expirationDate,
      certificatePassword: certificateData.password
    });
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
      <div
        key={docType.key}
        className={`p-4 border rounded-lg transition-all ${
          hasFile 
            ? 'border-green-200 bg-green-50/30' 
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className={`p-2.5 rounded-lg ${
              hasFile ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <Icon className={`w-5 h-5 ${hasFile ? 'text-green-700' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className="text-sm font-medium text-gray-900">{docType.label}</h4>
                {docType.required && (
                  <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-medium">
                    Required
                  </span>
                )}
                {hasFile && (
                  <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                    Uploaded
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {hasFile 
                  ? 'Document uploaded and available' 
                  : 'Upload your document to complete this requirement'
                }
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
                  title="Preview"
                  className="h-9 w-9 p-0"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(docType.key)}
                  title="Download"
                  className="h-9 w-9 p-0"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReupload(docType.key)}
                  className="h-9"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Replace
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedDocumentType(docType.key);
                  setIsUploadDialogOpen(true);
                }}
                className="h-9"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hasLocalDocuments && (
        <div className="flex items-center justify-end pb-2 border-b">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMigrateDocuments}
            disabled={isMigrating}
          >
            {isMigrating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Migrating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Migrate to Cloud
              </>
            )}
          </Button>
        </div>
      )}

      {/* Document Cards */}
      <div className="space-y-3">
        {DOCUMENT_TYPES.map(renderDocumentCard)}
      </div>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedDocumentType && (
              <>
                <div className="text-sm text-gray-600">
                  Upload your {DOCUMENT_TYPES.find(d => d.key === selectedDocumentType)?.label}
                </div>
                
                {isUploading ? (
                  <div className="space-y-3">
                    <Progress value={uploadProgress} className="w-full" />
                    <p className="text-sm text-center text-gray-600">Uploading... {uploadProgress}%</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                      <p className="text-sm text-center text-gray-700 font-medium mb-1">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-center text-gray-500">
                        {selectedDocumentType === 'publicCertificateFile' 
                          ? 'PFX or P12 files (max 25MB)' 
                          : 'PDF, JPG, JPEG, or PNG (max 25MB)'}
                      </p>
                    </div>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={selectedDocumentType === 'publicCertificateFile' ? '.pfx,.p12' : '.pdf,.jpg,.jpeg,.png'}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                )}
              </>
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

      {/* Certificate Metadata Dialog */}
      <Dialog open={isCertificateDialogOpen} onOpenChange={setIsCertificateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-600" />
              Digital Certificate Information
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              Please provide the expiration date and password for your digital certificate.
            </p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cert-expiration" className="text-sm font-medium">
                  Certificate Expiration Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="cert-expiration"
                  type="date"
                  value={certificateData.expirationDate}
                  onChange={(e) => setCertificateData(prev => ({ ...prev, expirationDate: e.target.value }))}
                  className="w-full"
                  placeholder="mm/dd/yyyy"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cert-password" className="text-sm font-medium">
                  Certificate Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="cert-password"
                  type="password"
                  value={certificateData.password}
                  onChange={(e) => setCertificateData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full"
                  placeholder="Enter certificate password"
                />
                <p className="text-xs text-gray-500">
                  This password is required to use your digital certificate for signing documents.
                </p>
              </div>
            </div>

            {selectedFile && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                <FileText className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-700 truncate flex-1">{selectedFile.name}</span>
              </div>
            )}

            {isUploading && (
              <div className="space-y-3">
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-sm text-center text-gray-600">Uploading... {uploadProgress}%</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCertificateDialogOpen(false);
                setSelectedFile(null);
                setCertificateData({ expirationDate: '', password: '' });
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCertificateUpload}
              disabled={isUploading || !certificateData.expirationDate || !certificateData.password}
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Certificate
                </>
              )}
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