import React from 'react';
import TrackSidebarControlsFactory from './track-sidebar-controls/TrackSidebarControlsFactory';

/**
 * This component exists for backward compatibility.
 * It wraps the new TrackSidebarControlsFactory with the old props interface.
 */
interface TrackControlsProps {
  index: number;
  onDelete: (index: number) => void;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  name: string;
  onVolumeChange: (volume: number) => void;
  onPanChange: (pan: number) => void;
  onMute: (muted: boolean) => void;
  onSolo: (soloed: boolean) => void;
  onNameChange: (name: string) => void;
}

const TrackControls: React.FC<TrackControlsProps> = (props) => {
  const {
    index,
    onDelete,
    volume,
    pan,
    muted,
    soloed,
    name,
    onVolumeChange,
    onPanChange,
    onMute,
    onSolo,
    onNameChange
  } = props;

  // Create a properly typed track object for the factory
  const trackData = {
    id: String(index), // Use index as a fallback ID
    name,
    volume,
    pan,
    muted,
    soloed,
    type: 'audio' as const // Default to audio type
  };

  return (
    <TrackSidebarControlsFactory
      track={trackData}
      index={index}
      trackId={String(index)}
      volume={volume}
      pan={pan}
      muted={muted}
      soloed={soloed}
      name={name}
      onDelete={onDelete}
      onVolumeChange={onVolumeChange}
      onPanChange={onPanChange}
      onMute={onMute}
      onSolo={onSolo}
      onNameChange={onNameChange}
    />
  );
};

export default TrackControls;