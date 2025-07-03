import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { PDFTaggingEditor } from '@/components/editor';
import type { 
  SessionDocument, 
  SessionParticipant, 
  DocumentTag,
  EditorSession 
} from '@/types/editor';
import { apiRequest } from '@/lib/api';

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
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Get mode from URL search params
  const searchParams = new URLSearchParams(window.location.search);
  const mode = searchParams.get('mode') as 'tagging' | 'signing' || 'tagging';
  
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load job data to verify access
  const { data: job, isLoading: jobLoading, error: jobError } = useQuery<JobData>({
    queryKey: [`/api/jobs/${jobId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/jobs/${jobId}`);
      return response.json();
    },
    enabled: !!jobId
  });

  // Initialize editor session
  useEffect(() => {
    if (!jobId || !user || !job) return;
    
    const initializeSession = async () => {
      try {
        setIsInitializing(true);
        setError(null);

        // Check user permissions
        if (user.role !== 'admin' && user.role !== 'notary' && 
            job.selectedNotary !== user.id.toString()) {
          throw new Error('You do not have permission to access this editor session');
        }

        // Create or get editor session
        const sessionResponse = await apiRequest("POST", `/api/editor/job/${jobId}/session`, {
          sessionType: mode,
          videoSessionId: mode === 'signing' ? `whereby_${jobId}_${Date.now()}` : undefined
        });

        const sessionResult = await sessionResponse.json();
        
        if (!sessionResult.success) {
          throw new Error(sessionResult.message || 'Failed to create session');
        }

        // Get session data with documents and participants
        const dataResponse = await apiRequest("GET", `/api/editor/session/${sessionResult.session.id}`);
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
      } finally {
        setIsInitializing(false);
      }
    };

    initializeSession();
  }, [jobId, user, job, mode, toast]);

  // Handle session completion
  const handleSessionComplete = async () => {
    if (!sessionData) return;

    try {
      // Update session status to completed
      await apiRequest("PUT", `/api/editor/session/${sessionData.session.id}/status`, {
        status: 'completed',
        completedAt: new Date().toISOString()
      });

      toast({
        title: "Session Completed",
        description: `${mode === 'tagging' ? 'Tagging' : 'Signing'} session completed successfully!`
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
  const handleTagsChanged = (tags: DocumentTag[]) => {
    // Optional: Could send tags to backend for real-time persistence
    console.log(`Tags updated: ${tags.length} total, ${tags.filter(t => t.isCompleted).length} completed`);
  };

  // Loading states
  if (jobLoading || isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            {jobLoading ? 'Loading Job Data...' : 'Initializing Editor Session...'}
          </h2>
          <p className="text-gray-600">
            {mode === 'tagging' ? 'Setting up document tagging workspace' : 'Preparing live signing session'}
          </p>
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

  // Render PDF Editor
  return (
    <div className="h-screen bg-gray-100">
      <PDFTaggingEditor
        sessionId={sessionData.session.id}
        mode={mode}
        documents={sessionData.documents}
        participants={sessionData.participants}
        currentUserId={user.id.toString()}
        onSessionComplete={handleSessionComplete}
        onTagsChanged={handleTagsChanged}
      />
    </div>
  );
};

export default EditorPage; 