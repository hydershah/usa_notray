import { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { 
  Pen, Upload, Type, RotateCcw, Check, X, Download, 
  MousePointer, Palette, Eraser, Smartphone, Monitor,
  Info, Shield, Clock, User
} from "lucide-react";

interface SignatureMetadata {
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  method: 'draw' | 'upload' | 'type';
  participantId: string;
  sessionId: string;
  biometricData?: {
    pressure?: number[];
    velocity?: number[];
    duration: number;
    touchPoints: number;
  };
}

interface ProfessionalSignatureCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureData: string, metadata: SignatureMetadata) => void;
  participantName: string;
  participantId: string;
  sessionId: string;
  signatureType: 'signature' | 'initial' | 'witness';
  required?: boolean;
}

export function ProfessionalSignatureCapture({
  isOpen,
  onClose,
  onSave,
  participantName,
  participantId,
  sessionId,
  signatureType,
  required = true
}: ProfessionalSignatureCaptureProps) {
  const signatureRef = useRef<SignatureCanvas>(null);
  const [currentTab, setCurrentTab] = useState('saved');
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const [typedSignature, setTypedSignature] = useState('');
  const [selectedFont, setSelectedFont] = useState('cursive');
  const [strokeColor, setStrokeColor] = useState('#000080');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isCapturing, setIsCapturing] = useState(false);
  const [signatureStartTime, setSignatureStartTime] = useState<number>(0);
  
  // Saved signatures state
  const [savedSignatures, setSavedSignatures] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [selectedSavedSignature, setSelectedSavedSignature] = useState<any>(null);
  
  // Biometric data tracking
  const [biometricData, setBiometricData] = useState({
    pressure: [] as number[],
    velocity: [] as number[],
    duration: 0,
    touchPoints: 0
  });

  // Legal consent state
  const [hasConsented, setHasConsented] = useState(false);
  const [agreesToTerms, setAgreesToTerms] = useState(false);

  useEffect(() => {
    if (currentTab === 'draw' && signatureRef.current) {
      // Configure signature canvas
      signatureRef.current.getCanvas().width = 600;
      signatureRef.current.getCanvas().height = 200;
      
      // Set pen properties
      const canvas = signatureRef.current.getCanvas();
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [currentTab, strokeColor, strokeWidth]);

  // Load saved signatures when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSavedSignatures();
    }
  }, [isOpen, participantId, signatureType]);

  const loadSavedSignatures = async () => {
    setLoadingSaved(true);
    try {
      // Try to load from localStorage for demo purposes
      const savedSigsString = localStorage.getItem(`signatures_${participantId}`);
      if (savedSigsString) {
        const allSignatures = JSON.parse(savedSigsString);
        const filteredSignatures = allSignatures.filter((sig: any) => sig.type === signatureType);
        setSavedSignatures(filteredSignatures);
      } else {
        setSavedSignatures([]);
      }
    } catch (error) {
      console.error('Error loading saved signatures:', error);
      setSavedSignatures([]);
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleSignatureStart = () => {
    setIsCapturing(true);
    setSignatureStartTime(Date.now());
    setBiometricData(prev => ({ ...prev, touchPoints: prev.touchPoints + 1 }));
  };

  const handleSignatureEnd = () => {
    setIsCapturing(false);
    const duration = Date.now() - signatureStartTime;
    setBiometricData(prev => ({ ...prev, duration: prev.duration + duration }));
  };

  const clearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
      setBiometricData({ pressure: [], velocity: [], duration: 0, touchPoints: 0 });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a valid image file (PNG, JPG, GIF)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Create image preview and validate signature quality
    const reader = new FileReader();
    reader.onload = async (event) => {
      const imageData = event.target?.result as string;
      
      // Basic image validation
      const img = new Image();
      img.onload = () => {
        if (img.width < 100 || img.height < 50) {
          toast({
            title: "Image Too Small",
            description: "Please upload a larger signature image (minimum 100x50 pixels)",
            variant: "destructive",
          });
          return;
        }
        setUploadedImage(imageData);
      };
      img.src = imageData;
    };
    reader.readAsDataURL(file);
  };

  const generateTypedSignature = () => {
    if (!typedSignature.trim()) return '';

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return '';

    // Set background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set font and style
    ctx.fillStyle = strokeColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const fontSize = signatureType === 'signature' ? 48 : signatureType === 'initial' ? 36 : 40;
    ctx.font = `${fontSize}px ${selectedFont}`;

    // Draw signature with slight slant for authenticity
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-0.05); // Slight slant
    ctx.fillText(typedSignature, 0, 0);
    ctx.restore();

    return canvas.toDataURL('image/png');
  };

  const collectMetadata = (): SignatureMetadata => {
    return {
      timestamp: new Date().toISOString(),
      ipAddress: 'client-side-placeholder', // Would be collected server-side
      userAgent: navigator.userAgent,
      method: currentTab as 'draw' | 'upload' | 'type',
      participantId,
      sessionId,
      biometricData: currentTab === 'draw' ? biometricData : undefined
    };
  };

  const handleUseSavedSignature = (savedSignature: any) => {
    setSelectedSavedSignature(savedSignature);
  };

  const handleSave = async () => {
    if (!hasConsented || !agreesToTerms) {
      toast({
        title: "Consent Required",
        description: "Please provide consent and agree to terms before proceeding",
        variant: "destructive",
      });
      return;
    }

    let signatureData = '';

    try {
      switch (currentTab) {
        case 'saved':
          if (!selectedSavedSignature) {
            toast({
              title: "No Signature Selected",
              description: "Please select a saved signature first",
              variant: "destructive",
            });
            return;
          }
          signatureData = selectedSavedSignature.signatureData;
          break;

        case 'draw':
          if (!signatureRef.current || signatureRef.current.isEmpty()) {
            toast({
              title: "No Signature",
              description: "Please draw your signature first",
              variant: "destructive",
            });
            return;
          }
          signatureData = signatureRef.current.toDataURL('image/png', 1.0);
          break;

        case 'upload':
          if (!uploadedImage) {
            toast({
              title: "No Image",
              description: "Please upload a signature image first",
              variant: "destructive",
            });
            return;
          }
          signatureData = uploadedImage;
          break;

        case 'type':
          if (!typedSignature.trim()) {
            toast({
              title: "No Text",
              description: "Please enter your signature text first",
              variant: "destructive",
            });
            return;
          }
          signatureData = generateTypedSignature();
          break;
      }

      const metadata = collectMetadata();
      
      // Save signature with metadata
      onSave(signatureData, metadata);
      
      toast({
        title: "Signature Applied",
        description: `${signatureType} applied successfully with legal metadata`,
      });

      // Clear form
      clearSignature();
      setUploadedImage('');
      setTypedSignature('');
      setSelectedSavedSignature(null);
      setHasConsented(false);
      setAgreesToTerms(false);
      
    } catch (error) {
      console.error('Error saving signature:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save signature. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-5xl max-h-[95vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Pen className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  Legal {signatureType === 'signature' ? 'Signature' : signatureType === 'initial' ? 'Initials' : 'Witness'} Capture
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Secure digital signature with legal compliance
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {participantName}
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {signatureType === 'signature' ? 'Full Signature' : signatureType === 'initial' ? 'Initials Only' : 'Witness Signature'}
            </Badge>
            <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Session: {sessionId.substring(0, 8)}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Legal Notice */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Legal Notice:</strong> By providing your {signatureType}, you acknowledge that this electronic signature 
              has the same legal effect as a handwritten signature and will be used for notarization purposes.
            </AlertDescription>
          </Alert>

          {/* Signature Methods */}
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="saved" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Saved {signatureType === 'signature' ? 'Signatures' : 'Initials'}
              </TabsTrigger>
              <TabsTrigger value="draw" className="flex items-center gap-2">
                <Pen className="w-4 h-4" />
                Draw New
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Image
              </TabsTrigger>
              <TabsTrigger value="type" className="flex items-center gap-2">
                <Type className="w-4 h-4" />
                Type {signatureType === 'signature' ? 'Name' : 'Initials'}
              </TabsTrigger>
            </TabsList>

            {/* Saved Signatures Tab */}
            <TabsContent value="saved" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-3">
                    Select from Your Saved {signatureType === 'signature' ? 'Signatures' : 'Initials'}
                  </label>
                  
                  {loadingSaved ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-600 mt-2">Loading saved signatures...</p>
                    </div>
                  ) : savedSignatures.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <Download className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Saved {signatureType === 'signature' ? 'Signatures' : 'Initials'}</h3>
                      <p className="text-gray-600 mb-4">
                        You haven't saved any {signatureType === 'signature' ? 'signatures' : 'initials'} yet. Create some in your dashboard or use one of the other tabs to create a new one.
                      </p>
                      <Button variant="outline" onClick={() => setCurrentTab('draw')}>
                        <Pen className="w-4 h-4 mr-2" />
                        Draw New {signatureType === 'signature' ? 'Signature' : 'Initials'}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {savedSignatures.map((signature, index) => (
                        <div
                          key={signature.id || index}
                          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                            selectedSavedSignature?.id === signature.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                          onClick={() => handleUseSavedSignature(signature)}
                        >
                          <div className="text-center">
                            <div className="border border-gray-200 rounded p-3 bg-white mb-3 min-h-[80px] flex items-center justify-center">
                              <img
                                src={signature.signatureData}
                                alt={signature.name}
                                className="max-w-full max-h-[60px] object-contain"
                              />
                            </div>
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">{signature.name}</div>
                              <div className="text-gray-600">
                                Created: {new Date(signature.createdAt).toLocaleDateString()}
                              </div>
                              {signature.lastUsed && (
                                <div className="text-gray-500 text-xs">
                                  Last used: {new Date(signature.lastUsed).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedSavedSignature && (
                  <div className="border border-blue-300 rounded-lg p-4 bg-blue-50">
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Selected: {selectedSavedSignature.name}</span>
                    </div>
                    <div className="text-center bg-white rounded p-4">
                      <img
                        src={selectedSavedSignature.signatureData}
                        alt="Selected signature preview"
                        className="max-w-full max-h-[100px] object-contain mx-auto"
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Draw Signature Tab */}
            <TabsContent value="draw" className="space-y-4">
              <div className="space-y-4">
                {/* Drawing Controls */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Color:</label>
                    <input
                      type="color"
                      value={strokeColor}
                      onChange={(e) => setStrokeColor(e.target.value)}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Thickness:</label>
                    <input
                      type="range"
                      min="1"
                      max="8"
                      value={strokeWidth}
                      onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-sm text-gray-600 min-w-[30px]">{strokeWidth}px</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={clearSignature}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                  {isCapturing && (
                    <Badge className="bg-red-100 text-red-800 animate-pulse">
                      Capturing...
                    </Badge>
                  )}
                </div>

                {/* Signature Canvas */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      Please {signatureType === 'signature' ? 'sign' : signatureType === 'initial' ? 'initial' : 'witness sign'} in the area below:
                    </p>
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                      <Smartphone className="w-4 h-4" />
                      <span>Touch devices supported</span>
                      <Monitor className="w-4 h-4 ml-2" />
                      <span>Mouse & stylus compatible</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-center">
                    <div className="border border-gray-300 rounded-lg bg-white shadow-sm">
                      <SignatureCanvas
                        ref={signatureRef}
                        canvasProps={{
                          className: 'signature-canvas',
                          style: { 
                            width: '600px', 
                            height: '200px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px'
                          }
                        }}
                        penColor={strokeColor}
                        minWidth={strokeWidth / 2}
                        maxWidth={strokeWidth}
                        velocityFilterWeight={0.7}
                        onBegin={handleSignatureStart}
                        onEnd={handleSignatureEnd}
                      />
                    </div>
                  </div>

                  {/* Biometric Info */}
                  {(biometricData.touchPoints > 0 || biometricData.duration > 0) && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="text-xs text-blue-800 space-y-1">
                        <div>Touch Points: {biometricData.touchPoints}</div>
                        <div>Duration: {(biometricData.duration / 1000).toFixed(1)}s</div>
                        <div className="flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          Biometric data captured for authenticity
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Upload Image Tab */}
            <TabsContent value="upload" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-3">
                    Upload Your {signatureType === 'signature' ? 'Signature' : 'Initials'} Image
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <div className="text-center">
                      <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-600 mb-3">
                        Drag and drop or click to upload your signature image
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Supported: PNG, JPG, GIF (max 5MB) • Minimum 100x50 pixels
                      </p>
                    </div>
                  </div>
                </div>

                {uploadedImage && (
                  <div className="border border-gray-300 rounded-lg p-4 bg-white">
                    <div className="text-center">
                      <p className="text-sm font-medium mb-3">Preview:</p>
                      <img
                        src={uploadedImage}
                        alt="Uploaded signature"
                        className="max-w-full h-auto max-h-48 mx-auto border rounded shadow-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Type Signature Tab */}
            <TabsContent value="type" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {signatureType === 'signature' ? 'Full Legal Name' : signatureType === 'initial' ? 'Your Initials' : 'Witness Name'}
                  </label>
                  <input
                    type="text"
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    placeholder={
                      signatureType === 'signature' 
                        ? 'John Michael Doe' 
                        : signatureType === 'initial' 
                          ? 'JMD' 
                          : 'Witness Name'
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Font Style</label>
                    <select
                      value={selectedFont}
                      onChange={(e) => setSelectedFont(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="cursive">Cursive</option>
                      <option value="'Dancing Script', cursive">Dancing Script</option>
                      <option value="'Great Vibes', cursive">Great Vibes</option>
                      <option value="'Kaushan Script', cursive">Kaushan Script</option>
                      <option value="'Pacifico', cursive">Pacifico</option>
                      <option value="serif">Times New Roman</option>
                      <option value="sans-serif">Arial</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Color</label>
                    <input
                      type="color"
                      value={strokeColor}
                      onChange={(e) => setStrokeColor(e.target.value)}
                      className="w-full h-10 rounded border cursor-pointer"
                    />
                  </div>
                </div>

                {typedSignature && (
                  <div className="border border-gray-300 rounded-lg p-6 bg-white">
                    <p className="text-sm font-medium mb-3 text-center">Preview:</p>
                    <div className="text-center py-6">
                      <div
                        style={{
                          fontFamily: selectedFont,
                          fontSize: signatureType === 'signature' ? '48px' : signatureType === 'initial' ? '36px' : '40px',
                          color: strokeColor,
                          transform: 'rotate(-1deg)',
                          display: 'inline-block'
                        }}
                      >
                        {typedSignature}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Legal Consent Section */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
            <h4 className="font-medium flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Legal Consent & Authentication
            </h4>
            
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasConsented}
                  onChange={(e) => setHasConsented(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm">
                  I consent to the use of my electronic {signatureType} for legal purposes and acknowledge 
                  that this signature will be legally binding and equivalent to my handwritten signature.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreesToTerms}
                  onChange={(e) => setAgreesToTerms(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm">
                  I agree that my identity has been verified and I am voluntarily providing this signature 
                  without coercion. I understand this session is being recorded for legal purposes.
                </span>
              </label>
            </div>

            <div className="text-xs text-gray-600 space-y-1">
              <div>• Session will be timestamped and logged</div>
              <div>• Biometric data may be captured for authenticity</div>
              <div>• This signature complies with E-SIGN Act requirements</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!hasConsented || !agreesToTerms}
              className="flex items-center gap-2 px-6"
            >
              <Check className="w-4 h-4" />
              Save {signatureType === 'signature' ? 'Signature' : signatureType === 'initial' ? 'Initials' : 'Witness Signature'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 