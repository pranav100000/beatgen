import * as Tone from 'tone';
import AudioFilePlayer from '../audio-engine/audioFilePlayer/audioEngine';
import { convertVolumeToDecibels } from '../../utils/audioProcessing';
import { calculatePositionTime } from '../../constants/gridConstants';
import { SoundfontEngineController } from '../audio-engine/soundfontEngineController';
import { SamplerController } from '../audio-engine/samplerController';

export interface Transport {
    position: number;        // Current playback position
    isPlaying: boolean;
    tempo: number;
    
    play(): Promise<void>;
    pause(): void;
    stop(): void;
    seek(position: number): void;
    setPosition(position: number): void;  // Alias for seek for better naming
}

export class TransportController implements Transport {
    private audioEngine: AudioFilePlayer;
    private soundfontController: SoundfontEngineController;
    private samplerController: SamplerController;
    private isStarting: boolean = false;
    private maxPosition: number = 3600;  // Default to 1 hour (3600 seconds) as safety
    private static FADE_TIME = 0.01; // 10ms fade

    constructor() {
        this.audioEngine = AudioFilePlayer.getInstance();
        Tone.getTransport().bpm.value = 120;
        this.soundfontController = new SoundfontEngineController();
        this.samplerController = new SamplerController();
        
        // We'll initialize the soundfont controller later when the audio context is available
        // This happens in the Store's initializeAudio method via initializeSoundfont
    }

    get position(): number {
        return Tone.getTransport().seconds;
    }

    get isPlaying(): boolean {
        return Tone.getTransport().state === 'started';
    }

    get tempo(): number {
        return Tone.getTransport().bpm.value;
    }

    getSoundfontController(): SoundfontEngineController {
        return this.soundfontController;
    }
    
    getSamplerController(): SamplerController {
        return this.samplerController;
    }

    getAudioEngine(): AudioFilePlayer {
        return this.audioEngine;
    }
    
    /**
     * Converts a track's position (in ticks) to a time offset (in seconds)
     * This is crucial for properly aligning tracks on the timeline
     * 
     * @param trackXTicks Position in ticks
     * @returns Time offset in seconds
     */
    private getTrackTimeOffset(trackXTicks: number): number {
        // First convert ticks to beats
        const ppq = 480; // Standard MIDI ticks per quarter note
        const beats = trackXTicks / ppq;
        
        // Then convert beats to seconds based on current BPM
        const bpm = Tone.getTransport().bpm.value;
        const secondsPerBeat = 60 / bpm;
        
        return beats * secondsPerBeat;
    }
    
    /**
     * Calculates the correct playback time for a track based on:
     * 1. Current transport position
     * 2. Track's position on the timeline
     * 
     * @param transportTime Global transport time in seconds
     * @param trackXTicks The track's X position in ticks
     * @returns The adjusted playback position in seconds
     */
    private calculateTrackPlayPosition(transportTime: number, trackXTicks: number): number {
        // Get track's start time offset based on its position
        const trackOffset = this.getTrackTimeOffset(trackXTicks);
        
        // Cases:
        // 1. If transport < trackOffset: track shouldn't play yet (return negative to indicate this)
        // 2. If transport >= trackOffset: track should play at (transport - trackOffset)
        
        if (transportTime < trackOffset) {
            // Track shouldn't be playing yet
            return -1;
        } else {
            // Calculate time position within the track
            return transportTime - trackOffset;
        }
    }

    // Track the IDs of scheduled events so we can clean them up
    private scheduledEvents: number[] = [];
    
