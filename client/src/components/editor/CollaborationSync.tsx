import React, { useEffect, useCallback, useRef } from 'react';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { useWebSocket } from '../../hooks/editor/useWebSocket';
import type { DocumentTag, TagCoordinates } from '../../types/editor';

interface CollaborationSyncProps {
  sessionId: string;
  userId: string;
  enabled?: boolean;
}

interface CursorIndicator {
  userId: string;
  displayName: string;
  color: string;
  x: number;
  y: number;
  pageNumber: number;
  documentId: string;
  isVisible: boolean;
}

export const CollaborationSync: React.FC<CollaborationSyncProps> = ({
  sessionId,
  userId,
  enabled = true
}) => {
  const cursorUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTagUpdateRef = useRef<{ tagId: string; timestamp: number } | null>(null);
  
  const {
    tags,
    selectedTag,
    viewer,
    currentDocument,
    participants,
    mode,
    cursors,
    updateCursor
  } = useEditorStore();

  const webSocket = useWebSocket({
    sessionId,
    userId,
    autoReconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10
  });

  // Throttled cursor position updates
  const updateCursorPosition = useCallback((x: number, y: number) => {
    if (!enabled || !currentDocument) return;

    if (cursorUpdateTimeoutRef.current) {
      clearTimeout(cursorUpdateTimeoutRef.current);
    }

    cursorUpdateTimeoutRef.current = setTimeout(() => {
      webSocket.cursorMoved(x, y, viewer.currentPage, currentDocument.id);
    }, 100); // Throttle cursor updates to 10fps
  }, [enabled, currentDocument, viewer.currentPage, webSocket]);

  // Handle tag synchronization
  useEffect(() => {
    if (!enabled || mode.mode !== 'tagging') return;

    // Sync tag placement
    const handleTagPlacement = (tag: DocumentTag) => {
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
    if (!enabled) return;

    const handleMouseMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Only track cursor on PDF canvas elements
      if (target.tagName === 'CANVAS' && target.dataset.pageNumber) {
        const rect = target.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        updateCursorPosition(x, y);
      }
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [enabled, updateCursorPosition]);

  // Render cursor indicators for other users
  const renderCursorIndicators = () => {
    if (!enabled || !currentDocument) return null;

    return cursors
      .filter(cursor => 
        cursor.userId !== userId && 
        cursor.documentId === currentDocument.id &&
        cursor.pageNumber === viewer.currentPage
      )
      .map(cursor => {
        const participant = participants.find(p => p.userId === cursor.userId);
        if (!participant) return null;

        return (
          <div
            key={cursor.userId}
            className="absolute pointer-events-none z-50"
            style={{
              left: `${cursor.x * viewer.zoomLevel}px`,
              top: `${cursor.y * viewer.zoomLevel}px`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            {/* Cursor pointer */}
            <div
              className="relative"
              style={{ color: participant.colorCode }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 2 L2 18 L7 13 L11 13 L11 11 L9 11 L9 9 L7 9 L7 7 L18 7 L18 2 Z" />
              </svg>
              
              {/* User name label */}
              <div
                className="absolute left-6 top-0 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap"
                style={{ backgroundColor: participant.colorCode }}
              >
                {participant.displayName}
              </div>
            </div>
          </div>
        );
      });
  };

  // Connection status indicator
  const renderConnectionStatus = () => {
    if (!enabled) return null;

    const { connectionState } = webSocket;

    return (
      <div className="fixed top-4 right-4 z-50">
        <div className={`
          flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
          ${connectionState.isConnected 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : connectionState.isConnecting
            ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
            : 'bg-red-100 text-red-800 border border-red-200'
          }
        `}>
          <div className={`
            w-2 h-2 rounded-full
            ${connectionState.isConnected 
              ? 'bg-green-500' 
              : connectionState.isConnecting
              ? 'bg-yellow-500 animate-pulse'
              : 'bg-red-500'
            }
          `} />
          
          <span>
            {connectionState.isConnected 
              ? 'Live Collaboration' 
              : connectionState.isConnecting
              ? 'Connecting...'
              : 'Disconnected'
            }
          </span>

          {connectionState.reconnectAttempts > 0 && (
            <span className="text-xs opacity-75">
              (Attempt {connectionState.reconnectAttempts})
            </span>
          )}
        </div>

        {connectionState.lastError && (
          <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {connectionState.lastError}
            <button
              onClick={webSocket.reconnect}
              className="ml-2 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    );
  };

  // Participant presence indicators
  const renderParticipantsList = () => {
    if (!enabled || participants.length <= 1) return null;

    return (
      <div className="fixed bottom-4 left-4 z-50">
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Active Participants ({participants.length})
          </h4>
          
          <div className="space-y-2">
            {participants.map(participant => {
              const isCurrentUser = participant.userId === userId;
              const isOnline = webSocket.connectionState.isConnected; // Simplified
              
              return (
                <div
                  key={participant.userId}
                  className="flex items-center gap-3 text-sm"
                >
                  <div
                    className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: participant.colorCode }}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {participant.displayName}
                      {isCurrentUser && (
                        <span className="ml-1 text-xs text-gray-500">(You)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">
                      {participant.userType} • Page {participant.currentPage}
                    </div>
                  </div>
                  
                  <div className={`
                    w-2 h-2 rounded-full
                    ${participant.status === 'active' ? 'bg-green-400' : 
                      participant.status === 'joined' ? 'bg-yellow-400' : 'bg-gray-400'}
                  `} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Don't render anything if collaboration is disabled
  if (!enabled) {
    return null;
  }

  return (
    <>
      {renderCursorIndicators()}
      {renderConnectionStatus()}
      {renderParticipantsList()}
    </>
  );
};

export default CollaborationSync; 