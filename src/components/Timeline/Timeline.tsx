import React, { forwardRef } from 'react';
import { Box } from '@mui/material';
import { GRID_CONSTANTS } from '../../constants/gridConstants';
import Track from '../Track';
import PlaybackCursor from '../PlaybackCursor';
import { TrackState, Position } from '../../core/types/track';

export interface TimelineProps {
  tracks: TrackState[];
  currentTime?: number;
  isPlaying?: boolean;
  measureCount?: number;
  zoomLevel?: number;
  bpm?: number;
  onTrackPositionChange?: (trackId: string, newPosition: Position, isDragEnd: boolean) => void;
  gridLineStyle?: {
    borderRight: string;
  };
}

export const Timeline = forwardRef<HTMLDivElement, TimelineProps>(({
  tracks,
  currentTime = 0,
  isPlaying = false,
  measureCount = GRID_CONSTANTS.measureCount,
  zoomLevel = 1,
  bpm = 120,
  onTrackPositionChange = () => {},
  gridLineStyle = {
    borderRight: `${GRID_CONSTANTS.borderWidth} solid ${GRID_CONSTANTS.borderColor}`
  }
}, ref) => {
  return (
    <Box 
      ref={ref}
      sx={{ flex: 1, position: 'relative', overflow: 'auto' }}
    >
      {/* Time Markers */}
      <TimelineRuler measureCount={measureCount} zoomLevel={zoomLevel} gridLineStyle={gridLineStyle} />

      {/* Tracks or Drop Zone */}
      {tracks.length > 0 ? (
        <TimelineContent
          tracks={tracks}
          measureCount={measureCount}
          zoomLevel={zoomLevel}
          currentTime={currentTime}
          isPlaying={isPlaying}
          bpm={bpm}
          gridLineStyle={gridLineStyle}
          onTrackPositionChange={onTrackPositionChange}
        />
      ) : (
        <EmptyTimelineDropZone />
      )}
    </Box>
  );
});

interface TimelineRulerProps {
  measureCount: number;
  zoomLevel: number;
  gridLineStyle: {
    borderRight: string;
  };
}

function TimelineRuler({ measureCount, zoomLevel, gridLineStyle }: TimelineRulerProps) {
  return (
    <Box sx={{ 
      display: 'flex',
      position: 'sticky',
      top: 0,
      bgcolor: '#000',
      zIndex: 2,
      height: GRID_CONSTANTS.headerHeight,
      boxSizing: 'border-box',
      transform: `scaleX(${zoomLevel})`,
      willChange: "transform",
      imageRendering: "crisp-edges",
      transformOrigin: "top left",
    }}>
      <Box sx={{ 
        display: 'flex',
        position: 'relative',
        flex: 1,
        borderBottom: gridLineStyle.borderRight
      }}>
        {/* Vertical grid lines */}
        {Array.from({ length: measureCount + 1 }).map((_, i) => (
          <Box
            key={`grid-${i}`}
            sx={{
              position: 'absolute',
              left: `${(i * GRID_CONSTANTS.measureWidth)}px`,
              top: 0,
              bottom: 0,
              width: 2,
              height: '1',
              bgcolor: GRID_CONSTANTS.borderColor,
              zIndex: 10
            }}
          />
        ))}

        {/* Measure numbers */}
        {Array.from({ length: measureCount }).map((_, i) => (
          <Box 
            key={`number-${i}`}
            sx={{ 
              width: GRID_CONSTANTS.measureWidth,
              height: GRID_CONSTANTS.headerHeight,
              display: 'flex',
              alignItems: 'center',
              color: '#666',
              flexShrink: 0,
              position: 'relative',
              zIndex: 2,
              '& > span': {
                position: 'absolute',
                left: 20
              }
            }}
          >
            <span>{i + 1}</span>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

interface TimelineContentProps extends TimelineRulerProps {
  tracks: TrackState[];
  currentTime: number;
  isPlaying: boolean;
  bpm: number;
  onTrackPositionChange: (trackId: string, newPosition: Position, isDragEnd: boolean) => void;
}

function TimelineContent({
  tracks,
  measureCount,
  zoomLevel,
  currentTime,
  isPlaying,
  bpm,
  gridLineStyle,
  onTrackPositionChange
}: TimelineContentProps) {
  return (
    <Box sx={{ 
      minHeight: '100%',
      position: 'relative',
      transform: `scaleX(${zoomLevel})`,
      willChange: "transform",
      imageRendering: "crisp-edges",
      transformOrigin: "top left",
    }}>
      <GridOverlay measureCount={measureCount} />
      <PlaybackCursor currentTime={currentTime} />

      {tracks.map((track, index) => (
        <Track 
          key={track.id}
          id={track.id}
          index={index}
          type={track.type}
          audioFile={track.audioFile}
          isPlaying={isPlaying}
          currentTime={currentTime}
          gridLineStyle={gridLineStyle}
          measureCount={GRID_CONSTANTS.measureCount}
          position={track.position}
          onPositionChange={(newPosition, isDragEnd) => 
            onTrackPositionChange(track.id, newPosition, isDragEnd)}
          bpm={bpm}
          duration={track.duration}
          _calculatedWidth={track._calculatedWidth}
        />
      ))}
    </Box>
  );
}

function GridOverlay({ measureCount }: { measureCount: number }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 1000
      }}
    >
      {/* Major grid lines (measures) */}
      {Array.from({ length: measureCount + 1 }).map((_, i) => (
        <Box
          key={`major-${i}`}
          sx={{
            position: 'absolute',
            left: `${i * GRID_CONSTANTS.measureWidth}px`,
            top: 0,
            bottom: 0,
            width: '1px',
            bgcolor: GRID_CONSTANTS.borderColor,
            opacity: 1,
            zIndex: 1000
          }}
        />
      ))}

      {/* Minor grid lines (beats) */}
      {Array.from({ length: measureCount * GRID_CONSTANTS.gridSubdivisions }).map((_, i) => {
        if (i % GRID_CONSTANTS.gridSubdivisions !== 0) {
          return (
            <Box
              key={`minor-${i}`}
              sx={{
                position: 'absolute',
                left: `${i * (GRID_CONSTANTS.measureWidth / GRID_CONSTANTS.gridSubdivisions)}px`,
                top: 0,
                bottom: 0,
                width: '1px',
                bgcolor: GRID_CONSTANTS.borderColor,
                opacity: 0.3,
                zIndex: 1000
              }}
            />
          );
        }
        return null;
      })}
    </Box>
  );
}

function EmptyTimelineDropZone() {
  return (
    <Box sx={{ 
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      color: '#666',
      height: '100%',
      border: '2px dashed #333',
      m: 2,
      borderRadius: 2
    }}>
      <Box sx={{ fontSize: 24, mb: 1 }}>♫</Box>
      <Box>Drop a loop or an audio/MIDI/Video file</Box>
    </Box>
  );
} 