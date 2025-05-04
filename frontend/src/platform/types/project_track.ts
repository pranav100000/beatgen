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
  volume: number;
  pan: number;
  mute: boolean;
  x_position: number;
  y_position: number;
  trim_start_ticks: number;
  trim_end_ticks: number;
  duration_ticks: number;
  track_number: number;
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
/**
 * Model for creating a new project-track relationship
 */
export interface ProjectTrackCreate {
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
  project_id: string;
  track_id: string;
  track_type: TrackType;
}
/**
 * Base DTO for Project-Track relationships
 */
export interface ProjectTrackRead {
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
  project_id: string;
  track_id: string;
  track_type: TrackType;
}
/**
 * Model for updating project-track settings
 */
export interface ProjectTrackUpdate {
  created_at?: string;
  updated_at?: string;
  name?: string;
  volume?: number;
  pan?: number;
  mute?: boolean;
  x_position?: number;
  y_position?: number;
  trim_start_ticks?: number;
  trim_end_ticks?: number;
  duration_ticks?: number;
  track_number?: number;
  project_id: string;
  track_id: string;
  track_type: TrackType;
}
export interface SQLModel {}
