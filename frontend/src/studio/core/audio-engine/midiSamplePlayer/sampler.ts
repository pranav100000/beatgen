import * as Tone from "tone";
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
    
    // Single pool of players for both direct playback and scheduled notes
    private playerPool: Tone.GrainPlayer[] = [];
    private readonly POOL_SIZE = 300; // Larger pool to handle more simultaneous notes
    
    // Master gain node for volume control
    private gainNode: Tone.Gain;
    private currentVolume: number = 100; // Store current volume (0-100)
    private isMuted: boolean = false;

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
                        await this.initializePlayerPool();
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

    // Initialize a pool of players that will be reused
    private async initializePlayerPool(): Promise<void> {
        if (!this.player?.buffer) {
            this.log("Cannot initialize player pool: no buffer loaded");
            return;
        }

        // Clean up existing pool first
        this.cleanupPlayerPool();
        
        const startTime = performance.now();
        this.log(`Initializing player pool with ${this.POOL_SIZE} players...`);

        // Create players in batches for UI responsiveness
        const batchSize = 50;
        for (let i = 0; i < this.POOL_SIZE; i += batchSize) {
            const endIdx = Math.min(i + batchSize, this.POOL_SIZE);
            
            // Create players in this batch
            for (let j = i; j < endIdx; j++) {
                try {
                    const player = new Tone.GrainPlayer();
                    
                    // Configure and connect each player immediately
                    player.buffer = this.player.buffer;
                    player.grainSize = this.player.grainSize;
                    player.overlap = this.player.overlap;
                    
                    // Connect to gain node instead of destination
                    player.connect(this.gainNode);
                    player.volume.value = -Infinity;
                    
                    this.playerPool.push(player);
                } catch (error) {
                    this.log(`Error creating player: ${error}`);
                }
            }
            
            // Yield to UI thread between batches
            if (i + batchSize < this.POOL_SIZE) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        const elapsed = performance.now() - startTime;
        this.log(`Player pool initialized in ${elapsed.toFixed(1)}ms, ${this.playerPool.length} players ready`);
    }

    // Get an available player from the pool
    private getPlayerFromPool(): Tone.GrainPlayer | null {
        // Look for a player that's not currently in use
        const availablePlayer = this.playerPool.find(p => !p.state.includes('started'));
        
        if (availablePlayer) {
            return availablePlayer;
        }
        
        // If no player is available, create a new one on demand
        if (this.player?.buffer) {
            try {
                const newPlayer = new Tone.GrainPlayer();
                newPlayer.buffer = this.player.buffer;
                newPlayer.grainSize = this.player.grainSize;
                newPlayer.overlap = this.player.overlap;
                newPlayer.toDestination();
                newPlayer.volume.value = -Infinity;
                
                // Add to pool for future reuse
                this.playerPool.push(newPlayer);
                
                this.log(`Created additional player (pool size now ${this.playerPool.length})`);
                return newPlayer;
            } catch (error) {
                this.log(`Error creating additional player: ${error}`);
            }
        }
        
        this.log("No available players in pool and couldn't create a new one");
        return null;
    }

    // Play a single note
    public playNote(
        midiNote: number,
        duration: number = 0.5,
        velocity: number = 0.8
    ): void {
        if (!this.player?.buffer) return;
        
        // Get a player for this note
        const player = this.getPlayerFromPool();
        if (!player) {
            this.log("No available players");
            return;
        }

        try {
            // Set up the player for this note
            const pitchShiftAmount = midiNote - this.baseNote;
            player.detune = pitchShiftAmount * 100;
            player.volume.value = Tone.gainToDb(velocity);
            
            // Get precise time and play
            const now = Tone.now();
            player.start(now).stop(now + duration);
            
            // Use a simple timeout for cleanup since this is direct playback
            setTimeout(() => {
                player.volume.value = -Infinity;
            }, (duration * 1000) + 50);
        } catch (error) {
            this.log(`Error playing note: ${error}`);
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
        console.log("grainPlayers", this.playerPool);
        
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
        const gridUnitTime = secPerBeat / 4 * 2; // Assuming 16th note grid
        
        // Add a small lookahead to compensate for transport timing delays
        const lookAheadTime = 0.025; // 25ms lookahead
        // Schedule all notes
        for (const note of this.notes) {
            // Calculate note time based on grid position
            const noteTimeInSeconds = note.column / (bpm * 4);
            
            // Only schedule notes that should play after the effective start time
            if (noteTimeInSeconds >= effectiveStartTime) {
                // Calculate note duration
                const noteDuration = note.length / secPerBeat;
                
                // Calculate the absolute time in the transport timeline when this note should play
                // Apply lookahead to schedule earlier to compensate for transport delay
                const absoluteTransportTime = Math.max(noteTimeInSeconds + this.offsetSeconds - lookAheadTime, 0);
                
                // Schedule at the adjusted absolute time
                Tone.Transport.schedule((time) => {
                    // Get a player from the pool at playback time
                    const player = this.getPlayerFromPool();
                    if (!player || !this.player?.buffer) return;
                    
                    try {
                        // Set pitch shift based on note
                        const pitchShiftAmount = note.row - this.baseNote;
                        player.detune = pitchShiftAmount * 100;
                        
                        // Set volume
                        player.volume.value = note.velocity 
                            ? Tone.gainToDb(note.velocity) 
                            : Tone.gainToDb(0.8);
                        
                        // Play the note directly at the scheduled time
                        if (!this.cutSelfOff) {
                            player.start(time);
                        } else {
                            player.start(time).stop(time + noteDuration);
                        }
                        
                        // Clean up when done
                        Tone.Transport.schedule(() => {
                            player.stop();
                            player.volume.value = -Infinity;
                        }, time + noteDuration + 0.01);
                        
                        this.log(`Playing note: ${Tone.Frequency(note.row, "midi").toNote()} at t=${time}, noteTime=${noteTimeInSeconds}s, offset=${this.offsetSeconds}s, absoluteTime=${absoluteTransportTime + lookAheadTime}s, transportTime=${Tone.Transport.seconds}s`);
                    } catch (error) {
                        this.log(`Error playing scheduled note: ${error}`);
                    }
                }, absoluteTransportTime);
            }
        }
    }

    // Stop playback
    public stopPlayback(): void {

        
        // Cancel scheduled events
        Tone.Transport.cancel(); 
        
        // Mark as stopped
        this.isPlaying = false;
        this.onPlaybackStatusChange(false);
        this.log(`Playback stopped - all audio silenced and events cancelled`);
    }
    
    // Clean up players in the pool
    private cleanupPlayerPool(): void {
        this.playerPool.forEach(player => player.dispose());
        this.playerPool = [];
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
        
        // Clean up the player pool
        this.cleanupPlayerPool();
    }
    
    /**
     * Clean up all resources when track is deleted or no longer needed
     */
    public dispose(): void {
        this.cleanupResources(true);
        
        // Also dispose the gain node
        this.gainNode.dispose();
        
        this.log('All resources disposed');
    }

    // Update grain size
    public setGrainSize(value: number): void {
        if (this.player) {
            this.player.grainSize = value;
            
            // Also update all pool players
            this.playerPool.forEach(player => {
                player.grainSize = value;
            });
            
            this.log(`Grain size set to ${value} seconds`);
        }
    }

    // Update overlap
    public setOverlap(value: number): void {
        if (this.player) {
            this.player.overlap = value;
            
            // Also update all pool players
            this.playerPool.forEach(player => {
                player.overlap = value;
            });
            
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