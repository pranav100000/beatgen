import { AudioWorkletNodeSynthesizer } from 'js-synthesizer';
import { ISequencer } from 'js-synthesizer';
import { Midi } from '@tonejs/midi';
import { Note } from '../../types/note';

/**
 * Custom types for event handling
 */
interface EventInstance {
  tick: number;
  event: {
    type: string;
    channel: number;
    key?: number;
    vel?: number;
    duration?: number;
    control?: number;
    value?: number;
    preset?: number;
  };
}

/**
 * Interface for active notes at a specific position
 */
interface ActiveNote {
  key: number;
  velocity: number;
  startTick: number;
  duration: number;
}

/**
 * Wrapper for js-synthesizer sequencer to handle a single MIDI track
 */
export class SequencerWrapper {
  private synth: AudioWorkletNodeSynthesizer;
  private sequencer!: ISequencer;
  private channel: number;
  private sfontId: number;
  private noteEvents: EventInstance[] = [];
  private currentLocalTick: number = 0;
  private startOffset: number; // Time offset in ticks
  private _isMuted: boolean = false;
  private originalVolume: number;
  private savedVolume: number | null = null;
  private _isPlaying: boolean = false;
  private ppq: number = 480; // Default MIDI Pulses Per Quarter Note
  private currentBpm: number = 120; // Default tempo

  constructor(
    synth: AudioWorkletNodeSynthesizer, 
    sfontId: number, 
    channel: number, 
    startOffset: number = 0, // Now in ticks instead of ms
    volume: number = 100
  ) {
    this.synth = synth;
    this.sfontId = sfontId;
    this.channel = channel;
    this.startOffset = startOffset; // Offset in ticks
    this.originalVolume = volume;
  }
  
  async initialize(midiData: Midi): Promise<SequencerWrapper> {
    console.log(`Initializing with sfontId ${this.sfontId} on channel ${this.channel}`);

    // Step 1: First set the bank offset before anything else
    const targetOffset = this.sfontId * 100; // Use a large unique offset
    this.synth.setSFontBankOffset(this.sfontId, targetOffset);

    // Step 2: Verify the offset was applied correctly
    const actualOffset = await this.synth.getSFontBankOffset(this.sfontId);
    console.log(`Bank offset for sfontId ${this.sfontId}: requested=${targetOffset}, actual=${actualOffset}`);

    if (actualOffset !== targetOffset) {
      console.warn(`Bank offset mismatch! This can cause soundfont conflicts.`);
    }

    // Step 3: Create and set up sequencer (after bank offset is confirmed)
    this.sequencer = await this.synth.createSequencer();
    await this.sequencer.registerSynthesizer(this.synth);
    
    
    // Extract PPQ from MIDI file if available
    if (midiData.header && midiData.header.ppq) {
      this.ppq = midiData.header.ppq;
      console.log(`MIDI file has PPQ: ${this.ppq}`);
    }
    
    // Extract tempo from MIDI file if available
    if (midiData.header && midiData.header.tempos && midiData.header.tempos.length > 0) {
      this.currentBpm = midiData.header.tempos[0].bpm;
      console.log(`MIDI file has tempo: ${this.currentBpm} BPM`);
    }
    
    // Apply the tempo through time scale
    this.applyTempoToTimeScale();
    
    // Debugging - log the applied time scale (async)
    this.debugTimeScale().catch(err => console.error("Error debugging time scale:", err));
    
    // Step 4: Find available presets in this soundfont
    try {
      const soundfontObject = await this.synth.getSFontObject(this.sfontId);
      const presetIterable = await soundfontObject.getPresetIterable();
      const presets = [...presetIterable];
      
      console.log(`Soundfont ${this.sfontId} contains ${presets.length} presets:`, 
                 presets.slice(0, 5).map(p => `bank ${p.bankNum}, preset ${p.num}`).join(', ') + 
                 (presets.length > 5 ? '...' : ''));
      
      if (presets.length > 0) {
        // Step 5: Select the first available preset from this soundfont
        const firstPreset = presets[0];
        
        // Step 6: Apply bank offset when selecting program
        const bankWithOffset = firstPreset.bankNum + actualOffset;
        console.log(`Selecting program: channel=${this.channel}, sfont=${this.sfontId}, bank=${bankWithOffset} (${firstPreset.bankNum}+${actualOffset}), preset=${firstPreset.num}`);
        
        // Select program with the correct bank offset
        this.synth.midiProgramSelect(this.channel, this.sfontId, bankWithOffset, firstPreset.num);
      } else {
        console.warn(`No presets found in soundfont ${this.sfontId}!`);
      }
    } catch (err) {
      console.warn(`Failed to enumerate presets in soundfont ${this.sfontId}:`, err);
      
      // Try common General MIDI instruments as fallbacks
      const commonPrograms = [0, 1, 24, 48, 73]; // Piano, Piano, Guitar, Strings, Flute
      
      let programSelected = false;
      for (const program of commonPrograms) {
        try {
          const bankWithOffset = actualOffset; // Bank 0 + offset
          this.synth.midiProgramSelect(this.channel, this.sfontId, bankWithOffset, program);
          console.log(`Selected fallback program ${program} from bank 0+offset of soundfont ${this.sfontId} on channel ${this.channel}`);
          programSelected = true;
          break;
        } catch (fallbackErr) {
          // Continue trying next program
        }
      }
      
      if (!programSelected) {
        console.error(`Could not select any program for soundfont ${this.sfontId}`);
      }
    }
    
    // Convert MIDI to note events
    this.noteEvents = this.convertMidiToNoteEvents(midiData, this.channel);
    
    // Set initial volume
    this.setVolume(this.originalVolume);
    
    console.log(`Sequencer initialized on channel ${this.channel} with ${this.noteEvents.length} events`);
    
    return this;
  }
  
