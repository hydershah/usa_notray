import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { Rnd } from 'react-rnd';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import type { DocumentTag, TagCoordinates } from '../../types/editor';
import DraggableTag from './DraggableTag';

const TAG_TYPE_INFO = {
  'A': { label: 'Name', icon: '✍️' },
  'S': { label: 'Signature', icon: '📝' },
  'I': { label: 'Initials', icon: '🔤' },
  'N': { label: 'Commission #', icon: '🆔' },
  'X': { label: 'Expiration', icon: '📅' },
  'O': { label: 'Disclosure', icon: '📋' },
  'E': { label: 'Seal', icon: '🔖' },
  'W': { label: 'Whiteout', icon: '⬜' },
  'T': { label: 'Text', icon: '📝' },
  'D': { label: 'Date', icon: '📆' },
} as const;

const USER_COLORS = {
  notary: '#1F2937',
  admin: '#DC2626', 
  signer1: '#2563EB',
  signer2: '#059669',
  signer3: '#7C2D12',
  witness1: '#9333EA',
  witness2: '#C2410C'
} as const;

interface TagRendererProps {
  tag: DocumentTag;
  isSelected: boolean;
  canEdit: boolean;
  scaleFactor: number; // Use actual scale factor from PDF rendering
  onSelect: () => void;
  onUpdate: (updates: Partial<TagCoordinates>) => void;
  onDelete: () => void;
}

interface TagLayerProps {
  documentId: string;
  pageNumber: number;
  canvasElement: HTMLCanvasElement;
  containerRef: React.RefObject<HTMLDivElement>;
  scaleFactor: number; // Actual scale factor from PDF rendering
}

