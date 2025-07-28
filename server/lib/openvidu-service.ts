import { OpenVidu, Session, Recording, OpenViduRole } from 'openvidu-node-client';

interface OpenViduConfig {
  url: string;
  secret: string;
}

interface SessionOptions {
  customSessionId?: string;
}

interface TokenOptions {
  data?: string;
  role?: OpenViduRole;
}

interface ParticipantData {
  userId: number;
  role: string;
  displayName: string;
  email: string;
}

interface OpenViduSessionData {
  sessionId: string;
  sessionToken: string;
  participants: Array<{
    token: string;
    connectionId: string;
    role: string;
    data: string;
  }>;
}

interface RecordingData {
  recordingId: string;
  sessionId: string;
  status: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  size?: number;
  downloadUrl?: string;
  vultrStorageUrl?: string;
}

class OpenViduService {
  private openvidu: OpenVidu | null = null;
  private config: OpenViduConfig;
  private isConfigured: boolean;
  private activeSessions: Map<string, Session> = new Map();
  private activeRecordings: Map<string, Recording> = new Map();

  constructor() {
    this.config = {
      url: process.env.OPENVIDU_SERVER_URL || 'https://openvidu-dev-production.up.railway.app',
      secret: process.env.OPENVIDU_SECRET || ''
    };

    this.isConfigured = !!(this.config.secret && this.config.url && this.config.secret !== 'MY_SECRET');

    if (this.isConfigured) {
      try {
        this.openvidu = new OpenVidu(this.config.url, this.config.secret);
        console.log('✅ OpenVidu service configured successfully');
        console.log(`📡 OpenVidu Server URL: ${this.config.url}`);
      } catch (error) {
        console.error('❌ Error initializing OpenVidu:', error);
        this.isConfigured = false;
        this.openvidu = null;
      }
    } else {
      console.warn(`
        ⚠️ OpenVidu service not configured. Video features will be disabled.
        Required environment variables:
        - OPENVIDU_SERVER_URL (current: ${this.config.url})
        - OPENVIDU_SECRET (current: ${this.config.secret ? 'SET' : 'NOT SET'})
        
        Please configure these variables and restart the server to enable video features.
      `);
    }
  }

  // Check if service is properly configured
  private ensureConfigured(): void {
    if (!this.isConfigured || !this.openvidu) {
      throw new Error(`
        OpenVidu service is not configured. Required environment variables:
        - OPENVIDU_SERVER_URL (current: ${this.config.url})
        - OPENVIDU_SECRET (current: ${this.config.secret ? 'SET' : 'NOT SET'})
        
        Please configure these variables and restart the server.
      `);
    }
  }

  // Get configuration status
  getConfigStatus() {
    return {
      configured: this.isConfigured,
      serverUrl: this.config.url,
      hasSecret: !!this.config.secret
    };
  }

