import { Store } from '../../core/state/store';
import { RootState, SetFn, GetFn, StoreSliceCreator } from '../types';

// Define the state properties for this slice
export interface CoreSlice {
  store: Store | null;
  isInitialized: boolean;
  setStore: (store: Store) => void;
  setIsInitialized: (isInitialized: boolean) => void;
  initializeAudio: () => Promise<void>;
  // Reference to the generic state updater (will be provided by the root store creator)
  _updateState: <K extends keyof RootState>(
    key: K, 
    value: RootState[K] | ((prev: RootState[K]) => RootState[K])
  ) => void;
  _withErrorHandling: <T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    actionName: string
  ) => (...args: T) => Promise<R | null>;
}

// Create the slice function
export const createCoreSlice: StoreSliceCreator<CoreSlice> = (set, get) => {
  // Utility to directly set state within this slice
  const setCoreState = (partial: Partial<CoreSlice> | ((state: CoreSlice) => Partial<CoreSlice>)) => set(partial);

  // Initialize the audio engine with error handling
  const initializeAudio = async () => {
    const rootGet = get as GetFn; // Cast get to the RootState getter
    const { store, projectTitle, _withErrorHandling } = rootGet();
    
    const initLogic = async () => {
      if (!store) {
        console.error("Store instance is null during initialization");
        // Optionally create a new store instance here if needed
        // setCoreState({ store: new Store() }); 
        // store = get().store;
        // if (!store) throw new Error("Failed to create store instance");
        throw new Error("Store instance not available");
      }

      if (!store.projectManager.getCurrentProject()) {
        console.log('Creating a new project in coreSlice');
        const project = store.projectManager.createProject(projectTitle);
        console.log('Project created:', project);
      }
      
      await store.initializeAudio();
      setCoreState({ isInitialized: true });
      
      // Keep this for debugging if needed, but generally avoid window assignment
      // (window as any).storeInstance = store; 
    };

    // Wrap the initialization logic with error handling provided by the root store
    const safeInitializeAudio = _withErrorHandling(initLogic, 'initializeAudio');
    await safeInitializeAudio();
  };

  return {
    store: null, // Initialize store as null, it should be set externally or created on demand
    isInitialized: false,
    setStore: (newStore) => setCoreState({ store: newStore }),
    setIsInitialized: (isInitialized) => setCoreState({ isInitialized }),
    initializeAudio,
    // Dummy implementations for placeholders, will be replaced by root store utilities
    _updateState: (key, value) => console.warn('_updateState called before initialization'),
    _withErrorHandling: <T extends unknown[], R>(
      fn: (...args: T) => Promise<R>,
      actionName: string
    ) => async (...args: T): Promise<R | null> => {
      console.warn('_withErrorHandling called before initialization for', actionName);
      try {
        return await fn(...args);
      } catch (error) {
        console.error(`Error in ${actionName} (uninitialized handler):`, error);
        return null;
      }
    },
  };
};
