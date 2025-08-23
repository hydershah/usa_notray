import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useEditorStore } from '@/hooks/editor/useEditorStore';
import { useAuth } from '@/hooks/use-auth';
import { OptimizedTagInput } from './OptimizedTagInput';
import { InteractiveTagInput } from './InteractiveTagInput';
import { useSignaturePerformanceTracking } from './SignaturePerformanceMonitor';

interface EnhancedTagLayerProps {
  sessionId: string;
  documentId: string;
  pageNumber: number;
  tags: Array<{
    id: string;
    tagType: string;
    assignedUserId?: number;
    content?: any;
    position: { x: number; y: number };
    isCompleted?: boolean;
  }>;
  onTagUpdate: (tagId: string, updates: any) => void;
  onTagComplete: (tagId: string, content: any) => void;
}

/**
 * Enhanced tag layer component that handles all tag types with performance optimizations
 * Integrates signature, initials, date, commission, expiration, disclosure, seal, and whiteout tags
 */
export const EnhancedTagLayer: React.FC<EnhancedTagLayerProps> = ({
  sessionId,
  documentId,
  pageNumber,
  tags,
  onTagUpdate,
  onTagComplete
}) => {
  const { user: currentUser } = useAuth();
  const { activeTagId, setActiveTagId } = useEditorStore();
  const { trackOperation } = useSignaturePerformanceTracking();
  
  const [activeInputs, setActiveInputs] = useState<Set<string>>(new Set());
  const [processingTags, setProcessingTags] = useState<Set<string>>(new Set());

  // Performance tracking for tag operations
  const trackTagOperation = useCallback(async (operation: string, fn: () => Promise<any>) => {
    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      trackOperation(operation, duration, true);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      trackOperation(operation, duration, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }, [trackOperation]);

  // Check if user can edit a specific tag
  const canEditTag = useCallback((tag: any): boolean => {
    if (!currentUser) return false;
    
    // Notaries can edit all tags
    if (currentUser.role === 'notary') return true;
    
    // Signers can only edit tags assigned to them
    if (currentUser.role === 'signer') {
      return tag.assignedUserId === currentUser.userId;
    }
    
    // Witnesses cannot edit any tags
    return false;
  }, [currentUser]);

  // Handle tag click
  const handleTagClick = useCallback(async (tag: any) => {
    if (!canEditTag(tag)) {
      console.log(`🚫 User ${currentUser?.role} cannot edit ${tag.tagType} tag`);
      return;
    }

    if (processingTags.has(tag.id)) {
      console.log(`⏳ Tag ${tag.id} is already being processed`);
      return;
    }

    // Track tag interaction
    await trackTagOperation(`click_${tag.tagType}_tag`, async () => {
      setActiveTagId(tag.id);
      setActiveInputs(prev => new Set(prev).add(tag.id));
      return { tagId: tag.id, tagType: tag.tagType };
    });
  }, [canEditTag, currentUser?.role, processingTags, setActiveTagId, trackTagOperation]);

  // Handle tag completion
  const handleTagComplete = useCallback(async (tagId: string, content: any) => {
    if (processingTags.has(tagId)) return;
    
    setProcessingTags(prev => new Set(prev).add(tagId));
    
    try {
      await trackTagOperation(`complete_${content.type}_tag`, async () => {
        await onTagComplete(tagId, content);
        setActiveInputs(prev => {
          const newSet = new Set(prev);
          newSet.delete(tagId);
          return newSet;
        });
        setActiveTagId(null);
        return { tagId, content };
      });
    } catch (error) {
      console.error('Tag completion error:', error);
    } finally {
      setProcessingTags(prev => {
        const newSet = new Set(prev);
        newSet.delete(tagId);
        return newSet;
      });
    }
  }, [processingTags, onTagComplete, setActiveTagId, trackTagOperation]);

  // Handle tag cancel
  const handleTagCancel = useCallback((tagId: string) => {
    setActiveInputs(prev => {
      const newSet = new Set(prev);
      newSet.delete(tagId);
      return newSet;
    });
    setActiveTagId(null);
  }, [setActiveTagId]);

  // Render tag based on type
  const renderTag = useCallback((tag: any) => {
    const isActive = activeTagId === tag.id;
    const isInputActive = activeInputs.has(tag.id);
    const canEdit = canEditTag(tag);
    
    // Get tag display properties
    const getTagDisplay = (tagType: string) => {
      const displays: Record<string, { label: string; color: string; icon: string }> = {
        'S': { label: 'Signature', color: 'bg-blue-500', icon: '✍️' },
        'I': { label: 'Initials', color: 'bg-green-500', icon: '🔤' },
        'D': { label: 'Date', color: 'bg-purple-500', icon: '📅' },
        'N': { label: 'Commission', color: 'bg-orange-500', icon: '🆔' },
        'X': { label: 'Expiration', color: 'bg-red-500', icon: '⏰' },
        'O': { label: 'Disclosure', color: 'bg-yellow-500', icon: '📋' },
        'E': { label: 'Seal', color: 'bg-indigo-500', icon: '🔖' },
        'W': { label: 'Whiteout', color: 'bg-gray-500', icon: '⬜' }
      };
      
      return displays[tagType] || { label: 'Tag', color: 'bg-gray-400', icon: '🏷️' };
    };

    const display = getTagDisplay(tag.tagType);
    const isCompleted = tag.isCompleted || !!tag.content;
    
    return (
      <div
        key={tag.id}
        className={`absolute cursor-pointer transition-all duration-200 hover:scale-110 ${
          isActive ? 'z-50' : 'z-10'
        }`}
        style={{
          left: tag.position.x,
          top: tag.position.y,
          transform: `translate(-50%, -50%)`
        }}
        onClick={() => handleTagClick(tag)}
      >
        {/* Tag Visual Indicator */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg ${
            display.color
          } ${
            isCompleted ? 'ring-2 ring-green-300' : 'ring-2 ring-gray-300'
          } ${
            isActive ? 'ring-4 ring-blue-400' : ''
          }`}
          title={`${display.label}${isCompleted ? ' (Completed)' : ' (Incomplete)'}`}
        >
          {display.icon}
        </div>
        
        {/* Tag Label */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          {display.label}
        </div>
        
        {/* Input Components */}
        {isInputActive && (
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2">
            {tag.tagType === 'S' ? (
              <InteractiveTagInput
                tag={tag}
                isActive={isActive}
                canEdit={canEdit}
                onComplete={(content) => handleTagComplete(tag.id, content)}
                onCancel={() => handleTagCancel(tag.id)}
                currentUserId={currentUser?.userId || 0}
              />
            ) : (
              <OptimizedTagInput
                tag={tag}
                isActive={isActive}
                canEdit={canEdit}
                onComplete={(content) => handleTagComplete(tag.id, content)}
                onCancel={() => handleTagCancel(tag.id)}
                currentUserId={currentUser?.userId || 0}
                sessionId={sessionId}
              />
            )}
          </div>
        )}
      </div>
    );
  }, [
    activeTagId,
    activeInputs,
    canEditTag,
    handleTagClick,
    handleTagComplete,
    handleTagCancel,
    currentUser?.userId,
    sessionId
  ]);

  // Memoize tags to prevent unnecessary re-renders
  const memoizedTags = useMemo(() => tags, [tags]);

  // Performance tracking for tag layer operations
  useEffect(() => {
    if (memoizedTags.length > 0) {
      trackOperation('tag_layer_render', 0, true);
    }
  }, [memoizedTags.length, trackOperation]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {memoizedTags.map(renderTag)}
    </div>
  );
};
