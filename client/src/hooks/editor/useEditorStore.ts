import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getTagDimensions as getDefaultTagDimensions } from '../../lib/constants/tagConstants';
import type {
  EditorSession,
  SessionDocument,
  SessionParticipant,
  DocumentTag,
  TagType,
  UserCursor,
  PDFViewerState,
  EditorMode,
  PlaceTagCommand,
  TagUpdate
} from '../../types/editor';

interface EditorStore {
  // Session state
  session: EditorSession | null;
  documents: SessionDocument[];
  currentDocument: SessionDocument | null;
  mode: EditorMode;
  
  // Participant management
  participants: SessionParticipant[];
  currentUser: SessionParticipant | null;
  selectedUser: SessionParticipant | null;
  
  // Tag management
  tags: DocumentTag[];
  selectedTag: DocumentTag | null;
  selectedTagType: TagType | null;
  draggedTag: DocumentTag | null;
  
  // Whiteout overlays (separate from tags)
  whiteoutOverlays: Array<{
    id: string;
    documentId: string;
    coordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
      pageNumber: number;
    };
    sessionId: string;
    createdAt: Date;
  }>;
  
  // Custom tag dimensions (remembers resized dimensions per tag type)
  customTagDimensions: Partial<Record<TagType, { width: number; height: number }>>;
  
  // Last used font size for new text tags (individual sizing)
  lastUsedFontSize: number;
  
  // PDF viewer state
  viewer: PDFViewerState;
  
  // UI state
  showGrid: boolean;
  snapToGrid: boolean;
  toolbarVisible: boolean;
  sidebarCollapsed: boolean;
  
  // Collaboration state
  cursors: UserCursor[];
  syncEnabled: boolean;
  lastSyncTime: Date | null;
  isConnected: boolean;
  webSocket: any | null; // WebSocket instance for real-time collaboration
  
  // Actions - Session Management
  setSession: (session: EditorSession | null) => void;
  setDocuments: (documents: SessionDocument[]) => void;
  setCurrentDocument: (document: SessionDocument | null) => void;
  switchToDocument: (document: SessionDocument) => void;
  setMode: (mode: EditorMode) => void;
  
  // Actions - User Management
  setParticipants: (participants: SessionParticipant[]) => void;
  setCurrentUser: (user: SessionParticipant | null) => void;
  setSelectedUser: (user: SessionParticipant | null) => void;
  switchUser: (userId: string) => void;
  
  // Actions - Tag Management
  setTags: (tags: DocumentTag[]) => void;
  addTag: (tag: DocumentTag) => void;
  updateTag: (tagId: string, updates: Partial<DocumentTag>) => void;
  deleteTag: (tagId: string) => void;
  selectTag: (tag: DocumentTag | null) => void;
  setSelectedTagType: (tagType: TagType | null) => void;
  setDraggedTag: (tag: DocumentTag | null) => void;
  
  // Document-specific tag management
  getCurrentDocumentTags: () => DocumentTag[];
  getDocumentTags: (documentId: string) => DocumentTag[];
  loadTagsForDocument: (documentId: string) => Promise<void>;
  loadWhiteoutOverlays: (documentId: string) => Promise<void>;
  
  // Actions - Whiteout Overlay Management
  setWhiteoutOverlays: (overlays: Array<any>) => void;
  addWhiteoutOverlay: (overlay: any) => void;
  updateWhiteoutOverlay: (overlayId: string, updates: Partial<any>) => void;
  deleteWhiteoutOverlay: (overlayId: string) => void;
  
  // Actions - Custom Dimensions
  setCustomTagDimensions: (tagType: TagType, dimensions: { width: number; height: number }) => void;
  getTagDimensions: (tagType: TagType) => { width: number; height: number } | null;
  clearCustomTagDimensions: () => void;
  
  // Actions - Last Used Font Size
  setLastUsedFontSize: (fontSize: number) => void;
  getLastUsedFontSize: () => number;
  
  // Actions - PDF Viewer
  setCurrentPage: (page: number) => void;
  setZoomLevel: (zoom: number) => void;
  setScrollTop: (scrollTop: number) => void;
  syncToPage: (page: number) => void;
  
  // Actions - UI Controls
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  toggleToolbar: () => void;
  toggleSidebar: () => void;
  
  // Actions - Collaboration
  setCursors: (cursors: UserCursor[]) => void;
  updateCursor: (cursor: UserCursor) => void;
  setSyncEnabled: (enabled: boolean) => void;
  setConnectionStatus: (connected: boolean) => void;
  updateLastSync: () => void;
  setWebSocket: (webSocket: any) => void;
  
  // Complex actions
  placeTag: (command: PlaceTagCommand) => Promise<void>;
  replaceAllTags: () => Promise<void>;
  clearSession: () => void;
}

