// import { Midi } from '@tonejs/midi';
// import * as Tone from 'tone';
// import { v4 as uuidv4 } from 'uuid';
// import { Note } from '../types/note';
// import { MidiManagerInterface, MidiData, MidiTrack, MidiNote } from './types';
// import { db } from '../db/dexie-client';

// export class MidiManager2 implements MidiManagerInterface {
//   private activePlayback: Map<string, Tone.Part> = new Map();
//   private tracks: Map<string, Note[]> = new Map();
//   private subscribers: Map<string, ((trackId: string, notes: Note[]) => void)[]> = new Map();
//   private globalListeners: ((trackId: string, notes: Note[]) => void)[] = [];
  
//   // Track metadata
//   private currentBpm: number = 120;
//   private currentTimeSignature: [number, number] = [4, 4];
  
//   // Debouncing for persistence operations
//   private pendingUpdates: Map<string, NodeJS.Timeout> = new Map();
//   private debounceTime: number = 500; // 500ms debounce time
  
//   /**
//    * Get all tracks with their notes
//    * @returns A new Map with all tracks and their notes
//    */
//   getAllTracks(): Map<string, Note[]> {
//     return new Map(this.tracks);
//   }
  
//   /**
//    * Check if a track exists
//    * @param trackId The track ID to check
//    * @returns True if the track exists
//    */
//   hasTrack(trackId: string): boolean {
//     return this.tracks.has(trackId);
//   }
  
//   /**
//    * Get track notes if the track exists
//    * @param trackId The track ID
//    * @returns The notes array or null if track doesn't exist
//    */
//   getTrackNotes(trackId: string): Note[] | null {
//     return this.tracks.has(trackId) ? this.tracks.get(trackId)! : null;
//   }
  
//   /**
//    * Create a new track with empty notes array
//    * @param trackId The track ID
//    * @returns The empty notes array
//    * @throws Error if track already exists
//    */
//   createTrackNotes(trackId: string): Note[] {
//     if (this.tracks.has(trackId)) {
//       throw new Error(`Track ${trackId} already exists`);
//     }
//     const notes: Note[] = [];
//     this.tracks.set(trackId, notes);
//     return notes;
//   }
  
//   /**
//    * Subscribe to all track updates
//    * @param callback Function to call when any track is updated
//    * @returns Unsubscribe function
//    */
//   subscribeToAllUpdates(callback: (trackId: string, notes: Note[]) => void): () => void {
//     this.globalListeners.push(callback);
    
//     // Return unsubscribe function
//     return () => {
//       this.globalListeners = this.globalListeners.filter(cb => cb !== callback);
//     };
//   }

//   async loadMidiFile(id: string, file: File): Promise<MidiData> {
//     const arrayBuffer = await file.arrayBuffer();
//     const midi = new Midi(arrayBuffer);

//     const tracks: MidiTrack[] = midi.tracks.map(track => ({
//       id: id,
//       instrumentId: track.instrument.name || 'default',
//       notes: track.notes.map(note => ({
//         id: Date.now(),
//         row: note.midi,  // MIDI note number
//         column: Math.floor(note.time * 4), // Convert time to grid columns (assuming quarter notes)
//         length: Math.floor(note.duration * 4), // Convert duration to grid units
//         velocity: note.velocity,
//         duration: note.duration,
//         time: note.time
//       })),
//       name: track.name
//     }));

//     return {
//       tracks,
//       bpm: midi.header.tempos[0]?.bpm || 120,
//       timeSignature: [
//         midi.header.timeSignatures[0]?.timeSignature[0] || 4,
//         midi.header.timeSignatures[0]?.timeSignature[1] || 4
//       ]
//     };
//   }

//   createMidiFile(data: MidiData): Blob {
//     const midi = new Midi();
//     midi.header.setTempo(data.bpm);
//     midi.header.timeSignatures.push({
//       ticks: 0,
//       timeSignature: data.timeSignature
//     });

