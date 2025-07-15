import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
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
  
  // Actions - Session Management
  setSession: (session: EditorSession | null) => void;
  setDocuments: (documents: SessionDocument[]) => void;
  setCurrentDocument: (document: SessionDocument | null) => void;
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
  
  // Actions - Whiteout Overlay Management
  setWhiteoutOverlays: (overlays: Array<any>) => void;
  addWhiteoutOverlay: (overlay: any) => void;
  deleteWhiteoutOverlay: (overlayId: string) => void;
  
  // Actions - Custom Dimensions
  setCustomTagDimensions: (tagType: TagType, dimensions: { width: number; height: number }) => void;
  getTagDimensions: (tagType: TagType) => { width: number; height: number } | null;
  clearCustomTagDimensions: () => void;
  
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
      
      customTagDimensions: (() => {
        // Load custom dimensions from localStorage on initialization
        try {
          const saved = localStorage.getItem('editorCustomTagDimensions');
          return saved ? JSON.parse(saved) : {};
        } catch (error) {
          console.warn('Failed to load custom tag dimensions from localStorage:', error);
          return {};
        }
      })(),
      
      viewer: {
        currentPage: 1,
        totalPages: 0,
        zoomLevel: 2.0,
        scrollTop: 0,
        documentId: ''
      },
      
      showGrid: false,
      snapToGrid: true,
      toolbarVisible: true,
      sidebarCollapsed: false,
      
      cursors: [],
      syncEnabled: true,
      lastSyncTime: null,
      isConnected: false,
      
      // Session Management Actions
      setSession: (session) => set({ session }),
      
      setDocuments: (documents) => set({ documents }),
      
      setCurrentDocument: (document) => 
        set((state) => ({
          currentDocument: document,
          viewer: {
            ...state.viewer,
            documentId: document?.id || '',
            currentPage: 1,
            scrollTop: 0
          }
        })),
      
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
      setTags: (tags) => set({ 
        tags: tags.filter(tag => {
          // Filter out any temporary tags when setting tags from server
          if (tag.id.toString().startsWith('temp_')) {
            console.warn('Filtering out temporary tag during setTags:', tag.id);
            return false;
          }
          return true;
        })
      }),
      
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
      
      setSelectedTagType: (tagType) => set({ selectedTagType: tagType }),
      
      setDraggedTag: (tag) => set({ draggedTag: tag }),
      
      // Whiteout Overlay Management Actions
      setWhiteoutOverlays: (overlays) => set({ whiteoutOverlays: overlays }),
      addWhiteoutOverlay: (overlay) => set(state => ({ whiteoutOverlays: [...state.whiteoutOverlays, overlay] })),
      deleteWhiteoutOverlay: (overlayId) => set(state => ({ whiteoutOverlays: state.whiteoutOverlays.filter(o => o.id !== overlayId) })),
      
      // Custom Dimensions Actions
      setCustomTagDimensions: (tagType, dimensions) => {
        set(state => {
          const newCustomDimensions = {
            ...state.customTagDimensions,
            [tagType]: dimensions
          };
          
          // Save to localStorage for persistence across sessions
          try {
            localStorage.setItem('editorCustomTagDimensions', JSON.stringify(newCustomDimensions));
          } catch (error) {
            console.warn('Failed to save custom tag dimensions to localStorage:', error);
          }
          
          return { customTagDimensions: newCustomDimensions };
        });
      },
      
      getTagDimensions: (tagType) => {
        const customDimensions = get().customTagDimensions[tagType];
        if (customDimensions) {
          return customDimensions;
        }
        // Return default dimensions if no custom dimensions are set
        if (tagType === 'W') {
          return { width: 250, height: 40 };
        } else {
          return { width: 97, height: 26 };
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
      
      // PDF Viewer Actions
      setCurrentPage: (page) =>
        set((state) => ({
          viewer: { ...state.viewer, currentPage: page }
        })),
      
      setZoomLevel: (zoom) =>
        set((state) => ({
          viewer: { ...state.viewer, zoomLevel: zoom }
        })),
      
      setScrollTop: (scrollTop) =>
        set((state) => ({
          viewer: { ...state.viewer, scrollTop }
        })),
      
      syncToPage: (page) => {
        // This will be used by the notary to sync all users to a specific page
        set((state) => ({
          viewer: { ...state.viewer, currentPage: page }
        }));
        // TODO: Send sync command to all participants via WebSocket
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
          displayLabel: `${getTagTypeInfo(command.tagType).icon} ${getTagTypeInfo(command.tagType).label} - ${selectedUser.displayName}`,
          colorCode: selectedUser.colorCode,
          isCompleted: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Add to local state immediately (optimistic update)
        get().addTag(tempTag);
        
        try {
          // Send to server via API
          const response = await fetch(`/api/editor/session/${session.id}/place-tag`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              documentId: command.documentId,
              tagType: command.tagType,
              coordinates: command.coordinates,
              assignedUserId: command.assignedUserId || selectedUser.userId
            })
          });
          
          if (!response.ok) {
            throw new Error(`Failed to place tag: ${response.statusText}`);
          }
          
          const { tag: serverTag } = await response.json();
          
          // Replace optimistic tag with server response
          set(state => ({
            tags: state.tags.map(t => 
              t.id === tempTag.id 
                ? { ...serverTag, displayLabel: tempTag.displayLabel, colorCode: tempTag.colorCode }
                : t
            )
          }));
          
          console.log('✅ Tag placed successfully:', serverTag);
          
        } catch (error) {
          // Rollback optimistic update on error
          get().deleteTag(tempTag.id);
          console.error('❌ Failed to place tag:', error);
          throw error;
        }
      },
      
      replaceAllTags: async () => {
        const { session, tags, mode } = get();
        
        if (!session || mode.mode !== 'notary') {
          throw new Error('Cannot replace tags: Invalid session or mode');
        }
        
        // Mark all tags as completed with content
        set((state) => ({
          tags: state.tags.map(tag => ({
            ...tag,
            isCompleted: true,
            contentData: getDefaultContentForTag(tag),
            updatedAt: new Date()
          }))
        }));
        
        // TODO: Send replace all command to server
        try {
          // await tagAPI.replaceAllTags(session.id);
          console.log('All tags replaced with content');
        } catch (error) {
          // Rollback on error
          set((state) => ({
            tags: state.tags.map(tag => ({
              ...tag,
              isCompleted: false,
              contentData: undefined
            }))
          }));
          throw error;
        }
      },
      
      clearSession: () =>
        set({
          session: null,
          documents: [],
          currentDocument: null,
          participants: [],
          currentUser: null,
          selectedUser: null,
          tags: [],
          selectedTag: null,
          selectedTagType: null,
          draggedTag: null,
          whiteoutOverlays: [],
          customTagDimensions: {},
          cursors: [],
          lastSyncTime: null,
          isConnected: false,
          viewer: {
            currentPage: 1,
            totalPages: 0,
            zoomLevel: 1.25,
            scrollTop: 0,
            documentId: ''
          }
        })
    }),
    {
      name: 'pdf-editor-store',
      version: 1
    }
  )
);

