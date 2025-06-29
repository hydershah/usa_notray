import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EVSVerification } from '@/components/verification/evs-verification';
import { 
  FileText, 
  ClipboardList, 
  User, 
  DollarSign, 
  Settings,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  UserCheck,
  Eye,
  PenTool,
  Shield,
  XCircle,
  RefreshCw
} from 'lucide-react';

interface SignerProfile {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string; // 'signer', 'witness', 'observer'
  
  // Address information (required for signing sessions)
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zipCode: string;
  
  // Account verification status
  isVerified: boolean;
  verificationStatus: string; // 'pending', 'verified', 'failed', 'rejected'
  accountSetupComplete: boolean;
  
  // ID Verification status
  idType?: string;
  idVerified: boolean;
  idExpirationDate?: string;
  
  // Digital signatures
  hasSignature: boolean;
  hasInitials: boolean;
  
  // Profile completion status
  profileComplete: boolean;
}

interface SigningSession {
  id: number;
  jobId: number;
  titleCompany: string;
  closingType: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  scheduledAt: string;
  sessionStatus: string;
  signerRole: string; // 'primary_signer', 'co_signer', 'witness', 'observer'
  documentsCount: number;
  notaryName?: string;
  inviteStatus: string; // 'pending', 'accepted', 'declined'
  sessionToken?: string;
}

interface PaymentInfo {
  totalReceived: number;
  pendingPayments: number;
  completedSessions: number;
}

