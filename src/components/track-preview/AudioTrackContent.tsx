import React from 'react';
import { Box } from '@mui/material';
import { TrackContentProps } from './TrackPreviewTypes';
import WaveformDisplay from '../WaveformDisplay';
import { GRID_CONSTANTS } from '../../constants/gridConstants';

const AudioTrackContent: React.FC<TrackContentProps> = ({
  track,
  isPlaying,
  currentTime,
  measureCount,
  trackWidth,
  bpm
}) => {
  const { audioFile } = track;

  return (
    <>
      {/* Background Grid */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
        width: '100%'
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
              bgcolor: GRID_CONSTANTS.borderColor,
              opacity: 0.8
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
          pointerEvents: 'none',
          width: typeof trackWidth === 'number' ? `${trackWidth}px` : '100%'
        }}>
          <WaveformDisplay 
            audioFile={audioFile}
            isPlaying={isPlaying}
            color="#4CAF50"
            width={typeof trackWidth === 'number' ? trackWidth : undefined}
            bpm={bpm}
          />
        </Box>
      )}
    </>
  );
};

export default AudioTrackContent; 