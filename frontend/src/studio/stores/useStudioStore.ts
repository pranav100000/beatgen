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
// import { AudioTrackRead, MidiTrackRead, SamplerTrackRead } from 'src/platform/types/project';
// import { Position } from '../components/track';
// import { CombinedTrack } from 'src/platform/types/project';
// import { SamplerTrackBase } from 'src/platform/types/track_models/sampler_track';
// import { Action } from '../core/state/history/actions/BaseAction';
// import { 
//   TrackParameter,
//   TrackType,
//   TrackOperation,
//   ProjectParam,
//   PlaybackCommand,
//   BaseTrackOptions,
//   AudioTrackOptions,
//   MidiTrackOptions,
//   DrumTrackOptions,
//   SamplerTrackOptions,
//   TrackOptions
// } from './types'; // Import the moved types
// import { MidiTrack } from 'src/platform/types/track_models/midi_track';

// // =================== TYPE DEFINITIONS ===================

// // --- Types moved to ./types.ts ---


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
    
//     // Update track state
//     //updateTrackState(trackId, { _calculatedWidth: calculatedWidth });
    
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

//     // Initialize the track in the store
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

//   // =================== TRACKS SLICE ===================

//   // Enhanced sampler initialization that uses the config system
//   const initializeSampler = withStore(async (
//     store, 
//     trackId: string, 
//     file?: File, 
//     options = {}
//   ) => {
//     try {
//       const samplerController = store.getTransport().getSamplerController();
//       const midiManager = store.getMidiManager();
      
//       if (!samplerController || !midiManager) {
//         console.warn('SamplerController or MidiManager not available');
//         return false;
//       }
      
//       // Find the sampler track to get custom parameters if available
//       const track = findTrackById(trackId);
//       const baseMidiNote = options.baseMidiNote || track?.baseMidiNote || DEFAULT_SAMPLER_CONFIG.baseMidiNote;
//       const grainSize = options.grainSize || track?.grainSize || DEFAULT_SAMPLER_CONFIG.grainSize;
//       const overlap = options.overlap || track?.overlap || DEFAULT_SAMPLER_CONFIG.overlap;
      
//       // Use the configuration system's initEngine function
//       await TRACK_CONFIG.sampler.initEngine(store, trackId, file);
      
//       // Register with MIDI manager
//       samplerController.registerTrackSubscription(trackId, midiManager);
      
//       return true;
//     } catch (error) {
//       console.error(`Failed to initialize sampler for track ${trackId}:`, error);
//       return false;
//     }
//   });

//   // Unified track creation with configuration-based initialization
//   const createTrackAndRegisterWithHistory = withStore(async (
//     store,
//     type: TrackType,
//     name: string,
//     options: Record<string, unknown> = {}
//   ) => {
//     try {
//       // Generate consistent IDs and position
//       const trackId = options.trackId as string || crypto.randomUUID();
//       const tracksLength = get().tracks.length;
//       const position = options.position as Position || { 
//         x: 0, 
//         y: tracksLength * GRID_CONSTANTS.trackHeight 
//       };
      
//       // Common track properties
//       const trackProps = {
//         id: trackId,
//         volume: options.volume ?? 80,
//         pan: options.pan ?? 0,
//         muted: options.muted ?? false,
//         soloed: options.soloed ?? false,
//         instrumentId: options.instrumentId,
//         instrumentName: options.instrumentName,
//         instrumentStorageKey: options.instrumentStorageKey,
//       };
      
//       // Get configuration for this track type
//       const typeConfig = TRACK_CONFIG[type];
      
//       // Step 1: Create track in core store
//       const newTrack = await store.createTrack(name, type, tracksLength, trackProps);
//       if (newTrack.id !== trackId) newTrack.id = trackId;
      
//       // Step 2: Create audio engine representation
//       await store.getAudioEngine().createTrack(newTrack.id, newTrack.name);
      
//       // Step 3: Calculate common dimensions
//       const beatsPerBar = get().timeSignature[0];
//       const defaultBars = 4;
//       const totalBeats = defaultBars * beatsPerBar;
//       const defaultDuration = (totalBeats * 60) / get().bpm;
      
//       // Step 4: Build track data object
//       const trackData: CombinedTrack = {
//         id: trackId,
//         name: newTrack.name,
//         type: type,
//         volume: trackProps.volume,
//         pan: trackProps.pan,
//         mute: trackProps.muted,
//         x_position: position.x,
//         y_position: position.y,
//         trim_start_ticks: options.trim_start_ticks as number,
//         trim_end_ticks: options.trim_end_ticks as number,
//         duration_ticks: options.duration as number ?? defaultDuration,
//         track: { id: trackId, name: newTrack.name, type },
//         position,
//       };
      
//       // Step 5: Add type-specific properties from configuration
//       const file = type === 'audio' ? options.audioFile as File : options.sampleFile as File;
//       const typeSpecificProps = typeConfig.initTrack(trackId, file);
//       Object.assign(trackData, typeSpecificProps);
      
//       // Step 6: Override with any provided options
//       if (type === 'sampler') {
//         ['baseMidiNote', 'grainSize', 'overlap'].forEach(prop => {
//           if (options[prop] !== undefined) (trackData as any)[prop] = options[prop];
//         });
//       }
//       else if (type === 'drum' && options.samplerTrackIds) {
//         (trackData as any).samplerTrackIds = options.samplerTrackIds;
//       }
      
//       // Step 7: Add DB ID if available
//       if (type === 'midi') {
//         const midiData = {} as MidiTrack;
//         midiData.id = trackId;
//         midiData.name = newTrack.name;
//         midiData.type = type;
//         midiData.instrument_id = options.instrumentId as string;
//         trackData.track = midiData;
//       }
      
//       // Step 8: Set track position
//       store.getAudioEngine().setTrackPosition(trackData.id, position.x, position.y);
      
//       // Step 9: Initialize engine with file if needed
//       await typeConfig.initEngine(store, trackId, file, options.instrumentId as string);
      
//       // Step 10: Create history action and update indices
//       const action = new Actions.AddTrack(store, trackData);
//       await executeHistoryAction(action);
//       get().updateTrackIndices();
      
//       return trackData;
//     } catch (error) {
//       console.error(`Failed to create ${type} track:`, error);
//       return null;
//     }
//   });

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
//       case 'create':
//         return createTrackAndRegisterWithHistory(
//           operation.trackType,
//           operation.name,
//           operation.options as Record<string, unknown> || {}
//         );
      
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

//   // Upload audio file - using track configuration system
//   const uploadAudioFile = withErrorHandling(async (file: File, isSampler = false) => {
//     // Get base filename as track name
//     const trackName = file.name.split('.')[0];
//     const trackType = isSampler ? 'sampler' : 'audio';
    
//     // Create options based on track type
//     const fileKey = trackType === 'audio' ? 'audioFile' : 'sampleFile';
//     const trackOptions = { 
//       [fileKey]: file,
//       ...(isSampler ? DEFAULT_SAMPLER_CONFIG : {})
//     };
    
//     // Create track using the unified system
//     const newTrack = await createTrackAndRegisterWithHistory(
//       trackType,
//       trackName,
//       trackOptions
//     );
    
//     if (!newTrack) {
//       throw new Error(`Failed to create ${trackType} track`);
//     }
    
//     return newTrack;
//   }, 'uploadAudioFile');

//   // Replace track audio file - simplified
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
//       updates.audioFile = file;
//     } else {
//       updates.sampleFile = file;
      
//       // Re-initialize sampler
//       await initializeSampler(trackId, file, {
//         baseMidiNote: track.baseMidiNote,
//         grainSize: track.grainSize,
//         overlap: track.overlap
//       });
//     }
    
//     // Update track state
//     updateTrackState(trackId, updates);
//   }, 'replaceTrackAudioFile');

//   // Delete track - simplified
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
//         createTrackAndRegisterWithHistory('sampler', name, { instrumentName: 'Default Sampler' })
//       );
      
//       // Execute in parallel for better performance
//       const createdSamplerTracks = (await Promise.all(samplerPromises)).filter(Boolean);
//       const samplerTrackIds = createdSamplerTracks.map(track => track.id);
      
