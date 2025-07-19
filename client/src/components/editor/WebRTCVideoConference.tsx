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
  onConnectionStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
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
  className = '',
  onConnectionStatusChange
}) => {
  // States
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peerConnections, setPeerConnections] = useState<Map<string, RTCPeerConnection>>(new Map());
  const [isInitialized, setIsInitialized] = useState(false); // Add initialization guard
  
  // Video control states
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Authentication - move this before refs that use token
  const { token, isAuthenticated, error: authError } = useWebRTCAuth();

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const initializationRef = useRef<boolean>(false); // Add ref to track initialization
  const sessionIdRef = useRef(sessionId);
  const currentUserRef = useRef(currentUser);
  const tokenRef = useRef(token);

  // Update refs when values change
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Initialize signaling connection
  const initializeSignaling = useCallback(async () => {
    try {
      console.log('🔐 Checking authentication...');
      if (!tokenRef.current) {
        throw new Error('Authentication token not available');
      }
      console.log('✅ Token available');

      // Connect to signaling server
      const protocol = window.location.protocol;
      const host = window.location.host;
      const signalingUrl = `${protocol}//${host}`;
      
      console.log('🔗 Connecting to signaling server:', signalingUrl);
      console.log('🔑 Using session ID:', sessionIdRef.current);
      console.log('👤 User info:', { id: currentUserRef.current.id, name: currentUserRef.current.name, role: currentUserRef.current.role });

      const socketConfig = {
        auth: {
          token: tokenRef.current
        },
        query: {
          sessionId: sessionIdRef.current,
          userId: currentUserRef.current.id,
          userName: currentUserRef.current.name,
          userRole: currentUserRef.current.role
        },
        path: '/video-signaling/socket.io',
        timeout: 15000,
        transports: ['websocket', 'polling'] as any,
        forceNew: true, // Force new connection to avoid conflicts
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000
      };

      console.log('📋 Socket.IO config:', {
        url: signalingUrl,
        path: socketConfig.path,
        timeout: socketConfig.timeout,
        transports: socketConfig.transports,
        sessionId: sessionIdRef.current,
        userId: currentUserRef.current.id,
        userName: currentUserRef.current.name,
        userRole: currentUserRef.current.role
      });

      const newSocket = io(`${signalingUrl}/video-signaling`, socketConfig);

      // Socket event handlers
      newSocket.on('connect', () => {
        console.log('🔗 Socket connected successfully');
        setIsConnected(true);
        setConnectionError(null);
        onConnectionStatusChange?.('connected');
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        console.error('🔍 Socket.IO connection error details:', {
          type: error.type,
          message: error.message,
          data: error.data,
          context: (error as any).context
        });
        setConnectionError(`Connection failed: ${error.message}`);
        setIsConnected(false);
        onConnectionStatusChange?.('error');
      });

      newSocket.on('disconnect', (reason) => {
        console.warn('🔌 Socket disconnected:', reason);
        setIsConnected(false);
        onConnectionStatusChange?.('disconnected');
      });

      newSocket.on('participant-joined', (participant) => {
        console.log('👋 Participant joined:', participant);
        setParticipants(prev => [...prev, participant]);
      });

      newSocket.on('participant-left', (participantId) => {
        console.log('👋 Participant left:', participantId);
        setParticipants(prev => prev.filter(p => p.id !== participantId));
      });

      // Add participants-list handler
      newSocket.on('participants-list', (participantsList) => {
        console.log('👥 Received participants list:', participantsList);
        setParticipants(participantsList);
      });

      newSocket.on('error', (error) => {
        console.error('❌ Socket error:', error);
        setConnectionError(`Signaling error: ${error.message || error}`);
      });

      // Debug socket.io engine events
      newSocket.io.on('reconnect_attempt', (attempt) => {
        console.log(`🔄 Reconnection attempt ${attempt}`);
        setConnectionError(`Reconnecting... (attempt ${attempt})`);
      });

      newSocket.io.on('reconnect', () => {
        console.log('✅ Reconnected successfully');
        setConnectionError(null);
      });

      newSocket.io.on('reconnect_error', (error) => {
        console.error('❌ Reconnection failed:', error);
      });

      newSocket.io.on('reconnect_failed', () => {
        console.error('❌ All reconnection attempts failed');
        setConnectionError('Failed to reconnect. Please refresh the page.');
      });

      console.log('📡 Socket.IO events registered, waiting for connection...');
      setSocket(newSocket);

    } catch (error) {
      console.error('❌ Signaling initialization failed:', error);
      setConnectionError(error instanceof Error ? error.message : 'Failed to initialize signaling');
      setIsConnected(false);
      onConnectionStatusChange?.('error');
      throw error;
    }
  }, [onConnectionStatusChange]); // Only depend on callback function

  // Get user media
  const getUserMedia = useCallback(async () => {
    try {
      console.log('🎥 Requesting camera and microphone access...');
      
      // Check if getUserMedia is supported
      console.log('🔍 Checking browser support...');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support camera/microphone access. Please use a modern browser like Chrome, Firefox, or Safari.');
      }
      console.log('✅ Browser supports getUserMedia');

      // Check if we're on HTTPS or localhost (required for getUserMedia)
      console.log('🔒 Checking security context...');
      console.log('🔍 Location details:', {
        protocol: location.protocol,
        hostname: location.hostname,
        href: location.href
      });

      if (location.protocol !== 'https:' && !location.hostname.includes('localhost') && location.hostname !== '127.0.0.1') {
        throw new Error('Camera and microphone access requires a secure connection (HTTPS).');
      }
      console.log('✅ Security context is valid');

      const constraints = {
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      console.log('📋 Media constraints:', constraints);
      console.log('🎬 Calling getUserMedia...');
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ getUserMedia successful');
      
      // Set up local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('📺 Local video element configured');
      } else {
        console.warn('⚠️ Local video ref not available');
      }

      // Log stream info
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      
      audioTracks.forEach(track => {
        console.log(`🎤 Audio track enabled: ${track.enabled} Label: ${track.label}`);
      });
      
      videoTracks.forEach(track => {
        console.log(`📹 Video track enabled: ${track.enabled} Label: ${track.label}`);
      });

      console.log('✅ Local media stream acquired successfully');
      console.log('📊 Stream info:', {
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        videoConstraints: constraints.video,
        audioConstraints: constraints.audio
      });

      setLocalStream(stream);
      return stream;

    } catch (error) {
      console.error('❌ getUserMedia failed:', error);
      let errorMessage = 'Failed to access camera/microphone';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera/microphone access denied. Please allow permissions and refresh the page.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera or microphone found. Please connect a camera/microphone and try again.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera/microphone is already in use by another application.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'Camera/microphone constraints could not be satisfied.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setConnectionError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // Leave call function
  const leaveCall = useCallback(() => {
    try {
      console.log('🧹 WebRTC cleanup triggered');
      
      // Stop local media tracks
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
          console.log(`🛑 Stopped ${track.kind} track`);
        });
        setLocalStream(null);
      }

      // Close peer connections
      peerConnections.forEach((pc, peerId) => {
        pc.close();
        console.log(`🔌 Closed peer connection for: ${peerId}`);
      });
      setPeerConnections(new Map());

      // Disconnect socket
      if (socket) {
        socket.disconnect();
        console.log('🔌 Socket disconnected');
        setSocket(null);
      }

      // Reset states
      setIsConnecting(false);
      setIsConnected(false);
      setConnectionError(null);
      setParticipants([]);
      setRemoteStreams(new Map());
      setIsInitialized(false); // Reset initialization flag
      initializationRef.current = false; // Reset initialization ref
      
      console.log('✅ WebRTC cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }, [localStream, socket, peerConnections]);

  // Initialize video conference - stable function that doesn't depend on state
  const initializeVideoConference = useCallback(async () => {
    // Use ref to prevent re-initialization
    if (initializationRef.current || isConnecting) {
      console.log('⏭️ Skipping initialization - already in progress');
      return;
    }

    initializationRef.current = true;

    try {
      setIsConnecting(true);
      setConnectionError(null);
      
      console.log('🎥 Starting video conference initialization...');
      console.log('🔍 Debug info:', {
        sessionId: sessionIdRef.current,
        currentUser: currentUserRef.current,
        token: tokenRef.current ? 'present' : 'missing',
        isAuthenticated,
        authError,
        location: window.location.href
      });
      
      // First get user media
      console.log('📱 Step 1: Getting user media...');
      await getUserMedia();
      console.log('✅ User media acquired');
      
      // Then initialize signaling
      console.log('📡 Step 2: Initializing signaling...');
      await initializeSignaling();
      console.log('✅ Signaling initialized');
      
      console.log('✅ Video conference initialization completed');
      setIsInitialized(true); // Set initialization flag after success
      
    } catch (error) {
      console.error('❌ Video conference initialization failed:', error);
      setConnectionError(error instanceof Error ? error.message : 'Initialization failed');
      setIsInitialized(false); // Reset flag on error
      initializationRef.current = false; // Reset ref on error
    } finally {
      setIsConnecting(false);
    }
  }, []); // No dependencies - stable function

  // Media control functions
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setLocalAudioEnabled(audioTrack.enabled);
        console.log(`🎤 Audio ${audioTrack.enabled ? 'enabled' : 'disabled'}`);
      }
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setLocalVideoEnabled(videoTrack.enabled);
        console.log(`📹 Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
      }
    }
  }, [localStream]);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing and return to camera
        await getUserMedia();
        setIsScreenSharing(false);
        console.log('🖥️ Screen sharing stopped');
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // Replace local stream with screen stream
        setLocalStream(screenStream);
        localStreamRef.current = screenStream;
        setIsScreenSharing(true);
        
        // Handle screen share ending
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          getUserMedia(); // Return to camera
        };
        
        console.log('🖥️ Screen sharing started');
      }
    } catch (error) {
      console.error('❌ Screen sharing error:', error);
    }
  }, [isScreenSharing, getUserMedia]);

  // Update local stream ref when local stream changes
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Effects - simplified dependencies to prevent infinite loops
  useEffect(() => {
    // Create a stable initialization function
    const init = async () => {
      console.log('🔄 WebRTC useEffect triggered with:', {
        isAuthenticated,
        token: token ? 'present' : 'missing',
        authError,
        sessionId,
        currentUser,
        isInitialized,
        isConnecting
      });

      if (isAuthenticated && token && !isInitialized && !isConnecting) {
        console.log('✅ Prerequisites met, initializing video conference...');
        await initializeVideoConference();
      } else {
        console.warn('⚠️ Prerequisites not met for video conference:', {
          isAuthenticated,
          hasToken: !!token,
          authError,
          isInitialized,
          isConnecting
        });
      }
    };

    init();

    // Cleanup on unmount only
    return () => {
      if (isInitialized) {
        console.log('🧹 Component unmounting, cleaning up...');
        leaveCall();
      }
    };
  }, [isAuthenticated, token, sessionId, initializeVideoConference, leaveCall, isInitialized]); // Add function dependencies

  useEffect(() => {
    if (isConnected && participants.length > 0) {
      // startCalls(); // This function was removed from the original file
    }
  }, [isConnected, participants.length]);

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
          } else if (el && isLocal && localStream) {
            el.srcObject = localStream;
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
          <div className="text-red-500 text-4xl mb-4 font-bold">!</div>
          <h3 className="text-lg font-semibold mb-2">Video Connection Error</h3>
          <p className="text-sm mb-4 text-gray-700">{connectionError}</p>
          
          {/* Diagnostic Information */}
          <div className="bg-white rounded-lg p-4 mb-4 text-left">
            <h4 className="font-medium text-gray-800 mb-2">Diagnostic Information:</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <div>Browser: {navigator.userAgent.split(')')[0]})</div>
              <div>Protocol: {window.location.protocol}</div>
              <div>Host: {window.location.host}</div>
              <div>WebRTC Support: {window.RTCPeerConnection ? 'Yes' : 'No'}</div>
              <div>getUserMedia Support: {navigator.mediaDevices?.getUserMedia ? 'Yes' : 'No'}</div>
              <div>Session ID: {sessionId}</div>
              <div>Token Available: {token ? 'Yes' : 'No'}</div>
              <div>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Button
              onClick={initializeVideoConference}
              className="bg-red-600 hover:bg-red-700 w-full"
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Try Again'}
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="w-full"
            >
              Refresh Page
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