/**
 * Project sound management utilities
 */
import { processAudioFile, uploadFileWithProgress } from './audioProcessing';
import { getUploadUrl, createSoundRecord } from '../api/sounds';
import { Project, ProjectUpdateDto } from '../api/projects';
import { apiClient } from '../api/client';

/**
 * Interface for sound files that need to be uploaded as part of a project
 */
export interface ProjectSound {
  file: File;
  y_position: number;
  track_number: number;
  volume_level?: number; // 0-100 default
  pan_level?: number;    // -100 to 100 default
  is_muted?: boolean;    // default false
}

/**
 * Result of a sound upload operation for a project
 */
export interface UploadedProjectSound {
  sound_id: string;
  storage_key: string;
  name: string;
  duration: number;
  y_position: number;
  track_number: number;
  left_trim_ms: number;
  right_trim_ms: number;
  volume_level: number;
  pan_level: number;
  is_muted: boolean;
}

/**
 * Upload a single sound file for a project
 */
export async function uploadProjectSound(sound: ProjectSound): Promise<UploadedProjectSound> {
  try {
    // Apply defaults
    const volumeLevel = sound.volume_level ?? 100;
    const panLevel = sound.pan_level ?? 0;
    const isMuted = sound.is_muted ?? false;
    
    // Generate UUID and get upload URL
    const trackId = crypto.randomUUID();
    const { id, upload_url, storage_key } = await getUploadUrl(sound.file.name, trackId);
    
    // Upload the file
    await uploadFileWithProgress(sound.file, upload_url, () => {});
    
    // Process the file to get metadata
    const metadata = await processAudioFile(sound.file);
    
    // Create the sound record
    const soundRecord = await createSoundRecord({
      id,
      name: sound.file.name.split('.')[0], // Use filename without extension
      file_format: metadata.format,
      duration: metadata.duration,
      file_size: sound.file.size,
      sample_rate: metadata.sampleRate,
      waveform_data: metadata.waveform,
      storage_key
    });
    
    // Return the data needed for the track
    return {
      sound_id: id,
      storage_key,
      name: soundRecord.name,
      duration: soundRecord.duration,
      y_position: sound.y_position,
      track_number: sound.track_number,
      left_trim_ms: 0,  // Default for now
      right_trim_ms: 0, // Default for now
      volume_level: volumeLevel,
      pan_level: panLevel,
      is_muted: isMuted
    };
  } catch (error) {
    console.error('Failed to upload sound:', error);
    throw new Error(`Failed to upload sound: ${sound.file.name}`);
  }
}

/**
 * Upload multiple sounds in parallel
 */
export async function uploadProjectSounds(sounds: ProjectSound[]): Promise<UploadedProjectSound[]> {
  // Create upload promises for all sounds
  const uploadPromises = sounds.map(sound => uploadProjectSound(sound));
  
  // Wait for all uploads to complete
  return Promise.all(uploadPromises);
}

/**
 * Save a project with audio tracks
 */
export async function saveProjectWithSounds(
  projectId: string, 
  projectData: ProjectUpdateDto,
  sounds: ProjectSound[]
): Promise<Project> {
  // 1. Upload all sounds in parallel
  const uploadedSounds = await uploadProjectSounds(sounds);
  
  // 2. Create track objects from uploaded sounds
  const tracks = uploadedSounds.map(sound => ({
    name: sound.name,
    type: 'audio',
    volume: sound.volume_level / 100, // normalize to 0-1 range
    pan: sound.pan_level / 100,       // normalize to -1 to 1 range
    solo: false,
    mute: sound.is_muted,
    content: {
      storage_key: sound.storage_key,
      sound_id: sound.sound_id,
      y_position: sound.y_position,
      track_number: sound.track_number,
      left_trim_ms: sound.left_trim_ms,
      right_trim_ms: sound.right_trim_ms,
      duration: sound.duration
    }
  }));
  
  // 3. Update the project with new tracks using the standard update endpoint
  const response = await apiClient.patch(`/projects/${projectId}`, {
    ...projectData,
    tracks
  });
  
  return response.data;
}