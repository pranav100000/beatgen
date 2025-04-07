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
    private activeGrainPlayers: Set<Tone.GrainPlayer> = new Set(); // Track active grain players
    private notePlayerMap: Map<string, Tone.GrainPlayer> = new Map(); // Pre-created players for notes
    private playerPool: Tone.GrainPlayer[] = [];
    private readonly POOL_SIZE = 200;

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

            // Clean up previous player and pool if they exist
            if (this.player) {
                this.player.dispose();
            }
            this.cleanupPlayerPool();

            // Create a promise to handle player loading
            return new Promise((resolve, reject) => {
                this.player = new Tone.GrainPlayer({
                    url: objectUrl,
                    grainSize,
                    overlap,
                    onload: async () => {
                        this.log("Audio sample loaded successfully");
                        await this.initializePlayerPool();
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

    private async initializePlayerPool(): Promise<void> {
        if (!this.player?.buffer) {
            this.log("Cannot initialize player pool: no buffer loaded");
            return;
        }

        // Clean up existing pool first
        this.cleanupPlayerPool();

        // Initialize new pool
        for (let i = 0; i < this.POOL_SIZE; i++) {
            const player = new Tone.GrainPlayer({
                url: this.player.buffer,
                grainSize: this.player.grainSize,
                overlap: this.player.overlap
            }).toDestination();
            this.playerPool.push(player);
        }
        this.log(`Initialized player pool with ${this.POOL_SIZE} players`);
    }

    private cleanupPlayerPool(): void {
        // Dispose of all players in the pool
        this.playerPool.forEach(player => player.dispose());
        this.playerPool = [];
    }

    private getPlayerFromPool(): Tone.GrainPlayer | null {
        return this.playerPool.find(p => !p.state.includes('started')) || null;
    }

    // Play a single note
    public playNote(
        midiNote: number,
        duration: number = 0.5,
        velocity: number = 0.8
    ): void {
        if (!this.player?.buffer) return;
        
        const player = this.getPlayerFromPool();
        if (!player) {
            this.log("No available players in pool");
            return;
        }

        const pitchShiftAmount = midiNote - this.baseNote;
        player.detune = pitchShiftAmount * 100;
        player.volume.value = Tone.gainToDb(velocity);
        
        // Make sure player is connected to output
        player.connect(Tone.getDestination());
        this.activeGrainPlayers.add(player);

        const now = Tone.now();
        player.start(now).stop(now + duration);
        
        // Schedule cleanup when done
        Tone.Transport.schedule(() => {
            // Disconnect and remove from active players
            player.disconnect();
            this.activeGrainPlayers.delete(player);
        }, now + duration + 0.1); // Add small buffer for safe cleanup
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
                    
                    // Get the pre-created player for this note
                    const noteKey = this.getNoteKey(note);
                    const notePlayer = this.notePlayerMap.get(noteKey);
                    
                    if (!notePlayer) {
                        this.log(`Error: No pre-created player found for note ${note.row}`);
                        return;
                    }
                    
                    // Connect to the audio destination
                    notePlayer.connect(Tone.getDestination());
                    
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
                        
                        // Reset the player rather than disposing it - this allows us to keep the player for future use
                        notePlayer.stop();
                        notePlayer.disconnect();
                        
                        // We no longer dispose players since we're reusing them
                    }, time + noteDuration + 0.1);
                    
                    this.log(`Playing note: ${Tone.Frequency(note.row, "midi").toNote()} at t=${time}, noteTime=${noteTimeInSeconds}s, offset=${this.offsetSeconds}s, absoluteTime=${absoluteTransportTime}s, transportTime=${Tone.Transport.seconds}s`);
                }, absoluteTransportTime); // Use absolute time instead of relative offset
            }
        });
    }

    // Stop playback
    public stopPlayback(): void {
        // Stop all active grain players but DO NOT dispose them since we're reusing them
        const activeCount = this.activeGrainPlayers.size;
        if (activeCount > 0) {
            this.log(`Stopping ${activeCount} active grain players`);
            
            // Stop each active grain player (but don't dispose since we'll reuse them)
            this.activeGrainPlayers.forEach(player => {
                // Stop the player immediately
                player.stop();
                
                // Disconnect from audio destination
                player.disconnect();
            });
            
            // Clear the active set
            this.activeGrainPlayers.clear();
        }
        
        // Also cancel scheduled events to prevent new notes from playing
        Tone.Transport.cancel(); 
        
        // Mark as stopped
        this.isPlaying = false;
        this.onPlaybackStatusChange(false);
        this.log(`Playback stopped - all audio silenced and events cancelled`);
    }
    
    /**
     * Clean up all resources when track is deleted or no longer needed
     */
    public dispose(): void {
        // First stop any active playback
        this.stopPlayback();
        
        // Dispose the main player
        if (this.player) {
            this.player.dispose();
            this.player = null;
        }
        
        // Dispose all pre-created note players
        this.disposeAllNotePlayers();
        
        // Clean up the player pool
        this.cleanupPlayerPool();
        
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
        // Clean up any existing note players for notes that are no longer present
        this.cleanupUnusedNotePlayers(notes);
        
        // Store the new notes
        this.notes = notes;
        this.log(`Set ${notes.length} notes for playback`);
        
        // Pre-create players for all notes to reduce latency during playback
        this.prepareNotePlayersAsync(notes);
    }
    
    /**
     * Create GrainPlayers for notes in advance to reduce playback latency
     * @param notes Array of notes to prepare players for
     */
    private async prepareNotePlayersAsync(notes: Note[]): Promise<void> {
        if (!this.player || !this.player.buffer) {
            this.log("Cannot prepare note players: audio not ready");
            return;
        }
        
        this.log(`Preparing players for ${notes.length} notes...`);
        
        // Prepare players in batches to avoid locking up the UI
        const batchSize = 20;
        for (let i = 0; i < notes.length; i += batchSize) {
            const batch = notes.slice(i, i + batchSize);
            
            // Create a slight delay between batches to keep UI responsive
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
            
            // Process this batch of notes
            for (const note of batch) {
                const noteKey = this.getNoteKey(note);
                
                // Skip if we already have a player for this note
                if (this.notePlayerMap.has(noteKey)) continue;
                
                // Calculate pitch shift in semitones
                const pitchShiftAmount = note.row - this.baseNote;
                
                // Use velocity from note or default
                const velocity = note.velocity ? note.velocity : 0.8;
                
                // Create a new player for this note (reverting to original implementation)
                const notePlayer = new Tone.GrainPlayer({
                    url: this.player.buffer,
                    grainSize: this.player.grainSize,
                    overlap: this.player.overlap,
                    detune: pitchShiftAmount * 100, // Convert semitones to cents
                    volume: Tone.gainToDb(velocity)
                });
                
                // Store the player for this note
                this.notePlayerMap.set(noteKey, notePlayer);
            }
        }
        
        this.log(`Prepared players for ${this.notePlayerMap.size} unique notes`);
    }
    
    /**
     * Clean up GrainPlayers for notes that are no longer present
     * @param newNotes The new set of notes
     */
    private cleanupUnusedNotePlayers(newNotes: Note[]): void {
        // If there are no new notes, clean up all
        if (newNotes.length === 0) {
            this.disposeAllNotePlayers();
            return;
        }
        
        // Create a set of note keys from the new notes
        const newNoteKeys = new Set(newNotes.map(note => this.getNoteKey(note)));
        
        // Find note players that are no longer needed
        const toRemove: string[] = [];
        this.notePlayerMap.forEach((player, noteKey) => {
            if (!newNoteKeys.has(noteKey)) {
                // Dispose the player
                player.dispose();
                toRemove.push(noteKey);
            }
        });
        
        // Remove the disposed players from the map
        toRemove.forEach(key => this.notePlayerMap.delete(key));
        
        if (toRemove.length > 0) {
            this.log(`Cleaned up ${toRemove.length} unused note players`);
        }
    }
    
    /**
     * Generate a unique key for a note based on its properties
     */
    private getNoteKey(note: Note): string {
        return `${note.row}_${note.velocity || 100}`;
    }
    
    /**
     * Dispose all note players and clear the map
     */
    private disposeAllNotePlayers(): void {
        this.notePlayerMap.forEach(player => player.dispose());
        this.notePlayerMap.clear();
        this.log('Disposed all note players');
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
        // Volume is 0-100 in the UI but Tone.js uses decibels
        // Convert from linear volume (0-100) to decibels
        const dbValue = Tone.gainToDb(volume / 100);
        
        // Apply to current player if it exists
        if (this.player) {
            this.player.volume.value = dbValue;
        }
        
        // Also apply to any active grain players
        this.activeGrainPlayers.forEach(player => {
            player.volume.value = dbValue;
        });
        
        this.log(`Volume set to ${volume}% (${dbValue}dB)`);
    }
    
    /**
     * Set mute state for this sampler
     * @param muted Whether the sampler should be muted
     */
    public setMute(muted: boolean): void {
        // Apply to current player if it exists
        if (this.player) {
            this.player.mute = muted;
        }
        
        // Also apply to any active grain players
        this.activeGrainPlayers.forEach(player => {
            player.mute = muted;
        });
        
        this.log(`Mute set to ${muted}`);
    }

    // Helper for logging
    private log(message: string): void {
        this.onLog(message);
    }


}

// Export the class as default
export default MidiSampler;
