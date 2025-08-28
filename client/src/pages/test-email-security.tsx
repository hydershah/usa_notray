import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmailExistsAlert, SecurityAlert } from '@/components/ui/security-alert';
import { useToast } from '@/hooks/use-toast';
import { Shield, TestTube, AlertTriangle } from 'lucide-react';

export default function TestEmailSecurity() {
  const [, setLocation] = useLocation();
  const [testEmail, setTestEmail] = useState('test@example.com');
  const [userType, setUserType] = useState('client');
  const [isLoading, setIsLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [errorData, setErrorData] = useState<any>(null);
  const { toast } = useToast();

  const testRegistrationEndpoints = [
    { value: 'client', label: 'Client Registration', endpoint: '/api/auth/register-client' },
    { value: 'notary', label: 'Notary Registration', endpoint: '/api/auth/register-notary' },
    { value: 'company', label: 'Company Registration', endpoint: '/api/auth/register-company' },
    { value: 'user', label: 'Universal User Registration', endpoint: '/api/auth/register-user' },
    { value: 'email', label: 'Email Link Registration', endpoint: '/api/auth/register-email' },
    { value: 'otp', label: 'OTP Registration', endpoint: '/api/auth/register-otp' }
  ];

  const getRequestBody = () => {
    const baseData = {
      email: testEmail,
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
      phoneNumber: '(555) 123-4567',
      fullName: 'Test User'
    };

    switch (userType) {
      case 'client':
        return {
          ...baseData,
          fullName: baseData.fullName
        };
      case 'notary':
        return {
          ...baseData,
          address1: '123 Test St',
          city: 'Test City',
          state: 'CA',
          zipCode: '12345',
          dateOfBirth: '1990-01-01',
          commissionNumber: 'TEST123',
          commissionState: 'CA',
          commissionExpiration: '2025-12-31',
          yearsOfExperience: '5',
          notaryType: 'contractor'
        };
      case 'company':
        return {
          companyName: 'Test Company LLC',
          primaryUserName: baseData.fullName,
          primaryUserEmail: testEmail,
          primaryUserPassword: baseData.password,
          address1: '123 Business St',
          city: 'Business City',
          state: 'CA',
          zipCode: '12345',
          paymentMethod: 'invoiced',
          contactName: baseData.fullName,
          email: testEmail + '.contact'
        };
      case 'user':
        return {
          ...baseData,
          userType: 'client'
        };
      case 'email':
      case 'otp':
        return {
          email: testEmail,
          password: baseData.password
        };
      default:
        return baseData;
    }
  };

  const testRegistration = async () => {
    setIsLoading(true);
    setShowAlert(false);
    setErrorData(null);

    try {
      const endpoint = testRegistrationEndpoints.find(e => e.value === userType)?.endpoint || '/api/auth/register-client';
      const requestBody = getRequestBody();

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.error === 'EMAIL_ALREADY_EXISTS') {
          setErrorData(data);
          setShowAlert(true);
          toast({
            variant: "destructive",
            title: "Security Test Result",
            description: "✅ Email security protection is working correctly!",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Test Failed",
            description: data.message || "Registration failed for unexpected reason",
          });
        }
      } else {
        toast({
          variant: "destructive",
          title: "⚠️ Security Issue Detected",
          description: "Registration succeeded when it should have been blocked!",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Test Error",
        description: error instanceof Error ? error.message : "Test failed to execute",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createTestUser = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register-client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: 'Test User',
          email: testEmail,
          phoneNumber: '(555) 123-4567',
          password: 'TestPass123!'
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Test User Created",
          description: `Created test account with email: ${testEmail}`,
        });
      } else {
        toast({
          variant: "destructive", 
          title: "Failed to Create Test User",
          description: data.message || "Could not create test user",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create test user",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-8 w-8 text-blue-600" />
            <TestTube className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Email Security Test Suite
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Test the email uniqueness security system by attempting to register with duplicate emails 
            across different account types. This should be blocked by our security measures.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Test Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5 text-green-600" />
                Security Test Configuration
              </CardTitle>
              <CardDescription>
                Configure and run email security tests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-email">Test Email Address</Label>
                <Input
                  id="test-email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-type">Registration Type to Test</Label>
                <Select value={userType} onValueChange={setUserType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select registration type" />
                  </SelectTrigger>
                  <SelectContent>
                    {testRegistrationEndpoints.map((endpoint) => (
                      <SelectItem key={endpoint.value} value={endpoint.value}>
                        {endpoint.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={createTestUser} 
                  disabled={isLoading}
                  variant="outline"
                  className="flex-1"
                >
                  1. Create Test User
                </Button>
                <Button 
                  onClick={testRegistration} 
                  disabled={isLoading}
                  className="flex-1"
                >
                  2. Test Duplicate Registration
                </Button>
              </div>

              <div className="bg-gray-50 p-3 rounded text-sm">
                <p className="font-medium text-gray-700 mb-1">Test Process:</p>
                <ol className="text-gray-600 space-y-1">
                  <li>1. Create a test user with the email address</li>
                  <li>2. Attempt to register again with the same email</li>
                  <li>3. Security system should block the duplicate registration</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Security Alert Demo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Security Message Preview
              </CardTitle>
              <CardDescription>
                How security messages will appear to users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {showAlert && errorData ? (
                <EmailExistsAlert
                  email={testEmail}
                  onSignIn={() => setLocation('/login')}
                  onRetry={() => {
                    setShowAlert(false);
                    setErrorData(null);
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <SecurityAlert
                    type="email-exists"
                    message="This is how users will see the security message when they attempt to register with an existing email address."
                    suggestion="The message provides clear guidance on next steps."
                  />
                  
                  <div className="bg-blue-50 p-3 rounded text-sm">
                    <p className="font-medium text-blue-700 mb-1">Security Features:</p>
                    <ul className="text-blue-600 space-y-1">
                      <li>• Clear error messaging</li>
                      <li>• Explains email uniqueness requirement</li>
                      <li>• Provides actionable next steps</li>
                      <li>• Toast notifications for better UX</li>
                      <li>• Form field validation</li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Back to Home */}
        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => setLocation('/')}>
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
