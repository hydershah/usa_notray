import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Users,
  Clock,
  Crown,
  Loader2
} from 'lucide-react';
import type { SessionParticipant } from '../../../../shared/types/video';

interface WaitingRoomProps {
  currentUser: {
    id: number;
    name: string;
    email: string;
    role: 'notary' | 'signer' | 'witness' | 'observer' | 'admin';
    avatar?: string;
  };
  participants: SessionParticipant[];
  onJoinSession: () => void;
  isConnecting: boolean;
  className?: string;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  currentUser,
  participants,
  onJoinSession,
  isConnecting,
  className = ''
}) => {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize camera preview
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: isVideoEnabled,
          audio: isAudioEnabled
        });
        
        setMediaStream(stream);
        
        if (videoRef.current && isVideoEnabled) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera/microphone:', error);
      }
    };

    initializeCamera();

    return () => {
      // Cleanup media stream
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isVideoEnabled, isAudioEnabled]);

  // Update video element when video state changes
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      if (isVideoEnabled) {
        videoRef.current.srcObject = mediaStream;
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [isVideoEnabled, mediaStream]);

  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
    if (mediaStream) {
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
      }
    }
  };

  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
    if (mediaStream) {
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
      }
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
    <div className={`min-h-screen bg-gray-900 p-4 ${className}`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Notary Video Session
          </h1>
          <p className="text-gray-400">
            Ready to join? Test your camera and microphone before entering the session.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Camera Preview */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Video className="w-5 h-5" />
                <span>Camera Preview</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden mb-4">
                {isVideoEnabled ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <VideoOff className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-400">Camera is turned off</p>
                    </div>
                  </div>
                )}
                
                {/* User Info Overlay */}
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge className={`${getRoleBadgeColor(currentUser.role)} text-white`}>
                        {currentUser.role.toUpperCase()}
                        {currentUser.role === 'notary' && <Crown className="w-3 h-3 ml-1" />}
                      </Badge>
                      <span className="text-white font-medium">
                        {currentUser.name} (You)
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      {isAudioEnabled ? (
                        <Mic className="w-4 h-4 text-green-400" />
                      ) : (
                        <MicOff className="w-4 h-4 text-red-400" />
                      )}
                      {isVideoEnabled ? (
                        <Video className="w-4 h-4 text-green-400" />
                      ) : (
                        <VideoOff className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Media Controls */}
              <div className="flex items-center justify-center space-x-4">
                <Button
                  variant={isAudioEnabled ? "secondary" : "destructive"}
                  size="lg"
                  onClick={toggleAudio}
                  className={`h-12 w-12 rounded-full ${
                    isAudioEnabled 
                      ? 'bg-gray-600 hover:bg-gray-500' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isAudioEnabled ? (
                    <Mic className="w-5 h-5" />
                  ) : (
                    <MicOff className="w-5 h-5" />
                  )}
                </Button>

                <Button
                  variant={isVideoEnabled ? "secondary" : "destructive"}
                  size="lg"
                  onClick={toggleVideo}
                  className={`h-12 w-12 rounded-full ${
                    isVideoEnabled 
                      ? 'bg-gray-600 hover:bg-gray-500' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isVideoEnabled ? (
                    <Video className="w-5 h-5" />
                  ) : (
                    <VideoOff className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Session Info */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Session Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current User Info */}
              <div>
                <h3 className="text-white font-medium mb-3">Your Information</h3>
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{currentUser.name}</p>
                      <p className="text-gray-400 text-sm">{currentUser.email}</p>
                      <Badge className={`${getRoleBadgeColor(currentUser.role)} text-white mt-1 text-xs`}>
                        {currentUser.role.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Participants List */}
              <div>
                <h3 className="text-white font-medium mb-3">
                  Participants ({participants.filter(p => p.isConnected).length})
                </h3>
                {participants.length > 0 ? (
                  <div className="space-y-2">
                    {participants.map((participant) => (
                      <div
                        key={participant.connectionId}
                        className="bg-gray-700 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {participant.displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">
                              {participant.displayName}
                            </p>
                            <Badge className={`${getRoleBadgeColor(participant.role)} text-white text-xs`}>
                              {participant.role.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {participant.isConnected ? (
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                          ) : (
                            <Clock className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No other participants yet</p>
                  </div>
                )}
              </div>

              {/* Join Button */}
              <div className="pt-4">
                <Button
                  onClick={onJoinSession}
                  disabled={isConnecting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg"
                  size="lg"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Connecting...
                    </>
                  ) : (
                    'Join Video Session'
                  )}
                </Button>
                
                {!isConnecting && (
                  <p className="text-gray-400 text-sm text-center mt-2">
                    Make sure your camera and microphone are working properly
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}; 