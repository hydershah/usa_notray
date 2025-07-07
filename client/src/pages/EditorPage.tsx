import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { PDFTaggingEditor } from '@/components/editor';
import { LiveSigningInterface } from '@/components/editor/LiveSigningInterface';
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
        if (user.role !== 'admin' && user.role !== 'notary' && 
            job.selectedNotary !== user.id.toString()) {
          throw new Error('You do not have permission to access this editor session');
        }

        // For signing mode: First try to find existing tagged session, otherwise create new
        let sessionResult;
        
        if (mode === 'signing') {
          // Check for existing tagged session first
          console.log('🔍 Signing mode: Looking for existing tagged session...');
          
          try {
            // Look for existing sessions for this job
            const existingSessionsResponse = await authenticatedFetch(`/api/jobs/${jobId}/sessions`);
            
            if (existingSessionsResponse.ok) {
              const existingSessions = await existingSessionsResponse.json();
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
          } catch (error) {
            console.warn('Failed to check for existing sessions, creating new one:', error);
          }
        }
        
        // If no existing session found (or not signing mode), create new session
        if (!sessionResult) {
          console.log(`🆕 Creating new ${mode} session...`);
          const sessionType = mode === 'signing' ? 'notary' : mode;
          const sessionResponse = await authenticatedFetch(`/api/editor/job/${jobId}/session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sessionType,
              videoSessionId: (mode === 'notary' || mode === 'signing') ? `whereby_${jobId}_${Date.now()}` : undefined
            })
          });

          if (!sessionResponse.ok) {
            throw new Error(`Failed to create session: ${sessionResponse.status}`);
          }

          sessionResult = await sessionResponse.json();
        }
        
        if (!sessionResult.success) {
          throw new Error(sessionResult.message || 'Failed to create session');
        }

        // Get session data with documents and participants using authenticated fetch
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
        console.log('📊 Session data details:', {
          sessionId: data.session.id,
          documentsCount: documentsWithUrls.length,
          participantsCount: data.participants.length
        });
        
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
  const handleSessionComplete = async () => {
    if (!sessionData) return;

    try {
      // Update session status to completed using authenticated fetch
      const response = await authenticatedFetch(`/api/editor/session/${sessionData.session.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'completed',
          completedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to complete session: ${response.status}`);
      }

      toast({
        title: "Session Completed",
        description: `${mode === 'tagging' ? 'Tagging' : mode === 'signing' ? 'Live signing' : 'Notary'} session completed successfully!`
      });

      // Navigate back to job details
      setLocation(`/jobs/${jobId}`);
      
    } catch (error) {
      console.error('Failed to complete session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to complete session. Please try again."
      });
    }
  };

  // Handle tags change (for progress tracking)
  const handleTagsChanged = useCallback((tags: DocumentTag[]) => {
    // Optional: Could send tags to backend for real-time persistence
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
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
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