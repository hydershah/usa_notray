import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Users,
  FileCheck,
  Eye,
  Calendar,
  User,
  Activity,
  Lock,
  Database
} from 'lucide-react';
import { toast } from 'sonner';

interface AuditTrailProps {
  jobId: number;
  jobStatus: string;
  minimal?: boolean;
}

interface AuditTrailInfo {
  exists: boolean;
  reportPath?: string;
  signedUrl?: string;
  generatedAt?: string;
  storageType?: 'vultr' | 'local';
}

export function AuditTrail({ jobId, jobStatus, minimal = false }: AuditTrailProps) {
  const [auditInfo, setAuditInfo] = useState<AuditTrailInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchAuditInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/jobs/${jobId}/audit-trail`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAuditInfo(data);
      } else {
        console.error('Failed to fetch audit trail info');
        setAuditInfo({ exists: false });
      }
    } catch (error) {
      console.error('Error fetching audit trail info:', error);
      setAuditInfo({ exists: false });
    } finally {
      setLoading(false);
    }
  };

  const generateAuditTrail = async () => {
    try {
      setGenerating(true);
      const response = await fetch(`/api/jobs/${jobId}/generate-audit-trail`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('Audit trail generated successfully');
          await fetchAuditInfo(); // Refresh the audit info
        } else {
          toast.error(data.message || 'Failed to generate audit trail');
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to generate audit trail');
      }
    } catch (error) {
      console.error('Error generating audit trail:', error);
      toast.error('Error generating audit trail');
    } finally {
      setGenerating(false);
    }
  };

  const downloadAuditTrail = async () => {
    try {
      setDownloading(true);
      
      // If we have a signed URL from Vultr, use it directly
      if (auditInfo?.signedUrl && auditInfo?.storageType === 'vultr') {
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = auditInfo.signedUrl;
        a.download = `job_${jobId}_audit_trail.pdf`;
        a.target = '_blank'; // Open in new tab as fallback
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success('Audit trail download started');
        setDownloading(false);
        return;
      }
      
      // Fallback to API endpoint for local files or if signedUrl not available
      const response = await fetch(`/api/jobs/${jobId}/audit-trail/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `job_${jobId}_audit_trail.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Audit trail downloaded successfully');
      } else {
        const errorData = await response.json();
        
        // If the audit trail file is missing and can be regenerated, offer to do so
        if (response.status === 404 && errorData.canRegenerate) {
          toast.error(
            errorData.message || 'Audit trail file not found', 
            {
              action: {
                label: 'Generate Audit Trail',
                onClick: () => generateAuditTrail()
              }
            }
          );
        } else {
          toast.error(errorData.message || 'Failed to download audit trail');
        }
      }
    } catch (error) {
      console.error('Error downloading audit trail:', error);
      toast.error('Error downloading audit trail');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    fetchAuditInfo();
  }, [jobId]);

  if (loading) {
    if (minimal) {
      return (
        <Card className="border border-gray-200 hover:shadow-sm transition-all duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
              <Shield className="h-5 w-5 mr-2 text-gray-700" />
              Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#002A5C] border-t-transparent"></div>
              <span className="ml-2 text-gray-600 text-sm">Loading audit trail information...</span>
            </div>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading audit trail information...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isJobCompleted = jobStatus === 'completed';
  const hasAuditTrail = auditInfo?.exists;

  if (minimal) {
    return (
      <Card className="border border-gray-200 hover:shadow-sm transition-all duration-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
            <Shield className="h-5 w-5 mr-2 text-gray-700" />
            Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {!isJobCompleted ? (
            <div className="text-center py-6 text-gray-500">
              <Clock className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium">Audit Trail Pending</p>
              <p className="text-xs mt-1">Generated after job is completed</p>
            </div>
          ) : hasAuditTrail ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-[#002A5C]/5 rounded-lg border border-[#002A5C]/20">
                <div className="p-2 bg-[#002A5C]/10 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-[#002A5C]" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Available</p>
                  <p className="text-sm text-gray-600">Comprehensive audit trail ready</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={downloadAuditTrail} 
                  disabled={downloading} 
                  size="sm"
                  className="flex-1 bg-[#002A5C] hover:bg-[#002A5C]/90"
                >
                  {downloading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download
                </Button>
                <Button 
                  variant="outline" 
                  onClick={generateAuditTrail} 
                  disabled={generating} 
                  size="sm"
                  className="border-[#002A5C] text-[#002A5C] hover:bg-[#002A5C]/5"
                  title="Regenerate audit trail"
                >
                  {generating ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Not Generated</p>
                  <p className="text-sm text-gray-600">Audit trail needs to be created</p>
                </div>
              </div>
              
              <Button
                onClick={generateAuditTrail}
                disabled={generating}
                variant="outline"
                size="sm"
                className="w-full border-[#002A5C] text-[#002A5C] hover:bg-[#002A5C]/5"
              >
                {generating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Generate Audit Trail
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Audit Trail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isJobCompleted ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Audit trail will be generated when the job is finished</span>
          </div>
        ) : hasAuditTrail ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-blue-600">
              <CheckCircle className="h-4 w-4" />
              <span>Comprehensive audit trail is available</span>
            </div>
            
            {auditInfo?.generatedAt && (
              <div className="text-sm text-muted-foreground">
                Generated: {new Date(auditInfo.generatedAt).toLocaleString()}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={downloadAuditTrail}
                disabled={downloading}
                className="flex-1"
              >
                {downloading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download Audit Trail
              </Button>
              
              <Button
                variant="outline"
                onClick={generateAuditTrail}
                disabled={generating}
              >
                {generating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <span>No audit trail found for this job</span>
            </div>
            
            <div className="text-sm text-muted-foreground">
              The audit trail may not have been generated automatically. 
              You can generate it manually using the button below.
            </div>

            <Button
              onClick={generateAuditTrail}
              disabled={generating}
              variant="outline"
              className="w-full"
            >
              {generating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              Generate Audit Trail
            </Button>
          </div>
        )}

        <Separator />

        <div className="text-xs text-muted-foreground space-y-2">
          <p>
            <strong>RON Platform Audit Trail includes:</strong>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <Database className="h-3 w-3" />
              <span>Session Context & Document IDs</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-3 w-3" />
              <span>Event/Action Tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-3 w-3" />
              <span>Identity Verification Records</span>
            </div>
            <div className="flex items-center gap-2">
              <FileCheck className="h-3 w-3" />
              <span>Notarial Actions & Digital Seals</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-3 w-3" />
              <span>Cryptographic Integrity Hashes</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              <span>WORM Retention Metadata</span>
            </div>
          </div>
          <p className="mt-2">
            Complete compliance documentation for Remote Online Notarization (RON) 
            requirements and legal record keeping.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
