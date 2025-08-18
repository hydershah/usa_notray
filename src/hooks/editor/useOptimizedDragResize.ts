import { useCallback, useRef, useState } from 'react';
import { throttle } from 'lodash';
import type { TagCoordinates } from '@/types/editor';

interface OptimizedDragResizeConfig {
  onLiveUpdate: (tagId: string, coordinates: Partial<TagCoordinates>) => void;
  onFinalUpdate: (tagId: string, coordinates: Partial<TagCoordinates>) => void;
  snapToGrid?: boolean;
  gridSize?: number;
}

export const useOptimizedDragResize = ({
  onLiveUpdate,
  onFinalUpdate,
  snapToGrid = true,
  gridSize = 5
}: OptimizedDragResizeConfig) => {
  
  // Track drag/resize state to prevent unnecessary updates
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const currentTagId = useRef<string | null>(null);
  const lastCoordinates = useRef<Partial<TagCoordinates> | null>(null);

  // Throttled live updates for smooth performance during drag/resize
  const throttledLiveUpdate = useRef(
    throttle((tagId: string, coordinates: Partial<TagCoordinates>) => {
      // Only send updates if coordinates actually changed
      const prev = lastCoordinates.current;
      if (prev && 
          prev.x === coordinates.x && 
          prev.y === coordinates.y && 
          prev.width === coordinates.width && 
          prev.height === coordinates.height) {
        return;
      }

      lastCoordinates.current = coordinates;
      onLiveUpdate(tagId, coordinates);
    }, 16) // ~60fps throttling for smooth updates
  );

  // Snap coordinates to grid for professional alignment
  const snapCoordinates = useCallback((coords: Partial<TagCoordinates>): Partial<TagCoordinates> => {
    if (!snapToGrid) return coords;

    const snapped: Partial<TagCoordinates> = {};
    
    if (coords.x !== undefined) {
      snapped.x = Math.round(coords.x / gridSize) * gridSize;
    }
    if (coords.y !== undefined) {
      snapped.y = Math.round(coords.y / gridSize) * gridSize;
    }
    if (coords.width !== undefined) {
      snapped.width = Math.max(gridSize, Math.round(coords.width / gridSize) * gridSize);
    }
    if (coords.height !== undefined) {
      snapped.height = Math.max(gridSize, Math.round(coords.height / gridSize) * gridSize);
    }

    return snapped;
  }, [snapToGrid, gridSize]);

  // Drag start - initialize tracking
  const handleDragStart = useCallback((tagId: string) => {
    setIsDragging(true);
    currentTagId.current = tagId;
    lastCoordinates.current = null;
    console.log('🎯 Drag started for tag:', tagId);
  }, []);

  // Live drag updates - no API calls, just local state + WebSocket
  const handleDragMove = useCallback((tagId: string, coordinates: { x: number; y: number }) => {
    if (!isDragging || currentTagId.current !== tagId) return;

    const snappedCoords = snapCoordinates(coordinates);
    throttledLiveUpdate.current(tagId, snappedCoords);
  }, [isDragging, snapCoordinates]);

  // Drag end - final position with snapping
  const handleDragEnd = useCallback((tagId: string, coordinates: { x: number; y: number }) => {
    if (currentTagId.current !== tagId) return;

    setIsDragging(false);
    currentTagId.current = null;
    
    const finalCoords = snapCoordinates(coordinates);
    onFinalUpdate(tagId, finalCoords);
    
    console.log('✅ Drag completed for tag:', tagId, finalCoords);
  }, [snapCoordinates, onFinalUpdate]);

  // Resize start - initialize tracking
  const handleResizeStart = useCallback((tagId: string) => {
    setIsResizing(true);
    currentTagId.current = tagId;
    lastCoordinates.current = null;
    console.log('📏 Resize started for tag:', tagId);
  }, []);

  // Live resize updates - no API calls, just local state + WebSocket
  const handleResizeMove = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    if (!isResizing || currentTagId.current !== tagId) return;

    const snappedCoords = snapCoordinates(coordinates);
    throttledLiveUpdate.current(tagId, snappedCoords);
  }, [isResizing, snapCoordinates]);

  // Resize end - final dimensions with snapping
  const handleResizeEnd = useCallback((tagId: string, coordinates: Partial<TagCoordinates>) => {
    if (currentTagId.current !== tagId) return;

    setIsResizing(false);
    currentTagId.current = null;
    
    const finalCoords = snapCoordinates(coordinates);
    onFinalUpdate(tagId, finalCoords);
    
    console.log('✅ Resize completed for tag:', tagId, finalCoords);
  }, [snapCoordinates, onFinalUpdate]);

  // Cleanup throttled functions
  const cleanup = useCallback(() => {
    throttledLiveUpdate.current.cancel();
    setIsDragging(false);
    setIsResizing(false);
    currentTagId.current = null;
    lastCoordinates.current = null;
  }, []);

  // Generate react-rnd compatible handlers
  const createDragHandlers = useCallback((tagId: string) => ({
    onDragStart: () => handleDragStart(tagId),
    onDrag: (e: any, data: any) => {
      handleDragMove(tagId, { x: data.x, y: data.y });
    },
    onDragStop: (e: any, data: any) => {
      handleDragEnd(tagId, { x: data.x, y: data.y });
    }
  }), [handleDragStart, handleDragMove, handleDragEnd]);

  const createResizeHandlers = useCallback((tagId: string, scaleFactor: number = 1) => ({
    onResizeStart: () => handleResizeStart(tagId),
    onResize: (e: any, direction: any, ref: any) => {
      const coordinates = {
        width: ref.offsetWidth / scaleFactor,
        height: ref.offsetHeight / scaleFactor
      };
      handleResizeMove(tagId, coordinates);
    },
    onResizeStop: (e: any, direction: any, ref: any) => {
      const coordinates = {
        width: ref.offsetWidth / scaleFactor,
        height: ref.offsetHeight / scaleFactor
      };
      handleResizeEnd(tagId, coordinates);
    }
  }), [handleResizeStart, handleResizeMove, handleResizeEnd]);

  return {
    // State
    isDragging,
    isResizing,
    
    // Individual handlers
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
    
    // React-RND compatible handlers
    createDragHandlers,
    createResizeHandlers,
    
    // Utilities
    snapCoordinates,
    cleanup
  };
};