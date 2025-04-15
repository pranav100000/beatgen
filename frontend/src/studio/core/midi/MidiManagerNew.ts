import { Midi } from '@tonejs/midi';
import { v4 as uuidv4 } from 'uuid';
import { Note } from '../types/note';
import { db } from '../db/dexie-client';

const TICKS_PER_BEAT = 960; // Standard MIDI ticks per beat

/**
 * Interface for track data
 */
export interface MidiTrack {
  id: string;
  instrumentId: string;
  notes: MidiNote[];
  name?: string;
}

/**
 * Interface for MIDI note data
 */
export interface MidiNote {
  id: number;
  row: number;
  column: number;
  length: number;
  velocity?: number;
  duration?: number;
  time?: number;
}

/**
 * Interface for MIDI data
 */
export interface MidiData {
  tracks: MidiTrack[];
  bpm: number;
  timeSignature: [number, number];
}

/**
 * Type for track update callback
 */
export type TrackUpdateCallback = (trackId: string, notes: Note[]) => void;

/**
 * MidiManager serves as the central source of truth for MIDI note data.
 * It manages track notes, subscriptions, and persistence.
 */
export class MidiManager {
  // Core data storage
  private tracks: Map<string, Note[]> = new Map();
  
  // Subscription management
  private subscribers: Map<string, TrackUpdateCallback[]> = new Map();
  private globalListeners: TrackUpdateCallback[] = [];
  
  // Track metadata
  private currentBpm: number = 120;
  private currentTimeSignature: [number, number] = [4, 4];
  
  // Debouncing for persistence operations
  private pendingUpdates: Map<string, NodeJS.Timeout> = new Map();
  private debounceTime: number = 500; // 500ms debounce time

  /**
   * Check if a track exists
   * @param trackId The track ID
   * @returns True if the track exists
   */
  hasTrack(trackId: string): boolean {
    return this.tracks.has(trackId);
  }

  /**
   * Get track notes if the track exists
   * @param trackId The track ID
   * @returns The notes array or null if track doesn't exist
   */
  getTrackNotes(trackId: string): Note[] | null {
    return this.tracks.has(trackId) ? this.tracks.get(trackId)! : null;
  }

  /**
   * Create a new track with an empty notes array
   * @param instrumentId The instrument ID for the track
   * @param name Optional name for the track
   * @returns The created track object
   */
  createTrack(trackId: string, instrumentId: string, name: string = `Track ${instrumentId}`): MidiTrack {
    console.log(`MidiManager: Creating track ${trackId} with instrument ${instrumentId}`);
    
    // Initialize with empty notes array
    this.tracks.set(trackId, []);
    
    return {
      id: trackId,
      instrumentId,
      notes: [],
      name
    };
  }

  /**
   * Update track notes
   * This is the central method for updating notes - all note changes should go through here
   * @param trackId The track ID to update
   * @param notes The new notes array
   * @throws Error if the track doesn't exist
   */
  updateTrack(trackId: string, notes: Note[]): void {
    // Log notes being set
    console.log(`MidiManager.updateTrack [${trackId}]: Setting notes:`, JSON.stringify(notes.slice(0, 5))); // Log first few
    
    if (!this.tracks.has(trackId)) {
      throw new Error(`Cannot update track ${trackId}: track does not exist`);
    }
    
    // Make a defensive copy of the notes array to prevent external mutation
    const notesCopy = notes.map(note => ({...note}));
    
    // Store the notes in our internal map
    this.tracks.set(trackId, notesCopy);

    // Log first note for debugging
    if (notes.length > 0) {
      console.log(`MidiManager: First note in track ${trackId}:`, JSON.stringify(notes[0]));
    }
    
    // Notify subscribers about the update
    this.notifyTrackSubscribers(trackId, notesCopy);
    
    // Persist to DB with debouncing
    this.debouncePersistence(trackId, notesCopy);
  }

