// PDF Editor Components
export { PDFTaggingEditor } from './PDFTaggingEditor';
export { default as PDFViewer } from './PDFViewer';
export { default as TagLayer } from './TagLayer';
export { default as TaggingToolbar } from './TaggingToolbar';
export { default as HotkeyHandler } from './HotkeyHandler';

// Live Signing Components
export { LiveSigningInterface } from './LiveSigningInterface';
export { ParticipantPanel } from './ParticipantPanel';
export { SessionStatus } from './SessionStatus';
export { LiveSigningControls } from './LiveSigningControls';
export { VideoIntegration } from './VideoIntegration';

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