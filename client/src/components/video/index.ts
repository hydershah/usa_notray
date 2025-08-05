/**
 * Daily React Video Components
 * Clean exports for the new video session implementation
 */

export { NotaryVideoSession } from './NotaryVideoSession';
export { NotaryVideoConference } from './NotaryVideoConference';
export { NotaryVideoProvider } from './NotaryVideoProvider';
export { ParticipantTile } from './ParticipantTile';
export { VideoControlPanel } from './VideoControlPanel';

// Re-export Daily React components for convenience
export { 
  DailyAudio, 
  DailyVideo, 
  DailyAudioTrack 
} from '@daily-co/daily-react';

// Re-export commonly used hooks
export {
  useDaily,
  useParticipantIds,
  useLocalParticipant,
  useParticipant,
  useDailyEvent,
  useRecording,
  useScreenShare,
  useMeetingState
} from '@daily-co/daily-react';