  /**
   * Update the sequencer time scale based on current BPM and PPQ
   * 
   * This version doesn't use async/await to ensure it can be called 
   * directly within a sequencer callback
   */
  private applyTempoToTimeScale(): void {
    // Calculate ticks per second based on BPM and PPQ
    // Formula: (BPM * PPQ) / 60 seconds
    const ticksPerSecond = (this.currentBpm * this.ppq) / 60;
    
    console.log(`Directly setting time scale to ${ticksPerSecond} ticks/second (${this.currentBpm} BPM, ${this.ppq} PPQ)`);
    
    // Direct call to setTimeScale - no async/await
    // This preserves the callback context when called from the interval
    this.sequencer.setTimeScale(ticksPerSecond);
  }
  
  /**
   * This is an async version that logs before/after values
   * Used for debugging and initialization, not for tempo changes during playback
   */
  private async debugTimeScale(): Promise<void> {
    const currentTimeScale = await this.sequencer.getTimeScale();
    const ticksPerSecond = (this.currentBpm * this.ppq) / 60;
    
    console.log(`Current time scale: ${currentTimeScale}, target: ${ticksPerSecond} (${this.currentBpm} BPM)`);
  }
  
  // Called by master player's processing loop
  process(msecElapsed: number, globalTick: number): void {
    // Get the highest event tick time in our MIDI data
    const lastEventTick = this.getLastEventTick();
    
    // Calculate how many ticks to advance based on current tempo
    const ticksPerSecond = (this.currentBpm * this.ppq) / 60;
    const ticksToAdvance = (msecElapsed * ticksPerSecond) / 1000;
    
    // console.log("________lastEventTick", lastEventTick);
    // console.log("________ticksPerSecond", ticksPerSecond);
    // console.log("________ticksToAdvance", ticksToAdvance);
    // console.log("________currentLocalTick", this.currentLocalTick);
    // Only process the sequencer if we haven't reached the end of the track
    if (this.currentLocalTick <= lastEventTick + ticksPerSecond) { // Add ~1 second buffer for last note to finish playing
      // Process the sequencer using the calculated ticks
      // This correctly handles tempo changes by advancing the right number of ticks
      this.sequencer.processSequencer(ticksToAdvance);
    } else {
      this.sequencer.close();
    }
    
    // Update local position based on global tick
    this.updateLocalPosition(globalTick);
  }
  