const TagRenderer: React.FC<TagRendererProps> = ({
  tag,
  isSelected,
  canEdit,
  scaleFactor, // Now using the actual scale factor
  onSelect,
  onUpdate,
  onDelete
}) => {
  const { mode, selectedUser, currentUser, session } = useEditorStore();
  
  // Check if current user can modify this tag
  const canModifyTag = canEdit && (
    currentUser?.userId === tag.assignedUserId ||
    currentUser?.role === 'notary' ||
    currentUser?.role === 'admin'
  );

  // Convert PDF coordinates to display coordinates using actual scale factor
  const displayCoords = {
    x: Math.round(tag.coordinates.x * scaleFactor),
    y: Math.round(tag.coordinates.y * scaleFactor),
    width: Math.max(Math.round(tag.coordinates.width * scaleFactor), 60), // Minimum display width
    height: Math.max(Math.round(tag.coordinates.height * scaleFactor), 30) // Minimum display height
  };

  console.log('🏷️ Tag rendering:', {
    tagId: tag.id.substring(0, 8),
    tagType: tag.tagType,
    pdfCoords: tag.coordinates,
    displayCoords,
    scaleFactor
  });

  // Handle drag stop - convert back to PDF coordinates and save to server
  const handleDragStop = useCallback(async (e: any, data: any) => {
    if (!canModifyTag || !session) return;
    
    const newPdfCoordinates = {
      x: Math.round(data.x / scaleFactor),
      y: Math.round(data.y / scaleFactor)
    };
    
    console.log('🔄 Tag drag update:', {
      canvas: { x: data.x, y: data.y },
      pdf: newPdfCoordinates,
      scaleFactor
    });
    
    try {
      // Update local state immediately (optimistic update)
      onUpdate(newPdfCoordinates);
      
      // Send to server
      const response = await fetch(`/api/editor/session/${session.id}/tag/${tag.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          coordinates: {
            ...tag.coordinates,
            ...newPdfCoordinates
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update tag position: ${response.statusText}`);
      }
      
      console.log('✅ Tag position updated on server');
      
    } catch (error) {
      console.error('❌ Failed to update tag position:', error);
      // TODO: Show error toast and revert position
    }
  }, [canModifyTag, scaleFactor, onUpdate, session, tag]);

  // Handle resize stop - convert back to PDF coordinates and save to server
  const handleResizeStop = useCallback(async (e: any, direction: any, ref: any, delta: any, position: any) => {
    if (!canModifyTag || !session) return;
    
    const newPdfCoordinates = {
      x: Math.round(position.x / scaleFactor),
      y: Math.round(position.y / scaleFactor),
      width: Math.round(ref.offsetWidth / scaleFactor),
      height: Math.round(ref.offsetHeight / scaleFactor)
    };
    
    console.log('🔄 Tag resize update:', {
      canvas: { x: position.x, y: position.y, width: ref.offsetWidth, height: ref.offsetHeight },
      pdf: newPdfCoordinates,
      scaleFactor
    });
    
    try {
      // Update local state immediately (optimistic update)  
      onUpdate(newPdfCoordinates);
      
      // Send to server
      const response = await fetch(`/api/editor/session/${session.id}/tag/${tag.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          coordinates: newPdfCoordinates
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update tag size: ${response.statusText}`);
      }
      
      console.log('✅ Tag size updated on server');
      
    } catch (error) {
      console.error('❌ Failed to update tag size:', error);
      // TODO: Show error toast and revert size
    }
  }, [canModifyTag, scaleFactor, onUpdate, session, tag]);

  // Handle keyboard events for tag deletion
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete();
    }
  }, [onDelete]);

  // Get user info for styling
  const userInfo = selectedUser || currentUser;
  const userColor = userInfo ? USER_COLORS[userInfo.role as keyof typeof USER_COLORS] || USER_COLORS.signer1 : USER_COLORS.signer1;

  // Render tag content based on mode and completion status
  const renderTagContent = () => {
    if (mode.mode === 'tagging' || !tag.isCompleted) {
      // Show placeholder content
      const tagInfo = TAG_TYPE_INFO[tag.tagType];
      return (
        <div className="flex items-center gap-1 text-white text-xs font-medium text-center">
          <span className="text-sm">{tagInfo.icon}</span>
          <span className="truncate">{tagInfo.label}</span>
        </div>
      );
    } else {
      // Show actual content in live signing mode
      return (
        <div className="w-full h-full flex items-center justify-center text-xs">
          {/* TODO: Render actual content based on tag type */}
          <span className="text-gray-700">Content</span>
        </div>
      );
    }
  };

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
      onResizeStop={handleResizeStop}
      disableDragging={!canModifyTag}
      enableResizing={canModifyTag && isSelected}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={`
        relative transition-all duration-200 rounded-md overflow-hidden
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
        ${canModifyTag ? 'cursor-move' : 'cursor-default'}
        ${mode.showPlaceholders || !tag.isCompleted ? 'opacity-90' : 'opacity-100'}
      `}
      style={{
        backgroundColor: tag.colorCode || userColor,
        border: isSelected ? '2px solid #3B82F6' : '1px solid rgba(0,0,0,0.1)',
        zIndex: isSelected ? 1000 : 100,
        boxShadow: isSelected 
          ? '0 8px 25px rgba(0,0,0,0.3)' 
          : '0 2px 8px rgba(0,0,0,0.2)'
      }}
      resizeHandleStyles={{
        bottomRight: {
          width: '12px',
          height: '12px',
          backgroundColor: '#3B82F6',
          border: '2px solid white',
          borderRadius: '50%',
          right: '-6px',
          bottom: '-6px'
        }
      }}
    >
      {/* Tag Content */}
      <div className="w-full h-full flex items-center justify-center p-1">
        {renderTagContent()}
      </div>

      {/* Selection Indicator */}
      {isSelected && canModifyTag && (
        <div className="absolute -top-8 left-0 bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
          Press Delete to remove • Drag to move • Resize handle: ↘
        </div>
      )}

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute -bottom-16 left-0 text-xs text-gray-500 bg-white p-1 rounded shadow text-left whitespace-nowrap">
          PDF: {tag.coordinates.x},{tag.coordinates.y}<br/>
          Canvas: {displayCoords.x},{displayCoords.y}<br/>
          Scale: {scaleFactor.toFixed(2)}
        </div>
      )}
    </Rnd>
  );
};

