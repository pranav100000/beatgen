import MidiSampler from './midiSamplePlayer/sampler';
import { MidiManager } from '../midi/MidiManagerNew';
import { Note } from '../types/note';
import * as Tone from 'tone';

/**
 * Manages all sampler instances and handles communication between the MidiManager,
 * Transport, and individual sampler instances.
 */
export class SamplerController {
    private samplers: Map<string, MidiSampler> = new Map();
    private trackSubscriptions: Map<string, () => void> = new Map();
    // Removed scheduledEvents map
    private readonly DEFAULT_GRAIN_SIZE = 0.1; // 100ms
    private readonly DEFAULT_OVERLAP = 0.1;    // 10% overlap
    private readonly DEFAULT_BASE_NOTE = 60;   // Middle C (C4)
    
    constructor() {
        console.log('SamplerController initialized');
    }
    
    /**
     * Initialize a sampler for a specific track
     * @param trackId The unique track identifier
     * @param file The audio file to use as the sample source
     * @param baseMidiNote The MIDI note that represents the sample's original pitch
     * @param grainSize Granular synthesis grain size (seconds)
     * @param overlap Granular synthesis overlap amount (0-1)
     */
    async initializeSampler(
        trackId: string, 
        file: File | undefined, // Allow file to be undefined
        baseMidiNote: number = this.DEFAULT_BASE_NOTE, 
        grainSize: number = this.DEFAULT_GRAIN_SIZE, 
        overlap: number = this.DEFAULT_OVERLAP
    ): Promise<void> {
        try {
            console.log(`Initializing sampler for track ${trackId}${file ? ' with file ' + file.name : ' (empty)'}`);
            
            const onLog = (message: string) => {
                console.log(`[Sampler ${trackId}] ${message}`);
            };
            
            const onPlaybackStatusChange = (isPlaying: boolean) => {
                // Handle playback status change if needed
            };

            // Clean up any existing sampler for this track
            if (this.samplers.has(trackId)) {
                console.log(`Cleaning up existing sampler for track ${trackId}`);
                const existingSampler = this.samplers.get(trackId);
                existingSampler?.dispose(); // Ensure cleanup of the old instance
                this.samplers.delete(trackId);
            }
            
            // Create new sampler
            const sampler = new MidiSampler(onLog, onPlaybackStatusChange);
            
            // Initialize audio context
            await sampler.initialize();

            // Set base note before potentially loading file
            sampler.setBaseNote(baseMidiNote);
            
            // Load audio file ONLY if it exists
            if (file) {
                console.log(`Loading file ${file.name} for sampler ${trackId}`);
                await sampler.loadAudioFile(file, grainSize, overlap);
            } else {
                console.log(`Skipping file load for empty sampler ${trackId}`);
                // Optionally set default grain/overlap even without file?
                // sampler.setGrainSize(grainSize);
                // sampler.setOverlap(overlap);
            }
            
            // Store sampler with track ID
            this.samplers.set(trackId, sampler);
            
            console.log(`Sampler for track ${trackId} initialized successfully.`);
        } catch (error) {
            console.error(`Failed to initialize sampler for track ${trackId}:`, error);
            throw error; // Re-throw to signal failure
        }
    }
    
    /**
     * Register MIDI updates from MidiManager for a specific track
     * @param trackId The track to subscribe to
     * @param midiManager The MidiManager instance
     */
    registerTrackSubscription(trackId: string, midiManager: MidiManager): void {
        console.log(`Subscribing to updates for sampler track ${trackId}`);
        
        // Unsubscribe from previous subscription if it exists
        if (this.trackSubscriptions.has(trackId)) {
            const unsubscribe = this.trackSubscriptions.get(trackId);
            if (unsubscribe) unsubscribe();
            this.trackSubscriptions.delete(trackId);
        }
        
        // Get the sampler
        const sampler = this.samplers.get(trackId);
        if (!sampler) {
            console.warn(`No sampler found for track ${trackId}, cannot subscribe to MIDI updates`);
            return;
        }
        
        // Subscribe to track updates - this allows real-time updates during editing
        const unsubscribe = midiManager.subscribeToTrack(trackId, (trackId, notes) => {
            console.log(`SamplerController: Notes updated for track ${trackId}, total notes: ${notes.length}`);
            
            // Get the sampler for this track
            const sampler = this.samplers.get(trackId);
            if (sampler) {
                // Directly set the notes on the sampler instance
                sampler.setNotes(notes);
                console.log(`Updated notes for sampler ${trackId} with ${notes.length} notes`);
            } else {
                console.warn(`Cannot update notes: no sampler found for track ${trackId}`);
            }
        });
        
        // Store the unsubscribe function
        this.trackSubscriptions.set(trackId, unsubscribe);
        console.log(`Successfully subscribed to MIDI updates for sampler track ${trackId}`);
    }
    
