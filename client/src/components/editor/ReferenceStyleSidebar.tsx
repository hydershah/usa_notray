import React, { useCallback, useState } from 'react';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import type { TagType, SessionParticipant } from '../../types/editor';
import { TAG_TYPE_INFO } from '../../types/editor';
import { 
  MousePointer2, 
  Type, 
  X, 
  Users, 
  Edit3, 
  Calendar, 
  FileText,
  CheckCircle2,
  CreditCard,
  Shield,
  FileCheck,
  Stamp,
  Trash2,
  Target
} from 'lucide-react';

interface ReferenceStyleSidebarProps {
  sessionId?: string;
  onSessionComplete?: () => void;
  className?: string;
}

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  isSelected?: boolean;
  onClick: () => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({
  icon,
  label,
  shortcut,
  isSelected = false,
  onClick
}) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
      }`}
    >
      <div className="w-5 h-5 flex-shrink-0">
        {icon}
      </div>
      <span className="flex-1 text-sm">{label}</span>
      <span className="text-xs text-gray-500 font-mono">
        {shortcut}
      </span>
    </button>
  );
};

interface FieldButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  tagType: TagType;
  isSelected?: boolean;
  onClick: () => void;
}

const FieldButton: React.FC<FieldButtonProps> = ({
  icon,
  label,
  shortcut,
  tagType,
  isSelected = false,
  onClick
}) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-2 text-left hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
      }`}
    >
      <div className="w-5 h-5 flex-shrink-0">
        {icon}
      </div>
      <span className="flex-1 text-sm">{label}</span>
      <span className="text-xs text-gray-500">
        {shortcut}
      </span>
    </button>
  );
};

