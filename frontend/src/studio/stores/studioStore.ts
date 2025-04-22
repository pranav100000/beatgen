import { create } from 'zustand';
import { Store } from '../core/state/store';
import { RootState } from './types';

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

  // Higher-order function to ensure store instance is available
  const _withStore = <T extends unknown[], R>(
    fn: (store: Store, ...args: T) => R | Promise<R>
  ) => (...args: T): R | Promise<R> | null => {
      const { store } = get();
      if (!store) {
        console.error('Store instance is not available!');
        // Depending on the function, returning null might be appropriate,
        // or throwing an error might be better.
        return null; 
      }
      // Execute the function with the store instance
      return fn(store, ...args);
    };

  // Error handling wrapper for async slice actions
  const _withErrorHandling = <T extends unknown[], R>(
    fn: (...args: T) => Promise<R>, 
    actionName: string
  ) => async (...args: T): Promise<R | null> => {
    try {
      // Execute the wrapped function
      return await fn(...args);
    } catch (error) {
      console.error(`Error in action [${actionName}]:`, error);
      // Return null to indicate failure, slices should handle this appropriately
      return null; 
    }
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
    
    // Implement the shared utilities directly in the root state
    // so slices can access them via get()
    _updateState,
    _withStore,
    _withErrorHandling,
    
    // --- Initializations --- 
    // Initialize the core Store instance after the store is created
    // This might need adjustment depending on Store lifecycle requirements
    // We override the initial null value set in coreSlice
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