import { create } from 'zustand';
import * as Tone from 'tone';
import { Store } from '../core/state/store';
import { TrackState, Position } from '../core/types/track';
import { calculateTrackWidth, getTrackColor, GRID_CONSTANTS } from '../constants/gridConstants';
import { historyManager } from '../core/state/history/HistoryManager';
import { getProject, Project } from '../../platform/api/projects';
import { downloadFile } from '../../platform/api/sounds';
import { db } from '../core/db/dexie-client';
import { 
  TrackVolumeChangeAction,
  TrackPanChangeAction,
  TrackPositionChangeAction,
  BPMChangeAction,
  TimeSignatureChangeAction,
  KeySignatureChangeAction,
  TrackAddAction,
  TrackDeleteAction
} from '../core/state/history/actions/StudioActions';

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
  handleAddTrack: (type: 'audio' | 'midi' | 'drum', instrumentId?: string, instrumentName?: string) => Promise<void>;
  handleTrackPositionChange: (trackId: string, newPosition: Position, isDragEnd: boolean) => void;
  uploadAudioFile: (file: File) => Promise<void>;
  handleTrackNameChange: (trackId: string, name: string) => void;
  handleInstrumentChange: (trackId: string, instrumentId: string, instrumentName: string) => void;
  
  // Transport Actions
  playPause: () => Promise<void>;
  stop: () => void;
  seekToPosition: (position: number) => void;
  
  // History Actions
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

