import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { Rnd } from 'react-rnd';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { DocumentTag, TagCoordinates } from '../../types/editor';
import { useToast } from '../../hooks/use-toast';
// DraggableTag not used - using Rnd directly
import { useDebouncedTagOperations } from '../../hooks/editor/useDebounced';
import { 
  getTagDimensions, 
  getTagStyle, 
  snapToGrid,
  PROFESSIONAL_COLORS,
  TYPOGRAPHY,
  TAG_TYPE_CONFIG 
} from '@/lib/constants/tagConstants';

interface TagRendererProps {
  tag: DocumentTag;
  isSelected: boolean;
  canEdit: boolean;
  scaleFactor: number;
  onSelect: () => void;
  onUpdate: (updates: { x: number; y: number }) => void;
  onDelete: () => void;
  onTagClick?: (tag: DocumentTag) => void;
}

interface TagLayerProps {
  documentId: string;
  pageNumber: number;
  canvasElement: HTMLCanvasElement;
  containerRef: React.RefObject<HTMLDivElement>;
  scaleFactor: number;
  mode: { mode: 'tagging' | 'notary' | 'signing'; canPlaceTags: boolean; showPlaceholders: boolean };
  onCoordinateClick?: (x: number, y: number, pageNumber: number) => void;
  liveSessionState?: {
    activeUserId?: number;
    state?: string;
  };
}

