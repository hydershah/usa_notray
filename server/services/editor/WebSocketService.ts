import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import jwt from 'jsonwebtoken';

interface WSMessage {
  type: string;
  payload: any;
  userId: string;
  sessionId: string;
  timestamp: number;
}

interface ConnectedUser {
  id: string;
  userId: string;
  sessionId: string;
  userType: 'notary' | 'signer' | 'witness';
  displayName: string;
  ws: WebSocket;
  lastActivity: Date;
  currentPage: number;
  currentDocumentId?: string;
}

interface SessionRoom {
  sessionId: string;
  users: Map<string, ConnectedUser>;
  lastActivity: Date;
  messageHistory: WSMessage[];
}

export class WebSocketService {
  private static instance: WebSocketService | null = null;
  private wss: WebSocketServer;
  private sessions: Map<string, SessionRoom> = new Map();
  private userConnections: Map<string, ConnectedUser> = new Map();
  
  // Track recent join/leave events to reduce log spam
  private recentEvents = new Map();
  private readonly EVENT_THROTTLE_MS = 5000; // Only log once per 5 seconds per user

  // 🔧 FIX: Add message deduplication to prevent bouncing
  private recentMessages = new Map<string, { timestamp: number; userId: string; payload: any }>();
  private readonly MESSAGE_DEDUP_WINDOW = 2000; // 2 seconds

  private shouldLogEvent(userId: string, event: 'join' | 'leave'): boolean {
    const key = `${userId}-${event}`;
    const lastTime = this.recentEvents.get(key);
    const now = Date.now();
    
    if (!lastTime || now - lastTime > this.EVENT_THROTTLE_MS) {
      this.recentEvents.set(key, now);
      return true;
    }
    return false;
  }

  // 🔧 FIX: Check for duplicate messages
  private isDuplicateMessage(message: WSMessage): boolean {
    const messageKey = `${message.type}_${message.payload?.tagId || message.payload?.textInputId || 'unknown'}_${message.userId}`;
    const now = Date.now();
    const lastMessage = this.recentMessages.get(messageKey);
    
    if (lastMessage && 
        lastMessage.userId === message.userId && 
        (now - lastMessage.timestamp) < this.MESSAGE_DEDUP_WINDOW) {
      
      // For tag updates, check if coordinates are very similar
      if (message.type === 'tag_updated' || message.type === 'tag_saved') {
        const newCoords = message.payload?.updates?.coordinates;
        const oldCoords = lastMessage.payload?.updates?.coordinates;
        
        if (newCoords && oldCoords) {
          const isClose = (a: number, b: number, tol = 2) => Math.abs(a - b) <= tol;
          if (isClose(newCoords.x, oldCoords.x) && 
              isClose(newCoords.y, oldCoords.y) &&
              isClose(newCoords.width || 0, oldCoords.width || 0) &&
              isClose(newCoords.height || 0, oldCoords.height || 0)) {
            console.log(`🔄 Server: Skipping duplicate tag update for ${message.payload?.tagId} from ${message.userId}`);
            return true;
          }
        }
      }
    }
    
    // Store this message
    this.recentMessages.set(messageKey, {
      timestamp: now,
      userId: message.userId,
      payload: message.payload
    });
    
    // Clean up old messages
    if (this.recentMessages.size > 1000) {
      const keys = Array.from(this.recentMessages.keys());
      keys.slice(0, 500).forEach(key => this.recentMessages.delete(key));
    }
    
    return false;
  }
  
