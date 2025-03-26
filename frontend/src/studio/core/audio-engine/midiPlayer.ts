import * as Tone from 'tone';
import SoundfontManager from '../soundfont/soundfontManager';
import { db } from '../db/dexie-client';
import { convertVolumeToDecibels } from '../../utils/audioProcessing';

// Load SpessaSynth dynamically
let SpessaSynth: any = null;
// We'll import SpessaSynth dynamically to avoid issues with SSR
import('spessasynth_lib').then(module => {
  SpessaSynth = module;
  console.log('SpessaSynth loaded');
}).catch(err => {
  console.error('Failed to load SpessaSynth:', err);
});

export interface MidiTrack {
  id: string;
  name: string;
  instrumentId: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  synth?: any; // The SpessaSynth instance
  channel?: Tone.Channel;
  position?: {
    x: number; // Position in pixels from left (timeline position)
    y: number; // Position in pixels from top (track order)
  };
}

class MidiPlayer {
  private static instance: MidiPlayer;
  private tracks: Map<string, MidiTrack>;
  private soundfontManager: SoundfontManager;
  private mainOutput: Tone.Channel;
  
  private constructor() {
    this.tracks = new Map();
    this.soundfontManager = SoundfontManager.getInstance(db);
    this.mainOutput = new Tone.Channel().toDestination();
  }
  
  public static getInstance(): MidiPlayer {
    if (!MidiPlayer.instance) {
      MidiPlayer.instance = new MidiPlayer();
    }
    return MidiPlayer.instance;
  }
  
  /**
   * Initialize a new MIDI track with a specific instrument
   * @param trackId The track ID
   * @param instrumentId The instrument ID to load
   * @param name Optional track name
   */
  public async createTrack(trackId: string, instrumentId: string, name: string = `MIDI Track ${trackId}`): Promise<MidiTrack> {
    console.log(`Creating MIDI track ${trackId} with instrument ${instrumentId}`);
    
    // Clean up any existing track with this ID
    this.removeTrack(trackId);
    
    // Create a new channel for this track
    const channel = new Tone.Channel().connect(this.mainOutput);
    
    // Default volume is 80 (on 0-100 scale)
    const defaultVolume = 80;
    channel.volume.value = convertVolumeToDecibels(defaultVolume, false);
    
    // Create the track
    const track: MidiTrack = {
      id: trackId,
      name,
      instrumentId,
      channel,
      volume: defaultVolume,
      pan: 0,
      muted: false,
      soloed: false
    };
    
    // Attempt to load the instrument
    try {
      await this.loadInstrument(track);
    } catch (error) {
      console.error(`Failed to load instrument ${instrumentId} for track ${trackId}:`, error);
      // We'll continue with the track creation even if the instrument fails to load
      // This allows the user to try loading a different instrument later
    }
    
    // Store track
    this.tracks.set(trackId, track);
    return track;
  }
  
