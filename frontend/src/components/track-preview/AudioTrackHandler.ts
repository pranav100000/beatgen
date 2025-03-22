import { TrackContentProps, TrackTypeHandler } from './TrackPreviewTypes';
import { TrackState } from '../../core/types/track';
import AudioTrackContent from './AudioTrackContent';
import React from 'react';

export class AudioTrackHandler implements TrackTypeHandler {
  renderContent(props: TrackContentProps): React.ReactElement {
    return React.createElement(AudioTrackContent, props);
  }
  
  handleClick(track: TrackState) {
    console.log('AudioTrackHandler: Opening audio editor for track', track.id);
    // In the future, this would open an audio editor
    // For now, just log the action
  }
} 