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
 * Audio Track model for the database
 */
export interface AudioTrack {
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
  user_id: string;
}
/**
 * Base model for audio tracks
 */
export interface AudioTrackBase {
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
 * API request model for creating an audio track
 */
export interface AudioTrackCreate {
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
 * API request model for deleting an audio track
 */
export interface AudioTrackDelete {}
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
 * API request model for updating an audio track
 */
export interface AudioTrackUpdate {
  created_at?: string;
  updated_at?: string;
  id: string;
  name?: string;
  type: TrackType;
  audio_file_storage_key?: string;
  audio_file_format?: string;
  audio_file_size?: number;
  audio_file_duration?: number;
  audio_file_sample_rate?: number;
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
