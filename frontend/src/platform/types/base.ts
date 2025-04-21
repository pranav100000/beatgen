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
 * Base model for audio files
 */
export interface AudioFileBase {
  created_at?: string;
  updated_at?: string;
  id?: string;
  name: string;
  storage_key: string;
  file_format: string;
  file_size: number;
  duration: number;
  sample_rate: number;
}
/**
 * Base model for files
 */
export interface FileBase {
  created_at?: string;
  updated_at?: string;
  id?: string;
  name: string;
  storage_key: string;
  file_format: string;
  file_size: number;
}
/**
 * Base model for instruments
 */
export interface InstrumentFileBase {
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
 * Base model for project tracks
 */
export interface ProjectTrackBase {
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
}
export interface SQLModel {}
/**
 * Base model with UUID primary key and timestamp fields
 */
export interface StandardBase {
  created_at?: string;
  updated_at?: string;
  id?: string;
}
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
/**
 * Mixin that adds UUID primary key
 */
export interface UUIDMixin {
  id?: string;
}
/**
 * Base model for users
 */
export interface UserBase {
  created_at?: string;
  updated_at?: string;
  id?: string;
  email: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}
