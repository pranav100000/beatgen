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
 * API response model for audio track data
 */
export interface AudioTrackRead {
  created_at?: string;
  updated_at?: string;
  id: string;
  name: string;
  type: TrackType;
  audio_file_storage_key: string;
  audio_file_format: string;
  audio_file_size: number;
  audio_file_duration: number;
  audio_file_sample_rate: number;
}
/**
 * Model that combines Track and ProjectTrack data for API responses
 */
export interface CombinedTrack {
  id: string;
  name: string;
  type: TrackType;
  volume?: number | null;
  pan?: number | null;
  mute?: boolean | null;
  x_position?: number | null;
  y_position?: number | null;
  trim_start_ticks?: number | null;
  trim_end_ticks?: number | null;
  duration_ticks?: number | null;
  track_number?: number | null;
  track: AudioTrackRead | MidiTrackRead | SamplerTrackRead | DrumTrackRead;
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
  [k: string]: unknown;
}
/**
 * API response model for sampler track data
 */
export interface SamplerTrackRead {
  created_at?: string;
  updated_at?: string;
  id: string;
  name: string;
  type: TrackType;
  base_midi_note: number;
  grain_size: number;
  overlap: number;
  audio_storage_key: string;
  audio_file_format: string;
  audio_file_size: number;
  audio_file_name: string;
  audio_file_duration: number;
  audio_file_sample_rate: number;
  midi_notes_json?: {
    [k: string]: unknown;
  };
}
/**
 * API response model for drum track data
 */
export interface DrumTrackRead {
  created_at?: string;
  updated_at?: string;
  id: string;
  name: string;
  type: TrackType;
}
/**
 * Project model for the database
 */
export interface Project {
  created_at?: string;
  updated_at?: string;
  id?: string;
  name: string;
  bpm: number;
  time_signature_numerator: number;
  time_signature_denominator: number;
  key_signature: string;
  user_id: string;
}
/**
 * Base model for projects
 */
export interface ProjectBase {
  created_at?: string;
  updated_at?: string;
  id?: string;
  name: string;
  bpm: number;
  time_signature_numerator: number;
  time_signature_denominator: number;
  key_signature: string;
}
/**
 * API request model for creating a project
 */
export interface ProjectCreate {
  created_at?: string;
  updated_at?: string;
  id?: string;
  name: string;
  bpm: number;
  time_signature_numerator: number;
  time_signature_denominator: number;
  key_signature: string;
}
/**
 * API response model for project data
 */
export interface ProjectRead {
  created_at?: string;
  updated_at?: string;
  id?: string;
  name: string;
  bpm: number;
  time_signature_numerator: number;
  time_signature_denominator: number;
  key_signature: string;
}
/**
 * Represents the association between a Project and a specific track type,
 * storing properties specific to this relationship (e.g., position, volume).
 */
export interface ProjectTrack {
  created_at?: string;
  updated_at?: string;
  name: string;
  volume?: number | null;
  pan?: number | null;
  mute?: boolean | null;
  x_position?: number | null;
  y_position?: number | null;
  trim_start_ticks?: number | null;
  trim_end_ticks?: number | null;
  duration_ticks?: number | null;
  track_number?: number | null;
  project_id?: string;
  track_id?: string;
  track_type: TrackType;
}
/**
 * Model for reading project-track data
 */
export interface ProjectTrackRead {
  created_at?: string;
  updated_at?: string;
  name: string;
  volume?: number | null;
  pan?: number | null;
  mute?: boolean | null;
  x_position?: number | null;
  y_position?: number | null;
  trim_start_ticks?: number | null;
  trim_end_ticks?: number | null;
  duration_ticks?: number | null;
  track_number?: number | null;
  track_type: TrackType;
  track_id: string;
  project_id: string;
}
/**
 * API request model for updating a project
 */
export interface ProjectUpdate {
  name?: string | null;
  bpm?: number | null;
  time_signature_numerator?: number | null;
  time_signature_denominator?: number | null;
  key_signature?: string | null;
}
/**
 * API response model for project with tracks data
 */
export interface ProjectWithTracks {
  created_at?: string;
  updated_at?: string;
  id?: string;
  name: string;
  bpm: number;
  time_signature_numerator: number;
  time_signature_denominator: number;
  key_signature: string;
  user_id: string;
  tracks?: CombinedTrack[];
}
export interface SQLModel {}
