import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle, Mail, Save, TestTube } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface EmailSettings {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_secure: string;
  from_email: string;
  from_name: string;
}

export function EmailSettings() {
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [settings, setSettings] = useState<EmailSettings>({
    smtp_host: '',
    smtp_port: '',
    smtp_user: '',
    smtp_pass: '',
    smtp_secure: 'true',
    from_email: '',
    from_name: 'USA Notary System'
  });

  // Load email settings
  const { data: emailSettings, isLoading } = useQuery({
    queryKey: ['email-settings'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/settings/email', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to load email settings');
      return response.json();
    }
  });

  useEffect(() => {
    if (emailSettings) {
      setSettings(emailSettings);
    }
  }, [emailSettings]);

  // Save email settings
  const saveMutation = useMutation({
    mutationFn: async (data: EmailSettings) => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/settings/email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to save email settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      toast({
        title: 'Email Settings Saved',
        description: 'Your email configuration has been updated successfully.'
      });
    },
    onError: (error) => {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save email settings.',
        variant: 'destructive'
      });
    }
  });

  // Test email configuration
  const testMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/settings/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ testEmail: testEmail || settings.smtp_user })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Test failed');
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Test Email Sent',
        description: data.message || 'Check your inbox to confirm the email was received.'
      });
    },
    onError: (error) => {
      toast({
        title: 'Test Failed',
        description: error.message || 'Failed to send test email.',
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(settings);
  };

  if (isLoading) {
    return <div>Loading email settings...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="h-5 w-5 mr-2" />
            Email Configuration
          </CardTitle>
          <CardDescription>
            Configure SMTP settings for sending system emails
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Quick Setup Templates */}
            <div className="space-y-2">
              <Label>Quick Setup</Label>
              <Select
                onValueChange={(value) => {
                  switch (value) {
                    case 'hostinger-ssl':
                      setSettings({
                        ...settings,
                        smtp_host: 'smtp.hostinger.com',
                        smtp_port: '465',
                        smtp_secure: 'true',
                        smtp_user: 'mail@digitalexpert.agency',
                        from_email: 'mail@digitalexpert.agency',
                        from_name: 'USA Notary System'
                      });
                      break;
                    case 'hostinger-tls':
                      setSettings({
                        ...settings,
                        smtp_host: 'mail.hostinger.com',
                        smtp_port: '587',
                        smtp_secure: 'false',
                        smtp_user: 'mail@digitalexpert.agency',
                        from_email: 'mail@digitalexpert.agency',
                        from_name: 'USA Notary System'
                      });
                      break;
                    case 'gmail':
                      setSettings({
                        ...settings,
                        smtp_host: 'smtp.gmail.com',
                        smtp_port: '587',
                        smtp_secure: 'false'
                      });
                      break;
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a provider template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hostinger-ssl">Hostinger (SSL - Port 465)</SelectItem>
                  <SelectItem value="hostinger-tls">Hostinger (TLS - Port 587)</SelectItem>
                  <SelectItem value="gmail">Gmail</SelectItem>
                  <SelectItem value="outlook">Outlook</SelectItem>
                  <SelectItem value="custom">Custom SMTP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SMTP Host */}
              <div className="space-y-2">
                <Label htmlFor="smtp_host">SMTP Host</Label>
                <Input
                  id="smtp_host"
                  value={settings.smtp_host}
                  onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                  placeholder="smtp.hostinger.com"
                  required
                />
              </div>

              {/* SMTP Port */}
              <div className="space-y-2">
                <Label htmlFor="smtp_port">SMTP Port</Label>
                <Input
                  id="smtp_port"
                  value={settings.smtp_port}
                  onChange={(e) => setSettings({ ...settings, smtp_port: e.target.value })}
                  placeholder="465"
                  required
                />
              </div>

              {/* SMTP User */}
              <div className="space-y-2">
                <Label htmlFor="smtp_user">SMTP Username</Label>
                <Input
                  id="smtp_user"
                  type="email"
                  value={settings.smtp_user}
                  onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                  placeholder="mail@digitalexpert.agency"
                  required
                />
              </div>

              {/* SMTP Password */}
              <div className="space-y-2">
                <Label htmlFor="smtp_pass">SMTP Password</Label>
                <Input
                  id="smtp_pass"
                  type={showPassword ? 'text' : 'password'}
                  value={settings.smtp_pass}
                  onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
                  placeholder="••••••••"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'} Password
                </Button>
              </div>

              {/* From Email */}
              <div className="space-y-2">
                <Label htmlFor="from_email">From Email</Label>
                <Input
                  id="from_email"
                  type="email"
                  value={settings.from_email}
                  onChange={(e) => setSettings({ ...settings, from_email: e.target.value })}
                  placeholder="noreply@yourdomain.com"
                  required
                />
              </div>

              {/* From Name */}
              <div className="space-y-2">
                <Label htmlFor="from_name">From Name</Label>
                <Input
                  id="from_name"
                  value={settings.from_name}
                  onChange={(e) => setSettings({ ...settings, from_name: e.target.value })}
                  placeholder="USA Notary System"
                  required
                />
              </div>
            </div>

            {/* Security Type */}
            <div className="space-y-2">
              <Label>Security Type</Label>
              <RadioGroup
                value={settings.smtp_secure}
                onValueChange={(value) => setSettings({ ...settings, smtp_secure: value })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id="ssl" />
                  <Label htmlFor="ssl">SSL (Port 465)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id="tls" />
                  <Label htmlFor="tls">STARTTLS (Port 587)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Current Configuration Alert */}
            {emailSettings && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Current SMTP: {emailSettings.smtp_host}:{emailSettings.smtp_port} 
                  {emailSettings.smtp_secure === 'true' ? ' (SSL)' : ' (STARTTLS)'}
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>

              <div className="flex gap-2 flex-1">
                <Input
                  placeholder="Test email address"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending || !settings.smtp_host}
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {testMutation.isPending ? 'Testing...' : 'Test'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Email Provider Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Hostinger (Recommended)</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>SSL: smtp.hostinger.com:465</p>
              <p>TLS: mail.hostinger.com:587</p>
              <p>Username: Your full email address</p>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Gmail</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Server: smtp.gmail.com:587</p>
              <p>Requires App Password (not regular password)</p>
            </div>
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Email settings are used for sending signer invitations, password resets, and system notifications.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
} 