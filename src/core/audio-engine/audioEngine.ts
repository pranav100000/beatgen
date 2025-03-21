import * as Tone from 'tone';

export interface AudioTrack {
  id: string;
  name: string;
  channel: Tone.Channel;
  player?: Tone.Player;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  position?: {
    x: number; // Position in pixels from left (timeline position)
    y: number; // Position in pixels from top (track order)
  };
}

class AudioEngine {
  private static instance: AudioEngine;
  private mainOutput: Tone.Channel;
  private tracks: Map<string, AudioTrack>;

  private constructor() {
    this.mainOutput = new Tone.Channel().toDestination();
    this.tracks = new Map();
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public async initialize(): Promise<void> {
    try {
      console.log('AudioEngine: Starting Tone.js');
      await Tone.start();
      // Set context to start immediately
      Tone.getContext().resume();
      console.log('AudioEngine: Tone.js started successfully');
    } catch (error) {
      console.error('AudioEngine: Failed to start Tone.js:', error);
      throw error;
    }
  }

  public async createTrack(id: string, audioFile?: File): Promise<AudioTrack> {
    console.log(`Creating track ${id}, cleaning up existing...`);
    this.removeTrack(id);

    const channel = new Tone.Channel().connect(this.mainOutput);
    
    const track: AudioTrack = {
      id,
      name: `Track ${id}`,
      channel,
      volume: 0,
      pan: 0,
      muted: false,
      soloed: false
    };

    if (audioFile) {
      console.log(`Loading audio file for track ${id}`);
      const buffer = await audioFile.arrayBuffer();
      const player = new Tone.Player({
        url: URL.createObjectURL(new Blob([buffer])),
        loop: false,
        autostart: false,
      }).connect(channel);
      
      // Sync with transport immediately
      player.sync();
      track.player = player;
      await Tone.loaded();
      console.log(`Audio loaded for track ${id}`);
    }

    this.tracks.set(id, track);
    return track;
  }

  public removeTrack(id: string): void {
    const track = this.tracks.get(id);
    if (track) {
      if (track.player) {
        track.player.stop();
        track.player.dispose();  // dispose handles both unsync and disconnect
      }
      track.channel.dispose();
      this.tracks.delete(id);
    }
  }

  public setTrackVolume(id: string, volume: number): void {
    const track = this.tracks.get(id);
    if (track) {
      track.volume = volume;
      track.channel.volume.value = track.muted ? -Infinity : volume;
    }
  }

  public setTrackPan(id: string, pan: number): void {
    const track = this.tracks.get(id);
    if (track) {
      track.pan = pan;
      track.channel.pan.value = pan;
    }
  }

  public setTrackMute(id: string, muted: boolean): void {
    const track = this.tracks.get(id);
    if (track) {
      track.muted = muted;
      track.channel.volume.value = muted ? -Infinity : track.volume;
    }
  }

  public getAllTracks(): AudioTrack[] {
    return Array.from(this.tracks.values());
  }

  public setMasterVolume(volume: number): void {
    this.mainOutput.volume.value = volume;
  }

  // Stops all playback and should only be used for full stop, not pause
  public stopAllPlayback(): void {
    console.log('Stopping all playback (full stop)');
    this.tracks.forEach((track, id) => {
      if (track.player) {
        console.log(`Stopping player for track ${id}`);
        // With Tone.js, we need to be careful with stop() as it completely stops the player
        // Only stop if it's actually playing
        if (track.player.state === "started") {
          track.player.stop();  
        }
        
        // Keep synced with transport
        track.player.sync();
      }
    });
  }
  
  // Add a method specifically for pausing (doesn't actually stop the players)
  public pauseAllPlayback(): void {
    console.log('Pausing all playback (maintain position)');
    // For pause, we don't actually call stop() on the players
    // We just let the transport pause and the players will pause with it
    // since they are synced to the transport
    this.tracks.forEach((track, id) => {
      if (track.player && track.player.state === "started") {
        console.log(`Track ${id} player synced with paused transport`);
      }
    });
  }

  // Add method to update track name
  public setTrackName(id: string, name: string): void {
    const track = this.tracks.get(id);
    if (track) {
      track.name = name;
    }
  }
  
  // Set a track's position on the timeline
  public setTrackPosition(id: string, x: number, y: number): void {
    const track = this.tracks.get(id);
    if (track) {
      track.position = { x, y };
      console.log(`AudioEngine: Set track ${id} position to x:${x}, y:${y}`);
    }
  }
}

export default AudioEngine; 