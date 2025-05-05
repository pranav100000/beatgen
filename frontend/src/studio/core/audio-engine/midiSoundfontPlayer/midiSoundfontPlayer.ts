// Import directly
import { AudioWorkletNodeSynthesizer } from 'js-synthesizer';
import { SequencerWrapper } from './sequencerWrapper';
import { Note } from '../../../../types/note';

/**
 * Options for adding a track to the player
 */
export interface TrackOptions {
  /** 
   * Start offset in ticks
   * - Negative value (e.g., -1000): Start 1000 ticks into the track
   * - Positive value (e.g., 1000): Delay playback by 1000 ticks
   */
  startTimeOffset?: number;
  /** Optional specific channel, otherwise auto-assigned */
  channel?: number;
  /** Initial volume (0-127) */
  volume?: number;
}

/**
 * Main controller for playing multiple MIDI tracks with soundfonts
 */
export class MidiSoundfontPlayer {
  private synth: AudioWorkletNodeSynthesizer;
  private tracks: Map<string, SequencerWrapper> = new Map();
  private isPlaying: boolean = false;
  private masterTick: number = 0;
  private processingInterval: ReturnType<typeof setInterval> | null = null;
  private readonly PROCESS_INTERVAL_MS = 10;
  private bpm: number; 
  private soundfontBankOffsets: Map<number, number> = new Map(); // Maps sfontId -> bankOffset
  private initPromise: Promise<void> | null = null; // Promise for tracking initialization
  private audioNode: AudioWorkletNode | null = null; // Store the audio node
  
  /**
   * Create a new MidiSoundfontPlayer
   * @param audioContext The audio context to use
   */
  constructor(bpm: number = 120) {
    // Initialize synthesizer
    this.synth = new AudioWorkletNodeSynthesizer();
    this.bpm = bpm;
  }
  
  /**
   * Initialize the synthesizer
   * @param audioContext The audio context to use
   */
  async initSynthesizer(audioContext: AudioContext): Promise<void> {
    // If already initializing, return the existing promise
    if (this.initPromise) {
      return this.initPromise;
    }
    
    // Create a new initialization promise
    this.initPromise = new Promise<void>((resolve, reject) => {
      const initialize = async () => {
        try {
          console.log('Initializing MidiSoundfontPlayer...');
          // Register worklet processor - load libfluidsynth first, then the worklet
          await audioContext.audioWorklet.addModule('/js-synthesizer/libfluidsynth-2.3.0.js');
          await audioContext.audioWorklet.addModule('/js-synthesizer/js-synthesizer.worklet.js');
          
          // Create node and connect
          this.audioNode = this.synth.createAudioNode(audioContext, {
            polyphony: 256 // High polyphony for multiple tracks
          });
          
          this.audioNode.connect(audioContext.destination);
          
          console.log('MidiSoundfontPlayer initialized successfully');
          resolve();
        } catch (error) {
          console.error('Failed to initialize MidiSoundfontPlayer:', error);
          this.initPromise = null; // Reset promise so we can try again
          reject(error);
        }
      };
      
      initialize();
    });
    
    return this.initPromise;
  }
  
  /**
   * Wait for the synthesizer to be fully initialized
   * @returns Promise that resolves when initialization is complete
   */
  async waitForInitialization(): Promise<void> {
    if (!this.initPromise) {
      throw new Error('Synthesizer initialization not started. Call initSynthesizer() first.');
    }
    return this.initPromise;
  }
  
