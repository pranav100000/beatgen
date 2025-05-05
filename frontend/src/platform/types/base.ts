/* tslint:disable */
/* eslint-disable */
/**
/* This file was automatically generated from pydantic models by running pydantic2ts.
/* Do not modify it by hand - just update the pydantic models and then re-run the script
*/

export type GenreType = "pop" | "rock" | "jazz" | "blues" | "country" | "hip_hop" | "rap" | "electronic";
export type DrumSampleType =
  | "kick"
  | "snare"
  | "closed_hh"
  | "open_hh"
  | "crash"
  | "ride"
  | "tom"
  | "rim"
  | "clap"
  | "cymbal"
  | "eight_o_eight";

/**
 * Mixin that adds UUID primary key (generates default value)
 */
export interface DefaultUUIDMixin {
  id?: string;
}
/**
 * Base model with default UUID primary key and default timestamp fields
 */
export interface DefaultUUIDStandardBase {
  created_at?: string;
  updated_at?: string;
  id?: string;
}
/**
 * Base model for drum samples
 */
export interface DrumSamplePublicBase {
  created_at?: string;
  updated_at?: string;
  id: string;
  file_name: string;
  display_name: string;
  storage_key: string;
  file_format: string;
  file_size: number;
  genre: GenreType;
  category: DrumSampleType;
  kit_name: string;
  duration?: number | null;
  description?: string | null;
  waveform_data?: number[] | null;
}
/**
 * Base model for files
 */
export interface FileBase {
  created_at?: string;
  updated_at?: string;
  id: string;
  file_name: string;
  display_name: string;
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
  id: string;
  file_name: string;
  display_name: string;
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
  volume: number;
  pan: number;
  mute: boolean;
  x_position: number;
  y_position: number;
  trim_start_ticks: number;
  trim_end_ticks: number;
  duration_ticks: number;
  track_number: number;
}
export interface SQLModel {}
/**
 * Base model with UUID primary key with mandatory provided UUID and default timestamp fields
 */
export interface StandardBase {
  created_at?: string;
  updated_at?: string;
  id: string;
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
}
/**
 * Mixin that adds UUID primary key (needs to be provided)
 */
export interface UUIDMixin {
  id: string;
}
/**
 * Base model for users
 */
export interface UserBase {
  created_at?: string;
  updated_at?: string;
  id: string;
  email: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}
