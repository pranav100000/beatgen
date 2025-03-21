import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { Note } from '../../../core/types/note';
import { PianoRollManager } from '../managers/PianoRollManager';
import { MidiManager } from '../../../core/midi/MidiManager';
import { InstrumentManager } from '../../../core/instruments/InstrumentManager';
import { useStore } from '../../../core/state/StoreContext';

// Type for note change subscriber callbacks
type NoteChangeSubscriber = (trackId: string, notes: Note[]) => void;

interface PianoRollContextType {
  isOpen: boolean;
  activeInstrumentId: string | null;
  activeTrackId: string | null;
  notes: Note[];
  openPianoRoll: (trackId?: string, instrumentId?: string, initialNotes?: Note[]) => void;
  closePianoRoll: (maintainActiveTrack?: boolean) => void;
  updateNotes: (notes: Note[]) => void;
  playNote: (note: number) => void;
  stopNote: (note: number) => void;
  importMidi: (file: File) => Promise<void>;
  exportMidi: (bpm: number) => Blob;
  // Add subscription methods
  subscribeToNoteChanges: (callback: NoteChangeSubscriber) => () => void;
}

const PianoRollContext = createContext<PianoRollContextType | null>(null);

export const PianoRollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeInstrumentId, setActiveInstrumentId] = useState<string | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const store = useStore();
  
  // Collection of subscribers to note changes
  const noteChangeSubscribers = useRef<NoteChangeSubscriber[]>([]);
  
  // Initialize managers
  const managerRef = useRef<PianoRollManager | null>(null);
  if (!managerRef.current) {
    // Use store managers instead of creating new instances
    const midiManager = store.getMidiManager();
    const instrumentManager = store.getInstrumentManager();
    managerRef.current = new PianoRollManager(midiManager, instrumentManager);
  }

  // When notes change, update the MidiManager if we have an active track
  useEffect(() => {
    // If we have an active track, update the MidiManager
    if (activeTrackId) {
      const midiManager = store.getMidiManager();
      midiManager.updateTrack(activeTrackId, notes);
      
      // Notify subscribers of note changes
      noteChangeSubscribers.current.forEach(subscriber => {
        subscriber(activeTrackId, notes);
      });
      
      console.log(`PianoRollContext: Updated notes for track ${activeTrackId}`, {
        noteCount: notes.length
      });
    }
  }, [notes, activeTrackId, store]);

  const openPianoRoll = (trackId?: string, instrumentId?: string, initialNotes?: Note[]) => {
    const selectedInstrumentId = instrumentId || 'default';
    setActiveInstrumentId(selectedInstrumentId);
    
    // If a track ID is provided, set it as active and load its notes
    if (trackId) {
      setActiveTrackId(trackId);
      
      // If initialNotes are provided, use them
      if (initialNotes && initialNotes.length > 0) {
        console.log(`PianoRollContext: Opening piano roll with provided notes for track ${trackId}`, {
          noteCount: initialNotes.length
        });
        setNotes(initialNotes);
        
        // Also update MidiManager immediately to ensure consistency
        const midiManager = store.getMidiManager();
        midiManager.updateTrack(trackId, initialNotes);
      } else {
        // Otherwise, try to get notes from MidiManager
        const midiManager = store.getMidiManager();
        const trackNotes = midiManager.getNotesForTrack(trackId);
        if (trackNotes.length > 0) {
          console.log(`PianoRollContext: Opening piano roll with notes from MidiManager for track ${trackId}`, {
            noteCount: trackNotes.length
          });
          setNotes(trackNotes);
        } else {
          // Default to empty notes array if no notes are found
          console.log(`PianoRollContext: Opening piano roll with empty notes for track ${trackId}`);
          // Notes already set to [] above, no need to set again
        }
      }
    } else {
      setActiveTrackId(null);
      // Notes already set to [] above, no need to set again
    }
    
    setIsOpen(true);
  };

  const closePianoRoll = (maintainActiveTrack = false) => {
    // When closing, save changes to the active track if there is one
    if (activeTrackId) {
      const midiManager = store.getMidiManager();
      midiManager.updateTrack(activeTrackId, notes);
      
      // Notify subscribers of note changes one last time before closing
      noteChangeSubscribers.current.forEach(subscriber => {
        subscriber(activeTrackId, notes);
      });
      
      console.log(`PianoRollContext: Saving notes on close for track ${activeTrackId}`, {
        noteCount: notes.length
      });
    }
    
    // Close the UI
    setIsOpen(false);
    
    // Only clear the active track if maintainActiveTrack is false
    if (!maintainActiveTrack) {
      setActiveTrackId(null);
      setActiveInstrumentId(null);
    } else {
      console.log(`PianoRollContext: Closing piano roll UI but maintaining active track ${activeTrackId}`);
    }
  };

  const updateNotes = (newNotes: Note[]) => {
    setNotes(newNotes);
    
    // If we have an active track, update the MidiManager
    if (activeTrackId) {
      managerRef.current?.updateNotes(newNotes);
      
      // Notify subscribers immediately of note changes
      noteChangeSubscribers.current.forEach(subscriber => {
        subscriber(activeTrackId, newNotes);
      });
    }
  };

  // Add subscription method
  const subscribeToNoteChanges = (callback: NoteChangeSubscriber): (() => void) => {
    noteChangeSubscribers.current.push(callback);
    
    // If we have an active track, trigger the callback immediately with current notes
    // This ensures new subscribers get the current state right away
    if (activeTrackId) {
      console.log(`PianoRollContext: Immediately notifying new subscriber for track ${activeTrackId} with ${notes.length} notes`);
      callback(activeTrackId, notes);
    }
    
    // Return unsubscribe function
    return () => {
      noteChangeSubscribers.current = noteChangeSubscribers.current.filter(cb => cb !== callback);
    };
  };

  const playNote = (note: number) => {
    managerRef.current?.playNote(note);
  };

  const stopNote = (note: number) => {
    managerRef.current?.stopNote(note);
  };

  const importMidi = async (file: File) => {
    if (!managerRef.current) return;
    const midiData = await managerRef.current.importMidi(file);
    setNotes(midiData.tracks[0]?.notes || []);
  };

  const exportMidi = (bpm: number): Blob => {
    if (!managerRef.current) throw new Error('Manager not initialized');
    return managerRef.current.exportMidi(notes, bpm);
  };

  return (
    <PianoRollContext.Provider
      value={{
        isOpen,
        activeInstrumentId,
        activeTrackId,
        notes,
        openPianoRoll,
        closePianoRoll,
        updateNotes,
        playNote,
        stopNote,
        importMidi,
        exportMidi,
        subscribeToNoteChanges
      }}
    >
      {children}
    </PianoRollContext.Provider>
  );
};

export const usePianoRoll = (): PianoRollContextType => {
  const context = useContext(PianoRollContext);
  if (!context) {
    throw new Error('usePianoRoll must be used within a PianoRollProvider');
  }
  return context;
}; 