//     data.tracks.forEach(track => {
//       const midiTrack = midi.addTrack();
//       track.notes.forEach(note => {
//         midiTrack.addNote({
//           midi: note.row,
//           time: note.time,
//           duration: note.duration,
//           velocity: note.velocity
//         });
//       });
//     });

//     return new Blob([midi.toArray()], { type: 'audio/midi' });
//   }

//   midiToNotes(midiData: MidiData): Note[] {
//     // Flatten all tracks into a single array of notes
//     return midiData.tracks.flatMap(track => 
//       track.notes.map(note => ({
//         id: note.id,
//         row: note.row,
//         column: note.column,
//         length: note.length,
//         trackId: track.id,
//         velocity: note.velocity
//       }))
//     );
//   }

//   notesToMidi(trackId: string, notes: Note[], bpm: number): MidiData {
//     const track: MidiTrack = {
//       id: trackId,
//       instrumentId: 'default',
//       notes: notes.map(note => ({
//         ...note,
//         velocity: note.velocity, // Default velocity
//         duration: note.length / 4, // Convert grid units to seconds
//         time: note.column / 4 // Convert grid units to seconds
//       }))
//     };

//     return {
//       tracks: [track],
//       bpm,
//       timeSignature: this.currentTimeSignature // Use current time signature
//     };
//   }

//   createTrack(instrumentId: string, name: string): MidiTrack {
//     const trackId = uuidv4();
//     // Initialize with empty notes array
//     this.tracks.set(trackId, []);
    
//     return {
//       id: trackId,
//       instrumentId,
//       notes: [],
//       name
//     };
//   }

//   // Subscribe to track updates
//   subscribeToTrack(trackId: string, callback: (trackId: string, notes: Note[]) => void): () => void {
//     if (!this.subscribers.has(trackId)) {
//       this.subscribers.set(trackId, []);
//     }
    
//     const trackSubscribers = this.subscribers.get(trackId) || [];
//     trackSubscribers.push(callback);
//     this.subscribers.set(trackId, trackSubscribers);
    
//     // Return unsubscribe function
//     return () => {
//       const currentSubscribers = this.subscribers.get(trackId) || [];
//       this.subscribers.set(
//         trackId, 
//         currentSubscribers.filter(cb => cb !== callback)
//       );
//     };
//   }

//   /**
//    * Get notes for a track - DEPRECATED in favor of getTrackNotes()
//    * This method is maintained for backward compatibility only
//    * @param trackId The track ID
//    * @returns The notes array (empty if track doesn't exist)
//    * @deprecated Use getTrackNotes() instead which returns null if the track doesn't exist
//    */
//   getNotesForTrack(trackId: string): Note[] {
//     console.warn(`DEPRECATED: getNotesForTrack() called for track ${trackId}, use getTrackNotes() instead`);
//     return this.tracks.get(trackId) || [];
//   }

  
//   // BPM and time signature methods
  
//   /**
//    * Set the current BPM
//    */
//   setBpm(bpm: number): void {
//     this.currentBpm = bpm;
//   }
  
//   /**
//    * Set the current time signature
//    */
//   setTimeSignature(timeSignature: [number, number]): void {
//     this.currentTimeSignature = timeSignature;
//   }
  
//   /**
//    * Get the current BPM
//    */
//   getBpm(): number {
//     return this.currentBpm;
//   }
  
//   /**
//    * Get the current time signature
//    */
//   getTimeSignature(): [number, number] {
//     return this.currentTimeSignature;
//   }
  
//   // INTEGRATED PERSISTENCE METHODS

//   /**
//    * Create track with persistence
//    */
//   async createTrackWithPersistence(
//     instrumentId: string, 
//     name: string = `Trackkeeee ${instrumentId}`
//   ): Promise<MidiTrack> {
//     // Create the track in memory
//     const track = this.createTrack(instrumentId, name);
    
