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
  
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Memoized calculations for better performance
  const fixedDimensions = useMemo(() => getTagDimensions('T'), []);
  const hasContent = useMemo(() => inputValue.trim().length > 0, [inputValue]);
  
  // Memoized display coordinates - use actual coordinates for width/height if available
  const displayCoords = useMemo(() => ({
    x: Math.round(coordinates.x * scaleFactor),
    y: Math.round(coordinates.y * scaleFactor),
    width: Math.round((coordinates.width || fixedDimensions.width) * scaleFactor),
    height: Math.round((coordinates.height || fixedDimensions.height) * scaleFactor)
  }), [coordinates.x, coordinates.y, coordinates.width, coordinates.height, scaleFactor, fixedDimensions.width, fixedDimensions.height]);
  
  // Memoized professional styling
  const professionalStyle = useMemo(() => getTagStyle('T', isSelected, hasContent), [hasContent, isSelected]);

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
          type: 'text_input_saved',
          payload: {
            textInputId: id,
              content: value,
            coordinates,
              sessionId
          },
          userId: assignedUserId.toString(),
          timestamp: Date.now()
        }));
      }
      
        onSave(value);
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

  // Throttle drag updates for smooth performance
  const throttledOnMove = useRef<((coords: any) => void) | null>(null);
  
  useEffect(() => {
    let lastUpdate = 0;
    throttledOnMove.current = (coords: any) => {
      const now = Date.now();
      if (now - lastUpdate > 8) { // ~120fps throttling for smooth drag
        if (onMove) {
          onMove(coords);
        }
        lastUpdate = now;
      }
    };
  }, [onMove]);

  // Handle drag events with smooth updates
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDrag = useCallback((e: any, data: any) => {
    if (!throttledOnMove.current) return;
    
    // Smooth drag updates without snap-to-grid during drag for better performance
    const newCoordinates = {
      x: data.x / scaleFactor,
      y: data.y / scaleFactor
    };
    
    throttledOnMove.current(newCoordinates);
  }, [scaleFactor]);

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
  const handleResize = useCallback((e: any, direction: any, ref: any, delta: any, position: any) => {
    // Update coordinates during resize for live feedback
    if (onResize) {
      const newCoordinates = {
        x: position.x / scaleFactor,
        y: position.y / scaleFactor,
        width: ref.offsetWidth / scaleFactor,
        height: ref.offsetHeight / scaleFactor
      };
      onResize(newCoordinates);
    }
  }, [scaleFactor, onResize]);

  const handleResizeStop = useCallback((e: any, direction: any, ref: any, delta: any, position: any) => {
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
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResize={handleResize}
      onResizeStop={handleResizeStop}
        disableDragging={isEditing}
      dragHandleClassName="drag-handle"
      enableResizing={{
        top: false,
        right: true,
        bottom: true,
        left: false,
        topRight: false,
        bottomRight: true,
        bottomLeft: false,
        topLeft: false
      }} // Enable corner and edge resizing for text tags
        bounds="parent"
      cancel=".no-drag"
      className={`
        professional-text-tag
        ${isSelected ? 'selected' : ''}
        ${isDragging ? 'dragging' : ''}
        ${hasContent ? 'has-content' : 'empty'}
      `}
        style={{
        position: 'absolute',
        zIndex: isSelected ? 1000 : isDragging ? 999 : 100,
        pointerEvents: 'auto'
      }}
    >
      <div
        onClick={handleContainerClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={(e) => {
          // Handle delete key when text input is focused but not editing
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
          ...professionalStyle,
          backgroundColor: hasContent ? 'rgba(220, 252, 231, 0.8)' : 'rgba(255, 255, 255, 0.8)', // Semi-transparent background
          width: '100%',
          height: '100%',
          position: 'relative',
          cursor: isEditing ? 'text' : (isSelected ? 'pointer' : 'grab'),
          pointerEvents: 'auto', // Ensure interactions work
          outline: isSelected && !isEditing ? '2px solid #3b82f6' : 'none' // Show selection state
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
              fontFamily: TYPOGRAPHY.fontFamily,
              fontSize: TYPOGRAPHY.fontSize.tag,
              fontWeight: TYPOGRAPHY.fontWeight.medium,
              color: PROFESSIONAL_COLORS.text,
              padding: '0'
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
                  overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: hasContent ? PROFESSIONAL_COLORS.text : PROFESSIONAL_COLORS.textPlaceholder,
              fontStyle: hasContent ? 'normal' : 'italic'
            }}
          >
            {hasContent ? inputValue : TAG_TYPE_CONFIG.T.placeholder}
          </div>
        )}
        
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
      </div>
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
  background-color: ${PROFESSIONAL_COLORS.completed};
  border-color: ${PROFESSIONAL_COLORS.borderCompleted};
}

.professional-text-tag.empty {
  background-color: ${PROFESSIONAL_COLORS.background};
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