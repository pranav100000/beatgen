import * as Tone from "tone";
import { Note } from "../../../../types/note";

// Types for event callbacks
type LogCallback = (message: string) => void;
type PlaybackStatusCallback = (isPlaying: boolean) => void;

class MidiSampler {
    private player: Tone.GrainPlayer | null = null;
    private notes: Note[] = [];
    private baseNote: number = 60; // C4 MIDI note number
    private isPlaying: boolean = false;
    private onLog: LogCallback;
    private onPlaybackStatusChange: PlaybackStatusCallback;
    private cutSelfOff: boolean = false;
    private offsetSeconds: number = 0; // Track's position offset in seconds
    
    // Master gain node for volume control
    private gainNode: Tone.Gain;
    private currentVolume: number = 100; // Store current volume (0-100)
    private isMuted: boolean = false;
    private activePlayNoteTimeouts: Set<NodeJS.Timeout> = new Set(); // Store setTimeout IDs from playNote

    constructor(
        onLog: LogCallback,
        onPlaybackStatusChange: PlaybackStatusCallback
    ) {
        this.onLog = onLog;
        this.onPlaybackStatusChange = onPlaybackStatusChange;
        
        // Initialize gain node
        this.gainNode = new Tone.Gain(1).toDestination();
    }

    // Initialize audio context
    public async initialize(): Promise<void> {
        try {
            //await Tone.start();
            this.log("Audio context initialized");
            return Promise.resolve();
        } catch (error: any) {
            this.log(`Error initializing audio: ${error.message}`);
            return Promise.reject(error);
        }
    }

    // Load audio file
    public async loadAudioFile(
        file: File,
        grainSize: number,
        overlap: number
    ): Promise<void> {
        try {
            const objectUrl = URL.createObjectURL(file);
            this.log(`Loading audio file: ${file.name}`);

            // Clean up previous resources
            this.cleanupResources(false);

            // Create a promise to handle player loading
            return new Promise((resolve, reject) => {
                this.player = new Tone.GrainPlayer({
                    url: objectUrl,
                    grainSize,
                    overlap,
                    onload: async () => {
                        this.log("Audio sample loaded successfully");
                        resolve();
                    },
                    onerror: (error) => {
                        this.log(`Error loading audio: ${error}`);
                        reject(error);
                    },
                }).connect(this.gainNode); // Connect to gain node instead of destination
                URL.revokeObjectURL(objectUrl);
            });
        } catch (error: any) {
            this.log(`Error setting up audio: ${error.message}`);
            return Promise.reject(error);
        }
    }

    // Renamed from getPlayerFromPool and refactored for on-demand creation
    private createAndConfigurePlayer(): Tone.GrainPlayer | null {
        if (!this.player?.buffer) { // this.player is the main GrainPlayer holding the loaded buffer
            this.log("Cannot create player: no buffer loaded on main player");
            return null;
        }
        try {
            const newPlayer = new Tone.GrainPlayer();
            newPlayer.buffer = this.player.buffer; // Share the main buffer
            newPlayer.grainSize = this.player.grainSize; // Use main player's current settings
            newPlayer.overlap = this.player.overlap;   // Use main player's current settings
            newPlayer.connect(this.gainNode); // Connect to this sampler's gain node
            newPlayer.volume.value = -Infinity; // Start silent, will be set before play
            return newPlayer;
        } catch (error) {
            this.log(`Error creating on-demand player: ${error}`);
            return null;
        }
    }

    // Play a single note
    public playNote(
        midiNote: number,
        duration: number = 0.5,
        velocity: number = 0.8
    ): void {
        if (!this.player?.buffer) {
            this.log("Cannot play note: main player or buffer not ready.");
            return;
        }
        
        const tempPlayer = this.createAndConfigurePlayer();
        if (!tempPlayer) {
            this.log("Failed to create player for playNote");
            return;
        }

        try {
            const pitchShiftAmount = midiNote - this.baseNote;
            tempPlayer.detune = pitchShiftAmount * 100;
            tempPlayer.volume.value = Tone.gainToDb(velocity);
            
            const now = Tone.now();
            tempPlayer.start(now).stop(now + duration);
            
            // Dispose the temporary player after its duration
            const timeoutId = setTimeout(() => {
                try {
                    if (!tempPlayer.disposed) tempPlayer.dispose();
                } catch (e) {
                    this.log(`Error disposing player in playNote: ${e}`)
                }
                this.activePlayNoteTimeouts.delete(timeoutId); // Remove from set once executed
            }, (duration * 1000) + 100); // 100ms grace period before disposing
            this.activePlayNoteTimeouts.add(timeoutId); // Add to set
        } catch (error) {
            this.log(`Error playing note: ${error}`);
            // Ensure player is disposed even if there was an error during setup/play
            try {
                 if (!tempPlayer.disposed) tempPlayer.dispose();
            } catch (e) {
                 this.log(`Error disposing player after playNote error: ${e}`)
            }
        }
    }

