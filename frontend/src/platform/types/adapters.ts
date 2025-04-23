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
    tracks: project.tracks || []
  };
}

/**
 * Converts an API track model to the internal track model
 */