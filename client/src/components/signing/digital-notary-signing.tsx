import React, { useState, useEffect, useRef, useCallback } from 'react';
import WebViewer from '@pdftron/webviewer';
import forge from 'node-forge';
import CryptoJS from 'crypto-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { 
  Users, FileText, Video, Mic, MicOff, VideoOff, 
  Play, Square, Share2, Download, CheckCircle, XCircle, 
  RefreshCw, AlertCircle, FileSignature, Upload,
  Eye, Clock, Settings, RotateCcw, ZoomIn, ZoomOut,
  Lock, Shield, Stamp, ScrollText, Calendar,
  UserCheck, Save, Send, ArrowLeft, ArrowRight
} from "lucide-react";

// Import notary-specific components
import { VouchedIdentityVerification } from '../verification/vouched-identity-verification';
import { EnhancedVideoRecorder } from '../video/enhanced-video-recorder';

interface Participant {
  id: string;
  name: string;
  email: string;
  role: 'notary' | 'signer' | 'witness' | 'title_agent';
  isConnected: boolean;
  hasVerified: boolean;
  hasSigned: boolean;
  certificate?: any;
  publicKey?: string;
}

interface NotaryDetails {
  commissionNumber: string;
  expirationDate: string;
  jurisdiction: string;
  sealImage?: string;
  stampImage?: string;
}

interface DigitalSignature {
  id: string;
  fieldName: string;
  signerId: string;
  signerName: string;
  timestamp: string;
  certificate: string;
  signature: string;
  signatureImage?: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'signature' | 'initial' | 'stamp' | 'seal';
}

interface NotarialAct {
  type: 'acknowledgment' | 'jurat' | 'verification' | 'witnessing' | 'copy_certification';
  description: string;
  wording: string;
}

interface DigitalNotarySigningProps {
  jobId: number;
  onComplete: () => void;
  onCancel: () => void;
}

const NOTARIAL_ACTS: NotarialAct[] = [
  {
    type: 'acknowledgment',
    description: 'Acknowledgment',
    wording: 'On this [date], before me, [notary name], personally appeared [signer name], who proved to me on the basis of satisfactory evidence to be the person whose name is subscribed to the within instrument and acknowledged to me that he/she executed the same in his/her authorized capacity, and that by his/her signature on the instrument the person, or the entity upon behalf of which the person acted, executed the instrument.'
  },
  {
    type: 'jurat',
    description: 'Jurat',
    wording: 'Subscribed and sworn to (or affirmed) before me on this [date], by [signer name], proved to me on the basis of satisfactory evidence to be the person who appeared before me.'
  },
  {
    type: 'verification',
    description: 'Verification upon Oath or Affirmation',
    wording: 'Signed and sworn to (or affirmed) before me on [date] by [signer name].'
  },
  {
    type: 'witnessing',
    description: 'Witnessing or Attesting a Signature',
    wording: 'Signed or attested before me on [date] by [signer name].'
  },
  {
    type: 'copy_certification',
    description: 'Copy Certification',
    wording: 'I certify that this is a true and correct copy of a document in the possession of [signer name].'
  }
];

