import React from 'react';
import { BaseTrackSidebarControlsProps } from './BaseTrackSidebarControls';
import AudioTrackSidebarControls, { AudioTrackSidebarControlsProps } from './AudioTrackSidebarControls';
import MidiTrackSidebarControls, { MidiTrackSidebarControlsProps } from './MidiTrackSidebarControls';
import DrumTrackSidebarControls, { DrumTrackSidebarControlsProps } from './DrumTrackSidebarControls';

// Define a track interface for what our factory needs
interface TrackWithType {
  id: string;
  name: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  type: 'audio' | 'midi' | 'drum' | 'video';
  // Optional properties
  instrument?: string;
  drumKit?: string;
  color?: string;
}

// Extend BaseTrackSidebarControlsProps and add track and type-specific props
export interface TrackSidebarControlsFactoryProps extends BaseTrackSidebarControlsProps {
  track: TrackWithType;
  // Type-specific additional props
  waveformData?: number[];
  instrument?: string;
  drumKit?: string;
}

const TrackSidebarControlsFactory: React.FC<TrackSidebarControlsFactoryProps> = (props) => {
  const { track, waveformData, instrument, drumKit, ...commonProps } = props;

  // Extract props (not using track directly anymore since we're passing the props separately)
  // We'll only use track.type and track.instrument/track.drumKit

  // Choose the appropriate component based on track type
  switch (track.type) {
    case 'audio': {
      const audioProps: AudioTrackSidebarControlsProps = {
        ...commonProps, // Already contains all the needed props
        waveformData
      };
      return <AudioTrackSidebarControls {...audioProps} />;
    }

    case 'midi': {
      const midiProps: MidiTrackSidebarControlsProps = {
        ...commonProps,
        instrument: instrument ?? track.instrument
      };
      return <MidiTrackSidebarControls {...midiProps} />;
    }

    case 'drum': {
      const drumProps: DrumTrackSidebarControlsProps = {
        ...commonProps,
        drumKit: drumKit ?? track.drumKit
      };
      return <DrumTrackSidebarControls {...drumProps} />;
    }

    default: {
      // Default to audio controls for other types (like video)
      console.warn(`Using audio controls for track type: ${track.type}`);
      return <AudioTrackSidebarControls {...commonProps} />;
    }
  }
};

export default TrackSidebarControlsFactory;