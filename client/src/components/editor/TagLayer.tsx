import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { Rnd } from 'react-rnd';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { DocumentTag, TagCoordinates } from '../../types/editor';
import { useToast } from '../../hooks/use-toast';
import DraggableTag from './DraggableTag';
import { useDebouncedTagOperations } from '../../hooks/editor/useDebounced';
import { 
  getTagDimensions, 
  getTagStyle, 
  snapToGrid,
  PROFESSIONAL_COLORS,
  TYPOGRAPHY,
  TAG_TYPE_CONFIG 
} from '@/lib/constants/tagConstants';

interface TagRendererProps {
  tag: DocumentTag;
  isSelected: boolean;
  canEdit: boolean;
  scaleFactor: number;
  onSelect: () => void;
  onUpdate: (updates: { x: number; y: number }) => void;
  onDelete: () => void;
  onTagClick?: (tag: DocumentTag) => void;
}

interface TagLayerProps {
  documentId: string;
  pageNumber: number;
  canvasElement: HTMLCanvasElement;
  containerRef: React.RefObject<HTMLDivElement>;
  scaleFactor: number;
  mode: { mode: 'tagging' | 'notary' | 'signing'; canPlaceTags: boolean; showPlaceholders: boolean };
  onCoordinateClick?: (x: number, y: number, pageNumber: number) => void;
  liveSessionState?: {
    activeUserId?: number;
    state?: string;
  };
}

const TagRenderer: React.FC<TagRendererProps> = ({
  tag,
  isSelected,
  canEdit,
  scaleFactor,
  onSelect,
  onUpdate,
  onDelete,
  onTagClick
}) => {
  const { mode, selectedUser, currentUser, session } = useEditorStore();
  
  // Use debounced operations hook
  const { debouncedPositionUpdate } = useDebouncedTagOperations(session?.id || '');
  
  // Check if current user can modify this tag
  const canModifyTag = canEdit && (
    currentUser?.userId === tag.assignedUserId ||
    currentUser?.role === 'notary' ||
    currentUser?.role === 'admin'
  );
  
  // Check if tag has content (should be transparent)
  const hasContent = !!(tag.content || tag.contentData || tag.isCompleted);
  
  // Professional fixed dimensions - DocuSign style
  const fixedDimensions = getTagDimensions(tag.tagType);
  const displayCoords = {
    x: Math.round(tag.coordinates.x * scaleFactor),
    // For lower-left positioning, we need to subtract the height from the Y coordinate
    y: Math.round((tag.coordinates.y - (tag.tagType === 'T' ? 30 : fixedDimensions.height)) * scaleFactor),
    // For text tags, use fixed dimensions without scaling to maintain consistent 200x30 size
    width: tag.tagType === 'T' ? 200 : Math.round(fixedDimensions.width * scaleFactor),
    height: tag.tagType === 'T' ? 30 : Math.round(fixedDimensions.height * scaleFactor)
  };
  
  // Debug: Log the rendering coordinates
  console.log('🎨 TAG RENDERING DEBUG:', {
    tagType: tag.tagType,
    originalCoordinates: tag.coordinates,
    scaleFactor,
    displayCoords,
    fixedDimensions
  });
  
  // Add visual indicator for debugging tag position
  React.useEffect(() => {
    if (tag.tagType === 'T') {
      const indicator = document.createElement('div');
      indicator.style.position = 'absolute';
      indicator.style.left = `${displayCoords.x}px`;
      indicator.style.top = `${displayCoords.y + displayCoords.height}px`; // Show where bottom-left should be
      indicator.style.width = '8px';
      indicator.style.height = '8px';
      indicator.style.backgroundColor = 'blue';
      indicator.style.borderRadius = '50%';
      indicator.style.zIndex = '9998';
      indicator.style.pointerEvents = 'none';
      indicator.style.border = '2px solid white';
      document.body.appendChild(indicator);
      
      // Remove indicator after 2 seconds
      setTimeout(() => {
        if (document.body.contains(indicator)) {
          document.body.removeChild(indicator);
        }
      }, 2000);
    }
  }, [displayCoords.x, displayCoords.y, displayCoords.height, tag.tagType]);


  // Handle drag stop with snap-to-grid - DocuSign style
  const handleDragStop = useCallback((e: any, data: any) => {
    if (!canModifyTag || !session) return;
    
    // Snap to grid for professional alignment
    const snappedX = snapToGrid(data.x / scaleFactor);
    const snappedY = snapToGrid(data.y / scaleFactor);
    
    const newPdfCoordinates = {
      x: snappedX,
      y: snappedY
    };
    
    console.log('🔄 Tag drag update (debounced):', {
      canvas: { x: data.x, y: data.y },
      pdf: newPdfCoordinates,
      scaleFactor
    });
    
    try {
      // Update local state immediately (optimistic update)
      onUpdate(newPdfCoordinates);
      
      // Use debounced position update for server sync
      debouncedPositionUpdate(tag.id, newPdfCoordinates);
      
    } catch (error) {
      console.error('❌ Failed to update tag position:', error);
    }
  }, [canModifyTag, scaleFactor, onUpdate, session, tag, debouncedPositionUpdate]);

  // Handle keyboard events for tag deletion
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete();
    }
  }, [onDelete]);

  // Professional styling based on tag state
  const professionalStyle = getTagStyle(tag.tagType, hasContent, isSelected);

  return (
    <Rnd
      size={{
        width: displayCoords.width,
        height: displayCoords.height
      }}
      position={{
        x: displayCoords.x,
        y: displayCoords.y
      }}
      onDragStop={handleDragStop}
      disableDragging={!canModifyTag}
      enableResizing={false} // Professional fixed sizing - no resize
      bounds="parent"
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
          onSelect();
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="professional-tag"
      style={{
        ...professionalStyle,
        zIndex: isSelected ? 1000 : 100
      }}
    >
      {/* Professional tag content */}
      <div 
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {hasContent ? (
          <span style={{ 
            fontFamily: TYPOGRAPHY.fontFamily,
            fontSize: TYPOGRAPHY.fontSize.content,
            fontWeight: TYPOGRAPHY.fontWeight.medium,
            color: PROFESSIONAL_COLORS.text
          }}>
            {tag.content || TAG_TYPE_CONFIG[tag.tagType]?.label || 'Content'}
          </span>
        ) : (
          <span style={{ 
            fontFamily: TYPOGRAPHY.fontFamily,
            fontSize: TYPOGRAPHY.fontSize.label,
            fontWeight: TYPOGRAPHY.fontWeight.normal,
            color: PROFESSIONAL_COLORS.textPlaceholder,
            fontStyle: 'italic'
          }}>
            {TAG_TYPE_CONFIG[tag.tagType]?.placeholder || TAG_TYPE_CONFIG[tag.tagType]?.label || 'Field'}
          </span>
        )}
      </div>

      {/* Professional selection indicator */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: '-24px',
            left: '0',
            backgroundColor: PROFESSIONAL_COLORS.text,
            color: 'white',
            padding: '2px 8px',
            borderRadius: '2px',
            fontSize: '11px',
            fontWeight: TYPOGRAPHY.fontWeight.medium,
            whiteSpace: 'nowrap',
            zIndex: 1001
          }}
        >
          {TAG_TYPE_CONFIG[tag.tagType]?.label || 'Field'}
        </div>
      )}
    </Rnd>
  );
};

