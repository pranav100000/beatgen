import React, { useMemo } from 'react';
import { Box } from '@mui/material';

interface PianoKeyboardProps {
  octaves: number;
  cellHeight: number;
  displayRowToActualRow: (displayRow: number) => number;
}

const PianoKeyboard: React.FC<PianoKeyboardProps> = ({ octaves, cellHeight, displayRowToActualRow }) => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const notesPerOctave = 12;
  const totalNotes = octaves * notesPerOctave;

  const isBlackKey = (noteIndex: number): boolean => {
    const noteInOctave = noteIndex % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave);
  };

  const keys = useMemo(() => {
    return [...Array(totalNotes)].map((_, index) => {
      const actualIndex = displayRowToActualRow(index);
      const octave = Math.floor(actualIndex / 12);
      const noteInOctave = actualIndex % 12;
      const isBlack = isBlackKey(actualIndex);
      
      return (
        <Box
          key={`key-${index}`}
          sx={{
            height: `${cellHeight}px`,
            bgcolor: isBlack ? 'black' : 'white',
            color: isBlack ? 'white' : 'black',
            display: 'flex',
            alignItems: 'center',
            pl: 0.5,
            fontSize: '12px',
            boxSizing: 'border-box',
            borderBottom: 1,
            borderColor: 'grey.300',
            position: 'relative',
            '&::after': isBlack ? {
              content: '""',
              position: 'absolute',
              right: 0,
              top: 0,
              width: '50%',
              height: '100%',
              bgcolor: 'rgba(0, 0, 0, 0.1)',
              pointerEvents: 'none'
            } : {}
          }}
        >
          {!isBlack && `${noteNames[noteInOctave]}${octave}`}
        </Box>
      );
    });
  }, [totalNotes, cellHeight, displayRowToActualRow]);

  return (
    <Box sx={{ 
      width: '64px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRight: 1,
      borderColor: 'grey.300',
      position: 'sticky',
      left: 0,
      zIndex: 3,
      backgroundColor: 'background.paper'
    }}>
      {keys}
    </Box>
  );
};

export default PianoKeyboard;