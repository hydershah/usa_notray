import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building, 
  Shield, 
  FileText, 
  Calendar, 
  Hash, 
  Award, 
  Globe, 
  Lock, 
  Check, 
  X,
  ExternalLink,
  Eye
} from 'lucide-react';

interface NotaryDetailViewProps {
  notaryId: number;
  onClose?: () => void;
}

interface NotaryProfile {
  id: number;
  username: string;
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: string;
  notaryType: string;
  isActive: boolean;
  approvalStatus: string;
  
  // Personal address
  address1: string;
  address2: string;
  city: string;
  state: string;
  zipCode: string;
  
  // Commission information
  nameOnCommission: string;
  commissionAddress1: string;
  commissionAddress2: string;
  commissionCity: string;
  commissionState: string;
  commissionZipCode: string;
  commissionCounty: string;
  commissionNumber: string;
  commissionExpiration: string;
  
  // Insurance and bond
  eoInsuranceCompany: string;
  eoInsuranceAmount: number;
  eoInsuranceExpiration: string;
  bondCompanyName: string;
  bondAmount: number;
  bondExpiration: string;
  
  // Certificate
  publicCertificateExpiration: string;
  
  // Signing agent
  signingAgentCertified: boolean;
  signingAgentExpirationDate: string;
  
  // Languages
  foreignLanguages: string[];
  
  // File status
  hasNotaryCommissionFile: boolean;
  hasEOInsuranceFile: boolean;
  hasPublicCertificateFile: boolean;
  hasBondFile: boolean;
  hasSigningAgentFile: boolean;
  
  // Document status (from API response)
  documents?: {
    hasCommissionFile: boolean;
    hasEOInsuranceFile: boolean;
    hasBondFile: boolean;
    hasPublicCertificateFile: boolean;
    hasSigningAgentFile: boolean;
    hasDigitalCertificateFile: boolean;
  };
  
  // Timestamps
  lastProfileUpdate: string;
}

