import React, { useEffect, useRef, useCallback, useState } from 'react';
import { StreamlinedTextInput } from './StreamlinedTextInput';

interface StreamlinedTextLayerProps {
  sessionId: string;
  canvasElement: HTMLCanvasElement | null;
  containerRef: React.RefObject<HTMLDivElement>;
  scaleFactor: number;
  pageNumber: number;
  textInputs: Array<{
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
  }>;
  selectedTextInputId: string | null;
  onTextInputSelect?: (textInputId: string | null) => void;
  onSaveContent?: (textInputId: string, content: string) => void;
  onDeleteTextInput?: (textInputId: string) => void;
  onFontSizeChange?: (textInputId: string, fontSize: number) => void;
  moveTextInput?: (textInputId: string, coordinates: { x: number; y: number; width?: number; height?: number }) => void;
  debug?: boolean;
}

export const StreamlinedTextLayer: React.FC<StreamlinedTextLayerProps> = ({
  sessionId,
  canvasElement,
  containerRef,
  scaleFactor,
  pageNumber,
  textInputs = [],
  selectedTextInputId,
  onTextInputSelect,
  onSaveContent,
  onDeleteTextInput,
  onFontSizeChange,
  moveTextInput,
  debug = false
}) => {
  const layerRef = useRef<HTMLDivElement>(null);

  // Filter text inputs for current page
  const pageTextInputs = textInputs.filter(input => 
    input.coordinates.pageNumber === pageNumber
  );

  // Handle layer clicks for deselection - FIXED to not block canvas clicks
  const handleLayerClick = useCallback((e: React.MouseEvent) => {
    // Only deselect if clicking directly on the layer (not on a text input)
    if (e.target === layerRef.current && onTextInputSelect) {
      console.log('🎯 Layer clicked - deselecting text input');
      onTextInputSelect(null);
    }
    // Important: Don't prevent default or stop propagation
    // This allows clicks to pass through to the canvas underneath
  }, [onTextInputSelect]);

  // Handle text input position updates
  const handleTextInputMove = useCallback((textInputId: string, newCoordinates: { x: number; y: number }) => {
    console.log(`📍 Text input ${textInputId} moved to:`, newCoordinates);
    // You can add logic here to update the text input's position in your state
    // For now, the position is saved directly to the backend in StreamlinedTextInput
  }, []);

  // Handle text input resize updates
  const handleTextInputResize = useCallback((textInputId: string, newCoordinates: { x: number; y: number; width: number; height: number }) => {
    console.log(`📐 Text input ${textInputId} resized to:`, newCoordinates);
    // Use moveTextInput to update both position and dimensions
    if (moveTextInput) {
      moveTextInput(textInputId, newCoordinates);
    }
  }, [moveTextInput]);

  if (debug || pageTextInputs.length > 0) {
    console.log('🔍 StreamlinedTextLayer render check:', {
      canvasElement: !!canvasElement,
      pageTextInputsLength: pageTextInputs.length,
      pageNumber,
      textInputsTotal: textInputs.length,
      scaleFactor,
      willRender: !!(canvasElement && pageTextInputs.length > 0),
      textInputsForCurrentPage: pageTextInputs.map(t => ({ id: t.id, coordinates: t.coordinates, content: t.content }))
    });
  }

  if (!canvasElement) {
    if (pageTextInputs.length > 0) {
      console.log('⚠️ StreamlinedTextLayer: Have text inputs but no canvas element yet');
      // Return a placeholder that shows text inputs exist but canvas isn't ready
      return (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg shadow-md">
            Loading text inputs... ({pageTextInputs.length} on this page)
          </div>
        </div>
      );
    }
    return null;
  }

  if (pageTextInputs.length === 0) {
    console.log('ℹ️ StreamlinedTextLayer: No text inputs for page', pageNumber);
    return null;
  }

  // FIXED: Use a simpler approach - cover the entire container
  // Let the individual StreamlinedTextInput components handle their own positioning
  const layerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none', // Allow clicks to pass through except on text inputs
    zIndex: 500
  };

  return (
    <div
      ref={layerRef}
      style={layerStyle}
      onClick={handleLayerClick}
      className="streamlined-text-layer"
    >
      {pageTextInputs.map((textInput) => {
        // Use persistent ID as key to avoid remounting during drag (prevents jitter)
        return (
        <StreamlinedTextInput
          key={textInput.id}
          id={textInput.id}
          coordinates={textInput.coordinates}
          sessionId={sessionId}
          content={textInput.content}
          fontSize={textInput.fontSize}
          fontFamily={textInput.fontFamily}
          textColor={textInput.textColor}
          assignedUserId={textInput.assignedUserId}
          userColor={textInput.userColor}
          isNew={textInput.isNew}
          isSelected={selectedTextInputId === textInput.id}
          scaleFactor={scaleFactor}
          onSave={(content) => {
            if (onSaveContent) {
              onSaveContent(textInput.id, content);
              console.log(`📝 Text saved: "${content}"`);
            }
          }}
          onDelete={() => {
            if (onDeleteTextInput) {
              onDeleteTextInput(textInput.id);
              console.log(`🗑️ Text input deleted: ${textInput.id}`);
            }
          }}
          onSelect={() => {
            if (onTextInputSelect) {
              onTextInputSelect(textInput.id);
            }
          }}
          onMove={(newCoordinates) => handleTextInputMove(textInput.id, newCoordinates)}
          onResize={(newCoordinates) => handleTextInputResize(textInput.id, newCoordinates)}
          onFontSizeChange={(fontSize) => {
            if (onFontSizeChange) {
              onFontSizeChange(textInput.id, fontSize);
            }
          }}
        />
        );
      })}
    </div>
  );
}; 