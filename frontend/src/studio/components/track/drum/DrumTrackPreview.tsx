import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import { useStudioStore } from '../../../stores/studioStore';
import { RootState, CombinedTrack, SamplerTrackRead, NoteState } from '../../../stores/types';
import { useGridStore } from '../../../core/state/gridStore';
import { GRID_CONSTANTS, getTrackColor } from '../../../constants/gridConstants';
import { calculateMidiTrackWidth } from '../../../utils/trackWidthCalculators';
import BaseTrackPreview from '../base/BaseTrackPreview';
import { TrackPreviewProps } from '../types';
import DrumGridPreview from './DrumGridPreview';
import { MUSIC_CONSTANTS } from '../../../constants/musicConstants';

const TICKS_PER_STEP = MUSIC_CONSTANTS.pulsesPerQuarterNote / 4;
const MAX_COLUMNS = 64;

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
  
  const tracks = useStudioStore((state: RootState) => state.tracks);

  const midiMeasureWidth = useGridStore(state => state.midiMeasurePixelWidth);
  const trackColor = providedTrackColor || getTrackColor(trackIndex);
  
  if (track.type !== 'drum') {
    console.error('DrumTrackPreview received non-drum track:', track);
    return null;
  }
  
  const drumTrackId = track.id;

  const associatedSamplerTracks = useMemo(() => {
    if (!Array.isArray(tracks)) return [];
    return tracks
      .filter((t): t is CombinedTrack & { track: SamplerTrackRead } => 
          t.type === 'sampler' && 
          typeof t.track === 'object' && 
          t.track !== null && 
          'drum_track_id' in t.track && 
          t.track.drum_track_id === drumTrackId
      )
      .map(t => t.track as SamplerTrackRead);
  }, [tracks, drumTrackId]);

  const [localPattern, setLocalPattern] = useState<boolean[][]>([]);

  useEffect(() => {
    const handlePatternChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ trackId: string; pattern: boolean[][] }>; 
      if (customEvent.detail?.trackId === drumTrackId && customEvent.detail.pattern) {
        console.log(`DrumTrackPreview (${drumTrackId}): Received pattern from event.`);
        setLocalPattern(customEvent.detail.pattern);
      }
    };

    document.addEventListener('drumPatternChanged', handlePatternChange);
    console.log(`DrumTrackPreview (${drumTrackId}): Added drumPatternChanged listener.`);

    return () => {
      document.removeEventListener('drumPatternChanged', handlePatternChange);
      console.log(`DrumTrackPreview (${drumTrackId}): Removed drumPatternChanged listener.`);
    };
  }, [drumTrackId]);

  const derivedPattern = useMemo(() => localPattern, [localPattern]);
  
  const trackWidth = useMemo(() => {
    if (providedTrackWidth && providedTrackWidth > 0) {
      return providedTrackWidth;
    }
    
    const measures = 4;
    const beatsPerMeasure = timeSignature[0];
    const beatWidth = midiMeasureWidth / beatsPerMeasure;
    return measures * beatsPerMeasure * beatWidth;
  }, [timeSignature, midiMeasureWidth, providedTrackWidth]);
  
  const fullContentWidth = useMemo(() => {
    const measures = 4;
    const beatsPerMeasure = timeSignature[0];
    const beatWidth = midiMeasureWidth / beatsPerMeasure;
    return measures * beatsPerMeasure * beatWidth;
  }, [timeSignature, midiMeasureWidth]);
  
  const renderTrackContent = () => {
    return (
      <DrumGridPreview 
        pattern={derivedPattern}
        width={fullContentWidth}
        height={GRID_CONSTANTS.trackHeight - 6}
        trackColor={trackColor}
      />
    );
  };
  
  console.log(`DrumTrackPreview (${track.id}): Rendering with derived pattern:`, derivedPattern);
  
  return (
    <BaseTrackPreview
      {...restProps}
      track={track}
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