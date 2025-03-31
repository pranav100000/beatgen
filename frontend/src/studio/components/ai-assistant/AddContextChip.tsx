import React from 'react';
import { Chip } from '@mui/material';

interface AddContextChipProps {
  trackName: string;
  onDelete: () => void;
}

const AddContextChip: React.FC<AddContextChipProps> = ({ trackName, onDelete }) => {
  return (
    <Chip 
      label={trackName}
      size='small'
      onDelete={onDelete}
      sx={{
        height: '20px',
        borderRadius: '5px',
        '& .MuiChip-label': {
          fontSize: '0.7rem'
        }
      }}
    />
  );
};

export default AddContextChip;
