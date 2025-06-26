import { useEffect, useRef, useState, useCallback } from "react";
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
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface MeetingState {
  isConnected: boolean;
  isRecording: boolean;
  participants: ParticipantInfo[];
  localAudio: boolean;
  localVideo: boolean;
  isFullscreen: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
}

export function WherebyIntegration({
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [meetingState, setMeetingState] = useState<MeetingState>({
    isConnected: false,
    isRecording: false,
    participants: [],
    localAudio: true,
    localVideo: true,
    isFullscreen: false,
    connectionQuality: 'unknown'
  });
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout>();

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

  // Start duration timer
  const startDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    
    const startTime = Date.now();
    durationIntervalRef.current = setInterval(() => {
      setMeetingDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
  }, []);

  // Stop duration timer
  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = undefined;
    }
  }, []);

  // Handle Whereby events
  const handleWherebyMessage = useCallback((event: MessageEvent) => {
    if (!event.data || typeof event.data !== 'object') return;

    const { type, data } = event.data;

    switch (type) {
      case 'room_joined':
        setMeetingState(prev => ({ ...prev, isConnected: true }));
        startDurationTimer();
        toast({
          title: "Meeting Joined",
          description: "Successfully connected to the video session.",
        });
        break;

      case 'room_left':
        setMeetingState(prev => ({ 
          ...prev, 
          isConnected: false,
          participants: []
        }));
        stopDurationTimer();
        onMeetingEnd?.();
        break;

      case 'participant_joined':
        if (data && data.participant) {
          const participant: ParticipantInfo = {
            id: data.participant.id,
            displayName: data.participant.displayName || 'Anonymous',
            isAudioEnabled: data.participant.isAudioEnabled ?? true,
            isVideoEnabled: data.participant.isVideoEnabled ?? true,
            role: data.participant.metadata?.role,
            joinedAt: new Date()
          };
          
          setMeetingState(prev => ({
            ...prev,
            participants: [...prev.participants, participant]
          }));
          
          onParticipantJoin?.(participant);
          toast({
            title: "Participant Joined",
            description: `${participant.displayName} joined the session.`,
          });
        }
        break;

      case 'participant_left':
        if (data && data.participant) {
          setMeetingState(prev => ({
            ...prev,
            participants: prev.participants.filter(p => p.id !== data.participant.id)
          }));
          
          onParticipantLeave?.(data.participant);
          toast({
            title: "Participant Left",
            description: `${data.participant.displayName || 'A participant'} left the session.`,
          });
        }
        break;

      case 'microphone_toggle':
        setMeetingState(prev => ({ ...prev, localAudio: data.enabled }));
        break;

      case 'camera_toggle':
        setMeetingState(prev => ({ ...prev, localVideo: data.enabled }));
        break;

      case 'recording_started':
        setMeetingState(prev => ({ ...prev, isRecording: true }));
        onRecordingStart?.();
        toast({
          title: "Recording Started",
          description: "The session is now being recorded.",
        });
        break;

      case 'recording_stopped':
        setMeetingState(prev => ({ ...prev, isRecording: false }));
        onRecordingStop?.();
        toast({
          title: "Recording Stopped",
          description: "Session recording has been saved.",
        });
        break;

      case 'connection_status':
        if (data && data.quality) {
          setMeetingState(prev => ({ ...prev, connectionQuality: data.quality }));
        }
        break;

      case 'error':
        setError(data?.message || 'An error occurred during the video session');
        toast({
          title: "Video Session Error",
          description: data?.message || 'An error occurred during the video session',
          variant: "destructive",
        });
        break;
    }
  }, [toast, startDurationTimer, stopDurationTimer, onMeetingEnd, onRecordingStart, onRecordingStop, onParticipantJoin, onParticipantLeave]);

  // Setup Whereby iframe communication
  useEffect(() => {
    try {
      window.addEventListener('message', handleWherebyMessage);
      return () => {
        window.removeEventListener('message', handleWherebyMessage);
        stopDurationTimer();
      };
    } catch (err) {
      setError('Failed to initialize video session');
    }
  }, [handleWherebyMessage, stopDurationTimer]);

  // Send commands to Whereby iframe
  const sendWherebyCommand = useCallback((command: string, data?: any) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: command,
        data: data || {}
      }, '*');
    }
  }, []);

  // Control functions
  const toggleMicrophone = () => {
    sendWherebyCommand('toggle_microphone');
  };

  const toggleCamera = () => {
    sendWherebyCommand('toggle_camera');
  };

  const startRecording = () => {
    sendWherebyCommand('start_recording');
  };

  const stopRecording = () => {
    sendWherebyCommand('stop_recording');
  };

  const endMeeting = () => {
    sendWherebyCommand('leave_room');
  };

  const toggleFullscreen = () => {
    if (!meetingState.isFullscreen) {
      iframeRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setMeetingState(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }));
  };

  // Generate Whereby room URL with parameters
  const generateWherebyUrl = () => {
    const url = new URL(roomUrl);
    url.searchParams.set('displayName', userName);
    url.searchParams.set('background', 'off');
    url.searchParams.set('chat', 'on');
    url.searchParams.set('people', 'on');
    url.searchParams.set('pipButton', 'on');
    url.searchParams.set('screenshare', 'on');
    url.searchParams.set('embed', 'true');
    
    // Add metadata for role-based features
    url.searchParams.set('metadata', JSON.stringify({
      jobId,
      userId,
      role: userRole
    }));
    
    return url.toString();
  };

  const getConnectionQualityBadge = () => {
    const { connectionQuality } = meetingState;
    switch (connectionQuality) {
      case 'excellent':
        return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
      case 'good':
        return <Badge className="bg-yellow-100 text-yellow-800">Good</Badge>;
      case 'poor':
        return <Badge className="bg-red-100 text-red-800">Poor</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

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
              {meetingState.isRecording && (
                <Badge className="bg-red-100 text-red-800 animate-pulse">
                  <Circle className="h-3 w-3 mr-1 fill-red-600" />
                  RECORDING
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-4">
              {meetingState.isConnected && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  {formatDuration(meetingDuration)}
                </div>
              )}
              {getConnectionQualityBadge()}
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
                  {meetingState.participants.length + (meetingState.isConnected ? 1 : 0)} Participants
                </span>
              </div>
              {meetingState.isConnected && (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>

            {/* Meeting Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant={meetingState.localAudio ? "default" : "destructive"}
                size="sm"
                onClick={toggleMicrophone}
                disabled={!meetingState.isConnected}
              >
                {meetingState.localAudio ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              
              <Button
                variant={meetingState.localVideo ? "default" : "destructive"}
                size="sm"
                onClick={toggleCamera}
                disabled={!meetingState.isConnected}
              >
                {meetingState.localVideo ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>

              {userRole === 'notary' && meetingState.isConnected && (
                <Button
                  variant={meetingState.isRecording ? "destructive" : "default"}
                  size="sm"
                  onClick={meetingState.isRecording ? stopRecording : startRecording}
                >
                  {meetingState.isRecording ? <StopCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                disabled={!meetingState.isConnected}
              >
                {meetingState.isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={endMeeting}
                disabled={!meetingState.isConnected}
              >
                <PhoneOff className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Whereby Video Container */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative w-full" style={{ height: '600px' }}>
            <iframe
              ref={iframeRef}
              src={generateWherebyUrl()}
              allow="camera; microphone; fullscreen; speaker; display-capture"
              allowFullScreen
              className="w-full h-full border-0"
              style={{
                borderRadius: '8px',
              }}
            />
            
            {!meetingState.isConnected && (
              <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                  <Video className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Connecting to Video Session...
                  </h3>
                  <p className="text-gray-600">
                    Please allow camera and microphone access when prompted.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Participants List */}
      {meetingState.participants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Session Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {meetingState.participants.map((participant) => (
                <div key={participant.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {participant.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{participant.displayName}</div>
                      {participant.role && (
                        <div className="text-xs text-gray-500 capitalize">{participant.role}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {participant.isAudioEnabled ? (
                      <Mic className="h-4 w-4 text-green-600" />
                    ) : (
                      <MicOff className="h-4 w-4 text-red-600" />
                    )}
                    {participant.isVideoEnabled ? (
                      <Camera className="h-4 w-4 text-green-600" />
                    ) : (
                      <VideoOff className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recording Information */}
      {meetingState.isRecording && (
        <Alert>
          <Circle className="h-4 w-4 fill-red-600" />
          <AlertDescription>
            This session is being recorded for compliance and quality assurance purposes. 
            The recording will be automatically saved and linked to Job #{jobId}.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default WherebyIntegration;