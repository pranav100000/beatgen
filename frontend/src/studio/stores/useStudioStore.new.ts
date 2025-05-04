// import { create } from 'zustand';
// import * as Tone from 'tone';
// import { Store } from '../core/state/store';
// import { AudioTrack, AudioTrack as EngineAudioTrack } from '../core/audio-engine/audioEngine';
// import { calculateTrackWidth, GRID_CONSTANTS, ticksToPixels } from '../constants/gridConstants';
// import { historyManager } from '../core/state/history/HistoryManager';
// import { getProject, Project } from '../../platform/api/projects';
// import { downloadFile } from '../../platform/api/sounds';
// import { Actions } from '../core/state/history/actions';
// import { NoteState } from '../components/drum-machine/DrumMachine';
// import { convertJsonToNotes, Note } from '../../types/note';
// import { convertFromNoteState, PULSES_PER_QUARTER_NOTE } from '../utils/noteConversion';
// import { 
//   AudioTrackRead, 
//   MidiTrackRead, 
//   SamplerTrackRead, 
//   DrumTrackRead 
// } from 'src/platform/types/project';
// import { Position } from '../components/track';
// import { CombinedTrack } from 'src/platform/types/project';
// import { SamplerTrackBase } from 'src/platform/types/track_models/sampler_track';
// import { Action } from '../core/state/history/actions/BaseAction';

// // =================== TYPE DEFINITIONS ===================

// type TrackParameter = {
//   volume: number;
//   pan: number;
//   muted: boolean;
//   soloed: boolean;
//   name: string;
//   position: Position;
// };

// type TrackType = 'audio' | 'midi' | 'drum' | 'sampler';

// type TrackOperation = 
//   | { type: 'create', trackType: TrackType, name: string, options?: Record<string, unknown> }
//   | { type: 'update', trackId: string, updates: Partial<CombinedTrack> }
//   | { type: 'delete', trackId: string }
//   | { type: 'param_change', trackId: string, param: keyof TrackParameter, value: any };

// type ProjectParam = 'projectTitle' | 'bpm' | 'timeSignature' | 'keySignature';

// type PlaybackCommand = 'play' | 'pause' | 'stop' | 'seek';

// // Track creation options for each track type
// interface BaseTrackOptions {
//   id?: string;
//   name?: string;
//   position?: Position;
//   volume?: number;
//   pan?: number;
//   muted?: boolean;
//   soloed?: boolean;
//   trim_start_ticks?: number;
//   trim_end_ticks?: number;
//   duration?: number;
// }

// interface AudioTrackOptions extends BaseTrackOptions {
//   audioFile?: File;
//   url?: string;
//   storage_key?: string;
// }

// interface MidiTrackOptions extends BaseTrackOptions {
//   instrumentId?: string;
//   instrumentName?: string;
//   instrumentStorageKey?: string;
//   midiNotes?: any[];
// }

// interface DrumTrackOptions extends BaseTrackOptions {
//   samplerTrackIds?: string[];
//   pattern?: boolean[][];
// }

// interface SamplerTrackOptions extends BaseTrackOptions {
//   sampleFile?: File;
//   baseMidiNote?: number;
//   grainSize?: number;
//   overlap?: number;
//   midiNotes?: any[];
// }

// // Unified options type
// type TrackOptions = AudioTrackOptions | MidiTrackOptions | DrumTrackOptions | SamplerTrackOptions;

// // Enhanced Studio State Interface
// interface StudioState {
//   // Core state
//   store: Store | null;
//   isInitialized: boolean;
//   isPlaying: boolean;
//   currentTime: number;
  
//   // Project settings
//   projectTitle: string;
//   bpm: number;
//   timeSignature: [number, number];
//   keySignature: string;
//   tracks: CombinedTrack[];
  
//   // UI state
//   zoomLevel: number;
//   measureCount: number;
//   canUndo: boolean;
//   canRedo: boolean;
//   addMenuAnchor: HTMLElement | null;
//   openDrumMachines: Record<string, boolean>; 
  
//   // Core actions
//   initializeAudio: () => Promise<void>;
//   loadProject: (projectId: string) => Promise<Project>;
//   executeHistoryAction: (action: unknown) => Promise<void>;
//   findTrackById: (trackId: string) => CombinedTrack | undefined;
//   updateTrackState: (trackId: string, updates: Partial<CombinedTrack>) => void;
//   updateTrack: (updatedTrack: CombinedTrack) => void;
//   updateTracks: (newTracks: CombinedTrack[]) => void;
  
//   // Generic state updater
//   updateState: <K extends keyof StudioState>(
//     key: K, 
//     value: StudioState[K] | ((prev: StudioState[K]) => StudioState[K])
//   ) => void;
  
//   // State setters (kept for backward compatibility)
//   setStore: (store: Store) => void;
//   setIsInitialized: (isInitialized: boolean) => void;
//   setIsPlaying: (isPlaying: boolean) => void;
//   setCurrentTime: (time: number) => void;
//   setProjectTitle: (title: string) => void;
//   setBpm: (bpm: number) => void;
//   setTimeSignature: (numerator: number, denominator: number) => void;
//   setKeySignature: (keySignature: string) => void;
//   setTracks: (tracks: CombinedTrack[]) => void;
//   setZoomLevel: (zoomLevel: number) => void;
//   setMeasureCount: (measureCount: number) => void;
//   setCanUndo: (canUndo: boolean) => void;
//   setCanRedo: (canRedo: boolean) => void;
//   setAddMenuAnchor: (el: HTMLElement | null) => void;
  
//   // Track operations - generic
//   handleTrackOperation: (operation: TrackOperation) => Promise<any>;
//   handleTrackParameterChange: <K extends keyof TrackParameter>(trackId: string, paramName: K, newValue: TrackParameter[K]) => void;
//   handleTrackVolumeChange: (trackId: string, volume: number) => void;
//   handleTrackPanChange: (trackId: string, pan: number) => void;
//   handleTrackMuteToggle: (trackId: string, muted: boolean) => void;
//   handleTrackSoloToggle: (trackId: string, soloed: boolean) => void;
//   handleTrackDelete: (trackId: string) => Promise<void>;
//   handleTrackPositionChange: (trackId: string, newPosition: Position, isDragEnd: boolean) => void;
//   handleTrackNameChange: (trackId: string, name: string) => void;
  
//   // Track operations - specialized by type
  
//   // Audio tracks
//   createAudioTrack: (options: AudioTrackOptions) => Promise<CombinedTrack | null>;
//   uploadAudioFile: (file: File, isSampler?: boolean) => Promise<CombinedTrack | null>;
//   replaceTrackAudioFile: (trackId: string, file: File) => Promise<void>;
  
//   // MIDI tracks
//   createMidiTrack: (options: MidiTrackOptions) => Promise<CombinedTrack | null>;
//   handleInstrumentChange: (trackId: string, instrumentId: string, instrumentName: string, instrumentStorageKey: string) => void;
//   addMidiNote: (trackId: string, note: NoteState) => void;
//   removeMidiNote: (trackId: string, noteId: number) => void;
//   updateMidiNote: (trackId: string, note: NoteState) => void;
//   getTrackNotes: (trackId: string) => Note[] | null;
  
//   // Drum tracks
//   createDrumTrack: (options: DrumTrackOptions) => Promise<CombinedTrack | null>; 
//   openDrumMachine: (drumTrackId: string) => void;
//   closeDrumMachine: (trackId: string) => void;
//   setDrumPattern: (trackId: string, pattern: boolean[][]) => void;
  
//   // Sampler tracks
//   createSamplerTrack: (options: SamplerTrackOptions) => Promise<CombinedTrack | null>;
//   addSamplerToDrumTrack: (drumTrackId: string, file: File) => Promise<void>;
//   removeSamplerFromDrumTrack: (drumTrackId: string, samplerTrackIdToDelete: string) => Promise<void>;
//   addEmptySamplerToDrumTrack: (drumTrackId: string, newSamplerName?: string) => Promise<string | null>;
//   downloadSamplerTrack: (trackId: string) => Promise<{audioBlob?: Blob, midiBlob?: Blob, trackName: string}>;
  
