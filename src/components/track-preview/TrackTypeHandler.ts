import React from 'react';
import { TrackState } from '../../core/types/track';
import { TrackContentProps } from './TrackContent';

/**
 * Interface for all track type handlers.
 * This provides a consistent interface for different track types.
 */
export interface TrackTypeHandler {
  /**
   * Render the content of the track
   */
  renderContent: (props: TrackContentProps) => React.ReactElement;
  
  /**
   * Handle clicks on the track (not on content)
   */
  handleClick: (track: TrackState) => void;
  
  /**
   * Check if the track is in editing mode
   */
  isEditing?: () => boolean;
  
  /**
   * Set editing mode
   */
  setEditing?: (editing: boolean) => void;
} 