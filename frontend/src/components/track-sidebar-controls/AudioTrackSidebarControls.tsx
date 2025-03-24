import React from 'react';
import { Box } from '@mui/material';
import BaseTrackSidebarControls, { BaseTrackSidebarControlsProps } from './BaseTrackSidebarControls';

export interface AudioTrackSidebarControlsProps extends BaseTrackSidebarControlsProps {
  waveformData?: number[];
}

const AudioTrackSidebarControls: React.FC<AudioTrackSidebarControlsProps> = (props) => {
  const renderAdditionalControls = () => {
    // For now, no additional controls specific to audio tracks
    return null;
  };

  return (
    <BaseTrackSidebarControls
      {...props}
      renderAdditionalControls={renderAdditionalControls}
      color={props.color}
    />
  );
};

export default AudioTrackSidebarControls;