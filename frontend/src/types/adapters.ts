// /**
//  * Type adapters for converting between unified types and API types
//  */

// import { 
//   Project, 
//   ProjectCreateData, 
// } from './project';
// // import { 
// //   Track, 
// //   TrackState,
// //   AudioTrack,
// //   MidiTrack,
// //   DrumTrack,
// //   SamplerTrack
// // } from './track';

// // Import API types from the platform
// import { 
//   Project as ApiProject,
//   ProjectCreate as ApiProjectCreate,
//   ProjectUpdate as ApiProjectUpdate,
//   ProjectWithTracks as ApiProjectWithTracks,
//   CombinedTrack as ApiCombinedTrack,
//   ProjectWithTracks
// } from '../platform/types/project';

// /**
//  * Converts an API project to our unified Project type
//  */
// export function apiProjectToProject(apiProject: ApiProjectWithTracks): Project {
//   return {
//     id: '',
//     name: apiProject.name,
//     tempo: apiProject.bpm,
//     timeSignature: [apiProject.time_signature_numerator, apiProject.time_signature_denominator],
//     key: apiProject.key_signature,
//     tracks: apiProject.tracks?.map(apiTrackToTrack) || [],
//     created_at: apiProject.created_at,
//     updated_at: apiProject.updated_at,
//     user_id: apiProject.user_id
//   };
// }

// /**
//  * Converts our unified Project type to an API project update
//  */
// export function projectToApiProjectUpdate(project: Project): ProjectWithTracks {
//   return {
//     user_id: '',
//     name: project.name,
//     bpm: project.tempo,
//     time_signature_numerator: project.timeSignature[0],
//     time_signature_denominator: project.timeSignature[1],
//     key_signature: project.key,
//     tracks: project.tracks.map(trackToApiTrack)
//   };
// }

// /**
//  * Converts an API track to our unified Track type
//  */
// export function apiTrackToTrack(apiTrack: ApiCombinedTrack): Track {
//   // Start with the base fields common to all track types
//   const baseTrack: Track = {
//     id: apiTrack.id,
//     name: apiTrack.name,
//     type: apiTrack.type as 'audio' | 'midi' | 'drum' | 'sampler',
//     volume: apiTrack.volume ?? 80,
//     pan: apiTrack.pan ?? 0,
//     muted: apiTrack.mute ?? false,
//     soloed: false, // API doesn't store solo state as it's a runtime concept
//     // Common optional fields
//     trimStartTicks: apiTrack.trim_start_ticks || 0,
//     trimEndTicks: apiTrack.trim_end_ticks || 0,
//     durationTicks: apiTrack.duration_ticks || 0,
    
//     // File references
//     audioFileId: apiTrack.track.audio_file_id || undefined,
    
//     // Instrument data for MIDI and drum tracks
//     instrumentId: apiTrack.instrument_id || undefined,
//     instrumentName: apiTrack.instrument_file?.name || undefined,
//     instrumentStorageKey: apiTrack.instrument_file?.storage_key || undefined,
//   };
  
//   // Type-specific fields will be added by the UI when needed
//   return baseTrack;
// }

// /**
//  * Converts our unified Track type to an API track
//  */
// export function trackToApiTrack(track: Track): ApiCombinedTrack {
//   return {
//     id: track.id,
//     name: track.name,
//     type: track.type,
//     volume: track.volume,
//     pan: track.pan,
//     mute: track.muted,
//     x_position: null, // Will be set by layout system
//     y_position: null,
//     trim_start_ticks: track.trimStartTicks || null,
//     trim_end_ticks: track.trimEndTicks || null,
//     duration_ticks: track.durationTicks || null,
//     track_number: null,
//     audio_file_id: (track.type === 'audio' || track.type === 'sampler') ? track.audioFileId || null : null,
//     midi_file_id: (track.type === 'midi' || track.type === 'sampler') ? track.midiFileId || null : null,
//     instrument_id: track.instrumentId || null,
//     drum_track_id: track.type === 'drum' ? track.id : null,
//   };
// }

// /**
//  * Converts a ProjectCreateData to an API project create request
//  */
// export function projectCreateDataToApiProjectCreate(data: ProjectCreateData, userId: string): ApiProjectCreate {
//   return {
//     name: data.name,
//     bpm: data.tempo,
//     time_signature_numerator: data.timeSignature[0],
//     time_signature_denominator: data.timeSignature[1],
//     key_signature: data.key,
//     user_id: userId
//   };
// }

// /**
//  * Converts TrackState to Track by stripping runtime-specific properties
//  */
// export function trackStateToTrack(trackState: TrackState): Track {
//   // Create a new object with just the Track properties
//   const track: Track = {
//     id: trackState.id,
//     name: trackState.name,
//     type: trackState.type,
//     volume: trackState.volume,
//     pan: trackState.pan,
//     muted: trackState.muted,
//     soloed: trackState.soloed,
//     color: trackState.color,
//     storage_key: trackState.storage_key,
//     trimStartTicks: trackState.trimStartTicks,
//     trimEndTicks: trackState.trimEndTicks,
//     durationTicks: trackState.durationTicks,
//     instrumentId: trackState.instrumentId,
//     instrumentName: trackState.instrumentName,
//     instrumentStorageKey: trackState.instrumentStorageKey,
//     baseMidiNote: trackState.baseMidiNote,
//     grainSize: trackState.grainSize,
//     overlap: trackState.overlap,
//     audioFileId: trackState.audioFileId,
//     midiFileId: trackState.midiFileId
//   };
  
//   return track;
// }