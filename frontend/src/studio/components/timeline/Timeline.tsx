import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import { Box, useTheme } from '@mui/material';
import { GRID_CONSTANTS, calculatePositionTime } from '../../constants/gridConstants';
import Track from '../track/Track';
import PlaybackCursor, { PlaybackCursorRef } from './PlaybackCursor';
import { TrackState, Position } from '../../../types/track';

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

// Define imperative handle interface
export interface TimelineRef {
  playbackCursor: {
    play: () => void;
    pause: () => void;
    stop: () => void;
    seek: (time: number) => void;
  };
  // Include the HTMLDivElement methods we need
  addEventListener: HTMLDivElement['addEventListener'];
  removeEventListener: HTMLDivElement['removeEventListener'];
  // Include properties we need for scroll handling
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

export const Timeline = forwardRef<TimelineRef, TimelineProps>(({
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
  const theme = useTheme();
  // Calculate the total width needed for the entire timeline
  const totalTimelineWidth = measureCount * GRID_CONSTANTS.measureWidth;
  
  // Refs for the cursor and container
  const cursorRef = useRef<PlaybackCursorRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use theme color for border if gridLineStyle is default
  const defaultGridLineStyle = {
    borderRight: `${GRID_CONSTANTS.borderWidth} solid ${theme.palette.divider}`
  };
  const currentGridLineStyle = gridLineStyle.borderRight === `${GRID_CONSTANTS.borderWidth} solid ${GRID_CONSTANTS.borderColor}`
    ? defaultGridLineStyle
    : gridLineStyle;
  
  // Expose imperative methods to parent component
  useImperativeHandle(ref, () => {
    const divElement = containerRef.current;
    if (!divElement) return {} as TimelineRef;
    
    return {
      // Explicitly forward the HTMLDivElement methods and properties we need
      addEventListener: divElement.addEventListener.bind(divElement),
      removeEventListener: divElement.removeEventListener.bind(divElement),
      get scrollLeft() { return divElement.scrollLeft; },
      get scrollWidth() { return divElement.scrollWidth; },
      get clientWidth() { return divElement.clientWidth; },
      
      // Add our custom playbackCursor methods
      playbackCursor: {
        play: () => cursorRef.current?.play(),
        pause: () => cursorRef.current?.pause(),
        stop: () => cursorRef.current?.stop(),
        seek: (time: number) => cursorRef.current?.seek(time)
      }
    };
  });
  
  return (
    <Box 
      ref={containerRef}
      className="timeline-container"
      sx={{ 
        flex: 1, 
        position: 'relative', 
        overflow: 'auto',
        willChange: 'transform',
        bgcolor: 'background.default',
        '& > *': {
          backfaceVisibility: 'hidden',
          perspective: 1000,
        }
      }}
    >
      {/* Playback Cursor with ref for imperative control */}
      <PlaybackCursor 
        ref={cursorRef}
        currentTime={currentTime} 
        isPlaying={isPlaying} 
        bpm={bpm} 
        timeSignature={timeSignature} 
      />

      {/* Time Markers */}
      <TimelineRuler 
        measureCount={measureCount} 
        zoomLevel={zoomLevel} 
        gridLineStyle={currentGridLineStyle}
        bpm={bpm}
        timeSignature={timeSignature}
        onTimeChange={onTimeChange}
        totalWidth={totalTimelineWidth}
      />

      {/* Tracks or Drop Zone */}
      {tracks.length > -1 ? (
        <TimelineContent
          tracks={tracks}
          measureCount={measureCount}
          zoomLevel={zoomLevel}
          currentTime={currentTime}
          isPlaying={isPlaying}
          bpm={bpm}
          timeSignature={timeSignature}
          gridLineStyle={currentGridLineStyle}
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
  const theme = useTheme();
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
        bgcolor: 'background.paper',
        zIndex: 2,
        height: GRID_CONSTANTS.headerHeight,
        boxSizing: 'border-box',
        willChange: "transform",
        imageRendering: "crisp-edges",
        transformOrigin: "top left",
        borderBottom: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.shadows[2],
        '& > div > div > div': {
          '&:first-of-type': {
            top: '8px',
            fontSize: '14px'
          }
        }
      }}
      style={{
        width: totalWidth ? `${totalWidth}px` : '100%',
      }}
    >
      <Box 
        sx={{ 
          display: 'flex',
          position: 'relative',
          width: '100%',
          cursor: 'pointer',
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
              top: '8px',
              left: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: 'text.secondary',
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
                  borderLeft: `1px solid ${beatIndex === 0 ? theme.palette.text.secondary : theme.palette.divider}`,
                  '&:first-of-type': {
                    borderLeft: `1px solid ${theme.palette.text.secondary}`,
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
                  color: 'text.disabled',
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
                    const subBeatColor = theme.palette.divider;
                    
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
            bgcolor: theme.palette.text.secondary,
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
  const theme = useTheme();
  
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
        willChange: "transform",
        imageRendering: "crisp-edges",
        transformOrigin: "top left",
        cursor: 'pointer',
      }}
      style={{
        width: totalWidth ? `${totalWidth}px` : '100%',
      }}
      onClick={handleTimelineClick}
    >
      <GridOverlay 
        measureCount={measureCount} 
        timeSignature={timeSignature} 
        measureColor={theme.palette.text.secondary}
        beatColor={theme.palette.divider}
        subdivisionColor={theme.palette.divider}
      />

      {tracks.map((track, index) => (
        <Track 
          key={track.id}
          id={track.id}
          name={track.name}
          index={index}
          type={track.type}
          audioFile={track.audioFile}
          isPlaying={isPlaying}
          currentTime={currentTime}
          gridLineStyle={gridLineStyle}
          measureCount={GRID_CONSTANTS.measureCount}
          position={track.position}
          onPositionChange={(newPosition, isDragEnd) => {
            console.log(`Timeline passing position change: trackId=${track.id}, isDragEnd=${isDragEnd}`, newPosition);
            if (onTrackPositionChange) {
              onTrackPositionChange(track.id, newPosition, isDragEnd);
            }
          }}
          bpm={bpm}
          duration={track.duration}
          _calculatedWidth={track._calculatedWidth}
          timeSignature={timeSignature}
        />
      ))}
    </Box>
  );
}

interface GridOverlayProps {
  measureCount: number;
  timeSignature?: [number, number];
  measureColor?: string;
  beatColor?: string;
  subdivisionColor?: string;
}

function GridOverlay({
  measureCount, 
  timeSignature = [4, 4], 
  measureColor = 'rgba(85, 85, 85, 0.9)',
  beatColor = 'rgba(51, 51, 51, 0.7)',
  subdivisionColor = 'rgba(34, 34, 34, 0.3)'
}: GridOverlayProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const beatsPerMeasure = timeSignature[0];
  const beatWidth = GRID_CONSTANTS.measureWidth / beatsPerMeasure;
  
  // Draw grid lines on canvas
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    // Set canvas size to match container
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === container) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
          drawGrid();
        }
      }
    });
    
    resizeObserver.observe(container);
    
    // Initial sizing
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    // Draw grid function
    function drawGrid() {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Enable high-DPI rendering for crisp lines
      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      ctx.scale(dpr, dpr);
      
      // Clear canvas
      ctx.clearRect(0, 0, container.clientWidth, container.clientHeight);
      
      const denominator = timeSignature[1];
      
      // Use passed theme colors or defaults
      const MEASURE_COLOR = measureColor;
      const BEAT_COLOR = beatColor;
      const SUBDIVISION_COLOR = subdivisionColor;
      
      // Ensure pixel-perfect rendering
      const drawLine = (x: number, opacity: number, color?: string) => {
        // Align to nearest pixel for sharp lines
        const xPos = Math.round(x) + 0.5;
        ctx.beginPath();
        ctx.moveTo(xPos, 0);
        ctx.lineTo(xPos, container.clientHeight);
        ctx.strokeStyle = color || SUBDIVISION_COLOR;
        ctx.lineWidth = 1;
        ctx.stroke();
      };
      
      // Draw all subdivisions (with different opacities)
      // IMPORTANT: For time signatures, denominator tells us the type of note that gets one beat
      // 4 = quarter note gets one beat, 8 = eighth note gets one beat
      // This means we need to adjust how we interpret subdivisions based on the denominator
      console.log(`Drawing grid with time signature ${timeSignature[0]}/${timeSignature[1]}`);
      
      const subdivisionsPerBeat = timeSignature[1]; // Use the denominator directly
      const totalBeats = measureCount * beatsPerMeasure;
      const totalSubdivisions = totalBeats * subdivisionsPerBeat;
      
      // 1. First draw all regular subdivisions
      // Calculate the width of each subdivision
      const subdivisionWidth = beatWidth / subdivisionsPerBeat;
      
      // Debug output
      console.log('Grid subdivision calculation:', {
        measureWidth: GRID_CONSTANTS.measureWidth,
        beatsPerMeasure,
        beatWidth,
        denominator: timeSignature[1],
        subdivisionsPerBeat,
        subdivisionWidth,
        expectedSubdivisionsPerMeasure: beatsPerMeasure * subdivisionsPerBeat
      });

      // For each beat in our timeline
      for (let beatIndex = 0; beatIndex < totalBeats; beatIndex++) {
        const beatStartPosition = beatIndex * beatWidth;
        
        // For each subdivision within this beat (skip the beat itself at position 0)
        for (let subdivision = 1; subdivision < subdivisionsPerBeat; subdivision++) {
          // Calculate the exact position of this subdivision
          const position = beatStartPosition + (subdivision * subdivisionWidth);
          
          // Determine opacity based on subdivision importance
          let opacity = 0.15; // Default for minor subdivisions
          
          // Special-case important subdivisions for better visual hierarchy
          // Half-beat is most important (e.g., the "and" in "1 and 2 and")
          const isHalfBeat = subdivision === Math.floor(subdivisionsPerBeat / 2);
          
          // Quarter-beat is next most important (the "e" and "a" in "1 e + a")
          const isQuarterBeat = subdivision === Math.floor(subdivisionsPerBeat / 4) || 
                                subdivision === Math.floor(3 * subdivisionsPerBeat / 4);
                                
          // Apply opacity based on importance
          if (isHalfBeat) {
            opacity = 0.7; // Most visible - half-beat marks
          } else if (isQuarterBeat) {
            opacity = 0.5; // Medium visibility - quarter-beat marks
          } else {
            // Ensure all other subdivisions are at least somewhat visible
            opacity = 0.35; 
          }
          
          // Draw this subdivision line
          drawLine(position, opacity, opacity === 1 ? undefined : opacity.toString());
        }
      }
      
      // 2. Now draw beat lines on top
      for (let i = 0; i <= totalBeats; i++) {
        // Skip measure lines (we'll draw them last)
        if (i % beatsPerMeasure !== 0) {
          const x = i * beatWidth;
          drawLine(x, 1, BEAT_COLOR);
        }
      }
      
      // 3. Finally draw measure lines (most prominent)
      for (let i = 0; i <= measureCount; i++) {
        const x = i * GRID_CONSTANTS.measureWidth;
        drawLine(x, 1, MEASURE_COLOR);
      }
    }
    
    drawGrid();
    
    // Cleanup
    return () => {
      resizeObserver.disconnect();
    };
  }, [measureCount, beatsPerMeasure, beatWidth, timeSignature, measureColor, beatColor, subdivisionColor]);
  
  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: '100%', // Fill the full width of the parent container
        pointerEvents: 'none', // Important: this makes the grid not catch any mouse events
        zIndex: 1000
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />
    </Box>
  );
}

interface EmptyTimelineDropZoneProps {
  onTimeChange?: (newTime: number) => void;
  bpm?: number;
  timeSignature?: [number, number];
}

function EmptyTimelineDropZone({ onTimeChange = () => {}, bpm = 120, timeSignature = [4, 4] }: EmptyTimelineDropZoneProps) {
  const theme = useTheme();
  return (
    <Box sx={{ 
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      color: 'text.secondary',
      height: '100%',
      border: `2px dashed ${theme.palette.divider}`,
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