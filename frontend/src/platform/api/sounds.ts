import { apiClient } from './client';
import { AudioTrackRead, DrumTrackRead, MidiTrackRead, SamplerTrackRead } from '../types/project';
//import { SamplerTrack } from 'src/types/track';
import { AudioTrackCreate } from '../types/track_models/audio_track';
import { MidiTrackCreate } from '../types/track_models/midi_track';
import { SamplerTrackCreate } from '../types/track_models/sampler_track';
import { DrumTrackCreate } from '../types/track_models/drum_track';

// Keep using the Sound interface from studio for now until we can fully migrate

export interface UploadUrlResponse {
  id: string;
  upload_url: string;
  storage_key: string;
}
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
 * Create a drum track record
 * @param drumData The drum track data
 * @returns The created drum track object
 */
export const createDrumTrackRecord = async (drumData: DrumTrackCreate): Promise<DrumTrackRead> => {
  console.log('Creating drum track record with data:', drumData);
  
  try {
    // Transform the data to match backend expectations
    const transformedData = {
      ...drumData,
    };
    
    console.log('Transformed drum track data:', transformedData);
    
    const response = await apiClient.post('/sounds/drum', transformedData);
    console.log('Drum track record created successfully:', response.data);
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
 * Get all audio tracks for the current user
 * @returns Array of audio tracks
 */
export const getSounds = async (): Promise<AudioTrackRead[]> => {
  const response = await apiClient.get('/sounds/audio');
  return response.data;
};

/**
 * Get all MIDI tracks for the current user
 * @returns Array of MIDI tracks
 */
export const getMidiTracks = async (): Promise<MidiTrackRead[]> => {
  const response = await apiClient.get('/sounds/midi');
  return response.data;
};

/**
 * Get all sampler tracks for the current user
 * @returns Array of sampler tracks
 */
export const getSamplerTracks = async (): Promise<SamplerTrackRead[]> => {
  const response = await apiClient.get('/sounds/sampler');
  return response.data;
};

/**
 * Get all drum tracks for the current user
 * @returns Array of drum tracks
 */
export const getDrumTracks = async (): Promise<DrumTrackRead[]> => {
  const response = await apiClient.get('/sounds/drum');
  return response.data;
};

/**
 * Get a specific sound by ID
 * @param id The sound ID
 * @returns The sound object
 */
export const getSound = async (id: string): Promise<AudioTrackRead> => {
  const response = await apiClient.get(`/sounds/audio/${id}`);
  return response.data;
};

/**
 * Get a specific MIDI track by ID
 * @param id The MIDI track ID
 * @returns The MIDI track object
 */
export const getMidiTrack = async (id: string): Promise<MidiTrackRead> => {
  const response = await apiClient.get(`/sounds/midi/${id}`);
  return response.data;
};

/**
 * Get a specific sampler track by ID
 * @param id The sampler track ID
 * @returns The sampler track object
 */
export const getSamplerTrack = async (id: string): Promise<SamplerTrackRead> => {
  const response = await apiClient.get(`/sounds/sampler/${id}`);
  return response.data;
};

/**
 * Get a specific drum track by ID
 * @param id The drum track ID
 * @returns The drum track object
 */
export const getDrumTrack = async (id: string): Promise<DrumTrackRead> => {
  const response = await apiClient.get(`/sounds/drum/${id}`);
  return response.data;
};

/**
 * Delete an audio track
 * @param id The audio track ID
 */
export const deleteSound = async (id: string): Promise<void> => {
  await apiClient.delete(`/sounds/audio/${id}`);
};

/**
 * Delete a MIDI track
 * @param id The MIDI track ID
 */
export const deleteMidiTrack = async (id: string): Promise<void> => {
  await apiClient.delete(`/sounds/midi/${id}`);
};

/**
 * Delete a sampler track
 * @param id The sampler track ID
 */
export const deleteSamplerTrack = async (id: string): Promise<void> => {
  await apiClient.delete(`/sounds/sampler/${id}`);
};

/**
 * Delete a drum track
 * @param id The drum track ID
 */
export const deleteDrumTrack = async (id: string): Promise<void> => {
  await apiClient.delete(`/sounds/drum/${id}`);
};

/**
 * Private helper function to download a file from cloud storage.
 * @param prefix The storage path prefix (e.g., 'storage/v1/object/public/tracks')
 * @param storageKey The storage key of the file
 * @returns The file as a Blob
 */
const downloadFile = async (prefix: string, storageKey: string): Promise<Blob> => {
  const baseUrlString = process.env.REACT_APP_SUPABASE_URL || 'https://fmpafpwdkegazcerrnso.supabase.co';

  // Construct the full URL path
  const storageUrl = new URL(`/${prefix}/${storageKey}`, baseUrlString).toString();

  try {
    // Fetch the file using the constructed URL
    const response = await fetch(storageUrl, {
      mode: 'cors', // Ensure CORS is handled correctly if accessing from a different origin
    });

    if (!response.ok) {
      // Throw a more informative error if the fetch fails
      throw new Error(`HTTP error ${response.status}: ${response.statusText} for URL ${storageUrl}`);
    }

    // Return the file content as a Blob
    return await response.blob();
  } catch (error) {
    // Log the error and re-throw a more specific error message
    console.error(`Error downloading file from ${storageUrl}:`, error);
    throw new Error(`Failed to download file (${storageKey}): ${error.message}`);
  }
};

/**
 * Download an audio track file from cloud storage
 * @param storageKey The storage key of the file
 * @returns The file as a Blob
 */
export const downloadAudioTrackFile = async (storageKey: string): Promise<Blob> => {
  // Define the specific prefix for audio tracks
  const prefix = 'storage/v1/object/public/tracks'; 
  try {
    console.log(`Attempting to download audio track file (storageKey ${storageKey}) from tracks prefix.`);
    return await downloadFile(prefix, storageKey);
  } catch (error) {
    console.warn(`Failed to download audio track file from tracks prefix (storageKey ${storageKey}). Falling back to drum samples.`);
    try {
      console.log(`Attempting to download drum sample file (storageKey ${storageKey}) as fallback.`);
      return await downloadDrumSampleFile(storageKey);
    } catch (fallbackError) {
      console.error(`Error downloading file after fallback to drum samples (storageKey ${storageKey}): ${fallbackError}`);
      // Re-throw the original error or the fallback error, depending on desired behavior.
      // Throwing the fallback error might be more informative here.
      throw fallbackError; 
    }
  }
};

export const downloadDrumSampleFile = async (storageKey: string): Promise<Blob> => {
  const prefix = 'storage/v1/object/public/assets/drum_samples_public';
  return await downloadFile(prefix, storageKey);
};
