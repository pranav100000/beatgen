import React from 'react';
import { Menu, MenuItem } from '@mui/material';

interface ChatModeMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onSelect: (mode: string) => void;
}

const ChatModeMenu: React.FC<ChatModeMenuProps> = ({ anchorEl, open, onClose, onSelect }) => {
  const handleSelect = (mode: string) => {
    onSelect(mode);
    onClose();
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      PaperProps={{
        sx: {
          borderRadius: 2,
          mt: 1
        }
      }}
    >
      <MenuItem onClick={() => handleSelect('generate')}>Generate</MenuItem>
      <MenuItem onClick={() => handleSelect('edit')}>Edit</MenuItem>
    </Menu>
  );
};

export default ChatModeMenu;
