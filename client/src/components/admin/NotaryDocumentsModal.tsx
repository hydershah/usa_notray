import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Shield, 
  Lock, 
  Award, 
  Eye, 
  ExternalLink, 
  Check, 
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface NotaryProfile {
  id: number;
  fullName: string;
  email: string;
  documents?: {
    hasCommissionFile?: boolean;
    hasNotaryCommissionFile?: boolean;
    hasEOInsuranceFile?: boolean;
    hasPublicCertificateFile?: boolean;
    hasBondFile?: boolean;
    hasSigningAgentFile?: boolean;
  };
  hasNotaryCommissionFile?: boolean;
  hasEOInsuranceFile?: boolean;
  hasPublicCertificateFile?: boolean;
  hasBondFile?: boolean;
  hasSigningAgentFile?: boolean;
  lastProfileUpdate?: string;
}

interface NotaryDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notaryId: number;
  notaryName: string;
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

export function NotaryDocumentsModal({ 
  isOpen, 
  onClose, 
  notaryId, 
  notaryName 
}: NotaryDocumentsModalProps) {
  const [profile, setProfile] = useState<NotaryProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && notaryId) {
      fetchNotaryProfile();
    }
  }, [isOpen, notaryId]);

  const fetchNotaryProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      // Fetch the document status/info using the available API
      const response = await fetch(`/api/notary/profile/documents/${notaryId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notary profile');
      }

      const data = await response.json();
      // Normalize into the shape used by the component
      const normalized: NotaryProfile = {
        id: notaryId,
        fullName: notaryName,
        email: '',
        documents: {
          hasCommissionFile: !!data.hasNotaryCommissionFile,
          hasNotaryCommissionFile: !!data.hasNotaryCommissionFile,
          hasEOInsuranceFile: !!data.hasEOInsuranceFile,
          hasPublicCertificateFile: !!data.hasPublicCertificateFile,
          hasBondFile: !!data.hasBondFile,
          hasSigningAgentFile: !!data.hasSigningAgentFile
        },
        hasNotaryCommissionFile: !!data.hasNotaryCommissionFile,
        hasEOInsuranceFile: !!data.hasEOInsuranceFile,
        hasPublicCertificateFile: !!data.hasPublicCertificateFile,
        hasBondFile: !!data.hasBondFile,
        hasSigningAgentFile: !!data.hasSigningAgentFile,
        lastProfileUpdate: ''
      };
      setProfile(normalized);
    } catch (error) {
      console.error('Error fetching notary profile:', error);
      setError(error instanceof Error ? error.message : 'Failed to load profile');
      toast.error('Failed to load notary documents');
    } finally {
      setLoading(false);
    }
  };

  const getFileBadge = (hasFile: boolean, fileName: string, documentType: string) => {
    const handleViewDocument = async () => {
      try {
        const token = localStorage.getItem('token');
        const previewUrl = `/api/notary/profile/documents/${notaryId}/preview/${documentType}?token=${token}`;
        window.open(previewUrl, '_blank');
        toast.success(`Opening ${fileName}`);
      } catch (error) {
        console.error('Error opening document:', error);
        toast.error('Failed to open document');
      }
    };

    const handleDownloadDocument = async () => {
      try {
        const token = localStorage.getItem('token');
        const downloadUrl = `/api/notary/profile/documents/${notaryId}/download/${documentType}?token=${token}`;
        window.open(downloadUrl, '_blank');
        toast.success(`Downloading ${fileName}`);
      } catch (error) {
        console.error('Error downloading document:', error);
        toast.error('Failed to download document');
      }
    };

    const docType = DOCUMENT_TYPES.find(type => type.key === documentType);
    const IconComponent = docType?.icon || FileText;

    return (
      <Card className={`${hasFile ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${docType?.bgColor || 'bg-gray-50'}`}>
                <IconComponent className={`w-5 h-5 ${docType?.color || 'text-gray-500'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{fileName}</span>
                  {docType?.required && (
                    <Badge variant="outline" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {hasFile ? (
                    <div className="flex items-center gap-1">
                      <Check className="w-3 h-3 text-blue-600" />
                      <span className="text-xs text-blue-600">Uploaded</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <X className="w-3 h-3 text-red-600" />
                      <span className="text-xs text-red-600">Missing</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {hasFile && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleViewDocument}
                  className="h-8 px-3"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  View
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownloadDocument}
                  className="h-8 px-3"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Download
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const getDocumentStatus = (documentKey: string): boolean => {
    if (!profile) return false;
    // Map file field keys to their corresponding boolean flags
    const keyMap: Record<string, keyof NotaryProfile | keyof NonNullable<NotaryProfile['documents']>> = {
      notaryCommissionFile: 'hasNotaryCommissionFile',
      eoInsuranceFile: 'hasEOInsuranceFile',
      publicCertificateFile: 'hasPublicCertificateFile',
      bondFile: 'hasBondFile',
      signingAgentFile: 'hasSigningAgentFile'
    };
    const hasKey = keyMap[documentKey];
    const documentsObj = profile.documents || {};
    // Check both root and nested documents object
    const nestedVal = (documentsObj as any)[hasKey];
    const rootVal = (profile as any)[hasKey];
    return Boolean(nestedVal ?? rootVal);
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="ml-2">Loading documents...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8 text-red-600">
            <AlertCircle className="w-8 h-8 mr-2" />
            <span>{error}</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Notary Documents - {notaryName}
          </DialogTitle>
          <DialogDescription>
            View and download notary certification documents and requirements
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-6">
          {DOCUMENT_TYPES.map((docType) => (
            <div key={docType.key}>
              {getFileBadge(
                getDocumentStatus(docType.key), 
                docType.label, 
                docType.key
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 