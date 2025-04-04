import { Store } from '../store';
import { TrackState } from '../../types/track';
import * as Tone from 'tone';

// Import action implementations from their dedicated files
import { AddTrackAction, DeleteTrackAction, MoveTrackAction, ACTION_TYPES, ActionType } from './actions';

// Re-export actions for backward compatibility 
export { AddTrackAction, DeleteTrackAction, MoveTrackAction, ACTION_TYPES, ActionType };

// Base interface for all actions
export interface Action {
    execute(): Promise<void>;
    undo(): Promise<void>;
    type: string;
}

// Track-related actions are now imported from './actions/index.ts'
// This includes AddTrackAction, DeleteTrackAction, and MoveTrackAction

// MoveTrackAction now imported from './actions/TrackActions.ts'
// export class MoveTrackAction implements Action { ... }

// Action for changing BPM
export class BPMChangeAction implements Action {
    readonly type = 'BPM_CHANGE';

    constructor(
        private store: Store,
        private setBpm: (bpm: number) => void,
        private oldBpm: number,
        private newBpm: number
    ) {}

    private updateBPM(bpm: number) {
        Tone.getTransport().bpm.value = bpm;
        this.setBpm(bpm);
    }

    async execute(): Promise<void> {
        this.updateBPM(this.newBpm);
    }

    async undo(): Promise<void> {
        this.updateBPM(this.oldBpm);
    }
}

// Action for toggling a drum pad (on/off)
export class ToggleDrumPadAction implements Action {
    readonly type = 'TOGGLE_DRUM_PAD';

    constructor(
        private store: Store,
        private trackId: string,
        private column: number,
        private row: number
    ) {}

    async execute(): Promise<void> {
        console.log('🔄 Executing ToggleDrumPadAction:', { 
            trackId: this.trackId, 
            column: this.column, 
            row: this.row 
        });
        
        // Get current state for logging
        const trackBefore = this.store.getTrackById(this.trackId);
        const padsBefore = trackBefore?.drumPads || [];
        const padExistsBefore = padsBefore.some(
            pad => pad.column === this.column && pad.row === this.row
        );
        
        // Toggle the pad
        this.store.toggleDrumPad(this.trackId, this.column, this.row);
        
        // Get new state for logging
        const trackAfter = this.store.getTrackById(this.trackId);
        const padsAfter = trackAfter?.drumPads || [];
        const padExistsAfter = padsAfter.some(
            pad => pad.column === this.column && pad.row === this.row
        );
        
        console.log('🔄 ToggleDrumPadAction result:', { 
            action: padExistsBefore ? 'removed' : 'added',
            result: padExistsAfter ? 'pad exists' : 'pad removed',
            padsBefore: padsBefore.length,
            padsAfter: padsAfter.length
        });
    }

    async undo(): Promise<void> {
        console.log('↩️ Undoing ToggleDrumPadAction:', { 
            trackId: this.trackId, 
            column: this.column, 
            row: this.row 
        });
        
        // Get current state for logging
        const trackBefore = this.store.getTrackById(this.trackId);
        const padsBefore = trackBefore?.drumPads || [];
        const padExistsBefore = padsBefore.some(
            pad => pad.column === this.column && pad.row === this.row
        );
        
        // Toggle again to revert the state
        this.store.toggleDrumPad(this.trackId, this.column, this.row);
        
        // Get new state for logging
        const trackAfter = this.store.getTrackById(this.trackId);
        const padsAfter = trackAfter?.drumPads || [];
        const padExistsAfter = padsAfter.some(
            pad => pad.column === this.column && pad.row === this.row
        );
        
        console.log('↩️ ToggleDrumPadAction undo result:', { 
            action: padExistsBefore ? 'removed' : 'added',
            result: padExistsAfter ? 'pad exists' : 'pad removed',
            padsBefore: padsBefore.length,
            padsAfter: padsAfter.length
        });
    }
} 