import React from 'react';
import Box from '@mui/material/Box';
import { Rnd } from 'react-rnd'; // Import Rnd for resize functionality
import { GRID_CONSTANTS, getTrackColor } from '../../constants/gridConstants';
import { TrackState, Position } from '../../core/types/track';
import WaveformDisplay from './WaveformDisplay';
import { MidiNotesPreview } from '../piano-roll';

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
  const [trackWidth, setTrackWidth] = React.useState(track._calculatedWidth || 500);
  const [position, setPosition] = React.useState(track.position);
  const [startOffset, setStartOffset] = React.useState(0);
  const [initialWaveformWidth, setInitialWaveformWidth] = React.useState(0); // Track initial waveform width
  const trackColor = getTrackColor(trackIndex);

  React.useEffect(() => {
    // Initialize the waveform width once the component has mounted
    if (trackWidth !== 0 && initialWaveformWidth === 0) {
      setInitialWaveformWidth(trackWidth); // Set the initial width to track's calculated width
    }
  }, [trackWidth, initialWaveformWidth]);

  React.useEffect(() => {
    const savedPosition = localStorage.getItem(`track-position-${track.id}`);
    if (savedPosition) {
      const parsedPosition = JSON.parse(savedPosition);
      setPosition(parsedPosition);
    }
  }, [track.id ]);

  const handleDragStop = (e: any, data: any) => {
    const newPosition = { x: data.x, y: data.y };
    localStorage.setItem(`track-position-${track.id}`, JSON.stringify(newPosition));
    setPosition(newPosition);
    
    onPositionChange(track.id, newPosition, true);
  };

  const handleResize = (e: MouseEvent, direction: string, ref: HTMLElement, delta: { width: number }) => {
    let newX = position.x;
    let newWidth = ref.offsetWidth;
    let newStartOffset = startOffset;

    if (direction === 'left') {
      const widthDiff = trackWidth - newWidth;
      newX += widthDiff;
      newStartOffset += (widthDiff / trackWidth) * track.duration;
    } else if (direction === 'right') {
      // Keep waveform width from shrinking, just adjust the track's visual width
      newWidth = ref.offsetWidth;
    }

    setTrackWidth(newWidth);
    setStartOffset(newStartOffset);
    setPosition((prev) => ({ ...prev, x: newX }));
  };

  const handleResizeStop = (e: MouseEvent, direction: string, ref: HTMLElement, delta: { width: number }) => {
    onPositionChange(track.id, { x: position.x, y: position.y }, false);
  };
  
  
  React.useEffect(() => {
    if (trackRef.current && !isPlaying) {
      console.log("Syncing track position:", { 
        trackId: track.id, 
        x: position.x, 
        y: position.y 
      });
      trackRef.current.style.left = `${position.x}px`;
      trackRef.current.style.top = `${position.y}px`;
    }
  }, [position.x, position.y, track.id, isPlaying]);

  React.useEffect(() => {
    setPosition(track.position);
  }, [track.position]); 
 
  return (
    <Rnd
      innerRef={trackRef}
      key={track.id}
      size={{ width: trackWidth, height: GRID_CONSTANTS.trackHeight }}
      position={position}
      // position={{ x: position.x, y: position.y }}
      onDragStop={handleDragStop}
      onResize={handleResize}
      onResizeStop={handleResizeStop}
      minWidth={100}
      enableResizing={{
        left: true,
        right: true
      }}
      style={{
        display: 'flex',
        height: GRID_CONSTANTS.trackHeight,
        position: 'absolute',
        borderBottom: `1px solid ${GRID_CONSTANTS.borderColor}`,
        borderRadius: '6px',
        cursor: 'grab',
        zIndex: 1000,
        transition: 'width 0.2s ease',
        background: `linear-gradient(180deg, ${trackColor}80 0%, ${trackColor} 100%)`
      }}
    >
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden', height: '100%', width: '100%' }}>
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
              width={Math.max(initialWaveformWidth, trackWidth)} // Prevent waveform from shrinking
              startOffset={startOffset}
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
                width={Math.max(initialWaveformWidth, trackWidth)} // Prevent waveform from shrinking
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
                width={Math.max(initialWaveformWidth, trackWidth)} // Prevent waveform from shrinking
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
    </Rnd>
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


