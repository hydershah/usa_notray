import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Rnd } from 'react-rnd';
import { useEditorStore } from '../../hooks/editor/useEditorStore';

import { initializePDFWorker, isPDFWorkerReady } from '../../lib/pdf-worker';
import type { 
  DocumentTag, 
  TagCoordinates, 
  TagType, 
  PDFViewerState, 
  SessionParticipant,
  SessionDocument
} from '@/types/editor';
import type { WebSocketConnection } from '@/hooks/editor/useWebSocket';
import { TAG_TYPE_INFO } from '../../types/editor';
import { StreamlinedTextInput } from './StreamlinedTextInput';
import { 
  getTagDimensions, 
  snapToGrid,
  TAG_TYPE_CONFIG,
  PROFESSIONAL_COLORS,
  TYPOGRAPHY,
  LAYOUT,
  calculateOptimalWidth,
  calculateOptimalHeight
} from '@/lib/constants/tagConstants';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';

// Define TagPosition type
interface TagPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PDFViewerProps {
  documentUrl: string;
  sessionId?: string;
  onPageLoad?: (pageNumber: number, canvas: HTMLCanvasElement, scaleFactor: number) => void;
  onCoordinateClick?: (coordinates: TagCoordinates) => void;
  onTagClick?: (tag: DocumentTag, position: TagPosition) => void;
  onTagResize?: (tagId: string, coordinates: TagCoordinates) => void;
  onTagDelete?: (tagId: string) => void;
  mode?: 'viewing' | 'tagging' | 'signing';
  liveSessionState?: {
    activeUserId?: number;
    state?: string;
  };
  onSetActiveUser?: (userId: number) => void;
  tags?: DocumentTag[];
  selectedUser?: SessionParticipant | null;
  onTagUpdate?: (tagId: string, coordinates: Partial<TagCoordinates>) => void;
  className?: string;
  // Text input specific props
  textInputs?: Array<{
    id: string;
    coordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
      pageNumber: number;
    };
    content: string;
    fontSize: number;
    fontFamily: string;
    textColor: string;
    assignedUserId: number;
    userColor: string;
    isNew: boolean;
    createdAt: Date;
  }>;
  selectedTextInputId?: string | null;
  onTextInputSelect?: (textInputId: string | null) => void;
  onSaveTextContent?: (textInputId: string, content: string) => void;
  onDeleteTextInput?: (textInputId: string) => void;
  onMoveTextInput?: (textInputId: string, coordinates: { x: number; y: number }) => void;
  onFontSizeChange?: (textInputId: string, fontSize: number) => void;
  // Sync functionality for live signing
  onSyncUsers?: () => void;
  currentUser?: SessionParticipant | null;
  isSyncLoading?: boolean;
  webSocket?: WebSocketConnection | null; // Add WebSocket for real-time updates
  // Missing tags navigation props
  highlightedTagId?: string;
  incompleteTags?: string[];
  onScrollToTag?: (tagId: string, pageNumber: number) => void;
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
  onTagClick?: (tag: DocumentTag, position: { x: number; y: number; width: number; height: number }) => void;
  mode?: string;
  onFontSizeChange?: (tagId: string, fontSize: number) => void;
  isHighlighted?: boolean;
  isMissing?: boolean;
}

