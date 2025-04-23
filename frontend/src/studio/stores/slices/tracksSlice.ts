import { CombinedTrack } from 'src/platform/types/project';
import { Position } from '../../components/track';
import { RootState, SetFn, GetFn, TrackParameter, TrackType, TrackOptions, AddTrackPayload, DrumTrackPayload, MidiTrackPayload, AudioTrackOptions, SamplerTrackOptions, MidiTrackOptions, AnyTrackRead, MidiTrack, AudioTrack, SamplerTrack, AudioTrackRead, MidiTrackRead, SamplerTrackRead, DrumTrackRead } from '../types';
import { Store } from '../../core/state/store';
import { Actions } from '../../core/state/history/actions'; 
import { TRACK_CONFIG, DEFAULT_SAMPLER_CONFIG } from '../config';
import { GRID_CONSTANTS, ticksToPixels, pixelsToTicks } from '../../constants/gridConstants';
import { PULSES_PER_QUARTER_NOTE } from '../../utils/noteConversion';
import { StateCreator } from 'zustand';
import { StoreApi } from 'zustand';

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
  handleAddTrack: (type: TrackType, payload?: AddTrackPayload) => Promise<CombinedTrack | { mainDrumTrack: CombinedTrack | null, samplerTracks: (CombinedTrack | null)[] } | null>;
  handleInstrumentChange: (trackId: string, instrumentId: string, instrumentName: string, instrumentStorageKey: string) => Promise<void>; 
  replaceTrackAudioFile: (trackId: string, file: File) => Promise<void>;

  // Expose internal helper for nested updates
  _updateNestedTrackData: (trackId: string, nestedUpdates: Partial<AnyTrackRead>) => void; // Use AnyTrackRead
}

// Remove local type alias if it causes confusion
// type TracksSliceCreator = StateCreator<RootState, [], [], TracksSlice>;

