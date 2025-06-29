import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { 
  Upload, Edit, Trash2, CheckCircle, AlertCircle,
  Calendar, User, FileSignature, Download, Eye, Plus
} from "lucide-react";


interface SavedSignature {
  id: string;
  name: string;
  type: 'signature' | 'initial';
  signatureData: string;
  isActive: boolean;
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
}

interface SignatureManagerProps {
  userId: number;
  onSignatureSelect?: (signature: SavedSignature) => void;
}

export function SignatureManager({ userId, onSignatureSelect }: SignatureManagerProps) {
  const [signatures, setSignatures] = useState<SavedSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSignature, setSelectedSignature] = useState<SavedSignature | null>(null);
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);
  const [currentSignatureType, setCurrentSignatureType] = useState<'signature' | 'initial'>('signature');

  useEffect(() => {
    loadSavedSignatures();
  }, [userId]);

  const loadSavedSignatures = async () => {
    try {
      // Load from localStorage for demo/development
      const savedSigsString = localStorage.getItem(`signatures_${userId}`);
      if (savedSigsString) {
        const savedSignatures = JSON.parse(savedSigsString);
        setSignatures(savedSignatures);
      } else {
        setSignatures([]);
      }
    } catch (error) {
      console.error('Error loading signatures:', error);
      setSignatures([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSignature = (type: 'signature' | 'initial') => {
    setCurrentSignatureType(type);
    setShowSignatureCapture(true);
  };

  const handleSignatureSave = async (signatureData: string, metadata: any) => {
    try {
      const newSignature: SavedSignature = {
        id: Date.now().toString(),
        name: `${currentSignatureType === 'signature' ? 'Signature' : 'Initials'} - ${new Date().toLocaleDateString()}`,
        type: currentSignatureType,
        signatureData: signatureData,
        isActive: signatures.length === 0 && currentSignatureType === 'signature',
        createdAt: new Date().toISOString(),
        usageCount: 0
      };
      
      const updatedSignatures = [...signatures, newSignature];
      setSignatures(updatedSignatures);
      
      // Save to localStorage for cross-component access
      localStorage.setItem(`signatures_${userId}`, JSON.stringify(updatedSignatures));
      
      toast({
        title: "Signature Saved",
        description: `Your ${currentSignatureType} has been saved to your dashboard`,
      });
    } catch (error) {
      console.error('Error saving signature:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save signature. Please try again.",
        variant: "destructive",
      });
    } finally {
      setShowSignatureCapture(false);
    }
  };

  const handleDeleteSignature = (signatureId: string) => {
    const signature = signatures.find(s => s.id === signatureId);
    if (!signature) return;

    if (!confirm(`Are you sure you want to delete "${signature.name}"? This action cannot be undone.`)) {
      return;
    }

    const updatedSignatures = signatures.filter(s => s.id !== signatureId);
    setSignatures(updatedSignatures);
    
    // Update localStorage
    localStorage.setItem(`signatures_${userId}`, JSON.stringify(updatedSignatures));
    
    toast({
      title: "Signature Deleted",
      description: "Signature has been removed from your dashboard",
    });
  };

  const handleSetActive = (signatureId: string) => {
    const updatedSignatures = signatures.map(s => ({
      ...s,
      isActive: s.id === signatureId && s.type === 'signature'
    }));
    
    setSignatures(updatedSignatures);
    
    // Update localStorage
    localStorage.setItem(`signatures_${userId}`, JSON.stringify(updatedSignatures));
    
    toast({
      title: "Active Signature Set",
      description: "This is now your primary signature",
    });
  };

  const downloadSignature = (signature: SavedSignature) => {
    const link = document.createElement('a');
    link.href = signature.signatureData;
    link.download = `${signature.name.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Signature Manager</h2>
          <p className="text-gray-600">Create and manage your digital signatures and initials</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleCreateSignature('initial')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Initials
          </Button>
          <Button onClick={() => handleCreateSignature('signature')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Signature
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <FileSignature className="h-4 w-4" />
        <AlertDescription>
          Save your signatures here to quickly use them during signing sessions. You can create multiple signatures and set one as your primary signature.
        </AlertDescription>
      </Alert>

      {/* Signatures Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {signatures.map((signature) => (
          <Card key={signature.id} className={`${signature.isActive && signature.type === 'signature' ? 'ring-2 ring-blue-500' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{signature.name}</CardTitle>
                <div className="flex gap-1">
                  {signature.isActive && signature.type === 'signature' && (
                    <Badge className="bg-blue-100 text-blue-800">Primary</Badge>
                  )}
                  <Badge variant={signature.type === 'signature' ? 'default' : 'secondary'}>
                    {signature.type === 'signature' ? 'Signature' : 'Initials'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Signature Preview */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 min-h-[120px] flex items-center justify-center">
                <img
                  src={signature.signatureData}
                  alt={signature.name}
                  className="max-w-full max-h-[100px] object-contain"
                />
              </div>

              {/* Signature Details */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">Created:</span>
                  <span>{new Date(signature.createdAt).toLocaleDateString()}</span>
                </div>
                
                {signature.lastUsed && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">Last used:</span>
                    <span>{new Date(signature.lastUsed).toLocaleDateString()}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <FileSignature className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">Usage count:</span>
                  <span>{signature.usageCount}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                {signature.type === 'signature' && !signature.isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetActive(signature.id)}
                    className="flex-1"
                  >
                    Set Primary
                  </Button>
                )}
                
                {onSignatureSelect && (
                  <Button
                    size="sm"
                    onClick={() => onSignatureSelect(signature)}
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Use
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadSignature(signature)}
                >
                  <Download className="w-4 h-4" />
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteSignature(signature.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {signatures.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSignature className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Signatures Created</h3>
            <p className="text-gray-600 text-center mb-4">
              Create your digital signatures to use them quickly during signing sessions
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleCreateSignature('initial')}>
                Create Initials
              </Button>
              <Button onClick={() => handleCreateSignature('signature')}>
                Create Signature
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TODO: Add new signature capture modal when implementing new signing system */}
      {showSignatureCapture && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Create {currentSignatureType}</h3>
            <p className="text-gray-600 mb-4">
              Signature capture functionality will be implemented with the new signing system.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setShowSignatureCapture(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 