//       // Create main drum track with references to samplers
//       const count = get().tracks.length + 1;
//       const mainDrumTrackName = TRACK_CONFIG.drum.getDefaultName(count, instrumentName);
      
//       const mainDrumTrack = await createTrackAndRegisterWithHistory('drum', mainDrumTrackName, {
//         instrumentName: 'Drum Sequencer',
//         samplerTrackIds: samplerTrackIds
//       });
      
//       // Open UI for the main drum track
//       if (mainDrumTrack) {
//         get().openDrumMachine(mainDrumTrack.id);
//       }
      
//       return { mainDrumTrack, samplerTracks: createdSamplerTracks };
//     }
    
//     // Create standard track using the configuration system
//     const count = get().tracks.length + 1;
//     const trackName = TRACK_CONFIG[type].getDefaultName(count, instrumentName);
    
//     const trackData = await createTrackAndRegisterWithHistory(type, trackName, {
//       instrumentId,
//       instrumentName,
//       instrumentStorageKey
//     });
    
//     return trackData;
//   }, 'handleAddTrack');

//   // Handle instrument change - using configuration system
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
//       await TRACK_CONFIG.midi.initEngine(store, trackId, undefined, instrumentId);
//     } else {
//       await store.connectTrackToSoundfont(trackId, instrumentId);
//     }
//   }, 'handleInstrumentChange');

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
//   }, 'addSamplerToDrumTrack');
// }
// // import { create } from 'zustand';
// // import * as Tone from 'tone';
// // import { Store } from '../core/state/store';
// // import { AudioTrack, AudioTrack as EngineAudioTrack } from '../core/audio-engine/audioEngine';
// // import { calculateTrackWidth, GRID_CONSTANTS, ticksToPixels } from '../constants/gridConstants';
// // import { historyManager } from '../core/state/history/HistoryManager';
// // import { getProject, Project } from '../../platform/api/projects';
// // import { downloadFile } from '../../platform/api/sounds';
// // import { Actions } from '../core/state/history/actions';
// // import { NoteState } from '../components/drum-machine/DrumMachine';
// // import { convertJsonToNotes, Note } from '../../types/note';
// // import { convertFromNoteState, PULSES_PER_QUARTER_NOTE } from '../utils/noteConversion';
// // import { AudioTrackRead, MidiTrackRead, SamplerTrackRead } from 'src/platform/types/project';
// // import { Position } from '../components/track';
// // import { CombinedTrack } from 'src/platform/types/project';
// // import { SamplerTrackBase } from 'src/platform/types/track_models/sampler_track';
// // import { Action } from '../core/state/history/actions/BaseAction';

// // // =================== TYPE DEFINITIONS ===================

// // type TrackParameter = {
// //   volume: number;
// //   pan: number;
// //   muted: boolean;
// //   soloed: boolean;
// //   name: string;
// //   position: Position;
// // };

// // type TrackType = 'audio' | 'midi' | 'drum' | 'sampler';

// // type TrackOperation = 
// //   | { type: 'create', trackType: TrackType, name: string, options?: Record<string, unknown> }
// //   | { type: 'update', trackId: string, updates: Partial<CombinedTrack> }
// //   | { type: 'delete', trackId: string }
// //   | { type: 'param_change', trackId: string, param: keyof TrackParameter, value: any };

// // type ProjectParam = 'projectTitle' | 'bpm' | 'timeSignature' | 'keySignature';

// // type PlaybackCommand = 'play' | 'pause' | 'stop' | 'seek';

// // // Track creation options for each track type
// // interface BaseTrackOptions {
// //   id?: string;
// //   name?: string;
// //   position?: Position;
// //   volume?: number;
// //   pan?: number;
// //   muted?: boolean;
// //   soloed?: boolean;
// //   trim_start_ticks?: number;
// //   trim_end_ticks?: number;
// //   duration?: number;
// // }

// // interface AudioTrackOptions extends BaseTrackOptions {
// //   audioFile?: File;
// //   url?: string;
// //   storage_key?: string;
// // }

// // interface MidiTrackOptions extends BaseTrackOptions {
// //   instrumentId?: string;
// //   instrumentName?: string;
// //   instrumentStorageKey?: string;
// //   midiNotes?: any[];
// // }

// // interface DrumTrackOptions extends BaseTrackOptions {
// //   samplerTrackIds?: string[];
// //   pattern?: boolean[][];
// // }

// // interface SamplerTrackOptions extends BaseTrackOptions {
// //   sampleFile?: File;
// //   baseMidiNote?: number;
// //   grainSize?: number;
// //   overlap?: number;
// //   midiNotes?: any[];
// // }

// // // Unified options type
// // type TrackOptions = AudioTrackOptions | MidiTrackOptions | DrumTrackOptions | SamplerTrackOptions;

// // // Enhanced Studio State Interface
// // interface StudioState {
// //   // Core state
// //   store: Store | null;
// //   isInitialized: boolean;
// //   isPlaying: boolean;
// //   currentTime: number;
  
// //   // Project settings
// //   projectTitle: string;
// //   bpm: number;
// //   timeSignature: [number, number];
// //   keySignature: string;
// //   tracks: CombinedTrack[];
  
// //   // UI state
// //   zoomLevel: number;
// //   measureCount: number;
// //   canUndo: boolean;
// //   canRedo: boolean;
// //   addMenuAnchor: HTMLElement | null;
// //   openDrumMachines: Record<string, boolean>; 
  
// //   // Core actions
// //   initializeAudio: () => Promise<void>;
// //   loadProject: (projectId: string) => Promise<Project>;
// //   executeHistoryAction: (action: unknown) => Promise<void>;
// //   findTrackById: (trackId: string) => CombinedTrack | undefined;
// //   updateTrackState: (trackId: string, updates: Partial<CombinedTrack>) => void;
// //   updateTrack: (updatedTrack: CombinedTrack) => void;
// //   updateTracks: (newTracks: CombinedTrack[]) => void;
  
// //   // Generic state updater
// //   updateState: <K extends keyof StudioState>(
// //     key: K, 
// //     value: StudioState[K] | ((prev: StudioState[K]) => StudioState[K])
// //   ) => void;
  
// //   // State setters (kept for backward compatibility)
// //   setStore: (store: Store) => void;
// //   setIsInitialized: (isInitialized: boolean) => void;
// //   setIsPlaying: (isPlaying: boolean) => void;
// //   setCurrentTime: (time: number) => void;
// //   setProjectTitle: (title: string) => void;
// //   setBpm: (bpm: number) => void;
// //   setTimeSignature: (numerator: number, denominator: number) => void;
// //   setKeySignature: (keySignature: string) => void;
// //   setTracks: (tracks: CombinedTrack[]) => void;
// //   setZoomLevel: (zoomLevel: number) => void;
// //   setMeasureCount: (measureCount: number) => void;
// //   setCanUndo: (canUndo: boolean) => void;
// //   setCanRedo: (canRedo: boolean) => void;
// //   setAddMenuAnchor: (el: HTMLElement | null) => void;
  
// //   // Track operations - generic
// //   handleTrackOperation: (operation: TrackOperation) => Promise<any>;
// //   handleTrackParameterChange: <K extends keyof TrackParameter>(trackId: string, paramName: K, newValue: TrackParameter[K]) => void;
// //   handleTrackVolumeChange: (trackId: string, volume: number) => void;
// //   handleTrackPanChange: (trackId: string, pan: number) => void;
// //   handleTrackMuteToggle: (trackId: string, muted: boolean) => void;
// //   handleTrackSoloToggle: (trackId: string, soloed: boolean) => void;
// //   handleTrackDelete: (trackId: string) => Promise<void>;
// //   handleTrackPositionChange: (trackId: string, newPosition: Position, isDragEnd: boolean) => void;
// //   handleTrackNameChange: (trackId: string, name: string) => void;
  
// //   // Track operations - specialized by type
  
// //   // Audio tracks
// //   createAudioTrack: (options: AudioTrackOptions) => Promise<CombinedTrack | null>;
// //   uploadAudioFile: (file: File, isSampler?: boolean) => Promise<CombinedTrack | null>;
// //   replaceTrackAudioFile: (trackId: string, file: File) => Promise<void>;
  
