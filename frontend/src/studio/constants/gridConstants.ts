import { useGridStore } from '../core/state/gridStore';
import { MUSIC_CONSTANTS } from './musicConstants';

// Create a function to get the current measure width
export const getMeasureWidth = () => useGridStore.getState().audioMeasurePixelWidth;

export const GRID_CONSTANTS = {
  studioZoomMin: 0.3,
  studioZoomMax: 4,
  studioZoomDefault: 1,
  studioZoomStep: 0.1,
  headerHeight: 28,
  trackHeight: 80,
  drumPadHeight: 20,
  // Use getter function for measureWidth
  get measureWidth() {
    return getMeasureWidth();
  },
  borderWidth: 1,
  borderColor: '#333',
  sidebarWidth: 200,
  measureCount: 10,
  pixelsPerSecond: 100,
  controlsWidth: 0,
  gridSubdivisions: 4,
  minorGridOpacity: 0.3,
  majorGridOpacity: 1,
  beatsPerMeasure: 4,
  midiNoteHeight: 4, // Height of MIDI notes in the track preview
  scrollThreshold: 50,
  cursorColor: '#ff5555', // Color for the playback cursor
  cursorColorInactive: '#aaaaaa', // Color for inactive cursor
  borderRadiusMedium: '10px',
  borderRadiusLarge: '50px',
  
  // Track color palette - 10 distinct colors distributed evenly around the color wheel
  trackColors: [
    '#E91E63', // Pink
    '#673AB7', // Deep Purple
    '#2196F3', // Blue
    '#4CAF50', // Green 
    '#FF9800', // Orange 
    '#FF5252', // Red
    '#9C27B0', // Purple
    '#00BCD4', // Cyan
    '#FFEB3B' // Yellow
  ],
} as const;

/**
 * Calculate track width based on duration, BPM, and time signature
 * If trim values are provided, calculates width based on trimmed duration
 * 
 * Formula: 
 * 1. Beats = Duration * (BPM / 60)
 * 2. Measures = Beats / BeatsPerMeasure
 * 3. Width = Measures * MeasureWidth
 */
export const calculateTrackWidth = (
  durationInSeconds: number, 
  bpm: number,
  timeSignature?: [number, number],
  trimValues?: {
    trimStartTicks?: number,
    trimEndTicks?: number,
    originalDurationTicks?: number
  }
): number => {
  const beatsPerMeasure = timeSignature ? timeSignature[0] : GRID_CONSTANTS.beatsPerMeasure;
  
  // Use getMeasureWidth() instead of GRID_CONSTANTS.measureWidth
  const currentMeasureWidth = getMeasureWidth();
  
  // If we have trim values, calculate width based on trimmed duration
  if (trimValues && 
      trimValues.trimStartTicks !== undefined && 
      trimValues.trimEndTicks !== undefined && 
      trimValues.originalDurationTicks) {
    
    // Calculate the trimmed duration in ticks
    const trimmedDurationTicks = trimValues.trimEndTicks - trimValues.trimStartTicks;
    
    // Calculate ratio of trimmed duration to original duration
    const trimRatio = trimmedDurationTicks / trimValues.originalDurationTicks;
    
    // Apply ratio to the full width calculation
    const fullWidth = calculateFullTrackWidth(durationInSeconds, bpm, beatsPerMeasure, currentMeasureWidth);
    
    // Return trimmed width
    return fullWidth * trimRatio;
  }
  
  // Standard width calculation for untrimmed tracks
  return calculateFullTrackWidth(durationInSeconds, bpm, beatsPerMeasure, currentMeasureWidth);
};

/**
 * Helper function for calculating full track width without trimming
 */
function calculateFullTrackWidth(
  durationInSeconds: number,
  bpm: number,
  beatsPerMeasure: number,
  measureWidth: number
): number {
  // Calculate total beats in the duration
  const beatsPerSecond = bpm / 60;
  const totalBeats = durationInSeconds * beatsPerSecond;
  
  // Convert beats to measures
  const measuresCount = totalBeats / beatsPerMeasure;
  
  // Convert measures to pixels
  return measuresCount * measureWidth;
}

/**
 * Convert time to position based on musical timing rather than just seconds
 * This ensures the cursor aligns with grid lines at exact beat positions
 * 
 * @param timeInSeconds Current playback time in seconds
 * @param bpm Beats per minute
 * @param timeSignature Optional time signature to use for calculation
 * @returns Position in pixels
 */
export const calculateTimePosition = (
  timeInSeconds: number, 
  bpm: number, 
  timeSignature?: [number, number]
): number => {
  // Use the passed time signature's numerator or fall back to the default
  const beatsPerMeasure = timeSignature ? timeSignature[0] : GRID_CONSTANTS.beatsPerMeasure;
  
  // Calculate how many beats have elapsed
  const beatsPerSecond = bpm / 60;
  const elapsedBeats = timeInSeconds * beatsPerSecond;
  
  // Calculate how many measures and beats
  const elapsedMeasures = Math.floor(elapsedBeats / beatsPerMeasure);
  const remainingBeats = elapsedBeats % beatsPerMeasure;
  
  // Convert to pixels
  const beatWidth = GRID_CONSTANTS.measureWidth / beatsPerMeasure;
  const position = (elapsedMeasures * GRID_CONSTANTS.measureWidth) + (remainingBeats * beatWidth);
  
  return position;
};

