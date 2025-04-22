import { RootState, SetFn, GetFn, StoreSliceCreator } from '../types';

// Define the state properties and actions for this slice
export interface UISlice {
  zoomLevel: number;
  measureCount: number;
  addMenuAnchor: HTMLElement | null;
  openDrumMachines: Record<string, boolean>; // Map of drumTrackId to boolean (true if open)
  
  // Actions (mostly simple setters)
  setZoomLevel: (zoomLevel: number) => void;
  setMeasureCount: (measureCount: number) => void;
  setAddMenuAnchor: (el: HTMLElement | null) => void;
  openDrumMachine: (drumTrackId: string) => void;
  closeDrumMachine: (drumTrackId: string) => void;
  // Consider adding toggleDrumMachine if useful
}

// Create the slice function
export const createUISlice: StoreSliceCreator<UISlice> = (set, get) => {
  
  // Utility to set state within this slice
  const setUIState = (partial: Partial<UISlice> | ((state: UISlice) => Partial<UISlice>)) => set(partial);

  return {
    // Initial state
    zoomLevel: 1,
    measureCount: 40, // Default measure count
    addMenuAnchor: null,
    openDrumMachines: {},

    // Actions implementations
    setZoomLevel: (zoomLevel) => setUIState({ zoomLevel }),
    setMeasureCount: (measureCount) => setUIState({ measureCount }),
    setAddMenuAnchor: (el) => setUIState({ addMenuAnchor: el }),
    
    openDrumMachine: (drumTrackId) => setUIState((state) => ({
      openDrumMachines: { 
        ...state.openDrumMachines,
        [drumTrackId]: true 
      }
    })),
    
    closeDrumMachine: (drumTrackId) => setUIState((state) => ({
      openDrumMachines: { 
        ...state.openDrumMachines, 
        [drumTrackId]: false 
      }
    })),
    // Optional toggle function:
    // toggleDrumMachine: (drumTrackId) => setUIState((state) => ({
    //   openDrumMachines: { 
    //     ...state.openDrumMachines, 
    //     [drumTrackId]: !state.openDrumMachines[drumTrackId] 
    //   }
    // })), 
  };
};