// //   // MIDI tracks
// //   createMidiTrack: (options: MidiTrackOptions) => Promise<CombinedTrack | null>;
// //   handleInstrumentChange: (trackId: string, instrumentId: string, instrumentName: string, instrumentStorageKey: string) => void;
// //   addMidiNote: (trackId: string, note: NoteState) => void;
// //   removeMidiNote: (trackId: string, noteId: number) => void;
// //   updateMidiNote: (trackId: string, note: NoteState) => void;
// //   getTrackNotes: (trackId: string) => Note[] | null;
  
// //   // Drum tracks
// //   createDrumTrack: (options: DrumTrackOptions) => Promise<CombinedTrack | null>; 
// //   openDrumMachine: (drumTrackId: string) => void;
// //   closeDrumMachine: (trackId: string) => void;
// //   setDrumPattern: (trackId: string, pattern: boolean[][]) => void;
  
// //   // Sampler tracks
// //   createSamplerTrack: (options: SamplerTrackOptions) => Promise<CombinedTrack | null>;
// //   addSamplerToDrumTrack: (drumTrackId: string, file: File) => Promise<void>;
// //   removeSamplerFromDrumTrack: (drumTrackId: string, samplerTrackIdToDelete: string) => Promise<void>;
// //   addEmptySamplerToDrumTrack: (drumTrackId: string, newSamplerName?: string) => Promise<string | null>;
// //   downloadSamplerTrack: (trackId: string) => Promise<{audioBlob?: Blob, midiBlob?: Blob, trackName: string}>;
  
// //   // Backward compatibility
// //   handleAddTrack: (type: TrackType, instrumentId?: string, instrumentName?: string, instrumentStorageKey?: string) => Promise<any>;
  
// //   // Transport actions
// //   handlePlaybackCommand: (command: PlaybackCommand, arg?: any) => Promise<void>;
// //   playPause: () => Promise<void>;
// //   stop: () => Promise<void>;
// //   seekToPosition: (position: number) => void;
  
// //   // History actions
// //   undo: () => Promise<void>;
// //   redo: () => Promise<void>;
// //   updateTrackIndices: () => void;
// // }

// // // =================== CONFIGURATION ===================

// // // Default configuration for samplers
// // const DEFAULT_SAMPLER_CONFIG = {
// //   baseMidiNote: 60,
// //   grainSize: 0.1,
// //   overlap: 0.1
// // };

// // // Track type-specific configurations with unified interface
// // const TRACK_CONFIG = {
// //   audio: {
// //     getDefaultName: (count: number, instrumentName?: string) => instrumentName || `Audio Track ${count}`,
// //     initTrack: (id: string, file?: File) => ({ type: 'audio' as const, audioFile: file }),
// //     initEngine: async (store: Store, trackId: string, file?: File) => file ? store.loadAudioFile(trackId, file) : Promise.resolve(),
// //   },
// //   midi: {
// //     getDefaultName: (count: number, instrumentName?: string) => instrumentName || `MIDI Track ${count}`,
// //     initTrack: (id: string) => ({ type: 'midi' as const }),
// //     initEngine: async (store: Store, trackId: string, _?: File, instrumentId?: string) => 
// //       instrumentId ? store.connectTrackToSoundfont(trackId, instrumentId) : Promise.resolve(),
// //   },
// //   drum: {
// //     getDefaultName: (count: number, instrumentName?: string) => instrumentName || `Drum Sequencer ${count}`,
// //     initTrack: (id: string) => ({ 
// //       type: 'drum' as const, 
// //       drumPattern: Array(4).fill(null).map(() => Array(64).fill(false)) 
// //     }),
// //     initEngine: async () => Promise.resolve(),
// //   },
// //   sampler: {
// //     getDefaultName: (count: number, instrumentName?: string) => instrumentName || `Sampler ${count}`,
// //     initTrack: (id: string, file?: File) => ({ 
// //       type: 'sampler' as const, 
// //       sampleFile: file,
// //       baseMidiNote: DEFAULT_SAMPLER_CONFIG.baseMidiNote,
// //       grainSize: DEFAULT_SAMPLER_CONFIG.grainSize,
// //       overlap: DEFAULT_SAMPLER_CONFIG.overlap
// //     }),
// //     initEngine: async (store: Store, trackId: string, file?: File) => {
// //       const samplerController = store.getTransport().getSamplerController();
// //       if (!samplerController) return Promise.resolve();
      
// //       return samplerController.connectTrackToSampler(
// //         trackId,
// //         file,
// //         store.getMidiManager(),
// //         DEFAULT_SAMPLER_CONFIG.baseMidiNote,
// //         DEFAULT_SAMPLER_CONFIG.grainSize,
// //         DEFAULT_SAMPLER_CONFIG.overlap
// //       );
// //     },
// //   }
// // };

// // // =================== STORE IMPLEMENTATION ===================

// // // Create the store with slice architecture
// // const createStudioStore = (set: any, get: any) => {
// //   // =================== UTILITY FUNCTIONS ===================

// //   // Higher-order function to ensure store is available
// //   const withStore = <T extends unknown[], R>(fn: (store: Store, ...args: T) => R) => 
// //     (...args: T): R | null => {
// //       const { store } = get();
// //       if (!store) {
// //         console.warn('Store not initialized');
// //         return null;
// //       }
// //       return fn(store, ...args);
// //     };

// //   // Error handling wrapper
// //   const withErrorHandling = <T extends unknown[], R>(
// //     fn: (...args: T) => Promise<R>, 
// //     actionName: string
// //   ) => async (...args: T): Promise<R | null> => {
// //     try {
// //       return await fn(...args);
// //     } catch (error) {
// //       console.error(`Error in ${actionName}:`, error);
// //       return null;
// //     }
// //   };

// //   // Generic state updater
// //   const updateState = <K extends keyof StudioState>(
// //     key: K, 
// //     value: StudioState[K] | ((prev: StudioState[K]) => StudioState[K])
// //   ) => {
// //     if (typeof value === 'function') {
// //       // @ts-ignore - function case
// //       set(state => ({ [key]: value(state[key]) }));
// //     } else {
// //       set({ [key]: value });
// //     }
// //   };

// //   // History state updater
// //   const updateHistoryState = () => {
// //     set({
// //       canUndo: historyManager.canUndo(),
// //       canRedo: historyManager.canRedo()
// //     });
// //   };

// //   // Execute a history action and update state
// //   const executeHistoryAction = async (action: Action) => {
// //     await historyManager.executeAction(action);
// //     updateHistoryState();
// //   };

// //   // Find a track by ID
// //   const findTrackById = (trackId: string) => {
// //     return get().tracks.find((t: CombinedTrack) => t.id === trackId);
// //   };

// //   // Update a specific track's state
// //   const updateTrackState = (trackId: string, updates: Partial<CombinedTrack>) => {
// //     updateState('tracks', tracks => 
// //       tracks.map((track: CombinedTrack) => 
// //         track.id === trackId ? { ...track, ...updates } : track
// //       )
// //     );
// //   };

// //   // Update all tracks and indices
// //   const updateTracks = (newTracks: CombinedTrack[]) => {
// //     set({ tracks: newTracks });
// //     get().updateTrackIndices();
// //   };

// //   // =================== CORE SLICE ===================

// //   // Update audio track with file data
// //   const updateTrackWithAudioInfo = withErrorHandling(async (trackId: string, file: File) => {
// //     const { store } = get();
    
// //     // Load audio file into engine
// //     await store.loadAudioFile(trackId, file);
    
// //     // Get updated engine track info
// //     const engineTrack = store.getAudioEngine().getAllTracks().find(t => t.id === trackId);
// //     if (!engineTrack?.player?.buffer) {
// //       throw new Error(`Failed to load audio for track ${trackId}`);
// //     }
    
// //     // Calculate track dimensions
// //     const duration = engineTrack.player.buffer.duration;
// //     const calculatedWidth = calculateTrackWidth(
// //       duration, 
// //       get().bpm, 
// //       get().timeSignature
// //     );
    
// //     // Update track state
// //     //updateTrackState(trackId, { _calculatedWidth: calculatedWidth });
    
// //     return engineTrack;
// //   }, 'updateTrackWithAudioInfo');

// //   // Initialize the audio engine with error handling
// //   const initializeAudio = withErrorHandling(async () => {
// //     const { store, projectTitle } = get();
    
