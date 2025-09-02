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
    currentDocument,
    getTagDimensions,
  } = useEditorStore();

  // Handle tag placement via hotkey
  const handleTagPlacement = useCallback(async (tagType: TagType) => {
    if (!selectedUser || !currentDocument || mode.mode !== 'tagging') return;

    // Get current center of viewport for tag placement
    const centerX = viewer.zoomLevel * 400; // Approximate center X
    const centerY = viewer.zoomLevel * 300; // Approximate center Y

    // Get dimensions using store function (includes custom dimensions if set)
    const dims = getTagDimensions(tagType) || { width: 60, height: 18 };

    try {
      await placeTag({
        documentId: currentDocument.id,
        tagType,
        coordinates: {
          x: centerX / viewer.zoomLevel,
          y: centerY / viewer.zoomLevel,
          width: dims.width,
          height: dims.height,
          pageNumber: viewer.currentPage
        },
        assignedUserId: selectedUser.userId
      });
    } catch (error) {
      console.error('Failed to place tag via hotkey:', error);
    }
  }, [selectedUser, currentDocument, mode.mode, viewer, placeTag, getTagDimensions]);

  // Main keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!actualEnabled) return;

    // Ignore keystrokes in input fields or when a text input is selected
    const target = event.target as HTMLElement;
    const activeTextInputId = (useEditorStore.getState() as any).activeTextInputId;
    // Suppress all hotkeys while a text input is active/being edited
    if (activeTextInputId) {
      return;
    }
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }

    const key = event.key;
    const ctrlKey = event.ctrlKey || event.metaKey;

    // User Switching Shortcuts
    if (key === '`' || key === '~' || key === '0') {
      event.preventDefault();
      
      // If no tag type is currently selected, auto-select 'A' (Name tag) when switching to notary
      const shouldAutoSelectNameTag = !selectedTagType;
      
      if (onUserSwitch) {
        onUserSwitch(0); // 0 for notary
      } else {
        // Fallback to direct store manipulation
        const notary = participants.find(p => p.userType === 'notary');
        if (notary) {
          setSelectedUser(notary);
        }
      }
      
      // Auto-select Name tag ('A') if no tag was previously selected
      if (shouldAutoSelectNameTag) {
        if (onTagTypeSelect) {
          onTagTypeSelect('A');
        } else {
          setSelectedTagType('A');
        }
        console.log('🎯 Auto-selected notary with Name tag (A)');
      }
      
      return;
    }

    // Switch to signers (1-8)
    if (/^[1-8]$/.test(key)) {
      event.preventDefault();
      const userIndex = parseInt(key);
      
      // If no tag type is currently selected, auto-select 'A' (Name tag) when switching users
      const shouldAutoSelectNameTag = !selectedTagType;
      
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
      
      // Auto-select Name tag ('A') if no tag was previously selected
      if (shouldAutoSelectNameTag) {
        if (onTagTypeSelect) {
          onTagTypeSelect('A');
        } else {
          setSelectedTagType('A');
        }
        console.log(`🎯 Auto-selected user ${userIndex} with Name tag (A)`);
      }
      
      return;
    }

    // Tag Placement Shortcuts (allow in both tagging and signing modes)
    if ((mode.mode === 'tagging' || mode.mode === 'signing' || mode.mode === 'notary') && mode.canPlaceTags) {
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

        // Always clear any currently selected tag to avoid multi-selection UI
        selectTag(null);
        
        // Toggle behavior for all tag keys: pressing the same key again deselects the tool
        if (selectedTagType === tagType) {
          setSelectedTagType(null);
          return;
        }

        // Only default to notary if NO user is currently selected
        // If a user is already selected, respect that selection
        if (!selectedUser) {
          const notary = participants.find(p => p.userType === 'notary');
          if (notary) {
            setSelectedUser(notary);
          }
        }
        
        // Check if current user has permission for this tag type
        const effectiveUserType = selectedUser?.userType || 'notary';
        const hasPermission = checkTagPermission(tagType, effectiveUserType);
        
        if (hasPermission) {
          if (onTagTypeSelect) {
            onTagTypeSelect(tagType);
          } else {
            // Fallback to direct store manipulation
            setSelectedTagType(tagType);
          }
          console.log(`🎯 Selected tag ${tagType} for user: ${selectedUser?.displayName || 'Unknown'} (${effectiveUserType})`);
        } else {
          console.warn(`❌ User ${effectiveUserType} doesn't have permission for tag type ${tagType}`);
        }
        return;
      }
    }

    // Escape key - switch to pointer mode
    if (key === 'Escape') {
      event.preventDefault();
      setSelectedTagType(null);
      console.log('👆 Switched to pointer mode');
      return;
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
    // Completely hide the shortcuts box
    return null;
  };

  return (
    <>
      {renderShortcutInfo()}
    </>
  );
};

export default HotkeyHandler; 