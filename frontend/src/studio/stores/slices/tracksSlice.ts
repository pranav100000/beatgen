import { CombinedTrack } from 'src/platform/types/project';
import { Position } from '../../components/track';
import { RootState, SetFn, GetFn, TrackParameter, TrackType, TrackOptions, AddTrackPayload, DrumTrackPayload, MidiTrackPayload, AudioTrackOptions, SamplerTrackOptions, MidiTrackOptions, AnyTrackRead, MidiTrack, AudioTrack, SamplerTrack, AudioTrackRead, MidiTrackRead, SamplerTrackRead, DrumTrackRead, DrumTrackOptions } from '../types';
import { Store } from '../../core/state/store';
import { Actions } from '../../core/state/history/actions'; 
import { TRACK_CONFIG, DEFAULT_SAMPLER_CONFIG } from '../config';
import { GRID_CONSTANTS, ticksToPixels, pixelsToTicks } from '../../constants/gridConstants';
import { PULSES_PER_QUARTER_NOTE } from '../../utils/noteConversion';
import { produce } from 'immer';
import { StateCreator } from 'zustand';
import { StoreApi } from 'zustand';
import SampleManager from '../../core/samples/sampleManager';
import { db } from '../../core/db/dexie-client';

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
  handleAddTrack: (type: TrackType, payload?: AddTrackPayload) => Promise<CombinedTrack | null>;
  handleInstrumentChange: (trackId: string, instrumentId: string, instrumentName: string, instrumentStorageKey: string) => Promise<void>; 
  replaceTrackAudioFile: (trackId: string, file: File) => Promise<void>;

  // Expose internal helper for nested updates
  _updateNestedTrackData: (trackId: string, nestedUpdates: Partial<AnyTrackRead>) => void; // Use AnyTrackRead

  // --- Selectors --- 
  selectDrumTrackById: (trackId: string) => DrumTrackRead | undefined;
  selectSamplerTracksForDrumTrack: (drumTrackId: string) => SamplerTrackRead[];

  // New actions
  removeSamplerTrack: (samplerTrackId: string) => Promise<void>;
  addSamplerTrackToDrumTrack: (
    drumTrackId: string,
    sampleData: { id: string; display_name: string; storage_key: string; /* other needed fields? */ }
  ) => Promise<CombinedTrack | null>;
}

// Remove local type alias if it causes confusion
// type TracksSliceCreator = StateCreator<RootState, [], [], TracksSlice>;

