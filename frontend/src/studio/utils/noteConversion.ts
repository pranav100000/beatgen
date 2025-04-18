import { Note } from '../core/types/note';
import { MUSIC_CONSTANTS } from '../constants/musicConstants';
// Define NoteState interface (matching PianoRoll2's interface)
export interface NoteState {
  id: number;
  length: number;  // Length in ticks (1/960th of a beat)
  row: number;     // Row index (0-131 for our 132 keys)
  column: number;  // Column position in ticks (1/960th of a beat)
  velocity?: number; // Optional velocity
};

/**
 * MIDI timing constants
 */
export const PULSES_PER_QUARTER_NOTE = MUSIC_CONSTANTS.pulsesPerQuarterNote; // Standard MIDI pulses per quarter note
export const TICKS_PER_STEP = PULSES_PER_QUARTER_NOTE; // 240 ticks per step (16th note)

/**
 * Convert from app Note format to PianoRoll2 NoteState format
 * Translates grid-based positioning to tick-based positioning
 */
export const convertToNoteState = (note: Note): NoteState => ({
  id: note.id,
  row: note.row,
  column: note.column, // Convert grid units to ticks
  length: note.length, // Convert grid units to ticks
  velocity: note.velocity,
});

/**
 * Convert from PianoRoll2 NoteState format to app Note format
 * Translates tick-based positioning to grid-based positioning
 */
export const convertFromNoteState = (note: NoteState, trackId: string): Note => ({
  id: note.id,
  row: note.row,
  column: Math.round(note.column), // Convert ticks to grid units
  length: Math.round(note.length), // Convert ticks to grid units
  trackId,
  velocity: note.velocity ?? 0.8, // Default velocity if not provided
});

export const scaleToPreview = (dimension: number): number => {
  return Math.round(dimension / TICKS_PER_STEP);
};