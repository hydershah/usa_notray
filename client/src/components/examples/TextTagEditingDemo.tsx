import React, { useState } from 'react';
import { DocumentTag } from '../../types/editor';
import { useTextTagEditing } from '../../hooks/editor/useTextTagEditing';

// Mock tag for demonstration
const mockTag: DocumentTag = {
  id: '1',
  sessionId: 'demo-session',
  documentId: 'demo-doc',
  tagType: 'T',
  assignedUserId: '1',
  coordinates: {
    x: 100,
    y: 100,
    width: 200,
    height: 40,
    pageNumber: 1
  },
  displayLabel: 'Text - Demo User',
  colorCode: '#3b82f6',
  isCompleted: false,
  content: '',
  createdAt: new Date(),
  updatedAt: new Date()
};

export const TextTagEditingDemo: React.FC = () => {
  const [tag, setTag] = useState<DocumentTag>(mockTag);
  
  const textEditing = useTextTagEditing({
    tag,
    sessionId: 'demo-session',
    currentUserId: '1',
    onTagClick: (updatedTag) => {
      // Update the tag with new content
      setTag(prev => ({
        ...prev,
        content: textEditing.textInputValue,
        isCompleted: true
      }));
    }
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Text Tag Editing Demo</h2>
      
      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Text Tag: {tag.displayLabel}</h3>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Current Status:</p>
          <div className="flex gap-2 text-sm">
            <span className={`px-2 py-1 rounded ${tag.isCompleted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {tag.isCompleted ? 'Completed' : 'Pending'}
            </span>
            <span className={`px-2 py-1 rounded ${textEditing.isEditingText ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
              {textEditing.isEditingText ? 'Editing' : 'Not Editing'}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Current Content:</p>
          <p className="text-sm font-mono bg-gray-50 p-2 rounded">
            {tag.content || '(No content yet)'}
          </p>
        </div>

        {!textEditing.isEditingText ? (
          <button
            onClick={textEditing.startEditing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Click to Edit Text
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Edit Text Content:
              </label>
              <input
                type="text"
                value={textEditing.textInputValue}
                onChange={textEditing.handleTextInputChange}
                onKeyDown={textEditing.handleKeyDown}
                onBlur={textEditing.handleBlur}
                placeholder="Type your text here..."
                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={textEditing.isSaving}
              />
            </div>

            {textEditing.saveError && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">
                Error: {textEditing.saveError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={textEditing.saveTextContent}
                disabled={textEditing.isSaving || !textEditing.isReadyToSave}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {textEditing.isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={textEditing.cancelEditing}
                disabled={textEditing.isSaving}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>

            {textEditing.isSaving && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Saving text content...
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 bg-gray-50 border rounded-lg p-4">
        <h4 className="font-semibold mb-2">Features Demonstrated:</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• Click to enter edit mode</li>
          <li>• Real-time text input with validation</li>
          <li>• Auto-save on blur (if changes detected)</li>
          <li>• Manual save/cancel buttons</li>
          <li>• Loading states and error handling</li>
          <li>• Keyboard shortcuts (Enter to save, Escape to cancel)</li>
          <li>• Visual feedback for different states</li>
        </ul>
      </div>
    </div>
  );
};