  /**
   * Add a single note to a track
   * @param trackId The track ID
   * @param note The note to add
   * @throws Error if the track doesn't exist
   */
  async addNoteToTrack(trackId: string, note: Note): Promise<void> {
    // Log received note
    console.log(`MidiManager.addNoteToTrack [${trackId}]: Received note:`, JSON.stringify(note));
    
    const notes = this.getTrackNotes(trackId);
    if (notes === null) {
      throw new Error(`Cannot add note to track ${trackId}: track does not exist`);
    }
    
    // Add the new note (create a copy to avoid mutation)
    const updatedNotes = [...notes, {...note}];
    
    // Update the track with the new note - this will notify subscribers too
    this.updateTrack(trackId, updatedNotes);
  }

  /**
   * Remove a single note from a track by its ID
   * @param trackId The track ID
   * @param noteId The ID of the note to remove
   * @throws Error if the track doesn't exist
   */
  async removeNoteFromTrack(trackId: string, noteId: number): Promise<void> {
    console.log(`MidiManager: Removing note ${noteId} from track ${trackId}`);
    
    // Get existing notes - will throw if track doesn't exist
    const notes = this.getTrackNotes(trackId);
    if (notes === null) {
      throw new Error(`Cannot remove note from track ${trackId}: track does not exist`);
    }
    
    // Filter out the note to be removed
    const updatedNotes = notes.filter(note => note.id !== noteId);
    
    // Update the track without the removed note - this will notify subscribers too
    this.updateTrack(trackId, updatedNotes);
  }

  /**
   * Update a single note in a track
   * @param trackId The track ID
   * @param updatedNote The note with updated properties
   * @throws Error if the track doesn't exist or note not found
   */
  async updateNote(trackId: string, updatedNote: Note): Promise<void> {
    console.log(`MidiManager: Updating note ${updatedNote.id} in track ${trackId}`);
    
    // Get existing notes - will throw if track doesn't exist
    const notes = this.getTrackNotes(trackId);
    if (notes === null) {
      throw new Error(`Cannot update note in track ${trackId}: track does not exist`);
    }
    
    // Check if the note exists
    const noteExists = notes.some(note => note.id === updatedNote.id);
    if (!noteExists) {
      throw new Error(`Cannot update note ${updatedNote.id} in track ${trackId}: note not found`);
    }
    
    // Update the specific note (create a copy to avoid mutation)
    const updatedNotes = notes.map(note => 
      note.id === updatedNote.id ? {...updatedNote} : note
    );
    
    // Update the track with the modified notes - this will notify subscribers too
    this.updateTrack(trackId, updatedNotes);
  }

  /**
   * Subscribe to track updates
   * @param trackId The track ID to subscribe to
   * @param callback Function to call when track is updated
   * @returns Unsubscribe function
   */
  subscribeToTrack(trackId: string, callback: TrackUpdateCallback): () => void {
    if (!this.subscribers.has(trackId)) {
      this.subscribers.set(trackId, []);
    }
    
    const trackSubscribers = this.subscribers.get(trackId)!;
    trackSubscribers.push(callback);
    this.subscribers.set(trackId, trackSubscribers);
    
    console.log(`MidiManager: Added subscriber to track ${trackId}, total: ${trackSubscribers.length}`);
    
    // Return unsubscribe function
    return () => {
      const currentSubscribers = this.subscribers.get(trackId) || [];
      const filteredSubscribers = currentSubscribers.filter(cb => cb !== callback);
      this.subscribers.set(trackId, filteredSubscribers);
      console.log(`MidiManager: Removed subscriber from track ${trackId}, remaining: ${filteredSubscribers.length}`);
    };
  }

  /**
   * Subscribe to all track updates
   * @param callback Function to call when any track is updated
   * @returns Unsubscribe function
   */
  subscribeToAllUpdates(callback: TrackUpdateCallback): () => void {
    this.globalListeners.push(callback);
    console.log(`MidiManager: Added global subscriber, total: ${this.globalListeners.length}`);
    
    // Return unsubscribe function
    return () => {
      this.globalListeners = this.globalListeners.filter(cb => cb !== callback);
      console.log(`MidiManager: Removed global subscriber, remaining: ${this.globalListeners.length}`);
    };
  }

