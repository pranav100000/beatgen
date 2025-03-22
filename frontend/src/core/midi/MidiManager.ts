import { Midi } from '@tonejs/midi';
import * as Tone from 'tone';
import { v4 as uuidv4 } from 'uuid';
import { Note } from '../types/note';
import { MidiManagerInterface, MidiData, MidiTrack, MidiNote } from './types';

export class MidiManager implements MidiManagerInterface {
  private activePlayback: Map<string, Tone.Part> = new Map();
  private tracks: Map<string, Note[]> = new Map();
  private subscribers: Map<string, ((trackId: string, notes: Note[]) => void)[]> = new Map();

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
    const trackId = uuidv4();
    // Initialize with empty notes array
    this.tracks.set(trackId, []);
    
    return {
      id: trackId,
      instrumentId,
      notes: [],
      name: `Track ${instrumentId}`
    };
  }

  updateTrack(trackId: string, notes: Note[]): void {
    console.log(`MidiManager.updateTrack: Updating track ${trackId} with ${notes.length} notes`);
    
    // Store the notes in our internal map
    this.tracks.set(trackId, [...notes]);
    
    // Notify subscribers
    if (this.subscribers.has(trackId)) {
      const trackSubscribers = this.subscribers.get(trackId) || [];
      trackSubscribers.forEach(callback => callback(trackId, notes));
    }
  }

  // Subscribe to track updates
  subscribeToTrack(trackId: string, callback: (trackId: string, notes: Note[]) => void): () => void {
    if (!this.subscribers.has(trackId)) {
      this.subscribers.set(trackId, []);
    }
    
    const trackSubscribers = this.subscribers.get(trackId) || [];
    trackSubscribers.push(callback);
    this.subscribers.set(trackId, trackSubscribers);
    
    // Return unsubscribe function
    return () => {
      const currentSubscribers = this.subscribers.get(trackId) || [];
      this.subscribers.set(
        trackId, 
        currentSubscribers.filter(cb => cb !== callback)
      );
    };
  }

  // Get notes for a track
  getNotesForTrack(trackId: string): Note[] {
    return this.tracks.get(trackId) || [];
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