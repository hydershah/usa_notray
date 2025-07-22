import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { useToast } from '@/hooks/use-toast';
import { useEditorStore } from '@/hooks/editor/useEditorStore';
import { useWebSocket } from '@/hooks/editor/useWebSocket';

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
  isNew?: boolean; // Whether this is a newly placed text input
  isSelected?: boolean; // Whether this text input is currently selected
  scaleFactor: number;
  onSave: (content: string) => void;
  onDelete: () => void;
  onSelect?: () => void;
  onMove?: (newCoordinates: { x: number; y: number }) => void;
  onResize?: (newCoordinates: { x: number; y: number; width: number; height: number }) => void;
  onFontSizeChange?: (fontSize: number) => void;
}

export const StreamlinedTextInput: React.FC<StreamlinedTextInputProps> = ({
  id,
  coordinates,
  sessionId,
  content = '',
  fontSize = 12,
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
  onFontSizeChange
}) => {
  const [inputValueRaw, setInputValueRaw] = useState(content);
  const [isEditing, setIsEditing] = useState(isNew);
  const [hasStartedEditing, setHasStartedEditing] = useState(isNew);
  const [lastSavedContent, setLastSavedContent] = useState(content);
  const [isVisible, setIsVisible] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [lastContentUpdate, setLastContentUpdate] = useState<number>(0);
  
  const position = useRef({ x: coordinates.x, y: coordinates.y });
  const dimensions = useRef({
    width: coordinates.width,
    height: coordinates.height
  });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { setCustomTagDimensions } = useEditorStore();
  
  // WebSocket for real-time updates
  const webSocket = useWebSocket({
    sessionId,
    userId: assignedUserId.toString(),
    autoReconnect: true
  });
  
  // Debounced function for real-time content updates
  const debouncedContentUpdate = useCallback(
    debounce((content: string) => {
      if (content.trim() !== '') {
        webSocket.tagContentUpdated(id, content, 'text', false, 'typing');
      }
    }, 300),
    [id, webSocket]
  );

  // Handle real-time content updates from store changes
  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state) => {
      const tag = state.tags.find(tag => tag.id === id);
      if (tag && tag.content !== lastSavedContent && tag.content !== inputValueRaw) {
        console.log('🔄 Received real-time content update from store:', tag.content);
        
        // Only update if we're not currently editing this tag
        if (!isEditing || tag.updatedBy !== assignedUserId.toString()) {
          setInputValueRaw(tag.content || '');
          setLastSavedContent(tag.content || '');
        }
      }
    });

    return () => {
      unsubscribe();
      debouncedContentUpdate.cancel();
    };
  }, [id, isEditing, lastSavedContent, inputValueRaw, assignedUserId, debouncedContentUpdate]);

  // Calculate dynamic font size based on container height
  const dynamicFontSize = Math.max(8, Math.min(dimensions.current.height * 0.6, 24));

  // Update position and dimensions when coordinates change
  useEffect(() => {
    position.current = { x: coordinates.x, y: coordinates.y };
    dimensions.current = { width: coordinates.width, height: coordinates.height };
  }, [coordinates.x, coordinates.y, coordinates.width, coordinates.height]);

  // Improved content synchronization - prevent content from disappearing
  useEffect(() => {
    const now = Date.now();
    
    // Only update if content actually changed and it's not a rapid update
    if (content !== lastSavedContent && (now - lastContentUpdate) > 100) {
      console.log('🔄 Content prop updated, syncing inputValue:', { 
        id, 
        from: lastSavedContent, 
        to: content,
        isEditing,
        hasStartedEditing,
        inputValue: inputValueRaw
      });
      
      // Don't reset if user is actively editing and has typed something
      if (hasStartedEditing && isEditing && inputValueRaw.trim() !== '') {
        console.log('📝 Preserving user input during content update:', inputValueRaw);
        return;
      }
      
      // Don't reset if the content is the same as what we just saved
      if (content === inputValueRaw.trim()) {
        console.log('📝 Content matches current input, no need to sync');
        setLastSavedContent(content);
        setLastContentUpdate(now);
        return;
      }
      
      // Don't reset if we just finished editing and the content is being updated
      if (hasStartedEditing && !isEditing && inputValueRaw.trim() !== '') {
        console.log('📝 Preserving recently saved content:', inputValueRaw);
        return;
      }
      
      setInputValueRaw(content);
      setLastSavedContent(content);
      setLastContentUpdate(now);
    }
  }, [content, lastSavedContent, hasStartedEditing, isEditing, inputValueRaw, lastContentUpdate, id]);

  // Auto-focus on new text inputs
  useEffect(() => {
    if (isNew && inputRef.current) {
      setIsEditing(true);
      setHasStartedEditing(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isNew]);

  // Maintain editing state for selected inputs
  useEffect(() => {
    if (hasStartedEditing && !isEditing && inputValueRaw.trim() === '' && isSelected) {
      setIsEditing(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [hasStartedEditing, isEditing, inputValueRaw, isSelected]);

  // Auto-resize when content changes
  const performAutoResize = useCallback((text: string) => {
    if (isDeleted) return;
    
    console.log('📏 Performing auto-resize for:', text);
    
    // Create a canvas to measure text accurately
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const actualFontSize = dynamicFontSize * scaleFactor;
      ctx.font = `${actualFontSize}px ${fontFamily}`;
      
      const textMetrics = ctx.measureText(text || 'Placeholder text');
      const textWidth = textMetrics.width;
      
      const minTextWidth = Math.max(textWidth / scaleFactor, 60);
      const minTextHeight = Math.max((actualFontSize + 16) / scaleFactor, 26);
      
      const paddedWidth = minTextWidth + 20;
      const paddedHeight = Math.max(minTextHeight, 26);
      
      const minWidth = Math.max(coordinates.width, paddedWidth);
      const minHeight = Math.max(coordinates.height, paddedHeight);
      
      const needsWidthIncrease = dimensions.current.width < minWidth;
      const needsHeightIncrease = dimensions.current.height < minHeight;
      
      if (needsWidthIncrease || needsHeightIncrease) {
        const newWidth = needsWidthIncrease ? minWidth : dimensions.current.width;
        const newHeight = needsHeightIncrease ? minHeight : dimensions.current.height;
        
        console.log('✅ Auto-resize applied:', {
          oldSize: `${dimensions.current.width.toFixed(1)}x${dimensions.current.height.toFixed(1)}`,
          newSize: `${newWidth.toFixed(1)}x${newHeight.toFixed(1)}`
        });
        
        dimensions.current = {
          width: newWidth,
          height: newHeight
        };
        
        // Trigger re-render
        setInputValueRaw(prev => prev);
      }
    }
  }, [isDeleted, dynamicFontSize, scaleFactor, fontFamily, coordinates.width, coordinates.height]);

  // Auto-resize when component mounts with existing content
  useEffect(() => {
    if (inputValueRaw && inputValueRaw.trim() !== '') {
      setTimeout(() => {
        performAutoResize(inputValueRaw);
      }, 50);
    }
  }, [performAutoResize]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isSelected || isDeleted) return;
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      console.log('🗑️ Delete key pressed - deleting text input immediately');
      handleDelete();
    }
    
    if (e.key === 'Enter' && !isEditing) {
      e.preventDefault();
      setIsEditing(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    
    if (e.key === 'Escape' && isEditing) {
      e.preventDefault();
      setInputValueRaw(content);
      setIsEditing(false);
      setHasStartedEditing(false);
    }
  }, [isSelected, isEditing, isDeleted, content]);

  // Add keyboard event listener when selected
  useEffect(() => {
    if (isSelected && !isDeleted) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isSelected, handleKeyDown, isDeleted]);

  // Auto-focus input when starting to edit
  useEffect(() => {
    if (isEditing && inputRef.current && !isDeleted) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isEditing, isDeleted]);

  // Save text content with real-time WebSocket updates
  const handleSave = useCallback(async () => {
    if (isDeleted) return;
    
    const trimmedValue = inputValueRaw.trim();
    console.log('💾 Starting save process:', { id, trimmedValue, isEditing });
    
    try {
      // Save to backend
      const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${id}/content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content: trimmedValue,
          fontSize,
          fontFamily,
          textColor
        })
      });

      if (!response.ok) {
        if (response.status === 404 && isDeleted) {
          console.log('Text input was deleted, ignoring save attempt');
          return;
        }
        throw new Error('Failed to save text content');
      }

      // Send real-time update via WebSocket
      webSocket.tagContentUpdated(id, trimmedValue, 'text', trimmedValue !== '', 'manual');
      
      // Update the input value to preserve the content
      setInputValueRaw(trimmedValue);
      setLastSavedContent(trimmedValue);
      
      // Small delay to ensure state updates are processed
      setTimeout(() => {
        setIsEditing(false);
        setHasStartedEditing(false);
        onSave(trimmedValue);
        console.log(`✅ Text saved successfully: "${trimmedValue}"`);
      }, 50);
      
    } catch (error) {
      console.error('❌ Failed to save text:', error);
      if (!isDeleted) {
        toast({
          variant: "destructive",
          title: "Save Failed",
          description: "Failed to save text. Please try again."
        });
      }
    }
  }, [inputValueRaw, sessionId, id, fontSize, fontFamily, textColor, onSave, toast, isDeleted, webSocket]);

  // Handle deletion
  const handleDelete = useCallback(() => {
    if (isDeleted) return;
    
    console.log('🗑️ Deleting text input:', id);
    setIsDeleted(true);
    setIsVisible(false);
    setIsEditing(false);
    setHasStartedEditing(false);
    
    // Send real-time deletion via WebSocket
    webSocket.tagDeleted(id);
    
    onDelete();
  }, [id, onDelete, isDeleted, webSocket]);

  // Handle position and size changes from Rnd
  const handleDragStop = useCallback((e: any, data: { x: number; y: number }) => {
    if (isDeleted) return;
    
    const newX = data.x / scaleFactor;
    const newY = data.y / scaleFactor;
    
    position.current = { x: newX, y: newY };
    
    if (onMove) {
      onMove({ x: newX, y: newY });
    }
    
    // Send real-time movement via WebSocket
    webSocket.tagMoved(id, { x: newX, y: newY, width: dimensions.current.width, height: dimensions.current.height });
    
    // Save position to backend
    const savePosition = async () => {
      try {
        const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${id}/position`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            x: newX,
            y: newY
          })
        });

        if (!response.ok && response.status !== 404) {
          throw new Error('Failed to save position');
        }
      } catch (error) {
        console.error('Failed to save position:', error);
      }
    };
    
    savePosition();
  }, [scaleFactor, sessionId, id, onMove, isDeleted, webSocket]);

  const handleResize = useCallback((
    e: any,
    direction: any,
    ref: HTMLElement,
    delta: any,
    newPosition: { x: number; y: number }
  ) => {
    if (isDeleted) return;
    
    const newWidth = parseInt(ref.style.width) / scaleFactor;
    const newHeight = parseInt(ref.style.height) / scaleFactor;
    const newX = newPosition.x / scaleFactor;
    const newY = newPosition.y / scaleFactor;
    
    position.current = { x: newX, y: newY };
    dimensions.current = { width: newWidth, height: newHeight };
    
    const newFontSize = Math.max(8, Math.min(newHeight * 0.6, 24));
    
    setCustomTagDimensions('T', { width: newWidth, height: newHeight });
    
    if (onFontSizeChange) {
      onFontSizeChange(newFontSize);
    }
    
    if (onResize) {
      onResize({ x: newX, y: newY, width: newWidth, height: newHeight });
    }
    
    // Send real-time resize via WebSocket
    webSocket.tagResized(id, { x: newX, y: newY, width: newWidth, height: newHeight });
    
    // Save dimensions to backend
    const saveDimensions = async () => {
      try {
        const dimensionsResponse = await fetch(`/api/editor/session/${sessionId}/text-tag/${id}/dimensions`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight
          })
        });
        
        if (!dimensionsResponse.ok && dimensionsResponse.status !== 404) {
          throw new Error('Failed to save dimensions');
        }
        
        const fontSizeResponse = await fetch(`/api/editor/session/${sessionId}/text-tag/${id}/font-size`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            fontSize: newFontSize,
            fontFamily: fontFamily,
            textColor: textColor
          })
        });
        
        if (!fontSizeResponse.ok && fontSizeResponse.status !== 404) {
          throw new Error('Failed to save font size');
        }
        
        console.log(`✅ Text tag resized: ${newWidth}x${newHeight}, font size: ${newFontSize}px`);
        
      } catch (error) {
        console.error('Failed to save dimensions:', error);
      }
    };
    
    saveDimensions();
    setIsResizing(false);
  }, [scaleFactor, sessionId, id, onResize, isDeleted, webSocket, setCustomTagDimensions, onFontSizeChange, fontFamily, textColor]);

  const handleResizeStop = useCallback(() => {
    setIsResizing(false);
    console.log('🔧 Text tag resize completed');
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isDeleted || isResizing) return;
    
    e.stopPropagation();
    
    console.log('🖱️ Text tag clicked:', {
      id,
      isSelected,
      isEditing,
      clickDetail: e.detail,
      isNew
    });
    
    if (onSelect) {
      onSelect();
    }
    
    if (e.detail === 2 || isNew) {
      setIsEditing(true);
      setHasStartedEditing(true);
      setTimeout(() => inputRef.current?.focus(), 50);
      console.log('✏️ Text tag editing started for:', id);
    }
  }, [isNew, onSelect, isDeleted, isResizing, id, isSelected, isEditing]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isDeleted) return;
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Ensure content is preserved before saving
      const currentValue = inputValueRaw.trim();
      if (currentValue !== '') {
        setInputValueRaw(currentValue);
        setLastSavedContent(currentValue);
        handleSave();
      } else {
        // If empty, just exit editing mode
        setIsEditing(false);
        setHasStartedEditing(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setInputValueRaw(content);
      setIsEditing(false);
      setHasStartedEditing(false);
    }
  }, [handleSave, content, isDeleted, inputValueRaw]);

  const handleBlur = useCallback(() => {
    if (isDeleted) return;
    
    if (isEditing && inputValueRaw.trim() !== '') {
      // Always preserve content when blurring
      const trimmedValue = inputValueRaw.trim();
      setInputValueRaw(trimmedValue);
      setLastSavedContent(trimmedValue);
      
      // If content changed, save it
      if (trimmedValue !== content) {
        handleSave();
      } else {
        // Just exit editing mode
        setIsEditing(false);
        setHasStartedEditing(false);
      }
    } else if (isEditing) {
      // If empty, just exit editing mode
      setIsEditing(false);
      setHasStartedEditing(false);
    }
  }, [isEditing, inputValueRaw, content, handleSave, isDeleted]);

  // Debounced function to save dimensions to backend
  const debouncedSaveDimensions = useCallback(
    debounce(async (newWidth: number, newHeight: number) => {
      if (isDeleted) return;
      
      try {
        console.log('💾 Saving auto-resized dimensions:', { id, newWidth, newHeight });
        
        const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${id}/dimensions`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            width: newWidth,
            height: newHeight
          })
        });

        if (!response.ok) {
          throw new Error('Failed to save dimensions');
        }

        console.log('✅ Auto-resized dimensions saved successfully');
        
        if (onResize) {
          onResize({
            x: position.current.x,
            y: position.current.y,
            width: newWidth,
            height: newHeight
          });
        }

      } catch (error) {
        console.error('❌ Failed to save auto-resized dimensions:', error);
      }
    }, 500),
    [sessionId, id, onResize, isDeleted]
  );

  // Clean up debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSaveDimensions.cancel?.();
    };
  }, [debouncedSaveDimensions]);

  if (!isVisible || isDeleted) {
    return null;
  }

  console.log('🎯 StreamlinedTextInput rendering:', {
    id,
    coordinates,
    position: position.current,
    dimensions: dimensions.current,
    scaleFactor,
    isEditing,
    isSelected,
    isNew,
    isVisible,
    isDeleted,
    inputValue: inputValueRaw
  });

  return (
    <>
      {/* Hidden element for measuring text dimensions */}
      <div
        ref={measureRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          fontSize: `${dynamicFontSize}px`,
          fontFamily: fontFamily,
          padding: '2px 4px',
          border: '1px solid transparent',
          lineHeight: '1.2',
          top: -9999,
          left: -9999
        }}
      />
      
      <Rnd
        size={{
          width: dimensions.current.width * scaleFactor,
          height: dimensions.current.height * scaleFactor
        }}
        position={{
          x: position.current.x * scaleFactor,
          y: position.current.y * scaleFactor
        }}
        onDragStop={handleDragStop}
        onResize={handleResize}
        onResizeStop={handleResizeStop}
        onResizeStart={() => setIsResizing(true)}
        enableResizing={{
          top: isSelected && !isEditing,
          right: isSelected && !isEditing,
          bottom: isSelected && !isEditing,
          left: isSelected && !isEditing,
          topRight: isSelected && !isEditing,
          bottomRight: isSelected && !isEditing,
          bottomLeft: isSelected && !isEditing,
          topLeft: isSelected && !isEditing,
        }}
        disableDragging={isEditing}
        minWidth={30 * scaleFactor}
        minHeight={15 * scaleFactor}
        bounds="parent"
        style={{
          zIndex: isSelected ? 1000 : 100,
          pointerEvents: 'auto',
        }}
        resizeHandleStyles={{
          bottomRight: {
            width: '8px',
            height: '8px',
            backgroundColor: '#007bff',
            border: '1px solid #fff',
            borderRadius: '2px',
            zIndex: 1001,
          },
          topRight: {
            width: '8px',
            height: '8px',
            backgroundColor: '#007bff',
            border: '1px solid #fff',
            borderRadius: '2px',
            zIndex: 1001,
          },
          bottomLeft: {
            width: '8px',
            height: '8px',
            backgroundColor: '#007bff',
            border: '1px solid #fff',
            borderRadius: '2px',
            zIndex: 1001,
          },
          topLeft: {
            width: '8px',
            height: '8px',
            backgroundColor: '#007bff',
            border: '1px solid #fff',
            borderRadius: '2px',
            zIndex: 1001,
          }
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            fontSize: `${dynamicFontSize * scaleFactor}px`,
            fontFamily,
            color: textColor,
            lineHeight: '1.2',
            cursor: isEditing ? 'text' : 'move',
            pointerEvents: 'auto',
            userSelect: isEditing ? 'text' : 'none',
            border: isSelected ? '2px solid #007bff' : '1px solid transparent',
            borderRadius: '2px',
            transition: 'border-color 0.2s ease'
          }}
          tabIndex={0}
        >
          {isEditing ? (
            // Editing mode - show input field
            <input
              ref={inputRef}
              type="text"
              value={inputValueRaw}
              onChange={(e) => {
                const newValue = e.target.value;
                setInputValueRaw(newValue);
                
                // Send real-time typing indicator
                webSocket.userTyping(id);
                
                // Send real-time content update for live collaboration (debounced)
                debouncedContentUpdate(newValue);
                
                // Auto-resize
                performAutoResize(newValue);
              }}
              onKeyDown={handleInputKeyDown}
              onBlur={handleBlur}
              placeholder="Type text..."
              style={{
                width: '100%',
                height: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                borderRadius: '3px',
                padding: '4px 8px',
                margin: 0,
                fontSize: 'inherit',
                fontFamily: 'inherit',
                color: 'inherit',
                lineHeight: 'inherit',
                resize: 'none',
                overflow: 'hidden',
                textOverflow: 'visible',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box'
              }}
              autoFocus
            />
          ) : (
            // Display mode - show text content
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                wordWrap: 'break-word',
                wordBreak: 'break-word',
                cursor: 'pointer'
              }}
            >
              <span
                ref={spanRef}
                onClick={handleClick}
                style={{
                  display: 'block',
                  padding: '4px 8px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '3px',
                  minWidth: '20px',
                  minHeight: '16px',
                  boxShadow: isSelected ? '0 0 0 2px rgba(0, 123, 255, 0.3)' : 'none',
                  transition: 'all 0.15s ease',
                  width: '100%',
                  height: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  boxSizing: 'border-box'
                }}
                title="Double-click to edit, Delete key to delete"
              >
                {inputValueRaw || (
                  <span style={{ 
                    color: '#999', 
                    fontStyle: 'italic',
                    fontSize: '0.9em',
                    whiteSpace: 'nowrap'
                  }}>
                    Double-click to add text
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </Rnd>
    </>
  );
}; 