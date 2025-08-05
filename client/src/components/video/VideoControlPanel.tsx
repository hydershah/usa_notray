/**
 * Video Control Panel
 * Provides controls for recording, screen sharing, audio/video toggle, and session management
 */

import React from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Monitor, 
  MonitorOff,
  Circle,
  Square,
  Users,
  LogOut,
  Phone,
  PhoneOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VideoControlPanelProps {
  // Recording state
  isRecording: boolean;
  recordingState?: string;
  canRecord: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  
  // Screen sharing state
  isScreenSharing: boolean;
  canScreenShare: boolean;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
  
  // Local media state
  hasLocalVideo: boolean;
  hasLocalAudio: boolean;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  
  // Session management
  participantCount: number;
  maxParticipants?: number;
  onLeaveSession: () => void;
  
  // Connection state
  isConnected: boolean;
  connectionQuality?: 'good' | 'poor' | 'unknown';
}

export const VideoControlPanel: React.FC<VideoControlPanelProps> = ({
  isRecording,
  recordingState,
  canRecord,
  onStartRecording,
  onStopRecording,
  isScreenSharing,
  canScreenShare,
  onStartScreenShare,
  onStopScreenShare,
  hasLocalVideo,
  hasLocalAudio,
  onToggleVideo,
  onToggleAudio,
  participantCount,
  maxParticipants = 8,
  onLeaveSession,
  isConnected,
  connectionQuality = 'unknown'
}) => {
  return (
    <div className="bg-gray-800 border-t border-gray-700 p-2 min-h-[70px]">
      <div className="flex flex-col space-y-2 w-full">
        {/* Top Row: Session Info & Status */}
        <div className="flex items-center justify-between text-white text-xs">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>{participantCount}/{maxParticipants}</span>
          </div>
          
          {/* Recording Status */}
          {isRecording && (
            <div className="flex items-center space-x-1 text-red-400">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="font-medium text-xs">REC</span>
            </div>
          )}
          
          {/* Connection Quality */}
          <div className="flex items-center space-x-1">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected 
                ? connectionQuality === 'good' 
                  ? "bg-green-400" 
                  : connectionQuality === 'poor'
                  ? "bg-yellow-400"
                  : "bg-gray-400"
                : "bg-red-400"
            )} />
            <span className="text-xs">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Bottom Row: Controls */}
        <div className="flex items-center justify-between">
          {/* Left Side: Media Controls */}
          <div className="flex items-center space-x-2">
            {/* Audio Toggle */}
            <Button
              onClick={onToggleAudio}
              size="sm"
              variant={hasLocalAudio ? "default" : "destructive"}
              className={cn(
                "rounded-full w-8 h-8 p-0",
                hasLocalAudio 
                  ? "bg-gray-600 hover:bg-gray-700 text-white" 
                  : "bg-red-600 hover:bg-red-700 text-white"
              )}
            >
              {hasLocalAudio ? (
                <Mic className="w-4 h-4" />
              ) : (
                <MicOff className="w-4 h-4" />
              )}
            </Button>

            {/* Video Toggle */}
            <Button
              onClick={onToggleVideo}
              size="sm"
              variant={hasLocalVideo ? "default" : "destructive"}
              className={cn(
                "rounded-full w-8 h-8 p-0",
                hasLocalVideo 
                  ? "bg-gray-600 hover:bg-gray-700 text-white" 
                  : "bg-red-600 hover:bg-red-700 text-white"
              )}
            >
              {hasLocalVideo ? (
                <Video className="w-4 h-4" />
              ) : (
                <VideoOff className="w-4 h-4" />
              )}
            </Button>

            {/* Screen Share Toggle */}
            {canScreenShare && (
              <Button
                onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
                size="sm"
                variant={isScreenSharing ? "secondary" : "outline"}
                className={cn(
                  "rounded-full w-8 h-8 p-0",
                  isScreenSharing && "bg-blue-600 hover:bg-blue-700 text-white"
                )}
              >
                {isScreenSharing ? (
                  <MonitorOff className="w-4 h-4" />
                ) : (
                  <Monitor className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>

          {/* Right Side: Recording & Leave */}
          <div className="flex items-center space-x-2">
            {/* Recording Controls */}
            {canRecord && (
              <>
                {!isRecording ? (
                  <Button
                    onClick={onStartRecording}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1"
                    size="sm"
                  >
                    <Circle className="w-3 h-3 mr-1 fill-current" />
                    REC
                  </Button>
                ) : (
                  <Button
                    onClick={onStopRecording}
                    className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-2 py-1"
                    size="sm"
                  >
                    <Square className="w-3 h-3 mr-1 fill-current" />
                    STOP
                  </Button>
                )}
              </>
            )}

            {/* Leave Call */}
            <Button
              onClick={onLeaveSession}
              size="sm"
              variant="destructive"
              className="rounded-full w-8 h-8 p-0 bg-red-600 hover:bg-red-700"
            >
              <PhoneOff className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};