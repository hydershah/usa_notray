import React, { useMemo, useCallback, memo } from 'react';
import { Rnd } from 'react-rnd';
import { useOptimizedDragResize } from '@/hooks/editor/useOptimizedDragResize';
import type { DocumentTag, TagCoordinates } from '@/types/editor';
import { TAG_TYPE_CONFIG, PROFESSIONAL_COLORS, TYPOGRAPHY, LAYOUT } from '@/lib/constants/tagConstants';

interface OptimizedTagRendererProps {
  tag: DocumentTag;
  scaleFactor: number;
  isSelected: boolean;
  canEdit: boolean;
  onLiveUpdate: (tagId: string, coordinates: Partial<TagCoordinates>) => void;
  onFinalUpdate: (tagId: string, coordinates: Partial<TagCoordinates>) => void;
  onSelect: () => void;
  onTagClick?: (tag: DocumentTag, position: { x: number; y: number; width: number; height: number }) => void;
  onDelete?: () => void;
  mode?: string;
  isHighlighted?: boolean;
  isMissing?: boolean;
  localFontSize?: number;
}

const OptimizedTagRenderer: React.FC<OptimizedTagRendererProps> = ({
  tag,
  scaleFactor,
  isSelected,
  canEdit,
  onLiveUpdate,
  onFinalUpdate,
  onSelect,
  onTagClick,
  onDelete,
  mode,
  isHighlighted = false,
  isMissing = false,
  localFontSize
}) => {
  
  // Initialize optimized drag/resize system
  const {
    isDragging,
    isResizing,
    createDragHandlers,
    createResizeHandlers
  } = useOptimizedDragResize({
    onLiveUpdate,
    onFinalUpdate,
    snapToGrid: true,
    gridSize: 5
  });

  // Get drag and resize handlers for this specific tag
  const dragHandlers = useMemo(() => createDragHandlers(tag.id), [createDragHandlers, tag.id]);
  const resizeHandlers = useMemo(() => createResizeHandlers(tag.id, scaleFactor), [createResizeHandlers, tag.id, scaleFactor]);

  // Memoized display coordinates for performance
  const displayCoords = useMemo(() => ({
    x: Math.round(tag.coordinates.x * scaleFactor),
    y: Math.round(tag.coordinates.y * scaleFactor),
    width: Math.round((tag.coordinates.width || 120) * scaleFactor),
    height: Math.round((tag.coordinates.height || 30) * scaleFactor)
  }), [tag.coordinates, scaleFactor]);

  // Memoized content check
  const hasContent = useMemo(() => 
    !!(tag.content || tag.contentData || tag.isCompleted), 
    [tag.content, tag.contentData, tag.isCompleted]
  );

  // Memoized font size calculation
  const currentFontSize = useMemo(() => {
    if (localFontSize) return localFontSize;
    
    if (tag.contentData) {
      try {
        const parsed = typeof tag.contentData === 'string' 
          ? JSON.parse(tag.contentData) 
          : tag.contentData;
        if (parsed?.fontSize) return parsed.fontSize;
      } catch (e) {
        console.warn('Could not parse contentData for font size:', e);
      }
    }
    
    return 12; // Default font size
  }, [localFontSize, tag.contentData]);

  // Memoized style object for performance
  const tagStyle = useMemo(() => {
    const config = TAG_TYPE_CONFIG[tag.tagType];
    const userColor = tag.colorCode || config?.color || '#4ECDC4';
    
    // Helper function for color with opacity
    const hexToRgba = (hex: string, opacity: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    let backgroundColor = hasContent 
      ? 'transparent' 
      : hexToRgba(userColor, 0.6);
    
    let borderColor = hasContent 
      ? 'transparent'
      : isSelected
        ? PROFESSIONAL_COLORS.borderActive
        : hexToRgba(userColor, 0.9);
    
    let boxShadow = 'none';
    
    if (isSelected) {
      boxShadow = `0 0 0 2px ${PROFESSIONAL_COLORS.borderActive}, ${LAYOUT.shadow.base}`;
    } else if (isHighlighted) {
      boxShadow = '0 0 0 3px #3b82f6, 0 0 12px rgba(59, 130, 246, 0.5)';
    } else if (isMissing && !hasContent) {
      backgroundColor = '#fef3c7';
      borderColor = '#f59e0b';
      boxShadow = '0 0 0 2px #f59e0b, 0 0 8px rgba(245, 158, 11, 0.3)';
    }

    return {
      backgroundColor,
      border: hasContent ? 'none' : `1.5px solid ${borderColor}`,
      borderRadius: LAYOUT.borderRadius.base,
      color: hasContent ? PROFESSIONAL_COLORS.text : PROFESSIONAL_COLORS.textPlaceholder,
      zIndex: isSelected ? 1000 : (isHighlighted || isMissing) ? 500 : 100,
      pointerEvents: 'auto' as const,
      cursor: canEdit ? 'grab' as const : 'default' as const,
      fontFamily: TYPOGRAPHY.fontFamily,
      fontSize: TYPOGRAPHY.fontSize.tag,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      transition: isDragging || isResizing ? 'none' : 'all 0.2s ease',
      boxShadow,
      position: 'relative' as const,
      overflow: 'visible' as const,
      animation: isMissing && !hasContent ? 'pulse 2s infinite' : 'none'
    };
  }, [hasContent, isSelected, canEdit, tag.tagType, isMissing, isHighlighted, isDragging, isResizing, tag.colorCode]);

  // Optimized click handler
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    
    // Prevent interference with text inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.closest('input') || target.closest('.streamlined-text-input')) {
      return;
    }

    if (mode === 'signing' && onTagClick && !tag.isCompleted) {
      // Double-click detection for interactive input
      if (e.detail === 2) {
        const rect = e.currentTarget.getBoundingClientRect();
        onTagClick(tag, {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        });
      } else if (e.detail === 1) {
        // Single-click: select tag
        setTimeout(() => {
          const currentTarget = e.currentTarget as any;
          const clickTime = e.timeStamp;
          const lastClickTime = currentTarget._lastClickTime || 0;
          
          if (Math.abs(clickTime - lastClickTime) < 50) {
            onSelect();
          }
        }, 250);
      }
    } else {
      onSelect();
    }
  }, [mode, onTagClick, tag, onSelect]);

  // Keyboard handler for delete
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && onDelete) {
      e.preventDefault();
      onDelete();
    }
  }, [onDelete]);

  return (
    <Rnd
      size={displayCoords}
      position={displayCoords}
      {...dragHandlers}
      {...resizeHandlers}
      enableResizing={canEdit ? {
        top: true,
        right: true,
        bottom: true,
        left: true,
        topRight: true,
        bottomRight: true,
        bottomLeft: true,
        topLeft: false
      } : false}
      disableDragging={!canEdit}
      bounds="parent"
      cancel=".no-drag"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={`
        professional-tag
        ${isSelected ? 'selected' : ''}
        ${isDragging ? 'dragging' : ''}
        ${isResizing ? 'resizing' : ''}
        ${hasContent ? 'has-content' : 'empty'}
      `}
      style={tagStyle}
    >
      <div 
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          overflow: 'visible',
          paddingLeft: '4px',
          position: 'relative',
          wordWrap: 'break-word',
          overflowWrap: 'break-word'
        }}
      >
        {/* Tag content */}
        {hasContent ? (
          <span 
            data-text-content
            style={{ 
              fontFamily: TYPOGRAPHY.fontFamily,
              fontSize: `${currentFontSize}px`,
              fontWeight: TYPOGRAPHY.fontWeight.medium,
              color: '#1e293b',
              lineHeight: '1.2',
              display: 'block',
              width: '100%',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'normal',
              overflow: 'visible'
            }}
          >
            {tag.content || tag.displayLabel || TAG_TYPE_CONFIG[tag.tagType]?.label || 'Content'}
          </span>
        ) : (
          <span style={{ 
            fontFamily: TYPOGRAPHY.fontFamily,
            fontSize: `${Math.max(10, currentFontSize - 2)}px`,
            fontWeight: TYPOGRAPHY.fontWeight.normal,
            color: '#1f2937',
            fontStyle: 'normal',
            lineHeight: '1.2',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'normal',
            overflow: 'visible',
            textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
          }}>
            {tag.displayLabel || TAG_TYPE_CONFIG[tag.tagType]?.placeholder || TAG_TYPE_CONFIG[tag.tagType]?.label || 'Field'}
          </span>
        )}
        
        {/* Completion indicator */}
        {hasContent && (
          <div 
            style={{
              position: 'absolute',
              top: '2px',
              right: '4px',
              width: '8px',
              height: '8px',
              backgroundColor: PROFESSIONAL_COLORS.success,
              borderRadius: '50%',
              border: '1px solid #ffffff'
            }}
          />
        )}
        
        {/* Special indicators for specific tag types */}
        {tag.tagType === 'O' && (
          <div 
            style={{
              position: 'absolute',
              top: '2px',
              left: '4px',
              width: '12px',
              height: '12px',
              backgroundColor: '#d97706',
              borderRadius: '50%',
              border: '1px solid #ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Disclosure Tag"
          >
            <span style={{ fontSize: '8px', color: '#ffffff', fontWeight: 'bold' }}>D</span>
          </div>
        )}
        
        {/* User identification indicator */}
        {tag.displayLabel && tag.displayLabel.includes(' - ') && !hasContent && (
          <div 
            style={{
              position: 'absolute',
              top: '2px',
              right: '4px',
              width: '8px',
              height: '8px',
              backgroundColor: tag.colorCode || '#4ECDC4',
              borderRadius: '50%',
              border: '1px solid #ffffff',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
            }}
            title={tag.displayLabel.split(' - ')[1] || 'User'}
          />
        )}
      </div>
    </Rnd>
  );
};

// Memoize the component for performance during drag operations
export default memo(OptimizedTagRenderer, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.tag.id === nextProps.tag.id &&
    prevProps.tag.coordinates === nextProps.tag.coordinates &&
    prevProps.tag.content === nextProps.tag.content &&
    prevProps.tag.contentData === nextProps.tag.contentData &&
    prevProps.tag.isCompleted === nextProps.tag.isCompleted &&
    prevProps.scaleFactor === nextProps.scaleFactor &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.canEdit === nextProps.canEdit &&
    prevProps.isHighlighted === nextProps.isHighlighted &&
    prevProps.isMissing === nextProps.isMissing &&
    prevProps.localFontSize === nextProps.localFontSize &&
    prevProps.mode === nextProps.mode
  );
});