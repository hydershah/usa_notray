import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, 
  Pause, 
  Square, 
  Users,
  Shield,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
  FileText,
  Zap,
  Keyboard,
  Video,
  StopCircle
} from 'lucide-react';
import { authenticatedFetch } from '@/lib/auth';
import SimpleVideoConference from './SimpleVideoConference';
import { PDFTaggingEditor } from './PDFTaggingEditor';
import { LiveSigningControls } from './LiveSigningControls';
import { ParticipantPanel } from './ParticipantPanel';
import { SessionStatus } from './SessionStatus';
import type { 
  SessionDocument, 
  SessionParticipant, 
  DocumentTag,
  EditorSession 
} from '@/types/editor';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { VideoIntegration } from './VideoIntegration';

interface LiveSigningInterfaceProps {
  sessionId: string;
  liveSessionId?: string;
  documents: SessionDocument[];
  participants: SessionParticipant[];
  currentUserId: string;
  jobData: any;
  onSessionComplete: () => void;
  onTagsChanged: (tags: DocumentTag[]) => void;
}

interface LiveSessionState {
  state: 'waiting' | 'active' | 'paused' | 'completing' | 'completed';
  activeUserId?: number;
  startedAt?: Date;
  pausedAt?: Date;
  participants: SessionParticipantStatus[];
}

interface SessionParticipantStatus {
  userId: number;
  isActive: boolean;
  joinedAt?: Date;
  leftAt?: Date;
  canInteract: boolean;
  lastActivity?: Date;
}

