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
  initialize(): Promise<void>;
  createTrack(name: string, type: 'audio' | 'midi' | 'video' | 'drum'): Track;
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
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.audioEngine.initialize();
      this.initialized = true;
      
      // After initialization, sync any tracks from project manager
      this.syncTracksFromProjectManager();
    } catch (error) {
      console.error('Store: Initialization failed:', error);
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

  public createTrack(name: string, type: 'audio' | 'midi' | 'video' | 'drum'): Track {
    if (!this.initialized) {
      throw new Error('Store must be initialized before creating tracks');
    }
    
    // Create track in project manager
    const track = this.projectManager.addTrack(name, type);
    
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
    
    // Add to our internal tracks array
    this._tracks.push({
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
    });
    
    console.log(`Added track ${track.id} of type ${track.type} to internal state`);
    
    // Notify listeners of new track
    this._notifyListeners();
  }

  public async loadAudioFile(trackId: string, file: File): Promise<void> {
    await this.transportController.loadAudioFile(trackId, file);
  }

  public removeTrack(id: string): void {
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
    console.log(`Current tracks in store: ${this._tracks.length}`);
    
    if (this._tracks.length > 0) {
      console.log(`Track IDs: ${this._tracks.map(t => t.id).join(', ')}`);
    }
    
    // First, check our internal tracks array
    let track = this._tracks.find(t => t.id === trackId);
    
    // If not found, check project manager and try to sync
    if (!track) {
      console.log(`Track ${trackId} not found in internal state, checking ProjectManager...`);
      const pmTrack = this.projectManager.getTrackById(trackId);
      
      if (pmTrack) {
        console.log(`Track ${trackId} found in ProjectManager, adding to internal state`);
        this.addTrackToInternalState(pmTrack);
        
        // Try to get the track again
        track = this._tracks.find(t => t.id === trackId);
      }
    }
    
    if (!track || track.type !== 'drum') {
      console.warn(`Cannot toggle drum pad: Track ${trackId} not found or not a drum track`);
      console.log(`Track found: ${!!track}, type: ${track?.type}`);
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
    
    // Current pads for logging
    const beforeCount = track.drumPads.length;
    
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
    
    // Log state change
    console.log(`Drum pads for track ${trackId}: ${beforeCount} → ${track.drumPads.length}`);
    console.log('Current drum pads:', JSON.stringify(track.drumPads));
    
    // Notify listeners of track changes
    this._notifyListeners();
  }
}
