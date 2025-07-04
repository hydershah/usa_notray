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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notary Stamps</h2>
          <p className="text-gray-600">Manage your official notary stamps for document signing</p>
        </div>
        <Button onClick={() => setShowUploadForm(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Upload Stamp
        </Button>
      </div>

      {/* Upload Form - Simplified */}
      {showUploadForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Upload New Notary Stamp
              <Button variant="ghost" size="sm" onClick={() => setShowUploadForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <p className="text-sm font-medium mb-2">Preview:</p>
                <img
                  src={newStamp.imagePreview}
                  alt="Stamp preview"
                  className="max-w-full h-32 object-contain mx-auto border rounded"
                />
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowUploadForm(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUploadStamp}
                disabled={!newStamp.imageFile || uploading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {uploading ? 'Uploading...' : 'Upload Stamp'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stamps Grid - Simplified */}
      {stamps.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stamps.map((stamp) => (
            <Card key={stamp.id} className={`${stamp.isActive ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Notary Stamp</CardTitle>
                  {stamp.isActive && (
                    <Badge className="bg-blue-100 text-blue-800">Active</Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Stamp Image */}
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <img
                    src={stamp.imageUrl}
                    alt="Notary Stamp"
                    className="w-full h-32 object-contain"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
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
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Use
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteStamp(stamp.id)}
                    className="hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-12 border border-blue-100">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Image className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Upload Your First Notary Stamp</h3>
            <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto">
              Upload a clear image of your official notary stamp to use in document signing sessions
            </p>
            
            <Button 
              onClick={() => setShowUploadForm(true)}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="w-5 h-5 mr-2" />
              Upload Your First Stamp
            </Button>
          </div>
        </div>
      )}

      {/* Usage Notice */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">Official Notary Stamp</h4>
            <p className="text-gray-600 leading-relaxed">
              Your notary stamp images are securely stored and ready for use in document signing sessions. 
              Your active stamp will be automatically applied when notarizing documents.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 