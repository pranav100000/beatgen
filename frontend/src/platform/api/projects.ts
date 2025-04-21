import { uploadFileWithProgress } from '../../studio/utils/audioProcessing';
import { processAudioFile } from '../../studio/utils/audioProcessing';
import { apiClient } from './client';
import { createMidiFileRecord, createSamplerTrackRecord } from './sounds';
import { 
  Project as ApiProject, 
  ProjectCreate, 
  ProjectRead, 
  ProjectUpdate, 
  ProjectWithTracks, 
  CombinedTrack 
} from '../types/project';

// UI-specific extensions of the API types
export interface UITrack extends CombinedTrack {
  color?: string;
}

export type TrackState = UITrack;

// For backward compatibility
export interface ProjectCreateDto extends ProjectCreate {
}

export interface ProjectUpdateDto extends ProjectUpdate {
  tracks?: CombinedTrack[]; // Use our API-generated type
}

// Alias the Project type for backward compatibility
export type Project = ProjectWithTracks;

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

export const addTrack = async (projectId: string, track: Omit<CombinedTrack, 'id'>): Promise<Project> => {
  const response = await apiClient.post(`/projects/${projectId}/tracks`, track);
  return response.data;
};

export const updateTrack = async (projectId: string, trackId: string, track: Partial<CombinedTrack>): Promise<Project> => {
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
  x_position: number;            // Horizontal position (time) in the track layout
  y_position: number;            // Vertical position in the track layout
  trim_start_ticks: number;      // Left trim in ticks
  trim_end_ticks: number;        // Right trim in ticks
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
  midi_notes_json: Record<string, any>; // MIDI notes JSON - required
}

/**
 * Interface for Sampler track data within a project
 */
export interface SamplerTrackData {
  id: string;                    // Track ID
  audioFile: File;               // The audio file to use as the sample source
  audio_storage_key?: string;    // Storage key for audio sample
  audio_file_name?: string;      // Name of the audio file
  audio_file_duration?: number;  // Duration of the audio file
  audio_file_sample_rate?: number; // Sample rate of the audio file
  audio_file_format?: string;    // Format of the audio file
  audio_file_size?: number;      // Size of the audio file
  x_position: number;            // Horizontal position
  y_position: number;            // Vertical position
  trim_start_ticks: number;      // Left trim
  trim_end_ticks: number;        // Right trim
  volume: number;                // Volume level
  pan: number;                   // Pan level
  is_muted: boolean;             // Muted state
  name: string;                  // Track name
  baseMidiNote?: number;         // Base MIDI note (default: 60/C4)
  grainSize?: number;            // Granular synthesis grain size
  overlap?: number;              // Granular synthesis overlap
  midi_notes_json: Record<string, any>; // MIDI notes JSON - required
}

/**
 * Save a project with all its audio and MIDI tracks
 * This handles uploading files and creating the project structure
 */
