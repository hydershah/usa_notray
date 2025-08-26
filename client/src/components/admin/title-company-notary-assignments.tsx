import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Building,
  UserCheck,
  Plus,
  Edit,
  Trash2,
  Search,
  Star,
  StarOff,
  AlertCircle,
  CheckCircle,
  Shield,
  Users,
  RefreshCw,
  Filter,
  Settings
} from 'lucide-react';

interface TitleCompany {
  id: number;
  companyName: string;
  email: string;
  city: string;
  state: string;
  status: string;
}

interface Notary {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  notaryIdCode: string;
  isActive: boolean;
  notaryType: string;
}

interface NotaryAssignment {
  id: number;
  notaryId: number;
  isDefault: boolean;
  status: string;
  assignedAt: string;
  notes?: string;
  notaryFirstName: string;
  notaryLastName: string;
  notaryEmail: string;
  notaryIdCode: string;
  notaryIsActive: boolean;
}

export function TitleCompanyNotaryAssignments({ embedded = false, company }: { embedded?: boolean; company?: { id: number; companyName: string } }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [selectedCompany, setSelectedCompany] = useState<TitleCompany | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<NotaryAssignment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form state for new assignment
  const [assignmentForm, setAssignmentForm] = useState({
    notaryId: '',
    isDefault: false,
    notes: ''
  });

  // Fetch title companies
  const { data: companies = [], isLoading: companiesLoading } = useQuery<TitleCompany[]>({
    queryKey: ['/api/companies'],
    enabled: !embedded,
  });

  // Fetch available notaries
  const { data: notaries = [] } = useQuery<Notary[]>({
    queryKey: ['/api/users/notaries'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users/notaries');
      return response.json();
    }
  });

  // Fetch assignments for selected company
  const currentCompanyId = embedded && company ? company.id : selectedCompany?.id;
  const { data: assignments = [], isLoading: assignmentsLoading, refetch: refetchAssignments } = useQuery<NotaryAssignment[]>({
    queryKey: ['/api/title-companies', currentCompanyId, 'notary-assignments'],
    queryFn: async () => {
      if (!currentCompanyId) return [];
      const response = await apiRequest('GET', `/api/title-companies/${currentCompanyId}/notary-assignments`);
      const result = await response.json();
      return result.data || [];
    },
    enabled: !!currentCompanyId
  });

  // Sync selected company when embedded
  useEffect(() => {
    if (embedded && company) {
      setSelectedCompany({
        id: company.id,
        companyName: company.companyName,
        email: '',
        city: '',
        state: '',
        status: 'active'
      } as TitleCompany);
    }
  }, [embedded, company]);

  // Filter companies based on search
  const filteredCompanies = companies.filter(company => {
    const matchesSearch = !searchTerm || 
      company.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || company.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Available notaries for assignment (excluding already assigned)
  const availableNotaries = notaries.filter(notary => 
    notary.isActive && 
    notary.notaryType === 'contractor' &&
    !assignments.some(assignment => assignment.notaryId === notary.id)
  );

  // Debug information - remove in production
  console.log('Debug notary assignment:', {
    totalNotaries: notaries.length,
    activeNotaries: notaries.filter(n => n.isActive).length,
    contractorNotaries: notaries.filter(n => n.notaryType === 'contractor').length,
    activeContractors: notaries.filter(n => n.isActive && n.notaryType === 'contractor').length,
    availableNotaries: availableNotaries.length,
    currentAssignments: assignments.length,
    notaryTypes: notaries.map(n => ({ id: n.id, name: `${n.firstName} ${n.lastName}`, type: n.notaryType, active: n.isActive }))
  });

  // Mutations
  const assignNotaryMutation = useMutation({
    mutationFn: async (data: { companyId: number; notaryId: number; isDefault: boolean; notes: string }) => {
      const response = await apiRequest('POST', `/api/title-companies/${data.companyId}/notary-assignments`, {
        notaryId: data.notaryId,
        isDefault: data.isDefault,
        notes: data.notes
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Notary assigned successfully",
      });
      refetchAssignments();
      setIsAssignDialogOpen(false);
      resetAssignmentForm();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to assign notary",
      });
    },
  });

  const updateDefaultMutation = useMutation({
    mutationFn: async (data: { companyId: number; assignmentId: number; isDefault: boolean }) => {
      const response = await apiRequest('PUT', `/api/title-companies/${data.companyId}/notary-assignments/${data.assignmentId}`, {
        isDefault: data.isDefault
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Default notary updated successfully",
      });
      refetchAssignments();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update default notary",
      });
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (data: { companyId: number; assignmentId: number }) => {
      console.log('🚀 Making DELETE request:', `/api/title-companies/${data.companyId}/notary-assignments/${data.assignmentId}`);
      const response = await apiRequest('DELETE', `/api/title-companies/${data.companyId}/notary-assignments/${data.assignmentId}`);
      console.log('📡 DELETE response status:', response.status);
      const result = await response.json();
      console.log('📡 DELETE response data:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('✅ Delete successful:', data);
      toast({
        title: "Success",
        description: "Notary assignment removed successfully",
      });
      refetchAssignments();
      setIsDeleteDialogOpen(false);
      setAssignmentToDelete(null);
    },
    onError: (error: any) => {
      console.log('❌ Delete failed:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to remove assignment",
      });
    },
  });

  const resetAssignmentForm = () => {
    setAssignmentForm({
      notaryId: '',
      isDefault: false,
      notes: ''
    });
  };

  const handleAssignNotary = () => {
    const companyId = embedded && company ? company.id : selectedCompany?.id;
    if (!companyId || !assignmentForm.notaryId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a notary",
      });
      return;
    }

    assignNotaryMutation.mutate({
      companyId: companyId,
      notaryId: parseInt(assignmentForm.notaryId),
      isDefault: assignmentForm.isDefault,
      notes: assignmentForm.notes
    });
  };

  const handleToggleDefault = (assignment: NotaryAssignment) => {
    const companyId = embedded && company ? company.id : selectedCompany?.id;
    if (!companyId) return;
    
    updateDefaultMutation.mutate({
      companyId: companyId,
      assignmentId: assignment.id,
      isDefault: !assignment.isDefault
    });
  };

  const handleRemoveAssignment = (assignment: NotaryAssignment) => {
    setAssignmentToDelete(assignment);
    setIsDeleteDialogOpen(true);
  };

  const confirmRemoveAssignment = () => {
    if (!assignmentToDelete) {
      console.log('❌ No assignment to delete');
      return;
    }
    
    const companyId = embedded && company ? company.id : selectedCompany?.id;
    if (!companyId) {
      console.log('❌ No company ID found', { embedded, company, selectedCompany });
      return;
    }
    
    console.log('🗑️ Deleting assignment:', { companyId, assignmentId: assignmentToDelete.id });
    
    removeAssignmentMutation.mutate({
      companyId: companyId,
      assignmentId: assignmentToDelete.id
    });
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Title Company Notary Assignments</h2>
            <p className="text-gray-600 mt-1">Manage preferred notary assignments for title companies</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/companies'] })}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      )}

      <div className={embedded ? 'grid grid-cols-1' : 'grid grid-cols-1 lg:grid-cols-2 gap-6'}>
        {/* Title Companies List */}
        {!embedded && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Title Companies
              </CardTitle>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search companies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                {companiesLoading ? (
                  <div className="p-4 text-center text-gray-500">Loading companies...</div>
                ) : filteredCompanies.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No companies found</div>
                ) : (
                  <div className="space-y-1">
                    {filteredCompanies.map((company) => (
                      <div
                        key={company.id}
                        className={`p-4 cursor-pointer hover:bg-gray-50 border-l-4 transition-colors ${
                          selectedCompany?.id === company.id 
                            ? 'bg-blue-50 border-l-blue-500' 
                            : 'border-l-transparent'
                        }`}
                        onClick={() => setSelectedCompany(company)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{company.companyName}</h4>
                            <p className="text-sm text-gray-600">{company.email}</p>
                            <p className="text-xs text-gray-500">{company.city}, {company.state}</p>
                          </div>
                          <Badge variant={company.status === 'active' ? 'default' : 'secondary'}>
                            {company.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notary Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Assigned Notaries
                {selectedCompany && (
                  <span className="text-sm font-normal text-gray-500">
                    for {selectedCompany.companyName}
                  </span>
                )}
              </div>
              {selectedCompany && (
                <Button
                  size="sm"
                  onClick={() => setIsAssignDialogOpen(true)}
                  disabled={availableNotaries.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Notary
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedCompany ? (
              <div className="text-center py-8 text-gray-500">
                <Building className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p>Select a title company to view notary assignments</p>
              </div>
            ) : assignmentsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading assignments...</div>
            ) : assignments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <UserCheck className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p>No notaries assigned to this company</p>
                <p className="text-sm">Click "Assign Notary" to get started</p>
                {availableNotaries.length === 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                    <p className="text-sm font-medium">No Available Notaries</p>
                    <p className="text-xs mt-1">
                      Total notaries: {notaries.length} | 
                      Active: {notaries.filter(n => n.isActive).length} | 
                      Contractors: {notaries.filter(n => n.notaryType === 'contractor').length}
                    </p>
                    <p className="text-xs">Check browser console for detailed debug info</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {assignment.notaryFirstName} {assignment.notaryLastName}
                        </span>
                        {assignment.isDefault && (
                          <Badge variant="default" className="bg-yellow-100 text-yellow-800">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                        <Badge variant={assignment.notaryIsActive ? 'default' : 'secondary'} className="text-xs">
                          {assignment.notaryIsActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{assignment.notaryEmail}</p>
                      <p className="text-xs text-gray-500">Code: {assignment.notaryIdCode}</p>
                      {assignment.notes && (
                        <p className="text-xs text-gray-500 mt-1">Note: {assignment.notes}</p>
                      )}
                      <p className="text-xs text-gray-400">
                        Assigned: {new Date(assignment.assignedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleDefault(assignment)}
                        disabled={updateDefaultMutation.isPending}
                        title={assignment.isDefault ? "Remove as default" : "Set as default"}
                      >
                        {assignment.isDefault ? (
                          <StarOff className="h-4 w-4 text-yellow-600" />
                        ) : (
                          <Star className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAssignment(assignment)}
                        disabled={removeAssignmentMutation.isPending}
                        className="text-red-600 hover:text-red-700"
                        aria-label="Delete assignment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assign Notary Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Notary to {selectedCompany?.companyName}</DialogTitle>
            <DialogDescription>
              Select a notary to assign to this title company. You can optionally set them as the default preferred notary.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Select Notary</label>
              <Select 
                value={assignmentForm.notaryId} 
                onValueChange={(value) => setAssignmentForm({...assignmentForm, notaryId: value})}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a notary" />
                </SelectTrigger>
                <SelectContent>
                  {availableNotaries.map((notary) => (
                    <SelectItem key={notary.id} value={notary.id.toString()}>
                      <div className="flex items-center justify-between w-full">
                        <span>{notary.firstName} {notary.lastName}</span>
                        <span className="text-xs text-gray-500 ml-2">{notary.notaryIdCode}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableNotaries.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  No available notaries. All active contractor notaries are already assigned.
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isDefault"
                checked={assignmentForm.isDefault}
                onCheckedChange={(checked) => 
                  setAssignmentForm({...assignmentForm, isDefault: !!checked})
                }
              />
              <label htmlFor="isDefault" className="text-sm font-medium">
                Set as default preferred notary
              </label>
            </div>
            {assignmentForm.isDefault && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 mr-2" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">Default Notary</p>
                    <p>This notary will be automatically selected when this title company creates jobs with "auto assignment" option.</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Textarea
                placeholder="Add any notes about this assignment..."
                value={assignmentForm.notes}
                onChange={(e) => setAssignmentForm({...assignmentForm, notes: e.target.value})}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAssignDialogOpen(false);
                resetAssignmentForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignNotary}
              disabled={!assignmentForm.notaryId || assignNotaryMutation.isPending}
            >
              {assignNotaryMutation.isPending ? 'Assigning...' : 'Assign Notary'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Assignment Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Notary Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {assignmentToDelete?.notaryFirstName} {assignmentToDelete?.notaryLastName} from {selectedCompany?.companyName}?
              {assignmentToDelete?.isDefault && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                  <strong>Warning:</strong> This is the default preferred notary for this company.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveAssignment}
              disabled={removeAssignmentMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {removeAssignmentMutation.isPending ? 'Removing...' : 'Remove Assignment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 