import { useEffect } from 'react';
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
  mode: 'tagging' | 'notary';
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
    clearSession
  } = useEditorStore();

  // Note: Tag loading is now handled by PDFTaggingEditor to avoid race conditions

  useEffect(() => {
    // Only initialize if the session ID is new
    if (!sessionId || (session && session.id === sessionId)) {
      return;
    }

    console.log('🚀 [useEditorInitialization] Starting basic editor state setup for session:', sessionId);

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
      canPlaceTags: mode === 'tagging' || mode === 'notary' || mode === 'signing',
      canModifyContent: mode === 'notary',
      showPlaceholders: true
    });

    // Tags will be loaded by PDFTaggingEditor to prevent race conditions
    
    console.log('✅ [useEditorInitialization] Basic editor state setup completed (tags will be loaded by PDFTaggingEditor)');

    // Cleanup on unmount or when session ID changes
    return () => {
      if (sessionId) {
        console.log('🔄 Clearing session state for:', sessionId);
        clearSession();
      }
    };
  }, [sessionId, documents, participants, currentUserId, mode]);

  // Cleanup stale temporary tags periodically
  useEffect(() => {
    const cleanupStaleTags = () => {
      const now = Date.now();
      const staleThreshold = 30000; // 30 seconds
      
      const currentTags = useEditorStore.getState().tags;
      const staleTempTags = currentTags.filter(tag => {
        if (!tag.id.toString().startsWith('temp_')) return false;
        
        // Extract timestamp from temp ID format: temp_TIMESTAMP_RANDOM
        const parts = tag.id.split('_');
        if (parts.length >= 2) {
          const timestamp = parseInt(parts[1]);
          if (!isNaN(timestamp) && (now - timestamp) > staleThreshold) {
            console.warn(`Found stale temporary tag: ${tag.id} (age: ${now - timestamp}ms)`);
            return true;
          }
        }
        return false;
      });
      
      if (staleTempTags.length > 0) {
        console.log(`🧹 Cleaning up ${staleTempTags.length} stale temporary tags`);
        // Remove stale tags from store
        const { deleteTag } = useEditorStore.getState();
        staleTempTags.forEach(tag => deleteTag(tag.id));
      }
    };
    
    // Run cleanup every 30 seconds
    const interval = setInterval(cleanupStaleTags, 30000);
    
    // Also run cleanup on mount after a short delay
    const timeout = setTimeout(cleanupStaleTags, 2000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);
}; 