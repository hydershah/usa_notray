import fetch from 'node-fetch';

interface WherebyConfig {
  apiKey: string;
  apiUrl: string;
}

interface WherebyMeetingOptions {
  roomNamePrefix?: string;
  roomMode?: 'normal' | 'group';
  startDate?: string;
  endDate?: string;
  fields?: string[];
  isLocked?: boolean;
  roomNamePattern?: string;
}

interface WherebyMeeting {
  meetingId: string;
  roomUrl: string;
  hostRoomUrl: string;
  roomName: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
}

interface WherebyRecording {
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

class WherebyService {
  private config: WherebyConfig;
  private isConfigured: boolean;

  constructor() {
    this.config = {
      apiKey: process.env.WHEREBY_API_KEY || '',
      apiUrl: 'https://api.whereby.dev/v1'
    };
    
    this.isConfigured = !!this.config.apiKey;
    
    if (!this.isConfigured) {
      console.warn('⚠️ Whereby API key not configured. Set WHEREBY_API_KEY environment variable.');
      console.warn('⚠️ Video conferencing will use fallback implementation.');
    } else {
      console.log('✅ Whereby service configured with API key');
    }
  }

  // Create a new video meeting room
  async createMeeting(options: WherebyMeetingOptions = {}): Promise<WherebyMeeting> {
    if (!this.isConfigured) {
      console.log('🔄 Using fallback meeting creation (no API key configured)');
      return this.createFallbackMeeting(options);
    }

    try {
      const defaultOptions = {
        roomNamePrefix: 'notary-session',
        roomMode: 'group' as const,
        fields: ['hostRoomUrl'],
        isLocked: false,
        roomNamePattern: options.roomNamePattern || undefined,
        ...options
      };

      console.log('🔗 Creating Whereby meeting with options:', defaultOptions);

      const response = await fetch(`${this.config.apiUrl}/meetings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(defaultOptions)
      });

      console.log('📡 Whereby API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Whereby API error:', response.status, errorText);
        
        // Don't fall back to mock for production - throw error instead
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Whereby API error: ${response.status} - ${errorText}`);
        }
        
        console.log('🔄 Development mode: using fallback meeting');
        return this.createFallbackMeeting(options);
      }

      const data = await response.json();
      console.log('✅ Whereby meeting created successfully:', data);
      
