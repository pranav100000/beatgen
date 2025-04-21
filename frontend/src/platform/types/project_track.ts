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
/**
 * Model for creating a new project-track relationship
 */
export interface ProjectTrackCreate {
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
 * Base DTO for Project-Track relationships
 */
export interface ProjectTrackDTO {
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
 * Model for updating project-track settings
 */
export interface ProjectTrackUpdate {
  name?: string | null;
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
