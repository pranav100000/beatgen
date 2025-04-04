import React from 'react';
import { Chip } from '@mui/material';

interface MenuChipProps {
  label: string;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  disabled?: boolean;
  color?: string;
  filled?: boolean;
}

const MenuChip: React.FC<MenuChipProps> = ({ label, onClick, disabled, color, filled }) => {
  return (
    <Chip 
      label={label}
      size='small' 
      clickable={!disabled}
      onClick={onClick}
      disabled={disabled}
      sx={{
        width: 'fit-content',
        borderRadius: '5px',
        height: '20px',
        bgcolor: filled ? 'rgba(60, 60, 60, 0.8)' : color,  // Use solid gray if filled
        '& .MuiChip-label': {
          fontSize: '0.7rem'
        },
        '&.Mui-disabled': {
          opacity: 1,
          bgcolor: filled ? 'rgba(60, 60, 60, 0.8)' : color || 'rgba(255, 255, 255, 0.2)'
        }
      }}
      color={!color ? 'default' : 'primary'}
    />
  );
};

export default MenuChip;
