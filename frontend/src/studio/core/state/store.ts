import { ProjectManager, Track } from './project';
import { TransportController } from './transport';
import { MidiManager } from '../midi/MidiManager';
import { InstrumentManager } from '../instruments/InstrumentManager';
import AudioEngine from '../audio-engine/audioEngine';
import { TrackState } from '../types/track';
import * as Tone from 'tone';

/**
 * Interface for a drum pad in the drum machine grid
 */
export interface DrumPad {
  row: number;    // Row position (which drum sound)
  column: number; // Column position (which beat)
  velocity: number; // Velocity/volume (0-127)
}

export interface StoreInterface {
  getAudioEngine(): AudioEngine;
  getTransport(): TransportController;
  projectManager: ProjectManager;
  initializeAudio(): Promise<void>;
  createTrack(
    name: string, 
    type: 'audio' | 'midi' | 'video' | 'drum', 
    existingTrackData?: {
      id: string;
      volume?: number;
      pan?: number;
      muted?: boolean;
      soloed?: boolean;
    }
  ): Promise<Track>;
  getInstrumentManager(): InstrumentManager;
  getMidiManager(): MidiManager;
}

export class Store implements StoreInterface {
  private audioEngine: AudioEngine;
  public projectManager: ProjectManager;
  private transportController: TransportController;
  private initialized: boolean = false;
  private midiManager: MidiManager;
  private instrumentManager: InstrumentManager;
  private _tracks: TrackState[] = []; // Array of tracks
  private _listeners: Function[] = []; // Track change listeners

  constructor() {
    this.audioEngine = AudioEngine.getInstance();
    this.projectManager = new ProjectManager();
    this.transportController = new TransportController();
    this.midiManager = new MidiManager();
    this.instrumentManager = new InstrumentManager();
    
    // Initialize with project defaults
    const project = this.projectManager.getCurrentProject();
    if (project) {
      this.midiManager.setBpm(project.tempo);
      this.midiManager.setTimeSignature(project.timeSignature); // Default time signature
    }
    
    this.initialized = true;
  }

