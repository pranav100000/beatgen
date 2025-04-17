import React, { useCallback, useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { Position } from '../../core/types/track';
import { useStudioStore } from '../../stores/useStudioStore';
import { usePianoRollStore } from '../../stores/usePianoRollStore';
import TrackFactory from './TrackFactory';
import { TrackResizeAction } from '../../core/state/history/actions/TrackActions';
import { historyManager } from '../../core/state/history/HistoryManager';
import { GRID_CONSTANTS, calculateTrackWidth, pixelsToTicks, ticksToPixels } from '../../constants/gridConstants';
import { MUSIC_CONSTANTS } from '../../constants/musicConstants';

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
  const openDrumMachine = useStudioStore(state => state.openDrumMachine); // <-- Get drum machine opener
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
    if (type === 'drum') {
      console.log('Drum track clicked - opening Drum Machine for:', id);
      openDrumMachine(id); // <-- Call drum machine opener
    } else if (type === 'midi' || type === 'sampler') {
      console.log('MIDI/Sampler track clicked - opening Piano Roll for:', id);
      openPianoRoll(id); // <-- Call piano roll opener
    }
  };

  // Handle position changes
  const handlePositionChange = (trackId: string, newPosition: Position, isDragEnd: boolean) => {
    // Call the callback properly
    onPositionChange(newPosition, isDragEnd);
  };

  // Handle resize changes including trimming
  const handleResizeEnd = useCallback((trackId: string, deltaPixels: number, resizeDirection: 'left' | 'right') => {
    if (!fullTrack || !store) return;

    console.log('deltaPixels', deltaPixels);
    console.log('resizeDirection', resizeDirection);

    // Create a copy of the track for updates
    const updatedTrack = { ...fullTrack };
    
    // Calculate the old trim value in ticks
    const oldTrimTicks = resizeDirection === 'left' 
      ? (fullTrack.trimStartTicks || 0) 
      : (fullTrack.trimEndTicks || 0);
    
    // The current visual width
    const oldWidth = updatedTrack._calculatedWidth || 0;
    
    // Calculate new width based on the delta in pixels
    const newWidth = resizeDirection === 'left' ? oldWidth - deltaPixels : oldWidth + deltaPixels;
    
    // Update calculated width for visual display
    updatedTrack._calculatedWidth = newWidth;
    
    // Convert the pixel delta to tick delta for storage
    const deltaTicks = pixelsToTicks(deltaPixels, bpm, timeSignature);
    
    // Store old values for history
    const oldTrimStartTicks = updatedTrack.trimStartTicks || 0;
    const oldTrimEndTicks = updatedTrack.trimEndTicks || 0;
    const oldPositionX = updatedTrack.position.x;
    
    // Update the appropriate trim value based on resize direction
    if (resizeDirection === 'left') {
      updatedTrack.trimStartTicks = oldTrimTicks + deltaTicks;
      updatedTrack.position.x = updatedTrack.position.x + deltaTicks;
    } else if (resizeDirection === 'right') {
      updatedTrack.trimEndTicks = oldTrimTicks + deltaTicks;
    }
    
    // Create and execute a resize action for history tracking
    try {
      const action = new TrackResizeAction(
        store,
        trackId,
        oldTrimStartTicks,
        oldTrimEndTicks,
        oldWidth,
        oldPositionX,
        updatedTrack.trimStartTicks || 0,
        updatedTrack.trimEndTicks || 0,
        newWidth,
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
    
    // Update local state and track data
    setTrackWidth(newWidth);
    updateTrack(updatedTrack);
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