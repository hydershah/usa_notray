import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Download, 
  Shield, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock,
  FileText,
  Key,
  Award
} from 'lucide-react';

interface CertificateStatus {
  success: boolean;
  hasCertificate: boolean;
  valid: boolean;
  expired?: boolean;
  nearExpiry?: boolean;
  daysRemaining?: number;
  error?: string;
}

interface CertificateGeneration {
  loading: boolean;
  success: boolean;
  error?: string;
  password?: string;
  downloadUrl?: string;
}

const CertificateManager: React.FC = () => {
  const [certificateStatus, setCertificateStatus] = useState<CertificateStatus | null>(null);
  const [generation, setGeneration] = useState<CertificateGeneration>({
    loading: false,
    success: false
  });
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    fetchCertificateStatus();
  }, []);

  const fetchCertificateStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/certificates/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCertificateStatus(data);
      } else {
        console.error('Failed to fetch certificate status');
      }
    } catch (error) {
      console.error('Error fetching certificate status:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCertificate = async () => {
    try {
      setGeneration({ loading: true, success: false });
      
      const response = await fetch('/api/certificates/generate-self', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setGeneration({
          loading: false,
          success: true,
          password: data.password,
          downloadUrl: data.downloadUrl
        });
        
        // Refresh certificate status
        await fetchCertificateStatus();
      } else {
        setGeneration({
          loading: false,
          success: false,
          error: data.error || 'Failed to generate certificate'
        });
      }
    } catch (error) {
      setGeneration({
        loading: false,
        success: false,
        error: error.message || 'Failed to generate certificate'
      });
    }
  };

  const validateCertificate = async () => {
    try {
      setValidating(true);
      await fetchCertificateStatus();
    } catch (error) {
      console.error('Error validating certificate:', error);
    } finally {
      setValidating(false);
    }
  };

  const downloadCertificate = async (fileType: 'p12' | 'pem' = 'p12') => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await fetch(`/api/certificates/download/${user.id}?type=${fileType}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notary-certificate.${fileType}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        // Show password if available
        const password = response.headers.get('X-Certificate-Password');
        if (password && fileType === 'p12') {
          alert(`Certificate downloaded successfully!\n\nP12 Password: ${password}\n\nPlease save this password safely as you'll need it to install the certificate.`);
        }
      } else {
        const errorData = await response.json();
        alert(`Download failed: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error downloading certificate:', error);
      alert('Failed to download certificate');
    }
  };

  const downloadCACertificate = async () => {
    try {
      const response = await fetch('/api/certificates/ca-cert', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'usa-notary-ca.pem';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to download CA certificate');
      }
    } catch (error) {
      console.error('Error downloading CA certificate:', error);
      alert('Failed to download CA certificate');
    }
  };

  const getStatusIcon = () => {
    if (!certificateStatus?.hasCertificate) {
      return <XCircle className="h-5 w-5 text-gray-400" />;
    }
    
    if (certificateStatus.expired) {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    
    if (certificateStatus.nearExpiry) {
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
    
    if (certificateStatus.valid) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getStatusText = () => {
    if (!certificateStatus?.hasCertificate) {
      return 'No Certificate';
    }
    
    if (certificateStatus.expired) {
      return 'Expired';
    }
    
    if (certificateStatus.nearExpiry) {
      return `Expires in ${certificateStatus.daysRemaining} days`;
    }
    
    if (certificateStatus.valid) {
      return 'Valid';
    }
    
    return 'Invalid';
  };

  const getStatusColor = () => {
    if (!certificateStatus?.hasCertificate) {
      return 'secondary';
    }
    
    if (certificateStatus.expired) {
      return 'destructive';
    }
    
    if (certificateStatus.nearExpiry) {
      return 'outline';
    }
    
    if (certificateStatus.valid) {
      return 'default';
    }
    
    return 'destructive';
  };

  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Digital Certificate Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2">Loading certificate status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Certificate Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Digital Certificate Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Overview */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {getStatusIcon()}
                <div>
                  <p className="font-medium">Certificate Status</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    getStatusColor() === 'destructive' ? 'bg-red-100 text-red-800' :
                    getStatusColor() === 'outline' ? 'bg-yellow-100 text-yellow-800' :
                    getStatusColor() === 'default' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {getStatusText()}
                  </span>
                </div>
              </div>

              {certificateStatus?.valid && certificateStatus.daysRemaining && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Days Remaining</span>
                    <span className="font-medium">{certificateStatus.daysRemaining}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((certificateStatus.daysRemaining / 1095) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {certificateStatus?.error && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {certificateStatus.error}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={validateCertificate}
                variant="outline"
                disabled={validating}
                className="w-full"
              >
                {validating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Validate Certificate
              </Button>

              {certificateStatus?.hasCertificate && (
                <div className="space-y-2">
                  <Button
                    onClick={() => downloadCertificate('p12')}
                    variant="default"
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Certificate (.p12)
                  </Button>
                  
                  <Button
                    onClick={() => downloadCertificate('pem')}
                    variant="outline"
                    className="w-full"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Download Certificate (.pem)
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generate Certificate Card */}
      {!certificateStatus?.hasCertificate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Generate Digital Certificate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">About Digital Certificates</h4>
                <p className="text-blue-800 text-sm">
                  Digital certificates enable secure document signing and authentication. 
                  Your certificate will be valid for 3 years and allows you to:
                </p>
                <ul className="list-disc list-inside text-blue-800 text-sm mt-2 space-y-1">
                  <li>Digitally sign documents with legal validity</li>
                  <li>Authenticate your identity during notarization</li>
                  <li>Ensure document integrity and non-repudiation</li>
                </ul>
              </div>

              {generation.loading && (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-6 w-6 animate-spin text-blue-500 mr-2" />
                  <span>Generating certificate...</span>
                </div>
              )}

              {generation.error && (
                <Alert>
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    {generation.error}
                  </AlertDescription>
                </Alert>
              )}

              {generation.success && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Certificate generated successfully! 
                    {generation.password && (
                      <div className="mt-2 p-2 bg-green-50 rounded border">
                        <strong>P12 Password:</strong> <code>{generation.password}</code>
                        <br />
                        <small>Please save this password safely.</small>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={generateCertificate}
                disabled={generation.loading}
                className="w-full"
              >
                {generation.loading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Key className="h-4 w-4 mr-2" />
                )}
                Generate Certificate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Certificate Installation Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Installation Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Installing Your Certificate</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                <li>Download the certificate file (.p12 format)</li>
                <li>Double-click the downloaded file to open Certificate Manager</li>
                <li>Enter the provided password when prompted</li>
                <li>Select "Personal" certificate store</li>
                <li>Complete the installation wizard</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium mb-2">Installing CA Certificate (Recommended)</h4>
              <p className="text-sm text-gray-600 mb-2">
                Install the Certificate Authority certificate to avoid browser warnings:
              </p>
              <Button
                onClick={downloadCACertificate}
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Download CA Certificate
              </Button>
            </div>

            <div className="bg-yellow-50 p-3 rounded-lg">
              <p className="text-yellow-800 text-sm">
                <strong>Note:</strong> Keep your certificate password safe and never share it. 
                The certificate is required for digital signing and document authentication.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CertificateManager; 