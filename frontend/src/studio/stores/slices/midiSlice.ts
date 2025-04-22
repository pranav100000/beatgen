import { Store } from '../../core/state/store';
import { RootState, SetFn, GetFn, StoreSliceCreator } from '../types';
import { MidiManager } from '../../core/midi/MidiManagerNew'; // Assuming MidiManagerNew is the intended class
import { Note } from '../../../types/note';
import { NoteState } from '../../components/drum-machine/DrumMachine';
import { convertFromNoteState } from '../../utils/noteConversion';
// Import history actions
import { Actions } from '../../core/state/history/actions';

// Define the actions for this slice
// This slice might not hold state directly, as MidiManager is the source of truth
export interface MidiSlice {
  addMidiNote: (trackId: string, note: NoteState) => void;
  removeMidiNote: (trackId: string, noteId: number) => void;
  updateMidiNote: (trackId: string, note: NoteState) => void;
  getTrackNotes: (trackId: string) => Note[] | null;
}

// Create the slice function
export const createMidiSlice: StoreSliceCreator<MidiSlice> = (set, get) => {
  const rootGet = get as GetFn; // Helper for root state access

  // Helper function to get the MidiManager instance
  const getMidiManager = (): MidiManager | null => {
    const store = rootGet().store;
    // Fix: Assume store has a getMidiManager() method
    return store?.getMidiManager ? store.getMidiManager() : null; 
  };

  // Add a MIDI note to a track and record history
  const addMidiNote = async (trackId: string, note: NoteState): Promise<void> => {
    const { store, _withErrorHandling, executeHistoryAction } = rootGet();
    const midiManager = getMidiManager();
    if (!store || !_withErrorHandling || !executeHistoryAction) { return; }
    
    const internalNoteData = convertFromNoteState({ ...note, id: -1 }, trackId); 
    // History action needs a stable ID for undo. 
    // This still assumes MidiManager assigns ID internally upon add.
    // The Action's execute/undo might need modification to handle this properly.
    const tempNoteIdString = note.id?.toString() || crypto.randomUUID(); 

    const addLogic = async () => {
        // REMOVE: Direct call to midiManager
        // await midiManager.addNoteToTrack(trackId, internalNoteData);
        
        // Create action - Its execute method will call midiManager.addNoteToTrack
        const action = new Actions.AddNote(get, trackId, tempNoteIdString, internalNoteData);
        await executeHistoryAction(action);
    };
    await _withErrorHandling(addLogic, 'addMidiNote')();
  };

  // Remove a MIDI note from a track and record history
  const removeMidiNote = async (trackId: string, noteId: number): Promise<void> => {
    const { store, _withErrorHandling, executeHistoryAction } = rootGet();
    const midiManager = getMidiManager();
    if (!store || !midiManager || !_withErrorHandling || !executeHistoryAction) { return; }
    const originalNote = midiManager.getTrackNotes(trackId)?.find(n => n.id === noteId);
    if (!originalNote) { return; }

    const removeLogic = async () => {
        // REMOVE: Direct call to midiManager
        // await midiManager.removeNoteFromTrack(trackId, noteId);

        // Create action - Its execute method will call midiManager.removeNoteFromTrack
        const action = new Actions.DeleteNote(get, trackId, noteId.toString(), { ...originalNote }); 
        await executeHistoryAction(action);
    };
    await _withErrorHandling(removeLogic, 'removeMidiNote')();
  };

  // Update an existing MIDI note and record history
  const updateMidiNote = async (trackId: string, note: NoteState): Promise<void> => {
    const { store, _withErrorHandling, executeHistoryAction } = rootGet();
    const midiManager = getMidiManager();
    if (!store || !midiManager || !_withErrorHandling || !executeHistoryAction) { return; }
    if (note.id === undefined || note.id === null || note.id === -1) { return; }
    const noteId = note.id as number;
    const originalNote = midiManager.getTrackNotes(trackId)?.find(n => n.id === noteId);
    if (!originalNote) { return; }

    const updateLogic = async () => {
        // REMOVE: Direct call to midiManager
        // const internalNote = convertFromNoteState(note, trackId);
        // await midiManager.updateNote(trackId, internalNote);
        
        // Create Move or Resize action
        const oldNoteForCompare = originalNote;
        const newNoteForCompare = convertFromNoteState(note, trackId); // Convert for comparison
        let action = null; 

        if (oldNoteForCompare.column !== newNoteForCompare.column || oldNoteForCompare.row !== newNoteForCompare.row) {
            const oldPos = { column: Math.round(oldNoteForCompare.column), row: oldNoteForCompare.row };
            const newPos = { column: Math.round(newNoteForCompare.column), row: newNoteForCompare.row };
             if (oldNoteForCompare.length !== newNoteForCompare.length) {
                 action = new Actions.ResizeNote(get, trackId, noteId.toString(), Math.round(oldNoteForCompare.length), Math.round(newNoteForCompare.length), { ...originalNote }, oldPos.column, newPos.column);
             } else {
                 action = new Actions.MoveNote(get, trackId, noteId.toString(), oldPos, newPos, { ...originalNote });
             }
        } 
        else if (oldNoteForCompare.length !== newNoteForCompare.length) {
            action = new Actions.ResizeNote(get, trackId, noteId.toString(), Math.round(oldNoteForCompare.length), Math.round(newNoteForCompare.length), { ...originalNote });
        }
        // else if velocity changed -> create VelocityChangeAction (if implemented)

        // Execute the appropriate action (its execute method will call midiManager.updateNote)
        if (action) {
             await executeHistoryAction(action);
        } else {
            // Only velocity changed or no change - no history recorded for now
            // If direct update without history is needed for velocity-only changes, call midiManager here:
            if (oldNoteForCompare.velocity !== newNoteForCompare.velocity) {
                 console.log("Velocity changed, updating MidiManager directly (no history)");
                 await midiManager.updateNote(trackId, newNoteForCompare); // Direct update for non-historized change
            } else {
                 console.warn(`No move/resize change detected for updateMidiNote (ID: ${noteId}), no history recorded.`);
            }
        }
    };
    await _withErrorHandling(updateLogic, 'updateMidiNote')();
  };

  // Get all notes for a specific track (no history involved)
  const getTrackNotes = (trackId: string): Note[] | null => {
    const midiManager = getMidiManager();
    if (!midiManager) {
      console.error("Cannot getTrackNotes: MidiManager not available");
      return null;
    }
    try {
      // Directly call MidiManager method
      return midiManager.getTrackNotes(trackId);
    } catch (error) {
      console.error(`Error in getTrackNotes for track ${trackId}:`, error);
      return null;
    }
  };

  return {
    // Actions that interact with MidiManager
    addMidiNote,
    removeMidiNote,
    updateMidiNote,
    getTrackNotes,
  };
};
