import React, { useCallback, useState } from 'react';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import type { TagType, SessionParticipant, SessionDocument } from '../../types/editor';
import { TAG_TYPE_INFO, USER_COLORS } from '../../types/editor';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { FileText, ChevronDown, Loader2 } from 'lucide-react';

interface TaggingToolbarProps {
  participants?: SessionParticipant[];
  sessionId?: string;
  mode?: 'tagging' | 'notary' | 'signing';
  onDocumentSwitch?: (document: SessionDocument) => void;
  onSessionComplete?: () => void;
  className?: string;
  liveSessionState?: any;
  onSetActiveUser?: (userId: number) => void;
  canControlSession?: boolean;
  isLoading?: boolean;
}

interface TagTypeButtonProps {
  tagType: TagType;
  user: SessionParticipant;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
  shortcut: string;
}

const TagTypeButton: React.FC<TagTypeButtonProps> = ({
  tagType,
  user,
  isSelected,
  isDisabled,
  onClick,
  shortcut
}) => {
  const tagInfo = TAG_TYPE_INFO[tagType];
  
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={`
        w-full flex items-center justify-between p-2 pr-3 rounded-lg border transition-all duration-200 min-h-[40px]
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 text-blue-700' 
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
        }
        ${isDisabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'cursor-pointer'
        }
      `}
      title={`${tagInfo.description} (${shortcut}) - ${user.displayName}`}
    >
      <div className="flex items-center gap-2 min-w-0 pointer-events-none">
        <span className="shrink-0 text-base">{tagInfo.icon}</span>
        <span className="text-sm font-medium truncate">{tagInfo.label}</span>
      </div>
      <div className="shrink-0 w-5 h-5 bg-gray-600 text-white text-xs rounded flex items-center justify-center font-mono">
        {shortcut}
      </div>
    </button>
  );
};

interface UserTagSectionProps {
  user: SessionParticipant;
  tags: TagType[];
  selectedTagType: TagType | null;
  selectedUser: SessionParticipant | null;
  currentUser: SessionParticipant | null;
  isDisabled: boolean;
  onTagSelect: (tagType: TagType, user: SessionParticipant) => void;
  liveSessionState?: any;
  onSetActiveUser?: (userId: number) => void;
  canControlSession?: boolean;
  isLoading?: boolean;
}

const UserTagSection: React.FC<UserTagSectionProps> = ({
  user,
  tags,
  selectedTagType,
  selectedUser,
  currentUser,
  isDisabled,
  onTagSelect,
  liveSessionState,
  onSetActiveUser,
  canControlSession,
  isLoading = false
}) => {
  const isCurrentUser = currentUser?.userId === user.userId;
  const getUserColor = (u: SessionParticipant): string => {
    if (u.userType === 'notary') return USER_COLORS.notary;
    if (u.userType === 'signer') return USER_COLORS.signer1;
    if (u.userType === 'witness') return USER_COLORS.witness1;
    return '#6B7280';
  };
  const userColor = getUserColor(user);
  
  // Check if user is currently active in live session
  const isActiveUser = liveSessionState?.activeUserId === parseInt(user.userId);
  const canMakeActive = canControlSession && 
                        liveSessionState?.state === 'active' && 
                        !isActiveUser && 
                        (user.userType === 'signer' || user.userType === 'witness');
  
  // Get tag completion stats for this user
  const { tags: allTags } = useEditorStore();
  const userTags = allTags.filter(tag => tag.assignedUserId === user.userId);
  const completedTags = userTags.filter(tag => tag.isCompleted);
          
          return (
    <div className="space-y-3">
      {/* User Header */}
      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
        {/* Top row: Name and badges */}
        <div className="flex items-center gap-2 mb-2">
          <div 
            className="w-2.5 h-2.5 rounded-full border border-white shadow-sm flex-shrink-0" 
            style={{ backgroundColor: userColor }}
          />
          <span className="text-sm font-semibold text-gray-900 truncate">
            {user.displayName}
          </span>
          {isCurrentUser && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium">You</Badge>
          )}
        </div>
        
        {/* Second row: User type and status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs px-2 py-0.5 capitalize font-medium">
              {user.userType}
            </Badge>
            

          </div>
          
          {/* Make Active Button */}
          {canMakeActive && onSetActiveUser && (
            <Button
              size="sm"
              variant="default"
              onClick={() => onSetActiveUser(parseInt(user.userId))}
              className="text-xs h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : null}
              Make Active
            </Button>
          )}
        </div>
        

      </div>
      
      {/* User's Tags */}
      <div className="flex flex-col gap-1.5">
        {tags.map((tagType) => {
          const isSelected = selectedTagType === tagType && selectedUser?.userId === user.userId;
          const shortcut = tagType; // Use tag type as shortcut
          
          return (
            <TagTypeButton
              key={`${user.userId}-${tagType}`}
              tagType={tagType}
              user={user}
              isSelected={isSelected}
              isDisabled={isDisabled}
              onClick={() => onTagSelect(tagType, user)}
              shortcut={shortcut}
            />
          );
        })}
      </div>
    </div>
  );
};