export const LiveSigningInterface: React.FC<LiveSigningInterfaceProps> = ({
  sessionId,
  liveSessionId,
  documents,
  participants,
  currentUserId,
  jobData,
  onSessionComplete,
  onTagsChanged
}) => {
  // Toast hook
  const { toast } = useToast();
  
  // Live signing state
  const [liveSession, setLiveSession] = useState<LiveSessionState>({
    state: 'waiting',
    participants: []
  });
  const [sessionDuration, setSessionDuration] = useState(0);
  const [showParticipants, setShowParticipants] = useState(true);
  const [currentDocumentIndex, setCurrentDocumentIndex] = useState(0);
  const [completedTags, setCompletedTags] = useState<DocumentTag[]>([]);
  const [missingRequiredTags, setMissingRequiredTags] = useState<DocumentTag[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get current user role - ENHANCED FOR UI RESTRICTIONS
  const currentUser = useMemo(() => participants.find(p => p.userId === currentUserId), [participants, currentUserId]);
  const isNotary = currentUser?.userType === 'notary';
  const isSigner = currentUser?.userType === 'signer';
  const isWitness = currentUser?.userType === 'witness';
  const canControlSession = isNotary;

  // Session timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (liveSession.state === 'active' && liveSession.startedAt) {
      interval = setInterval(() => {
        const now = new Date();
        const start = new Date(liveSession.startedAt!);
        const duration = Math.floor((now.getTime() - start.getTime()) / 1000);
        setSessionDuration(duration);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [liveSession.state, liveSession.startedAt]);

  // Load live session state with optimized polling
  useEffect(() => {
    if (liveSessionId || sessionId) {
      loadLiveSessionState();
      // Reduce polling frequency to every 10 seconds to improve performance
      const pollInterval = setInterval(loadLiveSessionState, 10000);
      return () => clearInterval(pollInterval);
    }
  }, [liveSessionId, sessionId]);

  const loadLiveSessionState = async () => {
    try {
      const targetSessionId = liveSessionId || sessionId;
      const response = await authenticatedFetch(`/api/session/${targetSessionId}/state`);

      if (response.ok) {
        const data = await response.json();
        const sessionState = data.success ? data.data : data;
        
        // Ensure we have a valid session state object
        const validSessionState = {
          state: sessionState?.state || 'waiting',
          activeUserId: sessionState?.activeUserId,
          startedAt: sessionState?.startedAt,
          pausedAt: sessionState?.pausedAt,
          participants: sessionState?.participants || []
        };
        
        setLiveSession(validSessionState);
      }
    } catch (error) {
      console.error('Failed to load live session state:', error);
      // Keep the current state on error, don't reset
    }
  };

  // Session control functions
  const handleStartSession = async () => {
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      const targetSessionId = liveSessionId || sessionId;
      const response = await authenticatedFetch(`/api/session/${targetSessionId}/start-signing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast({
          title: "Session Started",
          description: "Live signing session is now active"
        });
        await loadLiveSessionState();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start session');
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start live signing session"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePauseSession = async () => {
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      const targetSessionId = liveSessionId || sessionId;
      const response = await authenticatedFetch(`/api/session/${targetSessionId}/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast({
          title: "Session Paused",
          description: "Session has been paused. You can resume anytime."
        });
        await loadLiveSessionState();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to pause session');
      }
    } catch (error) {
      console.error('Failed to pause session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to pause session"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResumeSession = async () => {
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      const targetSessionId = liveSessionId || sessionId;
      const response = await authenticatedFetch(`/api/session/${targetSessionId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast({
          title: "Session Resumed",
          description: "Session has been resumed"
        });
        await loadLiveSessionState();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to resume session');
      }
    } catch (error) {
      console.error('Failed to resume session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to resume session"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteSession = async () => {
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      const targetSessionId = liveSessionId || sessionId;
      const response = await authenticatedFetch(`/api/session/${targetSessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast({
          title: "Session Completed",
          description: "Live signing session has been completed successfully"
        });
        
        // Call the parent completion handler
        if (onSessionComplete) {
          onSessionComplete();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to complete session');
      }
    } catch (error) {
      console.error('Failed to complete session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to complete session"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetActiveUser = async (userId: string) => {
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      const targetSessionId = liveSessionId || sessionId;
      const response = await authenticatedFetch(`/api/session/${targetSessionId}/set-active-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: parseInt(userId) })
      });

      if (response.ok) {
        await loadLiveSessionState();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to set active user');
      }
    } catch (error) {
      console.error('Failed to set active user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to set active user"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getSessionStateColor = (state?: string) => {
    switch (state) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'paused': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'waiting': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completing': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col" data-testid="live-signing-interface">
      {/* Session Header - ENHANCED WITH ROLE INDICATOR */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Session Info with Role Indicator */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse"></div>
              <h1 className="text-lg font-semibold text-gray-800">Live Signing Session</h1>
              
              {/* ✅ ROLE INDICATOR FOR SIGNERS */}
              {isSigner && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                  👤 Signer Role
                </Badge>
              )}
              {isNotary && (
                <Badge className="bg-red-100 text-red-800 border-red-300">
                  🔐 Notary Control
                </Badge>
              )}
            </div>
            
            <Badge className={`border ${getSessionStateColor(liveSession.state || 'waiting')}`}>
              {liveSession.state || 'waiting'}
            </Badge>
            
            {liveSession.state === 'active' && (
              <span className="text-sm text-gray-600">
                Duration: {formatDuration(sessionDuration)}
              </span>
            )}
          </div>

          {/* Session Controls - RESTRICTED FOR SIGNERS */}
          <div className="flex items-center gap-2">
            {/* ❌ SIGNERS CANNOT SEE SESSION CONTROLS */}
            {canControlSession && (
              <LiveSigningControls
                sessionState={liveSession.state || 'waiting'}
                canControlSession={canControlSession}
                onStartSession={handleStartSession}
                onPauseSession={handlePauseSession}
                onResumeSession={handleResumeSession}
                onCompleteSession={handleCompleteSession}
                isLoading={isLoading}
              />
            )}
            
            {/* ✅ SIGNER STATUS INDICATOR */}
            {isSigner && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-1">
                  {liveSession.activeUserId === currentUserId ? (
                    <>
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-700 font-medium">Active</span>
                    </>
                  ) : (
                    <>
                      <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm text-yellow-700 font-medium">Waiting</span>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {/* Participants toggle - available to all */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowParticipants(!showParticipants)}
            >
              <Users className="h-4 w-4 mr-2" />
              {showParticipants ? 'Hide' : 'Show'} Participants
            </Button>
          </div>
        </div>
        
        {/* ✅ SIGNER INSTRUCTIONS BAR */}
        {isSigner && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-blue-600">
                <Shield className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-800">Signer Instructions</h3>
                <p className="text-sm text-blue-700 mt-1">
                  {liveSession.activeUserId === currentUserId ? (
                    <>
                      <strong>You are now active!</strong> Click on tags assigned to you to fill them out. 
                      The notary will guide you through the process.
                    </>
                  ) : (
                    <>
                      Please wait for the notary to activate you. You can view the document but cannot make changes yet.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Integration Panel */}
        <div className="w-80 bg-white border-r border-gray-200 flex-shrink-0">
          <VideoIntegration
            sessionId={sessionId}
            participants={participants}
          />
        </div>

        {/* Document Editor */}
        <div className="flex-1 bg-gray-50 overflow-hidden">
          <PDFTaggingEditor
            sessionId={sessionId}
            mode="signing"
            documents={documents}
            participants={participants}
            currentUserId={currentUserId}
            onSessionComplete={onSessionComplete}
            onTagsChanged={onTagsChanged}
            liveSessionState={liveSession}
            onSetActiveUser={(userId: number) => handleSetActiveUser(userId.toString())}
          />
        </div>

        {/* Participants Panel */}
        {showParticipants && (
          <div className="w-72 bg-white border-l border-gray-200">
            <ParticipantPanel
              participants={participants}
              liveSession={liveSession}
              currentUserId={currentUserId}
              onSetActiveUser={(userId: number) => handleSetActiveUser(userId.toString())}
              canControlSession={canControlSession}
            />
          </div>
        )}
      </div>

      {/* Session Status Bar */}
      <div className="bg-white border-t border-gray-200 p-3">
        <SessionStatus
          completedTags={completedTags.length}
          totalTags={completedTags.length + missingRequiredTags.length}
          missingRequiredTags={missingRequiredTags.length}
          sessionState={liveSession.state}
          sessionDuration={sessionDuration}
          participantCount={participants.length}
        />
      </div>
    </div>
  );
}; 