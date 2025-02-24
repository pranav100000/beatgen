import { Store } from '../../store';
import { Action } from '../types';
import * as Tone from 'tone';

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