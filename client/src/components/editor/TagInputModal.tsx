import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { InteractiveTagInput } from './InteractiveTagInput';
import { X } from 'lucide-react';
import type { DocumentTag } from '@/types/editor';

interface TagInputModalProps {
  tag: DocumentTag;
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: any) => void;
  userProfile?: {
    signatures?: string[];
    initials?: string[];
    name?: string;
    commissionNumber?: string;
    commissionExpiration?: string;
    disclosure?: string;
  };
  currentUserId?: string;
  // Position relative to the tag
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export const TagInputModal: React.FC<TagInputModalProps> = ({
  tag,
  isOpen,
  onClose,
  onSave,
  userProfile,
  currentUserId,
  position
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 });

  // Calculate optimal modal position
  useEffect(() => {
    if (!isOpen || !position) return;

    const calculatePosition = () => {
      const modalWidth = 320; // Approximate modal width
      const modalHeight = 200; // Approximate modal height
      const padding = 16;

      let top = position.y;
      let left = position.x;

      // Adjust if modal would go off-screen
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Position to the right of the tag if there's space
      if (position.x + position.width + modalWidth + padding < viewportWidth) {
        left = position.x + position.width + padding;
      } 
      // Otherwise position to the left
      else if (position.x - modalWidth - padding > 0) {
        left = position.x - modalWidth - padding;
      }
      // Or center horizontally if needed
      else {
        left = Math.max(padding, (viewportWidth - modalWidth) / 2);
      }

      // Position below the tag if there's space
      if (position.y + modalHeight + padding < viewportHeight) {
        top = position.y;
      }
      // Otherwise position above
      else if (position.y - modalHeight - padding > 0) {
        top = position.y - modalHeight - padding;
      }
      // Or center vertically if needed
      else {
        top = Math.max(padding, (viewportHeight - modalHeight) / 2);
      }

      setModalPosition({ top, left });
    };

    calculatePosition();
    
    // Recalculate on window resize
    window.addEventListener('resize', calculatePosition);
    return () => window.removeEventListener('resize', calculatePosition);
  }, [isOpen, position]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Add delay to prevent immediate close from the tag click event
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Handle save
  const handleSave = (content: any) => {
    console.log('💾 TagInputModal saving content:', {
      tagId: tag.id,
      tagType: tag.tagType,
      contentType: content.type,
      hasValue: !!content.value,
      valueLength: content.value?.length || 0
    });
    
    try {
      onSave(content);
      console.log('✅ Content saved successfully, closing modal');
      onClose();
    } catch (error) {
      console.error('❌ Error saving content:', error);
      // Don't close the modal if there's an error
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black bg-opacity-20" />
      
      {/* Modal */}
      <div
        ref={modalRef}
        className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 max-w-sm w-80"
        style={{
          top: modalPosition.top,
          left: modalPosition.left,
          maxHeight: '80vh',
          overflowY: 'auto'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full border border-gray-300"
              style={{ backgroundColor: tag.colorCode }}
            />
            <h3 className="text-sm font-semibold text-gray-800">
              Complete Tag
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <InteractiveTagInput
            tag={tag}
            isActive={true}
            canEdit={true}
            userProfile={userProfile}
            currentUserId={currentUserId}
            onComplete={handleSave}
            onCancel={onClose}
          />
        </div>

        {/* Tag Info */}
        <div className="px-4 pb-4 text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <span>Tag ID: {tag.id.substring(0, 8)}</span>
            <span>Page {tag.coordinates.pageNumber}</span>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}; 