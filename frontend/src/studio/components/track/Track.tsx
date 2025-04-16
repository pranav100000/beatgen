import React, { useCallback, useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { TrackState, Position, DrumTrackState, SamplerTrackState } from '../../core/types/track';
import { useStudioStore } from '../../stores/useStudioStore';
import { usePianoRollStore } from '../../stores/usePianoRollStore';
import TrackFactory from './TrackFactory';
import { TrackResizeAction } from '../../core/state/history/actions/TrackActions';
import { historyManager } from '../../core/state/history/HistoryManager';
import { GRID_CONSTANTS, calculateTrackWidth } from '../../constants/gridConstants';

/**
 * Track component serves as the main entry point for rendering tracks in the timeline.
 * It handles high-level track state management and events, delegating rendering to specialized components.
 */
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
  const updateTrack = useStudioStore(state => state.updateTrack);
  const fullTrack = useStudioStore(state => state.tracks.find(t => t.id === id));
  
  // Directly subscribe to the stored track width and maintain a local state
  const storedWidth = useStudioStore(state => 
    state.tracks.find(t => t.id === id)?._calculatedWidth
  );
  
  // Local state to ensure width persistence during rerenders
  const [trackWidth, setTrackWidth] = useState(_calculatedWidth || 0);
  
  // Sync with store when it changes
  useEffect(() => {
    if (storedWidth !== undefined) {
      setTrackWidth(storedWidth);
    } else if (_calculatedWidth !== undefined) {
      setTrackWidth(_calculatedWidth);
    }
  }, [storedWidth, _calculatedWidth]);
  
  // Get piano roll context
  const { openPianoRoll } = usePianoRollStore();
  
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

  // Handle resize changes including trimming
  const handleResizeEnd = useCallback((trackId: string, newPositionX: number, newWidth: number, resizeDirection: 'left' | 'right') => {
    if (!fullTrack || !store) return;

    // Create a copy of the track for updates
    const updatedTrack = { ...fullTrack };
    
    // Update local width immediately for immediate visual feedback
    setTrackWidth(newWidth);
    
    // IMPORTANT FIX: Always calculate originalDurationTicks - it may be missing
    // Get track duration in ticks
    const ticksPerPixel = store.getTicksPerPixel() || 1;
    
    // If originalDurationTicks is not set, calculate it from the full track width
    if (!updatedTrack.originalDurationTicks) {
      // Calculate from the ORIGINAL full width, not the current width
      const originalWidth = updatedTrack.duration ? 
        calculateTrackWidth(updatedTrack.duration, bpm, timeSignature) : 
        (updatedTrack._calculatedWidth || 0);
        
      updatedTrack.originalDurationTicks = Math.round(originalWidth * ticksPerPixel);
      updatedTrack.trimStartTicks = 0;
      updatedTrack.trimEndTicks = updatedTrack.originalDurationTicks;
      
      console.log(`Initialized original track duration: ${updatedTrack.originalDurationTicks} ticks`);
    }

    // Store old values for history
    const oldTrimStartTicks = updatedTrack.trimStartTicks || 0;
    const oldTrimEndTicks = updatedTrack.trimEndTicks || updatedTrack.originalDurationTicks || 0;
    const oldWidth = updatedTrack._calculatedWidth || 0;
    const oldPositionX = updatedTrack.position.x;
    
    // CRITICAL: Ensure originalDurationTicks is never zero or undefined
    if (!updatedTrack.originalDurationTicks || updatedTrack.originalDurationTicks <= 0) {
      // Fallback to a reasonable value based on current width and ticksPerPixel
      updatedTrack.originalDurationTicks = Math.round((oldWidth || 480) * ticksPerPixel);
      console.warn('Invalid originalDurationTicks, using fallback:', updatedTrack.originalDurationTicks);
    }
    
    if (resizeDirection === 'left') {
      // Calculate trim start ticks based on position change
      const deltaX = newPositionX - fullTrack.position.x;
      const deltaTicks = Math.round(deltaX * ticksPerPixel);
      
      // Update trim values
      updatedTrack.trimStartTicks = Math.max(0, (fullTrack.trimStartTicks || 0) + deltaTicks);
      
      // Ensure we don't trim beyond the track length
      updatedTrack.trimStartTicks = Math.min(
        updatedTrack.trimStartTicks, 
        (updatedTrack.trimEndTicks || updatedTrack.originalDurationTicks || 0) - 1
      );
      
      // Update position and width
      updatedTrack.position = { 
        ...fullTrack.position,
        x: newPositionX
      };
      updatedTrack._calculatedWidth = newWidth;
    } 
    else if (resizeDirection === 'right') {
      // Calculate trim end ticks based on width change
      const newWidthTicks = Math.round(newWidth * ticksPerPixel);
      
      // Update trim values
      updatedTrack.trimEndTicks = Math.min(
        (fullTrack.trimStartTicks || 0) + newWidthTicks,
        updatedTrack.originalDurationTicks || 0
      );
      
      // Ensure we have at least 1 tick of content
      updatedTrack.trimEndTicks = Math.max(
        (updatedTrack.trimStartTicks || 0) + 1,
        updatedTrack.trimEndTicks
      );
      
      // Update width
      updatedTrack._calculatedWidth = newWidth;
    }
    
    // Log trim values for debugging
    console.log('Track trim values updated:', {
      id: trackId,
      direction: resizeDirection,
      originalDurationTicks: updatedTrack.originalDurationTicks,
      trimStartTicks: updatedTrack.trimStartTicks,
      trimEndTicks: updatedTrack.trimEndTicks,
      visualWidth: newWidth,
      calculatedWidth: updatedTrack._calculatedWidth
    });

    // Create and execute the resize action for history tracking
    try {
      // Create the TrackResizeAction directly
      const action = new TrackResizeAction(
        store,
        trackId,
        oldTrimStartTicks,
        oldTrimEndTicks,
        oldWidth,
        oldPositionX,
        updatedTrack.trimStartTicks || 0,
        updatedTrack.trimEndTicks || updatedTrack.originalDurationTicks || 0,
        updatedTrack._calculatedWidth || 0,
        updatedTrack.position.x
      );
      
      // Execute the action through history manager
      historyManager.executeAction(action).then(() => {
        // Update history state buttons
        useStudioStore.setState({
          canUndo: historyManager.canUndo(),
          canRedo: historyManager.canRedo()
        });
      });
    } catch (error) {
      console.error('Failed to create track resize action:', error);
    }
    
    // Update the track in the store immediately for visual feedback
    updateTrack(updatedTrack);
    
    // Update audio engine if this is an audio track
    if (updatedTrack.type === 'audio') {
      const audioEngine = store.getAudioEngine();
      if (audioEngine) {
        // Update trim settings in audio engine
        audioEngine.setTrackTrim?.(
          trackId, 
          updatedTrack.trimStartTicks || 0, 
          updatedTrack.trimEndTicks || updatedTrack.originalDurationTicks || 0
        );
      }
    }
  }, [fullTrack, store, updateTrack, bpm, timeSignature]);

  return (
    <Box 
      onClick={handleTrackClick} 
      sx={{ position: 'relative', cursor: 'pointer' }}
      data-track-id={id}
      data-track-type={type}
    >
      <TrackFactory
        // Pass down props expected by TrackFactory/BaseTrackPreview
        track={fullTrack ? {
          ...fullTrack,
          _calculatedWidth: trackWidth // Ensure the track object has the correct width
        } : {
          name,
          id,
          type: type as 'audio' | 'midi' | 'drum' | 'sampler',
          audioFile,
          position,
          duration,
          _calculatedWidth: trackWidth,
          // Default values if fullTrack not available
          muted: false,
          soloed: false,
          volume: 80,
          pan: 0,
          channel: {} as any
        }}
        isPlaying={isPlaying}
        currentTime={currentTime}
        measureCount={measureCount}
        gridLineStyle={gridLineStyle}
        onPositionChange={handlePositionChange}
        onResizeEnd={handleResizeEnd}
        bpm={bpm}
        timeSignature={timeSignature}
        trackIndex={index}
        trackWidth={trackWidth}
      />
    </Box>
  );
}

export default Track;