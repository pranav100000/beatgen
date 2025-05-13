import React from 'react';
import { Menu, MenuItem } from '@mui/material';

interface ChatModelMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onSelect: (model: string) => void;
  models: string[]; // Add a prop for the list of models
}

const ChatModelMenu: React.FC<ChatModelMenuProps> = ({ anchorEl, open, onClose, onSelect, models }) => {
  const handleSelect = (model: string) => {
    onSelect(model);
    onClose();
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'top', // Position menu above the chip
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      PaperProps={{
        sx: {
          borderRadius: 2,
          mb: 1, // Margin bottom to space it from the chip
        },
      }}
    >
      {models.map((model) => (
        <MenuItem 
          key={model} 
          onClick={() => handleSelect(model)}
          sx={{ 
            paddingTop: '2px', // Further reduced padding
            paddingBottom: '2px', // Further reduced padding
            fontSize: '0.75rem' // Smaller font size
          }}
        >
          {model}
        </MenuItem>
      ))}
    </Menu>
  );
};

export default ChatModelMenu; 