import React, { createContext, useContext, useState } from 'react';
import { Note } from '../../../core/types/note';
import { historyManager } from '../../../core/state/history/HistoryManager';
import { NoteCreateAction, NoteMoveAction, NoteResizeAction } from '../../../core/state/history/actions/NoteActions';
import { useStudioStore } from '../../../stores/useStudioStore';

// Define the types for the context
interface PianoRollContextType {
  // State
  activePianoRoll: string | null;
  openedPianoRolls: Record<string, boolean>;
  notesByTrack: Record<string, Note[]>;
  
  // Actions
  openPianoRoll: (trackId: string) => void;
  closePianoRoll: (trackId: string) => void;
  createNote: (trackId: string, note: Note) => Promise<void>;
  moveNote: (trackId: string, noteId: number, oldPos: { x: number, y: number }, newPos: { x: number, y: number }) => Promise<void>;
  resizeNote: (trackId: string, noteId: number, oldLength: number, newLength: number, oldColumn?: number, newColumn?: number) => Promise<void>;
  playPreview: (midiNote: number) => void;
  stopPreview: (midiNote: number) => void;
}

// Create the context
const PianoRollContext = createContext<PianoRollContextType | null>(null);

// Context provider component
export const PianoRollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePianoRoll, setActivePianoRoll] = useState<string | null>(null);
  const [openedPianoRolls, setOpenedPianoRolls] = useState<Record<string, boolean>>({});
  const [notesByTrack, setNotesByTrack] = useState<Record<string, Note[]>>({});
  
  // Get access to store
  const { store } = useStudioStore();
  
  // Add listener for MIDI notes loaded event
  React.useEffect(() => {
    const handleMidiNotesLoaded = (event: Event) => {
      const customEvent = event as CustomEvent<{trackId: string, notes: Note[]}>;
      const { trackId, notes } = customEvent.detail;
      
      console.log(`PianoRollContext: Received midi-notes-loaded event for track ${trackId} with ${notes.length} notes`);
      
      // Update the notes for this track
      setNotesByTrack(prev => ({
        ...prev,
        [trackId]: notes
      }));
      
      // Ensure the piano roll for this track is initialized
      if (!openedPianoRolls[trackId]) {
        setOpenedPianoRolls(prev => ({
          ...prev,
          [trackId]: true
        }));
      }
    };
    
    // Add event listener
    window.addEventListener('midi-notes-loaded', handleMidiNotesLoaded);
    
    // Clean up
    return () => {
      window.removeEventListener('midi-notes-loaded', handleMidiNotesLoaded);
    };
  }, []); // Empty dependency array to prevent re-rendering loop
  
  // IMPORTANT: The above effect uses an empty dependency array despite referencing openedPianoRolls.
  // This is intentional to prevent a circular dependency that causes excessive re-rendering during playback.
  // The functional state updates (prev => ...) ensure we always work with current state values.

  // Open a specific track's piano roll
  const openPianoRoll = (trackId: string) => {
    console.log('Opening piano roll for track:', trackId);
    
    setActivePianoRoll(trackId);
    setOpenedPianoRolls(prev => ({ ...prev, [trackId]: true }));
    
    // Initialize notes array for this track if it doesn't exist
    if (!notesByTrack[trackId]) {
      console.log('Initializing notes array for track:', trackId);
      setNotesByTrack(prev => ({ ...prev, [trackId]: [] }));
    }
    
    // Log the current state for debugging
    console.log('Piano roll state after opening:', {
      activePianoRoll: trackId,
      openedPianoRolls: { ...openedPianoRolls, [trackId]: true },
      notesByTrack
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
    
    // Get current notes for this track
    const trackNotes = notesByTrack[trackId] || [];
    
    // Create a note with the trackId embedded
    const noteWithTrackId = { ...note, trackId };
    
    // Create a history action
    const action = new NoteCreateAction(
      store,
      (newNotes: Note[]) => {
        setNotesByTrack(prev => {
          const updated = {...prev};
          updated[trackId] = newNotes;
          return updated;
        });
      },
      noteWithTrackId,
      trackNotes
    );
    
    // Execute the action through history manager
    await historyManager.executeAction(action);
  };

  // Move a note with history tracking
  const moveNote = async (trackId: string, noteId: number, oldPos: { x: number, y: number }, newPos: { x: number, y: number }) => {
    if (!store) return;
    
    // Get current notes for this track
    const trackNotes = notesByTrack[trackId] || [];
    
    // Create a history action
    const action = new NoteMoveAction(
      store,
      (newNotes: Note[]) => {
        setNotesByTrack(prev => {
          const updated = {...prev};
          updated[trackId] = newNotes;
          return updated;
        });
      },
      noteId,
      oldPos,
      newPos,
      trackNotes
    );
    
    // Execute the action through history manager
    await historyManager.executeAction(action);
  };

  // Resize a note with history tracking
  const resizeNote = async (trackId: string, noteId: number, oldLength: number, newLength: number, oldColumn?: number, newColumn?: number) => {
    if (!store) return;
    
    // Get current notes for this track
    const trackNotes = notesByTrack[trackId] || [];
    
    // Create a history action
    const action = new NoteResizeAction(
      store,
      (newNotes: Note[]) => {
        setNotesByTrack(prev => {
          const updated = {...prev};
          updated[trackId] = newNotes;
          return updated;
        });
      },
      noteId,
      oldLength,
      newLength,
      trackNotes,
      oldColumn,
      newColumn
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
    notesByTrack,
    openPianoRoll,
    closePianoRoll,
    createNote,
    moveNote,
    resizeNote,
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