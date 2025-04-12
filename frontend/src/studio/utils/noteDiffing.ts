import { NoteState } from './noteConversion';

/**
 * Types of changes that can be detected between note arrays
 */
export type NoteDiff = {
  type: 'add' | 'delete' | 'move' | 'resize';
  id: number;
  note: NoteState;
  oldNote?: NoteState;
};

/**
 * Detect differences between two arrays of notes
 * Used to determine what actions to trigger (add, delete, move, resize)
 * 
 * @param oldNotes Previous array of notes
 * @param newNotes New array of notes
 * @returns Array of detected changes
 */
export const diffNotes = (oldNotes: NoteState[], newNotes: NoteState[]): NoteDiff[] => {
  const diffs: NoteDiff[] = [];
  
  // Create maps for faster lookups
  const oldMap = new Map(oldNotes.map(note => [note.id, note]));
  const newMap = new Map(newNotes.map(note => [note.id, note]));
  
  // Check for added notes (exist in new but not in old)
  newNotes.forEach(note => {
    const id = note.id;
    if (!oldMap.has(id)) {
      diffs.push({ type: 'add', id, note });
    }
  });
  
  // Check for deleted notes (exist in old but not in new)
  oldNotes.forEach(oldNote => {
    const id = oldNote.id;
    if (!newMap.has(id)) {
      diffs.push({ type: 'delete', id, note: oldNote });
    }
  });
  
  // Check for modified notes (exist in both but have changed)
  newNotes.forEach(newNote => {
    const id = newNote.id;
    const oldNote = oldMap.get(id);
    if (oldNote) {
      // Position changed (move)
      if (oldNote.row !== newNote.row || oldNote.column !== newNote.column) {
        diffs.push({ type: 'move', id, note: newNote, oldNote });
      }
      // Length changed (resize)
      else if (oldNote.length !== newNote.length) {
        diffs.push({ type: 'resize', id, note: newNote, oldNote });
      }
    }
  });
  
  return diffs;
};