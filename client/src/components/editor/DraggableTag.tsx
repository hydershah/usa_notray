import React, { useState, useRef } from 'react';
import type { DocumentTag } from '../../types/editor';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { getTagDimensions } from '../../lib/constants/tagConstants';

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

        // Block notaries from interacting with signer-assigned signature tags
        const isSignatureAssignedToSomeoneElse = tag.tagType === 'S' && currentUser?.role === 'notary' && tag.assignedUserId !== currentUser.userId;
        
        if (isCurrentUserTag && !tag.isCompleted && !isSignatureAssignedToSomeoneElse) {
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

  // For visual feedback, also treat signer-assigned signature tags as non-interactive for notaries
  const isSignatureAssignedToSomeoneElse = tag.tagType === 'S' && currentUser?.role === 'notary' && tag.assignedUserId !== currentUser.userId;

  // Get tag styling based on mode
  const getTagStyle = () => {
    let backgroundColor = 'rgba(255, 255, 255, 0.95)';
    let borderColor = tag.colorCode || '#3B82F6';
    let borderStyle = 'solid';
    let cursor = 'move';
    
    if (isInSigningMode) {
      if (isCompleted) {
        backgroundColor = 'transparent'; // Make completed tags transparent
        borderColor = 'transparent';
        cursor = 'default';
      } else if (isCurrentUserTag && !isSignatureAssignedToSomeoneElse) {
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

  // Get dimensions - use tag constants for consistent sizing across all tag types
          const store = useEditorStore.getState();
        const tagDimensions = store.getTagDimensions(tag.tagType) || { width: 60, height: 18 };
  const displayWidth = tagDimensions.width;
  const displayHeight = tagDimensions.height;

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
        width: `${displayWidth * scaleFactor}px`,
        height: `${displayHeight * scaleFactor}px`,
        // ✅ TRANSPARENT BACKGROUND FOR TAGS WITH CONTENT
        backgroundColor: hasContent 
          ? 'transparent' 
          : tag.tagType === 'W' ? '#ffffff' : (() => {
              const hex = tag.colorCode || '#1e40af';
              const r = parseInt(hex.slice(1, 3), 16);
              const g = parseInt(hex.slice(3, 5), 16);
              const b = parseInt(hex.slice(5, 7), 16);
              return `rgba(${r}, ${g}, ${b}, 0.6)`; // 60% transparency
            })(),
        // Force transparency with additional properties
        ...(hasContent && {
          background: 'transparent',
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          // Don't override border for whiteout tags - they need to stay visible
          ...(tag.tagType !== 'W' && { border: 'none' }),
          boxShadow: 'none',
        }),
        // Simple border styling - plain grey instead of blue
        border: isSelected || isDragging
          ? '2px solid #d1d5db' // Plain grey border for selected/dragging tags
          : tag.tagType === 'W'
          ? '1px solid #d1d5db' // Always show border for whiteout tags to keep them visible
          : hasContent
          ? 'none' // No border for non-whiteout tags with content
          : 'none',
        borderRadius: '6px', // Clean rounded corners
        color: hasContent 
          ? '#000000' // Black text for tags with content
          : tag.tagType === 'W' ? '#374151' : '#1f2937', // Dark text for better readability on transparent background
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
        minWidth: '80px', // Use fallback minimum width
        minHeight: '25px' // Use fallback minimum height
      }}
    >
      {/* Compact tag content layout */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: tag.tagType === 'T' ? '4px' : '8px 12px',
        fontSize: Math.max(12, Math.min(16, (tag.coordinates.height * scaleFactor) * 0.4)),
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: '1.2'
      }}>
        {/* Special handling for whiteout tags when completed - show nothing */}
        {tag.tagType === 'W' && isCompleted ? null : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: tag.tagType === 'W' ? '#374151' : '#1f2937',
            textShadow: tag.tagType === 'W' ? 'none' : '0 1px 2px rgba(255, 255, 255, 0.8)',
            whiteSpace: (tag.tagType === 'O' || tag.tagType === 'X') ? 'normal' : 'nowrap',
            overflow: (tag.tagType === 'O' || tag.tagType === 'X') ? 'visible' : 'hidden',
            textOverflow: (tag.tagType === 'O' || tag.tagType === 'X') ? 'unset' : 'ellipsis',
            width: '100%',
            justifyContent: 'center'
          }}>
            {/* Tag type/label */}
            <span style={{ fontSize: 'inherit' }}>
              {tag.displayLabel?.split(' - ')[0] || tag.tagType}
            </span>
            
            {/* User indicator - REMOVED as requested - no more colored dots */}
          </div>
        )}
      </div>
    </div>
  );
};

export default DraggableTag; 