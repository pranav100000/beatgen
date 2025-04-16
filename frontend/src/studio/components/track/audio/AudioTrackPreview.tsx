import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { useGridStore } from '../../../core/state/gridStore';
import { calculateAudioTrackWidth } from '../../../utils/trackWidthCalculators';
import { getTrackColor } from '../../../constants/gridConstants';
import BaseTrackPreview from '../base/BaseTrackPreview';
import WaveformDisplay from '../WaveformDisplay';
import { TrackPreviewProps } from '../types';

/**
 * AudioTrackPreview is a specialized track component for audio tracks.
 * It provides audio-specific visualization with waveform display and
 * handles audio track width calculations based on audio duration and BPM.
 */

export const AudioTrackPreview: React.FC<TrackPreviewProps> = (props) => {
  const { 
    track, 
    bpm, 
    trackIndex = 0,
    trackColor: providedTrackColor,
    trackWidth: providedTrackWidth,
    onResizeEnd,
    ...restProps 
  } = props;
  
  const audioMeasureWidth = useGridStore(state => state.audioMeasureWidth);
  const trackColor = providedTrackColor || getTrackColor(trackIndex);
  
  // Only calculate width if not provided (for new tracks)
  // Otherwise use the provided width to prevent snapping back
  const trackWidth = useMemo(() => {
    // If a width is explicitly provided, use it - this is critical for resize operations
    if (providedTrackWidth && providedTrackWidth > 0) {
      return providedTrackWidth;
    }
    
    // Only calculate if we don't have an explicit width
    return calculateAudioTrackWidth(
      track.duration || 8, // Default to 8 seconds if no duration specified
      bpm,
      audioMeasureWidth
    );
  }, [track.duration, bpm, audioMeasureWidth, providedTrackWidth]);
  
  // Audio-specific track content rendering
  const renderTrackContent = () => {
    if (track.audioFile) {
      return (
        <WaveformDisplay 
          audioFile={track.audioFile}
          trackColor={trackColor}
          duration={track.duration || 0}
          width={trackWidth}
        />
      );
    } else {
      // Placeholder waveform for tracks without audio files
      return Array.from({length: 40}).map((_, i) => (
        <Box 
          key={i} 
          sx={{
            height: Math.sin(i * 0.3) * 10 + 10,
            width: 2,
            bgcolor: 'rgba(255,255,255,0.7)',
            mx: 0.2
          }}
        />
      ));
    }
  };
  
  return (
    <BaseTrackPreview
      {...restProps}
      track={track}
      trackWidth={trackWidth}
      trackColor={trackColor}
      bpm={bpm}
      renderTrackContent={renderTrackContent}
      trackIndex={trackIndex}
      onResizeEnd={onResizeEnd}
    />
  );
};

export default React.memo(AudioTrackPreview);