import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Move } from 'lucide-react';

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
    if (!isSelected) return;
    
    // Delete key - delete immediately without confirmation
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      console.log('🗑️ Delete key pressed - deleting text input immediately');
      onDelete();
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
  }, [isSelected, isEditing, onDelete, content]);

  // Add keyboard event listener when selected
  useEffect(() => {
    if (isSelected) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isSelected, handleKeyDown]);

  // Auto-focus input when starting to edit
  useEffect(() => {
    if (isEditing && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isEditing]);

  // Save text content
  const handleSave = useCallback(async () => {
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
        throw new Error('Failed to save text content');
      }

      setIsEditing(false);
      onSave(trimmedValue);
      
      console.log(`✅ Text saved: "${trimmedValue}"`);
      
    } catch (error) {
      console.error('❌ Failed to save text:', error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Failed to save text. Please try again."
      });
    }
  }, [inputValue, sessionId, id, fontSize, fontFamily, textColor, onSave, toast]);

  // Handle deletion
  const handleDelete = useCallback(() => {
    console.log('🗑️ Deleting text input:', id);
    onDelete();
  }, [id, onDelete]);

  // Handle click to select or start editing
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect();
    }
    // Only start editing on double click or if it's a new input
    if (e.detail === 2 || isNew) {
      setIsEditing(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isNew, onSelect]);

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) return;
    
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
  }, [isEditing, onSelect]);

  // Handle drag
  useEffect(() => {
    if (!isDragging) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const parentRect = containerRef.current?.parentElement?.getBoundingClientRect();
      if (!parentRect) return;
      
      const newX = (e.clientX - parentRect.left - dragStart.x) / scaleFactor;
      const newY = (e.clientY - parentRect.top - dragStart.y) / scaleFactor;
      
      setPosition({
        x: Math.max(0, newX),
        y: Math.max(0, newY)
      });
    };
    
    const handleMouseUp = async () => {
      setIsDragging(false);
      
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
  }, [isDragging, dragStart, scaleFactor, sessionId, id, position, onMove]);

  // Handle keyboard in input field
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Cancel editing and restore original value
      setInputValue(content);
      setIsEditing(false);
    }
  }, [handleSave, content]);

  // Handle input blur (save when clicking outside)
  const handleBlur = useCallback(() => {
    if (isEditing && inputValue !== content) {
      handleSave();
    } else if (isEditing) {
      setIsEditing(false);
    }
  }, [isEditing, inputValue, content, handleSave]);

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
    pointerEvents: 'auto',
    userSelect: isEditing ? 'text' : 'none'
  };

  if (!isVisible) {
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
    isVisible
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
            background: 'rgba(255, 255, 255, 0.95)',
            border: 'none',
            outline: `2px solid ${userColor}`,
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
              background: isSelected ? `${userColor}20` : 'rgba(255, 255, 255, 0.8)',
              border: isSelected ? `2px solid ${userColor}` : `1px solid ${userColor}40`,
              borderRadius: '2px',
              minWidth: '20px',
              minHeight: '20px',
              boxShadow: isSelected ? '0 0 0 2px rgba(59, 130, 246, 0.15)' : 'none',
              transition: 'all 0.15s ease',
              width: '100%'
            }}
            title="Double-click to edit, drag to move"
          >
            {inputValue || (
              <span style={{ 
                color: '#999', 
                fontStyle: 'italic' 
              }}>
                Double-click to add text
              </span>
            )}
          </span>
          
          {/* Control buttons when selected */}
          {isSelected && (
            <div
              style={{
                position: 'absolute',
                top: '-30px',
                right: '0',
                display: 'flex',
                gap: '4px',
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                padding: '2px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '2px',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                title="Edit text"
              >
                ✏️
              </button>
              {/* Delete button - instant delete without confirmation */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '2px',
                  transition: 'background 0.15s',
                  color: '#ef4444'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                title="Delete text (or press Delete key)"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 