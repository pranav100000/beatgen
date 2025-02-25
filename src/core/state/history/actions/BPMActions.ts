import { Store } from '../../store';
import { Action } from '../types';
import * as Tone from 'tone';
import { TrackState } from '../../../types/track';
import { calculateTrackWidth } from '../../../../constants/gridConstants';

// Action for changing BPM
export class BPMChangeAction implements Action {
    readonly type = 'BPM_CHANGE';

    constructor(
        private store: Store,
        private setBpm: (bpm: number) => void,
        private setTracks: React.Dispatch<React.SetStateAction<TrackState[]>>,
        private oldBpm: number,
        private newBpm: number
    ) {}

    private updateBPM(bpm: number) {
        // Update Tone.js transport BPM
        Tone.getTransport().bpm.value = bpm;
        
        // Update state BPM
        this.setBpm(bpm);
        
        // Recalculate track widths based on new BPM
        this.setTracks(currentTracks => 
            currentTracks.map(track => {
                // Only recalculate for tracks with duration
                if (track.duration) {
                    console.log(`Recalculating width for track ${track.id} with new BPM: ${bpm}`);
                    return {
                        ...track,
                        _calculatedWidth: calculateTrackWidth(track.duration, bpm)
                    };
                }
                return track;
            })
        );
    }

    async execute(): Promise<void> {
        this.updateBPM(this.newBpm);
    }

    async undo(): Promise<void> {
        this.updateBPM(this.oldBpm);
    }
} 