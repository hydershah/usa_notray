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
  TAG_TYPE_CONFIG 
} from '@/lib/constants/tagConstants';

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
  
  // Create display coordinates scaled for current zoom level
  const displayCoords = {
    x: coordinates.x * scaleFactor,
    y: coordinates.y * scaleFactor,
    // Use saved dimensions with fallback, and scale to current zoom
    width: (coordinates.width || fixedDimensions.width) * scaleFactor,
    height: (coordinates.height || fixedDimensions.height) * scaleFactor
  };

  // Keep local live position in sync when not dragging
  useEffect(() => {
    if (!isDragging) {
      setLivePosition({ x: displayCoords.x, y: displayCoords.y });
    }
  }, [displayCoords.x, displayCoords.y, isDragging]);

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

  // Min/Max constraints for resize
  const minWidthPx = (fixedDimensions.minWidth || 80) * scaleFactor;
  const maxWidthPx = 800 * scaleFactor; // generous maximum
  const minHeightPx = (fixedDimensions.minHeight || 20) * scaleFactor;
  const maxHeightPx = 120 * scaleFactor; // keep single-line ergonomics
  
  // Memoized professional styling
  const professionalStyle = useMemo(() => getTagStyle('T', isSelected, hasContent, userColor), [hasContent, isSelected, userColor]);

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
        case 'Delete':
        case 'Backspace':
          if (!isEditing) {
            e.preventDefault();
            onDelete();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, isEditing, content, onDelete]);

  // Save content with debouncing
  const debouncedSave = useCallback(
    debounce(async (value: string) => {
      // Optimistically update local store immediately so typing persists
      onSave(value);

      // If this is a temporary ID, skip server save until real ID is assigned
      const isTempId = id.startsWith('text_temp_') || id.startsWith('temp');
      if (isTempId) {
        return;
      }

      try {
        const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${id}/content`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
              content: value,
              fontSize: 14,
              fontFamily: TYPOGRAPHY.fontFamily,
              textColor: PROFESSIONAL_COLORS.text
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to save: ${response.status}`);
        }

        // Broadcast via WebSocket
        if (webSocket && webSocket.readyState === WebSocket.OPEN) {
          webSocket.send(JSON.stringify({
            // Use existing server-supported event for text input content changes
            type: 'text_input_changed',
            payload: {
              textInputId: id,
              content: value,
              coordinates,
              // keep coordinates in payload; sessionId will be at the top level
            },
            userId: assignedUserId.toString(),
            sessionId,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('Save failed:', error);
        toast({
          title: "Save Error",
          description: "Failed to save text content",
          variant: "destructive"
        });
      }
    }, 500),
    [id, sessionId, coordinates, assignedUserId, webSocket, onSave, toast]
  );

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    debouncedSave(newValue);
  };

  // Handle input blur (save and exit edit mode)
  const handleInputBlur = () => {
                setIsEditing(false);
    if (inputValue !== content) {
      debouncedSave.cancel();
      debouncedSave(inputValue);
    }
  };

  // Handle input Enter key
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInputBlur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setInputValue(content);
      setIsEditing(false);
    }
  };

  // We avoid store updates during drag for ultra-smooth movement; persist on drag stop only
 
  // Handle drag events with smooth updates
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDrag = useCallback((e: any, data: any) => {
    // Update only local pixel position; skip store updates until drag stops
    setLivePosition({ x: data.x, y: data.y });
  }, []);

  const handleDragStop = useCallback((e: any, data: any) => {
    setIsDragging(false);
    
    // Snap to grid for professional alignment on drop
    const snappedX = snapToGrid(data.x / scaleFactor);
    const snappedY = snapToGrid(data.y / scaleFactor);
    
    // Final update with snapped coordinates
    if (onMove) {
      onMove({ x: snappedX, y: snappedY });
    }
  }, [scaleFactor, onMove]);

  // Handle resize
  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleResize = useCallback((e: any, direction: any, ref: any, delta: any, position: any) => {
    // Update local visual size only; do not persist mid-resize to avoid jitter
    setControlledSize({
      width: ref.offsetWidth,
      height: ref.offsetHeight
    });
  }, []);

  const handleResizeStop = useCallback((e: any, direction: any, ref: any, delta: any, position: any) => {
    // Update controlled size
    setControlledSize({
      width: ref.offsetWidth,
      height: ref.offsetHeight
    });
    
    // Final resize update with snapped coordinates
    if (onResize) {
      const snappedX = snapToGrid(position.x / scaleFactor);
      const snappedY = snapToGrid(position.y / scaleFactor);
      const snappedWidth = snapToGrid(ref.offsetWidth / scaleFactor);
      const snappedHeight = snapToGrid(ref.offsetHeight / scaleFactor);
      
      onResize({
        x: snappedX,
        y: snappedY,
        width: Math.max(snappedWidth, 40), // Minimum width
        height: Math.max(snappedHeight, 20) // Minimum height
      });
    }
    setIsResizing(false);
  }, [scaleFactor, onResize]);

  // Handle container click
  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (onSelect) {
      onSelect();
    }
    
    // Focus the container so keyboard events work
    (e.currentTarget as HTMLElement).focus();
    
    // Single-click just selects the tag, double-click or Enter starts editing
    // This allows users to select the tag and then press Delete to remove it
  };

  // Handle double-click to start editing
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  // Measure text width to auto-grow container horizontally (single line)
  const measureTextWidth = useCallback((text: string, fontPx: number, family: string) => {
    if (typeof document === 'undefined') return 0;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return 0;
    context.font = `${fontPx}px ${family}`;
    const metrics = context.measureText(text || '');
    return metrics.width;
  }, []);

  // Recalculate local width when font size or content changes to keep border snug
  useEffect(() => {
    const paddingPx = 8;
    const baseMinWidthPx = fixedDimensions.width * scaleFactor;
    const textWidth = measureTextWidth(inputValue, fontSize, fontFamily) + paddingPx;
    const desiredPx = Math.max(baseMinWidthPx, Math.ceil(textWidth));
    setControlledSize(prev => ({ ...prev, width: desiredPx }));
  }, [fontSize, fontFamily, inputValue, scaleFactor, fixedDimensions.width, measureTextWidth]);

  // Auto-resize width (grow and retract) while editing; keep height as-is
  useEffect(() => {
    if (!isEditing || isResizing) return;
    const paddingPx = 8; // left padding 4px + small buffer
    const baseMinWidthPx = fixedDimensions.width * scaleFactor; // constant min width
    const measuredPx = measureTextWidth(inputValue, fontSize, fontFamily) + paddingPx;
    const desiredWidthPx = Math.max(baseMinWidthPx, Math.ceil(measuredPx));
    const desiredWidthUnscaled = desiredWidthPx / scaleFactor;

    // Trigger when width meaningfully changed (allows shrink and expand)
    const currentWidthUnscaled = coordinates.width || fixedDimensions.width;
    if (onResize && Math.abs(currentWidthUnscaled - desiredWidthUnscaled) > 0.5) {
      onResize({
        x: coordinates.x,
        y: coordinates.y,
        width: desiredWidthUnscaled,
        height: coordinates.height || fixedDimensions.height
      });
    }
  }, [isEditing, isResizing, inputValue, fontSize, fontFamily, scaleFactor, coordinates.x, coordinates.y, coordinates.width, coordinates.height, fixedDimensions.width, fixedDimensions.height, onResize, measureTextWidth]);

  // Ensure height fits font size when font changes (single-line field)
  useEffect(() => {
    if (isResizing) return;
    const minHeight = Math.max(fixedDimensions.height, Math.ceil(fontSize + 6));
    const currentHeight = coordinates.height || fixedDimensions.height;
    if (onResize && minHeight - currentHeight > 0.5) {
      onResize({
        x: coordinates.x,
        y: coordinates.y,
        width: coordinates.width || fixedDimensions.width,
        height: minHeight
      });
    }
  }, [fontSize, isResizing, coordinates.x, coordinates.y, coordinates.width, coordinates.height, fixedDimensions.width, fixedDimensions.height, onResize]);

  return (
    <Rnd
      size={{ width: isResizing ? controlledSize.width : displayCoords.width, height: isResizing ? controlledSize.height : displayCoords.height }}
      position={isDragging && livePosition ? livePosition : { x: displayCoords.x, y: displayCoords.y }}
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
      maxWidth={maxWidthPx}
      minHeight={minHeightPx}
      maxHeight={maxHeightPx}
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
        // Very light gray background when empty for better visibility
        backgroundColor: hasContent ? 'transparent' : '#f3f4f6',
        pointerEvents: 'auto',
        zIndex: isSelected ? 1000 : 100,
        padding: '0', // SIMPLE: No padding on container
        boxSizing: 'border-box',
        cursor: isEditing ? 'text' : 'grab',
        lineHeight: 1
      }}
    >
      <div
        onClick={handleContainerClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={(e) => {
          if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditing) {
            e.preventDefault();
            onDelete();
          } else if (e.key === 'Enter' && !isEditing) {
            e.preventDefault();
            setIsEditing(true);
          }
        }}
        tabIndex={0}
        className={isEditing ? '' : 'drag-handle'}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          border: 'none',
          background: 'transparent',
          outline: 'none',
          fontFamily: fontFamily,
          fontSize: `${fontSize}px`,
          fontWeight: TYPOGRAPHY.fontWeight.medium,
          color: textColor,
          cursor: isEditing ? 'text' : (isSelected ? 'pointer' : 'grab'),
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
              padding: '0',
              paddingLeft: '4px',
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
              paddingLeft: '4px',
              textOverflow: 'clip',
              whiteSpace: 'nowrap',
              color: hasContent ? textColor : PROFESSIONAL_COLORS.textPlaceholder,
              fontStyle: hasContent ? 'normal' : 'italic',
              fontFamily: fontFamily,
              fontSize: `${fontSize}px`,
              overflow: 'hidden',
              lineHeight: 1
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
}

.professional-text-tag.selected {
  box-shadow: 0 0 0 2px ${PROFESSIONAL_COLORS.borderActive};
}

.professional-text-tag.dragging {
  transform: rotate(1deg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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