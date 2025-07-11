import React, { useCallback, useState, useRef } from 'react';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { useOptimisticTagOperations } from '../../hooks/editor/useOptimisticTagOperations';
import { DocumentTag, TagCoordinates } from '../../types/editor';
import { ImprovedTag } from './ImprovedTag';
import { ImprovedTaggingSidebar } from './ImprovedTaggingSidebar';
import { PDFViewer } from './PDFViewer';
import { VideoIntegration } from './VideoIntegration';
import { Badge } from '../ui/badge';

interface ImprovedPDFTaggingEditorProps {
  sessionId: string;
  mode: 'tagging' | 'signing';
  documents: any[];
  participants: any[];
  currentUserId: string;
  onSessionComplete?: () => void;
  onTagsChanged?: () => void;
  liveSessionState?: any;
  onSetActiveUser?: (userId: string) => void;
}

export const ImprovedPDFTaggingEditor: React.FC<ImprovedPDFTaggingEditorProps> = ({
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
  const [selectedTagForInput, setSelectedTagForInput] = useState<DocumentTag | null>(null);
  const [tagModalPosition, setTagModalPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

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
    setTags,
    selectedTag,
    selectTag
  } = useEditorStore();

  // Optimistic operations for better performance
  const {
    placeTagOptimistic,
    updateTagOptimistic,
    deleteTagOptimistic,
    isTagUpdating,
    pendingUpdatesCount
  } = useOptimisticTagOperations(sessionId);

  // Initialize data
  React.useEffect(() => {
    setSession({ id: sessionId } as any);
    setDocuments(documents);
    setParticipants(participants);
    setCurrentUser(participants.find(p => p.userId === currentUserId) || null);
    setMode({ mode: mode === 'signing' ? 'notary' : 'tagging', canPlaceTags: true, canModifyContent: true, showPlaceholders: true });
    
    if (documents.length > 0) {
      setCurrentDocument(documents[0]);
    }
  }, [sessionId, mode, documents, participants, currentUserId]);

  // Handle tag placement with optimistic updates
  const handleTagPlacement = useCallback(async (coordinates: TagCoordinates) => {
    if (!selectedTagType || !selectedUser || !currentDocument) {
      return;
    }

    try {
      await placeTagOptimistic({
        documentId: currentDocument.id,
        tagType: selectedTagType,
        coordinates,
        assignedUserId: selectedUser.userId
      });
      
      onTagsChanged?.();
    } catch (error) {
      console.error('Failed to place tag:', error);
    }
  }, [selectedTagType, selectedUser, currentDocument, placeTagOptimistic, onTagsChanged]);

  // Handle tag updates with optimistic updates
  const handleTagUpdate = useCallback(async (tagId: string, updates: Partial<TagCoordinates>) => {
    try {
      await updateTagOptimistic(tagId, { coordinates: updates as TagCoordinates });
    } catch (error) {
      console.error('Failed to update tag:', error);
    }
  }, [updateTagOptimistic]);

  // Handle tag deletion with optimistic updates
  const handleTagDelete = useCallback(async (tagId: string) => {
    try {
      await deleteTagOptimistic(tagId);
      onTagsChanged?.();
    } catch (error) {
      console.error('Failed to delete tag:', error);
    }
  }, [deleteTagOptimistic, onTagsChanged]);

  // Handle tag click for content input
  const handleTagClick = useCallback((tag: DocumentTag, position: { x: number; y: number; width: number; height: number }) => {
    if (mode !== 'signing') return;
    
    // Check permissions
    const currentParticipant = participants.find(p => p.userId === currentUserId);
    const isNotary = currentParticipant?.userType === 'notary';
    const isAssignedUser = tag.assignedUserId === currentUserId;
    const isUniversalTag = ['T', 'D'].includes(tag.tagType);
    
    const canEdit = currentParticipant && (isNotary || isAssignedUser || isUniversalTag);

    if (!canEdit) {
      return;
    }

    setSelectedTagForInput(tag);
    setTagModalPosition(position);
  }, [mode, participants, currentUserId]);

  // Handle tag selection
  const handleTagSelect = useCallback((tag: DocumentTag) => {
    selectTag(tag);
  }, [selectTag]);

  // Custom PDF viewer component that uses improved tags
  const renderPDFWithImprovedTags = () => {
    if (!currentDocument) return null;

    return (
      <div className="flex-1 relative bg-white">
        <PDFViewer
          documentUrl={currentDocument.fileUrl}
          onCoordinateClick={handleTagPlacement}
          onTagClick={mode === 'signing' ? handleTagClick : undefined}
          tags={tags.filter(tag => tag.documentId === currentDocument.id)}
          mode={mode === 'notary' ? 'tagging' : mode as 'tagging' | 'signing'}
          selectedUser={selectedUser}
          onTagUpdate={handleTagUpdate}
          onTagResize={handleTagUpdate}
          onTagDelete={handleTagDelete}
          liveSessionState={liveSessionState}
          onSetActiveUser={onSetActiveUser}
          // Override tag rendering with improved tags
          renderTag={(tag, isSelected, canEdit, onUpdate, onSave, onDelete, onSelect) => (
            <ImprovedTag
              key={tag.id}
              tag={tag}
              scaleFactor={1} // You'll need to pass the actual scale factor
              isSelected={isSelected}
              canEdit={canEdit}
              onUpdate={onUpdate}
              onSave={onSave}
              onDelete={onDelete}
              onSelect={onSelect}
              onTagClick={handleTagClick}
              mode={mode}
              currentUserId={currentUserId}
              isUpdating={isTagUpdating(tag.id)}
            />
          )}
        />

        {/* Performance indicator */}
        {pendingUpdatesCount > 0 && (
          <div className="absolute top-4 right-4 bg-blue-100 border border-blue-300 rounded-lg px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-blue-700">
                Saving {pendingUpdatesCount} change{pendingUpdatesCount !== 1 ? 's' : ''}...
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {mode === 'signing' ? 'Document Signing' : 'Document Tagging'}
            </h1>
            {currentDocument && (
              <Badge variant="outline" className="text-sm">
                {currentDocument.fileName}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Performance indicator */}
            {pendingUpdatesCount > 0 && (
              <Badge className="bg-blue-100 text-blue-800">
                {pendingUpdatesCount} pending
              </Badge>
            )}
            
            {/* Tag count */}
            <Badge variant="secondary">
              {tags.length} tags • {tags.filter(t => t.isCompleted).length} completed
            </Badge>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video column (only in notary mode) */}
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

        {/* PDF viewer */}
        {renderPDFWithImprovedTags()}

        {/* Improved sidebar */}
        <ImprovedTaggingSidebar
          sessionId={sessionId}
          onSessionComplete={onSessionComplete}
          className="h-full"
        />
      </div>

      {/* Interactive tag input modal (if needed) */}
      {selectedTagForInput && tagModalPosition && (
        <div
          className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm"
          style={{
            left: tagModalPosition.x,
            top: tagModalPosition.y + tagModalPosition.height + 8,
          }}
        >
          <div className="text-sm font-medium mb-2">
            Complete {selectedTagForInput.tagType} tag
          </div>
          {/* Add your interactive input component here */}
          <button
            onClick={() => {
              setSelectedTagForInput(null);
              setTagModalPosition(null);
            }}
            className="mt-2 px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}; 