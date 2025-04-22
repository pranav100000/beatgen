import { CombinedTrack } from 'src/platform/types/project';
import { Position } from '../../components/track';
import { RootState, SetFn, GetFn, StoreSliceCreator, TrackParameter, TrackType, TrackOptions } from '../types';
import { Store } from '../../core/state/store';
import { Actions } from '../../core/state/history/actions'; 
import { TRACK_CONFIG, DEFAULT_SAMPLER_CONFIG } from '../config';
import { GRID_CONSTANTS, ticksToPixels, pixelsToTicks } from '../../constants/gridConstants';
import { PULSES_PER_QUARTER_NOTE } from '../../utils/noteConversion';
import { MidiTrack } from 'src/platform/types/track_models/midi_track';
import { AudioTrackOptions, SamplerTrackOptions, MidiTrackOptions } from '../types';
import { AudioTrackRead, MidiTrackRead, SamplerTrackRead, DrumTrackRead } from 'src/platform/types/project';
import { AnyTrackRead } from 'src/types/track';

// Define the state properties and actions for this slice
export interface TracksSlice {
  tracks: CombinedTrack[];
  
  // Basic state manipulation
  setTracks: (tracks: CombinedTrack[]) => void;
  updateTracks: (newTracks: CombinedTrack[]) => void;
  updateTrackState: (trackId: string, updates: Partial<CombinedTrack & TrackParameter>) => void;
  findTrackById: (trackId: string) => CombinedTrack | undefined;
  updateTrackIndices: () => void;

  // Core track operations (creation/deletion)
  // Note: These will interact heavily with the audio engine and history
  createTrackAndRegisterWithHistory: (type: TrackType, name: string, options?: TrackOptions) => Promise<CombinedTrack | null>;
  handleTrackDelete: (trackId: string) => Promise<void>;

  // Parameter change handlers (generic and specific)
  // These update both the track state and the audio engine, and register history
  handleTrackParameterChange: <K extends keyof TrackParameter>(trackId: string, paramName: K, newValue: TrackParameter[K]) => void;
  handleTrackVolumeChange: (trackId: string, volume: number) => void;
  handleTrackPanChange: (trackId: string, pan: number) => void;
  handleTrackMuteToggle: (trackId: string, muted: boolean) => void;
  handleTrackSoloToggle: (trackId: string, soloed: boolean) => void;
  handleTrackPositionChange: (trackId: string, newPosition: Position, isDragEnd: boolean) => void;
  handleTrackNameChange: (trackId: string, name: string) => void;

  // Add definition for uploadAudioFile
  uploadAudioFile: (file: File, isSampler?: boolean) => Promise<CombinedTrack | null>;

  // Potentially other track-related actions/helpers
  // replaceTrackAudioFile: (trackId: string, file: File) => Promise<void>;
  // handleInstrumentChange: ...

  // Add resize action definition
  handleTrackResizeEnd: (trackId: string, deltaPixels: number, resizeDirection: 'left' | 'right') => void;

  // Add missing action definitions
  handleAddTrack: (type: TrackType, instrumentId?: string, instrumentName?: string, instrumentStorageKey?: string) => Promise<CombinedTrack | { mainDrumTrack: CombinedTrack | null, samplerTracks: (CombinedTrack | null)[] } | null>;
  handleInstrumentChange: (trackId: string, instrumentId: string, instrumentName: string, instrumentStorageKey: string) => Promise<void>; 
  replaceTrackAudioFile: (trackId: string, file: File) => Promise<void>;

  // Expose internal helper for nested updates
  _updateNestedTrackData: (trackId: string, nestedUpdates: Partial<any>) => void; // Use Partial<any> for simplicity or define specific update types
}

