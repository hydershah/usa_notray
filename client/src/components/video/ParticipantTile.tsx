/**
 * Individual Participant Video Tile
 * Displays video, audio status, and participant information
 */

import React from 'react';
import { useParticipant } from '@daily-co/daily-react';
import { DailyVideo } from '@daily-co/daily-react';
import { MicOff, VideoOff, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ParticipantTileProps {
  sessionId: string;
  isLocal: boolean;
  className?: string;
}

export const ParticipantTile: React.FC<ParticipantTileProps> = ({
  sessionId,
  isLocal,
  className
}) => {
  const participant = useParticipant(sessionId);
  
  if (!participant) {
    return (
      <div className={cn(
        "relative aspect-video bg-gray-800 rounded-lg overflow-hidden border-2 border-dashed border-gray-600",
        className
      )}>
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-gray-400 text-sm">Waiting for participant...</span>
        </div>
      </div>
    );
  }

  const displayName = participant.user_name || 'Participant';
  const role = participant.userData?.role || 'participant';
  const hasVideo = participant.video;
  const hasAudio = participant.audio;
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
      
      {/* Participant Info Overlay */}
      <div className="absolute bottom-2 left-2 right-2">
        <div className="bg-black bg-opacity-75 px-3 py-2 rounded-md text-white text-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <span className="truncate font-medium">
                {displayName}
              </span>
              
              {/* Role Badges */}
              {isNotary && (
                <div className="flex items-center space-x-1 bg-blue-500 px-2 py-0.5 rounded text-xs font-medium">
                  <Crown className="w-3 h-3" />
                  <span>NOTARY</span>
                </div>
              )}
              
              {isLocal && (
                <span className="bg-green-500 px-2 py-0.5 rounded text-xs font-medium">
                  YOU
                </span>
              )}
              
              {isOwner && !isLocal && (
                <span className="bg-yellow-500 px-2 py-0.5 rounded text-xs font-medium">
                  HOST
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
};