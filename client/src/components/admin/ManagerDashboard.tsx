import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { 
  Briefcase, 
  Users, 
  FileText, 
  Calendar, 
  Settings, 
  PlusCircle,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Building2,
  Eye,
  UserCheck,
  Target,
  BarChart3,
  Shield,
  Bell,
  User,
  UserPlus,
  Plus,
  RefreshCw,
  CreditCard,
  Code
} from 'lucide-react';
import { type Job } from '@shared/types';
import { getStatusColor, isMobileDevice } from '@/lib/utils';
import ManagerManagement from '@/components/company/ManagerManagement';

interface ManagerStats {
  totalJobs: number;
  pendingJobs: number;
  completedJobs: number;
  openJobs: number;
  monthlyRevenue: number;
  totalUsers: number;
  activeNotaries: number;
  pendingInvitations: number;
}

interface CompanyAssociations {
  success: boolean;
  directCompany: {
    id: number;
    companyName: string;
  } | null;
  managerCompanies: Array<{
    companyId: number;
    companyName: string;
    managerRole: string;
    status: string;
    isActive: boolean;
    isPrimary: boolean;
  }>;
  primaryCompany: {
    id: number;
    companyName: string;
  } | null;
  hasManagerAccess: boolean;
  canCreateCompany: boolean;
}

