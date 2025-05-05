import { ProjectManager } from './project';
import { TransportController } from './transport';
import { MidiManager } from '../midi/MidiManagerNew';
import { InstrumentManager } from '../instruments/InstrumentManager';
import AudioFilePlayer from '../audio-engine/audioFilePlayer/audioEngine';
import * as Tone from 'tone';
import { SoundfontEngineController } from '../audio-engine/soundfontEngineController';
import { SamplerController } from '../audio-engine/samplerController';
import { Note } from '../../../types/note'; // Added for Note type
import { NoteActions } from './history/actions/NoteActions'; // Added for NoteActions
import { HistoryManager, historyManager } from './history/HistoryManager'; // Added for historyManager
import { MUSIC_CONSTANTS } from '../../constants/musicConstants';
import { DEFAULT_MEASURE_WIDTH, useGridStore } from './gridStore';
import { CombinedTrack } from 'src/platform/types/project';
import { BeatGenDB, db } from '../db/dexie-client'; // Import BeatGenDB and db instance
import SampleManager from '../samples/sampleManager'; // Import SampleManager
/**
 * Interface for a drum pad in the drum machine grid
 */
interface DrumPad {
  row: number;    // Row position (which drum sound)
  column: number; // Column position (which beat)
  velocity: number; // Velocity/volume (0-127)
}

export interface StoreInterface {
  getTransport(): TransportController;
  projectManager: ProjectManager;
  initializeAudio(): Promise<void>;
  // createTrack(
  //   combinedTrack: CombinedTrack
  // ): Promise<CombinedTrack>;
  getInstrumentManager(): InstrumentManager;
  getMidiManager(): MidiManager;
  connectTrackToSoundfont(trackId: string, instrumentId: string): Promise<void>;
  connectTrackToSampler(trackId: string, file: File, baseMidiNote?: number, grainSize?: number, overlap?: number): Promise<void>;
}

export class Store implements StoreInterface {
  public projectManager: ProjectManager;
  private transportController: TransportController;
  private initialized: boolean = false;
  private midiManager: MidiManager;
  private instrumentManager: InstrumentManager;
  private sampleManager: SampleManager; // Add sampleManager property
  // Map to store runtime data associated with track IDs
  private runtimeTrackData: Map<string, { channel: Tone.Channel; player?: Tone.Player; /* Add other runtime-specific state here if needed */ }> = new Map();

  constructor() {
    this.projectManager = new ProjectManager();
    this.midiManager = new MidiManager();
    this.instrumentManager = new InstrumentManager();
    // Initialize SampleManager with the db instance
    this.sampleManager = SampleManager.getInstance(db); 
    
    this.transportController = new TransportController();
  }

