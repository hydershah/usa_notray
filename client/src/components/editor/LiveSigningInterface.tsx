import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Keyboard
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
  const [isRecording, setIsRecording] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [currentDocumentIndex, setCurrentDocumentIndex] = useState(0);
  const [completedTags, setCompletedTags] = useState<DocumentTag[]>([]);
  const [missingRequiredTags, setMissingRequiredTags] = useState<DocumentTag[]>([]);

  // Get current user role
  const currentUser = useMemo(() => participants.find(p => p.userId === currentUserId), [participants, currentUserId]);
  const isNotary = currentUser?.userType === 'notary';
  const canControlSession = isNotary || currentUser?.userType === 'admin';

  // Get auth user data as fallback for admin users not in participants list
  const authUserData = useMemo(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        return userData;
      } catch (e) {
        console.error('Error parsing stored user data:', e);
        return null;
      }
    }
    return null;
  }, []);

  // Memoize the user object to prevent re-renders
  const videoUser = useMemo(() => {
    // First try to get from participants list
    if (currentUser) {
      return {
        id: currentUserId,
        name: currentUser.displayName,
        email: currentUser.email || '',
        role: currentUser.userType
      };
    }
    
    // Fallback to auth user data (for admin users not in participants)
    if (authUserData) {
      const displayName = authUserData.firstName && authUserData.lastName 
        ? `${authUserData.firstName} ${authUserData.lastName}`
        : authUserData.username || authUserData.email || 'Unknown User';
      
      return {
        id: currentUserId,
        name: displayName,
        email: authUserData.email || '',
        role: authUserData.role === 'admin' ? 'admin' : 'signer'
      };
    }
    
    // Last resort fallback
    return {
      id: currentUserId,
      name: 'Unknown User',
      email: '',
      role: 'signer'
    };
  }, [currentUserId, currentUser, authUserData]);

  // Session timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (liveSession.state === 'active' && liveSession.startedAt) {
      interval = setInterval(() => {
        const now = new Date();
        const startTime = new Date(liveSession.startedAt!);
        const duration = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setSessionDuration(duration);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [liveSession.state, liveSession.startedAt]);

  // Load live session state
  useEffect(() => {
    if (liveSessionId) {
      loadLiveSessionState();
      const pollInterval = setInterval(loadLiveSessionState, 3000); // Poll every 3 seconds
      return () => clearInterval(pollInterval);
    }
  }, [liveSessionId]);

  const loadLiveSessionState = async () => {
    try {
      const response = await authenticatedFetch(`/api/session/${liveSessionId || sessionId}/state`);

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
        
        // Auto-start recording if session becomes active
        if (validSessionState.state === 'active' && !isRecording) {
          handleStartRecording();
        }
      }
    } catch (error) {
      console.error('Failed to load live session state:', error);
      // Keep the current state on error, don't reset to undefined
    }
  };

  // Session control functions
  const handleStartSession = async () => {
    try {
      const response = await authenticatedFetch(`/api/session/${liveSessionId || sessionId}/start-signing`, {
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
        throw new Error('Failed to start session');
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start live signing session"
      });
    }
  };

  const handlePauseSession = async () => {
    try {
      const response = await authenticatedFetch(`/api/session/${liveSessionId || sessionId}/pause`, {
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
      }
    } catch (error) {
      console.error('Failed to pause session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to pause session"
      });
    }
  };

  const handleResumeSession = async () => {
    try {
      const response = await authenticatedFetch(`/api/session/${liveSessionId || sessionId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast({
          title: "Session Resumed",
          description: "Live signing session has been resumed"
        });
        await loadLiveSessionState();
      }
    } catch (error) {
      console.error('Failed to resume session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to resume session"
      });
    }
  };

  const handleSetActiveUser = async (userId: number) => {
    try {
      const response = await authenticatedFetch(`/api/session/${liveSessionId || sessionId}/set-active-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        const activeUser = participants.find(p => p.userId === userId.toString());
        toast({
          title: "Active User Changed",
          description: `${activeUser?.displayName || 'User'} can now interact with documents`
        });
        await loadLiveSessionState();
      }
    } catch (error) {
      console.error('Failed to set active user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to change active user"
      });
    }
  };

  const handleStartRecording = async () => {
    try {
      setIsRecording(true);
      toast({
        title: "Recording Started",
        description: "Session recording is now active"
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      toast({
        variant: "destructive",
        title: "Recording Error",
        description: "Failed to start session recording"
      });
    }
  };

  const handleCompleteSession = async () => {
    try {
      // Check if all required tags are completed
      if (missingRequiredTags.length > 0) {
        toast({
          variant: "destructive",
          title: "Incomplete Documents",
          description: `${missingRequiredTags.length} required tags must be completed before ending the session.`
        });
        return;
      }

      const response = await authenticatedFetch(`/api/session/${liveSessionId || sessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast({
          title: "Session Completed",
          description: "Live signing session completed successfully!"
        });
        onSessionComplete();
      }
    } catch (error) {
      console.error('Failed to complete session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to complete session"
      });
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
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header with session controls */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          {/* Session Info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse"></div>
              <h1 className="text-lg font-semibold text-gray-800">Live Signing Session</h1>
            </div>
            
            <Badge className={`border ${getSessionStateColor(liveSession.state || 'waiting')}`}>
              {(liveSession.state || 'waiting').toUpperCase()}
            </Badge>
            
            {liveSession.state === 'active' && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                {formatDuration(sessionDuration)}
              </div>
            )}
            
            {isRecording && (
              <div className="flex items-center gap-1 text-sm text-red-600">
                <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
                Recording
              </div>
            )}
          </div>

          {/* Session Controls */}
          <div className="flex items-center gap-2">
            {canControlSession && (
              <>
                {liveSession.state === 'waiting' && (
                  <Button onClick={handleStartSession} className="bg-green-600 hover:bg-green-700">
                    <Play className="h-4 w-4 mr-2" />
                    Start Session
                  </Button>
                )}
                
                {liveSession.state === 'active' && (
                  <Button onClick={handlePauseSession} variant="outline">
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                )}
                
                {liveSession.state === 'paused' && (
                  <Button onClick={handleResumeSession} className="bg-blue-600 hover:bg-blue-700">
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                )}
                
                {(liveSession.state === 'active' || liveSession.state === 'paused') && (
                  <Button onClick={handleCompleteSession} className="bg-purple-600 hover:bg-purple-700">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Session
                  </Button>
                )}
              </>
            )}
            
            <Button
              variant="outline"
              onClick={() => setShowParticipants(!showParticipants)}
              className="border-gray-300"
            >
              <Users className="h-4 w-4 mr-2" />
              Participants ({participants.length})
            </Button>
          </div>
        </div>
        
        {/* Job Information */}
        <div className="mt-2 text-sm text-gray-600">
          <span className="font-medium">{jobData?.title || 'Untitled Job'}</span>
          {jobData?.titleCompany && <span> • {jobData.titleCompany}</span>}
          <span> • {documents.length} document{documents.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Panel */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* Video Integration */}
          <SimpleVideoConference
            sessionId={sessionId}
            currentUser={videoUser}
            participants={participants}
            className="h-full"
          />
        </div>

        {/* Document Editor */}
        <div className="flex-1 flex flex-col">
          {/* Document Navigation */}
          {documents.length > 1 && (
            <div className="bg-white border-b border-gray-200 p-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600">Documents:</span>
                <div className="flex gap-2">
                  {documents.map((doc, index) => (
                    <Button
                      key={doc.id}
                      variant={currentDocumentIndex === index ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentDocumentIndex(index)}
                      className="text-xs"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      {doc.fileName}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Active User Indicator */}
          {liveSession.state === 'active' && (
            <div className="bg-blue-50 border-b border-blue-200 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">
                    Active User: {participants.find(p => p.userId === liveSession.activeUserId?.toString())?.displayName || 'None'}
                  </span>
                </div>
                
                {isNotary && (
                  <div className="flex items-center gap-2 text-xs text-blue-600">
                    <Keyboard className="h-3 w-3" />
                    Press <kbd className="bg-white px-1 rounded border">`</kbd> for notary, 
                    <kbd className="bg-white px-1 rounded border">1-8</kbd> for signers
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PDF Editor */}
          <div className="flex-1">
            <PDFTaggingEditor
              sessionId={sessionId}
              mode="signing"
              documents={documents}
              participants={participants}
              currentUserId={currentUserId}
              onSessionComplete={onSessionComplete}
              onTagsChanged={(tags) => {
                onTagsChanged(tags);
                setCompletedTags(tags.filter(t => t.isCompleted));
                setMissingRequiredTags(tags.filter(t => !t.isCompleted && t.isRequired));
              }}
              liveSessionState={liveSession}
              onSetActiveUser={handleSetActiveUser}
            />
          </div>
        </div>

        {/* Participants Panel */}
        {showParticipants && (
          <div className="w-72 bg-white border-l border-gray-200">
            <ParticipantPanel
              participants={participants}
              liveSession={liveSession}
              currentUserId={currentUserId}
              onSetActiveUser={handleSetActiveUser}
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