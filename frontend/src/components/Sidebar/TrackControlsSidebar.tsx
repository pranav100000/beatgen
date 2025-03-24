import React from 'react';
import { Box } from '@mui/material';
import { AudioTrack } from '../../core/audio-engine/audioEngine';
import TrackSidebarControlsFactory from '../track-sidebar-controls/TrackSidebarControlsFactory';
import { TrackState } from '../../core/types/track';

interface TrackControlsSidebarProps {
  tracks: AudioTrack[] | TrackState[];
  onVolumeChange: (trackId: string, volume: number) => void;
  onPanChange: (trackId: string, pan: number) => void;
  onMute: (trackId: string, muted: boolean) => void;
  onSolo: (trackId: string, soloed: boolean) => void;
  onTrackNameChange?: (trackId: string, name: string) => void;
  onDeleteTrack: (index: number) => void;
}

// Type guard to check if a track is a TrackState
function isTrackState(track: AudioTrack | TrackState): track is TrackState {
  return 'type' in track;
}

// Safe way to access potentially undefined properties
function getPropertySafely<T>(obj: any, property: string, defaultValue: T): T {
  return (obj && property in obj) ? obj[property] : defaultValue;
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
        overflow: 'auto',
        maxHeight: 'calc(100vh - 200px)'
      }}
    >
      {tracks.map((track, index) => {
        // Determine the track type (audio is default)
        const trackType = isTrackState(track) ? track.type : 'audio';
        
        // Safely extract optional properties if they exist
        const instrument = trackType === 'midi' ? getPropertySafely(track, 'instrument', undefined) : undefined;
        const drumKit = trackType === 'drum' ? getPropertySafely(track, 'drumKit', undefined) : undefined;

        // Create a properly typed track object for the factory
        const factoryTrack = {
          id: track.id,
          name: track.name,
          volume: track.volume,
          pan: track.pan,
          muted: track.muted,
          soloed: track.soloed,
          type: trackType,
          // Only add these properties if they have values
          ...(instrument && { instrument }),
          ...(drumKit && { drumKit })
        };

        return (
          <TrackSidebarControlsFactory
            key={track.id}
            track={factoryTrack}
            index={index}
            trackId={track.id}
            volume={track.volume} 
            pan={track.pan}
            muted={track.muted}
            soloed={track.soloed}
            name={track.name}
            onDelete={onDeleteTrack}
            onVolumeChange={(vol) => onVolumeChange(track.id, vol)}
            onPanChange={(pan) => onPanChange(track.id, pan)}
            onMute={(muted) => onMute(track.id, muted)}
            onSolo={(soloed) => onSolo(track.id, soloed)}
            onNameChange={(name) => onTrackNameChange?.(track.id, name)}
          />
        );
      })}
    </Box>
  );
};