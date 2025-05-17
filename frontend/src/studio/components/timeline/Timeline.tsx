import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import { Box, useTheme } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { GRID_CONSTANTS, calculatePositionTime } from '../../constants/gridConstants';
import Track from '../track/Track';
import PlaybackCursor, { PlaybackCursorRef } from './PlaybackCursor';
import { CombinedTrack } from 'src/platform/types/project';
import { Position } from '../track/types';
import { useAppTheme } from '../../../platform/theme/ThemeContext';
import { cn } from '@/lib/utils';

export interface TimelineProps {
  tracks: CombinedTrack[];
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
  sx?: SxProps<Theme>;
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
  },
  sx
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
        },
        ...sx
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
  totalWidth?: number;
}

// SIMPLIFIED TimelineRuler for testing
// function TimelineRuler({ totalWidth }: TimelineRulerProps) {
//   const theme = useTheme();
//   return (
//     <Box
//       sx={{
//         display: 'flex',
//         position: 'sticky', // Keep sticky for now
//         top: 0,
//         bgcolor: 'background.paper',
//         zIndex: 2,
//         height: GRID_CONSTANTS.headerHeight,
//         boxSizing: 'border-box',
//         transformOrigin: "top left",
//         borderBottom: `1px solid ${theme.palette.divider}`,
//         boxShadow: theme.shadows[2],
//         alignItems: 'center',
//         justifyContent: 'center',
//         fontSize: '14px',
//         color: 'text.secondary',
//       }}
//       style={{
//         width: totalWidth ? `${totalWidth}px` : '100%',
//       }}
//     >
//       Simplified Ruler - Test
//     </Box>
//   );
// }

// --- START NEW TimelineRuler IMPLEMENTATION ---
function TimelineRuler({
  measureCount,
  zoomLevel = 1, // Keep zoomLevel if it might affect rendering density later
  bpm = 120,
  timeSignature = [4, 4],
  onTimeChange = () => {},
  // gridLineStyle, // No longer needed for ruler internal lines
  totalWidth
}: TimelineRulerProps) {
  // const theme = useTheme(); // MUI theme, not directly needed for these specific changes
  const { studioMode } = useAppTheme(); // Get studioMode
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Define colors based on studioMode
  const isDark = studioMode === 'dark';

  // Adjusted light mode colors to be lighter shades of gray (via black with low alpha)
  const SUBDIVISION_LINE_COLOR = isDark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(0, 0, 0, 0.10)';
  const BEAT_LINE_COLOR = isDark ? 'rgba(255, 255, 255, 0.40)' : 'rgba(0, 0, 0, 0.20)';
  const MEASURE_LINE_COLOR = isDark ? 'rgba(255, 255, 255, 0.70)' : 'rgba(0, 0, 0, 0.40)';

  const beatsPerMeasure = timeSignature[0];
  const measureWidthPixels = GRID_CONSTANTS.measureWidth;
  const beatWidthPixels = measureWidthPixels / beatsPerMeasure;

  // Handler for ruler clicks to set playback position
  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const adjustedX = clickX / zoomLevel; // Assuming zoom affects ruler scale
    const newTime = calculatePositionTime(adjustedX, bpm, timeSignature);
    onTimeChange(newTime);
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = totalWidth || canvas.parentElement?.clientWidth || 0;
    const canvasHeight = GRID_CONSTANTS.headerHeight;

    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Drawing logic
    const subdivisionsPerBeat = timeSignature[1];
    const subdivisionWidthPixels = beatWidthPixels / subdivisionsPerBeat;

    // 1. Draw subdivision lines (dimmest, shortest from bottom)
    ctx.strokeStyle = SUBDIVISION_LINE_COLOR;
    ctx.lineWidth = 1;
    for (let m = 0; m < measureCount; m++) {
      for (let b = 0; b < beatsPerMeasure; b++) {
        for (let s = 1; s < subdivisionsPerBeat; s++) {
          const x = m * measureWidthPixels + b * beatWidthPixels + s * subdivisionWidthPixels;
          ctx.beginPath();
          ctx.moveTo(x + 0.5, canvasHeight * 0.85); // Start at 85% from top (bottom 15%)
          ctx.lineTo(x + 0.5, canvasHeight);
          ctx.stroke();
        }
      }
    }

    // 2. Draw beat lines (medium prominence, medium height from bottom)
    ctx.strokeStyle = BEAT_LINE_COLOR;
    ctx.lineWidth = 0.5; // Make beat lines thinner
    for (let m = 0; m < measureCount; m++) {
      for (let b = 1; b < beatsPerMeasure; b++) { // Start from beat 1
        const x = m * measureWidthPixels + b * beatWidthPixels;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, canvasHeight * 0); // Start at 70% from top (bottom 30%)
        ctx.lineTo(x + 0.5, canvasHeight);
        ctx.stroke();
      }
    }

    // 3. Draw measure lines (most prominent, full height)
    ctx.strokeStyle = MEASURE_LINE_COLOR;
    ctx.lineWidth = 1; // Target image lines look sharp, not overly thick
    for (let i = 0; i <= measureCount; i++) {
      const x = i * measureWidthPixels;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0); // Full height
      ctx.lineTo(x + 0.5, canvasHeight);
      ctx.stroke();
    }

  }, [
    totalWidth,
    measureCount,
    beatsPerMeasure,
    timeSignature,
    zoomLevel, 
    SUBDIVISION_LINE_COLOR, BEAT_LINE_COLOR, MEASURE_LINE_COLOR // Redraw if colors change
  ]);

  return (
    // Main sticky container - Apply Tailwind classes
    <div
      className={cn(
        "sticky top-0 z-[2] box-border overflow-hidden shadow-sm border-b",
        isDark ? "bg-neutral-900 border-b-neutral-700" // Darker neutral gray for dark mode
               : "bg-neutral-100 border-b-neutral-300" // Neutral light gray for light mode
        )}
      style={{ // Height and dynamic width still via style prop
        height: `${GRID_CONSTANTS.headerHeight}px`,
        width: totalWidth ? `${totalWidth}px` : '100%',
      }}
      onClick={handleRulerClick}
    >
      {/* Canvas for drawing lines */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />
      {/* Measure Numbers */}
      {Array.from({ length: measureCount }).map((_, measureIndex) => (
        <div
          key={`measure-num-${measureIndex}`}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 text-sm select-none z-[1]",
            isDark ? "text-neutral-200" : "text-neutral-700" // Text colors adjusted for contrast
            )}
          style={{ // Dynamic left positioning
            left: `${measureIndex * measureWidthPixels + 5}px`,
          }}
        >
          {measureIndex + 1}
        </div>
      ))}
      {/* Beat Numbers */}
      {Array.from({ length: measureCount }).map((_, measureIndex) => (
        Array.from({ length: beatsPerMeasure -1 }).map((_, beatIndexInMeasure) => {
          const actualBeatNumber = beatIndexInMeasure + 2;
          const beatXPosition = measureIndex * measureWidthPixels + (actualBeatNumber -1) * beatWidthPixels;
          return (
            <div
              key={`beat-num-${measureIndex}-${actualBeatNumber}`}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 text-[8px] select-none z-[1]",
                isDark ? "text-neutral-400" : "text-neutral-500" // Muted text colors adjusted for contrast
                )}
              style={{ // Dynamic left positioning, similar to measure numbers but offset from beat line
                left: `${beatXPosition + 4}px`, 
              }}
            >
              {actualBeatNumber}
            </div>
          );
        })
      ))}
    </div>
  );
}
// --- END NEW TimelineRuler IMPLEMENTATION ---

