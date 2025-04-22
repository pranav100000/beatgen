import { RootState, SetFn, GetFn, StoreSliceCreator } from '../types';
import { CombinedTrack } from 'src/platform/types/project';

// Define the actions for this slice
export interface DrumSlice {
  setDrumPattern: (trackId: string, pattern: boolean[][]) => void;
  // openDrumMachine and closeDrumMachine are currently in UISlice
}

// Create the slice function
export const createDrumSlice: StoreSliceCreator<DrumSlice> = (set, get) => {
  const rootGet = get as GetFn; // Helper for root state access

  // Action to set the drum pattern for a specific drum track
  const setDrumPattern = (trackId: string, pattern: boolean[][]): void => {
    const { tracks, _updateState } = rootGet();

    if (!_updateState) {
        console.error("_updateState utility is not available in setDrumPattern");
        return;
    }

    const drumTrackIndex = tracks.findIndex(t => t.id === trackId && t.type === 'drum');

    if (drumTrackIndex === -1) {
      console.error(`Drum track ${trackId} not found for setting pattern.`);
      return;
    }

    // Directly update the tracks array using _updateState
    _updateState('tracks', (currentTracks) => 
      currentTracks.map((track, index) => {
        if (index === drumTrackIndex) {
          // Update the drumPattern property
          // Use assertion as CombinedTrack doesn't directly have drumPattern
          return {
            ...track,
            drumPattern: pattern, 
          } as CombinedTrack; 
        }
        return track;
      })
    );

    // No history action is created for drum pattern changes currently.
    console.log(`Updated drum pattern for track ${trackId}`);
  };

  return {
    // Actions
    setDrumPattern,
  };
};