export const saveProjectWithSounds = async (
  projectId: string, 
  projectData: ProjectUpdateDto,
  audioTracks: AudioTrackData[] = [],
  midiTracks: MidiTrackData[] = [],
  samplerTracks: SamplerTrackData[] = []
): Promise<Project> => {
  // Import the necessary utilities
  //const { processAudioFile, uploadFileWithProgress } = await import('../studio/utils/audioProcessing');
  // const { processAudioFile, uploadFileWithProgress } = await import('../../studio/utils/audioProcessing');
  const { getUploadUrl, createSoundRecord, createMidiFileRecord, createSamplerTrackRecord } = await import('./sounds');
  
  // 1. Upload all audio tracks in parallel
  const audioUploadPromises = audioTracks.map(async (track) => {
    try {
      // Get upload URL using the track's ID
      const { id, upload_url, storage_key } = await getUploadUrl(track.file.name, track.id, 'audio', true);

      if (!upload_url) {
        console.log("Audio track already exists, skipping upload");
        return
      }
      // Convert Bl
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
          audio_file_format: metadata.format,
          audio_file_duration: metadata.duration,
          audio_file_size: track.file.size,
          audio_file_sample_rate: metadata.sampleRate,
          audio_file_storage_key: storage_key,
          type: 'audio' // Changed from 'AUDIO' to lowercase 'audio'
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
  
  // 2. Process all MIDI tracks with direct JSON notes
  const midiUploadPromises = midiTracks.map(async (track) => {
    try {
      console.log(`Processing MIDI track: ${track.name} (${track.id})`);
      
      // Check if we have notes JSON
      if (!track.midi_notes_json) {
        throw new Error(`No MIDI notes JSON provided for track ${track.id} - notes are required`);
      }
      
      // Create MIDI track record in the database - focused only on the notes JSON
      try {
        const midiRecord = await createMidiFileRecord({
          type: 'midi',
          id: track.id,
          name: track.name,
          instrument_id: track.instrument_id,
          midi_notes_json: track.midi_notes_json
        });
        
        const noteCount = track.midi_notes_json.notes?.length || 
                         (Array.isArray(track.midi_notes_json) ? track.midi_notes_json.length : 0);
        
        console.log(`MIDI track record created successfully with ${noteCount} notes.`);
      } catch (recordError) {
        console.error(`Failed to create MIDI record: ${recordError.message}`);
        if (recordError.response) {
          console.error('Error response:', recordError.response.status, recordError.response.data);
        }
        throw new Error(`MIDI record creation failed: ${recordError.message}`);
      }
      
      // Return updated track - no storage_key needed as we're not using files
      return {
        ...track
      };
    } catch (error) {
      console.error('Failed to process MIDI track:', error);
      throw new Error(`Failed to process MIDI track: ${error.message}`);
    }
  });
  
  // 2b. Upload all sampler tracks in parallel
  const samplerUploadPromises = samplerTracks.map(async (track) => {
    try {
      // Upload the audio file first
      const audioFileName = track.audioFile.name;
      const audioId = crypto.randomUUID();
      // Get upload URL for the audio file
      const { id: audio_id, upload_url: audioUploadUrl, storage_key: audioStorageKey } = 
        await getUploadUrl(audioFileName, audioId, 'audio', true);
      
      // Upload the audio file
      await uploadFileWithProgress(track.audioFile, audioUploadUrl, () => {});
      
      // Process the audio file to get metadata
      const audioMetadata = await processAudioFile(track.audioFile);
      
      
      // Now create a single record that includes all necessary data
      try {
        const samplerRecord = await createSamplerTrackRecord({
          type: 'sampler',
          id: track.id,
          name: track.name,
          audio_storage_key: audioStorageKey,
          audio_file_format: audioMetadata.format,
          audio_file_size: track.audioFile.size,
          base_midi_note: track.baseMidiNote || 60,
          grain_size: track.grainSize || 0.1,
          overlap: track.overlap || 0.1,
          audio_file_name: audioFileName,
          audio_file_duration: audioMetadata.duration,
          audio_file_sample_rate: audioMetadata.sampleRate,
          midi_notes_json: track.midi_notes_json
        });
        console.log(`Sampler track record created successfully: ${track.id}`, samplerRecord);
      } catch (samplerRecordError) {
        console.error(`Failed to create sampler track record: ${samplerRecordError.message}`);
        if (samplerRecordError.response) {
          console.error('Error response:', samplerRecordError.response.status, samplerRecordError.response.data);
        }
        throw new Error(`File uploads succeeded but sampler track creation failed: ${samplerRecordError.message}`);
      }
      
      // Return the updated track with storage info for both files
      return {
        ...track,
        audio_storage_key: audioStorageKey,
        audio_file_duration: audioMetadata.duration,
        audio_file_sample_rate: audioMetadata.sampleRate
      };
    } catch (error) {
      console.error(`Failed to upload sampler track files: ${error.message}`);
      throw new Error(`Failed to upload sampler track files: ${error.message}`);
    }
  });

  // Wait for all uploads to complete
  const [processedAudioTracks, processedMidiTracks, processedSamplerTracks] = await Promise.all([
    Promise.all(audioUploadPromises),
    Promise.all(midiUploadPromises),
    Promise.all(samplerUploadPromises)
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
    x_position: track.x_position,
    y_position: track.y_position,
    trim_start_ticks: track.trim_start_ticks,
    trim_end_ticks: track.trim_end_ticks,
    // Add instrument information
    instrument_id: track.instrument_id,
    instrument_name: track.instrument_name,
    instrument_storage_key: track.instrument_storage_key,
    midi_notes_json: track.midi_notes_json
  }));
  
  const samplerTrackObjects = processedSamplerTracks.map(track => ({
    id: track.id,
    name: track.name,
    type: 'sampler',
    volume: track.volume,
    pan: track.pan,
    mute: track.is_muted,
    audio_file_storage_key: track.audio_storage_key,
    audio_file_format: track.audio_file_format,
    audio_file_size: track.audio_file_size,
    audio_file_duration: track.audio_file_duration,
    audio_file_sample_rate: track.audio_file_sample_rate,
    x_position: track.x_position,
    y_position: track.y_position,
    trim_start_ticks: track.trim_start_ticks,
    trim_end_ticks: track.trim_end_ticks,
    // Sampler-specific properties
    base_midi_note: track.baseMidiNote || 60,
    grain_size: track.grainSize || 0.1,
    overlap: track.overlap || 0.1,
    midi_notes_json: track.midi_notes_json
  }));
  
  // Debug MIDI track objects before combining
  console.log('DEBUG: MIDI track objects before combining:', midiTrackObjects.map(t => ({
    id: t.id,
    instrument_id: t.instrument_id,
    instrument_name: t.instrument_name,
    instrument_storage_key: t.instrument_storage_key
  })));
  
  // Combine all tracks
  const allTracks = [...audioTrackObjects, ...midiTrackObjects, ...samplerTrackObjects];

  console.log('+++++++++++All tracks:', allTracks);
  
  // 4. Update the project with all tracks
  const response = await apiClient.patch(`/projects/${projectId}`, {
    ...projectData,
    tracks: allTracks
  });
  
  return response.data;
};