import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { Note } from '../../../core/types/note';
import { useStudioStore } from '../../../stores/useStudioStore';
import { scaleToPreview } from '../../../utils/noteConversion';

interface MidiNotesPreviewProps {
  trackId: string;
  width: number;
  height: number;
  trackColor: string;
}

const MidiNotesPreview: React.FC<MidiNotesPreviewProps> = ({ 
  trackId, 
  width, 
  height,
  trackColor
}) => {
  // Memoize the random heights so they don't change on every render
  const randomHeights = useMemo(() => 
    Array.from({length: 12}).map(() => Math.random() * 12 + 4),
    [] // Empty dependency array means this only runs once when component mounts
  );

  // Get notes from the MidiManager through store
  const { store } = useStudioStore();
  const notes = store?.getMidiManager().getTrackNotes(trackId) || [];
  
  // Find the range of notes for better scaling
  let minNoteRow = 127;
  let maxNoteRow = 0;
  let maxColumn = 0;
  
  if (notes.length > 0) {
    notes.forEach(note => {
      // Track min and max note rows
      if (note.row < minNoteRow) minNoteRow = note.row;
      if (note.row > maxNoteRow) maxNoteRow = note.row;
      
      // Track max column for width scaling
      const noteEnd = note.column + note.length;
      if (noteEnd > maxColumn) maxColumn = noteEnd;
    });
  } else {
    // Default range if no notes
    minNoteRow = 60; // Middle C
    maxNoteRow = 72; // One octave above middle C
  }
  
  // Ensure we have at least a small range for scaling
  if (maxNoteRow - minNoteRow < 6) {
    // Expand the range to at least an octave
    const midPoint = Math.floor((maxNoteRow + minNoteRow) / 2);
    minNoteRow = midPoint - 3;
    maxNoteRow = midPoint + 3;
  }
  
  // Add some padding to the range
  minNoteRow = Math.max(0, minNoteRow - 2);
  maxNoteRow = Math.min(127, maxNoteRow + 2);
  
  const noteRange = maxNoteRow - minNoteRow + 1;
  const canvasHeight = height;
  const noteHeightScale = canvasHeight / noteRange;
  
  // Calculate the columns that should fit within the view width
  // Standard 4-bar section at 16th note resolution = 64 columns (4 * 4 * 4)
  const standardColumns = 32;
  
  // Determine actual scaling based on the visible area
  const effectiveMaxColumn = Math.max(standardColumns, maxColumn > 0 ? maxColumn : standardColumns);
  
  // Maintain consistent column width regardless of the maxColumn
  // This way, notes at column 32 always appear at the same position
  const noteWidthScale = width / standardColumns; 

  return (
    <Box
      sx={{
        width: '100%', // Extend width to fit notes
        height: '100%',
        position: 'relative',
        overflow: 'hidden' // Allow content to extend beyond container
      }}
    >
      {/* Notes rendering */}
      {notes.map(note => {
        // Calculate position and dimensions
        const x = scaleToPreview(note.column * noteWidthScale);
        // Calculate relative position in our range and invert Y (high notes at top)
        const relativePosition = maxNoteRow - note.row;
        const y = relativePosition * noteHeightScale;
        const w = scaleToPreview(note.length * noteWidthScale);
        const h = noteHeightScale * 0.9; // Slight gap between notes
        return (
          <Box
            key={note.id}
            sx={{
              position: 'absolute',
              left: `${x}px`,
              top: `${y}px`,
              width: `${w}px`,
              height: `${h}px`,
              bgcolor: 'white',
              opacity: 1,
              borderRadius: '2px',
              boxSizing: 'border-box',
              boxShadow: '0 0 3px rgba(255,255,255,0.7)'
            }}
          />
        );
      })}
      
      {notes.length === 0 && (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          opacity: 0.6,
          fontSize: '10px',
          color: '#fff'
        }}>
          {randomHeights.map((height, i) => (
            <Box 
              key={i}
              sx={{
                height: height, // Use memoized height instead of calculating new random value
                width: 4,
                mx: 0.5,
                bgcolor: 'white',
                borderRadius: '2px'
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default MidiNotesPreview;