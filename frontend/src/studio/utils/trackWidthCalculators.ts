import { Note } from '../core/types/note';

/**
 * Calculate width for audio tracks based on duration and BPM
 * Audio tracks should resize when BPM changes but not when time signature changes
 *
 * @param durationInSeconds Duration of the audio track in seconds
 * @param bpm Current beats per minute
 * @param audioMeasureWidth Width of a measure in pixels for audio tracks
 * @returns Width of the track in pixels
 */
export function calculateAudioTrackWidth(
  durationInSeconds: number,
  bpm: number,
  audioMeasureWidth: number,
): number {
  // Convert duration to musical beats based on BPM
  const beatsPerSecond = bpm / 60;
  const totalBeats = durationInSeconds * beatsPerSecond;
  
  // Use fixed 4 beats per measure for audio tracks (standard 4/4 equivalent)
  const beatsPerMeasure = 4;
  const measuresCount = totalBeats / beatsPerMeasure;
  
  // Calculate final width
  const width = measuresCount * audioMeasureWidth;
  
  return width;
}

/**
 * Calculate width for MIDI tracks based on note positions and time signature
 * MIDI tracks should resize when time signature changes but not when BPM changes
 *
 * @param notes Array of MIDI notes in the track
 * @param timeSignature Current time signature as [beats, beatUnit]
 * @param midiMeasureWidth Width of a measure in pixels for MIDI tracks
 * @returns Width of the track in pixels
 */
export function calculateMidiTrackWidth(
  notes: Note[],
  timeSignature: [number, number],
  midiMeasureWidth: number,
): number {
  // Extract time signature components
  const [beatsPerMeasure, beatUnit] = timeSignature;
  
  // Calculate columns per measure based on time signature
  // Assuming standard 4 columns (16th notes) per beat in 4/4
  // Adjust for different time signatures
  const columnsPerBeat = 4; // Standard columns per beat (16th notes)
  const columnsPerMeasure = beatUnit / beatsPerMeasure;
  
  // Default to minimum 1 measure if no notes or notes are very close to start
  
  
  // Calculate final width
  const width = columnsPerMeasure * midiMeasureWidth * columnsPerBeat;
  
  return width;
}