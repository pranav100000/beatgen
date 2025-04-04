import { Action } from '../types';
import { StoreInterface } from '../../store';
import { Note } from '../../../types/note';

export class NoteCreateAction implements Action {
  type = 'NOTE_CREATE';

  constructor(
    private store: StoreInterface,
    private newNote: Note,
    private trackId: string
  ) {}

  async execute(): Promise<void> {
    const midiManager = this.store.getMidiManager();
    if (!midiManager) {
      console.error('NoteCreateAction: MidiManager not available');
      return;
    }
    
    // Ensure the note has a trackId
    const noteWithTrackId = { ...this.newNote, trackId: this.trackId };
    
    // Use MidiManager directly - it's our single source of truth
    await midiManager.addNoteToTrack(this.trackId, noteWithTrackId);
    
    console.log(`NoteCreateAction: Created note ${noteWithTrackId.id} in track ${this.trackId}`);
  }

  async undo(): Promise<void> {
    const midiManager = this.store.getMidiManager();
    if (!midiManager) {
      console.error('NoteCreateAction: MidiManager not available for undo');
      return;
    }
    
    // Remove the note using MidiManager
    await midiManager.removeNoteFromTrack(this.trackId, this.newNote.id);
    
    console.log(`NoteCreateAction: Undone creation of note ${this.newNote.id} in track ${this.trackId}`);
  }
}

export class NoteMoveAction implements Action {
  type = 'NOTE_MOVE';

  constructor(
    private store: StoreInterface,
    private noteId: number,
    private oldPosition: { x: number; y: number },
    private newPosition: { x: number; y: number },
    private trackId: string
  ) {}

  async execute(): Promise<void> {
    const midiManager = this.store.getMidiManager();
    if (!midiManager) {
      console.error('NoteMoveAction: MidiManager not available');
      return;
    }
    
    // Get current notes for the track
    const trackNotes = midiManager.getTrackNotes(this.trackId);
    if (!trackNotes) {
      console.error(`NoteMoveAction: No notes found for track ${this.trackId}`);
      return;
    }
    
    // Find the note to update
    const noteToUpdate = trackNotes.find(n => n.id === this.noteId);
    if (!noteToUpdate) {
      console.error(`NoteMoveAction: Note ${this.noteId} not found in track ${this.trackId}`);
      return;
    }
    
    // Create updated note
    const updatedNote = { 
      ...noteToUpdate, 
      row: this.newPosition.y, 
      column: this.newPosition.x 
    };
    
    // Update the note through MidiManager
    await midiManager.updateNote(this.trackId, updatedNote);
    
    console.log(`NoteMoveAction: Moved note ${this.noteId} in track ${this.trackId}`);
  }

  async undo(): Promise<void> {
    const midiManager = this.store.getMidiManager();
    if (!midiManager) {
      console.error('NoteMoveAction: MidiManager not available for undo');
      return;
    }
    
    // Get current notes for the track
    const trackNotes = midiManager.getTrackNotes(this.trackId);
    if (!trackNotes) {
      console.error(`NoteMoveAction: No notes found for track ${this.trackId} during undo`);
      return;
    }
    
    // Find the note to update
    const noteToUpdate = trackNotes.find(n => n.id === this.noteId);
    if (!noteToUpdate) {
      console.error(`NoteMoveAction: Note ${this.noteId} not found in track ${this.trackId} during undo`);
      return;
    }
    
    // Create updated note with original position
    const updatedNote = { 
      ...noteToUpdate, 
      row: this.oldPosition.y, 
      column: this.oldPosition.x 
    };
    
    // Update the note through MidiManager
    await midiManager.updateNote(this.trackId, updatedNote);
    
    console.log(`NoteMoveAction: Undone move of note ${this.noteId} in track ${this.trackId}`);
  }
}

export class NoteResizeAction implements Action {
  type = 'NOTE_RESIZE';

