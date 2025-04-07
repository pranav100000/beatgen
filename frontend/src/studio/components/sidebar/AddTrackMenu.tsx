import React, { useState } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import PianoIcon from '@mui/icons-material/Piano';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import { VirtualInstrumentsModal } from '../modals/VirtualInstrumentsModal';

interface AddTrackMenuProps {
  isOpen: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onAddTrack: (type: 'midi' | 'audio' | 'drum' | 'sampler', instrumentId?: string, instrumentName?: string, instrumentStorageKey?: string) => void;
  onFileUpload?: (file: File, isSampler?: boolean) => void;
}

export const AddTrackMenu: React.FC<AddTrackMenuProps> = ({ 
  isOpen, 
  anchorEl, 
  onClose, 
  onAddTrack, 
  onFileUpload 
}) => {
  const [isVirtualInstrumentModalOpen, setIsVirtualInstrumentModalOpen] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, isSampler: boolean = false) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (onFileUpload) onFileUpload(file, isSampler);
      onClose();
    }
  };
  
  return (
    <>
      <Menu
        open={isOpen}
        anchorEl={anchorEl}
        onClose={onClose}
        PaperProps={{
          sx: { bgcolor: '#222', color: 'white', minWidth: 180 }
        }}
      >
        <MenuItem onClick={() => {
          setIsVirtualInstrumentModalOpen(true);
          onClose();
        }}
          sx={{ 
            fontSize: '13px',
            py: 1,
            '&:hover': { 
              bgcolor: 'rgba(33, 150, 243, 0.2)' 
            }
          }}
        >
          <ListItemIcon><PianoIcon sx={{ color: '#2196f3' }} /></ListItemIcon>
          <ListItemText primary="Virtual Instrument" />
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
        <MenuItem
          sx={{ 
            fontSize: '13px',
            py: 1,
            '&:hover': { 
              bgcolor: 'rgba(156, 39, 176, 0.2)' 
            }
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }}>
            <ListItemIcon><ContentCutIcon sx={{ color: '#9c27b0' }} /></ListItemIcon>
            <ListItemText primary="Sampler" />
            <input 
              type="file" 
              accept="audio/*" 
              style={{ display: 'none' }} 
              onChange={(e) => handleFileUpload(e, true)} 
            />
          </label>
        </MenuItem>
      </Menu>

      <VirtualInstrumentsModal
        open={isVirtualInstrumentModalOpen}
        onClose={() => setIsVirtualInstrumentModalOpen(false)}
        onSelect={(instrumentId: string, displayName: string, storageKey?: string) => {
          onAddTrack('midi', instrumentId, displayName, storageKey);
          setIsVirtualInstrumentModalOpen(false);
        }}
      />
    </>
  );
};

export default AddTrackMenu;