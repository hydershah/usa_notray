import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { useTagOperations } from '../../hooks/editor/useTagOperations';
import PDFViewer from './PDFViewer';
import TaggingToolbar from './TaggingToolbar';
import HotkeyHandler from './HotkeyHandler';
import VideoIntegration from './VideoIntegration';
import { TagInputModal } from './TagInputModal';
import { ReplaceAllButton } from './ReplaceAllButton';
import { useToast } from '@/hooks/use-toast';
import type { 
  SessionDocument, 
  SessionParticipant, 
  TagCoordinates,
  DocumentTag,
  TagType
} from '../../types/editor';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { HelpCircle } from 'lucide-react';

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
  
  // Interactive tag modal state
  const [selectedTagForInput, setSelectedTagForInput] = useState<DocumentTag | null>(null);
  const [tagModalPosition, setTagModalPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
  
  const { toast } = useToast();

  // Store state
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
      {/* Header - ENHANCED WITH ROLE RESTRICTIONS */}
      <div className="bg-white border-b px-6 py-4 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-semibold text-gray-900">
                  {mode === 'tagging' ? 'Document Tagging' : 
                   mode === 'signing' ? 'Live Signing Session' : 'Live Signing Session'}
                </h1>
                
                {/* ✅ ROLE INDICATOR */}
                {currentUser?.userType === 'signer' && (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                    👤 Signer
                  </Badge>
                )}
                {(currentUser?.userType === 'notary' || currentUser?.role === 'notary') && (
                  <Badge className="bg-red-100 text-red-800 border-red-300">
                    🔐 Notary
                  </Badge>
                )}
                {currentUser?.role === 'admin' && (
                  <Badge className="bg-purple-100 text-purple-800 border-purple-300">
                    ⚙️ Admin
                  </Badge>
                )}
              </div>
              
              <p className="text-sm text-gray-600">
                Session: {sessionId.substring(0, 8)}... • {tags.length} tags placed
                {mode === 'signing' && (
                  <span className="ml-2 text-blue-600 font-medium">
                    • {tags.filter(t => t.isCompleted).length} completed
                  </span>
                )}
                {tags.length > 0 && mode === 'tagging' && (
                  <span className="ml-2 text-green-600 font-medium">
                    (Continue editing previous work)
                  </span>
                )}
              </p>
              
              {/* ✅ SIGNER STATUS INDICATOR */}
              {currentUser?.userType === 'signer' && mode === 'signing' && (
                <div className="mt-2 flex items-center gap-2">
                  {liveSessionState && liveSessionState.activeUserId === currentUserId ? (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-700 font-medium">Active - You can fill tags</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1 bg-yellow-50 border border-yellow-200 rounded-full">
                      <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm text-yellow-700 font-medium">Waiting for notary activation</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Action buttons and status - RESTRICTED FOR SIGNERS */}
          <div className="flex items-center space-x-4">
            {/* ❌ SIGNERS CANNOT SEE REPLACE ALL BUTTON */}
            {mode === 'signing' && (currentUser?.userType === 'notary' || currentUser?.role === 'admin') && (
              <ReplaceAllButton
                sessionId={sessionId}
                tags={tags}
                participants={participants}
                currentUserId={currentUserId}
                isNotary={participants.find(p => p.userId === currentUserId)?.userType === 'notary'}
                onTagsUpdated={setTags}
              />
            )}
            
            {/* ❌ SIGNERS CANNOT SEE TAGGING CONTROLS */}
            {mode === 'tagging' && (currentUser?.userType !== 'signer') && (
              <div className="flex items-center space-x-3">
                {isProcessing && (
                  <div className="flex items-center text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    <span className="text-sm">Saving...</span>
                  </div>
                )}
                
                {/* Complete Tagging Button - MOVED TO LEFT OF PARTICIPANTS */}
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
                              console.log('✅ Session force completed successfully');
                              handleSessionComplete();
                            }
                          }
                        } else {
                          alert(result.message || 'Failed to complete session');
                        }
                      } else {
                        console.log('✅ Session completed successfully');
                        handleSessionComplete();
                      }
                    } catch (error) {
                      console.error('❌ Failed to complete session:', error);
                      alert('Failed to complete session');
                    }
                  }}
                  className={`
                    px-3 py-2 rounded-lg font-medium transition-colors text-sm mr-3
                    ${tags.length === 0
                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                      : 'bg-green-600 text-white hover:bg-green-700'
                    }
                  `}
                >
                  {tags.length === 0 ? 'Complete Without Tags' : 'Complete Tagging'}
                </button>
                
                <div className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
                  📊 {participants.length} participants
                </div>
                
                {/* Complete Tagging Button is now in TaggingToolbar.tsx - this was just a dummy */}
              </div>
            )}
            
            {/* ✅ SIGNER HELP BUTTON */}
            {currentUser?.userType === 'signer' && mode === 'signing' && (
              <div className="flex items-center space-x-3">
                <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg">
                  📋 {tags.filter(t => t.assignedUserId === currentUserId).length} tags assigned to you
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toast({
                      title: "Signer Help",
                      description: "Wait for the notary to activate you, then click on blue tags assigned to you to fill them out.",
                    });
                  }}
                >
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Help
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Video (only in notary mode, not signing mode) */}
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
            onTagClick={mode === 'signing' ? handleTagClick : undefined}
            tags={tags.filter(tag => tag.documentId === currentDocument.id)}
            mode={mode === 'notary' ? 'tagging' : mode as 'tagging' | 'signing'}
            selectedUser={selectedUser}
            onTagUpdate={updateTagPosition}
            onTagResize={saveTagUpdate}
            onTagDelete={deleteTag}
            liveSessionState={liveSessionState}
            onSetActiveUser={onSetActiveUser}
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

      {/* Keyboard shortcuts handler - enabled for both tagging and signing modes */}
      <HotkeyHandler
        onUserSwitch={handleUserSwitch}
        onTagTypeSelect={handleTagTypeSelect}
        enabled={mode === 'tagging' || mode === 'signing'}
      />
    </div>
  );
};