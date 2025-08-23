import { useRef, useCallback } from 'react';

/**
 * Enhanced debouncing utility for tag operations
 * Provides different debounce intervals for different operation types
 */

type DebounceFunction<T extends any[]> = (...args: T) => void;

interface DebouncedOperation {
  operation: () => Promise<void>;
  timestamp: number;
  key: string;
}

class OperationDebouncer {
  private pendingOperations = new Map<string, {
    timeoutId: NodeJS.Timeout;
    operation: () => Promise<void>;
    timestamp: number;
  }>();

  /**
   * Debounce an operation with a specific key and delay
   */
  debounce<T extends any[]>(
    key: string,
    operation: (...args: T) => Promise<void>,
    delay: number
  ): DebounceFunction<T> {
    return (...args: T) => {
      // Clear existing timeout for this key
      const existing = this.pendingOperations.get(key);
      if (existing) {
        clearTimeout(existing.timeoutId);
      }

      // Create new debounced operation
      const timeoutId = setTimeout(async () => {
        try {
          await operation(...args);
          this.pendingOperations.delete(key);
        } catch (error) {
          console.error(`Debounced operation failed for key ${key}:`, error);
          this.pendingOperations.delete(key);
        }
      }, delay);

      // Store the pending operation
      this.pendingOperations.set(key, {
        timeoutId,
        operation: () => operation(...args),
        timestamp: Date.now()
      });
    };
  }

  /**
   * Cancel a pending operation
   */
  cancel(key: string): void {
    const existing = this.pendingOperations.get(key);
    if (existing) {
      clearTimeout(existing.timeoutId);
      this.pendingOperations.delete(key);
    }
  }

  /**
   * Flush a pending operation immediately
   */
  async flush(key: string): Promise<void> {
    const existing = this.pendingOperations.get(key);
    if (existing) {
      clearTimeout(existing.timeoutId);
      try {
        await existing.operation();
      } finally {
        this.pendingOperations.delete(key);
      }
    }
  }

  /**
   * Get pending operations count
   */
  getPendingCount(): number {
    return this.pendingOperations.size;
  }

  /**
   * Clear all pending operations
   */
  clear(): void {
    for (const { timeoutId } of Array.from(this.pendingOperations.values())) {
      clearTimeout(timeoutId);
    }
    this.pendingOperations.clear();
  }
}

// Global debouncer instance
const globalDebouncer = new OperationDebouncer();

/**
 * Hook for debounced tag operations with intelligent delay based on operation type
 */
