import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface StreamlinedTextInput {
  id: string;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
    pageNumber: number;
  };
  content: string;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  assignedUserId: number;
  userColor: string;
  isNew: boolean;
  createdAt: Date;
}

interface PlaceTextInputCommand {
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
    pageNumber: number;
  };
  assignedUserId: number;
  documentId: string;
}

export const useStreamlinedTextInputs = (sessionId: string) => {
  const [textInputs, setTextInputs] = useState<StreamlinedTextInput[]>([]);
  const [selectedTextInputId, setSelectedTextInputId] = useState<string | null>(null);
  const pendingCreations = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  // Place new text input
  const placeTextInput = useCallback(async (command: PlaceTextInputCommand, userColor: string) => {
    const tempId = `text_temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create optimistic text input for immediate editing
    const optimisticTextInput: StreamlinedTextInput = {
      id: tempId,
      coordinates: command.coordinates,
      content: '',
      fontSize: 12,
      fontFamily: 'Arial',
      textColor: '#000000',
      assignedUserId: command.assignedUserId,
      userColor,
      isNew: true,
      createdAt: new Date()
    };

    // Add to local state immediately
    setTextInputs(prev => [...prev, optimisticTextInput]);
    setSelectedTextInputId(tempId);
    pendingCreations.current.add(tempId);

    console.log('📝 Added optimistic text input:', {
      tempId,
      coordinates: command.coordinates,
      totalTextInputs: textInputs.length + 1,
      optimisticTextInput
    });

    try {
      // Send to server
      const response = await fetch(`/api/editor/session/${sessionId}/place-text-tag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          documentId: command.documentId,
          coordinates: command.coordinates,
          assignedUserId: command.assignedUserId,
          immediateEdit: true
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to place text input: ${response.statusText}`);
      }

      const { tag } = await response.json();
      
      console.log('📨 Server response for text input:', {
        tempId,
        realId: tag.id,
        tagData: tag
      });
      
      // Replace optimistic text input with server response
      setTextInputs(prev => prev.map(input => 
        input.id === tempId 
          ? {
              ...input,
              id: tag.id,
              isNew: false // No longer new after server confirms
            }
          : input
      ));

      setSelectedTextInputId(tag.id);
      pendingCreations.current.delete(tempId);

      console.log(`✅ Text input placed successfully:`, tag.id);
      return tag.id;

    } catch (error) {
      // Remove failed text input
      setTextInputs(prev => prev.filter(input => input.id !== tempId));
      setSelectedTextInputId(null);
      pendingCreations.current.delete(tempId);
      
      console.error('❌ Failed to place text input:', error);
      toast({
        variant: "destructive",
        title: "Failed to place text",
        description: "Could not place text input. Please try again."
      });
      throw error;
    }
  }, [sessionId, toast]);

  // Save text content
  const saveTextContent = useCallback(async (textInputId: string, content: string) => {
    try {
      // Update local state immediately
      setTextInputs(prev => prev.map(input => 
        input.id === textInputId 
          ? { ...input, content, isNew: false }
          : input
      ));

      console.log(`✅ Text content saved locally for ${textInputId}: "${content}"`);

    } catch (error) {
      console.error('❌ Failed to save text content:', error);
      toast({
        variant: "destructive", 
        title: "Save Failed",
        description: "Failed to save text content. Please try again."
      });
    }
  }, [toast]);

  // Update font size
  const updateFontSize = useCallback(async (textInputId: string, fontSize: number, fontFamily?: string, textColor?: string) => {
    try {
      // Update local state immediately
      setTextInputs(prev => prev.map(input => 
        input.id === textInputId 
          ? { 
              ...input, 
              fontSize,
              ...(fontFamily && { fontFamily }),
              ...(textColor && { textColor })
            }
          : input
      ));

      // Send to server
      const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${textInputId}/font-size`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          fontSize,
          ...(fontFamily && { fontFamily }),
          ...(textColor && { textColor })
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update font size');
      }

      console.log(`✅ Font size updated for ${textInputId}: ${fontSize}px`);

    } catch (error) {
      console.error('❌ Failed to update font size:', error);
      toast({
        variant: "destructive",
        title: "Update Failed", 
        description: "Failed to update font size. Please try again."
      });
    }
  }, [sessionId, toast]);

  // Delete text input
  const deleteTextInput = useCallback(async (textInputId: string) => {
    try {
      // Remove from local state immediately
      setTextInputs(prev => prev.filter(input => input.id !== textInputId));
      
      if (selectedTextInputId === textInputId) {
        setSelectedTextInputId(null);
      }

      // Don't send delete request for temporary/pending inputs
      if (pendingCreations.current.has(textInputId)) {
        pendingCreations.current.delete(textInputId);
        return;
      }

      // Send delete request to server
      const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${textInputId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete text input');
      }

      console.log(`✅ Text input deleted: ${textInputId}`);

    } catch (error) {
      console.error('❌ Failed to delete text input:', error);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "Failed to delete text input. Please try again."
      });
    }
  }, [sessionId, selectedTextInputId, toast]);

  // Load existing text inputs from tags (for when switching to/from text mode)
  const loadTextInputsFromTags = useCallback((tags: any[]) => {
    const textTags = tags.filter(tag => tag.tagType === 'T');
    const convertedInputs: StreamlinedTextInput[] = textTags.map(tag => {
      // Parse contentData if available
      let fontSize = 12;
      let fontFamily = 'Arial';
      let textColor = '#000000';
      
      if (tag.contentData) {
        try {
          const parsed = typeof tag.contentData === 'string' 
            ? JSON.parse(tag.contentData) 
            : tag.contentData;
          fontSize = parsed.fontSize || fontSize;
          fontFamily = parsed.fontFamily || fontFamily;
          textColor = parsed.textColor || textColor;
        } catch (e) {
          console.warn('Could not parse contentData for tag:', tag.id);
        }
      }

      return {
        id: tag.id,
        coordinates: tag.coordinates,
        content: tag.content || '',
        fontSize,
        fontFamily,
        textColor,
        assignedUserId: tag.assignedUserId,
        userColor: tag.colorCode || '#4ECDC4',
        isNew: false,
        createdAt: new Date(tag.createdAt)
      };
    });

    setTextInputs(convertedInputs);
  }, []);

  // Get text input by ID
  const getTextInput = useCallback((textInputId: string) => {
    return textInputs.find(input => input.id === textInputId);
  }, [textInputs]);

  // Select text input
  const selectTextInput = useCallback((textInputId: string | null) => {
    setSelectedTextInputId(textInputId);
  }, []);

  return {
    textInputs,
    selectedTextInputId,
    placeTextInput,
    saveTextContent,
    updateFontSize,
    deleteTextInput,
    loadTextInputsFromTags,
    getTextInput,
    selectTextInput,
    isProcessing: pendingCreations.current.size > 0
  };
}; 