//   // Backward compatibility
//   handleAddTrack: (type: TrackType, instrumentId?: string, instrumentName?: string, instrumentStorageKey?: string) => Promise<any>;
  
//   // Transport actions
//   handlePlaybackCommand: (command: PlaybackCommand, arg?: any) => Promise<void>;
//   playPause: () => Promise<void>;
//   stop: () => Promise<void>;
//   seekToPosition: (position: number) => void;
  
//   // History actions
//   undo: () => Promise<void>;
//   redo: () => Promise<void>;
//   updateTrackIndices: () => void;
// }

// // =================== CONFIGURATION ===================

// // Default configuration for samplers
// const DEFAULT_SAMPLER_CONFIG = {
//   baseMidiNote: 60,
//   grainSize: 0.1,
//   overlap: 0.1
// };

// // Track type-specific configurations with unified interface
// const TRACK_CONFIG = {
//   audio: {
//     getDefaultName: (count: number, instrumentName?: string) => instrumentName || `Audio Track ${count}`,
//     initTrack: (id: string, file?: File) => ({ type: 'audio' as const, audioFile: file }),
//     initEngine: async (store: Store, trackId: string, file?: File) => file ? store.loadAudioFile(trackId, file) : Promise.resolve(),
//   },
//   midi: {
//     getDefaultName: (count: number, instrumentName?: string) => instrumentName || `MIDI Track ${count}`,
//     initTrack: (id: string) => ({ type: 'midi' as const }),
//     initEngine: async (store: Store, trackId: string, _?: File, instrumentId?: string) => 
//       instrumentId ? store.connectTrackToSoundfont(trackId, instrumentId) : Promise.resolve(),
//   },
//   drum: {
//     getDefaultName: (count: number, instrumentName?: string) => instrumentName || `Drum Sequencer ${count}`,
//     initTrack: (id: string) => ({ 
//       type: 'drum' as const, 
//       drumPattern: Array(4).fill(null).map(() => Array(64).fill(false)) 
//     }),
//     initEngine: async () => Promise.resolve(),
//   },
//   sampler: {
//     getDefaultName: (count: number, instrumentName?: string) => instrumentName || `Sampler ${count}`,
//     initTrack: (id: string, file?: File) => ({ 
//       type: 'sampler' as const, 
//       sampleFile: file,
//       baseMidiNote: DEFAULT_SAMPLER_CONFIG.baseMidiNote,
//       grainSize: DEFAULT_SAMPLER_CONFIG.grainSize,
//       overlap: DEFAULT_SAMPLER_CONFIG.overlap
//     }),
//     initEngine: async (store: Store, trackId: string, file?: File) => {
//       const samplerController = store.getTransport().getSamplerController();
//       if (!samplerController) return Promise.resolve();
      
//       return samplerController.connectTrackToSampler(
//         trackId,
//         file,
//         store.getMidiManager(),
//         DEFAULT_SAMPLER_CONFIG.baseMidiNote,
//         DEFAULT_SAMPLER_CONFIG.grainSize,
//         DEFAULT_SAMPLER_CONFIG.overlap
//       );
//     },
//   }
// };

// // =================== HELPER FUNCTIONS ===================

// /**
//  * Converts UI track options to a CombinedTrack DB model
//  * This is a helper function to standardize the conversion from UI options to DB model
//  */
// const convertToDBTrack = (
//   type: TrackType, 
//   options: BaseTrackOptions, 
//   typeSpecificData: any = {}
// ): CombinedTrack => {
//   // Generate ID if not provided
//   const trackId = options.id || crypto.randomUUID();
  
//   // Create common track properties
//   const track: CombinedTrack = {
//     id: trackId,
//     name: options.name || `Untitled ${type} track`,
//     type: type,
//     volume: options.volume ?? 80,
//     pan: options.pan ?? 0,
//     mute: options.muted ?? false,
//     x_position: options.position?.x ?? 0,
//     y_position: options.position?.y ?? 0,
//     trim_start_ticks: options.trim_start_ticks ?? 0,
//     trim_end_ticks: options.trim_end_ticks ?? null,
//     duration_ticks: options.duration ?? null,
//     // This will be overridden with type-specific track data
//     track: null as any
//   };
  
//   // Add type-specific track data
//   if (type === 'audio') {
//     const audioData = typeSpecificData as Partial<AudioTrackRead>;
//     track.track = {
//       id: trackId,
//       name: track.name,
//       type: 'audio',
//       audio_file_storage_key: audioData.audio_file_storage_key || '',
//       audio_file_format: audioData.audio_file_format || 'mp3',
//       audio_file_size: audioData.audio_file_size || 0,
//       audio_file_duration: audioData.audio_file_duration || 0,
//       audio_file_sample_rate: audioData.audio_file_sample_rate || 44100
//     };
//   } 
//   else if (type === 'midi') {
//     const midiData = typeSpecificData as Partial<MidiTrackRead>;
//     track.track = {
//       id: trackId,
//       name: track.name,
//       type: 'midi',
//       instrument_id: midiData.instrument_id || '',
//       midi_notes_json: midiData.midi_notes_json || { notes: [] },
//       instrument_file: {
//         id: midiData.instrument_file?.id || '',
//         name: midiData.instrument_file?.name || 'Default Instrument',
//         storage_key: midiData.instrument_file?.storage_key || '',
//         file_format: midiData.instrument_file?.file_format || 'sf2',
//         file_size: midiData.instrument_file?.file_size || 0,
//         category: midiData.instrument_file?.category || 'piano',
//         is_public: midiData.instrument_file?.is_public || true,
//       }
//     };
//   }
//   else if (type === 'sampler') {
//     const samplerData = typeSpecificData as Partial<SamplerTrackRead>;
//     track.track = {
//       id: trackId,
//       name: track.name,
//       type: 'sampler',
//       base_midi_note: samplerData.base_midi_note || 60,
//       grain_size: samplerData.grain_size || 0.1,
//       overlap: samplerData.overlap || 0.1,
//       audio_storage_key: samplerData.audio_storage_key || '',
//       audio_file_format: samplerData.audio_file_format || 'mp3',
//       audio_file_size: samplerData.audio_file_size || 0,
//       audio_file_name: samplerData.audio_file_name || '',
//       audio_file_duration: samplerData.audio_file_duration || 0,
//       audio_file_sample_rate: samplerData.audio_file_sample_rate || 44100,
//       midi_notes_json: samplerData.midi_notes_json || { notes: [] }
//     };
//   }
//   else if (type === 'drum') {
//     const drumData = typeSpecificData as Partial<DrumTrackRead>;
//     track.track = {
//       id: trackId,
//       name: track.name,
//       type: 'drum'
//     };
    
//     // Add UI-specific data for drum tracks
//     (track as any).drumPattern = Array(4).fill(null).map(() => Array(64).fill(false));
//     if (typeSpecificData.samplerTrackIds) {
//       (track as any).samplerTrackIds = typeSpecificData.samplerTrackIds;
//     }
//   }
  
//   // Add position for UI
//   (track as any).position = {
//     x: track.x_position || 0,
//     y: track.y_position || 0
//   };
  
//   return track;
// };

// // =================== STORE IMPLEMENTATION ===================

// // Create the store with slice architecture
// const createStudioStore = (set: any, get: any) => {
//   // =================== UTILITY FUNCTIONS ===================

//   // Higher-order function to ensure store is available
//   const withStore = <T extends unknown[], R>(fn: (store: Store, ...args: T) => R) => 
//     (...args: T): R | null => {
//       const { store } = get();
//       if (!store) {
//         console.warn('Store not initialized');
//         return null;
//       }
//       return fn(store, ...args);
//     };

