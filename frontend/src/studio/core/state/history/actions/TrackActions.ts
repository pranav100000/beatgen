import { Store } from '../../store';
import { TrackState, Position } from '../../../types/track';
import { useGridStore } from '../../gridStore';
import { useStudioStore } from '../../../../stores/useStudioStore';
import { BaseAction, TrackAction } from './BaseAction';

/**
 * Action for changing track position without callbacks
 */
export class TrackPositionAction extends TrackAction {
    readonly type = 'TRACK_POSITION_CHANGE';
    private oldPosition: Position;
    private newPosition: Position;
    
    constructor(
        store: Store,
        trackId: string,
        oldPosition: Position,
        newPosition: Position
    ) {
        super(store, trackId);
        this.oldPosition = oldPosition;
        this.newPosition = newPosition;
    }
    
    private updatePosition(position: Position, operation: string): void {
        // Update state directly through global store
        useStudioStore.setState(state => ({
            tracks: state.tracks.map(track => 
                track.id === this.trackId 
                    ? { ...track, position }
                    : track
            )
        }));
        
        // Update audio engine
        this.store.getAudioEngine().setTrackPosition(
            this.trackId, 
            position.x, 
            position.y
        );
        
        // Check current playback state
        const isCurrentlyPlaying = this.store.getTransport().isPlaying;
        
        // If playback is active, tell the transport controller to adjust playback
        if (isCurrentlyPlaying) {
            console.log(`Playback active during ${operation} - syncing track with transport`);
            this.store.getTransport().handleTrackPositionChange?.(this.trackId, position.x);
        }
        
        // Update soundfont offset if it's a MIDI or drum track
        const track = this.store.getTrackById(this.trackId);
        if (track && (track.type === 'midi' || track.type === 'drum')) {
            // Convert X position (pixels) to milliseconds
            const beatDurationMs = (60 / this.store.getProjectManager().getTempo()) * 1000;
            const timeSignature = this.store.getProjectManager().getTimeSignature();
            const beatsPerMeasure = timeSignature[0];
            // Get grid constants from the store
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
        this.updatePosition(this.newPosition, 'execute');
        this.log('Execute', { 
            trackId: this.trackId, 
            from: this.oldPosition, 
            to: this.newPosition,
            isCurrentlyPlaying: this.store.getTransport().isPlaying
        });
    }
    
    async undo(): Promise<void> {
        this.updatePosition(this.oldPosition, 'undo');
        this.log('Undo', { 
            trackId: this.trackId, 
            from: this.newPosition, 
            to: this.oldPosition,
            isCurrentlyPlaying: this.store.getTransport().isPlaying
        });
    }
}

/**
 * Action for adding a track without callbacks
 */
export class AddTrackAction extends BaseAction {
    readonly type = 'TRACK_ADD';
    private trackData: TrackState;
    
    constructor(store: Store, trackData: TrackState) {
        super(store);
        this.trackData = trackData;
    }
    
    async execute(): Promise<void> {
        // First, add the track to the audio engine
        if (this.trackData.type === 'audio' && this.trackData.audioFile) {
            console.log('Loading audio file for track during execute:', this.trackData.id);
            await this.store.loadAudioFile(this.trackData.id, this.trackData.audioFile);
        } else {
            await this.store.getAudioEngine().createTrack(this.trackData.id, this.trackData.name);
        }
        
        // Set up track properties
        this.store.getAudioEngine().setTrackVolume(this.trackData.id, this.trackData.volume);
        this.store.getAudioEngine().setTrackPan(this.trackData.id, this.trackData.pan);
        
        if (this.trackData.muted) {
            this.store.getAudioEngine().setTrackMute(this.trackData.id, true);
        }
        
        // Set track position in audio engine
        this.store.getAudioEngine().setTrackPosition(
            this.trackData.id,
            this.trackData.position.x,
            this.trackData.position.y
        );
        
        // Connect to soundfont if MIDI or drum track
        if ((this.trackData.type === 'midi' || this.trackData.type === 'drum') && this.trackData.instrumentId) {
            try {
                await this.store.connectTrackToSoundfont(this.trackData.id, this.trackData.instrumentId);
            } catch (error) {
                console.error(`Failed to connect track ${this.trackData.id} to soundfont:`, error);
            }
        }
        
        // Update the global state
        useStudioStore.setState(state => ({
            tracks: [...state.tracks, this.trackData]
        }));
        
        // Sync with transport if needed
        this.syncTrackWithTransport(this.trackData.id, this.trackData.position.x);
        
        this.log('Execute', { 
            trackId: this.trackData.id, 
            name: this.trackData.name,
            type: this.trackData.type
        });
    }
    