interface TimelineContentProps extends TimelineRulerProps {
  tracks: CombinedTrack[];
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
  onTrackPositionChange,
  onTimeChange,
  totalWidth
}: TimelineContentProps) {
  // const theme = useTheme(); // No longer need theme for grid colors
  
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
  
  // Define fixed gray colors for grid lines
  const fixedMeasureColor = 'rgba(128, 128, 128, 0.8)'; // Medium Gray, strong alpha
  const fixedBeatColor = 'rgba(128, 128, 128, 0.5)';    // Medium Gray, medium alpha
  const fixedSubdivisionColor = 'rgba(128, 128, 128, 0.25)'; // Medium Gray, low alpha

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
      {/* Pass fixed gray colors to GridOverlay */}
      <GridOverlay 
        measureCount={measureCount} 
        timeSignature={timeSignature} 
        measureColor={fixedMeasureColor} 
        beatColor={fixedBeatColor}         
        subdivisionColor={fixedSubdivisionColor}
      />

      {tracks.map((track, index) => (
        <Track 
          key={track.id}
          id={track.id}
          index={index}
          // gridLineStyle={gridLineStyle} // Removed, GridOverlay handles this
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
  // Update defaults to match the fixed grays
  measureColor = 'rgba(128, 128, 128, 0.8)', 
  beatColor = 'rgba(128, 128, 128, 0.5)',
  subdivisionColor = 'rgba(128, 128, 128, 0.25)'
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
      
      // Colors are now passed directly or use the updated defaults
      const MEASURE_COLOR = measureColor;
      const BEAT_COLOR = beatColor;
      const SUBDIVISION_COLOR = subdivisionColor;
      
      // Ensure pixel-perfect rendering
      const drawLine = (x: number, _opacity: number, color?: string) => { // Opacity parameter ignored now
        const xPos = Math.round(x) + 0.5;
        ctx.beginPath();
        ctx.moveTo(xPos, 0);
        ctx.lineTo(xPos, container.clientHeight);
        // Use the provided color string directly (which includes alpha)
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
          
          // Simplified: Draw all subdivisions with the base SUBDIVISION_COLOR
          // Hierarchy is now mainly handled by the color alpha values passed in.
          // We could still vary color based on isHalfBeat/isQuarterBeat if needed,
          // but let's start simple.
          drawLine(position, 1, SUBDIVISION_COLOR); // Pass opacity 1, color has alpha
        }
      }
      
      // 2. Now draw beat lines on top
      for (let i = 0; i <= totalBeats; i++) {
        // Skip measure lines (we'll draw them last)
        if (i % beatsPerMeasure !== 0) {
          const x = i * beatWidth;
          drawLine(x, 1, BEAT_COLOR); // Pass opacity 1, color has alpha
        }
      }
      
      // 3. Finally draw measure lines (most prominent)
      for (let i = 0; i <= measureCount; i++) {
        const x = i * GRID_CONSTANTS.measureWidth;
        drawLine(x, 1, MEASURE_COLOR); // Pass opacity 1, color has alpha
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