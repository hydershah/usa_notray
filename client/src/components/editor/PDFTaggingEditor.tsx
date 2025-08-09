import React, { useCallback, useEffect, useState, useRef, useMemo, useImperativeHandle } from 'react';
import { PDFViewer } from './PDFViewer';
import { TaggingToolbar } from './TaggingToolbar';

import { useEditorStore } from '../../hooks/editor/useEditorStore';
import { HotkeyHandler } from './HotkeyHandler';
import { TagInputModal } from './TagInputModal';
import { SealConfigDialog } from './SealConfigDialog';
import { Badge } from '../ui/badge';
import { TAG_TYPE_CONFIG } from '../../lib/constants/tagConstants';
import { useToast } from '@/hooks/use-toast';
import { useTagOperations } from '../../hooks/editor/useTagOperations';
import { useStreamlinedTextInputs } from '../../hooks/editor/useStreamlinedTextInputs';
import { getTagDimensions } from '@/lib/constants/tagConstants';
import { IncompleteTagHUD } from './IncompleteTagHUD';
import type { 
  EditorSession, 
  SessionDocument, 
  SessionParticipant,
  DocumentTag,
  TagType,
  TagCoordinates
} from '@/types/editor';
import type { WebSocketConnection } from '@/hooks/editor/useWebSocket';

interface PDFTaggingEditorProps {
  sessionId: string;
  mode: 'tagging' | 'notary' | 'signing';
  documents: SessionDocument[];
  participants: SessionParticipant[];
  currentUserId: string;
  onSessionComplete?: () => void;
  onTagsChanged?: (tags: DocumentTag[]) => void;
  // Live signing specific props
  liveSessionState?: any;
  onSetActiveUser?: (userId: number) => void;
  onSyncUsers?: () => void;
  isSyncLoading?: boolean;
  webSocket?: WebSocketConnection;
}

export interface PDFTaggingEditorHandle {
  jumpToTag: (tagId: string) => Promise<void> | void;
}