  public async initializeAudio(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Initialize audio engine
      await this.getAudioEngine().initialize();
      
      // Get Tone.js context and extract raw audio context
      // This is a workaround since AudioEngine doesn't expose the context directly
      const toneContext = Tone.getContext();
      const rawContext = toneContext.rawContext;
      
      // Log the context type to help debug
      console.log('Audio context type:', {
        toneContextType: typeof toneContext,
        rawContextType: typeof rawContext,
        rawContextConstructorName: rawContext.constructor.name,
        isAudioContext: rawContext instanceof AudioContext,
        isBaseAudioContext: rawContext instanceof BaseAudioContext
      });
      
      // Some browsers may need to create a new AudioContext from an existing one
      const audioContext = new AudioContext({
        latencyHint: 'interactive',
        sampleRate: rawContext.sampleRate
      });

      this.getSoundfontController().initialize(audioContext);

      this.initialized = true;
      // Removed syncTracksFromProjectManager call
      // Initialize runtime data for existing tracks if a project is loaded
      this.initializeRuntimeTrackData();
    } catch (error) {
      console.error('Store: Audio initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize runtime data (like Tone.Channel) for tracks already present
   * in the ProjectManager when the store initializes.
   */
  private initializeRuntimeTrackData(): void {
    const project = this.projectManager.getCurrentProject();
    if (!project) return;

    console.log('Initializing runtime data for existing tracks...');
    project.tracks.forEach(track => {
      if (!this.runtimeTrackData.has(track.id)) {
        //this.createRuntimeTrackData(track.id);
      }
    });
    console.log(`Runtime data initialized for ${this.runtimeTrackData.size} tracks.`);
  }

  public getTransport(): TransportController {
    return this.transportController;
  }

  // public async createTrack(
  //   combinedTrack: CombinedTrack
  // ): Promise<CombinedTrack> {
  //   if (!this.initialized) {
  //     throw new Error('Store must be initialized before creating tracks');
  //   }
    
  //   console.log(`Store: Creating ${combinedTrack.type} track with name: ${combinedTrack.name}`);
    
    
  //   console.log(`Store: Track created through ProjectManager:`, track);
    
  //   // Create runtime data (channel, etc.) for the new track
  //   //this.createRuntimeTrackData(track.id);

  //   // Note: No need to notify listeners here, UI should react to ProjectManager changes

  //   return track;
  // }

  //  * Creates the runtime data entry for a track (e.g., Tone.Channel).
  //  * Should be called when a track is added or loaded.
  //  * @param trackId The ID of the track.
  //  */
  // private createRuntimeTrackData(trackId: string): void {
  //   if (this.runtimeTrackData.has(trackId)) {
  //     console.warn(`Store: Runtime data already exists for track ${trackId}`);
  //     return;
  //   }

  //   // Create a channel for the track
  //   const channel = new Tone.Channel().toDestination();

  //   // Set initial volume/pan/mute from ProjectManager's track data
  //   const trackData = this.projectManager.getTrackById(trackId);
  //   if (trackData) {
  //     channel.volume.value = Tone.gainToDb(trackData.volume / 100); // Assuming volume is 0-100
  //     channel.pan.value = trackData.pan / 100; // Assuming pan is -100 to 100
  //     channel.mute = trackData.mute;
  //     // Solo logic needs coordination across tracks, often handled in AudioEngine/Transport
  //     // We don't set solo here, as it depends on other tracks' states.
  //   }

  //   this.runtimeTrackData.set(trackId, { channel });
  //   console.log(`Store: Created runtime data for track ${trackId}`);
  // }


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

  // public async removeTrack(trackId: string): Promise<void> {
  //   // Get track type from ProjectManager *before* removing it
  //   const track = this.projectManager.getTrackById(trackId);
  //   const trackType = track?.type;

  //   // Clean up MIDI resources if it's a MIDI, drum or sampler track
  //   if (trackType === 'midi' || trackType === 'drum' || trackType === 'sampler') {
  //     // Ensure MidiManager has the track before attempting deletion
  //     if (this.midiManager.hasTrack(trackId)) {
  //       await this.midiManager.deleteTrackWithPersistence(trackId);
  //     } else {
  //       console.warn(`Store.removeTrack: Track ${trackId} not found in MidiManager during cleanup.`);
  //     }
  //   }

  //   // Remove track from project manager (this should be the source of truth)
  //   this.projectManager.removeTrack(trackId);

  //   // Clean up runtime data (channel, player etc.)
  //   const runtimeData = this.runtimeTrackData.get(trackId);
  //   if (runtimeData) {
  //     runtimeData.channel.dispose(); // Dispose Tone.js resources
  //     runtimeData.player?.dispose();
  //     this.runtimeTrackData.delete(trackId);
  //     console.log(`Store: Cleaned up runtime data for track ${trackId}`);
  //   }

  //   // Remove from audio engine (AudioEngine might need refactoring to not rely on Store._tracks)
  //   // Assuming AudioEngine uses trackId
  //   this.getAudioEngine().removeTrack(trackId);

  //   // Note: No need to notify listeners here, UI should react to ProjectManager changes
  // }

  public getAudioEngine(): AudioFilePlayer {
    return this.getTransport().getAudioEngine();
  }

  public getInstrumentManager(): InstrumentManager {
    return this.instrumentManager;
  }

  public getMidiManager(): MidiManager {
    return this.midiManager;
  }
  
  public getSoundfontController(): SoundfontEngineController {
    return this.getTransport().getSoundfontController();
  }

  public getSamplerController(): SamplerController {
    return this.getTransport().getSamplerController();
  }
  
  /**
   * Connect a MIDI track to a soundfont instrument
   * This adds the track to the SoundfontPlayer and sets up subscription for updates
   * @param trackId The track ID to connect
   * @param instrumentId The instrument ID for the soundfont
   */
  public async connectTrackToSoundfont(
    trackId: string, 
    instrumentId: string
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Store must be initialized before connecting tracks to soundfonts');
    }
    
    try {
      console.log(`Store: Connecting track ${trackId} to soundfont ${instrumentId}`);
      
      await this.getSoundfontController().connectTrackToSoundfont(
        trackId, 
        instrumentId, 
        this.midiManager
      );
      
      console.log(`Store: Successfully connected track ${trackId} to soundfont ${instrumentId}`);
    } catch (error) {
      console.error(`Store: Failed to connect track ${trackId} to soundfont ${instrumentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Connect a track to a sampler
   * This initializes the sampler and sets up MidiManager subscription
   * @param trackId The track ID to connect
   * @param file The audio file to use as the sample source
   * @param baseMidiNote The MIDI note that represents the sample's original pitch
   * @param grainSize Granular synthesis grain size (seconds)
   * @param overlap Granular synthesis overlap amount (0-1)
   */
  public async connectTrackToSampler(
    trackId: string,
    file: File,
    baseMidiNote?: number,
    grainSize?: number,
    overlap?: number
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Store must be initialized before connecting tracks to samplers');
    }
    
    try {
      console.log(`Store: Connecting track ${trackId} to sampler with file ${file.name} and baseMidiNote ${baseMidiNote} and grainSize ${grainSize} and overlap ${overlap}`);
      
      await this.getSamplerController().connectTrackToSampler(
        trackId,
        file,
        this.midiManager,
        baseMidiNote,
        grainSize,
        overlap
      );
      
      console.log(`Store: Successfully connected track ${trackId} to sampler`);
    } catch (error) {
      console.error(`Store: Failed to connect track ${trackId} to sampler:`, error);
      throw error;
    }
  }

  // Removed addListener, removeListener, _notifyListeners

  /**
   * Gets the persistent track data with the specified ID from ProjectManager.
   */
  // public getTrackDataById(trackId: string): CombinedTrack | undefined {
  //   return this.projectManager.getTrackById(trackId);
  // }

  /**
   * Gets the runtime data (e.g., Tone.Channel) for the specified track ID.
   */
  public getRuntimeTrackDataById(trackId: string): { channel: Tone.Channel; player?: Tone.Player; } | undefined {
    return this.runtimeTrackData.get(trackId);
  }

  /**
   * Gets the current drum pad state for a track by querying MidiManager.
   */
  // public getDrumPads(trackId: string): DrumPad[] {
  //   const track = this.projectManager.getTrackById(trackId);
  //   if (!track || track.type !== 'drum') {
  //     // console.warn(`Cannot get drum pads: Track ${trackId} not found or not a drum track`);
  //     return [];
  //   }

  //   const notes = this.midiManager.getTrackNotes(trackId);
  //   if (!notes) {
  //     // Track might exist in ProjectManager but not yet fully initialized in MidiManager
  //     // Or an error occurred fetching notes. MidiManager logs errors internally.
  //     return [];
  //   }

  //   // Map MIDI notes to DrumPad objects
  //   // Assuming row = pitch, column = time position
  //   return notes.map(note => ({
  //     row: note.row,
  //     column: note.column,
  //     velocity: note.velocity ?? 100 // Use note velocity or default
  //   }));
  // }

  /**
   * Toggles a drum pad on/off by adding or removing the corresponding MIDI note
   * via the MidiManager and HistoryManager.
   */
  // public async toggleDrumPad(trackId: string, column: number, row: number): Promise<void> {
  //   console.log(`Store.toggleDrumPad called for track ${trackId}, column ${column}, row ${row}`);

  //   const track = this.projectManager.getTrackById(trackId);
  //   if (!track || track.type !== 'drum') {
  //     console.warn(`Cannot toggle drum pad: Track ${trackId} not found or not a drum track`);
  //     return;
  //   }

  //   // Get current notes for the track from the source of truth
  //   const notes = this.midiManager.getTrackNotes(trackId);
  //   if (notes === null) {
  //     console.error(`Cannot toggle drum pad: Failed to get notes for track ${trackId}`);
  //     return;
  //   }

  //   // Find if a note already exists at this position (row = pitch, column = time)
  //   const existingNote = notes.find(note => note.column === column && note.row === row);

  //   // Use the proper action names from NoteActions
  //   const { AddNote, DeleteNote } = NoteActions;

  //   if (existingNote) {
  //     // Note exists - create and execute a DeleteNote action
  //     console.log(`Drum pad exists at [${column}, ${row}], removing note ID: ${existingNote.id}`);
  //     const deleteAction = new DeleteNote(
  //       this, // Pass the store instance
  //       trackId,
  //       String(existingNote.id), // Action expects string ID
  //       existingNote // Pass the full note object for undo
  //     );
  //     await historyManager.executeAction(deleteAction);

  //   } else {
  //     // Note does not exist - create and execute an AddNote action
  //     console.log(`Drum pad does not exist at [${column}, ${row}], adding note.`);

  //     // Create a new note object
  //     // WARNING: Using Date.now() for ID is not robust for rapid clicks.
  //     // Consider a more reliable ID generation strategy if needed.
  //     const newNoteId = Date.now();
  //     const newNote: Note = {
  //       id: newNoteId,
  //       row: row,         // Pitch
  //       column: column,   // Time position
  //       length: 1,        // Default length (e.g., 1 grid unit for drums)
  //       velocity: 100,    // Default velocity
  //       trackId: trackId
  //     };

  //     const addAction = new AddNote(
  //       this, // Pass the store instance
  //       trackId,
  //       String(newNoteId), // Action expects string ID
  //       newNote
  //     );
  //     await historyManager.executeAction(addAction);
  //   }
  // }

  public getProjectManager(): ProjectManager {
    return this.projectManager;
  }

  /**
   * Gets the ticks per pixel conversion rate based on current BPM and grid settings
   * Used for converting between pixel measurements and musical time
   * @returns Number of ticks per pixel at current settings
   */
  public getTicksPerPixel(): number {
    const bpm = this.projectManager.getTempo();
    const [beatsPerMeasure] = this.projectManager.getTimeSignature();
    
    // Standard MIDI ticks per beat (quarter note) is typically 480 or 960
    // We'll use 480 as it's common for DAWs
    const TICKS_PER_BEAT = MUSIC_CONSTANTS.pulsesPerQuarterNote;
    
    // Calculate measure width in pixels from grid constants
    const MEASURE_WIDTH = DEFAULT_MEASURE_WIDTH; // Matches GRID_CONSTANTS.measureWidth
    
    // Calculate beats per measure from time signature
    const beatWidth = MEASURE_WIDTH / beatsPerMeasure;
    
    // Calculate ticks per beat
    const ticksPerBeat = TICKS_PER_BEAT;
    
    // Calculate ticks per pixel
    const ticksPerPixel = ticksPerBeat / beatWidth;
    
    return ticksPerPixel;
  }

  /**
   * Gets the pixels per tick conversion rate based on current BPM and grid settings
   * Inverse of getTicksPerPixel() - used for converting from ticks to pixel measurements
   * @returns Number of pixels per tick at current settings
   */
  public getPixelsPerTick(): number {
    const ticksPerPixel = this.getTicksPerPixel();
    // Return the inverse of ticks per pixel
    return 1 / ticksPerPixel;
  }

  // Add getter for SampleManager
  public getSampleManager(): SampleManager {
    return this.sampleManager;
  }
}
