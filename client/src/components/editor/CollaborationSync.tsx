import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { useWebSocket } from '../../hooks/editor/useWebSocket';
import type { DocumentTag, TagCoordinates } from '../../types/editor';
import { motion, AnimatePresence } from 'framer-motion';
import { User, MousePointer, Type, Users, Wifi, WifiOff } from 'lucide-react';

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
  userType: 'notary' | 'signer' | 'witness';
}

interface TypingIndicator {
  userId: string;
  displayName: string;
  fieldId: string;
  userType: 'notary' | 'signer' | 'witness';
  timestamp: number;
}

export const CollaborationSync: React.FC<CollaborationSyncProps> = ({
  sessionId,
  userId,
  enabled = true
}) => {
  const cursorUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTagUpdateRef = useRef<{ tagId: string; timestamp: number } | null>(null);
  const [typingIndicators, setTypingIndicators] = useState<TypingIndicator[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);
  
  const {
    tags,
    selectedTag,
    viewer,
    currentDocument,
    participants,
    mode,
    cursors,
    updateCursor,
    updateTag
  } = useEditorStore();

  const webSocket = useWebSocket({
    sessionId,
    userId,
    autoReconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10
  });

  // Update typing indicators from user presence
  useEffect(() => {
    const typingUsers = webSocket.userPresence
      .filter(user => user.isTyping && user.userId !== userId)
      .map(user => ({
        userId: user.userId,
        displayName: user.displayName,
        fieldId: user.typingField || '',
        userType: user.userType,
        timestamp: Date.now()
      }));
    
    setTypingIndicators(typingUsers);
  }, [webSocket.userPresence, userId]);

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
          <motion.div
            key={cursor.userId}
            className="absolute pointer-events-none z-50"
            style={{
              left: `${cursor.x * viewer.zoomLevel}px`,
              top: `${cursor.y * viewer.zoomLevel}px`,
              transform: 'translate(-50%, -50%)'
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
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
              <motion.div
                className="absolute left-6 top-0 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap shadow-lg"
                style={{ backgroundColor: participant.colorCode }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                {participant.displayName}
                <span className="ml-1 opacity-75">
                  {participant.userType === 'notary' ? '👨‍⚖️' : '✍️'}
                </span>
              </motion.div>
            </div>
          </motion.div>
        );
      });
  };

  // Render typing indicators
  const renderTypingIndicators = () => {
    if (!enabled || typingIndicators.length === 0) return null;

    return (
      <div className="fixed bottom-20 left-4 z-50 space-y-2">
        <AnimatePresence>
          {typingIndicators.map(indicator => (
            <motion.div
              key={indicator.userId}
              className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg shadow-lg"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Type className="w-4 h-4 text-blue-600 animate-pulse" />
              <span className="text-sm font-medium text-blue-800">
                {indicator.displayName} is typing...
              </span>
              <span className="text-xs text-blue-600">
                {indicator.userType === 'notary' ? '👨‍⚖️' : '✍️'}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  };

  // Connection status indicator
  const renderConnectionStatus = () => {
    if (!enabled) return null;

    const { connectionState } = webSocket;

    return (
      <motion.div 
        className="fixed top-4 right-4 z-50"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className={`
          flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-lg
          ${connectionState.isConnected 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : connectionState.isConnecting
            ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
            : 'bg-red-100 text-red-800 border border-red-200'
          }
        `}>
          {connectionState.isConnected ? (
            <Wifi className="w-4 h-4" />
          ) : connectionState.isConnecting ? (
            <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <WifiOff className="w-4 h-4" />
          )}
          
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
          <motion.div 
            className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 shadow-lg"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
          >
            {connectionState.lastError}
            <button
              onClick={webSocket.reconnect}
              className="ml-2 underline hover:no-underline font-medium"
            >
              Retry
            </button>
          </motion.div>
        )}
      </motion.div>
    );
  };

  // Participant presence indicators
  const renderParticipantsList = () => {
    if (!enabled || participants.length <= 1) return null;

    return (
      <motion.div 
        className="fixed bottom-4 left-4 z-50"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Active Participants ({participants.length})
            </h4>
            <button
              onClick={() => setShowParticipants(!showParticipants)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              {showParticipants ? '−' : '+'}
            </button>
          </div>
          
          <AnimatePresence>
            {showParticipants && (
              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                {participants.map(participant => {
                  const isCurrentUser = participant.userId === userId;
                  const isOnline = webSocket.connectionState.isConnected;
                  const isTyping = typingIndicators.some(t => t.userId === participant.userId);
                  
                  return (
                    <motion.div
                      key={participant.userId}
                      className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-gray-50 transition-colors"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <div className="relative">
                        <div
                          className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: participant.colorCode }}
                        />
                        {isTyping && (
                          <motion.div
                            className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate flex items-center gap-1">
                          {participant.displayName}
                          {isCurrentUser && (
                            <span className="text-xs text-gray-500">(You)</span>
                          )}
                          {isTyping && (
                            <Type className="w-3 h-3 text-blue-500 animate-pulse" />
                          )}
                        </div>
                        <div className="text-xs text-gray-500 capitalize flex items-center gap-1">
                          {participant.userType} • Page {participant.currentPage}
                          {participant.userType === 'notary' ? '👨‍⚖️' : '✍️'}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <div className={`
                          w-2 h-2 rounded-full
                          ${participant.status === 'active' ? 'bg-green-400' : 
                            participant.status === 'joined' ? 'bg-yellow-400' : 'bg-gray-400'}
                        `} />
                        {isTyping && (
                          <motion.div
                            className="w-2 h-2 bg-blue-500 rounded-full"
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  // Real-time activity feed
  const renderActivityFeed = () => {
    if (!enabled) return null;

    return (
      <motion.div 
        className="fixed top-4 left-4 z-50 max-w-sm"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <MousePointer className="w-4 h-4" />
            Live Activity
          </h4>
          
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Real-time collaboration active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>{cursors.filter(c => c.userId !== userId).length} users viewing</span>
            </div>
            {typingIndicators.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                <span>{typingIndicators.length} user(s) typing</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  // Don't render anything if collaboration is disabled
  if (!enabled) {
    return null;
  }

  return (
    <>
      {renderCursorIndicators()}
      {renderTypingIndicators()}
      {renderConnectionStatus()}
      {renderParticipantsList()}
      {renderActivityFeed()}
    </>
  );
};

export default CollaborationSync; 