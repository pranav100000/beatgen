// /* tslint:disable */
// /* eslint-disable */
// /**
// /* This file was automatically generated from pydantic models by running pydantic2ts.
// /* Do not modify it by hand - just update the pydantic models and then re-run the script
// */

// export type FileType = "audio" | "midi" | "instrument";
// /**
//  * Enum for track types
//  */
// export type TrackType = "midi" | "audio" | "sampler" | "drum";

// /**
//  * Sound model for the database
//  */
// export interface MidiFile {
//   created_at?: string;
//   updated_at?: string;
//   id?: string;
//   name: string;
//   storage_key: string;
//   file_format: string;
//   file_size: number;
// }
// /**
//  * Base model for MIDI files
//  */
// export interface MidiFileBase {
//   created_at?: string;
//   updated_at?: string;
//   id?: string;
//   name: string;
//   storage_key: string;
//   file_format: string;
//   file_size: number;
// }
// /**
//  * Model for creating a new MIDI file
//  */
// export interface MidiFileCreate {
//   created_at?: string;
//   updated_at?: string;
//   id?: string;
//   name: string;
//   storage_key: string;
//   file_format: string;
//   file_size: number;
//   type?: FileType & string;
//   midi_file_id: string;
//   instrument_id?: string | null;
// }
// /**
//  * API response model for MIDI file data
//  */
// export interface MidiFileRead {
//   created_at?: string;
//   updated_at?: string;
//   id?: string;
//   name: string;
//   storage_key: string;
//   file_format: string;
//   file_size: number;
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
//  * User model for the database
//  */
// export interface User {
//   created_at?: string;
//   updated_at?: string;
//   id?: string;
//   email: string;
//   username?: string | null;
//   display_name?: string | null;
//   avatar_url?: string | null;
// }
