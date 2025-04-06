# Detailed Track Component Refactoring Plan (Functional Approach)

## Phase 1: Core Architecture

### Step 1: Create `BaseTrackPreview.tsx`

```typescript
// src/studio/components/track/base/BaseTrackPreview.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { GRID_CONSTANTS } from '../../../constants/gridConstants';
import { Position, TrackState } from '../../../core/types/track';

export interface BaseTrackPreviewProps {
  // Common track props
  track: TrackState;
  isPlaying: boolean;
  currentTime: number;
  measureCount: number;
  gridLineStyle: { borderRight: string };
  onPositionChange: (trackId: string, newPosition: Position, isDragEnd: boolean) => void;
  bpm: number;
  timeSignature?: [number, number];
  trackIndex?: number;
  trackColor: string;
  
  // Style overrides & extensions
  trackStyleOverrides?: React.CSSProperties;
  
  // Content rendering strategy
  renderTrackContent: () => React.ReactNode;
  
  // Track width calculation strategy
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
```

## Phase 2: Type-Specific Track Components

### Step 2: Create AudioTrackPreview Component

```typescript
// src/studio/components/track/audio/AudioTrackPreview.tsx

import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { useGridStore } from '../../../core/state/gridStore';
import { calculateAudioTrackWidth } from '../../../utils/trackWidthCalculators';
import { getTrackColor } from '../../../constants/gridConstants';
import BaseTrackPreview from '../base/BaseTrackPreview';
import WaveformDisplay from '../WaveformDisplay';
import { TrackPreviewProps } from '../types';

export const AudioTrackPreview: React.FC<TrackPreviewProps> = (props) => {
  const { 
    track, 
    bpm, 
    trackIndex = 0,
    ...restProps 
  } = props;
  
  const audioMeasureWidth = useGridStore(state => state.audioMeasureWidth);
  const trackColor = getTrackColor(trackIndex);
  
  // Calculate audio track width
  const trackWidth = useMemo(() => calculateAudioTrackWidth(
    track.duration || 8, // Default to 8 seconds if no duration specified
    bpm,
    audioMeasureWidth
  ), [track.duration, bpm, audioMeasureWidth]);
  
  // Audio-specific track content rendering
  const renderTrackContent = () => {
    if (track.audioFile) {
      return (
        <WaveformDisplay 
          audioFile={track.audioFile}
          trackColor={trackColor}
          duration={track.duration || 0}
          width={trackWidth}
        />
      );
    } else {
      // Placeholder waveform for tracks without audio files
      return Array.from({length: 40}).map((_, i) => (
        <Box 
          key={i} 
          sx={{
            height: Math.sin(i * 0.3) * 10 + 10,
            width: 2,
            bgcolor: 'rgba(255,255,255,0.7)',
            mx: 0.2
          }}
        />
      ));
    }
  };
  
  return (
    <BaseTrackPreview
      {...restProps}
      track={track}
      trackWidth={trackWidth}
      trackColor={trackColor}
      bpm={bpm}
      renderTrackContent={renderTrackContent}
      trackIndex={trackIndex}
    />
  );
};

export default React.memo(AudioTrackPreview);
```

### Step 3: Create MidiTrackPreview Component

```typescript
// src/studio/components/track/midi/MidiTrackPreview.tsx

import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { useGridStore } from '../../../core/state/gridStore';
import { GRID_CONSTANTS, getTrackColor } from '../../../constants/gridConstants';
import { calculateMidiTrackWidth } from '../../../utils/trackWidthCalculators';
import { usePianoRoll } from '../../piano-roll/context/PianoRollContext';
import MidiNotesPreview from '../../piano-roll/components/MidiNotesPreview';
import BaseTrackPreview from '../base/BaseTrackPreview';
import { TrackPreviewProps } from '../types';

export const MidiTrackPreview: React.FC<TrackPreviewProps> = (props) => {
  const { 
    track, 
    timeSignature = [4, 4],
    trackIndex = 0,
    ...restProps
  } = props;
  
  const midiMeasureWidth = useGridStore(state => state.midiMeasureWidth);
  const trackColor = getTrackColor(trackIndex);
  
  // Get notes from PianoRoll context
  const { getNotesForTrack } = usePianoRoll();
  const trackNotes = getNotesForTrack(track.id);
  
  // Calculate MIDI track width
  const trackWidth = useMemo(() => calculateMidiTrackWidth(
    trackNotes,
    timeSignature,
    midiMeasureWidth
  ), [trackNotes, timeSignature, midiMeasureWidth]);
  
  // MIDI-specific track content rendering
  const renderTrackContent = () => (
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
          zIndex: 100,
          opacity: 0.3,
          backgroundColor: 'rgba(0, 100, 255, 0.1)',
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.3)'
          }
        }}
      />
      <MidiNotesPreview 
        trackId={track.id}
        width={trackWidth}
        height={GRID_CONSTANTS.trackHeight - 6}
        trackColor={trackColor}
      />
    </>
  );
  
  return (
    <BaseTrackPreview
      {...restProps}
      track={track}
      trackWidth={trackWidth}
      trackColor={trackColor}
      timeSignature={timeSignature}
      renderTrackContent={renderTrackContent}
      trackIndex={trackIndex}
    />
  );
};

export default React.memo(MidiTrackPreview);
```

