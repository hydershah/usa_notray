import React, { useState } from 'react';
import { PDFTaggingEditor } from '../components/editor/PDFTaggingEditor';
import type { SessionDocument, SessionParticipant, DocumentTag } from '../types/editor';

const EditorDemo: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<'tagging' | 'notary'>('tagging');
  const [tagsCount, setTagsCount] = useState(0);

  // Sample documents
  const sampleDocuments: SessionDocument[] = [
    {
      id: 'doc_1',
      sessionId: 'session_demo',
      fileName: 'Sample Contract.pdf',
      fileUrl: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf', // Sample PDF
      pageCount: 14,
      fileSize: 1024000,
      uploadedAt: new Date()
    },
    {
      id: 'doc_2', 
      sessionId: 'session_demo',
      fileName: 'Agreement Form.pdf',
      fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', // Another sample
      pageCount: 1,
      fileSize: 512000,
      uploadedAt: new Date()
    }
  ];

  // Sample participants
  const sampleParticipants: SessionParticipant[] = [
    {
      id: 'participant_1',
      sessionId: 'session_demo',
      userId: 'notary_123',
      userType: 'notary',
      status: 'active',
      currentPage: 1,
      joinedAt: new Date(),
      lastActivityAt: new Date(),
      displayName: 'Sarah Johnson (Notary)',
      email: 'sarah.johnson@notary.com',
      colorCode: '#FF6B6B' // Will be overridden by system
    },
    {
      id: 'participant_2',
      sessionId: 'session_demo', 
      userId: 'signer1_456',
      userType: 'signer',
      status: 'active',
      currentPage: 1,
      joinedAt: new Date(),
      lastActivityAt: new Date(),
      displayName: 'John Smith',
      email: 'john.smith@email.com',
      colorCode: '#4ECDC4'
    },
    {
      id: 'participant_3',
      sessionId: 'session_demo',
      userId: 'signer2_789', 
      userType: 'signer',
      status: 'active',
      currentPage: 1,
      joinedAt: new Date(),
      lastActivityAt: new Date(),
      displayName: 'Alice Brown',
      email: 'alice.brown@email.com',
      colorCode: '#45B7D1'
    },
    {
      id: 'participant_4',
      sessionId: 'session_demo',
      userId: 'witness_101',
      userType: 'witness',
      status: 'joined',
      currentPage: 1,
      joinedAt: new Date(),
      lastActivityAt: new Date(),
      displayName: 'Robert Wilson (Witness)',
      email: 'robert.wilson@email.com',
      colorCode: '#96CEB4'
    }
  ];

  const handleSessionComplete = () => {
    console.log('Session completed! Tags placed:', tagsCount);
    alert(`Tagging session completed! ${tagsCount} tags were placed. You can now transition to live notary mode.`);
  };

  const handleTagsChanged = (tags: DocumentTag[]) => {
    setTagsCount(tags.length);
  };

  const handleModeSwitch = () => {
    const newMode = currentMode === 'tagging' ? 'notary' : 'tagging';
    setCurrentMode(newMode);
  };

  return (
    <div className="h-screen bg-gray-100">
      {/* Demo Controls */}
      <div className="bg-blue-600 text-white p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">PDF Tagging Editor - Demo</h1>
            <p className="text-blue-100 text-sm">
              Interactive demo of the Digital Notary PDF tagging system
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <div>Mode: <span className="font-bold">{currentMode.toUpperCase()}</span></div>
              <div>Tags: <span className="font-bold">{tagsCount}</span></div>
            </div>
            
            <button
              onClick={handleModeSwitch}
              className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
            >
              Switch to {currentMode === 'tagging' ? 'Notary' : 'Tagging'} Mode
            </button>
          </div>
        </div>
      </div>

      {/* Demo Instructions */}
      <div className="bg-yellow-50 border-b border-yellow-200 p-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start gap-3">
            <div className="text-yellow-600 font-bold">💡</div>
            <div className="text-sm text-yellow-800">
              <strong>How to use:</strong> 
              {currentMode === 'tagging' ? (
                <>
                  Press <kbd className="bg-yellow-200 px-1 rounded">` (backtick)</kbd> for notary, 
                  <kbd className="bg-yellow-200 px-1 rounded">1-3</kbd> for signers. 
                  Then press <kbd className="bg-yellow-200 px-1 rounded">S</kbd> for signature, 
                  <kbd className="bg-yellow-200 px-1 rounded">A</kbd> for name, 
                  <kbd className="bg-yellow-200 px-1 rounded">I</kbd> for initials, etc. 
                  Click on the PDF to place tags.
                </>
              ) : (
                <>
                  In notary mode, you would see real content instead of placeholder tags. 
                  Users can drag, resize, and modify their content in real-time.
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PDF Editor */}
      <div className="h-full">
        <PDFTaggingEditor
          sessionId="demo_session_123"
          mode={currentMode}
          documents={sampleDocuments}
          participants={sampleParticipants}
          currentUserId="notary_123" // Demo as notary by default
          onSessionComplete={handleSessionComplete}
          onTagsChanged={handleTagsChanged}
        />
      </div>
    </div>
  );
};

export default EditorDemo; 