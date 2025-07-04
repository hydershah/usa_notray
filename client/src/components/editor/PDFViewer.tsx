import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Rnd } from 'react-rnd';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { initializePDFWorker, isPDFWorkerReady } from '../../lib/pdf-worker';
import type { TagCoordinates, DocumentTag, SessionParticipant } from '../../types/editor';
import { TAG_TYPE_INFO } from '../../types/editor';

interface PDFViewerProps {
  documentUrl: string;
  onPageLoad?: (pageNumber: number, canvas: HTMLCanvasElement, scaleFactor: number) => void;
  onCoordinateClick?: (coordinates: TagCoordinates) => void;
  tags?: DocumentTag[];
  mode?: string;
  selectedUser?: SessionParticipant | null;
  onTagUpdate?: (tagId: string, coordinates: Partial<TagCoordinates>) => void;
  onTagResize?: (tagId: string, coordinates: Partial<TagCoordinates>) => void;
  onTagDelete?: (tagId: string) => void;
  className?: string;
}

interface TagRendererProps {
  tag: DocumentTag;
  scaleFactor: number;
  isSelected: boolean;
  canEdit: boolean;
  onUpdate: (coordinates: Partial<TagCoordinates>) => void;
  onSave: (coordinates: Partial<TagCoordinates>) => void;
  onDelete: () => void;
  onSelect: () => void;
}

const TagRenderer: React.FC<TagRendererProps> = ({
  tag,
  scaleFactor,
  isSelected,
  canEdit,
  onUpdate,
  onSave,
  onDelete,
  onSelect
}) => {
  const tagInfo = TAG_TYPE_INFO[tag.tagType];
  
  // Convert PDF coordinates to display coordinates
  const displayCoords = {
    x: Math.round(tag.coordinates.x * scaleFactor),
    y: Math.round(tag.coordinates.y * scaleFactor),
    width: Math.round(tag.coordinates.width * scaleFactor),
    height: Math.round(tag.coordinates.height * scaleFactor)
  };

  const validateAndSanitizeCoordinates = (coords: any) => {
    const sanitized: any = {};
    
    if (coords.x !== undefined) {
      sanitized.x = isFinite(coords.x) ? Math.round(coords.x) : 0;
    }
    if (coords.y !== undefined) {
      sanitized.y = isFinite(coords.y) ? Math.round(coords.y) : 0;
    }
    if (coords.width !== undefined) {
      sanitized.width = isFinite(coords.width) && coords.width > 0 ? Math.round(coords.width) : 100;
    }
    if (coords.height !== undefined) {
      sanitized.height = isFinite(coords.height) && coords.height > 0 ? Math.round(coords.height) : 30;
    }
    
    return sanitized;
  };

  const handleDrag = (e: any, data: any) => {
    if (!canEdit) return;
    
    // Update coordinates during drag for smooth visual feedback
    const newCoordinates = validateAndSanitizeCoordinates({
      x: data.x / scaleFactor,
      y: data.y / scaleFactor
    });
    
    onUpdate(newCoordinates);
  };

  const handleDragStop = (e: any, data: any) => {
    if (!canEdit || !onSave) return;
    
    // Save to server only when drag ends
    const newCoordinates = validateAndSanitizeCoordinates({
      x: data.x / scaleFactor,
      y: data.y / scaleFactor
    });
    
    onSave(newCoordinates);
  };

  const handleResize = (e: any, direction: any, ref: any, delta: any, position: any) => {
    if (!canEdit) return;
    
    // Update coordinates during resize for smooth visual feedback
    const newCoordinates = validateAndSanitizeCoordinates({
      x: position.x / scaleFactor,
      y: position.y / scaleFactor,
      width: ref.offsetWidth / scaleFactor,
      height: ref.offsetHeight / scaleFactor
    });
    
    onUpdate(newCoordinates);
  };

  const handleResizeStop = (e: any, direction: any, ref: any, delta: any, position: any) => {
    if (!canEdit || !onSave) return;
    
    // Save to server only when resize ends
    const newCoordinates = {
      x: Math.round(position.x / scaleFactor),
      y: Math.round(position.y / scaleFactor),
      width: Math.round(ref.offsetWidth / scaleFactor),
      height: Math.round(ref.offsetHeight / scaleFactor)
    };
    
    onSave(newCoordinates);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete();
    }
  };

  return (
    <Rnd
      size={{
        width: displayCoords.width,
        height: displayCoords.height
      }}
      position={{
        x: displayCoords.x,
        y: displayCoords.y
      }}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResize={handleResize}
      onResizeStop={handleResizeStop}
      enableResizing={canEdit}
      disableDragging={!canEdit}
      bounds="parent"
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={`
        border-2 rounded transition-all cursor-pointer
        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-400 bg-white bg-opacity-90'}
        ${canEdit ? 'hover:border-blue-400' : ''}
      `}
      style={{
        backgroundColor: tag.colorCode || '#4ECDC4',
        borderColor: isSelected ? '#3B82F6' : tag.colorCode || '#4ECDC4',
        zIndex: isSelected ? 1000 : 100,
        pointerEvents: 'auto'
      }}
      resizeHandleStyles={canEdit ? {
        bottomRight: { 
          width: '12px', 
          height: '12px', 
          backgroundColor: '#3B82F6',
          border: '2px solid white',
          borderRadius: '50%'
        }
      } : undefined}
    >
      <div className="w-full h-full flex items-center justify-center text-white text-xs font-medium text-center p-1">
        <span className="truncate">
          {tagInfo.icon} {tag.displayLabel || `${tagInfo.label}`}
        </span>
      </div>
    </Rnd>
  );
};

