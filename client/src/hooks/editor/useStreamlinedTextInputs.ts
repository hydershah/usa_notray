import { useState, useCallback, useRef, useEffect } from 'react';
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

  // 🚧 Ensure unique text input IDs – remove accidental duplicates (e.g., when optimistic + WebSocket updates overlap)
  useEffect(() => {
    if (textInputs.length < 2) return;

    const seen = new Set<string>();
    const deduped: StreamlinedTextInput[] = [];

    let hasDuplicates = false;
    for (const input of textInputs) {
      if (seen.has(input.id)) {
        hasDuplicates = true;
        continue; // Skip duplicate
      }
      seen.add(input.id);
      deduped.push(input);
    }

    if (hasDuplicates) {
      console.warn('🧹 Removing duplicate text inputs with identical IDs:', textInputs.map(i => i.id));
      setTextInputs(deduped);
    }
  }, [textInputs]);

  // 🔧 Persistence key for temporary text inputs
  const tempStorageKey = `temp_text_inputs_${sessionId}`;

  // 🔧 Load temporary text inputs from localStorage on initialization
  useEffect(() => {
    try {
      const savedTempInputs = localStorage.getItem(tempStorageKey);
      if (savedTempInputs) {
        const parsedInputs = JSON.parse(savedTempInputs);
        console.log('📂 Recovered temporary text inputs from localStorage:', parsedInputs);
        
        // Add recovered inputs to state
        setTextInputs(prev => {
          const existingIds = new Set(prev.map(input => input.id));
          const recoveredInputs = parsedInputs.filter((input: StreamlinedTextInput) => 
            !existingIds.has(input.id)
          );
          return [...prev, ...recoveredInputs];
        });
        
        // Clear the temporary storage after recovery
        localStorage.removeItem(tempStorageKey);
      }
    } catch (error) {
      console.warn('Failed to recover temporary text inputs:', error);
    }
  }, [sessionId, tempStorageKey]);

  // 🔧 Save temporary text inputs to localStorage when created
  const saveTempInputToStorage = useCallback((input: StreamlinedTextInput) => {
    try {
      const existing = localStorage.getItem(tempStorageKey);
      const existingInputs = existing ? JSON.parse(existing) : [];
      const updatedInputs = [...existingInputs, input];
      localStorage.setItem(tempStorageKey, JSON.stringify(updatedInputs));
      console.log('💾 Saved temporary text input to localStorage:', input.id);
    } catch (error) {
      console.warn('Failed to save temporary text input to localStorage:', error);
    }
  }, [tempStorageKey]);

  // 🔧 Remove temporary text input from localStorage when converted to real ID
  const removeTempInputFromStorage = useCallback((tempId: string) => {
    try {
      const existing = localStorage.getItem(tempStorageKey);
      if (existing) {
        const existingInputs = JSON.parse(existing);
        const filteredInputs = existingInputs.filter((input: StreamlinedTextInput) => input.id !== tempId);
        if (filteredInputs.length > 0) {
          localStorage.setItem(tempStorageKey, JSON.stringify(filteredInputs));
        } else {
          localStorage.removeItem(tempStorageKey);
        }
        console.log('🗑️ Removed temporary text input from localStorage:', tempId);
      }
    } catch (error) {
      console.warn('Failed to remove temporary text input from localStorage:', error);
    }
  }, [tempStorageKey]);

  // 🔧 WebSocket sync callback for real-time text input synchronization
  useEffect(() => {
    const handleWebSocketSync = (eventType: string, data: any) => {
      console.log('📝 Text input WebSocket sync:', eventType, data);
      
      switch (eventType) {
        case 'tag_placed':
          if (data.tagType === 'T') {
            // Convert tag to text input format
            const newTextInput: StreamlinedTextInput = {
              id: data.id.toString(),
              coordinates: {
                x: data.coordinates.x,
                y: data.coordinates.y,
                width: data.coordinates.width,
                height: data.coordinates.height,
                pageNumber: data.coordinates.pageNumber
              },
              content: data.content || '',
              fontSize: 12,
              fontFamily: 'Arial',
              textColor: '#000000',
              assignedUserId: data.assignedUserId,
              userColor: data.colorCode || '#4ECDC4',
              isNew: false,
              createdAt: new Date()
            };
            
            setTextInputs(prev => {
              // If a text input with the final ID already exists, do nothing
              if (prev.some(input => input.id === newTextInput.id)) {
                return prev;
              }

              // Attempt to find a matching optimistic temp input by coordinates (same page & close x/y)
              const tempMatchIndex = prev.findIndex(input => {
                const samePage = input.coordinates.pageNumber === newTextInput.coordinates.pageNumber;
                const closePosition = Math.abs(input.coordinates.x - newTextInput.coordinates.x) < 0.5 &&
                                      Math.abs(input.coordinates.y - newTextInput.coordinates.y) < 0.5;
                return samePage && closePosition && input.id.startsWith('text_temp_');
              });

              if (tempMatchIndex !== -1) {
                // Replace the temp entry with the real one while preserving any local edits
                const updated = [...prev];
                updated[tempMatchIndex] = {
                  ...updated[tempMatchIndex],
                  ...newTextInput,
                  // Preserve local content if user already typed something
                  content: updated[tempMatchIndex].content !== '' ? updated[tempMatchIndex].content : newTextInput.content
                };
                return updated;
              }

              // No matching temp input – just add the new text input
              return [...prev, newTextInput];
            });
          }
          break;
          
        case 'tag_updated':
          if (data.updates.coordinates) {
            setTextInputs(prev => prev.map(input => 
              input.id === data.id 
                ? { ...input, coordinates: { ...input.coordinates, ...data.updates.coordinates } }
                : input
            ));
          }
          break;
          
        case 'tag_deleted':
          setTextInputs(prev => prev.filter(input => input.id !== data.id));
          if (selectedTextInputId === data.id) {
            setSelectedTextInputId(null);
          }
          break;
          
        // 🔧 NEW: Handle tag content updates from WebSocket
        case 'tag_content_updated':
          // Update text input content when notary/other user saves content
          if (data.tagType === 'T') {
            console.log('🔄 Syncing text tag content update:', {
              tagId: data.tagId,
              newContent: data.content,
              isCompleted: data.isCompleted,
              currentlySelected: selectedTextInputId === data.tagId
            });
            
            // Only update if this text input is not currently selected/being edited
            // This prevents overwriting user input while they're actively typing
            if (selectedTextInputId !== data.tagId) {
              setTextInputs(prev => prev.map(input => {
                if (input.id === data.tagId) {
                  console.log('✅ Updated text input content from tag content update:', {
                    id: data.tagId,
                    oldContent: input.content,
                    newContent: data.content,
                    isCompleted: data.isCompleted
                  });
                  return { 
                    ...input, 
                    content: data.content || '',
                    isNew: false // Mark as not new since it has content
                  };
                }
                return input;
              }));
            } else {
              console.log('⚠️ Skipping tag content sync update - text input is currently selected/being edited');
            }
          }
          break;
          
        // ✅ NEW: Handle text input position/resize updates from WebSocket
        case 'text_input_position_updated':
          console.log('📏 Syncing text input position/resize update:', {
            textInputId: data.textInputId,
            coordinates: data.coordinates,
            fromUser: data.updatedByName,
            currentlySelected: selectedTextInputId === data.textInputId
          });
          
          setTextInputs(prev => prev.map(input => {
            if (input.id === data.textInputId) {
              console.log('✅ Updated text input coordinates from WebSocket:', {
                id: data.textInputId,
                oldCoords: input.coordinates,
                newCoords: data.coordinates,
                fromUser: data.updatedByName
              });
              return { 
                ...input, 
                coordinates: {
                  ...input.coordinates,
                  ...data.coordinates
                }
              };
            }
            return input;
          }));
          break;
          
        case 'text_input_content_changed':
          // Update text input content from another user
          console.log('🔄 Syncing text content from another user:', {
            textInputId: data.id,
            newContent: data.content,
            fromUser: data.fromUser,
            currentlySelected: selectedTextInputId === data.id
          });
          
          // Only update if this text input is not currently selected/being edited
          // This prevents overwriting user input while they're actively typing
          if (selectedTextInputId !== data.id) {
            setTextInputs(prev => prev.map(input => {
              if (input.id === data.id) {
                console.log('✅ Updated text input content from sync:', {
                  id: data.id,
                  oldContent: input.content,
                  newContent: data.content,
                  fromUser: data.fromUser
                });
                return { ...input, content: data.content };
              }
              return input;
            }));
          } else {
            console.log('⚠️ Skipping sync update - text input is currently selected/being edited');
          }
          break;
      }
    };

    // Register the callback globally
    if (typeof window !== 'undefined') {
      (window as any).textInputSyncCallback = handleWebSocketSync;
    }

    // Cleanup
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).textInputSyncCallback;
      }
    };
  }, [selectedTextInputId]);

  // Place new text input
  const placeTextInput = useCallback(async (command: PlaceTextInputCommand, userColor: string) => {
    const tempId = `text_temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create optimistic text input for immediate editing
    const inheritedFontSize = textInputs.length > 0 ? textInputs[textInputs.length - 1].fontSize : 12;
    const optimisticTextInput: StreamlinedTextInput = {
      id: tempId,
      coordinates: command.coordinates,
      content: '',
      fontSize: inheritedFontSize,
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
    
    // 🔧 Save to localStorage for recovery on refresh
    saveTempInputToStorage(optimisticTextInput);

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
        tagData: tag,
        serverContent: tag.content,
        currentContent: textInputs.find(t => t.id === tempId)?.content
      });
      
      // Replace optimistic text input with server response while preserving user input
      setTextInputs(prev => prev.map(input => {
        if (input.id === tempId) {
          console.log('🔄 Updating text input ID transition:', {
            tempId,
            newId: tag.id,
            preservingContent: input.content,
            serverContent: tag.content,
            willPreserveUserContent: input.content !== ''
          });
          
          return {
            ...input, // Preserve user's current state (including any typed content)
            id: tag.id, // Update to real server ID
            // Keep isNew as true to maintain editing state until user finishes typing
            isNew: input.content === '' ? true : false,
            // Explicitly preserve content to prevent server overwrite - NEVER use server content if user has typed something
            content: input.content !== '' ? input.content : tag.content || ''
          };
        }
        return input;
      }));

      setSelectedTextInputId(tag.id);
      pendingCreations.current.delete(tempId);
      
      // 🔧 Remove from temporary storage since it's now persisted on server
      removeTempInputFromStorage(tempId);

      console.log(`✅ Text input placed successfully:`, tag.id);
      return tag.id;

    } catch (error) {
      // Remove failed text input
      setTextInputs(prev => prev.filter(input => input.id !== tempId));
      setSelectedTextInputId(null);
      pendingCreations.current.delete(tempId);
      
      // 🔧 Remove from temporary storage since it failed
      removeTempInputFromStorage(tempId);
      
      console.error('❌ Failed to place text input:', error);
      toast({
        variant: "destructive",
        title: "Failed to place text",
        description: "Could not place text input. Please try again."
      });
      throw error;
    }
  }, [sessionId, toast, saveTempInputToStorage, removeTempInputFromStorage, textInputs]);

  // Save text content
  const saveTextContent = useCallback(async (textInputId: string, content: string) => {
    try {
      // Update local state immediately
      setTextInputs(prev => prev.map(input => 
        input.id === textInputId 
          ? { ...input, content, isNew: content.trim() === '' }
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
      // Check if already being deleted or doesn't exist
      const existingInput = textInputs.find(input => input.id === textInputId);
      if (!existingInput) {
        console.log(`Text input ${textInputId} already deleted or doesn't exist`);
        return;
      }

      console.log(`🗑️ Starting deletion of text input: ${textInputId}`);

      // Don't send delete request for temporary/pending inputs
      if (pendingCreations.current.has(textInputId)) {
        console.log(`📝 Deleting pending creation: ${textInputId}`);
        pendingCreations.current.delete(textInputId);
        // Remove from local state for pending items
        setTextInputs(prev => prev.filter(input => input.id !== textInputId));
        if (selectedTextInputId === textInputId) {
          setSelectedTextInputId(null);
        }
        return;
      }

      // For existing server items, send delete request first
      const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${textInputId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        // If it's already deleted (404), that's ok - remove from local state
        if (response.status === 404) {
          console.log(`Text input ${textInputId} was already deleted on server`);
          setTextInputs(prev => prev.filter(input => input.id !== textInputId));
          if (selectedTextInputId === textInputId) {
            setSelectedTextInputId(null);
          }
          return;
        }
        throw new Error(`Failed to delete text input: ${response.status}`);
      }

      // Only remove from local state after successful server deletion
      setTextInputs(prev => prev.filter(input => input.id !== textInputId));
      
      if (selectedTextInputId === textInputId) {
        setSelectedTextInputId(null);
      }

      console.log(`✅ Text input deleted successfully: ${textInputId}`);

    } catch (error) {
      console.error('❌ Failed to delete text input:', error);
      
      // Show user-friendly error message
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: `Failed to delete text input. ${error instanceof Error ? error.message : 'Please try again.'}`
      });
      
      // Note: We don't restore the item to local state here because the deletion
      // might have succeeded on the server even if we got an error response
    }
  }, [sessionId, selectedTextInputId, textInputs, toast]);

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