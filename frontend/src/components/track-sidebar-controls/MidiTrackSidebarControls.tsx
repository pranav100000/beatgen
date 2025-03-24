import React from 'react';
import { Box } from '@mui/material';
import BaseTrackSidebarControls, { BaseTrackSidebarControlsProps } from './BaseTrackSidebarControls';

export interface MidiTrackSidebarControlsProps extends BaseTrackSidebarControlsProps {
  instrument?: string;
}

const MidiTrackSidebarControls: React.FC<MidiTrackSidebarControlsProps> = (props) => {
  const { instrument } = props;
  
  const renderAdditionalControls = () => {
    if (instrument) {
      return (
        <Box sx={{ 
          mt: 0.5, 
          fontSize: '0.7rem', 
          color: '#888',
          textAlign: 'center'
        }}>
          {instrument}
        </Box>
      );
    }
    
    return null;
  };

  return (
    <BaseTrackSidebarControls
      {...props}
      renderAdditionalControls={renderAdditionalControls}
      sliderColor="#4caf50" // Green color for MIDI tracks
    />
  );
};

export default MidiTrackSidebarControls;