export function TitleCompanyDashboard() {
  const { user } = useAuth();
  const [signingJobs, setSigningJobs] = useState<any[]>([]);
  
  // Company settings form state
  const [companySettings, setCompanySettings] = useState({
    companyName: '',
    contactEmail: '',
    phoneNumber: '',
    website: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: ''
  });
  const [isUpdatingCompany, setIsUpdatingCompany] = useState(false);
  
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<ManagerStats>({
    queryKey: ['/api/dashboard/stats'],
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const { data: jobsResponse, isLoading: jobsLoading, error: jobsError } = useQuery<{
    jobs: Job[];
    totalCount: number;
    hasMore: boolean;
    currentPage: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['/api/jobs'],
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Query for company associations
  const { data: companyAssociations, isLoading: associationsLoading, error: associationsError, refetch: refetchAssociations } = useQuery<CompanyAssociations>({
    queryKey: ['/api/companies/my-associations'],
    enabled: Boolean(user?.role === 'title_company' || user?.role === 'company_manager'),
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Determine which company to use (primary company or direct company)
  const selectedCompany = companyAssociations?.primaryCompany || companyAssociations?.directCompany;

  // Query for company details if user has company association
  const { data: companyData, isLoading: companyLoading } = useQuery({
    queryKey: ['/api/companies', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      const response = await fetch(`/api/companies/${selectedCompany.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch company details');
      return response.json();
    },
    enabled: Boolean(selectedCompany?.id),
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const getJobStatus = (job: any): string => job?.jobStatus || job?.job_status || job?.status || 'open';

  // Handle company information update
  const handleUpdateCompanyInfo = async () => {
    if (!selectedCompany?.id) {
      alert('No company found to update');
      return;
    }

    setIsUpdatingCompany(true);
    try {
      const response = await fetch(`/api/companies/${selectedCompany.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(companySettings)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update company information');
      }

      const updatedCompany = await response.json();
      
      // Refetch the company data to update the UI
      window.location.reload(); // Simple refresh for now
      
      alert('Company information updated successfully!');
    } catch (error) {
      console.error('Error updating company information:', error);
      alert(error instanceof Error ? error.message : 'Failed to update company information');
    } finally {
      setIsUpdatingCompany(false);
    }
  };

  // Populate company settings form when data is loaded
  useEffect(() => {
    if (companyData) {
      setCompanySettings({
        companyName: companyData.companyName || '',
        contactEmail: companyData.contactEmail || '',
        phoneNumber: companyData.phoneNumber || '',
        website: companyData.website || '',
        address1: companyData.address1 || '',
        address2: companyData.address2 || '',
        city: companyData.city || '',
        state: companyData.state || '',
        zipCode: companyData.zipCode || ''
      });
    } else if (selectedCompany && !companyLoading) {
      // If we have basic company info from associations but no detailed data
      setCompanySettings(prev => ({
        ...prev,
        companyName: selectedCompany.companyName || '',
      }));
    }
  }, [companyData, selectedCompany, companyLoading]);

  // Fetch signing assignments for dual role users
  useEffect(() => {
    const fetchSigningJobs = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await fetch('/api/jobs/signing-assignments', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setSigningJobs(data.jobs || []);
        }
      } catch (error) {
        console.warn('Error fetching signing assignments:', error);
        setSigningJobs([]);
      }
    };

    fetchSigningJobs();
  }, []);

  // Safely extract jobs array from response and ensure it's always an array
  const recentJobs = Array.isArray(jobsResponse?.jobs) ? jobsResponse.jobs : [];
  const recentJobsSlice = recentJobs.slice(0, 5);

  // Show error alerts if API calls fail
  if (statsError || jobsError) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Title Company Dashboard</h1>
        {statsError && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Stats Error:</strong> Unable to load dashboard statistics. Please refresh the page or contact support.
            </AlertDescription>
          </Alert>
        )}
        {jobsError && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Jobs Error:</strong> Unable to load recent jobs. Please refresh the page or contact support.
            </AlertDescription>
          </Alert>
        )}
        <Button 
          onClick={() => window.location.reload()} 
          className="mt-4"
        >
          Refresh Page
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Title Company Dashboard
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-gray-600">Welcome back, {user?.username}</p>
              <Badge variant="default" className="bg-blue-100 text-blue-800">
                <Building2 className="h-3 w-3 mr-1" />
                Title Company
              </Badge>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <Link to="/jobs">
                <Eye className="h-4 w-4 mr-2" />
                View All Orders
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/user-management">
                <Users className="h-4 w-4 mr-2" />
                Manage Users
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/create-job">
                <PlusCircle className="h-4 w-4 mr-2" />
                Create New Order
              </Link>
            </Button>
          </div>
        </div>

        {/* Dashboard Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-1">
          <Tabs defaultValue="overview" className="space-y-8">
            <TabsList className="grid w-full grid-cols-3 h-14 bg-gray-50 rounded-lg p-1.5 gap-1">
              <TabsTrigger 
                value="overview" 
                className="flex items-center gap-3 h-11 px-6 text-base font-semibold transition-all duration-200 
                          data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-md
                          data-[state=active]:border data-[state=active]:border-blue-200
                          hover:bg-white/50 hover:text-gray-700 text-gray-600
                          rounded-md"
              >
                <BarChart3 className="h-5 w-5" />
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="managers" 
                className="flex items-center gap-3 h-11 px-6 text-base font-semibold transition-all duration-200
                          data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-md
                          data-[state=active]:border data-[state=active]:border-blue-200
                          hover:bg-white/50 hover:text-gray-700 text-gray-600
                          rounded-md"
              >
                <UserPlus className="h-5 w-5" />
                Managers
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="flex items-center gap-3 h-11 px-6 text-base font-semibold transition-all duration-200
                          data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-md
                          data-[state=active]:border data-[state=active]:border-blue-200
                          hover:bg-white/50 hover:text-gray-700 text-gray-600
                          rounded-md"
              >
                <Settings className="h-5 w-5" />
                Settings
              </TabsTrigger>
            </TabsList>

          <TabsContent value="overview" className="space-y-6 pt-2">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <div className="text-3xl font-bold text-gray-900 mt-2">
                    {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.totalJobs || 0}
                  </div>
                </div>
                <Briefcase className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Orders</p>
                  <div className="text-3xl font-bold text-gray-900 mt-2">
                    {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.pendingJobs || 0}
                  </div>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <div className="text-3xl font-bold text-gray-900 mt-2">
                    {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.completedJobs || 0}
                  </div>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Notaries</p>
                  <div className="text-3xl font-bold text-gray-900 mt-2">
                    {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.activeNotaries || 0}
                  </div>
                </div>
                <UserCheck className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders Section */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Recent Orders
              </CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link to="/jobs">
                  View All Orders
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jobsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))
              ) : recentJobsSlice.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
                  <p className="text-gray-600 mb-4">Get started by creating your first notarization order</p>
                  <Button asChild>
                    <Link to="/create-job">Create First Order</Link>
                  </Button>
                </div>
              ) : (
                recentJobsSlice.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">Order #{job.id}</h4>
                          <p className="text-sm text-gray-600">{job.titleCompany}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {job.propertyAddressOne}
                            {job.propertyCity && `, ${job.propertyCity}`}
                            {job.propertyState && `, ${job.propertyState}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(getJobStatus(job))}>
                            {getJobStatus(job)}
                          </Badge>
                          {job.selectedDate && (
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(job.selectedDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Signing Jobs (Dual Role) */}
        {signingJobs.length > 0 && (
          <Card className="border-0 shadow-sm border-l-4 border-l-red-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4 text-red-600" />
                  Signing Assignments
                  <Badge className="bg-red-100 text-red-800 text-xs">
                    Acting as Signer
                  </Badge>
                </CardTitle>
                <div className="text-xs text-gray-500">
                  {signingJobs.length} job{signingJobs.length !== 1 ? 's' : ''}
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Jobs where you are invited as a signer (not title company role)
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {signingJobs.slice(0, 3).map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900 flex items-center gap-2">
                            Order #{job.id}
                            <Badge className="bg-red-100 text-red-800 text-xs">
                              Signing Job
                            </Badge>
                          </h4>
                          <p className="text-sm text-gray-600">{job.titleCompany}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Role: {job.userPrimaryRole} → {job.jobSpecificRole}
                          </p>
                          {job.propertyAddressOne && (
                            <p className="text-xs text-gray-500">
                              {job.propertyAddressOne}
                              {job.propertyCity && `, ${job.propertyCity}`}
                              {job.propertyState && `, ${job.propertyState}`}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex flex-col gap-2">
                          <Badge className={getStatusColor(getJobStatus(job))}>
                            {getJobStatus(job)}
                          </Badge>
                          {job.requiresIdVerification && !job.idVerificationCompleted && job.idVerificationStatus !== 'bypassed' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="text-xs border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                            >
                              <Link to={`/id-verification?jobId=${job.id}`}>
                                Complete Verification
                              </Link>
                            </Button>
                          ) : job.canJoinSigning ? (
                            <Button
                              size="sm"
                              className="text-xs bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => {
                                const signingUrl = `/editor/${job.id}?mode=signing`;
                                if (isMobileDevice()) {
                                  window.location.href = signingUrl;
                                } else {
                                  window.open(signingUrl, '_blank');
                                }
                              }}
                            >
                              Join Signing
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-500">Waiting for session</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

            {/* Title Company Information */}
            <Alert className="border-blue-200 bg-blue-50">
              <Shield className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Title Company Access:</strong> You have permissions to create notarization orders, manage signers, and oversee your company's operations. 
                You can efficiently create and manage notarization orders for your title company.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="managers" className="space-y-6 pt-2">
            {associationsLoading ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Checking company access...
              </div>
            ) : associationsError ? (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Error:</strong> Failed to check company access. 
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="ml-2"
                    onClick={() => refetchAssociations()}
                  >
                    Try Again
                  </Button>
                </AlertDescription>
              </Alert>
            ) : companyAssociations?.hasManagerAccess && companyAssociations?.primaryCompany ? (
              <ManagerManagement companyId={companyAssociations.primaryCompany.id} />
            ) : companyAssociations?.canCreateCompany ? (
              <CompanySetupRequired onCompanyCreated={refetchAssociations} />
            ) : user?.role === 'title_company' || user?.role === 'company_manager' ? (
              <NoCompanyAccess companyAssociations={companyAssociations} />
            ) : (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Access Denied:</strong> Only title company users can access the manager dashboard.
                  <br />
                  <span className="text-sm mt-2 block">
                    Your current role: {user?.role || 'not set'}
                  </span>
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6 pt-2">
            {/* Company Information Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Company Information
                </CardTitle>
                <CardDescription>
                  Update your company details and contact information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {companyLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                    Loading company information...
                  </div>
                ) : !companyData && !selectedCompany ? (
                  <div className="text-center p-8 text-muted-foreground space-y-3">
                    <div>No company information available</div>
                    {associationsLoading ? (
                      <div className="text-sm">Loading company associations...</div>
                    ) : associationsError ? (
                      <div className="text-sm text-red-500">Error loading company associations</div>
                    ) : companyAssociations ? (
                      <div className="text-sm text-gray-500">
                        <div>Debug: User role: {user?.role}</div>
                        <div>Direct company: {companyAssociations.directCompany?.companyName || 'None'}</div>
                        <div>Primary company: {companyAssociations.primaryCompany?.companyName || 'None'}</div>
                        <div>Manager companies: {companyAssociations.managerCompanies?.length || 0}</div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No associations data</div>
                    )}
                  </div>
                ) : (
                  <>
                {/* Company Selector for users with multiple company access */}
                {companyAssociations?.managerCompanies && companyAssociations.managerCompanies.length > 1 && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <Label className="text-sm font-medium mb-2 block">Select Company to Manage</Label>
                    <Select 
                      value={selectedCompany?.id?.toString() || ''}
                      onValueChange={(value) => {
                        const companyId = parseInt(value);
                        const company = companyAssociations.managerCompanies.find(c => c.companyId === companyId);
                        if (company) {
                          // This would trigger a refetch with the new company
                          window.location.reload();
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companyAssociations.managerCompanies.map(company => (
                          <SelectItem key={company.companyId} value={company.companyId.toString()}>
                            <div className="flex flex-col">
                              <span>{company.companyName}</span>
                              <span className="text-xs text-muted-foreground">
                                {company.managerRole} • {company.status}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input 
                      id="companyName" 
                      value={companySettings.companyName}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, companyName: e.target.value }))}
                      placeholder="Enter company name" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyEmail">Company Email</Label>
                    <Input 
                      id="companyEmail" 
                      type="email"
                      value={companySettings.contactEmail}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, contactEmail: e.target.value }))}
                      placeholder="company@example.com" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyPhone">Phone Number</Label>
                    <Input 
                      id="companyPhone" 
                      value={companySettings.phoneNumber}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      placeholder="(555) 123-4567" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyWebsite">Website</Label>
                    <Input 
                      id="companyWebsite" 
                      value={companySettings.website}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="https://company.com" 
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address1">Street Address</Label>
                    <Input 
                      id="address1" 
                      value={companySettings.address1}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, address1: e.target.value }))}
                      placeholder="123 Main Street" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address2">Unit/Suite (Optional)</Label>
                    <Input 
                      id="address2" 
                      value={companySettings.address2}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, address2: e.target.value }))}
                      placeholder="Suite 100" 
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input 
                      id="city" 
                      value={companySettings.city}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="City" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input 
                      id="state" 
                      value={companySettings.state}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, state: e.target.value }))}
                      placeholder="State" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input 
                      id="zipCode" 
                      value={companySettings.zipCode}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, zipCode: e.target.value }))}
                      placeholder="12345" 
                    />
                  </div>
                </div>
                
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handleUpdateCompanyInfo}
                  disabled={isUpdatingCompany || !companySettings.companyName || !companySettings.contactEmail}
                >
                  {isUpdatingCompany ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4 mr-2" />
                      Update Company Information
                    </>
                  )}
                </Button>
                </>
                )}
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Settings
                </CardTitle>
                <CardDescription>
                  Configure how your company receives notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications via email for important updates
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Job Assignment Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when notaries are assigned to jobs
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Payment Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive alerts for payment updates and receipts
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>System Maintenance Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified about scheduled maintenance windows
                      </p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Billing & Subscription */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Billing & Subscription
                </CardTitle>
                <CardDescription>
                  Manage your subscription and billing information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Current Plan: Professional</div>
                    <div className="text-sm text-muted-foreground">
                      $99/month • Next billing: Jan 15, 2025
                    </div>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Update Payment Method
                  </Button>
                  <Button variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    View Billing History
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Configure security options for your company account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Two-Factor Authentication</Label>
                      <p className="text-sm text-muted-foreground">
                        Require 2FA for all company managers
                      </p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>IP Restrictions</Label>
                      <p className="text-sm text-muted-foreground">
                        Limit access to specific IP addresses
                      </p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Session Timeout</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically log out inactive users
                      </p>
                    </div>
                    <Select defaultValue="30">
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button variant="outline">
                  <Shield className="h-4 w-4 mr-2" />
                  View Security Logs
                </Button>
              </CardContent>
            </Card>

            {/* API & Integrations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  API & Integrations
                </CardTitle>
                <CardDescription>
                  Manage API keys and third-party integrations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Code className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium">API Access</div>
                        <div className="text-sm text-muted-foreground">
                          Manage API keys for external integrations
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Configure
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium">Webhook Endpoints</div>
                        <div className="text-sm text-muted-foreground">
                          Configure endpoints for real-time updates
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Setup
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
  );
}

// Component for title company users who don't have a company set up yet
function CompanySetupRequired({ onCompanyCreated }: { onCompanyCreated?: () => void }) {
  const { user, refetch } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    companyName: '',
    address1: '',
    city: '',
    state: '',
    zipCode: '',
    contactName: '',
    email: user?.email || '',
    phoneNumber: '',
    paymentMethod: 'invoiced'
  });

  const handleCreateCompany = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...companyForm,
          primaryUserEmail: user?.email,
          primaryUserName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username,
          status: 'active'
        })
      });

      if (response.ok) {
        const newCompany = await response.json();
        
        // Associate current user with the new company
        await fetch(`/api/admin/users/${user?.id}/company-association`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            companyId: newCompany.id
          })
        });

        // Refresh user data to get the new companyId
        await refetch();
        
        // Call the callback to refresh company associations
        if (onCompanyCreated) {
          onCompanyCreated();
        }
        
        setShowCreateDialog(false);
        // Don't reload the page - let the refetch handle the UI update
      } else {
        const error = await response.json();
        alert('Error creating company: ' + (error.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating company:', error);
      alert('Error creating company. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="border-blue-200 bg-blue-50">
        <Building2 className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Company Setup Required:</strong> To access manager features, you need to set up your title company first.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Set Up Your Title Company
          </CardTitle>
          <CardDescription>
            Create your company profile to start managing users and operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              As a title company user, you can create your company profile and then invite other managers to help run your operations.
            </p>
            
            <div className="flex justify-center py-4">
              <Button 
                size="lg" 
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-4 w-4" />
                Create My Company
              </Button>
            </div>
            
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Your Title Company</DialogTitle>
                  <DialogDescription>
                    Enter your company details to get started.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      value={companyForm.companyName}
                      onChange={(e) => setCompanyForm(prev => ({ ...prev, companyName: e.target.value }))}
                      placeholder="ABC Title Company"
                    />
                  </div>

                  <div>
                    <Label htmlFor="contactName">Contact Name *</Label>
                    <Input
                      id="contactName"
                      value={companyForm.contactName}
                      onChange={(e) => setCompanyForm(prev => ({ ...prev, contactName: e.target.value }))}
                      placeholder="John Smith"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Contact Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={companyForm.email}
                      onChange={(e) => setCompanyForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="contact@company.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      value={companyForm.phoneNumber}
                      onChange={(e) => setCompanyForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <Label htmlFor="address1">Address *</Label>
                    <Input
                      id="address1"
                      value={companyForm.address1}
                      onChange={(e) => setCompanyForm(prev => ({ ...prev, address1: e.target.value }))}
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={companyForm.city}
                        onChange={(e) => setCompanyForm(prev => ({ ...prev, city: e.target.value }))}
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State *</Label>
                      <Input
                        id="state"
                        value={companyForm.state}
                        onChange={(e) => setCompanyForm(prev => ({ ...prev, state: e.target.value }))}
                        placeholder="State"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="zipCode">ZIP Code *</Label>
                    <Input
                      id="zipCode"
                      value={companyForm.zipCode}
                      onChange={(e) => setCompanyForm(prev => ({ ...prev, zipCode: e.target.value }))}
                      placeholder="12345"
                    />
                  </div>

                  <div>
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select
                      value={companyForm.paymentMethod}
                      onValueChange={(value) => setCompanyForm(prev => ({ ...prev, paymentMethod: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="invoiced">Invoiced</SelectItem>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="ach">ACH Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-3 justify-end pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCreateDialog(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateCompany}
                      disabled={loading || !companyForm.companyName || !companyForm.contactName || !companyForm.address1 || !companyForm.city || !companyForm.state || !companyForm.zipCode}
                    >
                      {loading ? 'Creating...' : 'Create Company'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Component for users who have a title company role but no company access
function NoCompanyAccess({ companyAssociations }: { companyAssociations: CompanyAssociations | undefined }) {
  return (
    <div className="space-y-6">
      <Alert className="border-yellow-200 bg-yellow-50">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">
          <strong>Manager Access Required:</strong> You don't currently have manager access to any company.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Company Manager Access
          </CardTitle>
          <CardDescription>
            You need to be invited as a manager or associated with a company to access management features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {companyAssociations?.managerCompanies && companyAssociations.managerCompanies.length > 0 ? (
              <div>
                <h4 className="font-medium mb-2">Pending Manager Invitations:</h4>
                <div className="space-y-2">
                  {companyAssociations.managerCompanies.map((company) => (
                    <div key={company.companyId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{company.companyName}</p>
                        <p className="text-sm text-gray-600">Role: {company.managerRole}</p>
                      </div>
                      <Badge variant={company.status === 'active' ? 'default' : 'secondary'}>
                        {company.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Company Access</h3>
                <p className="text-gray-600 mb-4">
                  Contact your company administrator to get invited as a manager, or create a new company if you're setting up your own title company.
                </p>
                <div className="flex flex-col gap-2 items-center">
                  <p className="text-sm text-gray-500">
                    If you believe this is an error, please contact support.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}