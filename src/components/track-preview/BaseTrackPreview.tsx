import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Box } from '@mui/material';
import { BaseTrackPreviewProps, TrackContentProps } from './TrackPreviewTypes';
import { Position } from '../../core/types/track';
import { GRID_CONSTANTS } from '../../constants/gridConstants';

const BaseTrackPreview: React.FC<BaseTrackPreviewProps> = ({
  track,
  isPlaying,
  currentTime,
  measureCount,
  gridLineStyle,
  onPositionChange,
  renderContent,
  onTrackClick,
  bpm
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startDragMousePosition, setStartDragMousePosition] = useState({ x: 0, y: 0 });
  const [startDragTrackPosition, setStartDragTrackPosition] = useState({ x: 0, y: 0 });
  const lastMovedPositionRef = useRef<Position>(track.position);

  // Calculate track width based on duration and BPM
  const trackWidth = useMemo(() => {
    if (!track.duration) {
      console.log(`Track ${track.id} using default width - no duration`);
      return '100%';
    }
    
    const width = track._calculatedWidth || '100%';
    console.log(`Track ${track.id} width:`, { 
      duration: track.duration, 
      bpm: bpm,
      calculatedWidth: width
    });
    return width;
  }, [track.duration, bpm, track.id, track._calculatedWidth]);

  // Create style object for track width
  const trackStyle = useMemo(() => {
    const baseStyle = {
      display: 'flex',
      height: GRID_CONSTANTS.trackHeight,
      position: 'absolute' as const,
      boxSizing: 'border-box' as const,
      borderBottom: `1px solid ${GRID_CONSTANTS.borderColor}`,
      left: `${track.position.x}px`,
      top: `${track.position.y}px`,
      cursor: isDragging ? 'grabbing' : 'grab',
      zIndex: isDragging ? 2 : 1,
      transition: isDragging ? 'none' : 'width 0.2s ease',
      '&:hover': {
        boxShadow: '0 0 10px rgba(0,0,0,0.3)'
      },
      bgcolor: 'rgba(26, 26, 26, 0.8)',
      margin: 0,
      padding: 0
    };

    // Add width-specific styles
    if (typeof trackWidth === 'number') {
      return {
        ...baseStyle,
        width: `${trackWidth}px`
      };
    }

    return {
      ...baseStyle,
      width: '100%'
    };
  }, [trackWidth, track.position.x, track.position.y, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!trackRef.current) return;

    // Store the initial mouse position
    setStartDragMousePosition({
      x: e.clientX + (trackRef.current?.closest('.MuiBox-root')?.scrollLeft ?? 0),
      y: e.clientY + (trackRef.current?.closest('.MuiBox-root')?.scrollTop ?? 0)
    });

    // Store the initial track position
    setStartDragTrackPosition({
      x: track.position.x,
      y: track.position.y
    });

    // Initialize last moved position
    lastMovedPositionRef.current = track.position;

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

  const handleClick = () => {
    // Only trigger click if we weren't dragging
    if (!isDragging) {
      onTrackClick(track);
    }
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

  // Content props for the renderer
  const contentProps: TrackContentProps = {
    track,
    isPlaying,
    currentTime,
    measureCount,
    trackWidth,
    bpm
  };

  return (
    <Box
      ref={trackRef}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
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
        width: typeof trackWidth === 'number' ? `${trackWidth}px` : '100%',
        margin: 0,
        padding: 0,
        boxSizing: 'border-box',
        borderLeft: 'none',
        borderRight: 'none',
        '& > *': {
          margin: 0,
          padding: 0,
          borderLeft: 'none',
          borderRight: 'none'
        }
      }}>
        {renderContent(contentProps)}
      </Box>
    </Box>
  );
};

export default BaseTrackPreview; 