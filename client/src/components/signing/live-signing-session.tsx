import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { getUserDisplayName } from '@/lib/utils';
import { 
  Video, VideoOff, Mic, MicOff, Users, 
  Play, Square, Share2, Download, CheckCircle, XCircle, 
  RefreshCw, AlertCircle, FileSignature,
  Eye, Clock, Settings, Upload, RotateCcw, ZoomIn, ZoomOut,
  MousePointer, Pen, FileCheck, Stamp, User, Shield, Hash, Calendar, Type, CheckSquare, FileText
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Rnd } from 'react-rnd';

// Enhanced imports for PDF handling
import { SignatureCaptureModal } from './signature-capture-modal';
import { ProfessionalSignatureCapture } from './professional-signature-capture';
import { NotaryStampManager } from '../user/notary-stamp-manager';
import { VouchedIdentityVerification } from '../verification/vouched-identity-verification';
import { EnhancedVideoRecorder } from '../video/enhanced-video-recorder';
import { EnhancedPDFViewer, EnhancedPDFViewerRef } from './enhanced-pdf-viewer';
import { WherebyIntegration } from '../video/whereby-integration';

interface Participant {
  id: string;
  name: string;
  email: string;
  role: 'notary' | 'signer' | 'witness' | 'title_agent';
  isConnected: boolean;
  hasAgreed: boolean;
  signatureData?: string;
}

interface DocumentTag {
  id: string;
  type: 'signature' | 'initial' | 'date' | 'text' | 'stamp' | 'checkbox' | 'name' | 'title' | 'commission-id' | 'commission-exp' | 'disclosure' | 'white-out';
  x: number;
  y: number;
  width: number;
  height: number;
  participantId: string;
  participantName: string;
  isPlaced: boolean;
  content: string;
  signedAt?: string;
  signatureImage?: string;
  page?: number; // Page number for multi-page PDFs
}

interface LiveSigningSessionProps {
  jobId: number;
  onComplete: () => void;
  onCancel: () => void;
}

