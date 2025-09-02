import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { File, Download, Eye, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '../../lib/queryClient';

interface Document {
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  documentType: string;
  status: string;
}

interface JobRequestDocumentsProps {
  requestId: number;
  canView?: boolean;
  canDelete?: boolean;
}

export function JobRequestDocuments({ requestId, canView = true, canDelete = true }: JobRequestDocumentsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (canView) {
      fetchDocuments();
    }
  }, [requestId, canView]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('GET', `/api/job-requests/${requestId}/documents`);
      const result = await response.json();

      if (result.success) {
        setDocuments(result.data);
      } else {
        setError(result.error || 'Failed to fetch documents');
      }
    } catch (err) {
      setError('Failed to fetch documents');
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      // Generate download URL for job request documents
      const response = await apiRequest('GET', `/api/documents/${encodeURIComponent(document.filePath)}`);
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Downloaded ${document.originalName}`);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download document');
    }
  };

  const handleView = async (document: Document) => {
    try {
      // Open document in new tab for viewing
      const viewUrl = `/api/documents/${encodeURIComponent(document.filePath)}`;
      window.open(viewUrl, '_blank');
      toast.success(`Opening ${document.originalName}`);
    } catch (error) {
      console.error('View failed:', error);
      toast.error('Failed to open document');
    }
  };

  const handleDelete = async (document: Document) => {
    if (!confirm(`Are you sure you want to delete "${document.originalName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await apiRequest('DELETE', `/api/job-requests/${requestId}/documents/${encodeURIComponent(document.fileName)}`);
      const result = await response.json();

      if (result.success) {
        toast.success('Document deleted successfully');
        // Refresh the documents list
        fetchDocuments();
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete document');
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
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('image')) return '🖼️';
    return '📎';
  };

  if (!canView) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <File className="h-5 w-5" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading documents...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <File className="h-5 w-5" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            <p>Error loading documents: {error}</p>
            <Button 
              variant="outline" 
              onClick={fetchDocuments}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <File className="h-5 w-5" />
          Documents ({documents.length})
        </CardTitle>
        <CardDescription>
          Documents uploaded with this job request
        </CardDescription>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <File className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No documents uploaded</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((document, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getFileIcon(document.mimeType)}</span>
                  <div>
                    <p className="font-medium text-gray-900">
                      {document.originalName}
                    </p>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span>{formatFileSize(document.fileSize)}</span>
                      <span>•</span>
                      <Badge variant="secondary" className="text-xs">
                        {document.documentType}
                      </Badge>
                      <span>•</span>
                      <Badge 
                        variant={document.status === 'uploaded' ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {document.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleView(document)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(document)}
                    className="text-blue-600 hover:text-green-700"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(document)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 