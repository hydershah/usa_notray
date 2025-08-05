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
  RefreshCw,
  Zap
} from 'lucide-react';
import { authenticatedFetch } from '@/lib/auth';
import { NotaryVideoSession } from '@/components/video';
import { PDFTaggingEditor } from './PDFTaggingEditor';
import { DocumentSelector } from './DocumentSelector';
import { ParticipantPanel } from './ParticipantPanel';
import { UnfilledTagsAlert } from './UnfilledTagsAlert';
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

interface VideoSessionData {
  sessionId: string;
  roomUrl: string;
  roomName: string;
  userToken: string;
  userRole: string;
  participantCount: number;
  maxParticipants: number;
  status: 'active' | 'recording' | 'completed';
  createdAt: string;
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
  const [videoSessionData, setVideoSessionData] = useState<VideoSessionData | null>(null);
  const [videoSessionError, setVideoSessionError] = useState<string | null>(null);
  const [hasInitializedVideoSession, setHasInitializedVideoSession] = useState(false);

  const [unfilledTagsError, setUnfilledTagsError] = useState<{
    unfilledTags: any[];
    message: string;
  } | null>(null);
  
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

  // Memoize participant and user objects to prevent re-renders
  const memoizedParticipants = useMemo(() => 
    participants.map(p => ({
      id: p.userId,
      name: p.displayName,
      role: p.userType,
      email: p.email
    })), 
    [participants]
  );

