import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { useGridStore } from '../../../core/state/gridStore';
import { GRID_CONSTANTS, getTrackColor } from '../../../constants/gridConstants';
import { calculateMidiTrackWidth } from '../../../utils/trackWidthCalculators';
import { useStudioStore } from '../../../stores/useStudioStore';
import MidiNotesPreview from '../../piano-roll/components/MidiNotesPreview';
import BaseTrackPreview from '../base/BaseTrackPreview';
import { TrackPreviewProps } from '../types';
import DrumGridPreview from './DrumGridPreview';
import { DrumTrack } from '../../../../types/track';

/**
 * DrumTrackPreview is a specialized track component for drum tracks.
 * It extends MIDI functionality but provides drum-specific styling and interaction.
 * Uses the same width calculation as MIDI tracks but displays drum hits differently.
 * Includes a trigger area to open the piano roll editor in drum mode.
 */

export const DrumTrackPreview: React.FC<TrackPreviewProps> = (props) => {
  const { 
    track, 
    timeSignature = [4, 4],
    trackIndex = 0,
    trackColor: providedTrackColor,
    trackWidth: providedTrackWidth,
    onResizeEnd,
    ...restProps
  } = props;
  
  const midiMeasureWidth = useGridStore(state => state.midiMeasurePixelWidth);
  const trackColor = providedTrackColor || getTrackColor(trackIndex);
  
  // Type guard to ensure this is a drum track
  if (track.type !== 'drum') {
    console.error('DrumTrackPreview received non-drum track:', track);
    return null; // Or render a placeholder error
  }
  
  // Explicitly cast track to DrumTrackState after the guard
  const drumTrack = track as DrumTrack;
  
  // Get the drum pattern directly from the casted track state
  const drumPattern = drumTrack.drumPattern;
  
  // Calculate display width for the track container (viewport)
  const trackWidth = useMemo(() => {
    // If a width is explicitly provided, use it - this is critical for resize operations
    if (providedTrackWidth && providedTrackWidth > 0) {
      return providedTrackWidth;
    }
    
    // Otherwise, calculate width equivalent to 4 measures (default for new tracks)
    const measures = 4;
    const beatsPerMeasure = timeSignature[0];
    const beatWidth = midiMeasureWidth / beatsPerMeasure;
    return measures * beatsPerMeasure * beatWidth;
  }, [timeSignature, midiMeasureWidth, providedTrackWidth]);
  
  // Calculate full content width - this should NEVER change due to trimming
  // This is the standard full width for drum patterns (4 measures)
  const fullContentWidth = useMemo(() => {
    const measures = 4;
    const beatsPerMeasure = timeSignature[0];
    const beatWidth = midiMeasureWidth / beatsPerMeasure;
    return measures * beatsPerMeasure * beatWidth;
  }, [timeSignature, midiMeasureWidth]);
  
  // Drum-specific track content rendering
  const renderTrackContent = () => {
    return (
      <>
        {/* DrumGridPreview is always rendered at full content width, 
            but only part of it is visible through the trimmed container */}
        <DrumGridPreview 
          pattern={drumPattern}
          width={fullContentWidth} // Always use the full content width
          height={GRID_CONSTANTS.trackHeight - 6}
          trackColor={trackColor}
        />
      </>
    );
  };
  
  console.log(`DrumTrackPreview: Rendering for track ${track.id}, pattern:`, drumPattern);
  
  return (
    <BaseTrackPreview
      {...restProps}
      track={drumTrack}
      trackWidth={trackWidth}
      contentWidth={fullContentWidth}
      trackColor={trackColor}
      timeSignature={timeSignature}
      renderTrackContent={renderTrackContent}
      trackIndex={trackIndex}
      onResizeEnd={onResizeEnd}
    />
  );
};

export default DrumTrackPreview;