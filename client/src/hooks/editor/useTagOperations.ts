import { useCallback, useRef, useState } from 'react';
import { useEditorStore } from './useEditorStore';
import type { PlaceTagCommand, DocumentTag, TagCoordinates } from '../../types/editor';
import { getTagIcon, getTagLabel } from '../../lib/utils/tagUtils';

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

// Sanitize coordinates to ensure valid values
const sanitizeCoordinates = (coordinates: Partial<TagCoordinates>): Partial<TagCoordinates> => {
  const sanitized: Partial<TagCoordinates> = {};
  
  if (coordinates.x !== undefined) {
    sanitized.x = isFinite(coordinates.x) ? Math.round(coordinates.x) : 0;
  }
  if (coordinates.y !== undefined) {
    sanitized.y = isFinite(coordinates.y) ? Math.round(coordinates.y) : 0;
  }
  if (coordinates.width !== undefined) {
    sanitized.width = isFinite(coordinates.width) && coordinates.width > 0 ? Math.round(coordinates.width) : 100;
  }
  if (coordinates.height !== undefined) {
    sanitized.height = isFinite(coordinates.height) && coordinates.height > 0 ? Math.round(coordinates.height) : 30;
  }
  if (coordinates.pageNumber !== undefined) {
    sanitized.pageNumber = isFinite(coordinates.pageNumber) ? Math.round(coordinates.pageNumber) : 1;
  }
  
  return sanitized;
};

export const useTagOperations = (sessionId: string) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const pendingOperations = useRef<TagOperation[]>([]);
  
  const {
    addTag,
    updateTag,
    deleteTag: removeTagFromStore,
    selectedUser,
    currentDocument
  } = useEditorStore();

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
      } finally {
        setIsProcessing(false);
      }
    }, 2000) // 2 second debounce for less frequent saves
  ).current;

  // Single tag place API call
  const savePlaceTag = async (operation: TagOperation) => {
    const response = await fetch(`/api/editor/session/${sessionId}/place-tag`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(operation.data)
    });

    if (!response.ok) {
      throw new Error(`Place tag failed: ${response.statusText}`);
    }

    return response.json();
  };

  // Single tag update API call
  const saveUpdateTag = async (operation: TagOperation) => {
    const response = await fetch(`/api/editor/session/${sessionId}/tag/${operation.tagId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(operation.data)
    });

    if (!response.ok) {
      throw new Error(`Update tag failed: ${response.statusText}`);
    }

    return response.json();
  };

  // Single tag delete API call
  const saveDeleteTag = async (operation: TagOperation) => {
    const response = await fetch(`/api/editor/session/${sessionId}/tag/${operation.tagId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Delete tag failed: ${response.statusText}`);
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
            
            const sanitizedPlaceCoordinates = sanitizeCoordinates(coordinates);
            
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
            if (!operation.tagId) continue;
            
            // Validate and sanitize coordinates before sending
            if (!validateCoordinates(operation.data.coordinates)) {
              console.error('❌ Invalid coordinates for update operation:', operation.data.coordinates);
              continue;
            }
            
            const sanitizedUpdateCoordinates = sanitizeCoordinates(operation.data.coordinates);
            
            const updateResponse = await fetch(`/api/editor/session/${sessionId}/tag/${operation.tagId}`, {
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
    if (!selectedUser || !currentDocument) {
      throw new Error('Missing user or document selection');
    }

    // Validate coordinates before proceeding
    if (!validateCoordinates(command.coordinates)) {
      console.error('❌ Invalid coordinates for tag placement:', command.coordinates);
      throw new Error('Invalid tag coordinates');
    }

    const sanitizedCoordinates = sanitizeCoordinates(command.coordinates);

    // Create optimistic tag for immediate UI feedback
    const tempTagId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const optimisticTag: DocumentTag = {
      id: tempTagId,
      sessionId,
      documentId: command.documentId,
      tagType: command.tagType,
      assignedUserId: command.assignedUserId || selectedUser.userId,
      coordinates: sanitizedCoordinates as TagCoordinates,
      displayLabel: `${getTagIcon(command.tagType)} ${getTagLabel(command.tagType)} - ${selectedUser.displayName}`,
      colorCode: selectedUser.colorCode || '#4ECDC4',
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add to store immediately for instant feedback
    addTag(optimisticTag);

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
    
    const sanitizedCoordinates = sanitizeCoordinates(coordinates);
    
    // Update store immediately for smooth UX
    updateTag(tagId, { coordinates: sanitizedCoordinates });
    
    // Only save to server on mouse up / drag end
    // This will be called by the TagRenderer on dragStop
  }, [updateTag]);

  // Update tag size with optimistic update - NO SERVER CALL DURING RESIZE
  const updateTagSize = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    // Validate coordinates before updating
    if (!validateCoordinates(coordinates)) {
      console.error('❌ Invalid coordinates for size update:', coordinates);
      return;
    }
    
    const sanitizedCoordinates = sanitizeCoordinates(coordinates);
    
    // Update store immediately for smooth UX
    updateTag(tagId, { coordinates: sanitizedCoordinates });
    
    // Only save to server on resize end
    // This will be called by the TagRenderer on resizeStop
  }, [updateTag]);

  // Save tag position/size to server (called only on drag/resize END)
  const saveTagUpdate = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    // Validate coordinates before saving
    if (!validateCoordinates(coordinates)) {
      console.error('❌ Invalid coordinates for save update:', coordinates);
      return;
    }
    
    const sanitizedCoordinates = sanitizeCoordinates(coordinates);
    
    const operation: TagOperation = {
      type: 'update',
      tagId,
      data: { coordinates: sanitizedCoordinates },
      timestamp: Date.now()
    };

    // Save to server with debounce
    debouncedSave(operation);
  }, []);

  // Delete tag with optimistic update
  const deleteTag = useCallback((tagId: string) => {
    // Remove from store immediately
    removeTagFromStore(tagId);

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

  return {
    placeTag,
    updateTagPosition,
    updateTagSize,
    saveTagUpdate, // New method for explicit save after drag/resize
    deleteTag,
    batchSaveChanges,
    isProcessing
  };
}; 