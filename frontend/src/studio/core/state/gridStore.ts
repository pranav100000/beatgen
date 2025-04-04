import { create } from 'zustand';

interface GridStore {
  audioMeasureWidth: number;
  setAudioMeasureWidth: (width: number) => void;
  midiMeasureWidth: number;
  setMidiMeasureWidth: (width: number) => void;
}

// Move the default value to a separate constant that can be imported by both files
export const DEFAULT_MEASURE_WIDTH = 200;

export const useGridStore = create<GridStore>((set) => ({
  audioMeasureWidth: DEFAULT_MEASURE_WIDTH,
  setAudioMeasureWidth: (width: number) => set({ audioMeasureWidth: width }),
  midiMeasureWidth: DEFAULT_MEASURE_WIDTH,
  setMidiMeasureWidth: (width: number) => set({ midiMeasureWidth: width }),
})); 