  /**
   * Add a track to the player
   * @param id Unique identifier for the track
   * @param midiData MIDI file data
   * @param soundfontData Soundfont file data
   * @param options Additional options
   * @returns Promise resolving to the created track
   */
  async addTrack(id: string, notes: Note[], soundfontData: ArrayBuffer, options: TrackOptions = {}) {
    try {
      // Ensure synthesizer is initialized before proceeding
      if (!this.initPromise) {
        throw new Error('Cannot add track: synthesizer not initialized. Call initSynthesizer() first.');
      }
      
      // Wait for full initialization to complete
      await this.waitForInitialization();
      
      // Now we can safely load the soundfont
      console.log(`Loading soundfont for track "${id}"...`);
      const sfontId = await this.synth.loadSFont(soundfontData);
      
      // Note: Bank offset and program selection are now handled in SequencerWrapper.initialize()
      // to ensure proper offset application and bank selection in the correct order
      
      console.log(`Soundfont loaded with ID ${sfontId}`);
      
      // Still maintain the mapping for reference (SequencerWrapper will set offset = sfontId * 100)
      this.soundfontBankOffsets.set(sfontId, sfontId * 100);
      
      // Auto-assign channel if not specified
      const channel = options.channel ?? this.findFreeChannel();
      
      // Create sequencer wrapper
      const track = new SequencerWrapper(
        this.synth,
        sfontId,
        channel, 
        options.startTimeOffset ?? 0, // Offset in ticks
        options.volume ?? 100
      );
      
      // Initialize with MIDI data
      console.log(`Initializing track "${id}" with MIDI data...`);
      await track.initialize(notes);
      
      // Debug log before adding to tracks map
      console.log(`[DEBUG] Before adding to tracks map. Current size: ${this.tracks.size}`);
      console.log(`[DEBUG] Adding track "${id}" to tracks map...`);
      
      // Store in our tracks map
      this.tracks.set(id, track);
      
      // Debug log after adding
      console.log(`[DEBUG] After adding to tracks map. New size: ${this.tracks.size}`);
      console.log(`[DEBUG] Verifying track was added: ${this.tracks.has(id) ? 'SUCCESS' : 'FAILED'}`);
      
      // Additional check for the track in the map
      if (this.tracks.has(id)) {
        const retrievedTrack = this.tracks.get(id);
        console.log(`[DEBUG] Successfully retrieved track from map: ${retrievedTrack ? 'YES' : 'NO'}`);
      }
      
      console.log(`Track "${id}" added on channel ${channel}`);
      return track;
    } catch (error) {
      console.error(`Failed to add track "${id}":`, error);
      throw error;
    }
  }
  
  /**
   * Remove a track from the player
   * @param id The track ID to remove
   */
  removeTrack(id: string) {
    const track = this.tracks.get(id);
    if (track) {
      track.dispose(); // Clean up resources
      this.tracks.delete(id);
      console.log(`Track "${id}" removed`);
    } else {
      console.warn(`Track "${id}" not found, nothing to remove`);
    }
  }
  
  /**
   * Start or resume playback
   */
  async play() {
    if (this.isPlaying) return;
    
    console.log(`Starting playback from tick ${this.masterTick}`);
    
    // Make sure we have no active processing interval
    if (this.processingInterval !== null) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    //this.synth.setPlayerTempo(1, 120);
    
    // Start each track (in parallel for better performance)
    const trackEntries = Array.from(this.tracks.entries());
    const playPromises = trackEntries.map(async ([id, track]) => {
      console.log(`Starting track "${id}" for playback at global tick ${this.masterTick}`);
      // Use the track's play method to handle proper sequencer sync
      await track.play(this.masterTick);
    });
    
    // Wait for all tracks to be prepared
    await Promise.all(playPromises);
    
    this.isPlaying = true;
    
    // // Start processing loop - this is critical!
    // const trackList = Array.from(this.tracks.values());
    
    // Setup timing metrics
    let lastProcessTime = performance.now();
    let processingCycleCount = 0;
    
    // this.processingInterval = setInterval(async () => {
    //   // Timing diagnostics - measure actual elapsed time
    //   const currentTime = performance.now();
    //   const actualElapsedMs = currentTime - lastProcessTime;
    //   processingCycleCount++;
      
    //   // Log timing every 10 cycles
    //   if (processingCycleCount % 10 === 0) {
    //     console.log(`📊 TIMING: Actual interval=${actualElapsedMs.toFixed(2)}ms, Target=${this.PROCESS_INTERVAL_MS}ms, masterTick=${this.masterTick}`);
    //   }
      
    //   // Store current time for next cycle
    //   lastProcessTime = currentTime;
      
    //   // Check if there's a pending tempo change
    //   if (this.pendingTempoChange !== null) {
    //     const bpm = this.pendingTempoChange;
    //     this.pendingTempoChange = null; // Clear pending change
        
    //     // Apply tempo change to all tracks - this is safe here
    //     // because we're in a sequencer callback, as required by FluidSynth
    //     console.log(`Applying queued tempo change to ${bpm} BPM during processing interval`);
        
    //     const trackEntries = Array.from(this.tracks.entries());
    //     const promises = trackEntries.map(async ([id, track]) => {
    //       await track.setBPM(bpm);
    //     });
        
    //     // Wait for all tempo changes to complete
    //     await Promise.all(promises);
        
    //     console.log(`Tempo change to ${bpm} BPM completed`);
    //   }
      
    //   // Process all active sequencers - keep processing at same rate
    //   for (const track of trackList) {
    //     if (!track.isMuted) {
    //       // Continue using constant interval for processing
    //       //await track.process(this.PROCESS_INTERVAL_MS, this.masterTick);
    //     }
    //   }
      
    //   // But advance master timeline with actual elapsed time for accuracy
    //   // This ensures our playback position keeps up with real-world time
    //   this.masterTick += actualElapsedMs;
    // }, this.PROCESS_INTERVAL_MS);
  }
  
