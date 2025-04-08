import React from 'react';
import { getTrackColor } from '../../constants/gridConstants';
import { TrackPreviewProps } from './types';
import AudioTrackPreview from './audio/AudioTrackPreview';
import MidiTrackPreview from './midi/MidiTrackPreview';
import DrumTrackPreview from './drum/DrumTrackPreview';

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
  const { track, trackIndex = 0, trackColor: providedTrackColor } = props;
  const trackColor = providedTrackColor || getTrackColor(trackIndex);
  
  switch(track.type) {
    case 'audio':
      return <AudioTrackPreview {...props} trackColor={trackColor} />;
    case 'midi':
      return <MidiTrackPreview {...props} trackColor={trackColor} />;
    case 'sampler':
      return <MidiTrackPreview {...props} trackColor={trackColor} />;
    case 'drum':
      return <DrumTrackPreview {...props} trackColor={trackColor} />;
    default:
      console.error(`Unknown track type: ${track.type}`);
      return null;
  }
};

export default TrackFactory;