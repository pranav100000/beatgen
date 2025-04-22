import { Store } from '../../store';
// import { useGridStore } from '../../gridStore'; // Assuming unused
// Remove import for old store
// import { useStudioStore } from '../../../../stores/useStudioStore'; 
import { BaseAction, TrackAction } from './BaseAction';
import { pixelsToTicks, ticksToPixels } from '../../../../constants/gridConstants';
// Fix Position import path
import { Position } from '../../../../components/track'; 
// Fix TrackState: Use CombinedTrack from platform types
import { CombinedTrack } from 'src/platform/types/project'; 
// Fix GetFn import path
import { GetFn, RootState } from '../../../../stores/types'; 
import { ActionType } from '.';
// Fix: Import TRACK_CONFIG
import { TRACK_CONFIG } from '../../../../stores/config'; 

/**
 * Action for changing track position without callbacks
 */
export class TrackPositionAction extends TrackAction {
    readonly type = 'TRACK_POSITION_CHANGE';
    private oldPosition: Position;
    private newPosition: Position;
    
    constructor(
        get: GetFn,
        trackId: string,
        oldPosition: Position,
        newPosition: Position
    ) {
        super(get, trackId);
        this.oldPosition = oldPosition;
        this.newPosition = newPosition;
    }
    
    private updatePosition(position: Position, operation: string): void {
        this.get().updateTrackState(this.trackId, { 
            position: { ...position },
            x_position: position.x, 
            y_position: position.y 
        });
        
        this.store.getAudioEngine().setTrackPosition(this.trackId, position.x, position.y);
        
        const isCurrentlyPlaying = this.get().isPlaying;
        
        if (isCurrentlyPlaying && this.store.getTransport().handleTrackPositionChange) {
            console.log(`Playback active during ${operation} - syncing track`);
            this.store.getTransport().handleTrackPositionChange(this.trackId, position.x);
        }
        
        const track = this.get().findTrackById(this.trackId);
        if (track && (track.type === 'midi' || track.type === 'drum' || track.type === 'sampler')) {
            const bpm = this.get().bpm;
            const timeSignature = this.get().timeSignature;
            const PPQ = 480; 
            const offsetBeats = position.x / PPQ;
            const beatDurationMs = (60 / bpm) * 1000;
            const offsetMs = offsetBeats * beatDurationMs;
            
            this.store.getSoundfontController()?.setTrackOffset?.(this.trackId, offsetMs);
            this.store.getSamplerController()?.setTrackOffset?.(this.trackId, offsetMs);
            console.log(`Set track ${this.trackId} offset: ${position.x} ticks -> ${offsetMs}ms`);
        }
    }
    
    async execute(): Promise<void> {
        this.updatePosition(this.newPosition, 'execute');
        this.log('Execute', { 
            trackId: this.trackId, 
            from: this.oldPosition, 
            to: this.newPosition,
            isCurrentlyPlaying: this.get().isPlaying
        });
    }
    
    async undo(): Promise<void> {
        this.updatePosition(this.oldPosition, 'undo');
        this.log('Undo', { 
            trackId: this.trackId, 
            from: this.newPosition, 
            to: this.oldPosition,
            isCurrentlyPlaying: this.get().isPlaying
        });
    }
}

/**
 * Action for adding a track without callbacks
 */
export class AddTrackAction extends BaseAction {
    readonly type = 'TRACK_ADD';
    private trackData: CombinedTrack;
    private initialFile?: File;
    
    constructor(get: GetFn, trackData: CombinedTrack, file?: File) {
        super(get);
        this.trackData = { ...trackData };
        this.initialFile = file;
    }
    
