import { useCallback, useRef } from 'react';
import { debounce } from 'lodash';
import { useEditorStore } from '../../../client/src/hooks/editor/useEditorStore';
import type { DocumentTag, TagCoordinates } from '../../../client/src/types/editor';
import type { WebSocketConnection } from '../../../client/src/hooks/editor/useWebSocket';

interface OptimizedTagOperationsConfig {
  sessionId: string;
  webSocket?: WebSocketConnection | null;
  onLocalUpdate?: (tagId: string, updates: Partial<DocumentTag>) => void;
}

export const useOptimizedTagOperations = ({
  sessionId,
  webSocket,
  onLocalUpdate
}: OptimizedTagOperationsConfig) => {
  
  // Batching system for accumulated changes
  const pendingUpdates = useRef<Map<string, Partial<DocumentTag>>>(new Map());
  const pendingCreations = useRef<DocumentTag[]>([]);
  
  // Debounced persistence - only save to server after user stops interactions
  const debouncedPersistence = useRef(
    debounce(async () => {
      if (pendingUpdates.current.size === 0 && pendingCreations.current.length === 0) {
        return;
      }

      try {
        const updates = Array.from(pendingUpdates.current.entries()).map(([tagId, changes]) => ({
          tagId,
          changes
        }));

        const creations = [...pendingCreations.current];

        // Clear pending operations before API call
        pendingUpdates.current.clear();
        pendingCreations.current = [];

        // Batch API call for all accumulated changes
        if (updates.length > 0 || creations.length > 0) {
          const response = await fetch(`/api/editor/session/${sessionId}/tags/batch-update`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              updates,
              creations,
              timestamp: Date.now()
            })
          });

          if (!response.ok) {
            throw new Error('Failed to save batch updates');
          }

          console.log('✅ Batch updates saved successfully:', { updates: updates.length, creations: creations.length });
        }
      } catch (error) {
        console.error('❌ Failed to save batch updates:', error);
        // Could implement retry logic here
      }
    }, 1000) // Save 1 second after user stops interacting
  );

  // Immediate local update with WebSocket broadcast (no API call)
  const updateTagImmediate = useCallback((tagId: string, updates: Partial<DocumentTag>) => {
    // 1. Update local state immediately for instant UI response
    useEditorStore.getState().updateTag(tagId, updates);
    onLocalUpdate?.(tagId, updates);
    
    // Mark as active operation if it's a position update
    if (updates.coordinates) {
      useEditorStore.getState().setActiveOperation(tagId, { type: 'update', timestamp: Date.now() });
    }

    // 2. Broadcast via WebSocket for real-time collaboration
    if (webSocket?.isConnected && webSocket?.isReady) {
      const message = {
        type: 'tag_update_live',
        payload: {
          tagId,
          updates,
          sessionId,
          timestamp: Date.now()
        }
      };

      try {
        webSocket.webSocketInstance?.send(JSON.stringify(message));
        console.log('📡 Live tag update broadcasted');
      } catch (error) {
        console.warn('⚠️ Failed to broadcast live update:', error);
      }
    }

    // 3. Accumulate changes for later batch persistence
    const existing = pendingUpdates.current.get(tagId) || {};
    pendingUpdates.current.set(tagId, { ...existing, ...updates });

    // 4. Trigger debounced save
    debouncedPersistence.current();
  }, [sessionId, webSocket, onLocalUpdate]);

  // Optimized drag handler - no API calls, just local + WebSocket
  const handleDragUpdate = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    // Mark as drag operation for conflict resolution
    useEditorStore.getState().setActiveOperation(tagId, { type: 'drag', timestamp: Date.now() });
    updateTagImmediate(tagId, { coordinates: coordinates as TagCoordinates });
  }, [updateTagImmediate]);

  // Optimized resize handler - no API calls, just local + WebSocket  
  const handleResizeUpdate = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    updateTagImmediate(tagId, { coordinates: coordinates as TagCoordinates });
  }, [updateTagImmediate]);

  // Font size updates with immediate local feedback
  const handleFontSizeUpdate = useCallback((tagId: string, fontSize: number) => {
    const contentData = { fontSize };
    updateTagImmediate(tagId, { 
      contentData: JSON.stringify(contentData),
      updatedAt: new Date()
    });
  }, [updateTagImmediate]);

  // Content updates (for modals, signatures, etc)
  const handleContentUpdate = useCallback((tagId: string, content: string, contentType: string = 'text') => {
    updateTagImmediate(tagId, {
      content,
      contentType,
      isCompleted: true,
      updatedAt: new Date()
    });
  }, [updateTagImmediate]);

  // Tag creation with optimistic updates
  const createTag = useCallback(async (tagData: Omit<DocumentTag, 'id' | 'createdAt' | 'updatedAt'>) => {
    // Generate temporary ID for immediate UI response
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const tempTag: DocumentTag = {
      ...tagData,
      id: tempId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 1. Add to local state immediately
    useEditorStore.getState().addTag(tempTag);
    
    // Mark as active to prevent server override during initial placement
    useEditorStore.getState().setActiveOperation(tempId, { type: 'update', timestamp: Date.now() });

    // 2. Broadcast creation via WebSocket
    if (webSocket?.isConnected && webSocket?.isReady) {
      const message = {
        type: 'tag_created_live',
        payload: {
          tag: tempTag,
          sessionId,
          timestamp: Date.now()
        }
      };

      try {
        webSocket.webSocketInstance?.send(JSON.stringify(message));
        console.log('📡 Live tag creation broadcasted');
      } catch (error) {
        console.warn('⚠️ Failed to broadcast tag creation:', error);
      }
    }

    // 3. Add to pending creations for batch persistence
    pendingCreations.current.push(tempTag);
    debouncedPersistence.current();

    return tempTag;
  }, [sessionId, webSocket]);

  // Force immediate save (for session completion, etc)
  const flushPendingUpdates = useCallback(async () => {
    debouncedPersistence.current.flush();
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    debouncedPersistence.current.cancel();
    pendingUpdates.current.clear();
    pendingCreations.current = [];
  }, []);

  return {
    // Optimized handlers - no immediate API calls
    handleDragUpdate,
    handleResizeUpdate, 
    handleFontSizeUpdate,
    handleContentUpdate,
    createTag,
    
    // Utility functions
    flushPendingUpdates,
    cleanup,
    
    // State accessors
    hasPendingUpdates: () => pendingUpdates.current.size > 0 || pendingCreations.current.length > 0
  };
};