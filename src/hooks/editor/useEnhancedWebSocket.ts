import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from './useEditorStore';
import type { DocumentTag, TagCoordinates } from '@/types/editor';

interface WebSocketMessage {
  type: string;
  payload: any;
  userId: string;
  sessionId: string;
  timestamp: number;
}

interface EnhancedWebSocketConfig {
  sessionId: string;
  currentUserId: string;
  onTagUpdate?: (tagId: string, updates: Partial<DocumentTag>) => void;
  onTagCreate?: (tag: DocumentTag) => void;
  onTagDelete?: (tagId: string) => void;
}

export const useEnhancedWebSocket = ({
  sessionId,
  currentUserId,
  onTagUpdate,
  onTagCreate,
  onTagDelete
}: EnhancedWebSocketConfig) => {
  
  const [isConnected, setIsConnected] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const messageQueueRef = useRef<WebSocketMessage[]>([]);
  const lastSeenMessages = useRef<Set<string>>(new Set());

  // Prevent message loops by tracking our own messages
  const sentMessageIds = useRef<Set<string>>(new Set());

  // Connect to WebSocket with retry logic
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      const token = localStorage.getItem('token');
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/editor/${sessionId}?token=${token}`;
      
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setIsReady(true);
        
        // Send queued messages
        messageQueueRef.current.forEach(message => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
          }
        });
        messageQueueRef.current = [];
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Ignore our own messages to prevent loops
          const messageId = `${message.type}_${message.userId}_${message.timestamp}`;
          if (sentMessageIds.current.has(messageId) || message.userId === currentUserId) {
            return;
          }

          // Prevent duplicate message processing
          if (lastSeenMessages.current.has(messageId)) {
            return;
          }
          lastSeenMessages.current.add(messageId);

          console.log('📨 Received WebSocket message:', message);

          // Handle different message types
          switch (message.type) {
            case 'tag_update_live':
              if (message.payload.tagId && onTagUpdate) {
                onTagUpdate(message.payload.tagId, message.payload.updates);
              }
              break;

            case 'tag_created_live':
              if (message.payload.tag && onTagCreate) {
                onTagCreate(message.payload.tag);
              }
              break;

            case 'tag_deleted_live':
              if (message.payload.tagId && onTagDelete) {
                onTagDelete(message.payload.tagId);
              }
              break;

            case 'text_input_changed':
              // Handle text input updates
              if (message.payload.textInputId && message.payload.coordinates) {
                console.log('📝 Received text input update:', message.payload);
                // Could trigger text input specific handler here
              }
              break;

            default:
              console.log('📨 Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('❌ Error processing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.warn('⚠️ WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setIsReady(false);
        
        // Attempt to reconnect after delay
        if (event.code !== 1000) { // Not a normal closure
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setIsConnected(false);
        setIsReady(false);
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
    }
  }, [sessionId, currentUserId, onTagUpdate, onTagCreate, onTagDelete]);

  // Send message with queuing for offline scenarios
  const sendMessage = useCallback((message: Omit<WebSocketMessage, 'userId' | 'sessionId' | 'timestamp'>) => {
    const fullMessage: WebSocketMessage = {
      ...message,
      userId: currentUserId,
      sessionId,
      timestamp: Date.now()
    };

    // Track that we sent this message to prevent loops
    const messageId = `${fullMessage.type}_${fullMessage.userId}_${fullMessage.timestamp}`;
    sentMessageIds.current.add(messageId);

    // Clean up old message IDs to prevent memory leaks
    if (sentMessageIds.current.size > 1000) {
      const oldestIds = Array.from(sentMessageIds.current).slice(0, 500);
      oldestIds.forEach(id => sentMessageIds.current.delete(id));
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(fullMessage));
        console.log('📤 Sent WebSocket message:', fullMessage.type);
      } catch (error) {
        console.error('❌ Failed to send WebSocket message:', error);
        messageQueueRef.current.push(fullMessage);
      }
    } else {
      // Queue message for when connection is restored
      messageQueueRef.current.push(fullMessage);
      console.log('📥 Queued message for later sending:', fullMessage.type);
    }
  }, [currentUserId, sessionId]);

  // Optimized message senders
  const broadcastTagUpdate = useCallback((tagId: string, updates: Partial<DocumentTag>) => {
    sendMessage({
      type: 'tag_update_live',
      payload: { tagId, updates }
    });
  }, [sendMessage]);

  const broadcastTagCreation = useCallback((tag: DocumentTag) => {
    sendMessage({
      type: 'tag_created_live',
      payload: { tag }
    });
  }, [sendMessage]);

  const broadcastTagDeletion = useCallback((tagId: string) => {
    sendMessage({
      type: 'tag_deleted_live',
      payload: { tagId }
    });
  }, [sendMessage]);

  const broadcastTextInputUpdate = useCallback((textInputId: string, coordinates: TagCoordinates) => {
    sendMessage({
      type: 'text_input_changed',
      payload: { textInputId, coordinates }
    });
  }, [sendMessage]);

  // Initialize connection
  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [connect]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual cleanup');
    }
    messageQueueRef.current = [];
    lastSeenMessages.current.clear();
    sentMessageIds.current.clear();
  }, []);

  return {
    isConnected,
    isReady,
    webSocketInstance: wsRef.current,
    
    // Message senders
    sendMessage,
    broadcastTagUpdate,
    broadcastTagCreation,
    broadcastTagDeletion,
    broadcastTextInputUpdate,
    
    // Connection management
    connect,
    cleanup
  };
};