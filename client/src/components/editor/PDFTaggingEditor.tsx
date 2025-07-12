import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { useTagOperations } from '../../hooks/editor/useTagOperations';
import { useStreamlinedTextInputs } from '../../hooks/editor/useStreamlinedTextInputs';
import PDFViewer from './PDFViewer';
import TaggingToolbar from './TaggingToolbar';
import HotkeyHandler from './HotkeyHandler';
import { TagInputModal } from './TagInputModal';
import { StreamlinedTextLayer } from './StreamlinedTextLayer';
import { useToast } from '@/hooks/use-toast';
import type { 
  SessionDocument, 
  SessionParticipant, 
  TagCoordinates,
  DocumentTag,
  TagType
} from '../../types/editor';
import { Badge } from '../ui/badge';

interface PDFTaggingEditorProps {
  sessionId: string;
  mode: 'tagging' | 'notary' | 'signing';
  documents: SessionDocument[];
  participants: SessionParticipant[];
  currentUserId: string;
  onSessionComplete?: () => void;
  onTagsChanged?: (tags: DocumentTag[]) => void;
  // Live signing specific props
  liveSessionState?: any;
  onSetActiveUser?: (userId: number) => void;
}

export const PDFTaggingEditor: React.FC<PDFTaggingEditorProps> = ({
  sessionId,
  mode,
  documents,
  participants,
  currentUserId,
  onSessionComplete,
  onTagsChanged,
  liveSessionState,
  onSetActiveUser
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track current page canvas for StreamlinedTextLayer
  const [currentPageCanvas, setCurrentPageCanvas] = useState<HTMLCanvasElement | null>(null);
  const pdfViewerRef = useRef<any>(null); // Add ref to access PDFViewer internals
  
  // Interactive tag modal state
  const [selectedTagForInput, setSelectedTagForInput] = useState<DocumentTag | null>(null);
  const [tagModalPosition, setTagModalPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
  
  const { toast } = useToast();

  // Tag operations with batching and debouncing
  const {
    placeTag,
    updateTagPosition,
    updateTagSize,
    saveTagUpdate,
    deleteTag,
    batchSaveChanges
  } = useTagOperations(sessionId);

  // Streamlined text inputs for immediate editing
  const {
    textInputs,
    selectedTextInputId,
    placeTextInput,
    saveTextContent,
    updateFontSize,
    deleteTextInput,
    loadTextInputsFromTags,
    selectTextInput
  } = useStreamlinedTextInputs(sessionId);

  // Store state - MOVED UP to fix initialization order
  const {
    session,
    currentDocument,
    selectedUser,
    selectedTagType,
    tags,
    viewer,
    currentUser,
    setSession,
    setDocuments,
    setCurrentDocument,
    setSelectedUser,
    setSelectedTagType,
    setTags,
    setParticipants,
    setCurrentUser,
    setMode
  } = useEditorStore();

  // Handle page load from PDFViewer to get canvas element
  const handlePageLoad = useCallback((pageNumber: number, canvas: HTMLCanvasElement, scaleFactor: number) => {
    console.log(`📄 Canvas updated for page ${pageNumber}:`, canvas);
    
    // Update canvas if this is the current page
    if (pageNumber === (viewer.currentPage || 1)) {
      setCurrentPageCanvas(canvas);
      console.log(`✅ Set current page canvas for page ${pageNumber}`);
    }
    
    // Also store all page canvases for potential fallback (optional enhancement)
  }, [viewer.currentPage]);

  // Update canvas when current page changes - with fallback canvas retrieval
  useEffect(() => {
    const updateCanvasForCurrentPage = () => {
      const currentPage = viewer.currentPage || 1;
      
      // Try to find the canvas element for the current page
      const canvas = document.querySelector(`canvas[data-page-number="${currentPage}"]`) as HTMLCanvasElement;
      
      if (canvas) {
        setCurrentPageCanvas(canvas);
        console.log(`✅ Found canvas for page ${currentPage} via DOM query`);
      } else {
        console.log(`⚠️ Canvas not found for page ${currentPage}, will wait for page load event`);
        // Reset canvas to trigger re-render when it becomes available
        setCurrentPageCanvas(null);
      }
    };
    
    // Update immediately
    updateCanvasForCurrentPage();
    
    // Also update after a small delay to catch late-rendered canvases
    const timer = setTimeout(updateCanvasForCurrentPage, 100);
    
    return () => clearTimeout(timer);
  }, [viewer.currentPage]);

  // Handle global clicks to deselect text inputs
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // Check if the click is outside any text input or control
      const target = e.target as HTMLElement;
      
      // Don't deselect if clicking on StreamlinedTextLayer or its children
      if (target.closest('.streamlined-text-layer')) {
        return;
      }
      
      // Don't deselect if clicking on toolbar or controls
      if (target.closest('.tagging-toolbar') || target.closest('.tag-input-modal')) {
        return;
      }
      
      // Deselect text input
      if (selectedTextInputId) {
        console.log('🎯 Global click detected - deselecting text input');
        selectTextInput(null);
      }
    };
    
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [selectedTextInputId, selectTextInput]);

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
          sessionType: mode === 'signing' ? 'notary' : mode as 'tagging' | 'notary',
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

        // Set mode configuration - PROPER SIGNER RESTRICTIONS
        const isNotary = currentParticipant?.userType === 'notary' || currentParticipant?.role === 'notary';
        const isAdmin = currentParticipant?.role === 'admin';
        
        setMode({
          mode: mode === 'signing' ? 'tagging' : mode as 'tagging' | 'notary',
          canPlaceTags: mode === 'tagging' || (mode === 'signing' && (isNotary || isAdmin)), // ❌ SIGNERS CANNOT PLACE NEW TAGS
          canModifyContent: mode === 'notary' || mode === 'signing',
          showPlaceholders: mode === 'tagging' || mode === 'signing'
        });

        // Load existing tags for all documents in session
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
          
          // Load text tags into streamlined text input system
          loadTextInputsFromTags(validTags);
          
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

  // Load user profiles for content auto-fill
  useEffect(() => {
    const loadUserProfiles = async () => {
      if (mode !== 'signing') return;
      
      try {
        // Note: User profiles are loaded on the backend when needed for content generation
        // We don't need to pre-load them here to avoid permission issues
        console.log('✅ User profiles will be loaded on-demand during content generation');
        
      } catch (error) {
        console.error('Failed to load user profiles:', error);
      }
    };

    loadUserProfiles();
  }, [mode, participants]);

  // Handle tag click in signing mode - FIXED VERSION
  const handleTagClick = useCallback((tag: DocumentTag, position: { x: number; y: number; width: number; height: number }) => {
    if (mode !== 'signing') return;
    
    console.log('🏷️ Tag click in PDFTaggingEditor:', {
      tagId: tag.id,
      tagType: tag.tagType,
      assignedUserId: tag.assignedUserId,
      currentUserId,
      isCompleted: tag.isCompleted
    });
    
    // Check if user can interact with this tag
    const currentParticipant = participants.find(p => p.userId === currentUserId);
    const isNotary = currentParticipant?.userType === 'notary';
    const isAssignedUser = tag.assignedUserId === currentUserId;
    const isUniversalTag = ['T', 'D'].includes(tag.tagType); // Text and Date tags
    
    const canEdit = currentParticipant && (isNotary || isAssignedUser || isUniversalTag);

    console.log('🔐 Permission check result:', {
      currentParticipant: currentParticipant?.displayName,
      isNotary,
      isAssignedUser,
      isUniversalTag,
      canEdit
    });

    if (!canEdit) {
      let errorMessage = "You cannot edit this tag.";
      
      if (!currentParticipant) {
        errorMessage = "User session not found. Please refresh the page.";
      } else if (!isNotary && !isAssignedUser && !isUniversalTag) {
        errorMessage = `This ${tag.tagType} tag is assigned to another participant. Only the notary and assigned user can edit it.`;
      }
      
      toast({
        title: "Cannot Edit Tag",
        description: errorMessage,
        variant: "destructive"
      });
      return;
    }

    // Check if user is active in live session
    if (liveSessionState && liveSessionState.state === 'active') {
      const isActiveUser = liveSessionState.activeUserId === currentUserId || 
                          liveSessionState.activeUserId?.toString() === currentUserId?.toString();
      
      if (!isActiveUser && !isNotary) {
        toast({
          title: "Cannot Edit Tag", 
          description: "You are not the active user. Ask the notary to activate you.",
          variant: "destructive"
        });
        return;
      }
    }

    console.log('✅ All permission checks passed, opening tag editor');
    setSelectedTagForInput(tag);
    setTagModalPosition(position);
  }, [mode, participants, currentUserId, liveSessionState, toast]);

  // Handle tag content save
  const handleTagContentSave = useCallback(async (content: any) => {
    if (!selectedTagForInput) return;

    try {
      const response = await fetch(`/api/editor/session/${sessionId}/tag/${selectedTagForInput.id}/content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content,
          completedBy: currentUserId,
          completedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save tag content');
      }

      // Update local state
      const updatedTags = tags.map(tag =>
        tag.id === selectedTagForInput.id
          ? { ...tag, isCompleted: true, contentData: content }
          : tag
      );
      setTags(updatedTags);

      toast({
        title: "Tag Completed",
        description: "Content saved successfully.",
      });

      setSelectedTagForInput(null);
      setTagModalPosition(null);

    } catch (error) {
      console.error('Failed to save tag content:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save tag content. Please try again.",
        variant: "destructive"
      });
    }
  }, [selectedTagForInput, sessionId, currentUserId, tags, setTags, toast]);

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
      
      // Provide helpful error message to user
      let errorMessage = 'Cannot place tag: ';
      const missing = [];
      if (!selectedTagType) missing.push('Please select a tag type first');
      if (!selectedUser) missing.push('Please select a user');
      if (!currentDocument) missing.push('No document loaded');
      
      if (missing.length > 0) {
        setError(errorMessage + missing.join(', '));
        setTimeout(() => setError(null), 3000); // Clear error after 3 seconds
      }
      
      return;
    }

    try {
      // Check if this is a text tag - use streamlined text input system
      if (selectedTagType === 'T') {
        console.log('📝 Placing streamlined text input...');
        console.log('Current text inputs before placement:', textInputs);
        
        const newTextInputId = await placeTextInput({
          documentId: currentDocument.id,
          coordinates,
          assignedUserId: selectedUser.userId
        }, selectedUser.colorCode || '#4ECDC4');
        
        console.log('✅ Streamlined text input placed successfully! ID:', newTextInputId);
        console.log('Text inputs after placement:', textInputs);
        
        // Force a re-render by updating the canvas
        setTimeout(() => {
          const currentPage = viewer.currentPage || 1;
          const canvas = document.querySelector(`canvas[data-page-number="${currentPage}"]`) as HTMLCanvasElement;
          if (canvas) {
            setCurrentPageCanvas(null);
            setTimeout(() => setCurrentPageCanvas(canvas), 10);
          }
        }, 100);
      } else {
        console.log('📍 Placing regular tag...');
        console.log('🔍 DEBUG: Tag placement data:', {
          documentId: currentDocument.id,
          tagType: selectedTagType,
          coordinates,
          assignedUserId: selectedUser.userId
        });
        
        console.log('🔍 DEBUG: Store state before placement:', {
          tagsCount: tags.length,
          tags: tags.map(t => ({ id: t.id, type: t.tagType }))
        });
        
        await placeTag({
          documentId: currentDocument.id,
          tagType: selectedTagType,
          coordinates,
          assignedUserId: selectedUser.userId
        });
        
        console.log('✅ Tag placed successfully!');
        
        // Check store state after placement
        setTimeout(() => {
          const newTags = useEditorStore.getState().tags;
          console.log('🔍 DEBUG: Store state after placement:', {
            tagsCount: newTags.length,
            tags: newTags.map(t => ({ id: t.id, type: t.tagType }))
          });
        }, 100);
      }
    } catch (error) {
      console.error('❌ Failed to place tag:', error);
      setError('Failed to place tag. Please try again.');
      
      // Show more detailed error message
      toast({
        variant: "destructive",
        title: "Tag Placement Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }, [selectedTagType, selectedUser, currentDocument, placeTag, placeTextInput, textInputs, viewer.currentPage, setCurrentPageCanvas, tags, toast]);

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
      {/* Simplified Header */}
      <div className="bg-white border-b px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-900">
              {mode === 'tagging' ? 'Document Tagging' : 'Live Signing Session'}
            </h1>
            <span className="text-sm text-gray-500">
              {tags.length} tags • {tags.filter(t => t.isCompleted).length} completed
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Role Badge */}
            {currentUser?.userType === 'notary' && (
              <Badge className="bg-red-100 text-red-800 border-red-300">
                Notary
              </Badge>
            )}
            {currentUser?.userType === 'signer' && (
              <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                Signer
              </Badge>
            )}
            
            {/* Complete Button for Tagging Mode */}
            {mode === 'tagging' && (
              <button
                onClick={async () => {
                  if (!sessionId) return;
                  
                  try {
                    const response = await fetch(`/api/editor/session/${sessionId}/complete`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                      },
                      body: JSON.stringify({ force: false })
                    });
                    
                    const result = await response.json();
                    
                    if (!response.ok) {
                      if (result.canForce) {
                        const forceComplete = window.confirm(result.message + '\n\nDo you want to complete anyway?');
                        if (forceComplete) {
                          const forceResponse = await fetch(`/api/editor/session/${sessionId}/complete`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${localStorage.getItem('token')}`
                            },
                            body: JSON.stringify({ force: true })
                          });
                          
                          if (forceResponse.ok) {
                            handleSessionComplete();
                          }
                        }
                      } else {
                        alert(result.message || 'Failed to complete session');
                      }
                    } else {
                      handleSessionComplete();
                    }
                  } catch (error) {
                    console.error('❌ Failed to complete session:', error);
                    alert('Failed to complete session');
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                Complete Tagging
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content - Two column layout (no video) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center Column - PDF Viewer (expanded) */}
        <div className="flex-1 relative bg-white" ref={containerRef}>
          <PDFViewer
            documentUrl={currentDocument.fileUrl}
            onCoordinateClick={handleTagPlacement}
            onTagClick={mode === 'signing' ? handleTagClick : undefined}
            tags={tags.filter(tag => tag.documentId === currentDocument.id && tag.tagType !== 'T')}
            mode={mode === 'notary' ? 'tagging' : mode as 'tagging' | 'signing'}
            selectedUser={selectedUser}
            onTagUpdate={updateTagPosition}
            onTagResize={saveTagUpdate}
            onTagDelete={deleteTag}
            liveSessionState={liveSessionState}
            onSetActiveUser={onSetActiveUser}
            onPageLoad={handlePageLoad}
          />
          
          {/* Streamlined Text Layer - overlays on top of PDF for immediate text editing */}
          <StreamlinedTextLayer
            sessionId={sessionId}
            canvasElement={currentPageCanvas}
            containerRef={containerRef}
            scaleFactor={viewer.zoomLevel || 1}
            pageNumber={viewer.currentPage || 1}
            textInputs={textInputs}
            selectedTextInputId={selectedTextInputId}
            onTextInputSelect={selectTextInput}
            onSaveContent={saveTextContent}
            onDeleteTextInput={deleteTextInput}
            debug={true} // Add debug mode
          />
        </div>

        {/* Right Column - Simplified Controls */}
        <div className="w-80 bg-white border-l border-gray-200">
          <div className="h-full">
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

      {/* Interactive Tag Input Modal */}
      {selectedTagForInput && tagModalPosition && (
        <TagInputModal
          tag={selectedTagForInput}
          isOpen={true}
          onClose={() => {
            setSelectedTagForInput(null);
            setTagModalPosition(null);
          }}
          onSave={handleTagContentSave}
          userProfile={userProfiles[selectedTagForInput.assignedUserId || currentUserId]}
          position={tagModalPosition}
        />
      )}

      {/* Keyboard shortcuts handler */}
      <HotkeyHandler
        onUserSwitch={handleUserSwitch}
        onTagTypeSelect={handleTagTypeSelect}
        enabled={mode === 'tagging' || mode === 'signing'}
      />
    </div>
  );
};