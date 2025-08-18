import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useEditorStore } from './useEditorStore';
import { getTagDimensions } from '@/lib/constants/tagConstants';
import { debounce } from 'lodash';

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

export const useOptimizedTextInputs = (sessionId: string, webSocket?: any) => {
  const [textInputs, setTextInputs] = useState<StreamlinedTextInput[]>([]);
  const [selectedTextInputId, setSelectedTextInputId] = useState<string | null>(null);
  const pendingCreations = useRef<Set<string>>(new Set());
  const pendingUpdates = useRef<Map<string, any>>(new Map());
  const { toast } = useToast();

  // ✅ SMOOTH DRAG: Throttled local updates for smooth movement
  const throttledLocalUpdate = useRef(
    debounce((textInputId: string, coordinates: any) => {
      setTextInputs(prev => prev.map(input => 
        input.id === textInputId 
          ? { ...input, coordinates: { ...input.coordinates, ...coordinates } }
          : input
      ));
    }, 16) // ~60fps for smooth movement
  );

  // ✅ POSITION PERSISTENCE: Debounced server save after movement stops
  const debouncedPositionSave = useRef(
    debounce(async (textInputId: string, coordinates: any) => {
      try {
        console.log('💾 Saving text input position to server:', textInputId, coordinates);
        
        const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${textInputId}/coordinates`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(coordinates)
        });

        if (!response.ok) {
          throw new Error('Failed to save position');
        }

        console.log('✅ Text input position saved successfully:', textInputId);
        
        // Remove from pending updates
        pendingUpdates.current.delete(textInputId);
        
      } catch (error) {
        console.error('❌ Failed to save text input position:', error);
      }
    }, 1000) // Save 1 second after movement stops
  );

  // ✅ SMOOTH MOVEMENT: Handle drag updates with instant local feedback
  const moveTextInput = useCallback((textInputId: string, coordinates: { x: number; y: number; width?: number; height?: number }) => {
    // 1. INSTANT local update for smooth UX
    throttledLocalUpdate.current(textInputId, coordinates);
    
    // 2. WebSocket broadcast for real-time collaboration
    if (webSocket?.isConnected && webSocket?.webSocketInstance) {
      const message = {
        type: 'text_input_position_updated',
        payload: {
          textInputId,
          coordinates,
          sessionId,
          timestamp: Date.now()
        }
      };
      
      try {
        webSocket.webSocketInstance.send(JSON.stringify(message));
        console.log('📡 Broadcasted text input movement');
      } catch (error) {
        console.warn('⚠️ Failed to broadcast text input movement:', error);
      }
    }
    
    // 3. Add to pending updates and trigger debounced save
    pendingUpdates.current.set(textInputId, coordinates);
    debouncedPositionSave.current(textInputId, coordinates);
    
  }, [sessionId, webSocket]);

  // ✅ COMPLETE INTERACTION: Final position save when drag/resize ends
  const completeTextInputInteraction = useCallback(async (textInputId: string, finalCoordinates: { x: number; y: number; width?: number; height?: number }) => {
    try {
      console.log('🎯 Completing text input interaction:', textInputId, finalCoordinates);
      
      // 1. Update local state with final coordinates
      setTextInputs(prev => prev.map(input => 
        input.id === textInputId 
          ? { ...input, coordinates: { ...input.coordinates, ...finalCoordinates } }
          : input
      ));
      
      // 2. Force immediate save of final position
      debouncedPositionSave.current.cancel(); // Cancel any pending save
      
      const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${textInputId}/coordinates`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(finalCoordinates)
      });

      if (!response.ok) {
        throw new Error('Failed to save final position');
      }

      console.log('✅ Text input final position saved:', textInputId);
      pendingUpdates.current.delete(textInputId);
      
    } catch (error) {
      console.error('❌ Failed to save final text input position:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save text position. Please try again.",
        variant: "destructive"
      });
    }
  }, [sessionId, toast]);

  // Place new text input
  const placeTextInput = useCallback(async (command: PlaceTextInputCommand, userColor: string) => {
    const tempId = `text_temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { lastUsedFontSize } = useEditorStore.getState();
    const fontSize = lastUsedFontSize || 16;
    
    const optimisticTextInput: StreamlinedTextInput = {
      id: tempId,
      coordinates: command.coordinates,
      content: '',
      fontSize: fontSize,
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

    console.log('📝 Added optimistic text input:', tempId);

    try {
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
          immediateEdit: false,
          fontSize: fontSize
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to place text input: ${response.statusText}`);
      }

      const { tag } = await response.json();
      
      // Replace optimistic with real ID
      setTextInputs(prev => prev.map(input => {
        if (input.id === tempId) {
          return {
            ...input,
            id: tag.id,
            content: input.content !== '' ? input.content : tag.content || ''
          };
        }
        return input;
      }));

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

  // ✅ OPTIMIZED CONTENT SAVE: Debounced content saving
  const debouncedContentSave = useRef(
    debounce(async (textInputId: string, content: string) => {
      try {
        const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${textInputId}/content`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ content })
        });

        if (!response.ok) {
          throw new Error('Failed to save content');
        }

        console.log('✅ Text content saved to server:', textInputId);
      } catch (error) {
        console.error('❌ Failed to save text content:', error);
      }
    }, 500) // Save 500ms after user stops typing
  );

  // Save text content
  const saveTextContent = useCallback((textInputId: string, content: string) => {
    // 1. INSTANT local update for responsive typing
    setTextInputs(prev => prev.map(input => 
      input.id === textInputId 
        ? { ...input, content, isNew: content.trim() === '' }
        : input
    ));

    // 2. WebSocket broadcast for real-time collaboration
    if (webSocket?.isConnected && webSocket?.webSocketInstance) {
      const message = {
        type: 'text_input_content_changed',
        payload: {
          textInputId,
          content,
          sessionId,
          timestamp: Date.now()
        }
      };
      
      try {
        webSocket.webSocketInstance.send(JSON.stringify(message));
        console.log('📡 Broadcasted text content change');
      } catch (error) {
        console.warn('⚠️ Failed to broadcast text content:', error);
      }
    }

    // 3. Debounced server save
    debouncedContentSave.current(textInputId, content);

    console.log(`📝 Text content updated locally: ${textInputId}`);
  }, [sessionId, webSocket]);

  // ✅ OPTIMIZED FONT SIZE: Immediate local + debounced server
  const debouncedFontSave = useRef(
    debounce(async (textInputId: string, fontSize: number) => {
      try {
        const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${textInputId}/font-size`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ fontSize })
        });

        if (!response.ok) {
          throw new Error('Failed to save font size');
        }

        console.log('✅ Font size saved to server:', textInputId, fontSize);
      } catch (error) {
        console.error('❌ Failed to save font size:', error);
      }
    }, 350) // Save 350ms after font change
  );

  const updateFontSize = useCallback((textInputId: string, fontSize: number) => {
    // 1. INSTANT local update
    setTextInputs(prev => prev.map(input => 
      input.id === textInputId 
        ? { ...input, fontSize }
        : input
    ));

    // 2. Update global font size preference
    const { setLastUsedFontSize } = useEditorStore.getState();
    setLastUsedFontSize(fontSize);

    // 3. Debounced server save
    debouncedFontSave.current(textInputId, fontSize);

    console.log(`🎨 Font size updated: ${textInputId} - ${fontSize}px`);
  }, []);

  // Delete text input
  const deleteTextInput = useCallback(async (textInputId: string) => {
    try {
      const existingInput = textInputs.find(input => input.id === textInputId);
      if (!existingInput) {
        console.log(`Text input ${textInputId} already deleted`);
        return;
      }

      console.log(`🗑️ Deleting text input: ${textInputId}`);

      // Handle pending creations
      if (pendingCreations.current.has(textInputId)) {
        pendingCreations.current.delete(textInputId);
        setTextInputs(prev => prev.filter(input => input.id !== textInputId));
        if (selectedTextInputId === textInputId) {
          setSelectedTextInputId(null);
        }
        return;
      }

      // Delete from server
      const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${textInputId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to delete text input: ${response.status}`);
      }

      // Remove from local state
      setTextInputs(prev => prev.filter(input => input.id !== textInputId));
      
      if (selectedTextInputId === textInputId) {
        setSelectedTextInputId(null);
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
  }, [sessionId, selectedTextInputId, textInputs, toast]);

  // Load existing text inputs from tags
  const loadTextInputsFromTags = useCallback((tags: any[]) => {
    const textTags = tags.filter(tag => tag.tagType === 'T');
    const convertedInputs: StreamlinedTextInput[] = textTags.map(tag => {
      let fontSize = 16;
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

      const tagDimensions = getTagDimensions('T');

      return {
        id: tag.id,
        coordinates: {
          x: tag.coordinates.x,
          y: tag.coordinates.y,
          width: tag.coordinates.width || tagDimensions.width,
          height: tag.coordinates.height || tagDimensions.height,
          pageNumber: tag.coordinates.pageNumber
        },
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

  // ✅ WebSocket message handling for real-time collaboration
  useEffect(() => {
    if (!webSocket?.webSocketInstance) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        // Only process text input related messages
        if (message.type === 'text_input_position_updated' && message.payload.textInputId) {
          const { textInputId, coordinates } = message.payload;
          
          // Don't update if this is our own change
          if (pendingUpdates.current.has(textInputId)) return;
          
          // Update local state with remote change
          setTextInputs(prev => prev.map(input => 
            input.id === textInputId 
              ? { ...input, coordinates: { ...input.coordinates, ...coordinates } }
              : input
          ));
          
          console.log('📨 Received text input position update:', textInputId);
        }
        
        if (message.type === 'text_input_content_changed' && message.payload.textInputId) {
          const { textInputId, content } = message.payload;
          
          // Don't update if currently selected (user is editing)
          if (selectedTextInputId === textInputId) return;
          
          setTextInputs(prev => prev.map(input => 
            input.id === textInputId 
              ? { ...input, content }
              : input
          ));
          
          console.log('📨 Received text input content update:', textInputId);
        }
        
      } catch (error) {
        console.error('❌ Error processing WebSocket message:', error);
      }
    };

    webSocket.webSocketInstance.addEventListener('message', handleMessage);
    
    return () => {
      webSocket.webSocketInstance?.removeEventListener('message', handleMessage);
    };
  }, [webSocket, selectedTextInputId]);

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      throttledLocalUpdate.current.cancel();
      debouncedPositionSave.current.cancel();
      debouncedContentSave.current.cancel();
      debouncedFontSave.current.cancel();
    };
  }, []);

  return {
    textInputs,
    selectedTextInputId,
    placeTextInput,
    saveTextContent,
    updateFontSize,
    moveTextInput,               // ✅ SMOOTH movement with instant feedback
    completeTextInputInteraction, // ✅ PERSISTENT final position save
    deleteTextInput,
    loadTextInputsFromTags,
    getTextInput,
    selectTextInput,
    isProcessing: pendingCreations.current.size > 0,
    hasPendingUpdates: () => pendingUpdates.current.size > 0
  };
};