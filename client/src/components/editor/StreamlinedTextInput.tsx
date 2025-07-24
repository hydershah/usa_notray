import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { useToast } from '@/hooks/use-toast';
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
  
  // Access editor store for custom dimensions
  const { setCustomTagDimensions } = useEditorStore();
  
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
  
  // Debug: Track when dimensions change
  useEffect(() => {
    console.log('📦 Dimensions state changed:', {
      id,
      newDimensions: dimensions,
      scaledSize: {
        width: dimensions.width * scaleFactor,
        height: dimensions.height * scaleFactor
      }
    });
  }, [dimensions, id, scaleFactor]);

  const inputRef = useRef<HTMLInputElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLDivElement>(null); // For measuring text dimensions
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

  // Auto-resize when content changes or component mounts with existing content
  const performAutoResize = useCallback((text: string) => {
    if (isDeleted) return;
    
    console.log('📏 Performing auto-resize for:', text);
    
    // Create a canvas to measure text accurately
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Use the actual scaled font size for accurate measurement
      const actualFontSize = dynamicFontSize * scaleFactor;
      ctx.font = `${actualFontSize}px ${fontFamily}`;
      
      // Measure the text width
      const textMetrics = ctx.measureText(text || 'Placeholder text');
      const textWidth = textMetrics.width;
      
      // Calculate minimum required dimensions (unscaled)
      const minTextWidth = Math.max(textWidth / scaleFactor, 60); // Minimum 60px
      const minTextHeight = Math.max((actualFontSize + 16) / scaleFactor, 26); // Font size + padding, minimum 26px
      
      // Add extra padding for comfortable typing
      const paddedWidth = minTextWidth + 20; // Extra padding for comfort
      const paddedHeight = Math.max(minTextHeight, 26); // Ensure minimum height
      
      // RESPECT CUSTOM DIMENSIONS: Only grow if needed, never shrink below initial size
      // Use the initial coordinates as the minimum size (these come from custom dimensions)
      const minWidth = Math.max(coordinates.width, paddedWidth);
      const minHeight = Math.max(coordinates.height, paddedHeight);
      
      // Only resize if the current size is smaller than what we need
      const needsWidthIncrease = dimensions.width < minWidth;
      const needsHeightIncrease = dimensions.height < minHeight;
      
      if (needsWidthIncrease || needsHeightIncrease) {
        const newWidth = needsWidthIncrease ? minWidth : dimensions.width;
        const newHeight = needsHeightIncrease ? minHeight : dimensions.height;
        
        console.log('✅ Auto-resize applied (preserving custom dimensions):', {
          oldSize: `${dimensions.width.toFixed(1)}x${dimensions.height.toFixed(1)}`,
          newSize: `${newWidth.toFixed(1)}x${newHeight.toFixed(1)}`,
          initialSize: `${coordinates.width.toFixed(1)}x${coordinates.height.toFixed(1)}`,
          reason: needsWidthIncrease ? 'width needed' : 'height needed'
        });
        
        setDimensions({
          width: newWidth,
          height: newHeight
        });
      } else {
        console.log('📏 Auto-resize skipped - current size sufficient:', {
          currentSize: `${dimensions.width.toFixed(1)}x${dimensions.height.toFixed(1)}`,
          requiredSize: `${paddedWidth.toFixed(1)}x${paddedHeight.toFixed(1)}`,
          customSize: `${coordinates.width.toFixed(1)}x${coordinates.height.toFixed(1)}`
        });
      }
    }
  }, [isDeleted, dynamicFontSize, scaleFactor, fontFamily, dimensions.width, dimensions.height, coordinates.width, coordinates.height]);

  // Auto-resize when component mounts with existing content
  useEffect(() => {
    if (inputValue && inputValue.trim() !== '') {
      // Small delay to ensure component is fully mounted
      setTimeout(() => {
        performAutoResize(inputValue);
      }, 50);
    }
  }, []); // Only run on mount

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
    
    // If there's no content, don't save but keep editing mode for new inputs
    if (!trimmedValue && isNew) {
      console.log('📝 Empty content for new input, keeping in edit mode');
      return;
    }
    
    // Update local state immediately to prevent flickering
    setLastSavedContent(trimmedValue);
    
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
        throw new Error(`Failed to save text content: ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ Text saved successfully:`, result);
      
      // Only exit edit mode if we have content or if it's not a new input
      if (trimmedValue || !isNew) {
        setIsEditing(false);
        setHasStartedEditing(false);
      }
      
      // Ensure the component remains visible and selected after save
      setIsVisible(true);
      
      // Call parent save handler with the server response
      onSave(trimmedValue);
      
    } catch (error) {
      console.error('❌ Failed to save text:', error);
      
      // Revert local state on error
      setLastSavedContent(content);
      
      if (!isDeleted) {
        toast({
          variant: "destructive",
          title: "Save Failed",
          description: "Failed to save text. Please try again."
        });
      }
    }
  }, [inputValue, sessionId, id, fontSize, fontFamily, textColor, onSave, toast, isDeleted, isNew, content]);

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
    
    // Calculate new font size based on new height
    const newFontSize = Math.max(8, Math.min(newHeight * 0.6, 24));
    
    // 💾 SAVE CUSTOM DIMENSIONS: Remember this size for future text tags
    setCustomTagDimensions('T', { width: newWidth, height: newHeight });
    console.log(`📏 Saved custom dimensions for text tags: ${newWidth}x${newHeight}`);
    
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

  // Handle resize stop (when user finishes resizing)
  const handleResizeStop = useCallback(() => {
    setIsResizing(false);
    console.log('🔧 Text tag resize completed');
  }, []);

  // Handle click to select or start editing
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isDeleted || isResizing) return;
    
    e.stopPropagation();
    
    console.log('🖱️ Text tag clicked:', {
      id,
      isSelected,
      isEditing,
      clickDetail: e.detail,
      isNew,
      target: (e.target as HTMLElement).tagName,
      isInputTarget: (e.target as HTMLElement).tagName === 'INPUT'
    });
    
    // If clicking on the input field directly, don't interfere
    if ((e.target as HTMLElement).tagName === 'INPUT') {
      return;
    }
    
    // Always select the text input when clicked
    if (onSelect) {
      onSelect();
      console.log('📍 Text tag selection triggered for:', id);
    }
    
    // Start editing immediately for new inputs, or on any click for existing inputs
    if (isNew || !isEditing) {
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
    
    console.log('📤 Text input blur event:', {
      id,
      isEditing,
      inputValue: inputValue.trim(),
      hasContent: inputValue.trim().length > 0,
      isNew
    });
    
    // Save if content has changed
    if (isEditing && inputValue.trim() !== lastSavedContent) {
      console.log('💾 Content changed, saving on blur');
      handleSave();
    } else if (isEditing) {
      // Only exit edit mode if we have content OR if it's not a new input
      if (inputValue.trim() || !isNew) {
        console.log('✅ Exiting edit mode on blur');
        setIsEditing(false);
        setHasStartedEditing(false);
      } else {
        console.log('📝 Keeping new input in edit mode (no content)');
      }
    }
  }, [isEditing, inputValue, lastSavedContent, handleSave, isDeleted, isNew, id]);

  // Old text measurement function - DISABLED in favor of canvas-based measurement
  /*
  const measureTextDimensions = useCallback((text: string): { width: number; height: number } => {
    if (!measureRef.current) {
      // Create a temporary div to measure text if measureRef isn't available
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.visibility = 'hidden';
      tempDiv.style.pointerEvents = 'none';
      tempDiv.style.whiteSpace = 'pre-wrap';
      tempDiv.style.wordWrap = 'break-word';
      tempDiv.style.fontSize = `${dynamicFontSize}px`;
      tempDiv.style.fontFamily = fontFamily;
      tempDiv.style.padding = '2px 4px';
      tempDiv.style.border = '1px solid transparent';
      tempDiv.style.lineHeight = '1.2';
      tempDiv.textContent = text || 'M'; // Use 'M' as minimum size reference
      
      document.body.appendChild(tempDiv);
      const rect = tempDiv.getBoundingClientRect();
      document.body.removeChild(tempDiv);
      
      return {
        width: Math.max(rect.width + 10, 60), // Add padding and minimum width
        height: Math.max(rect.height + 4, 20) // Add padding and minimum height
      };
    }
    
    // Use the measureRef if available
    measureRef.current.textContent = text || 'M';
    const rect = measureRef.current.getBoundingClientRect();
    
    return {
      width: Math.max(rect.width + 10, 60),
      height: Math.max(rect.height + 4, 20)
    };
  }, [dynamicFontSize, fontFamily]);
  */

  // Old auto-resize logic - DISABLED in favor of canvas-based measurement in onChange
  /*
  useEffect(() => {
    console.log('🔍 Auto-resize effect triggered:', {
      id,
      isEditing,
      inputValue,
      inputLength: inputValue.length,
      isDeleted,
      currentDimensions: dimensions
    });

    if (isEditing && !isDeleted) {
      const newDimensions = measureTextDimensions(inputValue);
      const newWidth = newDimensions.width / scaleFactor;
      const newHeight = newDimensions.height / scaleFactor;
      
      console.log('📐 Text measurement results:', {
        id,
        text: inputValue || '(empty)',
        measuredWidth: newDimensions.width,
        measuredHeight: newDimensions.height,
        scaleFactor,
        newWidthInPDF: newWidth,
        newHeightInPDF: newHeight,
        currentWidth: dimensions.width,
        currentHeight: dimensions.height
      });
      
      // Only update if dimensions changed significantly (avoid micro-adjustments)
      const widthDiff = Math.abs(newWidth - dimensions.width);
      const heightDiff = Math.abs(newHeight - dimensions.height);
      
      console.log('📏 Dimension comparison:', {
        id,
        widthDiff,
        heightDiff,
        shouldResize: widthDiff > 2 || heightDiff > 2
      });
      
      if (widthDiff > 2 || heightDiff > 2) {
        console.log('📏 Auto-resizing text box:', {
          id,
          text: inputValue || '(empty)',
          oldSize: `${dimensions.width}x${dimensions.height}`,
          newSize: `${newWidth}x${newHeight}`,
          direction: newWidth > dimensions.width ? 'growing' : 'shrinking'
        });
        
        setDimensions({
          width: newWidth,
          height: newHeight
        });
        
        // Save the new dimensions to backend (debounced)
        debouncedSaveDimensions(newWidth, newHeight);
      } else {
        console.log('📏 No resize needed (change too small):', {
          id,
          widthDiff,
          heightDiff
        });
      }
    }
  }, [inputValue, isEditing, isDeleted, scaleFactor]);
  */

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
        
        // Update the coordinates for parent component
        if (onResize) {
          onResize({
            x: position.x,
            y: position.y,
            width: newWidth,
            height: newHeight
          });
        }

      } catch (error) {
        console.error('❌ Failed to save auto-resized dimensions:', error);
      }
    }, 500), // 500ms debounce
    [sessionId, id, position.x, position.y, onResize, isDeleted]
  );

  // Clean up debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSaveDimensions.cancel?.();
    };
  }, [debouncedSaveDimensions]);

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
            onChange={(e) => {
              const newValue = e.target.value;
              setInputValue(newValue);
              
              // Use the centralized auto-resize function
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
              // Ensure text doesn't get cut off
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
              {inputValue || (
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