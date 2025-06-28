import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { 
  Upload, Image, Trash2, Edit,
  Calendar, MapPin, Shield, FileText, Download, Eye
} from "lucide-react";

interface NotaryStamp {
  id: string;
  name: string;
  imageUrl: string;
  commissionNumber: string;
  expirationDate: string;
  state: string;
  county: string;
  isActive: boolean;
  uploadedAt: string;
}

interface NotaryStampManagerProps {
  notaryId: number;
  onStampSelect?: (stamp: NotaryStamp) => void;
}

export function NotaryStampManager({ notaryId, onStampSelect }: NotaryStampManagerProps) {
  const [stamps, setStamps] = useState<NotaryStamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedStamp, setSelectedStamp] = useState<NotaryStamp | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Form states for new stamp
  const [newStamp, setNewStamp] = useState({
    name: '',
    commissionNumber: '',
    expirationDate: '',
    state: '',
    county: '',
    imageFile: null as File | null,
    imagePreview: ''
  });

  useEffect(() => {
    loadNotaryStamps();
  }, [notaryId]);

  const loadNotaryStamps = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/notary/${notaryId}/stamps`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const stampsData = await response.json();
        setStamps(stampsData);
      } else {
        // Fallback with demo data for development
        setStamps([
          {
            id: '1',
            name: 'Primary Notary Seal',
            imageUrl: '/api/placeholder/notary-stamp',
            commissionNumber: 'NOT123456',
            expirationDate: '2026-12-31',
            state: 'California',
            county: 'Los Angeles',
            isActive: true,
            uploadedAt: '2024-01-15'
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading stamps:', error);
      toast({
        title: "Error",
        description: "Failed to load notary stamps",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setNewStamp(prev => ({ ...prev, imageFile: file }));

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setNewStamp(prev => ({ 
        ...prev, 
        imagePreview: event.target?.result as string 
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleUploadStamp = async () => {
    if (!newStamp.imageFile || !newStamp.name || !newStamp.commissionNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields and upload an image",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      // Use 'stamp' as field name to match the enhanced upload system
      formData.append('stamp', newStamp.imageFile);
      formData.append('notaryId', notaryId.toString());
      formData.append('state', newStamp.state);
      formData.append('commission', newStamp.commissionNumber);

      const token = localStorage.getItem('token');
      // Use the correct enhanced upload endpoint
      const response = await fetch('/api/uploads/notary-stamp', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('Upload response:', responseData);
        
        // Create new stamp data from the upload response
        // Extract filename from processedPath (e.g., /uploads/stamps/1/filename.png -> filename.png)
        const filename = responseData.upload.processedPath.split('/').pop();
        
        const newStampData = {
          id: responseData.upload.id,
          name: newStamp.name,
          imageUrl: `/uploads/stamps/${notaryId}/${filename}`,
          commissionNumber: newStamp.commissionNumber,
          expirationDate: newStamp.expirationDate,
          state: newStamp.state,
          county: newStamp.county,
          isActive: stamps.length === 0, // Make first stamp active
          uploadedAt: new Date().toISOString().split('T')[0]
        };
        
        console.log('Constructed image URL:', newStampData.imageUrl);
        console.log('Full upload response:', responseData);
        
        setStamps(prev => [...prev, newStampData]);
        
        // Reset form
        setNewStamp({
          name: '',
          commissionNumber: '',
          expirationDate: '',
          state: '',
          county: '',
          imageFile: null,
          imagePreview: ''
        });
        setShowUploadForm(false);

        toast({
          title: "Stamp Uploaded Successfully",
          description: "Your notary stamp has been uploaded and is ready to use",
        });
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        console.error('Upload error response:', errorData);
        throw new Error(errorData.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading stamp:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload notary stamp. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteStamp = async (stampId: string) => {
    if (!confirm('Are you sure you want to delete this stamp?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/notary/stamps/${stampId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (response.ok) {
        setStamps(prev => prev.filter(s => s.id !== stampId));
        toast({
          title: "Stamp Deleted",
          description: "Notary stamp has been removed",
        });
      }
    } catch (error) {
      console.error('Error deleting stamp:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete stamp. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSetActive = async (stampId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/notary/stamps/${stampId}/activate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (response.ok) {
        setStamps(prev => prev.map(s => ({
          ...s,
          isActive: s.id === stampId
        })));
        toast({
          title: "Active Stamp Set",
          description: "This stamp is now your active notary seal",
        });
      }
    } catch (error) {
      console.error('Error setting active stamp:', error);
      toast({
        title: "Update Failed",
        description: "Failed to set active stamp. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Loading stamps...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notary Stamp Manager</h2>
          <p className="text-gray-600">Manage your official notary seals and stamps</p>
        </div>
        <Button onClick={() => setShowUploadForm(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Upload New Stamp
        </Button>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <Card>
          <CardHeader>
            <CardTitle>Upload New Notary Stamp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Stamp Name *
                </label>
                <input
                  type="text"
                  value={newStamp.name}
                  onChange={(e) => setNewStamp(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Primary Notary Seal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Commission Number *
                </label>
                <input
                  type="text"
                  value={newStamp.commissionNumber}
                  onChange={(e) => setNewStamp(prev => ({ ...prev, commissionNumber: e.target.value }))}
                  placeholder="NOT123456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Commission Expiration
                </label>
                <input
                  type="date"
                  value={newStamp.expirationDate}
                  onChange={(e) => setNewStamp(prev => ({ ...prev, expirationDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  State
                </label>
                <input
                  type="text"
                  value={newStamp.state}
                  onChange={(e) => setNewStamp(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="California"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  County
                </label>
                <input
                  type="text"
                  value={newStamp.county}
                  onChange={(e) => setNewStamp(prev => ({ ...prev, county: e.target.value }))}
                  placeholder="Los Angeles"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Stamp Image *
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Upload a clear image of your official notary stamp (PNG, JPG - max 10MB)
              </p>
            </div>

            {newStamp.imagePreview && (
              <div className="border border-gray-300 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Preview:</p>
                <img
                  src={newStamp.imagePreview}
                  alt="Stamp preview"
                  className="max-w-64 h-auto mx-auto border rounded"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setShowUploadForm(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUploadStamp}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Stamp'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stamps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stamps.map((stamp) => (
          <Card key={stamp.id} className={`${stamp.isActive ? 'ring-2 ring-blue-500' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{stamp.name}</CardTitle>
                <div className="flex gap-1">
                  {stamp.isActive && (
                    <Badge className="bg-blue-100 text-blue-800">Active</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Stamp Image */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <img
                  src={stamp.imageUrl}
                  alt={stamp.name}
                  className="w-full h-32 object-contain"
                />
              </div>

              {/* Stamp Details */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">Commission:</span>
                  <span>{stamp.commissionNumber}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">Expires:</span>
                  <span>{new Date(stamp.expirationDate).toLocaleDateString()}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">Location:</span>
                  <span>{stamp.county}, {stamp.state}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                {!stamp.isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetActive(stamp.id)}
                    className="flex-1"
                  >
                    Set Active
                  </Button>
                )}
                
                {onStampSelect && (
                  <Button
                    size="sm"
                    onClick={() => onStampSelect(stamp)}
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Use
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteStamp(stamp.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stamps.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Image className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Stamps Uploaded</h3>
            <p className="text-gray-600 text-center mb-4">
              Upload your official notary stamp to use in signing sessions
            </p>
            <Button onClick={() => setShowUploadForm(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload First Stamp
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Important Notice */}
      <Alert>
        <AlertDescription>
          <strong>Important:</strong> Only upload official notary stamps that you are legally authorized to use. 
          All stamps must comply with your state's notary laws.
        </AlertDescription>
      </Alert>
    </div>
  );
} 