      return {
        meetingId: data.meetingId,
        roomUrl: data.roomUrl,
        hostRoomUrl: data.hostRoomUrl,
        roomName: data.roomName,
        startDate: data.startDate,
        endDate: data.endDate,
        isLocked: data.isLocked
      };
    } catch (error) {
      console.error('❌ Error creating Whereby meeting:', error);
      
      // In production, throw the error - don't mask it
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Failed to create video session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      console.log('🔄 Development mode: using fallback meeting');
      return this.createFallbackMeeting(options);
    }
  }

  // Create fallback meeting for development/testing
  private createFallbackMeeting(options: WherebyMeetingOptions = {}): WherebyMeeting {
    const timestamp = Date.now();
    const roomName = `${options.roomNamePrefix || 'notary-session'}-${timestamp}`;
    
    console.log('🎭 Creating fallback meeting for development:', roomName);
    
    return {
      meetingId: `fallback-${timestamp}`,
      roomUrl: `https://whereby.com/${roomName}`,
      hostRoomUrl: `https://whereby.com/${roomName}?host=true`,
      roomName,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
      isLocked: false
    };
  }

  // Start recording a session
  async startRecording(roomName: string): Promise<{ recordingId: string }> {
    if (!this.isConfigured) {
      console.log('🎬 Mock recording started (no API key configured)');
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
          roomName,
          recordingMode: 'cloud'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Whereby recording API error:', response.status, errorText);
        
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Recording failed: ${response.status} - ${errorText}`);
        }
        
        return { recordingId: `fallback-recording-${Date.now()}` };
      }

      const data = await response.json();
      console.log('✅ Recording started:', data);
      return { recordingId: data.recordingId };
    } catch (error) {
      console.error('❌ Error starting Whereby recording:', error);
      
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
      console.log('🛑 Mock recording stopped (no API key configured)');
      return { status: 'stopped' };
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/recordings/${recordingId}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Whereby stop recording API error:', response.status, errorText);
        
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Stop recording failed: ${response.status} - ${errorText}`);
        }
      }

      console.log('✅ Recording stopped');
      return { status: 'stopped' };
    } catch (error) {
      console.error('❌ Error stopping Whereby recording:', error);
      
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
      
      return { status: 'stopped' };
    }
  }

  // Get recording details and download URL
  async getRecording(recordingId: string): Promise<WherebyRecording | null> {
    if (!this.isConfigured) {
      console.log('📹 Mock recording info (no API key configured)');
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
        console.error('❌ Whereby get recording API error:', response.status, errorText);
        
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Get recording failed: ${response.status} - ${errorText}`);
        }
        
        return null;
      }

      const data = await response.json();
      
      return {
        recordingId: data.recordingId,
        roomName: data.roomName,
        createdDate: data.createdDate,
        status: data.status,
        downloadUrl: data.downloadUrl
      };
    } catch (error) {
      console.error('❌ Error getting Whereby recording:', error);
      
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
      
      return null;
    }
  }

  // Delete a meeting room
  async deleteMeeting(meetingId: string): Promise<void> {
    if (!this.isConfigured) {
      console.log('🗑️ Mock meeting deleted (no API key configured)');
      return;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Whereby delete meeting API error:', response.status, errorText);
        // Non-critical error, continue
      } else {
        console.log('✅ Meeting deleted successfully');
      }
    } catch (error) {
      console.error('❌ Error deleting Whereby meeting:', error);
      // Non-critical error, continue
    }
  }

  // Validate configuration
  validateConfiguration(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.config.apiKey) {
      if (process.env.NODE_ENV === 'production') {
        errors.push('WHEREBY_API_KEY environment variable is required for production');
      } else {
        warnings.push('WHEREBY_API_KEY not configured - using fallback implementation for development');
      }
    }

    if (!this.config.apiUrl) {
      errors.push('Invalid Whereby API URL configuration');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Get meeting details
  async getMeeting(meetingId: string): Promise<WherebyMeeting | null> {
    if (!this.isConfigured) {
      console.log('📋 Mock meeting info (no API key configured)');
      return null;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/meetings/${meetingId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorText = await response.text();
        console.error('❌ Whereby get meeting API error:', response.status, errorText);
        
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Get meeting failed: ${response.status} - ${errorText}`);
        }
        
        return null;
      }

      const data = await response.json();
      
      return {
        meetingId: data.meetingId,
        roomUrl: data.roomUrl,
        hostRoomUrl: data.hostRoomUrl,
        roomName: data.roomName,
        startDate: data.startDate,
        endDate: data.endDate,
        isLocked: data.isLocked
      };
    } catch (error) {
      console.error('❌ Error getting Whereby meeting:', error);
      
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
  getConfigStatus(): { configured: boolean; hasApiKey: boolean; apiUrl: string } {
    return {
      configured: this.isConfigured,
      hasApiKey: !!this.config.apiKey,
      apiUrl: this.config.apiUrl
    };
  }
}

// Session management utilities
export class VideoSessionManager {
  private waitingRoom: Map<string, SessionParticipant[]> = new Map();
  private activeSessions: Map<string, WherebyMeeting> = new Map();

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

  setActiveSession(sessionId: string, meeting: WherebyMeeting): void {
    this.activeSessions.set(sessionId, meeting);
  }

  getActiveSession(sessionId: string): WherebyMeeting | null {
    return this.activeSessions.get(sessionId) || null;
  }

  endSession(sessionId: string): void {
    this.waitingRoom.delete(sessionId);
    this.activeSessions.delete(sessionId);
  }
}

export const wherebyService = new WherebyService();
export const videoSessionManager = new VideoSessionManager(); 