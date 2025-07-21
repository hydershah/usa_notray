import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Rnd } from 'react-rnd';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { initializePDFWorker, isPDFWorkerReady } from '../../lib/pdf-worker';
import type { TagCoordinates, DocumentTag, SessionParticipant } from '../../types/editor';
import { TAG_TYPE_INFO } from '../../types/editor';
import { StreamlinedTextInput } from './StreamlinedTextInput';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';

// Define TagPosition type
interface TagPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PDFViewerProps {
  documentUrl: string;
  sessionId?: string;
  onPageLoad?: (pageNumber: number, canvas: HTMLCanvasElement, scaleFactor: number) => void;
  onCoordinateClick?: (coordinates: TagCoordinates) => void;
  onTagClick?: (tag: DocumentTag, position: TagPosition) => void;
  onTagResize?: (tagId: string, coordinates: TagCoordinates) => void;
  onTagDelete?: (tagId: string) => void;
  mode?: 'viewing' | 'tagging' | 'signing';
  liveSessionState?: {
    activeUserId?: number;
    state?: string;
  };
  onSetActiveUser?: (userId: number) => void;
  tags?: DocumentTag[];
  selectedUser?: SessionParticipant | null;
  onTagUpdate?: (tagId: string, coordinates: Partial<TagCoordinates>) => void;
  className?: string;
  // Text input specific props
  textInputs?: Array<{
    id: string;
    coordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
      pageNumber: number;
    };
    content: string;
    fontSize: number;
    fontFamily: string;
    textColor: string;
    assignedUserId: number;
    userColor: string;
    isNew: boolean;
    createdAt: Date;
  }>;
  selectedTextInputId?: string | null;
  onTextInputSelect?: (textInputId: string | null) => void;
  onSaveTextContent?: (textInputId: string, content: string) => void;
  onDeleteTextInput?: (textInputId: string) => void;
  // Sync functionality for live signing
  onSyncUsers?: () => void;
  currentUser?: SessionParticipant | null;
  isSyncLoading?: boolean;
}

interface TagRendererProps {
  tag: DocumentTag;
  scaleFactor: number;
  isSelected: boolean;
  canEdit: boolean;
  onUpdate: (coordinates: Partial<TagCoordinates>) => void;
  onSave: (coordinates: Partial<TagCoordinates>) => void;
  onDelete: () => void;
  onSelect: () => void;
  onTagClick?: (tag: DocumentTag, position: { x: number; y: number; width: number; height: number }) => void;
  mode?: string;
}

