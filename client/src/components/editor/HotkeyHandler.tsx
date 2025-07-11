import React, { useEffect, useCallback, useState } from 'react';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import type { TagType } from '../../types/editor';
import { ChevronUp, ChevronDown, Keyboard } from 'lucide-react';

interface HotkeyHandlerProps {
  isEnabled?: boolean;
  enabled?: boolean;
  onUserSwitch?: (userIndex: number) => void;
  onTagTypeSelect?: (tagType: TagType) => void;
}

export const HotkeyHandler: React.FC<HotkeyHandlerProps> = ({ 
  isEnabled = true, 
  enabled = true,
  onUserSwitch,
  onTagTypeSelect 
}) => {
  const actualEnabled = enabled ?? isEnabled;
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Load collapsed state from localStorage
    const saved = localStorage.getItem('hotkey-shortcuts-collapsed');
    return saved === 'true';
  });
  const {
    mode,
    participants,
    selectedUser,
    currentUser,
    selectedTag,
    selectedTagType,
    viewer,
    switchUser,
    setSelectedUser,
    setSelectedTagType,
    deleteTag,
    selectTag,
    setCurrentPage,
    placeTag,
    currentDocument
  } = useEditorStore();

  // Handle tag placement via hotkey
  const handleTagPlacement = useCallback(async (tagType: TagType) => {
    if (!selectedUser || !currentDocument || mode.mode !== 'tagging') return;

    // Get current center of viewport for tag placement
    const centerX = viewer.zoomLevel * 400; // Approximate center X
    const centerY = viewer.zoomLevel * 300; // Approximate center Y

    try {
      await placeTag({
        documentId: currentDocument.id,
        tagType,
        coordinates: {
          x: centerX / viewer.zoomLevel,
          y: centerY / viewer.zoomLevel,
          width: 94,
          height: 25,
          pageNumber: viewer.currentPage
        },
        assignedUserId: selectedUser.userId
      });
    } catch (error) {
      console.error('Failed to place tag via hotkey:', error);
    }
  }, [selectedUser, currentDocument, mode.mode, viewer, placeTag]);

  // Main keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!actualEnabled) return;

    // Ignore keystrokes in input fields
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }

    const key = event.key;
    const ctrlKey = event.ctrlKey || event.metaKey;

    // User Switching Shortcuts
    if (key === '`' || key === '~') {
      event.preventDefault();
      if (onUserSwitch) {
        onUserSwitch(0); // 0 for notary
      } else {
        // Fallback to direct store manipulation
        const notary = participants.find(p => p.userType === 'notary');
        if (notary) {
          setSelectedUser(notary);
        }
      }
      return;
    }

    // Switch to signers (1-8)
    if (/^[1-8]$/.test(key)) {
      event.preventDefault();
      const userIndex = parseInt(key);
      if (onUserSwitch) {
        onUserSwitch(userIndex);
      } else {
        // Fallback to direct store manipulation
        const signerIndex = userIndex - 1;
        const signers = participants.filter(p => p.userType === 'signer');
        if (signers[signerIndex]) {
          setSelectedUser(signers[signerIndex]);
        }
      }
      return;
    }

    // Tag Placement Shortcuts (allow in both tagging and signing modes)
    if ((mode.mode === 'tagging' || mode.mode === 'signing') && mode.canPlaceTags && selectedUser) {
      const tagTypeMap: Record<string, TagType> = {
        'A': 'A', // Name tag
        'S': 'S', // Signature tag
        'I': 'I', // Initials tag
        'N': 'N', // Commission Number tag (notary only)
        'X': 'X', // Commission Expiration tag (notary only)
        'O': 'O', // Disclosure tag (notary only)
        'E': 'E', // Seal tag (notary only)
        'W': 'W', // Whiteout tag (notary only)
        'T': 'T', // Text tag (universal)
        'D': 'D', // Date tag (universal)
      };

      const tagType = tagTypeMap[key.toUpperCase()];
      
      if (tagType) {
        event.preventDefault();
        
        // Check if user has permission for this tag type
        const hasPermission = checkTagPermission(tagType, selectedUser.userType);
        
        if (hasPermission) {
          if (onTagTypeSelect) {
            onTagTypeSelect(tagType);
          } else {
            // Fallback to direct store manipulation
            if (selectedTagType === tagType) {
              // If already selected, place the tag
              handleTagPlacement(tagType);
            } else {
              // Select the tag type
              setSelectedTagType(tagType);
            }
          }
        }
        return;
      }
    }

    // Navigation and Editing Shortcuts
    switch (key) {
      case 'Delete':
      case 'Backspace':
        if (selectedTag && mode.canPlaceTags) {
          event.preventDefault();
          deleteTag(selectedTag.id);
        }
        break;

      case 'Escape':
        event.preventDefault();
        selectTag(null);
        setSelectedTagType(null);
        break;

      case 'ArrowUp':
        if (selectedTag && mode.canPlaceTags) {
          event.preventDefault();
          moveSelectedTag(0, -5);
        }
        break;

      case 'ArrowDown':
        if (selectedTag && mode.canPlaceTags) {
          event.preventDefault();
          moveSelectedTag(0, 5);
        }
        break;

      case 'ArrowLeft':
        if (selectedTag && mode.canPlaceTags) {
          event.preventDefault();
          moveSelectedTag(-5, 0);
        }
        break;

      case 'ArrowRight':
        if (selectedTag && mode.canPlaceTags) {
          event.preventDefault();
          moveSelectedTag(5, 0);
        }
        break;

      case 'PageUp':
        event.preventDefault();
        if (viewer.currentPage > 1) {
          setCurrentPage(viewer.currentPage - 1);
        }
        break;

      case 'PageDown':
        event.preventDefault();
        if (viewer.currentPage < viewer.totalPages) {
          setCurrentPage(viewer.currentPage + 1);
        }
        break;

      case 'Home':
        if (ctrlKey) {
          event.preventDefault();
          setCurrentPage(1);
        }
        break;

      case 'End':
        if (ctrlKey) {
          event.preventDefault();
          setCurrentPage(viewer.totalPages);
        }
        break;
    }

    // Undo/Redo shortcuts
    if (ctrlKey) {
      switch (key) {
        case 'z':
          event.preventDefault();
          // TODO: Implement undo
          console.log('Undo requested');
          break;

        case 'y':
          event.preventDefault();
          // TODO: Implement redo
          console.log('Redo requested');
          break;
      }
    }
  }, [
    actualEnabled,
    participants,
    selectedUser,
    mode,
    selectedTagType,
    selectedTag,
    viewer,
    switchUser,
    setSelectedUser,
    setSelectedTagType,
    deleteTag,
    selectTag,
    setCurrentPage,
    handleTagPlacement,
    onUserSwitch,
    onTagTypeSelect
  ]);

  // Helper function to move selected tag
  const moveSelectedTag = useCallback((deltaX: number, deltaY: number) => {
    if (!selectedTag) return;

    const newCoordinates = {
      ...selectedTag.coordinates,
      x: selectedTag.coordinates.x + deltaX,
      y: selectedTag.coordinates.y + deltaY
    };

    useEditorStore.getState().updateTag(selectedTag.id, { coordinates: newCoordinates });
  }, [selectedTag]);

  // Helper function to check tag permissions
  const checkTagPermission = useCallback((tagType: TagType, userType: string): boolean => {
    const universalTags: TagType[] = ['T', 'D']; // Text and Date
    const signerTags: TagType[] = ['A', 'S', 'I']; // Name, Signature, Initials
    const notaryTags: TagType[] = ['N', 'X', 'O', 'E', 'W']; // Notary-specific tags

    switch (userType) {
      case 'notary':
        return true; // Notary can place all tags
      case 'signer':
        return [...universalTags, ...signerTags].includes(tagType);
      case 'witness':
        return false; // Witnesses cannot place tags
      default:
        return false;
    }
  }, []);

  // Attach event listeners
  useEffect(() => {
    if (!actualEnabled) return;

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, actualEnabled]);

  // Display current shortcuts info
  const renderShortcutInfo = () => {
    // Show in all environments - this is useful for users
    // if (process.env.NODE_ENV !== 'development') return null;

    return (
      <div className={`fixed bottom-4 left-4 bg-black bg-opacity-85 text-white text-xs rounded-lg shadow-lg border border-gray-600 transition-all duration-200 ${isCollapsed ? 'w-auto' : 'max-w-xs'}`}>
        {/* Header with toggle button */}
        <div 
          className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800 hover:bg-opacity-50 ${isCollapsed ? 'rounded-lg' : 'rounded-t-lg'} select-none`}
          onClick={() => {
            const newCollapsed = !isCollapsed;
            setIsCollapsed(newCollapsed);
            localStorage.setItem('hotkey-shortcuts-collapsed', newCollapsed.toString());
          }}
          title={isCollapsed ? 'Expand shortcuts' : 'Collapse shortcuts'}
        >
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-blue-300" />
            <span className="font-bold text-blue-300">Active Shortcuts</span>
          </div>
          <div className="flex items-center gap-2">
            {isCollapsed && selectedUser && (
              <span className="text-yellow-300 mr-2">
                {selectedUser.displayName} {selectedTagType && `| ${selectedTagType}`}
              </span>
            )}
            {isCollapsed ? (
              <ChevronUp className="h-4 w-4 text-gray-400 hover:text-white transition-colors" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400 hover:text-white transition-colors" />
            )}
          </div>
        </div>
        
        {/* Collapsible content */}
        {!isCollapsed && (
          <div className="px-3 pb-3">
            <div className="space-y-1">
              <div>• ` → Notary, 1-8 → Signers</div>
              <div>• A,S,I,N,X,O,E,W,T,D → Tag types</div>
              <div>• Del → Delete tag, Esc → Deselect</div>
              <div>• Arrows → Move tag, PgUp/PgDn → Pages</div>
              <div>• Ctrl+Z/Y → Undo/Redo</div>
            </div>
            {selectedUser && (
              <div className="mt-2 pt-2 border-t border-gray-600 text-yellow-300">
                Selected: {selectedUser?.displayName || 'None'} ({selectedUser?.userType || 'None'})
                {selectedTagType && <span> | Tag: {selectedTagType}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {renderShortcutInfo()}
    </>
  );
};

export default HotkeyHandler; 