  /**
   * Pause playback
   */
  pause() {
    if (!this.isPlaying) return;
    
    console.log('Pausing playback');
    
    // Stop processing loop first to prevent further events
    if (this.processingInterval !== null) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Pause all tracks using their pause method
    const trackList = Array.from(this.tracks.values());
    for (const track of trackList) {
      track.pause();
    }
    
    this.isPlaying = false;
  }
  
  /**
   * Stop playback and reset position
   */
  async stop() {
    console.log('Stopping playback and resetting position');
    
    // Stop processing loop first
    if (this.processingInterval !== null) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Stop each track using their stop method (in parallel)
    const trackList = Array.from(this.tracks.values());
    const stopPromises = trackList.map(track => track.stop());
    await Promise.all(stopPromises);
    
    // Reset player state
    this.isPlaying = false;
    this.masterTick = 0;
    
    console.log('All tracks stopped and reset to beginning');
  }
  
  /**
   * Seek to a specific position
   * @param globalTimeMs Time in milliseconds to seek to
   */
  async seek(globalTimeMs: number) {
    console.log(`Seeking to ${globalTimeMs}ms`);
    
    const wasPlaying = this.isPlaying;
    
    // Pause playback during seek
    if (wasPlaying) {
      this.pause();
    }
    
    // Update master tick
    this.masterTick = globalTimeMs;
    
    // Seek each track (using Promise.all to do them in parallel)
    const trackEntries = Array.from(this.tracks.entries());
    const seekPromises = trackEntries.map(async ([id, track]) => {
      console.log(`Seeking track "${id}" to global time ${globalTimeMs}ms`);
      return track.seekToGlobalTime(globalTimeMs);
    });
    
    // Wait for all seeks to complete
    await Promise.all(seekPromises);
    
    // Resume if it was playing
    if (wasPlaying) {
      this.play();
    }
  }
  
  /**
   * Play a specific track
   * @param id The track ID to play
   */
  playTrack(id: string) {
    const track = this.tracks.get(id);
    if (track) {
      console.log(`Playing track "${id}"`);
      track.unmute();
      
      // If player is not running, start it now
      if (!this.isPlaying) {
        this.play();
      }
    } else {
      console.warn(`Track "${id}" not found`);
    }
  }
  
  /**
   * Pause a specific track
   * @param id The track ID to pause
   */
  pauseTrack(id: string) {
    const track = this.tracks.get(id);
    if (track) {
      console.log(`Pausing track "${id}"`);
      track.mute(); // Simplest way to "pause" a single track
    } else {
      console.warn(`Track "${id}" not found`);
    }
  }
  
  /**
   * Stop a specific track and reset its position
   * @param id The track ID to stop
   */
  stopTrack(id: string) {
    const track = this.tracks.get(id);
    if (track) {
      console.log(`Stopping track "${id}"`);
      track.resetPosition();
      track.mute();
    } else {
      console.warn(`Track "${id}" not found`);
    }
  }
  
  /**
   * Mute or unmute a track
   * @param id The track ID
   * @param muted Whether to mute the track
   */
  muteTrack(id: string, muted: boolean) {
    const track = this.tracks.get(id);
    if (track) {
      console.log(`${muted ? 'Muting' : 'Unmuting'} track "${id}"`);
      if (muted) {
        track.mute();
      } else {
        track.unmute();
      }
    } else {
      console.warn(`Track "${id}" not found`);
    }
  }
  
  /**
   * Set the volume of a track
   * @param id The track ID
   * @param volume Volume level (0-127)
   */
  setTrackVolume(id: string, volume: number) {
    const track = this.tracks.get(id);
    if (track) {
      console.log(`Setting volume of track "${id}" to ${volume}`);
      track.setVolume(volume);
    } else {
      console.warn(`Track "${id}" not found`);
    }
  }
  
  /**
   * Set the offset for a track in ticks
   * @param id The track ID
   * @param offset Offset value in ticks
   * - Negative value (e.g., -1000): Start 1000 ticks into the track
   * - Positive value (e.g., 1000): Delay playback by 1000 ticks
   */
  setTrackOffset(id: string, offset: number) {
    const track = this.tracks.get(id);
    if (track) {
      console.log(`Setting offset of track "${id}" to ${offset}`);
      track.setOffset(offset);
    } else {
      console.warn(`Track "${id}" not found`);
    }
  }
  
  /**
   * Get the current offset for a track
   * @param id The track ID
   * @returns The current offset in ticks, or undefined if track not found
   */
  getTrackOffset(id: string): number | undefined {
    const track = this.tracks.get(id);
    if (track) {
      return track.getOffset();
    }
    return undefined;
  }
  
