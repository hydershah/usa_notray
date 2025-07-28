import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OpenVidu, Session, Stream, Publisher, Subscriber } from 'openvidu-browser';
import { VideoGrid } from './VideoGrid';
import { VideoControls } from './VideoControls';
import { WaitingRoom } from './WaitingRoom';
import { ChatPanel } from './ChatPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  PhoneOff, 
  Users, 
  MessageCircle, 
  Settings,
  Circle,
  Monitor,
  Loader2
} from 'lucide-react';
import type { 
  OpenViduVideoConferenceProps, 
  SessionParticipant, 
  RecordingInfo,
  ChatMessage 
} from '../../../../shared/types/video';

export const OpenViduVideoConference: React.FC<OpenViduVideoConferenceProps> = ({
  sessionId,
  jobId,
  currentUser,
  participants: initialParticipants = [],
  config = {},
  onParticipantJoined,
  onParticipantLeft,
  onRecordingStarted,
  onRecordingStopped,
  onSessionEnded,
  onError,
  autoStart = false,
  className = ''
}) => {
  const { toast } = useToast();
  
  // OpenVidu state
  const [OV, setOV] = useState<OpenVidu | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [publisher, setPublisher] = useState<Publisher | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [streams, setStreams] = useState<Map<string, Stream>>(new Map());
  
  // Session state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants, setParticipants] = useState<SessionParticipant[]>(initialParticipants);
  const [token, setToken] = useState<string>('');
  
  // UI state
  const [showWaitingRoom, setShowWaitingRoom] = useState(!autoStart);
  const [showChat, setShowChat] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingInfo, setRecordingInfo] = useState<RecordingInfo | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Media state
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize OpenVidu when component mounts
  useEffect(() => {
    if (autoStart) {
      joinSession();
    }
  }, [autoStart]);

  // Create OpenVidu session token
  const getToken = useCallback(async (): Promise<string> => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/video-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sessionId,
          userId: currentUser.id,
          role: currentUser.role,
          displayName: currentUser.name
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get video token: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create video session');
      }

      return data.token;
    } catch (error) {
      console.error('Error getting OpenVidu token:', error);
      throw error;
    }
  }, [sessionId, jobId, currentUser]);

  // Join OpenVidu session
  const joinSession = useCallback(async () => {
    if (isConnecting || isConnected) return;

    try {
      setIsConnecting(true);
      setError(null);
      setShowWaitingRoom(false);

      // Get session token
      const sessionToken = await getToken();
      setToken(sessionToken);

      console.log('🔗 OpenVidu token received:', sessionToken);
      console.log('🔗 Token length:', sessionToken.length);
      
      // Debug: Parse and show token details
      try {
        const tokenParts = sessionToken.split('?');
        const baseUrl = tokenParts[0];
        const params = new URLSearchParams(tokenParts[1] || '');
        console.log('🔗 Token base URL:', baseUrl);
        console.log('🔗 Token params:', Object.fromEntries(params));
      } catch (e) {
        console.log('🔗 Token format:', typeof sessionToken, sessionToken.substring(0, 100) + '...');
      }

      // Initialize OpenVidu browser client
      const ov = new OpenVidu();
      
      // Configure ICE servers for WebRTC connectivity
      ov.setAdvancedConfiguration({
        iceServers: [
          {
            urls: ['stun:stun.l.google.com:19302']
          }
        ]
      });
      
      // Enable production mode (disables debug logs)
      if (process.env.NODE_ENV === 'development') {
        ov.enableProdMode();
      }

      setOV(ov);

      // Initialize session (no server URL parameter needed - it's in the token)
      const newSession = ov.initSession();
      setSession(newSession);

      // Set up event listeners
      setupSessionEventListeners(newSession);

      // Connect to session with proper server URL
      await newSession.connect(sessionToken, {
        clientData: JSON.stringify({
          userId: currentUser.id,
          role: currentUser.role,
          displayName: currentUser.name,
          email: currentUser.email
        })
      });

      // Initialize publisher (camera and microphone)
      await initializePublisher(ov, newSession);

      setIsConnected(true);
      setIsConnecting(false);

      toast({
        title: "Connected to video session",
        description: "You have successfully joined the video conference"
      });

    } catch (error) {
      console.error('Error joining session:', error);
      setError(error instanceof Error ? error.message : 'Failed to join session');
      setIsConnecting(false);
      onError?.(error instanceof Error ? error.message : 'Failed to join session');
      
      toast({
        title: "Connection failed",
        description: "Failed to join the video conference",
        variant: "destructive"
      });
    }
  }, [isConnecting, isConnected, getToken, currentUser, onError, toast]);

  // Initialize publisher
  const initializePublisher = async (ov: OpenVidu, session: Session) => {
    try {
      const pub = await ov.initPublisherAsync(undefined, {
        audioSource: undefined,
        videoSource: undefined,
        publishAudio: isAudioEnabled,
        publishVideo: isVideoEnabled,
        resolution: '1280x720',
        frameRate: 30,
        insertMode: 'APPEND',
        mirror: false
      });

      setPublisher(pub);
      await session.publish(pub);

      // Add own stream to streams map
      const newStreams = new Map(streams);
      newStreams.set(pub.stream.connection.connectionId, pub.stream);
      setStreams(newStreams);

    } catch (error) {
      console.error('Error initializing publisher:', error);
      throw error;
    }
  };

  // Set up session event listeners
  const setupSessionEventListeners = (session: Session) => {
    // Stream created (new participant joined)
    session.on('streamCreated', (event) => {
      console.log('Stream created:', event.stream);
      
      const subscriber = session.subscribe(event.stream, undefined);
      setSubscribers(prev => [...prev, subscriber]);
      
      // Add stream to streams map
      setStreams(prev => {
        const newStreams = new Map(prev);
        newStreams.set(event.stream.connection.connectionId, event.stream);
        return newStreams;
      });

      // Add participant
      const participantData = JSON.parse(event.stream.connection.data || '{}');
      const newParticipant: SessionParticipant = {
        userId: participantData.userId,
        connectionId: event.stream.connection.connectionId,
        role: participantData.role,
        displayName: participantData.displayName,
        email: participantData.email,
        isHost: participantData.role === 'notary',
        isConnected: true,
        joinedAt: new Date(),
        videoEnabled: event.stream.hasVideo,
        audioEnabled: event.stream.hasAudio,
        isScreenSharing: event.stream.typeOfVideo === 'SCREEN',
        networkQuality: 'excellent'
      };

      setParticipants(prev => [...prev, newParticipant]);
      onParticipantJoined?.(newParticipant);

      toast({
        title: "Participant joined",
        description: `${newParticipant.displayName} joined the session`
      });
    });

    // Stream destroyed (participant left)
    session.on('streamDestroyed', (event) => {
      console.log('Stream destroyed:', event.stream);
      
      setSubscribers(prev => 
        prev.filter(sub => sub.stream.connection.connectionId !== event.stream.connection.connectionId)
      );
      
      // Remove stream from streams map
      setStreams(prev => {
        const newStreams = new Map(prev);
        newStreams.delete(event.stream.connection.connectionId);
        return newStreams;
      });

      // Remove participant
      const connectionId = event.stream.connection.connectionId;
      setParticipants(prev => {
        const participantToRemove = prev.find(p => p.connectionId === connectionId);
        if (participantToRemove) {
          onParticipantLeft?.(connectionId);
          
          toast({
            title: "Participant left",
            description: `${participantToRemove.displayName} left the session`
          });
        }
        return prev.filter(p => p.connectionId !== connectionId);
      });
    });

    // Session disconnected
    session.on('sessionDisconnected', (event) => {
      console.log('Session disconnected:', event);
      
      if (event.reason !== 'disconnect') {
        toast({
          title: "Session ended",
          description: "The video session has been disconnected",
          variant: "destructive"
        });
      }
      
      leaveSession();
    });

    // Signal received (for chat messages)
    session.on('signal', (event) => {
      if (event.type === 'signal:chat') {
        const messageData = JSON.parse(event.data || '{}');
        const newMessage: ChatMessage = {
          id: Date.now().toString(),
          senderId: event.from?.connectionId || 'system',
          senderName: messageData.senderName || 'Unknown',
          message: messageData.message,
          timestamp: new Date(),
          type: 'text'
        };
        
        setChatMessages(prev => [...prev, newMessage]);
      }
    });
  };

  // Leave session
  const leaveSession = useCallback(() => {
    if (session) {
      session.disconnect();
    }

    // Reset all state
    setOV(null);
    setSession(null);
    setPublisher(null);
    setSubscribers([]);
    setStreams(new Map());
    setIsConnected(false);
    setIsConnecting(false);
    setParticipants([]);
    setToken('');
    setShowWaitingRoom(true);
    setError(null);

    onSessionEnded?.();

    toast({
      title: "Left session",
      description: "You have left the video conference"
    });
  }, [session, onSessionEnded, toast]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (publisher) {
      publisher.publishVideo(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
      
      toast({
        title: isVideoEnabled ? "Camera turned off" : "Camera turned on",
        description: `Your camera is now ${isVideoEnabled ? 'disabled' : 'enabled'}`
      });
    }
  }, [publisher, isVideoEnabled, toast]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (publisher) {
      publisher.publishAudio(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
      
      toast({
        title: isAudioEnabled ? "Microphone muted" : "Microphone unmuted",
        description: `Your microphone is now ${isAudioEnabled ? 'muted' : 'unmuted'}`
      });
    }
  }, [publisher, isAudioEnabled, toast]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/video-recording/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sessionId,
          layout: 'grid',
          resolution: '1920x1080'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start recording');
      }

      const data = await response.json();
      if (data.success) {
        setIsRecording(true);
        const recording: RecordingInfo = {
          recordingId: data.recordingId,
          sessionId,
          status: 'started',
          startTime: new Date(),
          metadata: {
            participants: participants.map(p => p.displayName),
            jobId,
            layout: 'grid',
            quality: '1080p'
          }
        };
        setRecordingInfo(recording);
        onRecordingStarted?.(recording);

        toast({
          title: "Recording started",
          description: "Session recording has begun"
        });
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording failed",
        description: "Failed to start session recording",
        variant: "destructive"
      });
    }
  }, [sessionId, jobId, participants, onRecordingStarted, toast]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!recordingInfo) return;

    try {
      const response = await fetch(`/api/jobs/${jobId}/video-recording/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          recordingId: recordingInfo.recordingId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to stop recording');
      }

      const data = await response.json();
      if (data.success) {
        setIsRecording(false);
        const updatedRecording = {
          ...recordingInfo,
          status: 'stopped' as const,
          endTime: new Date()
        };
        setRecordingInfo(updatedRecording);
        onRecordingStopped?.(updatedRecording);

        toast({
          title: "Recording stopped",
          description: "Session recording has been saved"
        });
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      toast({
        title: "Failed to stop recording",
        description: "There was an error stopping the recording",
        variant: "destructive"
      });
    }
  }, [recordingInfo, jobId, onRecordingStopped, toast]);

  // Show waiting room
  if (showWaitingRoom && !isConnected) {
    return (
      <WaitingRoom
        currentUser={currentUser}
        participants={participants}
        onJoinSession={joinSession}
        isConnecting={isConnecting}
        className={className}
      />
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={`p-6 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="flex items-center space-x-2 text-red-600 mb-2">
          <span className="font-medium">Connection Error</span>
        </div>
        <p className="text-red-700 mb-4">{error}</p>
        <Button onClick={joinSession} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  // Show connecting state
  if (isConnecting) {
    return (
      <div className={`flex items-center justify-center p-12 ${className}`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Connecting to video session...
          </h3>
          <p className="text-gray-500">
            Please wait while we connect you to the conference
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`flex flex-col h-full bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-white">Video Conference</h2>
          <Badge variant="secondary" className="bg-green-500 text-white">
            <Users className="w-3 h-3 mr-1" />
            {participants.filter(p => p.isConnected).length + 1} participants
          </Badge>
          {isRecording && (
            <Badge variant="secondary" className="bg-red-500 text-white animate-pulse">
                              <Circle className="w-3 h-3 mr-1" />
                Recording
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowChat(!showChat)}
            className="text-white hover:bg-gray-700"
          >
            <MessageCircle className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-gray-700"
          >
            <Settings className="w-4 h-4" />
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={leaveSession}
            className="bg-red-600 hover:bg-red-700"
          >
            <PhoneOff className="w-4 h-4 mr-2" />
            Leave
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-4">
          <VideoGrid
            participants={participants}
            streams={streams}
            maxSlots={config.maxParticipants || 8}
            currentUserId={currentUser.id}
            onSlotClick={(position, participant) => {
              console.log('Slot clicked:', position, participant);
            }}
          />
        </div>

        {/* Chat Panel */}
        {showChat && (
          <ChatPanel
            messages={chatMessages}
            currentUser={currentUser}
            onSendMessage={(message) => {
              if (session) {
                session.signal({
                  type: 'chat',
                  data: JSON.stringify({
                    message,
                    senderName: currentUser.name
                  })
                });
              }
            }}
            className="w-80 border-l border-gray-700"
          />
        )}
      </div>

      {/* Video Controls */}
      <VideoControls
        isVideoEnabled={isVideoEnabled}
        isAudioEnabled={isAudioEnabled}
        isScreenSharing={isScreenSharing}
        isRecording={isRecording}
        canRecord={currentUser.role === 'notary' || currentUser.role === 'admin'}
        onToggleVideo={toggleVideo}
        onToggleAudio={toggleAudio}
        onToggleScreenShare={() => {
          // TODO: Implement screen sharing
          setIsScreenSharing(!isScreenSharing);
        }}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onLeaveSession={leaveSession}
        className="p-4 bg-gray-800 border-t border-gray-700"
      />
    </div>
  );
}; 