### Step 4: Create DrumTrackPreview Component

```typescript
// src/studio/components/track/drum/DrumTrackPreview.tsx

import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { useGridStore } from '../../../core/state/gridStore';
import { GRID_CONSTANTS, getTrackColor } from '../../../constants/gridConstants';
import { calculateMidiTrackWidth } from '../../../utils/trackWidthCalculators';
import { usePianoRoll } from '../../piano-roll/context/PianoRollContext';
import MidiNotesPreview from '../../piano-roll/components/MidiNotesPreview';
import BaseTrackPreview from '../base/BaseTrackPreview';
import { TrackPreviewProps } from '../types';

export const DrumTrackPreview: React.FC<TrackPreviewProps> = (props) => {
  const { 
    track, 
    timeSignature = [4, 4],
    trackIndex = 0,
    ...restProps
  } = props;
  
  const midiMeasureWidth = useGridStore(state => state.midiMeasureWidth);
  const trackColor = getTrackColor(trackIndex);
  
  // Get notes from PianoRoll context
  const { getNotesForTrack } = usePianoRoll();
  const trackNotes = getNotesForTrack(track.id);
  
  // Calculate drum track width (use same function as MIDI)
  const trackWidth = useMemo(() => calculateMidiTrackWidth(
    trackNotes,
    timeSignature,
    midiMeasureWidth
  ), [trackNotes, timeSignature, midiMeasureWidth]);
  
  // Drum-specific track content rendering
  const renderTrackContent = () => (
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
          opacity: 0.1,
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.15)'
          }
        }}
      />
      <MidiNotesPreview 
        trackId={track.id}
        width={trackWidth}
        height={GRID_CONSTANTS.trackHeight - 6}
        trackColor={trackColor}
      />
    </>
  );
  
  return (
    <BaseTrackPreview
      {...restProps}
      track={track}
      trackWidth={trackWidth}
      trackColor={trackColor}
      timeSignature={timeSignature}
      renderTrackContent={renderTrackContent}
      trackIndex={trackIndex}
    />
  );
};

export default React.memo(DrumTrackPreview);
```

### Step 5: Create Shared Types

```typescript
// src/studio/components/track/types.ts

import { TrackState, Position } from '../../core/types/track';

export interface TrackPreviewProps {
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
```

## Phase 3: Integration

### Step 6: Create TrackFactory to Handle Track Type Selection

```typescript
// src/studio/components/track/TrackFactory.tsx

import React from 'react';
import { getTrackColor } from '../../constants/gridConstants';
import { TrackPreviewProps } from './types';
import AudioTrackPreview from './audio/AudioTrackPreview';
import MidiTrackPreview from './midi/MidiTrackPreview';
import DrumTrackPreview from './drum/DrumTrackPreview';

/**
 * Factory component that renders the appropriate track component based on track type
 */
export const TrackFactory: React.FC<TrackPreviewProps> = (props) => {
  const { track, trackIndex = 0 } = props;
  const trackColor = getTrackColor(trackIndex);
  
  switch(track.type) {
    case 'audio':
      return <AudioTrackPreview {...props} trackColor={trackColor} />;
    case 'midi':
      return <MidiTrackPreview {...props} trackColor={trackColor} />;
    case 'drum':
      return <DrumTrackPreview {...props} trackColor={trackColor} />;
    default:
      console.error(`Unknown track type: ${track.type}`);
      return null;
  }
};

export default TrackFactory;
```

### Step 7: Update the Track Component to Use the New Components

