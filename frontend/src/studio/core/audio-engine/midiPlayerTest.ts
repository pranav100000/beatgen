import { Synthetizer, Sequencer, MIDI } from 'spessasynth_lib';

/**
 * Simple test function to load and play a MIDI file with a soundfont
 */
export async function testMidiPlayback(): Promise<void> {
  try {
    console.log('Starting MIDI player test...');
    
    // Create audio context
    const ctx = new AudioContext();
    
    // Try to resume the audio context (needed for browsers with autoplay policy)
    await ctx.resume();
    console.log('Audio context created and resumed');
    
    // Load the worklet module (this might be needed for some browsers)
    try {
      await ctx.audioWorklet.addModule('/worklet_processor.min.js');
      console.log('Audio worklet module loaded');
    } catch (error) {
      console.error('Failed to load audio worklet module:', error);
      console.log('Continuing without worklet module...');
    }
    
    // Load soundfont file
    console.log('Loading soundfont file...');
    const soundfontResponse = await fetch('/AI-APiano01trans.SF2');
    if (!soundfontResponse.ok) {
      throw new Error(`Failed to load soundfont: ${soundfontResponse.status} ${soundfontResponse.statusText}`);
    }
    const soundfontData = new Uint8Array(await soundfontResponse.arrayBuffer());
    console.log(`Soundfont loaded (${soundfontData.length} bytes)`);
    
    // Create synthesizer
    console.log('Creating synthesizer...');
    const synth = new Synthetizer(ctx.destination, soundfontData, true);
    console.log('Synthesizer created');
    
    // Load MIDI file
    console.log('Loading MIDI file...');
    const midiResponse = await fetch('/Grand Piano.mid');
    if (!midiResponse.ok) {
      throw new Error(`Failed to load MIDI file: ${midiResponse.status} ${midiResponse.statusText}`);
    }
    const midiData = new Uint8Array(await midiResponse.arrayBuffer());
    console.log(`MIDI file loaded (${midiData.length} bytes)`);
    
    // Parse MIDI data
    console.log('Parsing MIDI data...');
    const midi = new MIDI(midiData, 'midi');
    console.log('MIDI data parsed');
    
    // Create sequencer
    console.log('Creating sequencer...');
    const seq = new Sequencer([midi], synth, { autoPlay: false });
    console.log('Sequencer created successfully');
    
    // Play the MIDI file
    console.log('Starting playback...');
    seq.play();
    console.log('Playback started');
    
    // Return the sequencer for further control
    return {
      play: () => seq.play(),
      pause: () => seq.pause(),
      stop: () => seq.stop(),
      isPlaying: () => seq.isPlaying(),
      setPosition: (position: number) => seq.setTime(position)
    };
  } catch (error) {
    console.error('Error in MIDI player test:', error);
    throw error;
  }
}

// Simple function to run the test
export function runMidiTest(): void {
  // Add a listener for user interaction before starting
  const startTest = async () => {
    try {
      const player = await testMidiPlayback();
      console.log('Test completed successfully, playback started');
      
      // Store player controls in window for testing
      (window as any).__midiPlayer = player;
      console.log('Player controls available at window.__midiPlayer');
    } catch (error) {
      console.error('Test failed:', error);
    }
  };
  
  document.addEventListener('click', startTest, { once: true });
  console.log('Click anywhere to start the MIDI playback test');
}