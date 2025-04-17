import React from 'react';
import { Box } from '@mui/material';
import { MUSIC_CONSTANTS } from '../../../constants/musicConstants';

// Constants for the preview grid
const PREVIEW_COLS = 64; // Show 4 bars (16 steps * 4)
const TICKS_PER_STEP = MUSIC_CONSTANTS.pulsesPerQuarterNote / 4; // Assuming 4 steps per beat (like DrumMachine)

interface DrumGridPreviewProps {
  pattern: boolean[][] | null;
  width: number;
  height: number;
  trackColor: string;
  // Add other necessary props like timeSignature, bpm, etc. if needed for calculations
  timeSignature?: [number, number];
  bpm?: number;
}

const DrumGridPreview: React.FC<DrumGridPreviewProps> = ({
  pattern,
  width,
  height,
  trackColor,
  timeSignature = [4, 4],
  bpm = 120
}) => {

  console.log(`DrumGridPreview: Received pattern:`, pattern);

  // Determine number of rows dynamically, default to 1 if pattern is null/empty
  const numRows = pattern?.length || 1;
  // Keep number of columns fixed for now
  const numCols = PREVIEW_COLS; 

  // Use the passed-in pattern directly, but prepare a sliced version for display
  const patternToShow = pattern 
    ? pattern.slice(0, numRows).map(row => row.slice(0, numCols))
    : Array(numRows).fill(null).map(() => Array(numCols).fill(false));

  return (
    <Box 
      sx={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: 'rgba(0,0,0,0.2)', 
        border: `1px solid ${trackColor}`,
        borderRadius: '2px',
        overflow: 'hidden',
        position: 'relative',
        display: 'grid', // Use grid layout for the preview
        gridTemplateRows: `repeat(${numRows}, 1fr)`, // Use dynamic row count
        gridTemplateColumns: `repeat(${numCols}, 1fr)`, // Use numCols (which is PREVIEW_COLS)
        gap: '2px', // Small gap between cells
        padding: '1px' // Padding around the grid
      }}
    >
      {/* Render the grid cells using the sliced pattern */}
      {patternToShow.map((row, rowIndex) => 
        row.map((isActive, colIndex) => (
          <Box 
            key={`cell-${rowIndex}-${colIndex}`}
            sx={{
              backgroundColor: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.05)',
              borderRadius: '2px',
              // Add a subtle white blur effect using box-shadow for active cells
              boxShadow: isActive ? '0px 0px 3px 1px rgba(255, 255, 255, 0.6)' : 'none',
              transition: 'box-shadow 0.1s ease-in-out' // Smooth transition for the effect
            }}
          />
        ))
      )}
      {/* 
      <span style={{ color: trackColor, fontSize: '10px', opacity: 0.7 }}>
        Drum Grid Preview (TODO)
      </span>
      */}
    </Box>
  );
};

export default DrumGridPreview; 