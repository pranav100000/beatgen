import { Store } from '../../store';
import { TrackState } from '../../../types/track';
import { Action } from '../types';
import { useGridStore } from '../../gridStore';

export abstract class BaseTrackAction implements Action {
    abstract type: string;
    protected trackData: TrackState;
    protected store: Store;
    protected setTracks: React.Dispatch<React.SetStateAction<TrackState[]>>;

    constructor(
        store: Store,
        trackData: TrackState,
        setTracks: React.Dispatch<React.SetStateAction<TrackState[]>>
    ) {
        this.store = store;
        this.trackData = trackData;
        this.setTracks = setTracks;
    }

    protected async addTrack(): Promise<void> {
        if (this.trackData.audioFile) {
            await this.store.getAudioEngine().createTrack(this.trackData.id, this.trackData.name, this.trackData.audioFile);
        } else {
            await this.store.getAudioEngine().createTrack(this.trackData.id, this.trackData.name);
        }
        this.setTracks(prev => [...prev, this.trackData]);
    }

    protected removeTrack(): void {
        this.store.removeTrack(this.trackData.id);
        this.setTracks(prev => prev.filter(track => track.id !== this.trackData.id));
    }

    protected log(operation: string, actionType: string): void {
        const emoji = operation === 'Execute' ? '🔄' : '↩️';
        console.log(`${emoji} ${operation} ${actionType}:`, { trackId: this.trackData.id });
    }

    abstract execute(): Promise<void>;
    abstract undo(): Promise<void>;
}