    public async play(): Promise<void> {
        if (this.isStarting) return;
        this.isStarting = true;

        try {
            await Tone.start();
            
            // Clear any previously scheduled events
            this.clearScheduledEvents();
            
            // CRITICAL: Get the EXACT transport position right before playback starts
            // This ensures we're using the most current position for calculations
            // Using 'let' instead of 'const' since we might need to update this if it changes
            let transportPosition = Tone.getTransport().seconds;
            console.log(`Starting playback at transport position: ${transportPosition}s`);
            
            // Ensure all players are completely reset before starting new playback
            this.audioEngine.getAllTracks().forEach(track => {
                if (track.player) {
                    // Always stop and unsync ALL players before starting playback
                    if (track.player.state === "started") {
                        track.player.stop();
                    }
                    // CRITICAL: Ensure completely unsynced
                    track.player.unsync();
                    
                    // Cancel any volume ramps
                    track.player.volume.cancelScheduledValues(Tone.now());
                }
            });
            
            // Process each track with its specific timeline position
            this.audioEngine.getAllTracks().forEach(track => {
                if (!track.player) return;
                
                try {
                    const trackXTicks = track.position?.x || 0;
                    
                    // Get track's trim settings if available
                    const hasTrimSettings = 
                        track.player && 
                        (track.player as any)._trimSettings && 
                        (track.player as any)._trimSettings.trimEnabled;
                    
                    // Calculate the offset when this track should start playing
                    // Standard offset based on track position in ticks
                    const trackPositionOffset = this.getTrackTimeOffset(trackXTicks);
                    
                    // If trim settings exist, adjust playback accordingly
                    if (hasTrimSettings) {
                        const trimSettings = (track.player as any)._trimSettings;
                        console.log(`Scheduling trimmed track ${track.id}:`, trimSettings);
                        
                        // Clean start and sync of player
                        if (track.player.state === "started") {
                            track.player.stop();
                        }
                        track.player.unsync();
                        
                        // Calculate how much time has passed since the transport position
                        const effectiveStartTime = Math.max(0, transportPosition - trackPositionOffset);
                        
                        // Check if we should skip ahead in the trimmed audio
                        const trimStartSec = trimSettings.trimStartSeconds;
                        const trimEndSec = trimSettings.trimEndSeconds;
                        const trimmedDuration = trimEndSec - trimStartSec;
                        
                        if (effectiveStartTime <= 0) {
                            // Normal start from beginning of trimmed region
                            console.log(`Starting trimmed track ${track.id} from beginning of trim`);
                            // Set start position to trim start and sync playback
                            track.player.start(0, trimStartSec);
                            track.player.sync();
                        } else if (effectiveStartTime < trimmedDuration) {
                            // Start from a point inside the trimmed region
                            const startOffset = trimStartSec + effectiveStartTime;
                            console.log(`Starting trimmed track ${track.id} from offset ${startOffset}s`);
                            track.player.start(0, startOffset);
                            track.player.sync();
                        } else {
                            // We're past the end of this track - don't schedule
                            console.log(`Transport position ${transportPosition}s is past end of trimmed track ${track.id}`);
                        }
                    } else {
                        // Normal scheduling for untrimmed tracks - existing code path
                        console.log(`Scheduling untrimmed track ${track.id} with offset ${trackPositionOffset}s`);
                        
                        // Clean start and sync of player
                        if (track.player.state === "started") {
                            track.player.stop();
                        }
                        track.player.unsync();
                        
                        // Sync the player with the transport and set its start position
                        // Only schedule if the track should be playing at this position
                        if (trackPositionOffset <= transportPosition) {
                            const startOffset = Math.max(0, transportPosition - trackPositionOffset);
                            
                            // CRITICAL: We must start the player at the correct offset
                            // This is calculated as the difference between transport position
                            // and the track's own position on the timeline
                            track.player.start(0, startOffset);
                            track.player.sync();
                            
                            console.log(`Track ${track.id} synced, starting at offset ${startOffset}s`);
                        } else {
                            // Track is in the future, don't schedule yet
                            console.log(`Track ${track.id} is in the future, not scheduling yet`);
                        }
                    }
                } catch (error) {
                    console.error(`Error scheduling track ${track.id}:`, error);
                }
            });

            // URGENT FIX: Force a clean Transport start
            // This is critical to ensure correct timing
            const transportWasRunning = Tone.getTransport().state === "started";
            if (transportWasRunning) {
                console.log("Transport was already running, pausing before restart");
                Tone.getTransport().pause();
            }
            
            // Double check transport position is still as expected
            console.log(`Transport position before start: ${Tone.getTransport().seconds}s`);
            
            // Start soundfont player if available
            try {
                console.log('Starting soundfont player');
                await this.getSoundfontController().play();
            } catch (error) {
                console.error('Failed to start soundfont player:', error);
            }
            
            // Start sampler tracks
            try {
                console.log('Starting sampler tracks');
                const bpm = Tone.Transport.bpm.value; // Get current BPM
                await this.getSamplerController().play(transportPosition, bpm);
            } catch (error) {
                console.error('Failed to start sampler tracks:', error);
            }
            
            // Start transport with a clean slate
            Tone.getTransport().start();
            console.log('Transport started, state:', Tone.getTransport().state);
        } catch (error) {
            console.error('Error starting playback:', error);
            this.stop();
        } finally {
            this.isStarting = false;
        }
    }
    
    // Clear any scheduled events (called when stopping, seeking, or starting playback)
    private clearScheduledEvents(): void {
        console.log(`Clearing all scheduled events (${this.scheduledEvents.length})`);
        this.scheduledEvents.forEach(id => {
            Tone.getTransport().clear(id);
        });
        this.scheduledEvents = [];
    }