    async execute(): Promise<void> {
        console.log('AddTrackAction: Execute started for', this.trackData.id);
        
        // Step 1: Update Zustand state FIRST
        let trackAddedToState = false;
        this.get()._updateState('tracks', (prevTracks) => {
            if (prevTracks.some(t => t.id === this.trackData.id)) {
                console.warn(`AddTrackAction execute: Track ${this.trackData.id} already exists in state.`);
                return prevTracks; 
            }
            trackAddedToState = true;
            return [...prevTracks, this.trackData];
        });

        if (!trackAddedToState) return; 
        this.get().updateTrackIndices(); 
        console.log('AddTrackAction: State updated for', this.trackData.id);

        // Step 2: Initialize Engine Backend
        const typeConfig = TRACK_CONFIG[this.trackData.type];
        if (!typeConfig) {
            console.error(`Invalid track type ${this.trackData.type} in AddTrackAction execute`);
            return; // Cannot initialize engine
        }
        
        // Use the stored initialFile if available
        const fileToLoad = this.initialFile; 
        const trackSpecificData = this.trackData.track as any;
        const instrumentId = this.trackData.type === 'midi' ? trackSpecificData?.instrument_id as string | undefined : undefined;

        console.log("instrumentId: ", instrumentId);
        
        try {
            console.log(`AddTrackAction: Calling initEngine for ${this.trackData.id} (type: ${this.trackData.type})`);
            // Pass the stored file object (or undefined)
            await typeConfig.initEngine(this.store, this.trackData.id, this.get, fileToLoad, instrumentId); 
            console.log(`AddTrackAction: initEngine completed for ${this.trackData.id}`);
        } catch (engineInitError) {
            console.error(`AddTrackAction: Error during initEngine for ${this.trackData.id}:`, engineInitError);
            // Consider potential rollback or error state update here?
        }

        // Step 3: Set other engine parameters (potentially redundant but ensures state)
        console.log('AddTrackAction: Setting other engine params for', this.trackData.id);
        try {
            this.store.getAudioEngine().setTrackVolume(this.trackData.id, this.trackData.volume ?? 80);
            this.store.getAudioEngine().setTrackPan(this.trackData.id, this.trackData.pan ?? 0);
            this.store.getAudioEngine().setTrackMute(this.trackData.id, this.trackData.mute ?? false);
            this.store.getAudioEngine().setTrackPosition(
                this.trackData.id,
                this.trackData.x_position ?? 0,
                this.trackData.y_position ?? 0
            );
            // Connect soundfont if applicable (might be handled by initEngine for midi? Check config)
            if ((this.trackData.type === 'midi' || this.trackData.type === 'drum') && instrumentId) {
                 console.log('AddTrackAction: Re-connecting to soundfont during execute (check if redundant):', this.trackData.id);
                 await this.store.connectTrackToSoundfont(this.trackData.id, instrumentId);
            }
        } catch (paramError) {
            console.error(`AddTrackAction: Error setting engine parameters for ${this.trackData.id}:`, paramError);
        }
        
        this.log('Execute', { trackId: this.trackData.id, name: this.trackData.name });
    }
    
    async undo(): Promise<void> {
        console.log('AddTrackAction: Undo started for', this.trackData.id);
        // Step 1: Remove from State
        this.get()._updateState('tracks', state => state.filter(t => t.id !== this.trackData.id));
        this.get().updateTrackIndices();
        console.log('AddTrackAction: State updated for undo', this.trackData.id);

        // Step 2: Remove from Engine and Controllers
        try {
             console.log('AddTrackAction: Removing from engine/controllers for undo', this.trackData.id);
             await this.store.getAudioEngine().removeTrack(this.trackData.id);
             if (this.trackData.type === 'midi' || this.trackData.type === 'drum') {
                 this.store.getSoundfontController()?.removeTrack?.(this.trackData.id);
             } else if (this.trackData.type === 'sampler') {
                 this.store.getSamplerController()?.removeSampler?.(this.trackData.id);
                 console.log('AddTrackAction: Cleaned up sampler track', this.trackData.id);
             }
        } catch (removeError) {
            console.error(`AddTrackAction: Error during engine/controller removal on undo for ${this.trackData.id}:`, removeError);
        }
        
        this.log('Undo', { trackId: this.trackData.id, name: this.trackData.name });
    }
}

/**
 * Action for deleting a track without callbacks
 */
export class DeleteTrackAction extends BaseAction {
    readonly type = 'TRACK_DELETE';
    private trackData: CombinedTrack;
    
