import { apiClient } from './client';

export interface Soundfont {
  id: string;
  name: string;
  display_name: string;
  category: string;
  description?: string;
  storage_key: string;
}

/**
 * Get all public soundfonts, optionally filtered by category
 * @param category Optional category filter
 * @returns Array of soundfonts
 */
export const getPublicSoundfonts = async (category?: string): Promise<Soundfont[]> => {
  const params = category ? { category } : {};
  const response = await apiClient.get('/soundfonts/public', { params });
  return response.data;
};

/**
 * Get a specific public soundfont by ID
 * @param id The soundfont ID
 * @returns The soundfont object
 */
export const getPublicSoundfont = async (id: string): Promise<Soundfont> => {
  const response = await apiClient.get(`/soundfonts/public/${id}`);
  return response.data;
};

/**
 * Download a soundfont file from storage
 * This constructs a public download URL for the provided storage key
 */
export const getSoundfontDownloadUrl = (storageKey: string, isPublic: boolean = true): string => {
  const baseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://dsscfzvrjlyfktnrpukj.supabase.co';
  const prefix = isPublic ? 'soundfonts_public' : 'soundfonts_private';
  return `${baseUrl}/storage/v1/object/public/assets/${prefix}/${storageKey}`;
};