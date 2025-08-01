import fetch from 'node-fetch';

interface DailyConfig {
  apiKey: string;
  apiUrl: string;
  domain: string;
}

interface DailyMeetingOptions {
  roomNamePrefix?: string;
  startDate?: string;
  endDate?: string;
  isPrivate?: boolean;
  maxParticipants?: number;
  enableRecording?: boolean;
  roomNamePattern?: string;
}

interface DailyMeeting {
  meetingId: string;
  roomUrl: string;
  hostRoomUrl: string;
  roomName: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
}

interface DailyRecording {
  recordingId: string;
  roomName: string;
  createdDate: string;
  status: 'recording' | 'processing' | 'available' | 'failed';
  downloadUrl?: string;
}

interface SessionParticipant {
  userId: number;
  role: 'notary' | 'signer' | 'witness' | 'observer';
  displayName: string;
  email: string;
  isInWaitingRoom: boolean;
  admittedAt?: Date;
}

class DailyService {
  private config: DailyConfig;
  private isConfigured: boolean;

  constructor() {
    this.config = {
      apiKey: process.env.DAILY_API_KEY || '',
      apiUrl: 'https://api.daily.co/v1',
      domain: process.env.DAILY_DOMAIN || process.env.DAILY_BASE_URL?.replace('https://', '').replace('http://', '') || ''
    };
    
    this.isConfigured = !!this.config.apiKey && !!this.config.domain;
    
    if (!this.isConfigured) {
      if (!this.config.apiKey) {
        console.warn('⚠️ Daily API key not configured. Set DAILY_API_KEY environment variable.');
      }
      if (!this.config.domain) {
        console.warn('⚠️ Daily domain not configured. Set DAILY_DOMAIN or DAILY_BASE_URL environment variable.');
      }
      console.warn('⚠️ Video conferencing will use fallback implementation.');
    } else {
      console.log('✅ Daily service configured with API key and domain:', this.config.domain);
    }
  }

  // Create a new video meeting room
  async createMeeting(options: DailyMeetingOptions = {}): Promise<DailyMeeting> {
    if (!this.isConfigured) {
      console.log('🔄 Using fallback meeting creation (Daily not configured)');
      return this.createFallbackMeeting(options);
    }

    try {
      const roomName = this.generateRoomName(options.roomNamePrefix);
      
      const roomConfig = {
        name: roomName,
        privacy: options.isPrivate ? 'private' : 'public',
        properties: {
          max_participants: options.maxParticipants || 8,
          enable_screenshare: true,
          enable_chat: true,
          enable_knocking: true,
          enable_prejoin_ui: true,
          enable_network_ui: true,
          enable_recording: 'cloud',
          start_audio_off: false,
          start_video_off: false,
          owner_only_broadcast: false,
          lang: 'en',
          ...(options.startDate && { nbf: Math.floor(new Date(options.startDate).getTime() / 1000) }),
          ...(options.endDate && { exp: Math.floor(new Date(options.endDate).getTime() / 1000) })
        }
      };

      console.log('🔗 Creating Daily room with config:', roomConfig);

      const response = await fetch(`${this.config.apiUrl}/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(roomConfig)
      });

      console.log('📡 Daily API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Daily API error:', response.status, errorText);
        
        // Don't fall back to mock for production - throw error instead
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Daily API error: ${response.status} - ${errorText}`);
        }
        
        console.log('🔄 Development mode: using fallback meeting');
        return this.createFallbackMeeting(options);
      }

      const data = await response.json();
      console.log('✅ Daily room created successfully:', data);
      
      const roomUrl = `https://${this.config.domain}/${roomName}`;
      
      // Generate host token
      const hostToken = await this.generateMeetingToken(roomName, true);
      const hostRoomUrl = hostToken ? `${roomUrl}?t=${hostToken}` : roomUrl;
      
