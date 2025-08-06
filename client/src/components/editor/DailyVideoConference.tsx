import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
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

export interface DailyVideoConferenceHandles {
  resetVideoState: () => void;
}

const DailyVideoConference = forwardRef<
  DailyVideoConferenceHandles,
  DailyVideoConferenceProps
>((
  {
    sessionId,
    jobId,
    currentUser,
    participants = [],
    onParticipantJoined,
    onParticipantLeft,
    onConnectionStatusChange,
    autoStart = true,
    className = ''
  },
  ref
) => {
    // All hooks must be called in the same order every render
    const { toast } = useToast();
    
    // All useRef hooks
    const containerRef = useRef<HTMLDivElement>(null);
    const callObjectRef = useRef<any>(null);
    const isStartingVideoRef = useRef(false);
    const connectRetryCountRef = useRef(0);
    const videoStreamsConnectedRef = useRef(false);
    const isManuallyTogglingRef = useRef(false);
    const isMountedRef = useRef(true);
    const lastToggleTimeRef = useRef(0);
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const connectVideoDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const videoRefs = useRef<{[key: number]: HTMLVideoElement | null}>({});
    const startVideoRef = useRef<(() => Promise<void>) | null>(null);
    
    // All useState hooks
    const [showDailyInterface, setShowDailyInterface] = useState(false);
    const [isVideoActive, setIsVideoActive] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [participantCount, setParticipantCount] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
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
    const [participantStates, setParticipantStates] = useState<{
      [index: number]: ParticipantState;
    }>({});
    
    // Constants
    const maxRetries = 3;
    
    // Safe state update wrapper to prevent "setState on unmounted component" warnings
    const safeSetIsVideoActive = useCallback((value: React.SetStateAction<boolean>) => {
      if (isMountedRef.current) {
        setIsVideoActive(value);
      } else {
        console.warn('⚠️ Prevented setIsVideoActive on unmounted component');
      }
    }, []);
    
    const safeSetIsConnected = useCallback((value: React.SetStateAction<boolean>) => {
      if (isMountedRef.current) {
        setIsConnected(value);
      } else {
        console.warn('⚠️ Prevented setIsConnected on unmounted component');
      }
    }, []);
    
    const safeSetParticipantStates = useCallback((value: React.SetStateAction<{[key: number]: ParticipantState}>) => {
      if (isMountedRef.current) {
        setParticipantStates(value);
      } else {
        console.warn('⚠️ Prevented setParticipantStates on unmounted component');
      }
    }, []);

    // Reset video state on component mount
    useEffect(() => {
      console.log('🔄 DailyVideoConference: Resetting video state on mount');
      setIsVideoActive(false);
      setIsConnected(false);
      setIsRecording(false);
      isStartingVideoRef.current = false;
      
      // Clean up any existing call object
      if (callObjectRef.current) {
        console.log('🧹 Cleaning up existing call object on mount');
        try {
          callObjectRef.current.destroy();
        } catch (error) {
          console.warn('⚠️ Error destroying existing call object:', error);
        }
        callObjectRef.current = null;
      }
    }, [sessionId]); // Reset when sessionId changes

    // Initialize participant states
    useEffect(() => {
      // Initialize participant state for current user (index 0) immediately
      setParticipantStates(prev => ({
        ...prev,
        [0]: {
          name: currentUser.name || 'You',
          role: currentUser.role || 'user',
          isLoading: false,
          isConnected: false,
          hasVideo: false,
          hasAudio: false,
          error: null
        }
      }));
      
      // Initialize empty states for other participant slots
      for (let i = 1; i < 8; i++) {
        setParticipantStates(prev => ({
          ...prev,
          [i]: {
            name: '',
            role: 'participant',
            isLoading: false,
            isConnected: false,
            hasVideo: false,
            hasAudio: false,
            error: null
          }
        }));
      }
    }, [currentUser]);

    const resetVideoState = useCallback(() => {
      console.log('🔄 Resetting all video conference state...');
      if (callObjectRef.current) {
        try {
          callObjectRef.current.destroy();
        } catch (error) {
          console.warn('⚠️ Error destroying call object:', error);
        }
        callObjectRef.current = null;
      }
      setIsVideoActive(false);
      setIsConnected(false);
      setParticipantCount(0);
      setIsRecording(false);
      isStartingVideoRef.current = false;
    }, []);

    useImperativeHandle(ref, () => ({
      resetVideoState,
    }));



    useEffect(() => {
      // Cleanup function to destroy the call object on unmount
      return () => {
        if (callObjectRef.current) {
          console.log('🧹 Destroying Daily.co call object on unmount');
          callObjectRef.current.destroy();
          callObjectRef.current = null;
        }
      };
    }, []);

    // Monitor video element availability
    useEffect(() => {
      const checkVideoElement = () => {
        const videoElement = videoRefs.current[0];
        if (videoElement && process.env.NODE_ENV === 'development') {
          console.log('✅ Video element found and ready');
        }
      };

      // Only check if we don't have a video element yet
      if (!videoRefs.current[0]) {
        checkVideoElement();
        // Check after a short delay to allow for rendering
        const timer = setTimeout(checkVideoElement, 100);
        return () => clearTimeout(timer);
      }
    }, [participants.length]); // Only re-run when participant count changes

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

    // Update participant state
    const updateParticipantState = useCallback((index: number, updates: Partial<ParticipantState>) => {
      setParticipantStates(prev => ({
        ...prev,
        [index]: { ...prev[index], ...updates }
      }));
    }, []);

    // Helper function to check if video element is ready
    const isVideoElementReady = useCallback(() => {
      const videoElement = videoRefs.current[0];
      return videoElement && videoElement.readyState >= 0;
    }, []);

    // Helper function to safely get video element
    const getVideoElement = useCallback((index: number): HTMLVideoElement | null => {
      try {
        const element = videoRefs.current[index];
        if (element && element instanceof HTMLVideoElement) {
          return element;
        }
        return null;
      } catch (error) {
        // Silently handle errors to prevent console noise
        return null;
      }
    }, []);

    // Helper function to wait for video element with timeout
    const waitForVideoElement = useCallback((timeout = 2000) => {
      return new Promise<HTMLVideoElement | null>((resolve) => {
        const startTime = Date.now();
        
        const checkElement = () => {
          try {
            const videoElement = getVideoElement(0);
            if (videoElement) {
              console.log('✅ Video element is ready:', {
                element: videoElement,
                readyState: videoElement.readyState,
                videoWidth: videoElement.videoWidth,
                videoHeight: videoElement.videoHeight,
                timeWaited: Date.now() - startTime
              });
              resolve(videoElement);
              return;
            }
            
            const elapsed = Date.now() - startTime;
            if (elapsed < timeout) {
              setTimeout(checkElement, 100);
            } else {
              console.log('⏳ Timeout waiting for video element');
              resolve(null);
            }
          } catch (error) {
            // Silently handle errors to prevent console noise
            resolve(null);
          }
        };
        
        checkElement();
      });
    }, [participantStates, isVideoActive, isConnected, getVideoElement]);



    const connectVideoStreams = useCallback(async () => {
      if (!callObjectRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ No Daily.co call object available for video stream connection');
        }
        return;
      }
      
      // Don't interfere if user is manually toggling video/audio
      if (isManuallyTogglingRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.log('⏸️ Skipping video stream connection - manual toggle in progress');
        }
        return;
      }
      
      // Prevent infinite loops by checking if streams are already connected
      if (videoStreamsConnectedRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.log('⏸️ Video streams already connected, skipping reconnection');
        }
        return;
      }

      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔗 Connecting video streams to custom UI...');
        }
        
        // Get participants from Daily
        const participants = callObjectRef.current.participants();
        const localParticipant = participants.local;
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🎯 Daily participants:', {
            total: Object.keys(participants).length,
            local: !!localParticipant,
            localVideo: !!localParticipant?.tracks?.video,
            localVideoTrack: !!localParticipant?.tracks?.video?.persistentTrack,
            remoteCount: Object.keys(participants).length - 1
          });
        }
        
        // Connect local video (current user - box 0)
        if (localParticipant) {
          // Always initialize current user state first
          if (process.env.NODE_ENV === 'development') {
            console.log('🔄 Initializing current user state...');
          }
          updateParticipantState(0, {
            name: currentUser.name || 'You',
            role: currentUser.role || 'user',
            isLoading: false,
            isConnected: false,
            hasVideo: false,
            hasAudio: false,
            error: null
          });
          
          // Wait for state update and re-render before proceeding
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Wait for video element to be available with longer timeout
          const localVideoElement = await waitForVideoElement(5000); // Increased timeout to 5 seconds
          if (localVideoElement) {
            // Try multiple approaches to get the video track
            let videoTrack = null;
            
            if (localParticipant.tracks?.video?.persistentTrack) {
              videoTrack = localParticipant.tracks.video.persistentTrack;
              console.log('✅ Using persistentTrack for local video');
            } else if (localParticipant.tracks?.video?.track) {
              videoTrack = localParticipant.tracks.video.track;
              console.log('✅ Using track for local video');
            } else if (localParticipant.videoTrack) {
              videoTrack = localParticipant.videoTrack;
              console.log('✅ Using videoTrack for local video');
            }
            
            if (videoTrack) {
              try {
                const stream = new MediaStream([videoTrack]);
                localVideoElement.srcObject = stream;
                try {
                  await localVideoElement.play(); // Await play
                  console.log('✅ Local video play successful');
                } catch (playError) {
                  // Handle AbortError specifically (video element was removed/replaced)
                  if (playError instanceof Error && playError.name === 'AbortError') {
                    console.log('⏸️ Video play aborted (element replaced) - this is normal during reconnection');
                    return; // Don't treat this as an error
                  }
                  handleVideoConnectionError(playError, 'local video playback');
                }
                console.log('✅ Connected local video stream');
                // Reset retry counter on success
                connectRetryCountRef.current = 0;
                // Mark streams as connected to prevent infinite loops
                videoStreamsConnectedRef.current = true;
                updateParticipantState(0, { 
                  isConnected: true, 
                  hasVideo: true,
                  hasAudio: !!localParticipant.tracks?.audio,
                  isLoading: false,
                  error: null,
                  name: localParticipant.user_name || currentUser.name || 'You',
                  role: localParticipant.userData?.role || currentUser.role || 'user'
                });
              } catch (playError) {
                console.error('❌ Local video play failed:', playError);
                handleVideoConnectionError(playError, 'local video playback');
              }
            } else {
              console.warn('⚠️ No video track available for local participant');
              updateParticipantState(0, {
                isConnected: true,
                hasVideo: false,
                hasAudio: !!localParticipant.tracks?.audio,
                isLoading: false,
                error: null,
                name: localParticipant.user_name || currentUser.name || 'You',
                role: localParticipant.userData?.role || currentUser.role || 'user'
              });
            }
          } else {
            console.warn('⚠️ Local video element not found after waiting');
            console.log('🔍 Debug info:', {
              videoRefsKeys: Object.keys(videoRefs.current),
              videoRef0: getVideoElement(0),
              currentState: participantStates[0],
              isEmpty: !participantStates[0]?.name,
              isVideoActive,
              isConnected
            });
            
            // Retry with a limit to prevent infinite loops
            if (connectRetryCountRef.current < maxRetries) {
              connectRetryCountRef.current++;
              console.log(`🔄 Retrying connectVideoStreams (attempt ${connectRetryCountRef.current}/${maxRetries})...`);
              setTimeout(() => {
                try {
                  connectVideoStreams().catch(console.error);
                } catch (err) {
                  console.warn('⚠️ Retry connect video streams failed:', err);
                  handleVideoConnectionError(err, 'video stream retry');
                }
              }, 1000); // Increased delay to allow for rendering
            } else {
              console.error('❌ Max retries reached for connecting video streams');
              // Reset retry counter for future attempts
              connectRetryCountRef.current = 0;
              // Update state to show connection without video
              updateParticipantState(0, {
                isConnected: true,
                hasVideo: false,
                hasAudio: !!localParticipant.tracks?.audio,
                isLoading: false,
                error: 'Video element not available',
                name: localParticipant.user_name || currentUser.name || 'You',
                role: localParticipant.userData?.role || currentUser.role || 'user'
              });
            }
          }
        } else {
          console.warn('⚠️ No local participant found in Daily.co call');
        }
        
        // Connect remote participant videos
        let boxIndex = 1;
        Object.entries(participants).forEach(([sessionId, participant]: [string, any]) => {
          if (sessionId === 'local' || boxIndex >= 8) return;
          
          console.log(`🎯 Processing remote participant ${sessionId}:`, {
            hasVideo: !!participant?.tracks?.video,
            hasVideoTrack: !!participant?.tracks?.video?.persistentTrack,
            userName: participant?.user_name,
            boxIndex
          });
          
          const videoElement = getVideoElement(boxIndex);
          if (videoElement && participant) {
            // Try multiple approaches to get the video track
            let videoTrack = null;
            
            if (participant.tracks?.video?.persistentTrack) {
              videoTrack = participant.tracks.video.persistentTrack;
              console.log(`✅ Using persistentTrack for remote participant ${sessionId}`);
            } else if (participant.tracks?.video?.track) {
              videoTrack = participant.tracks.video.track;
              console.log(`✅ Using track for remote participant ${sessionId}`);
            } else if (participant.videoTrack) {
              videoTrack = participant.videoTrack;
              console.log(`✅ Using videoTrack for remote participant ${sessionId}`);
            }
            
            if (videoTrack) {
              try {
                const stream = new MediaStream([videoTrack]);
                videoElement.srcObject = stream;
                videoElement.play().catch(e => console.warn(`⚠️ Remote video play failed for ${sessionId}:`, e));
                console.log(`✅ Connected remote video stream for ${participant.user_name || 'participant'}`);
                updateParticipantState(boxIndex, { 
                  isConnected: true, 
                  hasVideo: true,
                  hasAudio: !!participant.tracks?.audio,
                  isLoading: false,
                  error: null,
                  name: participant.user_name || 'Participant',
                  role: participant.userData?.role || 'participant'
                });
              } catch (streamError) {
                console.error(`❌ Failed to create remote video stream for ${sessionId}:`, streamError);
                updateParticipantState(boxIndex, {
                  isConnected: true,
                  hasVideo: false,
                  hasAudio: !!participant.tracks?.audio,
                  isLoading: false,
                  error: 'Failed to display video',
                  name: participant.user_name || 'Participant',
                  role: participant.userData?.role || 'participant'
                });
              }
            } else {
              console.warn(`⚠️ No video track available for participant ${sessionId}`);
              updateParticipantState(boxIndex, {
                isConnected: true,
                hasVideo: false,
                hasAudio: !!participant.tracks?.audio,
                isLoading: false,
                error: null,
                name: participant.user_name || 'Participant',
                role: participant.userData?.role || 'participant'
              });
            }
          } else {
            console.warn(`⚠️ No video element or participant for box ${boxIndex}`);
            if (!videoElement) {
              console.log(`🔍 Video element not available for box ${boxIndex}`);
            }
            if (!participant) {
              console.log(`🔍 Participant not available for session ${sessionId}`);
            }
          }
          boxIndex++;
        });
        
      } catch (error) {
        console.error('❌ Error connecting video streams:', error);
      }
    }, [participantStates, currentUser, updateParticipantState, maxRetries, waitForVideoElement]);

    // Debounced version of connectVideoStreams to prevent rapid successive calls
    const debouncedConnectVideoStreams = useCallback(() => {
      if (connectVideoDebounceRef.current) {
        clearTimeout(connectVideoDebounceRef.current);
      }
      
      connectVideoDebounceRef.current = setTimeout(() => {
        connectVideoStreams().catch(console.error);
      }, 100); // 100ms debounce
    }, [connectVideoStreams]);

    // Handle track updates from Daily
    const handleTrackStarted = useCallback((event: any) => {
      console.log('🎥 Track started:', event);
      debouncedConnectVideoStreams();
    }, [debouncedConnectVideoStreams]);

    const handleTrackStopped = useCallback((event: any) => {
      console.log('🛑 Track stopped:', event);
      // Handle video track removal if needed
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

    // Handle video connection errors
    const handleVideoConnectionError = useCallback((error: any, context: string) => {
      console.error(`❌ Video connection error in ${context}:`, error);
      
      let title = "Video Connection Error";
      let description = "Unable to connect video streams.";
      
      if (error.message?.includes('permission')) {
        title = "Camera/Microphone Permission Required";
        description = "Please allow camera and microphone access to join the video session.";
      } else if (error.message?.includes('not found')) {
        title = "Camera/Microphone Not Found";
        description = "Please connect a camera and microphone, then try again.";
      } else if (error.message?.includes('already in use')) {
        title = "Camera/Microphone Already in Use";
        description = "Close other video applications and try again.";
      }
      
      toast({
        variant: "destructive",
        title,
        description,
        duration: 6000,
      });
      
      // Update participant state with error
      updateParticipantState(0, {
        error: title.replace(/[❌]/g, '').trim(),
        isLoading: false,
        isConnected: false
      });
    }, [toast, updateParticipantState]);

    // Check media devices when component mounts
    useEffect(() => {
      console.log('🎬 DailyVideoConference component mounted, autoStart:', autoStart);
      console.log('🎬 Current isVideoActive state:', isVideoActive);
      console.log('🎬 Current user:', currentUser);
      console.log('🎬 Participants:', participants);
      
      // Validate jobId
      if (!jobId || isNaN(Number(jobId)) || Number(jobId) <= 0) {
        console.error('❌ Invalid jobId:', jobId);
        toast({
          title: "Invalid Job ID",
          description: "Please check the URL and ensure you're accessing a valid job.",
          variant: "destructive"
        });
        return;
      }
      
      // Test Daily.co configuration first
      const testConfig = async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            console.error('❌ No authentication token found');
            return;
          }
          
          const response = await fetch('/api/video/test-config', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const config = await response.json();
            console.log('🔍 Daily.co configuration:', config);
            
            if (!config.configured) {
              console.warn('⚠️ Daily.co is not configured - video will use fallback mode');
              toast({
                title: "Video Configuration Warning",
                description: "Video service is not fully configured. Some features may be limited.",
                variant: "default"
              });
            }
          } else {
            console.error('❌ Failed to test Daily.co configuration:', response.status);
          }
        } catch (error) {
          console.error('❌ Error testing Daily.co configuration:', error);
        }
      };
      
      testConfig();
      
      checkMediaDevices().catch(error => {
        console.warn('⚠️ Initial media device check failed:', error);
        // Don't show error toast here, will be shown when user tries to start video
      });
      
      // Only auto-start if not already active and autoStart is true
      if (autoStart && !isVideoActive && !isStartingVideoRef.current) {
        console.log('🎬 Auto-starting video conference...');
        
        const attemptVideoStart = async (attempt = 0) => {
          if (isVideoActive || isStartingVideoRef.current) {
            console.log('⚠️ Video already active or starting, skipping retry');
            return;
          }
          
          try {
            await startVideoRef.current?.();
          } catch (error) {
            console.error(`❌ Auto-start attempt ${attempt + 1} failed:`, error);
            
            if (attempt < maxRetries - 1) {
              const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
              console.log(`⏳ Retrying in ${delay}ms...`);
              setTimeout(() => attemptVideoStart(attempt + 1), delay);
            } else {
              console.error('❌ Max retries reached, giving up auto-start');
              updateParticipantState(0, { 
                isLoading: false,
                error: 'Unable to start video automatically. Please click retry.',
                name: currentUser.name || 'You',
                role: currentUser.role || 'user'
              });
            }
          }
        };
        
        // Start with a small delay to ensure component is fully mounted
        setTimeout(() => attemptVideoStart(0), 1000);
      }
    }, [autoStart]); // Remove isVideoActive from dependencies to prevent loops

    // Start video session
    const startVideo = useCallback(async (retryCount = 0, maxRetries = 2) => {
      if (isVideoActive) {
        console.log('⚠️ Video already active, skipping startVideo');
        return;
      }

      // Validate jobId before attempting to start video
      if (!jobId || isNaN(Number(jobId)) || Number(jobId) <= 0) {
        console.error('❌ Cannot start video: Invalid jobId:', jobId);
        toast({
          title: "Invalid Job ID",
          description: "Please check the URL and ensure you're accessing a valid job.",
          variant: "destructive"
        });
        return;
      }

      if (isStartingVideoRef.current) {
        console.log('⚠️ Video session creation already in progress');
        return;
      }

      try {
        isStartingVideoRef.current = true;
        console.log('🎥 Starting Daily video session...');
        
        // First, check media devices before proceeding
        updateParticipantState(0, { isLoading: true, error: null });
        
        try {
          await checkMediaDevices();
          console.log('✅ Media devices check passed');
          
          // Show user feedback that devices are working
          toast({
            title: "Media Ready",
            description: "Camera and microphone access confirmed",
          });
        } catch (mediaError) {
          console.error('❌ Media devices check failed:', mediaError);
          
          toast({
            title: "Device Error",
            description: "Unable to access camera/microphone. Please check permissions and try again.",
            variant: "destructive"
          });
          
          updateParticipantState(0, { 
            isLoading: false, 
            error: 'Camera/microphone access denied. Please allow permissions and retry.',
            name: currentUser.name || 'You',
            role: currentUser.role || 'user'
          });
          return;
        }

        // Create video session
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found. Please log in again.');
        }

        console.log('🔐 Creating video session with auth token:', {
          hasToken: !!token,
          tokenPrefix: token.substring(0, 20) + '...'
        });

        const sessionResponse = await fetch(`/api/jobs/${jobId}/video-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!sessionResponse.ok) {
          const errorText = await sessionResponse.text();
          console.error('❌ Video session creation failed:', {
            status: sessionResponse.status,
            statusText: sessionResponse.statusText,
            response: errorText
          });
          
          if (sessionResponse.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('token');
            throw new Error('Authentication expired. Please refresh the page and log in again.');
          }
          
          if (sessionResponse.status === 404) {
            // Try to parse the error response
            try {
              const errorData = JSON.parse(errorText);
              if (errorData.error === 'JOB_NOT_FOUND') {
                throw new Error(`Job ${jobId} not found. Please check the URL or contact support.`);
              }
            } catch (parseError) {
              // If we can't parse the error, use the raw text
              throw new Error(`Job not found: ${errorText}`);
            }
          }
          
          throw new Error(`Failed to create video session: ${sessionResponse.status} ${sessionResponse.statusText}`);
        }

        const data = await sessionResponse.json();
        console.log('✅ Video session created:', data);
        console.log('🔍 Response data details:', {
          success: data.success,
          roomUrl: data.roomUrl,
          sessionId: data.sessionId,
          meetingId: data.meetingId,
          hasRoomUrl: !!data.roomUrl,
          roomUrlType: typeof data.roomUrl,
          configured: data.configured,
          mode: data.mode
        });
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to create video session');
        }

        // Create and setup Daily.co call object
        if (data.roomUrl) {
          console.log('🔗 Setting up Daily.co call object with URL:', data.roomUrl);
          
          // Check if a call object already exists and destroy it
          if (callObjectRef.current) {
            console.log('🔄 Destroying existing Daily.co call object');
            try {
              callObjectRef.current.destroy();
            } catch (error) {
              console.warn('⚠️ Error destroying existing call object:', error);
            }
            callObjectRef.current = null;
          }
          
          // Create new call object with error handling
          let callObject;
          try {
            // First, ensure any existing call objects are properly destroyed
            if (callObjectRef.current) {
              console.log('🧹 Cleaning up existing call object...');
              try {
                callObjectRef.current.destroy();
              } catch (destroyError) {
                console.warn('⚠️ Error destroying existing call object:', destroyError);
              }
              callObjectRef.current = null;
            }
            
            // Wait a moment for cleanup to complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            callObject = DailyIframe.createCallObject({
              showLeaveButton: false,
              showFullscreenButton: false,
              allowMultipleCallInstances: true, // Allow multiple instances to prevent errors
              iframeStyle: {
                position: 'fixed',
                width: '0px',
                height: '0px',
                border: '0',
                visibility: 'hidden'
              }
            });
            callObjectRef.current = callObject;
            console.log('✅ Daily.co call object created successfully');
          } catch (createError) {
            console.error('❌ Failed to create Daily call object:', createError);
            updateParticipantState(0, { 
              isLoading: false, 
              error: 'Failed to initialize video. Please try again.',
              name: currentUser.name || 'You',
              role: currentUser.role || 'user'
            });
            throw new Error('Failed to create video call object');
          }

          // Set up event listeners
          callObject
            .on('joined-meeting', (event) => {
              console.log('✅ Joined Daily meeting:', event);
              setIsVideoActive(true);
              setIsConnected(true);
              updateParticipantState(0, { isConnected: true, isLoading: false });
              onConnectionStatusChange?.(true);
              
              // Reset video streams state when joining a new meeting
              resetVideoStreamsState();
              
              // Connect video streams to custom UI with a delay to ensure tracks are ready
              setTimeout(() => {
                console.log('🔗 Delayed video stream connection...');
                connectVideoStreams().catch(console.error);
              }, 1000);
              
              // Also try after a short delay to ensure component is rendered
              setTimeout(() => {
                console.log('🔗 Immediate video stream connection...');
                connectVideoStreams().catch(console.error);
              }, 200);
              
              // Ensure camera and microphone are active
              try {
                callObject.setLocalVideo(true);
                callObject.setLocalAudio(true);
                console.log('✅ Camera and microphone activated');
              } catch (error) {
                console.warn('⚠️ Failed to activate camera/microphone:', error);
              }
              
              toast({
                title: "Video Connected",
                description: "Successfully joined the video conference",
              });
            })
            .on('participant-joined', (event) => {
              console.log('👋 Participant joined:', event.participant);
              // Only reconnect if streams aren't already connected
              if (!videoStreamsConnectedRef.current) {
                setTimeout(() => connectVideoStreams().catch(console.error), 500);
              }
            })
            .on('participant-left', (event) => {
              console.log('👋 Participant left:', event.participant);
              // Only reconnect if streams aren't already connected
              if (!videoStreamsConnectedRef.current) {
                connectVideoStreams().catch(console.error);
              }
            })
            .on('track-started', (event) => {
              console.log('🎥 Track started:', event);
              // Only reconnect if streams aren't already connected
              if (!videoStreamsConnectedRef.current) {
                setTimeout(() => connectVideoStreams().catch(console.error), 100);
              }
            })
            .on('track-stopped', (event) => {
              console.log('🎥 Track stopped:', event);
              // Only reconnect if streams aren't already connected
              if (!videoStreamsConnectedRef.current) {
                connectVideoStreams().catch(console.error);
              }
            })
            .on('participant-updated', (event) => {
              console.log('🔄 Participant updated:', event);
              // Only reconnect if streams aren't already connected
              if (!videoStreamsConnectedRef.current) {
                setTimeout(() => connectVideoStreams().catch(console.error), 100);
              }
            })
            .on('error', (error: any) => {
              console.error('❌ Daily error:', error);
              
              // Don't show error toast for non-critical errors
              if (error.errorMsg && !error.errorMsg.includes('track-not-subscribed')) {
                toast({
                  title: "Video Error",
                  description: error.errorMsg || "Connection issue - retrying...",
                  variant: "destructive"
                });
              }
            })
            .on('camera-error', (error: any) => {
              console.error('❌ Camera error:', error);
              toast({
                title: "Camera Error",
                description: "Unable to access camera. Please check permissions.",
                variant: "destructive"
              });
            })
            .on('left-meeting', (event: any) => {
              console.log('👋 Left meeting:', event);
              setIsConnected(false);
              updateParticipantState(0, { isConnected: false });
            });

          // Join the meeting
          console.log('🚀 Joining Daily meeting...');
          console.log('🔍 Room URL being used:', data.roomUrl);
          console.log('🔍 Call object state before join:', callObject.meetingState());
          
          // Check if we're already in a meeting or joining
          const currentState = callObject.meetingState();
          if (currentState === 'joined-meeting' || currentState === 'joining-meeting') {
            console.warn('⚠️ Already in or joining a meeting, skipping join');
            setIsVideoActive(true);
            setIsConnected(currentState === 'joined-meeting');
            updateParticipantState(0, { 
              isConnected: currentState === 'joined-meeting',
              isLoading: currentState === 'joining-meeting'
            });
            return;
          }
          
          try {
            // Add a timeout for joining
            const joinPromise = callObject.join({
              url: data.roomUrl,
              userName: currentUser.name || 'User',
              // Add these options to improve connection reliability with modern simulcast settings
              sendSettings: {
                video: {
                  maxQuality: 'high',
                  encodings: {
                    low: {
                      maxBitrate: 90000,
                      scaleResolutionDownBy: 2
                    },
                    medium: {
                      maxBitrate: 350000,
                      scaleResolutionDownBy: 1.5
                    },
                    high: {
                      maxBitrate: 680000,
                      scaleResolutionDownBy: 1
                    }
                  }
                }
              }
            });
            
            // Add timeout to join operation
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Join timeout after 30 seconds')), 30000);
            });
            
            const joinResult = await Promise.race([joinPromise, timeoutPromise]);
            console.log('✅ Daily join result:', joinResult);
          } catch (joinError) {
            console.error('❌ Failed to join Daily meeting:', joinError);
            const errorMessage = joinError instanceof Error ? joinError.message : 'Unknown error';
            console.error('❌ Join error details:', {
              message: errorMessage,
              error: joinError,
              callObjectState: callObject.meetingState()
            });
            
            // Update participant state with error
            updateParticipantState(0, { 
              isLoading: false, 
              error: `Failed to join video meeting: ${errorMessage}`,
              name: currentUser.name || 'You',
              role: currentUser.role || 'user'
            });
            
            // Try to clean up
            try {
              callObject.destroy();
              callObjectRef.current = null;
            } catch (cleanupError) {
              console.warn('⚠️ Error during cleanup:', cleanupError);
            }
            
            throw new Error(`Failed to join video meeting: ${errorMessage}`);
          }
        } else {
          console.warn('⚠️ No room URL provided, proceeding without video');
          setIsVideoActive(true);
          updateParticipantState(0, { 
            isLoading: false,
            isConnected: false,
            name: currentUser.name || 'You',
            role: currentUser.role || 'user'
          });
          
          toast({
            title: "Video Not Available",
            description: "Video conference is not configured. Session will continue without video.",
            variant: "default"
          });
        }

        console.log('✅ Video session setup complete');
        
        toast({
          title: "Video Ready",
          description: "Video conference initialized successfully",
          variant: "default"
        });

      } catch (error) {
        console.error('❌ Failed to start video session:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        // Handle specific error types and retry logic
        if (errorMessage.includes('Authentication') || errorMessage.includes('401')) {
          toast({
            title: "Authentication Error",
            description: "Please refresh the page and log in again.",
            variant: "destructive"
          });
          
          // Update participant state with error
          updateParticipantState(0, { 
            isLoading: false, 
            error: "Authentication expired - please refresh and log in again",
            name: currentUser.name || 'You',
            role: currentUser.role || 'user'
          });
        } else if (errorMessage.includes('camera') || errorMessage.includes('microphone')) {
          toast({
            title: "Device Access Error",
            description: "Please allow camera and microphone access, then try again.",
            variant: "destructive"
          });
          
          updateParticipantState(0, { 
            isLoading: false, 
            error: "Camera/microphone access denied - please allow permissions",
            name: currentUser.name || 'You',
            role: currentUser.role || 'user'
          });
        } else if (retryCount < maxRetries) {
          console.log(`🔄 Retrying video start (${retryCount + 1}/${maxRetries})...`);
          
          // Wait before retrying with exponential backoff
          const delay = Math.pow(2, retryCount) * 1000;
          setTimeout(() => {
            startVideo(retryCount + 1, maxRetries);
          }, delay);
          return;
        } else {
          toast({
            title: "Video Connection Failed",
            description: "Unable to start video conference after multiple attempts. Session will continue without video.",
            variant: "destructive"
          });
          
          updateParticipantState(0, { 
            isLoading: false, 
            error: errorMessage,
            name: currentUser.name || 'You',
            role: currentUser.role || 'user'
          });
        }
      } finally {
        isStartingVideoRef.current = false;
      }
    }, [jobId, sessionId, participants, currentUser, isVideoActive, updateParticipantState, checkMediaDevices, connectVideoStreams, onConnectionStatusChange, toast]);

    // Store the startVideo function in the ref
    useEffect(() => {
      startVideoRef.current = startVideo;
    }, [startVideo]);

    // Stop video session
    const stopVideo = useCallback(async () => {
      try {
        console.log('🛑 Stopping video session...');
        
        if (callObjectRef.current) {
          try {
            callObjectRef.current.destroy();
            console.log('✅ Daily.co call object destroyed');
          } catch (error) {
            console.warn('⚠️ Error destroying call object:', error);
          }
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
        
        console.log('✅ Video session stopped successfully');
        
      } catch (error) {
        console.error('❌ Error stopping video session:', error);
      }
    }, [onConnectionStatusChange, participantStates, updateParticipantState]);

    // Manually start camera if not already started
    const ensureCameraStarted = useCallback(async () => {
      if (!callObjectRef.current) return;
      
      try {
        console.log('🔍 Checking camera status...');
        const localVideo = callObjectRef.current.localVideo();
        console.log('📹 Local video status:', localVideo);
        
        if (!localVideo) {
          console.log('📹 Starting camera...');
          await callObjectRef.current.setLocalVideo(true);
          
          // Wait a bit for the camera to start
          setTimeout(() => {
            console.log('🔄 Reconnecting streams after camera start...');
            connectVideoStreams().catch(console.error);
          }, 1000);
        }
        
        const participants = callObjectRef.current.participants();
        console.log('👥 Current participants after camera check:', {
          localTracks: participants.local?.tracks,
          localVideo: !!participants.local?.tracks?.video
        });
        
      } catch (error) {
        console.error('❌ Failed to ensure camera started:', error);
      }
    }, [connectVideoStreams]);

    // Enhanced cleanup on component unmount  
    useEffect(() => {
      return () => {
        console.log('🧹 DailyVideoConference: Starting comprehensive cleanup...');
        
        // Clear all manual toggle flags
        isManuallyTogglingRef.current = false;
        isStartingVideoRef.current = false;
        isMountedRef.current = false;
        
        // Clear debounce timeouts
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
          debounceTimeoutRef.current = null;
        }
        if (connectVideoDebounceRef.current) {
          clearTimeout(connectVideoDebounceRef.current);
          connectVideoDebounceRef.current = null;
        }
        
        // Clear connect retry timeout
        connectRetryCountRef.current = 0;
        
        // Cleanup call object with comprehensive error handling
        if (callObjectRef.current) {
          try {
            console.log('📞 Cleaning up Daily.co call object...');
            
            // Stop local media tracks to release camera/microphone
            const participants = callObjectRef.current.participants();
            if (participants.local?.tracks?.video?.track) {
              participants.local.tracks.video.track.stop();
              console.log('📹 Local video track stopped');
            }
            if (participants.local?.tracks?.audio?.track) {
              participants.local.tracks.audio.track.stop();
              console.log('🎤 Local audio track stopped');
            }
            
            // Leave the call gracefully before destroying
            callObjectRef.current.leave().catch((error: any) => {
              console.warn('⚠️ Error leaving call during cleanup:', error);
            });
            
            // Destroy the call object
            callObjectRef.current.destroy();
            console.log('✅ Call object destroyed successfully');
            
          } catch (error) {
            console.error('❌ Error during call object cleanup:', error);
          } finally {
            callObjectRef.current = null;
          }
        }
        
        // Clear video element refs
        Object.values(videoRefs.current).forEach((videoElement) => {
          if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject as MediaStream;
            stream.getTracks().forEach(track => {
              track.stop();
              console.log(`🎵 Stopped ${track.kind} track`);
            });
            videoElement.srcObject = null;
          }
        });
        videoRefs.current = {};
        
        // Reset all participant states to clean slate
        setParticipantStates({});
        
        // Call connection status change callback if provided
        if (onConnectionStatusChange) {
          onConnectionStatusChange(false);
        }
        
        console.log('✅ DailyVideoConference cleanup completed');
      };
    }, []); // Empty dependency array - only run on unmount
    
    // Add cleanup for video element refs when they change
    useEffect(() => {
      return () => {
        // Cleanup video streams when component updates
        Object.values(videoRefs.current).forEach((videoElement) => {
          if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject as MediaStream;
            if (stream && typeof stream.getTracks === 'function') {
              stream.getTracks().forEach(track => {
                if (track.readyState !== 'ended') {
                  track.stop();
                }
              });
            }
          }
        });
      };
    }, [sessionId]); // Cleanup when session changes

    // Start recording
    const startRecording = useCallback(async () => {
      try {
        // Get the current room information from Daily.co
        const participants = callObjectRef.current?.participants();
        const room = callObjectRef.current?.room();
        
        // Handle the case where room() returns a Promise
        let roomName = null;
        if (room && typeof room.then === 'function') {
          // room() returns a Promise, await it
          const roomData = await room;
          roomName = roomData?.name || null;
        } else if (room && typeof room === 'object') {
          // room() returns an object directly
          roomName = room.name || null;
        }
        
        // If we still don't have a room name, try to get it from the meeting URL
        if (!roomName && callObjectRef.current) {
          const meetingUrl = callObjectRef.current.meetingUrl();
          if (meetingUrl) {
            const urlParts = meetingUrl.split('/');
            roomName = urlParts[urlParts.length - 1] || null;
          }
        }
        
        console.log('🎬 Starting recording with room info:', {
          roomName,
          meetingState: callObjectRef.current?.meetingState(),
          hasParticipants: !!participants,
          room: room,
          meetingUrl: callObjectRef.current?.meetingUrl?.()
        });

        // If we still don't have a room name, use a fallback
        if (!roomName) {
          roomName = `job-${jobId}-session-${Date.now()}`;
          console.log('⚠️ No room name found, using fallback:', roomName);
        }

        const response = await fetch(`/api/jobs/${jobId}/video-session/recording/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            roomName: roomName,
            meetingId: roomName // Use roomName as meetingId as well
          })
        });

        const data = await response.json();
        if (data.success) {
          setIsRecording(true);
          toast({
            title: "Recording Started",
            description: "Video session recording has begun"
          });
        } else {
          throw new Error(data.message || 'Failed to start recording');
        }
      } catch (error) {
        console.error('❌ Failed to start recording:', error);
        toast({
          title: "Recording Error",
          description: error instanceof Error ? error.message : "Failed to start recording",
          variant: "destructive"
        });
      }
    }, [jobId, toast]);

    // Stop recording
    const stopRecording = useCallback(async () => {
      try {
        console.log('🛑 Stopping recording...');
        
        const response = await fetch(`/api/jobs/${jobId}/video-session/recording/stop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            recordingId: 'current' // The backend will handle the current recording
          })
        });

        const data = await response.json();
        if (data.success) {
          setIsRecording(false);
          toast({
            title: "Recording Stopped",
            description: "Video session recording has ended",
          });
        } else {
          throw new Error(data.message || 'Failed to stop recording');
        }
      } catch (error) {
        console.error('❌ Failed to stop recording:', error);
        toast({
          variant: "destructive",
          title: "Stop Recording Failed",
          description: "Unable to stop video recording",
        });
      }
    }, [jobId, toast]);

    // Toggle participant media with debouncing
    const toggleParticipantMedia = useCallback(async (index: number, mediaType: 'video' | 'audio') => {
      if (index !== 0 || !callObjectRef.current) return;
      
      // Debounce rapid clicks
      const now = Date.now();
      if (now - lastToggleTimeRef.current < 1000) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚠️ Ignoring rapid ${mediaType} toggle (debounced)`);
        }
        return;
      }
      lastToggleTimeRef.current = now;
      
      // Clear any pending debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      // Only allow current user to control their own media
      if (process.env.NODE_ENV === 'development') {
        console.log(`🎛️ Toggling ${mediaType} for current user`);
      }
      
      // Set flag to prevent interference from other state updates
      isManuallyTogglingRef.current = true;
      
      try {
        if (mediaType === 'video') {
          const currentState = participantStates[0]?.hasVideo || false;
          if (process.env.NODE_ENV === 'development') {
            console.log(`📹 Current video state: ${currentState}, toggling to: ${!currentState}`);
          }
          
          // Call Daily.co API with proper await
          const result = await callObjectRef.current.setLocalVideo(!currentState);
          if (process.env.NODE_ENV === 'development') {
            console.log(`📹 Daily.co setLocalVideo result:`, result);
          }
          
          // Wait a moment for the API call to fully process
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Verify the state change
          const participants = callObjectRef.current.participants();
          const actualVideoState = !!participants.local?.tracks?.video;
          if (process.env.NODE_ENV === 'development') {
            console.log(`📹 Actual video state after API call: ${actualVideoState}`);
          }
          
          // Update state with the actual result - but prevent conflicting updates
          updateParticipantState(0, { 
            hasVideo: actualVideoState,
            error: null 
          });
          
          toast({
            title: actualVideoState ? "Camera On" : "Camera Off",
            description: actualVideoState ? "Your camera is now enabled" : "Your camera is now disabled",
          });
          
          // Delayed reconnection to avoid conflicts
          debounceTimeoutRef.current = setTimeout(() => {
            if (actualVideoState) {
              if (process.env.NODE_ENV === 'development') {
                console.log('🔄 Reconnecting video streams after toggle...');
              }
              connectVideoStreams().catch(console.error);
            }
            // Clear the manual toggle flag after operation completes
            isManuallyTogglingRef.current = false;
            debounceTimeoutRef.current = null;
          }, 800);
          
        } else {
          const currentState = participantStates[0]?.hasAudio || false;
          if (process.env.NODE_ENV === 'development') {
            console.log(`🎤 Current audio state: ${currentState}, toggling to: ${!currentState}`);
          }
          
          // Call Daily.co API with proper await
          const result = await callObjectRef.current.setLocalAudio(!currentState);
          if (process.env.NODE_ENV === 'development') {
            console.log(`🎤 Daily.co setLocalAudio result:`, result);
          }
          
          // Wait a moment for the API call to fully process
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Verify the state change
          const participants = callObjectRef.current.participants();
          const actualAudioState = !!participants.local?.tracks?.audio;
          if (process.env.NODE_ENV === 'development') {
            console.log(`🎤 Actual audio state after API call: ${actualAudioState}`);
          }
          
          // Update state with the actual result
          updateParticipantState(0, { 
            hasAudio: actualAudioState,
            error: null 
          });
          
          toast({
            title: actualAudioState ? "Microphone On" : "Microphone Off", 
            description: actualAudioState ? "Your microphone is now enabled" : "Your microphone is now muted",
          });
          
          // Clear the manual toggle flag
          debounceTimeoutRef.current = setTimeout(() => {
            isManuallyTogglingRef.current = false;
            debounceTimeoutRef.current = null;
          }, 500);
        }
        
      } catch (error) {
        console.error(`❌ Failed to toggle ${mediaType}:`, error);
        
        updateParticipantState(0, { 
          error: `Failed to toggle ${mediaType}. Please try again.`
        });
        
        toast({
          variant: "destructive",
          title: `${mediaType === 'video' ? 'Camera' : 'Microphone'} Error`,
          description: `Unable to toggle ${mediaType}. Please check your device permissions and try again.`,
        });
        
        // Clear the manual toggle flag on error
        isManuallyTogglingRef.current = false;
      }
    }, [participantStates, updateParticipantState, connectVideoStreams, toast]);

    // Ensure video elements are created before connecting streams
    useEffect(() => {
      if (isVideoActive && callObjectRef.current && !videoStreamsConnectedRef.current) {
        // Wait for video elements to be rendered before connecting streams
        const timer = setTimeout(() => {
          if (process.env.NODE_ENV === 'development') {
            console.log('🎬 Video elements should be ready, attempting to connect streams...');
          }
          connectVideoStreams().catch(console.error);
        }, 500); // Give time for video elements to render
        
        return () => clearTimeout(timer);
      }
    }, [isVideoActive, connectVideoStreams, callObjectRef, videoStreamsConnectedRef]);

    // Reset video streams connection state
    const resetVideoStreamsState = useCallback(() => {
      videoStreamsConnectedRef.current = false;
      connectRetryCountRef.current = 0;
      console.log('🔄 Reset video streams connection state');
    }, []);

    // Cleanup function to properly destroy Daily.co call object
    const cleanupCallObject = useCallback(() => {
      if (callObjectRef.current) {
        console.log('🧹 Cleaning up Daily.co call object...');
        try {
          callObjectRef.current.destroy();
          callObjectRef.current = null;
          console.log('✅ Daily.co call object destroyed successfully');
        } catch (error) {
          console.warn('⚠️ Error destroying Daily.co call object:', error);
        }
      }
      // Reset video streams state
      resetVideoStreamsState();
    }, [resetVideoStreamsState]);

    // Cleanup on component unmount
    useEffect(() => {
      return () => {
        console.log('🎬 DailyVideoConference component unmounting, cleaning up...');
        cleanupCallObject();
      };
    }, [cleanupCallObject]);

    // Render participant box - memoized to prevent unnecessary re-renders
    const renderParticipantBox = useCallback((index: number) => {
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
                    <div className="text-xs text-red-200 mb-2">{state.error}</div>
                    {isCurrentUser && (
                      <button
                        onClick={() => startVideo(0)}
                        className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              ) : state.isLoading ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-700">
                  <div className="text-center text-white">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2"></div>
                    <div className="text-xs font-medium">{state.name}</div>
                    <div className="text-xs text-gray-300 mb-2">
                      {isCurrentUser ? 'Initializing your video...' : 'Waiting for user to join...'}
                    </div>
                    {isCurrentUser && (
                      <button
                        onClick={() => checkMediaDevices()}
                        className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              ) : isCurrentUser ? (
                <div className="w-full h-full relative">
                  {/* Local video from Daily.co */}
                  <video
                    ref={(el) => { 
                      try {
                        if (el) {
                          // Only log if this is actually a different element (not same element re-assigned)
                          const isNewElement = videoRefs.current[0] !== el;
                          videoRefs.current[0] = el;
                          if (isNewElement && process.env.NODE_ENV === 'development') {
                            console.log('✅ Local video element created');
                          }
                          el.playsInline = true;
                          el.autoplay = true;
                          el.muted = true;
                          // Set additional properties to ensure video plays
                          el.setAttribute('webkit-playsinline', 'true');
                          el.setAttribute('playsinline', 'true');
                        } else {
                          // React calls ref with null during cleanup - this is normal behavior
                          // Only clear the ref if it was previously set to avoid unnecessary operations
                          if (videoRefs.current[0]) {
                            videoRefs.current[0] = null;
                          }
                        }
                      } catch (error) {
                        // Silently handle any errors during ref assignment
                      }
                    }}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover bg-gray-800"
                    style={{ transform: 'scaleX(-1)' }} // Mirror local video
                  />
                  
                  {/* Overlay for connection status */}
                  {!state.isConnected && (
                    <div className="absolute inset-0 bg-gray-800/80 flex items-center justify-center">
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
                  )}
                </div>
              ) : (
                <div className="w-full h-full relative">
                  {/* Remote participant video from Daily.co */}
                  <video
                    ref={(el) => { 
                      try {
                        if (el) {
                          // Only log if this is actually a different element (not same element re-assigned)
                          const isNewElement = videoRefs.current[index] !== el;
                          videoRefs.current[index] = el;
                          if (isNewElement && process.env.NODE_ENV === 'development') {
                            console.log(`✅ Remote video element created for index ${index}`);
                          }
                          el.playsInline = true;
                          el.autoplay = true;
                          // Set additional properties to ensure video plays
                          el.setAttribute('webkit-playsinline', 'true');
                          el.setAttribute('playsinline', 'true');
                        } else {
                          // React calls ref with null during cleanup - this is normal behavior
                          // Only clear the ref if it was previously set to avoid unnecessary operations
                          if (videoRefs.current[index]) {
                            videoRefs.current[index] = null;
                          }
                        }
                      } catch (error) {
                        // Silently handle any errors during ref assignment
                      }
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover bg-gray-700"
                  />
                  
                  {/* Fallback when no video stream */}
                  {!state.isConnected && (
                    <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
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
                </div>
              )}
              
              {/* Media controls for current user */}
              {isCurrentUser && !state.error && (
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <button
                    onClick={() => toggleParticipantMedia(0, 'audio').catch(error => 
                      console.error('❌ Audio toggle error:', error)
                    )}
                    className={`p-1 rounded ${
                      state.hasAudio ? 'bg-green-600' : 'bg-red-600'
                    }`}
                    title={state.hasAudio ? 'Mute' : 'Unmute'}
                  >
                    {state.hasAudio ? <Mic className="w-3 h-3 text-white" /> : <MicOff className="w-3 h-3 text-white" />}
                  </button>
                  <button
                    onClick={() => toggleParticipantMedia(0, 'video').catch(error => 
                      console.error('❌ Video toggle error:', error)
                    )}
                    className={`p-1 rounded ${
                      state.hasVideo ? 'bg-green-600' : 'bg-red-600'
                    }`}
                    title={state.hasVideo ? 'Turn off camera' : 'Turn on camera'}
                  >
                    {state.hasVideo ? <Video className="w-3 h-3 text-white" /> : <VideoOff className="w-3 h-3 text-white" />}
                  </button>
                  <button
                    onClick={async () => {
                      if (process.env.NODE_ENV === 'development') {
                        console.log('🧪 Manual video test triggered...');
                      }
                      try {
                        await connectVideoStreams();
                        await ensureCameraStarted();
                        toast({
                          title: "Video Test",
                          description: "Attempted to reconnect video streams",
                        });
                      } catch (error) {
                        console.error('❌ Manual video test failed:', error);
                        toast({
                          title: "Video Test Failed",
                          description: "Unable to connect video streams",
                          variant: "destructive"
                        });
                      }
                    }}
                    className="p-1 rounded bg-blue-600 hover:bg-blue-700"
                    title="Test Video"
                  >
                    <Monitor className="w-3 h-3 text-white" />
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
    }, [participantStates]);

    // Memoize participant grid to prevent unnecessary re-renders
    const participantGrid = React.useMemo(() => 
      Array.from({ length: 8 })
        .map((_, index) => ({ index, state: participantStates[index] }))
        .filter(({ index, state }) => {
          // Always show the current user's box (index 0) to ensure video element exists
          if (index === 0) return true;
          // For other participants, only show if they have a name
          return state?.name;
        })
        .map(({ index }) => renderParticipantBox(index)),
      [participantStates, renderParticipantBox]
    );

    // Main component render
    // If video hasn't started, show initialization screen
    if (!isVideoActive) {
      return (
        <div className={`${className} flex items-center justify-center bg-gray-900 text-white`}>
          <div className="text-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
              <Video className="w-8 h-8 absolute inset-0 m-auto text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Initializing Video Conference</h3>
              <p className="text-gray-300 text-sm">Setting up your camera and microphone...</p>
              
              {/* Show error message if there's a media device error */}
              {mediaDeviceStatus.errorMessage && (
                <div className="mt-3 p-3 bg-red-900/50 rounded-lg">
                  <p className="text-red-200 text-sm">{mediaDeviceStatus.errorMessage}</p>
                </div>
              )}
              
              {/* Always show skip button after 3 seconds */}
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => {
                    console.log('👤 User clicked Skip Video');
                    setIsVideoActive(true);
                    updateParticipantState(0, { 
                      isLoading: false,
                      isConnected: false,
                      name: currentUser.name || 'You',
                      role: currentUser.role || 'user'
                    });
                    toast({
                      title: "Video Skipped",
                      description: "Proceeding with document editing",
                      variant: "default"
                    });
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
                >
                  Skip Video & Continue
                </button>
                
                <button
                  onClick={() => {
                    console.log('🔄 User clicked Retry Video');
                    // Reset the starting ref to allow retry
                    isStartingVideoRef.current = false;
                    startVideo().catch(error => {
                      console.error('❌ Manual retry failed:', error);
                    });
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm transition-colors"
                >
                  Retry Video Connection
                </button>
                
                <p className="text-xs text-gray-400">
                  Having trouble? You can proceed without video or retry the connection.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`${className} relative bg-gray-900 border border-gray-300 rounded-lg overflow-hidden min-h-[400px]`}>
        {/* Session Info Bar - always at the top, not inside scrollable grid */}
        <div className="w-full z-20 sticky top-0 overflow-visible">
          <div className="bg-black/90 px-4 py-3 flex items-center justify-between text-white min-h-[48px]">
            <div className="flex items-center space-x-4 overflow-hidden">
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
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs transition-colors"
                title="Start Recording"
              >
                Record
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-xs transition-colors"
                title="Stop Recording"
              >
                Stop Recording
              </button>
            )}
            
            <button
              onClick={() => setShowDailyInterface(!showDailyInterface)}
              className={`px-2 py-1 rounded-md text-xs transition-colors ${
                showDailyInterface 
                  ? 'bg-blue-700 hover:bg-blue-800 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              title={showDailyInterface ? "Switch to Custom UI" : "Switch to Daily.co UI"}
            >
              {showDailyInterface ? "Custom UI" : "Daily.co UI"}
            </button>
            
            <button
              onClick={() => {
                console.log('🔧 Manual video connection test...');
                if (callObjectRef.current) {
                  const participants = callObjectRef.current.participants();
                  const localVideo = callObjectRef.current.localVideo();
                  const localAudio = callObjectRef.current.localAudio();
                  
                  console.log('🎯 Daily.co State Debug:', {
                    hasCallObject: !!callObjectRef.current,
                    participants: participants,
                    localVideo: localVideo,
                    localAudio: localAudio,
                    participantStates: participantStates,
                    videoRef: !!videoRefs.current[0]
                  });
                  
                  toast({
                    title: "Debug Info",
                    description: `Video: ${localVideo}, Audio: ${localAudio} - Check console for details`,
                  });
                  
                  // Test video stream connection
                  connectVideoStreams().catch(console.error);
                } else {
                  console.error('❌ No Daily.co call object found');
                  toast({
                    variant: "destructive",
                    title: "No Connection",
                    description: "Daily.co call object not found. Try reconnecting.",
                  });
                }
              }}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs transition-colors"
              title="Test Daily.co Connection & Debug State"
            >
              Test Video
            </button>
            
            <button
              onClick={stopVideo}
              className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-xs transition-colors"
              title="Leave meeting"
            >
              Leave
            </button>
          </div>
        </div>
        
        {/* Participant Grid - Only show when not showing Daily interface */}
        {!showDailyInterface && (
          <div className="w-full h-full p-2 pt-1"> {/* Minimal padding */}
            <div className="flex flex-col space-y-1 h-full max-h-full overflow-y-auto"> {/* Using flex with minimal spacing */}
              {participantGrid}
            </div>
          </div>
        )}
        
        {/* Daily.co iframe container - provides full video functionality */}
        <div
          ref={containerRef}
          className={`absolute inset-0 ${showDailyInterface ? 'bg-black' : 'opacity-0 pointer-events-none'}`}
          style={{ minHeight: '400px', zIndex: showDailyInterface ? 20 : 5 }}
        />
        
        {/* Status overlay when not connected */}
        {!isConnected && (
          <div className="absolute inset-0 mt-[48px] bg-gray-800/90 flex items-center justify-center z-30">
            <div className="text-center text-white p-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
              <div className="text-lg font-medium mb-2">Initializing Video Conference</div>
              <div className="text-sm text-gray-300">
                {mediaDeviceStatus.errorMessage ? (
                  <div className="text-red-300">
                    <div className="mb-2">{mediaDeviceStatus.errorMessage}</div>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                    >
                      Refresh Page
                    </button>
                  </div>
                ) : (
                  'Setting up your camera and microphone...'
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  });

export default DailyVideoConference;