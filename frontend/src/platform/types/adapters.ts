/**
 * Type adapters for converting between API and internal UI types
 * This file provides functions to convert between the API types (from backend)
 * and the internal UI types used in the application.
 */

import { 
  ProjectWithTracks,
  CombinedTrack,
  TrackType,
  ProjectUpdate,
  ProjectCreate,
  DrumTrackRead,
  ProjectRead,
  SamplerTrackRead,
  AudioTrackRead
} from './project';
import { Project as InternalProject, Track as InternalTrack } from '../../studio/core/state/project';
import { User } from './user';
import { AudioTrack, AudioTrackCreate } from './track_models/audio_track';
import { MidiTrack, MidiTrackCreate, MidiTrackRead } from './track_models/midi_track';
import { SamplerTrack, SamplerTrackCreate } from './track_models/sampler_track';
import { DrumTrack, DrumTrackCreate } from './track_models/drum_track';

/**
 * Converts an API project model to the internal project model
 */
export function apiProjectToInternal(project: ProjectWithTracks): Omit<ProjectWithTracks, 'user_id'> {
  return {
    id: project.id!,
    name: project.name,
    bpm: project.bpm,
    time_signature_numerator: project.time_signature_numerator,
    time_signature_denominator: project.time_signature_denominator,
    key_signature: project.key_signature,
    tracks: project.tracks?.map(apiTrackToInternal) || []
  };
}

/**
 * Converts an API track model to the internal track model
 */
export function apiTrackToInternal(track: CombinedTrack): InternalTrack {
  let instrumentId: string | undefined;
  let instrumentName: string | undefined;
  let instrumentStorageKey: string | undefined;
  let audioFileId: string | undefined;
  let midiFileId: string | undefined;

  if (track.type === 'midi') {
    const midiTrack = track.track as MidiTrackRead;
    instrumentId = midiTrack.instrument_id;
    instrumentName = midiTrack.instrument_file?.name;
    instrumentStorageKey = midiTrack.instrument_file?.storage_key;
  }
  
  
  return {
    id: track.id,
    name: track.name,
    type: track.type as 'audio' | 'midi' | 'drum' | 'sampler',
    volume: track.volume!,
    pan: track.pan!,
    muted: track.mute!,
    soloed: false, // API doesn't store solo state as it's a runtime concept
    instrumentId: instrumentId,
    instrumentName: instrumentName,
    instrumentStorageKey: instrumentStorageKey,
    audioFileId: audioFileId,
    trimStartTicks: track.trim_start_ticks,
    trimEndTicks: track.trim_end_ticks,
    durationTicks: track.duration_ticks,
    // Sampler-specific properties would be added here
  };
}

/**
 * Converts an internal project model to the API project model for updates
 */
export function internalProjectToApiUpdate(project: InternalProject): ProjectUpdate {
  return {
    name: project.name,
    bpm: project.tempo,
    time_signature_numerator: project.timeSignature[0],
    time_signature_denominator: project.timeSignature[1],
    key_signature: project.key,
  };
}

/**
 * Converts an internal track model to the API track model
 */
export function internalTrackToApiTrack(track: InternalTrack): CombinedTrack {
  let typedTrack: AudioTrackCreate | MidiTrackCreate | SamplerTrackCreate | DrumTrackCreate;

  if (track.type === 'midi') {
    typedTrack = {
      // Fields required by MidiTrackRead / MidiTrackBase / TrackBase / TimestampMixin
      id: track.id, 
      name: track.name,
      type: 'midi',
      instrument_id: track.instrumentId!, // Assuming instrumentId is always present for internal MIDI tracks
      midi_notes_json: {}, // Placeholder: InternalTrack doesn't store raw MIDI notes JSON
    } as MidiTrackCreate;
  } else if (track.type === 'audio') {
    typedTrack = {
    } as AudioTrackCreate; // Explicitly cast to AudioTrackRead
  } else if (track.type === 'sampler') {
      // Placeholder for SamplerTrackRead
      typedTrack = { id: track.id, name: track.name, type: 'sampler', /* ... other fields */ } as SamplerTrackCreate;
  } else if (track.type === 'drum') {
      // Placeholder for DrumTrackRead
      typedTrack = { id: track.id, name: track.name, type: 'drum', /* ... other fields */ } as DrumTrackCreate;
  } else {
    // Handle unsupported track types
    throw new Error(`Unsupported internal track type for API conversion: ${track.type}`);
  }

  // Return the CombinedTrack structure
  return {
    id: track.id,
    name: track.name,
    type: track.type as TrackType,
    volume: track.volume,
    pan: track.pan,
    mute: track.muted,
    trim_start_ticks: track.trimStartTicks,
    trim_end_ticks: track.trimEndTicks,
    duration_ticks: track.durationTicks,
    track: typedTrack // Include the nested type-specific track data
  };
}

/**
 * Converts an internal project model to the API project model for creation
 */
export function internalProjectToApiCreate(project: InternalProject): ProjectCreate {
  return {
    name: project.name,
    bpm: project.tempo,
    time_signature_numerator: project.timeSignature[0],
    time_signature_denominator: project.timeSignature[1],
    key_signature: project.key,
  };
}

// Define a more specific return type for adaptTrack if possible, or use a union
type SpecificTrackRead = MidiTrackRead | AudioTrackRead | SamplerTrackRead | DrumTrackRead;

export const adaptTrack = (track: any): SpecificTrackRead | undefined => {
  let typedTrack: SpecificTrackRead | undefined;

  // Basic track data (common to all types)
  const baseTrackData = {
    id: track.id,
    name: track.name,
    type: track.type,
    user_id: track.user_id,
    created_at: track.created_at,
    updated_at: track.updated_at,
  };

  if (track.type === 'midi') {
    typedTrack = {
      ...baseTrackData,
      instrument_id: track.instrument_id,
      midi_notes_json: track.midi_notes_json, // Make sure this is correctly typed/parsed if needed
      instrument_file: track.instrument_file, // Assuming instrument_file is directly available
      type: 'midi', // Explicitly set type for type safety
    } as MidiTrackRead;
  } else if (track.type === 'audio') {
      // Placeholder: Add conversion for AudioTrackRead
      typedTrack = { ...track } as AudioTrackRead;
  } else if (track.type === 'sampler') {
      // Placeholder: Add conversion for SamplerTrackRead
      typedTrack = { ...track } as SamplerTrackRead;
  } else if (track.type === 'drum') {
      // Placeholder: Add conversion for DrumTrackRead
      typedTrack = { ...track } as DrumTrackRead;
  } else {
    // Handle unknown or base track type if necessary
    console.warn(`Unknown or unhandled track type: ${track.type}`);
    // Fallback to undefined for unknown types
    typedTrack = undefined;
  }

  return typedTrack;
};