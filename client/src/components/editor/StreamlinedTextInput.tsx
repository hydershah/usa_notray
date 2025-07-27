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
  // Increased default font size for better readability
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
  onFontSizeChange,
  webSocket
}) => {
  const [inputValue, setInputValueRaw] = useState(content);
  const [currentFontSize, setCurrentFontSize] = useState(fontSize);
  const [isEditing, setIsEditing] = useState(isNew); // Start editing if new
  const [hasStartedEditing, setHasStartedEditing] = useState(isNew); // Track if user has started editing
  const [lastSavedContent, setLastSavedContent] = useState(content); // Track last saved content to avoid resets
  const [isProcessingClick, setIsProcessingClick] = useState(false); // Prevent duplicate click processing
  
  // ✅ NEW: Drag state management to prevent flickering
  const [isDragging, setIsDragging] = useState(false);
  const [isLocallyUpdating, setIsLocallyUpdating] = useState(false);
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ NEW: Enhanced resize state management
  const [isResizing, setIsResizing] = useState(false);
  const [lastValidSize, setLastValidSize] = useState({ width: coordinates.width, height: coordinates.height });
  
  // Simplified setInputValue to prevent dependency loops
  const setInputValue = useCallback((value: string) => {
    console.log('📝 setInputValue called for:', id, 'value:', value);
    setInputValueRaw(value);
  }, [id]);

  // ✅ FIXED: More controlled WebSocket broadcast with deduplication  
  const lastBroadcastValue = useRef<string>('');
  const broadcastTextChange = useCallback(
    debounce((newValue: string) => {
      // Prevent duplicate broadcasts
      if (lastBroadcastValue.current === newValue) {
        console.log('🚫 Skipping duplicate broadcast for:', newValue);
        return;
      }
      
      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        console.log('📡 Broadcasting text change:', {
          textInputId: id,
          content: newValue,
          userId: assignedUserId.toString()
        });
        
        lastBroadcastValue.current = newValue;
        
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
    }, 500), // Increased debounce to prevent rapid-fire updates
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
  
  // ✅ FIXED: Consistent font size that doesn't change based on container size to prevent UX disruption
  const dynamicFontSize = useMemo(() => currentFontSize, [currentFontSize]);

  // ✅ IMPROVED: Calculate precise dimensions that fit text exactly
  const getMinimumDimensions = useCallback((text: string = inputValue): { width: number; height: number } => {
    // Create a canvas to measure text accurately
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      // Fallback if canvas is not available
      return { width: 60, height: 24 };
    }

    // Use the actual font size for precise measurement
    const measureFontSize = currentFontSize;
    ctx.font = `${measureFontSize}px ${fontFamily}`;
    
    // Measure the text width
    const textToMeasure = text || 'Text';
    const textMetrics = ctx.measureText(textToMeasure);
    const textWidth = textMetrics.width;
    
    // ✅ ULTRA-TIGHT FIT: Minimal padding that closely follows text outline
    const minTextWidth = Math.max(textWidth + 4, 20); // Just 2px padding on each side, minimum 20px
    const minTextHeight = Math.max(measureFontSize + 2, 14); // Just 1px padding top/bottom, minimum 14px
    
    return {
      width: minTextWidth,
      height: minTextHeight
    };
  }, [inputValue, currentFontSize, fontFamily]);

  // ✅ NEW: Calculate exact text dimensions for tight fitting
  const getExactTextDimensions = useCallback((text: string = inputValue): { width: number; height: number } => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      return { width: 60, height: 24 };
    }

    const measureFontSize = currentFontSize;
    ctx.font = `${measureFontSize}px ${fontFamily}`;
    
    const textToMeasure = text || 'Text';
    const textMetrics = ctx.measureText(textToMeasure);
    const textWidth = textMetrics.width;
    
    // ✅ EXACT FIT: Background exactly matches text size with minimal padding
    return {
      width: Math.max(textWidth + 2, 20), // Even tighter - just 1px padding each side
      height: Math.max(measureFontSize + 1, 14) // Even tighter - minimal padding top/bottom
    };
  }, [inputValue, currentFontSize, fontFamily]);

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

  // For newly placed text inputs, don't jump straight into edit mode.
  // This allows users to drag/position an empty tag before typing.
  useEffect(() => {
    if (isNew && onSelect) {
      onSelect(); // highlight/select the tag so it can be dragged immediately
    }
  }, [isNew, onSelect]);

  // ✅ FIXED: Simplified auto-resize that only runs when explicitly requested
  const lastResizeText = useRef<string>('');
  const performAutoResize = useCallback(
    debounce((text: string, force: boolean = false) => {
      // Only auto-resize if forced or if it's a new text input that needs initial sizing
      if (isDeleted || (!force && !isNew) || lastResizeText.current === text) return;
      
      lastResizeText.current = text;
      console.log('📏 Performing controlled auto-resize for:', text, '(forced:', force, ')');
      
      // Get exact dimensions for the text
      const exactDimensions = getExactTextDimensions(text);
      
      console.log('✅ Auto-resize to text dimensions:', {
        text: text || '(empty)',
        oldSize: `${dimensions.width.toFixed(1)}x${dimensions.height.toFixed(1)}`,
        newSize: `${exactDimensions.width.toFixed(1)}x${exactDimensions.height.toFixed(1)}`,
        isNew,
        forced: force
      });
      
      // Only resize to exact text dimensions for new inputs or when forced
      setDimensions({
        width: exactDimensions.width,
        height: exactDimensions.height
      });
      
    }, 300), // Debounce auto-resize to prevent rapid calls
    [isDeleted, getExactTextDimensions, dimensions.width, dimensions.height, isNew]
  );

  // ✅ FIXED: Only auto-resize for brand new text inputs that need initial sizing
  useEffect(() => {
    // Only auto-resize for completely new text inputs (never edited before)
    if (isNew && !hasStartedEditing && !inputValue.trim()) {
             console.log('📏 Initial sizing for new text input:', id);
       // Provide a visible default size instead of collapsing to a dot
       setDimensions({ width: 120, height: 40 });
    }
    // Don't auto-resize existing inputs or when user is actively editing
  }, [isNew, hasStartedEditing, inputValue, getExactTextDimensions]); // Only for truly new inputs

  // Maintain editing state even when isNew becomes false if user was editing
  useEffect(() => {
    if (hasStartedEditing && !isEditing && inputValue.trim() === '' && isSelected) {
      setIsEditing(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [hasStartedEditing, isEditing, inputValue, isSelected]);

  // 🧩 Auto-tighten box when content or font size changes (only when not editing/resizing)
  useEffect(() => {
    if (isEditing || isResizing || isDeleted) return;

    const newFontSize = Math.max(8, Math.round(dimensions.height - 4));
    if (newFontSize !== currentFontSize) {
      setCurrentFontSize(newFontSize);
      onFontSizeChange?.(newFontSize);
    }
  }, [dimensions.height, isEditing, isResizing, isDeleted, currentFontSize, onFontSizeChange]);
   
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
      
      // ✅ FIXED: Exit edit mode and preserve current size when saving
      if (trimmedValue || !isNew) {
        setIsEditing(false);
        setHasStartedEditing(false);
        // Don't auto-resize when saving - keep current dimensions
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

  // ✅ IMPROVED: WebSocket message handler with drag state awareness
  useEffect(() => {
    if (!webSocket || webSocket.readyState !== WebSocket.OPEN) return;
    
    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        // Only handle messages for this specific text input
        if (message.payload?.textInputId !== id) return;
        
        // Don't process messages from the same user to avoid loops
        if (message.userId === assignedUserId.toString()) return;
        
        // ✅ NEW: Skip position updates while dragging to prevent conflicts
        if (isDragging && (message.type === 'text_input_position_updated' || message.type === 'tag_updated')) {
          console.log('🚫 Skipping position update during drag:', message.type);
          return;
        }
        
        console.log('📡 Received WebSocket message for text input:', id, message);
        
        switch (message.type) {
          case 'text_input_changed':
            // ✅ FIXED: Better conditions for updating text to prevent corruption
            if (message.payload?.content !== undefined && 
                !isEditing && 
                !isDeleted && 
                message.payload.content !== inputValue) {
              console.log('📝 Updating text content from WebSocket:', message.payload.content);
              setInputValue(message.payload.content);
              setLastSavedContent(message.payload.content);
            }
            break;
            
          case 'text_input_saved':
            // ✅ FIXED: Better conditions for save updates
            if (message.payload?.content !== undefined && 
                !isDeleted && 
                message.payload.content !== inputValue) {
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
            
          case 'text_input_position_updated':
            // Update position from other users (only if not dragging)
            if (!isDragging && !isLocallyUpdating && message.payload?.coordinates) {
              console.log('📍 Updating position from WebSocket:', message.payload.coordinates);
              setPosition({
                x: message.payload.coordinates.x,
                y: message.payload.coordinates.y
              });
              if (message.payload.coordinates.width && message.payload.coordinates.height) {
                setDimensions({
                  width: message.payload.coordinates.width,
                  height: message.payload.coordinates.height
                });
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
  }, [webSocket, id, assignedUserId, isEditing, isDragging, isLocallyUpdating, setInputValue]);

  // Debounced save function for better performance - using useRef to avoid recreation
  const debouncedSaveRef = useRef(
    debounce(async (sessionId: string, id: string, x: number, y: number, width: number, height: number, pageNumber: number) => {
      try {
        const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${id}/position`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            x,
            y,
            width,
            height,
            pageNumber
          })
        });
        
        if (!response.ok && response.status !== 404) {
          throw new Error(`Failed to save: ${response.status}`);
        }
        
        console.log(`✅ Text tag saved: ${width}x${height} at ${x}, ${y}`);
        
      } catch (error) {
        console.error('❌ Failed to save text tag:', error);
      }
    }, 800) // Increased debounce time to 800ms for better performance
  );

  // ✅ FIXED: Simplified drag stop handling with better coordinate management
  const handleDragStop = useCallback((e: any, data: any) => {
    console.log('🖱️ handleDragStop called:', { id, isDeleted, data });
    if (isDeleted) return;
    
    // Convert display coordinates back to PDF coordinates
    const newX = Math.round(data.x / scaleFactor);
    const newY = Math.round(data.y / scaleFactor);
    
    console.log('🖱️ Drag completed:', { 
      displayCoords: { x: data.x, y: data.y }, 
      pdfCoords: { x: newX, y: newY },
      scaleFactor 
    });
    
    // Update local position state immediately for responsive UI
    setPosition({ x: newX, y: newY });
    
    // Notify parent component of position change
    if (onMove) {
      onMove({ x: newX, y: newY });
    }
    
    // Save to server with debouncing (keep current dimensions)
    debouncedSaveRef.current(sessionId, id, newX, newY, dimensions.width, dimensions.height, coordinates.pageNumber);

    // 🚀 Live broadcast
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
      webSocket.send(JSON.stringify({
        type: 'text_input_position_updated',
        payload: {
          textInputId: id,
          coordinates: { x: newX, y: newY, width: dimensions.width, height: dimensions.height },
          fontSize: currentFontSize
        },
        userId: assignedUserId.toString(),
        sessionId,
        timestamp: Date.now()
      }));
    }
  }, [scaleFactor, sessionId, id, onMove, dimensions.width, dimensions.height, isDeleted, coordinates.pageNumber, webSocket, assignedUserId, currentFontSize]);

  // ✅ ENHANCED: Improved resize handler with better constraints and sensitivity
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

    // Directly update dimensions and font size for real-time preview
    setDimensions({ width: newWidth, height: newHeight });

    const autoSize = Math.max(8, Math.round(newHeight - 4));
    if (autoSize !== currentFontSize) {
      setCurrentFontSize(autoSize);
      onFontSizeChange?.(autoSize);
    }

    console.log('✅ Text tag resized:', { 
      id, 
      newSize: `${newWidth}x${newHeight}`,
    });

    if (onResize) {
      onResize({ x: position.x, y: position.y, width: newWidth, height: newHeight });
    }
  }, [scaleFactor, id, onResize, isDeleted, currentFontSize, onFontSizeChange]);

  // ✅ ENHANCED: Handle resize stop with better feedback
  const handleResizeStop = useCallback((e: any, direction: any, ref: HTMLElement, delta: any, positionParam: any) => {
    setIsResizing(false);
    const newWidth = parseInt(ref.style.width) / scaleFactor;
    const newHeight = parseInt(ref.style.height) / scaleFactor;
    const newX = positionParam.x / scaleFactor;
    const newY = positionParam.y / scaleFactor;

    setPosition({ x: newX, y: newY });
    // Save final geometry
    debouncedSaveRef.current(sessionId, id, newX, newY, newWidth, newHeight, coordinates.pageNumber);

    // 🚀 Broadcast final geometry
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
      webSocket.send(JSON.stringify({
        type: 'text_input_position_updated',
        payload: {
          textInputId: id,
          coordinates: { x: newX, y: newY, width: newWidth, height: newHeight },
          fontSize: currentFontSize
        },
        userId: assignedUserId.toString(),
        sessionId,
        timestamp: Date.now()
      }));
    }
    console.log('🔧 Resize stop. Saved geometry.');
  }, [scaleFactor, sessionId, id, coordinates.pageNumber, webSocket, assignedUserId, currentFontSize]);

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
    
    // First click selects (enables drag); second click enters edit mode
    if (!isSelected) {
      onSelect?.();
      return; // allow drag & other interactions without opening editor yet
    }
    // If already selected but not editing, start editing
    if (!isEditing) {
      console.log('✏️ Starting text editing for:', id);
      setIsEditing(true);
      setHasStartedEditing(true);
      setTimeout(() => {
        if (inputRef.current && !isDeleted) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
    
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
    
    // Tighten box to content on blur (shrink if necessary)
    performAutoResize(inputValue, true);
    
    // Small delay to allow for potential clicks on the same element
    setTimeout(() => {
      if (isDeleted) return;
      
      // Save if content has changed, but don't change dimensions
      if (isEditing && inputValue.trim() !== lastSavedContent) {
        console.log('💾 Content changed, saving on blur without resize');
        handleSave(inputValue);
      } else if (isEditing) {
        // Only exit edit mode if we have content OR if it's not a new input
        if (inputValue.trim() || !isNew) {
          console.log('✅ Exiting edit mode on blur - keeping current size');
          setIsEditing(false);
          setHasStartedEditing(false);
          // Explicitly preserve current dimensions to prevent size jumping
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
    fontSize: `${currentFontSize * scaleFactor}px`,
    fontFamily,
    color: textColor,
    lineHeight: '1.2',
    cursor: isEditing ? 'text' : 'move',
    zIndex: isSelected ? 1000 : 100,
    pointerEvents: 'auto',
    userSelect: isEditing ? 'text' : 'none'
  }), [position.x, position.y, dimensions.width, dimensions.height, scaleFactor, fontFamily, textColor, isEditing, isSelected, currentFontSize]);

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
    enableResizing: isSelected && !isEditing,
    canDrag: !isEditing,
    canResize: isSelected && !isEditing
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

      {/* ✅ ENHANCED: Improved CSS animations for better UX */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-2px); }
            75% { transform: translateX(2px); }
          }
          
          @keyframes glow {
            0%, 100% { box-shadow: 0 0 5px rgba(220, 53, 69, 0.4); }
            50% { box-shadow: 0 0 15px rgba(220, 53, 69, 0.8); }
          }
          
          .streamlined-text-input .react-resizable-handle {
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
          }
          
          .streamlined-text-input .react-resizable-handle:hover {
            transform: scale(1.2) !important;
            filter: brightness(1.15) drop-shadow(0 2px 8px rgba(0, 123, 255, 0.4)) !important;
          }
          
          .streamlined-text-input .react-resizable-handle:active {
            transform: scale(1.1) !important;
            filter: brightness(1.3) !important;
          }
          
          .streamlined-text-input:hover {
            z-index: 999 !important;
          }
          
          .streamlined-text-input.warning .react-resizable-handle {
            animation: shake 0.6s ease-in-out !important;
          }
          
          .streamlined-text-input.warning {
            animation: glow 1s ease-in-out infinite !important;
          }
          
          /* ✅ NEW: Improved text scaling transitions */
          .streamlined-text-input span {
            transition: font-size 0.2s ease, opacity 0.2s ease !important;
          }
          
          /* ✅ NEW: Better visual feedback for small containers */
          .streamlined-text-input.compact {
            border-radius: 3px !important;
          }
          
          .streamlined-text-input.compact .react-resizable-handle {
            opacity: 0.8 !important;
          }
        `}
      </style>
      
      <Rnd
        size={{
          width: dimensions.width * scaleFactor,
          height: dimensions.height * scaleFactor
        }}
        position={{
          x: position.x * scaleFactor,
          y: position.y * scaleFactor
        }}
        onDragStart={(e, data) => {
          console.log('🖱️ onDragStart called:', { id, isSelected, isEditing, data });
          // Don't allow drag if editing
          if (isEditing) {
            e.preventDefault();
            return false;
          }
        }}
        onDragStop={handleDragStop}
        onResize={handleResize}
        onResizeStop={handleResizeStop}
        onResizeStart={(e, direction, ref) => {
          console.log('📏 onResizeStart called:', { id, isSelected, isEditing, direction });
          setIsResizing(true);
        }}
        enableResizing={isSelected ? {
          top: false,
          right: false,
          bottom: false,
          left: false,
          topRight: false,
          bottomRight: true, // Only bottom-right handle for cleaner look
          bottomLeft: false,
          topLeft: false,
        } : false}
        disableDragging={isEditing}
        // Keep reasonable minimum size so empty tags are easy to drag/select
        minWidth={40 * scaleFactor}
        minHeight={20 * scaleFactor}
        bounds="parent"
        className="streamlined-text-input"
        style={{
          zIndex: isSelected ? 1000 : 100,
          pointerEvents: 'auto',
          transform: 'translateZ(0)', // Force hardware acceleration
        }}
        resizeHandleStyles={isSelected ? {
          bottomRight: {
            width: '8px',
            height: '8px',
            backgroundColor: '#2563eb',
            border: 'none',
            borderRadius: '50%',
            right: '-4px',
            bottom: '-4px',
            cursor: 'se-resize',
            opacity: 1
          }
        } : {}}
        onClick={(e) => {
          // Handle click on the Rnd container for selection/editing
          if (isDeleted || isResizing) return;
          
          e.stopPropagation();
          
          // First click selects (enables drag); second click enters edit mode
          if (!isSelected) {
            onSelect?.();
            return;
          }
          // If already selected but not editing, start editing
          if (!isEditing) {
            console.log('✏️ Starting text editing for:', id);
            setIsEditing(true);
            setHasStartedEditing(true);
            setTimeout(() => {
              if (inputRef.current && !isDeleted) {
                inputRef.current.focus();
                inputRef.current.select();
              }
            }, 50);
          }
        }}
      >
        {/* No extra overlay while resizing – keep UI minimal */}
        
        {isEditing ? (
          // Editing mode - show input field
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              const newValue = e.target.value;
              
              // ✅ CRITICAL FIX: Prevent infinite loops and race conditions
              if (newValue === inputValue) {
                console.log('🚫 Ignoring duplicate onChange value:', newValue);
                return;
              }
              
              console.log('📝 Text onChange:', { id, from: inputValue, to: newValue });
              
              // Update local state immediately for responsive UI
              setInputValue(newValue);
              
              // ✅ FIX: Only broadcast changes if user is actively typing (not programmatic updates)
              if (hasStartedEditing && !isDeleted) {
                broadcastTextChange(newValue);
              }
              
              // 🔄 AUTO-EXPAND: Enlarge box in real-time if text exceeds current bounds (no shrink here)
              const needed = getExactTextDimensions(newValue);
              if (needed.width > dimensions.width || needed.height > dimensions.height) {
                setDimensions({ width: needed.width, height: needed.height });
              }
               
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
              padding: '1px 2px', // ✅ MINIMAL PADDING to match display mode
              margin: 0,
              fontSize: `${Math.max(dynamicFontSize, 8) * scaleFactor}px`,
              fontFamily: fontFamily,
              color: textColor,
              lineHeight: '1.1', // ✅ TIGHT line height to match display
              resize: 'none',
              overflow: 'visible', // ✅ Allow text to be fully visible
              textAlign: 'center', // ✅ Center text like display mode
              whiteSpace: 'nowrap',
              boxSizing: 'border-box'
            }}
            autoFocus
          />
        ) : (
          // Display mode - show text content with tight fit
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              cursor: isSelected && !isEditing ? 'move' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1px 2px',
              boxSizing: 'border-box',
              border: (isSelected || isNew) ? '2px solid #2563eb' : '1px dashed #bbb',
              borderRadius: '4px'
            }}
          >
            <span
              ref={spanRef}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'center',
                fontSize: `${Math.max(dynamicFontSize, 8) * scaleFactor}px`,
                fontFamily: fontFamily,
                color: textColor,
                lineHeight: '1.1', // ✅ TIGHT line height
                wordWrap: 'break-word',
                wordBreak: 'break-word',
                whiteSpace: 'nowrap', // ✅ Keep text on one line for tight fit
                overflow: 'visible', // ✅ Allow text to be fully visible
                maxWidth: '100%',
                maxHeight: '100%',
                transition: 'all 0.2s ease'
              }}
              title={`${inputValue || 'Click to add text'} - Click to edit, Delete key to delete`}
            >
              {inputValue || (
                <span style={{ 
                  color: '#999', 
                  fontStyle: 'italic',
                  fontSize: '0.9em'
                }}>
                  Text
                </span>
              )}
            </span>
            
            {/* Text overflow tooltip for long text in small containers */}
            {inputValue && inputValue.length > 15 && dimensions.width < 120 && isSelected && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '-20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  whiteSpace: 'nowrap',
                  zIndex: 1003,
                  maxWidth: '200px',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  pointerEvents: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}
              >
                Full text: "{inputValue}"
              </div>
            )}
          </div>
        )}
      </Rnd>
    </>
  );
}; 