  // Helper method to find the highest tick value in our events
  private getLastEventTick(): number {
    if (this.noteEvents.length === 0) return 0;
    
    let lastTick = 0;
    for (const event of this.noteEvents) {
      if (event.tick > lastTick) {
        lastTick = event.tick;
        
        // For note events, consider the duration too
        if (event.event.type === 'note' && event.event.duration) {
          lastTick = Math.max(lastTick, event.tick + event.event.duration);
        }
      } else {
        console.log("________event.tick", event.tick);
      }
    }
    
    return lastTick;
  }
  
  // Prepare for playback, scheduling from current position
  async prepareForPlayback(globalTick: number): Promise<void> {
    if (this._isMuted) return;
    
    // Calculate local time relative to global tick
    const localTick = this.globalToLocalTick(globalTick);
    this.currentLocalTick = localTick;
    
    // Get current sequencer tick
    const currentTick = await this.sequencer.getTick();
    
    // If the sequencer's internal position is ahead of where we want to start,
    // we need to recreate it to ensure proper timing
    if (currentTick > localTick || Math.abs(currentTick - localTick) > 10) {
      console.log(`Sequencer tick ${currentTick} doesn't match desired tick ${localTick}, recreating`);
      await this.recreateSequencer();
    }
    
    // Schedule events from localized tick position
    // This already takes the offset into account
    this.scheduleEvents(localTick);
  }
  
  // Convert global timeline to track-local timeline
  globalToLocalTick(globalTick: number): number {
    // globalTick is in our master timeline units (milliseconds)
    // We need to apply our offset (in ticks) to convert to local timeline
    
    // First convert global ms to ticks at current tempo
    const ticksPerSecond = (this.currentBpm * this.ppq) / 60;
    const ticksPerMs = ticksPerSecond / 1000;
    const globalTicksEquivalent = globalTick * ticksPerMs;
    
    // Apply the offset (already in ticks)
    // For negative offset: This will increase the local tick (skip ahead)
    // For positive offset: This will decrease the local tick (delay events)
    return globalTicksEquivalent - this.startOffset;
  }
  
  // Update local position based on global tick
  updateLocalPosition(globalTick: number): void {
    this.currentLocalTick = this.globalToLocalTick(globalTick);
  }
  
  // Seek to a position in global timeline
  async seekToGlobalTime(globalTick: number): Promise<void> {
    // Calculate local time relative to global tick
    // This applies our offset (both positive and negative)
    const localTick = this.globalToLocalTick(globalTick);
    
    // Get current sequencer tick
    const currentTick = await this.sequencer.getTick();
    console.log(`Sequencer current tick: ${currentTick}, seeking to: ${localTick}`);
    
    // Always recreate the sequencer when seeking
    // This is the most reliable way to ensure proper timing
    console.log(`Recreating sequencer for channel ${this.channel} for seek operation`);
    await this.recreateSequencer();
    
    // Stop all active notes
    this.silence();
    
    // Update our position
    this.currentLocalTick = localTick;
    
    // If playing, schedule upcoming events
    if (this._isPlaying) {
      // Schedule only upcoming events (don't worry about currently active notes)
      let scheduledCount = 0;
      for (const event of this.noteEvents) {
        // This is the key fix for negative offsets:
        // We need to compare against the localTick which already includes the offset adjustment
        if (event.tick >= localTick) {
          // Calculate the relative position from our current tick
          // When we have a negative offset, localTick already includes that adjustment
          const relativeTickFromNow = event.tick - localTick;
          
          // The isAbsolute=false parameter means this is relative to current sequencer position
          this.sequencer.sendEventAt(event.event as any, relativeTickFromNow, false);
          scheduledCount++;
        }
      }
      
      console.log(`Scheduled ${scheduledCount} events from tick ${localTick} on channel ${this.channel}`);
    }
  }
  
