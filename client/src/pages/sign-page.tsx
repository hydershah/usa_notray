import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, Calendar, MapPin, User, Mail, AlertCircle, Key, LogIn } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [accountExists, setAccountExists] = useState<boolean | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  // Query to validate invitation token and get signer info
  const { data: invitationData, isLoading: invitationLoading, error: invitationError } = useQuery({
    queryKey: [`/api/signers/validate-invitation/${token}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/signers/validate-invitation/${token}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Invalid invitation token');
      }
      return data;
    },
    enabled: !!token,
  });

  // Check if invitation is valid and user has access
  useEffect(() => {
    if (!authLoading && invitationData) {
      // Set email from invitation data
      if (invitationData.signer?.signerEmail) {
        setEmail(invitationData.signer.signerEmail);
      }

      // Check if this email has an account
      if (invitationData.hasAccount !== undefined) {
        setAccountExists(invitationData.hasAccount);
      }

      // If user is already logged in and has access to this job
      if (isAuthenticated && user) {
        // Check if this is the correct user
        if (user.email === invitationData.signer?.signerEmail || user.id === invitationData.signer?.userId) {
          // User is logged in and has access - redirect to signing session immediately
          setRedirecting(true);
          setLocation(`/editor/${invitationData.job.id}?mode=signing`);
        } else {
          // Wrong user is logged in
          toast({
            variant: "destructive",
            title: "Wrong Account",
            description: "Please log out and use the correct account for this invitation.",
          });
        }
      }
    }
  }, [authLoading, invitationData, isAuthenticated, user, setLocation, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);

    try {
      const response = await apiRequest("POST", "/api/auth/login", { 
        email: email.trim().toLowerCase(), 
        password 
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Login failed");
      }

      const data = await response.json();
      
      // Store auth data
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      toast({
        title: "Login Successful",
        description: "Redirecting to your signing session...",
      });

      // Redirect to editor in signing mode
      setTimeout(() => {
        setLocation(`/editor/${invitationData.job.id}?mode=signing`);
      }, 1000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSetupAccount = async () => {
    setIsSettingUp(true);
    try {
      // Get password reset token for this signer
      const response = await fetch('/api/signers/get-password-reset-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invitationToken: token })
      });

      if (!response.ok) {
        throw new Error('Failed to get password reset token');
      }

      const data = await response.json();
      
      // Redirect to password setup with the password reset token
      // Pass the invitation token as signerToken so we can redirect back after setup
      setLocation(`/set-password?token=${data.passwordResetToken}&type=signer&signerToken=${token}`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Setup Error",
        description: "Failed to start account setup. Please try again.",
      });
      setIsSettingUp(false);
    }
  };

  // Removed blocking validation screen for invited signers
  if (invitationLoading || authLoading) {
    return null;
  }

  if (redirecting) {
    return null;
  }

  if (!invitationLoading && (invitationError || !invitationData)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {invitationError?.message || "The invitation token is not valid. Please contact your title company for assistance."}
              </AlertDescription>
            </Alert>
            <Button 
              className="w-full mt-4" 
              onClick={() => setLocation("/login")}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { job, signer } = invitationData;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Document Signing Session</CardTitle>
          <CardDescription>
            You've been invited to sign documents for {job.titleCompany}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Job Details */}
          <div className="bg-blue-50 p-4 rounded-lg space-y-2">
            <h3 className="font-semibold text-blue-900">Session Details</h3>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span><strong>Document Type:</strong> {job.closingType}</span>
              </div>
              {job.selectedDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span><strong>Date:</strong> {new Date(job.selectedDate).toLocaleDateString()}</span>
                </div>
              )}
              {job.propertyAddressOne && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <span><strong>Property:</strong> {job.propertyAddressOne}, {job.propertyCity}, {job.propertyState}</span>
                </div>
              )}
            </div>
          </div>

          {/* Signer Info */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <h3 className="font-semibold text-gray-900">Your Information</h3>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-600" />
                <span><strong>Name:</strong> {signer.signerName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-600" />
                <span><strong>Email:</strong> {signer.signerEmail}</span>
              </div>
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-gray-600" />
                <span><strong>Role:</strong> {signer.signerRole}</span>
              </div>
            </div>
          </div>

          {/* Authentication Section */}
          {accountExists === false || (accountExists === true && invitationData.user && !invitationData.user.accountSetupComplete) ? (
            // New User or Existing User without password setup - Need to set up account
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {accountExists === false 
                    ? "You need to set up your account before accessing the signing session."
                    : "Please complete your account setup to continue."}
                </AlertDescription>
              </Alert>
              <Button 
                className="w-full" 
                onClick={handleSetupAccount}
                disabled={isSettingUp}
              >
                {isSettingUp ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Set Up Account
                  </>
                )}
              </Button>
            </div>
          ) : accountExists === true && invitationData.user && invitationData.user.accountSetupComplete ? (
            // Existing User - Need to log in
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Log In to Continue
                  </>
                )}
              </Button>
              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setLocation("/login")}
                  className="text-sm"
                >
                  Forgot Password?
                </Button>
              </div>
            </form>
          ) : (
            // Loading state while checking account status
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
              <p className="mt-2 text-gray-600">Checking account status...</p>
            </div>
          )}

          {/* Important Notice */}
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>Important:</strong> You will need to verify your identity during the signing session. 
              Please have a valid government-issued ID ready.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
} 