    constructor(get: GetFn, trackData: CombinedTrack) {
        super(get);
        this.trackData = { ...trackData };
    }
    
    async execute(): Promise<void> {
        await this.store.getAudioEngine().removeTrack(this.trackData.id);
        if (this.trackData.type === 'midi' || this.trackData.type === 'drum') {
            this.store.getSoundfontController()?.removeTrack?.(this.trackData.id);
        } else if (this.trackData.type === 'sampler') {
            this.store.getSamplerController()?.removeSampler?.(this.trackData.id);
        }
        
        this.get()._updateState('tracks', state => state.filter(t => t.id !== this.trackData.id));
        this.get().updateTrackIndices();
        
        this.log('Execute', { 
            trackId: this.trackData.id, 
            name: this.trackData.name,
            type: this.trackData.type
        });
    }
    
    async undo(): Promise<void> {
        const trackSpecificData = this.trackData.track as any;
        const audioFile = trackSpecificData.audioFile as File | undefined;
        const instrumentId = trackSpecificData.instrumentId as string | undefined;
        const sampleFile = trackSpecificData.sampleFile as File | undefined;
        const baseMidiNote = trackSpecificData.baseMidiNote as number | undefined;
        const grainSize = trackSpecificData.grainSize as number | undefined;
        const overlap = trackSpecificData.overlap as number | undefined;

        if (this.trackData.type === 'audio' && audioFile) {
            await this.store.loadAudioFile(this.trackData.id, audioFile);
        } else {
            await this.store.getAudioEngine().createTrack(this.trackData.id, this.trackData.name);
        }
        
        this.store.getAudioEngine().setTrackPosition(this.trackData.id, this.trackData.x_position ?? 0, this.trackData.y_position ?? 0);
        this.store.getAudioEngine().setTrackVolume(this.trackData.id, this.trackData.volume ?? 80);
        this.store.getAudioEngine().setTrackPan(this.trackData.id, this.trackData.pan ?? 0);
        this.store.getAudioEngine().setTrackMute(this.trackData.id, this.trackData.mute ?? false);
        
        if ((this.trackData.type === 'midi' || this.trackData.type === 'drum') && instrumentId) {
            try { await this.store.connectTrackToSoundfont(this.trackData.id, instrumentId); } catch (error) { console.error(`Failed to connect track ${this.trackData.id} to soundfont:`, error); }
        } else if (this.trackData.type === 'sampler' && sampleFile) { 
            try {
                await this.store.connectTrackToSampler(
                    this.trackData.id, 
                    sampleFile,
                    baseMidiNote,
                    grainSize,
                    overlap
                );
            } catch (error) { console.error(`Failed to connect track ${this.trackData.id} to sampler:`, error); }
        }
        
        this.get()._updateState('tracks', (prevTracks) => [...prevTracks, this.trackData]);
        this.get().updateTrackIndices();
        
        this.log('Undo', { 
            trackId: this.trackData.id, 
            name: this.trackData.name,
            isPlaying: this.get().isPlaying
        });
    }
}

/**
 * Action for track parameter changes (volume, pan, etc.) without callbacks
 */
export class ParameterChangeAction extends TrackAction {
    type: ActionType;
    private parameter: string;
    private oldValue: number;
    private newValue: number;
    
    constructor(
        get: GetFn,
        trackId: string,
        parameter: 'volume' | 'pan' | 'muted',
        oldValue: number,
        newValue: number
    ) {
        super(get, trackId);
        this.parameter = parameter;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.type = `TRACK_${parameter.toUpperCase()}_CHANGE` as ActionType;
    }
    
