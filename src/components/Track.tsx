import React from 'react';
import { Position } from '../core/types/track';
import TrackPreview from './track-preview/TrackPreview';

interface TrackProps {
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
}

// Updated Track component that simply passes props to the new TrackPreview
function Track(props: TrackProps) {
  const { 
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
    index
  } = props;

  // Convert the props to the format expected by TrackPreview
  const trackState = {
    id,
    type: type as 'audio' | 'midi' | 'video',
    audioFile,
    position,
    duration,
    _calculatedWidth,
    // Add other required props with default values
    name: `Track ${id}`,
    muted: false,
    soloed: false,
    volume: 0,
    pan: 0,
    channel: {} as any // This is a placeholder
  };

  return (
    <TrackPreview
      track={trackState}
      isPlaying={isPlaying}
      currentTime={currentTime}
      measureCount={measureCount}
      gridLineStyle={gridLineStyle}
      onPositionChange={onPositionChange}
      bpm={bpm}
    />
  );
}

export default Track; 