import { Midi } from '@tonejs/midi';
import * as Tone from 'tone';
import { v4 as uuidv4 } from 'uuid';
import { Note } from '../types/note';
import { MidiManagerInterface, MidiData, MidiTrack, MidiNote } from './types';

export class MidiManager implements MidiManagerInterface {
  private activePlayback: Map<string, Tone.Part> = new Map();

  async loadMidiFile(file: File): Promise<MidiData> {
    const arrayBuffer = await file.arrayBuffer();
    const midi = new Midi(arrayBuffer);

    const tracks: MidiTrack[] = midi.tracks.map(track => ({
      id: uuidv4(),
      instrumentId: track.instrument.name || 'default',
      notes: track.notes.map(note => ({
        id: Date.now(),
        row: note.midi,  // MIDI note number
        column: Math.floor(note.time * 4), // Convert time to grid columns (assuming quarter notes)
        length: Math.floor(note.duration * 4), // Convert duration to grid units
        velocity: note.velocity,
        duration: note.duration,
        time: note.time
      })),
      name: track.name
    }));

    return {
      tracks,
      bpm: midi.header.tempos[0]?.bpm || 120,
      timeSignature: [
        midi.header.timeSignatures[0]?.timeSignature[0] || 4,
        midi.header.timeSignatures[0]?.timeSignature[1] || 4
      ]
    };
  }

  createMidiFile(data: MidiData): Blob {
    const midi = new Midi();
    midi.header.setTempo(data.bpm);
    midi.header.timeSignatures.push({
      ticks: 0,
      timeSignature: data.timeSignature
    });

    data.tracks.forEach(track => {
      const midiTrack = midi.addTrack();
      track.notes.forEach(note => {
        midiTrack.addNote({
          midi: note.row,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity
        });
      });
    });

    return new Blob([midi.toArray()], { type: 'audio/midi' });
  }

  midiToNotes(midiData: MidiData): Note[] {
    // Flatten all tracks into a single array of notes
    return midiData.tracks.flatMap(track => 
      track.notes.map(note => ({
        id: note.id,
        row: note.row,
        column: note.column,
        length: note.length
      }))
    );
  }

  notesToMidi(notes: Note[], bpm: number): MidiData {
    const track: MidiTrack = {
      id: uuidv4(),
      instrumentId: 'default',
      notes: notes.map(note => ({
        ...note,
        velocity: 0.8, // Default velocity
        duration: note.length / 4, // Convert grid units to seconds
        time: note.column / 4 // Convert grid units to seconds
      }))
    };

    return {
      tracks: [track],
      bpm,
      timeSignature: [4, 4] // Default time signature
    };
  }

  createTrack(instrumentId: string): MidiTrack {
    return {
      id: uuidv4(),
      instrumentId,
      notes: [],
      name: `Track ${instrumentId}`
    };
  }

  updateTrack(trackId: string, notes: Note[]): void {
    // This would typically update the track in your project state
    // Implementation depends on your state management solution
  }

  schedulePlayback(track: MidiTrack): void {
    // Stop any existing playback for this track
    this.stopPlayback(track.id);

    // Create a new Tone.js Part for playback
    const part = new Tone.Part((time, note: MidiNote) => {
      // This would trigger the actual instrument playback
      // Implementation depends on your instrument system
      Tone.Transport.schedule(() => {
        // Trigger note through instrument system
      }, time);
    }, track.notes.map(note => [note.time, note]));

    part.start(0);
    this.activePlayback.set(track.id, part);
  }

  stopPlayback(trackId: string): void {
    const part = this.activePlayback.get(trackId);
    if (part) {
      part.dispose();
      this.activePlayback.delete(trackId);
    }
  }
} 