// Create the slice function
export const createTracksSlice: StoreSliceCreator<TracksSlice> = (set, get) => {
  const rootGet = get as GetFn; // Helper to access root state with correct typing

  // Utility to set state within this slice or the root state
  const setTracksState = (partial: Partial<TracksSlice> | ((state: TracksSlice) => Partial<TracksSlice>)) => set(partial);
  const updateRootState = <K extends keyof RootState>(
    key: K, 
    value: RootState[K] | ((prev: RootState[K]) => RootState[K])
  ) => {
    const rootUpdater = rootGet()._updateState;
    if (rootUpdater && typeof rootUpdater === 'function') {
      // Pass the value/function directly to the root updater
      rootUpdater(key, value);
    } else {
      console.warn(`_updateState not found, using direct set for key: ${String(key)}`);
      // Pass the value/function directly to Zustand's set
      set({ [key]: value }); 
    }
  };

  // Find a track by ID (local helper)
  const findTrackById = (trackId: string): CombinedTrack | undefined => {
    return rootGet().tracks.find((t: CombinedTrack) => t.id === trackId);
  };

  // Update a specific track's state in the tracks array
  const updateTrackState = (trackId: string, updates: Partial<CombinedTrack & TrackParameter>) => {
    updateRootState('tracks', (prevTracks) =>
      prevTracks.map((track) =>
        track.id === trackId ? { ...track, ...updates } : track
      )
    );
  };

  // Update all tracks and recalculate indices
  const updateTracks = (newTracks: CombinedTrack[]) => {
    // Directly set the new tracks array
    set({ tracks: newTracks });
    // Fix: Remove automatic index update. Let other parts call it explicitly.
    // get().updateTrackIndices(); 
    console.log("updateTracks called, set new tracks array reference."); // Add log
  };

  // Action to recalculate and add/update the index property for UI ordering
  const updateTrackIndices = () => {
    console.log("updateTrackIndices called"); // Add log
    updateRootState('tracks', (prevTracks) => 
      prevTracks.map((track, index) => ({
        ...track,
        index // Add/update the index property
      }))
    );
  };

  // Internal helper to update the nested track object
  const _updateNestedTrackData = (trackId: string, nestedUpdates: Partial<AudioTrackRead | MidiTrackRead | SamplerTrackRead | DrumTrackRead>) => {
    console.log(`_updateNestedTrackData called for ${trackId}`, nestedUpdates);
    console.log(`_updateNestedTrackData: prevTracks`, rootGet().tracks);
    updateRootState('tracks', (prevTracks) => 
      prevTracks.map((track) => {
        if (track.id === trackId) {
          // Fix: Ensure base object includes required fields before merging updates
          const baseNestedTrack = track.track || { id: track.id, name: track.name, type: track.type };
          const newNestedTrack = { 
              // Spread base with guaranteed id/name/type
              ...baseNestedTrack, 
              // Apply the specific nested updates
              ...nestedUpdates        
          };
          // Explicitly cast the final nested object if necessary, or ensure types match
          console.log(`_updateNestedTrackData: newNestedTrack`, newNestedTrack);
          return { ...track, track: newNestedTrack as AnyTrackRead }; // Use a union type or cast
        }
        return track; 
      })
    );
  };

  // --- TODO: Implement Core Track Operations (createTrackAndRegisterWithHistory, handleTrackDelete) --- 
  const createTrackAndRegisterWithHistory = async (
    type: TrackType,
    name: string,
    options: TrackOptions = {}
  ): Promise<CombinedTrack | null> => {
    // Access cross-slice state/actions via rootGet()
    const { store, timeSignature, bpm, tracks, executeHistoryAction, _withStore, _withErrorHandling } = rootGet();

    if (!_withStore || !_withErrorHandling) {
        console.error("_withStore or _withErrorHandling not available");
        return null;
    }

    const createLogic = async (store: Store): Promise<CombinedTrack | null> => {
      const trackId = (options.id || options.trackId) ?? crypto.randomUUID(); 
      const tracksLength = rootGet().tracks.length;
      const position = options.position as Position || { x: 0, y: tracksLength * GRID_CONSTANTS.trackHeight };
      
      const trackProps = {
        id: trackId,
        volume: options.volume ?? 80,
        pan: options.pan ?? 0,
        muted: options.muted ?? false,
        soloed: options.soloed ?? false,
        // Include potentially relevant options if needed by store.createTrack
        instrumentId: (options as any).instrumentId,
        instrumentName: (options as any).instrumentName,
        instrumentStorageKey: (options as any).instrumentStorageKey,
      };
      
      const typeConfig = TRACK_CONFIG[type];
      if (!typeConfig) throw new Error(`Invalid track type: ${type}`);
      
      // Extract the file object early
      const file = type === 'audio' ? (options as AudioTrackOptions).audioFile : 
                   type === 'sampler' ? (options as SamplerTrackOptions).sampleFile : 
                   undefined;

      await store.getAudioEngine().createTrack(trackId, name); 
      
      // Calculate defaults
      const beatsPerBar = timeSignature[0]; 
      const defaultBars = 4;
      const totalBeats = defaultBars * beatsPerBar;
      // TODO: Confirm PULSES_PER_QUARTER_NOTE is appropriate for ticks calculation relative to project settings
      const defaultDurationTicks = totalBeats * PULSES_PER_QUARTER_NOTE; 
      
      // Build base trackData (serializable)
      const trackData: Omit<CombinedTrack, 'track'> & { track?: any } = {
        id: trackId,
        name: name, 
        type: type,
        volume: trackProps.volume,
        pan: trackProps.pan,
        mute: trackProps.muted, 
        x_position: position.x,
        y_position: position.y,
        trim_start_ticks: options.trim_start_ticks ?? 0,
        trim_end_ticks: options.trim_end_ticks ?? null,
        duration_ticks: options.duration ?? defaultDurationTicks, 
      };
      
      // Get initial *serializable* nested track properties
      const typeSpecificProps = typeConfig.initTrack(trackId, undefined); // Pass undefined for file here
      Object.assign(trackData, typeSpecificProps); // Assign top-level props like baseMidiNote
      let nestedTrackDataObject: any = { ...typeSpecificProps, type, id: trackId, name: name };
      
      // Add only *serializable* type-specific data available at creation
      if (type === 'midi') {
          const midiOptions = options as MidiTrackOptions;
          nestedTrackDataObject = {
              ...nestedTrackDataObject,
              instrument_id: midiOptions.instrumentId,
              instrument_name: midiOptions.instrumentName,
              instrument_storage_key: midiOptions.instrumentStorageKey,
              notes: [], 
              // Construct instrument_file object
              instrument_file: midiOptions.instrumentId ? { 
                  id: midiOptions.instrumentId, 
                  name: midiOptions.instrumentName || '', 
                  storage_key: midiOptions.instrumentStorageKey || '' 
              } : undefined
          } as MidiTrack;
      } 
      else if (type === 'audio') {
          const audioOptions = options as AudioTrackOptions;
          nestedTrackDataObject = {
              ...nestedTrackDataObject,
              audio_file_storage_key: audioOptions.storage_key,
              audio_file_name: audioOptions.audio_file_name, // Get name from extracted file variable
              // Metadata initialized as undefined
              audio_file_format: audioOptions.audio_file_format,
              audio_file_size: audioOptions.audio_file_size,
              audio_file_duration: audioOptions.audio_file_duration,
              audio_file_sample_rate: audioOptions.audio_file_sample_rate,
          } // NO audioFile property here
      }
      else if (type === 'sampler') {
           const samplerOptions = options as SamplerTrackOptions;
           nestedTrackDataObject = {
              ...nestedTrackDataObject,
              baseMidiNote: samplerOptions.baseMidiNote ?? DEFAULT_SAMPLER_CONFIG.baseMidiNote,
              grainSize: samplerOptions.grainSize ?? DEFAULT_SAMPLER_CONFIG.grainSize,
              overlap: samplerOptions.overlap ?? DEFAULT_SAMPLER_CONFIG.overlap,
              audio_file_name: file?.name // Get name from extracted file variable
              // NO sampleFile property here
           }
      }
      
      const finalTrackData = { 
          ...trackData, 
          track: nestedTrackDataObject as AnyTrackRead 
      } as CombinedTrack;

      // Create action, passing the serializable trackData AND the separate file object
      const action = new Actions.AddTrack(get, finalTrackData, file); 
      
      // Execute history action 
      await rootGet().executeHistoryAction(action);
      
      return finalTrackData; 
    };

    return _withErrorHandling(async () => _withStore(createLogic)(), `createTrackAndRegisterWithHistory: ${type}`)();
  };

  const handleTrackDelete = async (trackId: string) => {
      // Access cross-slice action via rootGet()
      const { store, tracks, executeHistoryAction, _withStore, _withErrorHandling } = rootGet();
      const trackToDelete = findTrackById(trackId);

      if (!trackToDelete) {
          console.error(`Track ${trackId} not found for deletion`);
          return;
      }

      if (!_withStore || !_withErrorHandling) {
          console.error("_withStore or _withErrorHandling not available for delete");
          return;
      }

      const deleteLogic = async (store: Store) => {
          const action = new Actions.DeleteTrack(get, { ...trackToDelete }); 

          // Update state first
          rootGet()._updateState('tracks', (prevTracks) => prevTracks.filter(t => t.id !== trackId));
          rootGet().updateTrackIndices(); 

          // Remove from engine with error handling
          try {
            await store.getAudioEngine().removeTrack(trackId);
          } catch (engineError) {
             console.error(`Error removing track ${trackId} from audio engine:`, engineError);
             // Decide if failure here should prevent history action or state update rollback
          }
          
          // TODO: Disconnect logic (placeholders)
          try {
              if (trackToDelete.type === 'sampler') {
                  // Remove potentially incorrect disconnect call
                  // store.getTransport().getSamplerController()?.removeTrackSubscription(trackId);
                  console.log(`Placeholder: Disconnect/cleanup sampler track ${trackId} subscription`);
              }
              if (trackToDelete.type === 'midi') {
                  // store.disconnectTrackFromSoundfont(trackId)? 
                  console.log(`Placeholder: Disconnect MIDI track ${trackId} from soundfont/manager`);
              }
          } catch (disconnectError) {
              console.error(`Error during track disconnection for ${trackId}:`, disconnectError);
          }

          // Execute history action 
          await rootGet().executeHistoryAction(action); // Use get() to call historySlice action
      };

      await _withErrorHandling(async () => _withStore(deleteLogic)(), `handleTrackDelete: ${trackId}`)();
  };

  // --- Parameter Change Handlers --- 
  const handleTrackParameterChange = <K extends keyof TrackParameter>(
    trackId: string, 
    paramName: K, 
    newValue: TrackParameter[K]
  ) => {
    // Access cross-slice action via rootGet()
    const { store, executeHistoryAction, _withStore, _withErrorHandling } = rootGet();

    if (!_withStore || !_withErrorHandling) {
      console.error("_withStore or _withErrorHandling not available for parameter change");
      return;
    }

    const changeLogic = (store: Store) => {
      const track = findTrackById(trackId);
      if (!track) {
        console.error(`Track with ID ${trackId} not found in handleTrackParameterChange`);
        return;
      }
      
      // Fix 1: Cast track to any for indexed access based on K
      const oldValue = (track as any)[paramName]; 
      // Skip if value hasn't changed (handle object comparison for position separately)
      if (paramName !== 'position' && oldValue === newValue) return;
      
      // Prepare update object, handling potential differences between TrackParameter keys and CombinedTrack keys
      const updateObj: Partial<CombinedTrack & TrackParameter> = {};
      let engineUpdateNeeded = true;
      let historyParamName = paramName as string;

      if (paramName === 'muted') {
        updateObj.mute = newValue as boolean; // Update 'mute' property in CombinedTrack
        updateObj.muted = newValue as boolean; // Also update 'muted' if it exists as a separate param
      } else if (paramName === 'name') {
        updateObj.name = newValue as string;
        engineUpdateNeeded = false; // Name change doesn't affect audio engine directly
      } else if (paramName === 'position') {
         // Position is handled by handleTrackPositionChange
         console.warn("Direct position change via handleTrackParameterChange is discouraged. Use handleTrackPositionChange.");
         engineUpdateNeeded = false;
         return; // Exit early
      } else if (paramName === 'soloed') {
         // Solo is handled by handleTrackSoloToggle
         console.warn("Direct solo change via handleTrackParameterChange is discouraged. Use handleTrackSoloToggle.");
         engineUpdateNeeded = false;
         return; // Exit early
      } else {
        // For volume, pan, etc., the key names should match
        (updateObj as any)[paramName] = newValue;
      }
      
      // --- Update State --- 
      updateTrackState(trackId, updateObj);
      
      // --- Update Audio Engine --- 
      if (engineUpdateNeeded) {
        const audioEngine = store.getAudioEngine();
        switch (paramName) {
          case 'volume':
            audioEngine.setTrackVolume(trackId, newValue as number);
            break;
          case 'pan':
            audioEngine.setTrackPan(trackId, newValue as number);
            break;
          case 'muted':
            audioEngine.setTrackMute(trackId, newValue as boolean);
            break;
          // Position handled separately
          // Solo handled separately
        }
      }
      
      // --- Create and Execute History Action --- 
      // Fix 1: Robust conversion to number for history action values
      const convertToActionValue = (val: any): number => {
        if (typeof val === 'boolean') return val ? 1 : 0;
        if (typeof val === 'number') return val;
        // Default non-numeric/non-boolean types to 0 for ParameterChange action
        // This might need refinement based on how ParameterChange handles strings/objects
        return 0; 
      };
      const oldActionValue = convertToActionValue(oldValue);
      const newActionValue = convertToActionValue(newValue);
      
      // Use Actions.ParameterChange
      const action = new Actions.ParameterChange(
        get,
        trackId,
        historyParamName as any, 
        oldActionValue,
        newActionValue
      );
      
      executeHistoryAction(action);
    };

    // Wrap the logic
    _withErrorHandling(async () => _withStore(changeLogic)(), `handleTrackParameterChange: ${String(paramName)}`)();
  };

  const handleTrackPositionChange = (trackId: string, newPosition: Position, isDragEnd: boolean) => {
    // Access cross-slice state/actions via rootGet()
    const { store, bpm, timeSignature, isPlaying, executeHistoryAction, _withErrorHandling } = rootGet();

    if (!_withErrorHandling) {
        console.error("_withErrorHandling is not available in handleTrackPositionChange");
        return;
    }

    // Fix 3: Make changeLogic async
    const changeLogic = async () => {
        if (!store) {
            console.error('Store not available in handleTrackPositionChange');
            return;
        }
        
        const track = findTrackById(trackId);
        if (!track) {
            console.error(`Track ${trackId} not found in handleTrackPositionChange`);
            return;
        }
        
        const oldPosition = { x: track.x_position, y: track.y_position }; // Get old position from track state

        // Skip if nothing changed at drag end
        if (isDragEnd && 
            oldPosition.x === newPosition.x && 
            oldPosition.y === newPosition.y) {
            console.log('No position change detected - skipping update');
            return;
        }
        
        console.log(`TracksSlice processing position change: trackId=${trackId}, isDragEnd=${isDragEnd}`, 
            { newPosition, oldPosition });
        
        // Update track state
        updateTrackState(trackId, { 
            x_position: newPosition.x, 
            y_position: newPosition.y, 
            position: { ...newPosition }
        });
        
        // Update audio engine
        store.getAudioEngine().setTrackPosition(trackId, newPosition.x, newPosition.y);
        
        if (isDragEnd) {
            // Use Actions.TrackPosition
            const action = new Actions.TrackPosition(
                get,
                trackId,
                { ...oldPosition },
                { ...newPosition }
            );
            await executeHistoryAction(action);
            
            if (isPlaying && store.getTransport().handleTrackPositionChange) {
              store.getTransport().handleTrackPositionChange(trackId, newPosition.x);
            }
        }
    };
    
    _withErrorHandling(changeLogic, 'handleTrackPositionChange')(); // Pass async function directly
  };

  const handleTrackSoloToggle = (trackId: string, soloed: boolean) => {
    // Access cross-slice action via rootGet()
    const { store, tracks, executeHistoryAction, _withStore, _withErrorHandling } = rootGet();

    if (!_withStore || !_withErrorHandling) {
      console.error("_withStore or _withErrorHandling not available for solo toggle");
      return;
    }

    const soloLogic = (store: Store) => {
        updateTrackState(trackId, { soloed: soloed, solo: soloed }); // Use local helper

        const currentTracks = rootGet().tracks;
        const targetTrack = currentTracks.find(t => t.id === trackId);
        if (!targetTrack) return; // Should not happen if updateTrackState worked
        
        // Re-evaluate solo status based on the *current* state of all tracks
        const isAnyTrackSoloed = currentTracks.some(t => (t as any).soloed); 

        const audioEngine = store.getAudioEngine();
        const historyActions = [];

        for (const track of currentTracks) {
            const oldMuteState = track.mute;
            const shouldBeMuted = isAnyTrackSoloed ? !(track as any).soloed : false; // If nothing soloed, unmute all? Or restore previous? Let's unmute for now.
            
            if (oldMuteState !== shouldBeMuted) {
                updateTrackState(track.id, { mute: shouldBeMuted }); // Use local helper
                audioEngine.setTrackMute(track.id, shouldBeMuted);
                
                const action = new Actions.ParameterChange( get, track.id, 'muted', oldMuteState ? 1 : 0, shouldBeMuted ? 1 : 0 );
                historyActions.push(action);
            }
        }
        // Use get() to call historySlice action
        historyActions.forEach(action => rootGet().executeHistoryAction(action));
    };

    _withErrorHandling(async () => _withStore(soloLogic)(), `handleTrackSoloToggle: ${trackId}`)();
  };

  // Implementation for uploadAudioFile
  const uploadAudioFile = async (
    file: File, 
    isSampler = false
  ): Promise<CombinedTrack | null> => {
    const { _withErrorHandling } = rootGet();
    
    const uploadLogic = async (): Promise<CombinedTrack | null> => {
        const trackName = file.name.split('.').slice(0, -1).join('.') || file.name; // Get filename without extension
        const trackType: TrackType = isSampler ? 'sampler' : 'audio';
        
        const options: TrackOptions = isSampler 
            ? { sampleFile: file, ...DEFAULT_SAMPLER_CONFIG } 
            : { audioFile: file };
        
        // Call the main track creation function (already handles history)
        // Assuming createTrackAndRegisterWithHistory is available via get()
        const newTrack = await get().createTrackAndRegisterWithHistory(trackType, trackName, options);
        
        if (!newTrack) {
          throw new Error(`Failed to create ${trackType} track from file upload`);
        }
        
        return newTrack;
    };

    // Wrap with error handling
    if (!_withErrorHandling) {
        console.error("_withErrorHandling not available for uploadAudioFile");
        // Attempt without handler?
        try { return await uploadLogic(); } catch { return null; }
    }
    return _withErrorHandling(uploadLogic, 'uploadAudioFile')();
  };

  // Handles track resize end event, creates history action
  const handleTrackResizeEnd = (trackId: string, deltaPixels: number, resizeDirection: 'left' | 'right'): void => {
    const { store, tracks, bpm, timeSignature, executeHistoryAction, _withErrorHandling } = rootGet();
    const fullTrack = findTrackById(trackId);
    if (!fullTrack || !store || !executeHistoryAction || !_withErrorHandling) { return; }

    const resizeLogic = async () => {
        const oldTrimStartTicks = fullTrack.trim_start_ticks || 0;
        const oldTrimEndTicks = fullTrack.trim_end_ticks || fullTrack.duration_ticks || 0; 
        const oldPositionX = fullTrack.x_position || 0;
        const deltaTicks = pixelsToTicks(deltaPixels, bpm, timeSignature);

        let newTrimStartTicks = oldTrimStartTicks;
        let newTrimEndTicks = oldTrimEndTicks;
        let newPositionX = oldPositionX;

        if (resizeDirection === 'left') {
            newTrimStartTicks = oldTrimStartTicks + deltaTicks;
            newPositionX = oldPositionX + deltaTicks;
            newTrimStartTicks = Math.max(0, Math.min(newTrimStartTicks, oldTrimEndTicks));
            newPositionX = Math.max(0, newPositionX);
        } else { 
            newTrimEndTicks = oldTrimEndTicks + deltaTicks;
            newTrimEndTicks = Math.max(newTrimStartTicks, newTrimEndTicks);
        }

        // Create the history action without width params
        const action = new Actions.TrackResize(
            get, 
            trackId,
            oldTrimStartTicks,
            oldTrimEndTicks,
            oldPositionX,
            newTrimStartTicks,
            newTrimEndTicks,
            newPositionX
        );
        
        await executeHistoryAction(action); 
    };
    _withErrorHandling(resizeLogic, 'handleTrackResizeEnd')();
  };

  // Add Track - Implemented
  const handleAddTrack = async (
    type: TrackType, 
    instrumentId?: string, 
    instrumentName?: string, 
    instrumentStorageKey?: string
  ): Promise<CombinedTrack | { mainDrumTrack: CombinedTrack | null, samplerTracks: (CombinedTrack | null)[] } | null> => {
      // Use _withErrorHandling and access needed actions via get()
      const { tracks, createTrackAndRegisterWithHistory, openDrumMachine, _withErrorHandling } = rootGet();
      
      if (!_withErrorHandling || !createTrackAndRegisterWithHistory || (type === 'drum' && !openDrumMachine) ) {
          console.error("handleAddTrack: Missing dependencies");
          return null;
      }

      const addLogic = async () => {
          // Special handling for drum tracks (copied from original store)
          if (type === 'drum') {
            // Create default samplers for drum track
            const defaultSamplerNames = ['Kick', 'Snare', 'Clap', 'Hi-Hat'];
            // Use createTrackAndRegisterWithHistory from the store
            const samplerPromises = defaultSamplerNames.map(name => 
                createTrackAndRegisterWithHistory('sampler', name, { /* Default sampler options? */ }) 
            );
            
            const createdSamplerTracks = (await Promise.all(samplerPromises)).filter(Boolean) as CombinedTrack[];
            const samplerTrackIds = createdSamplerTracks.map(track => track.id);
            
            // Create main drum track with references to samplers
            const count = rootGet().tracks.length + 1; // Get current track count
            const mainDrumTrackName = TRACK_CONFIG.drum.getDefaultName(count, instrumentName);
            
            const mainDrumTrack = await createTrackAndRegisterWithHistory('drum', mainDrumTrackName, {
                instrumentName: 'Drum Sequencer', // Or pass provided name?
                samplerTrackIds: samplerTrackIds
            });
            
            // Open UI for the main drum track
            if (mainDrumTrack && openDrumMachine) {
                openDrumMachine(mainDrumTrack.id);
            }
            
            // Return structure specific to drum track creation
            return { mainDrumTrack, samplerTracks: createdSamplerTracks };
          }
          
          // --- Standard track creation --- 
          const count = rootGet().tracks.length + 1; // Get current track count
          // Ensure TRACK_CONFIG is accessible or imported
          const trackName = TRACK_CONFIG[type]?.getDefaultName(count, instrumentName) || `Track ${count}`;
          
          // Use createTrackAndRegisterWithHistory from the store
          console.log("Creating track with options:", {
            instrumentId,
            instrumentName,
            instrumentStorageKey
          });
          const trackData = await createTrackAndRegisterWithHistory(type, trackName, {
            instrumentId,
            instrumentName,
            instrumentStorageKey
            // Pass other relevant options if available/needed
          });
          
          return trackData; // Return the single created track
      }
      
      // Wrap the logic with error handling
      return _withErrorHandling(addLogic, 'handleAddTrack')();
  };

  // Handle Instrument Change (placeholder, needs track update and engine calls)
  const handleInstrumentChange = async (
    trackId: string, 
    instrumentId: string, 
    instrumentName: string, 
    instrumentStorageKey: string
  ): Promise<void> => {
    console.warn("handleInstrumentChange needs implementation in tracksSlice");
    // Original logic:
    // const { store, updateTrackState } = get();
    // const track = findTrackById(trackId);
    // if (!track) return;
    // updateTrackState(trackId, { instrument_id: ..., instrument_name: ..., instrument_storage_key: ... });
    // if (track.type === 'midi') { 
    //   await TRACK_CONFIG.midi.initEngine(store, trackId, undefined, instrumentId);
    // } else { 
    //   await store.connectTrackToSoundfont(trackId, instrumentId); 
    // }
  };

  // Replace Track Audio File (placeholder, needs findTrackById, engine calls, sampler init)
  const replaceTrackAudioFile = async (trackId: string, file: File): Promise<void> => {
      console.warn("replaceTrackAudioFile needs implementation in tracksSlice");
      // Original logic:
      // const { store, findTrackById, updateTrackState, _withErrorHandling } = get();
      // const track = findTrackById(trackId);
      // ... checks ...
      // if (track.type === 'sampler') store?.getTransport().getSamplerController()?.getSampler(trackId)?.stopPlayback();
      // await updateTrackWithAudioInfo(trackId, file); // Need this helper or its logic
      // const updates = track.type === 'audio' ? { audioFile: file } : { sampleFile: file };
      // if (track.type === 'sampler') await initializeSampler(trackId, file, {...}); // Need initializeSampler helper
      // updateTrackState(trackId, updates);
  };

  // --- Initial State & Return --- 
  return {
    tracks: [],

    // Basic state manipulation
    setTracks: (newTracks) => set({ tracks: newTracks }),
    updateTracks,
    updateTrackState,
    findTrackById,
    updateTrackIndices,

    // Core track operations
    createTrackAndRegisterWithHistory,
    handleTrackDelete,

    // Parameter change handlers
    handleTrackParameterChange,
    handleTrackVolumeChange: (trackId, volume) => handleTrackParameterChange(trackId, 'volume', volume),
    handleTrackPanChange: (trackId, pan) => handleTrackParameterChange(trackId, 'pan', pan),
    handleTrackMuteToggle: (trackId, muted) => handleTrackParameterChange(trackId, 'muted', muted),
    handleTrackSoloToggle,
    handleTrackPositionChange,
    handleTrackNameChange: (trackId, name) => handleTrackParameterChange(trackId, 'name', name),

    // Add definition for uploadAudioFile
    uploadAudioFile,

    // Add resize action definition
    handleTrackResizeEnd,

    // Add missing action definitions
    handleAddTrack,
    handleInstrumentChange,
    replaceTrackAudioFile,

    // Expose internal helper for nested updates
    _updateNestedTrackData,
  };
};

// Helper type (add to types.ts ideally, or define locally for now)