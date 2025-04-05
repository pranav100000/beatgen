import { Store } from '../../store';
import * as Tone from 'tone';
import { useStudioStore } from '../../../../stores/useStudioStore';
import { calculateTrackWidth } from '../../../../constants/gridConstants';
import { BaseAction } from './BaseAction';

/**
 * Action for BPM changes without callbacks
 */
export class BPMChangeAction extends BaseAction {
    readonly type = 'BPM_CHANGE';
    private oldBpm: number;
    private newBpm: number;
    private timeSignature: [number, number];
    
    constructor(
        store: Store,
        oldBpm: number,
        newBpm: number,
        timeSignature: [number, number]
    ) {
        super(store);
        this.oldBpm = oldBpm;
        this.newBpm = newBpm;
        this.timeSignature = timeSignature;
    }
    
    private updateBPM(bpm: number): void {
        // Update Tone.js transport BPM
        Tone.Transport.bpm.value = bpm;
        
        // Update global state
        useStudioStore.setState(state => {
            // First update BPM
            const updatedState = { ...state, bpm };
            
            // Then recalculate track widths
            const updatedTracks = state.tracks.map(track => {
                if (track.duration) {
                    return {
                        ...track,
                        _calculatedWidth: calculateTrackWidth(track.duration, bpm, this.timeSignature)
                    };
                }
                return track;
            });
            
            return { ...updatedState, tracks: updatedTracks };
        });
    }
    
    async execute(): Promise<void> {
        this.updateBPM(this.newBpm);
        this.log('Execute', { from: this.oldBpm, to: this.newBpm });
    }
    
    async undo(): Promise<void> {
        this.updateBPM(this.oldBpm);
        this.log('Undo', { from: this.newBpm, to: this.oldBpm });
    }
}

/**
 * Action for time signature changes without callbacks
 */
export class TimeSignatureAction extends BaseAction {
    readonly type = 'TIME_SIGNATURE_CHANGE';
    private oldTimeSignature: [number, number];
    private newTimeSignature: [number, number];
    private bpm: number;
    
    constructor(
        store: Store,
        oldTimeSignature: [number, number],
        newTimeSignature: [number, number],
        bpm: number
    ) {
        super(store);
        this.oldTimeSignature = oldTimeSignature;
        this.newTimeSignature = newTimeSignature;
        this.bpm = bpm;
    }
    
    private updateTimeSignature(timeSignature: [number, number]): void {
        // Update Tone.js transport time signature
        Tone.Transport.timeSignature = timeSignature;
        
        // Update store's project manager
        this.store.projectManager.setTimeSignature(timeSignature[0], timeSignature[1]);
        
        // Update global state
        useStudioStore.setState(state => {
            // First update time signature
            const updatedState = { ...state, timeSignature };
            
            // Then recalculate track widths
            const updatedTracks = state.tracks.map(track => {
                if (track.duration) {
                    return {
                        ...track,
                        _calculatedWidth: calculateTrackWidth(track.duration, this.bpm, timeSignature)
                    };
                }
                return track;
            });
            
            return { ...updatedState, tracks: updatedTracks };
        });
    }
    
    async execute(): Promise<void> {
        this.updateTimeSignature(this.newTimeSignature);
        this.log('Execute', { from: this.oldTimeSignature, to: this.newTimeSignature });
    }
    
    async undo(): Promise<void> {
        this.updateTimeSignature(this.oldTimeSignature);
        this.log('Undo', { from: this.newTimeSignature, to: this.oldTimeSignature });
    }
}

/**
 * Action for key signature changes without callbacks
 */
export class KeySignatureAction extends BaseAction {
    readonly type = 'KEY_SIGNATURE_CHANGE';
    private oldKeySignature: string;
    private newKeySignature: string;
    
    constructor(
        store: Store,
        oldKeySignature: string,
        newKeySignature: string
    ) {
        super(store);
        this.oldKeySignature = oldKeySignature;
        this.newKeySignature = newKeySignature;
    }
    
    private updateKeySignature(keySignature: string): void {
        // Update store's project manager if it has the method
        if (this.store.projectManager && typeof this.store.projectManager.setKey === 'function') {
            this.store.projectManager.setKey(keySignature);
        }
        
        // Update global state
        useStudioStore.setState({ keySignature });
    }
    
    async execute(): Promise<void> {
        this.updateKeySignature(this.newKeySignature);
        this.log('Execute', { from: this.oldKeySignature, to: this.newKeySignature });
    }
    
    async undo(): Promise<void> {
        this.updateKeySignature(this.oldKeySignature);
        this.log('Undo', { from: this.newKeySignature, to: this.oldKeySignature });
    }
}

/**
 * Export all project actions
 */
export const ProjectActions = {
    BPMChange: BPMChangeAction,
    TimeSignature: TimeSignatureAction,
    KeySignature: KeySignatureAction
};