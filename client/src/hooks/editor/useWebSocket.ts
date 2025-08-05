import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from './useEditorStore';
import { useToast } from '@/hooks/use-toast';
import type { CollaborationUpdate, UserCursor } from '../../types/editor';
import type { DocumentTag } from '../../types/editor';

export interface WebSocketConnection {
  connectionState: ConnectionState;
  sendMessage: (message: Omit<WSMessage, 'userId' | 'sessionId' | 'timestamp'>) => boolean;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  // WebSocket instance and state
  webSocketInstance: WebSocket | null;
  readyState?: number;
  isConnected: boolean;
  isConnecting: boolean;
  isReady: boolean;
  // Collaboration actions
  tagPlaced: (tag: any) => void;
  tagUpdated: (tagId: string, updates: any) => void;
  tagDeleted: (tagId: string) => void;
  tagSelected: (tagId: string, userId: string) => void;
  cursorMoved: (x: number, y: number, page: number, documentId: string) => void;
  pageChanged: (page: number, documentId: string) => void;
  documentChanged: (documentId: string) => void;
}

interface WebSocketConfig {
  sessionId: string;
  userId: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface WSMessage {
  type: string;
  payload: any;
  userId: string;
  sessionId: string;
  timestamp: number;
}

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  lastConnectedAt?: Date;
  lastError?: string;
}

