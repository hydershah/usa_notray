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
  readOnly?: boolean;
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
  webSocket,
  readOnly = false
}) => {
  // Simplified state - DocuSign style
  const [inputValue, setInputValue] = useState(content);
  const [isEditing, setIsEditing] = useState(isNew && !readOnly);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Memoized calculations for better performance
  const fixedDimensions = useMemo(() => getTagDimensions('T'), []);
  const hasContent = useMemo(() => inputValue.trim().length > 0, [inputValue]);
  
  // Calculate optimal width based on content with padding
  const optimalWidth = useMemo(() => {
    // Add extra padding to ensure text is never cut off
    const padding = 16; // Extra padding in pixels
    const widthPx = calculateOptimalWidth(inputValue, fontSize, fontFamily) + padding;
    return Math.max(fixedDimensions.minWidth || 120, Math.round(widthPx / scaleFactor));
  }, [inputValue, fontSize, fontFamily, scaleFactor, fixedDimensions.minWidth]);
  
  // Calculate optimal height based on font size
  const optimalHeight = useMemo(() => {
    // Ensure height accommodates the font size with padding
    const lineHeight = fontSize * 1.5; // 1.5x line height for comfortable spacing
    const padding = 8; // Vertical padding
    const heightPx = lineHeight + padding;
    return Math.max(fixedDimensions.height || 25, Math.round(heightPx / scaleFactor));
  }, [fontSize, scaleFactor, fixedDimensions.height]);

  // Calculate display coordinates - always use optimal dimensions for text visibility
  const displayCoords = useMemo(() => {
    // Always use at least the optimal dimensions to ensure text is never hidden
    const width = Math.max(coordinates.width || 0, optimalWidth);
    const height = Math.max(coordinates.height || 0, optimalHeight);
    
    return {
      x: Math.round(coordinates.x * scaleFactor),
      y: Math.round(coordinates.y * scaleFactor),
      width: Math.round(width * scaleFactor),
      height: Math.round(height * scaleFactor)
    };
  }, [coordinates.x, coordinates.y, coordinates.width, coordinates.height, scaleFactor, optimalWidth, optimalHeight]);

  // Enable resizing
  const enableResizing = !isEditing && !readOnly ? {
    top: false,
    right: true,
    bottom: true,
    left: false,
    topRight: false,
    bottomRight: true,
    bottomLeft: false,
    topLeft: false
  } : false;
  
  // Auto-focus when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  // Inform store that a text input is active to suppress hotkeys
  useEffect(() => {
    try {
      const setActiveTextInputId = (useEditorStore.getState() as any).setActiveTextInputId;
      if (setActiveTextInputId) {
        setActiveTextInputId(isEditing ? id : null);
      }
    } catch {}
    return () => {
      try {
        const setActiveTextInputId = (useEditorStore.getState() as any).setActiveTextInputId;
        if (setActiveTextInputId) setActiveTextInputId(null);
      } catch {}
    };
  }, [isEditing, id]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isSelected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          if (!isEditing && !readOnly) {
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
  }, [isSelected, isEditing, content, readOnly, onDelete]);

  // Handle drag operations (live local updates to prevent snap-back)
  const handleDrag = useCallback((_: any, data: any) => {
    const newX = Math.round(data.x / scaleFactor);
    const newY = Math.round(data.y / scaleFactor);
    onMove?.({ x: newX, y: newY });
  }, [scaleFactor, onMove]);

  const handleDragStop = useCallback((_: any, data: any) => {
    setIsDragging(false);
    const newX = Math.round(data.x / scaleFactor);
    const newY = Math.round(data.y / scaleFactor);
    onMove?.({ x: newX, y: newY });
  }, [scaleFactor, onMove]);

  // Handle resize operations
  const handleResizeStop = useCallback((_: any, __: any, ref: any) => {
    setIsResizing(false);
    // Ensure resized dimensions are at least as large as optimal dimensions
    const newWidth = Math.max(optimalWidth, Math.round(ref.offsetWidth / scaleFactor));
    const newHeight = Math.max(optimalHeight, Math.round(ref.offsetHeight / scaleFactor));
    
    onResize?.({
      x: coordinates.x,
      y: coordinates.y,
      width: newWidth,
      height: newHeight
    });
  }, [scaleFactor, coordinates.x, coordinates.y, optimalWidth, optimalHeight, onResize]);

  // Handle container click
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      onSelect?.();
    }
  }, [isEditing, onSelect]);

  // Handle double-click to edit
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!readOnly && !isEditing) {
      setIsEditing(true);
      onSelect?.();
      // Clear any selected non-text tag so toolbar routes to this input
      try { (useEditorStore.getState() as any).selectTag?.(null); } catch {}
    }
  }, [readOnly, isEditing, onSelect]);

  // Handle input changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  // Handle input blur
  const handleInputBlur = useCallback(() => {
    setIsEditing(false);
    if (inputValue !== content) {
      onSave(inputValue);
    }
  }, [inputValue, content, onSave]);

  // Handle input key down
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsEditing(false);
      if (inputValue !== content) {
        onSave(inputValue);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setInputValue(content);
      setIsEditing(false);
    }
  }, [inputValue, content, onSave]);

  // Sync content from props
  useEffect(() => {
    // Only sync from props when not editing and when this tag is not newly created
    if (!isEditing && content !== inputValue && !isNew) {
      setInputValue(content);
    }
  }, [content, isEditing]);

  // Professional styling with subtle grey outline
  const containerStyle = useMemo(() => ({
    border: isSelected 
      ? '0.5px solid rgba(107, 114, 128, 0.5)' // Grey with 0.5 opacity
      : hasContent 
        ? 'none' 
        : '0.5px solid rgba(209, 213, 219, 0.5)', // Light grey for empty state
    borderRadius: LAYOUT.borderRadius.base,
    backgroundColor: hasContent ? 'transparent' : '#f3f4f6',
    pointerEvents: 'auto' as const,
    zIndex: isSelected ? 1000 : 100,
    padding: '0',
    boxSizing: 'border-box' as const,
    cursor: isEditing ? 'text' : 'move',
    transition: 'none',
    minWidth: 'fit-content',
    minHeight: 'fit-content',
  }), [isSelected, hasContent, isEditing]);

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
      onDragStart={() => setIsDragging(true)}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResizeStart={() => setIsResizing(true)}
      onResizeStop={handleResizeStop}
      enableResizing={enableResizing}
      disableDragging={isEditing || readOnly}
      bounds="parent"
      cancel=".no-drag"
      dragGrid={[1, 1]}
      resizeGrid={[1, 1]}
      className={`professional-text-tag ${isSelected ? 'selected' : ''}`}
      style={containerStyle}
    >
      <div
        onClick={handleContainerClick}
        onDoubleClick={handleDoubleClick}
        data-text-input-id={id}
        className="streamlined-text-input"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '4px 8px',
          userSelect: isEditing ? 'text' : 'none',
          overflow: 'visible',
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
            className="no-drag"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontFamily: fontFamily,
              fontSize: `${hasContent ? fontSize : Math.max(10, Math.round(fontSize * 0.85))}px`,
              fontWeight: TYPOGRAPHY.fontWeight.medium,
              color: textColor,
              padding: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              overflow: 'visible',
              whiteSpace: 'nowrap',
              color: hasContent ? textColor : PROFESSIONAL_COLORS.textPlaceholder,
              fontStyle: hasContent ? 'normal' : 'italic',
              fontFamily: fontFamily,
              fontSize: `${hasContent ? fontSize : Math.max(10, Math.round(fontSize * 0.85))}px`,
              fontWeight: hasContent ? TYPOGRAPHY.fontWeight.medium : TYPOGRAPHY.fontWeight.normal,
            }}
          >
            {hasContent ? inputValue : TAG_TYPE_CONFIG.T.placeholder}
          </div>
        )}
      </div>
      
      {/* Selection indicator */}
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
  transition: none !important;
}

.professional-text-tag.selected {
  /* Subtle grey outline instead of thick blue */
  box-shadow: none !important;
}

.professional-text-tag input {
  font-family: inherit;
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