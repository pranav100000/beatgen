import { Box, useTheme } from '@mui/material';

interface TimeDisplayProps {
  currentTime: number;
}

export const TimeDisplay = ({ currentTime }: TimeDisplayProps) => {
  const theme = useTheme();

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const milliseconds = Math.floor((timeInSeconds * 100) % 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ 
      color: 'text.primary',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '80px',
      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
      padding: '4px 8px',
      borderRadius: '6px',
      border: `1px solid ${theme.palette.divider}`,
      fontFamily: 'monospace'
    }}>
      {formatTime(currentTime)}
    </Box>
  );
}; 