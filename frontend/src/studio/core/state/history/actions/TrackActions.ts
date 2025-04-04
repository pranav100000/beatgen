import { useGridStore } from '../../gridStore';
import { Store } from '../../store';
import { TrackState } from '../../../types/track';
import { Action } from '../types';
import { BaseTrackAction } from './BaseTrackAction';

// Action for adding a track
export class AddTrackAction extends BaseTrackAction {
    type = 'ADD_TRACK';

    async execute(): Promise<void> {
        await this.addTrack();
        this.log('Execute', 'AddTrackAction');
    }

    async undo(): Promise<void> {
        this.removeTrack();
        this.log('Undo', 'AddTrackAction');
    }
}

// Action for deleting a track
export class DeleteTrackAction extends BaseTrackAction {
    type = 'DELETE_TRACK';

    async execute(): Promise<void> {
        this.removeTrack();
        this.log('Execute', 'DeleteTrackAction');
    }

    async undo(): Promise<void> {
        await this.addTrack();
        this.log('Undo', 'DeleteTrackAction');
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
    
    private updateTrackPosition(position: { x: number; y: number }): void {
        // Update UI state
        this.setTracks(prev => prev.map(track => 
            track.id === this.trackId 
                ? { ...track, position }
                : track
        ));
        
        // Update AudioEngine state to affect playback
        this.store.getAudioEngine().setTrackPosition(
            this.trackId, 
            position.x, 
            position.y
        );
        
        // If playback is active, tell the transport controller to adjust this track's playback
        this.store.getTransport().handleTrackPositionChange(this.trackId, position.x);
        
        // Update soundfont offset if it's a MIDI or drum track
        const track = this.store.getTrackById(this.trackId);
        if (track && (track.type === 'midi' || track.type === 'drum')) {
            // Convert X position (pixels) to milliseconds
            const beatDurationMs = (60 / this.store.getProjectManager().getTempo()) * 1000;
            const timeSignature = this.store.getProjectManager().getTimeSignature();
            const beatsPerMeasure = timeSignature[0];
            // Get grid constants from the store or use a default value
            const measureWidth = useGridStore.getState().midiMeasureWidth;
            const pixelsPerBeat = measureWidth / beatsPerMeasure;
            
            // Calculate offset in milliseconds
            const offsetBeats = position.x / pixelsPerBeat;
            const offsetMs = offsetBeats * beatDurationMs;
            
            // Set track offset in milliseconds
            this.store.getSoundfontController().setTrackOffset(this.trackId, offsetMs);
            console.log(`Set track ${this.trackId} offset: ${position.x}px → ${offsetMs}ms (${offsetBeats} beats)`);
        }
    }

    async execute(): Promise<void> {
        this.updateTrackPosition(this.newPosition);
        console.log('🔄 Execute MoveTrackAction:', { 
            trackId: this.trackId, 
            from: this.oldPosition, 
            to: this.newPosition 
        });
    }

    async undo(): Promise<void> {
        this.updateTrackPosition(this.oldPosition);
        console.log('↩️ Undo MoveTrackAction:', { 
            trackId: this.trackId, 
            from: this.newPosition, 
            to: this.oldPosition 
        });
    }
} 