    /**
     * Play notes with timing based on grid positions
     * @param bpm Current tempo in beats per minute
     * @param startTime Position to start playback from (in seconds)
     */
    public playMidi(bpm: number = 120, startTime: number = 0): void {
        console.log("playMidi", bpm, startTime);
        console.log("this.player", this.player);
        console.log("this.notes", this.notes);
        console.log("this.offsetSeconds", this.offsetSeconds);
        console.log("this.isPlaying", this.isPlaying);
        console.log("this.onPlaybackStatusChange", this.onPlaybackStatusChange);
        console.log("this.cutSelfOff", this.cutSelfOff);
        console.log("this.baseNote", this.baseNote);
        console.log("this.currentVolume", this.currentVolume);
        console.log("this.isMuted", this.isMuted);
        console.log("this.grainSize", this.player?.grainSize);
        console.log("this.overlap", this.player?.overlap);
        console.log("this.volume", this.player?.volume.value);
        
        if (!this.player?.buffer) {
            this.log("Cannot play: audio not ready");
            return;
        }
        
        if (this.notes.length === 0) {
            this.log("Cannot play: no notes available");
            return;
        }
        
        // Account for track's position offset
        const effectiveStartTime = startTime - this.offsetSeconds;
        
        this.log(`Playing notes from ${startTime}s at ${bpm} BPM (track offset: ${this.offsetSeconds}s, effective: ${effectiveStartTime}s)`);
        this.isPlaying = true;
        this.onPlaybackStatusChange(true);
        
        // Calculate timing constants
        const secPerBeat = 60 / bpm;
        const gridUnitTime = secPerBeat / 4; // Assuming 16th note grid
        
        // Add a small lookahead to compensate for transport timing delays
        const lookAheadTime = 0.1; // 25ms lookahead
        // Schedule all notes
        for (const note of this.notes) {
            // Calculate note time based on grid position
            const noteTimeInSeconds = note.column / (bpm * 8);
            
            // Only schedule notes that should play after the effective start time
            if (noteTimeInSeconds >= effectiveStartTime) {
                // Calculate note duration
                const noteDuration = note.length / secPerBeat;
                
                // Calculate the absolute time in the transport timeline when this note should play
                // Apply lookahead to schedule earlier to compensate for transport delay
                const absoluteTransportTime = Math.max(noteTimeInSeconds + this.offsetSeconds - lookAheadTime, 0);
                
                // Schedule at the adjusted absolute time
                Tone.Transport.schedule((time) => {
                    // Get a player from the pool at playback time - NOW CREATE ON DEMAND
                    const tempPlayer = this.createAndConfigurePlayer();
                    if (!tempPlayer) {
                        this.log("Failed to create player for scheduled note in playMidi");
                        return;
                    }
                    
                    try {
                        const pitchShiftAmount = note.row - this.baseNote;
                        tempPlayer.detune = pitchShiftAmount * 100;
                        
                        tempPlayer.volume.value = note.velocity 
                            ? Tone.gainToDb(note.velocity) 
                            : Tone.gainToDb(0.8);
                        
                        if (!this.cutSelfOff) {
                            tempPlayer.start(time);
                        } else {
                            tempPlayer.start(time).stop(time + noteDuration);
                        }
                        
                        // Schedule disposal of the temporary player
                        Tone.Transport.schedule(() => {
                            try {
                                // Ensure it hasn't been already disposed if a global stop was called
                                if (!tempPlayer.disposed) {
                                    tempPlayer.stop(time + noteDuration + 0.01); // Ensure stop before dispose
                                    tempPlayer.dispose();
                                }
                            } catch (e) {
                                this.log(`Error disposing player in playMidi: ${e}`)
                            }
                        }, time + noteDuration + 0.05); // 50ms grace period
                        
                        this.log(`Playing note: ${Tone.Frequency(note.row, "midi").toNote()} at t=${time}, noteTime=${noteTimeInSeconds}s, offset=${this.offsetSeconds}s, absoluteTime=${absoluteTransportTime + lookAheadTime}s, transportTime=${Tone.Transport.seconds}s`);
                    } catch (error) {
                        this.log(`Error playing scheduled note: ${error}`);
                        // Ensure player is disposed even if there was an error
                        try {
                            if (!tempPlayer.disposed) tempPlayer.dispose();
                        } catch (e) {
                            this.log(`Error disposing player after playMidi error: ${e}`)
                        }
                    }
                }, absoluteTransportTime);
            }
        }
    }

