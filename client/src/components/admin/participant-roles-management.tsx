import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  Plus, 
  Edit, 
  Trash2, 
  User, 
  Eye, 
  EyeOff,
  Save,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ParticipantRole {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  category: string;
  requiresSignature: boolean;
  requiresIdVerification: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface RoleFormData {
  name: string;
  displayName: string;
  description: string;
  category: string;
  requiresSignature: boolean;
  requiresIdVerification: boolean;
  isActive: boolean;
  sortOrder: number;
}

export function ParticipantRolesManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<ParticipantRole | null>(null);
  const [formData, setFormData] = useState<RoleFormData>({
    name: '',
    displayName: '',
    description: '',
    category: 'signer',
    requiresSignature: true,
    requiresIdVerification: true,
    isActive: true,
    sortOrder: 0,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch participant roles
  const { data: roles = [], isLoading } = useQuery<ParticipantRole[]>({
    queryKey: ['/api/participant-roles'],
    queryFn: async () => {
      const response = await fetch('/api/participant-roles', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch participant roles');
      }
      return response.json();
    }
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (roleData: RoleFormData) => {
      const response = await fetch('/api/participant-roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(roleData),
      });
      if (!response.ok) {
        throw new Error('Failed to create role');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/participant-roles'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Participant role created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create role",
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, roleData }: { id: number; roleData: Partial<RoleFormData> }) => {
      const response = await fetch(`/api/participant-roles/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(roleData),
      });
      if (!response.ok) {
        throw new Error('Failed to update role');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/participant-roles'] });
      setEditingRole(null);
      resetForm();
      toast({
        title: "Success",
        description: "Participant role updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update role",
      });
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/participant-roles/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
      });
      if (!response.ok) {
        throw new Error('Failed to delete role');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/participant-roles'] });
      toast({
        title: "Success",
        description: "Participant role deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete role",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      description: '',
      category: 'signer',
      requiresSignature: true,
      requiresIdVerification: true,
      isActive: true,
      sortOrder: 0,
    });
  };

  const handleEdit = (role: ParticipantRole) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      displayName: role.displayName,
      description: role.description || '',
      category: role.category,
      requiresSignature: role.requiresSignature,
      requiresIdVerification: role.requiresIdVerification,
      isActive: role.isActive,
      sortOrder: role.sortOrder,
    });
  };

  const handleSave = () => {
    if (editingRole) {
      updateRoleMutation.mutate({ id: editingRole.id, roleData: formData });
    } else {
      createRoleMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this participant role?')) {
      deleteRoleMutation.mutate(id);
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors = {
      signer: 'bg-blue-100 text-blue-800',
      witness: 'bg-green-100 text-green-800',
      observer: 'bg-gray-100 text-gray-800',
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Participant Roles Management</h2>
          <p className="text-gray-600">Configure participant roles for job creation forms</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingRole ? 'Edit Participant Role' : 'Create New Participant Role'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Role Name (Internal)</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="borrower"
                  />
                </div>
                
                <div>
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="Borrower (Signs documents)"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Primary borrower who signs loan documents"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="signer">Signer</SelectItem>
                      <SelectItem value="witness">Witness</SelectItem>
                      <SelectItem value="observer">Observer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="requiresSignature">Requires Signature</Label>
                  <Switch
                    id="requiresSignature"
                    checked={formData.requiresSignature}
                    onCheckedChange={(checked) => setFormData({ ...formData, requiresSignature: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="requiresIdVerification">Requires ID Verification</Label>
                  <Switch
                    id="requiresIdVerification"
                    checked={formData.requiresIdVerification}
                    onCheckedChange={(checked) => setFormData({ ...formData, requiresIdVerification: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="isActive">Active</Label>
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setEditingRole(null);
                    resetForm();
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingRole ? 'Update' : 'Create'} Role
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            Participant Roles ({roles.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading participant roles...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Signature</TableHead>
                  <TableHead>ID Verification</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sort Order</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>{role.displayName}</TableCell>
                    <TableCell>
                      <Badge className={getCategoryBadge(role.category)}>
                        {role.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {role.requiresSignature ? (
                        <Badge variant="default">Required</Badge>
                      ) : (
                        <Badge variant="secondary">Not Required</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {role.requiresIdVerification ? (
                        <Badge variant="default">Required</Badge>
                      ) : (
                        <Badge variant="secondary">Not Required</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {role.isActive ? (
                        <div className="flex items-center">
                          <Eye className="h-4 w-4 text-green-600 mr-1" />
                          <span className="text-green-600">Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <EyeOff className="h-4 w-4 text-gray-500 mr-1" />
                          <span className="text-gray-500">Inactive</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{role.sortOrder}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            handleEdit(role);
                            setIsCreateDialogOpen(true);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(role.id)}
                          disabled={deleteRoleMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 