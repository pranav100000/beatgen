import { Box } from '@mui/material';
import { GRID_CONSTANTS } from '../constants/gridConstants';
import WaveformDisplay from './WaveformDisplay';

interface TrackProps {
  index: number;
  type: string;
  audioFile?: File;
  isPlaying: boolean;
  currentTime: number;
  measureCount: number;
  gridLineStyle: { borderRight: string };
}

function Track({ index, type, audioFile, isPlaying, currentTime, measureCount, gridLineStyle }: TrackProps) {
  return (
    <Box sx={{ 
      display: 'flex',
      height: GRID_CONSTANTS.trackHeight,
      position: 'relative',
      boxSizing: 'border-box',
      borderBottom: `1px solid ${GRID_CONSTANTS.borderColor}`
    }}>
      {/* Track Timeline */}
      <Box sx={{ 
        display: 'flex',
        flex: 1,
        bgcolor: '#1A1A1A',
        position: 'relative',
        overflow: 'hidden',
        height: '100%'
      }}>
        {/* Background Grid */}
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1
        }}>
          {/* Major grid lines (measures) */}
          {Array.from({ length: measureCount + 1 }).map((_, i) => (
            <Box
              key={`major-${i}`}
              sx={{
                position: 'absolute',
                left: `${i * GRID_CONSTANTS.measureWidth}px`,
                top: 0,
                bottom: 0,
                width: 1,
                bgcolor: GRID_CONSTANTS.borderColor
              }}
            />
          ))}

          {/* Minor grid lines (beats) */}
          {Array.from({ length: measureCount * 4 }).map((_, i) => {
            if (i % 4 !== 0) { // Skip positions where major lines exist
              return (
                <Box
                  key={`minor-${i}`}
                  sx={{
                    position: 'absolute',
                    left: `${i * (GRID_CONSTANTS.measureWidth / 4)}px`,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    bgcolor: 'rgba(51, 51, 51, 0.5)'
                  }}
                />
              );
            }
            return null;
          })}

          {/* Horizontal subdivisions */}
          {Array.from({ length: 3 }).map((_, i) => (
            <Box
              key={`horizontal-${i}`}
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${(i + 1) * (GRID_CONSTANTS.trackHeight / 4)}px`,
                height: 1,
                bgcolor: 'rgba(51, 51, 51, 0.5)'
              }}
            />
          ))}
        </Box>

        {/* Waveform */}
        {audioFile && (
          <Box sx={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2,
            padding: '2px 0',
            height: '100%',
            pointerEvents: 'none'
          }}>
            <WaveformDisplay 
              audioFile={audioFile}
              isPlaying={isPlaying}
              color="#4CAF50"
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default Track; 