    // Stop playback
    public stopPlayback(): void {
        // Clear any pending timeouts for playNote disposals
        this.activePlayNoteTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.activePlayNoteTimeouts.clear();
        
        // Cancel scheduled events via Tone.Transport (for playMidi)
        Tone.Transport.cancel(); 
        
        // Mark as stopped
        this.isPlaying = false;
        this.onPlaybackStatusChange(false);
        this.log(`Playback stopped - all audio silenced and events cancelled`);
    }
    
    // Clean up all resources
    private cleanupResources(disposeMainPlayer = true): void {
        // First stop any active playback
        this.stopPlayback();
        
        // Dispose the main player if requested
        if (disposeMainPlayer && this.player) {
            this.player.dispose();
            this.player = null;
        }
        
        // Clean up the player pool - REMOVED
        // this.cleanupPlayerPool();
    }
    
    /**
     * Clean up all resources when track is deleted or no longer needed
     */
    public dispose(): void {
        this.cleanupResources(true);
        
        // Also dispose the gain node
        if (this.gainNode && !this.gainNode.disposed) {
            this.gainNode.dispose();
        }
        
        // Ensure any remaining playNote timeouts are cleared
        this.activePlayNoteTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.activePlayNoteTimeouts.clear();

        this.log('All resources disposed');
    }

    // Update grain size
    public setGrainSize(value: number): void {
        if (this.player) {
            this.player.grainSize = value;
            this.log(`Grain size set to ${value} seconds`);
        }
    }

    // Update overlap
    public setOverlap(value: number): void {
        if (this.player) {
            this.player.overlap = value;
            this.log(`Overlap set to ${value}`);
        }
    }
    
    /**
     * Set the notes for this sampler
     * @param notes Array of Note objects to use for playback
     */
    public setNotes(notes: Note[]): void {
        this.notes = notes;
        this.log(`Set ${notes.length} notes for playback`);
    }
    
    /**
     * Get the current notes array
     */
    public getNotes(): Note[] {
        return this.notes;
    }
    
    /**
     * Get the base MIDI note for pitch shifting
     */
    public getBaseNote(): number {
        return this.baseNote;
    }
    
    /**
     * Set the base MIDI note for pitch shifting
     */
    public setBaseNote(note: number): void {
        this.baseNote = note;
        this.log(`Base note set to ${note} (${Tone.Frequency(note, "midi").toNote()})`);
    }
    
    /**
     * Set the track's position offset in seconds
     * This affects when notes start playing relative to transport time
     * @param offsetSeconds Offset in seconds
     */
    public setOffset(offsetMs: number): void {
        this.offsetSeconds = offsetMs / 1000;
        this.log(`Track offset set to ${offsetMs}ms (${this.offsetSeconds}s)`);
    }
    
    /**
     * Get the track's position offset in seconds
     */
    public getOffset(): number {
        return this.offsetSeconds;
    }
    
    /**
     * Set the volume level for this sampler
     * @param volume Volume level (0-100)
     */
    public setVolume(volume: number): void {
        // Store the current volume
        this.currentVolume = volume;
        
        // If muted, don't actually change the gain
        if (this.isMuted) return;
        
        // Convert from linear volume to decibels
        const dbValue = Tone.gainToDb(volume / 100);
        
        // Apply to the gain node
        this.gainNode.gain.value = Tone.dbToGain(dbValue);
        
        this.log(`Volume set to ${volume}% (${dbValue}dB)`);
    }
    
    /**
     * Set mute state for this sampler
     * @param muted Whether the sampler should be muted
     */
    public setMute(muted: boolean): void {
        this.isMuted = muted;
        
        // Set gain based on mute state
        if (muted) {
            this.gainNode.gain.value = 0;
        } else {
            // Restore previous volume
            const dbValue = Tone.gainToDb(this.currentVolume / 100);
            this.gainNode.gain.value = Tone.dbToGain(dbValue);
        }
        
        this.log(`Mute set to ${muted}`);
    }

    // Helper for logging
    private log(message: string): void {
        this.onLog(message);
    }
}

export default MidiSampler;