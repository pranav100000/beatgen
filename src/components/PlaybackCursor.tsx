import { Box } from '@mui/material';
import { GRID_CONSTANTS } from '../constants/gridConstants';

interface PlaybackCursorProps {
  currentTime: number;
}

function PlaybackCursor({ currentTime }: PlaybackCursorProps) {
  const position = currentTime * GRID_CONSTANTS.pixelsPerSecond;

  return (
    <Box
      sx={{
        position: 'absolute',
        left: `${position}px`,
        top: 0,
        bottom: 0,
        width: '1px',
        bgcolor: 'gray',
        zIndex: 3,
        pointerEvents: 'none'
      }}
    />
  );
}

export default PlaybackCursor; 