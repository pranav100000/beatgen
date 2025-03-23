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
 * Get a presigned URL for uploading an audio file
 * @param fileName The name of the file to upload
 * @param id The ID to use for the sound (UUID)
 * @returns Object containing upload URL, ID, and storage key
 */
export const getUploadUrl = async (fileName: string, id: string): Promise<UploadUrlResponse> => {
  const response = await apiClient.post('/sounds/upload-url', { 
    file_name: fileName,
    id: id // Always pass the ID
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