export const useDebouncedTagOperations = (sessionId: string) => {
  const debouncerRef = useRef(globalDebouncer);

  // Position updates - frequent, short delay
  const debouncedPositionUpdate = useCallback((
    tagId: string,
    coordinates: { x?: number; y?: number; width?: number; height?: number }
  ) => {
    const operation = async () => {
      // Import store dynamically to avoid circular dependencies
      const { useEditorStore } = await import('./useEditorStore');
      const { isTagBeingDragged } = useEditorStore.getState();
      
      // Skip API call if tag is being actively dragged
      if (isTagBeingDragged(tagId)) {
        console.log('⏭️ Skipping position update for actively dragged tag:', tagId);
        return;
      }
      
      const response = await fetch(`/api/editor/session/${sessionId}/tag/${tagId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ coordinates })
      });

      if (!response.ok) {
        throw new Error(`Failed to update tag position: ${response.statusText}`);
      }

      console.log(`✅ Tag position updated: ${tagId}`);
    };

    const key = `position_${sessionId}_${tagId}`;
    return debouncerRef.current.debounce(key, operation, 300); // 300ms for position updates
  }, [sessionId]);

  // Content updates - medium delay
  const debouncedContentUpdate = useCallback((
    tagId: string,
    content: any
  ) => {
    const operation = async () => {
      const response = await fetch(`/api/editor/session/${sessionId}/tag/${tagId}/content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(content)
      });

      if (!response.ok) {
        throw new Error(`Failed to update tag content: ${response.statusText}`);
      }

      console.log(`✅ Tag content updated: ${tagId}`);
    };

    const key = `content_${sessionId}_${tagId}`;
    return debouncerRef.current.debounce(key, operation, 500); // 500ms for content updates
  }, [sessionId]);

  // Text tag position updates - high frequency, shorter delay
  const debouncedTextPositionUpdate = useCallback((
    tagId: string,
    position: { x: number; y: number; width: number; height: number; pageNumber: number }
  ) => {
    const operation = async () => {
      const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${tagId}/position`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(position)
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to update text tag position: ${response.statusText}`);
      }

      console.log(`✅ Text tag position updated: ${tagId}`);
    };

    const key = `text_position_${sessionId}_${tagId}`;
    return debouncerRef.current.debounce(key, operation, 200); // 200ms for text position
  }, [sessionId]);

  // Name tag position updates - ULTRA HIGH SPEED PERFORMANCE for smooth fast movement
  const debouncedNamePositionUpdate = useCallback((
    tagId: string,
    position: { x: number; y: number; width: number; height: number; pageNumber: number }
  ) => {
    const operation = async () => {
      const startTime = performance.now();
      try {
        const response = await fetch(`/api/editor/session/${sessionId}/name-tag/${tagId}/position`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(position)
        });

        if (!response.ok && response.status !== 404) {
          throw new Error(`Failed to update name tag position: ${response.statusText}`);
        }

        const duration = performance.now() - startTime;
        console.log(`✅ Name tag position synced to server: ${tagId} in ${duration.toFixed(2)}ms`);
        
        // 🚀 HIGH SPEED: Performance monitoring for fast movement
        if (duration > 100) {
          console.warn(`⚠️ Slow name tag sync: ${duration.toFixed(2)}ms - may affect fast movement`);
        } else if (duration < 50) {
          console.log(`🚀 High-speed name tag sync: ${duration.toFixed(2)}ms - optimal for fast movement`);
        }
      } catch (error) {
        console.error('❌ Failed to sync name tag position:', error);
        // Don't throw - allow local updates to continue
      }
    };

    const key = `name_position_${sessionId}_${tagId}`;
    // 🚀 HIGH SPEED: Adaptive debouncing - faster for high-speed movement
    const adaptiveDelay = 50; // 50ms for ultra-responsive high-speed movement
    return debouncerRef.current.debounce(key, operation, adaptiveDelay);
  }, [sessionId]);

  // 🚀 HIGH SPEED: Initials tag position updates - ULTRA HIGH SPEED PERFORMANCE for smooth fast movement
  const debouncedInitialsPositionUpdate = useCallback((
    tagId: string,
    position: { x: number; y: number; width: number; height: number; pageNumber: number }
  ) => {
    const operation = async () => {
      const startTime = performance.now();
      try {
        const response = await fetch(`/api/editor/session/${sessionId}/initials-tag/${tagId}/position`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(position)
        });

        if (!response.ok && response.status !== 404) {
          throw new Error(`Failed to update initials tag position: ${response.statusText}`);
        }

        const duration = performance.now() - startTime;
        console.log(`✅ Initials tag position synced to server: ${tagId} in ${duration.toFixed(2)}ms`);
        
        // 🚀 HIGH SPEED: Performance monitoring for fast movement
        if (duration > 100) {
          console.warn(`⚠️ Slow initials tag sync: ${duration.toFixed(2)}ms - may affect fast movement`);
        } else if (duration < 50) {
          console.log(`🚀 High-speed initials tag sync: ${duration.toFixed(2)}ms - optimal for fast movement`);
        }
      } catch (error) {
        console.error('❌ Failed to sync initials tag position:', error);
        // Don't throw - allow local updates to continue
      }
    };

    const key = `initials_position_${sessionId}_${tagId}`;
    // 🚀 HIGH SPEED: Adaptive debouncing - faster for high-speed movement
    const adaptiveDelay = 50; // 50ms for ultra-responsive high-speed movement
    return debouncerRef.current.debounce(key, operation, adaptiveDelay);
  }, [sessionId]);

  // 🚀 HIGH SPEED: Date tag position updates - ULTRA HIGH SPEED PERFORMANCE for smooth fast movement
  const debouncedDatePositionUpdate = useCallback((
    tagId: string,
    position: { x: number; y: number; width: number; height: number; pageNumber: number }
  ) => {
    const operation = async () => {
      const startTime = performance.now();
      try {
        const response = await fetch(`/api/editor/session/${sessionId}/date-tag/${tagId}/position`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(position)
        });

        if (!response.ok && response.status !== 404) {
          throw new Error(`Failed to update date tag position: ${response.statusText}`);
        }

        const duration = performance.now() - startTime;
        console.log(`✅ Date tag position synced to server: ${tagId} in ${duration.toFixed(2)}ms`);
        
        // 🚀 HIGH SPEED: Performance monitoring for fast movement
        if (duration > 100) {
          console.warn(`⚠️ Slow date tag sync: ${duration.toFixed(2)}ms - may affect fast movement`);
        } else if (duration < 50) {
          console.log(`🚀 High-speed date tag sync: ${duration.toFixed(2)}ms - optimal for fast movement`);
        }
      } catch (error) {
        console.error('❌ Failed to sync date tag position:', error);
        // Don't throw - allow local updates to continue
      }
    };

    const key = `date_position_${sessionId}_${tagId}`;
    // 🚀 HIGH SPEED: Adaptive debouncing - faster for high-speed movement
    const adaptiveDelay = 50; // 50ms for ultra-responsive high-speed movement
    return debouncerRef.current.debounce(key, operation, adaptiveDelay);
  }, [sessionId]);

  // Auto-fill operations - longer delay, less frequent
  const debouncedAutoFill = useCallback((tagId: string) => {
    const operation = async () => {
      const response = await fetch(`/api/editor/session/${sessionId}/tag/${tagId}/fill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to auto-fill tag: ${response.statusText}`);
      }

      console.log(`✅ Tag auto-filled: ${tagId}`);
    };

    const key = `autofill_${sessionId}_${tagId}`;
    return debouncerRef.current.debounce(key, operation, 1000); // 1000ms for auto-fill
  }, [sessionId]);

  // Utility functions
  const cancelOperation = useCallback((type: string, tagId: string) => {
    const key = `${type}_${sessionId}_${tagId}`;
    debouncerRef.current.cancel(key);
  }, [sessionId]);

  const flushOperation = useCallback(async (type: string, tagId: string) => {
    const key = `${type}_${sessionId}_${tagId}`;
    await debouncerRef.current.flush(key);
  }, [sessionId]);

  const flushAllOperations = useCallback(async () => {
    // Get all keys that match this session
    const sessionKeys = Array.from(debouncerRef.current['pendingOperations'].keys())
      .filter(key => key.includes(`_${sessionId}_`));
    
    // Flush all operations for this session
    await Promise.all(sessionKeys.map(key => debouncerRef.current.flush(key)));
  }, [sessionId]);

  return {
    debouncedPositionUpdate,
    debouncedContentUpdate, 
    debouncedTextPositionUpdate,
    debouncedNamePositionUpdate,
    debouncedInitialsPositionUpdate,
    debouncedDatePositionUpdate,
    debouncedAutoFill,
    cancelOperation,
    flushOperation,
    flushAllOperations,
    getPendingCount: () => debouncerRef.current.getPendingCount()
  };
};

/**
 * Simple debounce hook for general use
 */
export const useDebounce = <T extends any[]>(
  callback: (...args: T) => void,
  delay: number
): DebounceFunction<T> => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: T) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

/**
 * Throttle hook for high-frequency events
 */
export const useThrottle = <T extends any[]>(
  callback: (...args: T) => void,
  limit: number
): DebounceFunction<T> => {
  const inThrottle = useRef(false);

  return useCallback((...args: T) => {
    if (!inThrottle.current) {
      callback(...args);
      inThrottle.current = true;
      setTimeout(() => {
        inThrottle.current = false;
      }, limit);
    }
  }, [callback, limit]);
}; 