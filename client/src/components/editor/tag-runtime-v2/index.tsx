import React, { useMemo, useState, useEffect, useCallback } from 'react';
import type { DocumentTag, PlaceTagCommand, RuntimeConfig } from './types';
import { DEFAULT_CONFIG } from './config';
import { createCoordinateTransform, validateCoordinates } from './coords';
import { TagItem } from './tag-item';
import { TagText } from './tag-text';
import type { SyncAdapter } from './sync-adapter';
import { fetchSyncAdapter } from './sync-adapter';
import { createWebSocketAdapter } from './websocket-adapter';

interface TagRuntimeV2Props extends RuntimeConfig {
  sync?: SyncAdapter;
  webSocket?: any;
  onTagClick?: (tag: DocumentTag) => void;
  activeTool?: import('./types').TagType | null;
  activeUserId?: string | number | null;
}

export const TagRuntimeV2: React.FC<TagRuntimeV2Props> = ({
  sessionId,
  document,
  participants,
  currentUser,
  mode,
  pages,
  initialTags = [],
  sync,
  webSocket,
  onTagClick,
  activeTool = null,
  activeUserId = null,
}) => {
  const [tags, setTags] = useState<DocumentTag[]>(initialTags);
  const { toPage } = useMemo(() => createCoordinateTransform(), []);
  const config = DEFAULT_CONFIG;
  const syncAdapter = useMemo(() => sync || fetchSyncAdapter(), [sync]);
  const ws = useMemo(() => createWebSocketAdapter(webSocket), [webSocket]);

  useEffect(() => {
    setTags(initialTags.filter(t => (t as any).documentId?.toString?.() === (document as any).id?.toString?.()));
  }, [initialTags, document.id]);

  const canEdit = mode.canPlaceTags;
  const allowPointerInteractions = Boolean(activeTool && activeUserId && canEdit);

  const upsertTag = useCallback((t: DocumentTag) => {
    setTags(prev => {
      const others = prev.filter(x => x.id !== t.id);
      return [...others, t];
    });
  }, []);

  const handlePlace = useCallback(async (cmd: PlaceTagCommand) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const visual = config[cmd.tagType];
    const optimistic: DocumentTag = {
      id: tempId,
      sessionId,
      documentId: cmd.documentId,
      tagType: cmd.tagType,
      assignedUserId: (cmd.assignedUserId as any),
      coordinates: {
        ...cmd.coordinates,
        width: cmd.coordinates.width || visual.defaultWidth,
        height: cmd.coordinates.height || visual.defaultHeight,
      },
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    upsertTag(optimistic);
    ws.tagPlaced?.(optimistic);
    try {
      const serverTag = await syncAdapter.place(sessionId, cmd);
      setTags(prev => prev.filter(t => t.id !== tempId).concat(serverTag));
    } catch (e) {
      setTags(prev => prev.filter(t => t.id !== tempId));
    }
  }, [config, sessionId, syncAdapter, upsertTag, ws]);

  const handleMoveEnd = useCallback(async (tagId: string, coords: { x: number; y: number }) => {
    setTags(prev => prev.map(t => t.id === tagId ? { ...t, coordinates: { ...t.coordinates, ...coords } } : t));
    ws.tagUpdated?.(tagId, { coordinates: coords });
    try {
      const tag = tags.find(t => t.id === tagId);
      if (!tag) return;
      const sf = pages.find(pg => pg.pageNumber === tag.coordinates.pageNumber)?.scaleFactor || pages[0]?.scaleFactor || 1;
      const pageCoords = toPage(
        { x: coords.x, y: coords.y, width: tag.coordinates.width, height: tag.coordinates.height, pageNumber: tag.coordinates.pageNumber },
        sf
      );
      if (!validateCoordinates(pageCoords)) return;
      await syncAdapter.update(sessionId, tagId, { coordinates: pageCoords });
    } catch {}
  }, [pages, sessionId, syncAdapter, tags, toPage, ws]);

  const handleResizeEnd = useCallback(async (tagId: string, coords: { x: number; y: number; width: number; height: number }) => {
    setTags(prev => prev.map(t => t.id === tagId ? { ...t, coordinates: { ...t.coordinates, ...coords } } : t));
    ws.tagUpdated?.(tagId, { coordinates: coords });
    try {
      const tag = tags.find(t => t.id === tagId);
      if (!tag) return;
      const sf = pages.find(pg => pg.pageNumber === tag.coordinates.pageNumber)?.scaleFactor || pages[0]?.scaleFactor || 1;
      const pageCoords = toPage(
        { x: coords.x, y: coords.y, width: coords.width, height: coords.height, pageNumber: tag.coordinates.pageNumber },
        sf
      );
      if (!validateCoordinates(pageCoords)) return;
      await syncAdapter.update(sessionId, tagId, { coordinates: pageCoords });
    } catch {}
  }, [pages, sessionId, syncAdapter, tags, toPage, ws]);

  const handleDelete = useCallback(async (tagId: string) => {
    setTags(prev => prev.filter(t => t.id !== tagId));
    ws.tagDeleted?.(tagId);
    try { await syncAdapter.remove(sessionId, tagId); } catch {}
  }, [sessionId, syncAdapter, ws]);

  const handlePageClick = useCallback((e: React.MouseEvent<HTMLDivElement>, pageNumber: number, scaleFactor: number) => {
    if (!activeTool || !activeUserId || !canEdit) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / scaleFactor);
    const y = Math.round((e.clientY - rect.top) / scaleFactor);
    const visual = config[activeTool];
    const cmd: PlaceTagCommand = {
      documentId: (document as any).id,
      tagType: activeTool as any,
      assignedUserId: activeUserId as any,
      coordinates: { x, y, width: visual.defaultWidth, height: visual.defaultHeight, pageNumber },
    } as any;
    handlePlace(cmd);
  }, [activeTool, activeUserId, canEdit, config, document, handlePlace]);

  return (
    <>
      {pages.map((p) => (
        <div
          key={p.pageNumber}
          className="trv2-page-layer"
          style={{ position: 'absolute', inset: 0, pointerEvents: allowPointerInteractions ? 'auto' : 'none' }}
          onClick={(e) => handlePageClick(e, p.pageNumber, p.scaleFactor)}
        >
          {tags.filter(t => t.coordinates.pageNumber === p.pageNumber).map(tag => {
            const visual = config[tag.tagType];
            const allowResize = !!visual?.allowResize;
            const commonProps = {
              key: tag.id,
              tag,
              scaleFactor: p.scaleFactor,
              canEdit,
              allowResize,
              onMoveEnd: handleMoveEnd,
              onResizeEnd: handleResizeEnd,
              isSelected: false,
            } as const;
            if (tag.tagType === 'T') {
              return (
                <TagText
                  {...commonProps}
                  onSaveContent={(id, content) => {
                    // let existing flow handle content save at a higher layer
                    onTagClick?.({ ...tag, id, content } as DocumentTag);
                  }}
                />
              );
            }
            return (
              <TagItem {...commonProps} />
            );
          })}
        </div>
      ))}
    </>
  );
};

export default TagRuntimeV2;


