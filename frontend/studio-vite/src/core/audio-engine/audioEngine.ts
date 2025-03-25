import * as Tone from 'tone';
import { convertVolumeToDecibels } from '../../utils/audioProcessing';

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

  public async createTrack(id: string, name: string, audioFile?: File): Promise<AudioTrack> {
    console.log(`Creating track ${id}, cleaning up existing...`);
    this.removeTrack(id);

    const channel = new Tone.Channel().connect(this.mainOutput);
    
    // Default volume is 80 (on 0-100 scale, which represents original volume)
    const defaultVolume = 80;
    
    // Convert the default volume to decibels and set the channel volume
    channel.volume.value = convertVolumeToDecibels(defaultVolume, false);
    
    // Get track name from the filename if available
    let trackName = audioFile ? audioFile.name.split('.')[0] : "MIDI Instrument";
    
    const track: AudioTrack = {
      id,
      name: name,
      channel,
      volume: defaultVolume,
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
      
      // Do NOT sync with transport immediately
      // This would cause unexpected behavior - players should only be synced right before playing
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
      
      // Convert UI volume (0-100) to appropriate dB scale using the utility function
      const volumeInDB = convertVolumeToDecibels(volume, track.muted);
      
      // Set the channel's volume
      track.channel.volume.value = volumeInDB;
      
      // If there's a player, also set its volume directly to ensure consistency
      if (track.player) {
        track.player.volume.value = volumeInDB;
      }
    }
  }

  public setTrackPan(id: string, pan: number): void {
    const track = this.tracks.get(id);
    if (track) {
      track.pan = pan;
      // Convert from UI range (-100 to 100) to Tone.js range (-1 to 1)
      const normalizedPan = pan / 100;
      track.channel.pan.value = normalizedPan;
    }
  }

  public setTrackMute(id: string, muted: boolean): void {
    const track = this.tracks.get(id);
    if (track) {
      track.muted = muted;
      // Convert volume to decibels using the correct utility function
      track.channel.volume.value = convertVolumeToDecibels(track.volume, muted);
      
      // If there's a player, also update its volume for consistency
      if (track.player) {
        track.player.volume.value = convertVolumeToDecibels(track.volume, muted);
      }
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
        
        // Do NOT resync here - this is a critical fix
        // Players should only be synced right before starting them with a specific offset
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