// //     if (!store.projectManager.getCurrentProject()) {
// //       console.log('Creating a new project');
// //       const project = store.projectManager.createProject(projectTitle);
// //       console.log('Project created:', project);
// //     }
    
// //     await store.initializeAudio();
// //     set({ isInitialized: true });
    
// //     (window as any).storeInstance = store;
// //   }, 'initializeAudio');

// //   // =================== PROJECT SLICE ===================

// //   // Helper to handle project parameter changes
// //   const handleProjectParamChange = (param: ProjectParam, value: any) => {
// //     const { store } = get();
// //     if (!store) return;

// //     const oldValue = get()[param];
// //     if (oldValue === value) return;

// //     // Update UI state
// //     set({ [param]: value });

// //     // Update core engine state based on parameter type
// //     switch (param) {
// //       case 'projectTitle':
// //         if (store.projectManager.getCurrentProject()) {
// //           store.projectManager.setProjectName(value);
// //         }
// //         break;
// //       case 'bpm':
// //         store.projectManager.setTempo(value);
// //         Tone.Transport.bpm.value = value;
// //         store.getTransport().setTempo(value);
        
// //         const action = new Actions.BPMChange(
// //           store,
// //           oldValue,
// //           value,
// //           get().timeSignature
// //         );
// //         executeHistoryAction(action);
// //         break;
// //       case 'timeSignature':
// //         const [numerator, denominator] = value as [number, number];
// //         store.projectManager.setTimeSignature(numerator, denominator);
// //         Tone.Transport.timeSignature = value;
        
// //         const timeAction = new Actions.TimeSignature(
// //           store,
// //           oldValue as [number, number],
// //           value as [number, number],
// //           get().bpm
// //         );
// //         executeHistoryAction(timeAction);
// //         break;
// //       case 'keySignature':
// //         const keyAction = new Actions.KeySignature(
// //           store,
// //           oldValue as string,
// //           value as string
// //         );
// //         executeHistoryAction(keyAction);
// //         break;
// //     }
// //   };

// //   // Split project loading into components
// //   const fetchProjectData = withErrorHandling(async (projectId: string) => {
// //     const projectData = await getProject(projectId);
// //     console.log('Project data loaded:', projectData);
// //     return projectData;
// //   }, 'fetchProjectData');

// //   const initializeProjectSettings = withStore(async (store, projectData: Project) => {
// //     // Update UI state
// //     set({
// //       projectTitle: projectData.name,
// //       bpm: projectData.bpm,
// //       timeSignature: [
// //         projectData.time_signature_numerator,
// //         projectData.time_signature_denominator
// //       ],
// //       keySignature: projectData.key_signature
// //     });
    
// //     // Update core engine state
// //     const newProject = store.projectManager.createProject(projectData.name);
    
// //     store.projectManager.setTempo(projectData.bpm);
// //     store.projectManager.setTimeSignature(
// //       projectData.time_signature_numerator,
// //       projectData.time_signature_denominator
// //     );
    
// //     Tone.Transport.bpm.value = projectData.bpm;
// //     Tone.Transport.timeSignature = [
// //       projectData.time_signature_numerator,
// //       projectData.time_signature_denominator
// //     ];
    
// //     return newProject;
// //   });

// //   // Process a track from API response to local state
// //   const processTrack = withStore(async (store, apiTrack: any, index: number) => {
// //     // Extract track type and basic properties
// //     const trackType = apiTrack.type as TrackType;
// //     const trackConfig = TRACK_CONFIG[trackType];
// //     const position = {
// //       x: apiTrack.x_position ?? 0,
// //       y: apiTrack.y_position ?? (index * GRID_CONSTANTS.trackHeight)
// //     };
    
// //     // Create core track in store
// //     const trackProps = {
// //       id: apiTrack.id,
// //       volume: apiTrack.volume,
// //       pan: apiTrack.pan,
// //       muted: apiTrack.mute,
// //       soloed: false,
// //     };

// //     const combinedTrack: CombinedTrack = {
// //       id: apiTrack.id,
// //       name: apiTrack.name,
// //       type: trackType,
// //       volume: apiTrack.volume,
// //       pan: apiTrack.pan,
// //       mute: apiTrack.mute,
// //       x_position: position.x,
// //       y_position: position.y,
// //       trim_start_ticks: apiTrack.trim_start_ticks,
// //       trim_end_ticks: apiTrack.trim_end_ticks,
// //       duration_ticks: apiTrack.duration,
// //       track: apiTrack.track,
// //     }
    
// //     const newTrack = await store.createTrack(combinedTrack);
// //     await store.getAudioEngine().createTrack(newTrack.id, newTrack.name);
    
// //     // Set audio engine properties
// //     const audioEngine = store.getAudioEngine();
// //     audioEngine.setTrackVolume(newTrack.id, apiTrack.volume);
// //     audioEngine.setTrackPan(newTrack.id, apiTrack.pan);
// //     audioEngine.setTrackMute(newTrack.id, apiTrack.mute);
// //     audioEngine.setTrackPosition(newTrack.id, position.x, position.y);
    
// //     // Extract type-specific data and resources
// //     let audioFile = null, duration = null, instrumentId = null, instrumentStorageKey = null;
    
// //     // Get resource keys based on track type
// //     const typeData = {
// //       audio: () => {
// //         const track = apiTrack.track as AudioTrackRead;
// //         return { audioStorageKey: track.audio_file_storage_key, duration: track.audio_file_duration || 0 };
// //       },
// //       midi: () => {
// //         const track = apiTrack.track as MidiTrackRead;
// //         return { 
// //           instrumentStorageKey: track.instrument_file.storage_key,
// //           instrumentId: track.instrument_file.id,
// //           instrumentName: track.instrument_file.name,
// //           midiNotesJson: track.midi_notes_json
// //         };
// //       },
// //       drum: () => ({}),
// //       sampler: () => {
// //         const track = apiTrack.track as SamplerTrackRead;
// //         return { 
// //           audioStorageKey: track.audio_storage_key,
// //           midiNotesJson: track.midi_notes_json,
// //         };
// //       }
// //     };
    
// //     // Get type-specific data
// //     const resourceData = typeData[trackType]();

// //     // Initialize the track in the store
// //   });

// //   // Connect tracks to sound engines
// //   const connectTracksToEngines = withStore(async (store, tracks: any[]) => {
// //     for (const track of tracks) {
// //       if (track.type === 'midi') {
// //         try {
// //           await store.connectTrackToSoundfont(track.id, track.instrumentId);
// //         } catch (error) {
// //           console.error(`Failed to connect loaded track ${track.id} to soundfont:`, error);
// //         }
// //       }
      
// //       if (track.type === 'sampler') {
// //         try {
// //           const samplerController = store.getTransport().getSamplerController();
// //           if (samplerController) {
// //             if (track.sampleFile) {
// //               await samplerController.connectTrackToSampler(
// //                 track.id,
// //                 track.sampleFile,
// //                 store.getMidiManager(),
// //                 track.baseMidiNote || DEFAULT_SAMPLER_CONFIG.baseMidiNote,
// //                 track.grainSize || DEFAULT_SAMPLER_CONFIG.grainSize,
// //                 track.overlap || DEFAULT_SAMPLER_CONFIG.overlap
// //               );
// //             } else {
// //               await samplerController.initializeSampler(
// //                 track.id,
// //                 undefined,
// //                 track.baseMidiNote || DEFAULT_SAMPLER_CONFIG.baseMidiNote,
// //                 track.grainSize || DEFAULT_SAMPLER_CONFIG.grainSize,
// //                 track.overlap || DEFAULT_SAMPLER_CONFIG.overlap
// //               );
              
// //               samplerController.registerTrackSubscription(track.id, store.getMidiManager());
// //             }
// //           }
// //         } catch (error) {
// //           console.error(`Failed to connect loaded sampler track ${track.id}:`, error);
// //         }
// //       }
// //     }
// //   });

// //   // Optimized project loading flow
// //   const loadProject = withErrorHandling(async (projectId: string) => {
// //     // 1. Ensure audio is initialized
// //     const { store, isInitialized } = get();
// //     if (!store) throw new Error('Store not initialized');
    
// //     if (!isInitialized) {
// //       await store.initializeAudio();
// //       set({ isInitialized: true });
// //     }
    
