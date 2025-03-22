import * as Tone from 'tone';
import AudioEngine from '../audio-engine/audioEngine';
import { calculatePositionTime } from '../../constants/gridConstants';

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
    private isStarting: boolean = false;
    private maxPosition: number = 3600;  // Default to 1 hour (3600 seconds) as safety
    private static FADE_TIME = 0.01; // 10ms fade

    constructor() {
        this.audioEngine = AudioEngine.getInstance();
        Tone.getTransport().bpm.value = 120;
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
                        
                        // Set volume to normal first
                        track.player.volume.value = track.muted ? -Infinity : track.volume;
                        
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
                        
                        const eventId = Tone.Transport.schedule(time => {
                            try {
                                // Explicitly check player state before starting
                                if (track.player?.state !== "started") {
                                    // Start from beginning of the track at the scheduled time
                                    // We use start(time, 0) because at this point, we're starting the track
                                    // from its beginning (0 seconds into the audio)
                                    track.player?.start(time, 0);
                                    
                                    // Fade in volume
                                    track.player.volume.value = -Infinity;
                                    track.player.volume.rampTo(track.muted ? -Infinity : track.volume, TransportController.FADE_TIME);
                                    
                                    console.log(`Track ${track.id} started at scheduled time ${time}`);
                                } else {
                                    console.warn(`Track ${track.id} already playing, skipping scheduled start`);
                                }
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
            Tone.Transport.clear(id);
        });
        this.scheduledEvents = [];
    }

    public pause(): void {
        console.log('Pausing playback at position:', this.position);
        
        // Clear any scheduled events
        this.clearScheduledEvents();
        
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

    public stop(): void {
        console.log('Stopping transport and resetting position to 0');
        this.isStarting = false; // Reset starting state
        
        // Clear any scheduled events
        this.clearScheduledEvents();
        
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
        
        console.log(`Seeking from ${prevPosition}s to ${position}s (delta: ${position - prevPosition}s)`);
        
        // CRITICAL FIX ORDER:
        // 1. First pause the transport to stop scheduling
        Tone.getTransport().pause();
        
        // 2. Clear any scheduled events
        this.clearScheduledEvents();
        
        // 3. Completely tear down all players - this is crucial for reliable seeking
        this.audioEngine.getAllTracks().forEach(track => {
            if (track.player) {
                // Ensure player is fully stopped
                if (track.player.state === "started") {
                    track.player.stop();
                }
                // CRITICAL: Ensure player is completely unsynced
                track.player.unsync();
                
                // Reset volume to normal to avoid issues with volume ramps
                track.player.volume.cancelScheduledValues(Tone.now());
                track.player.volume.value = track.muted ? -Infinity : track.volume;
            }
        });
        
        // 4. Set the transport position only after all players are cleaned up
        Tone.getTransport().seconds = position;
        
        console.log(`Transport position set to ${position}s, actual: ${Tone.getTransport().seconds}s`);
        
        // If was playing, restart with the new position after a more reliable delay
        if (wasPlaying) {
            // Use a larger timeout to ensure Tone.js internal state is fully updated
            setTimeout(() => {
                console.log(`Restarting playback after seeking, transport position: ${Tone.getTransport().seconds}s`);
                this.play();
            }, 50); // Increased timeout for reliability
        }
    }

    public setTempo(bpm: number): void {
        // Add bounds checking
        const validBpm = Math.max(20, Math.min(bpm, 300));
        Tone.getTransport().bpm.value = validBpm;
    }

    public dispose(): void {
        this.stop();
        Tone.getTransport().dispose();
    }

    public async loadAudioFile(trackId: string, file: File): Promise<void> {
        try {
            await this.audioEngine.createTrack(trackId, file);
            
            const track = this.audioEngine.getAllTracks().find(t => t.id === trackId);
            if (!track?.player) {
                throw new Error(`Failed to create player for track ${trackId}`);
            }

            // Safely access buffer duration
            const duration = track.player.buffer?.duration ?? 0;
            this.maxPosition = Math.max(this.maxPosition, duration);
        } catch (error) {
            console.error(`Failed to load audio file for track ${trackId}:`, error);
            throw error; // Re-throw to let caller handle the error
        }
    }

    public removeTrack(trackId: string): void {
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
    public handleTrackPositionChange(trackId: string, newPositionX: number): void {
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