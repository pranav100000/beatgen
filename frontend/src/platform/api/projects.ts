import { uploadFileWithProgress } from '../../studio/utils/audioProcessing';
import { processAudioFile } from '../../studio/utils/audioProcessing';
import { apiClient } from './client';
import { createMidiFileRecord, createSamplerTrackRecord, createSoundRecord, getUploadUrl } from './sounds';
import { 
  Project as ApiProject, 
  ProjectCreate, 
  ProjectRead, 
  ProjectUpdate, 
  ProjectWithTracks, 
  CombinedTrack 
} from '../types/project';
import { Project } from '../../platform/types/project';
import { AudioTrack, AudioTrackRead } from '../types/track_models/audio_track';
import { SamplerTrack } from '../types/track_models/sampler_track';
import { MidiTrack } from '../types/track_models/midi_track';
import { db } from '../../studio/core/db/dexie-client';

export const getProjects = async (): Promise<Project[]> => {
  const response = await apiClient.get('/projects');
  return response.data;
};

export const getProject = async (id: string): Promise<Project> => {
  const response = await apiClient.get(`/projects/${id}`);
  return response.data;
};

export const createProject = async (project: ProjectCreate): Promise<Project> => {
  const response = await apiClient.post('/projects', project);
  return response.data;
};

export const updateProject = async (id: string, updates: ProjectWithTracks): Promise<Project> => {
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
 * Save a project with all its audio and MIDI tracks
 * This handles uploading files and creating the project structure
 */

export const uploadAudioTrack = async (track: CombinedTrack): Promise<void> => {
  const audioTrack = track.track as AudioTrack;
  const { id, upload_url, storage_key } = await getUploadUrl("", track.id, 'audio', true);
  if (!upload_url) {
    console.log("Audio track already exists, skipping upload");
    return
  }
  const audioFile = await db.getAudioFile(audioTrack.id);
  if (!audioFile) {
    throw new Error(`Audio file not found for track ${audioTrack.id}`);
  }
  const file = new File([audioFile.data], audioTrack.name, {
    type: audioFile.data.type
  });
  
  await uploadFileWithProgress(file, upload_url, () => {});
  
  // Process the file to get metadata
  const metadata = await processAudioFile(file);

  const audioMetadata = track.track as AudioTrackRead;

  await createSoundRecord({
    id: audioTrack.id,
    name: track.name,
    audio_file_format: audioMetadata.audio_file_format,
    audio_file_duration: audioMetadata.audio_file_duration,
    audio_file_size: audioMetadata.audio_file_size,
    audio_file_sample_rate: audioMetadata.audio_file_sample_rate,
    audio_file_storage_key: storage_key,
  })
}

export const uploadMidiTrack = async (track: CombinedTrack): Promise<void> => {
  console.log("Uploading MIDI track:", track);
  const midiTrack = track.track as MidiTrack;
  await createMidiFileRecord({
    id: midiTrack.id,
    name: midiTrack.name,
    instrument_id: midiTrack.instrument_id,
    midi_notes_json: midiTrack.midi_notes_json
  })
}

export const uploadSamplerTrack = async (track: CombinedTrack): Promise<void> => {
  const samplerTrack = track.track as SamplerTrack;
  const { id, upload_url, storage_key } = await getUploadUrl("", track.id, 'audio', true);
  if (!upload_url) {
    console.log("Sampler audio track already exists, skipping upload");
    return
  }
  const audioFile = await db.getAudioFile(samplerTrack.id);
  if (!samplerTrack.audio_file_name) {
    samplerTrack.audio_file_name = samplerTrack.name;
  }
  if (!audioFile) {
    throw new Error(`Audio file not found for track ${samplerTrack.id}`);
  }
  const file = new File([audioFile.data], samplerTrack.name, {
    type: audioFile.data.type
  });
  
  await uploadFileWithProgress(file, upload_url, () => {});
  // Process the file to get metadata
  const metadata = await processAudioFile(file);
  await createSamplerTrackRecord({
    id: samplerTrack.id,
    name: samplerTrack.name,
    audio_storage_key: storage_key,
    audio_file_format: metadata.format,
    audio_file_size: file.size,
    base_midi_note: samplerTrack.base_midi_note || 60,
    grain_size: samplerTrack.grain_size || 0.1,
    overlap: 0,
    audio_file_name: samplerTrack.audio_file_name,
    audio_file_duration: metadata.duration,
    audio_file_sample_rate: metadata.sampleRate,
    midi_notes_json: samplerTrack.midi_notes_json
  })
}

export const saveProjectWithSounds = async (
  projectId: string, 
  projectData: ProjectUpdate,
  tracks: CombinedTrack[]
): Promise<Project> => {
  console.log("Saving project with sounds:", projectId, projectData, tracks);
  for (const track of tracks) {
    switch (track.type) {
      case 'audio':
        await uploadAudioTrack(track);
        break;
      case 'midi':
        await uploadMidiTrack(track);
        break;
      case 'sampler':
        await uploadSamplerTrack(track);
        break;
    }
  }
  
  // 4. Update the project with all tracks
  const response = await apiClient.patch(`/projects/${projectId}`, {
    ...projectData,
    tracks: tracks
  });
  
  return response.data;
};