  public async initializeAudio(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.audioEngine.initialize();
      this.initialized = true;
      this.syncTracksFromProjectManager();
    } catch (error) {
      console.error('Store: Audio initialization failed:', error);
      throw error;
    }
  }

  /**
   * Synchronize tracks from ProjectManager to our internal tracks array
   */
  private syncTracksFromProjectManager(): void {
    const project = this.projectManager.getCurrentProject();
    if (!project) return;
    
    console.log('Synchronizing tracks from ProjectManager...');
    
    project.tracks.forEach(track => {
      this.addTrackToInternalState(track);
    });
    
    console.log(`Total tracks after sync: ${this._tracks.length}`);
  }

  public getTransport(): TransportController {
    return this.transportController;
  }

  public async createTrack(
    name: string, 
    type: 'audio' | 'midi' | 'video' | 'drum',
    existingTrackData?: {
      id: string;
      volume?: number;
      pan?: number;
      muted?: boolean;
      soloed?: boolean;
      instrumentId?: string;
      instrumentName?: string;
    }
  ): Promise<Track> {
    if (!this.initialized) {
      throw new Error('Store must be initialized before creating tracks');
    }
    
    console.log(`Store: Creating ${type} track with name: ${name}`, existingTrackData || 'No existing data');
    
    // Create track in project manager - use existing data if provided
    const track = existingTrackData 
      ? this.projectManager.addTrackWithProperties({
          id: existingTrackData.id,
          name,
          type,
          volume: existingTrackData.volume,
          pan: existingTrackData.pan,
          muted: existingTrackData.muted,
          soloed: existingTrackData.soloed,
          instrumentId: existingTrackData.instrumentId,
          instrumentName: existingTrackData.instrumentName
        })
      : this.projectManager.addTrack(name, type);
    
    console.log(`Store: Track created through ProjectManager:`, track);
    
    // For MIDI and drum tracks, handle persistence
    if (type === 'midi' || type === 'drum') {
      try {
        // Use MIDI persistence
        const project = this.projectManager.getCurrentProject();
        if (project) {
          // Ensure BPM is set
          this.midiManager.setBpm(project.tempo);
          
          // Create persisted track directly in MidiManager
          await this.midiManager.createTrackWithPersistence(
            track.id, // Always use the track ID (whether new or existing)
            name
          );
          
          if (existingTrackData) {
            console.log(`Store: Using existing ${type} track ID: ${track.id} for persistence`);
          } else {
            console.log(`Store: Created persisted ${type} track: ${track.id}`);
          }
        }
      } catch (error) {
        console.error(`Store: Error creating persisted ${type} track:`, error);
        // Continue even if persistence fails
      }
    }
    
    // Add track to our internal _tracks array
    this.addTrackToInternalState(track);
    
    return track;
  }

  /**
   * Add a track to the internal _tracks array
   */
  private addTrackToInternalState(track: Track): void {
    // Skip if this track is already in our internal array
    if (this._tracks.some(t => t.id === track.id)) {
      return;
    }
    
    // Create a channel for the track
    const channel = new Tone.Channel().toDestination();
    
    // Create the track state object with required properties
    const trackState: TrackState = {
      id: track.id,
      name: track.name,
      type: track.type,
      muted: track.muted,
      soloed: track.soloed,
      volume: track.volume,
      pan: track.pan,
      channel: channel,
      position: { x: 0, y: this._tracks.length * 40 }, // Default position
      drumPads: track.type === 'drum' ? [] : undefined
    };
    
    // Preserve instrument properties if present for MIDI or drum tracks
    if ((track.type === 'midi' || track.type === 'drum') && track.instrumentId) {
      trackState.instrumentId = track.instrumentId;
      trackState.instrumentName = track.instrumentName;
    }
    
    // Add to our internal tracks array
    this._tracks.push(trackState);
    
    console.log(`Added track ${track.id} of type ${track.type} to internal state`);
    
    // Notify listeners of new track
    this._notifyListeners();
  }

  public async loadAudioFile(trackId: string, file: File, position?: { x: number, y: number }): Promise<void> {
    // Pass the position directly to the transport controller
    // TransportController will handle setting the position in AudioEngine
    await this.transportController.loadAudioFile(trackId, file, position);
  }
  
  public async loadAudioFileFromUrl(trackId: string, url: string, position?: { x: number, y: number }): Promise<void> {
    try {
      console.log(`Fetching audio file from ${url} for track ${trackId}`);
      
      // Fetch the audio file
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio file: ${response.status} ${response.statusText}`);
      }
      
      // Convert the response to a blob
      const blob = await response.blob();
      
      // Create a File object from the blob
      const fileName = url.split('/').pop() || 'audio.mp3';
      const file = new File([blob], fileName, { 
        type: blob.type || 'audio/mpeg' 
      });
      
      // Load the file using the existing method with position if provided
      console.log(`Loading fetched audio file (${file.size} bytes) for track ${trackId}${position ? ` at position x:${position.x}, y:${position.y}` : ''}`);
      await this.loadAudioFile(trackId, file, position);
      
      console.log(`Successfully loaded audio file from URL for track ${trackId}`);
    } catch (error) {
      console.error(`Failed to load audio file from URL for track ${trackId}:`, error);
      throw error;
    }
  }

  public async removeTrack(id: string): Promise<void> {
    // Clean up MIDI resources if it's a MIDI or drum track
    // IMPORTANT: Do this BEFORE removing the track from _tracks
    const track = this._tracks.find(t => t.id === id);
    if (track && (track.type === 'midi' || track.type === 'drum')) {
      await this.midiManager.deleteTrackWithPersistence(id);
    }
    
    // Remove track from project manager
    this.projectManager.removeTrack(id);
    
    // Also remove from our internal tracks array
    this._tracks = this._tracks.filter(t => t.id !== id);
    
    // Remove from audio engine
    this.audioEngine.removeTrack(id);
    
    // Notify listeners of track changes
    this._notifyListeners();
  }

  public getAudioEngine(): AudioEngine {
    return this.audioEngine;
  }

  public getInstrumentManager(): InstrumentManager {
    return this.instrumentManager;
  }

  public getMidiManager(): MidiManager {
    return this.midiManager;
  }

  /**
   * Add a listener for track changes
   */
  public addListener(listener: Function): void {
    this._listeners.push(listener);
  }

  /**
   * Remove a listener
   */
  public removeListener(listener: Function): void {
    const index = this._listeners.indexOf(listener);
    if (index !== -1) {
      this._listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of changes
   */
  private _notifyListeners(): void {
    this._listeners.forEach(listener => listener());
  }

  /**
   * Gets the track with the specified ID
   */
  public getTrackById(trackId: string): TrackState | undefined {
    return this._tracks.find(t => t.id === trackId);
  }

  /**
   * Gets the drum pads for a track
   */
  public getDrumPads(trackId: string): DrumPad[] {
    const track = this._tracks.find(t => t.id === trackId);
    if (!track || track.type !== 'drum') {
      return [];
    }
    
    // Initialize drumPads if it doesn't exist
    if (!track.drumPads) {
      track.drumPads = [];
    }
    
    return track.drumPads;
  }

  /**
   * Toggles a drum pad on/off
   */
  public toggleDrumPad(trackId: string, column: number, row: number): void {
    console.log(`Store.toggleDrumPad called for track ${trackId}, column ${column}, row ${row}`);
    
    // Find the track directly
    const track = this.getTrackById(trackId);
    
    if (!track || track.type !== 'drum') {
      console.warn(`Cannot toggle drum pad: Track ${trackId} not found or not a drum track`);
      return;
    }
    
    // Initialize drumPads if it doesn't exist
    if (!track.drumPads) {
      track.drumPads = [];
    }
    
    // Check if pad already exists at this position
    const existingPadIndex = track.drumPads.findIndex(
      p => p.column === column && p.row === row
    );
    
    if (existingPadIndex >= 0) {
      // Remove the pad if it exists
      track.drumPads.splice(existingPadIndex, 1);
      console.log(`Removed drum pad at column ${column}, row ${row} for track ${trackId}`);
    } else {
      // Add new pad
      track.drumPads.push({
        row,
        column,
        velocity: 100 // Default velocity
      });
      console.log(`Added drum pad at column ${column}, row ${row} for track ${trackId}`);
    }
    
    // Log current state
    console.log(`Drum pads for track ${trackId}: ${track.drumPads.length}`);
    
    // Notify listeners of track changes
    this._notifyListeners();
  }
}