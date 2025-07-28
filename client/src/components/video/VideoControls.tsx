import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor,
  MonitorOff,
  Circle,
  Square,
  PhoneOff,
  Settings,
  Users
} from 'lucide-react';

interface VideoControlsProps {
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  canRecord: boolean;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onToggleScreenShare: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onLeaveSession: () => void;
  className?: string;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  isVideoEnabled,
  isAudioEnabled,
  isScreenSharing,
  isRecording,
  canRecord,
  onToggleVideo,
  onToggleAudio,
  onToggleScreenShare,
  onStartRecording,
  onStopRecording,
  onLeaveSession,
  className = ''
}) => {
  return (
    <div className={`flex items-center justify-center space-x-4 ${className}`}>
      {/* Audio Control */}
      <Button
        variant={isAudioEnabled ? "secondary" : "destructive"}
        size="lg"
        onClick={onToggleAudio}
        className={`h-12 w-12 rounded-full ${
          isAudioEnabled 
            ? 'bg-gray-600 hover:bg-gray-500 text-white' 
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
        title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        {isAudioEnabled ? (
          <Mic className="w-5 h-5" />
        ) : (
          <MicOff className="w-5 h-5" />
        )}
      </Button>

      {/* Video Control */}
      <Button
        variant={isVideoEnabled ? "secondary" : "destructive"}
        size="lg"
        onClick={onToggleVideo}
        className={`h-12 w-12 rounded-full ${
          isVideoEnabled 
            ? 'bg-gray-600 hover:bg-gray-500 text-white' 
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
        title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
      >
        {isVideoEnabled ? (
          <Video className="w-5 h-5" />
        ) : (
          <VideoOff className="w-5 h-5" />
        )}
      </Button>

      {/* Screen Share Control */}
      <Button
        variant={isScreenSharing ? "default" : "secondary"}
        size="lg"
        onClick={onToggleScreenShare}
        className={`h-12 w-12 rounded-full ${
          isScreenSharing 
            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
            : 'bg-gray-600 hover:bg-gray-500 text-white'
        }`}
        title={isScreenSharing ? "Stop screen sharing" : "Share screen"}
      >
        {isScreenSharing ? (
          <MonitorOff className="w-5 h-5" />
        ) : (
          <Monitor className="w-5 h-5" />
        )}
      </Button>

      {/* Recording Control (only for notary/admin) */}
      {canRecord && (
        <Button
          variant={isRecording ? "default" : "secondary"}
          size="lg"
          onClick={isRecording ? onStopRecording : onStartRecording}
          className={`h-12 w-12 rounded-full ${
            isRecording 
              ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          }`}
          title={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? (
            <Square className="w-5 h-5" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </Button>
      )}

      {/* Settings */}
      <Button
        variant="ghost"
        size="lg"
        className="h-12 w-12 rounded-full bg-gray-600 hover:bg-gray-500 text-white"
        title="Settings"
      >
        <Settings className="w-5 h-5" />
      </Button>

      {/* Leave Session */}
      <Button
        variant="destructive"
        size="lg"
        onClick={onLeaveSession}
        className="h-12 w-12 rounded-full bg-red-600 hover:bg-red-700 text-white"
        title="Leave session"
      >
        <PhoneOff className="w-5 h-5" />
      </Button>
    </div>
  );
}; 