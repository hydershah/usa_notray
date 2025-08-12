import React, { useEffect, useState } from 'react';
import { useParams, Redirect } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, FileSignature, ArrowRight } from 'lucide-react';

interface JobSigner {
  id: number;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  invitationToken: string | null;
  signingStatus: string;
  userId: number | null;
}

/**
 * JobSignRedirect Component
 * 
 * Handles the legacy /jobs/:id/sign URL pattern and redirects users to the correct signing flow.
 * This component:
 * 1. Checks if the current user is a signer for this job
 * 2. If they are, redirects to /sign/:token
 * 3. If not, shows appropriate guidance
 */
export default function JobSignRedirect() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  // Fetch job signers to find if current user is a signer
  const { data: signers, isLoading, error } = useQuery<JobSigner[]>({
    queryKey: ['job-signers', id],
    queryFn: async () => {
      const response = await fetch(`/api/jobs/${id}/signers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch job signers');
      }
      
      return response.json();
    },
    enabled: !!id
  });

  useEffect(() => {
    if (user && signers && !isLoading && !error) {
      // Find signer record for current user
      const userSigner = signers.find(signer => 
        signer.userId === user.id || 
        signer.signerEmail.toLowerCase() === user.email.toLowerCase()
      );

      if (userSigner && userSigner.invitationToken) {
        // Redirect to proper signing URL
        setRedirectPath(`/sign/${userSigner.invitationToken}`);
      }
    }
  }, [user, signers, isLoading, error]);

  // If we found a redirect path, redirect now
  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading signing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <FileSignature className="w-6 h-6 text-orange-600" />
            </div>
            <CardTitle className="text-xl font-semibold text-gray-900">
              Signing Access
            </CardTitle>
            <CardDescription>
              We're checking your signing permissions for this job
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {error ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Unable to load job information. Please check that you have access to this job.
                </AlertDescription>
              </Alert>
            ) : signers && signers.length > 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You don't appear to be assigned as a signer for this job. Please check with the job administrator or use the invitation link sent to your email.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No signers found for this job. The job may not be ready for signing yet.
                </AlertDescription>
              </Alert>
            )}

            <div className="pt-4 space-y-3">
              <Button 
                onClick={() => window.location.href = `/jobs/${id}`}
                variant="outline" 
                className="w-full"
              >
                View Job Details
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              
              <Button 
                onClick={() => window.location.href = '/dashboard'}
                className="w-full"
              >
                Go to Dashboard
              </Button>
            </div>

            <div className="text-sm text-gray-500 text-center pt-4 border-t">
              <p className="mb-2">
                <strong>Looking to sign documents?</strong>
              </p>
              <p>
                Use the invitation link sent to your email, or contact the job administrator for assistance.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
