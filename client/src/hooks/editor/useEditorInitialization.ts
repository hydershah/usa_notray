import { useEffect, useCallback } from 'react';
import { useEditorStore } from './useEditorStore';
import type { 
  EditorSession, 
  SessionDocument, 
  SessionParticipant,
  EditorMode,
  DocumentTag
} from '../../types/editor';

interface UseEditorInitializationProps {
  sessionId: string;
  mode: 'tagging' | 'live_signing';
  documents: SessionDocument[];
  participants: SessionParticipant[];
  currentUserId?: string;
}

export const useEditorInitialization = ({
  sessionId,
  mode,
  documents,
  participants,
  currentUserId
}: UseEditorInitializationProps) => {
  const {
    session,
    setSession,
    setDocuments,
    setParticipants,
    setCurrentUser,
    setSelectedUser,
    setCurrentDocument,
    setMode,
    setTags,
    clearSession,
  } = useEditorStore();

  const loadSessionTags = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/editor/session/${sessionId}/tags`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const { tags: existingTags } = await response.json();
        setTags(existingTags);
        console.log(`✅ Loaded ${existingTags.length} existing tags for session`);
      }
    } catch (error) {
      console.error('Failed to load session tags:', error);
    }
  }, [sessionId, setTags]);

  useEffect(() => {
    // Only initialize if the session ID is new
    if (!sessionId || (session && session.id === sessionId)) {
      return;
    }

    console.log('🚀 Starting editor initialization for session:', sessionId);

    // Set up editor state with props data
    setSession({ id: sessionId, status: 'active', sessionType: mode } as EditorSession);
    setDocuments(documents);
    setParticipants(participants);

    if (documents.length > 0) {
      console.log('📄 Setting current document:', documents[0].fileName);
      setCurrentDocument(documents[0]);
    }

    const currentParticipant = participants.find(p => p.userId === currentUserId);
    if (currentParticipant) {
      setCurrentUser(currentParticipant);
      setSelectedUser(currentParticipant);
    }

    setMode({
      mode: mode,
      canPlaceTags: mode === 'tagging',
      canModifyContent: mode === 'live_signing',
      showPlaceholders: true
    });

    loadSessionTags();
    
    console.log('✅ PDF editor state initialized');

    // Cleanup on unmount or when session ID changes
    return () => {
      if (sessionId) {
        console.log('🔄 Clearing session state for:', sessionId);
        clearSession();
      }
    };
  }, [sessionId, documents, participants, currentUserId, mode]);
}; 