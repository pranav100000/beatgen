import { create, StoreApi } from 'zustand';
import { Store } from '../core/state/store';
import { RootState, TrackOperation, CombinedTrack } from './types';

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

export const useStudioStore = create<StudioStoreState>()((set, get) => {
  
  // --- Shared Utility Functions --- 

  // Generic state updater (implementation for slices to use via get()._updateState)
  const _updateState = <K extends keyof StudioStoreState>(
    key: K, 
    value: StudioStoreState[K] | ((prev: StudioStoreState[K]) => StudioStoreState[K])
  ) => {
    set((state) => ({ 
        [key]: typeof value === 'function' 
            // @ts-ignore - Zustand allows function updates
            ? value(state[key]) 
            : value 
    }));
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
  
  // Create an object containing the implementations of the shared utilities
  // These will be passed implicitly via the get() function within each slice
  const sharedUtilities = {
      _updateState,
      _withStore,
      _withErrorHandling
  };

  // Note: We are not explicitly passing sharedUtilities to each slice creator.
  // The slices access them via get()._utilityName, so they need to be part of the returned object.

  return {
    // Spread the results of each slice creator
    ...createCoreSlice(set, get),
    ...createProjectSlice(set, get),
    ...createTracksSlice(set, get),
    ...createTransportSlice(set, get),
    ...createHistorySlice(set, get),
    ...createUISlice(set, get),
    ...createMidiSlice(set, get),
    ...createSamplerSlice(set, get),
    ...createDrumSlice(set, get),
    
    // Add implementations/aliases for missing RootState properties
    handleTrackOperation,
    updateState: _updateState,

    // Expose shared utilities (already present)
    _updateState,
    _withStore,
    _withErrorHandling,
    
    // Initialize the store instance here, ensuring it matches the type expected by RootState.store
    store: new Store(), 
  };
});

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