import React, { createContext, useContext, useRef, useState } from 'react';
import { Note } from '../../../core/types/note';
import { PianoRollManager } from '../managers/PianoRollManager';
import { MidiManager } from '../../../core/midi/MidiManager';
import { InstrumentManager } from '../../../core/instruments/InstrumentManager';

interface PianoRollContextType {
  isOpen: boolean;
  activeInstrumentId: string | null;
  notes: Note[];
  openPianoRoll: (instrumentId: string) => void;
  closePianoRoll: () => void;
  updateNotes: (notes: Note[]) => void;
  playNote: (note: number) => void;
  stopNote: (note: number) => void;
  importMidi: (file: File) => Promise<void>;
  exportMidi: (bpm: number) => Blob;
}

const PianoRollContext = createContext<PianoRollContextType | null>(null);

export const PianoRollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeInstrumentId, setActiveInstrumentId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  
  // Initialize managers
  const managerRef = useRef<PianoRollManager | null>(null);
  if (!managerRef.current) {
    const midiManager = new MidiManager();
    const instrumentManager = new InstrumentManager();
    managerRef.current = new PianoRollManager(midiManager, instrumentManager);
  }

  const openPianoRoll = (instrumentId: string) => {
    setActiveInstrumentId(instrumentId);
    setIsOpen(true);
  };

  const closePianoRoll = () => {
    setIsOpen(false);
    setActiveInstrumentId(null);
  };

  const updateNotes = (newNotes: Note[]) => {
    setNotes(newNotes);
    managerRef.current?.updateNotes(newNotes);
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
        notes,
        openPianoRoll,
        closePianoRoll,
        updateNotes,
        playNote,
        stopNote,
        importMidi,
        exportMidi
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