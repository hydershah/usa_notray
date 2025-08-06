import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Edit, 
  Trash2, 
  DollarSign, 
  Clock, 
  Users, 
  Car,
  CheckCircle,
  XCircle,
  Settings,
  Info
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ClosingType {
  id: number;
  name: string;
  description: string;
  basePrice: number;
  isActive: boolean;
  estimatedDuration: number;
  requiresWitness: boolean;
  requiresNotaryTravel: boolean;
  travelFee: number;
  createdAt: string;
  updatedAt: string;
}

export default function ClosingTypes() {
  const { toast } = useToast();
  
  // State management
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClosingType, setSelectedClosingType] = useState<ClosingType | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [closingTypeToDelete, setClosingTypeToDelete] = useState<ClosingType | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    basePrice: "",
    isActive: true,
    estimatedDuration: "",
    requiresWitness: false,
    requiresNotaryTravel: false,
    travelFee: ""
  });

  // Data fetching
  const { data: closingTypes = [], isLoading } = useQuery({
    queryKey: ['/api/closing-types']
  });

  // Mutations
  const createClosingTypeMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/closing-types", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/closing-types'] });
      setIsFormOpen(false);
      resetForm();
      toast({
        title: "Closing Type Created",
        description: "New closing type has been successfully created.",
      });
    }
  });

  const updateClosingTypeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest("PUT", `/api/closing-types/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/closing-types'] });
      setIsFormOpen(false);
      setSelectedClosingType(null);
      resetForm();
      toast({
        title: "Closing Type Updated",
        description: "Closing type has been successfully updated.",
      });
    }
  });

  const deleteClosingTypeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/closing-types/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/closing-types'] });
      setIsDeleteDialogOpen(false);
      setClosingTypeToDelete(null);
      toast({
        title: "Closing Type Deleted",
        description: "Closing type has been successfully deleted.",
      });
    }
  });

  // Helper functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      basePrice: "",
      isActive: true,
      estimatedDuration: "",
      requiresWitness: false,
      requiresNotaryTravel: false,
      travelFee: ""
    });
  };

  const handleAddClosingType = () => {
    resetForm();
    setSelectedClosingType(null);
    setIsFormOpen(true);
  };

  const handleEditClosingType = (closingType: ClosingType) => {
    setSelectedClosingType(closingType);
    setFormData({
      name: closingType.name,
      description: closingType.description || "",
      basePrice: (closingType.basePrice / 100).toString(),
      isActive: closingType.isActive,
      estimatedDuration: closingType.estimatedDuration?.toString() || "",
      requiresWitness: closingType.requiresWitness,
      requiresNotaryTravel: closingType.requiresNotaryTravel,
      travelFee: closingType.travelFee ? (closingType.travelFee / 100).toString() : ""
    });
    setIsFormOpen(true);
  };

  const handleDeleteClosingType = (closingType: ClosingType) => {
    setClosingTypeToDelete(closingType);
    setIsDeleteDialogOpen(true);
  };

  const handleFormSubmit = () => {
    const basePrice = Math.round(parseFloat(formData.basePrice) * 100);
    const travelFee = formData.travelFee ? Math.round(parseFloat(formData.travelFee) * 100) : 0;
    const estimatedDuration = formData.estimatedDuration ? parseInt(formData.estimatedDuration) : null;

    const submitData = {
      ...formData,
      basePrice,
      travelFee,
      estimatedDuration
    };

    if (selectedClosingType) {
      updateClosingTypeMutation.mutate({ id: selectedClosingType.id, data: submitData });
    } else {
      createClosingTypeMutation.mutate(submitData);
    }
  };

  const confirmDelete = () => {
    if (closingTypeToDelete) {
      deleteClosingTypeMutation.mutate(closingTypeToDelete.id);
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-green-100 text-green-800 border-green-300">
        <CheckCircle className="w-3 h-3 mr-1" />
        Active
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-gray-100 text-gray-800">
        <XCircle className="w-3 h-3 mr-1" />
        Inactive
      </Badge>
    );
  };

  const calculateTotalPrice = (closingType: ClosingType) => {
    let total = closingType.basePrice;
    if (closingType.requiresNotaryTravel) {
      total += closingType.travelFee;
    }
    return total;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Closing Types Management</h1>
            <p className="text-gray-600">Configure notary service types and pricing</p>
          </div>
          <Button onClick={handleAddClosingType}>
            <Plus className="h-4 w-4 mr-2" />
            Add Closing Type
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Settings className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Types</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Array.isArray(closingTypes) ? closingTypes.length : 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Types</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Array.isArray(closingTypes) ? closingTypes.filter((ct: ClosingType) => ct.isActive).length : 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-yellow-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg. Price</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Array.isArray(closingTypes) && closingTypes.length > 0 
                      ? formatCurrency(
                          closingTypes.reduce((sum: number, ct: ClosingType) => sum + ct.basePrice, 0) / closingTypes.length
                        )
                      : "$0.00"
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg. Duration</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Array.isArray(closingTypes) && closingTypes.length > 0
                      ? formatDuration(
                          Math.round(
                            closingTypes
                              .filter((ct: ClosingType) => ct.estimatedDuration)
                              .reduce((sum: number, ct: ClosingType) => sum + (ct.estimatedDuration || 0), 0) /
                            closingTypes.filter((ct: ClosingType) => ct.estimatedDuration).length
                          )
                        )
                      : "0 min"
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Closing Types Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading closing types...</div>
            ) : !Array.isArray(closingTypes) || closingTypes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No closing types configured. Create your first closing type to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Base Price</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Features</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closingTypes.map((closingType: ClosingType) => (
                      <TableRow key={closingType.id}>
                        <TableCell>
                          <div className="font-medium">{closingType.name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate text-sm text-gray-600">
                            {closingType.description || "No description"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{formatCurrency(closingType.basePrice)}</div>
                            {closingType.requiresNotaryTravel && closingType.travelFee > 0 && (
                              <div className="text-xs text-gray-500">
                                + {formatCurrency(closingType.travelFee)} travel
                              </div>
                            )}
                            <div className="text-xs font-medium text-blue-600">
                              Total: {formatCurrency(calculateTotalPrice(closingType))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {closingType.estimatedDuration ? (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-gray-400" />
                              {formatDuration(closingType.estimatedDuration)}
                            </div>
                          ) : (
                            <span className="text-gray-400">Not specified</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {closingType.requiresWitness && (
                              <Badge variant="outline" className="text-xs">
                                <Users className="w-3 h-3 mr-1" />
                                Witness
                              </Badge>
                            )}
                            {closingType.requiresNotaryTravel && (
                              <Badge variant="outline" className="text-xs">
                                <Car className="w-3 h-3 mr-1" />
                                Travel
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(closingType.isActive)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-500">
                            {formatDate(closingType.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClosingType(closingType)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClosingType(closingType)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedClosingType ? "Edit Closing Type" : "Create New Closing Type"}
              </DialogTitle>
              <DialogDescription>
                Configure the details and pricing for this notary service type.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm">Basic Information</h3>
                <div>
                  <Label htmlFor="name">Service Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Real Estate Purchase, Refinance, etc."
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe this closing type and when it's used"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="mt-1"
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({...formData, isActive: checked})}
                  />
                  <Label htmlFor="isActive" className="text-sm">Active (available for selection)</Label>
                </div>
              </div>

              {/* Pricing Configuration */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm">Pricing Configuration</h3>
                <div>
                  <Label htmlFor="basePrice">Base Price *</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="basePrice"
                      type="number"
                      step="0.01"
                      placeholder="150.00"
                      value={formData.basePrice}
                      onChange={(e) => setFormData({...formData, basePrice: e.target.value})}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requiresNotaryTravel"
                    checked={formData.requiresNotaryTravel}
                    onCheckedChange={(checked) => setFormData({...formData, requiresNotaryTravel: !!checked})}
                  />
                  <Label htmlFor="requiresNotaryTravel" className="text-sm">Requires notary travel</Label>
                </div>
                {formData.requiresNotaryTravel && (
                  <div className="ml-6">
                    <Label htmlFor="travelFee">Travel Fee</Label>
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        id="travelFee"
                        type="number"
                        step="0.01"
                        placeholder="25.00"
                        value={formData.travelFee}
                        onChange={(e) => setFormData({...formData, travelFee: e.target.value})}
                        className="pl-10"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Service Requirements */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm">Service Requirements</h3>
                <div>
                  <Label htmlFor="estimatedDuration">Estimated Duration (minutes)</Label>
                  <div className="relative mt-1">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="estimatedDuration"
                      type="number"
                      placeholder="60"
                      value={formData.estimatedDuration}
                      onChange={(e) => setFormData({...formData, estimatedDuration: e.target.value})}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requiresWitness"
                    checked={formData.requiresWitness}
                    onCheckedChange={(checked) => setFormData({...formData, requiresWitness: !!checked})}
                  />
                  <Label htmlFor="requiresWitness" className="text-sm">Requires witness present</Label>
                </div>
              </div>

              {/* Pricing Preview */}
              {formData.basePrice && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Pricing Preview
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Base Service Fee:</span>
                      <span className="font-medium">${formData.basePrice}</span>
                    </div>
                    {formData.requiresNotaryTravel && formData.travelFee && (
                      <div className="flex justify-between">
                        <span>Travel Fee:</span>
                        <span className="font-medium">${formData.travelFee}</span>
                      </div>
                    )}
                    <div className="border-t pt-1 mt-2">
                      <div className="flex justify-between font-medium">
                        <span>Total Price:</span>
                        <span className="text-blue-600">
                          ${(
                            parseFloat(formData.basePrice || "0") + 
                            (formData.requiresNotaryTravel ? parseFloat(formData.travelFee || "0") : 0)
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleFormSubmit}
                disabled={!formData.name || !formData.basePrice || 
                         createClosingTypeMutation.isPending || updateClosingTypeMutation.isPending}
              >
                {createClosingTypeMutation.isPending || updateClosingTypeMutation.isPending 
                  ? "Saving..." 
                  : selectedClosingType 
                    ? "Update Closing Type" 
                    : "Create Closing Type"
                }
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500" />
                Delete Closing Type
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the closing type "{closingTypeToDelete?.name}"? 
                This action cannot be undone. Any existing jobs using this closing type may be affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteClosingTypeMutation.isPending}
              >
                {deleteClosingTypeMutation.isPending ? "Deleting..." : "Delete Closing Type"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}