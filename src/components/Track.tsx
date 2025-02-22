import { Box } from '@mui/material';
import { GRID_CONSTANTS } from '../constants/gridConstants';
import WaveformDisplay from './WaveformDisplay';
import { useRef, useState, useEffect } from 'react';
import { Position } from '../core/types/track';

interface TrackProps {
  index: number;
  type: string;
  audioFile?: File;
  isPlaying: boolean;
  currentTime: number;
  measureCount: number;
  gridLineStyle: { borderRight: string };
  position: Position;
  onPositionChange: (newPosition: Position, isDragEnd: boolean) => void;
  id: string;
}

function Track({ 
  index, 
  type, 
  audioFile, 
  isPlaying, 
  currentTime, 
  measureCount, 
  gridLineStyle,
  position,
  onPositionChange,
  id 
}: TrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startDragMousePosition, setStartDragMousePosition] = useState({ x: 0, y: 0 });
  const [startDragTrackPosition, setStartDragTrackPosition] = useState({ x: 0, y: 0 });
  const lastMovedPositionRef = useRef<Position>(position);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!trackRef.current) return;

    // Store the initial mouse position
    setStartDragMousePosition({
      x: e.clientX + trackRef.current.closest('.MuiBox-root')?.scrollLeft || 0,
      y: e.clientY + trackRef.current.closest('.MuiBox-root')?.scrollTop || 0
    });

    // Store the initial track position
    setStartDragTrackPosition({
      x: position.x,
      y: position.y
    });

    // Initialize last moved position
    lastMovedPositionRef.current = position;

    setIsDragging(true);
    e.preventDefault(); // Prevent text selection while dragging
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !trackRef.current) return;

    const container = trackRef.current.closest('.MuiBox-root');
    if (!container) return;

    // Calculate the current mouse position including scroll
    const currentMouseX = e.clientX + container.scrollLeft;
    const currentMouseY = e.clientY + container.scrollTop;

    // Calculate the delta from the start position
    const deltaX = currentMouseX - startDragMousePosition.x;
    const deltaY = currentMouseY - startDragMousePosition.y;

    // Calculate new position based on the original position plus the delta
    const newX = startDragTrackPosition.x + deltaX;
    const newY = startDragTrackPosition.y + deltaY;

    // Snap to grid
    const snapToGrid = (value: number, gridSize: number) => {
      return Math.round(value / gridSize) * gridSize;
    };

    // Snap X to beats (quarter notes)
    const beatWidth = GRID_CONSTANTS.measureWidth / 4;
    const snappedX = snapToGrid(newX, beatWidth);

    // Snap Y to track height
    const snappedY = snapToGrid(newY, GRID_CONSTANTS.trackHeight);

    const newPosition = {
      x: Math.max(0, snappedX), // Prevent negative X
      y: Math.max(0, snappedY)  // Prevent negative Y
    };

    // Store the last moved position
    lastMovedPositionRef.current = newPosition;

    onPositionChange(newPosition, false);
  };

  const handleMouseUp = () => {
    if (isDragging && trackRef.current) {
      // Send final position with isDragEnd=true using the last moved position
      onPositionChange(lastMovedPositionRef.current, true);
    }
    setIsDragging(false);
  };

  // Add/remove global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startDragMousePosition, startDragTrackPosition]);

  return (
    <Box
      ref={trackRef}
      onMouseDown={handleMouseDown}
      sx={{ 
        display: 'flex',
        height: GRID_CONSTANTS.trackHeight,
        position: 'absolute',
        boxSizing: 'border-box',
        borderBottom: `1px solid ${GRID_CONSTANTS.borderColor}`,
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '100%',
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isDragging ? 2 : 1,
        transition: isDragging ? 'none' : 'all 0.1s ease',
        '&:hover': {
          boxShadow: '0 0 10px rgba(0,0,0,0.3)'
        }
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