const TagRenderer: React.FC<TagRendererProps> = ({
  tag,
  isSelected,
  canEdit,
  scaleFactor,
  onSelect,
  onUpdate,
  onDelete,
  onTagClick
}) => {
  const { mode, selectedUser, currentUser, session, setActiveOperation, setDragActive } = useEditorStore();
  // 🚀 HIGH SPEED PERFORMANCE: Throttled drag updates for smooth fast movement
  const [isDragging, setIsDragging] = useState(false);
  const lastPositionRef = useRef({ x: 0, y: 0 });
  const dragThrottleRef = useRef(0);
  const lastDragTimeRef = useRef(0);
  
  // Use debounced operations hook
  const { debouncedPositionUpdate, debouncedNamePositionUpdate, debouncedInitialsPositionUpdate, debouncedDatePositionUpdate } = useDebouncedTagOperations(session?.id || '');
  
  // 🚀 HIGH SPEED: Throttled drag handler for smooth fast movement
  const throttledDragUpdate = useCallback((x: number, y: number) => {
    const now = performance.now();
    // Throttle to 16ms (60fps) for smooth high-speed movement
    if (now - lastDragTimeRef.current < 16) {
      return;
    }
    lastDragTimeRef.current = now;
    
    // Store throttled position for high-speed movement
    lastPositionRef.current = { x, y };
  }, []);
  
  // Check if current user can modify this tag
  const canModifyTag = canEdit && (
    currentUser?.userId === tag.assignedUserId ||
    currentUser?.role === 'notary' ||
    currentUser?.role === 'admin'
  )
  
  // Check if tag has content (should be transparent)
  const hasContent = tag.tagType === 'W' ? true : !!(tag.content || tag.contentData || tag.isCompleted);
  
  // Professional fixed dimensions - DocuSign style
  const fixedDimensions = getTagDimensions(tag.tagType);
  
  // 🚀 HIGH SPEED: Optimized coordinate calculations with caching
  const displayCoords = useMemo(() => {
    // For text tags, name tags, and initials tags, use exact coordinates to prevent visual glitches
    if (tag.tagType === 'T' || tag.tagType === 'A' || tag.tagType === 'I') {
      return {
        x: tag.coordinates.x * scaleFactor,
        y: tag.coordinates.y * scaleFactor,
        width: (tag.coordinates.width ?? fixedDimensions.width) * scaleFactor,
        height: (tag.coordinates.height ?? fixedDimensions.height) * scaleFactor
      };
    }
    
    // For other tags, use rounded coordinates
    return {
      x: Math.round(tag.coordinates.x * scaleFactor),
      y: Math.round(tag.coordinates.y * scaleFactor),
      width: Math.round((tag.coordinates.width ?? fixedDimensions.width) * scaleFactor),
      height: Math.round((tag.coordinates.height ?? fixedDimensions.height) * scaleFactor)
    };
  }, [tag.coordinates, scaleFactor, fixedDimensions, tag.tagType]);

  // 🚀 HIGH SPEED: Virtual position for smooth fast movement
  const [virtualPosition, setVirtualPosition] = useState(displayCoords);
  const virtualPositionRef = useRef(displayCoords);
  
  // Update virtual position for smooth high-speed movement
  useEffect(() => {
    if (isDragging) {
      // Use virtual position during drag for smooth movement
      virtualPositionRef.current = virtualPosition;
    } else {
      // Sync with real position when not dragging
      virtualPositionRef.current = displayCoords;
      setVirtualPosition(displayCoords);
    }
  }, [displayCoords, isDragging, virtualPosition]);
  
  // 🚀 HIGH SPEED: Use virtual position for smooth rendering during fast movement
  const finalCoords = isDragging ? virtualPosition : displayCoords;
  
  // Debug: Log the rendering coordinates
  console.log('🎨 TAG RENDERING DEBUG:', {
    tagType: tag.tagType,
    originalCoordinates: tag.coordinates,
    scaleFactor,
    displayCoords,
    fixedDimensions
  });
  
  // 🚀 HIGH SPEED: Initials-specific performance monitoring
  if (tag.tagType === 'I') {
    console.log('🔤 INITIALS TAG PERFORMANCE:', {
      tagId: tag.id,
      isDragging,
      virtualPosition,
      displayCoords,
      performance: {
        throttleTime: lastDragTimeRef.current,
        dragActive: isDragging,
        virtualPositionActive: virtualPosition !== displayCoords
      }
    });
  }
  
  // Add visual indicator for debugging tag position
  React.useEffect(() => {
    if (tag.tagType === 'T') {
      const indicator = document.createElement('div');
      indicator.style.position = 'absolute';
      indicator.style.left = `${displayCoords.x}px`;
      indicator.style.top = `${displayCoords.y + displayCoords.height}px`; // Show where bottom-left should be
      indicator.style.width = '8px';
      indicator.style.height = '8px';
      indicator.style.backgroundColor = 'blue';
      indicator.style.borderRadius = '50%';
      indicator.style.zIndex = '9998';
      indicator.style.pointerEvents = 'none';
      indicator.style.border = '2px solid white';
      document.body.appendChild(indicator);
      
      // Remove indicator after 2 seconds
      setTimeout(() => {
        if (document.body.contains(indicator)) {
          document.body.removeChild(indicator);
        }
      }, 2000);
    }
  }, [displayCoords.x, displayCoords.y, displayCoords.height, tag.tagType]);

  // 🚀 HIGH SPEED: Performance monitoring for fast movement
  const performanceRef = useRef({
    frameCount: 0,
    lastTime: 0,
    fps: 0,
    dragStartTime: 0,
    totalDragDistance: 0
  });

  // 🚀 HIGH SPEED: Monitor performance during fast movement
  useEffect(() => {
    if (isDragging) {
      const now = performance.now();
      performanceRef.current.frameCount++;
      
      if (now - performanceRef.current.lastTime >= 1000) {
        performanceRef.current.fps = performanceRef.current.frameCount;
        performanceRef.current.frameCount = 0;
        performanceRef.current.lastTime = now;
        
        // Log performance metrics for high-speed movement
        if (performanceRef.current.fps < 50) {
          console.warn(`⚠️ Low FPS during fast movement: ${performanceRef.current.fps}fps`);
        } else {
          console.log(`🚀 High-speed performance: ${performanceRef.current.fps}fps`);
        }
      }
    }
  }, [isDragging]);

  // 🚀 HIGH SPEED: Enhanced drag start with performance tracking
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    setDragActive(true);
    // Mark tag as being actively dragged to prevent server overrides
    setActiveOperation(tag.id, { type: 'drag', timestamp: Date.now() });
    
    // 🚀 HIGH SPEED: Start performance monitoring
    performanceRef.current.dragStartTime = performance.now();
    performanceRef.current.totalDragDistance = 0;
    
    console.log('🎯 Drag started for tag:', tag.id);
  }, [tag.id, setActiveOperation, setDragActive]);

  // Handle drag move - HIGH SPEED OPTIMIZED for smooth fast movement
  const handleDrag = useCallback((e: any, data: any) => {
    if (!canModifyTag) return;
    
    // 🚀 HIGH SPEED: Use throttled updates for smooth fast movement
    throttledDragUpdate(data.x, data.y);
    
    // 🚀 HIGH SPEED: Update virtual position for immediate visual feedback
    if (tag.tagType === 'A' || tag.tagType === 'T') {
      setVirtualPosition(prev => ({
        ...prev,
        x: data.x,
        y: data.y
      }));
    }
  }, [canModifyTag, throttledDragUpdate, tag.tagType]);

  // 🚀 HIGH SPEED: Enhanced drag stop with smooth settling
  const handleDragStop = useCallback((e: any, data: any) => {
    if (!canModifyTag || !session) return;
    
    setIsDragging(false);
    setDragActive(false);

    // Use exact position for precision
    const newPdfCoordinates = {
      x: data.x / scaleFactor,
      y: data.y / scaleFactor
    };
    
    console.log('✅ Tag drag completed:', {
      tagId: tag.id,
      newPosition: newPdfCoordinates
    });
    
    try {
      // Single update to global state
      onUpdate(newPdfCoordinates);
      
      // Use optimized name tag update if available
      if (tag.tagType === 'A' && debouncedNamePositionUpdate) {
        debouncedNamePositionUpdate(tag.id, {
          x: newPdfCoordinates.x,
          y: newPdfCoordinates.y,
          width: tag.coordinates.width ?? fixedDimensions.width,
          height: tag.coordinates.height ?? fixedDimensions.height,
          pageNumber: tag.coordinates.pageNumber || 1
        });
      }
      
      // 🚀 HIGH SPEED: Use optimized initials tag update if available
      if (tag.tagType === 'I' && debouncedInitialsPositionUpdate) {
        debouncedInitialsPositionUpdate(tag.id, {
          x: newPdfCoordinates.x,
          y: newPdfCoordinates.y,
          width: tag.coordinates.width ?? fixedDimensions.width,
          height: tag.coordinates.height ?? fixedDimensions.height,
          pageNumber: tag.coordinates.pageNumber || 1
        });
      }
      
      // 🚀 HIGH SPEED: Use optimized date tag update if available
      if (tag.tagType === 'D' && debouncedDatePositionUpdate) {
        debouncedDatePositionUpdate(tag.id, {
          x: newPdfCoordinates.x,
          y: newPdfCoordinates.y,
          width: tag.coordinates.width ?? fixedDimensions.width,
          height: tag.coordinates.height ?? fixedDimensions.height,
          pageNumber: tag.coordinates.pageNumber || 1
        });
      }
      
      // Clear active operation immediately
      setActiveOperation(tag.id, null);
      
      // 🚀 HIGH SPEED: Reset virtual position to real position
      setVirtualPosition(displayCoords);
      
    } catch (error) {
      console.error('❌ Failed to update tag position:', error);
      setActiveOperation(tag.id, null);
    }
  }, [canModifyTag, scaleFactor, onUpdate, session, tag.id, tag.tagType, tag.coordinates, fixedDimensions, debouncedNamePositionUpdate, debouncedInitialsPositionUpdate, debouncedDatePositionUpdate, setActiveOperation, setDragActive, displayCoords]);

  // Handle keyboard events for tag deletion
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete();
    }
  }, [onDelete]);

  // Professional styling based on tag state
  const professionalStyle = getTagStyle(tag.tagType, isSelected, hasContent, tag.colorCode);

  return (
    <Rnd
      size={{
        width: finalCoords.width,
        height: finalCoords.height
      }}
      position={{
        x: finalCoords.x,
        y: finalCoords.y
      }}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      disableDragging={!canModifyTag}
      enableResizing={canModifyTag && Boolean(TAG_TYPE_CONFIG[tag.tagType]?.allowResize)}
      // 🚀 HIGH SPEED: Ultra-smooth drag performance for fast movement
      dragGrid={tag.tagType === 'T' || tag.tagType === 'A' || tag.tagType === 'I' || tag.tagType === 'D' ? [0.5, 0.5] : [5, 5]} // 0.5px grid for ultra-smooth text tags, name tags, initials tags, and date tags
      dragMomentum={tag.tagType === 'T' || tag.tagType === 'A' || tag.tagType === 'I' || tag.tagType === 'D'} // Enable momentum for text tags, name tags, initials tags, and date tags
      // 🚀 HIGH SPEED: Disable bounds checking during fast movement for better performance
      bounds={isDragging ? undefined : "parent"}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
          onSelect();
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="professional-tag"
      // 🚀 HIGH SPEED: Advanced CSS optimizations for smooth fast movement
      style={{
        ...professionalStyle,
        zIndex: isSelected ? 1000 : 100,
        // 🚀 GPU ACCELERATION: Force hardware acceleration for smooth movement
        transform: 'translate3d(0, 0, 0)', // Force hardware acceleration
        willChange: tag.tagType === 'T' || tag.tagType === 'A' || tag.tagType === 'I' || tag.tagType === 'D' ? 'transform' : 'auto', // Optimize for text tags, name tags, initials tags, and date tags
        // 🚀 HIGH SPEED: Additional optimizations for fast movement
        backfaceVisibility: 'hidden', // Prevent flickering during fast movement
        perspective: '1000px', // Enable 3D transforms for better performance
        transformStyle: 'preserve-3d', // Maintain 3D context
        // 🚀 HIGH SPEED: Disable pointer events during fast drag for better performance
        pointerEvents: isDragging ? 'none' : 'auto'
      }}
    >
      {/* Professional tag content */}
      <div 
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          paddingLeft: '2px'
        }}
      >
        {tag.tagType === 'W' ? null : hasContent ? (
          <span style={{ 
            fontFamily: TYPOGRAPHY.fontFamily,
            fontSize: TYPOGRAPHY.fontSize.content,
            fontWeight: TYPOGRAPHY.fontWeight.medium,
            color: PROFESSIONAL_COLORS.text
          }}>
            {tag.content || tag.displayLabel || TAG_TYPE_CONFIG[tag.tagType]?.label || 'Content'}
          </span>
        ) : (
          <span style={{ 
            fontFamily: TYPOGRAPHY.fontFamily,
            fontSize: TYPOGRAPHY.fontSize.label,
            fontWeight: TYPOGRAPHY.fontWeight.normal,
            color: '#1f2937', // Darker text for better readability
            fontStyle: 'normal', // Remove italic for better readability
            textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)' // Add text shadow for better readability
          }}>
            {TAG_TYPE_CONFIG[tag.tagType]?.placeholder || TAG_TYPE_CONFIG[tag.tagType]?.label || 'Field'}
          </span>
        )}
      </div>

      {/* Professional selection indicator */}
      {isSelected && tag.tagType !== 'W' && (
        <div
          style={{
            position: 'absolute',
            top: '-24px',
            left: '0',
            backgroundColor: PROFESSIONAL_COLORS.text,
            color: 'white',
            padding: '2px 8px',
            borderRadius: '2px',
            fontSize: '11px',
            fontWeight: TYPOGRAPHY.fontWeight.medium,
            whiteSpace: 'nowrap',
            zIndex: 1001
          }}
        >
          {tag.displayLabel || TAG_TYPE_CONFIG[tag.tagType]?.label || 'Field'}
        </div>
      )}
    </Rnd>
  );
};

