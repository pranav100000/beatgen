import * as JSSynth from 'js-synthesizer';

/**
 * MIDI Player implementation using js-synthesizer (FluidSynth WebAssembly)
 * This player provides high-performance MIDI playback with full seeking capabilities
 */
export class JSSynthMidiPlayer {
  private ctx: AudioContext | null = null;
  private synth: JSSynth.ISynthesizer | null = null;
  private destinationNode: AudioNode | null = null;
  private playing: boolean = false;
  private paused: boolean = false;
  private midiDuration: number = 0;
  private startTime: number = 0;
  private pausedPosition: number = 0;
  private isInitialized: boolean = false;
  private positionUpdateCallback: ((position: number) => void) | null = null;
  private updateIntervalId: number | null = null;
  private isLibraryReady: boolean = false;

  /**
   * Initialize the player and wait for js-synthesizer to be ready
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Wait for the library to be ready
      await JSSynth.waitForReady();
      this.isLibraryReady = true;
      console.log('js-synthesizer is ready');
      
      // Create audio context
      this.ctx = new AudioContext();
      
      // Create synthesizer
      this.synth = new JSSynth.Synthesizer();
      
      // Initialize the synthesizer with the audio context sample rate
      await this.synth.init(this.ctx.sampleRate);
      
      // Set up the destination node
      this.destinationNode = this.ctx.destination;
      
      // Connect the synthesizer to the audio context
      await this.connectOutput();
      
      this.isInitialized = true;
      console.log('JSSynthMidiPlayer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize JSSynthMidiPlayer:', error);
      throw error;
    }
  }

  /**
   * Connect the synthesizer output to the AudioContext
   */
  private async connectOutput(): Promise<void> {
    if (!this.synth || !this.ctx || !this.destinationNode) {
      throw new Error('Synthesizer or audio context not initialized');
    }
    
    try {
      // Create output node in AudioWorklet mode for best performance
      await this.synth.createAudioNode(this.ctx, {
        // Use AudioWorklet when available for better performance
        useWorklet: true,
        // Use playback rendering mode for real-time playback
        renderingMode: JSSynth.RenderingMode.Playback
      });
      
      // Connect the output to the destination
      this.synth.connect(this.destinationNode);
      console.log('Audio output connected');
    } catch (error) {
      console.error('Failed to connect audio output:', error);
      throw error;
    }
  }

  /**
   * Load a soundfont and MIDI file
   * @param soundfontUrl URL to the soundfont file (.sf2)
   * @param midiUrl URL to the MIDI file (.mid)
   */
  async load(soundfontUrl: string, midiUrl: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.synth) {
      throw new Error('Synthesizer not initialized');
    }
    
