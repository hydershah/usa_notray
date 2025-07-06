import React, { useCallback, useState } from 'react';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import type { TagType, SessionParticipant } from '../../types/editor';
import { TAG_TYPE_INFO, USER_COLORS } from '../../types/editor';

interface TaggingToolbarProps {
  participants?: SessionParticipant[];
  sessionId?: string;
  mode?: 'tagging' | 'notary';
  onDocumentSwitch?: (document: any) => void;
  onSessionComplete?: () => void;
  className?: string;
}

interface TagTypeButtonProps {
  tagType: TagType;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
  shortcut: string;
}

const TagTypeButton: React.FC<TagTypeButtonProps> = ({
  tagType,
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
        relative flex items-center gap-2 p-2 rounded-lg border-2 transition-all duration-150
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 text-blue-700' 
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
        }
        ${isDisabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'cursor-pointer'
        }
        w-full text-left
      `}
      title={`${tagInfo.description} (Press ${shortcut})`}
    >
      {/* Shortcut Key */}
      <div className="absolute top-1 right-1 w-5 h-5 bg-gray-700 text-white text-xs rounded flex items-center justify-center font-mono">
        {shortcut}
      </div>
      
      {/* Tag Content */}
      <span className="text-lg">{tagInfo.icon}</span>
      <div className="flex-1">
        <div className="font-medium text-sm">{tagInfo.label}</div>
        <div className="text-xs text-gray-500">{tagInfo.description}</div>
      </div>
    </button>
  );
};

interface UserSelectorProps {
  participants: SessionParticipant[];
  selectedUser: SessionParticipant | null;
  currentUser: SessionParticipant | null;
  onUserSelect: (user: SessionParticipant) => void;
}

const UserSelector: React.FC<UserSelectorProps> = ({
  participants,
  selectedUser,
  currentUser,
  onUserSelect
}) => {
  // Calculate signer-specific indices for correct keyboard shortcuts
  const signers = participants.filter(p => p.userType === 'signer');
  
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">Select User for Tag Assignment</h3>
      
      <div className="space-y-2">
        {participants.map((participant, index) => {
          const isSelected = selectedUser?.userId === participant.userId;
          const isCurrentUser = currentUser?.userId === participant.userId;
          
          // Calculate correct shortcut based on user type
          let shortcut: string;
          if (participant.userType === 'notary') {
            shortcut = '`';
          } else if (participant.userType === 'signer') {
            // Find the signer's position among signers (1-based)
            const signerIndex = signers.findIndex(s => s.userId === participant.userId);
            shortcut = (signerIndex + 1).toString();
          } else {
            shortcut = ''; // Other user types don't have shortcuts
          }
          
          return (
            <button
              key={participant.userId}
              onClick={() => onUserSelect(participant)}
              className={`
                relative w-full p-3 rounded-lg border-2 text-left transition-all duration-150
                ${isSelected 
                  ? participant.userType === 'notary' 
                    ? 'border-red-500 bg-red-50' 
                    : 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }
              `}
              title={`Switch to ${participant.displayName} (Press ${shortcut})`}
            >
              {/* Shortcut Key */}
              <div className="absolute top-2 right-2 w-5 h-5 bg-gray-700 text-white text-xs rounded flex items-center justify-center font-mono">
                {shortcut}
              </div>
              
              <div className="flex items-center gap-3">
                {/* Color dot */}
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: participant.colorCode }}
                />
                
                {/* User info */}
                <div className="flex-1">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {participant.displayName}
                    {isCurrentUser && (
                      <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {participant.userType}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const TaggingToolbar: React.FC<TaggingToolbarProps> = ({ 
  className = '',
  sessionId,
  onSessionComplete 
}) => {
  const {
    mode,
    selectedTagType,
    setSelectedTagType,
    participants,
    selectedUser,
    currentUser,
    setSelectedUser,
    switchUser,
    tags
  } = useEditorStore();

  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  // Define available tag types based on user role
  const getAvailableTagTypes = useCallback((user: SessionParticipant | null): TagType[] => {
    if (!user) return [];
    
    const universalTags: TagType[] = ['T', 'D']; // Text and Date available to all
    const signerTags: TagType[] = ['A', 'S', 'I']; // Name, Signature, Initials
    const notaryTags: TagType[] = ['N', 'X', 'O', 'E', 'W']; // Commission, Expiration, Disclosure, Seal, Whiteout
    
    switch (user.userType) {
      case 'notary':
        return [...universalTags, ...signerTags, ...notaryTags];
      case 'signer':
        return [...universalTags, ...signerTags];
      case 'witness':
        return []; // Witnesses cannot place tags
      default:
        return [];
    }
  }, []);

  const availableTagTypes = getAvailableTagTypes(selectedUser);

  // Handle tag type selection
  const handleTagTypeSelect = useCallback((tagType: TagType) => {
    console.log('🏷️  Tag type selected:', tagType, 'was:', selectedTagType);
    if (selectedTagType === tagType) {
      setSelectedTagType(null); // Deselect if already selected
    } else {
      setSelectedTagType(tagType);
    }
  }, [selectedTagType, setSelectedTagType]);

  // Handle user selection
  const handleUserSelect = useCallback((user: SessionParticipant) => {
    console.log('👤 User selected:', user.displayName, 'was:', selectedUser?.displayName);
    setSelectedUser(user);
    // Clear selected tag type when switching users
    setSelectedTagType(null);
  }, [setSelectedUser, setSelectedTagType, selectedUser]);

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
          // Allow user to force completion if they want
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
              if (onSessionComplete) {
                onSessionComplete();
              }
            }
          }
        } else {
          throw new Error(result.message || 'Failed to complete session');
        }
      } else {
        console.log('✅ Session completed successfully');
        if (onSessionComplete) {
          onSessionComplete();
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to complete session:', error);
      setCompletionError(error instanceof Error ? error.message : 'Failed to complete session');
    } finally {
      setIsCompleting(false);
    }
  }, [sessionId, onSessionComplete, isCompleting]);

  return (
    <div className={`bg-white rounded-lg flex flex-col ${className}`}>
      {/* Fixed Header */}
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Tag Placement</h2>
        <p className="text-sm text-gray-600">
          Place tags on the document for signers
        </p>
        <div className="mt-2 text-sm text-gray-700">
          <span className="font-medium">{tags.length}</span> tags placed
        </div>
      </div>

      {/* Scrollable Content */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4" 
        style={{ 
          maxHeight: 'calc(100vh - 300px)', 
          minHeight: '400px',
          scrollbarWidth: 'thin',
          scrollbarColor: '#d1d5db #f3f4f6'
        }}
      >

      {/* User Selection */}
      <UserSelector
        participants={participants}
        selectedUser={selectedUser}
        currentUser={currentUser}
        onUserSelect={handleUserSelect}
      />

      {/* Tag Type Selection */}
      {selectedUser && availableTagTypes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">
            Available Tag Types
          </h3>
          
          {/* Universal Tags */}
          {availableTagTypes.filter(t => ['T', 'D'].includes(t)).length > 0 && (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Universal</p>
              <div className="space-y-1">
                {availableTagTypes.filter(t => ['T', 'D'].includes(t)).map(tagType => (
                  <TagTypeButton
                    key={tagType}
                    tagType={tagType}
                    isSelected={selectedTagType === tagType}
                    isDisabled={false}
                    onClick={() => handleTagTypeSelect(tagType)}
                    shortcut={tagType}
                  />
                ))}
              </div>
            </>
          )}
          
          {/* Signer Tags */}
          {availableTagTypes.filter(t => ['A', 'S', 'I'].includes(t)).length > 0 && (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-wide mt-3">Signer Tags</p>
              <div className="space-y-1">
                {availableTagTypes.filter(t => ['A', 'S', 'I'].includes(t)).map(tagType => (
                  <TagTypeButton
                    key={tagType}
                    tagType={tagType}
                    isSelected={selectedTagType === tagType}
                    isDisabled={false}
                    onClick={() => handleTagTypeSelect(tagType)}
                    shortcut={tagType}
                  />
                ))}
              </div>
            </>
          )}
          
          {/* Notary Tags */}
          {availableTagTypes.filter(t => ['N', 'X', 'O', 'E', 'W'].includes(t)).length > 0 && (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-wide mt-3">Notary Tags</p>
              <div className="space-y-1">
                {availableTagTypes.filter(t => ['N', 'X', 'O', 'E', 'W'].includes(t)).map(tagType => (
                  <TagTypeButton
                    key={tagType}
                    tagType={tagType}
                    isSelected={selectedTagType === tagType}
                    isDisabled={false}
                    onClick={() => handleTagTypeSelect(tagType)}
                    shortcut={tagType}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Current Selection Display */}
      {selectedUser && selectedTagType && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm font-medium text-blue-800">
            Ready to Place
          </div>
          <div className="text-xs text-blue-600 mt-1">
            Click on the document to place {TAG_TYPE_INFO[selectedTagType].icon} {TAG_TYPE_INFO[selectedTagType].label} for {selectedUser.displayName}
          </div>
        </div>
      )}

      {/* Placed Tags Summary */}
      {tags.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Placed Tags ({tags.length})</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {tags.map(tag => {
              const userInfo = participants.find(p => p.userId === tag.assignedUserId);
              const tagInfo = TAG_TYPE_INFO[tag.tagType];
              
              return (
                <div key={tag.id} className="flex items-center gap-2 p-2 bg-white rounded border text-xs">
                  <span className="text-sm">{tagInfo.icon}</span>
                  <span className="font-medium">{tagInfo.label}</span>
                  <div className="flex items-center gap-1 ml-auto">
                    <div 
                      className="w-2 h-2 rounded-full border border-gray-300" 
                      style={{ backgroundColor: userInfo?.colorCode || tag.colorCode }}
                    />
                    <span className="text-gray-600">
                      {userInfo?.displayName.split(' ')[0] || 'Unknown'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
        <div className="font-medium">Quick Tips:</div>
        <div>• Use keyboard shortcuts for faster tagging</div>
        <div>• Click and drag to resize tags</div>
        <div>• Press Delete to remove selected tags</div>
      </div>

      {/* Completion Button */}
      {mode?.mode === 'tagging' && (
        <div className="pt-4 border-t">
          <button
            onClick={handleComplete}
            disabled={isCompleting || tags.length === 0}
            className={`
              w-full py-2 px-4 rounded-lg font-medium transition-colors
              ${tags.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : isCompleting
                ? 'bg-gray-400 text-white cursor-wait'
                : 'bg-green-600 text-white hover:bg-green-700'
              }
            `}
          >
            {isCompleting ? 'Completing...' : 'Complete Tagging Session'}
          </button>
          
          {completionError && (
            <div className="mt-2 text-sm text-red-600">
              {completionError}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default TaggingToolbar; 