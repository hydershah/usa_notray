import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor,
  Phone,
  PhoneOff,
  Settings,
  Users,
  Maximize2,
  Minimize2,
  Circle,
  Square
} from 'lucide-react';

interface Participant {
  userId: string;
  displayName: string;
  email: string;
  userType: 'notary' | 'signer' | 'witness';
}

interface WherebyVideoConferenceProps {
  sessionId: string;
  jobId: number;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: 'notary' | 'signer' | 'witness';
  };
  participants: Participant[];
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onConnectionStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  autoStart?: boolean;
  className?: string;
}

interface WherebyMeeting {
  roomUrl: string;
  hostRoomUrl: string;
  roomName: string;
  meetingId: string;
  endDate: string;
}

const WherebyVideoConference: React.FC<WherebyVideoConferenceProps> = ({
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [wherebyMeeting, setWherebyMeeting] = useState<WherebyMeeting | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoRecordingStarted, setAutoRecordingStarted] = useState(false);
  const [autoStartAttempts, setAutoStartAttempts] = useState(0);
  const [lastStartAttempt, setLastStartAttempt] = useState(0);

  // Immediate auto-start for signing sessions
  useEffect(() => {
    if (autoStart) {
      console.log('🎥 Immediate auto-start triggered for signing session');
      const immediateTimer = setTimeout(() => {
        startVideo();
      }, 100); // Start almost immediately
      
      return () => clearTimeout(immediateTimer);
    }
  }, [autoStart]); // Trigger immediately when component mounts with autoStart

  // Start video session
  const startVideo = useCallback(async () => {
    if (isVideoActive) {
      console.log('⚠️ Video already active, skipping start');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      onConnectionStatusChange?.('connecting');

      console.log(`🎥 Starting Whereby session for job ${jobId}`);
      console.log('📊 Participants:', participants);

      // Create Whereby meeting via API
      const apiUrl = `/api/jobs/${jobId}/video-session`;
      const token = localStorage.getItem('token');
      
      console.log('🔗 API URL:', apiUrl);
      console.log('🔑 Token present:', !!token);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          participants: participants.map(p => ({
            userId: p.userId,
            name: p.displayName,
            email: p.email,
            role: p.userType
          }))
        })
      });

      console.log('📡 API Response status:', response.status);
      console.log('📡 API Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        throw new Error(`Failed to create Whereby meeting: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ API Response data:', data);
      const meeting: WherebyMeeting = {
        roomUrl: data.roomUrl,
        hostRoomUrl: data.hostRoomUrl || data.roomUrl,
        roomName: data.roomName || `session-${sessionId}`,
        meetingId: data.meetingId || data.sessionId,
        endDate: data.endDate
      };

      setWherebyMeeting(meeting);

      // Configure Whereby embed URL
      const isHost = currentUser.role === 'notary';
      const roomUrl = isHost ? meeting.hostRoomUrl : meeting.roomUrl;
      
      const params = new URLSearchParams({
        embed: 'true',
        displayName: currentUser.name,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random`,
        background: 'off',
        chat: 'on',
        people: 'on',
        pipButton: 'off',
        leaveButton: 'on',
        screenshare: isHost ? 'on' : 'off',
        quality: 'high',
        layout: 'spotlight',
        maxGridParticipants: '8',
        autoJoin: 'true',
        precallReview: 'off',
        minimal: 'false',
        floatSelf: 'false',
        videoEnabled: 'true',
        audioEnabled: 'true',
        ...(isHost && {
          hostRoomUrl: meeting.hostRoomUrl,
          lock: 'off',
          recording: 'on'
        })
      });

      const embedUrl = `${roomUrl}?${params.toString()}`;

      // Load in iframe
      if (iframeRef.current) {
        iframeRef.current.src = embedUrl;
        setIsVideoActive(true);
        console.log(`✅ Whereby session started for ${currentUser.role}: ${currentUser.name}`);
        
        toast({
          title: "Video Conference Started",
          description: "Whereby video conference is now active",
        });
      }

    } catch (error) {
      console.error('Failed to start Whereby session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start video';
      setError(errorMessage);
      onConnectionStatusChange?.('error');
      
      toast({
        title: "Video Conference Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [isVideoActive, jobId, sessionId, currentUser, participants, onConnectionStatusChange, toast]);

  // Stop video session
  const stopVideo = useCallback(async () => {
    if (!isVideoActive) return;

    try {
      if (iframeRef.current) {
        iframeRef.current.src = 'about:blank';
      }

      // End Whereby session via API
      if (wherebyMeeting) {
        try {
          await fetch(`/api/jobs/${jobId}/video-session`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              sessionId: wherebyMeeting.meetingId,
              meetingId: wherebyMeeting.meetingId
            })
          });
        } catch (apiError) {
          console.warn('Failed to end session via API:', apiError);
        }
      }
      
      setIsVideoActive(false);
      setWherebyMeeting(null);
      setIsConnected(false);
      setParticipantCount(0);
      setIsRecording(false);
      onConnectionStatusChange?.('disconnected');
      
      console.log('🛑 Whereby session stopped');
      
      toast({
        title: "Video Conference Ended",
        description: "Video conference has been terminated",
      });
      
    } catch (error) {
      console.error('Failed to stop Whereby session:', error);
    }
  }, [isVideoActive, wherebyMeeting, jobId, onConnectionStatusChange, toast]);

  // Handle iframe messages from Whereby
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin is from Whereby
      if (!event.origin.includes('whereby.com')) return;

      try {
        const data = event.data;
        
        switch (data.type) {
          case 'whereby_participant_joined':
            setParticipantCount(prev => prev + 1);
            console.log(`👋 Participant joined: ${data.displayName}`);
            
            if (onParticipantJoined && data.participant) {
              onParticipantJoined(data.participant);
            }
            
            toast({
              title: "Participant Joined",
              description: `${data.displayName} joined the video conference`,
            });
            break;
            
          case 'whereby_participant_left':
            setParticipantCount(prev => Math.max(0, prev - 1));
            console.log(`👋 Participant left: ${data.displayName}`);
            
            if (onParticipantLeft && data.participantId) {
              onParticipantLeft(data.participantId);
            }
            
            const participant = participants.find(p => p.userId === data.participantId);
            if (participant) {
              toast({
                title: "Participant Left",
                description: `${participant.displayName} left the video conference`,
              });
            }
            break;
            
          case 'whereby_ready':
            console.log('✅ Whereby ready');
            setIsConnected(true);
            setIsLoading(false);
            onConnectionStatusChange?.('connected');
            
            // Auto-start recording for signing sessions
            if (!autoRecordingStarted && !isRecording) {
              setTimeout(async () => {
                try {
                  const response = await fetch(`/api/jobs/${jobId}/video-session/recording/start`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                      roomName: wherebyMeeting?.roomName,
                      meetingId: wherebyMeeting?.meetingId
                    })
                  });

                  if (response.ok) {
                    setIsRecording(true);
                    setAutoRecordingStarted(true);
                    console.log('🎬 Auto-recording started for signing session');
                    toast({
                      title: "Recording Started",
                      description: "Video session is now being recorded automatically for compliance",
                      duration: 3000,
                    });
                  }
                } catch (error) {
                  console.error('Failed to auto-start recording:', error);
                  // Continue without recording - don't block the session
                }
              }, 1000); // Wait 1 second for session to stabilize
            }
            break;
            
          case 'whereby_error':
            console.error('Whereby error:', data.error);
            setError(data.error);
            onConnectionStatusChange?.('error');
            break;
            
          case 'whereby_meeting_ended':
            console.log('🏁 Whereby meeting ended');
            stopVideo();
            break;

          case 'whereby_microphone_toggle':
            setIsMuted(data.muted);
            break;

          case 'whereby_camera_toggle':
            setIsVideoEnabled(data.enabled);
            break;

          case 'whereby_screenshare_toggle':
            setIsScreenSharing(data.enabled);
            break;
        }
      } catch (error) {
        console.error('Failed to handle Whereby message:', error);
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [participants, onParticipantJoined, onParticipantLeft, onConnectionStatusChange, stopVideo, toast, currentUser.role, autoRecordingStarted, isRecording, jobId, wherebyMeeting]);

  // Enhanced auto-start with rate limiting
  useEffect(() => {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastStartAttempt;
    
    console.log('🎥 Auto-start check:', { 
      autoStart, 
      isVideoActive, 
      isLoading, 
      attempts: autoStartAttempts,
      timeSinceLastAttempt 
    });
    
    if (autoStart && !isVideoActive && !isLoading && autoStartAttempts < 3 && timeSinceLastAttempt > 2000) {
      console.log('🚀 Auto-starting Whereby video conference...');
      setAutoStartAttempts(prev => prev + 1);
      setLastStartAttempt(now);
      
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        startVideo();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [autoStart, isVideoActive, isLoading, startVideo, autoStartAttempts, lastStartAttempt]);

  // Reset attempts when video becomes active
  useEffect(() => {
    if (isVideoActive) {
      setAutoStartAttempts(0);
      setLastStartAttempt(0);
    }
  }, [isVideoActive]);

  // Additional mount-time auto-start for signing sessions
  useEffect(() => {
    if (autoStart && !isVideoActive) {
      console.log('🎬 Component mounted with autoStart=true, initiating video...');
      const timer = setTimeout(() => {
        if (!isVideoActive && !isLoading) {
          console.log('🎯 Force starting video after mount');
          startVideo();
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []); // Empty dependency array for mount-only execution

  // Failsafe auto-start - if video isn't active after 3 seconds, force start
  useEffect(() => {
    if (autoStart) {
      const failsafeTimer = setTimeout(() => {
        if (!isVideoActive && !isLoading) {
          console.log('⚡ Failsafe: Force starting video after 3 seconds');
          startVideo();
        }
      }, 3000);
      
      return () => clearTimeout(failsafeTimer);
    }
  }, [autoStart]); // Only depend on autoStart

  // Update participant count when external participants change
  useEffect(() => {
    setParticipantCount(participants.length || 0);
  }, [participants]);

  // Controls auto-hide timer
  useEffect(() => {
    if (!isVideoActive) return;

    const timer = setTimeout(() => {
      setShowControls(false);
    }, 5000); // Hide controls after 5 seconds

    const showControlsHandler = () => {
      setShowControls(true);
      clearTimeout(timer);
    };

    window.addEventListener('mousemove', showControlsHandler);
    window.addEventListener('keydown', showControlsHandler);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', showControlsHandler);
      window.removeEventListener('keydown', showControlsHandler);
    };
  }, [isVideoActive]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!wherebyMeeting) return;

    try {
      const response = await fetch(`/api/jobs/${jobId}/video-session/recording/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          roomName: wherebyMeeting.roomName,
          meetingId: wherebyMeeting.meetingId
        })
      });

      if (response.ok) {
        setIsRecording(true);
        toast({
          title: "Recording Started",
          description: "Video session is now being recorded",
        });
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [wherebyMeeting, jobId, toast]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!wherebyMeeting) return;

    try {
      const response = await fetch(`/api/jobs/${jobId}/video-session/recording/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          recordingId: wherebyMeeting.meetingId
        })
      });

      if (response.ok) {
        setIsRecording(false);
        toast({
          title: "Recording Stopped",
          description: "Video recording has been saved",
        });
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }, [wherebyMeeting, jobId, toast]);

  // Get grid layout for participants (optimized for 8-box layout)
  const getGridLayout = (totalParticipants: number) => {
    if (totalParticipants <= 1) return 'grid-cols-1';
    if (totalParticipants <= 4) return 'grid-cols-2';
    if (totalParticipants <= 6) return 'grid-cols-3';
    if (totalParticipants <= 8) return 'grid-cols-4';
    return 'grid-cols-4'; // Max 8 participants in 4x2 grid
  };

  // Render video controls
  const renderVideoControls = () => (
    <div className={`absolute bottom-4 left-4 right-4 z-30 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
      <div className="bg-black/90 backdrop-blur-md rounded-xl p-4 flex items-center justify-between shadow-2xl border border-white/10">
        <div className="flex items-center gap-4">
          {/* Enhanced participant info */}
          <div className="flex items-center gap-2 text-white text-sm bg-white/10 rounded-lg px-3 py-1.5">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="font-medium">{participantCount}/8</span>
          </div>
          
          {/* Enhanced connection status */}
          <div className="flex items-center gap-2 text-white text-sm bg-white/10 rounded-lg px-3 py-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'} shadow-lg`} />
            <span className="font-medium">{isConnected ? 'Live' : 'Connecting...'}</span>
          </div>
          
          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/20 rounded-lg px-3 py-1.5">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="font-medium">Recording</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Recording controls for notary */}
          {currentUser.role === 'notary' && !isRecording && (
            <button
              onClick={startRecording}
              className="p-3 bg-red-600/80 hover:bg-red-600 rounded-xl transition-all duration-200 hover:scale-105 backdrop-blur-sm"
              title="Start Recording"
            >
              <Circle className="w-5 h-5 text-white" />
            </button>
          )}

          {/* Minimize button */}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-200 hover:scale-105 backdrop-blur-sm"
            title="Minimize video"
          >
            <Minimize2 className="w-5 h-5 text-white" />
          </button>

          {/* Leave button */}
          <button
            onClick={stopVideo}
            className="p-3 bg-red-600/80 hover:bg-red-600 rounded-xl transition-all duration-200 hover:scale-105 backdrop-blur-sm"
            title="Leave video session"
          >
            <PhoneOff className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );

  // Render loading state
  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-900 text-white`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg font-medium">Connecting to Whereby...</p>
          <p className="text-sm opacity-75 mt-2">Setting up secure video connection</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-red-50 text-red-800`}>
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold mb-2">Video Connection Error</h3>
          <p className="text-sm mb-4">{error}</p>
          <div className="space-x-3">
            <button
              onClick={startVideo}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry Connection
            </button>
            <button
              onClick={() => setError(null)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Continue Without Video
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render video-disabled state
  if (!isVideoActive) {
    return (
      <div className={`${className} flex flex-col h-full bg-gradient-to-br from-blue-50 to-gray-50 border-2 border-dashed border-blue-300 rounded-lg overflow-hidden`}>
        {/* Enhanced header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-blue-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Video className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Whereby Video Conference</h3>
              <p className="text-sm text-gray-600">Live signing session video</p>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          {isLoading ? (
            <div className="space-y-4">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <div>
                <p className="text-lg font-medium text-gray-900">Connecting to Whereby...</p>
                <p className="text-sm text-gray-600 mt-1">Setting up secure video connection</p>
              </div>
            </div>
          ) : error ? (
            <div className="space-y-4 max-w-md">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Video className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-lg font-medium text-red-800">Connection Failed</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
              <button
                onClick={startVideo}
                disabled={isLoading}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
              >
                <Video className="h-5 w-5" />
                Retry Connection
              </button>
            </div>
          ) : (
            <div className="space-y-6 max-w-md">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Video className="h-8 w-8 text-blue-600" />
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Start Video Conference
                </h3>
                <p className="text-gray-600">
                  Click to join the live signing session with video
                </p>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 text-sm">
                <div className="flex items-center gap-2 text-blue-800 font-medium mb-2">
                  <Users className="h-4 w-4" />
                  Session Participants ({participants.length + 1}/8)
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-blue-700">{currentUser.name} (You - {currentUser.role})</span>
                  </div>
                  {participants.map(participant => (
                    <div key={participant.userId} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        participant.userType === 'notary' ? 'bg-purple-500' :
                        participant.userType === 'signer' ? 'bg-blue-500' :
                        'bg-green-500'
                      }`}></div>
                      <span className="text-blue-700">{participant.displayName} ({participant.userType})</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={startVideo}
                disabled={isLoading}
                className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <Video className="h-5 w-5" />
                {isLoading ? 'Starting Video...' : 'Start Video Conference'}
              </button>
              
              <p className="text-xs text-gray-500 mt-2">
                Video will start automatically in a few seconds, or click above to start manually
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render active video session with enhanced UI
  return (
    <div className={`${className} relative bg-gradient-to-br from-gray-900 to-black ${isMinimized ? 'h-16' : ''} overflow-hidden`}>
      {!isMinimized ? (
        <>
          {/* Video iframe with rounded corners and shadow */}
          <div className="absolute inset-2 rounded-lg overflow-hidden shadow-2xl bg-gray-800">
            <iframe
              ref={iframeRef}
              className="w-full h-full border-0 rounded-lg"
              allow="camera; microphone; fullscreen; speaker; display-capture"
              title="Whereby Video Session - Live Signing"
            />
          </div>
          
          {/* Status overlay with better design */}
          <div className="absolute top-4 left-4 right-4 z-20">
            <div className="bg-black/80 backdrop-blur-sm rounded-xl p-3 flex items-center justify-between shadow-lg border border-white/10">
              <div className="flex items-center gap-3">
                {/* Connection indicator */}
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'} shadow-lg`} />
                  <span className="text-white text-sm font-medium">
                    {isConnected ? 'Live' : 'Connecting...'}
                  </span>
                </div>
                
                {/* Participant count */}
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Users className="w-4 h-4" />
                  <span>{participantCount}/{8}</span>
                </div>
                
                {/* Recording indicator */}
                {isRecording && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span>REC</span>
                  </div>
                )}
              </div>
              
              {/* Session info */}
              <div className="text-white/60 text-xs">
                Signing Session
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Live Conference ({participantCount}/8)</span>
          </div>
          <button
            onClick={() => setIsMinimized(false)}
            className="p-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-all duration-200 hover:scale-105"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {!isMinimized && renderVideoControls()}
    </div>
  );
};

export default WherebyVideoConference; 