  /**
   * Set the tempo for a specific track
   * @param id The track ID
   * @param bpm The tempo in BPM (Beats Per Minute)
   */
  async setTrackBPM(id: string, bpm: number): Promise<void> {
    const track = this.tracks.get(id);
    if (track) {
      console.log(`Setting tempo of track "${id}" to ${bpm} BPM`);
      await track.setBPM(bpm);
    } else {
      console.warn(`Track "${id}" not found`);
    }
  }
  
  /**
   * Get the current tempo of a track
   * @param id The track ID
   * @returns The current tempo in BPM, or undefined if track not found
   */
  getTrackBPM(id: string): number | undefined {
    const track = this.tracks.get(id);
    if (track) {
      return track.getBPM();
    }
    return undefined;
  }
  
  /**
   * Set the global tempo for all tracks
   * @param bpm The tempo in BPM (Beats Per Minute)
   */
  async setGlobalBPM(bpm: number): Promise<void> {
    if (bpm <= 0) {
      console.warn(`Invalid BPM value: ${bpm}, ignoring`);
      return;
    }
    
    console.log(`Queuing tempo change to ${bpm} BPM`);
    
    // If we're not playing, we can change the tempo immediately
    if (!this.isPlaying) {
      const trackEntries = Array.from(this.tracks.entries());
      const promises = trackEntries.map(async ([id, track]) => {
        await track.setBPM(bpm);
      });
      await Promise.all(promises);
      console.log(`Applied tempo change to ${bpm} BPM immediately (not playing)`);
    } else {
      // If we're playing, queue the tempo change for the next processing interval
      // This follows the FluidSynth documentation guidance to change tempo
      // during a sequencer callback or when no events are being dispatched
      this.bpm = bpm;
      console.log(`Tempo change to ${bpm} BPM queued for next processing interval`);
    }
  }
  
  getGlobalBPM(): number {
    return this.bpm;
  }
  
  /**
   * Find a free MIDI channel
   * @returns An available MIDI channel (0-15)
   */
  private findFreeChannel(): number {
    // Find first unused channel, avoiding 9 (drums)
    const trackList = Array.from(this.tracks.values());
    const usedChannels = new Set(
      trackList.map(t => t.getChannel)
    );
    
    // MIDI channels are 0-15, not 1-16
    for (let i = 0; i < 16; i++) {
      if (i !== 9 && !usedChannels.has(i)) {
        return i;
      }
    }
    
    // If all channels are used, reuse channel 1 (since 0 may have special use)
    console.warn('All non-drum MIDI channels are in use, reusing channel 1');
    return 1;
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    console.log('Disposing MidiSoundfontPlayer');
    
    this.pause();
    
    // Disconnect the main audio node first
    if (this.audioNode) {
        console.log('Disconnecting and cleaning up audio node...');
        try {
           this.audioNode.disconnect();
        } catch (e) {
            console.error("Error disconnecting audio node:", e);
        }
        this.audioNode = null; // Allow garbage collection
    } else {
        console.warn("Dispose called but audioNode was null.");
    }
    
    // Clean up all tracks
    const trackEntries = Array.from(this.tracks.entries());
    for (const [id, track] of trackEntries) {
      console.log(`Disposing track "${id}"`);
      track.dispose();
    }
    
    this.tracks.clear();
    this.soundfontBankOffsets.clear(); // Clear this map too

    // Potentially add cleanup for this.synth itself if js-synthesizer provides a dispose/terminate method for the main node?
    // Example: this.synth.terminateWorklet?.(); // Check js-synthesizer docs
    console.log('MidiSoundfontPlayer disposed');
  }
  
  /**
   * Get current position
   */
  getCurrentTick(): number {
    return this.masterTick;
  }
  
  /**
   * Check if player is currently playing
   */
  isPlayerPlaying(): boolean {
    return this.isPlaying;
  }
  
  /**
   * Get track by ID
   */
  getTrack(id: string): SequencerWrapper | undefined {
    return this.tracks.get(id);
  }
  
  /**
   * Get all track IDs
   */
  getTrackIds(): string[] {
    // Debug log the tracks map size
    console.log(`[DEBUG] MidiSoundfontPlayer.tracks Map contains ${this.tracks.size} entries`);
    
    if (this.tracks.size > 0) {
      console.log(`[DEBUG] Track IDs in map: ${Array.from(this.tracks.keys()).join(', ')}`);
    } else {
      console.log(`[DEBUG] Tracks Map is empty!`);
    }
    
    return Array.from(this.tracks.keys());
  }
  
  /**
   * Get the bank offset for a soundfont
   * @param sfontId The soundfont ID
   * @returns The bank offset, or undefined if not found
   */
  getSoundfontBankOffset(sfontId: number): number | undefined {
    return this.soundfontBankOffsets.get(sfontId);
  }
}