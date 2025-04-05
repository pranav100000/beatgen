// Re-export base action classes
export { BaseAction, TrackAction, NoteAction } from './BaseAction';

// Re-export all action modules
export { ProjectActions } from './ProjectActions';
export { TrackActions } from './TrackActions'; 
export { NoteActions } from './NoteActions';

// Re-export action types constants
export const ACTION_TYPES = {
    // Project actions
    BPM_CHANGE: 'BPM_CHANGE',
    TIME_SIGNATURE_CHANGE: 'TIME_SIGNATURE_CHANGE',
    KEY_SIGNATURE_CHANGE: 'KEY_SIGNATURE_CHANGE',
    
    // Track actions
    TRACK_POSITION_CHANGE: 'TRACK_POSITION_CHANGE',
    TRACK_ADD: 'TRACK_ADD',
    TRACK_DELETE: 'TRACK_DELETE',
    TRACK_VOLUME_CHANGE: 'TRACK_VOLUME_CHANGE',
    TRACK_PAN_CHANGE: 'TRACK_PAN_CHANGE',
    TRACK_MUTE_TOGGLE: 'TRACK_MUTE_TOGGLE',
    
    // Note actions
    NOTE_ADD: 'NOTE_ADD',
    NOTE_DELETE: 'NOTE_DELETE',
    NOTE_MOVE: 'NOTE_MOVE',
    NOTE_RESIZE: 'NOTE_RESIZE',
} as const;

// Export action type for type checking
export type ActionType = typeof ACTION_TYPES[keyof typeof ACTION_TYPES];

// Export the unified action object
import { ProjectActions } from './ProjectActions';
import { TrackActions } from './TrackActions';
import { NoteActions } from './NoteActions';

/**
 * Unified actions object for easy access to all action types
 */
export const Actions = {
    // Project actions
    ...ProjectActions,
    
    // Track actions
    ...TrackActions,
    
    // Note actions
    ...NoteActions
};

// Maintain backwards compatibility
export const DirectActions = Actions;