  // Function to fetch or create video session, now resides in the parent
  const fetchOrCreateVideoSession = useCallback(async (forceCreate = false) => {
    setIsLoading(true);
    setVideoSessionError(null);
    try {
      let response;
      if (!forceCreate) {
        response = await authenticatedFetch(`/api/notary/${jobData.id}/video-session`);
        if (response.ok) {
          const data = await response.json();
          setVideoSessionData(data);
          return;
        }
      }
      
      const createResponse = await authenticatedFetch(`/api/notary/${jobData.id}/video-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants: memoizedParticipants })
      });

      if (!createResponse.ok) throw new Error('Failed to create video session');
      
      const newSessionData = await createResponse.json();
      const userParticipant = newSessionData.participants.find((p: any) => p.id === currentUserId);
      
      setVideoSessionData({
        ...newSessionData,
        userToken: userParticipant?.token,
        userRole: userParticipant?.role
      });
    } catch (err: any) {
      setVideoSessionError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [jobData.id, currentUserId, memoizedParticipants]);

  useEffect(() => {
    if (!hasInitializedVideoSession && jobData?.id && memoizedParticipants.length > 0) {
      fetchOrCreateVideoSession();
      setHasInitializedVideoSession(true);
    }
  }, [jobData?.id, hasInitializedVideoSession, memoizedParticipants.length]);

  // Memoize WebSocket configuration to prevent reconnections
  const webSocketConfig = useMemo(() => ({
    sessionId: liveSessionId || sessionId,
    userId: currentUserId,
    autoReconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10
  }), [liveSessionId, sessionId, currentUserId]);

  // WebSocket connection for real-time sync
  const webSocket = useWebSocket(webSocketConfig);
  
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

  const loadLiveSessionState = useCallback(async () => {
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
  }, [liveSessionId, sessionId]);

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
          
          // Handle incomplete tags error with detailed user-friendly message
          if (errorData.error === 'incomplete_user_tags' && errorData.incompleteTags) {
            const detailedMessage = `Some tags still need to be filled:\n\n${errorData.unfilledSummary}\n\n${errorData.instructions || 'Please click on each unfilled tag to auto-fill it with your profile data.'}`;
            
            const customError = new Error(detailedMessage);
            customError.name = 'IncompleteTagsError';
            (customError as any).unfilledTags = errorData.incompleteTags;
            (customError as any).unfilledSummary = errorData.unfilledSummary;
            throw customError;
          }
          
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

  // Bulk fill handler for filling all user's assigned tags
  const handleBulkFillTags = useCallback(async () => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      
      // Get current user's unfilled tags
      const { tags } = useEditorStore.getState();
      const unfilledTags = tags.filter(tag => 
        tag.assignedUserId?.toString() === currentUserId && 
        !tag.isCompleted &&
        ['A', 'I', 'N', 'X', 'D', 'O', 'S'].includes(tag.tagType) // Only auto-fillable tag types
      );
      
      if (unfilledTags.length === 0) {
        toast({
          title: "No tags to fill",
          description: "All your assigned tags are already completed"
        });
        return;
      }
      
      toast({
        title: "Filling tags...",
        description: `Auto-filling ${unfilledTags.length} tag(s)...`
      });
      
      // Fill each tag sequentially to avoid overwhelming the server
      let filledCount = 0;
      let errorCount = 0;
      
      for (const tag of unfilledTags) {
        try {
          const response = await authenticatedFetch(`/api/editor/session/${sessionId}/tag/${tag.id}/fill`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            filledCount++;
          } else {
            errorCount++;
            console.warn(`Failed to fill tag ${tag.id}:`, await response.text());
          }
        } catch (error) {
          errorCount++;
          console.error(`Error filling tag ${tag.id}:`, error);
        }
        
        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (filledCount > 0) {
        toast({
          title: "Tags filled successfully",
          description: `${filledCount} tag(s) filled${errorCount > 0 ? `, ${errorCount} failed` : ''}`
        });
      } else if (errorCount > 0) {
        toast({
          title: "Failed to fill tags",
          description: "Some tags could not be auto-filled. Please try filling them individually.",
          variant: "destructive"
        });
      }
      
    } catch (error: any) {
      console.error('Bulk fill error:', error);
      toast({
        title: "Error",
        description: "Failed to fill tags. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, currentUserId, sessionId, toast]);

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
        if (error?.name === 'IncompleteTagsError') {
          // Special handling for incomplete tags - show detailed alert instead of toast
          setUnfilledTagsError({
            unfilledTags: error.unfilledTags || [],
            message: error.message
          });
          setIsLoading(false); // Don't show toast for this error
          return;
        } else if (error?.message?.includes('Connection lost') || error?.message?.includes('longer than expected')) {
          errorMessage = error.message + ' Please refresh the page to check the session status.';
        } else if (error?.message?.includes('tags haven\'t been filled')) {
          // Fallback for incomplete tags messages without detailed info
          errorMessage = error.message + '\n\nTip: Click on the orange pulsing tags to fill them automatically, or use the lightning bolt (⚡) button to fill all your tags at once.';
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

  const handleSetActiveUser = useCallback(async (userId: string) => {
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
  }, [isLoading, liveSessionId, sessionId, loadLiveSessionState, toast]);

  const handleSyncUsers = useCallback(async () => {
    if (isLoading || !isNotary) return;
    setIsLoading(true);
    
    try {
      // Send sync command via WebSocket with current page and document info
      if (webSocket.sendMessage) {
        webSocket.sendMessage({
          type: 'sync-users',
          payload: {
            pageNumber: viewer.currentPage || 1,
            documentId: currentDocument?.id,
          },
        });
      }
      
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
  }, [isLoading, isNotary, webSocket, viewer.currentPage, currentDocument?.id, liveSessionId, sessionId, toast]);

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
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => handleSessionAction('start')} 
              size="lg"
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 px-6 py-3 text-base font-semibold"
              disabled={buttonDisabled}
              title={!isWebSocketReady ? 'Waiting for connection...' : 'Start live signing session'}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Starting...</span>
                </div>
              ) : wsConnectionState.isConnecting ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                  <span>Connecting...</span>
                </div>
              ) : !isWebSocketReady ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <span>Not Ready</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  <span>Start Session</span>
                </div>
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
              onClick={handleBulkFillTags}
              size="lg"
              variant="outline"
              className="bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100 px-5 py-3 text-base font-medium"
              disabled={buttonDisabled}
              title="Auto-fill all your assigned tags with profile data"
            >
              <div className="flex items-center gap-2">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                <span>Auto-Fill</span>
              </div>
            </Button>
            
            <Button 
              onClick={() => handleSessionAction('pause')} 
              size="lg"
              variant="outline"
              className="px-5 py-3 text-base font-medium"
              disabled={buttonDisabled}
            >
              <div className="flex items-center gap-2">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Pause className="h-5 w-5" />}
                <span>Pause</span>
              </div>
            </Button>
            
            <Button 
              onClick={() => handleSessionAction('complete')} 
              size="lg"
              className="bg-purple-600 hover:bg-purple-700 px-5 py-3 text-base font-semibold"
              disabled={buttonDisabled}
            >
              <div className="flex items-center gap-2">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                <span>Complete Session</span>
              </div>
            </Button>
          </>
        )}
      </div>
    );
  };

  const memoizedCurrentUser = useMemo(() => {
    const user = participants.find(p => p.userId === currentUserId);
    return {
      id: currentUserId,
      name: user?.displayName || 'Unknown User',
      role: user?.userType || 'signer',
      email: user?.email
    };
  }, [currentUserId, participants]);

  // Memoize video session callbacks to prevent re-renders
  const handleVideoSessionComplete = useCallback(() => {
    console.log('Video session completed');
  }, []);

  const handleVideoSessionError = useCallback((error: any) => {
    console.error('Video session error:', error);
    toast({
      title: "Video Session Error",
      description: "There was an issue with the video session",
      variant: "destructive"
    });
  }, [toast]);

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Simplified Header */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
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

          {/* Document Progress - Inline */}
          <div className="flex items-center gap-3 ml-6">
            <div className="flex-1 max-w-sm">
              <DocumentSelector
                documents={documents}
                currentDocument={currentDocument}
                onDocumentChange={(doc) => {
                  // Handle document change through editor store
                  useEditorStore.getState().setCurrentDocument(doc);
                }}
                tags={useEditorStore.getState().tags}
              />
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>
                {useEditorStore.getState().tags.length} tags • {useEditorStore.getState().tags.filter(t => t.isCompleted).length} completed
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {renderSessionControls()}
          
          <Button
            variant="outline"
            size="default"
            onClick={() => setShowVideo(!showVideo)}
            className="px-3 py-2"
            title="Toggle video panel"
          >
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              <span className="text-sm font-medium">Video</span>
            </div>
          </Button>
          
          <Button
            variant="outline"
            size="default"
            onClick={() => setShowParticipants(!showParticipants)}
            className="px-3 py-2"
            title="Toggle participants panel"
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">Participants</span>
            </div>
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

      {/* Unfilled Tags Alert */}
      {unfilledTagsError && (
        <div className="px-4 py-3 border-b">
          <UnfilledTagsAlert
            unfilledTags={unfilledTagsError.unfilledTags}
            currentUserId={currentUserId}
            onBulkFill={() => {
              setUnfilledTagsError(null); // Close alert first
              handleBulkFillTags();
            }}
            onTagClick={(tagId) => {
              // TODO: Scroll to and highlight the tag
              console.log('Navigate to tag:', tagId);
            }}
            onClose={() => setUnfilledTagsError(null)}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Enhanced Video Panel - Wider for controls */}
        {showVideo && (
          <div className="w-96 bg-gradient-to-b from-gray-50 to-gray-100 border-r border-gray-200 flex-shrink-0 shadow-sm">
            <div className="h-full flex flex-col">

              
              {/* Video Content */}
              <div className="flex-1">
                {videoSessionData && (
                  <NotaryVideoSession
                    key={`video-session-${jobData?.id}`}
                    jobId={jobData?.id?.toString() || '0'}
                    currentUser={memoizedCurrentUser}
                    participants={memoizedParticipants}
                    autoJoin={true}
                    className="h-full"
                    sessionData={videoSessionData}
                    error={videoSessionError}
                    isLoading={isLoading}
                    onSessionComplete={handleVideoSessionComplete}
                    onSessionError={handleVideoSessionError}
                    signingSessionState={liveSession.state}
                  />
                )}
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