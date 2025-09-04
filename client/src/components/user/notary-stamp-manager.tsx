import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { 
  Upload, Image, Trash2, 
  FileText, Download, Eye, Plus, X,
  CheckCircle, AlertCircle, Loader2
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

interface StampImageProps {
  imageUrl: string;
  onLoad?: () => void;
  onError?: () => void;
}

function StampImage({ imageUrl, onLoad, onError }: StampImageProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        setLoading(true);
        setError(false);
        
        console.log(`🔄 Loading stamp image: ${imageUrl}`);
        
        // Fetch the image with authentication
        const token = localStorage.getItem('token');
        console.log(`🔑 Using token: ${token ? 'Present' : 'Missing'}`);
        
        const response = await fetch(imageUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        console.log(`📡 Fetch response: ${response.status} ${response.statusText}`);

        if (response.ok) {
          const blob = await response.blob();
          console.log(`📦 Blob created: ${blob.size} bytes, type: ${blob.type}`);
          
          const objectUrl = URL.createObjectURL(blob);
          console.log(`🔗 Object URL created: ${objectUrl.substring(0, 50)}...`);
          
          setImageSrc(objectUrl);
          onLoad?.();
          console.log(`✅ Stamp image loaded successfully`);
        } else {
          const errorText = await response.text();
          console.error(`❌ HTTP Error ${response.status}: ${errorText}`);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      } catch (err) {
        console.error('❌ Failed to load stamp image:', err);
        setError(true);
        onError?.();
      } finally {
        setLoading(false);
      }
    };

    if (imageUrl) {
      loadImage();
    }

    // Cleanup object URL on unmount
    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageUrl]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !imageSrc) {
    return (
      <div className="text-gray-400 text-xs text-center">
        Image<br/>not found
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt="Stamp"
      className="max-w-full max-h-full object-contain"
    />
  );
}

export function NotaryStampManager({ notaryId, onStampSelect }: NotaryStampManagerProps) {
  const [stamps, setStamps] = useState<NotaryStamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedStamp, setSelectedStamp] = useState<NotaryStamp | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states for new stamp - simplified to just image
  const [newStamp, setNewStamp] = useState({
    imageFile: null as File | null,
    imagePreview: '',
    error: ''
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
        console.log('Loaded stamps data:', stampsData);
        
        const mappedStamps = stampsData.map((stamp: any) => {
          console.log('Processing stamp:', { id: stamp.id, imageUrl: stamp.imageUrl });
          return {
            id: stamp.id,
            imageUrl: stamp.imageUrl,
            isActive: stamp.isActive,
            uploadedAt: stamp.uploadedAt
          };
        });
        
        setStamps(mappedStamps);
      } else {
        console.error('Failed to load stamps, status:', response.status);
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

  const validateFile = (file: File): string | null => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!allowedTypes.includes(file.type)) {
      return 'Please upload a valid image file (JPEG, PNG, GIF, or WebP)';
    }
    
    if (file.size > maxSize) {
      return 'File size must be less than 5MB';
    }
    
    return null;
  };

  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setNewStamp(prev => ({ ...prev, error }));
      return;
    }
    
    setNewStamp(prev => ({ ...prev, imageFile: file, error: '' }));
    
    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setNewStamp(prev => ({ ...prev, imagePreview: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUploadStamp = async () => {
    if (!newStamp.imageFile) {
      setNewStamp(prev => ({ ...prev, error: 'Please select a file to upload' }));
      return;
    }

    if (newStamp.error) {
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('stamp', newStamp.imageFile);
      formData.append('notaryId', notaryId.toString());

      const token = localStorage.getItem('token');
      
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/uploads/notary-stamp', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.ok) {
        const responseData = await response.json();
        console.log('Upload response:', responseData);
        
        const newStampData = {
          id: responseData.stampId.toString(),
          imageUrl: `/api/uploads/notary-stamp/${responseData.fileKey}`,
          isActive: stamps.length === 0, // Make first stamp active
          uploadedAt: new Date().toISOString().split('T')[0]
        };
        
        setStamps(prev => [...prev, newStampData]);
        
        // Reset form
        setNewStamp({
          imageFile: null,
          imagePreview: '',
          error: ''
        });
        setShowUploadForm(false);
        setUploadProgress(0);

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
      setUploadProgress(0);
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
          <CardHeader>
            <CardTitle className="text-lg">Upload Notary Stamp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Drag and Drop Area */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              } ${newStamp.error ? 'border-red-500 bg-red-50' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              {newStamp.imagePreview ? (
                <div className="space-y-4">
                  <img
                    src={newStamp.imagePreview}
                    alt="Preview"
                    className="h-32 mx-auto object-contain rounded border"
                  />
                  <div className="text-sm text-gray-600">
                    {newStamp.imageFile?.name}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 mx-auto text-gray-400" />
                  <div>
                    <p className="text-lg font-medium text-gray-900">
                      Drop your stamp image here
                    </p>
                    <p className="text-sm text-gray-600">
                      or click to browse files
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">
                    Supports JPEG, PNG, GIF, WebP (max 5MB)
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {newStamp.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{newStamp.error}</AlertDescription>
              </Alert>
            )}

            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowUploadForm(false);
                  setNewStamp({ imageFile: null, imagePreview: '', error: '' });
                }}
                disabled={uploading}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={handleUploadStamp}
                disabled={!newStamp.imageFile || uploading || !!newStamp.error}
                className="flex-1"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Upload Stamp
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {stamps.length > 0 ? (
        <div className="grid gap-4">
          {stamps.map((stamp) => (
            <Card key={stamp.id} className={`transition-all hover:shadow-md ${stamp.isActive ? 'ring-2 ring-blue-500 bg-blue-50/50' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-20 h-20 border rounded-lg bg-white shadow-sm flex items-center justify-center overflow-hidden">
                      <StampImage 
                        imageUrl={stamp.imageUrl} 
                        onLoad={() => console.log(`✅ Stamp image loaded: ${stamp.imageUrl}`)}
                        onError={() => console.error(`❌ Failed to load stamp: ${stamp.imageUrl}`)}
                      />
                    </div>
                    {stamp.isActive && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">Notary Stamp</span>
                      {stamp.isActive && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      Uploaded {stamp.uploadedAt}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!stamp.isActive && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleSetActive(stamp.id)}
                        className="hover:bg-blue-50"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Set Active
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteStamp(stamp.id)}
                      className="hover:bg-red-50 hover:text-red-600"
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
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50/50">
          <Image className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No stamps uploaded</h3>
          <p className="text-sm text-gray-600 mb-6 max-w-sm mx-auto">
            Upload your notary stamp to use in documents. Your stamp will be applied to notarized documents.
          </p>
          <Button onClick={() => setShowUploadForm(true)} size="lg">
            <Upload className="w-5 h-5 mr-2" />
            Upload Stamp
          </Button>
        </div>
      )}
    </div>
  );
} 