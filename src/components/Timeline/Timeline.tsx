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
  timeSignature?: [number, number];
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
  timeSignature = [4, 4],
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
        timeSignature={timeSignature}
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
          timeSignature={timeSignature}
          gridLineStyle={gridLineStyle}
          onTrackPositionChange={onTrackPositionChange}
          onTimeChange={onTimeChange}
          totalWidth={totalTimelineWidth}
        />
      ) : (
        <EmptyTimelineDropZone onTimeChange={onTimeChange} bpm={bpm} timeSignature={timeSignature} />
      )}
    </Box>
  );
});

interface TimelineRulerProps {
  measureCount: number;
  zoomLevel: number;
  bpm?: number;
  timeSignature?: [number, number];
  onTimeChange?: (newTime: number) => void;
  gridLineStyle: {
    borderRight: string;
  };
  totalWidth?: number;
}

function TimelineRuler({ measureCount, zoomLevel, bpm = 120, timeSignature = [4, 4], onTimeChange = () => {}, gridLineStyle, totalWidth }: TimelineRulerProps) {
  // Get beats per measure from time signature
  const beatsPerMeasure = timeSignature[0];
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
    const newTime = calculatePositionTime(adjustedX, bpm, timeSignature);
    
    console.log('Timeline ruler clicked!', {
      clickX,
      adjustedX,
      newTime,
      zoomLevel,
      bpm,
      timeSignature
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
              top: '4px',
              left: '6px',
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
                {beatIndex !== 0 && (
                  <Box sx={{
                    position: 'absolute',
                    bottom: '6px',
                    left: '4px',
                    width: '100%',
                    textAlign: 'left',
                  fontSize: '8px',
                  color: '#777',
                  userSelect: 'none',
                }}>
                    {beatIndex + 1}
                  </Box>
                )}

                {/* Sub-beat markings based on time signature */}
                {beatIndex !== beatsPerMeasure && (() => {
                  const denominator = timeSignature[1];
                  const numSubdivisions = denominator - 1;
                  
                  // Return early if no subdivisions are needed
                  if (numSubdivisions <= 0) return null;
                  
                  // Create an array of subdivisions
                  return Array.from({ length: numSubdivisions }).map((_, subBeatIndex) => {
                    // Calculate the position of each subdivision
                    const subBeatPosition = (subBeatIndex + 1) * (beatWidth / denominator);
                    
                    // Determine visibility - highlight middle subdivisions for better readability
                    const isMiddle = subBeatIndex === Math.floor(numSubdivisions / 2) - 1;
                    const subBeatColor = isMiddle ? '#444' : '#333';
                    
                    return (
                      <Box 
                        key={`sub-${measureIndex}-${beatIndex}-${subBeatIndex}`}
                        sx={{
                          position: 'absolute',
                          top: '95%',
                          left: `${subBeatPosition}px`,
                          height: '4px',
                          width: '1px',
                          bgcolor: subBeatColor,
                          transform: 'translateY(-2px)',
                        }}
                      />
                    );
                  });
                })()}
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
  timeSignature: [number, number];
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
  timeSignature,
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
    const newTime = calculatePositionTime(adjustedX, bpm, timeSignature);
    
    console.log('Timeline content clicked!', {
      clickX,
      adjustedX,
      newTime,
      zoomLevel,
      bpm,
      timeSignature,
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
      <GridOverlay measureCount={measureCount} timeSignature={timeSignature} />
      <PlaybackCursor currentTime={currentTime} isPlaying={isPlaying} bpm={bpm} timeSignature={timeSignature} />

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

function GridOverlay({ measureCount, timeSignature = [4, 4] }: { measureCount: number, timeSignature?: [number, number] }) {
  const beatsPerMeasure = timeSignature[0];
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

      {/* Subdivision grid lines based on time signature */}
      {(() => {
        const denominator = timeSignature[1];
        // Determine how many subdivisions we need per beat
        const subdivisionsPerBeat = denominator;
        // Total number of subdivisions for the entire timeline
        const totalSubdivisions = measureCount * beatsPerMeasure * subdivisionsPerBeat;
        
        return Array.from({ length: totalSubdivisions }).map((_, i) => {
          // Skip main beat lines (already drawn above)
          if (i % subdivisionsPerBeat === 0) return null;
          
          // Calculate position
          const position = i * (beatWidth / subdivisionsPerBeat);
          
          // Determine opacity based on position in the beat
          let opacity = 0;
          
          // For eighth notes (denominator=8), show all subdivisions
          // For quarter notes (denominator=4), show half and quarter subdivisions
          // For half notes (denominator=2), just show the middle subdivision
          
          // Is this a half-beat subdivision?
          const isHalfBeat = i % (subdivisionsPerBeat / 2) === 0;
          // Is this a quarter-beat subdivision?
          const isQuarterBeat = i % (subdivisionsPerBeat / 4) === 0;
          
          if (isHalfBeat) {
            opacity = 0.6; // Highest visibility for half-beat marks
          } else if (isQuarterBeat && denominator >= 4) {
            opacity = 0.4; // Medium visibility for quarter-beat marks
          } else if (denominator >= 8) {
            opacity = 0.2; // Lowest visibility for other subdivisions
          }
          
          // Only render if visible
          if (opacity > 0) {
            return (
              <Box
                key={`subdivision-${i}`}
                sx={{
                  position: 'absolute',
                  left: `${position}px`,
                  top: 0,
                  bottom: 0,
                  width: '1px',
                  bgcolor: '#222', // Subtle color for subdivision lines
                  opacity,
                  zIndex: 998
                }}
              />
            );
          }
          return null;
        });
      })()}
    </Box>
  );
}

interface EmptyTimelineDropZoneProps {
  onTimeChange?: (newTime: number) => void;
  bpm?: number;
  timeSignature?: [number, number];
}

function EmptyTimelineDropZone({ onTimeChange = () => {}, bpm = 120, timeSignature = [4, 4] }: EmptyTimelineDropZoneProps) {
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
      <PlaybackCursor currentTime={0} isPlaying={false} bpm={bpm} timeSignature={timeSignature} />
    </Box>
  );
} 