  // Recreate the sequencer from scratch
  private async recreateSequencer(): Promise<void> {
    // First silence and close the old sequencer
    this.silence();
    try {
      await this.sequencer.close();
    } catch (error) {
      console.warn('Error closing sequencer:', error);
    }
    
    // Create a new sequencer
    this.sequencer = await this.synth.createSequencer();
    
    // Register synthesizer with the new sequencer
    await this.sequencer.registerSynthesizer(this.synth);
    
    // Restore time scale
    this.applyTempoToTimeScale();
    const currentTimeScale = await this.sequencer.getTimeScale();
    console.log(`Time scale set to ${currentTimeScale}`);
    
    console.log(`Recreated sequencer for channel ${this.channel}`);
  }
  
  // Schedule events from current position
  private scheduleEvents(fromTick: number): void {

    console.log("________noteEvents", this.noteEvents);
    // Always clear existing events before scheduling new ones
    // This ensures we don't have duplicate events
    this.sequencer.removeAllEvents();
    
    // IMPORTANT: fromTick already has the offset applied from globalToLocalTick
    // So we use it directly without any further offset calculations
    
    // Schedule only upcoming events
    let scheduledCount = 0;
    let scheduledEvents = [];
    for (const event of this.noteEvents) {
      // Check if this event should be scheduled based on the position
      // This works for both positive and negative offsets because
      // the offset is already correctly applied in globalToLocalTick
      if (event.tick >= fromTick) {
        // Calculate relative position from current position
        const relativeTick = event.tick - fromTick;
        this.sequencer.sendEventAt(event.event as any, relativeTick, true);
        scheduledCount++;
        scheduledEvents.push(event);
      }
    }
    
    console.log(`Scheduled ${scheduledCount} events from tick ${fromTick} ` +
                `(with offset: ${this.startOffset}) on channel ${this.channel}`);

    console.log("________scheduledEvents", scheduledEvents);
  }
  
  // Silence all active notes and clear events
  silence(): void {
    // Send all notes off message
    this.synth.midiAllNotesOff(this.channel);
    
    // Also remove all events to prevent future playback
    if (this.sequencer) {
      this.sequencer.removeAllEvents();
    }
  }
  
  // Reset position to start
  resetPosition(): void {
    this.currentLocalTick = 0;
    this.sequencer.removeAllEvents();
  }
  
  /**
   * Play this track from current position
   * @param globalTick The current global timeline position
   */
  async play(globalTick: number): Promise<void> {
    console.log(")))))))))globalTick", globalTick);

    // console.log("______currentbpm", this.currentBpm);
    // console.log("______currentppq", this.ppq);
    // console.log("______currentstartoffset", this.startOffset);
    // console.log("________play with values:", this.noteEvents);
    // console.log("________len of note_events:", this.noteEvents.length);
    this._isPlaying = true;
    const localTick = this.globalToLocalTick(globalTick);
    this.currentLocalTick = localTick;
    
    // Get current sequencer tick to check if we need to recreate
    const currentTick = await this.sequencer.getTick();
    
    // If sequencer is not at expected position, recreate it
    if (currentTick > localTick || Math.abs(currentTick - localTick) > 10) {
      console.log(`Sequencer on channel ${this.channel} not at expected position (${currentTick} vs ${localTick}), recreating`);
      await this.recreateSequencer();
    }
    
    // Schedule events from current position
    this.scheduleEvents(localTick);
    
    console.log(`Track on channel ${this.channel} playing from ${localTick}ms`);
  }
  
  /**
   * Pause this track, silencing notes but maintaining position
   */
  pause(): void {
    this._isPlaying = false;
    // Silence notes and clear events
    this.silence();
    
    console.log(`Track on channel ${this.channel} paused at ${this.currentLocalTick}ms`);
  }
  
  /**
   * Stop this track and reset to beginning
   */
  async stop(): Promise<void> {
    this._isPlaying = false;
    // First silence all notes
    this.silence();
    
    // Completely recreate the sequencer to ensure it's fresh
    await this.recreateSequencer();
    
    // Reset position to beginning
    this.currentLocalTick = 0;
    
    console.log(`Track on channel ${this.channel} stopped and reset to beginning`);
  }
  
  // Mute/unmute controls
  mute(): void {
    if (this._isMuted) return;
    
    // Store current volume
    this.savedVolume = this.originalVolume;
    
    // Set volume to 0
    this.setVolume(0);
    
    // Silence any playing notes
    this.silence();
    
    this._isMuted = true;
  }
  