    public pause(): void {
        console.log('Pausing playback at position:', this.position);
        
        // Clear any scheduled events
        this.clearScheduledEvents();
        
        // Pause soundfont player if available
        try {
            console.log('Pausing soundfont player');
            this.getSoundfontController().pause();
        } catch (error) {
            console.error('Failed to pause soundfont player:', error);
        }
        
        // Pause sampler tracks
        try {
            console.log('Pausing sampler tracks');
            this.getSamplerController().pause();
        } catch (error) {
            console.error('Failed to pause sampler tracks:', error);
        }
        
        // Fade out before stopping
        this.audioEngine.getAllTracks().forEach(track => {
            if (track.player) {
                track.player.volume.rampTo(-Infinity, TransportController.FADE_TIME);
            }
        });

        // Save current position for reference
        const currentPosition = this.position;

        // Wait for fade before pausing
        setTimeout(() => {
            // Pause the transport first (doesn't reset position)
            Tone.getTransport().pause();
            
            // Stop all playing players to ensure clean state
            this.audioEngine.getAllTracks().forEach(track => {
                if (track.player && track.player.state === "started") {
                    track.player.stop();
                    // Important: unsync players when pausing to prevent state confusion
                    track.player.unsync();
                }
            });
            
            console.log('Transport: Paused at position', currentPosition);
        }, TransportController.FADE_TIME * 1000);
    }

    public async stop(): Promise<void> {
        console.log('Stopping transport and resetting position to 0');
        this.isStarting = false; // Reset starting state
        
        // Clear any scheduled events
        this.clearScheduledEvents();
        
        // Stop soundfont player if available
        if (this.getSoundfontController()) {
            try {
                console.log('Stopping soundfont player at position', this.position);
                await this.getSoundfontController().stop();
            } catch (error) {
                console.error('Failed to stop soundfont player:', error);
            }
        }
        
        // Stop sampler tracks
        try {
            console.log('Stopping sampler tracks at position', this.position);
            await this.getSamplerController().stop();
        } catch (error) {
            console.error('Failed to stop sampler tracks:', error);
        }
        
        // Stop players first with fade out
        this.audioEngine.getAllTracks().forEach(track => {
            if (track.player) {
                track.player.volume.rampTo(-Infinity, TransportController.FADE_TIME);
            }
        });

        setTimeout(() => {
            // First stop the Transport so no more scheduling happens
            Tone.getTransport().stop();
            
            // Then reset transport position to 0
            Tone.getTransport().seconds = 0;
            
            // Now stop all audio playback
            this.audioEngine.stopAllPlayback();
            
            // Prepare players for future playback - completely reset their state
            this.audioEngine.getAllTracks().forEach(track => {
                if (track.player) {
                    // Unsync to clear any previous state
                    track.player.unsync();
                    
                    // No need to seek here - we'll handle positioning when play is called
                    console.log(`Reset player for track ${track.id}`);
                }
            });
            
            console.log('Transport: Successfully reset to position 0');
        }, TransportController.FADE_TIME * 1000);
    }

    public seek(position: number): void {
        // Bounds checking
        position = Math.max(0, Math.min(position, this.maxPosition));
        
        const wasPlaying = this.isPlaying;
        const prevPosition = this.position;
        
        console.log(`SEEKING: From ${prevPosition}s to ${position}s (delta: ${position - prevPosition}s)`);
        
        // COMPLETELY RESET EVERYTHING
        
        // 1. First stop the Transport entirely
        // This is more aggressive than pause and ensures a clean slate
        Tone.getTransport().stop();
        
        // 2. Clear all scheduled events
        this.clearScheduledEvents();
        
        // 3. Seek in soundfont player if available
        try {
            console.log(`Seeking soundfont player to ${position}s`);
            this.getSoundfontController().seek(position * 1000);
        } catch (error) {
            console.error('Failed to seek soundfont player:', error);
        }
        
        // 3b. Handle seeking sampler tracks
        try {
            console.log(`Seeking sampler tracks to ${position}s`);
            
            // Get current BPM for timing calculations
            const bpm = Tone.Transport.bpm.value;
            
            // Seek the sampler controller
            this.getSamplerController().seek(position, bpm);
        } catch (error) {
            console.error('Failed to seek sampler tracks:', error);
        }
        
        // 4. Completely reset all players
        this.audioEngine.getAllTracks().forEach(track => {
            if (track.player) {
                // Ensure player is fully stopped
                if (track.player.state === "started") {
                    track.player.stop();
                }
                
                // Completely reset player state
                track.player.unsync();
                
                // Clear any volume automations
                track.player.volume.cancelScheduledValues(Tone.now());
                // Set volume using our conversion utility
                track.player.volume.value = convertVolumeToDecibels(track.volume, track.muted);
            }
        });
        
        // 5. Set the Transport position with a clean state
        // Because we completely stopped the transport, this should be reliable
        Tone.getTransport().seconds = position;
        
        // Double check that it actually set correctly
        console.log(`Transport position set to ${position}s, verified: ${Tone.getTransport().seconds}s`);
        
        if (Math.abs(Tone.getTransport().seconds - position) > 0.001) {
            console.warn("Transport position didn't set properly - forcing again");
            Tone.getTransport().seconds = position;
        }
        
        // If was playing, restart with the new position
        if (wasPlaying) {
            // Use a small delay to ensure Tone.js state is updated
            // This is a crucial step to ensure reliable seeking
            setTimeout(() => {
                console.log(`Restarting playback from position: ${Tone.getTransport().seconds}s`);
                this.play(); 
            }, 30); // 30ms is a good compromise
        }
    }

