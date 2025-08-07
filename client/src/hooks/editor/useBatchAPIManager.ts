import { useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

/**
 * BatchAPIManager: Strategic API calls with smart batching
 * Based on Google Docs batch request patterns for optimal performance
 */

interface PendingUpdate {
  tagId: string;
  coordinates?: {
    x: number;
    y: number; 
    width?: number;
    height?: number;
  };
  content?: string;
  priority: 'normal' | 'high' | 'critical';
  reason: string;
  timestamp: number;
}

interface BatchAPIConfig {
  sessionId: string;
  debounceDelay?: number;
  maxBatchSize?: number;
  autoFlushInterval?: number;
}

export const useBatchAPIManager = (config: BatchAPIConfig) => {
  const { sessionId, debounceDelay = 2000, maxBatchSize = 10, autoFlushInterval = 30000 } = config;
  const { toast } = useToast();
  
  // Pending updates waiting to be sent
  const pendingUpdates = useRef<Map<string, PendingUpdate>>(new Map());
  
  // Debounce timers
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const batchFlushTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Statistics
  const stats = useRef({
    totalBatches: 0,
    totalUpdates: 0,
    averageBatchSize: 0,
    lastFlushTime: 0
  });
  
  // Flush a batch of updates to the API
  const flushBatch = useCallback(async (priority: 'normal' | 'high' | 'critical' = 'normal') => {
    if (pendingUpdates.current.size === 0) return;
    
    const updates = Array.from(pendingUpdates.current.values());
    const updatesByPriority = updates.filter(update => 
      priority === 'critical' ? true : update.priority === priority
    );
    
    if (updatesByPriority.length === 0) return;
    
    // Clear the updates that will be processed
    updatesByPriority.forEach(update => {
      pendingUpdates.current.delete(update.tagId);
    });
    
    try {
      console.log(`💾 Flushing batch: ${updatesByPriority.length} updates (${priority})`);
      
      // Batch API call - single request for multiple updates
      const response = await fetch(`/api/editor/session/${sessionId}/batch-update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          updates: updatesByPriority.map(update => ({
            tagId: update.tagId,
            coordinates: update.coordinates,
            content: update.content,
            priority: update.priority,
            reason: update.reason
          }))
        })
      });
      
      if (!response.ok) {
        throw new Error(`Batch update failed: ${response.statusText}`);
      }
      
      // Update statistics
      stats.current.totalBatches++;
      stats.current.totalUpdates += updatesByPriority.length;
      stats.current.averageBatchSize = stats.current.totalUpdates / stats.current.totalBatches;
      stats.current.lastFlushTime = Date.now();
      
      console.log(`✅ Batch saved: ${updatesByPriority.length} updates`);
      
    } catch (error) {
      console.error('❌ Batch update failed:', error);
      
      // Re-queue failed updates (but don't retry critical ones to avoid loops)
      if (priority !== 'critical') {
        updatesByPriority.forEach(update => {
          pendingUpdates.current.set(update.tagId, {
            ...update,
            priority: 'high', // Increase priority for retry
            reason: `retry_${update.reason}`
          });
        });
      }
      
      toast({
        variant: "destructive",
        title: "Save Failed", 
        description: `Failed to save ${updatesByPriority.length} changes. Will retry automatically.`
      });
    }
  }, [sessionId, toast]);
  
  // Queue an update for eventual API call
  const queueUpdate = useCallback((
    tagId: string,
    updates: Partial<PendingUpdate>,
    priority: 'normal' | 'high' | 'critical' = 'normal',
    reason: string = 'user_action'
  ) => {
    // Create or update pending update
    const existingUpdate = pendingUpdates.current.get(tagId);
    const newUpdate: PendingUpdate = {
      tagId,
      coordinates: updates.coordinates || existingUpdate?.coordinates,
      content: updates.content !== undefined ? updates.content : existingUpdate?.content,
      priority: Math.max(
        priority === 'critical' ? 3 : priority === 'high' ? 2 : 1,
        existingUpdate?.priority === 'critical' ? 3 : existingUpdate?.priority === 'high' ? 2 : 1
      ) === 3 ? 'critical' : Math.max(
        priority === 'critical' ? 3 : priority === 'high' ? 2 : 1,
        existingUpdate?.priority === 'critical' ? 3 : existingUpdate?.priority === 'high' ? 2 : 1
      ) === 2 ? 'high' : 'normal',
      reason,
      timestamp: Date.now()
    };
    
    pendingUpdates.current.set(tagId, newUpdate);
    
    console.log(`📝 Queued update: ${tagId} (${priority}) - ${reason}`);
    
    // Handle based on priority
    if (priority === 'critical') {
      // Critical: Flush immediately
      flushBatch('critical');
    } else if (priority === 'high') {
      // High: Flush with short delay
      setTimeout(() => flushBatch('high'), 500);
    } else {
      // Normal: Use debounced flush
      scheduleBatchFlush();
    }
    
    // Auto-flush if batch gets too large
    if (pendingUpdates.current.size >= maxBatchSize) {
      flushBatch('normal');
    }
  }, [flushBatch, maxBatchSize]);
  
  // Schedule a debounced batch flush
  const scheduleBatchFlush = useCallback(() => {
    if (batchFlushTimer.current) {
      clearTimeout(batchFlushTimer.current);
    }
    
    batchFlushTimer.current = setTimeout(() => {
      flushBatch('normal');
    }, debounceDelay);
  }, [flushBatch, debounceDelay]);
  
  // Queue coordinate update
  const queueCoordinateUpdate = useCallback((
    tagId: string,
    coordinates: { x: number; y: number; width?: number; height?: number },
    priority: 'normal' | 'high' | 'critical' = 'normal',
    reason: string = 'coordinate_change'
  ) => {
    queueUpdate(tagId, { coordinates }, priority, reason);
  }, [queueUpdate]);
  
  // Queue content update  
  const queueContentUpdate = useCallback((
    tagId: string,
    content: string,
    priority: 'normal' | 'high' | 'critical' = 'normal',
    reason: string = 'content_change'
  ) => {
    queueUpdate(tagId, { content }, priority, reason);
  }, [queueUpdate]);
  
  // Force flush all pending updates
  const forceFlush = useCallback(async () => {
    await flushBatch('critical');
  }, [flushBatch]);
  
  // Get pending update count
  const getPendingCount = useCallback(() => {
    return pendingUpdates.current.size;
  }, []);
  
  // Clear all pending updates (use with caution)
  const clearPending = useCallback(() => {
    pendingUpdates.current.clear();
    if (batchFlushTimer.current) {
      clearTimeout(batchFlushTimer.current);
    }
  }, []);
  
  // Auto-flush setup
  useEffect(() => {
    const autoFlushTimer = setInterval(() => {
      if (pendingUpdates.current.size > 0) {
        console.log(`⏰ Auto-flush: ${pendingUpdates.current.size} pending updates`);
        flushBatch('normal');
      }
    }, autoFlushInterval);
    
    return () => {
      clearInterval(autoFlushTimer);
      if (batchFlushTimer.current) {
        clearTimeout(batchFlushTimer.current);
      }
    };
  }, [flushBatch, autoFlushInterval]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Force flush any remaining updates before unmount
      if (pendingUpdates.current.size > 0) {
        console.log(`🧹 Cleanup: Flushing ${pendingUpdates.current.size} pending updates`);
        flushBatch('critical');
      }
    };
  }, [flushBatch]);
  
  return {
    // Queue methods
    queueCoordinateUpdate,
    queueContentUpdate,
    queueUpdate,
    
    // Control methods
    forceFlush,
    clearPending,
    
    // Query methods
    getPendingCount,
    
    // Statistics
    getStats: () => ({
      ...stats.current,
      pendingCount: pendingUpdates.current.size
    })
  };
};

export default useBatchAPIManager;