import React, { useCallback, useState } from 'react';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import type { TagType, SessionParticipant } from '../../types/editor';
import { TAG_TYPE_INFO, USER_COLORS } from '../../types/editor';
import { Badge } from '../ui/badge';
import { AlertCircle } from 'lucide-react';

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

  // ✅ ENHANCED USER ROLE DETECTION FOR UI RESTRICTIONS
  const isSigner = currentUser?.userType === 'signer';
  const isNotary = currentUser?.userType === 'notary';
  const isAdmin = currentUser?.role === 'admin';
  const canPlaceTags = mode.mode === 'tagging' || (mode.mode === 'signing' && (isNotary || isAdmin));

  // Define available tag types based on user role - SIGNER RESTRICTIONS
  const getAvailableTagTypes = useCallback((user: SessionParticipant | null): TagType[] => {
    if (!user) return [];
    
    const universalTags: TagType[] = ['T', 'D']; // Text and Date available to all
    const signerTags: TagType[] = ['A', 'S', 'I']; // Name, Signature, Initials
    const notaryTags: TagType[] = ['N', 'X', 'O', 'E', 'W']; // Commission, Expiration, Disclosure, Seal, Whiteout
    
    // ❌ SIGNERS CANNOT PLACE NEW TAGS - only notary/admin can
    if (mode.mode === 'signing') {
      switch (user.userType) {
        case 'notary':
          return [...universalTags, ...signerTags, ...notaryTags];
        case 'signer':
          return []; // ❌ SIGNERS CANNOT PLACE NEW TAGS IN SIGNING MODE
        case 'witness':
          return []; // Witnesses cannot place tags
        default:
          return [];
      }
    }
    
    // In tagging mode, allow normal permissions
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
  }, [mode.mode]);

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
      {/* Fixed Header - ENHANCED WITH ROLE INDICATOR */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode?.mode === 'signing' ? 'Document Tags & Content' : 'Tag Placement'}
          </h2>
          
          {/* ✅ ROLE INDICATOR */}
          {isSigner && (
            <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs">
              👤 Signer
            </Badge>
          )}
          {isNotary && (
            <Badge className="bg-red-100 text-red-800 border-red-300 text-xs">
              🔐 Notary
            </Badge>
          )}
        </div>
        
        <p className="text-sm text-gray-600">
          {mode?.mode === 'signing' 
            ? isSigner 
              ? 'View tags and complete those assigned to you'
              : 'Add more tags or complete existing tags with content'
            : 'Place tags on the document for signers'
          }
        </p>
        <div className="mt-2 text-sm text-gray-700">
          <span className="font-medium">{tags.length}</span> tags placed
          {mode?.mode === 'signing' && (
            <span className="ml-2 text-blue-600">
              • {tags.filter(t => t.isCompleted).length} completed
            </span>
          )}
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

      {/* ❌ SIGNERS CANNOT SEE USER SELECTION - HIDE FOR SIGNERS */}
      {!isSigner && (
        <UserSelector
          participants={participants}
          selectedUser={selectedUser}
          currentUser={currentUser}
          onUserSelect={handleUserSelect}
        />
      )}

      {/* ✅ SIGNER RESTRICTION MESSAGE */}
      {isSigner && mode?.mode === 'signing' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                Restricted Access - Signer Role
              </h3>
              <p className="text-sm text-yellow-700">
                You cannot place new tags or modify the document structure. 
                The notary will assign tags to you that you can fill out.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tag Type Selection - HIDDEN FOR SIGNERS */}
      {selectedUser && availableTagTypes.length > 0 && !isSigner && (
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

      {/* Current Selection Display - HIDDEN FOR SIGNERS */}
      {selectedUser && selectedTagType && !isSigner && (
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
          <h3 className="text-sm font-semibold text-gray-700">
            {isSigner ? 'Document Tags' : `Placed Tags (${tags.length})`}
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
                  
                  {/* ✅ SIGNER-SPECIFIC TAG STATUS */}
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

      {/* Instructions - Enhanced for Different User Types */}
      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-2">
        {currentUser?.userType === 'signer' && mode?.mode === 'signing' ? (
          // ✅ ENHANCED SIGNER-SPECIFIC INSTRUCTIONS
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
              <div className="font-medium text-blue-700 text-sm">Signer Instructions</div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded p-3 space-y-2">
              <div className="font-medium text-green-800 text-sm">✅ What you CAN do:</div>
              <div className="text-green-700 space-y-1 text-xs">
                <div>• View the entire document</div>
                <div>• Click on tags assigned to you (marked "Yours")</div>
                <div>• Fill out text and date fields when active</div>
                <div>• Apply your signature when requested</div>
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded p-3 space-y-2">
              <div className="font-medium text-red-800 text-sm">❌ What you CANNOT do:</div>
              <div className="text-red-700 space-y-1 text-xs">
                <div>• Place new tags on the document</div>
                <div>• Edit tags assigned to others</div>
                <div>• Control the session (start/stop/pause)</div>
                <div>• Change document structure</div>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <div className="text-blue-700 text-xs italic text-center">
                🎯 The notary will guide you through each step of the signing process
              </div>
            </div>
          </div>
        ) : (
          // ✅ NOTARY/ADMIN INSTRUCTIONS
          <div className="space-y-1">
            <div className="font-medium flex items-center gap-2">
              <div className="h-2 w-2 bg-red-500 rounded-full"></div>
              <span>Notary Controls</span>
            </div>
            <div className="space-y-1">
              <div>• Use keyboard shortcuts for faster tagging</div>
              <div>• Click and drag to resize tags</div>
              <div>• Press Delete to remove selected tags</div>
              <div>• Activate signers with hotkeys (1-9) during live sessions</div>
              <div>• Guide signers through the document completion</div>
            </div>
          </div>
        )}
      </div>


      </div>
    </div>
  );
};

export default TaggingToolbar; 