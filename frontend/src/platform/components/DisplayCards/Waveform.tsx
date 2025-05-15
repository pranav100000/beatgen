import React, { useState, useRef } from 'react';
import { Box } from '@mui/material';
import { formatTime } from '../../../studio/utils/audioProcessing'; // Path for the global formatTime

// Enhanced waveform component with progress and click handling
const Waveform = ({ 
  data, 
  playing = false, 
  progress = 0, 
  duration = 0,
  onSeek
}: { 
  data: number[], 
  playing?: boolean, 
  progress?: number, 
  duration?: number,
  onSeek?: (position: number) => void 
}) => {
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  
  // Calculate current position as percentage
  const progressPercent = duration > 0 ? (progress / duration) : 0;
  
  // Handle mouse move to show time indicator
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current || !onSeek) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const position = (e.clientX - rect.left) / rect.width;
    setHoverPosition(position);
  };
  
  // Handle click to seek
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current || !onSeek || !duration) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const position = (e.clientX - rect.left) / rect.width;
    onSeek(position * duration);
  };
  
  // Format time for hover display
  const formatHoverTime = (position: number): string => {
    if (!duration) return "0:00"; // Or use formatTime(0, false) for consistency
    const seconds = Math.floor(position * duration);
    // Pass false to formatTime to get MM:SS, assuming that's the desired hover format
    return formatTime(seconds, false); 
  };
  
  return (
    <Box 
      ref={waveformRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverPosition(null)}
      sx={{ 
        height: 40, 
        width: '100%', 
        display: 'flex', 
        alignItems: 'flex-end',
        position: 'relative',
        marginTop: 1,
        marginBottom: 1,
        cursor: onSeek ? 'pointer' : 'default',
      }}
    >
      {/* Waveform bars */}
      {data.map((value, index) => (
        <Box 
          key={index}
          sx={{
            height: `${Math.max(3, value * 40)}px`,
            width: '100%',
            flex: 1,
            backgroundColor: index < (data.length * progressPercent) ? '#6a3de8' : '#555',
            mx: '1px',
            transition: 'background-color 0.1s ease'
          }}
        />
      ))}
      
      {/* Time indicator on hover */}
      {hoverPosition !== null && (
        <Box sx={{
          position: 'absolute',
          bottom: '100%',
          left: `${hoverPosition * 100}%`,
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '0.7rem',
          marginBottom: '4px'
        }}>
          {formatHoverTime(hoverPosition)}
        </Box>
      )}
      
      {/* Playback position indicator */}
      {playing && progress > 0 && (
        <Box sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${progressPercent * 100}%`,
          width: '2px',
          backgroundColor: '#fff',
          zIndex: 2
        }} />
      )}
    </Box>
  );
};

export default Waveform;
