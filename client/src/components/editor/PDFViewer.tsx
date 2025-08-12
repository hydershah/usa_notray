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
      : localFontSize || contentDataFontSize || 16; // default normalized to 16 for text
  
  // Remove debug logs for better performance during drag operations
  
  // Convert PDF coordinates to display coordinates - memoized for performance
  const fixedDimensions = useMemo(() => getTagDimensions(tag.tagType), [tag.tagType]);
  
  // Calculate optimal dimensions based on content
  const optimalDimensions = useMemo(() => {
    // Try to derive text from contentData as well so size doesn't collapse when content lives there
    const contentFromData = (() => {
      try {
        if (!tag.contentData) return '';
        const obj = typeof tag.contentData === 'string' ? JSON.parse(tag.contentData) : tag.contentData;
        const candidate = obj?.value ?? obj?.text ?? obj?.display ?? obj?.data?.value ?? '';
        return typeof candidate === 'string' ? candidate : '';
      } catch {
        return '';
      }
    })();
    const content = tag.content || contentFromData || '';
    const fontSize = currentFontSize;

    // Auto-size for any tag that allows text input (Text, Name, Date, Commission, Expiration, Disclosure)
    const shouldAutoSize = Boolean(TAG_TYPE_CONFIG[tag.tagType]?.allowTextInput);

    // Helper to convert measured display px to unscaled PDF units
    const toUnscaled = (px: number) => px / Math.max(0.0001, scaleFactor);

    if (!shouldAutoSize) {
      // For non-text-input tags, keep at least fixed dimensions
      // Width is kept to saved/default; height fixed (no inflation)
      const width = fixedDimensions.width;
      const height = fixedDimensions.height;
      return { width, height };
    }

    // For text-input tags, compute optimal size from content and convert to unscaled units
    const optimalWidthPx = calculateOptimalWidth(content, fontSize, TYPOGRAPHY.fontFamily);
    const optimalHeightPx = calculateOptimalHeight(content, fontSize);

    const optimalWidthUnscaled = toUnscaled(optimalWidthPx);
    const optimalHeightUnscaled = toUnscaled(optimalHeightPx);

    // Respect configured minimums if present
    const minWidth = TAG_TYPE_CONFIG[tag.tagType]?.minWidth ?? fixedDimensions.minWidth ?? 1;
    const minHeight = TAG_TYPE_CONFIG[tag.tagType]?.minHeight ?? fixedDimensions.minHeight ?? 1;

    return {
      width: Math.max(minWidth, optimalWidthUnscaled),
      height: Math.max(minHeight, optimalHeightUnscaled)
    };
  }, [tag.content, tag.tagType, currentFontSize, fixedDimensions.width, fixedDimensions.height, scaleFactor]);
  
  // Prefer content-fit sizing when there is content so the outline hugs text
  const displayCoords = useMemo(() => {
    // Use saved coordinates for width/height with fallback to fixed dimensions
    // Guard against persisted zero/near-zero dimensions that would hide the tag
    const rawWidth = tag.coordinates.width;
    const rawHeight = tag.coordinates.height;
    const savedWidth = rawWidth == null || rawWidth < 2 ? fixedDimensions.width : rawWidth;
    const savedHeight = rawHeight == null || rawHeight < 2 ? fixedDimensions.height : rawHeight;

    const shouldAutoSize = Boolean(TAG_TYPE_CONFIG[tag.tagType]?.allowTextInput);

    // Ensure dimensions never go below configured minimums
    const minWidth = TAG_TYPE_CONFIG[tag.tagType]?.minWidth ?? fixedDimensions.minWidth ?? 0;
    const minHeight = TAG_TYPE_CONFIG[tag.tagType]?.minHeight ?? fixedDimensions.minHeight ?? 1;

    // If the tag has any content, prefer the larger of saved size and content-fit size
    const hasAnyContent = Boolean(tag.content || tag.contentData || tag.isCompleted);

    const finalUnscaledWidth = Math.max(
      savedWidth,
      shouldAutoSize && hasAnyContent ? optimalDimensions.width : minWidth
    );
    const finalUnscaledHeight = Math.max(
      savedHeight,
      shouldAutoSize && hasAnyContent ? optimalDimensions.height : minHeight
    );

    const coords = {
      x: isDragging && dragCoords ? dragCoords.x : Math.round(tag.coordinates.x * scaleFactor),
      y: isDragging && dragCoords ? dragCoords.y : Math.round(tag.coordinates.y * scaleFactor),
      // Ensure at least 1px so tags never collapse to 0 due to scaling/rounding
      width: Math.max(1, Math.round(finalUnscaledWidth * scaleFactor)),
      height: Math.max(1, Math.round(finalUnscaledHeight * scaleFactor))
    };
    
    return coords;
  }, [isDragging, dragCoords, tag.coordinates.x, tag.coordinates.y, tag.coordinates.width, tag.coordinates.height, tag.tagType, scaleFactor, optimalDimensions.width, optimalDimensions.height, fixedDimensions.width, fixedDimensions.height]);

  const hasContent = useMemo(() => !!(tag.content || tag.contentData || tag.isCompleted), [tag.content, tag.contentData, tag.isCompleted]);

  // Memoized style object to prevent recalculation on every render - DocuSign Style
  const tagStyle = useMemo(() => {
    const config = TAG_TYPE_CONFIG[tag.tagType];
    
    // Helper function to convert hex color to rgba with opacity
    const hexToRgba = (hex: string, opacity: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };
    
    // Use user's color with transparency for consistent theming
    const userColor = tag.colorCode || config?.color || '#4ECDC4';
    const isWhiteout = tag.tagType === 'W';
    
    // Keep whiteout visible even when completed (do not make transparent)
    const backgroundColor = (hasContent && !isWhiteout)
      ? 'transparent'
      : (isWhiteout ? '#ffffff' : hexToRgba(userColor, 0.6));
    
    const defaultBorderColor = isWhiteout ? '#d1d5db' : hexToRgba(userColor, 0.9);
    const borderColor = isSelected ? PROFESSIONAL_COLORS.borderActive : defaultBorderColor;
    
    let boxShadow = isSelected 
      ? `0 0 0 2px ${PROFESSIONAL_COLORS.borderActive}, ${LAYOUT.shadow.base}` 
      : hasContent && !isWhiteout 
        ? 'none' 
        : 'none';

    // Apply missing tag styling
    if (isMissing && !hasContent && !isWhiteout) {
      // Whiteout should remain white; do not override
      boxShadow = '0 0 0 2px #f59e0b, 0 0 8px rgba(245, 158, 11, 0.3)';
    }
    
    // Apply highlighted styling (takes precedence over missing)
    if (isHighlighted) {
      boxShadow = '0 0 0 3px #3b82f6, 0 0 12px rgba(59, 130, 246, 0.5)';
    }
    
    return {
      backgroundColor,
      border: isWhiteout
        ? `1.5px solid ${borderColor}`
        : (hasContent 
            ? 'none' 
            : `${isMissing && !hasContent ? '2px' : '1.5px'} solid ${borderColor}`),
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
      // Remove transitions to avoid flicker
      transition: 'none',
      boxShadow,
      // DocuSign style enhancements
      position: 'relative' as const,
      overflow: 'visible' as const,
      minHeight: 'fit-content' as const,
      // Disable animations and transitions completely
      animation: 'none !important',
      transform: 'translateZ(0)', // Hardware acceleration
      willChange: 'transform'
    };
  }, [hasContent, isSelected, canEdit, tag.tagType, isMissing, isHighlighted]);

  // Honor per-tag resizability from configuration and current permissions
  const resizable = Boolean(TAG_TYPE_CONFIG[tag.tagType]?.allowResize && canEdit);

  const validateAndSanitizeCoordinates = (coords: any) => {
    const sanitized: any = {};
    
    // Respect configured minimum sizes for the tag type
    const minWidth = fixedDimensions.minWidth ?? 0;
    const minHeight = fixedDimensions.minHeight ?? 25;

    if (coords.x !== undefined) {
      sanitized.x = isFinite(coords.x) ? Math.round(coords.x) : 0;
    }
    if (coords.y !== undefined) {
      sanitized.y = isFinite(coords.y) ? Math.round(coords.y) : 0;
    }
    if (coords.width !== undefined) {
      const w = isFinite(coords.width) && coords.width > 0 ? Math.round(coords.width) : Math.round(minWidth);
      sanitized.width = Math.max(w, Math.round(minWidth));
    }
    if (coords.height !== undefined) {
      const h = isFinite(coords.height) && coords.height > 0 ? Math.round(coords.height) : Math.round(minHeight);
      sanitized.height = Math.max(h, Math.round(minHeight));
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
    // Do not change font size during resize. Only update box dimensions, clamped to type minimums.
    const minWidthVal = TAG_TYPE_CONFIG[tag.tagType]?.minWidth ?? fixedDimensions.minWidth ?? 1;
    const minHeightVal = TAG_TYPE_CONFIG[tag.tagType]?.minHeight ?? fixedDimensions.minHeight ?? 1;

    const newCoordinates = validateAndSanitizeCoordinates({
      width: Math.max(minWidthVal, ref.offsetWidth / scaleFactor),
      height: Math.max(minHeightVal, ref.offsetHeight / scaleFactor),
      // Include position so top/left-origin handles (e.g., top-right) don't cause a jump on commit
      x: position?.x != null ? (position.x / scaleFactor) : undefined,
      y: position?.y != null ? (position.y / scaleFactor) : undefined,
    });
    onUpdate(newCoordinates);
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
    
    // Configured minimums
    const minWidth = TAG_TYPE_CONFIG[tag.tagType]?.minWidth ?? fixedDimensions.minWidth ?? 0;
    const minHeight = TAG_TYPE_CONFIG[tag.tagType]?.minHeight ?? fixedDimensions.minHeight ?? 25;
    
    // Only calculate optimal dimensions for text tags (not others)
    if (tag.tagType === 'T') {
      const content = tag.content || '';
      const optimalWidth = calculateOptimalWidth(content, currentFontSize, TYPOGRAPHY.fontFamily);
      const optimalHeight = Math.max(fixedDimensions.minHeight ?? 1, fixedDimensions.height);
      
      // For text tags, use the larger of manual resize or optimal dimensions
      finalWidth = Math.max(manualWidth, optimalWidth, minWidth);
      finalHeight = Math.max(manualHeight, optimalHeight, minHeight);
      
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
      finalWidth = Math.max(manualWidth, minWidth);
      finalHeight = Math.max(manualHeight, minHeight);
      console.log('📏 Non-text tag resize with manual dimensions (clamped to min):', {
        tagId: tag.id,
        tagType: tag.tagType,
        manualWidth,
        manualHeight,
        finalWidth,
        finalHeight
      });
    }
    
    const newCoordinates = {
      width: Math.round(finalWidth),
      height: Math.round(finalHeight),
      // Commit updated position when resizing from top/left sides
      x: position?.x != null ? Math.round(position.x / scaleFactor) : undefined,
      y: position?.y != null ? Math.round(position.y / scaleFactor) : undefined,
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

  // Determine if this tag should render an image (signature/initials/seal)
  const imageSource: string | null = useMemo(() => {
    try {
      const isImageLike = (v: unknown) =>
        typeof v === 'string' && (
          (v as string).startsWith('data:image/') ||
          /^https?:\/\//.test(v as string) ||
          (v as string).includes('vultrobjects.com')
        );

      const parseMaybeJson = (input: unknown): any | null => {
        if (!input) return null;
        if (typeof input === 'object') return input as any;
        if (typeof input === 'string') {
          const str = input?.toString().trim();
          if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) {
            try { return JSON.parse(str); } catch {}
          }
        }
        return null;
      };

      const findImageInObject = (obj: any): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        for (const key of Object.keys(obj)) {
          const value = obj[key];
          if (isImageLike(value)) return value as string;
          if (value && typeof value === 'object') {
            const nested = findImageInObject(value);
            if (nested) return nested;
          }
        }
        return null;
      };

      const parsedContentData = parseMaybeJson(tag.contentData);
      const parsedContent = parseMaybeJson(tag.content);

      // If server pre-labeled as image via contentType, prefer content value early
      // This avoids flicker where JSON arrives first
      if ((tag as any).contentType === 'image' && typeof tag.content === 'string' && isImageLike(tag.content)) {
        return tag.content;
      }

      const candidates: Array<string | undefined> = [];

      const pushCandidates = (obj: any) => {
        if (!obj) return;
        if (typeof obj.value === 'string') candidates.push(obj.value);
        if (typeof obj.image === 'string') candidates.push(obj.image);
        if (typeof obj.url === 'string') candidates.push(obj.url);
        if (obj.data && typeof obj.data.value === 'string') candidates.push(obj.data.value);
        if (
          obj.contentType === 'image' ||
          ['signature', 'initials', 'seal'].includes(obj.type)
        ) {
          if (typeof obj.value === 'string') candidates.push(obj.value);
          if (typeof obj.image === 'string') candidates.push(obj.image);
          if (typeof obj.url === 'string') candidates.push(obj.url);
        }
        const foundNested = findImageInObject(obj);
        if (foundNested) candidates.push(foundNested);
      };

      pushCandidates(parsedContentData);
      pushCandidates(parsedContent);
      if (typeof tag.content === 'string') candidates.push(tag.content);

      const found = candidates.find((v) => v && isImageLike(v));
      return found || null;
    } catch {
      return null;
    }
  }, [tag.tagType, tag.content, tag.contentData]);

  // Fallback textual content from contentData for non-image tags
  const contentDataText = useMemo(() => {
    try {
      if (!tag.contentData) return null;
      const obj = typeof tag.contentData === 'string' ? JSON.parse(tag.contentData) : tag.contentData;
      const candidate = obj?.value ?? obj?.text ?? obj?.display ?? obj?.data?.value ?? null;
      return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : null;
    } catch {
      return null;
    }
  }, [tag.contentData]);

  return (
        <Rnd
       size={{ width: displayCoords.width, height: displayCoords.height }}
       position={{ x: displayCoords.x, y: displayCoords.y }}
        minWidth={Math.max(1, Math.round(((TAG_TYPE_CONFIG[tag.tagType]?.minWidth ?? fixedDimensions.minWidth ?? 1) * scaleFactor)))}
        minHeight={Math.max(1, Math.round(((TAG_TYPE_CONFIG[tag.tagType]?.minHeight ?? fixedDimensions.minHeight ?? 1) * scaleFactor)))}
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
          // Persist and broadcast final position after drag ends
          if (onSave && canEdit) {
            onSave({
              x: d.x / scaleFactor,
              y: d.y / scaleFactor
            });
          }
       }}
       onResize={handleResize}
       onResizeStop={handleResizeStop}
       enableResizing={{
         top: resizable,
         right: resizable,
         bottom: resizable,
         left: resizable,
         topRight: resizable,
         bottomRight: resizable,
         bottomLeft: resizable,
         topLeft: false
       }}
       resizeHandleStyles={{
         right: { width: '12px', right: '-6px', cursor: 'ew-resize' },
         bottom: { height: '12px', bottom: '-6px', cursor: 'ns-resize' },
         bottomRight: { width: '12px', height: '12px', right: '-6px', bottom: '-6px', cursor: 'nwse-resize', background: PROFESSIONAL_COLORS.borderActive, borderRadius: '50%' }
       }}
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
          // Double-click to trigger interactive fill only; single-click just selects
          const clickTime = e.timeStamp;
          const currentTarget = e.currentTarget as any;
          const lastClickTime = currentTarget._lastClickTime || 0;
          const timeDiff = clickTime - lastClickTime;
          currentTarget._lastClickTime = clickTime;

          if (e.detail === 2 && timeDiff < 500) {
            const rect = currentTarget.getBoundingClientRect();
            console.log('🎯 Double-click confirmed - opening tag interaction:', tag.id, tag.tagType);
            onTagClick(tag, {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height
            });
          } else if (e.detail === 1) {
            // Single-click: select only
            onSelect();
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
        // Let react-rnd control width/height so resizing works as expected
      }}
    >
      <div 
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'flex-end',
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
          imageSource && !imageLoadError ? (
            <img
              src={imageSource}
              alt={TAG_TYPE_CONFIG[tag.tagType]?.label || 'Image'}
              onError={() => setImageLoadError(true)}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
              draggable={false}
            />
          ) : (
                         <span 
               data-text-content
               style={{ 
                 fontFamily: TYPOGRAPHY.fontFamily,
                 fontSize: `${currentFontSize}px`,
                 fontWeight: TYPOGRAPHY.fontWeight.medium,
                 color: '#1e293b', // Dark text for maximum visibility
                 lineHeight: '1',
                 display: 'block',
                 width: '100%',
                 wordWrap: 'break-word',
                 overflowWrap: 'break-word',
                 whiteSpace: 'normal', // Allow text to wrap to multiple lines
                 overflow: 'visible' // Show all content, don't hide overflow
               }}
             >
              {(() => {
                // Avoid rendering raw JSON in the tag box; show a friendly label instead
                const isJsonString = typeof tag.content === 'string' && tag.content.trim().startsWith('{');
                const isSignatureLike = tag.tagType === 'S' || tag.tagType === 'I' || tag.tagType === 'E';
                if (isSignatureLike && (isJsonString || !tag.content)) {
                  return TAG_TYPE_CONFIG[tag.tagType]?.label || 'Signature';
                }
                if (isJsonString) {
                  return tag.displayLabel || TAG_TYPE_CONFIG[tag.tagType]?.label || 'Content';
                }
                return tag.content || contentDataText || tag.displayLabel || TAG_TYPE_CONFIG[tag.tagType]?.label || 'Content';
              })()}
            </span>
          )
        ) : (
          <span style={{ 
            fontFamily: TYPOGRAPHY.fontFamily,
            fontSize: `${Math.max(10, currentFontSize - 2)}px`,
            fontWeight: TYPOGRAPHY.fontWeight.normal, // Lighter weight for better readability
            color: '#1f2937', // Darker text for better readability on transparent background
            fontStyle: 'normal', // Remove italic for better readability
            lineHeight: '1.2',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'normal', // Allow text to wrap
            overflow: 'visible', // Show all content
            textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)' // Add subtle text shadow for better readability
          }}>
            {tag.displayLabel || TAG_TYPE_CONFIG[tag.tagType]?.placeholder || TAG_TYPE_CONFIG[tag.tagType]?.label || 'Field'}
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
        
        {/* User identification indicator */}
        {tag.displayLabel && tag.displayLabel.includes(' - ') && !hasContent && (
          <div 
            style={{
              position: 'absolute',
              top: '2px',
              right: '4px',
              width: '8px',
              height: '8px',
              backgroundColor: tag.colorCode || '#4ECDC4',
              borderRadius: '50%',
              border: '1px solid #ffffff',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
            }}
            title={tag.displayLabel.split(' - ')[1] || 'User'}
          />
        )}
      </div>
    </Rnd>
  );
};

  // Memoize TagRenderer for better performance during drag operations
  const MemoizedTagRenderer = memo(TagRenderer);

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
    // Always allow tag interaction in both tagging and signing modes
    // canPlaceTags controls NEW tag placement, but we want existing tag interaction
    return mode === 'tagging' || mode === 'signing';
  }, [mode]);

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
    // Prefer active text input over a selected tag so the toolbar always
    // targets inline typing first
    if (selectedTextInputId) {
      const selectedTextInput = textInputs?.find((ti) => ti.id === selectedTextInputId);
      console.log('🎯 Selected text input for font size:', selectedTextInputId, 'fontSize:', selectedTextInput?.fontSize);
      return selectedTextInput?.fontSize || lastUsedFontSize;
    }

    if (selectedTag) {
      console.log('🎯 Selected tag for font size:', selectedTag.tagType, selectedTag.id, 'contentData:', selectedTag.contentData);
      // Check local font sizes first, then contentData, then fallback
      const localFontSize = localFontSizes.get(String(selectedTag.id));
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
        const defaultTextFontSize = 16; // Default text size
        console.log('🎯 Using default text font size:', defaultTextFontSize);
        return defaultTextFontSize;
      }
      console.log('🎯 Using lastUsedFontSize:', lastUsedFontSize);
      return lastUsedFontSize;
    }

    return lastUsedFontSize;
  }, [selectedTextInputId, textInputs, lastUsedFontSize, selectedTag?.id, selectedTag?.contentData?.fontSize, selectedTag?.tagType, selectedTag?.content, localFontSizes]);
  
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
    
    // Position tag with bottom-left corner at mouse click for consistent UX
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
    
    // 🚀 REAL-TIME SYNC: Server will broadcast when it processes the API call
    // No need for client-side WebSocket broadcast as it can cause conflicts
  }, [onTagUpdate]);

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
            const tagId = message.payload?.tagId != null ? String(message.payload.tagId) : undefined;
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
        next.set(String(tagId), fontSize);
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
            // Show font control for any tag that allows text input (UI remains here as requested)
            (selectedTag ? Boolean(TAG_TYPE_CONFIG[selectedTag.tagType]?.allowTextInput) : true)
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

                  // Route font changes:
                  // - If a DocumentTag is selected, update via local map and server endpoint
                  // - If a text input is selected, delegate to onFontSizeChange from parent
                  if (selectedTag) {
                    updateTagFontSize(selectedTag.id, newSize);
                  } else if (selectedTextInputId && onFontSizeChange) {
                    onFontSizeChange(selectedTextInputId, newSize);
                  }
                }}
                className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
              >
                {Array.from({ length: 17 }, (_, i) => {
                  const size = 8 + (i * 2);
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
            // Determine which text inputs exist for this page
            const pageTextInputIds = new Set(
              (textInputs || [])
                .filter((ti) => ti.coordinates.pageNumber === pageNumber)
                .map((ti) => ti.id?.toString())
            );
            // Include all non-text tags as usual
            const baseNonTextTags = tags.filter(
              (tag) => tag.coordinates.pageNumber === pageNumber && tag.tagType !== 'T'
            );
            // Fallback: render text tags that have not yet been hydrated into textInputs so they don't vanish
            const missingTextTags = tags.filter(
              (tag) =>
                tag.coordinates.pageNumber === pageNumber &&
                tag.tagType === 'T' &&
                !pageTextInputIds.has(tag.id?.toString())
            );
            const pageTags = [...baseNonTextTags, ...missingTextTags];
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
                  
                  {/* Tags overlay - includes non-text tags and any text tags missing from textInputs (fallback) */}
                                     {pageTags.map(tag => {
                    return (
                      <div key={`${tag.id}`} className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{willChange: 'transform'}}> 
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
              localFontSize={localFontSizes.get(String(tag.id))}
                          isHighlighted={highlightedTagId === tag.id}
                          isMissing={incompleteTags.includes(tag.id)}
                        />
                      </div>
                    );
                  })}
                  
                  {/* Whiteout overlays disabled: handled via 'W' tags for consistency */}

                  {/* Text inputs overlay (separate from regular tags) - STABLE KEY */}
                  {textInputs?.filter(textInput => textInput.coordinates.pageNumber === pageNumber).map((textInput) => {
                    // Use creation timestamp as a stable key so temp->server ID swap doesn't remount
                    const createdAt = (textInput as any).createdAt;
                    const createdKey = createdAt ? (createdAt instanceof Date ? createdAt.getTime() : Date.parse(createdAt)) : undefined;
                    const primaryKey = createdKey ? `text-${createdKey}` : `text-${textInput.id}`;
                     
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