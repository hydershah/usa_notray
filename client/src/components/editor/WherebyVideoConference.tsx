import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Video, 
  VideoOff, 
  PhoneOff,
  Users,
  Clock, 
  Circle, 
  Minimize2, 
  Maximize2,
  Settings,
  AlertCircle
} from 'lucide-react';

interface WherebyMeeting {
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

interface WherebyVideoConferenceProps {
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
  const [isMinimized, setIsMinimized] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Start video session
  const startVideo = useCallback(async () => {
    if (isLoading || isVideoActive) return;

      setIsLoading(true);
      setError(null);
    setDebugInfo(null);

    try {
      console.log('🎥 Starting Whereby video session...');

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
      
      setDebugInfo({ apiResponse: data });
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create video session');
      }

      const meeting: WherebyMeeting = {
        meetingId: data.meetingId || data.sessionToken,
        roomUrl: data.roomUrl,
        hostRoomUrl: data.hostRoomUrl || data.roomUrl,
        roomName: data.roomName,
        startDate: data.startDate || new Date().toISOString(),
        endDate: data.endDate,
        isLocked: false
      };

      setWherebyMeeting(meeting);

      // Wait for iframe to be ready
      console.log('📺 Waiting for iframe element...');
      
      let iframe = iframeRef.current;
      let retryCount = 0;
      const maxRetries = 10;
      
      while (!iframe && retryCount < maxRetries) {
        console.log(`⏳ Iframe not ready, waiting... (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 100));
        iframe = iframeRef.current;
        retryCount++;
      }

      if (!iframe) {
        throw new Error('Video iframe element not found after waiting');
      }

      console.log('📺 Setting iframe src...');
      
      // Use host URL for notary, regular URL for others
      const roomUrl = currentUser.role === 'notary' ? meeting.hostRoomUrl : meeting.roomUrl;
      iframe.src = roomUrl;

        setIsVideoActive(true);
      setIsConnected(true);
      setParticipantCount(participants.length);

      if (onConnectionStatusChange) {
        onConnectionStatusChange(true);
      }

      console.log('✅ Video session started successfully');
        
        toast({
          title: "Video Conference Started",
        description: "Successfully connected to Whereby session",
        });

    } catch (error) {
      console.error('❌ Failed to start Whereby session:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      setDebugInfo((prev: any) => ({ ...prev, error: error instanceof Error ? error.message : 'Unknown error' }));
      
      toast({
        title: "Video Connection Failed",
        description: "Unable to start video conference",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, jobId, participants, currentUser, isLoading, isVideoActive, onConnectionStatusChange, toast]);

  // Stop video session
  const stopVideo = useCallback(async () => {
    try {
      if (wherebyMeeting && iframeRef.current) {
        iframeRef.current.src = '';
      }
      
      setIsVideoActive(false);
      setIsConnected(false);
      setWherebyMeeting(null);
      setIsRecording(false);
      setParticipantCount(0);
      
      if (onConnectionStatusChange) {
        onConnectionStatusChange(false);
      }
      
      toast({
        title: "Video Conference Ended",
        description: "Successfully disconnected from video session",
      });
    } catch (error) {
      console.error('Error stopping video:', error);
    }
  }, [wherebyMeeting, onConnectionStatusChange, toast]);

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

  // Auto-start functionality removed to prevent repeated triggers
  // Users will need to manually start the video conference

  // Render video controls
  const renderVideoControls = () => (
    <div className={`absolute bottom-4 left-4 right-4 z-30 transition-all duration-300 pointer-events-auto ${showControls ? 'opacity-100' : 'opacity-0'}`}>
      <div className="bg-black/90 backdrop-blur-md rounded-xl p-4 flex items-center justify-between shadow-2xl border border-white/10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-white text-sm bg-white/10 rounded-lg px-3 py-1.5">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="font-medium">{participantCount}/8</span>
          </div>
          
          <div className="flex items-center gap-2 text-white text-sm bg-white/10 rounded-lg px-3 py-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'} shadow-lg`} />
            <span className="font-medium">{isConnected ? 'Live' : 'Connecting...'}</span>
          </div>
          
          {isRecording && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/20 rounded-lg px-3 py-1.5">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="font-medium">Recording</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentUser.role === 'notary' && !isRecording && (
            <button
              onClick={startRecording}
              className="p-3 bg-red-600/80 hover:bg-red-600 rounded-xl transition-all duration-200 hover:scale-105 backdrop-blur-sm"
              title="Start Recording"
            >
              <Circle className="w-5 h-5 text-white" />
            </button>
          )}

          <button
            onClick={() => setIsMinimized(true)}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-200 hover:scale-105 backdrop-blur-sm"
            title="Minimize video"
          >
            <Minimize2 className="w-5 h-5 text-white" />
          </button>

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

  // Main component render
    return (
    <div className={`${className} relative bg-gray-50 border border-gray-200 rounded-lg overflow-hidden min-h-[300px]`}>
      {/* Always render iframe - hidden when not in use */}
      <iframe
        ref={iframeRef}
        className={`w-full h-full border-0 ${isVideoActive && !error ? 'block' : 'hidden'}`}
        allow="camera; microphone; fullscreen; speaker; display-capture"
        title="Whereby Video Session - Live Signing"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-presentation allow-modals"
      />
      
      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 p-4 z-10">
          <div className="text-center max-w-lg">
            <div className="text-red-500 text-4xl mb-4 font-bold">!</div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">Video Connection Error</h3>
            <p className="text-sm mb-4 text-red-700">{error}</p>
            
            {debugInfo && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                  🔍 Debug Information (Click to expand)
                </summary>
                <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-800 overflow-auto max-h-40">
                  <div className="mb-2">
                    <strong>Session Details:</strong><br/>
                    Session ID: {sessionId}<br/>
                    Job ID: {jobId}<br/>
                    User: {currentUser.name} ({currentUser.role})<br/>
                    Participants: {participants.length}<br/>
                    Auto Start: {autoStart ? 'Yes' : 'No'}
                  </div>
                  <div className="mb-2">
                    <strong>Environment:</strong><br/>
                    NODE_ENV: {process.env.NODE_ENV || 'undefined'}<br/>
                    Origin: {window.location.origin}<br/>
                    Protocol: {window.location.protocol}
                  </div>
                  {debugInfo.apiResponse && (
                    <div>
                      <strong>API Response:</strong><br/>
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(debugInfo.apiResponse, null, 2)}
                      </pre>
        </div>
                  )}
      </div>
              </details>
            )}
            
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
                onClick={async () => {
                  setError(null);
                  setDebugInfo(null);
                  await startVideo();
                }}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
                {isLoading ? 'Connecting...' : 'Retry Connection'}
            </button>
            <button
                onClick={() => {
                  setError(null);
                  setDebugInfo(null);
                }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Continue Without Video
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Loading state */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-50 z-10">
          <div className="text-center">
            <div className="relative mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <Video className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-blue-600" />
            </div>
            <p className="text-lg font-medium text-blue-900 mb-2">Starting Video Conference</p>
            <p className="text-sm text-blue-700">Setting up Whereby session...</p>
          </div>
              </div>
      )}
      
