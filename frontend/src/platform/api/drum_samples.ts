import { DrumSamplePublicRead } from '../types/public_models/drum_samples';
import { apiClient } from './client';

// export interface Soundfont {
//   id: string;
//   name: string;
//   display_name: string;
//   category: string;
//   description?: string;
//   storage_key: string;
// }

/**
 * Get all public drum samples.
 * @returns Array of drum samples.
 */
export const getPublicDrumSamples = async (): Promise<DrumSamplePublicRead[]> => {
  console.log('Getting public drum samples');
  const response = await apiClient.get('/drum-samples/public');
  return response.data;
};

/**
 * Get a specific public drum sample by ID.
 * @param id The drum sample ID.
 * @returns The drum sample object.
 */
export const getPublicDrumSample = async (id: string): Promise<DrumSamplePublicRead> => {
  const response = await apiClient.get(`/drum-samples/${id}`);
  return response.data;
};

/**
 * Get the public download URL for a drum sample file from storage.
 * Constructs a public download URL for the provided storage key.
 */
export const getDrumSampleDownloadUrl = (storageKey: string): string => {
  // Ensure the environment variable is correctly accessed or provide a default
  // @ts-ignore Linter error about 'process', assuming build tool (e.g., CRA) handles this
  const baseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://fmpafpwdkegazcerrnso.supabase.co';
  // Updated path prefix for public drum samples
  const prefix = 'drum_samples_public';
  return `${baseUrl}/storage/v1/object/public/assets/${prefix}/${storageKey}`;
};