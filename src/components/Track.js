import { Box } from '@mui/material';
import { GRID_CONSTANTS } from '../constants/gridConstants';
import TrackControls from './TrackControls';
import WaveformDisplay from './WaveformDisplay';

function Track({ index, onDelete, type, audioFile, isPlaying, measureCount, gridLineStyle }) {
  return (
    <Box sx={{ 
      display: 'flex',
      height: GRID_CONSTANTS.trackHeight,
      position: 'relative'
    }}>
      <TrackControls index={index} onDelete={onDelete} />

      {/* Track Timeline */}
      <Box sx={{ 
        display: 'flex',
        flex: 1,
        bgcolor: '#1A1A1A',
        position: 'relative',
        overflow: 'hidden',
        borderBottom: gridLineStyle.borderRight
      }}>
        {/* Grid lines */}
        {Array.from({ length: measureCount + 1 }).map((_, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              left: `${(i * GRID_CONSTANTS.measureWidth)}px`,
              top: 0,
              bottom: 0,
              width: GRID_CONSTANTS.borderWidth,
              bgcolor: GRID_CONSTANTS.borderColor,
              zIndex: 1
            }}
          />
        ))}

        {/* Waveform */}
        {audioFile && (
          <Box sx={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 0,
            padding: '10px'
          }}>
            <WaveformDisplay 
              audioFile={audioFile}
              isPlaying={isPlaying}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default Track; 