import { Box } from '@mui/material';

interface TimeDisplayProps {
  currentTime: number;
}

export const TimeDisplay = ({ currentTime }: TimeDisplayProps) => {
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const tenths = Math.floor((timeInSeconds * 10) % 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  };

  return (
    <Box sx={{ 
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '80px', // Fixed width container
      backgroundColor: '#333',
      padding: '4px 8px',
      borderRadius: '6px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    }}>
      {formatTime(currentTime)}
    </Box>
  );
}; 