    async undo(): Promise<void> {
        // Remove from audio engine
        this.store.getAudioEngine().removeTrack(this.trackData.id);
        
        // Update global state
        useStudioStore.setState(state => ({
            tracks: state.tracks.filter(t => t.id !== this.trackData.id)
        }));
        
        this.log('Undo', { 
            trackId: this.trackData.id, 
            name: this.trackData.name 
        });
    }
}

/**
 * Action for deleting a track without callbacks
 */
export class DeleteTrackAction extends BaseAction {
    readonly type = 'TRACK_DELETE';
    private trackData: TrackState;
    
    constructor(store: Store, trackData: TrackState) {
        super(store);
        this.trackData = trackData;
    }
    
    async execute(): Promise<void> {
        // Remove from audio engine
        this.store.getAudioEngine().removeTrack(this.trackData.id);
        
        // Update global state
        useStudioStore.setState(state => ({
            tracks: state.tracks.filter(t => t.id !== this.trackData.id)
        }));
        
        this.log('Execute', { 
            trackId: this.trackData.id, 
            name: this.trackData.name 
        });
    }
    
    async undo(): Promise<void> {
        // First, add the track back to the audio engine
        if (this.trackData.type === 'audio' && this.trackData.audioFile) {
            await this.store.loadAudioFile(this.trackData.id, this.trackData.audioFile);
        } else {
            await this.store.getAudioEngine().createTrack(this.trackData.id, this.trackData.name);
        }
        
        // Restore all track properties
        this.store.getAudioEngine().setTrackPosition(
            this.trackData.id,
            this.trackData.position.x,
            this.trackData.position.y
        );
        
        this.store.getAudioEngine().setTrackVolume(this.trackData.id, this.trackData.volume);
        this.store.getAudioEngine().setTrackPan(this.trackData.id, this.trackData.pan);
        
        if (this.trackData.muted) {
            this.store.getAudioEngine().setTrackMute(this.trackData.id, true);
        }
        
        if (this.trackData.soloed) {
            this.store.getAudioEngine().setTrackSolo(this.trackData.id, true);
        }
        
        // Connect to soundfont if MIDI or drum track
        if ((this.trackData.type === 'midi' || this.trackData.type === 'drum') && this.trackData.instrumentId) {
            try {
                await this.store.connectTrackToSoundfont(this.trackData.id, this.trackData.instrumentId);
            } catch (error) {
                console.error(`Failed to connect track ${this.trackData.id} to soundfont:`, error);
            }
        }
        
        // Update global state
        useStudioStore.setState(state => ({
            tracks: [...state.tracks, this.trackData]
        }));
        
        // Sync with transport if needed
        this.syncTrackWithTransport(this.trackData.id, this.trackData.position.x);
        
        this.log('Undo', { 
            trackId: this.trackData.id, 
            name: this.trackData.name,
            isPlaying: this.store.getTransport().isPlaying
        });
    }
}

/**
 * Action for track parameter changes (volume, pan, etc.) without callbacks
 */
export class ParameterChangeAction extends TrackAction {
    type: string;
    private parameter: string;
    private oldValue: number;
    private newValue: number;
    
    constructor(
        store: Store,
        trackId: string,
        parameter: 'volume' | 'pan' | 'muted',
        oldValue: number,
        newValue: number
    ) {
        super(store, trackId);
        this.parameter = parameter;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.type = `TRACK_${parameter.toUpperCase()}_CHANGE`;
    }
    
    private updateParameter(value: number): void {
        // Update the appropriate parameter in the audio engine
        switch (this.parameter) {
            case 'volume':
                this.store.getAudioEngine().setTrackVolume(this.trackId, value);
                this.store.getSoundfontController().setTrackVolume?.(this.trackId, value);
                break;
            case 'pan':
                this.store.getAudioEngine().setTrackPan(this.trackId, value);
                break;
            case 'muted':
                const isMuted = value === 1;
                this.store.getAudioEngine().setTrackMute(this.trackId, isMuted);
                this.store.getSoundfontController().muteTrack?.(this.trackId, isMuted);
                break;
        }
        
        // Update state in the global store
        useStudioStore.setState(state => ({
            tracks: state.tracks.map(track => 
                track.id === this.trackId
                    ? { 
                        ...track, 
                        [this.parameter]: this.parameter === 'muted' ? value === 1 : value 
                      }
                    : track
            )
        }));
    }
    
    async execute(): Promise<void> {
        this.updateParameter(this.newValue);
        this.log('Execute', { 
            trackId: this.trackId, 
            parameter: this.parameter,
            from: this.oldValue, 
            to: this.newValue 
        });
    }
    
    async undo(): Promise<void> {
        this.updateParameter(this.oldValue);
        this.log('Undo', { 
            trackId: this.trackId, 
            parameter: this.parameter,
            from: this.newValue, 
            to: this.oldValue 
        });
    }
}

/**
 * Export all track actions
 */
export const TrackActions = {
    TrackPosition: TrackPositionAction,
    AddTrack: AddTrackAction, 
    DeleteTrack: DeleteTrackAction,
    ParameterChange: ParameterChangeAction
};