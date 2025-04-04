import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Box } from '@mui/material';
import { GRID_CONSTANTS, calculateTimePosition } from '../../constants/gridConstants';
import { useStudioStore } from '../../stores/useStudioStore';

interface PlaybackCursorProps {
  currentTime: number;  // Initial time, but component will manage its own updates
  isPlaying?: boolean;  // Initial play state
  bpm?: number;
  timeSignature?: [number, number];
}

// Define the ref interface with imperative methods
export interface PlaybackCursorRef {
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
}

const PlaybackCursor = forwardRef<PlaybackCursorRef, PlaybackCursorProps>(
  ({ currentTime = 0, isPlaying = false, bpm = 120, timeSignature = [4, 4] }, ref) => {
    // Use ref for direct DOM manipulation
    const cursorRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(currentTime);
    
    // Access store for transport position without causing re-renders
    const store = useStudioStore(state => state.store);
    
    // Colors from constants
    const activeColor = GRID_CONSTANTS.cursorColor;
    const inactiveColor = GRID_CONSTANTS.cursorColorInactive;
    
    // Calculate initial position
    const initialPosition = calculateTimePosition(currentTime, bpm, timeSignature);
    
    // Function to start the animation loop
    const startAnimationLoop = () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
      
      const updateCursorPosition = () => {
        if (cursorRef.current && store) {
          const transport = store.getTransport();
          if (transport) {
            // Get current time directly from transport
            const currentTime = transport.position;
            
            // Only update DOM if time changed significantly (optimization)
            if (Math.abs(currentTime - lastTimeRef.current) > 0.01) {
              // Calculate position in pixels
              const position = calculateTimePosition(currentTime, bpm, timeSignature);
              
              // Update position using direct DOM manipulation
              cursorRef.current.style.left = `${position}px`;
              
              // Store current time for next comparison
              lastTimeRef.current = currentTime;
            }
          }
        }
        
        // Continue animation loop
        requestRef.current = requestAnimationFrame(updateCursorPosition);
      };
      
      // Start the animation loop
      requestRef.current = requestAnimationFrame(updateCursorPosition);
    };
    
    // Function to stop the animation loop
    const stopAnimationLoop = () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
    
    // Expose imperative methods via ref
    useImperativeHandle(ref, () => ({
      play: () => {
        if (cursorRef.current) {
          // Update cursor style for playing state
          cursorRef.current.style.backgroundColor = activeColor;
          cursorRef.current.style.boxShadow = '0 0 8px rgba(255, 85, 85, 0.6)';
          cursorRef.current.style.transition = 'none';
          
          // Get latest triangle element and update its color
          const triangle = cursorRef.current.querySelector('::before');
          if (triangle) {
            triangle.setAttribute('border-top-color', activeColor);
          }
          
          // Start animation frame loop
          startAnimationLoop();
          
          console.log('PlaybackCursor: play method called');
        }
      },
      
      pause: () => {
        if (cursorRef.current) {
          // Update cursor style for paused state
          cursorRef.current.style.backgroundColor = inactiveColor;
          cursorRef.current.style.boxShadow = 'none';
          cursorRef.current.style.transition = 'left 0.1s ease-out';
          
          // Get latest triangle element and update its color
          const triangle = cursorRef.current.querySelector('::before');
          if (triangle) {
            triangle.setAttribute('border-top-color', inactiveColor);
          }
          
          // Stop animation frame loop
          stopAnimationLoop();
          
          console.log('PlaybackCursor: pause method called');
        }
      },
      
      stop: () => {
        if (cursorRef.current) {
          // Reset cursor to start position
          cursorRef.current.style.backgroundColor = inactiveColor;
          cursorRef.current.style.boxShadow = 'none';
          cursorRef.current.style.transition = 'left 0.1s ease-out';
          cursorRef.current.style.left = '0px';
          
          // Get latest triangle element and update its color
          const triangle = cursorRef.current.querySelector('::before');
          if (triangle) {
            triangle.setAttribute('border-top-color', inactiveColor);
          }
          
          // Stop animation frame loop
          stopAnimationLoop();
          
          // Update last time
          lastTimeRef.current = 0;
          
          console.log('PlaybackCursor: stop method called');
        }
      },
      
      seek: (time) => {
        if (cursorRef.current) {
          // Calculate new position
          const position = calculateTimePosition(time, bpm, timeSignature);
          
          // Update position with transition for smooth seeking
          cursorRef.current.style.left = `${position}px`;
          
          // Update last time
          lastTimeRef.current = time;
          
          console.log(`PlaybackCursor: seek method called to ${time}s (${position}px)`);
        }
      }
    }));
    
    // Set initial position and start animation if initially playing
    useEffect(() => {
      if (cursorRef.current) {
        cursorRef.current.style.left = `${initialPosition}px`;
        lastTimeRef.current = currentTime;
      }
      
      // Start animation if initially playing
      if (isPlaying) {
        startAnimationLoop();
      }
      
      // Cleanup animation frame on unmount
      return () => {
        stopAnimationLoop();
      };
    }, []);
    
    return (
      <Box
        ref={cursorRef}
        sx={{
          position: 'absolute',
          left: `${initialPosition}px`,
          top: 0,
          bottom: 0,
          width: '2px',
          bgcolor: isPlaying ? activeColor : inactiveColor,
          zIndex: 1500,
          pointerEvents: 'none',
          transition: isPlaying ? 'none' : 'left 0.1s ease-out',
          boxShadow: isPlaying ? `0 0 8px rgba(255, 85, 85, 0.6)` : 'none',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: '-4px',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: `8px solid ${isPlaying ? activeColor : inactiveColor}`,
            zIndex: 1501,
          }
        }}
      />
    );
  }
);

export default PlaybackCursor; 