  unmute(): void {
    if (!this._isMuted) return;
    
    // Restore saved volume
    if (this.savedVolume !== null) {
      this.setVolume(this.savedVolume);
      this.savedVolume = null;
    } else {
      this.setVolume(this.originalVolume);
    }
    
    this._isMuted = false;
  }
  
  // Set volume
  setVolume(volume: number): void {
    const safeVolume = Math.max(0, Math.min(127, Math.round(volume)));
    this.originalVolume = safeVolume;
    
    try {
      // CC 7 = Channel Volume
      this.synth.midiControl(this.channel, 7, safeVolume);
    } catch (e) {
      console.warn(`Failed to set volume on channel ${this.channel}:`, e);
    }
  }
  
  // // Find notes active at a position
  // private findActiveNotesAt(tick: number): ActiveNote[] {
  //   const activeNotes: ActiveNote[] = [];
    
  //   for (const event of this.noteEvents) {
  //     if (event.event.type === 'note') {
  //       const startTick = event.tick;
  //       const duration = event.event.duration || 0;
  //       const endTick = startTick + duration;
        
  //       if (startTick <= tick && endTick > tick) {
  //         activeNotes.push({
  //           key: event.event.key!,
  //           velocity: event.event.vel!,
  //           startTick: startTick,
  //           duration: duration
  //         });
  //       }
  //     }
  //   }
    
  //   return activeNotes;
  // }
  
  // Cleanup
  async dispose(): Promise<void> {
    this.silence();
    this.sequencer.removeAllEvents();
    await this.sequencer.close();
  }
  
  // Getters
  get isMuted(): boolean {
    return this._isMuted;
  }
  
  get getChannel(): number {
    return this.channel;
  }
  
  /**
   * Set the track's offset in milliseconds
   * @param offsetMs Offset value in milliseconds
   * - Negative value (e.g., -1000): Start 1000ms into the track
   * - Positive value (e.g., 1000): Delay playback by 1000ms
   */
  setOffset(offsetMs: number): void {
    // Convert milliseconds to ticks based on current tempo and PPQ
    // Formula: ticks = ms * (BPM * PPQ) / (60 * 1000)
    const ticksPerSecond = (this.currentBpm * this.ppq) / 60;
    const ticksPerMs = ticksPerSecond / 1000;
    const offsetTicks = offsetMs * ticksPerMs;
    
    this.startOffset = offsetTicks;
    console.log(`Track on channel ${this.channel} offset set to ${offsetMs}ms (${offsetTicks.toFixed(2)} ticks)`);
  }
  
  /**
   * Get the current offset in milliseconds
   * @returns The current offset in milliseconds
   */
  getOffset(): number {
    // Convert ticks back to milliseconds based on current tempo and PPQ
    const ticksPerSecond = (this.currentBpm * this.ppq) / 60;
    const ticksPerMs = ticksPerSecond / 1000;
    
    // Avoid division by zero
    if (ticksPerMs === 0) return 0;
    
    const offsetMs = this.startOffset / ticksPerMs;
    return Math.round(offsetMs);
  }
  
  /**
   * Get the current offset in raw ticks (internal use)
   */
  getRawTickOffset(): number {
    return this.startOffset;
  }
  
  /**
   * Set the playback tempo in BPM (Beats Per Minute)
   * This is a simple method that just updates the currentBpm value.
   * The actual time scale change must happen in the processing loop.
   * 
   * @param bpm The new tempo in BPM
   */
  setBPM(bpm: number): void {
    if (bpm <= 0) {
      console.warn(`Invalid BPM value: ${bpm}, ignoring`);
      return;
    }
    
    // Get current offset in milliseconds before changing tempo
    const currentOffsetMs = this.getOffset();
    
    // Update current BPM
    this.currentBpm = bpm;
    
    // Re-apply the offset in milliseconds to ensure it remains consistent
    // This will automatically convert ms to the correct number of ticks at the new tempo
    if (currentOffsetMs !== 0) {
      this.setOffset(currentOffsetMs);
    }
    
    console.log(`Track on channel ${this.channel} BPM updated to ${bpm} (will be applied in next processing cycle)`);
  }
  
