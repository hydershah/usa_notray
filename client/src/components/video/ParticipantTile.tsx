/**
 * Individual Participant Video Tile
 * Displays video, audio status, and participant information
 */

import React from 'react';
import { useParticipant } from '@daily-co/daily-react';
import { DailyVideo } from '@daily-co/daily-react';
import { MicOff, VideoOff, Crown, Mic, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ParticipantTileProps {
  sessionId: string;
  isLocal: boolean;
  className?: string;
  onToggleAudio?: () => void;
  onToggleVideo?: () => void;
}

interface ParticipantUserData {
  role?: string;
}

export const ParticipantTile: React.FC<ParticipantTileProps> = ({
  sessionId,
  isLocal,
  className,
  onToggleAudio,
  onToggleVideo
}) => {
  const participant = useParticipant(sessionId);
  
  if (!participant) {
    return null;
  }

  const displayName = participant.user_name || 'Participant';
  const role = (participant.userData as ParticipantUserData | undefined)?.role || 'participant';
  const hasVideo = participant.tracks?.video?.state === 'playable';
  const hasAudio = participant.tracks?.audio?.state === 'playable';
  const isNotary = role === 'notary';
  const isOwner = participant.owner;

  return (
    <div className={cn(
      "relative aspect-video bg-gray-900 rounded-lg overflow-hidden group transition-all duration-200 hover:ring-2 hover:ring-blue-400",
      isLocal && "ring-2 ring-green-400",
      isNotary && "ring-2 ring-blue-500",
      className
    )}>
      {hasVideo ? (
        <DailyVideo
          sessionId={sessionId}
          type="video"
          automirror={isLocal}
          fit="cover"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center text-white font-semibold text-xl",
            isNotary ? "bg-blue-600" : "bg-gray-600"
          )}>
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      
      {/* Participant Info Overlay - REMOVED to hide names and labels */}

      {/* Audio/Video Status Icons */}
      <div className="absolute top-2 right-2 flex space-x-1">
        {!hasAudio && (
          <div className="bg-red-500 p-1.5 rounded-full shadow-lg">
            <MicOff className="w-4 h-4 text-white" />
          </div>
        )}
        {!hasVideo && (
          <div className="bg-red-500 p-1.5 rounded-full shadow-lg">
            <VideoOff className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Speaking Indicator */}
      {hasAudio && participant.audio && (
        <div className="absolute top-2 left-2">
          <div className="bg-green-500 p-1 rounded-full animate-pulse">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
        </div>
      )}

      {/* Connection Quality Indicator */}
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className={cn(
          "w-2 h-2 rounded-full",
          participant.tracks?.video?.state === 'playable' ? "bg-green-400" : "bg-red-400"
        )}></div>
      </div>

      {/* Local Controls: Mic / Camera toggles */}
      {isLocal && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            type="button"
            onClick={onToggleAudio}
            size="sm"
            aria-pressed={hasAudio}
            className={cn(
              "rounded-full w-8 h-8 p-0",
              hasAudio ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-red-600 hover:bg-red-700 text-white"
            )}
          >
            {hasAudio ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </Button>
          <Button
            type="button"
            onClick={onToggleVideo}
            size="sm"
            aria-pressed={hasVideo}
            className={cn(
              "rounded-full w-8 h-8 p-0",
              hasVideo ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-red-600 hover:bg-red-700 text-white"
            )}
          >
            {hasVideo ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </Button>
        </div>
      )}
    </div>
  );
};