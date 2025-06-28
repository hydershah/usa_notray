import React, { useState, useEffect, useCallback } from "react";
import { useRoomConnection } from "@whereby.com/browser-sdk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff, 
  Users, 
  Circle,
  StopCircle,
  Settings,
  Monitor,
  Camera,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  AlertCircle,
  CheckCircle,
  Clock,
  ScreenShare,
  ScreenShareOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { WherebyProvider } from "@whereby.com/browser-sdk/react";

interface WherebyMeetingProps {
  roomUrl: string;
  jobId: number;
  userId: number;
  userName?: string;
  userRole: string;
  onMeetingEnd?: () => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onParticipantJoin?: (participant: any) => void;
  onParticipantLeave?: (participant: any) => void;
}

interface ParticipantInfo {
  id: string;
  displayName: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  role?: string;
  joinedAt: Date;
}

function WherebyIntegrationInner({
  roomUrl,
  jobId,
  userId,
  userName = "Participant",
  userRole,
  onMeetingEnd,
  onRecordingStart,
  onRecordingStop,
  onParticipantJoin,
  onParticipantLeave
}: WherebyMeetingProps) {
  const { toast } = useToast();
  
  // Whereby connection setup
  const connection = useRoomConnection(roomUrl, {
    localMediaOptions: {
      audio: true,
      video: true,
    },
    displayName: userName,
  });

  const { state, actions, components } = connection;
  const { localParticipant, remoteParticipants } = state;
  const { VideoView } = components;
  const { 
    toggleCamera, 
    toggleMicrophone, 
    toggleScreenshare,
    startRecording,
    stopRecording,
    leaveRoom 
  } = actions;

  // Local state
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStartTime, setConnectionStartTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Format meeting duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle connection state changes
  useEffect(() => {
    if (localParticipant?.stream && !isConnected) {
      setIsConnected(true);
      setConnectionStartTime(new Date());
      toast({
        title: "Video Session Started",
        description: "Successfully connected to the video conference.",
      });
    } else if (!localParticipant?.stream && isConnected) {
      setIsConnected(false);
      setConnectionStartTime(null);
      onMeetingEnd?.();
      toast({
        title: "Video Session Ended",
        description: "You have disconnected from the video conference.",
      });
    }
  }, [localParticipant?.stream, isConnected, onMeetingEnd, toast]);

  // Handle participant changes
  useEffect(() => {
    remoteParticipants.forEach(participant => {
      if (participant.stream) {
        onParticipantJoin?.({
          id: participant.id,
          displayName: participant.displayName || 'Anonymous',
          isAudioEnabled: true,
          isVideoEnabled: true,
          joinedAt: new Date()
        });
      }
    });
  }, [remoteParticipants, onParticipantJoin]);

  // Duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isConnected && connectionStartTime) {
      interval = setInterval(() => {
        const now = new Date();
        const duration = Math.floor((now.getTime() - connectionStartTime.getTime()) / 1000);
        setMeetingDuration(duration);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, connectionStartTime]);

  // Control functions
  const handleToggleMicrophone = useCallback(() => {
    try {
      toggleMicrophone();
      toast({
        title: localParticipant?.isAudioEnabled ? "Microphone Muted" : "Microphone Enabled",
        description: localParticipant?.isAudioEnabled ? "Your microphone is now muted" : "Your microphone is now enabled",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle microphone",
        variant: "destructive"
      });
    }
  }, [toggleMicrophone, localParticipant?.isAudioEnabled, toast]);

  const handleToggleCamera = useCallback(() => {
    try {
      toggleCamera();
      toast({
        title: localParticipant?.isVideoEnabled ? "Camera Disabled" : "Camera Enabled",
        description: localParticipant?.isVideoEnabled ? "Your camera is now disabled" : "Your camera is now enabled",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle camera",
        variant: "destructive"
      });
    }
  }, [toggleCamera, localParticipant?.isVideoEnabled, toast]);

  const handleToggleScreenshare = useCallback(() => {
    try {
      toggleScreenshare();
      toast({
        title: "Screen Share",
        description: "Screen sharing toggled",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle screen share",
        variant: "destructive"
      });
    }
  }, [toggleScreenshare, toast]);

  const handleStartRecording = useCallback(() => {
    try {
      startRecording();
      setIsRecording(true);
      onRecordingStart?.();
      toast({
        title: "Recording Started",
        description: "The session is now being recorded.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start recording",
        variant: "destructive"
      });
    }
  }, [startRecording, onRecordingStart, toast]);

  const handleStopRecording = useCallback(() => {
    try {
      stopRecording();
      setIsRecording(false);
      onRecordingStop?.();
      toast({
        title: "Recording Stopped",
        description: "Session recording has been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop recording",
        variant: "destructive"
      });
    }
  }, [stopRecording, onRecordingStop, toast]);

  const handleEndMeeting = useCallback(() => {
    try {
      leaveRoom();
      setIsConnected(false);
      setConnectionStartTime(null);
      onMeetingEnd?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to leave meeting",
        variant: "destructive"
      });
    }
  }, [leaveRoom, onMeetingEnd, toast]);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Error state
  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Video Session Error: {error}
            </AlertDescription>
          </Alert>
          <Button 
            onClick={() => setError(null)} 
            className="mt-4"
          >
            Retry Connection
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Meeting Controls Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Live Notary Session
              {isRecording && (
                <Badge className="bg-red-100 text-red-800 animate-pulse">
                  <Circle className="h-3 w-3 mr-1 fill-red-600" />
                  RECORDING
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-4">
              {isConnected && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  {formatDuration(meetingDuration)}
                </div>
              )}
              <Badge className={isConnected ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                {isConnected ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </>
                ) : (
                  "Connecting..."
                )}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {/* Participant Info */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">
                  {remoteParticipants.length + (isConnected ? 1 : 0)} Participants
                </span>
              </div>
            </div>

            {/* Meeting Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant={localParticipant?.isAudioEnabled ? "default" : "destructive"}
                size="sm"
                onClick={handleToggleMicrophone}
                disabled={!isConnected}
              >
                {localParticipant?.isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              
              <Button
                variant={localParticipant?.isVideoEnabled ? "default" : "destructive"}
                size="sm"
                onClick={handleToggleCamera}
                disabled={!isConnected}
              >
                {localParticipant?.isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleScreenshare}
                disabled={!isConnected}
              >
                <ScreenShare className="h-4 w-4" />
              </Button>

              {userRole === 'notary' && isConnected && (
                <Button
                  variant={isRecording ? "destructive" : "default"}
                  size="sm"
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                >
                  {isRecording ? <StopCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                disabled={!isConnected}
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={handleEndMeeting}
                disabled={!isConnected}
              >
                <PhoneOff className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Video Grid */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative bg-gray-900" style={{ minHeight: '400px' }}>
            {/* Local Participant Video */}
            {localParticipant?.stream && (
              <div className="absolute bottom-4 right-4 w-48 h-36 bg-black rounded-lg overflow-hidden border-2 border-white shadow-lg z-10">
                <VideoView 
                  stream={localParticipant.stream} 
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 left-1 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                  You
                </div>
                <div className="absolute top-1 right-1 flex gap-1">
                  {!localParticipant.isAudioEnabled && (
                    <MicOff className="w-3 h-3 text-red-500" />
                  )}
                  {!localParticipant.isVideoEnabled && (
                    <VideoOff className="w-3 h-3 text-red-500" />
                  )}
                </div>
              </div>
            )}

            {/* Remote Participants Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 min-h-[400px]">
              {remoteParticipants.length > 0 ? (
                remoteParticipants.map((participant) => (
                  participant.stream && (
                    <div key={participant.id} className="relative bg-black rounded-lg overflow-hidden aspect-video">
                      <VideoView 
                        stream={participant.stream}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                        {participant.displayName || 'Participant'}
                      </div>
                      <div className="absolute top-2 right-2 flex gap-1">
                        {!participant.isAudioEnabled && (
                          <MicOff className="w-3 h-3 text-red-500" />
                        )}
                        {!participant.isVideoEnabled && (
                          <VideoOff className="w-3 h-3 text-red-500" />
                        )}
                      </div>
                    </div>
                  )
                ))
              ) : (
                <div className="col-span-full flex items-center justify-center h-96">
                  <div className="text-center text-white">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">
                      {isConnected ? "Waiting for participants..." : "Connecting to video session..."}
                    </h3>
                    <p className="text-sm opacity-75">
                      {isConnected 
                        ? "Share the meeting link with other participants to get started."
                        : "Please allow camera and microphone access when prompted."
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Status */}
      {!isConnected && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin">
                <Circle className="h-4 w-4" />
              </div>
              <span className="text-sm">Connecting to video session...</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function WherebyIntegration(props: WherebyMeetingProps) {
  return (
    <WherebyProvider>
      <WherebyIntegrationInner {...props} />
    </WherebyProvider>
  );
}

export default WherebyIntegration;