// //     // 2. Fetch and initialize project data
// //     const projectData = await fetchProjectData(projectId);
// //     await initializeProjectSettings(projectData);
    
// //     // 3. Process all tracks in parallel 
// //     const trackStates = await Promise.all(
// //       projectData.tracks.map((track, index) => processTrack(track, index))
// //     );
// //     updateTracks(trackStates);
    
// //     // 4. Connect to audio engines
// //     await connectTracksToEngines(trackStates);
    
// //     // Store reference for debugging
// //     (window as any).loadedProjectId = projectId;
    
// //     return projectData;
// //   }, 'loadProject');

// //   // =================== TRACKS SLICE ===================

// //   // Enhanced sampler initialization that uses the config system
// //   const initializeSampler = withStore(async (
// //     store, 
// //     trackId: string, 
// //     file?: File, 
// //     options = {}
// //   ) => {
// //     try {
// //       const samplerController = store.getTransport().getSamplerController();
// //       const midiManager = store.getMidiManager();
      
// //       if (!samplerController || !midiManager) {
// //         console.warn('SamplerController or MidiManager not available');
// //         return false;
// //       }
      
// //       // Find the sampler track to get custom parameters if available
// //       const track = findTrackById(trackId);
// //       const baseMidiNote = options.baseMidiNote || track?.baseMidiNote || DEFAULT_SAMPLER_CONFIG.baseMidiNote;
// //       const grainSize = options.grainSize || track?.grainSize || DEFAULT_SAMPLER_CONFIG.grainSize;
// //       const overlap = options.overlap || track?.overlap || DEFAULT_SAMPLER_CONFIG.overlap;
      
// //       // Use the configuration system's initEngine function
// //       await TRACK_CONFIG.sampler.initEngine(store, trackId, file);
      
// //       // Register with MIDI manager
// //       samplerController.registerTrackSubscription(trackId, midiManager);
      
// //       return true;
// //     } catch (error) {
// //       console.error(`Failed to initialize sampler for track ${trackId}:`, error);
// //       return false;
// //     }
// //   });

// //   // Unified track creation with configuration-based initialization
// //   const createTrackAndRegisterWithHistory = withStore(async (
// //     store,
// //     type: TrackType,
// //     name: string,
// //     options: Record<string, unknown> = {}
// //   ) => {
// //     try {
// //       // Generate consistent IDs and position
// //       const trackId = options.trackId as string || crypto.randomUUID();
// //       const tracksLength = get().tracks.length;
// //       const position = options.position as Position || { 
// //         x: 0, 
// //         y: tracksLength * GRID_CONSTANTS.trackHeight 
// //       };
      
// //       // Common track properties
// //       const trackProps = {
// //         id: trackId,
// //         volume: options.volume ?? 80,
// //         pan: options.pan ?? 0,
// //         muted: options.muted ?? false,
// //         soloed: options.soloed ?? false,
// //         instrumentId: options.instrumentId,
// //         instrumentName: options.instrumentName,
// //         instrumentStorageKey: options.instrumentStorageKey,
// //       };
      
// //       // Get configuration for this track type
// //       const typeConfig = TRACK_CONFIG[type];
      
// //       // Step 1: Create track in core store
// //       const newTrack = await store.createTrack(name, type, tracksLength, trackProps);
// //       if (newTrack.id !== trackId) newTrack.id = trackId;
      
// //       // Step 2: Create audio engine representation
// //       await store.getAudioEngine().createTrack(newTrack.id, newTrack.name);
      
// //       // Step 3: Calculate common dimensions
// //       const beatsPerBar = get().timeSignature[0];
// //       const defaultBars = 4;
// //       const totalBeats = defaultBars * beatsPerBar;
// //       const defaultDuration = (totalBeats * 60) / get().bpm;
      
// //       // Step 4: Build track data object
// //       const trackData: CombinedTrack = {
// //         id: trackId,
// //         name: newTrack.name,
// //         type: type,
// //         volume: trackProps.volume,
// //         pan: trackProps.pan,
// //         mute: trackProps.muted,
// //         x_position: position.x,
// //         y_position: position.y,
// //         trim_start_ticks: options.trim_start_ticks as number,
// //         trim_end_ticks: options.trim_end_ticks as number,
// //         duration_ticks: options.duration as number ?? defaultDuration,
// //         track: { id: trackId, name: newTrack.name, type },
// //         position,
// //       };
      
// //       // Step 5: Add type-specific properties from configuration
// //       const file = type === 'audio' ? options.audioFile as File : options.sampleFile as File;
// //       const typeSpecificProps = typeConfig.initTrack(trackId, file);
// //       Object.assign(trackData, typeSpecificProps);
      
// //       // Step 6: Override with any provided options
// //       if (type === 'sampler') {
// //         ['baseMidiNote', 'grainSize', 'overlap'].forEach(prop => {
// //           if (options[prop] !== undefined) (trackData as any)[prop] = options[prop];
// //         });
// //       }
// //       else if (type === 'drum' && options.samplerTrackIds) {
// //         (trackData as any).samplerTrackIds = options.samplerTrackIds;
// //       }
      
// //       // Step 7: Add DB ID if available
// //       if ('dbId' in newTrack && typeof newTrack.dbId === 'string') {
// //         trackData.dbId = newTrack.dbId;
// //       }
      
// //       // Step 8: Set track position
// //       store.getAudioEngine().setTrackPosition(trackData.id, position.x, position.y);
      
// //       // Step 9: Initialize engine with file if needed
// //       await typeConfig.initEngine(store, trackId, file, options.instrumentId as string);
      
// //       // Step 10: Create history action and update indices
// //       const action = new Actions.AddTrack(store, trackData);
// //       await executeHistoryAction(action);
// //       get().updateTrackIndices();
      
// //       return trackData;
// //     } catch (error) {
// //       console.error(`Failed to create ${type} track:`, error);
// //       return null;
// //     }
// //   });

// //   // Generic parameter change handler optimized for all track parameters
// //   const handleTrackParameterChange = <K extends keyof TrackParameter>(
// //     trackId: string, 
// //     paramName: K, 
// //     newValue: TrackParameter[K]
// //   ) => withStore((store) => {
// //     const track = findTrackById(trackId);
// //     if (!track) {
// //       console.error(`Track with ID ${trackId} not found in handleTrackParameterChange`);
// //       return;
// //     }
    
// //     // Type assertion needed since CombinedTrack doesn't exactly match TrackParameter
// //     const oldValue = track[paramName as string];
// //     if (oldValue === newValue) return;
    
// //     // Create values for history action
// //     const oldActionValue = typeof oldValue === 'boolean' ? (oldValue ? 1 : 0) : oldValue;
// //     const newActionValue = typeof newValue === 'boolean' ? (newValue ? 1 : 0) : newValue;
    
// //     // Prepare update object with specialized handling for specific parameters
// //     const updateObj: Partial<CombinedTrack> = { [paramName]: newValue } as any;
    
// //     // Handle special cases with different property names
// //     if (paramName === 'muted') updateObj.mute = newValue as boolean;
// //     if (paramName === 'position') {
// //       const pos = newValue as Position;
// //       updateObj.x_position = pos.x;
// //       updateObj.y_position = pos.y;
// //     }
    
// //     // Update UI state with all necessary properties
// //     updateTrackState(trackId, updateObj);
    
// //     // Update audio engine based on parameter type
// //     const audioEngine = store.getAudioEngine();
// //     switch (paramName) {
// //       case 'volume':
// //         audioEngine.setTrackVolume(trackId, newValue as number);
// //         break;
// //       case 'pan':
// //         audioEngine.setTrackPan(trackId, newValue as number);
// //         break;
// //       case 'muted':
// //         audioEngine.setTrackMute(trackId, newValue as boolean);
// //         break;
// //       case 'position':
// //         const pos = newValue as Position;
// //         audioEngine.setTrackPosition(trackId, pos.x, pos.y);
// //         break;
// //     }
    
// //     // Create and execute history action
// //     const action = new Actions.ParameterChange(
// //       store,
// //       trackId,
// //       paramName as string,
// //       oldActionValue,
// //       newActionValue
// //     );
    
// //     executeHistoryAction(action);
// //   });