  /**
   * Apply the current BPM setting to the sequencer time scale.
   * This must only be called from within a sequencer callback
   * or when no event dispatching is happening.
   */
  applyCurrentBPM(): void {
    // This is safe to call from the processing interval
    this.applyTempoToTimeScale();
  }
  
  /**
   * Get the current tempo in BPM
   * @returns The current tempo in BPM
   */
  getBPM(): number {
    return this.currentBpm;
  }
  
  /**
   * Get the soundfont ID for this track
   * @returns The soundfont ID
   */
  getSoundFontId(): number {
    return this.sfontId;
  }

  /**
   * Get the bank offset used for this track's soundfont
   * @returns The bank offset (sfontId * 100)
   */
  getBankOffset(): number {
    return this.sfontId * 100;
  }

    /**
   * Update sequencer directly with Note array
   * This optimized method skips MIDI file conversion entirely
   */
  updateWithNotes(notes: Note[]): void {
    console.log(`SequencerWrapper: Updating channel ${this.channel} with ${notes.length} notes directly`);
    
    // Convert notes directly to event instances
    this.noteEvents = this.convertNotesToEvents(notes);
    // Apply the tempo
    this.applyTempoToTimeScale();
    
    // If playing, reschedule events
    if (this._isPlaying) {
      this.scheduleEvents(this.currentLocalTick);
    }
  }
  
  /**
   * Convert Note[] array directly to event instances
   * This avoids the overhead of MIDI file conversion
   */
  private convertNotesToEvents(notes: Note[]): EventInstance[] {
    const events: EventInstance[] = [];
    
    // Calculate ticks per second based on current BPM and PPQ
    const ticksPerSecond = (this.currentBpm * this.ppq) / 60;
    
    for (const note of notes) {
      // Convert grid position to time (in seconds), then to ticks
      const timeInSeconds = note.column / 4; // Convert grid position to time in seconds
      const startTick = Math.round(timeInSeconds * ticksPerSecond);
      
      // Convert grid length to duration (in ms)
      const durationInSeconds = note.length / 4; // Convert grid length to duration in seconds
      const duration = Math.round(durationInSeconds * 1000); // Convert to ms
      
      // Create note event
      events.push({
        tick: startTick,
        event: {
          type: 'note',
          channel: this.channel,
          key: note.row, // MIDI note number
          vel: (note.velocity <= 1) ? Math.round(note.velocity * 127) : note.velocity, // Default to 100 if not specified
          duration
        }
      });
    }
    
    return events;
  }
  
  /**
   * Convert a Midi object to a series of sequencer events
   * Original method - kept for initial setup and backward compatibility
   */
  convertMidiToNoteEvents(midi: Midi, channel: number, trackIndex: number = 0): EventInstance[] {
    const events: EventInstance[] = [];
    
    // Use the first track, or specified track
    const track = midi.tracks[trackIndex] || midi.tracks[0];
    if (!track) {
      console.warn('No tracks found in MIDI file');
      return events;
    }
    
    // Extract PPQ and BPM to calculate ticks per second
    const ppq = this.ppq; // Default PPQ if not available
    const bpm = this.currentBpm; // Default BPM if not available
    const ticksPerSecond = (bpm * ppq) / 60;
    
    console.log(`MIDI conversion using: BPM=${bpm}, PPQ=${ppq}, ticksPerSecond=${ticksPerSecond}`);
    
    // Process all notes in the track
    for (const note of track.notes) {
      // Convert note timing from seconds to ACTUAL ticks, not milliseconds
      // Uses the correct ticks-per-second calculation based on tempo and PPQ
      const startTick = Math.round(note.time * ticksPerSecond);
      const duration = Math.round(note.duration * 1000); // Duration still in ms for event handling
      
      // Create note event (single event with duration)
      events.push({
        tick: startTick,
        event: {
          type: 'note',
          channel: channel,
          key: note.midi,
          vel: (note.velocity <= 1) ? Math.round(note.velocity * 127) : note.velocity, // Convert 0-1 to 0-127
          duration: duration
        }
      });
    }
    
    return events;
  }
}