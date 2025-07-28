// OpenVidu Video Integration Types
export interface OpenViduSession {
  sessionId: string;
  sessionName: string;
  token: string;
  participants: SessionParticipant[];
  isRecording: boolean;
  recordingId?: string;
  startTime: Date;
  endTime?: Date;
}

export interface SessionParticipant {
  userId: number;
  connectionId: string;
  role: 'notary' | 'signer' | 'witness' | 'observer' | 'admin';
  displayName: string;
  email: string;
  avatar?: string;
  isHost: boolean;
  isConnected: boolean;
  joinedAt: Date;
  videoEnabled: boolean;
  audioEnabled: boolean;
  isScreenSharing: boolean;
  networkQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
  position?: number; // For video grid positioning
}

export interface VideoSessionConfig {
  sessionId: string;
  jobId: number;
  maxParticipants: number;
  allowScreenShare: boolean;
  allowRecording: boolean;
  requiresModeration: boolean;
  autoStartRecording: boolean;
  videoLayout: 'grid' | 'focus' | 'custom';
  videoQuality: 'low' | 'medium' | 'high' | 'ultra';
}

export interface OpenViduToken {
  token: string;
  connectionId: string;
  sessionId: string;
  role: string;
  data?: string;
}

export interface RecordingInfo {
  recordingId: string;
  sessionId: string;
  status: 'started' | 'stopped' | 'ready' | 'uploading' | 'uploaded' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  size?: number;
  downloadUrl?: string;
  vultrStorageUrl?: string;
  metadata: {
    participants: string[];
    jobId: number;
    layout: string;
    quality: string;
  };
}

export interface VideoGridSlot {
  position: number;
  participantId?: string;
  connectionId?: string;
  isOccupied: boolean;
  stream?: any; // OpenVidu Stream object
  videoElement?: HTMLVideoElement;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'system' | 'notification';
}

export interface NetworkQualityStats {
  connectionId: string;
  bandwidth: number;
  packetLoss: number;
  latency: number;
  quality: 'excellent' | 'good' | 'poor' | 'disconnected';
  timestamp: Date;
}

export interface ScreenShareInfo {
  isActive: boolean;
  participantId?: string;
  participantName?: string;
  stream?: any;
  startTime?: Date;
}

// API Request/Response Types
export interface CreateSessionRequest {
  sessionId: string;
  jobId: number;
  participants: {
    userId: number;
    role: string;
    displayName: string;
    email: string;
  }[];
  config?: Partial<VideoSessionConfig>;
}

export interface CreateSessionResponse {
  success: boolean;
  sessionId: string;
  sessionToken: string;
  participants: OpenViduToken[];
  error?: string;
}

export interface JoinSessionRequest {
  sessionId: string;
  userId: number;
  role: string;
  displayName: string;
}

export interface JoinSessionResponse {
  success: boolean;
  token: string;
  connectionId: string;
  sessionData: OpenViduSession;
  error?: string;
}

export interface StartRecordingRequest {
  sessionId: string;
  layout?: 'grid' | 'focus' | 'custom';
  resolution?: '640x480' | '1280x720' | '1920x1080';
}

export interface StartRecordingResponse {
  success: boolean;
  recordingId: string;
  status: string;
  error?: string;
}

// Component Props Types
export interface OpenViduVideoConferenceProps {
  sessionId: string;
  jobId: number;
  currentUser: {
    id: number;
    name: string;
    email: string;
    role: 'notary' | 'signer' | 'witness' | 'observer' | 'admin';
    avatar?: string;
  };
  participants?: SessionParticipant[];
  config?: Partial<VideoSessionConfig>;
  onParticipantJoined?: (participant: SessionParticipant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onRecordingStarted?: (recordingInfo: RecordingInfo) => void;
  onRecordingStopped?: (recordingInfo: RecordingInfo) => void;
  onSessionEnded?: () => void;
  onError?: (error: string) => void;
  autoStart?: boolean;
  className?: string;
}

export interface VideoGridProps {
  participants: SessionParticipant[];
  streams: Map<string, any>; // connectionId -> OpenVidu Stream
  maxSlots: number;
  currentUserId: number;
  onSlotClick?: (position: number, participant?: SessionParticipant) => void;
  className?: string;
}

export interface VideoSlotProps {
  position: number;
  participant?: SessionParticipant;
  stream?: any;
  isCurrentUser?: boolean;
  isHost?: boolean;
  showControls?: boolean;
  onMuteToggle?: () => void;
  onVideoToggle?: () => void;
  onRemoveParticipant?: () => void;
  onSlotClick?: () => void;
  className?: string;
}

// Vultr Storage Types
export interface VultrStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  cdnUrl?: string;
}

export interface UploadRecordingRequest {
  recordingId: string;
  filePath: string;
  metadata: RecordingInfo['metadata'];
}

export interface UploadRecordingResponse {
  success: boolean;
  vultrUrl: string;
  cdnUrl?: string;
  size: number;
  error?: string;
} 