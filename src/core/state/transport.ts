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
            this.audioEngine.getAllTracks().forEach(track => {
                if (track.player) {
                    track.player.sync();
                    track.player.seek(currentPosition);
                    track.player.volume.value = -Infinity;
                    track.player.volume.rampTo(0, TransportController.FADE_TIME);
                }
            });

            Tone.getTransport().start();

            this.audioEngine.getAllTracks().forEach(track => {
                if (track.player) {
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
        // Fade out before stopping
        this.audioEngine.getAllTracks().forEach(track => {
            if (track.player) {
                track.player.volume.rampTo(-Infinity, TransportController.FADE_TIME);
            }
        });

        // Wait for fade before stopping
        setTimeout(() => {
            this.audioEngine.stopAllPlayback();
            Tone.getTransport().pause();
        }, TransportController.FADE_TIME * 1000);
    }

    public stop(): void {
        this.isStarting = false; // Reset starting state
        // Stop players first with fade out
        this.audioEngine.getAllTracks().forEach(track => {
            if (track.player) {
                track.player.volume.rampTo(-Infinity, TransportController.FADE_TIME);
            }
        });

        setTimeout(() => {
            this.audioEngine.stopAllPlayback();
            Tone.getTransport().stop();
            Tone.getTransport().seconds = 0;
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