//   // Error handling wrapper
//   const withErrorHandling = <T extends unknown[], R>(
//     fn: (...args: T) => Promise<R>, 
//     actionName: string
//   ) => async (...args: T): Promise<R | null> => {
//     try {
//       return await fn(...args);
//     } catch (error) {
//       console.error(`Error in ${actionName}:`, error);
//       return null;
//     }
//   };

//   // Generic state updater
//   const updateState = <K extends keyof StudioState>(
//     key: K, 
//     value: StudioState[K] | ((prev: StudioState[K]) => StudioState[K])
//   ) => {
//     if (typeof value === 'function') {
//       // @ts-ignore - function case
//       set(state => ({ [key]: value(state[key]) }));
//     } else {
//       set({ [key]: value });
//     }
//   };

//   // History state updater
//   const updateHistoryState = () => {
//     set({
//       canUndo: historyManager.canUndo(),
//       canRedo: historyManager.canRedo()
//     });
//   };

//   // Execute a history action and update state
//   const executeHistoryAction = async (action: Action) => {
//     await historyManager.executeAction(action);
//     updateHistoryState();
//   };

//   // Find a track by ID
//   const findTrackById = (trackId: string) => {
//     return get().tracks.find((t: CombinedTrack) => t.id === trackId);
//   };

//   // Update a specific track's state
//   const updateTrackState = (trackId: string, updates: Partial<CombinedTrack>) => {
//     updateState('tracks', tracks => 
//       tracks.map((track: CombinedTrack) => 
//         track.id === trackId ? { ...track, ...updates } : track
//       )
//     );
//   };
  
//   // Update one track
//   const updateTrack = (updatedTrack: CombinedTrack) => {
//     updateState('tracks', tracks =>
//       tracks.map((track: CombinedTrack) =>
//         track.id === updatedTrack.id ? updatedTrack : track
//       )
//     );
//   };

//   // Update all tracks and indices
//   const updateTracks = (newTracks: CombinedTrack[]) => {
//     set({ tracks: newTracks });
//     get().updateTrackIndices();
//   };

//   // =================== CORE SLICE ===================

//   // Update audio track with file data
//   const updateTrackWithAudioInfo = withErrorHandling(async (trackId: string, file: File) => {
//     const { store } = get();
    
//     // Load audio file into engine
//     await store.loadAudioFile(trackId, file);
    
//     // Get updated engine track info
//     const engineTrack = store.getAudioEngine().getAllTracks().find(t => t.id === trackId);
//     if (!engineTrack?.player?.buffer) {
//       throw new Error(`Failed to load audio for track ${trackId}`);
//     }
    
//     // Calculate track dimensions
//     const duration = engineTrack.player.buffer.duration;
//     const calculatedWidth = calculateTrackWidth(
//       duration, 
//       get().bpm, 
//       get().timeSignature
//     );
    
//     return engineTrack;
//   }, 'updateTrackWithAudioInfo');

//   // Initialize the audio engine with error handling
//   const initializeAudio = withErrorHandling(async () => {
//     const { store, projectTitle } = get();
    
//     if (!store.projectManager.getCurrentProject()) {
//       console.log('Creating a new project');
//       const project = store.projectManager.createProject(projectTitle);
//       console.log('Project created:', project);
//     }
    
//     await store.initializeAudio();
//     set({ isInitialized: true });
    
//     (window as any).storeInstance = store;
//   }, 'initializeAudio');

//   // =================== SPECIALIZED TRACK CREATION FUNCTIONS ===================

//   // Create helper to create base combined track
//   const createCombinedTrack = (
//     type: TrackType,
//     options: BaseTrackOptions
//   ): CombinedTrack => {
//     // Generate ID if not provided
//     const trackId = options.id || crypto.randomUUID();
    
//     // Calculate position
//     const tracksLength = get().tracks.length;
//     const position = options.position || { 
//       x: 0, 
//       y: tracksLength * GRID_CONSTANTS.trackHeight 
//     };
    
//     // Common track properties
//     const track: CombinedTrack = {
//       id: trackId,
//       name: options.name || `Untitled ${type} track`,
//       type: type,
//       volume: options.volume ?? 80,
//       pan: options.pan ?? 0,
//       mute: options.muted ?? false,
//       x_position: position.x,
//       y_position: position.y,
//       trim_start_ticks: options.trim_start_ticks ?? 0,
//       trim_end_ticks: options.trim_end_ticks ?? null,
//       duration_ticks: options.duration ?? null,
//       track: null as any,
//     };
    
//     // Add position for UI
//     (track as any).position = position;
    
//     return track;
//   };
  
//   // 1. Audio Track Creation
//   const createAudioTrack = withErrorHandling(async (options: AudioTrackOptions) => {
//     const { store } = get();
    
//     try {
//       // Step 1: Create base combined track for DB
//       const combinedTrack = createCombinedTrack('audio', options);
      
//       // Step 2: Add audio-specific fields
//       const audioData: Partial<AudioTrackRead> = {
//         id: combinedTrack.id,
//         name: combinedTrack.name,
//         type: 'audio',
//         audio_file_storage_key: options.storage_key || '',
//         audio_file_format: 'mp3',
//         audio_file_size: 0,
//         audio_file_duration: 0,
//         audio_file_sample_rate: 44100
//       };
      
//       // Complete the track with type-specific data
//       combinedTrack.track = audioData as AudioTrackRead;
      
//       // Step 3: Create the track in the Store layer
//       const createdTrack = await store.createTrack(combinedTrack);
      
//       // Step 4: Create in audio engine
//       await store.getAudioEngine().createTrack(createdTrack.id, createdTrack.name);
      
//       // Step 5: Set position in audio engine
//       store.getAudioEngine().setTrackPosition(
//         createdTrack.id, 
//         combinedTrack.x_position || 0, 
//         combinedTrack.y_position || 0
//       );
      
//       // Step 6: If audio file provided, load it
//       if (options.audioFile) {
//         await store.loadAudioFile(createdTrack.id, options.audioFile, combinedTrack.position);
//       } else if (options.url) {
//         await store.loadAudioFileFromUrl(createdTrack.id, options.url, combinedTrack.position);
//       }
      
//       // Step 7: Create history action
//       const action = new Actions.AddTrack(store, createdTrack);
//       await executeHistoryAction(action);
      
//       // Step 8: Update indices
//       get().updateTrackIndices();
      
//       return createdTrack;
//     } catch (error) {
//       console.error('Failed to create audio track:', error);
//       return null;
//     }
//   }, 'createAudioTrack');
  
//   // 2. MIDI Track Creation
//   const createMidiTrack = withErrorHandling(async (options: MidiTrackOptions) => {
//     const { store } = get();
    
//     try {
//       // Step 1: Create base combined track for DB
//       const combinedTrack = createCombinedTrack('midi', options);
      
//       // Step 2: Add MIDI-specific fields
//       const midiData: Partial<MidiTrackRead> = {
//         id: combinedTrack.id,
//         name: combinedTrack.name,
//         type: 'midi',
//         instrument_id: options.instrumentId || '',
//         midi_notes_json: { notes: options.midiNotes || [] },
//         instrument_file: {
//           id: options.instrumentId || '',
//           name: options.instrumentName || 'Default Piano',
//           storage_key: options.instrumentStorageKey || '',
//           file_format: 'sf2',
//           file_size: 0,
//           category: 'piano',
//           is_public: true
//         }
//       };
      
//       // Complete the track with type-specific data
//       combinedTrack.track = midiData as MidiTrackRead;
      
//       // Step 3: Create the track in the Store layer
//       const createdTrack = await store.createTrack(combinedTrack);
      
//       // Step 4: Create in audio engine
//       await store.getAudioEngine().createTrack(createdTrack.id, createdTrack.name);
      
//       // Step 5: Set position in audio engine
//       store.getAudioEngine().setTrackPosition(
//         createdTrack.id, 
//         combinedTrack.x_position || 0, 
//         combinedTrack.y_position || 0
//       );
      
