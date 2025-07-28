import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/api';
import { 
  Info, 
  Users, 
  FileText, 
  Settings, 
  Save, 
  Plus, 
  Trash2, 
  Edit3,
  Mail,
  Phone,
  User,
  Building,
  MapPin,
  Calendar,
  Clock
} from 'lucide-react';
// import { JobSignersManager } from './JobSignersManager';
import EnhancedDocumentManager from './enhanced-document-manager';

interface JobEditorProps {
  jobId: number;
  onJobUpdated?: () => void;
  onClose?: () => void;
}

interface Job {
  id: number;
  titleCompany: string;
  closingType: string;
  internalReference?: string;
  kbaRequired: boolean;
  propertyAddressOne: string;
  propertyAddressTwo?: string;
  propertyCity: string;
  propertyState: string;
  propertyZipCode: string;
  notaryOption: string;
  selectedNotary?: string;
  selectedDate?: string;
  selectedTime?: string;
  jobStatus: string;
  requiresNSA: boolean;
  requiresSpanishSpeaking: boolean;
  jobType: string;
  createdAt: string;
}

interface Company {
  id: number;
  companyName: string;
}

interface Notary {
  id: number;
  firstName: string;
  lastName: string;
}

export function JobEditor({ jobId, onJobUpdated, onClose }: JobEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('basic');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Basic job info form state
  const [jobData, setJobData] = useState<Partial<Job>>({});
  const [formData, setFormData] = useState<Partial<Job>>({});

  // Data fetching
  const { data: job, isLoading: isLoadingJob, error: jobError } = useQuery<Job>({
    queryKey: [`/api/jobs/${jobId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/jobs/${jobId}`);
      return response.json();
    }
  });

  // Auto-populate form data when job data loads
  useEffect(() => {
    if (job) {
      setJobData(job);
      setFormData(job);
    }
  }, [job]);

  const { data: titleCompanies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const response = await apiRequest("GET", '/api/companies');
      return response.json();
    }
  });

  const { data: notaries = [] } = useQuery<Notary[]>({
    queryKey: ['/api/notaries/available'],
    queryFn: async () => {
      const response = await apiRequest("GET", '/api/notaries/available');
      return response.json();
    }
  });

  // Update job mutation
  const updateJobMutation = useMutation({
    mutationFn: async (updateData: Partial<Job>) => {
      const response = await apiRequest("PUT", `/api/jobs/${jobId}`, updateData);
      return response.json();
    }
  });

  // Handle mutation success/error
  useEffect(() => {
    if (updateJobMutation.isSuccess) {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setHasUnsavedChanges(false);
      onJobUpdated?.();
      toast({
        title: "Job Updated",
        description: "Job information has been updated successfully.",
      });
    }
    
    if (updateJobMutation.isError) {
      toast({
        title: "Update Failed",
        description: (updateJobMutation.error as any)?.message || "Failed to update job.",
        variant: "destructive"
      });
    }
  }, [updateJobMutation.isSuccess, updateJobMutation.isError, updateJobMutation.error, queryClient, jobId, onJobUpdated, toast]);

  // Permission checks
  const canEditJob = user && job && (
    user.role === 'admin' || 
    user.role === 'title_company' || 
    (user.role === 'notary' && ['open', 'pending'].includes(job.jobStatus))
  );

  const handleFormChange = (field: keyof Job, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSaveBasicInfo = () => {
    if (hasUnsavedChanges) {
      updateJobMutation.mutate(formData);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (window.confirm("You have unsaved changes. Are you sure you want to cancel?")) {
        setFormData(jobData);
        setHasUnsavedChanges(false);
        onClose?.();
      }
    } else {
      onClose?.();
    }
  };

  if (isLoadingJob) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading job details...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (jobError || !job) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Failed to load job details. Please try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!canEditJob) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-amber-600">
            You don't have permission to edit this job.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header Section - Fixed at top */}
      <div className="flex-shrink-0 border-b bg-white z-10">
        <div className="flex items-center justify-between p-4 lg:p-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg lg:text-xl font-semibold flex items-center space-x-2 truncate">
              <Edit3 className="h-5 w-5 flex-shrink-0" />
              <span>Edit Job #{job.id}</span>
              <Badge variant={job.jobStatus === 'open' ? 'default' : 'secondary'} className="flex-shrink-0">
                {job.jobStatus}
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {job.titleCompany} • {job.closingType}
            </p>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-amber-600 hidden sm:flex">
                Unsaved Changes
              </Badge>
            )}
            <Button variant="outline" onClick={handleCancel} size="sm">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveBasicInfo} 
              disabled={!hasUnsavedChanges || updateJobMutation.isPending}
              className="min-w-[100px]"
              size="sm"
            >
              {updateJobMutation.isPending ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span className="hidden sm:inline">Saving...</span>
                </div>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-0 sm:mr-2" />
                  <span className="hidden sm:inline">Save Changes</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs Section - Fixed below header */}
      <div className="flex-shrink-0 bg-white border-b">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-4 lg:px-6">
            <TabsList className="grid w-full grid-cols-4 bg-transparent h-12 gap-0">
              <TabsTrigger 
                value="basic" 
                className="flex items-center justify-center space-x-1 lg:space-x-2 text-xs lg:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-blue-700 rounded-none border-b-2 border-transparent"
                onClick={(e) => e.stopPropagation()}
              >
                <Info className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Basic Info</span>
                <span className="sm:hidden">Basic</span>
              </TabsTrigger>
              <TabsTrigger 
                value="signers" 
                className="flex items-center justify-center space-x-1 lg:space-x-2 text-xs lg:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-blue-700 rounded-none border-b-2 border-transparent"
                onClick={(e) => e.stopPropagation()}
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                <span>Signers</span>
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="flex items-center justify-center space-x-1 lg:space-x-2 text-xs lg:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-blue-700 rounded-none border-b-2 border-transparent"
                onClick={(e) => e.stopPropagation()}
              >
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Documents</span>
                <span className="sm:hidden">Docs</span>
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="flex items-center justify-center space-x-1 lg:space-x-2 text-xs lg:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-blue-700 rounded-none border-b-2 border-transparent"
                onClick={(e) => e.stopPropagation()}
              >
                <Settings className="h-4 w-4 flex-shrink-0" />
                <span>Settings</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Content Section - Scrollable */}
          <div className="flex-1 overflow-hidden">
            <TabsContent value="basic" className="h-full overflow-y-auto p-4 lg:p-6 m-0 bg-gray-50">
              <div className="max-w-5xl mx-auto space-y-8">
                {/* Company and Job Type */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Building className="h-5 w-5" />
                      <span>Company Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="titleCompany" className="text-sm font-medium">
                          Title Company
                        </Label>
                        <Select
                          value={formData.titleCompany || ''}
                          onValueChange={(value) => handleFormChange('titleCompany', value)}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select title company" />
                          </SelectTrigger>
                          <SelectContent>
                            {titleCompanies.map((company) => (
                              <SelectItem key={company.id} value={company.companyName}>
                                {company.companyName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="closingType" className="text-sm font-medium">
                          Closing Type
                        </Label>
                        <Input
                          id="closingType"
                          value={formData.closingType || ''}
                          onChange={(e) => handleFormChange('closingType', e.target.value)}
                          placeholder="e.g., Purchase, Refinance"
                          className="h-11"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Internal Reference */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Internal Reference</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label htmlFor="internalReference" className="text-sm font-medium">
                        Internal tracking reference
                      </Label>
                      <Input
                        id="internalReference"
                        value={formData.internalReference || ''}
                        onChange={(e) => handleFormChange('internalReference', e.target.value)}
                        placeholder="Internal tracking reference"
                        className="h-11"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Property Address */}
                <div className="space-y-4">
                  <Label className="flex items-center space-x-2 text-base font-medium">
                    <MapPin className="h-4 w-4" />
                    <span>Property Address</span>
                  </Label>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="propertyAddressOne">Address Line 1</Label>
                      <Input
                        id="propertyAddressOne"
                        value={formData.propertyAddressOne || ''}
                        onChange={(e) => handleFormChange('propertyAddressOne', e.target.value)}
                        placeholder="Street address"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="propertyAddressTwo">Address Line 2 (Optional)</Label>
                      <Input
                        id="propertyAddressTwo"
                        value={formData.propertyAddressTwo || ''}
                        onChange={(e) => handleFormChange('propertyAddressTwo', e.target.value)}
                        placeholder="Apartment, suite, etc."
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="propertyCity">City</Label>
                        <Input
                          id="propertyCity"
                          value={formData.propertyCity || ''}
                          onChange={(e) => handleFormChange('propertyCity', e.target.value)}
                          placeholder="City"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="propertyState">State</Label>
                        <Input
                          id="propertyState"
                          value={formData.propertyState || ''}
                          onChange={(e) => handleFormChange('propertyState', e.target.value)}
                          placeholder="State"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="propertyZipCode">ZIP Code</Label>
                        <Input
                          id="propertyZipCode"
                          value={formData.propertyZipCode || ''}
                          onChange={(e) => handleFormChange('propertyZipCode', e.target.value)}
                          placeholder="ZIP Code"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scheduling */}
                <div className="space-y-4">
                  <Label className="flex items-center space-x-2 text-base font-medium">
                    <Calendar className="h-4 w-4" />
                    <span>Scheduling</span>
                  </Label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="selectedDate">Selected Date</Label>
                      <Input
                        id="selectedDate"
                        type="date"
                        value={formData.selectedDate || ''}
                        onChange={(e) => handleFormChange('selectedDate', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="selectedTime">Selected Time</Label>
                      <Input
                        id="selectedTime"
                        type="time"
                        value={formData.selectedTime || ''}
                        onChange={(e) => handleFormChange('selectedTime', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Notary Assignment */}
                <div className="space-y-4">
                  <Label className="flex items-center space-x-2 text-base font-medium">
                    <User className="h-4 w-4" />
                    <span>Notary Assignment</span>
                  </Label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="notaryOption">Assignment Type</Label>
                      <Select
                        value={formData.notaryOption || ''}
                        onValueChange={(value) => handleFormChange('notaryOption', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select assignment type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto Assignment</SelectItem>
                          <SelectItem value="assign">Manual Assignment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.notaryOption === 'assign' && (
                      <div className="space-y-2">
                        <Label htmlFor="selectedNotary">Select Notary</Label>
                        <Select
                          value={formData.selectedNotary || ''}
                          onValueChange={(value) => handleFormChange('selectedNotary', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select notary" />
                          </SelectTrigger>
                          <SelectContent>
                            {notaries.map((notary) => (
                              <SelectItem key={notary.id} value={notary.id.toString()}>
                                {notary.firstName} {notary.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="signers" className="h-full p-6 m-0">
              <Card>
                <CardHeader>
                  <CardTitle>Signers Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    Signers management functionality will be available soon.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="h-full p-6 m-0">
              <EnhancedDocumentManager 
                jobId={jobId}
                userRole={user?.role || 'client'}
                jobStatus={job.jobStatus}
                onDocumentsChange={() => {
                  onJobUpdated?.();
                  queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
                }}
              />
            </TabsContent>

            <TabsContent value="settings" className="h-full p-6 m-0">
              <div className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-base font-medium">Job Requirements</Label>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="font-medium">Knowledge-Based Authentication (KBA)</div>
                        <div className="text-sm text-muted-foreground">
                          Require additional identity verification through KBA questions
                        </div>
                      </div>
                      <Switch
                        checked={formData.kbaRequired || false}
                        onCheckedChange={(checked) => handleFormChange('kbaRequired', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="font-medium">Notary Signing Agent Required</div>
                        <div className="text-sm text-muted-foreground">
                          This job requires a certified Notary Signing Agent
                        </div>
                      </div>
                      <Switch
                        checked={formData.requiresNSA || false}
                        onCheckedChange={(checked) => handleFormChange('requiresNSA', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="font-medium">Spanish Speaking Notary Required</div>
                        <div className="text-sm text-muted-foreground">
                          This job requires a Spanish-speaking notary
                        </div>
                      </div>
                      <Switch
                        checked={formData.requiresSpanishSpeaking || false}
                        onCheckedChange={(checked) => handleFormChange('requiresSpanishSpeaking', checked)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-base font-medium">Job Type</Label>
                  <Select
                    value={formData.jobType || ''}
                    onValueChange={(value) => handleFormChange('jobType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select job type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="title_company">Title Company Job</SelectItem>
                      <SelectItem value="subscriber_personal">Subscriber Personal Job</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="signers" className="h-full overflow-y-auto p-4 lg:p-6 m-0 bg-gray-50">
              <div className="max-w-5xl mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>Signers Management</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      Signers management functionality will be available soon.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="documents" className="h-full overflow-y-auto p-4 lg:p-6 m-0 bg-gray-50">
              <div className="max-w-5xl mx-auto">
                <EnhancedDocumentManager 
                  jobId={jobId} 
                  userRole="admin" 
                  jobStatus={job?.jobStatus || 'open'} 
                />
              </div>
            </TabsContent>

            <TabsContent value="settings" className="h-full overflow-y-auto p-4 lg:p-6 m-0 bg-gray-50">
              <div className="max-w-5xl mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>Job Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Job Priority</Label>
                        <Select defaultValue="normal">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Notification Preferences</Label>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Email notifications</span>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">SMS notifications</span>
                            <Switch defaultChecked />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
} 