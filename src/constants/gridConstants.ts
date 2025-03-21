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
 * Calculate track width based on duration and BPM
 * Example: At 120 BPM, a 30-second track = 60 beats = 15 bars (measures)
 *          At 60 BPM, a 30-second track = 30 beats = 7.5 bars (measures)
 * 
 * Formula: 
 * 1. Beats = Duration * (BPM / 60)
 * 2. Measures = Beats / BeatsPerMeasure
 * 3. Width = Measures * MeasureWidth
 */
export const calculateTrackWidth = (durationInSeconds: number, bpm: number): number => {
  console.log('Calculating track width:', {
    durationInSeconds,
    bpm,
    beatsPerMeasure: GRID_CONSTANTS.beatsPerMeasure,
    measureWidth: GRID_CONSTANTS.measureWidth
  });

  // Calculate total beats in the duration
  const beatsPerSecond = bpm / 60;
  const totalBeats = durationInSeconds * beatsPerSecond;
  
  // Convert beats to measures
  const measuresCount = totalBeats / GRID_CONSTANTS.beatsPerMeasure;
  
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
 * @returns Position in pixels
 */
export const calculateTimePosition = (timeInSeconds: number, bpm: number): number => {
  // Calculate how many beats have elapsed
  const beatsPerSecond = bpm / 60;
  const elapsedBeats = timeInSeconds * beatsPerSecond;
  
  // Calculate how many measures and beats
  const elapsedMeasures = Math.floor(elapsedBeats / GRID_CONSTANTS.beatsPerMeasure);
  const remainingBeats = elapsedBeats % GRID_CONSTANTS.beatsPerMeasure;
  
  // Convert to pixels
  const beatWidth = GRID_CONSTANTS.measureWidth / GRID_CONSTANTS.beatsPerMeasure;
  const position = (elapsedMeasures * GRID_CONSTANTS.measureWidth) + (remainingBeats * beatWidth);
  
  return position;
};

/**
 * Convert pixel position to musical time
 * Useful for clicking on the timeline to set playback position
 * 
 * @param positionInPixels Position in pixels
 * @param bpm Beats per minute
 * @returns Time in seconds
 */
export const calculatePositionTime = (positionInPixels: number, bpm: number): number => {
  const beatWidth = GRID_CONSTANTS.measureWidth / GRID_CONSTANTS.beatsPerMeasure;
  const totalBeats = positionInPixels / beatWidth;
  
  // Convert beats to time
  const beatsPerSecond = bpm / 60;
  const timeInSeconds = totalBeats / beatsPerSecond;
  
  return timeInSeconds;
}; 