import React, { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { GuestSignerAccess } from '@/components/signing/guest-signer-access';
import { LiveSigningSession } from '@/components/signing/live-signing-session';
import { UserForm } from '@/components/user/user-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, UserPlus } from 'lucide-react';

function GuestSignerPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  
  const [currentView, setCurrentView] = useState<'access' | 'signing' | 'registration'>('access');
  const [guestSessionData, setGuestSessionData] = useState<any>(null);
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [registrationStep, setRegistrationStep] = useState<'form' | 'password'>('form');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Invalid Access</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              No invitation token provided. Please use the link from your email invitation.
            </p>
            <Button onClick={() => setLocation('/')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAccessGranted = (sessionData: any) => {
    setGuestSessionData(sessionData);
    setCurrentView('signing');
    
    toast({
      title: "Access Granted",
      description: "You can now participate in the live signing session.",
    });
  };

  const handleRegistrationRequest = (signerData: any) => {
    setRegistrationData(signerData);
    setCurrentView('registration');
  };

  const handleCompleteRegistration = async () => {
    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/signers/convert-to-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invitationToken: token,
          password,
          verificationData: registrationData?.verificationData
        })
      });

      if (response.ok) {
        toast({
          title: "Account Created",
          description: "Your account has been created successfully. You can now sign in.",
        });
        
        // Redirect to login page
        setLocation('/login');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: "Registration Failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSigningComplete = () => {
    toast({
      title: "Documents Signed",
      description: "All documents have been successfully signed and notarized.",
    });
    
    // Redirect or show completion page
    setLocation('/');
  };

  const handleSigningCancel = () => {
    setCurrentView('access');
    setGuestSessionData(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {currentView === 'access' && (
        <GuestSignerAccess
          invitationToken={token}
          onAccessGranted={handleAccessGranted}
          onRegistrationRequest={handleRegistrationRequest}
        />
      )}

      {currentView === 'signing' && guestSessionData && (
        <LiveSigningSession
          jobId={guestSessionData.jobId || 1}
          onComplete={handleSigningComplete}
          onCancel={handleSigningCancel}
        />
      )}

      {currentView === 'registration' && (
        <div className="py-8">
          <div className="max-w-2xl mx-auto px-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <UserPlus className="h-6 w-6 mr-2" />
                  Create Your Account
                </CardTitle>
              </CardHeader>
              <CardContent>
                {registrationStep === 'form' && (
                  <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-medium text-blue-900 mb-2">Account Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Name:</span> {registrationData?.signerName}
                        </div>
                        <div>
                          <span className="font-medium">Email:</span> {registrationData?.signerEmail}
                        </div>
                        <div>
                          <span className="font-medium">Phone:</span> {registrationData?.signerPhoneNumber}
                        </div>
                        <div>
                          <span className="font-medium">Identity:</span> ✅ Verified
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-gray-600 mb-4">
                        Your identity has been verified. Now create a password to complete your account setup.
                      </p>
                      
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="password">Password</Label>
                          <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter a secure password"
                            className="mt-1"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="confirmPassword">Confirm Password</Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm your password"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-4">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentView('access')}
                        className="flex-1"
                      >
                        Back to Signing Options
                      </Button>
                      <Button
                        onClick={handleCompleteRegistration}
                        disabled={!password || !confirmPassword}
                        className="flex-1"
                      >
                        Create Account
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default GuestSignerPage; 