import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { GRID_CONSTANTS } from '../../../constants/gridConstants';
import { Position, TrackState } from '../../../core/types/track';
import { pixelsToTicks, ticksToPixels } from '../../../constants/gridConstants';

/**
 * BaseTrackPreview is the foundation for all track visualizations in the timeline.
 * It provides common functionality like drag-and-drop positioning, visual styling,
 * and appearance management, while delegating track-specific content rendering to
 * specialized components. It also supports resizing from the left and right edges.
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
  
  /** Calculated width for the track container */
  trackWidth: number;
  
  /** Full content width (before trimming) - used for positioning the content within the viewport */
  contentWidth?: number;
  
  /** Callback when track resizing finishes */
  onResizeEnd: (trackId: string, newTrimTicks: number, resizeDirection: 'left' | 'right') => void;
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
  contentWidth,
  timeSignature = [4, 4],
  bpm,
  onResizeEnd
}) => {
  // Use the provided content width or default to track width if not specified
  const actualContentWidth = contentWidth || trackWidth;
  
  // Refs and state for drag functionality
  const trackRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startDragMousePosition, setStartDragMousePosition] = useState({ x: 0, y: 0 });
  const [startDragTrackPosition, setStartDragTrackPosition] = useState({ x: 0, y: 0 });
  const lastMovedPositionRef = useRef<Position>(track.position);
  
  // Track the mouse start position for click detection
  const mouseStartPosRef = useRef<{x: number, y: number} | null>(null);
  
  // Track the content transform during left-side resize
  const [contentTransform, setContentTransform] = useState(0);
  
  // Store the trackWidth in a ref to ensure we maintain it during operations
  const trackWidthRef = useRef(trackWidth);
  useEffect(() => {
    trackWidthRef.current = trackWidth;
  }, [trackWidth]);

  // Refs and state for resize functionality
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<'left' | 'right' | null>(null);
  const [startResizeInfo, setStartResizeInfo] = useState<{ 
    startMouseX: number, 
    startTrackX: number, 
    startTrackWidth: number,
    startContentTransform?: number 
  } | null>(null);
  const lastResizeDataRef = useRef<{ newX: number, newWidth: number }>({ newX: track.position.x, newWidth: trackWidth });
  const MIN_TRACK_WIDTH_SNAP_UNITS = 1; // Minimum width in terms of smallest grid subdivision

  // Calculate the normal content offset for trimming from the beginning
  const calculateContentOffset = () => {
    if (!track.originalDurationTicks || !track.trimStartTicks) return 0;
    
    // Calculate what percentage of the original content is trimmed from start
    const trimRatio = track.trimStartTicks / track.originalDurationTicks;
    
    // Apply that ratio to the full content width to get the offset
    return -(trimRatio * actualContentWidth);
  };
  
  // The normal position offset for content (used when not actively resizing)
  const contentOffsetX = calculateContentOffset();

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
    cursor: isDragging ? 'grabbing' : (isResizing ? 'ew-resize' : 'grab'),
    zIndex: isDragging || isResizing ? 1001 : 1000,
    transition: isDragging || isResizing ? 'none' : 'width 0.2s ease, left 0.2s ease, top 0.2s ease',
    '&:hover': {
      boxShadow: `0 0 12px ${trackColor}`,
      zIndex: 9999
    },
    bgcolor: 'rgba(26, 26, 26, 0.8)',
    margin: 0,
    padding: 0,
    width: `${trackWidth}px`,
    overflow: 'hidden', // This creates the clipping viewport
    ...trackStyleOverrides
  };

  // Mouse event handlers for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    
    // Prevent dragging when clicking on controls or resize handles
    if ((e.target as HTMLElement).closest('.track-control') || (e.target as HTMLElement).closest('.resize-handle')) return;

    // Find container element for scroll offset
    const container = 
      trackRef.current.closest('.timeline-container') || 
      trackRef.current.closest('.MuiBox-root') ||
      trackRef.current.parentElement?.parentElement;
      
    if (!container) return;
    
    // Mark the element as interacting
    if (trackRef.current) {
      trackRef.current.setAttribute('data-interacting', 'true');
    }
    
    // Store initial positions
    setStartDragMousePosition({
      x: e.clientX + (container.scrollLeft || 0),
      y: e.clientY + (container.scrollTop || 0)
    });
    
    // Convert track position from ticks to pixels before storing
    const positionXPixels = ticksToPixels(track.position.x, bpm, timeSignature);
    setStartDragTrackPosition({
      x: positionXPixels, // Store in pixels for consistent drag calculations
      y: track.position.y
    });
    
    lastMovedPositionRef.current = track.position;

    // Setup initial style for dragging
    if (trackRef.current) {
      trackRef.current.style.left = `${positionXPixels}px`; // Use pixels for visual position
      trackRef.current.style.top = `${track.position.y}px`;
      trackRef.current.style.transition = 'none';
    }
    
    setIsDragging(true);
    e.preventDefault();
  };

  const handleResizeMouseDown = (e: React.MouseEvent, direction: 'left' | 'right') => {
    if (!trackRef.current) return;
    
    const container = 
      trackRef.current.closest('.timeline-container') || 
      trackRef.current.closest('.MuiBox-root') ||
      trackRef.current.parentElement?.parentElement;
      
    if (!container) return;

    // Mark the element as interacting
    if (trackRef.current) {
      trackRef.current.setAttribute('data-interacting', 'true');
    }

    setIsResizing(true);
    setResizeDirection(direction);
    
    // Capture current visual transform directly from the DOM
    let initialTransform = contentOffsetX;
    if (contentRef.current) {
      const transformStyle = contentRef.current.style.transform;
      if (transformStyle && transformStyle.includes('translateX(')) {
        const match = transformStyle.match(/translateX\(([-\d.]+)px\)/);
        if (match && match[1]) {
          initialTransform = parseFloat(match[1]);
        }
      }
    }
    
    // Store the actual current transform as our starting point
    setContentTransform(initialTransform);
    
    // Convert track position x from ticks to pixels for visual operations
    const trackXPixels = ticksToPixels(track.position.x, bpm, timeSignature);
    
    // Always use the current trackWidth for start information
    setStartResizeInfo({
      startMouseX: e.clientX + (container.scrollLeft || 0),
      startTrackX: trackXPixels, // Store in pixels for visual resize
      startTrackWidth: trackWidthRef.current,
      startContentTransform: initialTransform // Store the initial transform
    });
    
    lastResizeDataRef.current = { 
      newX: trackXPixels, // Store in pixels
      newWidth: trackWidthRef.current
    };

    // Disable transitions immediately
    if (trackRef.current) {
      trackRef.current.style.transition = 'none';
      trackRef.current.style.width = `${trackWidthRef.current}px`;
      trackRef.current.style.left = `${trackXPixels}px`; // Ensure left position is in pixels
    }

    // Also disable transitions on content wrapper
    if (contentRef.current) {
      contentRef.current.style.transition = 'none';
      // No need to set transform here - already set correctly
    }

    e.stopPropagation(); // Prevent track drag
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!trackRef.current) return;

    const container = 
      trackRef.current.closest('.timeline-container') || 
      trackRef.current.closest('.MuiBox-root') ||
      trackRef.current.parentElement?.parentElement;
      
    if (!container) return;

    // Calculate mouse position with scroll offset
    const currentMouseX = e.clientX + container.scrollLeft;
    const currentMouseY = e.clientY + container.scrollTop;

    // --- Dragging Logic ---
    if (isDragging) {
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
      
      // Apply snapping to pixels first (for visual positioning)
      const snappedX = snapToGrid(newX, subdivisionWidth);
      const snappedY = snapToGrid(newY, GRID_CONSTANTS.trackHeight);
      
      // Create a position object with x in ticks for data storage
      // For visual display, we still use pixels
      const tickPositionX = pixelsToTicks(Math.max(0, snappedX), bpm, timeSignature);
      const newPosition = {
        x: tickPositionX, // Store in ticks
        y: Math.max(0, snappedY)
      };

      // Update visual position during drag (still using pixels for visual display)
      if (trackRef.current) {
        trackRef.current.style.left = `${snappedX}px`; // Display in pixels
        trackRef.current.style.top = `${newPosition.y}px`;
      }
      
      // Store position for final update
      lastMovedPositionRef.current = newPosition;
    } 
    // --- Resizing Logic ---
    else if (isResizing && startResizeInfo) {
      const deltaX = currentMouseX - startResizeInfo.startMouseX;
      let snappedNewX = startResizeInfo.startTrackX;
      let snappedNewWidth = startResizeInfo.startTrackWidth;
      
      // Calculate grid sizes for snapping
      const beatsPerMeasure = timeSignature[0];
      const subdivisionsPerBeat = timeSignature[1]; // Assuming beat unit maps directly
      const subdivisionsPerMeasure = beatsPerMeasure * subdivisionsPerBeat;
      const subdivisionWidth = GRID_CONSTANTS.measureWidth / subdivisionsPerMeasure;
      const minPixelWidth = subdivisionWidth * MIN_TRACK_WIDTH_SNAP_UNITS;

      // Snap function specific for resizing (ensures minimum width)
      const snapResize = (value: number, gridSize: number, minValue: number = 0) => {
          const snapped = Math.round(value / gridSize) * gridSize;
          return Math.max(minValue, snapped);
      };

      if (resizeDirection === 'right') {
          // Right resize - simply change the container width
          const newWidth = startResizeInfo.startTrackWidth + deltaX;
          snappedNewWidth = snapResize(newWidth, subdivisionWidth, minPixelWidth);
          
          if (trackRef.current) {
            trackRef.current.style.width = `${snappedNewWidth}px`;
          }
          
          // For right resize, we don't need to adjust content transform
          // Content stays anchored to the left edge
          
      } else if (resizeDirection === 'left') {
          // Left resize - change both container position and width
          const newX = startResizeInfo.startTrackX + deltaX;
          const newWidth = startResizeInfo.startTrackWidth - deltaX;
          
          // Snap to grid
          snappedNewX = snapResize(Math.max(0, newX), subdivisionWidth); 
          
          // Calculate width based on the snapped X position to maintain right edge
          const rightEdge = startResizeInfo.startTrackX + startResizeInfo.startTrackWidth;
          let potentialSnappedWidth = rightEdge - snappedNewX;

          // Ensure minimum width
          snappedNewWidth = snapResize(potentialSnappedWidth, subdivisionWidth, minPixelWidth);

          // Recalculate snappedNewX if minimum width constraint changed the width
          snappedNewX = Math.max(0, rightEdge - snappedNewWidth);

          // Update visual position and width during resize
          if (trackRef.current) {
            trackRef.current.style.left = `${snappedNewX}px`;
            trackRef.current.style.width = `${snappedNewWidth}px`;
            
            // For left resize, we need to adjust content position to compensate for container movement
            if (contentRef.current) {
              // Calculate container movement from the start position
              const containerDeltaX = snappedNewX - startResizeInfo.startTrackX;
              
              // Use captured initial transform as the base
              const initialTransform = startResizeInfo.startContentTransform || contentOffsetX;
              
              // Content should move in opposite direction of container
              const transform = initialTransform - containerDeltaX;
              contentRef.current.style.transform = `translateX(${transform}px)`;
            }
          }
      }
      
      // Store values for final update on mouse up
      lastResizeDataRef.current = { newX: snappedNewX, newWidth: snappedNewWidth };
    }
  }, [
    isDragging, 
    isResizing,
    resizeDirection,
    startResizeInfo,
    startDragMousePosition, 
    startDragTrackPosition, 
    timeSignature,
    contentOffsetX,
    bpm
  ]);

  const handleMouseUp = useCallback(() => {
    // --- Drag End ---
    if (isDragging && trackRef.current) {
      const finalPosition = lastMovedPositionRef.current;
      setIsDragging(false); // Reset state first

      // Trigger position change with drag end flag
      onPositionChange(track.id, finalPosition, true);
      
      // Restore transitions after state change
      if (trackRef.current) {
        // Convert tick position back to pixels for visual display
        const pixelX = ticksToPixels(finalPosition.x, bpm, timeSignature);
        
        // Explicitly set final position/width before re-enabling transition
        trackRef.current.style.left = `${pixelX}px`;
        trackRef.current.style.top = `${finalPosition.y}px`;
        // Ensure width is reset if needed (although drag shouldn't change it)
        trackRef.current.style.width = `${trackWidth}px`;
        trackRef.current.style.transition = 'left 0.2s ease, top 0.2s ease, width 0.2s ease'; 
        
        // Keep the interaction attribute for a short period, then remove it
        setTimeout(() => {
          if (trackRef.current) {
            trackRef.current.removeAttribute('data-interacting');
          }
        }, 0);
      }
    } 
    // --- Resize End ---
    else if (isResizing && trackRef.current) {
      const finalResizeData = lastResizeDataRef.current;
      const currentDirection = resizeDirection;
      
      console.log('Final resize data before ending resize:', finalResizeData);
      
      setIsResizing(false); // Reset state first
      setResizeDirection(null);
      
      // Enable transitions for smooth visual updates
      if (contentRef.current) {
        contentRef.current.style.transition = 'transform 0.2s ease';
      }

      if (currentDirection === 'left') {
        // For left resize: calculate position change in pixels
        const deltaXPixels = finalResizeData.newX - (startResizeInfo?.startTrackX || 0);
        
        // Set final visual position and width
        if (trackRef.current) {
          trackRef.current.style.left = `${finalResizeData.newX}px`;
          trackRef.current.style.width = `${finalResizeData.newWidth}px`;
          
          // Calculate the final transform for content
          if (contentRef.current) {
            const containerDeltaX = finalResizeData.newX - (startResizeInfo?.startTrackX || 0);
            const initialTransform = startResizeInfo?.startContentTransform || contentOffsetX;
            const finalTransform = initialTransform - containerDeltaX;
            
            // Apply the transform - we'll keep this until the state updates
            contentRef.current.style.transform = `translateX(${finalTransform}px)`;
            setContentTransform(finalTransform);
          }
        }
        
        // Pass the pixel delta directly to the callback
        onResizeEnd(track.id, deltaXPixels, currentDirection);
      } else if (currentDirection === 'right') {
        // For right resize: calculate width change in pixels
        const deltaWidthPixels = finalResizeData.newWidth - (startResizeInfo?.startTrackWidth || trackWidth);
        
        // No transform adjustments needed for right resize
        
        // Pass the pixel delta directly to the callback
        onResizeEnd(track.id, deltaWidthPixels, currentDirection);
      }
      
      // Clear the startResizeInfo after we're done with it
      setStartResizeInfo(null);
      
      // Keep the interaction attribute for a short period, then remove it
      setTimeout(() => {
        if (trackRef.current) {
          trackRef.current.removeAttribute('data-interacting');
        }
      }, 0);
    }
    
  }, [isDragging, isResizing, resizeDirection, track.id, track.position, onPositionChange, onResizeEnd, trackWidth, bpm, timeSignature, startResizeInfo, contentOffsetX]);

  // Handle click event
  const handleClick = (e: React.MouseEvent) => {
    // If this track is being interacted with (has data-interacting attribute)
    // stop the event propagation to prevent piano roll from opening
    if (trackRef.current?.hasAttribute('data-interacting')) {
      e.stopPropagation();
    }
  };

  // Add/remove mouse event listeners
  useEffect(() => {
    // Listen if either dragging or resizing
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);
  
  // Sync position AND width from props to DOM (for undo/redo, or external changes)
  useEffect(() => {
    if (trackRef.current && !isDragging && !isResizing) { // Only sync if not actively dragging/resizing
      // Convert track position from ticks to pixels for display
      const pixelX = ticksToPixels(track.position.x, bpm, timeSignature);
      
      trackRef.current.style.left = `${pixelX}px`;
      trackRef.current.style.top = `${track.position.y}px`;
      
      // Important: Always update the width to match props
      trackRef.current.style.width = `${trackWidth}px`;
      
      console.log('Syncing track DOM:', { id: track.id, width: trackWidth, ticksX: track.position.x, pixelsX: pixelX });
    }
  }, [track.position.x, track.position.y, trackWidth, isDragging, isResizing, track.id, bpm, timeSignature]);

  // Reset content transform after trim values change and component re-renders
  // This ensures we switch back to using the calculated offset once state updates
  useEffect(() => {
    if (!isResizing && contentTransform !== 0) {
      // We want to wait until the state has fully updated
      const timer = setTimeout(() => {
        setContentTransform(0);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [track.trimStartTicks, track.trimEndTicks, isResizing, contentTransform]);

  // Calculate the transform to use for content position
  const getContentTransform = () => {
    if (contentTransform !== 0) {
      // Use the manually set transform if we have one
      return contentTransform;
    } 
    // Otherwise use normal offset based on trim values
    return contentOffsetX;
  };

  // Define styles for resize handles
  const resizeHandleStyle = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '8px', // Make handle easier to grab
    cursor: 'ew-resize',
    zIndex: 1002, // Ensure handles are above track content
  };

  return (
    <Box
      ref={trackRef}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className="track"
      sx={trackStyle}
      data-track-width={trackWidth} // Add data attribute for debugging
    >
       {/* Left Resize Handle */}
      <Box
        className="resize-handle resize-handle-left"
        sx={{
          ...resizeHandleStyle,
          left: '-4px', // Position slightly outside/overlapping the left edge
        }}
        onMouseDown={(e) => handleResizeMouseDown(e, 'left')}
      />
      
       {/* Right Resize Handle */}
      <Box
        className="resize-handle resize-handle-right"
        sx={{
          ...resizeHandleStyle,
          right: '-4px', // Position slightly outside/overlapping the right edge
        }}
        onMouseDown={(e) => handleResizeMouseDown(e, 'right')}
      />

      {/* Track Timeline Content (Original Inner Box) */}
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
        transition: 'opacity 0.2s ease',
        pointerEvents: 'none' // Ensure content doesn't interfere with handles/dragging
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
          opacity: 0.7,
          pointerEvents: 'none' // Ensure content doesn't interfere
        }}>
          {track.type}
        </Box>
        
        {/* Content Wrapper - Visible part is controlled by the container's overflow: hidden */}
        <Box 
          ref={contentRef}
          className="track-content-wrapper"
          sx={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: `${actualContentWidth}px`, // Set to full content width
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            opacity: 0.8,
            pointerEvents: 'none', // Ensure content doesn't interfere
            transform: `translateX(${getContentTransform()}px)`,
            transition: isResizing ? 'none' : 'transform 0.2s ease',
          }}
        >
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
          textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
          pointerEvents: 'none' // Ensure content doesn't interfere
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
            fontWeight: 'bold',
            pointerEvents: 'none' // Ensure content doesn't interfere
          }}>
            MUTED
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default BaseTrackPreview;