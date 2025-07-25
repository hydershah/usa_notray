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
      
      // 🚀 REAL-TIME SYNC: Broadcast tag position update to all participants
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
              className="text-black w-full h-full flex items-center justify-center p-1"
              style={{ 
                fontSize: Math.max(10, Math.min(16, tag.coordinates.height * 0.6)),
                lineHeight: '1.2',
                wordBreak: 'break-word',
                fontFamily: 'inherit'
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
        ${canModifyTag ? 'cursor-move hover:shadow-md' : 'cursor-default'}
        ${mode.showPlaceholders || !tag.isCompleted ? 'opacity-90' : 'opacity-100'}
      `}
      style={{
        backgroundColor: tag.isCompleted && mode.mode === 'signing' 
          ? tag.tagType === 'W' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.1)' // Whiteout = solid white, others = very subtle background
          : 'rgba(255, 255, 255, 0.95)',
        border: tag.isCompleted && mode.mode === 'signing' 
          ? tag.tagType === 'W' ? '1px solid #E5E7EB' : '1px solid rgba(156, 163, 175, 0.3)' // Very subtle border for completed tags
          : `2px solid ${tag.colorCode || userColor}`,
        borderRadius: tag.isCompleted && mode.mode === 'signing' ? '0' : '6px',
        zIndex: tag.tagType === 'W' ? (isSelected ? 1000 : 10) : (isSelected ? 1000 : 100), // Lower z-index for whiteout (background)
        boxShadow: tag.isCompleted && mode.mode === 'signing'
          ? '0 1px 2px rgba(0,0,0,0.05)' // Very subtle shadow for completed tags
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