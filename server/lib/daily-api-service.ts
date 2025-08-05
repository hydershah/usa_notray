/**
 * Daily.co API Service
 * Handles room creation, recording, and participant management
 * Optimized for 8-participant notary sessions
 */

interface DailyRoomConfig {
  name: string;
  privacy: 'private';
  properties: {
    max_participants: 8;
    enable_chat: true;
    enable_screenshare: true;
    enable_recording: 'cloud';
    start_video_off: false;
    start_audio_off: true;
    owner_only_broadcast: false;
    enable_prejoin_ui: true;
    exp: number; // Room expiration timestamp
  };
}

interface DailyParticipant {
  id: string;
  name: string;
  role: 'notary' | 'signer' | 'witness' | 'client';
  email?: string;
}

interface DailyRoomResponse {
  id: string;
  name: string;
  api_created: boolean;
  privacy: string;
  url: string;
  created_at: string;
  config: any;
}

interface DailyTokenResponse {
  token: string;
}

class DailyApiService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.daily.co/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    if (!apiKey) {
      throw new Error('Daily API key is required');
    }
  }

  private async makeApiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Daily API Error: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`);
    }

    return response.json();
  }

  /**
   * Create optimized Daily room for 8 participants
   */
  async createNotaryRoom(jobId: string): Promise<DailyRoomResponse> {
    const roomName = `notary-session-${jobId}-${Date.now()}`;
    
    const roomConfig: DailyRoomConfig = {
      name: roomName,
      privacy: 'private',
      properties: {
        max_participants: 8,
        enable_chat: true,
        enable_screenshare: true,
        enable_recording: 'cloud',
        start_video_off: false,      // Start with video on for notary verification
        start_audio_off: true,       // Start muted to avoid noise
        owner_only_broadcast: false, // All participants can share video/audio
        enable_prejoin_ui: true,     // Allow device testing before join
        exp: Math.floor(Date.now() / 1000) + (4 * 60 * 60) // 4 hour expiry
      }
    };

    return this.makeApiCall('/rooms', {
      method: 'POST',
      body: JSON.stringify(roomConfig)
    });
  }

  /**
   * Generate secure meeting token for participant
   */
  async createMeetingToken(roomName: string, participant: DailyParticipant): Promise<string> {
    const tokenConfig = {
      properties: {
        room_name: roomName,
        user_name: participant.name,
        user_id: participant.id,
        is_owner: participant.role === 'notary', // Notary has owner privileges
        start_video_off: false,
        start_audio_off: true,
        enable_screenshare: true,
        // Note: enable_recording is controlled by room settings, not token properties
        exp: Math.floor(Date.now() / 1000) + (4 * 60 * 60) // 4 hour expiry
      }
    };

    const response: DailyTokenResponse = await this.makeApiCall('/meeting-tokens', {
      method: 'POST',
      body: JSON.stringify(tokenConfig)
    });

    return response.token;
  }

  /**
   * Start cloud recording for compliance
   */
  async startRecording(roomName: string): Promise<any> {
    return this.makeApiCall(`/rooms/${roomName}/recordings/start`, {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          layout: {
            preset: 'default' // Use Daily's default layout for all participants
          }
        }
      })
    });
  }

  /**
   * Stop cloud recording
   */
  async stopRecording(roomName: string): Promise<any> {
    return this.makeApiCall(`/rooms/${roomName}/recordings/stop`, {
      method: 'POST'
    });
  }

  /**
   * Get room information
   */
  async getRoomInfo(roomName: string): Promise<DailyRoomResponse> {
    return this.makeApiCall(`/rooms/${roomName}`);
  }

  /**
   * Ensure a room exists, creating it if it doesn't.
   * This is useful for re-joining sessions where the room might have been deleted.
   */
  async ensureRoom(roomName: string): Promise<void> {
    try {
      await this.getRoomInfo(roomName); // Check if room exists
    } catch (error: any) {
      if (error.message && error.message.includes('404')) {
        // Room not found, so create it
        console.log(`Room "${roomName}" not found. Creating it...`);
        await this.makeApiCall('/rooms', {
          method: 'POST',
          body: JSON.stringify({ name: roomName, privacy: 'private' }),
        });
      } else {
        // Re-throw other errors
        throw error;
      }
    }
  }

  /**
   * Delete room (cleanup after session)
   */
  async deleteRoom(roomName: string): Promise<any> {
    return this.makeApiCall(`/rooms/${roomName}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get recordings for a room
   */
  async getRecordings(roomName?: string): Promise<any> {
    const endpoint = roomName ? `/recordings?room_name=${roomName}` : '/recordings';
    return this.makeApiCall(endpoint);
  }
}

// Create singleton instance
const apiKey = process.env.DAILY_API_KEY;
if (!apiKey) {
  console.warn('⚠️ DAILY_API_KEY environment variable not set');
}

export const dailyApi = new DailyApiService(apiKey || '');
export { DailyApiService, type DailyParticipant, type DailyRoomResponse };