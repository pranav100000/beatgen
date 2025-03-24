import { Note } from '../types/note';
import { TrackState } from '../types/track';
import { MidiManager } from '../midi/MidiManager';

export class MidiTrack {
  private notes: Note[] = [];
  private trackId: string;
  private instrumentId: string;
  private unsubscribe?: () => void;
  private instrumentName: string;
  
  constructor(instrumentName: string, trackId: string, instrumentId: string, initialNotes: Note[] = [], midiManager?: MidiManager) {
    this.instrumentName = instrumentName;
    this.trackId = trackId;
    this.instrumentId = instrumentId;
    this.notes = [...initialNotes];
    
    console.log(`MidiTrack initialized:`, {
      trackId,
      instrumentId,
      initialNoteCount: initialNotes.length,
      initialNotes
    });

    // Subscribe to updates from MidiManager if provided
    if (midiManager) {
      this.unsubscribe = midiManager.subscribeToTrack(trackId, (trackId, updatedNotes) => {
        console.log(`MidiTrack received update from MidiManager:`, {
          trackId,
          thisTrackId: this.trackId,
          noteCount: updatedNotes.length,
          updatedNotes
        });
        
        if (trackId === this.trackId) {
          this.updateNotes(updatedNotes);
        }
      });
      
      // Initialize with notes from MidiManager if available
      const managerNotes = midiManager.getNotesForTrack(trackId);
      if (managerNotes.length > 0) {
        this.notes = [...managerNotes];
      }
    }
  }

  /**
   * Updates the notes in this MIDI track
   */
  updateNotes(notes: Note[]): void {
    console.log(`MidiTrack.updateNotes:`, {
      trackId: this.trackId,
      oldNoteCount: this.notes.length,
      newNoteCount: notes.length,
      notes
    });
    this.notes = [...notes];
  }

  /**
   * Gets the notes in this MIDI track
   */
  getNotes(): Note[] {
    console.log(`MidiTrack.getNotes:`, {
      trackId: this.trackId,
      noteCount: this.notes.length,
      notes: this.notes
    });
    return this.notes;
  }

  /**
   * Convenience method to get the ID of this track
   */
  getId(): string {
    return this.trackId;
  }

  /**
   * Convenience method to get the instrument ID of this track
   */
  getInstrumentId(): string {
    return this.instrumentId;
  }

  /**
   * Handles a click on the track
   */
  handleClick(track: TrackState): void {
    console.log(`MidiTrack.handleClick:`, {
      trackId: this.trackId,
      trackObj: track
    });
    // Add implementation for click behavior if needed
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
} 