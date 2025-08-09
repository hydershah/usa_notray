export const PDFViewer: React.FC<PDFViewerProps> = ({
  documentUrl,
  sessionId,
  onPageLoad,
  onCoordinateClick,
  onTagClick,
  onTagResize,
  onTagDelete,
  mode = 'tagging',
  liveSessionState,
  onSetActiveUser,
  tags = [],
  selectedUser,
  onTagUpdate,
  className = '',
  textInputs,
  selectedTextInputId,
  onTextInputSelect,
  onSaveTextContent,
  onDeleteTextInput,
  onMoveTextInput,
  onFontSizeChange,
  onSyncUsers,
  currentUser,
  isSyncLoading = false,
  webSocket,
  highlightedTagId,
  incompleteTags = [],
  onScrollToTag
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<HTMLCanvasElement[]>([]);
  const pageContainerRefs = useRef<HTMLDivElement[]>([]);
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  const renderTasksRef = useRef<Map<number, any>>(new Map()); // Track render tasks
  const currentDocumentUrlRef = useRef<string | null>(null);
  const isLoadingRef = useRef<boolean>(false);
  const documentSwitchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const store = useEditorStore();
  const { 
    viewer, 
    selectedTag,
    selectedTagType,
    selectTag,
    setCurrentPage, 
    setZoomLevel,
    setScrollTop,
    mode: editorMode,
    whiteoutOverlays,
    lastUsedFontSize,
    setLastUsedFontSize
  } = store;

  // Determine if user can edit/place tags (respecting mode and store permissions)
  const canEditTags = useMemo(() => {
    return editorMode.canPlaceTags && (mode === 'tagging' || mode === 'signing');
  }, [editorMode.canPlaceTags, mode]);

  // Debug: Log store functions to ensure they exist
  if ((window as any).__DEBUG_EDITOR__) {
    console.log('🔍 Store functions:', {
      setZoomLevel: typeof setZoomLevel,
      currentZoomLevel: viewer.zoomLevel
    });
  }

  // Zoom controls with debugging and larger increments
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(viewer.zoomLevel * 1.5, 3.0);
    console.log('🔍 Zoom In:', { current: viewer.zoomLevel, new: newZoom });
    setZoomLevel(newZoom);
  }, [viewer.zoomLevel, setZoomLevel]);
  
  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(viewer.zoomLevel / 1.5, 0.25);
    console.log('🔍 Zoom Out:', { current: viewer.zoomLevel, new: newZoom });
    setZoomLevel(newZoom);
  }, [viewer.zoomLevel, setZoomLevel]);
  
  const handleZoomReset = useCallback(() => {
    console.log('🔍 Zoom Reset:', { current: viewer.zoomLevel, new: 1.0 });
    setZoomLevel(1.0);
  }, [viewer.zoomLevel, setZoomLevel]);

  // Expose zoom functions to window for debugging
  useEffect(() => {
    // @ts-ignore - for debugging only
    window.debugZoom = {
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
      zoomReset: handleZoomReset,
      setZoomLevel,
      currentZoom: viewer.zoomLevel
    };
    console.log('🔍 Debug zoom functions exposed to window.debugZoom');
  }, [handleZoomIn, handleZoomOut, handleZoomReset, setZoomLevel, viewer.zoomLevel]);

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Plus for zoom in
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        console.log('🔍 Keyboard zoom in triggered');
        handleZoomIn();
      }
      // Ctrl/Cmd + Minus for zoom out
      else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        console.log('🔍 Keyboard zoom out triggered');
        handleZoomOut();
      }
      // Ctrl/Cmd + 0 for reset zoom
      else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        console.log('🔍 Keyboard zoom reset triggered');
        handleZoomReset();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleZoomReset]);

  // Mouse wheel zoom functionality
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Only zoom if Ctrl/Cmd is held
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        if (e.deltaY < 0) {
          // Scrolling up = zoom in
          console.log('🔍 Mouse wheel zoom in triggered');
          handleZoomIn();
        } else {
          // Scrolling down = zoom out
          console.log('🔍 Mouse wheel zoom out triggered');
          handleZoomOut();
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleZoomIn, handleZoomOut]);

  // Local state for immediate font size updates (for responsive UI)
  const [localFontSizes, setLocalFontSizes] = useState<Map<string, number>>(new Map());

  // Memoize current font size to prevent excessive re-renders
  const currentFontSize = useMemo(() => {
    if (selectedTag) {
      console.log('🎯 Selected tag for font size:', selectedTag.tagType, selectedTag.id, 'contentData:', selectedTag.contentData);
      // Check local font sizes first, then contentData, then fallback
      const localFontSize = localFontSizes.get(selectedTag.id);
      if (localFontSize !== undefined) {
        console.log('🎯 Using local font size:', localFontSize);
        return localFontSize;
      }
      const contentFontSize = selectedTag.contentData?.fontSize;
      if (contentFontSize !== undefined && contentFontSize > 0) {
        console.log('🎯 Using contentData font size:', contentFontSize);
        return contentFontSize;
      }
      // For text tags, try to get font size from the actual rendered content
      if (selectedTag.tagType === 'T' && selectedTag.content) {
        // Try to extract font size from the content or use a reasonable default
        const defaultTextFontSize = 16; // Default text size
        console.log('🎯 Using default text font size:', defaultTextFontSize);
        return defaultTextFontSize;
      }
      console.log('🎯 Using lastUsedFontSize:', lastUsedFontSize);
      return lastUsedFontSize;
    } else if (selectedTextInputId) {
      const selectedTextInput = textInputs?.find(ti => ti.id === selectedTextInputId);
      console.log('🎯 Selected text input for font size:', selectedTextInputId, 'fontSize:', selectedTextInput?.fontSize);
      return selectedTextInput?.fontSize || lastUsedFontSize;
    }
    return lastUsedFontSize;
  }, [selectedTag?.id, selectedTag?.contentData?.fontSize, selectedTag?.tagType, selectedTag?.content, selectedTextInputId, textInputs, lastUsedFontSize, localFontSizes]);
  
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [scaleFactors, setScaleFactors] = useState<Map<number, number>>(new Map());
  const isMountedRef = useRef<boolean>(true);

  // Prevent repeated re-centering while highlight is active
  const lastJumpedTagIdRef = useRef<string | null>(null);
  // Track the most recent requested tag to scroll to; older requests will abort
  const pendingScrollTagRef = useRef<string | null>(null);

  // Render individual page with optimized scaling
  const renderPage = useCallback(async (pageNumber: number, forceRender = false) => {
    if (!pdfDoc || !isMountedRef.current) return;
    
    // Check if already rendered (unless force render)
    if (!forceRender && renderedPages.has(pageNumber)) return;

    // Cancel any existing render task for this page to prevent conflicts
    const existingTask = renderTasksRef.current.get(pageNumber);
    if (existingTask && typeof existingTask.cancel === 'function') {
      try {
        await existingTask.cancel();
        console.log(`🚫 Cancelled existing render task for page ${pageNumber}`);
        // Small delay to ensure cancellation is processed
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (e) {
        // Ignore cancellation errors
        console.log(`⚠️ Cancellation error (safe to ignore):`, e);
      }
    }
    renderTasksRef.current.delete(pageNumber);

    try {
      console.log(`🖼️  Rendering page ${pageNumber}...`);
      const page = await pdfDoc.getPage(pageNumber);
      
      // Check mount status after async operation
      if (!isMountedRef.current) return;
      
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

      // Clear any existing content and reset transform to prevent render conflicts
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.restore();

      // Calculate optimal scale based on container width - improved with better fallback
      let containerWidth = containerRef.current?.clientWidth || 800;
      
      // Ensure we have a reasonable container width
      if (containerWidth < 200) {
        containerWidth = 800; // Better fallback for edge cases
        console.warn(`⚠️ Container width too small (${containerWidth}), using fallback`);
      }
      
      const viewport = page.getViewport({ scale: 1 });
      const baseScale = Math.min((containerWidth - 120) / viewport.width, 1.0); // Reduced to 1.0x max scale for better fit
      
      // Get fresh zoom level from store to avoid stale closure
      const currentZoomLevel = useEditorStore.getState().viewer.zoomLevel;
      const finalScale = baseScale * currentZoomLevel;

      console.log(`🔍 Page ${pageNumber} scale calculation:`, { 
        containerWidth, 
        baseScale, 
        zoomLevelFromProps: viewer.zoomLevel, 
        currentZoomLevelFromStore: currentZoomLevel, 
        finalScale 
      });

      // Store scale factor for coordinate conversion
      setScaleFactors(prev => new Map(prev.set(pageNumber, finalScale)));

      const scaledViewport = page.getViewport({ scale: finalScale });

      // Set canvas dimensions with proper device pixel ratio handling
      const devicePixelRatio = window.devicePixelRatio || 1;
      canvas.width = scaledViewport.width * devicePixelRatio;
      canvas.height = scaledViewport.height * devicePixelRatio;
      canvas.style.width = `${scaledViewport.width}px`;
      canvas.style.height = `${scaledViewport.height}px`;
      
      // Scale context for device pixel ratio
      context.scale(devicePixelRatio, devicePixelRatio);

      // Set page container size for proper tag positioning
      pageContainer.style.width = `${scaledViewport.width}px`;
      pageContainer.style.height = `${scaledViewport.height}px`;

      console.log(`🎨 Canvas ${pageNumber} dimensions set:`, { width: scaledViewport.width, height: scaledViewport.height, devicePixelRatio });

      // Render page with high quality and proper scaling
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
        intent: 'display',
        enableWebGL: false, // Disable WebGL to prevent conflicts
        renderInteractiveForms: false // Disable forms to improve performance
      };

      // Final mount check before rendering
      if (!isMountedRef.current) return;
      
      // Create and track render task with timeout protection
      const renderTask = page.render(renderContext);
      renderTasksRef.current.set(pageNumber, renderTask);
      
      // Add timeout to prevent hanging renders
      const renderPromise = Promise.race([
        renderTask.promise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Render timeout')), 10000)
        )
      ]);
      
      await renderPromise;
      
      // Check mount status after render completes
      if (!isMountedRef.current) return;
      
      // Remove from tracking after successful render
      renderTasksRef.current.delete(pageNumber);
      
      setRenderedPages(prev => new Set(prev.add(pageNumber)));
      onPageLoad?.(pageNumber, canvas, finalScale);
      
      console.log(`✅ Page ${pageNumber} rendered successfully`);
      
    } catch (err: any) {
      // Check if it was a cancellation
      if (err?.name === 'RenderingCancelledException') {
        console.log(`🛑 Page ${pageNumber} rendering was cancelled`);
      } else if (err?.message === 'Render timeout') {
        console.warn(`⏰ Page ${pageNumber} rendering timed out`);
      } else {
        console.error(`❌ Error rendering page ${pageNumber}:`, err);
      }
      // Remove from rendered set so it can be retried
      setRenderedPages(prev => {
        const newSet = new Set(prev);
        newSet.delete(pageNumber);
        return newSet;
      });
      // Clean up from tracking
      renderTasksRef.current.delete(pageNumber);
    }
  }, [pdfDoc, isMountedRef, containerRef, setScaleFactors, viewer.zoomLevel]);

  // Scroll to tag functionality (placed after renderPage)
  const scrollToTag = useCallback(async (tagId: string, pageNumber: number) => {
    pendingScrollTagRef.current = tagId;
    console.log('📍 PDFViewer scrollToTag called:', { tagId, pageNumber, tagsCount: tags.length });

    const container = containerRef.current;
    if (!container || !pdfDoc) {
      console.warn('📍 scrollToTag aborted: missing container or pdfDoc', { containerExists: !!container, pdfDoc: !!pdfDoc });
      return;
    }

    // Support both non-text tags (in tags[]) and text tags (in textInputs[])
    const tagObj = tags.find(t => t.id === tagId);
    const textInputObj = tagObj ? null : (textInputs?.find(ti => ti.id === tagId) || null);

    if (!tagObj && !textInputObj) {
      console.warn('📍 scrollToTag: no matching tag or text input for id:', tagId);
      return;
    }

    const coords = (tagObj ? tagObj.coordinates : (textInputObj as any).coordinates) as {
      x: number; y: number; width?: number; height?: number; pageNumber: number;
    };

    // Ensure target page is rendered and scale factor is known
    if (!renderedPages.has(pageNumber)) {
      try {
        const containerWidth = (containerRef.current?.clientWidth || 800) - 120;
        for (let i = 1; i <= pageNumber; i++) {
          const pageContainer = pageContainerRefs.current[i - 1];
          if (pageContainer && (!pageContainer.style.height || pageContainer.style.height === '0px')) {
            try {
              const page = await pdfDoc.getPage(i);
              const viewport = page.getViewport({ scale: 1 });
              const baseScale = Math.min(containerWidth / viewport.width, 1.0);
              const scaledViewport = page.getViewport({ scale: baseScale * useEditorStore.getState().viewer.zoomLevel });
              pageContainer.style.width = `${scaledViewport.width}px`;
              pageContainer.style.height = `${scaledViewport.height}px`;
            } catch {}
          }
          if (pendingScrollTagRef.current !== tagId) return;
        }
        await renderPage(pageNumber, false);
      } catch (e) {
        console.warn('⚠️ Failed to pre-render page before scroll:', pageNumber, e);
      }
    }

    await new Promise(r => setTimeout(r, 10));
    if (pendingScrollTagRef.current !== tagId) return;

    try { useEditorStore.getState().setCurrentPage(pageNumber); } catch {}

    const pageContainer = pageContainerRefs.current[pageNumber - 1];
    if (pageContainer) {
      const scrollContainer = containerRef.current as HTMLDivElement;
      const finalScale = scaleFactors.get(pageNumber) || 1;
      const totalScale = finalScale;

      const fallbackDims = getTagDimensions(tagObj ? (tagObj as any).tagType : 'T' as any);
      const tagX = coords.x * totalScale;
      const tagY = coords.y * totalScale;
      const tagWidth = ((coords.width ?? fallbackDims.width) * totalScale) || 0;
      const tagHeight = ((coords.height ?? fallbackDims.height) * totalScale) || 0;

      const containerRect = scrollContainer.getBoundingClientRect();
      const pageRect = pageContainer.getBoundingClientRect();
      const pageTop = pageRect.top - containerRect.top + scrollContainer.scrollTop;
      const pageLeft = pageRect.left - containerRect.left + scrollContainer.scrollLeft;
      const tagAbsoluteY = pageTop + tagY;
      const tagAbsoluteX = pageLeft + tagX;
      const scrollTop = Math.max(0, tagAbsoluteY - (scrollContainer.clientHeight / 2) + (tagHeight / 2));
      const scrollLeft = Math.max(0, tagAbsoluteX - (scrollContainer.clientWidth / 2) + (tagWidth / 2));

      if (pendingScrollTagRef.current !== tagId) return;
      scrollContainer.scrollTo({ top: scrollTop, left: scrollLeft, behavior: 'smooth' });

      setTimeout(() => {
        if (pendingScrollTagRef.current === tagId) {
          onScrollToTag?.(tagId, pageNumber);
        }
      }, 150);
    } else {
      console.warn('📍 Page container not found for page:', pageNumber);
    }
  }, [tags, textInputs, onScrollToTag, viewer.zoomLevel, scaleFactors, renderedPages, pdfDoc, renderPage]);

  // Load PDF on URL change with smart debouncing for rapid document switching
  useEffect(() => {
    console.log('🔗 Document URL effect triggered:', { documentUrl, hasUrl: !!documentUrl });
    
    // Clear any pending document switch timeout
    if (documentSwitchTimeoutRef.current) {
      clearTimeout(documentSwitchTimeoutRef.current);
    }
    
    if (documentUrl) {
      // Use a shorter delay for more responsive switching
      documentSwitchTimeoutRef.current = setTimeout(() => {
        loadPDF(documentUrl);
      }, 50);
    } else {
      // If no document URL, clear the current state
      console.log('🧹 No document URL - clearing PDF state');
      setPdfDoc(null);
      setRenderedPages(new Set());
      setScaleFactors(new Map());
      setLoading(false);
      setError(null);
      currentDocumentUrlRef.current = null;
      isLoadingRef.current = false;
    }
    
    return () => {
      console.log('🧹 PDFViewer cleanup triggered for document switch');
      
      // Clear the document switch timeout
      if (documentSwitchTimeoutRef.current) {
        clearTimeout(documentSwitchTimeoutRef.current);
      }
      
      // Only do aggressive cleanup on component unmount, not on document switch
      // This is detected by checking if we're switching to a different document
      const isComponentUnmount = !isMountedRef.current;
      
      if (isComponentUnmount) {
        console.log('🗑️ Component unmounting - performing full cleanup');
        
        // Cancel all active render tasks
        renderTasksRef.current.forEach((task, pageNumber) => {
          if (task && typeof task.cancel === 'function') {
            try {
              task.cancel();
              console.log(`🚫 Cancelled render task for page ${pageNumber} on unmount`);
            } catch (e) {
              // Ignore cancellation errors
            }
          }
        });
        renderTasksRef.current.clear();
        
        // Destroy PDF loading task
        if (loadingTaskRef.current) {
          try {
            loadingTaskRef.current.destroy();
            console.log('🗑️ PDF loading task destroyed on unmount');
          } catch (e) {
            console.warn('⚠️ Error destroying PDF loading task:', e);
          }
        }
        
        // Reset loading state
        isLoadingRef.current = false;
        currentDocumentUrlRef.current = null;
      }
    };
  }, [documentUrl]);

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      console.log('🧹 PDFViewer component unmounting');
      isMountedRef.current = false;
    };
  }, []);

  // Initial page rendering when PDF loads (OPTIMIZED with proper container timing)
  useEffect(() => {
    if (!pdfDoc) {
      console.log('⏳ Waiting for PDF document to load...');
      return;
    }
    
    console.log('📖 PDF loaded, starting initial page rendering...', { 
      numPages: pdfDoc.numPages, 
      renderedPagesCount: renderedPages.size 
    });
    
    const renderInitialPages = async () => {
      // Check if component is still mounted
      if (!isMountedRef.current) return;
      
      // Wait for container to have proper dimensions
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts && isMountedRef.current) {
        const containerWidth = containerRef.current?.clientWidth;
        if (containerWidth && containerWidth > 100) {
          console.log(`✅ Container ready with width: ${containerWidth}px`);
          break;
        }
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 50));
        console.log(`⏳ Waiting for container dimensions, attempt ${attempts}`);
      }
      
      // Final mount check before rendering
      if (!isMountedRef.current) return;
      
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
      
      // Check mount status after parallel rendering
      if (!isMountedRef.current) return;
      
      console.log(`✅ Initial ${pagesToRender} pages rendered in parallel`);
      
      // Render remaining pages in background (if any)
      if (pdfDoc.numPages > pagesToRender && isMountedRef.current) {
        setTimeout(async () => {
          for (let i = pagesToRender + 1; i <= Math.min(5, pdfDoc.numPages); i++) {
            // Check mount status before each background render
            if (!isMountedRef.current) break;
            
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
  }, [pdfDoc]);

  // Ensure deep-page jump works: render target page before scrolling
  useEffect(() => {
    const run = async () => {
      if ((window as any).__DEBUG_EDITOR__) {
        console.log('📍 Deep-page jump effect triggered:', { highlightedTagId, pdfDoc: !!pdfDoc });
      }
      if (!highlightedTagId || !pdfDoc) return;
      // Avoid re-triggering scroll for the same tag while highlight is active
      if (lastJumpedTagIdRef.current === highlightedTagId) {
        return;
      }
      lastJumpedTagIdRef.current = highlightedTagId;

      // Try non-text tags first, then fall back to text inputs
      const tag = tags.find(t => t.id === highlightedTagId) || null;
      const textInput = tag ? null : (textInputs?.find(ti => ti.id === highlightedTagId) || null);
      if (!tag && !textInput) {
        console.warn('📍 Deep-page jump: no matching tag or text input:', highlightedTagId);
        return;
      }

      const pageNumber = (tag ? tag.coordinates.pageNumber : (textInput as any).coordinates.pageNumber) as number;

      console.log('📍 Deep-page jump processing target:', {
        id: highlightedTagId,
        pageNumber,
        source: tag ? 'tag' : 'textInput'
      });

      // If target page not rendered yet, render it now
      if (!renderedPages.has(pageNumber)) {
        console.log('📍 Pre-rendering page:', pageNumber);
        try {
          // Pre-size placeholders for all pages up to target so layout/offsetTop is correct
          const containerWidth = (containerRef.current?.clientWidth || 800) - 120;
          for (let i = 1; i <= pageNumber; i++) {
            const pageContainer = pageContainerRefs.current[i - 1];
            if (pageContainer && (!pageContainer.style.height || pageContainer.style.height === '0px')) {
              try {
                const page = await pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: 1 });
                const baseScale = Math.min(containerWidth / viewport.width, 1.0);
                const scaledViewport = page.getViewport({ scale: baseScale * useEditorStore.getState().viewer.zoomLevel });
                pageContainer.style.width = `${scaledViewport.width}px`;
                pageContainer.style.height = `${scaledViewport.height}px`;
              } catch (e) {
                // Ignore placeholder sizing errors for specific pages
              }
            }
          }
          // Finally render the target page so it has an accurate height and bitmap
          await renderPage(pageNumber, false);
          console.log('📍 Page pre-rendered successfully:', pageNumber);
        } catch (e) {
          console.warn('Failed to pre-render target page', pageNumber, e);
        }
      }

      console.log('📍 About to scroll to target coordinates');
      // Wait a tick for refs to update
      await new Promise(resolve => setTimeout(resolve, 10));
      const pageContainer = pageContainerRefs.current[pageNumber - 1];
      const scrollContainer = containerRef.current;
      if (pageContainer && scrollContainer) {
        setCurrentPage(pageNumber);
        // Use the centralized scrollToTag logic to compute exact position and center the tag
        await new Promise(r => setTimeout(r, 10));
        scrollToTag(highlightedTagId, pageNumber);
      } else {
        console.warn('📍 Deep-page jump: missing containers', {
          pageContainer: !!pageContainer,
          scrollContainer: !!scrollContainer
        });
      }
    };
    run();
  }, [highlightedTagId, pdfDoc, renderedPages, tags, textInputs, setCurrentPage]);

  // Reset the dedupe flag once highlight clears so future jumps work
  useEffect(() => {
    if (!highlightedTagId) {
      lastJumpedTagIdRef.current = null;
    }
  }, [highlightedTagId]);

  // Re-render pages on zoom change with debouncing
  useEffect(() => {
    if (!pdfDoc) return;
    
    console.log('🔄 Zoom changed to', viewer.zoomLevel, 're-rendering all pages...');
    
    // Debounce rapid zoom changes to prevent canvas conflicts
    const timeoutId = setTimeout(async () => {
      // Cancel all existing render tasks before starting new ones
      renderTasksRef.current.forEach((task, pageNumber) => {
        if (task && typeof task.cancel === 'function') {
          try {
            task.cancel();
            console.log(`🚫 Cancelled render task for page ${pageNumber} due to zoom change`);
          } catch (e) {
            // Ignore cancellation errors
          }
        }
      });
      renderTasksRef.current.clear();
      
      // Reset rendered pages state
      setRenderedPages(new Set());
      setScaleFactors(new Map());

      // Small delay to ensure all cancellations are processed
      await new Promise(resolve => setTimeout(resolve, 50));

      // Render pages sequentially to avoid concurrent canvas operations
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        try {
          await renderPage(i, true); // Force render on zoom change
        } catch (error) {
          console.error(`Failed to render page ${i} during zoom:`, error);
        }
      }
      console.log('✅ All pages re-rendered after zoom change');
    }, 150); // 150ms debounce

    return () => clearTimeout(timeoutId);
  }, [pdfDoc, viewer.zoomLevel]);

  // Log component state changes (debounced to prevent spam)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if ((window as any).__DEBUG_EDITOR__) {
        console.log('📊 PDFViewer state update:', {
          zoomLevel: viewer.zoomLevel,
          currentPage: viewer.currentPage,
          pageCount: pdfDoc?.numPages,
          selectedTagType
        });
      }
    }, 500);
    
    return () => clearTimeout(timeout);
  }, [viewer.zoomLevel, pdfDoc, renderedPages.size, selectedTagType]);

  // Monitor zoom level changes
  useEffect(() => {
    console.log('🔍 Zoom level changed to:', viewer.zoomLevel, '(' + Math.round(viewer.zoomLevel * 100) + '%)');
  }, [viewer.zoomLevel]);

  // Handle canvas clicks for tag placement - SIGNER RESTRICTIONS
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('🖱️ Canvas clicked:', {
      mode,
      canEditTags,
      hasOnCoordinateClick: !!onCoordinateClick,
      editorMode: editorMode,
      editorModeCanPlaceTags: editorMode.canPlaceTags,
      calculationBreakdown: {
        canPlaceTagsFromStore: editorMode.canPlaceTags,
        modeCheck: mode === 'tagging' || mode === 'signing',
        finalCanEditTags: editorMode.canPlaceTags && (mode === 'tagging' || mode === 'signing')
      },
      // Add immediate click position logging
      clickPosition: {
        clientX: event.clientX,
        clientY: event.clientY,
        target: event.currentTarget.tagName,
        targetId: event.currentTarget.id,
        targetClassName: event.currentTarget.className
      }
    });
    
    // ❌ SIGNERS CANNOT PLACE NEW TAGS - Only notary/admin can click canvas to place tags
    if (!canEditTags || !onCoordinateClick) {
      console.log('❌ Canvas click blocked - signers cannot place new tags:', {
        canEditTags,
        hasOnCoordinateClick: !!onCoordinateClick,
        mode
      });
      return;
    }

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
    
    // Get appropriate dimensions based on selected tag type using store
    const { selectedTagType, getTagDimensions } = useEditorStore.getState();
      
    if (!selectedTagType) {
      console.error('No tag type selected for placement');
      return;
    }
    
    const dimensions = getTagDimensions(selectedTagType);
    
    if (!dimensions) {
      console.error('Could not get dimensions for tag type:', selectedTagType);
      return;
    }
    
    // Adjust positioning based on tag type for better placement
    let finalTagX: number;
    let finalTagY: number;
    
    // Position tag with bottom-left corner at mouse click for better UX
    // This means we need to offset the Y coordinate by the tag height
    finalTagX = Math.max(0, Math.round(pdfX));
    finalTagY = Math.max(0, Math.round(pdfY - dimensions.height));
    
    // Debug: Log the exact coordinates being sent
    console.log('🎯 TAG PLACEMENT DEBUG:', {
      mousePosition: { x: event.clientX, y: event.clientY },
      canvasPosition: { x: canvasX, y: canvasY },
      pdfPosition: { x: pdfX, y: pdfY },
      finalPosition: { x: finalTagX, y: finalTagY },
      tagDimensions: dimensions,
      selectedTagType,
      offsetApplied: { x: 0, y: -dimensions.height },
      note: 'Tag positioned with bottom-left corner at mouse click'
    });
    
    // Add visual indicator at click position for debugging
    const indicator = document.createElement('div');
    indicator.style.position = 'absolute';
    indicator.style.left = `${event.clientX - 5}px`;
    indicator.style.top = `${event.clientY - 5}px`;
    indicator.style.width = '10px';
    indicator.style.height = '10px';
    indicator.style.backgroundColor = 'red';
    indicator.style.borderRadius = '50%';
    indicator.style.zIndex = '9999';
    indicator.style.pointerEvents = 'none';
    document.body.appendChild(indicator);
    
    // Remove indicator after 3 seconds
    setTimeout(() => {
      if (document.body.contains(indicator)) {
        document.body.removeChild(indicator);
      }
    }, 3000);
    
    const coordinates: TagCoordinates = {
      x: finalTagX,
      y: finalTagY, // Positioned so bottom-left corner is at mouse click
      width: dimensions.width,
      height: dimensions.height,
      pageNumber
    };

    onCoordinateClick(coordinates);
  }, [canEditTags, onCoordinateClick, scaleFactors, selectedTagType]);

  // Handle scroll tracking
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    setScrollTop(container.scrollTop);

    // Use bounding rects to compute nearest page to the container's visible center
    const containerRect = container.getBoundingClientRect();
    const viewportCenter = (containerRect.top + containerRect.bottom) / 2;

    let nearestPage = viewer.currentPage || 1;
    let minDistance = Infinity;
    const pageContainers = pageContainerRefs.current;

    for (let i = 0; i < pageContainers.length; i++) {
      const pageContainer = pageContainers[i];
      if (!pageContainer) continue;

      const rect = pageContainer.getBoundingClientRect();

      // Skip if not intersecting the scroll container viewport
      const isVisible = rect.bottom > containerRect.top && rect.top < containerRect.bottom;
      if (!isVisible) continue;

      const pageCenter = (rect.top + rect.bottom) / 2;
      const distance = Math.abs(pageCenter - viewportCenter);

      if (distance < minDistance) {
        minDistance = distance;
        nearestPage = i + 1;
      }
    }

    if (nearestPage !== viewer.currentPage) {
      setCurrentPage(nearestPage);
      console.log(`📍 Page updated to: ${nearestPage} (Δ=${minDistance.toFixed(1)}px)`);
    }
  }, [viewer.currentPage, setCurrentPage, setScrollTop]);

  // Tag event handlers
  const handleTagUpdate = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    // Update local state immediately for responsive UI
    onTagUpdate?.(tagId, coordinates);
    
    // 🚀 REAL-TIME SYNC: Broadcast tag update via WebSocket
    if (webSocket && webSocket.isConnected && webSocket.isReady) {
      if ((window as any).__DEBUG_EDITOR__) {
        console.log('📡 Broadcasting tag update via WebSocket:', {
          tagId,
          coordinates
        });
      }
      
      try {
        webSocket.sendMessage({
          type: 'tag_updated',
          payload: {
            tagId,
            // Use a consistent shape expected by receivers
            updates: { coordinates },
            page: (coordinates as any).pageNumber || 1
          }
        });
      } catch (error) {
        console.error('❌ Failed to send tag update via WebSocket:', error);
      }
    } else {
      if ((window as any).__DEBUG_EDITOR__) {
        console.warn('⚠️ WebSocket not available for tag update broadcast, state:', webSocket?.readyState);
      }
    }
  }, [onTagUpdate, webSocket, sessionId]);

  // ✅ ENHANCED: Save tag changes locally and broadcast via WebSocket
  const broadcastTagSave = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    // First, update the tag locally and save to backend
    if (onTagUpdate) {
      if ((window as any).__DEBUG_EDITOR__) {
        console.log('💾 Updating tag position locally:', { tagId, coordinates });
      }
      onTagUpdate(tagId, coordinates);
    }
    
    // Also save to server - this is what was missing!
    if (onTagResize) {
      if ((window as any).__DEBUG_EDITOR__) {
        console.log('🚀 Saving tag coordinates to server:', { tagId, coordinates });
      }
      onTagResize(tagId, coordinates as TagCoordinates);
    }

    // Then broadcast via WebSocket for real-time collaboration
    if (webSocket?.isConnected && webSocket?.isReady) {
      // Find the tag to get its full coordinates if needed
      const tag = tags?.find(t => t.id === tagId);
      const fullCoordinates = {
        x: coordinates.x ?? tag?.coordinates.x ?? 0,
        y: coordinates.y ?? tag?.coordinates.y ?? 0,
        width: coordinates.width ?? tag?.coordinates.width ?? 100,
        height: coordinates.height ?? tag?.coordinates.height ?? 50,
        pageNumber: (coordinates as any).pageNumber ?? tag?.coordinates.pageNumber ?? 1
      };

      if ((window as any).__DEBUG_EDITOR__) {
        console.log('📡 Broadcasting tag save via WebSocket:', {
          tagId,
          coordinates: fullCoordinates
        });
      }
      
      try {
        webSocket.sendMessage({
          type: 'tag_saved',
          payload: {
            tagId,
            // Use the same 'updates' envelope for consistency
            updates: { coordinates: fullCoordinates },
            page: fullCoordinates.pageNumber || 1
          }
        });
      } catch (error) {
        console.error('❌ Failed to broadcast tag save via WebSocket:', error);
      }
    } else {
      if ((window as any).__DEBUG_EDITOR__) {
        console.warn('⚠️ WebSocket not available for tag save broadcast, state:', webSocket?.readyState);
      }
    }
  }, [onTagUpdate, onTagResize, webSocket, sessionId, tags]);

  const handleTagDelete = useCallback((tagId: string) => {
    onTagDelete?.(tagId);
  }, [onTagDelete]);

  const handleTagSelect = useCallback((tag: DocumentTag) => {
    console.log('🎯 handleTagSelect called for tag:', tag.id, tag.tagType, 'current selected:', selectedTag?.id);
    // Always select the tag, never deselect
    selectTag(tag);
  }, [selectTag, selectedTag]);

  // ✅ CLEANED UP: Whiteout overlay functions removed - whiteout tags now use regular tag system

  // ✅ NEW: WebSocket message handler for real-time updates
  useEffect(() => {
    if (!webSocket) return;
    
    // Type assertion to access WebSocketConnection properties
    const wsConnection = webSocket as WebSocketConnection;
    
    // Check WebSocket connection state using the hook's connection state
    if (!wsConnection.isConnected || !wsConnection.isReady) {
      console.log('🔌 WebSocket not ready yet, waiting for connection...', {
        exists: !!webSocket,
        isConnected: wsConnection.isConnected,
        isConnecting: wsConnection.isConnecting,
        isReady: wsConnection.isReady,
        readyState: wsConnection.readyState,
        nativeStates: {
          CONNECTING: WebSocket.CONNECTING,
          OPEN: WebSocket.OPEN,
          CLOSING: WebSocket.CLOSING,
          CLOSED: WebSocket.CLOSED
        }
      });
      return;
    }
    
    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        console.log('📡 Received WebSocket message in PDFViewer:', message);
        
        switch (message.type) {
          case 'tag_updated':
          case 'tag_saved': {
            // Update tag position/size from other users (including whiteout tags)
            const tagId = message.payload?.tagId;
            // Accept both shapes: payload.updates.coordinates or payload.coordinates
            const coords = message.payload?.updates?.coordinates
              ?? message.payload?.coordinates
              ?? message.payload?.updates;
            if (tagId && coords && onTagUpdate) {
              console.log('📝 Updating tag from WebSocket:', { tagId, coords });
              onTagUpdate(tagId, coords);
            }
            break;
          }
        }
      } catch (error) {
        console.error('❌ Error processing WebSocket message in PDFViewer:', error);
      }
    };
    
    // Add WebSocket event listeners using the raw WebSocket instance
    const rawWebSocket = wsConnection.webSocketInstance;
    if (rawWebSocket) {
      rawWebSocket.addEventListener('message', handleWebSocketMessage);
      
      // Add connection state monitoring
      const handleWebSocketError = (error: Event) => {
        console.error('❌ WebSocket error in PDFViewer:', error);
      };
      
      const handleWebSocketClose = (event: CloseEvent) => {
        console.warn('⚠️ WebSocket closed in PDFViewer:', event.code, event.reason);
      };
      
      const handleWebSocketOpen = (event: Event) => {
        console.log('✅ WebSocket connected in PDFViewer');
      };
      
      rawWebSocket.addEventListener('error', handleWebSocketError);
      rawWebSocket.addEventListener('close', handleWebSocketClose);
      rawWebSocket.addEventListener('open', handleWebSocketOpen);
      
      return () => {
        rawWebSocket.removeEventListener('message', handleWebSocketMessage);
        rawWebSocket.removeEventListener('error', handleWebSocketError);
        rawWebSocket.removeEventListener('close', handleWebSocketClose);  
        rawWebSocket.removeEventListener('open', handleWebSocketOpen);
      };
    }
  }, [webSocket]);

  // React to programmatic scroll requests (e.g., notary sync)
  useEffect(() => {
    const run = async () => {
      const targetPage = viewer.pendingScrollToPage;
      if (!pdfDoc || !targetPage || targetPage < 1 || targetPage > (pdfDoc?.numPages || 0)) {
        return;
      }

      try {
        // Ensure target page is rendered for accurate scrolling
        if (!renderedPages.has(targetPage)) {
          // Pre-size placeholders up to target page for correct offsets
          const containerWidth = (containerRef.current?.clientWidth || 800) - 120;
          for (let i = 1; i <= targetPage; i++) {
            const pageContainer = pageContainerRefs.current[i - 1];
            if (pageContainer && (!pageContainer.style.height || pageContainer.style.height === '0px')) {
              try {
                const page = await pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: 1 });
                const baseScale = Math.min(containerWidth / viewport.width, 1.0);
                const scaledViewport = page.getViewport({ scale: baseScale * useEditorStore.getState().viewer.zoomLevel });
                pageContainer.style.width = `${scaledViewport.width}px`;
                pageContainer.style.height = `${scaledViewport.height}px`;
              } catch {
                // Ignore placeholder sizing errors
              }
            }
          }
          await renderPage(targetPage, false);
        }

        // Wait a tick for DOM to settle
        await new Promise((r) => setTimeout(r, 10));

        const scrollContainer = containerRef.current;
        const pageContainer = pageContainerRefs.current[targetPage - 1];
        if (scrollContainer && pageContainer) {
          const containerRect = scrollContainer.getBoundingClientRect();
          const pageRect = pageContainer.getBoundingClientRect();
          const pageTop = pageRect.top - containerRect.top + scrollContainer.scrollTop;

          // Center the page in the viewport vertically
          const scrollTop = Math.max(0, pageTop - (scrollContainer.clientHeight - pageRect.height) / 2);
          scrollContainer.scrollTo({ top: scrollTop, behavior: 'smooth' });

          // Mark page as current and clear pending flag
          setCurrentPage(targetPage);
        }
      } catch (e) {
        console.warn('Failed to programmatically scroll to page', targetPage, e);
      }
    };

    run();
  }, [viewer.pendingScrollToPage, pdfDoc, renderedPages, renderPage, setCurrentPage]);

  // Load PDF document with improved error handling and redirect support
  const loadPDF = useCallback(async (url: string) => {
    // Extract document ID from URL for more accurate comparison
    const getDocumentIdFromUrl = (u: string) => {
      const match = u.match(/\/documents\/(\d+)\/preview/);
      return match ? match[1] : u;
    };

    const documentId = getDocumentIdFromUrl(url);
    const currentDocumentId = currentDocumentUrlRef.current ? getDocumentIdFromUrl(currentDocumentUrlRef.current) : null;

    if (currentDocumentId === documentId && !error && pdfDoc && !loading) {
      console.log('📄 Skipping load - same document already loaded:', documentId);
      return;
    }
    if (isLoadingRef.current && currentDocumentId === documentId) {
      console.log('📄 Skipping load - already loading this document:', documentId);
      return;
    }

    try {
      console.log('📄 Starting PDF load for document:', documentId, 'URL:', url);
      isLoadingRef.current = true;
      setLoading(true);
      setError(null);

      if (currentDocumentId !== documentId) {
        // Cancel all active render tasks
        renderTasksRef.current.forEach((task, pageNumber) => {
          if (task && typeof task.cancel === 'function') {
            try { task.cancel(); } catch {}
          }
        });
        renderTasksRef.current.clear();
        canvasRefs.current = [];
        setPdfDoc(null);
        setRenderedPages(new Set());
        setScaleFactors(new Map());
        setLoading(true);
      }

      if (!isPDFWorkerReady()) {
        initializePDFWorker();
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (loadingTaskRef.current && currentDocumentId !== documentId) {
        try { loadingTaskRef.current.destroy(); } catch {}
        loadingTaskRef.current = null;
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      currentDocumentUrlRef.current = url;

      // Fetch PDF as ArrayBuffer
      const token = localStorage.getItem('token');
      const fetchUrl = url.includes('{{TOKEN}}') ? url.replace('{{TOKEN}}', token || '') : url;
      const response = await fetch(fetchUrl, { headers: { 'Authorization': `Bearer ${token}` }, credentials: 'same-origin' });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText || 'Failed to fetch PDF'}`);
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json') || contentType.includes('text/html')) {
        throw new Error('Server returned non-PDF content while fetching document');
      }
      const pdfData = await response.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({ data: pdfData, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true, verbosity: 0, cMapPacked: true });
      loadingTaskRef.current = loadingTask;
      const pdf = await loadingTask.promise;
      if (!isMountedRef.current) return;

      setPdfDoc(pdf);
      setRenderedPages(new Set());
      setScaleFactors(new Map());
      useEditorStore.setState(state => ({ viewer: { ...state.viewer, totalPages: pdf.numPages, currentPage: 1, scrollTop: 0 } }));
      setLoading(false);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load PDF');
      setLoading(false);
    } finally {
      isLoadingRef.current = false;
    }
  }, [error, pdfDoc, loading]);

  // Debounced font size updates to prevent API spam during drag
  const debouncedTagFontSizeUpdates = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Function to update tag font size with immediate local update + debounced server sync
  const updateTagFontSize = useCallback(async (tagId: string, fontSize: number) => {
    try {
      // Immediate local update for better UX
      setLocalFontSizes(prev => {
        const next = new Map(prev);
        next.set(tagId, fontSize);
        return next;
      });

      // Debounce server sync
      const existingTimeout = debouncedTagFontSizeUpdates.current.get(tagId);
      if (existingTimeout) clearTimeout(existingTimeout);

      const timeout = setTimeout(async () => {
        try {
          const response = await fetch(`/api/editor/session/${sessionId}/tag/${tagId}/font-size`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ fontSize })
          });
          if (!response.ok) throw new Error('Failed to update font size');
          debouncedTagFontSizeUpdates.current.delete(tagId);
        } catch (err) {
          console.error('❌ Failed to update tag font size on server:', err);
        }
      }, 350);

      debouncedTagFontSizeUpdates.current.set(tagId, timeout);
    } catch (err) {
      console.error('❌ Failed to setup tag font size update:', err);
    }
  }, [sessionId]);

  // Cleanup debounced font size updates on unmount
  useEffect(() => {
    return () => {
      debouncedTagFontSizeUpdates.current.forEach(t => clearTimeout(t));
      debouncedTagFontSizeUpdates.current.clear();
    };
  }, []);

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
          <div className="text-red-500 text-xl mb-4 font-bold">!</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
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
    <div className={`relative h-full flex flex-col ${className}`} style={{ maxWidth: '100%', overflow: 'hidden' }}>
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b shadow-sm relative z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1 relative z-10">
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔍 Zoom Out button clicked - current zoom:', viewer.zoomLevel);
                handleZoomOut();
              }} 
              className="p-2 bg-white border rounded hover:bg-gray-50 transition-colors shadow-sm cursor-pointer select-none"
              title="Zoom out"
              type="button"
              disabled={viewer.zoomLevel <= 0.25}
              style={{ 
                pointerEvents: 'auto',
                userSelect: 'none',
                fontSize: '16px',
                fontWeight: 'bold',
                lineHeight: '1',
                minWidth: '32px',
                minHeight: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              −
            </button>
            <span 
              className="min-w-16 text-center text-sm font-medium px-2 bg-yellow-100 border border-yellow-400 rounded select-none"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {Math.round(viewer.zoomLevel * 100)}%
            </span>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔍 Zoom In button clicked - current zoom:', viewer.zoomLevel);
                handleZoomIn();
              }} 
              className="p-2 bg-white border rounded hover:bg-gray-50 transition-colors shadow-sm cursor-pointer select-none"
              title="Zoom in"
              type="button"
              disabled={viewer.zoomLevel >= 3.0}
              style={{ 
                pointerEvents: 'auto',
                userSelect: 'none',
                fontSize: '16px',
                fontWeight: 'bold',
                lineHeight: '1',
                minWidth: '32px',
                minHeight: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              +
            </button>
          </div>
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🔍 Zoom Reset button clicked - current zoom:', viewer.zoomLevel);
              handleZoomReset();
            }} 
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors cursor-pointer select-none"
            title="Reset zoom to fit"
            type="button"
            style={{ 
              pointerEvents: 'auto',
              userSelect: 'none'
            }}
          >
            Fit to View
          </button>


                    {/* Font Size Control - Only show when a text tag is selected */}
          {(selectedTag || selectedTextInputId) && (
            // Show for any tag that allows text input
            selectedTag?.tagType === 'T' || selectedTag?.tagType === 'O' || selectedTag?.tagType === 'D' || 
            selectedTag?.tagType === 'A' || selectedTag?.tagType === 'N' || selectedTag?.tagType === 'X' ||
            selectedTextInputId
          ) && (
            console.log('🎨 Font control should show for tag:', selectedTag?.tagType, selectedTag?.id, 'textInputId:', selectedTextInputId),
            <div 
              className="flex items-center gap-2 bg-gray-100 rounded-lg p-1"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <label className="text-sm font-medium text-gray-700">Font:</label>
              <select
                value={currentFontSize}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value);
                  let targetId = '';
                  
                  if (selectedTag) {
                    targetId = selectedTag.id;
                    console.log('🎨 Changing font size for selected tag:', targetId, 'from', currentFontSize, 'to', newSize);
                  } else if (selectedTextInputId) {
                    const selectedTextInput = textInputs?.find(ti => ti.id === selectedTextInputId);
                    if (selectedTextInput) {
                      targetId = selectedTextInput.id;
                      console.log('🎨 Changing font size for selected text input:', targetId, 'from', currentFontSize, 'to', newSize);
                    }
                  }
                  
                  if (!targetId) {
                    console.log('❌ No target found for font size change');
                    return;
                  }
                  
                  setLastUsedFontSize(newSize);
                  
                  // Update local font size immediately for instant feedback
                  setLocalFontSizes(prev => {
                    const newMap = new Map(prev);
                    newMap.set(targetId, newSize);
                    return newMap;
                  });
                  
                  if (onFontSizeChange) {
                    console.log('🎨 Calling onFontSizeChange with:', targetId, newSize);
                    onFontSizeChange(targetId, newSize);
                  }
                }}
                className="px-2 py-1 bg-white border rounded text-sm font-medium min-w-16 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Select font size"
              >
                {Array.from({ length: 17 }, (_, i) => {
                  const size = 8 + (i * 2); // 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40
                  return (
                    <option key={size} value={size}>
                      {size}px
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-700 bg-gray-100 px-3 py-2 rounded-lg">
            📄 Page {viewer.currentPage} of {viewer.totalPages}
            {tags.length > 0 && <span className="ml-3 text-green-600">• {tags.length} tags</span>}
          </div>
          
          {/* Sync Button - Only for notaries in signing mode */}
          {mode === 'signing' && currentUser?.userType === 'notary' && onSyncUsers && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncUsers}
              disabled={isSyncLoading}
              className="px-3 text-xs"
              title={`Sync all users to page ${viewer.currentPage || 1}`}
            >
              {isSyncLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-1">Sync to p.{viewer.currentPage || 1}</span>
            </Button>
          )}
        </div>
      </div>

      {/* PDF Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-50 py-6 px-4"
        onScroll={handleScroll}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          e.preventDefault();
          console.log('🎯 Drop event detected');
          console.log('🎯 Drop coordinates:', { clientX: e.clientX, clientY: e.clientY });
          
          try {
            const dragData = e.dataTransfer.getData('application/json');
            console.log('🎯 Raw drag data:', dragData);
            
            if (dragData) {
              const dragInfo = JSON.parse(dragData);
              console.log('�� Drag data received:', dragInfo);
              
              // Text input drop handling removed
              console.log('📄 Drop data received but text input handling is disabled');
            } else {
              console.log('❌ No drag data found');
            }
          } catch (error) {
            console.error('❌ Error handling drop:', error);
          }
        }}
        style={{ 
          maxWidth: '100%',
          overflowX: 'auto',
          overflowY: 'auto'
        }}
      >
        {/* PDF Pages Container */}
        <div className="w-full flex flex-col items-center space-y-6" style={{ minWidth: 'min-content' }}>
          {Array.from({ length: pdfDoc.numPages }, (_, index) => {
            const pageNumber = index + 1;
            const pageTags = tags.filter(tag => tag.coordinates.pageNumber === pageNumber && tag.tagType !== 'T'); // ✅ FIXED: Exclude text tags to prevent dual rendering
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
                  style={{ 
                    display: 'inline-block',
                    maxWidth: '100%',
                    margin: '0 auto'
                  }}
                >
                  {/* PDF Canvas */}
                  <canvas
                    ref={el => { 
                      if (el && !canvasRefs.current[index]) {
                        canvasRefs.current[index] = el;
                        console.log(`🎯 Canvas ${pageNumber} created and ref set`);
                      }
                    }}
                    data-page-number={pageNumber}
                    onClick={handleCanvasClick}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      console.log('🎯 Drop event detected on canvas');
                      console.log('🎯 Canvas drop coordinates:', { clientX: e.clientX, clientY: e.clientY });
                      
                      try {
                        const dragData = e.dataTransfer.getData('application/json');
                        console.log('🎯 Canvas raw drag data:', dragData);
                        
                        if (dragData) {
                          const dragInfo = JSON.parse(dragData);
                          console.log('📄 Canvas drag data received:', dragInfo);
                          
                          // Text input drop handling removed from canvas
                          console.log('📄 Canvas drop data received but text input handling is disabled');
                        } else {
                          console.log('❌ No drag data found on canvas');
                        }
                      } catch (error) {
                        console.error('❌ Error handling drop on canvas:', error);
                      }
                    }}
                    className={`
                      block transition-all duration-200
                      ${mode === 'tagging' && canEditTags
                        ? selectedTagType
                          ? 'cursor-crosshair hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50' // Tag placement mode
                          : 'cursor-default' // Pointer mode
                        : mode === 'signing'
                        ? 'cursor-default'
                        : 'cursor-default'
                      }
                    `}
                    style={{ 
                      backgroundColor: '#ffffff', // Clean white background
                      minHeight: '600px' // Ensure clickable area exists even before render
                    }}
                  />
                  
                          {/* Tags overlay - Text tags are handled separately via textInputs */}
                  {pageTags.filter(tag => tag.tagType !== 'T').map(tag => {
                    return (
                      <div key={`${tag.id}-${scaleFactor}`} className={`absolute top-0 left-0 w-full h-full ${selectedTagType ? 'pointer-events-none' : 'pointer-events-auto'}`}>
                        <MemoizedTagRenderer
                          tag={tag}
                          scaleFactor={scaleFactor}
                          isSelected={selectedTag?.id === tag.id}
                          canEdit={canEditTags}
                          onUpdate={(coords) => handleTagUpdate(tag.id, coords)}
                          onSave={(coords) => broadcastTagSave(tag.id, coords)}
                          onDelete={() => handleTagDelete(tag.id)}
                          onSelect={() => handleTagSelect(tag)}
                          onTagClick={onTagClick}
                          mode={mode}
                          onFontSizeChange={updateTagFontSize}
                          localFontSize={localFontSizes.get(tag.id)}
                          isHighlighted={highlightedTagId === tag.id}
                          isMissing={incompleteTags.includes(tag.id)}
                        />
                      </div>
                    );
                  })}
                  
                  {/* Whiteout overlays disabled: handled via 'W' tags for consistency */}

                  {/* Text inputs overlay (separate from regular tags) - STABLE KEY */}
                  {textInputs?.filter(textInput => textInput.coordinates.pageNumber === pageNumber).map((textInput) => {
                    // Use ID-based key to remain stable across drag/resize; temp IDs remain consistent until server id is applied
                    const primaryKey = textInput.id ? `text-${textInput.id}` : `text-temp-${pageNumber}`;
                     
                     return (
                       <StreamlinedTextInput
                         key={primaryKey}
                         id={textInput.id}
                         coordinates={textInput.coordinates}
                         sessionId={sessionId || ''}
                         content={textInput.content}
                         fontSize={textInput.fontSize}
                         fontFamily={textInput.fontFamily}
                         textColor={textInput.textColor}
                         assignedUserId={textInput.assignedUserId}
                         userColor={textInput.userColor}
                         isNew={textInput.isNew}
                         isSelected={selectedTextInputId === textInput.id}
                         scaleFactor={scaleFactor}
                         onSave={(content) => {
                           onSaveTextContent?.(textInput.id, content);
                         }}
                         onDelete={() => {
                           onDeleteTextInput?.(textInput.id);
                         }}
                         onSelect={() => {
                           console.log('🎯 Text tag selected for resizing:', textInput.id);
                           onTextInputSelect?.(textInput.id);
                         }}
                         onMove={(newCoordinates) => {
                           if ((window as any).__DEBUG_EDITOR__) {
                             console.log('📍 Text input moved:', newCoordinates);
                           }
                           onMoveTextInput?.(textInput.id, newCoordinates);
                         }}
                         onResize={(newCoordinates) => {
                           // ✅ ENHANCED: Handle text tag resize with proper WebSocket sync
                           console.log('📏 Text tag resized - broadcasting update:', {
                             textInputId: textInput.id,
                             oldCoords: textInput.coordinates,
                             newCoords: newCoordinates
                           });

                           // Update coordinates using the text input specific function
                           onMoveTextInput?.(textInput.id, newCoordinates);

                           // 🚀 REAL-TIME SYNC: Broadcast text tag resize via WebSocket
                           if (webSocket && webSocket.isConnected && webSocket.isReady) {
                             const updateMessage = {
                               type: 'text_input_position_updated',
                               payload: {
                                 textInputId: textInput.id,
                                 coordinates: {
                                   x: newCoordinates.x,
                                   y: newCoordinates.y,
                                   width: newCoordinates.width,
                                   height: newCoordinates.height,
                                   pageNumber: textInput.coordinates.pageNumber
                                 },
                                 updatedBy: useEditorStore.getState().currentUser?.id,
                                 updatedByName: useEditorStore.getState().currentUser?.displayName
                               }
                             };
                             console.log('📡 Broadcasting text input change:', updateMessage);
                             webSocket.sendMessage(updateMessage as any);
                           }
                         }}
                         webSocket={webSocket?.webSocketInstance}
                       />
                     );
                   })}
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
