/**
 * @deprecated This file is a compatibility layer for the refactored track components.
 * Please import from 'track/TrackFactory' directly instead.
 */

import React from 'react';
import { TrackState, Position } from '../../core/types/track';
import TrackFactory from './TrackFactory';

// Re-export the old props interface for backward compatibility
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

/**
 * @deprecated Please use TrackFactory directly
 */
const TrackPreview: React.FC<TrackPreviewProps> = props => {
  console.warn(
    'TrackPreview is deprecated and will be removed in a future version. ' +
    'Please use the TrackFactory component instead.'
  );

  return <TrackFactory {...props} />;
};

export default TrackPreview;