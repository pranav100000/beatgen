import React, { useState } from 'react';
import { Chip } from '@mui/material';

interface AssistantActionChipProps {
  action: string;
  onClick: () => void;
}

const AssistantActionChip: React.FC<AssistantActionChipProps> = ({ action, onClick }) => {
  const [isClicked, setIsClicked] = useState(false);

  return (
    <Chip 
      label={action}
      size='small'
      clickable={!isClicked}
      disabled={isClicked}
      onClick={() => {
        onClick();
        setIsClicked(true);
      }}
      sx={{
        width: 'fit-content',
        borderRadius: '5px',
        height: '20px',
        bgcolor: 'rgba(60, 60, 60, 0.8)',  // Solid gray background
        '& .MuiChip-label': {
          fontSize: '0.7rem'
        },
        '&:hover': {
          bgcolor: 'rgba(80, 80, 80, 0.8)'  // Slightly lighter on hover
        },
        '&.Mui-disabled': {
          opacity: 1,
          bgcolor: 'rgba(60, 60, 60, 0.8)'
        }
      }}
    />
  );
};

export default AssistantActionChip;
