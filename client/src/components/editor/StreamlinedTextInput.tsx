import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { useToast } from '@/hooks/use-toast';

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
  const [inputValue, setInputValueRaw] = useState(content);
  
  // Debug wrapper for setInputValue to track all calls
  const setInputValue = (value: string) => {
    console.log('📝 setInputValue called:', {
      id,
      from: inputValue,
      to: value,
      stack: new Error().stack?.split('\n')[2]?.trim() // Show where it was called from
    });
    setInputValueRaw(value);
  };
  const [isEditing, setIsEditing] = useState(isNew); // Start editing if new
  const [hasStartedEditing, setHasStartedEditing] = useState(isNew); // Track if user has started editing
  const [lastSavedContent, setLastSavedContent] = useState(content); // Track last saved content to avoid resets
  
  // Debug: Track when inputValue changes
  const prevInputValue = useRef(inputValue);
  useEffect(() => {
    if (prevInputValue.current !== inputValue) {
      console.log('🎯 InputValue changed:', {
        id,
        from: prevInputValue.current,
        to: inputValue,
        isEditing,
        hasStartedEditing,
        content
      });
      prevInputValue.current = inputValue;
    }
  }, [inputValue, id, isEditing, hasStartedEditing, content]);

  // Debug: Track component mount/unmount (CRITICAL for debugging text vanishing)
  useEffect(() => {
    console.log('🚀 StreamlinedTextInput MOUNTED:', id);
    return () => {
      console.log('💀 StreamlinedTextInput UNMOUNTED:', id);
    };
  }, [id]);
  const [isVisible, setIsVisible] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState({ 
    x: coordinates.x, 
    y: coordinates.y 
  });
  const [dimensions, setDimensions] = useState({
    width: coordinates.width,
    height: coordinates.height
  });
  const [isDeleted, setIsDeleted] = useState(false); // Track deletion state
  
  const inputRef = useRef<HTMLInputElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const { toast } = useToast();
  
  // Calculate dynamic font size based on container height
  const dynamicFontSize = Math.max(8, Math.min(dimensions.height * 0.6, 24));

  // Update position and dimensions when coordinates change
  useEffect(() => {
    setPosition({ x: coordinates.x, y: coordinates.y });
    setDimensions({ width: coordinates.width, height: coordinates.height });
  }, [coordinates.x, coordinates.y, coordinates.width, coordinates.height]);

  // Only update inputValue from content prop if user hasn't started editing or if it's a legitimate content update
  useEffect(() => {
    console.log('🔄 Content effect triggered:', {
      id,
      content,
      lastSavedContent,
      inputValue,
      hasStartedEditing,
      isEditing,
      willPreserve: hasStartedEditing && isEditing && inputValue.trim() !== ''
    });

    // Don't reset inputValue if user is actively editing and has typed something
    if (hasStartedEditing && isEditing && inputValue.trim() !== '') {
      console.log('📝 Preserving user input during ID transition:', inputValue);
      return;
    }
    
    // Only update if the content actually changed (not just ID transition)
    if (content !== lastSavedContent) {
      console.log('📄 Content prop updated, syncing inputValue:', { from: lastSavedContent, to: content });
      setInputValue(content);
      setLastSavedContent(content);
    }
  }, [content, hasStartedEditing, isEditing, inputValue, lastSavedContent, id]);

  // Auto-focus on new text inputs and maintain editing state
  useEffect(() => {
    if (isNew && inputRef.current) {
      setIsEditing(true);
      setHasStartedEditing(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isNew]);

  // Maintain editing state even when isNew becomes false if user was editing
  useEffect(() => {
    if (hasStartedEditing && !isEditing && inputValue.trim() === '' && isSelected) {
      setIsEditing(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [hasStartedEditing, isEditing, inputValue, isSelected]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isSelected || isDeleted) return;
    
    // Delete key - delete immediately without confirmation
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      console.log('🗑️ Delete key pressed - deleting text input immediately');
      handleDelete();
    }
    
    // Enter key - start editing
    if (e.key === 'Enter' && !isEditing) {
      e.preventDefault();
      setIsEditing(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    
    // Escape key - cancel editing
    if (e.key === 'Escape' && isEditing) {
      e.preventDefault();
      // Cancel editing and restore original value
      setInputValue(content);
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

  // Save text content
  const handleSave = useCallback(async () => {
    if (isDeleted) return; // Prevent API calls after deletion
    
    const trimmedValue = inputValue.trim();
    
    try {
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
        // Don't show error if it's deleted (404)
        if (response.status === 404 && isDeleted) {
          console.log('Text input was deleted, ignoring save attempt');
          return;
        }
        throw new Error('Failed to save text content');
      }

      setIsEditing(false);
      setHasStartedEditing(false); // Reset editing flag after successful save
      setLastSavedContent(trimmedValue); // Update last saved content to prevent resets
      onSave(trimmedValue);
      
      console.log(`✅ Text saved: "${trimmedValue}"`);
      
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
  }, [inputValue, sessionId, id, fontSize, fontFamily, textColor, onSave, toast, isDeleted]);

  // Handle deletion
  const handleDelete = useCallback(() => {
    if (isDeleted) return; // Prevent multiple deletions
    
    console.log('🗑️ Deleting text input:', id);
    setIsDeleted(true); // Mark as deleted immediately
    setIsVisible(false); // Hide immediately
    
    // Cancel any ongoing editing
    setIsEditing(false);
    setHasStartedEditing(false);
    
    // Clean up any pending operations
    onDelete();
  }, [id, onDelete, isDeleted]);

  // Handle position and size changes from Rnd
  const handleDragStop = useCallback((e: any, data: { x: number; y: number }) => {
    if (isDeleted) return;
    
    const newX = data.x / scaleFactor;
    const newY = data.y / scaleFactor;
    
    setPosition({ x: newX, y: newY });
    
    if (onMove) {
      onMove({ x: newX, y: newY });
    }
    
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
  }, [scaleFactor, sessionId, id, onMove, isDeleted]);

  const handleResize = useCallback((
    e: any,
    direction: any,
    ref: HTMLElement,
    delta: any,
    position: { x: number; y: number }
  ) => {
    if (isDeleted) return;
    
    const newWidth = parseInt(ref.style.width) / scaleFactor;
    const newHeight = parseInt(ref.style.height) / scaleFactor;
    const newX = position.x / scaleFactor;
    const newY = position.y / scaleFactor;
    
    // Update dimensions immediately for real-time feedback
    setPosition({ x: newX, y: newY });
    setDimensions({ width: newWidth, height: newHeight });
  }, [scaleFactor, isDeleted]);

  const handleResizeStop = useCallback((
    e: any,
    direction: any,
    ref: HTMLElement,
    delta: any,
    position: { x: number; y: number }
  ) => {
    if (isDeleted) return;
    
    const newWidth = parseInt(ref.style.width) / scaleFactor;
    const newHeight = parseInt(ref.style.height) / scaleFactor;
    const newX = position.x / scaleFactor;
    const newY = position.y / scaleFactor;
    
    setPosition({ x: newX, y: newY });
    setDimensions({ width: newWidth, height: newHeight });
    
    // Calculate new font size based on new height
    const newFontSize = Math.max(8, Math.min(newHeight * 0.6, 24));
    
    if (onFontSizeChange) {
      onFontSizeChange(newFontSize);
    }
    
    if (onResize) {
      onResize({ x: newX, y: newY, width: newWidth, height: newHeight });
    }
    
    // Save dimensions to backend
    const saveDimensions = async () => {
      try {
        // Calculate new font size based on new height
        const newFontSize = Math.max(8, Math.min(newHeight * 0.6, 24));
        
        // Save dimensions
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
        
        // Save font size
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
  }, [scaleFactor, sessionId, id, onResize, isDeleted]);

  // Handle click to select or start editing
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
      console.log('📍 Text tag selection triggered for:', id);
    }
    
    // Only start editing on double click or if it's a new input
    if (e.detail === 2 || isNew) {
      setIsEditing(true);
      setHasStartedEditing(true);
      setTimeout(() => inputRef.current?.focus(), 50);
      console.log('✏️ Text tag editing started for:', id);
    }
  }, [isNew, onSelect, isDeleted, isResizing, id, isSelected, isEditing]);

  // Handle keyboard in input field
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isDeleted) return;
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Cancel editing and restore original value
      setInputValue(content);
      setIsEditing(false);
      setHasStartedEditing(false);
    }
  }, [handleSave, content, isDeleted]);

  // Handle input blur (save when clicking outside)
  const handleBlur = useCallback(() => {
    if (isDeleted) return;
    
    if (isEditing && inputValue !== content) {
      handleSave();
    } else if (isEditing && inputValue.trim() !== '') {
      // Only stop editing if we have content, otherwise keep editing mode
      setIsEditing(false);
      setHasStartedEditing(false);
    }
    // If inputValue is empty, keep editing mode active for new inputs
  }, [isEditing, inputValue, content, handleSave, isDeleted]);

  // Calculate display properties
  const displayStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x * scaleFactor}px`,
    top: `${position.y * scaleFactor}px`,
    width: `${dimensions.width * scaleFactor}px`,
    minHeight: `${dimensions.height * scaleFactor}px`,
    fontSize: `${fontSize * scaleFactor}px`,
    fontFamily,
    color: textColor,
    lineHeight: '1.2',
    cursor: isEditing ? 'text' : 'move',
    zIndex: isSelected ? 1000 : 100,
    pointerEvents: 'auto', // Important: Allow interaction with text inputs
    userSelect: isEditing ? 'text' : 'none'
  };

  if (!isVisible || isDeleted) {
    return null;
  }

  console.log('🎯 StreamlinedTextInput rendering:', {
    id,
    coordinates,
    position,
    dimensions,
    scaleFactor,
    isEditing,
    isSelected,
    isNew,
    isVisible,
    isDeleted,
    enableResizing: isSelected && !isEditing
  });

  return (
    <Rnd
      size={{
        width: dimensions.width * scaleFactor,
        height: dimensions.height * scaleFactor
      }}
      position={{
        x: position.x * scaleFactor,
        y: position.y * scaleFactor
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
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={handleBlur}
          placeholder="Type text..."
          style={{
            width: '100%',
            height: '100%',
              background: 'transparent',
            border: 'none',
              outline: '1px solid rgba(0, 0, 0, 0.3)',
            borderRadius: '2px',
            padding: '2px 4px',
            margin: 0,
            fontSize: 'inherit',
            fontFamily: 'inherit',
            color: 'inherit',
            lineHeight: 'inherit'
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
              wordBreak: 'break-word'
          }}
        >
          <span
            ref={spanRef}
            onClick={handleClick}
            style={{
                display: 'block',
              padding: '2px 4px',
                background: 'transparent',
                border: 'none',
              borderRadius: '2px',
              minWidth: '20px',
                minHeight: '13px',
                boxShadow: 'none',
              transition: 'all 0.15s ease',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
            }}
            title="Double-click to edit, Delete key to delete"
          >
            {inputValue || (
              <span style={{ 
                color: '#ccc', 
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
  );
}; 