import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/editor/useWebSocket';
import { useEditorStore } from '@/hooks/editor/useEditorStore';
import { 
  Play, 
  Pause, 
  Square, 
  Users,
  Video,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { authenticatedFetch } from '@/lib/auth';
import { OpenViduVideoConference } from '../video/OpenViduVideoConference';
import { PDFTaggingEditor } from './PDFTaggingEditor';
import { ParticipantPanel } from './ParticipantPanel';
import type { 
  SessionDocument, 
  SessionParticipant, 
  DocumentTag,
  EditorSession 
} from '@/types/editor';

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
  const { toast } = useToast();
  
  // State management
  const [liveSession, setLiveSession] = useState<LiveSessionState>({
    state: 'waiting',
    participants: []
  });
  const [sessionDuration, setSessionDuration] = useState(0);
  const [showVideo, setShowVideo] = useState(true);
  const [showParticipants, setShowParticipants] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [videoAutoStarted, setVideoAutoStarted] = useState(false);
  
  // Track WebSocket connection state for UI feedback
  const [wsConnectionState, setWsConnectionState] = useState({
    isConnected: false,
    isConnecting: false,
    isReady: false
  });
  
  // User role detection
  const currentUser = participants.find(p => p.userId === currentUserId);
  const isNotary = currentUser?.userType === 'notary';
  const isSigner = currentUser?.userType === 'signer';
  const canControlSession = isNotary; // Only notary can control live session

  // WebSocket connection for real-time sync
  const webSocket = useWebSocket({
    sessionId: liveSessionId || sessionId,
    userId: currentUserId,
    autoReconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10
  });
  
  // Update WebSocket connection state tracking
  useEffect(() => {
    if (webSocket?.connectionState) {
      const newState = {
        isConnected: webSocket.connectionState.isConnected || false,
        isConnecting: webSocket.connectionState.isConnecting || false,
        isReady: webSocket.connectionState.isConnected && !webSocket.connectionState.isConnecting
      };
      setWsConnectionState(newState);
      console.log('🔗 LiveSigning WebSocket state:', newState);
    } else if (webSocket) {
      // Use the hook's direct properties if connectionState is not available
      const newState = {
        isConnected: webSocket.isConnected || false,
        isConnecting: webSocket.isConnecting || false,
        isReady: webSocket.isReady || false
      };
      setWsConnectionState(newState);
      console.log('🔗 LiveSigning WebSocket state (direct):', newState);
    }
  }, [webSocket?.connectionState?.isConnected, webSocket?.connectionState?.isConnecting, webSocket?.isConnected, webSocket?.isConnecting, webSocket?.isReady]);

  // Log WebSocket connection status
  useEffect(() => {
    console.log('🔗 WebSocket connection state:', webSocket.connectionState);
  }, [webSocket.connectionState]);

  // Access editor store to get current page and document
  const { viewer, currentDocument } = useEditorStore();

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

  // Session state polling
  useEffect(() => {
    if (liveSessionId || sessionId) {
      loadLiveSessionState();
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
    }
  };

  // Session completion with retry logic and status polling
  const completeSessionWithRetry = async (targetSessionId: string) => {
    let attempt = 1;
    const maxAttempts = 3;
    
    while (attempt <= maxAttempts) {
      try {
        console.log(`🔄 Session completion attempt ${attempt}/${maxAttempts}...`);
        
        // Try to complete the session with a shorter initial timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await authenticatedFetch(`/api/session/${targetSessionId}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Session completion successful:', result);
          return result;
        } else {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to complete session');
        }
        
      } catch (error: any) {
        console.log(`❌ Attempt ${attempt} failed:`, error?.message);
        
        // If it's a timeout or network error, check if the session was actually completed
        if (error?.name === 'AbortError' || error?.message?.includes('Failed to fetch') || 
            error?.message?.includes('ERR_EMPTY_RESPONSE')) {
          
          console.log('🔍 Checking session status after network error...');
          
          // Poll session status to see if it completed successfully
          const isCompleted = await checkSessionStatus(targetSessionId);
          if (isCompleted) {
            console.log('✅ Session was actually completed successfully!');
            return { success: true, message: 'Session completed successfully' };
          }
        }
        
        // If this was the last attempt, throw the error
        if (attempt === maxAttempts) {
          // Check one final time if the session completed during our retries
          const finalCheck = await checkSessionStatus(targetSessionId);
          if (finalCheck) {
            console.log('✅ Session completed during retries!');
            return { success: true, message: 'Session completed successfully' };
          }
          
          throw new Error(`Session completion failed after ${maxAttempts} attempts. ${error?.message || 'Unknown error'}`);
        }
        
        // Wait before retrying
        const delay = attempt * 2000; // 2s, 4s delays
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }
  };
  
  // Check if session has been completed
  const checkSessionStatus = async (targetSessionId: string): Promise<boolean> => {
    try {
      const response = await authenticatedFetch(`/api/session/${targetSessionId.replace('live_', '')}/state`);
      if (response.ok) {
        const data = await response.json();
        const isCompleted = data?.data?.status === 'completed';
        console.log('📊 Session status check:', { status: data?.data?.status, isCompleted });
        return isCompleted;
      }
    } catch (error) {
      console.log('⚠️ Could not check session status:', error);
    }
    return false;
  };

  // Session control functions
  const handleSessionAction = async (action: 'start' | 'pause' | 'resume' | 'complete') => {
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      const targetSessionId = liveSessionId || sessionId;
      
      // Use specialized completion handler for 'complete' action
      if (action === 'complete') {
        console.log('🎯 Initiating session completion...');
        
        // Show progress indication for long-running completion
        toast({
          title: "Processing",
          description: "Completing session... This may take a few moments."
        });
        
        await completeSessionWithRetry(targetSessionId);
        
        toast({
          title: "Success",
          description: "Session completed successfully"
        });
        
        if (onSessionComplete) {
          console.log('🚀 Calling onSessionComplete callback');
          onSessionComplete();
        }
        return;
      }
      
      // Handle other actions normally
      const endpoint = action === 'start' ? 'start-signing' : action;
      
      const response = await authenticatedFetch(`/api/session/${targetSessionId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const messages = {
          start: 'Session started successfully',
          pause: 'Session paused',
          resume: 'Session resumed'
        };
        
        toast({
          title: "Success",
          description: messages[action as keyof typeof messages]
        });
        
        await loadLiveSessionState();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${action} session`);
      }
    } catch (error: any) {
      console.error(`Failed to ${action} session:`, error);
      
      // Provide more specific error messages
      let errorMessage = `Failed to ${action} session. Please try again.`;
      
      if (action === 'complete') {
        if (error?.message?.includes('Connection lost') || error?.message?.includes('longer than expected')) {
          errorMessage = error.message + ' Please refresh the page to check the session status.';
        }
      }
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
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

  const handleSyncUsers = async () => {
    if (isLoading || !isNotary) return;
    setIsLoading(true);
    
    try {
      // Send sync command via WebSocket with current page and document info
      webSocket.syncUsers(
        viewer.currentPage || 1,
        currentDocument?.id
      );
      
      // Also make API call to record the sync event
      const targetSessionId = liveSessionId || sessionId;
      await authenticatedFetch(`/api/session/${targetSessionId}/sync-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pageNumber: viewer.currentPage || 1,
          documentId: currentDocument?.id
        })
      });

      toast({
        title: "Success",
        description: `All users synced to page ${viewer.currentPage || 1}`
      });
      
    } catch (error) {
      console.error('Failed to sync users:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to sync users to notary view"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'waiting': return 'bg-blue-500';
      case 'completing': return 'bg-purple-500';
      case 'completed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const renderSessionControls = () => {
    if (!canControlSession) return null;

    // Check if WebSocket is ready for session control
    const isWebSocketReady = wsConnectionState.isReady;
    const buttonDisabled = isLoading || !isWebSocketReady;

    return (
      <div className="flex items-center gap-2">
        {liveSession.state === 'waiting' && (
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => handleSessionAction('start')} 
              size="sm"
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
              disabled={buttonDisabled}
              title={!isWebSocketReady ? 'Waiting for connection...' : 'Start live signing session'}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : wsConnectionState.isConnecting ? (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  <span className="text-xs">Connecting...</span>
                </div>
              ) : !isWebSocketReady ? (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span className="text-xs">Not Ready</span>
                </div>
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            
            {/* Connection Status Indicator */}
            {!isWebSocketReady && (
              <div className="text-xs text-gray-500 px-2">
                {wsConnectionState.isConnecting ? 'Establishing connection...' : 'Connection required'}
              </div>
            )}
          </div>
        )}
        
        {liveSession.state === 'active' && (
          <>
            <Button 
              onClick={() => handleSessionAction('pause')} 
              size="sm"
              variant="outline"
              disabled={buttonDisabled}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
            </Button>
            
            <Button 
              onClick={() => handleSessionAction('complete')} 
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
              disabled={buttonDisabled}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Simplified Header */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${getStatusColor(liveSession.state)} ${liveSession.state === 'active' ? 'animate-pulse' : ''}`}></div>
            <span className="font-medium">Live Signing</span>
          </div>
          
          <Badge variant="secondary" className="text-xs">
            {liveSession.state}
          </Badge>

          {/* WebSocket Connection Status */}
          <Badge 
            variant={webSocket.connectionState.isConnected ? 'default' : 'destructive'}
            className="text-xs"
          >
            {webSocket.connectionState.isConnected 
              ? '🟢 Synced' 
              : webSocket.connectionState.isConnecting
              ? '🟡 Connecting...'
              : '🔴 No Sync'
            }
          </Badge>
          
          {isSigner && (
            <Badge variant={liveSession.activeUserId === parseInt(currentUserId) ? "default" : "outline"} className="text-xs">
              {liveSession.activeUserId === parseInt(currentUserId) ? 'Active' : 'Waiting'}
            </Badge>
          )}
          
          {liveSession.state === 'active' && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Clock className="h-3 w-3" />
              {formatDuration(sessionDuration)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {renderSessionControls()}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVideo(!showVideo)}
            className="px-2"
          >
            <Video className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowParticipants(!showParticipants)}
            className="px-2"
          >
            <Users className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Simplified Instructions for Signers */}
      {isSigner && liveSession.state === 'waiting' && (
        <div className="bg-blue-50 border-b px-4 py-2 text-sm text-blue-800">
          Waiting for notary to start the session...
        </div>
      )}
      
      {isSigner && liveSession.state === 'active' && liveSession.activeUserId !== parseInt(currentUserId) && (
        <div className="bg-yellow-50 border-b px-4 py-2 text-sm text-yellow-800">
          Please wait for the notary to activate you
        </div>
      )}
      
      {isSigner && liveSession.state === 'active' && liveSession.activeUserId === parseInt(currentUserId) && (
        <div className="bg-green-50 border-b px-4 py-2 text-sm text-green-800">
          You're active! Click on your tags to fill them out
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Enhanced Video Panel - Reduced width */}
        {showVideo && (
          <div className="w-64 bg-gradient-to-b from-gray-50 to-gray-100 border-r border-gray-200 flex-shrink-0 shadow-sm">
            <div className="h-full flex flex-col">

              
              {/* Video Content */}
              <div className="flex-1">
                <OpenViduVideoConference
                  sessionId={sessionId}
                  jobId={parseInt(sessionId.split('_')[1]) || parseInt(sessionId) || 1}
                  currentUser={{
                    id: parseInt(currentUserId),
                    name: currentUser?.displayName || 'Unknown User',
                    email: currentUser?.email || '',
                    role: currentUser?.userType || 'signer'
                  }}
                  participants={participants.map((p, index) => ({
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
                  autoStart={true}
                  className="h-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Document Editor */}
        <div className="flex-1 overflow-hidden min-w-0">
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
            onSyncUsers={handleSyncUsers}
            isSyncLoading={isLoading}
            webSocket={webSocket}
          />
        </div>


      </div>
    </div>
  );
}; 