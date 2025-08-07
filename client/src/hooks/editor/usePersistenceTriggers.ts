import { useCallback, useEffect, useRef } from 'react';
import { useBatchAPIManager } from './useBatchAPIManager';

/**
 * PersistenceTriggers: Event-driven system to trigger API calls at the right moments
 * Based on reactive programming patterns for optimal performance
 */

interface PersistenceConfig {
  sessionId: string;
  autoSaveInterval?: number;
  sessionSafetyInterval?: number;
}

interface TagState {
  tagId: string;
  coordinates?: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  content?: string;
  lastModified: number;
  lastPersisted: number;
  isModified: boolean;
}

export const usePersistenceTriggers = (config: PersistenceConfig) => {
  const { sessionId, autoSaveInterval = 30000, sessionSafetyInterval = 60000 } = config;
  
  // State tracking
  const tagStates = useRef<Map<string, TagState>>(new Map());
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const sessionSafetyTimer = useRef<NodeJS.Timeout | null>(null);
  const lastUnmountSave = useRef<number>(0);
  const UNMOUNT_SAVE_DEBOUNCE = 5000; // Prevent multiple unmount saves within 5 seconds
  
  // Batch API manager
  const batchAPI = useBatchAPIManager({ sessionId });
  
  // Update tag state when changes occur
  const updateTagState = useCallback((
    tagId: string,
    updates: Partial<Pick<TagState, 'coordinates' | 'content'>>
  ) => {
    const currentState = tagStates.current.get(tagId) || {
      tagId,
      lastModified: 0,
      lastPersisted: 0,
      isModified: false
    };
    
    const newState: TagState = {
      ...currentState,
      ...updates,
      lastModified: Date.now(),
      isModified: true
    };
    
    tagStates.current.set(tagId, newState);
    console.log(`📝 Tag state updated: ${tagId}`);
  }, []);
  
  // Mark tag as persisted
  const markTagPersisted = useCallback((tagId: string) => {
    const state = tagStates.current.get(tagId);
    if (state) {
      tagStates.current.set(tagId, {
        ...state,
        lastPersisted: Date.now(),
        isModified: false
      });
    }
  }, []);
  
  // Get modified tags that need persistence
  const getModifiedTags = useCallback(() => {
    return Array.from(tagStates.current.values()).filter(state => state.isModified);
  }, []);
  
  // TRIGGER 1: Interaction End (drag stop, resize stop)
  const onInteractionEnd = useCallback((
    tagId: string,
    finalCoordinates: { x: number; y: number; width?: number; height?: number }
  ) => {
    console.log(`🎯 Interaction ended: ${tagId}`);
    
    // Update state
    updateTagState(tagId, { coordinates: finalCoordinates });
    
    // Queue for persistence with normal priority
    batchAPI.queueCoordinateUpdate(tagId, finalCoordinates, 'normal', 'interaction_end');
    
    // Mark as will be persisted soon
    setTimeout(() => markTagPersisted(tagId), 3000);
  }, [updateTagState, batchAPI, markTagPersisted]);
  
  // TRIGGER 2: Content Change Complete (text input blur)
  const onContentChangeComplete = useCallback((tagId: string, finalContent: string) => {
    console.log(`📝 Content change completed: ${tagId}`);
    
    // Update state
    updateTagState(tagId, { content: finalContent });
    
    // Queue for persistence with normal priority
    batchAPI.queueContentUpdate(tagId, finalContent, 'normal', 'content_complete');
    
    // Mark as will be persisted soon
    setTimeout(() => markTagPersisted(tagId), 3000);
  }, [updateTagState, batchAPI, markTagPersisted]);
  
  // TRIGGER 3: Auto-save during long interactions
  const triggerAutoSave = useCallback(() => {
    const modifiedTags = getModifiedTags();
    
    if (modifiedTags.length > 0) {
      console.log(`⏰ Auto-save triggered: ${modifiedTags.length} modified tags`);
      
      modifiedTags.forEach(tagState => {
        if (tagState.coordinates) {
          batchAPI.queueCoordinateUpdate(
            tagState.tagId,
            tagState.coordinates,
            'normal',
            'auto_save'
          );
        }
        if (tagState.content !== undefined) {
          batchAPI.queueContentUpdate(
            tagState.tagId,
            tagState.content,
            'normal',
            'auto_save'
          );
        }
      });
      
      // Mark all as will be persisted
      setTimeout(() => {
        modifiedTags.forEach(tagState => markTagPersisted(tagState.tagId));
      }, 3000);
    }
  }, [getModifiedTags, batchAPI, markTagPersisted]);
  
  // TRIGGER 4: Session safety events (critical)
  const onSessionCriticalEvent = useCallback((reason: string) => {
    const modifiedTags = getModifiedTags();
    
    if (modifiedTags.length > 0) {
      console.log(`🚨 Critical save triggered by ${reason}: ${modifiedTags.length} tags`);
      
      modifiedTags.forEach(tagState => {
        if (tagState.coordinates) {
          batchAPI.queueCoordinateUpdate(
            tagState.tagId,
            tagState.coordinates,
            'critical',
            `critical_${reason}`
          );
        }
        if (tagState.content !== undefined) {
          batchAPI.queueContentUpdate(
            tagState.tagId,
            tagState.content,
            'critical',
            `critical_${reason}`
          );
        }
      });
    }
  }, [getModifiedTags, batchAPI]);
  
  // TRIGGER 5: Page visibility change
  const onVisibilityChange = useCallback(() => {
    if (document.hidden) {
      onSessionCriticalEvent('page_hidden');
    }
  }, [onSessionCriticalEvent]);
  
  // TRIGGER 6: Before page unload
  const onBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    const modifiedTags = getModifiedTags();
    
    if (modifiedTags.length > 0) {
      onSessionCriticalEvent('page_unload');
      
      // Show warning if there are unsaved changes
      event.preventDefault();
      event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return event.returnValue;
    }
  }, [getModifiedTags, onSessionCriticalEvent]);
  
  // Setup auto-save timer
  useEffect(() => {
    autoSaveTimer.current = setInterval(triggerAutoSave, autoSaveInterval);
    
    return () => {
      if (autoSaveTimer.current) {
        clearInterval(autoSaveTimer.current);
      }
    };
  }, [triggerAutoSave, autoSaveInterval]);
  
  // Setup session safety timer
  useEffect(() => {
    sessionSafetyTimer.current = setInterval(() => {
      onSessionCriticalEvent('session_safety');
    }, sessionSafetyInterval);
    
    return () => {
      if (sessionSafetyTimer.current) {
        clearInterval(sessionSafetyTimer.current);
      }
    };
  }, [onSessionCriticalEvent, sessionSafetyInterval]);
  
  // Setup page event listeners
  useEffect(() => {
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [onVisibilityChange, onBeforeUnload]);
  
  // Cleanup on unmount - with debouncing to prevent excessive saves
  useEffect(() => {
    return () => {
      const now = Date.now();
      const modifiedTags = Array.from(tagStates.current.values()).filter(state => state.isModified);
      
      // Only save if:
      // 1. There are actually modified tags
      // 2. Enough time has passed since last unmount save (debouncing)
      if (modifiedTags.length > 0 && (now - lastUnmountSave.current) > UNMOUNT_SAVE_DEBOUNCE) {
        lastUnmountSave.current = now;
        console.log(`🚨 Final save on component unmount: ${modifiedTags.length} modified tags`);
        
        // Trigger the save directly without going through onSessionCriticalEvent
        // to have more control over the process
        modifiedTags.forEach(tagState => {
          if (tagState.coordinates) {
            batchAPI.queueCoordinateUpdate(
              tagState.tagId,
              tagState.coordinates,
              'critical',
              'critical_component_unmount'
            );
          }
          if (tagState.content !== undefined) {
            batchAPI.queueContentUpdate(
              tagState.tagId,
              tagState.content,
              'critical',
              'critical_component_unmount'
            );
          }
        });
      } else if (modifiedTags.length === 0) {
        console.log('✅ Component unmount: No modified tags to save');
      } else {
        console.log(`⚡ Component unmount save skipped: Debounced (last save ${now - lastUnmountSave.current}ms ago)`);
      }
    };
  }, [batchAPI]); // Removed onSessionCriticalEvent dependency to avoid recreating effect
  
  return {
    // Core trigger methods
    onInteractionEnd,
    onContentChangeComplete,
    onSessionCriticalEvent,
    
    // State management
    updateTagState,
    markTagPersisted,
    getModifiedTags,
    
    // Manual triggers
    triggerAutoSave,
    
    // Statistics
    getStats: () => ({
      modifiedTagCount: getModifiedTags().length,
      totalTrackedTags: tagStates.current.size,
      batchAPIStats: batchAPI.getStats()
    })
  };
};

export default usePersistenceTriggers;