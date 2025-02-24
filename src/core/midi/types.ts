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
  loadMidiFile(file: File): Promise<MidiData>;
  createMidiFile(data: MidiData): Blob;
  
  // Note conversion
  midiToNotes(midiData: MidiData): Note[];
  notesToMidi(notes: Note[], bpm: number): MidiData;
  
  // Track operations
  createTrack(instrumentId: string): MidiTrack;
  updateTrack(trackId: string, notes: Note[]): void;
  
  // Playback integration
  schedulePlayback(track: MidiTrack): void;
  stopPlayback(trackId: string): void;
} 