//     try {
//       // Create empty MIDI file in DB
//       await this.createMidiFileForTrack(
//         track.id,
//         name,
//         instrumentId,
//         this.currentBpm,
//         this.currentTimeSignature
//       );
//       console.log(`MidiManager: Created persisted track ${track.id}`);
//     } catch (error) {
//       console.error(`MidiManager: Error creating persisted track ${track.id}:`, error);
//       // Continue even if persistence fails
//     }
    
//     return track;
//   }
  
//   /**
//    * Update track notes and persist to DB
//    * This is the central method for updating notes - all note changes should go through here
//    * @param trackId The track ID to update
//    * @param notes The new notes array
//    * @throws Error if the track doesn't exist
//    */
//   updateTrack(trackId: string, notes: Note[]): void {
//     console.log(`MidiManager.updateTrack: Updating track ${trackId} with ${notes.length} notes`);
    
//     // Fail if the track doesn't exist
//     if (!this.tracks.has(trackId)) {
//       throw new Error(`Cannot update track ${trackId}: track does not exist`);
//     }
    
//     // Make a defensive copy of the notes array to prevent external mutation
//     const notesCopy = notes.map(note => ({...note}));
    
//     // Store the notes in our internal map
//     this.tracks.set(trackId, notesCopy);

//     // Log note details for debugging
//     if (notes.length > 0) {
//       console.log(`MidiManager.updateTrack: First note in track ${trackId}:`, 
//         JSON.stringify(notes[0]));
//     }
    
//     console.log(`MidiManager.updateTrack: Track ${trackId} updated with ${notes.length} notes`);
    
//     // Notify subscribers - this triggers UI updates and audio engine updates
//     this.notifyTrackSubscribers(trackId, notesCopy);
    
//     // Persist to DB with debouncing
//     this.debouncePersistence(trackId, notesCopy);
//   }
  
//   /**
//    * Add a single note to a track
//    * @param trackId The track ID
//    * @param note The note to add
//    * @throws Error if the track doesn't exist
//    */
//   async addNoteToTrack(trackId: string, note: Note): Promise<void> {
//     console.log(`MidiManager.addNoteToTrack: Adding note to track ${trackId}`, note);
    
//     // Get existing notes - will throw if track doesn't exist
//     const notes = this.getTrackNotes(trackId);
//     if (notes === null) {
//       throw new Error(`Cannot add note to track ${trackId}: track does not exist`);
//     }
    
//     // Add the new note (create a copy to avoid mutation)
//     const updatedNotes = [...notes, {...note}];
    
//     // Update the track with the new note - this will notify subscribers too
//     this.updateTrack(trackId, updatedNotes);
//   }
  
//   /**
//    * Remove a single note from a track by its ID
//    * @param trackId The track ID
//    * @param noteId The ID of the note to remove
//    * @throws Error if the track doesn't exist
//    */
//   async removeNoteFromTrack(trackId: string, noteId: number): Promise<void> {
//     console.log(`MidiManager.removeNoteFromTrack: Removing note ${noteId} from track ${trackId}`);
    
//     // Get existing notes - will throw if track doesn't exist
//     const notes = this.getTrackNotes(trackId);
//     if (notes === null) {
//       throw new Error(`Cannot remove note from track ${trackId}: track does not exist`);
//     }
    
//     // Filter out the note to be removed
//     const updatedNotes = notes.filter(note => note.id !== noteId);
    
//     // Update the track without the removed note - this will notify subscribers too
//     this.updateTrack(trackId, updatedNotes);
//   }
  
//   /**
//    * Update a single note in a track
//    * @param trackId The track ID
//    * @param updatedNote The note with updated properties
//    * @throws Error if the track doesn't exist or note not found
//    */
//   async updateNote(trackId: string, updatedNote: Note): Promise<void> {
//     console.log(`MidiManager.updateNote: Updating note ${updatedNote.id} in track ${trackId}`);
    
