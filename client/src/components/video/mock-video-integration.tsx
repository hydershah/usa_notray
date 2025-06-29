import React, { useState, useEffect, useCallback, useRef } from "react";
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

interface MockVideoMeetingProps {
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

interface ParticipantVideoFeedsProps {
  roomUrl: string;
  jobId: number;
  userId: number;
  userName?: string;
  userRole: string;
  participants: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    isConnected: boolean;
  }>;
  onParticipantJoin?: (participant: any) => void;
  onParticipantLeave?: (participant: any) => void;
  onRecordingStart?: () => void;
  sessionStarted?: boolean;
}

// Mock participant video feeds component
function ParticipantVideoFeedsInner({
  roomUrl,
  jobId,
  userId,
  userName = "Participant",
  userRole,
  participants,
  onParticipantJoin,
  onParticipantLeave,
  onRecordingStart,
  sessionStarted = false
}: ParticipantVideoFeedsProps) {
  const { toast } = useToast();
  
  // Mock states
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStarted, setRecordingStarted] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  // Simulate connection after a delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsConnected(true);
      setConnectionError(null);
      toast({
        title: "Video Connected",
        description: "Successfully joined the video session (Mock Mode)",
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [toast]);

  // Auto-start recording when session starts (for notary only)
  useEffect(() => {
    if (sessionStarted && isConnected && !recordingStarted && userRole === 'notary') {
      setIsRecording(true);
      setRecordingStarted(true);
      onRecordingStart?.();
      toast({
        title: "Recording Started",
        description: "Session recording is now active (Mock Mode)",
      });
    }
  }, [sessionStarted, isConnected, recordingStarted, userRole, onRecordingStart, toast]);

  // Individual video component
  const ParticipantVideo = ({ participant, isLocal = false }: { participant: any; isLocal?: boolean }) => {
    const displayName = isLocal ? "You" : (participant.displayName || participant.name || 'Participant');
    const role = participants.find(p => p.name === displayName || p.name === participant.displayName)?.role || 'signer';
    
    return (
      <div key={isLocal ? 'local' : participant.id} className="relative">
        <div className="bg-gray-900 rounded-lg aspect-video relative overflow-hidden">
          {/* Mock video placeholder */}
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <div className="text-center">
              {isConnected ? (
                <>
                  <div className="w-16 h-16 bg-gray-700 rounded-full mx-auto mb-2 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-sm">Video Preview</p>
                  <p className="text-xs text-gray-400">Mock Mode</p>
                </>
              ) : (
                <>
                  <VideoOff className="w-6 h-6 mx-auto mb-1" />
                  <p>
                    {isLocal ? 'Starting camera...' : 'Waiting for video...'}
                  </p>
                </>
              )}
            </div>
          </div>
          
          {/* Recording indicator */}
          {isRecording && isLocal && (
            <div className="absolute top-1 left-1">
              <Badge variant="destructive" className="text-xs animate-pulse">
                <Circle className="w-2 h-2 mr-1 fill-current" />
                REC
              </Badge>
            </div>
          )}
          
          {/* Participant name */}
          <div className="absolute bottom-1 left-1 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
            {displayName}
          </div>
          
          {/* Audio/Video status indicators */}
          <div className="absolute top-1 right-1 flex gap-1">
            {!isAudioEnabled && (
              <MicOff className="w-3 h-3 text-red-500" />
            )}
            {!isVideoEnabled && (
              <VideoOff className="w-3 h-3 text-red-500" />
            )}
          </div>
          
          {/* Connection status */}
          <div className={`absolute top-1 right-1 w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} 
               style={{ marginTop: '20px' }} />
        </div>
        
        {/* Role label */}
        <div className="text-xs text-center mt-1 text-gray-600 capitalize">
          {role.replace('_', ' ')}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Connection error display */}
      {connectionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
            <div className="text-sm text-red-700">
              <p className="font-medium">Video Connection Error</p>
              <p className="text-red-600 mb-2">{connectionError}</p>
              <Button 
                size="sm" 
                onClick={() => {
                  setConnectionError(null);
                  window.location.reload();
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Retry Connection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Local participant (current user) - Always show */}
      <ParticipantVideo 
        participant={{ displayName: userName, name: userName }} 
        isLocal={true} 
      />
      
      {/* Remote participants */}
      {participants
        .filter(p => p.name !== userName)
        .map(participant => (
          <ParticipantVideo key={participant.id} participant={participant} isLocal={false} />
        ))
      }
      
      {/* Connection status and debug info */}
      {roomUrl && (
        <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
          <div>Status: {sessionStarted ? 'Recording Session (Mock)' : 'Video Ready (Mock)'}</div>
          <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
          <div>Stream: {isConnected ? 'Mock Active' : 'Connecting'}</div>
          <div>Camera: {isConnected ? 'Mock Active' : 'Starting...'}</div>
        </div>
      )}

      {/* Basic controls */}
      {isConnected && (
        <div className="flex items-center justify-center space-x-2 pt-2 border-t">
          <Button
            size="sm"
            variant={isAudioEnabled ? "default" : "destructive"}
            onClick={() => {
              setIsAudioEnabled(!isAudioEnabled);
              toast({
                title: isAudioEnabled ? "Microphone Muted" : "Microphone Enabled",
                description: "Mock audio control",
              });
            }}
          >
            {isAudioEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
          </Button>
          
          <Button
            size="sm"
            variant={isVideoEnabled ? "default" : "destructive"}
            onClick={() => {
              setIsVideoEnabled(!isVideoEnabled);
              toast({
                title: isVideoEnabled ? "Camera Disabled" : "Camera Enabled", 
                description: "Mock video control",
              });
            }}
          >
            {isVideoEnabled ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
          </Button>
        </div>
      )}
    </div>
  );
}

// Export the mock participant video feeds component
export function ParticipantVideoFeeds(props: ParticipantVideoFeedsProps) {
  return <ParticipantVideoFeedsInner {...props} />;
}

function MockVideoIntegrationInner({
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
}: MockVideoMeetingProps) {
  const { toast } = useToast();
  
  // Mock states
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStartTime, setConnectionStartTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

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

  // Simulate connection after a delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsConnected(true);
      setConnectionStartTime(new Date());
      setError(null);
      toast({
        title: "Video Session Started",
        description: "Successfully connected to the video conference (Mock Mode).",
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [toast]);

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
    setIsAudioEnabled(!isAudioEnabled);
    toast({
      title: isAudioEnabled ? "Microphone Muted" : "Microphone Enabled",
      description: "Mock audio control",
    });
  }, [isAudioEnabled, toast]);

  const handleToggleCamera = useCallback(() => {
    setIsVideoEnabled(!isVideoEnabled);
    toast({
      title: isVideoEnabled ? "Camera Disabled" : "Camera Enabled",
      description: "Mock video control",
    });
  }, [isVideoEnabled, toast]);

  const handleToggleScreenshare = useCallback(() => {
    toast({
      title: "Screen Share",
      description: "Screen sharing is disabled in mock mode",
      variant: "destructive"
    });
  }, [toast]);

  const handleStartRecording = useCallback(() => {
    setIsRecording(true);
    onRecordingStart?.();
    toast({
      title: "Recording Started",
      description: "Mock recording started",
    });
  }, [onRecordingStart, toast]);

  const handleStopRecording = useCallback(() => {
    setIsRecording(false);
    onRecordingStop?.();
    toast({
      title: "Recording Stopped",
      description: "Mock recording stopped",
    });
  }, [onRecordingStop, toast]);

  const handleLeaveRoom = useCallback(() => {
    setIsConnected(false);
    onMeetingEnd?.();
    toast({
      title: "Left Meeting",
      description: "You have left the video conference",
    });
  }, [onMeetingEnd, toast]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Video connection failed: {error}
          <Button 
            className="mt-2 ml-2" 
            size="sm" 
            onClick={() => setError(null)}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">
          Video Conference (Mock Mode)
        </CardTitle>
        <div className="flex items-center space-x-2">
          {isConnected && (
            <Badge variant="outline" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              {formatDuration(meetingDuration)}
            </Badge>
          )}
          {isRecording && (
            <Badge variant="destructive" className="text-xs animate-pulse">
              <Circle className="w-2 h-2 mr-1 fill-current" />
              Recording
            </Badge>
          )}
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? "Connected" : "Connecting..."}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Video display area */}
        <div className="relative bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
          <div className="text-white text-center">
            <div className="w-24 h-24 bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Camera className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-medium mb-2">Mock Video Interface</h3>
            <p className="text-gray-300">Video functionality has been disabled</p>
            <p className="text-sm text-gray-400 mt-2">
              Room: {roomUrl?.split('/').pop() || 'mock-room'}
            </p>
          </div>
          
          {/* Mock controls overlay */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="flex items-center space-x-2 bg-black bg-opacity-70 rounded-full px-4 py-2">
              <Button
                size="sm"
                variant={isAudioEnabled ? "default" : "destructive"}
                onClick={handleToggleMicrophone}
                className="rounded-full w-10 h-10 p-0"
              >
                {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </Button>
              
              <Button
                size="sm"
                variant={isVideoEnabled ? "default" : "destructive"}
                onClick={handleToggleCamera}
                className="rounded-full w-10 h-10 p-0"
              >
                {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={handleToggleScreenshare}
                className="rounded-full w-10 h-10 p-0"
              >
                <ScreenShare className="w-4 h-4" />
              </Button>
              
              <Button
                size="sm"
                variant="destructive"
                onClick={handleLeaveRoom}
                className="rounded-full w-10 h-10 p-0"
              >
                <PhoneOff className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Meeting controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              variant={isRecording ? "destructive" : "default"}
              size="sm"
            >
              {isRecording ? (
                <>
                  <StopCircle className="w-4 h-4 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4 mr-2" />
                  Start Recording
                </>
              )}
            </Button>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Users className="w-4 h-4" />
            <span>Mock participants: {userName} (You)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Main export
export function MockVideoIntegration(props: MockVideoMeetingProps) {
  return <MockVideoIntegrationInner {...props} />;
}

// Backward compatibility exports
export const WherebyIntegration = MockVideoIntegration;
export default MockVideoIntegration; 