// import { historyManager } from '../core/state/history/HistoryManager';
// import { Actions } from '../core/state/history/actions';
// import { Store } from '../core/state/store';
// import { convertFromNoteState, TICKS_PER_STEP, NoteState } from './noteConversion';
// import { GetFn } from '../stores/types';

// /**
//  * Create a note with history tracking
//  * 
//  * @param get The global store
//  * @param trackId The track ID
//  * @param note The note to create
//  * @returns Promise resolving when the action is complete
//  */
// export const createNoteWithHistory = (
//   get: GetFn,
//   trackId: string, 
//   note: NoteState
// ): Promise<void> => {
//   const convertedNote = convertFromNoteState(note, trackId);
//   const storeInstance = get().store;
//   if (!storeInstance) {
//       console.error("Store not available in createNoteWithHistory");
//       return Promise.resolve();
//   }
  
//   const action = new Actions.AddNote(
//     storeInstance,
//     trackId,
//     note.id.toString(),
//     convertedNote
//   );
  
//   return get().executeHistoryAction(action);
// };

// /**
//  * Delete a note with history tracking
//  * 
//  * @param get The global store
//  * @param trackId The track ID
//  * @param noteId The note ID to delete
//  * @param originalNote The original note for undo operations
//  * @returns Promise resolving when the action is complete
//  */
// export const deleteNoteWithHistory = (
//   get: GetFn,
//   trackId: string,
//   noteId: number,
//   originalNote: NoteState
// ): Promise<void> => {
//   const convertedNote = convertFromNoteState(originalNote, trackId);
//   const storeInstance = get().store;
//   if (!storeInstance) {
//       console.error("Store not available in deleteNoteWithHistory");
//       return Promise.resolve();
//   }
  
//   const action = new Actions.DeleteNote(
//     storeInstance,
//     trackId,
//     noteId.toString(),
//     convertedNote
//   );
  
//   return get().executeHistoryAction(action);
// };

// /**
//  * Move a note with history tracking
//  * 
//  * @param get The global store
//  * @param trackId The track ID
//  * @param noteId The note ID to move
//  * @param oldNote The note's original state
//  * @param newNote The note's new state
//  * @returns Promise resolving when the action is complete
//  */
// export const moveNoteWithHistory = (
//   get: GetFn,
//   trackId: string,
//   noteId: number,
//   oldNote: NoteState,
//   newNote: NoteState
// ): Promise<void> => {
//   const convertedOldNote = convertFromNoteState(oldNote, trackId);
  
//   // Convert tick-based positions to grid-based positions for the action
//   const oldPosition = { 
//     column: Math.round(oldNote.column), 
//     row: oldNote.row 
//   };
  
//   const newPosition = { 
//     column: Math.round(newNote.column), 
//     row: newNote.row 
//   };
  
//   const storeInstance = get().store;
//   if (!storeInstance) {
//       console.error("Store not available in moveNoteWithHistory");
//       return Promise.resolve();
//   }
  
//   const action = new Actions.MoveNote(
//     storeInstance,
//     trackId,
//     noteId.toString(),
//     oldPosition,
//     newPosition,
//     convertedOldNote
//   );
  
//   return get().executeHistoryAction(action);
// };

// /**
//  * Resize a note with history tracking
//  * 
//  * @param get The global store
//  * @param trackId The track ID
//  * @param noteId The note ID to resize
//  * @param oldNote The note's original state
//  * @param newNote The note's new state
//  * @returns Promise resolving when the action is complete
//  */
// export const resizeNoteWithHistory = (
//   get: GetFn,
//   trackId: string,
//   noteId: number,
//   oldNote: NoteState,
//   newNote: NoteState
// ): Promise<void> => {
//   const convertedOldNote = convertFromNoteState(oldNote, trackId);
  
//   // Convert tick-based lengths to grid-based lengths for the action
//   const oldLength = Math.round(oldNote.length);
//   const newLength = Math.round(newNote.length);
  
//   // If resizing from left side, we also need column change
//   const oldColumn = Math.round(oldNote.column);
//   const newColumn = Math.round(newNote.column);
  
//   const storeInstance = get().store;
//   if (!storeInstance) {
//       console.error("Store not available in resizeNoteWithHistory");
//       return Promise.resolve();
//   }
  
//   const action = new Actions.ResizeNote(
//     storeInstance,
//     trackId,
//     noteId.toString(),
//     oldLength,
//     newLength,
//     convertedOldNote,
//     oldColumn !== newColumn ? oldColumn : undefined,
//     oldColumn !== newColumn ? newColumn : undefined
//   );
  
//   return get().executeHistoryAction(action);
// };