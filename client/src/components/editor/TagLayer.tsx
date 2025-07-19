import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { Rnd } from 'react-rnd';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { DocumentTag, TagCoordinates, DocumentMode } from '../../types/editor';
import { useToast } from '../../hooks/use-toast';
import DraggableTag from './DraggableTag';

const TAG_TYPE_INFO = {
  'A': { label: 'Name', icon: 'A' },
  'S': { label: 'Signature', icon: 'S' },
  'I': { label: 'Initials', icon: 'I' },
  'N': { label: 'Commission #', icon: 'N' },
  'X': { label: 'Expiration', icon: 'X' },
  'O': { label: 'Disclosure', icon: 'O' },
  'E': { label: 'Seal', icon: 'E' },
  'W': { label: 'Whiteout', icon: 'W' },
  'T': { label: 'Text', icon: 'T' },
  'D': { label: 'Date', icon: 'D' },
} as const;

const USER_COLORS = {
  notary: '#EF4444',
  admin: '#DC2626', 
  signer1: '#3B82F6',
  signer2: '#10B981',
  signer3: '#F59E0B',
  witness1: '#8B5CF6',
  witness2: '#F97316'
} as const;

interface TagRendererProps {
  tag: DocumentTag;
  isSelected: boolean;
  canEdit: boolean;
  scaleFactor: number; // Use actual scale factor from PDF rendering
  onSelect: () => void;
  onUpdate: (updates: Partial<TagCoordinates>) => void;
  onDelete: () => void;
  onTagClick?: (tag: DocumentTag) => void; // Add click handler for content conversion
}

interface TagLayerProps {
  documentId: string;
  pageNumber: number;
  canvasElement: HTMLCanvasElement;
  containerRef: React.RefObject<HTMLDivElement>;
  scaleFactor: number; // Actual scale factor from PDF rendering
  mode: DocumentMode;
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
  scaleFactor, // Now using the actual scale factor
  onSelect,
  onUpdate,
  onDelete,
  onTagClick
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

  // Utility function to extract user information from tag
  const extractUserFromTag = (tag: DocumentTag, session: any): { name: string; colorCode: string } | null => {
    // First try to find by assignedUserId
    if (tag.assignedUserId && session?.participants) {
      const assignedUser = session.participants.find((p: any) => p.userId === tag.assignedUserId);
      if (assignedUser) {
        return {
          name: assignedUser.displayName.split(' ')[0], // First name only
          colorCode: assignedUser.colorCode
        };
      }
    }
    
    // Fallback to parsing displayLabel
    if (tag.displayLabel && tag.displayLabel.includes(' - ')) {
      const userName = tag.displayLabel.split(' - ')[1];
      if (userName) {
        return {
          name: userName.split(' ')[0], // First name only
          colorCode: tag.colorCode
        };
      }
    }
    
    return null;
  };

  // Get assigned user info for display
  const getAssignedUser = () => {
    if (!tag.assignedUserId || !session?.participants) return null;
    return session.participants.find(p => p.userId === tag.assignedUserId);
  };

  // Render tag content based on mode and completion status
  const renderTagContent = () => {
    const tagInfo = TAG_TYPE_INFO[tag.tagType];
    const userInfo = extractUserFromTag(tag, session);
    
    // For completed tags in signing mode, show the actual content
    if (mode.mode === 'signing' && tag.isCompleted && tag.contentData) {
      // Show completed content as plain text/image without any styling
      let contentData;
      try {
        contentData = typeof tag.contentData === 'string' ? 
          JSON.parse(tag.contentData) : tag.contentData;
      } catch (e) {
        console.error('Failed to parse contentData in TagLayer:', e);
        contentData = tag.contentData;
      }
      
      // Enhanced image detection logic
      const isImageContent = () => {
        // Check if tag type is inherently image-based
        if (['S', 'I', 'E'].includes(tag.tagType)) {
          return true; // Signature, Initials, Seal are always images
        }
        
        // Check contentData type
        if (contentData?.type && ['signature', 'initials', 'seal', 'stamp'].includes(contentData.type)) {
          return true;
        }
        
        // Check if value looks like an image URL/data
        if (contentData?.value && typeof contentData.value === 'string') {
          return (
            contentData.value.startsWith('data:image/') ||
            contentData.value.startsWith('http') ||
            contentData.value.includes('vultrobjects.com') ||
            contentData.value.includes('.png') ||
            contentData.value.includes('.jpg') ||
            contentData.value.includes('.jpeg') ||
            contentData.value.includes('.webp')
          );
        }
        
        return false;
      };

      return (
        <div className="w-full h-full flex items-center justify-center">
          {isImageContent() ? (
            <img 
              src={contentData.value} 
              alt={contentData.type === 'signature' ? 'Signature' : 
                   contentData.type === 'initials' ? 'Initials' : 
                   contentData.type === 'seal' || contentData.type === 'stamp' ? 'Notary Seal' : 'Image'} 
              className="max-h-full max-w-full object-contain"
              style={{ 
                filter: 'none',
                maxHeight: '100%',
                maxWidth: '100%'
              }}
              onError={(e) => {
                console.error('🖼️ Image failed to load in TagLayer:', contentData.value);
                // Fallback to text if image fails to load
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.innerHTML = `<div class="text-red-500 text-xs p-1">Image failed to load</div>`;
                }
              }}
            />
          ) : (
            <div 
              className="text-black w-full h-full flex items-center justify-center p-1"
              style={{ 
                fontSize: Math.max(10, Math.min(16, tag.coordinates.height * 0.6)),
                lineHeight: '1.2',
                wordBreak: 'break-word',
                fontFamily: 'inherit'
              }}
            >
              {typeof contentData.value === 'string' ? contentData.value : JSON.stringify(contentData.value)}
            </div>
          )}
        </div>
      );
    }
    