export const useStudioStore = create<StudioState>((set, get) => ({
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
      
      // Create history action
      const action = new BPMChangeAction(
        store,
        oldBpm,
        bpm,
        (newBpm) => set({ bpm: newBpm }),
        (updateFn) => set((state) => ({ tracks: updateFn(state.tracks) })),
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
      
      // Create history action
      const action = new TimeSignatureChangeAction(
        store,
        oldTimeSignature,
        newTimeSignature,
        (num, denom) => set({ timeSignature: [num, denom] }),
        (updateFn) => set((state) => ({ tracks: updateFn(state.tracks) })),
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
      // Create history action
      const action = new KeySignatureChangeAction(
        store,
        oldKeySignature,
        keySignature,
        (newKeySignature) => set({ keySignature: newKeySignature })
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
  setTracks: (tracks) => set({ tracks }),
  setZoomLevel: (zoomLevel) => set({ zoomLevel }),
  setMeasureCount: (measureCount) => set({ measureCount }),
  setCanUndo: (canUndo) => set({ canUndo }),
  setCanRedo: (canRedo) => set({ canRedo }),
  setAddMenuAnchor: (addMenuAnchor) => set({ addMenuAnchor }),
  
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
        keySignature: projectData.key_signature || 'C major'
      });
      
      // Update the core engine state
      store.projectManager.setProjectName(projectData.name);
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
        
        // Create the track in our engine
        const newTrack = await store.createTrack(apiTrack.name, apiTrack.type as "audio" | "midi" | "drum" | "video");
        
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
        
        // Handle file loading for tracks with storage_key
        let duration = apiTrack.duration || 0;
        
        if (apiTrack.storage_key) {
          try {
            console.log(`Loading file for track ${apiTrack.name} (${apiTrack.type}) from storage_key: ${apiTrack.storage_key}`);
            
            // Download the file from Supabase storage
            const blob = await downloadFile(apiTrack.storage_key);
            console.log(`Downloaded file blob of size ${blob.size} bytes`);
            
            // Create a file from the blob with appropriate name and type
            const fileName = apiTrack.storage_key.split('/').pop() || `track-${apiTrack.id}`;
            const mimeType = apiTrack.type === 'audio' ? (blob.type || 'audio/mpeg') : 'audio/midi';
            const file = new File([blob], fileName, { type: mimeType });
            
            // Store audio file for waveform display
            if (apiTrack.type === 'audio') {
              audioFile = file;
            }
            
            if (apiTrack.type === 'audio') {
              // Load audio file into the audio engine with position
              // IMPORTANT: Pass position directly when loading to ensure proper playback timing
              await store.loadAudioFile(newTrack.id, file, position);
              
              // Get updated duration after load
              const engineTrack = store.getAudioEngine().getAllTracks().find(t => t.id === newTrack.id);
              if (engineTrack && engineTrack.player?.buffer) {
                duration = engineTrack.player.buffer.duration;
                console.log(`Audio file loaded with duration: ${duration}s at position x:${position.x}`);
              }
            } 
            else if (apiTrack.type === 'midi') {
              // Store and load MIDI file
              console.log(`Processing MIDI file for track ${apiTrack.name}`);
              if (store.getMidiManager()) {
                const midiManager = store.getMidiManager();
                
                // First, save the MIDI blob to IndexedDB for persistence
                console.log(`Storing MIDI blob for track ${newTrack.id} in IndexedDB`);
                const timeSignature: [number, number] = [
                  projectData.time_signature_numerator, 
                  projectData.time_signature_denominator
                ];
                await db.storeMidiTrackBlob(newTrack.id, apiTrack.name, blob, projectData.bpm, timeSignature);
                
                // Then load the track from DB, which will parse the notes correctly
                console.log(`Loading MIDI notes from IndexedDB for track ${newTrack.id}`);
                const notes = await midiManager.loadTrackFromDB(newTrack.id);
                console.log(`Loaded ${notes.length} notes from DB for track ${newTrack.id}`);
                
                // CRITICAL FIX: Update the state for the piano roll to display these notes
                // Import the usePianoRoll context functions
                if (notes.length > 0) {
                  try {
                    // We need to trigger a manual update to the PianoRollContext 
                    // This is a workaround since we can't directly access the context here
                    // We'll use the MidiManager's updateTrack which will trigger the subscribers
                    console.log(`Updating piano roll state with ${notes.length} notes for track ${newTrack.id}`);
                    
                    // Ensure we update the MidiManager's internal state
                    midiManager.updateTrack(newTrack.id, notes);
                    
                    // Also dispatch an event that the piano roll components can listen for
                    const event = new CustomEvent('midi-notes-loaded', { 
                      detail: { trackId: newTrack.id, notes } 
                    });
                    window.dispatchEvent(event);
                  } catch (error) {
                    console.error(`Error updating piano roll state:`, error);
                  }
                }
                
                // Just for debugging - we won't leave this in production
                if (notes.length === 0) {
                  console.warn(`No notes found in MIDI file for track ${newTrack.id}. This might indicate a parsing issue.`);
                  
                  // Try direct loading as fallback
                  console.log(`Trying direct MIDI file loading as fallback for track ${newTrack.id}`);
                  const midiData = await midiManager.loadMidiFile(newTrack.id, file);
                  console.log(`Direct MIDI loading result:`, midiData);
                }
              } else {
                console.warn('MidiManager not available, cannot load MIDI file');
              }
            }
          } catch (error) {
            console.error(`Error loading file for track ${apiTrack.name}:`, error);
          }
        }
        
        // Calculate width based on duration and BPM
        const calculatedWidth = calculateTrackWidth(
          duration, 
          projectData.bpm, 
          [projectData.time_signature_numerator, projectData.time_signature_denominator]
        );
        
        // Create a track state object
        const trackState: TrackState = {
          ...newTrack,
          ...audioTrack,
          position,
          duration,
          type: apiTrack.type as "audio" | "midi" | "drum" | "video",
          volume: apiTrack.volume,
          pan: apiTrack.pan,
          muted: apiTrack.mute,
          _calculatedWidth: calculatedWidth,
          // Store original API data for reference
          dbId: apiTrack.id,
          storage_key: apiTrack.storage_key
        };
        
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
      
      console.log(`Successfully loaded project with ${trackStates.length} tracks`);
      
      // Store the project ID for later reference (saving, etc.)
      (window as any).loadedProjectId = projectId;
      
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
    
    // Create history action using direct update
    const action = new TrackVolumeChangeAction(
      store,
      trackId,
      oldVolume,
      volume,
      // Direct update function that bypasses history
      (id, vol) => {
        const { tracks } = get();
        // Update tracks with the new volume
        set({
          tracks: tracks.map(t => t.id === id ? { ...t, volume: vol } : t)
        });
        // Update audio engine
        store.getAudioEngine().setTrackVolume(id, vol);
      }
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
    
    // Create history action with direct pan update
    const action = new TrackPanChangeAction(
      store,
      trackId,
      oldPan,
      pan,
      // Direct update function that bypasses history
      (id, newPan) => {
        const { tracks } = get();
        // Update tracks with the new pan value
        set({
          tracks: tracks.map(t => t.id === id ? { ...t, pan: newPan } : t)
        });
        // Update audio engine
        store.getAudioEngine().setTrackPan(id, newPan);
        
        console.log(`History manager updated track ${id} pan to:`, newPan);
      }
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
    
    // Update local state
    const updatedTracks = tracks.map(t => 
      t.id === trackId ? { ...t, muted } : t
    );
    
    set({ tracks: updatedTracks });
    
    // Update audio engine
    store.getAudioEngine().setTrackMute(trackId, muted);
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
    
    if (hasSoloedTrack) {
      // For each track, it should be muted if it's not soloed
      updatedTracks.forEach(track => {
        const shouldBeMuted = !track.soloed;
        if (track.muted !== shouldBeMuted) {
          store.getAudioEngine().setTrackMute(track.id, shouldBeMuted);
        }
      });
    } else {
      // If no track is soloed, restore all tracks to their individual mute states
      updatedTracks.forEach(track => {
        store.getAudioEngine().setTrackMute(track.id, track.muted);
      });
    }
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
      
      // Create a delete action for history
      const action = new TrackDeleteAction(
        store,
        trackDataForHistory,
        // Add track callback
        (track) => {
          console.log('History: Re-adding deleted track:', track.id);
          set(state => ({ tracks: [...state.tracks, track] }));
        },
        // Remove track callback
        (id) => {
          console.log('History: Removing track:', id);
          
          // First update the UI state
          set(state => ({ tracks: state.tracks.filter(t => t.id !== id) }));
          
          // Also tell the audio engine to clean up
          store.getAudioEngine().removeTrack(id);
          
          // We don't actually delete from DB here - just visual and audio state
        }
      );
      
      // Execute the action through history manager
      await historyManager.executeAction(action);
      
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
  
  handleAddTrack: async (type: 'audio' | 'midi' | 'drum', instrumentId?: string, instrumentName?: string) => {
    const { store, isInitialized, tracks, timeSignature, bpm } = get();
    if (!store || !isInitialized) {
      console.warn('Store not initialized');
      return;
    }

    console.log(`Adding ${type} track with instrumentId: ${instrumentId} and instrumentName: ${instrumentName}`);

    try {
      // Create track name based on type
      let trackName;
      if (type === 'midi') {
        trackName = `MIDI Track ${tracks.length + 1}`;
      } else if (type === 'drum') {
        trackName = "Drum Machine";
      } else {
        trackName = `Audio Track ${tracks.length + 1}`;
      }

      let newTrack;
      // Create the track
      if (instrumentId) {
        console.log('asdfasdfjklsahfaklsjdflkasfj;askfj track with instrumentId:', instrumentId);
        const existingTrackData = 
          {
            id: crypto.randomUUID(),
            volume: 80,
            pan: 0,
            muted: false,
            soloed: false,
            instrumentId: instrumentId,
            instrumentName: instrumentName
          }
        newTrack = await store.createTrack(trackName, type, existingTrackData)
      } else {
        newTrack = await store.createTrack(trackName, type);
      }
      console.log('New track from createTrack:', newTrack);
      
      const audioTrack = await store.getAudioEngine().createTrack(newTrack.id, newTrack.name);
      console.log('Audio track from createTrack:', audioTrack);

      // Default duration for tracks (4 bars at current time signature)
      const beatsPerBar = timeSignature[0];
      const defaultBars = 4;
      const totalBeats = defaultBars * beatsPerBar;
      const defaultDuration = (totalBeats * 60) / bpm;

      // Create track data with initial position
      const initialPosition = {
        x: 0,
        y: tracks.length * GRID_CONSTANTS.trackHeight // Use the proper track height from constants
      };

      // Create track data object
      const trackData: TrackState = {
        ...newTrack,
        ...audioTrack,
        position: initialPosition,
        duration: defaultDuration,
        type: type,
        _calculatedWidth: calculateTrackWidth(defaultDuration, bpm, timeSignature)
      };
      
      // Make sure instrumentId and instrumentName are properly carried over
      if ((type === 'midi' || type === 'drum') && newTrack.instrumentId) {
        trackData.instrumentId = newTrack.instrumentId;
        trackData.instrumentName = newTrack.instrumentName;
        console.log(`Preserved instrument properties: ${trackData.instrumentId}, ${trackData.instrumentName}`);
      }
      
      console.log('Final track data being added:', trackData);

      // Set track position in audio engine
      store.getAudioEngine().setTrackPosition(
        trackData.id,
        initialPosition.x,
        initialPosition.y
      );

      // Create an add track action for history
      const action = new TrackAddAction(
        store,
        trackData,
        // Add track callback
        (track) => {
          console.log('History: Adding track:', track.id);
          set(state => ({ tracks: [...state.tracks, track] }));
        },
        // Remove track callback
        (id) => {
          console.log('History: Removing track:', id);
          
          // First update the UI state
          set(state => ({ tracks: state.tracks.filter(t => t.id !== id) }));
          
          // Also tell the audio engine to clean up
          store.getAudioEngine().removeTrack(id);
        }
      );
      
      // Execute the action through history manager
      await historyManager.executeAction(action);
      
      // Update history state buttons
      set({
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo()
      });

      console.log(`Added new ${type} track (with history support):`, trackData);
    } catch (error) {
      console.error(`Failed to create ${type} track:`, error);
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
      
      // Create a history action with direct position update
      const action = new TrackPositionChangeAction(
        store,
        trackId,
        oldPosition,
        newPosition,
        // Direct update function that bypasses history
        (id, position) => {
          const { tracks } = get();
          // Update tracks with the new position
          set({
            tracks: tracks.map(t => t.id === id ? { ...t, position } : t)
          });
          // Update audio engine
          store.getAudioEngine().setTrackPosition(id, position.x, position.y);
          
          // Update transport if playing
          if (isPlaying) {
            store.getTransport().handleTrackPositionChange?.(id, position.x);
          }
          
          console.log(`History manager updated track ${id} position to:`, position);
        },
        isPlaying
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
  
  uploadAudioFile: async (file) => {
    const { store, tracks, bpm, timeSignature } = get();
    if (!store || !get().isInitialized) return;
    
    try {
      // First create a track with default name from file
      const trackName = file.name.split('.')[0];
      const newTrack = await store.createTrack(trackName, 'audio');
      
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
          y: tracks.length * GRID_CONSTANTS.trackHeight // Use the proper track height from constants
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
      
      // Create an add track action for history
      const action = new TrackAddAction(
        store,
        trackData,
        // Add track callback
        (track) => {
          console.log('History: Adding audio file track:', track.id);
          set(state => ({ tracks: [...state.tracks, track] }));
          
          // For audio tracks, we need to ensure the audio buffer is loaded
          if (track.audioFile) {
            store.loadAudioFile(track.id, track.audioFile).catch(err => {
              console.error('Failed to reload audio file during redo:', err);
            });
          }
        },
        // Remove track callback
        (id) => {
          console.log('History: Removing audio file track:', id);
          
          // First update the UI state
          set(state => ({ tracks: state.tracks.filter(t => t.id !== id) }));
          
          // Also tell the audio engine to clean up
          store.getAudioEngine().removeTrack(id);
        }
      );
      
      // Execute the action through history manager
      await historyManager.executeAction(action);
      
      // Update history state buttons
      set({
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo()
      });
      
      console.log(`Added audio track from file (with history support):`, trackData);
    } catch (error) {
      console.error("Failed to upload audio file:", error);
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
  
  handleInstrumentChange: (trackId, instrumentId, instrumentName) => {
    const { store, tracks } = get();
    if (!store) return;
    
    console.log(`Changing instrument for track ${trackId} to ${instrumentName} (${instrumentId})`);
    
    // Update local state
    const updatedTracks = tracks.map(t => 
      t.id === trackId ? { ...t, instrumentId, instrumentName } : t
    );
    
    set({ tracks: updatedTracks });
    
    // MidiPlayer update will be handled in the component
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
  
  stop: () => {
    const { store } = get();
    if (!store) return;
    
    console.log('🎮 UI: Triggering stop');
    store.getTransport().stop();
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
        canRedo: historyManager.canRedo()
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
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo()
      });
    } else {
      console.log('⚠️ No actions to redo');
    }
  }
}));