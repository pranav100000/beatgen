import { Note } from '../types/note';

export interface MidiNote extends Note {
  velocity: number;
  duration: number;  // in seconds
  time: number;      // start time in seconds
}

export interface MidiTrack {
  id: string;
  instrumentId: string;
  notes: MidiNote[];
  name?: string;
}

export interface MidiData {
  tracks: MidiTrack[];
  bpm: number;
  timeSignature: [number, number];
}

export interface MidiManagerInterface {
  // Core MIDI operations
  loadMidiFile(id: string, file: File): Promise<MidiData>;
  createMidiFile(data: MidiData): Blob;
  
  // Note conversion
  midiToNotes(midiData: MidiData): Note[];
  notesToMidi(notes: Note[], bpm: number): MidiData;
  
  // Track operations
  createTrack(instrumentId: string, name: string): MidiTrack;
  updateTrack(trackId: string, notes: Note[]): void;
  getNotesForTrack(trackId: string): Note[];
  
  // Note operations
  addNoteToTrack(trackId: string, note: Note): Promise<void>;
  removeNoteFromTrack(trackId: string, noteId: number): Promise<void>;
  updateNote(trackId: string, updatedNote: Note): Promise<void>;
} 