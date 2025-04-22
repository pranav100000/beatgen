import { Position } from '../components/track';
import { CombinedTrack } from 'src/platform/types/project';
import { NoteState } from '../components/drum-machine/DrumMachine';
import { Note } from '../../types/note';
import { Store } from '../core/state/store';
import { Action } from '../core/state/history/actions/BaseAction';
import { 
    ProjectWithTracks,
    AudioTrackRead, 
    MidiTrackRead, 
    SamplerTrackRead, 
    DrumTrackRead
} from '../../platform/types/project';
// Remove the type re-export for now
// export type { ProjectWithTracks as ProjectStateData }; 

// =================== SHARED TYPES ===================

// Represents basic parameters adjustable for most tracks
export type TrackParameter = {
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  name: string;
  position: Position;
  // Added based on usage in the main store file
  mute?: boolean; // Often used alongside muted
  solo?: boolean; // Often used alongside soloed
  x_position?: number; // Position components
  y_position?: number; // Position components
};

export type TrackType = 'audio' | 'midi' | 'drum' | 'sampler';

// Options for creating tracks - base interface
export interface BaseTrackOptions {
  id?: string;
  name?: string;
  position?: Position;
  volume?: number;
  pan?: number;
  muted?: boolean;
  soloed?: boolean;
  trackId?: string; // Alias for id used in some places
  trim_start_ticks?: number;
  trim_end_ticks?: number;
  duration_ticks?: number;
  duration?: number; // Usually in seconds, but might be ticks in some contexts
}

// Specific options for Audio Tracks
export interface AudioTrackOptions extends BaseTrackOptions {
  audioFile?: File;
  audio_file_name?: string;
  audio_file_format?: string;
  audio_file_size?: number;
  audio_file_duration?: number;
  audio_file_sample_rate?: number;
  url?: string;
  storage_key?: string;
}

// Specific options for MIDI Tracks
export interface MidiTrackOptions extends BaseTrackOptions {
  instrumentId?: string;
  instrumentName?: string;
  instrumentStorageKey?: string;
  midiNotes?: any[]; // TODO: Define a proper MidiNote type
}

// Specific options for Drum Tracks (Sequencers)
export interface DrumTrackOptions extends BaseTrackOptions {
  samplerTrackIds?: string[];
  pattern?: boolean[][]; // Represents the drum grid pattern
}

// Specific options for Sampler Tracks
export interface SamplerTrackOptions extends BaseTrackOptions {
  sampleFile?: File;
  baseMidiNote?: number;
  grainSize?: number;
  overlap?: number;
  midiNotes?: any[]; // TODO: Define a proper MidiNote type
}

// Unified options type for track creation
export type TrackOptions = AudioTrackOptions | MidiTrackOptions | DrumTrackOptions | SamplerTrackOptions;

// Union type for all possible track configurations within the CombinedTrack structure
// This helps type the 'track' property of CombinedTrack more accurately if needed
// (Currently CombinedTrack uses 'any' for 'track', which is less safe)
// Example: `track: AudioTrackSpecificData | MidiTrackSpecificData | ...`
// TODO: Define specific data interfaces if 'CombinedTrack.track' needs stricter typing

// Represents operations that can modify track state, used for updates and history
export type TrackOperation = 
  | { type: 'create', trackType: TrackType, name: string, options?: TrackOptions } // Use TrackOptions
  | { 
      type: 'update', 
      trackId: string, 
      // Define updates more precisely, combining known track properties and specific options
      updates: Partial<CombinedTrack & TrackParameter & DrumTrackOptions & SamplerTrackOptions & MidiTrackOptions & AudioTrackOptions & { dbId?: string }> 
    }
  | { type: 'delete', trackId: string }
  | { type: 'param_change', trackId: string, param: keyof TrackParameter, value: TrackParameter[keyof TrackParameter] }; // Improve value type

// Parameters related to the overall project settings
export type ProjectParam = 'projectTitle' | 'bpm' | 'timeSignature' | 'keySignature';

// Commands for controlling playback
export type PlaybackCommand = 'play' | 'pause' | 'stop' | 'seek';

// Base interface for Zustand slices, defining Set and Get functions
export interface StoreSlice<T> {
  (set: SetFn, get: GetFn): T;
}

// Type definitions for Zustand's set and get functions
export type SetFn = (partial: any | ((state: RootState) => any), replace?: boolean | undefined) => void;
export type GetFn = () => RootState;


// Define the overall structure of the combined Zustand store
// This will aggregate all the individual slices
export interface RootState {
  // Core Engine / Initialization
  store: Store | null;
  isInitialized: boolean;
  setStore: (store: Store) => void;
  setIsInitialized: (isInitialized: boolean) => void;
  initializeAudio: () => Promise<void>;

  // Project Settings (align with ProjectWithTracks)
  projectTitle: string; 
  bpm: number;
  timeSignature: [number, number];
  keySignature: string; 
  setProjectTitle: (title: string) => void;
  setBpm: (bpm: number) => void;
  setTimeSignature: (numerator: number, denominator: number) => void;
  setKeySignature: (keySignature: string) => void;
  // Fix: Use ProjectWithTracks directly
  loadProject: (projectId: string) => Promise<ProjectWithTracks | null>; 

