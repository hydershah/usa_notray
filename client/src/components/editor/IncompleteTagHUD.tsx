import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { DocumentTag, SessionParticipant } from '@/types/editor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEditorStore } from '@/hooks/editor/useEditorStore';

interface IncompleteTagHUDProps {
  tags: DocumentTag[];
  participants: SessionParticipant[];
  currentUserId: string;
  onJumpToTag: (tagId: string) => void | Promise<void>;
  className?: string;
}

export const IncompleteTagHUD: React.FC<IncompleteTagHUDProps> = ({
  tags,
  participants,
  currentUserId,
  onJumpToTag,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [filter, setFilter] = useState<string>('all'); // all | me | user:<id>
  const [cursorIndex, setCursorIndex] = useState<number>(0);

  const { isDragActive } = useEditorStore();

  // Index unfilled tags with deep comparison to prevent excessive recalculation
  const { unfilled, completedCount, totalCount } = useMemo(() => {
    // Skip expensive processing during drag for performance
    if (isDragActive) {
      return { unfilled: [], completedCount: 0, totalCount: tags.length };
    }
    
    const total = tags.length;
    const unfilledTags = tags
      .filter(t => !t.isCompleted)
      .filter(t => t.id) // Ensure tag has valid ID
      .sort((a, b) => {
        if (a.documentId !== b.documentId) return String(a.documentId).localeCompare(String(b.documentId));
        if (a.coordinates.pageNumber !== b.coordinates.pageNumber) return a.coordinates.pageNumber - b.coordinates.pageNumber;
        return String(a.id).localeCompare(String(b.id));
      });
    const completed = total - unfilledTags.length;
    return { unfilled: unfilledTags, completedCount: completed, totalCount: total };
  }, [isDragActive, tags.length, tags.map(t => `${t.id}-${t.isCompleted}`).join(',')]);

  const filteredUnfilled = useMemo(() => {
    if (filter === 'all') return unfilled;
    if (filter === 'me') return unfilled.filter(t => t.assignedUserId?.toString() === currentUserId);
    if (filter.startsWith('user:')) {
      const userId = filter.split(':')[1];
      return unfilled.filter(t => t.assignedUserId?.toString() === userId);
    }
    return unfilled;
  }, [unfilled, filter, currentUserId]);

  // Keep cursor in range when list changes
  useEffect(() => {
    if (cursorIndex >= filteredUnfilled.length) {
      setCursorIndex(Math.max(0, filteredUnfilled.length - 1));
    }
  }, [filteredUnfilled.length, cursorIndex]);

  const current = filteredUnfilled[cursorIndex];

  const jumpTo = useCallback((idx: number) => {
    console.log('🎯 HUD jumpTo called with index:', idx, 'total:', filteredUnfilled.length);
    if (filteredUnfilled.length === 0) return;
    const target = filteredUnfilled[idx];
    if (target) {
      console.log('🎯 HUD jumping to tag:', target.id, 'on page:', target.coordinates.pageNumber);
      onJumpToTag(target.id);
    }
  }, [filteredUnfilled, onJumpToTag]);

  const jumpNext = useCallback(() => {
    console.log('🎯 HUD jumpNext called, current index:', cursorIndex, 'total:', filteredUnfilled.length);
    if (filteredUnfilled.length === 0) return;
    const next = (cursorIndex + 1) % filteredUnfilled.length;
    console.log('🎯 HUD jumpNext moving to index:', next);
    setCursorIndex(next);
    jumpTo(next);
  }, [cursorIndex, filteredUnfilled.length, jumpTo]);

  const jumpPrev = useCallback(() => {
    console.log('🎯 HUD jumpPrev called, current index:', cursorIndex, 'total:', filteredUnfilled.length);
    if (filteredUnfilled.length === 0) return;
    const prev = (cursorIndex - 1 + filteredUnfilled.length) % filteredUnfilled.length;
    console.log('🎯 HUD jumpPrev moving to index:', prev);
    setCursorIndex(prev);
    jumpTo(prev);
  }, [cursorIndex, filteredUnfilled.length, jumpTo]);

  // Keyboard shortcuts for quick nav on big docs
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        jumpNext();
      } else if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        jumpPrev();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [jumpNext, jumpPrev]);

  // Compact pill when closed
  if (!isOpen) {
    return (
      <button
        className={`fixed right-4 bottom-4 z-40 rounded-full px-3 py-2 bg-white shadow border text-sm ${className}`}
        title="Show unfilled tags"
        onClick={() => setIsOpen(true)}
      >
        {completedCount}/{totalCount} completed
      </button>
    );
  }

  return (
    <div className={`fixed right-4 bottom-4 z-40 w-80 bg-white border shadow-lg rounded-lg ${className}`}>
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 text-sm">Unfilled Tags</span>
          <Badge variant="outline" className="text-xs">
            {totalCount - completedCount} pending
          </Badge>
        </div>
        <button className="text-xs text-gray-500 hover:text-gray-700" onClick={() => setIsOpen(false)}>Hide</button>
      </div>

      <div className="p-3 space-y-3">
        {/* Progress */}
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>{completedCount}/{totalCount} completed</span>
          <span>{filteredUnfilled.length} to do{filter !== 'all' ? ' (filtered)' : ''}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded">
          <div
            className="h-1.5 bg-green-600 rounded"
            style={{ width: `${totalCount === 0 ? 0 : (completedCount / totalCount) * 100}%` }}
          />
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600">Filter</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 border rounded px-2 py-1 text-sm"
          >
            <option value="all">All participants</option>
            <option value="me">Only my tags</option>
            {participants.map(p => (
              <option key={p.userId} value={`user:${p.userId}`}>{p.displayName}</option>
            ))}
          </select>
        </div>

        {/* Navigator */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={jumpPrev} disabled={filteredUnfilled.length === 0}>Prev</Button>
          <Button variant="outline" size="sm" onClick={() => jumpTo(0)} disabled={filteredUnfilled.length === 0}>First</Button>
          <Button variant="default" size="sm" onClick={jumpNext} disabled={filteredUnfilled.length === 0}>Next</Button>
        </div>

        {/* Current target preview */}
        <div className="text-xs text-gray-700 border rounded p-2 bg-gray-50 min-h-[44px]">
          {current ? (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div>
                  <span className="font-medium">{current.tagType}</span>
                  <span className="text-gray-500"> • Pg {current.coordinates.pageNumber}</span>
                </div>
                <div className="text-gray-500">Assigned: {participants.find(p => p.userId === current.assignedUserId)?.displayName || '—'}</div>
              </div>
              <Button size="sm" onClick={() => onJumpToTag(current.id)}>Jump</Button>
            </div>
          ) : (
            <span className="text-gray-500">All caught up 🎉</span>
          )}
        </div>

        <div className="text-[10px] text-gray-500">Tips: Alt+N next, Alt+P previous</div>
      </div>
    </div>
  );
};

export default IncompleteTagHUD; 