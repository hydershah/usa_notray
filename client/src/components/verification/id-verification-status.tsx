import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, CheckCircle, Clock, XCircle, AlertCircle, User, Eye 
} from 'lucide-react';

interface IDVerificationStatusProps {
  userRole: 'signer' | 'witness';
  isVerified: boolean;
  verificationStatus: string;
  accountSetupComplete: boolean;
  onStartVerification: () => void;
  className?: string;
}

export function IDVerificationStatus({
  userRole,
  isVerified,
  verificationStatus,
  accountSetupComplete,
  onStartVerification,
  className = ""
}: IDVerificationStatusProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return CheckCircle;
      case 'pending': return Clock;
      case 'failed': return XCircle;
      case 'rejected': return XCircle;
      default: return AlertCircle;
    }
  };

  const getRoleIcon = () => {
    return userRole === 'witness' ? Eye : User;
  };

  const getRoleDescription = () => {
    return userRole === 'witness' 
      ? 'As a witness, you must verify your identity before participating in any notarization sessions.'
      : 'As a signer, you must verify your identity before joining any document signing sessions.';
  };

  const StatusIcon = getStatusIcon(verificationStatus);
  const RoleIcon = getRoleIcon();

  return (
    <Card className={`border-2 ${className} ${
      isVerified 
        ? 'border-green-200 bg-green-50' 
        : 'border-orange-200 bg-orange-50'
    }`}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <RoleIcon className="h-5 w-5 mr-2" />
          ID Verification Status
          <Badge className={`ml-auto ${getStatusColor(verificationStatus)}`}>
            {React.createElement(StatusIcon, { className: "h-3 w-3 mr-1" })}
            {isVerified ? 'Verified' : 'Required'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          {getRoleDescription()}
        </p>

        {/* Verification Requirements */}
        <div className="space-y-3">
          <div className="flex items-center">
            <div className={`w-4 h-4 rounded-full mr-3 flex items-center justify-center ${
              accountSetupComplete ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              {accountSetupComplete && <CheckCircle className="w-3 h-3 text-white" />}
            </div>
            <span className={`text-sm ${accountSetupComplete ? 'text-green-700' : 'text-gray-600'}`}>
              Account Setup Complete
            </span>
          </div>

          <div className="flex items-center">
            <div className={`w-4 h-4 rounded-full mr-3 flex items-center justify-center ${
              isVerified ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              {isVerified && <CheckCircle className="w-3 h-3 text-white" />}
            </div>
            <span className={`text-sm ${isVerified ? 'text-green-700' : 'text-gray-600'}`}>
              Identity Verification
            </span>
          </div>
        </div>

        {/* Status Message */}
        <div className={`p-3 rounded-lg ${
          isVerified 
            ? 'bg-green-100 border border-green-200' 
            : 'bg-yellow-100 border border-yellow-200'
        }`}>
          <div className="flex items-center">
            <Shield className={`h-4 w-4 mr-2 ${
              isVerified ? 'text-green-600' : 'text-yellow-600'
            }`} />
            <span className={`text-sm font-medium ${
              isVerified ? 'text-green-800' : 'text-yellow-800'
            }`}>
              {isVerified 
                ? `Your identity has been verified. You can join ${userRole === 'witness' ? 'witnessing' : 'signing'} sessions.`
                : `ID verification required before you can join ${userRole === 'witness' ? 'witnessing' : 'signing'} sessions.`
              }
            </span>
          </div>
        </div>

        {/* Action Button */}
        {!isVerified && (
          <Button 
            onClick={onStartVerification}
            className="w-full"
            disabled={!accountSetupComplete}
          >
            {!accountSetupComplete 
              ? 'Complete Account Setup First'
              : verificationStatus === 'pending' 
                ? 'Check Verification Status'
                : verificationStatus === 'denied'
                  ? 'Retry ID Verification'
                  : 'Start ID Verification'
            }
          </Button>
        )}

        {/* Help Text */}
        {!isVerified && (
          <div className="text-xs text-gray-500 space-y-1">
            <p><strong>Required Documents:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Government-issued photo ID (Driver's License, State ID, or Passport)</li>
              <li>Clear selfie for face matching verification</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 