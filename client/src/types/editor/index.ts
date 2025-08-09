// Core editor types for Digital Notary PDF Tagging System

export interface EditorSession {
  id: string;
  jobId: string;
  notaryId: string;
  sessionType: 'tagging' | 'notary' | 'signing';
  status: 'preparing' | 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface SessionDocument {
  id: string;
  sessionId: string;
  fileName: string;
  fileUrl: string;
  pageCount: number;
  fileSize: number;
  uploadedAt: Date;
}

export interface SessionParticipant {
  id: string;
  sessionId: string;
  userId: string;
  role: 'notary' | 'signer' | 'witness' | 'admin';
  userType: 'notary' | 'signer' | 'witness';
  status: 'invited' | 'joined' | 'active' | 'disconnected';
  currentPage: number;
  currentDocumentId?: string;
  joinedAt?: Date;
  lastActivityAt: Date;
  displayName: string;
  email: string;
  colorCode: string;
}

// Tag types corresponding to keyboard shortcuts
export type TagType = 
  | 'A' // Name tag
  | 'S' // Signature tag  
  | 'I' // Initials tag
  | 'N' // Commission Number tag (notary only)
  | 'X' // Commission Expiration tag (notary only) 
  | 'O' // Disclosure tag (notary only)
  | 'E' // Seal tag (notary only)
  | 'W' // Whiteout tag (notary only)
  | 'T' // Text tag (universal)
  | 'D'; // Date tag (universal)

export interface TagCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
}

export interface DocumentTag {
  id: string;
  sessionId: string;
  documentId: string;
  tagType: TagType;
  assignedUserId?: string;
  coordinates: TagCoordinates;
  displayLabel: string;
  colorCode: string;
  isCompleted: boolean;
  content?: string;
  contentType?: string;
  contentData?: any; // Actual content when replaced in live session
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaceTagCommand {
  documentId: string;
  tagType: TagType;
  coordinates: TagCoordinates;
  assignedUserId?: string;
}

export interface TagUpdate {
  coordinates?: Partial<TagCoordinates>;
  contentData?: any;
  isCompleted?: boolean;
}

export interface UserCursor {
  userId: string;
  x: number;
  y: number;
  pageNumber: number;
  documentId: string;
  timestamp: Date;
}

export interface CollaborationUpdate {
  type: 'tag_placed' | 'tag_updated' | 'tag_deleted' | 'tag_content_updated' | 'cursor_moved' | 
        'page_changed' | 'user_joined' | 'user_left' | 'content_replaced' | 'session_sync';
  payload: any;
  userId: string;
  timestamp: number;
  sessionId: string;
}

export interface NotaryLogEntry {
  id: string;
  sessionId: string;
  notaryId: string;
  signerId: string;
  documentId: string;
  notarizationType: 'jurat' | 'acknowledgment' | 'copy_certification';
  pageNumber: number;
  sealCoordinates?: TagCoordinates;
  isTemporary: boolean;
  createdAt: Date;
  finalizedAt?: Date;
}

// User role constants and color mapping
export const USER_COLORS = {
  notary: '#1e40af',     // Professional Blue
  admin: '#7c2d12',      // Professional Brown
  signer1: '#3b82f6',    // Professional Blue
  signer2: '#1d4ed8',    // Professional Dark Blue
  signer3: '#dc2626',    // Professional Red
  signer4: '#ea580c',    // Professional Orange
  signer5: '#0891b2',    // Professional Cyan
  witness1: '#be185d',   // Professional Pink
  witness2: '#65a30d',   // Professional Lime
} as const;

// Tag type metadata
export const TAG_TYPE_INFO = {
  'A': { label: 'Name', icon: 'A', description: 'Signer name field' },
  'S': { label: 'Signature', icon: 'S', description: 'Signature placement' },
  'I': { label: 'Initials', icon: 'I', description: 'Initial placement' },
  'N': { label: 'Commission #', icon: 'N', description: 'Notary commission number' },
  'X': { label: 'Expiration', icon: 'X', description: 'Commission expiration date' },
  'O': { label: 'Disclosure', icon: 'O', description: 'Notary disclosure statement' },
  'E': { label: 'Seal', icon: 'E', description: 'Notary seal/stamp' },
  'W': { label: 'Whiteout', icon: 'W', description: 'Cover original content' },
  'T': { label: 'Text', icon: 'T', description: 'Free text input' },
  'D': { label: 'Date', icon: 'D', description: 'Date field' },
} as const;

// Viewport and canvas types
export interface ViewportBounds {
  top: number;
  left: number;
  bottom: number;
  right: number;
  pageNumber: number;
}

export interface PDFViewerState {
  currentPage: number;
  totalPages: number;
  zoomLevel: number;
  scrollTop: number;
  documentId: string;
}

export interface EditorMode {
  mode: 'tagging' | 'notary' | 'signing';
  canPlaceTags: boolean;
  canModifyContent: boolean;
  showPlaceholders: boolean;
} 