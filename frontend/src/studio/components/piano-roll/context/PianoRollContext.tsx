import React, { createContext, useContext, useState, useEffect } from 'react';
import { Note } from '../../../core/types/note';
import { historyManager } from '../../../core/state/history/HistoryManager';
import { useStudioStore } from '../../../stores/useStudioStore';
import { Actions } from '../../../core/state/history/actions';

// Define the types for the context
interface PianoRollContextType {
  // State
  activePianoRoll: string | null;
  openedPianoRolls: Record<string, boolean>;
  getNotesForTrack: (trackId: string) => Note[];
  
  // Actions
  openPianoRoll: (trackId: string) => void;
  closePianoRoll: (trackId: string) => void;
  createNote: (trackId: string, note: Note) => Promise<void>;
  moveNote: (trackId: string, noteId: number, oldPos: { x: number, y: number }, newPos: { x: number, y: number }) => Promise<void>;
  resizeNote: (trackId: string, noteId: number, oldLength: number, newLength: number, oldColumn?: number, newColumn?: number) => Promise<void>;
  deleteNote: (trackId: string, noteId: number) => Promise<void>;
  playPreview: (midiNote: number) => void;
  stopPreview: (midiNote: number) => void;
}

// Create the context
const PianoRollContext = createContext<PianoRollContextType | null>(null);