const TagRenderer: React.FC<TagRendererProps> = ({
  tag,
  scaleFactor,
  isSelected,
  canEdit,
  onUpdate,
  onSave,
  onDelete,
  onSelect,
  onTagClick,
  mode
}) => {
  const [imageLoadError, setImageLoadError] = React.useState(false);
  const tagInfo = TAG_TYPE_INFO[tag.tagType];
  
  // Convert PDF coordinates to display coordinates
  const displayCoords = {
    x: Math.round(tag.coordinates.x * scaleFactor),
    y: Math.round(tag.coordinates.y * scaleFactor),
    width: Math.round(tag.coordinates.width * scaleFactor),
    height: Math.round(tag.coordinates.height * scaleFactor)
  };

  const validateAndSanitizeCoordinates = (coords: any) => {
    const sanitized: any = {};
    
    if (coords.x !== undefined) {
      sanitized.x = isFinite(coords.x) ? Math.round(coords.x) : 0;
    }
    if (coords.y !== undefined) {
      sanitized.y = isFinite(coords.y) ? Math.round(coords.y) : 0;
    }
    if (coords.width !== undefined) {
      sanitized.width = isFinite(coords.width) && coords.width > 0 ? Math.round(coords.width) : 100;
    }
    if (coords.height !== undefined) {
      sanitized.height = isFinite(coords.height) && coords.height > 0 ? Math.round(coords.height) : 30;
    }
    
    return sanitized;
  };

  const handleDrag = (e: any, data: any) => {
    if (!canEdit) return;
    
    // Update coordinates during drag for smooth visual feedback
    const newCoordinates = validateAndSanitizeCoordinates({
      x: data.x / scaleFactor,
      y: data.y / scaleFactor
    });
    
    onUpdate(newCoordinates);
  };

  const handleDragStop = (e: any, data: any) => {
    if (!canEdit || !onSave) return;
    
    // Save to server only when drag ends
    const newCoordinates = validateAndSanitizeCoordinates({
      x: data.x / scaleFactor,
      y: data.y / scaleFactor
    });
    
    onSave(newCoordinates);
  };

  const handleResize = (e: any, direction: any, ref: any, delta: any, position: any) => {
    if (!canEdit) return;
    
    // Update coordinates during resize for smooth visual feedback
    const newCoordinates = validateAndSanitizeCoordinates({
      x: position.x / scaleFactor,
      y: position.y / scaleFactor,
      width: ref.offsetWidth / scaleFactor,
      height: ref.offsetHeight / scaleFactor
    });
    
    onUpdate(newCoordinates);
  };

  const handleResizeStop = (e: any, direction: any, ref: any, delta: any, position: any) => {
    if (!canEdit || !onSave) return;
    
    // Save to server only when resize ends
    const newCoordinates = {
      x: Math.round(position.x / scaleFactor),
      y: Math.round(position.y / scaleFactor),
      width: Math.round(ref.offsetWidth / scaleFactor),
      height: Math.round(ref.offsetHeight / scaleFactor)
    };
    
    onSave(newCoordinates);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete();
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
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResize={handleResize}
      onResizeStop={handleResizeStop}
      enableResizing={canEdit}
      disableDragging={!canEdit}
      bounds="parent"
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        console.log('🏷️ Tag clicked in PDFViewer:', {
          tagId: tag.id,
          mode,
          isCompleted: tag.isCompleted,
          hasOnTagClick: !!onTagClick,
          canEdit,
          isSelected,
          clickDetail: e.detail
        });
        
        if (mode === 'signing' && onTagClick && !tag.isCompleted) {
          // Check if it's a double-click to open the modal
          if (e.detail === 2) {
            // Double-click: trigger interactive input for incomplete tags
            const rect = e.currentTarget.getBoundingClientRect();
            console.log('🎯 Double-click detected - triggering interactive input for tag:', tag.id);
            onTagClick(tag, {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height
            });
          } else {
            // Single-click: just select the tag
            console.log('🔗 Single-click detected - selecting tag:', tag.id);
            onSelect();
          }
        } else {
          // In tagging mode or for completed tags, just select
          console.log('🔗 Selecting tag:', tag.id, 'onSelect function:', typeof onSelect);
          onSelect();
        }
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={`
        transition-all cursor-pointer overflow-hidden
        ${isSelected ? 'ring-2 ring-blue-400 ring-opacity-60' : ''}
        ${canEdit ? 'hover:shadow-md' : ''}
      `}
      style={{
        backgroundColor: (() => {
          // Special handling for whiteout tags
          if (tag.tagType === 'W') {
            if (mode === 'signing' && tag.isCompleted) {
              return '#FFFFFF'; // Solid white background for completed whiteout
            } else if (mode === 'signing' && !tag.isCompleted) {
              return 'rgba(255, 255, 255, 0.8)'; // Semi-transparent white for incomplete whiteout
            } else {
              return 'rgba(255, 255, 255, 0.95)'; // White for tagging mode
            }
          }
          
          // Default behavior for other tags
          if (mode === 'signing' && tag.isCompleted) {
            return 'rgba(255, 255, 255, 0.1)'; // Very subtle background for completed tags
          } else if (mode === 'signing' && !tag.isCompleted) {
            return 'rgba(59, 130, 246, 0.1)'; // Blue background for incomplete/clickable
          } else {
            return 'rgba(255, 255, 255, 0.95)'; // White for tagging mode
          }
        })(),
        border: (() => {
          // Special handling for whiteout tags
          if (tag.tagType === 'W') {
            if (mode === 'signing' && tag.isCompleted) {
              return '1px solid #E5E7EB'; // Subtle border for completed whiteout
            } else if (mode === 'signing' && !tag.isCompleted) {
              return '2px dashed #6B7280'; // Gray dashed border for incomplete whiteout
            } else {
              return `2px solid ${tag.colorCode || '#6B7280'}`; // Gray border for tagging
            }
          }
          
          // Default behavior for other tags
          if (mode === 'signing' && tag.isCompleted) {
            return '1px solid rgba(156, 163, 175, 0.3)'; // Very subtle border for completed tags
          } else if (mode === 'signing' && !tag.isCompleted) {
            return '2px dashed #3b82f6'; // Dashed blue border for clickable
          } else {
            return `2px solid ${tag.colorCode || '#3B82F6'}`; // Normal border for tagging
          }
        })(),
        borderRadius: (tag.tagType === 'W' && mode === 'signing' && tag.isCompleted) ? '2px' : 
                     (mode === 'signing' && tag.isCompleted) ? '0' : '6px',
        color: mode === 'signing' && tag.isCompleted 
          ? '#000000' // Black text for completed content (plain text appearance)
          : tag.colorCode || '#3B82F6',
        zIndex: tag.tagType === 'W' ? (isSelected ? 1000 : 10) : (isSelected ? 1000 : 100), // Lower z-index for whiteout (background)
        pointerEvents: 'auto',
        cursor: mode === 'signing' && !tag.isCompleted ? 'pointer' : 'default',
        boxShadow: (() => {
          // Special shadow for whiteout tags
          if (tag.tagType === 'W') {
            if (mode === 'signing' && tag.isCompleted) {
              return '0 1px 3px rgba(0,0,0,0.1)'; // Subtle shadow for completed whiteout
            } else if (isSelected) {
              return `0 4px 12px rgba(0,0,0,0.15), 0 0 0 2px ${(tag.colorCode || '#6B7280')}20`;
            } else {
              return '0 2px 4px rgba(107, 114, 128, 0.3)'; // Gray shadow for whiteout
            }
          }
          
          // Default shadow for other tags
          if (mode === 'signing' && tag.isCompleted) {
            return '0 1px 2px rgba(0,0,0,0.05)'; // Very subtle shadow for completed tags
          } else if (isSelected) {
            return `0 4px 12px rgba(0,0,0,0.15), 0 0 0 2px ${(tag.colorCode || '#3B82F6')}20`;
          } else if (mode === 'signing' && !tag.isCompleted) {
            return '0 2px 8px rgba(59, 130, 246, 0.3)'; // Blue glow for clickable
          } else {
            return '0 2px 4px rgba(0,0,0,0.1)';
          }
        })()
      }}
      resizeHandleStyles={canEdit ? {
        bottomRight: { 
          width: '10px', 
          height: '10px', 
          backgroundColor: tag.colorCode || '#3B82F6',
          border: '2px solid white',
          borderRadius: '50%',
          right: '-5px',
          bottom: '-5px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }
      } : undefined}
    >
      <div className="w-full h-full flex flex-col items-center justify-center p-1">
        {mode === 'signing' ? (
          // Signing mode: Show interactive state
          tag.isCompleted ? (
            // Completed tag - show actual content as plain text/image OR whiteout
            tag.tagType === 'W' ? (
              // Whiteout tag: Show as solid white rectangle (no content)
              <div className="w-full h-full bg-white" />
            ) : (
              // Regular completed tag - show actual content as plain text/image
              <div className="w-full h-full flex items-center justify-center">
                {(tag.contentData || tag.content) && (() => {
                  // Parse contentData if it's a string, fallback to content with enhanced error handling
                  let contentData;
                  try {
                    if (tag.contentData) {
                      // Handle different contentData formats safely
                      if (typeof tag.contentData === 'string') {
                        try {
                          contentData = JSON.parse(tag.contentData);
                        } catch (parseError) {
                          // If JSON parsing fails, treat as raw string content
                          console.warn('📋 contentData not JSON, treating as raw string for tag', tag.id);
                          contentData = {
                            type: 'text',
                            value: tag.contentData
                          };
                        }
                      } else {
                        contentData = tag.contentData;
                      }
                      
                      console.log('📋 Parsed contentData for tag', tag.id, ':', {
                        tagType: tag.tagType,
                        contentDataType: contentData?.type || 'unknown',
                        hasValue: !!contentData?.value,
                        valueType: typeof contentData?.value,
                        valuePreview: contentData?.value && typeof contentData.value === 'string' ? 
                          contentData.value.substring(0, 100) + '...' : 
                          JSON.stringify(contentData?.value).substring(0, 100) + '...',
                        isBase64Image: typeof contentData?.value === 'string' && contentData.value.startsWith('data:image/'),
                        isVultrUrl: typeof contentData?.value === 'string' && contentData.value.includes('vultrobjects.com')
                      });
                    } else if (tag.content) {
                      contentData = {
                        type: 'text',
                        value: tag.content
                      };
                      console.log('📋 Using raw content for tag', tag.id, ':', {
                        tagType: tag.tagType,
                        contentPreview: typeof tag.content === 'string' ? tag.content.substring(0, 100) + '...' : JSON.stringify(tag.content),
                        isBase64Image: typeof tag.content === 'string' && tag.content.startsWith('data:image/'),
                        isVultrUrl: typeof tag.content === 'string' && tag.content.includes('vultrobjects.com')
                      });
                    } else {
                      contentData = { type: 'text', value: '' };
                    }
                  } catch (e) {
                    console.error('Failed to parse contentData for tag', tag.id, ':', e, 'Raw contentData:', tag.contentData);
                    // Safe fallback that won't cause runtime errors
                    const fallbackValue = (() => {
                      try {
                        if (typeof tag.content === 'string') return tag.content;
                        if (typeof tag.contentData === 'string') return tag.contentData;
                        return JSON.stringify(tag.content || tag.contentData || '');
                      } catch {
                        return '[Content parsing error]';
                      }
                    })();
                    
                    contentData = {
                      type: 'text',
                      value: fallbackValue
                    };
                  }
                  
                  // Helper function to check if contentData contains an image
                  const isImageContent = () => {
                    if (!contentData || !contentData.value) return false;
                    
                    const value = contentData.value;
                    const isSignatureType = contentData.type === 'signature' || contentData.type === 'initials' || contentData.type === 'seal';
                    const isImageUrl = (typeof value === 'string') && (
                      value.startsWith('data:image/') ||
                      value.startsWith('https://') ||
                      value.startsWith('http://') ||
                      value.includes('vultrobjects.com') ||
                      value.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)
                    );
                    
                    console.log('🔍 Image content check for tag', tag.id, ':', {
                      tagType: tag.tagType,
                      contentDataType: contentData.type,
                      isSignatureType,
                      valueType: typeof value,
                      valueLength: typeof value === 'string' ? value.length : 'not string',
                      startsWithDataImage: typeof value === 'string' && value.startsWith('data:image/'),
                      startsWithHttps: typeof value === 'string' && value.startsWith('https://'),
                      includesVultr: typeof value === 'string' && value.includes('vultrobjects.com'),
                      hasImageExtension: typeof value === 'string' && !!value.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i),
                      isImageUrl,
                      result: isSignatureType && isImageUrl
                    });
                    
                    return isSignatureType && isImageUrl;
                  };
                  
                  // If image failed to load or not image content, show text content
                  if (imageLoadError || !isImageContent()) {
                    return (
                      <div 
                        className="text-black w-full h-full flex items-center justify-center p-1"
                        style={{ 
                          fontSize: Math.max(10, Math.min(16, tag.coordinates.height * 0.6)),
                          lineHeight: '1.2',
                          wordBreak: 'break-word',
                          fontFamily: 'inherit'
                        }}
                      >
                        {/* Show actual content for completed tags, prioritizing image display for signature/seal tags */}
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
                            
                            if (isImageUrl) {
                              // For image content that failed to load, try to display as img element anyway
                              // This allows the browser's error handling to take over
                              return (
                                <img 
                                  src={value} 
                                  alt={`${tag.tagType === 'S' ? 'Signature' : tag.tagType === 'I' ? 'Initials' : 'Seal'}`}
                                  className="max-h-full max-w-full object-contain"
                                  onError={(e) => {
                                    // If image still fails, replace with a user-friendly message
                                    const img = e.target as HTMLImageElement;
                                    const parent = img.parentElement;
                                    if (parent) {
                                      parent.innerHTML = `<div class="text-center text-gray-600 text-xs">[${tag.tagType === 'S' ? 'Signature Applied' : tag.tagType === 'I' ? 'Initials Applied' : 'Seal Applied'}]</div>`;
                                    }
                                  }}
                                />
                              );
                            }
                            
                            // Filter out technical/debug data for non-image URLs only
                            if (value.includes('Algorithm=') || value.includes('Signature=') || value.includes('Expires=') || value.includes('&X-Amz-')) {
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
                    );
                  }
                  
                  // Determine the best image source from available data, handling nested objects
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

                  console.log('🎨 Rendering completed tag', tag.id, ':', {
                    tagType: tag.tagType,
                    isImageContent: isImageContent(),
                    imageUrl: getImageUrl(),
                    contentDataType: contentData?.type,
                    contentDataValue: typeof contentData?.value === 'string' 
                      ? contentData.value.substring(0, 100) + '...' 
                      : JSON.stringify(contentData?.value)
                  });

                  const imageSource = getImageUrl();
                  
                  return (
                    <img 
                      src={imageSource} 
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
                        console.error('🖼️ Image failed to load for tag:', tag.id, 'Source:', typeof imageSource === 'string' ? imageSource.substring(0, 100) + '...' : JSON.stringify(imageSource), 'ContentData:', contentData);
                        
                        // IMPROVED ERROR HANDLING: Try different approaches
                        const img = e.target as HTMLImageElement;
                        
                        // If it's a Vultr URL that might be expired, try to refresh it
                        if (imageSource.includes('vultrobjects.com') && imageSource.includes('X-Amz-Expires')) {
                          console.log('🔄 Attempting to refresh expired Vultr URL for tag:', tag.id);
                          // Remove the current error state and try to reload the tag
                          fetch(`/api/tags/${tag.id}/refresh-content`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${localStorage.getItem('token')}`,
                              'Content-Type': 'application/json'
                            }
                          }).then(response => {
                            if (response.ok) {
                              console.log('✅ Tag content refreshed, triggering page reload');
                              // Could trigger a tag refresh here
                            }
                          }).catch(err => {
                            console.error('❌ Failed to refresh tag content:', err);
                          });
                        }
                        
                        setImageLoadError(true);
                      }}
                      onLoad={() => {
                        console.log('✅ Image loaded successfully for tag:', tag.id, 'Type:', tag.tagType);
                        setImageLoadError(false); // Reset error state on successful load
                      }}
                    />
                  );
                })()}
              </div>
            )
          ) : (
            // Incomplete tag in signing mode - use SAME UI as tagging mode
            <>
              {/* Main tag content - SAME as tagging mode */}
              <div className="flex items-center gap-1">
                <span className="text-xs opacity-80">{tagInfo.icon}</span>
                <span className="text-xs font-medium truncate">{tagInfo.label}</span>
              </div>
              
              {/* User identification - extract from displayLabel - SAME as tagging mode */}
              {tag.displayLabel && tag.displayLabel.includes(' - ') && (
                <div className="flex items-center gap-1 mt-0.5 px-1 py-0.5 bg-white bg-opacity-70 rounded-full">
                  <div 
                    className="w-2 h-2 rounded-full border border-white shadow-sm" 
                    style={{ backgroundColor: tag.colorCode }}
                  />
                  <span className="text-xs font-medium opacity-90 truncate">
                    {tag.displayLabel.split(' - ')[1]?.split(' ')[0] || 'User'}
                  </span>
                </div>
              )}
              
              {/* Interaction hint for signing mode */}
              <div className="mt-0.5">
                <span className="text-xs opacity-70">
                  Double-click to {['S', 'I', 'E'].includes(tag.tagType) ? 'apply' : 'enter'}
                </span>
              </div>
            </>
          )
        ) : (
          // Tagging mode: Show tag info - SAME UI as above
          <>
            {/* Main tag content */}
            <div className="flex items-center gap-1">
              <span className="text-xs opacity-80">{tagInfo.icon}</span>
              <span className="text-xs font-medium truncate">{tagInfo.label}</span>
            </div>
            
            {/* User identification - extract from displayLabel */}
            {tag.displayLabel && tag.displayLabel.includes(' - ') && (
              <div className="flex items-center gap-1 mt-0.5 px-1 py-0.5 bg-white bg-opacity-70 rounded-full">
                <div 
                  className="w-2 h-2 rounded-full border border-white shadow-sm" 
                  style={{ backgroundColor: tag.colorCode }}
                />
                <span className="text-xs font-medium opacity-90 truncate">
                  {tag.displayLabel.split(' - ')[1]?.split(' ')[0] || 'User'}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </Rnd>
  );
};

export const PDFViewer: React.FC<PDFViewerProps> = ({
  documentUrl,
  sessionId,
  onPageLoad,
  onCoordinateClick,
  onTagClick,
  onTagResize,
  onTagDelete,
  mode = 'tagging',
  liveSessionState,
  onSetActiveUser,
  tags = [],
  selectedUser,
  onTagUpdate,
  className = '',
  textInputs,
  selectedTextInputId,
  onTextInputSelect,
  onSaveTextContent,
  onDeleteTextInput,
  onSyncUsers,
  currentUser,
  isSyncLoading = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<HTMLCanvasElement[]>([]);
  const pageContainerRefs = useRef<HTMLDivElement[]>([]);
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  const renderTasksRef = useRef<Map<number, any>>(new Map()); // Track render tasks
  
  const { 
    viewer, 
    selectedTag,
    selectedTagType,
    selectTag,
    setCurrentPage, 
    setZoomLevel,
    setScrollTop,
    mode: editorMode,
    whiteoutOverlays
  } = useEditorStore();
  
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [scaleFactors, setScaleFactors] = useState<Map<number, number>>(new Map());
  const isMountedRef = useRef<boolean>(true);

  // Determine if user can edit tags - FIXED: Properly respect canPlaceTags in all modes
  const canEditTags = useMemo(() => {
    // In both tagging and signing modes, check if user can place tags
    // This ensures signers cannot place new tags in signing mode
    const result = editorMode.canPlaceTags && (mode === 'tagging' || mode === 'signing');
    console.log('🏷️ Can edit tags calculation (FIXED):', { 
      mode, 
      canPlaceTags: editorMode.canPlaceTags, 
      editorMode: editorMode,
      result 
    });
    return result;
  }, [mode, editorMode.canPlaceTags]);

  // Load PDF document with improved error handling and redirect support
  const loadPDF = useCallback(async (url: string) => {
    try {
      console.log('📄 Starting PDF load for URL:', url);
      setLoading(true);
      setError(null);
      
      // Ensure worker is ready
      if (!isPDFWorkerReady()) {
        console.log('🔧 Initializing PDF worker...');
        initializePDFWorker();
        await new Promise(resolve => setTimeout(resolve, 200)); // Longer wait for worker
      }

      // Clean up previous loading task
      if (loadingTaskRef.current) {
        try {
          loadingTaskRef.current.destroy();
        } catch (e: any) {
          console.log('Previous task cleanup:', e?.message || 'Unknown error');
        }
        loadingTaskRef.current = null;
        await new Promise(resolve => setTimeout(resolve, 50)); // Wait for cleanup
      }
      
      // FIXED: First fetch the PDF as a blob to handle redirects properly
      let pdfData: ArrayBuffer | undefined;
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 1000; // Start with 1 second delay
      
      while (retryCount <= maxRetries) {
        try {
          console.log(`📄 Fetching PDF document... (attempt ${retryCount + 1}/${maxRetries + 1})`);
          
          // Replace token placeholder if present
          const token = localStorage.getItem('token');
          const fetchUrl = url.includes('{{TOKEN}}') ? url.replace('{{TOKEN}}', token || '') : url;
          console.log('🔗 Final fetch URL:', typeof fetchUrl === 'string' ? fetchUrl.substring(0, 100) + '...' : JSON.stringify(fetchUrl));
          
          const response = await fetch(fetchUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            credentials: 'same-origin'
          });
          
          if (!response.ok) {
            // Try to parse error response as JSON first
            let errorMessage = `HTTP error! status: ${response.status}`;
            
            // Handle specific HTTP status codes
            if (response.status === 502) {
              errorMessage = 'Server error (502): The document service is temporarily unavailable. Please try again in a few moments.';
              console.error('📄 502 Bad Gateway - backend server may be down or misconfigured');
            } else if (response.status === 404) {
              // Check if this is a JSON error response (file not ready yet)
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                console.log('📄 JSON error response:', errorData);
                
                // If Vultr is accessible but file not found, it might be uploading
                if (errorData.vultrStatus === 'accessible' && retryCount < maxRetries) {
                  console.log(`📄 File not found but Vultr is accessible, retrying in ${retryDelay * Math.pow(2, retryCount)}ms...`);
                  await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, retryCount)));
                  retryCount++;
                  continue; // Retry the request
                }
                errorMessage = errorData.message || errorData.error || 'Document not found (404)';
              } else {
                errorMessage = 'Document not found (404): The requested PDF file does not exist on the server.';
              }
            } else if (response.status === 403) {
              errorMessage = 'Access denied (403): You do not have permission to view this document.';
            } else if (response.status === 401) {
              errorMessage = 'Authentication required (401): Please log in again to access this document.';
            } else {
              try {
                const errorData = await response.json();
                if (errorData.error || errorData.message) {
                  errorMessage = errorData.message || errorData.error;
                  console.log('📄 Server error details:', errorData);
                }
              } catch (parseError) {
                // If not JSON, use status text
                errorMessage = `HTTP ${response.status}: ${response.statusText || 'Document request failed'}`;
              }
            }
            throw new Error(errorMessage);
          }
          
          // Check if response is JSON (error response) instead of PDF
          const contentType = response.headers.get('content-type');
          console.log('📄 Response content-type:', contentType);
          console.log('📄 Response headers:', Object.fromEntries(response.headers.entries()));
          
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            console.error('📄 Server returned JSON instead of PDF:', errorData);
            
            // If this is a "file not found" error and we have retries left, wait and retry
            if (errorData.error === 'Document not found' && retryCount < maxRetries) {
              console.log(`📄 Document not ready yet, retrying in ${retryDelay * Math.pow(2, retryCount)}ms...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, retryCount)));
              retryCount++;
              continue; // Retry the request
            }
            
            const errorMessage = errorData.message || errorData.error || 'Document not found on server';
            throw new Error(errorMessage);
          }
          
          // Check if response is HTML (likely an error page)
          if (contentType && contentType.includes('text/html')) {
            const htmlText = await response.text();
            console.error('📄 Server returned HTML instead of PDF. First 500 chars:', typeof htmlText === 'string' ? htmlText.substring(0, 500) : JSON.stringify(htmlText));
            throw new Error('Server returned an HTML page instead of PDF. This usually means authentication failed or the document URL is incorrect.');
          }
          
          // Get the PDF data as ArrayBuffer
          pdfData = await response.arrayBuffer();
          console.log('✅ PDF data fetched successfully, size:', pdfData.byteLength);
          
          // Check if the data starts with PDF header
          const uint8Array = new Uint8Array(pdfData);
          const header = String.fromCharCode(...Array.from(uint8Array.slice(0, 5)));
          console.log('📄 PDF header check:', header);
          
          if (header !== '%PDF-') {
            // Log first 100 bytes as text to see what we got
            const textPreview = String.fromCharCode(...Array.from(uint8Array.slice(0, Math.min(100, uint8Array.length))));
            console.error('📄 Invalid PDF header. First 100 bytes as text:', textPreview);
            
            // Check if this looks like JSON (starts with { or [)
            if (textPreview.trim().startsWith('{') || textPreview.trim().startsWith('[')) {
              try {
                const jsonError = JSON.parse(new TextDecoder().decode(uint8Array));
                console.error('📄 Received JSON error instead of PDF:', jsonError);
                
                // If file not found and we have retries, try again
                if (jsonError.error === 'Document not found' && retryCount < maxRetries) {
                  console.log(`📄 Document not ready (JSON response), retrying in ${retryDelay * Math.pow(2, retryCount)}ms...`);
                  await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, retryCount)));
                  retryCount++;
                  continue;
                }
                
                throw new Error(jsonError.message || jsonError.error || 'The server returned an error instead of the PDF file.');
              } catch (parseErr) {
                // Not valid JSON either
              }
            }
            throw new Error('The document does not appear to be a valid PDF file. The server may have returned an error page.');
          }
          
          // Validate PDF data size (basic check for corrupted/empty files)
          if (pdfData.byteLength < 1000) {
            console.warn('⚠️ PDF data seems too small:', pdfData.byteLength, 'bytes');
            
            // Try to parse as JSON to see if it's an error response
            try {
              const textData = new TextDecoder().decode(pdfData);
              const jsonError = JSON.parse(textData);
              console.error('📄 Small response is JSON error:', jsonError);
              
              // If file not found and we have retries, try again
              if (jsonError.error === 'Document not found' && retryCount < maxRetries) {
                console.log(`📄 Document not ready (small JSON), retrying in ${retryDelay * Math.pow(2, retryCount)}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, retryCount)));
                retryCount++;
                continue;
              }
              
              throw new Error(jsonError.message || jsonError.error || 'The document appears to be corrupted or empty.');
            } catch (parseErr) {
              // Not JSON, just a small/corrupted file
              throw new Error('The document appears to be corrupted or empty. Please try uploading the document again.');
            }
          }
          
          // Success! Break out of the retry loop
          break;
          
        } catch (fetchError) {
          console.error(`❌ Failed to fetch PDF (attempt ${retryCount + 1}):`, fetchError);
          
          // If this is the last retry, throw the error
          if (retryCount >= maxRetries) {
            throw fetchError;
          }
          
          // Otherwise, wait and retry with exponential backoff
          const waitTime = retryDelay * Math.pow(2, retryCount);
          console.log(`📄 Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retryCount++;
        }
      }
      
      // Load the PDF from the ArrayBuffer
      const loadingTask = pdfjsLib.getDocument({
        data: pdfData,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        verbosity: 0,
        maxImageSize: 1024 * 1024, // Limit image size
        cMapPacked: true
      });
      
      loadingTaskRef.current = loadingTask;
      console.log('📄 PDF loading task created, waiting for promise...');
      
      let pdf;
      try {
        pdf = await loadingTask.promise;
      } catch (loadError) {
        // If component is unmounted, don't throw error
        if (!isMountedRef.current) {
          console.log('📄 PDF loading cancelled - component unmounted');
          return;
        }
        throw loadError;
      }
      
      if (!isMountedRef.current) return;
      
      console.log('✅ PDF loaded successfully:', { numPages: pdf.numPages });
      setPdfDoc(pdf);
      setRenderedPages(new Set());
      setScaleFactors(new Map());
      
      useEditorStore.setState(state => ({
        viewer: {
          ...state.viewer,
          totalPages: pdf.numPages,
          currentPage: 1
        }
      }));
      
      setLoading(false);
      
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('❌ PDF load error:', err);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to load PDF';
      if (err instanceof Error) {
        if (err.message.includes('NetworkError') || err.message.includes('fetch')) {
          errorMessage = 'Network error: Unable to download PDF. Please check your connection and try again.';
        } else if (err.message.includes('Invalid PDF')) {
          errorMessage = 'Invalid PDF file. The document may be corrupted or not a valid PDF.';
        } else if (err.message.includes('Password')) {
          errorMessage = 'PDF is password protected. Please provide the password.';
        } else {
          errorMessage = `Failed to load PDF: ${err.message}`;
        }
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  }, [documentUrl]);

  // Render individual page with optimized scaling
  const renderPage = useCallback(async (pageNumber: number, forceRender = false) => {
    if (!pdfDoc || !isMountedRef.current) return;
    
    // Check if already rendered (unless force render)
    if (!forceRender && renderedPages.has(pageNumber)) return;

    // Cancel any existing render task for this page
    const existingTask = renderTasksRef.current.get(pageNumber);
    if (existingTask && typeof existingTask.cancel === 'function') {
      try {
        existingTask.cancel();
        console.log(`🚫 Cancelled existing render task for page ${pageNumber}`);
      } catch (e) {
        // Ignore cancellation errors
      }
    }
    renderTasksRef.current.delete(pageNumber);

    try {
      console.log(`🖼️  Rendering page ${pageNumber}...`);
      const page = await pdfDoc.getPage(pageNumber);
      
      // Check mount status after async operation
      if (!isMountedRef.current) return;
      
      const canvas = canvasRefs.current[pageNumber - 1];
      const pageContainer = pageContainerRefs.current[pageNumber - 1];
      
      if (!canvas || !pageContainer) {
        console.error(`❌ Missing canvas or container for page ${pageNumber}:`, { canvas: !!canvas, pageContainer: !!pageContainer });
        return;
      }

      const context = canvas.getContext('2d');
      if (!context) {
        console.error(`❌ Could not get 2D context for page ${pageNumber}`);
        return;
      }

      // Clear any existing content to prevent render conflicts
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Calculate optimal scale based on container width - improved with better fallback
      let containerWidth = containerRef.current?.clientWidth || 800;
      
      // Ensure we have a reasonable container width
      if (containerWidth < 200) {
        containerWidth = 800; // Better fallback for edge cases
        console.warn(`⚠️ Container width too small (${containerWidth}), using fallback`);
      }
      
      const viewport = page.getViewport({ scale: 1 });
      const baseScale = Math.min((containerWidth - 120) / viewport.width, 1.0); // Reduced to 1.0x max scale for better fit
      const finalScale = baseScale * viewer.zoomLevel;

      console.log(`📐 Page ${pageNumber} scale calculation:`, { containerWidth, baseScale, zoomLevel: viewer.zoomLevel, finalScale });

      // Store scale factor for coordinate conversion
      setScaleFactors(prev => new Map(prev.set(pageNumber, finalScale)));

      const scaledViewport = page.getViewport({ scale: finalScale });

      // Set canvas dimensions
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      canvas.style.width = `${scaledViewport.width}px`;
      canvas.style.height = `${scaledViewport.height}px`;

      // Set page container size for proper tag positioning
      pageContainer.style.width = `${scaledViewport.width}px`;
      pageContainer.style.height = `${scaledViewport.height}px`;

      console.log(`🎨 Canvas ${pageNumber} dimensions set:`, { width: scaledViewport.width, height: scaledViewport.height });

      // Render page with high quality
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
        intent: 'display'
      };

      // Final mount check before rendering
      if (!isMountedRef.current) return;
      
      // Create and track render task
      const renderTask = page.render(renderContext);
      renderTasksRef.current.set(pageNumber, renderTask);
      
      await renderTask.promise;
      
      // Check mount status after render completes
      if (!isMountedRef.current) return;
      
      // Remove from tracking after successful render
      renderTasksRef.current.delete(pageNumber);
      
      setRenderedPages(prev => new Set(prev.add(pageNumber)));
      onPageLoad?.(pageNumber, canvas, finalScale);
      
      console.log(`✅ Page ${pageNumber} rendered successfully`);
      
    } catch (err: any) {
      // Check if it was a cancellation
      if (err?.name === 'RenderingCancelledException') {
        console.log(`🛑 Page ${pageNumber} rendering was cancelled`);
      } else {
        console.error(`❌ Error rendering page ${pageNumber}:`, err);
      }
      // Remove from rendered set so it can be retried
      setRenderedPages(prev => {
        const newSet = new Set(prev);
        newSet.delete(pageNumber);
        return newSet;
      });
      // Clean up from tracking
      renderTasksRef.current.delete(pageNumber);
    }
  }, [pdfDoc, viewer.zoomLevel, onPageLoad]);

  // Load PDF on URL change
  useEffect(() => {
    console.log('🔗 Document URL effect triggered:', { documentUrl, hasUrl: !!documentUrl });
    if (documentUrl) {
      loadPDF(documentUrl);
    }
    return () => {
      console.log('🧹 PDFViewer cleanup triggered');
      
      // Cancel all active render tasks FIRST
      renderTasksRef.current.forEach((task, pageNumber) => {
        if (task && typeof task.cancel === 'function') {
          try {
            task.cancel();
            console.log(`🚫 Cancelled render task for page ${pageNumber} on cleanup`);
          } catch (e) {
            // Ignore cancellation errors
          }
        }
      });
      renderTasksRef.current.clear();
      
      // Destroy PDF loading task
      if (loadingTaskRef.current) {
        try {
          loadingTaskRef.current.destroy();
          console.log('🗑️ PDF loading task destroyed');
        } catch (e) {
          console.warn('⚠️ Error destroying PDF loading task:', e);
        }
      }
      
      // Set unmounted flag AFTER cleanup
      isMountedRef.current = false;
    };
  }, [documentUrl]);

  // Initial page rendering when PDF loads (OPTIMIZED with proper container timing)
  useEffect(() => {
    if (!pdfDoc) return;
    
    console.log('📖 PDF loaded, starting initial page rendering...');
    
    const renderInitialPages = async () => {
      // Check if component is still mounted
      if (!isMountedRef.current) return;
      
      // Wait for container to have proper dimensions
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts && isMountedRef.current) {
        const containerWidth = containerRef.current?.clientWidth;
        if (containerWidth && containerWidth > 100) {
          console.log(`✅ Container ready with width: ${containerWidth}px`);
          break;
        }
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 50));
        console.log(`⏳ Waiting for container dimensions, attempt ${attempts}`);
      }
      
      // Final mount check before rendering
      if (!isMountedRef.current) return;
      
      // OPTIMIZED: Render only first 2 pages initially for faster loading
      const pagesToRender = Math.min(2, pdfDoc.numPages);
      
      // Render pages in parallel for better performance
      const renderPromises = [];
      for (let i = 1; i <= pagesToRender; i++) {
        renderPromises.push(
          renderPage(i, false).catch(error => {
            console.error(`Failed to render initial page ${i}:`, error);
          })
        );
      }
      
      await Promise.all(renderPromises);
      
      // Check mount status after parallel rendering
      if (!isMountedRef.current) return;
      
      console.log(`✅ Initial ${pagesToRender} pages rendered in parallel`);
      
      // Render remaining pages in background (if any)
      if (pdfDoc.numPages > pagesToRender && isMountedRef.current) {
        setTimeout(async () => {
          for (let i = pagesToRender + 1; i <= Math.min(5, pdfDoc.numPages); i++) {
            // Check mount status before each background render
            if (!isMountedRef.current) break;
            
            try {
              await renderPage(i, false);
              await new Promise(resolve => setTimeout(resolve, 5)); // Shorter delay
            } catch (error) {
              console.error(`Failed to render background page ${i}:`, error);
            }
          }
          console.log(`✅ Background pages rendered`);
        }, 100);
      }
    };
    
    renderInitialPages();
  }, [pdfDoc, renderPage]);

  // Re-render pages on zoom change - FIXED: Cancel existing renders first
  useEffect(() => {
    if (!pdfDoc) return;
    
    console.log('🔄 Zoom changed, re-rendering all pages...');
    
    // CRITICAL FIX: Cancel ALL existing render tasks before starting new ones
    renderTasksRef.current.forEach((task, pageNumber) => {
      if (task && typeof task.cancel === 'function') {
        try {
          task.cancel();
          console.log(`🚫 Cancelled render task for page ${pageNumber} due to zoom change`);
        } catch (e) {
          // Ignore cancellation errors
        }
      }
    });
    renderTasksRef.current.clear();
    
    // Wait for cancellations to complete before starting new renders
    setTimeout(async () => {
      setRenderedPages(new Set());
      setScaleFactors(new Map());
      
      const renderAllPages = async () => {
        // Render pages sequentially to avoid concurrent canvas operations
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          // Double-check mount status
          if (!isMountedRef.current) break;
          
          try {
            await renderPage(i, true); // Force render on zoom change
            // Longer delay between renders to prevent canvas conflicts
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (error) {
            console.error(`Failed to render page ${i} during zoom:`, error);
          }
        }
        console.log('✅ All pages re-rendered after zoom change');
      };
      
      renderAllPages();
    }, 100); // Wait 100ms for cancellations to complete
    
  }, [pdfDoc, viewer.zoomLevel, renderPage]);

  // Log component state changes (debounced to prevent spam)
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log('📊 PDFViewer state update:', {
        documentUrl: documentUrl && typeof documentUrl === 'string' ? documentUrl.substring(0, 50) + '...' : JSON.stringify(documentUrl),
        pdfDocLoaded: !!pdfDoc,
        numPages: pdfDoc?.numPages,
        loading,
        error: !!error,
        canEditTags,
        tagsCount: tags.length,
        scaleFactorsSize: scaleFactors.size,
        renderedPagesSize: renderedPages.size
      });
    }, 500);
    
    return () => clearTimeout(timeout);
  }, [documentUrl, pdfDoc, loading, error, canEditTags, tags.length, scaleFactors.size, renderedPages.size]);

  // Handle canvas clicks for tag placement - SIGNER RESTRICTIONS
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('🖱️ Canvas clicked:', {
      mode,
      canEditTags,
      hasOnCoordinateClick: !!onCoordinateClick,
      editorMode: editorMode
    });
    
    // ❌ SIGNERS CANNOT PLACE NEW TAGS - Only notary/admin can click canvas to place tags
    if (!canEditTags || !onCoordinateClick) {
      console.log('❌ Canvas click blocked - signers cannot place new tags:', {
        canEditTags,
        hasOnCoordinateClick: !!onCoordinateClick,
        mode
      });
      return;
    }

    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const pageNumber = parseInt(canvas.dataset.pageNumber || '1');
    const scaleFactor = scaleFactors.get(pageNumber) || 1;
    
    // Ensure we have valid values
    if (!canvas || !rect || isNaN(pageNumber) || pageNumber <= 0 || !isFinite(scaleFactor) || scaleFactor <= 0) {
      console.error('Invalid canvas click setup:', { canvas: !!canvas, rect: !!rect, pageNumber, scaleFactor });
      return;
    }
    
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    
    // Validate mouse coordinates
    if (isNaN(canvasX) || isNaN(canvasY) || !isFinite(canvasX) || !isFinite(canvasY)) {
      console.error('Invalid mouse coordinates:', { canvasX, canvasY, clientX: event.clientX, clientY: event.clientY, rect });
      return;
    }
    
    const pdfX = canvasX / scaleFactor;
    const pdfY = canvasY / scaleFactor;
    
    // Validate calculated PDF coordinates
    if (isNaN(pdfX) || isNaN(pdfY) || !isFinite(pdfX) || !isFinite(pdfY)) {
      console.error('Invalid calculated PDF coordinates:', { pdfX, pdfY, canvasX, canvasY, scaleFactor });
      return;
    }
    
    // Get appropriate dimensions based on selected tag type using store
    const { selectedTagType, getTagDimensions } = useEditorStore.getState();
      
    if (!selectedTagType) {
      console.error('No tag type selected for placement');
      return;
    }
    
    const dimensions = getTagDimensions(selectedTagType);
    
    if (!dimensions) {
      console.error('Could not get dimensions for tag type:', selectedTagType);
      return;
    }
    
    // Position tag so mouse pointer is at bottom-left corner
    // X: Left edge starts at click point
    // Y: Bottom edge is at click point (so subtract full height)
    const finalTagX = Math.max(0, Math.round(pdfX));
    const finalTagY = Math.max(0, Math.round(pdfY - dimensions.height));
    
    const coordinates: TagCoordinates = {
      x: finalTagX,
      y: finalTagY,
      width: dimensions.width,
      height: dimensions.height,
      pageNumber
    };

    onCoordinateClick(coordinates);
  }, [canEditTags, onCoordinateClick, scaleFactors]);

  // Handle scroll tracking
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    
    setScrollTop(scrollTop);

    // Find which page center is closest to viewport center (most reliable method)
    const viewportCenter = scrollTop + containerHeight / 2;
    let currentPage = 1;
    let minDistance = Infinity;
    const pageContainers = pageContainerRefs.current;
    
    for (let i = 0; i < pageContainers.length; i++) {
      const pageContainer = pageContainers[i];
      if (!pageContainer) continue;
      
      const pageTop = pageContainer.offsetTop;
      const pageCenter = pageTop + pageContainer.offsetHeight / 2;
      const distance = Math.abs(pageCenter - viewportCenter);
      
      // Find the page whose center is closest to viewport center
      if (distance < minDistance) {
        minDistance = distance;
        currentPage = i + 1;
      }
    }
    
    if (currentPage !== viewer.currentPage) {
      setCurrentPage(currentPage);
      console.log(`📍 Page updated to: ${currentPage} (distance from center: ${minDistance.toFixed(1)}px)`);
    }
  }, [viewer.currentPage, setCurrentPage, setScrollTop]);

  // Tag event handlers
  const handleTagUpdate = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    onTagUpdate?.(tagId, coordinates);
  }, [onTagUpdate]);

  const handleTagSave = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    if (!onTagResize) return;
    
    // Find the tag to get its full coordinates
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return;
    
    // Merge partial updates with existing coordinates
    const fullCoordinates: TagCoordinates = {
      ...tag.coordinates,
      ...coordinates
    };
    
    onTagResize(tagId, fullCoordinates);
  }, [onTagResize, tags]);

  const handleTagDelete = useCallback((tagId: string) => {
    onTagDelete?.(tagId);
  }, [onTagDelete]);

  const handleTagSelect = useCallback((tag: DocumentTag) => {
    selectTag(tag.id === selectedTag?.id ? null : tag);
  }, [selectTag, selectedTag]);

  // Handle whiteout overlay updates
  const handleWhiteoutUpdate = useCallback(async (overlayId: string, coordinates: Partial<{ x: number; y: number; width: number; height: number }>) => {
    try {
      // Update local state immediately
      const { whiteoutOverlays, setWhiteoutOverlays } = useEditorStore.getState();
      const updatedOverlays = whiteoutOverlays.map(overlay => 
        overlay.id === overlayId 
          ? { ...overlay, coordinates: { ...overlay.coordinates, ...coordinates } }
          : overlay
      );
      setWhiteoutOverlays(updatedOverlays);
      
      console.log('✅ Whiteout overlay updated locally:', overlayId, coordinates);
      
      // TODO: Add backend API call to save whiteout overlay position/size
      // await fetch(`/api/editor/whiteout-overlay/${overlayId}`, { method: 'PUT', ... });
      
    } catch (error) {
      console.error('❌ Failed to update whiteout overlay:', error);
    }
  }, []);

  // Handle whiteout overlay deletion
  const handleWhiteoutDelete = useCallback(async (overlayId: string) => {
    try {
      // Remove from local state immediately
      const { deleteWhiteoutOverlay } = useEditorStore.getState();
      deleteWhiteoutOverlay(overlayId);
      
      console.log('✅ Whiteout overlay deleted locally:', overlayId);
      
      // TODO: Add backend API call to delete whiteout overlay
      // await fetch(`/api/editor/whiteout-overlay/${overlayId}`, { method: 'DELETE', ... });
      
    } catch (error) {
      console.error('❌ Failed to delete whiteout overlay:', error);
    }
  }, []);

  // Zoom controls
  const handleZoomIn = () => setZoomLevel(Math.min(viewer.zoomLevel * 1.25, 3.0));
  const handleZoomOut = () => setZoomLevel(Math.max(viewer.zoomLevel / 1.25, 0.25));
  const handleZoomReset = () => setZoomLevel(0.75);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 mb-2">Loading PDF...</p>
          <p className="text-sm text-gray-500">This may take a few seconds for large documents</p>
          <div className="mt-4 w-64 bg-gray-200 rounded-full h-2 mx-auto">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center max-w-md">
          <div className="text-red-500 text-xl mb-4 font-bold">!</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!pdfDoc) return null;

  return (
    <div className={`relative h-full flex flex-col ${className}`} style={{ maxWidth: '100%', overflow: 'hidden' }}>
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button 
              onClick={handleZoomOut} 
              className="p-2 bg-white border rounded hover:bg-gray-50 transition-colors shadow-sm"
              title="Zoom out"
            >
              −
            </button>
            <span className="min-w-16 text-center text-sm font-medium px-2">
              {Math.round(viewer.zoomLevel * 100)}%
            </span>
            <button 
              onClick={handleZoomIn} 
              className="p-2 bg-white border rounded hover:bg-gray-50 transition-colors shadow-sm"
              title="Zoom in"
            >
              +
            </button>
          </div>
          <button 
            onClick={handleZoomReset} 
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors"
            title="Reset zoom to fit"
          >
            Fit to View
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-700 bg-gray-100 px-3 py-2 rounded-lg">
            📄 Page {viewer.currentPage} of {viewer.totalPages}
            {tags.length > 0 && <span className="ml-3 text-green-600">• {tags.length} tags</span>}
          </div>
          
          {/* Sync Button - Only for notaries in signing mode */}
          {mode === 'signing' && currentUser?.userType === 'notary' && onSyncUsers && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncUsers}
              disabled={isSyncLoading}
              className="px-3 text-xs"
              title={`Sync all users to page ${viewer.currentPage || 1}`}
            >
              {isSyncLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-1">Sync to p.{viewer.currentPage || 1}</span>
            </Button>
          )}
        </div>
      </div>

      {/* PDF Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-50 py-6 px-4"
        onScroll={handleScroll}
        style={{ 
          maxWidth: '100%',
          overflowX: 'auto',
          overflowY: 'auto'
        }}
      >
        {/* PDF Pages Container */}
        <div className="w-full flex flex-col items-center space-y-6" style={{ minWidth: 'min-content' }}>
          {Array.from({ length: pdfDoc.numPages }, (_, index) => {
            const pageNumber = index + 1;
            const pageTags = tags.filter(tag => tag.coordinates.pageNumber === pageNumber);
            const scaleFactor = scaleFactors.get(pageNumber) || 1;
            
            return (
              <div key={pageNumber} className="relative">
                {/* Page label */}
                <div className="text-sm text-gray-600 font-medium mb-3 flex items-center justify-between">
                  <span>Page {pageNumber}</span>
                  {pageTags.length > 0 && (
                    <span className="text-green-600 text-xs bg-green-50 px-2 py-1 rounded-full">
                      {pageTags.length} tags
                    </span>
                  )}
                </div>
                
                {/* Page container with tags */}
                <div
                  ref={el => { if (el) pageContainerRefs.current[index] = el; }}
                  className="relative bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200"
                  style={{ 
                    display: 'inline-block',
                    maxWidth: '100%',
                    margin: '0 auto'
                  }}
                >
                  {/* PDF Canvas */}
                  <canvas
                    ref={el => { 
                      if (el && !canvasRefs.current[index]) {
                        canvasRefs.current[index] = el;
                        console.log(`🎯 Canvas ${pageNumber} created and ref set`);
                      }
                    }}
                    data-page-number={pageNumber}
                    onClick={handleCanvasClick}
                    className={`
                      block transition-all duration-200
                      ${mode === 'tagging' && canEditTags
                        ? selectedTagType === null 
                          ? 'cursor-default' // Pointer mode
                          : 'cursor-crosshair hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50' // Tag placement mode
                        : mode === 'signing'
                        ? 'cursor-default'
                        : 'cursor-default'
                      }
                    `}
                    style={{ 
                      backgroundColor: '#ffffff', // Clean white background
                      minHeight: '600px' // Ensure clickable area exists even before render
                    }}
                  />
                  
                  {/* Tags overlay */}
                  {pageTags.map(tag => {
                    // Regular tag (text tags are handled separately via textInputs)
                    return (
                      <div key={`${tag.id}-${scaleFactor}`} className="absolute top-0 left-0 w-full h-full pointer-events-none">
                        <TagRenderer
                          tag={tag}
                          scaleFactor={scaleFactor}
                          isSelected={selectedTag?.id === tag.id}
                          canEdit={canEditTags}
                          onUpdate={(coords) => handleTagUpdate(tag.id, coords)}
                          onSave={(coords) => handleTagSave(tag.id, coords)}
                          onDelete={() => handleTagDelete(tag.id)}
                          onSelect={() => handleTagSelect(tag)}
                          onTagClick={onTagClick}
                          mode={mode}
                        />
                      </div>
                    );
                  })}
                  
                  {/* Whiteout overlays (render over content) */}
                  {whiteoutOverlays?.filter(overlay => 
                    overlay.coordinates.pageNumber === pageNumber
                  ).map(overlay => (
                    <Rnd
                      key={`whiteout-${overlay.id}`}
                      size={{
                        width: overlay.coordinates.width * scaleFactor,
                        height: overlay.coordinates.height * scaleFactor
                      }}
                      position={{
                        x: overlay.coordinates.x * scaleFactor,
                        y: overlay.coordinates.y * scaleFactor
                      }}
                      onDragStop={(e, data) => {
                        const newCoordinates = {
                          x: Math.round(data.x / scaleFactor),
                          y: Math.round(data.y / scaleFactor)
                        };
                        handleWhiteoutUpdate(overlay.id, newCoordinates);
                      }}
                      onResizeStop={(e, direction, ref, delta, position) => {
                        const newCoordinates = {
                          x: Math.round(position.x / scaleFactor),
                          y: Math.round(position.y / scaleFactor),
                          width: Math.round(ref.offsetWidth / scaleFactor),
                          height: Math.round(ref.offsetHeight / scaleFactor)
                        };
                        handleWhiteoutUpdate(overlay.id, newCoordinates);
                      }}
                      enableResizing={canEditTags}
                      disableDragging={!canEditTags}
                      bounds="parent"
                      minWidth={20 * scaleFactor}
                      minHeight={10 * scaleFactor}
                      style={{
                        zIndex: 500, // Higher than tags but lower than selected elements
                      }}
                      resizeHandleStyles={canEditTags ? {
                        bottomRight: { 
                          width: '8px', 
                          height: '8px', 
                          backgroundColor: '#6B7280',
                          border: '2px solid white',
                          borderRadius: '50%',
                          right: '-4px',
                          bottom: '-4px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }
                      } : undefined}
                    >
                      <div
                        className="w-full h-full"
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E5E7EB',
                          borderRadius: '2px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          cursor: canEditTags ? 'move' : 'default'
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Delete' || e.key === 'Backspace') {
                            e.preventDefault();
                            handleWhiteoutDelete(overlay.id);
                          }
                        }}
                        tabIndex={0}
                      />
                    </Rnd>
                  ))}

                  {/* Text inputs overlay (separate from regular tags) */}
                  {textInputs?.filter(textInput => textInput.coordinates.pageNumber === pageNumber).map((textInput) => {
                    // Always use coordinate-based stable key to prevent unmount/remount during ID transition
                    const stableKey = `text-stable-${textInput.coordinates.x}-${textInput.coordinates.y}-${textInput.coordinates.pageNumber}-${scaleFactor}`;
                    
                    return (
                    <div key={stableKey} className="absolute top-0 left-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                      <StreamlinedTextInput
                        id={textInput.id}
                        coordinates={textInput.coordinates}
                        sessionId={sessionId || ''}
                        content={textInput.content}
                        fontSize={textInput.fontSize}
                        fontFamily={textInput.fontFamily}
                        textColor={textInput.textColor}
                        assignedUserId={textInput.assignedUserId}
                        userColor={textInput.userColor}
                        isNew={textInput.isNew}
                        isSelected={selectedTextInputId === textInput.id}
                        scaleFactor={scaleFactor}
                        onSave={(content) => {
                          onSaveTextContent?.(textInput.id, content);
                        }}
                        onDelete={() => {
                          onDeleteTextInput?.(textInput.id);
                        }}
                        onSelect={() => {
                          onTextInputSelect?.(textInput.id);
                        }}
                        onMove={() => {}}
                        onResize={(newCoordinates) => {
                          // Handle text tag resize - could call parent resize handler or update directly
                          console.log('Text tag resized:', newCoordinates);
                        }}
                      />
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;