//       // Step 6: If instrument provided, connect to soundfont
//       if (options.instrumentId) {
//         await store.connectTrackToSoundfont(createdTrack.id, options.instrumentId);
//       }
      
//       // Step 7: Create history action
//       const action = new Actions.AddTrack(store, createdTrack);
//       await executeHistoryAction(action);
      
//       // Step 8: Update indices
//       get().updateTrackIndices();
      
//       return createdTrack;
//     } catch (error) {
//       console.error('Failed to create MIDI track:', error);
//       return null;
//     }
//   }, 'createMidiTrack');
  
//   // 3. Drum Track Creation
//   const createDrumTrack = withErrorHandling(async (options: DrumTrackOptions) => {
//     const { store } = get();
    
//     try {
//       // Step 1: Create base combined track for DB
//       const combinedTrack = createCombinedTrack('drum', options);
      
//       // Step 2: Add drum-specific fields
//       const drumData: DrumTrackRead = {
//         id: combinedTrack.id,
//         name: combinedTrack.name,
//         type: 'drum'
//       };
      
//       // Add UI-specific data
//       (combinedTrack as any).drumPattern = options.pattern || 
//         Array(4).fill(null).map(() => Array(64).fill(false));
      
//       // Complete the track with type-specific data
//       combinedTrack.track = drumData;
      
//       // Step 3: Create the track in the Store layer
//       const createdTrack = await store.createTrack(combinedTrack);
      
//       // Step 4: Create in audio engine
//       await store.getAudioEngine().createTrack(createdTrack.id, createdTrack.name);
      
//       // Step 5: Set position in audio engine
//       store.getAudioEngine().setTrackPosition(
//         createdTrack.id, 
//         combinedTrack.x_position || 0, 
//         combinedTrack.y_position || 0
//       );
      
//       // Step 6: If samplers provided, store references
//       if (options.samplerTrackIds?.length) {
//         (createdTrack as any).samplerTrackIds = options.samplerTrackIds;
//       }
      
//       // Step 7: Create history action
//       const action = new Actions.AddTrack(store, createdTrack);
//       await executeHistoryAction(action);
      
//       // Step 8: Update indices and open drum machine UI
//       get().updateTrackIndices();
//       get().openDrumMachine(createdTrack.id);
      
//       return createdTrack;
//     } catch (error) {
//       console.error('Failed to create drum track:', error);
//       return null;
//     }
//   }, 'createDrumTrack');
  
//   // 4. Sampler Track Creation
//   const createSamplerTrack = withErrorHandling(async (options: SamplerTrackOptions) => {
//     const { store } = get();
    
//     try {
//       // Step 1: Create base combined track for DB
//       const combinedTrack = createCombinedTrack('sampler', options);
      
//       // Apply default sampler properties if not provided
//       const baseMidiNote = options.baseMidiNote ?? DEFAULT_SAMPLER_CONFIG.baseMidiNote;
//       const grainSize = options.grainSize ?? DEFAULT_SAMPLER_CONFIG.grainSize;
//       const overlap = options.overlap ?? DEFAULT_SAMPLER_CONFIG.overlap;
      
//       // Step 2: Add sampler-specific fields
//       const samplerData: Partial<SamplerTrackRead> = {
//         id: combinedTrack.id,
//         name: combinedTrack.name,
//         type: 'sampler',
//         base_midi_note: baseMidiNote,
//         grain_size: grainSize,
//         overlap: overlap,
//         audio_storage_key: '',
//         audio_file_format: 'mp3',
//         audio_file_size: 0,
//         audio_file_name: options.sampleFile?.name || '',
//         audio_file_duration: 0,
//         audio_file_sample_rate: 44100,
//         midi_notes_json: { notes: options.midiNotes || [] }
//       };
      
//       // Also add UI-specific properties directly on the combined track
//       (combinedTrack as any).baseMidiNote = baseMidiNote;
//       (combinedTrack as any).grainSize = grainSize;
//       (combinedTrack as any).overlap = overlap;
      
//       // Complete the track with type-specific data
//       combinedTrack.track = samplerData as SamplerTrackRead;
      
//       // Step 3: Create the track in the Store layer
//       const createdTrack = await store.createTrack(combinedTrack);
      
//       // Step 4: Create in audio engine
//       await store.getAudioEngine().createTrack(createdTrack.id, createdTrack.name);
      
//       // Step 5: Set position in audio engine
//       store.getAudioEngine().setTrackPosition(
//         createdTrack.id, 
//         combinedTrack.x_position || 0, 
//         combinedTrack.y_position || 0
//       );
      
//       // Step 6: Initialize sampler
//       const samplerController = store.getTransport().getSamplerController();
//       if (samplerController) {
//         await samplerController.initializeSampler(
//           createdTrack.id,
//           options.sampleFile,
//           baseMidiNote,
//           grainSize,
//           overlap
//         );
        
//         // Register with MIDI manager
//         samplerController.registerTrackSubscription(createdTrack.id, store.getMidiManager());
        
//         // If sample file provided, load it
//         if (options.sampleFile) {
//           await samplerController.connectTrackToSampler(
//             createdTrack.id,
//             options.sampleFile,
//             store.getMidiManager(),
//             baseMidiNote,
//             grainSize,
//             overlap
//           );
//         }
//       }
      
//       // Step 7: Create history action
//       const action = new Actions.AddTrack(store, createdTrack);
//       await executeHistoryAction(action);
      
//       // Step 8: Update indices
//       get().updateTrackIndices();
      
//       return createdTrack;
//     } catch (error) {
//       console.error('Failed to create sampler track:', error);
//       return null;
//     }
//   }, 'createSamplerTrack');

//   // =================== PROJECT SLICE ===================

//   // Helper to handle project parameter changes
//   const handleProjectParamChange = (param: ProjectParam, value: any) => {
//     const { store } = get();
//     if (!store) return;

//     const oldValue = get()[param];
//     if (oldValue === value) return;

//     // Update UI state
//     set({ [param]: value });

//     // Update core engine state based on parameter type
//     switch (param) {
//       case 'projectTitle':
//         if (store.projectManager.getCurrentProject()) {
//           store.projectManager.setProjectName(value);
//         }
//         break;
//       case 'bpm':
//         store.projectManager.setTempo(value);
//         Tone.Transport.bpm.value = value;
//         store.getTransport().setTempo(value);
        
//         const action = new Actions.BPMChange(
//           store,
//           oldValue,
//           value,
//           get().timeSignature
//         );
//         executeHistoryAction(action);
//         break;
//       case 'timeSignature':
//         const [numerator, denominator] = value as [number, number];
//         store.projectManager.setTimeSignature(numerator, denominator);
//         Tone.Transport.timeSignature = value;
        
//         const timeAction = new Actions.TimeSignature(
//           store,
//           oldValue as [number, number],
//           value as [number, number],
//           get().bpm
//         );
//         executeHistoryAction(timeAction);
//         break;
//       case 'keySignature':
//         const keyAction = new Actions.KeySignature(
//           store,
//           oldValue as string,
//           value as string
//         );
//         executeHistoryAction(keyAction);
//         break;
//     }
//   };

//   // Split project loading into components
//   const fetchProjectData = withErrorHandling(async (projectId: string) => {
//     const projectData = await getProject(projectId);
//     console.log('Project data loaded:', projectData);
//     return projectData;
//   }, 'fetchProjectData');

//   const initializeProjectSettings = withStore(async (store, projectData: Project) => {
//     // Update UI state
//     set({
//       projectTitle: projectData.name,
//       bpm: projectData.bpm,
//       timeSignature: [
//         projectData.time_signature_numerator,
//         projectData.time_signature_denominator
//       ],
//       keySignature: projectData.key_signature
//     });
    
//     // Update core engine state
//     const newProject = store.projectManager.createProject(projectData.name);
    
//     store.projectManager.setTempo(projectData.bpm);
//     store.projectManager.setTimeSignature(
//       projectData.time_signature_numerator,
//       projectData.time_signature_denominator
//     );
    
