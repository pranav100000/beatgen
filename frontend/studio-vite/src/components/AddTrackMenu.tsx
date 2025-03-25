import React from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import PianoIcon from '@mui/icons-material/Piano';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';

interface AddTrackMenuProps {
  isOpen: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onAddTrack: (type: 'midi' | 'audio' | 'drum') => void;
  onFileUpload?: (file: File) => void;
}

export const AddTrackMenu: React.FC<AddTrackMenuProps> = ({ 
  isOpen, 
  anchorEl, 
  onClose, 
  onAddTrack, 
  onFileUpload 
}) => {
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (onFileUpload) onFileUpload(file);
      onClose();
    }
  };
  
  return (
    <Menu
      open={isOpen}
      anchorEl={anchorEl}
      onClose={onClose}
      PaperProps={{
        sx: { bgcolor: '#222', color: 'white', minWidth: 180 }
      }}
    >
      <MenuItem onClick={() => { onAddTrack('midi'); onClose(); }}
        sx={{ 
          fontSize: '13px',
          py: 1,
          '&:hover': { 
            bgcolor: 'rgba(33, 150, 243, 0.2)' 
          }
        }}
      >
        <ListItemIcon><PianoIcon sx={{ color: '#2196f3' }} /></ListItemIcon>
        <ListItemText primary="MIDI Track" />
      </MenuItem>
      
      <MenuItem onClick={() => { onAddTrack('drum'); onClose(); }}
        sx={{ 
          fontSize: '13px',
          py: 1,
          '&:hover': { 
            bgcolor: 'rgba(255, 152, 0, 0.2)' 
          }
        }}
      >
        <ListItemIcon><GraphicEqIcon sx={{ color: '#ff9800' }} /></ListItemIcon>
        <ListItemText primary="Drum Machine" />
      </MenuItem>
      
      <Divider sx={{ bgcolor: '#444' }} />
      
      <MenuItem
        sx={{ 
          fontSize: '13px',
          py: 1,
          '&:hover': { 
            bgcolor: 'rgba(76, 175, 80, 0.2)' 
          }
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }}>
          <ListItemIcon><AudioFileIcon sx={{ color: '#4caf50' }} /></ListItemIcon>
          <ListItemText primary="Import Audio" />
          <input 
            type="file" 
            accept="audio/*" 
            style={{ display: 'none' }} 
            onChange={handleFileUpload} 
          />
        </label>
      </MenuItem>
    </Menu>
  );
};

export default AddTrackMenu;