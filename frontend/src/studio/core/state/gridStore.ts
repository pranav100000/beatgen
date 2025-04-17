import { MUSIC_CONSTANTS } from '../../constants/musicConstants';
import { create } from 'zustand';

interface GridStore {
  audioMeasurePixelWidth: number;
  setAudioMeasurePixelWidth: (width: number) => void;
  midiMeasurePixelWidth: number;
  setMidiMeasurePixelWidth: (width: number) => void;
}

// Move the default value to a separate constant that can be imported by both files
export const DEFAULT_MEASURE_WIDTH = 200;
export const DEFAULT_PULSES_PER_QUARTER_NOTE = MUSIC_CONSTANTS.pulsesPerQuarterNote;
export const DEFAULT_TICKS_PER_MEASURE = 4 * DEFAULT_PULSES_PER_QUARTER_NOTE;

export const useGridStore = create<GridStore>((set) => ({
  audioMeasurePixelWidth: DEFAULT_MEASURE_WIDTH,
  setAudioMeasurePixelWidth: (width: number) => set({ audioMeasurePixelWidth: width }),
  midiMeasurePixelWidth: DEFAULT_MEASURE_WIDTH,
  setMidiMeasurePixelWidth: (width: number) => set({ midiMeasurePixelWidth: width }),
})); 