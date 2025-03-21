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
            
            // Log current global position
            const transportPosition = this.position;
            console.log(`Starting playback at transport position: ${transportPosition}s`);
            
            // Stop any currently playing tracks to start fresh
            this.audioEngine.getAllTracks().forEach(track => {
                if (track.player && track.player.state === "started") {
                    track.player.stop();
                }
            });
            
            // Process each track with its specific timeline position
            this.audioEngine.getAllTracks().forEach(track => {
                if (!track.player) return;
                
                // Get track's UI X position (defaulting to 0 if not set)
                const trackX = track.position?.x || 0;
                
                // Get the track's start offset in seconds
                const trackOffset = this.getTrackTimeOffset(trackX);
                
                // Calculate the correct position within the track's audio
                const trackPlayTime = transportPosition - trackOffset;
                
                // Unsync the player to reset any previous state
                track.player.unsync();
                
                if (trackPlayTime >= 0) {
                    // Track should play immediately from an offset position
                    console.log(`Track ${track.id} starting now from position ${trackPlayTime}s (offset: ${trackOffset}s)`);
                    
                    // Use the proper Tone.js pattern: sync and specify offset in start
                    // This is the key improvement - using start with offset instead of seek
                    track.player.sync().start(0, trackPlayTime);
                    
                    // Set volume for fade-in (separate from playback control)
                    track.player.volume.value = -Infinity;
                    track.player.volume.rampTo(track.muted ? -Infinity : track.volume, TransportController.FADE_TIME);
                } else {
                    // Track shouldn't play yet - schedule it for future playback
                    const startDelaySeconds = Math.abs(trackPlayTime);
                    console.log(`Track ${track.id} will start in ${startDelaySeconds}s (at transport time ${trackOffset}s)`);
                    
                    // Schedule this track to start at the right time
                    const eventId = Tone.Transport.schedule(time => {
                        // Start from beginning of the track at the scheduled time
                        track.player?.start(time, 0);
                        
                        // Fade in volume
                        track.player.volume.value = -Infinity;
                        track.player.volume.rampTo(track.muted ? -Infinity : track.volume, TransportController.FADE_TIME);
                        
                        console.log(`Track ${track.id} started at scheduled time ${time}`);
                    }, `+${startDelaySeconds}`);
                    
                    // Store event ID for cleanup when stopping/seeking
                    this.scheduledEvents.push(eventId);
                }
                
                console.log(`Prepared player for track ${track.id}, position: ${trackX}px`);
            });

            // Start transport
            Tone.getTransport().start();
            console.log('Transport started');
        } catch (error) {
            console.error('Error starting playback:', error);
            this.stop();
        } finally {
            this.isStarting = false;
        }
    }
    
    // Clear any scheduled events (called when stopping, seeking, or starting playback)
    private clearScheduledEvents(): void {
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
        
        // Stop all playback immediately and clear scheduled events
        this.clearScheduledEvents();
        this.audioEngine.stopAllPlayback();
        Tone.getTransport().pause();
        
        // Set the global transport position
        Tone.getTransport().seconds = position;
        
        // We don't need to specifically set track positions here
        // because the play() method will handle that when restarted
        console.log(`Seeking to position ${position}s`);
        
        // If was playing, restart with the new position 
        if (wasPlaying) {
            // Use a small timeout to avoid audio glitches
            setTimeout(() => this.play(), 16);
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
}