export const TagLayer: React.FC<TagLayerProps> = ({
  documentId,
  pageNumber,
  canvasElement,
  containerRef,
  scaleFactor // Use the actual scale factor passed from PDF rendering
}) => {
  const layerRef = useRef<HTMLDivElement>(null);
  
  const {
    tags,
    selectedTag,
    mode,
    viewer,
    updateTag,
    deleteTag,
    selectTag,
    currentUser,
    session
  } = useEditorStore();

  const handleUpdateTag = (tagId: string, coordinates: any) => {
    updateTag(tagId, { coordinates });
  };

  const pageTags = useMemo(() => {
    return tags.filter(tag => tag.documentId === documentId && tag.coordinates.pageNumber === pageNumber);
  }, [tags, documentId, pageNumber]);

  // Update layer position to match canvas
  useEffect(() => {
    if (!layerRef.current || !canvasElement || !containerRef.current) return;

    const updateLayerPosition = () => {
      const canvasRect = canvasElement.getBoundingClientRect();
      const containerRect = containerRef.current!.getBoundingClientRect();

      // Position the layer to exactly match the canvas
      layerRef.current!.style.position = 'absolute';
      layerRef.current!.style.left = `${canvasRect.left - containerRect.left}px`;
      layerRef.current!.style.top = `${canvasRect.top - containerRect.top}px`;
      layerRef.current!.style.width = `${canvasRect.width}px`;
      layerRef.current!.style.height = `${canvasRect.height}px`;
      layerRef.current!.style.pointerEvents = 'auto';
      layerRef.current!.style.zIndex = '50';
      
      // Debug positioning
      console.log('🔧 Tag layer positioned:', {
        canvas: { left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height },
        container: { left: containerRect.left, top: containerRect.top },
        layer: { 
          left: canvasRect.left - containerRect.left, 
          top: canvasRect.top - containerRect.top,
          width: canvasRect.width,
          height: canvasRect.height
        },
        scaleFactor
      });
    };

    updateLayerPosition();

    // Update on scroll/resize with throttling
    let ticking = false;
    const onUpdate = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateLayerPosition();
          ticking = false;
        });
        ticking = true;
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', onUpdate);
      window.addEventListener('resize', onUpdate);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', onUpdate);
        window.removeEventListener('resize', onUpdate);
      }
    };
  }, [canvasElement, containerRef, scaleFactor]);

  // Handle tag selection
  const handleTagSelect = useCallback((tag: DocumentTag) => {
    selectTag(tag);
  }, [selectTag]);

  // Handle tag updates with proper coordinate conversion
  const handleTagUpdate = useCallback((tagId: string, updates: Partial<TagCoordinates>) => {
    updateTag(tagId, { coordinates: updates });
  }, [updateTag]);

  // Handle tag deletion with server call
  const handleTagDelete = useCallback(async (tagId: string) => {
    if (!session) return;
    
    try {
      // Delete from server first
      const response = await fetch(`/api/editor/session/${session.id}/tag/${tagId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete tag: ${response.statusText}`);
      }
      
      // Update local state
      deleteTag(tagId);
      console.log('✅ Tag deleted successfully');
      
    } catch (error) {
      console.error('❌ Failed to delete tag:', error);
      // TODO: Show error toast
    }
  }, [session, deleteTag]);

  // Handle layer clicks for deselection
  const handleLayerClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      selectTag(null);
    }
  }, [selectTag]);

  if (!canvasElement) {
    return null;
  }

  const { top, left } = canvasElement.getBoundingClientRect();
  const containerScrollTop = containerRef.current?.scrollTop || 0;
  const containerScrollLeft = containerRef.current?.scrollLeft || 0;
  
  const layerStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${top + containerScrollTop}px`,
    left: `${left + containerScrollLeft}px`,
    width: `${canvasElement.width}px`,
    height: `${canvasElement.height}px`,
    pointerEvents: 'none',
  };

  return (
    <div style={layerStyle} className="tag-layer">
      {pageTags.map(tag => (
        <DraggableTag
          key={tag.id}
          tag={tag}
          scaleFactor={scaleFactor}
          containerRef={containerRef}
          onUpdate={handleUpdateTag}
        />
      ))}
    </div>
  );
};

export default TagLayer; 