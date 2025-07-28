import React, { useRef, useEffect, useState } from 'react';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  UserX, 
  Crown,
  Monitor,
  Wifi,
  WifiOff,
  User
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { VideoSlotProps } from '../../../../shared/types/video';

export const VideoSlot: React.FC<VideoSlotProps> = ({
  position,
  participant,
  stream,
  isCurrentUser = false,
  isHost = false,
  showControls = false,
  onMuteToggle,
  onVideoToggle,
  onRemoveParticipant,
  onSlotClick,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      // Attach OpenVidu stream to video element
      stream.addVideoElement(videoRef.current);
      setIsVideoLoaded(true);
      
      return () => {
        if (videoRef.current && stream) {
          stream.removeVideoElement(videoRef.current);
        }
      };
    } else {
      setIsVideoLoaded(false);
    }
  }, [stream]);

  const getNetworkQualityIcon = () => {
    if (!participant?.isConnected) return <WifiOff className="w-3 h-3 text-red-500" />;
    
    switch (participant?.networkQuality) {
      case 'excellent':
      case 'good':
        return <Wifi className="w-3 h-3 text-green-500" />;
      case 'poor':
        return <Wifi className="w-3 h-3 text-yellow-500" />;
      default:
        return <WifiOff className="w-3 h-3 text-red-500" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'notary': return 'bg-blue-500';
      case 'signer': return 'bg-green-500';
      case 'witness': return 'bg-purple-500';
      case 'observer': return 'bg-gray-500';
      case 'admin': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div 
      className={`
        relative aspect-video bg-gray-900 rounded-lg overflow-hidden border-2 
        ${isCurrentUser ? 'border-blue-500' : 'border-gray-700'}
        ${participant ? 'ring-2 ring-green-500/20' : ''}
        ${className}
      `}
      onClick={onSlotClick}
    >
      {/* Video Stream */}
      {stream && participant?.videoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isCurrentUser} // Mute own video to prevent feedback
          className="w-full h-full object-cover"
          onLoadedData={() => setIsVideoLoaded(true)}
        />
      ) : participant && !participant.videoEnabled ? (
        // Video disabled placeholder
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <VideoOff className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Camera off</p>
          </div>
        </div>
      ) : (
        // Empty slot placeholder
        <div className="w-full h-full flex items-center justify-center bg-gray-800 border-2 border-dashed border-gray-600">
          <div className="text-center">
            <User className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Slot {position + 1}</p>
            <p className="text-xs text-gray-600">Waiting for participant</p>
          </div>
        </div>
      )}

      {/* Participant Info Overlay */}
      {participant && (
        <>
          {/* Top Info Bar */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
            {/* Role Badge */}
            <Badge className={`${getRoleBadgeColor(participant.role)} text-white text-xs`}>
              {participant.role.toUpperCase()}
              {isHost && <Crown className="w-3 h-3 ml-1" />}
            </Badge>
            
            {/* Network Quality */}
            <div className="flex items-center space-x-1">
              {getNetworkQualityIcon()}
              {participant.isScreenSharing && (
                <Monitor className="w-3 h-3 text-blue-400" />
              )}
            </div>
          </div>

          {/* Bottom Info Bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
            <div className="flex items-center justify-between">
              {/* Participant Name */}
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <span className="text-white text-sm font-medium truncate">
                  {participant.displayName}
                  {isCurrentUser && <span className="text-blue-400"> (You)</span>}
                </span>
              </div>

              {/* Audio/Video Status */}
              <div className="flex items-center space-x-1">
                {participant.audioEnabled ? (
                  <Mic className="w-4 h-4 text-green-400" />
                ) : (
                  <MicOff className="w-4 h-4 text-red-400" />
                )}
                {participant.videoEnabled ? (
                  <Video className="w-4 h-4 text-green-400" />
                ) : (
                  <VideoOff className="w-4 h-4 text-red-400" />
                )}
              </div>
            </div>
          </div>

          {/* Control Buttons (for moderators/self) */}
          {showControls && !isCurrentUser && (
            <div className="absolute top-2 right-2 flex flex-col space-y-1">
              {onMuteToggle && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-6 w-6 p-0"
                  onClick={onMuteToggle}
                  title="Mute participant"
                >
                  <MicOff className="w-3 h-3" />
                </Button>
              )}
              {onVideoToggle && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-6 w-6 p-0"
                  onClick={onVideoToggle}
                  title="Turn off video"
                >
                  <VideoOff className="w-3 h-3" />
                </Button>
              )}
              {onRemoveParticipant && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-6 w-6 p-0"
                  onClick={onRemoveParticipant}
                  title="Remove participant"
                >
                  <UserX className="w-3 h-3" />
                </Button>
              )}
            </div>
          )}

          {/* Connection Status Indicator */}
          {!participant.isConnected && (
            <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
              <div className="bg-red-500 text-white px-3 py-1 rounded text-sm font-medium">
                Reconnecting...
              </div>
            </div>
          )}

          {/* Screen Sharing Indicator */}
          {participant.isScreenSharing && (
            <div className="absolute top-8 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
              Sharing Screen
            </div>
          )}
        </>
      )}

      {/* Slot Position Indicator (for empty slots) */}
      {!participant && (
        <div className="absolute top-2 left-2 bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs font-mono">
          #{position + 1}
        </div>
      )}
    </div>
  );
}; 