// //   // Enhanced track operation handler with audio engine updates
// //   const handleTrackOperation = withStore(async (store, operation: TrackOperation) => {
// //     switch (operation.type) {
// //       case 'create':
// //         return createTrackAndRegisterWithHistory(
// //           operation.trackType, 
// //           operation.name, 
// //           operation.options || {}
// //         );
      
// //       case 'update': {
// //         // First update UI state
// //         updateTrackState(operation.trackId, operation.updates);
        
// //         // Then update audio engine for relevant properties
// //         const audioEngine = store.getAudioEngine();
// //         const updates = operation.updates;
        
// //         if ('volume' in updates && typeof updates.volume === 'number') {
// //           audioEngine.setTrackVolume(operation.trackId, updates.volume);
// //         }
        
// //         if ('pan' in updates && typeof updates.pan === 'number') {
// //           audioEngine.setTrackPan(operation.trackId, updates.pan);
// //         }
        
// //         if ('mute' in updates || 'muted' in updates) {
// //           const muted = 'mute' in updates ? updates.mute : updates.muted;
// //           if (typeof muted === 'boolean') {
// //             audioEngine.setTrackMute(operation.trackId, muted);
// //           }
// //         }
        
// //         if ('position' in updates && updates.position) {
// //           const pos = updates.position as Position;
// //           audioEngine.setTrackPosition(operation.trackId, pos.x, pos.y);
// //         }
        
// //         return findTrackById(operation.trackId);
// //       }
      
// //       case 'delete':
// //         return get().handleTrackDelete(operation.trackId);
      
// //       case 'param_change':
// //         return handleTrackParameterChange(
// //           operation.trackId, 
// //           operation.param, 
// //           operation.value
// //         );
        
// //       default:
// //         console.error('Unknown track operation:', operation);
// //         return null;
// //     }
// //   });

// //   // Upload audio file - using track configuration system
// //   const uploadAudioFile = withErrorHandling(async (file: File, isSampler = false) => {
// //     // Get base filename as track name
// //     const trackName = file.name.split('.')[0];
// //     const trackType = isSampler ? 'sampler' : 'audio';
    
// //     // Create options based on track type
// //     const fileKey = trackType === 'audio' ? 'audioFile' : 'sampleFile';
// //     const trackOptions = { 
// //       [fileKey]: file,
// //       ...(isSampler ? DEFAULT_SAMPLER_CONFIG : {})
// //     };
    
// //     // Create track using the unified system
// //     const newTrack = await createTrackAndRegisterWithHistory(
// //       trackType,
// //       trackName,
// //       trackOptions
// //     );
    
// //     if (!newTrack) {
// //       throw new Error(`Failed to create ${trackType} track`);
// //     }
    
// //     return newTrack;
// //   }, 'uploadAudioFile');

// //   // Replace track audio file - simplified
// //   const replaceTrackAudioFile = withErrorHandling(async (trackId: string, file: File) => {
// //     const track = findTrackById(trackId);
    
// //     if (!track) {
// //       throw new Error(`Track ${trackId} not found`);
// //     }
    
// //     if (track.type !== 'audio' && track.type !== 'sampler') {
// //       throw new Error(`Cannot replace audio file for ${track.type} track`);
// //     }
    
// //     // Stop current playback if needed
// //     if (track.type === 'sampler') {
// //       const { store } = get();
// //       const sampler = store?.getTransport().getSamplerController()?.getSampler(trackId);
// //       if (sampler) sampler.stopPlayback();
// //     }
    
// //     // Load file and update track info
// //     await updateTrackWithAudioInfo(trackId, file);
    
// //     // Update track with new file reference
// //     const updates: Partial<CombinedTrack> = {};
    
// //     if (track.type === 'audio') {
// //       updates.audioFile = file;
// //     } else {
// //       updates.sampleFile = file;
      
// //       // Re-initialize sampler
// //       await initializeSampler(trackId, file, {
// //         baseMidiNote: track.baseMidiNote,
// //         grainSize: track.grainSize,
// //         overlap: track.overlap
// //       });
// //     }
    
// //     // Update track state
// //     updateTrackState(trackId, updates);
// //   }, 'replaceTrackAudioFile');

// //   // Delete track - simplified
// //   const handleTrackDelete = withErrorHandling(async (trackId: string) => {
// //     const { store } = get();
// //     const trackToDelete = findTrackById(trackId);
    
// //     if (!trackToDelete) {
// //       throw new Error(`Track ${trackId} not found for deletion`);
// //     }
    
// //     // Create and execute history action
// //     const action = new Actions.DeleteTrack(store, { ...trackToDelete });
// //     await executeHistoryAction(action);
    
// //     // Update track indices
// //     get().updateTrackIndices();
// //   }, 'handleTrackDelete');

// //   // Add track with unified type handling
// //   const handleAddTrack = withErrorHandling(async (
// //     type: TrackType, 
// //     instrumentId?: string, 
// //     instrumentName?: string, 
// //     instrumentStorageKey?: string
// //   ) => {
// //     // Special handling for drum tracks with samplers
// //     if (type === 'drum') {
// //       // Create default samplers for drum track
// //       const defaultSamplerNames = ['Kick', 'Snare', 'Clap', 'Hi-Hat'];
// //       const samplerPromises = defaultSamplerNames.map(name => 
// //         createTrackAndRegisterWithHistory('sampler', name, { instrumentName: 'Default Sampler' })
// //       );
      
// //       // Execute in parallel for better performance
// //       const createdSamplerTracks = (await Promise.all(samplerPromises)).filter(Boolean);
// //       const samplerTrackIds = createdSamplerTracks.map(track => track.id);
      
// //       // Create main drum track with references to samplers
// //       const count = get().tracks.length + 1;
// //       const mainDrumTrackName = TRACK_CONFIG.drum.getDefaultName(count, instrumentName);
      
// //       const mainDrumTrack = await createTrackAndRegisterWithHistory('drum', mainDrumTrackName, {
// //         instrumentName: 'Drum Sequencer',
// //         samplerTrackIds: samplerTrackIds
// //       });
      
// //       // Open UI for the main drum track
// //       if (mainDrumTrack) {
// //         get().openDrumMachine(mainDrumTrack.id);
// //       }
      
// //       return { mainDrumTrack, samplerTracks: createdSamplerTracks };
// //     }
    
// //     // Create standard track using the configuration system
// //     const count = get().tracks.length + 1;
// //     const trackName = TRACK_CONFIG[type].getDefaultName(count, instrumentName);
    
// //     const trackData = await createTrackAndRegisterWithHistory(type, trackName, {
// //       instrumentId,
// //       instrumentName,
// //       instrumentStorageKey
// //     });
    
// //     return trackData;
// //   }, 'handleAddTrack');

// //   // Handle instrument change - using configuration system
// //   const handleInstrumentChange = withErrorHandling(async (
// //     trackId: string, 
// //     instrumentId: string, 
// //     instrumentName: string, 
// //     instrumentStorageKey: string
// //   ) => {
// //     const { store } = get();
// //     const track = findTrackById(trackId);
    
// //     if (!track) {
// //       throw new Error(`Track ${trackId} not found`);
// //     }
    
// //     // Update track state with new instrument
// //     updateTrackState(trackId, { 
// //       instrument_id: instrumentId, 
// //       instrument_name: instrumentName, 
// //       instrument_storage_key: instrumentStorageKey 
// //     });
    
// //     // Connect track to the new instrument
// //     if (track.type === 'midi') {
// //       await TRACK_CONFIG.midi.initEngine(store, trackId, undefined, instrumentId);
// //     } else {
// //       await store.connectTrackToSoundfont(trackId, instrumentId);
// //     }
// //   }, 'handleInstrumentChange');

// //   // =================== TRANSPORT SLICE ===================

// //   // Consolidated playback command handler
// //   const handlePlaybackCommand = withErrorHandling(async (command: PlaybackCommand, arg?: any) => {
// //     const { store, isPlaying } = get();
// //     const transport = store.getTransport();
    
// //     const commands = {
// //       play: async () => {
// //         if (!isPlaying) {
// //           await transport.play();
// //           updateState('isPlaying', true);
// //         }
// //       },
// //       pause: () => {
// //         if (isPlaying) {
// //           transport.pause();
// //           updateState('isPlaying', false);
// //         }
// //       },
// //       stop: async () => {
// //         await transport.stop();
// //         updateState('isPlaying', false);
// //         updateState('currentTime', 0);
// //       },
// //       seek: () => {
// //         transport.setPosition(arg);
// //         updateState('currentTime', arg);
// //       }
// //     };
    
