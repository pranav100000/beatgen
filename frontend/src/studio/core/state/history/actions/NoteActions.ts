import { Action } from '../types';
import { StoreInterface } from '../../store';
import { Note } from '../../../types/note';

export class NoteCreateAction implements Action {
  type = 'NOTE_CREATE';

  constructor(
    private store: StoreInterface,
    private setNotes: React.Dispatch<React.SetStateAction<Note[]>>,
    private newNote: Note,
    private prevNotes: Note[]
  ) {}

  async execute(): Promise<void> {
    this.setNotes([...this.prevNotes, this.newNote]);
    
    // Update MIDI manager if we have a trackId
    if (this.newNote.trackId && this.store.getMidiManager) {
      await this.store.getMidiManager().addNoteToTrack(this.newNote.trackId, this.newNote);
    }
  }

  async undo(): Promise<void> {
    this.setNotes(this.prevNotes);
    
    // Update MIDI manager if we have a trackId
    if (this.newNote.trackId && this.store.getMidiManager) {
      await this.store.getMidiManager().removeNoteFromTrack(this.newNote.trackId, this.newNote.id);
    }
  }
}

export class NoteMoveAction implements Action {
  type = 'NOTE_MOVE';

  constructor(
    private store: StoreInterface,
    private setNotes: React.Dispatch<React.SetStateAction<Note[]>>,
    private noteId: number,
    private oldPosition: { x: number; y: number },
    private newPosition: { x: number; y: number },
    private prevNotes: Note[]
  ) {}

  async execute(): Promise<void> {
    const updatedNotes = this.prevNotes.map(note => 
      note.id === this.noteId 
        ? { ...note, row: this.newPosition.y, column: this.newPosition.x }
        : note
    );
    
    this.setNotes(updatedNotes);
    
    // Update MIDI manager if the note has a trackId
    const note = updatedNotes.find(n => n.id === this.noteId);
    if (note?.trackId && this.store.getMidiManager) {
      await this.store.getMidiManager().updateNote(note.trackId, note);
    }
  }

  async undo(): Promise<void> {
    const updatedNotes = this.prevNotes.map(note => 
      note.id === this.noteId 
        ? { ...note, row: this.oldPosition.y, column: this.oldPosition.x }
        : note
    );
    
    this.setNotes(updatedNotes);
    
    // Update MIDI manager if the note has a trackId
    const note = updatedNotes.find(n => n.id === this.noteId);
    if (note?.trackId && this.store.getMidiManager) {
      await this.store.getMidiManager().updateNote(note.trackId, note);
    }
  }
}

export class NoteResizeAction implements Action {
  type = 'NOTE_RESIZE';

  constructor(
    private store: StoreInterface,
    private setNotes: React.Dispatch<React.SetStateAction<Note[]>>,
    private noteId: number,
    private oldLength: number,
    private newLength: number,
    private prevNotes: Note[],
    private oldColumn?: number,
    private newColumn?: number
  ) {}

  async execute(): Promise<void> {
    const updatedNotes = this.prevNotes.map(note => 
      note.id === this.noteId 
        ? { 
            ...note, 
            length: this.newLength,
            ...(this.newColumn !== undefined && { column: this.newColumn })
          }
        : note
    );
    
    this.setNotes(updatedNotes);
    
    // Update MIDI manager if the note has a trackId
    const note = updatedNotes.find(n => n.id === this.noteId);
    if (note?.trackId && this.store.getMidiManager) {
      await this.store.getMidiManager().updateNote(note.trackId, note);
    }
  }

  async undo(): Promise<void> {
    const updatedNotes = this.prevNotes.map(note => 
      note.id === this.noteId 
        ? { 
            ...note, 
            length: this.oldLength,
            ...(this.oldColumn !== undefined && { column: this.oldColumn })
          }
        : note
    );
    
    this.setNotes(updatedNotes);
    
    // Update MIDI manager if the note has a trackId
    const note = updatedNotes.find(n => n.id === this.noteId);
    if (note?.trackId && this.store.getMidiManager) {
      await this.store.getMidiManager().updateNote(note.trackId, note);
    }
  }
}

export class NoteDeleteAction implements Action {
  type = 'NOTE_DELETE';

  constructor(
    private store: StoreInterface,
    private setNotes: React.Dispatch<React.SetStateAction<Note[]>>,
    private noteId: number,
    private prevNotes: Note[]
  ) {}

  async execute(): Promise<void> {
    // Find the note being deleted for MIDI manager update
    const noteToDelete = this.prevNotes.find(n => n.id === this.noteId);
    
    // Filter out the deleted note
    const updatedNotes = this.prevNotes.filter(note => note.id !== this.noteId);
    this.setNotes(updatedNotes);
    
    // Update MIDI manager if the note has a trackId
    if (noteToDelete?.trackId && this.store.getMidiManager) {
      await this.store.getMidiManager().removeNoteFromTrack(noteToDelete.trackId, this.noteId);
    }
  }

  async undo(): Promise<void> {
    // Find the note that was deleted
    const noteToRestore = this.prevNotes.find(n => n.id === this.noteId);
    if (!noteToRestore) return;
    
    // Add back the deleted note
    this.setNotes(this.prevNotes);
    
    // Update MIDI manager if the note has a trackId
    if (noteToRestore.trackId && this.store.getMidiManager) {
      await this.store.getMidiManager().addNoteToTrack(noteToRestore.trackId, noteToRestore);
    }
  }
}