// Main TagLayer component
const TagLayer: React.FC<TagLayerProps> = ({
  documentId,
  pageNumber,
  canvasElement,
  containerRef,
  scaleFactor,
  mode,
  onCoordinateClick,
  liveSessionState
}) => {
  const {
    tags,
    selectedTag,
    currentUser,
    selectTag,
    updateTag,
    deleteTag
  } = useEditorStore();

  // Filter tags for current page
  const pageTags = useMemo(() => {
    return tags.filter(tag => tag.coordinates.pageNumber === pageNumber);
  }, [tags, pageNumber]);

  // Handle tag selection
  const handleTagSelect = useCallback((tag: DocumentTag) => {
    selectTag(tag);
  }, [selectTag]);

  // Handle tag update
  const handleTagUpdate = useCallback((tagId: string, updates: { x: number; y: number }) => {
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return;
    
    const newCoordinates = {
      ...tag.coordinates,
      ...updates
    };
    updateTag(tagId, { coordinates: newCoordinates });
  }, [updateTag, tags]);

  // Handle tag deletion
  const handleTagDelete = useCallback((tagId: string) => {
      deleteTag(tagId);
  }, [deleteTag]);

  // Handle click on empty space
  const handleContainerClick = useCallback((e: any) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / scaleFactor;
    const y = (e.clientY - rect.top) / scaleFactor;

    if (onCoordinateClick) {
      onCoordinateClick(x, y, pageNumber);
    }
  }, [containerRef, scaleFactor, onCoordinateClick, pageNumber]);

  return (
    <div
      className="absolute inset-0 pointer-events-auto"
      onClick={handleContainerClick}
      style={{ zIndex: 50 }}
    >
      {pageTags.map((tag) => (
        <TagRenderer
          key={tag.id}
          tag={tag}
          isSelected={tag.id === selectedTag?.id}
          canEdit={mode.canPlaceTags}
          scaleFactor={scaleFactor}
          onSelect={() => handleTagSelect(tag)}
          onUpdate={(updates) => handleTagUpdate(tag.id, updates)}
          onDelete={() => handleTagDelete(tag.id)}
        />
      ))}
    </div>
  );
};

export default TagLayer; 