import { create } from 'zustand';
import * as Tone from 'tone';
import { Store } from '../core/state/store';
import { AudioTrack as EngineAudioTrack } from '../core/audio-engine/audioEngine';
import { calculateTrackWidth, getTrackColor, GRID_CONSTANTS } from '../constants/gridConstants';
import { historyManager } from '../core/state/history/HistoryManager';
import { getProject, Project, TrackState } from '../../platform/api/projects';
import { downloadFile } from '../../platform/api/sounds';
import { db } from '../core/db/dexie-client';
// Import actions
import { Actions } from '../core/state/history/actions';
import { NoteState } from '../components/drum-machine/DrumMachine';
import { convertJsonToNotes, Note } from '../../types/note';
import { convertFromNoteState, convertToNoteState, PULSES_PER_QUARTER_NOTE } from '../utils/noteConversion';
import { AudioTrackRead, MidiTrackRead, SamplerTrackRead } from 'src/platform/types/project';

interface StudioState {
  // Audio Engine State
  store: Store | null;
  isInitialized: boolean;
  isPlaying: boolean;
  currentTime: number;
  
  // Project Settings
  projectTitle: string;
  bpm: number;
  timeSignature: [number, number];
  keySignature: string; // Added key signature
  tracks: TrackState[];
  
  // UI State
  zoomLevel: number;
  measureCount: number;
  canUndo: boolean;
  canRedo: boolean;
  addMenuAnchor: HTMLElement | null;
  
  // Actions
  initializeAudio: () => Promise<void>;
  loadProject: (projectId: string) => Promise<Project>;
  setStore: (store: Store) => void;
  setIsInitialized: (isInitialized: boolean) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setProjectTitle: (title: string) => void;
  setBpm: (bpm: number) => void;
  setTimeSignature: (numerator: number, denominator: number) => void;
  setKeySignature: (keySignature: string) => void;
  setTracks: (tracks: TrackState[]) => void;
  setZoomLevel: (zoomLevel: number) => void;
  setMeasureCount: (measureCount: number) => void;
  setCanUndo: (canUndo: boolean) => void;
  setCanRedo: (canRedo: boolean) => void;
  setAddMenuAnchor: (el: HTMLElement | null) => void;
  
  // Track Actions
  handleTrackVolumeChange: (trackId: string, volume: number) => void;
  handleTrackPanChange: (trackId: string, pan: number) => void;
  handleTrackMuteToggle: (trackId: string, muted: boolean) => void;
  handleTrackSoloToggle: (trackId: string, soloed: boolean) => void;
  handleTrackDelete: (trackId: string) => Promise<void>;
  handleAddTrack: (type: 'audio' | 'midi' | 'drum' | 'sampler', instrumentId?: string, instrumentName?: string, instrumentStorageKey?: string) => Promise<any>;
  handleTrackPositionChange: (trackId: string, newPosition: Position, isDragEnd: boolean) => void;
  uploadAudioFile: (file: File) => Promise<void>;
  handleTrackNameChange: (trackId: string, name: string) => void;
  handleInstrumentChange: (trackId: string, instrumentId: string, instrumentName: string, instrumentStorageKey: string) => void;
  
  // Transport Actions
  playPause: () => Promise<void>;
  stop: () => Promise<void>;
  seekToPosition: (position: number) => void;
  
  // History Actions
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  
  // Function to update track indices based on current order in the array
  updateTrackIndices: () => void;

  // Add back state and actions for multiple drum machines
  openDrumMachines: Record<string, boolean>; 
  openDrumMachine: (drumTrackId: string) => void;
  closeDrumMachine: (trackId: string) => void;
  setDrumPattern: (trackId: string, pattern: boolean[][]) => void;
  
  // Add MIDI actions
  addMidiNote: (trackId: string, note: NoteState) => void;
  removeMidiNote: (trackId: string, noteId: number) => void;
  updateMidiNote: (trackId: string, note: NoteState) => void;
  
  getTrackNotes: (trackId: string) => Note[] | null;

  // New action to replace the audio file for an existing track
  replaceTrackAudioFile: (trackId: string, file: File) => Promise<void>;

  // --- BEGIN ADDED ACTION SIGNATURES ---
  // New action to add a sampler track file and link it to a drum track
  addSamplerToDrumTrack: (drumTrackId: string, file: File) => Promise<void>;
  // New action to remove a sampler track and unlink it from a drum track
  removeSamplerFromDrumTrack: (drumTrackId: string, samplerTrackIdToDelete: string) => Promise<void>;
  // New action to add an EMPTY sampler track and link it to a drum track
  addEmptySamplerToDrumTrack: (drumTrackId: string, newSamplerName?: string) => Promise<string | null>;
  // New action to download a sampler track (both audio and MIDI files)
  downloadSamplerTrack: (trackId: string) => Promise<{audioBlob?: Blob, midiBlob?: Blob, trackName: string}>;
  // --- END ADDED ACTION SIGNATURES ---

  updateTrack: (updatedTrack: TrackState) => void;
}

