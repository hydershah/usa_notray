import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { Rnd } from 'react-rnd';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { DocumentTag, TagCoordinates, DocumentMode } from '../../types/editor';
import { useToast } from '../../hooks/use-toast';
import DraggableTag from './DraggableTag';
import { useDebouncedTagOperations } from '../../hooks/editor/useDebounced';

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
  
  // Use debounced operations hook
  const { debouncedPositionUpdate } = useDebouncedTagOperations(session?.id || '');
  
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
    // ✅ FIXED: Remove excessive minimum size constraints for text tags
    width: tag.tagType === 'T' 
      ? Math.round(tag.coordinates.width * scaleFactor) // No minimum width for text tags
      : Math.max(Math.round(tag.coordinates.width * scaleFactor), 60), // Keep minimum for other tags
    height: tag.tagType === 'T' 
      ? Math.round(tag.coordinates.height * scaleFactor) // No minimum height for text tags
      : Math.max(Math.round(tag.coordinates.height * scaleFactor), 30) // Keep minimum for other tags
  };

  console.log('🏷️ Tag rendering:', {
    tagId: tag.id.substring(0, 8),
    tagType: tag.tagType,
    pdfCoords: tag.coordinates,
    displayCoords,
    scaleFactor
  });

  // Handle drag stop - convert back to PDF coordinates and save to server with debouncing
  const handleDragStop = useCallback(async (e: any, data: any) => {
    if (!canModifyTag || !session) return;
    
    const newPdfCoordinates = {
      x: Math.round(data.x / scaleFactor),
      y: Math.round(data.y / scaleFactor)
    };
    
    console.log('🔄 Tag drag update (debounced):', {
      canvas: { x: data.x, y: data.y },
      pdf: newPdfCoordinates,
      scaleFactor
    });
    
    try {
      // Update local state immediately (optimistic update)
      onUpdate(newPdfCoordinates);
      
      // 🚀 REAL-TIME SYNC: Broadcast tag position update to all participants (throttled)
      const { useEditorStore } = await import('@/hooks/editor/useEditorStore');
      const webSocket = useEditorStore.getState().webSocket;
      
      if (webSocket && webSocket.tagUpdated) {
        try {
          console.log('📡 Broadcasting tag position update via WebSocket:', {
            tagId: tag.id,
            coordinates: newPdfCoordinates
          });
          
          webSocket.tagUpdated(tag.id, { coordinates: newPdfCoordinates });
          console.log('✅ Tag position update broadcasted successfully');
        } catch (wsError) {
          console.warn('⚠️ Failed to broadcast tag position update via WebSocket:', wsError);
        }
      } else {
        console.warn('⚠️ WebSocket not available for broadcasting tag position update');
      }
      
      // Use debounced position update instead of immediate server call
      const debouncedUpdate = debouncedPositionUpdate(tag.id, {
        ...tag.coordinates,
        ...newPdfCoordinates
      });
      
      // Execute the debounced update
      debouncedUpdate();
      
      console.log('🕒 Tag position update scheduled (debounced)');
      
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
      
      // 🚀 REAL-TIME SYNC: Broadcast tag resize update to all participants
      const { useEditorStore } = await import('@/hooks/editor/useEditorStore');
      const webSocket = useEditorStore.getState().webSocket;
      
      if (webSocket && webSocket.tagUpdated) {
        try {
          console.log('📡 Broadcasting tag resize update via WebSocket:', {
            tagId: tag.id,
            coordinates: newPdfCoordinates
          });
          
          webSocket.tagUpdated(tag.id, { coordinates: newPdfCoordinates });
          console.log('✅ Tag resize update broadcasted successfully');
        } catch (wsError) {
          console.warn('⚠️ Failed to broadcast tag resize update via WebSocket:', wsError);
        }
      } else {
        console.warn('⚠️ WebSocket not available for broadcasting tag resize update');
      }
      
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
    if (mode.mode === 'signing' && tag.isCompleted && (tag.contentData || tag.content)) {
      // Special handling for whiteout tags - show as solid white rectangle
      if (tag.tagType === 'W') {
        return <div className="w-full h-full bg-white" />;
      }
      // Show completed content as plain text/image without any styling
      let contentData;
      try {
        if (tag.contentData) {
          contentData = typeof tag.contentData === 'string' ? 
            JSON.parse(tag.contentData) : tag.contentData;
        } else if (tag.content) {
          // Fallback: create contentData from content field with correct type based on tag type
          const getTypeFromTagType = (tagType: string) => {
            switch (tagType) {
              case 'S': return 'signature';
              case 'I': return 'initials';
              case 'E': return 'seal';
              case 'D': return 'date';
              default: return 'text';
            }
          };
          
          contentData = {
            type: getTypeFromTagType(tag.tagType),
            value: tag.content
          };
        } else {
          contentData = { type: 'text', value: '' };
        }
      } catch (e) {
        console.error('Failed to parse contentData in TagLayer:', e);
        // Fallback to content field if contentData parsing fails
        const getTypeFromTagType = (tagType: string) => {
          switch (tagType) {
            case 'S': return 'signature';
            case 'I': return 'initials';
            case 'E': return 'seal';
            case 'D': return 'date';
            default: return 'text';
          }
        };
        
        contentData = {
          type: getTypeFromTagType(tag.tagType),
          value: tag.content || tag.contentData || ''
        };
      }
      
      // Helper function to check if contentData contains an image
      const isImageContent = () => {
        if (!contentData || !contentData.value) return false;
        
        const value = contentData.value;
        
        // Check if content type indicates it's an image-based content
        const isSignatureType = contentData.type === 'signature' || contentData.type === 'initials' || contentData.type === 'seal';
        
        // Also check tag type as backup (in case contentData.type is wrong)
        const isSignatureTagType = ['S', 'I', 'E'].includes(tag.tagType);
        
        const isImageUrl = (typeof value === 'string') && (
          value.startsWith('data:image/') ||
          value.startsWith('https://') ||
          value.startsWith('http://') ||
          value.includes('vultrobjects.com') ||
          value.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)
        );
        
        // Special aggressive detection for signature/seal/initial tags
        const isLikelySignatureUrl = (typeof value === 'string') && (
          (value.length > 100 && value.includes('signature')) ||
          (value.length > 100 && value.includes('stamp')) ||
          (value.length > 100 && value.includes('vultrobjects.com')) ||
          (value.length > 100 && value.includes('X-Amz-Algorithm'))
        );
        
        console.log('🔍 TagLayer image content check for tag', tag.id, ':', {
          tagType: tag.tagType,
          contentDataType: contentData.type,
          isSignatureType,
          isSignatureTagType,
          valueType: typeof value,
          valueLength: typeof value === 'string' ? value.length : 'not string',
          startsWithDataImage: typeof value === 'string' && value.startsWith('data:image/'),
          startsWithHttps: typeof value === 'string' && value.startsWith('https://'),
          includesVultr: typeof value === 'string' && value.includes('vultrobjects.com'),
          hasImageExtension: typeof value === 'string' && !!value.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i),
          isImageUrl,
          isLikelySignatureUrl,
          result: (isSignatureType || isSignatureTagType) && (isImageUrl || isLikelySignatureUrl)
        });
        
        // Return true if it's either a signature content type OR a signature tag type, AND it looks like an image URL
        return (isSignatureType || isSignatureTagType) && (isImageUrl || isLikelySignatureUrl);
      };

      // Determine the best image source from available data
      const getImageUrl = () => {
        // First try contentData.value
        if (typeof contentData?.value === 'string') return contentData.value;
        
        // Try nested object structure (for complex signature data)
        if (contentData?.value && typeof contentData.value === 'object') {
          const possibleKeys = ['imageUrl', 'url', 'signedUrl', 'src', 'value'];
          for (const key of possibleKeys) {
            if (typeof (contentData.value as any)[key] === 'string') {
              return (contentData.value as any)[key];
            }
          }
        }
        
        // Fallback to tag.content
        if (typeof tag.content === 'string') return tag.content;
        
        // Try nested object in tag.content
        if (tag.content && typeof tag.content === 'object') {
          const possibleKeys = ['imageUrl', 'url', 'signedUrl', 'src', 'value'];
          for (const key of possibleKeys) {
            if (typeof (tag.content as any)[key] === 'string') {
              return (tag.content as any)[key];
            }
          }
        }
        
        return '';
      };

      console.log('🎨 TagLayer rendering completed tag', tag.id, ':', {
        tagType: tag.tagType,
        isImageContent: isImageContent(),
        imageUrl: getImageUrl(),
        contentDataType: contentData?.type,
        contentDataValue: typeof contentData?.value === 'string' 
          ? contentData.value.substring(0, 100) + '...' 
          : JSON.stringify(contentData?.value)
      });

      return (
        <div className="w-full h-full flex items-center justify-center">
          {isImageContent() ? (
            <img 
              src={getImageUrl()} 
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
                console.error('🖼️ Image failed to load in TagLayer:', getImageUrl());
                // Try to refresh image if it's an expiring Vultr signed URL
                const failedUrl = getImageUrl();
                if (failedUrl.includes('vultrobjects.com') && failedUrl.includes('X-Amz-Expires')) {
                  fetch(`/api/tags/${tag.id}/refresh-content`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('token')}`,
                      'Content-Type': 'application/json'
                    }
                  }).then(res => {
                    if (res.ok) {
                      console.log('🔄 Refreshed tag content, attempting to reload image');
                      res.json().then(data => {
                        if (data?.content) {
                          const newUrl = typeof data.content === 'string' ? data.content : (data.content?.value || '');
                          if (newUrl) {
                            e.currentTarget.style.display = 'block';
                            e.currentTarget.setAttribute('src', newUrl);
                            return;
                          }
                        }
                        // Fallback reload
                        window.location.reload();
                      }).catch(() => window.location.reload());
                    }
                  }).catch(err => {
                    console.error('❌ Failed to refresh tag content:', err);
                  });
                }
                // Show actual content instead of generic "Applied" message
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  const actualContent = (() => {
                    // Only display meaningful content to users, never debug data
                    if (typeof contentData?.value === 'string') {
                      const value = contentData.value;
                      
                      // For signature, initials, and seal tags, prioritize showing images even with technical URLs
                      const isSignatureOrSealTag = ['S', 'I', 'E'].includes(tag.tagType);
                      const isImageUrl = value.startsWith('data:image/') || 
                                       value.startsWith('https://') ||
                                       value.includes('vultrobjects.com') ||
                                       value.includes('.png') ||
                                       value.includes('.jpg') ||
                                       value.includes('.jpeg') ||
                                       value.includes('.gif') ||
                                       value.includes('.svg') ||
                                       (value.startsWith('http') && isSignatureOrSealTag);
                      
                      // If it's an image URL, try to create an img element instead of showing "[Applied]"
                      if (isImageUrl) {
                        return `<img src="${value}" alt="${tag.tagType === 'S' ? 'Signature' : tag.tagType === 'I' ? 'Initials' : 'Seal'}" style="max-height: 100%; max-width: 100%; object-fit: contain;" onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\"text-center text-gray-600 text-xs\\">[${tag.tagType === 'S' ? 'Signature Applied' : tag.tagType === 'I' ? 'Initials Applied' : 'Seal Applied'}]</div>'" />`;
                      }
                      
                      // For non-image content, filter out technical/debug data
                      if (value.includes('Algorithm=') || value.includes('Signature=') || value.includes('Expires=') || value.includes('&X-Amz-')) {
                        return '[Applied]'; // Show simple applied message for technical data
                      }
                      return value;
                    } else if (contentData?.value && typeof contentData.value === 'object') {
                      return '[Applied]';
                    } else {
                      return tag.content && typeof tag.content === 'string' ? tag.content : '[No content]';
                    }
                  })()
                  const displayContent = actualContent.length > 50 ? actualContent.substring(0, 47) + '...' : actualContent;
                  parent.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs font-medium p-1" style="word-break: break-word; line-height: 1.2;">${displayContent}</div>`;
                }
              }}
            />
          ) : (
            <div 
              className={`text-black w-full h-full flex items-center justify-center ${tag.tagType === 'T' ? 'p-1' : 'p-2'}`}
              style={{ 
                fontSize: Math.max(12, Math.min(18, tag.coordinates.height * 0.6)),
                lineHeight: '1.3',
                wordBreak: 'break-word',
                fontFamily: 'inherit',
                fontWeight: '500'
              }}
            >
              {(() => {
                // Only display meaningful content to users, never debug data
                if (typeof contentData?.value === 'string') {
                  const value = contentData.value;
                  
                  // For signature, initials, and seal tags, prioritize showing images even with technical URLs
                  const isSignatureOrSealTag = ['S', 'I', 'E'].includes(tag.tagType);
                  const isImageUrl = value.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i) || 
                                   value.startsWith('data:image') || 
                                   value.includes('vultrobjects.com') || 
                                   (value.startsWith('http') && isSignatureOrSealTag);
                  
                  // Enhanced signature URL detection (same as main isImageContent function)
                  const isLikelySignatureUrl = (
                    (value.length > 100 && value.includes('signature')) ||
                    (value.length > 100 && value.includes('stamp')) ||
                    (value.length > 100 && value.includes('vultrobjects.com')) ||
                    (value.length > 100 && value.includes('X-Amz-Algorithm'))
                  );
                  
                  if (isImageUrl || (isSignatureOrSealTag && isLikelySignatureUrl)) {
                    // Return the URL so it can be processed by image rendering logic above
                    return (
                      <img 
                        src={value} 
                        alt={`${tag.tagType === 'S' ? 'Signature' : tag.tagType === 'I' ? 'Initials' : 'Seal'}`}
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => {
                          // If image fails, replace with a user-friendly message
                          const img = e.target as HTMLImageElement;
                          const parent = img.parentElement;
                          if (parent) {
                            parent.innerHTML = `<div class="text-center text-gray-600 text-xs">[${tag.tagType === 'S' ? 'Signature Applied' : tag.tagType === 'I' ? 'Initials Applied' : 'Seal Applied'}]</div>`;
                          }
                        }}
                      />
                    );
                  }
                  
                  // For signature/seal/initial tags that didn't match image detection above, show applied message
                  if (isSignatureOrSealTag && (value.includes('Algorithm=') || value.includes('Signature=') || value.includes('Expires=') || value.includes('&X-Amz-'))) {
                    return '[Applied]';
                  }
                  return value;
                } else if (contentData?.value && typeof contentData.value === 'object') {
                  return '[Applied]';
                } else {
                  return tag.content && typeof tag.content === 'string' ? tag.content : '[No content]';
                }
              })()}
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
        className={`flex flex-col items-center justify-center w-full h-full ${tag.tagType === 'T' ? 'p-1' : 'p-2'} cursor-pointer hover:opacity-80 transition-opacity`}
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
              // Single-click: trigger tag interaction immediately for better UX
              console.log('🎯 Single-click detected - triggering tag interaction for tag:', tag.id);
              onTagClick(tag);
            } else {
              console.log('🔗 Single-click detected - selecting tag:', tag.id);
              onSelect();
            }
          } else {
            onSelect();
          }
        }}
      >
        {/* Main tag content - improved sizing */}
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-80">{tagInfo.icon}</span>
          <span className="text-sm font-medium truncate">{tagInfo.label}</span>
          {/* Show status icon in signing mode for restricted tags */}
          {mode.mode === 'signing' && statusIcon && (
            <span className="text-sm">{statusIcon}</span>
          )}
        </div>
        
        {/* User identification - improved sizing */}
        {userInfo && (
          <div className="flex items-center gap-1.5 mt-1 px-2 py-1 bg-transparent rounded-full border border-gray-200">
            <div 
              className="w-2.5 h-2.5 rounded-full border border-white shadow-sm" 
              style={{ backgroundColor: userInfo.colorCode }}
            />
            <span className="text-sm font-medium opacity-90 truncate">
              {userInfo.name}
            </span>
          </div>
        )}
        
        {/* Show interaction hint in signing mode - improved sizing */}
        {mode.mode === 'signing' && (
          <div className="mt-1">
            <span className="text-sm opacity-70">
              {interactionMessage || `Click to ${['S', 'I', 'E'].includes(tag.tagType) ? 'apply' : 'enter'}`}
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
          // Single-click: trigger tag interaction immediately for better UX
          console.log('🎯 Single-click detected - triggering tag interaction for tag:', tag.id);
          onTagClick(tag);
        } else {
          // Single-click: just select the tag
          console.log('🔗 Single-click detected - selecting tag:', tag.id);
          onSelect();
        }
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={`
        relative transition-all duration-200 overflow-hidden
        ${isSelected ? 'ring-2 ring-blue-400 ring-opacity-60' : ''}
        ${canModifyTag ? 'cursor-move hover:shadow-lg' : 'cursor-default'}
        ${mode.showPlaceholders || !tag.isCompleted ? 'opacity-95' : 'opacity-100'}
      `}
      style={{
        // Completely transparent background for all tags
        backgroundColor: 'transparent',
        
        // Minimal styling for text tags
        border: tag.tagType === 'T' 
          ? 'none' // Completely borderless for text tags
          : tag.isCompleted && mode.mode === 'signing' 
          ? '1px solid #e2e8f0' // Very light grey border for completed tags
          : isSelected
          ? '2px solid #3b82f6' // Blue border for selected tags
          : '1px solid #d1d5db', // Light grey border for all other tags
        
        borderRadius: tag.tagType === 'T' ? '2px' : '8px', // Minimal radius for text tags
        
        // Improved shadows - borderless for text tags
        boxShadow: tag.tagType === 'T' 
          ? 'none' // No shadows for borderless text tags
          : tag.isCompleted && mode.mode === 'signing'
          ? '0 1px 3px rgba(0,0,0,0.08)' // Subtle shadow for completed tags
          : isSelected 
          ? '0 4px 12px rgba(59, 130, 246, 0.15), 0 0 0 2px rgba(59, 130, 246, 0.1)' 
          : '0 2px 6px rgba(0,0,0,0.1)', // Enhanced shadow for better depth
        
        // Better color contrast
        color: tag.isCompleted && mode.mode === 'signing' 
          ? '#1f2937' // Dark grey text for completed content
          : tag.colorCode || '#374151',
        
        zIndex: tag.tagType === 'W' ? (isSelected ? 1000 : 10) : (isSelected ? 1000 : 100),
        
        // ✅ FIXED: Reduced minimum sizing constraints for better text tag sizing
        minWidth: tag.tagType === 'T' ? 'auto' : '60px', // Reduced from 80px to 60px
        minHeight: tag.tagType === 'T' ? 'auto' : '24px' // Reduced from 32px to 24px
      }}
      resizeHandleStyles={{
        bottomRight: {
          width: '16px', // Increased from 10px to 16px for better interaction
          height: '16px', // Increased from 10px to 16px
          backgroundColor: tag.colorCode || '#3b82f6',
          border: '2px solid white',
          borderRadius: '50%',
          right: '-8px', // Adjusted position for larger handle
          bottom: '-8px', // Adjusted position for larger handle
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)', // Enhanced shadow
          cursor: 'nw-resize'
        }
      }}
    >
      {/* Tag Content with improved padding and sizing */}
      <div className={`w-full h-full flex items-center justify-center ${tag.tagType === 'T' ? 'p-1' : 'p-3'}`}> {/* ✅ FIXED: Minimal padding for text tags */}
        {renderTagContent()}
      </div>

      {/* Selection Indicator with improved styling */}
      {isSelected && canModifyTag && (
        <div className="absolute -top-8 left-0 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-10">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div 
                className="w-2.5 h-2.5 rounded-full border border-white" 
                style={{ backgroundColor: tag.colorCode }}
              />
              <span className="font-medium">Selected</span>
            </div>
            <span className="opacity-75">• Delete to remove • Drag to move</span>
          </div>
        </div>
      )}

      {/* Debug info in development with improved styling */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute -bottom-20 left-0 text-xs text-gray-500 bg-transparent p-2 rounded-lg shadow-lg text-left whitespace-nowrap border border-gray-200">
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
    return tags.filter(tag => tag.documentId === documentId && tag.coordinates.pageNumber === pageNumber && tag.tagType !== 'T');
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