export function DigitalNotarySigning({ jobId, onComplete, onCancel }: DigitalNotarySigningProps) {
  // WebViewer instance
  const viewerRef = useRef<HTMLDivElement>(null);
  const webviewerInstance = useRef<any>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);

  // Session states
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sessionRecordingId, setSessionRecordingId] = useState<string>('');

  // Participants and verification
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showIdentityVerification, setShowIdentityVerification] = useState(false);
  const [verifyingParticipant, setVerifyingParticipant] = useState<string>('');

  // Document and signature states
  const [currentDocument, setCurrentDocument] = useState<any>(null);
  const [digitalSignatures, setDigitalSignatures] = useState<DigitalSignature[]>([]);
  const [selectedNotarialAct, setSelectedNotarialAct] = useState<NotarialAct>(NOTARIAL_ACTS[0]);
  const [notaryDetails, setNotaryDetails] = useState<NotaryDetails>({
    commissionNumber: '',
    expirationDate: '',
    jurisdiction: ''
  });

  // Real-time sync states
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);
  const [syncedPage, setSyncedPage] = useState(1);
  const [syncedZoom, setSyncedZoom] = useState(1);
  const wsRef = useRef<WebSocket | null>(null);

  // PKI Certificate states
  const [privateKey, setPrivateKey] = useState<forge.pki.rsa.PrivateKey | null>(null);
  const [certificate, setCertificate] = useState<forge.pki.Certificate | null>(null);
  const [showCertificateDialog, setShowCertificateDialog] = useState(false);

  // Journal entry state
  const [journalEntry, setJournalEntry] = useState({
    date: new Date().toISOString(),
    documentType: '',
    signerName: '',
    signerIdType: '',
    signerIdNumber: '',
    notarialAct: 'acknowledgment',
    fee: '',
    notes: ''
  });

  // Initialize WebViewer
  useEffect(() => {
    if (!viewerRef.current) return;

    WebViewer({
      path: '/webviewer',
      licenseKey: import.meta.env.VITE_PDFTRON_LICENSE_KEY || '',
      initialDoc: currentDocument?.url,
      enableAnnotations: true,
      enableMeasurement: false,
      enableRedaction: false,
      disabledElements: [
        'toolsHeader',
        'viewControlsButton',
        'selectToolButton',
        'panToolButton',
        'toggleNotesButton'
      ],
      isAdminUser: currentUser?.role === 'notary',
      fullAPI: true,
      enableFilePicker: false
    }, viewerRef.current).then((instance) => {
      webviewerInstance.current = instance;
      const { documentViewer, annotationManager, Annotations, PDFNet } = instance.Core;

      // Set up event listeners
      documentViewer.addEventListener('documentLoaded', () => {
        setIsViewerReady(true);
        initializeDigitalSignatureFields();
      });

      // Handle annotation changes
      annotationManager.addEventListener('annotationChanged', (annotations: any, action: string) => {
        if (action === 'add' && annotations.length > 0) {
          handleAnnotationAdded(annotations[0]);
        }
      });

      // Set up custom signature tool
      const SignatureTool = instance.Core.Tools.SignatureCreateTool;
      // SignatureTool.SIGNATURE_ANNOTATION_STORAGE_KEY = 'notary_signatures'; // This property might not exist

      // Enable digital signatures
      instance.Core.PDFNet.initialize();
    });

    return () => {
      if (webviewerInstance.current) {
        webviewerInstance.current.Core.documentViewer.dispose();
      }
    };
  }, [currentDocument]);

  // Initialize digital signature fields
  const initializeDigitalSignatureFields = async () => {
    if (!webviewerInstance.current || !isViewerReady) return;

    const { documentViewer, annotationManager, Annotations } = webviewerInstance.current.Core;
    const document = documentViewer.getDocument();
    
    // Add signature fields based on document tags
    try {
      const fieldManager = annotationManager.getFieldManager();
      
      // Add notary signature field
      const notaryField = new Annotations.Forms.Field("notary_signature", {
        type: 'Sig',
        value: ''
      });
      
      const notaryWidget = new Annotations.SignatureWidgetAnnotation(notaryField);
      notaryWidget.PageNumber = 1;
      notaryWidget.X = 100;
      notaryWidget.Y = 600;
      notaryWidget.Width = 200;
      notaryWidget.Height = 75;
      
      annotationManager.addAnnotation(notaryWidget);
      fieldManager.addField(notaryField);

      // Add signer signature fields
      participants.filter(p => p.role === 'signer').forEach((signer, index) => {
        const signerField = new Annotations.Forms.Field(`signer_${signer.id}`, {
          type: 'Sig',
          value: ''
        });
        
        const signerWidget = new Annotations.SignatureWidgetAnnotation(signerField);
        signerWidget.PageNumber = 1;
        signerWidget.X = 100;
        signerWidget.Y = 400 + (index * 100);
        signerWidget.Width = 200;
        signerWidget.Height = 75;
        
        annotationManager.addAnnotation(signerWidget);
        fieldManager.addField(signerField);
      });

      annotationManager.drawAnnotationsFromList(annotationManager.getAnnotationsList());
    } catch (error) {
      console.error('Error initializing signature fields:', error);
    }
  };

  // Generate or load PKI certificate
  const generatePKICertificate = () => {
    // Generate a key pair
    const keys = forge.pki.rsa.generateKeyPair(2048);
    
    // Create a certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01' + Date.now();
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [{
      name: 'commonName',
      value: currentUser?.name || 'Notary Public'
    }, {
      name: 'countryName',
      value: 'US'
    }, {
      name: 'stateOrProvinceName',
      value: notaryDetails.jurisdiction
    }, {
      name: 'organizationName',
      value: 'NotaryPro Digital Notary Services'
    }];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([{
      name: 'basicConstraints',
      cA: true
    }, {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true
    }, {
      name: 'subjectAltName',
      altNames: [{
        type: 6, // URI
        value: `notary:commission:${notaryDetails.commissionNumber}`
      }]
    }]);

    // Self-sign certificate
    cert.sign(keys.privateKey, forge.md.sha256.create());

    setPrivateKey(keys.privateKey);
    setCertificate(cert);

    toast({
      title: "Certificate Generated",
      description: "Your digital certificate has been created successfully",
    });

    return { privateKey: keys.privateKey, certificate: cert };
  };

  // Load certificate from file
  const loadCertificateFromFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const pfx = forge.util.decode64(e.target?.result as string);
        const p12 = forge.pkcs12.pkcs12FromAsn1(
          forge.asn1.fromDer(pfx),
          'password' // In production, prompt for password
        );
        
        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
        const cert = certBags[forge.pki.oids.certBag]![0].cert!;
        
        const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
        const key = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]![0].key!;
        
        setPrivateKey(key as forge.pki.rsa.PrivateKey);
        setCertificate(cert);
        
        toast({
          title: "Certificate Loaded",
          description: "Your certificate has been loaded successfully",
        });
      } catch (error) {
        toast({
          title: "Certificate Error",
          description: "Failed to load certificate. Please check the file and password.",
          variant: "destructive"
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Apply digital signature to field
  const applyDigitalSignature = async (fieldName: string, signatureImage?: string) => {
    if (!webviewerInstance.current || !certificate || !privateKey) {
      toast({
        title: "Certificate Required",
        description: "Please load or generate a certificate first",
        variant: "destructive"
      });
      return;
    }

    try {
      const { documentViewer, annotationManager, PDFNet } = webviewerInstance.current.Core;
      const document = documentViewer.getDocument();
      
      // Get the PDF document
      const pdfDoc = await document.getPDFDoc();
      
      // Create digital signature field
      await PDFNet.runWithCleanup(async () => {
        const sigField = await pdfDoc.fieldCreate(fieldName, PDFNet.Field.Type.e_signature);
        
        // Create signature dictionary
        const sigDict = await sigField.useSignatureHandler(
          PDFNet.DigitalSignatureField.SignatureHandlerType.e_PKCS7_detached
        );
        
        // Set signature appearance
        if (signatureImage) {
          const img = await PDFNet.Image.createFromURL(pdfDoc, signatureImage);
          await sigDict.createSigAppearance(img);
        }
        
        // Generate signature data
        const now = new Date();
        const signatureData = {
          signer: currentUser.name,
          timestamp: now.toISOString(),
          location: notaryDetails.jurisdiction,
          reason: selectedNotarialAct.description,
          contactInfo: currentUser.email,
          certificate: forge.pki.certificateToPem(certificate)
        };
        
        // Create the signature
        const dataToSign = JSON.stringify(signatureData);
        const md = forge.md.sha256.create();
        md.update(dataToSign, 'utf8');
        const signature = privateKey.sign(md);
        
        // Apply the signature
        await sigDict.signCertString(
          forge.util.encode64(signature),
          forge.pki.certificateToPem(certificate)
        );
        
        // Save the signature
        const digitalSig: DigitalSignature = {
          id: `sig_${Date.now()}`,
          fieldName,
          signerId: currentUser.id,
          signerName: currentUser.name,
          timestamp: now.toISOString(),
          certificate: forge.pki.certificateToPem(certificate),
          signature: forge.util.encode64(signature),
          signatureImage,
          pageNumber: 1,
          x: 100,
          y: 600,
          width: 200,
          height: 75,
          type: currentUser.role === 'notary' ? 'seal' : 'signature'
        };
        
        setDigitalSignatures(prev => [...prev, digitalSig]);
        
        // Update participant status
        setParticipants(prev => prev.map(p => 
          p.id === currentUser.id ? { ...p, hasSigned: true } : p
        ));
        
        toast({
          title: "Document Signed",
          description: "Your digital signature has been applied successfully",
        });
      });
      
      // Refresh the document
      await documentViewer.refreshAll();
      
    } catch (error) {
      console.error('Error applying digital signature:', error);
      toast({
        title: "Signature Error", 
        description: "Failed to apply digital signature",
        variant: "destructive"
      });
    }
  };

  // Handle real-time sync
  const setupWebSocket = () => {
    const ws = new WebSocket(`wss://your-server.com/signing-session/${jobId}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'sync':
          if (isSyncEnabled && data.userId !== currentUser.id) {
            handleRemoteSync(data);
          }
          break;
        case 'signature':
          // handleRemoteSignature(data);
          console.log('Remote signature received:', data);
          break;
        case 'participant_update':
          // handleParticipantUpdate(data);
          console.log('Participant update received:', data);
          break;
      }
    };
    
    wsRef.current = ws;
  };

  const handleRemoteSync = async (data: any) => {
    if (!webviewerInstance.current) return;
    
    const { documentViewer } = webviewerInstance.current.Core;
    documentViewer.setCurrentPage(data.page);
    documentViewer.setZoom(data.zoom);
  };

  const syncDocumentView = () => {
    if (!webviewerInstance.current || !wsRef.current) return;
    
    const { documentViewer } = webviewerInstance.current.Core;
    const currentPage = documentViewer.getCurrentPage();
    const zoom = documentViewer.getZoom();
    
    wsRef.current.send(JSON.stringify({
      type: 'sync',
      userId: currentUser.id,
      page: currentPage,
      zoom: zoom,
      timestamp: Date.now()
    }));
  };

  // Handle annotation/signature additions
  const handleAnnotationAdded = (annotation: any) => {
    if (annotation.Subject === 'Signature') {
      // Broadcast signature to other participants
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'signature',
          annotation: annotation.serialize(),
          userId: currentUser.id
        }));
      }
    }
  };

  // Handle identity verification
  const handleIdentityVerification = (participantId: string) => {
    setVerifyingParticipant(participantId);
    setShowIdentityVerification(true);
  };

  const handleVerificationComplete = (verificationData: any) => {
    setParticipants(prev => prev.map(p => 
      p.id === verifyingParticipant ? { ...p, hasVerified: true } : p
    ));
    
    setShowIdentityVerification(false);
    
    // Log to journal
    setJournalEntry(prev => ({
      ...prev,
      signerName: participants.find(p => p.id === verifyingParticipant)?.name || '',
      signerIdType: verificationData.document.type,
      signerIdNumber: verificationData.document.documentNumber
    }));
    
    toast({
      title: "Identity Verified",
      description: "Participant identity has been verified successfully",
    });
  };

  // Zoom functions
  const zoomIn = () => {
    if (webviewerInstance.current) {
      const { documentViewer } = webviewerInstance.current.Core;
      documentViewer.zoomTo(documentViewer.getZoom() * 1.2);
    }
  };

  const zoomOut = () => {
    if (webviewerInstance.current) {
      const { documentViewer } = webviewerInstance.current.Core;
      documentViewer.zoomTo(documentViewer.getZoom() / 1.2);
    }
  };

  // Complete signing session
  const completeSigningSession = async () => {
    if (!webviewerInstance.current) return;
    
    try {
      // Verify all required signatures
      const requiredSignatures = participants.filter(p => 
        p.role === 'signer' || p.role === 'notary'
      );
      
      const allSigned = requiredSignatures.every(p => p.hasSigned);
      
      if (!allSigned) {
        toast({
          title: "Incomplete Signatures",
          description: "All required parties must sign before completing",
          variant: "destructive"
        });
        return;
      }
      
      // Generate final signed document
      const { documentViewer } = webviewerInstance.current.Core;
      const doc = documentViewer.getDocument();
      const data = await doc.getFileData({
        // Flatten annotations and form fields
        flatten: true,
        // Include digital signatures
        flags: webviewerInstance.current.Core.SaveOptions.LINEARIZED
      });
      
      const blob = new Blob([data], { type: 'application/pdf' });
      
      // Save to server
      const formData = new FormData();
      formData.append('document', blob, 'signed_document.pdf');
      formData.append('signatures', JSON.stringify(digitalSignatures));
      formData.append('journal', JSON.stringify(journalEntry));
      formData.append('sessionRecording', sessionRecordingId);
      
      const response = await fetch(`/api/jobs/${jobId}/complete-signing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (response.ok) {
        toast({
          title: "Signing Complete",
          description: "Document has been successfully notarized",
        });
        
        onComplete();
      } else {
        throw new Error('Failed to save signed document');
      }
    } catch (error) {
      console.error('Error completing signing:', error);
      toast({
        title: "Error",
        description: "Failed to complete signing session",
        variant: "destructive"
      });
    }
  };

  // Render certificate dialog
  const renderCertificateDialog = () => (
    <Dialog open={showCertificateDialog} onOpenChange={setShowCertificateDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Digital Certificate Setup</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Certificate Option</Label>
            <div className="space-y-2 mt-2">
              <Button
                onClick={generatePKICertificate}
                className="w-full justify-start"
                variant="outline"
              >
                <Shield className="w-4 h-4 mr-2" />
                Generate New Certificate
              </Button>
              
              <Label htmlFor="cert-file" className="cursor-pointer">
                <div className="flex items-center justify-start w-full p-2 border rounded-md hover:bg-gray-50">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Existing Certificate (.pfx/.p12)
                </div>
              </Label>
              <Input
                id="cert-file"
                type="file"
                accept=".pfx,.p12"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) loadCertificateFromFile(file);
                }}
              />
            </div>
          </div>
          
          {certificate && (
            <div className="p-3 bg-green-50 rounded-md">
              <p className="text-sm text-green-800">
                Certificate loaded for: {certificate.subject.getField('CN')?.value}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">Digital Notary Signing Session</h1>
            <Badge variant={sessionStarted ? "default" : "secondary"}>
              {sessionStarted ? "In Progress" : "Not Started"}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            {isRecording && (
              <Badge variant="destructive" className="animate-pulse">
                <Square className="w-3 h-3 mr-1 fill-current" />
                Recording {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
              </Badge>
            )}
            
            <Button
              onClick={() => setShowCertificateDialog(true)}
              variant="outline"
            >
              <Shield className="w-4 h-4 mr-2" />
              Certificate
            </Button>
            
            <Button
              onClick={completeSigningSession}
              disabled={!sessionStarted || participants.some(p => !p.hasSigned)}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Session
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Left Sidebar - Participants & Tools */}
        <div className="w-80 bg-white border-r p-4 overflow-y-auto">
          <Tabs defaultValue="participants">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="participants">Participants</TabsTrigger>
              <TabsTrigger value="notary">Notary</TabsTrigger>
              <TabsTrigger value="journal">Journal</TabsTrigger>
            </TabsList>
            
            <TabsContent value="participants" className="space-y-4">
              <div className="space-y-2">
                {participants.map((participant) => (
                  <Card key={participant.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{participant.name}</p>
                          <p className="text-sm text-gray-500">{participant.role}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {participant.hasVerified ? (
                            <Badge variant="outline" className="text-green-600">
                              <UserCheck className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleIdentityVerification(participant.id)}
                            >
                              Verify ID
                            </Button>
                          )}
                          
                          {participant.hasSigned && (
                            <Badge variant="outline" className="text-blue-600">
                              <FileSignature className="w-3 h-3 mr-1" />
                              Signed
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="notary" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label>Commission Number</Label>
                  <Input
                    value={notaryDetails.commissionNumber}
                    onChange={(e) => setNotaryDetails(prev => ({
                      ...prev,
                      commissionNumber: e.target.value
                    }))}
                    placeholder="Enter commission number"
                  />
                </div>
                
                <div>
                  <Label>Jurisdiction</Label>
                  <Input
                    value={notaryDetails.jurisdiction}
                    onChange={(e) => setNotaryDetails(prev => ({
                      ...prev,
                      jurisdiction: e.target.value
                    }))}
                    placeholder="State/County"
                  />
                </div>
                
                <div>
                  <Label>Commission Expiration</Label>
                  <Input
                    type="date"
                    value={notaryDetails.expirationDate}
                    onChange={(e) => setNotaryDetails(prev => ({
                      ...prev,
                      expirationDate: e.target.value
                    }))}
                  />
                </div>
                
                <div>
                  <Label>Notarial Act Type</Label>
                  <Select
                    value={selectedNotarialAct.type}
                    onValueChange={(value) => {
                      const act = NOTARIAL_ACTS.find(a => a.type === value);
                      if (act) setSelectedNotarialAct(act);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTARIAL_ACTS.map((act) => (
                        <SelectItem key={act.type} value={act.type}>
                          {act.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-md">
                  <Label className="text-xs">Notarial Wording Preview</Label>
                  <p className="text-sm mt-1">{selectedNotarialAct.wording}</p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="journal" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label>Document Type</Label>
                  <Input
                    value={journalEntry.documentType}
                    onChange={(e) => setJournalEntry(prev => ({
                      ...prev,
                      documentType: e.target.value
                    }))}
                    placeholder="e.g., Real Estate Purchase Agreement"
                  />
                </div>
                
                <div>
                  <Label>Signer Name</Label>
                  <Input
                    value={journalEntry.signerName}
                    readOnly
                    placeholder="Populated from verification"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>ID Type</Label>
                    <Input
                      value={journalEntry.signerIdType}
                      readOnly
                      placeholder="From verification"
                    />
                  </div>
                  <div>
                    <Label>ID Number</Label>
                    <Input
                      value={journalEntry.signerIdNumber}
                      readOnly
                      placeholder="From verification"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Fee</Label>
                  <Input
                    value={journalEntry.fee}
                    onChange={(e) => setJournalEntry(prev => ({
                      ...prev,
                      fee: e.target.value
                    }))}
                    placeholder="$0.00"
                  />
                </div>
                
                <div>
                  <Label>Notes</Label>
                  <textarea
                    className="w-full p-2 border rounded-md"
                    rows={3}
                    value={journalEntry.notes}
                    onChange={(e) => setJournalEntry(prev => ({
                      ...prev,
                      notes: e.target.value
                    }))}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Center - Document Viewer */}
        <div className="flex-1 flex flex-col">
          {/* Document Controls */}
          <div className="bg-white border-b px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => webviewerInstance.current?.Core.documentViewer.rotateClockwise()}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={zoomOut}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={zoomIn}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                
                <div className="flex items-center space-x-1 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const viewer = webviewerInstance.current?.Core.documentViewer;
                      if (viewer) {
                        viewer.setCurrentPage(Math.max(1, viewer.getCurrentPage() - 1));
                      }
                    }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm px-2">
                    Page {syncedPage} of {webviewerInstance.current?.Core.documentViewer.getPageCount() || 0}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const viewer = webviewerInstance.current?.Core.documentViewer;
                      if (viewer) {
                        viewer.setCurrentPage(Math.min(viewer.getPageCount(), viewer.getCurrentPage() + 1));
                      }
                    }}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={isSyncEnabled}
                    onChange={(e) => setIsSyncEnabled(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Sync View</span>
                </label>
                
                {isSyncEnabled && (
                  <Button
                    size="sm"
                    onClick={syncDocumentView}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Sync Now
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          {/* WebViewer Container */}
          <div className="flex-1 relative">
            <div ref={viewerRef} className="w-full h-full" />
          </div>
        </div>

        {/* Right Sidebar - Signatures & Recording */}
        <div className="w-80 bg-white border-l p-4">
          <Tabs defaultValue="signatures">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signatures">Signatures</TabsTrigger>
              <TabsTrigger value="recording">Recording</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signatures" className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Applied digital signatures
                </p>
                {digitalSignatures.map((sig) => (
                  <Card key={sig.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{sig.signerName}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(sig.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-green-600">
                          <Lock className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {currentUser && !participants.find(p => p.id === currentUser.id)?.hasSigned && (
                  <Button
                    onClick={() => applyDigitalSignature(`${currentUser.role}_${currentUser.id}`)}
                    className="w-full"
                  >
                    <FileSignature className="w-4 h-4 mr-2" />
                    Apply My Signature
                  </Button>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="recording" className="space-y-4">
              <EnhancedVideoRecorder
                jobId={jobId}
                onRecordingStart={(id) => {
                  setSessionRecordingId(id);
                  setIsRecording(true);
                }}
                onRecordingComplete={(recording) => {
                  setIsRecording(false);
                  toast({
                    title: "Recording Saved",
                    description: "Session recording has been saved successfully",
                  });
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modals */}
      {showIdentityVerification && (
        <VouchedIdentityVerification
          onVerificationComplete={handleVerificationComplete}
          onVerificationFailed={() => setShowIdentityVerification(false)}
          sessionId={`session_${jobId}_${Date.now()}`}
          participantId={verifyingParticipant || ''}
          participantName={participants.find(p => p.id === verifyingParticipant)?.name || 'Unknown'}
        />
      )}
      
      {renderCertificateDialog()}
    </div>
  );
} 