    public setTempo(bpm: number): void {
        // Add bounds checking
        const validBpm = Math.max(1, Math.min(bpm, 999));
        Tone.getTransport().bpm.value = validBpm;
        this.soundfontController.setGlobalBPM(validBpm);
        
        // Update BPM for sampler tracks if they are playing
        if (this.isPlaying) {
            const currentPosition = this.position;
            this.samplerController.seek(currentPosition, validBpm);
        }
    }

    public dispose(): void {
        this.stop();
        Tone.getTransport().dispose();
    }

    public async loadAudioFile(trackId: string, file: File, position?: { x: number, y: number }): Promise<void> {
        try {
            await this.audioEngine.createTrack(trackId, file.name, file);
            
            const track = this.audioEngine.getAllTracks().find(t => t.id === trackId);
            if (!track?.player) {
                throw new Error(`Failed to create player for track ${trackId}`);
            }

            // Safely access buffer duration
            const duration = track.player.buffer?.duration ?? 0;
            this.maxPosition = Math.max(this.maxPosition, duration);
            
            // If position is provided, set it in the AudioEngine
            if (position) {
                console.log(`TransportController: Setting track ${trackId} position to x:${position.x}, y:${position.y}`);
                this.audioEngine.setTrackPosition(trackId, position.x, position.y);
            }
        } catch (error) {
            console.error(`Failed to load audio file for track ${trackId}:`, error);
            throw error; // Re-throw to let caller handle the error
        }
    }

    public removeTrack(trackId: string): void {
        // Clean up sampler if this is a sampler track
        try {
            console.log(`Cleaning up any sampler resources for track ${trackId}`);
            this.samplerController.removeSampler(trackId);
        } catch (error) {
            console.error(`Error cleaning up sampler for track ${trackId}:`, error);
        }
        
        // Recalculate maxPosition when a track is removed
        this.maxPosition = Math.max(
            0,
            ...this.audioEngine.getAllTracks()
                .filter(t => t.id !== trackId)
                .map(t => t.player?.buffer?.duration ?? 0)
        );
    }
    
    public setPosition(position: number): void {
        // Just an alias for seek - make sure we pass the position value directly
        this.seek(position);
    }
    
    /**
     * Handle track position changes during playback
     * This recalculates and adjusts the playback for a specific track that was moved
     * 
     * @param trackId The ID of the track being moved
     * @param newPositionXTicks The new X position in ticks
     * @param type Optional type parameter
     */
    public handleTrackPositionChange(trackId: string, newPositionXTicks: number, type?: string): void {
        // Only do anything if we're playing
        if (!this.isPlaying) {
            console.log(`Track ${trackId} position changed, but not playing - no action needed`);
            return;
        }
        
        // Find the track
        const track = this.audioEngine.getAllTracks().find(t => t.id === trackId);
        if (!track || !track.player) {
            console.log(`Track ${trackId} not found or has no player`);
            return;
        }
        
        console.log(`Handling position change for track ${trackId} to x:${newPositionXTicks} ticks during playback`);
        
        // CRITICAL: This function needs to stop and restart ALL tracks to ensure proper synchronization
        // This is because Tone.js transport synchronization doesn't support repositioning individual tracks
        
        // 1. Capture current global transport position
        const currentPosition = this.position;
        
        // 2. Stop all playback by using the seek method, which properly handles the transport
        console.log(`Pausing playback at ${currentPosition}s and recalculating all tracks`);
        
        // To prevent an infinite loop when the seek itself triggers player updates,
        // we need to temporarily disable the transport
        const wasPlaying = this.isPlaying;
        
        // Stop all playback immediately and clear scheduled events
        this.clearScheduledEvents();
        
        // Stop all players and unsync them
        this.audioEngine.getAllTracks().forEach(t => {
            if (t.player) {
                if (t.player.state === "started") {
                    t.player.stop();
                }
                t.player.unsync();
            }
        });
        
        // Pause the transport
        Tone.getTransport().pause();
        
        // Set the global transport position
        Tone.getTransport().seconds = currentPosition;
        
        // Now restart if needed
        if (wasPlaying) {
            // Use setTimeout to allow the UI to update before restarting
            setTimeout(() => {
                console.log(`Restarting playback at position ${currentPosition}s with new track positions`);
                this.play();
            }, 20); // Small delay to ensure clean restart
        }
    }
}