//     // Get existing notes - will throw if track doesn't exist
//     const notes = this.getTrackNotes(trackId);
//     if (notes === null) {
//       throw new Error(`Cannot update note in track ${trackId}: track does not exist`);
//     }
    
//     // Check if the note exists
//     const noteExists = notes.some(note => note.id === updatedNote.id);
//     if (!noteExists) {
//       throw new Error(`Cannot update note ${updatedNote.id} in track ${trackId}: note not found`);
//     }
    
//     // Update the specific note (create a copy to avoid mutation)
//     const updatedNotes = notes.map(note => 
//       note.id === updatedNote.id ? {...updatedNote} : note
//     );
    
//     // Update the track with the modified notes - this will notify subscribers too
//     this.updateTrack(trackId, updatedNotes);
//   }
  
//   /**
//    * Notify all subscribers for a specific track
//    * Extracted to follow DRY principles
//    */
//   private notifyTrackSubscribers(trackId: string, notes: Note[]): void {
//     // Log the notification for debugging
//     console.log(`MidiManager: Notifying subscribers for track ${trackId} with ${notes.length} notes`);
    
//     // Notify track-specific subscribers
//     if (this.subscribers.has(trackId)) {
//       const trackSubscribers = this.subscribers.get(trackId) || [];
//       trackSubscribers.forEach(callback => {
//         try {
//           callback(trackId, notes);
//         } catch (error) {
//           console.error(`Error in track ${trackId} subscriber callback:`, error);
//         }
//       });
//     }
    
//     // Notify global subscribers
//     this.globalListeners.forEach(callback => {
//       try {
//         callback(trackId, notes);
//       } catch (error) {
//         console.error(`Error in global subscriber callback for track ${trackId}:`, error);
//       }
//     });
//   }
  
//   /**
//    * Debounce persistence operations to reduce DB load
//    */
//   private debouncePersistence(trackId: string, notes: Note[]): void {
//     // Cancel any pending update for this track
//     if (this.pendingUpdates.has(trackId)) {
//       clearTimeout(this.pendingUpdates.get(trackId)!);
//     }
    
//     // Get track name if available
//     const trackName = this.tracks.get(trackId) 
//       ? `Tracko ${trackId}` // Fallback name
//       : `Trackee ${trackId}`;
    
//     // Schedule a new update
//     const timeoutId = setTimeout(async () => {
//       try {
//         await this.updateMidiFileForTrack(
//           trackId,
//           notes,
//           this.currentBpm,
//           this.currentTimeSignature,
//           trackName
//         );
        
//         // Clear from pending updates
//         this.pendingUpdates.delete(trackId);
//       } catch (error) {
//         console.error(`MidiManager: Error persisting track ${trackId}:`, error);
//         this.pendingUpdates.delete(trackId);
//       }
//     }, this.debounceTime);
    
//     this.pendingUpdates.set(trackId, timeoutId);
//   }
  
//   /**
//    * Load track data from DB
//    */
//   async loadTrackFromDB(trackId: string): Promise<Note[]> {
//     try {
//       console.log(`MidiManager: Loading track ${trackId} from DB`);
      
//       // Get MIDI blob from DB
//       const midiBlob = await db.getMidiTrackBlob(trackId);
      
//       if (!midiBlob) {
//         console.log(`MidiManager: No MIDI file found for track ${trackId}`);
//         return [];
//       }
      
//       // Convert to File object for loadMidiFile
//       const file = new File([midiBlob], `track_${trackId}.mid`, { type: 'audio/midi' });
      
//       // Load and parse the MIDI file
//       const midiData = await this.loadMidiFile(trackId, file);
      
//       // Convert to notes
//       const notes = this.midiToNotes(midiData);
      
//       // Update in-memory state
//       if (notes && notes.length > 0) {
//         this.tracks.set(trackId, notes);
//         console.log(`MidiManager: Loaded ${notes.length} notes for track ${trackId} from DB`);
//       }
      