// //     const action = commands[command];
// //     if (action) {
// //       await action();
// //     } else {
// //       console.error(`Unknown playback command: ${command}`);
// //     }
// //   }, 'handlePlaybackCommand');

// //   // =================== MIDI ACTIONS ===================

// //   // Higher-order function for MIDI operations
// //   const withMidiManager = <T extends unknown[], R>(
// //     operation: (midiManager: any, ...args: T) => R,
// //     methodName?: string
// //   ) => {
// //     return withStore((store, ...args: T) => {
// //       const midiManager = store.getMidiManager();
// //       if (!midiManager) {
// //         console.warn('MidiManager not available');
// //         return null;
// //       }
// //       if (methodName && !midiManager[methodName]) {
// //         console.warn(`MidiManager method ${methodName} not available`);
// //         return null;
// //       }
// //       return operation(midiManager, ...args);
// //     });
// //   };

// //   // MIDI operations using the higher-order function
// //   const addMidiNote = withMidiManager(
// //     (midiManager, trackId: string, note: NoteState) => {
// //       const internalNoteData = convertFromNoteState({ ...note, id: -1 }, trackId);
// //       midiManager.addNoteToTrack(trackId, internalNoteData);
// //     },
// //     'addNoteToTrack'
// //   );

// //   const removeMidiNote = withMidiManager(
// //     (midiManager, trackId: string, noteId: number) => {
// //       midiManager.removeNoteFromTrack(trackId, noteId);
// //     },
// //     'removeNoteFromTrack'
// //   );

// //   const updateMidiNote = withMidiManager(
// //     (midiManager, trackId: string, note: NoteState) => {
// //       const internalNote = convertFromNoteState(note, trackId);
// //       midiManager.updateNote(trackId, internalNote);
// //     },
// //     'updateNote'
// //   );

// //   // Get track notes using withMidiManager
// //   const getTrackNotes = withMidiManager(
// //     (midiManager, trackId: string) => midiManager.getTrackNotes(trackId),
// //     'getTrackNotes'
// //   );

// //   // =================== SAMPLER ACTIONS ===================

// //   // Helper for updating drum track's sampler references
// //   const updateDrumTrackSamplers = (drumTrackId: string, operation: 'add' | 'remove', samplerIds: string[]) => {
// //     const currentTracks = get().tracks;
// //     const drumTrackIndex = currentTracks.findIndex(t => t.id === drumTrackId && t.type === 'drum');
    
// //     if (drumTrackIndex === -1) {
// //       return null;
// //     }
    
// //     const drumTrack = currentTracks[drumTrackIndex] as any;
// //     const currentSamplerIds = drumTrack.samplerTrackIds || [];
    
// //     // Apply the operation to the sampler IDs
// //     const updatedSamplerIds = operation === 'add'
// //       ? [...currentSamplerIds, ...samplerIds]
// //       : currentSamplerIds.filter(id => !samplerIds.includes(id));
    
// //     // Create updated drum track
// //     const updatedDrumTrack = {
// //       ...drumTrack,
// //       samplerTrackIds: updatedSamplerIds,
// //     };
    
// //     // Update tracks array
// //     const finalTracks = [...currentTracks];
// //     finalTracks[drumTrackIndex] = updatedDrumTrack;
// //     updateTracks(finalTracks);
    
// //     return updatedDrumTrack;
// //   };

// //   // Add sampler to drum track
// //   const addSamplerToDrumTrack = withErrorHandling(async (drumTrackId: string, file: File) => {
// //     // Create sampler track from file
// //     const newSamplerTrack = await uploadAudioFile(file, true);
// //     if (!newSamplerTrack) {
// //       throw new Error("Failed to create sampler track from audio file");
// //     }
    
// //     // Add reference to drum track
// //     const result = updateDrumTrackSamplers(drumTrackId, 'add', [newSamplerTrack.id]);
// //     if (!result) {
// //       throw new Error(`Drum track ${drumTrackId} not found.`);
// //     }
    
// //     return newSamplerTrack;
// //   }, 'addSamplerToDrumTrack');

// //   // Remove sampler from drum track
// //   const removeSamplerFromDrumTrack = withErrorHandling(async (drumTrackId: string, samplerTrackIdToDelete: string) => {
// //     // Delete the actual sampler track
// //     await handleTrackDelete(samplerTrackIdToDelete);
    
// //     // Remove reference from drum track
// //     const result = updateDrumTrackSamplers(drumTrackId, 'remove', [samplerTrackIdToDelete]);
// //     if (!result) {
// //       console.warn(`Drum track ${drumTrackId} not found after deleting sampler. Cannot unlink.`);
// //     }
// //   }, 'removeSamplerFromDrumTrack');

// //   // Add empty sampler to drum track
// //   const addEmptySamplerToDrumTrack = withErrorHandling(async (drumTrackId: string, newSamplerName?: string) => {
// //     const { tracks } = get();
    
// //     // Create empty sampler track
// //     const samplerCount = tracks.filter(t => t.type === 'sampler').length;
// //     const defaultName = newSamplerName || `Sampler ${samplerCount + 1}`;
    
// //     const samplerTrack = await createTrackAndRegisterWithHistory('sampler', defaultName);
// //     if (!samplerTrack) {
// //       throw new Error("Failed to create empty sampler track");
// //     }
    
// //     // Add reference to drum track
// //     const result = updateDrumTrackSamplers(drumTrackId, 'add', [samplerTrack.id]);
// //     if (!result) {
// //       console.warn(`Drum track ${drumTrackId} not found. Rolling back sampler creation.`);
// //       await handleTrackDelete(samplerTrack.id);
// //       return null;
// //     }
    
// //     return samplerTrack.id;
// //   }, 'addEmptySamplerToDrumTrack');

// //   // Download sampler track - simplified
// //   const downloadSamplerTrack = withErrorHandling(async (trackId: string) => {
// //     const track = findTrackById(trackId);
    
// //     if (!track || track.type !== 'sampler') {
// //       throw new Error(`Track ${trackId} is not a valid sampler track`);
// //     }
    
// //     const samplerTrack = track as SamplerTrackBase;
// //     const trackName = samplerTrack.name || "Sampler Track";
// //     let audioBlob: Blob | undefined;
    
// //     if (samplerTrack.audioStorageKey) {
// //       try {
// //         audioBlob = await downloadFile(samplerTrack.audioStorageKey);
// //       } catch (error) {
// //         console.error(`Failed to download audio for sampler track:`, error);
// //       }
// //     }
    
// //     return { audioBlob, trackName };
// //   }, 'downloadSamplerTrack');

// //   // =================== STATE ===================
  
// //   // Return the store object with combined slices
// //   return {
// //     // Core state
// //     store: new Store(),
// //     isInitialized: false,
// //     isPlaying: false,
// //     currentTime: 0,
// //     projectTitle: "Untitled Project",
// //     bpm: 120,
// //     timeSignature: [4, 4],
// //     keySignature: "C major",
// //     tracks: [],
    
// //     // UI state
// //     zoomLevel: 1,
// //     measureCount: 40,
// //     canUndo: false,
// //     canRedo: false,
// //     addMenuAnchor: null,
// //     openDrumMachines: {},
    
// //     // Expose utility functions
// //     executeHistoryAction,
// //     findTrackById,
// //     updateTrackState,
// //     updateTracks,
// //     updateState,
    