// Context provider component
export const PianoRollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePianoRoll, setActivePianoRoll] = useState<string | null>(null);
  const [openedPianoRolls, setOpenedPianoRolls] = useState<Record<string, boolean>>({});
  
  // We'll use this to trigger re-renders when notes change
  const [noteUpdateCounter, setNoteUpdateCounter] = useState<number>(0);
  
  // Get access to store
  const { store } = useStudioStore();
  
  // Subscribe to all MidiManager updates
  useEffect(() => {
    if (!store) return;
    
    const midiManager = store.getMidiManager();
    if (!midiManager) return;
    
    console.log('PianoRollContext: Subscribing to all MidiManager updates');
    
    // Subscribe to all track updates to keep UI in sync
    const unsubscribe = midiManager.subscribeToAllUpdates((trackId, notes) => {
      console.log(`PianoRollContext: Received MidiManager update for track ${trackId} with ${notes.length} notes`);
      
      // Simply increment counter to trigger re-renders
      setNoteUpdateCounter(prev => prev + 1);
      
      // Ensure the piano roll for this track is initialized if it has notes
      if (notes.length > 0 && !openedPianoRolls[trackId]) {
        setOpenedPianoRolls(prev => ({
          ...prev,
          [trackId]: true
        }));
      }
    });
    
    // Clean up
    return () => {
      console.log('PianoRollContext: Unsubscribing from MidiManager');
      unsubscribe();
    };
  }, [store]); // Only depend on store to avoid re-subscription issues

  // Helper function to get notes from MidiManager
  const getNotesForTrack = (trackId: string): Note[] => {
    if (!store) return [];
    
    const midiManager = store.getMidiManager();
    if (!midiManager) return [];
    
    // Get notes directly from MidiManager
    const notes = midiManager.getTrackNotes(trackId);
    return notes || []; // Return empty array if null
  };
  
  // Open a specific track's piano roll
  const openPianoRoll = (trackId: string) => {
    console.log('Opening piano roll for track:', trackId);
    
    setActivePianoRoll(trackId);
    setOpenedPianoRolls(prev => ({ ...prev, [trackId]: true }));
    
    // Log the current state for debugging
    console.log('Piano roll state after opening:', {
      activePianoRoll: trackId,
      openedPianoRolls: { ...openedPianoRolls, [trackId]: true },
      tracksWithNotes: store?.getMidiManager()?.hasTrack(trackId) || false
    });
  };

  // Close a specific track's piano roll
  const closePianoRoll = (trackId: string) => {
    setOpenedPianoRolls(prev => ({ ...prev, [trackId]: false }));
    if (activePianoRoll === trackId) {
      setActivePianoRoll(null);
    }
  };

  // Create a new note with history tracking
  const createNote = async (trackId: string, note: Note) => {
    if (!store) return;
    
    const midiManager = store.getMidiManager();
    if (!midiManager) return;
    
    // Generate a noteId if not present
    const noteId = note.id?.toString() || Math.floor(Math.random() * 100000).toString();
    
    // Create note with direct action
    const action = new Actions.AddNote(
      store,
      trackId,
      noteId,
      note
    );
    
    // Execute the action through history manager
    await historyManager.executeAction(action);
  };

  // Move a note with history tracking
  const moveNote = async (trackId: string, noteId: number, oldPos: { x: number, y: number }, newPos: { x: number, y: number }) => {
    if (!store) return;
    
    const midiManager = store.getMidiManager();
    if (!midiManager) return;
    
    // Ensure track exists in MidiManager
    if (!midiManager.hasTrack(trackId)) {
      console.warn(`Cannot move note in non-existent track ${trackId}`);
      return;
    }
    
    // Get original note data (needed for the action)
    const trackNotes = midiManager.getTrackNotes(trackId);
    const noteData = trackNotes?.find(n => n.id === noteId);
    
    if (!noteData) {
      console.warn(`Cannot find note ${noteId} in track ${trackId}`);
      return;
    }
    
    // Convert UI coordinates to MIDI data format
    const oldPosition = { column: oldPos.x, row: oldPos.y };
    const newPosition = { column: newPos.x, row: newPos.y };
    
    // Create direct note move action
    const action = new Actions.MoveNote(
      store,
      trackId,
      noteId.toString(),
      oldPosition,
      newPosition,
      noteData
    );
    
    // Execute the action through history manager
    await historyManager.executeAction(action);
  };

  // Resize a note with history tracking
  const resizeNote = async (trackId: string, noteId: number, oldLength: number, newLength: number, oldColumn?: number, newColumn?: number) => {
    if (!store) return;
    
    const midiManager = store.getMidiManager();
    if (!midiManager) return;
    
    // Ensure track exists in MidiManager
    if (!midiManager.hasTrack(trackId)) {
      console.warn(`Cannot resize note in non-existent track ${trackId}`);
      return;
    }
    
    // Get original note data (needed for the action)
    const trackNotes = midiManager.getTrackNotes(trackId);
    const noteData = trackNotes?.find(n => n.id === noteId);
    
    if (!noteData) {
      console.warn(`Cannot find note ${noteId} in track ${trackId}`);
      return;
    }
    
    // Create direct note resize action
    const action = new Actions.ResizeNote(
      store,
      trackId,
      noteId.toString(),
      oldLength,
      newLength,
      noteData,
      oldColumn,
      newColumn
    );
    
    // Execute the action through history manager
    await historyManager.executeAction(action);
  };
  
  // Delete a note with history tracking
  const deleteNote = async (trackId: string, noteId: number) => {
    if (!store) return;
    
    const midiManager = store.getMidiManager();
    if (!midiManager) return;
    
    // Ensure track exists in MidiManager
    if (!midiManager.hasTrack(trackId)) {
      console.warn(`Cannot delete note in non-existent track ${trackId}`);
      return;
    }
    
    // Find the note for undo purposes
    const trackNotes = midiManager.getTrackNotes(trackId);
    const noteToDelete = trackNotes?.find(n => n.id === noteId);
    
    if (!noteToDelete) {
      console.warn(`Cannot find note ${noteId} in track ${trackId}`);
      return;
    }
    
    // Create direct note delete action
    const action = new Actions.DeleteNote(
      store,
      trackId,
      noteId.toString(),
      noteToDelete
    );
    
    // Execute the action through history manager
    await historyManager.executeAction(action);
  };

  // Play a preview of a note
  const playPreview = (midiNote: number) => {
    if (!store || !activePianoRoll) return;
    
    // Get the track to find its instrument
    const track = store.getTrackById?.(activePianoRoll);
    if (!track) return;
    
    // Play the note using the instrument manager
    // Cast to any to bypass TypeScript error since instrumentId will be added by MidiManager
    store.getInstrumentManager()?.playNote((track as any).instrumentId || 'default', midiNote);
  };

  // Stop a preview note
  const stopPreview = (midiNote: number) => {
    if (!store || !activePianoRoll) return;
    
    // Get the track to find its instrument
    const track = store.getTrackById?.(activePianoRoll);
    if (!track) return;
    
    // Stop the note using the instrument manager
    // Cast to any to bypass TypeScript error since instrumentId will be added by MidiManager
    store.getInstrumentManager()?.stopNote((track as any).instrumentId || 'default', midiNote);
  };

  // Create context value
  const contextValue: PianoRollContextType = {
    activePianoRoll,
    openedPianoRolls,
    getNotesForTrack, // Provide function to get notes directly from MidiManager
    openPianoRoll,
    closePianoRoll,
    createNote,
    moveNote,
    resizeNote,
    deleteNote,
    playPreview,
    stopPreview
  };

  return (
    <PianoRollContext.Provider value={contextValue}>
      {children}
    </PianoRollContext.Provider>
  );
};

// Hook to use the piano roll context
export const usePianoRoll = (): PianoRollContextType => {
  const context = useContext(PianoRollContext);
  if (!context) {
    throw new Error('usePianoRoll must be used within a PianoRollProvider');
  }
  return context;
};