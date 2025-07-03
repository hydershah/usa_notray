import React, { useState, useRef } from 'react';
import type { DocumentTag } from '../../types/editor';
import { useEditorStore } from '../../hooks/editor/useEditorStore';

interface DraggableTagProps {
  tag: DocumentTag;
  scaleFactor: number;
  containerRef: React.RefObject<HTMLDivElement>;
  onUpdate: (tagId: string, coordinates: any) => void;
}

const DraggableTag: React.FC<DraggableTagProps> = ({ tag, scaleFactor, containerRef, onUpdate }) => {
  const { setDraggedTag } = useEditorStore();
  const [isDragging, setIsDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    setDraggedTag(tag);
    
    const tagRect = e.currentTarget.getBoundingClientRect();
    offsetRef.current = {
      x: e.clientX - tagRect.left,
      y: e.clientY - tagRect.top,
    };
  };

  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();

    const containerRect = containerRef.current.getBoundingClientRect();

    const newX = (e.clientX - containerRect.left - offsetRef.current.x) / scaleFactor;
    const newY = (e.clientY - containerRect.top - offsetRef.current.y) / scaleFactor;

    onUpdate(tag.id, {
      ...tag.coordinates,
      x: Math.round(newX),
      y: Math.round(newY),
    });
  };

  const handleDragEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      setDraggedTag(null);
      // Here you might want to trigger a save to the server
    }
  };
  
  // Attach and detach listeners to the window
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
    } else {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);
  
  return (
    <div
      onMouseDown={handleDragStart}
      style={{
        position: 'absolute',
        left: `${tag.coordinates.x * scaleFactor}px`,
        top: `${tag.coordinates.y * scaleFactor}px`,
        width: `${tag.coordinates.width * scaleFactor}px`,
        height: `${tag.coordinates.height * scaleFactor}px`,
        border: `2px solid ${isDragging ? 'blue' : tag.colorCode || '#f00'}`,
        backgroundColor: 'rgba(255, 255, 0, 0.3)',
        cursor: 'move',
        userSelect: 'none',
        zIndex: isDragging ? 1000 : 100,
        transition: isDragging ? 'none' : 'all 0.1s ease',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ padding: '2px', fontSize: '10px', color: '#000', whiteSpace: 'nowrap' }}>
        {tag.displayLabel}
      </div>
    </div>
  );
};

export default DraggableTag; 