  constructor(
    private store: StoreInterface,
    private noteId: number,
    private oldLength: number,
    private newLength: number,
    private trackId: string,
    private oldColumn?: number,
    private newColumn?: number
  ) {}

  async execute(): Promise<void> {
    const midiManager = this.store.getMidiManager();
    if (!midiManager) {
      console.error('NoteResizeAction: MidiManager not available');
      return;
    }
    
    // Get current notes for the track
    const trackNotes = midiManager.getTrackNotes(this.trackId);
    if (!trackNotes) {
      console.error(`NoteResizeAction: No notes found for track ${this.trackId}`);
      return;
    }
    
    // Find the note to resize
    const noteToResize = trackNotes.find(n => n.id === this.noteId);
    if (!noteToResize) {
      console.error(`NoteResizeAction: Note ${this.noteId} not found in track ${this.trackId}`);
      return;
    }
    
    // Create resized note
    const resizedNote = { 
      ...noteToResize, 
      length: this.newLength,
      ...(this.newColumn !== undefined && { column: this.newColumn })
    };
    
    // Update the note through MidiManager
    await midiManager.updateNote(this.trackId, resizedNote);
    
    console.log(`NoteResizeAction: Resized note ${this.noteId} in track ${this.trackId}`);
  }

  async undo(): Promise<void> {
    const midiManager = this.store.getMidiManager();
    if (!midiManager) {
      console.error('NoteResizeAction: MidiManager not available for undo');
      return;
    }
    
    // Get current notes for the track
    const trackNotes = midiManager.getTrackNotes(this.trackId);
    if (!trackNotes) {
      console.error(`NoteResizeAction: No notes found for track ${this.trackId} during undo`);
      return;
    }
    
    // Find the note to resize
    const noteToResize = trackNotes.find(n => n.id === this.noteId);
    if (!noteToResize) {
      console.error(`NoteResizeAction: Note ${this.noteId} not found in track ${this.trackId} during undo`);
      return;
    }
    
    // Create restored note with original length and column
    const restoredNote = { 
      ...noteToResize,
      length: this.oldLength,
      ...(this.oldColumn !== undefined && { column: this.oldColumn })
    };
    
    // Update the note through MidiManager
    await midiManager.updateNote(this.trackId, restoredNote);
    
    console.log(`NoteResizeAction: Undone resize of note ${this.noteId} in track ${this.trackId}`);
  }
}

export class NoteDeleteAction implements Action {
  type = 'NOTE_DELETE';

  constructor(
    private store: StoreInterface,
    private noteId: number,
    private trackId: string,
    private deletedNote?: Note // Optional: store the deleted note for undo
  ) {}

  async execute(): Promise<void> {
    const midiManager = this.store.getMidiManager();
    if (!midiManager) {
      console.error('NoteDeleteAction: MidiManager not available');
      return;
    }
    
    // Get current notes for the track to store the note being deleted (for undo)
    if (!this.deletedNote) {
      const trackNotes = midiManager.getTrackNotes(this.trackId);
      if (trackNotes) {
        this.deletedNote = trackNotes.find(n => n.id === this.noteId);
      }
    }
    
    // Remove the note using MidiManager
    await midiManager.removeNoteFromTrack(this.trackId, this.noteId);
    
    console.log(`NoteDeleteAction: Deleted note ${this.noteId} from track ${this.trackId}`);
  }

  async undo(): Promise<void> {
    const midiManager = this.store.getMidiManager();
    if (!midiManager) {
      console.error('NoteDeleteAction: MidiManager not available for undo');
      return;
    }
    
    // We need the original note to restore it
    if (!this.deletedNote) {
      console.error(`NoteDeleteAction: Cannot undo, note ${this.noteId} data not available`);
      return;
    }
    
    // Add the note back using MidiManager
    await midiManager.addNoteToTrack(this.trackId, this.deletedNote);
    
    console.log(`NoteDeleteAction: Undone deletion of note ${this.noteId} in track ${this.trackId}`);
  }
}