  // Create a new session
  async createSession(options: SessionOptions = {}): Promise<Session> {
    this.ensureConfigured();
    
    try {
      console.log('🎥 Creating OpenVidu session with options:', options);

      const sessionProperties = {
        customSessionId: options.customSessionId
      };

      const session = await this.openvidu!.createSession(sessionProperties);
      
      // Store session reference
      this.activeSessions.set(session.sessionId, session);

      console.log('✅ OpenVidu session created:', {
        sessionId: session.sessionId
      });

      return session;
    } catch (error) {
      console.error('❌ Error creating OpenVidu session:', error);
      throw new Error(`Failed to create video session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Generate token for a participant
  async generateToken(sessionId: string, tokenOptions: TokenOptions = {}): Promise<string> {
    this.ensureConfigured();
    
    try {
      let session = this.activeSessions.get(sessionId);
      
      // If session doesn't exist, create it
      if (!session) {
        console.log(`🔄 Session ${sessionId} not found, creating new session...`);
        session = await this.createSession({ customSessionId: sessionId });
      }

      // Set default role based on participant data
      const role = tokenOptions.role || OpenViduRole.PUBLISHER;

      const connectionProperties = {
        data: tokenOptions.data || '',
        role: role
      };

      const connection = await session.createConnection(connectionProperties);
      
      console.log('✅ Token generated for session:', {
        sessionId,
        role,
        connectionId: connection.connectionId
      });

      return connection.token;
    } catch (error) {
      console.error('❌ Error generating token:', error);
      throw new Error(`Failed to generate access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Create session with participants
  async createSessionWithParticipants(
    sessionId: string, 
    participants: ParticipantData[]
  ): Promise<OpenViduSessionData> {
    try {
      // Create session
      const session = await this.createSession({ 
        customSessionId: sessionId
      });

      // Generate tokens for all participants
      const participantTokens = await Promise.all(
        participants.map(async (participant) => {
          const role = this.mapRoleToOpenViduRole(participant.role);
          const participantData = JSON.stringify({
            userId: participant.userId,
            role: participant.role,
            displayName: participant.displayName,
            email: participant.email
          });

          const token = await this.generateToken(session.sessionId, {
            data: participantData,
            role: role
          });

          return {
            token,
            connectionId: `connection-${participant.userId}-${Date.now()}`,
            role: participant.role,
            data: participantData
          };
        })
      );

      const sessionData: OpenViduSessionData = {
        sessionId: session.sessionId,
        sessionToken: participantTokens[0]?.token || '',
        participants: participantTokens
      };

      console.log('✅ Session created with participants:', {
        sessionId: sessionData.sessionId,
        participantCount: participantTokens.length
      });

      return sessionData;
    } catch (error) {
      console.error('❌ Error creating session with participants:', error);
      throw error;
    }
  }

  // Start recording
  async startRecording(
    sessionId: string,
    options: {
      layout?: string;
      resolution?: string;
      frameRate?: number;
    } = {}
  ): Promise<RecordingData> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Use simple recording properties that work with OpenVidu
      const recordingName = `recording-${sessionId}-${Date.now()}`;

      console.log('🎬 Starting recording for session:', sessionId);

      const recording = await this.openvidu!.startRecording(sessionId, recordingName);
      
      // Store recording reference
      this.activeRecordings.set(recording.id, recording);

      const recordingData: RecordingData = {
        recordingId: recording.id,
        sessionId: recording.sessionId,
        status: recording.status.toString(),
        startTime: new Date(recording.createdAt),
        size: recording.size
      };

      console.log('✅ Recording started:', recordingData);

      return recordingData;
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      throw new Error(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Stop recording
  async stopRecording(recordingId: string): Promise<RecordingData> {
    try {
      const recording = await this.openvidu!.stopRecording(recordingId);
      
      // Remove from active recordings
      this.activeRecordings.delete(recordingId);

      const recordingData: RecordingData = {
        recordingId: recording.id,
        sessionId: recording.sessionId,
        status: recording.status.toString(),
        startTime: new Date(recording.createdAt),
        endTime: new Date(),
        duration: recording.duration,
        size: recording.size,
        downloadUrl: recording.url
      };

      console.log('✅ Recording stopped:', recordingData);

      return recordingData;
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
      throw new Error(`Failed to stop recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get recording info
  async getRecording(recordingId: string): Promise<RecordingData | null> {
    try {
      const recording = await this.openvidu!.getRecording(recordingId);

      return {
        recordingId: recording.id,
        sessionId: recording.sessionId,
        status: recording.status.toString(),
        startTime: new Date(recording.createdAt),
        duration: recording.duration,
        size: recording.size,
        downloadUrl: recording.url
      };
    } catch (error) {
      console.error('❌ Error getting recording:', error);
      return null;
    }
  }

  // List recordings for a session
  async getSessionRecordings(sessionId: string): Promise<RecordingData[]> {
    try {
      const recordings = await this.openvidu!.listRecordings();
      
      return recordings
        .filter(recording => recording.sessionId === sessionId)
        .map(recording => ({
          recordingId: recording.id,
          sessionId: recording.sessionId,
          status: recording.status.toString(),
          startTime: new Date(recording.createdAt),
          duration: recording.duration,
          size: recording.size,
          downloadUrl: recording.url
        }));
    } catch (error) {
      console.error('❌ Error listing recordings:', error);
      return [];
    }
  }

  // Close session
  async closeSession(sessionId: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        console.warn(`Session ${sessionId} not found in active sessions`);
        return false;
      }

      await session.close();
      this.activeSessions.delete(sessionId);

      console.log('✅ Session closed:', sessionId);
      return true;
    } catch (error) {
      console.error('❌ Error closing session:', error);
      return false;
    }
  }

  // Helper: Map role to OpenVidu role
  private mapRoleToOpenViduRole(role: string): OpenViduRole {
    switch (role.toLowerCase()) {
      case 'notary':
      case 'admin':
        return OpenViduRole.MODERATOR;
      case 'signer':
      case 'witness':
        return OpenViduRole.PUBLISHER;
      case 'observer':
        return OpenViduRole.SUBSCRIBER;
      default:
        return OpenViduRole.PUBLISHER;
    }
  }

  // Get active sessions count
  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  // Get active recordings count
  getActiveRecordingsCount(): number {
    return this.activeRecordings.size;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; info: any }> {
    if (!this.isConfigured) {
      return {
        status: 'error',
        info: {
          configured: false,
          message: 'OpenVidu not configured'
        }
      };
    }

    try {
      // Try a simple health check by listing recordings
      const recordings = await this.openvidu!.listRecordings();
      
      return {
        status: 'healthy',
        info: {
          configured: true,
          serverUrl: this.config.url,
          activeSessions: this.getActiveSessionsCount(),
          activeRecordings: this.getActiveRecordingsCount(),
          recordingsCount: recordings.length,
          connected: true
        }
      };
    } catch (error) {
      console.error('❌ OpenVidu health check failed:', error);
      
      return {
        status: 'error',
        info: {
          configured: true,
          error: error instanceof Error ? error.message : 'Unknown error',
          serverUrl: this.config.url
        }
      };
    }
  }
}

// Export singleton instance
export const openViduService = new OpenViduService(); 