import MidiPlayer, { MidiTrack } from './midiPlayer';
import * as Tone from 'tone';

/**
 * Direct test for MidiPlayer functionality
 * This tests the MidiPlayer class in isolation to verify basic functionality
 */
export async function testMidiPlayerDirect(): Promise<any> {
  console.log('Starting direct MidiPlayer test...');
  
  try {
    // Get MidiPlayer instance
    const midiPlayer = MidiPlayer.getInstance();
    console.log('MidiPlayer instance created');
    
    // Wait a moment to ensure SpessaSynth is loaded
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create a test track ID
    const trackId = 'test-midi-track-' + Date.now();
    const trackName = 'Test MIDI Track';
    
    // Mock the SoundfontManager by directly injecting a mock into the MidiPlayer
    // Create track manually since we can't rely on the SoundfontManager
    console.log(`Manually creating MIDI track ${trackId}`);
    
    // Create a channel for the track
    const channel = new Tone.Channel().toDestination();
    
    // Create a test track
    const track: MidiTrack = {
      id: trackId,
      name: trackName,
      instrumentId: 'test-instrument',
      volume: 80,
      pan: 0,
      muted: false,
      soloed: false,
      channel
    };
    
    // Manually add the track to the MidiPlayer's tracks map
    const tracksMap = (midiPlayer as any).tracks;
    tracksMap.set(trackId, track);
    
    console.log('Track created manually:', track);
    
    // Load MIDI file
    console.log('Loading MIDI file...');
    
    // Fetch the MIDI file from the public directory
    const midiResponse = await fetch('/Grand Piano.mid');
    if (!midiResponse.ok) {
      throw new Error(`Failed to load MIDI file: ${midiResponse.status} ${midiResponse.statusText}`);
    }
    
    const midiData = await midiResponse.arrayBuffer();
    console.log(`MIDI file loaded (${midiData.byteLength} bytes)`);
    
    // Store the MIDI data for later use
    const midiBuffer = midiData;
    
    // Load SF2 soundfont directly
    console.log('Loading soundfont file directly...');
    const soundfontResponse = await fetch('/AI-APiano01trans.SF2');
    if (!soundfontResponse.ok) {
      throw new Error(`Failed to load soundfont: ${soundfontResponse.status} ${soundfontResponse.statusText}`);
    }
    
    const soundfontData = await soundfontResponse.arrayBuffer();
    console.log(`Soundfont loaded (${soundfontData.byteLength} bytes)`);
    
    // Load SpessaSynth directly
    console.log('Attempting to load SpessaSynth from spessasynth_lib...');
    
    // Try importing the module directly
    try {
      const spessaSynthModule = await import('spessasynth_lib');
      console.log('SpessaSynth loaded through direct import:', spessaSynthModule);
      (window as any).SpessaSynth = spessaSynthModule;
    } catch (error) {
      console.error('Failed to import spessasynth_lib directly:', error);
      // Fall back to global variables that might be set by MidiPlayer
      console.log('Falling back to global SpessaSynth object if available');
    }
    
    // Wait with timeout
    let attempts = 0;
    const maxAttempts = 10;
    while (!(window as any).SpessaSynth && attempts < maxAttempts) {
      console.log(`Waiting for SpessaSynth to load... (attempt ${attempts + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    if (!(window as any).SpessaSynth) {
      throw new Error('SpessaSynth failed to load after multiple attempts');
    }
    
    // Create a Synthetizer directly
    const SpessaSynth = (window as any).SpessaSynth;
    console.log('SpessaSynth loaded:', SpessaSynth);
    
    // Create an audio context node
    const ctx = Tone.getContext();
    const node = ctx.createMediaStreamDestination();
    const audioNode = ctx.createMediaStreamSource(node.stream);
    audioNode.connect(channel);
    
    // Create a synth
    try {
      console.log('Creating Synthetizer with parameters:', {
        destination: channel,
        soundfontDataLength: soundfontData.byteLength,
        enableReverb: true
      });
      
      // Create a Synthetizer instance - the constructor should take the audio destination and soundfont data
      // The SpessaSynth library interface can vary, so we try different approaches
      let synth: any;
      
      try {
        // Try first approach - constructor with 3 parameters
        synth = new SpessaSynth.Synthetizer(channel, new Uint8Array(soundfontData), true);
        console.log('Synthetizer created with direct parameters');
      } catch (err) {
        console.warn('First approach failed:', err);
        
        // Try second approach - constructor without parameters, then manual setup
        synth = new SpessaSynth.Synthetizer();
        console.log('Synthetizer created without parameters');
        
        // Set the output destination
        synth.outputDestination = node;
        console.log('Output destination set on synth');
        
        // Load the soundfont
        await synth.loadSoundfont(new Uint8Array(soundfontData));
        console.log('Soundfont loaded into synth');
      }
      
      // Assign the synth to the track
      track.synth = synth;
      console.log('Synth attached to track');
      
      // Load the MIDI file
      try {
        await synth.loadMIDI(new Uint8Array(midiBuffer));
        console.log('MIDI data loaded into synth');
      } catch (err) {
        console.error('Error loading MIDI data:', err);
        throw err;
      }
      
      // Play the MIDI file
      try {
        synth.play(0);
        console.log('MIDI playback started directly through synth');
      } catch (err) {
        console.error('Error playing MIDI:', err);
        throw err;
      }
      
      // Return the test controls
      return {
        trackId,
        play: async () => {
          try {
            if (track.synth) {
              track.synth.play(0);
              return true;
            }
            return false;
          } catch (error) {
            console.error('Error playing MIDI directly:', error);
            return false;
          }
        },
        stop: () => {
          try {
            if (track.synth) {
              track.synth.stop();
              return true;
            }
            return false;
          } catch (error) {
            console.error('Error stopping MIDI directly:', error);
            return false;
          }
        }
      };
      
    } catch (error) {
      console.error('Error creating synth:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in MidiPlayer direct test:', error);
    throw error;
  }
}

// Simple function to run the test
export function runMidiPlayerDirectTest(): void {
  console.log('Setting up MidiPlayer direct test...');
  
  // Add a listener for user interaction before starting
  const startTest = async () => {
    try {
      console.log('Starting test after user interaction...');
      const testResult = await testMidiPlayerDirect();
      console.log('Test completed successfully');
      
      // Store test result in window for manual testing via console
      (window as any).__midiTest = testResult;
      console.log('Test result available at window.__midiTest');
      console.log('Try the following commands in the console:');
      console.log('window.__midiTest.stop() - Stop playback');
      console.log('window.__midiTest.play() - Restart playback');
    } catch (error) {
      console.error('Test failed:', error);
    }
  };
  
  // Wait for user interaction (needed for audio context)
  document.addEventListener('click', startTest, { once: true });
  console.log('Click anywhere to start the MidiPlayer direct test');
}