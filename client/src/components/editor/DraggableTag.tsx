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
  
  // Check if tag has content (should be transparent)
  const hasContent = !!(tag.content || tag.contentData || tag.isCompleted);

  console.log('🎨 DraggableTag render debug:', {
    tagId: tag.id.substring(0, 8),
    tagType: tag.tagType,
    isCompleted: tag.isCompleted,
    hasContent: !!tag.content,
    hasContentData: !!tag.contentData,
    shouldBeTransparent: hasContent,
    backgroundColorWillBe: hasContent ? 'transparent' : (tag.tagType === 'W' ? '#ffffff' : (tag.colorCode || '#1e40af'))
  });
  
  return (
    <div
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={hasContent ? 'completed-tag-transparent' : ''}
      style={{
        position: 'absolute',
        left: `${tag.coordinates.x * scaleFactor}px`,
        top: `${tag.coordinates.y * scaleFactor}px`,
        width: `${tag.coordinates.width * scaleFactor}px`,
        height: `${tag.coordinates.height * scaleFactor}px`,
        // ✅ TRANSPARENT BACKGROUND FOR TAGS WITH CONTENT
        backgroundColor: hasContent 
          ? 'transparent' 
          : tag.tagType === 'W' ? '#ffffff' : (tag.colorCode || '#1e40af'),
        // Force transparency with additional properties
        ...(hasContent && {
          background: 'transparent',
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          border: 'none',
          boxShadow: 'none',
        }),
        // Simple border styling
        border: isSelected || isDragging
          ? '2px solid #3b82f6' // Blue border for selected/dragging tags
          : hasContent
          ? 'none' // No border for tags with content
          : tag.tagType === 'W' 
          ? '1px solid #d1d5db' // Light gray border for whiteout tags
          : 'none',
        borderRadius: '6px', // Clean rounded corners
        color: hasContent 
          ? '#000000' // Black text for tags with content
          : tag.tagType === 'W' ? '#374151' : '#ffffff', // Dark text for whiteout, white for others
        cursor: tagStyle.cursor,
        userSelect: 'none',
        zIndex: isDragging ? 1000 : isSelected ? 500 : 100,
        transition: isDragging ? 'none' : 'all 0.2s ease',
        boxSizing: 'border-box',
        // Clean shadow for depth
        boxShadow: hasContent
          ? 'none' // No shadow for tags with content
          : isDragging || isSelected
          ? '0 4px 12px rgba(0, 0, 0, 0.2)'
          : '0 2px 6px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        minWidth: tag.tagType === 'T' ? 'auto' : '60px'
      }}
    >
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        // Adjust padding based on tag type
        padding: tag.tagType === 'T' ? '2px 4px' : '6px 8px',
        fontSize: tag.tagType === 'T' ? '12px' : '14px',
        fontWeight: '500',
        textAlign: 'center',
        gap: tag.tagType === 'T' ? '1px' : '4px',
      }}>
        {/* Special handling for whiteout tags when completed - show nothing */}
        {tag.tagType === 'W' && isCompleted ? (
          // Completed whiteout: just white space, no content
          null
        ) : 
        /* Special rendering for signing mode when tag is current user's and not completed */
        isInSigningMode && isCurrentUserTag && !isCompleted ? (
          // Interactive tag in signing mode
          <div style={{ 
            textAlign: 'center', 
            color: tag.tagType === 'W' ? '#374151' : '#ffffff', 
            fontWeight: '600' 
          }}>
            <div style={{ fontSize: '16px', marginBottom: '4px' }}>
              {tag.tagType}
            </div>
            <div style={{ fontSize: '12px' }}>
              Click to {tag.tagType === 'W' ? 'apply whiteout' : (['S', 'I'].includes(tag.tagType) ? 'apply' : 'enter')}
            </div>
          </div>
        ) : (
          // Normal tag display (for positioning/dragging)
          <>
            {/* Main tag content */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '3px',
              fontSize: tag.tagType === 'T' ? '14px' : '16px',
              fontWeight: '600',
              color: tag.tagType === 'W' ? '#374151' : '#ffffff',
              textShadow: tag.tagType === 'W' ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.3)'
            }}>
              <span>
                {tag.displayLabel?.split(' - ')[0] || tag.tagType}
              </span>
            </div>
            
            {/* User identification - only show for non-completed tags */}
            {!isCompleted && tag.displayLabel && tag.displayLabel.includes(' - ') && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '4px',
                fontSize: '10px',
                fontWeight: '500',
                padding: '2px 6px',
                backgroundColor: tag.tagType === 'W' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                border: tag.tagType === 'W' ? '1px solid rgba(0, 0, 0, 0.2)' : '1px solid rgba(255, 255, 255, 0.2)',
                marginTop: '2px'
              }}>
                <div style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: tag.tagType === 'W' ? '#374151' : '#ffffff',
                  border: tag.tagType === 'W' ? '1px solid rgba(0, 0, 0, 0.3)' : '1px solid rgba(255, 255, 255, 0.5)'
                }} />
                <span style={{ 
                  color: tag.tagType === 'W' ? '#374151' : '#ffffff', 
                  textShadow: tag.tagType === 'W' ? 'none' : '0 1px 1px rgba(0, 0, 0, 0.5)' 
                }}>
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