  /**
   * Notify all subscribers for a specific track
   * @param trackId The track ID that was updated
   * @param notes The new notes array
   */
  private notifyTrackSubscribers(trackId: string, notes: Note[]): void {
    console.log(`MidiManager: Notifying subscribers for track ${trackId} with ${notes.length} notes`);
    
    // Notify track-specific subscribers
    if (this.subscribers.has(trackId)) {
      const trackSubscribers = this.subscribers.get(trackId)!;
      trackSubscribers.forEach(callback => {
        try {
          callback(trackId, notes);
        } catch (error) {
          console.error(`Error in track ${trackId} subscriber callback:`, error);
        }
      });
    }
    
    // Notify global subscribers
    this.globalListeners.forEach(callback => {
      try {
        callback(trackId, notes);
      } catch (error) {
        console.error(`Error in global subscriber callback for track ${trackId}:`, error);
      }
    });
  }

  /**
   * Create track with persistence
   * This is the primary method for creating a new track in the system
   * @param instrumentId The instrument ID
   * @param name Optional track name
   * @returns The created track
   */
  async createTrackWithPersistence(
    trackId: string,
    instrumentId: string, 
    name: string = `Track ${instrumentId}`
  ): Promise<MidiTrack> {
    console.log(`MidiManager: Creating new track with instrument ${instrumentId} and name "${name}"`);
    
    // Create the track in memory
    const track = this.createTrack(trackId, instrumentId, name);
    
    try {
      // Create empty MIDI file in DB
      await this.createMidiFileForTrack(
        trackId,
        name,
        instrumentId,
        this.currentBpm,
        this.currentTimeSignature
      );
      console.log(`MidiManager: Created persisted track ${track.id}`);
    } catch (error) {
      console.error(`MidiManager: Error creating persisted track ${track.id}:`, error);
      // Continue even if persistence fails
    }
    
    // Notify subscribers that this track now exists (with empty notes)
    this.notifyTrackSubscribers(track.id, []);
    
    return track;
  }

  /**
   * Load track notes from the database
   * @param trackId The track ID to load
   * @returns The loaded notes array
   */
  async loadTrackFromDB(trackId: string): Promise<Note[]> {
    try {
      console.log(`MidiManager: Loading track ${trackId} from DB`);
      
      // Get MIDI blob from DB
      const midiBlob = await db.getMidiTrackBlob(trackId);
      
      if (!midiBlob) {
        console.log(`MidiManager: No MIDI file found for track ${trackId}`);
        return [];
      }
      
      // Convert to File object for loadMidiFile
      const file = new File([midiBlob], `track_${trackId}.mid`, { type: 'audio/midi' });
      
      // Load and parse the MIDI file
      const midiData = await this.loadMidiFile(trackId, file);
      
      // Convert to notes
      const notes = this.midiToNotes(midiData);
      
      // Update in-memory state
      if (notes && notes.length > 0) {
        // Make sure track exists in our map
        if (!this.tracks.has(trackId)) {
          this.tracks.set(trackId, []);
        }
        
        // Update the track notes - use updateTrack to trigger notifications
        this.updateTrack(trackId, notes);
        console.log(`MidiManager: Loaded ${notes.length} notes for track ${trackId} from DB`);
      }
      
      return notes;
    } catch (error) {
      console.error(`MidiManager: Error loading track ${trackId} from DB:`, error);
      return [];
    }
  }

  /**
   * Delete a track and its persistence
   * @param trackId The track ID to delete
   */
  async deleteTrackWithPersistence(trackId: string): Promise<void> {
    // Remove from internal maps
    this.tracks.delete(trackId);
    this.subscribers.delete(trackId);
    
    try {
      // Cancel any pending update
      if (this.pendingUpdates.has(trackId)) {
        clearTimeout(this.pendingUpdates.get(trackId)!);
        this.pendingUpdates.delete(trackId);
      }
      
      // Delete from DB
      await db.deleteMidiTrack(trackId);
      console.log(`MidiManager: Deleted persisted track ${trackId}`);
    } catch (error) {
      console.error(`MidiManager: Error deleting persisted track ${trackId}:`, error);
      // Continue even if persistence fails
    }
  }

  /**
   * Set the current BPM
   * @param bpm The BPM value
   */
  setBpm(bpm: number): void {
    this.currentBpm = bpm;
  }
  
