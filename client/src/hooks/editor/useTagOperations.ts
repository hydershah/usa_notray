import { useCallback, useRef, useState, useEffect } from 'react';
import { useEditorStore } from './useEditorStore';
import type { PlaceTagCommand, DocumentTag, TagCoordinates } from '../../types/editor';
import { getTagLabel } from '../../lib/utils/tagUtils';

// Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T & { cancel: () => void; flush: () => void } {
  let timeout: NodeJS.Timeout | null = null;
  let result: any;

  const debounced = (...args: Parameters<T>) => {
    const later = () => {
      timeout = null;
      result = func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    return result;
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  debounced.flush = () => {
    if (timeout) {
      clearTimeout(timeout);
      result = func();
      timeout = null;
    }
    return result;
  };

  return debounced as T & { cancel: () => void; flush: () => void };
}

interface TagOperation {
  type: 'place' | 'update' | 'delete';
  tagId?: string;
  data: any;
  timestamp: number;
}

// Coordinate validation utility
const validateCoordinates = (coordinates: Partial<TagCoordinates>): boolean => {
  const { x, y, width, height } = coordinates;
  
  // Check for NaN, undefined, or invalid values
  if (x !== undefined && (isNaN(x) || !isFinite(x))) return false;
  if (y !== undefined && (isNaN(y) || !isFinite(y))) return false;
  if (width !== undefined && (isNaN(width) || !isFinite(width) || width <= 0)) return false;
  if (height !== undefined && (isNaN(height) || !isFinite(height) || height <= 0)) return false;
  
  return true;
};

export const useTagOperations = (sessionId: string, webSocket?: any) => {
  // 🔍 DEBUG: Log session ID to identify incorrect usage
  useEffect(() => {
    console.log('🔍 useTagOperations initialized with sessionId:', sessionId);
    if (/^\d+$/.test(sessionId)) {
      console.error('❌ useTagOperations received job ID instead of session ID!', sessionId);
      console.trace('❌ Hook instantiation stack trace');
    }
  }, [sessionId]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const pendingOperations = useRef<TagOperation[]>([]);
  
  const {
    addTag,
    updateTag,
    deleteTag: removeTagFromStore,
    selectedUser,
    currentDocument,
    setCustomTagDimensions,
    getTagDimensions,
    tags
  } = useEditorStore();

  // Sanitize coordinates to ensure valid values
  const sanitizeCoordinates = (coordinates: Partial<TagCoordinates>, tagType?: string): Partial<TagCoordinates> => {
    const sanitized: Partial<TagCoordinates> = {};
    
    // Reduce noisy logs in production
    const isDevLoggingEnabled = typeof window !== 'undefined' && (window as any).__DEBUG_EDITOR__;
    if (isDevLoggingEnabled) {
      console.log('🔍 sanitizeCoordinates - tagType:', tagType, 'type:', typeof tagType);
    }
    
    // Get dimensions from store (includes custom dimensions if set by user)
    const storeDimensions = getTagDimensions(tagType as any);
    if (isDevLoggingEnabled) {
      console.log('🔍 sanitizeCoordinates - storeDimensions:', storeDimensions);
    }
    
    const defaultDimensions = storeDimensions || {
      width: 60, // Use smaller standardized width as fallback
      height: 18  // Use smaller standardized height as fallback
    };

    // Derive minimums if available; fall back to 18 for height and 24 for width
    // Special case: whiteout overlays ('W') should allow 1px height/width
    const isWhiteout = tagType === 'W';
    const minWidth = isWhiteout ? 1 : (storeDimensions as any)?.minWidth ?? 24;
    const minHeight = isWhiteout ? 1 : (storeDimensions as any)?.minHeight ?? 18;
    
    if (coordinates.x !== undefined) {
      sanitized.x = isFinite(coordinates.x) ? Math.round(coordinates.x) : 0;
    }
    if (coordinates.y !== undefined) {
      sanitized.y = isFinite(coordinates.y) ? Math.round(coordinates.y) : 0;
    }
    if (coordinates.width !== undefined) {
      const w = isFinite(coordinates.width) && coordinates.width > 0 ? Math.round(coordinates.width) : defaultDimensions.width;
      sanitized.width = Math.max(w, minWidth);
    }
    if (coordinates.height !== undefined) {
      const h = isFinite(coordinates.height) && coordinates.height > 0 ? Math.round(coordinates.height) : defaultDimensions.height;
      sanitized.height = Math.max(h, minHeight);
    }
    if (coordinates.pageNumber !== undefined) {
      sanitized.pageNumber = isFinite(coordinates.pageNumber) ? Math.round(coordinates.pageNumber) : 1;
    }
    
    return sanitized;
  };

  // Debounced individual save to existing single-tag endpoints
  const debouncedSave = useRef(
    debounce(async (operation: TagOperation) => {
      if (!operation) return;

      setIsProcessing(true);
      
      try {
        switch (operation.type) {
          case 'place':
            await savePlaceTag(operation);
            break;
          case 'update':
            await saveUpdateTag(operation);
            break;
          case 'delete':
            await saveDeleteTag(operation);
            break;
        }
        console.log(`✅ Saved ${operation.type} operation`);
      } catch (error) {
        console.error(`❌ Failed to save ${operation.type} operation:`, error);
        
        // Handle rollback for failed operations
        if (operation.type === 'place' && operation.data.tempTagId) {
          // Remove the optimistic tag if placement failed
          removeTagFromStore(operation.data.tempTagId);
          console.log(`🔄 Rolled back failed tag placement: ${operation.data.tempTagId}`);
        }
        
        // Show user-friendly error
        if (error instanceof Error && error.message.includes('temporary tag')) {
          console.warn('Attempted operation on temporary tag - ignoring');
        } else {
          // You might want to show a toast notification here
          console.error('Tag operation failed:', error);
        }
      } finally {
        setIsProcessing(false);
      }
    }, 300) // 🔧 FIX: Increased from 100ms to 300ms to prevent rapid-fire updates
  ).current;

  // Single tag place API call with better error handling
  const savePlaceTag = async (operation: TagOperation) => {
    // 🔒 GUARD: Prevent API calls with job ID instead of session ID
    if (/^\d+$/.test(sessionId)) {
      console.error('❌ Attempting to use job ID as session ID in API call:', sessionId);
      throw new Error(`Invalid session ID: ${sessionId}. This appears to be a job ID, not a session ID.`);
    }
    
    const response = await fetch(`/api/editor/session/${sessionId}/place-tag`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Cache-Control': 'no-cache' // Prevent caching issues
      },
      body: JSON.stringify(operation.data)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Place tag failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Replace the temporary tag with the server-generated one
    if (operation.data.tempTagId && result.tag) {
      removeTagFromStore(operation.data.tempTagId);
      addTag({
        ...result.tag,
        // Ensure the tag has proper typing and required fields
        id: result.tag.id.toString(),
        sessionId: result.tag.sessionId.toString(),
        documentId: result.tag.documentId.toString()
      });
      console.log(`✅ Replaced temp tag ${operation.data.tempTagId} with server tag ${result.tag.id}`);
    }

    return result;
  };

  // Single tag update API call
  const saveUpdateTag = async (operation: TagOperation) => {
    // Skip if it's a temporary tag
    if (operation.tagId && operation.tagId.startsWith('temp_')) {
      console.warn('Skipping save for temporary tag:', operation.tagId);
      return;
    }

    // 🔒 GUARD: Prevent API calls with job ID instead of session ID
    if (/^\d+$/.test(sessionId)) {
      console.error('❌ Attempting to use job ID as session ID in saveUpdateTag:', sessionId);
      throw new Error(`Invalid session ID: ${sessionId}. This appears to be a job ID, not a session ID.`);
    }

    const response = await fetch(`/api/editor/session/${sessionId}/tag/${operation.tagId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(operation.data)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Update tag failed: ${response.statusText}`);
    }

    return response.json();
  };

  // Single tag delete API call
  const saveDeleteTag = async (operation: TagOperation) => {
    // Skip if it's a temporary tag
    if (operation.tagId && operation.tagId.startsWith('temp_')) {
      console.warn('Skipping delete for temporary tag:', operation.tagId);
      return;
    }

    // 🔒 GUARD: Prevent API calls with job ID instead of session ID
    if (/^\d+$/.test(sessionId)) {
      console.error('❌ Attempting to use job ID as session ID in saveDeleteTag:', sessionId);
      throw new Error(`Invalid session ID: ${sessionId}. This appears to be a job ID, not a session ID.`);
    }

    const response = await fetch(`/api/editor/session/${sessionId}/tag/${operation.tagId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Delete tag failed: ${response.statusText}`);
    }

    return response.json();
  };

  // Process queued operations
  const processPendingOperations = useCallback(async () => {
    if (pendingOperations.current.length === 0 || isProcessing) return;

    setIsProcessing(true);
    const operations = [...pendingOperations.current];
    pendingOperations.current = [];

    try {
      for (const operation of operations) {
        console.log('🔄 Processing tag operation:', operation.type, operation.tagId?.substring(0, 8));
        
        switch (operation.type) {
          case 'place':
            const { documentId, tagType, coordinates, assignedUserId, tempTagId } = operation.data;
            
            // Validate and sanitize coordinates before sending
            if (!validateCoordinates(coordinates)) {
              console.error('❌ Invalid coordinates for place operation:', coordinates);
              continue;
            }
            
            const sanitizedPlaceCoordinates = sanitizeCoordinates(coordinates, tagType);
            
            // 🔒 GUARD: Prevent API calls with job ID instead of session ID
            if (/^\d+$/.test(sessionId)) {
              console.error('❌ Attempting to use job ID as session ID in processPendingOperations place:', sessionId);
              throw new Error(`Invalid session ID: ${sessionId}. This appears to be a job ID, not a session ID.`);
            }
            
            const response = await fetch(`/api/editor/session/${sessionId}/place-tag`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                documentId,
                tagType,
                coordinates: sanitizedPlaceCoordinates,
                assignedUserId
              })
            });

            if (!response.ok) {
              throw new Error(`Failed to place tag: ${response.statusText}`);
            }

            const { tag: serverTag } = await response.json();
            
            // Replace optimistic tag with server response
            if (tempTagId) {
              updateTag(tempTagId, serverTag);
            }
            break;

          case 'update':
            const { tagId: updateTagId, coordinates: updateCoordinates } = operation.data;
            
            if (!validateCoordinates(updateCoordinates)) {
              console.error('❌ Invalid coordinates for update operation:', updateCoordinates);
              continue;
            }
            
            const tagForUpdate = useEditorStore.getState().tags.find(t => t.id === updateTagId);
            const sanitizedUpdateCoordinates = sanitizeCoordinates(updateCoordinates, tagForUpdate?.tagType);
            
            // 🔒 GUARD: Prevent API calls with job ID instead of session ID
            if (/^\d+$/.test(sessionId)) {
              console.error('❌ Attempting to use job ID as session ID in processPendingOperations update:', sessionId);
              throw new Error(`Invalid session ID: ${sessionId}. This appears to be a job ID, not a session ID.`);
            }
            
            const updateResponse = await fetch(`/api/editor/session/${sessionId}/tag/${updateTagId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                coordinates: sanitizedUpdateCoordinates
              })
            });

            if (!updateResponse.ok) {
              throw new Error(`Failed to update tag: ${updateResponse.statusText}`);
            }
            break;

          case 'delete':
            if (!operation.tagId) continue;
            
            // 🔒 GUARD: Prevent API calls with job ID instead of session ID
            if (/^\d+$/.test(sessionId)) {
              console.error('❌ Attempting to use job ID as session ID in processPendingOperations delete:', sessionId);
              throw new Error(`Invalid session ID: ${sessionId}. This appears to be a job ID, not a session ID.`);
            }
            
            const deleteResponse = await fetch(`/api/editor/session/${sessionId}/tag/${operation.tagId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            });

            if (!deleteResponse.ok) {
              throw new Error(`Failed to delete tag: ${deleteResponse.statusText}`);
            }
            break;
        }
      }
      
      console.log('✅ All tag operations processed successfully');
    } catch (error) {
      console.error('❌ Error processing tag operations:', error);
      // TODO: Add error recovery logic
    } finally {
      setIsProcessing(false);
    }
  }, [sessionId, isProcessing, updateTag]);

  // Place tag with optimistic update
  const placeTag = useCallback(async (command: PlaceTagCommand) => {
    console.log('🎯 placeTag called with command:', {
      tagType: command.tagType,
      tagTypeType: typeof command.tagType,
      documentId: command.documentId,
      coordinates: command.coordinates,
      assignedUserId: command.assignedUserId
    });
    
    if (!selectedUser || !currentDocument) {
      console.error('❌ Missing user or document selection:', {
        selectedUser: !!selectedUser,
        currentDocument: !!currentDocument
      });
      throw new Error('Missing user or document selection');
    }

    // Validate coordinates before proceeding
    if (!validateCoordinates(command.coordinates)) {
      console.error('❌ Invalid coordinates for tag placement:', command.coordinates);
      throw new Error('Invalid tag coordinates');
    }

    const sanitizedCoordinates = sanitizeCoordinates(command.coordinates, command.tagType);

    // Create optimistic tag for immediate UI feedback
    const tempTagId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const optimisticTag: DocumentTag = {
      id: tempTagId,
      sessionId,
      documentId: command.documentId,
      tagType: command.tagType,
      assignedUserId: command.assignedUserId || selectedUser.userId,
      coordinates: sanitizedCoordinates as TagCoordinates,
      displayLabel: `${getTagLabel(command.tagType)} - ${selectedUser.displayName}`,
      colorCode: selectedUser.colorCode || '#4ECDC4',
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add to store immediately for instant feedback
    addTag(optimisticTag);

    // 🚀 REAL-TIME SYNC: Broadcast tag placement to all participants
    if (webSocket && webSocket.tagPlaced) {
      try {
        if (typeof window !== 'undefined' && (window as any).__DEBUG_EDITOR__) {
          console.log('📡 Broadcasting tag placement via WebSocket:', {
            tagId: tempTagId,
            tagType: command.tagType,
            coordinates: sanitizedCoordinates
          });
        }
        
        webSocket.tagPlaced(optimisticTag);
        
        if (typeof window !== 'undefined' && (window as any).__DEBUG_EDITOR__) {
          console.log('✅ Tag placement broadcasted successfully');
        }
      } catch (wsError) {
        console.warn('⚠️ Failed to broadcast tag placement via WebSocket:', wsError);
      }
    }

    // Queue operation for save
    const operation: TagOperation = {
      type: 'place',
      data: {
        documentId: command.documentId,
        tagType: command.tagType,
        coordinates: sanitizedCoordinates,
        assignedUserId: command.assignedUserId || selectedUser.userId,
        tempTagId
      },
      timestamp: Date.now()
    };

    // Save to server with debounce
    debouncedSave(operation);
  }, [sessionId, selectedUser, currentDocument, addTag]);

  // Update tag position with optimistic update - NO SERVER CALL DURING DRAG
  const updateTagPosition = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    // Validate coordinates before updating
    if (!validateCoordinates(coordinates)) {
      console.error('❌ Invalid coordinates for position update:', coordinates);
      return;
    }
    
    // Use tagType if available to improve sanitation precision
    const tag = tags.find(t => t.id === tagId);
    const sanitizedCoordinates = sanitizeCoordinates(coordinates, tag?.tagType);
    
    // Update store immediately for smooth UX
    updateTag(tagId, { coordinates: sanitizedCoordinates as TagCoordinates });
    
    // Only save to server on mouse up / drag end
    // This will be called by the TagRenderer on dragStop
  }, [updateTag, tags]);

  // Update tag size with optimistic update - NO SERVER CALL DURING RESIZE
  const updateTagSize = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    // Validate coordinates before updating
    if (!validateCoordinates(coordinates)) {
      console.error('❌ Invalid coordinates for size update:', coordinates);
      return;
    }
    
    const tag = tags.find(t => t.id === tagId);
    const sanitizedCoordinates = sanitizeCoordinates(coordinates, tag?.tagType);
    
    // Update store immediately for smooth UX
    updateTag(tagId, { coordinates: sanitizedCoordinates as TagCoordinates });
    
    // Only save to server on resize end
    // This will be called by the TagRenderer on resizeStop
  }, [updateTag, tags]);

  // Save tag position/size to server (called only on drag/resize END)
  const saveTagUpdate = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    // Validate coordinates before saving
    if (!validateCoordinates(coordinates)) {
      console.error('❌ Invalid coordinates for save update:', coordinates);
      return;
    }
    
    const tag = tags.find(t => t.id === tagId);
    const sanitizedCoordinates = sanitizeCoordinates(coordinates, tag?.tagType);
    
    // If dimensions are being updated, save them as custom dimensions for this tag type
    if (coordinates.width !== undefined && coordinates.height !== undefined) {
      if (tag) {
        if (typeof window !== 'undefined' && (window as any).__DEBUG_EDITOR__) {
          console.log(`💾 Saving custom dimensions for tag type ${tag.tagType}: ${coordinates.width}x${coordinates.height}`);
        }
        setCustomTagDimensions(tag.tagType, {
          width: coordinates.width,
          height: coordinates.height
        });
      }
    }
    
    const operation: TagOperation = {
      type: 'update',
      tagId,
      data: { coordinates: sanitizedCoordinates as TagCoordinates },
      timestamp: Date.now()
    };

    // 🚀 REAL-TIME SYNC: Server will broadcast when it processes the API call
    // No need for client-side WebSocket broadcast as it can cause conflicts

    // Save to server with debounce
    debouncedSave(operation);
  }, [tags, setCustomTagDimensions]);

  // Delete tag with optimistic update
  const deleteTag = useCallback((tagId: string) => {
    // Remove from store immediately
    removeTagFromStore(tagId);

    // 🚀 REAL-TIME SYNC: Broadcast tag deletion to all participants
    if (webSocket && webSocket.tagDeleted) {
      try {
        console.log('📡 Broadcasting tag deletion via WebSocket:', { tagId });
        
        webSocket.tagDeleted(tagId);
        
        console.log('✅ Tag deletion broadcasted successfully');
      } catch (wsError) {
        console.warn('⚠️ Failed to broadcast tag deletion via WebSocket:', wsError);
      }
    }

    // Queue operation for save
    const operation: TagOperation = {
      type: 'delete',
      tagId,
      data: {},
      timestamp: Date.now()
    };

    // Save to server with debounce
    debouncedSave(operation);
  }, [removeTagFromStore]);

  // Force immediate save (e.g., on session completion)
  const batchSaveChanges = useCallback(async () => {
    // Cancel debounced save and process immediately
    debouncedSave.cancel();
    
    // For now, just mark as processing complete since individual saves handle persistence
    setIsProcessing(false);
  }, []);

  // Place whiteout overlay (immediate white rectangle, no tag creation)
  const placeWhiteoutOverlay = useCallback(async (request: {
    documentId: string;
    coordinates: TagCoordinates;
    sessionId: string;
  }) => {
    try {
      console.log('⬜ Creating whiteout overlay:', request);

      // Validate coordinates
      if (!validateCoordinates(request.coordinates)) {
        throw new Error('Invalid coordinates for whiteout overlay');
      }

      const sanitizedCoordinates = sanitizeCoordinates(request.coordinates, 'W');

      // Create optimistic whiteout tag for immediate UI feedback
      const tempId = `temp_whiteout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const colorCode = (useEditorStore.getState().selectedUser?.colorCode) || '#e5e7eb';
      const displayName = (useEditorStore.getState().selectedUser?.displayName) || 'User';

      const optimisticWhiteoutTag: DocumentTag = {
        id: tempId,
        sessionId,
        documentId: request.documentId,
        tagType: 'W',
        assignedUserId: useEditorStore.getState().selectedUser?.userId,
        coordinates: sanitizedCoordinates as TagCoordinates,
        displayLabel: '',
        colorCode,
        isCompleted: true,
        content: '',
        contentType: 'whiteout',
        contentData: { type: 'whiteout', value: '' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add optimistic tag to store so it renders immediately
      addTag(optimisticWhiteoutTag);

      // Broadcast via websocket (optional)
      if (webSocket && webSocket.tagPlaced) {
        try {
          webSocket.tagPlaced(optimisticWhiteoutTag);
        } catch (wsError) {
          console.warn('⚠️ Failed to broadcast whiteout placement via WebSocket:', wsError);
        }
      }

      // 🔒 GUARD: Prevent API calls with job ID instead of session ID
      if (/^\d+$/.test(sessionId)) {
        console.error('❌ Attempting to use job ID as session ID in placeWhiteoutOverlay:', sessionId);
        throw new Error(`Invalid session ID: ${sessionId}. This appears to be a job ID, not a session ID.`);
      }
      
      // Save to backend
      const response = await fetch(`/api/editor/session/${sessionId}/whiteout-overlay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          documentId: request.documentId,
          coordinates: sanitizedCoordinates,
          sessionId: request.sessionId
        })
      });

      if (!response.ok) {
        // Rollback optimistic tag on failure
        removeTagFromStore(tempId);
        throw new Error('Failed to save whiteout overlay to server');
      }

      const result = await response.json();
      const overlay = result.overlay;

      // Replace optimistic tag with server-confirmed whiteout tag
      removeTagFromStore(tempId);

      const finalWhiteoutTag: DocumentTag = {
        id: overlay.id.toString(),
        sessionId,
        documentId: overlay.documentId.toString(),
        tagType: 'W',
        assignedUserId: useEditorStore.getState().selectedUser?.userId,
        coordinates: overlay.coordinates as TagCoordinates,
        displayLabel: '',
        colorCode,
        isCompleted: true,
        content: '',
        contentType: 'whiteout',
        contentData: { type: 'whiteout', value: '' },
        createdAt: new Date(overlay.createdAt),
        updatedAt: new Date(overlay.createdAt)
      };

      addTag(finalWhiteoutTag);
      console.log('✅ Whiteout overlay placed and rendered as tag:', finalWhiteoutTag.id);

    } catch (error) {
      console.error('❌ Failed to place whiteout overlay:', error);
      throw error;
    }
  }, [sessionId, addTag, removeTagFromStore, webSocket]);

  // Update whiteout overlay position/size
  const updateWhiteoutOverlay = useCallback((overlayId: string, coordinates: Partial<TagCoordinates>) => {
    // Validate coordinates before updating
    if (!validateCoordinates(coordinates)) {
      console.error('❌ Invalid coordinates for whiteout overlay update:', coordinates);
      return;
    }
    
    const sanitizedCoordinates = sanitizeCoordinates(coordinates, 'W');
    
    // Update store immediately for smooth UX
    useEditorStore.getState().updateWhiteoutOverlay(overlayId, { coordinates: sanitizedCoordinates as TagCoordinates });
    
    // Save to server
    const operation: TagOperation = {
      type: 'update',
      tagId: overlayId,
      data: { coordinates: sanitizedCoordinates },
      timestamp: Date.now()
    };
    
    debouncedSave(operation);
  }, []);

  // Delete whiteout overlay
  const deleteWhiteoutOverlay = useCallback((overlayId: string) => {
    // Remove from store immediately
    useEditorStore.getState().deleteWhiteoutOverlay(overlayId);
    
    // Save to server
    const operation: TagOperation = {
      type: 'delete',
      tagId: overlayId,
      data: {},
      timestamp: Date.now()
    };
    
    debouncedSave(operation);
  }, []);

  return {
    placeTag,
    updateTagPosition,
    updateTagSize,
    saveTagUpdate, // New method for explicit save after drag/resize
    deleteTag,
    batchSaveChanges,
    isProcessing,
    placeWhiteoutOverlay,
    updateWhiteoutOverlay,
    deleteWhiteoutOverlay
  };
}; 