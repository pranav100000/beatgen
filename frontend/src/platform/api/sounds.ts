import { apiClient } from './client';
import { AudioTrackRead, MidiTrackRead, SamplerTrackRead } from '../types/project';
//import { SamplerTrack } from 'src/types/track';
import { AudioTrackCreate } from '../types/track_models/audio_track';
import { MidiTrackCreate } from '../types/track_models/midi_track';
import { SamplerTrackCreate } from '../types/track_models/sampler_track';

// Keep using the Sound interface from studio for now until we can fully migrate

export interface UploadUrlResponse {
  id: string;
  upload_url: string;
  storage_key: string;
}

// API request interfaces - these extend the generated types with API-specific fields
// export interface AudioTrackCreateRequest extends  {
//   type: 'audio';
//   audio_file_id: string;
//   file_format: string;
//   duration: number;
//   file_size: number;
//   sample_rate: number;
//   waveform_data: number[];
//   storage_key: string;
// }

// export interface MidiFileCreateRequest extends TrackCreate {
//   type: 'midi';
//   midi_file_id: string;
//   file_format: string;
//   file_size?: number;      // Optional now
//   storage_key?: string;    // Optional now
//   instrument_id?: string;
//   midi_notes_json: Record<string, any>; // Required
// }

// export interface SamplerTrackCreateRequest extends TrackCreate {
//   type: 'sampler';
//   audio_storage_key: string;
//   audio_file_format: string;
//   audio_file_size: number;
//   audio_file_name: string;
//   base_midi_note?: number;
//   grain_size?: number;
//   overlap?: number;
//   audio_file_duration: number;
//   audio_file_sample_rate: number;
//   midi_notes_json: Record<string, any>; // Required
// }

/**
 * Get a presigned URL for uploading a file (audio or MIDI)
 * @param fileName The name of the file to upload
 * @param id The ID to use for the sound (UUID)
 * @param fileType The type of file ('audio' or 'midi')
 * @returns Object containing upload URL, ID, and storage key
 */
export const getUploadUrl = async (
  fileName: string, 
  id: string, 
  fileType: 'audio' | 'soundfont',
  shouldOverwrite: boolean = false
): Promise<UploadUrlResponse> => {
  const response = await apiClient.post('/sounds/upload-url', { 
    file_name: fileName,
    id: id, // Always pass the ID
    file_type: fileType,
    should_overwrite: shouldOverwrite
  });
  return response.data;
};

/**
 * Create a sound record after successful upload
 * @param soundData The sound data including metadata
 * @returns The created sound object
 */
export const createSoundRecord = async (soundData: AudioTrackCreate): Promise<AudioTrackRead> => {
  console.log('Creating audio file and track records with data:', {
    ...soundData,
  });
  
  try {
    const response = await apiClient.post('/sounds/audio', soundData);
    console.log('Audio record created successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating audio record:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
};

/**
 * Create a MIDI track record with notes data
 * @param midiData The MIDI track data with notes_json containing the note data
 * @returns The created MIDI track object
 */
export const createMidiFileRecord = async (midiData: MidiTrackCreate): Promise<MidiTrackRead> => {
  console.log('Creating MIDI file and track records with data:', midiData);
  
  try {
    const response = await apiClient.post('/sounds/midi', midiData);
    console.log('MIDI file record created successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating MIDI file record:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
};

/**
 * Create a sampler track record after successful upload of both audio and MIDI files
 * @param samplerData The sampler track data
 * @returns The created sampler track object
 */
export const createSamplerTrackRecord = async (samplerData: SamplerTrackCreate): Promise<SamplerTrackRead> => {
  console.log('Creating sampler track record with data:', samplerData);
  
  try {
    // Transform the data to match backend expectations
    const transformedData = {
      ...samplerData,
      // Map the fields that need renaming
      duration: samplerData.audio_file_duration,
      sample_rate: samplerData.audio_file_sample_rate,
    };
    
    console.log('Transformed sampler track data:', transformedData);
    
    const response = await apiClient.post('/sounds/sampler', transformedData);
    console.log('Sampler track record created successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating sampler track record:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
};

/**
 * Get all sounds for the current user
 * @returns Array of sounds
 */
export const getSounds = async (): Promise<AudioTrackRead[]> => {
  const response = await apiClient.get('/sounds');
  return response.data;
};

/**
 * Get a specific sound by ID
 * @param id The sound ID
 * @returns The sound object
 */
export const getSound = async (id: string): Promise<AudioTrackRead> => {
  const response = await apiClient.get(`/sounds/${id}`);
  return response.data;
};

/**
 * Delete a sound
 * @param id The sound ID
 */
export const deleteSound = async (id: string): Promise<void> => {
  await apiClient.delete(`/sounds/${id}`);
};

/**
 * Download a file from cloud storage
 * @param storageKey The storage key of the file
 * @returns The file as a Blob
 */
export const downloadFile = async (storageKey: string): Promise<Blob> => {
  try {
    // Construct the public URL
    const baseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://fmpafpwdkegazcerrnso.supabase.co';
    const storageUrl = `${baseUrl}/storage/v1/object/public/tracks/${storageKey}`;
    
    // Fetch the file
    const response = await fetch(storageUrl, {
      mode: 'cors',
      credentials: 'same-origin'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    // Return as blob
    return await response.blob();
  } catch (error) {
    console.error('Error downloading file:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
};