const TagRenderer: React.FC<TagRendererProps & { localFontSize?: number }> = ({
  tag,
  scaleFactor,
  isSelected,
  canEdit,
  onUpdate,
  onSave,
  onDelete,
  onSelect,
  onTagClick,
  mode,
  onFontSizeChange,
  localFontSize,
  isHighlighted = false,
  isMissing = false
}) => {
  const [imageLoadError, setImageLoadError] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragCoords, setDragCoords] = React.useState<{x: number; y: number} | null>(null);
  const tagInfo = TAG_TYPE_INFO[tag.tagType];
  
  // Use local font size if available, otherwise fall back to stored font size
  const [liveFontSize, setLiveFontSize] = React.useState<number | undefined>(undefined);
  
  // Parse contentData to get font size
  let contentDataFontSize: number | undefined;
  if (tag.contentData) {
    try {
      // Handle both JSON string and object formats
      let parsedContentData;
      if (typeof tag.contentData === 'string') {
        parsedContentData = JSON.parse(tag.contentData);
      } else if (typeof tag.contentData === 'object') {
        parsedContentData = tag.contentData;
      }
      contentDataFontSize = parsedContentData?.fontSize;
    } catch (e) {
      console.warn('Could not parse contentData for font size:', e);
    }
  }
  
  const currentFontSize =
    liveFontSize !== undefined
      ? liveFontSize
      : localFontSize || contentDataFontSize || 12;
  
  // Remove debug logs for better performance during drag operations
  
  // Convert PDF coordinates to display coordinates - memoized for performance
  const fixedDimensions = useMemo(() => getTagDimensions(tag.tagType), [tag.tagType]);
  
  // Calculate optimal dimensions based on content
  const optimalDimensions = useMemo(() => {
    const content = tag.content || '';
    const fontSize = currentFontSize;
    
    // For text tags, always use the tag constants instead of calculating optimal dimensions
    if (tag.tagType === 'T') {
      return {
        width: fixedDimensions.width,
        height: fixedDimensions.height
      };
    }
    
    // For other tag types, calculate optimal dimensions based on content
    const optimalWidth = calculateOptimalWidth(content, fontSize, TYPOGRAPHY.fontFamily);
    const optimalHeight = calculateOptimalHeight(content, fontSize);
    
    // Use the larger of fixed dimensions or optimal dimensions
    const width = Math.max(fixedDimensions.width, optimalWidth);
    const height = Math.max(fixedDimensions.height, optimalHeight);
    
    return { width, height };
  }, [tag.content, tag.tagType, currentFontSize, fixedDimensions.width, fixedDimensions.height]);
  
  const displayCoords = useMemo(() => {
    // Use actual saved coordinates for width/height instead of optimal dimensions
    const savedWidth = tag.coordinates.width || optimalDimensions.width;
    const savedHeight = tag.coordinates.height || optimalDimensions.height;
    
    const coords = {
      x: isDragging && dragCoords ? dragCoords.x : Math.round(tag.coordinates.x * scaleFactor),
      y: isDragging && dragCoords ? dragCoords.y : Math.round(tag.coordinates.y * scaleFactor),
      // For text tags, use fixed dimensions without scaling to maintain consistent 200x30 size
      width: tag.tagType === 'T' ? 200 : Math.round(savedWidth * scaleFactor),
      height: tag.tagType === 'T' ? 30 : Math.round(savedHeight * scaleFactor)
    };
    
    // Debug logging for all tags
    console.log('🔍 DEBUG: TagRenderer displayCoords calculation:', {
      tagId: tag.id,
      tagType: tag.tagType,
      scaleFactor,
      savedCoordinates: tag.coordinates,
      optimalDimensions,
      finalCoords: coords
    });
    
    return coords;
  }, [tag.coordinates.x, tag.coordinates.y, tag.coordinates.width, tag.coordinates.height, scaleFactor, optimalDimensions.width, optimalDimensions.height]);

  const hasContent = useMemo(() => !!(tag.content || tag.contentData || tag.isCompleted), [tag.content, tag.contentData, tag.isCompleted]);

  // Memoized style object to prevent recalculation on every render - DocuSign Style
  const tagStyle = useMemo(() => {
    const config = TAG_TYPE_CONFIG[tag.tagType];
    let backgroundColor = hasContent 
      ? 'transparent' // Make filled tags transparent
      : config?.color || PROFESSIONAL_COLORS.background;
    let borderColor = hasContent 
      ? 'transparent' // Make border transparent for filled tags
      : isSelected
          ? PROFESSIONAL_COLORS.borderActive 
          : config?.borderColor || PROFESSIONAL_COLORS.border;
    let boxShadow = isSelected 
      ? `0 0 0 2px ${PROFESSIONAL_COLORS.borderActive}, ${LAYOUT.shadow.base}` 
      : hasContent 
        ? 'none' // No shadow for filled tags
        : 'none';

    // Apply missing tag styling
    if (isMissing && !hasContent) {
      backgroundColor = '#fef3c7'; // Light orange background
      borderColor = '#f59e0b'; // Orange border
      boxShadow = '0 0 0 2px #f59e0b, 0 0 8px rgba(245, 158, 11, 0.3)'; // Orange glow
    }
    
    // Apply highlighted styling (takes precedence over missing)
    if (isHighlighted) {
      boxShadow = '0 0 0 3px #3b82f6, 0 0 12px rgba(59, 130, 246, 0.5)'; // Blue glow
    }
    
    return {
      backgroundColor,
      border: hasContent 
        ? 'none' // No border for filled tags
        : `${isMissing && !hasContent ? '2px' : '1.5px'} solid ${borderColor}`,
      borderRadius: LAYOUT.borderRadius.base,
      color: hasContent 
        ? PROFESSIONAL_COLORS.text 
        : PROFESSIONAL_COLORS.textPlaceholder,
      zIndex: isSelected ? 1000 : (isHighlighted || isMissing) ? 500 : 100,
      pointerEvents: 'auto' as const,
      cursor: canEdit ? 'grab' as const : 'default' as const,
      fontFamily: TYPOGRAPHY.fontFamily,
      fontSize: TYPOGRAPHY.fontSize.tag,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      transition: 'none', // Remove transitions during drag for better performance
      boxShadow,
      // DocuSign style enhancements
      position: 'relative' as const,
      overflow: 'visible' as const, // Allow content to expand beyond container
      minHeight: 'fit-content' as const, // Ensure container fits content
      animation: isMissing && !hasContent ? 'pulse 2s infinite' : 'none'
    };
  }, [hasContent, isSelected, canEdit, tag.tagType, isMissing, isHighlighted]);

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

  // Throttle drag updates for smoother performance
  const throttledOnUpdate = useRef<((coords: any) => void) | null>(null);
  
  useEffect(() => {
    let lastUpdate = 0;
    throttledOnUpdate.current = (coords: any) => {
      const now = Date.now();
      if (now - lastUpdate > 8) { // ~120fps throttling for smooth drag
        onUpdate(coords);
        lastUpdate = now;
      }
    };
  }, [onUpdate]);

  const handleDrag = useCallback((e: any, data: any) => {
    if (!canEdit || !throttledOnUpdate.current) return;
    
    // Optimized smooth drag - minimal processing during drag for better performance
    const newCoordinates = {
      x: data.x / scaleFactor,
      y: data.y / scaleFactor
    };
    
    throttledOnUpdate.current(newCoordinates);
  }, [canEdit, scaleFactor]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragStop = useCallback((e: any, data: any) => {
    setIsDragging(false);
    if (!canEdit || !onSave) return;
    
    // Professional snap-to-grid on drop - DocuSign style
    const snappedX = snapToGrid(data.x / scaleFactor);
    const snappedY = snapToGrid(data.y / scaleFactor);
    
    const newCoordinates = {
      x: snappedX,
      y: snappedY
    };
    
    onSave(newCoordinates);
  }, [canEdit, onSave, scaleFactor]);

  // Instant font size updates
  
  const handleResize = (e: any, direction: any, ref: any, delta: any, position: any) => {
    if (!canEdit) return;
    
    // For text tags, calculate font size change based on resize distance and let container auto-fit
    if (tag.tagType === 'T') {
      // Use the dominant resize direction (width or height) to determine font scaling
      const widthChange = delta.width;
      const heightChange = delta.height;
      const primaryChange = Math.abs(widthChange) > Math.abs(heightChange) ? widthChange : heightChange;
      
      // More sensitive scaling: 50px = 1px font change for better control
      const fontSizeChange = primaryChange / (scaleFactor * 50);
      let newFontSize = currentFontSize + fontSizeChange;
      newFontSize = Math.max(8, Math.min(48, newFontSize));
      setLiveFontSize(newFontSize);
      
      // Let the container auto-size to text - don't update coordinates during resize
      // This allows the container to naturally fit the text content
    } else {
      // For non-text tags, update size normally (NO font size change)
      const newCoordinates = validateAndSanitizeCoordinates({
        width: ref.offsetWidth / scaleFactor,
        height: ref.offsetHeight / scaleFactor
      });
      onUpdate(newCoordinates);
    }
  };

  const handleResizeStop = (e: any, direction: any, ref: any, delta: any, position: any) => {
    console.log('📏 Tag resize stop triggered:', {
      tagId: tag.id,
      tagType: tag.tagType,
      canEdit,
      hasOnSave: !!onSave,
      newWidth: ref.offsetWidth,
      newHeight: ref.offsetHeight,
      scaleFactor
    });
    
    if (!canEdit || !onSave) {
      console.warn('❌ Cannot resize tag - missing permissions or save function:', { canEdit, hasOnSave: !!onSave });
      return;
    }
    setLiveFontSize(undefined); // Reset live font size after drag
    
    // Get manual resize dimensions
    const manualWidth = ref.offsetWidth / scaleFactor;
    const manualHeight = ref.offsetHeight / scaleFactor;
    
    let finalWidth = manualWidth;
    let finalHeight = manualHeight;
    
    // Only calculate optimal dimensions for text tags (type 'T')
    if (tag.tagType === 'T') {
      const content = tag.content || '';
      const optimalWidth = calculateOptimalWidth(content, currentFontSize, TYPOGRAPHY.fontFamily);
      const optimalHeight = calculateOptimalHeight(content, currentFontSize);
      
      // For text tags, use the larger of manual resize or optimal dimensions
      finalWidth = Math.max(manualWidth, optimalWidth);
      finalHeight = Math.max(manualHeight, optimalHeight);
      
      console.log('📏 Text tag resize with optimal dimensions:', {
        tagId: tag.id,
        content,
        currentFontSize,
        optimalWidth,
        optimalHeight,
        manualWidth,
        manualHeight,
        finalWidth,
        finalHeight
      });
    } else {
      // For non-text tags (Name, Signature, Initials, Date, etc.), use manual dimensions directly
      console.log('📏 Non-text tag resize with manual dimensions:', {
        tagId: tag.id,
        tagType: tag.tagType,
        manualWidth,
        manualHeight
      });
    }
    
    const newCoordinates = {
      width: Math.round(finalWidth),
      height: Math.round(finalHeight)
    };
    
    console.log('📏 Saving tag resize:', {
      tagId: tag.id,
      tagType: tag.tagType,
      newCoordinates
    });
    
    onSave(newCoordinates);
    
    // Save rounded font size to server and update localFontSizes
    if (onFontSizeChange && liveFontSize !== undefined) {
      onFontSizeChange(tag.id, Math.round(liveFontSize));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete();
    }
  };

  return (
    <Rnd
      size={{ width: displayCoords.width, height: displayCoords.height }}
      position={{ x: displayCoords.x, y: displayCoords.y }}
      onDrag={(e, d) => {
        setIsDragging(true);
        setDragCoords({ x: d.x, y: d.y });
      }}
      onDragStart={handleDragStart}
      onDragStop={(e, d) => {
        setIsDragging(false);
        setDragCoords(null);
        if (onUpdate && canEdit) {
          onUpdate({
            x: d.x / scaleFactor,
            y: d.y / scaleFactor
          });
        }
      }}
      onResize={handleResize}
      onResizeStop={handleResizeStop}
      enableResizing={{
        top: canEdit,
        right: canEdit,
        bottom: canEdit,
        left: canEdit,
        topRight: canEdit,
        bottomRight: canEdit,
        bottomLeft: canEdit,
        topLeft: false
      }} // Enable corner and edge resizing for text tags
        bounds="parent"
      cancel=".no-drag"
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        
        // Prevent interference with text inputs
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.closest('input') || target.closest('.streamlined-text-input')) {
          return;
        }
        
        // Optimized click handling without console logging for better performance
        
        // ✅ FIX: Special handling for whiteout tags
        if (tag.tagType === 'W') {
          if (mode === 'signing' && onTagClick && !tag.isCompleted) {
            // Whiteout tag clicked - applying immediately
            onTagClick(tag, {
              x: e.currentTarget.getBoundingClientRect().left,
              y: e.currentTarget.getBoundingClientRect().top,
              width: e.currentTarget.getBoundingClientRect().width,
              height: e.currentTarget.getBoundingClientRect().height
            });
          } else if (mode === 'tagging') {
            console.log('🔗 Selecting whiteout tag in tagging mode');
            onSelect();
          }
          return;
        }
        
        if (mode === 'signing' && onTagClick && !tag.isCompleted) {
          // Improved double-click detection with timing check
          const clickTime = e.timeStamp;
          const currentTarget = e.currentTarget as any; // Capture reference before setTimeout
          const lastClickTime = currentTarget._lastClickTime || 0;
          const timeDiff = clickTime - lastClickTime;
          currentTarget._lastClickTime = clickTime;
          
          if (e.detail === 2 && timeDiff < 500) {
            // Confirmed double-click within reasonable time
            const rect = currentTarget.getBoundingClientRect();
            console.log('🎯 Double-click confirmed - triggering interactive input for tag:', tag.id, 'type:', tag.tagType);
            onTagClick(tag, {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height
            });
          } else if (e.detail === 1) {
            // Single-click: just select the tag (with debouncing)
            setTimeout(() => {
              const currentClickTime = currentTarget._lastClickTime || 0;
              if (Math.abs(currentClickTime - clickTime) < 50) { // Only if no subsequent clicks
                console.log('🔗 Single-click confirmed - selecting tag:', tag.id, 'type:', tag.tagType);
                onSelect();
              }
            }, 250); // Wait to see if double click follows
          }
        } else {
          // In tagging mode or for completed tags, just select immediately
          console.log('🔗 Selecting tag:', tag.id, 'type:', tag.tagType, 'onSelect function:', typeof onSelect);
          onSelect();
        }
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={`
        professional-tag
        ${isSelected ? 'selected' : ''}
        ${isDragging ? 'dragging' : ''}
        ${hasContent ? 'has-content' : 'empty'}
      `}
      style={{
        ...tagStyle,
        position: 'absolute',
        zIndex: isSelected ? 1000 : isDragging ? 999 : 100,
        pointerEvents: 'auto',
        width: 'auto', // Let the tag expand naturally with content
        height: 'auto', // Let the tag expand naturally with content
        minWidth: 'fit-content', // Ensure minimum width fits content
        minHeight: 'fit-content' // Ensure minimum height fits content
      }}
    >
      <div 
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center', // SIMPLE CENTER: Center the text like PDF
          justifyContent: 'flex-start',
          overflow: 'visible', // Allow content to expand naturally
          textOverflow: 'clip', // Don't clip text
          whiteSpace: 'normal', // Allow text to wrap
          paddingLeft: '4px', // Same 4px left padding as text tags
          position: 'relative',
          wordWrap: 'break-word',
          overflowWrap: 'break-word'
        }}
      >
        {/* DocuSign style tag content */}
        {hasContent ? (
          <span 
            data-text-content
            style={{ 
              fontFamily: TYPOGRAPHY.fontFamily,
              fontSize: `${currentFontSize}px`,
              fontWeight: TYPOGRAPHY.fontWeight.medium,
              color: '#1e293b', // Dark text for maximum visibility
              lineHeight: '1.2',
              display: 'block',
              width: '100%',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'normal', // Allow text to wrap to multiple lines
              overflow: 'visible' // Show all content, don't hide overflow
            }}
          >
            {tag.content || TAG_TYPE_CONFIG[tag.tagType]?.label || 'Content'}
          </span>
        ) : (
          <span style={{ 
            fontFamily: TYPOGRAPHY.fontFamily,
            fontSize: `${Math.max(10, currentFontSize - 2)}px`,
            fontWeight: TYPOGRAPHY.fontWeight.medium, // Increased weight for better visibility
            color: '#475569', // Darker placeholder text for better contrast
            fontStyle: 'italic',
            lineHeight: '1.2',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'normal', // Allow text to wrap
            overflow: 'visible' // Show all content
          }}>
            {TAG_TYPE_CONFIG[tag.tagType]?.placeholder || TAG_TYPE_CONFIG[tag.tagType]?.label || 'Field'}
          </span>
        )}
        
        {/* DocuSign style completion indicator */}
        {hasContent && (
          <div 
            style={{
              position: 'absolute',
              top: '2px',
              right: '4px',
              width: '8px',
              height: '8px',
              backgroundColor: PROFESSIONAL_COLORS.success,
              borderRadius: '50%',
              border: '1px solid #ffffff'
            }}
          />
        )}
        
        {/* Special indicator for disclosure tags */}
        {tag.tagType === 'O' && (
          <div 
            style={{
              position: 'absolute',
              top: '2px',
              left: '4px',
              width: '12px',
              height: '12px',
              backgroundColor: '#d97706',
              borderRadius: '50%',
              border: '1px solid #ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Disclosure Tag"
          >
            <span style={{ fontSize: '8px', color: '#ffffff', fontWeight: 'bold' }}>D</span>
          </div>
        )}
      </div>
    </Rnd>
  );
};

  // Memoize TagRenderer for better performance during drag operations
  const MemoizedTagRenderer = memo(TagRenderer);

  // Whiteout Overlay Component - Interactive white rectangle that covers text
  const WhiteoutOverlay: React.FC<{
    overlay: {
      id: string;
      coordinates: TagCoordinates;
      sessionId: string;
      createdAt: Date;
    };
    scaleFactor: number;
    onUpdate?: (coordinates: Partial<TagCoordinates>) => void;
    onDelete?: () => void;
    canEdit?: boolean;
  }> = ({ overlay, scaleFactor, onUpdate, onDelete, canEdit = false }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragCoords, setDragCoords] = useState<{x: number; y: number} | null>(null);
    
    const displayCoords = {
      x: isDragging && dragCoords ? dragCoords.x : overlay.coordinates.x * scaleFactor,
      y: isDragging && dragCoords ? dragCoords.y : overlay.coordinates.y * scaleFactor,
      width: overlay.coordinates.width * scaleFactor,
      height: overlay.coordinates.height * scaleFactor
    };

    return (
      <Rnd
        size={{ width: displayCoords.width, height: displayCoords.height }}
        position={{ x: displayCoords.x, y: displayCoords.y }}
        onDrag={(e, d) => {
          if (onUpdate && canEdit) {
            onUpdate({
              x: d.x / scaleFactor,
              y: d.y / scaleFactor
            });
          }
        }}
        onResize={(e, direction, ref, delta, position) => {
          if (onUpdate && canEdit) {
            onUpdate({
              x: position.x / scaleFactor,
              y: position.y / scaleFactor,
              width: ref.style.width ? parseInt(ref.style.width) / scaleFactor : overlay.coordinates.width,
              height: ref.style.height ? parseInt(ref.style.height) / scaleFactor : overlay.coordinates.height
            });
          }
        }}
        onResizeStop={(e, direction, ref, delta, position) => {
          if (onUpdate && canEdit) {
            onUpdate({
              x: position.x / scaleFactor,
              y: position.y / scaleFactor,
              width: ref.style.width ? parseInt(ref.style.width) / scaleFactor : overlay.coordinates.width,
              height: ref.style.height ? parseInt(ref.style.height) / scaleFactor : overlay.coordinates.height
            });
          }
        }}
        enableResizing={canEdit ? {
          top: true,
          right: true,
          bottom: true,
          left: true,
          topRight: true,
          bottomRight: true,
          bottomLeft: true,
          topLeft: true
        } : false}
        disableDragging={!canEdit}
        bounds="parent"
        style={{
          backgroundColor: '#FFFFFF',
          border: canEdit ? '2px solid #3B82F6' : '1px solid #E5E7EB',
          borderRadius: '2px',
          zIndex: 1000,
          cursor: canEdit ? 'move' : 'default',
          boxShadow: canEdit ? '0 2px 4px rgba(59, 130, 246, 0.2)' : 'none',
          opacity: 1,
          pointerEvents: 'auto',
          position: 'absolute'
        }}
        title="Whiteout overlay"
      >
        {/* Optional delete button for editable whiteouts */}
        {canEdit && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              width: '16px',
              height: '16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 11
            }}
            title="Delete whiteout"
          >
            ×
          </button>
        )}
        
        {/* Editable indicator for whiteout overlays */}
        {canEdit && (
          <div
            style={{
              position: 'absolute',
              top: '2px',
              left: '2px',
              width: '8px',
              height: '8px',
              backgroundColor: '#3B82F6',
              borderRadius: '50%',
              zIndex: 11
            }}
            title="Editable whiteout"
          />
        )}
      </Rnd>
    );
  };



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

  // Debug: Log store functions to ensure they exist
  console.log('🔍 Store functions:', {
    setZoomLevel: typeof setZoomLevel,
    currentZoomLevel: viewer.zoomLevel
  });

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

  // Scroll to tag functionality
  const scrollToTag = useCallback((tagId: string, pageNumber: number) => {
    const tag = tags.find(t => t.id === tagId);
    if (!tag || !containerRef.current) return;

    // First scroll to the page
    const pageContainer = pageContainerRefs.current[pageNumber - 1];
    if (pageContainer) {
      const scrollContainer = containerRef.current;
      const scrollTop = pageContainer.offsetTop - 100; // 100px offset from top
      
      scrollContainer.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });

      // After scrolling, highlight the tag briefly
      setTimeout(() => {
        if (onScrollToTag) {
          onScrollToTag(tagId, pageNumber);
        }
      }, 500); // Wait for scroll to complete
    }
  }, [tags, onScrollToTag]);

  // Expose scroll to tag function for external use
  React.useEffect(() => {
    if (highlightedTagId) {
      const tag = tags.find(t => t.id === highlightedTagId);
      if (tag) {
        scrollToTag(highlightedTagId, tag.coordinates.pageNumber);
      }
    }
  }, [highlightedTagId, scrollToTag, tags]);

  // Create a stable reference for document switching
  const documentSwitchTimeoutRef = useRef<NodeJS.Timeout>();

  // Determine if user can edit tags - FIXED: Properly respect canPlaceTags in all modes
  const canEditTags = useMemo(() => {
    // In both tagging and signing modes, check if user can place tags
    // This ensures signers cannot place new tags in signing mode
    const result = editorMode.canPlaceTags && (mode === 'tagging' || mode === 'signing');
    // Can edit tags calculation optimized for performance
    return result;
  }, [mode, editorMode.canPlaceTags]);

  // Debounced font size updates to prevent API spam during drag
  const debouncedTagFontSizeUpdates = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Function to update tag font size with immediate local update + debounced server sync
  const updateTagFontSize = useCallback(async (tagId: string, fontSize: number) => {
    try {
      // ✅ IMMEDIATE LOCAL UPDATE: Update local font size for instant visual feedback
      setLocalFontSizes(prev => {
        const newMap = new Map(prev);
        newMap.set(tagId, fontSize);
        return newMap;
      });
      
      // Immediately updated local font size for better UX

      // Clear any existing timeout for this tag
      const existingTimeout = debouncedTagFontSizeUpdates.current.get(tagId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new debounced timeout for server sync
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

          if (!response.ok) {
            throw new Error('Failed to update font size');
          }

          // Server updated font size successfully
          debouncedTagFontSizeUpdates.current.delete(tagId);
          
        } catch (serverError) {
          console.error('❌ Failed to update tag font size on server:', serverError);
        }
      }, 350); // 350ms debounce delay - smooth but not overwhelming server

      debouncedTagFontSizeUpdates.current.set(tagId, timeout);
      
    } catch (error) {
      console.error('❌ Failed to setup tag font size update:', error);
    }
  }, [sessionId]);

  // Cleanup debounced font size updates on unmount
  useEffect(() => {
    return () => {
      debouncedTagFontSizeUpdates.current.forEach(timeout => clearTimeout(timeout));
      debouncedTagFontSizeUpdates.current.clear();
    };
  }, []);

  // Load PDF document with improved error handling and redirect support
  const loadPDF = useCallback(async (url: string) => {
    // Extract document ID from URL for more accurate comparison
    const getDocumentIdFromUrl = (url: string) => {
      const match = url.match(/\/documents\/(\d+)\/preview/);
      return match ? match[1] : url;
    };

    const documentId = getDocumentIdFromUrl(url);
    const currentDocumentId = currentDocumentUrlRef.current ? getDocumentIdFromUrl(currentDocumentUrlRef.current) : null;

    // Only prevent loading if it's the exact same document AND already loaded successfully
    if (currentDocumentId === documentId && !error && pdfDoc && !loading) {
      console.log('📄 Skipping load - same document already loaded:', documentId);
      return;
    }

    // Prevent concurrent loading of the same document
    if (isLoadingRef.current && currentDocumentId === documentId) {
      console.log('📄 Skipping load - already loading this document:', documentId);
      return;
    }

    try {
      console.log('📄 Starting PDF load for document:', documentId, 'URL:', url);
      isLoadingRef.current = true;
      setLoading(true);
      setError(null);
      
      // Clear previous PDF state when switching to a different document
      if (currentDocumentId !== documentId) {
        console.log('🔄 Switching documents - clearing previous state');
        
        // Cancel all active render tasks
        renderTasksRef.current.forEach((task, pageNumber) => {
          if (task && typeof task.cancel === 'function') {
            try {
              task.cancel();
              console.log(`🚫 Cancelled render task for page ${pageNumber} on document switch`);
            } catch (e) {
              // Ignore cancellation errors
            }
          }
        });
        renderTasksRef.current.clear();
        
        // Clear canvas refs
        canvasRefs.current = [];
        
        // Reset component state
        setPdfDoc(null);
        setRenderedPages(new Set());
        setScaleFactors(new Map());
        setLoading(true);
      }
      
      // Ensure worker is ready
      if (!isPDFWorkerReady()) {
        console.log('🔧 Initializing PDF worker...');
        initializePDFWorker();
        await new Promise(resolve => setTimeout(resolve, 200)); // Longer wait for worker
      }

      // Clean up previous loading task when switching to a different document
      if (loadingTaskRef.current && currentDocumentId !== documentId) {
        try {
          loadingTaskRef.current.destroy();
          console.log('🗑️ Previous PDF loading task destroyed for document switch');
        } catch (e: any) {
          console.log('Previous task cleanup:', e?.message || 'Unknown error');
        }
        loadingTaskRef.current = null;
        await new Promise(resolve => setTimeout(resolve, 50)); // Wait for cleanup
      }

      // Update current document reference
      currentDocumentUrlRef.current = url;
      
      // FIXED: First fetch the PDF as a blob to handle redirects properly
      let pdfData: ArrayBuffer | undefined;
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 1000; // Start with 1 second delay
      
      while (retryCount <= maxRetries) {
        try {
          console.log(`📄 Fetching PDF document... (attempt ${retryCount + 1}/${maxRetries + 1})`);
          
          // Replace token placeholder if present
          const token = localStorage.getItem('token');
          const fetchUrl = url.includes('{{TOKEN}}') ? url.replace('{{TOKEN}}', token || '') : url;
          console.log('🔗 Final fetch URL:', fetchUrl.substring(0, 100) + '...');
          
          const response = await fetch(fetchUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            credentials: 'same-origin'
          });
          
          if (!response.ok) {
            // Try to parse error response as JSON first
            let errorMessage = `HTTP error! status: ${response.status}`;
            
            // Handle specific HTTP status codes
            if (response.status === 502) {
              errorMessage = 'Server error (502): The document service is temporarily unavailable. Please try again in a few moments.';
              console.error('📄 502 Bad Gateway - backend server may be down or misconfigured');
            } else if (response.status === 404) {
              // Check if this is a JSON error response (file not ready yet)
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                console.log('📄 JSON error response:', errorData);
                
                // If Vultr is accessible but file not found, it might be uploading
                if (errorData.vultrStatus === 'accessible' && retryCount < maxRetries) {
                  console.log(`📄 File not found but Vultr is accessible, retrying in ${retryDelay * Math.pow(2, retryCount)}ms...`);
                  await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, retryCount)));
                  retryCount++;
                  continue; // Retry the request
                }
                errorMessage = errorData.message || errorData.error || 'Document not found (404)';
              } else {
                errorMessage = 'Document not found (404): The requested PDF file does not exist on the server.';
              }
            } else if (response.status === 403) {
              errorMessage = 'Access denied (403): You do not have permission to view this document.';
            } else if (response.status === 401) {
              errorMessage = 'Authentication required (401): Please log in again to access this document.';
            } else {
              try {
                const errorData = await response.json();
                if (errorData.error || errorData.message) {
                  errorMessage = errorData.message || errorData.error;
                  console.log('📄 Server error details:', errorData);
                }
              } catch (parseError) {
                // If not JSON, use status text
                errorMessage = `HTTP ${response.status}: ${response.statusText || 'Document request failed'}`;
              }
            }
            throw new Error(errorMessage);
          }
          
          // Check if response is JSON (error response) instead of PDF
          const contentType = response.headers.get('content-type');
          console.log('📄 Response content-type:', contentType);
          console.log('📄 Response headers:', Object.fromEntries(response.headers.entries()));
          
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            console.error('📄 Server returned JSON instead of PDF:', errorData);
            
            // If this is a "file not found" error and we have retries left, wait and retry
            if (errorData.error === 'Document not found' && retryCount < maxRetries) {
              console.log(`📄 Document not ready yet, retrying in ${retryDelay * Math.pow(2, retryCount)}ms...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, retryCount)));
              retryCount++;
              continue; // Retry the request
            }
            
            const errorMessage = errorData.message || errorData.error || 'Document not found on server';
            throw new Error(errorMessage);
          }
          
          // Check if response is HTML (likely an error page)
          if (contentType && contentType.includes('text/html')) {
            const htmlText = await response.text();
            console.error('📄 Server returned HTML instead of PDF. First 500 chars:', htmlText.substring(0, 500));
            throw new Error('Server returned an HTML page instead of PDF. This usually means authentication failed or the document URL is incorrect.');
          }
          
          // Get the PDF data as ArrayBuffer
          pdfData = await response.arrayBuffer();
          console.log('✅ PDF data fetched successfully, size:', pdfData.byteLength);
          
          // Check if the data starts with PDF header
          const uint8Array = new Uint8Array(pdfData);
          const header = String.fromCharCode(...Array.from(uint8Array.slice(0, 5)));
          console.log('📄 PDF header check:', header);
          
          if (header !== '%PDF-') {
            // Log first 100 bytes as text to see what we got
            const textPreview = String.fromCharCode(...Array.from(uint8Array.slice(0, Math.min(100, uint8Array.length))));
            console.error('📄 Invalid PDF header. First 100 bytes as text:', textPreview);
            
            // Check if this looks like JSON (starts with { or [)
            if (textPreview.trim().startsWith('{') || textPreview.trim().startsWith('[')) {
              try {
                const jsonError = JSON.parse(new TextDecoder().decode(uint8Array));
                console.error('📄 Received JSON error instead of PDF:', jsonError);
                
                // If file not found and we have retries, try again
                if (jsonError.error === 'Document not found' && retryCount < maxRetries) {
                  console.log(`📄 Document not ready (JSON response), retrying in ${retryDelay * Math.pow(2, retryCount)}ms...`);
                  await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, retryCount)));
                  retryCount++;
                  continue;
                }
                
                throw new Error(jsonError.message || jsonError.error || 'The server returned an error instead of the PDF file.');
              } catch (parseErr) {
                // Not valid JSON either
              }
            }
            throw new Error('The document does not appear to be a valid PDF file. The server may have returned an error page.');
          }
          
          // Validate PDF data size (basic check for corrupted/empty files)
          if (pdfData.byteLength < 1000) {
            console.warn('⚠️ PDF data seems too small:', pdfData.byteLength, 'bytes');
            
            // Try to parse as JSON to see if it's an error response
            try {
              const textData = new TextDecoder().decode(pdfData);
              const jsonError = JSON.parse(textData);
              console.error('📄 Small response is JSON error:', jsonError);
              
              // If file not found and we have retries, try again
              if (jsonError.error === 'Document not found' && retryCount < maxRetries) {
                console.log(`📄 Document not ready (small JSON), retrying in ${retryDelay * Math.pow(2, retryCount)}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, retryCount)));
                retryCount++;
                continue;
              }
              
              throw new Error(jsonError.message || jsonError.error || 'The document appears to be corrupted or empty.');
            } catch (parseErr) {
              // Not JSON, just a small/corrupted file
              throw new Error('The document appears to be corrupted or empty. Please try uploading the document again.');
            }
          }
          
          // Success! Break out of the retry loop
          break;
          
        } catch (fetchError) {
          console.error(`❌ Failed to fetch PDF (attempt ${retryCount + 1}):`, fetchError);
          
          // If this is the last retry, throw the error
          if (retryCount >= maxRetries) {
            throw fetchError;
          }
          
          // Otherwise, wait and retry with exponential backoff
          const waitTime = retryDelay * Math.pow(2, retryCount);
          console.log(`📄 Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retryCount++;
        }
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
      
      let pdf;
      try {
        pdf = await loadingTask.promise;
      } catch (loadError) {
        // If component is unmounted, don't throw error
        if (!isMountedRef.current) {
          console.log('📄 PDF loading cancelled - component unmounted');
          return;
        }
        throw loadError;
      }
      
      if (!isMountedRef.current) return;
      
      console.log('✅ PDF loaded successfully:', { numPages: pdf.numPages, documentId });
      setPdfDoc(pdf);
      setRenderedPages(new Set());
      setScaleFactors(new Map());
      
      // Update viewer state with new document info
      useEditorStore.setState(state => ({
        viewer: {
          ...state.viewer,
          totalPages: pdf.numPages,
          currentPage: 1,
          scrollTop: 0 // Reset scroll position for new document
        }
      }));
      
      setLoading(false);
      console.log(`🎯 Document ${documentId} loaded and ready for rendering`);
      
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('❌ PDF load error:', err);
      
      // Reset loading state on error
      isLoadingRef.current = false;
      
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
    } finally {
      // Always reset loading state
      isLoadingRef.current = false;
    }
  }, [documentUrl]);

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
  }, [pdfDoc, onPageLoad, viewer.zoomLevel]);

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
      console.log('📊 PDFViewer state update:', {
        documentUrl: documentUrl?.substring(0, 50) + '...',
        pdfDocLoaded: !!pdfDoc,
        numPages: pdfDoc?.numPages,
        loading,
        error: !!error,
        canEditTags,
        tagsCount: tags.length,
        scaleFactorsSize: scaleFactors.size,
        renderedPagesSize: renderedPages.size,
        currentZoomLevel: viewer.zoomLevel
      });
    }, 500);
    
    return () => clearTimeout(timeout);
  }, [documentUrl, pdfDoc, loading, error, canEditTags, tags.length, scaleFactors.size, renderedPages.size, viewer.zoomLevel]);

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
    
    // Position tags with lower-left corner at cursor position
    // Store coordinates as the lower-left corner for consistent PDF generation
    finalTagX = Math.max(0, Math.round(pdfX));
    finalTagY = Math.max(0, Math.round(pdfY)); // Store as lower-left corner
    
    // Debug: Log the exact coordinates being sent
    console.log('🎯 TAG PLACEMENT DEBUG:', {
      mousePosition: { x: event.clientX, y: event.clientY },
      canvasPosition: { x: canvasX, y: canvasY },
      pdfPosition: { x: pdfX, y: pdfY },
      finalPosition: { x: finalTagX, y: finalTagY },
      tagDimensions: dimensions,
      selectedTagType
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
      y: finalTagY, // This is now the lower-left corner
      width: dimensions.width,
      height: dimensions.height,
      pageNumber
    };

    onCoordinateClick(coordinates);
  }, [canEditTags, onCoordinateClick, scaleFactors, selectedTagType]);

  // Handle scroll tracking
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    
    setScrollTop(scrollTop);

    // Find which page center is closest to viewport center (most reliable method)
    const viewportCenter = scrollTop + containerHeight / 2;
    let currentPage = 1;
    let minDistance = Infinity;
    const pageContainers = pageContainerRefs.current;
    
    for (let i = 0; i < pageContainers.length; i++) {
      const pageContainer = pageContainers[i];
      if (!pageContainer) continue;
      
      const pageTop = pageContainer.offsetTop;
      const pageCenter = pageTop + pageContainer.offsetHeight / 2;
      const distance = Math.abs(pageCenter - viewportCenter);
      
      // Find the page whose center is closest to viewport center
      if (distance < minDistance) {
        minDistance = distance;
        currentPage = i + 1;
      }
    }
    
    if (currentPage !== viewer.currentPage) {
      setCurrentPage(currentPage);
      console.log(`📍 Page updated to: ${currentPage} (distance from center: ${minDistance.toFixed(1)}px)`);
    }
  }, [viewer.currentPage, setCurrentPage, setScrollTop]);

  // Tag event handlers
  const handleTagUpdate = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    // Update local state immediately for responsive UI
    onTagUpdate?.(tagId, coordinates);
    
    // 🚀 REAL-TIME SYNC: Broadcast tag update via WebSocket
    if (webSocket && webSocket.isConnected && webSocket.isReady) {
      console.log('📡 Broadcasting tag update via WebSocket:', {
        tagId,
        coordinates
      });
      
      try {
        webSocket.sendMessage({
          type: 'tag_updated',
          payload: {
            tagId,
            coordinates,
            page: coordinates.pageNumber || 1
          }
        });
      } catch (error) {
        console.error('❌ Failed to send tag update via WebSocket:', error);
      }
    } else {
      console.warn('⚠️ WebSocket not available for tag update broadcast, state:', webSocket?.readyState);
    }
  }, [onTagUpdate, webSocket, sessionId]);

  // ✅ ENHANCED: Save tag changes locally and broadcast via WebSocket
  const broadcastTagSave = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    // First, update the tag locally and save to backend
    if (onTagUpdate) {
      console.log('💾 Updating tag position locally:', { tagId, coordinates });
      onTagUpdate(tagId, coordinates);
    }
    
    // Also save to server - this is what was missing!
    if (onTagResize) {
      console.log('🚀 Saving tag coordinates to server:', { tagId, coordinates });
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
        pageNumber: coordinates.pageNumber ?? tag?.coordinates.pageNumber ?? 1
      };

      console.log('📡 Broadcasting tag save via WebSocket:', {
        tagId,
        coordinates: fullCoordinates
      });
      
      try {
        webSocket.sendMessage({
          type: 'tag_saved',
          payload: {
            tagId,
            coordinates: fullCoordinates,
            page: fullCoordinates.pageNumber || 1
          }
        });
      } catch (error) {
        console.error('❌ Failed to broadcast tag save via WebSocket:', error);
      }
    } else {
      console.warn('⚠️ WebSocket not available for tag save broadcast, state:', webSocket?.readyState);
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
          case 'tag_saved':
            // Update tag position/size from other users (including whiteout tags)
            if (message.payload?.tagId && message.payload?.coordinates && onTagUpdate) {
              console.log('📝 Updating tag from WebSocket:', message.payload);
              onTagUpdate(message.payload.tagId, message.payload.coordinates);
            }
            break;
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

          {/* Debug zoom controls - only in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg p-1">
              <span className="text-xs text-red-600 font-medium">Debug:</span>
              <button 
                onClick={() => {
                  console.log('🔍 Debug: Testing direct setZoomLevel call');
                  setZoomLevel(2.0);
                }} 
                className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                type="button"
              >
                Test 2x
              </button>
              <button 
                onClick={() => {
                  console.log('🔍 Debug: Testing zoom functions');
                  console.log('Current zoom:', viewer.zoomLevel);
                  console.log('handleZoomIn type:', typeof handleZoomIn);
                  console.log('setZoomLevel type:', typeof setZoomLevel);
                }} 
                className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                type="button"
              >
                Log
              </button>
            </div>
          )}
          
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
                        ? selectedTagType === null 
                          ? 'cursor-default' // Pointer mode
                          : 'cursor-crosshair hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50' // Tag placement mode
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
                  
                  {/* Tags overlay - Filter out whiteout tags and text tags (text tags are handled separately via textInputs) */}
                  {pageTags.filter(tag => tag.tagType !== 'W' && tag.tagType !== 'T').map(tag => {
                    // Regular tag (text tags are handled separately via textInputs)
                    return (
                      <div key={`${tag.id}-${scaleFactor}`} className="absolute top-0 left-0 w-full h-full pointer-events-none">
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
                  
                  {/* Whiteout overlays - Interactive white rectangles that cover text */}
                  {whiteoutOverlays
                    .filter(overlay => overlay.coordinates.pageNumber === pageNumber)
                    .map(overlay => (
                      <WhiteoutOverlay
                        key={`whiteout-${overlay.id}-${scaleFactor}`}
                        overlay={overlay}
                        scaleFactor={scaleFactor}
                        canEdit={canEditTags}
                        onUpdate={(coordinates) => {
                          console.log('⬜ Whiteout overlay updated:', overlay.id, coordinates);
                          // Update overlay coordinates directly without validation conflicts
                          const updatedCoordinates = {
                            ...overlay.coordinates,
                            ...coordinates
                          };
                          useEditorStore.getState().updateWhiteoutOverlay(overlay.id, { coordinates: updatedCoordinates });
                        }}
                        onDelete={() => {
                          console.log('⬜ Whiteout overlay deleted:', overlay.id);
                          // Remove the overlay from the store
                          useEditorStore.getState().deleteWhiteoutOverlay(overlay.id);
                        }}
                      />
                    ))}

                  {/* Text inputs overlay (separate from regular tags) - FIXED KEY GENERATION */}
                  {textInputs?.filter(textInput => textInput.coordinates.pageNumber === pageNumber).map((textInput) => {
                    // ✅ CRITICAL FIX: Use ID as primary key to prevent duplication, fallback to coordinates only if ID is unstable
                    const primaryKey = textInput.id && textInput.id !== 'temp' ? 
                      `text-${textInput.id}-${scaleFactor}` : 
                      `text-temp-${textInput.coordinates.x}-${textInput.coordinates.y}-${textInput.coordinates.pageNumber}-${scaleFactor}`;
                    
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
                          console.log('📍 Text input moved:', newCoordinates);
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
                              type: 'text_input_changed',
                              payload: {
                                textInputId: textInput.id,
                                coordinates: {
                                  x: newCoordinates.x,
                                  y: newCoordinates.y,
                                  width: newCoordinates.width,
                                  height: newCoordinates.height,
                                  pageNumber: textInput.coordinates.pageNumber
                                },
                                sessionId: sessionId || ''
                              },
                              userId: textInput.assignedUserId.toString(),
                              sessionId: sessionId || '',
                              timestamp: Date.now()
                            };

                            try {
                              webSocket.webSocketInstance?.send(JSON.stringify(updateMessage));
                              console.log('✅ Text tag resize broadcasted via WebSocket');
                            } catch (error) {
                              console.error('❌ Failed to broadcast text tag resize:', error);
                            }
                          } else {
                            console.warn('⚠️ WebSocket not available for text tag resize broadcast');
                          }
                        }}
                        onFontSizeChange={(fontSize) => {
                          if (onFontSizeChange) {
                            onFontSizeChange(textInput.id, fontSize);
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