import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import { DocumentTag, TagCoordinates } from '../../types/editor';
import { TAG_TYPE_INFO } from '../../types/editor';
import { cn } from '../../lib/utils';

interface ImprovedTagProps {
  tag: DocumentTag;
  scaleFactor: number;
  isSelected: boolean;
  canEdit: boolean;
  onUpdate: (coordinates: Partial<TagCoordinates>) => void;
  onSave: (coordinates: Partial<TagCoordinates>) => void;
  onDelete: () => void;
  onSelect: () => void;
  onTagClick?: (tag: DocumentTag, position: { x: number; y: number; width: number; height: number }) => void;
  mode?: 'tagging' | 'signing';
  currentUserId?: string;
  isUpdating?: boolean;
}

export const ImprovedTag: React.FC<ImprovedTagProps> = ({
  tag,
  scaleFactor,
  isSelected,
  canEdit,
  onUpdate,
  onSave,
  onDelete,
  onSelect,
  onTagClick,
  mode,
  currentUserId,
  isUpdating = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const tagInfo = TAG_TYPE_INFO[tag.tagType];
  
  // Convert PDF coordinates to display coordinates
  const displayCoords = {
    x: Math.round(tag.coordinates.x * scaleFactor),
    y: Math.round(tag.coordinates.y * scaleFactor),
    width: Math.round(tag.coordinates.width * scaleFactor),
    height: Math.round(tag.coordinates.height * scaleFactor)
  };

  // Determine tag state and styling
  const isAssignedToCurrentUser = tag.assignedUserId === currentUserId;
  const isCompleted = tag.isCompleted;
  const isUniversalTag = ['T', 'D'].includes(tag.tagType);
  
  // Get tag styling based on state
  const getTagStyling = () => {
    if (isCompleted) {
      return {
        bg: 'bg-green-50',
        border: 'border-green-400',
        text: 'text-green-700',
        shadow: 'shadow-green-100'
      };
    }
    
    if (mode === 'signing' && !isAssignedToCurrentUser && !isUniversalTag) {
      return {
        bg: 'bg-gray-100',
        border: 'border-gray-300',
        text: 'text-gray-500',
        shadow: 'shadow-gray-100'
      };
    }
    
    if (isSelected) {
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-500',
        text: 'text-blue-700',
        shadow: 'shadow-blue-200'
      };
    }
    
    return {
      bg: 'bg-white',
      border: 'border-gray-300',
      text: 'text-gray-700',
      shadow: 'shadow-gray-100'
    };
  };

  const styling = getTagStyling();

  const handleDragStop = (e: any, data: any) => {
    if (!canEdit) return;
    
    const newCoordinates = {
      x: Math.round(data.x / scaleFactor),
      y: Math.round(data.y / scaleFactor)
    };
    
    onSave(newCoordinates);
  };

  const handleResizeStop = (e: any, direction: any, ref: any, delta: any, position: any) => {
    if (!canEdit) return;
    
    const newCoordinates = {
      x: Math.round(position.x / scaleFactor),
      y: Math.round(position.y / scaleFactor),
      width: Math.round(ref.offsetWidth / scaleFactor),
      height: Math.round(ref.offsetHeight / scaleFactor)
    };
    
    onSave(newCoordinates);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (mode === 'signing' && onTagClick && !isCompleted) {
      const rect = e.currentTarget.getBoundingClientRect();
      onTagClick(tag, {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      });
    } else {
      onSelect();
    }
  };

  return (
    <Rnd
      size={{
        width: displayCoords.width,
        height: displayCoords.height
      }}
      position={{
        x: displayCoords.x,
        y: displayCoords.y
      }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      enableResizing={canEdit}
      disableDragging={!canEdit}
      bounds="parent"
      className={cn(
        "group transition-all duration-200",
        canEdit ? "cursor-move" : "cursor-pointer"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        onClick={handleClick}
        className={cn(
          "relative w-full h-full rounded-lg border-2 transition-all duration-200 flex items-center justify-center",
          styling.bg,
          styling.border,
          styling.text,
          isHovered && !isUpdating && "shadow-md transform scale-105",
          isSelected && "ring-2 ring-blue-400 ring-opacity-50",
          isUpdating && "opacity-75"
        )}
      >
        {/* Loading indicator */}
        {isUpdating && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Tag content */}
        <div className="flex flex-col items-center justify-center gap-1 px-2 py-1">
          {/* Icon and label */}
          <div className="flex items-center gap-1">
            <span className="text-lg leading-none">{tagInfo.icon}</span>
            <span className="text-xs font-semibold truncate">{tagInfo.label}</span>
          </div>
          
          {/* Completion indicator */}
          {isCompleted && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 rounded-full">
              <span className="text-xs text-green-700">✓</span>
              <span className="text-xs font-medium text-green-700">Done</span>
            </div>
          )}
        </div>

        {/* User assignment indicator */}
        <div 
          className="absolute -top-2 -right-2 w-4 h-4 rounded-full border-2 border-white shadow-sm"
          style={{ backgroundColor: tag.colorCode }}
          title={`Assigned to user`}
        />

        {/* Hover actions (only for admins/notaries in edit mode) */}
        {canEdit && isHovered && !isUpdating && (
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white rounded px-2 py-1 text-xs whitespace-nowrap">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect();
                }}
                className="hover:text-blue-300"
                title="Select"
              >
                ✏️
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="hover:text-red-300"
                title="Delete"
              >
                🗑️
              </button>
            </div>
            {/* Arrow pointing down */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-800" />
          </div>
        )}
      </div>
    </Rnd>
  );
}; 