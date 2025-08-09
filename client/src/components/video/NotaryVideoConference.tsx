/**
 * Notary Video Conference Component
 * Main component using Daily React for 8-participant video sessions
 * Replaces the complex custom implementation with ~300 lines vs 2000+
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  useDaily,
  useParticipantIds,
  useLocalParticipant,
  useDailyEvent,
  useRecording,
  useScreenShare,
  DailyAudio
} from '@daily-co/daily-react';
import { ParticipantTile } from './ParticipantTile';
import { VideoControlPanel } from './VideoControlPanel';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  role: 'notary' | 'signer' | 'witness' | 'client' | 'admin';
  email?: string;
}

interface NotaryVideoConferenceProps {
  currentUser: User;
  onSessionJoined?: (event: any) => void;
  onSessionLeft?: (event: any) => void;
  onRecordingStarted?: (event: any) => void;
  onRecordingEnded?: (event: any) => void;
  onParticipantJoined?: (event: any) => void;
  onParticipantLeft?: (event: any) => void;
  onError?: (error: any) => void;
  className?: string;
  signingSessionState?: 'waiting' | 'active' | 'paused' | 'completing' | 'completed';
  autoJoin?: boolean;
  // NEW: Job identifier for server-side recording persistence
  jobId: string;
}

export const NotaryVideoConference: React.FC<NotaryVideoConferenceProps> = ({
  currentUser,
  onSessionJoined,
  onSessionLeft,
  onRecordingStarted,
  onRecordingEnded,
  onParticipantJoined,
  onParticipantLeft,
  onError,
  className,
  signingSessionState = 'waiting',
  autoJoin = false,
  jobId
}) => {
  const daily = useDaily();
  const localParticipant = useLocalParticipant();
  const participantIds = useParticipantIds({ 
    filter: 'remote', 
    sort: 'joined_at' 
  });
  
  const { 
    isRecording, 
    // startRecording,  // replaced by server-side recording start
    // stopRecording     // replaced by server-side recording stop
  } = useRecording();
  
  const { 
    isSharingScreen, 
    startScreenShare, 
    stopScreenShare 
  } = useScreenShare();

  // Local media state
  const [hasLocalVideo, setHasLocalVideo] = useState(true);
  const [hasLocalAudio, setHasLocalAudio] = useState(true); // Start unmuted for notary sessions
  const [isJoining, setIsJoining] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'unknown'>('unknown');
  const [hasJoined, setHasJoined] = useState(false);
  const isMountedRef = useRef(true);
  const hasJoinedRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // User permissions
  const isNotary = currentUser.role === 'notary';
  const isAdmin = currentUser.role === 'admin';
  const canRecord = isNotary || isAdmin; // Notaries and admins can control recording
  const canScreenShare = true; // All participants can screen share

  // Handle Daily.co events
  useDailyEvent('joined-meeting', useCallback((event) => {
    console.log('✅ Successfully joined notary session:', event);
    setIsJoining(false);
    setHasJoined(true);
    toast({
      title: "Joined Video Session",
      description: "You have successfully joined the notary session",
    });
    onSessionJoined?.(event);
  }, [onSessionJoined]));

  useDailyEvent('left-meeting', useCallback((event) => {
    console.log('👋 Left notary session:', event);
    setHasJoined(false);
    hasJoinedRef.current = false;
    toast({
      title: "Left Video Session",
      description: "You have left the notary session",
    });
    onSessionLeft?.(event);
  }, [onSessionLeft]));

  useDailyEvent('participant-joined', useCallback((event) => {
    console.log('👤 Participant joined:', event.participant.user_name);
    toast({
      title: "Participant Joined",
      description: `${event.participant.user_name} joined the session`,
    });
    onParticipantJoined?.(event);
  }, [onParticipantJoined]));

  useDailyEvent('participant-left', useCallback((event) => {
    console.log('👤 Participant left:', event.participant.user_name);
    toast({
      title: "Participant Left",
      description: `${event.participant.user_name} left the session`,
    });
    onParticipantLeft?.(event);
  }, [onParticipantLeft]));

  useDailyEvent('recording-started', useCallback((event) => {
    console.log('🎬 Recording started for compliance:', event);
    toast({
      title: "Recording Started",
      description: "Session recording started for compliance",
    });
    onRecordingStarted?.(event);
  }, [onRecordingStarted]));

  useDailyEvent('recording-stopped', useCallback((event) => {
    console.log('⏹️ Recording stopped:', event);
    toast({
      title: "Recording Stopped",
      description: "Session recording has been stopped",
    });
    onRecordingEnded?.(event);
  }, [onRecordingEnded]));

  useDailyEvent('recording-error', useCallback((event) => {
    console.error('❌ Recording failed:', event);
    toast({
      title: "Recording Error",
      description: "Failed to start recording. Please try again.",
      variant: "destructive"
    });
    onError?.(event);
  }, [onError]));

  useDailyEvent('error', useCallback((event) => {
    console.error('❌ Daily.co error:', event);
    toast({
      title: "Video Session Error",
      description: event.errorMsg || "An error occurred in the video session",
      variant: "destructive"
    });
    onError?.(event);
  }, [onError]));

  // Network quality monitoring
  useDailyEvent('network-quality-change', useCallback((event: any) => {
    try {
      const isLocal = event?.participant?.local || (event?.participant?.session_id && event?.participant?.session_id === localParticipant?.session_id);
      if (!isLocal) return;

      // Daily may provide quality as 0-100 or nested score; support both
      const rawQuality = typeof event?.quality === 'number' ? event.quality : (event?.quality?.video?.score ?? 100);
      const normalized = rawQuality > 1 ? rawQuality / 100 : rawQuality; // normalize to 0-1
      setConnectionQuality(normalized >= 0.7 ? 'good' : 'poor');
    } catch (_) {
      // ignore malformed event
    }
  }, [localParticipant?.session_id]));

  // Auto-join when component mounts and retry when needed
  useEffect(() => {
    console.log('🔍 Video join effect - State check:');
    console.log('  - hasDaily:', !!daily);
    console.log('  - hasLocalParticipant:', !!localParticipant);
    console.log('  - isJoining:', isJoining);
    console.log('  - hasJoined:', hasJoined);
    console.log('  - isMounted:', isMountedRef.current);
    console.log('  - meetingState:', daily?.meetingState());
    
    // Only join if we have daily instance, are not currently joining, haven't joined, and component is mounted
    if (daily && !isJoining && !hasJoined && isMountedRef.current) {
      console.log('🎥 Joining Daily.co session for video feeds...');
      setIsJoining(true);
      
      // Check if we're already in a meeting
      const currentState = daily.meetingState();
      if (currentState === 'joined-meeting') {
        console.log('📱 Already in meeting, skipping join');
        setIsJoining(false);
        setHasJoined(true);
        hasJoinedRef.current = true;
        return;
      }
      
      daily.join({
        userName: currentUser.name,
        userData: {
          role: currentUser.role,
          userId: currentUser.id
        }
      }).then(() => {
        // Only set media state if component is still mounted
        if (isMountedRef.current) {
          console.log('🎤 Setting initial media state:', { hasLocalVideo, hasLocalAudio });
          daily.setLocalVideo(hasLocalVideo);
          daily.setLocalAudio(hasLocalAudio);
          setHasJoined(true);
          hasJoinedRef.current = true;
        }
      }).catch((error) => {
        console.error('❌ Failed to join session:', error);
        if (isMountedRef.current) {
          setIsJoining(false);
          toast({
            title: "Join Failed", 
            description: "Failed to join video session. Please try again.",
            variant: "destructive"
          });
        }
      });
    }
  }, [daily, currentUser.id, currentUser.name, currentUser.role, isJoining, hasJoined]);

  // Cleanup effect - leave session when component unmounts only
  useEffect(() => {
    // Don't setup cleanup based on daily changes - this causes cycling
    // Only setup cleanup once and let the unmount effect handle leaving
    return () => {
      // This cleanup should not run on daily changes, only on unmount
      console.log('🔄 Daily effect cleanup triggered');
    };
  }, []); // No dependencies - only setup once

  // Media control handlers
  const handleToggleVideo = useCallback(async () => {
    if (daily) {
      const newVideoState = !hasLocalVideo;
      await daily.setLocalVideo(newVideoState);
      setHasLocalVideo(newVideoState);
    }
  }, [daily, hasLocalVideo]);

  const handleToggleAudio = useCallback(async () => {
    if (daily) {
      const newAudioState = !hasLocalAudio;
      await daily.setLocalAudio(newAudioState);
      setHasLocalAudio(newAudioState);
    }
  }, [daily, hasLocalAudio]);

  const handleStartRecording = useCallback(async () => {
    try {
      // Resolve room name from Daily call
      let roomName: string | null = null;
      try {
        const roomOrPromise: any = daily?.room?.();
        if (roomOrPromise && typeof roomOrPromise.then === 'function') {
          const roomData = await roomOrPromise;
          roomName = roomData?.name || null;
        } else if (roomOrPromise && typeof roomOrPromise === 'object') {
          roomName = roomOrPromise?.name || null;
        }
      } catch (_) {}

      if (!roomName) {
        // Try to derive from configuration/session if available
        try {
          const config: any = (daily as any)?.config?.();
          const urlFromConfig: string | undefined = config?.url || config?.room?.url;
          if (urlFromConfig) {
            const parts = urlFromConfig.split('/');
            roomName = parts[parts.length - 1] || null;
          }
        } catch (_) {}
      }

      if (!roomName) {
        toast({
          title: 'Recording Error',
          description: 'Unable to detect room name for recording.',
          variant: 'destructive'
        });
        return;
      }

      const response = await fetch(`/api/jobs/${jobId}/video-session/recording/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ roomName, meetingId: roomName })
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to start recording');
      }

      toast({ title: 'Recording Started', description: 'Cloud recording has begun' });
    } catch (error) {
      console.error('❌ Failed to start recording via API:', error);
      toast({
        title: 'Recording Failed',
        description: error instanceof Error ? error.message : 'Failed to start recording',
        variant: 'destructive'
      });
    }
  }, [daily, jobId]);

  const handleStopRecording = useCallback(async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/video-session/recording/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ recordingId: 'current' })
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to stop recording');
      }

      toast({ title: 'Recording Stopped', description: 'Cloud recording has stopped' });
    } catch (error) {
      console.error('❌ Failed to stop recording via API:', error);
      toast({
        title: 'Recording Stop Failed',
        description: error instanceof Error ? error.message : 'Failed to stop recording',
        variant: 'destructive'
      });
    }
  }, [jobId]);

  const handleLeaveSession = useCallback(async () => {
    if (daily) {
      await daily.leave();
    }
  }, [daily]);

  // Auto-start/stop cloud recording based on signing session state
  useEffect(() => {
    console.log('🎬 Recording effect - State check:', {
      signingSessionState,
      isRecording,
      canRecord,
      hasJoined
    });
    
    if (signingSessionState === 'active' && !isRecording && canRecord && hasJoined) {
      console.log('🎬 Auto-starting cloud recording (server API)');
      handleStartRecording();
    } else if ((signingSessionState === 'completing' || signingSessionState === 'completed') && isRecording) {
      console.log('🛑 Auto-stopping cloud recording (server API)');
      handleStopRecording();
    }
  }, [signingSessionState, isRecording, canRecord, hasJoined, handleStartRecording, handleStopRecording]);

  const totalParticipants = participantIds.length + (localParticipant ? 1 : 0);

  if (isJoining) {
    return (
      <div className={cn("h-full flex items-center justify-center bg-gray-900", className)}>
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium mb-2">Joining Video Session</h3>
          <p className="text-gray-400">Please wait while we connect you...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col bg-gray-900", className)}>
      {/* Participant Grid */}
      <div className="flex-1 p-1 md:p-4 min-h-0">
        <div className="grid grid-cols-1 gap-2 md:gap-4 h-full overflow-y-auto">
          {/* Local Participant */}
          {localParticipant && (
            <ParticipantTile
              sessionId={localParticipant.session_id}
              isLocal={true}
              onToggleAudio={handleToggleAudio}
              onToggleVideo={handleToggleVideo}
            />
          )}
          
          {/* Remote Participants (max 7 for total of 8) */}
          {participantIds.slice(0, 7).map(sessionId => (
            <ParticipantTile
              key={sessionId}
              sessionId={sessionId}
              isLocal={false}
            />
          ))}
          
          {/* Empty slots for visual consistency (up to 8 total) */}
          {Array.from({ 
            length: Math.max(0, 8 - totalParticipants) 
          }).map((_, index) => (
            <div 
              key={`empty-${index}`}
              className="aspect-video bg-gray-800 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center"
            >
              <span className="text-gray-400 text-sm">
                Waiting for participant...
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Audio Component - handles all audio automatically */}
      <DailyAudio />

      {/* Control Panel - hidden on small screens */}
      <div className="hidden sm:block">
        <VideoControlPanel
          // Recording controls
          isRecording={isRecording}
          recordingState={isRecording ? 'recording' : 'idle'}
          canRecord={canRecord}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          
          // Screen sharing controls
          isScreenSharing={isSharingScreen}
          canScreenShare={canScreenShare}
          onStartScreenShare={startScreenShare}
          onStopScreenShare={stopScreenShare}
          
          // Local media controls
          hasLocalVideo={hasLocalVideo}
          hasLocalAudio={hasLocalAudio}
          onToggleVideo={handleToggleVideo}
          onToggleAudio={handleToggleAudio}
          
          // Session info
          participantCount={totalParticipants}
          maxParticipants={8}
          onLeaveSession={handleLeaveSession}
          
          // Connection status
          isConnected={!!localParticipant}
          connectionQuality={connectionQuality}
        />
      </div>
    </div>
  );
};