      {/* Video disabled state */}
      {!isVideoActive && !error && !isLoading && (
        <div className="absolute inset-0 flex flex-col bg-gradient-to-br from-blue-50 to-gray-100 z-10">
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-10 h-10 text-blue-600" />
              </div>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                Video Conference Ready
              </h3>
              <p className="text-gray-600 mb-6">
                Start video communication for the signing session
              </p>
              
              <button
                onClick={startVideo}
                disabled={isLoading}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium mb-4"
              >
                <div className="flex items-center justify-center gap-2">
                  <Video className="w-5 h-5" />
                  <span>Start Video Conference</span>
                </div>
              </button>
              
              {/* Participants list */}
              {participants.length > 0 && (
                <div className="text-sm text-gray-500">
                  <p className="mb-2 font-medium">👥 Participants ({participants.length}):</p>
                <div className="space-y-1">
                    {participants.map((participant, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border text-gray-700">
                        <span className="font-medium">{participant.displayName}</span>
                        <Badge variant="outline" className="text-xs">
                          {participant.role}
                        </Badge>
                    </div>
                  ))}
                </div>
              </div>
              )}
            </div>
          </div>
                </div>
      )}

      {/* Video controls for active session */}
      {isVideoActive && !error && !isMinimized && (
        <div 
          className="absolute inset-0 pointer-events-none"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
        >
          {/* Video controls */}
          {renderVideoControls()}
                  </div>
                )}
      
      {/* Minimized video session bar */}
      {isVideoActive && !error && isMinimized && (
        <div className="absolute inset-0 z-20">
          <div className="h-16 flex items-center justify-between p-3 bg-gray-900 border border-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <Video className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Video Conference Active</p>
                <p className="text-xs text-gray-400">{participantCount} participants</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(false)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                title="Maximize video"
              >
                <Maximize2 className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={stopVideo}
                className="p-2 bg-red-600/80 hover:bg-red-600 rounded-lg transition-colors"
                title="Leave video session"
              >
                <PhoneOff className="w-4 h-4 text-white" />
          </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WherebyVideoConference; 