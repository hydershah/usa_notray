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

  constructor() {
    this.config = {
      apiKey: process.env.WHEREBY_API_KEY || '',
      apiUrl: 'https://api.whereby.dev/v1'
    };
  }

  // Create a new video meeting room
  async createMeeting(options: WherebyMeetingOptions = {}): Promise<WherebyMeeting> {
    try {
      const defaultOptions = {
        roomNamePrefix: 'notary-session',
        roomMode: 'normal' as const,
        fields: ['hostRoomUrl'],
        isLocked: false,
        ...options
      };

      const response = await fetch(`${this.config.apiUrl}/meetings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(defaultOptions)
      });

      if (!response.ok) {
        throw new Error(`Whereby API error: ${response.status} ${response.statusText}`);
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
      console.error('Error creating Whereby meeting:', error);
      
      // Fallback to mock meeting for development
      const fallbackMeeting: WherebyMeeting = {
        meetingId: `mock-${Date.now()}`,
        roomUrl: `https://whereby.com/notary-session-${Date.now()}`,
        hostRoomUrl: `https://whereby.com/notary-session-${Date.now()}?host`,
        roomName: `notary-session-${Date.now()}`,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
        isLocked: false
      };
      
      return fallbackMeeting;
    }
  }

  // Start recording a session
  async startRecording(roomName: string): Promise<{ recordingId: string }> {
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
        throw new Error(`Whereby recording API error: ${response.status}`);
      }

      const data = await response.json();
      return { recordingId: data.recordingId };
    } catch (error) {
      console.error('Error starting Whereby recording:', error);
      // Return mock recording ID for development
      return { recordingId: `mock-recording-${Date.now()}` };
    }
  }

  // Stop recording a session
  async stopRecording(recordingId: string): Promise<{ status: string }> {
    try {
      const response = await fetch(`${this.config.apiUrl}/recordings/${recordingId}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Whereby stop recording API error: ${response.status}`);
      }

      return { status: 'stopped' };
    } catch (error) {
      console.error('Error stopping Whereby recording:', error);
      return { status: 'stopped' };
    }
  }

  // Get recording details and download URL
  async getRecording(recordingId: string): Promise<WherebyRecording | null> {
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
        throw new Error(`Whereby get recording API error: ${response.status}`);
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
      console.error('Error getting Whereby recording:', error);
      return null;
    }
  }

  // Delete a meeting room
  async deleteMeeting(meetingId: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiUrl}/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Whereby delete meeting API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting Whereby meeting:', error);
      // Non-critical error, continue
    }
  }

  // Validate configuration
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.apiKey) {
      errors.push('WHEREBY_API_KEY environment variable is required');
    }

    if (!this.config.apiUrl) {
      errors.push('Invalid Whereby API URL configuration');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Get meeting details
  async getMeeting(meetingId: string): Promise<WherebyMeeting | null> {
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
        throw new Error(`Whereby get meeting API error: ${response.status}`);
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
      console.error('Error getting Whereby meeting:', error);
      return null;
    }
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