/**
 * Convert pixel position to musical time
 * Useful for clicking on the timeline to set playback position
 * 
 * @param positionInPixels Position in pixels
 * @param bpm Beats per minute
 * @param timeSignature Optional time signature to use for calculation
 * @returns Time in seconds
 */
export const calculatePositionTime = (
  positionInPixels: number, 
  bpm: number,
  timeSignature?: [number, number]
): number => {
  // Use the passed time signature's numerator or fall back to the default
  const beatsPerMeasure = timeSignature ? timeSignature[0] : GRID_CONSTANTS.beatsPerMeasure;
  
  const beatWidth = GRID_CONSTANTS.measureWidth / beatsPerMeasure;
  const totalBeats = positionInPixels / beatWidth;
  
  // Convert beats to time
  const beatsPerSecond = bpm / 60;
  const timeInSeconds = totalBeats / beatsPerSecond;
  
  return timeInSeconds;
};

/**
 * Convert pixel position to ticks
 * Used for storing position in a musically-accurate form
 * 
 * @param positionInPixels Position in pixels
 * @param bpm Beats per minute
 * @param timeSignature Optional time signature to use for calculation
 * @param ppq Pulses (ticks) per quarter note (default: 960)
 * @returns Position in ticks
 */
export const pixelsToTicks = (
  positionInPixels: number,
  bpm: number,
  timeSignature?: [number, number],
  ppq: number = MUSIC_CONSTANTS.pulsesPerQuarterNote
): number => {
  // Use the passed time signature's numerator or fall back to the default
  const beatsPerMeasure = timeSignature ? timeSignature[0] : GRID_CONSTANTS.beatsPerMeasure;
  
  // Calculate how many beats per pixel
  const beatWidth = GRID_CONSTANTS.measureWidth / beatsPerMeasure;
  const beats = positionInPixels / beatWidth;
  
  // Convert beats to ticks
  return Math.round(beats * ppq);
};

/**
 * Convert ticks to pixel position
 * Used for displaying musically-accurate position
 * 
 * @param ticks Position in ticks
 * @param bpm Beats per minute
 * @param timeSignature Optional time signature to use for calculation
 * @param ppq Pulses (ticks) per quarter note (default: 960)
 * @returns Position in pixels
 */
export const ticksToPixels = (
  ticks: number,
  bpm: number,
  timeSignature?: [number, number],
  ppq: number = MUSIC_CONSTANTS.pulsesPerQuarterNote
): number => {
  // Use the passed time signature's numerator or fall back to the default
  const beatsPerMeasure = timeSignature ? timeSignature[0] : GRID_CONSTANTS.beatsPerMeasure;
  
  // Calculate beats from ticks
  const beats = ticks / ppq;
  
  // Calculate pixels from beats
  const beatWidth = GRID_CONSTANTS.measureWidth / beatsPerMeasure;
  return beats * beatWidth;
};

/**
 * Get track color based on track index
 * Colors are selected in sequence from the trackColors array
 * After reaching the end of the array, it cycles back to the beginning
 * 
 * @param trackIndex The index of the track (0-based)
 * @returns The color as a hex string
 */
export const getTrackColor = (trackIndex: number): string => {
  // Use modulo to cycle through the colors
  const colorIndex = trackIndex % GRID_CONSTANTS.trackColors.length;
  return GRID_CONSTANTS.trackColors[colorIndex];
};

/**
 * Convert a Position object with tick-based x coordinate to one with pixel-based x
 * Used for display in UI components
 * 
 * @param position Position with x in ticks
 * @param bpm Beats per minute
 * @param timeSignature Optional time signature to use for calculation
 * @param ppq Pulses (ticks) per quarter note (default: 960)
 * @returns Position with x in pixels
 */
export const positionToPixels = (
  position: { x: number, y: number },
  bpm: number,
  timeSignature?: [number, number],
  ppq: number = MUSIC_CONSTANTS.pulsesPerQuarterNote
): { x: number, y: number } => {
  return {
    x: ticksToPixels(position.x, bpm, timeSignature, ppq),
    y: position.y
  };
};

/**
 * Convert a Position object with pixel-based x coordinate to one with tick-based x
 * Used for storing position in state
 * 
 * @param position Position with x in pixels
 * @param bpm Beats per minute
 * @param timeSignature Optional time signature to use for calculation
 * @param ppq Pulses (ticks) per quarter note (default: 960)
 * @returns Position with x in ticks
 */
export const positionToTicks = (
  position: { x: number, y: number },
  bpm: number,
  timeSignature?: [number, number],
  ppq: number = MUSIC_CONSTANTS.pulsesPerQuarterNote
): { x: number, y: number } => {
  return {
    x: pixelsToTicks(position.x, bpm, timeSignature, ppq),
    y: position.y
  };
}; 