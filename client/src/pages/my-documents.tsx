import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Download,
  FileText,
  Calendar,
  Building2,
  Eye,
  Search,
  Filter,
  Folder,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Archive,
  File,
  Shield,
  User
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface Document {
  id: number;
  originalName: string;
  jobId: number;
  titleCompany: string;
  closingType: string;
  documentType: string;
  signingStatus: string;
  createdAt: string;
  completedAt?: string;
  fileSize: number;
  downloadUrl?: string;
  isSigned: boolean;
  signerRole?: string;
}

export default function MyDocuments() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [downloading, setDownloading] = useState<number | null>(null);

  // Mock data - replace with actual API call
  const mockDocuments: Document[] = [
    {
      id: 1,
      originalName: "Purchase_Agreement_123_Main_St.pdf",
      jobId: 101,
      titleCompany: "First American Title",
      closingType: "Purchase Agreement",
      documentType: "original",
      signingStatus: "completed",
      createdAt: "2024-01-15T10:30:00Z",
      completedAt: "2024-01-15T11:45:00Z",
      fileSize: 2500000,
      downloadUrl: "/api/documents/signed/Purchase_Agreement_123_Main_St_signed.pdf",
      isSigned: true,
      signerRole: "buyer"
    },
    {
      id: 2,
      originalName: "Deed_of_Trust_456_Oak_Ave.pdf",
      jobId: 102,
      titleCompany: "Chicago Title Company",
      closingType: "Deed of Trust",
      documentType: "original",
      signingStatus: "completed",
      createdAt: "2024-01-10T14:20:00Z",
      completedAt: "2024-01-10T15:30:00Z",
      fileSize: 1800000,
      downloadUrl: "/api/documents/signed/Deed_of_Trust_456_Oak_Ave_signed.pdf",
      isSigned: true,
      signerRole: "borrower"
    },
    {
      id: 3,
      originalName: "Refinance_Documents_789_Pine_St.pdf",
      jobId: 103,
      titleCompany: "Old Republic Title",
      closingType: "Refinance",
      documentType: "original",
      signingStatus: "pending",
      createdAt: "2024-01-20T09:15:00Z",
      fileSize: 3200000,
      isSigned: false,
      signerRole: "borrower"
    }
  ];

  // In real implementation, use this API call
  const { 
    data: documents = mockDocuments, 
    isLoading, 
    error, 
    refetch 
  } = useQuery<Document[]>({
    queryKey: ['/api/user/documents'],
    enabled: false, // Disable for now since we're using mock data
  });

  // Filter and search documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchTerm || 
      doc.originalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.titleCompany.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.closingType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || doc.documentType === filterType;
    const matchesStatus = filterStatus === 'all' || doc.signingStatus === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  // Sort documents
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'name':
        return a.originalName.localeCompare(b.originalName);
      case 'company':
        return a.titleCompany.localeCompare(b.titleCompany);
      case 'size':
        return b.fileSize - a.fileSize;
      default:
        return 0;
    }
  });

  const handleDownload = async (doc: Document) => {
    try {
      // In a real app, you would download from doc.downloadUrl
      // For now, we'll simulate a download
      const a = window.document.createElement('a');
      a.href = doc.downloadUrl || '#';
      a.download = doc.originalName;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      
      toast({
        title: "Download Started",
        description: `${doc.originalName} is being downloaded.`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download Failed",
        description: "Please try again later.",
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

  const getStatusBadge = (status: string, isSigned: boolean) => {
    if (isSigned) {
      return <Badge className="bg-green-100 text-green-800">Signed</Badge>;
    }
    
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const stats = {
    total: documents.length,
    signed: documents.filter(doc => doc.isSigned).length,
    pending: documents.filter(doc => doc.signingStatus === 'pending').length,
    completed: documents.filter(doc => doc.signingStatus === 'completed').length,
    totalSize: documents.reduce((sum, doc) => sum + doc.fileSize, 0)
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Documents</h1>
            <p className="text-gray-600 mt-1">
              Your signed documents and downloads
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  <p className="text-sm text-gray-600">Total Documents</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.signed}</p>
                  <p className="text-sm text-gray-600">Signed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                  <p className="text-sm text-gray-600">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                                 <div className="p-2 bg-blue-100 rounded-lg">
                   <Archive className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
                  <p className="text-sm text-gray-600">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Folder className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{formatFileSize(stats.totalSize)}</p>
                  <p className="text-sm text-gray-600">Total Size</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder="Document Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="original">Original</SelectItem>
              <SelectItem value="signed">Signed</SelectItem>
              <SelectItem value="notarized">Notarized</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="company">Company</SelectItem>
              <SelectItem value="size">File Size</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Documents List */}
        {sortedDocuments.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchTerm || filterType !== 'all' || filterStatus !== 'all' 
                  ? 'No matching documents found' 
                  : 'No documents yet'
                }
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || filterType !== 'all' || filterStatus !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'When you complete document signings, they\'ll appear here for download.'
                }
              </p>
              {(searchTerm || filterType !== 'all' || filterStatus !== 'all') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterType('all');
                    setFilterStatus('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sortedDocuments.map((document) => (
              <Card key={document.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <File className="h-5 w-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">
                          {document.originalName}
                        </h3>
                        {getStatusBadge(document.signingStatus, document.isSigned)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-600">Title Company</p>
                            <p className="font-medium">{document.titleCompany}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-600">Document Type</p>
                            <p className="font-medium">{document.closingType}</p>
                          </div>
                        </div>
                        
                        {document.signerRole && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <div>
                              <p className="text-sm text-gray-600">Your Role</p>
                              <p className="font-medium capitalize">{document.signerRole}</p>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-600">
                              {document.completedAt ? 'Completed' : 'Created'}
                            </p>
                            <p className="font-medium">
                              {new Date(document.completedAt || document.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-500">
                        File size: {formatFileSize(document.fileSize)}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      {document.isSigned && document.downloadUrl && (
                        <Button 
                          size="sm"
                          onClick={() => handleDownload(document)}
                          disabled={downloading === document.id}
                        >
                          {downloading === document.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Download
                        </Button>
                      )}
                      
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(`/jobs/${document.jobId}`, '_blank')}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Job
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
} 