import { RootState, SetFn, GetFn, StoreSliceCreator } from '../types';
import { CombinedTrack } from 'src/platform/types/project';
import { produce } from 'immer';

// Define the actions for this slice
export interface DrumSlice {
  setDrumPattern: (trackId: string, pattern: boolean[][]) => void;
  // openDrumMachine and closeDrumMachine are currently in UISlice
}

// Create the slice function
export const createDrumSlice: StoreSliceCreator<DrumSlice> = (set, get) => {
  const rootGet = get as GetFn; // Helper for root state access

  // Action to set the drum pattern for a specific drum track using Immer
  const setDrumPattern = (trackId: string, pattern: boolean[][]): void => {
    set(produce((draft: RootState) => {
        const drumTrackIndex = draft.tracks.findIndex(t => t.id === trackId && t.type === 'drum');

        if (drumTrackIndex === -1) {
          console.error(`Drum track ${trackId} not found for setting pattern.`);
          return; // Exit draft modification
        }

        const drumTrack = draft.tracks[drumTrackIndex];
        
        // Use type assertion here as CombinedTrack might not have drumPattern directly
        // Ensure this property actually exists at runtime for drum tracks
        (drumTrack as CombinedTrack & { drumPattern?: boolean[][] }).drumPattern = pattern; 
        
        console.log(`Updated drum pattern for track ${trackId} via Immer`);

    })); // Removed action name argument
  };

  return {
    // Actions
    setDrumPattern,
  };
};
