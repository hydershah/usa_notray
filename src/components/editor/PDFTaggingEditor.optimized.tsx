// EXAMPLE: How to integrate the optimized system into your existing PDFTaggingEditor
// This shows the key changes needed to eliminate laggy API calls

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { PDFViewer } from './PDFViewer';
import { TaggingToolbar } from './TaggingToolbar';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { useOptimizedPDFEditor } from '../../hooks/editor/useOptimizedPDFEditor'; // NEW
import OptimizedTagRenderer from './OptimizedTagRenderer'; // NEW
import { HotkeyHandler } from './HotkeyHandler';
import { TagInputModal } from './TagInputModal';
import { SealConfigDialog } from './SealConfigDialog';
import { Badge } from '../ui/badge';
import { TAG_TYPE_CONFIG } from '../../lib/constants/tagConstants';
import { useToast } from '@/hooks/use-toast';
import { getTagDimensions } from '@/lib/constants/tagConstants';
import type { 
  EditorSession, 
  SessionDocument, 
  SessionParticipant,
  DocumentTag,
  TagType,
  TagCoordinates
} from '@/types/editor';

interface PDFTaggingEditorProps {
  sessionId: string;
  mode: 'tagging' | 'notary' | 'signing';
  documents: SessionDocument[];
  participants: SessionParticipant[];
  currentUserId: string;
  onSessionComplete?: () => void;
  onTagsChanged?: (tags: DocumentTag[]) => void;
  // ... other existing props
}

