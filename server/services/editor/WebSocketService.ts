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
  private wss: WebSocketServer;
  private sessions: Map<string, SessionRoom> = new Map();
  private userConnections: Map<string, ConnectedUser> = new Map();
  
  constructor(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/editor',
      verifyClient: this.verifyClient.bind(this)
    });
    
    this.wss.on('connection', this.handleConnection.bind(this));
    
    // Cleanup inactive sessions every 5 minutes
    setInterval(this.cleanupInactiveSessions.bind(this), 5 * 60 * 1000);
    
    console.log('🔗 WebSocket service initialized for PDF Editor');
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
      
      console.log(`✅ User ${connectedUser.displayName} joined session ${sessionId}`);
      
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
      
      // Handle different message types
      switch (message.type) {
        case 'tag_placed':
          this.handleTagPlaced(user, message);
          break;
          
        case 'tag_updated':
          this.handleTagUpdated(user, message);
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
   * Handle sync users command (notary only)
   */
  private handleSyncUsers(user: ConnectedUser, message: WSMessage): void {
    if (user.userType !== 'notary') {
      this.sendError(user, 'Only notary can sync users');
      return;
    }
    
    // Broadcast to all users to sync to notary's view
    this.broadcastToSession(user.sessionId, {
      type: 'sync_to_notary',
      payload: {
        pageNumber: user.currentPage,
        documentId: user.currentDocumentId,
        notaryName: user.displayName
      },
      userId: user.userId,
      sessionId: user.sessionId,
      timestamp: Date.now()
    });
    
    console.log(`🔗 Users synced by notary ${user.displayName} to page ${user.currentPage}`);
  }
  
  /**
   * Handle user typing events
   */
  private handleUserTyping(user: ConnectedUser, message: WSMessage): void {
    // Broadcast typing indicator to other users
    this.broadcastToSession(user.sessionId, message, user.userId);
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
    
    console.log(`👋 User ${user.displayName} left session ${user.sessionId}`);
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