```typescript
// src/studio/components/track/Track.tsx

import React from 'react';
import { Box } from '@mui/material';
import { Position } from '../../core/types/track';
import { useStudioStore } from '../../stores/useStudioStore';
import { usePianoRoll } from '../piano-roll';
import TrackFactory from './TrackFactory';

interface TrackProps {
  name: string;
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
  bpm: number;
  duration?: number;
  _calculatedWidth?: number;
  timeSignature?: [number, number];
}

function Track(props: TrackProps) {
  const { 
    name,
    id, 
    type, 
    audioFile, 
    isPlaying, 
    currentTime, 
    measureCount, 
    gridLineStyle,
    position,
    onPositionChange,
    bpm,
    duration,
    _calculatedWidth,
    index,
    timeSignature = [4, 4]
  } = props;

  // Get the store from Zustand
  const store = useStudioStore(state => state.store);
  const fullTrack = store?.getTrackById?.(id);
  
  // Get piano roll context
  const { openPianoRoll } = usePianoRoll();
  
  // Convert the props to the format expected by TrackPreview
  const trackState = {
    name,
    id,
    type: type as 'audio' | 'midi' | 'drum',
    audioFile,
    position,
    duration,
    _calculatedWidth,
    // Get actual values from the store if available, otherwise use defaults
    muted: fullTrack?.muted ?? false,
    soloed: fullTrack?.soloed ?? false,
    volume: fullTrack?.volume ?? 80,
    pan: fullTrack?.pan ?? 0,
    channel: fullTrack?.channel ?? ({} as any)
  };

  // Handle piano roll opening when track is clicked
  const handleTrackClick = (e: React.MouseEvent) => {
    // For MIDI and drum tracks, directly open the piano roll
    if (type === 'midi' || type === 'drum') {
      e.stopPropagation();
      openPianoRoll(id);
    }
  };

  // Handle position changes
  const handlePositionChange = (trackId: string, newPosition: Position, isDragEnd: boolean) => {
    // Call the callback properly
    onPositionChange(newPosition, isDragEnd);
  };

  return (
    <Box 
      onClick={handleTrackClick} 
      sx={{ 
        position: 'relative',
        cursor: 'pointer'
      }}
      data-track-id={id}
      data-track-type={type}
    >
      <TrackFactory
        track={trackState}
        isPlaying={isPlaying}
        currentTime={currentTime}
        measureCount={measureCount}
        gridLineStyle={gridLineStyle}
        onPositionChange={handlePositionChange}
        bpm={bpm}
        timeSignature={timeSignature}
        trackIndex={index}
      />
    </Box>
  );
}

export default Track;
```

## Phase 4: Testing & Cleanup

### Step 8: Create Unit Tests for Each Component

```typescript
// src/studio/components/track/base/__tests__/BaseTrackPreview.test.tsx
// src/studio/components/track/audio/__tests__/AudioTrackPreview.test.tsx
// src/studio/components/track/midi/__tests__/MidiTrackPreview.test.tsx
// src/studio/components/track/drum/__tests__/DrumTrackPreview.test.tsx
// src/studio/components/track/__tests__/TrackFactory.test.tsx
// src/studio/components/track/__tests__/Track.test.tsx
```

### Step 9: Create Directory Structure

```
/components/track/
├── Track.tsx (mostly unchanged)
├── TrackFactory.tsx (new)
├── types.ts (new)
├── base/
│   └── BaseTrackPreview.tsx (shared functionality)
├── audio/
│   └── AudioTrackPreview.tsx
├── midi/
│   └── MidiTrackPreview.tsx 
├── drum/
│   └── DrumTrackPreview.tsx
└── WaveformDisplay.tsx (unchanged)
```

### Step 10: Final Cleanup Tasks

1. Remove the original `TrackPreview.tsx` file once everything is working
2. Remove all remaining console.log statements
3. Delete commented-out code (like grid indicator functionality)
4. Ensure all components have proper JSDoc documentation
5. Run linting and fix any issues

## Implementation Strategy

1. Start with creating BaseTrackPreview with basic drag-and-drop functionality
2. Implement AudioTrackPreview first (simplest case)
3. Create and test MidiTrackPreview and DrumTrackPreview
4. Implement the TrackFactory and update Track.tsx
5. Test all combinations thoroughly
6. Clean up and eliminate the original implementation

## Benefits of This Refactoring

1. **Better Separation of Concerns**
   - Each track type has its own dedicated component
   - Common functionality is centralized in BaseTrackPreview
   - Easier to understand and maintain

2. **Improved Performance**
   - More targeted component updates with React.memo and optimized dependencies
   - Cleaner rendering logic with specialized components

3. **Enhanced Maintainability**
   - Easier to add new track types in the future
   - Better organization with a clear component hierarchy
   - Reduced complexity in each individual component

4. **Better TypeScript Support**
   - More specific typing for each component
   - Clearer interfaces between components

5. **Testability**
   - Smaller units that are easier to test
   - Clear responsibilities make mocking dependencies simpler

This plan follows a functional component approach using React hooks, composition, and strategy patterns to achieve a clean, maintainable, and type-safe implementation.