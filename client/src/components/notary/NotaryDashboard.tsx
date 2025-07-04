import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  TrendingUp,
  Shield
} from 'lucide-react';
import { NotaryApprovalQueue } from './NotaryApprovalQueue';
import { ParticipantVerificationManager } from './ParticipantVerificationManager';

interface NotaryProfile {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
  notaryType: string;
  notaryIdCode: string;
  approvalStatus: string;
  isActive: boolean;
  
  // Notary specific fields
  nameOnCommission: string;
  commissionNumber: string;
  commissionExpiration: string;
  state: string;
  county: string;
  isNotarySigningAgent: boolean;
  isSpanishSpeaking: boolean;
  foreignLanguages: string[];
  signingAgentCertified: boolean;
  
  // Status indicators
  hasCommissionFile: boolean;
  hasEOInsurance: boolean;
  hasBond: boolean;
  hasPublicCertificate: boolean;
}

interface JobSummary {
  id: number;
  titleCompany: string;
  closingType: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  scheduledAt: string;
  jobStatus: string;
  signerCount: number;
  requiresNSA: boolean;
  requiresSpanish: boolean;
}

interface PaymentSummary {
  totalEarnings: number;
  monthlyEarnings: number;
  pendingPayments: number;
  completedJobs: number;
  averagePayment: number;
}