// //     // Generic state setters - using updateState for consistency and simplicity
// //     setStore: store => updateState('store', store),
// //     setIsInitialized: isInitialized => updateState('isInitialized', isInitialized),
// //     setIsPlaying: isPlaying => updateState('isPlaying', isPlaying),
// //     setCurrentTime: currentTime => updateState('currentTime', currentTime),
// //     setProjectTitle: projectTitle => handleProjectParamChange('projectTitle', projectTitle),
// //     setBpm: bpm => handleProjectParamChange('bpm', bpm),
// //     setTimeSignature: (numerator, denominator) => 
// //       handleProjectParamChange('timeSignature', [numerator, denominator] as [number, number]),
// //     setKeySignature: keySignature => handleProjectParamChange('keySignature', keySignature),
// //     setTracks: tracks => { updateState('tracks', tracks); get().updateTrackIndices(); },
// //     setZoomLevel: zoomLevel => updateState('zoomLevel', zoomLevel),
// //     setMeasureCount: measureCount => updateState('measureCount', measureCount),
// //     setCanUndo: canUndo => updateState('canUndo', canUndo),
// //     setCanRedo: canRedo => updateState('canRedo', canRedo),
// //     setAddMenuAnchor: addMenuAnchor => updateState('addMenuAnchor', addMenuAnchor),
    
// //     // Drum UI actions - simplified
// //     openDrumMachine: (trackId) => updateState('openDrumMachines', 
// //       prev => ({ ...prev, [trackId]: true })),
    
// //     closeDrumMachine: (trackId) => updateState('openDrumMachines', 
// //       prev => ({ ...prev, [trackId]: false })),
    
// //     setDrumPattern: (trackId, pattern) => handleTrackOperation({
// //       type: 'update',
// //       trackId,
// //       updates: { drumPattern: pattern }
// //     }),
    
// //     // Core actions
// //     initializeAudio,
// //     loadProject,
    
// //     // Track operations with direct audio engine updates
// //     handleTrackOperation,
// //     handleTrackParameterChange,
    
// //     // Volume change handler with direct audio engine update
// //     handleTrackVolumeChange: (trackId, volume) => withStore((store) => {
// //       // Update UI state
// //       updateTrackState(trackId, { volume });
// //       // Update audio engine
// //       store.getAudioEngine().setTrackVolume(trackId, volume);
// //       // Create history action
// //       const track = findTrackById(trackId);
// //       if (track) {
// //         const action = new Actions.ParameterChange(
// //           store, trackId, 'volume', track.volume, volume
// //         );
// //         executeHistoryAction(action);
// //       }
// //     }),
    
// //     // Pan change handler with direct audio engine update
// //     handleTrackPanChange: (trackId, pan) => withStore((store) => {
// //       // Update UI state
// //       updateTrackState(trackId, { pan });
// //       // Update audio engine
// //       store.getAudioEngine().setTrackPan(trackId, pan);
// //       // Create history action
// //       const track = findTrackById(trackId);
// //       if (track) {
// //         const action = new Actions.ParameterChange(
// //           store, trackId, 'pan', track.pan, pan
// //         );
// //         executeHistoryAction(action);
// //       }
// //     }),
    
// //     // Mute toggle handler with direct audio engine update
// //     handleTrackMuteToggle: (trackId, muted) => withStore((store) => {
// //       // Update UI state
// //       updateTrackState(trackId, { muted, mute: muted });
// //       // Update audio engine
// //       store.getAudioEngine().setTrackMute(trackId, muted);
// //       // Create history action
// //       const track = findTrackById(trackId);
// //       if (track) {
// //         const oldValue = track.muted ? 1 : 0;
// //         const newValue = muted ? 1 : 0;
// //         const action = new Actions.ParameterChange(
// //           store, trackId, 'muted', oldValue, newValue
// //         );
// //         executeHistoryAction(action);
// //       }
// //     }),
// //     handleTrackSoloToggle: (trackId, soloed) => withStore((store) => {
// //       // 1. Update the soloed state for the target track
// //       updateTrackState(trackId, { solo: soloed });
      
// //       // 2. Get the updated tracks with the new solo state
// //       const updatedTracks = get().tracks;
// //       const audioEngine = store.getAudioEngine();
      
// //       // 3. Process mute state for all tracks based on solo status
// //       for (const track of updatedTracks) {
// //         const shouldBeMuted = soloed ? (track.id !== trackId) : !track.soloed;
        
// //         // Update track state in UI
// //         updateTrackState(track.id, { mute: shouldBeMuted });
        
// //         // Update audio engine directly
// //         audioEngine.setTrackMute(track.id, shouldBeMuted);
        
// //         // Create history action for each track
// //         const action = new Actions.ParameterChange(
// //           store,
// //           track.id,
// //           'muted',
// //           track.muted ? 1 : 0,
// //           shouldBeMuted ? 1 : 0
// //         );
// //         executeHistoryAction(action);
// //       }
// //     }),
// //     handleTrackDelete,
// //     handleAddTrack,
// //     // Position change handler - DIRECT IMPLEMENTATION (no withStore wrapper)
// //     handleTrackPositionChange: (trackId, newPosition, isDragEnd) => {
// //       // Get store state directly
// //       const { store, bpm, timeSignature, isPlaying } = get();
// //       if (!store) {
// //         console.error('Store not available in handleTrackPositionChange');
// //         return;
// //       }
      
// //       // Get track directly
// //       const track = findTrackById(trackId);
// //       if (!track) {
// //         console.error(`Track ${trackId} not found in handleTrackPositionChange`);
// //         return;
// //       }
      
// //       // Skip if nothing changed at drag end (exact match check)
// //       if (isDragEnd && 
// //           track.position?.x === newPosition.x && 
// //           track.position?.y === newPosition.y) {
// //         console.log('No position change detected - skipping update');
// //         return;
// //       }
      
// //       console.log(`Store processing position change: trackId=${trackId}, isDragEnd=${isDragEnd}`, 
// //         { newPosition, oldPosition: track.position });
      
// //       // 1. Update UI state with direct set to avoid withStore wrapper issues
// //       set(state => ({
// //         tracks: state.tracks.map(t => t.id === trackId ? {
// //           ...t,
// //           position: { ...newPosition },
// //           x_position: newPosition.x,
// //           y_position: newPosition.y
// //         } : t)
// //       }));
      
// //       // 2. Update audio engine (with pixels)
// //       const pixelX = ticksToPixels(newPosition.x, bpm, timeSignature || [4, 4]);
// //       store.getAudioEngine().setTrackPosition(trackId, pixelX, newPosition.y);
      
// //       // 3. Create history entry only when drag is complete
// //       if (isDragEnd) {
// //         // Create history action
// //         const action = new Actions.TrackPosition(
// //           store,
// //           trackId,
// //           { ...track.position },
// //           { ...newPosition }
// //         );
// //         executeHistoryAction(action);
        
// //         // Update playback if needed 
// //         if (isPlaying && store.getTransport().handleTrackPositionChange) {
// //           store.getTransport().handleTrackPositionChange(trackId, pixelX);
// //         }
// //       }
// //     },
// //     handleTrackNameChange: (trackId, name) => 
// //       handleTrackParameterChange(trackId, 'name', name),
// //     handleInstrumentChange,
// //     uploadAudioFile,
// //     replaceTrackAudioFile,
    
// //     // Transport actions
// //     handlePlaybackCommand,
// //     playPause: async () => {
// //       const { isPlaying } = get();
// //       return handlePlaybackCommand(isPlaying ? 'pause' : 'play');
// //     },
// //     stop: () => handlePlaybackCommand('stop'),
// //     seekToPosition: (position) => handlePlaybackCommand('seek', position),
    
// //     // Unified history operation handler
// //     undo: async () => {
// //       if (historyManager.canUndo()) {
// //         await historyManager.undo();
// //         updateState('canUndo', historyManager.canUndo());
// //         updateState('canRedo', true);
// //       }
// //     },
    
// //     redo: async () => {
// //       if (historyManager.canRedo()) {
// //         await historyManager.redo();
// //         updateState('canUndo', true);
// //         updateState('canRedo', historyManager.canRedo());
// //       }
// //     },
    
// //     // Track organization
// //     updateTrackIndices: () => {
// //       updateState('tracks', tracks => 
// //         tracks.map((track, index) => ({
// //           ...track,
// //           index
// //         }))
// //       );
// //     },
    
// //     // MIDI note actions
// //     addMidiNote,
// //     removeMidiNote,
// //     updateMidiNote,
// //     getTrackNotes,
    
// //     // Sampler actions
// //     addSamplerToDrumTrack,
// //     removeSamplerFromDrumTrack,
// //     addEmptySamplerToDrumTrack,
// //     downloadSamplerTrack,
// //   };
// // };

// // // Create the store
// // export const useStudioStore = create<StudioState>(createStudioStore);