import * as Tone from 'tone';
import AudioEngine from '../audio-engine/audioEngine';
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
    private audioEngine: AudioEngine;
    private soundfontController: SoundfontEngineController;
    private samplerController: SamplerController;
    private isStarting: boolean = false;
    private maxPosition: number = 3600;  // Default to 1 hour (3600 seconds) as safety
    private static FADE_TIME = 0.01; // 10ms fade

    constructor() {
        this.audioEngine = AudioEngine.getInstance();
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

    getAudioEngine(): AudioEngine {
        return this.audioEngine;
    }
    
    /**
     * Converts a track's UI position (in pixels) to a time offset (in seconds)
     * This is crucial for properly aligning tracks on the timeline
     */
    private getTrackTimeOffset(trackX: number): number {
        // Using the grid utilities to convert pixel position to time
        // This ensures consistency between UI representation and audio timing
        return calculatePositionTime(trackX, Tone.getTransport().bpm.value);
    }
    
    /**
     * Calculates the correct playback time for a track based on:
     * 1. Current transport position
     * 2. Track's position on the timeline
     * 
     * @param transportTime Global transport time
     * @param trackX The track's X position in pixels
     * @returns The adjusted playback position in seconds
     */
    private calculateTrackPlayPosition(transportTime: number, trackX: number): number {
        // Get track's start time offset based on its position
        const trackOffset = this.getTrackTimeOffset(trackX);
        
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
                
                // Get track's UI X position (defaulting to 0 if not set)
                const trackX = track.position?.x || 0;
                
                // Get the track's start offset in seconds (where it sits on the timeline)
                const trackOffset = this.getTrackTimeOffset(trackX);
                
                // Get the most current transport position directly from Tone.js
                // This is crucial for accurate timing
                transportPosition = Tone.getTransport().seconds;
                
                // SIMPLIFIED FIX: We want to know if the track should be playing now and if so, from what offset
                const trackPlayTime = transportPosition - trackOffset;
                
                console.log(`URGENT DEBUG - Track ${track.id} position calculation:`, {
                    formula: `transportPosition (${transportPosition}s) - trackOffset (${trackOffset}s) = trackPlayTime (${trackPlayTime}s)`,
                    trackX: trackX,
                    transportPositionSource: "direct from Tone.Transport.seconds",
                    trackPlayTimeExplanation: trackPlayTime >= 0 
                      ? `Play track from ${trackPlayTime}s offset` 
                      : `Schedule track to start in ${Math.abs(trackPlayTime)}s`
                });
                
                // We already unsynced all players at the start of this method
                // No need to unsync again here, which could cause issues
                
                // Detailed debug logging for track timing calculations
                console.log(`Track ${track.id} timing calculations:`, {
                    transportPosition,
                    trackX,
                    trackOffset,
                    trackPlayTime,
                    formula: `${transportPosition}s - ${trackOffset}s = ${trackPlayTime}s`
                });
                
                if (trackPlayTime >= 0) {
                    // Track should play immediately from an offset position
                    console.log(`Track ${track.id} starting now from position ${trackPlayTime}s (offset: ${trackOffset}s)`);
                    
                    try {
                        // URGENT FIX: Going back to the absolute simplest pattern
                        // We need to ensure the player is 100% in the correct state
                        if (track.player.state === "started") {
                            track.player.stop();
                        }
                        
                        // Completely reset the player
                        track.player.unsync();
                        
                        // Set volume using our conversion utility
                        track.player.volume.value = convertVolumeToDecibels(track.volume, track.muted);
                        
                        // CRITICAL FIX: There may be a bug in our usage of the sync()/start() pattern
                        // Let's try a different approach with explicit start timing
                        console.log(`REVISED APPROACH: Starting track ${track.id} from ${trackPlayTime}s`);
                        
                        // Do NOT sync first - instead set up the player with its offset
                        // Then start the player RIGHT NOW with the correct offset
                        // This is the most direct approach
                        track.player.start("+0", trackPlayTime);
                        
                        // Then sync AFTER starting - this allows us to directly control the start time
                        // while still having future transport control (pause, etc.)
                        track.player.sync();
                        
                        console.log(`Successfully started track ${track.id} at offset ${trackPlayTime}s`);
                    } catch (error) {
                        console.error(`Error starting track ${track.id}:`, error);
                    }
                } else {
                    // Track shouldn't play yet - schedule it for future playback
                    const startDelaySeconds = Math.abs(trackPlayTime);
                    console.log(`Track ${track.id} will start in ${startDelaySeconds}s (at transport time ${trackOffset}s)`);
                    
                    try {
                        // CRITICAL FIX: Explicitly unsync before scheduling
                        // This ensures a clean state for the player
                        track.player.unsync();
                        
                        // Schedule this track to start at the right time
                        // Add a tiny safety buffer to avoid timing conflicts
                        const safetyBuffer = 0.01; // 10ms buffer for reliability
                        const scheduleTime = `+${startDelaySeconds + safetyBuffer}`;
                        
                        console.log(`Scheduling track ${track.id} to start in ${scheduleTime} seconds`);
                        
                        // CRITICAL FIX: Use a simpler, more direct approach
                        // Schedule the track to play from its beginning at the right time
                        const eventId = Tone.Transport.schedule(time => {
                            try {
                                console.log(`EXECUTING SCHEDULE: Track ${track.id} at time ${time}`);
                                
                                // Stop and unsync to be 100% certain of state
                                if (track.player?.state === "started") {
                                    track.player.stop();
                                }
                                track.player?.unsync();
                                
                                // Set volume using our conversion utility
                                track.player.volume.value = convertVolumeToDecibels(track.volume, track.muted);
                                
                                // Explicitly start the player at the scheduled time from the beginning
                                track.player?.start(time, 0);
                                
                                // Sync AFTER starting to ensure future transport control works
                                // This is a crucial ordering detail based on Tone.js behavior
                                track.player?.sync();
                                
                                console.log(`Track ${track.id} started at scheduled time ${time}`);
                            } catch (error) {
                                console.error(`Error starting scheduled track ${track.id}:`, error);
                            }
                        }, scheduleTime);
                        
                        // Store event ID for cleanup when stopping/seeking
                        this.scheduledEvents.push(eventId);
                        
                    } catch (error) {
                        console.error(`Error scheduling track ${track.id}:`, error);
                    }
                }
                
                console.log(`Prepared player for track ${track.id}, position: ${trackX}px`);
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
     */
    public handleTrackPositionChange(trackId: string, newPositionX: number, type?: string): void {
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
        
        console.log(`Handling position change for track ${trackId} to x:${newPositionX}px during playback`);
        
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