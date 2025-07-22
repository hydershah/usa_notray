import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { useWebSocket } from '../../hooks/editor/useWebSocket';
import type { DocumentTag, TagCoordinates } from '../../types/editor';
import { X, Move, Maximize2, User } from 'lucide-react';

interface DraggableTagProps {
  tag: DocumentTag;
  onDelete: (tagId: string) => void;
  onSelect: (tag: DocumentTag) => void;
  isSelected: boolean;
  zoomLevel: number;
  pageNumber: number;
  documentId: string;
}

export const DraggableTag: React.FC<DraggableTagProps> = ({
  tag,
  onDelete,
  onSelect,
  isSelected,
  zoomLevel,
  pageNumber,
  documentId
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [resizeStart, setResizeStart] = useState<{ width: number; height: number } | null>(null);
  
  const tagRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  
  const { updateTag, selectedTag } = useEditorStore();
  const webSocket = useWebSocket({
    sessionId: tag.sessionId,
    userId: tag.assignedTo || '',
    autoReconnect: true
  });

  // Throttle WebSocket updates
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<{ coordinates: TagCoordinates; timestamp: number } | null>(null);

  // Get tag dimensions based on type
  const getTagDimensions = useCallback(() => {
    const baseWidth = tag.coordinates.width || 100;
    const baseHeight = tag.coordinates.height || 50;
    
    return {
      width: baseWidth * zoomLevel,
      height: baseHeight * zoomLevel
    };
  }, [tag.coordinates.width, tag.coordinates.height, zoomLevel]);

  // Send real-time updates to other users
  const sendRealTimeUpdate = useCallback((coordinates: TagCoordinates, type: 'move' | 'resize') => {
    const now = Date.now();
    
    // Prevent spam updates
    if (lastUpdateRef.current && 
        now - lastUpdateRef.current.timestamp < 100 &&
        JSON.stringify(lastUpdateRef.current.coordinates) === JSON.stringify(coordinates)) {
      return;
    }

    lastUpdateRef.current = { coordinates, timestamp: now };

    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Throttle updates
    updateTimeoutRef.current = setTimeout(() => {
      if (type === 'move') {
        webSocket.tagMoved(tag.id, coordinates);
      } else {
        webSocket.tagResized(tag.id, coordinates);
      }
    }, 50); // 20fps update rate
  }, [tag.id, webSocket]);

  // Handle drag start
  const handleDragStart = useCallback((event: any, info: PanInfo) => {
    setIsDragging(true);
    setDragStart({
      x: tag.coordinates.x,
      y: tag.coordinates.y
    });
    
    // Select tag when starting to drag
    if (!isSelected) {
      onSelect(tag);
    }
  }, [tag.coordinates.x, tag.coordinates.y, isSelected, onSelect, tag]);

  // Handle drag
  const handleDrag = useCallback((event: any, info: PanInfo) => {
    if (!dragStart) return;

    const newX = dragStart.x + info.offset.x / zoomLevel;
    const newY = dragStart.y + info.offset.y / zoomLevel;

    const newCoordinates: TagCoordinates = {
      ...tag.coordinates,
      x: Math.max(0, newX),
      y: Math.max(0, newY)
    };

    // Update local state immediately for smooth dragging
    updateTag(tag.id, { coordinates: newCoordinates });
    
    // Send real-time update
    sendRealTimeUpdate(newCoordinates, 'move');
  }, [dragStart, zoomLevel, tag.coordinates, tag.id, updateTag, sendRealTimeUpdate]);

  // Handle drag end
  const handleDragEnd = useCallback((event: any, info: PanInfo) => {
    setIsDragging(false);
    setDragStart(null);
    
    // Final update to ensure consistency
    if (dragStart) {
      const newX = dragStart.x + info.offset.x / zoomLevel;
      const newY = dragStart.y + info.offset.y / zoomLevel;

      const finalCoordinates: TagCoordinates = {
        ...tag.coordinates,
        x: Math.max(0, newX),
        y: Math.max(0, newY)
      };

      updateTag(tag.id, { coordinates: finalCoordinates });
      webSocket.tagMoved(tag.id, finalCoordinates);
    }
  }, [dragStart, zoomLevel, tag.coordinates, tag.id, updateTag, webSocket]);

  // Handle resize start
  const handleResizeStart = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      width: tag.coordinates.width || 100,
      height: tag.coordinates.height || 50
    });
    
    if (!isSelected) {
      onSelect(tag);
    }
  }, [tag.coordinates.width, tag.coordinates.height, isSelected, onSelect, tag]);

  // Handle resize
  const handleResize = useCallback((event: React.MouseEvent) => {
    if (!isResizing || !resizeStart) return;

    const rect = tagRef.current?.getBoundingClientRect();
    if (!rect) return;

    const deltaX = event.clientX - rect.right;
    const deltaY = event.clientY - rect.bottom;

    const newWidth = Math.max(50, resizeStart.width + deltaX / zoomLevel);
    const newHeight = Math.max(30, resizeStart.height + deltaY / zoomLevel);

    const newCoordinates: TagCoordinates = {
      ...tag.coordinates,
      width: newWidth,
      height: newHeight
    };

    // Update local state immediately for smooth resizing
    updateTag(tag.id, { coordinates: newCoordinates });
    
    // Send real-time update
    sendRealTimeUpdate(newCoordinates, 'resize');
  }, [isResizing, resizeStart, zoomLevel, tag.coordinates, tag.id, updateTag, sendRealTimeUpdate]);

  // Handle resize end
  const handleResizeEnd = useCallback((event: React.MouseEvent) => {
    if (!isResizing || !resizeStart) return;

    setIsResizing(false);
    setResizeStart(null);

    const rect = tagRef.current?.getBoundingClientRect();
    if (!rect) return;

    const deltaX = event.clientX - rect.right;
    const deltaY = event.clientY - rect.bottom;

    const finalWidth = Math.max(50, resizeStart.width + deltaX / zoomLevel);
    const finalHeight = Math.max(30, resizeStart.height + deltaY / zoomLevel);

    const finalCoordinates: TagCoordinates = {
      ...tag.coordinates,
      width: finalWidth,
      height: finalHeight
    };

    updateTag(tag.id, { coordinates: finalCoordinates });
    webSocket.tagResized(tag.id, finalCoordinates);
  }, [isResizing, resizeStart, zoomLevel, tag.coordinates, tag.id, updateTag, webSocket]);

  // Handle mouse events for resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      handleResize(event as any);
    };

    const handleMouseUp = (event: MouseEvent) => {
      handleResizeEnd(event as any);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleResize, handleResizeEnd]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const dimensions = getTagDimensions();
  const tagColor = tag.assignedTo ? `hsl(${(tag.assignedTo.charCodeAt(0) * 137.5) % 360}, 70%, 60%)` : '#6B7280';

  return (
    <motion.div
      ref={tagRef}
      className={`absolute cursor-move select-none ${
        isSelected ? 'z-50' : 'z-40'
      }`}
      style={{
        left: `${tag.coordinates.x * zoomLevel}px`,
        top: `${tag.coordinates.y * zoomLevel}px`,
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: isDragging ? 0.8 : 1, 
        scale: isDragging ? 1.05 : 1,
        boxShadow: isSelected ? '0 0 0 2px #3B82F6' : 'none'
      }}
      transition={{ duration: 0.2 }}
      drag={isSelected}
      dragMomentum={false}
      dragElastic={0}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(tag);
      }}
    >
      {/* Tag background */}
      <div
        className="w-full h-full rounded border-2 border-dashed relative overflow-hidden"
        style={{
          backgroundColor: `${tagColor}20`,
          borderColor: tagColor,
          backdropFilter: 'blur(1px)'
        }}
      >
        {/* Tag content */}
        <div className="w-full h-full flex flex-col items-center justify-center p-1">
          <div className="text-xs font-medium text-center leading-tight">
            {tag.tagType}
          </div>
          {tag.assignedTo && (
            <div className="text-xs opacity-75 flex items-center gap-1 mt-1">
              <User className="w-3 h-3" />
              {tag.assignedTo}
            </div>
          )}
        </div>

        {/* Selection overlay */}
        {isSelected && (
          <motion.div
            className="absolute inset-0 bg-blue-500 bg-opacity-10 border-2 border-blue-500 rounded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        )}

        {/* Drag indicator */}
        {isSelected && (
          <motion.div
            className="absolute top-1 left-1 p-1 bg-white rounded shadow-sm"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Move className="w-3 h-3 text-gray-600" />
          </motion.div>
        )}

        {/* Delete button */}
        {isSelected && (
          <motion.button
            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded shadow-sm hover:bg-red-600 transition-colors"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(tag.id);
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-3 h-3" />
          </motion.button>
        )}

        {/* Resize handle */}
        {isSelected && (
          <motion.div
            ref={resizeHandleRef}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-blue-500 rounded-tl shadow-sm"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            onMouseDown={handleResizeStart}
            whileHover={{ scale: 1.1 }}
          >
            <Maximize2 className="w-3 h-3 text-white" />
          </motion.div>
        )}

        {/* Real-time movement indicator */}
        {isDragging && (
          <motion.div
            className="absolute -top-6 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-blue-500 text-white text-xs rounded shadow-lg"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            Moving...
          </motion.div>
        )}

        {/* Real-time resize indicator */}
        {isResizing && (
          <motion.div
            className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-green-500 text-white text-xs rounded shadow-lg"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            Resizing...
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default DraggableTag; 