  // Track Management (Core)
  tracks: CombinedTrack[];
  findTrackById: (trackId: string) => CombinedTrack | undefined;
  updateTrackState: (trackId: string, updates: Partial<CombinedTrack & TrackParameter>) => void;
  updateTracks: (newTracks: CombinedTrack[]) => void;
  setTracks: (tracks: CombinedTrack[]) => void;
  updateTrackIndices: () => void;
  // Expose internal helper for nested updates
  _updateNestedTrackData: (trackId: string, nestedUpdates: Partial<any>) => void;

  // Track Operations (Generic Actions)
  handleTrackOperation: (operation: TrackOperation) => Promise<CombinedTrack | null | void>; // Maybe keep this generic one?
  handleTrackParameterChange: <K extends keyof TrackParameter>(trackId: string, paramName: K, newValue: TrackParameter[K]) => void;
  handleTrackVolumeChange: (trackId: string, volume: number) => void;
  handleTrackPanChange: (trackId: string, pan: number) => void;
  handleTrackMuteToggle: (trackId: string, muted: boolean) => void;
  handleTrackSoloToggle: (trackId: string, soloed: boolean) => void;
  handleTrackDelete: (trackId: string) => Promise<void>;
  handleTrackPositionChange: (trackId: string, newPosition: Position, isDragEnd: boolean) => void;
  handleTrackNameChange: (trackId: string, name: string) => void;
  handleTrackResizeEnd: (trackId: string, deltaPixels: number, resizeDirection: 'left' | 'right') => void;

  // Track Creation / Type-Specific Actions (From various slices)
  createTrackAndRegisterWithHistory: (type: TrackType, name: string, options?: TrackOptions) => Promise<CombinedTrack | null>;
  uploadAudioFile: (file: File, isSampler?: boolean) => Promise<CombinedTrack | null>;
  replaceTrackAudioFile: (trackId: string, file: File) => Promise<void>;
  handleInstrumentChange: (trackId: string, instrumentId: string, instrumentName: string, instrumentStorageKey: string) => Promise<void>;
  handleAddTrack: (type: TrackType, instrumentId?: string, instrumentName?: string, instrumentStorageKey?: string) => Promise<any>;
  addMidiNote: (trackId: string, note: NoteState) => void;
  removeMidiNote: (trackId: string, noteId: number) => void;
  updateMidiNote: (trackId: string, note: NoteState) => void;
  getTrackNotes: (trackId: string) => Note[] | null;
  setDrumPattern: (trackId: string, pattern: boolean[][]) => void;
  addSamplerToDrumTrack: (drumTrackId: string, file: File) => Promise<CombinedTrack | null>;
  removeSamplerFromDrumTrack: (drumTrackId: string, samplerTrackIdToDelete: string) => Promise<void>;
  addEmptySamplerToDrumTrack: (drumTrackId: string, newSamplerName?: string) => Promise<string | null>;
  downloadSamplerTrack: (trackId: string) => Promise<{audioBlob?: Blob, trackName: string} | null>;

  // Playback / Transport
  isPlaying: boolean;
  currentTime: number;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  handlePlaybackCommand: (command: PlaybackCommand, arg?: any) => Promise<void>;
  playPause: () => Promise<void>;
  stop: () => Promise<void>;
  seekToPosition: (position: number) => void;

  // History (Undo/Redo)
  canUndo: boolean;
  canRedo: boolean;
  setCanUndo: (canUndo: boolean) => void;
  setCanRedo: (canRedo: boolean) => void;
  executeHistoryAction: (action: Action) => Promise<void>; // Use imported Action type
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  _updateHistoryState: () => void; // Keep internal helper exposed if needed

  // UI State
  zoomLevel: number;
  measureCount: number;
  addMenuAnchor: HTMLElement | null;
  openDrumMachines: Record<string, boolean>;
  setZoomLevel: (zoomLevel: number) => void;
  setMeasureCount: (measureCount: number) => void;
  setAddMenuAnchor: (el: HTMLElement | null) => void;
  openDrumMachine: (drumTrackId: string) => void;
  closeDrumMachine: (trackId: string) => void;

  // Utility / Generic Updater (Keep internal helpers exposed)
  updateState: <K extends keyof RootState>(key: K, value: RootState[K] | ((prev: RootState[K]) => RootState[K])) => void;
  _updateState: <K extends keyof RootState>(
    key: K, 
    value: RootState[K] | ((prev: RootState[K]) => RootState[K])
  ) => void;
  _withStore: <T extends unknown[], R>(fn: (store: Store, ...args: T) => R | Promise<R>) => (...args: T) => R | Promise<R> | null;
  _withErrorHandling: <T extends unknown[], R>(fn: (...args: T) => Promise<R>, actionName: string) => (...args: T) => Promise<R | null>;
}

// Helper type for creating slices that conform to RootState
// Ensures that each slice only implements a portion of the RootState
export type StoreSliceCreator<T> = (set: SetFn, get: GetFn) => T; 