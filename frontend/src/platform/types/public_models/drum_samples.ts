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
  | "cymbal";

/**
 * Drum sample model
 */
export interface DrumSamplePublic {
  created_at?: string;
  updated_at?: string;
  id?: string;
  file_name: string;
  display_name: string;
  storage_key: string;
  file_format: string;
  file_size: number;
  genre: GenreType;
  type: DrumSampleType;
  drum_kit_name: string;
  description?: string | null;
}
/**
 * Base model for drum samples
 */
export interface DrumSamplePublicBase {
  created_at?: string;
  updated_at?: string;
  id?: string;
  file_name: string;
  display_name: string;
  storage_key: string;
  file_format: string;
  file_size: number;
  genre: GenreType;
  type: DrumSampleType;
  drum_kit_name: string;
  description?: string | null;
}
/**
 * Drum sample create model
 */
export interface DrumSamplePublicCreate {
  created_at?: string;
  updated_at?: string;
  id?: string;
  file_name: string;
  display_name: string;
  storage_key: string;
  file_format: string;
  file_size: number;
  genre: GenreType;
  type: DrumSampleType;
  drum_kit_name: string;
  description?: string | null;
}
/**
 * Drum sample delete model
 */
export interface DrumSamplePublicDelete {
  id: string;
}
/**
 * Drum sample read model
 */
export interface DrumSamplePublicRead {
  created_at?: string;
  updated_at?: string;
  id: string;
  file_name: string;
  display_name: string;
  storage_key: string;
  file_format: string;
  file_size: number;
  genre: GenreType;
  type: DrumSampleType;
  drum_kit_name: string;
  description?: string | null;
}
/**
 * Drum sample update model
 */
export interface DrumSamplePublicUpdate {
  created_at?: string;
  updated_at?: string;
  id: string;
  file_name?: string;
  display_name?: string;
  storage_key?: string;
  file_format?: string;
  file_size?: number;
  genre?: GenreType;
  type: DrumSampleType;
  drum_kit_name?: string;
  description?: string | null;
}
export interface SQLModel {}
