import { useCallback, useRef, useEffect } from 'react';

/**
 * LiveUXManager: Handles instant local updates without API calls
 * Based on event-driven communication patterns for smooth UX
 */

interface LiveUpdateEvent {
  type: 'drag' | 'resize' | 'content_change';
  tagId: string;
  coordinates?: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  content?: string;
  timestamp: number;
  isTransient: boolean;
}

interface LiveUXConfig {
  sessionId: string;
  webSocket?: WebSocket | WebSocketConnection | null;
  onLocalStateUpdate: (tagId: string, updates: any) => void;
}

// Type guard to check if webSocket is a WebSocketConnection
const isWebSocketConnection = (ws: any): ws is WebSocketConnection => {
  return ws && typeof ws.sendMessage === 'function' && ws.webSocketInstance;
}

// Type for WebSocketConnection (matching the interface from useWebSocket)
interface WebSocketConnection {
  sendMessage: (message: any) => boolean;
  webSocketInstance: WebSocket | null;
  isConnected: boolean;
  isReady: boolean;
}

export const useLiveUXManager = (config: LiveUXConfig) => {
  const { sessionId, webSocket, onLocalStateUpdate } = config;
  
  // Track active interactions to prevent unnecessary updates
  const activeInteractions = useRef<Set<string>>(new Set());
  const interactionTimestamps = useRef<Map<string, number>>(new Map());
  
  // Live update handler - NO API calls, just local state + WebSocket
  const handleLiveUpdate = useCallback((event: LiveUpdateEvent) => {
    const { tagId, coordinates, content, type } = event;
    
    // 1. Update local state immediately for smooth UX
    const updates: any = {};
    if (coordinates) {
      updates.coordinates = coordinates;
    }
    if (content !== undefined) {
      updates.content = content;
    }
    
    onLocalStateUpdate(tagId, updates);
    
    // 2. Track interaction state
    activeInteractions.current.add(tagId);
    interactionTimestamps.current.set(tagId, Date.now());
    
    // 3. Broadcast to other users via WebSocket (no API call)
    if (webSocket) {
      const message = {
        type: 'live_update',
        payload: {
          sessionId,
          tagId,
          updateType: type,
          coordinates,
          content,
          isTransient: true,
          timestamp: Date.now()
        }
      };
      
      try {
        let sent = false;
        
        if (isWebSocketConnection(webSocket)) {
          // Use WebSocketConnection's sendMessage method
          if (webSocket.isConnected && webSocket.isReady) {
            sent = webSocket.sendMessage(message);
            if (sent) {
              console.log(`🎮 Live update broadcasted via WebSocketConnection: ${type} for tag ${tagId}`);
            }
          }
        } else if (webSocket && typeof webSocket.send === 'function' && webSocket.readyState === WebSocket.OPEN) {
          // Use raw WebSocket send method
          webSocket.send(JSON.stringify(message));
          sent = true;
          console.log(`🎮 Live update broadcasted via raw WebSocket: ${type} for tag ${tagId}`);
        }
        
        if (!sent) {
          console.warn(`⚠️ WebSocket not ready for broadcast: ${type} for tag ${tagId}`, {
            isWebSocketConnection: isWebSocketConnection(webSocket),
            isConnected: isWebSocketConnection(webSocket) ? webSocket.isConnected : false,
            isReady: isWebSocketConnection(webSocket) ? webSocket.isReady : false,
            readyState: !isWebSocketConnection(webSocket) ? webSocket?.readyState : 'N/A'
          });
        }
      } catch (error) {
        console.error(`❌ WebSocket send failed for ${type} tag ${tagId}:`, error);
      }
    } else {
      console.warn(`⚠️ No WebSocket available for broadcast: ${type} for tag ${tagId}`);
    }
    
    return { success: true, apiCallMade: false };
  }, [sessionId, webSocket, onLocalStateUpdate]);
  
  // Handle drag updates (called during drag)
  const handleDrag = useCallback((tagId: string, coordinates: { x: number; y: number }) => {
    return handleLiveUpdate({
      type: 'drag',
      tagId,
      coordinates,
      timestamp: Date.now(),
      isTransient: true
    });
  }, [handleLiveUpdate]);
  
  // Handle resize updates (called during resize)
  const handleResize = useCallback((tagId: string, coordinates: { x: number; y: number; width: number; height: number }) => {
    return handleLiveUpdate({
      type: 'resize',
      tagId,
      coordinates,
      timestamp: Date.now(),
      isTransient: true
    });
  }, [handleLiveUpdate]);
  
  // Handle content changes (called during typing)
  const handleContentChange = useCallback((tagId: string, content: string) => {
    return handleLiveUpdate({
      type: 'content_change',
      tagId,
      content,
      timestamp: Date.now(),
      isTransient: true
    });
  }, [handleLiveUpdate]);
  
  // Mark interaction as ended (no more live updates)
  const endInteraction = useCallback((tagId: string) => {
    activeInteractions.current.delete(tagId);
    interactionTimestamps.current.delete(tagId);
    
    console.log(`✅ Interaction ended for tag: ${tagId}`);
    
    // Broadcast interaction end
    if (webSocket) {
      const message = {
        type: 'interaction_ended',
        payload: {
          sessionId,
          tagId,
          timestamp: Date.now()
        }
      };
      
      try {
        let sent = false;
        
        if (isWebSocketConnection(webSocket)) {
          // Use WebSocketConnection's sendMessage method
          if (webSocket.isConnected && webSocket.isReady) {
            sent = webSocket.sendMessage(message);
            if (sent) {
              console.log(`🏁 End interaction broadcasted via WebSocketConnection for tag ${tagId}`);
            }
          }
        } else if (webSocket && typeof webSocket.send === 'function' && webSocket.readyState === WebSocket.OPEN) {
          // Use raw WebSocket send method
          webSocket.send(JSON.stringify(message));
          sent = true;
          console.log(`🏁 End interaction broadcasted via raw WebSocket for tag ${tagId}`);
        }
        
        if (!sent) {
          console.warn(`⚠️ WebSocket not ready for end interaction: ${tagId}`, {
            isWebSocketConnection: isWebSocketConnection(webSocket),
            isConnected: isWebSocketConnection(webSocket) ? webSocket.isConnected : false,
            isReady: isWebSocketConnection(webSocket) ? webSocket.isReady : false,
            readyState: !isWebSocketConnection(webSocket) ? webSocket?.readyState : 'N/A'
          });
        }
      } catch (error) {
        console.error(`❌ WebSocket end interaction send failed for tag ${tagId}:`, error);
      }
    } else {
      console.warn(`⚠️ No WebSocket available for end interaction: ${tagId}`);
    }
  }, [sessionId, webSocket]);
  
  // Get currently active interactions
  const getActiveInteractions = useCallback(() => {
    return Array.from(activeInteractions.current);
  }, []);
  
  // Check if tag is currently being interacted with
  const isInteractionActive = useCallback((tagId: string) => {
    return activeInteractions.current.has(tagId);
  }, []);
  
  // Get interaction duration
  const getInteractionDuration = useCallback((tagId: string) => {
    const startTime = interactionTimestamps.current.get(tagId);
    return startTime ? Date.now() - startTime : 0;
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeInteractions.current.clear();
      interactionTimestamps.current.clear();
    };
  }, []);
  
  return {
    // Core live update methods (no API calls)
    handleDrag,
    handleResize, 
    handleContentChange,
    endInteraction,
    
    // State query methods
    getActiveInteractions,
    isInteractionActive,
    getInteractionDuration,
    
    // Statistics for debugging
    stats: {
      activeInteractionCount: activeInteractions.current.size,
      sessionId
    }
  };
};

export default useLiveUXManager;