export function LiveSigningSession({ jobId, onComplete, onCancel }: LiveSigningSessionProps) {
  // Session states
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionMode, setSessionMode] = useState<'tagging' | 'signing'>('signing');
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sessionToken, setSessionToken] = useState<string>('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [roomUrl, setRoomUrl] = useState<string>('');
  const [showWherebyVideo, setShowWherebyVideo] = useState(false);
  const [recordingStarted, setRecordingStarted] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const videoRecorderRef = useRef<any>(null);
  const pdfViewerRef = useRef<EnhancedPDFViewerRef>(null);

  // Document states
  const [documentTags, setDocumentTags] = useState<DocumentTag[]>([]);
  const [documentSignatures, setDocumentSignatures] = useState<DocumentTag[]>([]);
  const [selectedTag, setSelectedTag] = useState<DocumentTag | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDocumentSynced, setIsDocumentSynced] = useState(false);
  const [documentScrollPosition, setDocumentScrollPosition] = useState(0);
  
  // Signature capture states
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingSignature, setPendingSignature] = useState<Partial<DocumentTag> | null>(null);
  const [capturedSignature, setCapturedSignature] = useState<string>('');
  const [selectedSignature, setSelectedSignature] = useState<DocumentTag | null>(null);
  const [isDraggingSignature, setIsDraggingSignature] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isGuestSession, setIsGuestSession] = useState(false);
  const [guestSessionData, setGuestSessionData] = useState<any>(null);

  // Enhanced system states
  const [identityVerified, setIdentityVerified] = useState<Record<string, boolean>>({});

  const [sessionRecordingId, setSessionRecordingId] = useState<string>('');
  const [showProfessionalSignature, setShowProfessionalSignature] = useState(false);
  const [showNotaryStampModal, setShowNotaryStampModal] = useState(false);
  const [availableStamps, setAvailableStamps] = useState<any[]>([]);
  const [availableUserSignatures, setAvailableUserSignatures] = useState<{
    signature?: any;
    initial?: any;
  }>({});
  const [userSignatures, setUserSignatures] = useState<any[]>([]);
  const [notaryStamps, setNotaryStamps] = useState<any[]>([]);
  const [jobDocuments, setJobDocuments] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentDocument, setCurrentDocument] = useState<any>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [currentSignatureType, setCurrentSignatureType] = useState<'signature' | 'initial' | 'witness'>('signature');
  const [uploadingDocument, setUploadingDocument] = useState(false);

  // PDF.js worker setup
  useEffect(() => {
    // Remove the global window PDF.js setup since we're using the npm package
    // The EnhancedPDFViewer component will handle PDF.js initialization properly
  }, []);

  // Enhanced PDF viewer handles all PDF operations now

  // COORDINATE SYSTEM NOTE:
  // The current implementation has coordinate transformation issues between browser view and PDF generation:
  // 1. Browser coordinates (Y=0 at top) vs PDF coordinates (Y=0 at bottom)
  // 2. Display scaling between HTML templates and actual PDF dimensions
  // 3. For best results, use actual PDF documents instead of template documents
  // 4. The EnhancedPDFViewer (used for actual PDFs) has proper coordinate handling
  
  // Generate signed PDF
  const generateSignedPdf = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      if (!currentDocument?.id) {
        throw new Error('No document selected');
      }
      
      if (documentSignatures.length === 0) {
        throw new Error('No signatures to include in signed document');
      }
      
      console.log('Generating signed PDF with:', {
        documentId: currentDocument.id,
        signaturesCount: documentSignatures.length
      });

      // Direct coordinate mapping with simple offset
      const signaturesData = documentSignatures.map(sig => {
        // Get page container dimensions
        const pageContainer = document.querySelector('[data-document-container]') as HTMLElement;
        const pageWidth = pageContainer?.scrollWidth || 612;
        const pageHeight = pageContainer?.scrollHeight || 792;
        
        // Simple direct mapping - just use browser coordinates with offset
        // This is much easier to tune and understand
        const X_OFFSET = 0;      // Adjust left/right
        const Y_OFFSET = 0;      // Adjust up/down (negative = move up in PDF)
        
        // Apply offsets directly to browser coordinates
        const pdfX = sig.x + X_OFFSET;
        const pdfY = sig.y + Y_OFFSET;
        
        console.log('Direct coordinate mapping:', {
          signatureId: sig.id,
          type: sig.type,
          browserCoords: { x: sig.x, y: sig.y },
          pdfCoords: { x: pdfX, y: pdfY },
          offsets: { X_OFFSET, Y_OFFSET },
          note: 'Using direct browser coordinates with simple offset'
        });
        
        // Fix stamp content if it contains URLs or invalid text
        let finalContent = sig.content;
        let finalSignatureImage = sig.signatureImage;
        
        if (sig.type === 'stamp') {
          // If content contains URL or placeholder text, generate proper notary content
          if (!finalContent || finalContent.includes('/api/') || finalContent.includes('Thanks for your business') || finalContent === 'NOTARY STAMP') {
            finalContent = generateSignatureContent('stamp', sig.participantId);
          }
          
          // Don't send image URLs for stamps - let server handle text rendering
          if (finalSignatureImage && finalSignatureImage.includes('/api/')) {
            finalSignatureImage = undefined;
          }
        }
        
        return {
          id: sig.id,
          type: sig.type,
          x: pdfX,
          y: pdfY,
          width: sig.width,
          height: sig.height,
          page: sig.page || 1,
          participantId: sig.participantId,
          participantName: sig.participantName,
          content: finalContent,
          signatureImage: finalSignatureImage,
          signedAt: sig.signedAt,
          clientWidth: pageWidth,
          clientHeight: pageHeight,
        };
      });

      const response = await fetch(`/api/jobs/${jobId}/documents/${currentDocument.id}/sign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signatures: signaturesData,
          page: 1,
          documentId: currentDocument.id,
          jobId: jobId
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/pdf')) {
          console.log('Received PDF blob from server.');
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          
          toast({
            title: "Document Signed Successfully",
            description: `Generated signed PDF with ${documentSignatures.length} signature(s)`,
          });
          
          return url;
        }

        // Fallback for unexpected JSON response
        const responseText = await response.text();
        console.warn('Received a non-PDF response from the sign endpoint:', responseText.substring(0, 500));
        throw new Error('Server returned an unexpected response. Expected a PDF file.');
        
      } else {
        const errorText = await response.text();
        console.log('Error response text:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.message || `Server error: ${response.status}`);
        } catch {
          throw new Error(`Server error: ${response.status} - ${errorText.substring(0, 200)}`);
        }
      }
    } catch (error) {
      console.error('Error generating signed PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      toast({
        title: "Signing Failed",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    }
  };
  
  // Load documents from job data using the new job documents API
  const loadJobDocuments = async (jobData?: any) => {
    try {
      setLoadingDocuments(true);
      
      // Try to load documents from the job documents API
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/jobs/${jobId}/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      let documents = [];

      if (response.ok) {
        const jobDocuments = await response.json();
        
        // Convert job documents to the format expected by the UI
        documents = jobDocuments.map((doc: any) => ({
          id: doc.id,
          name: doc.originalName,
          type: doc.mimeType.includes('pdf') ? 'pdf' : 'document',
          url: `/api/jobs/${jobId}/documents/${doc.id}/download`,
          previewUrl: `/api/jobs/${jobId}/documents/${doc.id}/preview`,
          isMainDocument: doc.documentType === 'original',
          isRequired: doc.isRequired,
          documentType: doc.documentType,
          status: doc.status,
          uploadedBy: doc.uploadedBy,
          fileSize: doc.fileSize
        }));
        
        console.log(`Loaded ${documents.length} documents from API`);
      }

      // If no documents found from API, try legacy single file approach
      if (documents.length === 0) {
        if (jobData?.uploadedFile) {
          documents.push({
            id: 'main-document',
            name: 'Purchase Agreement',
            type: 'pdf',
            url: `/api/jobs/${jobId}/download/original`,
            isMainDocument: true,
            isRequired: true,
            documentType: 'original'
          });
        }
        
        if (jobData?.notarizedFile) {
          documents.push({
            id: 'notarized-document',
            name: 'Notarized Agreement',
            type: 'pdf', 
            url: `/api/jobs/${jobId}/download/notarized`,
            isMainDocument: false,
            isRequired: false,
            documentType: 'notarized'
          });
        }
      }

      // If still no documents found, add demo documents for development
      if (documents.length === 0) {
        documents.push(
          {
            id: 'demo-purchase-agreement',
            name: 'Real Estate Purchase Agreement',
            type: 'template',
            content: 'purchase_agreement',
            isMainDocument: true,
            isRequired: true,
            documentType: 'original'
          },
          {
            id: 'demo-disclosure',
            name: 'Property Disclosure Statement',
            type: 'template',
            content: 'disclosure_statement',
            isMainDocument: false,
            isRequired: false,
            documentType: 'additional'
          },
          {
            id: 'demo-deed',
            name: 'Warranty Deed',
            type: 'template',
            content: 'warranty_deed',
            isMainDocument: false,
            isRequired: false,
            documentType: 'additional'
          }
        );
        
        console.log('Using demo documents for development');
      }

      setJobDocuments(documents);
      setCurrentDocument(documents[0]);
      
      toast({
        title: "Documents Loaded",
        description: `Successfully loaded ${documents.length} document${documents.length !== 1 ? 's' : ''} for signing`,
      });
    } catch (error) {
      console.error('Failed to load job documents:', error);
      
      // Fallback to demo documents
      const demoDocuments = [
        {
          id: 'demo-purchase-agreement',
          name: 'Real Estate Purchase Agreement',
          type: 'template',
          content: 'purchase_agreement',
          isMainDocument: true,
          isRequired: true,
          documentType: 'original'
        }
      ];
      
      setJobDocuments(demoDocuments);
      setCurrentDocument(demoDocuments[0]);
      
      toast({
        title: "Loading Fallback",
        description: "Using demo document for signing session",
        variant: "destructive",
      });
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate files before upload
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    for (const file of Array.from(files)) {
      if (file.size > maxSize) {
        toast({
          title: "File Too Large",
          description: `${file.name} is larger than 10MB. Please choose a smaller file.`,
          variant: "destructive",
        });
        event.target.value = '';
        return;
      }
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not a supported file type. Please upload PDF, DOC, or DOCX files.`,
          variant: "destructive",
        });
        event.target.value = '';
        return;
      }
    }

    setUploadingDocument(true);
    const formData = new FormData();
    
    Array.from(files).forEach((file, index) => {
      formData.append('documents', file);
      formData.append(`documentMetadata_${index}`, JSON.stringify({
        originalName: file.name,
        isRequired: false,
        documentType: 'additional'
      }));
    });

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`/api/jobs/${jobId}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Documents Uploaded Successfully",
          description: result.message || `Uploaded ${files.length} document(s)`,
        });
        
        // Reload documents
        await loadJobDocuments();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingDocument(false);
    }

    // Clear the input
    event.target.value = '';
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC key to deselect signature
      if (e.key === 'Escape' && selectedSignature) {
        setSelectedSignature(null);
        setIsDraggingSignature(false);
      }
      
      // Delete or Backspace to delete selected signature
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSignature) {
        e.preventDefault();
        handleDeleteSignature(selectedSignature.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedSignature]);

  // Load user's profile data, including signatures and notary info
  const loadUserProfileData = async (userId: number, token: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user profile: ${response.statusText}`);
      }

      const profile = await response.json();
      setUserProfile(profile);

      // Set available signatures from profile
      const signatures = {
        signature: profile.signatureData ? { signatureData: profile.signatureData, isFromProfile: true } : undefined,
        initial: profile.initialData ? { signatureData: profile.initialData, isFromProfile: true } : undefined,
      };
      setAvailableUserSignatures(signatures);

      if (signatures.signature || signatures.initial) {
        toast({
          title: "Dashboard Data Loaded",
          description: `Successfully loaded signatures and profile info from your dashboard.`,
        });
      }
      
      // Also load full signature list for management
      const sigsResponse = await fetch(`/api/users/${userId}/signatures`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (sigsResponse.ok) {
        const allSignatures = await sigsResponse.json();
        setUserSignatures(allSignatures);
      }
      
    } catch (error) {
      console.error('Error loading user profile data:', error);
      // Fallback to localStorage if API fails, for offline/legacy support
      loadUserSignaturesFromLocal(userId);
    }
  };

  // Load user's signatures from dashboard (localStorage)
  const loadUserSignaturesFromLocal = async (userId: number) => {
    try {
      // Load signatures directly from localStorage where the dashboard stores them
      const savedSigsString = localStorage.getItem(`signatures_${userId}`);
      
      if (savedSigsString) {
        const savedSignatures = JSON.parse(savedSigsString);
        
        // Find active signature and initials from dashboard
        const userSignatures = {
          signature: savedSignatures.find((sig: any) => sig.type === 'signature' && sig.isActive),
          initial: savedSignatures.find((sig: any) => sig.type === 'initial')
        };
        
        setAvailableUserSignatures(userSignatures);
        setUserSignatures(savedSignatures);
        
        console.log('Loaded user signatures from dashboard:', userSignatures);
        
        if (userSignatures.signature || userSignatures.initial) {
          toast({
            title: "Dashboard Signatures Loaded",
            description: `Found ${userSignatures.signature ? 'signature' : ''}${userSignatures.signature && userSignatures.initial ? ' and ' : ''}${userSignatures.initial ? 'initials' : ''} from your dashboard`,
          });
        }
      } else {
        console.log('No signatures found in dashboard localStorage');
        setAvailableUserSignatures({});
        setUserSignatures([]);
      }
    } catch (error) {
      console.error('Error loading user signatures from localStorage:', error);
      setAvailableUserSignatures({});
      setUserSignatures([]);
    }
  };

  // Load user's notary stamps from dashboard
  const loadUserNotaryStamps = async (userId: number, token: string) => {
    try {
      const response = await fetch(`/api/notary/${userId}/stamps`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const stampsData = await response.json();
        // Convert to the format expected by availableStamps
        const formattedStamps = stampsData.map((stamp: any) => ({
          processedPath: stamp.imageUrl,
          metadata: {
            uploadTime: stamp.uploadedAt,
            isActive: stamp.isActive,
            isVerified: stamp.isVerified,
            commissionNumber: stamp.commissionNumber,
            state: stamp.state,
            county: stamp.county
          }
        }));
        setAvailableStamps(formattedStamps);
        setNotaryStamps(stampsData);
        
        if (formattedStamps.length > 0) {
          console.log(`Loaded ${formattedStamps.length} notary stamps from dashboard`);
        }
      } else {
        console.log('No stamps found in dashboard, user can upload during session');
      }
    } catch (error) {
      console.error('Error loading user notary stamps:', error);
      // Don't show error toast here as stamps are optional
    }
  };

  // Initialize session and verify access
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Get current user from localStorage
        const userData = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        
        if (!userData || !token) {
          toast({
            title: "Authentication Required",
            description: "Please log in first to access the live signing session. Redirecting to login page...",
            variant: "destructive",
          });
          
          // Redirect to login page instead of canceling
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
          return;
        }
        
        const user = JSON.parse(userData);
        setCurrentUser(user);
        
        // Create a display name for the user
        const displayName = getUserDisplayName(user);
        
        // Load user's profile, signatures, and notary data from the backend
        await loadUserProfileData(user.id, token);
        
        // Load user's signatures from dashboard localStorage
        await loadUserSignaturesFromLocal(user.id);
        
        // Load user's notary stamps from dashboard if they are a notary
        if (user.role === 'notary' || user.role === 'admin') {
          await loadUserNotaryStamps(user.id, token);
        }
        
        // Load job participants from the job data
        const jobResponse = await fetch(`/api/jobs/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (jobResponse.ok) {
          const jobData = await jobResponse.json();
          
          // Create participants list from real job data
          const jobParticipants: Participant[] = [];
          
          // Add current user as a participant
          jobParticipants.push({
            id: user.id.toString(),
            name: displayName,
            email: user.email,
            role: user.role as 'notary' | 'signer' | 'witness' | 'title_agent',
            isConnected: true,
            hasAgreed: false
          });
          
          // Fetch actual signers for this job
          if (jobData.signers && jobData.signers.length > 0) {
            jobData.signers.forEach((signer: any) => {
              // Don't duplicate if signer is the current user
              if (signer.signerEmail !== user.email) {
                jobParticipants.push({
                  id: signer.id.toString(),
                  name: signer.signerName,
                  email: signer.signerEmail,
                  role: 'signer',
                  isConnected: false,
                  hasAgreed: false
                });
              }
            });
          } else {
            // Try to fetch signers from the separate signers API endpoint
            try {
              const signersResponse = await fetch(`/api/jobs/${jobId}/signers`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (signersResponse.ok) {
                const signers = await signersResponse.json();
                console.log('Loaded signers from API:', signers);
                
                signers.forEach((signer: any) => {
                  // Don't duplicate if signer is the current user
                  if (signer.signerEmail !== user.email) {
                    jobParticipants.push({
                      id: signer.id.toString(),
                      name: signer.signerName,
                      email: signer.signerEmail,
                      role: 'signer',
                      isConnected: signer.signingStatus === 'completed',
                      hasAgreed: signer.signingStatus === 'completed',
                      signatureData: signer.signatureData
                    });
                  }
                });
              }
            } catch (error) {
              console.log('Could not fetch signers:', error);
            }
          }
          
          // Fetch job participants (notaries, witnesses, etc.)
          try {
            const participantsResponse = await fetch(`/api/jobs/${jobId}/participants`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (participantsResponse.ok) {
              const participants = await participantsResponse.json();
              
              for (const participant of participants) {
                // Check if participant is not already in the list
                if (!jobParticipants.find(p => p.email === participant.email)) {
                  let participantName = participant.email.split('@')[0];
                  let isConnected = participant.inviteStatus === 'accepted';
                  let hasAgreed = false;
                  
                  // Check if this participant is the current user
                  if (participant.userId === user.id) {
                    participantName = displayName;
                    isConnected = true; // Current user is always connected
                  } else if (participant.userId) {
                    // For other users with accounts, try to fetch their details
                    try {
                      const userResponse = await fetch(`/api/users/${participant.userId}`, {
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        }
                      });
                      
                      if (userResponse.ok) {
                        const userData = await userResponse.json();
                        participantName = userData.firstName && userData.lastName 
                          ? `${userData.firstName} ${userData.lastName}`
                          : userData.username || participantName;
                      }
                    } catch (error) {
                      console.log(`Could not fetch details for user ${participant.userId}`);
                    }
                  }
                  
                  jobParticipants.push({
                    id: participant.userId?.toString() || `participant-${participant.id}`,
                    name: participantName,
                    email: participant.email,
                    role: participant.role as 'notary' | 'signer' | 'witness' | 'title_agent',
                    isConnected: isConnected,
                    hasAgreed: hasAgreed
                  });
                }
              }
            }
          } catch (error) {
            console.log('No additional participants found for this job');
          }
          
          // Add the assigned notary if exists and different from current user
          if (jobData.notaryId && jobData.notaryId !== user.id) {
            // Fetch notary details
            try {
              const notaryResponse = await fetch(`/api/users/${jobData.notaryId}`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (notaryResponse.ok) {
                const notaryData = await notaryResponse.json();
                const notaryName = notaryData.firstName && notaryData.lastName 
                  ? `${notaryData.firstName} ${notaryData.lastName}`
                  : notaryData.username;
                  
                jobParticipants.push({
                  id: notaryData.id.toString(),
                  name: notaryName,
                  email: notaryData.email,
                  role: 'notary',
                  isConnected: false,
                  hasAgreed: false
                });
              }
            } catch (error) {
              console.log('Could not fetch notary details');
            }
          }
          
          // Add title company representative if exists
          if (jobData.titleCompany && user.role !== 'title_company') {
            jobParticipants.push({
              id: 'title_rep',
              name: `${jobData.titleCompany} Representative`,
              email: 'contact@titlecompany.com',
              role: 'title_agent',
              isConnected: false,
              hasAgreed: false
            });
          }
          
          console.log('Loaded participants:', jobParticipants);
          setParticipants(jobParticipants);
          setIsAuthorized(true);
          
          // Load documents for this job
          await loadJobDocuments(jobData);
        } else {
          toast({
            title: "Job Not Found",
            description: "The requested notary session could not be found",
            variant: "destructive",
          });
          setTimeout(() => onCancel(), 100);
        }
      } catch (error) {
        console.error('Session initialization error:', error);
        toast({
          title: "Error Loading Session",
          description: "Failed to load session data. Please try again.",
          variant: "destructive",
        });
        setTimeout(() => onCancel(), 2000);
      } finally {
        setIsDataLoading(false);
      }
    };
    
    initializeSession();
  }, [jobId]);



  // Render document content based on type
  const renderDocumentContent = () => {
    if (isDataLoading || loadingDocuments) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">{isDataLoading ? 'Loading session data...' : 'Loading documents...'}</p>
          </div>
        </div>
      );
    }

    if (!currentDocument) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No document selected</p>
          </div>
        </div>
      );
    }

    // Handle PDF/file documents
    if (currentDocument.type === 'pdf' || currentDocument.name?.toLowerCase().endsWith('.pdf')) {
      // Try multiple URL patterns to find the working PDF endpoint
      const baseUrl = currentDocument.url || 
                     currentDocument.previewUrl || 
                     `/api/jobs/${jobId}/documents/${currentDocument.id}/preview`;
      
      // Add authentication token for API endpoints
      const token = localStorage.getItem('token');
      const isApiEndpoint = baseUrl.startsWith('/api/');
      
      // For preview endpoints, don't add token to URL as it will be sent in headers
      const pdfUrl = currentDocument.previewUrl || baseUrl;
      
      console.log('Attempting to load PDF:', {
        documentName: currentDocument.name,
        documentId: currentDocument.id,
        jobId: jobId,
        baseUrl: baseUrl,
        pdfUrl: pdfUrl,
        documentType: currentDocument.type,
        hasToken: !!token,
        previewUrl: currentDocument.previewUrl,
        downloadUrl: currentDocument.url
      });
      
              return (
        <div className="h-full w-full bg-gray-100 relative">
          {/* Enhanced PDF Viewer with advanced notary signing features */}
          <EnhancedPDFViewer
            ref={pdfViewerRef}
            pdfUrl={pdfUrl}
            jobId={jobId}
            currentDocument={currentDocument}
            initialAnnotations={documentSignatures.map(tag => ({
              id: tag.id,
              type: tag.type,
              x: tag.x,
              y: tag.y,
              width: tag.width,
              height: tag.height,
              content: tag.signatureImage || tag.content || '',
              pageNumber: tag.page || 1, // Default to page 1 if not specified
              participantId: tag.participantId,
              timestamp: tag.signedAt || new Date().toISOString(),
              isImage: !!tag.signatureImage,
            }))}
            userSignatures={userSignatures}
            notaryStamps={notaryStamps}
            onSignatureAdd={(signature) => {
              // Convert enhanced PDF viewer signature to DocumentTag format
              const documentTag: DocumentTag = {
                id: signature.id,
                type: signature.type,
                x: signature.x,
                y: signature.y,
                width: signature.width,
                height: signature.height,
                participantId: currentUser?.id || 'unknown',
                participantName: getUserDisplayName(currentUser),
                isPlaced: true,
                content: signature.content,
                signedAt: signature.timestamp,
                signatureImage: signature.isImage ? signature.content : undefined,
                page: signature.pageNumber,
              };
              
              setDocumentSignatures(prev => [...prev, documentTag]);
              
              toast({
                title: "Signature Added",
                description: `${signature.type.charAt(0).toUpperCase() + signature.type.slice(1)} added to page ${signature.pageNumber}`,
              });
            }}
            onDocumentSave={(modifiedPdf) => {
              // Handle document save with embedded signatures
              saveCompletedDocument();
            }}
            readOnly={false}
          />
          
          <div className="absolute bottom-4 right-4 flex gap-2 z-30">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const downloadUrl = `/api/jobs/${jobId}/documents/${currentDocument.id}/download?token=${encodeURIComponent(token || '')}`;
                window.open(downloadUrl, '_blank');
              }}
              className="bg-white shadow-lg"
            >
              <Download className="w-4 h-4 mr-1" />
              Download Original
            </Button>
            
            {documentSignatures.length > 0 && (
              <Button
                size="sm"
                variant="default"
                onClick={async () => {
                  try {
                    // Show loading state
                    toast({
                      title: "Generating Signed PDF",
                      description: "Please wait while we create your signed document...",
                    });
                    
                    // Generate the signed PDF with embedded signatures
                    const signedPdfUrl = await generateSignedPdf();
                    
                    if (signedPdfUrl) {
                      // Download the signed PDF
                      const token = localStorage.getItem('token');
                      const downloadUrl = signedPdfUrl.startsWith('http') || signedPdfUrl.startsWith('blob:')
                        ? signedPdfUrl 
                        : `${window.location.origin}${signedPdfUrl}`;
                      
                      // Create a temporary link to download
                      const link = document.createElement('a');
                      link.href = downloadUrl;
                      link.download = `${currentDocument.name.replace('.pdf', '')}_signed.pdf`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      
                      toast({
                        title: "Download Started",
                        description: "Your signed document is being downloaded.",
                      });
                    }
                  } catch (error) {
                    console.error('Error downloading signed PDF:', error);
                    toast({
                      title: "Download Failed",
                      description: "Failed to download the signed document. Please try again.",
                      variant: "destructive",
                    });
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
              >
                <Download className="w-4 h-4 mr-1" />
                Download Signed
              </Button>
            )}
          </div>
        </div>
      );
    }

    // Handle template documents
    switch (currentDocument.content) {
      case 'purchase_agreement':
        return renderPurchaseAgreement();
      case 'disclosure_statement':
        return renderDisclosureStatement();
      case 'warranty_deed':
        return renderWarrantyDeed();
      default:
        return renderPurchaseAgreement();
    }
  };

  const renderPurchaseAgreement = () => {
    const pageSignatures = documentSignatures.filter(sig => (sig.page || 1) === 1);
    
    console.log('Document signatures:', documentSignatures);
    console.log('Page signatures for page 1:', pageSignatures);
    
    return (
      <div className="relative" data-page-number="1">
        <div className="p-8 bg-white min-h-full">
          <div className="max-w-2xl mx-auto space-y-6 text-sm leading-relaxed">
            <div className="text-center border-b pb-4 mb-6">
              <h1 className="text-xl font-bold mb-2">REAL ESTATE PURCHASE AGREEMENT</h1>
              <p className="text-gray-600">Property Address: 123 Main Street, Anytown, ST 12345</p>
              <p className="text-gray-600">Date: {new Date().toLocaleDateString()}</p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">1. PURCHASE PRICE</h3>
                <p>The total purchase price for the above described property is $350,000.00 (Three Hundred Fifty Thousand Dollars).</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">2. EARNEST MONEY</h3>
                <p>Buyer has deposited $5,000.00 as earnest money with the escrow agent, which shall be applied to the purchase price at closing.</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">3. FINANCING</h3>
                <p>This purchase is contingent upon Buyer obtaining a conventional loan in the amount of $280,000.00 at an interest rate not to exceed 7.5% per annum.</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">4. INSPECTIONS</h3>
                <p>Buyer shall have 10 days from the date of this agreement to conduct inspections of the property. Buyer may terminate this agreement if not satisfied with the condition of the property.</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">5. CLOSING</h3>
                <p>Closing shall occur on or before 30 days from the date of this agreement at a location to be determined by the parties.</p>
              </div>

              {/* Signature Section */}
              <div className="mt-12 pt-8 border-t">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-4">BUYER</h4>
                    <div className="space-y-2">
                      <div className="border-b border-gray-300 pb-1">
                        <span className="text-xs text-gray-500">Signature</span>
                      </div>
                      <div className="border-b border-gray-300 pb-1">
                        <span className="text-xs text-gray-500">Print Name</span>
                      </div>
                      <div className="border-b border-gray-300 pb-1">
                        <span className="text-xs text-gray-500">Date</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-4">SELLER</h4>
                    <div className="space-y-2">
                      <div className="border-b border-gray-300 pb-1">
                        <span className="text-xs text-gray-500">Signature</span>
                      </div>
                      <div className="border-b border-gray-300 pb-1">
                        <span className="text-xs text-gray-500">Print Name</span>
                      </div>
                      <div className="border-b border-gray-300 pb-1">
                        <span className="text-xs text-gray-500">Date</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notary Section */}
                <div className="mt-8 pt-4 border-t">
                  <h4 className="font-semibold mb-4">NOTARY ACKNOWLEDGMENT</h4>
                  <div className="space-y-2">
                    <p className="text-sm">State of _______________</p>
                    <p className="text-sm">County of _______________</p>
                    <p className="text-sm mt-4">
                      On this _____ day of _____________, 20__, before me personally appeared
                      ________________________________, who proved to me on the basis of satisfactory
                      evidence to be the person(s) whose name(s) is/are subscribed to the within instrument
                      and acknowledged to me that he/she/they executed the same in his/her/their authorized
                      capacity, and that by his/her/their signature(s) on the instrument the person(s), or the
                      entity upon behalf of which the person(s) acted, executed the instrument.
                    </p>
                    <div className="mt-6 space-y-2">
                      <div className="border-b border-gray-300 pb-1 w-64">
                        <span className="text-xs text-gray-500">Notary Public Signature</span>
                      </div>
                      <div className="border-b border-gray-300 pb-1 w-64">
                        <span className="text-xs text-gray-500">My Commission Expires</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Signature overlay for this page */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {pageSignatures.map((signature) => (
            <Rnd
              key={signature.id}
              className={`absolute transition-none ${
                selectedSignature?.id === signature.id 
                  ? 'z-20' 
                  : 'z-15'
              } opacity-95 pointer-events-auto`}
              size={{ width: signature.width, height: signature.height }}
              position={{ x: signature.x, y: signature.y }}
              onDragStop={(e, d) => {
                if (canEditSignature(signature)) {
                  setDocumentSignatures(prev => prev.map(sig => 
                    sig.id === signature.id ? { ...sig, x: d.x, y: d.y } : sig
                  ));
                }
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                if (canEditSignature(signature)) {
                  setDocumentSignatures(prev => prev.map(sig => 
                    sig.id === signature.id ? { 
                      ...sig, 
                      width: parseInt(ref.style.width), 
                      height: parseInt(ref.style.height),
                      ...position 
                    } : sig
                  ));
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSignature(signature);
              }}
              disableDragging={!canEditSignature(signature)}
              enableResizing={canEditSignature(signature) ? undefined : { 
                bottom: false, bottomLeft: false, bottomRight: false,
                left: false, right: false, top: false, topLeft: false, topRight: false
              }}
            >
              {signature.signatureImage ? (
                <img 
                  src={signature.signatureImage} 
                  alt={`${signature.participantName} ${signature.type}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-serif text-gray-800 bg-gray-50">
                  {signature.content}
                </div>
              )}
              
              {/* Selection indicator */}
              {selectedSignature?.id === signature.id && (
                <>
                  <div className="absolute inset-0 border-2 border-blue-500 rounded-sm pointer-events-none" />
                  <div className="absolute -top-8 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                    {signature.type} - {signature.participantName}
                  </div>
                  {canEditSignature(signature) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSignature(signature.id);
                      }}
                      className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 flex items-center justify-center"
                      title="Delete signature"
                    >
                      ×
                    </button>
                  )}
                </>
              )}
            </Rnd>
          ))}
        </div>
      </div>
    )
  }

  const renderDisclosureStatement = () => {
    const pageSignatures = documentSignatures.filter(sig => (sig.page || 1) === 1);
    
    return (
      <div className="relative" data-page-number="1">
        <div className="p-8 bg-white min-h-full">
          <div className="max-w-2xl mx-auto space-y-6 text-sm leading-relaxed">
            <div className="text-center border-b pb-4 mb-6">
              <h1 className="text-xl font-bold mb-2">PROPERTY DISCLOSURE STATEMENT</h1>
              <p className="text-gray-600">Property Address: 123 Main Street, Anytown, ST 12345</p>
              <p className="text-gray-600">Date: {new Date().toLocaleDateString()}</p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">PROPERTY CONDITION</h3>
                <p>The seller hereby discloses the following information about the property condition based on seller's actual knowledge as of the date of this disclosure.</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">STRUCTURAL ELEMENTS</h3>
                <p>☐ No known problems ☐ Problems exist (explain): ________________</p>
              </div>

              <div className="mt-12 pt-8 border-t">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-4">SELLER SIGNATURE</h4>
                    <div className="border-b border-gray-300 pb-1 w-64">
                      <span className="text-xs text-gray-500">Signature</span>
                    </div>
                    <div className="border-b border-gray-300 pb-1 w-64 mt-2">
                      <span className="text-xs text-gray-500">Date</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Signature overlay for this page */}
        <div className="absolute inset-0 pointer-events-none z-10" style={{ border: pageSignatures.length > 0 ? '2px dashed red' : 'none' }}>
          {pageSignatures.map((signature) => (
            <Rnd
              key={signature.id}
              className={`absolute transition-none ${
                selectedSignature?.id === signature.id 
                  ? 'z-20' 
                  : 'z-15'
              } opacity-95 pointer-events-auto`}
              size={{ width: signature.width, height: signature.height }}
              position={{ x: signature.x, y: signature.y }}
              onDragStop={(e, d) => {
                if (canEditSignature(signature)) {
                  setDocumentSignatures(prev => prev.map(sig => 
                    sig.id === signature.id ? { ...sig, x: d.x, y: d.y } : sig
                  ));
                }
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                if (canEditSignature(signature)) {
                  setDocumentSignatures(prev => prev.map(sig => 
                    sig.id === signature.id ? { 
                      ...sig, 
                      width: parseInt(ref.style.width), 
                      height: parseInt(ref.style.height),
                      ...position 
                    } : sig
                  ));
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (canEditSignature(signature)) {
                  setSelectedSignature(signature);
                }
              }}
              disableDragging={!canEditSignature(signature)}
              enableResizing={canEditSignature(signature) ? undefined : { 
                bottom: false, bottomLeft: false, bottomRight: false,
                left: false, right: false, top: false, topLeft: false, topRight: false
              }}
            >
              <div className="flex items-center justify-center h-full text-xs font-medium text-green-800 px-2 text-center leading-tight">
                <div className="w-full">
                  {signature.type === 'signature' && (
                    signature.signatureImage ? (
                      <img 
                        src={signature.signatureImage} 
                        alt="Signature"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="font-serif italic text-base text-green-900">{signature.content}</div>
                    )
                  )}
                  {signature.type === 'initial' && (
                    signature.signatureImage ? (
                      <img 
                        src={signature.signatureImage} 
                        alt="Initials"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="font-bold text-xl text-green-900">{signature.content}</div>
                    )
                  )}
                  {signature.type === 'date' && (
                    <div className="text-sm font-medium text-green-900">{signature.content}</div>
                  )}
                  {signature.type === 'stamp' && (
                    signature.signatureImage ? (
                      <img 
                        src={signature.signatureImage} 
                        alt="Stamp"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-xs leading-tight whitespace-pre-line text-green-900 font-bold">
                        {signature.content}
                      </div>
                    )
                  )}
                  {signature.type === 'text' && (
                    <div className="text-sm font-medium text-green-900">{signature.content}</div>
                  )}
                  {signature.type === 'checkbox' && (
                    <div className="border-2 border-green-800 rounded flex items-center justify-center" style={{ width: '18px', height: '18px' }}>
                      <span className="text-green-900 font-bold text-sm">✓</span>
                    </div>
                  )}
                  {signature.type === 'name' && (
                    <div className="text-sm font-medium text-green-900">{signature.content}</div>
                  )}
                  {signature.type === 'title' && (
                    <div className="text-sm font-medium text-green-900">{signature.content}</div>
                  )}
                  {signature.type === 'commission-id' && (
                    <div className="text-sm font-medium text-green-900">{signature.content}</div>
                  )}
                  {signature.type === 'commission-exp' && (
                    <div className="text-sm font-medium text-green-900">{signature.content}</div>
                  )}
                  {signature.type === 'disclosure' && (
                    <div className="text-xs text-green-900 whitespace-pre-wrap">{signature.content}</div>
                  )}
                  {signature.type === 'white-out' && (
                    <div className="bg-white w-full h-full" style={{ opacity: 0.95 }}></div>
                  )}
                </div>
              </div>
              {/* Edit Controls */}
              {selectedSignature?.id === signature.id && canEditSignature(signature) && (
                <div className="absolute -top-8 right-0 flex items-center space-x-1 bg-white border border-gray-300 rounded px-2 py-1 shadow-sm z-30">
                  <span className="text-xs text-gray-600">
                    {signature.type === 'signature' ? '✍️' : 
                     signature.type === 'initial' ? '✓' : 
                     signature.type === 'stamp' ? '🔘' : 
                     signature.type === 'checkbox' ? '☑️' :
                     signature.type === 'date' ? '📅' :
                     signature.type === 'name' ? '👤' :
                     signature.type === 'title' ? '🏆' :
                     signature.type === 'commission-id' ? '🆔' :
                     signature.type === 'commission-exp' ? '📆' :
                     signature.type === 'disclosure' ? '📄' :
                     signature.type === 'white-out' ? '⬜' :
                     '📝'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSignature(signature.id);
                    }}
                    className="text-red-600 hover:text-red-800 text-xs p-1 hover:bg-red-50 rounded"
                    title="Delete signature"
                  >
                    🗑️
                  </button>
                </div>
              )}
              {/* Tooltip */}
              <div className="absolute -bottom-8 left-0 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                Signed by {signature.participantName} • {signature.signedAt ? new Date(signature.signedAt).toLocaleString() : 'Unknown time'}
                {canEditSignature(signature) && (
                  <div className="text-gray-300">Click to select • Drag to move • Click delete to remove</div>
                )}
              </div>
            </Rnd>
          ))}
        </div>
      </div>
    );
  };

  const renderWarrantyDeed = () => {
    const pageSignatures = documentSignatures.filter(sig => (sig.page || 1) === 1);
    
    return (
      <div className="relative" data-page-number="1">
        <div className="p-8 bg-white min-h-full">
          <div className="max-w-2xl mx-auto space-y-6 text-sm leading-relaxed">
            <div className="text-center border-b pb-4 mb-6">
              <h1 className="text-xl font-bold mb-2">WARRANTY DEED</h1>
              <p className="text-gray-600">Property Address: 123 Main Street, Anytown, ST 12345</p>
              <p className="text-gray-600">Date: {new Date().toLocaleDateString()}</p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">GRANTOR</h3>
                <p>_________________________, a ________________</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">GRANTEE</h3>
                <p>_________________________, a ________________</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">CONSIDERATION</h3>
                <p>For the sum of $350,000.00 and other good and valuable consideration.</p>
              </div>

              <div className="mt-12 pt-8 border-t">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-4">GRANTOR</h4>
                    <div className="space-y-2">
                      <div className="border-b border-gray-300 pb-1">
                        <span className="text-xs text-gray-500">Signature</span>
                      </div>
                      <div className="border-b border-gray-300 pb-1">
                        <span className="text-xs text-gray-500">Print Name</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-4">GRANTEE</h4>
                    <div className="space-y-2">
                      <div className="border-b border-gray-300 pb-1">
                        <span className="text-xs text-gray-500">Signature</span>
                      </div>
                      <div className="border-b border-gray-300 pb-1">
                        <span className="text-xs text-gray-500">Print Name</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notary Section */}
                <div className="mt-8 pt-4 border-t">
                  <h4 className="font-semibold mb-4">NOTARY ACKNOWLEDGMENT</h4>
                  <div className="space-y-2">
                    <p className="text-sm">State of _______________</p>
                    <p className="text-sm">County of _______________</p>
                    <div className="mt-6 space-y-2">
                      <div className="border-b border-gray-300 pb-1 w-64">
                        <span className="text-xs text-gray-500">Notary Public Signature</span>
                      </div>
                      <div className="border-b border-gray-300 pb-1 w-64">
                        <span className="text-xs text-gray-500">My Commission Expires</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Signature overlay for this page */}
        <div className="absolute inset-0 pointer-events-none z-10" style={{ border: pageSignatures.length > 0 ? '2px dashed red' : 'none' }}>
          {pageSignatures.map((signature) => (
            <Rnd
              key={signature.id}
              className={`absolute transition-none ${
                selectedSignature?.id === signature.id 
                  ? 'z-20' 
                  : 'z-15'
              } opacity-95 pointer-events-auto`}
              size={{ width: signature.width, height: signature.height }}
              position={{ x: signature.x, y: signature.y }}
              onDragStop={(e, d) => {
                if (canEditSignature(signature)) {
                  setDocumentSignatures(prev => prev.map(sig => 
                    sig.id === signature.id ? { ...sig, x: d.x, y: d.y } : sig
                  ));
                }
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                if (canEditSignature(signature)) {
                  setDocumentSignatures(prev => prev.map(sig => 
                    sig.id === signature.id ? { 
                      ...sig, 
                      width: parseInt(ref.style.width), 
                      height: parseInt(ref.style.height),
                      ...position 
                    } : sig
                  ));
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (canEditSignature(signature)) {
                  setSelectedSignature(signature);
                }
              }}
              disableDragging={!canEditSignature(signature)}
              enableResizing={canEditSignature(signature) ? undefined : { 
                bottom: false, bottomLeft: false, bottomRight: false,
                left: false, right: false, top: false, topLeft: false, topRight: false
              }}
            >
              <div className="flex items-center justify-center h-full text-xs font-medium text-green-800 px-2 text-center leading-tight">
                <div className="w-full">
                  {signature.type === 'signature' && (
                    signature.signatureImage ? (
                      <img 
                        src={signature.signatureImage} 
                        alt="Signature"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="font-serif italic text-base text-green-900">{signature.content}</div>
                    )
                  )}
                  {signature.type === 'initial' && (
                    signature.signatureImage ? (
                      <img 
                        src={signature.signatureImage} 
                        alt="Initials"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="font-bold text-xl text-green-900">{signature.content}</div>
                    )
                  )}
                  {signature.type === 'date' && (
                    <div className="text-sm font-medium text-green-900">{signature.content}</div>
                  )}
                  {signature.type === 'stamp' && (
                    signature.signatureImage ? (
                      <img 
                        src={signature.signatureImage} 
                        alt="Stamp"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-xs leading-tight whitespace-pre-line text-green-900 font-bold">
                        {signature.content}
                      </div>
                    )
                  )}
                  {signature.type === 'text' && (
                    <div className="text-sm font-medium text-green-900">{signature.content}</div>
                  )}
                  {signature.type === 'checkbox' && (
                    <div className="border-2 border-green-800 rounded flex items-center justify-center" style={{ width: '18px', height: '18px' }}>
                      <span className="text-green-900 font-bold text-sm">✓</span>
                    </div>
                  )}
                  {signature.type === 'name' && (
                    <div className="text-sm font-medium text-green-900">{signature.content}</div>
                  )}
                  {signature.type === 'title' && (
                    <div className="text-sm font-medium text-green-900">{signature.content}</div>
                  )}
                  {signature.type === 'commission-id' && (
                    <div className="text-sm font-medium text-green-900">{signature.content}</div>
                  )}
                  {signature.type === 'commission-exp' && (
                    <div className="text-sm font-medium text-green-900">{signature.content}</div>
                  )}
                  {signature.type === 'disclosure' && (
                    <div className="text-xs text-green-900 whitespace-pre-wrap">{signature.content}</div>
                  )}
                  {signature.type === 'white-out' && (
                    <div className="bg-white w-full h-full" style={{ opacity: 0.95 }}></div>
                  )}
                </div>
              </div>
              {/* Edit Controls */}
              {selectedSignature?.id === signature.id && canEditSignature(signature) && (
                <div className="absolute -top-8 right-0 flex items-center space-x-1 bg-white border border-gray-300 rounded px-2 py-1 shadow-sm z-30">
                  <span className="text-xs text-gray-600">
                    {signature.type === 'signature' ? '✍️' : 
                     signature.type === 'initial' ? '✓' : 
                     signature.type === 'stamp' ? '🔘' : 
                     signature.type === 'checkbox' ? '☑️' :
                     signature.type === 'date' ? '📅' :
                     signature.type === 'name' ? '👤' :
                     signature.type === 'title' ? '🏆' :
                     signature.type === 'commission-id' ? '🆔' :
                     signature.type === 'commission-exp' ? '📆' :
                     signature.type === 'disclosure' ? '📄' :
                     signature.type === 'white-out' ? '⬜' :
                     '📝'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSignature(signature.id);
                    }}
                    className="text-red-600 hover:text-red-800 text-xs p-1 hover:bg-red-50 rounded"
                    title="Delete signature"
                  >
                    🗑️
                  </button>
                </div>
              )}
              {/* Tooltip */}
              <div className="absolute -bottom-8 left-0 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                Signed by {signature.participantName} • {signature.signedAt ? new Date(signature.signedAt).toLocaleString() : 'Unknown time'}
                {canEditSignature(signature) && (
                  <div className="text-gray-300">Click to select • Drag to move • Click delete to remove</div>
                )}
              </div>
            </Rnd>
          ))}
        </div>
      </div>
    );
  };

  // Start live signing session
  const startSession = async (mode: 'signing') => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to start the session",
          variant: "destructive",
        });
        return;
      }

      // Check if all required participants are connected
      const requiredParticipants = participants.filter(p => 
        p.role === 'signer' || p.role === 'notary'
      );
      const disconnectedParticipants = requiredParticipants.filter(p => !p.isConnected);
      
      // In development mode, allow admin to start session even if participants aren't connected
      const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
      const isAdminOrNotary = currentUser?.role === 'admin' || currentUser?.role === 'notary';
      
      if (disconnectedParticipants.length > 0 && !(isDevelopment && isAdminOrNotary)) {
        toast({
          title: "Waiting for Participants",
          description: `${disconnectedParticipants.length} participant(s) need to join before starting. All signers and notaries must be present.`,
          variant: "destructive",
        });
        return;
      }
      
      // Show warning if starting without all participants in development
      if (disconnectedParticipants.length > 0 && isDevelopment && isAdminOrNotary) {
        toast({
          title: "Development Mode: Session Starting",
          description: `Starting session without all participants connected. This is allowed in development mode only.`,
          variant: "default",
        });
      }

      // Create a video session for live video calls
      try {
        const videoSessionResponse = await fetch(`/api/jobs/${jobId}/video-session`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionType: 'live-signing',
            participants: participants.map(p => ({
              id: p.id,
              name: p.name,
              email: p.email,
              role: p.role
            }))
          })
        });

        if (videoSessionResponse.ok) {
          const sessionData = await videoSessionResponse.json();
          setSessionToken(sessionData.sessionToken || sessionData.roomName);
          setRoomUrl(sessionData.roomUrl);
          setShowWherebyVideo(true);
          console.log('Video session created:', sessionData);
          
          toast({
            title: "Video Session Ready",
            description: "Whereby video conferencing is now active",
          });
        } else {
          throw new Error(`Failed to create video session: ${videoSessionResponse.status}`);
        }
      } catch (error) {
        console.error('Video session creation failed:', error);
        
        // In development, still show video with a fallback room URL
        if (isDevelopment) {
          const fallbackRoomUrl = `https://notary-digital.whereby.com/notary-session-${jobId}-${Date.now()}`;
          setRoomUrl(fallbackRoomUrl);
          setShowWherebyVideo(true);
          
          toast({
            title: "Development Mode: Using Fallback Video",
            description: "Backend session creation failed, but video will still work with fallback room URL",
            variant: "default",
          });
        } else {
          toast({
            title: "Video Session Failed",
            description: "Could not create video session. Session will continue without video.",
            variant: "destructive",
          });
        }
      }

      // Update job status to indicate signing in progress
      try {
        await fetch(`/api/jobs/${jobId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobStatus: 'in_progress',
            sessionStartedAt: new Date().toISOString(),
            sessionStartedBy: currentUser?.id
          })
        });
      } catch (error) {
        console.error('Failed to update job status');
      }
      
      setRecordingTime(0);
      setSessionStarted(true);
      setSessionMode('signing');
      setIsRecording(true); // Always start recording
      setRecordingStarted(true);
      
      // Notify all participants that session has started
      setParticipants(prev => prev.map(p => ({
        ...p,
        isConnected: p.id === currentUser?.id?.toString() ? true : p.isConnected
      })));
      
      toast({
        title: "Live Signing Session Started",
        description: "Recording has started automatically. All participants must remain connected.",
      });
    } catch (error) {
      console.error('Session start error:', error);
      toast({
        title: "Session Start Failed",
        description: "Unable to start session. Please refresh and try again.",
        variant: "destructive",
      });
    }
  };

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(time => time + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Document functions
  const syncDocumentView = () => {
    // Sync scroll position and document state for all participants
    const container = document.querySelector('[data-document-container]') as HTMLElement;
    if (container) {
      setDocumentScrollPosition(container.scrollTop);
      // Broadcast sync to all participants
      setIsDocumentSynced(true);
      setTimeout(() => setIsDocumentSynced(false), 2000);
      toast({
        title: "Document Synced",
        description: "All participants now see your view",
      });
    }
  };

  // Generate actual signature content based on type and participant data
  const generateSignatureContent = (type: string, participantId: string) => {
    const participant = participants.find(p => p.id === participantId);
    const currentDate = new Date();
    const isCurrentUser = participantId === currentUser?.id?.toString();
    
    switch (type) {
      case 'signature':
        // Use actual signature data if available
        if (isCurrentUser && availableUserSignatures.signature) {
          return availableUserSignatures.signature.signatureData;
        }
        if (participant?.signatureData) {
          return participant.signatureData;
        }
        // Return participant name for text-based signature
        return participant?.name || getUserDisplayName(currentUser);
        
      case 'initial':
        // Use actual initial data if available from dashboard
        if (isCurrentUser && availableUserSignatures.initial) {
          return availableUserSignatures.initial.signatureData;
        }
        // Generate initials from participant name
        const name = participant?.name || getUserDisplayName(currentUser);
        const initials = name.split(' ')
          .filter(n => n.length > 0)
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 3); // Max 3 characters for initials
        return initials || 'N/A';
        
      case 'date':
        // Current date in legal format
        return currentDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
      case 'text':
        // Default text content
        return 'Enter text here';
        
      case 'stamp':
        // Notary stamp content from user profile if available
        if (isCurrentUser && userProfile) {
          const notaryName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.username;
          const state = userProfile.state || '[State]';
          const commissionNumber = userProfile.commissionNumber || '[Commission #]';
          const expirationDate = userProfile.commissionExpiration ? new Date(userProfile.commissionExpiration).toLocaleDateString() : '[Exp. Date]';
          return `NOTARY PUBLIC\n${notaryName}\nState of ${state}\nComm. #${commissionNumber}\nExp: ${expirationDate}`;
        }
        // Fallback for other participants or if profile not loaded
        const notaryName = participant?.name || getUserDisplayName(currentUser);
        return `NOTARY PUBLIC\n${notaryName}\nState of [State]\nComm. #[Number]\nExp: [Date]`;
        
      case 'checkbox':
        // Checkbox checked mark
        return '✓';
        
      case 'name':
        // Notary name from profile if available
        if (isCurrentUser && userProfile) {
          return `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.username;
        }
        return participant?.name || getUserDisplayName(currentUser) || '[Notary Name]';
        
      case 'title':
        // Notary title from profile
        return (isCurrentUser && userProfile?.title) || 'Notary Public';
        
      case 'commission-id':
        // Commission ID from profile
        return (isCurrentUser && userProfile?.commissionNumber) || '[Commission ID]';
        
      case 'commission-exp':
        // Commission expiration from profile
        if (isCurrentUser && userProfile?.commissionExpiration) {
          return new Date(userProfile.commissionExpiration).toLocaleDateString();
        }
        return '[Commission Exp Date]';
        
      case 'disclosure':
        // Standard notary disclosure text from profile
        return (isCurrentUser && userProfile?.disclosure) || 'I acknowledge that this document was signed before me on this date.';
        
      case 'white-out':
        // White out has no text content
        return '';
        
      default:
        return type.toUpperCase();
    }
  };

  // Enhanced identity verification handler
  const handleIdentityVerification = (verificationData: any) => {
    setIdentityVerified(prev => ({
      ...prev,
      [verificationData.metadata.participantId]: true
    }));
    
    // Identity verification completed
    toast({
      title: "Identity Verified",
      description: `Identity verified with ${verificationData.confidence}% confidence`,
    });
  };

  const handleIdentityVerificationFailed = (error: string) => {
    toast({
      title: "Identity Verification Failed",
      description: error,
      variant: "destructive",
    });
  };

  // Enhanced video recording handlers
  const handleRecordingStart = (recordingId: string) => {
    setSessionRecordingId(recordingId);
  };

  const handleRecordingComplete = (recording: any) => {
    toast({
      title: "Recording Saved",
      description: "Session recording saved securely",
    });
  };

  // Enhanced signature capture with professional system
  const handleProfessionalSignatureComplete = (signatureData: string, metadata: any) => {
    if (pendingSignature) {
      const completedSignature: DocumentTag = {
        ...pendingSignature,
        content: signatureData,
        signatureImage: signatureData,
        signedAt: metadata.timestamp
      } as DocumentTag;
      
      setDocumentSignatures(prev => [...prev, completedSignature]);
      
      // Update participant data with signature
      setParticipants(prev => prev.map(participant => 
        participant.id === pendingSignature.participantId 
          ? { 
              ...participant, 
              hasAgreed: true, 
              signatureData: signatureData 
            }
          : participant
      ));
      
      // Save to dashboard for future use
      if (currentUser && pendingSignature.participantId === currentUser.id?.toString()) {
        try {
          const savedSigsString = localStorage.getItem(`signatures_${currentUser.id}`) || '[]';
          const savedSignatures = JSON.parse(savedSigsString);
          
          const newSignature = {
            id: Date.now().toString(),
            name: `${pendingSignature.type === 'signature' ? 'Signature' : 'Initials'} - ${new Date().toLocaleDateString()}`,
            type: pendingSignature.type,
            signatureData: signatureData,
            isActive: savedSignatures.filter((s: any) => s.type === pendingSignature.type).length === 0,
            createdAt: new Date().toISOString(),
            usageCount: 1
          };
          
          savedSignatures.push(newSignature);
          localStorage.setItem(`signatures_${currentUser.id}`, JSON.stringify(savedSignatures));
          
          // Update available signatures for this session
          loadUserProfileData(currentUser.id, localStorage.getItem('token') || '');
          
          toast({
            title: "Saved to Dashboard",
            description: `Your ${pendingSignature.type} has been saved to your dashboard for future use`,
          });
        } catch (error) {
          console.error('Error saving signature to dashboard:', error);
        }
      }
      
      setPendingSignature(null);
      setShowProfessionalSignature(false);
      
      setTimeout(() => {
        setIsDocumentSynced(true);
        setTimeout(() => setIsDocumentSynced(false), 2000);
      }, 500);
      
      toast({
        title: "Professional Signature Captured",
        description: `${pendingSignature.type} has been captured and saved`,
      });
    }
  };

  // Handle signature capture completion (legacy method)
  const handleSignatureComplete = (signatureData: string) => {
    if (pendingSignature) {
      const completedSignature: DocumentTag = {
        ...pendingSignature,
        content: signatureData || pendingSignature.participantName || 'Digital Signature',
        signatureImage: signatureData
      } as DocumentTag;
      
      setDocumentSignatures(prev => [...prev, completedSignature]);
      setPendingSignature(null);
      setCapturedSignature('');
      setShowSignatureModal(false);
      
      setTimeout(() => {
        setIsDocumentSynced(true);
        setTimeout(() => setIsDocumentSynced(false), 2000);
      }, 500);
      
      toast({
        title: "Signature Captured",
        description: `${pendingSignature.type} has been permanently added to document`,
      });
    }
  };

  const handleSignatureCancel = () => {
    setPendingSignature(null);
    setCapturedSignature('');
    setShowSignatureModal(false);
  };

  const handleNotaryStampSelect = (stampImage: string) => {
    if (pendingSignature) {
      const completedStamp: DocumentTag = {
        ...pendingSignature,
        content: stampImage,
        signatureImage: stampImage,
        signedAt: new Date().toISOString()
      } as DocumentTag;
      
      setDocumentSignatures(prev => [...prev, completedStamp]);
      setPendingSignature(null);
      setShowNotaryStampModal(false);
      
      setTimeout(() => {
        setIsDocumentSynced(true);
        setTimeout(() => setIsDocumentSynced(false), 2000);
      }, 500);
      
      toast({
        title: "Notary Stamp Applied",
        description: "Notary stamp has been applied to the document",
      });
    }
  };

  const handleStampUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('stamp', file);
    formData.append('notaryId', currentUser?.id?.toString() || '');
    formData.append('state', 'CA'); // Would come from user profile
    formData.append('commission', 'Active'); // Would come from user profile

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/uploads/notary-stamp', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setAvailableStamps(prev => [...prev, result.upload]);
        toast({
          title: "Stamp Uploaded",
          description: "Your notary stamp has been uploaded successfully",
        });
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(errorData.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Stamp upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload notary stamp. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Check if user can edit a signature (admin or signature owner)
  const canEditSignature = (signature: DocumentTag): boolean => {
    if (!currentUser) return false;
    
    // Admins can edit any signature
    if (currentUser.role === 'admin' || currentUser.role === 'notary') {
      return true;
    }
    
    // Users can edit their own signatures
    return signature.participantId === currentUser.id?.toString();
  };

  // Handle signature deletion
  const handleDeleteSignature = (signatureId: string) => {
    const signature = documentSignatures.find(s => s.id === signatureId);
    if (!signature) return;

    if (!canEditSignature(signature)) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to delete this signature",
        variant: "destructive",
      });
      return;
    }

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete this ${signature.type}?\n\n` +
      `Signed by: ${signature.participantName}\n` +
      `Signed at: ${signature.signedAt ? new Date(signature.signedAt).toLocaleString() : 'Unknown time'}\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    setDocumentSignatures(prev => prev.filter(s => s.id !== signatureId));
    
    // Also update participant status if this was their main signature
    if (signature.type === 'signature') {
      setParticipants(prev => prev.map(participant => 
        participant.id === signature.participantId 
          ? { ...participant, hasAgreed: false, signatureData: undefined }
          : participant
      ));
    }

    setSelectedSignature(null);
    
    toast({
      title: "Signature Deleted",
      description: `${signature.type} has been removed from the document`,
    });
  };

  // Handle signature movement start
  const handleSignatureMouseDown = (signature: DocumentTag, e: React.MouseEvent) => {
    if (!canEditSignature(signature)) return;

    e.preventDefault();
    e.stopPropagation();
    
    // Get the document container
    const container = document.querySelector('[data-document-container]') as HTMLElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    
    // Calculate offset from mouse position to signature position
    const offsetX = e.clientX - containerRect.left - signature.x + container.scrollLeft;
    const offsetY = e.clientY - containerRect.top - signature.y + container.scrollTop;

    setSelectedSignature(signature);
    setIsDraggingSignature(true);
    setDragOffset({ x: offsetX, y: offsetY });
  };

  // Handle signature movement
  const handleSignatureMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingSignature || !selectedSignature) return;

    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const scrollTop = (container as HTMLElement).scrollTop;
    
    const newX = e.clientX - rect.left - dragOffset.x;
    const newY = e.clientY - rect.top + scrollTop - dragOffset.y;

    // Constrain to container bounds
    const maxX = rect.width - selectedSignature.width;
    const maxY = container.scrollHeight - selectedSignature.height;
    
    const constrainedX = Math.max(0, Math.min(newX, maxX));
    const constrainedY = Math.max(0, Math.min(newY, maxY));

    setDocumentSignatures(prev => prev.map(sig => 
      sig.id === selectedSignature.id 
        ? { ...sig, x: constrainedX, y: constrainedY }
        : sig
    ));
  };

  // Handle signature movement end
  const handleSignatureMouseUp = () => {
    if (isDraggingSignature && selectedSignature) {
      setIsDraggingSignature(false);
      
      toast({
        title: "Signature Moved",
        description: "Signature position has been updated",
      });
    }
  };

  // Handle clicking outside to deselect or place signatures
  const handleDocumentClick = (e: React.MouseEvent) => {
    if (isDraggingSignature) return;
    
    setSelectedSignature(null);
    
    // If there's a pending signature from the right panel, place it
    if (pendingSignature) {
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollContainer = e.currentTarget as HTMLElement;
      const scrollTop = scrollContainer.scrollTop;
      const scrollLeft = scrollContainer.scrollLeft;
      
      // Get raw browser coordinates
      const rawX = e.clientX - rect.left + scrollLeft;
      const rawY = e.clientY - rect.top + scrollTop;
      
      // For now, use raw coordinates but we'll need to adjust for PDF coordinate system
      // The server will handle the Y-axis flip (browser Y=0 at top, PDF Y=0 at bottom)
      const adjustedX = rawX;
      const adjustedY = rawY;
      
      const newSignature: DocumentTag = {
        id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: pendingSignature.type || 'signature',
        x: adjustedX,
        y: adjustedY,
        width: pendingSignature.width || 120,
        height: pendingSignature.height || 40,
        participantId: pendingSignature.participantId || currentUser?.id?.toString() || '',
        participantName: pendingSignature.participantName || getUserDisplayName(currentUser),
        isPlaced: true,
        content: pendingSignature.content || '',
        signedAt: new Date().toISOString(),
        signatureImage: pendingSignature.signatureImage || '',
        page: 1 // Add page number for multi-page PDFs
      };
      
      setDocumentSignatures(prev => [...prev, newSignature]);
      setPendingSignature(null);
      
      toast({
        title: "Signature Placed",
        description: `${newSignature.type} placed on page 1`,
      });
    }
  };

  const handleComplete = async () => {
    // Check if all required signatures are collected
    const signers = participants.filter(p => p.role === 'signer');
    const unsignedParticipants = signers.filter(p => !p.hasAgreed);
    
    if (unsignedParticipants.length > 0) {
      toast({
        title: "Incomplete Signatures",
        description: `${unsignedParticipants.length} signer(s) still need to complete their signatures`,
        variant: "destructive",
      });
      return;
    }

    // Check if notary has applied their stamp (if required)
    const notaryParticipant = participants.find(p => p.role === 'notary');
    const hasNotaryStamp = documentSignatures.some(sig => sig.type === 'stamp');
    
    if (notaryParticipant && !hasNotaryStamp && currentUser?.role !== 'admin') {
      toast({
        title: "Notary Stamp Required",
        description: "The notary must apply their official stamp before completing",
        variant: "destructive",
      });
      return;
    }

    try {
      // Stop recording if active
      if (isRecording) {
        setIsRecording(false);
        
        // Save recording metadata
        if (sessionToken) {
          await fetch(`/api/jobs/${jobId}/video-session/recording`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              recordingUrl: sessionRecordingId,
              duration: recordingTime,
              participants: participants.map(p => ({
                id: p.id,
                name: p.name,
                role: p.role,
                signedAt: p.hasAgreed ? new Date().toISOString() : null
              }))
            })
          });
        }
      }

      // Generate and save the signed PDF
      const signedPdfUrl = await generateSignedPdf();
      
      if (!signedPdfUrl) {
        throw new Error('Failed to generate signed PDF');
      }

      // Save session completion data
      await saveCompletedDocument();
      
      // Update job status to completed
      const token = localStorage.getItem('token');
      await fetch(`/api/jobs/${jobId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobStatus: 'completed',
          completedAt: new Date().toISOString(),
          completedBy: currentUser?.id,
          notarizedFile: signedPdfUrl
        })
      });

      // End video session
      if (sessionToken) {
        await fetch(`/api/jobs/${jobId}/video-session`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });
      }
      
      toast({
        title: "Session Complete",
        description: "All signatures collected and documents notarized successfully",
      });
      
      // Small delay before redirecting
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error) {
      console.error('Error completing session:', error);
      toast({
        title: "Completion Error",
        description: error instanceof Error ? error.message : "Failed to complete the session. Please try again.",
        variant: "destructive",
      });
    }
  };

  const saveCompletedDocument = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Prepare session data
      const sessionData = {
        jobId: jobId,
        documentId: currentDocument?.id || 'main-document',
        documentName: currentDocument?.name || 'Signed Document',
        completedAt: new Date().toISOString(),
        sessionDuration: recordingTime,
        sessionToken: sessionToken,
        participants: participants.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          role: p.role,
          hasAgreed: p.hasAgreed,
          signedAt: p.hasAgreed ? new Date().toISOString() : null,
          signatureData: p.signatureData
        })),
        signatures: documentSignatures.map(sig => ({
          id: sig.id,
          type: sig.type,
          participantId: sig.participantId,
          participantName: sig.participantName,
          page: sig.page || 1,
          x: sig.x,
          y: sig.y,
          width: sig.width,
          height: sig.height,
          signedAt: sig.signedAt,
          content: sig.content
        })),
        notaryDetails: currentUser?.role === 'notary' || currentUser?.role === 'admin' ? {
          notaryId: currentUser.id,
          notaryName: getUserDisplayName(currentUser),
          notaryEmail: currentUser.email,
          notarizedAt: new Date().toISOString(),
          commissionNumber: 'Active', // Would come from user profile
          state: 'CA' // Would come from user profile
        } : null
      };

      // Save session data
      const response = await fetch(`/api/jobs/${jobId}/session-complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save session data');
      }

      const result = await response.json();
      console.log('Session saved successfully:', result);

      // Update signers status in database
      for (const participant of participants.filter(p => p.role === 'signer')) {
        if (participant.hasAgreed) {
          try {
            await fetch(`/api/signers/${participant.id}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                signingStatus: 'completed',
                signedAt: new Date().toISOString()
              })
            });
          } catch (error) {
            console.error(`Failed to update signer ${participant.id} status:`, error);
          }
        }
      }

    } catch (error) {
      console.error('Error saving completed document:', error);
      throw error;
    }
  };



  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Live Notary Session - Job #{jobId}</h2>
        <div className="flex items-center gap-3">
          {!sessionStarted ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4" />
                <span className={participants.filter(p => p.isConnected).length === participants.length ? 'text-green-600' : 'text-orange-600'}>
                  {participants.filter(p => p.isConnected).length}/{participants.length} connected
                </span>
              </div>
              <Button 
                onClick={() => startSession('signing')} 
                className="px-4"
                disabled={
                  participants.filter(p => p.isConnected).length < participants.length && 
                  !(
                    (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') && 
                    (currentUser?.role === 'admin' || currentUser?.role === 'notary')
                  )
                }
              >
                <Play className="w-4 h-4 mr-2" />
                {participants.filter(p => p.isConnected).length < participants.length 
                  ? ((process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') && 
                     (currentUser?.role === 'admin' || currentUser?.role === 'notary')
                     ? 'Start Session (Dev Mode)' 
                     : 'Waiting for all participants...')
                  : 'Start Live Signing Session'}
              </Button>
            </>
          ) : (
            <>
              <Badge variant="secondary" className="animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2" />
                Recording {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
              </Badge>
              <Badge variant="outline">
                Live Signing Session
              </Badge>
              {isDocumentSynced && (
                <Badge variant="secondary" className="animate-pulse">
                  Synced
                </Badge>
              )}
            </>
          )}
          <Button variant="outline" onClick={onCancel}>
            End Session
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Left Panel - Video Recording & Participants */}
        <div className="w-96 bg-white border-r flex flex-col">
          {/* Integrated Video Recording - Always visible when session starts */}
          {sessionStarted && (
            <div className="p-4 border-b">
              <EnhancedVideoRecorder
                jobId={jobId}
                onRecordingStart={(recordingId) => {
                  setSessionRecordingId(recordingId);
                  setIsRecording(true);
                }}
                onRecordingComplete={handleRecordingComplete}
                autoStart={true} // Start recording automatically
              />
            </div>
          )}

          {/* Live Video Participants */}
          {showWherebyVideo && roomUrl ? (
            <div className="flex-1 overflow-y-auto p-4">
              <WherebyIntegration
                roomUrl={roomUrl}
                jobId={jobId}
                userId={currentUser?.id || 0}
                userName={getUserDisplayName(currentUser)}
                userRole={currentUser?.role || 'signer'}
                onParticipantJoin={(participant) => {
                  // Update participant connection status
                  setParticipants(prev => prev.map(p => {
                    if (p.email === participant.email || p.name === participant.displayName) {
                      return { ...p, isConnected: true };
                    }
                    return p;
                  }));
                }}
                onParticipantLeave={(participant) => {
                  // Update participant connection status
                  setParticipants(prev => prev.map(p => {
                    if (p.email === participant.email || p.name === participant.displayName) {
                      return { ...p, isConnected: false };
                    }
                    return p;
                  }));
                }}
              />
            </div>
          ) : (
            <div className="p-4">
              <h3 className="font-medium text-sm mb-3 flex items-center">
                <Video className="w-4 h-4 mr-2" />
                Participants ({participants.filter(p => p.isConnected).length}/{participants.length})
              </h3>
              <div className="space-y-3">
                {participants.map((participant) => (
                  <div key={participant.id} className="relative">
                    <div className="bg-gray-900 rounded-lg aspect-video relative overflow-hidden">
                      {!sessionStarted ? (
                        <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
                          <div className="text-center">
                            <VideoOff className="w-6 h-6 mx-auto mb-1" />
                            <p>{participant.isConnected ? 'Ready' : 'Waiting to join...'}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
                          <div className="text-center">
                            <Video className="w-6 h-6 mx-auto mb-1" />
                            <p>Video feed active</p>
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-1 left-1 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                        {participant.name.split(' ')[0]}
                      </div>
                      <div className={`absolute top-1 right-1 w-3 h-3 rounded-full ${participant.isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                    </div>
                    <div className="text-xs text-center mt-1 text-gray-600 capitalize">
                      {participant.role.replace('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signature Collection */}
          <div className="flex-1 p-4">
            <h3 className="font-medium text-sm mb-3 flex items-center">
              <FileSignature className="w-4 h-4 mr-2" />
              Signatures
            </h3>
            <div className="space-y-3">
              {participants.map((participant) => (
                <div key={participant.id} className="border rounded p-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-medium">{participant.name}</div>
                    <div className={`text-xs px-2 py-1 rounded ${
                      participant.hasAgreed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {participant.hasAgreed ? 'Signed' : 'Pending'}
                    </div>
                  </div>
                  {participant.hasAgreed && participant.signatureData && (
                    <div className="bg-gray-50 p-2 rounded">
                      {participant.signatureData.startsWith('data:image/') ? (
                        <img 
                          src={participant.signatureData} 
                          alt={`${participant.name} signature`}
                          className="h-8 w-auto max-w-full object-contain"
                          onError={(e) => {
                            console.error('Failed to load signature image:', e);
                            // Show fallback text if image fails to load
                            const fallbackDiv = document.createElement('div');
                            fallbackDiv.className = 'text-xs text-gray-600 italic';
                            fallbackDiv.textContent = participant.name;
                            e.currentTarget.parentNode?.appendChild(fallbackDiv);
                            e.currentTarget.style.display = 'none';
                          }}
                          onLoad={() => {
                            console.log('Signature image loaded successfully');
                          }}
                        />
                      ) : (
                        <div className="text-xs font-serif italic text-gray-800">
                          {participant.signatureData}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t">
              <Button onClick={handleComplete} className="w-full" size="sm">
                <CheckCircle className="w-4 h-4 mr-2" />
                Complete Session
              </Button>
            </div>
          </div>
        </div>

        {/* Center Panel - Document Viewer */}
        <div className="flex-1 bg-white relative">
          <div className="h-full flex flex-col">
            
            <div 
              className={`flex-1 overflow-hidden relative bg-white transition-colors w-full ${
                isDragOver ? 'bg-blue-50 border-blue-300' : ''
              } ${isDraggingSignature ? 'cursor-move' : ''}`}
              style={{ height: 'calc(100vh - 80px)', maxHeight: 'calc(100vh - 80px)' }}
              data-document-container
              onClick={handleDocumentClick}
              onScroll={(e) => {
                // Track individual scroll position for this user
                const scrollTop = (e.target as HTMLElement).scrollTop;
                setDocumentScrollPosition(scrollTop);
                
                // Force re-render of signatures to update their positions
                setDocumentSignatures(prev => [...prev]);
              }}
              onMouseMove={handleSignatureMouseMove}
              onMouseUp={handleSignatureMouseUp}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                
                const rect = e.currentTarget.getBoundingClientRect();
                const scrollTop = (e.currentTarget as HTMLElement).scrollTop;
                const dropX = e.clientX - rect.left;
                const dropY = e.clientY - rect.top + scrollTop; // Account for scroll position
                
                // Find which PDF page this drop occurred on
                let targetPage = 1;
                let pageRelativeX = dropX;
                let pageRelativeY = dropY;
                
                // Look for page containers to determine which page and relative position
                const pageContainers = Array.from(document.querySelectorAll('[data-page-number]'));
                for (const pageContainer of pageContainers) {
                  const pageRect = pageContainer.getBoundingClientRect();
                  const containerRect = rect;
                  
                  // Check if drop position is within this page
                  if (dropY >= (pageRect.top - containerRect.top + scrollTop) && 
                      dropY <= (pageRect.bottom - containerRect.top + scrollTop)) {
                    targetPage = parseInt(pageContainer.getAttribute('data-page-number') || '1');
                    // Calculate position relative to this page
                    pageRelativeX = dropX - (pageRect.left - containerRect.left);
                    pageRelativeY = dropY - (pageRect.top - containerRect.top + scrollTop);
                    break;
                  }
                }
                
                const x = pageRelativeX;
                const y = pageRelativeY;
                
                const draggedType = e.dataTransfer.getData('text/plain');
                if (draggedType) {
                  let currentParticipant = participants.find(p => p.role === 'signer') || participants[0];
                  
                  // Safety check: if no participant is available, use current user as fallback
                  if (!currentParticipant) {
                    const fallbackParticipant = {
                      id: currentUser?.id?.toString() || '1',
                      name: currentUser ? getUserDisplayName(currentUser) : 'Current User',
                      email: currentUser?.email || 'unknown@example.com',
                      role: 'signer' as const,
                      isConnected: true,
                      hasAgreed: false
                    };
                    
                    toast({
                      title: "Participant Loading",
                      description: "Using current user for signing. Please wait for all participants to load.",
                      variant: "default",
                    });
                    
                    // Add fallback participant if participants list is empty
                    if (participants.length === 0) {
                      setParticipants([fallbackParticipant]);
                    }
                    
                    // Use the fallback participant
                    currentParticipant = fallbackParticipant;
                  }
                  
                  // For signatures and initials, check if user has saved ones from dashboard
                  if (draggedType === 'signature' || draggedType === 'initial') {
                    const availableSignature = availableUserSignatures[draggedType as 'signature' | 'initial'];
                    
                    if (availableSignature && availableSignature.signatureData) {
                      // Directly place the saved signature without showing modal
                      const newSignature: DocumentTag = {
                        id: Date.now().toString(),
                        type: draggedType as 'signature' | 'initial',
                        content: availableSignature.name || (draggedType === 'signature' ? 'Signature' : 'Initials'),
                        x: x,
                        y: y,
                        width: draggedType === 'signature' ? 150 : 80,
                        height: draggedType === 'signature' ? 60 : 40,
                        participantId: currentParticipant.id,
                        participantName: currentParticipant.name,
                        isPlaced: true,
                        signedAt: new Date().toISOString(),
                        signatureImage: availableSignature.signatureData,
                        page: targetPage
                      };
                      
                      setDocumentSignatures(prev => [...prev, newSignature]);
                      
                      toast({
                        title: `${draggedType === 'signature' ? 'Signature' : 'Initials'} Applied`,
                        description: `Your saved ${draggedType} from dashboard has been placed on the document`,
                      });
                      
                      setTimeout(() => {
                        setIsDocumentSynced(true);
                        setTimeout(() => setIsDocumentSynced(false), 2000);
                      }, 500);
                      
                      return;
                    } else {
                      // No saved signature available - FOR PRODUCTION, this should be restricted
                      // For now, we'll show a warning and still allow signature capture
                      toast({
                        title: "No Dashboard Signature Found",
                        description: `Please create a ${draggedType} in your dashboard first. Creating one now...`,
                        variant: "destructive",
                      });
                      
                      setPendingSignature({
                        id: Date.now().toString(),
                        type: draggedType as 'signature' | 'initial',
                        x: x,
                        y: y,
                        width: draggedType === 'signature' ? 150 : 80,
                        height: draggedType === 'signature' ? 60 : 40,
                        participantId: currentParticipant.id,
                        participantName: currentParticipant.name,
                        isPlaced: true,
                        signedAt: new Date().toISOString(),
                        page: targetPage,
                        content: ''
                      });
                      setCurrentSignatureType(draggedType as 'signature' | 'initial');
                      setShowProfessionalSignature(true);
                      return;
                    }
                  }
                  
                  // For notary stamp, check if active stamp exists in dashboard
                  if (draggedType === 'stamp') {
                    // Check if user has stamps loaded from dashboard
                    const activeStamp = availableStamps.find(stamp => 
                      stamp.metadata?.isActive && stamp.metadata?.isVerified
                    );
                    
                    if (activeStamp) {
                      // Directly place the active stamp without showing modal
                      const newStamp: DocumentTag = {
                        id: Date.now().toString(),
                        type: 'stamp',
                        content: generateSignatureContent('stamp', currentParticipant.id),
                        x: x,
                        y: y,
                        width: 120,
                        height: 80,
                        participantId: currentParticipant.id,
                        participantName: currentParticipant.name,
                        isPlaced: true,
                        signedAt: new Date().toISOString(),
                        signatureImage: activeStamp.processedPath,
                        page: targetPage
                      };
                      
                      setDocumentSignatures(prev => [...prev, newStamp]);
                      
                      toast({
                        title: "Notary Stamp Applied",
                        description: "Your verified notary stamp has been placed on the document",
                      });
                      
                      setTimeout(() => {
                        setIsDocumentSynced(true);
                        setTimeout(() => setIsDocumentSynced(false), 2000);
                      }, 500);
                      
                      return;
                    } else {
                      // No active stamp available, show selection/upload modal
                      setPendingSignature({
                        id: Date.now().toString(),
                        type: 'stamp',
                        x: x,
                        y: y,
                        width: 120,
                        height: 80,
                        participantId: currentParticipant.id,
                        participantName: currentParticipant.name,
                        isPlaced: true,
                        content: generateSignatureContent('stamp', currentParticipant.id), // Use proper stamp content
                        signedAt: new Date().toISOString(),
                        page: targetPage
                      });
                      setShowNotaryStampModal(true);
                      return;
                    }
                  }
                  
                  // For other fields (date, text), use generated content
                  const signatureContent = generateSignatureContent(draggedType, currentParticipant.id);
                  
                  // Set appropriate dimensions based on type
                  let dimensions = { width: 120, height: 30 };
                  switch (draggedType) {
                    case 'checkbox':
                      dimensions = { width: 20, height: 20 };
                      break;
                    case 'date':
                      dimensions = { width: 150, height: 25 };
                      break;
                    case 'text':
                      dimensions = { width: 200, height: 30 };
                      break;
                    case 'name':
                    case 'title':
                      dimensions = { width: 200, height: 30 };
                      break;
                    case 'commission-id':
                    case 'commission-exp':
                      dimensions = { width: 180, height: 25 };
                      break;
                    case 'disclosure':
                      dimensions = { width: 400, height: 60 };
                      break;
                    case 'white-out':
                      dimensions = { width: 100, height: 40 };
                      break;
                  }
                  
                  const newItem: DocumentTag = {
                    id: Date.now().toString(),
                    type: draggedType as 'signature' | 'initial' | 'date' | 'text' | 'stamp' | 'checkbox' | 'name' | 'title' | 'commission-id' | 'commission-exp' | 'disclosure' | 'white-out',
                    x: x,
                    y: y,
                    width: dimensions.width,
                    height: dimensions.height,
                    participantId: currentParticipant.id,
                    participantName: currentParticipant.name,
                    isPlaced: true,
                    content: signatureContent,
                    signedAt: new Date().toISOString(),
                    page: targetPage
                  };
                  
                  // Add to signatures collection for live signing
                  setDocumentSignatures(prev => [...prev, newItem]);
                  
                  setTimeout(() => {
                    setIsDocumentSynced(true);
                    setTimeout(() => setIsDocumentSynced(false), 2000);
                  }, 500);
                  
                  toast({
                    title: "Field Placed",
                    description: `${draggedType} field added to document`,
                  });
                }
              }}
            >
              {/* Document Content */}
              {renderDocumentContent()}
            </div>
          </div>
        </div>


      </div>

      {/* Enhanced Professional Signature Capture Modal */}
      {showProfessionalSignature && pendingSignature && (
        <ProfessionalSignatureCapture
          isOpen={showProfessionalSignature}
          onClose={() => setShowProfessionalSignature(false)}
          onSave={handleProfessionalSignatureComplete}
          participantName={pendingSignature.participantName || 'Unknown'}
          participantId={pendingSignature.participantId || ''}
          sessionId={`session_${Date.now()}`}
          signatureType={currentSignatureType}
          required={true}
        />
      )}

      {/* Legacy Signature Capture Modal (fallback) */}
      {showSignatureModal && pendingSignature && !showProfessionalSignature && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">
              {pendingSignature.type === 'signature' ? 'Capture Signature' : 'Capture Initials'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide your {pendingSignature.type} for {pendingSignature.participantName}
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type your {pendingSignature.type === 'signature' ? 'full name' : 'initials'}:
              </label>
              <input
                type="text"
                value={capturedSignature}
                onChange={(e) => setCapturedSignature(e.target.value)}
                placeholder={pendingSignature.type === 'signature' 
                  ? (currentUser ? getUserDisplayName(currentUser) : 'Your full name')
                  : (currentUser ? getUserDisplayName(currentUser).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'YI')
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            <div className="bg-orange-50 p-3 rounded-md mb-4">
              <p className="text-xs text-orange-800">
                <strong>Notice:</strong> This is a legacy signature method. For enhanced compliance and security, 
                use the Professional Signature Capture system.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setCurrentSignatureType(pendingSignature.type as 'signature' | 'initial');
                  setShowSignatureModal(false);
                  setShowProfessionalSignature(true);
                }}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                Use Professional Capture
              </button>
              <button
                onClick={() => handleSignatureComplete(capturedSignature)}
                disabled={!capturedSignature.trim()}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Apply {pendingSignature.type === 'signature' ? 'Signature' : 'Initials'}
              </button>
              <button
                onClick={handleSignatureCancel}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notary Stamp Selection Modal */}
      {showNotaryStampModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Select Notary Stamp</h3>
            
            {/* Available Stamps */}
            {availableStamps.length > 0 ? (
              <div className="space-y-4 mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select from your dashboard stamps:
                </label>
                <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                  {availableStamps.map((stamp, index) => (
                    <div
                      key={index}
                      onClick={() => handleNotaryStampSelect(stamp.processedPath)}
                      className="p-3 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <img
                        src={stamp.processedPath}
                        alt="Notary stamp"
                        className="w-full h-20 object-contain"
                      />
                      <p className="text-xs text-gray-600 mt-1 text-center">
                        {stamp.metadata?.uploadTime ? new Date(stamp.metadata.uploadTime).toLocaleDateString() : 'Recent'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 mb-6">
                <p className="mb-2">No notary stamps found in your dashboard.</p>
                <p className="text-xs">Upload your first notary stamp below or manage stamps in your profile.</p>
              </div>
            )}
            
            {/* Upload New Stamp */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload New Notary Stamp:
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-gray-400 mb-2">🔘</div>
                  <p className="text-sm text-gray-600 mb-2">
                    Upload your official notary stamp
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleStampUpload(file);
                    }}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    PNG, JPG (max 2MB)
                  </p>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowNotaryStampModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}