export const TaggingToolbar: React.FC<TaggingToolbarProps> = ({ 
  sessionId,
  className = '',
  onSessionComplete,
  onDocumentSwitch,
  mode: propMode,
  liveSessionState,
  onSetActiveUser,
  canControlSession,
  isLoading = false
}) => {
  const {
    mode,
    selectedTagType,
    setSelectedTagType,
    participants,
    selectedUser,
    currentUser,
    setSelectedUser,
    tags,
    documents,
    currentDocument
  } = useEditorStore();

  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  // Enhanced user role detection
  const isSigner = currentUser?.userType === 'signer';
  const isNotary = currentUser?.userType === 'notary';
  const isAdmin = currentUser?.role === 'admin';
  const canPlaceTags = mode.canPlaceTags;

  // Filter tags for current document only
  const currentDocumentTags = tags.filter(tag => tag.documentId === currentDocument?.id);

  // Define available tag types based on user role
  const getAvailableTagTypes = useCallback((user: SessionParticipant): TagType[] => {
    const signerTags: TagType[] = ['T', 'A', 'S', 'I']; // Text, Name, Signature, Initials
    const notaryTags: TagType[] = ['T', 'A', 'S', 'I', 'D', 'N', 'X', 'O', 'E', 'W']; // All tags
    
    switch (user.userType) {
      case 'notary':
        return notaryTags;
      case 'signer':
      case 'witness':
        return signerTags;
      default:
        return [];
    }
  }, []);

  // Handle tag selection with user context
  const handleTagSelect = useCallback((tagType: TagType, user: SessionParticipant) => {
    console.log('Tag selected:', tagType, 'for user:', user.displayName);
    setSelectedTagType(tagType);
    // Always set the selected user to the user whose section was clicked
    setSelectedUser(user);
  }, [setSelectedTagType, setSelectedUser]);

  // Handle document switching
  const handleDocumentSwitch = useCallback((document: SessionDocument) => {
    console.log('Document switched:', document.fileName);
    if (onDocumentSwitch) {
      onDocumentSwitch(document);
    }
  }, [onDocumentSwitch]);

  // Handle completion
  const handleComplete = useCallback(async () => {
    if (isCompleting) return;
    
    setIsCompleting(true);
    setCompletionError(null);
    
    try {
      if (!sessionId) {
        throw new Error('No session ID available');
      }
      
      // Check if this is a live signing session by checking if we have a job ID
      const jobIdMatch = sessionId.match(/^\d+$/) || window.location.pathname.match(/\/jobs\/(\d+)/);
      const jobId = jobIdMatch ? (sessionId.match(/^\d+$/) ? sessionId : jobIdMatch[1]) : null;
      
      // For live signing sessions, check recording status
      if (jobId) {
        try {
          const recordingResponse = await fetch(`/api/jobs/${jobId}/recording-details`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (recordingResponse.ok) {
            const recordingData = await recordingResponse.json();
            if (!recordingData.fileUrl && !recordingData.metadata?.recordingId) {
              const confirmCompletion = window.confirm(
                '⚠️ Recording Warning\n\nNo session recording was detected for this job. For compliance purposes, live signing sessions should be recorded.\n\nDo you want to complete the session anyway?'
              );
              if (!confirmCompletion) {
                setIsCompleting(false);
                return;
              }
            }
          }
        } catch (recordingError) {
          console.warn('Could not check recording status:', recordingError);
          // Continue with completion - don't block for recording check failures
        }
      }
      
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
          // Show force completion option
          if (window.confirm(
            `${result.message}\n\nWould you like to complete the session anyway? This will mark all incomplete tags as "Not Required".`
          )) {
            const forceResponse = await fetch(`/api/editor/session/${sessionId}/complete`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({ force: true })
            });
            
            const forceResult = await forceResponse.json();
            
            if (forceResponse.ok) {
              console.log('Session force completed successfully');
              if (onSessionComplete) {
                onSessionComplete();
              }
            } else {
              throw new Error(forceResult.error || 'Failed to force complete session');
            }
          }
        } else {
          throw new Error(result.error || 'Failed to complete session');
        }
      } else {
        console.log('Session completed successfully');
        if (onSessionComplete) {
          onSessionComplete();
        }
      }
    } catch (error) {
      console.error('Session completion error:', error);
      setCompletionError(error instanceof Error ? error.message : 'Failed to complete session');
    } finally {
      setIsCompleting(false);
    }
  }, [isCompleting, sessionId, onSessionComplete]);

  // Show simplified interface for signers in signing mode
  if (isSigner && propMode === 'signing') {
  return (
      <div className={`space-y-4 tagging-toolbar ${className}`}>
        <button
          onClick={() => setSelectedTagType(null)}
          className={`
            w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-200
            ${selectedTagType === null 
              ? 'border-blue-500 bg-blue-50 text-blue-700' 
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }
          `}
        >
          <div className="flex-1 text-left" />
          {selectedTagType === null && (
            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          )}
        </button>
      </div>
    );
  }

  // Main interface - show all users with their tags
  return (
    <div className={`h-full min-h-0 flex flex-col gap-2 tagging-toolbar ${className}`} style={{ minWidth: 0, height: '100%' }}>


      {/* User Sections with Tags */}
      {participants && participants.length > 0 && canPlaceTags && (
        <div
          className="flex-1 overflow-y-auto overscroll-contain space-y-4 px-1 pb-4"
          style={{ 
            scrollbarGutter: 'stable both-edges' as any,
            minHeight: '200px',
            maxHeight: 'calc(100vh - 200px)'
          }}
        >
          {participants.map((participant) => {
            const availableTags = getAvailableTagTypes(participant);
            if (availableTags.length === 0) return null;
            
            return (
              <UserTagSection
                key={participant.userId}
                user={participant}
                tags={availableTags}
                selectedTagType={selectedTagType}
                selectedUser={selectedUser}
                currentUser={currentUser}
                isDisabled={!canPlaceTags}
                onTagSelect={handleTagSelect}
                liveSessionState={liveSessionState}
                onSetActiveUser={onSetActiveUser}
                canControlSession={canControlSession}
                isLoading={isLoading}
              />
            );
          })}
        </div>
      )}



      {/* Document Switcher */}
      {documents && documents.length > 1 && (
        <div className="border-t pt-4 space-y-2">
          <h3 className="text-sm font-medium text-gray-900">Documents</h3>
          <div className="space-y-1">
            {documents.map((document) => (
              <button
                key={document.id}
                onClick={() => handleDocumentSwitch(document)}
                className={`
                  w-full p-2 text-left rounded border transition-all duration-200
                  ${currentDocument?.id === document.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium truncate">{document.fileName}</span>
                </div>
              </button>
            ))}
                    </div>
                  </div>
                )}
                
      {/* Session Completion - REMOVED */}
      {/* {propMode !== 'signing' && sessionId && (
        <div className="border-t pt-4 space-y-2">
          <button
            onClick={handleComplete}
            disabled={isCompleting}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {isCompleting ? 'Completing...' : 'Complete Session'}
          </button>
          
          {completionError && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">
              {completionError}
            </div>
          )}
        </div>
      )} */}
    </div>
  );
};

export default TaggingToolbar; 