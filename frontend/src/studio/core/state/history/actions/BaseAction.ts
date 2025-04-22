import { Store } from '../../store';
import { GetFn, RootState } from '../../../../stores/types';
import { ActionType } from '.';

export interface Action {
    execute(): Promise<void>;
    undo(): Promise<void>;
    type: string;
}

/**
 * Base class for all direct actions that update state without callbacks
 */
export abstract class BaseAction implements Action {
    abstract type: ActionType;
    protected get: GetFn;
    protected store: Store;
    
    constructor(get: GetFn) {
        this.get = get;
        const storeInstance = this.get().store;
        if (!storeInstance) {
            throw new Error("Store instance not available when creating action!");
        }
        this.store = storeInstance;
    }
    
    /**
     * Helper method for logging actions
     */
    protected log(operation: string, message: object): void {
        const emoji = operation === 'Execute' ? '🔄' : '↩️';
        console.log(`${emoji} ${operation} ${this.type}:`, message);
    }
    
    /**
     * Synchronizes a track with the current transport state
     */
    protected syncTrackWithTransport(trackId: string, positionX: number): void {
        const isPlaying = this.get().isPlaying;
        
        if (isPlaying && this.store.getTransport().handleTrackPositionChange) {
            console.log(`Playback active - syncing track ${trackId} with transport`);
            setTimeout(() => {
                this.store.getTransport().handleTrackPositionChange(trackId, positionX);
            }, 10);
        }
    }
    
    abstract execute(): Promise<void>;
    abstract undo(): Promise<void>;
}

/**
 * Abstract base class for actions that operate on a track
 */
export abstract class TrackAction extends BaseAction {
    protected trackId: string;
    
    constructor(get: GetFn, trackId: string) {
        super(get);
        this.trackId = trackId;
    }
    
    abstract execute(): Promise<void>;
    abstract undo(): Promise<void>;
}

/**
 * Abstract base class for actions that operate on a note within a track
 */
export abstract class NoteAction extends BaseAction {
    protected trackId: string;
    protected noteId: string;
    
    constructor(get: GetFn, trackId: string, noteId: string) {
        super(get);
        this.trackId = trackId;
        this.noteId = noteId;
    }
    
    abstract execute(): Promise<void>;
    abstract undo(): Promise<void>;
}