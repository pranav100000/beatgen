/**
 * Types for sound/audio file management
 */

export interface Sound {
  id: string;
  user_id: string;
  name: string;
  file_format: string;
  duration: number;
  file_size: number;
  sample_rate: number;
  waveform_data: number[];
  created_at: string;
  updated_at: string;
  storage_key: string;
}