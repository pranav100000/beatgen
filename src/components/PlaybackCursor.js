import { Box } from '@mui/material';
import { GRID_CONSTANTS } from '../constants/gridConstants';

function PlaybackCursor({ currentTime }) {
  const position = (currentTime * GRID_CONSTANTS.pixelsPerSecond) + GRID_CONSTANTS.controlsWidth;

  return (
    <Box
      sx={{
        position: 'absolute',
        left: `${position}px`,
        top: 0,
        bottom: 0,
        width: '2px',
        bgcolor: '#ff0000',
        zIndex: 3,
        pointerEvents: 'none'
      }}
    />
  );
}

export default PlaybackCursor; 