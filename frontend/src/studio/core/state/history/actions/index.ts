// Export all actions from a single entry point
export * from './BaseTrackAction';
export * from './TrackActions';

// Re-export action types constants
export const ACTION_TYPES = {
    ADD_TRACK: 'ADD_TRACK',
    DELETE_TRACK: 'DELETE_TRACK',
    MOVE_TRACK: 'MOVE_TRACK',
    BPM_CHANGE: 'BPM_CHANGE',
    TOGGLE_DRUM_PAD: 'TOGGLE_DRUM_PAD'
} as const;

// Export action type for type checking
export type ActionType = typeof ACTION_TYPES[keyof typeof ACTION_TYPES];
