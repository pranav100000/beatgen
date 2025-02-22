import React from 'react';
import Box from '@mui/material/Box';

interface TimeSignatureDisplayProps {
  topNumber: number;
  bottomNumber: number;
  onTopNumberClick?: () => void;
  onBottomNumberClick?: () => void;
}

export const TimeSignatureDisplay: React.FC<TimeSignatureDisplayProps> = ({
  topNumber,
  bottomNumber,
  onTopNumberClick,
  onBottomNumberClick,
}) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      bgcolor: '#1E1E1E',
      borderRadius: 1,
      px: 2,
      py: 0.5,
    }}
  >
    <Box
      component="span"
      onClick={onTopNumberClick}
      sx={{
        cursor: 'pointer',
        '&:hover': {
          color: '#888',
        },
        transition: 'color 0.2s',
      }}
    >
      {topNumber}
    </Box>
    <Box
      component="span"
      sx={{
        mx: 1,
      }}
    >
      /
    </Box>
    <Box
      component="span"
      onClick={onBottomNumberClick}
      sx={{
        cursor: 'pointer',
        '&:hover': {
          color: '#888',
        },
        transition: 'color 0.2s',
      }}
    >
      {bottomNumber}
    </Box>
  </Box>
);

export default TimeSignatureDisplay; 