// Revert to the simpler definition without explicit StateCreator and third argument
export const createTracksSlice = (set: SetFn, get: GetFn): TracksSlice => { 
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
    // !! IMPORTANT: Ensure CombinedTrack type includes `track_number?: number;` !!
    return rootGet().tracks.find((t) => t.id === trackId);
  };

  // Update a specific track's state in the tracks array
  const updateTrackState = (trackId: string, updates: Partial<CombinedTrack & TrackParameter>) => {
    set(produce((draft: RootState) => {
        const trackIndex = draft.tracks.findIndex(t => t.id === trackId);
        if (trackIndex !== -1) {
            Object.assign(draft.tracks[trackIndex], updates);
        }
    }));
  };

  // Update all tracks and recalculate indices
  const updateTracks = (newTracks: CombinedTrack[]) => {
      set(produce((draft: RootState) => {
          draft.tracks = newTracks; 
      }));
  };

  // Action to recalculate and add/update the index property for UI ordering
  const updateTrackIndices = () => {
    set(produce((draft: RootState) => {
        draft.tracks.forEach((track, index) => {
            // Mutate draft directly
            // !! IMPORTANT: Ensure CombinedTrack has track_number !!
            track.track_number = index; 
        });
    }));
  };

  // Internal helper to update the nested track object using Immer
  const _updateNestedTrackData = (trackId: string, nestedUpdates: Partial<AnyTrackRead>) => {
    set(produce((draft: RootState) => {
        const trackIndex = draft.tracks.findIndex(t => t.id === trackId);
        if (trackIndex !== -1 && draft.tracks[trackIndex].track) {
            Object.assign(draft.tracks[trackIndex].track, nestedUpdates);
        } else {
            console.warn(`_updateNestedTrackData: Track or track.track not found for ID ${trackId}`);
        }
    }));
  };

  // Explicitly define setTracks within the slice scope
  const setTracks = (newTracks: CombinedTrack[]) => {
      set(produce((draft: RootState) => {
          draft.tracks = newTracks;
          draft.tracks.forEach((track, index) => { 
              // !! IMPORTANT: Ensure CombinedTrack has track_number !!
              track.track_number = index; 
          });
      }), true);
  };

  // --- Selectors Implementation --- 
  const selectDrumTrackById = (trackId: string): DrumTrackRead | undefined => {
    const track = findTrackById(trackId); // Use the slice's findTrackById
    // Ensure track and track.track exist and type is correct
    return (track && track.type === 'drum' && track.track) ? track.track as DrumTrackRead : undefined;
  };

  const selectSamplerTracksForDrumTrack = (drumTrackId: string): SamplerTrackRead[] => {
    const tracks = rootGet().tracks; // Get current tracks from root state
    return tracks
      // Ensure track and track.track exist before filtering
      .filter(t => 
          t.type === 'sampler' && 
          t.track && 
          (t.track as SamplerTrackRead).drum_track_id === drumTrackId
      )
      .map(t => t.track as SamplerTrackRead); // Map to the nested track data
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
              drum_track_id: samplerOptions.drum_track_id || null,
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
      const { executeHistoryAction, _withStore, _withErrorHandling } = rootGet();
      const storeInstance = rootGet().store; // Get the Store instance
      const trackToDelete = findTrackById(trackId);

      if (!trackToDelete) {
          console.error(`Track ${trackId} not found for deletion`);
          return;
      }

      if (!storeInstance || !_withStore || !_withErrorHandling) {
          console.error("_withStore or _withErrorHandling not available for delete");
          return;
      }

      const deleteLogic = async (passedStore: Store) => {
          // --- Recursive delete for drum track --- 
          if (trackToDelete.type === 'drum' && trackToDelete.track) {
              const drumTrack = trackToDelete.track as DrumTrackRead;
              const samplerIdsToRemove = drumTrack.sampler_track_ids ? [...drumTrack.sampler_track_ids] : []; 
              if (samplerIdsToRemove.length > 0) {
                  for (const samplerId of samplerIdsToRemove) {
                      // Use the slice action which uses Immer internally now
                      await removeSamplerTrack(samplerId); 
                  }
              }
          }
          
          // Create history action BEFORE modifying state
          const action = new Actions.DeleteTrack(get, { ...trackToDelete });

          set(produce((draft: RootState) => {
              const initialLength = draft.tracks.length;
              draft.tracks = draft.tracks.filter(t => t.id !== trackId);
              if (draft.tracks.length < initialLength) { // Only re-index if deletion occurred
                  draft.tracks.forEach((track, index) => { 
                      // !! IMPORTANT: Ensure CombinedTrack has track_number !!
                      track.track_number = index; 
                  }); 
              }
          }));

          try {
              await passedStore.getAudioEngine().removeTrack(trackId);
          } catch (engineError) {
              console.error(`Error removing track ${trackId} from audio engine:`, engineError);
          }

          try {
              if (trackToDelete.type === 'sampler') {
                  console.log(`Placeholder: Disconnect/cleanup sampler track ${trackId} subscription`);
              }
              if (trackToDelete.type === 'midi') {
                  console.log(`Placeholder: Disconnect MIDI track ${trackId} from soundfont/manager`);
              }
          } catch (disconnectError) {
              console.error(`Error during track disconnection for ${trackId}:`, disconnectError);
          }

          // Execute history action AFTER state change (or consider order)
          await executeHistoryAction(action);
      };

      await _withErrorHandling(async () => _withStore(deleteLogic)(), `handleTrackDelete: ${trackId}`)();
  };

  // --- New: removeSamplerTrack Action Implementation --- 
  const removeSamplerTrack = async (samplerTrackId: string) => {
    const { executeHistoryAction, _withErrorHandling } = rootGet();
    const samplerTrack = findTrackById(samplerTrackId); // Use slice's findTrackById

    // 1. Basic Validation
    if (!samplerTrack || samplerTrack.type !== 'sampler' || !samplerTrack.track) {
        console.error(`Sampler track ${samplerTrackId} not found or invalid.`);
        return;
    }
    const drumTrackId = (samplerTrack.track as SamplerTrackRead)?.drum_track_id;
    console.log(`Attempting to remove sampler ${samplerTrackId}, associated drum track: ${drumTrackId}`);

    // 2. Delete the Sampler Track Itself (using the refactored handleTrackDelete)
    // Note: We call handleTrackDelete, NOT Actions.DeleteTrack directly, 
    // because handleTrackDelete includes engine removal and state updates.
    // The history action for deleting the sampler itself is handled within handleTrackDelete.
    await handleTrackDelete(samplerTrackId); 
    console.log(`Deletion process initiated for sampler track ${samplerTrackId}`);

    // 3. Update Parent Drum Track (if applicable)
    if (drumTrackId) {
        // Need to use _withErrorHandling or similar if accessing state after potential async operations
        const updateParentLogic = async () => { // Wrap in async for safety
            const parentDrumTrack = selectDrumTrackById(drumTrackId); // Use the selector

            if (parentDrumTrack) {
                const oldSamplerIds = parentDrumTrack.sampler_track_ids || [];
                const newSamplerIds = oldSamplerIds.filter(id => id !== samplerTrackId);

                if (oldSamplerIds.length !== newSamplerIds.length) {
                    console.log(`Updating parent drum track ${drumTrackId} after removing sampler ${samplerTrackId}. New list:`, newSamplerIds);
                    
                    // Update parent state using Immer via _updateNestedTrackData
                    _updateNestedTrackData(drumTrackId, { sampler_track_ids: newSamplerIds } as Partial<DrumTrackRead>);

                    // History action for the PARENT update
                    const parentUpdateAction = new Actions.UpdateDrumTrackSamplers(
                        get,
                        drumTrackId,
                        oldSamplerIds,
                        newSamplerIds
                    );
                    await executeHistoryAction(parentUpdateAction); 
                } else {
                    console.log(`Sampler ${samplerTrackId} was not found in parent ${drumTrackId}'s list.`);
                }
            } else {
                console.warn(`Parent drum track ${drumTrackId} not found after deleting sampler ${samplerTrackId}. Cannot update parent.`);
            }
        };
        
        // Wrap the parent update logic in error handling
        if (_withErrorHandling) { 
            await _withErrorHandling(updateParentLogic, `removeSamplerTrackParentUpdate: ${samplerTrackId}`)();
        } else {
            console.error("_withErrorHandling not available for parent update in removeSamplerTrack");
            await updateParentLogic(); // Attempt without handler
        }
    } else {
        console.log(`Sampler ${samplerTrackId} was not associated with a drum track.`);
    }
    console.log(`Finished removeSamplerTrack process for ${samplerTrackId}`);
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
            ? { id: crypto.randomUUID(), sampleFile: file, ...DEFAULT_SAMPLER_CONFIG } 
            : { id: crypto.randomUUID(), audioFile: file };

        await SampleManager.getInstance(db).putSampleBlob(options.id, file, 'sample', trackName);
        
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

  // --- handleAddTrack Implementation (Restoring sampler creation loop) --- 
  const handleAddTrack = async (
    type: TrackType, 
    payload?: AddTrackPayload
  ): Promise<CombinedTrack | null> => { // Return only the main track created
      const rootState = get(); 
      // Get necessary actions from root state
      const { createTrackAndRegisterWithHistory, addSamplerTrackToDrumTrack, openDrumMachine, _withErrorHandling } = rootState;
      
      // Ensure actions exist
      if (!_withErrorHandling || !createTrackAndRegisterWithHistory || (type === 'drum' && !addSamplerTrackToDrumTrack)) {
          console.error("handleAddTrack: Missing dependencies");
          return null;
      }

      const addLogic = async () => {
          // --- Drum Track Creation with Samplers --- 
          if (type === 'drum') {
              // 1. Create the main drum track first
              const count = rootState.tracks.length + 1; 
              const mainDrumTrackName = TRACK_CONFIG.drum.getDefaultName(count, 'Drum Kit');
              const mainDrumTrack = await createTrackAndRegisterWithHistory('drum', mainDrumTrackName, {
                  instrumentName: 'Drum Sequencer', 
              });

              if (!mainDrumTrack || !mainDrumTrack.id) {
                  console.error("Failed to create main drum track record");
                  return null; // Return null if main track creation fails
              }
              const mainDrumTrackId = mainDrumTrack.id;
              console.log(`Created main drum track ${mainDrumTrackId}`);

              // 2. Check for samples payload and add corresponding Sampler Tracks
              if (payload && 'samples' in payload && Array.isArray(payload.samples)) {
                  const drumPayload = payload as DrumTrackPayload;
                  console.log(`Adding ${drumPayload.samples.length} sampler tracks to drum track ${mainDrumTrackId}...`);
                  
                  // Sequentially add sampler tracks using the dedicated action
                  for (const sample of drumPayload.samples) {
                      try {
                          // Prepare sampleData for the action (ensure fields match)
                          const sampleDataForAction = {
                              id: sample.id, // Assuming DrumSamplePublicRead has id
                              display_name: sample.display_name, // Assuming DrumSamplePublicRead has display_name
                              storage_key: sample.storage_key, // Assuming DrumSamplePublicRead has storage_key
                              // Add other necessary fields if addSamplerTrackToDrumTrack expects them
                          };
                          // Call action to create sampler and link it (handles history)
                          await addSamplerTrackToDrumTrack(mainDrumTrackId, sampleDataForAction);
                      } catch (error) {
                          console.error(`Failed to add sampler track for sample ${sample.display_name} to drum track ${mainDrumTrackId}:`, error);
                          // Decide whether to continue or stop if one sampler fails
                      }
                  }
                  console.log(`Finished adding sampler tracks for ${mainDrumTrackId}.`);
              } else {
                  console.log(`No initial samples provided for drum track ${mainDrumTrackId}.`);
              }
              
              // 3. Open UI (optional)
              if (openDrumMachine) {
                  openDrumMachine(mainDrumTrackId);
              }

              // Return the main drum track object after attempting sampler additions
              // Fetch the latest state in case samplers modified it (though unlikely here)
              return rootState.findTrackById(mainDrumTrackId); 
          }
          
          // --- Standard/MIDI/Sampler Track Creation (Unchanged) --- 
          const countStd = rootState.tracks.length + 1;
          let instrumentNameStd: string | undefined;
          let trackOptionsStd: TrackOptions = {};
          if (type === 'midi' && payload && 'instrumentId' in payload) {
              const midiPayload = payload as MidiTrackPayload;
              instrumentNameStd = midiPayload.instrumentName;
              trackOptionsStd = { 
                  instrumentId: midiPayload.instrumentId,
                  instrumentName: midiPayload.instrumentName,
                  instrumentStorageKey: midiPayload.instrumentStorageKey
              };
          }
          const trackNameStd = TRACK_CONFIG[type]?.getDefaultName(countStd, instrumentNameStd) || `Track ${countStd}`;
          const trackData = await createTrackAndRegisterWithHistory(type, trackNameStd, trackOptionsStd);
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

  // --- New Action: Add Sampler to Drum Track --- 
  const addSamplerTrackToDrumTrack = async (
    drumTrackId: string,
    sampleData: { id: string; display_name: string; storage_key: string; /* other needed fields? */ }
  ): Promise<CombinedTrack | null> => {
    const { createTrackAndRegisterWithHistory, executeHistoryAction, _withErrorHandling } = rootGet();
    if (!createTrackAndRegisterWithHistory || !executeHistoryAction || !_withErrorHandling) {
        console.error("addSamplerTrackToDrumTrack: Missing dependencies");
        return null;
    }

    const addSamplerLogic = async (): Promise<CombinedTrack | null> => {
        // 1. Prepare Sampler Options, linking to parent
        const samplerOptions: SamplerTrackOptions = {
            name: sampleData.display_name,          // Use sample name for track name initially
            storage_key: sampleData.storage_key,    // Pass storage key
            drum_track_id: drumTrackId,             // **Link to parent**
            // Add any other relevant options derived from sampleData if needed
            // e.g., baseMidiNote might be derived or default
        };
        const samplerTrackName = sampleData.display_name; // Or generate a more unique name

        // 2. Create the Sampler Track (handles its own history for creation)
        const newSamplerTrack = await createTrackAndRegisterWithHistory('sampler', samplerTrackName, samplerOptions);

        if (!newSamplerTrack || !newSamplerTrack.id) {
            console.error(`Failed to create sampler track for sample ${sampleData.display_name}`);
            return null;
        }
        const newSamplerTrackId = newSamplerTrack.id;
        console.log(`Created sampler track ${newSamplerTrackId} linked to drum track ${drumTrackId}`);

        // 3. Update Parent Drum Track's State
        const parentDrumTrack = selectDrumTrackById(drumTrackId); // Use the selector
        if (!parentDrumTrack) {
            console.error(`Parent drum track ${drumTrackId} not found in state after creating sampler.`);
            // Potentially rollback sampler creation? Or just log error.
            return newSamplerTrack; // Return sampler even if parent update fails?
        }

        const oldSamplerIds = parentDrumTrack.sampler_track_ids || [];
        // Ensure no duplicates (though unlikely with UUIDs)
        const newSamplerIds = [...new Set([...oldSamplerIds, newSamplerTrackId])];

        console.log(`Updating parent drum track ${drumTrackId} sampler IDs from`, oldSamplerIds, `to`, newSamplerIds);
        _updateNestedTrackData(drumTrackId, { sampler_track_ids: newSamplerIds } as Partial<DrumTrackRead>);

        // 4. Add History Action for the Parent Update
        // **ASSUMES Actions.UpdateDrumTrackSamplers exists and takes (get, drumTrackId, oldIds, newIds)**
        try {
            const parentUpdateAction = new Actions.UpdateDrumTrackSamplers(
                get, 
                drumTrackId, 
                oldSamplerIds, 
                newSamplerIds
            );
            await executeHistoryAction(parentUpdateAction);
        } catch (historyError) {
            console.error("Error executing history action for parent drum track update:", historyError);
            // Consider if state needs rollback here
        }

        return newSamplerTrack;
    };

    return _withErrorHandling(addSamplerLogic, 'addSamplerTrackToDrumTrack')();
  };

  // --- Initial State & Return --- 
  return {
    tracks: [],

    // Basic state manipulation
    setTracks,
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

    // --- Selectors --- 
    selectDrumTrackById,
    selectSamplerTracksForDrumTrack,

    // New actions
    removeSamplerTrack,
    addSamplerTrackToDrumTrack,
  };
};