      return {
        meetingId: data.id || roomName,
        roomUrl: roomUrl,
        hostRoomUrl: hostRoomUrl,
        roomName: roomName,
        startDate: options.startDate || new Date().toISOString(),
        endDate: options.endDate || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
        isLocked: options.isPrivate || false
      };
    } catch (error) {
      console.error('❌ Error creating Daily room:', error);
      
      // In production, throw the error - don't mask it
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Failed to create video session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      console.log('🔄 Development mode: using fallback meeting');
      return this.createFallbackMeeting(options);
    }
  }

  // Generate a unique room name
  private generateRoomName(prefix: string = 'notary-session'): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${randomId}`;
  }

  // Generate meeting token for participants
  private async generateMeetingToken(roomName: string, isOwner: boolean = false): Promise<string> {
    if (!this.isConfigured) {
      console.warn('⚠️ Daily service not configured, skipping token generation');
      return '';
    }

    try {
      console.log(`🎫 Generating ${isOwner ? 'host' : 'participant'} token for room: ${roomName}`);
      
      const tokenConfig = {
        properties: {
          room_name: roomName,
          is_owner: isOwner,
          enable_screenshare: true,
          start_audio_off: false,
          start_video_off: false,
          // Add expiration time (1 hour from now)
          exp: Math.floor(Date.now() / 1000) + 3600
        }
      };

      console.log('🎫 Token config:', tokenConfig);

      const response = await fetch(`${this.config.apiUrl}/meeting-tokens`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tokenConfig)
      });

      console.log('🎫 Token API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ Failed to create meeting token (${response.status}): ${errorText}`);
        console.warn('⚠️ Continuing without token - room will be public');
        return '';
      }

      const data = await response.json();
      console.log('✅ Meeting token created successfully');
      return data.token;
    } catch (error) {
      console.warn('⚠️ Error creating meeting token:', error);
      console.warn('⚠️ Continuing without token - room will be public');
      return '';
    }
  }

  // Create fallback meeting for development/testing
  private createFallbackMeeting(options: DailyMeetingOptions = {}): DailyMeeting {
    const timestamp = Date.now();
    const roomName = `${options.roomNamePrefix || 'notary-session'}-${timestamp}`;
    
    console.log('🎭 Creating fallback meeting for development:', roomName);
    
    const domain = this.config.domain || 'your-domain.daily.co';
    
    return {
      meetingId: `fallback-${timestamp}`,
      roomUrl: `https://${domain}/${roomName}`,
      hostRoomUrl: `https://${domain}/${roomName}?owner=true`,
      roomName,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
      isLocked: false
    };
  }

  // Start recording a session
  async startRecording(roomName: string): Promise<{ recordingId: string }> {
    if (!this.isConfigured) {
      console.log('🎬 Mock recording started (Daily not configured)');
      return { recordingId: `mock-recording-${Date.now()}` };
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/recordings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            room_name: roomName,
            layout: {
              preset: 'default'
            }
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Daily recording API error:', response.status, errorText);
        
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Recording failed: ${response.status} - ${errorText}`);
        }
        
        return { recordingId: `fallback-recording-${Date.now()}` };
      }

      const data = await response.json();
      console.log('✅ Recording started:', data);
      return { recordingId: data.id };
    } catch (error) {
      console.error('❌ Error starting Daily recording:', error);
      
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
      
      // Return mock recording ID for development
      return { recordingId: `fallback-recording-${Date.now()}` };
    }
  }

  // Stop recording a session
  async stopRecording(recordingId: string): Promise<{ status: string }> {
    if (!this.isConfigured) {
      console.log('🛑 Mock recording stopped (Daily not configured)');
      return { status: 'stopped' };
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/recordings/${recordingId}/stop`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Daily stop recording API error:', response.status, errorText);
        
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Stop recording failed: ${response.status} - ${errorText}`);
        }
      }

      console.log('✅ Recording stopped');
      return { status: 'stopped' };
    } catch (error) {
      console.error('❌ Error stopping Daily recording:', error);
      
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
      
      return { status: 'stopped' };
    }
  }

  // Get recording details and download URL
  async getRecording(recordingId: string): Promise<DailyRecording | null> {
    if (!this.isConfigured) {
      console.log('📹 Mock recording info (Daily not configured)');
      return null;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/recordings/${recordingId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorText = await response.text();
        console.error('❌ Daily get recording API error:', response.status, errorText);
        
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Get recording failed: ${response.status} - ${errorText}`);
        }
        
        return null;
      }

      const data = await response.json();
      
      return {
        recordingId: data.id,
        roomName: data.room_name,
        createdDate: data.created_at,
        status: this.mapRecordingStatus(data.status),
        downloadUrl: data.download_link
      };
    } catch (error) {
      console.error('❌ Error getting Daily recording:', error);
      
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
      
      return null;
    }
  }

  // Map Daily recording status to our interface
  private mapRecordingStatus(dailyStatus: string): 'recording' | 'processing' | 'available' | 'failed' {
    switch (dailyStatus) {
      case 'recording':
        return 'recording';
      case 'processing':
      case 'uploading':
        return 'processing';
      case 'finished':
        return 'available';
      case 'error':
      case 'failed':
        return 'failed';
      default:
        return 'processing';
    }
  }

  // Delete a meeting room
  async deleteMeeting(meetingId: string): Promise<void> {
    if (!this.isConfigured) {
      console.log('🗑️ Mock meeting deleted (Daily not configured)');
      return;
    }

    try {
      // For Daily.co, we delete the room using the room name
      const response = await fetch(`${this.config.apiUrl}/rooms/${meetingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Daily delete room API error:', response.status, errorText);
        // Non-critical error, continue
      } else {
        console.log('✅ Room deleted successfully');
      }
    } catch (error) {
      console.error('❌ Error deleting Daily room:', error);
      // Non-critical error, continue
    }
  }

  // Validate configuration
  validateConfiguration(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.config.apiKey) {
      if (process.env.NODE_ENV === 'production') {
        errors.push('DAILY_API_KEY environment variable is required for production');
      } else {
        warnings.push('DAILY_API_KEY not configured - using fallback implementation for development');
      }
    }

    if (!this.config.domain) {
      if (process.env.NODE_ENV === 'production') {
        errors.push('DAILY_DOMAIN or DAILY_BASE_URL environment variable is required for production');
      } else {
        warnings.push('DAILY_DOMAIN not configured - using fallback implementation for development');
      }
    }

    if (!this.config.apiUrl) {
      errors.push('Invalid Daily API URL configuration');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Get meeting details
  async getMeeting(meetingId: string): Promise<DailyMeeting | null> {
    if (!this.isConfigured) {
      console.log('📋 Mock meeting info (Daily not configured)');
      return null;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/rooms/${meetingId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorText = await response.text();
        console.error('❌ Daily get room API error:', response.status, errorText);
        
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Get room failed: ${response.status} - ${errorText}`);
        }
        
        return null;
      }

      const data = await response.json();
      const roomUrl = `https://${this.config.domain}/${data.name}`;
      
      return {
        meetingId: data.id,
        roomUrl: roomUrl,
        hostRoomUrl: `${roomUrl}?t=${await this.generateMeetingToken(data.name, true)}`,
        roomName: data.name,
        startDate: data.created_at,
        endDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        isLocked: data.privacy === 'private'
      };
    } catch (error) {
      console.error('❌ Error getting Daily room:', error);
      
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
      
      return null;
    }
  }

  // Check if service is properly configured
  isServiceConfigured(): boolean {
    return this.isConfigured;
  }

  // Get configuration status for diagnostics
  getConfigStatus(): { configured: boolean; hasApiKey: boolean; hasDomain: boolean; apiUrl: string; domain: string } {
    return {
      configured: this.isConfigured,
      hasApiKey: !!this.config.apiKey,
      hasDomain: !!this.config.domain,
      apiUrl: this.config.apiUrl,
      domain: this.config.domain
    };
  }
}

