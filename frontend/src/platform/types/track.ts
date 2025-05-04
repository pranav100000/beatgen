// /* tslint:disable */
// /* eslint-disable */
// /**
// /* This file was automatically generated from pydantic models by running pydantic2ts.
// /* Do not modify it by hand - just update the pydantic models and then re-run the script
// */

// /**
//  * Enum for track types
//  */
// export type TrackType = "midi" | "audio" | "sampler" | "drum";

// /**
//  * Represents the association between a Project and a Track,
//  * storing properties specific to this relationship (e.g., position, volume).
//  */
// export interface ProjectTrack {
//   created_at?: string;
//   updated_at?: string;
//   id?: string;
//   name: string;
//   volume?: number | null;
//   pan?: number | null;
//   mute?: boolean | null;
//   x_position?: number | null;
//   y_position?: number | null;
//   trim_start_ticks?: number | null;
//   trim_end_ticks?: number | null;
//   duration_ticks?: number | null;
//   track_number?: number | null;
//   project_id?: string;
//   track_id?: string;
// }
// export interface SQLModel {}
// /**
//  * Mixin that adds created_at and updated_at fields to models
//  */
// export interface TimestampMixin {
//   created_at?: string;
//   updated_at?: string;
// }
// /**
//  * Track model for the database
//  */
// export interface Track {
//   created_at?: string;
//   updated_at?: string;
//   id?: string;
//   name: string;
//   type: TrackType;
//   user_id: string;
//   audio_file_id?: string | null;
//   midi_file_id?: string | null;
//   instrument_id?: string | null;
//   drum_track_id?: string | null;
// }
// /**
//  * Base model for tracks
//  */
// export interface TrackBase {
//   created_at?: string;
//   updated_at?: string;
//   id?: string;
//   name: string;
//   type: TrackType;
// }
// /**
//  * API request model for creating a track
//  */
// export interface TrackCreate {
//   created_at?: string;
//   updated_at?: string;
//   id?: string;
//   name: string;
//   type: TrackType;
// }
// /**
//  * API response model for track data
//  */
// export interface TrackRead {
//   created_at?: string;
//   updated_at?: string;
//   id?: string;
//   name: string;
//   type: TrackType;
// }
// /**
//  * API request model for updating a track
//  */
// export interface TrackUpdate {
//   created_at?: string;
//   updated_at?: string;
//   id?: string;
//   name: string;
//   type: TrackType;
// }
// /**
//  * Mixin that adds UUID primary key
//  */
// export interface UUIDMixin {
//   id?: string;
// }
