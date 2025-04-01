import React, { useState } from 'react';
import { Chip } from '@mui/material';

interface AssistantActionChipProps {
  action: string;
  onClick: () => void;
}

const AssistantActionChip: React.FC<AssistantActionChipProps> = ({ action, onClick }) => {
  const [isClicked, setIsClicked] = useState(false);
  
  // Create a user-friendly label based on the action type
  const getActionLabel = (actionType: string): string => {
    switch (actionType) {
      case 'add_generated_track':
        return '➕ Add generated track';
      case 'add_track':
        return '➕ Add track';
      case 'adjust_volume':
        return '🔊 Adjust volume';
      case 'toggle_mute':
        return '🔇 Toggle mute';
      case 'change_bpm':
        return '⏱️ Change BPM';
      case 'change_time_signature':
        return '🎵 Change time signature';
      case 'move_track':
        return '↔️ Move track';
      default:
        // Convert snake_case to Title Case with spaces
        return actionType
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
    }
  };

  return (
    <Chip 
      label={getActionLabel(action)}
      size='small'
      color="primary"
      variant="outlined"
      clickable={!isClicked}
      disabled={isClicked}
      onClick={() => {
        onClick();
        setIsClicked(true);
      }}
      sx={{
        width: 'fit-content',
        borderRadius: '5px',
        height: '24px',
        border: '1px solid rgba(144, 202, 249, 0.5)',
        bgcolor: 'rgba(20, 20, 30, 0.9)',
        color: 'rgba(144, 202, 249, 0.9)',
        '& .MuiChip-label': {
          fontSize: '0.75rem',
          px: 1
        },
        '&:hover': {
          bgcolor: 'rgba(40, 40, 60, 0.9)',
          borderColor: 'rgba(144, 202, 249, 0.8)'
        },
        '&.Mui-disabled': {
          opacity: 0.7,
          bgcolor: 'rgba(20, 20, 30, 0.6)',
          border: '1px solid rgba(144, 202, 249, 0.3)',
          color: 'rgba(144, 202, 249, 0.5)'
        }
      }}
    />
  );
};

export default AssistantActionChip;
