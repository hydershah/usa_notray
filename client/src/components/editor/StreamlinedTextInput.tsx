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
  // Keep a local live position in pixels for ultra-smooth dragging
  const [livePosition, setLivePosition] = useState<{ x: number; y: number } | null>(null);
  
  // requestAnimationFrame throttling for ultra-smooth drag updates
  const rafRef = useRef<number | null>(null);
  const latestDragPosRef = useRef<{ x: number; y: number } | null>(null);
  // Persist manual resize preference until content/font changes
  const manualOverrideRef = useRef<boolean>(false);
  const lastAutoInputsRef = useRef<{ content: string; fontSize: number }>({ content: content, fontSize });
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
  const containerFocusRef = useRef<HTMLDivElement>(null);
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
  
  // State for controlled dimensions - start with saved or default size
  const [controlledSize, setControlledSize] = useState({
    width: Math.max(coordinates.width || fixedDimensions.width, fixedDimensions.minWidth ?? 1) * scaleFactor,
    height: Math.max(coordinates.height || fixedDimensions.height, fixedDimensions.minHeight ?? 1) * scaleFactor
  });
  
  // Keep controlled size in sync when scale or saved size changes
  useEffect(() => {
    setControlledSize({
      width: Math.round(Math.max(coordinates.width || fixedDimensions.width, fixedDimensions.minWidth ?? 1) * scaleFactor),
      height: Math.round(Math.max(coordinates.height || fixedDimensions.height, fixedDimensions.minHeight ?? 1) * scaleFactor)
    });
  }, [scaleFactor, coordinates.width, coordinates.height, fixedDimensions.width, fixedDimensions.height, fixedDimensions.minWidth, fixedDimensions.minHeight]);
  
  // Use configured minimums (allow shrinking below default width but not below min)
  const minWidthUnscaled = fixedDimensions.minWidth ?? fixedDimensions.width;
  const minHeightUnscaled = fixedDimensions.minHeight ?? fixedDimensions.height;

  // Auto width based on content while editing; otherwise honor saved/manual size
  const autoUnscaledWidth = useMemo(() => {
    // Calculate in display pixels then convert to unscaled PDF units
    const displayWidthPx = calculateOptimalWidth(inputValue, fontSize, fontFamily);
    const unscaled = displayWidthPx / Math.max(0.0001, scaleFactor);
    return Math.max(minWidthUnscaled, unscaled);
  }, [inputValue, fontSize, fontFamily, minWidthUnscaled, scaleFactor]);

  // Auto height at least matches current font size line-height while editing
  const autoUnscaledHeight = useMemo(() => {
    const lineHeightPx = Math.ceil(fontSize * 1.2);
    const unscaled = lineHeightPx / Math.max(0.0001, scaleFactor);
    return Math.max(minHeightUnscaled, unscaled);
  }, [fontSize, minHeightUnscaled, scaleFactor]);
 
  // Compute display coordinates (match PDFViewer sizing logic)
  const displayCoords = useMemo(() => {
    const savedWidth = Math.max(coordinates.width || fixedDimensions.width, minWidthUnscaled);
    const savedHeight = Math.max(coordinates.height || fixedDimensions.height, minHeightUnscaled);

    // When editing, auto-fit to content (grow and shrink). When not editing, use saved/manual size.
    const finalUnscaledWidth = isEditing ? autoUnscaledWidth : savedWidth;
    const finalUnscaledHeight = isEditing ? Math.max(savedHeight, autoUnscaledHeight, minHeightUnscaled) : savedHeight;

    // Bottom anchoring: keep the bottom edge fixed while height changes
    const bottomY = coordinates.y + savedHeight;
    const topYForFinal = bottomY - finalUnscaledHeight;

    return {
      x: Math.round(coordinates.x * scaleFactor),
      y: Math.round(topYForFinal * scaleFactor),
      width: Math.round(finalUnscaledWidth * scaleFactor),
      height: Math.round(finalUnscaledHeight * scaleFactor)
    };
  }, [coordinates.x, coordinates.y, coordinates.width, coordinates.height, fixedDimensions.height, fixedDimensions.width, minHeightUnscaled, minWidthUnscaled, scaleFactor, isEditing, autoUnscaledWidth, autoUnscaledHeight]);

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
  } as const;
  
  const canEdit = true; // Always allow editing for text inputs

  // Min/Max constraints for resize (visual – independent of zoom)
  const minWidthPx = Math.round((fixedDimensions.minWidth ?? 24) * scaleFactor);
  const maxWidthPx = 800; // generous maximum
  const minHeightPx = Math.round((fixedDimensions.minHeight ?? 20) * scaleFactor);
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

  // Ensure container is keyboard-focusable when selected (for Delete/Escape)
  useEffect(() => {
    if (!isEditing && isSelected) {
      containerFocusRef.current?.focus();
    }
  }, [isSelected, isEditing]);

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

  const handleResizeStart = () => {
    setIsResizing(true);
    // initialize controlled size to current displayed size for smooth live feedback
    setControlledSize({ width: displayCoords.width, height: displayCoords.height });
    // User is explicitly resizing — keep their size
    manualOverrideRef.current = true;
  };
  const handleResize = (_: any, __: any, ref: any) => {
    setIsResizing(true);
    // live update controlled size so the blue outline follows the cursor
    setControlledSize({ width: ref.offsetWidth, height: ref.offsetHeight });
    const newWidthUnscaled = ref.offsetWidth / scaleFactor;
    const newHeightUnscaled = ref.offsetHeight / scaleFactor;
    const currentSavedHeight = coordinates.height || fixedDimensions.height;
    const newTopY = (coordinates.y + currentSavedHeight) - newHeightUnscaled; // keep bottom fixed
    onResize?.({
      x: coordinates.x,
      y: newTopY,
      width: newWidthUnscaled,
      height: newHeightUnscaled
    });
  };
  const handleResizeStop = (_: any, __: any, ref: any) => {
    setIsResizing(false);
    setControlledSize({ width: ref.offsetWidth, height: ref.offsetHeight });
    const newWidthUnscaled = Math.max(1, Math.round(ref.offsetWidth / scaleFactor));
    const newHeightUnscaled = Math.max(1, Math.round(ref.offsetHeight / scaleFactor));
    const currentSavedHeight = coordinates.height || fixedDimensions.height;
    const newTopY = (coordinates.y + currentSavedHeight) - newHeightUnscaled; // keep bottom fixed
    onResize?.({
      x: coordinates.x,
      y: newTopY,
      width: newWidthUnscaled,
      height: newHeightUnscaled
    });
    // Keep manual override until content or font changes
    manualOverrideRef.current = true;
  };

  const handleContainerClick = () => {
    if (!isEditing) {
      onSelect?.();
      // If empty, start editing on single click for faster input
      if (!readOnly && inputValue.trim().length === 0) {
        setIsEditing(true);
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 0);
      }
    }
  };

  // Allow double-click to start editing immediately and focus the input
  const handleContainerDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (readOnly) return;
    onSelect?.();
    setIsEditing(true);
    // Ensure focus after state update
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    // Entering editing should allow auto-sizing while typing
    manualOverrideRef.current = false;
    lastAutoInputsRef.current = { content: inputValue, fontSize };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value);
  const handleInputBlur = () => {
    const trimmed = inputValue.trim();
    setIsEditing(false);

    // If empty, remove the tag entirely
    if (trimmed.length === 0) {
      onDelete?.();
      return;
    }

    // Persist auto-sized dimensions based on current content
    const currentSavedHeight = coordinates.height || fixedDimensions.height;
    const newTopY = (coordinates.y + currentSavedHeight) - Math.round(autoUnscaledHeight);
    onResize?.({
      x: coordinates.x,
      y: newTopY,
      width: Math.max(fixedDimensions.minWidth ?? 1, Math.round(autoUnscaledWidth)),
      height: Math.max(fixedDimensions.minHeight ?? 1, Math.round(autoUnscaledHeight))
    });
    onSave(trimmed);
    // Content changed -> allow auto-resize again
    manualOverrideRef.current = true; // keep user’s final size until next edit
    lastAutoInputsRef.current = { content: trimmed, fontSize };
  };
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = inputValue.trim();
      setIsEditing(false);

      if (trimmed.length === 0) {
        onDelete?.();
        return;
      }

      // Persist auto-sized dimensions on commit
      const currentSavedHeight = coordinates.height || fixedDimensions.height;
      const newTopY = (coordinates.y + currentSavedHeight) - Math.round(autoUnscaledHeight);
      onResize?.({
        x: coordinates.x,
        y: newTopY,
        width: Math.max(fixedDimensions.minWidth ?? 1, Math.round(autoUnscaledWidth)),
        height: Math.max(fixedDimensions.minHeight ?? 1, Math.round(autoUnscaledHeight))
      });
      onSave(trimmed);
      manualOverrideRef.current = true;
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      const trimmed = inputValue.trim();
      setIsEditing(false);
      if (trimmed.length === 0) {
        onDelete?.();
      } else {
        setInputValue(content);
      }
      return;
    }

    if (e.key === 'Backspace') {
      const trimmed = inputValue.trim();
      if (trimmed.length === 0) {
        e.preventDefault();
        setIsEditing(false);
        onDelete?.();
        return;
      }
    }
  };

  // Debounced auto-resize when font size or content changes even when not editing
  const debouncedAutoResize = useRef(
    debounce((width: number, height: number) => {
      // Avoid auto-resizing empty tags to prevent flicker
      if (!hasContent) return;
      const currentSavedHeight = coordinates.height || fixedDimensions.height;
      const newTopY = (coordinates.y + currentSavedHeight) - Math.round(height);
      onResize?.({
        x: coordinates.x,
        y: newTopY,
        width: Math.max(fixedDimensions.minWidth ?? 1, Math.round(width)),
        height: Math.max(fixedDimensions.minHeight ?? 1, Math.round(height))
      });
    }, 200)
  );

  // Cancel any pending auto-resize when unmounting to avoid stale updates after delete
  useEffect(() => {
    return () => {
      const fn: any = debouncedAutoResize.current as any;
      if (fn && typeof fn.cancel === 'function') {
        fn.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (isResizing) return; // don't fight the user
    // Only auto-resize while actively editing to avoid bounce while idle
    if (!isEditing) return;
    if (!hasContent) return; // no auto-resize for empty tags

    const targetWidth = autoUnscaledWidth;
    const targetHeight = Math.max(minHeightUnscaled, autoUnscaledHeight);

    const widthChanged = Math.abs((coordinates.width || fixedDimensions.width) - targetWidth) > 0.5;
    const heightChanged = Math.abs((coordinates.height || fixedDimensions.height) - targetHeight) > 0.5;

    if (widthChanged || heightChanged) {
      debouncedAutoResize.current(targetWidth, targetHeight);
      lastAutoInputsRef.current = { content: inputValue, fontSize };
      // Allow auto-sizing updates during edit; manual override resumes after commit
      manualOverrideRef.current = false;
    }
  }, [isEditing, hasContent, inputValue, fontSize, autoUnscaledWidth, autoUnscaledHeight, fixedDimensions.height, fixedDimensions.width, coordinates.width, coordinates.height, isResizing, coordinates.x, coordinates.y, minHeightUnscaled]);

  // Auto-resize on font-size changes even when not editing to avoid text clipping
  useEffect(() => {
    if (isResizing) return;
    const prev = lastAutoInputsRef.current;
    const fontChanged = prev.fontSize !== fontSize;
    if (!fontChanged) return;

    const targetWidth = autoUnscaledWidth;
    const targetHeight = Math.max(minHeightUnscaled, autoUnscaledHeight);
    debouncedAutoResize.current(targetWidth, targetHeight);
    lastAutoInputsRef.current = { content: inputValue, fontSize };
    // Permit font-driven auto-sizing regardless of manual override
    manualOverrideRef.current = false;
  }, [fontSize, isResizing, inputValue, autoUnscaledWidth, autoUnscaledHeight, minHeightUnscaled]);

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
        backfaceVisibility: 'hidden',
        transition: 'none'
      }}
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent) => {
        // Deleting the entire text tag when not editing
        if (!isEditing && (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Escape')) {
          e.preventDefault();
          onDelete?.();
          return;
        }
        // Start typing to begin editing immediately
        if (!isEditing && !readOnly && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setIsEditing(true);
          // Initialize with the typed character
          setInputValue(prev => `${prev}${e.key}`);
          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
        }
      }}
    >
      <div
        ref={containerFocusRef}
        onClick={handleContainerClick}
        onDoubleClick={handleContainerDoubleClick}
        data-text-input-id={id}
        className="streamlined-text-input"
        tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent) => {
          // Deleting the entire text tag when not editing
          if (!isEditing && (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Escape')) {
            e.preventDefault();
            onDelete?.();
            return;
          }
          // Start typing to begin editing immediately
          if (!isEditing && !readOnly && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            setIsEditing(true);
            // Initialize with the typed character
            setInputValue(prev => `${prev}${e.key}`);
            setTimeout(() => {
              inputRef.current?.focus();
            }, 0);
          }
        }}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
          background: hasContent ? 'transparent' : '#f3f4f6',
          userSelect: isEditing ? 'text' : 'none',
          pointerEvents: 'auto',
          lineHeight: 1,
          border: hasContent ? 'none' : `1px solid ${PROFESSIONAL_COLORS.border}`,
          borderRadius: LAYOUT.borderRadius.base,
          paddingBottom: '1px'
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
              height: `${Math.ceil(fontSize * 1.2)}px`,
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
              whiteSpace: 'nowrap',
              alignSelf: 'flex-end'
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-start',
              textOverflow: 'clip',
              whiteSpace: 'nowrap',
              color: hasContent ? textColor : PROFESSIONAL_COLORS.textPlaceholder,
              fontStyle: hasContent ? 'normal' : 'italic',
              fontFamily: fontFamily,
              fontSize: `${fontSize}px`,
              overflow: 'visible',
              lineHeight: 1,
              padding: 0
            }}
          >
            {hasContent ? inputValue : `${TAG_TYPE_CONFIG.T.placeholder}`}
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