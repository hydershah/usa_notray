import React, { useMemo } from 'react';
import { VideoSlot } from './VideoSlot';
import type { VideoGridProps, VideoGridSlot } from '../../../../shared/types/video';

export const VideoGrid: React.FC<VideoGridProps> = ({
  participants,
  streams,
  maxSlots = 8,
  currentUserId,
  onSlotClick,
  className = ''
}) => {
  // Create predefined slots array (8 slots by default)
  const slots: VideoGridSlot[] = useMemo(() => {
    const slotsArray: VideoGridSlot[] = [];
    
    // Initialize all slots as empty
    for (let i = 0; i < maxSlots; i++) {
      slotsArray.push({
        position: i,
        isOccupied: false
      });
    }
    
    // Fill slots with participants (prioritize notary, then order by join time)
    const sortedParticipants = [...participants].sort((a, b) => {
      // Prioritize notary role
      if (a.role === 'notary' && b.role !== 'notary') return -1;
      if (b.role === 'notary' && a.role !== 'notary') return 1;
      
      // Then prioritize current user
      if (a.userId === currentUserId && b.userId !== currentUserId) return -1;
      if (b.userId === currentUserId && a.userId !== currentUserId) return 1;
      
      // Then by join time
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    });
    
    // Assign participants to slots
    sortedParticipants.forEach((participant, index) => {
      if (index < maxSlots) {
        slotsArray[index] = {
          position: index,
          participantId: participant.userId.toString(),
          connectionId: participant.connectionId,
          isOccupied: true,
          stream: streams.get(participant.connectionId)
        };
      }
    });
    
    return slotsArray;
  }, [participants, streams, maxSlots, currentUserId]);

  // Get participant data for a slot
  const getParticipantForSlot = (slot: VideoGridSlot) => {
    if (!slot.participantId) return undefined;
    return participants.find(p => p.userId.toString() === slot.participantId);
  };

  // Handle slot click
  const handleSlotClick = (position: number) => {
    const slot = slots[position];
    const participant = getParticipantForSlot(slot);
    onSlotClick?.(position, participant);
  };

  // Determine grid layout based on number of slots
  const getGridCols = () => {
    if (maxSlots <= 2) return 'grid-cols-1 md:grid-cols-2';
    if (maxSlots <= 4) return 'grid-cols-2 md:grid-cols-4';
    if (maxSlots <= 6) return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6';
    return 'grid-cols-2 md:grid-cols-4 lg:grid-cols-8'; // Up to 8 in a row
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Grid Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-white">
            Video Conference
          </h3>
          <span className="text-sm text-gray-400">
            ({participants.filter(p => p.isConnected).length}/{maxSlots} participants)
          </span>
        </div>
        
        {/* Grid Layout Indicator */}
        <div className="flex items-center space-x-1 text-xs text-gray-500">
          {slots.map((slot, index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-full border ${
                slot.isOccupied 
                  ? 'bg-green-500 border-green-500' 
                  : 'bg-gray-700 border-gray-600'
              }`}
              title={slot.isOccupied ? `Slot ${index + 1}: Occupied` : `Slot ${index + 1}: Available`}
            />
          ))}
        </div>
      </div>
      
      {/* Video Grid */}
      <div className={`grid gap-3 ${getGridCols()}`}>
        {slots.map((slot) => {
          const participant = getParticipantForSlot(slot);
          const isCurrentUser = participant?.userId === currentUserId;
          const isHost = participant?.isHost || participant?.role === 'notary';
          
          return (
            <VideoSlot
              key={slot.position}
              position={slot.position}
              participant={participant}
              stream={slot.stream}
              isCurrentUser={isCurrentUser}
              isHost={isHost}
              showControls={isHost && !isCurrentUser} // Show controls for hosts over other participants
              onSlotClick={() => handleSlotClick(slot.position)}
              className="cursor-pointer hover:ring-2 hover:ring-blue-400/50 transition-all duration-200"
            />
          );
        })}
      </div>
      
      {/* Overflow Indicator */}
      {participants.length > maxSlots && (
        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span className="text-yellow-400 text-sm">
              {participants.length - maxSlots} participants waiting to join (maximum {maxSlots} video slots)
            </span>
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {participants.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-2">No participants in session</div>
          <div className="text-sm text-gray-500">
            Waiting for participants to join the video conference...
          </div>
        </div>
      )}
    </div>
  );
}; 