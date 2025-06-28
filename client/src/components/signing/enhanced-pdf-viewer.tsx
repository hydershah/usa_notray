import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import SignaturePad from 'signature_pad';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { useToast } from "@/hooks/use-toast";

// Use CDN for worker to avoid Vite bundling issues
// This is more reliable than trying to import the worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// Remove conflicting global window usage
declare global {
  interface Window {
    fabric: any;
    pendingPosition?: { x: number; y: number; pageNumber: number };
  }
}

import { 
  ZoomIn, 
  ZoomOut, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Upload,
  Pen,
  Type,
  Stamp,
  RotateCw,
  Save,
  Trash2,
  MousePointer,
  FileText,
  Image as ImageIcon,
  Palette,
  Undo,
  Redo,
  Move,
  Maximize2,
  Grid,
  Layers,
  User,
  Shield,
  Calendar,
  Hash,
  FileCheck,
  CheckSquare,
  Eraser,
  Settings
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

interface EnhancedPDFViewerProps {
  pdfUrl: string;
  jobId: number;
  currentDocument: any;
  initialAnnotations?: Annotation[];
  userSignatures?: any[];
  notaryStamps?: any[];
  onSignatureAdd?: (signature: any) => void;
  onDocumentSave?: (modifiedPdf: Uint8Array) => void;
  readOnly?: boolean;
}

interface Annotation {
  id: string;
  type: 'signature' | 'initial' | 'text' | 'stamp' | 'date' | 'checkbox' | 'name' | 'title' | 'commission-id' | 'commission-exp' | 'disclosure' | 'white-out';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  pageNumber: number;
  participantId?: string;
  timestamp: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  isImage?: boolean;
  opacity?: number; // for white-out
}

interface PageInfo {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  fabricCanvas?: any;
  viewport: any;
}

export interface EnhancedPDFViewerRef {
  save: () => void;
}

export const EnhancedPDFViewer = forwardRef<EnhancedPDFViewerRef, EnhancedPDFViewerProps>((props, ref) => {
  const { 
    pdfUrl, 
    jobId, 
    currentDocument, 
    initialAnnotations = [],
    userSignatures = [],
    notaryStamps = [],
    onSignatureAdd, 
    onDocumentSave,
    readOnly = false 
  } = props;
  // Canvas and PDF refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageRefs = useRef<Map<number, PageInfo>>(new Map());

  // PDF States
  const [pdfDocument, setPdfDocument] = useState<any | null>(null);
  const [originalPdfBytes, setOriginalPdfBytes] = useState<Uint8Array | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentViewPage, setCurrentViewPage] = useState(1);

  // Annotation States
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  console.log('EnhancedPDFViewer initialized with annotations:', initialAnnotations);
  const [selectedTool, setSelectedTool] = useState<'select' | 'signature' | 'initial' | 'text' | 'stamp' | 'date' | 'checkbox' | 'name' | 'title' | 'commission-id' | 'commission-exp' | 'disclosure' | 'white-out'>('select');
  const selectedToolRef = useRef(selectedTool);  // Use ref to avoid closure issues
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showStampModal, setShowStampModal] = useState(false);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  
  // Signature options
  const [signatureColor, setSignatureColor] = useState('#000000');
  const [signatureThickness, setSignatureThickness] = useState(2);
  const [signatureType, setSignatureType] = useState<'dashboard' | 'draw' | 'type' | 'upload'>('dashboard');
  const [typedSignature, setTypedSignature] = useState('');
  const [signatureFont, setSignatureFont] = useState('Dancing Script');
  
  // Text options
  const [textContent, setTextContent] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [textSize, setTextSize] = useState(16);
  const [textFont, setTextFont] = useState('Arial');

  // Stamp options
  const [stampType, setStampType] = useState<'notary' | 'custom'>('notary');
  const [customStampImage, setCustomStampImage] = useState<string | null>(null);
  const [notaryInfo, setNotaryInfo] = useState({
    name: '',
    commission: '',
    state: '',
    expiration: ''
  });

  // Notary Profile Data (fetched from backend)
  const [notaryProfile, setNotaryProfile] = useState({
    name: '',
    title: '',
    commissionId: '',
    commissionExp: '',
    disclosure: 'I acknowledge that this document was signed before me on this date.',
    signatureData: '',
    initialData: ''
  });

  // History for undo/redo
  const [history, setHistory] = useState<Annotation[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);

  // Expose save function to parent component
  useImperativeHandle(ref, () => ({
    save: saveModifiedPDF,
  }));

  // Pre-fill signature/stamp modals from dashboard data
  useEffect(() => {
    if (userSignatures.length > 0) {
      // Assuming the first signature is the one to use
      const sig = userSignatures[0];
      if (sig.type === 'typed') {
        setTypedSignature(sig.content);
      } else if (sig.type === 'drawn') {
        setCustomStampImage(sig.content); // Using customStampImage for pre-loading drawn sigs
      }
    }
    if (notaryStamps.length > 0) {
      // Assuming the first stamp is the one to use
      const stamp = notaryStamps[0];
      setNotaryInfo({
        name: stamp.notaryName || '',
        commission: stamp.commissionNumber || '',
        state: stamp.state || '',
        expiration: stamp.expirationDate || '',
      });
    }
  }, [userSignatures, notaryStamps]);

  // Wait for Fabric.js to load
  useEffect(() => {
    const checkFabric = () => {
      if (window.fabric) {
        console.log('Fabric.js loaded successfully');
        return true;
      }
      return false;
    };

    if (!checkFabric()) {
      console.log('Waiting for Fabric.js to load...');
      const interval = setInterval(() => {
        if (checkFabric()) {
          clearInterval(interval);
          console.log('Fabric.js is now available');
        }
      }, 100);

      // Clear interval after 10 seconds if Fabric.js doesn't load
      setTimeout(() => {
        clearInterval(interval);
        if (!window.fabric) {
          console.error('Fabric.js failed to load after 10 seconds');
          toast({
            title: "Library Loading Error",
            description: "Some interactive features may not work properly. Please refresh the page.",
            variant: "destructive",
          });
        }
      }, 10000);
    }
  }, []);

  // Monitor selectedTool changes
  useEffect(() => {
    console.log('Selected tool changed to:', selectedTool);
    selectedToolRef.current = selectedTool;  // Update ref to avoid closure issues
  }, [selectedTool]);

  // Load PDF document
  useEffect(() => {
    loadPDF();
  }, [pdfUrl]);

  const loadPDF = async () => {
    if (!pdfUrl) {
      return;
    }
    
    setIsLoading(true);
    setRotation(0); // Reset rotation when a new PDF is loaded
    
    try {
      console.log('Attempting to load PDF with auth token', { pdfUrl });

      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      if (token && pdfUrl.startsWith('/api/')) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(pdfUrl, { headers });

      if (!response.ok) {
        throw new Error(`Failed to load PDF: ${response.status} ${response.statusText}`);
      }

      const pdfBytes = await response.arrayBuffer();
      const originalDoc = new Uint8Array(pdfBytes);
      setOriginalPdfBytes(originalDoc);
      
      const loadingTask = pdfjsLib.getDocument({ data: originalDoc.slice() });
      const pdf = await loadingTask.promise;

      setPdfDocument(pdf);
      setTotalPages(pdf.numPages);
      
      console.log('PDF loaded successfully:', {
        numPages: pdf.numPages,
        pdfBytesLength: pdfBytes.byteLength
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading PDF:', error);
      
      toast({
        title: "Error",
        description: "Failed to load PDF document. Please check if the document exists.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // Load notary profile data
  useEffect(() => {
    loadNotaryProfile();
  }, []);

  const loadNotaryProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      if (token && user.id) {
        // Fetch notary profile data
        const response = await fetch(`/api/users/${user.id}/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const profileData = await response.json();
          setNotaryProfile({
            name: `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() || profileData.username || '',
            title: profileData.title || 'Notary Public',
            commissionId: profileData.commissionNumber || '',
            commissionExp: profileData.commissionExpiration || '',
            disclosure: profileData.disclosure || notaryProfile.disclosure,
            signatureData: profileData.signatureData || '',
            initialData: profileData.initialData || ''
          });
          
          // Update notary info for stamps
          setNotaryInfo({
            name: `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() || profileData.username || '',
            commission: profileData.commissionNumber || '',
            state: profileData.state || '',
            expiration: profileData.commissionExpiration || ''
          });
        }
      }
    } catch (error) {
      console.error('Error loading notary profile:', error);
    }
  };

  // Render all PDF pages
  const renderAllPages = useCallback(async () => {
    if (!pdfDocument || !scrollContainerRef.current) return;

    try {
      // Clear existing page refs
      pageRefs.current.clear();
      
      // Clear the container
      const container = scrollContainerRef.current;
      container.innerHTML = '';

      // Calculate scale to fit full width but maintain readable height
      const containerWidth = container.clientWidth;
      const firstPage = await pdfDocument.getPage(1);
      const baseViewport = firstPage.getViewport({ scale: 1, rotation });
      const widthScale = containerWidth / baseViewport.width;
      
      // Set a reasonable scale that fits width and maintains readable size
      const finalScale = Math.min(widthScale * pdfScale, 1.5); // Cap at 1.5x for readability

      // Render each page
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: finalScale, rotation });
        
        // Create page container with fixed proportions
        const pageContainer = document.createElement('div');
        pageContainer.className = 'relative mb-4 shadow-lg w-full mx-auto bg-white';
        pageContainer.style.width = '100%';
        pageContainer.style.height = `${viewport.height}px`;
        pageContainer.style.maxWidth = `${viewport.width}px`;
        pageContainer.style.position = 'relative'; // Ensure signatures can be positioned relative to this
        pageContainer.style.overflow = 'hidden'; // Contain canvases
        pageContainer.setAttribute('data-page-number', pageNum.toString());
        
        // Add drag and drop event handlers
        pageContainer.addEventListener('dragover', handleDragOver);
        pageContainer.addEventListener('dragleave', handleDragLeave);
        pageContainer.addEventListener('drop', (e) => handleDrop(e as any, pageNum));
        
        // Create PDF canvas
        const pdfCanvas = document.createElement('canvas');
        pdfCanvas.width = viewport.width;
        pdfCanvas.height = viewport.height;
        pdfCanvas.className = 'absolute top-0 left-0 w-full';
        pdfCanvas.style.width = '100%';
        pdfCanvas.style.height = `${viewport.height}px`;
        pdfCanvas.style.zIndex = '1'; // Below fabric canvas
        
        const context = pdfCanvas.getContext('2d');
        if (context) {
          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;
        }
        
        // Create Fabric canvas
        const fabricCanvas = document.createElement('canvas');
        fabricCanvas.id = `fabric-canvas-${pageNum}`;
        fabricCanvas.className = 'absolute top-0 left-0 w-full pointer-events-auto';
        fabricCanvas.style.width = '100%';
        fabricCanvas.style.height = `${viewport.height}px`;
        fabricCanvas.style.zIndex = '10'; // Ensure it's above PDF canvas
        fabricCanvas.width = viewport.width;
        fabricCanvas.height = viewport.height;
        
        pageContainer.appendChild(pdfCanvas);
        pageContainer.appendChild(fabricCanvas);
        container.appendChild(pageContainer);
        
        // Initialize Fabric canvas
        if (window.fabric) {
          console.log('Initializing Fabric canvas for page:', pageNum);
          try {
            const fabric = new window.fabric.Canvas(fabricCanvas.id, {
              width: viewport.width,
              height: viewport.height,
              selection: !readOnly,
              renderOnAddRemove: true,
              skipTargetFind: false
            });
            
            console.log('Fabric canvas created successfully for page:', pageNum);
            
            // Set up event listeners
            fabric.on('selection:created', (e: any) => {
              console.log('Fabric selection created:', e);
              if (e.selected && e.selected[0]) {
                setSelectedAnnotation(e.selected[0].id || null);
              }
            });
            
            fabric.on('selection:cleared', () => {
              console.log('Fabric selection cleared');
              setSelectedAnnotation(null);
            });
            
            fabric.on('object:modified', (e: any) => {
              console.log('Fabric object modified:', e);
              updateAnnotationFromFabric(e.target, pageNum);
            });
            
            // Handle click events for adding annotations
            fabric.on('mouse:down', (e: any) => {
              console.log('Fabric mouse down:', { selectedTool: selectedToolRef.current, hasTarget: !!e.target, pageNum });
              if (selectedToolRef.current !== 'select' && e.target === null) {
                const pointer = fabric.getPointer(e.e);
                console.log('Fabric click detected, calling handleCanvasClick:', pointer);
                handleCanvasClick(pointer.x, pointer.y, pageNum);
              }
            });
          
            // Store page info
            pageRefs.current.set(pageNum, {
              pageNumber: pageNum,
              canvas: pdfCanvas,
              fabricCanvas: fabric,
              viewport: viewport
            });
            
            // Load annotations for this page
            loadPageAnnotations(pageNum);
          } catch (fabricError) {
            console.error('Error initializing Fabric canvas for page', pageNum, ':', fabricError);
            toast({
              title: "Canvas Error",
              description: `Failed to initialize interactive canvas for page ${pageNum}. Some tools may not work.`,
              variant: "destructive",
            });
          }
        } else {
          console.error('Fabric.js not loaded - interactive tools will not work');
          toast({
            title: "Library Missing",
            description: "Interactive drawing tools are not available. Please refresh the page.",
            variant: "destructive",
          });
        }
      }
      
    } catch (error) {
      console.error('Error rendering PDF pages:', error);
    }
  }, [pdfDocument, totalPages, pdfScale, rotation, readOnly]);

  // Track current page based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current) return;
      
      const container = scrollContainerRef.current;
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      
      // Find which page is most visible
      let mostVisiblePage = 1;
      let maxVisibility = 0;
      
      pageRefs.current.forEach((pageInfo, pageNum) => {
        const pageElement = container.querySelector(`[data-page-number="${pageNum}"]`) as HTMLElement;
        if (pageElement) {
          const rect = pageElement.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          const pageTop = rect.top - containerRect.top;
          const pageBottom = rect.bottom - containerRect.top;
          
          const visibleTop = Math.max(0, pageTop);
          const visibleBottom = Math.min(containerHeight, pageBottom);
          const visibleHeight = Math.max(0, visibleBottom - visibleTop);
          
          if (visibleHeight > maxVisibility) {
            maxVisibility = visibleHeight;
            mostVisiblePage = pageNum;
          }
        }
      });
      
      setCurrentViewPage(mostVisiblePage);
    };
    
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Load annotations for a specific page
  const loadPageAnnotations = (pageNumber: number) => {
    console.log(`Loading annotations for page ${pageNumber}`);
    const pageInfo = pageRefs.current.get(pageNumber);
    if (!pageInfo || !pageInfo.fabricCanvas) {
      console.log(`No page info or canvas for page ${pageNumber}`);
      return;
    }
    
    // Get existing object IDs
    const existingIds = new Set(
      pageInfo.fabricCanvas.getObjects().map((obj: any) => obj.id).filter(Boolean)
    );
    
    // Get annotations for this page
    const pageAnnotations = annotations.filter(ann => ann.pageNumber === pageNumber);
    console.log(`Found ${pageAnnotations.length} annotations for page ${pageNumber}`);
    
    // Add only new annotations
    pageAnnotations.forEach(annotation => {
      if (!existingIds.has(annotation.id)) {
        console.log(`Adding new annotation ${annotation.id} to page ${pageNumber}`);
        addAnnotationToCanvas(annotation, pageNumber);
      }
    });
    
    // Remove annotations that no longer exist
    const annotationIds = new Set(pageAnnotations.map(a => a.id));
    pageInfo.fabricCanvas.getObjects().forEach((obj: any) => {
      if (obj.id && !annotationIds.has(obj.id)) {
        console.log(`Removing deleted annotation ${obj.id} from page ${pageNumber}`);
        pageInfo.fabricCanvas.remove(obj);
      }
    });
    
    pageInfo.fabricCanvas.renderAll();
  };

  // Add annotation to Fabric canvas
  const addAnnotationToCanvas = (annotation: Annotation, pageNumber: number): boolean => {
    console.log('Adding annotation to canvas:', { annotation, pageNumber });
    
    const pageInfo = pageRefs.current.get(pageNumber);
    if (!pageInfo || !pageInfo.fabricCanvas) {
      console.error('Page info or fabric canvas not found for page:', pageNumber);
      console.log('Available pages:', Array.from(pageRefs.current.keys()));
      console.log('Page refs:', pageRefs.current);
      return false;
    }

    if (!window.fabric) {
      console.error('Fabric.js not loaded!');
      return false;
    }

    console.log('Page info found, creating fabric object for type:', annotation.type);
    let fabricObject: any = null;

    switch (annotation.type) {
      case 'signature':
      case 'initial':
      case 'stamp':
        if (annotation.isImage && window.fabric) {
          window.fabric.Image.fromURL(annotation.content, (img: any) => {
            img.set({
              id: annotation.id,
              left: annotation.x,
              top: annotation.y,
              scaleX: annotation.width / (img.width || 1),
              scaleY: annotation.height / (img.height || 1),
              selectable: !readOnly,
              hasControls: !readOnly,
              cornerColor: 'blue',
              cornerSize: 10,
              transparentCorners: false,
            });
            // Disable proportional scaling
            img.setControlsVisibility({
                mt: true, // middle top
                mb: true, // middle bottom
                ml: true, // middle left
                mr: true, // middle right
                bl: false, // bottom left
                br: false, // bottom right
                tl: false, // top left
                tr: false, // top right
                mtr: false // rotation
            });
            pageInfo.fabricCanvas?.add(img);
          });
        } else if (window.fabric) {
          // Text-based signature
          fabricObject = new window.fabric.Text(annotation.content, {
            id: annotation.id,
            left: annotation.x,
            top: annotation.y,
            fontSize: annotation.fontSize || 24,
            fontFamily: annotation.fontFamily || 'Dancing Script',
            fill: annotation.color || '#000000',
            selectable: !readOnly,
            hasControls: !readOnly,
            cornerColor: 'blue',
            cornerSize: 10,
            transparentCorners: false,
          });
        }
        break;

      case 'text':
      case 'name':
      case 'title':
      case 'commission-id':
      case 'commission-exp':
        if (window.fabric) {
          console.log(`Creating ${annotation.type} fabric object with content:`, annotation.content);
          try {
            fabricObject = new window.fabric.Text(annotation.content || '', {
              left: annotation.x,
              top: annotation.y,
              width: annotation.width,
              fontSize: annotation.fontSize || 16,
              fontFamily: annotation.fontFamily || 'Arial',
              fill: annotation.color || '#000000',
              selectable: !readOnly,
              hasControls: !readOnly,
              id: annotation.id,
              cornerColor: 'blue',
              cornerSize: 10,
              transparentCorners: false,
            });
            console.log(`${annotation.type} fabric object created:`, fabricObject);
          } catch (error) {
            console.error(`Error creating ${annotation.type} fabric object:`, error);
          }
        }
        break;

      case 'disclosure':
        if (window.fabric) {
          // Create a text box for multi-line disclosure
          fabricObject = new window.fabric.Textbox(annotation.content, {
            id: annotation.id,
            left: annotation.x,
            top: annotation.y,
            width: annotation.width,
            fontSize: annotation.fontSize || 12,
            fontFamily: annotation.fontFamily || 'Arial',
            fill: annotation.color || '#000000',
            selectable: !readOnly,
            hasControls: !readOnly,
            breakWords: true,
            splitByGrapheme: true,
            cornerColor: 'blue',
            cornerSize: 10,
            transparentCorners: false,
          });
        }
        break;

      case 'date':
        if (window.fabric) {
          console.log('Creating date fabric object with content:', annotation.content);
          fabricObject = new window.fabric.Text(annotation.content || new Date().toLocaleDateString(), {
            id: annotation.id,
            left: annotation.x,
            top: annotation.y,
            width: annotation.width,
            height: annotation.height,
            fontSize: 14,
            fontFamily: 'Arial',
            fill: '#000000',
            selectable: !readOnly,
            hasControls: !readOnly,
            cornerColor: 'blue',
            cornerSize: 10,
            transparentCorners: false,
          });
          console.log('Date fabric object created:', fabricObject);
        } else {
          console.error('window.fabric not available for date annotation');
        }
        break;

      case 'checkbox':
        if (window.fabric) {
          const rect = new window.fabric.Rect({
            left: 0,
            top: 0,
            width: 20,
            height: 20,
            fill: 'transparent',
            stroke: '#000000',
            strokeWidth: 2,
          });
          
          const check = new window.fabric.Text('✓', {
            left: 2,
            top: -2,
            fontSize: 18,
            fill: '#000000',
          });
          
          fabricObject = new window.fabric.Group([rect, check], {
            id: annotation.id,
            left: annotation.x,
            top: annotation.y,
            selectable: !readOnly,
            hasControls: !readOnly,
            cornerColor: 'blue',
            cornerSize: 10,
            transparentCorners: false,
          });
        }
        break;

      case 'white-out':
        if (window.fabric) {
          fabricObject = new window.fabric.Rect({
            id: annotation.id,
            left: annotation.x,
            top: annotation.y,
            width: annotation.width,
            height: annotation.height,
            fill: '#ffffff',
            opacity: annotation.opacity || 1,
            selectable: !readOnly,
            hasControls: !readOnly,
            cornerColor: 'blue',
            cornerSize: 10,
            transparentCorners: false,
          });
        }
        break;
    }

    if (fabricObject) {
      console.log('Adding fabric object to canvas:', fabricObject);
      try {
        // Set custom ID property after creation
        fabricObject.set('id', annotation.id);
        
        // Disable proportional scaling by removing corner controls
        fabricObject.setControlsVisibility({
            mt: true, // middle top
            mb: true, // middle bottom
            ml: true, // middle left
            mr: true, // middle right
            bl: false, // bottom left
            br: false, // bottom right
            tl: false, // top left
            tr: false, // top right
            mtr: false // rotation
        });
        
        pageInfo.fabricCanvas.add(fabricObject);
        pageInfo.fabricCanvas.renderAll();
        console.log('Fabric object added and canvas rendered successfully');
        console.log('Canvas objects count:', pageInfo.fabricCanvas.getObjects().length);
        console.log('Canvas dimensions:', {
          width: pageInfo.fabricCanvas.width,
          height: pageInfo.fabricCanvas.height
        });
        return true;
      } catch (error) {
        console.error('Error adding fabric object to canvas:', error);
        return false;
      }
    } else {
      console.warn('No fabric object created for annotation type:', annotation.type);
      return false;
    }
  };

  // Update annotation from Fabric object
  const updateAnnotationFromFabric = (fabricObject: any, pageNumber: number) => {
    if (!fabricObject.id) return;
    
    setAnnotations(prev => prev.map(ann => {
      if (ann.id === fabricObject.id) {
        return {
          ...ann,
          x: fabricObject.left || ann.x,
          y: fabricObject.top || ann.y,
          width: (fabricObject.width || 0) * (fabricObject.scaleX || 1),
          height: (fabricObject.height || 0) * (fabricObject.scaleY || 1),
        };
      }
      return ann;
    }));
  };

  // Handle drop event for drag and drop tools
  const handleDrop = (e: React.DragEvent, pageNumber: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Remove visual feedback
    const target = e.currentTarget as HTMLElement;
    target.style.outline = 'none';
    
    const toolType = e.dataTransfer.getData('tool-type');
    console.log('Tool dropped:', { toolType, pageNumber });
    
    if (!toolType || readOnly) {
      console.log('Ignoring drop - no tool type or read-only mode');
      return;
    }

    // Get the drop position relative to the page
    const pageElement = e.currentTarget as HTMLElement;
    const rect = pageElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    console.log(`Processing dropped ${toolType} tool at position (${x}, ${y}) on page ${pageNumber}`);
    
    // Process the dropped tool
    handleToolAction(toolType, x, y, pageNumber);
  };

  // Handle drag over event to allow dropping
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    
    // Add visual feedback
    const target = e.currentTarget as HTMLElement;
    target.style.outline = '2px dashed #3B82F6';
    target.style.outlineOffset = '-2px';
  };
  
  // Handle drag leave event
  const handleDragLeave = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.outline = 'none';
  };

  // Process tool action (shared between click and drag-drop)
  const handleToolAction = (toolType: string, x: number, y: number, pageNumber: number) => {
    try {
      // Set the selected tool first
      setSelectedTool(toolType as any);
      
      switch (toolType) {
        case 'signature':
          console.log('Signature tool action triggered');
          // Check if user has saved signatures from dashboard
          const savedSignature = userSignatures.find(sig => sig.type === 'signature' && sig.isActive);
          if (savedSignature) {
            console.log('Using saved signature from dashboard:', savedSignature);
            // Use the saved signature directly
            const annotation: Annotation = {
              id: `ann_${Date.now()}`,
              type: 'signature',
              x,
              y,
              width: 150,
              height: 60,
              content: savedSignature.content || '',
              pageNumber,
              timestamp: new Date().toISOString(),
              isImage: savedSignature.type === 'drawn' || (savedSignature.content && savedSignature.content.startsWith('data:')),
              color: signatureColor,
              fontFamily: savedSignature.fontFamily || signatureFont,
              fontSize: 24,
            };
            addAnnotation(annotation);
            
            toast({
              title: "Dashboard Signature Added",
              description: "Used your saved signature from dashboard",
            });
          } else {
            console.log('No saved signature found, opening signature modal');
            setShowSignatureModal(true);
            window.pendingPosition = { x, y, pageNumber };
          }
          break;
        case 'initial':
          console.log('Initial tool action triggered');
          // Check if user has saved initials from dashboard
          const savedInitial = userSignatures.find(sig => sig.type === 'initial');
          if (savedInitial) {
            console.log('Using saved initial from dashboard:', savedInitial);
            // Use the saved initial directly
            const annotation: Annotation = {
              id: `ann_${Date.now()}`,
              type: 'initial',
              x,
              y,
              width: 80,
              height: 40,
              content: savedInitial.content || '',
              pageNumber,
              timestamp: new Date().toISOString(),
              isImage: savedInitial.type === 'drawn' || (savedInitial.content && savedInitial.content.startsWith('data:')),
              color: signatureColor,
              fontFamily: savedInitial.fontFamily || signatureFont,
              fontSize: 20,
            };
            addAnnotation(annotation);
            
            toast({
              title: "Dashboard Initial Added",
              description: "Used your saved initials from dashboard",
            });
          } else {
            console.log('No saved initial found, opening signature modal');
            setShowSignatureModal(true);
            window.pendingPosition = { x, y, pageNumber };
          }
          break;
        case 'text':
          console.log('Adding text annotation from drop');
          addTextAnnotation(x, y, pageNumber);
          break;
        case 'stamp':
          console.log('Opening stamp modal from drop');
          setShowStampModal(true);
          window.pendingPosition = { x, y, pageNumber };
          break;
        case 'date':
          console.log('Adding date annotation from drop');
          addDateAnnotation(x, y, pageNumber);
          break;
        case 'checkbox':
          console.log('Adding checkbox annotation from drop');
          addCheckboxAnnotation(x, y, pageNumber);
          break;
        case 'name':
          console.log('Adding name field annotation from drop');
          addNotaryFieldAnnotation('name', notaryProfile.name || 'Notary Name', x, y, pageNumber);
          break;
        case 'title':
          console.log('Adding title field annotation from drop');
          addNotaryFieldAnnotation('title', notaryProfile.title || 'Notary Public', x, y, pageNumber);
          break;
        case 'commission-id':
          console.log('Adding commission ID annotation from drop');
          addNotaryFieldAnnotation('commission-id', notaryProfile.commissionId || '[Commission ID]', x, y, pageNumber);
          break;
        case 'commission-exp':
          console.log('Adding commission exp annotation from drop');
          addNotaryFieldAnnotation('commission-exp', notaryProfile.commissionExp || '[Expiration Date]', x, y, pageNumber);
          break;
        case 'disclosure':
          console.log('Adding disclosure annotation from drop');
          addDisclosureAnnotation(x, y, pageNumber);
          break;
        case 'white-out':
          console.log('Adding white-out annotation from drop');
          addWhiteOutAnnotation(x, y, pageNumber);
          break;
        default:
          console.warn('Unknown tool type:', toolType);
      }
    } catch (error) {
      console.error('Error handling tool action:', error);
      toast({
        title: "Error",
        description: "Failed to apply tool. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle canvas click
  const handleCanvasClick = (x: number, y: number, pageNumber: number) => {
    console.log('Canvas clicked:', { x, y, pageNumber, selectedTool: selectedToolRef.current, readOnly });
    
    if (selectedToolRef.current === 'select' || readOnly) {
      console.log('Ignoring click - select tool or read-only mode');
      return;
    }

    console.log(`Processing ${selectedToolRef.current} tool at position (${x}, ${y}) on page ${pageNumber}`);

    // Use the shared handler for click actions
    handleToolAction(selectedToolRef.current, x, y, pageNumber);
  };



  // Add text annotation
  const addTextAnnotation = (x: number, y: number, pageNumber: number) => {
    const text = prompt('Enter text:');
    if (!text) return;

    const annotation: Annotation = {
      id: `ann_${Date.now()}`,
      type: 'text',
      x,
      y,
      width: 200,
      height: 30,
      content: text,
      pageNumber,
      timestamp: new Date().toISOString(),
      color: textColor,
      fontSize: textSize,
      fontFamily: textFont,
    };

    addAnnotation(annotation);
  };

  // Add date annotation
  const addDateAnnotation = (x: number, y: number, pageNumber: number) => {
    const annotation: Annotation = {
      id: `ann_${Date.now()}`,
      type: 'date',
      x,
      y,
      width: 150,
      height: 20,
      content: new Date().toLocaleDateString(),
      pageNumber,
      timestamp: new Date().toISOString(),
    };

    addAnnotation(annotation);
  };

  // Add checkbox annotation
  const addCheckboxAnnotation = (x: number, y: number, pageNumber: number) => {
    const annotation: Annotation = {
      id: `ann_${Date.now()}`,
      type: 'checkbox',
      x,
      y,
      width: 20,
      height: 20,
      content: '✓',
      pageNumber,
      timestamp: new Date().toISOString(),
    };
    addAnnotation(annotation);
  };

  // Add notary field annotation
  const addNotaryFieldAnnotation = (type: string, content: string, x: number, y: number, pageNumber: number) => {
    const annotation: Annotation = {
      id: `ann_${Date.now()}`,
      type: type as any,
      x,
      y,
      width: 200,
      height: 30,
      content: content || `[${type.replace('-', ' ').toUpperCase()}]`,
      pageNumber,
      timestamp: new Date().toISOString(),
      color: '#000000',
      fontSize: 14,
      fontFamily: 'Arial',
    };
    addAnnotation(annotation);
  };

  // Add disclosure annotation
  const addDisclosureAnnotation = (x: number, y: number, pageNumber: number) => {
    const annotation: Annotation = {
      id: `ann_${Date.now()}`,
      type: 'disclosure',
      x,
      y,
      width: 400,
      height: 60,
      content: notaryProfile.disclosure,
      pageNumber,
      timestamp: new Date().toISOString(),
      color: '#000000',
      fontSize: 12,
      fontFamily: 'Arial',
    };
    addAnnotation(annotation);
  };

  // Add white out annotation
  const addWhiteOutAnnotation = (x: number, y: number, pageNumber: number) => {
    const annotation: Annotation = {
      id: `ann_${Date.now()}`,
      type: 'white-out',
      x,
      y,
      width: 100,
      height: 30,
      content: '',
      pageNumber,
      timestamp: new Date().toISOString(),
      color: '#ffffff',
      opacity: 1,
    };
    addAnnotation(annotation);
  };

  // Add annotation and update history
  const addAnnotation = (annotation: Annotation) => {
    console.log('Adding annotation:', annotation);
    
    // Add to state - the useEffect will handle canvas rendering
    setAnnotations(prev => {
      const newAnnotations = [...prev, annotation];
      console.log('Updated annotations list:', newAnnotations);
      return newAnnotations;
    });
    
    // Update history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...annotations, annotation]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    // Show success toast
    toast({
      title: "Tool Applied",
      description: `${annotation.type.charAt(0).toUpperCase() + annotation.type.slice(1)} added to page ${annotation.pageNumber}`,
    });
    
    // Notify parent
    if (onSignatureAdd) {
      console.log('Notifying parent of new annotation');
      onSignatureAdd(annotation);
    }
    
    // Reset tool to select mode for easier editing
    setSelectedTool('select');
  };

  // Save signature from modal
  const saveSignature = () => {
    if (!window.pendingPosition) return;
    
    const { x, y, pageNumber } = window.pendingPosition;
    let content = '';
    let isImage = false;
    
    if (signatureType === 'draw' && signaturePadRef.current) {
      if (signaturePadRef.current.isEmpty()) {
        toast({
          title: "Error",
          description: "Please draw your signature",
          variant: "destructive",
        });
        return;
      }
      content = signaturePadRef.current.toDataURL();
      isImage = true;
    } else if (signatureType === 'type') {
      content = typedSignature;
      if (!content) {
        toast({
          title: "Error",
          description: "Please type your signature",
          variant: "destructive",
        });
        return;
      }
    } else if (signatureType === 'upload' && customStampImage) {
      content = customStampImage;
      isImage = true;
    }
    
    const annotation: Annotation = {
      id: `ann_${Date.now()}`,
      type: selectedTool as 'signature' | 'initial',
      x,
      y,
      width: selectedTool === 'initial' ? 80 : 150,
      height: selectedTool === 'initial' ? 40 : 60,
      content,
      pageNumber,
      timestamp: new Date().toISOString(),
      isImage,
      color: signatureColor,
      fontFamily: signatureFont,
      fontSize: selectedTool === 'initial' ? 20 : 24,
    };
    
    addAnnotation(annotation);
    setShowSignatureModal(false);
    window.pendingPosition = undefined;
    
    // Clear signature pad
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
  };

  // Save stamp from modal
  const saveStamp = () => {
    if (!window.pendingPosition) return;
    
    const { x, y, pageNumber } = window.pendingPosition;
    let stampContent = '';
    let isImage = false;
    
    if (stampType === 'notary') {
      // Generate notary stamp text
      stampContent = `NOTARY PUBLIC\n${notaryInfo.name}\n${notaryInfo.state}\nComm. #${notaryInfo.commission}\nExp: ${notaryInfo.expiration}`;
    } else if (stampType === 'custom' && customStampImage) {
      stampContent = customStampImage;
      isImage = true;
    }
    
    if (!stampContent) {
      toast({
        title: "Error",
        description: "Please complete stamp information",
        variant: "destructive",
      });
      return;
    }
    
    const annotation: Annotation = {
      id: `ann_${Date.now()}`,
      type: 'stamp',
      x,
      y,
      width: 120,
      height: 80,
      content: stampContent,
      pageNumber,
      timestamp: new Date().toISOString(),
      isImage,
    };
    
    addAnnotation(annotation);
    setShowStampModal(false);
    window.pendingPosition = undefined;
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setCustomStampImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Delete selected annotation
  const deleteSelectedAnnotation = () => {
    if (!selectedAnnotation) return;
    
    // Remove from all pages
    pageRefs.current.forEach((pageInfo) => {
      if (pageInfo.fabricCanvas) {
        const objects = pageInfo.fabricCanvas.getObjects();
        const objectToRemove = objects.find((obj: any) => obj.id === selectedAnnotation);
        if (objectToRemove) {
          pageInfo.fabricCanvas.remove(objectToRemove);
        }
      }
    });
    
    setAnnotations(prev => prev.filter(ann => ann.id !== selectedAnnotation));
    setSelectedAnnotation(null);
  };

  // Undo/Redo
  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setAnnotations(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setAnnotations(history[historyIndex + 1]);
    }
  };



  // Update fabric object when properties change
  useEffect(() => {
    if (!selectedAnnotation) return;
    
    const annotation = annotations.find(a => a.id === selectedAnnotation);
    if (!annotation) return;
    
    pageRefs.current.forEach((pageInfo) => {
      if (pageInfo.fabricCanvas) {
        const objects = pageInfo.fabricCanvas.getObjects();
        const fabricObject = objects.find((obj: any) => obj.id === selectedAnnotation);
        
        if (fabricObject) {
          // Update fabric object properties
          if (annotation.type !== 'white-out' && annotation.type !== 'checkbox') {
            fabricObject.set({
              text: annotation.content,
              fontSize: annotation.fontSize,
              fill: annotation.color,
            });
          }
          
          if (annotation.type === 'white-out') {
            fabricObject.set({
              opacity: annotation.opacity,
            });
          }
          
          fabricObject.set({
            width: annotation.width,
            height: annotation.height,
          });
          
          pageInfo.fabricCanvas.renderAll();
        }
      }
    });
  }, [annotations, selectedAnnotation]);

  // Save modified PDF
  const saveModifiedPDF = async () => {
    if (!originalPdfBytes || annotations.length === 0) return;
    
    setIsSaving(true);
    
    try {
      // Load the original PDF
      const pdfDoc = await PDFDocument.load(originalPdfBytes);
      const pages = pdfDoc.getPages();
      
      // Apply annotations to each page
      for (let pageNum = 1; pageNum <= pages.length; pageNum++) {
        const page = pages[pageNum - 1];
        const pageAnnotations = annotations.filter(ann => ann.pageNumber === pageNum);
        
        for (const annotation of pageAnnotations) {
          const { width: pageWidth, height: pageHeight } = page.getSize();
          
          switch (annotation.type) {
            case 'signature':
            case 'initial':
            case 'stamp':
              if (annotation.isImage && annotation.content.startsWith('data:image/')) {
                try {
                  const imageData = annotation.content.split(',')[1];
                  const imageBytes = Buffer.from(imageData, 'base64');
                  let image;
                  
                  if (annotation.content.includes('image/png')) {
                    image = await pdfDoc.embedPng(imageBytes);
                  } else {
                    image = await pdfDoc.embedJpg(imageBytes);
                  }
                  
                  page.drawImage(image, {
                    x: annotation.x,
                    y: pageHeight - annotation.y - annotation.height,
                    width: annotation.width,
                    height: annotation.height,
                  });
                } catch (error) {
                  console.error('Error embedding image:', error);
                  // Fallback to text
                  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                  page.drawText(annotation.content.substring(0, 50), {
                    x: annotation.x,
                    y: pageHeight - annotation.y - annotation.height,
                    size: 12,
                    font,
                    color: rgb(0, 0, 0),
                  });
                }
              } else {
                // Text-based signature/stamp
                const font = annotation.fontFamily?.includes('Script') 
                  ? await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
                  : await pdfDoc.embedFont(StandardFonts.Helvetica);
                
                const lines = annotation.content.split('\n');
                lines.forEach((line, index) => {
                  page.drawText(line, {
                    x: annotation.x,
                    y: pageHeight - annotation.y - (index + 1) * (annotation.fontSize || 16),
                    size: annotation.fontSize || 16,
                    font,
                    color: rgb(0, 0, 0),
                  });
                });
              }
              break;
              
            case 'text':
            case 'date':
            case 'name':
            case 'title':
            case 'commission-id':
            case 'commission-exp':
              const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
              page.drawText(annotation.content, {
                x: annotation.x,
                y: pageHeight - annotation.y - annotation.height,
                size: annotation.fontSize || 16,
                font,
                color: rgb(0, 0, 0),
              });
              break;
              
            case 'disclosure':
              const disclosureFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
              const disclosureLines = annotation.content.split('\n');
              const lineHeight = annotation.fontSize || 12;
              disclosureLines.forEach((line, index) => {
                page.drawText(line, {
                  x: annotation.x,
                  y: pageHeight - annotation.y - (index + 1) * lineHeight,
                  size: lineHeight,
                  font: disclosureFont,
                  color: rgb(0, 0, 0),
                });
              });
              break;
              
            case 'checkbox':
              // Draw checkbox rectangle
              page.drawRectangle({
                x: annotation.x,
                y: pageHeight - annotation.y - annotation.height,
                width: 20,
                height: 20,
                borderColor: rgb(0, 0, 0),
                borderWidth: 2,
              });
              // Draw checkmark
              const checkFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
              page.drawText('✓', {
                x: annotation.x + 2,
                y: pageHeight - annotation.y - annotation.height + 2,
                size: 16,
                font: checkFont,
                color: rgb(0, 0, 0),
              });
              break;
              
            case 'white-out':
              // Draw white rectangle
              page.drawRectangle({
                x: annotation.x,
                y: pageHeight - annotation.y - annotation.height,
                width: annotation.width,
                height: annotation.height,
                color: rgb(1, 1, 1),
                opacity: annotation.opacity || 1,
              });
              break;
          }
        }
      }
      
      // Save the PDF
      const modifiedPdfBytes = await pdfDoc.save();
      
      // Upload the signed document
      const token = localStorage.getItem('token');
      if (token) {
        const formData = new FormData();
        const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
        formData.append('signedPdf', blob, `signed_${currentDocument?.filename || 'document.pdf'}`);
        
        const response = await fetch(`/api/jobs/${jobId}/documents/${currentDocument?.id}/signed`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Failed to upload signed document');
        }
      }
      
      if (onDocumentSave) {
        onDocumentSave(modifiedPdfBytes);
      }
      
      // Download the PDF
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signed_${currentDocument?.filename || 'document.pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "PDF saved successfully with all annotations",
      });
      
    } catch (error) {
      console.error('Error saving PDF:', error);
      toast({
        title: "Error",
        description: "Failed to save PDF",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Scroll to page function
  const scrollToPage = (pageNumber: number) => {
    if (!scrollContainerRef.current) return;
    
    const pageElement = scrollContainerRef.current.querySelector(`[data-page-number="${pageNumber}"]`) as HTMLElement;
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Zoom controls
  const zoomIn = () => {
    setPdfScale(prev => Math.min(prev + 0.25, 3));
  };
  
  const zoomOut = () => {
    setPdfScale(prev => Math.max(prev - 0.25, 0.5));
  };
  
  const fitToPage = () => setPdfScale(1);

  // Render all pages when dependencies change
  useEffect(() => {
    renderAllPages();
  }, [renderAllPages]);
  
  // Re-render annotations when they change
  useEffect(() => {
    if (pageRefs.current.size > 0) {
      console.log('Annotations changed, re-rendering on all pages. Total annotations:', annotations.length);
      // Re-render annotations on all pages
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const pageInfo = pageRefs.current.get(pageNum);
        if (pageInfo && pageInfo.fabricCanvas) {
          loadPageAnnotations(pageNum);
        }
      }
    }
  }, [annotations, totalPages]);

  // Set default signature type based on available dashboard signatures
  useEffect(() => {
    if (showSignatureModal) {
      const targetType = selectedTool === 'initial' ? 'initial' : 'signature';
      const availableSigs = userSignatures.filter(sig => sig.type === targetType);
      
      if (availableSigs.length > 0) {
        setSignatureType('dashboard');
      } else {
        setSignatureType('draw');
      }
    }
  }, [showSignatureModal, selectedTool, userSignatures]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4">Loading PDF...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full flex ${isDragging ? 'cursor-copy' : ''}`}>
      {/* PDF Viewer - takes most of the space */}
      <div className="flex-1 relative bg-gray-50 overflow-hidden">
        {/* Simple top bar with just zoom controls */}
        <div className="absolute top-0 left-0 right-0 bg-white border-b shadow-sm p-2 flex items-center gap-2 z-10">
          <Button variant="outline" size="sm" onClick={zoomOut} title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-2">{Math.round(pdfScale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={zoomIn} title="Zoom In">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={fitToPage} title="Fit to Page">
            <Maximize2 className="h-4 w-4" />
          </Button>
          
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Test annotation
                const testAnnotation: Annotation = {
                  id: `test_${Date.now()}`,
                  type: 'date',
                  x: 100,
                  y: 100,
                  width: 150,
                  height: 20,
                  content: new Date().toLocaleDateString(),
                  pageNumber: 1,
                  timestamp: new Date().toISOString(),
                };
                console.log('Adding test annotation:', testAnnotation);
                addAnnotation(testAnnotation);
              }}
              title="Add test date annotation to page 1"
            >
              Test
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={saveModifiedPDF}
              disabled={isSaving || annotations.length === 0}
            >
              <Save className="h-4 w-4 mr-1" />
              Save PDF
            </Button>
          </div>
        </div>
        
        {/* PDF Container */}
        <div 
          ref={scrollContainerRef}
          className="w-full h-full overflow-auto pt-12"
        >
          {/* PDF pages will be dynamically added here */}
        </div>
      </div>

      {/* Right Sidebar with Tools */}
      <div className="w-80 bg-white border-l shadow-lg flex flex-col">
        {/* Tools Header */}
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Notary Tools</h3>
          <p className="text-xs text-gray-500 mt-1">Drag & drop or click to select</p>
        </div>
        
        {/* Tools Section */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Selection Tool */}
            <div>
              <label className="text-sm font-medium mb-2 block">Navigation</label>
              <Button
                variant={selectedTool === 'select' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTool('select')}
                className="w-full justify-start"
              >
                <MousePointer className="h-4 w-4 mr-2" />
                Select Tool
              </Button>
            </div>

            {/* Signature Tools */}
            <div>
              <label className="text-sm font-medium mb-2 block">Signatures</label>
              <div className="space-y-2">
                <div
                  draggable
                  onDragStart={(e) => {
                    console.log('Dragging signature tool');
                    e.dataTransfer.setData('tool-type', 'signature');
                    e.dataTransfer.effectAllowed = 'copy';
                    setIsDragging(true);
                  }}
                  onDragEnd={() => setIsDragging(false)}
                  onClick={() => setSelectedTool('signature')}
                  className={`p-2 border rounded cursor-move transition-all duration-200 flex items-center justify-between text-sm ${
                    selectedTool === 'signature' 
                      ? 'border-blue-500 bg-blue-50 shadow-sm' 
                      : 'border-green-300 bg-green-50 hover:bg-green-100 hover:shadow-md hover:scale-105'
                  }`}
                  title="Drag to place or click to select"
                >
                  <span className="flex items-center">
                    <Pen className="h-4 w-4 mr-2" />
                    Signature
                  </span>
                  <span className="text-xs text-gray-500">(S)</span>
                </div>
                <div
                  draggable
                  onDragStart={(e) => {
                    console.log('Dragging initial tool');
                    e.dataTransfer.setData('tool-type', 'initial');
                    e.dataTransfer.effectAllowed = 'copy';
                    setIsDragging(true);
                  }}
                  onDragEnd={() => setIsDragging(false)}
                  onClick={() => setSelectedTool('initial')}
                  className={`p-2 border rounded cursor-move hover:bg-gray-100 flex items-center justify-between text-sm ${
                    selectedTool === 'initial' ? 'border-blue-500 bg-blue-50' : 'border-green-300 bg-green-50'
                  }`}
                >
                  <span className="flex items-center">
                    <FileCheck className="h-4 w-4 mr-2" />
                    Initial
                  </span>
                  <span className="text-xs text-gray-500">(I)</span>
                </div>
                <div
                  draggable
                  onDragStart={(e) => {
                    console.log('Dragging stamp tool');
                    e.dataTransfer.setData('tool-type', 'stamp');
                    e.dataTransfer.effectAllowed = 'copy';
                    setIsDragging(true);
                  }}
                  onDragEnd={() => setIsDragging(false)}
                  onClick={() => setSelectedTool('stamp')}
                  className={`p-2 border rounded cursor-move hover:bg-gray-100 flex items-center justify-between text-sm ${
                    selectedTool === 'stamp' ? 'border-blue-500 bg-blue-50' : 'border-blue-300 bg-blue-50'
                  }`}
                >
                  <span className="flex items-center">
                    <Stamp className="h-4 w-4 mr-2" />
                    Notary Stamp
                  </span>
                  <span className="text-xs text-gray-500">(N)</span>
                </div>
              </div>
            </div>

            {/* Notary Information */}
            <div>
              <label className="text-sm font-medium mb-2 block">Notary Information</label>
              <div className="space-y-2">
                <div
                  draggable
                  onDragStart={(e) => {
                    console.log('Dragging name tool');
                    e.dataTransfer.setData('tool-type', 'name');
                    e.dataTransfer.effectAllowed = 'copy';
                    setIsDragging(true);
                  }}
                  onDragEnd={() => setIsDragging(false)}
                  onClick={() => setSelectedTool('name')}
                  className={`p-2 border rounded cursor-move hover:bg-gray-100 flex items-center justify-between text-sm ${
                    selectedTool === 'name' ? 'border-blue-500 bg-blue-50' : 'border-green-300 bg-green-50'
                  }`}
                >
                  <span className="flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    Name
                  </span>
                  <span className="text-xs text-gray-500">(A)</span>
                </div>
                <div
                  draggable
                  onDragStart={(e) => {
                    console.log('Dragging title tool');
                    e.dataTransfer.setData('tool-type', 'title');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => setSelectedTool('title')}
                  className={`p-2 border rounded cursor-move hover:bg-gray-100 flex items-center justify-between text-sm ${
                    selectedTool === 'title' ? 'border-blue-500 bg-blue-50' : 'border-green-300 bg-green-50'
                  }`}
                >
                  <span className="flex items-center">
                    <Shield className="h-4 w-4 mr-2" />
                    Title
                  </span>
                  <span className="text-xs text-gray-500">(L)</span>
                </div>
                <div
                  draggable
                  onDragStart={(e) => {
                    console.log('Dragging commission-id tool');
                    e.dataTransfer.setData('tool-type', 'commission-id');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => setSelectedTool('commission-id')}
                  className={`p-2 border rounded cursor-move hover:bg-gray-100 flex items-center justify-between text-sm ${
                    selectedTool === 'commission-id' ? 'border-blue-500 bg-blue-50' : 'border-green-300 bg-green-50'
                  }`}
                >
                  <span className="flex items-center">
                    <Hash className="h-4 w-4 mr-2" />
                    Commission ID
                  </span>
                  <span className="text-xs text-gray-500">(C)</span>
                </div>
                <div
                  draggable
                  onDragStart={(e) => {
                    console.log('Dragging commission-exp tool');
                    e.dataTransfer.setData('tool-type', 'commission-exp');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => setSelectedTool('commission-exp')}
                  className={`p-2 border rounded cursor-move hover:bg-gray-100 flex items-center justify-between text-sm ${
                    selectedTool === 'commission-exp' ? 'border-blue-500 bg-blue-50' : 'border-green-300 bg-green-50'
                  }`}
                >
                  <span className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Commission Exp
                  </span>
                  <span className="text-xs text-gray-500">(X)</span>
                </div>
                <div
                  draggable
                  onDragStart={(e) => {
                    console.log('Dragging disclosure tool');
                    e.dataTransfer.setData('tool-type', 'disclosure');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => setSelectedTool('disclosure')}
                  className={`p-2 border rounded cursor-move hover:bg-gray-100 flex items-center justify-between text-sm ${
                    selectedTool === 'disclosure' ? 'border-blue-500 bg-blue-50' : 'border-green-300 bg-green-50'
                  }`}
                >
                  <span className="flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    Disclosure
                  </span>
                  <span className="text-xs text-gray-500">(O)</span>
                </div>
              </div>
            </div>

            {/* Other Tools */}
            <div>
              <label className="text-sm font-medium mb-2 block">Other Tools</label>
              <div className="space-y-2">
                <div
                  draggable
                  onDragStart={(e) => {
                    console.log('Dragging text tool');
                    e.dataTransfer.setData('tool-type', 'text');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => {
                    console.log('Text tool selected');
                    setSelectedTool('text');
                  }}
                  className={`p-2 border rounded cursor-move hover:bg-gray-100 flex items-center justify-between text-sm ${
                    selectedTool === 'text' ? 'border-blue-500 bg-blue-50' : 'border-green-300 bg-green-50'
                  }`}
                >
                  <span className="flex items-center">
                    <Type className="h-4 w-4 mr-2" />
                    Text
                  </span>
                  <span className="text-xs text-gray-500">(T)</span>
                </div>
                <div
                  draggable
                  onDragStart={(e) => {
                    console.log('Dragging date tool');
                    e.dataTransfer.setData('tool-type', 'date');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => {
                    console.log('Date tool selected');
                    setSelectedTool('date');
                  }}
                  className={`p-2 border rounded cursor-move hover:bg-gray-100 flex items-center justify-between text-sm ${
                    selectedTool === 'date' ? 'border-blue-500 bg-blue-50' : 'border-green-300 bg-green-50'
                  }`}
                >
                  <span className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Date
                  </span>
                  <span className="text-xs text-gray-500">(D)</span>
                </div>
                <div
                  draggable
                  onDragStart={(e) => {
                    console.log('Dragging checkbox tool');
                    e.dataTransfer.setData('tool-type', 'checkbox');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => setSelectedTool('checkbox')}
                  className={`p-2 border rounded cursor-move hover:bg-gray-100 flex items-center justify-between text-sm ${
                    selectedTool === 'checkbox' ? 'border-blue-500 bg-blue-50' : 'border-green-300 bg-green-50'
                  }`}
                >
                  <span className="flex items-center">
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Checkbox
                  </span>
                  <span className="text-xs text-gray-500">(K)</span>
                </div>
                <div
                  draggable
                  onDragStart={(e) => {
                    console.log('Dragging white-out tool');
                    e.dataTransfer.setData('tool-type', 'white-out');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => setSelectedTool('white-out')}
                  className={`p-2 border rounded cursor-move hover:bg-gray-100 flex items-center justify-between text-sm ${
                    selectedTool === 'white-out' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  <span className="flex items-center">
                    <Eraser className="h-4 w-4 mr-2" />
                    White Out
                  </span>
                  <span className="text-xs text-gray-500">(W)</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div>
              <label className="text-sm font-medium mb-2 block">Actions</label>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={undo}
                  disabled={historyIndex === 0}
                  className="w-full justify-start"
                >
                  <Undo className="h-4 w-4 mr-2" />
                  Undo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={redo}
                  disabled={historyIndex === history.length - 1}
                  className="w-full justify-start"
                >
                  <Redo className="h-4 w-4 mr-2" />
                  Redo
                </Button>
                {selectedAnnotation && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deleteSelectedAnnotation}
                    className="w-full justify-start text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Properties Section - Shows when annotation is selected */}
        {selectedAnnotation && (
          <div className="border-t p-4 bg-gray-50">
            <h4 className="font-medium mb-3">Properties</h4>
            {(() => {
              const annotation = annotations.find(a => a.id === selectedAnnotation);
              if (!annotation) return null;

              return (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <p className="text-sm text-gray-600 capitalize">{annotation.type.replace('-', ' ')}</p>
                  </div>

                  {annotation.type !== 'white-out' && annotation.type !== 'checkbox' && (
                    <div>
                      <Label className="text-xs">Content</Label>
                      {annotation.type === 'disclosure' ? (
                        <Textarea
                          value={annotation.content}
                          onChange={(e) => {
                            setAnnotations(prev => prev.map(a => 
                              a.id === selectedAnnotation 
                                ? { ...a, content: e.target.value }
                                : a
                            ));
                          }}
                          className="mt-1 text-sm"
                          rows={3}
                        />
                      ) : (
                        <Input
                          value={annotation.content}
                          onChange={(e) => {
                            setAnnotations(prev => prev.map(a => 
                              a.id === selectedAnnotation 
                                ? { ...a, content: e.target.value }
                                : a
                            ));
                          }}
                          className="mt-1 text-sm"
                        />
                      )}
                    </div>
                  )}

                  {annotation.type !== 'white-out' && annotation.type !== 'checkbox' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Font Size</Label>
                        <Input
                          type="number"
                          value={annotation.fontSize || 16}
                          onChange={(e) => {
                            setAnnotations(prev => prev.map(a => 
                              a.id === selectedAnnotation 
                                ? { ...a, fontSize: parseInt(e.target.value) }
                                : a
                            ));
                          }}
                          className="mt-1 text-sm"
                          min={8}
                          max={72}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Color</Label>
                        <Input
                          type="color"
                          value={annotation.color || '#000000'}
                          onChange={(e) => {
                            setAnnotations(prev => prev.map(a => 
                              a.id === selectedAnnotation 
                                ? { ...a, color: e.target.value }
                                : a
                            ));
                          }}
                          className="mt-1 h-9"
                        />
                      </div>
                    </div>
                  )}

                  {annotation.type === 'white-out' && (
                    <div>
                      <Label className="text-xs">Opacity</Label>
                      <Slider
                        value={[annotation.opacity || 1]}
                        onValueChange={([v]) => {
                          setAnnotations(prev => prev.map(a => 
                            a.id === selectedAnnotation 
                              ? { ...a, opacity: v }
                              : a
                          ));
                        }}
                        min={0.5}
                        max={1}
                        step={0.1}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Signature Modal */}
      <Dialog open={showSignatureModal} onOpenChange={setShowSignatureModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Add {selectedTool === 'initial' ? 'Initial' : 'Signature'}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs value={signatureType} onValueChange={(v) => setSignatureType(v as any)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="draw">Draw</TabsTrigger>
              <TabsTrigger value="type">Type</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
            </TabsList>
            
            <TabsContent value="dashboard" className="mt-4">
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  Use your saved {selectedTool === 'initial' ? 'initials' : 'signatures'} from your dashboard:
                </div>
                
                {(() => {
                  const targetType = selectedTool === 'initial' ? 'initial' : 'signature';
                  const availableSigs = userSignatures.filter(sig => sig.type === targetType);
                  
                  if (availableSigs.length === 0) {
                    return (
                      <div className="border-2 border-dashed rounded-lg p-8 text-center">
                        <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-sm text-gray-600 mb-4">
                          No saved {targetType}s found in your dashboard.
                        </p>
                        <p className="text-xs text-gray-500">
                          Go to your dashboard to save {targetType}s for quick use in future signings.
                        </p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="grid grid-cols-1 gap-4 max-h-60 overflow-y-auto">
                      {availableSigs.map((sig, index) => (
                        <div
                          key={index}
                          className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            // Use this saved signature
                            if (!window.pendingPosition) return;
                            
                            const { x, y, pageNumber } = window.pendingPosition;
                            const annotation: Annotation = {
                              id: `ann_${Date.now()}`,
                              type: selectedTool as 'signature' | 'initial',
                              x,
                              y,
                              width: selectedTool === 'initial' ? 80 : 150,
                              height: selectedTool === 'initial' ? 40 : 60,
                              content: sig.content || '',
                              pageNumber,
                              timestamp: new Date().toISOString(),
                              isImage: sig.type === 'drawn' || (sig.content && sig.content.startsWith('data:')),
                              color: signatureColor,
                              fontFamily: sig.fontFamily || signatureFont,
                              fontSize: selectedTool === 'initial' ? 20 : 24,
                            };
                            
                            addAnnotation(annotation);
                            setShowSignatureModal(false);
                            window.pendingPosition = undefined;
                            
                            toast({
                              title: "Dashboard Signature Added",
                              description: `Used your saved ${targetType} from dashboard`,
                            });
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              {sig.content && sig.content.startsWith('data:') ? (
                                <img 
                                  src={sig.content} 
                                  alt="Signature preview" 
                                  className="h-8 max-w-24 object-contain border rounded"
                                />
                              ) : (
                                <div 
                                  className="h-8 flex items-center text-lg border rounded px-2"
                                  style={{ fontFamily: sig.fontFamily || 'Dancing Script' }}
                                >
                                  {sig.content || 'No signature content'}
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium">
                                  {targetType === 'signature' ? 'Signature' : 'Initial'}
                                  {sig.isActive && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {sig.type === 'drawn' ? 'Hand-drawn' : sig.type === 'typed' ? 'Typed' : 'Uploaded'}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                            >
                              Use This
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </TabsContent>
            
            <TabsContent value="draw" className="mt-4">
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-white">
                  <canvas
                    ref={(canvas) => {
                      if (canvas && !signaturePadRef.current) {
                        signaturePadRef.current = new SignaturePad(canvas, {
                          penColor: signatureColor,
                          minWidth: signatureThickness,
                          maxWidth: signatureThickness + 1,
                        });
                      }
                    }}
                    width={500}
                    height={150}
                    className="w-full border"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label>Color:</Label>
                    <Input
                      type="color"
                      value={signatureColor}
                      onChange={(e) => {
                        setSignatureColor(e.target.value);
                        if (signaturePadRef.current) {
                          signaturePadRef.current.penColor = e.target.value;
                        }
                      }}
                      className="w-16 h-8"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Thickness:</Label>
                    <Slider
                      value={[signatureThickness]}
                      onValueChange={([v]) => {
                        setSignatureThickness(v);
                        if (signaturePadRef.current) {
                          signaturePadRef.current.minWidth = v;
                          signaturePadRef.current.maxWidth = v + 1;
                        }
                      }}
                      min={1}
                      max={5}
                      step={1}
                      className="w-24"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => signaturePadRef.current?.clear()}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="type" className="mt-4">
              <div className="space-y-4">
                <Input
                  placeholder={`Type your ${selectedTool === 'initial' ? 'initials' : 'signature'}`}
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  className="text-2xl"
                  style={{ fontFamily: signatureFont }}
                />
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label>Font:</Label>
                    <Select value={signatureFont} onValueChange={setSignatureFont}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Dancing Script">Dancing Script</SelectItem>
                        <SelectItem value="Great Vibes">Great Vibes</SelectItem>
                        <SelectItem value="Pacifico">Pacifico</SelectItem>
                        <SelectItem value="Allura">Allura</SelectItem>
                        <SelectItem value="Arial">Arial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Color:</Label>
                    <Input
                      type="color"
                      value={signatureColor}
                      onChange={(e) => setSignatureColor(e.target.value)}
                      className="w-16 h-8"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="upload" className="mt-4">
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  {customStampImage ? (
                    <div className="space-y-4">
                      <img
                        src={customStampImage}
                        alt="Uploaded signature"
                        className="max-h-32 mx-auto"
                      />
                      <Button
                        variant="outline"
                        onClick={() => setCustomStampImage(null)}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-sm text-gray-600 mb-4">
                        Upload an image of your {selectedTool === 'initial' ? 'initials' : 'signature'}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Choose File
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowSignatureModal(false)}>
              Cancel
            </Button>
            {signatureType !== 'dashboard' && (
              <Button onClick={saveSignature}>
                Add {selectedTool === 'initial' ? 'Initial' : 'Signature'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Stamp Modal */}
      <Dialog open={showStampModal} onOpenChange={setShowStampModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Stamp</DialogTitle>
          </DialogHeader>
          
          <Tabs value={stampType} onValueChange={(v) => setStampType(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="notary">Notary Stamp</TabsTrigger>
              <TabsTrigger value="custom">Custom Stamp</TabsTrigger>
            </TabsList>
            
            <TabsContent value="notary" className="mt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Notary Name</Label>
                    <Input
                      placeholder="John Doe"
                      value={notaryInfo.name}
                      onChange={(e) => setNotaryInfo(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Commission Number</Label>
                    <Input
                      placeholder="123456"
                      value={notaryInfo.commission}
                      onChange={(e) => setNotaryInfo(prev => ({ ...prev, commission: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>State</Label>
                    <Input
                      placeholder="CA"
                      value={notaryInfo.state}
                      onChange={(e) => setNotaryInfo(prev => ({ ...prev, state: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Expiration Date</Label>
                    <Input
                      type="date"
                      value={notaryInfo.expiration}
                      onChange={(e) => setNotaryInfo(prev => ({ ...prev, expiration: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <div className="border-4 border-black rounded-full w-40 h-40 mx-auto flex flex-col items-center justify-center text-center p-2">
                    <p className="font-bold text-sm">NOTARY PUBLIC</p>
                    <p className="text-xs mt-1">{notaryInfo.name || 'Your Name'}</p>
                    <p className="text-xs">{notaryInfo.state || 'State'}</p>
                    <p className="text-xs">Comm. #{notaryInfo.commission || '000000'}</p>
                    <p className="text-xs">Exp: {notaryInfo.expiration || 'MM/DD/YYYY'}</p>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="custom" className="mt-4">
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  {customStampImage ? (
                    <div className="space-y-4">
                      <img
                        src={customStampImage}
                        alt="Custom stamp"
                        className="max-h-32 mx-auto"
                      />
                      <Button
                        variant="outline"
                        onClick={() => setCustomStampImage(null)}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Stamp className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-sm text-gray-600 mb-4">
                        Upload your custom stamp image
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Choose File
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowStampModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveStamp}>
              Add Stamp
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}); 