import { Position } from '../../core/types/track';
import { TrackState } from '../../core/types/track';
import React from 'react';
import { Note } from '../../core/types/note';

// Common props for all track previews
export interface TrackPreviewProps {
  track: TrackState;
  isPlaying: boolean;
  currentTime: number;
  measureCount: number;
  gridLineStyle: { borderRight: string };
  onPositionChange: (newPosition: Position, isDragEnd: boolean) => void;
  bpm: number; // Project-wide BPM value
  timeSignature?: [number, number]; // Project-wide time signature
  trackIndex?: number; // Index to determine track color
}

// Props for the base track preview component
export interface BaseTrackPreviewProps extends TrackPreviewProps {
  renderContent: (props: TrackContentProps) => React.ReactElement;
  onTrackClick: (track: TrackState) => void;
}

// Specific props for content rendering
export interface TrackContentProps {
  track: TrackState;
  isPlaying: boolean;
  currentTime: number;
  measureCount: number;
  trackWidth: number | string;
  bpm: number; // Pass BPM to content renderers
  timeSignature?: [number, number]; // Pass time signature to content renderers
  notes?: Note[]; // Optional MIDI notes for MIDI tracks
  trackId?: string; // Track ID for registration
  registerRerenderCallback?: (callback: () => void) => (() => void); // For registering re-render callbacks
  trackColor?: string; // Color for track elements
}

// Interface for track-specific behavior
export interface TrackTypeHandler {
  renderContent(props: TrackContentProps): React.ReactElement;
  handleClick(track: TrackState): void;
} 