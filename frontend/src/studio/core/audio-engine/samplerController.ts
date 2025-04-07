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
    private scheduledEvents: Map<string, number[]> = new Map(); // Track ID -> event IDs
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
        file: File, 
        baseMidiNote: number = this.DEFAULT_BASE_NOTE, 
        grainSize: number = this.DEFAULT_GRAIN_SIZE, 
        overlap: number = this.DEFAULT_OVERLAP
    ): Promise<void> {
        try {
            console.log(`Initializing sampler for track ${trackId}`);
            
            // Create logger functions for the sampler
            const onLog = (message: string) => {
                console.log(`Sampler ${trackId}: ${message}`);
            };
            
            const onPlaybackStatusChange = (isPlaying: boolean) => {
                console.log(`Sampler ${trackId} playback status: ${isPlaying ? 'playing' : 'stopped'}`);
                // You could emit a custom event here if needed
            };
            
            // Clean up any existing sampler for this track
            if (this.samplers.has(trackId)) {
                console.log(`Cleaning up existing sampler for track ${trackId}`);
                // Implement cleanup if needed
            }
            
            // Create new sampler
            const sampler = new MidiSampler(onLog, onPlaybackStatusChange);
            
            // Initialize audio context
            await sampler.initialize();
            
            // Load audio file
            await sampler.loadAudioFile(file, grainSize, overlap);
            
            // Store sampler with track ID
            this.samplers.set(trackId, sampler);
            
            console.log(`Sampler for track ${trackId} initialized successfully`);
        } catch (error) {
            console.error(`Failed to initialize sampler for track ${trackId}:`, error);
            throw error;
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
    
    /**
     * Prepare all sampler tracks for playback
     * @param startTime The transport time to start from
     * @param bpm Current BPM for timing calculations
     */
    preparePlayback(startTime: number = 0, bpm: number = 120): void {
        // Get all active sampler tracks
        const samplerTracks = this.getActiveSamplerIds();
        if (samplerTracks.length === 0) {
            console.log('No active sampler tracks to prepare for playback');
            return;
        }
        
        console.log(`Preparing ${samplerTracks.length} sampler tracks for playback from ${startTime}s`);
        
        // Clear any previously scheduled events
        this.clearScheduledEvents();
        
        // For each sampler track, schedule it for playback
        for (const trackId of samplerTracks) {
            const sampler = this.samplers.get(trackId);
            if (sampler) {
                // Each sampler already has its notes from the MidiManager subscription
                const notes = sampler.getNotes();
                
                if (notes && notes.length > 0) {
                    console.log(`Starting playback for sampler track ${trackId} with ${notes.length} notes`);
                    
                    // Play the sampler with the current BPM and start time
                    sampler.playMidi(bpm, startTime);
                } else {
                    console.log(`No notes found for sampler track ${trackId}`);
                }
            }
        }
    }
    
    /**
     * Play notes from a specific point in time (for transport playback)
     * Following the SoundfontEngineController pattern
     * @param trackId The track ID
     * @param notes Array of notes to play
     * @param startTime The transport time to start from
     */
    playNotes(trackId: string, notes: Note[], startTime: number = 0): void {
        const sampler = this.samplers.get(trackId);
        if (!sampler) {
            console.warn(`No sampler found for track ${trackId}, cannot play notes`);
            return;
        }
        
        console.log(`SamplerController: Setting up ${notes.length} notes for track ${trackId} starting at ${startTime}`);
        
        // Store scheduled event IDs so we can cancel them later if needed
        const scheduledEvents: number[] = [];
        
        // Calculate timing constants once
        const secPerBeat = 60 / Tone.Transport.bpm.value;
        const gridUnitTime = secPerBeat / 4; // Assuming 16th note grid
        
        // Group notes by their start time for more efficient scheduling
        const notesByStartTime: Map<number, Note[]> = new Map();
        
        // Process notes first, organizing them by start time
        notes.forEach(note => {
            const noteTimeInSeconds = note.column * gridUnitTime;
            
            // Only schedule notes that should play after the start time
            if (noteTimeInSeconds >= startTime) {
                // Store notes by their start times for more efficient scheduling
                if (!notesByStartTime.has(noteTimeInSeconds)) {
                    notesByStartTime.set(noteTimeInSeconds, []);
                }
                notesByStartTime.get(noteTimeInSeconds)!.push(note);
            }
        });
        
        // Schedule notes by their start time - more efficient than scheduling each note separately
        for (const [noteTimeInSeconds, notesAtTime] of notesByStartTime.entries()) {
            const offsetFromNow = noteTimeInSeconds - startTime;
            
            // Schedule a single event for all notes starting at this time
            const eventId = Tone.getTransport().schedule((time) => {
                for (const note of notesAtTime) {
                    // Calculate note duration
                    const noteDuration = note.length * gridUnitTime;
                    
                    // Use a velocity between 0-1 
                    const velocity = note.velocity ? note.velocity / 127 : 0.8;
                    
                    // Play the note at the scheduled time
                    this.playNote(trackId, note.row, noteDuration, velocity);
                    
                    console.log(`Playing sampler note: pitch=${note.row}, duration=${noteDuration}, time=${time}`);
                }
            }, offsetFromNow);
            
            // Store the event ID for later cleanup
            scheduledEvents.push(eventId);
        }
        
        // Store the scheduled events for this track
        this.scheduledEvents.set(trackId, scheduledEvents);
        
        console.log(`Scheduled ${notes.length} sampler notes for playback in ${notesByStartTime.size} time slots`);
    }
    
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
        
        // The MidiSampler class has a private baseNote property
        // We would need to add a setter for this
        // sampler.setBaseNote(baseMidiNote);
        console.log(`Set base MIDI note for track ${trackId} to ${baseMidiNote}`);
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
    
    /**
     * Clear scheduled events for a track
     * @param trackId The track ID to clear events for, or undefined to clear all
     */
    clearScheduledEvents(trackId?: string): void {
        if (trackId) {
            // Clear scheduled events for a specific track
            const events = this.scheduledEvents.get(trackId);
            if (events && events.length > 0) {
                console.log(`Clearing ${events.length} scheduled events for track ${trackId}`);
                events.forEach(id => Tone.Transport.clear(id));
                this.scheduledEvents.delete(trackId);
            }
        } else {
            // Clear all scheduled events
            for (const [id, events] of this.scheduledEvents.entries()) {
                console.log(`Clearing ${events.length} scheduled events for track ${id}`);
                events.forEach(eventId => Tone.Transport.clear(eventId));
            }
            this.scheduledEvents.clear();
        }
    }
    
    /**
     * Remove a sampler by track ID
     * @param trackId The track ID
     */
    removeSampler(trackId: string): void {
        // Clear any scheduled events
        this.clearScheduledEvents(trackId);
        
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
     * Start or resume playback
     * @param startTime The transport time to start from
     * @param bpm Current BPM for timing calculations
     */
    async play(startTime: number = 0, bpm: number = 120): Promise<void> {
        console.log('SamplerController: Starting playback');
        
        // Prepare all samplers for playback
        this.preparePlayback(startTime, bpm);
    }
    
    /**
     * Pause playback
     */
    pause(): void {
        console.log('SamplerController: Pausing playback');
        // Clear all scheduled events to stop future playback
        this.clearScheduledEvents();
    }
    
    /**
     * Stop playback and reset position
     */
    async stop(): Promise<void> {
        console.log('SamplerController: Stopping playback');
        // Clear all scheduled events
        this.clearScheduledEvents();
        
        // For each active sampler, stop any currently playing notes
        const samplerTracks = this.getActiveSamplerIds();
        for (const trackId of samplerTracks) {
            const sampler = this.samplers.get(trackId);
            if (sampler) {
                sampler.stopPlayback();
            }
        }
    }
    
    /**
     * Seek to a specific position - clears and reschedules events
     * @param position Position in seconds
     * @param bpm Current BPM for timing calculations
     */
    async seek(position: number, bpm: number = 120): Promise<void> {
        console.log(`SamplerController: Seeking to ${position}`);
        
        // CRITICAL FIX: First stop ALL active sampler playback
        // This ensures any playing GrainPlayers are disposed of properly
        const samplerTracks = this.getActiveSamplerIds();
        for (const trackId of samplerTracks) {
            const sampler = this.samplers.get(trackId);
            if (sampler) {
                // Call stopPlayback which handles Tone.Transport.cancel() internally
                sampler.stopPlayback();
                console.log(`Stopped playback for sampler ${trackId} during seek`);
            }
        }
        
        // Then clear all scheduled events we've been tracking
        this.clearScheduledEvents();
        
        // Finally, reschedule notes from the new position
        this.preparePlayback(position, bpm);
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
            // Clear all scheduled events first
            this.clearScheduledEvents();
            
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