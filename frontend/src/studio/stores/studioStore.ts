import { create, StoreApi } from 'zustand';
import { Store } from '../core/state/store';
import { RootState, TrackOperation, CombinedTrack } from './types';
import { immer } from 'zustand/middleware/immer';

// Import all slice creators
import { createCoreSlice, CoreSlice } from './slices/coreSlice';
import { createProjectSlice, ProjectSlice } from './slices/projectSlice';
import { createTracksSlice, TracksSlice } from './slices/tracksSlice';
import { createTransportSlice, TransportSlice } from './slices/transportSlice';
import { createHistorySlice, HistorySlice } from './slices/historySlice';
import { createUISlice, UISlice } from './slices/uiSlice';
import { createMidiSlice, MidiSlice } from './slices/midiSlice';
import { createSamplerSlice, SamplerSlice } from './slices/samplerSlice';
import { createDrumSlice, DrumSlice } from './slices/drumSlice';

// Combine all slice interfaces into the RootState for type checking
// Note: RootState in types.ts should ideally already match this structure
export type StudioStoreState = RootState; // Assuming RootState in types.ts is comprehensive
  // If not, define it here: 
  // export type StudioStoreState = CoreSlice & ProjectSlice & TracksSlice & TransportSlice & HistorySlice & UISlice & MidiSlice & SamplerSlice & DrumSlice;

export const useStudioStore = create<StudioStoreState>()(immer((set, get) => {
  
  // --- Shared Utility Functions --- 

  // _updateState can likely be removed or simplified when using Immer
  // as slices can use set(produce(draft => { ... })) directly.
  // Keeping it for now for compatibility, but it modifies the draft directly.
  const _updateState = <K extends keyof StudioStoreState>(
    key: K, 
    value: StudioStoreState[K] | ((prev: StudioStoreState[K]) => StudioStoreState[K])
  ) => {
    // Immer's set function automatically handles draft state
    set((state) => {
        // If value is a function, apply it to the draft state for that key
        if (typeof value === 'function') {
            // @ts-ignore - Immer allows direct mutation on draft
            state[key] = value(state[key]); 
        } else {
            // @ts-ignore - Immer allows direct mutation on draft
            state[key] = value;
        }
        // No need to return anything, Immer handles immutability
    });
  };

  // Fix _withStore to always return a Promise
  const _withStore = <T extends unknown[], R>(
    fn: (storeInstance: Store, ...args: T) => R | Promise<R> 
  ) => async (...args: T): Promise<R | null> => { // Ensure the RETURNED function is async
      const storeInstance = get().store; 
      if (!storeInstance) {
        console.error('_withStore Error: Store instance is not available in state!');
        // No need for Promise.resolve here, async function handles it
        return null; 
      }
      try {
        // Await the result, works even if fn returns non-promise R
        const result = await fn(storeInstance, ...args);
        return result; 
      } catch (error) {
        console.error('Error caught within _withStore execution:', error);
        return null; 
      }
    };

  // Adjust _withErrorHandling to accept Promise<R | null>
  const _withErrorHandling = <T extends unknown[], R>(
    fn: (...args: T) => Promise<R | null>, // Accept Promise<R | null>
    actionName: string
  ) => async (...args: T): Promise<R | null> => { // Returns Promise<R | null>
    try {
      return await fn(...args); // Await the result which might be null
    } catch (error) {
      console.error(`Error in action [${actionName}]:`, error);
      return null; // Return null on error
    }
  };

  // --- Placeholder for handleTrackOperation --- 
  const handleTrackOperation = async (operation: TrackOperation): Promise<CombinedTrack | null | void> => {
      console.warn("handleTrackOperation is not fully implemented yet.");
      const { handleAddTrack, updateTrackState, handleTrackDelete, handleTrackParameterChange } = get(); // Get needed actions
      
      switch (operation.type) {
          case 'create':
              // Example delegation: Need to adapt AddTrackPayload structure from options
              // return handleAddTrack(operation.trackType, /* adapt operation.options to payload */);
              console.log("TODO: Implement create delegation in handleTrackOperation");
              break;
          case 'update':
              // Example delegation: Need to handle potential complex updates
              // updateTrackState(operation.trackId, operation.updates);
              console.log("TODO: Implement update delegation in handleTrackOperation");
              break;
          case 'delete':
              return handleTrackDelete(operation.trackId);
          case 'param_change':
              // Example delegation: handleTrackParameterChange expects specific types
              // return handleTrackParameterChange(operation.trackId, operation.param, operation.value);
              console.log("TODO: Implement param_change delegation in handleTrackOperation");
              break;
          default:
              console.error("Unknown track operation type:", operation);
      }
      return Promise.resolve(); // Return void promise for unimplemented parts
  };

  // --- Combine Slices --- 
  
  // Slices now receive Immer-enhanced set/get
  const slices = {
    ...createCoreSlice(set, get),
    ...createProjectSlice(set, get),
    ...createTracksSlice(set, get),
    ...createTransportSlice(set, get),
    ...createHistorySlice(set, get),
    ...createUISlice(set, get),
    ...createMidiSlice(set, get),
    ...createSamplerSlice(set, get),
    ...createDrumSlice(set, get),
  };

  return {
    // Spread slices
    ...slices,
    
    // Add implementations/aliases directly accessible on the root state
    handleTrackOperation,
    // Expose _updateState if slices rely on it, otherwise it can be removed
    _updateState, 
    updateState: _updateState, // Alias if needed

    // Expose other utilities if needed at the root level
    _withStore,
    _withErrorHandling,
    
    // Initialize the store instance
    store: new Store(), 
    // isInitialized might be part of CoreSlice now?
    isInitialized: false, 
  };
}));

// --- Post-Creation Initialization --- 
// Example: Initialize history state after store creation
// This ensures the manager exists and the state reflects reality
const initialState = useStudioStore.getState();
if (initialState._updateHistoryState) {
    initialState._updateHistoryState();
}
// Optionally initialize the core store instance here if needed sooner
// const coreStore = useStudioStore.getState().store;
// if (coreStore && !useStudioStore.getState().isInitialized) {
//   // Might need to trigger initializeAudio manually or ensure Store constructor handles it
//   console.log("Performing post-creation store setup...");
// } 