  /**
   * Get the current BPM
   * @returns The current BPM
   */
  getBpm(): number {
    return this.currentBpm;
  }
  
  /**
   * Set the current time signature
   * @param timeSignature The time signature as [numerator, denominator]
   */
  setTimeSignature(timeSignature: [number, number]): void {
    this.currentTimeSignature = timeSignature;
  }
  
  /**
   * Get the current time signature
   * @returns The current time signature
   */
  getTimeSignature(): [number, number] {
    return this.currentTimeSignature;
  }

  /**
   * Debounce persistence operations to reduce DB load
   * @param trackId The track ID to persist
   * @param notes The notes to persist
   */
  private debouncePersistence(trackId: string, notes: Note[]): void {
    // Cancel any pending update for this track
    if (this.pendingUpdates.has(trackId)) {
      clearTimeout(this.pendingUpdates.get(trackId)!);
    }
    
    // Schedule a new update
    const timeoutId = setTimeout(async () => {
      try {
        await this.updateMidiFileForTrack(
          trackId,
          notes,
          this.currentBpm,
          this.currentTimeSignature
        );
        
        // Clear from pending updates
        this.pendingUpdates.delete(trackId);
      } catch (error) {
        console.error(`MidiManager: Error persisting track ${trackId}:`, error);
        this.pendingUpdates.delete(trackId);
      }
    }, this.debounceTime);
    
    this.pendingUpdates.set(trackId, timeoutId);
  }

  /**
   * Load a MIDI file
   * @param id The track ID
   * @param file The MIDI file
   * @returns The parsed MIDI data
   */
  async loadMidiFile(id: string, file: File): Promise<MidiData> {
    const arrayBuffer = await file.arrayBuffer();
    const midi = new Midi(arrayBuffer);

    console.log("midi", midi);

    const tracks: MidiTrack[] = midi.tracks.map(track => ({
      id: id,
      instrumentId: track.instrument.name || 'default',
      notes: track.notes.map(note => ({
        id: Date.now(),
        row: note.midi,  // MIDI note number
        column: Math.floor(note.time * 4), // Convert time to grid columns (assuming quarter notes)
        length: Math.floor(note.duration * 4), // Convert duration to grid units
        velocity: note.velocity, // Keep in Tone.js 0-1 scale
        duration: note.duration,
        time: note.time
      })),
      name: track.name
    }));

    return {
      tracks,
      bpm: midi.header.tempos[0]?.bpm || 120,
      timeSignature: [
        midi.header.timeSignatures[0]?.timeSignature[0] || 4,
        midi.header.timeSignatures[0]?.timeSignature[1] || 4
      ]
    };
  }

  /**
   * Create a MIDI file from notes
   * @param data The MIDI data
   * @returns A blob containing the MIDI file
   */
  createMidiFile(data: MidiData): Blob {
    const midi = new Midi();
    midi.header.setTempo(data.bpm);
    midi.header.timeSignatures.push({
      ticks: 0,
      timeSignature: data.timeSignature
    });

    data.tracks.forEach(track => {
      const midiTrack = midi.addTrack();
      track.notes.forEach(note => {
        midiTrack.addNote({
          midi: note.row,
          time: note.time || note.column / 4, // Convert grid position to time if not provided
          duration: note.duration || note.length / 4, // Convert grid length to duration if not provided
          velocity: note.velocity // Use velocity as-is (already in 0-1 scale)
        });
      });
    });

    return new Blob([midi.toArray()], { type: 'audio/midi' });
  }

  /**
   * Convert MIDI data to app note format
   * @param midiData The MIDI data
   * @returns Array of notes
   */
  midiToNotes(midiData: MidiData): Note[] {
    // Flatten all tracks into a single array of notes
    return midiData.tracks.flatMap(track => 
      track.notes.map(note => ({
        id: note.id,
        row: note.row,
        column: note.column,
        length: note.length,
        trackId: track.id,
        velocity: note.velocity
      }))
    );
  }

