import React from 'react';
import { Box } from '@mui/material';

interface PianoGridProps {
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
  totalNotes: number;
  gridColumns: number;
  displayRowToActualRow: (displayRow: number) => number;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  isBlackKey: (noteIndex: number) => boolean;
}

const PianoGrid: React.FC<PianoGridProps> = ({
  width,
  height,
  cellWidth,
  cellHeight,
  totalNotes,
  gridColumns,
  displayRowToActualRow,
  onClick,
  isBlackKey
}) => {
  // This function ensures we're capturing the click event properly
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Double-check that we're not inside a note or handler before passing the click
    if (!(e.target as HTMLElement).closest('.note-element')) {
      onClick(e);
    }
  };

  return (
    <Box 
      sx={{ 
        position: 'relative',
        height: `${totalNotes * cellHeight}px`,
        width: `${gridColumns * cellWidth}px`,
        minWidth: '100%',
        backgroundColor: 'white',
        flexShrink: 0
      }}
      onClick={handleClick}
    >
      {/* Draw the row backgrounds first */}
      <Box sx={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        height: `${totalNotes * cellHeight}px`,
        zIndex: 0 
      }}>
        {[...Array(totalNotes)].map((_, index) => {
          const actualIndex = displayRowToActualRow(index);
          return (
            <Box
              key={`row-bg-${index}`}
              sx={{
                position: 'absolute',
                width: '100%',
                height: `${cellHeight}px`,
                top: `${index * cellHeight}px`,
                bgcolor: isBlackKey(actualIndex) ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                borderBottom: 1,
                borderColor: 'grey.200',
                boxSizing: 'border-box'
              }}
            />
          );
        })}
      </Box>

      {/* Draw grid lines */}
      {[...Array(gridColumns)].map((_, index) => (
        <Box
          key={`gridline-${index}`}
          sx={{
            position: 'absolute',
            height: '100%',
            width: '1px',
            left: `${index * cellWidth}px`,
            bgcolor: index % 4 === 0 ? 'grey.300' : 'grey.200',
            zIndex: 1
          }}
        />
      ))}
    </Box>
  );
};

export default PianoGrid;