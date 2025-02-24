import { Action } from '../types';
import { StoreInterface } from '../../store';
import { Note } from '../../../types/note';
import { Position } from '../../../types/track';

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
  }

  async undo(): Promise<void> {
    this.setNotes(this.prevNotes);
  }
}

export class NoteMoveAction implements Action {
  type = 'NOTE_MOVE';

  constructor(
    private store: StoreInterface,
    private setNotes: React.Dispatch<React.SetStateAction<Note[]>>,
    private noteId: number,
    private oldPosition: Position,
    private newPosition: Position,
    private prevNotes: Note[]
  ) {}

  async execute(): Promise<void> {
    this.setNotes(this.prevNotes.map(note => 
      note.id === this.noteId 
        ? { ...note, row: this.newPosition.y, column: this.newPosition.x }
        : note
    ));
  }

  async undo(): Promise<void> {
    this.setNotes(this.prevNotes.map(note => 
      note.id === this.noteId 
        ? { ...note, row: this.oldPosition.y, column: this.oldPosition.x }
        : note
    ));
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
    this.setNotes(this.prevNotes.map(note => 
      note.id === this.noteId 
        ? { 
            ...note, 
            length: this.newLength,
            ...(this.newColumn !== undefined && { column: this.newColumn })
          }
        : note
    ));
  }

  async undo(): Promise<void> {
    this.setNotes(this.prevNotes.map(note => 
      note.id === this.noteId 
        ? { 
            ...note, 
            length: this.oldLength,
            ...(this.oldColumn !== undefined && { column: this.oldColumn })
          }
        : note
    ));
  }
} 