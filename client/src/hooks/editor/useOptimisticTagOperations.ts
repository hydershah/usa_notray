import { useCallback, useState, useRef } from 'react';
import { useEditorStore } from './useEditorStore';
import { DocumentTag, TagCoordinates, TagType } from '../../types/editor';
import { useToast } from '../use-toast';

interface PendingUpdate {
  tagId: string;
  originalData: Partial<DocumentTag>;
  pendingData: Partial<DocumentTag>;
  timestamp: number;
  retryCount: number;
}

interface UseOptimisticTagOperationsReturn {
  placeTagOptimistic: (data: {
    documentId: string;
    tagType: TagType;
    coordinates: TagCoordinates;
    assignedUserId: string;
  }) => Promise<void>;
  updateTagOptimistic: (tagId: string, updates: Partial<DocumentTag>) => Promise<void>;
  deleteTagOptimistic: (tagId: string) => Promise<void>;
  isTagUpdating: (tagId: string) => boolean;
  pendingUpdatesCount: number;
}

export const useOptimisticTagOperations = (sessionId: string): UseOptimisticTagOperationsReturn => {
  const { tags, setTags, addTag, updateTag, removeTag } = useEditorStore();
  const { toast } = useToast();
  
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, PendingUpdate>>(new Map());
  const timeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Debounced save function
  const debouncedSave = useCallback((tagId: string, updates: Partial<DocumentTag>, delay = 1000) => {
    // Clear existing timeout
    const existingTimeout = timeoutRef.current.get(tagId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      try {
        await saveToServer(tagId, updates);
        // Remove from pending updates on success
        setPendingUpdates(prev => {
          const newMap = new Map(prev);
          newMap.delete(tagId);
          return newMap;
        });
        timeoutRef.current.delete(tagId);
      } catch (error) {
        // Handle save error
        handleSaveError(tagId, error);
      }
    }, delay);

    timeoutRef.current.set(tagId, timeout);
  }, []);

  // Save to server function
  const saveToServer = async (tagId: string, updates: Partial<DocumentTag>) => {
    const response = await fetch(`/api/editor/session/${sessionId}/tag/${tagId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error(`Failed to update tag: ${response.statusText}`);
    }

    return response.json();
  };

  // Handle save errors
  const handleSaveError = useCallback((tagId: string, error: any) => {
    const pending = pendingUpdates.get(tagId);
    if (!pending) return;

    // Retry logic
    if (pending.retryCount < 3) {
      setPendingUpdates(prev => {
        const newMap = new Map(prev);
        const updated = { ...pending, retryCount: pending.retryCount + 1 };
        newMap.set(tagId, updated);
        return newMap;
      });

      // Retry with exponential backoff
      const delay = Math.pow(2, pending.retryCount) * 1000;
      debouncedSave(tagId, pending.pendingData, delay);
    } else {
      // Max retries reached, revert changes
      const tag = tags.find(t => t.id === tagId);
      if (tag && pending.originalData) {
        updateTag(tagId, pending.originalData);
      }

      setPendingUpdates(prev => {
        const newMap = new Map(prev);
        newMap.delete(tagId);
        return newMap;
      });

      toast({
        title: "Save Failed",
        description: "Failed to save tag changes after multiple attempts. Changes have been reverted.",
        variant: "destructive"
      });
    }
  }, [pendingUpdates, tags, updateTag, toast, debouncedSave]);

  // Place tag with optimistic update
  const placeTagOptimistic = useCallback(async (data: {
    documentId: string;
    tagType: TagType;
    coordinates: TagCoordinates;
    assignedUserId: string;
  }) => {
    // Generate temporary ID
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create optimistic tag
    const optimisticTag: DocumentTag = {
      id: tempId,
      sessionId,
      documentId: data.documentId,
      tagType: data.tagType,
      assignedUserId: data.assignedUserId,
      coordinates: data.coordinates,
      displayLabel: `${data.tagType}_${tempId}`,
      colorCode: '#3B82F6', // Default blue
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add to store immediately
    addTag(optimisticTag);

    // Track as pending
    setPendingUpdates(prev => {
      const newMap = new Map(prev);
      newMap.set(tempId, {
        tagId: tempId,
        originalData: {},
        pendingData: optimisticTag,
        timestamp: Date.now(),
        retryCount: 0
      });
      return newMap;
    });

    try {
      // Save to server
      const response = await fetch(`/api/editor/session/${sessionId}/place-tag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Failed to place tag: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Replace temporary tag with server response
      removeTag(tempId);
      if (result.tag) {
        addTag(result.tag);
      }

      // Remove from pending
      setPendingUpdates(prev => {
        const newMap = new Map(prev);
        newMap.delete(tempId);
        return newMap;
      });

    } catch (error) {
      // Remove optimistic tag on error
      removeTag(tempId);
      setPendingUpdates(prev => {
        const newMap = new Map(prev);
        newMap.delete(tempId);
        return newMap;
      });

      toast({
        title: "Failed to Place Tag",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    }
  }, [sessionId, addTag, removeTag, toast]);

  // Update tag with optimistic update
  const updateTagOptimistic = useCallback(async (tagId: string, updates: Partial<DocumentTag>) => {
    const currentTag = tags.find(t => t.id === tagId);
    if (!currentTag) return;

    // Store original data if not already pending
    let originalData = pendingUpdates.get(tagId)?.originalData || {};
    if (!pendingUpdates.has(tagId)) {
      originalData = { ...currentTag };
    }

    // Apply updates immediately
    updateTag(tagId, updates);

    // Track as pending
    setPendingUpdates(prev => {
      const newMap = new Map(prev);
      newMap.set(tagId, {
        tagId,
        originalData,
        pendingData: { ...currentTag, ...updates },
        timestamp: Date.now(),
        retryCount: 0
      });
      return newMap;
    });

    // Debounced save
    debouncedSave(tagId, updates);
  }, [tags, updateTag, pendingUpdates, debouncedSave]);

  // Delete tag with optimistic update
  const deleteTagOptimistic = useCallback(async (tagId: string) => {
    const currentTag = tags.find(t => t.id === tagId);
    if (!currentTag) return;

    // Remove immediately
    removeTag(tagId);

    try {
      const response = await fetch(`/api/editor/session/${sessionId}/tag/${tagId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete tag: ${response.statusText}`);
      }
    } catch (error) {
      // Restore tag on error
      addTag(currentTag);
      
      toast({
        title: "Failed to Delete Tag",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    }
  }, [tags, removeTag, addTag, sessionId, toast]);

  // Check if tag is currently updating
  const isTagUpdating = useCallback((tagId: string) => {
    return pendingUpdates.has(tagId);
  }, [pendingUpdates]);

  return {
    placeTagOptimistic,
    updateTagOptimistic,
    deleteTagOptimistic,
    isTagUpdating,
    pendingUpdatesCount: pendingUpdates.size
  };
}; 