import React, { useCallback, useState } from 'react';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import type { TagType, SessionParticipant } from '../../types/editor';
import { TAG_TYPE_INFO, USER_COLORS } from '../../types/editor';
import { Badge } from '../ui/badge';

interface TaggingToolbarProps {
  participants?: SessionParticipant[];
  sessionId?: string;
  mode?: 'tagging' | 'notary' | 'signing';
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
        relative flex flex-col items-center gap-1 p-3 rounded-lg border transition-all duration-200
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 text-blue-700' 
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
        }
        ${isDisabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'cursor-pointer'
        }
      `}
      title={`${tagInfo.description} (${shortcut})`}
    >
      {/* Tag Icon */}
      <span className="text-xl">{tagInfo.icon}</span>
      
      {/* Tag Label */}
      <span className="text-xs font-medium text-center">{tagInfo.label}</span>
      
      {/* Shortcut Key */}
      <div className="absolute top-1 right-1 w-4 h-4 bg-gray-600 text-white text-xs rounded flex items-center justify-center font-mono">
        {shortcut}
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
      <h3 className="text-sm font-medium text-gray-900">Select User</h3>
      
      <div className="grid grid-cols-1 gap-2">
        {participants.map((participant) => {
          const isSelected = selectedUser?.userId === participant.userId;
          const isCurrentUser = currentUser?.userId === participant.userId;
          
          return (
            <button
              key={participant.userId}
              onClick={() => onUserSelect(participant)}
              className={`
                w-full p-3 rounded-lg border text-left transition-all duration-200
                ${isSelected 
                  ? 'border-blue-500 bg-blue-50 shadow-sm' 
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              <div className="flex items-center gap-3">
                {/* User Avatar/Initial */}
                <div 
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white
                    ${participant.userType === 'notary' ? 'bg-red-500' : 'bg-blue-500'}
                  `}
                >
                  {participant.displayName.charAt(0).toUpperCase()}
                </div>
                
                {/* User Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {participant.displayName}
                    </span>
                    {isCurrentUser && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {participant.userType}
                  </div>
                </div>
                
                {/* Selection indicator */}
                {isSelected && (
                  <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                )}
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
  onSessionComplete,
  mode: propMode
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

  // ✅ ENHANCED USER ROLE DETECTION FOR UI RESTRICTIONS
  const isSigner = currentUser?.userType === 'signer';
  const isNotary = currentUser?.userType === 'notary';
  const isAdmin = currentUser?.role === 'admin';
  const canPlaceTags = mode.mode === 'tagging' || (propMode === 'signing' && (isNotary || isAdmin));

  // Define available tag types based on user role - SIMPLIFIED RESTRICTIONS
  const getAvailableTagTypes = useCallback((user: SessionParticipant | null): TagType[] => {
    if (!user) return [];
    
    // Tag types for different user roles
    const textAndBasicTags: TagType[] = ['T', 'A', 'S', 'I']; // Text, Name, Sign, Initial
    const notaryTags: TagType[] = ['T', 'A', 'S', 'I', 'D', 'N', 'X', 'O', 'E', 'W']; // All tags
    
    switch (user.userType) {
      case 'notary':
        return notaryTags; // Notary gets all tag types
      case 'signer':
      case 'witness':
        return textAndBasicTags; // Signers and witnesses get basic tags only
      default:
        return [];
    }
  }, []);

  const availableTagTypes = getAvailableTagTypes(selectedUser);

  // Handle tag type selection - FIXED: Prevent accidental deselection
  const handleTagTypeSelect = useCallback((tagType: TagType) => {
    console.log('🏷️  Tag type selected:', tagType, 'was:', selectedTagType);
    // Always select the tag type, don't toggle off
    setSelectedTagType(tagType);
  }, [selectedTagType, setSelectedTagType]);

  // Handle user selection - FIXED: Don't clear tag type when switching users
  const handleUserSelect = useCallback((user: SessionParticipant) => {
    console.log('👤 User selected:', user.displayName, 'was:', selectedUser?.displayName);
    setSelectedUser(user);
    // Don't clear selected tag type when switching users - let user keep their selection
    // setSelectedTagType(null); // ❌ REMOVED - was causing tag type to be cleared
  }, [setSelectedUser, selectedUser]);

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
    <div className={`tagging-toolbar bg-white flex flex-col h-full ${className}`}>
      {/* Simplified Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">
          {propMode === 'signing' ? 'Signing Tools' : 'Tagging Tools'}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {tags.length} tags placed • {tags.filter(t => t.isCompleted).length} completed
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-0 space-y-4">
          {/* User Selection */}
          {!isSigner && (
            <UserSelector
              participants={participants}
              selectedUser={selectedUser}
              currentUser={currentUser}
              onUserSelect={handleUserSelect}
            />
          )}

          {/* Signer Message */}
          {isSigner && propMode === 'signing' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                👤 Signer View
              </h3>
              <p className="text-sm text-blue-700">
                Click on tags assigned to you to fill them out. Wait for the notary to activate you if needed.
              </p>
            </div>
          )}

          {/* Tag Type Selection - Simplified */}
          {selectedUser && availableTagTypes.length > 0 && !isSigner && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900">
                Tag Types for {selectedUser.displayName}
              </h3>
              
              <div className="grid grid-cols-2 gap-2">
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
          {selectedUser && selectedTagType && !isSigner && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{TAG_TYPE_INFO[selectedTagType].icon}</span>
                <div>
                  <div className="text-sm font-medium text-blue-900">
                    Ready to place {TAG_TYPE_INFO[selectedTagType].label}
                  </div>
                  <div className="text-xs text-blue-700">
                    For {selectedUser.displayName} • Click on document
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Placed Tags Summary */}
          {tags.length > 0 && (
            <div className="space-y-2 pb-4">
              <h3 className="text-sm font-medium text-gray-900">
                Document Tags ({tags.length})
              </h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {tags.map(tag => {
                  const userInfo = participants.find(p => p.userId === tag.assignedUserId);
                  const tagInfo = TAG_TYPE_INFO[tag.tagType];
                  const isAssignedToCurrentUser = tag.assignedUserId === currentUser?.userId;
                  
                  return (
                    <div 
                      key={tag.id} 
                      className={`flex items-center gap-2 p-2 rounded border text-xs transition-colors ${
                        isSigner && isAssignedToCurrentUser 
                          ? 'bg-blue-50 border-blue-200' 
                          : isSigner && !isAssignedToCurrentUser
                          ? 'bg-gray-50 border-gray-200 opacity-60'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <span className="text-sm">{tagInfo.icon}</span>
                      <span className="font-medium">{tagInfo.label}</span>
                      
                      {isSigner && isAssignedToCurrentUser && (
                        <Badge variant="secondary" className="text-xs">
                          Yours
                        </Badge>
                      )}
                      
                      {tag.isCompleted && (
                        <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                          ✓ Done
                        </Badge>
                      )}
                      
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-xs text-gray-500">
                          {userInfo?.displayName || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Footer - Complete Button */}
      {propMode === 'tagging' && (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleComplete}
            disabled={isCompleting}
            className={`
              w-full py-3 px-4 rounded-lg font-medium transition-colors
              ${isCompleting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
              }
            `}
          >
            {isCompleting ? 'Completing...' : 'Complete Tagging'}
          </button>
          {completionError && (
            <p className="text-sm text-red-600 mt-2">{completionError}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default TaggingToolbar; 