import { create } from 'zustand';
import * as Tone from 'tone';
import { Store } from '../core/state/store';
import { TrackState, Position } from '../core/types/track';
import { calculateTrackWidth, GRID_CONSTANTS } from '../constants/gridConstants';
import { historyManager } from '../core/state/history/HistoryManager';
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
  handleAddTrack: (type: 'audio' | 'midi' | 'drum') => Promise<void>;
  handleTrackPositionChange: (trackId: string, newPosition: Position, isDragEnd: boolean) => void;
  uploadAudioFile: (file: File) => Promise<void>;
  handleTrackNameChange: (trackId: string, name: string) => void;
  
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
  
  handleAddTrack: async (type: 'audio' | 'midi' | 'drum') => {
    const { store, isInitialized, tracks, timeSignature, bpm } = get();
    if (!store || !isInitialized) {
      console.warn('Store not initialized');
      return;
    }

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

      // Create the track
      const newTrack = await store.createTrack(trackName, type);
      const audioTrack = await store.getAudioEngine().createTrack(newTrack.id, newTrack.name);

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

      const trackData: TrackState = {
        ...newTrack,
        ...audioTrack,
        position: initialPosition,
        duration: defaultDuration,
        type: type,
        _calculatedWidth: calculateTrackWidth(defaultDuration, bpm, timeSignature)
      };

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