    /**
     * Play a single note with the sampler - useful for previews
     * @param trackId The track ID
     * @param midiNote The MIDI note number to play
     * @param duration The note duration in seconds
     * @param velocity The note velocity (0-1)
     */
    playNote(trackId: string, midiNote: number, duration: number = 0.5, velocity: number = 0.8): void {
        const sampler = this.samplers.get(trackId);
        if (!sampler) {
            console.warn(`No sampler found for track ${trackId}, cannot play note`);
            return;
        }
        
        sampler.playNote(midiNote, duration, velocity);
    }

    // Removed playNotes method as it duplicates logic better handled within MidiSampler

    /**
     * Update the base MIDI note for a track
     * @param trackId The track ID
     * @param baseMidiNote The new base MIDI note
     */
    setBaseMidiNote(trackId: string, baseMidiNote: number): void {
        const sampler = this.samplers.get(trackId);
        if (!sampler) {
            console.warn(`No sampler found for track ${trackId}, cannot set base MIDI note`);
            return;
        }

        try {
            // Assuming MidiSampler has a setBaseNote method
            sampler.setBaseNote(baseMidiNote);
            console.log(`SamplerController: Set base MIDI note for track ${trackId} to ${baseMidiNote}`);
        } catch (error) {
             console.error(`SamplerController: Error setting base MIDI note for track ${trackId}:`, error);
        }
    }
    
    /**
     * Update the grain size for a track
     * @param trackId The track ID
     * @param grainSize The new grain size in seconds
     */
    setGrainSize(trackId: string, grainSize: number): void {
        const sampler = this.samplers.get(trackId);
        if (!sampler) {
            console.warn(`No sampler found for track ${trackId}, cannot set grain size`);
            return;
        }
        
        sampler.setGrainSize(grainSize);
    }
    
    /**
     * Update the overlap amount for a track
     * @param trackId The track ID
     * @param overlap The new overlap amount (0-1)
     */
    setOverlap(trackId: string, overlap: number): void {
        const sampler = this.samplers.get(trackId);
        if (!sampler) {
            console.warn(`No sampler found for track ${trackId}, cannot set overlap`);
            return;
        }
        
        sampler.setOverlap(overlap);
    }
    
    /**
     * Get a sampler instance by track ID
     * @param trackId The track ID
     * @returns The sampler instance, or undefined if not found
     */
    getSampler(trackId: string): MidiSampler | undefined {
        return this.samplers.get(trackId);
    }
    
    /**
     * Check if a track has a sampler
     * @param trackId The track ID
     * @returns True if the track has a sampler, false otherwise
     */
    hasSampler(trackId: string): boolean {
        return this.samplers.has(trackId);
    }
    
    /**
     * Get all active sampler track IDs
     * @returns Array of track IDs that have active samplers
     */
    getActiveSamplerIds(): string[] {
        return Array.from(this.samplers.keys());
    }

    // Removed clearScheduledEvents method as scheduling is delegated to MidiSampler

    /**
     * Remove a sampler by track ID
     * @param trackId The track ID
     */
    removeSampler(trackId: string): void {
        // Removed call to clearScheduledEvents

        // Unsubscribe from MIDI updates
        if (this.trackSubscriptions.has(trackId)) {
            const unsubscribe = this.trackSubscriptions.get(trackId);
            if (unsubscribe) unsubscribe();
            this.trackSubscriptions.delete(trackId);
        }
        
        // Clean up sampler resources
        const sampler = this.samplers.get(trackId);
        if (sampler) {
            // Properly dispose of all resources
            sampler.dispose();
            // Remove from map
            this.samplers.delete(trackId);
        }
        
        console.log(`Removed sampler for track ${trackId}`);
    }
    
    /**
     * Connect a track to a sampler - following the SoundfontEngineController pattern
     * This initializes the sampler and sets up MidiManager subscription
     * @param trackId The unique track identifier
     * @param file The audio file to use as the sample source
     * @param midiManager The MidiManager instance
     * @param baseMidiNote The MIDI note that represents the sample's original pitch
     * @param grainSize Granular synthesis grain size (seconds)
     * @param overlap Granular synthesis overlap amount (0-1)
     */
    async connectTrackToSampler(
        trackId: string,
        file: File,
        midiManager: MidiManager,
        baseMidiNote: number = this.DEFAULT_BASE_NOTE,
        grainSize: number = this.DEFAULT_GRAIN_SIZE,
        overlap: number = this.DEFAULT_OVERLAP
    ): Promise<void> {
        try {
            console.log(`Connecting track ${trackId} to sampler with file ${file.name}`);
            
            // Initialize the sampler for this track
            await this.initializeSampler(trackId, file, baseMidiNote, grainSize, overlap);
            
            // Ensure the track exists in MidiManager
            if (!midiManager.hasTrack(trackId)) {
                console.log(`Track ${trackId} not found in MidiManager, cannot set up sampler`);
                throw new Error(`Track ${trackId} not found in MidiManager`);
            }
            
            // Subscribe to future updates from MidiManager
            this.registerTrackSubscription(trackId, midiManager);
            
            console.log(`Successfully connected track ${trackId} to sampler`);
        } catch (error) {
            console.error(`Failed to connect track ${trackId} to sampler:`, error);
            throw error;
        }
    }
    