export const PDFTaggingEditorOptimized: React.FC<PDFTaggingEditorProps> = ({
  sessionId,
  mode,
  documents,
  participants,
  currentUserId,
  onSessionComplete,
  onTagsChanged,
  // ... other props
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Tag modal state (existing)
  const [selectedTagForInput, setSelectedTagForInput] = useState<DocumentTag | null>(null);
  const [tagModalPosition, setTagModalPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
  
  // Seal configuration dialog state (existing)
  const [showSealDialog, setShowSealDialog] = useState(false);
  const [selectedSealTag, setSelectedSealTag] = useState<DocumentTag | null>(null);
  const [sealDialogLoading, setSealDialogLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  
  const { toast } = useToast();

  // ✅ NEW: Replace multiple hooks with single optimized hook
  const optimizedEditor = useOptimizedPDFEditor({
    sessionId,
    currentUserId,
    mode
  });

  // ✅ REMOVED: Old tag operations hooks (useTagOperations, useStreamlinedTextInputs, etc.)
  // ✅ REMOVED: useWebSocket hook - now integrated into optimizedEditor

  // Store state (existing)
  const {
    session,
    currentDocument,
    selectedUser,
    selectedTag,
    selectedTagType,
    tags,
    viewer,
    currentUser,
    setSession,
    setDocuments,
    setCurrentDocument,
    switchToDocument,
    setSelectedUser,
    setSelectedTagType,
    setTags,
    setParticipants,
    setCurrentUser,
    setMode,
    setZoomLevel,
    getCurrentDocumentTags,
    getDocumentTags,
    loadTagsForDocument,
    getTagDimensions,
    selectTag
  } = useEditorStore();

  // ✅ NEW: Optimized tag placement - no immediate API calls
  const handleTagPlacement = useCallback(async (coordinates: TagCoordinates) => {
    console.log('🎯 Optimized tag placement:', coordinates);
    
    if (!selectedTagType || !selectedUser || !currentDocument) {
      console.error('❌ Missing required data for tag placement');
      return;
    }

    try {
      // Create tag using optimized system (local state + WebSocket + batched persistence)
      const newTag = await optimizedEditor.handleTagCreation({
        documentId: currentDocument.id,
        tagType: selectedTagType,
        coordinates,
        assignedUserId: selectedUser.userId,
        sessionId,
        displayLabel: `${TAG_TYPE_CONFIG[selectedTagType]?.label} - ${selectedUser.displayName}`,
        colorCode: selectedUser.colorCode
      });
      
      console.log('✅ Tag created with optimized system:', newTag.id);
      
      // Auto-switch back to pointer mode
      setSelectedTagType(null);
      
    } catch (error) {
      console.error('❌ Failed to place tag:', error);
      toast({
        variant: "destructive",
        title: "Tag Placement Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }, [selectedTagType, selectedUser, currentDocument, optimizedEditor, sessionId, setSelectedTagType, toast]);

  // ✅ NEW: Optimized tag click handler - no immediate API calls
  const handleTagClick = useCallback(async (tag: DocumentTag, position: { x: number; y: number; width: number; height: number }) => {
    console.log('🏷️ Optimized tag click:', tag.id, tag.tagType);
    
    // Permission checks (existing logic)
    const currentParticipant = participants.find(p => p.userId === currentUserId);
    const isNotary = currentParticipant?.userType === 'notary';
    const isAssignedUser = tag.assignedUserId === currentUserId;
    const isUniversalTag = ['T', 'D'].includes(tag.tagType);
    const canEdit = currentParticipant && (isNotary || isAssignedUser || isUniversalTag);

    if (!canEdit) {
      toast({
        title: "Cannot Edit Tag",
        description: "You don't have permission to edit this tag.",
        variant: "destructive"
      });
      return;
    }

    // Route by tag type (existing logic)
    const instantTags = ['W']; // Whiteout tags
    const autoFillTags = ['A', 'I', 'N', 'X', 'D', 'O']; // Auto-fill from profile
    const modalTags = ['S']; // Signature selection modal
    const sealTags = ['E']; // Seal configuration
    const inlineEditTags = ['T']; // Text editing

    if (instantTags.includes(tag.tagType)) {
      // ✅ NEW: Instant completion using optimized system
      await optimizedEditor.handleContentUpdate(tag.id, 'WHITEOUT', 'whiteout');
      
    } else if (sealTags.includes(tag.tagType)) {
      setSelectedSealTag(tag);
      setShowSealDialog(true);
      
    } else if (modalTags.includes(tag.tagType)) {
      setSelectedTagForInput(tag);
      setTagModalPosition(position);
      
    } else if (autoFillTags.includes(tag.tagType)) {
      // ✅ NEW: Auto-fill using optimized system (still calls API but batched)
      try {
        const response = await fetch(`/api/editor/session/${sessionId}/tag/${tag.id}/fill`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error('Auto-fill failed');
        }

        const result = await response.json();
        
        // Use optimized system to update the tag
        await optimizedEditor.handleContentUpdate(
          tag.id, 
          result.tag?.content || result.autoFillResult?.content,
          result.tag?.contentType || result.autoFillResult?.contentType || 'text'
        );

        toast({
          title: "Tag Auto-Filled",
          description: result.message || 'Tag filled with profile data',
          variant: "default"
        });
        
      } catch (error) {
        console.error('❌ Failed to auto-fill tag:', error);
        toast({
          title: "Auto-Fill Failed",
          description: error instanceof Error ? error.message : 'Failed to auto-fill tag',
          variant: "destructive"
        });
      }
      
    } else if (inlineEditTags.includes(tag.tagType)) {
      // Handle text editing (existing logic)
      selectTag(tag);
    }
  }, [participants, currentUserId, toast, optimizedEditor, sessionId, selectTag]);

  // ✅ NEW: Optimized tag content save - no immediate API calls
  const handleTagContentSave = useCallback(async (content: any) => {
    if (!selectedTagForInput) return;

    try {
      // Use optimized system for content updates
      await optimizedEditor.handleContentUpdate(
        selectedTagForInput.id,
        typeof content === 'string' ? content : JSON.stringify(content),
        'text'
      );

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
  }, [selectedTagForInput, optimizedEditor, toast]);

  // ✅ NEW: Optimized session completion with auto-save
  const handleSessionComplete = useCallback(async () => {
    if (isCompleting) return;
    
    setIsCompleting(true);
    try {
      console.log('📋 Session completion with optimized system...');
      
      // Use optimized system to complete session (auto-saves pending changes)
      await optimizedEditor.completeSession();
      
      toast({
        title: "Session Completed",
        description: "All changes have been saved successfully.",
        variant: "default"
      });
      
      if (onSessionComplete) {
        onSessionComplete();
      }
      
    } catch (error) {
      console.error('❌ Failed to complete session:', error);
      toast({
        title: "Completion Failed",
        description: error instanceof Error ? error.message : 'Failed to complete session',
        variant: "destructive"
      });
    } finally {
      setIsCompleting(false);
    }
  }, [isCompleting, optimizedEditor, toast, onSessionComplete]);

  // Existing initialization logic (unchanged)
  useEffect(() => {
    const initializeSession = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Set basic session data (existing logic)
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

        // Set current user (existing logic)
        const currentParticipant = participants.find(p => p.userId === currentUserId);
        if (currentParticipant) {
          setCurrentUser(currentParticipant);
          setSelectedUser(currentParticipant);
        }

        // Set mode configuration (existing logic)
        const isNotary = currentParticipant?.userType === 'notary' || currentParticipant?.role === 'notary';
        const isAdmin = currentParticipant?.role === 'admin';
        const canPlaceTags = mode === 'tagging' || (mode === 'signing' && (isNotary || isAdmin));
        
        setMode({
          mode: mode === 'signing' ? 'tagging' : mode as 'tagging' | 'notary',
          canPlaceTags,
          canModifyContent: mode === 'notary' || mode === 'signing',
          showPlaceholders: mode === 'tagging' || mode === 'signing'
        });

        // Load existing tags (existing logic)
        const response = await fetch(`/api/editor/session/${sessionId}/tags?t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });

        if (response.ok) {
          const { tags: existingTags } = await response.json();
          const validTags = existingTags.filter((tag: any) => !tag.id.toString().startsWith('temp_'));
          setTags(validTags);
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

  // ✅ NEW: Show WebSocket connection status
  const connectionStatus = optimizedEditor.isConnected ? 
    (optimizedEditor.isReady ? '🟢 Connected' : '🟡 Connecting...') : 
    '🔴 Disconnected';

  // Existing render logic with connection status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading optimized editor...</p>
          <p className="text-sm text-gray-500">{connectionStatus}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-xl mb-4 font-bold">!</div>
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

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header with connection status */}
      <div className="bg-white border-b px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">PDF Editor - Optimized</h1>
            <span className="text-sm text-gray-600">{connectionStatus}</span>
            {optimizedEditor.hasPendingUpdates() && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                Unsaved changes
              </span>
            )}
          </div>
          
          {/* Complete Button */}
          {mode === 'tagging' && (
            <button
              onClick={handleSessionComplete}
              disabled={isCompleting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {isCompleting ? 'Completing...' : 'Complete Tagging'}
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* PDF Viewer */}
        <div className="flex-1 relative bg-white overflow-hidden min-w-0" ref={containerRef}>
          <PDFViewer
            documentUrl={currentDocument?.fileUrl || ''}
            sessionId={sessionId}
            onCoordinateClick={handleTagPlacement}
            onTagClick={mode === 'signing' ? handleTagClick : undefined}
            tags={tags.filter(tag => tag.documentId === currentDocument?.id)}
            mode={mode === 'notary' ? 'tagging' : mode as 'tagging' | 'signing'}
            selectedUser={selectedUser}
            onTagUpdate={(tagId, coordinates) => {
              // ✅ NEW: Use optimized drag/resize system
              optimizedEditor.handleTagDragResize(tagId, coordinates);
            }}
            onTagResize={(tagId, coordinates) => {
              // ✅ NEW: Use optimized drag/resize system
              optimizedEditor.handleTagDragResize(tagId, coordinates);
            }}
            onTagDelete={(tagId) => {
              // ✅ NEW: Use optimized deletion
              optimizedEditor.handleTagDeletion(tagId);
            }}
            onFontSizeChange={(tagId, fontSize) => {
              // ✅ NEW: Use optimized font size updates
              optimizedEditor.handleFontSizeChange(tagId, fontSize);
            }}
            // Pass WebSocket instance for compatibility
            webSocket={{
              isConnected: optimizedEditor.isConnected,
              isReady: optimizedEditor.isReady,
              webSocketInstance: optimizedEditor.webSocketInstance
            } as any}
          />
        </div>

        {/* Toolbar */}
        <div className="w-72 bg-white border-l border-gray-200">
          <TaggingToolbar
            participants={participants}
            sessionId={sessionId}
            mode={mode}
            onSessionComplete={handleSessionComplete}
            className="h-full"
          />
        </div>
      </div>

      {/* Modals (existing) */}
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
          currentUserId={currentUserId}
          position={tagModalPosition}
        />
      )}

      <SealConfigDialog
        isOpen={showSealDialog}
        onClose={() => {
          setShowSealDialog(false);
          setSelectedSealTag(null);
        }}
        onConfirm={async (config) => {
          // Handle seal config with optimized system
          // Implementation depends on your seal logic
        }}
        participants={participants.map(p => ({
          userId: parseInt(p.userId.toString()),
          displayName: p.displayName,
          userType: p.userType,
          isActive: true,
          canInteract: true
        }))}
        isLoading={sealDialogLoading}
      />

      {/* Hotkey Handler (existing) */}
      <HotkeyHandler
        onUserSwitch={(userIndex) => {
          // Existing hotkey logic
        }}
        onTagTypeSelect={(tagType) => {
          setSelectedTagType(tagType);
        }}
        enabled={mode === 'tagging' || mode === 'signing'}
      />
    </div>
  );
};