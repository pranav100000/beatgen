import { create } from 'zustand';

interface GridStore {
  measureWidth: number;
  setMeasureWidth: (width: number) => void;
}

// Move the default value to a separate constant that can be imported by both files
export const DEFAULT_MEASURE_WIDTH = 200;

export const useGridStore = create<GridStore>((set) => ({
  measureWidth: DEFAULT_MEASURE_WIDTH,
  setMeasureWidth: (width: number) => set({ measureWidth: width }),
})); 