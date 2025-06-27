import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import SignaturePad from 'signature_pad';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Use PDF.js from global window instead of npm package
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
  Layers
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
  type: 'signature' | 'initial' | 'text' | 'stamp' | 'date' | 'checkbox';
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

export const EnhancedPDFViewer = forwardRef<EnhancedPDFViewerRef, EnhancedPDFViewerProps>(({ 
  pdfUrl, 
  jobId, 
  currentDocument, 
  initialAnnotations = [],
  userSignatures = [],
  notaryStamps = [],
  onSignatureAdd, 
  onDocumentSave,
  readOnly = false 
}, ref) => {
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
  const [selectedTool, setSelectedTool] = useState<'select' | 'signature' | 'initial' | 'text' | 'stamp' | 'date'>('select');
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showStampModal, setShowStampModal] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  
  // Signature options
  const [signatureColor, setSignatureColor] = useState('#000000');
  const [signatureThickness, setSignatureThickness] = useState(2);
  const [signatureType, setSignatureType] = useState<'draw' | 'type' | 'upload'>('draw');
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

  // History for undo/redo
  const [history, setHistory] = useState<Annotation[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

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

  // Render all PDF pages
  const renderAllPages = useCallback(async () => {
    if (!pdfDocument || !scrollContainerRef.current) return;

    try {
      // Clear existing page refs
      pageRefs.current.clear();
      
      // Clear the container
      const container = scrollContainerRef.current;
      container.innerHTML = '';

      // Render each page
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: pdfScale, rotation });
        
        // Create page container
        const pageContainer = document.createElement('div');
        pageContainer.className = 'relative mb-4 shadow-lg';
        pageContainer.style.width = `${viewport.width}px`;
        pageContainer.style.height = `${viewport.height}px`;
        pageContainer.setAttribute('data-page-number', pageNum.toString());
        
        // Create PDF canvas
        const pdfCanvas = document.createElement('canvas');
        pdfCanvas.width = viewport.width;
        pdfCanvas.height = viewport.height;
        pdfCanvas.className = 'absolute top-0 left-0';
        
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
        fabricCanvas.className = 'absolute top-0 left-0';
        fabricCanvas.width = viewport.width;
        fabricCanvas.height = viewport.height;
        
        pageContainer.appendChild(pdfCanvas);
        pageContainer.appendChild(fabricCanvas);
        container.appendChild(pageContainer);
        
        // Initialize Fabric canvas
        if (window.fabric) {
          const fabric = new window.fabric.Canvas(fabricCanvas.id, {
            width: viewport.width,
            height: viewport.height,
            selection: !readOnly,
          });
          
          // Set up event listeners
          fabric.on('selection:created', (e: any) => {
            if (e.selected && e.selected[0]) {
              setSelectedAnnotation(e.selected[0].id || null);
            }
          });
          
          fabric.on('selection:cleared', () => {
            setSelectedAnnotation(null);
          });
          
          fabric.on('object:modified', (e: any) => {
            updateAnnotationFromFabric(e.target, pageNum);
          });
          
          // Handle click events for adding annotations
          fabric.on('mouse:down', (e: any) => {
            if (selectedTool !== 'select' && e.target === null) {
              const pointer = fabric.getPointer(e.e);
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
        }
      }
      
    } catch (error) {
      console.error('Error rendering PDF pages:', error);
    }
  }, [pdfDocument, totalPages, pdfScale, rotation, readOnly, selectedTool]);

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
    const pageInfo = pageRefs.current.get(pageNumber);
    if (!pageInfo || !pageInfo.fabricCanvas) return;
    
    // Clear existing objects
    pageInfo.fabricCanvas.clear();
    
    // Add annotations for this page
    const pageAnnotations = annotations.filter(ann => ann.pageNumber === pageNumber);
    pageAnnotations.forEach(annotation => {
      addAnnotationToCanvas(annotation, pageNumber);
    });
  };

  // Add annotation to Fabric canvas
  const addAnnotationToCanvas = (annotation: Annotation, pageNumber: number) => {
    const pageInfo = pageRefs.current.get(pageNumber);
    if (!pageInfo || !pageInfo.fabricCanvas) return;

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
          });
        }
        break;

      case 'text':
        if (window.fabric) {
          fabricObject = new window.fabric.Text(annotation.content, {
            id: annotation.id,
            left: annotation.x,
            top: annotation.y,
            fontSize: annotation.fontSize || 16,
            fontFamily: annotation.fontFamily || 'Arial',
            fill: annotation.color || '#000000',
            selectable: !readOnly,
            hasControls: !readOnly,
          });
        }
        break;

      case 'date':
        if (window.fabric) {
          fabricObject = new window.fabric.Text(new Date().toLocaleDateString(), {
            id: annotation.id,
            left: annotation.x,
            top: annotation.y,
            fontSize: 14,
            fontFamily: 'Arial',
            fill: '#000000',
            selectable: !readOnly,
            hasControls: !readOnly,
          });
        }
        break;

      case 'checkbox':
        if (window.fabric) {
          const rect = new window.fabric.Rect({
            left: annotation.x,
            top: annotation.y,
            width: 20,
            height: 20,
            fill: 'transparent',
            stroke: '#000000',
            strokeWidth: 2,
          });
          
          const check = new window.fabric.Text('✓', {
            left: annotation.x + 2,
            top: annotation.y - 2,
            fontSize: 18,
            fill: '#000000',
          });
          
          fabricObject = new window.fabric.Group([rect, check], {
            id: annotation.id,
            selectable: !readOnly,
            hasControls: !readOnly,
          });
        }
        break;
    }

    if (fabricObject) {
      pageInfo.fabricCanvas.add(fabricObject);
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

  // Handle canvas click
  const handleCanvasClick = (x: number, y: number, pageNumber: number) => {
    if (selectedTool === 'select' || readOnly) return;

    switch (selectedTool) {
      case 'signature':
        setShowSignatureModal(true);
        window.pendingPosition = { x, y, pageNumber };
        break;
      case 'initial':
        setShowSignatureModal(true);
        window.pendingPosition = { x, y, pageNumber };
        break;
      case 'text':
        addTextAnnotation(x, y, pageNumber);
        break;
      case 'stamp':
        setShowStampModal(true);
        window.pendingPosition = { x, y, pageNumber };
        break;
      case 'date':
        addDateAnnotation(x, y, pageNumber);
        break;
    }
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

  // Add annotation and update history
  const addAnnotation = (annotation: Annotation) => {
    setAnnotations(prev => [...prev, annotation]);
    addAnnotationToCanvas(annotation, annotation.pageNumber);
    
    // Update history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...annotations, annotation]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    // Notify parent
    if (onSignatureAdd) {
      onSignatureAdd(annotation);
    }
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
              const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
              page.drawText(annotation.content, {
                x: annotation.x,
                y: pageHeight - annotation.y - annotation.height,
                size: annotation.fontSize || 16,
                font,
                color: rgb(0, 0, 0),
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

  // Reload annotations when they change
  useEffect(() => {
    pageRefs.current.forEach((pageInfo, pageNum) => {
      loadPageAnnotations(pageNum);
    });
  }, [annotations]);

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
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between flex-wrap gap-2">
        {/* Tools */}
        <div className="flex items-center gap-2">
          <Button
            variant={selectedTool === 'select' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('select')}
            disabled={readOnly}
          >
            <MousePointer className="h-4 w-4" />
          </Button>
          <div className="h-6 w-px bg-gray-300" />
          <Button
            variant={selectedTool === 'signature' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('signature')}
            disabled={readOnly}
          >
            <Pen className="h-4 w-4" />
            <span className="ml-1">Sign</span>
          </Button>
          <Button
            variant={selectedTool === 'initial' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('initial')}
            disabled={readOnly}
          >
            <Pen className="h-4 w-4" />
            <span className="ml-1">Initial</span>
          </Button>
          <Button
            variant={selectedTool === 'text' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('text')}
            disabled={readOnly}
          >
            <Type className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedTool === 'stamp' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('stamp')}
            disabled={readOnly}
          >
            <Stamp className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedTool === 'date' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('date')}
            disabled={readOnly}
          >
            <FileText className="h-4 w-4" />
            <span className="ml-1">Date</span>
          </Button>
          <div className="h-6 w-px bg-gray-300" />
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={readOnly || historyIndex === 0}
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={redo}
            disabled={readOnly || historyIndex === history.length - 1}
          >
            <Redo className="h-4 w-4" />
          </Button>
          {selectedAnnotation && (
            <Button
              variant="outline"
              size="sm"
              onClick={deleteSelectedAnnotation}
              disabled={readOnly}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Zoom and page indicator */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm min-w-[60px] text-center">{Math.round(pdfScale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={fitToPage}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <div className="h-6 w-px bg-gray-300" />
          <div className="flex items-center gap-1">
            <Layers className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Page {currentViewPage} of {totalPages}
            </span>
          </div>
        </div>

        {/* Save button */}
        <Button
          onClick={saveModifiedPDF}
          disabled={readOnly || isSaving || annotations.length === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save PDF
            </>
          )}
        </Button>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto p-4">
        <div 
          ref={scrollContainerRef}
          className="mx-auto space-y-0"
          style={{ maxWidth: '100%' }}
        >
          {/* PDF pages will be dynamically added here */}
        </div>
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="draw">Draw</TabsTrigger>
              <TabsTrigger value="type">Type</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
            </TabsList>
            
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
            <Button onClick={saveSignature}>
              Add {selectedTool === 'initial' ? 'Initial' : 'Signature'}
            </Button>
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