export const ReferenceStyleSidebar: React.FC<ReferenceStyleSidebarProps> = ({
  sessionId,
  onSessionComplete,
  className = ''
}) => {
  const {
    selectedTagType,
    setSelectedTagType,
    participants,
    selectedUser,
    currentUser,
    setSelectedUser,
    tags,
    mode,
    selectedTag,
    selectTag,
    deleteTag
  } = useEditorStore();

  // Local state for tool selection
  const [selectedTool, setSelectedTool] = useState<'pointer' | 'text' | 'na' | null>('pointer');

  // Tool handlers
  const handlePointerSelect = useCallback(() => {
    setSelectedTool('pointer');
    setSelectedTagType(null);
  }, [setSelectedTagType]);

  const handleTextSelect = useCallback(() => {
    setSelectedTool('text');
    setSelectedTagType('T');
  }, [setSelectedTagType]);

  const handleNASelect = useCallback(() => {
    setSelectedTool('na');
    // N/A functionality - use whiteout to cover content
    setSelectedTagType('W');
  }, [setSelectedTagType]);

  // Field handlers
  const handleTagTypeSelect = useCallback((tagType: TagType) => {
    setSelectedTool(null); // Clear tool selection when selecting a field
    if (selectedTagType === tagType) {
      setSelectedTagType(null);
    } else {
      setSelectedTagType(tagType);
    }
  }, [selectedTagType, setSelectedTagType]);



  // Session completion handler
  const handleSessionComplete = useCallback(async () => {
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
              if (onSessionComplete) {
                onSessionComplete();
              }
            }
          }
        } else {
          alert(result.message || 'Failed to complete session');
        }
      } else {
        console.log('✅ Session completed successfully');
        if (onSessionComplete) {
          onSessionComplete();
        }
      }
    } catch (error) {
      console.error('❌ Failed to complete session:', error);
      alert('Failed to complete session');
    }
  }, [sessionId, onSessionComplete]);

  const signers = participants.filter(p => p.userType === 'signer');

  return (
    <div className={`w-80 bg-white border-l border-gray-200 flex flex-col h-full ${className}`}>
      {/* Tools Section */}
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <MousePointer2 className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-medium text-gray-900">Tools</h3>
        </div>
        <div className="space-y-1">
          <ToolButton
            icon={<MousePointer2 className="w-4 h-4" />}
            label="Pointer"
            shortcut="p"
            isSelected={selectedTool === 'pointer'}
            onClick={handlePointerSelect}
          />
          <ToolButton
            icon={<Type className="w-4 h-4" />}
            label="Text"
            shortcut="t"
            isSelected={selectedTool === 'text'}
            onClick={handleTextSelect}
          />
          <ToolButton
            icon={<X className="w-4 h-4" />}
            label="N/A"
            shortcut="z"
            isSelected={selectedTool === 'na'}
            onClick={handleNASelect}
          />
        </div>
      </div>

      {/* Penholder Fields Section - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Edit3 className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-medium text-gray-900">Penholder Fields</h3>
        </div>

        {/* User Selection - First Step */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">1. Select User for Tag Assignment</h4>
          </div>
          <div className="space-y-1">
            {participants.map((participant, index) => {
              const isSelected = selectedUser?.userId === participant.userId;
              const isCurrentUser = currentUser?.userId === participant.userId;
              
              // Calculate correct shortcut based on user type
              const signers = participants.filter(p => p.userType === 'signer');
              let shortcut: string;
              if (participant.userType === 'notary') {
                shortcut = '`';
              } else if (participant.userType === 'signer') {
                const signerIndex = signers.findIndex(s => s.userId === participant.userId);
                shortcut = (signerIndex + 1).toString();
              } else {
                shortcut = ''; // Other user types don't have shortcuts
              }
              
              return (
                <button
                  key={participant.userId}
                  onClick={() => {
                    setSelectedUser(participant);
                    setSelectedTagType(null); // Clear tag type when switching users
                    setSelectedTool('pointer'); // Reset to pointer tool
                  }}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg border-2 text-left transition-all ${
                    isSelected 
                      ? participant.userType === 'notary' 
                        ? 'border-red-500 bg-red-50 text-red-700' 
                        : 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                  }`}
                  title={`Assign tags to ${participant.displayName} (Press ${shortcut})`}
                >
                  {/* Shortcut Key */}
                  {shortcut && (
                    <div className="w-5 h-5 bg-gray-700 text-white text-xs rounded flex items-center justify-center font-mono">
                      {shortcut}
                    </div>
                  )}
                  
                  {/* Color dot */}
                  <div 
                    className="w-3 h-3 rounded-full border border-white shadow-sm"
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
                    <div className="text-xs opacity-75 capitalize">
                      {participant.userType}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tag Type Selection - Second Step */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Edit3 className="w-4 h-4 text-green-600" />
            <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">2. Select Tag Type</h4>
          </div>
        </div>

        <div className="space-y-1">
          {/* Universal Fields */}
          <FieldButton
            icon={<Type className="w-4 h-4" />}
            label="Fill in Here"
            shortcut="[ctrl+u]"
            tagType="A"
            isSelected={selectedTagType === 'A'}
            onClick={() => handleTagTypeSelect('A')}
          />
          <FieldButton
            icon={<Edit3 className="w-4 h-4" />}
            label="Sign Here"
            shortcut="[ctrl+s]"
            tagType="S"
            isSelected={selectedTagType === 'S'}
            onClick={() => handleTagTypeSelect('S')}
          />
          <FieldButton
            icon={<FileText className="w-4 h-4" />}
            label="Initial Here"
            shortcut="[ctrl+i]"
            tagType="I"
            isSelected={selectedTagType === 'I'}
            onClick={() => handleTagTypeSelect('I')}
          />
          <FieldButton
            icon={<Calendar className="w-4 h-4" />}
            label="Date Signed"
            shortcut="[ctrl+d]"
            tagType="D"
            isSelected={selectedTagType === 'D'}
            onClick={() => handleTagTypeSelect('D')}
          />

          {/* Notary Fields */}
          {(currentUser?.userType === 'notary' || currentUser?.role === 'admin') && (
            <>
              <div className="border-t border-gray-100 my-2"></div>
              <div className="text-xs text-gray-500 uppercase tracking-wide px-2 py-1">Notary Fields</div>
              
              <FieldButton
                icon={<CreditCard className="w-4 h-4" />}
                label="Commission Number"
                shortcut="[ctrl+n]"
                tagType="N"
                isSelected={selectedTagType === 'N'}
                onClick={() => handleTagTypeSelect('N')}
              />
              <FieldButton
                icon={<Calendar className="w-4 h-4" />}
                label="Commission Expiration"
                shortcut="[ctrl+x]"
                tagType="X"
                isSelected={selectedTagType === 'X'}
                onClick={() => handleTagTypeSelect('X')}
              />
              <FieldButton
                icon={<FileCheck className="w-4 h-4" />}
                label="Disclosure Statement"
                shortcut="[ctrl+o]"
                tagType="O"
                isSelected={selectedTagType === 'O'}
                onClick={() => handleTagTypeSelect('O')}
              />
              <FieldButton
                icon={<Stamp className="w-4 h-4" />}
                label="Notary Seal"
                shortcut="[ctrl+e]"
                tagType="E"
                isSelected={selectedTagType === 'E'}
                onClick={() => handleTagTypeSelect('E')}
              />
              <FieldButton
                icon={<Shield className="w-4 h-4" />}
                label="Whiteout/Cover"
                shortcut="[ctrl+w]"
                tagType="W"
                isSelected={selectedTagType === 'W'}
                onClick={() => handleTagTypeSelect('W')}
              />
            </>
          )}

          {/* Current Selection Status */}
          {selectedUser && selectedTagType && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-medium text-blue-800 uppercase tracking-wide">3. Ready to Place Tag</h4>
              </div>
              <div className="text-sm text-blue-700">
                <span className="font-medium">{TAG_TYPE_INFO[selectedTagType].icon} {TAG_TYPE_INFO[selectedTagType].label}</span>
                <span className="text-blue-600"> for </span>
                <span className="font-medium">{selectedUser.displayName}</span>
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Click on the document to place this tag
              </div>
            </div>
          )}

          {/* Instructions */}
          {!selectedUser && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-600">
                <strong>Step 1:</strong> Select a user above to assign tags to
              </div>
            </div>
          )}

                     {selectedUser && !selectedTagType && (
             <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
               <div className="text-xs text-yellow-700">
                 <strong>Step 2:</strong> Select a tag type above to place for <strong>{selectedUser.displayName}</strong>
               </div>
             </div>
           )}

          {/* Selected Tag Management */}
          {selectedTag && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-red-600" />
                <h4 className="text-xs font-medium text-red-800 uppercase tracking-wide">Selected Tag</h4>
              </div>
              <div className="text-sm text-red-700 mb-2">
                <span className="font-medium">{TAG_TYPE_INFO[selectedTag.tagType].icon} {TAG_TYPE_INFO[selectedTag.tagType].label}</span>
                <span className="text-red-600"> • Page {selectedTag.coordinates.pageNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this tag?')) {
                      deleteTag(selectedTag.id);
                      selectTag(null);
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
                <button
                  onClick={() => selectTag(null)}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Deselect
                </button>
              </div>
              <div className="text-xs text-red-600 mt-2">
                💡 You can also press <kbd className="bg-red-200 px-1 rounded">Delete</kbd> or <kbd className="bg-red-200 px-1 rounded">Backspace</kbd> to delete
              </div>
            </div>
          )}

          {/* Tag Usage Instructions */}
          {!selectedTag && tags.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-xs text-blue-700">
                <strong>💡 Tip:</strong> Click on any tag in the document to select it, then use the Delete key or the delete button to remove it.
              </div>
            </div>
          )}

          </div>
        </div>
      </div>

      {/* Session Completion Section */}
      {mode?.mode === 'tagging' && (
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <div className="space-y-3">
            <div className="text-xs text-gray-500 text-center">
              {tags.length} tags placed
            </div>
            <button
              onClick={handleSessionComplete}
              className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg font-medium transition-colors ${
                tags.length === 0
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{tags.length === 0 ? 'Complete Without Tags' : 'Complete Tagging'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}; 