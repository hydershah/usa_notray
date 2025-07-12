import React, { useEffect, useRef, useCallback } from 'react';
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

  // Calculate layer position and size with fallback values
  let layerStyle: React.CSSProperties;
  
  try {
    const { top, left } = canvasElement.getBoundingClientRect();
    const containerScrollTop = containerRef.current?.scrollTop || 0;
    const containerScrollLeft = containerRef.current?.scrollLeft || 0;
    
    layerStyle = {
      position: 'absolute',
      top: `${top + containerScrollTop}px`,
      left: `${left + containerScrollLeft}px`,
      width: `${canvasElement.width}px`,
      height: `${canvasElement.height}px`,
      pointerEvents: 'none', // Allow clicks to pass through to canvas below
      zIndex: 500
    };

    console.log('📐 StreamlinedTextLayer positioning:', {
      canvasRect: { top, left, width: canvasElement.width, height: canvasElement.height },
      containerScroll: { top: containerScrollTop, left: containerScrollLeft },
      finalPosition: { top: layerStyle.top, left: layerStyle.left }
    });
  } catch (error) {
    console.error('❌ Error calculating layer position:', error);
    // Fallback: Use relative positioning
    layerStyle = {
      position: 'relative',
      width: '100%',
      height: '100%',
      pointerEvents: 'none', // Allow clicks to pass through to canvas below
      zIndex: 500
    };
  }

  return (
    <div
      ref={layerRef}
      style={layerStyle}
      onClick={handleLayerClick}
      className="streamlined-text-layer"
    >
      {pageTextInputs.map((textInput) => (
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
        />
      ))}
    </div>
  );
}; 