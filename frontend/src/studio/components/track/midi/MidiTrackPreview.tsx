import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { useGridStore } from '../../../core/state/gridStore';
import { GRID_CONSTANTS, getTrackColor } from '../../../constants/gridConstants';
import { calculateMidiTrackWidth } from '../../../utils/trackWidthCalculators';
import { usePianoRoll } from '../../piano-roll/context/PianoRollContext';
import MidiNotesPreview from '../../piano-roll/components/MidiNotesPreview';
import BaseTrackPreview from '../base/BaseTrackPreview';
import { TrackPreviewProps } from '../types';

/**
 * MidiTrackPreview is a specialized track component for MIDI tracks.
 * It provides MIDI-specific visualization with note previews and
 * handles MIDI track width calculations based on note positions and time signature.
 * Includes a trigger area to open the piano roll editor.
 */

export const MidiTrackPreview: React.FC<TrackPreviewProps> = (props) => {
  const { 
    track, 
    timeSignature = [4, 4],
    trackIndex = 0,
    trackColor: providedTrackColor,
    ...restProps
  } = props;
  
  const midiMeasureWidth = useGridStore(state => state.midiMeasureWidth);
  const trackColor = providedTrackColor || getTrackColor(trackIndex);
  
  // Get notes from PianoRoll context
  const { getNotesForTrack } = usePianoRoll();
  const trackNotes = getNotesForTrack(track.id);
  
  // Calculate MIDI track width
  const trackWidth = useMemo(() => calculateMidiTrackWidth(
    trackNotes,
    timeSignature,
    midiMeasureWidth
  ), [trackNotes, timeSignature, midiMeasureWidth]);
  
  // MIDI-specific track content rendering
  const renderTrackContent = () => (
    <>
      <Box
        className="piano-roll-trigger"
        data-testid="piano-roll-trigger"
        data-track-id={track.id}
        data-track-type={track.type}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: 'pointer',
          zIndex: 100,
          opacity: 0.3,
          backgroundColor: 'rgba(0, 100, 255, 0.1)',
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.3)'
          }
        }}
      />
      <MidiNotesPreview 
        trackId={track.id}
        width={trackWidth}
        height={GRID_CONSTANTS.trackHeight - 6}
        trackColor={trackColor}
      />
    </>
  );
  
  return (
    <BaseTrackPreview
      {...restProps}
      track={track}
      trackWidth={trackWidth}
      trackColor={trackColor}
      timeSignature={timeSignature}
      renderTrackContent={renderTrackContent}
      trackIndex={trackIndex}
    />
  );
};

export default React.memo(MidiTrackPreview);