//     Tone.Transport.bpm.value = projectData.bpm;
//     Tone.Transport.timeSignature = [
//       projectData.time_signature_numerator,
//       projectData.time_signature_denominator
//     ];
    
//     return newProject;
//   });

//   // Process a track from API response to local state
//   const processTrack = withStore(async (store, apiTrack: any, index: number) => {
//     // Extract track type and basic properties
//     const trackType = apiTrack.type as TrackType;
//     const trackConfig = TRACK_CONFIG[trackType];
//     const position = {
//       x: apiTrack.x_position ?? 0,
//       y: apiTrack.y_position ?? (index * GRID_CONSTANTS.trackHeight)
//     };
    
//     // Create core track in store
//     const trackProps = {
//       id: apiTrack.id,
//       volume: apiTrack.volume,
//       pan: apiTrack.pan,
//       muted: apiTrack.mute,
//       soloed: false,
//     };

//     const combinedTrack: CombinedTrack = {
//       id: apiTrack.id,
//       name: apiTrack.name,
//       type: trackType,
//       volume: apiTrack.volume,
//       pan: apiTrack.pan,
//       mute: apiTrack.mute,
//       x_position: position.x,
//       y_position: position.y,
//       trim_start_ticks: apiTrack.trim_start_ticks,
//       trim_end_ticks: apiTrack.trim_end_ticks,
//       duration_ticks: apiTrack.duration,
//       track: apiTrack.track,
//     }
    
//     const newTrack = await store.createTrack(combinedTrack);
//     await store.getAudioEngine().createTrack(newTrack.id, newTrack.name);
    
//     // Set audio engine properties
//     const audioEngine = store.getAudioEngine();
//     audioEngine.setTrackVolume(newTrack.id, apiTrack.volume);
//     audioEngine.setTrackPan(newTrack.id, apiTrack.pan);
//     audioEngine.setTrackMute(newTrack.id, apiTrack.mute);
//     audioEngine.setTrackPosition(newTrack.id, position.x, position.y);
    
//     // Extract type-specific data and resources
//     let audioFile = null, duration = null, instrumentId = null, instrumentStorageKey = null;
    
//     // Get resource keys based on track type
//     const typeData = {
//       audio: () => {
//         const track = apiTrack.track as AudioTrackRead;
//         return { audioStorageKey: track.audio_file_storage_key, duration: track.audio_file_duration || 0 };
//       },
//       midi: () => {
//         const track = apiTrack.track as MidiTrackRead;
//         return { 
//           instrumentStorageKey: track.instrument_file.storage_key,
//           instrumentId: track.instrument_file.id,
//           instrumentName: track.instrument_file.name,
//           midiNotesJson: track.midi_notes_json
//         };
//       },
//       drum: () => ({}),
//       sampler: () => {
//         const track = apiTrack.track as SamplerTrackRead;
//         return { 
//           audioStorageKey: track.audio_storage_key,
//           midiNotesJson: track.midi_notes_json,
//         };
//       }
//     };
    
//     // Get type-specific data
//     const resourceData = typeData[trackType]();

//     // Add UI position
//     newTrack.position = position;
    
//     return newTrack;
//   });

//   // Connect tracks to sound engines
//   const connectTracksToEngines = withStore(async (store, tracks: any[]) => {
//     for (const track of tracks) {
//       if (track.type === 'midi') {
//         try {
//           await store.connectTrackToSoundfont(track.id, track.instrumentId);
//         } catch (error) {
//           console.error(`Failed to connect loaded track ${track.id} to soundfont:`, error);
//         }
//       }
      
//       if (track.type === 'sampler') {
//         try {
//           const samplerController = store.getTransport().getSamplerController();
//           if (samplerController) {
//             if (track.sampleFile) {
//               await samplerController.connectTrackToSampler(
//                 track.id,
//                 track.sampleFile,
//                 store.getMidiManager(),
//                 track.baseMidiNote || DEFAULT_SAMPLER_CONFIG.baseMidiNote,
//                 track.grainSize || DEFAULT_SAMPLER_CONFIG.grainSize,
//                 track.overlap || DEFAULT_SAMPLER_CONFIG.overlap
//               );
//             } else {
//               await samplerController.initializeSampler(
//                 track.id,
//                 undefined,
//                 track.baseMidiNote || DEFAULT_SAMPLER_CONFIG.baseMidiNote,
//                 track.grainSize || DEFAULT_SAMPLER_CONFIG.grainSize,
//                 track.overlap || DEFAULT_SAMPLER_CONFIG.overlap
//               );
              
//               samplerController.registerTrackSubscription(track.id, store.getMidiManager());
//             }
//           }
//         } catch (error) {
//           console.error(`Failed to connect loaded sampler track ${track.id}:`, error);
//         }
//       }
//     }
//   });

//   // Optimized project loading flow
//   const loadProject = withErrorHandling(async (projectId: string) => {
//     // 1. Ensure audio is initialized
//     const { store, isInitialized } = get();
//     if (!store) throw new Error('Store not initialized');
    
//     if (!isInitialized) {
//       await store.initializeAudio();
//       set({ isInitialized: true });
//     }
    
//     // 2. Fetch and initialize project data
//     const projectData = await fetchProjectData(projectId);
//     await initializeProjectSettings(projectData);
    
//     // 3. Process all tracks in parallel 
//     const trackStates = await Promise.all(
//       projectData.tracks.map((track, index) => processTrack(track, index))
//     );
//     updateTracks(trackStates);
    
//     // 4. Connect to audio engines
//     await connectTracksToEngines(trackStates);
    
//     // Store reference for debugging
//     (window as any).loadedProjectId = projectId;
    
//     return projectData;
//   }, 'loadProject');

//   // =================== TRACK OPERATIONS ===================

//   // Upload audio file
//   const uploadAudioFile = withErrorHandling(async (file: File, isSampler = false) => {
//     // Get base filename as track name
//     const trackName = file.name.split('.')[0];
    
//     // Create the track based on type
//     if (isSampler) {
//       return createSamplerTrack({
//         name: trackName,
//         sampleFile: file
//       });
//     } else {
//       return createAudioTrack({
//         name: trackName,
//         audioFile: file
//       });
//     }
//   }, 'uploadAudioFile');

//   // Replace track audio file
//   const replaceTrackAudioFile = withErrorHandling(async (trackId: string, file: File) => {
//     const track = findTrackById(trackId);
    
//     if (!track) {
//       throw new Error(`Track ${trackId} not found`);
//     }
    
//     if (track.type !== 'audio' && track.type !== 'sampler') {
//       throw new Error(`Cannot replace audio file for ${track.type} track`);
//     }
    
//     // Stop current playback if needed
//     if (track.type === 'sampler') {
//       const { store } = get();
//       const sampler = store?.getTransport().getSamplerController()?.getSampler(trackId);
//       if (sampler) sampler.stopPlayback();
//     }
    
//     // Load file and update track info
//     await updateTrackWithAudioInfo(trackId, file);
    
//     // Update track with new file reference
//     const updates: Partial<CombinedTrack> = {};
    
//     if (track.type === 'audio') {
//       (updates as any).audioFile = file;
//     } else {
//       (updates as any).sampleFile = file;
      
//       // Re-initialize sampler
//       const { store } = get();
//       const samplerController = store?.getTransport().getSamplerController();
//       if (samplerController) {
//         await samplerController.connectTrackToSampler(
//           trackId,
//           file,
//           store.getMidiManager(),
//           (track as any).baseMidiNote || DEFAULT_SAMPLER_CONFIG.baseMidiNote,
//           (track as any).grainSize || DEFAULT_SAMPLER_CONFIG.grainSize,
//           (track as any).overlap || DEFAULT_SAMPLER_CONFIG.overlap
//         );
//       }
//     }
    
//     // Update track state
//     updateTrackState(trackId, updates);
//   }, 'replaceTrackAudioFile');

