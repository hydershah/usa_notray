// PDF Editor Components
export { default as PDFTaggingEditor } from './PDFTaggingEditor';
export { default as PDFViewer } from './PDFViewer';
export { default as TagLayer } from './TagLayer';
export { default as TaggingToolbar } from './TaggingToolbar';
export { default as HotkeyHandler } from './HotkeyHandler';

// Re-export types
export type {
  EditorSession,
  SessionDocument,
  SessionParticipant,
  DocumentTag,
  TagType,
  TagCoordinates,
  PlaceTagCommand,
  TagUpdate,
  UserCursor,
  CollaborationUpdate,
  NotaryLogEntry,
  ViewportBounds,
  PDFViewerState,
  EditorMode
} from '../../types/editor'; 