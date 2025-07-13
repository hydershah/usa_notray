import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  onFontSizeChange
}) => {
  const [inputValue, setInputValue] = useState(content);
  const [isEditing, setIsEditing] = useState(isNew); // Start editing if new
  const [isVisible, setIsVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ 
    x: coordinates.x, 
    y: coordinates.y 
  });
  const [isDeleted, setIsDeleted] = useState(false); // Track deletion state
  
  const inputRef = useRef<HTMLInputElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Update position when coordinates change
  useEffect(() => {
    setPosition({ x: coordinates.x, y: coordinates.y });
  }, [coordinates.x, coordinates.y]);

  // Auto-focus on new text inputs
  useEffect(() => {
    if (isNew && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isNew]);

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
    setIsDragging(false);
    
    // Clean up any pending operations
    onDelete();
  }, [id, onDelete, isDeleted]);

  // Handle click to select or start editing
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isDeleted) return;
    
    e.stopPropagation();
    if (onSelect) {
      onSelect();
    }
    // Only start editing on double click or if it's a new input
    if (e.detail === 2 || isNew) {
      setIsEditing(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isNew, onSelect, isDeleted]);

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing || isDeleted) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    
    if (onSelect) {
      onSelect();
    }
  }, [isEditing, onSelect, isDeleted]);

  // Handle drag
  useEffect(() => {
    if (!isDragging || isDeleted) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isDeleted) return; // Stop processing if deleted
      
      const parentRect = containerRef.current?.parentElement?.getBoundingClientRect();
      if (!parentRect) return;
      
      // Calculate new position relative to canvas
      const newX = (e.clientX - parentRect.left - dragStart.x) / scaleFactor;
      const newY = (e.clientY - parentRect.top - dragStart.y) / scaleFactor;
      
      setPosition({
        x: Math.max(0, newX),
        y: Math.max(0, newY)
      });
    };
    
    const handleMouseUp = async () => {
      setIsDragging(false);
      
      // Don't save position if deleted
      if (isDeleted) {
        console.log('Text input was deleted, skipping position save');
        return;
      }
      
      // Save new position
      if (onMove) {
        onMove(position);
      }
      
      // Also save to backend
      try {
        const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${id}/position`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            x: position.x,
            y: position.y
          })
        });
        
        if (!response.ok) {
          // Don't show error if it's deleted (404)
          if (response.status === 404) {
            console.log('Text input was deleted, position save skipped');
            return;
          }
          throw new Error('Failed to save position');
        }
      } catch (error) {
        console.error('Failed to save position:', error);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, scaleFactor, sessionId, id, position, onMove, isDeleted]);

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
    }
  }, [handleSave, content, isDeleted]);

  // Handle input blur (save when clicking outside)
  const handleBlur = useCallback(() => {
    if (isDeleted) return;
    
    if (isEditing && inputValue !== content) {
      handleSave();
    } else if (isEditing) {
      setIsEditing(false);
    }
  }, [isEditing, inputValue, content, handleSave, isDeleted]);

  // Calculate display properties
  const displayStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x * scaleFactor}px`,
    top: `${position.y * scaleFactor}px`,
    width: `${coordinates.width * scaleFactor}px`,
    minHeight: `${coordinates.height * scaleFactor}px`,
    fontSize: `${fontSize * scaleFactor}px`,
    fontFamily,
    color: textColor,
    lineHeight: '1.2',
    cursor: isDragging ? 'grabbing' : isEditing ? 'text' : 'grab',
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
    scaleFactor,
    isEditing,
    isSelected,
    isDragging,
    isNew,
    isVisible,
    isDeleted
  });

  return (
    <div
      ref={containerRef}
      style={displayStyle}
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
            background: 'transparent', // Remove white background
            border: 'none',
            outline: '1px solid rgba(0, 0, 0, 0.3)', // Simple gray outline instead of colored
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
        // Display mode - show text content with controls
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%'
          }}
        >
          <span
            ref={spanRef}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            style={{
              display: 'inline-block',
              padding: '2px 4px',
              background: 'transparent', // Remove white background
              border: 'none', // Remove border entirely
              borderRadius: '2px',
              minWidth: '20px',
              minHeight: '13px', // Reduced proportionally with tag height (20px -> 13px)
              boxShadow: 'none', // Remove any shadow
              transition: 'all 0.15s ease',
              width: '100%'
              // Completely clean - no selection indicators
            }}
            title="Double-click to edit, Delete key to delete"
          >
            {inputValue || (
              <span style={{ 
                color: '#ccc', 
                fontStyle: 'italic',
                fontSize: '0.9em'
              }}>
                Double-click to add text
              </span>
            )}
          </span>
          
          {/* Control buttons removed for clean text appearance - use keyboard shortcuts instead:
              - Double-click to edit
              - Delete key to delete
          */}
        </div>
      )}
    </div>
  );
}; 