  constructor(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/editor',
      verifyClient: this.verifyClient.bind(this)
    });
    
    this.wss.on('connection', this.handleConnection.bind(this));
    
    // Cleanup inactive sessions every 5 minutes
    setInterval(this.cleanupInactiveSessions.bind(this), 5 * 60 * 1000);
    
    // Set singleton instance
    WebSocketService.instance = this;
    
    console.log('🔗 WebSocket service initialized for PDF Editor');
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      throw new Error('WebSocketService not initialized. Call constructor first.');
    }
    return WebSocketService.instance;
  }

  static broadcastToSession(sessionId: string, message: WSMessage, excludeUserId?: string): void {
    WebSocketService.getInstance().broadcastToSession(sessionId, message, excludeUserId);
  }
  
  /**
   * Verify client connection with JWT token
   */
  private verifyClient(info: { req: IncomingMessage }): boolean {
    try {
      const url = parse(info.req.url || '', true);
      const token = url.query.token as string;
      
      if (!token) {
        console.log('❌ WebSocket connection rejected: No token provided');
        return false;
      }
      
      // Verify JWT token
      jwt.verify(token, process.env.JWT_SECRET || 'secret');
      return true;
      
    } catch (error) {
      console.log('❌ WebSocket connection rejected: Invalid token');
      return false;
    }
  }
  
  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const url = parse(req.url || '', true);
    const token = url.query.token as string;
    const sessionId = url.query.sessionId as string;
    
    try {
      // Decode user from token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
      const userId = decoded.userId || decoded.id;
      
      if (!sessionId) {
        ws.close(1008, 'Session ID required');
        return;
      }
      
      // Create connected user
      const connectedUser: ConnectedUser = {
        id: `${userId}_${Date.now()}`,
        userId: userId.toString(),
        sessionId,
        userType: decoded.role === 'notary' ? 'notary' : 'signer', // Simplified for now
        displayName: decoded.name || `User ${userId}`,
        ws,
        lastActivity: new Date(),
        currentPage: 1
      };
      
      // Add user to session
      this.addUserToSession(connectedUser);
      
      // Set up message handling
      ws.on('message', (data: Buffer) => {
        this.handleMessage(connectedUser, data);
      });
      
      // Handle disconnection
      ws.on('close', () => {
        this.removeUserFromSession(connectedUser);
      });
      
      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeUserFromSession(connectedUser);
      });
      
      // Send welcome message
      this.sendToUser(connectedUser, {
        type: 'connection_established',
        payload: {
          userId: connectedUser.userId,
          sessionId: connectedUser.sessionId,
          participants: this.getSessionParticipants(sessionId)
        },
        userId: 'system',
        sessionId,
        timestamp: Date.now()
      });
      
      // Notify other users
      this.broadcastToSession(sessionId, {
        type: 'user_joined',
        payload: {
          user: {
            userId: connectedUser.userId,
            userType: connectedUser.userType,
            displayName: connectedUser.displayName,
            currentPage: connectedUser.currentPage
          }
        },
        userId: connectedUser.userId,
        sessionId,
        timestamp: Date.now()
      }, connectedUser.userId);
      
      if (this.shouldLogEvent(connectedUser.userId, 'join')) {
        console.log(`✅ User ${connectedUser.displayName} joined session ${sessionId}`);
      }
      
    } catch (error) {
      console.error('Failed to handle WebSocket connection:', error);
      ws.close(1011, 'Connection setup failed');
    }
  }
  
  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(user: ConnectedUser, data: Buffer): void {
    try {
      const message: WSMessage = JSON.parse(data.toString());
      
      // Update user activity
      user.lastActivity = new Date();
      
      // Validate message
      if (!message.type || !message.sessionId) {
        this.sendError(user, 'Invalid message format');
        return;
      }

      // 🔧 FIX: Check for duplicate messages
      if (this.isDuplicateMessage(message)) {
        return;
      }
      
      // Handle different message types
      switch (message.type) {
        case 'tag_placed':
          this.handleTagPlaced(user, message);
          break;
          
        case 'tag_updated':
          this.handleTagUpdated(user, message);
          break;
          
        case 'tag_saved':
          this.handleTagSaved(user, message);
          break;
          
        case 'tag_deleted':
          this.handleTagDeleted(user, message);
          break;
          
        case 'cursor_moved':
          this.handleCursorMoved(user, message);
          break;
          
        case 'page_changed':
          this.handlePageChanged(user, message);
          break;
          
        case 'document_switched':
          this.handleDocumentSwitched(user, message);
          break;
          
        case 'content_replaced':
          this.handleContentReplaced(user, message);
          break;
          
        case 'sync_users':
          this.handleSyncUsers(user, message);
          break;
          
        case 'user_typing':
          this.handleUserTyping(user, message);
          break;

        case 'tag_content_updated':
          this.handleTagContentUpdated(user, message);
          break;

        case 'text_input_changed':
          this.handleTextInputChanged(user, message);
          break;

        case 'text_input_created':
          this.handleTextInputCreated(user, message);
          break;

        case 'text_input_deleted':
          this.handleTextInputDeleted(user, message);
          break;

        case 'text_input_position_updated':
          this.handleTextInputPositionUpdated(user, message);
          break;

        case 'ping':
          // Handle WebSocket ping - respond with pong
          this.sendToUser(user, {
            type: 'pong',
            payload: {},
            userId: 'system',
            sessionId: user.sessionId,
            timestamp: Date.now()
          });
          break;
          
        default:
          console.warn(`Unknown message type: ${message.type}`);
          this.sendError(user, `Unknown message type: ${message.type}`);
      }
      
    } catch (error) {
      console.error('Failed to handle WebSocket message:', error);
      this.sendError(user, 'Invalid message format');
    }
  }
  
  /**
   * Handle tag placement
   */
  private handleTagPlaced(user: ConnectedUser, message: WSMessage): void {
    // Add to message history
    this.addToMessageHistory(user.sessionId, message);
    
    // Broadcast to all users in session
    this.broadcastToSession(user.sessionId, message, user.userId);
    
    console.log(`📝 Tag placed by ${user.displayName} in session ${user.sessionId}`);
  }
  
  /**
   * Handle tag updates (drag, resize, etc.)
   */
  private handleTagUpdated(user: ConnectedUser, message: WSMessage): void {
    // Add to message history
    this.addToMessageHistory(user.sessionId, message);
    
    // Broadcast to all users in session
    this.broadcastToSession(user.sessionId, message, user.userId);
  }
  
  /**
   * Handle tag saved (coordinate changes)
   */
  private handleTagSaved(user: ConnectedUser, message: WSMessage): void {
    // Add to message history
    this.addToMessageHistory(user.sessionId, message);
    
    // Broadcast to all users in session
    this.broadcastToSession(user.sessionId, message, user.userId);
  }
  
  /**
   * Handle tag deletion
   */
  private handleTagDeleted(user: ConnectedUser, message: WSMessage): void {
    // Add to message history
    this.addToMessageHistory(user.sessionId, message);
    
    // Broadcast to all users in session
    this.broadcastToSession(user.sessionId, message, user.userId);
  }
  
  /**
   * Handle cursor movement
   */
  private handleCursorMoved(user: ConnectedUser, message: WSMessage): void {
    // Don't store cursor movements in history (too frequent)
    // Just broadcast to other users
    this.broadcastToSession(user.sessionId, message, user.userId);
  }
  
  /**
   * Handle page navigation
   */
  private handlePageChanged(user: ConnectedUser, message: WSMessage): void {
    user.currentPage = message.payload.pageNumber || 1;
    
    // Broadcast to all users
    this.broadcastToSession(user.sessionId, {
      ...message,
      payload: {
        ...message.payload,
        user: {
          userId: user.userId,
          displayName: user.displayName,
          currentPage: user.currentPage
        }
      }
    }, user.userId);
  }
  
  /**
   * Handle document switching
   */
  private handleDocumentSwitched(user: ConnectedUser, message: WSMessage): void {
    user.currentDocumentId = message.payload.documentId;
    user.currentPage = 1; // Reset to page 1 on document switch
    
    // Broadcast to all users
    this.broadcastToSession(user.sessionId, message, user.userId);
  }
  
  /**
   * Handle content replacement (Replace All button)
   */
  private handleContentReplaced(user: ConnectedUser, message: WSMessage): void {
    // Only notary can replace all content
    if (user.userType !== 'notary') {
      this.sendError(user, 'Only notary can replace all content');
      return;
    }
    
    // Add to message history
    this.addToMessageHistory(user.sessionId, message);
    
    // Broadcast to all users
    this.broadcastToSession(user.sessionId, message, user.userId);
    
    console.log(`🔄 Content replaced by notary ${user.displayName} in session ${user.sessionId}`);
  }

  /**
   * Handle tag content updated (when a tag is filled/completed)
   */
  private handleTagContentUpdated(user: ConnectedUser, message: WSMessage): void {
    // Add to message history
    this.addToMessageHistory(user.sessionId, message);
    
    // Broadcast to all users in session (except sender)
    this.broadcastToSession(user.sessionId, message, user.userId);
    
    const tagId = message.payload?.tagId;
    const tagType = message.payload?.tagType || 'unknown';
    console.log(`✏️ Tag content updated by ${user.displayName}: ${tagType} tag ${tagId} in session ${user.sessionId}`);
  }
  
  /**
   * Handle sync users command (notary only)
   */
  private handleSyncUsers(user: ConnectedUser, message: WSMessage): void {
    if (user.userType !== 'notary') {
      this.sendError(user, 'Only notary can sync users');
      return;
    }
    
    // Get page and document from message payload or use user's current state
    const pageNumber = message.payload?.pageNumber || user.currentPage || 1;
    const documentId = message.payload?.documentId || user.currentDocumentId;
    
    // Broadcast to all users to sync to notary's view
    this.broadcastToSession(user.sessionId, {
      type: 'sync_to_notary',
      payload: {
        pageNumber,
        documentId,
        notaryName: user.displayName,
        syncedBy: user.userId,
        timestamp: Date.now()
      },
      userId: user.userId,
      sessionId: user.sessionId,
      timestamp: Date.now()
    });
    
    console.log(`🔗 Users synced by notary ${user.displayName} to page ${pageNumber}${documentId ? ` of document ${documentId}` : ''}`);
  }
  
  /**
   * Handle user typing events
   */
  private handleUserTyping(user: ConnectedUser, message: WSMessage): void {
    // Broadcast typing indicator to other users
    this.broadcastToSession(user.sessionId, message, user.userId);
  }

  /**
   * Handle real-time text input content changes
   */
  private handleTextInputChanged(user: ConnectedUser, message: WSMessage): void {
    // Don't store every keystroke in history (too frequent)
    // Just broadcast to other users for real-time updates
    this.broadcastToSession(user.sessionId, {
      ...message,
      payload: {
        ...message.payload,
        userId: user.userId,
        displayName: user.displayName,
        timestamp: Date.now()
      }
    }, user.userId);
    
    console.log(`✏️ Text input changed by ${user.displayName}: ${message.payload?.textInputId} in session ${user.sessionId}`);
  }

  /**
   * Handle text input creation
   */
  private handleTextInputCreated(user: ConnectedUser, message: WSMessage): void {
    // Add to message history for new text inputs
    this.addToMessageHistory(user.sessionId, message);
    
    // Broadcast to all users in session
    this.broadcastToSession(user.sessionId, {
      ...message,
      payload: {
        ...message.payload,
        createdBy: user.userId,
        createdByName: user.displayName,
        timestamp: Date.now()
      }
    }, user.userId);
    
    console.log(`📝 Text input created by ${user.displayName} in session ${user.sessionId}`);
  }

  /**
   * Handle text input deletion
   */
  private handleTextInputDeleted(user: ConnectedUser, message: WSMessage): void {
    // Add to message history
    this.addToMessageHistory(user.sessionId, message);
    
    // Broadcast to all users in session
    this.broadcastToSession(user.sessionId, {
      ...message,
      payload: {
        ...message.payload,
        deletedBy: user.userId,
        deletedByName: user.displayName,
        timestamp: Date.now()
      }
    }, user.userId);
    
    console.log(`🗑️ Text input deleted by ${user.displayName}: ${message.payload?.textInputId} in session ${user.sessionId}`);
  }

  /**
   * Handle text input position/size updates
   */
  private handleTextInputPositionUpdated(user: ConnectedUser, message: WSMessage): void {
    // Don't store every drag/resize in history (too frequent)
    // Just broadcast to other users for real-time updates
    this.broadcastToSession(user.sessionId, {
      ...message,
      payload: {
        ...message.payload,
        updatedBy: user.userId,
        updatedByName: user.displayName,
        timestamp: Date.now()
      }
    }, user.userId);

    // ✅ ENHANCED: Add logging for text tag resize events
    const textInputId = message.payload?.textInputId;
    const coordinates = message.payload?.coordinates;
    console.log(`📏 Text input resized by ${user.displayName}: ${textInputId} to ${coordinates?.width}x${coordinates?.height} at (${coordinates?.x}, ${coordinates?.y}) in session ${user.sessionId}`);
  }
  
  /**
   * Add user to session room
   */
  private addUserToSession(user: ConnectedUser): void {
    if (!this.sessions.has(user.sessionId)) {
      this.sessions.set(user.sessionId, {
        sessionId: user.sessionId,
        users: new Map(),
        lastActivity: new Date(),
        messageHistory: []
      });
    }
    
    const session = this.sessions.get(user.sessionId)!;
    session.users.set(user.id, user);
    session.lastActivity = new Date();
    
    this.userConnections.set(user.id, user);
  }
  
  /**
   * Remove user from session room
   */
  private removeUserFromSession(user: ConnectedUser): void {
    const session = this.sessions.get(user.sessionId);
    if (session) {
      session.users.delete(user.id);
      
      // Notify other users
      this.broadcastToSession(user.sessionId, {
        type: 'user_left',
        payload: {
          userId: user.userId,
          displayName: user.displayName
        },
        userId: user.userId,
        sessionId: user.sessionId,
        timestamp: Date.now()
      }, user.userId);
      
      // Remove session if empty
      if (session.users.size === 0) {
        this.sessions.delete(user.sessionId);
        console.log(`🗑️ Removed empty session: ${user.sessionId}`);
      }
    }
    
    this.userConnections.delete(user.id);
    
    if (this.shouldLogEvent(user.userId, 'leave')) {
      console.log(`👋 User ${user.displayName} left session ${user.sessionId}`);
    }
  }
  
  /**
   * Send message to specific user
   */
  private sendToUser(user: ConnectedUser, message: WSMessage): void {
    if (user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(JSON.stringify(message));
    }
  }
  
  /**
   * Send error message to user
   */
  private sendError(user: ConnectedUser, error: string): void {
    this.sendToUser(user, {
      type: 'error',
      payload: { message: error },
      userId: 'system',
      sessionId: user.sessionId,
      timestamp: Date.now()
    });
  }
  
  /**
   * Broadcast message to all users in session
   */
  private broadcastToSession(sessionId: string, message: WSMessage, excludeUserId?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    session.users.forEach(user => {
      if (excludeUserId && user.userId === excludeUserId) return;
      
      if (user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(JSON.stringify(message));
      }
    });
  }
  
  /**
   * Get session participants
   */
  private getSessionParticipants(sessionId: string): any[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    
    return Array.from(session.users.values()).map(user => ({
      userId: user.userId,
      userType: user.userType,
      displayName: user.displayName,
      currentPage: user.currentPage,
      currentDocumentId: user.currentDocumentId,
      lastActivity: user.lastActivity
    }));
  }
  
  /**
   * Add message to session history
   */
  private addToMessageHistory(sessionId: string, message: WSMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    session.messageHistory.push(message);
    
    // Keep only last 1000 messages
    if (session.messageHistory.length > 1000) {
      session.messageHistory = session.messageHistory.slice(-1000);
    }
  }
  
  /**
   * Cleanup inactive sessions
   */
  private cleanupInactiveSessions(): void {
    const now = new Date();
    const timeout = 30 * 60 * 1000; // 30 minutes
    
    this.sessions.forEach((session, sessionId) => {
      if (now.getTime() - session.lastActivity.getTime() > timeout) {
        // Close all connections in inactive session
        session.users.forEach(user => {
          if (user.ws.readyState === WebSocket.OPEN) {
            user.ws.close(1000, 'Session timeout');
          }
        });
        
        this.sessions.delete(sessionId);
        console.log(`🧹 Cleaned up inactive session: ${sessionId}`);
      }
    });
  }
  
  /**
   * Get session statistics
   */
  public getStats(): any {
    return {
      activeSessions: this.sessions.size,
      connectedUsers: this.userConnections.size,
      sessionDetails: Array.from(this.sessions.entries()).map(([id, session]) => ({
        sessionId: id,
        userCount: session.users.size,
        lastActivity: session.lastActivity,
        messageCount: session.messageHistory.length
      }))
    };
  }
}

export default WebSocketService; 