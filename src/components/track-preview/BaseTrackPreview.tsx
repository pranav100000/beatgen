import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Box } from '@mui/material';
import { BaseTrackPreviewProps, TrackContentProps } from './TrackPreviewTypes';
import { GRID_CONSTANTS } from '../../constants/gridConstants';

const BaseTrackPreview: React.FC<BaseTrackPreviewProps> = ({
  track,
  isPlaying,
  currentTime,
  measureCount,
  onPositionChange,
  renderContent,
  bpm,
  onTrackClick,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isTrimmingLeft, setIsTrimmingLeft] = useState(false);
  const [isTrimmingRight, setIsTrimmingRight] = useState(false);
  const [startMouseX, setStartMouseX] = useState(0);
  const [startMouseY, setStartMouseY] = useState(0);
  const [startTrackX, setStartTrackX] = useState(track.position.x);
  const [startTrackY, setStartTrackY] = useState(track.position.y);
  const [trackWidth, setTrackWidth] = useState<number>(track._calculatedWidth || 100);
  const [trimOffset, setTrimOffset] = useState(0);
  const [gdeltaX, setGdeltaX] = useState(0)

  const trackStyle = useMemo(() => ({
    display: 'flex',
    height: GRID_CONSTANTS.trackHeight,
    position: 'absolute',
    boxSizing: 'border-box',
    borderBottom: `1px solid ${GRID_CONSTANTS.borderColor}`,
    left: `${track.position.x}px`,
    top: `${track.position.y}px`,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: (isDragging || isTrimmingLeft || isTrimmingRight) ? 2 : 1,
    // transition: (isDragging || isTrimmingLeft || isTrimmingRight) ? 'none' : 'width 0.2s ease',
    transition: 'width 0.3s ease-in-out',
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    width: `${trackWidth}px`,
  }), [trackWidth, track.position.x, track.position.y, isDragging, isTrimmingLeft, isTrimmingRight]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isTrimmingLeft && !isTrimmingRight) {
      setIsDragging(true);
      setStartMouseX(e.clientX);
      setStartMouseY(e.clientY);
      setStartTrackX(track.position.x);
      setStartTrackY(track.position.y);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - startMouseX;
      const deltaY = e.clientY - startMouseY;
      onPositionChange({ x: startTrackX + deltaX, y: startTrackY + deltaY }, false);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleTrimMouseDown = (e: React.MouseEvent, isLeft: boolean) => {
    e.stopPropagation();
    setStartMouseX(e.clientX);
    setStartTrackX(track.position.x);
    isLeft ? setIsTrimmingLeft(true) : setIsTrimmingRight(true);
    window.addEventListener('mousemove', handleTrimMouseMove);
    window.addEventListener('mouseup', handleTrimMouseUp);
  };

  const handleTrimMouseMove = (e: MouseEvent) => {
    const deltaX = e.clientX - startMouseX;
    setGdeltaX(deltaX)

    if (isTrimmingLeft) {
      const newWidth = Math.max(20, trackWidth - deltaX);
      const newX = startTrackX + deltaX;  // Move the start position
  
      if (newWidth >= 20) {
        setTrackWidth(newWidth);
        onPositionChange({ x: newX, y: track.position.y }, false);  // Update left boundary
      }
    }
    if (isTrimmingRight) {
      const newWidth = Math.max(20, trackWidth + deltaX);
      setTrackWidth(newWidth);
    }
  };

  const handleTrimMouseUp = () => {
    setIsTrimmingLeft(false);
    setIsTrimmingRight(false);
    window.removeEventListener('mousemove', handleTrimMouseMove);
    window.removeEventListener('mouseup', handleTrimMouseUp);
  };

  const handleClick = () => {
    // Only trigger click if we weren't dragging
    if (!isDragging) {
      onTrackClick(track);
    }
  };


  useEffect(() => {    
    if (!isTrimmingLeft && !isTrimmingRight && gdeltaX == 0) {      
      if (track.type === 'audio') {
        const newWidth = track._calculatedWidth || trackWidth; // Fallback to current width  
        if (newWidth !== trackWidth) { // Only update if width is actually changing
          setTrackWidth(prevWidth => {
            return newWidth;
          });
        }
      }
    }
  }, [bpm, track._calculatedWidth, isTrimmingLeft, isTrimmingRight]);


  return (
    <Box ref={trackRef} sx={trackStyle} onMouseDown={handleMouseDown} onClick={handleClick}>
      {/* Left Trim Handle */}
      <Box
        sx={{ position: 'absolute', left: 0, width: '5px', height: '100%', cursor: 'ew-resize', zIndex: 3, '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.3)' } }}
        onMouseDown={(e) => handleTrimMouseDown(e, true)}
      />
      {/* Track Content */}
      <Box sx={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden', height: '100%' }}>
        {renderContent({ track, isPlaying, currentTime, measureCount, trackWidth, bpm})}
      </Box>
      {/* Right Trim Handle */}
      <Box
        sx={{ position: 'absolute', right: 0, width: '5px', height: '100%', cursor: 'ew-resize', zIndex: 3, '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.3)' } }}
        onMouseDown={(e) => handleTrimMouseDown(e, false)}
      />
    </Box>
  );
};

export default BaseTrackPreview;

