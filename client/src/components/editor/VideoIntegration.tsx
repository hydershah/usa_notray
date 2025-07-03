import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '../../hooks/editor/useEditorStore';

interface VideoIntegrationProps {
  sessionId: string;
  mode: 'tagging' | 'live_signing';
  autoStart?: boolean;
  className?: string;
}

interface WherebyConfig {
  roomUrl: string;
  displayName: string;
  isHost: boolean;
  avatar?: string;
  userType: 'notary' | 'signer' | 'witness';
}

interface VideoQuality {
  resolution: 'low' | 'medium' | 'high';
  bandwidth: 'low' | 'normal' | 'high';
  framerate: number;
}

export const VideoIntegration: React.FC<VideoIntegrationProps> = ({
  sessionId,
  mode,
  autoStart = false,
  className = ''
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [videoQuality, setVideoQuality] = useState<VideoQuality>({
    resolution: 'medium',
    bandwidth: 'normal',
    framerate: 30
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const {
    session,
    participants,
    currentUser,
    mode: editorMode
  } = useEditorStore();

  // Generate Whereby room URL
  const generateRoomUrl = useCallback((sessionId: string): string => {
    // In production, this would be generated via Whereby API
    const roomName = `notary-session-${sessionId}`;
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://your-domain.whereby.com'
      : 'https://your-subdomain.whereby.com';
    
    return `${baseUrl}/${roomName}`;
  }, []);

  // Get Whereby configuration
  const getWherebyConfig = useCallback((): WherebyConfig | null => {
    if (!currentUser || !sessionId) return null;

    return {
      roomUrl: generateRoomUrl(sessionId),
      displayName: currentUser.displayName || `User ${currentUser.userId}`,
      isHost: currentUser.userType === 'notary',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || '')}&background=random`,
      userType: currentUser.userType
    };
  }, [currentUser, sessionId, generateRoomUrl]);

  // Start video session
  const startVideo = useCallback(async () => {
    if (isVideoActive || !currentUser) return;

    try {
      setIsLoading(true);
      setVideoError(null);

      const config = getWherebyConfig();
      if (!config) {
        throw new Error('Unable to configure video session');
      }

      // Build Whereby embed URL with parameters
      const params = new URLSearchParams({
        embed: 'true',
        displayName: config.displayName,
        avatar: config.avatar || '',
        background: 'off',
        chat: 'on',
        people: 'on',
        pipButton: 'off',
        leaveButton: 'on',
        screenshare: config.isHost ? 'on' : 'off',
        // Quality settings
        quality: videoQuality.resolution,
        // Host privileges
        ...(config.isHost && {
          hostRoomUrl: config.roomUrl,
          lock: 'off',
          precallReview: 'on'
        })
      });

      const embedUrl = `${config.roomUrl}?${params.toString()}`;

      // Load video in iframe
      if (iframeRef.current) {
        iframeRef.current.src = embedUrl;
        setIsVideoActive(true);
        
        console.log(`✅ Video session started for ${config.userType}: ${config.displayName}`);
      }

    } catch (error) {
      console.error('Failed to start video session:', error);
      setVideoError(error instanceof Error ? error.message : 'Failed to start video');
    } finally {
      setIsLoading(false);
    }
  }, [isVideoActive, currentUser, getWherebyConfig, videoQuality.resolution]);

  // Stop video session
  const stopVideo = useCallback(() => {
    if (!isVideoActive) return;

    try {
      if (iframeRef.current) {
        iframeRef.current.src = 'about:blank';
      }
      
      setIsVideoActive(false);
      setParticipantCount(0);
      
      console.log('🛑 Video session stopped');
      
    } catch (error) {
      console.error('Failed to stop video session:', error);
    }
  }, [isVideoActive]);

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
            console.log(`👋 Participant joined video: ${data.displayName}`);
            break;
            
          case 'whereby_participant_left':
            setParticipantCount(prev => Math.max(0, prev - 1));
            console.log(`👋 Participant left video: ${data.displayName}`);
            break;
            
          case 'whereby_ready':
            console.log('✅ Whereby video ready');
            setIsLoading(false);
            break;
            
          case 'whereby_error':
            console.error('Whereby error:', data.error);
            setVideoError(data.error);
            break;
            
          case 'whereby_meeting_ended':
            console.log('🏁 Video meeting ended');
            stopVideo();
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
  }, [stopVideo]);

  // Auto-start video for live signing sessions
  useEffect(() => {
    if (autoStart && mode === 'live_signing' && !isVideoActive && currentUser) {
      startVideo();
    }
  }, [autoStart, mode, isVideoActive, currentUser, startVideo]);

  // Auto-stop video when session ends
  useEffect(() => {
    if (session?.status === 'completed' && isVideoActive) {
      stopVideo();
    }
  }, [session?.status, isVideoActive, stopVideo]);

  // Video controls
  const toggleMute = useCallback(() => {
    // Send message to Whereby iframe to toggle mute
    if (iframeRef.current && isVideoActive) {
      iframeRef.current.contentWindow?.postMessage({
        type: 'toggle_microphone',
        muted: !isMuted
      }, '*');
      setIsMuted(!isMuted);
    }
  }, [isMuted, isVideoActive]);

  const toggleVideo = useCallback(() => {
    // Send message to Whereby iframe to toggle video
    if (iframeRef.current && isVideoActive) {
      iframeRef.current.contentWindow?.postMessage({
        type: 'toggle_camera',
        enabled: !isVideoEnabled
      }, '*');
      setIsVideoEnabled(!isVideoEnabled);
    }
  }, [isVideoEnabled, isVideoActive]);

  // Quality settings
  const changeVideoQuality = useCallback((quality: VideoQuality) => {
    setVideoQuality(quality);
    
    // Restart video with new quality if active
    if (isVideoActive) {
      stopVideo();
      setTimeout(() => startVideo(), 1000);
    }
  }, [isVideoActive, stopVideo, startVideo]);

  // Render video controls
  const renderVideoControls = () => (
    <div className="absolute bottom-4 left-4 right-4 z-10">
      <div className="bg-black bg-opacity-75 rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Participant count */}
          <div className="flex items-center gap-2 text-white text-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
            </svg>
            <span>{participantCount} participants</span>
          </div>
          
          {/* Session info */}
          <div className="text-white text-sm opacity-75">
            {mode === 'signing' ? 'Live Signing Session' : 'Tagging Session'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mute button */}
          <button
            onClick={toggleMute}
            className={`p-2 rounded-lg transition-colors ${
              isMuted 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              {isMuted ? (
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793l-4.146-3.122a.5.5 0 00-.294-.085H2a1 1 0 01-1-1V7a1 1 0 011-1h1.943a.5.5 0 00.294-.085l4.146-3.122zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd"/>
              ) : (
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793l-4.146-3.122a.5.5 0 00-.294-.085H2a1 1 0 01-1-1V7a1 1 0 011-1h1.943a.5.5 0 00.294-.085l4.146-3.122zM12 5a1 1 0 011.414 0L15 6.586l1.293-1.293a1 1 0 111.414 1.414L16.414 8l1.293 1.293a1 1 0 01-1.414 1.414L15 9.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 8l-1.293-1.293A1 1 0 0112 5z"/>
              )}
            </svg>
          </button>

          {/* Video toggle button */}
          <button
            onClick={toggleVideo}
            className={`p-2 rounded-lg transition-colors ${
              !isVideoEnabled 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
            title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              {isVideoEnabled ? (
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
              ) : (
                <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A2 2 0 0018 13.5V7a1 1 0 00-1.447-.894L14 7.382V6a2 2 0 00-2-2H8.414l-5.707 5.707z" clipRule="evenodd"/>
              )}
            </svg>
          </button>

          {/* Leave button */}
          <button
            onClick={stopVideo}
            className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            title="Leave video session"
          >
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 6.707 6.293a1 1 0 00-1.414 1.414L8.586 11l-3.293 3.293a1 1 0 001.414 1.414L10 12.414l3.293 3.293a1 1 0 001.414-1.414L11.414 11l3.293-3.293z" clipRule="evenodd"/>
            </svg>
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
          <p className="text-lg font-medium">Connecting to video session...</p>
          <p className="text-sm opacity-75 mt-2">Setting up secure video connection</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (videoError) {
    return (
      <div className={`${className} flex items-center justify-center bg-red-50 text-red-800`}>
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold mb-2">Video Connection Error</h3>
          <p className="text-sm mb-4">{videoError}</p>
          <div className="space-x-3">
            <button
              onClick={startVideo}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry Connection
            </button>
            <button
              onClick={() => setVideoError(null)}
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
      <div className={`${className} flex items-center justify-center bg-gray-100`}>
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">📹</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Video Session</h3>
          <p className="text-gray-600 mb-4">
            {mode === 'signing' 
              ? 'Start video to begin live signing session'
              : 'Video available for live signing sessions'
            }
          </p>
          
          {mode === 'signing' && (
            <button
              onClick={startVideo}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Start Video Session
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render active video session
  return (
    <div className={`${className} relative bg-black`}>
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        allow="camera; microphone; fullscreen; speaker; display-capture"
        title="Video Session"
      />
      
      {renderVideoControls()}
    </div>
  );
};

export default VideoIntegration; 