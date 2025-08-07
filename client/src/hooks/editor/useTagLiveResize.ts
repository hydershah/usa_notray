// client/src/hooks/editor/useTagLiveResize.ts
import { useCallback, useRef, useState } from 'react';
import { useLiveUXManager } from './useLiveUXManager';
import { usePersistenceTriggers } from './usePersistenceTriggers';

interface TagCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber?: number;
}

interface TagLiveResizeProps {
  sessionId: string;
  webSocket: WebSocket | WebSocketConnection | null;
  onLocalTagUpdate: (tagId: string, coordinates: Partial<TagCoordinates>) => void;
}

// Type for WebSocketConnection (matching the interface from useWebSocket)
interface WebSocketConnection {
  sendMessage: (message: any) => boolean;
  webSocketInstance: WebSocket | null;
  isConnected: boolean;
  isReady: boolean;
}

/**
 * New Event-Driven Tag Resize System
 * 
 * Replaces the old API-heavy resize logic with:
 * - Instant local updates during resize (no API calls)
 * - WebSocket broadcasts for live collaboration
 * - Strategic persistence only on interaction end
 * 
 * Based on React resize best practices and Google Docs performance patterns
 */
export const useTagLiveResize = ({ sessionId, webSocket, onLocalTagUpdate }: TagLiveResizeProps) => {
  const [isResizing, setIsResizing] = useState<Set<string>>(new Set());
  const resizeStartCoords = useRef<Map<string, TagCoordinates>>(new Map());
  
  // NEW: Event-driven managers for optimal performance
  const liveUX = useLiveUXManager({
    sessionId,
    webSocket,
    onLocalStateUpdate: (tagId, updates) => {
      if (updates.coordinates) {
        onLocalTagUpdate(tagId, updates.coordinates);
      }
    }
  });
  
  const persistenceTriggers = usePersistenceTriggers({ sessionId });
  
  // Live resize handler - NO API calls, only local updates
  const handleTagResize = useCallback((
    tagId: string, 
    coordinates: Partial<TagCoordinates>,
    isDuringResize: boolean = true
  ) => {
    try {
      if (isDuringResize) {
        // During resize: Only local updates + WebSocket broadcast
        liveUX.handleResize(tagId, coordinates);
        console.log(`🎮 Live tag resize: ${tagId}`, coordinates);
      } else {
        // After resize: Trigger strategic persistence
        liveUX.endInteraction(tagId);
        persistenceTriggers.onInteractionEnd(tagId, coordinates as TagCoordinates);
        console.log(`✅ Tag resize completed: ${tagId}`, coordinates);
      }
    } catch (error) {
      console.error('❌ Tag resize failed:', error);
    }
  }, [liveUX, persistenceTriggers]);
  
  // Handle resize start - mark tag as actively resizing
  const handleResizeStart = useCallback((tagId: string, initialCoordinates: TagCoordinates) => {
    setIsResizing(prev => new Set(prev).add(tagId));
    resizeStartCoords.current.set(tagId, initialCoordinates);
    console.log(`🎯 Tag resize started: ${tagId}`);
  }, []);
  
  // Handle resize stop - trigger strategic persistence
  const handleResizeStop = useCallback((tagId: string, finalCoordinates: TagCoordinates) => {
    setIsResizing(prev => {
      const next = new Set(prev);
      next.delete(tagId);
      return next;
    });
    
    const startCoords = resizeStartCoords.current.get(tagId);
    resizeStartCoords.current.delete(tagId);
    
    // Only trigger persistence if coordinates actually changed
    if (startCoords) {
      const hasChanged = 
        startCoords.x !== finalCoordinates.x ||
        startCoords.y !== finalCoordinates.y ||
        startCoords.width !== finalCoordinates.width ||
        startCoords.height !== finalCoordinates.height;
        
      if (hasChanged) {
        handleTagResize(tagId, finalCoordinates, false);
      }
    }
    
    console.log(`🏁 Tag resize stopped: ${tagId}`, finalCoordinates);
  }, [handleTagResize]);
  
  // Font size change handler (for text tags)
  const handleFontSizeChange = useCallback((tagId: string, fontSize: number) => {
    // Font size changes trigger immediate persistence since they're less frequent
    persistenceTriggers.updateTagState(tagId, { fontSize });
    persistenceTriggers.triggerAutoSave();
    console.log(`🎨 Font size changed: ${tagId} - ${fontSize}px`);
  }, [persistenceTriggers]);
  
  // Check if tag is currently being resized
  const isTagResizing = useCallback((tagId: string) => {
    return isResizing.has(tagId);
  }, [isResizing]);
  
  return {
    handleTagResize,
    handleResizeStart,
    handleResizeStop,
    handleFontSizeChange,
    isTagResizing,
    // Expose managers for advanced use cases
    liveUX,
    persistenceTriggers
  };
};