    private updateParameter(value: number): void {
        const isMuted = this.parameter === 'muted' ? value === 1 : undefined;
        
        switch (this.parameter) {
            case 'volume':
                this.store.getAudioEngine().setTrackVolume(this.trackId, value);
                this.store.getSoundfontController()?.setTrackVolume?.(this.trackId, value);
                this.store.getSamplerController()?.setTrackVolume?.(this.trackId, value);
                break;
            case 'pan':
                this.store.getAudioEngine().setTrackPan(this.trackId, value);
                break;
            case 'muted':
                if (isMuted !== undefined) {
                    this.store.getAudioEngine().setTrackMute(this.trackId, isMuted);
                    this.store.getSoundfontController()?.muteTrack?.(this.trackId, isMuted);
                    this.store.getSamplerController()?.muteTrack?.(this.trackId, isMuted);
                }
                break;
        }
        
        const updateData = { [this.parameter]: this.parameter === 'muted' ? isMuted : value };
        if(this.parameter === 'muted') updateData.mute = isMuted;
        this.get().updateTrackState(this.trackId, updateData);
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
 * Action for resizing a track (including trim operations)
 */
export class TrackResizeAction extends TrackAction {
    readonly type = 'TRACK_RESIZE';
    private oldTrimStartTicks: number;
    private oldTrimEndTicks: number;
    private oldPositionX: number;
    private newTrimStartTicks: number;
    private newTrimEndTicks: number;
    private newPositionX: number;
    
    constructor(
        get: GetFn,
        trackId: string,
        oldTrimStartTicks: number,
        oldTrimEndTicks: number,
        oldPositionX: number,
        newTrimStartTicks: number,
        newTrimEndTicks: number,
        newPositionX: number
    ) {
        super(get, trackId);
        this.oldTrimStartTicks = oldTrimStartTicks;
        this.oldTrimEndTicks = oldTrimEndTicks;
        this.oldPositionX = oldPositionX;
        this.newTrimStartTicks = newTrimStartTicks;
        this.newTrimEndTicks = newTrimEndTicks;
        this.newPositionX = newPositionX;
    }
    
    private updateTrackResize(
        trimStartTicks: number,
        trimEndTicks: number,
        positionXTicks: number,
        operation: string
    ): void {
        const currentY = this.get().findTrackById(this.trackId)?.y_position ?? 0;
        this.get().updateTrackState(this.trackId, {
            trim_start_ticks: trimStartTicks,
            trim_end_ticks: trimEndTicks,
            x_position: positionXTicks, 
            position: { x: positionXTicks, y: currentY }
        });
        
        this.store.getAudioEngine().setTrackTrim(this.trackId, trimStartTicks, trimEndTicks);
        this.store.getAudioEngine().setTrackPosition(
            this.trackId, 
            positionXTicks,
            currentY
        );
        
        const isCurrentlyPlaying = this.get().isPlaying;
        if (isCurrentlyPlaying && this.store.getTransport().handleTrackPositionChange) {
            this.store.getTransport().handleTrackPositionChange(this.trackId, positionXTicks);
        }
    }
    
    async execute(): Promise<void> {
        this.updateTrackResize(
            this.newTrimStartTicks,
            this.newTrimEndTicks,
            this.newPositionX,
            'execute'
        );
        
        this.log('Execute', { 
            trackId: this.trackId, 
            from: {
                trimStartTicks: this.oldTrimStartTicks,
                trimEndTicks: this.oldTrimEndTicks,
                positionX: this.oldPositionX
            }, 
            to: {
                trimStartTicks: this.newTrimStartTicks,
                trimEndTicks: this.newTrimEndTicks,
                positionX: this.newPositionX
            },
            isCurrentlyPlaying: this.get().isPlaying
        });
    }
    
    async undo(): Promise<void> {
        this.updateTrackResize(
            this.oldTrimStartTicks,
            this.oldTrimEndTicks,
            this.oldPositionX,
            'undo'
        );
        
        this.log('Undo', { 
            trackId: this.trackId, 
            from: {
                trimStartTicks: this.newTrimStartTicks,
                trimEndTicks: this.newTrimEndTicks,
                positionX: this.newPositionX
            }, 
            to: {
                trimStartTicks: this.oldTrimStartTicks,
                trimEndTicks: this.oldTrimEndTicks,
                positionX: this.oldPositionX
            },
            isCurrentlyPlaying: this.get().isPlaying
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
    ParameterChange: ParameterChangeAction,
    TrackResize: TrackResizeAction
};