    /**
     * Set the track's position offset
     * @param trackId The track ID
     * @param offset Offset in seconds
     */
    setTrackOffset(trackId: string, offsetMs: number): void {
        console.log(`SamplerController: Setting track ${trackId} offset to ${offsetMs}ms`);
        
        const sampler = this.samplers.get(trackId);
        if (sampler) {
            sampler.setOffset(offsetMs);
        } else {
            console.warn(`Cannot set offset: no sampler found for track ${trackId}`);
        }
    }
    
    /**
     * Set volume for a sampler track
     * @param trackId The track ID
     * @param volume Volume level (0-100)
     */
    setTrackVolume(trackId: string, volume: number): void {
        console.log(`SamplerController: Setting track ${trackId} volume to ${volume}`);
        
        const sampler = this.samplers.get(trackId);
        if (sampler) {
            sampler.setVolume(volume);
        } else {
            console.warn(`Cannot set volume: no sampler found for track ${trackId}`);
        }
    }
    
    /**
     * Set mute state for a sampler track
     * @param trackId The track ID
     * @param muted Whether the track should be muted
     */
    muteTrack(trackId: string, muted: boolean): void {
        console.log(`SamplerController: ${muted ? 'Muting' : 'Unmuting'} track ${trackId}`);
        
        const sampler = this.samplers.get(trackId);
        if (sampler) {
            sampler.setMute(muted);
        } else {
            console.warn(`Cannot set mute: no sampler found for track ${trackId}`);
        }
    }
    
    /**
     * Transport Integration Methods - following SoundfontEngineController pattern
     */
    
    /**
     * Start or resume playback for all active samplers.
     * Delegates actual scheduling and playback to individual MidiSampler instances.
     * @param startTime The transport time to start from (in seconds).
     * @param bpm Current BPM for timing calculations.
     */
    async play(startTime: number = 0, bpm: number = 120): Promise<void> {
        console.log(`SamplerController: Starting playback for all samplers from ${startTime}s`);
        const samplerTracks = this.getActiveSamplerIds();

        for (const trackId of samplerTracks) {
            const sampler = this.samplers.get(trackId);
            if (sampler) {
                try {
                    // Ensure sampler has latest notes (it should via subscription)
                    // const notes = sampler.getNotes(); // Optional: log note count
                    // console.log(`Starting playback for sampler track ${trackId} with ${notes?.length ?? 0} notes`);
                    sampler.playMidi(bpm, startTime); // Delegate playback to the sampler
                } catch (error) {
                    console.error(`SamplerController: Error starting playback for track ${trackId}:`, error);
                }
            }
        }
    }

    /**
     * Pause playback.
     * Note: This relies on Tone.Transport.pause() affecting the underlying samplers.
     * Individual samplers might need explicit pause handling if they don't use Tone.Transport events directly.
     * For now, we assume pausing the transport is sufficient, but also stop individual samplers for safety.
     */
    pause(): void {
        console.log('SamplerController: Pausing playback for all samplers');
        // Pausing the main transport should pause scheduled events.
        // Additionally, explicitly stop samplers to release any active voices/nodes immediately.
        const samplerTracks = this.getActiveSamplerIds();
        for (const trackId of samplerTracks) {
            const sampler = this.samplers.get(trackId);
            sampler?.stopPlayback(); // Use stopPlayback for immediate halt and cleanup
        }
    }

    /**
     * Stop playback for all active samplers and reset their state.
     */
    async stop(): Promise<void> {
        console.log('SamplerController: Stopping playback for all samplers');
        const samplerTracks = this.getActiveSamplerIds();
        for (const trackId of samplerTracks) {
            const sampler = this.samplers.get(trackId);
            if (sampler) {
                try {
                    sampler.stopPlayback(); // Delegate stopping to the sampler
                } catch (error) {
                    console.error(`SamplerController: Error stopping playback for track ${trackId}:`, error);
                }
            }
        }
    }

    /**
     * Seek to a specific position. Stops current playback and restarts from the new position.
     * @param position Position in seconds.
     * @param bpm Current BPM for timing calculations.
     */
    async seek(position: number, bpm: number = 120): Promise<void> {
        console.log(`SamplerController: Seeking to ${position}s`);

        // 1. Stop all current playback immediately
        await this.stop();

        // 2. Restart playback from the new position
        // Note: A small delay might be needed if stop() is asynchronous and needs time to fully release resources
        // await new Promise(resolve => setTimeout(resolve, 10)); // Optional small delay
        await this.play(position, bpm);
    }
    
    /**
     * Clean up all resources for a specific track or all tracks
     * @param trackId Optional track ID. If not provided, all tracks are cleaned up.
     */
    dispose(trackId?: string): void {
        if (trackId) {
            // Clean up specific track
            this.removeSampler(trackId);
        } else {
            // Removed call to clearScheduledEvents

            // Clean up all tracks
            for (const trackId of this.samplers.keys()) {
                this.removeSampler(trackId);
            }
            
            // Clear all maps
            this.samplers.clear();
            this.trackSubscriptions.clear();
            console.log('All samplers disposed');
        }
    }
}
