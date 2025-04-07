import * as Tone from "tone";
import { Midi } from "@tonejs/midi";
import { Note } from "../../types/note";

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
    private activeGrainPlayers: Set<Tone.GrainPlayer> = new Set(); // CRITICAL FIX: Track active grain players

    constructor(
        onLog: LogCallback,
        onPlaybackStatusChange: PlaybackStatusCallback
    ) {
        this.onLog = onLog;
        this.onPlaybackStatusChange = onPlaybackStatusChange;
    }

    // Initialize audio context
    public async initialize(): Promise<void> {
        try {
        await Tone.start();
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

        // Clean up previous player if exists
        if (this.player) {
            this.player.dispose();
        }

        // Create a promise to handle player loading
        return new Promise((resolve, reject) => {
            this.player = new Tone.GrainPlayer({
            url: objectUrl,
            grainSize,
            overlap,
            onload: () => {
                this.log("Audio sample loaded successfully");
                resolve();
            },
            onerror: (error) => {
                this.log(`Error loading audio: ${error}`);
                reject(error);
            },
            }).toDestination();
        });
        } catch (error: any) {
        this.log(`Error setting up audio: ${error.message}`);
        return Promise.reject(error);
        }
    }

    // Play a single note
    public playNote(
        midiNote: number,
        duration: number = 0.5,
        velocity: number = 0.8
    ): void {
        if (!this.player) {
        this.log("Cannot play note: audio not ready");
        return;
        }

        // Calculate pitch shift in semitones
        const pitchShiftAmount = midiNote - this.baseNote;

        // Clone the buffer for a new GrainPlayer instance
        const buffer = this.player.buffer;

        if (!buffer) {
        this.log("Buffer not loaded");
        return;
        }

        // Create a new player for this note to avoid interference
        const notePlayer = new Tone.GrainPlayer({
        url: buffer,
        grainSize: this.player.grainSize,
        overlap: this.player.overlap,
        detune: pitchShiftAmount * 100, // Convert semitones to cents (100 cents per semitone)
        volume: Tone.gainToDb(velocity), // Convert linear gain to decibels
        }).toDestination();

        // Play the note
        const now = Tone.now();
        notePlayer.start(now).stop(now + duration);

        // Clean up when done
        Tone.Transport.schedule(() => {
        notePlayer.dispose();
        }, now + duration + 0.1);

        this.log(
        `Playing note: ${Tone.Frequency(
            midiNote,
            "midi"
        ).toNote()} (shift: ${pitchShiftAmount})`
        );
    }

    /**
     * Play notes with timing based on grid positions
     * @param bpm Current tempo in beats per minute
     * @param startTime Position to start playback from (in seconds)
     */
    public playMidi(bpm: number = 120, startTime: number = 0): void {
        if (!this.player) {
            this.log("Cannot play: audio not ready");
            return;
        }
        
        if (this.notes.length === 0) {
            this.log("Cannot play: no notes available");
            return;
        }

        
        // Account for track's position offset
        // If track is positioned at 2s and transport starts at 0s, we shouldn't play notes until transport reaches 2s
        // So effective start time is startTime + offsetSeconds
        const effectiveStartTime = startTime - this.offsetSeconds;
        
        this.log(`Playing notes from ${startTime}s at ${bpm} BPM (track offset: ${this.offsetSeconds}s, effective: ${effectiveStartTime}s)`);
        this.isPlaying = true;
        this.onPlaybackStatusChange(true);
        
        // Calculate timing constants
        const secPerBeat = 60 / bpm;
        const gridUnitTime = secPerBeat / 4 * 2; // Assuming 16th note grid
        
        // Schedule all notes
        this.notes.forEach((note) => {
            // Calculate note time based on grid position
            const noteTimeInSeconds = note.column * gridUnitTime;
            
            // Only schedule notes that should play after the effective start time
            if (noteTimeInSeconds >= effectiveStartTime) {
                const offsetFromNow = noteTimeInSeconds - effectiveStartTime;
                
                // Calculate note duration
                const noteDuration = note.length * gridUnitTime;
                
                // DEBUG: Add explicit explanation of the timing calculation
                console.log(`Note at time=${noteTimeInSeconds}s, effectiveStart=${effectiveStartTime}s, offsetFromNow=${offsetFromNow}s, track offset=${this.offsetSeconds}s, transport=${startTime}s, will play at transport=${startTime + offsetFromNow}s`);
                
                // CRITICAL FIX: The seek time was being subtracted from when notes play
                // This happens because we're using relative scheduling (offsetFromNow) with a transport
                // whose position has been changed during seeking.
                
                // Calculate the absolute time in the transport timeline when this note should play
                const absoluteTransportTime = noteTimeInSeconds + this.offsetSeconds;
                
                // Schedule at the absolute time, not relative to current transport position
                Tone.Transport.schedule((time) => {
                    if (!this.player || !this.player.buffer) return;
                    
                    // Calculate pitch shift in semitones
                    const pitchShiftAmount = note.row - this.baseNote;
                    
                    // Use velocity from note (0-127) or default to 0.8 (medium-high)
                    const velocity = note.velocity ? note.velocity : 0.8;
                    
                    // Create a new GrainPlayer for this note
                    const notePlayer = new Tone.GrainPlayer({
                        url: this.player.buffer,
                        grainSize: this.player.grainSize,
                        overlap: this.player.overlap,
                        detune: pitchShiftAmount * 100, // Convert semitones to cents
                        volume: Tone.gainToDb(velocity),
                    }).toDestination();
                    
                    // CRITICAL FIX: Track this grain player so we can stop it during seeking
                    this.activeGrainPlayers.add(notePlayer);
                    
                    // Play the note
                    if (!this.cutSelfOff) {
                        notePlayer.start(time);
                    } else {
                        notePlayer.start(time).stop(time + noteDuration);
                    }
                    
                    // Clean up when done
                    Tone.Transport.schedule(() => {
                        // Remove from active players when done
                        this.activeGrainPlayers.delete(notePlayer);
                        notePlayer.dispose();
                    }, time + noteDuration + 0.1);
                    
                    this.log(`Playing note: ${Tone.Frequency(note.row, "midi").toNote()} at t=${time}, noteTime=${noteTimeInSeconds}s, offset=${this.offsetSeconds}s, absoluteTime=${absoluteTransportTime}s, transportTime=${Tone.Transport.seconds}s`);
                }, absoluteTransportTime); // Use absolute time instead of relative offset
            }
        });
    }

    // Stop playback
    public stopPlayback(): void {
        // CRITICAL FIX: Dispose all active grain players to stop ALL audio immediately
        const activeCount = this.activeGrainPlayers.size;
        if (activeCount > 0) {
            this.log(`Stopping ${activeCount} active grain players`);
            
            // Dispose each active grain player
            this.activeGrainPlayers.forEach(player => {
                player.dispose();
            });
            
            // Clear the set
            this.activeGrainPlayers.clear();
        }
        
        // Also cancel scheduled events to prevent new notes from playing
        Tone.Transport.cancel(); 
        
        // Mark as stopped
        this.isPlaying = false;
        this.onPlaybackStatusChange(false);
        this.log(`Playback stopped - all audio silenced and events cancelled`);
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

    // Helper for logging
    private log(message: string): void {
        this.onLog(message);
    }
}

// Export the class as default
export default MidiSampler;