export function NotaryDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState<NotaryProfile | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [payments, setPayments] = useState<PaymentSummary>({
    totalEarnings: 0,
    monthlyEarnings: 0,
    pendingPayments: 0,
    completedJobs: 0,
    averagePayment: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Fetch notary profile
      const profileRes = await fetch(`/api/users/${user.id}/profile/comprehensive`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!profileRes.ok) {
        throw new Error(`Profile API error: ${profileRes.status} ${profileRes.statusText}`);
      }
      
      const profileData = await profileRes.json();
      setProfile(profileData);

      // Fetch jobs
      const jobsRes = await fetch('/api/jobs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!jobsRes.ok) {
        throw new Error(`Jobs API error: ${jobsRes.status} ${jobsRes.statusText}`);
      }
      
      const jobsData = await jobsRes.json();
      setJobs(jobsData);

      // Fetch payment data
      const paymentsRes = await fetch(`/api/payments/user/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        // Calculate payment summaries
        const totalEarnings = paymentsData.reduce((sum: number, payment: any) => 
          payment.status === 'completed' ? sum + payment.amount : sum, 0) / 100;
        
        const completedJobs = jobsData.filter((job: any) => job.jobStatus === 'completed').length;
        
        setPayments({
          totalEarnings,
          monthlyEarnings: totalEarnings, // TODO: Calculate current month
          pendingPayments: paymentsData.filter((p: any) => p.status === 'pending').length,
          completedJobs,
          averagePayment: completedJobs > 0 ? totalEarnings / completedJobs : 0
        });
      } else {
        console.warn('Payments API not available:', paymentsRes.status);
        // Set default payment data if payments API fails
        setPayments({
          totalEarnings: 0,
          monthlyEarnings: 0,
          pendingPayments: 0,
          completedJobs: 0,
          averagePayment: 0
        });
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Set default values to prevent UI breakage
      setJobs([]);
      setPayments({
        totalEarnings: 0,
        monthlyEarnings: 0,
        pendingPayments: 0,
        completedJobs: 0,
        averagePayment: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getApprovalStatusMessage = () => {
    if (!profile) return '';
    
    switch (profile.approvalStatus) {
      case 'pending':
        return 'Your notary profile is pending admin approval. You cannot accept jobs until approved.';
      case 'requires_update':
        return 'Your profile requires updates. Please review and update your information.';
      case 'rejected':
        return 'Your notary application was rejected. Please contact support for details.';
      case 'approved':
        return profile.isActive ? '' : 'Your account is approved but inactive. Please contact support.';
      default:
        return '';
    }
  };

  const StatCard = ({ title, value, icon: Icon, description, trend }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <div className="text-xs text-green-600 flex items-center mt-1">
            <TrendingUp className="h-3 w-3 mr-1" />
            {trend}
          </div>
        )}
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
          Welcome back, {profile?.fullName || 'Notary'}
        </h1>
        <p className="text-gray-600 mt-2">
          {profile?.notaryType === 'contractor' ? 'USA Notary Contractor' : 'Subscriber Notary'} • {profile?.state}
        </p>
        
        {/* Status Alert */}
        {getApprovalStatusMessage() && (
          <div className={`mt-4 p-4 rounded-lg ${
            profile?.approvalStatus === 'approved' ? 'bg-green-50 border border-green-200' :
            profile?.approvalStatus === 'rejected' ? 'bg-red-50 border border-red-200' :
            'bg-yellow-50 border border-yellow-200'
          }`}>
            <div className="flex items-center">
              <AlertCircle className={`h-5 w-5 mr-2 ${
                profile?.approvalStatus === 'approved' ? 'text-green-600' :
                profile?.approvalStatus === 'rejected' ? 'text-red-600' :
                'text-yellow-600'
              }`} />
              <p className="text-sm font-medium">{getApprovalStatusMessage()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Button 
          onClick={() => setLocation('/create-job')}
          className="h-16 flex flex-col items-center justify-center"
          disabled={profile?.approvalStatus !== 'approved' || !profile?.isActive}
        >
          <FileText className="h-6 w-6 mb-2" />
          Start New Signing
        </Button>
        <Button 
          variant="outline"
          onClick={() => setLocation('/jobs')}
          className="h-16 flex flex-col items-center justify-center"
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
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="verifications">Verifications</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="settings">Account</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Earnings"
              value={`$${payments.totalEarnings.toFixed(2)}`}
              icon={DollarSign}
              description="All time earnings"
            />
            <StatCard
              title="This Month"
              value={`$${payments.monthlyEarnings.toFixed(2)}`}
              icon={TrendingUp}
              description="Current month earnings"
              trend="+15% from last month"
            />
            <StatCard
              title="Completed Jobs"
              value={payments.completedJobs}
              icon={CheckCircle}
              description="Successfully completed"
            />
            <StatCard
              title="Pending Payments"
              value={payments.pendingPayments}
              icon={Clock}
              description="Awaiting payment"
            />
          </div>

          {/* Quick Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Profile Status */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Status</CardTitle>
                <CardDescription>Your notary credentials and status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Approval Status</span>
                  <Badge className={
                    profile?.approvalStatus === 'approved' ? 'bg-green-100 text-green-800' :
                    profile?.approvalStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }>
                    {profile?.approvalStatus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Commission Expires</span>
                  <span className="text-sm">{profile?.commissionExpiration || 'Not set'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>NSA Certified</span>
                  <Badge variant={profile?.isNotarySigningAgent ? 'default' : 'secondary'}>
                    {profile?.isNotarySigningAgent ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Spanish Speaking</span>
                  <Badge variant={profile?.isSpanishSpeaking ? 'default' : 'secondary'}>
                    {profile?.isSpanishSpeaking ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Recent Jobs */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Jobs</CardTitle>
                <CardDescription>Your latest signing appointments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {jobs.slice(0, 3).map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{job.titleCompany}</p>
                        <p className="text-xs text-gray-600">{job.propertyCity}, {job.propertyState}</p>
                      </div>
                      <Badge className={getJobStatusColor(job.jobStatus)}>
                        {job.jobStatus}
                      </Badge>
                    </div>
                  ))}
                  {jobs.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No recent jobs</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals" className="space-y-6">
          <NotaryApprovalQueue />
        </TabsContent>

        {/* Verifications Tab */}
        <TabsContent value="verifications" className="space-y-6">
          <ParticipantVerificationManager />
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Jobs</CardTitle>
              <CardDescription>Manage your assigned and available jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div key={job.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold">{job.titleCompany}</h3>
                          <Badge className={getJobStatusColor(job.jobStatus)}>
                            {job.jobStatus}
                          </Badge>
                          {job.requiresNSA && (
                            <Badge variant="outline">NSA Required</Badge>
                          )}
                          {job.requiresSpanish && (
                            <Badge variant="outline">Spanish</Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-2" />
                            {job.propertyAddress}, {job.propertyCity}, {job.propertyState}
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-2" />
                            {job.scheduledAt ? new Date(job.scheduledAt).toLocaleDateString() : 'Not scheduled'}
                          </div>
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 mr-2" />
                            {job.closingType}
                          </div>
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-2" />
                            {job.signerCount} signer{job.signerCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setLocation(`/jobs`)}
                        >
                          View Details
                        </Button>
                        {job.jobStatus === 'pending' && (
                          <Button 
                            size="sm"
                            disabled
                            title="Live signing functionality is being rebuilt"
                          >
                            Start Signing
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {jobs.length === 0 && (
                  <div className="text-center py-8">
                    <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No jobs assigned</h3>
                    <p className="text-gray-600">Jobs will appear here when they are assigned to you.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notary Profile</CardTitle>
              <CardDescription>Manage your notary credentials and information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Basic Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Notary ID Code</label>
                      <p className="text-sm text-gray-600 font-mono">{profile?.notaryIdCode || 'Not assigned'}</p>
                    </div>
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
                      <p className="text-sm text-gray-600">{profile?.phoneNumber}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">State</label>
                      <p className="text-sm text-gray-600">{profile?.state}</p>
                    </div>
                  </div>
                </div>

                {/* Notary Credentials */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Notary Credentials</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Commission Number</label>
                      <p className="text-sm text-gray-600">{profile?.commissionNumber || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Commission Expires</label>
                      <p className="text-sm text-gray-600">{profile?.commissionExpiration || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">County</label>
                      <p className="text-sm text-gray-600">{profile?.county || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Languages</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {profile?.foreignLanguages?.map((lang) => (
                          <Badge key={lang} variant="outline">{lang}</Badge>
                        ))}
                        {(!profile?.foreignLanguages || profile.foreignLanguages.length === 0) && (
                          <span className="text-sm text-gray-600">None specified</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t">
                <Button 
                  onClick={() => setLocation(`/profile`)}
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
              title="Total Earnings"
              value={`$${payments.totalEarnings.toFixed(2)}`}
              icon={DollarSign}
              description="All time"
            />
            <StatCard
              title="Average per Job"
              value={`$${payments.averagePayment.toFixed(2)}`}
              icon={TrendingUp}
              description="Per completed job"
            />
            <StatCard
              title="Pending Payments"
              value={payments.pendingPayments}
              icon={Clock}
              description="Awaiting processing"
            />
          </div>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>Your payment transactions and payouts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">Payment history coming soon</h3>
                  <p className="text-gray-600">Detailed payment tracking will be available here.</p>
                </div>
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
                      Change Password
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Notification Preferences
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Calendar Integration
                    </Button>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold">Documents & Compliance</h3>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      Upload Documents
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Renewal Reminders
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Compliance Status
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