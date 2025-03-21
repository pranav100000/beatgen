import React, { forwardRef } from 'react';
import { Box } from '@mui/material';
import { GRID_CONSTANTS, calculatePositionTime } from '../../constants/gridConstants';
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
  onTimeChange?: (newTime: number) => void;
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
  onTimeChange = () => {},
  gridLineStyle = {
    borderRight: `${GRID_CONSTANTS.borderWidth} solid ${GRID_CONSTANTS.borderColor}`
  }
}, ref) => {
  // Calculate the total width needed for the entire timeline
  const totalTimelineWidth = measureCount * GRID_CONSTANTS.measureWidth;
  
  return (
    <Box 
      ref={ref}
      sx={{ 
        flex: 1, 
        position: 'relative', 
        overflow: 'auto',
      }}
    >
      {/* Time Markers */}
      <TimelineRuler 
        measureCount={measureCount} 
        zoomLevel={zoomLevel} 
        gridLineStyle={gridLineStyle} 
        bpm={bpm}
        onTimeChange={onTimeChange}
        totalWidth={totalTimelineWidth}
      />

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
          onTimeChange={onTimeChange}
          totalWidth={totalTimelineWidth}
        />
      ) : (
        <EmptyTimelineDropZone onTimeChange={onTimeChange} bpm={bpm} />
      )}
    </Box>
  );
});

interface TimelineRulerProps {
  measureCount: number;
  zoomLevel: number;
  bpm?: number;
  onTimeChange?: (newTime: number) => void;
  gridLineStyle: {
    borderRight: string;
  };
  totalWidth?: number;
}

function TimelineRuler({ measureCount, zoomLevel, bpm = 120, onTimeChange = () => {}, gridLineStyle, totalWidth }: TimelineRulerProps) {
  // Number of beats per measure (from grid constants)
  const beatsPerMeasure = GRID_CONSTANTS.beatsPerMeasure;
  // Width of a single beat in pixels
  const beatWidth = GRID_CONSTANTS.measureWidth / beatsPerMeasure;
  
  // Handler for ruler clicks to set playback position
  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Get click position relative to the ruler
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    
    // Adjust for zoom level
    const adjustedX = clickX / zoomLevel;
    
    // Convert pixel position to time in seconds using our utility function
    const newTime = calculatePositionTime(adjustedX, bpm);
    
    console.log('Timeline ruler clicked!', {
      clickX,
      adjustedX,
      newTime,
      zoomLevel,
      bpm
    });
    
    // Call the callback with the new time
    onTimeChange(newTime);
  };
  
  return (
    <Box 
      sx={{ 
        display: 'flex',
        position: 'sticky',
        top: 0,
        bgcolor: '#111', // Slightly darker for better contrast
        zIndex: 2,
        height: GRID_CONSTANTS.headerHeight,
        boxSizing: 'border-box',
        transform: `scaleX(${zoomLevel})`,
        willChange: "transform",
        imageRendering: "crisp-edges",
        transformOrigin: "top left",
        borderBottom: '1px solid #444', // More subtle border
      }}
      style={{
        width: totalWidth ? `${totalWidth}px` : '100%',
      }}
    >
      <Box 
        sx={{ 
          display: 'flex',
          position: 'relative',
          width: '100%', // Ensure it fills the full width
          cursor: 'pointer', // Show pointer cursor to indicate clickable
        }}
        onClick={handleRulerClick}
      >
        {/* Measure divisions */}
        {Array.from({ length: measureCount }).map((_, measureIndex) => (
          <Box 
            key={`measure-${measureIndex}`}
            sx={{ 
              position: 'relative',
              width: GRID_CONSTANTS.measureWidth,
              height: '100%',
              display: 'flex',
            }}
          >
            {/* Measure number */}
            <Box sx={{
              position: 'absolute',
              top: '6px',
              left: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#999',
              userSelect: 'none',
            }}>
              {measureIndex + 1}
            </Box>
            
            {/* Beat divisions */}
            {Array.from({ length: beatsPerMeasure }).map((_, beatIndex) => (
              <Box 
                key={`beat-${measureIndex}-${beatIndex}`}
                sx={{ 
                  position: 'relative',
                  width: beatWidth,
                  height: '100%',
                  borderLeft: beatIndex === 0 
                    ? '1px solid #555' // Stronger line for measure start
                    : '1px solid #333', // Lighter line for beats
                  '&:first-of-type': {
                    borderLeft: '1px solid #555', // Ensure first beat has stronger line
                  }
                }}
              >
                {/* Beat number under measure number */}
                {measureIndex === 0 && (
                  <Box sx={{
                    position: 'absolute',
                    bottom: '6px',
                    width: '100%',
                    textAlign: 'center',
                    fontSize: '10px',
                    color: '#777',
                    userSelect: 'none',
                  }}>
                    {beatIndex + 1}
                  </Box>
                )}

                {/* Sub-beat markings (16ths) */}
                {beatIndex !== beatsPerMeasure - 1 && Array.from({ length: 3 }).map((_, subBeatIndex) => (
                  <Box 
                    key={`sub-${measureIndex}-${beatIndex}-${subBeatIndex}`}
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: `${((subBeatIndex + 1) * (beatWidth / 4))}px`,
                      height: '4px',
                      width: '1px',
                      bgcolor: subBeatIndex === 1 ? '#444' : '#333', // Middle 8th note slightly more visible
                      transform: 'translateY(-2px)',
                    }}
                  />
                ))}
              </Box>
            ))}
          </Box>
        ))}

        {/* Final measure line */}
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '1px',
            bgcolor: '#555',
          }}
        />
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
  onTimeChange: (newTime: number) => void;
  totalWidth?: number;
}

