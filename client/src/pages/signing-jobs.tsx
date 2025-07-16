import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  PenTool,
  FileText,
  Calendar,
  Clock,
  MapPin,
  Building2,
  CheckCircle,
  AlertCircle,
  Eye,
  Download,
  Video,
  User,
  Users,
  Shield,
  Loader2,
  RefreshCw,
  Filter,
  Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isMobileDevice } from '@/lib/utils';

interface SigningJob {
  id: number;
  titleCompany: string;
  closingType: string;
  signerRole: string;
  signingStatus: string;
  propertyAddressOne?: string;
  propertyCity?: string;
  propertyState?: string;
  selectedDate?: string;
  selectedTime?: string;
  invitationSentAt?: string;
  jobStatus: string;
  notaryApprovalStatus: string;
}

export default function SigningJobs() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch invited jobs
  const { 
    data: signingJobs = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery<SigningJob[]>({
    queryKey: ['/api/jobs/invited'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Filter jobs based on status and search
  const filteredJobs = signingJobs.filter(job => {
    const matchesFilter = filter === 'all' || job.signingStatus === filter;
    const matchesSearch = !searchTerm || 
      job.titleCompany.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.closingType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.signerRole.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  // Group jobs by status
  const jobsByStatus = {
    pending: filteredJobs.filter(job => job.signingStatus === 'pending'),
    in_progress: filteredJobs.filter(job => job.signingStatus === 'in_progress'), 
    completed: filteredJobs.filter(job => job.signingStatus === 'completed'),
    all: filteredJobs
  };

  const handleJoinSession = async (job: SigningJob) => {
    setLoading(true);
    try {
      const isMobile = isMobileDevice();
      let newWindow: Window | null = null;
      
      if (!isMobile) {
        newWindow = window.open('about:blank', '_blank');
      }

      // Check session access
      const token = localStorage.getItem('token');
      const sessionAccessResponse = await fetch(`/api/jobs/${job.id}/session-access`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!sessionAccessResponse.ok) {
        throw new Error('Access denied');
      }

      const accessData = await sessionAccessResponse.json();
      
      if (!accessData.hasAccess) {
        if (newWindow) newWindow.close();
        alert(accessData.message || 'Access denied to this session');
        return;
      }

      // Navigate to signing session
      const sessionUrl = `/jobs/${job.id}/sign`;
      
      if (isMobile) {
        setLocation(sessionUrl);
      } else if (newWindow) {
        newWindow.location.href = sessionUrl;
        newWindow.focus();
      }
    } catch (error) {
      console.error('Error joining session:', error);
      alert('Failed to join session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'border-l-yellow-500';
      case 'in_progress': return 'border-l-blue-500';
      case 'completed': return 'border-l-green-500';
      default: return 'border-l-gray-500';
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading your signing jobs...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">My Signing Jobs</h1>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Failed to load signing jobs. Please check your connection and try again.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Signing Jobs</h1>
            <p className="text-gray-600 mt-1">
              Your signing assignments
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {jobsByStatus.pending.length}
                  </p>
                  <p className="text-sm text-gray-600">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <PenTool className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {jobsByStatus.in_progress.length}
                  </p>
                  <p className="text-sm text-gray-600">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {jobsByStatus.completed.length}
                  </p>
                  <p className="text-sm text-gray-600">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <FileText className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {signingJobs.length}
                  </p>
                  <p className="text-sm text-gray-600">Total Jobs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by title company, document type, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Jobs List */}
        {filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <PenTool className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchTerm || filter !== 'all' ? 'No matching jobs found' : 'No signing jobs yet'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || filter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'When you\'re invited to sign documents, they\'ll appear here.'
                }
              </p>
              {(searchTerm || filter !== 'all') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((job) => (
              <Card key={job.id} className={`border-l-4 ${getStatusColor(job.signingStatus)}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {job.titleCompany}
                        </h3>
                        {getStatusBadge(job.signingStatus)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-600">Document Type</p>
                            <p className="font-medium">{job.closingType}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-600">Your Role</p>
                            <p className="font-medium capitalize">{job.signerRole}</p>
                          </div>
                        </div>
                        
                        {job.selectedDate && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <div>
                              <p className="text-sm text-gray-600">Scheduled</p>
                              <p className="font-medium">
                                {new Date(job.selectedDate).toLocaleDateString()}
                                {job.selectedTime && ` at ${job.selectedTime}`}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {job.propertyAddressOne && (
                          <div className="flex items-center gap-2 md:col-span-2 lg:col-span-3">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <div>
                              <p className="text-sm text-gray-600">Property Address</p>
                              <p className="font-medium">
                                {job.propertyAddressOne}
                                {job.propertyCity && `, ${job.propertyCity}`}
                                {job.propertyState && `, ${job.propertyState}`}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-gray-500">
                      Invited: {job.invitationSentAt ? new Date(job.invitationSentAt).toLocaleDateString() : 'Not sent'}
                    </div>
                    
                    <div className="flex gap-2">
                      {job.signingStatus === 'pending' && user?.isVerified && (
                        <Button 
                          size="sm" 
                          onClick={() => handleJoinSession(job)}
                          disabled={loading}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Video className="h-4 w-4 mr-2" />
                          )}
                          Join Session
                        </Button>
                      )}
                      
                      {job.signingStatus === 'completed' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setLocation(`/jobs/${job.id}/download`)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
                      
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setLocation(`/jobs/${job.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
} 