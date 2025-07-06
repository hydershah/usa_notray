import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useWebRTCAuth } from '@/hooks/useWebRTCAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor,
  MonitorX,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
  Settings,
  Users,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface Participant {
  id: string;
  name: string;
  email: string;
  role: 'notary' | 'signer' | 'witness';
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  stream?: MediaStream;
  isLocal?: boolean;
}

interface WebRTCVideoConferenceProps {
  sessionId: string;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: 'notary' | 'signer' | 'witness';
  };
  participants: Array<{
    userId: string;
    displayName: string;
    email: string;
    userType: 'notary' | 'signer' | 'witness';
  }>;
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (participantId: string) => void;
  className?: string;
}

const ICE_SERVERS = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302'
    ]
  }
];

export const WebRTCVideoConference: React.FC<WebRTCVideoConferenceProps> = ({
  sessionId,
  currentUser,
  participants: externalParticipants,
  onParticipantJoined,
  onParticipantLeft,
  className = ''
}) => {
  const { toast } = useToast();
  const { token, isAuthenticated, error: authError } = useWebRTCAuth();
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  
  // State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [speakingParticipants, setSpeakingParticipants] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize signaling connection
  const initializeSignaling = useCallback(async () => {
    try {
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Connect to signaling server
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const signalingUrl = `${window.location.origin}/video-signaling`;
      
      console.log('🔗 Connecting to signaling server:', signalingUrl);
      console.log('🔑 Using session ID:', sessionId);
      console.log('👤 User info:', { id: currentUser.id, name: currentUser.name, role: currentUser.role });

      const socket = io(signalingUrl, {
        auth: {
          token
        },
        query: {
          sessionId,
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role
        },
        path: '/video-signaling/socket.io',
        timeout: 10000, // 10 second timeout
        transports: ['websocket', 'polling'] // Fallback to polling if WebSocket fails
      });

      socketRef.current = socket;

      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (!socket.connected) {
          console.error('❌ Connection timeout - unable to connect to signaling server');
          setConnectionError('Connection timeout. Please check your internet connection and try again.');
          setIsConnecting(false);
          socket.disconnect();
        }
      }, 15000); // 15 second timeout

      socket.on('connect', () => {
        console.log('✅ Connected to signaling server');
        clearTimeout(connectionTimeout);
        setIsConnected(true);
        setIsConnecting(false);
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from signaling server:', reason);
        clearTimeout(connectionTimeout);
        setIsConnected(false);
        if (reason === 'io server disconnect') {
          // Server disconnected us, try to reconnect
          setConnectionError('Connection lost. Attempting to reconnect...');
        }
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        clearTimeout(connectionTimeout);
        setConnectionError(`Connection failed: ${error.message || 'Unable to connect to video service'}`);
        setIsConnecting(false);
      });

      socket.on('error', (error) => {
        console.error('❌ Signaling error:', error);
        clearTimeout(connectionTimeout);
        setConnectionError(error.message || 'Connection error');
        setIsConnecting(false);
      });

      // Handle participant events
      socket.on('participant-joined', handleParticipantJoined);
      socket.on('participant-left', handleParticipantLeft);
      socket.on('participants-list', handleParticipantsList);

      // Handle WebRTC signaling
      socket.on('offer', handleOffer);
      socket.on('answer', handleAnswer);
      socket.on('ice-candidate', handleIceCandidate);
      socket.on('participant-media-state', handleParticipantMediaState);

    } catch (error) {
      console.error('Failed to initialize signaling:', error);
      setConnectionError(error instanceof Error ? error.message : 'Failed to connect');
      setIsConnecting(false);
    }
  }, [sessionId, currentUser, token]);

  // Get user media
  const getUserMedia = useCallback(async () => {
    try {
      console.log('🎥 Requesting camera and microphone access...');
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support camera/microphone access');
      }

      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      console.log('📋 Media constraints:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Set initial media state
      stream.getAudioTracks().forEach(track => {
        track.enabled = localAudioEnabled;
        console.log('🎤 Audio track enabled:', track.enabled);
      });
      stream.getVideoTracks().forEach(track => {
        track.enabled = localVideoEnabled;
        console.log('📹 Video track enabled:', track.enabled);
      });

      console.log('✅ Local media stream acquired successfully');
      console.log('📊 Stream info:', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });
      
      return stream;

    } catch (error) {
      console.error('❌ Failed to get user media:', error);
      
      let errorMessage = 'Please allow camera and microphone access to join the video conference.';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera and microphone access was denied. Please click the camera icon in your browser and allow access.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera or microphone found. Please connect a camera and microphone and try again.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera or microphone is already in use by another application.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'Camera or microphone does not meet the required specifications.';
        } else {
          errorMessage = error.message || errorMessage;
        }
      }

      toast({
        variant: "destructive",
        title: "Camera/Microphone Error",
        description: errorMessage
      });
      
      throw new Error(errorMessage);
    }
  }, [localAudioEnabled, localVideoEnabled, toast]);

  // Create peer connection
  const createPeerConnection = useCallback((participantId: string) => {
    const peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS
    });

    // Add local stream to connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          to: participantId
        });
      }
    };

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('📺 Received remote stream from:', participantId);
      const [remoteStream] = event.streams;
      remoteStreamsRef.current.set(participantId, remoteStream);
      
      setParticipants(prev => prev.map(p => 
        p.id === participantId 
          ? { ...p, stream: remoteStream }
          : p
      ));
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Peer connection state for ${participantId}:`, peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'failed') {
        // Attempt to restart ICE
        peerConnection.restartIce();
      }
    };

    peersRef.current.set(participantId, peerConnection);
    return peerConnection;
  }, []);

  // Handle signaling events
  const handleParticipantJoined = useCallback((participant: any) => {
    console.log('👋 Participant joined:', participant);
    
    const newParticipant: Participant = {
      id: participant.userId,
      name: participant.userName,
      email: participant.email || '',
      role: participant.userRole,
      isAudioEnabled: participant.isAudioEnabled ?? true,
      isVideoEnabled: participant.isVideoEnabled ?? true,
      isScreenSharing: false,
      isSpeaking: false
    };

    setParticipants(prev => {
      if (prev.find(p => p.id === newParticipant.id)) return prev;
      return [...prev, newParticipant];
    });

    onParticipantJoined?.(newParticipant);
  }, [onParticipantJoined]);

  const handleParticipantLeft = useCallback((data: { userId: string }) => {
    console.log('👋 Participant left:', data.userId);
    
    // Clean up peer connection
    const peerConnection = peersRef.current.get(data.userId);
    if (peerConnection) {
      peerConnection.close();
      peersRef.current.delete(data.userId);
    }

    // Remove remote stream
    remoteStreamsRef.current.delete(data.userId);

    setParticipants(prev => prev.filter(p => p.id !== data.userId));
    onParticipantLeft?.(data.userId);
  }, [onParticipantLeft]);

  const handleParticipantsList = useCallback((participantsList: any[]) => {
    console.log('📋 Participants list received:', participantsList);
    
    const formattedParticipants: Participant[] = participantsList
      .filter(p => p.userId !== currentUser.id)
      .map(p => ({
        id: p.userId,
        name: p.userName,
        email: p.email || '',
        role: p.userRole,
        isAudioEnabled: p.isAudioEnabled ?? true,
        isVideoEnabled: p.isVideoEnabled ?? true,
        isScreenSharing: false,
        isSpeaking: false
      }));

    setParticipants(formattedParticipants);
  }, [currentUser.id]);

  const handleOffer = useCallback(async (data: { offer: RTCSessionDescriptionInit; from: string }) => {
    try {
      const peerConnection = createPeerConnection(data.from);
      
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      if (socketRef.current) {
        socketRef.current.emit('answer', {
          answer: answer,
          to: data.from
        });
      }
    } catch (error) {
      console.error('Failed to handle offer:', error);
    }
  }, [createPeerConnection]);

  const handleAnswer = useCallback(async (data: { answer: RTCSessionDescriptionInit; from: string }) => {
    try {
      const peerConnection = peersRef.current.get(data.from);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  }, []);

  const handleIceCandidate = useCallback(async (data: { candidate: RTCIceCandidateInit; from: string }) => {
    try {
      const peerConnection = peersRef.current.get(data.from);
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (error) {
      console.error('Failed to handle ICE candidate:', error);
    }
  }, []);

  const handleParticipantMediaState = useCallback((data: { userId: string; isAudioEnabled: boolean; isVideoEnabled: boolean; isScreenSharing: boolean }) => {
    setParticipants(prev => prev.map(p => 
      p.id === data.userId 
        ? { 
            ...p, 
            isAudioEnabled: data.isAudioEnabled,
            isVideoEnabled: data.isVideoEnabled,
            isScreenSharing: data.isScreenSharing
          }
        : p
    ));
  }, []);

  // Start calls with existing participants
  const startCalls = useCallback(async () => {
    for (const participant of participants) {
      try {
        const peerConnection = createPeerConnection(participant.id);
        
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        if (socketRef.current) {
          socketRef.current.emit('offer', {
            offer: offer,
            to: participant.id
          });
        }
      } catch (error) {
        console.error(`Failed to start call with ${participant.id}:`, error);
      }
    }
  }, [participants, createPeerConnection]);

  // Media controls
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const newState = !localAudioEnabled;
      
      audioTracks.forEach(track => {
        track.enabled = newState;
      });
      
      setLocalAudioEnabled(newState);

      // Notify other participants
      if (socketRef.current) {
        socketRef.current.emit('media-state-change', {
          isAudioEnabled: newState,
          isVideoEnabled: localVideoEnabled,
          isScreenSharing
        });
      }
    }
  }, [localAudioEnabled, localVideoEnabled, isScreenSharing]);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      const newState = !localVideoEnabled;
      
      videoTracks.forEach(track => {
        track.enabled = newState;
      });
      
      setLocalVideoEnabled(newState);

      // Notify other participants
      if (socketRef.current) {
        socketRef.current.emit('media-state-change', {
          isAudioEnabled: localAudioEnabled,
          isVideoEnabled: newState,
          isScreenSharing
        });
      }
    }
  }, [localAudioEnabled, localVideoEnabled, isScreenSharing]);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        screenStreamRef.current = screenStream;
        
        // Replace video track in all peer connections
        const videoTrack = screenStream.getVideoTracks()[0];
        
        peersRef.current.forEach(async (peerConnection) => {
          const sender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        });

        // Handle screen share end
        videoTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
        
      } else {
        stopScreenShare();
      }
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
      toast({
        variant: "destructive",
        title: "Screen Share Error",
        description: "Failed to start screen sharing. Please try again."
      });
    }
  }, [isScreenSharing, toast]);

  const stopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // Replace screen share with camera
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      
      peersRef.current.forEach(async (peerConnection) => {
        const sender = peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }
      });
    }

    setIsScreenSharing(false);

    // Notify other participants
    if (socketRef.current) {
      socketRef.current.emit('media-state-change', {
        isAudioEnabled: localAudioEnabled,
        isVideoEnabled: localVideoEnabled,
        isScreenSharing: false
      });
    }
  }, [localAudioEnabled, localVideoEnabled]);

  const leaveCall = useCallback(() => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Close all peer connections
    peersRef.current.forEach(peerConnection => peerConnection.close());
    peersRef.current.clear();

    // Disconnect from signaling server
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    setIsConnected(false);
    setParticipants([]);
  }, []);

  // Initialize video conference
  const initializeVideoConference = useCallback(async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);
      
      console.log('🎥 Starting video conference initialization...');
      
      // First get user media
      await getUserMedia();
      console.log('✅ User media acquired');
      
      // Then initialize signaling
      await initializeSignaling();
      console.log('✅ Signaling initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize video conference:', error);
      setIsConnecting(false);
      setConnectionError(
        error instanceof Error 
          ? error.message 
          : 'Failed to start video conference. Please check your camera and microphone permissions.'
      );
    }
  }, [getUserMedia, initializeSignaling]);

  // Effects
  useEffect(() => {
    if (isAuthenticated && token) {
      initializeVideoConference();
    }

    return () => {
      leaveCall();
    };
  }, [isAuthenticated, token, initializeVideoConference, leaveCall]);

  useEffect(() => {
    if (isConnected && participants.length > 0) {
      startCalls();
    }
  }, [isConnected, participants.length, startCalls]);

  // Get optimal grid layout for participant count
  const getGridLayout = (totalParticipants: number) => {
    // Total participants includes local user
    const count = totalParticipants;
    
    if (count <= 2) {
      return {
        desktop: 'grid-cols-1 md:grid-cols-2',
        mobile: 'grid-cols-1',
        aspectRatio: 'aspect-video',
        maxHeight: 'max-h-[60vh]'
      };
    } else if (count <= 4) {
      return {
        desktop: 'grid-cols-2',
        mobile: 'grid-cols-1 sm:grid-cols-2',
        aspectRatio: 'aspect-video',
        maxHeight: 'max-h-[70vh]'
      };
    } else if (count <= 6) {
      return {
        desktop: 'grid-cols-2 lg:grid-cols-3',
        mobile: 'grid-cols-1 sm:grid-cols-2',
        aspectRatio: 'aspect-video',
        maxHeight: 'max-h-[75vh]'
      };
    } else {
      return {
        desktop: 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        mobile: 'grid-cols-1 sm:grid-cols-2',
        aspectRatio: 'aspect-video',
        maxHeight: 'max-h-[80vh]'
      };
    }
  };

  const totalParticipants = participants.length + 1; // +1 for local user
  const gridLayout = getGridLayout(totalParticipants);

  // Enhanced render participant video with better responsive design
  const renderParticipantVideo = (participant: Participant, isLocal: boolean = false) => (
    <div key={participant.id} className={`relative bg-gray-900 rounded-lg overflow-hidden ${gridLayout.aspectRatio} group transition-all duration-200 hover:ring-2 hover:ring-blue-500`}>
      <video
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-cover"
        ref={(el) => {
          if (el && participant.stream) {
            el.srcObject = participant.stream;
          } else if (el && isLocal && localStreamRef.current) {
            el.srcObject = localStreamRef.current;
          }
        }}
      />
      
      {/* Video placeholder when no stream */}
      {!participant.stream && !isLocal && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="text-center text-white">
            <div className="w-16 h-16 bg-gray-700 rounded-full mx-auto mb-3 flex items-center justify-center">
              <span className="text-2xl font-bold">
                {participant.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <p className="text-sm opacity-75">Connecting...</p>
          </div>
        </div>
      )}
      
      {/* Video disabled overlay */}
      {!participant.isVideoEnabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90">
          <div className="text-center text-white">
            <VideoOff className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">Video disabled</p>
          </div>
        </div>
      )}
      
      {/* Participant info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-white text-sm font-medium truncate">
              {participant.name}{isLocal && ' (You)'}
            </span>
            <Badge 
              variant="secondary" 
              className={`text-xs shrink-0 ${
                participant.role === 'notary' ? 'bg-purple-600 text-white' :
                participant.role === 'signer' ? 'bg-blue-600 text-white' : 
                'bg-green-600 text-white'
              }`}
            >
              {participant.role}
            </Badge>
          </div>
          
          <div className="flex items-center gap-1">
            {participant.isAudioEnabled ? (
              <Mic className="h-4 w-4 text-green-400" />
            ) : (
              <MicOff className="h-4 w-4 text-red-400" />
            )}
            {participant.isVideoEnabled ? (
              <Video className="h-4 w-4 text-green-400" />
            ) : (
              <VideoOff className="h-4 w-4 text-red-400" />
            )}
            {participant.isScreenSharing && (
              <Monitor className="h-4 w-4 text-blue-400" />
            )}
          </div>
        </div>
      </div>

      {/* Speaking indicator */}
      {participant.isSpeaking && (
        <div className="absolute inset-0 border-4 border-green-400 rounded-lg pointer-events-none animate-pulse" />
      )}
      
      {/* Screen sharing indicator */}
      {participant.isScreenSharing && (
        <div className="absolute top-2 left-2">
          <Badge variant="default" className="bg-blue-600 text-white text-xs">
            <Monitor className="w-3 h-3 mr-1" />
            Screen
          </Badge>
        </div>
      )}
    </div>
  );

  // Authentication error
  if (authError) {
    return (
      <div className={`${className} flex items-center justify-center bg-red-50 text-red-800`}>
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">🔒</div>
          <h3 className="text-lg font-semibold mb-2">Authentication Error</h3>
          <p className="text-sm mb-4">{authError}</p>
          <Button
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-700"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  // Connection status
  if (!isConnected && isConnecting) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-900 text-white min-h-[400px]`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg font-medium mb-2">Connecting to video conference...</p>
          <p className="text-sm opacity-75">Setting up secure peer-to-peer connection</p>
          
          <div className="mt-6 space-y-2 text-xs opacity-60">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span>Requesting camera and microphone access</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-100"></div>
              <span>Connecting to signaling server</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-200"></div>
              <span>Preparing video streams</span>
            </div>
          </div>
          
          <div className="mt-4 text-xs opacity-50">
            Session ID: {sessionId.slice(-8)}...
          </div>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className={`${className} flex items-center justify-center bg-red-50 text-red-800 min-h-[400px]`}>
        <div className="text-center max-w-md p-6">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold mb-2">Video Connection Error</h3>
          <p className="text-sm mb-4 text-gray-700">{connectionError}</p>
          <div className="space-y-2">
            <Button
              onClick={initializeVideoConference}
              className="bg-red-600 hover:bg-red-700 w-full"
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Try Again'}
            </Button>
            <p className="text-xs text-gray-500">
              Make sure to allow camera and microphone access when prompted
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} flex flex-col bg-gray-900 min-h-0`}>
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-white" />
            <span className="text-white font-medium">
              Video Conference
            </span>
            <Badge variant="secondary" className="bg-gray-700 text-white">
              {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}
            </Badge>
            {isConnected && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-sm">Connected</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="text-white hover:bg-gray-700"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-gray-700"
              title="Video Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className={`flex-1 p-4 overflow-auto ${gridLayout.maxHeight}`}>
        <div className={`grid gap-3 h-full ${gridLayout.desktop} ${gridLayout.mobile}`}>
          {/* Local video */}
          {renderParticipantVideo(
            {
              id: 'local',
              name: currentUser.name,
              email: currentUser.email,
              role: currentUser.role,
              isAudioEnabled: localAudioEnabled,
              isVideoEnabled: localVideoEnabled,
              isScreenSharing: isScreenSharing,
              isSpeaking: false,
              stream: localStreamRef.current
            },
            true
          )}

          {/* Remote participants */}
          {participants.map(participant => renderParticipantVideo(participant))}
        </div>
        
        {/* No participants message */}
        {participants.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <div className="text-center">
              <Users className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Waiting for other participants to join...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 border-t border-gray-700 p-4 shrink-0">
        <div className="flex items-center justify-center gap-3">
          <Button
            variant={localAudioEnabled ? "default" : "destructive"}
            size="sm"
            onClick={toggleAudio}
            className="rounded-full w-12 h-12 hover:scale-105 transition-transform"
            title={localAudioEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {localAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          
          <Button
            variant={localVideoEnabled ? "default" : "destructive"}
            size="sm"
            onClick={toggleVideo}
            className="rounded-full w-12 h-12 hover:scale-105 transition-transform"
            title={localVideoEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {localVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
          
          <Button
            variant={isScreenSharing ? "default" : "outline"}
            size="sm"
            onClick={toggleScreenShare}
            className="rounded-full w-12 h-12 hover:scale-105 transition-transform"
            title={isScreenSharing ? "Stop screen sharing" : "Share screen"}
          >
            {isScreenSharing ? <MonitorX className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
          </Button>
          
          <div className="w-px h-8 bg-gray-600" />
          
          <Button
            variant="destructive"
            size="sm"
            onClick={leaveCall}
            className="rounded-full w-12 h-12 hover:scale-105 transition-transform"
            title="Leave call"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Additional controls for larger screens */}
        <div className="hidden md:flex items-center justify-center gap-2 mt-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
            title="Audio settings"
          >
            <Volume2 className="h-4 w-4 mr-2" />
            Audio
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
            title="Video settings"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
            title="Participants"
          >
            <Users className="h-4 w-4 mr-2" />
            Participants ({totalParticipants})
          </Button>
        </div>
      </div>
    </div>
  );
}; 