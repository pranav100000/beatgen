import React from 'react';
import { Box } from '@mui/material';
import { Position } from '../core/types/track';
import TrackPreview from './track-preview/TrackPreview';
import { useStudioStore } from '../stores/useStudioStore';
import { usePianoRoll } from './piano-roll';

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
    console.log('Track clicked', {
      target: e.target,
      trackId: id,
      type,
      eventType: e.type
    });
    
    // For MIDI and drum tracks, directly open the piano roll
    if (type === 'midi' || type === 'drum') {
      e.stopPropagation();
      console.log('Opening piano roll for track:', {
        trackId: id,
        type
      });
      openPianoRoll(id);
    } else {
      console.log('Not opening piano roll - track type is not midi or drum:', type);
    }
  };

  // Add console log to debug position changes
  const handlePositionChange = (trackId: string, newPosition: Position, isDragEnd: boolean) => {
    console.log("Track: Position change called", {
      trackId,
      newPosition,
      oldPosition: position,
      isDragEnd
    });
    
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
      <TrackPreview
        track={trackState}
        isPlaying={isPlaying}
        currentTime={currentTime}
        measureCount={measureCount}
        gridLineStyle={gridLineStyle}
        onPositionChange={handlePositionChange}
        bpm={bpm}
        timeSignature={timeSignature}
        trackIndex={index} // Pass the track index for color determination
      />
    </Box>
  );
}

export default Track;