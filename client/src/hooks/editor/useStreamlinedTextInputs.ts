import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useEditorStore } from './useEditorStore';
import { calculateOptimalWidth, getTagDimensions } from '@/lib/constants/tagConstants';

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
  // Track last local coordinate updates to suppress echo from websocket
  const lastLocalCoordinateUpdateAt = useRef<Map<string, number>>(new Map());
  const { toast } = useToast();

  // Remove duplicate text inputs by ID
  useEffect(() => {
    if (textInputs.length < 2) return;

    const seen = new Set<string>();
    const deduped: StreamlinedTextInput[] = [];

    for (const input of textInputs) {
      if (!seen.has(input.id)) {
        seen.add(input.id);
        deduped.push(input);
      }
    }

    if (deduped.length < textInputs.length) {
      setTextInputs(deduped);
    }
  }, [textInputs.length]);

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
      if (typeof window !== 'undefined' && (window as any).__DEBUG_EDITOR__) {
        console.log('📝 Text input WebSocket sync:', eventType, data);
      }
      
      switch (eventType) {
        case 'tag_placed':
          if (data.tagType === 'T') {
            // Ignore our own placement broadcasts to prevent duplicates
            const currentUserId = useEditorStore.getState().currentUser?.id?.toString();
            if (data.updatedBy && currentUserId && data.updatedBy.toString() === currentUserId) {
              console.log('⏭️ Skipping self tag_placed echo for text tag:', data.id);
              return;
            }
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
              // Increase tolerance to account for rounding/snap adjustments and async races
              const COORD_TOLERANCE = 8; // px in PDF units
              let tempMatchIndex = prev.findIndex(input => {
                const samePage = input.coordinates.pageNumber === newTextInput.coordinates.pageNumber;
                const closePosition = Math.abs(input.coordinates.x - newTextInput.coordinates.x) < COORD_TOLERANCE &&
                                      Math.abs(input.coordinates.y - newTextInput.coordinates.y) < COORD_TOLERANCE;
                return samePage && closePosition && input.id.startsWith('text_temp_');
              });

              // Fallback: if no close match, replace the most recent temp on the same page if reasonably near
              if (tempMatchIndex === -1) {
                const RECENT_MS = 3000; // created within last 3s
                const NEAR_TOLERANCE = 24; // looser distance for fallback
                let nearestIdx = -1;
                let nearestDist = Number.POSITIVE_INFINITY;
                const now = Date.now();
                prev.forEach((input, idx) => {
                  if (!input.id.startsWith('text_temp_')) return;
                  if (input.coordinates.pageNumber !== newTextInput.coordinates.pageNumber) return;
                  if (now - new Date(input.createdAt).getTime() > RECENT_MS) return;
                  const dx = (input.coordinates.x - newTextInput.coordinates.x);
                  const dy = (input.coordinates.y - newTextInput.coordinates.y);
                  const d = Math.hypot(dx, dy);
                  if (d < nearestDist) {
                    nearestDist = d;
                    nearestIdx = idx;
                  }
                });
                if (nearestIdx !== -1 && nearestDist <= NEAR_TOLERANCE) {
                  tempMatchIndex = nearestIdx;
                }
              }

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
            // Ignore echoes of our own updates entirely
            try {
              const currentUserId = useEditorStore.getState().currentUser?.id?.toString();
              if (data.updatedBy && currentUserId && String(data.updatedBy) === currentUserId) {
                console.log('⏭️ Skipping self echo for tag_updated (text):', data.id);
                break;
              }
            } catch {}

            // Skip updates that were recently made locally (extend window)
            const lastLocalUpdate = lastLocalCoordinateUpdateAt.current.get(data.id) || 0;
            const timeSinceLocal = Date.now() - lastLocalUpdate;
            
            if (timeSinceLocal > 3000) {
              // Only apply if enough time has passed since local update
              setTextInputs(prev => prev.map(input => 
                input.id === data.id 
                  ? { ...input, coordinates: { ...input.coordinates, ...data.updates.coordinates } }
                  : input
              ));
            } else {
              console.log('⏭️ Suppressing remote tag_updated due to recent local move:', { id: data.id, timeSinceLocal });
            }
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

        // ✅ NEW: Handle font size updates broadcast via WebSocket
        case 'tag_font_size_updated': {
          const { tagId, fontSize } = data || {};
          if (!tagId) break;
          setTextInputs(prev => prev.map(input => 
            input.id === tagId 
              ? { ...input, fontSize: typeof fontSize === 'number' ? fontSize : input.fontSize }
              : input
          ));
          break;
        }
          
        // ✅ NEW: Handle text input position/resize updates from WebSocket
        case 'text_input_position_updated':
          console.log('📏 Syncing text input position/resize update:', {
            textInputId: data.textInputId,
            coordinates: data.coordinates,
            fromUser: data.updatedByName,
            currentlySelected: selectedTextInputId === data.textInputId
          });
          
          // Ignore self-broadcasted updates entirely
          try {
            const currentUserId = useEditorStore.getState().currentUser?.id?.toString();
            if (data.updatedBy && currentUserId && String(data.updatedBy) === currentUserId) {
              console.log('⏭️ Skipping self echo for text_input_position_updated:', data.textInputId);
              break;
            }
          } catch {}

          // Suppress echo shortly after local change (extend window)
          const lastAt = lastLocalCoordinateUpdateAt.current.get(data.textInputId) || 0;
          if (Date.now() - lastAt < 2000) {
            console.log('⏭️ Skipping echo coordinate update shortly after local change:', data.textInputId);
            break;
          }

          setTextInputs(prev => prev.map(input => {
            if (input.id !== data.textInputId) return input;
            const newC = data.coordinates;
            const oldC = input.coordinates;
            const same = Math.abs((oldC.x ?? 0) - (newC.x ?? oldC.x)) < 0.25 &&
                        Math.abs((oldC.y ?? 0) - (newC.y ?? oldC.y)) < 0.25 &&
                        Math.abs((oldC.width ?? 0) - (newC.width ?? oldC.width)) < 0.25 &&
                        Math.abs((oldC.height ?? 0) - (newC.height ?? oldC.height)) < 0.25;
            if (same) {
              return input; // avoid redundant state churn
            }
            console.log('✅ Applied remote coordinate update:', {
              id: data.textInputId,
              oldCoords: oldC,
              newCoords: newC,
              fromUser: data.updatedByName
            });
            return {
              ...input,
              coordinates: {
                ...oldC,
                ...newC
              }
            };
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
    
    // Create optimistic text input for immediate positioning (not editing)
    // Use lastUsedFontSize from editor store, fallback to 16px default
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
      isNew: true, // Mark as new for positioning behavior
      createdAt: new Date()
    };

    // Add to local state immediately for responsive positioning
    setTextInputs(prev => [...prev, optimisticTextInput]);
    // Select the new tag for positioning (not editing initially)
    setSelectedTextInputId(tempId);
    // Ensure any previously selected non-text tag is cleared so font controls
    // target this newly placed text input immediately
    try {
      useEditorStore.getState().selectTag(null);
    } catch {}
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
      // Send to server with font size
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
          immediateEdit: false, // Changed to false - position first, edit second
          fontSize: fontSize // ✅ FIX: Send font size to server to maintain user's preferred size
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
      const tempLocal = textInputs.find(t => t.id === tempId);
      const locallyTypedContent = tempLocal?.content || '';
      setTextInputs(prev => prev.map(input => {
        if (input.id === tempId) {
          const keepContent = input.content !== '' ? input.content : (tag.content || '');
          return {
            ...input,
            id: tag.id,
            // Keep editing state to avoid re-mount flicker and data loss
            isNew: input.isNew,
            content: keepContent,
            // Preserve any locally adjusted styling made before the server responded
            fontSize: input.fontSize,
            fontFamily: input.fontFamily,
            textColor: input.textColor
          };
        }
        return input;
      }));

      setSelectedTextInputId(tag.id);
      // Re-clear any lingering selected tag to keep font-size routing correct
      try {
        useEditorStore.getState().selectTag(null);
      } catch {}
      pendingCreations.current.delete(tempId);
      
      // 🔧 Remove from temporary storage since it's now persisted on server
      removeTempInputFromStorage(tempId);

      console.log(`✅ Text input placed successfully:`, tag.id);

      // If user had already typed content before real ID arrived, persist it now
      if (locallyTypedContent.trim().length > 0) {
        try {
          await fetch(`/api/editor/session/${sessionId}/text-tag/${tag.id}/content`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              content: locallyTypedContent,
              fontSize: optimisticTextInput.fontSize,
              fontFamily: 'Arial',
              textColor: '#000000'
            })
          });
          console.log('📝 Persisted pre-typed content after ID assignment');
        } catch (persistError) {
          console.warn('Failed to persist pre-typed content after ID assignment:', persistError);
        }
      }
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

  // Move text input to new coordinates (moved above saveTextContent to avoid TDZ)
  const moveTextInput = useCallback(async (textInputId: string, coordinates: { x: number; y: number; width?: number; height?: number }) => {
    try {
      // Update local state immediately for responsive UI
      setTextInputs(prev => prev.map(input => 
        input.id === textInputId
          ? {
              ...input,
              coordinates: {
                ...input.coordinates,
                x: coordinates.x,
                y: coordinates.y,
                ...(coordinates.width !== undefined && { width: coordinates.width }),
                ...(coordinates.height !== undefined && { height: coordinates.height })
              }
            }
          : input
      ));

      // Track this local update to prevent echo
      lastLocalCoordinateUpdateAt.current.set(textInputId, Date.now());
      
      // If this is a temporary ID, don't call the server yet (prevents 400s)
      if (textInputId.startsWith('text_temp_') || textInputId.startsWith('temp')) {
        return;
      }

      // Clear existing timeout for this text input
      const existingTimeout = debouncedCoordinateUpdates.current.get(textInputId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Debounce server updates to prevent excessive API calls during drag
      const timeout = setTimeout(async () => {
        try {
          // Determine endpoint: use /position when only moving (x,y),
          // and /dimensions when resizing (width/height provided)
          const current = textInputs.find(i => i.id === textInputId);
          const fallbackDims = getTagDimensions('T' as any);

          const xVal = Number.isFinite(coordinates.x) ? coordinates.x : current?.coordinates.x ?? 0;
          const yVal = Number.isFinite(coordinates.y) ? coordinates.y : current?.coordinates.y ?? 0;
          const wValRaw = coordinates.width ?? current?.coordinates.width;
          const hValRaw = coordinates.height ?? current?.coordinates.height;

          const hasSize = wValRaw !== undefined && hValRaw !== undefined;
          const widthVal = hasSize ? Math.max(1, Math.round((wValRaw as number) || fallbackDims.width)) : undefined;
          const heightVal = hasSize ? Math.max(1, Math.round((hValRaw as number) || fallbackDims.height)) : undefined;

          const useDimensionsEndpoint = hasSize;
          const endpoint = useDimensionsEndpoint
            ? `/api/editor/session/${sessionId}/text-tag/${textInputId}/dimensions`
            : `/api/editor/session/${sessionId}/text-tag/${textInputId}/position`;

          const body = useDimensionsEndpoint
            ? JSON.stringify({ x: xVal, y: yVal, width: widthVal, height: heightVal })
            : JSON.stringify({ x: xVal, y: yVal });

          const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body
          });

          if (!response.ok) {
            throw new Error('Failed to update text input coordinates');
          }

          console.log(`✅ Text input ${textInputId} moved to coordinates:`, { x: xVal, y: yVal, width: widthVal, height: heightVal });
          lastLocalCoordinateUpdateAt.current.set(textInputId, Date.now());
          debouncedCoordinateUpdates.current.delete(textInputId);
        } catch (error) {
          console.error('❌ Failed to update text input coordinates on server:', error);
          // Don't show toast for debounced server errors during drag
        }
      }, 200); // 200ms debounce delay - smooth but not overwhelming server

      debouncedCoordinateUpdates.current.set(textInputId, timeout);
    } catch (error) {
      console.error('❌ Failed to move text input:', error);
      toast({
        title: "Error",
        description: "Failed to update text input position",
        variant: "destructive",
      });
    }
  }, [toast, sessionId, textInputs]);

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

      // Skip auto-resize on save to prevent zigzagging
      // Let the StreamlinedTextInput component handle sizing based on content

      // Do not attempt server save for temporary IDs
      if (textInputId.startsWith('text_temp_') || textInputId.startsWith('temp')) {
        console.log('⏭️ Skipping server save for temporary text input ID:', textInputId);
        return;
      }

      // Persist content to server so it survives refresh and marks tag as completed
      try {
        const toPersist = textInputs.find(i => i.id === textInputId);
        const response = await fetch(`/api/editor/session/${sessionId}/text-tag/${textInputId}/content`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            content,
            fontSize: toPersist?.fontSize || 16,
            fontFamily: toPersist?.fontFamily || 'Arial',
            textColor: toPersist?.textColor || '#000000'
          })
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to save text content');
        }

        const result = await response.json();
        console.log('✅ Server text content saved:', result);

        // Reflect completion state from server
        if (result?.tag?.id) {
          setTextInputs(prev => prev.map(input => 
            input.id === result.tag.id
              ? { 
                  ...input, 
                  content: result.tag.content ?? content, 
                  isNew: !(result.tag.isCompleted) 
                }
              : input
          ));
        }
      } catch (serverError) {
        console.error('❌ Failed to persist text content to server:', serverError);
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: 'Could not save text to server. Your text is kept locally until retry.'
        });
      }

    } catch (error) {
      console.error('❌ Failed to save text content:', error);
      toast({
        variant: "destructive", 
        title: "Save Failed",
        description: "Failed to save text content. Please try again."
      });
    }
  }, [toast, sessionId, textInputs, moveTextInput]);

  // Debounced font size API calls to prevent lag
  const debouncedFontSizeUpdates = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Debounced coordinate updates to prevent excessive API calls during drag
  const debouncedCoordinateUpdates = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Cleanup debounced timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear all pending coordinate updates
      debouncedCoordinateUpdates.current.forEach(timeout => clearTimeout(timeout));
      debouncedCoordinateUpdates.current.clear();
      
      // Clear all pending font size updates
      debouncedFontSizeUpdates.current.forEach(timeout => clearTimeout(timeout));
      debouncedFontSizeUpdates.current.clear();
    };
  }, []);
  
  // Update font size with debouncing
  const updateFontSize = useCallback(async (textInputId: string, fontSize: number, fontFamily?: string, textColor?: string) => {
    try {
      // Update local state immediately for responsive UI
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

      // ✅ FIX: Update lastUsedFontSize in editor store so new text tags use the same font size
      const { setLastUsedFontSize } = useEditorStore.getState();
      setLastUsedFontSize(fontSize);
      console.log(`🎨 Updated lastUsedFontSize to ${fontSize}px for future text tags`);

      // Debounce server updates to prevent lag during drag operations
      const existingTimeout = debouncedFontSizeUpdates.current.get(textInputId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(async () => {
        try {
          // Send to server after debounce delay
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

          console.log(`✅ Font size updated on server for ${textInputId}: ${fontSize}px`);
          debouncedFontSizeUpdates.current.delete(textInputId);

        } catch (serverError) {
          console.error('❌ Failed to update font size on server:', serverError);
          // Don't show toast for debounced server errors during drag
        }
      }, 300); // 300ms debounce delay - smooth but not overwhelming server

      debouncedFontSizeUpdates.current.set(textInputId, timeout);

    } catch (error) {
      console.error('❌ Failed to update font size locally:', error);
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
      let fontSize = 16; // Updated from 12 to 16 for consistency
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

      // Use stored dimensions from database, only fallback to constants for new tags
      const tagDimensions = getTagDimensions('T');

      return {
        id: tag.id,
        coordinates: {
          x: tag.coordinates.x,
          y: tag.coordinates.y,
          width: tag.coordinates.width || tagDimensions.width,  // Use stored width, fallback to constants
          height: tag.coordinates.height || tagDimensions.height, // Use stored height, fallback to constants
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

    // Merge with existing state to preserve any optimistic entries and avoid vanishing on placement
    setTextInputs(prev => {
      const byId = new Map<string, StreamlinedTextInput>(prev.map(i => [i.id, i]));

      // Overwrite/insert server-derived inputs
      for (const input of convertedInputs) {
        const existing = byId.get(input.id);
        // If we have a recent local coordinate update, avoid overwriting with potentially stale server coords
        const lastLocalAt = existing ? (lastLocalCoordinateUpdateAt.current.get(existing.id) || 0) : 0;
        const recentlyMovedLocally = Date.now() - lastLocalAt < 1200; // 1.2s protection window

        if (existing && recentlyMovedLocally) {
          // Merge everything except coordinates to prevent snapping back
          byId.set(input.id, {
            ...existing,
            content: input.content,
            fontSize: input.fontSize,
            fontFamily: input.fontFamily,
            textColor: input.textColor,
            assignedUserId: input.assignedUserId,
            userColor: input.userColor,
            isNew: input.isNew,
            createdAt: existing.createdAt || input.createdAt
          });
        } else {
          byId.set(input.id, {
            ...(existing || {}),
            ...input,
            // Preserve original creation time if present to keep stable keys
            createdAt: existing?.createdAt || input.createdAt
          });
        }
      }

      // Preserve recent optimistic temp inputs that haven't been persisted yet
      const now = Date.now();
      prev.forEach(input => {
        const isTemp = input.id.startsWith('text_temp_') || input.id.startsWith('temp_') || input.id.startsWith('temp');
        const isRecent = now - new Date(input.createdAt).getTime() < 15000; // 15s window
        if (isTemp && isRecent && !byId.has(input.id)) {
          byId.set(input.id, input);
        }
      });

      return Array.from(byId.values());
    });
  }, []);

  // Get text input by ID
  const getTextInput = useCallback((textInputId: string) => {
    return textInputs.find(input => input.id === textInputId);
  }, [textInputs]);

  // Select text input
  const selectTextInput = useCallback((textInputId: string | null) => {
    setSelectedTextInputId(textInputId);
    try {
      // Reflect selection globally so keyboard shortcuts can be suppressed
      ((useEditorStore.getState() as any).setActiveTextInputId)?.(textInputId);
      // When selecting a text input, clear any active tool to prevent dual selection
      if (textInputId) {
        useEditorStore.getState().setSelectedTagType(null);
        // Also clear any selected non-text tag so font-size dropdown targets the
        // active text input immediately without requiring a reselect
        try { useEditorStore.getState().selectTag(null); } catch {}
      }
    } catch {}
  }, []);

  return {
    textInputs,
    selectedTextInputId,
    placeTextInput,
    saveTextContent,
    updateFontSize,
    moveTextInput,
    deleteTextInput,
    loadTextInputsFromTags,
    getTextInput,
    selectTextInput,
    isProcessing: pendingCreations.current.size > 0
  };
};