//   // Delete track
//   const handleTrackDelete = withErrorHandling(async (trackId: string) => {
//     const { store } = get();
//     const trackToDelete = findTrackById(trackId);
    
//     if (!trackToDelete) {
//       throw new Error(`Track ${trackId} not found for deletion`);
//     }
    
//     // Create and execute history action
//     const action = new Actions.DeleteTrack(store, { ...trackToDelete });
//     await executeHistoryAction(action);
    
//     // Update track indices
//     get().updateTrackIndices();
//   }, 'handleTrackDelete');

//   // Add track with unified type handling
//   const handleAddTrack = withErrorHandling(async (
//     type: TrackType, 
//     instrumentId?: string, 
//     instrumentName?: string, 
//     instrumentStorageKey?: string
//   ) => {
//     // Special handling for drum tracks with samplers
//     if (type === 'drum') {
//       // Create default samplers for drum track
//       const defaultSamplerNames = ['Kick', 'Snare', 'Clap', 'Hi-Hat'];
//       const samplerPromises = defaultSamplerNames.map(name => 
//         createSamplerTrack({ name })
//       );
      
//       // Execute in parallel for better performance
//       const createdSamplerTracks = (await Promise.all(samplerPromises)).filter(Boolean);
//       const samplerTrackIds = createdSamplerTracks.map(track => track.id);
      
//       // Create main drum track with references to samplers
//       const count = get().tracks.length + 1;
//       const mainDrumTrackName = TRACK_CONFIG.drum.getDefaultName(count, instrumentName);
      
//       const mainDrumTrack = await createDrumTrack({
//         name: mainDrumTrackName,
//         samplerTrackIds: samplerTrackIds
//       });
      
//       return { mainDrumTrack, samplerTracks: createdSamplerTracks };
//     }
    
//     // Create standard track using type-specific functions
//     const count = get().tracks.length + 1;
//     const trackName = TRACK_CONFIG[type].getDefaultName(count, instrumentName);
    
//     switch (type) {
//       case 'audio':
//         return createAudioTrack({ name: trackName });
//       case 'midi':
//         return createMidiTrack({ 
//           name: trackName,
//           instrumentId,
//           instrumentName,
//           instrumentStorageKey
//         });
//       case 'sampler':
//         return createSamplerTrack({ name: trackName });
//       default:
//         throw new Error(`Unknown track type: ${type}`);
//     }
//   }, 'handleAddTrack');

//   // Handle instrument change
//   const handleInstrumentChange = withErrorHandling(async (
//     trackId: string, 
//     instrumentId: string, 
//     instrumentName: string, 
//     instrumentStorageKey: string
//   ) => {
//     const { store } = get();
//     const track = findTrackById(trackId);
    
//     if (!track) {
//       throw new Error(`Track ${trackId} not found`);
//     }
    
//     // Update track state with new instrument
//     updateTrackState(trackId, { 
//       instrument_id: instrumentId, 
//       instrument_name: instrumentName, 
//       instrument_storage_key: instrumentStorageKey 
//     });
    
//     // Connect track to the new instrument
//     if (track.type === 'midi') {
//       await store.connectTrackToSoundfont(trackId, instrumentId);
//     }
//   }, 'handleInstrumentChange');

//   // =================== TRACK PARAMETER HANDLING ===================

//   // Generic parameter change handler optimized for all track parameters
//   const handleTrackParameterChange = <K extends keyof TrackParameter>(
//     trackId: string, 
//     paramName: K, 
//     newValue: TrackParameter[K]
//   ) => withStore((store) => {
//     const track = findTrackById(trackId);
//     if (!track) {
//       console.error(`Track with ID ${trackId} not found in handleTrackParameterChange`);
//       return;
//     }
    
//     // Type assertion needed since CombinedTrack doesn't exactly match TrackParameter
//     const oldValue = track[paramName as string];
//     if (oldValue === newValue) return;
    
//     // Create values for history action
//     const oldActionValue = typeof oldValue === 'boolean' ? (oldValue ? 1 : 0) : oldValue;
//     const newActionValue = typeof newValue === 'boolean' ? (newValue ? 1 : 0) : newValue;
    
//     // Prepare update object with specialized handling for specific parameters
//     const updateObj: Partial<CombinedTrack> = { [paramName]: newValue } as any;
    
//     // Handle special cases with different property names
//     if (paramName === 'muted') updateObj.mute = newValue as boolean;
//     if (paramName === 'position') {
//       const pos = newValue as Position;
//       updateObj.x_position = pos.x;
//       updateObj.y_position = pos.y;
//     }
    
//     // Update UI state with all necessary properties
//     updateTrackState(trackId, updateObj);
    
//     // Update audio engine based on parameter type
//     const audioEngine = store.getAudioEngine();
//     switch (paramName) {
//       case 'volume':
//         audioEngine.setTrackVolume(trackId, newValue as number);
//         break;
//       case 'pan':
//         audioEngine.setTrackPan(trackId, newValue as number);
//         break;
//       case 'muted':
//         audioEngine.setTrackMute(trackId, newValue as boolean);
//         break;
//       case 'position':
//         const pos = newValue as Position;
//         audioEngine.setTrackPosition(trackId, pos.x, pos.y);
//         break;
//     }
    
//     // Create and execute history action
//     const action = new Actions.ParameterChange(
//       store,
//       trackId,
//       paramName as string,
//       oldActionValue,
//       newActionValue
//     );
    
//     executeHistoryAction(action);
//   });

//   // Enhanced track operation handler with audio engine updates
//   const handleTrackOperation = withStore(async (store, operation: TrackOperation) => {
//     switch (operation.type) {
//       case 'create': {
//         // Use the appropriate track creation function based on type
//         const { trackType, name, options = {} } = operation;
//         switch (trackType) {
//           case 'audio':
//             return createAudioTrack({ name, ...options as AudioTrackOptions });
//           case 'midi':
//             return createMidiTrack({ name, ...options as MidiTrackOptions });
//           case 'drum':
//             return createDrumTrack({ name, ...options as DrumTrackOptions });
//           case 'sampler':
//             return createSamplerTrack({ name, ...options as SamplerTrackOptions });
//           default:
//             throw new Error(`Unknown track type: ${trackType}`);
//         }
//       }
      
//       case 'update': {
//         // First update UI state
//         updateTrackState(operation.trackId, operation.updates);
        
//         // Then update audio engine for relevant properties
//         const audioEngine = store.getAudioEngine();
//         const updates = operation.updates;
        
//         if ('volume' in updates && typeof updates.volume === 'number') {
//           audioEngine.setTrackVolume(operation.trackId, updates.volume);
//         }
        
//         if ('pan' in updates && typeof updates.pan === 'number') {
//           audioEngine.setTrackPan(operation.trackId, updates.pan);
//         }
        
//         if ('mute' in updates || 'muted' in updates) {
//           const muted = 'mute' in updates ? updates.mute : updates.muted;
//           if (typeof muted === 'boolean') {
//             audioEngine.setTrackMute(operation.trackId, muted);
//           }
//         }
        
//         if ('position' in updates && updates.position) {
//           const pos = updates.position as Position;
//           audioEngine.setTrackPosition(operation.trackId, pos.x, pos.y);
//         }
        
//         return findTrackById(operation.trackId);
//       }
      
//       case 'delete':
//         return get().handleTrackDelete(operation.trackId);
      
//       case 'param_change':
//         return handleTrackParameterChange(
//           operation.trackId, 
//           operation.param, 
//           operation.value
//         );
        
//       default:
//         console.error('Unknown track operation:', operation);
//         return null;
//     }
//   });

//   // =================== MIDI ACTIONS ===================

//   // Higher-order function for MIDI operations
//   const withMidiManager = <T extends unknown[], R>(
//     operation: (midiManager: any, ...args: T) => R,
//     methodName?: string
//   ) => {
//     return withStore((store, ...args: T) => {
//       const midiManager = store.getMidiManager();
//       if (!midiManager) {
//         console.warn('MidiManager not available');
//         return null;
//       }
//       if (methodName && !midiManager[methodName]) {
//         console.warn(`MidiManager method ${methodName} not available`);
//         return null;
//       }
//       return operation(midiManager, ...args);
//     });
//   };

