import React from 'react';
import { getTrackColor } from '../../constants/gridConstants';
import { TrackPreviewProps } from './types';
import AudioTrackPreview from './audio/AudioTrackPreview';
import MidiTrackPreview from './midi/MidiTrackPreview';
import DrumTrackPreview from './drum/DrumTrackPreview';
import { TrackState } from '../../core/types/track';

/**
 * TrackFactory is responsible for creating the appropriate track component
 * based on the track type. It follows the factory pattern to instantiate
 * the correct specialized component (Audio, MIDI, or Drum) while maintaining
 * a consistent interface for the parent Track component.
 * 
 * This allows the Track component to work with any track type without
 * knowing the internal implementation details of each specialized track component.
 */
export const TrackFactory: React.FC<TrackPreviewProps> = (props) => {
  const { track, trackIndex = 0, trackColor: providedTrackColor, onResizeEnd } = props;
  const trackColor = providedTrackColor || getTrackColor(trackIndex);
  
  // Ensure track exists
  if (!track) {
    console.error('TrackFactory received null or undefined track');
    return null;
  }
  
  // This property access can't be directly checked due to TypeScript limitations
  // So we'll use a type assertion, but fallback gracefully if it's undefined
  const trackType = track['type'] as string | undefined;
  
  if (!trackType) {
    console.error('TrackFactory received track with missing type:', track);
    return null;
  }
  
  switch(trackType) {
    case 'audio':
      return <AudioTrackPreview {...props} trackColor={trackColor} onResizeEnd={onResizeEnd} />;
    case 'midi':
      return <MidiTrackPreview {...props} trackColor={trackColor} onResizeEnd={onResizeEnd} />;
    case 'sampler':
      return <MidiTrackPreview {...props} trackColor={trackColor} onResizeEnd={onResizeEnd} />;
    case 'drum':
      return <DrumTrackPreview {...props} trackColor={trackColor} onResizeEnd={onResizeEnd} />;
    default:
      console.error(`Unknown track type: ${trackType}`);
      return null;
  }
};

export default TrackFactory;