  /**
   * Convert app notes to MIDI data format
   * @param trackId The track ID
   * @param notes The notes array
   * @param bpm The BPM
   * @returns MIDI data object
   */
  notesToMidi(trackId: string, notes: Note[], bpm: number): MidiData {
    const track: MidiTrack = {
      id: trackId,
      instrumentId: 'default', 
      notes: notes.map(note => {
        // Log note being converted
        console.log(`MidiManager.notesToMidi [${trackId}]: Converting note:`, JSON.stringify(note)); 
        const convertedNote = {
        ...note,
        velocity: note.velocity || 100,
          duration: note.length / TICKS_PER_BEAT, // Convert ticks to seconds based on TICKS_PER_BEAT
          time: note.column / TICKS_PER_BEAT // Convert ticks to seconds based on TICKS_PER_BEAT
        };
        console.log(`MidiManager.notesToMidi [${trackId}]: Converted note result:`, JSON.stringify(convertedNote));
        return convertedNote;
      })
    };

    return {
      tracks: [track],
      bpm,
      timeSignature: this.currentTimeSignature
    };
  }

  /**
   * Create initial MIDI file for a track
   * @param trackId The track ID
   * @param name The track name
   * @param instrumentId The instrument ID
   * @param bpm The BPM
   * @param timeSignature The time signature
   */
  private async createMidiFileForTrack(
    trackId: string, 
    name: string, 
    instrumentId: string, 
    bpm: number, 
    timeSignature: [number, number]
  ): Promise<void> {
    try {
      console.log(`MidiManager: Creating MIDI file for track ${trackId}`);
      
      // Generate an empty MIDI file
      const midiData = this.notesToMidi(trackId, [], bpm);
      midiData.timeSignature = timeSignature;
      const midiBlob = this.createMidiFile(midiData);
      
      // Store in DB
      await db.storeMidiTrackBlob(trackId, name, midiBlob, bpm, timeSignature, instrumentId);
      
      console.log(`MidiManager: Created MIDI file for track ${trackId}`);
    } catch (error) {
      console.error(`MidiManager: Error creating MIDI file for track ${trackId}:`, error);
      throw error;
    }
  }

  /**
   * Update MIDI file for a track
   * @param trackId The track ID
   * @param notes The notes array
   * @param bpm The BPM
   * @param timeSignature The time signature
   * @param trackName Optional track name
   */
  private async updateMidiFileForTrack(
    trackId: string, 
    notes: Note[], 
    bpm: number, 
    timeSignature: [number, number],
    trackName: string = `Midi Track`
  ): Promise<void> {
    try {
      console.log(`MidiManager: Updating MIDI file for track ${trackId} with ${notes.length} notes`);
      
      // Generate MIDI data and blob
      const midiData = this.notesToMidi(trackId, notes, bpm);
      midiData.timeSignature = timeSignature;
      const midiBlob = this.createMidiFile(midiData);
      
      // Store in DB
      await db.storeMidiTrackBlob(trackId, trackName, midiBlob, bpm, timeSignature);
      
      console.log(`MidiManager: Updated MIDI file for track ${trackId}`);
    } catch (error) {
      console.error(`MidiManager: Error updating MIDI file for track ${trackId}:`, error);
      throw error;
    }
  }

  /**
   * Export MIDI file from DB
   * @param trackId The track ID
   * @returns Blob containing the MIDI file, or null if not found
   */
  async exportMidiFileFromDB(trackId: string): Promise<Blob | null> {
    try {
      console.log(`MidiManager: Exporting track ${trackId} from DB`);
      
      // Try to get from DB
      const blob = await db.getMidiTrackBlob(trackId);
      
      if (blob) {
        return blob;
      }
      
      // If not in DB, create from in-memory notes
      const notes = this.getTrackNotes(trackId);
      if (notes && notes.length > 0) {
        console.log(`MidiManager: Creating MIDI export from ${notes.length} in-memory notes`);
        const midiData = this.notesToMidi(trackId, notes, this.currentBpm);
        return this.createMidiFile(midiData);
      }
      
      console.warn(`MidiManager: No data found for track ${trackId} to export`);
      return null;
    } catch (error) {
      console.error(`MidiManager: Error exporting track ${trackId}:`, error);
      return null;
    }
  }
}