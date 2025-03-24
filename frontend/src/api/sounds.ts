import { apiClient } from './client';
import { Sound } from '../types/sound';

export interface UploadUrlResponse {
  id: string;
  upload_url: string;
  storage_key: string;
}

export interface SoundCreateRequest {
  id: string;
  name: string;
  file_format: string;
  duration: number;
  file_size: number;
  sample_rate: number;
  waveform_data: number[];
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
  fileType: 'audio' | 'midi' = 'audio',
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
export const createSoundRecord = async (soundData: SoundCreateRequest): Promise<Sound> => {
  console.log('Creating sound record with data:', {
    ...soundData,
    waveform_data: soundData.waveform_data ? `[${soundData.waveform_data.length} points]` : 'none'
  });
  
  try {
    const response = await apiClient.post('/sounds', soundData);
    console.log('Sound record created successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating sound record:', error);
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
export const getSounds = async (): Promise<Sound[]> => {
  const response = await apiClient.get('/sounds');
  return response.data;
};

/**
 * Get a specific sound by ID
 * @param id The sound ID
 * @returns The sound object
 */
export const getSound = async (id: string): Promise<Sound> => {
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
    const baseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://dsscfzvrjlyfktnrpukj.supabase.co';
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

// Function to maintain compatibility with existing code until fully refactored
export const downloadMidiFile = downloadFile;