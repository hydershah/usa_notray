import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff,
  Phone,
  PhoneOff,
  Users,
  Settings,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { OpenViduVideoConference } from '../video/OpenViduVideoConference';

interface VideoIntegrationProps {
  sessionId: string;
  isAudioActive?: boolean;
  isVideoActive?: boolean;
  participants?: Array<{
    userId: string;
    displayName: string;
    email: string;
    userType: 'notary' | 'signer' | 'witness' | 'admin';
  }>;
  currentUserId?: string;
  isRecording?: boolean;
  mode?: 'tagging' | 'signing' | 'notary';
  autoStart?: boolean;
  className?: string;
}

interface VideoQuality {
  resolution: 'low' | 'medium' | 'high';
  bandwidth: 'low' | 'normal' | 'high';
  framerate: 15 | 30 | 60;
}

export const VideoIntegration: React.FC<VideoIntegrationProps> = ({
  sessionId,
  isAudioActive: externalAudioActive,
  isVideoActive: externalVideoActive,
  participants: externalParticipants = [],
  currentUserId,
  isRecording = false,
  mode = 'signing',
  autoStart = false,
  className = ''
}) => {
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(externalParticipants.length || 0);
  const [videoQuality, setVideoQuality] = useState<VideoQuality>({
    resolution: 'medium',
    bandwidth: 'normal',
    framerate: 30
  });
  const [isMuted, setIsMuted] = useState(externalAudioActive === false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(externalVideoActive !== false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    session,
    participants,
    currentUser,
    mode: editorMode
  } = useEditorStore();

  // Extract job ID from session ID for Whereby integration
  const jobId = useMemo(() => {
    if (session?.jobId) return session.jobId;
    
    // Try to extract from sessionId if it contains job info
    const match = sessionId.match(/(\d+)/);
    return match ? parseInt(match[1]) : parseInt(sessionId) || 1;
  }, [session?.jobId, sessionId]);

  // Get current user from editor store or construct from props
  const effectiveCurrentUser = useMemo(() => {
    if (currentUser) {
      return {
        id: currentUser.userId,
        name: currentUser.displayName || 'Unknown User',
        email: currentUser.email || '',
        role: currentUser.userType as 'notary' | 'signer' | 'witness'
      };
    }
    
    if (currentUserId && participants) {
      const user = participants.find(p => p.userId === currentUserId);
      if (user) {
        return {
          id: user.userId,
          name: user.displayName,
          email: user.email || '',
          role: user.userType as 'notary' | 'signer' | 'witness'
        };
      }
    }
    
    // Fallback
    return {
      id: currentUserId || '1',
      name: 'Current User',
      email: '',
      role: 'signer' as const
    };
  }, [currentUser, currentUserId, participants]);

  // Get effective participants list
  const effectiveParticipants = useMemo(() => {
    if (participants && participants.length > 0) {
      return participants;
    }
    return externalParticipants;
  }, [participants, externalParticipants]);

  // Start video session
  const startVideo = useCallback(async () => {
    if (isVideoActive || !effectiveCurrentUser) return;

    try {
      setIsLoading(true);
      setVideoError(null);
      setIsVideoActive(true);
      
      console.log(`✅ Video session ready for ${effectiveCurrentUser.role}: ${effectiveCurrentUser.name}`);
      
    } catch (error) {
      console.error('Failed to start video session:', error);
      setVideoError(error instanceof Error ? error.message : 'Failed to start video');
      setIsVideoActive(false);
    } finally {
      setIsLoading(false);
    }
  }, [isVideoActive, effectiveCurrentUser]);

  // Stop video session
  const stopVideo = useCallback(() => {
    if (!isVideoActive) return;

    try {
      setIsVideoActive(false);
      setParticipantCount(0);
      console.log('🛑 Video session stopped');
    } catch (error) {
      console.error('Failed to stop video session:', error);
    }
  }, [isVideoActive]);

  // Update participant count when external participants change
  useEffect(() => {
    setParticipantCount(effectiveParticipants.length || 0);
  }, [effectiveParticipants]);

  // Auto-start video for live signing sessions
  useEffect(() => {
    if (autoStart && (mode === 'notary' || mode === 'signing') && !isVideoActive && effectiveCurrentUser) {
      startVideo();
    }
  }, [autoStart, mode, isVideoActive, effectiveCurrentUser, startVideo]);

  // Handle connection status changes
  const handleConnectionStatusChange = useCallback((status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
    switch (status) {
      case 'connecting':
        setIsLoading(true);
        setVideoError(null);
        break;
      case 'connected':
        setIsLoading(false);
        setVideoError(null);
        break;
      case 'disconnected':
        setIsVideoActive(false);
        setIsLoading(false);
        break;
      case 'error':
        setIsLoading(false);
        break;
    }
  }, []);

  // Handle participant events
  const handleParticipantJoined = useCallback((participant: any) => {
    console.log('👋 Participant joined:', participant);
    setParticipantCount(prev => prev + 1);
  }, []);

  const handleParticipantLeft = useCallback((participantId: string) => {
    console.log('👋 Participant left:', participantId);
    setParticipantCount(prev => Math.max(0, prev - 1));
  }, []);

  // Render error state
  if (videoError && !isVideoActive) {
    return (
      <div className={`${className} p-4 bg-red-50 border border-red-200 rounded-lg`}>
        <div className="text-center">
          <div className="text-red-500 text-2xl mb-2 font-bold">!</div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">Video Connection Error</h3>
          <p className="text-sm text-red-600 mb-4">{videoError}</p>
          <Button
            onClick={startVideo}
            className="bg-red-600 hover:bg-red-700"
            disabled={isLoading}
          >
            {isLoading ? 'Connecting...' : 'Try Again'}
          </Button>
        </div>
      </div>
    );
  }

  // Render loading state
  if (isLoading && !isVideoActive) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-50 min-h-[300px] rounded-lg`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Starting Video Conference</h3>
          <p className="text-sm text-gray-600">Setting up your Whereby session...</p>
        </div>
      </div>
    );
  }

  // Render video not started state
  if (!isVideoActive) {
    return (
      <Card className={`${className} border-2 border-dashed border-gray-300`}>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Video className="h-5 w-5" />
            Video Conference
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Session Information:</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <div>Session ID: {sessionId}</div>
              <div>Job ID: {jobId}</div>
              <div>Mode: {mode}</div>
              <div>User: {effectiveCurrentUser.name} ({effectiveCurrentUser.role})</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Participants:</h4>
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                {effectiveCurrentUser.name} (You - {effectiveCurrentUser.role})
              </Badge>
              {effectiveParticipants.map(participant => (
                <Badge 
                  key={participant.userId} 
                  variant="outline"
                  className={
                    participant.userType === 'notary' ? 'border-purple-300' :
                    participant.userType === 'signer' ? 'border-blue-300' :
                    'border-green-300'
                  }
                >
                  {participant.displayName} ({participant.userType})
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={startVideo}
              className="w-full"
              disabled={isLoading}
            >
              <Video className="h-4 w-4 mr-2" />
              {isLoading ? 'Starting Video...' : 'Start Video Conference'}
            </Button>

            {/* Advanced Settings Toggle */}
            <Button
              onClick={() => setShowAdvanced(!showAdvanced)}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
            </Button>

            {/* Advanced Settings Panel */}
            {showAdvanced && (
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg text-left">
                <div>
                  <label className="text-xs font-medium text-gray-700">Video Quality</label>
                  <select
                    value={videoQuality.resolution}
                    onChange={(e) => setVideoQuality(prev => ({ ...prev, resolution: e.target.value as any }))}
                    className="w-full mt-1 text-xs border rounded px-2 py-1"
                  >
                    <option value="low">Low (480p)</option>
                    <option value="medium">Medium (720p)</option>
                    <option value="high">High (1080p)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Bandwidth</label>
                  <select
                    value={videoQuality.bandwidth}
                    onChange={(e) => setVideoQuality(prev => ({ ...prev, bandwidth: e.target.value as any }))}
                    className="w-full mt-1 text-xs border rounded px-2 py-1"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render active video conference
  return (
    <div className={className}>
      <OpenViduVideoConference
        sessionId={sessionId}
        jobId={typeof jobId === 'string' ? parseInt(jobId) : jobId}
        currentUser={{
          ...effectiveCurrentUser,
          id: typeof effectiveCurrentUser.id === 'string' ? parseInt(effectiveCurrentUser.id) : effectiveCurrentUser.id
        }}
        participants={effectiveParticipants.map((p, index) => ({
          userId: parseInt(p.userId),
          connectionId: `connection-${p.userId}-${Date.now()}`,
          role: p.userType as 'notary' | 'signer' | 'witness' | 'observer' | 'admin',
          displayName: p.displayName,
          email: p.email || '',
          avatar: undefined,
          isHost: p.userType === 'notary',
          isConnected: false,
          joinedAt: new Date(),
          videoEnabled: true,
          audioEnabled: true,
          isScreenSharing: false,
          networkQuality: 'good' as const,
          position: index
        }))}
        onParticipantJoined={handleParticipantJoined}
        onParticipantLeft={handleParticipantLeft}
        onConnectionStatusChange={handleConnectionStatusChange}
        autoStart={autoStart}
        className="h-full"
      />
    </div>
  );
};

export default VideoIntegration; 