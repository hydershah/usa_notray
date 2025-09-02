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
  email_provider: string;
  // Postmark settings
  postmark_api_key: string;
  postmark_from_email: string;
  postmark_from_name: string;
  postmark_track_opens: string;
  postmark_track_links: string;
  // SMTP settings (fallback)
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
    email_provider: 'postmark',
    // Postmark settings
    postmark_api_key: '',
    postmark_from_email: '',
    postmark_from_name: 'Sharp Note',
    postmark_track_opens: 'true',
    postmark_track_links: 'HtmlAndText',
    // SMTP settings (fallback)
    smtp_host: '',
    smtp_port: '',
    smtp_user: '',
    smtp_pass: '',
    smtp_secure: 'true',
    from_email: '',
    from_name: 'Sharp Note'
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
        body: JSON.stringify({ 
          testEmail: testEmail || (settings.email_provider === 'postmark' ? settings.postmark_from_email : settings.smtp_user)
        })
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
            {/* Email Provider Selection */}
            <div className="space-y-2">
              <Label>Email Provider</Label>
              <RadioGroup
                value={settings.email_provider}
                onValueChange={(value) => setSettings({ ...settings, email_provider: value })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="postmark" id="postmark" />
                  <Label htmlFor="postmark">Postmark (Recommended)</Label>
                  <span className="text-sm text-blue-600">✨ High deliverability, tracking, analytics</span>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="smtp" id="smtp" />
                  <Label htmlFor="smtp">SMTP (Fallback)</Label>
                  <span className="text-sm text-gray-500">Traditional SMTP configuration</span>
                </div>
              </RadioGroup>
            </div>

            {/* Postmark Settings */}
            {settings.email_provider === 'postmark' && (
              <div className="space-y-4 p-4 bg-blue-50 border rounded-lg">
                <h3 className="font-semibold text-blue-900">Postmark Configuration</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Postmark API Key */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="postmark_api_key">Postmark API Key</Label>
                    <Input
                      id="postmark_api_key"
                      type={showPassword ? 'text' : 'password'}
                      value={settings.postmark_api_key}
                      onChange={(e) => setSettings({ ...settings, postmark_api_key: e.target.value })}
                      placeholder="Your Postmark API key"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Hide' : 'Show'} API Key
                    </Button>
                  </div>

                  {/* From Email */}
                  <div className="space-y-2">
                    <Label htmlFor="postmark_from_email">From Email</Label>
                    <Input
                      id="postmark_from_email"
                      type="email"
                      value={settings.postmark_from_email}
                      onChange={(e) => setSettings({ ...settings, postmark_from_email: e.target.value })}
                      placeholder="noreply@usanotaryservices.com"
                      required
                    />
                  </div>

                  {/* From Name */}
                  <div className="space-y-2">
                    <Label htmlFor="postmark_from_name">From Name</Label>
                    <Input
                      id="postmark_from_name"
                      value={settings.postmark_from_name}
                      onChange={(e) => setSettings({ ...settings, postmark_from_name: e.target.value })}
                      placeholder="Sharp Note"
                      required
                    />
                  </div>

                  {/* Track Opens */}
                  <div className="space-y-2">
                    <Label>Track Email Opens</Label>
                    <RadioGroup
                      value={settings.postmark_track_opens}
                      onValueChange={(value) => setSettings({ ...settings, postmark_track_opens: value })}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="true" id="track_opens_yes" />
                        <Label htmlFor="track_opens_yes">Enabled</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="false" id="track_opens_no" />
                        <Label htmlFor="track_opens_no">Disabled</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Track Links */}
                  <div className="space-y-2">
                    <Label>Track Links</Label>
                    <Select
                      value={settings.postmark_track_links}
                      onValueChange={(value) => setSettings({ ...settings, postmark_track_links: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="HtmlAndText">HTML & Text</SelectItem>
                        <SelectItem value="HtmlOnly">HTML Only</SelectItem>
                        <SelectItem value="TextOnly">Text Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Postmark provides superior deliverability, real-time tracking, and detailed analytics for your email campaigns.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* SMTP Settings */}
            {settings.email_provider === 'smtp' && (
              <div className="space-y-4 p-4 bg-gray-50 border rounded-lg">
                <h3 className="font-semibold text-gray-900">SMTP Configuration</h3>

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
                  type="text"
                  value={settings.smtp_user}
                  onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                  placeholder="resend (for Resend) or your-email@domain.com"
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
                  placeholder="Sharp Note"
                  required
                />
              </div>
            </div>

                {/* Security Type */}
                <div className="space-y-2 md:col-span-2">
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
              </div>
            )}

            {/* Current Configuration Alert */}
            {emailSettings && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {emailSettings.email_provider === 'postmark' 
                    ? `Current Provider: Postmark (${emailSettings.postmark_from_email})`
                    : `Current SMTP: ${emailSettings.smtp_host}:${emailSettings.smtp_port} ${emailSettings.smtp_secure === 'true' ? '(SSL)' : '(STARTTLS)'}`
                  }
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
                  disabled={testMutation.isPending || (settings.email_provider === 'postmark' ? !settings.postmark_api_key : !settings.smtp_host)}
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
          <CardTitle>Email Provider Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2 text-blue-700">🚀 Postmark (Recommended)</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• 99%+ deliverability rate</p>
              <p>• Real-time email tracking and analytics</p>
              <p>• Professional sender reputation</p>
              <p>• No SMTP configuration needed</p>
              <p>• Instant delivery (usually &lt; 5 seconds)</p>
              <p>• Built-in bounce and spam management</p>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">📧 SMTP (Fallback)</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• Traditional email sending method</p>
              <p>• Requires SMTP server configuration</p>
              <p>• Lower deliverability rates</p>
              <p>• No built-in tracking or analytics</p>
              <p>• May require additional setup for anti-spam</p>
            </div>
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Email settings are used for sending signer invitations, password resets, and system notifications. 
              Postmark provides superior delivery and tracking capabilities.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
} 