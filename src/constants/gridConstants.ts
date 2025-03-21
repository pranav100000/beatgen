export const GRID_CONSTANTS = {
  headerHeight: 28,
  trackHeight: 80,
  drumPadHeight: 20,
  measureWidth: 200,
  borderWidth: 1,
  borderColor: '#333',
  sidebarWidth: 200,
  measureCount: 20,
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
} as const;

/**
 * Calculate track width based on duration, BPM, and time signature
 * Example: At 120 BPM, a 30-second track = 60 beats = 15 bars (measures) in 4/4
 *          At 60 BPM, a 30-second track = 30 beats = 7.5 bars (measures) in 4/4
 *          But in 3/4, the same 30 beats would be 10 bars
 * 
 * Formula: 
 * 1. Beats = Duration * (BPM / 60)
 * 2. Measures = Beats / BeatsPerMeasure
 * 3. Width = Measures * MeasureWidth
 */
export const calculateTrackWidth = (
  durationInSeconds: number, 
  bpm: number,
  timeSignature?: [number, number]
): number => {
  // Use the passed time signature's numerator or fall back to the default
  const beatsPerMeasure = timeSignature ? timeSignature[0] : GRID_CONSTANTS.beatsPerMeasure;
  
  console.log('Calculating track width:', {
    durationInSeconds,
    bpm,
    timeSignature,
    beatsPerMeasure,
    measureWidth: GRID_CONSTANTS.measureWidth
  });

  // Calculate total beats in the duration
  const beatsPerSecond = bpm / 60;
  const totalBeats = durationInSeconds * beatsPerSecond;
  
  // Convert beats to measures
  const measuresCount = totalBeats / beatsPerMeasure;
  
  // Convert measures to pixels
  const width = measuresCount * GRID_CONSTANTS.measureWidth;

  console.log('Track width calculation results:', {
    beatsPerSecond,
    totalBeats,
    measuresCount,
    finalWidth: width
  });

  return width;
};

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