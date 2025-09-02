import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { AlertCircle, CheckCircle, Clock, User, Shield, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export interface CertificateStatus {
  userId: number;
  userEmail: string;
  userName: string;
  userRole: string;
  hasCertificate: boolean;
  certificateValid: boolean;
  certificateExpired: boolean;
  certificateId?: string;
  certificateExpiry?: Date;
  certificateIssued?: Date;
  requiresCertificate: boolean;
  canProceed: boolean;
  issues: string[];
}

export interface JobCertificateVerification {
  jobId: number;
  canStartJob: boolean;
  allParticipantsReady: boolean;
  participantStatuses: CertificateStatus[];
  blockedBy: string[];
  summary: {
    totalParticipants: number;
    withValidCertificates: number;
    withoutCertificates: number;
    withExpiredCertificates: number;
  };
}

interface CertificateStatusCardProps {
  verification: JobCertificateVerification;
  onGenerateCertificate?: (userId: number) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  compact?: boolean;
}

const CertificateStatusCard: React.FC<CertificateStatusCardProps> = ({
  verification,
  onGenerateCertificate,
  onRefresh,
  isLoading = false,
  compact = false
}) => {
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);

  const getStatusIcon = (status: CertificateStatus) => {
    if (!status.requiresCertificate) {
      return <User className="h-4 w-4 text-gray-500" />;
    }
    
    if (status.canProceed && status.certificateValid) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    if (status.certificateExpired) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    
    if (!status.hasCertificate) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    
    return <Clock className="h-4 w-4 text-gray-500" />;
  };

  const getStatusBadge = (status: CertificateStatus) => {
    if (!status.requiresCertificate) {
      return (
        <Badge variant="secondary" className="text-xs">
          No Certificate Required
        </Badge>
      );
    }
    
    if (status.canProceed && status.certificateValid) {
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-xs">
          Valid Certificate
        </Badge>
      );
    }
    
    if (status.certificateExpired) {
      return (
        <Badge variant="destructive" className="text-xs">
          Certificate Expired
        </Badge>
      );
    }
    
    if (!status.hasCertificate) {
      return (
        <Badge variant="destructive" className="text-xs">
          No Certificate
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary" className="text-xs">
        Invalid Certificate
      </Badge>
    );
  };

  const handleGenerateCertificate = async (userId: number) => {
    if (!onGenerateCertificate) return;
    
    setGeneratingFor(userId);
    try {
      await onGenerateCertificate(userId);
    } finally {
      setGeneratingFor(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (compact) {
    const { totalParticipants, withValidCertificates, withoutCertificates, withExpiredCertificates } = verification.summary;
    const issues = withoutCertificates + withExpiredCertificates;

    return (
      <div className="w-full flex items-center justify-between gap-3 p-3 rounded-md border border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="h-4 w-4 text-gray-700" />
          <div className="flex items-center gap-2 text-sm">
            {verification.canStartJob ? (
              <span className="text-green-700 font-medium">Ready to Start</span>
            ) : (
              <span className="text-red-700 font-medium">Blocked</span>
            )}
            <span className="text-gray-500">·</span>
            <span className="text-gray-600 truncate">
              {totalParticipants} total · {withValidCertificates} valid · {withoutCertificates} missing · {withExpiredCertificates} expired
            </span>
          </div>
        </div>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? 'Checking…' : 'Refresh'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Digital Certificate Status
            </CardTitle>
            <CardDescription>
              All participants must have valid digital certificates before the job can start
            </CardDescription>
          </div>
          
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
            >
              {isLoading ? 'Checking...' : 'Refresh'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall Status Alert */}
        {!verification.canStartJob && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Job Cannot Start</AlertTitle>
            <AlertDescription>
              The following participants need valid digital certificates:
              <ul className="mt-2 list-disc list-inside space-y-1">
                {verification.blockedBy.map((issue, index) => (
                  <li key={index} className="text-sm">{issue}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {verification.canStartJob && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Ready to Start</AlertTitle>
            <AlertDescription>
              All participants have valid digital certificates. The job can proceed.
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {verification.summary.totalParticipants}
            </div>
            <div className="text-sm text-gray-600">Total Participants</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {verification.summary.withValidCertificates}
            </div>
            <div className="text-sm text-green-700">Valid Certificates</div>
          </div>
          
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {verification.summary.withoutCertificates}
            </div>
            <div className="text-sm text-red-700">Missing Certificates</div>
          </div>
          
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">
              {verification.summary.withExpiredCertificates}
            </div>
            <div className="text-sm text-yellow-700">Expired Certificates</div>
          </div>
        </div>

        {/* Participant Details */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Participant Certificate Status</h4>
          
          {verification.participantStatuses.map((status) => (
            <div key={status.userId} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(status)}
                  <div>
                    <div className="font-medium text-gray-900">
                      {status.userName}
                    </div>
                    <div className="text-sm text-gray-600">
                      {status.userEmail} • {status.userRole}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {getStatusBadge(status)}
                </div>
              </div>

              {/* Certificate Details */}
              {status.hasCertificate && (
                <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Certificate ID:</span>
                    <span className="font-mono">{status.certificateId}</span>
                  </div>
                  {status.certificateIssued && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Issued:</span>
                      <span>{formatDate(status.certificateIssued)}</span>
                    </div>
                  )}
                  {status.certificateExpiry && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expires:</span>
                      <span className={status.certificateExpired ? 'text-red-600 font-medium' : ''}>
                        {formatDate(status.certificateExpiry)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Issues */}
              {status.issues.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-red-600">Issues:</div>
                  <ul className="space-y-1">
                    {status.issues.map((issue, index) => (
                      <li key={index} className="text-sm text-red-600 flex items-center gap-2">
                        <AlertCircle className="h-3 w-3" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              {!status.hasCertificate && status.requiresCertificate && onGenerateCertificate && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateCertificate(status.userId)}
                    disabled={generatingFor === status.userId}
                  >
                    {generatingFor === status.userId ? 'Generating...' : 'Generate Certificate'}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CertificateStatusCard; 