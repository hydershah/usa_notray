import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { IdCard, Shield, Smartphone } from 'lucide-react';

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const { toast } = useToast();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          twoFactorCode: twoFactorCode || undefined 
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requiresTwoFactor) {
          setRequiresTwoFactor(true);
          toast({
            title: "2FA Required",
            description: "Please enter your two-factor authentication code.",
          });
        } else {
          // Complete login
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          toast({
            title: "Success",
            description: "You have been logged in successfully.",
          });
          setLocation('/dashboard');
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.message || "Login failed. Please try again.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Login failed. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary rounded-full flex items-center justify-center mb-4">
            <IdCard className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold">USA Notary</CardTitle>
          <CardDescription>Professional Notary Services</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={requiresTwoFactor}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={requiresTwoFactor}
              />
            </div>
            
            {requiresTwoFactor && (
              <div className="space-y-3 p-4 border rounded-lg bg-blue-50">
                <div className="flex items-center gap-2 text-blue-700">
                  <Shield className="h-4 w-4" />
                  <span className="font-medium">Two-Factor Authentication Required</span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="two-factor">Enter 6-digit code from your authenticator app</Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={twoFactorCode}
                      onChange={setTwoFactorCode}
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
                  <div className="flex items-center gap-1 text-xs text-gray-600 justify-center">
                    <Smartphone className="h-3 w-3" />
                    <span>Open your authenticator app to get the current code</span>
                  </div>
                </div>
              </div>
            )}
            
            {!requiresTwoFactor && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="remember" 
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <Label htmlFor="remember" className="text-sm">Remember me</Label>
                </div>
                <Button variant="link" className="p-0 h-auto text-sm">
                  Forgot password?
                </Button>
              </div>
            )}
            
            <div className="space-y-2">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || (requiresTwoFactor && twoFactorCode.length !== 6)}
              >
                {isLoading ? 'Signing in...' : requiresTwoFactor ? 'Verify & Sign In' : 'Sign In'}
              </Button>
              
              {requiresTwoFactor && (
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => {
                    setRequiresTwoFactor(false);
                    setTwoFactorCode('');
                  }}
                >
                  Back to Login
                </Button>
              )}
            </div>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have a company account?
            </p>
            <Button 
              variant="link" 
              className="p-0 h-auto text-sm font-semibold"
              onClick={() => setLocation('/register-company')}
            >
              Register Your Title Company
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