// Helper functions
function getTagTypeInfo(tagType: TagType) {
  const TAG_TYPE_INFO = {
    'A': { label: 'Name', icon: '✍️' },
    'S': { label: 'Signature', icon: '📝' },
    'I': { label: 'Initials', icon: '🔤' },
    'N': { label: 'Commission #', icon: '🆔' },
    'X': { label: 'Expiration', icon: '📅' },
    'O': { label: 'Disclosure', icon: '📋' },
    'E': { label: 'Seal', icon: '🔖' },
    'W': { label: 'Whiteout', icon: '⬜' },
    'T': { label: 'Text', icon: '📝' },
    'D': { label: 'Date', icon: '📆' },
  } as const;
  
  return TAG_TYPE_INFO[tagType];
}

function getDefaultContentForTag(tag: DocumentTag): any {
  // This would be populated from user profiles or default values
  switch (tag.tagType) {
    case 'A': return { text: 'John Doe' }; // From user profile
    case 'S': return { imageUrl: '/signatures/user_signature.gif' }; // From profile
    case 'I': return { imageUrl: '/initials/user_initials.gif' }; // From profile
    case 'D': return { date: new Date().toLocaleDateString() };
    case 'T': return { text: 'Sample text' };
    default: return null;
  }
}

// Export store hook for use in components
export default useEditorStore; 