//       return notes;
//     } catch (error) {
//       console.error(`MidiManager: Error loading track ${trackId} from DB:`, error);
//       return [];
//     }
//   }
  
//   /**
//    * Delete track with persistence cleanup
//    */
//   async deleteTrackWithPersistence(trackId: string): Promise<void> {
//     // Remove from internal maps
//     this.tracks.delete(trackId);
//     this.subscribers.delete(trackId);
    
//     try {
//       // Cancel any pending update
//       if (this.pendingUpdates.has(trackId)) {
//         clearTimeout(this.pendingUpdates.get(trackId)!);
//         this.pendingUpdates.delete(trackId);
//       }
      
//       // Delete from DB
//       await db.deleteMidiTrack(trackId);
//       console.log(`MidiManager: Deleted persisted track ${trackId}`);
//     } catch (error) {
//       console.error(`MidiManager: Error deleting persisted track ${trackId}:`, error);
//       // Continue even if persistence fails
//     }
//   }
  
//   /**
//    * Create initial MIDI file for a track
//    */
//   private async createMidiFileForTrack(
//     trackId: string, 
//     name: string, 
//     instrumentId: string, 
//     bpm: number, 
//     timeSignature: [number, number]
//   ): Promise<void> {
//     try {
//       console.log(`MidiManager: Creating MIDI file for track ${trackId}`);
      
//       // Generate an empty MIDI file
//       const midiData = this.notesToMidi(trackId, [], bpm);
//       midiData.timeSignature = timeSignature;
//       const midiBlob = this.createMidiFile(midiData);
      
//       // Store in DB
//       await db.storeMidiTrackBlob(trackId, name, midiBlob, bpm, timeSignature, instrumentId);
      
//       console.log(`MidiManager: Created MIDI file for track ${trackId}`);
//     } catch (error) {
//       console.error(`MidiManager: Error creating MIDI file for track ${trackId}:`, error);
//       throw error;
//     }
//   }
  
//   /**
//    * Update MIDI file for a track
//    */
//   private async updateMidiFileForTrack(
//     trackId: string, 
//     notes: Note[], 
//     bpm: number, 
//     timeSignature: [number, number],
//     trackName: string = `Midi Track`
//   ): Promise<void> {
//     try {
//       console.log(`MidiManager: Updating MIDI file for track ${trackId} with ${notes.length} notes`);
      
//       // Generate MIDI data and blob
//       const midiData = this.notesToMidi(trackId, notes, bpm);
//       midiData.timeSignature = timeSignature;
//       const midiBlob = this.createMidiFile(midiData);
      
//       // Store in DB
//       await db.storeMidiTrackBlob(trackId, trackName, midiBlob, bpm, timeSignature);
      
//       console.log(`MidiManager: Updated MIDI file for track ${trackId}`);
//     } catch (error) {
//       console.error(`MidiManager: Error updating MIDI file for track ${trackId}:`, error);
//       throw error;
//     }
//   }
  
//   /**
//    * Export MIDI file from DB
//    */
//   async exportMidiFileFromDB(trackId: string): Promise<Blob | null> {
//     try {
//       console.log(`MidiManager: Exporting track ${trackId} from DB`);
      
//       // Try to get from DB
//       const blob = await db.getMidiTrackBlob(trackId);
      
//       if (blob) {
//         return blob;
//       }
      
//       // If not in DB, create from in-memory notes
//       const notes = this.getNotesForTrack(trackId);
//       if (notes.length > 0) {
//         console.log(`MidiManager: Creating MIDI export from ${notes.length} in-memory notes`);
//         const midiData = this.notesToMidi(trackId, notes, this.currentBpm);
//         return this.createMidiFile(midiData);
//       }
      
//       console.warn(`MidiManager: No data found for track ${trackId} to export`);
//       return null;
//     } catch (error) {
//       console.error(`MidiManager: Error exporting track ${trackId}:`, error);
//       return null;
//     }
//   }
// }