//   // MIDI operations using the higher-order function
//   const addMidiNote = withMidiManager(
//     (midiManager, trackId: string, note: NoteState) => {
//       const internalNoteData = convertFromNoteState({ ...note, id: -1 }, trackId);
//       midiManager.addNoteToTrack(trackId, internalNoteData);
//     },
//     'addNoteToTrack'
//   );

//   const removeMidiNote = withMidiManager(
//     (midiManager, trackId: string, noteId: number) => {
//       midiManager.removeNoteFromTrack(trackId, noteId);
//     },
//     'removeNoteFromTrack'
//   );

//   const updateMidiNote = withMidiManager(
//     (midiManager, trackId: string, note: NoteState) => {
//       const internalNote = convertFromNoteState(note, trackId);
//       midiManager.updateNote(trackId, internalNote);
//     },
//     'updateNote'
//   );

//   // Get track notes using withMidiManager
//   const getTrackNotes = withMidiManager(
//     (midiManager, trackId: string) => midiManager.getTrackNotes(trackId),
//     'getTrackNotes'
//   );

//   // =================== SAMPLER ACTIONS ===================

//   // Helper for updating drum track's sampler references
//   const updateDrumTrackSamplers = (drumTrackId: string, operation: 'add' | 'remove', samplerIds: string[]) => {
//     const currentTracks = get().tracks;
//     const drumTrackIndex = currentTracks.findIndex(t => t.id === drumTrackId && t.type === 'drum');
    
//     if (drumTrackIndex === -1) {
//       return null;
//     }
    
//     const drumTrack = currentTracks[drumTrackIndex] as any;
//     const currentSamplerIds = drumTrack.samplerTrackIds || [];
    
//     // Apply the operation to the sampler IDs
//     const updatedSamplerIds = operation === 'add'
//       ? [...currentSamplerIds, ...samplerIds]
//       : currentSamplerIds.filter(id => !samplerIds.includes(id));
    
//     // Create updated drum track
//     const updatedDrumTrack = {
//       ...drumTrack,
//       samplerTrackIds: updatedSamplerIds,
//     };
    
//     // Update tracks array
//     const finalTracks = [...currentTracks];
//     finalTracks[drumTrackIndex] = updatedDrumTrack;
//     updateTracks(finalTracks);
    
//     return updatedDrumTrack;
//   };

//   // Add sampler to drum track
//   const addSamplerToDrumTrack = withErrorHandling(async (drumTrackId: string, file: File) => {
//     // Create sampler track from file
//     const newSamplerTrack = await uploadAudioFile(file, true);
//     if (!newSamplerTrack) {
//       throw new Error("Failed to create sampler track from audio file");
//     }
    
//     // Add reference to drum track
//     const result = updateDrumTrackSamplers(drumTrackId, 'add', [newSamplerTrack.id]);
//     if (!result) {
//       throw new Error(`Drum track ${drumTrackId} not found.`);
//     }
    
//     return newSamplerTrack;
//   }, 'addSamplerToDrumTrack');

//   // Remove sampler from drum track
//   const removeSamplerFromDrumTrack = withErrorHandling(async (drumTrackId: string, samplerTrackIdToDelete: string) => {
//     // Delete the actual sampler track
//     await handleTrackDelete(samplerTrackIdToDelete);
    
//     // Remove reference from drum track
//     const result = updateDrumTrackSamplers(drumTrackId, 'remove', [samplerTrackIdToDelete]);
//     if (!result) {
//       console.warn(`Drum track ${drumTrackId} not found after deleting sampler. Cannot unlink.`);
//     }
//   }, 'removeSamplerFromDrumTrack');

//   // Add empty sampler to drum track
//   const addEmptySamplerToDrumTrack = withErrorHandling(async (drumTrackId: string, newSamplerName?: string) => {
//     const { tracks } = get();
    
//     // Create empty sampler track
//     const samplerCount = tracks.filter(t => t.type === 'sampler').length;
//     const defaultName = newSamplerName || `Sampler ${samplerCount + 1}`;
    
//     const samplerTrack = await createSamplerTrack({ name: defaultName });
//     if (!samplerTrack) {
//       throw new Error("Failed to create empty sampler track");
//     }
    
//     // Add reference to drum track
//     const result = updateDrumTrackSamplers(drumTrackId, 'add', [samplerTrack.id]);
//     if (!result) {
//       console.warn(`Drum track ${drumTrackId} not found. Rolling back sampler creation.`);
//       await handleTrackDelete(samplerTrack.id);
//       return null;
//     }
    
//     return samplerTrack.id;
//   }, 'addEmptySamplerToDrumTrack');

//   // Download sampler track
//   const downloadSamplerTrack = withErrorHandling(async (trackId: string) => {
//     const track = findTrackById(trackId);
    
//     if (!track || track.type !== 'sampler') {
//       throw new Error(`Track ${trackId} is not a valid sampler track`);
//     }
    
//     const samplerTrack = track as SamplerTrackBase;
//     const trackName = samplerTrack.name || "Sampler Track";
//     let audioBlob: Blob | undefined;
    
//     if ((samplerTrack as any).audioStorageKey) {
//       try {
//         audioBlob = await downloadFile((samplerTrack as any).audioStorageKey);
//       } catch (error) {
//         console.error(`Failed to download audio for sampler track:`, error);
//       }
//     }
    
//     return { audioBlob, trackName };
//   }, 'downloadSamplerTrack');

//   // =================== TRANSPORT SLICE ===================

//   // Consolidated playback command handler
//   const handlePlaybackCommand = withErrorHandling(async (command: PlaybackCommand, arg?: any) => {
//     const { store, isPlaying } = get();
//     const transport = store.getTransport();
    
//     const commands = {
//       play: async () => {
//         if (!isPlaying) {
//           await transport.play();
//           updateState('isPlaying', true);
//         }
//       },
//       pause: () => {
//         if (isPlaying) {
//           transport.pause();
//           updateState('isPlaying', false);
//         }
//       },
//       stop: async () => {
//         await transport.stop();
//         updateState('isPlaying', false);
//         updateState('currentTime', 0);
//       },
//       seek: () => {
//         transport.setPosition(arg);
//         updateState('currentTime', arg);
//       }
//     };
    
//     const action = commands[command];
//     if (action) {
//       await action();
//     } else {
//       console.error(`Unknown playback command: ${command}`);
//     }
//   }, 'handlePlaybackCommand');

//   // =================== STATE ===================
  
//   // Return the store object with combined slices
//   return {
//     // Core state
//     store: new Store(),
//     isInitialized: false,
//     isPlaying: false,
//     currentTime: 0,
//     projectTitle: "Untitled Project",
//     bpm: 120,
//     timeSignature: [4, 4],
//     keySignature: "C major",
//     tracks: [],
    
//     // UI state
//     zoomLevel: 1,
//     measureCount: 40,
//     canUndo: false,
//     canRedo: false,
//     addMenuAnchor: null,
//     openDrumMachines: {},
    
//     // Expose utility functions
//     executeHistoryAction,
//     findTrackById,
//     updateTrackState,
//     updateTrack,
//     updateTracks,
//     updateState,
    
