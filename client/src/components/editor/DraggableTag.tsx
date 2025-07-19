import React, { useState, useRef } from 'react';
import type { DocumentTag } from '../../types/editor';
import { useEditorStore } from '../../hooks/editor/useEditorStore';

interface DraggableTagProps {
  tag: DocumentTag;
  scaleFactor: number;
  containerRef: React.RefObject<HTMLDivElement>;
  onUpdate: (tagId: string, coordinates: any) => void;
}

const DraggableTag: React.FC<DraggableTagProps> = ({ tag, scaleFactor, containerRef, onUpdate }) => {
  const { setDraggedTag, selectTag, selectedTag, mode, currentUser } = useEditorStore();
  const [isDragging, setIsDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragStartRef.current = true;
    setIsDragging(false);
    
    const tagRect = e.currentTarget.getBoundingClientRect();
    offsetRef.current = {
      x: e.clientX - tagRect.left,
      y: e.clientY - tagRect.top,
    };
    
    // Start drag after small movement to distinguish from click
    const startDrag = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;
      
      const moveDistance = Math.sqrt(
        Math.pow(moveEvent.clientX - e.clientX, 2) + 
        Math.pow(moveEvent.clientY - e.clientY, 2)
      );
      
      if (moveDistance > 5) {
        setIsDragging(true);
        setDraggedTag(tag);
        window.removeEventListener('mousemove', startDrag);
      }
    };
    
    window.addEventListener('mousemove', startDrag);
    window.addEventListener('mouseup', () => {
      window.removeEventListener('mousemove', startDrag);
    });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Only handle click if we didn't start dragging
    if (!isDragging && dragStartRef.current) {
      console.log('🏷️ Tag clicked:', tag.id, 'Mode:', mode?.mode);
      
      if (mode?.mode === 'signing') {
        // In signing mode, handle interactive tag behavior
        const isCurrentUserTag = currentUser && (
          tag.assignedUserId === currentUser.userId || 
          currentUser.role === 'notary' || 
          ['T', 'D'].includes(tag.tagType) // Universal tags
        );
        
        if (isCurrentUserTag && !tag.isCompleted) {
          console.log('🎯 Interactive tag clicked, triggering input');
          // TODO: Trigger interactive input modal
          // For now, just select the tag
          selectTag(tag);
        }
      } else {
        // In other modes, just select the tag
        selectTag(tag);
      }
    }
  };

  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();

    const containerRect = containerRef.current.getBoundingClientRect();

    const newX = (e.clientX - containerRect.left - offsetRef.current.x) / scaleFactor;
    const newY = (e.clientY - containerRect.top - offsetRef.current.y) / scaleFactor;

    onUpdate(tag.id, {
      ...tag.coordinates,
      x: Math.round(newX),
      y: Math.round(newY),
    });
  };

  const handleDragEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      setDraggedTag(null);
    }
    dragStartRef.current = false;
  };
  
  // Attach and detach listeners to the window
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
    } else {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Determine tag appearance based on mode and state
  const isSelected = selectedTag?.id === tag.id;
  const isInSigningMode = mode?.mode === 'signing';
  const isCompleted = tag.isCompleted;
  const isCurrentUserTag = currentUser && (
    tag.assignedUserId === currentUser.userId || 
    currentUser.role === 'notary' || 
    ['T', 'D'].includes(tag.tagType)
  );

  // Get tag styling based on mode
  const getTagStyle = () => {
    let backgroundColor = 'rgba(255, 255, 255, 0.95)';
    let borderColor = tag.colorCode || '#3B82F6';
    let borderStyle = 'solid';
    let cursor = 'move';
    
    if (isInSigningMode) {
      if (isCompleted) {
        backgroundColor = 'rgba(34, 197, 94, 0.1)';
        borderColor = '#22c55e';
        cursor = 'default';
      } else if (isCurrentUserTag) {
        backgroundColor = 'rgba(59, 130, 246, 0.1)';
        borderColor = '#3b82f6';
        borderStyle = 'dashed';
        cursor = 'pointer';
      } else {
        backgroundColor = 'rgba(156, 163, 175, 0.1)';
        borderColor = '#9ca3af';
        cursor = 'not-allowed';
      }
    }
    
    return {
      backgroundColor,
      borderColor,
      borderStyle,
      cursor
    };
  };

  const tagStyle = getTagStyle();
  
  return (
    <div
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      style={{
        position: 'absolute',
        left: `${tag.coordinates.x * scaleFactor}px`,
        top: `${tag.coordinates.y * scaleFactor}px`,
        width: `${tag.coordinates.width * scaleFactor}px`,
        height: `${tag.coordinates.height * scaleFactor}px`,
        backgroundColor: tagStyle.backgroundColor,
        border: `2px ${tagStyle.borderStyle} ${isDragging ? '#3B82F6' : tagStyle.borderColor}`,
        borderRadius: '6px',
        color: tagStyle.borderColor,
        cursor: tagStyle.cursor,
        userSelect: 'none',
        zIndex: isDragging ? 1000 : isSelected ? 500 : 100,
        transition: isDragging ? 'none' : 'all 0.2s ease',
        boxSizing: 'border-box',
        boxShadow: isDragging 
          ? `0 4px 12px rgba(0,0,0,0.15), 0 0 0 2px ${(tag.colorCode || '#3B82F6')}20` 
          : isSelected
          ? `0 4px 12px rgba(0,0,0,0.15), 0 0 0 2px ${tagStyle.borderColor}40`
          : isInSigningMode && !isCompleted && isCurrentUserTag
          ? '0 2px 8px rgba(59, 130, 246, 0.3)'
          : '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto'
      }}
    >
      <div style={{ 
        padding: '2px 6px', 
        fontSize: '10px', 
        fontWeight: '500',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        height: '100%',
        justifyContent: 'center'
      }}>
        {/* Show different content based on mode */}
        {isInSigningMode && isCompleted ? (
          // Completed tag in signing mode
          <div style={{ textAlign: 'center', color: '#15803d' }}>
            <div style={{ fontSize: '12px' }}>DONE</div>
            <div style={{ fontSize: '8px' }}>Completed</div>
          </div>
        ) : isInSigningMode && isCurrentUserTag && !isCompleted ? (
          // Interactive tag in signing mode
          <div style={{ textAlign: 'center', color: '#1e40af' }}>
            <div style={{ fontSize: '10px', marginBottom: '2px' }}>
              {tag.tagType}
            </div>
            <div style={{ fontSize: '8px' }}>Click to {['S', 'I'].includes(tag.tagType) ? 'apply' : 'enter'}</div>
          </div>
        ) : (
          // Normal tag display
          <>
            {/* Main tag content */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ opacity: 0.8 }}>
                {tag.displayLabel?.split(' - ')[0] || tag.tagType}
              </span>
            </div>
            
            {/* User identification */}
            {tag.displayLabel && tag.displayLabel.includes(' - ') && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '3px',
                fontSize: '9px',
                fontWeight: '400',
                padding: '2px 4px',
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                borderRadius: '8px'
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: tag.colorCode || '#3B82F6',
                  border: '1px solid white',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }} />
                <span>
                  {tag.displayLabel.split(' - ')[1]?.split(' ')[0] || 'User'}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DraggableTag; 