// /**
//  * Unified Track types for BeatGen
//  * This file provides a single source of truth for track types across the application
//  */

// import * as Tone from 'tone';

// // Track type discriminators
// export type TrackType = 'audio' | 'midi' | 'drum' | 'sampler';

// // Position in the project grid
// export interface Position {
//   x: number;  // Horizontal position (time)
//   y: number;  // Vertical position (track order)
// }

// /**
//  * Core track model - the essential data representing a track
//  * This is used for persistence and transfer to/from the API
//  */
// export interface Track {
//   id: string;
//   name: string;
//   type: TrackType;
//   volume: number;       // 0-100 scale
//   pan: number;          // -100 to 100 scale
//   muted: boolean;
//   soloed: boolean;      // UI state, not persisted to API
  
//   // Common optional attributes
//   color?: string;
  
//   // MIDI & Drum specific
//   instrumentId?: string;
//   instrumentName?: string;
//   instrumentStorageKey?: string;
  
//   // Sampler specific
//   baseMidiNote?: number;
//   grainSize?: number;
//   overlap?: number;
  
//   // References to associated files
//   audioFileId?: string;
//   midiFileId?: string;

//   trimStartTicks?: number;
//   trimEndTicks?: number;
//   durationTicks?: number;
  
//   position?: Position;       // Position in the grid
// }

// /**
//  * Runtime track state - includes everything in Track plus runtime-specific data
//  * This should only be used in the UI layer, not for persistence
//  */
// export interface TrackState extends Track {
//   // Runtime-specific fields
//   _calculatedWidth?: number; // Width in pixels based on duration and BPM
//   index?: number;            // Track index in the project
//   dbId?: string;             // ID in local database
//   channel?: Tone.Channel | null; // Added channel property
  
//   // Type-specific runtime data (use type discriminator to access)
//   audioFile?: File;
//   duration?: number;
//   player?: Tone.Player;
//   sampleFile?: File;
//   sampleBuffer?: AudioBuffer;

// }

// /**
//  * Type-specific track interfaces
//  * Use these for stronger typing when the track type is known
//  */

// export interface AudioTrack extends TrackState {
//   audioStorageKey: string;
//   type: 'audio';
//   audioFile?: File;
//   player?: Tone.Player;
// }

// export interface MidiTrack extends TrackState {
//   type: 'midi';
//   instrumentId: string;
//   instrumentName: string;
//   instrumentStorageKey?: string;
// }

// export interface DrumTrack extends TrackState {
//   type: 'drum';
//   audioStorageKey: string;
//   drumPattern?: boolean[][];
//   samplerTrackIds?: string[];
// }

// export interface SamplerTrack extends TrackState {
//   type: 'sampler';
//   audioStorageKey: string;
//   audioFileId: string;
//   sampleFile?: File;
//   baseMidiNote: number;
//   grainSize: number;
//   overlap: number;
//   sampleBuffer?: AudioBuffer;
// }

// /**
//  * Type guards for discriminating between track types
//  */
// export function isAudioTrack(track: Track | TrackState): track is AudioTrack {
//   return track.type === 'audio';
// }

// export function isMidiTrack(track: Track | TrackState): track is MidiTrack {
//   return track.type === 'midi';
// }

// export function isDrumTrack(track: Track | TrackState): track is DrumTrack {
//   return track.type === 'drum';
// }

// export function isSamplerTrack(track: Track | TrackState): track is SamplerTrack {
//   return track.type === 'sampler';
// }