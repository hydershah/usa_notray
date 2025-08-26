import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  Building2, 
  Users, 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  UserCheck,
  Shield,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
  Filter
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface Company {
  id: number;
  companyName: string;
  primaryUserName: string;
  primaryUserEmail: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zipCode: string;
  billingAddress1?: string;
  billingAddress2?: string;
  billingCity?: string;
  billingState?: string;
  billingZipCode?: string;
  paymentMethod: 'invoiced' | 'qualia' | 'pre_pay';
  contactName: string;
  email: string;
  phoneNumber?: string;
  status: 'active' | 'inactive' | 'suspended';
  preferredNotaryId?: number;
  companyManagerId?: number;
  authorizedUserIds: number[];
  subscriptionPlan?: string;
  billingCycle?: 'monthly' | 'yearly';
  nextBillingDate?: string;
  defaultClosingType?: string;
  allowUserSelfRegistration: boolean;
  requiresApprovalForNewUsers: boolean;
  createdAt: string;
  updatedAt: string;
  // Virtual fields from joins
  preferredNotaryName?: string;
  companyManagerName?: string;
  userCount?: number;
}

interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  companyId?: number;
  companyRole?: string;
  isActive: boolean;
}

export default function EnhancedCompanyManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");

  // Form state for create/edit
  const [companyForm, setCompanyForm] = useState<Partial<Company>>({
    companyName: '',
    primaryUserName: '',
    primaryUserEmail: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    paymentMethod: 'invoiced',
    contactName: '',
    email: '',
    phoneNumber: '',
    status: 'active',
    allowUserSelfRegistration: false,
    requiresApprovalForNewUsers: true
  });

  // Data fetching
  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ['/api/companies/enhanced'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/companies");
      return response.json();
    }
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: isDetailsOpen && !!selectedCompany
  });

  const { data: notaries = [] } = useQuery<User[]>({
    queryKey: ['/api/users/notaries']
  });

  // Mutations
  const createCompanyMutation = useMutation({
    mutationFn: async (data: Partial<Company>) => {
      const response = await apiRequest("POST", "/api/companies", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies/enhanced'] });
      setIsCreateOpen(false);
      resetForm();
      toast({
        title: "Company Created",
        description: "Company has been created successfully.",
      });
    }
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Company> }) => {
      const response = await apiRequest("PATCH", `/api/companies/${id}/quick-update`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies/enhanced'] });
      setIsEditOpen(false);
      resetForm();
      toast({
        title: "Company Updated",
        description: "Company has been updated successfully.",
      });
    }
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/companies/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies/enhanced'] });
      setIsDeleteDialogOpen(false);
      setSelectedCompany(null);
      toast({
        title: "Company Deleted",
        description: "Company has been deleted successfully.",
      });
    }
  });

  // Helper functions
  const resetForm = () => {
    setCompanyForm({
      companyName: '',
      primaryUserName: '',
      primaryUserEmail: '',
      address1: '',
      address2: '',
      city: '',
      state: '',
      zipCode: '',
      paymentMethod: 'invoiced',
      contactName: '',
      email: '',
      phoneNumber: '',
      status: 'active',
      allowUserSelfRegistration: false,
      requiresApprovalForNewUsers: true
    });
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
      suspended: "bg-red-100 text-red-800"
    };

    const colorClass = colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";

    return (
      <Badge className={`${colorClass} border-0`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPaymentMethodBadge = (method: string) => {
    const colors = {
      invoiced: "bg-blue-100 text-blue-800",
             qualia: "bg-blue-100 text-blue-800",
      pre_pay: "bg-green-100 text-green-800"
    };

    const labels = {
      invoiced: "Invoiced",
      qualia: "Qualia",
      pre_pay: "Pre-Pay"
    };

    const colorClass = colors[method as keyof typeof colors] || "bg-gray-100 text-gray-800";
    const label = labels[method as keyof typeof labels] || method;

    return (
      <Badge className={`${colorClass} border-0`}>
        {label}
      </Badge>
    );
  };

  const handleCreateCompany = () => {
    createCompanyMutation.mutate(companyForm);
  };

  const handleUpdateCompany = () => {
    if (selectedCompany) {
      updateCompanyMutation.mutate({
        id: selectedCompany.id,
        data: companyForm
      });
    }
  };

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company);
    setCompanyForm(company);
    setIsEditOpen(true);
  };

  const handleDeleteCompany = () => {
    if (selectedCompany) {
      deleteCompanyMutation.mutate(selectedCompany.id);
    }
  };

  const filteredCompanies = companies.filter((company) =>
    (statusFilter === "all" || company.status === statusFilter) &&
    (company.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
     company.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
     company.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const companyUsers = users.filter(u => u.companyId === selectedCompany?.id);

  if (companiesLoading) {
    return (
      <MainLayout>
        <div className="text-center py-8">Loading companies...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Title Company Management</h1>
            <p className="text-gray-600">Manage title company accounts, users, and settings</p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Title Company
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search title companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Companies Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Title Companies</CardTitle>
                <CardDescription>
                  {filteredCompanies.length === 0 ? (
                    <span>No title companies found. Create your first title company.</span>
                  ) : (
                    <span>Showing {filteredCompanies.length} of {companies.length} title companies</span>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredCompanies.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No title companies found</h3>
                <p className="text-gray-600">Create your first title company to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCompanies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{company.companyName}</div>
                            <div className="text-sm text-gray-500">
                              Manager: {company.primaryUserName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{company.contactName}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {company.email}
                            </div>
                            {company.phoneNumber && (
                              <div className="text-sm text-gray-500 flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {company.phoneNumber}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {company.city}, {company.state}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getPaymentMethodBadge(company.paymentMethod)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(company.status)}
                        </TableCell>
                        <TableCell>
                          {formatDate(company.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedCompany(company);
                                setIsDetailsOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCompany(company)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedCompany(company);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Company Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedCompany?.companyName} - Company Details</DialogTitle>
            </DialogHeader>
            {selectedCompany && (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="users">Users</TabsTrigger>
                  <TabsTrigger value="billing">Billing</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Company Name</label>
                      <p className="text-sm">{selectedCompany.companyName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <div>{getStatusBadge(selectedCompany.status)}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Primary Manager</label>
                      <p className="text-sm">{selectedCompany.primaryUserName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Manager Email</label>
                      <p className="text-sm">{selectedCompany.primaryUserEmail}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Contact Person</label>
                      <p className="text-sm">{selectedCompany.contactName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Contact Email</label>
                      <p className="text-sm">{selectedCompany.email}</p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-500">Address</label>
                      <p className="text-sm">
                        {selectedCompany.address1}
                        {selectedCompany.address2 && `, ${selectedCompany.address2}`}
                        <br />
                        {selectedCompany.city}, {selectedCompany.state} {selectedCompany.zipCode}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="users" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Company Users</h3>
                    <Badge variant="outline">
                      {companyUsers.length} User{companyUsers.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  
                  {companyUsers.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No users assigned to this company.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Company Role</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companyUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              {user.firstName && user.lastName 
                                ? `${user.firstName} ${user.lastName}` 
                                : user.username}
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.role}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {user.companyRole || 'user'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                {user.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="billing" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Payment Method</label>
                      <div>{getPaymentMethodBadge(selectedCompany.paymentMethod)}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Subscription Plan</label>
                      <p className="text-sm">{selectedCompany.subscriptionPlan || 'Standard'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Billing Cycle</label>
                      <p className="text-sm">{selectedCompany.billingCycle || 'Monthly'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Next Billing Date</label>
                      <p className="text-sm">
                        {selectedCompany.nextBillingDate 
                          ? formatDate(selectedCompany.nextBillingDate)
                          : 'Not set'}
                      </p>
                    </div>
                  </div>
                  
                  {(selectedCompany.billingAddress1 || selectedCompany.billingCity) && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Billing Address</label>
                      <p className="text-sm">
                        {selectedCompany.billingAddress1 || selectedCompany.address1}
                        {(selectedCompany.billingAddress2 || selectedCompany.address2) && 
                          `, ${selectedCompany.billingAddress2 || selectedCompany.address2}`}
                        <br />
                        {selectedCompany.billingCity || selectedCompany.city}, {' '}
                        {selectedCompany.billingState || selectedCompany.state} {' '}
                        {selectedCompany.billingZipCode || selectedCompany.zipCode}
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Default Closing Type</label>
                      <p className="text-sm">{selectedCompany.defaultClosingType || 'Not set'}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-500">Preferred Notary</label>
                      <p className="text-sm">{selectedCompany.preferredNotaryName || 'Not set'}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Allow User Self Registration</label>
                        <Badge className={selectedCompany.allowUserSelfRegistration ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {selectedCompany.allowUserSelfRegistration ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Requires Approval for New Users</label>
                        <Badge className={selectedCompany.requiresApprovalForNewUsers ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}>
                          {selectedCompany.requiresApprovalForNewUsers ? 'Required' : 'Not Required'}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Created</label>
                        <p className="text-sm">{formatDate(selectedCompany.createdAt)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Last Updated</label>
                        <p className="text-sm">{formatDate(selectedCompany.updatedAt)}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Create/Edit Company Dialog */}
        <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setIsEditOpen(false);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isCreateOpen ? 'Create New Company' : 'Edit Company'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Company Name</label>
                  <Input
                    value={companyForm.companyName}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, companyName: e.target.value }))}
                    placeholder="Enter company name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select 
                    value={companyForm.status} 
                    onValueChange={(value) => setCompanyForm(prev => ({ ...prev, status: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Primary User Name</label>
                  <Input
                    value={companyForm.primaryUserName}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, primaryUserName: e.target.value }))}
                    placeholder="Enter primary user name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Primary User Email</label>
                  <Input
                    type="email"
                    value={companyForm.primaryUserEmail}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, primaryUserEmail: e.target.value }))}
                    placeholder="Enter primary user email"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Contact Name</label>
                  <Input
                    value={companyForm.contactName}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, contactName: e.target.value }))}
                    placeholder="Enter contact name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Contact Email</label>
                  <Input
                    type="email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter contact email"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input
                    value={companyForm.phoneNumber}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Payment Method</label>
                  <Select 
                    value={companyForm.paymentMethod} 
                    onValueChange={(value) => setCompanyForm(prev => ({ ...prev, paymentMethod: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invoiced">Invoiced</SelectItem>
                      <SelectItem value="qualia">Qualia</SelectItem>
                      <SelectItem value="pre_pay">Pre-Pay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium">Address Line 1</label>
                  <Input
                    value={companyForm.address1}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, address1: e.target.value }))}
                    placeholder="Enter address line 1"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium">Address Line 2 (Optional)</label>
                  <Input
                    value={companyForm.address2}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, address2: e.target.value }))}
                    placeholder="Enter address line 2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">City</label>
                  <Input
                    value={companyForm.city}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Enter city"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">State</label>
                  <Input
                    value={companyForm.state}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="Enter state"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">ZIP Code</label>
                  <Input
                    value={companyForm.zipCode}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, zipCode: e.target.value }))}
                    placeholder="Enter ZIP code"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-lg font-medium">Company Settings</h3>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Allow User Self Registration</label>
                    <p className="text-xs text-gray-500">Allow users to register themselves for this company</p>
                  </div>
                  <Switch
                    checked={companyForm.allowUserSelfRegistration}
                    onCheckedChange={(checked) => setCompanyForm(prev => ({ ...prev, allowUserSelfRegistration: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Require Approval for New Users</label>
                    <p className="text-xs text-gray-500">New users require admin approval before accessing the system</p>
                  </div>
                  <Switch
                    checked={companyForm.requiresApprovalForNewUsers}
                    onCheckedChange={(checked) => setCompanyForm(prev => ({ ...prev, requiresApprovalForNewUsers: checked }))}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={isCreateOpen ? handleCreateCompany : handleUpdateCompany}
                  disabled={createCompanyMutation.isPending || updateCompanyMutation.isPending}
                  className="flex-1"
                >
                  {isCreateOpen 
                    ? (createCompanyMutation.isPending ? 'Creating...' : 'Create Company')
                    : (updateCompanyMutation.isPending ? 'Updating...' : 'Update Company')
                  }
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsCreateOpen(false);
                    setIsEditOpen(false);
                    resetForm();
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the company
                "{selectedCompany?.companyName}" and all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteCompany}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Company
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
} 