import { Action } from '../types';
import * as Tone from 'tone';
import { TrackState, Position } from '../../../types/track';
import { Store } from '../../store';
import { calculateTrackWidth } from '../../../../constants/gridConstants';

// Action for changing track volume
export class TrackVolumeChangeAction implements Action {
    readonly type = 'TRACK_VOLUME_CHANGE';

    constructor(
        private store: Store,
        private trackId: string,
        private oldVolume: number,
        private newVolume: number,
        private updateTrackVolume: (trackId: string, volume: number) => void
    ) {}

    async execute(): Promise<void> {
        // Update state with direct volume update
        this.updateTrackVolume(this.trackId, this.newVolume);
        
        console.log('🔄 Execute TrackVolumeChangeAction:', { 
            trackId: this.trackId, 
            from: this.oldVolume, 
            to: this.newVolume 
        });
    }

    async undo(): Promise<void> {
        // Update state with direct volume update
        this.updateTrackVolume(this.trackId, this.oldVolume);
        
        console.log('↩️ Undo TrackVolumeChangeAction:', { 
            trackId: this.trackId, 
            from: this.newVolume, 
            to: this.oldVolume 
        });
    }
}

// Action for changing track pan
export class TrackPanChangeAction implements Action {
    readonly type = 'TRACK_PAN_CHANGE';

    constructor(
        private store: Store,
        private trackId: string,
        private oldPan: number,
        private newPan: number,
        private updateTrackPan: (trackId: string, pan: number) => void
    ) {}

    async execute(): Promise<void> {
        // Update state with direct pan update
        this.updateTrackPan(this.trackId, this.newPan);
        
        console.log('🔄 Execute TrackPanChangeAction:', { 
            trackId: this.trackId, 
            from: this.oldPan, 
            to: this.newPan 
        });
    }

    async undo(): Promise<void> {
        // Update state with direct pan update
        this.updateTrackPan(this.trackId, this.oldPan);
        
        console.log('↩️ Undo TrackPanChangeAction:', { 
            trackId: this.trackId, 
            from: this.newPan, 
            to: this.oldPan 
        });
    }
}

// Action for changing track position
export class TrackPositionChangeAction implements Action {
    readonly type = 'TRACK_POSITION_CHANGE';

    constructor(
        private store: Store,
        private trackId: string,
        private oldPosition: Position,
        private newPosition: Position,
        private updateTrackPosition: (trackId: string, position: Position) => void,
        private isPlaying: boolean
    ) {}

    async execute(): Promise<void> {
        // Update state with direct track position update
        this.updateTrackPosition(this.trackId, this.newPosition);
        
        // Update audio engine
        this.store.getAudioEngine().setTrackPosition(
            this.trackId, 
            this.newPosition.x, 
            this.newPosition.y
        );

        // Check current playback state rather than using previous state
        const isCurrentlyPlaying = this.store.getTransport().isPlaying;

        // If playback is active, tell the transport controller to adjust playback
        if (isCurrentlyPlaying) {
            console.log('Playback active during execute - syncing track with transport');
            this.store.getTransport().handleTrackPositionChange?.(this.trackId, this.newPosition.x);
        }
        
        console.log('🔄 Execute TrackPositionChangeAction:', { 
            trackId: this.trackId, 
            from: this.oldPosition, 
            to: this.newPosition,
            isCurrentlyPlaying
        });
    }

    async undo(): Promise<void> {
        // Update state with direct track position update
        this.updateTrackPosition(this.trackId, this.oldPosition);
        
        // Update audio engine
        this.store.getAudioEngine().setTrackPosition(
            this.trackId, 
            this.oldPosition.x, 
            this.oldPosition.y
        );

        // Check current playback state rather than using previous state
        // This ensures we always act based on current playback status
        const isCurrentlyPlaying = this.store.getTransport().isPlaying;

        // If playback is active, tell the transport controller to adjust playback
        if (isCurrentlyPlaying) {
            console.log('Playback active during undo - syncing track with transport');
            this.store.getTransport().handleTrackPositionChange?.(this.trackId, this.oldPosition.x);
        }
        
        console.log('↩️ Undo TrackPositionChangeAction:', { 
            trackId: this.trackId, 
            from: this.newPosition, 
            to: this.oldPosition,
            isCurrentlyPlaying
        });
    }
}

