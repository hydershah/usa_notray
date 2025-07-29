import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, File, X, CheckCircle, AlertCircle, Download, Trash2 } from 'lucide-react';

interface SignerDocument {
  id: number;
  document_name: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  document_type: string;
  uploaded_at: string;
  fileUrl: string;
  status: string;
}

interface SignerDocumentUploadProps {
  participantId: number;
  jobId?: number;
  sessionId?: string;
  onDocumentUploaded?: (document: SignerDocument) => void;
  onDocumentDeleted?: (documentId: number) => void;
  className?: string;
}

export const SignerDocumentUpload: React.FC<SignerDocumentUploadProps> = ({
  participantId,
  jobId,
  sessionId,
  onDocumentUploaded,
  onDocumentDeleted,
  className = ''
}) => {
  const [documents, setDocuments] = useState<SignerDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documentName, setDocumentName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load existing documents on component mount
  React.useEffect(() => {
    loadDocuments();
  }, [participantId]);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/signer-documents/${participantId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      } else {
        console.error('Failed to load documents');
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload PDF, DOC, DOCX, or image files only.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 50MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setDocumentName(file.name.replace(/\.[^/.]+$/, "")); // Remove extension for default name
  };

  const handleUpload = async () => {
    if (!selectedFile || !documentName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a document name and select a file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('document', selectedFile);
      formData.append('documentName', documentName);
      formData.append('participantId', participantId.toString());
      formData.append('documentType', 'additional');

      if (jobId) {
        formData.append('jobId', jobId.toString());
      }
      if (sessionId) {
        formData.append('sessionId', sessionId);
      }

      const token = localStorage.getItem('token');
      const response = await fetch('/api/uploads/signer-document', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        
        const newDocument: SignerDocument = {
          id: result.documentId,
          document_name: documentName,
          original_filename: selectedFile.name,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          document_type: 'additional',
          uploaded_at: new Date().toISOString(),
          fileUrl: result.fileUrl,
          status: 'uploaded'
        };

        setDocuments(prev => [newDocument, ...prev]);
        setSelectedFile(null);
        setDocumentName('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        toast({
          title: "Upload Successful",
          description: "Document uploaded successfully.",
        });

        onDocumentUploaded?.(newDocument);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (documentId: number) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/signer-documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setDocuments(prev => prev.filter(doc => doc.id !== documentId));
        toast({
          title: "Document Deleted",
          description: "Document deleted successfully.",
        });
        onDocumentDeleted?.(documentId);
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('word')) return '📝';
    return '📎';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Documents
          </CardTitle>
          <CardDescription>
            Upload additional documents for this notarization session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Selection */}
          <div className="space-y-2">
            <Label htmlFor="document-name">Document Name</Label>
            <Input
              id="document-name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Enter a name for this document"
              disabled={isUploading}
            />
          </div>

          <div className="space-y-2">
            <Label>Select File</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
              <div 
                className="cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Click to select a file or drag and drop
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PDF, DOC, DOCX, JPG, PNG (max 50MB)
                </p>
              </div>
            </div>
          </div>

          {/* Selected File Preview */}
          {selectedFile && (
            <Alert>
              <File className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{selectedFile.name} ({formatFileSize(selectedFile.size)})</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || !documentName.trim() || isUploading}
            className="w-full"
          >
            {isUploading ? 'Uploading...' : 'Upload Document'}
          </Button>
        </CardContent>
      </Card>

      {/* Uploaded Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <File className="h-5 w-5" />
            Uploaded Documents
          </CardTitle>
          <CardDescription>
            Documents you have uploaded for this session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No documents uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-lg">{getFileIcon(doc.mime_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.document_name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {doc.original_filename} • {formatFileSize(doc.file_size)}
                      </p>
                      <p className="text-xs text-gray-400">
                        Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={doc.status === 'uploaded' ? 'default' : 'secondary'}>
                      {doc.status}
                    </Badge>
                    
                    {doc.fileUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(doc.fileUrl, '_blank')}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.id)}
                      title="Delete"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}; 