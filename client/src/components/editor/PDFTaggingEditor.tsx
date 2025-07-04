import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { useTagOperations } from '../../hooks/editor/useTagOperations';
import PDFViewer from './PDFViewer';
import TaggingToolbar from './TaggingToolbar';
import HotkeyHandler from './HotkeyHandler';
import VideoIntegration from './VideoIntegration';
import type { 
  SessionDocument, 
  SessionParticipant, 
  TagCoordinates,
  DocumentTag,
  TagType
} from '../../types/editor';

interface PDFTaggingEditorProps {
  sessionId: string;
  mode: 'tagging' | 'notary';
  documents: SessionDocument[];
  participants: SessionParticipant[];
  currentUserId: string;
  onSessionComplete?: () => void;
  onTagsChanged?: (tags: DocumentTag[]) => void;
}

export const PDFTaggingEditor: React.FC<PDFTaggingEditorProps> = ({
  sessionId,
  mode,
  documents,
  participants,
  currentUserId,
  onSessionComplete,
  onTagsChanged
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Store state
  const {
    session,
    currentDocument,
    selectedUser,
    selectedTagType,
    tags,
    viewer,
    setSession,
    setDocuments,
    setCurrentDocument,
    setParticipants,
    setCurrentUser,
    setSelectedUser,
    setMode,
    setTags
  } = useEditorStore();

  // Tag operations with batching and debouncing
  const {
    placeTag,
    updateTagPosition,
    updateTagSize,
    saveTagUpdate,
    deleteTag,
    batchSaveChanges,
    isProcessing
  } = useTagOperations(sessionId);

  // Initialize session on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Set basic session data
        setSession({
          id: sessionId,
          jobId: '',
          notaryId: '',
          status: 'active',
          sessionType: mode,
          createdAt: new Date()
        });

        setDocuments(documents);
        setParticipants(participants);
        
        if (documents.length > 0) {
          setCurrentDocument(documents[0]);
        }

        // Set current user
        const currentParticipant = participants.find(p => p.userId === currentUserId);
        if (currentParticipant) {
          setCurrentUser(currentParticipant);
          setSelectedUser(currentParticipant);
        }

        // Set mode configuration
        setMode({
          mode: mode,
          canPlaceTags: mode === 'tagging',
          canModifyContent: mode === 'notary',
          showPlaceholders: mode === 'tagging'
        });

        // Load existing tags
        console.log(`🔍 Loading existing tags for session: ${sessionId}`);
        const response = await fetch(`/api/editor/session/${sessionId}/tags?t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });

        if (response.ok) {
          const { tags: existingTags } = await response.json();
          console.log(`✅ Loaded ${existingTags.length} existing tags:`, existingTags);
          
          // Filter out any temporary tags that might have persisted
          const validTags = existingTags.filter((tag: any) => {
            if (tag.id && tag.id.toString().startsWith('temp_')) {
              console.warn('Filtering out temporary tag:', tag.id);
              return false;
            }
            return true;
          });
          
          setTags(validTags);
          
          if (validTags.length > 0) {
            console.log(`🏷️  Tags loaded successfully - session appears to be a continuation of previous work`);
          } else {
            console.log(`📝 No existing tags found - starting fresh tagging session`);
          }
        } else {
          console.error(`❌ Failed to load existing tags:`, response.status, response.statusText);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize session:', err);
        setError('Failed to load session. Please try again.');
        setIsLoading(false);
      }
    };

    if (sessionId) {
      initializeSession();
    }
  }, [sessionId, mode, documents, participants, currentUserId]);

  // Handle tag placement from PDF click
  const handleTagPlacement = useCallback(async (coordinates: TagCoordinates) => {
    console.log('🔍 Tag placement triggered with:', {
      selectedTagType,
      selectedUser: selectedUser?.displayName,
      currentDocument: currentDocument?.fileName,
      coordinates
    });
    
    if (!selectedTagType || !selectedUser || !currentDocument) {
      console.log('❌ Cannot place tag: missing requirements', {
        selectedTagType: !!selectedTagType,
        selectedUser: !!selectedUser,
        currentDocument: !!currentDocument
      });
      return;
    }

    try {
      console.log('📍 Placing tag...');
      await placeTag({
        documentId: currentDocument.id,
        tagType: selectedTagType,
        coordinates,
        assignedUserId: selectedUser.userId
      });
      console.log('✅ Tag placed successfully!');
    } catch (error) {
      console.error('❌ Failed to place tag:', error);
      setError('Failed to place tag. Please try again.');
    }
  }, [selectedTagType, selectedUser, currentDocument, placeTag]);

  // Handle user switching via hotkeys
  const handleUserSwitch = useCallback((userIndex: number) => {
    if (userIndex === 0) {
      // Backtick = notary
      const notary = participants.find(p => p.userType === 'notary');
      if (notary) {
        setSelectedUser(notary);
        console.log('🔄 Switched to notary:', notary.displayName);
      }
    } else if (userIndex <= participants.length) {
      // 1-9 = signers
      const signers = participants.filter(p => p.userType === 'signer');
      if (signers[userIndex - 1]) {
        setSelectedUser(signers[userIndex - 1]);
        console.log('🔄 Switched to signer:', signers[userIndex - 1].displayName);
      }
    }
  }, [participants, setSelectedUser]);

  // Handle tag type selection via hotkeys
  const handleTagTypeSelect = useCallback((tagType: TagType) => {
    useEditorStore.getState().setSelectedTagType(tagType);
  }, []);

  // Handle document switching
  const handleDocumentSwitch = useCallback((document: SessionDocument) => {
    setCurrentDocument(document);
  }, [setCurrentDocument]);

  // Handle session completion
  const handleSessionComplete = useCallback(async () => {
    try {
      console.log('📋 Session completion initiated...');
      
      // First, save any pending changes
      await batchSaveChanges();
      console.log('💾 Pending changes saved');
      
      // The actual completion is now handled by the TaggingToolbar
      // which calls the /api/editor/session/:sessionId/complete endpoint
      // When that succeeds, it will call onSessionComplete
      
      // Show success message or redirect
      if (onSessionComplete) {
        console.log('🎉 Calling parent completion handler');
        onSessionComplete();
      } else {
        // Default behavior: redirect to job details or dashboard
        console.log('🏠 No completion handler, redirecting to dashboard');
        window.location.href = '/dashboard';
      }
      
    } catch (error) {
      console.error('❌ Failed to complete session:', error);
      setError('Failed to save changes before completion. Please try again.');
    }
  }, [batchSaveChanges, onSessionComplete]);

  // Notify parent of tag changes
  useEffect(() => {
    if (onTagsChanged) {
      onTagsChanged(tags);
    }
  }, [tags, onTagsChanged]);

  // Handle loading and error states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tagging session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Session Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!currentDocument) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600">No document selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {mode === 'tagging' ? 'Document Tagging' : 'Live Signing Session'}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Session: {sessionId.substring(0, 8)}... • {tags.length} tags placed
              {tags.length > 0 && (
                <span className="ml-2 text-green-600 font-medium">
                  (Continue editing previous work)
                </span>
              )}
            </p>
          </div>
          
          {/* Action buttons and status */}
          <div className="flex items-center space-x-4">
            {mode === 'tagging' && (
              <div className="flex items-center space-x-3">
                {isProcessing && (
                  <div className="flex items-center text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    <span className="text-sm">Saving...</span>
                  </div>
                )}
                
                <div className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
                  📊 {participants.length} participants
                </div>
                
                {/* Complete Tagging Button */}
                <button
                  onClick={handleSessionComplete}
                  disabled={tags.length === 0}
                  className={`
                    px-6 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center space-x-2 border
                    ${tags.length === 0 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' 
                      : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-lg hover:shadow-xl border-green-600 hover:border-green-700 transform hover:scale-105'
                    }
                  `}
                  title={tags.length === 0 ? 'Place at least one tag before completing' : 'Complete the tagging session. You can continue editing by clicking Start Tagging again.'}
                >
                  <span>✅</span>
                  <span>Complete Tagging</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Video (only in live signing mode) */}
        {mode === 'notary' && (
          <div className="w-80 bg-black border-r">
            <VideoIntegration
              sessionId={sessionId}
              mode={mode}
              autoStart={true}
              className="h-full"
            />
          </div>
        )}

        {/* Center Column - PDF Viewer */}
        <div className="flex-1 relative bg-white">
          <PDFViewer
            documentUrl={currentDocument.fileUrl}
            onCoordinateClick={handleTagPlacement}
            tags={tags.filter(tag => tag.documentId === currentDocument.id)}
            mode={mode}
            selectedUser={selectedUser}
            onTagUpdate={updateTagPosition}
            onTagResize={saveTagUpdate}
            onTagDelete={deleteTag}
          />
        </div>

        {/* Right Column - Controls & Tools */}
        <div className="w-80 bg-gray-50 border-l border-gray-200">
          <div className="h-full p-6">
            <TaggingToolbar
              participants={participants}
              sessionId={sessionId}
              mode={mode}
              onDocumentSwitch={handleDocumentSwitch}
              onSessionComplete={handleSessionComplete}
              className="h-full"
            />
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts handler */}
      <HotkeyHandler
        onUserSwitch={handleUserSwitch}
        onTagTypeSelect={handleTagTypeSelect}
        enabled={mode === 'tagging'}
      />
    </div>
  );
};

export default PDFTaggingEditor; 