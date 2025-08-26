import { useState, useCallback, useRef } from 'react';
import { DocumentTag } from '../../types/editor';

interface UseTextTagEditingProps {
  tag: DocumentTag;
  sessionId?: string;
  currentUserId?: string | number;
  onTagClick?: (tag: DocumentTag) => void;
}

export const useTextTagEditing = ({
  tag,
  sessionId,
  currentUserId,
  onTagClick
}: UseTextTagEditingProps) => {
  const [isEditingText, setIsEditingText] = useState(false);
  const [textInputValue, setTextInputValue] = useState(tag.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const startEditing = useCallback(() => {
    if (tag.tagType === 'T') {
      setIsEditingText(true);
      setTextInputValue(tag.content || '');
      setSaveError(null);
      
      // Focus the input after a short delay to ensure it's rendered
      setTimeout(() => {
        if (textInputRef.current) {
          textInputRef.current.focus();
          textInputRef.current.select();
        }
      }, 50);
    }
  }, [tag.tagType, tag.content]);

  const stopEditing = useCallback(() => {
    setIsEditingText(false);
    setSaveError(null);
  }, []);

  const handleTextInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTextInputValue(e.target.value);
    setSaveError(null); // Clear any previous errors
  }, []);

  const saveTextContent = useCallback(async () => {
    if (tag.tagType === 'T' && textInputValue.trim() !== tag.content) {
      // Validate tag ID before making API call
      if (!tag.id || tag.id.startsWith('temp_') || tag.id.startsWith('participant_')) {
        console.error('Invalid tag ID for saving:', tag.id);
        setSaveError('Cannot save: tag not properly initialized. Please refresh the page.');
        return false;
      }
      
      setIsSaving(true);
      setSaveError(null);
      
      try {
        // Convert currentUserId to number if it's a string
        const userId = typeof currentUserId === 'string' ? parseInt(currentUserId) : currentUserId;
        
        // Save the text content to the server
        const response = await fetch(`/api/editor/session/${sessionId}/tag/${tag.id}/content`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            content: textInputValue.trim(),
            completedBy: userId,
            completedAt: new Date().toISOString()
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          
          // Update the tag in the store if onTagClick is provided
          if (onTagClick) {
            onTagClick(tag);
          }
          
          // Show success message
          const { toast } = await import('../../hooks/use-toast');
          toast({
            title: "Text Updated",
            description: "Text content saved successfully.",
            variant: "default"
          });
          
          // Exit edit mode
          stopEditing();
          return true;
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to save text content');
        }
      } catch (error) {
        console.error('Failed to save text content:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to save text content';
        setSaveError(errorMessage);
        
        const { toast } = await import('../../hooks/use-toast');
        toast({
          title: "Save Failed",
          description: errorMessage,
          variant: "destructive"
        });
        return false;
      } finally {
        setIsSaving(false);
      }
    } else {
      // No changes, just exit edit mode
      stopEditing();
      return true;
    }
  }, [tag.tagType, tag.id, tag.content, textInputValue, sessionId, currentUserId, onTagClick, stopEditing]);

  const cancelEditing = useCallback(() => {
    setTextInputValue(tag.content || '');
    setSaveError(null);
    stopEditing();
  }, [tag.content, stopEditing]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTextContent();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  }, [saveTextContent, cancelEditing]);

  const handleBlur = useCallback(() => {
    // Auto-save on blur if there are changes
    if (textInputValue.trim() !== tag.content) {
      saveTextContent();
    } else {
      stopEditing();
    }
  }, [textInputValue, tag.content, saveTextContent, stopEditing]);

  const canEdit = tag.tagType === 'T';
  const hasChanges = textInputValue.trim() !== tag.content;
  const isReadyToSave = hasChanges && !isSaving;

  return {
    // State
    isEditingText,
    textInputValue,
    isSaving,
    saveError,
    textInputRef,
    
    // Computed values
    canEdit,
    hasChanges,
    isReadyToSave,
    
    // Actions
    startEditing,
    stopEditing,
    saveTextContent,
    cancelEditing,
    
    // Event handlers
    handleTextInputChange,
    handleKeyDown,
    handleBlur
  };
};
