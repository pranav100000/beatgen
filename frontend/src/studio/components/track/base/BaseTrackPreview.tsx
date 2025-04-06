import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { GRID_CONSTANTS } from '../../../constants/gridConstants';
import { Position, TrackState } from '../../../core/types/track';

/**
 * BaseTrackPreview is the foundation for all track visualizations in the timeline.
 * It provides common functionality like drag-and-drop positioning, visual styling,
 * and appearance management, while delegating track-specific content rendering to
 * specialized components.
 * 
 * This component follows the strategy pattern, where the rendering behavior is
 * provided by the implementing components.
 */
export interface BaseTrackPreviewProps {
  /** Track data including ID, type, and state */
  track: TrackState;
  
  /** Whether the track is currently playing */
  isPlaying: boolean;
  
  /** Current playback time in seconds */
  currentTime: number;
  
  /** Number of measures to display */
  measureCount: number;
  
  /** Style for grid lines */
  gridLineStyle: { borderRight: string };
  
  /** Callback when track position changes */
  onPositionChange: (trackId: string, newPosition: Position, isDragEnd: boolean) => void;
  
  /** Current project BPM */
  bpm: number;
  
  /** Time signature as [beats, beatUnit] */
  timeSignature?: [number, number];
  
  /** Track index for color determination */
  trackIndex?: number;
  
  /** Color for track visualization */
  trackColor: string;
  
  /** Optional style overrides */
  trackStyleOverrides?: React.CSSProperties;
  
  /** Function to render track-specific content */
  renderTrackContent: () => React.ReactNode;
  
  /** Calculated width for the track */
  trackWidth: number;
}

export const BaseTrackPreview: React.FC<BaseTrackPreviewProps> = ({
  track,
  isPlaying,
  currentTime,
  onPositionChange,
  trackColor,
  trackStyleOverrides = {},
  renderTrackContent,
  trackWidth,
  timeSignature = [4, 4]
}) => {
  // Refs and state for drag functionality
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startDragMousePosition, setStartDragMousePosition] = useState({ x: 0, y: 0 });
  const [startDragTrackPosition, setStartDragTrackPosition] = useState({ x: 0, y: 0 });
  const lastMovedPositionRef = useRef<Position>(track.position);

  // Create base style object for track
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
    width: `${trackWidth}px`,
    overflow: 'hidden',
    ...trackStyleOverrides
  };

  // Mouse event handlers for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    
    // Prevent dragging when clicking on controls
    if ((e.target as HTMLElement).closest('.track-control')) return;

    // Find container element for scroll offset
    const container = 
      trackRef.current.closest('.timeline-container') || 
      trackRef.current.closest('.MuiBox-root') ||
      trackRef.current.parentElement?.parentElement;
      
    if (!container) return;
    
    // Store initial positions
    setStartDragMousePosition({
      x: e.clientX + (container.scrollLeft || 0),
      y: e.clientY + (container.scrollTop || 0)
    });
    setStartDragTrackPosition({
      x: track.position.x,
      y: track.position.y
    });
    lastMovedPositionRef.current = track.position;

    // Setup initial style for dragging
    if (trackRef.current) {
      trackRef.current.style.left = `${track.position.x}px`;
      trackRef.current.style.top = `${track.position.y}px`;
      trackRef.current.style.transition = 'none';
    }
    
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !trackRef.current) return;
    
    const container = 
      trackRef.current.closest('.timeline-container') || 
      trackRef.current.closest('.MuiBox-root') ||
      trackRef.current.parentElement?.parentElement;
      
    if (!container) return;

    // Calculate mouse position with scroll offset
    const currentMouseX = e.clientX + container.scrollLeft;
    const currentMouseY = e.clientY + container.scrollTop;

    // Calculate position delta
    const deltaX = currentMouseX - startDragMousePosition.x;
    const deltaY = currentMouseY - startDragMousePosition.y;
    const newX = startDragTrackPosition.x + deltaX;
    const newY = startDragTrackPosition.y + deltaY;

    // Snap to grid function
    const snapToGrid = (value: number, gridSize: number) => {
      return Math.round(value / gridSize) * gridSize;
    };

    // Calculate grid sizes for snapping
    const beatsPerMeasure = timeSignature[0];
    const subdivisionsPerBeat = timeSignature[1];
    const subdivisionsPerMeasure = beatsPerMeasure * subdivisionsPerBeat;
    const subdivisionWidth = GRID_CONSTANTS.measureWidth / subdivisionsPerMeasure;
    
    // Apply snapping
    const snappedX = snapToGrid(newX, subdivisionWidth);
    const snappedY = snapToGrid(newY, GRID_CONSTANTS.trackHeight);
    const newPosition = {
      x: Math.max(0, snappedX),
      y: Math.max(0, snappedY)
    };

    // Update visual position during drag
    if (trackRef.current) {
      trackRef.current.style.left = `${newPosition.x}px`;
      trackRef.current.style.top = `${newPosition.y}px`;
    }
    
    // Store position for final update
    lastMovedPositionRef.current = newPosition;
  }, [
    isDragging, 
    startDragMousePosition, 
    startDragTrackPosition, 
    timeSignature
  ]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && trackRef.current) {
      // Trigger position change with drag end flag
      onPositionChange(track.id, lastMovedPositionRef.current, true);
      
      // Restore transitions
      if (trackRef.current) {
        trackRef.current.style.transition = 'left 0.2s ease, top 0.2s ease';
      }
    }
    
    setIsDragging(false);
  }, [isDragging, track.id, onPositionChange]);

  // Add/remove mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  // Sync position from props to DOM (for undo/redo)
  useEffect(() => {
    if (trackRef.current && !isDragging) {
      trackRef.current.style.left = `${track.position.x}px`;
      trackRef.current.style.top = `${track.position.y}px`;
    }
  }, [track.position.x, track.position.y, isDragging]);

  return (
    <Box
      ref={trackRef}
      onMouseDown={handleMouseDown}
      className="track"
      sx={trackStyle}
    >
      {/* Track Timeline */}
      <Box sx={{ 
        display: 'flex',
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        width: `${trackWidth}px`,
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
        
        {/* Call the render strategy function for specific track content */}
        <Box sx={{
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          opacity: 0.8,
          pointerEvents: 'none'
        }}>
          {renderTrackContent()}
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

export default BaseTrackPreview;