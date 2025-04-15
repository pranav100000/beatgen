import React, { useCallback } from 'react';
import { Box } from '@mui/material';
import { TrackState, Position, DrumTrackState, SamplerTrackState } from '../../core/types/track';
import { useStudioStore } from '../../stores/useStudioStore';
import { usePianoRollStore } from '../../stores/usePianoRollStore';
import TrackFactory from './TrackFactory';

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

  // Get the necessary actions from stores
  const track = useStudioStore(useCallback(state => state.tracks.find(t => t.id === id), [id]));
  const openDrumMachine = useStudioStore(state => state.openDrumMachine); // <-- Get drum machine opener
  const { openPianoRoll } = usePianoRollStore();

  // Log the selected track data, especially the drumPattern
  console.log(`Track ${id}: Selected track data from store:`, track); 
  
  // Handle track click based on type
  const handleTrackClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    
    if (type === 'drum') {
      console.log('Drum track clicked - opening Drum Machine for:', id);
      openDrumMachine(id); // <-- Call drum machine opener
    } else if (type === 'midi' || type === 'sampler') {
      console.log('MIDI/Sampler track clicked - opening Piano Roll for:', id);
      openPianoRoll(id); // <-- Call piano roll opener
    }
    // Audio tracks currently do nothing on click
  };

  // Handle position changes
  const handlePositionChange = (trackId: string, newPosition: Position, isDragEnd: boolean) => {
    props.onPositionChange(newPosition, isDragEnd);
  };
  
  // If trackState couldn't be constructed, don't render
  if (!track) {
      console.warn(`Track component: Could not find track data in store for id: ${id}`);
      return null; 
  }

  return (
    <Box 
      onClick={handleTrackClick} 
      sx={{ position: 'relative', cursor: 'pointer' }}
      data-track-id={id}
      data-track-type={type}
    >
      <TrackFactory
        // Pass down props expected by TrackFactory/BaseTrackPreview
        track={track}
        isPlaying={props.isPlaying}
        currentTime={props.currentTime}
        measureCount={props.measureCount}
        gridLineStyle={props.gridLineStyle}
        onPositionChange={handlePositionChange} // Ensure this uses the correct signature if needed by BaseTrackPreview
        bpm={props.bpm}
        timeSignature={props.timeSignature}
        trackIndex={props.index}
        trackWidth={track._calculatedWidth ?? 0} // <-- Pass trackWidth separately
        // BaseTrackPreview requires trackColor which is handled by TrackFactory
      />
    </Box>
  );
}

export default Track;