    try {
      console.log(`Loading soundfont from: ${soundfontUrl}`);
      console.log(`Loading MIDI from: ${midiUrl}`);
      
      // Fetch soundfont file
      const sfResponse = await fetch(soundfontUrl);
      const sfBuffer = await sfResponse.arrayBuffer();
      
      // Fetch MIDI file
      const midiResponse = await fetch(midiUrl);
      const midiBuffer = await midiResponse.arrayBuffer();
      
      // Reset any existing state
      await this.resetState();
      
      // Load soundfont
      await this.synth.loadSFont(sfBuffer);
      console.log('Soundfont loaded successfully');
      
      // Add MIDI data to player
      await this.synth.addSMFDataToPlayer(midiBuffer);
      console.log('MIDI file loaded successfully');
      
      // Get the MIDI file duration
      // Note: js-synthesizer doesn't provide a direct way to get duration,
      // we need to manually calculate or estimate it
      await this.calculateMidiDuration();
      
      // Resume audio context (required after user interaction)
      if (this.ctx && this.ctx.state !== 'running') {
        await this.ctx.resume();
      }
    } catch (error) {
      console.error('Failed to load soundfont or MIDI file:', error);
      throw error;
    }
  }

  /**
   * Calculate or estimate the MIDI file duration
   * This is an estimation as js-synthesizer doesn't provide a direct way to get duration
   */
  private async calculateMidiDuration(): Promise<void> {
    if (!this.synth) {
      throw new Error('Synthesizer not initialized');
    }
    
    try {
      // Get MIDI file info
      const playerStatus = await this.synth.getPlayerStatus();
      if (playerStatus) {
        // Get duration in ticks
        const durationInTicks = playerStatus.totalTicks;
        
        // Get tempo and time division
        const tempo = 500000; // Default 120 BPM in microseconds
        const division = playerStatus.division || 480; // Default division
        
        // Calculate duration in seconds
        // Duration = (ticks * tempo) / (division * 1000000)
        this.midiDuration = (durationInTicks * tempo) / (division * 1000000);
        console.log(`Estimated MIDI duration: ${this.midiDuration.toFixed(2)} seconds`);
      }
    } catch (error) {
      console.error('Failed to calculate MIDI duration:', error);
      // Default to a reasonable duration if calculation fails
      this.midiDuration = 180; // 3 minutes as fallback
    }
  }

  /**
   * Reset the player state
   */
  private async resetState(): Promise<void> {
    if (!this.synth) return;
    
    try {
      // Stop any current playback
      this.stopPositionUpdates();
      
      // Stop the player first
      if (this.playing || this.paused) {
        await this.synth.stopPlayer();
      }
      
      // Reset internal state
      this.playing = false;
      this.paused = false;
      this.pausedPosition = 0;
      this.startTime = 0;
      
      // Reset player state
      await this.synth.resetPlayer();
      
      // Remove any existing soundfonts
      await this.synth.unloadAll();
    } catch (error) {
      console.error('Failed to reset player state:', error);
    }
  }

  /**
   * Start or resume playback
   */
  async play(): Promise<void> {
    if (!this.synth || !this.ctx) {
      throw new Error('Synthesizer or audio context not initialized');
    }
    
    try {
      // Resume audio context if needed
      if (this.ctx.state !== 'running') {
        await this.ctx.resume();
      }
      
      if (this.paused) {
        // Resume from paused position
        await this.seek(this.pausedPosition, true);
        this.paused = false;
      } else if (!this.playing) {
        // Start playback from beginning
        this.startTime = Date.now() / 1000;
        await this.synth.playPlayer();
        this.startPositionUpdates();
      }
      
      this.playing = true;
      console.log('Playback started');
    } catch (error) {
      console.error('Failed to start playback:', error);
      throw error;
    }
  }

  /**
   * Pause playback
   */
  async pause(): Promise<void> {
    if (!this.synth || !this.playing) return;
    
    try {
      // Get current position
      this.pausedPosition = this.getCurrentTime();
      console.log(`Paused at position: ${this.pausedPosition.toFixed(2)}s`);
      
      // Stop player
      await this.synth.stopPlayer();
      
      // Update state
      this.playing = false;
      this.paused = true;
      
      // Stop position updates
      this.stopPositionUpdates();
      
      console.log('Playback paused');
    } catch (error) {
      console.error('Failed to pause playback:', error);
      throw error;
    }
  }

  /**
   * Stop playback and reset position
   */
  async stop(): Promise<void> {
    if (!this.synth) return;
    
    try {
      // Stop the player
      await this.synth.stopPlayer();
      await this.synth.resetPlayer();
      
      // Update state
      this.playing = false;
      this.paused = false;
      this.pausedPosition = 0;
      this.startTime = 0;
      
      // Stop position updates
      this.stopPositionUpdates();
      
      console.log('Playback stopped');
    } catch (error) {
      console.error('Failed to stop playback:', error);
      throw error;
    }
  }

  /**
   * Seek to a specific position in the MIDI file
   * @param timeInSeconds The position to seek to in seconds
   * @param autoPlay Whether to automatically start playback after seeking
   */
  async seek(timeInSeconds: number, autoPlay: boolean = false): Promise<void> {
    if (!this.synth) {
      throw new Error('Synthesizer not initialized');
    }
    
    try {
      // Ensure position is within bounds
      const boundedTime = Math.max(0, Math.min(timeInSeconds, this.midiDuration));
      console.log(`Seeking to ${boundedTime.toFixed(2)}s of ${this.midiDuration.toFixed(2)}s total`);
      
      // Stop current playback
      const wasPlaying = this.playing;
      if (this.playing || this.paused) {
        await this.synth.stopPlayer();
        this.stopPositionUpdates();
      }
      
      // Convert seconds to ticks
      // This is an estimation that would need to be refined
      const playerStatus = await this.synth.getPlayerStatus() || { division: 480, totalTicks: 0 };
      const ticksPerSecond = playerStatus.totalTicks / this.midiDuration;
      const targetTicks = Math.floor(boundedTime * ticksPerSecond);
      
      // Seek to position
      await this.synth.seekPlayer(targetTicks);
      
      // Update state
      this.paused = !autoPlay && !wasPlaying;
      this.playing = autoPlay || wasPlaying;
      this.pausedPosition = boundedTime;
      this.startTime = (Date.now() / 1000) - boundedTime;
      
      // Resume playback if needed
      if (autoPlay || wasPlaying) {
        await this.synth.playPlayer();
        this.startPositionUpdates();
      }
    } catch (error) {
      console.error('Failed to seek:', error);
      throw error;
    }
  }

  /**
   * Get the current playback position in seconds
   */
  getCurrentTime(): number {
    if (this.paused) {
      return this.pausedPosition;
    }
    
    if (this.playing) {
      // Calculate based on elapsed time since playback started
      return Math.min((Date.now() / 1000) - this.startTime, this.midiDuration);
    }
    
    return 0;
  }

  /**
   * Get the total duration of the MIDI file in seconds
   */
  getDuration(): number {
    return this.midiDuration;
  }

  /**
   * Check if the player is currently playing
   */
  isActive(): boolean {
    return this.playing;
  }

  /**
   * Set a callback function to receive position updates
   * @param callback Function that receives the current position in seconds
   */
  onPositionUpdate(callback: (position: number) => void): void {
    this.positionUpdateCallback = callback;
  }

  /**
   * Start sending position updates
   */
  private startPositionUpdates(): void {
    this.stopPositionUpdates();
    
    if (this.positionUpdateCallback) {
      this.updateIntervalId = window.setInterval(() => {
        if (this.playing && this.positionUpdateCallback) {
          const position = this.getCurrentTime();
          this.positionUpdateCallback(position);
          
          // Check if we've reached the end
          if (position >= this.midiDuration) {
            this.handlePlaybackEnd();
          }
        }
      }, 100) as unknown as number;
    }
  }

  /**
   * Stop sending position updates
   */
  private stopPositionUpdates(): void {
    if (this.updateIntervalId !== null) {
      window.clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }
  }

  /**
   * Handle playback reaching the end of the MIDI file
   */
  private async handlePlaybackEnd(): Promise<void> {
    if (!this.synth) return;
    
    // Stop the player
    await this.synth.stopPlayer();
    
    // Update state
    this.playing = false;
    this.paused = false;
    this.pausedPosition = 0;
    
    // Stop position updates
    this.stopPositionUpdates();
    
    console.log('Playback completed');
  }

  /**
   * Clean up resources when the player is no longer needed
   */
  async dispose(): Promise<void> {
    try {
      this.stopPositionUpdates();
      
      if (this.synth) {
        // Stop any playback
        if (this.playing || this.paused) {
          await this.synth.stopPlayer();
        }
        
        // Disconnect audio
        this.synth.disconnect();
        
        // Close the synthesizer
        await this.synth.close();
        this.synth = null;
      }
      
      // Close audio context
      if (this.ctx) {
        await this.ctx.close();
        this.ctx = null;
      }
      
      console.log('JSSynthMidiPlayer disposed');
    } catch (error) {
      console.error('Error disposing JSSynthMidiPlayer:', error);
    }
  }
}