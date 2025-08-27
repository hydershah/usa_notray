import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { 
  Upload, Image, Trash2, 
  FileText, Download, Eye, Plus, X
} from "lucide-react";

interface NotaryStamp {
  id: string;
  imageUrl: string;
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

  // Form states for new stamp - simplified to just image
  const [newStamp, setNewStamp] = useState({
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
        setStamps(stampsData.map((stamp: any) => ({
          id: stamp.id,
          imageUrl: stamp.imageUrl,
          isActive: stamp.isActive,
          uploadedAt: stamp.uploadedAt
        })));
      } else {
        // Fallback with demo data for development
        setStamps([
          {
            id: '1',
            imageUrl: '/api/placeholder/notary-stamp',
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
    if (file) {
      setNewStamp(prev => ({ ...prev, imageFile: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setNewStamp(prev => ({ ...prev, imagePreview: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadStamp = async () => {
    if (!newStamp.imageFile) {
      toast({
        title: "Missing Information",
        description: "Please upload a stamp image",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('stamp', newStamp.imageFile);
      formData.append('notaryId', notaryId.toString());

      const token = localStorage.getItem('token');
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
        
        const filename = responseData.upload.processedPath.split('/').pop();
        
        const newStampData = {
          id: responseData.upload.id,
          imageUrl: `/uploads/stamps/${notaryId}/${filename}`,
          isActive: stamps.length === 0, // Make first stamp active
          uploadedAt: new Date().toISOString().split('T')[0]
        };
        
        setStamps(prev => [...prev, newStampData]);
        
        // Reset form
        setNewStamp({
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
        description: error instanceof Error ? error.message : "Failed to upload stamp",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSetActive = async (stampId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/notary/stamps/${stampId}/activate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setStamps(prev => prev.map(stamp => ({
          ...stamp,
          isActive: stamp.id === stampId
        })));
        
        toast({
          title: "Stamp Activated",
          description: "This stamp is now your active notary seal",
        });
      }
    } catch (error) {
      console.error('Error activating stamp:', error);
      toast({
        title: "Error",
        description: "Failed to activate stamp",
        variant: "destructive",
      });
    }
  };

  const handleDeleteStamp = async (stampId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/notary/stamps/${stampId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (response.ok) {
        setStamps(prev => prev.filter(stamp => stamp.id !== stampId));
        toast({
          title: "Stamp Deleted",
          description: "Stamp has been removed successfully",
        });
      }
    } catch (error) {
      console.error('Error deleting stamp:', error);
      toast({
        title: "Error",
        description: "Failed to delete stamp",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading notary stamps...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Notary Stamps</h3>
        <Button onClick={() => setShowUploadForm(true)} size="sm">
          <Upload className="w-4 h-4 mr-2" />
          Upload
        </Button>
      </div>

      {showUploadForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-gray-100"
              />
            </div>

            {newStamp.imagePreview && (
              <div className="border rounded p-4">
                <img
                  src={newStamp.imagePreview}
                  alt="Preview"
                  className="h-20 mx-auto object-contain"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowUploadForm(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUploadStamp}
                disabled={!newStamp.imageFile || uploading}
              >
                {uploading ? 'Uploading...' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {stamps.length > 0 ? (
        <div className="grid gap-4">
          {stamps.map((stamp) => (
            <Card key={stamp.id} className={stamp.isActive ? 'ring-2 ring-blue-500' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <img
                    src={stamp.imageUrl}
                    alt="Stamp"
                    className="w-16 h-16 object-contain border rounded"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Notary Stamp</span>
                      {stamp.isActive && <Badge variant="secondary">Active</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!stamp.isActive && (
                      <Button size="sm" variant="outline" onClick={() => handleSetActive(stamp.id)}>
                        Set Active
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded">
          <Image className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="font-medium mb-2">No stamps uploaded</h3>
          <p className="text-sm text-gray-600 mb-4">Upload your notary stamp to use in documents</p>
          <Button onClick={() => setShowUploadForm(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Stamp
          </Button>
        </div>
      )}
    </div>
  );
} 