import React from 'react';
import { Box } from '@mui/material';
import BaseTrackSidebarControls, { BaseTrackSidebarControlsProps } from './BaseTrackSidebarControls';

export interface DrumTrackSidebarControlsProps extends BaseTrackSidebarControlsProps {
  drumKit?: string;
}

const DrumTrackSidebarControls: React.FC<DrumTrackSidebarControlsProps> = (props) => {
  const { drumKit } = props;
  
  const renderAdditionalControls = () => {
    if (drumKit) {
      return (
        <Box sx={{ 
          mt: 0.5, 
          fontSize: '0.7rem', 
          color: '#888',
          textAlign: 'center' 
        }}>
          {drumKit}
        </Box>
      );
    }
    
    return null;
  };

  return (
    <BaseTrackSidebarControls
      {...props}
      renderAdditionalControls={renderAdditionalControls}
      color={props.color} // Orange color for drum tracks
    />
  );
};

export default DrumTrackSidebarControls;