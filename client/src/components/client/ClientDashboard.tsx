import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  ClipboardList, 
  DollarSign, 
  Settings,
  Calendar,
  CheckCircle,
  Clock,
  MapPin,
  Building2,
  User,
  CreditCard,
  Plus,
  FileUp,
  Users,
  Shield,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { EVSVerification } from '@/components/verification/evs-verification';

interface ClientProfile {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
  companyId?: number;
  companyRole?: string;
  isVerified?: boolean;
  verificationStatus?: string;
  accountSetupComplete?: boolean;
  company?: {
    id: number;
    companyName: string;
    contactName: string;
    paymentMethod: string;
  };
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
  totalCost: number;
  paymentStatus: string;
  createdAt: string;
}

interface PaymentSummary {
  totalSpent: number;
  monthlySpent: number;
  pendingPayments: number;
  completedJobs: number;
  averageCost: number;
}

export function ClientDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [payments, setPayments] = useState<PaymentSummary>({
    totalSpent: 0,
    monthlySpent: 0,
    pendingPayments: 0,
    completedJobs: 0,
    averageCost: 0
  });
  const [loading, setLoading] = useState(true);
  const [showVerification, setShowVerification] = useState(false);

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
      setProfile({
        ...profileData,
        isVerified: profileData.isVerified || false,
        verificationStatus: profileData.verificationStatus || 'pending',
        accountSetupComplete: profileData.accountSetupComplete || false,
      });

      // Fetch jobs
      const jobsRes = await fetch('/api/jobs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const jobsData = await jobsRes.json();
      setJobs(jobsData);

      // Fetch payment data
      const paymentsRes = await fetch(`/api/payments/user/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        // Calculate payment summaries for client (money spent, not earned)
        const totalSpent = paymentsData.reduce((sum: number, payment: any) => 
          payment.payerId === user.id && payment.status === 'completed' ? sum + payment.amount : sum, 0) / 100;
        
        const completedJobs = jobsData.filter((job: any) => job.jobStatus === 'completed').length;
        
        setPayments({
          totalSpent,
          monthlySpent: totalSpent, // TODO: Calculate current month
          pendingPayments: paymentsData.filter((p: any) => p.payerId === user.id && p.status === 'pending').length,
          completedJobs,
          averageCost: completedJobs > 0 ? totalSpent / completedJobs : 0
        });
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationComplete = (result: any) => {
    fetchDashboardData(); // Refresh profile
    setShowVerification(false);
  };

  const handleVerificationFailed = (error: string) => {
    console.error('Verification failed:', error);
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

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const StatCard = ({ title, value, icon: Icon, description, trend, color = "blue" }: any) => {
    const colorClasses = {
      blue: "from-blue-500 to-blue-600",
      green: "from-green-500 to-green-600",
      purple: "from-blue-500 to-blue-600",
      orange: "from-orange-500 to-orange-600",
      red: "from-red-500 to-red-600",
      indigo: "from-indigo-500 to-indigo-600"
    };

    return (
      <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-gray-900">{value}</p>
                {trend && (
                  <div className="text-sm font-medium text-green-600">
                    {trend}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">{description}</p>
            </div>
            <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} shadow-lg`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </CardContent>
        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${colorClasses[color]}`} />
      </Card>
    );
  };

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
          Welcome, {profile?.fullName || 'Client'}
        </h1>
        <div className="flex items-center space-x-4 mt-2">
          <p className="text-gray-600">
            {profile?.company ? `${profile.company.companyName}` : 'Independent Client'}
          </p>
          {profile?.companyRole && (
            <Badge variant="outline">{profile.companyRole}</Badge>
          )}
          {profile?.isVerified ? (
            <Badge variant="default" className="bg-green-100 text-green-800">
              <Shield className="h-3 w-3 mr-1" />
              ID Verified
            </Badge>
          ) : (
            <Badge variant="default" className="bg-orange-100 text-orange-800">
              <AlertCircle className="h-3 w-3 mr-1" />
              Verification Required
            </Badge>
          )}
        </div>
      </div>

      {/* Verification Alert */}
      {!profile?.isVerified && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>ID Verification Required:</strong> To participate in document signing sessions, you must complete identity verification.
            <Button 
              size="sm" 
              className="ml-2"
              onClick={() => setShowVerification(true)}
            >
              Verify Now
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ID Verification Modal/Component */}
      {showVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">ID Verification Required</h2>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowVerification(false)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-4">
              <EVSVerification
                userId={profile?.id || 0}
                onVerificationComplete={handleVerificationComplete}
                onVerificationFailed={handleVerificationFailed}
              />
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Button 
          onClick={() => setLocation('/jobs/create')}
          className="h-16 flex flex-col items-center justify-center"
        >
          <Plus className="h-6 w-6 mb-2" />
          Start New Signing
        </Button>
        <Button 
          variant="outline"
          onClick={() => setLocation('/jobs')}
          className="h-16 flex flex-col items-center justify-center"
        >
          <ClipboardList className="h-6 w-6 mb-2" />
          My Jobs
        </Button>
        <Button 
          variant="outline"
          onClick={() => setActiveTab('payments')}
          className="h-16 flex flex-col items-center justify-center"
        >
          <DollarSign className="h-6 w-6 mb-2" />
          Payments
        </Button>
        <Button 
          variant="outline"
          onClick={() => profile?.isVerified ? setActiveTab('settings') : setShowVerification(true)}
          className="h-16 flex flex-col items-center justify-center"
        >
          {profile?.isVerified ? (
            <>
              <Settings className="h-6 w-6 mb-2" />
              Account
            </>
          ) : (
            <>
              <Shield className="h-6 w-6 mb-2" />
              Verify ID
            </>
          )}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="jobs">My Jobs</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="settings">Account</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Spent"
              value={`$${payments.totalSpent.toFixed(2)}`}
              icon={DollarSign}
              description="All time expenses"
              color="indigo"
            />
            <StatCard
              title="This Month"
              value={`$${payments.monthlySpent.toFixed(2)}`}
              icon={DollarSign}
              description="Current month expenses"
              color="blue"
            />
            <StatCard
              title="Completed Signings"
              value={payments.completedJobs}
              icon={CheckCircle}
              description="Successfully completed"
              color="green"
            />
            <StatCard
              title="Pending Payments"
              value={payments.pendingPayments}
              icon={Clock}
              description="Awaiting payment"
              color={payments.pendingPayments > 3 ? "red" : "orange"}
            />
          </div>

          {/* Quick Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Account Status */}
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Your account details and status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Account Type</span>
                  <Badge variant="default">
                    {profile?.company ? 'Company User' : 'Independent Client'}
                  </Badge>
                </div>
                {profile?.company && (
                  <>
                    <div className="flex items-center justify-between">
                      <span>Company</span>
                      <span className="text-sm">{profile.company.companyName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Payment Method</span>
                      <span className="text-sm capitalize">{profile.company.paymentMethod}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span>Average Cost</span>
                  <span className="text-sm">${payments.averageCost.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Recent Jobs */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Signings</CardTitle>
                <CardDescription>Your latest notarization requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {jobs.slice(0, 3).map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{job.closingType}</p>
                        <p className="text-xs text-gray-600">{job.propertyCity}, {job.propertyState}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(job.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={getJobStatusColor(job.jobStatus)}>
                          {job.jobStatus}
                        </Badge>
                        {job.totalCost > 0 && (
                          <p className="text-xs text-gray-600 mt-1">${job.totalCost.toFixed(2)}</p>
                        )}
                      </div>
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

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">My Signing Jobs</h2>
              <p className="text-gray-600">Manage your notarization requests</p>
            </div>
            <Button onClick={() => setLocation('/jobs/create')}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Job
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="space-y-0 divide-y">
                {jobs.map((job) => (
                  <div key={job.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold">{job.closingType}</h3>
                          <Badge className={getJobStatusColor(job.jobStatus)}>
                            {job.jobStatus}
                          </Badge>
                          {job.paymentStatus && (
                            <Badge className={getPaymentStatusColor(job.paymentStatus)}>
                              {job.paymentStatus}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Building2 className="h-4 w-4 mr-2" />
                            {job.titleCompany}
                          </div>
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-2" />
                            {job.propertyAddress}, {job.propertyCity}, {job.propertyState}
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-2" />
                            {job.scheduledAt ? new Date(job.scheduledAt).toLocaleDateString() : 'Not scheduled'}
                          </div>
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-2" />
                            {job.signerCount} signer{job.signerCount !== 1 ? 's' : ''}
                          </div>
                          <div className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-2" />
                            {job.totalCost > 0 ? `$${job.totalCost.toFixed(2)}` : 'Pending pricing'}
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-2" />
                            Created {new Date(job.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setLocation(`/jobs/${job.id}`)}
                        >
                          View Details
                        </Button>
                        {job.jobStatus === 'open' && (
                          <Button 
                            size="sm"
                            onClick={() => setLocation(`/jobs/${job.id}/edit`)}
                          >
                            Edit
                          </Button>
                        )}
                        {job.jobStatus === 'completed' && (
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => setLocation(`/jobs/${job.id}/documents`)}
                          >
                            Download Docs
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {jobs.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No jobs yet</h3>
                    <p className="text-gray-600 mb-4">Get started by creating your first signing job.</p>
                    <Button onClick={() => setLocation('/jobs/create')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Job
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-6">
          {/* Payment Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Total Spent"
              value={`$${payments.totalSpent.toFixed(2)}`}
              icon={DollarSign}
              description="All time"
            />
            <StatCard
              title="Average per Job"
              value={`$${payments.averageCost.toFixed(2)}`}
              icon={DollarSign}
              description="Per completed job"
            />
            <StatCard
              title="Pending Payments"
              value={payments.pendingPayments}
              icon={Clock}
              description="Awaiting processing"
            />
          </div>

          {/* Payment Method & History */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
                <CardDescription>Your payment preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {profile?.company ? (
                    <div>
                      <p className="text-sm text-gray-600">Company Payment Method:</p>
                      <p className="font-medium capitalize">{profile.company.paymentMethod}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Managed by {profile.company.companyName}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full justify-start">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Add Payment Method
                      </Button>
                      <p className="text-xs text-gray-500">
                        Add a credit card or bank account for payments
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>Recent transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6">
                  <CreditCard className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Payment history will appear here</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Account Settings</h2>
            <p className="text-gray-600">Manage your account information and verification status</p>
          </div>

          {/* Verification Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                ID Verification Status
              </CardTitle>
              <CardDescription>
                Identity verification is required to participate in document signing sessions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Current Status</span>
                {profile?.isVerified ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                ) : (
                  <Badge className="bg-orange-100 text-orange-800">
                    <Clock className="h-3 w-3 mr-1" />
                    {profile?.verificationStatus === 'pending' ? 'Pending' : 'Required'}
                  </Badge>
                )}
              </div>
              
              {!profile?.isVerified && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-orange-900">Verification Required</h4>
                      <p className="text-sm text-orange-800 mt-1">
                        Complete ID verification to access all features and participate in signing sessions.
                      </p>
                      <Button 
                        size="sm" 
                        className="mt-3"
                        onClick={() => setShowVerification(true)}
                      >
                        Start Verification
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {profile?.isVerified && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-900">Identity Verified</h4>
                      <p className="text-sm text-green-800 mt-1">
                        Your identity has been successfully verified. You can now participate in all signing sessions.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 space-y-1">
                <p><strong>Required Documents:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Government-issued photo ID (Driver's License, State ID, or Passport)</li>
                  <li>Clear selfie for face matching verification</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Management</CardTitle>
              <CardDescription>Manage your account settings and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">Profile Settings</h3>
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
                  <h3 className="font-semibold">Documents & Billing</h3>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <FileUp className="h-4 w-4 mr-2" />
                      Upload Documents
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Billing Information
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <ClipboardList className="h-4 w-4 mr-2" />
                      Download Invoices
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Information (if applicable) */}
          {profile?.company && (
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>Your company association details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Company Name</label>
                    <p className="text-sm text-gray-600">{profile.company.companyName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Your Role</label>
                    <p className="text-sm text-gray-600 capitalize">{profile.companyRole || 'User'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Contact Person</label>
                    <p className="text-sm text-gray-600">{profile.company.contactName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Payment Method</label>
                    <p className="text-sm text-gray-600 capitalize">{profile.company.paymentMethod}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 