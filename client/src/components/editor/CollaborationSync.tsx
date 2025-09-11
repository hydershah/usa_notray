import React, { useEffect, useRef } from 'react';
import { useWebSocket } from '../../hooks/editor/useWebSocket';
import { useEditorStore } from '../../hooks/editor/useEditorStore';

interface CollaborationSyncProps {
  sessionId: string;
  userId: string;
  enabled?: boolean;
}

export const CollaborationSync: React.FC<CollaborationSyncProps> = ({
  sessionId,
  userId,
  enabled = true
}) => {
  const { 
    mode, 
    currentDocument, 
    viewer, 
    tags,
    addTag,
    updateTag,
    deleteTag,
    selectTag
  } = useEditorStore();
  
  const webSocket = useWebSocket({
    sessionId,
    userId,
    enabled
  });

  const lastTagUpdateRef = useRef<{ tagId: string; timestamp: number } | null>(null);

  // Handle cursor position updates
  const updateCursorPosition = (x: number, y: number) => {
    if (!enabled) return;
    
    webSocket.cursorMoved(x, y);
  };

  // Throttle cursor updates
  const throttledCursorUpdate = useRef(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (x: number, y: number) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          updateCursorPosition(x, y);
        }, 100); // Throttle cursor updates to 10fps
      };
    })()
  );

  // Handle mouse movement for cursor tracking
  useEffect(() => {
    if (!enabled || mode.mode !== 'tagging') return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = viewer.containerRef?.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left) / viewer.scaleFactor;
      const y = (e.clientY - rect.top) / viewer.scaleFactor;

      throttledCursorUpdate(x, y);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [enabled, currentDocument, viewer.currentPage, webSocket]);

  // Handle tag synchronization
  useEffect(() => {
    if (!enabled || mode.mode !== 'tagging') return;

    // Sync tag placement
    const handleTagPlacement = (tag: any) => {
      // Avoid infinite loops by checking if this is our own tag
      const now = Date.now();
      if (lastTagUpdateRef.current?.tagId === tag.id && 
          now - lastTagUpdateRef.current.timestamp < 1000) {
        return;
      }

      webSocket.tagPlaced(tag);
      lastTagUpdateRef.current = { tagId: tag.id, timestamp: now };
    };

    // Sync tag updates
    const handleTagUpdate = (tagId: string, updates: any) => {
      const now = Date.now();
      if (lastTagUpdateRef.current?.tagId === tagId && 
          now - lastTagUpdateRef.current.timestamp < 1000) {
        return;
      }

      webSocket.tagUpdated(tagId, updates);
      lastTagUpdateRef.current = { tagId, timestamp: now };
    };

    // Sync tag deletion
    const handleTagDeletion = (tagId: string) => {
      webSocket.tagDeleted(tagId);
    };

    // Subscribe to tag changes
    // Note: This would ideally be done through a more sophisticated state management system
    // For now, we'll track changes through the selected tag

  }, [enabled, mode.mode, tags, webSocket]);

  // Handle page navigation sync
  useEffect(() => {
    if (!enabled) return;
    
    webSocket.pageChanged(viewer.currentPage);
  }, [enabled, viewer.currentPage, webSocket]);

  // Handle document switching sync
  useEffect(() => {
    if (!enabled || !currentDocument) return;
    
    webSocket.documentSwitched(currentDocument.id);
  }, [enabled, currentDocument?.id, webSocket]);

  // Handle mouse movement for cursor tracking
  useEffect(() => {
    if (!enabled || mode.mode !== 'tagging') return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = viewer.containerRef?.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left) / viewer.scaleFactor;
      const y = (e.clientY - rect.top) / viewer.scaleFactor;

      throttledCursorUpdate(x, y);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [enabled, currentDocument, viewer.currentPage, webSocket]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!enabled || !webSocket) return;

    const handleMessage = (message: any) => {
      switch (message.type) {
        case 'tag_placed':
          if (message.userId !== userId) {
            addTag(message.payload.tag);
          }
          break;
        case 'tag_updated':
          if (message.userId !== userId) {
            updateTag(message.payload.tagId, message.payload.updates);
          }
          break;
        case 'tag_deleted':
          if (message.userId !== userId) {
            deleteTag(message.payload.tagId);
          }
          break;
        case 'cursor_moved':
          if (message.userId !== userId) {
            // Handle cursor position from other users
            // This would update cursor positions in the UI
          }
          break;
        case 'page_changed':
          if (message.userId !== userId) {
            // Handle page navigation from other users
            // This would sync page navigation
          }
          break;
        case 'document_switched':
          if (message.userId !== userId) {
            // Handle document switching from other users
            // This would sync document switching
          }
          break;
      }
    };

    webSocket.onMessage(handleMessage);
    return () => webSocket.offMessage(handleMessage);
  }, [enabled, webSocket, userId, addTag, updateTag, deleteTag]);

  return null; // This component doesn't render anything
};

export default CollaborationSync;
