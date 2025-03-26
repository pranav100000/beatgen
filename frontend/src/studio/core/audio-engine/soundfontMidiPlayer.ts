import { Synthetizer, Sequencer, MIDI } from 'spessasynth_lib';

/**
 * Ultra minimal MIDI player with SF2 soundfont support
 */
export class SoundfontMidiPlayer {
  private ctx = new AudioContext();
  private synth: Synthetizer | null = null;
  private seq: Sequencer | null = null;
  private playing = false;

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
    
    // Create sequencer
    this.seq = new Sequencer([midi], this.synth, { autoPlay: false });
    
    // Enable audio on first user interaction
    document.addEventListener('click', () => this.ctx.resume(), { once: true });
  }

  // Minimal playback controls
  play() { 
    if (!this.playing && this.seq) {
      this.ctx.resume();
      this.seq.play();
      this.playing = true;
    }
  }
  
  pause() {
    if (this.playing && this.seq) {
      this.seq.pause();
      this.playing = false;
    }
  }
  
  stop() {
    if (this.seq) {
      this.seq.stop();
      this.playing = false;
    }
  }
  
  isActive() {
    return this.playing;
  }
}