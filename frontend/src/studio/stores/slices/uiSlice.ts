import { RootState, SetFn, GetFn, StoreSliceCreator } from '../types';
import { produce } from 'immer'; // Import produce

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
  
  return {
    // Initial state
    zoomLevel: 1,
    measureCount: 40, // Default measure count
    addMenuAnchor: null,
    openDrumMachines: {},

    // Actions implementations using Immer
    setZoomLevel: (zoomLevel) => set(produce((draft: RootState) => { draft.zoomLevel = zoomLevel; })),
    setMeasureCount: (measureCount) => set(produce((draft: RootState) => { draft.measureCount = measureCount; })),
    setAddMenuAnchor: (el) => set(produce((draft: RootState) => { draft.addMenuAnchor = el; })),
    
    openDrumMachine: (drumTrackId) => set(produce((draft: RootState) => {
        if (!draft.openDrumMachines) { draft.openDrumMachines = {}; }
        draft.openDrumMachines[drumTrackId] = true; 
    })),
    
    closeDrumMachine: (drumTrackId) => set(produce((draft: RootState) => {
        if (draft.openDrumMachines) { 
            draft.openDrumMachines[drumTrackId] = false; 
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
