import { apiClient } from './client';

export interface Track {
  id: string;
  name: string;
  type: string;
  volume: number;
  pan: number;
  mute: boolean;
  color?: string;
  duration?: number;
  y_position?: number;
  storage_key?: string;
  left_trim_ms?: number;
  track_number?: number;
  right_trim_ms?: number;
}

export interface AudioTrack extends Track {
  type: 'audio';
  duration: number;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  bpm: number;
  time_signature_numerator: number;
  time_signature_denominator: number;
  key_signature: string;
  tracks: Track[];
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateDto {
  name: string;
  bpm?: number;
  time_signature_numerator: number;
  time_signature_denominator: number;
  key_signature: string;
}

export interface ProjectUpdateDto {
  name?: string;
  bpm?: number;
  time_signature_numerator: number;
  time_signature_denominator: number;
  key_signature: string;
  tracks?: Track[];
}

export const getProjects = async (): Promise<Project[]> => {
  const response = await apiClient.get('/projects');
  return response.data;
};

export const getProject = async (id: string): Promise<Project> => {
  const response = await apiClient.get(`/projects/${id}`);
  return response.data;
};

export const createProject = async (project: ProjectCreateDto): Promise<Project> => {
  const response = await apiClient.post('/projects', project);
  return response.data;
};

export const updateProject = async (id: string, updates: ProjectUpdateDto): Promise<Project> => {
  const response = await apiClient.patch(`/projects/${id}`, updates);
  return response.data;
};

export const deleteProject = async (id: string): Promise<void> => {
  await apiClient.delete(`/projects/${id}`);
};

export const addTrack = async (projectId: string, track: Omit<Track, 'id'>): Promise<Project> => {
  const response = await apiClient.post(`/projects/${projectId}/tracks`, track);
  return response.data;
};

export const updateTrack = async (projectId: string, trackId: string, track: Partial<Track>): Promise<Project> => {
  const response = await apiClient.patch(`/projects/${projectId}/tracks/${trackId}`, track);
  return response.data;
};

export const deleteTrack = async (projectId: string, trackId: string): Promise<Project> => {
  const response = await apiClient.delete(`/projects/${projectId}/tracks/${trackId}`);
  return response.data;
};

/**
 * Interface for audio track data within a project
 */
export interface AudioTrackData {
  id?: string;                   // Optional track ID (will be generated if not provided)
  file: File;                    // The audio file to upload
  storage_key?: string;          // Will be populated after upload
  y_position: number;            // Vertical position in the track layout
  track_number: number;          // Track order number
  left_trim_ms: number;          // Left trim in milliseconds (0 for now)
  right_trim_ms: number;         // Right trim in milliseconds (0 for now)
  duration?: number;             // Duration in seconds (populated after processing)
  volume: number;                // Volume level 0-100
  pan: number;                   // Pan level -100 to 100
  is_muted: boolean;             // Whether track is muted
  name?: string;                 // Track name (default: file name)
}

/**
 * Save a project with all its audio tracks
 * This handles uploading sounds and creating the project structure
 */
export const saveProjectWithSounds = async (
  projectId: string, 
  projectData: ProjectUpdateDto,
  audioTracks: AudioTrackData[]
): Promise<Project> => {
  // Import the necessary utilities
  const { processAudioFile, uploadFileWithProgress } = await import('../utils/audioProcessing');
  const { getUploadUrl, createSoundRecord } = await import('./sounds');
  
  // 1. Upload all sounds in parallel
  const uploadPromises = audioTracks.map(async (track) => {
    try {
      // Get upload URL using the track's ID
      const { id, upload_url, storage_key } = await getUploadUrl(track.file.name, track.id);
      
      // Upload the file
      await uploadFileWithProgress(track.file, upload_url, () => {});
      
      // Process the file to get metadata
      const metadata = await processAudioFile(track.file);
      
      // Create the sound record
      console.log(`Creating sound record for ${track.file.name}`);
      let soundRecord;
      try {
        soundRecord = await createSoundRecord({
          id,
          name: track.name || track.file.name.split('.')[0], // Use provided name or filename without extension
          file_format: metadata.format,
          duration: metadata.duration,
          file_size: track.file.size,
          sample_rate: metadata.sampleRate,
          waveform_data: metadata.waveform,
          storage_key
        });
        console.log(`Sound record created successfully: ${JSON.stringify({
          id: soundRecord.id,
          name: soundRecord.name,
          storage_key: soundRecord.storage_key
        })}`);
      } catch (recordError) {
        console.error(`Failed to create sound record: ${recordError.message}`);
        if (recordError.response) {
          console.error('Error response:', recordError.response.status, recordError.response.data);
        }
        throw new Error(`Sound upload succeeded but record creation failed: ${recordError.message}`);
      }
      
      // Return updated track with storage info
      return {
        ...track,
        // Note: id is already set on the track from when we generated it
        storage_key,
        duration: metadata.duration,
        name: soundRecord ? soundRecord.name : track.name || track.file.name.split('.')[0]
      };
    } catch (error) {
      console.error('Failed to upload sound:', error);
      throw new Error(`Failed to upload sound: ${track.file.name}`);
    }
  });
  
  // Wait for all uploads to complete
  const processedTracks = await Promise.all(uploadPromises);
  
  // 2. Create track objects for the project structure
  const tracks = processedTracks.map(track => ({
    id: track.id, // Use the same ID that was generated and used for upload
    name: track.name,
    type: 'audio',
    volume: track.volume, // Keep original values
    pan: track.pan,       // Keep original values
    mute: track.is_muted,
    duration: track.duration,
    storage_key: track.storage_key,
    y_position: track.y_position,
    track_number: track.track_number,
    left_trim_ms: track.left_trim_ms,
    right_trim_ms: track.right_trim_ms
  }));
  
  // 3. Update the project with new tracks using the standard update endpoint
  const response = await apiClient.patch(`/projects/${projectId}`, {
    ...projectData,
    tracks
  });
  
  return response.data;
};