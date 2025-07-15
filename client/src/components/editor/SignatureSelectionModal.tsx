import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { 
  Upload, 
  Pencil, 
  Type, 
  Trash2, 
  Star, 
  RotateCcw, 
  Check,
  Plus,
  Save,
  X,
  Loader2,
  FileImage
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

interface SignatureSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (signatureUrl: string) => void;
  userId: number;
}

const SIGNATURE_FONTS = [
  { name: 'Allura', value: 'Allura, cursive' },
  { name: 'Dancing Script', value: 'Dancing Script, cursive' },
  { name: 'Great Vibes', value: 'Great Vibes, cursive' },
  { name: 'Kaushan Script', value: 'Kaushan Script, cursive' },
  { name: 'Pacifico', value: 'Pacifico, cursive' },
  { name: 'Sacramento', value: 'Sacramento, cursive' }
];

export const SignatureSelectionModal: React.FC<SignatureSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  userId
}) => {
  const [signatures, setSignatures] = useState<UserSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('existing');
  const [isProcessing, setIsProcessing] = useState(false);

  // Upload states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string>('');
  const [uploadName, setUploadName] = useState('');

  // Drawing states
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawName, setDrawName] = useState('');

  // Generated signature states
  const [generatedText, setGeneratedText] = useState('');
  const [generateName, setGenerateName] = useState('');
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0]);
  const [fontSize, setFontSize] = useState(32);

  useEffect(() => {
    if (isOpen) {
      loadSignatures();
      initializeCanvas();
    }
  }, [isOpen, userId]);

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
    ctx.lineWidth = 2;
  };

  const loadSignatures = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading signatures for user:', userId);
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('❌ No authentication token found');
        setSignatures([]);
        return;
      }
      
      const response = await fetch(`/api/users/${userId}/signatures`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Signatures API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Signatures loaded:', {
          count: data.length,
          signatures: data.map((sig: any) => ({
            id: sig.id,
            name: sig.name,
            type: sig.type,
            hasImageUrl: !!sig.imageUrl,
            imageUrlLength: sig.imageUrl?.length || 0
          }))
        });
        setSignatures(data);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to load signatures:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        // Show error message to user
        toast({
          title: "Failed to Load Signatures",
          description: `Server returned ${response.status}: ${response.statusText}`,
          variant: "destructive"
        });
        
        setSignatures([]);
      }
    } catch (error) {
      console.error('❌ Error loading signatures:', error);
      
      // Show error message to user
      toast({
        title: "Network Error",
        description: "Failed to connect to the server. Please check your connection.",
        variant: "destructive"
      });
      
      setSignatures([]);
    } finally {
      setLoading(false);
    }
  };

  // Drawing functionality
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    console.log('📤 Uploading signature:', {
      fileName: uploadFile.name,
      fileSize: uploadFile.size,
      fileType: uploadFile.type,
      signatureName: uploadName
    });

    try {
      const formData = new FormData();
      formData.append('signature', uploadFile);
      formData.append('name', uploadName);
      formData.append('type', 'uploaded');

      const token = localStorage.getItem('token');
      console.log('📡 Sending signature upload request...');
      
      const response = await fetch(`/api/users/${userId}/signatures`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      console.log('📡 Upload response status:', response.status);

      if (response.ok) {
        const newSignature = await response.json();
        console.log('✅ Signature uploaded successfully:', newSignature);
        
        setSignatures(prev => [...prev, newSignature]);
        setUploadFile(null);
        setUploadPreview('');
        setUploadName('');
        
        toast({
          title: "Signature Saved",
          description: "Your uploaded signature has been saved successfully",
        });
        
        // Auto-select the new signature
        console.log('🎯 Auto-selecting uploaded signature:', newSignature.imageUrl);
        onSelect(newSignature.imageUrl);
        onClose();
      } else {
        const errorText = await response.text();
        console.error('❌ Upload failed:', {
          status: response.status,
          error: errorText
        });
        
        let errorMessage = 'Failed to save signature. Please try again.';
        
        if (response.status === 413) {
          errorMessage = 'File too large. Please choose a smaller image.';
        } else if (response.status === 400) {
          errorMessage = 'Invalid file format. Please use PNG, JPG, or GIF.';
        } else if (response.status === 403) {
          errorMessage = 'Access denied. Please refresh the page and try again.';
        }
        
        toast({
          title: "Upload Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Network error occurred. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const saveDrawnSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !drawName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please draw a signature and provide a name",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;

        const formData = new FormData();
        formData.append('signature', blob, 'signature.png');
        formData.append('name', drawName);
        formData.append('type', 'drawn');

        const token = localStorage.getItem('token');
        const response = await fetch(`/api/users/${userId}/signatures`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });

        if (response.ok) {
          const newSignature = await response.json();
          setSignatures(prev => [...prev, newSignature]);
          setDrawName('');
          clearCanvas();
          toast({
            title: "Signature Saved",
            description: "Your drawn signature has been saved successfully",
          });
          // Auto-select the new signature
          onSelect(newSignature.imageUrl);
          onClose();
        } else {
          throw new Error('Save failed');
        }
      });
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

  const generateSignaturePreview = () => {
    if (!generatedText.trim()) return null;

    return (
      <div
        className="bg-white border-2 border-gray-200 rounded-lg p-6 text-center min-h-[120px] flex items-center justify-center"
        style={{
          fontFamily: selectedFont.value,
          fontSize: `${fontSize}px`,
          color: 'black'
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
        toast({
          title: "Signature Saved",
          description: "Your generated signature has been saved successfully",
        });
        // Auto-select the new signature
        onSelect(newSignature.imageUrl);
        onClose();
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

  return (
    <>
      {/* Global styles to ensure modal appears above everything */}
      <style>{`
        [data-modal="signature-selection"] {
          z-index: 999999 !important;
        }
        [data-radix-dialog-overlay] {
          z-index: 999998 !important;
        }
        [data-radix-dialog-content] {
          z-index: 999999 !important;
        }
      `}</style>
      
      <Dialog 
        open={isOpen} 
        onOpenChange={(open) => !open && onClose()}
        modal={true}
      >
      <DialogContent 
        className="max-w-6xl max-h-[85vh] overflow-hidden"
        onPointerDownOutside={(e) => {
          e.preventDefault();
          onClose();
        }}
        onInteractOutside={(e) => {
          e.preventDefault();
          onClose();
        }}
        style={{ 
          zIndex: 999999,
          position: 'fixed'
        }}
        data-modal="signature-selection"
      >
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold">
            <Pencil className="h-6 w-6 text-blue-600" />
            Select Your Signature
          </DialogTitle>
        </DialogHeader>

        <div 
          className="flex-1 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="existing" className="flex items-center gap-2">
                <FileImage className="h-4 w-4" />
                My Signatures
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="draw" className="flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Draw
              </TabsTrigger>
              <TabsTrigger value="generate" className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                Generate
              </TabsTrigger>
            </TabsList>

            {/* Existing Signatures */}
            <TabsContent value="existing" className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                  <p className="text-gray-600 mt-4">Loading your signatures...</p>
                </div>
              ) : signatures.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {signatures.map((signature) => (
                    <Card 
                      key={signature.id}
                      className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-blue-500 hover:scale-[1.02] group"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log('🎯 Signature selected from modal:', signature.id, signature.imageUrl);
                        onSelect(signature.imageUrl);
                        onClose();
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <CardContent className="p-6">
                        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 mb-4 h-28 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                          <img 
                            src={signature.imageUrl} 
                            alt={signature.name}
                            className="max-h-20 max-w-full object-contain"
                            onError={(e) => {
                              console.error('Failed to load signature image:', signature.imageUrl);
                              (e.target as HTMLImageElement).src = '/api/placeholder/signature';
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 truncate">{signature.name}</p>
                            <p className="text-sm text-gray-500 capitalize">{signature.type}</p>
                          </div>
                          {signature.isDefault && (
                            <Star className="h-5 w-5 text-yellow-500 fill-current flex-shrink-0" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-500">
                  <Pencil className="h-16 w-16 mx-auto mb-6 text-gray-300" />
                  <p className="text-xl font-medium mb-2">No signatures found</p>
                  <p className="text-gray-400 mb-6">Create your first signature using the tabs above</p>
                  <Button
                    onClick={() => setActiveTab('upload')}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Signature
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Upload Tab */}
            <TabsContent value="upload" className="flex-1 overflow-y-auto space-y-6">
              <div className="max-w-md mx-auto space-y-6">
                <div>
                  <Label htmlFor="signature-name" className="text-base font-medium">Signature Name</Label>
                  <Input
                    id="signature-name"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    placeholder="Enter a name for your signature"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="text-base font-medium">Upload Signature Image</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mt-2 hover:border-blue-400 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="signature-upload"
                    />
                    <label htmlFor="signature-upload" className="cursor-pointer">
                      <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-lg text-gray-600 mb-2">
                        Click to upload a signature image
                      </p>
                      <p className="text-sm text-gray-500">
                        PNG, JPG, or JPEG files only (max 5MB)
                      </p>
                    </label>
                  </div>
                </div>

                {uploadPreview && (
                  <div>
                    <Label className="text-base font-medium">Preview</Label>
                    <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 flex items-center justify-center h-32 mt-2">
                      <img 
                        src={uploadPreview} 
                        alt="Upload preview"
                        className="max-h-24 max-w-full object-contain"
                      />
                    </div>
                  </div>
                )}

                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    saveUploadedSignature();
                  }}
                  disabled={!uploadFile || !uploadName.trim() || isProcessing}
                  className="w-full h-12 text-lg"
                  size="lg"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5 mr-2" />
                      Save & Use Signature
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Draw Tab */}
            <TabsContent value="draw" className="flex-1 overflow-y-auto space-y-6">
              <div className="max-w-md mx-auto space-y-6">
                <div>
                  <Label htmlFor="draw-name" className="text-base font-medium">Signature Name</Label>
                  <Input
                    id="draw-name"
                    value={drawName}
                    onChange={(e) => setDrawName(e.target.value)}
                    placeholder="Enter a name for your signature"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="text-base font-medium">Draw Your Signature</Label>
                  <div className="border-2 border-gray-200 rounded-lg p-4 bg-white mt-2">
                    <canvas
                      ref={canvasRef}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      className="border border-gray-300 rounded cursor-crosshair w-full bg-white"
                      style={{ height: '150px' }}
                    />
                    <div className="flex justify-between items-center mt-3">
                      <p className="text-sm text-gray-500">
                        Click and drag to draw your signature
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          clearCanvas();
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    saveDrawnSignature();
                  }}
                  disabled={!drawName.trim() || isProcessing}
                  className="w-full h-12 text-lg"
                  size="lg"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5 mr-2" />
                      Save & Use Signature
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Generate Tab */}
            <TabsContent value="generate" className="flex-1 overflow-y-auto space-y-6">
              <div className="max-w-md mx-auto space-y-6">
                <div>
                  <Label htmlFor="generate-name" className="text-base font-medium">Signature Name</Label>
                  <Input
                    id="generate-name"
                    value={generateName}
                    onChange={(e) => setGenerateName(e.target.value)}
                    placeholder="Enter a name for your signature"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="signature-text" className="text-base font-medium">Your Name/Text</Label>
                  <Input
                    id="signature-text"
                    value={generatedText}
                    onChange={(e) => setGeneratedText(e.target.value)}
                    placeholder="Enter your name or text for the signature"
                    className="mt-2"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label className="text-base font-medium">Font Family</Label>
                    <select 
                      className="w-full p-3 border border-gray-300 rounded-lg mt-2 bg-white"
                      value={selectedFont.name}
                      onChange={(e) => {
                        const font = SIGNATURE_FONTS.find(f => f.name === e.target.value);
                        if (font) setSelectedFont(font);
                      }}
                    >
                      {SIGNATURE_FONTS.map(font => (
                        <option key={font.name} value={font.name}>
                          {font.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-base font-medium">Font Size: {fontSize}px</Label>
                    <Slider
                      value={[fontSize]}
                      onValueChange={(value) => setFontSize(value[0])}
                      min={16}
                      max={60}
                      step={2}
                      className="mt-3"
                    />
                  </div>
                </div>

                {generatedText && (
                  <div>
                    <Label className="text-base font-medium">Preview</Label>
                    <div className="mt-2">
                      {generateSignaturePreview()}
                    </div>
                  </div>
                )}

                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    saveGeneratedSignature();
                  }}
                  disabled={!generatedText.trim() || !generateName.trim() || isProcessing}
                  className="w-full h-12 text-lg"
                  size="lg"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5 mr-2" />
                      Save & Use Signature
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}; 