export const PDFTaggingEditor = React.forwardRef<PDFTaggingEditorHandle, PDFTaggingEditorProps>(({
  sessionId,
  mode,
  documents,
  participants,
  currentUserId,
  onSessionComplete,
  onTagsChanged,
  liveSessionState,
  onSetActiveUser,
  onSyncUsers,
  isSyncLoading = false,
  webSocket
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track current page canvas for StreamlinedTextLayer
  const [currentPageCanvas, setCurrentPageCanvas] = useState<HTMLCanvasElement | null>(null);
  const pdfViewerRef = useRef<any>(null); // Add ref to access PDFViewer internals
  const [highlightedTagId, setHighlightedTagId] = useState<string | null>(null);
  
  // Interactive tag modal state
  const [selectedTagForInput, setSelectedTagForInput] = useState<DocumentTag | null>(null);
  const [tagModalPosition, setTagModalPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
  
  // Seal configuration dialog state
  const [showSealDialog, setShowSealDialog] = useState(false);
  const [selectedSealTag, setSelectedSealTag] = useState<DocumentTag | null>(null);
  const [sealDialogLoading, setSealDialogLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  
  const { toast } = useToast();

  // Tag operations with batching and debouncing
  const {
    placeTag,
    updateTagPosition,
    updateTagSize,
    saveTagUpdate,
    deleteTag,
    batchSaveChanges,
    placeWhiteoutOverlay
  } = useTagOperations(sessionId, webSocket);

  // Streamlined text inputs for immediate editing
  const {
    textInputs,
    selectedTextInputId,
    placeTextInput,
    saveTextContent,
    updateFontSize,
    moveTextInput,
    deleteTextInput,
    loadTextInputsFromTags,
    selectTextInput
  } = useStreamlinedTextInputs(sessionId);

  // Flag to suppress global click handler after placing text input
  const [justPlacedTextInput, setJustPlacedTextInput] = useState(false);
  
  // Get current page and scale factor
  const currentPage = useEditorStore.getState().viewer.currentPage || 1;
  const scaleFactor = useEditorStore.getState().viewer.zoomLevel || 1;
  


  // Store state - MOVED UP to fix initialization order
  const {
    session,
    currentDocument,
    selectedUser,
    selectedTag,
    selectedTagType,
    tags,
    viewer,
    currentUser,
    setSession,
    setDocuments,
    setCurrentDocument,
    switchToDocument,
    setSelectedUser,
    setSelectedTagType,
    setTags,
    setParticipants,
    setCurrentUser,
    setMode,
    setZoomLevel,
    setWebSocket,
    setConnectionStatus,
    getCurrentDocumentTags,
    getDocumentTags,
    loadTagsForDocument,
    getTagDimensions,
    selectTag,
    setCurrentPage
  } = useEditorStore();

  // Handle document switching (placed before jumpToTag to avoid use-before-declare)
  const handleDocumentChange = useCallback(async (document: SessionDocument) => {
    try {
      console.log(`🔄 Switching to document: ${document.fileName}`);
      // Switch to the document (this clears selected tags and resets viewer state)
      switchToDocument(document);
      // Load tags for the new document
      await loadTagsForDocument(document.id);
      // Load whiteout overlays for the new document
      await useEditorStore.getState().loadWhiteoutOverlays(document.id);
      // Load streamlined text inputs for this document
      loadTextInputsFromTags(getDocumentTags(document.id));
      console.log(`✅ Successfully switched to document: ${document.fileName}`);
    } catch (error) {
      console.error('❌ Failed to switch document:', error);
      toast({
        title: "Error",
        description: "Failed to switch document. Please try again.",
        variant: "destructive",
      });
    }
  }, [switchToDocument, loadTagsForDocument, getDocumentTags, loadTextInputsFromTags, toast]);

  // Compute incomplete tags for current document to visually pulse them
  const incompleteTagsForCurrentDoc = useMemo(() => {
    if (!currentDocument) return [] as string[];
    return tags
      .filter(t => t.documentId === currentDocument.id && !t.isCompleted)
      .map(t => t.id);
  }, [tags, currentDocument]);

  // Expose imperative handle for jumping to a tag from parent
  useImperativeHandle(ref, () => ({
    jumpToTag: async (tagId: string) => {
      try {
        const targetTag = useEditorStore.getState().tags.find(t => t.id.toString() === tagId.toString());
        if (!targetTag) {
          console.warn('jumpToTag: tag not found', tagId);
          return;
        }

        // Switch document if needed
        if (!currentDocument || currentDocument.id !== targetTag.documentId) {
          const targetDoc = documents.find(d => d.id === targetTag.documentId);
          if (targetDoc) {
            await (async () => {
              await handleDocumentChange(targetDoc);
            })();
          }
        }

        // Set page and highlight
        setCurrentPage(targetTag.coordinates.pageNumber);
        setHighlightedTagId(targetTag.id);
        // Clear highlight after a short delay
        window.setTimeout(() => setHighlightedTagId(null), 2000);
      } catch (e) {
        console.error('jumpToTag failed', e);
      }
    }
  }), [documents, currentDocument, handleDocumentChange, setCurrentPage]);

  
  
  // Handle page load from PDFViewer to get canvas element
  const handlePageLoad = useCallback((pageNumber: number, canvas: HTMLCanvasElement, scaleFactor: number) => {
    console.log(`📄 Canvas updated for page ${pageNumber}:`, canvas);
    
    // Update canvas if this is the current page
    if (pageNumber === (viewer.currentPage || 1)) {
      setCurrentPageCanvas(canvas);
      console.log(`✅ Set current page canvas for page ${pageNumber}`);
    }
    
    // Also store all page canvases for potential fallback (optional enhancement)
  }, [viewer.currentPage]);

  // Update canvas when current page changes - with fallback canvas retrieval
  useEffect(() => {
    const updateCanvasForCurrentPage = () => {
      const currentPage = viewer.currentPage || 1;
      
      // Try to find the canvas element for the current page
      const canvas = document.querySelector(`canvas[data-page-number="${currentPage}"]`) as HTMLCanvasElement;
      
      if (canvas) {
        setCurrentPageCanvas(canvas);
        console.log(`✅ Found canvas for page ${currentPage} via DOM query`);
      } else {
        console.log(`⚠️ Canvas not found for page ${currentPage}, will wait for page load event`);
        // Reset canvas to trigger re-render when it becomes available
        setCurrentPageCanvas(null);
      }
    };
    
    // Update immediately
    updateCanvasForCurrentPage();
    
    // Also update after a small delay to catch late-rendered canvases
    const timer = setTimeout(updateCanvasForCurrentPage, 100);
    
    return () => clearTimeout(timer);
  }, [viewer.currentPage]);

  // Handle global clicks to deselect text inputs
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // Suppress global click handler if text input was just placed
      if (justPlacedTextInput) {
        console.log('🎯 Suppressing global click handler - text input just placed');
        setJustPlacedTextInput(false);
        return;
      }

      // Check if the click is outside any text input or control
      const target = e.target as HTMLElement;
      
      // Don't deselect if clicking specifically on a text input element or its direct children
      // Allow clicks on empty space within the text layer to deselect
      if (target.closest('[data-text-input-id]') || 
          target.closest('.streamlined-text-input') || 
          target.tagName === 'INPUT') {
        return;
      }
      
      // Don't deselect if clicking on toolbar or controls
      if (target.closest('.tagging-toolbar') || target.closest('.tag-input-modal')) {
        return;
      }
      
      // Don't deselect if clicking on a tag (let tag click handler manage selection)
      if (target.closest('.professional-tag') || target.closest('[data-tag-id]')) {
        return;
      }
      
      // Deselect text input
      if (selectedTextInputId) {
        console.log('🎯 Global click detected - deselecting text input');
        selectTextInput(null);
      }
      // Deselect tag
      if (useEditorStore.getState().selectedTag) {
        console.log('🎯 Global click detected - deselecting tag');
        useEditorStore.getState().selectTag(null);
      }
    };
    
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [selectedTextInputId, selectTextInput, justPlacedTextInput, scaleFactor, currentPage]);

  // ✅ NEW: Clear text input selection when tag selection changes to a different tag
  // This ensures no multi-selection conflicts between text inputs and tags
  useEffect(() => {    
    // If a tag is selected and it's not a text tag, clear text input selection
    if (selectedTag && selectedTag.tagType !== 'T' && selectedTextInputId) {
      console.log('🧹 Auto-clearing text input selection - non-text tag selected:', {
        selectedTag: selectedTag.id,
        tagType: selectedTag.tagType,
        clearingTextInput: selectedTextInputId
      });
      selectTextInput(null);
    }
    
    // If a text tag is selected, ensure the corresponding text input is selected
    if (selectedTag && selectedTag.tagType === 'T') {
      const matchingTextInput = textInputs.find(input => input.id === selectedTag.id.toString());
      if (matchingTextInput && selectedTextInputId !== matchingTextInput.id) {
        console.log('🔗 Syncing text input selection with text tag selection:', {
          tagId: selectedTag.id,
          textInputId: matchingTextInput.id
        });
        selectTextInput(matchingTextInput.id);
      }
    }
  }, [selectedTag, selectedTextInputId, selectTextInput, textInputs]);

  // ✅ CLEANUP: Clear text input selection when session changes or component unmounts
  useEffect(() => {
    return () => {
      if (selectedTextInputId) {
        console.log('🧹 Cleanup - clearing text input selection on unmount/session change');
        selectTextInput(null);
      }
    };
  }, [sessionId, selectedTextInputId, selectTextInput]);

  // Store WebSocket instance in editor store for global access - stabilized to prevent infinite loops
  const stableWebSocket = useMemo(() => {
    // Return webSocket instance with connection state info
    if (webSocket?.connectionState?.isConnected) {
      console.log('✅ WebSocket ready for global access');
      return webSocket;
    } else if (webSocket?.connectionState?.isConnecting) {
      console.log('🔌 WebSocket connecting...');
      return null; // Don't expose until connected
    } else {
      console.log('❌ WebSocket not available');
      return null;
    }
  }, [webSocket?.connectionState?.isConnected, webSocket?.connectionState?.isConnecting]);
  
  useEffect(() => {
    if (stableWebSocket) {
      console.log('📡 Storing WebSocket instance in editor store for global access');
      setWebSocket(stableWebSocket);
    } else {
      console.log('📡 Clearing WebSocket instance from editor store');
      setWebSocket(null);
    }
    
    // Update connection status in store for UI feedback
    setConnectionStatus(!!stableWebSocket);
  }, [stableWebSocket, setWebSocket, setConnectionStatus]);

  // Track WebSocket connection state for UI feedback
  const [wsConnectionState, setWsConnectionState] = useState<{
    isConnected: boolean;
    isConnecting: boolean;
    isReady: boolean;
  }>({
    isConnected: false,
    isConnecting: false,
    isReady: false
  });
  
  useEffect(() => {
    const newState = {
      isConnected: webSocket?.connectionState?.isConnected || false,
      isConnecting: webSocket?.connectionState?.isConnecting || false,
      isReady: !!(webSocket?.connectionState?.isConnected && stableWebSocket)
    };
    
    setWsConnectionState(newState);
    
    console.log('🔗 WebSocket connection state:', newState);
  }, [webSocket?.connectionState?.isConnected, webSocket?.connectionState?.isConnecting, stableWebSocket]);

  // Initialize session on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Set basic session data
        setSession({
          id: sessionId,
          jobId: '',
          notaryId: '',
          status: 'active',
          sessionType: mode === 'signing' ? 'notary' : mode as 'tagging' | 'notary',
          createdAt: new Date()
        });

        setDocuments(documents);
        setParticipants(participants);
        
        if (documents.length > 0) {
          setCurrentDocument(documents[0]);
        }

        // Set current user
        const currentParticipant = participants.find(p => p.userId === currentUserId);
        if (currentParticipant) {
          setCurrentUser(currentParticipant);
          setSelectedUser(currentParticipant);
        }

        // Set mode configuration - PROPER SIGNER RESTRICTIONS
        const isNotary = currentParticipant?.userType === 'notary' || currentParticipant?.role === 'notary';
        const isAdmin = currentParticipant?.role === 'admin';
        
        const canPlaceTags = mode === 'tagging' || (mode === 'signing' && (isNotary || isAdmin));
        
        console.log('🔧 Setting editor mode:', {
          mode,
          currentUserId,
          currentParticipant,
          isNotary,
          isAdmin,
          canPlaceTags,
          userType: currentParticipant?.userType,
          role: currentParticipant?.role
        });
        
        setMode({
          mode: mode === 'signing' ? 'tagging' : mode as 'tagging' | 'notary',
          canPlaceTags, // ❌ SIGNERS CANNOT PLACE NEW TAGS
          canModifyContent: mode === 'notary' || mode === 'signing',
          showPlaceholders: mode === 'tagging' || mode === 'signing'
        });

        // Load existing tags for all documents in session
        console.log(`🔍 Loading existing tags for session: ${sessionId}`);
        const response = await fetch(`/api/editor/session/${sessionId}/tags?t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });

        if (response.ok) {
          const { tags: existingTags } = await response.json();
          console.log(`✅ Loaded ${existingTags.length} existing tags:`, existingTags);
          
          // Filter out any temporary tags that might have persisted
          const validTags = existingTags.filter((tag: any) => {
            if (tag.id && tag.id.toString().startsWith('temp_')) {
              console.warn('Filtering out temporary tag:', tag.id);
              return false;
            }
            return true;
          });
          
          setTags(validTags);
          
          // Load text tags into streamlined text input system for current document
          const currentDocTags = validTags.filter((tag: any) => 
            tag.documentId === documents[0]?.id
          );
          loadTextInputsFromTags(currentDocTags);
          
          // Load whiteout overlays for the current document
          await useEditorStore.getState().loadWhiteoutOverlays(documents[0]?.id);
          
          console.log(`📄 Loaded ${currentDocTags.length} tags for current document ${documents[0]?.fileName}`);
          
          if (validTags.length > 0) {
            console.log(`🏷️  Tags loaded successfully - session appears to be a continuation of previous work`);
          } else {
            console.log(`📝 No existing tags found - starting fresh tagging session`);
          }
        } else {
          console.error(`❌ Failed to load existing tags:`, response.status, response.statusText);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize session:', err);
        setError('Failed to load session. Please try again.');
        setIsLoading(false);
      }
    };

    if (sessionId) {
      initializeSession();
    }
  }, [sessionId, mode, documents, participants, currentUserId]);

  // Set initial zoom level based on mode (only once)
  const [hasSetInitialZoom, setHasSetInitialZoom] = useState(false);
  
  useEffect(() => {
    if (!hasSetInitialZoom) {
      // Delay zoom setting to ensure PDF is loaded and container is ready
      const timer = setTimeout(() => {
        if (mode === 'signing') {
          setZoomLevel(1.5); // 150% zoom for signing mode
          console.log('🔍 Set initial zoom level to 150% for signing mode');
        } else if (mode === 'tagging') {
          setZoomLevel(2.0); // 200% zoom for tagging mode
          console.log('🔍 Set initial zoom level to 200% for tagging mode');
        }
        setHasSetInitialZoom(true);
      }, 200); // Small delay to ensure PDF container is ready
      
      return () => clearTimeout(timer);
    }
  }, [mode, setZoomLevel, hasSetInitialZoom]);

  // Load user profiles for content auto-fill
  useEffect(() => {
    const loadUserProfiles = async () => {
      if (mode !== 'signing') return;
      
      try {
        console.log('🔄 Loading user profiles for signature functionality...');
        const profilePromises = participants.map(async (participant) => {
          try {
            const response = await fetch(`/api/users/${participant.userId}/profile/comprehensive`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            });
            
            if (response.ok) {
              const profile = await response.json();
              console.log(`✅ Loaded profile for ${participant.displayName}:`, {
                hasSignatureData: !!profile.signatureData,
                hasSignatureImage: !!profile.signatureImage,
                hasInitialData: !!profile.initialData
              });
              
              // Transform profile to expected format for InteractiveTagInput
              return {
                userId: participant.userId,
                profile: {
                  name: profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
                  signatures: profile.signatureImage ? [profile.signatureImage] : (profile.signatureData ? [profile.signatureData] : []),
                  initials: profile.initialsImage ? [profile.initialsImage] : (profile.initialData ? [profile.initialData] : []),
                  commissionNumber: profile.commissionNumber || '',
                  commissionExpiration: profile.commissionExpiration || '',
                  disclosure: profile.disclosure || '',
                  // Include all profile data for backward compatibility
                  signatureData: profile.signatureData,
                  signatureImage: profile.signatureImage,
                  initialsImage: profile.initialsImage,
                  initialData: profile.initialData,
                  signatureTyped: profile.signatureTyped,
                  initialsTyped: profile.initialsTyped
                }
              };
            } else {
              console.warn(`⚠️ Failed to load profile for ${participant.displayName}`);
              return null;
            }
          } catch (error) {
            console.error(`❌ Error loading profile for ${participant.displayName}:`, error);
            return null;
          }
        });
        
        const profiles = await Promise.all(profilePromises);
        const profileMap: Record<string, any> = {};
        
        profiles.forEach((result) => {
          if (result) {
            profileMap[result.userId] = result.profile;
          }
        });
        
        setUserProfiles(profileMap);
        console.log('✅ All user profiles loaded:', Object.keys(profileMap).length, 'profiles');
        
      } catch (error) {
        console.error('Failed to load user profiles:', error);
      }
    };

    loadUserProfiles();
  }, [mode, participants]);

  // Handle instant tag completion (whiteout) - Complete immediately without user interaction
  const handleInstantTagCompletion = useCallback(async (tag: DocumentTag) => {
    try {
      console.log('⚡ Instantly completing tag:', tag.id, 'Type:', tag.tagType);
      
      // 🔒 CRITICAL: Don't complete temporary tags
      if (tag.id.startsWith('temp_')) {
        console.log('⏳ Skipping instant completion for temporary tag, waiting for server ID:', tag.id);
        return;
      }
      
      // Whiteout tags don't need content - they just work as white rectangles
      const response = await fetch(`/api/editor/session/${sessionId}/tag/${tag.id}/content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content: 'WHITEOUT',
          contentType: 'whiteout',
          completedBy: parseInt(currentUserId),
          completedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Instant completion failed');
      }

      const result = await response.json();
      
      // Update local state with the completed tag
      const updatedTags = tags.map(t =>
        t.id === tag.id ? { ...t, isCompleted: true, content: 'WHITEOUT', contentType: 'whiteout' } : t
      );
      setTags(updatedTags);

      console.log('✅ Tag instantly completed:', tag.id);
      
    } catch (error) {
      console.error('❌ Failed to instantly complete tag:', error);
      toast({
        title: "Whiteout Failed",
        description: error instanceof Error ? error.message : 'Failed to apply whiteout',
        variant: "destructive"
      });
    }
  }, [sessionId, toast, tags, setTags, currentUserId]);

  // Handle auto-fill tag with profile data - MOVED BEFORE useEffect to fix hoisting issue
  const handleAutoFillTag = useCallback(async (tag: DocumentTag) => {
    try {
      console.log('🔥 Auto-filling tag:', tag.id, 'Type:', tag.tagType);
      
      // 🔒 CRITICAL: Don't auto-fill temporary tags
      if (tag.id.startsWith('temp_')) {
        console.log('⏳ Skipping auto-fill for temporary tag, waiting for server ID:', tag.id);
        toast({
          title: "Processing...", 
          description: "Tag is being saved, please try again in a moment",
          variant: "default"
        });
        return;
      }
      
      const response = await fetch(`/api/editor/session/${sessionId}/tag/${tag.id}/fill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Auto-fill failed');
      }

      const result = await response.json();
      
      console.log('✅ Tag auto-filled successfully:', {
        tagId: tag.id,
        tagType: tag.tagType,
        autoFillResult: result.autoFillResult,
        resultTag: result.tag,
        contentFromAutoFill: result.autoFillResult?.content,
        contentFromTag: result.tag?.content,
        contentDataFromAutoFill: result.autoFillResult?.contentData,
        contentDataFromTag: result.tag?.contentData,
        contentTypeFromAutoFill: result.autoFillResult?.contentType,
        hasImageContent: result.autoFillResult?.contentType === 'image',
        contentLength: result.autoFillResult?.content?.length || 0
      });
      
      // Update local state with the auto-filled tag - PREFER SERVER RESPONSE
      const updatedTags = tags.map(t =>
        t.id === tag.id ? {
          ...t,
          // Use server response data (result.tag) first, then fallback to autoFillResult
          isCompleted: true,
          content: result.tag?.content || result.autoFillResult?.content,
          contentData: result.tag?.contentData || (result.autoFillResult?.contentData ? JSON.stringify(result.autoFillResult.contentData) : undefined),
          contentType: result.tag?.contentType || result.autoFillResult?.contentType,
          updatedAt: new Date()
        } : t
      );
      setTags(updatedTags);

      // Show success message
      toast({
        title: "Tag Auto-Filled",
        description: result.message || 'Tag filled with profile data',
        variant: "default"
      });

      console.log('✅ Tag auto-filled successfully:', {
        autoFillResult: result.autoFillResult,
        resultTag: result.tag,
        contentFromAutoFill: result.autoFillResult?.content,
        contentFromTag: result.tag?.content,
        contentDataFromAutoFill: result.autoFillResult?.contentData,
        contentDataFromTag: result.tag?.contentData,
        contentTypeFromAutoFill: result.autoFillResult?.contentType,
        hasImageContent: result.autoFillResult?.contentType === 'image',
        contentLength: result.autoFillResult?.content?.length || 0
      });
      
    } catch (error) {
      console.error('❌ Failed to auto-fill tag:', error);
      toast({
        title: "Auto-Fill Failed",
        description: error instanceof Error ? error.message : 'Failed to auto-fill tag',
        variant: "destructive"
      });
    }
  }, [sessionId, toast, tags, setTags]);

  // Handle seal configuration
  const handleSealConfig = useCallback(async (config: { applicableSigners: number[]; notarizationType: string; notaryNote?: string }) => {
    if (!selectedSealTag) return;
    
    try {
      setSealDialogLoading(true);
      
      console.log('🔖 Configuring seal with:', config, 'Tag ID:', selectedSealTag.id);
      
      // If tag has temporary ID, wait for it to get a real database ID
      let tagToUse = selectedSealTag;
      if (selectedSealTag.id.startsWith('temp_')) {
        console.log('⏳ Tag has temporary ID, waiting for database save...');
        
        // Wait up to 10 seconds for the tag to get a real ID
        let attempts = 0;
        const maxAttempts = 20; // 10 seconds (500ms * 20)
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
          attempts++;
          
          // Check if any tags now have real IDs that match our temporary tag
          const currentTags = tags.filter(t => 
            t.tagType === 'E' && 
            !t.id.startsWith('temp_') && 
            !t.isCompleted &&
            Math.abs(t.coordinates.x - selectedSealTag.coordinates.x) < 10 &&
            Math.abs(t.coordinates.y - selectedSealTag.coordinates.y) < 10 &&
            t.coordinates.pageNumber === selectedSealTag.coordinates.pageNumber
          );
          
          if (currentTags.length > 0) {
            tagToUse = currentTags[0];
            console.log('✅ Found tag with real ID:', tagToUse.id);
            break;
          }
        }
        
        if (tagToUse.id.startsWith('temp_')) {
          throw new Error('Tag is still being saved. Please try again in a moment.');
        }
      }
      
      const response = await fetch(`/api/editor/session/${sessionId}/tag/${tagToUse.id}/seal-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to configure seal');
      }

      const result = await response.json();
      
      // Update local state with the configured seal
      const updatedTags = tags.map(t =>
        t.id === tagToUse.id ? { 
          ...t, 
          isCompleted: true, 
          contentData: result.sealData?.contentData,
          content: result.sealData?.content
        } : t
      );
      setTags(updatedTags);
      
      // Close dialog
      setShowSealDialog(false);
      setSelectedSealTag(null);

      // Show success message
      toast({
        title: "Seal Configured",
        description: `Seal applied for ${config.applicableSigners.length} signer(s) with ${config.notarizationType} notarization`,
        variant: "default"
      });

      console.log('✅ Seal configured successfully:', result);
      
    } catch (error) {
      console.error('❌ Failed to configure seal:', error);
      toast({
        title: "Seal Configuration Failed",
        description: error instanceof Error ? error.message : 'Failed to configure seal',
        variant: "destructive"
      });
    } finally {
      setSealDialogLoading(false);
    }
  }, [sessionId, selectedSealTag, tags, setTags, toast]);

  // Handle seal dialog close
  const handleSealDialogClose = useCallback(() => {
    setShowSealDialog(false);
    setSelectedSealTag(null);
    setSealDialogLoading(false);
  }, []);

  // Keep only instant completion for whiteout tags - remove auto-trigger for other tags
  useEffect(() => {
    if (mode !== 'signing') return;
    
    const instantTags = ['W']; // Only instant completion tags (whiteout)
    
    // Find tags that are ready for instant completion (only whiteout tags)
    const tagsReadyForInstant = tags.filter(tag => 
      instantTags.includes(tag.tagType) && 
      !tag.isCompleted && 
      !tag.id.startsWith('temp_') && // Has real database ID
      tag.createdAt && // Recently created
      Date.now() - new Date(tag.createdAt).getTime() < 10000 // Within last 10 seconds
    );
    
    // Instantly complete whiteout tags (keep this functionality)
    tagsReadyForInstant.forEach((tag: DocumentTag) => {
      (async () => {
        try {
          console.log('⚡ Auto-triggering instant completion for newly placed tag:', tag.id, tag.tagType);
          await handleInstantTagCompletion(tag);
        } catch (error) {
          console.warn('Auto-trigger instant completion failed:', error);
        }
      })();
    });
    
    // Note: Other tags now require manual click to fill (restored original behavior)
  }, [tags, mode, handleInstantTagCompletion]);

  // Handle tag click in signing mode - FIXED VERSION
  const handleTagClick = useCallback(async (tag: DocumentTag, position: { x: number; y: number; width: number; height: number }) => {
    // Clear active tool when interacting with an existing tag to prevent dual selection
    useEditorStore.getState().setSelectedTagType(null);
    
    // ✅ CRITICAL FIX: Clear text input selection when clicking any tag
    // This prevents the multi-selection issue where text tags stay selected
    if (selectedTextInputId) {
      console.log('🧹 Clearing text input selection before tag interaction:', selectedTextInputId);
      selectTextInput(null);
    }
    
    // Clear any existing tag selection first to prevent conflicts
    const currentSelectedTag = useEditorStore.getState().selectedTag;
    if (currentSelectedTag && currentSelectedTag.id !== tag.id) {
      console.log('🧹 Clearing previous tag selection:', currentSelectedTag.id);
      selectTag(null);
    }

    console.log('🏷️ Tag click in PDFTaggingEditor:', {
      tagId: tag.id,
      tagType: tag.tagType,
      assignedUserId: tag.assignedUserId,
      currentUserId,
      isCompleted: tag.isCompleted
    });
    
    // Check if user can interact with this tag
    const currentParticipant = participants.find(p => p.userId === currentUserId);
    const isNotary = currentParticipant?.userType === 'notary';
    const isAssignedUser = tag.assignedUserId === currentUserId;
    const isUniversalTag = ['T', 'D'].includes(tag.tagType); // Text and Date tags
    
    const canEdit = currentParticipant && (isNotary || isAssignedUser || isUniversalTag);

    console.log('🔐 Permission check result:', {
      currentParticipant: currentParticipant?.displayName,
      isNotary,
      isAssignedUser,
      isUniversalTag,
      canEdit
    });

    if (!canEdit) {
      let errorMessage = "You cannot edit this tag.";
      
      if (!currentParticipant) {
        errorMessage = "User session not found. Please refresh the page.";
      } else if (!isNotary && !isAssignedUser && !isUniversalTag) {
        errorMessage = `This ${tag.tagType} tag is assigned to another participant. Only the notary and assigned user can edit it.`;
      }
      
      toast({
        title: "Cannot Edit Tag",
        description: errorMessage,
        variant: "destructive"
      });
      return;
    }

    // Check if user is active in live session
    if (liveSessionState && liveSessionState.state === 'active') {
      const isActiveUser = liveSessionState.activeUserId === currentUserId || 
                          liveSessionState.activeUserId?.toString() === currentUserId?.toString();
      
      if (!isActiveUser && !isNotary) {
        toast({
          title: "Cannot Edit Tag", 
          description: "You are not the active user. Ask the notary to activate you.",
          variant: "destructive"
        });
        return;
      }
    }

    console.log('✅ All permission checks passed, determining tag interaction type');
    
    // 🚀 NEW AUTO-FILL LOGIC: Route by tag type - NOTARY SIGNATURE AUTO-APPLY
    // Check who the tag is assigned to (not who is clicking it)
    const assignedParticipant = participants.find(p => p.userId === tag.assignedUserId);
    const isTagAssignedToNotary = assignedParticipant?.userType === 'notary';
    
    // For notary tags, signatures should auto-apply since they always have their signature in profile
    // For signer/witness tags, signatures should open selection modal
    const baseAutoFillTags = ['A', 'I', 'N', 'X', 'D', 'O']; // Auto-fill from profile
    const autoFillTags = isTagAssignedToNotary ? [...baseAutoFillTags, 'S'] : baseAutoFillTags; // Include signatures for notary tags
    const modalTags = isTagAssignedToNotary ? [] : ['S']; // Only show signature modal for signer/witness tags
    
    console.log('🎯 Tag interaction routing:', {
      tagType: tag.tagType,
      assignedUserId: tag.assignedUserId,
      assignedParticipant: assignedParticipant?.displayName,
      isTagAssignedToNotary,
      currentUserIsNotary: isNotary,
      autoFillTags,
      modalTags,
      willAutoApply: autoFillTags.includes(tag.tagType),
      willShowModal: modalTags.includes(tag.tagType)
    });
    const sealTags = ['E']; // Seal tags that open configuration dialog
    const inlineEditTags = ['T']; // Inline text editing
    const instantTags = ['W']; // Tags that work instantly without user interaction (whiteout)
    
    if (instantTags.includes(tag.tagType)) {
      // ⚡ INSTANT: Complete whiteout tags immediately without user interaction
      console.log('⚡ Instant completion for tag:', tag.tagType);
      await handleInstantTagCompletion(tag);
    } else if (sealTags.includes(tag.tagType)) {
      // 🔖 SEAL DIALOG: Open seal configuration dialog
      console.log('🔖 Opening seal configuration dialog for tag:', tag.tagType, 'ID:', tag.id);
      setSelectedSealTag(tag);
      setShowSealDialog(true);
    } else if (modalTags.includes(tag.tagType)) {
      // 🎯 MODAL: Open selection modal for signer/witness signature tags
      console.log('🎯 Opening selection modal for tag:', tag.tagType, 'assigned to:', assignedParticipant?.displayName, '(signer/witness)', {
        tagId: tag.id,
        assignedUserId: tag.assignedUserId,
        assignedUserType: assignedParticipant?.userType,
        currentUserId,
        currentUserIsNotary: isNotary,
        isTagAssignedToNotary
      });
      
      // For signature tags, ensure we have the user profile loaded
      if (tag.tagType === 'S') {
        const targetUserId = tag.assignedUserId || currentUserId;
        const userProfile = userProfiles[targetUserId];
        console.log('📋 User profile for signature:', {
          targetUserId,
          targetUserName: assignedParticipant?.displayName,
          targetUserType: assignedParticipant?.userType,
          hasProfile: !!userProfile,
          hasSignatures: !!userProfile?.signatures?.length,
          hasSignatureData: !!userProfile?.signatureData,
          hasSignatureImage: !!userProfile?.signatureImage,
          userProfilesKeys: Object.keys(userProfiles),
          userProfilesLength: Object.keys(userProfiles).length,
          isSignerTag: !isTagAssignedToNotary,
          currentUserIsNotary: isNotary
        });
        
        // If no profile loaded, show a helpful message but still open the modal
        if (!userProfile) {
          console.warn('⚠️ No user profile loaded, but opening modal anyway');
          toast({
            title: "Loading Profile",
            description: "Opening signature selection...",
            variant: "default"
          });
        }
      }
      
      console.log('📍 Setting modal state:', {
        tagId: tag.id,
        position,
        willOpenModal: true
      });
      
      setSelectedTagForInput(tag);
      setTagModalPosition(position);
      
      // Force a small delay to ensure state is set
      setTimeout(() => {
        console.log('✅ Modal state should be set:', {
          selectedTagForInput: !!tag,
          tagModalPosition: !!position
        });
      }, 50);
    } else if (autoFillTags.includes(tag.tagType)) {
      // 🔥 AUTO-FILL: Call API to fill with profile data (includes notary signatures)
      console.log('🎯 Auto-filling tag with profile data:', tag.tagType, 'assigned to:', assignedParticipant?.displayName, isTagAssignedToNotary ? '(notary tag)' : '(general tag)');
      
      // Extra safety check - don't auto-fill seal tags
      if (tag.tagType === 'E') {
        console.error('🚫 BLOCKED: Attempted to auto-fill seal tag, should use dialog instead:', tag.id);
        toast({
          title: "Seal Configuration Required",
          description: "Seal tags require configuration dialog, not auto-fill",
          variant: "destructive"
        });
        return;
      }
      
      await handleAutoFillTag(tag);
    } else if (inlineEditTags.includes(tag.tagType)) {
      // ✏️ INLINE EDIT: Start inline text editing for text tags
      console.log('✏️ Starting inline text editing for tag:', tag.tagType);
      
      // Find the text input with matching tag ID and trigger editing directly
      const matchingTextInput = textInputs.find(input => input.id === tag.id.toString());
      if (matchingTextInput) {
        // Select the text input first
        selectTextInput(matchingTextInput.id);
        
        // ✅ DIRECT APPROACH: Instead of synthetic events, directly trigger editing via state
        // This prevents duplication by avoiding multiple event handlers
        setTimeout(() => {
          console.log('🎯 Directly triggering text input editing for:', matchingTextInput.id);
          
          // Try to find the text input element and call its click handler directly
          const textElement = document.querySelector(`[data-text-input-id="${matchingTextInput.id}"]`);
          if (textElement) {
            // Instead of dispatching events, directly call the StreamlinedTextInput's selection logic
            // The component will handle starting edit mode when selected
            const inputElement = textElement.querySelector('input');
            if (inputElement) {
              inputElement.focus();
              inputElement.click();
            } else {
              // If no input field is visible, the component isn't in edit mode yet
              // The single click will trigger edit mode
              (textElement as HTMLElement).click();
            }
          }
        }, 100);
        
        toast({
          title: "Text Editing Active",
          description: "Text input is now active for editing.",
          variant: "default"
        });
      } else {
        console.warn('⚠️ No matching text input found for tag:', tag.id);
        toast({
          title: "Text Input Not Found",
          description: "Could not find the text input for editing.",
          variant: "destructive"
        });
      }
    } else {
      // 📝 FALLBACK: Show modal for unknown tag types
      console.log('📝 Fallback to modal for unknown tag type:', tag.tagType);
      setSelectedTagForInput(tag);
      setTagModalPosition(position);
    }
  }, [mode, participants, currentUserId, liveSessionState, toast, handleAutoFillTag, userProfiles, textInputs, selectTextInput]);

  // Handle tag content save
  const handleTagContentSave = useCallback(async (content: any) => {
    if (!selectedTagForInput) return;

    try {
      const response = await fetch(`/api/editor/session/${sessionId}/tag/${selectedTagForInput.id}/content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content,
          completedBy: currentUserId,
          completedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save tag content');
      }

      // Update local state
      const updatedTags = tags.map(tag =>
        tag.id === selectedTagForInput.id
          ? { ...tag, isCompleted: true, contentData: content }
          : tag
      );
      setTags(updatedTags);

      // Auto-resize tag based on new content
      const contentValue = typeof content === 'string' ? content : content.value || '';
      if (contentValue.trim().length > 0) {
        // Calculate optimal dimensions for the tag
        const { calculateOptimalWidth, calculateOptimalHeight } = await import('@/lib/constants/tagConstants');
        
        const optimalWidth = calculateOptimalWidth(contentValue, 12, 'Arial');
        const optimalHeight = calculateOptimalHeight(contentValue, 12);
        
        // Get current tag dimensions
        const currentTag = tags.find(tag => tag.id === selectedTagForInput.id);
        if (currentTag) {
          const currentWidth = currentTag.coordinates.width || 100;
          const currentHeight = currentTag.coordinates.height || 30;
          
          // Use the larger of current dimensions or optimal dimensions
          const newWidth = Math.max(currentWidth, optimalWidth);
          const newHeight = Math.max(currentHeight, optimalHeight);
          
          // Only update if dimensions need to change
          if (newWidth !== currentWidth || newHeight !== currentHeight) {
            // Update tag coordinates
            const updateResponse = await fetch(`/api/editor/session/${sessionId}/tag/${selectedTagForInput.id}/coordinates`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                width: newWidth,
                height: newHeight
              })
            });
            
            if (updateResponse.ok) {
              console.log('✅ Tag auto-resized based on content:', {
                tagId: selectedTagForInput.id,
                oldWidth: currentWidth,
                oldHeight: currentHeight,
                newWidth,
                newHeight,
                content: contentValue.substring(0, 50)
              });
            }
          }
        }
      }

      toast({
        title: "Tag Completed",
        description: "Content saved successfully.",
      });

      setSelectedTagForInput(null);
      setTagModalPosition(null);

    } catch (error) {
      console.error('Failed to save tag content:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save tag content. Please try again.",
        variant: "destructive"
      });
    }
  }, [selectedTagForInput, sessionId, currentUserId, tags, setTags, toast]);

  // Handle tag placement from PDF click
  const handleTagPlacement = useCallback(async (coordinates: TagCoordinates) => {
    console.log('🎯 handleTagPlacement called with coordinates:', coordinates);
    console.log('🔍 Tag placement data check:', {
      selectedTagType,
      selectedUser,
      currentDocument: currentDocument?.id,
      hasSelectedUser: !!selectedUser,
      hasCurrentDocument: !!currentDocument
    });
    
            // Special debugging for disclosure tags
        if (selectedTagType === 'O') {
          console.log('📋 DISCLOSURE TAG PLACEMENT DEBUG:', {
            selectedTagType,
            selectedTagTypeType: typeof selectedTagType,
            selectedUser: selectedUser?.displayName,
            currentDocument: currentDocument?.fileName,
            coordinates,
            mode
          });
        }
    
    if (!selectedTagType || !selectedUser || !currentDocument) {
      console.error('❌ Missing required data for tag placement:', {
        selectedTagType,
        selectedUser: !!selectedUser,
        currentDocument: !!currentDocument,
        selectedUserDetails: selectedUser,
        currentDocumentDetails: currentDocument
      });
      return;
    }

    try {
      // Check if this is a text tag - use streamlined text input system
      if (selectedTagType === 'T') {
        console.log('📝 Placing streamlined text input...');
        console.log('Current text inputs before placement:', textInputs);
        
        // Use professional fixed dimensions for text tags
        const dimensions = getTagDimensions('T');
        
        console.log('🔍 DEBUG: Text tag placement - dimensions from getTagDimensions:', dimensions);
        console.log('🔍 DEBUG: TAG_TYPE_CONFIG T dimensions:', TAG_TYPE_CONFIG['T']);
        console.log('🔍 DEBUG: Original coordinates:', coordinates);
        
        // Use the fixed dimensions instead of coordinates from click
        const textInputCoordinates = {
          ...coordinates,
          width: dimensions?.width || 120,  // Use updated constant dimensions for text tags
          height: dimensions?.height || 25   // Use updated constant dimensions for text tags
        };
        
        console.log('🔍 DEBUG: Final textInputCoordinates being sent to server:', textInputCoordinates);
        console.log('🔍 DEBUG: width being sent:', textInputCoordinates.width);
        console.log('🔍 DEBUG: height being sent:', textInputCoordinates.height);
        
        console.log('📏 Using dimensions for text tag:', dimensions);
        
        // Set flag to suppress global click handler for the next click
        setJustPlacedTextInput(true);
        
        // Safety timeout to reset flag in case the click handler is never triggered
        setTimeout(() => {
          setJustPlacedTextInput(false);
        }, 2000);
        
        await placeTextInput({
          documentId: currentDocument.id,
          coordinates: textInputCoordinates,
          assignedUserId: parseInt(selectedUser.userId.toString())
        }, selectedUser.colorCode || '#4ECDC4');
        
        console.log('✅ Streamlined text input placed successfully!');
        console.log('Text inputs after placement:', textInputs);
        
        // Auto-switch back to pointer mode after placing text tag
        setSelectedTagType(null);
        
        // Force a re-render by updating the canvas
        setTimeout(() => {
          const currentPage = viewer.currentPage || 1;
          const canvas = document.querySelector(`canvas[data-page-number="${currentPage}"]`) as HTMLCanvasElement;
          if (canvas) {
            setCurrentPageCanvas(null);
            setTimeout(() => setCurrentPageCanvas(canvas), 10);
          }
        }, 100);
        
        return;
      }

      // Check if this is a whiteout - use direct overlay system (no tag creation)
      if (selectedTagType === 'W') {
        console.log('⬜ Placing whiteout overlay directly...');
        
        // Use fixed dimensions for whiteout like other tags
        const whiteoutDimensions = getTagDimensions('W');
        const whiteoutCoordinates = {
          ...coordinates,
          width: whiteoutDimensions?.width || 120,
          height: whiteoutDimensions?.height || 25
        };
        
        await placeWhiteoutOverlay({
          documentId: currentDocument.id,
          coordinates: whiteoutCoordinates,
          sessionId
        });
        
        console.log('✅ Whiteout overlay placed successfully!');
        
        // Auto-switch back to pointer mode after placing whiteout
        setSelectedTagType(null);
        
        return;
      }
        console.log('📍 Placing regular tag...');
        console.log('🔍 DEBUG: Tag placement data:', {
          documentId: currentDocument.id,
          tagType: selectedTagType,
          coordinates,
          assignedUserId: selectedUser.userId
        });
        
        console.log('🔍 DEBUG: Store state before placement:', {
          tagsCount: tags.length,
          tags: tags.map(t => ({ id: t.id, type: t.tagType }))
        });
        
        // Use professional fixed dimensions for all tag types
        console.log('🔍 About to get dimensions for tagType:', selectedTagType, 'type:', typeof selectedTagType);
        const tagDimensions = getTagDimensions(selectedTagType);
        console.log('🔍 Retrieved tagDimensions:', tagDimensions);
        
        const professionalCoordinates = {
          ...coordinates,
          width: tagDimensions?.width || 120,
          height: tagDimensions?.height || 30
        };
        
        console.log('🔍 Final professionalCoordinates:', professionalCoordinates);
        
        // Special debugging for disclosure tags
        if (selectedTagType === 'O') {
          console.log('📋 DISCLOSURE TAG - About to call placeTag with:', {
            documentId: currentDocument.id,
            tagType: selectedTagType,
            coordinates: professionalCoordinates,
            assignedUserId: selectedUser.userId
          });
        }
        
        await placeTag({
          documentId: currentDocument.id,
          tagType: selectedTagType,
          coordinates: professionalCoordinates,
          assignedUserId: selectedUser.userId
        });
        
        console.log('✅ Tag placed successfully!');
        
        // Special confirmation for disclosure tags
        if (selectedTagType === 'O') {
          console.log('📋 DISCLOSURE TAG - Successfully placed!');
        }
        
        // Auto-switch back to pointer mode after placing tag
        setSelectedTagType(null);
        
        // Check store state after placement
        setTimeout(() => {
          const newTags = useEditorStore.getState().tags;
          console.log('🔍 DEBUG: Store state after placement:', {
            tagsCount: newTags.length,
            tags: newTags.map(t => ({ id: t.id, type: t.tagType }))
          });
        }, 100);
    } catch (error) {
      console.error('❌ Failed to place tag:', error);
      
      // Show error toast instead of session error
      toast({
        variant: "destructive",
        title: "Tag Placement Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }, [selectedTagType, selectedUser, currentDocument, placeTag, placeTextInput, placeWhiteoutOverlay, textInputs, viewer.currentPage, setCurrentPageCanvas, tags, toast, setSelectedTagType]);

  // Handle user switching via hotkeys
  const handleUserSwitch = useCallback((userIndex: number) => {
    if (userIndex === 0) {
      // Backtick = notary
      const notary = participants.find(p => p.userType === 'notary');
      if (notary) {
        setSelectedUser(notary);
        console.log('🔄 Switched to notary:', notary.displayName);
      }
    } else if (userIndex <= participants.length) {
      // 1-9 = signers
      const signers = participants.filter(p => p.userType === 'signer');
      if (signers[userIndex - 1]) {
        setSelectedUser(signers[userIndex - 1]);
        console.log('🔄 Switched to signer:', signers[userIndex - 1].displayName);
      }
    }
  }, [participants, setSelectedUser]);

  // Handle tag type selection via hotkeys
  const handleTagTypeSelect = useCallback((tagType: TagType) => {
    // Clear any selected tag to prevent multi-selection visuals
    useEditorStore.getState().selectTag(null);
    // If switching to a non-text tool, ensure no text input remains selected
    if (tagType !== 'T') {
      try { selectTextInput(null); } catch {}
    }
    useEditorStore.getState().setSelectedTagType(tagType);
  }, [selectTextInput]);

  // Handle document switching
  const handleDocumentSwitch = useCallback((document: SessionDocument) => {
    setCurrentDocument(document);
  }, [setCurrentDocument]);

  // Handle session completion
  const handleSessionComplete = useCallback(async () => {
    try {
      console.log('📋 Session completion initiated...');
      
      // First, save any pending changes
      await batchSaveChanges();
      console.log('💾 Pending changes saved');
      
      // The actual completion is now handled by the TaggingToolbar
      // which calls the /api/editor/session/:sessionId/complete endpoint
      // When that succeeds, it will call onSessionComplete
      
      // Show success message or redirect
      if (onSessionComplete) {
        console.log('🎉 Calling parent completion handler');
        onSessionComplete();
      } else {
        // Default behavior: redirect to job details or dashboard
        console.log('🏠 No completion handler, redirecting to dashboard');
        window.location.href = '/dashboard';
      }
      
    } catch (error) {
      console.error('❌ Failed to complete session:', error);
      setError('Failed to save changes before completion. Please try again.');
    }
  }, [batchSaveChanges, onSessionComplete]);

  // Notify parent of tag changes
  useEffect(() => {
    if (onTagsChanged) {
      onTagsChanged(tags);
    }
  }, [tags, onTagsChanged]);

  // Handle loading and error states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tagging session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-xl mb-4 font-bold">!</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Session Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!currentDocument) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600">No document selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Simplified Header */}
      <div className="bg-white border-b px-4 py-3 shadow-sm">
        <div className="flex items-center justify-end">
          {/* Complete Button for Tagging Mode */}
          {mode === 'tagging' && (
              <button
                onClick={async () => {
                  if (!sessionId || isCompleting) return;
                  
                  setIsCompleting(true);
                  try {
                    const response = await fetch(`/api/editor/session/${sessionId}/complete`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                      },
                      body: JSON.stringify({ force: false })
                    });
                    
                    const result = await response.json();
                    
                    if (!response.ok) {
                      if (result.canForce) {
                        const forceComplete = window.confirm(result.message + '\n\nDo you want to complete anyway?');
                        if (forceComplete) {
                          const forceResponse = await fetch(`/api/editor/session/${sessionId}/complete`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${localStorage.getItem('token')}`
                            },
                            body: JSON.stringify({ force: true })
                          });
                          
                          if (forceResponse.ok) {
                            handleSessionComplete();
                          } else {
                            throw new Error('Failed to force complete session');
                          }
                        }
                      } else {
                        throw new Error(result.message || 'Failed to complete session');
                      }
                    } else {
                      handleSessionComplete();
                    }
                  } catch (error) {
                    console.error('❌ Failed to complete session:', error);
                    alert(error instanceof Error ? error.message : 'Failed to complete session');
                  } finally {
                    setIsCompleting(false);
                  }
                }}
                disabled={isCompleting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {isCompleting ? 'Completing...' : 'Complete Tagging'}
              </button>
          )}
        </div>
      </div>

      {/* Main content - Two column layout (no video) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center Column - PDF Viewer (expanded) */}
        <div className="flex-1 relative bg-white overflow-hidden min-w-0" ref={containerRef}>
          <PDFViewer
            documentUrl={currentDocument.fileUrl}
            sessionId={sessionId}
            onCoordinateClick={handleTagPlacement}
            onTagClick={mode === 'signing' ? handleTagClick : undefined}
            tags={tags.filter(tag => tag.documentId === currentDocument.id && tag.tagType !== 'T')}
            mode={mode === 'notary' ? 'tagging' : mode as 'tagging' | 'signing'}
            selectedUser={selectedUser}
            onTagUpdate={updateTagPosition}
            onTagResize={saveTagUpdate}
            onTagDelete={deleteTag}
            liveSessionState={liveSessionState}
            onSetActiveUser={onSetActiveUser}
            onPageLoad={handlePageLoad}
            textInputs={textInputs}
            selectedTextInputId={selectedTextInputId}
            onTextInputSelect={selectTextInput}
            onSaveTextContent={saveTextContent}
            onDeleteTextInput={deleteTextInput}
            onMoveTextInput={(textInputId, coordinates) => {
              console.log('📍 Text input moved:', textInputId, coordinates);
              moveTextInput(textInputId, coordinates);
            }}
            onFontSizeChange={updateFontSize}
            onSyncUsers={onSyncUsers}
            currentUser={currentUser}
            isSyncLoading={isSyncLoading}
            webSocket={webSocket}
            highlightedTagId={highlightedTagId || undefined}
            incompleteTags={incompleteTagsForCurrentDoc}
            onScrollToTag={() => {
              // Clear highlight shortly after scrolling completes to avoid lingering styles
              window.setTimeout(() => setHighlightedTagId(null), 1500);
            }}
          />

          {/* Floating Unfilled-Tag Navigator */}
          <IncompleteTagHUD
            tags={tags.filter(t => t.documentId === currentDocument.id)}
            participants={participants}
            currentUserId={currentUserId}
            onJumpToTag={(tagId) => {
              // delegate to exposed handler
              const target = useEditorStore.getState().tags.find(t => t.id.toString() === tagId.toString());
              if (!target) return;
              setHighlightedTagId(tagId);
              setCurrentPage(target.coordinates.pageNumber);
            }}
            className="pointer-events-auto"
          />
        </div>

        {/* Right Column - Simplified Controls */}
        <div className="w-72 bg-white border-l border-gray-200">
          <div className="h-full flex flex-col">

            
            {/* Tagging Toolbar */}
            <div className="flex-1">
              <TaggingToolbar
                participants={participants}
                sessionId={sessionId}
                mode={mode}
                onDocumentSwitch={handleDocumentChange}
                onSessionComplete={handleSessionComplete}
                liveSessionState={liveSessionState}
                onSetActiveUser={onSetActiveUser}
                canControlSession={mode === 'signing' && (currentUser?.userType === 'notary' || currentUser?.role === 'admin')}
                className="h-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Tag Input Modal */}
      {selectedTagForInput && tagModalPosition ? (
        (() => {
          console.log('🎭 Rendering TagInputModal:', {
            tagId: selectedTagForInput.id,
            tagType: selectedTagForInput.tagType,
            hasPosition: !!tagModalPosition,
            position: tagModalPosition,
            targetUserId: selectedTagForInput.assignedUserId || currentUserId,
            hasUserProfile: !!userProfiles[selectedTagForInput.assignedUserId || currentUserId]
          });
          
          return (
            <TagInputModal
              tag={selectedTagForInput}
              isOpen={true}
              onClose={() => {
                console.log('❌ TagInputModal closed');
                setSelectedTagForInput(null);
                setTagModalPosition(null);
              }}
              onSave={handleTagContentSave}
              userProfile={userProfiles[selectedTagForInput.assignedUserId || currentUserId]}
              currentUserId={currentUserId}
              position={tagModalPosition}
            />
          );
        })()
      ) : (
        (() => {
          if (selectedTagForInput) {
            console.log('⚠️ Modal NOT rendered - missing position:', { hasTag: true, hasPosition: !!tagModalPosition });
          }
          return null;
        })()
      )}

      {/* Seal Configuration Dialog */}
      <SealConfigDialog
        isOpen={showSealDialog}
        onClose={handleSealDialogClose}
        onConfirm={handleSealConfig}
        participants={participants.map(p => ({
          userId: parseInt(p.userId.toString()),
          displayName: p.displayName,
          userType: p.userType,
          isActive: true, // You might want to get this from live session state
          canInteract: true
        }))}
        isLoading={sealDialogLoading}
      />

      {/* Keyboard shortcuts handler */}
      <HotkeyHandler
        onUserSwitch={handleUserSwitch}
        onTagTypeSelect={handleTagTypeSelect}
        enabled={mode === 'tagging' || mode === 'signing'}
      />
    </div>
  );
});