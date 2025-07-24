import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  webSocket?: WebSocket | null; // Add WebSocket for real-time updates
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
  onFontSizeChange,
  webSocket
}) => {
  const [inputValue, setInputValueRaw] = useState(content);
  const [isEditing, setIsEditing] = useState(isNew); // Start editing if new
  const [hasStartedEditing, setHasStartedEditing] = useState(isNew); // Track if user has started editing
  const [lastSavedContent, setLastSavedContent] = useState(content); // Track last saved content to avoid resets
  const [isProcessingClick, setIsProcessingClick] = useState(false); // Prevent duplicate click processing
  
  // Debug wrapper for setInputValue to track all calls
  const setInputValue = useCallback((value: string) => {
    console.log('📝 setInputValue called:', {
      id,
      from: inputValue,
      to: value,
      stack: new Error().stack?.split('\n')[2]?.trim() // Show where it was called from
    });
    setInputValueRaw(value);
  }, [id, inputValue]);

  // Debounced WebSocket broadcast for real-time text changes
  const broadcastTextChange = useCallback(
    debounce((newValue: string) => {
      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        console.log('📡 Broadcasting text change:', {
          textInputId: id,
          content: newValue,
          userId: assignedUserId.toString()
        });
        
        webSocket.send(JSON.stringify({
          type: 'text_input_changed',
          payload: {
            textInputId: id,
            content: newValue,
            coordinates,
            sessionId
          },
          userId: assignedUserId.toString(),
          sessionId,
          timestamp: Date.now()
        }));
      }
    }, 300), // Increased debounce to reduce network traffic
    [webSocket, id, coordinates, sessionId, assignedUserId]
  );

  // Debug: Track component mount/unmount (CRITICAL for debugging text vanishing)
  useEffect(() => {
    console.log('🚀 StreamlinedTextInput MOUNTED:', id);
    return () => {
      console.log('💀 StreamlinedTextInput UNMOUNTED:', id);
      // Cancel any pending debounced operations
      broadcastTextChange.cancel();
    };
  }, [id, broadcastTextChange]);

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
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null); // For debouncing clicks

  // Access editor store for custom dimensions
  const { setCustomTagDimensions } = useEditorStore();
  
  const inputRef = useRef<HTMLInputElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLDivElement>(null); // For measuring text dimensions
  const { toast } = useToast();
  
  // Memoized dynamic font size calculation
  const dynamicFontSize = useMemo(() => {
    return Math.max(8, Math.min(dimensions.height * 0.6, 24));
  }, [dimensions.height]);

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
    // This prevents overwriting user input while they're typing
    if (hasStartedEditing && isEditing && inputValue.trim() !== '') {
      console.log('📝 Preserving user input during editing:', inputValue);
      return;
    }
    
    // Only update if the content actually changed and it's not the same as current input
    // This prevents unnecessary re-renders and input field resets
    if (content !== lastSavedContent && content !== inputValue) {
      console.log('📄 Content prop updated, syncing inputValue:', { 
        from: lastSavedContent, 
        to: content,
        currentInput: inputValue,
        isFromSync: true
      });
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

  // Handle deletion - IMPROVED
  const handleDelete = useCallback(async () => {
    if (isDeleted) return; // Prevent multiple deletions
    
    console.log('🗑️ Deleting text input:', id);
    setIsDeleted(true); // Mark as deleted immediately
    setIsVisible(false); // Hide immediately
    
    // Cancel any ongoing editing
    setIsEditing(false);
    setHasStartedEditing(false);
    
    // Cancel any pending operations
    broadcastTextChange.cancel();
    
    try {
      // ✅ FIX: Add proper backend API call to delete text input
      const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok && response.status !== 404) {
        console.error('❌ Failed to delete text input from backend:', response.status);
        // Don't restore on backend failure - keep it deleted locally
      } else {
        console.log('✅ Text input deleted from backend successfully');
      }
      
      // ✅ FIX: Broadcast deletion via WebSocket for real-time sync
      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        console.log('📡 Broadcasting text input deletion:', {
          textInputId: id,
          userId: assignedUserId.toString()
        });
        
        webSocket.send(JSON.stringify({
          type: 'text_input_deleted',
          payload: {
            textInputId: id,
            sessionId
          },
          userId: assignedUserId.toString(),
          sessionId,
          timestamp: Date.now()
        }));
      }
      
    } catch (error) {
      console.error('❌ Error during text input deletion:', error);
      // Keep it deleted locally even if backend fails
    }
    
    // Clean up any pending operations and call parent handler
    onDelete();
  }, [id, onDelete, isDeleted, sessionId, webSocket, assignedUserId, broadcastTextChange]);

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
  }, [isSelected, isEditing, isDeleted, content, setInputValue, handleDelete]);

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

  // Save text content - IMPROVED with real-time sync
  const handleSave = useCallback(async (content?: string) => {
    if (isDeleted) return; // Prevent API calls after deletion
    
    const trimmedValue = (content || inputValue).trim();
    
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
      
      // ✅ FIX: Broadcast save completion via WebSocket for real-time sync
      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        console.log('📡 Broadcasting text save completion:', {
          textInputId: id,
          content: trimmedValue,
          userId: assignedUserId.toString()
        });
        
        webSocket.send(JSON.stringify({
          type: 'text_input_saved',
          payload: {
            textInputId: id,
            content: trimmedValue,
            coordinates,
            sessionId,
            fontSize,
            fontFamily,
            textColor
          },
          userId: assignedUserId.toString(),
          sessionId,
          timestamp: Date.now()
        }));
      }
      
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
      if (isDeleted) return; // Ignore errors for deleted components
      
      console.error(`❌ Failed to save text content for ${id}:`, error);
      toast({
        title: "Save Error",
        description: `Failed to save text: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  }, [id, sessionId, fontSize, fontFamily, textColor, onSave, toast, isDeleted, isNew, inputValue, webSocket, assignedUserId, coordinates]);

  // ✅ NEW: WebSocket message handler for real-time updates
  useEffect(() => {
    if (!webSocket || webSocket.readyState !== WebSocket.OPEN) return;
    
    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        // Only handle messages for this specific text input
        if (message.payload?.textInputId !== id) return;
        
        // Don't process messages from the same user to avoid loops
        if (message.userId === assignedUserId.toString()) return;
        
        console.log('📡 Received WebSocket message for text input:', id, message);
        
        switch (message.type) {
          case 'text_input_changed':
            // Update content in real-time while someone else is typing
            if (message.payload?.content !== undefined && !isEditing) {
              console.log('📝 Updating text content from WebSocket:', message.payload.content);
              setInputValue(message.payload.content);
              setLastSavedContent(message.payload.content);
            }
            break;
            
          case 'text_input_saved':
            // Update content when someone else saves
            if (message.payload?.content !== undefined) {
              console.log('💾 Updating text content from WebSocket save:', message.payload.content);
              setInputValue(message.payload.content);
              setLastSavedContent(message.payload.content);
              // Exit editing mode if we're not the one editing
              if (!isEditing) {
                setIsEditing(false);
                setHasStartedEditing(false);
              }
            }
            break;
        }
      } catch (error) {
        console.error('❌ Error processing WebSocket message:', error);
      }
    };
    
    webSocket.addEventListener('message', handleWebSocketMessage);
    
    return () => {
      webSocket.removeEventListener('message', handleWebSocketMessage);
    };
  }, [webSocket, id, assignedUserId, isEditing, setInputValue]);

  // Handle drag stop - convert back to PDF coordinates and save to server
  const handleDragStop = useCallback((e: any, data: any) => {
    if (isDeleted) return;
    
    const newX = Math.round(data.x / scaleFactor);
    const newY = Math.round(data.y / scaleFactor);
    
    // Update position immediately for real-time feedback
    setPosition({ x: newX, y: newY });
    
    if (onMove) {
      onMove({ x: newX, y: newY });
    }
    
    // 🚀 REAL-TIME SYNC: Save position to server with WebSocket broadcasting (fire and forget)
    (async () => {
      try {
        const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${id}/position`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            x: newX,
            y: newY,
            width: dimensions.width,
            height: dimensions.height,
            pageNumber: coordinates.pageNumber
          })
        });
        
        if (!response.ok && response.status !== 404) {
          throw new Error(`Failed to save position: ${response.status}`);
        }
        
        console.log(`✅ Text tag position saved: ${newX}, ${newY}`);
        
      } catch (error) {
        console.error('❌ Failed to save text tag position:', error);
        // Don't revert position on error - let user retry
      }
    })();
  }, [scaleFactor, sessionId, id, onMove, coordinates.pageNumber, dimensions.width, dimensions.height, isDeleted]);

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
    
    // 🚀 REAL-TIME SYNC: Save dimensions to server with WebSocket broadcasting (fire and forget)
    (async () => {
      try {
        const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${id}/position`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
            pageNumber: coordinates.pageNumber
          })
        });
        
        if (!response.ok && response.status !== 404) {
          throw new Error(`Failed to save dimensions: ${response.status}`);
        }
        
        console.log(`✅ Text tag dimensions saved: ${newWidth}x${newHeight} at ${newX}, ${newY}`);
        
      } catch (error) {
        console.error('❌ Failed to save text tag dimensions:', error);
        // Don't revert dimensions on error - let user retry
      }
    })();
  }, [scaleFactor, sessionId, id, onResize, isDeleted]);

  // Handle resize stop (when user finishes resizing)
  const handleResizeStop = useCallback(() => {
    setIsResizing(false);
    console.log('🔧 Text tag resize completed');
  }, []);

  // Handle click to select or start editing - FIXED to prevent duplication
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isDeleted || isResizing) return;
    
    // ✅ CRITICAL FIX: Prevent duplicate processing with more robust debouncing
    if (isProcessingClick) {
      console.log('🚫 Click already being processed, ignoring duplicate');
      return;
    }
    
    setIsProcessingClick(true);
    
    // Clear any existing timeout
    if (clickTimeout) {
      clearTimeout(clickTimeout);
    }
    
    // Set timeout to reset processing flag
    const newTimeout = setTimeout(() => {
      setIsProcessingClick(false);
    }, 300);
    setClickTimeout(newTimeout);
    
    e.stopPropagation();
    e.preventDefault();
    
    console.log('🖱️ Text tag clicked:', {
      id,
      isSelected,
      isEditing,
      clickDetail: e.detail,
      isNew,
      target: (e.target as HTMLElement).tagName,
      timeStamp: e.timeStamp
    });
    
    // If clicking on the input field directly, don't interfere
    if ((e.target as HTMLElement).tagName === 'INPUT') {
      console.log('🎯 Input field clicked directly, allowing natural focus');
      return;
    }
    
    // If already editing, don't process click
    if (isEditing) {
      console.log('⚠️ Already editing, ignoring click for:', id);
      return;
    }
    
    // Always select the text input when clicked (avoid duplicate selections)
    if (onSelect && !isSelected) {
      console.log('📍 Text tag selection triggered for:', id);
      onSelect();
    }
    
    // ✅ FIX: Simplified click handling - single click starts editing
    console.log('✏️ Starting text editing for:', id);
    setIsEditing(true);
    setHasStartedEditing(true);
    
    // Focus with proper timing
    setTimeout(() => {
      if (inputRef.current && !isDeleted) {
        inputRef.current.focus();
        inputRef.current.select(); // Select existing text for easy replacement
      }
    }, 50);
    
  }, [onSelect, isDeleted, isResizing, id, isSelected, isEditing, isProcessingClick, clickTimeout]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }
    };
  }, [clickTimeout]);

  // Handle keyboard in input field
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isDeleted) return;
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave(inputValue); // Use inputValue from state
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Cancel editing and restore original value
      setInputValue(content);
      setIsEditing(false);
      setHasStartedEditing(false);
    }
  }, [handleSave, content, isDeleted, setInputValue, inputValue]);

  // Handle input blur (save when clicking outside) - IMPROVED
  const handleBlur = useCallback(() => {
    if (isDeleted) return;
    
    console.log('📤 Text input blur event:', {
      id,
      isEditing,
      inputValue: inputValue.trim(),
      hasContent: inputValue.trim().length > 0,
      isNew
    });
    
    // Small delay to allow for potential clicks on the same element
    setTimeout(() => {
      if (isDeleted) return;
      
      // Save if content has changed
      if (isEditing && inputValue.trim() !== lastSavedContent) {
        console.log('💾 Content changed, saving on blur');
        handleSave(inputValue);
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
    }, 100); // Small delay to prevent race conditions
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

  // Memoized display style to prevent recalculation
  const displayStyle = useMemo((): React.CSSProperties => ({
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
    pointerEvents: 'auto',
    userSelect: isEditing ? 'text' : 'none'
  }), [position.x, position.y, dimensions.width, dimensions.height, scaleFactor, fontSize, fontFamily, textColor, isEditing, isSelected]);

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
        className="streamlined-text-input"
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
          data-text-input-id={id}
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
              
              // Update local state immediately for responsive UI
              setInputValue(newValue);
              
              // ✅ FIX: Only broadcast changes if user is actively typing (not programmatic updates)
              if (hasStartedEditing) {
                broadcastTextChange(newValue);
              }
              
              // Auto-resize as user types
              performAutoResize(newValue);
              
              // Auto-save when user stops typing (will be handled by blur event)
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
              title="Click to edit, Delete key to delete"
            >
              {inputValue || (
                <span style={{ 
                  color: '#999', 
                  fontStyle: 'italic',
                  fontSize: '0.9em',
                  whiteSpace: 'nowrap'
                }}>
                  Click to add text
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