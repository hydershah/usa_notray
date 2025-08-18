import { useCallback, useEffect, useRef } from 'react';
import { useOptimizedTagOperations } from './useOptimizedTagOperations';
import { useEnhancedWebSocket } from './useEnhancedWebSocket';
import { useEditorStore } from './useEditorStore';
import type { DocumentTag, TagCoordinates } from '@/types/editor';

interface OptimizedPDFEditorConfig {
  sessionId: string;
  currentUserId: string;
  mode: 'tagging' | 'signing' | 'notary';
}

/**
 * Main integration hook that replaces the heavy API operations in your existing editor
 * with optimized local updates + WebSocket broadcasts + batched persistence
 */
export const useOptimizedPDFEditor = ({
  sessionId,
  currentUserId,
  mode
}: OptimizedPDFEditorConfig) => {
  
  const updateTag = useEditorStore(state => state.updateTag);
  const addTag = useEditorStore(state => state.addTag);
  const deleteTag = useEditorStore(state => state.deleteTag);

  // Enhanced WebSocket for real-time collaboration
  const webSocket = useEnhancedWebSocket({
    sessionId,
    currentUserId,
    onTagUpdate: (tagId, updates) => {
      console.log('📨 Received WebSocket tag update:', tagId, updates);
      updateTag(tagId, updates);
    },
    onTagCreate: (tag) => {
      console.log('📨 Received WebSocket tag creation:', tag);
      addTag(tag);
    },
    onTagDelete: (tagId) => {
      console.log('📨 Received WebSocket tag deletion:', tagId);
      deleteTag(tagId);
    }
  });

  // Optimized tag operations with batching
  const tagOperations = useOptimizedTagOperations({
    sessionId,
    webSocket,
    onLocalUpdate: (tagId, updates) => {
      // Local state update for immediate UI response
      updateTag(tagId, updates);
    }
  });

  // REPLACE YOUR EXISTING TAG UPDATE FUNCTIONS WITH THESE:

  /**
   * Replaces: updateTagPosition, updateTagSize, saveTagUpdate
   * Usage: Call this during drag/resize operations
   */
  const handleTagDragResize = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    // This provides instant UI feedback + WebSocket broadcast + batched persistence
    tagOperations.handleDragUpdate(tagId, coordinates);
  }, [tagOperations]);

  /**
   * Replaces: updateTagFontSize with API calls
   * Usage: Call this for font size changes
   */
  const handleFontSizeChange = useCallback((tagId: string, fontSize: number) => {
    tagOperations.handleFontSizeUpdate(tagId, fontSize);
  }, [tagOperations]);

  /**
   * Replaces: handleTagContentSave with immediate API calls
   * Usage: Call this when tag content is updated (signatures, text, etc)
   */
  const handleContentUpdate = useCallback((tagId: string, content: string, contentType: string = 'text') => {
    tagOperations.handleContentUpdate(tagId, content, contentType);
  }, [tagOperations]);

  /**
   * Replaces: placeTag with immediate API calls
   * Usage: Call this when placing new tags
   */
  const handleTagCreation = useCallback(async (tagData: Omit<DocumentTag, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTag = await tagOperations.createTag(tagData);
    
    // Broadcast to other users via WebSocket
    webSocket.broadcastTagCreation(newTag);
    
    return newTag;
  }, [tagOperations, webSocket]);

  /**
   * Replaces: deleteTag with immediate API calls
   * Usage: Call this when deleting tags
   */
  const handleTagDeletion = useCallback((tagId: string) => {
    // Remove from local state immediately
    deleteTag(tagId);
    
    // Broadcast deletion
    webSocket.broadcastTagDeletion(tagId);
    
    // Note: Actual database deletion will be handled by batch operations
  }, [deleteTag, webSocket]);

  /**
   * Force immediate save of all pending changes
   * Usage: Call this before session completion or navigation
   */
  const saveAllChanges = useCallback(async () => {
    console.log('💾 Forcing immediate save of all pending changes...');
    await tagOperations.flushPendingUpdates();
  }, [tagOperations]);

  /**
   * Text input specific handler for real-time updates
   */
  const handleTextInputUpdate = useCallback((textInputId: string, coordinates: TagCoordinates) => {
    // Broadcast text input changes via WebSocket
    webSocket.broadcastTextInputUpdate(textInputId, coordinates);
  }, [webSocket]);

  // Auto-save before component unmount or page unload
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      if (tagOperations.hasPendingUpdates()) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        
        // Try to save changes quickly
        try {
          await tagOperations.flushPendingUpdates();
        } catch (error) {
          console.error('Failed to save changes before unload:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Cleanup on unmount
      tagOperations.cleanup();
      webSocket.cleanup();
    };
  }, [tagOperations, webSocket]);

  // Session completion handler
  const completeSession = useCallback(async () => {
    try {
      // First, save all pending changes
      await saveAllChanges();
      
      // Then call the session completion API
      const response = await fetch(`/api/editor/session/${sessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ force: false })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Failed to complete session');
      }

      console.log('✅ Session completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to complete session:', error);
      throw error;
    }
  }, [saveAllChanges, sessionId]);

  return {
    // WebSocket state
    isConnected: webSocket.isConnected,
    isReady: webSocket.isReady,
    
    // Optimized handlers - these replace your existing heavy API functions
    handleTagDragResize,     // Replaces: updateTagPosition, updateTagSize, saveTagUpdate
    handleFontSizeChange,    // Replaces: updateTagFontSize
    handleContentUpdate,     // Replaces: handleTagContentSave
    handleTagCreation,       // Replaces: placeTag
    handleTagDeletion,       // Replaces: deleteTag
    handleTextInputUpdate,   // For text input real-time updates
    
    // Session management
    saveAllChanges,          // Force save all pending changes
    completeSession,         // Complete session with auto-save
    
    // Utility
    hasPendingUpdates: tagOperations.hasPendingUpdates,
    
    // WebSocket instance for compatibility with existing code
    webSocketInstance: webSocket.webSocketInstance
  };
};