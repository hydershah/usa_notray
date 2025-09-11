import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useEditorStore } from './useEditorStore';
import { getWebSocketConfig } from '@/lib/websocket-config';
import type { CollaborationUpdate, UserCursor } from '../../types/editor';
import type { DocumentTag } from '../../types/editor';
import { useRealTimeMovement } from './useRealTimeMovement';

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
  tagMoving: (tagId: string, updates: any) => void;
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
  // 🔍 DEBUG: Log session ID to identify incorrect usage
  useEffect(() => {
    console.log('🔍 useWebSocket initialized with sessionId:', config.sessionId);
    if (/^\d+$/.test(config.sessionId)) {
      console.error('❌ useWebSocket received job ID instead of session ID!', config.sessionId);
      console.trace('❌ WebSocket hook instantiation stack trace');
    }
  }, [config.sessionId]);
  
  const { toast } = useToast();
  const { addMovement, removeMovement } = useRealTimeMovement();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueRef = useRef<WSMessage[]>([]);
  const lastSyncRef = useRef<number>(Date.now());
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
    lastConnectedAt: undefined,
    lastError: undefined
  });

  // 🔧 FIX: Use configuration for better control
  const wsConfig = getWebSocketConfig();

  // 🔧 FIX: Add message deduplication to prevent bouncing
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const lastTagUpdatesRef = useRef<Map<string, { timestamp: number; userId: string; coordinates?: any }>>(new Map());
  
  const isDuplicateMessage = (message: WSMessage): boolean => {
    const messageKey = `${message.type}_${message.payload?.tagId || message.payload?.textInputId || 'unknown'}_${message.userId}_${message.timestamp}`;
    
    // Check if we've processed this exact message
    if (processedMessagesRef.current.has(messageKey)) {
      if (wsConfig.logDuplicateMessages) {
        console.log(`🔄 Skipping exact duplicate message: ${message.type}`);
      }
      return true;
    }
    
    // Check for recent duplicate tag updates from same user
    if (message.type === 'tag_updated' || message.type === 'tag_saved') {
      const tagId = message.payload?.tagId;
      if (tagId) {
        const lastUpdate = lastTagUpdatesRef.current.get(tagId);
        const now = Date.now();
        
        if (lastUpdate && 
            lastUpdate.userId === message.userId && 
            (now - lastUpdate.timestamp) < wsConfig.deduplicationWindow) {
          
          // Check if coordinates are very similar (within tolerance)
          if (message.payload?.updates?.coordinates && lastUpdate.coordinates) {
            const isClose = (a: number, b: number, tol = wsConfig.coordinateTolerance) => Math.abs(a - b) <= tol;
            const newCoords = message.payload.updates.coordinates;
            const oldCoords = lastUpdate.coordinates;
            
            if (isClose(newCoords.x, oldCoords.x) && 
                isClose(newCoords.y, oldCoords.y) &&
                isClose(newCoords.width || 0, oldCoords.width || 0) &&
                isClose(newCoords.height || 0, oldCoords.height || 0)) {
              if (wsConfig.logDuplicateMessages) {
                console.log(`🔄 Skipping duplicate tag update for ${tagId} from ${message.userId}`);
              }
              return true;
            }
          }
        }
        
        // Update tracking
        lastTagUpdatesRef.current.set(tagId, {
          timestamp: now,
          userId: message.userId,
          coordinates: message.payload?.updates?.coordinates
        });
      }
    }
    
    // Mark as processed
    processedMessagesRef.current.add(messageKey);
    
    // Clean up old processed messages (keep last 1000)
    if (processedMessagesRef.current.size > 1000) {
      const keys = Array.from(processedMessagesRef.current);
      processedMessagesRef.current = new Set(keys.slice(-500));
    }
    
    return false;
  };

  const {
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
    // 🔒 GUARD: Prevent WebSocket connection with job ID instead of session ID
    if (/^\d+$/.test(sessionId)) {
      console.error('❌ Attempting to create WebSocket with job ID instead of session ID:', sessionId);
      throw new Error(`Invalid session ID for WebSocket: ${sessionId}. This appears to be a job ID, not a session ID.`);
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = getAuthToken();
    
    if (!token) {
      console.error('🚫 Cannot create WebSocket URL: No authentication token');
      throw new Error('Authentication token required for WebSocket connection');
    }
    
    // 🔧 FIX: Add development mode check for debugging
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      console.log('🔧 Development mode: WebSocket sync enabled');
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
      
      // 🔧 FIX: Check for duplicate messages to prevent bouncing
      if (isDuplicateMessage(message)) {
        console.log(`🔄 Skipping duplicate message: ${message.type} for ${message.payload?.tagId || 'unknown'}`);
        return;
      }
      
      // 🔧 FIX: Skip processing our own broadcasts to prevent loops
      if (message.userId === userId) {
        console.log(`🔄 Skipping own broadcast: ${message.type} for ${message.payload?.tagId || 'unknown'}`);
        return;
      }
      
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

        case 'tag_placed': {
          console.log('📝 Tag placed');
          const serverTag = message.payload.tag as any;

          // 🔧 De-dupe: remove any recent optimistic temp tag that matches this server tag
          try {
            const existingTags = useEditorStore.getState().tags;
            const now = Date.now();
            const isClose = (a: number, b: number, tol = 8) => Math.abs(a - b) <= tol;
            const tempCandidate = existingTags.find(t =>
              t.id.startsWith('temp_') &&
              t.tagType === serverTag.tagType &&
              t.documentId === serverTag.documentId &&
              t.coordinates?.pageNumber === serverTag.coordinates?.pageNumber &&
              isClose((t.coordinates?.x as number) || 0, (serverTag.coordinates?.x as number) || 0) &&
              isClose((t.coordinates?.y as number) || 0, (serverTag.coordinates?.y as number) || 0) &&
              (now - new Date(t.createdAt as any).getTime() < 7000)
            );
            if (tempCandidate) {
              console.log('🧹 Removing matching optimistic temp tag:', tempCandidate.id);
              deleteTag(tempCandidate.id);
            }
          } catch (e) {
            console.warn('De-dupe temp tag failed (non-fatal):', e);
          }

          addTag(serverTag);
          
          // 🔧 SYNC TEXT INPUTS: If it's a text tag, also update text inputs state
          if (serverTag.tagType === 'T') {
            console.log('📝 Syncing new text tag to text inputs:', serverTag.id);
            // Trigger text input reload or direct state update, include origin user id
            if (typeof window !== 'undefined' && (window as any).textInputSyncCallback) {
              (window as any).textInputSyncCallback('tag_placed', {
                ...serverTag,
                updatedBy: message.userId
              });
            }
          }
          break;
        }

        case 'tag_updated':
          console.log('✏️ Tag updated');
          try {
            const tagIdStr = message.payload?.tagId != null ? message.payload.tagId.toString() : undefined;
            if (!tagIdStr) {
              console.warn('⚠️ tag_updated missing tagId');
              break;
            }
            updateTag(tagIdStr, message.payload.updates);
          } catch (e) {
            console.warn('⚠️ Failed to process tag_updated message:', e);
          }
          
          // 🔧 SYNC TEXT INPUTS: If it's a text tag, also update text inputs state
          if (message.payload.tagType === 'T' || message.payload.updates?.tagType === 'T') {
            console.log('📝 Syncing text tag position update to text inputs:', message.payload.tagId);
            if (typeof window !== 'undefined' && (window as any).textInputSyncCallback) {
              (window as any).textInputSyncCallback('tag_updated', {
                id: message.payload.tagId,
                updates: message.payload.updates,
                updatedBy: message.payload.updatedBy ?? message.userId
              });
            }
          }
          break;

        case 'tag_moving':
          console.log('🔄 Tag moving in real-time by', message.payload.updatedByName || message.userId);
          try {
            const tagIdStr = message.payload?.tagId != null ? message.payload.tagId.toString() : undefined;
            if (!tagIdStr) {
              console.warn('⚠️ tag_moving missing tagId');
              break;
            }
            
            // Update tag position immediately for smooth real-time movement
            // The payload structure is { tagId, updates } so we need to access updates directly
            const updates = message.payload.updates || message.payload;
            updateTag(tagIdStr, updates);
            
            // Track movement information for visual feedback
            if (message.payload.updatedByName && message.payload.updatedBy !== userId) {
              console.log(`👤 ${message.payload.updatedByName} (${message.payload.userType}) is moving tag ${tagIdStr}`);
              
              // Add movement tracking for visual feedback
              addMovement(tagIdStr, {
                userId: message.payload.updatedBy || message.userId,
                displayName: message.payload.updatedByName,
                userType: message.payload.userType || 'user',
                timestamp: Date.now()
              });
            }
          } catch (e) {
            console.warn('⚠️ Failed to process tag_moving message:', e);
          }
          
          // 🔧 SYNC TEXT INPUTS: If it's a text tag, also update text inputs state
          if (message.payload.tagType === 'T' || message.payload.updates?.tagType === 'T') {
            console.log('📝 Syncing text tag real-time movement to text inputs:', message.payload.tagId);
            if (typeof window !== 'undefined' && (window as any).textInputSyncCallback) {
              (window as any).textInputSyncCallback('tag_moving', {
                id: message.payload.tagId,
                updates: message.payload.updates,
                updatedBy: message.payload.updatedBy ?? message.userId,
                updatedByName: message.payload.updatedByName,
                userType: message.payload.userType
              });
            }
          }
          break;

        case 'tag_saved':
          console.log('💾 Tag saved (coordinates updated)');
          // Handle tag_saved for both legacy and new payload shapes
          {
            const rawId = message.payload.tagId;
            const tagId = rawId != null ? rawId.toString() : undefined;
            const coordinates = message.payload.coordinates || message.payload?.updates?.coordinates;
            if (tagId && coordinates) {
              updateTag(tagId, { coordinates });

              // 🔧 SYNC TEXT INPUTS: If it's a text tag, also update text inputs state
              if (typeof window !== 'undefined' && (window as any).textInputSyncCallback) {
                (window as any).textInputSyncCallback('tag_updated', {
                  id: tagId,
                  updates: { coordinates },
                  updatedBy: message.payload.updatedBy ?? message.userId
                });
              }
            } else {
              console.warn('⚠️ Received tag_saved without coordinates in expected shape:', message.payload);
            }
          }
          break;

        // ✅ Dedicated streamlined text input movement event
        case 'text_input_position_updated': {
          const { textInputId, coordinates } = message.payload || {};
          if (textInputId && coordinates) {
            if (typeof window !== 'undefined' && (window as any).textInputSyncCallback) {
              (window as any).textInputSyncCallback('text_input_position_updated', {
                textInputId,
                coordinates,
                updatedBy: message.payload.updatedBy ?? message.userId,
                updatedByName: message.payload.updatedByName
              });
            }
          } else {
            console.warn('⚠️ text_input_position_updated missing expected payload:', message.payload);
          }
          break;
        }

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

        // ✅ NEW: Font size updates for text tags
        case 'tag_font_size_updated': {
          const { tagId, fontSize, contentData } = message.payload || {};
          if (tagId) {
            // Update tag record so it reflects new font size metadata
            updateTag(tagId, {
              contentData: contentData ?? undefined
            } as any);

            // Also inform streamlined text inputs to adjust font size immediately
            if (typeof window !== 'undefined' && (window as any).textInputSyncCallback) {
              (window as any).textInputSyncCallback('tag_font_size_updated', {
                tagId,
                fontSize
              });
            }
          }
          break;
        }

        case 'tag_deleted':
          console.log('🗑️ Tag deleted by another user');
          try {
            const tagIdStr = message.payload?.tagId != null ? message.payload.tagId.toString() : undefined;
            if (tagIdStr) {
              deleteTag(tagIdStr);
              // 🔧 SYNC TEXT INPUTS: If it's a text tag, also remove from text inputs state
              console.log('📝 Syncing text tag deletion to text inputs:', tagIdStr);
              if (typeof window !== 'undefined' && (window as any).textInputSyncCallback) {
                (window as any).textInputSyncCallback('tag_deleted', {
                  id: tagIdStr
                });
              }
            } else {
              console.warn('⚠️ tag_deleted missing tagId');
            }
          } catch (e) {
            console.warn('⚠️ Failed to process tag_deleted message:', e);
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
    setConnectionStatus, processMessageQueue, toast, userId
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
        
        // Handle specific close codes
        if (event.code === 1008) {
          console.error('❌ Session not found or not active:', event.reason);
          toast({
            title: 'Session Error',
            description: event.reason || 'Session not found. Please refresh the page.',
            variant: 'destructive'
          });
        } else if (event.code === 1011) {
          console.error('❌ Server error during connection setup:', event.reason);
          toast({
            title: 'Server Error',
            description: 'Server error during connection. Please try again.',
            variant: 'destructive'
          });
        }
        
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

        // Attempt reconnection if enabled and not a session error
        if (autoReconnect && 
            connectionState.reconnectAttempts < maxReconnectAttempts && 
            event.code !== 1008) { // Don't reconnect for session errors
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
        console.error('🔍 Environment:', process.env.NODE_ENV);
        console.error('🔍 Protocol:', window.location.protocol);
        console.error('🔍 Host:', window.location.host);
        
        setConnectionState(prev => ({
          ...prev,
          lastError: 'WebSocket connection error'
        }));
        
        // Show user-friendly error message
        toast({
          title: 'Connection Error',
          description: 'Failed to connect to real-time collaboration. Please refresh the page.',
          variant: 'destructive'
        });
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

  // Force reconnection with exponential backoff
  const reconnect = useCallback(() => {
    disconnect();
    const delay = Math.min(1000 * Math.pow(2, connectionState.reconnectAttempts), 30000);
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${connectionState.reconnectAttempts + 1})`);
    setTimeout(connect, delay);
  }, [disconnect, connect, connectionState.reconnectAttempts]);

  // Send collaboration events with connection status check
  const collaborationActions = {
    tagPlaced: (tag: any) => {
      if (connectionState.isConnected) {
        sendMessage({
          type: 'tag_placed',
          payload: { tag }
        });
      } else {
        console.warn('⚠️ Cannot send tag_placed: WebSocket not connected');
      }
    },

    tagUpdated: (tagId: string, updates: any) => {
      if (connectionState.isConnected) {
        sendMessage({
          type: 'tag_updated',
          payload: { tagId, updates }
        });
      } else {
        console.warn('⚠️ Cannot send tag_updated: WebSocket not connected');
      }
    },

    tagMoving: (tagId: string, updates: any) => {
      if (connectionState.isConnected) {
        console.log('🚀 Sending tag_moving WebSocket message:', { tagId, updates });
        sendMessage({
          type: 'tag_moving',
          payload: { tagId, updates }
        });
        console.log('✅ tag_moving message sent successfully');
      } else {
        console.warn('⚠️ Cannot send tag_moving: WebSocket not connected');
      }
    },

    tagDeleted: (tagId: string) => {
      if (connectionState.isConnected) {
        sendMessage({
          type: 'tag_deleted',
          payload: { tagId }
        });
      } else {
        console.warn('⚠️ Cannot send tag_deleted: WebSocket not connected');
      }
    },

    tagSelected: (tagId: string, userId: string) => {
      if (connectionState.isConnected) {
        sendMessage({
          type: 'tag_selected',
          payload: { tagId, userId }
        });
      } else {
        console.warn('⚠️ Cannot send tag_selected: WebSocket not connected');
      }
    },

    tagContentUpdated: (tagId: string, content: any, contentType: string, isCompleted: boolean, source?: string) => {
      if (connectionState.isConnected) {
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
      } else {
        console.warn('⚠️ Cannot send tag_content_updated: WebSocket not connected');
      }
    },

    cursorMoved: (x: number, y: number, pageNumber: number, documentId: string) => {
      if (connectionState.isConnected) {
        sendMessage({
          type: 'cursor_moved',
          payload: { x, y, pageNumber, documentId }
        });
      }
    },

    pageChanged: (pageNumber: number) => {
      if (connectionState.isConnected) {
        sendMessage({
          type: 'page_changed',
          payload: { pageNumber }
        });
      }
    },

    documentSwitched: (documentId: string) => {
      if (connectionState.isConnected) {
        sendMessage({
          type: 'document_switched',
          payload: { documentId }
        });
      }
    },

    documentChanged: (documentId: string) => {
      if (connectionState.isConnected) {
        sendMessage({
          type: 'document_changed',
          payload: { documentId }
        });
      }
    },

    contentReplaced: () => {
      if (connectionState.isConnected) {
        sendMessage({
          type: 'content_replaced',
          payload: {}
        });
      } else {
        console.warn('⚠️ Cannot send content_replaced: WebSocket not connected');
      }
    },

    syncUsers: (pageNumber: number, documentId?: string) => {
      if (connectionState.isConnected) {
        sendMessage({
          type: 'sync_users',
          payload: { pageNumber, documentId }
        });
      } else {
        console.warn('⚠️ Cannot send sync_users: WebSocket not connected');
      }
    },

    userTyping: (fieldId: string) => {
      if (connectionState.isConnected) {
        sendMessage({
          type: 'user_typing',
          payload: { fieldId }
        });
      }
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