// Session management utilities (reuse the same class as Whereby)
export class VideoSessionManager {
  private waitingRoom: Map<string, SessionParticipant[]> = new Map();
  private activeSessions: Map<string, DailyMeeting> = new Map();

  addToWaitingRoom(sessionId: string, participant: SessionParticipant): void {
    const participants = this.waitingRoom.get(sessionId) || [];
    participants.push(participant);
    this.waitingRoom.set(sessionId, participants);
  }

  removeFromWaitingRoom(sessionId: string, userId: number): SessionParticipant | null {
    const participants = this.waitingRoom.get(sessionId) || [];
    const index = participants.findIndex(p => p.userId === userId);
    
    if (index !== -1) {
      const [removed] = participants.splice(index, 1);
      this.waitingRoom.set(sessionId, participants);
      return removed;
    }
    
    return null;
  }

  admitParticipant(sessionId: string, userId: number): boolean {
    const participant = this.removeFromWaitingRoom(sessionId, userId);
    if (participant) {
      participant.isInWaitingRoom = false;
      participant.admittedAt = new Date();
      return true;
    }
    return false;
  }

  getWaitingParticipants(sessionId: string): SessionParticipant[] {
    return this.waitingRoom.get(sessionId) || [];
  }

  setActiveSession(sessionId: string, meeting: DailyMeeting): void {
    this.activeSessions.set(sessionId, meeting);
  }

  getActiveSession(sessionId: string): DailyMeeting | null {
    return this.activeSessions.get(sessionId) || null;
  }

  endSession(sessionId: string): void {
    this.waitingRoom.delete(sessionId);
    this.activeSessions.delete(sessionId);
  }
}

export const dailyService = new DailyService();
export const videoSessionManager = new VideoSessionManager();