export const useWebSocket = (config: WebSocketConfig): WebSocketConnection => {
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueRef = useRef<WSMessage[]>([]);
  
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0
  });

  const {
    setConnectionStatus,
    updateLastSync,
    addTag,
    updateTag,
    deleteTag,
    updateCursor,
    setCurrentPage,
    setCurrentDocument,
    replaceAllTags,
    syncToPage
  } = useEditorStore();

  const {
    sessionId,
    userId,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10
  } = config;

  // Get authentication token with validation
  const getAuthToken = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('⚠️ No authentication token found in localStorage');
      return null;
    }
    return token;
  }, []);

  // Create WebSocket URL
  const createWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = getAuthToken();
    
    if (!token) {
      console.error('🚫 Cannot create WebSocket URL: No authentication token');
      throw new Error('Authentication token required for WebSocket connection');
    }
    
    return `${protocol}//${host}/ws/editor?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`;
  }, [sessionId, getAuthToken]);

  // Send message via WebSocket
  const sendMessage = useCallback((message: Omit<WSMessage, 'userId' | 'sessionId' | 'timestamp'>) => {
    const fullMessage: WSMessage = {
      ...message,
      userId,
      sessionId,
      timestamp: Date.now()
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(fullMessage));
      return true;
    } else {
      // Queue message for when connection is restored
      messageQueueRef.current.push(fullMessage);
      return false;
    }
  }, [userId, sessionId]);

  // Process queued messages
  const processMessageQueue = useCallback(() => {
    while (messageQueueRef.current.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
      const message = messageQueueRef.current.shift();
      if (message) {
        wsRef.current.send(JSON.stringify(message));
      }
    }
  }, []);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WSMessage = JSON.parse(event.data);
      
      updateLastSync();

      switch (message.type) {
        case 'connection_established':
          console.log('✅ WebSocket connection established');
          setConnectionState(prev => ({
            ...prev,
            isConnected: true,
            isConnecting: false,
            reconnectAttempts: 0,
            lastConnectedAt: new Date(),
            lastError: undefined
          }));
          setConnectionStatus(true);
          processMessageQueue();
          break;

        case 'user_joined':
          console.log(`👋 User joined: ${message.payload.user.displayName}`);
          // Update participant list in store
          break;

        case 'user_left':
          console.log(`👋 User left: ${message.payload.displayName}`);
          // Update participant list in store
          break;

        case 'tag_placed':
          console.log('📝 Tag placed by another user');
          addTag(message.payload.tag);
          
          // 🔧 SYNC TEXT INPUTS: If it's a text tag, also update text inputs state
          if (message.payload.tag.tagType === 'T') {
            console.log('📝 Syncing new text tag to text inputs:', message.payload.tag.id);
            // Trigger text input reload or direct state update
            if (typeof window !== 'undefined' && (window as any).textInputSyncCallback) {
              (window as any).textInputSyncCallback('tag_placed', message.payload.tag);
            }
          }
          break;

        case 'tag_updated':
          console.log('✏️ Tag updated by another user');
          updateTag(message.payload.tagId, message.payload.updates);
          
          // 🔧 SYNC TEXT INPUTS: If it's a text tag, also update text inputs state
          if (message.payload.tagType === 'T' || message.payload.updates?.tagType === 'T') {
            console.log('📝 Syncing text tag position update to text inputs:', message.payload.tagId);
            if (typeof window !== 'undefined' && (window as any).textInputSyncCallback) {
              (window as any).textInputSyncCallback('tag_updated', {
                id: message.payload.tagId,
                updates: message.payload.updates
              });
            }
          }
          break;

        case 'tag_saved':
          console.log('💾 Tag saved by another user (coordinates updated)');
          // Handle tag_saved similar to tag_updated, but specifically for coordinate changes
          if (message.payload.tagId && message.payload.coordinates) {
            updateTag(message.payload.tagId, { coordinates: message.payload.coordinates });
            
            // 🔧 SYNC TEXT INPUTS: If it's a text tag, also update text inputs state
            if (typeof window !== 'undefined' && (window as any).textInputSyncCallback) {
              (window as any).textInputSyncCallback('tag_updated', {
                id: message.payload.tagId,
                updates: { coordinates: message.payload.coordinates }
              });
            }
          }
          break;

        case 'tag_content_updated':
          console.log('✏️ Tag content updated by another user:', {
            tagId: message.payload.tagId,
            tagType: message.payload.tagType,
            isCompleted: message.payload.isCompleted,
            source: message.payload.source || 'manual'
          });
          
          // 🔧 FIX: Serialize contentData for client compatibility
          let processedContentData = message.payload.contentData;
          if (processedContentData && typeof processedContentData === 'object') {
            try {
              processedContentData = JSON.stringify(processedContentData);
              console.log('📦 Serialized contentData for tag', message.payload.tagId, ':', {
                originalType: typeof message.payload.contentData,
                serializedLength: processedContentData.length
              });
            } catch (e) {
              console.warn('Failed to serialize contentData, using original:', e);
              processedContentData = message.payload.contentData;
            }
          }
          
          // Update the tag with the new content
          updateTag(message.payload.tagId, {
            content: message.payload.content,
            contentType: message.payload.contentType,
            contentData: processedContentData,
            isCompleted: message.payload.isCompleted
          });
          
          // 🔧 FIX: Update text inputs for text tags (T)
          if (message.payload.tagType === 'T') {
            console.log('📝 Syncing text tag content update to text inputs:', message.payload.tagId);
            // Notify text input system about the content change
            if (typeof window !== 'undefined' && (window as any).textInputSyncCallback) {
              (window as any).textInputSyncCallback('tag_content_updated', {
                tagId: message.payload.tagId,
                tagType: message.payload.tagType,
                content: message.payload.content,
                contentType: message.payload.contentType,
                contentData: processedContentData,
                isCompleted: message.payload.isCompleted,
                source: message.payload.source || 'manual'
              });
            }
          }
          
          break;

        case 'tag_deleted':
          console.log('🗑️ Tag deleted by another user');
          deleteTag(message.payload.tagId);
          
          // 🔧 SYNC TEXT INPUTS: If it's a text tag, also remove from text inputs state
          console.log('📝 Syncing text tag deletion to text inputs:', message.payload.tagId);
          if (typeof window !== 'undefined' && (window as any).textInputSyncCallback) {
            (window as any).textInputSyncCallback('tag_deleted', {
              id: message.payload.tagId
            });
          }
          break;

        case 'cursor_moved':
          updateCursor({
            userId: message.userId,
            x: message.payload.x,
            y: message.payload.y,
            pageNumber: message.payload.pageNumber,
            documentId: message.payload.documentId,
            timestamp: new Date(message.timestamp)
          });
          break;

        case 'page_changed':
          console.log(`📄 User ${message.payload.user.displayName} moved to page ${message.payload.pageNumber}`);
          // Update user's current page in participants list
          break;

        case 'document_switched':
          console.log(`📁 Document switched to: ${message.payload.documentId}`);
          // Handle document switching
          break;

        case 'content_replaced':
          console.log('🔄 Content replaced by notary');
          replaceAllTags();
          break;

        case 'sync_to_notary':
          console.log(`🔗 Syncing to notary view: page ${message.payload.pageNumber}`);
          
          // Show notification about the sync
          if (message.payload.notaryName) {
            console.log(`📢 Synced by notary ${message.payload.notaryName} to page ${message.payload.pageNumber}`);
            toast({
              title: `Synced by ${message.payload.notaryName} to page ${message.payload.pageNumber}`,
              description: `You are now viewing the notary's view of page ${message.payload.pageNumber}.`,
            });
          }
          
          // Switch document if needed
          if (message.payload.documentId) {
            const documents = useEditorStore.getState().documents;
            const targetDoc = documents.find(d => d.id === message.payload.documentId);
            if (targetDoc) {
              setCurrentDocument(targetDoc);
            }
          }
          
          // Sync to the specified page
          syncToPage(message.payload.pageNumber || 1);
          break;

        case 'text_input_changed':
          console.log('📝 Text input changed by another user:', {
            textInputId: message.payload.textInputId,
            content: message.payload.content,
            messageUserId: message.payload.userId || message.userId,
            displayName: message.payload.displayName,
            currentUserId: userId
          });
          
          // Sync text input changes to local state (but don't update if it's from the same user)
          const changeUserId = message.payload.userId || message.userId;
          if (changeUserId !== userId && changeUserId?.toString() !== userId?.toString() && typeof window !== 'undefined' && (window as any).textInputSyncCallback) {
            console.log('✅ Applying text input sync from different user');
            (window as any).textInputSyncCallback('text_input_content_changed', {
              id: message.payload.textInputId,
              content: message.payload.content,
              coordinates: message.payload.coordinates,
              fromUser: message.payload.displayName || `User ${changeUserId}`
            });
          } else {
            console.log('⚠️ Skipping text input sync - same user or self-update');
          }
          break;

        case 'user_typing':
          // Handle typing indicators
          console.log(`⌨️ User ${message.userId} is typing`);
          break;

        case 'error':
          console.error('WebSocket error:', message.payload.message);
          setConnectionState(prev => ({
            ...prev,
            lastError: message.payload.message
          }));
          break;

        case 'pong':
          // WebSocket pong response - connection is alive, no action needed
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [
    addTag, updateTag, deleteTag, updateCursor, setCurrentPage, 
    setCurrentDocument, replaceAllTags, syncToPage, updateLastSync, 
    setConnectionStatus, processMessageQueue, toast
  ]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    // Check authentication before attempting connection
    const token = getAuthToken();
    if (!token) {
      console.error('🚫 Cannot connect WebSocket: User not authenticated');
      setConnectionState(prev => ({
        ...prev,
        isConnecting: false,
        lastError: 'Authentication required'
      }));
      return;
    }

    try {
      setConnectionState(prev => ({ ...prev, isConnecting: true }));
      
      const wsUrl = createWebSocketUrl();
      console.log('🔗 Attempting WebSocket connection to:', wsUrl);
      console.log('🔍 Auth token present:', !!token);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully to:', wsUrl);
        console.log('🔍 Session ID:', sessionId);
        console.log('🔍 User ID:', userId);
        wsRef.current = ws;
        setConnectionState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          reconnectAttempts: 0,
          lastError: undefined
        }));
        setConnectionStatus(true);
        
        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'ping',
              payload: {},
              userId,
              sessionId,
              timestamp: Date.now()
            }));
          }
        }, 30000); // Ping every 30 seconds
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false
        }));
        setConnectionStatus(false);

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Attempt reconnection if enabled
        if (autoReconnect && connectionState.reconnectAttempts < maxReconnectAttempts) {
          setConnectionState(prev => ({
            ...prev,
            reconnectAttempts: prev.reconnectAttempts + 1
          }));

          const delay = Math.min(reconnectInterval * Math.pow(2, connectionState.reconnectAttempts), 30000);
          
          console.log(`🔄 Attempting reconnection in ${delay}ms (attempt ${connectionState.reconnectAttempts + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('🚨 WebSocket connection error:', error);
        console.error('🔍 WebSocket URL was:', wsUrl);
        console.error('🔍 WebSocket readyState:', ws.readyState);
        console.error('🔍 Token available:', !!getAuthToken());
        console.error('🔍 Session ID:', sessionId);
        setConnectionState(prev => ({
          ...prev,
          lastError: 'WebSocket connection error'
        }));
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionState(prev => ({
        ...prev,
        isConnecting: false,
        lastError: 'Failed to create connection'
      }));
    }
  }, [
    createWebSocketUrl, handleMessage, autoReconnect, maxReconnectAttempts, 
    reconnectInterval, connectionState.reconnectAttempts, userId, sessionId, setConnectionStatus
  ]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    setConnectionState({
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0
    });
    setConnectionStatus(false);
  }, [setConnectionStatus]);

  // Force reconnection
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(connect, 1000);
  }, [disconnect, connect]);

  // Send collaboration events
  const collaborationActions = {
    tagPlaced: (tag: any) => {
      sendMessage({
        type: 'tag_placed',
        payload: { tag }
      });
    },

    tagUpdated: (tagId: string, updates: any) => {
      sendMessage({
        type: 'tag_updated',
        payload: { tagId, updates }
      });
    },

    tagDeleted: (tagId: string) => {
      sendMessage({
        type: 'tag_deleted',
        payload: { tagId }
      });
    },

    tagSelected: (tagId: string, userId: string) => {
      sendMessage({
        type: 'tag_selected',
        payload: { tagId, userId }
      });
    },

    tagContentUpdated: (tagId: string, content: any, contentType: string, isCompleted: boolean, source?: string) => {
      sendMessage({
        type: 'tag_content_updated',
        payload: { 
          tagId, 
          content, 
          contentType, 
          isCompleted,
          source: source || 'manual'
        }
      });
    },

    cursorMoved: (x: number, y: number, pageNumber: number, documentId: string) => {
      sendMessage({
        type: 'cursor_moved',
        payload: { x, y, pageNumber, documentId }
      });
    },

    pageChanged: (pageNumber: number) => {
      sendMessage({
        type: 'page_changed',
        payload: { pageNumber }
      });
    },

    documentSwitched: (documentId: string) => {
      sendMessage({
        type: 'document_switched',
        payload: { documentId }
      });
    },

    documentChanged: (documentId: string) => {
      sendMessage({
        type: 'document_changed',
        payload: { documentId }
      });
    },

    contentReplaced: () => {
      sendMessage({
        type: 'content_replaced',
        payload: {}
      });
    },

    syncUsers: (pageNumber: number, documentId?: string) => {
      sendMessage({
        type: 'sync_users',
        payload: { pageNumber, documentId }
      });
    },

    userTyping: (fieldId: string) => {
      sendMessage({
        type: 'user_typing',
        payload: { fieldId }
      });
    }
  };

  // Initialize connection on mount
  useEffect(() => {
    if (sessionId && userId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [sessionId, userId, connect, disconnect]);

  return {
    connectionState,
    sendMessage,
    connect,
    disconnect,
    reconnect,
    // Expose WebSocket instance and readyState for component access
    webSocketInstance: wsRef.current,
    readyState: wsRef.current?.readyState,
    isConnected: connectionState.isConnected,
    isConnecting: connectionState.isConnecting,
    isReady: connectionState.isConnected && !connectionState.isConnecting,
    ...collaborationActions
  };
};

export default useWebSocket; 