import React, { useMemo, useReducer, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { TrackContentProps } from './TrackPreviewTypes';
import { GRID_CONSTANTS } from '../../constants/gridConstants';
import { Note } from '../../core/types/note';
import { MidiExportButton } from '../midi';

// Extended props for MidiTrackContent
interface ExtendedTrackContentProps extends TrackContentProps {
  trackId?: string;
  registerRerenderCallback?: (callback: () => void) => () => void;
}

// Interface for a renderable note with position and size
interface RenderableNote extends Note {
  left: number;
  top: number;
  width: number;
  height: number;
  midiNote: number; // Store the actual MIDI note number for debugging
}

const MidiTrackContent: React.FC<ExtendedTrackContentProps> = ({
  track,
  isPlaying,
  currentTime,
  measureCount,
  trackWidth,
  bpm,
  notes = [], // Default to empty array if notes aren't provided
  trackId,
  registerRerenderCallback,
  timeSignature = [4, 4] // Default time signature if not provided
}) => {
  // Create a reducer to force updates with a counter for debugging
  const [forceRenderCounter, forceUpdate] = useReducer(state => state + 1, 0);
  const initialRenderRef = useRef(true);
  const notesRef = useRef<Note[]>(notes);

  // Log initial notes for debugging
  useEffect(() => {
    if (initialRenderRef.current) {
      console.log(`MidiTrackContent: Initial render with ${notes.length} notes for track ${trackId}`);
      initialRenderRef.current = false;
    }
  }, [notes.length, trackId]);

  // Register for updates if callback registration is available
  useEffect(() => {
    if (trackId && registerRerenderCallback) {
      // Register our forceUpdate function to be called when notes change
      const unregister = registerRerenderCallback(forceUpdate);
      console.log(`MidiTrackContent: Registered for updates on track ${trackId}`);
      
      // Clean up on unmount
      return () => {
        console.log(`MidiTrackContent: Unregistering updates for track ${trackId}`);
        unregister();
      };
    }
  }, [trackId, registerRerenderCallback]);

  // Update reference when notes change
  useEffect(() => {
    if (JSON.stringify(notesRef.current) !== JSON.stringify(notes)) {
      notesRef.current = notes;
    }
  }, [notes]);

  // Get the number of bars to display (default to 4 if not specified)
  const barsToShow = useMemo(() => {
    const defaultBars = 4;
    
    // If there's a duration set, calculate bars based on that and BPM
    if (track.duration) {
      const beatsPerSecond = bpm / 60;
      const totalBeats = track.duration * beatsPerSecond;
      return Math.max(defaultBars, Math.ceil(totalBeats / GRID_CONSTANTS.beatsPerMeasure));
    }
    
    return defaultBars;
  }, [track.duration, bpm]);

  // Music theory constants
  const beatsPerMeasure = GRID_CONSTANTS.beatsPerMeasure; // Usually 4 for 4/4 time
  const sixteenthNotesPerBeat = 4; // Standard division: 4 sixteenth notes = 1 quarter note
  
  // Calculate display constants
  const measureWidthAdjusted = GRID_CONSTANTS.measureWidth;
  const pixelsPerSixteenthNote = measureWidthAdjusted / (beatsPerMeasure * sixteenthNotesPerBeat);
  const trackHeight = GRID_CONSTANTS.trackHeight;
  
  // Prepare notes for rendering using the grid-based approach
  const { renderableNotes, noteRows, minPitch, maxPitch } = useMemo(() => {
    if (notes.length === 0) {
      return { 
        renderableNotes: [], 
        noteRows: 0, 
        minPitch: 60, // Middle C default
        maxPitch: 72  // One octave above middle C
      };
    }
    
    // Find the range of MIDI notes to determine the grid size
    let minPitch = 127; // MIDI pitch max
    let maxPitch = 0;   // MIDI pitch min
    
    notes.forEach((note) => {
      minPitch = Math.min(minPitch, note.row);
      maxPitch = Math.max(maxPitch, note.row);
    });
    
    // Add a small buffer to the range for visual space
    minPitch = Math.max(0, minPitch - 1);
    maxPitch = Math.min(127, maxPitch + 1);
    
    // Calculate the number of rows we need in our grid
    const noteRows = maxPitch - minPitch + 1;
    
    // Calculate the height of each row
    const rowHeight = trackHeight / noteRows;
    
    // Map the notes to renderable positions within the grid
    const mappedNotes: RenderableNote[] = notes.map((note) => {
      // Position the note horizontally based on its start time (column as sixteenth notes)
      const left = note.column * pixelsPerSixteenthNote;
      const width = note.length * pixelsPerSixteenthNote;
      
      // Position the note vertically based on its grid row
      // Note that MIDI notes go from low to high but our grid rows go from top to bottom
      const rowIndex = maxPitch - note.row; // Invert so higher notes are at the top
      const top = rowIndex * rowHeight;
      
      return {
        ...note,
        left,
        top,
        width,
        height: rowHeight,
        midiNote: note.row
      };
    });
    
    return { renderableNotes: mappedNotes, noteRows, minPitch, maxPitch };
  }, [notes, pixelsPerSixteenthNote, trackHeight]);

  // Utility function to determine if a MIDI note is a black key
  const isBlackKey = (note: number): boolean => {
    const noteInOctave = note % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave);
  };

  // Generate the grid lines - memoize to avoid recalculating on every render
  const gridLines = useMemo(() => {
    const majorGridLines = [];
    const minorGridLines = [];
    
    // Major grid lines (beats)
    for (let i = 0; i <= barsToShow * 4; i++) {
      majorGridLines.push(
        <Box
          key={`major-${i}`}
          sx={{
            position: 'absolute',
            left: `${i * (measureWidthAdjusted / 4)}px`,
            top: 0,
            bottom: 0,
            width: 1,
            bgcolor: i % 4 === 0 ? '#555' : GRID_CONSTANTS.borderColor,
            opacity: i % 4 === 0 ? 1 : 0.8
          }}
        />
      );
    }
    
    // Minor grid lines (16th notes) - only showing relevant ones
    for (let i = 0; i < barsToShow * 16; i++) {
      if (i % 4 !== 0) { // Skip positions where major lines exist
        minorGridLines.push(
          <Box
            key={`minor-${i}`}
            sx={{
              position: 'absolute',
              left: `${i * pixelsPerSixteenthNote}px`,
              top: 0,
              bottom: 0,
              width: 1,
              bgcolor: 'rgba(51, 51, 51, 0.5)'
            }}
          />
        );
      }
    }
    
    return { majorGridLines, minorGridLines };
  }, [barsToShow, measureWidthAdjusted, pixelsPerSixteenthNote]);

  // Generate horizontal piano roll lines - memoize to avoid recalculation
  const pianoRollLines = useMemo(() => {
    if (noteRows <= 0) return { horizontalLines: [], blackKeyBackgrounds: [] };
    
    const horizontalLines = [];
    const blackKeyBackgrounds = [];
    
    // Horizontal reference lines
    for (let i = 0; i <= noteRows; i++) {
      const midiNote = maxPitch - i;
      
      // Only draw lines at octave boundaries (C notes) and the bottom line
      const isOctaveBoundary = midiNote % 12 === 0; // C notes
      const isBottomLine = i === noteRows;
      const shouldDrawLine = isOctaveBoundary || isBottomLine;
      
      if (shouldDrawLine) {
        horizontalLines.push(
          <Box
            key={`note-row-${i}`}
            sx={{
              position: 'absolute',
              top: `${(i * trackHeight) / noteRows}px`,
              left: 0,
              right: 0,
              height: 1,
              bgcolor: isOctaveBoundary ? 'rgba(100, 100, 100, 0.7)' : 'rgba(80, 80, 80, 0.4)',
              zIndex: 0
            }}
          />
        );
      }
      
      // Add background for black keys
      if (i < noteRows) { // Don't add for the last line
        const isBlack = isBlackKey(midiNote);
        
        if (isBlack) {
          blackKeyBackgrounds.push(
            <Box
              key={`black-key-bg-${i}`}
              sx={{
                position: 'absolute',
                top: `${(i * trackHeight) / noteRows}px`,
                left: 0,
                right: 0,
                height: `${trackHeight / noteRows}px`,
                bgcolor: 'rgba(30, 30, 30, 0.5)', // Slightly darker for black keys
                zIndex: 0
              }}
            />
          );
        }
      }
    }
    
    return { horizontalLines, blackKeyBackgrounds };
  }, [noteRows, maxPitch, trackHeight, isBlackKey]);

  // Calculate playhead position
  const playheadPosition = useMemo(() => {
    if (!isPlaying) return 0;
    return (currentTime * (bpm / 60)) * (pixelsPerSixteenthNote * sixteenthNotesPerBeat);
  }, [isPlaying, currentTime, bpm, pixelsPerSixteenthNote, sixteenthNotesPerBeat]);

  return (
    <Box sx={{ 
      position: 'relative',
      width: '100%',
      height: '100%',
      backgroundColor: '#1E1E1E',
      overflow: 'hidden'
    }}>
      {/* MIDI Export Button */}
      {trackId && notes.length > 0 && (
        <MidiExportButton
          trackId={trackId}
          trackName={track.name}
          notes={notes}
          bpm={bpm}
          timeSignature={timeSignature}
        />
      )}
      {/* Background Grid */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1
      }}>
        {/* Major grid lines (beats) */}
        {gridLines.majorGridLines}

        {/* Minor grid lines (16th notes) */}
        {gridLines.minorGridLines}

        {/* Black key backgrounds */}
        {pianoRollLines.blackKeyBackgrounds}

        {/* Horizontal piano roll reference lines */}
        {pianoRollLines.horizontalLines}
      </Box>

      {/* Notes Layer */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 3
      }}>
        {/* Render MIDI notes as colored rectangles */}
        {renderableNotes.map((note) => (
          <Box
            key={`note-${note.id}`}
            sx={{
              position: 'absolute',
              left: `${note.left}px`,
              top: `${note.top}px`,
              width: `${note.width}px`,
              height: `${note.height}px`,
              bgcolor: isBlackKey(note.midiNote) ? '#38a169' : '#4CAF50', // Slightly different color for black keys
              opacity: 0.8,
              borderRadius: '2px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              '&:hover': {
                opacity: 1,
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }
            }}
          />
        ))}
        
        {/* Show "MIDI Track • Click to edit" text when there are no notes */}
        {notes.length === 0 && (
          <Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'rgba(255, 255, 255, 0.2)',
            fontSize: '10px',
            textAlign: 'center',
            width: '100%',
            pointerEvents: 'none',
          }}>
            MIDI Track • Click to edit
          </Box>
        )}
      </Box>

      {/* Playhead */}
      {isPlaying && (
        <Box
          sx={{
            position: 'absolute',
            left: `${playheadPosition}px`,
            top: 0,
            bottom: 0,
            width: 2,
            bgcolor: '#ff5722', // Orange playhead
            zIndex: 5,
            boxShadow: '0 0 4px rgba(255, 87, 34, 0.7)'
          }}
        />
      )}
    </Box>
  );
};

export default MidiTrackContent; 