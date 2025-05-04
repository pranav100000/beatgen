import { Midi } from '@tonejs/midi';
import { Note } from '../../../types/note';
import { db } from '../db/dexie-client';

/**
 * Interface for track data
 */
interface MidiTrack {
  id: string;
  instrumentId: string;
  notes: MidiNote[];
  name?: string;
}

/**
 * Interface for MIDI note data
 */
interface MidiNote {
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
interface MidiData {
  tracks: MidiTrack[];
  bpm: number;
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
  
  // Internal counter for generating unique note IDs
  private nextNoteIdCounter: number = 1;
  
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
    // Log entry and instance ID
    console.log(`>>> MidiManager (${/*this.instanceId?.substring(0, 4)*/''}): ENTER createTrack - ID: ${trackId}`); 
    
    // Initialize with empty notes array
    this.tracks.set(trackId, []);
    
    // Log success and map state
    console.log(`>>> MidiManager (${/*this.instanceId?.substring(0, 4)*/''}): EXIT createTrack - Added ID: ${trackId}. Map size: ${this.tracks.size}`);
    console.log(`>>> MidiManager (${/*this.instanceId?.substring(0, 4)*/''}): Current track keys:`, Array.from(this.tracks.keys()));

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
   * Assigns a unique ID if the incoming note ID is invalid (-1).
   * @param trackId The track ID
   * @param note The note to add
   * @throws Error if the track doesn't exist
   */
  async addNoteToTrack(trackId: string, note: Note): Promise<void> {
    // Log entry, instance ID, and map state BEFORE check
    console.log(`>>> MidiManager (${/*this.instanceId?.substring(0, 4)*/''}): ENTER addNoteToTrack - Target ID: ${trackId}`); 
    console.log(`>>> MidiManager (${/*this.instanceId?.substring(0, 4)*/''}): Checking if track exists... Has ${trackId}?`, this.tracks.has(trackId));
    console.log(`>>> MidiManager (${/*this.instanceId?.substring(0, 4)*/''}): Current track keys before add attempt:`, Array.from(this.tracks.keys()));
    
    const notes = this.getTrackNotes(trackId);
    if (notes === null) {
      // Error is thrown here
      throw new Error(`Cannot add note to track ${trackId}: track does not exist`);
    }
    
    let noteToAdd = { ...note }; // Create a copy to potentially modify

    // Check if the incoming ID needs to be replaced
    if (noteToAdd.id === -1 || noteToAdd.id === undefined || noteToAdd.id === null) {
      const newId = this.nextNoteIdCounter++; // Get next ID and increment counter
      console.log(`MidiManager: Assigning new ID ${newId} to incoming note (original ID: ${note.id})`);
      noteToAdd.id = newId; 
    } else {
      // Ensure the counter is always ahead of any explicitly provided IDs
      this.nextNoteIdCounter = Math.max(this.nextNoteIdCounter, noteToAdd.id + 1);
    }
    
    // Add the note with the correct ID
    const updatedNotes = [...notes, noteToAdd]; 
    
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
    console.log("MidiManager: current notes:", this.getTrackNotes(trackId));
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
    console.log("MidiManager: updated notes:", this.getTrackNotes(trackId));
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
      // await db.deleteMidiTrack(trackId);
      console.log(`MidiManager: Deleted persisted track ${trackId}`);
    } catch (error) {
      console.error(`MidiManager: Error deleting persisted track ${trackId}:`, error);
      // Continue even if persistence fails
    }
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
        // await this.updateMidiFileForTrack(
        //   trackId,
        //   notes,
        //   this.currentBpm,
        //   this.currentTimeSignature
        // );
        
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
          duration: note.length, // Convert ticks to seconds based on TICKS_PER_BEAT
          time: note.column // Convert ticks to seconds based on TICKS_PER_BEAT
        };
        console.log(`MidiManager.notesToMidi [${trackId}]: Converted note result:`, JSON.stringify(convertedNote));
        return convertedNote;
      })
    };

    return {
      tracks: [track],
      bpm,
    };
  }
}