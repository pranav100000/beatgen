/* tslint:disable */
/* eslint-disable */
/**
/* This file was automatically generated from pydantic models by running pydantic2ts.
/* Do not modify it by hand - just update the pydantic models and then re-run the script
*/

/**
 * Base model with default UUID primary key and default timestamp fields
 */
export interface DefaultUUIDStandardBase {
  created_at?: string;
  updated_at?: string;
  id?: string;
}
/**
 * Drum Track model for the database
 */
export interface DrumTrack {
  created_at?: string;
  updated_at?: string;
  id: string;
  name: string;
  user_id: string;
}
/**
 * Base model for drum tracks
 */
export interface DrumTrackBase {
  created_at?: string;
  updated_at?: string;
  id: string;
  name: string;
}
/**
 * API request model for creating a drum track
 */
export interface DrumTrackCreate {
  created_at?: string;
  updated_at?: string;
  id: string;
  name: string;
}
/**
 * API response model for drum track data
 */
export interface DrumTrackRead {
  created_at?: string;
  updated_at?: string;
  id: string;
  name: string;
}
/**
 * API request model for updating a drum track
 */
export interface DrumTrackUpdate {
  created_at?: string;
  updated_at?: string;
  id: string;
  name?: string;
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
}
