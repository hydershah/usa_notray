import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from './useEditorStore';
import { useToast } from '@/hooks/use-toast';
import type { CollaborationUpdate, UserCursor } from '../../types/editor';

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

interface UserPresence {
  userId: string;
  displayName: string;
  userType: 'notary' | 'signer' | 'witness';
  isOnline: boolean;
  lastSeen: Date;
  currentPage: number;
  currentDocumentId?: string;
  isTyping: boolean;
  typingField?: string;
}

export const useWebSocket = (config: WebSocketConfig) => {
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueRef = useRef<WSMessage[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cursorThrottleRef = useRef<NodeJS.Timeout | null>(null);
  
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0
  });

  const [userPresence, setUserPresence] = useState<Map<string, UserPresence>>(new Map());

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
    syncToPage,
    setParticipants,
    setTags
  } = useEditorStore();

  const {
    sessionId,
    userId,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10
  } = config;

  // Get authentication token
  const getAuthToken = useCallback(() => {
    return localStorage.getItem('token');
  }, []);

  // Create WebSocket URL
  const createWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = getAuthToken();
    
    return `${protocol}//${host}/ws/editor?token=${encodeURIComponent(token || '')}&sessionId=${encodeURIComponent(sessionId)}`;
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

  // Update user presence
  const updateUserPresence = useCallback((userId: string, updates: Partial<UserPresence>) => {
    setUserPresence(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(userId);
      if (existing) {
        newMap.set(userId, { ...existing, ...updates });
      }
      return newMap;
    });
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
          
          // Update participants list
          if (message.payload.participants) {
            setParticipants(message.payload.participants);
          }
          break;

        case 'user_joined':
          console.log(`👋 User joined: ${message.payload.user.displayName}`);
          updateUserPresence(message.payload.user.userId, {
            ...message.payload.user,
            isOnline: true,
            lastSeen: new Date(),
            isTyping: false
          });
          break;

        case 'user_left':
          console.log(`👋 User left: ${message.payload.displayName}`);
          updateUserPresence(message.payload.userId, {
            isOnline: false,
            lastSeen: new Date(),
            isTyping: false
          });
          break;

        case 'tag_placed':
          console.log('📝 Tag placed by another user');
          addTag(message.payload.tag);
          toast({
            title: "Tag Added",
            description: `${message.payload.user?.displayName || 'Another user'} added a new tag`,
          });
          break;

        case 'tag_updated':
          console.log('✏️ Tag updated by another user');
          updateTag(message.payload.tagId, message.payload.updates);
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
            isCompleted: message.payload.isCompleted,
            completedBy: message.payload.completedBy,
            completedAt: message.payload.completedAt,
            updatedBy: message.payload.updatedBy
          });
          
          // Show notification for content updates
          if (message.payload.isCompleted) {
            toast({
              title: "Tag Completed",
              description: `${message.payload.user?.displayName || 'Another user'} completed a tag`,
            });
          }
          
          break;

        case 'tag_deleted':
          console.log('🗑️ Tag deleted by another user');
          deleteTag(message.payload.tagId);
          toast({
            title: "Tag Deleted",
            description: `${message.payload.user?.displayName || 'Another user'} deleted a tag`,
          });
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
          updateUserPresence(message.payload.user.userId, {
            currentPage: message.payload.pageNumber
          });
          break;

        case 'document_switched':
          console.log(`📁 Document switched to: ${message.payload.documentId}`);
          updateUserPresence(message.userId, {
            currentDocumentId: message.payload.documentId,
            currentPage: 1
          });
          break;

        case 'content_replaced':
          console.log('🔄 Content replaced by notary');
          replaceAllTags();
          toast({
            title: "Content Replaced",
            description: "The notary has replaced all tags with content",
          });
          break;

        case 'sync_to_notary':
          console.log(`🔗 Syncing to notary view: page ${message.payload.pageNumber}`);
          
          // Show notification about the sync
          if (message.payload.notaryName) {
            console.log(`📢 Synced by notary ${message.payload.notaryName} to page ${message.payload.pageNumber}`);
            toast({
              title: `Synced by ${message.payload.notaryName}`,
              description: `You are now viewing page ${message.payload.pageNumber}.`,
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

        case 'user_typing':
          // Handle typing indicators
          console.log(`⌨️ User ${message.userId} is typing`);
          updateUserPresence(message.userId, {
            isTyping: true,
            typingField: message.payload.fieldId
          });
          
          // Clear typing indicator after 3 seconds
          setTimeout(() => {
            updateUserPresence(message.userId, {
              isTyping: false,
              typingField: undefined
            });
          }, 3000);
          break;

        case 'user_stopped_typing':
          updateUserPresence(message.userId, {
            isTyping: false,
            typingField: undefined
          });
          break;

        case 'tag_moved':
          console.log('🔄 Tag moved by another user');
          updateTag(message.payload.tagId, {
            coordinates: message.payload.coordinates
          });
          break;

        case 'tag_resized':
          console.log('📏 Tag resized by another user');
          updateTag(message.payload.tagId, {
            coordinates: message.payload.coordinates
          });
          break;

        case 'session_state_sync':
          console.log('🔄 Receiving session state sync');
          if (message.payload.tags) {
            setTags(message.payload.tags);
          }
          if (message.payload.participants) {
            setParticipants(message.payload.participants);
          }
          break;

        case 'error':
          console.error('WebSocket error:', message.payload.message);
          setConnectionState(prev => ({
            ...prev,
            lastError: message.payload.message
          }));
          toast({
            title: "Connection Error",
            description: message.payload.message,
            variant: "destructive"
          });
          break;

        case 'pong':
          // Handle pong response
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
    setConnectionStatus, processMessageQueue, toast, updateUserPresence,
    setParticipants, setTags
  ]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      setConnectionState(prev => ({ ...prev, isConnecting: true }));
      
      const wsUrl = createWebSocketUrl();
      console.log('🔗 Attempting WebSocket connection to:', wsUrl);
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

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (cursorThrottleRef.current) {
      clearTimeout(cursorThrottleRef.current);
      cursorThrottleRef.current = null;
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

    tagMoved: (tagId: string, coordinates: any) => {
      sendMessage({
        type: 'tag_moved',
        payload: { tagId, coordinates }
      });
    },

    tagResized: (tagId: string, coordinates: any) => {
      sendMessage({
        type: 'tag_resized',
        payload: { tagId, coordinates }
      });
    },

    cursorMoved: (x: number, y: number, pageNumber: number, documentId: string) => {
      // Throttle cursor updates to prevent spam
      if (cursorThrottleRef.current) {
        clearTimeout(cursorThrottleRef.current);
      }
      
      cursorThrottleRef.current = setTimeout(() => {
        sendMessage({
          type: 'cursor_moved',
          payload: { x, y, pageNumber, documentId }
        });
      }, 100); // Throttle to 10fps
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
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        sendMessage({
          type: 'user_stopped_typing',
          payload: { fieldId }
        });
      }, 3000);
    },

    userStoppedTyping: (fieldId: string) => {
      sendMessage({
        type: 'user_stopped_typing',
        payload: { fieldId }
      });
    },

    requestSessionState: () => {
      sendMessage({
        type: 'request_session_state',
        payload: {}
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
    userPresence: Array.from(userPresence.values()),
    sendMessage,
    connect,
    disconnect,
    reconnect,
    ...collaborationActions
  };
};

export default useWebSocket; 