export const useEditorStore = create<EditorStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      session: null,
      documents: [],
      currentDocument: null,
      mode: {
        mode: 'tagging',
        canPlaceTags: true,
        canModifyContent: false,
        showPlaceholders: true
      },
      
      participants: [],
      currentUser: null,
      selectedUser: null,
      
      tags: [],
      selectedTag: null,
      selectedTagType: null,
      draggedTag: null,
      
      whiteoutOverlays: [],
      
      // Initialize empty custom tag dimensions (session-only, no localStorage)
      customTagDimensions: {},
      
      lastUsedFontSize: (() => {
        // Load last used font size from localStorage, default to 16px (increased from 12px)
        try {
          const saved = localStorage.getItem('editorLastUsedFontSize');
          return saved ? parseInt(saved, 10) : 16;
        } catch (error) {
          console.warn('Failed to load last used font size from localStorage:', error);
          return 16;
        }
      })(),
      
      viewer: {
        currentPage: 1,
        totalPages: 0,
        zoomLevel: 1.0,
        scrollTop: 0,
        documentId: '',
        pendingScrollToPage: null
      },
      
      showGrid: false,
      snapToGrid: true,
      toolbarVisible: true,
      sidebarCollapsed: false,
      
      cursors: [],
      syncEnabled: true,
      lastSyncTime: null,
      isConnected: false,
      webSocket: null,
      
      // Session Management Actions
      setSession: (session) => {
        // Clear custom tag dimensions when setting a new session (fresh start)
        if (session) {
          set({ customTagDimensions: {} });
          try {
            localStorage.removeItem('editorCustomTagDimensions');
          } catch (error) {
            console.warn('Failed to clear custom tag dimensions from localStorage:', error);
          }
        }
        set({ session });
      },
      
      setDocuments: (documents) => set({ documents }),
      
      setCurrentDocument: (document) => 
        set((state) => ({
          currentDocument: document,
          viewer: {
            ...state.viewer,
            documentId: document?.id || '',
            // Reset pending scroll when switching documents
            pendingScrollToPage: null,
            // Reset scroll and page when a new document is set
            currentPage: document ? 1 : state.viewer.currentPage,
            scrollTop: 0
          }
        })),
      
      switchToDocument: (document) => {
        console.log(`🔄 Switching to document: ${document.fileName} (ID: ${document.id})`);
        set((state) => ({
          currentDocument: document,
          viewer: {
            ...state.viewer,
            documentId: document.id,
            currentPage: 1,
            scrollTop: 0,
            zoomLevel: state.viewer.zoomLevel // Preserve zoom level
          },
          // Clear selected tag when switching documents
          selectedTag: null,
          selectedTagType: null
        }));
      },
      
      setMode: (mode) => set({ mode }),
      
      // User Management Actions
      setParticipants: (participants) => set({ participants }),
      
      setCurrentUser: (user) => set({ currentUser: user }),
      
      setSelectedUser: (user) => set({ selectedUser: user }),
      
      switchUser: (userId) => {
        const { participants } = get();
        const user = participants.find(p => p.userId === userId);
        if (user) {
          set({ selectedUser: user });
        }
      },
      
      // Tag Management Actions
      setTags: (newTags) => {
        console.log('Setting tags in store:', newTags);
        set({ tags: newTags });
      },
      
      addTag: (tag) => 
        set((state) => {
          // Remove any existing tag with the same ID before adding
          const filteredTags = state.tags.filter(t => t.id !== tag.id);
          return {
            tags: [...filteredTags, tag],
            selectedTag: tag
          };
        }),
      
      updateTag: (tagId, updates) =>
        set((state) => {
          // Don't update temporary tags - they should be replaced by server tags
          if (tagId.startsWith('temp_')) {
            console.warn('Attempted to update temporary tag:', tagId);
            return state;
          }
          
          return {
            tags: state.tags.map(tag =>
              tag.id === tagId 
                ? { 
                    ...tag, 
                    ...updates,
                    coordinates: updates.coordinates 
                      ? { ...tag.coordinates, ...updates.coordinates }
                      : tag.coordinates,
                    updatedAt: new Date() 
                  }
                : tag
            ),
            selectedTag: state.selectedTag?.id === tagId 
              ? { 
                  ...state.selectedTag, 
                  ...updates,
                  coordinates: updates.coordinates 
                    ? { ...state.selectedTag.coordinates, ...updates.coordinates }
                    : state.selectedTag.coordinates,
                }
              : state.selectedTag
          };
        }),
      
      deleteTag: (tagId) =>
        set((state) => ({
          tags: state.tags.filter(tag => tag.id !== tagId),
          selectedTag: state.selectedTag?.id === tagId ? null : state.selectedTag
        })),
      
      selectTag: (tag) => set({ selectedTag: tag }),
      
      setSelectedTagType: (tagType) => {
        console.log('🔧 setSelectedTagType called with:', tagType, 'type:', typeof tagType);
        set({ selectedTagType: tagType });
      },
      
      setDraggedTag: (tag) => set({ draggedTag: tag }),
      
      // Document-specific tag management
      getCurrentDocumentTags: () => {
        const { tags, currentDocument } = get();
        if (!currentDocument) return [];
        return tags.filter(tag => tag.documentId === currentDocument.id);
      },
      
      getDocumentTags: (documentId: string) => {
        const { tags } = get();
        return tags.filter(tag => tag.documentId === documentId);
      },
      
      loadTagsForDocument: async (documentId: string) => {
        const { session } = get();
        if (!session) {
          console.warn('Cannot load tags: No active session');
          return;
        }
        
        try {
          console.log(`🏷️ Loading tags for document ${documentId}...`);
          const response = await fetch(`/api/editor/session/${session.id}/tags?documentId=${documentId}&t=${Date.now()}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Cache-Control': 'no-cache'
            }
          });
          
          if (!response.ok) {
            throw new Error(`Failed to load document tags: ${response.status}`);
          }
          
          const { tags: documentTags } = await response.json();
          
          // Update only tags for this specific document
          set(state => ({
            tags: [
              ...state.tags.filter(tag => tag.documentId !== documentId), // Remove old tags for this document
              ...documentTags // Add fresh tags for this document
            ]
          }));
          
          console.log(`✅ Loaded ${documentTags.length} tags for document ${documentId}`);
          
        } catch (error) {
          console.error(`❌ Failed to load tags for document ${documentId}:`, error);
          throw error;
        }
      },
      
      loadWhiteoutOverlays: async (documentId: string) => {
        const { session } = get();
        if (!session) {
          console.warn('Cannot load whiteout overlays: No active session');
          return;
        }
        
        try {
          console.log(`⬜ Loading whiteout overlays for document ${documentId}...`);
          const response = await fetch(`/api/editor/session/${session.id}/whiteout-overlays?documentId=${documentId}&t=${Date.now()}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Cache-Control': 'no-cache'
            }
          });
          
          // If endpoint doesn't exist (404) or has server error (500), just return empty overlays
          if (response.status === 404 || response.status === 500) {
            console.log(`⬜ Whiteout overlays endpoint not available (${response.status}), using empty overlays for document ${documentId}`);
            set(state => ({
              whiteoutOverlays: state.whiteoutOverlays.filter(overlay => overlay.documentId !== documentId)
            }));
            return;
          }

          if (!response.ok) {
            console.warn(`⚠️ Whiteout overlays request failed with status ${response.status}, using empty overlays for document ${documentId}`);
            set(state => ({
              whiteoutOverlays: state.whiteoutOverlays.filter(overlay => overlay.documentId !== documentId)
            }));
            return;
          }
          
          // Check if response is JSON
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.log(`⬜ Whiteout overlays endpoint returned non-JSON response, using empty overlays for document ${documentId}`);
            set(state => ({
              whiteoutOverlays: state.whiteoutOverlays.filter(overlay => overlay.documentId !== documentId)
            }));
            return;
          }
          
          const { overlays: documentOverlays } = await response.json();
          
          // Update only overlays for this specific document
          set(state => ({
            whiteoutOverlays: [
              ...state.whiteoutOverlays.filter(overlay => overlay.documentId !== documentId), // Remove old overlays for this document
              ...documentOverlays // Add fresh overlays for this document
            ]
          }));
          
          console.log(`✅ Loaded ${documentOverlays.length} whiteout overlays for document ${documentId}`);
          
        } catch (error) {
          console.warn(`⚠️ Could not load whiteout overlays for document ${documentId} (optional feature):`, error);
          // Don't throw error for whiteout overlays - they're optional
          // Set empty overlays for this document
          set(state => ({
            whiteoutOverlays: state.whiteoutOverlays.filter(overlay => overlay.documentId !== documentId)
          }));
        }
      },
      
      // Whiteout Overlay Management Actions
      setWhiteoutOverlays: (overlays) => set({ whiteoutOverlays: overlays }),
      addWhiteoutOverlay: (overlay) => set(state => ({ whiteoutOverlays: [...state.whiteoutOverlays, overlay] })),
      updateWhiteoutOverlay: (overlayId, updates) => set(state => ({
        whiteoutOverlays: state.whiteoutOverlays.map(overlay => 
          overlay.id === overlayId ? { ...overlay, ...updates } : overlay
        )
      })),
      deleteWhiteoutOverlay: (overlayId) => set(state => ({ whiteoutOverlays: state.whiteoutOverlays.filter(o => o.id !== overlayId) })),
      
      // Custom Dimensions Actions
      setCustomTagDimensions: (tagType, dimensions) => {
        console.log(`🔧 setCustomTagDimensions called - tagType: ${tagType}, dimensions:`, dimensions);
        const currentState = get();
        console.log('🔧 Current customTagDimensions before update:', currentState.customTagDimensions);
        
        set(state => {
          const newState = {
            customTagDimensions: {
              ...state.customTagDimensions,
              [tagType]: dimensions
            }
          };
          console.log('🔧 New customTagDimensions after update:', newState.customTagDimensions);
          return newState;
        });
        
        // Verify the change was applied
        setTimeout(() => {
          const updatedState = get();
          console.log('🔧 Verified customTagDimensions after setState:', updatedState.customTagDimensions);
        }, 0);
      },
      
      getTagDimensions: (tagType) => {
        // First check for custom dimensions
        const customDimensions = get().customTagDimensions[tagType];
        console.log(`🔧 getTagDimensions called - tagType: ${tagType}, custom dimensions:`, customDimensions);
        
        if (customDimensions) {
          console.log(`✅ Using custom dimensions for ${tagType}:`, customDimensions);
          return customDimensions;
        }
        
        // Fall back to default dimensions from tagConstants
        try {
          const defaultDimensions = getDefaultTagDimensions(tagType);
          console.log(`✅ Using default dimensions for ${tagType}:`, defaultDimensions);
          return defaultDimensions;
        } catch (error) {
          console.error(`❌ Could not get dimensions for tag type: ${tagType}`, error);
          // Return a safe fallback
          return { width: 120, height: 25 };
        }
      },
      
      clearCustomTagDimensions: () => {
        set({ customTagDimensions: {} });
        // Clear from localStorage as well
        try {
          localStorage.removeItem('editorCustomTagDimensions');
        } catch (error) {
          console.warn('Failed to clear custom tag dimensions from localStorage:', error);
        }
      },
      
      // Last Used Font Size Actions
      setLastUsedFontSize: (fontSize) => {
        const clampedFontSize = Math.min(Math.max(fontSize, 10), 40); // Clamp between 10px and 40px
        set({ lastUsedFontSize: clampedFontSize });
        
        // Save to localStorage for persistence
        try {
          localStorage.setItem('editorLastUsedFontSize', clampedFontSize.toString());
          console.log(`✅ Last used font size set to ${clampedFontSize}px`);
        } catch (error) {
          console.warn('Failed to save last used font size to localStorage:', error);
        }
      },
      
      getLastUsedFontSize: () => {
        return get().lastUsedFontSize;
      },
      
      // PDF Viewer Actions
      setCurrentPage: (page) =>
        set((state) => ({
          viewer: { ...state.viewer, currentPage: page, pendingScrollToPage: null }
        })),
      
      setZoomLevel: (zoom) => {
        console.log('🔍 Store setZoomLevel called:', { current: get().viewer.zoomLevel, new: zoom });
        set((state) => ({
          viewer: { ...state.viewer, zoomLevel: zoom }
        }));
        console.log('🔍 Store setZoomLevel completed:', { newZoom: get().viewer.zoomLevel });
      },
      
      setScrollTop: (scrollTop) =>
        set((state) => ({
          viewer: { ...state.viewer, scrollTop }
        })),
      
      syncToPage: (page) => {
        // Queue a programmatic scroll request for the viewer to handle
        set((state) => ({
          viewer: { ...state.viewer, pendingScrollToPage: page }
        }));
      },
      
      // UI Control Actions
      toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
      
      toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
      
      toggleToolbar: () => set((state) => ({ toolbarVisible: !state.toolbarVisible })),
      
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      
      // Collaboration Actions
      setCursors: (cursors) => set({ cursors }),
      
      updateCursor: (cursor) =>
        set((state) => ({
          cursors: [
            ...state.cursors.filter(c => c.userId !== cursor.userId),
            cursor
          ]
        })),
      
      setSyncEnabled: (enabled) => set({ syncEnabled: enabled }),
      
      setConnectionStatus: (connected) => set({ isConnected: connected }),
      
      updateLastSync: () => set({ lastSyncTime: new Date() }),
      
      setWebSocket: (webSocket) => set({ webSocket }),
      
      // Complex Actions
      placeTag: async (command: PlaceTagCommand) => {
        const { session, selectedUser, currentDocument } = get();
        
        if (!session || !selectedUser || !currentDocument) {
          throw new Error('Cannot place tag: Missing session, user, or document');
        }
        
        // Create optimistic tag for immediate UI feedback
        const tempTag: DocumentTag = {
          id: `temp_${Date.now()}`,
          sessionId: session.id,
          documentId: command.documentId,
          tagType: command.tagType,
          assignedUserId: command.assignedUserId || selectedUser.userId,
          coordinates: command.coordinates,
          displayLabel: `${command.tagType} - ${selectedUser.displayName}`,
          colorCode: selectedUser.colorCode,
          isCompleted: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Add to local state immediately (optimistic update)
        get().addTag(tempTag);
        
        // TODO: Add server API call here if needed
        console.log('✅ Tag placed optimistically:', tempTag.id);
      },

      replaceAllTags: async () => {
        // Implementation for replace all tags
        console.log('🔄 Replace all tags functionality');
      },

      clearSession: () => {
        // Clear custom tag dimensions when clearing session (fresh start)
        set({ customTagDimensions: {} });
        try {
          localStorage.removeItem('editorCustomTagDimensions');
        } catch (error) {
          console.warn('Failed to clear custom tag dimensions from localStorage:', error);
        }
        
        set({
          session: null,
          documents: [],
          currentDocument: null,
          participants: [],
          currentUser: null,
          selectedUser: null,
          tags: [],
          selectedTag: null,
          whiteoutOverlays: [],
          cursors: [],
          lastSyncTime: null,
          isConnected: false,
          webSocket: null
        });
      }
    }),
    {
      name: 'editor-store',
      skipHydration: true
    }
  )
);