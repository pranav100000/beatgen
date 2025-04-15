import { historyManager } from '../core/state/history/HistoryManager';
import { Actions } from '../core/state/history/actions';
import { Store } from '../core/state/store';
import { convertFromNoteState, TICKS_PER_STEP, NoteState } from './noteConversion';

/**
 * Create a note with history tracking
 * 
 * @param store The global store
 * @param trackId The track ID
 * @param note The note to create
 * @returns Promise resolving when the action is complete
 */
export const createNoteWithHistory = (
  store: Store, 
  trackId: string, 
  note: NoteState
): Promise<void> => {
  const convertedNote = convertFromNoteState(note, trackId);
  
  const action = new Actions.AddNote(
    store,
    trackId,
    note.id.toString(),
    convertedNote
  );
  
  return historyManager.executeAction(action);
};

/**
 * Delete a note with history tracking
 * 
 * @param store The global store
 * @param trackId The track ID
 * @param noteId The note ID to delete
 * @param originalNote The original note for undo operations
 * @returns Promise resolving when the action is complete
 */
export const deleteNoteWithHistory = (
  store: Store,
  trackId: string,
  noteId: number,
  originalNote: NoteState
): Promise<void> => {
  const convertedNote = convertFromNoteState(originalNote, trackId);
  
  const action = new Actions.DeleteNote(
    store,
    trackId,
    noteId.toString(),
    convertedNote
  );
  
  return historyManager.executeAction(action);
};

/**
 * Move a note with history tracking
 * 
 * @param store The global store
 * @param trackId The track ID
 * @param noteId The note ID to move
 * @param oldNote The note's original state
 * @param newNote The note's new state
 * @returns Promise resolving when the action is complete
 */
export const moveNoteWithHistory = (
  store: Store,
  trackId: string,
  noteId: number,
  oldNote: NoteState,
  newNote: NoteState
): Promise<void> => {
  const convertedOldNote = convertFromNoteState(oldNote, trackId);
  
  // Convert tick-based positions to grid-based positions for the action
  const oldPosition = { 
    column: Math.round(oldNote.column / TICKS_PER_STEP), 
    row: oldNote.row 
  };
  
  const newPosition = { 
    column: Math.round(newNote.column / TICKS_PER_STEP), 
    row: newNote.row 
  };
  
  const action = new Actions.MoveNote(
    store,
    trackId,
    noteId.toString(),
    oldPosition,
    newPosition,
    convertedOldNote
  );
  
  return historyManager.executeAction(action);
};

/**
 * Resize a note with history tracking
 * 
 * @param store The global store
 * @param trackId The track ID
 * @param noteId The note ID to resize
 * @param oldNote The note's original state
 * @param newNote The note's new state
 * @returns Promise resolving when the action is complete
 */
export const resizeNoteWithHistory = (
  store: Store,
  trackId: string,
  noteId: number,
  oldNote: NoteState,
  newNote: NoteState
): Promise<void> => {
  const convertedOldNote = convertFromNoteState(oldNote, trackId);
  
  // Convert tick-based lengths to grid-based lengths for the action
  const oldLength = Math.round(oldNote.length / TICKS_PER_STEP);
  const newLength = Math.round(newNote.length / TICKS_PER_STEP);
  
  // If resizing from left side, we also need column change
  const oldColumn = Math.round(oldNote.column / TICKS_PER_STEP);
  const newColumn = Math.round(newNote.column / TICKS_PER_STEP);
  
  const action = new Actions.ResizeNote(
    store,
    trackId,
    noteId.toString(),
    oldLength,
    newLength,
    convertedOldNote,
    oldColumn !== newColumn ? oldColumn : undefined,
    oldColumn !== newColumn ? newColumn : undefined
  );
  
  return historyManager.executeAction(action);
};