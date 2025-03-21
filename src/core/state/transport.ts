import * as Tone from 'tone';
import AudioEngine from '../audio-engine/audioEngine';

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
    private maxPosition: number = 0;  // Track the maximum position
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

    public async play(): Promise<void> {
        if (this.isStarting) return;
        this.isStarting = true;

        try {
            await Tone.start();
            
            // Ensure all players are at the correct position
            const currentPosition = this.position;
            console.log(`Starting playback at position: ${currentPosition}s`);
            
            this.audioEngine.getAllTracks().forEach(track => {
                if (track.player) {
                    // Make sure player is synced to transport
                    track.player.sync();
                    
                    // Ensure it's at the right position
                    track.player.seek(currentPosition);
                    
                    // Set volume for fade-in
                    track.player.volume.value = -Infinity;
                    track.player.volume.rampTo(track.muted ? -Infinity : track.volume, TransportController.FADE_TIME);
                    
                    console.log(`Prepared player for track ${track.id}, state: ${track.player.state}`);
                }
            });

            // Start transport first
            Tone.getTransport().start();
            console.log('Transport started');

            // Check if players need to be started explicitly
            this.audioEngine.getAllTracks().forEach(track => {
                if (track.player && track.player.state !== "started") {
                    console.log(`Starting player for track ${track.id}`);
                    track.player.start();
                }
            });
        } catch (error) {
            console.error('Error starting playback:', error);
            this.stop();
        } finally {
            this.isStarting = false;
        }
    }

    public pause(): void {
        console.log('Pausing playback at position:', this.position);
        
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
            
            // Use the special pause method that doesn't stop the players
            this.audioEngine.pauseAllPlayback();
            
            console.log('Transport: Paused at position', currentPosition);
        }, TransportController.FADE_TIME * 1000);
    }

    public stop(): void {
        console.log('Stopping transport and resetting position to 0');
        this.isStarting = false; // Reset starting state
        
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
            
            // Ensure all players are synced and reset to position 0
            this.audioEngine.getAllTracks().forEach(track => {
                if (track.player) {
                    // Re-sync with transport to ensure proper future playback
                    track.player.sync();
                    
                    // Reset position to 0
                    track.player.seek(0);
                    
                    console.log(`Reset player for track ${track.id} to position 0`);
                }
            });
            
            console.log('Transport: Successfully reset to position 0');
        }, TransportController.FADE_TIME * 1000);
    }

    public seek(position: number): void {
        // Bounds checking
        position = Math.max(0, Math.min(position, this.maxPosition));
        
        const wasPlaying = this.isPlaying;
        
        // Stop all playback immediately
        this.audioEngine.stopAllPlayback();
        Tone.getTransport().pause();
        
        // Update all player positions
        this.audioEngine.getAllTracks().forEach(track => {
            if (track.player) {
                track.player.seek(position);
            }
        });
        
        Tone.getTransport().seconds = position;
        
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
        // Just an alias for seek
        this.seek(position);
    }
}