// Revert to the simpler definition without explicit StateCreator and third argument
export const createTracksSlice = (set, get) => { 
  const rootGet = get as GetFn; 
  // Get store instance via rootGet when needed inside functions
  // const storeInstance = rootGet().store; // Don't get it here at the top level

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
  const _updateNestedTrackData = (trackId: string, nestedUpdates: Partial<AnyTrackRead>) => {
    console.log(`_updateNestedTrackData called for ${trackId}`, nestedUpdates);
    const rootState = get(); // Use get() to access full state
    console.log(`_updateNestedTrackData: prevTracks`, rootState.tracks);
    rootState._updateState('tracks', (prevTracks) => 
      prevTracks.map((track) => {
        if (track.id === trackId) {
          // Ensure base object includes required fields before merging updates
          // Assuming track.track might be initially undefined or incomplete
          // Omit 'type' from the fallback base object
          const baseNestedTrack: Partial<AnyTrackRead> = track.track ? { ...track.track } : { id: track.id, name: track.name };
          const newNestedTrack = { 
              ...baseNestedTrack,
              ...nestedUpdates        
          };
          console.log(`_updateNestedTrackData: newNestedTrack`, newNestedTrack);
          // Ensure the final object conforms to AnyTrackRead
          return { ...track, track: newNestedTrack as AnyTrackRead }; 
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
    const { timeSignature, bpm, tracks, executeHistoryAction, _withStore, _withErrorHandling } = rootGet();

    if (!_withStore || !_withErrorHandling) {
        console.error("_withStore or _withErrorHandling not available");
        return null;
    }

    const createLogic = async (passedStore: Store): Promise<CombinedTrack | null> => {
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

      await passedStore.getAudioEngine().createTrack(trackId, name); 
      
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
              audio_file_name: file?.name, // Get name from extracted file variable
              storage_key: samplerOptions.storage_key,
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
      const { tracks, executeHistoryAction, _withStore, _withErrorHandling } = rootGet();
      const storeInstance = rootGet().store; // Get the Store instance
      const trackToDelete = findTrackById(trackId);

      if (!trackToDelete) {
          console.error(`Track ${trackId} not found for deletion`);
          return;
      }

      if (!storeInstance) {
          console.error("_withStore not available for delete");
          return;
      }
      if (!_withStore || !_withErrorHandling) {
          console.error("_withStore or _withErrorHandling not available for delete");
          return;
      }

      const deleteLogic = async (passedStore: Store) => {
          const action = new Actions.DeleteTrack(get, { ...trackToDelete }); 

          // Update state first
          rootGet()._updateState('tracks', (prevTracks) => prevTracks.filter(t => t.id !== trackId));
          rootGet().updateTrackIndices(); 

          // Remove from engine with error handling
          try {
            await passedStore.getAudioEngine().removeTrack(trackId);
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
    const { executeHistoryAction, _withStore, _withErrorHandling } = rootGet();
    // Get store instance inside the handler if not using _withStore
    const currentStoreInstance = rootGet().store; 
    if (!currentStoreInstance) {
      console.error("_withStore not available for parameter change");
      return;
    }
    if (!_withStore || !_withErrorHandling) {
      console.error("_withStore or _withErrorHandling not available for parameter change");
      return;
    }

    // Make changeLogic async to ensure it returns a Promise
    const changeLogic = async (passedStore: Store) => { // _withStore still provides it
      const track = findTrackById(trackId); 
      if (!track) { 
        console.error(`Track with ID ${trackId} not found in handleTrackParameterChange`);
        return; 
      }
      const oldValue = (track as any)[paramName];
      if (paramName !== 'position' && oldValue === newValue) return;

      // Prepare update object
      const updateObj: Partial<CombinedTrack & TrackParameter> = {};
      let engineUpdateNeeded = true;
      let historyParamName = paramName as string;

      if (paramName === 'muted') {
        updateObj.mute = newValue as boolean; 
        updateObj.muted = newValue as boolean; 
      } else if (paramName === 'name') {
        updateObj.name = newValue as string;
        engineUpdateNeeded = false; 
      } else if (paramName === 'position' || paramName === 'soloed') {
         // Should be handled by specific handlers, exit here
         console.warn(`Direct change via handleTrackParameterChange is discouraged for ${paramName}.`);
         engineUpdateNeeded = false;
         return;
      } else {
        (updateObj as any)[paramName] = newValue;
      }

      // Update State
      updateTrackState(trackId, updateObj);
      
      // Update Audio Engine 
      if (engineUpdateNeeded) {
        const audioEngine = passedStore.getAudioEngine();
        switch (paramName) {
          case 'volume': audioEngine.setTrackVolume(trackId, newValue as number); break;
          case 'pan': audioEngine.setTrackPan(trackId, newValue as number); break;
          // Mute/Solo handled by specific handlers
        }
      }
      
      // Create and Execute History Action
      const convertToActionValue = (val: any): number => {
        if (typeof val === 'boolean' ) return val ? 1 : 0;
        if (typeof val === 'number' ) return val;
        return 0; 
      };
      const oldActionValue = convertToActionValue(oldValue);
      const newActionValue = convertToActionValue(newValue);
      
      const action = new Actions.ParameterChange(
        get,
        trackId,
        historyParamName as any, 
        oldActionValue,
        newActionValue
      );
      
      await executeHistoryAction(action); // Await the history action
    };

    // Pass the _withStore HOF result to _withErrorHandling
    _withErrorHandling(async () => _withStore(changeLogic)(), `handleTrackParameterChange: ${String(paramName)}`)(); 
  };

  const handleTrackPositionChange = (trackId: string, newPosition: Position, isDragEnd: boolean) => {
    const { bpm, timeSignature, isPlaying, executeHistoryAction, _withErrorHandling } = rootGet();
    const storeInstance = rootGet().store; // Get the Store instance

    if (!storeInstance) {
        console.error("_withErrorHandling is not available in handleTrackPositionChange");
        return;
    }
    if (!_withErrorHandling) {
        console.error("_withErrorHandling is not available in handleTrackPositionChange");
        return;
    }

    // Fix 3: Make changeLogic async
    const changeLogic = async () => {
        if (!storeInstance) {
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
        storeInstance.getAudioEngine().setTrackPosition(trackId, newPosition.x, newPosition.y);
        
        if (isDragEnd) {
            // Use Actions.TrackPosition
            const action = new Actions.TrackPosition(
                get,
                trackId,
                { ...oldPosition },
                { ...newPosition }
            );
            await executeHistoryAction(action);
            
            if (isPlaying && storeInstance.getTransport()?.handleTrackPositionChange) {
              storeInstance.getTransport().handleTrackPositionChange(trackId, newPosition.x);
            }
        }
    };
    
    _withErrorHandling(changeLogic, 'handleTrackPositionChange')(); // Pass async function directly
  };

  const handleTrackSoloToggle = (trackId: string, soloed: boolean) => {
    const { tracks, executeHistoryAction, _withStore, _withErrorHandling } = rootGet();
    const storeInstance = rootGet().store; // Get the Store instance

    if (!storeInstance) {
      console.error("_withStore or _withErrorHandling not available for solo toggle");
      return;
    }
    if (!_withStore || !_withErrorHandling) {
      console.error("_withStore or _withErrorHandling not available for solo toggle");
      return;
    }

    const soloLogic = (passedStore: Store) => {
        updateTrackState(trackId, { soloed: soloed, solo: soloed }); // Use local helper

        const currentTracks = rootGet().tracks;
        const targetTrack = currentTracks.find(t => t.id === trackId);
        if (!targetTrack) return; // Should not happen if updateTrackState worked
        
        // Re-evaluate solo status based on the *current* state of all tracks
        const isAnyTrackSoloed = currentTracks.some(t => (t as any).soloed); 

        const audioEngine = passedStore.getAudioEngine();
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
    const { bpm, timeSignature, executeHistoryAction, _withErrorHandling } = rootGet();
    const fullTrack = findTrackById(trackId);
    if (!fullTrack || !_withErrorHandling) { return; }

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

  // --- Updated handleAddTrack Implementation --- 
  const handleAddTrack = async (
    type: TrackType, 
    payload?: AddTrackPayload
  ): Promise<CombinedTrack | { mainDrumTrack: CombinedTrack | null, samplerTracks: (CombinedTrack | null)[] } | null> => {
      const rootState = get(); 
      // Access actions/state needed from the root state
      const { createTrackAndRegisterWithHistory, openDrumMachine, _withErrorHandling } = rootState;
      
      if (!_withErrorHandling || !createTrackAndRegisterWithHistory) {
          console.error("handleAddTrack: Missing dependencies (_withErrorHandling, createTrackAndRegisterWithHistory)");
          return null;
      }

      const addLogic = async () => {
          // --- Drum Track Creation (Revised Logic) --- 
          if (type === 'drum') {
              if (!openDrumMachine) {
                console.error("handleAddTrack: Missing dependency for drum type (openDrumMachine)");
                return null;
              }
              if (!payload || !('samples' in payload)) {
                  console.error("handleAddTrack Error: Drum track requires a payload with samples.");
                  return null;
              }
              const drumPayload = payload as DrumTrackPayload;
              const selectedSamples = drumPayload.samples;
              console.log("Creating drum track with selected samples:", selectedSamples);

              // 1. Create individual sampler tracks for each selected sample
              const samplerPromises = selectedSamples.map(async (sample) => {
                  try {
                      const samplerOptions: SamplerTrackOptions = {
                          name: sample.display_name, 
                          storage_key: sample.storage_key, 
                          // Add other potential mappings here
                      };
                      console.log(`Creating sampler track for ${sample.display_name} with options:`, samplerOptions);
                      const samplerTrack = await createTrackAndRegisterWithHistory('sampler', sample.display_name, samplerOptions);
                      if (!samplerTrack) {
                          console.error(`Failed to create sampler track for ${sample.display_name}`);
                          return null;
                      }
                      console.log(`Created sampler track for ${sample.display_name}:`, samplerTrack.id);
                      return samplerTrack;
                  } catch (error) {
                      console.error(`Error creating sampler track for ${sample.display_name}:`, error);
                      return null;
                  }
              });
              
              const createdSamplerTracks = (await Promise.all(samplerPromises)).filter(Boolean) as CombinedTrack[];
              const samplerTrackIds = createdSamplerTracks.map(track => track.id);
              console.log("Created sampler tracks:", samplerTrackIds);
              
              // 2. Create the main drum track referencing the samplers
              const count = rootState.tracks.length + createdSamplerTracks.length;
              const mainDrumTrackName = TRACK_CONFIG.drum.getDefaultName(count, 'Drum Kit');
              const mainDrumTrack = await createTrackAndRegisterWithHistory('drum', mainDrumTrackName, {
                  instrumentName: 'Drum Sequencer', 
                  samplerTrackIds: samplerTrackIds
              });
              
              // 3. Open UI
              if (mainDrumTrack && openDrumMachine) {
                  console.log(`Opening drum machine UI for track: ${mainDrumTrack.id}`);
                  openDrumMachine(mainDrumTrack.id);
              }
              return { mainDrumTrack, samplerTracks: createdSamplerTracks };
          }
          
          // --- Standard/MIDI Track Creation --- 
          const count = rootState.tracks.length + 1;
          let instrumentName: string | undefined;
          let trackOptions: TrackOptions = {};

          // No need for `else if (type !== 'drum')` check here, 
          // as the drum case is handled above and returns.
          if (type === 'midi' && payload && 'instrumentId' in payload) {
              const midiPayload = payload as MidiTrackPayload;
              instrumentName = midiPayload.instrumentName;
              trackOptions = { 
                  instrumentId: midiPayload.instrumentId,
                  instrumentName: midiPayload.instrumentName,
                  instrumentStorageKey: midiPayload.instrumentStorageKey
              };
              console.log("Creating MIDI track with payload:", trackOptions);
          } else {
              // Handles 'audio' and 'sampler' types implicitly, 
              // assuming payload isn't needed or handled by uploadAudioFile/createTrack flow
              console.log(`Creating ${type} track without specific payload (or handled elsewhere).`);
          }

          const trackName = TRACK_CONFIG[type]?.getDefaultName(count, instrumentName) || `Track ${count}`;
          const trackData = await createTrackAndRegisterWithHistory(type, trackName, trackOptions);
          return trackData;
      }
      
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