import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { Rnd } from 'react-rnd';
import { useToast } from '@/hooks/use-toast';
import { 
  getTagDimensions, 
  getTagStyle, 
  snapToGrid, 
  isWithinBounds,
  PROFESSIONAL_COLORS,
  TYPOGRAPHY,
  LAYOUT,
  TAG_TYPE_CONFIG,
  calculateOptimalWidth
} from '@/lib/constants/tagConstants';
import { useEditorStore } from '@/hooks/editor/useEditorStore';

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;
  
  const debounced = ((...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T & { cancel: () => void };
  
  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  
  return debounced;
}

interface StreamlinedTextInputProps {
  id: string;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
    pageNumber: number;
  };
  sessionId: string;
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  assignedUserId: number;
  userColor: string;
  isNew?: boolean;
  isSelected?: boolean;
  scaleFactor: number;
  onSave: (content: string) => void;
  onDelete: () => void;
  onSelect?: () => void;
  onMove?: (newCoordinates: { x: number; y: number }) => void;
  onResize?: (newCoordinates: { x: number; y: number; width: number; height: number }) => void;
  onFontSizeChange?: (fontSize: number) => void;
  webSocket?: WebSocket | null;
}

const StreamlinedTextInputComponent: React.FC<StreamlinedTextInputProps> = ({
  id,
  coordinates,
  sessionId,
  content = '',
  fontSize = 16,
  fontFamily = 'Arial',
  textColor = '#000000',
  assignedUserId,
  userColor,
  isNew = false,
  isSelected = false,
  scaleFactor,
  onSave,
  onDelete,
  onSelect,
  onMove,
  onResize,
  webSocket
}) => {
  // Simplified state - DocuSign style
  const [inputValue, setInputValue] = useState(content);
  const [isEditing, setIsEditing] = useState(isNew);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  // Keep a local live position in pixels for ultra-smooth dragging
  const [livePosition, setLivePosition] = useState<{ x: number; y: number } | null>(null);
  
  // requestAnimationFrame throttling for ultra-smooth drag updates
  const rafRef = useRef<number | null>(null);
  const latestDragPosRef = useRef<{ x: number; y: number } | null>(null);
  const cancelPendingRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);
  
  const scheduleDragUpdate = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      if (latestDragPosRef.current) {
        setLivePosition(latestDragPosRef.current);
      }
      rafRef.current = null;
    });
  }, []);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Memoized calculations for better performance
  const fixedDimensions = useMemo(() => getTagDimensions('T'), []);
  const hasContent = useMemo(() => inputValue.trim().length > 0, [inputValue]);
  
  // Debug logging for scale factor
  useEffect(() => {
    console.log('🔍 DEBUG: StreamlinedTextInput scale factor analysis:', {
      fixedDimensions,
      scaleFactor,
      scaledWidth: fixedDimensions.width * scaleFactor,
      scaledHeight: fixedDimensions.height * scaleFactor
    });
  }, [fixedDimensions, scaleFactor]);
  
  // State for controlled dimensions - use fixed dimensions for text tags (no scaling)
  const [controlledSize, setControlledSize] = useState({
    width: fixedDimensions.width,  // Don't scale for text tags
    height: fixedDimensions.height  // Don't scale for text tags
  });
  
  // Update controlled size when scale factor changes (but don't scale for text tags)
  useEffect(() => {
    setControlledSize({
      width: fixedDimensions.width,  // Don't scale for text tags
      height: fixedDimensions.height  // Don't scale for text tags
    });
  }, [scaleFactor, fixedDimensions.width, fixedDimensions.height]);
  
  // Auto width based on content while editing; otherwise honor saved/manual size
  const autoUnscaledWidth = useMemo(() => {
    // Calculate in display pixels then convert to unscaled PDF units
    const displayWidthPx = calculateOptimalWidth(inputValue, fontSize, fontFamily);
    const unscaled = displayWidthPx / Math.max(0.0001, scaleFactor);
    return Math.max(fixedDimensions.width, unscaled);
  }, [inputValue, fontSize, fontFamily, fixedDimensions.width, scaleFactor]);

  // Auto height at least matches current font size line-height while editing
  const autoUnscaledHeight = useMemo(() => {
    const lineHeightPx = Math.ceil(fontSize * 1.2);
    const unscaled = lineHeightPx / Math.max(0.0001, scaleFactor);
    return Math.max(fixedDimensions.height, unscaled);
  }, [fontSize, fixedDimensions.height, scaleFactor]);
 
  // Compute display coordinates (match PDFViewer sizing logic)
  const displayCoords = useMemo(() => {
    const savedWidth = coordinates.width || fixedDimensions.width;
    const savedHeight = coordinates.height || fixedDimensions.height;

    // When editing, auto-fit to content (grow and shrink). When not editing, use saved/manual size.
    const finalUnscaledWidth = isEditing ? autoUnscaledWidth : savedWidth;
    const finalUnscaledHeight = Math.max(savedHeight, isEditing ? autoUnscaledHeight : savedHeight, fixedDimensions.height);

    return {
      x: Math.round(coordinates.x * scaleFactor),
      y: Math.round(coordinates.y * scaleFactor),
      width: Math.round(finalUnscaledWidth * scaleFactor),
      height: Math.round(finalUnscaledHeight * scaleFactor)
    };
  }, [coordinates.x, coordinates.y, coordinates.width, coordinates.height, fixedDimensions.height, fixedDimensions.width, scaleFactor, isEditing, autoUnscaledWidth, autoUnscaledHeight]);

  // Keep local live position in sync when not dragging
  useEffect(() => {
    if (!isDragging) {
      setLivePosition({ x: displayCoords.x, y: displayCoords.y });
    }
  }, [displayCoords.x, displayCoords.y, isDragging]);

  // Ensure any pending RAF is cancelled on unmount
  useEffect(() => {
    return () => {
      cancelPendingRaf();
    };
  }, [cancelPendingRaf]);

  // Allow width-only manual resizing
  const enableResizing = {
    top: false,
    right: true,
    bottom: true,
    left: false,
    topRight: false,
    bottomRight: true,
    bottomLeft: false,
    topLeft: false
  };
  
  const canEdit = true; // Always allow editing for text inputs

  // Min/Max constraints for resize (visual – independent of zoom)
  const minWidthPx = 1;
  const maxWidthPx = 800; // generous maximum
  const minHeightPx = 1;
  const maxHeightPx = 120; // keep single-line ergonomics
  
  // Memoized professional styling
  const professionalStyle = useMemo(() => getTagStyle('T', isSelected, hasContent, userColor), [hasContent, isSelected, userColor]); // keeping reference for potential future use

  // Auto-focus when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isSelected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          if (!isEditing) {
            e.preventDefault();
            setIsEditing(true);
          }
          break;
        case 'Escape':
          if (isEditing) {
            e.preventDefault();
            setInputValue(content);
            setIsEditing(false);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, isEditing, content]);

  const handleDragStart = (_: any, data: any) => {
    setIsDragging(true);
    latestDragPosRef.current = { x: data.x, y: data.y };
    scheduleDragUpdate();
  };
  const handleDrag = (_: any, data: any) => {
    latestDragPosRef.current = { x: data.x, y: data.y };
    scheduleDragUpdate();
  };
  const handleDragStop = (_: any, data: any) => {
    setIsDragging(false);
    setLivePosition({ x: data.x, y: data.y });
    onMove?.({ x: data.x / scaleFactor, y: data.y / scaleFactor });
  };

  const handleResizeStart = () => setIsResizing(true);
  const handleResize = (_: any, __: any, ref: any) => {
    setIsResizing(true);
    onResize?.({
      x: coordinates.x,
      y: coordinates.y,
      width: ref.offsetWidth / scaleFactor,
      height: ref.offsetHeight / scaleFactor
    });
  };
  const handleResizeStop = (_: any, __: any, ref: any) => {
    setIsResizing(false);
    onResize?.({
      x: coordinates.x,
      y: coordinates.y,
      width: Math.max(1, Math.round(ref.offsetWidth / scaleFactor)),
      height: Math.max(1, Math.round(ref.offsetHeight / scaleFactor))
    });
  };

  const handleContainerClick = () => {
    if (!isEditing) onSelect?.();
  };

  // Allow double-click to start editing immediately and focus the input
  const handleContainerDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect?.();
    setIsEditing(true);
    // Ensure focus after state update
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value);
  const handleInputBlur = () => {
    setIsEditing(false);
    // Persist auto-sized dimensions based on current content
    onResize?.({
      x: coordinates.x,
      y: coordinates.y,
      width: Math.max(1, Math.round(autoUnscaledWidth)),
      height: Math.max(1, Math.round(autoUnscaledHeight))
    });
    onSave(inputValue);
  };
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsEditing(false);
      // Persist auto-sized dimensions on commit
      onResize?.({
        x: coordinates.x,
        y: coordinates.y,
        width: Math.max(1, Math.round(autoUnscaledWidth)),
        height: Math.max(1, Math.round(autoUnscaledHeight))
      });
      onSave(inputValue);
    }
  };

  return (
    <Rnd
      size={{ width: isResizing ? controlledSize.width : displayCoords.width, height: isResizing ? controlledSize.height : displayCoords.height }}
      position={isDragging && livePosition ? (livePosition as { x: number; y: number }) : { x: displayCoords.x, y: displayCoords.y }}
      onDrag={handleDrag}
      onDragStart={handleDragStart}
      onDragStop={handleDragStop}
      onResizeStart={handleResizeStart}
      onResize={handleResize}
      onResizeStop={handleResizeStop}
      enableResizing={enableResizing}
      disableDragging={!canEdit}
      bounds="parent"
      cancel=".no-drag"
      minWidth={minWidthPx}
      minHeight={minHeightPx}
      dragGrid={[1, 1]}
      className={
        `
        professional-text-tag
        ${isSelected ? 'selected' : ''}
        ${isDragging ? 'dragging' : ''}
        ${hasContent ? 'has-content' : 'empty'}
      `}
      style={{
        border: isSelected 
          ? `2px solid ${PROFESSIONAL_COLORS.borderActive}` 
          : hasContent 
            ? 'none' 
            : `1px solid ${PROFESSIONAL_COLORS.border}`,
        borderRadius: LAYOUT.borderRadius.base,
        backgroundColor: hasContent ? 'transparent' : '#f3f4f6',
        pointerEvents: 'auto',
        zIndex: isSelected ? 1000 : 100,
        padding: '0',
        boxSizing: 'border-box',
        cursor: isEditing ? 'text' : 'grab',
        lineHeight: 1,
        willChange: 'transform',
        backfaceVisibility: 'hidden'
      }}
    >
      <div
        onClick={handleContainerClick}
        onDoubleClick={handleContainerDoubleClick}
        data-text-input-id={id}
        className="streamlined-text-input"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          background: 'transparent',
          userSelect: isEditing ? 'text' : 'none',
          pointerEvents: 'auto',
          lineHeight: 1
        }}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            placeholder={TAG_TYPE_CONFIG.T.placeholder}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontFamily: fontFamily,
              fontSize: `${fontSize}px`,
              fontWeight: TYPOGRAPHY.fontWeight.medium,
              color: textColor,
              padding: 0,
              textAlign: 'left',
              lineHeight: 1,
              whiteSpace: 'nowrap'
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              textOverflow: 'clip',
              whiteSpace: 'nowrap',
              color: hasContent ? textColor : PROFESSIONAL_COLORS.textPlaceholder,
              fontStyle: hasContent ? 'normal' : 'italic',
              fontFamily: fontFamily,
              fontSize: `${fontSize}px`,
              overflow: 'hidden',
              lineHeight: 1,
              padding: 0
            }}
          >
            {hasContent ? inputValue : TAG_TYPE_CONFIG.T.placeholder}
          </div>
        )}
      </div>
      
      {/* Professional selection indicator */}
      {isSelected && (
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
          Text Field
        </div>
      )}
    </Rnd>
  );
};

// Export memoized component for better performance
export const StreamlinedTextInput = memo(StreamlinedTextInputComponent);

// Add professional CSS for the component
const professionalStyles = `
.professional-text-tag {
  font-family: ${TYPOGRAPHY.fontFamily};
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  backface-visibility: hidden;
}

.professional-text-tag.selected {
  box-shadow: 0 0 0 2px ${PROFESSIONAL_COLORS.borderActive};
}

.professional-text-tag.dragging {
  transition: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.professional-text-tag.has-content {
  background-color: rgba(220, 252, 231, 0.8);
  border-color: ${PROFESSIONAL_COLORS.borderCompleted};
}

.professional-text-tag.empty {
  background-color: rgba(255, 255, 255, 0.8);
  border-color: ${PROFESSIONAL_COLORS.border};
}
`;

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('professional-text-tag-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'professional-text-tag-styles';
  styleSheet.textContent = professionalStyles;
  document.head.appendChild(styleSheet);
}

export default StreamlinedTextInput;