// Action for changing BPM
export class BPMChangeAction implements Action {
    readonly type = 'BPM_CHANGE';

    constructor(
        private store: Store,
        private oldBpm: number,
        private newBpm: number,
        private setBpm: (bpm: number) => void,
        private setTracks: (fn: (tracks: TrackState[]) => TrackState[]) => void,
        private timeSignature: [number, number]
    ) {}

    private updateBPM(bpm: number) {
        // Update Tone.js transport BPM
        Tone.Transport.bpm.value = bpm;
        
        // Update state BPM
        this.setBpm(bpm);
        
        // Recalculate track widths based on new BPM for tracks with duration
        this.setTracks(tracks => 
            tracks.map(track => {
                if (track.duration) {
                    return {
                        ...track,
                        _calculatedWidth: calculateTrackWidth(track.duration, bpm, this.timeSignature)
                    };
                }
                return track;
            })
        );
    }

    async execute(): Promise<void> {
        this.updateBPM(this.newBpm);
        console.log('🔄 Execute BPMChangeAction:', { from: this.oldBpm, to: this.newBpm });
    }

    async undo(): Promise<void> {
        this.updateBPM(this.oldBpm);
        console.log('↩️ Undo BPMChangeAction:', { from: this.newBpm, to: this.oldBpm });
    }
}


// Action for changing time signature
export class TimeSignatureChangeAction implements Action {
    readonly type = 'TIME_SIGNATURE_CHANGE';

    constructor(
        private store: Store,
        private oldTimeSignature: [number, number],
        private newTimeSignature: [number, number],
        private setTimeSignature: (numerator: number, denominator: number) => void,
        private setTracks: (fn: (tracks: TrackState[]) => TrackState[]) => void,
        private bpm: number
    ) {}

    private updateTimeSignature(timeSignature: [number, number]) {
        const [numerator, denominator] = timeSignature;
        
        // Update Tone.js transport time signature
        Tone.Transport.timeSignature = timeSignature;
        
        // Update state time signature
        this.setTimeSignature(numerator, denominator);
        
        // Recalculate track widths based on new time signature for tracks with duration
        this.setTracks(tracks => 
            tracks.map(track => {
                if (track.duration) {
                    return {
                        ...track,
                        _calculatedWidth: calculateTrackWidth(track.duration, this.bpm, timeSignature)
                    };
                }
                return track;
            })
        );
    }

    async execute(): Promise<void> {
        this.updateTimeSignature(this.newTimeSignature);
        console.log('🔄 Execute TimeSignatureChangeAction:', { 
            from: this.oldTimeSignature, 
            to: this.newTimeSignature 
        });
    }

    async undo(): Promise<void> {
        this.updateTimeSignature(this.oldTimeSignature);
        console.log('↩️ Undo TimeSignatureChangeAction:', { 
            from: this.newTimeSignature, 
            to: this.oldTimeSignature 
        });
    }
}

// Action for changing key signature
export class KeySignatureChangeAction implements Action {
    readonly type = 'KEY_SIGNATURE_CHANGE';

    constructor(
        private store: Store,
        private oldKeySignature: string,
        private newKeySignature: string,
        private setKeySignature: (keySignature: string) => void
    ) {}

    async execute(): Promise<void> {
        this.setKeySignature(this.newKeySignature);
        
        // If the store has a method to update key signature, call it
        if (this.store.projectManager && typeof this.store.projectManager.setKey === 'function') {
            this.store.projectManager.setKey(this.newKeySignature);
        }
        
        console.log('🔄 Execute KeySignatureChangeAction:', { 
            from: this.oldKeySignature, 
            to: this.newKeySignature 
        });
    }

    async undo(): Promise<void> {
        this.setKeySignature(this.oldKeySignature);
        
        // If the store has a method to update key signature, call it
        if (this.store.projectManager && typeof this.store.projectManager.setKey === 'function') {
            this.store.projectManager.setKey(this.oldKeySignature);
        }
        
        console.log('↩️ Undo KeySignatureChangeAction:', { 
            from: this.newKeySignature, 
            to: this.oldKeySignature 
        });
    }
}

// Action for track addition
export class TrackAddAction implements Action {
    readonly type = 'TRACK_ADD';

    constructor(
        private store: Store,
        private trackData: TrackState,
        private addTrack: (track: TrackState) => void,
        private removeTrack: (trackId: string) => void
    ) {}

