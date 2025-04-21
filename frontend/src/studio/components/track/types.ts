import { TrackState } from '../../../types/track';

/**
 * Common props interface shared by all track preview components.
 * Each specialized component may extend this with additional props.
 */

export interface Position {
  x: number;
  y: number;
}

export interface TrackPreviewProps {
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
  
  /** Callback when track is resized */
  onResizeEnd?: (trackId: string, trimDeltaPixels: number, resizeDirection: 'left' | 'right') => void;
  
  /** Current project BPM */
  bpm: number;
  
  /** Time signature as [beats, beatUnit] */
  timeSignature?: [number, number];
  
  /** Track index for color determination */
  trackIndex?: number;
  
  /** Optional color override for track visualization */
  trackColor?: string;
  
  /** Calculated width for the track preview in pixels */
  trackWidth: number;
}