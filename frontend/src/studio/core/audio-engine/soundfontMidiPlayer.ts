import { Synthetizer, Sequencer, MIDI } from 'spessasynth_lib';

/**
 * Ultra minimal MIDI player with SF2 soundfont support
 */
export class SoundfontMidiPlayer {
  private ctx = new AudioContext();
  private synth: Synthetizer | null = null;
  private seq: Sequencer | null = null;
  private playing = false;
  private exactPauseTime: number | null = null;

  /**
   * Load soundfont and MIDI file
   */
  async load(soundfontUrl: string, midiUrl: string): Promise<void> {
    // Load worklet
    await this.ctx.audioWorklet.addModule('/worklet_processor.min.js');
    
    // Load soundfont
    const sfResponse = await fetch(soundfontUrl);
    const sfData = new Uint8Array(await sfResponse.arrayBuffer());
    
    // Create synthesizer with soundfont
    this.synth = new Synthetizer(this.ctx.destination, sfData, true);
    
    // Load MIDI file
    const midiResponse = await fetch(midiUrl);
    const midiData = new Uint8Array(await midiResponse.arrayBuffer());
    const midi = new MIDI(midiData, "midi");
    
    // Create sequencer with preservePlaybackState option to help with seeking
    this.seq = new Sequencer([midi], this.synth, { 
      autoPlay: false,
      preservePlaybackState: true 
    });
    
    // Enable audio on first user interaction
    document.addEventListener('click', () => this.ctx.resume(), { once: true });
  }

  // Playback controls
  play() { 
    if (!this.playing && this.seq) {
      this.ctx.resume();
      
      // If we have stored an exact pause time, restore it
      if (this.exactPauseTime !== null && this.seq) {
        // Set current time directly to ensure accurate position
        this.seq.currentTime = this.exactPauseTime;
        this.exactPauseTime = null;
      }
      
      // Use a small delay to ensure time setting is processed
      setTimeout(() => {
        if (this.seq) {
          this.seq.play(false); // false = don't reset time
          this.playing = true;
        }
      }, 5);
    }
  }
  
  pause() {
    if (this.playing && this.seq) {
      // Store exact time before pausing for accurate resumption
      this.exactPauseTime = this.seq.currentTime;
      console.log(`Paused at: ${this.exactPauseTime}s`);
      
      this.seq.pause();
      this.playing = false;
    }
  }
  
  stop() {
    if (this.seq) {
      this.seq.stop();
      // Reset position to beginning
      setTimeout(() => {
        if (this.seq) this.seq.currentTime = 0;
      }, 50);
      
      this.playing = false;
      this.exactPauseTime = null;
    }
  }
  
  /**
   * Seek to a specific position in the MIDI file
   * @param timeInSeconds Position to seek to in seconds
   * @param autoPlay Whether to start playback after seeking
   */
  seek(timeInSeconds: number, autoPlay: boolean = false) {
    if (!this.seq) return;
    
    // Ensure time is within valid range
    const duration = this.seq.duration;
    const boundedTime = Math.max(0, Math.min(timeInSeconds, duration));
    
    console.log(`Seeking to ${boundedTime}s of ${duration}s total`);
    
    // Store playback state
    const wasPlaying = this.playing;
    
    // If playing, pause first
    if (wasPlaying) {
      this.pause();
    }
    
    // Set position
    this.seq.currentTime = boundedTime;
    
    // Store position for accurate playback
    this.exactPauseTime = boundedTime;
    
    // Resume playback if requested or was playing before
    if (autoPlay || wasPlaying) {
      // Small delay to ensure seeking completes
      setTimeout(() => this.play(), 20);
    }
  }
  
  /**
   * Get current playback position in seconds
   */
  getCurrentTime(): number {
    if (!this.seq) return 0;
    return this.seq.currentTime;
  }
  
  /**
   * Get total duration of the MIDI file in seconds
   */
  getDuration(): number {
    if (!this.seq) return 0;
    return this.seq.duration;
  }
  
  isActive() {
    return this.playing;
  }
}