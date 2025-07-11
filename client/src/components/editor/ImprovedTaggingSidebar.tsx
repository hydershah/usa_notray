import React, { useCallback, useState } from 'react';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import type { TagType, SessionParticipant } from '../../types/editor';
import { TAG_TYPE_INFO } from '../../types/editor';
import { Badge } from '../ui/badge';
import { AlertCircle, Users, Tag, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ImprovedTaggingSidebarProps {
  sessionId?: string;
  onSessionComplete?: () => void;
  className?: string;
}

interface TagCategoryProps {
  title: string;
  icon: React.ReactNode;
  tagTypes: TagType[];
  selectedTagType: TagType | null;
  onTagSelect: (tagType: TagType) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

const TagCategory: React.FC<TagCategoryProps> = ({
  title,
  icon,
  tagTypes,
  selectedTagType,
  onTagSelect,
  isExpanded,
  onToggle
}) => {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Category Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-sm text-gray-700">{title}</span>
          <Badge variant="secondary" className="text-xs">
            {tagTypes.length}
          </Badge>
        </div>
        <div className={cn(
          "transition-transform duration-200",
          isExpanded ? "rotate-180" : ""
        )}>
          ↓
        </div>
      </button>

      {/* Category Content */}
      {isExpanded && (
        <div className="p-3 space-y-2 bg-white">
          {tagTypes.map(tagType => {
            const tagInfo = TAG_TYPE_INFO[tagType];
            const isSelected = selectedTagType === tagType;
            
            return (
              <button
                key={tagType}
                onClick={() => onTagSelect(tagType)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200",
                  isSelected
                    ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                )}
              >
                {/* Keyboard shortcut */}
                <div className="w-6 h-6 bg-gray-700 text-white text-xs rounded flex items-center justify-center font-mono">
                  {tagType}
                </div>
                
                {/* Tag info */}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{tagInfo.icon}</span>
                    <span className="font-medium text-sm">{tagInfo.label}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {tagInfo.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
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
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-gray-600" />
        <h3 className="font-semibold text-sm text-gray-700">Assign Tags To</h3>
      </div>
      
      <div className="space-y-2">
        {participants.map((participant) => {
          const isSelected = selectedUser?.userId === participant.userId;
          const isCurrentUser = currentUser?.userId === participant.userId;
          
          // Get shortcut key
          const signers = participants.filter(p => p.userType === 'signer');
          let shortcut: string;
          if (participant.userType === 'notary') {
            shortcut = '`';
          } else if (participant.userType === 'signer') {
            const signerIndex = signers.findIndex(s => s.userId === participant.userId);
            shortcut = (signerIndex + 1).toString();
          } else {
            shortcut = '';
          }
          
          return (
            <button
              key={participant.userId}
              onClick={() => onUserSelect(participant)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200",
                isSelected
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              {/* Shortcut key */}
              {shortcut && (
                <div className="w-6 h-6 bg-gray-700 text-white text-xs rounded flex items-center justify-center font-mono">
                  {shortcut}
                </div>
              )}
              
              {/* User color indicator */}
              <div 
                className="w-3 h-3 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: participant.colorCode }}
              />
              
              {/* User info */}
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{participant.displayName}</span>
                  {isCurrentUser && (
                    <Badge variant="secondary" className="text-xs">You</Badge>
                  )}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {participant.userType}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const ImprovedTaggingSidebar: React.FC<ImprovedTaggingSidebarProps> = ({
  sessionId,
  onSessionComplete,
  className = ''
}) => {
  const {
    mode,
    selectedTagType,
    setSelectedTagType,
    participants,
    selectedUser,
    currentUser,
    setSelectedUser,
    tags
  } = useEditorStore();

  const [expandedCategories, setExpandedCategories] = useState({
    universal: true,
    signer: true,
    notary: false
  });

  // User role detection
  const isSigner = currentUser?.userType === 'signer';
  const isNotary = currentUser?.userType === 'notary';
  const isAdmin = currentUser?.role === 'admin';
  const canPlaceTags = mode.mode === 'tagging' || (mode.mode === 'signing' && (isNotary || isAdmin));

  // Get available tag types
  const getAvailableTagTypes = useCallback((user: SessionParticipant | null): TagType[] => {
    if (!user) return [];
    
    const universalTags: TagType[] = ['T', 'D'];
    const signerTags: TagType[] = ['A', 'S', 'I'];
    const notaryTags: TagType[] = ['N', 'X', 'O', 'E', 'W'];
    
    if (mode.mode === 'signing') {
      switch (user.userType) {
        case 'notary':
          return [...universalTags, ...signerTags, ...notaryTags];
        case 'signer':
          return [];
        default:
          return [];
      }
    }
    
    switch (user.userType) {
      case 'notary':
        return [...universalTags, ...signerTags, ...notaryTags];
      case 'signer':
        return [...universalTags, ...signerTags];
      default:
        return [];
    }
  }, [mode.mode]);

  const availableTagTypes = getAvailableTagTypes(selectedUser);

  // Tag categories
  const universalTags = availableTagTypes.filter(t => ['T', 'D'].includes(t));
  const signerTags = availableTagTypes.filter(t => ['A', 'S', 'I'].includes(t));
  const notaryTags = availableTagTypes.filter(t => ['N', 'X', 'O', 'E', 'W'].includes(t));

  // Handlers
  const handleTagSelect = useCallback((tagType: TagType) => {
    if (selectedTagType === tagType) {
      setSelectedTagType(null);
    } else {
      setSelectedTagType(tagType);
    }
  }, [selectedTagType, setSelectedTagType]);

  const handleUserSelect = useCallback((user: SessionParticipant) => {
    setSelectedUser(user);
    setSelectedTagType(null);
  }, [setSelectedUser, setSelectedTagType]);

  const toggleCategory = (category: keyof typeof expandedCategories) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const completedTags = tags.filter(tag => tag.isCompleted);

  return (
    <div className={cn("w-80 bg-white border-l border-gray-200 flex flex-col", className)}>
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-900">Document Tags</h2>
          {isSigner && (
            <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs">
              Signer
            </Badge>
          )}
          {isNotary && (
            <Badge className="bg-red-100 text-red-800 border-red-300 text-xs">
              Notary
            </Badge>
          )}
        </div>
        
        {/* Status summary */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-gray-600">
            <Tag className="h-4 w-4" />
            <span className="font-medium">{tags.length}</span>
            <span>total</span>
          </div>
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">{completedTags.length}</span>
            <span>done</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Signer restriction message */}
        {isSigner && mode?.mode === 'signing' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-800 mb-1">
                  View Mode
                </h3>
                <p className="text-sm text-amber-700">
                  You can view and complete tags assigned to you, but cannot create new ones.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* User selection */}
        {!isSigner && (
          <UserSelector
            participants={participants}
            selectedUser={selectedUser}
            currentUser={currentUser}
            onUserSelect={handleUserSelect}
          />
        )}

        {/* Tag categories */}
        {selectedUser && availableTagTypes.length > 0 && !isSigner && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-gray-600" />
              <h3 className="font-semibold text-sm text-gray-700">Tag Types</h3>
            </div>

            {/* Universal tags */}
            {universalTags.length > 0 && (
              <TagCategory
                title="Universal Tags"
                icon={<Circle className="h-4 w-4 text-blue-600" />}
                tagTypes={universalTags}
                selectedTagType={selectedTagType}
                onTagSelect={handleTagSelect}
                isExpanded={expandedCategories.universal}
                onToggle={() => toggleCategory('universal')}
              />
            )}

            {/* Signer tags */}
            {signerTags.length > 0 && (
              <TagCategory
                title="Signer Tags"
                icon={<Users className="h-4 w-4 text-green-600" />}
                tagTypes={signerTags}
                selectedTagType={selectedTagType}
                onTagSelect={handleTagSelect}
                isExpanded={expandedCategories.signer}
                onToggle={() => toggleCategory('signer')}
              />
            )}

            {/* Notary tags */}
            {notaryTags.length > 0 && (
              <TagCategory
                title="Notary Tags"
                icon={<Badge className="h-4 w-4 text-red-600" />}
                tagTypes={notaryTags}
                selectedTagType={selectedTagType}
                onTagSelect={handleTagSelect}
                isExpanded={expandedCategories.notary}
                onToggle={() => toggleCategory('notary')}
              />
            )}
          </div>
        )}

        {/* Active selection indicator */}
        {selectedUser && selectedTagType && !isSigner && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-blue-800">Ready to Place</span>
            </div>
            <div className="text-sm text-blue-700">
              Click on the PDF to place <strong>{TAG_TYPE_INFO[selectedTagType].icon} {TAG_TYPE_INFO[selectedTagType].label}</strong> for <strong>{selectedUser.displayName}</strong>
            </div>
          </div>
        )}

        {/* Tag list summary */}
        {tags.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-700">
              {isSigner ? 'Your Tags' : 'Placed Tags'}
            </h3>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {tags
                .filter(tag => !isSigner || tag.assignedUserId === currentUser?.userId)
                .map(tag => {
                  const tagInfo = TAG_TYPE_INFO[tag.tagType];
                  const userInfo = participants.find(p => p.userId === tag.assignedUserId);
                  
                  return (
                    <div
                      key={tag.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg border text-xs",
                        tag.isCompleted
                          ? "bg-green-50 border-green-200"
                          : "bg-gray-50 border-gray-200"
                      )}
                    >
                      <span className="text-sm">{tagInfo.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{tagInfo.label}</div>
                        {userInfo && (
                          <div className="text-gray-500">{userInfo.displayName}</div>
                        )}
                      </div>
                      {tag.isCompleted && (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 