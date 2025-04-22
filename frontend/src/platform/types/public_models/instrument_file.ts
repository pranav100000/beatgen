/* tslint:disable */
/* eslint-disable */
/**
/* This file was automatically generated from pydantic models by running pydantic2ts.
/* Do not modify it by hand - just update the pydantic models and then re-run the script
*/

/**
 * Instrument model for the database
 */
export interface InstrumentFile {
  created_at?: string;
  updated_at?: string;
  id?: string;
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
 * Base model for instruments
 */
export interface InstrumentFileBase {
  created_at?: string;
  updated_at?: string;
  id?: string;
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
 * API response model for instrument file data
 */
export interface InstrumentFileRead {
  created_at?: string;
  updated_at?: string;
  id?: string;
  file_name: string;
  display_name: string;
  storage_key: string;
  file_format: string;
  file_size: number;
  category: string;
  is_public: boolean;
  description?: string | null;
}
export interface SQLModel {}
