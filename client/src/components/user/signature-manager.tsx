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
      const response = await fetch(`/api/users/${userId}/signatures`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: generateName,
          type: 'generated',
          text: generatedText,
          fontFamily: selectedFont.value,
          fontSize
        })
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
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Signature Manager
            </h2>
            <p className="text-gray-600 text-lg">Create and manage your digital signatures for document signing</p>
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Upload className="w-4 h-4" />
                <span>Upload Images</span>
              </div>
              <div className="flex items-center gap-1">
                <Pencil className="w-4 h-4" />
                <span>Draw Signatures</span>
              </div>
              <div className="flex items-center gap-1">
                <Type className="w-4 h-4" />
                <span>Generate Text</span>
              </div>
            </div>
          </div>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => setIsCreateModalOpen(true)}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create New Signature
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-white to-gray-50">
              <DialogHeader className="pb-6">
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Create New Signature
                </DialogTitle>
                <p className="text-gray-600 mt-2">Choose your preferred method to create a professional digital signature</p>
              </DialogHeader>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 h-14 p-1 bg-gray-100 rounded-xl">
                  <TabsTrigger 
                    value="upload" 
                    className="h-12 rounded-lg font-medium data-[state=active]:bg-white data-[state=active]:shadow-md transition-all duration-200"
                  >
                    <Upload className="w-5 h-5 mr-2" />
                    Upload Image
                  </TabsTrigger>
                  <TabsTrigger 
                    value="draw"
                    className="h-12 rounded-lg font-medium data-[state=active]:bg-white data-[state=active]:shadow-md transition-all duration-200"
                  >
                    <Pencil className="w-5 h-5 mr-2" />
                    Draw Signature
                  </TabsTrigger>
                  <TabsTrigger 
                    value="generate"
                    className="h-12 rounded-lg font-medium data-[state=active]:bg-white data-[state=active]:shadow-md transition-all duration-200"
                  >
                    <Type className="w-5 h-5 mr-2" />
                    Generate Text
                  </TabsTrigger>
                </TabsList>

                {/* Enhanced Upload Tab */}
                <TabsContent value="upload" className="space-y-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="upload-name" className="text-sm font-semibold text-gray-700">
                          Signature Name *
                        </Label>
                        <Input
                          id="upload-name"
                          value={uploadName}
                          onChange={(e) => setUploadName(e.target.value)}
                          placeholder="e.g., Professional Signature, Formal Signature"
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="signature-file" className="text-sm font-semibold text-gray-700">
                          Upload Signature Image *
                        </Label>
                        <div 
                          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200 group"
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                            const files = e.dataTransfer.files;
                            if (files && files[0]) {
                              const file = files[0];
                              if (file.type.startsWith('image/')) {
                                const fakeEvent = { target: { files: [file] } } as any;
                                handleFileUpload(fakeEvent);
                              }
                            }
                          }}
                        >
                          <Upload className="w-12 h-12 text-gray-400 group-hover:text-blue-500 mx-auto mb-4 transition-colors duration-200" />
                          <Input
                            id="signature-file"
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          <label htmlFor="signature-file" className="cursor-pointer">
                            <div className="text-lg font-medium text-gray-700 group-hover:text-blue-700 mb-2 transition-colors duration-200">
                              Drop your signature image here
                            </div>
                            <div className="text-sm text-gray-500 mb-4">
                              or click to browse files
                            </div>
                            <div className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-600 transition-colors duration-200 shadow-sm">
                              Choose File
                            </div>
                          </label>
                          <p className="text-xs text-gray-400 mt-4">
                            Supports PNG, JPG, GIF and other image formats • Maximum 5MB
                          </p>
                        </div>
                      </div>

                      {uploadPreview && (
                        <div className="border border-gray-200 rounded-xl p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
                          <Label className="text-sm font-semibold text-gray-700 mb-3 block">
                            Preview
                          </Label>
                          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                            <img
                              src={uploadPreview}
                              alt="Signature preview"
                              className="max-w-full h-auto max-h-32 mx-auto"
                            />
                          </div>
                          <div className="mt-3 text-center">
                            <span className="text-sm text-gray-600">
                              Your signature will appear like this in documents
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <Button variant="outline" onClick={resetUploadForm} className="px-6">
                          <X className="w-4 h-4 mr-2" />
                          Clear
                        </Button>
                        <Button 
                          onClick={saveUploadedSignature}
                          disabled={!uploadFile || !uploadName.trim() || isProcessing}
                          className="px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {isProcessing ? 'Saving...' : 'Save Signature'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Enhanced Draw Tab */}
                <TabsContent value="draw" className="space-y-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="draw-name" className="text-sm font-semibold text-gray-700">
                          Signature Name *
                        </Label>
                        <Input
                          id="draw-name"
                          value={drawName}
                          onChange={(e) => setDrawName(e.target.value)}
                          placeholder="e.g., Hand-drawn Signature, Personal Sign"
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-gray-700">
                          Brush Settings
                        </Label>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Brush Size</span>
                            <span className="text-sm font-medium text-blue-600">{brushSize}px</span>
                          </div>
                          <Slider
                            value={[brushSize]}
                            onValueChange={(value) => setBrushSize(value[0])}
                            min={1}
                            max={10}
                            step={1}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>Fine</span>
                            <span>Thick</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-gray-700">
                          Drawing Canvas
                        </Label>
                        <div className="border-2 border-gray-300 rounded-xl p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
                          <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                            <canvas
                              ref={canvasRef}
                              className="border border-gray-200 rounded-lg cursor-crosshair mx-auto shadow-sm"
                              onMouseDown={startDrawing}
                              onMouseMove={draw}
                              onMouseUp={stopDrawing}
                              onMouseLeave={stopDrawing}
                              style={{ width: '100%', maxWidth: '450px', height: '180px' }}
                            />
                          </div>
                          <div className="mt-4 text-center">
                            <p className="text-sm text-gray-600 mb-2">
                              <Pencil className="w-4 h-4 inline mr-1" />
                              Click and drag to draw your signature
                            </p>
                            <p className="text-xs text-gray-500">
                              Use your mouse or trackpad to create a natural-looking signature
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <Button variant="outline" onClick={clearCanvas} className="px-6">
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Clear Canvas
                        </Button>
                        <Button 
                          onClick={saveDrawnSignature}
                          disabled={!drawName.trim() || isProcessing}
                          className="px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {isProcessing ? 'Saving...' : 'Save Signature'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Enhanced Generate Tab */}
                <TabsContent value="generate" className="space-y-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="generate-name" className="text-sm font-semibold text-gray-700">
                          Signature Name *
                        </Label>
                        <Input
                          id="generate-name"
                          value={generateName}
                          onChange={(e) => setGenerateName(e.target.value)}
                          placeholder="e.g., Elegant Signature, Script Style"
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signature-text" className="text-sm font-semibold text-gray-700">
                          Your Name *
                        </Label>
                        <Input
                          id="signature-text"
                          value={generatedText}
                          onChange={(e) => setGeneratedText(e.target.value)}
                          placeholder="Enter your full name"
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-gray-700">
                          Font Style
                        </Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {SIGNATURE_FONTS.map((font) => (
                            <Button
                              key={font.name}
                              variant={selectedFont.name === font.name ? "default" : "outline"}
                              onClick={() => setSelectedFont(font)}
                              className={`h-12 justify-start text-left transition-all duration-200 ${
                                selectedFont.name === font.name 
                                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' 
                                  : 'hover:bg-blue-50 hover:border-blue-300'
                              }`}
                              style={{ fontFamily: font.value }}
                            >
                              <span className="text-lg">{font.name}</span>
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-gray-700">
                          Font Size
                        </Label>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Size</span>
                            <span className="text-sm font-medium text-blue-600">{fontSize}px</span>
                          </div>
                          <Slider
                            value={[fontSize]}
                            onValueChange={(value) => setFontSize(value[0])}
                            min={24}
                            max={72}
                            step={4}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>Small (24px)</span>
                            <span>Large (72px)</span>
                          </div>
                        </div>
                      </div>

                      {generatedText && (
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold text-gray-700">
                            Live Preview
                          </Label>
                          <div className="border-2 border-gray-300 rounded-xl p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
                            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                              {generateSignaturePreview()}
                            </div>
                            <div className="mt-4 text-center">
                              <span className="text-sm text-gray-600">
                                Your signature will appear like this in documents
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <Button variant="outline" onClick={() => setGeneratedText('')} className="px-6">
                          <X className="w-4 h-4 mr-2" />
                          Clear Text
                        </Button>
                        <Button 
                          onClick={saveGeneratedSignature}
                          disabled={!generatedText.trim() || !generateName.trim() || isProcessing}
                          className="px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {isProcessing ? 'Saving...' : 'Save Signature'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Enhanced Signatures Grid */}
      {signatures.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Your Signatures</h3>
            <span className="text-sm text-gray-500">{signatures.length} signature{signatures.length !== 1 ? 's' : ''} created</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {signatures.map((signature) => (
              <Card 
                key={signature.id} 
                className={`group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                  signature.isDefault 
                    ? 'ring-2 ring-blue-500 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50' 
                    : 'hover:shadow-lg bg-white'
                }`}
              >
                {signature.isDefault && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-blue-600 to-indigo-600 text-white px-3 py-1 rounded-bl-lg">
                    <Star className="w-3 h-3 inline mr-1" />
                    <span className="text-xs font-medium">Default</span>
                  </div>
                )}
                
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-semibold text-gray-900 pr-8">
                        {signature.name}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            signature.type === 'uploaded' ? 'border-green-200 text-green-700 bg-green-50' :
                            signature.type === 'drawn' ? 'border-purple-200 text-purple-700 bg-purple-50' :
                            'border-orange-200 text-orange-700 bg-orange-50'
                          }`}
                        >
                          {signature.type === 'uploaded' ? (
                            <>
                              <Upload className="w-3 h-3 mr-1" />
                              Uploaded
                            </>
                          ) : signature.type === 'drawn' ? (
                            <>
                              <Pencil className="w-3 h-3 mr-1" />
                              Hand-drawn
                            </>
                          ) : (
                            <>
                              <Type className="w-3 h-3 mr-1" />
                              Generated
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Enhanced Signature Preview */}
                  <div className="relative group">
                    <div className="border-2 border-gray-200 rounded-xl p-6 bg-white shadow-sm group-hover:shadow-md transition-shadow duration-200">
                      <img
                        src={signature.imageUrl}
                        alt={signature.name}
                        className="w-full h-16 object-contain"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-5 rounded-xl transition-all duration-200"></div>
                  </div>

                  {/* Enhanced Signature Details */}
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>Created {new Date(signature.createdAt).toLocaleDateString()}</span>
                    </div>
                    {signature.metadata?.fontFamily && (
                      <div className="flex items-center gap-2">
                        <Type className="w-4 h-4" />
                        <span style={{ fontFamily: signature.metadata.fontFamily }}>
                          {signature.metadata.fontFamily.split(',')[0]}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Enhanced Actions */}
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    {!signature.isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDefaultSignature(signature.id)}
                        className="flex-1 hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700 transition-colors duration-200"
                      >
                        <Star className="w-4 h-4 mr-1" />
                        Set Default
                      </Button>
                    )}
                    
                    {onSignatureSelect && (
                      <Button
                        size="sm"
                        onClick={() => onSignatureSelect(signature)}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Use
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteSignature(signature.id)}
                      className="hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors duration-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {signatures.length === 0 && (
        <div className="text-center py-16">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-12 border border-blue-100">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Pencil className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Create Your First Signature</h3>
            <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto">
              Get started by creating a digital signature that you can use across all your document signing sessions
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 max-w-2xl mx-auto">
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Upload</h4>
                <p className="text-sm text-gray-600">Upload an existing signature image</p>
              </div>
              
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Pencil className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Draw</h4>
                <p className="text-sm text-gray-600">Draw your signature using mouse or trackpad</p>
              </div>
              
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Type className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Generate</h4>
                <p className="text-sm text-gray-600">Create a signature from text with elegant fonts</p>
              </div>
            </div>
            
            <Button 
              onClick={() => setIsCreateModalOpen(true)}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Signature
            </Button>
          </div>
        </div>
      )}

      {/* Enhanced Usage Notice */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">Secure & Convenient</h4>
            <p className="text-gray-600 leading-relaxed">
              Your signatures are securely encrypted and stored, ready to use across all document signing sessions. 
              Your default signature will be automatically selected when signing documents, saving you time and ensuring consistency.
            </p>
            <div className="flex items-center gap-6 text-sm text-gray-500 mt-3">
              <div className="flex items-center gap-1">
                <Shield className="w-4 h-4" />
                <span>Encrypted Storage</span>
              </div>
              <div className="flex items-center gap-1">
                <Check className="w-4 h-4" />
                <span>Auto-Selection</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4" />
                <span>Default Support</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
