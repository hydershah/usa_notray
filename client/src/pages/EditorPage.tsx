import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { PDFTaggingEditor } from '@/components/editor';
import { LiveSigningInterface } from '@/components/editor/LiveSigningInterface';
import { DailyVideoConferenceHandles } from '@/components/editor/DailyVideoConference';
import type { 
  SessionDocument, 
  SessionParticipant, 
  DocumentTag,
  EditorSession 
} from '@/types/editor';
import { apiRequest } from '@/lib/api';
import { authenticatedFetch } from '@/lib/auth';

interface EditorPageProps {}

interface JobData {
  id: number;
  title: string;
  titleCompany: string;
  selectedNotary: string;
  signerDetails: string;
  selectedDate: string;
  selectedTime: string;
  jobStatus: string;
}

interface SessionData {
  session: EditorSession;
  documents: SessionDocument[];
  participants: SessionParticipant[];
}

const EditorPage: React.FC<EditorPageProps> = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // Get mode from URL search params
  const searchParams = new URLSearchParams(window.location.search);
  const mode = searchParams.get('mode') as 'tagging' | 'notary' | 'signing' || 'tagging';
  const sessionId = searchParams.get('session'); // For live signing sessions

  // State
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Authentication check - redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log('User not authenticated, redirecting to login');
      window.location.href = '/login?reason=required';
      return;
    }
  }, [isAuthenticated, authLoading]);

  // Load job data to verify access
  const { data: job, isLoading: jobLoading, error: jobError } = useQuery<JobData>({
    queryKey: [`/api/jobs/${jobId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/jobs/${jobId}`);
      return response.json();
    },
    enabled: !!jobId && isAuthenticated
  });

  // Initialize editor session
  useEffect(() => {
    if (!jobId || !user || !job || !isAuthenticated) return;
    
    const initializeSession = async () => {
      try {
        setIsInitializing(true);
        setError(null);

        // Double-check authentication
        if (!localStorage.getItem('token')) {
          throw new Error('Authentication token not found. Please log in again.');
        }

        // Check user permissions
        // Allow admin, notary, assigned notary, or any user with valid session access
        const hasBasicAccess = user.role === 'admin' || 
                              user.role === 'notary' || 
                              job.selectedNotary === user.id.toString();
        
        if (!hasBasicAccess) {
          // If user doesn't have basic access, verify they have session access (includes signers)
          try {
            const sessionAccessResponse = await authenticatedFetch(`/api/jobs/${jobId}/session-access`);
            if (!sessionAccessResponse.ok) {
              throw new Error('You do not have permission to access this editor session');
            }
            const sessionAccessData = await sessionAccessResponse.json();
            if (!sessionAccessData.hasAccess) {
              throw new Error('You do not have permission to access this editor session');
            }
            console.log('✅ Session access verified for user via API check');
          } catch (accessError) {
            throw new Error('You do not have permission to access this editor session');
          }
        }

        // For signing mode: Use the job ID to find or create session
        let sessionResult;
        
        if (mode === 'signing') {
          console.log('🔍 Signing mode: Looking for existing session for job:', jobId);
          
          // First check if there's a session ID in the URL
          if (sessionId && sessionId !== jobId) {
            console.log('🔍 Checking specific session ID:', sessionId);
            try {
              const sessionResponse = await authenticatedFetch(`/api/editor/session/${sessionId}`);
              if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json();
                console.log('✅ Found existing session:', sessionId);
                setSessionData(sessionData);
                setIsInitializing(false);
                return;
              }
            } catch (error) {
              console.warn('Session ID not found, falling back to job-based session');
            }
          }
          
          // Look for existing sessions for this job
          try {
            const existingSessionsResponse = await authenticatedFetch(`/api/jobs/${jobId}/sessions`);
            
            if (existingSessionsResponse.ok) {
              const existingSessions = await existingSessionsResponse.json();
              
              // For signing mode, prioritize session from URL parameter first
              if (mode === 'signing' && sessionId) {
                const specificSession = existingSessions.sessions?.find((s: any) => s.id === sessionId);
                if (specificSession) {
                  console.log('✅ Found specific session from URL parameter:', specificSession.id);
                  sessionResult = {
                    success: true,
                    session: specificSession,
                    message: 'Using specific session from URL parameter'
                  };
                }
              }
              
              // If no specific session found, use the existing logic
              if (!sessionResult) {
                // Look for active live signing session first
                const liveSession = existingSessions.sessions?.find((s: any) => 
                  s.sessionType === 'notary' && s.status === 'active' && s.isLiveSession
                );
                
                if (liveSession) {
                  console.log('✅ Found existing live session:', liveSession.id);
                  sessionResult = {
                    success: true,
                    session: liveSession,
                    message: 'Using existing live session'
                  };
                } else {
                  // Look for completed tagging session to use as base
                  const taggedSession = existingSessions.sessions?.find((s: any) => 
                    s.sessionType === 'tagging' && s.status === 'completed'
                  );
                  
                  if (taggedSession) {
                    console.log('✅ Found existing tagged session:', taggedSession.id);
                    sessionResult = {
                      success: true,
                      session: taggedSession,
                      message: 'Using existing tagged session for signing'
                    };
                  }
                }
              }
            }
          } catch (error) {
            console.warn('Failed to check for existing sessions:', error);
          }
        }
        
        // If no existing session found, create new session
        if (!sessionResult) {
          console.log(`🆕 Creating new ${mode} session for job ${jobId}...`);
          const sessionType = mode === 'signing' ? 'notary' : mode;
          const sessionResponse = await authenticatedFetch(`/api/editor/job/${jobId}/session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sessionType,
              videoSessionId: (mode === 'notary' || mode === 'signing') ? `daily_${jobId}_${Date.now()}` : undefined
            })
          });

          if (!sessionResponse.ok) {
            const errorData = await sessionResponse.json();
            throw new Error(errorData.message || `Failed to create session: ${sessionResponse.status}`);
          }

          sessionResult = await sessionResponse.json();
        }
        
        if (!sessionResult.success) {
          throw new Error(sessionResult.message || 'Failed to initialize session');
        }

        // Get session data with documents and participants
        const dataResponse = await authenticatedFetch(`/api/editor/session/${sessionResult.session.id}`);
        
        if (!dataResponse.ok) {
          throw new Error(`Failed to load session data: ${dataResponse.status}`);
        }
        
        const data: SessionData = await dataResponse.json();

        // Convert documents to include proper URLs
        const documentsWithUrls = data.documents.map(doc => ({
          ...doc,
          fileUrl: doc.fileUrl.startsWith('http') ? doc.fileUrl : `${window.location.origin}${doc.fileUrl}`
        }));

        setSessionData({
          ...data,
          documents: documentsWithUrls
        });

        console.log(`✅ ${mode} session initialized:`, data.session.id);
        
      } catch (error) {
        console.error('Failed to initialize editor session:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize session';
        setError(errorMessage);
        
        toast({
          variant: "destructive",
          title: "Session Error",
          description: errorMessage
        });

        // If it's an authentication error, redirect to login
        if (errorMessage.includes('Authentication') || errorMessage.includes('token')) {
          setTimeout(() => {
            window.location.href = '/login?reason=expired';
          }, 2000);
        }
      } finally {
        setIsInitializing(false);
      }
    };

    initializeSession();
  }, [jobId, user, job, mode, toast, isAuthenticated]);

  // Handle session completion
  const [isCompletingSession, setIsCompletingSession] = useState(false);
  
  const handleSessionComplete = async () => {
    if (!sessionData || isCompletingSession) return;

    try {
      setIsCompletingSession(true);
      console.log('🔄 Session completion callback triggered');
      console.log('🎯 Current jobId for navigation:', jobId);
      console.log('🔍 Session data:', sessionData?.session?.id);
      
      // Small delay to ensure any pending operations complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('🚀 Navigating to job details page...');
      
      // Navigate to job details with success indicator
      if (jobId) {
        const targetUrl = `/jobs/${jobId}?completed=true`;
        console.log('🎯 Navigating to:', targetUrl);
        setLocation(targetUrl);
      } else {
        console.warn('⚠️ No jobId available, navigating to jobs list');
        setLocation('/jobs');
      }
      
    } catch (error) {
      console.error('❌ Error in session completion callback:', error);
      // Still try to navigate even if there's an error
      setLocation('/jobs');
    } finally {
      // Don't reset isCompletingSession here since we're navigating away
      console.log('✅ Session completion callback finished');
    }
  };

  // Handle tags change (for progress tracking)
  const handleTagsChanged = useCallback((tags: DocumentTag[]) => {
    console.log(`Tags updated: ${tags.length} total, ${tags.filter(t => t.isCompleted).length} completed`);
  }, []);

  // Loading states
  if (authLoading || jobLoading || isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            {authLoading ? 'Checking Authentication...' :
             jobLoading ? 'Loading Job Data...' : 'Initializing Editor Session...'}
          </h2>
          <p className="text-gray-600">
            {mode === 'tagging' ? 'Setting up document tagging workspace' : 
             mode === 'signing' ? 'Initializing live signing session' : 
             'Preparing notary session'}
          </p>
        </div>
      </div>
    );
  }

  // Authentication check
  if (!isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md text-center">
          <div className="text-red-500 text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-6">
            Please log in to access the editor session.
          </p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Error states
  if (jobError || error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md text-center">
          <div className="text-red-500 text-6xl mb-4 font-bold">!</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Session Error</h2>
          <p className="text-gray-600 mb-6">
            {error || jobError?.message || 'Failed to load editor session'}
          </p>
          <div className="space-x-3">
            <button
              onClick={() => setLocation(`/jobs/${jobId}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Job
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Missing data states
  if (!sessionData || !job) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-yellow-500 text-6xl mb-4">⏳</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Preparing Session...</h2>
          <p className="text-gray-600">Session data is being prepared</p>
        </div>
      </div>
    );
  }

  // No documents error
  if (sessionData.documents.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md text-center">
          <div className="text-orange-500 text-6xl mb-4">📄</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">No Documents Found</h2>
          <p className="text-gray-600 mb-6">
            This job doesn't have any PDF documents uploaded. Please upload documents before starting the {mode} session.
          </p>
          <button
            onClick={() => setLocation(`/jobs/${jobId}`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Job
          </button>
        </div>
      </div>
    );
  }

  // Render appropriate editor based on mode
  return (
    <div className="h-screen bg-gray-100">
      {mode === 'signing' ? (
        <LiveSigningInterface
          sessionId={sessionData.session.id}
          liveSessionId={sessionId || undefined}
          documents={sessionData.documents}
          participants={sessionData.participants}
          currentUserId={user?.id.toString() || ''}
          jobData={job}
          onSessionComplete={handleSessionComplete}
          onTagsChanged={handleTagsChanged}
        />
      ) : (
        <PDFTaggingEditor
          sessionId={sessionData.session.id}
          mode={mode as 'tagging' | 'notary'}
          documents={sessionData.documents}
          participants={sessionData.participants}
          currentUserId={user?.id.toString() || ''}
          onSessionComplete={handleSessionComplete}
          onTagsChanged={handleTagsChanged}
        />
      )}
    </div>
  );
};

export default EditorPage; 