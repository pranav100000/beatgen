import { MidiManager } from '../../../core/midi/MidiManager';
import { InstrumentManager } from '../../../core/instruments/InstrumentManager';
import { Note } from '../../../core/types/note';
import { MidiTrack } from '../../../core/midi/types';

export class PianoRollManager {
  private midiManager: MidiManager;
  private instrumentManager: InstrumentManager;
  private activeTrackId: string | null = null;
  private activeInstrumentId: string | null = null;

  constructor(midiManager: MidiManager, instrumentManager: InstrumentManager) {
    this.midiManager = midiManager;
    this.instrumentManager = instrumentManager;
  }

  setActiveTrack(trackId: string, instrumentId: string) {
    this.activeTrackId = trackId;
    this.activeInstrumentId = instrumentId;
  }

  // Note operations
  updateNotes(notes: Note[]) {
    if (!this.activeTrackId) return;
    this.midiManager.updateTrack(this.activeTrackId, notes);
  }

  // Playback
  playNote(note: number) {
    if (!this.activeInstrumentId) return;
    this.instrumentManager.playNote(this.activeInstrumentId, note);
  }

  stopNote(note: number) {
    if (!this.activeInstrumentId) return;
    this.instrumentManager.stopNote(this.activeInstrumentId, note);
  }

  // Track operations
  async createNewTrack(instrumentId: string, name: string): Promise<MidiTrack> {
    return this.midiManager.createTrack(instrumentId, name);
  }

  // MIDI file operations
  async importMidi(file: File) {
    const midiData = await this.midiManager.loadMidiFile(file);
    return midiData;
  }

  exportMidi(notes: Note[], bpm: number): Blob {
    const midiData = this.midiManager.notesToMidi(notes, bpm);
    return this.midiManager.createMidiFile(midiData);
  }

  // Cleanup
  dispose() {
    this.activeTrackId = null;
    this.activeInstrumentId = null;
  }
} 