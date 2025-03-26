import { JSSynthMidiPlayer } from './jsSynthMidiPlayer';

/**
 * Test implementation using JSSynthMidiPlayer (FluidSynth WebAssembly-based player)
 */
export async function testJSSynthMidiPlayer(): Promise<any> {
  console.log('Starting JSSynthMidiPlayer test...');
  
  try {
    // Create a new player instance
    const player = new JSSynthMidiPlayer();
    console.log('Created JSSynthMidiPlayer instance');
    
    // Initialize the player
    await player.initialize();
    console.log('Player initialized');
    
    // Paths to files in the public directory
    const soundfontUrl = '/AI-APiano01trans.SF2';
    const midiUrl = '/Grand Piano.mid';
    
    console.log(`Loading soundfont from: ${soundfontUrl}`);
    console.log(`Loading MIDI from: ${midiUrl}`);
    
    // Load the soundfont and MIDI file
    await player.load(soundfontUrl, midiUrl);
    console.log('Successfully loaded soundfont and MIDI file');
    
    // Get the total duration
    const duration = player.getDuration();
    console.log(`MIDI file duration: ${duration.toFixed(2)} seconds`);
    
    // Play the MIDI file
    await player.play();
    console.log('Started playback');
    
    // Set up position update tracking
    let lastReportedPosition = -1;
    player.onPositionUpdate((position) => {
      // Only log if position changed by at least 1 second
      if (Math.floor(position) > Math.floor(lastReportedPosition)) {
        console.log(`Current position: ${position.toFixed(2)}s / ${duration.toFixed(2)}s`);
        lastReportedPosition = position;
      }
    });
    
    // Return the player instance and control interface
    return {
      player,
      play: async () => {
        await player.play();
        console.log('Playback started');
        return true;
      },
      pause: async () => {
        await player.pause();
        console.log('Playback paused');
        return true;
      },
      stop: async () => {
        await player.stop();
        console.log('Playback stopped');
        return true;
      },
      seek: async (position: number, autoPlay: boolean = false) => {
        await player.seek(position, autoPlay);
        console.log(`Seeked to position: ${position.toFixed(2)}s (autoPlay: ${autoPlay})`);
        return true;
      },
      getCurrentTime: () => {
        const time = player.getCurrentTime();
        console.log(`Current position: ${time.toFixed(2)}s`);
        return time;
      },
      getDuration: () => {
        return player.getDuration();
      },
      isPlaying: () => player.isActive(),
      cleanup: async () => {
        await player.dispose();
        console.log('Player disposed');
      }
    };
  } catch (error) {
    console.error('Error in JSSynthMidiPlayer test:', error);
    throw error;
  }
}

/**
 * Run the JSSynthMidiPlayer test
 */
export function runJSSynthMidiPlayerTest(): void {
  console.log('Setting up JSSynthMidiPlayer test...');
  
  // Clean up existing test if there is one
  if ((window as any).__jsSynthTest?.cleanup) {
    (window as any).__jsSynthTest.cleanup();
  }
  
  // Create a one-time click listener function
  const startTest = async () => {
    try {
      console.log('Starting test after user interaction...');
      const testResult = await testJSSynthMidiPlayer();
      console.log('Test completed successfully');
      
      // Store the test result in the window for manual testing
      (window as any).__jsSynthTest = testResult;
      console.log('Test result available at window.__jsSynthTest');
      console.log('Try the following commands in the console:');
      console.log('window.__jsSynthTest.play() - Start playback');
      console.log('window.__jsSynthTest.pause() - Pause playback');
      console.log('window.__jsSynthTest.stop() - Stop playback');
      console.log('window.__jsSynthTest.seek(10) - Seek to 10 seconds');
      console.log('window.__jsSynthTest.seek(10, true) - Seek to 10 seconds and play');
      console.log('window.__jsSynthTest.getCurrentTime() - Get current position');
      console.log('window.__jsSynthTest.getDuration() - Get total duration');
    } catch (error) {
      console.error('Test failed:', error);
    }
  };
  
  // Wait for user interaction (needed for AudioContext)
  document.addEventListener('click', startTest, { once: true });
  console.log('Click anywhere to start the JSSynthMidiPlayer test');
}