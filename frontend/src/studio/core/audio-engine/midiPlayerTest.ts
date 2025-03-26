// Simple test for SoundfontMidiPlayer
import { SoundfontMidiPlayer } from './soundfontMidiPlayer';

/**
 * This function tests the SoundfontMidiPlayer by:
 * 1. Creating a player instance
 * 2. Loading the soundfont and MIDI files
 * 3. Playing the MIDI file with the soundfont
 */
export async function testMidiPlayer(): Promise<SoundfontMidiPlayer> {
  console.log('Starting MIDI player test...');
  
  try {
    // Create a new player instance
    const player = new SoundfontMidiPlayer();
    console.log('Created SoundfontMidiPlayer instance');
    
    // Paths to the soundfont and MIDI files - they're in the same directory
    // with relative paths from the public directory
    const soundfontUrl = '/AI-APiano01trans.SF2';
    const midiUrl = '/Grand Piano.mid';
    
    console.log(`Loading soundfont from: ${soundfontUrl}`);
    console.log(`Loading MIDI from: ${midiUrl}`);
    
    // Load the soundfont and MIDI file
    await player.load(soundfontUrl, midiUrl);
    console.log('Successfully loaded soundfont and MIDI file');
    
    // Play the MIDI file
    player.play();
    console.log('Started playback');
    
    // Return the player instance so we can control it later
    return player;
  } catch (error) {
    console.error('Error in MIDI player test:', error);
    throw error;
  }
}

// Export a simple function to run the test from a UI component or console
export function runMidiPlayerTest(): void {
  testMidiPlayer()
    .then((player) => {
      console.log('Test completed successfully, playback started');
      
      // Store the player in window for manual testing from console
      (window as any).__midiPlayer = player;
      console.log('Player instance available as window.__midiPlayer for control via console');
      console.log('Try: window.__midiPlayer.pause(), window.__midiPlayer.play(), window.__midiPlayer.stop()');
    })
    .catch((error) => {
      console.error('Test failed:', error);
    });
}