export const PDFViewer: React.FC<PDFViewerProps> = ({
  documentUrl,
  onPageLoad,
  onCoordinateClick,
  tags = [],
  mode = 'tagging',
  selectedUser,
  onTagUpdate,
  onTagResize,
  onTagDelete,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<HTMLCanvasElement[]>([]);
  const pageContainerRefs = useRef<HTMLDivElement[]>([]);
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  
  const { 
    viewer, 
    selectedTag,
    selectTag,
    setCurrentPage, 
    setZoomLevel,
    setScrollTop,
    mode: editorMode
  } = useEditorStore();
  
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [scaleFactors, setScaleFactors] = useState<Map<number, number>>(new Map());
  const isMountedRef = useRef<boolean>(true);

  // Determine if user can edit tags
  const canEditTags = useMemo(() => {
    const result = mode === 'tagging' && editorMode.canPlaceTags;
    console.log('🏷️  Can edit tags calculation:', { mode, canPlaceTags: editorMode.canPlaceTags, result });
    return result;
  }, [mode, editorMode.canPlaceTags]);

  // Load PDF document with improved error handling and redirect support
  const loadPDF = useCallback(async (url: string) => {
    try {
      console.log('📄 Starting PDF load for URL:', url);
      setLoading(true);
      setError(null);
      
      // Ensure worker is ready
      if (!isPDFWorkerReady()) {
        console.log('🔧 Initializing PDF worker...');
        initializePDFWorker();
        await new Promise(resolve => setTimeout(resolve, 200)); // Longer wait for worker
      }

      // Clean up previous loading task
      if (loadingTaskRef.current) {
        try {
          loadingTaskRef.current.destroy();
        } catch (e: any) {
          console.log('Previous task cleanup:', e?.message || 'Unknown error');
        }
        loadingTaskRef.current = null;
        await new Promise(resolve => setTimeout(resolve, 50)); // Wait for cleanup
      }
      
      // FIXED: First fetch the PDF as a blob to handle redirects properly
      let pdfData: ArrayBuffer;
      try {
        console.log('📄 Fetching PDF document...');
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          credentials: 'same-origin'
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Get the PDF data as ArrayBuffer
        pdfData = await response.arrayBuffer();
        console.log('✅ PDF data fetched successfully, size:', pdfData.byteLength);
        
      } catch (fetchError) {
        console.error('❌ Failed to fetch PDF:', fetchError);
        throw new Error('Failed to download PDF from server');
      }
      
      // Load the PDF from the ArrayBuffer
      const loadingTask = pdfjsLib.getDocument({
        data: pdfData,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        verbosity: 0,
        maxImageSize: 1024 * 1024, // Limit image size
        cMapPacked: true
      });
      
      loadingTaskRef.current = loadingTask;
      console.log('📄 PDF loading task created, waiting for promise...');
      const pdf = await loadingTask.promise;
      
      if (!isMountedRef.current) return;
      
      console.log('✅ PDF loaded successfully:', { numPages: pdf.numPages });
      setPdfDoc(pdf);
      setRenderedPages(new Set());
      setScaleFactors(new Map());
      
      useEditorStore.setState(state => ({
        viewer: {
          ...state.viewer,
          totalPages: pdf.numPages,
          currentPage: 1
        }
      }));
      
      setLoading(false);
      
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('❌ PDF load error:', err);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to load PDF';
      if (err instanceof Error) {
        if (err.message.includes('NetworkError') || err.message.includes('fetch')) {
          errorMessage = 'Network error: Unable to download PDF. Please check your connection and try again.';
        } else if (err.message.includes('Invalid PDF')) {
          errorMessage = 'Invalid PDF file. The document may be corrupted or not a valid PDF.';
        } else if (err.message.includes('Password')) {
          errorMessage = 'PDF is password protected. Please provide the password.';
        } else {
          errorMessage = `Failed to load PDF: ${err.message}`;
        }
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  }, []);

  // Render individual page with optimized scaling
  const renderPage = useCallback(async (pageNumber: number, forceRender = false) => {
    if (!pdfDoc) return;
    
    // Check if already rendered (unless force render)
    if (!forceRender && renderedPages.has(pageNumber)) return;

    try {
      console.log(`🖼️  Rendering page ${pageNumber}...`);
      const page = await pdfDoc.getPage(pageNumber);
      const canvas = canvasRefs.current[pageNumber - 1];
      const pageContainer = pageContainerRefs.current[pageNumber - 1];
      
      if (!canvas || !pageContainer) {
        console.error(`❌ Missing canvas or container for page ${pageNumber}:`, { canvas: !!canvas, pageContainer: !!pageContainer });
        return;
      }

      const context = canvas.getContext('2d');
      if (!context) {
        console.error(`❌ Could not get 2D context for page ${pageNumber}`);
        return;
      }

      // Clear any existing content to prevent render conflicts
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Calculate optimal scale based on container width - made smaller for better UX
      const containerWidth = containerRef.current?.clientWidth || 800;
      const viewport = page.getViewport({ scale: 1 });
      const baseScale = Math.min((containerWidth - 120) / viewport.width, 1.0); // Reduced to 1.0x max scale for better fit
      const finalScale = baseScale * viewer.zoomLevel;

      console.log(`📐 Page ${pageNumber} scale calculation:`, { containerWidth, baseScale, zoomLevel: viewer.zoomLevel, finalScale });

      // Store scale factor for coordinate conversion
      setScaleFactors(prev => new Map(prev.set(pageNumber, finalScale)));

      const scaledViewport = page.getViewport({ scale: finalScale });

      // Set canvas dimensions
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      canvas.style.width = `${scaledViewport.width}px`;
      canvas.style.height = `${scaledViewport.height}px`;

      // Set page container size for proper tag positioning
      pageContainer.style.width = `${scaledViewport.width}px`;
      pageContainer.style.height = `${scaledViewport.height}px`;

      console.log(`🎨 Canvas ${pageNumber} dimensions set:`, { width: scaledViewport.width, height: scaledViewport.height });

      // Render page with high quality
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
        intent: 'display'
      };

      // Wait for any existing render to complete
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to prevent race conditions
      
      const renderTask = page.render(renderContext);
      await renderTask.promise;
      
      setRenderedPages(prev => new Set(prev.add(pageNumber)));
      onPageLoad?.(pageNumber, canvas, finalScale);
      
      console.log(`✅ Page ${pageNumber} rendered successfully`);
      
    } catch (err) {
      console.error(`❌ Error rendering page ${pageNumber}:`, err);
      // Remove from rendered set so it can be retried
      setRenderedPages(prev => {
        const newSet = new Set(prev);
        newSet.delete(pageNumber);
        return newSet;
      });
    }
  }, [pdfDoc, viewer.zoomLevel, onPageLoad]);

  // Load PDF on URL change
  useEffect(() => {
    console.log('🔗 Document URL effect triggered:', { documentUrl, hasUrl: !!documentUrl });
    if (documentUrl) {
      loadPDF(documentUrl);
    }
    return () => {
      isMountedRef.current = false;
      console.log('🧹 PDFViewer cleanup triggered');
      if (loadingTaskRef.current) {
        setTimeout(() => loadingTaskRef.current?.destroy(), 100);
      }
    };
  }, [documentUrl, loadPDF]);

  // Initial page rendering when PDF loads (OPTIMIZED)
  useEffect(() => {
    if (!pdfDoc) return;
    
    console.log('📖 PDF loaded, starting initial page rendering...');
    
    const renderInitialPages = async () => {
      // OPTIMIZED: Render only first 2 pages initially for faster loading
      const pagesToRender = Math.min(2, pdfDoc.numPages);
      
      // Render pages in parallel for better performance
      const renderPromises = [];
      for (let i = 1; i <= pagesToRender; i++) {
        renderPromises.push(
          renderPage(i, false).catch(error => {
            console.error(`Failed to render initial page ${i}:`, error);
          })
        );
      }
      
      await Promise.all(renderPromises);
      console.log(`✅ Initial ${pagesToRender} pages rendered in parallel`);
      
      // Render remaining pages in background (if any)
      if (pdfDoc.numPages > pagesToRender) {
        setTimeout(async () => {
          for (let i = pagesToRender + 1; i <= Math.min(5, pdfDoc.numPages); i++) {
            try {
              await renderPage(i, false);
              await new Promise(resolve => setTimeout(resolve, 5)); // Shorter delay
            } catch (error) {
              console.error(`Failed to render background page ${i}:`, error);
            }
          }
          console.log(`✅ Background pages rendered`);
        }, 100);
      }
    };
    
    renderInitialPages();
  }, [pdfDoc, renderPage]);

  // Re-render pages on zoom change
  useEffect(() => {
    if (!pdfDoc) return;
    
    console.log('🔄 Zoom changed, re-rendering all pages...');
    setRenderedPages(new Set());
    setScaleFactors(new Map());
    
    const renderAllPages = async () => {
      // Render pages sequentially to avoid concurrent canvas operations
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        try {
          await renderPage(i, true); // Force render on zoom change
          // Small delay between renders to prevent canvas conflicts
          await new Promise(resolve => setTimeout(resolve, 5));
        } catch (error) {
          console.error(`Failed to render page ${i} during zoom:`, error);
        }
      }
      console.log('✅ All pages re-rendered after zoom change');
    };
    
    renderAllPages();
  }, [pdfDoc, viewer.zoomLevel, renderPage]);

  // Log component state changes
  useEffect(() => {
    console.log('📊 PDFViewer state update:', {
      documentUrl,
      pdfDocLoaded: !!pdfDoc,
      numPages: pdfDoc?.numPages,
      loading,
      error,
      canEditTags,
      tagsCount: tags.length,
      scaleFactorsSize: scaleFactors.size,
      renderedPagesSize: renderedPages.size
    });
  }, [documentUrl, pdfDoc, loading, error, canEditTags, tags.length, scaleFactors.size, renderedPages.size]);

  // Handle canvas clicks for tag placement
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('🖱️  Canvas click detected', { canEditTags, hasClickHandler: !!onCoordinateClick });
    
    if (!canEditTags || !onCoordinateClick) return;

    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const pageNumber = parseInt(canvas.dataset.pageNumber || '1');
    const scaleFactor = scaleFactors.get(pageNumber) || 1;
    
    // Ensure we have valid values
    if (!canvas || !rect || isNaN(pageNumber) || pageNumber <= 0 || !isFinite(scaleFactor) || scaleFactor <= 0) {
      console.error('Invalid canvas click setup:', { canvas: !!canvas, rect: !!rect, pageNumber, scaleFactor });
      return;
    }
    
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    
    // Validate mouse coordinates
    if (isNaN(canvasX) || isNaN(canvasY) || !isFinite(canvasX) || !isFinite(canvasY)) {
      console.error('Invalid mouse coordinates:', { canvasX, canvasY, clientX: event.clientX, clientY: event.clientY, rect });
      return;
    }
    
    const pdfX = canvasX / scaleFactor;
    const pdfY = canvasY / scaleFactor;
    
    // Validate calculated PDF coordinates
    if (isNaN(pdfX) || isNaN(pdfY) || !isFinite(pdfX) || !isFinite(pdfY)) {
      console.error('Invalid calculated PDF coordinates:', { pdfX, pdfY, canvasX, canvasY, scaleFactor });
      return;
    }
    
    // Ensure coordinates are positive and reasonable
    const tagX = Math.max(0, Math.round(pdfX - 75)); // Center tag, ensure non-negative
    const tagY = Math.max(0, Math.round(pdfY - 20));
    const tagWidth = 150;
    const tagHeight = 40;
    
    // Final validation of coordinates
    if (isNaN(tagX) || isNaN(tagY) || !isFinite(tagX) || !isFinite(tagY)) {
      console.error('Invalid final tag coordinates:', { tagX, tagY, pdfX, pdfY });
      return;
    }
    
    const coordinates: TagCoordinates = {
      x: tagX,
      y: tagY,
      width: tagWidth,
      height: tagHeight,
      pageNumber
    };

    console.log('✅ Valid tag coordinates calculated:', coordinates);
    onCoordinateClick(coordinates);
  }, [canEditTags, onCoordinateClick, scaleFactors]);

  // Handle scroll tracking
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const scrollTop = container.scrollTop;
    
    setScrollTop(scrollTop);

    // Track current page based on scroll position
    let currentPage = 1;
    const pageContainers = pageContainerRefs.current;
    
    for (let i = 0; i < pageContainers.length; i++) {
      const container = pageContainers[i];
      if (container && container.offsetTop <= scrollTop + 100) {
        currentPage = i + 1;
      }
    }
    
    if (currentPage !== viewer.currentPage) {
      setCurrentPage(currentPage);
    }
  }, [viewer.currentPage, setCurrentPage, setScrollTop]);

  // Tag event handlers
  const handleTagUpdate = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    onTagUpdate?.(tagId, coordinates);
  }, [onTagUpdate]);

  const handleTagSave = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    onTagResize?.(tagId, coordinates); // onTagResize acts as save method for now
  }, [onTagResize]);

  const handleTagDelete = useCallback((tagId: string) => {
    onTagDelete?.(tagId);
  }, [onTagDelete]);

  const handleTagSelect = useCallback((tag: DocumentTag) => {
    selectTag(tag.id === selectedTag?.id ? null : tag);
  }, [selectTag, selectedTag]);

  // Zoom controls
  const handleZoomIn = () => setZoomLevel(Math.min(viewer.zoomLevel * 1.25, 3.0));
  const handleZoomOut = () => setZoomLevel(Math.max(viewer.zoomLevel / 1.25, 0.25));
  const handleZoomReset = () => setZoomLevel(1.0);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 mb-2">Loading PDF...</p>
          <p className="text-sm text-gray-500">This may take a few seconds for large documents</p>
          <div className="mt-4 w-64 bg-gray-200 rounded-full h-2 mx-auto">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center max-w-md">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => loadPDF(documentUrl)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!pdfDoc) return null;

  return (
    <div className={`relative h-full flex flex-col ${className}`}>
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button 
              onClick={handleZoomOut} 
              className="p-2 bg-white border rounded hover:bg-gray-50 transition-colors shadow-sm"
              title="Zoom out"
            >
              −
            </button>
            <span className="min-w-16 text-center text-sm font-medium px-2">
              {Math.round(viewer.zoomLevel * 100)}%
            </span>
            <button 
              onClick={handleZoomIn} 
              className="p-2 bg-white border rounded hover:bg-gray-50 transition-colors shadow-sm"
              title="Zoom in"
            >
              +
            </button>
          </div>
          <button 
            onClick={handleZoomReset} 
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors"
            title="Reset zoom to fit"
          >
            Fit to View
          </button>
        </div>
        
        <div className="text-sm text-gray-700 bg-gray-100 px-3 py-2 rounded-lg">
          📄 Page {viewer.currentPage} of {viewer.totalPages}
          {tags.length > 0 && <span className="ml-3 text-green-600">• {tags.length} tags</span>}
        </div>
      </div>

      {/* PDF Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-50 py-6 px-4"
        onScroll={handleScroll}
      >
        {/* PDF Pages Container */}
        <div className="w-full flex flex-col items-center space-y-6">
          {Array.from({ length: pdfDoc.numPages }, (_, index) => {
            const pageNumber = index + 1;
            const pageTags = tags.filter(tag => tag.coordinates.pageNumber === pageNumber);
            const scaleFactor = scaleFactors.get(pageNumber) || 1;
            
            return (
              <div key={pageNumber} className="relative">
                {/* Page label */}
                <div className="text-sm text-gray-600 font-medium mb-3 flex items-center justify-between">
                  <span>Page {pageNumber}</span>
                  {pageTags.length > 0 && (
                    <span className="text-green-600 text-xs bg-green-50 px-2 py-1 rounded-full">
                      {pageTags.length} tags
                    </span>
                  )}
                </div>
                
                {/* Page container with tags */}
                <div
                  ref={el => { if (el) pageContainerRefs.current[index] = el; }}
                  className="relative bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200"
                  style={{ display: 'inline-block' }}
                >
                  {/* PDF Canvas */}
                  <canvas
                    ref={el => { 
                      if (el) {
                        canvasRefs.current[index] = el;
                        console.log(`🎯 Canvas ${pageNumber} created and ref set`);
                        
                        // Add debugging for canvas state
                        console.log(`🔍 Canvas ${pageNumber} debug:`, {
                          hasElement: !!el,
                          width: el.width,
                          height: el.height,
                          clientWidth: el.clientWidth, 
                          clientHeight: el.clientHeight,
                          canEditTags,
                          pageNumber
                        });
                      }
                    }}
                    data-page-number={pageNumber}
                    onClick={(e) => {
                      console.log(`🖱️  Canvas ${pageNumber} DIRECT CLICK detected:`, {
                        pageNumber,
                        canEditTags,
                        clientX: e.clientX,
                        clientY: e.clientY,
                        targetWidth: e.currentTarget.clientWidth,
                        targetHeight: e.currentTarget.clientHeight
                      });
                      handleCanvasClick(e);
                    }}
                    onMouseDown={(e) => {
                      console.log(`👆 Canvas ${pageNumber} MOUSE DOWN:`, { pageNumber, button: e.button });
                    }}
                    className={`
                      block transition-all duration-200
                      ${canEditTags 
                        ? 'cursor-crosshair hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50' 
                        : 'cursor-default'
                      }
                    `}
                    style={{ 
                      backgroundColor: '#ffffff', // Clean white background
                      minHeight: '600px' // Ensure clickable area exists even before render
                    }}
                  />
                  
                  {/* Tags overlay */}
                  {pageTags.map(tag => (
                    <div key={`${tag.id}-${scaleFactor}`} className="absolute top-0 left-0 w-full h-full pointer-events-none">
                      <div className="relative w-full h-full pointer-events-none">
                        <TagRenderer
                          tag={tag}
                          scaleFactor={scaleFactor}
                          isSelected={selectedTag?.id === tag.id}
                          canEdit={canEditTags}
                          onUpdate={(coords) => handleTagUpdate(tag.id, coords)}
                          onSave={(coords) => handleTagSave(tag.id, coords)}
                          onDelete={() => handleTagDelete(tag.id)}
                          onSelect={() => handleTagSelect(tag)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;