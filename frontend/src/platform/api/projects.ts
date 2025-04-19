import { uploadFileWithProgress } from '../../studio/utils/audioProcessing';
import { processAudioFile } from '../../studio/utils/audioProcessing';
import { apiClient } from './client';

type TrackState = AudioTrackState | MidiTrackState;
export interface BaseTrackState {
  id: string;
  name: string;
  type: string;
  volume: number;
  pan: number;
  mute: boolean;
  color?: string;
  duration?: number;
  x_position?: number;
  y_position?: number;
  storage_key?: string;
  trim_start_ticks?: number;
  trim_end_ticks?: number;
  track_number?: number;
  instrument_id?: string;
  instrument_name?: string;
  instrument_storage_key?: string;
}

export interface AudioTrackState extends BaseTrackState {
  type: 'audio';
  duration: number;
}

export interface MidiTrackState extends BaseTrackState {
  type: 'midi';
  instrumentId: string;
  instrumentName: string;
  instrumentStorageKey: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  bpm: number;
  time_signature_numerator: number;
  time_signature_denominator: number;
  key_signature: string;
  tracks: TrackState[];
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
  tracks?: TrackState[];
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

export const addTrack = async (projectId: string, track: Omit<TrackState, 'id'>): Promise<Project> => {
  const response = await apiClient.post(`/projects/${projectId}/tracks`, track);
  return response.data;
};

export const updateTrack = async (projectId: string, trackId: string, track: Partial<TrackState>): Promise<Project> => {
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
  x_position: number;            // Horizontal position (time) in the track layout
  y_position: number;            // Vertical position in the track layout
  trim_start_ticks: number;       // Left trim in ticks (0 for now)
  trim_end_ticks: number;      // Right trim in ticks (0 for now)
  track_number: number;          // Track order number        // Right trim in milliseconds (0 for now)
  duration?: number;             // Duration in seconds (populated after processing)
  volume: number;                // Volume level 0-100
  pan: number;                   // Pan level -100 to 100
  is_muted: boolean;             // Whether track is muted
  name?: string;                 // Track name (default: file name)
}

/**
 * Interface for MIDI track data within a project
 */
export interface MidiTrackData {
  id: string;                    // Track ID
  file: Blob;                    // The MIDI file to upload
  storage_key?: string;          // Will be populated after upload
  x_position: number;            // Horizontal position (time) in the track layout
  y_position: number;            // Vertical position in the track layout
  trim_start_ticks: number;       // Left trim in ticks (0 for now)
  trim_end_ticks: number;      // Right trim in ticks (0 for now)
  volume: number;                // Volume level 0-1
  pan: number;                   // Pan level -1 to 1
  is_muted: boolean;             // Whether track is muted
  name: string;                  // Track name
  bpm: number;                   // Track BPM
  time_signature: [number, number]; // Track time signature
  // Using same naming convention as the API expects
  instrument_id?: string;         // ID of the associated instrument/soundfont
  instrument_name?: string;       // Display name of the instrument
  instrument_storage_key?: string; // Storage key for the instrument
}

/**
 * Save a project with all its audio and MIDI tracks
 * This handles uploading files and creating the project structure
 */
export const saveProjectWithSounds = async (
  projectId: string, 
  projectData: ProjectUpdateDto,
  audioTracks: AudioTrackData[] = [],
  midiTracks: MidiTrackData[] = []
): Promise<Project> => {
  // Import the necessary utilities
  //const { processAudioFile, uploadFileWithProgress } = await import('../studio/utils/audioProcessing');
  // const { processAudioFile, uploadFileWithProgress } = await import('../../studio/utils/audioProcessing');
  const { getUploadUrl, createSoundRecord } = await import('./sounds');
  
  // 1. Upload all audio tracks in parallel
  const audioUploadPromises = audioTracks.map(async (track) => {
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
          audio_file_id: id,
          name: track.name || track.file.name.split('.')[0], // Use provided name or filename without extension
          file_format: metadata.format,
          duration: metadata.duration,
          file_size: track.file.size,
          sample_rate: metadata.sampleRate,
          waveform_data: metadata.waveform,
          storage_key,
          type: 'AUDIO'
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
  
  // 2. Upload all MIDI tracks in parallel
  const midiUploadPromises = midiTracks.map(async (track) => {
    try {
      // Determine file name
      const fileName = `${track.name.replace(/\s+/g, '_')}.mid`;
      
      // Get upload URL with a midi/ prefix in the storage path using the enhanced getUploadUrl function
      // Set shouldOverwrite to true to handle the case of updating an existing MIDI file
      const { id, upload_url, storage_key } = await getUploadUrl(fileName, track.id, 'midi', true);
      
      // Convert Blob to File if needed
      const midiFile = track.file instanceof File 
        ? track.file 
        : new File([track.file], fileName, { type: 'audio/midi' });
      
      // Upload the file
      await uploadFileWithProgress(midiFile, upload_url, () => {});
      
      console.log(`MIDI file ${fileName} uploaded successfully to ${storage_key}`);
      
      // Return updated track with storage info
      return {
        ...track,
        storage_key
      };
    } catch (error) {
      console.error('Failed to upload MIDI file:', error);
      throw new Error(`Failed to upload MIDI file: ${error.message}`);
    }
  });
  
  // Wait for all uploads to complete
  const [processedAudioTracks, processedMidiTracks] = await Promise.all([
    Promise.all(audioUploadPromises),
    Promise.all(midiUploadPromises)
  ]);
  
  // 3. Create combined track objects for the project structure
  const audioTrackObjects = processedAudioTracks.map(track => ({
    id: track.id,
    name: track.name,
    type: 'audio',
    volume: track.volume,
    pan: track.pan,
    mute: track.is_muted,
    duration: track.duration,
    storage_key: track.storage_key,
    x_position: track.x_position,
    y_position: track.y_position,
    track_number: track.track_number,
    trim_start_ticks: track.trim_start_ticks,
    trim_end_ticks: track.trim_end_ticks
  }));
  
  const midiTrackObjects = processedMidiTracks.map(track => ({
    id: track.id,
    name: track.name,
    type: 'midi',
    volume: track.volume,
    pan: track.pan,
    mute: track.is_muted,
    storage_key: track.storage_key,
    x_position: track.x_position,
    y_position: track.y_position,
    trim_start_ticks: track.trim_start_ticks,
    trim_end_ticks: track.trim_end_ticks,
    // Add instrument information
    instrument_id: track.instrument_id,
    instrument_name: track.instrument_name,
    instrument_storage_key: track.instrument_storage_key
  }));
  
  // Debug MIDI track objects before combining
  console.log('DEBUG: MIDI track objects before combining:', midiTrackObjects.map(t => ({
    id: t.id,
    instrument_id: t.instrument_id,
    instrument_name: t.instrument_name,
    instrument_storage_key: t.instrument_storage_key
  })));
  
  // Combine all tracks
  const allTracks = [...audioTrackObjects, ...midiTrackObjects];

  console.log('+++++++++++All tracks:', allTracks);
  
  // 4. Update the project with all tracks
  const response = await apiClient.patch(`/projects/${projectId}`, {
    ...projectData,
    tracks: allTracks
  });
  
  return response.data;
};