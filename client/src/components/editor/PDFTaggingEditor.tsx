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
  mode: 'tagging' | 'live_signing';
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
          canModifyContent: mode === 'live_signing',
          showPlaceholders: mode === 'tagging'
        });

        // Load existing tags
        const response = await fetch(`/api/editor/session/${sessionId}/tags`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (response.ok) {
          const { tags: existingTags } = await response.json();
          setTags(existingTags);
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
      const notary = participants.find(p => p.role === 'notary');
      if (notary) setSelectedUser(notary);
    } else if (userIndex <= participants.length) {
      // 1-9 = signers
      const signers = participants.filter(p => p.role === 'signer');
      if (signers[userIndex - 1]) {
        setSelectedUser(signers[userIndex - 1]);
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
      await batchSaveChanges();
      onSessionComplete?.();
    } catch (error) {
      console.error('Failed to complete session:', error);
      setError('Failed to save changes. Please try again.');
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
      <div className="bg-white border-b px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">
              {mode === 'tagging' ? 'Document Tagging' : 'Live Signing Session'}
            </h1>
            <p className="text-sm text-gray-500">
              Session: {sessionId.substring(0, 8)}...
            </p>
          </div>
          
          {/* Status indicators */}
          <div className="flex items-center space-x-4">
            {isProcessing && (
              <div className="flex items-center text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm">Saving...</span>
              </div>
            )}
            
            {mode === 'tagging' && (
              <div className="text-sm text-green-600">
                ✅ {tags.length} tags placed
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Video (only in live signing mode) */}
        {mode === 'live_signing' && (
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
        <div className="flex-1 relative bg-gray-100">
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
        <div className="w-80 bg-white border-l">
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