export function SignerDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState<SignerProfile | null>(null);
  const [sessions, setSessions] = useState<SigningSession[]>([]);
  const [payments, setPayments] = useState<PaymentInfo>({
    totalReceived: 0,
    pendingPayments: 0,
    completedSessions: 0
  });
  const [loading, setLoading] = useState(true);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Fetch user profile
      const profileRes = await fetch(`/api/users/${user.id}/profile/comprehensive`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const profileData = await profileRes.json();
      
      // Set profile with computed fields
      setProfile({
        ...profileData,
        isVerified: profileData.isVerified || false,
        verificationStatus: profileData.verificationStatus || 'pending',
        accountSetupComplete: profileData.accountSetupComplete || false,
        idVerified: !!(profileData.idType && profileData.idNumber),
        hasSignature: !!profileData.signatureData,
        hasInitials: !!profileData.initialData,
        profileComplete: !!(
          profileData.address1 && 
          profileData.city && 
          profileData.state && 
          profileData.zipCode
        )
      });

      // Fetch signing sessions (job participants where user is a signer/witness)
      const sessionsRes = await fetch(`/api/job-participants/user/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        setSessions(sessionsData);
        
        const completedSessions = sessionsData.filter(
          (session: any) => session.sessionStatus === 'completed'
        ).length;
        
        // Fetch payment data (participant compensation)
        const participantPaymentsRes = await fetch(`/api/participant-payments/summary/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (participantPaymentsRes.ok) {
          const participantPaymentsData = await participantPaymentsRes.json();
          setPayments({
            totalReceived: participantPaymentsData.totalReceived || 0,
            pendingPayments: participantPaymentsData.pendingPayments || 0,
            completedSessions: participantPaymentsData.completedSessions || 0
          });
        } else {
          // Fallback to mock data if participant payments not implemented yet
          setPayments({
            totalReceived: 0,
            pendingPayments: 0,
            completedSessions: 0
          });
        }
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationComplete = (result: any) => {
    // Refresh the profile data to reflect verification status
    fetchDashboardData();
    setShowVerificationModal(false);
  };

  const handleVerificationFailed = (error: string) => {
    // Keep modal open so user can try again
    console.error('Verification failed:', error);
  };

  const getVerificationStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVerificationIcon = (status: string) => {
    switch (status) {
      case 'verified': return CheckCircle;
      case 'pending': return Clock;
      case 'failed': return XCircle;
      case 'rejected': return XCircle;
      default: return AlertCircle;
    }
  };

  const canJoinSessions = () => {
    return profile?.isVerified && profile?.profileComplete && profile?.accountSetupComplete;
  };

  const getSessionStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInviteStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'declined': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'signer': return PenTool;
      case 'witness': return UserCheck;
      case 'observer': return Eye;
      default: return User;
    }
  };

  const acceptInvitation = async (sessionId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/job-participants/${sessionId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchDashboardData(); // Refresh data
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
    }
  };

  const joinSession = async (sessionId: number, sessionToken: string) => {
    setLocation(`/signing/session/${sessionId}?token=${sessionToken}`);
  };

  const StatCard = ({ title, value, icon: Icon, description, alert }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${alert ? 'text-orange-500' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome, {profile?.fullName || 'User'}
        </h1>
        <div className="flex items-center space-x-4 mt-2">
          <p className="text-gray-600 capitalize">{profile?.role || 'Participant'}</p>
          {profile?.isVerified ? (
            <Badge variant="default" className="bg-green-100 text-green-800">
              <Shield className="h-3 w-3 mr-1" />
              Account Verified
            </Badge>
          ) : (
            <Badge variant="default" className={getVerificationStatusColor(profile?.verificationStatus || 'pending')}>
              {React.createElement(getVerificationIcon(profile?.verificationStatus || 'pending'), { className: "h-3 w-3 mr-1" })}
              {profile?.verificationStatus === 'pending' ? 'Verification Pending' : 
               profile?.verificationStatus === 'failed' ? 'Verification Failed' :
               profile?.verificationStatus === 'rejected' ? 'Verification Rejected' : 'Unverified'}
            </Badge>
          )}
        </div>
        
        {/* Account Setup Alert */}
        {!profile?.accountSetupComplete && (
          <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  Account setup incomplete
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Please complete your account setup to access signing sessions.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Verification Alert */}
        {profile?.accountSetupComplete && !profile?.isVerified && (
          <div className="mt-4 p-4 rounded-lg bg-orange-50 border border-orange-200">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-orange-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-800">
                  Account verification required
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  You must complete identity verification before joining any signing sessions.
                </p>
              </div>
              <Button 
                size="sm" 
                className="ml-auto"
                onClick={() => setActiveTab('verification')}
              >
                Verify Now
              </Button>
            </div>
          </div>
        )}
        
        {/* Profile Completion Alert */}
        {profile?.isVerified && !profile?.profileComplete && (
          <div className="mt-4 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Complete your profile to join signing sessions
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Address information is required before you can participate in signings.
                </p>
              </div>
              <Button 
                size="sm" 
                className="ml-auto"
                onClick={() => setActiveTab('profile')}
              >
                Complete Profile
              </Button>
            </div>
          </div>
        )}

        {/* Session Restriction Alert */}
        {!canJoinSessions() && (
          <div className="mt-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
            <div className="flex items-center">
              <Shield className="h-5 w-5 mr-2 text-gray-600" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Session access restricted
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Complete verification and profile setup to access signing sessions.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Button 
          onClick={() => setLocation('/signing/join')}
          className="h-16 flex flex-col items-center justify-center"
          disabled={!canJoinSessions()}
        >
          <FileText className="h-6 w-6 mb-2" />
          Start New Signing
        </Button>
        <Button 
          variant="outline"
          onClick={() => setLocation('/sessions')}
          className="h-16 flex flex-col items-center justify-center"
          disabled={!canJoinSessions()}
        >
          <ClipboardList className="h-6 w-6 mb-2" />
          Pending List of Jobs
        </Button>
        <Button 
          variant="outline"
          onClick={() => setActiveTab('profile')}
          className="h-16 flex flex-col items-center justify-center"
        >
          <User className="h-6 w-6 mb-2" />
          Profile Update
        </Button>
        <Button 
          variant="outline"
          onClick={() => setActiveTab('payments')}
          className="h-16 flex flex-col items-center justify-center"
        >
          <DollarSign className="h-6 w-6 mb-2" />
          Payments / Payouts
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="settings">Account</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Account Status"
              value={profile?.isVerified ? "Verified" : "Unverified"}
              icon={Shield}
              description="Account verification status"
              alert={!profile?.isVerified}
            />
            <StatCard
              title="Profile Status"
              value={profile?.profileComplete ? "Complete" : "Incomplete"}
              icon={User}
              description="Required for signing sessions"
              alert={!profile?.profileComplete}
            />
            <StatCard
              title="Completed Sessions"
              value={payments.completedSessions}
              icon={CheckCircle}
              description="Successfully completed"
            />
            <StatCard
              title="Pending Invitations"
              value={sessions.filter(s => s.inviteStatus === 'pending').length}
              icon={Clock}
              description="Awaiting your response"
            />
          </div>

          {/* Quick Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Profile Checklist */}
            <Card>
              <CardHeader>
                <CardTitle>Account Checklist</CardTitle>
                <CardDescription>Complete these items to participate in signings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Account Setup</span>
                  <CheckCircle className={`h-5 w-5 ${
                    profile?.accountSetupComplete ? 'text-green-500' : 'text-gray-300'
                  }`} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Identity Verification</span>
                  <CheckCircle className={`h-5 w-5 ${
                    profile?.isVerified ? 'text-green-500' : 'text-gray-300'
                  }`} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Address Information</span>
                  <CheckCircle className={`h-5 w-5 ${
                    profile?.profileComplete ? 'text-green-500' : 'text-gray-300'
                  }`} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Digital Signature</span>
                  <CheckCircle className={`h-5 w-5 ${
                    profile?.hasSignature ? 'text-green-500' : 'text-gray-300'
                  }`} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Initials</span>
                  <CheckCircle className={`h-5 w-5 ${
                    profile?.hasInitials ? 'text-green-500' : 'text-gray-300'
                  }`} />
                </div>
                
                {/* Overall Status */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Ready for Sessions</span>
                    {canJoinSessions() ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Ready
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">
                        <XCircle className="h-3 w-3 mr-1" />
                        Not Ready
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Sessions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Sessions</CardTitle>
                <CardDescription>Your latest signing sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sessions.slice(0, 3).map((session) => {
                    const RoleIcon = getRoleIcon(session.signerRole);
                    return (
                      <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <RoleIcon className="h-5 w-5 text-gray-600" />
                          <div>
                            <p className="font-medium text-sm">{session.titleCompany}</p>
                            <p className="text-xs text-gray-600">{session.propertyCity}, {session.propertyState}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={getSessionStatusColor(session.sessionStatus)}>
                            {session.sessionStatus}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                  {sessions.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No recent sessions</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Signing Sessions</h2>
              <p className="text-gray-600">Your signing appointments and invitations</p>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="space-y-0 divide-y">
                {sessions.map((session) => {
                  const RoleIcon = getRoleIcon(session.signerRole);
                  return (
                    <div key={session.id} className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <RoleIcon className="h-5 w-5 text-gray-600" />
                            <h3 className="font-semibold">{session.closingType}</h3>
                            <Badge className={getSessionStatusColor(session.sessionStatus)}>
                              {session.sessionStatus}
                            </Badge>
                            <Badge className={getInviteStatusColor(session.inviteStatus)}>
                              {session.inviteStatus}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                            <div className="flex items-center">
                              <MapPin className="h-4 w-4 mr-2" />
                              {session.propertyAddress}, {session.propertyCity}, {session.propertyState}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-2" />
                              {session.scheduledAt ? new Date(session.scheduledAt).toLocaleDateString() : 'Not scheduled'}
                            </div>
                            <div className="flex items-center">
                              <FileText className="h-4 w-4 mr-2" />
                              {session.documentsCount} document{session.documentsCount !== 1 ? 's' : ''}
                            </div>
                            <div className="flex items-center">
                              <UserCheck className="h-4 w-4 mr-2" />
                              {session.notaryName || 'Notary TBD'}
                            </div>
                          </div>

                          <div className="mt-3">
                            <span className="text-sm font-medium text-gray-700">
                              Role: <span className="capitalize">{session.signerRole.replace('_', ' ')}</span>
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setLocation(`/sessions/${session.id}`)}
                          >
                            View Details
                          </Button>
                          
                          {session.inviteStatus === 'pending' && (
                            <Button 
                              size="sm"
                              onClick={() => acceptInvitation(session.id)}
                              disabled={!canJoinSessions()}
                            >
                              Accept Invitation
                            </Button>
                          )}
                          
                          {session.sessionStatus === 'in_progress' && session.sessionToken && (
                            <Button 
                              size="sm"
                              onClick={() => joinSession(session.id, session.sessionToken)}
                              className="bg-green-600 hover:bg-green-700"
                              disabled={!canJoinSessions()}
                            >
                              Join Session
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {sessions.length === 0 && (
                  <div className="text-center py-12">
                    <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No sessions yet</h3>
                    <p className="text-gray-600">You'll receive invitations to signing sessions here.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Verification Tab */}
        <TabsContent value="verification" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Account Verification</h2>
              <p className="text-gray-600">Complete your identity verification to access signing sessions</p>
            </div>
          </div>

          {/* Current Verification Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Verification Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {React.createElement(getVerificationIcon(profile?.verificationStatus || 'pending'), { 
                    className: `h-6 w-6 ${profile?.isVerified ? 'text-green-600' : 'text-orange-600'}` 
                  })}
                  <div>
                    <p className="font-medium">
                      {profile?.isVerified ? 'Account Verified' : 
                       profile?.verificationStatus === 'pending' ? 'Verification Pending' : 
                       profile?.verificationStatus === 'failed' ? 'Verification Failed' :
                       profile?.verificationStatus === 'rejected' ? 'Verification Rejected' : 'Verification Required'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {profile?.isVerified ? 
                        'Your identity has been verified. You can now join signing sessions.' :
                        'Identity verification is required before you can participate in signing sessions.'
                      }
                    </p>
                  </div>
                </div>
                <Badge className={getVerificationStatusColor(profile?.verificationStatus || 'pending')}>
                  {profile?.verificationStatus || 'pending'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Verification Process */}
          {!profile?.isVerified && (
            <EVSVerification
              userId={profile?.id || 0}
              onVerificationComplete={handleVerificationComplete}
              onVerificationFailed={handleVerificationFailed}
            />
          )}

          {/* Help Section */}
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Why is verification required?</h4>
                  <p className="text-sm text-gray-600">
                    Identity verification ensures the security and legal validity of document signing sessions. 
                    All participants must be verified before joining any notarization process.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">What documents do I need?</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Government-issued photo ID (Driver's License, Passport, or State ID)</li>
                    <li>• Clear selfie photo for face matching</li>
                    <li>• Good lighting and clear image quality</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">How long does verification take?</h4>
                  <p className="text-sm text-gray-600">
                    Most verifications are completed within 30-60 seconds. In some cases, 
                    manual review may be required which can take up to 24 hours.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Complete your profile to participate in signing sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Personal Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Full Name</label>
                      <p className="text-sm text-gray-600">{profile?.fullName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Email</label>
                      <p className="text-sm text-gray-600">{profile?.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Phone</label>
                      <p className="text-sm text-gray-600">{profile?.phoneNumber || 'Not provided'}</p>
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Address Information *</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Address</label>
                      <p className="text-sm text-gray-600">
                        {profile?.address1 ? (
                          <>
                            {profile.address1}
                            {profile.address2 && <><br />{profile.address2}</>}
                          </>
                        ) : (
                          <span className="text-orange-600">Required for signing sessions</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">City, State, ZIP</label>
                      <p className="text-sm text-gray-600">
                        {profile?.city && profile?.state && profile?.zipCode ? (
                          `${profile.city}, ${profile.state} ${profile.zipCode}`
                        ) : (
                          <span className="text-orange-600">Required for signing sessions</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ID Verification Status */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-semibold text-lg mb-4">Identity Verification</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">ID Type</label>
                    <p className="text-sm text-gray-600">
                      {profile?.idType ? profile.idType.replace('_', ' ').toUpperCase() : 'Not verified'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Verification Status</label>
                    <div className="flex items-center space-x-2">
                      {profile?.idVerified ? (
                        <Badge className="bg-green-100 text-green-800">Verified</Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-800">Pending</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Digital Signatures */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-semibold text-lg mb-4">Digital Signatures</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <span>Signature</span>
                    <CheckCircle className={`h-5 w-5 ${
                      profile?.hasSignature ? 'text-green-500' : 'text-gray-300'
                    }`} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Initials</span>
                    <CheckCircle className={`h-5 w-5 ${
                      profile?.hasInitials ? 'text-green-500' : 'text-gray-300'
                    }`} />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t">
                <Button 
                  onClick={() => setLocation(`/profile/edit`)}
                  className="w-full md:w-auto"
                >
                  Update Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-6">
          {/* Payment Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Total Received"
              value={`$${payments.totalReceived.toFixed(2)}`}
              icon={DollarSign}
              description="All time earnings"
            />
            <StatCard
              title="Pending Payments"
              value={`$${payments.pendingPayments.toFixed(2)}`}
              icon={Clock}
              description="Awaiting processing"
            />
            <StatCard
              title="Completed Sessions"
              value={payments.completedSessions}
              icon={CheckCircle}
              description="Sessions with compensation"
            />
          </div>

          {/* Payment Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Compensation Structure</CardTitle>
                <CardDescription>How you get paid for participation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <PenTool className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-blue-900">Primary Signer</p>
                        <p className="text-sm text-blue-700">For signing documents</p>
                      </div>
                    </div>
                    <span className="font-bold text-blue-900">$15.00</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <UserCheck className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-900">Witness</p>
                        <p className="text-sm text-green-700">For witnessing signatures</p>
                      </div>
                    </div>
                    <span className="font-bold text-green-900">$10.00</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Eye className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="font-medium text-purple-900">Observer</p>
                        <p className="text-sm text-purple-700">For session observation</p>
                      </div>
                    </div>
                    <span className="font-bold text-purple-900">$5.00</span>
                  </div>
                  <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">Bonus Pay</span>
                    </div>
                    <p className="text-xs text-amber-700 mt-1">
                      +$2.50 per 15 minutes for sessions over 45 minutes
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Schedule</CardTitle>
                <CardDescription>When you receive your payments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-xs font-bold text-blue-600">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Session Completion</p>
                      <p className="text-sm text-gray-600">Payment is created when your session ends</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-xs font-bold text-amber-600">2</span>
                    </div>
                    <div>
                      <p className="font-medium">24-Hour Hold</p>
                      <p className="text-sm text-gray-600">Payment is held for quality review</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-xs font-bold text-green-600">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Payout Processing</p>
                      <p className="text-sm text-gray-600">Funds are transferred to your account</p>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Typical Timeline</span>
                    </div>
                    <p className="text-xs text-green-700 mt-1">
                      Payments typically arrive within 1-3 business days
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment History Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>Your recent payment transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No payment history yet</h3>
                <p className="text-gray-600">Your payment transactions will appear here after completing sessions.</p>
                {!canJoinSessions() && (
                  <div className="mt-4">
                    <Button onClick={() => setActiveTab('verification')} size="sm">
                      Complete Verification to Get Started
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Management</CardTitle>
              <CardDescription>Manage your account settings and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">Account Settings</h3>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <User className="h-4 w-4 mr-2" />
                      Update Profile
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Change Password
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Notification Preferences
                    </Button>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold">Verification & Security</h3>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <Shield className="h-4 w-4 mr-2" />
                      ID Verification
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <PenTool className="h-4 w-4 mr-2" />
                      Manage Signatures
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Privacy Settings
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 