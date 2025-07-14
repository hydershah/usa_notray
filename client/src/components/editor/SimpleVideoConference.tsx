import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff,
  Phone,
  PhoneOff,
  Users,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface Participant {
  userId: string;
  displayName: string;
  email: string;
  userType: 'notary' | 'signer' | 'witness' | 'admin';
}

interface SimpleVideoConferenceProps {
  sessionId: string;
  currentUser: {
    id: string;
    name: string;
    role: 'notary' | 'signer' | 'witness' | 'admin';
  };
  participants: Participant[];
  className?: string;
  compact?: boolean;
}

interface WherebyMeeting {
  roomUrl: string;
  hostRoomUrl: string;
  roomName: string;
  meetingId: string;
  endDate: string;
}

const SimpleVideoConference: React.FC<SimpleVideoConferenceProps> = ({
  sessionId,
  currentUser,
  participants = [],
  className = '',
  compact = false
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [wherebyMeeting, setWherebyMeeting] = useState<WherebyMeeting | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract job ID from session ID
  const jobId = React.useMemo(() => {
    const match = sessionId.match(/(\d+)/);
    return match ? parseInt(match[1]) : parseInt(sessionId) || 1;
  }, [sessionId]);

  // Start video session
  const startVideo = useCallback(async () => {
    if (isVideoActive) return;

    try {
      setIsLoading(true);
      setError(null);

      console.log(`🎥 Starting Whereby session for job ${jobId}`);

      // Create Whereby meeting via API
      const response = await fetch(`/api/jobs/${jobId}/video-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          participants: participants.map(p => ({
            userId: p.userId,
            name: p.displayName,
            email: p.email,
            role: p.userType
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create Whereby meeting');
      }

      const data = await response.json();
      const meeting: WherebyMeeting = {
        roomUrl: data.roomUrl,
        hostRoomUrl: data.hostRoomUrl || data.roomUrl,
        roomName: data.roomName || `session-${sessionId}`,
        meetingId: data.meetingId || data.sessionId,
        endDate: data.endDate
      };

      setWherebyMeeting(meeting);

      // Configure Whereby embed URL
      const isHost = currentUser.role === 'notary' || currentUser.role === 'admin';
      const roomUrl = isHost ? meeting.hostRoomUrl : meeting.roomUrl;
      
      const params = new URLSearchParams({
        embed: 'true',
        displayName: currentUser.name,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random`,
        background: 'off',
        chat: compact ? 'off' : 'on',
        people: compact ? 'off' : 'on',
        pipButton: 'off',
        leaveButton: 'on',
        screenshare: isHost ? 'on' : 'off',
        quality: 'medium',
        ...(isHost && {
          lock: 'off',
          precallReview: 'on'
        })
      });

      const embedUrl = `${roomUrl}?${params.toString()}`;

      // Load in iframe
      if (iframeRef.current) {
        iframeRef.current.src = embedUrl;
        setIsVideoActive(true);
        console.log(`✅ Whereby session started for ${currentUser.role}: ${currentUser.name}`);
      }

    } catch (error) {
      console.error('Failed to start Whereby session:', error);
      setError(error instanceof Error ? error.message : 'Failed to start video');
    } finally {
      setIsLoading(false);
    }
  }, [isVideoActive, jobId, sessionId, currentUser, participants, compact]);

  // Stop video session
  const stopVideo = useCallback(() => {
    if (!isVideoActive) return;

    try {
      if (iframeRef.current) {
        iframeRef.current.src = 'about:blank';
      }
      
      setIsVideoActive(false);
      setWherebyMeeting(null);
      setIsConnected(false);
      setParticipantCount(0);
      
      console.log('🛑 Whereby session stopped');
      
    } catch (error) {
      console.error('Failed to stop Whereby session:', error);
    }
  }, [isVideoActive]);

  // Handle iframe messages from Whereby
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin is from Whereby
      if (!event.origin.includes('whereby.com')) return;

      try {
        const data = event.data;
        
        switch (data.type) {
          case 'whereby_participant_joined':
            setParticipantCount(prev => prev + 1);
            console.log(`👋 Participant joined: ${data.displayName}`);
            break;
            
          case 'whereby_participant_left':
            setParticipantCount(prev => Math.max(0, prev - 1));
            console.log(`👋 Participant left: ${data.displayName}`);
            break;
            
          case 'whereby_ready':
            console.log('✅ Whereby ready');
            setIsConnected(true);
            setIsLoading(false);
            break;
            
          case 'whereby_error':
            console.error('Whereby error:', data.error);
            setError(data.error);
            break;
            
          case 'whereby_meeting_ended':
            console.log('🏁 Whereby meeting ended');
            stopVideo();
            break;
        }
      } catch (error) {
        console.error('Failed to handle Whereby message:', error);
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [stopVideo]);

  // Update participant count when external participants change
  useEffect(() => {
    setParticipantCount(participants.length || 0);
  }, [participants]);

  // Render loading state
  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-900 text-white`}>
            <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg font-medium">Connecting to Whereby...</p>
          <p className="text-sm opacity-75 mt-2">Setting up secure video connection</p>
            </div>
          </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-red-50 text-red-800`}>
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold mb-2">Video Connection Error</h3>
          <p className="text-sm mb-4">{error}</p>
          <div className="space-x-3">
            <button
              onClick={startVideo}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry Connection
            </button>
            <button
              onClick={() => setError(null)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Continue Without Video
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render video-disabled state
  if (!isVideoActive) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100`}>
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">📹</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Whereby Video Session</h3>
          <p className="text-gray-600 mb-4">
            Start video to join the live signing session with secure Whereby conferencing
          </p>
          
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Users className="w-4 h-4" />
              <span>{participants.length + 1} participant{participants.length !== 0 ? 's' : ''}</span>
            </div>
            
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                {currentUser.name} (You - {currentUser.role})
              </Badge>
              {participants.map(participant => (
                <Badge 
                  key={participant.userId} 
                  variant="outline"
                  className={
                    participant.userType === 'notary' ? 'border-purple-300' :
                    participant.userType === 'signer' ? 'border-blue-300' :
                    'border-green-300'
                  }
                >
                  {participant.displayName} ({participant.userType})
                </Badge>
              ))}
            </div>
          </div>
          
          <button
            onClick={startVideo}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Start Whereby Video Session
          </button>
        </div>
      </div>
    );
  }

  // Render active video session
  return (
    <div className={`${className} relative bg-black`}>
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        allow="camera; microphone; fullscreen; speaker; display-capture"
        title="Whereby Video Session"
      />
      
      {/* Status overlay */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <div className="bg-black bg-opacity-75 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Participant count */}
            <div className="flex items-center gap-2 text-white text-sm">
              <Users className="w-4 h-4" />
              <span>{participantCount} participants</span>
      </div>

            {/* Connection status */}
            <div className="flex items-center gap-2 text-white text-sm">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
            </div>
            
            {/* Session info */}
            <div className="text-white text-sm opacity-75">
              Whereby Session • Job {jobId}
        </div>
      </div>

          <div className="flex items-center gap-2">
            {/* Leave button */}
            <button
              onClick={stopVideo}
              className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              title="Leave video session"
            >
              <PhoneOff className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleVideoConference; 