    async execute(): Promise<void> {
        // Add the track to the UI state
        this.addTrack(this.trackData);
        
        // CRITICAL FIX: For audio tracks with files, we need to reload the audio file
        // before we can sync with the transport
        if (this.trackData.type === 'audio' && this.trackData.audioFile) {
            console.log('Reloading audio file for track during redo:', this.trackData.id);
            await this.store.loadAudioFile(this.trackData.id, this.trackData.audioFile);
        }
        
        // For all track types, ensure volume and pan are set correctly
        this.store.getAudioEngine().setTrackVolume(this.trackData.id, this.trackData.volume);
        this.store.getAudioEngine().setTrackPan(this.trackData.id, this.trackData.pan);
        
        // Also restore mute/solo state
        if (this.trackData.muted) {
            this.store.getAudioEngine().setTrackMute(this.trackData.id, true);
        }
        
        // Update audio engine track position
        this.store.getAudioEngine().setTrackPosition(
            this.trackData.id,
            this.trackData.position.x,
            this.trackData.position.y
        );
        
        // Check if playback is active
        const isPlaying = this.store.getTransport().isPlaying;
        
        // If playback is active, we need to sync the newly added track with the current transport
        if (isPlaying) {
            console.log('Playback is active - syncing newly added track with transport');
            
            // Add a slight delay to ensure audio is fully loaded and initialized
            // before trying to sync with the transport
            setTimeout(() => {
                // The elegant solution is to call handleTrackPositionChange which will properly
                // sync the track with the current transport position
                this.store.getTransport().handleTrackPositionChange(
                    this.trackData.id, 
                    this.trackData.position.x
                );
            }, 10); // 10ms delay to ensure proper initialization
        }
        
        console.log('🔄 Execute TrackAddAction:', { 
            trackId: this.trackData.id, 
            name: this.trackData.name,
            type: this.trackData.type,
            isPlaying
        });
    }

    async undo(): Promise<void> {
        // Remove the track from UI state
        this.removeTrack(this.trackData.id);
        
        console.log('↩️ Undo TrackAddAction:', { 
            trackId: this.trackData.id, 
            name: this.trackData.name 
        });
    }
}

// Action for track deletion
export class TrackDeleteAction implements Action {
    readonly type = 'TRACK_DELETE';

    constructor(
        private store: Store,
        private trackData: TrackState,
        private addTrack: (track: TrackState) => void,
        private removeTrack: (trackId: string) => void
    ) {}

    async execute(): Promise<void> {
        // Remove the track from UI state
        this.removeTrack(this.trackData.id);
        
        console.log('🔄 Execute TrackDeleteAction:', { 
            trackId: this.trackData.id, 
            name: this.trackData.name 
        });
    }

    async undo(): Promise<void> {
        // Add the track back to the UI state
        this.addTrack(this.trackData);
        
        // Re-initialize in audio engine
        if (this.trackData.type === 'audio' && this.trackData.audioFile) {
            // For audio tracks with files, reload the audio file
            await this.store.loadAudioFile(this.trackData.id, this.trackData.audioFile);
        }
        
        // Set position in audio engine
        this.store.getAudioEngine().setTrackPosition(
            this.trackData.id,
            this.trackData.position.x,
            this.trackData.position.y
        );
        
        // If track was muted/soloed, restore those states
        if (this.trackData.muted) {
            this.store.getAudioEngine().setTrackMute(this.trackData.id, true);
        }
        
        if (this.trackData.soloed) {
            this.store.getAudioEngine().setTrackSolo(this.trackData.id, true);
        }
        
        // Restore volume and pan
        this.store.getAudioEngine().setTrackVolume(this.trackData.id, this.trackData.volume);
        this.store.getAudioEngine().setTrackPan(this.trackData.id, this.trackData.pan);
        
        // Check if playback is active
        const isPlaying = this.store.getTransport().isPlaying;
        
        // If playback is active, sync the re-added track with the current transport
        if (isPlaying) {
            console.log('Playback active during undo of delete - syncing restored track with transport');
            
            // Properly sync the newly restored track with the current transport position
            this.store.getTransport().handleTrackPositionChange(
                this.trackData.id, 
                this.trackData.position.x
            );
        }
        
        console.log('↩️ Undo TrackDeleteAction:', { 
            trackId: this.trackData.id, 
            name: this.trackData.name,
            isPlaying
        });
    }
}