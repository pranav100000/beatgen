import { create } from 'zustand';

/**
 * Interface for PianoRoll store state
 */
interface PianoRollStore {
  // State
  openPianoRolls: Record<string, boolean>;
  
  // Actions
  openPianoRoll: (trackId: string) => void;
  closePianoRoll: (trackId: string) => void;
}

/**
 * Store for managing piano roll state
 * Replaces PianoRollContext with a simpler Zustand store
 */
export const usePianoRollStore = create<PianoRollStore>((set) => ({
  // Initial state
  openPianoRolls: {},
  
  // Actions
  openPianoRoll: (trackId: string) => set((state) => ({
    openPianoRolls: { ...state.openPianoRolls, [trackId]: true }
  })),
  
  closePianoRoll: (trackId: string) => set((state) => ({
    openPianoRolls: { ...state.openPianoRolls, [trackId]: false }
  }))
}));