    // For incomplete tags (both tagging and signing mode), show the SAME rich UI
    // But handle click restrictions for signing mode
    const isNotary = currentUser && (currentUser.role === 'notary' || currentUser.userType === 'notary');
    const isSigner = currentUser && (currentUser.role === 'signer' || currentUser.userType === 'signer');
    const isAssignedToCurrentUser = currentUser && tag.assignedUserId === currentUser.userId;
    const isUniversalTag = ['T', 'D'].includes(tag.tagType);
    
    // Determine interaction state for signing mode
    let canInteract = true;
    let interactionMessage = '';
    let statusIcon = '';
    
    if (mode.mode === 'signing' && isSigner) {
      if (!isAssignedToCurrentUser && !isUniversalTag) {
        canInteract = false;
        interactionMessage = 'Not your tag';
        statusIcon = '❌';
      } else if (!canUserInteractWithTags()) {
        canInteract = false;
        interactionMessage = 'Wait for activation';
        statusIcon = '🔒';
      }
    }
    
    return (
      <div 
        className="flex flex-col items-center justify-center w-full h-full p-1 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={(e) => {
          console.log('🏷️ Tag content clicked in TagLayer:', {
            tagId: tag.id,
            mode: mode.mode,
            isCompleted: tag.isCompleted,
            canInteract,
            clickDetail: e.detail
          });
          
          if (mode.mode === 'signing' && !tag.isCompleted) {
            if (canInteract && onTagClick) {
              // Check if it's a double-click to open the modal
              if (e.detail === 2) {
                console.log('🎯 Double-click detected - triggering tag interaction for tag:', tag.id);
                onTagClick(tag);
              } else {
                // Single-click: just select the tag
                console.log('🔗 Single-click detected - selecting tag:', tag.id);
                onSelect();
              }
            } else {
              onSelect();
            }
          } else {
            onSelect();
          }
        }}
      >
        {/* Main tag content - SAME for both tagging and signing mode */}
        <div className="flex items-center gap-1">
          <span className="text-xs opacity-80">{tagInfo.icon}</span>
          <span className="text-xs font-medium truncate">{tagInfo.label}</span>
          {/* Show status icon in signing mode for restricted tags */}
          {mode.mode === 'signing' && statusIcon && (
            <span className="text-xs">{statusIcon}</span>
          )}
        </div>
        
        {/* User identification - SAME for both modes */}
        {userInfo && (
          <div className="flex items-center gap-1 mt-0.5 px-1 py-0.5 bg-white bg-opacity-70 rounded-full">
            <div 
              className="w-2 h-2 rounded-full border border-white shadow-sm" 
              style={{ backgroundColor: userInfo.colorCode }}
            />
            <span className="text-xs font-medium opacity-90 truncate">
              {userInfo.name}
            </span>
          </div>
        )}
        
        {/* Show interaction hint in signing mode */}
        {mode.mode === 'signing' && (
          <div className="mt-0.5">
            <span className="text-xs opacity-70">
              {interactionMessage || `Double-click to ${['S', 'I', 'E'].includes(tag.tagType) ? 'apply' : 'enter'}`}
            </span>
          </div>
        )}
      </div>
    );
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
        console.log('🏷️ Tag clicked in TagLayer:', {
          tagId: tag.id,
          mode: mode.mode,
          isCompleted: tag.isCompleted,
          clickDetail: e.detail
        });
        
        if (onTagClick && mode.mode === 'signing' && !tag.isCompleted) {
          // Check if it's a double-click to open the modal
          if (e.detail === 2) {
            console.log('🎯 Double-click detected - triggering tag interaction for tag:', tag.id);
            onTagClick(tag);
          } else {
            // Single-click: just select the tag
            console.log('🔗 Single-click detected - selecting tag:', tag.id);
            onSelect();
          }
        } else {
          onSelect();
        }
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={`
        relative transition-all duration-200 overflow-hidden
        ${isSelected ? 'ring-2 ring-blue-400 ring-opacity-60' : ''}
        ${canModifyTag ? 'cursor-move hover:shadow-md' : 'cursor-default'}
        ${mode.showPlaceholders || !tag.isCompleted ? 'opacity-90' : 'opacity-100'}
      `}
      style={{
        backgroundColor: tag.isCompleted && mode.mode === 'signing' 
          ? 'transparent' // No background for completed tags in signing mode
          : 'rgba(255, 255, 255, 0.95)',
        border: tag.isCompleted && mode.mode === 'signing' 
          ? 'none' // No border for completed tags in signing mode
          : `2px solid ${tag.colorCode || userColor}`,
        borderRadius: tag.isCompleted && mode.mode === 'signing' ? '0' : '6px',
        zIndex: isSelected ? 1000 : 100,
        boxShadow: tag.isCompleted && mode.mode === 'signing'
          ? 'none' // No shadow for completed tags
          : isSelected 
          ? `0 4px 12px rgba(0,0,0,0.15), 0 0 0 2px ${(tag.colorCode || userColor)}20` 
          : '0 2px 4px rgba(0,0,0,0.1)',
        color: tag.isCompleted && mode.mode === 'signing' 
          ? '#000000' // Black text for completed content in signing mode
          : tag.colorCode || userColor
      }}
      resizeHandleStyles={{
        bottomRight: {
          width: '10px',
          height: '10px',
          backgroundColor: tag.colorCode || userColor,
          border: '2px solid white',
          borderRadius: '50%',
          right: '-5px',
          bottom: '-5px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }
      }}
    >
      {/* Tag Content */}
      <div className="w-full h-full flex items-center justify-center">
        {renderTagContent()}
      </div>

      {/* Selection Indicator */}
      {isSelected && canModifyTag && (
        <div className="absolute -top-7 left-0 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div 
                className="w-2 h-2 rounded-full border border-white" 
                style={{ backgroundColor: tag.colorCode }}
              />
              <span className="font-medium">Selected</span>
            </div>
            <span className="opacity-75">• Delete to remove • Drag to move</span>
          </div>
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
  scaleFactor,
  mode,
  onCoordinateClick,
  liveSessionState
}) => {
  const layerRef = useRef<HTMLDivElement>(null);
  
  const {
    tags,
    selectedTag,
    updateTag,
    deleteTag,
    selectTag,
    currentUser,
    session,
  } = useEditorStore();

  const { toast } = useToast();

  // Permission checking for tag interactions - FIXED VERSION
  const canUserInteractWithTags = useCallback(() => {
    if (!currentUser) {
      console.log('❌ No current user');
      return false;
    }
    
    // Notary has full control - can always interact
    if (currentUser.role === 'notary' || currentUser.userType === 'notary') {
      console.log('✅ User is notary - full permissions');
      return true;
    }
    
    // In signing mode with live session, check active user status
    if (mode.mode === 'signing' && liveSessionState) {
      // Check if user is the active user (handle both string and number IDs)
      const currentUserIdStr = currentUser.userId?.toString();
      const activeUserIdStr = liveSessionState.activeUserId?.toString();
      const isActiveUser = currentUserIdStr === activeUserIdStr;
      
      console.log('🔐 Permission check:', {
        currentUserId: currentUser.userId,
        currentUserIdStr,
        activeUserId: liveSessionState.activeUserId,
        activeUserIdStr,
        isActiveUser,
        userType: currentUser.userType || currentUser.role,
        sessionState: liveSessionState.state
      });
      
      if (!isActiveUser) {
        console.log('❌ User is not the active user in live session');
        return false;
      }
      
      console.log('✅ User is active user - can interact');
      return true;
    }
    
    // In tagging mode, users with edit permissions can interact
    if (mode.mode === 'tagging' && mode.canPlaceTags) {
      console.log('✅ Tagging mode with place permissions');
      return true;
    }
    
    console.log('❌ No interaction permissions');
    return false;
  }, [currentUser, mode, liveSessionState]);

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
      const response = await fetch(`/api/editor/session/${session.id}/tag/${tagId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete tag: ${response.statusText}`);
      }
      
      deleteTag(tagId);
      console.log('✅ Tag deleted from server');
      
    } catch (error) {
      console.error('❌ Failed to delete tag:', error);
      // TODO: Show error toast
    }
  }, [session, deleteTag]);

  // Handle tag click for content conversion during signing - SIGNER RESTRICTIONS
  const handleTagClick = useCallback(async (tag: DocumentTag) => {
    console.log('🏷️ Tag clicked for content conversion:', {
      tagId: tag.id,
      tagType: tag.tagType,
      isCompleted: tag.isCompleted,
      mode: mode.mode,
      currentUser: currentUser?.userId,
      assignedUserId: tag.assignedUserId,
      canInteractGeneral: canUserInteractWithTags()
    });

    const isNotary = currentUser && (currentUser.role === 'notary' || currentUser.userType === 'notary');
    const isSigner = currentUser && (currentUser.role === 'signer' || currentUser.userType === 'signer');

    // ❌ SIGNERS CAN ONLY CLICK TAGS PLACED BY ADMIN/NOTARY
    if (isSigner && mode.mode === 'signing') {
      // Check if signer is assigned to this tag
      const isAssignedUser = tag.assignedUserId === currentUser.userId;
      const isUniversalTag = ['T', 'D'].includes(tag.tagType);
      
      if (!isAssignedUser && !isUniversalTag) {
        toast({
          variant: "destructive",
          title: "Cannot Edit Tag",
          description: `This ${tag.tagType} tag is assigned to another participant.`
        });
        return;
      }

      // ✅ SIGNER CAN ONLY INTERACT IF THEY ARE THE ACTIVE USER
      if (!canUserInteractWithTags()) {
        toast({
          variant: "destructive",
          title: "Tag Not Active",
          description: "Ask the notary to activate you before filling out tags."
        });
        return;
      }

      // ✅ CHECK IF TAG IS ACTIVE FOR SIGNERS (controlled by notary)
      // TODO: Add tag.isActiveForSigners field when notary activates tags
      console.log('✅ Signer can interact with assigned/universal tag');
    }

    // ✅ NOTARY HAS FULL CONTROL
    if (isNotary) {
      console.log('✅ Notary can interact with any tag');
    }

    if (mode.mode !== 'signing' || tag.isCompleted) {
      console.log('👆 Not signing mode or already completed, just selecting tag');
      handleTagSelect(tag);
      return;
    }

    console.log('✅ User can interact with tag, triggering content input...');
    
    try {
      handleTagSelect(tag);
      
      if (onTagClick) {
        onTagClick(tag);
      }
      
    } catch (error) {
      console.error('Failed to handle tag interaction:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to open tag editor. Please try again."
      });
    }
  }, [canUserInteractWithTags, currentUser, mode.mode, handleTagSelect, onTagClick, toast]);

  // Update tag with content
  const updateTagContent = useCallback(async (tagId: string, content: string, contentType: string = 'text') => {
    if (!session) return;

    try {
      const response = await fetch(
        `/api/editor/session/${session.id}/tag/${tagId}/content`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            content,
            contentType
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update tag content');
      }

      const { tag: updatedTag } = await response.json();
      
      // Update local state
      updateTag(tagId, {
        content,
        contentData: JSON.stringify({ type: contentType, value: content }),
        isCompleted: true,
        completedBy: currentUser?.userId,
        completedAt: new Date()
      });

      console.log('✅ Tag content updated successfully');

    } catch (error) {
      console.error('❌ Failed to update tag content:', error);
      // TODO: Show error toast
    }
  }, [session, updateTag, currentUser]);

  // Show content input modal (placeholder - implement as needed)
  const showContentInputModal = useCallback((tag: DocumentTag) => {
    // This would open a modal/dialog for manual content entry
    // For now, use a simple prompt
    const tagInfo = TAG_TYPE_INFO[tag.tagType];
    let content = '';

    switch (tag.tagType) {
      case 'T':
        content = prompt(`Enter text for ${tagInfo.label}:`) || '';
        break;
      case 'D':
        content = prompt(`Enter date for ${tagInfo.label}:`, new Date().toLocaleDateString()) || '';
        break;
      case 'A':
        content = prompt(`Enter name for ${tagInfo.label}:`) || '';
        break;
      default:
        content = prompt(`Enter content for ${tagInfo.label}:`) || '';
    }

    if (content) {
      updateTagContent(tag.id, content, 'text');
    }
  }, [updateTagContent]);

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
    pointerEvents: 'auto',
  };

  return (
    <div style={layerStyle} className="tag-layer">
      {pageTags.map(tag => (
        <TagRenderer
          key={tag.id}
          tag={tag}
          isSelected={selectedTag?.id === tag.id}
          canEdit={mode.canPlaceTags}
          scaleFactor={scaleFactor}
          onSelect={() => handleTagSelect(tag)}
          onUpdate={(updates) => handleTagUpdate(tag.id, updates)}
          onDelete={() => handleTagDelete(tag.id)}
          onTagClick={handleTagClick}
        />
      ))}
    </div>
  );
};

export default TagLayer; 