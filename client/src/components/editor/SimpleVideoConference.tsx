import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff,
  Users,
  AlertCircle
} from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  role: 'notary' | 'signer' | 'witness' | 'admin';
  stream?: MediaStream;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
}

interface SimpleVideoConferenceProps {
  sessionId: string;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: 'notary' | 'signer' | 'witness' | 'admin' | string;
  };
  participants: Array<{
    userId: string;
    displayName: string;
    email: string;
    userType: 'notary' | 'signer' | 'witness' | 'admin' | string;
  }>;
  className?: string;
}

const SimpleVideoConference: React.FC<SimpleVideoConferenceProps> = ({
  sessionId,
  currentUser,
  participants,
  className = ''
}) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participantStreams, setParticipantStreams] = useState<Map<string, MediaStream>>(new Map());
  const [participantControls, setParticipantControls] = useState<Map<string, { audio: boolean; video: boolean }>>(new Map());
  
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize local media stream
  const initializeMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 15 }
        },
        audio: true
      });
      
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setError(null);
    } catch (err) {
      console.error('Failed to get media devices:', err);
      setError('Failed to access camera or microphone. Please check your permissions.');
    }
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

  // Initialize on mount
  useEffect(() => {
    initializeMedia();

    // Cleanup on unmount
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // For now, we'll just show the local user and placeholder boxes for other participants
  // In a real implementation, you would connect to a video service here
  const allParticipants: Participant[] = [
    {
      id: 'local',
      name: currentUser.name,
      role: currentUser.role as 'notary' | 'signer' | 'witness' | 'admin',
      stream: localStream,
      isAudioEnabled,
      isVideoEnabled
    },
    ...participants.slice(0, 7).map(p => ({
      id: p.userId,
      name: p.displayName,
      role: p.userType as 'notary' | 'signer' | 'witness' | 'admin',
      isAudioEnabled: true,
      isVideoEnabled: true
    }))
  ];

  const renderVideoBox = (participant: Participant, isLocal: boolean = false) => {
    const controls = participantControls.get(participant.id) || { audio: true, video: true };
    
    return (
      <div 
        key={participant.id} 
        className="relative bg-gray-900 rounded-lg overflow-hidden aspect-[16/9] group"
      >
        {/* Video element */}
        {participant.stream || isLocal ? (
          <video
            ref={isLocal ? localVideoRef : undefined}
            autoPlay
            playsInline
            muted={isLocal}
            className="w-full h-full object-cover"
          />
        ) : (
          // Placeholder for remote participants
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <div className="w-10 h-10 bg-gray-700 rounded-full mx-auto mb-1 flex items-center justify-center">
                <span className="text-base font-bold text-white">
                  {participant.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <p className="text-xs text-gray-400">Connecting...</p>
            </div>
          </div>
        )}
        
        {/* Video disabled overlay */}
        {((isLocal && !participant.isVideoEnabled) || (!isLocal && !controls.video)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90">
            <VideoOff className="w-8 h-8 text-gray-400" />
          </div>
        )}
        
        {/* Individual controls - show on hover for all participants */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex gap-1">
            {isLocal ? (
              <>
                <Button
                  size="sm"
                  variant={isAudioEnabled ? "secondary" : "destructive"}
                  className="h-6 w-6 p-0 rounded"
                  onClick={toggleAudio}
                  title={isAudioEnabled ? "Mute" : "Unmute"}
                >
                  {isAudioEnabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                </Button>
                <Button
                  size="sm"
                  variant={isVideoEnabled ? "secondary" : "destructive"}
                  className="h-6 w-6 p-0 rounded"
                  onClick={toggleVideo}
                  title={isVideoEnabled ? "Turn off video" : "Turn on video"}
                >
                  {isVideoEnabled ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant={controls.audio ? "secondary" : "destructive"}
                  className="h-6 w-6 p-0 rounded"
                  onClick={() => {
                    const newControls = new Map(participantControls);
                    newControls.set(participant.id, { ...controls, audio: !controls.audio });
                    setParticipantControls(newControls);
                  }}
                  title={controls.audio ? "Mute participant" : "Unmute participant"}
                >
                  {controls.audio ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                </Button>
                <Button
                  size="sm"
                  variant={controls.video ? "secondary" : "destructive"}
                  className="h-6 w-6 p-0 rounded"
                  onClick={() => {
                    const newControls = new Map(participantControls);
                    newControls.set(participant.id, { ...controls, video: !controls.video });
                    setParticipantControls(newControls);
                  }}
                  title={controls.video ? "Hide video" : "Show video"}
                >
                  {controls.video ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
                </Button>
              </>
            )}
          </div>
        </div>
        
        {/* Participant info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-white text-xs font-medium truncate">
                {participant.name}{isLocal && ' (You)'}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              {(isLocal ? participant.isAudioEnabled : controls.audio) ? (
                <Mic className="h-3 w-3 text-green-400" />
              ) : (
                <MicOff className="h-3 w-3 text-red-400" />
              )}
            </div>
          </div>
          
          <Badge 
            variant="secondary" 
            className={`text-[10px] mt-1 ${
              participant.role === 'admin' ? 'bg-red-600 text-white' :
              participant.role === 'notary' ? 'bg-purple-600 text-white' :
              participant.role === 'signer' ? 'bg-blue-600 text-white' : 
              'bg-green-600 text-white'
            }`}
          >
            {participant.role}
          </Badge>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-900 text-white p-4`}>
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm">{error}</p>
          <Button
            onClick={initializeMedia}
            size="sm"
            variant="outline"
            className="mt-3 text-white border-white hover:bg-white/10"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} flex flex-col bg-gray-900`}>
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-white" />
            <span className="text-white text-sm font-medium">
              Video Conference
            </span>
            <Badge variant="secondary" className="bg-gray-700 text-white text-xs">
              {allParticipants.length} / 8
            </Badge>
          </div>
        </div>
      </div>

      {/* Video Grid - Single column layout for up to 8 participants */}
      <div className="flex-1 p-3 overflow-auto">
        <div className="grid grid-cols-1 gap-2">
          {allParticipants.map((participant, index) => 
            renderVideoBox(participant, participant.id === 'local')
          )}
          
          {/* Empty slots */}
          {Array.from({ length: Math.max(0, 8 - allParticipants.length) }).map((_, index) => (
            <div 
              key={`empty-${index}`}
              className="relative bg-gray-800 rounded-lg overflow-hidden aspect-[16/9] border-2 border-dashed border-gray-700"
            >
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <Users className="w-6 h-6 text-gray-600 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">Empty Slot</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 border-t border-gray-700 p-3 shrink-0">
        <div className="flex items-center justify-center gap-2">
          <Button
            variant={isAudioEnabled ? "default" : "destructive"}
            size="sm"
            onClick={toggleAudio}
            className="rounded-full w-10 h-10"
            title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
          
          <Button
            variant={isVideoEnabled ? "default" : "destructive"}
            size="sm"
            onClick={toggleVideo}
            className="rounded-full w-10 h-10"
            title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SimpleVideoConference; 