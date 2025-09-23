import React, { useCallback, useEffect, useState, useRef, useMemo, useImperativeHandle } from 'react';
import { PDFViewer } from './PDFViewer';
import { TaggingToolbar } from './TaggingToolbar';
import { useLocation } from 'wouter';
import { Home } from 'lucide-react';

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
import { authApi } from '@/lib/auth';
import { useIsMobile } from '@/hooks/use-mobile';

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
  
  // 🔍 DEBUG: Log session ID to identify incorrect usage
  useEffect(() => {
    console.log('🔍 PDFTaggingEditor initialized with sessionId:', sessionId);
    if (/^\d+$/.test(sessionId)) {
      console.error('❌ PDFTaggingEditor received job ID instead of session ID!', sessionId);
      console.trace('❌ Component instantiation stack trace');
    }
  }, [sessionId]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  
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
  // Cache of signer signature choices within this session: userId -> content object
  const signatureChoiceRef = useRef<Map<string, { type: 'signature'; value: string }>>(new Map());
  
  const { toast } = useToast();
  const [, setLocation] = useLocation();

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
    setCurrentPage,
    updateTag
  } = useEditorStore();
 
  const canSeeRightPanel = useMemo(() => {
    const authUser = authApi.getStoredUser();
    const authIsAdmin = !!(authUser?.role === 'admin' || authUser?.isAdmin || authUser?.privileges?.includes?.('admin'));
    const authIsNotary = !!(authUser?.role === 'notary' || authUser?.isNotary);
    return (
      currentUser?.userType === 'notary' ||
      currentUser?.role === 'notary' ||
      currentUser?.role === 'admin' ||
      authIsAdmin ||
      authIsNotary
    );
  }, [currentUser]);

  // Only render text inputs that belong to the current document
  const currentDocTextInputs = useMemo(() => {
    if (!currentDocument) return [] as typeof textInputs;
    const currentId = currentDocument.id?.toString();
    return (textInputs || []).filter((ti: any) => {
      const docId = ti.documentId != null ? ti.documentId.toString() : undefined;
      return docId === currentId;
    });
  }, [textInputs, currentDocument?.id]);

  // Track previous text tag IDs to avoid unnecessary reloads
  const prevTextTagIdsRef = useRef<string>('');
  
  // Keep streamlined text inputs in sync with tag list for the current document
  // Only reload when text tags are added/removed, not on every tag update
  useEffect(() => {
    try {
      if (!currentDocument) return;
      const currentDocTextTags = tags.filter(t => 
        t.documentId === currentDocument.id && t.tagType === 'T'
      );
      
      // Create a stable key based on text tag IDs to avoid unnecessary reloads
      const textTagIds = currentDocTextTags.map(t => t.id).sort().join(',');
      
      // Only reload if text tag IDs have changed (tags added/removed)
      if (prevTextTagIdsRef.current !== textTagIds) {
        console.log('📝 Text tag IDs changed, reloading text inputs:', {
          prev: prevTextTagIdsRef.current || '(empty)',
          current: textTagIds || '(empty)',
          tagCount: currentDocTextTags.length
        });
        prevTextTagIdsRef.current = textTagIds;
        loadTextInputsFromTags(currentDocTextTags);
      }
    } catch (e) {
      // No-op: defensive guard
    }
  }, [tags, currentDocument?.id, loadTextInputsFromTags]);

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
        console.log('🎯 jumpToTag called with tagId:', tagId);
        const targetTag = useEditorStore.getState().tags.find(t => t.id.toString() === tagId.toString());
        if (!targetTag) {
          console.warn('🚫 jumpToTag: tag not found', tagId, 'Available tags:', useEditorStore.getState().tags.map(t => t.id));
          return;
        }

        console.log('🎯 Found target tag:', { 
          id: targetTag.id, 
          documentId: targetTag.documentId, 
          pageNumber: targetTag.coordinates.pageNumber,
          currentDoc: currentDocument?.id 
        });

        // Switch document if needed
        if (!currentDocument || currentDocument.id !== targetTag.documentId) {
          const targetDoc = documents.find(d => d.id === targetTag.documentId);
          if (targetDoc) {
            console.log('🔄 Switching to document:', targetDoc.id);
            await (async () => {
              await handleDocumentChange(targetDoc);
            })();
          }
        }

        // Set page and highlight
        console.log('📄 Setting page to:', targetTag.coordinates.pageNumber, 'and highlighting tag:', targetTag.id);
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

  // Clear text input selection when tag selection changes
  useEffect(() => {    
    // Only clear text input if selecting a non-text tag
    if (selectedTag && selectedTag.tagType !== 'T' && selectedTextInputId) {
      selectTextInput(null);
    }
  }, [selectedTag?.id, selectedTag?.tagType]);

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
        console.log(`🚀 [PDFTaggingEditor] Initializing session ${sessionId} with mode ${mode}`);
        setIsLoading(true);
        setError(null);

        // Set basic session data
        setSession({
          id: sessionId,
          jobId: '',
          notaryId: '',
          status: 'active',
          sessionType: mode as 'tagging' | 'notary' | 'signing',
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
          // If current user is a notary/admin, preselect the first signer (common workflow)
          const isStaff = currentParticipant.userType === 'notary' || currentParticipant.role === 'notary' || currentParticipant.role === 'admin';
          if (isStaff) {
            const firstSigner = participants.find(p => p.userType === 'signer') || participants.find(p => p.userType === 'witness');
            setSelectedUser(firstSigner || currentParticipant);
          } else {
            setSelectedUser(currentParticipant);
          }
        } else {
          const authUser = authApi.getStoredUser();
          if (authUser) {
            const defaultTarget = participants.find(p => p.userType === 'signer')
              || participants.find(p => p.userType === 'witness')
              || participants[0];
            if (defaultTarget) {
              setSelectedUser(defaultTarget);
            }
          }
        }

        // Set mode configuration - PROPER SIGNER RESTRICTIONS
        const authUser = authApi.getStoredUser();
        const authRole = authUser?.role || '';
        const authPrivileges = authUser?.privileges || [];
        const isAdminFromAuth = authRole === 'admin' || authPrivileges.includes('admin');
        const isNotaryFromAuth = authRole === 'notary' || !!authUser?.isNotary;
        const isNotary = currentParticipant?.userType === 'notary' || currentParticipant?.role === 'notary' || isNotaryFromAuth;
        const isAdmin = currentParticipant?.role === 'admin' || isAdminFromAuth;
        
        const canPlaceTags = mode === 'tagging' || mode === 'signing' || mode === 'notary';
        
        console.log('🔧 Setting editor mode:', {
          mode,
          currentUserId,
          currentParticipant,
          isNotary,
          isAdmin,
          canPlaceTags,
          userType: currentParticipant?.userType,
          role: currentParticipant?.role,
          authRole,
          authPrivileges
        });
        
        setMode({
          mode: mode as 'tagging' | 'notary' | 'signing',
          canPlaceTags, // ❌ SIGNERS CANNOT PLACE NEW TAGS
          canModifyContent: mode === 'notary' || mode === 'signing',
          showPlaceholders: mode === 'tagging' || mode === 'signing'
        });

        // Load existing tags for all documents in session
        console.log(`🔍 [PDFTaggingEditor] Loading existing tags for session: ${sessionId}`);
        const response = await fetch(`/api/editor/session/${sessionId}/tags?t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });

        if (response.ok) {
          const { tags: existingTags } = await response.json();
          console.log(`✅ [PDFTaggingEditor] Loaded ${existingTags.length} existing tags:`, existingTags);
          
          // Filter out any temporary tags that might have persisted
          const validTags = existingTags.filter((tag: any) => {
            if (tag.id && tag.id.toString().startsWith('temp_')) {
              console.warn('Filtering out temporary tag:', tag.id);
              return false;
            }
            return true;
          });
          
          console.log(`🏷️ [PDFTaggingEditor] Setting ${validTags.length} valid tags in store`);
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
            
            // CRITICAL FIX: For signing mode with no tags, force a reload to ensure server copies tags
            if (mode === 'signing') {
              console.log(`⚠️ No tags in signing mode - forcing reload to ensure tags are copied from tagging session`);
              // Wait a moment for server to process tag copying
              setTimeout(async () => {
                const retryResponse = await fetch(`/api/editor/session/${sessionId}/tags?t=${Date.now()}`, {
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Cache-Control': 'no-cache'
                  }
                });
                
                if (retryResponse.ok) {
                  const { tags: retryTags } = await retryResponse.json();
                  if (retryTags.length > 0) {
                    console.log(`✅ Retry successful - loaded ${retryTags.length} tags after server processing`);
                    const validRetryTags = retryTags.filter((tag: any) => 
                      !tag.id?.toString().startsWith('temp_')
                    );
                    setTags(validRetryTags);
                    const retryDocTags = validRetryTags.filter((tag: any) => 
                      tag.documentId === documents[0]?.id
                    );
                    loadTextInputsFromTags(retryDocTags);
                  }
                }
              }, 1000);
            }
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
          setZoomLevel(isMobile ? 1.0 : 2.1); // Fit for mobile signers; larger for desktop
          console.log('🔍 Set initial zoom level for signing mode', { isMobile, zoom: isMobile ? 1.0 : 2.1 });
        } else if (mode === 'tagging' || mode === 'notary') {
          setZoomLevel(2.25); // 225% zoom for tagging mode
          console.log('🔍 Set initial zoom level to 225% for tagging mode');
        }
        setHasSetInitialZoom(true);
      }, 200); // Small delay to ensure PDF container is ready
      
      return () => clearTimeout(timer);
    }
  }, [mode, setZoomLevel, hasSetInitialZoom, isMobile]);

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
          content: '',
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
      
      // Update local state for this tag only (atomic)
      updateTag(tag.id, { isCompleted: true, content: '', contentType: 'whiteout', contentData: result?.contentStructure || tag.contentData });

      console.log('✅ Tag instantly completed:', tag.id);
      
    } catch (error) {
      console.error('❌ Failed to instantly complete tag:', error);
      toast({
        title: "Whiteout Failed",
        description: error instanceof Error ? error.message : 'Failed to apply whiteout',
        variant: "destructive"
      });
    }
  }, [sessionId, toast, tags, setTags, currentUserId, updateTag]);

  // Auto-fill disabled in signing mode
  const handleAutoFillTag = useCallback(async (tag: DocumentTag): Promise<boolean> => {
    try {
      // Attempt to get default content from server (derived from user profile)
      const response = await fetch(`/api/editor/session/${sessionId}/tag/${tag.id}/default-content`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      let contentValue: string | undefined;
      if (response.ok) {
        const data = await response.json();
        contentValue = (data?.content ?? '').toString();
      }

      // Build a content payload object suitable for handleTagContentSave
      const buildContentObject = (valueFromServer?: string) => {
        const value = (valueFromServer ?? '').toString();
        switch (tag.tagType) {
          case 'S':
            return { type: 'signature', value } as any;
          case 'I':
            return { type: 'initials', value } as any;
          case 'A':
            return { type: 'name', value } as any;
          case 'N':
            return { type: 'commission_number', value } as any;
          case 'X':
            return { type: 'commission_expiration', value } as any;
          case 'D': {
            const today = new Date().toLocaleDateString();
            return { type: 'current_date', value: value || today } as any;
          }
          case 'O':
            return { type: 'notary_disclosure', value } as any;
          default:
            return value || '';
        }
      };

      let contentObject = buildContentObject(contentValue);

      // If server didn't provide a value, fall back to loaded user profile data
      const needsFallback = (typeof contentObject === 'object' && !contentObject.value) || (typeof contentObject === 'string' && contentObject.trim() === '');
      if (needsFallback) {
        const profile = userProfiles[tag.assignedUserId || currentUserId];
        if (profile) {
          let fallback = '' as string;
          switch (tag.tagType) {
            case 'S':
              fallback = profile.signatures?.[0] || profile.signatureImage || profile.signatureData || profile.signatureTyped || '';
              contentObject = { type: 'signature', value: fallback, contentType: (typeof fallback === 'string' && (fallback.startsWith('data:image/') || fallback.startsWith('http'))) ? 'image' : 'text' } as any;
              break;
            case 'I':
              fallback = profile.initials?.[0] || profile.initialsImage || profile.initialData || '';
              if (!fallback && profile.name) {
                const parts = profile.name.trim().split(' ');
                if (parts.length >= 2) fallback = `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`;
              }
              contentObject = { type: 'initials', value: fallback, contentType: (typeof fallback === 'string' && (fallback.startsWith('data:image/') || fallback.startsWith('http'))) ? 'image' : 'text' } as any;
              break;
            case 'A':
              fallback = profile.name || '';
              contentObject = { type: 'name', value: fallback } as any;
              break;
            case 'N':
              fallback = profile.commissionNumber || '';
              contentObject = { type: 'commission_number', value: fallback } as any;
              break;
            case 'X':
              fallback = profile.commissionExpiration || '';
              contentObject = { type: 'commission_expiration', value: fallback } as any;
              break;
            case 'D':
              fallback = new Date().toLocaleDateString();
              contentObject = { type: 'current_date', value: fallback } as any;
              break;
            case 'O':
              fallback = profile.disclosure || '';
              contentObject = { type: 'notary_disclosure', value: fallback } as any;
              break;
          }
        }
      }

      const hasValue = typeof contentObject === 'object' ? !!contentObject.value : (contentObject || '').toString().trim().length > 0;
      if (hasValue) {
        // Save directly without opening any modal
        const saveResponse = await fetch(`/api/editor/session/${sessionId}/tag/${tag.id}/content`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            content: contentObject,
            completedBy: currentUserId,
            completedAt: new Date().toISOString()
          })
        });
        if (!saveResponse.ok) {
          const errData = await saveResponse.json().catch(() => ({}));
          throw new Error(errData.message || 'Failed to save auto-filled content');
        }
        const result = await saveResponse.json().catch(() => ({}));
        // Atomic update for just this tag to prevent stale overwrite of others
        updateTag(tag.id, {
          isCompleted: true,
          contentData: (typeof contentObject === 'object' ? contentObject : undefined),
          content: (typeof contentObject === 'object' ? (contentObject as any).value || '' : (contentObject || '')),
          contentType: result?.tag?.contentType || (typeof contentObject === 'object' ? (contentObject as any).contentType : undefined)
        });
        toast({ title: 'Filled', description: 'Field auto-filled from profile.' });
        return true;
      }

      // No data to auto-fill
      return false;
    } catch (err) {
      console.error('❌ Auto-fill failed:', err);
      // Surface failure to caller so it can decide to open manual modal
      return false;
    }
  }, [sessionId, currentUserId, userProfiles, toast, tags, setTags, updateTag]);

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
        
      // Update local state with the configured seal (atomic)
      updateTag(tagToUse.id, { 
        isCompleted: true, 
        contentData: result.sealData?.contentData,
        content: result.sealData?.content
      });
      
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
  }, [sessionId, selectedSealTag, tags, setTags, toast, updateTag]);

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

    // NEW: Determine the assigned participant to enforce stricter rules for signer signatures
    const assignedParticipant = participants.find(p => p.userId === tag.assignedUserId);
    const isAssignedToSignerOrWitness = assignedParticipant?.userType === 'signer' || assignedParticipant?.userType === 'witness';

    // Block notaries (or any non-assigned user) from interacting with signer-assigned signature tags
    if (tag.tagType === 'S' && isAssignedToSignerOrWitness && !isAssignedUser) {
      toast({
        title: "Cannot Edit Signature",
        description: "Only the assigned signer can complete this signature.",
        variant: "destructive"
      });
      return;
    }
    
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
    
    // Auto-complete date tags: 'D' always today; 'X' only if profile has a real expiration
    if (!tag.isCompleted) {
      try {
        if (tag.tagType === 'D') {
          const todayStr = new Date().toLocaleDateString();
          const content = { type: 'date', value: todayStr, isRequired: true } as any;
          await handleTagContentSave(content, tag.id);
          return;
        }
        if (tag.tagType === 'X') {
          const profile = userProfiles[tag.assignedUserId || currentUserId];
          if (profile?.commissionExpiration) {
            let expValue: string;
            const rawVal: any = profile.commissionExpiration;
            if (rawVal instanceof Date) {
              expValue = rawVal.toLocaleDateString();
            } else {
              const d = new Date(rawVal);
              expValue = isNaN(d.getTime()) ? String(rawVal) : d.toLocaleDateString();
            }
            const content = { type: 'date', value: expValue, isRequired: true } as any;
            await handleTagContentSave(content, tag.id);
            return;
          }
        }
      } catch (e) {
        console.warn('⚠️ Auto-complete date failed, continuing to default routing', e);
      }
    }
    
    // Route by tag type (auto-fill enabled)
    // Check who the tag is assigned to (not who is clicking it)
    const isTagAssignedToNotary = assignedParticipant?.userType === 'notary';
    
    // Auto-fill from profile for these tags on click (no popups)
    const autoFillTags: TagType[] = ['A', 'I', 'N', 'X', 'D', 'O', 'S'];
    
    console.log('🎯 Tag interaction routing:', {
      tagType: tag.tagType,
      assignedUserId: tag.assignedUserId,
      assignedParticipant: assignedParticipant?.displayName,
      isTagAssignedToNotary,
      currentUserIsNotary: isNotary,
      autoFillTags,
    });
    const sealTags = ['E']; // Seal tags that open configuration dialog
    const inlineEditTags = ['T']; // Inline text editing
    const instantTags = ['W']; // Tags that work instantly without user interaction (whiteout)
    
    if (instantTags.includes(tag.tagType)) {
      // ⚡ INSTANT: Complete whiteout tags immediately without user interaction
      console.log('⚡ Instant completion for tag:', tag.tagType);
      await handleInstantTagCompletion(tag);
    } else if (isTagAssignedToNotary && tag.tagType === 'S') {
      // 🔐 NOTARY SIGNATURE: never prompt, always fetch/apply from notary profile
      console.log('🔐 Applying notary signature automatically');
      try {
        const response = await fetch(`/api/editor/session/${sessionId}/tag/${tag.id}/content`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          // Ask server to derive default content from notary profile for signature
          body: JSON.stringify({ content: { type: 'signature', value: '' }, completedBy: currentUserId, completedAt: new Date().toISOString() })
        });
        if (!response.ok) throw new Error('Failed to apply notary signature');
        const result = await response.json();
        updateTag(tag.id, {
          isCompleted: true,
          content: result?.tag?.content || tag.content,
          contentType: 'image',
          contentData: result?.tag?.contentData || tag.contentData
        });
        toast({ title: 'Notary Signature Applied', description: 'Applied from notary profile.' });
      } catch (e) {
        console.error('Notary signature auto-apply failed:', e);
        toast({ variant: 'destructive', title: 'Could not apply notary signature', description: e instanceof Error ? e.message : 'Unknown error' });
      }
    } else if (autoFillTags.includes(tag.tagType as TagType) && !tag.isCompleted) {
      // 🚀 AUTO-FILL first; if nothing to fill, handle per tag without generic modal
      const filled = await handleAutoFillTag(tag);
      if (!filled) {
        if (tag.tagType === 'S') {
          // Signature only: open modal to select signature
          setSelectedTagForInput(tag);
          setTagModalPosition(position);
        } else {
          // No TagInputModal for other tags (A, I, N, O, X)
          switch (tag.tagType) {
            case 'X':
              toast({
                title: 'Commission Expiration Required',
                description: 'Add your commission expiration date in your profile to auto-fill this field.',
                variant: 'destructive'
              });
              break;
            case 'A':
              toast({
                title: 'Name Required',
                description: 'Your profile is missing your full name. Update your profile to auto-fill.',
                variant: 'destructive'
              });
              break;
            case 'I':
              toast({
                title: 'Initials Required',
                description: 'Add initials to your profile to auto-fill this field.',
                variant: 'destructive'
              });
              break;
            case 'N':
              toast({
                title: 'Commission Number Required',
                description: 'Add your commission number in your profile to auto-fill.',
                variant: 'destructive'
              });
              break;
            case 'O':
              toast({
                title: 'Disclosure Missing',
                description: 'Provide your disclosure statement in your profile to auto-fill this field.',
                variant: 'destructive'
              });
              break;
            default:
              toast({
                title: 'Profile Info Required',
                description: 'This tag requires profile information. Please update your profile.',
                variant: 'destructive'
              });
          }
        }
      }
    } else if (sealTags.includes(tag.tagType)) {
      // 🔖 SEAL DIALOG: Open seal configuration dialog
      console.log('🔖 Opening seal configuration dialog for tag:', tag.tagType, 'ID:', tag.id);
      setSelectedSealTag(tag);
      setShowSealDialog(true);
    } else if (inlineEditTags.includes(tag.tagType)) {
      // ✏️ INLINE EDIT: Start inline text editing for text tags
      console.log('✏️ Starting inline text editing for tag:', tag.tagType);
      
      // Find the text input with matching tag ID and trigger editing directly
      const matchingTextInput = textInputs.find(input => input.id === tag.id.toString());
      if (matchingTextInput) {
        // Select the text input first
        selectTextInput(matchingTextInput.id);
        
        setTimeout(() => {
          console.log('🎯 Directly triggering text input editing for:', matchingTextInput.id);
          const textElement = document.querySelector(`[data-text-input-id="${matchingTextInput.id}"]`);
          if (textElement) {
            const inputElement = textElement.querySelector('input');
            if (inputElement) {
              (inputElement as HTMLInputElement).focus();
              (inputElement as HTMLInputElement).click();
            } else {
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
      // No other path; do nothing
      console.log('ℹ️ No auto-fill or inline edit path for tag type:', tag.tagType);
    }
  }, [mode, participants, currentUserId, liveSessionState, toast, userProfiles, textInputs, selectTextInput, updateTag]);

  // Handle tag content save
  const handleTagContentSave = useCallback(async (content: any, targetTagId?: string) => {
    const effectiveTagId = targetTagId || selectedTagForInput?.id;
    if (!effectiveTagId) return;

    try {
      const response = await fetch(`/api/editor/session/${sessionId}/tag/${effectiveTagId}/content`, {
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

      // Update local state atomically for this tag
      const normalizeContentValue = (val: unknown): string => {
        if (val == null) return '';
        if (val instanceof Date) return val.toLocaleDateString();
        if (typeof val === 'string') return val;
        if (typeof val === 'number' || typeof val === 'boolean') return String(val);
        try { return String(val); } catch { return ''; }
      };

      const computedContent = (typeof content === 'object' && content)
        ? normalizeContentValue((content as any).value)
        : normalizeContentValue(content);

      const computedContentType = (typeof content === 'object' && (content as any).contentType) || (typeof content === 'string' && (content.startsWith('data:image/') || content.startsWith('http') ? 'image' : 'text')) || undefined;
      updateTag(effectiveTagId, {
        isCompleted: true,
        contentData: content,
        content: computedContent,
        contentType: computedContentType
      });

      // Cache signer signature choice so subsequent signature tags auto-apply without modal
      try {
        const targetTag = useEditorStore.getState().tags.find(t => t.id === effectiveTagId);
        if (targetTag && targetTag.tagType === 'S' && content && typeof content === 'object' && content.type === 'signature' && typeof content.value === 'string') {
          const userKey = (targetTag.assignedUserId || currentUserId || '').toString();
          signatureChoiceRef.current.set(userKey, { type: 'signature', value: content.value });
          console.log('🗂️ Cached signature for user', userKey);
        }
      } catch {}

      // Auto-resize tag based on new content for text-like tags only
      const contentValue = typeof content === 'string' ? content : (content?.value || '');
      const contentType = typeof content === 'object' && content ? (content as any).contentType : undefined;
      const isImageContent = contentType === 'image' || (typeof contentValue === 'string' && (contentValue.startsWith('data:image/') || contentValue.startsWith('http')));

      if (!isImageContent && typeof contentValue === 'string' && contentValue.trim().length > 0) {
        const { calculateOptimalWidth } = await import('@/lib/constants/tagConstants');
        const optimalWidth = calculateOptimalWidth(contentValue, 12, 'Arial');
        const optimalHeight = 25;
        const currentTag = tags.find(tag => tag.id === effectiveTagId);
        if (currentTag) {
          const currentWidth = currentTag.coordinates.width || 100;
          const currentHeight = currentTag.coordinates.height || 25;
          const newWidth = Math.max(currentWidth, optimalWidth);
          const newHeight = Math.max(currentHeight, optimalHeight);
          if (newWidth !== currentWidth || newHeight !== currentHeight) {
            const updateResponse = await fetch(`/api/editor/session/${sessionId}/tag/${effectiveTagId}/coordinates`, {
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
              console.log('✅ Tag auto-resized based on text content:', {
                tagId: effectiveTagId,
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

      if (!targetTagId) {
        setSelectedTagForInput(null);
        setTagModalPosition(null);
      }

    } catch (error) {
      console.error('Failed to save tag content:', error);
      toast({ title: 'Save Failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  }, [sessionId, currentUserId, selectedTagForInput?.id, updateTag, tags, toast]);

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
    
    // Determine target user; auto-select a signer if staff can place and none selected
    const targetUser = selectedUser || (
      useEditorStore.getState().mode.canPlaceTags
        ? (participants.find(p => p.userType === 'signer') || participants.find(p => p.userType === 'witness') || participants[0])
        : null
    );
    if (!selectedUser && targetUser) {
      setSelectedUser(targetUser);
    }

    if (!selectedTagType || !targetUser || !currentDocument) {
      console.error('❌ Missing required data for tag placement:', {
        selectedTagType,
        selectedUser: !!targetUser,
        currentDocument: !!currentDocument,
        selectedUserDetails: targetUser,
        currentDocumentDetails: currentDocument
      });
      return;
    }

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
    
    try {
      // Check if this is a text tag - use streamlined text input system
      if (selectedTagType === 'T') {
        console.log('📝 Placing streamlined text input...');
        console.log('Current text inputs before placement:', textInputs);
        
        // Use professional fixed dimensions for text tags
        const store = useEditorStore.getState();
        const dimensions = store.getTagDimensions('T') || { width: 60, height: 18 };
        
        // Use the fixed dimensions instead of coordinates from click
        const textInputCoordinates = {
          ...coordinates,
          width: dimensions?.width || 120,  // Use updated constant dimensions for text tags
          height: dimensions?.height || 25   // Use updated constant dimensions for text tags
        };
        
        // Set flag to suppress global click handler for the next click
        setJustPlacedTextInput(true);
        
        // Safety timeout to reset flag in case the click handler is never triggered
        setTimeout(() => {
          setJustPlacedTextInput(false);
        }, 2000);
        
        await placeTextInput({
          documentId: currentDocument.id,
          coordinates: textInputCoordinates,
          assignedUserId: parseInt(targetUser.userId.toString())
        }, targetUser.colorCode || '#4ECDC4');
        
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
          width: whiteoutDimensions?.width || 80,
          height: whiteoutDimensions?.height || 30
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
          assignedUserId: targetUser.userId
        });
        
        console.log('🔍 DEBUG: Store state before placement:', {
          tagsCount: tags.length,
          tags: tags.map(t => ({ id: t.id, type: t.tagType }))
        });
        
        // Use professional fixed dimensions for all tag types
        console.log('🔍 About to get dimensions for tagType:', selectedTagType, 'type:', typeof selectedTagType);
        const store = useEditorStore.getState();
        const tagDimensions = store.getTagDimensions(selectedTagType) || { width: 60, height: 18 };
        console.log('🔍 Retrieved tagDimensions:', tagDimensions);
        
        const professionalCoordinates = {
          ...coordinates,
          width: tagDimensions?.width || 60,
          height: tagDimensions?.height || 18
        };
        
        console.log('🔍 Final professionalCoordinates:', professionalCoordinates);
        
        // Special debugging for disclosure tags
        if (selectedTagType === 'O') {
          console.log('📋 DISCLOSURE TAG - About to call placeTag with:', {
            documentId: currentDocument.id,
            tagType: selectedTagType,
            coordinates: professionalCoordinates,
            assignedUserId: targetUser.userId
          });
        }
        
        await placeTag({
          documentId: currentDocument.id,
          tagType: selectedTagType,
          coordinates: professionalCoordinates,
          assignedUserId: targetUser.userId
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
            mode={mode === 'signing' ? 'signing' : 'tagging'}
            selectedUser={selectedUser}
            onTagUpdate={updateTagPosition}
            onTagResize={saveTagUpdate}
            onTagDelete={deleteTag}
            liveSessionState={liveSessionState}
            onSetActiveUser={onSetActiveUser}
            onPageLoad={handlePageLoad}
            textInputs={currentDocTextInputs}
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
              window.setTimeout(() => setHighlightedTagId(null), 400);
            }}
          />

          {/* Floating Unfilled-Tag Navigator */}
          <IncompleteTagHUD
            tags={tags.filter(t => t.documentId === currentDocument.id)}
            participants={participants}
            currentUserId={currentUserId}
            onJumpToTag={async (tagId) => {
              // Call the actual jumpToTag function from useImperativeHandle
              try {
                console.log('🎯 HUD calling jumpToTag for:', tagId);
                const targetTag = useEditorStore.getState().tags.find(t => t.id.toString() === tagId.toString());
                if (!targetTag) {
                  console.warn('🚫 HUD jumpToTag: tag not found', tagId);
                  return;
                }

                // Switch document if needed
                if (!currentDocument || currentDocument.id !== targetTag.documentId) {
                  const targetDoc = documents.find(d => d.id === targetTag.documentId);
                  if (targetDoc) {
                    console.log('🔄 HUD switching to document:', targetDoc.id);
                    await handleDocumentChange(targetDoc);
                  }
                }

                // Set page and highlight
                console.log('📄 HUD setting page to:', targetTag.coordinates.pageNumber, 'and highlighting tag:', targetTag.id);
                setCurrentPage(targetTag.coordinates.pageNumber);
                setHighlightedTagId(targetTag.id);
                // Clear highlight after a short delay
                window.setTimeout(() => setHighlightedTagId(null), 2000);
              } catch (e) {
                console.error('HUD jumpToTag failed', e);
              }
            }}
            className="pointer-events-auto"
          />
        </div>

        {/* Right Column - Simplified Controls (hidden for signers at all sizes) */}
        {!(mode === 'signing' && !canSeeRightPanel) && (
          <div className="w-48 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col min-h-0">
            <div className="h-full min-h-0 flex flex-col">
              {/* Tagging Toolbar */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <TaggingToolbar
                  participants={participants}
                  sessionId={sessionId}
                  mode={mode}
                  onDocumentSwitch={handleDocumentChange}
                  onSessionComplete={handleSessionComplete}
                  liveSessionState={liveSessionState}
                  onSetActiveUser={onSetActiveUser}
                  canControlSession={(() => {
                    const authUser = authApi.getStoredUser();
                    const authIsAdmin = !!(authUser?.role === 'admin' || authUser?.isAdmin || authUser?.privileges?.includes?.('admin'));
                    const authIsNotary = !!(authUser?.role === 'notary' || authUser?.isNotary);
                    return mode === 'signing' && (
                      currentUser?.userType === 'notary' ||
                      currentUser?.role === 'admin' ||
                      authIsAdmin ||
                      authIsNotary
                    );
                  })()}
                  isLoading={isSyncLoading}
                  className="h-full"
                />
              </div>
            </div>
          </div>
        )}
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
        enabled={(mode === 'tagging') || (mode === 'signing' && currentUser?.userType !== 'signer')}
      />
    </div>
  );
});