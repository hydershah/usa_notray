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
        relative p-3 rounded-lg border-2 transition-all duration-200 text-left
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 text-blue-700' 
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
        }
        ${isDisabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'cursor-pointer'
        }
        min-w-[120px]
      `}
      title={`${tagInfo.description} (Press ${shortcut})`}
    >
      {/* Shortcut Key Indicator */}
      <div className="absolute top-1 right-1 w-6 h-6 bg-gray-700 text-white text-xs rounded flex items-center justify-center font-mono">
        {shortcut}
      </div>
      
      {/* Tag Icon and Label */}
      <div className="flex items-center gap-2">
        <span className="text-xl">{tagInfo.icon}</span>
        <div>
          <div className="font-medium text-sm">{tagInfo.label}</div>
          <div className="text-xs text-gray-500 truncate">{tagInfo.description}</div>
        </div>
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
  return (
    <div className="space-y-3">
      <h3 className="font-medium text-gray-700 text-sm">Select User for Tag Assignment</h3>
      
      <div className="grid grid-cols-1 gap-3">
        {participants.map((participant, index) => {
          const isSelected = selectedUser?.userId === participant.userId;
          const isCurrentUser = currentUser?.userId === participant.userId;
          const shortcut = participant.userType === 'notary' ? '`' : (index + 1).toString();
          
          return (
            <button
              key={participant.userId}
              onClick={() => onUserSelect(participant)}
              className={`
                relative p-3 rounded-lg border-2 text-left transition-all duration-200
                ${isSelected 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }
              `}
              title={`Switch to ${participant.displayName} (Press ${shortcut})`}
            >
              {/* Shortcut Key Indicator */}
              <div className="absolute top-2 right-2 w-6 h-6 bg-gray-700 text-white text-xs rounded flex items-center justify-center font-mono">
                {shortcut}
              </div>
              
              {/* User Info */}
              <div className="flex items-center gap-3">
                {/* Color Indicator */}
                <div 
                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: participant.colorCode }}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {participant.displayName}
                    {isCurrentUser && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {participant.userType}
                  </div>
                </div>
                
                {/* Status */}
                <div className={`
                  w-2 h-2 rounded-full
                  ${participant.status === 'active' ? 'bg-green-400' : 
                    participant.status === 'joined' ? 'bg-yellow-400' : 'bg-gray-400'}
                `} />
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

  // Handle session completion
  const handleCompleteSession = useCallback(async () => {
    if (!sessionId) {
      setCompletionError('No session ID available');
      return;
    }

    try {
      setIsCompleting(true);
      setCompletionError(null);

      const response = await fetch(`/api/editor/session/${sessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          force: false // Can be made configurable if needed
        })
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (result.error === 'no_tags_placed') {
          setCompletionError('Please place at least one tag before completing the session.');
          return;
        } else if (result.error === 'insufficient_tags') {
          setCompletionError(`${result.message}. You can still complete the session if needed.`);
          return;
        }
        throw new Error(result.message || 'Failed to complete session');
      }

      console.log('✅ Session completed successfully:', result);
      
      // Show success message to user
      if (result.document?.canContinueEditing) {
        console.log('📝 User can continue editing this tagged document later');
      }
      
      // Call the parent completion handler
      onSessionComplete?.();
      
    } catch (error) {
      console.error('❌ Failed to complete session:', error);
      setCompletionError(error instanceof Error ? error.message : 'Failed to complete session');
    } finally {
      setIsCompleting(false);
    }
  }, [sessionId, onSessionComplete]);

  if (mode.mode !== 'tagging' || !mode.canPlaceTags) {
    return null;
  }

  return (
    <div className={`bg-white rounded-xl shadow-md p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-xl font-semibold text-gray-900">Tag Placement</h2>
        <p className="text-sm text-gray-600 mt-2">Select user and tag type to begin</p>
      </div>

      {/* User Selection */}
      <UserSelector
        participants={participants}
        selectedUser={selectedUser}
        currentUser={currentUser}
        onUserSelect={handleUserSelect}
      />

      {/* Tag Type Selection */}
      {selectedUser && availableTagTypes.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-700 text-sm">
            Tag Types for {selectedUser.displayName}
          </h3>
          
          <div className="grid grid-cols-1 gap-3">
            {availableTagTypes.map(tagType => (
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
        </div>
      )}

      {/* Current Selection Display */}
      {selectedUser && selectedTagType && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm font-medium text-blue-800 mb-1">
            Ready to Place Tag
          </div>
          <div className="text-xs text-blue-600">
            {TAG_TYPE_INFO[selectedTagType].icon} {TAG_TYPE_INFO[selectedTagType].label} for {selectedUser.displayName}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
        <div className="font-medium mb-2">Keyboard Shortcuts:</div>
        <div>• <kbd className="kbd">` (backtick)</kbd> to switch to notary</div>
        <div>• <kbd className="kbd">1-8</kbd> to switch to signers</div>
        <div>• <kbd className="kbd">A, S, I, etc.</kbd> to select tag types</div>
        <div>• <kbd className="kbd">Delete</kbd> to remove selected tag</div>
        <div>• <kbd className="kbd">Esc</kbd> to deselect</div>
      </div>

      {/* Session Stats */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <div className="text-sm font-medium text-green-800 mb-1">
          Session Progress
        </div>
        <div className="text-xs text-green-600 space-y-1">
          <div>📌 {tags.length} tags placed</div>
          <div>👥 {participants.length} participants</div>
        </div>
      </div>

      {/* Completion Error Display */}
      {completionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-sm font-medium text-red-800 mb-1">
            ⚠️ Error
          </div>
          <div className="text-xs text-red-600">
            {completionError}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaggingToolbar; 