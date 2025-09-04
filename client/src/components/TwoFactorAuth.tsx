import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { Shield, ShieldCheck, ShieldAlert, QrCode, Smartphone, Key, AlertTriangle, Copy, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TwoFactorAuthProps {
  onStatusChange?: (enabled: boolean) => void;
}

interface TwoFactorStatus {
  enabled: boolean;
  hasSecret: boolean;
}

interface SetupData {
  qrCode: string;
  secret: string;
  manualEntryKey: string;
}

export default function TwoFactorAuth({ onStatusChange }: TwoFactorAuthProps) {
  const [status, setStatus] = useState<TwoFactorStatus>({ enabled: false, hasSecret: false });
  const [isLoading, setIsLoading] = useState(false);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisablePassword, setShowDisablePassword] = useState(false);
  const [showManualKey, setShowManualKey] = useState(false);
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/2fa/status', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch 2FA status:', error);
    }
  };

  const startSetup = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSetupData(data);
        setIsSetupDialogOpen(true);
      } else {
        const error = await response.json();
        toast({
          variant: "destructive",
          title: "Setup Failed",
          description: error.message || "Failed to start 2FA setup",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start 2FA setup",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (verificationCode.length !== 6) {
      toast({
        variant: "destructive",
        title: "Invalid Code",
        description: "Please enter a 6-digit verification code",
      });
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ token: verificationCode })
      });

      if (response.ok) {
        const data = await response.json();
        setStatus({ enabled: true, hasSecret: true });
        setIsSetupDialogOpen(false);
        setSetupData(null);
        setVerificationCode('');
        onStatusChange?.(true);
        
        toast({
          title: "2FA Enabled",
          description: "Two-factor authentication has been successfully enabled for your account",
        });
      } else {
        const error = await response.json();
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: error.message || "Invalid verification code",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to verify 2FA code",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!disableCode && !disablePassword) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please provide either your current password or a 2FA code",
      });
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          token: disableCode || undefined,
          password: disablePassword || undefined
        })
      });

      if (response.ok) {
        setStatus({ enabled: false, hasSecret: false });
        setIsDisableDialogOpen(false);
        setDisableCode('');
        setDisablePassword('');
        onStatusChange?.(false);
        
        toast({
          title: "2FA Disabled",
          description: "Two-factor authentication has been disabled for your account",
        });
      } else {
        const error = await response.json();
        toast({
          variant: "destructive",
          title: "Failed to Disable",
          description: error.message || "Invalid credentials",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to disable 2FA",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      toast({
        title: "Copied",
        description: "Secret key copied to clipboard",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to Copy",
        description: "Could not copy to clipboard",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status.enabled ? (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-orange-500" />
          )}
          Two-Factor Authentication (2FA)
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account with time-based one-time passwords (TOTP)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-full">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="font-medium">2FA Status</div>
              <div className="text-sm text-gray-600">
                {status.enabled 
                  ? "Two-factor authentication is enabled and protecting your account"
                  : "Your account is not protected by two-factor authentication"
                }
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status.enabled ? "default" : "secondary"}>
              {status.enabled ? "Enabled" : "Disabled"}
            </Badge>
            {status.enabled ? (
              <AlertDialog open={isDisableDialogOpen} onOpenChange={setIsDisableDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Disable 2FA
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="sm:max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      Disable Two-Factor Authentication
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Disabling 2FA will make your account less secure. You'll need to verify your identity to proceed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  
                  <Tabs defaultValue="2fa" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="2fa">Use 2FA Code</TabsTrigger>
                      <TabsTrigger value="password">Use Password</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="2fa" className="space-y-4">
                      <div>
                        <Label htmlFor="disable-code">Enter 2FA Code from Your App</Label>
                        <InputOTP
                          maxLength={6}
                          value={disableCode}
                          onChange={setDisableCode}
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="password" className="space-y-4">
                      <div>
                        <Label htmlFor="current-password">Current Password</Label>
                        <div className="relative">
                          <Input
                            id="current-password"
                            type={showDisablePassword ? "text" : "password"}
                            value={disablePassword}
                            onChange={(e) => setDisablePassword(e.target.value)}
                            placeholder="Enter your current password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowDisablePassword(!showDisablePassword)}
                          >
                            {showDisablePassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={disable2FA}
                      disabled={isLoading || (!disableCode && !disablePassword)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isLoading ? "Disabling..." : "Disable 2FA"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Dialog open={isSetupDialogOpen} onOpenChange={setIsSetupDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={startSetup} disabled={isLoading}>
                    {isLoading ? "Setting up..." : "Enable 2FA"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Set Up Two-Factor Authentication
                    </DialogTitle>
                    <DialogDescription>
                      Follow these steps to secure your account with 2FA
                    </DialogDescription>
                  </DialogHeader>
                  
                  {setupData && (
                    <div className="space-y-6">
                      <div className="text-center space-y-4">
                        <div className="space-y-2">
                          <h3 className="font-medium">Step 1: Scan QR Code</h3>
                          <p className="text-sm text-gray-600">
                            Use Google Authenticator, Authy, or any TOTP app to scan this QR code:
                          </p>
                        </div>
                        
                        <div className="flex justify-center">
                          <div className="p-4 bg-white border rounded-lg">
                            <img 
                              src={setupData.qrCode} 
                              alt="2FA QR Code"
                              className="w-48 h-48"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowManualKey(!showManualKey)}
                            className="w-full"
                          >
                            <Key className="h-4 w-4 mr-2" />
                            {showManualKey ? "Hide" : "Show"} Manual Entry Key
                          </Button>
                          
                          {showManualKey && (
                            <div className="p-3 bg-gray-50 border rounded-lg">
                              <div className="flex items-center gap-2">
                                <code className="flex-1 text-sm font-mono break-all">
                                  {setupData.manualEntryKey}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(setupData.manualEntryKey)}
                                >
                                  {copiedKey ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h3 className="font-medium">Step 2: Enter Verification Code</h3>
                          <p className="text-sm text-gray-600">
                            Enter the 6-digit code from your authenticator app:
                          </p>
                        </div>
                        
                        <div className="flex justify-center">
                          <InputOTP
                            maxLength={6}
                            value={verificationCode}
                            onChange={setVerificationCode}
                          >
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                        
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsSetupDialogOpen(false);
                              setSetupData(null);
                              setVerificationCode('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={verifyAndEnable}
                            disabled={isLoading || verificationCode.length !== 6}
                          >
                            {isLoading ? "Verifying..." : "Enable 2FA"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
        
        {/* Additional Security Information */}
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <Smartphone className="h-4 w-4 mt-0.5 text-blue-500" />
            <div>
              <span className="font-medium">Compatible Apps:</span> Google Authenticator, Authy, Microsoft Authenticator, 1Password, and other TOTP apps
            </div>
          </div>
          <div className="flex items-start gap-2">
            <QrCode className="h-4 w-4 mt-0.5 text-green-500" />
            <div>
              <span className="font-medium">How it works:</span> Your authenticator app generates a new 6-digit code every 30 seconds that you'll enter during login
            </div>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500" />
            <div>
              <span className="font-medium">Important:</span> Keep your backup codes safe! You can use your password to disable 2FA if you lose access to your authenticator app
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 