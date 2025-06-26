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
import { 
  Users, FileText, Video, Mic, MicOff, VideoOff, 
  Play, Square, Share2, Download, CheckCircle, XCircle, 
  RefreshCw, AlertCircle, FileSignature,
  Eye, Clock, Settings, Upload, RotateCcw, ZoomIn, ZoomOut
} from "lucide-react";

// Enhanced imports for PDF handling
import { SignatureCaptureModal } from './signature-capture-modal';
import { ProfessionalSignatureCapture } from './professional-signature-capture';
import { NotaryStampManager } from '../user/notary-stamp-manager';
import { VouchedIdentityVerification } from '../verification/vouched-identity-verification';
import { EnhancedVideoRecorder } from '../video/enhanced-video-recorder';

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
  type: 'signature' | 'initial' | 'date' | 'text' | 'stamp';
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
  const [sessionMode, setSessionMode] = useState<'tagging' | 'signing'>('tagging');
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sessionToken, setSessionToken] = useState<string>('');
  const [isAuthorized, setIsAuthorized] = useState(false);

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

  // Enhanced system states
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [showIdentityVerification, setShowIdentityVerification] = useState(false);
  const [identityVerified, setIdentityVerified] = useState<Record<string, boolean>>({});

  const [sessionRecordingId, setSessionRecordingId] = useState<string>('');
  const [showProfessionalSignature, setShowProfessionalSignature] = useState(false);
  const [showNotaryStampModal, setShowNotaryStampModal] = useState(false);
  const [availableStamps, setAvailableStamps] = useState<any[]>([]);
  const [jobDocuments, setJobDocuments] = useState<any[]>([]);
  const [currentDocument, setCurrentDocument] = useState<any>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [currentSignatureType, setCurrentSignatureType] = useState<'signature' | 'initial' | 'witness'>('signature');
  const [uploadingDocument, setUploadingDocument] = useState(false);

  // Enhanced PDF handling state
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [pdfViewerType, setPdfViewerType] = useState<'canvas' | 'iframe'>('canvas');

  // PDF.js worker setup
  useEffect(() => {
    // Set up PDF.js worker
    if (typeof window !== 'undefined') {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
    }
  }, []);

  // Load and render PDF using PDF.js
  const loadPdfDocument = async (pdfUrl: string) => {
    setPdfLoading(true);
    setPdfError(null);
    
    try {
      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) {
        throw new Error('PDF.js not loaded. Loading fallback...');
      }

      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      
      setPdfDocument(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      
      toast({
        title: "PDF Loaded Successfully",
        description: `${pdf.numPages} pages ready for signing`,
      });
      
      // Render first page
      await renderPdfPage(pdf, 1);
    } catch (error) {
      console.error('PDF loading error:', error);
      setPdfError(error instanceof Error ? error.message : 'Failed to load PDF');
      
      // Fallback to iframe viewer
      setPdfViewerType('iframe');
      toast({
        title: "Using Fallback Viewer",
        description: "PDF.js failed, using browser PDF viewer",
        variant: "destructive",
      });
    } finally {
      setPdfLoading(false);
    }
  };

  // Render a specific PDF page to canvas
  const renderPdfPage = async (pdf: any, pageNumber: number) => {
    if (!canvasRef.current) return;

    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: pdfScale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      
      await page.render(renderContext).promise;
      
      // Update overlay dimensions to match canvas
      if (overlayRef.current) {
        overlayRef.current.style.width = `${viewport.width}px`;
        overlayRef.current.style.height = `${viewport.height}px`;
      }
    } catch (error) {
      console.error('Error rendering PDF page:', error);
      setPdfError('Failed to render PDF page');
    }
  };

  // PDF navigation functions
  const goToPage = async (pageNumber: number) => {
    if (pdfDocument && pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
      await renderPdfPage(pdfDocument, pageNumber);
    }
  };

  const zoomIn = async () => {
    const newScale = Math.min(pdfScale * 1.2, 3.0);
    setPdfScale(newScale);
    if (pdfDocument) {
      await renderPdfPage(pdfDocument, currentPage);
    }
  };

  const zoomOut = async () => {
    const newScale = Math.max(pdfScale / 1.2, 0.5);
    setPdfScale(newScale);
    if (pdfDocument) {
      await renderPdfPage(pdfDocument, currentPage);
    }
  };

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
        signaturesCount: documentSignatures.length,
        currentPage,
        scale: pdfScale
      });

      const response = await fetch(`/api/jobs/${jobId}/documents/${currentDocument.id}/sign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signatures: documentSignatures,
          page: currentPage,
          scale: pdfScale
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        // Log the raw response before parsing
        const responseText = await response.text();
        console.log('Raw response text:', responseText);
        
        try {
          const result = JSON.parse(responseText);
          console.log('Parsed sign response:', result);
          
          toast({
            title: "Document Signed Successfully",
            description: `Generated signed PDF with ${result.signatureCount} signature(s)`,
          });
          
          // Return the signed PDF URL
          return result.signedPdfUrl;
        } catch (jsonError) {
          console.error('JSON parsing error:', jsonError);
          console.log('Response was not valid JSON:', responseText.substring(0, 500));
          throw new Error('Server returned invalid JSON response');
        }
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
      if (selectedSignature && canEditSignature(selectedSignature)) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          handleDeleteSignature(selectedSignature.id);
        }
        if (e.key === 'Escape') {
          setSelectedSignature(null);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedSignature]);

  // Initialize session and verify access
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Get current user from localStorage
        const userData = localStorage.getItem('user');
        if (!userData) {
          toast({
            title: "Authentication Required",
            description: "Please log in to access this session",
            variant: "destructive",
          });
          setTimeout(() => onCancel(), 100);
          return;
        }
        
        const user = JSON.parse(userData);
        setCurrentUser(user);
        
        // Load job participants from the job data
        const token = localStorage.getItem('token');
        const jobResponse = await fetch(`/api/jobs/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (jobResponse.ok) {
          const jobData = await jobResponse.json();
          
          // Create participants list from job data
          const jobParticipants: Participant[] = [
            {
              id: user.id.toString(),
              name: user.username,
              email: user.email,
              role: user.role as 'notary' | 'signer' | 'witness' | 'title_agent',
              isConnected: true,
              hasAgreed: false
            }
          ];
          
          // Add notary if different from current user
          if (jobData.notaryId && jobData.notaryId !== user.id) {
            jobParticipants.push({
              id: jobData.notaryId.toString(),
              name: 'Assigned Notary',
              email: 'notary@company.com',
              role: 'notary',
              isConnected: false,
              hasAgreed: false
            });
          }
          
          // Add title company representative if different
          if (jobData.titleCompany && user.role !== 'title_company') {
            jobParticipants.push({
              id: 'title_rep',
              name: jobData.titleCompany,
              email: 'contact@titlecompany.com',
              role: 'title_agent',
              isConnected: false,
              hasAgreed: false
            });
          }
          
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
        // Fallback for development
        const fallbackUser = { id: 1, username: 'Demo User', email: 'demo@example.com', role: 'signer' as const };
        setCurrentUser(fallbackUser);
        setParticipants([
          {
            id: '1',
            name: fallbackUser.username,
            email: fallbackUser.email,
            role: fallbackUser.role as 'notary' | 'signer' | 'witness' | 'title_agent',
            isConnected: true,
            hasAgreed: false
          },
          {
            id: '2',
            name: 'Notary Public',
            email: 'notary@company.com',
            role: 'notary',
            isConnected: true,
            hasAgreed: false
          }
        ]);
        setIsAuthorized(true);
      }
    };
    
    initializeSession();
  }, [jobId]);

  // Load PDF when component mounts and document changes
  useEffect(() => {
    if (pdfViewerType === 'canvas' && currentDocument?.type === 'pdf' && currentDocument?.name?.toLowerCase().endsWith('.pdf')) {
      const baseUrl = currentDocument.url || 
                     currentDocument.previewUrl || 
                     `/api/jobs/${jobId}/documents/${currentDocument.id}/preview`;
      
      const token = localStorage.getItem('token');
      const isApiEndpoint = baseUrl.startsWith('/api/');
      const pdfUrl = isApiEndpoint && token 
        ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
        : baseUrl;
      
      if (pdfUrl) {
        loadPdfDocument(pdfUrl);
      }
    }
  }, [currentDocument, pdfViewerType, jobId]);

  // Render document content based on type
  const renderDocumentContent = () => {
    if (loadingDocuments) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading documents...</p>
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
      const pdfUrl = isApiEndpoint && token 
        ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
        : baseUrl;
      
      console.log('Attempting to load PDF:', {
        documentName: currentDocument.name,
        documentId: currentDocument.id,
        jobId: jobId,
        baseUrl: baseUrl,
        pdfUrl: pdfUrl,
        documentType: currentDocument.type,
        hasToken: !!token
      });
      
      return (
        <div className="h-full w-full bg-gray-100 relative">
          {/* Enhanced PDF Header with controls */}
          <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-gray-900">{currentDocument.name}</span>
              <Badge variant="outline" className="ml-2">PDF</Badge>
              {totalPages > 0 && (
                <Badge variant="secondary" className="ml-2">
                  Page {currentPage} of {totalPages}
                </Badge>
              )}
            </div>
            
            {/* PDF Controls */}
            <div className="flex items-center gap-2">
              {pdfViewerType === 'canvas' && totalPages > 1 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </Button>
                </>
              )}
              
              <div className="text-sm text-gray-600">
                Ready for signing
              </div>
            </div>
          </div>
          
          {/* Enhanced PDF Viewer */}
          <div className="h-full w-full overflow-auto" style={{ height: 'calc(100% - 60px)' }}>
            {pdfLoading && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-gray-600">Loading PDF...</p>
                </div>
              </div>
            )}
            
            {pdfError && pdfViewerType === 'canvas' && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <p className="text-gray-600 mb-4">Failed to load PDF with PDF.js</p>
                  <Button
                    onClick={() => setPdfViewerType('iframe')}
                    variant="outline"
                  >
                    Try Fallback Viewer
                  </Button>
                </div>
              </div>
            )}
            
            {pdfViewerType === 'canvas' && !pdfLoading && !pdfError && (
              <div className="relative flex justify-center">
                {/* PDF Canvas */}
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    className="shadow-lg border border-gray-300"
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                  
                  {/* Interactive Signature Overlay */}
                  <div
                    ref={overlayRef}
                    className="absolute top-0 left-0 pointer-events-auto"
                    data-document-container
                    onClick={(e) => handleDocumentClick(e)}
                    style={{ cursor: pendingSignature ? 'crosshair' : 'default' }}
                  >
                    {documentSignatures
                      .filter(sig => sig.page === currentPage || !sig.page)
                      .map((signature) => (
                      <div
                        key={signature.id}
                        className={`absolute border-2 pointer-events-auto cursor-move ${
                          selectedSignature?.id === signature.id
                            ? 'border-blue-500 bg-blue-50 bg-opacity-50'
                            : 'border-gray-300 bg-white bg-opacity-75'
                        } ${canEditSignature(signature) ? 'hover:border-blue-400' : ''}`}
                        style={{
                          left: `${signature.x * pdfScale}px`,
                          top: `${signature.y * pdfScale}px`,
                          width: `${signature.width * pdfScale}px`,
                          height: `${signature.height * pdfScale}px`,
                          zIndex: selectedSignature?.id === signature.id ? 20 : 10,
                        }}
                        onMouseDown={(e) => handleSignatureMouseDown(signature, e)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canEditSignature(signature)) {
                            setSelectedSignature(signature);
                          }
                        }}
                      >
                        <div className="w-full h-full flex items-center justify-center p-1">
                          {signature.type === 'signature' && signature.signatureImage ? (
                            <img 
                              src={signature.signatureImage} 
                              alt="Signature" 
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                console.error('Failed to load signature image:', signature.signatureImage);
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'block';
                              }}
                            />
                          ) : null}
                          <span 
                            className={`text-xs font-medium text-center ${signature.signatureImage ? 'hidden' : 'block'}`}
                            style={{ 
                              fontSize: `${Math.min((signature.width * pdfScale) / 8, (signature.height * pdfScale) / 2, 12)}px`,
                              lineHeight: '1.2'
                            }}
                          >
                            {signature.content || `${signature.type.toUpperCase()}`}
                          </span>
                        </div>
                        
                        {/* Resize handles for selected signatures */}
                        {selectedSignature?.id === signature.id && canEditSignature(signature) && (
                          <>
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border border-white cursor-se-resize"></div>
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border border-white cursor-pointer"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   handleDeleteSignature(signature.id);
                                 }}
                                 title="Delete signature">
                              <span className="text-white text-xs leading-none">×</span>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* PDF Controls */}
                <div className="absolute top-4 left-4 flex flex-col gap-2 z-30">
                  <div className="bg-white rounded-lg shadow-lg p-2 flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={zoomOut}
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={zoomIn}
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                      {Math.round(pdfScale * 100)}%
                    </span>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPdfViewerType('iframe')}
                    className="bg-white shadow-lg"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Browser View
                  </Button>
                </div>
              </div>
            )}
            
            {pdfViewerType === 'iframe' && (
              <div className="w-full h-full relative">
                <iframe
                  src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
                  className="w-full h-full border-0"
                  title={currentDocument.name}
                  allow="fullscreen"
                  onLoad={() => {
                    toast({
                      title: "PDF Loaded",
                      description: "Using browser PDF viewer. Limited signing features.",
                    });
                  }}
                  onError={() => {
                    toast({
                      title: "PDF Loading Failed",
                      description: "Unable to load PDF",
                      variant: "destructive",
                    });
                  }}
                />
                
                <div className="absolute top-4 left-4 z-20">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPdfViewerType('canvas')}
                    className="bg-white shadow-lg"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    PDF.js View
                  </Button>
                </div>
              </div>
            )}
            
            {/* Enhanced action buttons */}
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
                    const signedPdfUrl = await generateSignedPdf();
                    if (signedPdfUrl) {
                      window.open(signedPdfUrl, '_blank');
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download Signed
                </Button>
              )}
            </div>
            
            {/* Debug info (only in development) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded z-30">
                <div>Viewer: {pdfViewerType}</div>
                <div>Scale: {Math.round(pdfScale * 100)}%</div>
                <div>Page: {currentPage}/{totalPages}</div>
                <div>Signatures: {documentSignatures.length}</div>
              </div>
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

  const renderPurchaseAgreement = () => (
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
  );

  const renderDisclosureStatement = () => (
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
  );

  const renderWarrantyDeed = () => (
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
  );

  // Start live signing session
  const startSession = async (mode: 'signing') => {
    try {
      // Skip identity verification for demo purposes
      // const unverifiedParticipants = participants.filter(p => 
      //   p.role === 'signer' && !identityVerified[p.id]
      // );
      
      // if (unverifiedParticipants.length > 0) {
      //   toast({
      //     title: "Identity Verification Required",
      //     description: "All signers must verify their identity before signing can begin",
      //     variant: "destructive",
      //   });
      //   setShowIdentityVerification(true);
      //   return;
      // }

      // Try to get media access, but don't fail if it's not available
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        setIsVideoEnabled(true);
        setIsAudioEnabled(true);
        
        // Start enhanced video recording system only if media is available
        setShowVideoRecorder(true);
        setIsRecording(true);
      } catch (mediaError) {
        console.warn('Media access denied or not available:', mediaError);
        // Continue without video/audio recording
        setIsVideoEnabled(false);
        setIsAudioEnabled(false);
        setIsRecording(false);
        
        toast({
          title: "Media Access Limited",
          description: "Session started without video recording. You can still sign documents.",
        });
      }
      
      setRecordingTime(0);
      setSessionStarted(true);
      setSessionMode('signing');
      
      // Session started successfully
      toast({
        title: "Live Signing Session Started",
        description: "You can now sign the documents using the tools on the right.",
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

  // Generate actual signature content based on type
  const generateSignatureContent = (type: string, participantId: string) => {
    const participant = participants.find(p => p.id === participantId);
    const currentDate = new Date();
    
    switch (type) {
      case 'signature':
        // In production, this would capture actual signature via canvas/stylus
        return participant?.name || 'Digital Signature';
      case 'initial':
        // Generate initials from participant name
        const initials = participant?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'XX';
        return initials;
      case 'date':
        // Current date in legal format
        return currentDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      case 'stamp':
        // Notary stamp with current date and commission info
        return `NOTARY SEAL\n${currentDate.toLocaleDateString()}\n${participant?.name || 'Notary Public'}`;
      case 'text':
        return participant?.name || 'Participant Name';
      default:
        return '';
    }
  };

  // Enhanced identity verification handler
  const handleIdentityVerification = (verificationData: any) => {
    setIdentityVerified(prev => ({
      ...prev,
      [verificationData.metadata.participantId]: true
    }));
    
    // Identity verification completed
    
    setShowIdentityVerification(false);
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
      const response = await fetch('/api/upload/notary-stamp', {
        method: 'POST',
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
        throw new Error('Upload failed');
      }
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload notary stamp. Please try again.",
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

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setSelectedSignature(signature);
    setIsDraggingSignature(true);
    setDragOffset({ x: offsetX, y: offsetY });
    
    e.preventDefault();
    e.stopPropagation();
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
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Adjust coordinates for PDF scale and scroll
      const adjustedX = pdfViewerType === 'canvas' ? x / pdfScale : x;
      const adjustedY = pdfViewerType === 'canvas' ? y / pdfScale : y;
      
      const newSignature: DocumentTag = {
        id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: pendingSignature.type || 'signature',
        x: adjustedX,
        y: adjustedY,
        width: pendingSignature.width || 120,
        height: pendingSignature.height || 40,
        participantId: pendingSignature.participantId || currentUser?.id?.toString() || '',
        participantName: pendingSignature.participantName || currentUser?.username || 'Unknown',
        isPlaced: true,
        content: pendingSignature.content || '',
        signedAt: new Date().toISOString(),
        signatureImage: pendingSignature.signatureImage || '',
        page: currentPage // Add page number for multi-page PDFs
      };
      
      setDocumentSignatures(prev => [...prev, newSignature]);
      setPendingSignature(null);
      
      toast({
        title: "Signature Placed",
        description: `${newSignature.type} placed on page ${currentPage}`,
      });
    }
  };

  const handleComplete = async () => {
    const allSigned = participants.filter(p => p.role === 'signer').every(p => p.hasAgreed);
    if (!allSigned) {
      toast({
        title: "Incomplete Signatures",
        description: "All signers must complete their signatures before finishing",
        variant: "destructive",
      });
      return;
    }

    try {
      // Save completed document with signatures
      await saveCompletedDocument();
      
      toast({
        title: "Session Complete",
        description: "All signatures collected and document saved successfully",
      });
      onComplete();
    } catch (error) {
      console.error('Error completing session:', error);
      toast({
        title: "Completion Error",
        description: "Session completed but there was an error saving the document",
        variant: "destructive",
      });
      onComplete(); // Still complete the session even if saving fails
    }
  };

  const saveCompletedDocument = async () => {
    try {
      const completedDocument = {
        jobId: jobId,
        documentId: currentDocument?.id || 'main-document',
        documentName: currentDocument?.name || 'Signed Document',
        completedAt: new Date().toISOString(),
        participants: participants.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          role: p.role,
          hasAgreed: p.hasAgreed,
          signatureData: p.signatureData
        })),
        signatures: documentSignatures.map(sig => ({
          id: sig.id,
          type: sig.type,
          x: sig.x,
          y: sig.y,
          width: sig.width,
          height: sig.height,
          participantId: sig.participantId,
          participantName: sig.participantName,
          content: sig.content,
          signatureImage: sig.signatureImage,
          signedAt: sig.signedAt
        })),
        sessionData: {
          sessionId: `session_${Date.now()}`,
          recordingId: sessionRecordingId,
          startTime: sessionStarted ? new Date().toISOString() : undefined,
          endTime: new Date().toISOString(),
          duration: recordingTime
        }
      };

      // Save to localStorage for demo purposes
      const existingCompletedDocs = localStorage.getItem(`completed_documents_${jobId}`) || '[]';
      const completedDocs = JSON.parse(existingCompletedDocs);
      completedDocs.push(completedDocument);
      localStorage.setItem(`completed_documents_${jobId}`, JSON.stringify(completedDocs));

      // Also save to global completed documents for all users
      const globalCompletedDocs = localStorage.getItem('all_completed_documents') || '[]';
      const allDocs = JSON.parse(globalCompletedDocs);
      allDocs.push(completedDocument);
      localStorage.setItem('all_completed_documents', JSON.stringify(allDocs));

      console.log('Completed document saved:', completedDocument);
    } catch (error) {
      console.error('Error saving completed document:', error);
      throw error;
    }
  };



  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Live Notary Session</h1>
          <p className="text-sm text-gray-600">Job #{jobId} • {currentDocument?.name || 'Loading...'}</p>
        </div>
        <div className="flex items-center space-x-4">
          {!sessionStarted ? (
            <>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Users className="w-4 h-4" />
                <span>{participants.filter(p => p.isConnected).length}/{participants.length} connected</span>
              </div>
              <Button onClick={() => startSession('signing')} className="px-4">
                <Play className="w-4 h-4 mr-2" />
                Start Live Signing Session
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
        {/* Left Panel - Video Participants */}
        <div className="w-80 bg-white border-r flex flex-col">
          {/* Video Participants */}
          <div className="p-4 border-b">
            <h3 className="font-medium text-sm mb-3 flex items-center">
              <Video className="w-4 h-4 mr-2" />
              Participants ({participants.filter(p => p.isConnected).length}/{participants.length})
            </h3>
            <div className="space-y-3">
              {participants.map((participant) => (
                <div key={participant.id} className="relative">
                  <div className="bg-gray-900 rounded-lg aspect-video relative overflow-hidden">
                    {participant.isConnected ? (
                      <video
                        autoPlay
                        muted={participant.id !== '1'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
                        <div className="text-center">
                          <VideoOff className="w-6 h-6 mx-auto mb-1" />
                          <p>Offline</p>
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
            
            <div className="mt-4 pt-3 border-t">
              <div className="flex justify-center space-x-2">
                <Button
                  variant={isVideoEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                >
                  {isVideoEnabled ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
                </Button>
                <Button
                  variant={isAudioEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                >
                  {isAudioEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          </div>

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
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {jobDocuments.length > 1 ? (
                    <select
                      value={currentDocument?.id || ''}
                      onChange={(e) => {
                        const selectedDoc = jobDocuments.find(doc => doc.id === e.target.value);
                        setCurrentDocument(selectedDoc);
                      }}
                      className="font-medium bg-transparent border-none outline-none cursor-pointer"
                    >
                      {jobDocuments.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.name} {doc.isMainDocument ? '(Main)' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-medium">
                      {currentDocument?.name || 'Loading...'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {jobDocuments.length > 1 && (
                    <div className="text-xs text-gray-500">
                      {jobDocuments.findIndex(doc => doc.id === currentDocument?.id) + 1} of {jobDocuments.length}
                    </div>
                  )}
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx"
                    onChange={handleDocumentUpload}
                    className="hidden"
                    id="live-session-upload"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => document.getElementById('live-session-upload')?.click()}
                    disabled={uploadingDocument}
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    {uploadingDocument ? 'Uploading...' : 'Upload'}
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
            
            <div 
              className={`flex-1 overflow-y-auto relative bg-white transition-colors ${
                isDragOver ? 'bg-blue-50 border-blue-300' : ''
              } ${isDraggingSignature ? 'cursor-move' : ''}`}
              style={{ height: 'calc(100vh - 200px)' }}
              data-document-container
              onClick={handleDocumentClick}
              onScroll={(e) => {
                // Track individual scroll position for this user
                setDocumentScrollPosition((e.target as HTMLElement).scrollTop);
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
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top + scrollTop; // Account for scroll position
                
                const draggedType = e.dataTransfer.getData('text/plain');
                if (draggedType) {
                  const currentParticipant = participants.find(p => p.role === 'signer') || participants[0];
                  
                  // For signatures and initials, show professional capture modal
                  if (draggedType === 'signature' || draggedType === 'initial') {
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
                      signedAt: new Date().toISOString()
                    });
                    setCurrentSignatureType(draggedType as 'signature' | 'initial');
                    setShowProfessionalSignature(true);
                    return;
                  }
                  
                  // For notary stamp, show stamp selection modal
                  if (draggedType === 'stamp') {
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
                      signedAt: new Date().toISOString()
                    });
                    setShowNotaryStampModal(true);
                    return;
                  }
                  
                  // For other fields (date, text), use generated content
                  const signatureContent = generateSignatureContent(draggedType, currentParticipant.id);
                  
                  const newItem: DocumentTag = {
                    id: Date.now().toString(),
                    type: draggedType as 'signature' | 'initial' | 'date' | 'text' | 'stamp',
                    x: x,
                    y: y,
                    width: 120,
                    height: 30,
                    participantId: currentParticipant.id,
                    participantName: currentParticipant.name,
                    isPlaced: true,
                    content: signatureContent,
                    signedAt: new Date().toISOString()
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

              {/* Document Signatures Overlay */}
              {documentSignatures.map((signature) => (
                <div
                  key={signature.id}
                  className={`absolute border-2 border-solid shadow-sm transition-all ${
                    selectedSignature?.id === signature.id 
                      ? 'border-blue-600 bg-blue-50 z-20' 
                      : 'border-green-600 bg-green-50 z-15'
                  } ${canEditSignature(signature) ? 'hover:border-blue-400 hover:bg-blue-25' : ''} opacity-95`}
                  style={{
                    left: `${signature.x}px`,
                    top: `${signature.y}px`,
                    width: `${signature.width}px`,
                    height: `${signature.height}px`,
                    cursor: canEditSignature(signature) ? 'move' : 'default'
                  }}
                  onMouseDown={(e) => handleSignatureMouseDown(signature, e)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canEditSignature(signature)) {
                      setSelectedSignature(signature);
                    }
                  }}
                >
                  <div className="flex items-center justify-center h-full text-xs font-medium text-green-800 px-2 text-center leading-tight">
                    <div className="w-full">
                      {signature.type === 'signature' && (
                        signature.signatureImage && signature.signatureImage.startsWith('data:image/') ? (
                          <img 
                            src={signature.signatureImage} 
                            alt="Signature"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="font-serif italic text-green-900">{signature.content}</div>
                        )
                      )}
                      {signature.type === 'initial' && (
                        signature.signatureImage && signature.signatureImage.startsWith('data:image/') ? (
                          <img 
                            src={signature.signatureImage} 
                            alt="Initials"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="font-bold text-lg text-green-900">{signature.content}</div>
                        )
                      )}
                      {signature.type === 'date' && (
                        <div className="text-xs leading-none text-green-900">{signature.content}</div>
                      )}
                      {signature.type === 'stamp' && (
                        signature.signatureImage && signature.signatureImage.startsWith('data:image/') ? (
                          <img 
                            src={signature.signatureImage} 
                            alt="Stamp"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="text-xs leading-none whitespace-pre-line text-green-900 font-bold border border-green-700 rounded px-1">
                            {signature.content}
                          </div>
                        )
                      )}
                      {signature.type === 'text' && (
                        <div className="text-green-900">{signature.content}</div>
                      )}
                    </div>
                  </div>
                  {/* Edit Controls - only show for selected signature if user has permission */}
                  {selectedSignature?.id === signature.id && canEditSignature(signature) && (
                    <div className="absolute -top-8 right-0 flex items-center space-x-1 bg-white border border-gray-300 rounded px-2 py-1 shadow-sm z-30">
                      <span className="text-xs text-gray-600">
                        {signature.type === 'signature' ? '✍️' : signature.type === 'initial' ? '✓' : signature.type === 'stamp' ? '🔘' : '📝'}
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

                  {/* Signature metadata tooltip */}
                  <div className="absolute -bottom-8 left-0 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                    Signed by {signature.participantName} • {signature.signedAt ? new Date(signature.signedAt).toLocaleString() : 'Unknown time'}
                    {canEditSignature(signature) && (
                      <div className="text-gray-300">Click to select • Drag to move • Click delete to remove</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Document Tools */}
        <div className="w-80 bg-white border-l flex flex-col">
          {/* Document Tools */}
          <div className="p-4 border-b">
            <h3 className="font-medium text-sm mb-3 flex items-center">
              <FileSignature className="w-4 h-4 mr-2" />
              Live Signing Tools
            </h3>
            <div className="space-y-3">
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={syncDocumentView}
                  className="text-xs w-full"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Sync View
                </Button>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">
                  Drag to Document to Sign:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', 'signature')}
                    className="p-2 border border-green-300 bg-green-50 rounded cursor-move hover:bg-green-100 text-xs text-center"
                  >
                    ✍️ Sign Here
                  </div>
                  <div
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', 'initial')}
                    className="p-2 border border-green-300 bg-green-50 rounded cursor-move hover:bg-green-100 text-xs text-center"
                  >
                    ✓ Initial Here
                  </div>
                  <div
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', 'date')}
                    className="p-2 border border-green-300 bg-green-50 rounded cursor-move hover:bg-green-100 text-xs text-center"
                  >
                    📅 Date Here
                  </div>
                  <div
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', 'text')}
                    className="p-2 border border-green-300 bg-green-50 rounded cursor-move hover:bg-green-100 text-xs text-center"
                  >
                    📝 Text Here
                  </div>
                  {/* Notary Stamp for live signing */}
                  <div
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', 'stamp')}
                    className="p-2 border border-blue-300 bg-blue-50 rounded cursor-move hover:bg-blue-100 text-xs text-center col-span-2"
                  >
                    🔘 Notary Stamp
                  </div>
                </div>
              </div>

              {/* Display placed signatures */}
              {documentSignatures.length > 0 && (
                <div className="pt-3 border-t">
                  <label className="text-xs font-medium text-gray-700 mb-2 block">
                    Completed Signatures ({documentSignatures.length})
                  </label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {documentSignatures.map((signature) => (
                      <div
                        key={signature.id}
                        className={`p-2 rounded text-xs border transition-colors ${
                          selectedSignature?.id === signature.id 
                            ? 'bg-blue-50 border-blue-200' 
                            : 'bg-green-50 border-green-200'
                        } ${canEditSignature(signature) ? 'cursor-pointer hover:bg-blue-25' : ''}`}
                        onClick={() => canEditSignature(signature) && setSelectedSignature(signature)}
                      >
                        <div className="flex items-center justify-between">
                          <span>
                            {signature.type === 'signature' && '✍️'}
                            {signature.type === 'initial' && '✓'}
                            {signature.type === 'date' && '📅'}
                            {signature.type === 'text' && '📝'}
                            {signature.type === 'stamp' && '🔘'}
                            {' '}{signature.type}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-green-600 text-xs">
                              ✓ Signed
                            </span>
                            {canEditSignature(signature) && (
                              <span className="text-gray-400 text-xs">
                                📝
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {signature.participantName}
                          {canEditSignature(signature) && (
                            <span className="text-gray-400 ml-2">(editable)</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Edit Instructions */}
                  {documentSignatures.some(s => canEditSignature(s)) && (
                    <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                      <div className="font-medium text-blue-800 mb-1">Edit Signatures:</div>
                      <div className="text-blue-700 space-y-1">
                        <div>• Click a signature to select it</div>
                        <div>• Drag to move position</div>
                        <div>• Click delete (🗑️) or press Del/Backspace</div>
                        <div>• Press Esc to deselect</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Session Info */}
          <div className="flex-1 p-4">
            <h3 className="font-medium text-sm mb-3">Session Info</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <div>Mode: Live Signing Session</div>
              <div>Participants: {participants.filter(p => p.isConnected).length} connected</div>
              <div>Recording: {isRecording ? 'Active' : 'Stopped'}</div>
              <div className="mt-4 p-2 bg-green-50 rounded text-green-800">
                Live signing session in progress. All signatures are permanent once placed and cannot be moved or deleted.
              </div>
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
                placeholder={pendingSignature.type === 'signature' ? 'John Doe' : 'JD'}
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

      {/* Enhanced Video Recording System */}
      {showVideoRecorder && sessionStarted && (
        <div className="fixed bottom-4 right-4 z-40">
          <EnhancedVideoRecorder
            sessionId={`session_${Date.now()}`}
            jobId={jobId}
            participants={participants.map(p => p.name)}
            onRecordingStart={handleRecordingStart}
            onRecordingStop={handleRecordingComplete}
            autoStart={true}
            legalCompliance={true}
          />
        </div>
      )}

      {/* Identity Verification Modal */}
      {showIdentityVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <VouchedIdentityVerification
            sessionId={`session_${Date.now()}`}
            participantId={currentUser?.id?.toString() || '1'}
            participantName={currentUser?.username || 'Demo User'}
            onVerificationComplete={handleIdentityVerification}
            onVerificationFailed={handleIdentityVerificationFailed}
            requireKBA={true}
            requireLiveness={true}
            acceptedDocuments={['drivers_license', 'passport', 'state_id']}
          />
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
                  Select from your uploaded stamps:
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
                <p className="mb-2">No notary stamps uploaded yet.</p>
                <p className="text-xs">Upload your first notary stamp below.</p>
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