export const useStudioStore = create<StudioState>((set, get) => {
  // --- Helper function for core track creation and adding logic --- 
  const _createAndAddTrack = async (
    store: Store,
    type: 'audio' | 'midi' | 'sampler' | 'drum', 
    name: string,
    trackId: string,
    timeSignature: [number, number], 
    bpm: number,
    tracksLength: number,
    initialProps: Partial<TrackState> = {}
  ): Promise<TrackState | null> => {
    try {
      // Combine initial props with defaults ONLY for properties expected by store.createTrack
      const createTrackProps = {
          id: trackId,
          volume: initialProps.volume ?? 80,
          pan: initialProps.pan ?? 0,
          muted: initialProps.muted ?? false,
          soloed: initialProps.soloed ?? false,
          instrumentId: initialProps.instrumentId,
          instrumentName: initialProps.instrumentName,
          instrumentStorageKey: initialProps.instrumentStorageKey,
      };

      // Let store.createTrack handle low-level creation & engine defaults
      const newTrack = await store.createTrack(name, type, tracksLength, createTrackProps);
      // Ensure the correct ID is used, as createTrack might generate its own
      if (newTrack.id !== trackId) newTrack.id = trackId; 
      
      // Add audio engine representation
      const audioTrack = await store.getAudioEngine().createTrack(newTrack.id, newTrack.name);

      // Calculate defaults for the TrackState object
      const beatsPerBar = timeSignature[0];
      const defaultBars = 4;
      const totalBeats = defaultBars * beatsPerBar;
      const defaultDuration = (totalBeats * 60) / bpm;
      const calculatedWidth = calculateTrackWidth(defaultDuration, bpm, timeSignature);
      const initialPosition = { x: 0, y: tracksLength * GRID_CONSTANTS.trackHeight };

      // Build TrackState explicitly, combining known values and defaults
      const trackData: TrackState = {
          id: trackId,
          name: newTrack.name, // Use name from engine track
          type: type, // Use the type passed to this helper
          channel: audioTrack.channel, // Assume exists on audioTrack
          volume: newTrack.volume ?? 80,
          pan: newTrack.pan ?? 0,
          muted: newTrack.muted ?? false,
          soloed: newTrack.soloed ?? false,
          position: initialPosition,
          duration: defaultDuration,
          _calculatedWidth: calculatedWidth,
          index: tracksLength, // Use passed length for initial index
          // Use values from initialProps if provided, otherwise from newTrack or undefined
          instrumentId: initialProps.instrumentId ?? newTrack.instrumentId,
          instrumentName: initialProps.instrumentName ?? newTrack.instrumentName,
          instrumentStorageKey: initialProps.instrumentStorageKey ?? newTrack.instrumentStorageKey,
          // Add type-specific fields conditionally
          ...(type === 'audio' && { 
               audioFile: (initialProps as AudioTrack)?.audioFile, // Get from initialProps if exists
               // player: undefined // Usually runtime state
          }),
          ...(type === 'sampler' && { 
               sampleFile: (initialProps as SamplerTrack)?.sampleFile, 
               baseMidiNote: (initialProps as SamplerTrack)?.baseMidiNote, 
               // etc.
          }),
          ...(type === 'drum' && {
               drumPattern: (initialProps as DrumTrack)?.drumPattern ?? Array(4).fill(null).map(() => Array(64).fill(false)), // Initialize pattern
          }),
      };

      // Add optional base fields ONLY if they exist on newTrack and are correct type
      if ('dbId' in newTrack && typeof newTrack.dbId === 'string') trackData.dbId = newTrack.dbId;

      console.log(`_createAndAddTrack: Explicitly built track data for ${trackId}:`, trackData);

      store.getAudioEngine().setTrackPosition(trackData.id, initialPosition.x, initialPosition.y);
      const action = new Actions.AddTrack(store, trackData);
      await historyManager.executeAction(action);
      return trackData;

    } catch (error) {
       console.error(`_createAndAddTrack: Failed for ${trackId} (${type}):`, error);
       return null;
    }
  };
  // --- End Helper Function --- 

  // Return the main store object
  return {
  // Default State
  store: new Store(),
  isInitialized: false,
  isPlaying: false,
  currentTime: 0,
  projectTitle: "Untitled Project",
  bpm: 120,
  timeSignature: [4, 4],
  keySignature: "C major", // Default key signature is C major
  tracks: [],
  
  zoomLevel: 1,
  measureCount: 40, // Initial number of measures
  canUndo: false,
  canRedo: false,
  addMenuAnchor: null,
    openDrumMachines: {}, // Initialize drum machine state
  
  // Actions for state updates
  setStore: (store) => set({ store }),
  setIsInitialized: (isInitialized) => set({ isInitialized }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setProjectTitle: (projectTitle) => {
    set({ projectTitle });
    const { store } = get();
    if (store && store.projectManager.getCurrentProject()) {
      store.projectManager.setProjectName(projectTitle);
    }
  },
  
  setBpm: (bpm) => {
    const oldBpm = get().bpm;
    
    // If value hasn't changed, don't do anything
    if (oldBpm === bpm) return;
    
    // Update UI state immediately
    set({ bpm });
    
    // Get store and other required values
    const { store, timeSignature } = get();
    if (store) {
      // Update core engine state
      store.projectManager.setTempo(bpm);
      Tone.Transport.bpm.value = bpm;
      store.getTransport().setTempo(bpm);
      
      // Create direct action (no callbacks)
      const action = new Actions.BPMChange(
        store,
        oldBpm,
        bpm,
        timeSignature
      );
      
      // Execute action and update history state
      historyManager.executeAction(action).then(() => {
        set({ 
          canUndo: historyManager.canUndo(),
          canRedo: historyManager.canRedo()
        });
      });
    }
  },
  
  setTimeSignature: (numerator, denominator) => {
    const oldTimeSignature = get().timeSignature;
    const newTimeSignature: [number, number] = [numerator, denominator];
    
    // If values haven't changed, don't do anything
    if (oldTimeSignature[0] === numerator && oldTimeSignature[1] === denominator) return;
    
    // Update UI state immediately
    set({ timeSignature: newTimeSignature });
    
    // Get store and other required values
    const { store, bpm } = get();
    if (store) {
      // Update core engine state
      store.projectManager.setTimeSignature(numerator, denominator);
      Tone.Transport.timeSignature = newTimeSignature;
      
      // Create direct action with no callbacks
      const action = new Actions.TimeSignature(
        store,
        oldTimeSignature,
        newTimeSignature,
        bpm
      );
      
      // Execute action and update history state
      historyManager.executeAction(action).then(() => {
        set({ 
          canUndo: historyManager.canUndo(),
          canRedo: historyManager.canRedo()
        });
      });
    }
  },
  
  setKeySignature: (keySignature) => {
    const oldKeySignature = get().keySignature;
    
    // If value hasn't changed, don't do anything
    if (oldKeySignature === keySignature) return;
    
    // Update UI state immediately
    set({ keySignature });
    
    // Get store and other required values
    const { store } = get();
    if (store) {
      // Create direct action with no callbacks
      const action = new Actions.KeySignature(
        store,
        oldKeySignature,
        keySignature
      );
      
      // Execute action and update history state
      historyManager.executeAction(action).then(() => {
        set({ 
          canUndo: historyManager.canUndo(),
          canRedo: historyManager.canRedo()
        });
      });
    }
  },
  setTracks: (tracks) => {
    // First set the tracks as provided
    set({ tracks });
    
    // Then update the indices to match the new order
    get().updateTrackIndices();
  },
  setZoomLevel: (zoomLevel) => set({ zoomLevel }),
  setMeasureCount: (measureCount) => set({ measureCount }),
  setCanUndo: (canUndo) => set({ canUndo }),
  setCanRedo: (canRedo) => set({ canRedo }),
  setAddMenuAnchor: (addMenuAnchor) => set({ addMenuAnchor }),
    
    // Add back drum machine action implementations
    openDrumMachine: (drumTrackId) => set((state) => ({ 
      openDrumMachines: { ...state.openDrumMachines, [drumTrackId]: true }
    })),
    closeDrumMachine: (trackId) => set((state) => ({ 
      openDrumMachines: { ...state.openDrumMachines, [trackId]: false }
    })),
    setDrumPattern: (trackId, pattern) => set(state => {
      const updatedTracks = state.tracks.map(track => {
        if (track.id === trackId && track.type === 'drum') {
          return { ...track, drumPattern: pattern };
        }
        return track;
      });
      return { tracks: updatedTracks };
    }),
  
  // Core initialization
  initializeAudio: async () => {
    const { store, projectTitle } = get();
    if (!store) return;
    
    try {
      // Make sure we create a project before initializing
      if (!store.projectManager.getCurrentProject()) {
        console.log('Creating a new project');
        const project = store.projectManager.createProject(projectTitle);
        console.log('Project created:', project);
      }
      
      await store.initializeAudio();
      set({ isInitialized: true });
      
      // Make store globally accessible for compatibility
      (window as any).storeInstance = store;
      
      console.log('Audio engine initialized');
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      set({ isInitialized: false });
    }
  },
  
  // Load existing project from server
  loadProject: async (projectId) => {
    console.log(`Loading project with ID: ${projectId}`);
    
    try {
      // Fetch project data from API
      const projectData = await getProject(projectId);
      console.log('Project data loaded:', projectData);
      
      // Get current state
      const { store } = get();
      if (!store) {
        throw new Error('Store not initialized');
      }
      
      // Initialize audio if not initialized yet
      if (!get().isInitialized) {
        await store.initializeAudio();
        set({ isInitialized: true });
      }
      
      // Update the project title, BPM, time signature, and key signature
      set({
        projectTitle: projectData.name,
        bpm: projectData.bpm,
        timeSignature: [
          projectData.time_signature_numerator,
          projectData.time_signature_denominator
        ],
        keySignature: projectData.key_signature
      });
      
      // Create a new project in the ProjectManager
      // This is necessary before we can add tracks
      const newProject = store.projectManager.createProject(projectData.name);
      
      // Update the project properties
      store.projectManager.setTempo(projectData.bpm);
      store.projectManager.setTimeSignature(
        projectData.time_signature_numerator,
        projectData.time_signature_denominator
      );
      
      // Set transport parameters
      Tone.Transport.bpm.value = projectData.bpm;
      Tone.Transport.timeSignature = [
        projectData.time_signature_numerator,
        projectData.time_signature_denominator
      ];
      
      // Process and load tracks
      const tracksPromises = projectData.tracks.map(async (apiTrack, index) => {
        console.log(`Processing track ${index}: ${apiTrack.name} (${apiTrack.type})`);
        
        // Create the track in our engine with existing data
        const newTrack = await store.createTrack(
          apiTrack.name, 
          apiTrack.type as "audio" | "midi" | "sampler" | "drum",
          index,
          {
            id: apiTrack.id,
            volume: apiTrack.volume,
            pan: apiTrack.pan,
            muted: apiTrack.mute,
            soloed: false,
          }
        );

        console.log("HEER")
        
        // Create the audio track in the engine
        const audioTrack = await store.getAudioEngine().createTrack(newTrack.id, newTrack.name);
        
        // Set track properties
        store.getAudioEngine().setTrackVolume(newTrack.id, apiTrack.volume);
        store.getAudioEngine().setTrackPan(newTrack.id, apiTrack.pan);
        store.getAudioEngine().setTrackMute(newTrack.id, apiTrack.mute);
        
        // Set track position if available
        const position = {
          x: apiTrack.x_position ?? 0,
          y: apiTrack.y_position ?? (index * GRID_CONSTANTS.trackHeight)
        };
        
        store.getAudioEngine().setTrackPosition(newTrack.id, position.x, position.y);
        
        // Variable to store audio file for waveform display
        let audioFile: File | null = null;
        
        // Handle file loading based on track type and appropriate file
        let duration = null;
        let instrumentId = null;
        let audioStorageKey = null;
        let instrumentStorageKey = null;

        console.log('apiTrack', apiTrack);
        
        // Determine which files to download based on track type
        if (apiTrack.type === 'audio') {
          // For audio tracks, we need the audio file
          const audioTrack = apiTrack.track as AudioTrackRead;
          audioStorageKey = audioTrack.audio_file_storage_key;
          duration = audioTrack.audio_file_duration || 0;
          console.log(`Audio track: using audio_file storage key: ${audioStorageKey}`);
        } 
        else if (apiTrack.type === 'midi') {
          // For MIDI tracks, we need the MIDI file and possibly instrument file
          const midiTrack = apiTrack.track as MidiTrackRead;
          instrumentStorageKey = midiTrack.instrument_file.storage_key;
          instrumentId = midiTrack.instrument_file.id;
          console.log(`MIDI track: using instrument_file storage key: ${instrumentStorageKey}`);
        }
        else if (apiTrack.type === 'sampler') {
          // For sampler tracks, we need both audio and MIDI files
          const samplerTrack = apiTrack.track as SamplerTrackRead;
          const audioStorageKey = samplerTrack.audio_storage_key;
          const audioFileName = samplerTrack.audio_file_name;
          console.log(`Sampler track: using audio_file key: ${audioStorageKey} and audio file name: ${audioFileName}`);
        }
        else if (apiTrack.type === 'drum') {
          // Drum tracks don't need file downloads
          console.log(`Drum track: no files to download`);
        }
        
        // Process audio file if needed
        if (audioStorageKey) {
          try {
            console.log(`Loading audio file for track ${apiTrack.name} from storage_key: ${audioStorageKey}`);
            
            // Download the file from Supabase storage
            const blob = await downloadFile(audioStorageKey);
            console.log(`Downloaded audio blob of size ${blob.size} bytes`);
            
            // Create a file from the blob with appropriate name and type
            const fileName = audioStorageKey.split('/').pop() || `track-${apiTrack.id}.mp3`;
            const mimeType = blob.type || 'audio/mpeg';
            const file = new File([blob], fileName, { type: mimeType });
            
            // Store audio file for waveform display
            audioFile = file;
            
            // For audio or sampler tracks, load the audio into the engine
            if (apiTrack.type === 'audio' || apiTrack.type === 'sampler') {
              // Load audio file into the audio engine with position
              // IMPORTANT: Pass position directly when loading to ensure proper playback timing
              console.log(`Loading ${apiTrack.type} track audio file into the engine`);
              await store.loadAudioFile(newTrack.id, file, position);
              
              // Get updated duration after load
              const engineTrack = store.getAudioEngine().getAllTracks().find(t => t.id === newTrack.id);
              if (engineTrack && engineTrack.player?.buffer) {
                duration = engineTrack.player.buffer.duration;
                console.log(`Audio file loaded with duration: ${duration}s at position x:${position.x}`);
              } else {
                console.warn(`Failed to get player or buffer for ${apiTrack.type} track ${newTrack.id}`);
              }
              
              // For sampler tracks, we need to initialize the SamplerController
              if (apiTrack.type === 'sampler') {
                try {
                  console.log(`Initializing SamplerController for sampler track ${newTrack.id}`);
                  const samplerController = store.getTransport().getSamplerController();
                  if (samplerController) {
                    // Extract sampler parameters from track data or use defaults
                    const baseMidiNote = 60; // Default to middle C
                    const grainSize = 0.1; // Default grain size
                    const overlap = 0.1; // Default overlap
                    
                    // Connect the sampler track to the sampler controller
                    await samplerController.connectTrackToSampler(
                      newTrack.id,
                      file, // Pass the loaded audio file
                      store.getMidiManager(), // Link to MIDI manager for notes
                      baseMidiNote,
                      grainSize,
                      overlap
                    );

                    const samplerTrack = apiTrack.track as SamplerTrackRead;
                    const midiNotes = convertJsonToNotes(newTrack.id, samplerTrack.midi_notes_json);
                    console.log(`midiNotes:`, midiNotes);
                    const midiManager = store.getMidiManager();
                    midiManager.updateTrack(newTrack.id, midiNotes);
                    
                    console.log(`Successfully initialized sampler for track ${newTrack.id}`);
                  } else {
                    console.warn(`SamplerController not available for sampler track ${newTrack.id}`);
                  }
                } catch (error) {
                  console.error(`Failed to initialize sampler for track ${newTrack.id}:`, error);
                  // Continue with loading even if sampler init fails - track will be created but may not play correctly
                }
              }
            }
          } catch (error) {
            console.error(`Error loading audio file for track ${apiTrack.name}:`, error);
          }
        }
        
        // Process MIDI file if needed
        if (true) {
          try {
            
            // Process MIDI file for midi or sampler tracks
            if (apiTrack.type === 'midi' || apiTrack.type === 'sampler') {
              console.log(`Processing MIDI file for track ${apiTrack.name}`);
              if (store.getMidiManager()) {
                const midiManager = store.getMidiManager();
                if (apiTrack.type === 'midi') {
                  const midiTrack = apiTrack.track as MidiTrackRead;
                  try {
                    const instrumentId = midiTrack.instrument_file.id;
                    const instrumentName = midiTrack.instrument_file.name;
                    
                    console.log(`Connecting MIDI track ${newTrack.id} to instrument ${instrumentName} (${instrumentId})`);
                    await store.connectTrackToSoundfont(newTrack.id, instrumentId.toString());
                    
                    // Update track with instrument info
                    newTrack.instrumentId = instrumentId.toString();
                    newTrack.instrumentName = instrumentName;
                    
                    console.log(`Successfully connected MIDI track to instrument`);

                    console.log(`midiTrack.midi_notes_json:`, midiTrack.midi_notes_json);

                    // Update the track state with the instrument info
                    // Explicitly cast the JSON object to Note[] via unknown
                    const midiNotes = convertJsonToNotes(newTrack.id, midiTrack.midi_notes_json);
                    console.log(`midiNotes:`, midiNotes);
                    midiManager.updateTrack(newTrack.id, midiNotes);
                  } catch (error) {
                    console.error(`Error connecting MIDI track to instrument:`, error);
                  }
                }

                // Just for debugging - we won't leave this in production
                // if (true) {
                //   console.warn(`No notes found in MIDI file for track ${newTrack.id}. This might indicate a parsing issue.`);
                //   return
                //   // Try direct loading as fallback
                //   console.log(`Trying direct MIDI file loading as fallback for track ${newTrack.id}`);
                //   const midiData = await midiManager.loadMidiFile(newTrack.id, file);
                //   console.log(`Direct MIDI loading result:`, midiData);
                // }
              } else {
                console.warn('MidiManager not available, cannot load MIDI file');
              }
            }
          } catch (error) {
            console.error(`Error loading MIDI file for track ${apiTrack.name}:`, error);
          }
        }
        
        const calculatedWidth = calculateTrackWidth(
          duration, 
          projectData.bpm, 
          [projectData.time_signature_numerator, projectData.time_signature_denominator],
          {
              trimStartTicks: apiTrack.trim_start_ticks,
              trimEndTicks: apiTrack.trim_end_ticks,
              originalDurationTicks: PULSES_PER_QUARTER_NOTE * 4
          }
      );
        
        // Create a track state object with common properties
        const trackState: TrackState = {
          ...newTrack,
          ...audioTrack,
          position,
          duration,
          trimStartTicks: apiTrack.trim_start_ticks,
          trimEndTicks: apiTrack.trim_end_ticks,
          type: apiTrack.type as "audio" | "midi" | "drum" | "sampler",
          volume: apiTrack.volume,
          pan: apiTrack.pan,
          muted: apiTrack.mute,
          _calculatedWidth: calculatedWidth,
          // Add instrument data if available (for MIDI and drum tracks)
          instrumentId: instrumentId,
          instrumentStorageKey: instrumentStorageKey,
          // Store original API data for reference
          dbId: apiTrack.id,
        };
        
        // Add type-specific properties based on track type
        if (apiTrack.type === 'sampler') {
          // Add sampler-specific properties
          (trackState as SamplerTrack).baseMidiNote = 60; // Default to middle C
          (trackState as SamplerTrack).grainSize = 0.1; // Default grain size
          (trackState as SamplerTrack).overlap = 0.1; // Default overlap
          if (audioFile) {
            (trackState as SamplerTrack).sampleFile = audioFile;
          }
          // Add MIDI file IDs if available
          const samplerTrack = apiTrack.track as SamplerTrack;
          if (samplerTrack.audioFileId) {
            (trackState as SamplerTrack).audioFileId = samplerTrack.audioFileId;
          }
          if (samplerTrack.midiFileId) {
            (trackState as SamplerTrack).midiFileId = samplerTrack.midiFileId;
          }
        } else if (apiTrack.type === 'drum') {
          // Add drum-specific properties if they exist
        }
        
        // Add audioFile to track state for waveform display
        if (audioFile) {
          console.log(`Adding audioFile to track ${newTrack.id} for waveform display`);
          (trackState as any).audioFile = audioFile;
        }
        
        return trackState;
      });
      // Wait for all tracks to be processed
      const trackStates = await Promise.all(tracksPromises);
      set({ tracks: trackStates });

      console.log(`trackStates:`, trackStates);
      
      // Update track indices to ensure they match array positions
      get().updateTrackIndices();
      
      console.log(`Successfully loaded project with ${trackStates.length} tracks`);
      
      // Connect tracks to appropriate sound engines based on type
      for (const track of trackStates) {
        // Connect MIDI and drum tracks to soundfonts if they have instruments assigned
        if (track.type === 'midi') {
          try {
            console.log(`Connecting loaded track ${track.id} to soundfont ${track.instrumentId}${track.instrumentStorageKey ? ' (with storage key)' : ''}`);
            await store.connectTrackToSoundfont(
              track.id, 
              track.instrumentId
            );
            console.log(`Successfully connected loaded track ${track.id} to soundfont ${track.instrumentId}`);
          } catch (error) {
            console.error(`Failed to connect loaded track ${track.id} to soundfont:`, error);
          }
        }
        
        // Connect sampler tracks to the sampler controller
        if (track.type === 'sampler') {
          try {
            const samplerTrack = track as SamplerTrack;
            console.log(`Connecting loaded sampler track ${track.id} to sampler controller`);
            
            // Get the samplerController from transport
            const samplerController = store.getTransport().getSamplerController();
            if (samplerController) {
              // We need a file object - we should have one in sampleFile from earlier loading
              if (samplerTrack.sampleFile) {
                await samplerController.connectTrackToSampler(
                  track.id,
                  samplerTrack.sampleFile,
                  store.getMidiManager(),
                  samplerTrack.baseMidiNote || 60,
                  samplerTrack.grainSize || 0.1,
                  samplerTrack.overlap || 0.1
                );
                console.log(`Successfully connected loaded sampler track ${track.id} to sampler controller`);
              } else {
                console.warn(`Cannot connect sampler track ${track.id} - no sample file available`);
                
                // Initialize an empty sampler as fallback
                await samplerController.initializeSampler(
                  track.id,
                  undefined,
                  samplerTrack.baseMidiNote || 60,
                  samplerTrack.grainSize || 0.1,
                  samplerTrack.overlap || 0.1
                );
                
                // Still register for MIDI updates even without a file
                samplerController.registerTrackSubscription(track.id, store.getMidiManager());
                console.log(`Initialized empty sampler for track ${track.id} as fallback`);
              }
            } else {
              console.error(`SamplerController not available for sampler track ${track.id}`);
            }
          } catch (error) {
            console.error(`Failed to connect loaded sampler track ${track.id} to sampler controller:`, error);
          }
        }
      }
      
      // Store the project ID for later reference (saving, etc.)
      (window as any).loadedProjectId = projectId;
      console.log(`Successfully loaded project with ${trackStates.length} tracks`);
      return projectData;
    } catch (error) {
      console.error('Failed to load project:', error);
      throw error;
    }
  },
  
  
  // Track operations with history support
  handleTrackVolumeChange: (trackId, volume) => {
    const { store, tracks } = get();
    if (!store) return;
    
    // Find the track and get its current volume
    const track = tracks.find(t => t.id === trackId);
    if (!track) {
      console.error(`Track with ID ${trackId} not found in handleTrackVolumeChange`);
      return;
    }
    
    const oldVolume = track.volume;
    
    // If value hasn't changed, don't do anything
    if (oldVolume === volume) return;
    
    // Create direct action (no callbacks)
    const action = new Actions.ParameterChange(
      store,
      trackId,
      'volume',
      oldVolume,
      volume
    );
    
    // Execute action and update history state
    historyManager.executeAction(action).then(() => {
      set({
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo()
      });
    });
  },
  
  handleTrackPanChange: (trackId, pan) => {
    const { store, tracks } = get();
    if (!store) return;
    
    // Find the track and get its current pan
    const track = tracks.find(t => t.id === trackId);
    if (!track) {
      console.error(`Track with ID ${trackId} not found in handleTrackPanChange`);
      return;
    }
    
    const oldPan = track.pan;
    
    // If value hasn't changed, don't do anything
    if (oldPan === pan) return;
    
    // Create direct action (no callbacks)
    const action = new Actions.ParameterChange(
      store,
      trackId,
      'pan',
      oldPan,
      pan
    );
    
    // Execute action and update history state
    historyManager.executeAction(action).then(() => {
      set({
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo()
      });
    });
  },
  
  handleTrackMuteToggle: (trackId, muted) => {
    const { store, tracks } = get();
    if (!store) return;
    
    // Find the track to get its current mute state
    const track = tracks.find(t => t.id === trackId);
    if (!track) {
      console.error(`Track with ID ${trackId} not found in handleTrackMuteToggle`);
      return;
    }
    
    const oldMuted = track.muted;
    
    // If value hasn't changed, don't do anything
    if (oldMuted === muted) return;
    
    // Create direct action (no callbacks)
    const action = new Actions.ParameterChange(
      store,
      trackId,
      'muted',
      oldMuted ? 1 : 0,  // Convert boolean to number
      muted ? 1 : 0      // Convert boolean to number
    );
    
    // Execute action and update history state
    historyManager.executeAction(action).then(() => {
      set({
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo()
      });
    });
  },
  
  handleTrackSoloToggle: (trackId, soloed) => {
    const { store, tracks } = get();
    if (!store) return;
    
    // Update local state with the new solo status for the selected track
    const updatedTracks = tracks.map(t => 
      t.id === trackId ? { ...t, soloed } : t
    );
    
    set({ tracks: updatedTracks });
    
    // If any track is soloed, mute all other non-soloed tracks
    const hasSoloedTrack = updatedTracks.some(t => t.soloed);

    if (soloed) {
      for (const track of updatedTracks) {
        get().handleTrackMuteToggle(track.id, !track.soloed);
      }
    } else {
      for (const track of updatedTracks) {
        get().handleTrackMuteToggle(track.id, track.soloed);
      }
    }
    
    // if (hasSoloedTrack) {
    //   // For each track, it should be muted if it's not soloed
    //   updatedTracks.forEach(track => {
    //     const shouldBeMuted = !track.soloed;
    //     if (track.muted !== shouldBeMuted) {
    //       store.getAudioEngine().setTrackMute(track.id, shouldBeMuted);
    //       store.getSoundfontController().muteTrack(track.id, shouldBeMuted);
    //     }
    //   });
    // } else {
    //   // If no track is soloed, restore all tracks to their individual mute states
    //   updatedTracks.forEach(track => {
    //     store.getAudioEngine().setTrackMute(track.id, track.muted);
    //     store.getSoundfontController().muteTrack(track.id, track.muted);
    //   });
    // }
  },
  
  handleTrackDelete: async (trackId) => {
    const { store, tracks } = get();
    if (!store) return;
    
    try {
      // Find the track to be deleted
      const trackToDelete = tracks.find(t => t.id === trackId);
      if (!trackToDelete) {
        console.error(`Track with ID ${trackId} not found for deletion`);
        return;
      }
      
      // Create a deep copy of the track to store in history
      // This ensures we have all data needed for undo
      const trackDataForHistory = { ...trackToDelete };
      
      // Create direct delete action (no callbacks)
      const action = new Actions.DeleteTrack(
        store,
        trackDataForHistory
      );
      
      // Execute the action through history manager
      await historyManager.executeAction(action);
      
      // Update track indices after deletion
      get().updateTrackIndices();
      
      // We also need to update the history state buttons
      set({
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo()
      });
      
      console.log(`Track ${trackId} deleted successfully (with history support)`);
    } catch (error) {
      console.error(`Failed to delete track ${trackId}:`, error);
    }
  },
  
  handleTrackPositionChange: (trackId, newPosition, isDragEnd) => {
    const { store, tracks, isPlaying } = get();
    if (!store) return;
    
    // Find the track
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    // If position hasn't changed, return early (no need to update state or history)
    if (isDragEnd && track.position.x === newPosition.x && track.position.y === newPosition.y) {
      return;
    }

    // Update track positions in state immediately for visual feedback
    const updatedTracks = tracks.map(t => 
      t.id === trackId 
        ? { ...t, position: newPosition }
        : t
    );
    
    set({ tracks: updatedTracks });
    
    // Update audio engine for immediate audio feedback
    store.getAudioEngine().setTrackPosition(
      trackId,
      newPosition.x,
      newPosition.y
    );
    
    // Only create history entry at the end of a drag operation
    if (isDragEnd) {
      // Keep track of the old position for undo operation
      const oldPosition = { ...track.position };
      
      // Create direct action (no callbacks)
      const action = new Actions.TrackPosition(
        store,
        trackId,
        oldPosition,
        newPosition
      );
      
      // Execute action and update history state
      historyManager.executeAction(action).then(() => {
        set({
          canUndo: historyManager.canUndo(),
          canRedo: historyManager.canRedo()
        });
      });
      
      // Adjust playback if needed
      if (isPlaying) {
        store.getTransport().handleTrackPositionChange?.(trackId, newPosition.x);
      }
      
      console.log(`Track ${trackId} repositioned to:`, newPosition);
    }
  },
  
  uploadAudioFile: async (file, isSampler = false) => {
    const { store, tracks, bpm, timeSignature } = get();
    if (!store || !get().isInitialized) return;
    
    try {
      // First create a track with default name from file
      const trackName = file.name.split('.')[0];
      const trackType = isSampler ? 'sampler' : 'audio';
      
      // Create the track with the appropriate type
      const newTrack = await store.createTrack(trackName, trackType, tracks.length);
      
      // For sampler tracks, proceed differently
      if (isSampler) {
        console.log(`Creating sampler track for ${trackName}`);
        
        // Default values for a sampler track
        const defaultGrainSize = 0.1; // 100ms
        const defaultOverlap = 0.1;   // 10% overlap
        const defaultBaseNote = 60;   // Middle C (C4)
        
        // Create a channel for the track
        const channel = new Tone.Channel().toDestination();
        
        // Default duration for sampler tracks (8 bars at current time signature)
        const beatsPerBar = timeSignature[0];
        const defaultBars = 8;
        const totalBeats = defaultBars * beatsPerBar;
        const defaultDuration = (totalBeats * 60) / bpm;
        
        // Create track data with position and calculated width
        const trackData: TrackState = {
          ...newTrack,
          channel,
          position: { 
            x: 0, 
            y: tracks.length * GRID_CONSTANTS.trackHeight
          },
          volume: 80,
          pan: 0, 
          muted: false,
          soloed: false,
          duration: defaultDuration,
          sampleFile: file,
          baseMidiNote: defaultBaseNote,
          grainSize: defaultGrainSize,
          overlap: defaultOverlap,
          type: 'sampler',
          _calculatedWidth: calculateTrackWidth(defaultDuration, bpm, timeSignature)
        };
        
        // Create direct add track action
        const action = new Actions.AddTrack(
          store,
          trackData
        );
        
        // Execute the action through history manager
        await historyManager.executeAction(action);
        
        // Initialize sampler controller
        try {
          const samplerController = store.getTransport().getSamplerController();
          
          // *** CHANGE: Use connectTrackToSampler instead of separate init/subscribe ***
          await samplerController.connectTrackToSampler(
            newTrack.id,
            file, // Pass the file
            store.getMidiManager(), // Pass the MidiManager
            defaultBaseNote, 
            defaultGrainSize, 
            defaultOverlap
          );
          
          console.log(`Sampler initialized and connected for track ${newTrack.id}`);
        } catch (error) {
          console.error(`Failed to initialize/subscribe sampler for track ${newTrack.id}:`, error);
          // Continue even if sampler init fails - track will still be created
        }
      } else {
        // Regular audio track processing
        // Load the file into the audio engine
        await store.loadAudioFile(newTrack.id, file);
        
        // Get the updated track from audio engine (including duration)
        const audioTrack = store.getAudioEngine().getAllTracks().find(t => t.id === newTrack.id);
        if (!audioTrack) throw new Error("Failed to get created audio track");
        
        // Calculate track width based on file duration
        const audioFileDuration = audioTrack.player?.buffer?.duration || 0;
        
        // Create track data with position and calculated width
        const trackData: TrackState = {
          ...newTrack,
          ...audioTrack,
          position: { 
            x: 0, 
            y: tracks.length * GRID_CONSTANTS.trackHeight
          },
          duration: audioFileDuration,
          audioFile: file,
          type: 'audio',
          _calculatedWidth: calculateTrackWidth(audioFileDuration, bpm, timeSignature)
        };
        
        // Update track position in audio engine
        store.getAudioEngine().setTrackPosition(
          trackData.id,
          trackData.position.x,
          trackData.position.y
        );
        
        // Create direct add track action without callbacks
        const action = new Actions.AddTrack(
          store,
          trackData
        );
        
        // Execute the action through history manager
        await historyManager.executeAction(action);
      }
      
      // Update history state buttons
      set({
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo()
      });
      
      // Update track indices
      get().updateTrackIndices();
      
      console.log(`Added ${isSampler ? 'sampler' : 'audio'} track from file:`, file.name);
    } catch (error) {
      console.error(`Failed to upload ${isSampler ? 'sampler' : 'audio'} file:`, error);
    }
  },
  
  handleTrackNameChange: (trackId, name) => {
    const { store, tracks } = get();
    if (!store) return;
    
    // Update local state
    const updatedTracks = tracks.map(t => 
      t.id === trackId ? { ...t, name } : t
    );
    
    set({ tracks: updatedTracks });
    
    // Update in audio engine
    store.getAudioEngine().setTrackName(trackId, name);
  },
  
  handleInstrumentChange: async (trackId, instrumentId, instrumentName, instrumentStorageKey) => {
    const { store, tracks } = get();
    if (!store) return;
    
    console.log(`Changing instrument for track ${trackId} to ${instrumentName} (${instrumentId})`);
    
    // Update local state with instrumentStorageKey
    const updatedTracks = tracks.map(t => 
      t.id === trackId ? { ...t, instrumentId, instrumentName, instrumentStorageKey } : t
    );
    
    set({ tracks: updatedTracks });
    
    // Connect the track to the soundfont
    try {
      await store.connectTrackToSoundfont(trackId, instrumentId);
      console.log(`Successfully connected track ${trackId} to soundfont ${instrumentId}`);
      
      // CRITICAL FIX: Get the updated track with storage_key from the Store
      const updatedTrackData = store.getTrackDataById(trackId);
      if (updatedTrackData && (updatedTrackData.type === 'midi' || updatedTrackData.type === 'drum') && updatedTrackData.instrumentStorageKey) {
        // Update Zustand state with the storage key that was set in connectTrackToSoundfont
        const tracksWithStorageKey = tracks.map(t => 
          t.id === trackId ? { 
            ...t, 
            instrumentStorageKey: updatedTrackData.instrumentStorageKey 
          } : t
        );
        set({ tracks: tracksWithStorageKey });
        console.log(`Updated Zustand store with instrumentStorageKey: ${updatedTrackData.instrumentStorageKey} for track ${trackId}`);
      }
    } catch (error) {
      console.error(`Failed to connect track ${trackId} to soundfont:`, error);
    }
  },
  
  // New action to replace the audio file for an existing track
  replaceTrackAudioFile: async (trackId: string, file: File) => {
    const { store, tracks, bpm, timeSignature } = get();
    if (!store || !get().isInitialized) {
      console.warn('Store not initialized, cannot replace audio file.');
      return;
    }

    const trackIndex = tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) {
      console.error(`Track with ID ${trackId} not found in store.`);
      return;
    }

    const originalTrack = tracks[trackIndex];
    if (originalTrack.type !== 'audio' && originalTrack.type !== 'sampler') {
      console.error(`Cannot replace audio file for track type: ${originalTrack.type}`);
      return;
    }

    try {
      console.log(`Replacing audio file for track ${trackId} with ${file.name}`);
      
      // Stop playback for this specific sampler before reloading
      const samplerController = store.getTransport().getSamplerController();
      const sampler = samplerController.getSampler(trackId);
      if (sampler) {
        console.log(`Stopping playback for sampler ${trackId} before file replacement.`);
        sampler.stopPlayback(); 
      } else {
        console.warn(`Sampler ${trackId} not found, cannot stop playback before replacement.`);
      }

      // Load the new file into the audio engine. This replaces the old player/buffer.
      await store.loadAudioFile(trackId, file);

      // Get the updated track info from the audio engine (especially duration)
      const engineTrack = store.getAudioEngine().getAllTracks().find(t => t.id === trackId);
      if (!engineTrack) {
        throw new Error(`Failed to get updated engine track data for ${trackId} after file load.`);
      }

      const newDuration = engineTrack.player?.buffer?.duration || 0;
      const newCalculatedWidth = calculateTrackWidth(newDuration, bpm, timeSignature);

      // Update the track state in Zustand
      const updatedTracks = [...tracks]; // Create a mutable copy
      
      // Use a more specific type for the update object initially
      const commonUpdateData: Partial<TrackState> & { duration: number, _calculatedWidth: number } = {
        duration: newDuration,
        _calculatedWidth: newCalculatedWidth,
      };

      if (originalTrack.type === 'audio') {
        // Now we know it's an AudioTrackState
        const audioUpdateData: Partial<AudioTrack> = {
          ...commonUpdateData,
          type: 'audio',
          audioFile: file,
        };
        updatedTracks[trackIndex] = {
          ...originalTrack,
          ...audioUpdateData
        };
      } else if (originalTrack.type === 'sampler') {
        // Now we know it's a SamplerTrackState
        const samplerUpdateData: Partial<SamplerTrack> = {
          ...commonUpdateData,
          type: 'sampler',
          sampleFile: file,
          baseMidiNote: originalTrack.baseMidiNote,
          grainSize: originalTrack.grainSize,
          overlap: originalTrack.overlap,
        };

        // Re-initialize sampler controller
        try {
          const samplerController = store.getTransport().getSamplerController();
          
          // *** CHANGE: Use connectTrackToSampler instead of separate init/subscribe ***
          await samplerController.connectTrackToSampler(
            trackId,
            file, // Pass the file
            store.getMidiManager(), // Pass the MidiManager
            originalTrack.baseMidiNote, 
            originalTrack.grainSize, 
            originalTrack.overlap
          );
          
          console.log(`Sampler initialized and connected for track ${trackId}`);
        } catch (error) {
          console.error(`Failed to initialize/subscribe sampler for track ${trackId}:`, error);
          // Continue even if sampler init fails - track will still be created
        }

        updatedTracks[trackIndex] = {
          ...originalTrack,
          ...samplerUpdateData
        };
      }

      set({ tracks: updatedTracks });

      console.log(`Successfully replaced audio file for track ${trackId}. New duration: ${newDuration}`);

      // Optional: Consider adding this change to the history manager
      // const action = new Actions.UpdateTrack(store, originalTrack, updatedTracks[trackIndex]);
      // await historyManager.executeAction(action);
      // set({ canUndo: historyManager.canUndo(), canRedo: historyManager.canRedo() });

    } catch (error) {
      console.error(`Failed to replace audio file for track ${trackId}:`, error);
      // Optional: Revert state or show error to user
    }
  },
  
  // Transport actions
  playPause: async () => {
    const { store, isPlaying } = get();
    if (!store) return;

    try {
      if (!isPlaying) {
        console.log('🎮 UI: Triggering play');
        await store.getTransport().play();
        set({ isPlaying: true });
      } else {
        console.log('🎮 UI: Triggering pause');
        store.getTransport().pause();
        set({ isPlaying: false });
      }
    } catch (error) {
      console.error('Playback control failed:', error);
      set({ isPlaying: false });
    }
  },
  
  stop: async () => {
    const { store } = get();
    if (!store) return;
    
    console.log('🎮 UI: Triggering stop');
    await store.getTransport().stop();
    set({ 
      isPlaying: false,
      currentTime: 0
    });
  },
  
  seekToPosition: (position) => {
    const { store } = get();
    if (!store) return;
    
    store.getTransport().setPosition(position);
    set({ currentTime: position });
  },
  
  // History actions for undo/redo
  undo: async () => {
    if (historyManager.canUndo()) {
      console.log('🔄 Performing undo operation');
      
      await historyManager.undo();
      
      // Update UI after undo
      set({
        canUndo: historyManager.canUndo(),
        canRedo: true
      });
    } else {
      console.log('⚠️ No actions to undo');
    }
  },
  
  redo: async () => {
    if (historyManager.canRedo()) {
      console.log('🔄 Performing redo operation');
      
      await historyManager.redo();
      
      // Update UI after redo
      set({
        canUndo: true,
        canRedo: historyManager.canRedo()
      });
    } else {
      console.log('⚠️ No actions to redo');
    }
  },
  
  // Function to update track indices based on current order in the array
  updateTrackIndices: () => {
    const { tracks } = get();
    const updatedTracks = tracks.map((track, index) => ({
      ...track,
      index
    }));
    set({ tracks: updatedTracks });
  },

  // Main Add Track Action - Refactored to use helper
  handleAddTrack: async (type: 'audio' | 'midi' | 'drum' | 'sampler', instrumentId?: string, instrumentName?: string, instrumentStorageKey?: string) => {
    const { store, isInitialized, tracks, timeSignature, bpm, openDrumMachine } = get(); // Get openDrumMachine
    if (!store || !isInitialized) {
      console.warn('Store not initialized');
      return null;
    }

    try {
        // --- Special handling if type is 'drum' --- 
        if (type === 'drum') {
            console.log('handleAddTrack: [Drum] Entered block');
            const defaultSamplerNames = ['Kick', 'Snare', 'Clap', 'Hi-Hat'];
            const createdSamplerTracks: TrackState[] = [];
            let currentTrackIndex = get().tracks.length; // Initial index

            // 1. Create Sampler Tracks
            for (const name of defaultSamplerNames) {
                try {
                    const samplerTrackId = crypto.randomUUID();
                    const samplerType = 'sampler';
                    const samplerTrackName = name;
                    const newSamplerTrack = await store.createTrack(samplerTrackName, samplerType, currentTrackIndex, { id: samplerTrackId, instrumentName: 'Default Sampler' });
                    const audioSamplerTrack = await store.getAudioEngine().createTrack(newSamplerTrack.id, newSamplerTrack.name);
                    // ... (calculate defaults for sampler) ...
                    const beatsPerBar = timeSignature[0];
                    const defaultBars = 4;
                    const totalBeats = defaultBars * beatsPerBar;
                    const defaultDuration = (totalBeats * 60) / bpm;
                    const initialPosition = { x: 0, y: currentTrackIndex * GRID_CONSTANTS.trackHeight };
                    const samplerTrackData: TrackState = {
                        id: newSamplerTrack.id,
                        name: newSamplerTrack.name,
                        type: samplerType,
                        channel: audioSamplerTrack.channel,
                        volume: newSamplerTrack.volume,
                        pan: newSamplerTrack.pan,
                        muted: newSamplerTrack.muted,
                        soloed: newSamplerTrack.soloed,
                        position: initialPosition,
                        trimStartTicks: newSamplerTrack.trimStartTicks,
                        trimEndTicks: newSamplerTrack.trimEndTicks,
                        _calculatedWidth: calculateTrackWidth(defaultDuration, bpm, timeSignature),
                        index: currentTrackIndex,
                    };
                    if ('dbId' in newSamplerTrack && typeof newSamplerTrack.dbId === 'string') samplerTrackData.dbId = newSamplerTrack.dbId;

                    const addSamplerAction = new Actions.AddTrack(store, samplerTrackData);
                    await historyManager.executeAction(addSamplerAction);
                    createdSamplerTracks.push(samplerTrackData);
                    currentTrackIndex++; 
                    console.log('Added sampler track:', samplerTrackName);
                } catch (error) {
                    console.error(`Failed to create sampler track ${name}:`, error);
                }
            }
            console.log('handleAddTrack: [Drum] Finished creating samplers:', createdSamplerTracks.length);

            // 2. Create Main Drum Track Placeholder (AFTER samplers)
            const mainDrumTrackId = crypto.randomUUID();
            const mainDrumTrackName = instrumentName || `Drum Sequencer ${get().tracks.length + 1}`; 
            const mainDrumType = 'drum';
            let mainDrumTrackData: TrackState | null = null;
            console.log(`handleAddTrack: [Drum] Attempting to create main drum track (${mainDrumTrackId})`);
            try {
                const newMainDrumTrack = await store.createTrack(mainDrumTrackName, mainDrumType, currentTrackIndex, { id: mainDrumTrackId, instrumentName: 'Drum Sequencer' });
                const audioMainDrumTrack = await store.getAudioEngine().createTrack(newMainDrumTrack.id, newMainDrumTrack.name);
                // ... (calculate defaults for drum track) ...
                 const beatsPerBar = timeSignature[0];
                 const defaultBars = 4;
                 const totalBeats = defaultBars * beatsPerBar;
                 const defaultDuration = (totalBeats * 60) / bpm;
                 const initialPosition = { x: 0, y: currentTrackIndex * GRID_CONSTANTS.trackHeight }; // Use incremented index
                mainDrumTrackData = {
                    id: mainDrumTrackId,
                    name: mainDrumTrackName,
                    type: mainDrumType,
                    channel: audioMainDrumTrack.channel,
                    volume: newMainDrumTrack.volume ?? 80,
                    pan: newMainDrumTrack.pan ?? 0,
                    muted: newMainDrumTrack.muted ?? false,
                    soloed: newMainDrumTrack.soloed ?? false,
                    position: initialPosition,
                    trimStartTicks: 0,
                    trimEndTicks: 0,
                    duration: defaultDuration,
                    _calculatedWidth: calculateTrackWidth(defaultDuration, bpm, timeSignature),
                    index: currentTrackIndex,
                };
                if ('dbId' in newMainDrumTrack && typeof newMainDrumTrack.dbId === 'string') mainDrumTrackData.dbId = newMainDrumTrack.dbId;


                const addMainDrumAction = new Actions.AddTrack(store, mainDrumTrackData);
                await historyManager.executeAction(addMainDrumAction);
                console.log('handleAddTrack: [Drum] Added main drum track entry:', mainDrumTrackData);
            } catch(error) {
                 console.error('handleAddTrack: [Drum] Failed to create main drum track entry:', error);
            }

            // 3. Final Updates
            get().updateTrackIndices();
            set({
                canUndo: historyManager.canUndo(),
                canRedo: historyManager.canRedo()
            });

            // 4. Open UI for the main drum track
            if (mainDrumTrackData) {
                console.log(`handleAddTrack: [Drum] Calling openDrumMachine for ${mainDrumTrackId}`);
                openDrumMachine(mainDrumTrackId);
            } else {
                console.error('handleAddTrack: [Drum] Cannot open UI, mainDrumTrackData is null');
            }

            // 5. Return
            console.log('handleAddTrack: [Drum] Returning...');
            return { mainDrumTrack: mainDrumTrackData, samplerTracks: createdSamplerTracks };
        }
        // --- End of specific 'drum' type handling ---

        // --- Original logic for other types ('audio', 'midi', 'sampler') ---
        // ... (rest of the function as it was, handling non-drum types) ...
        console.log(`handleAddTrack: Handling default type: ${type}`);
        let trackName;
        if (type === 'midi') { trackName = instrumentName || `MIDI Track ${tracks.length + 1}`; }
        else if (type === 'sampler') { trackName = instrumentName || `Sampler ${tracks.length + 1}`; }
        else { trackName = `Audio Track ${tracks.length + 1}`; } // audio
        
        const trackId = crypto.randomUUID();
        const newTrack = await store.createTrack(trackName, type, tracks.length, { id: trackId, instrumentId, instrumentName, instrumentStorageKey });
        const audioTrack = await store.getAudioEngine().createTrack(newTrack.id, newTrack.name);
        const beatsPerBar = timeSignature[0];
        const defaultBars = 4;
        const totalBeats = defaultBars * beatsPerBar;
        const defaultDuration = (totalBeats * 60) / bpm;
        const initialPosition = { x: 0, y: tracks.length * GRID_CONSTANTS.trackHeight };

        const trackData: TrackState = {
            id: newTrack.id,
            name: newTrack.name,
            type: type,
            channel: audioTrack.channel,
            volume: newTrack.volume ?? 80,
            pan: newTrack.pan ?? 0,
            muted: newTrack.muted ?? false,
            soloed: newTrack.soloed ?? false,
            position: initialPosition,
            trimStartTicks: 0,
            trimEndTicks: 0,
            duration: defaultDuration,
            _calculatedWidth: calculateTrackWidth(defaultDuration, bpm, timeSignature),
            index: tracks.length,
            instrumentId: newTrack.instrumentId ?? instrumentId,
            instrumentName: newTrack.instrumentName ?? instrumentName,
            instrumentStorageKey: newTrack.instrumentStorageKey ?? instrumentStorageKey,
            ...(type === 'audio' && { audioFile: (newTrack as any).audioFile }),
            ...(type === 'sampler' && { sampleFile: (newTrack as any).sampleFile }),
        };
        if ('dbId' in newTrack && typeof newTrack.dbId === 'string') trackData.dbId = newTrack.dbId;

        console.log('Final track data being added (non-drum):', trackData);
        const action = new Actions.AddTrack(store, trackData);
        await historyManager.executeAction(action);
        
        get().updateTrackIndices();
        set({ canUndo: historyManager.canUndo(), canRedo: historyManager.canRedo() });
        console.log(`Added new ${type} track (with history support):`, trackData);
        return trackData;

    } catch (error) {
      console.error(`handleAddTrack: Failed overall for type ${type}:`, error);
      return null;
    }
  },

  // Add MIDI Action Implementations (with conversion)
  addMidiNote: (trackId, note) => {
    const { store } = get();
    const midiManager = store?.getMidiManager();
    if (midiManager?.addNoteToTrack) {
      // Convert NoteState to internal Note format, ignoring the ID from UI
      // The MidiManager should generate the final internal ID.
      // We pass trackId=null here as convertFromNoteState expects it, but MidiManager likely ignores it for adding.
      const internalNoteData = convertFromNoteState({ ...note, id: -1 }, trackId); // Pass dummy ID, manager should assign real one.
      console.log(`useStudioStore: addMidiNote - Converted Note Data (ID ignored):`, internalNoteData);
      midiManager.addNoteToTrack(trackId, internalNoteData); 
    } else {
      console.warn('MidiManager or addNoteToTrack not available');
    }
  },
  removeMidiNote: (trackId, noteId) => {
    const { store } = get();
    const midiManager = store?.getMidiManager();
    if (midiManager?.removeNoteFromTrack) {
      midiManager.removeNoteFromTrack(trackId, noteId);
    } else {
      console.warn('MidiManager or removeNoteFromTrack not available');
    }
  },
  updateMidiNote: (trackId, note) => {
    const { store } = get();
    const midiManager = store?.getMidiManager();
    if (midiManager?.updateNote) { 
      // Convert NoteState to internal Note format. ID is important here.
      const internalNote = convertFromNoteState(note, trackId); 
      console.log(`useStudioStore: updateMidiNote - Converted Note:`, internalNote);
      midiManager.updateNote(trackId, internalNote);
    } else {
      console.warn('MidiManager or updateNote not available');
    }
  },
  
  getTrackNotes: (trackId: string) => {
    const { store } = get();
    return store?.getMidiManager()?.getTrackNotes(trackId) || null;
  },

  // --- BEGIN ADDED ACTIONS ---
  addSamplerToDrumTrack: async (drumTrackId, file) => {
    const { uploadAudioFile, tracks } = get(); // Get existing upload action
    console.log(`Adding sampler from file ${file.name} to drum track ${drumTrackId}`);

    try {
      // 1. Upload the file as a sampler track using the existing action
      // We need to await this to ensure the track is created before linking
      // NOTE: Assumes uploadAudioFile correctly adds the track to the store.
      await uploadAudioFile(file); // FIX: Pass only the file argument

      // 2. Find the newly added sampler track (most recent sampler type track?)
      const updatedTracks = get().tracks; // Get tracks again after upload
      const newSamplerTrack = updatedTracks
        .filter(t => t.type === 'sampler')
        .sort((a, b) => (b.index ?? -1) - (a.index ?? -1))[0]; // Get the one with highest index

      if (!newSamplerTrack) {
        throw new Error("Failed to find the newly created sampler track after upload.");
      }
      const newSamplerTrackId = newSamplerTrack.id;
      console.log(`Found new sampler track ID: ${newSamplerTrackId}`);

      // 3. Find the main drum track
      const drumTrackIndex = updatedTracks.findIndex(t => t.id === drumTrackId && t.type === 'drum');
      if (drumTrackIndex === -1) {
        throw new Error(`Drum track ${drumTrackId} not found.`);
      }
      const drumTrack = updatedTracks[drumTrackIndex] as DrumTrack;

      // 4. Update the drum track's samplerTrackIds
      const updatedSamplerIds = [...(drumTrack.samplerTrackIds || []), newSamplerTrackId];
      const updatedDrumTrack: DrumTrack = {
        ...drumTrack,
        samplerTrackIds: updatedSamplerIds,
      };

      // 5. Update the Zustand state
      // Create a new array with the updated drum track
      const finalTracks = [...updatedTracks];
      finalTracks[drumTrackIndex] = updatedDrumTrack;
      set({ tracks: finalTracks });
      
      // We still need to update indices after modifying the tracks array
      get().updateTrackIndices();
      
      // Update history buttons based on the handleAddTrack action that ran
      set({
          canUndo: historyManager.canUndo(),
          canRedo: historyManager.canRedo()
      });

    } catch (error) {
      console.error(`Failed to add sampler to drum track ${drumTrackId}:`, error);
    }
  },

  removeSamplerFromDrumTrack: async (drumTrackId, samplerTrackIdToDelete) => {
    const { handleTrackDelete, tracks } = get(); // Get existing delete action
    console.log(`Removing sampler ${samplerTrackIdToDelete} from drum track ${drumTrackId}`);

    try {
      // 1. Delete the sampler track itself using the existing action
      await handleTrackDelete(samplerTrackIdToDelete);

      // 2. Find the main drum track (use get() again for latest state after deletion)
      const currentTracks = get().tracks;
      const drumTrackIndex = currentTracks.findIndex(t => t.id === drumTrackId && t.type === 'drum');
      if (drumTrackIndex === -1) {
        console.warn(`Drum track ${drumTrackId} not found after deleting sampler. Cannot unlink.`);
        return;
      }
      const drumTrack = currentTracks[drumTrackIndex] as DrumTrack;

      // 3. Update the drum track's samplerTrackIds by filtering
      const updatedSamplerIds = (drumTrack.samplerTrackIds || []).filter(id => id !== samplerTrackIdToDelete);
      const updatedDrumTrack: DrumTrack = {
        ...drumTrack,
        samplerTrackIds: updatedSamplerIds,
      };

      // 4. Update the Zustand state
      // Create a new array with the updated drum track
      const finalTracks = [...currentTracks];
      finalTracks[drumTrackIndex] = updatedDrumTrack;
      set({ tracks: finalTracks });
      
      // We still need to update indices after modifying the tracks array
      get().updateTrackIndices();
      
      // Update history buttons based on the handleAddTrack action that ran
      set({
          canUndo: historyManager.canUndo(),
          canRedo: historyManager.canRedo()
      });

    } catch (error) {
      console.error(`Failed to remove sampler ${samplerTrackIdToDelete} from drum track ${drumTrackId}:`, error);
    }
  },

  addEmptySamplerToDrumTrack: async (drumTrackId, newSamplerName) => {
    const { handleAddTrack, tracks, updateTrackIndices, store } = get();
    console.log(`Adding empty sampler track (optional name: ${newSamplerName}) to drum track ${drumTrackId}`);

    try {
      // 1. Create a new empty sampler track using handleAddTrack
      const samplerCount = tracks.filter(t => t.type === 'sampler').length;
      const defaultName = newSamplerName || `Sampler ${samplerCount + 1}`;
      // handleAddTrack creates the TrackState and also the underlying AudioEngine track/player
      const newSamplerTrackState = await handleAddTrack('sampler', undefined, defaultName, undefined);

      if (!newSamplerTrackState || !newSamplerTrackState.id) {
        throw new Error("Failed to create the new empty sampler track using handleAddTrack.");
      }
      const newSamplerTrackId = newSamplerTrackState.id;
      console.log(`Created new empty sampler track ID: ${newSamplerTrackId} with name: ${defaultName}`);

      // *** ADDED: Initialize SamplerController instance and subscribe ***
      if (store) {
          const samplerController = store.getTransport().getSamplerController();
          const midiManager = store.getMidiManager();

          if (samplerController && midiManager) {
              try {
                  // Initialize the sampler instance in the controller (without a file)
                  // We pass undefined for the file argument
                  await samplerController.initializeSampler(newSamplerTrackId, undefined, 60); // Use default baseNote 60
                  console.log(`Initialized empty sampler instance ${newSamplerTrackId} in SamplerController`);

                  // Explicitly subscribe it to the MidiManager
                  samplerController.registerTrackSubscription(newSamplerTrackId, midiManager);
                  console.log(`Registered subscription for empty sampler ${newSamplerTrackId}`);
                  
                   // Immediately repopulate notes after re-initialization (necessary after initializeSampler)
                  const notes = midiManager.getTrackNotes(newSamplerTrackId);
                  const sampler = samplerController.getSampler(newSamplerTrackId);
                  if (sampler && notes) {
                    sampler.setNotes(notes);
                    console.log(`Immediately repopulated sampler ${newSamplerTrackId} with ${notes.length} notes.`);
                  } else {
                    console.warn(`Could not repopulate notes for sampler ${newSamplerTrackId}: Sampler found=${!!sampler}, Notes found=${!!notes}`);
                  }

              } catch (error) {
                  console.error(`Failed to initialize/subscribe empty sampler ${newSamplerTrackId}:`, error);
                  // Decide if we should rollback track creation here
                  // await get().handleTrackDelete(newSamplerTrackId);
                  // throw error; // Re-throw if needed
              }
          } else {
              console.error(`SamplerController or MidiManager not found, cannot complete sampler setup for ${newSamplerTrackId}`);
          }
      } else {
          console.error(`Store not found, cannot complete sampler setup for ${newSamplerTrackId}`);
      }
      // *** END ADDED SECTION ***

      // 2. Find the main drum track
      // Use get() again to ensure we have the most up-to-date tracks array
      const currentTracks = get().tracks; 
      const drumTrackIndex = currentTracks.findIndex(t => t.id === drumTrackId && t.type === 'drum');
      if (drumTrackIndex === -1) {
        // Rollback: Delete the sampler track if the drum track isn't found
        console.warn(`Drum track ${drumTrackId} not found. Rolling back sampler creation.`);
        await get().handleTrackDelete(newSamplerTrackId); // Use existing delete action
        return null; // Indicate failure
      }
      const drumTrack = currentTracks[drumTrackIndex] as DrumTrack;

      // 3. Update the drum track's samplerTrackIds - CORRECTLY ADD the new ID
      const updatedSamplerIds = [...(drumTrack.samplerTrackIds || []), newSamplerTrackId];
      const updatedDrumTrack: DrumTrack = {
        ...drumTrack,
        samplerTrackIds: updatedSamplerIds,
      };

      // 4. Update the Zustand state
      // Create a new array with the updated drum track
      const finalTracks = [...currentTracks];
      finalTracks[drumTrackIndex] = updatedDrumTrack;
      set({ tracks: finalTracks });
      
      // We still need to update indices after modifying the tracks array
      updateTrackIndices();
      
      // Update history buttons based on the handleAddTrack action that ran
      set({
          canUndo: historyManager.canUndo(),
          canRedo: historyManager.canRedo()
      });

      console.log(`Successfully added empty sampler ${newSamplerTrackId} and linked to drum track ${drumTrackId}`);
      return newSamplerTrackId; // Return the new ID

    } catch (error) {
      console.error(`Failed to add empty sampler to drum track ${drumTrackId}:`, error);
      return null; // Return null on failure
    }
  },
  // --- END ADDED ACTIONS ---

  // Download sampler track (both audio and MIDI files)
  downloadSamplerTrack: async (trackId: string) => {
    const { tracks, store } = get();
    console.log(`Downloading sampler track ${trackId}`);
    
    // Find the track in the tracks array
    const track = tracks.find(t => t.id === trackId);
    if (!track) {
      console.error(`Track with ID ${trackId} not found`);
      return { trackName: "Unknown Track" };
    }
    
    // Ensure it's a sampler track
    if (track.type !== 'sampler') {
      console.error(`Track ${trackId} is not a sampler track (type: ${track.type})`);
      return { trackName: track.name };
    }
    
    // Cast to SamplerTrack type to access specific properties
    const samplerTrack = track as SamplerTrack;
    const trackName = samplerTrack.name || "Sampler Track";
    let audioBlob: Blob | undefined;
    let midiBlob: Blob | undefined;
    
    // Step 1: Download audio sample file
    if (samplerTrack.audioStorageKey) {
      audioBlob = await downloadFile(samplerTrack.audioStorageKey);
      console.log(`Downloaded audio blob of size ${audioBlob.size} bytes`);
    } else if (store?.getMidiManager()) {
      // Export MIDI directly from MidiManager
      console.log(`Exported MIDI blob of size ${midiBlob?.size} bytes`);
    }
    
    // Return the downloaded data
    return {
      audioBlob,
      midiBlob,
      trackName
    };
  },
  
  updateTrack: (updatedTrack: TrackState) => {
    const { tracks, store } = get();
    
    // Update the track in the tracks array
    const updatedTracks = tracks.map(track => 
      track.id === updatedTrack.id ? updatedTrack : track
    );
    
    // Update the state
    set({ tracks: updatedTracks });
    
    // Update in the audio engine if needed
    if (store && updatedTrack.type === 'audio') {
      // Assert the type to the engine's AudioTrack type
      store.getAudioEngine().updateTrack(updatedTrack.id, updatedTrack as EngineAudioTrack);
    }
  },
}
});
