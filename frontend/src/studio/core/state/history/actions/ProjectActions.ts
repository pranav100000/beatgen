import { Store } from '../../store';
import * as Tone from 'tone';
import { calculateTrackWidth } from '../../../../constants/gridConstants';
import { BaseAction } from './BaseAction';
import { GetFn, RootState } from '../../../../stores/types';
import { CombinedTrack } from 'src/platform/types/project';

/**
 * Action for BPM changes without callbacks
 */
export class BPMChangeAction extends BaseAction {
    readonly type = 'BPM_CHANGE';
    private oldBpm: number;
    private newBpm: number;
    private timeSignature: [number, number];
    
    constructor(
        get: GetFn,
        oldBpm: number,
        newBpm: number,
        timeSignature: [number, number]
    ) {
        super(get);
        this.oldBpm = oldBpm;
        this.newBpm = newBpm;
        this.timeSignature = timeSignature;
    }
    
    private updateBPM(bpm: number): void {
        Tone.getTransport().bpm.value = bpm;
        this.store.getTransport().setTempo(bpm);
        this.store.getProjectManager().setTempo(bpm);
        this.get().handleProjectParamChange('bpm', bpm);
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
// export class TimeSignatureAction extends BaseAction {
//     readonly type = 'TIME_SIGNATURE_CHANGE';
//     private oldTimeSignature: [number, number];
//     private newTimeSignature: [number, number];
//     private bpm: number;
    
//     constructor(
//         get: GetFn,
//         oldTimeSignature: [number, number],
//         newTimeSignature: [number, number],
//         bpm: number
//     ) {
//         super(get);
//         this.oldTimeSignature = oldTimeSignature;
//         this.newTimeSignature = newTimeSignature;
//         this.bpm = bpm;
//     }
    
//     private updateTimeSignature(timeSignature: [number, number]): void {
//         Tone.Transport.timeSignature = timeSignature;
//         this.store.projectManager.setTimeSignature(timeSignature[0], timeSignature[1]);
//         this.get().setTimeSignature(timeSignature[0], timeSignature[1]);
//     }
    
//     async execute(): Promise<void> {
//         this.updateTimeSignature(this.newTimeSignature);
//         this.log('Execute', { from: this.oldTimeSignature, to: this.newTimeSignature });
//     }
    
//     async undo(): Promise<void> {
//         this.updateTimeSignature(this.oldTimeSignature);
//         this.log('Undo', { from: this.newTimeSignature, to: this.oldTimeSignature });
//     }
// }

/**
 * Action for key signature changes without callbacks
 */
export class KeySignatureAction extends BaseAction {
    readonly type = 'KEY_SIGNATURE_CHANGE';
    private oldKeySignature: string;
    private newKeySignature: string;
    
    constructor(
        get: GetFn,
        oldKeySignature: string,
        newKeySignature: string
    ) {
        super(get);
        this.oldKeySignature = oldKeySignature;
        this.newKeySignature = newKeySignature;
    }
    
    private updateKeySignature(keySignature: string): void {
        if (this.store.projectManager && typeof this.store.projectManager.setKey === 'function') {
            this.store.projectManager.setKey(keySignature);
        }
        
        this.get().handleProjectParamChange('keySignature', keySignature);
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
    //TimeSignature: TimeSignatureAction,
    KeySignature: KeySignatureAction
};