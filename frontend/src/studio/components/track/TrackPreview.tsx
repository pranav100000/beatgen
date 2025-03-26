import React from 'react';
import Box from '@mui/material/Box';
import { GRID_CONSTANTS, getTrackColor } from '../../constants/gridConstants';
import { TrackState, Position } from '../../core/types/track';
import WaveformDisplay from './WaveformDisplay';
import { MidiNotesPreview } from '../piano-roll';

// Simplified TrackPreview component without complex handlers

interface TrackPreviewProps {
  track: TrackState;
  isPlaying: boolean;
  currentTime: number;
  measureCount: number;
  gridLineStyle: { borderRight: string };
  onPositionChange: (trackId: string, newPosition: Position, isDragEnd: boolean) => void;
  bpm: number;
  timeSignature?: [number, number];
  trackIndex?: number;
}

const TrackPreview: React.FC<TrackPreviewProps> = ({
  track,
  isPlaying,
  currentTime,
  measureCount,
  gridLineStyle,
  onPositionChange,
  bpm,
  timeSignature = [4, 4],
  trackIndex = 0
}) => {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [startDragMousePosition, setStartDragMousePosition] = React.useState({ x: 0, y: 0 });
  const [startDragTrackPosition, setStartDragTrackPosition] = React.useState({ x: 0, y: 0 });
  const lastMovedPositionRef = React.useRef<Position>(track.position);

  // Calculate track width based on duration and BPM
  const trackWidth = React.useMemo(() => {
    return track._calculatedWidth || 500;
  }, [track._calculatedWidth]);

  // Get track color based on track index
  const trackColor = getTrackColor(trackIndex);

  // Create style object for track width
  const trackStyle = {
    display: 'flex',
    height: GRID_CONSTANTS.trackHeight,
    position: 'absolute',
    boxSizing: 'border-box',
    borderBottom: `1px solid ${GRID_CONSTANTS.borderColor}`,
    borderRadius: '6px',
    left: `${track.position.x}px`,
    top: `${track.position.y}px`,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: isDragging ? 1001 : 1000,
    transition: isDragging ? 'none' : 'width 0.2s ease',
    '&:hover': {
      boxShadow: `0 0 12px ${trackColor}`,
      zIndex: 9999
    },
    bgcolor: 'rgba(26, 26, 26, 0.8)',
    margin: 0,
    padding: 0,
    width: typeof trackWidth === 'number' ? `${trackWidth}px` : '100%',
    overflow: 'hidden'
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!trackRef.current) {
      console.error("TrackPreview: trackRef is null in mouseDown");
      return;
    }
    
    // Prevent dragging when clicking on controls
    if ((e.target as HTMLElement).closest('.track-control')) {
      console.log("TrackPreview: Clicked on control - not dragging");
      return;
    }

    // Get the container element - try multiple possible container classes
    const container = 
      trackRef.current.closest('.timeline-container') || 
      trackRef.current.closest('.MuiBox-root') ||
      trackRef.current.parentElement?.parentElement;
      
    if (!container) {
      console.error("TrackPreview: Could not find container element for drag");
      return;
    }
    
    console.log("TrackPreview: Starting drag", {
      trackId: track.id,
      initialPosition: track.position,
      containerFound: !!container,
      containerElement: container,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop
    });
    
    // Store the initial mouse position including scroll offsets
    setStartDragMousePosition({
      x: e.clientX + (container.scrollLeft || 0),
      y: e.clientY + (container.scrollTop || 0)
    });

    // Store the initial track position
    setStartDragTrackPosition({
      x: track.position.x,
      y: track.position.y
    });

    // Initialize last moved position
    lastMovedPositionRef.current = track.position;

    // Also set initial style position to match the current track position
    // This ensures dragging starts from the correct visual position
    if (trackRef.current) {
      trackRef.current.style.left = `${track.position.x}px`;
      trackRef.current.style.top = `${track.position.y}px`;
      trackRef.current.style.transition = 'none'; // Disable transitions during drag
    }
    
    setIsDragging(true);
    e.preventDefault(); // Prevent text selection while dragging
  };

  // // Grid indicator reference for showing snap points
  // const gridIndicatorRef = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isDragging) {
      return; // Not dragging, ignore
    }
    
    if (!trackRef.current) {
      console.error("TrackPreview: trackRef is null in mouseMove");
      return;
    }

    // Get the proper container element - try multiple selectors like in mouseDown
    const container = 
      trackRef.current.closest('.timeline-container') || 
      trackRef.current.closest('.MuiBox-root') ||
      trackRef.current.parentElement?.parentElement;
      
    if (!container) {
      console.error("TrackPreview: Could not find container element in mouseMove");
      return;
    }

    // Log key values for debugging
    console.log("TrackPreview: Mouse move", {
      isDragging,
      mousePosition: { x: e.clientX, y: e.clientY },
      scrollOffset: { left: container.scrollLeft, top: container.scrollTop },
      startDragMousePosition,
      startDragTrackPosition
    });

    // Calculate the current mouse position including scroll
    const currentMouseX = e.clientX + container.scrollLeft;
    const currentMouseY = e.clientY + container.scrollTop;

    // Calculate the delta from the start position
    const deltaX = currentMouseX - startDragMousePosition.x;
    const deltaY = currentMouseY - startDragMousePosition.y;

    // Calculate new position based on the original position plus the delta
    const newX = startDragTrackPosition.x + deltaX;
    const newY = startDragTrackPosition.y + deltaY;

    // Improved snap to grid with better musical timing
    const snapToGrid = (value: number, gridSize: number) => {
      return Math.round(value / gridSize) * gridSize;
    };

    // Calculate grid size based on time signature and BPM
    const beatsPerMeasure = timeSignature[0];
    const subdivisionsPerBeat = timeSignature[1]; // Use denominator from time signature
    
    // Calculate total subdivisions per measure (numerator * denominator)
    // This creates finer grid resolution for proper DAW-like snapping
    const subdivisionsPerMeasure = beatsPerMeasure * subdivisionsPerBeat;
    
    // Width of each subdivision in pixels
    const subdivisionWidth = GRID_CONSTANTS.measureWidth / subdivisionsPerMeasure;
    
    // Snap X to the nearest subdivision - this creates precise musical timing
    const snappedX = snapToGrid(newX, subdivisionWidth);
    
    // Snap Y to track height for proper lane alignment
    const snappedY = snapToGrid(newY, GRID_CONSTANTS.trackHeight);

    const newPosition = {
      x: Math.max(0, snappedX), // Prevent negative X
      y: Math.max(0, snappedY)  // Prevent negative Y
    };

    // Enhanced visual indicator for snap points
    // if (gridIndicatorRef.current) {
    //   // Update position for the snap grid indicator
    //   gridIndicatorRef.current.style.left = `${snappedX}px`;
      
    //   // Make it visible with a slight fade-in effect
    //   gridIndicatorRef.current.style.display = 'block';
    //   gridIndicatorRef.current.style.opacity = '1';
      
    //   // Apply a highlight color based on the track color for better visibility
    //   gridIndicatorRef.current.style.backgroundColor = `${trackColor}`;
      
    //   // Add a slight pulse animation to draw attention to the snap point
    //   const pulseAnimation = () => {
    //     if (gridIndicatorRef.current) {
    //       // Briefly increase the glow effect
    //       gridIndicatorRef.current.style.boxShadow = `0 0 8px ${trackColor}`;
          
    //       // Return to normal after a short delay
    //       setTimeout(() => {
    //         if (gridIndicatorRef.current) {
    //           gridIndicatorRef.current.style.boxShadow = '0 0 5px rgba(255, 255, 255, 0.5)';
    //         }
    //       }, 150);
    //     }
    //   };
      
    //   // Apply the pulse effect
    //   pulseAnimation();
    // }
    
    // During drag, we'll update the visual position directly without calling the store
    // This prevents unnecessary re-renders and state updates while dragging
    
    // Update the position visually
    if (trackRef.current) {
      trackRef.current.style.left = `${newPosition.x}px`;
      trackRef.current.style.top = `${newPosition.y}px`;
    }
    
    // Log position for debugging
    console.log("TrackPreview: Visual update during drag", {
      trackId: track.id, 
      visualPosition: newPosition,
      styleUpdated: !!trackRef.current
    });
    
    // Store the last position in the ref but don't call onPositionChange yet
    // We'll only call onPositionChange when the drag ends
    lastMovedPositionRef.current = newPosition;
  }, [isDragging, startDragMousePosition, startDragTrackPosition, track.id, timeSignature]);

  const handleMouseUp = React.useCallback(() => {
    console.log("TrackPreview: Mouse up", { 
      isDragging, 
      trackId: track.id,
      lastPosition: lastMovedPositionRef.current
    });
    
    if (isDragging && trackRef.current) {
      // Send final position with isDragEnd=true using the last moved position
      console.log("TrackPreview: Final position update", {
        trackId: track.id,
        finalPosition: lastMovedPositionRef.current,
        isDragEnd: true
      });
      
      onPositionChange(track.id, lastMovedPositionRef.current, true);
      
      // Hide the grid indicator with a fade-out effect
      // if (gridIndicatorRef.current) {
      //   // Fade out smoothly
      //   gridIndicatorRef.current.style.opacity = '0';
      //   gridIndicatorRef.current.style.transition = 'opacity 0.2s ease';
        
      //   // After fade completes, actually hide the element
      //   setTimeout(() => {
      //     if (gridIndicatorRef.current) {
      //       gridIndicatorRef.current.style.display = 'none';
      //     }
      //   }, 200);
      // }
    }
    
    // Restore transitions after dragging completes
    if (trackRef.current) {
      trackRef.current.style.transition = 'left 0.2s ease, top 0.2s ease';
    }
    
    setIsDragging(false);
  }, [isDragging, track.id, onPositionChange]);

  // Add/remove global mouse event listeners
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  // Synchronize position changes from props with the DOM
  // This ensures undo/redo operations update the visual position
  React.useEffect(() => {
    if (trackRef.current && !isDragging) {
      console.log('Track position sync effect:', { 
        trackId: track.id, 
        x: track.position.x, 
        y: track.position.y 
      });
      trackRef.current.style.left = `${track.position.x}px`;
      trackRef.current.style.top = `${track.position.y}px`;
    }
  }, [track.position.x, track.position.y, track.id, isDragging]);

  return (
    <Box
      ref={trackRef}
      onMouseDown={handleMouseDown}
      className="track"
      sx={trackStyle}
    >
      {/* Grid line indicator for snap feedback - only shown when dragging */}
      {/* {isDragging && (
        <Box
          ref={gridIndicatorRef}
          sx={{
            position: 'absolute',
            height: GRID_CONSTANTS.trackHeight * 10,
            width: '2px',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            top: -GRID_CONSTANTS.trackHeight * 4,
            pointerEvents: 'none',
            zIndex: 1000,
            display: 'none', // Hidden by default, shown in mouse move
            // Add a subtle glow effect for better visibility
            boxShadow: '0 0 5px rgba(255, 255, 255, 0.5)',
            transition: 'left 0.05s ease' // Smooth transition for better visual feedback
          }}
        />
      )} */}
      
      {/* Track Timeline */}
      <Box sx={{ 
        display: 'flex',
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        width: typeof trackWidth === 'number' ? `${trackWidth}px` : '100%',
        margin: 0,
        padding: 0,
        boxSizing: 'border-box',
        borderLeft: 'none',
        borderRight: 'none',
        background: `linear-gradient(180deg, ${trackColor}80 0%, ${trackColor} 100%)`,
        opacity: track.muted ? 0.4 : 0.85,
        '&:hover': {
          opacity: track.muted ? 0.5 : 1,
          boxShadow: 'inset 0 0 10px rgba(255,255,255,0.3)'
        },
        transition: 'opacity 0.2s ease'
      }}>
        {/* Track Type Badge */}
        <Box sx={{
          position: 'absolute',
          right: 10,
          top: 5,
          bgcolor: track.type === 'audio' ? '#4caf50' : 
                  track.type === 'midi' ? '#2196f3' : 
                  track.type === 'drum' ? '#ff9800' : '#9c27b0',
          color: 'white',
          fontSize: '10px',
          fontWeight: 'bold',
          padding: '2px 6px',
          borderRadius: '3px',
          textTransform: 'uppercase',
          opacity: 0.7
        }}>
          {track.type}
        </Box>
        
        {/* Track visualization based on type */}
        <Box sx={{
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          opacity: 0.8, // Full opacity for all track types
          pointerEvents: 'none' // Don't interfere with drag events
        }}>
          {track.type === 'audio' && track.audioFile && (
            <WaveformDisplay 
              audioFile={track.audioFile}
              trackColor={trackColor}
              duration={track.duration || 0}
              width={typeof trackWidth === 'number' ? trackWidth : 500}
            />
          )}
          
          {track.type === 'audio' && !track.audioFile && Array.from({length: 40}).map((_, i) => (
            <Box 
              key={i} 
              sx={{
                height: Math.sin(i * 0.3) * 10 + 10,
                width: 2,
                bgcolor: 'rgba(255,255,255,0.7)',
                mx: 0.2
              }}
            />
          ))}
          
          {track.type === 'midi' && (
            <>
              <Box
                className="piano-roll-trigger"
                data-testid="piano-roll-trigger"
                data-track-id={track.id}
                data-track-type={track.type}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  cursor: 'pointer',
                  zIndex: 100, // Increased zIndex to ensure it's on top
                  opacity: 0.3, // Make more visible for debugging
                  backgroundColor: 'rgba(0, 100, 255, 0.1)', // Add background color
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.3)'
                  }
                }}
              />
              <MidiNotesPreview 
                trackId={track.id}
                width={typeof trackWidth === 'number' ? trackWidth : 500}
                height={GRID_CONSTANTS.trackHeight - 6}
                trackColor={trackColor}
              />
            </>
          )}
          {track.type === 'drum' && (
            <>
              <Box
                className="piano-roll-trigger"
                data-testid="piano-roll-trigger"
                data-track-id={track.id}
                data-track-type={track.type}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  cursor: 'pointer',
                  zIndex: 10,
                  opacity: 0.1, // Make slightly visible for debugging
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.15)'
                  }
                }}
              />
              <MidiNotesPreview 
                trackId={track.id}
                width={typeof trackWidth === 'number' ? trackWidth : 500}
                height={GRID_CONSTANTS.trackHeight - 6}
                trackColor={trackColor}
              />
            </>
          )}
        </Box>
        
        {/* Track Name */}
        <Box sx={{ 
          position: 'absolute', 
          left: 10, 
          top: 6, 
          color: 'white',
          fontSize: '12px',
          fontWeight: 'bold',
          textShadow: '1px 1px 2px rgba(0,0,0,0.7)'
        }}>
          {track.name}
        </Box>
        
        {/* Muted indicator */}
        {track.muted && (
          <Box sx={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            MUTED
          </Box>
        )}
      </Box>
    </Box>
  );
};

// Wrap in React.memo with custom comparison that ignores volume and pan changes
export default React.memo(TrackPreview, (prevProps, nextProps) => {
  // Position changes should cause re-render
  if (prevProps.track.position.x !== nextProps.track.position.x || 
      prevProps.track.position.y !== nextProps.track.position.y) {
    return false; // Different positions, should re-render
  }
  
  // Muted state changes should cause re-render (affects opacity)
  if (prevProps.track.muted !== nextProps.track.muted) {
    return false; // Different muted state, should re-render
  }
  
  // Compare other relevant track properties that affect visualization
  if (prevProps.track._calculatedWidth !== nextProps.track._calculatedWidth) {
    return false; // Different width, should re-render
  }
  
  // Compare other necessary props
  if (prevProps.isPlaying !== nextProps.isPlaying ||
      prevProps.currentTime !== nextProps.currentTime ||
      prevProps.measureCount !== nextProps.measureCount ||
      prevProps.bpm !== nextProps.bpm) {
    return false; // Relevant props changed, should re-render
  }
  
  // Ignore volume and pan changes since they don't affect visualization
  return true; // No relevant changes, skip re-render
});