import { Store } from '../store';
import { TrackState } from '../../types/track';
import * as Tone from 'tone';

// Base interface for all actions
export interface Action {
    execute(): Promise<void>;
    undo(): Promise<void>;
    type: string;
}

// Action for adding a track
export class AddTrackAction implements Action {
    type = 'ADD_TRACK';
    private trackData: TrackState;
    private store: Store;
    private setTracks: React.Dispatch<React.SetStateAction<TrackState[]>>;

    constructor(
        store: Store,
        trackData: TrackState,
        setTracks: React.Dispatch<React.SetStateAction<TrackState[]>>
    ) {
        this.store = store;
        this.trackData = trackData;
        this.setTracks = setTracks;
    }

    async execute(): Promise<void> {
        if (this.trackData.audioFile) {
            await this.store.getAudioEngine().createTrack(this.trackData.id, this.trackData.audioFile);
        } else {
            await this.store.getAudioEngine().createTrack(this.trackData.id);
        }
        this.setTracks(prev => [...prev, this.trackData]);
        console.log('🔄 Execute AddTrackAction:', { trackId: this.trackData.id });
    }

    async undo(): Promise<void> {
        this.store.removeTrack(this.trackData.id);
        this.setTracks(prev => prev.filter(track => track.id !== this.trackData.id));
        console.log('↩️ Undo AddTrackAction:', { trackId: this.trackData.id });
    }
}

// Action for deleting a track
export class DeleteTrackAction implements Action {
    type = 'DELETE_TRACK';
    private trackData: TrackState;
    private store: Store;
    private setTracks: React.Dispatch<React.SetStateAction<TrackState[]>>;

    constructor(
        store: Store,
        trackData: TrackState,
        setTracks: React.Dispatch<React.SetStateAction<TrackState[]>>
    ) {
        this.store = store;
        this.trackData = trackData;
        this.setTracks = setTracks;
    }

    async execute(): Promise<void> {
        this.store.removeTrack(this.trackData.id);
        this.setTracks(prev => prev.filter(track => track.id !== this.trackData.id));
        console.log('🔄 Execute DeleteTrackAction:', { trackId: this.trackData.id });
    }

    async undo(): Promise<void> {
        if (this.trackData.audioFile) {
            await this.store.getAudioEngine().createTrack(this.trackData.id, this.trackData.audioFile);
        } else {
            await this.store.getAudioEngine().createTrack(this.trackData.id);
        }
        this.setTracks(prev => [...prev, this.trackData]);
        console.log('↩️ Undo DeleteTrackAction:', { trackId: this.trackData.id });
    }
}

// Action for moving a track
export class MoveTrackAction implements Action {
    type = 'MOVE_TRACK';
    private store: Store;
    private setTracks: React.Dispatch<React.SetStateAction<TrackState[]>>;
    private trackId: string;
    private oldPosition: { x: number; y: number };
    private newPosition: { x: number; y: number };

    constructor(
        store: Store,
        setTracks: React.Dispatch<React.SetStateAction<TrackState[]>>,
        trackId: string,
        oldPosition: { x: number; y: number },
        newPosition: { x: number; y: number }
    ) {
        this.store = store;
        this.setTracks = setTracks;
        this.trackId = trackId;
        this.oldPosition = oldPosition;
        this.newPosition = newPosition;
    }

    async execute(): Promise<void> {
        this.setTracks(prev => prev.map(track => 
            track.id === this.trackId 
                ? { ...track, position: this.newPosition }
                : track
        ));
        console.log('🔄 Execute MoveTrackAction:', { 
            trackId: this.trackId, 
            from: this.oldPosition, 
            to: this.newPosition 
        });
    }

    async undo(): Promise<void> {
        this.setTracks(prev => prev.map(track => 
            track.id === this.trackId 
                ? { ...track, position: this.oldPosition }
                : track
        ));
        console.log('↩️ Undo MoveTrackAction:', { 
            trackId: this.trackId, 
            from: this.newPosition, 
            to: this.oldPosition 
        });
    }
}

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