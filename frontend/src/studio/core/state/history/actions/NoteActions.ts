import { Store } from '../../store';
import { Note } from '../../../types/note';
import { NoteAction } from './BaseAction';

/**
 * Action for adding a note without callbacks
 */
export class AddNoteAction extends NoteAction {
    readonly type = 'NOTE_ADD';
    private note: Note;

    constructor(
        store: Store,
        trackId: string,
        noteId: string,
        note: Note
    ) {
        super(store, trackId, noteId);
        this.note = note;
    }

    async execute(): Promise<void> {
        // Get the MIDI manager
        const midiManager = this.store.getMidiManager();
        if (!midiManager) {
            console.error(`${this.type}: MidiManager not available`);
            return;
        }

        try {
            // Ensure the note has trackId and correct id
            const noteWithId = {
                ...this.note,
                id: parseInt(this.noteId),
                trackId: this.trackId
            };
            
            // Add note using MidiManager - central source of truth
            await midiManager.addNoteToTrack(this.trackId, noteWithId);
            
            this.log('Execute', {
                trackId: this.trackId,
                noteId: this.noteId,
                row: this.note.row,
                column: this.note.column,
                length: this.note.length
            });
        } catch (error) {
            console.error(`Error adding note to track ${this.trackId}:`, error);
        }
    }

    async undo(): Promise<void> {
        // Get the MIDI manager
        const midiManager = this.store.getMidiManager();
        if (!midiManager) {
            console.error(`${this.type}: MidiManager not available`);
            return;
        }

        try {
            // Remove the note by ID
            await midiManager.removeNoteFromTrack(this.trackId, parseInt(this.noteId));
            
            this.log('Undo', {
                trackId: this.trackId,
                noteId: this.noteId
            });
        } catch (error) {
            console.error(`Error removing note ${this.noteId} from track ${this.trackId}:`, error);
        }
    }
}

/**
 * Action for removing a note without callbacks
 */
export class DeleteNoteAction extends NoteAction {
    readonly type = 'NOTE_DELETE';
    private note: Note;

    constructor(
        store: Store,
        trackId: string,
        noteId: string,
        note: Note
    ) {
        super(store, trackId, noteId);
        this.note = { ...note }; // Store a copy for undo
    }

    async execute(): Promise<void> {
        // Get the MIDI manager
        const midiManager = this.store.getMidiManager();
        if (!midiManager) {
            console.error(`${this.type}: MidiManager not available`);
            return;
        }

        try {
            // Remove the note by ID
            await midiManager.removeNoteFromTrack(this.trackId, parseInt(this.noteId));
            
            this.log('Execute', {
                trackId: this.trackId,
                noteId: this.noteId
            });
        } catch (error) {
            console.error(`Error removing note ${this.noteId} from track ${this.trackId}:`, error);
        }
    }

    async undo(): Promise<void> {
        // Get the MIDI manager
        const midiManager = this.store.getMidiManager();
        if (!midiManager) {
            console.error(`${this.type}: MidiManager not available`);
            return;
        }

        try {
            // Restore the note
            await midiManager.addNoteToTrack(this.trackId, this.note);
            
            this.log('Undo', {
                trackId: this.trackId,
                noteId: this.noteId,
                row: this.note.row,
                column: this.note.column,
                length: this.note.length
            });
        } catch (error) {
            console.error(`Error restoring note ${this.noteId} to track ${this.trackId}:`, error);
        }
    }
}

/**
 * Action for moving a note without callbacks
 */
export class MoveNoteAction extends NoteAction {
    readonly type = 'NOTE_MOVE';
    private oldPosition: { column: number, row: number };
    private newPosition: { column: number, row: number };
    private noteData: Note;

    constructor(
        store: Store,
        trackId: string,
        noteId: string,
        oldPosition: { column: number, row: number },
        newPosition: { column: number, row: number },
        noteData: Note
    ) {
        super(store, trackId, noteId);
        this.oldPosition = oldPosition;
        this.newPosition = newPosition;
        this.noteData = { ...noteData }; // Save a copy of the original note
    }

    private async updateNotePosition(position: { column: number, row: number }): Promise<void> {
        // Get the MIDI manager
        const midiManager = this.store.getMidiManager();
        if (!midiManager) {
            console.error(`${this.type}: MidiManager not available`);
            return;
        }

        try {
            // Create updated note with new position
            const updatedNote: Note = {
                ...this.noteData,
                id: parseInt(this.noteId),
                row: position.row,
                column: position.column,
                trackId: this.trackId
            };
            
            // Update the note through MidiManager
            await midiManager.updateNote(this.trackId, updatedNote);
        } catch (error) {
            console.error(`Error updating position of note ${this.noteId} in track ${this.trackId}:`, error);
        }
    }

    async execute(): Promise<void> {
        await this.updateNotePosition(this.newPosition);
        this.log('Execute', {
            trackId: this.trackId,
            noteId: this.noteId,
            from: this.oldPosition,
            to: this.newPosition
        });
    }

    async undo(): Promise<void> {
        await this.updateNotePosition(this.oldPosition);
        this.log('Undo', {
            trackId: this.trackId,
            noteId: this.noteId,
            from: this.newPosition,
            to: this.oldPosition
        });
    }
}

/**
 * Action for resizing a note without callbacks
 */
export class ResizeNoteAction extends NoteAction {
    readonly type = 'NOTE_RESIZE';
    private oldLength: number;
    private newLength: number;
    private noteData: Note;
    private oldColumn?: number;
    private newColumn?: number;

    constructor(
        store: Store,
        trackId: string,
        noteId: string,
        oldLength: number,
        newLength: number,
        noteData: Note,
        oldColumn?: number,
        newColumn?: number
    ) {
        super(store, trackId, noteId);
        this.oldLength = oldLength;
        this.newLength = newLength;
        this.noteData = { ...noteData }; // Save a copy of the original note
        this.oldColumn = oldColumn;
        this.newColumn = newColumn;
    }

    private async updateNoteSize(length: number, column?: number): Promise<void> {
        // Get the MIDI manager
        const midiManager = this.store.getMidiManager();
        if (!midiManager) {
            console.error(`${this.type}: MidiManager not available`);
            return;
        }

        try {
            // Create updated note with new length and possibly new column
            const updatedNote: Note = {
                ...this.noteData,
                id: parseInt(this.noteId),
                length,
                trackId: this.trackId,
                ...(column !== undefined && { column })
            };
            
            // Update the note through MidiManager
            await midiManager.updateNote(this.trackId, updatedNote);
        } catch (error) {
            console.error(`Error resizing note ${this.noteId} in track ${this.trackId}:`, error);
        }
    }

    async execute(): Promise<void> {
        await this.updateNoteSize(this.newLength, this.newColumn);
        this.log('Execute', {
            trackId: this.trackId,
            noteId: this.noteId,
            from: { length: this.oldLength, column: this.oldColumn },
            to: { length: this.newLength, column: this.newColumn }
        });
    }

    async undo(): Promise<void> {
        await this.updateNoteSize(this.oldLength, this.oldColumn);
        this.log('Undo', {
            trackId: this.trackId,
            noteId: this.noteId,
            from: { length: this.newLength, column: this.newColumn },
            to: { length: this.oldLength, column: this.oldColumn }
        });
    }
}

/**
 * Export all note actions
 */
export const NoteActions = {
    AddNote: AddNoteAction,
    DeleteNote: DeleteNoteAction,
    MoveNote: MoveNoteAction,
    ResizeNote: ResizeNoteAction
};