  /**
   * Load a soundfont instrument for a track
   * @param track The MIDI track to load an instrument for
   */
  private async loadInstrument(track: MidiTrack): Promise<void> {
    if (!SpessaSynth) {
      throw new Error('SpessaSynth not loaded yet');
    }
    
    try {
      // Get the soundfont data
      const soundfontData = await this.soundfontManager.getSoundfont(track.instrumentId);
      
      // Create a new Synthetizer instance (from spessasynth_lib)
      const synth = new SpessaSynth.Synthetizer(track.channel!, soundfontData, true);
      
      // No need to manually load the soundfont or set output destination,
      // as the Synthetizer constructor handles this
      
      // Store the synth on the track
      track.synth = synth;
      
      console.log(`Instrument ${track.instrumentId} loaded for track ${track.id}`);
    } catch (error) {
      console.error(`Error loading instrument ${track.instrumentId} for track ${track.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Remove and clean up a track
   * @param trackId The track ID to remove
   */
  public removeTrack(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track) {
      if (track.synth) {
        // Clean up the synth
        track.synth.stop();
        track.synth = null;
      }
      
      if (track.channel) {
        track.channel.dispose();
      }
      
      this.tracks.delete(trackId);
    }
  }
  
  /**
   * Play a MIDI file on a specific track
   * @param trackId The track ID
   * @param midiData The MIDI data (either a URL or ArrayBuffer)
   * @param startTime When to start playing (in seconds)
   */
  public async playMidiTrack(trackId: string, midiData: ArrayBuffer | string, startTime: number = 0): Promise<void> {
    const track = this.tracks.get(trackId);
    if (!track) {
      throw new Error(`Track ${trackId} not found`);
    }
    
    if (!track.synth) {
      throw new Error(`No instrument loaded for track ${trackId}`);
    }
    
    try {
      // Load the MIDI data
      await track.synth.loadMIDI(midiData);
      
      // Start playback at the specified time
      track.synth.play(startTime);
    } catch (error) {
      console.error(`Error playing MIDI on track ${trackId}:`, error);
      throw error;
    }
  }
  
  /**
   * Stop playback on a specific track
   * @param trackId The track ID
   */
  public stopMidiTrack(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track && track.synth) {
      track.synth.stop();
    }
  }
  
  /**
   * Stop all MIDI playback
   */
  public stopAllTracks(): void {
    this.tracks.forEach(track => {
      if (track.synth) {
        track.synth.stop();
      }
    });
  }
  
  /**
   * Set the volume for a track
   * @param trackId The track ID
   * @param volume Volume value (0-100)
   */
  public setTrackVolume(trackId: string, volume: number): void {
    const track = this.tracks.get(trackId);
    if (track && track.channel) {
      track.volume = volume;
      const volumeInDB = convertVolumeToDecibels(volume, track.muted);
      track.channel.volume.value = volumeInDB;
    }
  }
  
  /**
   * Set the pan value for a track
   * @param trackId The track ID
   * @param pan Pan value (-100 to 100)
   */
  public setTrackPan(trackId: string, pan: number): void {
    const track = this.tracks.get(trackId);
    if (track && track.channel) {
      track.pan = pan;
      // Convert from UI range (-100 to 100) to Tone.js range (-1 to 1)
      const normalizedPan = pan / 100;
      track.channel.pan.value = normalizedPan;
    }
  }
  
  /**
   * Mute or unmute a track
   * @param trackId The track ID
   * @param muted Mute state
   */
  public setTrackMute(trackId: string, muted: boolean): void {
    const track = this.tracks.get(trackId);
    if (track && track.channel) {
      track.muted = muted;
      const volumeInDB = convertVolumeToDecibels(track.volume, muted);
      track.channel.volume.value = volumeInDB;
    }
  }
  
  /**
   * Set a track's position on the timeline
   * @param trackId The track ID
   * @param x X position (time)
   * @param y Y position (track order)
   */
  public setTrackPosition(trackId: string, x: number, y: number): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.position = { x, y };
    }
  }
  
  /**
   * Change the instrument for a track
   * @param trackId The track ID
   * @param instrumentId The new instrument ID
   */
  public async changeInstrument(trackId: string, instrumentId: string): Promise<void> {
    const track = this.tracks.get(trackId);
    if (!track) {
      throw new Error(`Track ${trackId} not found`);
    }
    
    // Update the track's instrument ID
    track.instrumentId = instrumentId;
    
    // Clean up existing synth
    if (track.synth) {
      track.synth.stop();
      track.synth = null;
    }
    
    // Load the new instrument
    await this.loadInstrument(track);
    
    // Also update the instrumentId in the MidiFile record in the database
    try {
      if (await db.hasMidiTrack(trackId)) {
        const midiFile = await db.midiFiles
          .where('trackId')
          .equals(trackId)
          .first();
        
        if (midiFile && midiFile.id) {
          await db.updateMidiFile(midiFile.id, {
            instrumentId
          });
          console.log(`Updated instrumentId to ${instrumentId} in MidiFile record for track ${trackId}`);
        }
      }
    } catch (error) {
      console.error(`Failed to update instrumentId in MidiFile record for track ${trackId}:`, error);
      // Continue even if DB update fails - the in-memory state is still updated
    }
  }
  
  /**
   * Get all MIDI tracks
   */
  public getAllTracks(): MidiTrack[] {
    return Array.from(this.tracks.values());
  }
  
  /**
   * Get a specific track by ID
   * @param trackId The track ID
   */
  public getTrack(trackId: string): MidiTrack | undefined {
    return this.tracks.get(trackId);
  }
  
  /**
   * Set the master volume
   * @param volume Volume value (0-100)
   */
  public setMasterVolume(volume: number): void {
    this.mainOutput.volume.value = convertVolumeToDecibels(volume, false);
  }
}

export default MidiPlayer;