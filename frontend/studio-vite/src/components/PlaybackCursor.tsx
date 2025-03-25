import React from 'react';
import { Box } from '@mui/material';
import { GRID_CONSTANTS, calculateTimePosition } from '../constants/gridConstants';

interface PlaybackCursorProps {
  currentTime: number;
  isPlaying?: boolean;
  bpm?: number;
  timeSignature?: [number, number];
}

function PlaybackCursor({ currentTime, isPlaying = false, bpm = 120, timeSignature = [4, 4] }: PlaybackCursorProps) {
  // Use musical timing for accurate cursor positioning
  const position = calculateTimePosition(currentTime, bpm, timeSignature);
  
  // Colors from constants
  const activeColor = GRID_CONSTANTS.cursorColor;
  const inactiveColor = GRID_CONSTANTS.cursorColorInactive;
  
  return (
    <Box
      sx={{
        position: 'absolute',
        left: `${position}px`,
        top: 0,
        bottom: 0,
        width: '2px',
        bgcolor: isPlaying ? activeColor : inactiveColor, // Red when playing, gray when paused
        zIndex: 1500, // Higher z-index to stay on top
        pointerEvents: 'none',
        transition: isPlaying ? 'none' : 'left 0.1s ease-out', // Smooth transition when manually positioning
        boxShadow: isPlaying ? `0 0 8px rgba(255, 85, 85, 0.6)` : 'none', // Glow effect when playing
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: '-4px',
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `8px solid ${isPlaying ? activeColor : inactiveColor}`,
          zIndex: 1501,
        }
      }}
    />
  );
}

export default PlaybackCursor; 