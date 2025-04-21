/* tslint:disable */
/* eslint-disable */
/**
/* This file was automatically generated from pydantic models by running pydantic2ts.
/* Do not modify it by hand - just update the pydantic models and then re-run the script
*/

/**
 * Enum for track types
 */
export type TrackType = "midi" | "audio" | "sampler" | "drum";

/**
 * API response model for instrument file data
 */
export interface InstrumentFileRead {
  created_at?: string;
  updated_at?: string;
  id?: string;
  name: string;
  storage_key: string;
  file_format: string;
  file_size: number;
  category: string;
  is_public: boolean;
  description?: string | null;
}
/**
 * MIDI Track model for the database
 */
export interface MidiTrack {
  created_at?: string;
  updated_at?: string;
  id: string;
  name: string;
  type: TrackType;
  instrument_id: string;
  midi_notes_json?: {
    [k: string]: unknown;
  };
  user_id: string;
}
/**
 * Base model for MIDI tracks
 */
export interface MidiTrackBase {
  created_at?: string;
  updated_at?: string;
  id: string;
  name: string;
  type: TrackType;
  instrument_id: string;
  midi_notes_json?: {
    [k: string]: unknown;
  };
}
/**
 * API request model for creating a MIDI track
 */
export interface MidiTrackCreate {
  created_at?: string;
  updated_at?: string;
  id: string;
  name: string;
  type: TrackType;
  instrument_id: string;
  midi_notes_json?: {
    [k: string]: unknown;
  };
}
/**
 * API response model for MIDI track data
 */
export interface MidiTrackRead {
  created_at?: string;
  updated_at?: string;
  id: string;
  name: string;
  type: TrackType;
  instrument_id: string;
  midi_notes_json?: {
    [k: string]: unknown;
  };
  instrument_file: InstrumentFileRead;
}
/**
 * API request model for updating a MIDI track
 */
export interface MidiTrackUpdate {
  created_at?: string;
  updated_at?: string;
  id: string;
  name?: string;
  type: TrackType;
  instrument_id?: string;
  midi_notes_json?: {
    [k: string]: unknown;
  };
}
export interface SQLModel {}
/**
 * Mixin that adds created_at and updated_at fields to models
 */
export interface TimestampMixin {
  created_at?: string;
  updated_at?: string;
}
/**
 * Base model for tracks
 */
export interface TrackBase {
  created_at?: string;
  updated_at?: string;
  id: string;
  name: string;
  type: TrackType;
}
