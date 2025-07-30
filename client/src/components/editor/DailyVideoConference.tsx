import React, { useState, useEffect, useRef, useCallback } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Video, 
  VideoOff, 
  Users,
  AlertCircle,
  Mic,
  MicOff,
  Monitor,
  MonitorOff
} from 'lucide-react';

interface DailyMeeting {
  meetingId: string;
  roomUrl: string;
  hostRoomUrl: string;
  roomName: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
}

interface SessionParticipant {
  userId: number;
  role: 'notary' | 'signer' | 'witness' | 'observer';
  displayName: string;
  email: string;
}

interface ParticipantState {
  isConnected: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  error: string | null;
  name: string;
  role: string;
  isLoading: boolean;
}

interface DailyVideoConferenceProps {
  sessionId: string;
  jobId: number;
  currentUser: {
    id: number;
    name: string;
    role: 'notary' | 'signer' | 'witness' | 'observer';
  };
  participants?: SessionParticipant[];
  onParticipantJoined?: (participant: SessionParticipant) => void;
  onParticipantLeft?: (participantId: number) => void;
  onConnectionStatusChange?: (isConnected: boolean) => void;
  autoStart?: boolean;
  className?: string;
}

const DailyVideoConference: React.FC<DailyVideoConferenceProps> = ({
  sessionId,
  jobId,
  currentUser,
  participants = [],
  onParticipantJoined,
  onParticipantLeft,
  onConnectionStatusChange,
  autoStart = false,
  className = ''
}) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const callObjectRef = useRef<any>(null);
  
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaDeviceStatus, setMediaDeviceStatus] = useState<{
    hasCamera: boolean;
    hasMicrophone: boolean;
    cameraPermission: boolean;
    microphonePermission: boolean;
    errorMessage: string | null;
  }>({
    hasCamera: false,
    hasMicrophone: false,
    cameraPermission: false,
    microphonePermission: false,
    errorMessage: null
  });
  
  // Participant state management - 8 boxes
  const [participantStates, setParticipantStates] = useState<{
    [index: number]: ParticipantState;
  }>({});

  // Initialize participant states
  useEffect(() => {
    const initialStates: { [index: number]: ParticipantState } = {};
    
    // Box 0: Current user
    initialStates[0] = {
      isConnected: false,
      hasVideo: false,
      hasAudio: false,
      error: null,
      name: `${currentUser.name} (You)`,
      role: currentUser.role,
      isLoading: true
    };
    
    // Filter out current user from participants to avoid duplicates
    const otherParticipants = participants.filter(p => {
      // More robust filtering to prevent duplicates
      const isDifferentUser = p.userId !== currentUser.id;
      const isDifferentName = p.displayName?.toLowerCase() !== currentUser.name?.toLowerCase();
      
      return isDifferentUser && isDifferentName;
    });
    
    console.log('🔍 Filtered participants:', {
      currentUser,
      allParticipants: participants,
      otherParticipants
    });
    
    // Boxes 1-7: Other participants or empty
    for (let i = 1; i < 8; i++) {
      const participant = otherParticipants[i - 1];
      if (participant) {
        initialStates[i] = {
          isConnected: false,
          hasVideo: false,
          hasAudio: false,
          error: null,
          name: participant.displayName,
          role: participant.role,
          isLoading: true
        };
      } else {
        initialStates[i] = {
          isConnected: false,
          hasVideo: false,
          hasAudio: false,
          error: null,
          name: '',
          role: '',
          isLoading: false
        };
      }
    }
    
    setParticipantStates(initialStates);
  }, [currentUser, participants]);

  // Update participant count when participants change
  useEffect(() => {
    const otherParticipants = participants.filter(p => {
      // Use same filtering logic as initialization to prevent duplicates
      const isDifferentUser = p.userId !== currentUser.id;
      const isDifferentName = p.displayName?.toLowerCase() !== currentUser.name?.toLowerCase();
      
      return isDifferentUser && isDifferentName;
    });
    setParticipantCount(otherParticipants.length + 1);
  }, [participants, currentUser]);

  // Auto-start video session when component mounts
  useEffect(() => {
    startVideo();
  }, []);

  // Update participant state
  const updateParticipantState = useCallback((index: number, updates: Partial<ParticipantState>) => {
    setParticipantStates(prev => ({
      ...prev,
      [index]: { ...prev[index], ...updates }
    }));
  }, []);

  // Check media device availability and permissions
  const checkMediaDevices = useCallback(async () => {
    try {
      console.log('🔍 Checking media devices...');
      
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        throw new Error('Media devices API not supported in this browser');
      }

      // Get available devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      const microphones = devices.filter(d => d.kind === 'audioinput');
      
      console.log(`📹 Found ${cameras.length} cameras, ${microphones.length} microphones`);
      
      // Test media access permissions
      let hasVideoPermission = false;
      let hasAudioPermission = false;
      let testStream: MediaStream | null = null;
      
      try {
        // Test video and audio access
        testStream = await navigator.mediaDevices.getUserMedia({
          video: cameras.length > 0,
          audio: microphones.length > 0
        });
        
        hasVideoPermission = testStream.getVideoTracks().length > 0;
        hasAudioPermission = testStream.getAudioTracks().length > 0;
        
        console.log(`✅ Permissions: Video=${hasVideoPermission}, Audio=${hasAudioPermission}`);
        
      } catch (permissionError: any) {
        console.warn('⚠️ Permission test failed:', permissionError);
        
        // Handle specific permission errors
        if (permissionError.name === 'NotAllowedError') {
          throw new Error('Camera and microphone access denied. Please allow permissions and try again.');
        } else if (permissionError.name === 'NotFoundError') {
          throw new Error('No camera or microphone found. Please connect your devices and try again.');
        } else if (permissionError.name === 'NotReadableError') {
          throw new Error('Camera or microphone is already in use by another application.');
        } else {
          throw new Error(`Media access error: ${permissionError.message}`);
        }
      } finally {
        // Clean up test stream
        if (testStream) {
          testStream.getTracks().forEach(track => track.stop());
        }
      }
      
      // Update device status
      setMediaDeviceStatus({
        hasCamera: cameras.length > 0,
        hasMicrophone: microphones.length > 0,
        cameraPermission: hasVideoPermission,
        microphonePermission: hasAudioPermission,
        errorMessage: null
      });
      
      return {
        cameras,
        microphones,
        hasVideoPermission,
        hasAudioPermission
      };
      
    } catch (error: any) {
      console.error('❌ Media device check failed:', error);
      
      setMediaDeviceStatus(prev => ({
        ...prev,
        errorMessage: error.message
      }));
      
      throw error;
    }
  }, []);

  // Handle media device errors with user-friendly messages
  const handleMediaError = useCallback((error: any) => {
    let title = "Media Device Issue";
    let description = "";
    let instructions = "";

    if (error.name === 'NotFoundError' || error.message.includes('No camera or microphone')) {
      title = "🔍 No Camera or Microphone Found";
      description = "We couldn't detect a camera or microphone on your device.";
      instructions = "Please connect a camera and microphone, then refresh the page and try again.";
    } else if (error.name === 'NotAllowedError' || error.message.includes('access denied')) {
      title = "🚫 Camera/Microphone Permission Denied";
      description = "Please allow camera and microphone access to join the video session.";
      instructions = "Click the camera icon in your browser's address bar to grant permission, then try again.";
    } else if (error.name === 'NotReadableError' || error.message.includes('already in use')) {
      title = "⚠️ Camera/Microphone Already in Use";
      description = "Your camera or microphone is being used by another application.";
      instructions = "Close other video applications (Zoom, Teams, etc.) and try again.";
    } else if (error.message.includes('not supported')) {
      title = "🌐 Browser Not Supported";
      description = "Your browser doesn't support video conferencing features.";
      instructions = "Please use Chrome, Firefox, Safari, or Edge for the best experience.";
    } else {
      title = "❌ Video Connection Error";
      description = error.message || "An unexpected error occurred while accessing your camera or microphone.";
      instructions = "Please check your device connections and try again.";
    }

    toast({
      variant: "destructive",
      title,
      description: `${description}\n\n💡 ${instructions}`,
      duration: 8000, // Longer duration for important messages
    });

    // Update participant state with error
    updateParticipantState(0, { 
      error: title.replace(/[🔍🚫⚠️🌐❌]/g, '').trim(), 
      isLoading: false 
    });
     }, [toast, updateParticipantState]);

  // Check media devices when component mounts
  useEffect(() => {
    checkMediaDevices().catch(error => {
      console.warn('⚠️ Initial media device check failed:', error);
      // Don't show error toast here, will be shown when user tries to start video
    });
  }, [checkMediaDevices]);

  // Start video session
  const startVideo = useCallback(async () => {
    if (isVideoActive) return;

    try {
      console.log('🎥 Starting Daily video session...');
      
      // First, check media devices before proceeding
      updateParticipantState(0, { isLoading: true, error: null });
      
      try {
        await checkMediaDevices();
        console.log('✅ Media devices check passed');
      } catch (mediaError) {
        console.error('❌ Media devices check failed:', mediaError);
        handleMediaError(mediaError);
        return; // Don't proceed with video session if media check fails
      }

      // Create video session
      const response = await fetch(`/api/jobs/${jobId}/video-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sessionId,
          participants: participants.map(p => ({
            userId: p.userId,
            role: p.role,
            displayName: p.displayName,
            email: p.email
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create video session: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Video session created:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create video session');
      }

      const meeting: DailyMeeting = {
        meetingId: data.meetingId || data.sessionToken,
        roomUrl: data.roomUrl,
        hostRoomUrl: data.hostRoomUrl || data.roomUrl,
        roomName: data.roomName,
        startDate: data.startDate || new Date().toISOString(),
        endDate: data.endDate,
        isLocked: false
      };

      // Initialize Daily call object
      console.log('📺 Initializing Daily call object...');
      
      if (!containerRef.current) {
        throw new Error('Video container element not found');
      }

      // Create Daily call object with custom UI settings
      const callObject = DailyIframe.createFrame(containerRef.current, {
        url: currentUser.role === 'notary' ? meeting.hostRoomUrl : meeting.roomUrl,
        showLeaveButton: false,
        showFullscreenButton: false,
        showLocalVideo: true,
        showParticipantsBar: false
      });

      callObjectRef.current = callObject;

      // Set up event listeners
      callObject
        .on('joined-meeting', (event) => {
          console.log('✅ Joined Daily meeting:', event);
          setIsVideoActive(true);
          setIsConnected(true);
          updateParticipantState(0, { isConnected: true, isLoading: false });
          onConnectionStatusChange?.(true);
          
          toast({
            title: "Video Connected",
            description: "Successfully joined the video conference",
          });
        })
        .on('left-meeting', () => {
          console.log('📤 Left Daily meeting');
          setIsVideoActive(false);
          setIsConnected(false);
          updateParticipantState(0, { isConnected: false });
          onConnectionStatusChange?.(false);
        })
        .on('participant-joined', (event: any) => {
          console.log('👤 Participant joined:', event);
          setParticipantCount(prev => prev + 1);
          
          // Find an empty box for the new participant
          const emptyBoxIndex = Object.keys(participantStates).find(index => 
            parseInt(index) > 0 && !participantStates[parseInt(index)].name
          );
          
          if (emptyBoxIndex) {
            updateParticipantState(parseInt(emptyBoxIndex), {
              isConnected: true,
              name: event.participant?.user_name || 'Participant',
              role: event.participant?.userData?.role || 'participant',
              isLoading: false
            });
          }
          
          onParticipantJoined?.({
            userId: parseInt(event.participant?.user_id) || 0,
            role: event.participant?.userData?.role || 'observer',
            displayName: event.participant?.user_name || 'Participant',
            email: event.participant?.userData?.email || ''
          });
        })
        .on('participant-left', (event: any) => {
          console.log('👋 Participant left:', event);
          setParticipantCount(prev => Math.max(0, prev - 1));
          
          // Find and clear the participant's box
          Object.keys(participantStates).forEach(index => {
            const state = participantStates[parseInt(index)];
            if (state && state.name === event.participant?.user_name) {
              updateParticipantState(parseInt(index), {
                isConnected: false,
                name: '',
                role: '',
                isLoading: false
              });
            }
          });
          
          onParticipantLeft?.(parseInt(event.participant?.user_id) || 0);
        })
        .on('recording-started', () => {
          console.log('🔴 Recording started');
          setIsRecording(true);
        })
        .on('recording-stopped', () => {
          console.log('⏹️ Recording stopped');
          setIsRecording(false);
        })
        .on('error', (error) => {
          console.error('❌ Daily call error:', error);
          
          // Check if this is a media device error
          if (error.errorMsg && (
            error.errorMsg.includes('camera') || 
            error.errorMsg.includes('video') ||
            error.errorMsg.includes('microphone') || 
            error.errorMsg.includes('audio') ||
            error.errorMsg.includes('permission')
          )) {
            // Create a proper error object for media error handling
            const mediaError = new Error(error.errorMsg);
            if (error.errorMsg.includes('permission')) {
              mediaError.name = 'NotAllowedError';
            } else if (error.errorMsg.includes('camera') || error.errorMsg.includes('video')) {
              mediaError.name = 'NotFoundError';
            } else if (error.errorMsg.includes('microphone') || error.errorMsg.includes('audio')) {
              mediaError.name = 'NotFoundError';
            }
            handleMediaError(mediaError);
          } else {
            // Handle general connection errors
            let errorMessage = error.errorMsg || 'Video connection error';
            updateParticipantState(0, { error: errorMessage, isLoading: false });
            
            toast({
              variant: "destructive",
              title: "Video Connection Error",
              description: errorMessage,
            });
          }
        });

      // Count current user + other participants (excluding duplicates)
      const otherParticipants = participants.filter(p => 
        p.userId !== currentUser.id && 
        p.displayName !== currentUser.name
      );
      setParticipantCount(otherParticipants.length + 1);
      
    } catch (error) {
      console.error('❌ Failed to start video session:', error);
      
      // Check if this is a media device error or connection error
      if (error instanceof Error && (
        error.message.includes('camera') ||
        error.message.includes('microphone') ||
        error.message.includes('permission') ||
        error.message.includes('NotAllowed') ||
        error.message.includes('NotFound') ||
        error.message.includes('NotReadable')
      )) {
        handleMediaError(error);
      } else {
        // Handle general connection errors
        updateParticipantState(0, { 
          error: error instanceof Error ? error.message : 'Connection failed',
          isLoading: false 
        });
        
        toast({
          variant: "destructive",
          title: "Video Connection Failed",
          description: error instanceof Error ? error.message : 'Unable to start video conference',
        });
      }
    }
  }, [jobId, sessionId, participants, currentUser, onConnectionStatusChange, onParticipantJoined, onParticipantLeft, toast, participantStates, updateParticipantState, checkMediaDevices, handleMediaError]);

  // Stop video session
  const stopVideo = useCallback(async () => {
    try {
      if (callObjectRef.current) {
        callObjectRef.current.destroy();
        callObjectRef.current = null;
      }
      
      setIsVideoActive(false);
      setIsConnected(false);
      setIsRecording(false);
      setParticipantCount(0);
      
      // Reset all participant states
      Object.keys(participantStates).forEach(index => {
        updateParticipantState(parseInt(index), { isConnected: false });
      });
      
      onConnectionStatusChange?.(false);
      
    } catch (error) {
      console.error('❌ Error stopping video session:', error);
    }
  }, [onConnectionStatusChange, participantStates, updateParticipantState]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/video-session/recording/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setIsRecording(true);
        toast({
          title: "Recording Started",
          description: "Video session recording has begun",
        });
      }
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      toast({
        variant: "destructive",
        title: "Recording Failed",
        description: "Unable to start video recording",
      });
    }
  }, [jobId, toast]);

  // Toggle participant media
  const toggleParticipantMedia = useCallback((index: number, mediaType: 'video' | 'audio') => {
    if (index === 0 && callObjectRef.current) {
      // Only allow current user to control their own media
      if (mediaType === 'video') {
        const currentState = participantStates[0]?.hasVideo || false;
        callObjectRef.current.setLocalVideo(!currentState);
        updateParticipantState(0, { hasVideo: !currentState });
      } else {
        const currentState = participantStates[0]?.hasAudio || false;
        callObjectRef.current.setLocalAudio(!currentState);
        updateParticipantState(0, { hasAudio: !currentState });
      }
    }
  }, [participantStates, updateParticipantState]);

  // Render participant box
  const renderParticipantBox = (index: number) => {
    const state = participantStates[index];
    const isEmpty = !state?.name;
    const isCurrentUser = index === 0;
    
    return (
      <div
        key={index}
        className={`relative rounded-lg overflow-hidden border-2 ${
          isEmpty 
            ? 'bg-gray-800 border-dashed border-gray-600' 
            : state.error
            ? 'bg-red-900 border-red-500'
            : state.isConnected
            ? 'bg-gray-700 border-green-500'
            : 'bg-gray-700 border-yellow-500'
        }`}
        style={{ aspectRatio: '16/9' }}
      >
        {isEmpty ? (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <div className="text-xs">Waiting for participant</div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full relative">
            {state.error ? (
              <div className="w-full h-full flex items-center justify-center bg-red-900/50">
                <div className="text-center text-white p-2">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-xs font-medium mb-1">{state.name}</div>
                  <div className="text-xs text-red-200">{state.error}</div>
                </div>
              </div>
            ) : state.isLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-700">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2"></div>
                  <div className="text-xs font-medium">{state.name}</div>
                  <div className="text-xs text-gray-300">
                    {isCurrentUser ? 'Initializing your video...' : 'Waiting for user to join...'}
                  </div>
                </div>
              </div>
            ) : isCurrentUser ? (
              <div className="w-full h-full">
                {/* Daily iframe will render in the main container */}
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <div className="text-white text-center">
                    <div className="relative">
                      <Video className="w-8 h-8 mx-auto mb-2" />
                      {/* Media device status indicators */}
                      {mediaDeviceStatus.errorMessage && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                          <div className="w-1 h-1 bg-white rounded-full"></div>
                        </div>
                      )}
                      {!mediaDeviceStatus.hasCamera && !mediaDeviceStatus.errorMessage && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                          <VideoOff className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="text-xs font-medium">{state.name}</div>
                    <div className="text-xs text-gray-300 mt-1">
                      {mediaDeviceStatus.errorMessage ? 'Camera/Microphone Error' :
                       state.isConnected ? 'Video Active' :
                       isVideoActive ? 'Connecting to video...' : 'Ready to join'}
                    </div>
                    {mediaDeviceStatus.errorMessage && (
                      <div className="text-xs text-red-300 mt-1 px-2">
                        <div>{mediaDeviceStatus.errorMessage.includes('camera') ? 'Camera not working' : 
                              mediaDeviceStatus.errorMessage.includes('microphone') ? 'Microphone not working' :
                              'Device access denied'}</div>
                        <button
                          onClick={async () => {
                            try {
                              await checkMediaDevices();
                              toast({
                                title: "✅ Device Check Success",
                                description: "Camera and microphone are working properly.",
                              });
                            } catch (error) {
                              handleMediaError(error);
                            }
                          }}
                          className="mt-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                          title="Check devices again"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                <div className="text-white text-center">
                  <div className={`w-2 h-2 rounded-full mx-auto mb-2 ${state.isConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                  <div className="text-xs font-medium">{state.name}</div>
                  <div className="text-xs text-gray-300 mt-1">
                    {state.isConnected ? 'User Active' : 'Waiting for user...'}
                  </div>
                  <Badge variant="outline" className="text-xs mt-1">
                    {state.role}
                  </Badge>
                </div>
              </div>
            )}
            
            {/* Media controls for current user */}
            {isCurrentUser && !state.error && (
              <div className="absolute bottom-2 right-2 flex gap-1">
                <button
                  onClick={() => toggleParticipantMedia(0, 'audio')}
                  className={`p-1 rounded ${
                    state.hasAudio ? 'bg-green-600' : 'bg-red-600'
                  }`}
                  title={state.hasAudio ? 'Mute' : 'Unmute'}
                >
                  {state.hasAudio ? <Mic className="w-3 h-3 text-white" /> : <MicOff className="w-3 h-3 text-white" />}
                </button>
                <button
                  onClick={() => toggleParticipantMedia(0, 'video')}
                  className={`p-1 rounded ${
                    state.hasVideo ? 'bg-green-600' : 'bg-red-600'
                  }`}
                  title={state.hasVideo ? 'Turn off camera' : 'Turn on camera'}
                >
                  {state.hasVideo ? <Video className="w-3 h-3 text-white" /> : <VideoOff className="w-3 h-3 text-white" />}
                </button>
              </div>
            )}
            
            {/* Participant name label */}
            <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {state.name}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Main component render
  return (
    <div className={`${className} relative bg-gray-900 border border-gray-300 rounded-lg overflow-hidden min-h-[400px]`}>
      {/* Session Info Bar - always at the top, not inside scrollable grid */}
      <div className="w-full z-20 sticky top-0 overflow-visible">
        <div className="bg-black/90 px-4 py-3 flex items-center justify-between text-white min-h-[48px]">
          <div className="flex items-center space-x-4 overflow-hidden">
            <div className="flex items-center space-x-2 whitespace-nowrap flex-shrink-0">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
              <span className="text-xs md:text-sm font-medium">{isConnected ? 'Connected' : 'Connecting...'}</span>
            </div>
            <div className="text-xs md:text-sm text-gray-300 whitespace-nowrap flex-shrink-0">
              {participantCount} / 8 participants
            </div>
            {isRecording && (
              <div className="flex items-center space-x-2 text-red-400 whitespace-nowrap flex-shrink-0">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs md:text-sm">Recording</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            {currentUser.role === 'notary' && !isRecording && (
              <button
                onClick={startRecording}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm min-w-[60px]"
                title="Start Recording"
              >
                Record
              </button>
            )}
            <button
              onClick={stopVideo}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm min-w-[60px]"
              title="Leave meeting"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
      {/* Participant Grid - Only show boxes with participants */}
      <div className="w-full h-full p-2 pt-1"> {/* Minimal padding */}
        <div className="flex flex-col space-y-1 h-full max-h-full overflow-y-auto"> {/* Using flex with minimal spacing */}
          {Array.from({ length: 8 })
            .map((_, index) => ({ index, state: participantStates[index] }))
            .filter(({ state }) => state?.name) // Only show boxes with participants
            .map(({ index }) => renderParticipantBox(index))}
        </div>
      </div>
      {/* Hidden Daily iframe container */}
      <div
        ref={containerRef}
        className="absolute inset-0 opacity-0 pointer-events-none"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
};

export default DailyVideoConference;