function TimelineContent({
  tracks,
  measureCount,
  zoomLevel,
  currentTime,
  isPlaying,
  bpm,
  gridLineStyle,
  onTrackPositionChange,
  onTimeChange,
  totalWidth
}: TimelineContentProps) {
  
  // Handler for timeline content clicks to set playback position
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle direct clicks on the background, not on tracks
    if ((e.target as HTMLElement).closest('.track')) {
      console.log('Click on track - ignoring for timeline click');
      return;
    }
    
    // Get click position relative to the content area
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    
    // Adjust for zoom level
    const adjustedX = clickX / zoomLevel;
    
    // Convert pixel position to time in seconds
    const newTime = calculatePositionTime(adjustedX, bpm);
    
    console.log('Timeline content clicked!', {
      clickX,
      adjustedX,
      newTime,
      zoomLevel,
      bpm,
      target: e.target,
      currentTarget: e.currentTarget
    });
    
    // Call the callback with the new time
    onTimeChange(newTime);
  };
  
  return (
    <Box 
      sx={{ 
        minHeight: '100%',
        position: 'relative',
        transform: `scaleX(${zoomLevel})`,
        willChange: "transform",
        imageRendering: "crisp-edges",
        transformOrigin: "top left",
        cursor: 'pointer', // Show pointer cursor to indicate clickable
      }}
      style={{
        width: totalWidth ? `${totalWidth}px` : '100%',
      }}
      onClick={handleTimelineClick}
    >
      <GridOverlay measureCount={measureCount} />
      <PlaybackCursor currentTime={currentTime} isPlaying={isPlaying} bpm={bpm} />

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
  const beatsPerMeasure = GRID_CONSTANTS.beatsPerMeasure;
  const beatWidth = GRID_CONSTANTS.measureWidth / beatsPerMeasure;
  
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: '100%', // Fill the full width of the parent container
        pointerEvents: 'none', // Important: this makes the grid not catch any mouse events
        zIndex: 1000
      }}
      onClick={(e) => {
        console.log('Grid overlay clicked - this should not happen with pointerEvents: none');
        e.stopPropagation();
      }}
    >
      {/* Measure grid lines */}
      {Array.from({ length: measureCount + 1 }).map((_, i) => (
        <Box
          key={`measure-${i}`}
          sx={{
            position: 'absolute',
            left: `${i * GRID_CONSTANTS.measureWidth}px`,
            top: 0,
            bottom: 0,
            width: '1px',
            bgcolor: '#555', // Stronger color for measure lines
            opacity: 0.9,
            zIndex: 1000
          }}
        />
      ))}

      {/* Beat grid lines */}
      {Array.from({ length: measureCount * beatsPerMeasure }).map((_, i) => {
        // Skip measure lines (already drawn above)
        if (i % beatsPerMeasure !== 0) {
          return (
            <Box
              key={`beat-${i}`}
              sx={{
                position: 'absolute',
                left: `${i * beatWidth}px`,
                top: 0,
                bottom: 0,
                width: '1px',
                bgcolor: '#333', // Medium color for beat lines
                opacity: 0.7,
                zIndex: 999
              }}
            />
          );
        }
        return null;
      })}

      {/* Sixteenth note grid lines (for more detailed grid) */}
      {Array.from({ length: measureCount * beatsPerMeasure * 4 }).map((_, i) => {
        // Skip beat lines and measure lines (already drawn above)
        if (i % 4 !== 0) {
          return (
            <Box
              key={`sixteenth-${i}`}
              sx={{
                position: 'absolute',
                left: `${i * (beatWidth / 4)}px`,
                top: 0,
                bottom: 0,
                width: '1px',
                bgcolor: '#222', // Subtle color for 16th note lines
                opacity: i % 2 === 0 ? 0.5 : 0.3, // 8th notes slightly more visible
                zIndex: 998
              }}
            />
          );
        }
        return null;
      })}
    </Box>
  );
}

interface EmptyTimelineDropZoneProps {
  onTimeChange?: (newTime: number) => void;
  bpm?: number;
}

function EmptyTimelineDropZone({ onTimeChange = () => {}, bpm = 120 }: EmptyTimelineDropZoneProps) {
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
      borderRadius: 2,
      position: 'relative', // For positioning the cursor inside
    }}>
      <Box sx={{ fontSize: 24, mb: 1 }}>♫</Box>
      <Box>Drop a loop or an audio/MIDI/Video file</Box>
      
      {/* We still include the cursor element even in empty state, just hidden until tracks exist */}
      <PlaybackCursor currentTime={0} isPlaying={false} bpm={bpm} />
    </Box>
  );
} 