export function NotaryDetailView({ notaryId, onClose }: NotaryDetailViewProps) {
  const [profile, setProfile] = useState<NotaryProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNotaryProfile();
  }, [notaryId]);

  const fetchNotaryProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/users/${notaryId}/profile/comprehensive`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notary profile');
      }

      const data = await response.json();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notary profile');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not specified';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'approved': { color: 'bg-green-100 text-green-800', icon: <Check className="w-3 h-3" /> },
      'pending': { color: 'bg-yellow-100 text-yellow-800', icon: <Calendar className="w-3 h-3" /> },
      'rejected': { color: 'bg-red-100 text-red-800', icon: <X className="w-3 h-3" /> },
      'requires_update': { color: 'bg-orange-100 text-orange-800', icon: <FileText className="w-3 h-3" /> }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        {config.icon}
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getFileBadge = (hasFile: boolean, fileName: string, documentType: string) => {
    const handleViewDocument = async () => {
      try {
        const token = localStorage.getItem('token');
        const previewUrl = `/api/notary/profile/documents/${notaryId}/preview/${documentType}?token=${token}`;
        window.open(previewUrl, '_blank');
      } catch (error) {
        console.error('Error opening document:', error);
      }
    };

    const handleDownloadDocument = async () => {
      try {
        const token = localStorage.getItem('token');
        const downloadUrl = `/api/notary/profile/documents/${notaryId}/download/${documentType}?token=${token}`;
        window.open(downloadUrl, '_blank');
      } catch (error) {
        console.error('Error downloading document:', error);
      }
    };

    return (
      <div className={`flex items-center justify-between p-3 rounded-lg border ${hasFile ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
        <div className="flex items-center gap-3">
          {hasFile ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          <div>
            <span className="text-sm font-medium">{fileName}</span>
            <p className="text-xs text-gray-500">{hasFile ? 'Uploaded' : 'Missing'}</p>
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
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading notary profile...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-600 mb-4">Error: {error}</div>
        <Button onClick={fetchNotaryProfile} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-center text-gray-500">
        No notary profile found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notary Profile Details</h2>
          <p className="text-gray-600">{profile.fullName || profile.username}</p>
        </div>
        <div className="flex items-center gap-4">
          {getStatusBadge(profile.approvalStatus)}
          <Badge className={profile.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
            {profile.isActive ? 'Active' : 'Inactive'}
          </Badge>
          {onClose && (
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Full Name</label>
                <p className="text-gray-900">{profile.fullName || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Username</label>
                <p className="text-gray-900">{profile.username}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Email</label>
                <p className="text-gray-900">{profile.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Phone</label>
                <p className="text-gray-900">{profile.phoneNumber || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Notary Type</label>
                <Badge className={profile.notaryType === 'subscriber' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}>
                  {profile.notaryType === 'subscriber' ? 'Subscriber' : 'Contractor'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Commission Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Commission Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Name on Commission</label>
                <p className="text-gray-900">{profile.nameOnCommission || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Commission Number</label>
                <p className="text-gray-900 font-mono">{profile.commissionNumber || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Commission Expiration</label>
                <p className="text-gray-900">{formatDate(profile.commissionExpiration)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Commission State</label>
                <p className="text-gray-900">{profile.commissionState || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Commission County</label>
                <p className="text-gray-900">{profile.commissionCounty || 'Not specified'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Personal Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-gray-900">{profile.address1 || 'Not specified'}</p>
              {profile.address2 && <p className="text-gray-900">{profile.address2}</p>}
              <p className="text-gray-900">
                {[profile.city, profile.state, profile.zipCode].filter(Boolean).join(', ') || 'Not specified'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Commission Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Commission Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-gray-900">{profile.commissionAddress1 || 'Not specified'}</p>
              {profile.commissionAddress2 && <p className="text-gray-900">{profile.commissionAddress2}</p>}
              <p className="text-gray-900">
                {[profile.commissionCity, profile.commissionState, profile.commissionZipCode].filter(Boolean).join(', ') || 'Not specified'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* E&O Insurance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              E&O Insurance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600">Insurance Company</label>
              <p className="text-gray-900">{profile.eoInsuranceCompany || 'Not specified'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Coverage Amount</label>
              <p className="text-gray-900">{profile.eoInsuranceAmount ? formatCurrency(profile.eoInsuranceAmount) : 'Not specified'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Expiration Date</label>
              <p className="text-gray-900">{formatDate(profile.eoInsuranceExpiration)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Bond Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Notary Bond
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600">Bond Company</label>
              <p className="text-gray-900">{profile.bondCompanyName || 'Not specified'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Bond Amount</label>
              <p className="text-gray-900">{profile.bondAmount ? formatCurrency(profile.bondAmount) : 'Not specified'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Bond Expiration</label>
              <p className="text-gray-900">{formatDate(profile.bondExpiration)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Signing Agent & Languages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Qualifications & Languages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600">Signing Agent Certified</label>
              <div className="flex items-center gap-2">
                <Badge className={profile.signingAgentCertified ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {profile.signingAgentCertified ? 'Yes' : 'No'}
                </Badge>
                {profile.signingAgentCertified && profile.signingAgentExpirationDate && (
                  <span className="text-sm text-gray-600">
                    Expires: {formatDate(profile.signingAgentExpirationDate)}
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Foreign Languages</label>
              <div className="flex flex-wrap gap-2">
                {profile.foreignLanguages && profile.foreignLanguages.length > 0 ? (
                  profile.foreignLanguages.map((language, index) => (
                    <Badge key={index} variant="secondary">
                      {language}
                    </Badge>
                  ))
                ) : (
                  <span className="text-gray-500">None specified</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Document Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {getFileBadge(profile.documents?.hasCommissionFile || profile.hasNotaryCommissionFile, 'Commission Certificate', 'notaryCommissionFile')}
            {getFileBadge(profile.documents?.hasEOInsuranceFile || profile.hasEOInsuranceFile, 'E&O Insurance Certificate', 'eoInsuranceFile')}
            {getFileBadge(profile.documents?.hasPublicCertificateFile || profile.hasPublicCertificateFile, 'Digital Certificate', 'publicCertificateFile')}
            {getFileBadge(profile.documents?.hasBondFile || profile.hasBondFile, 'Bond Certificate', 'bondFile')}
            {getFileBadge(profile.documents?.hasSigningAgentFile || profile.hasSigningAgentFile, 'Signing Agent Certificate', 'signingAgentFile')}
          </CardContent>
        </Card>
      </div>

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Additional Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Digital Certificate Expiration</label>
              <p className="text-gray-900">{formatDate(profile.publicCertificateExpiration)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Last Profile Update</label>
              <p className="text-gray-900">{formatDate(profile.lastProfileUpdate)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 