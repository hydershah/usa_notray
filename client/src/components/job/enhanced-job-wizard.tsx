import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { 
  Users, Mail, CheckCircle, Clock, User, 
  ExternalLink, Copy, Send, Eye
} from "lucide-react";

interface EnhancedJobWizardProps {
  jobData: any;
  signers: any[];
  onComplete: () => void;
}

export function EnhancedJobWizard({ jobData, signers, onComplete }: EnhancedJobWizardProps) {
  const [invitationsSent, setInvitationsSent] = useState(false);

  const handleSendInvitations = async () => {
    try {
      // Simulate sending invitations
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setInvitationsSent(true);
      
      toast({
        title: "Invitations Sent Successfully",
        description: `${signers.length} signer invitation(s) have been sent with unique access links.`,
      });
    } catch (error) {
      toast({
        title: "Send Failed",
        description: "Failed to send invitations. Please try again.",
        variant: "destructive",
      });
    }
  };

  const copyInvitationLink = (signerId: number) => {
    const link = `${window.location.origin}/sign/demo-token-${signerId}`;
    navigator.clipboard.writeText(link);
    
    toast({
      title: "Link Copied",
      description: "Invitation link copied to clipboard.",
    });
  };

  const previewEmail = (signer: any) => {
    // Open a modal or new window with email preview
    toast({
      title: "Email Preview",
      description: `Preview for ${signer.signerName} would open here.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Job Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Job Created Successfully</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Title Company:</span> {jobData.titleCompany}
            </div>
            <div>
              <span className="font-medium">Closing Type:</span> {jobData.closingType}
            </div>
            <div>
              <span className="font-medium">Property:</span> {jobData.propertyAddressOne}
            </div>
            <div>
              <span className="font-medium">Signers:</span> {signers.length} added
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signer Invitation Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Signer Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">How Guest Signing Works</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Signers receive email invitations with unique secure links</li>
                <li>• Identity verification required before access</li>
                <li>• Choose between quick guest signing or full registration</li>
                <li>• Guest sessions expire in 24 hours for security</li>
                <li>• All actions are logged for compliance</li>
              </ul>
            </div>

            {/* Signer List */}
            <div className="space-y-3">
              {signers.map((signer, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                        <User className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium">{signer.signerName}</p>
                        <p className="text-sm text-gray-600">{signer.signerEmail}</p>
                        <p className="text-sm text-gray-500">{signer.signerPhoneNumber}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Badge>{signer.signerRole}</Badge>
                      
                      {invitationsSent ? (
                        <div className="flex items-center space-x-2">
                          <Badge className="bg-green-100 text-green-800">
                            <Mail className="h-3 w-3 mr-1" />
                            Sent
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyInvitationLink(index + 1)}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy Link
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Badge className="bg-yellow-100 text-yellow-800">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => previewEmail(signer)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Preview
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {invitationsSent && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          Invitation Link: <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                            /sign/demo-token-{index + 1}
                          </code>
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`/sign/demo-token-${index + 1}`, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Test Link
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4 pt-4 border-t">
              {!invitationsSent ? (
                <Button 
                  onClick={handleSendInvitations}
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Invitations to All Signers
                </Button>
              ) : (
                <Button 
                  onClick={onComplete}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Job Setup
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Template Preview */}
      {invitationsSent && (
        <Card>
          <CardHeader>
            <CardTitle>Email Template Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 border rounded-lg p-4 text-sm">
              <div className="border border-gray-200 bg-white rounded p-4 max-w-md mx-auto">
                <h3 className="text-blue-600 font-bold text-center mb-3">Document Signing Invitation</h3>
                <p><strong>Dear {signers.length > 0 ? signers[0].signerName : 'Valued Client'},</strong></p>
                <p className="text-gray-600 mb-3">
                  You have been invited to sign important documents for the following notarization:
                </p>
                
                <div className="bg-gray-50 p-3 rounded mb-3 text-xs">
                  <div><strong>Title Company:</strong> {jobData.titleCompany}</div>
                  <div><strong>Closing Type:</strong> {jobData.closingType}</div>
                  <div><strong>Your Role:</strong> borrower</div>
                </div>
                
                <div className="text-center mb-3">
                  <div className="bg-blue-600 text-white px-4 py-2 rounded inline-block text-xs">
                    🔗 Access Signing Session
                  </div>
                </div>
                
                <div className="bg-yellow-50 p-2 rounded text-xs">
                  <strong>What to expect:</strong>
                  <ul className="text-xs mt-1 ml-4">
                    <li>Identity verification required</li>
                    <li>Choose guest or full registration</li>
                    <li>Digital signature capture</li>
                    <li>Live notarization session</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 