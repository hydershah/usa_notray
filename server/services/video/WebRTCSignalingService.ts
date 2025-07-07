import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';

interface SessionParticipant {
  userId: string;
  userName: string;
  userRole: 'notary' | 'signer' | 'witness';
  email?: string;
  socketId: string;
  sessionId: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  joinedAt: Date;
}

interface VideoSession {
  sessionId: string;
  participants: Map<string, SessionParticipant>;
  createdAt: Date;
  isRecording: boolean;
}

export class WebRTCSignalingService {
  private io: SocketIOServer;
  private sessions: Map<string, VideoSession> = new Map();
  private participantToSession: Map<string, string> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? process.env.CLIENT_URL || "https://your-domain.com"
          : ["http://localhost:3000", "http://localhost:3002", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:3002"],
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/video-signaling/socket.io',
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupNamespace();
  }

  private setupNamespace() {
    const videoNamespace = this.io.of('/video-signaling');

    // Authentication middleware
    videoNamespace.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          console.error('WebRTC auth: No token provided');
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        
        if (!decoded.id) {
          console.error('WebRTC auth: Invalid token - no user ID');
          return next(new Error('Invalid token'));
        }

        // Add user info to socket
        socket.data.userId = decoded.id.toString();
        socket.data.userEmail = decoded.email;
        socket.data.sessionId = socket.handshake.query.sessionId as string;
        socket.data.userName = socket.handshake.query.userName as string;
        socket.data.userRole = socket.handshake.query.userRole as string;

        console.log(`🔑 WebRTC auth successful for user: ${decoded.id} (${socket.data.userName})`);
        next();
      } catch (error) {
        console.error('WebRTC authentication error:', error);
        if (error instanceof Error) {
          next(new Error(`Authentication failed: ${error.message}`));
        } else {
          next(new Error('Authentication failed'));
        }
      }
    });

    videoNamespace.on('connection', (socket) => {
      console.log(`🎥 Video participant connected: ${socket.data.userName} (${socket.data.userId}) to session ${socket.data.sessionId}`);
      
      this.handleParticipantJoin(socket);
      this.setupSocketEvents(socket);
    });

    // Handle namespace-level errors
    videoNamespace.on('connect_error', (error) => {
      console.error('🚨 WebRTC namespace connection error:', error);
    });
  }

  private handleParticipantJoin(socket: any) {
    const { userId, userName, userRole, sessionId, userEmail } = socket.data;

    // Get or create session
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        participants: new Map(),
        createdAt: new Date(),
        isRecording: false
      };
      this.sessions.set(sessionId, session);
      console.log(`📹 Created new video session: ${sessionId}`);
    }

    // Create participant
    const participant: SessionParticipant = {
      userId,
      userName,
      userRole,
      email: userEmail,
      socketId: socket.id,
      sessionId,
      isAudioEnabled: true,
      isVideoEnabled: true,
      isScreenSharing: false,
      joinedAt: new Date()
    };

    // Add participant to session
    session.participants.set(userId, participant);
    this.participantToSession.set(socket.id, sessionId);

    // Notify existing participants about new participant
    socket.to(sessionId).emit('participant-joined', {
      userId: participant.userId,
      userName: participant.userName,
      userRole: participant.userRole,
      email: participant.email,
      isAudioEnabled: participant.isAudioEnabled,
      isVideoEnabled: participant.isVideoEnabled,
      isScreenSharing: participant.isScreenSharing
    });

    // Send current participants list to new participant
    const participantsList = Array.from(session.participants.values())
      .filter(p => p.userId !== userId)
      .map(p => ({
        userId: p.userId,
        userName: p.userName,
        userRole: p.userRole,
        email: p.email,
        isAudioEnabled: p.isAudioEnabled,
        isVideoEnabled: p.isVideoEnabled,
        isScreenSharing: p.isScreenSharing
      }));

    socket.emit('participants-list', participantsList);
    
    // Join socket room for this session
    socket.join(sessionId);

    console.log(`👋 ${userName} joined video session ${sessionId}. Total participants: ${session.participants.size}`);
  }

  private setupSocketEvents(socket: any) {
    const { userId, sessionId } = socket.data;

    // WebRTC signaling events
    socket.on('offer', (data: { offer: RTCSessionDescriptionInit; to: string }) => {
      console.log(`📞 Offer from ${userId} to ${data.to}`);
      const session = this.sessions.get(sessionId);
      const targetParticipant = session?.participants.get(data.to);
      
      if (targetParticipant) {
        socket.to(targetParticipant.socketId).emit('offer', {
          offer: data.offer,
          from: userId
        });
      }
    });

    socket.on('answer', (data: { answer: RTCSessionDescriptionInit; to: string }) => {
      console.log(`📞 Answer from ${userId} to ${data.to}`);
      const session = this.sessions.get(sessionId);
      const targetParticipant = session?.participants.get(data.to);
      
      if (targetParticipant) {
        socket.to(targetParticipant.socketId).emit('answer', {
          answer: data.answer,
          from: userId
        });
      }
    });

    socket.on('ice-candidate', (data: { candidate: RTCIceCandidateInit; to: string }) => {
      const session = this.sessions.get(sessionId);
      const targetParticipant = session?.participants.get(data.to);
      
      if (targetParticipant) {
        socket.to(targetParticipant.socketId).emit('ice-candidate', {
          candidate: data.candidate,
          from: userId
        });
      }
    });

    // Media state changes
    socket.on('media-state-change', (data: { 
      isAudioEnabled: boolean; 
      isVideoEnabled: boolean; 
      isScreenSharing: boolean 
    }) => {
      const session = this.sessions.get(sessionId);
      const participant = session?.participants.get(userId);
      
      if (participant) {
        participant.isAudioEnabled = data.isAudioEnabled;
        participant.isVideoEnabled = data.isVideoEnabled;
        participant.isScreenSharing = data.isScreenSharing;

        // Notify other participants
        socket.to(sessionId).emit('participant-media-state', {
          userId,
          isAudioEnabled: data.isAudioEnabled,
          isVideoEnabled: data.isVideoEnabled,
          isScreenSharing: data.isScreenSharing
        });

        console.log(`🎛️ ${participant.userName} updated media state:`, {
          audio: data.isAudioEnabled,
          video: data.isVideoEnabled,
          screen: data.isScreenSharing
        });
      }
    });

    // Session recording controls
    socket.on('start-recording', () => {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.isRecording = true;
        socket.to(sessionId).emit('recording-started', { startedBy: userId });
        console.log(`🔴 Recording started for session ${sessionId} by ${userId}`);
      }
    });

    socket.on('stop-recording', () => {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.isRecording = false;
        socket.to(sessionId).emit('recording-stopped', { stoppedBy: userId });
        console.log(`⏹️ Recording stopped for session ${sessionId} by ${userId}`);
      }
    });

    // Chat messages (optional feature)
    socket.on('chat-message', (data: { message: string; timestamp: Date }) => {
      const session = this.sessions.get(sessionId);
      const participant = session?.participants.get(userId);
      
      if (participant) {
        socket.to(sessionId).emit('chat-message', {
          userId,
          userName: participant.userName,
          userRole: participant.userRole,
          message: data.message,
          timestamp: data.timestamp
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleParticipantLeave(socket);
    });

    // Explicit leave
    socket.on('leave-session', () => {
      this.handleParticipantLeave(socket);
    });
  }

  private handleParticipantLeave(socket: any) {
    const { userId, userName } = socket.data;
    const sessionId = this.participantToSession.get(socket.id);
    
    if (!sessionId) return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Remove participant
    session.participants.delete(userId);
    this.participantToSession.delete(socket.id);

    // Notify other participants
    socket.to(sessionId).emit('participant-left', { userId });

    console.log(`👋 ${userName} left video session ${sessionId}. Remaining participants: ${session.participants.size}`);

    // Clean up empty sessions
    if (session.participants.size === 0) {
      this.sessions.delete(sessionId);
      console.log(`🧹 Cleaned up empty video session: ${sessionId}`);
    }
  }

  // Public methods for session management
  public getSessionInfo(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId: session.sessionId,
      participantCount: session.participants.size,
      participants: Array.from(session.participants.values()).map(p => ({
        userId: p.userId,
        userName: p.userName,
        userRole: p.userRole,
        isAudioEnabled: p.isAudioEnabled,
        isVideoEnabled: p.isVideoEnabled,
        isScreenSharing: p.isScreenSharing,
        joinedAt: p.joinedAt
      })),
      createdAt: session.createdAt,
      isRecording: session.isRecording
    };
  }

  public endSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Notify all participants that session is ending
    this.io.of('/video-signaling').to(sessionId).emit('session-ended', {
      sessionId,
      endedAt: new Date()
    });

    // Remove all participants and clean up
    session.participants.forEach((participant) => {
      this.participantToSession.delete(participant.socketId);
    });

    this.sessions.delete(sessionId);
    console.log(`🏁 Video session ${sessionId} ended`);
    
    return true;
  }

  public getAllSessions() {
    return Array.from(this.sessions.keys()).map(sessionId => 
      this.getSessionInfo(sessionId)
    );
  }

  // Kick participant (admin function)
  public kickParticipant(sessionId: string, userId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const participant = session.participants.get(userId);
    if (!participant) return false;

    // Find socket and disconnect
    const socket = this.io.of('/video-signaling').sockets.get(participant.socketId);
    if (socket) {
      socket.emit('kicked-from-session', { reason: 'Removed by administrator' });
      socket.disconnect();
    }

    return true;
  }
} 