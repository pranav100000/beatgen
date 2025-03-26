import { SoundfontMidiPlayer } from './soundfontMidiPlayer';

/**
 * Simple test using SoundfontMidiPlayer directly
 */
export async function testSoundfontMidiPlayer(): Promise<any> {
  console.log('Starting SoundfontMidiPlayer test...');
  
  try {
    // Create a new player instance
    const player = new SoundfontMidiPlayer();
    console.log('Created SoundfontMidiPlayer instance');
    
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
    player.play();
    console.log('Started playback');
    
    // Set up a timer to report playback position
    const positionInterval = setInterval(() => {
      if (player.isActive()) {
        const currentTime = player.getCurrentTime();
        console.log(`Current position: ${currentTime.toFixed(2)}s / ${duration.toFixed(2)}s`);
      }
    }, 2000); // Update every 2 seconds
    
    // Return the player instance for further control
    return {
      player,
      play: () => {
        player.play();
        console.log('Playback started');
        return true;
      },
      pause: () => {
        player.pause();
        console.log('Playback paused');
        return true;
      },
      stop: () => {
        player.stop();
        console.log('Playback stopped');
        return true;
      },
      seek: (position: number, autoPlay: boolean = false) => {
        player.seek(position, autoPlay);
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
      cleanup: () => {
        clearInterval(positionInterval);
        console.log('Position reporting stopped');
      }
    };
  } catch (error) {
    console.error('Error in SoundfontMidiPlayer test:', error);
    throw error;
  }
}

/**
 * Run the SoundfontMidiPlayer test
 */
export function runSoundfontMidiPlayerTest(): void {
  console.log('Setting up SoundfontMidiPlayer test...');
  
  // Clean up existing test if there is one
  if ((window as any).__soundfontTest?.cleanup) {
    (window as any).__soundfontTest.cleanup();
  }
  
  // Create a one-time click listener function
  const startTest = async () => {
    try {
      console.log('Starting test after user interaction...');
      const testResult = await testSoundfontMidiPlayer();
      console.log('Test completed successfully');
      
      // Store the test result in the window for manual testing
      (window as any).__soundfontTest = testResult;
      console.log('Test result available at window.__soundfontTest');
      console.log('Try the following commands in the console:');
      console.log('window.__soundfontTest.play() - Start playback');
      console.log('window.__soundfontTest.pause() - Pause playback');
      console.log('window.__soundfontTest.stop() - Stop playback');
      console.log('window.__soundfontTest.seek(10) - Seek to 10 seconds');
      console.log('window.__soundfontTest.getCurrentTime() - Get current position');
      console.log('window.__soundfontTest.getDuration() - Get total duration');
    } catch (error) {
      console.error('Test failed:', error);
    }
  };
  
  // Wait for user interaction (needed for AudioContext)
  document.addEventListener('click', startTest, { once: true });
  console.log('Click anywhere to start the SoundfontMidiPlayer test');
}