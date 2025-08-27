import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { 
  Upload, 
  Pencil, 
  Type, 
  Download, 
  Trash2, 
  Star, 
  RotateCcw, 
  Check,
  Eye,
  Plus,
  Save,
  X,
  Shield,
  Calendar
} from "lucide-react";

interface UserSignature {
  id: string;
  name: string;
  type: 'uploaded' | 'drawn' | 'generated';
  imageUrl: string;
  isDefault: boolean;
  createdAt: string;
  metadata?: {
    originalName?: string;
    fontFamily?: string;
    style?: string;
  };
}

interface SignatureManagerProps {
  userId: number;
  onSignatureSelect?: (signature: UserSignature) => void;
}

const SIGNATURE_FONTS = [
  { name: 'Allura', value: 'Allura, cursive' },
  { name: 'Dancing Script', value: 'Dancing Script, cursive' },
  { name: 'Great Vibes', value: 'Great Vibes, cursive' },
  { name: 'Pacifico', value: 'Pacifico, cursive' },
  { name: 'Sacramento', value: 'Sacramento, cursive' },
  { name: 'Satisfy', value: 'Satisfy, cursive' },
  { name: 'Signature', value: 'Signature, cursive' }
];

export function SignatureManager({ userId, onSignatureSelect }: SignatureManagerProps) {
  const [signatures, setSignatures] = useState<UserSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Upload states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string>('');
  const [uploadName, setUploadName] = useState('');
  
  // Draw states
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(3);
  const [drawName, setDrawName] = useState('');
  
  // Generate states
  const [generatedText, setGeneratedText] = useState('');
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0]);
  const [fontSize, setFontSize] = useState(48);
  const [generateName, setGenerateName] = useState('');

  useEffect(() => {
    loadSignatures();
  }, [userId]);

  // Initialize canvas when draw tab is active
  useEffect(() => {
    if (canvasRef.current && activeTab === 'draw') {
      initializeCanvas();
    }
  }, [activeTab]);

  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 400;
    canvas.height = 150;

    // Set white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Configure drawing context
    ctx.strokeStyle = 'black';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const loadSignatures = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${userId}/signatures`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSignatures(data);
      } else {
        // Demo data for development
        setSignatures([
          {
            id: '1',
            name: 'Primary Signature',
            type: 'drawn',
            imageUrl: '/api/placeholder/signature',
            isDefault: true,
            createdAt: '2024-01-15',
            metadata: { style: 'handwritten' }
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading signatures:', error);
    } finally {
      setLoading(false);
    }
  };

  // Upload functionality
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploadFile(file);
    setUploadName(file.name.replace(/\.[^/.]+$/, ""));

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const saveUploadedSignature = async () => {
    if (!uploadFile || !uploadName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a name and select a file",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('signature', uploadFile);
      formData.append('name', uploadName);
      formData.append('type', 'uploaded');

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${userId}/signatures`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const newSignature = await response.json();
        setSignatures(prev => [...prev, newSignature]);
        resetUploadForm();
        setIsCreateModalOpen(false);
        toast({
          title: "Signature Saved",
          description: "Your signature has been uploaded successfully",
        });
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to save signature. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadPreview('');
    setUploadName('');
  };

  // Draw functionality
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = brushSize;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    initializeCanvas();
  };

  const saveDrawnSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !drawName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a name and draw your signature",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const imageData = canvas.toDataURL('image/png');
      
      const response = await fetch(`/api/users/${userId}/signatures`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: drawName,
          type: 'drawn',
          imageData
        })
      });

      if (response.ok) {
        const newSignature = await response.json();
        setSignatures(prev => [...prev, newSignature]);
        setDrawName('');
        clearCanvas();
        setIsCreateModalOpen(false);
        toast({
          title: "Signature Saved",
          description: "Your drawn signature has been saved successfully",
        });
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save signature. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate functionality
  const generateSignaturePreview = () => {
    if (!generatedText.trim()) return null;

    return (
      <div
        className="bg-white border rounded-lg p-4 text-center"
        style={{
          fontFamily: selectedFont.value,
          fontSize: `${fontSize}px`,
          color: 'black',
          minHeight: '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {generatedText}
      </div>
    );
  };

  const generateSignatureImage = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      // Create a canvas element to generate the signature image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Set canvas size
      canvas.width = 400;
      canvas.height = 150;

      // Set white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Apply font styling - this will use the Google Fonts loaded in the browser
      ctx.fillStyle = 'black';
      ctx.font = `${fontSize}px ${selectedFont.value}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw the text
      ctx.fillText(generatedText, canvas.width / 2, canvas.height / 2);

      // Convert to blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to generate signature image'));
        }
      }, 'image/png');
    });
  };

  const saveGeneratedSignature = async () => {
    if (!generatedText.trim() || !generateName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a name and text for your signature",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Generate the signature image on the client side
      const imageBlob = await generateSignatureImage();
      
      // Create form data with the generated image
      const formData = new FormData();
      formData.append('signature', imageBlob, `generated_${Date.now()}.png`);
      formData.append('name', generateName);
      formData.append('type', 'generated');
      formData.append('metadata', JSON.stringify({
        text: generatedText,
        fontFamily: selectedFont.value,
        fontSize: fontSize
      }));

      const response = await fetch(`/api/users/${userId}/signatures`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (response.ok) {
        const newSignature = await response.json();
        setSignatures(prev => [...prev, newSignature]);
        setGeneratedText('');
        setGenerateName('');
        setIsCreateModalOpen(false);
        toast({
          title: "Signature Saved",
          description: "Your generated signature has been saved successfully",
        });
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save signature. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Management functions
  const setDefaultSignature = async (signatureId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${userId}/signatures/${signatureId}/default`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setSignatures(prev => prev.map(sig => ({
          ...sig,
          isDefault: sig.id === signatureId
        })));
        toast({
          title: "Default Set",
          description: "This signature is now your default",
        });
      }
    } catch (error) {
      console.error('Error setting default:', error);
    }
  };

  const deleteSignature = async (signatureId: string) => {
    if (!confirm('Are you sure you want to delete this signature?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${userId}/signatures/${signatureId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setSignatures(prev => prev.filter(sig => sig.id !== signatureId));
        toast({
          title: "Signature Deleted",
          description: "Signature has been removed",
        });
      }
    } catch (error) {
      console.error('Error deleting signature:', error);
    }
  };

  const closeModal = () => {
    setIsCreateModalOpen(false);
    setActiveTab('upload');
    resetUploadForm();
    setDrawName('');
    clearCanvas();
    setGeneratedText('');
    setGenerateName('');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Loading signatures...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Signatures</h3>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Signature</DialogTitle>
            </DialogHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="upload">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="draw">
                  <Pencil className="w-4 h-4 mr-2" />
                  Draw
                </TabsTrigger>
                <TabsTrigger value="generate">
                  <Type className="w-4 h-4 mr-2" />
                  Generate
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="upload-name">Name</Label>
                    <Input
                      id="upload-name"
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder="My Signature"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="signature-file">Upload Image</Label>
                    <Input
                      id="signature-file"
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                    />
                  </div>

                  {uploadPreview && (
                    <div className="border rounded p-4">
                      <img
                        src={uploadPreview}
                        alt="Preview"
                        className="h-20 mx-auto object-contain"
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={resetUploadForm}>
                      Clear
                    </Button>
                    <Button 
                      onClick={saveUploadedSignature}
                      disabled={!uploadFile || !uploadName.trim() || isProcessing}
                    >
                      {isProcessing ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="draw" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="draw-name">Name</Label>
                    <Input
                      id="draw-name"
                      value={drawName}
                      onChange={(e) => setDrawName(e.target.value)}
                      placeholder="My Signature"
                    />
                  </div>

                  <div>
                    <Label>Brush Size: {brushSize}px</Label>
                    <Slider
                      value={[brushSize]}
                      onValueChange={(value) => setBrushSize(value[0])}
                      min={1}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <Label>Draw your signature</Label>
                    <div className="border rounded p-4">
                      <canvas
                        ref={canvasRef}
                        className="border rounded cursor-crosshair mx-auto"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        style={{ width: '100%', maxWidth: '400px', height: '150px' }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={clearCanvas}>
                      Clear
                    </Button>
                    <Button 
                      onClick={saveDrawnSignature}
                      disabled={!drawName.trim() || isProcessing}
                    >
                      {isProcessing ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="generate" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="generate-name">Name</Label>
                    <Input
                      id="generate-name"
                      value={generateName}
                      onChange={(e) => setGenerateName(e.target.value)}
                      placeholder="My Signature"
                    />
                  </div>

                  <div>
                    <Label htmlFor="signature-text">Your Name</Label>
                    <Input
                      id="signature-text"
                      value={generatedText}
                      onChange={(e) => setGeneratedText(e.target.value)}
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <Label>Font</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {SIGNATURE_FONTS.map((font) => (
                        <Button
                          key={font.name}
                          variant={selectedFont.name === font.name ? "default" : "outline"}
                          onClick={() => setSelectedFont(font)}
                          className="justify-start"
                          style={{ fontFamily: font.value }}
                        >
                          {font.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Size: {fontSize}px</Label>
                    <Slider
                      value={[fontSize]}
                      onValueChange={(value) => setFontSize(value[0])}
                      min={24}
                      max={72}
                      step={4}
                      className="w-full"
                    />
                  </div>

                  {generatedText && (
                    <div>
                      <Label>Preview</Label>
                      <div className="border rounded p-4 text-center">
                        {generateSignaturePreview()}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setGeneratedText('')}>
                      Clear
                    </Button>
                    <Button 
                      onClick={saveGeneratedSignature}
                      disabled={!generatedText.trim() || !generateName.trim() || isProcessing}
                    >
                      {isProcessing ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {signatures.length > 0 ? (
        <div className="grid gap-4">
          {signatures.map((signature) => (
            <Card key={signature.id} className={signature.isDefault ? 'ring-2 ring-blue-500' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <img
                    src={signature.imageUrl}
                    alt={signature.name}
                    className="w-16 h-16 object-contain border rounded"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{signature.name}</span>
                      {signature.isDefault && <Badge variant="secondary">Default</Badge>}
                      <Badge variant="outline" className="text-xs">
                        {signature.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      Created {new Date(signature.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!signature.isDefault && (
                      <Button size="sm" variant="outline" onClick={() => setDefaultSignature(signature.id)}>
                        <Star className="w-4 h-4 mr-1" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteSignature(signature.id)}
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
          <Pencil className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="font-medium mb-2">No signatures created</h3>
          <p className="text-sm text-gray-600 mb-4">Create your first signature to use in documents</p>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Signature
          </Button>
        </div>
      )}
    </div>
  );
}
