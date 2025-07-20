import React, { useCallback, useState } from 'react';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import type { TagType, SessionParticipant, SessionDocument } from '../../types/editor';
import { TAG_TYPE_INFO, USER_COLORS } from '../../types/editor';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { FileText, ChevronDown } from 'lucide-react';

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
      onClick={onClick}
      disabled={isDisabled}
      className={`
        relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all duration-200 min-h-[60px]
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
      {/* Tag Icon */}
      <span className="text-lg font-bold">{tagInfo.icon}</span>
      
      {/* Tag Label */}
      <span className="text-xs font-medium text-center leading-tight">{tagInfo.label}</span>
      
      {/* Shortcut Key */}
      <div className="absolute top-1 right-1 w-4 h-4 bg-gray-600 text-white text-xs rounded flex items-center justify-center font-mono">
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
  canControlSession
}) => {
  const isCurrentUser = currentUser?.userId === user.userId;
  const userColor = USER_COLORS[user.userType] || '#6B7280';
  
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
    <div className="space-y-2">
      {/* User Header */}
      <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
        <div 
          className="w-3 h-3 rounded-full border border-white shadow-sm" 
          style={{ backgroundColor: userColor }}
        />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              {user.displayName}
                    </span>
                    {isCurrentUser && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">You</Badge>
                    )}
            <Badge variant="outline" className="text-xs px-1.5 py-0.5 capitalize">
              {user.userType}
            </Badge>
                  </div>
          {userTags.length > 0 && (
            <div className="text-xs text-gray-500">
              {completedTags.length}/{userTags.length} completed
                  </div>
          )}
          
          {/* Live session status */}
          {liveSessionState && (
            <div className="text-xs">
              {isActiveUser ? (
                <span className="text-blue-600 font-medium">Active - Can interact</span>
              ) : (
                <span className="text-gray-500">Waiting</span>
              )}
                  </div>
                )}
              </div>
        
        {/* Make Active Button */}
        {canMakeActive && onSetActiveUser && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSetActiveUser(parseInt(user.userId))}
            className="text-xs h-6 px-2"
          >
            Make Active
          </Button>
        )}
      </div>
      
      {/* User's Tags */}
      <div className="grid grid-cols-4 gap-1.5">
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
  canControlSession
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
  const canPlaceTags = mode.mode === 'tagging' || (propMode === 'signing' && (isNotary || isAdmin));

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
      <div className={`space-y-4 ${className}`}>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
            Signer View
                </h3>
                <p className="text-sm text-blue-700">
                  Click on tags assigned to you to fill them out. Wait for the notary to activate you if needed.
                </p>
              </div>
              
        {/* Selection Mode Button */}
              <button
                onClick={() => setSelectedTagType(null)}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-200
                  ${selectedTagType === null 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
                title="Selection mode - click to select your assigned tags"
              >
                <div className="flex-1 text-left">
                  <div className="font-medium">Selection Mode</div>
                  <div className="text-xs text-gray-600">Click on your assigned tags to fill them</div>
                </div>
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
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">
          {propMode === 'signing' ? 'Signing Tools' : 'Tagging Tools'}
        </h2>
        
        {/* Current Selection Status */}
        {selectedTagType && selectedUser && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-800">
              <span className="text-sm font-medium">
                Ready to place {TAG_TYPE_INFO[selectedTagType].label} for {selectedUser.displayName}
              </span>
            </div>
            </div>
          )}

        {!selectedUser && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-800">
              <span className="text-sm font-medium">Select a tag type below to start placing tags</span>
            </div>
          </div>
        )}
      </div>

      {/* User Sections with Tags */}
      {participants && participants.length > 0 && canPlaceTags && (
        <div className="space-y-4">
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
                
      {/* Session Completion */}
      {propMode !== 'signing' && sessionId && (
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
      )}
    </div>
  );
};

export default TaggingToolbar; 