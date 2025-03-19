import React from 'react';
import { Box } from '@mui/material';
import { AudioTrack } from '../../core/audio-engine/audioEngine';
import TrackControls from '../TrackControls';

interface TrackControlsSidebarProps {
  tracks: AudioTrack[];
  onVolumeChange: (trackId: string, volume: number) => void;
  onPanChange: (trackId: string, pan: number) => void;
  onMute: (trackId: string, muted: boolean) => void;
  onSolo: (trackId: string, soloed: boolean) => void;
  onTrackNameChange?: (trackId: string, name: string) => void;
  onDeleteTrack: (index: number) => void;
}

export const TrackControlsSidebar: React.FC<TrackControlsSidebarProps> = ({
  tracks,
  onVolumeChange,
  onPanChange,
  onMute,
  onSolo,
  onTrackNameChange,
  onDeleteTrack
}) => {
  return (
    <Box 
      className="track-controls-sidebar"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        // overflow: 'auto',
        maxHeight: 'calc(100vh - 200px)'
      }}
    >
      {tracks.map((track, index) => (
        <TrackControls
          key={track.id}
          index={index}
          onDelete={onDeleteTrack}
          volume={track.volume}
          pan={track.pan}
          muted={track.muted}
          soloed={track.soloed}
          name={track.name}
          onVolumeChange={(vol) => onVolumeChange(track.id, vol)}
          onPanChange={(pan) => onPanChange(track.id, pan)}
          onMute={(muted) => onMute(track.id, muted)}
          onSolo={(soloed) => onSolo(track.id, soloed)}
          onNameChange={(name) => onTrackNameChange?.(track.id, name)}
        />
      ))}
    </Box>
  );
}; 