// Main TagLayer component
const TagLayer: React.FC<TagLayerProps> = ({
  documentId,
  pageNumber,
  canvasElement,
  containerRef,
  scaleFactor,
  mode,
  onCoordinateClick,
  liveSessionState
}) => {
  const {
    tags,
    selectedTag,
    currentUser,
    selectTag,
    updateTag,
    deleteTag
  } = useEditorStore();

  // Filter tags for current page
  const pageTags = useMemo(() => {
    return tags.filter(tag => tag.coordinates.pageNumber === pageNumber);
  }, [tags, pageNumber]);

  // Handle tag selection
  const handleTagSelect = useCallback((tag: DocumentTag) => {
    selectTag(tag);
  }, [selectTag]);

  // Handle tag update
  const handleTagUpdate = useCallback((tagId: string, updates: { x: number; y: number }) => {
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return;
    
    const newCoordinates = {
      ...tag.coordinates,
      ...updates
    };
    updateTag(tagId, { coordinates: newCoordinates });
  }, [updateTag, tags]);

  // Handle tag deletion
  const handleTagDelete = useCallback((tagId: string) => {
      deleteTag(tagId);
  }, [deleteTag]);

  // Handle click on empty space
  const handleContainerClick = useCallback((e: any) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / scaleFactor;
    const y = (e.clientY - rect.top) / scaleFactor;

    if (onCoordinateClick) {
      onCoordinateClick(x, y, pageNumber);
    }
  }, [containerRef, scaleFactor, onCoordinateClick, pageNumber]);

  return (
    <div
      className="absolute inset-0 pointer-events-auto"
      onClick={handleContainerClick}
      style={{ zIndex: 50 }}
    >
      {pageTags.map((tag) => (
        <TagRenderer
          key={tag.id}
          tag={tag}
          isSelected={tag.id === selectedTag?.id}
          canEdit={mode.canPlaceTags}
          scaleFactor={scaleFactor}
          onSelect={() => handleTagSelect(tag)}
          onUpdate={(updates) => handleTagUpdate(tag.id, updates)}
          onDelete={() => handleTagDelete(tag.id)}
        />
      ))}
    </div>
  );
};

export default TagLayer; 