//     // Generic state setters - using updateState for consistency and simplicity
//     setStore: store => updateState('store', store),
//     setIsInitialized: isInitialized => updateState('isInitialized', isInitialized),
//     setIsPlaying: isPlaying => updateState('isPlaying', isPlaying),
//     setCurrentTime: currentTime => updateState('currentTime', currentTime),
//     setProjectTitle: projectTitle => handleProjectParamChange('projectTitle', projectTitle),
//     setBpm: bpm => handleProjectParamChange('bpm', bpm),
//     setTimeSignature: (numerator, denominator) => 
//       handleProjectParamChange('timeSignature', [numerator, denominator] as [number, number]),
//     setKeySignature: keySignature => handleProjectParamChange('keySignature', keySignature),
//     setTracks: tracks => { updateState('tracks', tracks); get().updateTrackIndices(); },
//     setZoomLevel: zoomLevel => updateState('zoomLevel', zoomLevel),
//     setMeasureCount: measureCount => updateState('measureCount', measureCount),
//     setCanUndo: canUndo => updateState('canUndo', canUndo),
//     setCanRedo: canRedo => updateState('canRedo', canRedo),
//     setAddMenuAnchor: addMenuAnchor => updateState('addMenuAnchor', addMenuAnchor),
    
//     // Track creation functions
//     createAudioTrack,
//     createMidiTrack,
//     createDrumTrack,
//     createSamplerTrack,
    
//     // Drum UI actions
//     openDrumMachine: (trackId) => updateState('openDrumMachines', 
//       prev => ({ ...prev, [trackId]: true })),
    
//     closeDrumMachine: (trackId) => updateState('openDrumMachines', 
//       prev => ({ ...prev, [trackId]: false })),
    
//     setDrumPattern: (trackId, pattern) => handleTrackOperation({
//       type: 'update',
//       trackId,
//       updates: { drumPattern: pattern }
//     }),
    
//     // Core actions
//     initializeAudio,
//     loadProject,
    
//     // Track operations with direct audio engine updates
//     handleTrackOperation,
//     handleTrackParameterChange,
    
//     // Volume change handler with direct audio engine update
//     handleTrackVolumeChange: (trackId, volume) => withStore((store) => {
//       // Update UI state
//       updateTrackState(trackId, { volume });
//       // Update audio engine
//       store.getAudioEngine().setTrackVolume(trackId, volume);
//       // Create history action
//       const track = findTrackById(trackId);
//       if (track) {
//         const action = new Actions.ParameterChange(
//           store, trackId, 'volume', track.volume, volume
//         );
//         executeHistoryAction(action);
//       }
//     }),
    
//     // Pan change handler with direct audio engine update
//     handleTrackPanChange: (trackId, pan) => withStore((store) => {
//       // Update UI state
//       updateTrackState(trackId, { pan });
//       // Update audio engine
//       store.getAudioEngine().setTrackPan(trackId, pan);
//       // Create history action
//       const track = findTrackById(trackId);
//       if (track) {
//         const action = new Actions.ParameterChange(
//           store, trackId, 'pan', track.pan, pan
//         );
//         executeHistoryAction(action);
//       }
//     }),
    
//     // Mute toggle handler with direct audio engine update
//     handleTrackMuteToggle: (trackId, muted) => withStore((store) => {
//       // Update UI state
//       updateTrackState(trackId, { muted, mute: muted });
//       // Update audio engine
//       store.getAudioEngine().setTrackMute(trackId, muted);
//       // Create history action
//       const track = findTrackById(trackId);
//       if (track) {
//         const oldValue = track.muted ? 1 : 0;
//         const newValue = muted ? 1 : 0;
//         const action = new Actions.ParameterChange(
//           store, trackId, 'muted', oldValue, newValue
//         );
//         executeHistoryAction(action);
//       }
//     }),
    
//     // Solo toggle handler
//     handleTrackSoloToggle: (trackId, soloed) => withStore((store) => {
//       // 1. Update the soloed state for the target track
//       updateTrackState(trackId, { solo: soloed });
      
//       // 2. Get the updated tracks with the new solo state
//       const updatedTracks = get().tracks;
//       const audioEngine = store.getAudioEngine();
      
//       // 3. Process mute state for all tracks based on solo status
//       for (const track of updatedTracks) {
//         const shouldBeMuted = soloed ? (track.id !== trackId) : track.mute;
        
//         // Update track state in UI
//         updateTrackState(track.id, { mute: shouldBeMuted });
        
//         // Update audio engine directly
//         audioEngine.setTrackMute(track.id, shouldBeMuted);
        
//         // Create history action for each track
//         const action = new Actions.ParameterChange(
//           store,
//           track.id,
//           'muted',
//           track.mute ? 1 : 0,
//           shouldBeMuted ? 1 : 0
//         );
//         executeHistoryAction(action);
//       }
//     }),
    
//     // Track operations
//     handleTrackDelete,
//     handleAddTrack,
//     handleInstrumentChange,
//     uploadAudioFile,
//     replaceTrackAudioFile,
    
//     // Position change handler - DIRECT IMPLEMENTATION (no withStore wrapper)
//     handleTrackPositionChange: (trackId, newPosition, isDragEnd) => {
//       // Get store state directly
//       const { store, bpm, timeSignature, isPlaying } = get();
//       if (!store) {
//         console.error('Store not available in handleTrackPositionChange');
//         return;
//       }
      
//       // Get track directly
//       const track = findTrackById(trackId);
//       if (!track) {
//         console.error(`Track ${trackId} not found in handleTrackPositionChange`);
//         return;
//       }
      
//       // Skip if nothing changed at drag end (exact match check)
//       if (isDragEnd && 
//           track.position?.x === newPosition.x && 
//           track.position?.y === newPosition.y) {
//         console.log('No position change detected - skipping update');
//         return;
//       }
      
//       console.log(`Store processing position change: trackId=${trackId}, isDragEnd=${isDragEnd}`, 
//         { newPosition, oldPosition: track.position });
      
//       // 1. Update UI state with direct set to avoid withStore wrapper issues
//       set(state => ({
//         tracks: state.tracks.map(t => t.id === trackId ? {
//           ...t,
//           position: { ...newPosition },
//           x_position: newPosition.x,
//           y_position: newPosition.y
//         } : t)
//       }));
      
//       // 2. Update audio engine (with pixels)
//       const pixelX = ticksToPixels(newPosition.x, bpm, timeSignature || [4, 4]);
//       store.getAudioEngine().setTrackPosition(trackId, pixelX, newPosition.y);
      
//       // 3. Create history entry only when drag is complete
//       if (isDragEnd) {
//         // Create history action
//         const action = new Actions.TrackPosition(
//           store,
//           trackId,
//           { ...(track.position as Position) },
//           { ...newPosition }
//         );
//         executeHistoryAction(action);
        
//         // Update playback if needed 
//         if (isPlaying && store.getTransport().handleTrackPositionChange) {
//           store.getTransport().handleTrackPositionChange(trackId, pixelX);
//         }
//       }
//     },
    
//     handleTrackNameChange: (trackId, name) => 
//       handleTrackParameterChange(trackId, 'name', name),
    
//     // MIDI note actions
//     addMidiNote,
//     removeMidiNote,
//     updateMidiNote,
//     getTrackNotes,
    
//     // Sampler actions
//     addSamplerToDrumTrack,
//     removeSamplerFromDrumTrack,
//     addEmptySamplerToDrumTrack,
//     downloadSamplerTrack,
    
//     // Transport actions
//     handlePlaybackCommand,
//     playPause: async () => {
//       const { isPlaying } = get();
//       return handlePlaybackCommand(isPlaying ? 'pause' : 'play');
//     },
//     stop: () => handlePlaybackCommand('stop'),
//     seekToPosition: (position) => handlePlaybackCommand('seek', position),
    
//     // History actions
//     undo: async () => {
//       if (historyManager.canUndo()) {
//         await historyManager.undo();
//         updateState('canUndo', historyManager.canUndo());
//         updateState('canRedo', true);
//       }
//     },
    
//     redo: async () => {
//       if (historyManager.canRedo()) {
//         await historyManager.redo();
//         updateState('canUndo', true);
//         updateState('canRedo', historyManager.canRedo());
//       }
//     },
    
//     // Track organization
//     updateTrackIndices: () => {
//       updateState('tracks', tracks => 
//         tracks.map((track, index) => ({
//           ...track,
//           index
//         }))
//       );
//     },
//   };
// };

// // Create the store
// export const useStudioStore = create<StudioState>(createStudioStore);